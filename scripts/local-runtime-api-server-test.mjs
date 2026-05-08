import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          const payload = JSON.parse(line);
          clearTimeout(timeout);
          resolve(payload);
          return;
        } catch {
          // Keep waiting for a complete JSON line.
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

async function selectProject(baseUrl, projectRoot, projectId, displayName) {
  return fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot, projectId, displayName }),
  });
}

function assert005Payload(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.previewStatus === "real_image2_start_preview_ready_with_review", `${label} preview status mismatch`);
  assert(payload.productionStatus === "needs_review", `${label} production status mismatch`);
  assert(Array.isArray(payload.reviewOverlayShots), `${label} reviewOverlayShots missing`);
  assert(payload.reviewOverlayShots.includes("S07"), `${label} missing S07 overlay`);
  assert(payload.reviewOverlayShots.includes("S08"), `${label} missing S08 overlay`);
  assert(Number(payload.shotCount) === 8, `${label} shot count mismatch`);
  assert(Array.isArray(payload.observations) && payload.observations.length === 8, `${label} observations mismatch`);
}

const project004Root = "real-test-sandbox/real-demo-e2e/004-image2-start-frames";
const project004Id = "real_demo_e2e_004_image2_start_frames";
const project004TruthPath = `${project004Root}/reports/runtime_truth_layer.json`;
const project004VibePath = `${project004Root}/project/project.vibe`;
const project005Root = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames";
const project005Id = "real_demo_e2e_005_anime_image2_start_frames";
const project005TruthPath = `${project005Root}/reports/runtime_truth_layer.json`;
const project005VibePath = `${project005Root}/project/project.vibe`;

function assertNo005Leak(payload, label) {
  const text = JSON.stringify(payload);
  assert(!text.includes(project005Id), `${label} must not leak 005 project id`);
  assert(!text.includes(project005Root), `${label} must not leak 005 project root`);
  assert(!text.includes("S07"), `${label} must not leak 005 review shots`);
  assert(!text.includes("S08"), `${label} must not leak 005 review shots`);
}

function assertUnboundPayload(payload, label) {
  assert(payload.ok === false, `${label} should fail closed`);
  assert(payload.status === "unbound", `${label} status should be unbound`);
  assert(payload.previewStatus === "unavailable", `${label} preview status should be unavailable`);
  assert(payload.productionStatus === "blocked", `${label} production status should be blocked`);
  assert(payload.projectRootMode === "unbound_current_project", `${label} project root mode mismatch`);
  assert(Array.isArray(payload.observations) && payload.observations.length === 0, `${label} observations should be empty`);
  assert(Array.isArray(payload.previewItems) && payload.previewItems.length === 0, `${label} previewItems should be empty`);
  assert(payload.ledgerProjection === undefined, `${label} ledger projection should be absent`);
  assertNo005Leak(payload, label);
}

function assertProjectProjectionFacts(payload, label, root, primaryReportPath) {
  assert(payload.projectRootRelativePath === root, `${label} projectRootRelativePath mismatch`);
  assert(payload.projectVibeRelativePath === `${root}/project/project.vibe`, `${label} projectVibeRelativePath mismatch`);
  assert(payload.projectionSource === "runtime_truth_layer+preview_plan", `${label} should prefer runtime truth + preview plan`);
  assert(payload.ledgerTruthSource === "runtime_truth_layer", `${label} ledger truth source mismatch`);
  assert(Array.isArray(payload.factsUsed), `${label} factsUsed missing`);
  assert(payload.factsUsed.some((item) => item.name === "run_manifest"), `${label} should use run_manifest`);
  assert(payload.factsUsed.some((item) => item.name === "runtime_truth_layer"), `${label} should use runtime_truth_layer`);
  assert(payload.factsUsed.some((item) => item.name === "preview_plan"), `${label} should use preview_plan`);
  assert(payload.reportPath === primaryReportPath, `${label} primary report path mismatch`);
  assert(payload.image2ReportPath === `${root}/reports/image2_start_long_chain_report.json`, `${label} compatibility image2 report path mismatch`);
}

function assertCurrentBindingContext(payload, label, root, projectId) {
  assert(payload.currentProject?.bound === true, `${label} should expose bound current project`);
  assert(payload.projectRootMode === "runtime_current_project_binding", `${label} should use runtime binding`);
  assert(payload.requestContext?.projectRoot === root, `${label} request context project root mismatch`);
  assert(payload.requestContext?.projectRootSource === "binding", `${label} request context source mismatch`);
  assert(payload.project?.projectId === projectId, `${label} project id mismatch`);
  assert(payload.projectId === projectId, `${label} top-level project id mismatch`);
  assert(payload.identity?.projectId === projectId, `${label} identity project id mismatch`);
  assert(payload.project?.projectRoot === root, `${label} project root mismatch`);
}

function assertCurrent005(payload, label) {
  assert005Payload(payload, label);
  assertCurrentBindingContext(payload, label, project005Root, project005Id);
  assert(payload.project?.runId === "real_demo_e2e_005_anime_image2_start_frames_run_20260507", `${label} project run id mismatch`);
  assert(payload.plannedImageCount === 8, `${label} planned image count mismatch`);
  assert(payload.returnedImageCount === 8, `${label} returned image count mismatch`);
  assert(payload.needsReviewCount === 2, `${label} needs review count mismatch`);
  assert(Array.isArray(payload.previewItems) && payload.previewItems.length === 8, `${label} preview items mismatch`);
  assertProjectProjectionFacts(payload, label, project005Root, project005TruthPath);
}

function assertCurrent004(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assertCurrentBindingContext(payload, label, project004Root, project004Id);
  assert(payload.previewStatus === "blocked", `${label} should read 004 projection`);
  assert(payload.returnedImageCount === 4, `${label} should count only existing 004 outputs`);
  assert(payload.blockerCount === 8, `${label} should project blocked 004 shots`);
  assertProjectProjectionFacts(payload, label, project004Root, project004TruthPath);
  assert(!JSON.stringify(payload).includes(project005Id), `${label} must not mix in 005 project identity`);
}

function assertImage2Batch005(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.projectionKind === "current_project_image2_batch_prepare_plan", `${label} projection kind mismatch`);
  assertCurrentBindingContext(payload, label, project005Root, project005Id);
  assert(payload.submitPolicy?.providerCallAllowed === false, `${label} provider calls must be disallowed`);
  assert(payload.submitPolicy?.dryRunOnly === true, `${label} should be dry-run only`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run prepare`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must not be allowed`);
  assert(Array.isArray(payload.items) && payload.items.length === 8, `${label} items mismatch`);
  assert(payload.summary?.plannedCount === 8, `${label} planned count mismatch`);
  assert(payload.summary?.returnedCount === 8, `${label} returned count mismatch`);
  assert(payload.summary?.reviewCount === 2, `${label} review count mismatch`);
  assert(payload.ledgerProjection?.summary?.completeVerified === 6, `${label} ledger completeVerified mismatch`);
  assert(payload.ledgerProjection?.summary?.reviewNeeded === 2, `${label} ledger reviewNeeded count mismatch`);
  assert(payload.items.every((item) => item.taskRunId.includes("real_demo_005")), `${label} must use 005 task ids`);
}

function assertImage2Batch004(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.projectionKind === "current_project_image2_batch_prepare_plan", `${label} projection kind mismatch`);
  assertCurrentBindingContext(payload, label, project004Root, project004Id);
  assert(payload.summary?.plannedCount === 8, `${label} planned count mismatch`);
  assert(payload.summary?.returnedCount === 4, `${label} returned count mismatch`);
  assert(payload.summary?.blockedCount === 8, `${label} blocked count mismatch`);
  assert(payload.ledgerProjection?.summary?.parked === 8, `${label} should park blocked 004 ledger items`);
  assert(payload.items.every((item) => item.taskRunId.includes("real_demo_004")), `${label} must use 004 task ids`);
  assert(!JSON.stringify(payload).includes(project005Id), `${label} must not mix in 005 project identity`);
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-runtime-api-test-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const outsideRoot = path.join(tempRoot, "outside-project");
const outsideFile = path.join(tempRoot, "outside-file.txt");
const repoSymlinkRoot = "real-test-sandbox/current-project-runtime-boundary-link";
const repoSymlinkFile = `${project004Root}/runtime-boundary-file-link.txt`;

writeFileSync(outsideFile, "outside runtime boundary\n", "utf8");

const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    VIBE_CORE_CURRENT_PROJECT_ROOT: project005Root,
    VIBE_CORE_PROJECT_ROOT: project005Root,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const { baseUrl } = await waitForServer(child);
  const runtimeStatus = await fetchJson(`${baseUrl}/api/runtime/status`);
  assert(runtimeStatus.response.status === 200, "GET runtime status should return 200");
  assert(runtimeStatus.payload.endpoints?.currentProjectBindingEndpoint === "/api/runtime/projects/current", "runtime status should expose current project binding endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectSelectEndpoint === "/api/runtime/projects/select", "runtime status should expose current project select endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectRecentEndpoint === "/api/runtime/projects/recent", "runtime status should expose recent projects endpoint");

  const currentUnbound = await fetchJson(`${baseUrl}/api/runtime/projects/current`);
  assert(currentUnbound.response.status === 200, "GET current project binding should return 200");
  assert(currentUnbound.payload.status === "unbound", "current project should start unbound");
  assert(!existsSync(bindingPath), "test binding file should not be created before select");

  const project004VibeBeforeRecent = statSync(project004VibePath).mtimeMs;
  const project005VibeBeforeRecent = statSync(project005VibePath).mtimeMs;
  const recentUnbound = await fetchJson(`${baseUrl}/api/runtime/projects/recent`);
  assert(recentUnbound.response.status === 200, "GET recent projects should return 200");
  assert(recentUnbound.payload.ok === true, "GET recent projects should be ok");
  assert(recentUnbound.payload.providerCalled === false, "GET recent projects must not call provider");
  assert(recentUnbound.payload.prepareRan === false, "GET recent projects must not run prepare");
  assert(recentUnbound.payload.projectVibeWritten === false, "GET recent projects must not write project.vibe");
  assert(!existsSync(bindingPath), "GET recent projects must not create the runtime-local binding");
  assert(statSync(project004VibePath).mtimeMs === project004VibeBeforeRecent, "GET recent projects must not mutate 004 project.vibe");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBeforeRecent, "GET recent projects must not mutate 005 project.vibe");
  assert(Array.isArray(recentUnbound.payload.choices), "GET recent projects choices missing");
  assert(recentUnbound.payload.choices.some((choice) => choice.projectRoot === project004Root), "GET recent projects should include 004");
  assert(recentUnbound.payload.choices.some((choice) => choice.projectRoot === project005Root), "GET recent projects should include 005");
  assert(recentUnbound.payload.choices.every((choice) => typeof choice.displayName === "string" && choice.displayName.length > 0), "GET recent projects choices need display names");
  assert(recentUnbound.payload.choices.every((choice) => !String(choice.projectRoot).startsWith("/")), "GET recent projects must not expose absolute project roots");
  assert(!JSON.stringify(recentUnbound.payload).includes("/Users/"), "GET recent projects must not expose sensitive absolute paths");

  for (const [label, url, init] of [
    ["GET current real-chain status", `${baseUrl}/api/runtime/projects/current/real-chain/status`, undefined],
    ["POST current real-chain run-check", `${baseUrl}/api/runtime/projects/current/real-chain/run-check`, { method: "POST" }],
    ["GET current image2 batch plan", `${baseUrl}/api/runtime/projects/current/image2-batch/plan`, undefined],
    ["POST current image2 batch run-check", `${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, { method: "POST" }],
  ]) {
    const result = await fetchJson(url, init);
    assert(result.response.status === 409, `${label} should return 409 while unbound`);
    assertUnboundPayload(result.payload, label);
  }

  const project005VibeBefore = statSync(project005VibePath).mtimeMs;
  const select005 = await selectProject(baseUrl, project005Root, project005Id, "005 anime image2");
  assert(select005.response.status === 200, "POST select 005 should return 200");
  assert(select005.payload.status === "bound", "POST select 005 should bind");
  assert(select005.payload.providerCalled === false, "POST select 005 must not call provider");
  assert(select005.payload.prepareRan === false, "POST select 005 must not run prepare");
  assert(select005.payload.projectVibeWritten === false, "POST select must not write project.vibe");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBefore, "POST select 005 must not mutate project.vibe");
  assert(existsSync(bindingPath), "POST select should write runtime-local binding");
  assert(JSON.parse(readFileSync(bindingPath, "utf8")).projectRoot === project005Root, "binding file should store 005 root");

  const project005Status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(project005Status.response.status === 200, "GET current status after select 005 should return 200");
  assertCurrent005(project005Status.payload, "GET current status after select 005");

  const query004Status = await fetchJson(
    `${baseUrl}/api/runtime/projects/current/real-chain/status?projectRoot=${encodeURIComponent(project004Root)}&projectId=${encodeURIComponent(project004Id)}`,
  );
  assert(query004Status.response.status === 200, "GET current status with query override should return 200");
  assertCurrent005(query004Status.payload, "GET current status with ignored query override");
  assert(query004Status.payload.ignoredRequestContext?.ignoredProjectRootProvided === true, "query override should be recorded as ignored");
  assert(query004Status.payload.ignoredRequestContext?.ignoredProjectRootSource === "query", "query override source should be recorded");

  const body004Run = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: project004Root, projectId: project004Id }),
  });
  assert(body004Run.response.status === 200, "POST current run-check with body override should return 200");
  assertCurrent005(body004Run.payload, "POST current run-check with ignored body override");
  assert(body004Run.payload.command?.verifyScriptRan === false, "current run-check must not run verify script");

  const header004Plan = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`, {
    headers: {
      "x-vibe-project-root": project004Root,
      "x-vibe-project-id": project004Id,
    },
  });
  assert(header004Plan.response.status === 200, "GET image2 batch plan with header override should return 200");
  assertImage2Batch005(header004Plan.payload, "GET image2 batch plan with ignored header override");
  assert(header004Plan.payload.ignoredRequestContext?.ignoredProjectRootProvided === true, "header override should be recorded as ignored");
  assert(header004Plan.payload.ignoredRequestContext?.ignoredProjectRootSource === "header", "header override source should be recorded");

  const project004VibeBefore = statSync(project004VibePath).mtimeMs;
  const select004 = await selectProject(baseUrl, project004Root, project004Id, "004 image2");
  assert(select004.response.status === 200, "POST select 004 should return 200");
  assert(select004.payload.providerCalled === false, "POST select 004 must not call provider");
  assert(select004.payload.prepareRan === false, "POST select 004 must not run prepare");
  assert(select004.payload.projectVibeWritten === false, "POST select 004 must not write project.vibe");
  assert(statSync(project004VibePath).mtimeMs === project004VibeBefore, "POST select 004 must not mutate project.vibe");
  assert(JSON.parse(readFileSync(bindingPath, "utf8")).projectRoot === project004Root, "binding file should store 004 root");

  const recentAfterSelect004 = await fetchJson(`${baseUrl}/api/runtime/projects/recent`);
  assert(recentAfterSelect004.response.status === 200, "GET recent projects after select 004 should return 200");
  assert(recentAfterSelect004.payload.choices[0]?.projectRoot === project004Root, "recent projects should put the bound project first");
  assert(recentAfterSelect004.payload.choices[0]?.status === "当前", "recent projects should label the bound project as current");
  assert(recentAfterSelect004.payload.choices.filter((choice) => choice.projectRoot === project004Root).length === 1, "recent projects should de-duplicate the bound fixture");

  const project004Status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(project004Status.response.status === 200, "GET current status after select 004 should return 200");
  assertCurrent004(project004Status.payload, "GET current status after select 004");

  const query005Status = await fetchJson(
    `${baseUrl}/api/runtime/projects/current/real-chain/status?projectRoot=${encodeURIComponent(project005Root)}&projectId=${encodeURIComponent(project005Id)}`,
  );
  assert(query005Status.response.status === 200, "GET current status with 005 query override should return 200");
  assertCurrent004(query005Status.payload, "GET current status with ignored 005 query override");

  const image2Batch004 = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: project005Root, projectId: project005Id }),
  });
  assert(image2Batch004.response.status === 200, "POST image2 batch run-check after select 004 should return 200");
  assertImage2Batch004(image2Batch004.payload, "POST image2 batch run-check with ignored 005 body override");
  assert(image2Batch004.payload.command?.providerCalled === false, "image2 run-check must not call provider");
  assert(image2Batch004.payload.command?.prepareRan === false, "image2 run-check must not run prepare");
  assert(image2Batch004.payload.command?.workerSpawnForbidden === true, "image2 run-check must forbid worker spawn");

  const legacyStatus = await fetchJson(`${baseUrl}/api/runtime/real-demo-e2e/005/status`);
  assert(legacyStatus.response.status === 200, "legacy 005 status should return 200");
  assert005Payload(legacyStatus.payload, "legacy 005 status");
  assert(legacyStatus.payload.observations[0]?.imageUrl.includes("scope=real-demo-e2e-005"), "legacy file URLs should use explicit 005 scope");

  const legacyFile = await fetch(legacyStatus.payload.observations[0].imageUrl.replace("/api/runtime/files", `${baseUrl}/api/runtime/files`));
  assert(legacyFile.status === 200, "legacy scoped file should be readable");

  const current004OutputPath = image2Batch004.payload.items.find((item) => item.outputExists)?.expectedOutputPath;
  assert(current004OutputPath.endsWith("/start.png"), "current project preview output should be a start.png thumbnail");
  const project004VibeBeforeFileRead = statSync(project004VibePath).mtimeMs;
  const current004File = await fetch(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(current004OutputPath)}`);
  assert(current004File.status === 200, "current project file inside bound 004 should be readable");
  assert(current004File.headers.get("content-type") === "image/png", "current project start.png should be served as image/png");
  assert(current004File.headers.get("access-control-allow-origin") === "*", "current project start.png should retain CORS");
  assert(current004File.headers.get("x-content-type-options") === "nosniff", "current project start.png should use nosniff with the correct MIME");
  assert(current004File.headers.get("cache-control") === "no-store", "current project start.png should retain no-store cache policy");
  await current004File.arrayBuffer();
  assert(statSync(project004VibePath).mtimeMs === project004VibeBeforeFileRead, "runtime file read must not mutate project.vibe");

  const missingImageAsMedia = await fetch(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(`${project004Root}/outputs/shots/S01/start.png`)}`, {
    headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
  });
  assert(missingImageAsMedia.status === 404, "missing current project start.png media request should return 404");
  assert(missingImageAsMedia.headers.get("content-type") === "image/png", "missing current project start.png media request should keep image/png");
  assert(missingImageAsMedia.headers.get("access-control-allow-origin") === "*", "missing current project start.png media request should retain CORS");
  assert(missingImageAsMedia.headers.get("x-content-type-options") === "nosniff", "missing current project start.png media request should use nosniff");
  assert((await missingImageAsMedia.text()) === "", "missing current project start.png media request should not return JSON to image loads");

  const currentCannotRead005 = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(`${project005Root}/outputs/shots/S01/start.png`)}`);
  assert(currentCannotRead005.response.status === 403, "current project file route must not read outside bound project");
  assert(currentCannotRead005.payload.status === "forbidden", "outside bound project file status mismatch");

  const parentTraversal = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent("../package.json")}`);
  assert(parentTraversal.response.status === 403, "runtime files should block parent traversal");

  const externalAbsoluteFile = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(outsideFile)}`);
  assert(externalAbsoluteFile.response.status === 403, "runtime files should block absolute outside paths");

  rmSync(repoSymlinkFile, { force: true });
  symlinkSync(outsideFile, repoSymlinkFile);
  const symlinkFile = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(repoSymlinkFile)}`);
  assert(symlinkFile.response.status === 403, "runtime files should block symlink escape inside bound project");

  const escapingSelect = await selectProject(baseUrl, "../outside", "blocked_project", "blocked");
  assert(escapingSelect.response.status === 403, "select should block parent traversal roots");
  assert(escapingSelect.payload.status === "blocked", "escaping select status mismatch");

  const externalSelect = await selectProject(baseUrl, outsideRoot, "external_project", "external");
  assert(externalSelect.response.status === 403, "select should fail closed for absolute external roots");
  assert(/External user project roots/.test(externalSelect.payload.todo || ""), "external select should expose fail-closed diagnostic");

  rmSync(repoSymlinkRoot, { recursive: true, force: true });
  symlinkSync(tempRoot, repoSymlinkRoot, "dir");
  const symlinkSelect = await selectProject(baseUrl, repoSymlinkRoot, "symlink_project", "symlink");
  assert(symlinkSelect.response.status === 403, "select should block repo symlink roots pointing outside");

  console.log("Local runtime API current project binding test passed. No provider was called.");
} finally {
  child.kill("SIGTERM");
  rmSync(repoSymlinkFile, { force: true });
  rmSync(repoSymlinkRoot, { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
}
