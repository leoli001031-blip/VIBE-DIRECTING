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

function assert005Payload(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.previewStatus === "real_image2_start_preview_ready_with_review", `${label} preview status mismatch`);
  assert(payload.productionStatus === "needs_review", `${label} production status mismatch`);
  assert(Array.isArray(payload.reviewOverlayShots), `${label} reviewOverlayShots missing`);
  assert(payload.reviewOverlayShots.includes("S07"), `${label} missing S07 overlay`);
  assert(payload.reviewOverlayShots.includes("S08"), `${label} missing S08 overlay`);
  assert(Number(payload.shotCount) === 8, `${label} shot count mismatch`);
  assert(Array.isArray(payload.observations) && payload.observations.length === 8, `${label} observations mismatch`);
  const s07 = payload.observations.find((item) => item.shotId === "S07");
  const s08 = payload.observations.find((item) => item.shotId === "S08");
  assert(s07?.reviewOverlay === true, `${label} S07 should be review overlay`);
  assert(s08?.reviewOverlay === true, `${label} S08 should be review overlay`);
}

const project004Root = "real-test-sandbox/real-demo-e2e/004-image2-start-frames";
const project004Id = "real_demo_e2e_004_image2_start_frames";
const project004ReportPath = `${project004Root}/reports/image2_start_long_chain_report.json`;

function assertProjectRealChainPayload(payload, label) {
  assert005Payload(payload, label);
  assert(payload.projectionKind === "project_real_chain_status", `${label} projection kind mismatch`);
  assert(payload.projectRootMode === "compatibility_fallback", `${label} project root mode mismatch`);
  assert(/compatibility fallback/.test(payload.sourceLabel || ""), `${label} current project fallback label mismatch`);
  assert(payload.requestContext?.projectRootSource === "compatibility_fallback", `${label} request context fallback mismatch`);
  assert(payload.project?.projectId === "real_demo_e2e_005_anime_image2_start_frames", `${label} project id mismatch`);
  assert(payload.projectId === payload.project.projectId, `${label} top-level project id mismatch`);
  assert(payload.identity?.projectId === payload.project.projectId, `${label} identity project id mismatch`);
  assert(payload.project?.runId === "real_demo_e2e_005_anime_image2_start_frames_run_20260507", `${label} project run id mismatch`);
  assert(payload.plannedImageCount === 8, `${label} planned image count mismatch`);
  assert(payload.totalPlannedImages === 8, `${label} total planned image count mismatch`);
  assert(payload.returnedImageCount === 8, `${label} returned image count mismatch`);
  assert(payload.needsReviewCount === 2, `${label} needs review count mismatch`);
  assert(Array.isArray(payload.needsReviewShotIds), `${label} needsReviewShotIds missing`);
  assert(payload.needsReviewShotIds.includes("S07"), `${label} missing S07 needs review`);
  assert(payload.needsReviewShotIds.includes("S08"), `${label} missing S08 needs review`);
  assert(Array.isArray(payload.previewItems) && payload.previewItems.length === 8, `${label} preview items mismatch`);
  assert(payload.reportPath === "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json", `${label} report path should be project relative`);
}

function assertImage2BatchPlanPayload(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.projectionKind === "current_project_image2_batch_prepare_plan", `${label} projection kind mismatch`);
  assert(payload.projectRootMode === "compatibility_fallback", `${label} project root mode mismatch`);
  assert(/compatibility fallback/.test(payload.sourceLabel || ""), `${label} current project fallback label mismatch`);
  assert(payload.requestContext?.projectRootSource === "compatibility_fallback", `${label} request context fallback mismatch`);
  assert(payload.project?.projectId === "real_demo_e2e_005_anime_image2_start_frames", `${label} project id mismatch`);
  assert(payload.projectId === payload.project.projectId, `${label} top-level project id mismatch`);
  assert(payload.identity?.projectId === payload.project.projectId, `${label} identity project id mismatch`);
  assert(payload.submitPolicy?.providerCallAllowed === false, `${label} provider calls must be disallowed`);
  assert(payload.submitPolicy?.dryRunOnly === true, `${label} should be dry-run only`);
  assert(payload.submitPolicy?.manualSubmitRequired === true, `${label} should require manual submit`);
  assert(payload.submitPolicy?.liveSubmitAllowed === false, `${label} live submit must be disallowed`);
  assert(payload.submitPolicy?.noSeedance === true, `${label} Seedance must be blocked`);
  assert(payload.submitPolicy?.noJimeng === true, `${label} Jimeng must be blocked`);
  assert(payload.submitPolicy?.noVideo === true, `${label} video must be blocked`);
  assert(payload.submitPolicy?.noFast === true, `${label} fast mode must be blocked`);
  assert(payload.submitPolicy?.noVip === true, `${label} VIP mode must be blocked`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run prepare`);
  assert(payload.verifyScriptRan === false, `${label} must not run verify script`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must not be allowed`);
  assert(Array.isArray(payload.observations) && payload.observations.length === 8, `${label} observations mismatch`);
  assert(Array.isArray(payload.items) && payload.items.length === 8, `${label} items mismatch`);
  assert(Array.isArray(payload.plan?.items) && payload.plan.items.length === 8, `${label} plan items mismatch`);
  assert(payload.summary?.plannedCount === 8, `${label} planned count mismatch`);
  assert(payload.summary?.readyCount + payload.summary?.blockedCount === 8, `${label} summary count mismatch`);
  assert(Array.isArray(payload.summary?.selectedShotIds), `${label} selectedShotIds missing`);
  assert(payload.summary.selectedShotIds.includes("S01"), `${label} selected shots should include S01`);
  assert(typeof payload.summary.nextAction === "string" && payload.summary.nextAction.length > 0, `${label} next action missing`);
  assert(payload.ledgerProjection?.schemaVersion === "vibe_core_current_project_image2_batch_ledger_projection_v1", `${label} ledger projection schema mismatch`);
  assert(payload.ledgerProjection.summary?.total === 8, `${label} ledger total mismatch`);
  assert(payload.ledgerProjection.summary?.queued === payload.summary.readyCount, `${label} ledger queued count mismatch`);
  assert(payload.ledgerProjection.summary?.blocked === payload.summary.blockedCount, `${label} ledger blocked count mismatch`);
  assert(payload.ledgerProjection.summary?.parked === payload.summary.blockedCount, `${label} ledger parked count mismatch`);
  assert(payload.ledgerProjection.summary?.completeVerified === 0, `${label} ledger completeVerified should be 0`);
  assert(payload.ledgerProjection.summary?.providerSubmissionForbidden === true, `${label} ledger provider submission must be forbidden`);
  assert(payload.ledgerProjection.summary?.liveSubmitAllowed === false, `${label} ledger live submit must not be allowed`);
  assert(payload.ledgerProjection.summary?.noFileMutation === true, `${label} ledger must not mutate files`);
  assert(payload.ledgerProjection.summary?.workerSpawnForbidden === true, `${label} ledger must forbid worker spawn`);
  assert(payload.ledgerProjection.summary?.providerCalled === false, `${label} ledger must not call provider`);
  assert(Array.isArray(payload.ledgerProjection.projections) && payload.ledgerProjection.projections.length === 8, `${label} ledger projections mismatch`);
  assert(payload.ledgerProjection.projections.every((item) => item.completeVerified === false), `${label} ledger items must not be complete verified`);
  assert(payload.ledgerProjection.projections.every((item) => item.previewStatus === "missing"), `${label} ledger previews should be missing`);
  assert(payload.ledgerProjection.projections.every((item) => item.currentStatus === "queued" || item.currentStatus === "parked"), `${label} ledger item status mismatch`);

  const first = payload.items.find((item) => item.shotId === "S01");
  assert(first?.taskRunId === "task_run_s01_image2_start_real_demo_005", `${label} S01 taskRunId mismatch`);
  assert(first?.packetId === "task_packet_s01_image2_start_real_demo_005", `${label} S01 packetId mismatch`);
  assert(first?.envelopeId === "subagent_envelope_s01_image2_start_real_demo_005", `${label} S01 envelopeId mismatch`);
  assert(first?.expectedOutputPath === "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/outputs/shots/S01/start.png", `${label} S01 expected output mismatch`);
  assert(first?.providerObservationPath === "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/provider_observations/S01_start_provider_observation.json", `${label} S01 provider observation path mismatch`);
  assert(first?.semanticQaPath === "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/semantic_qa/S01_start_semantic_qa.json", `${label} S01 semantic QA path mismatch`);
  assert(first?.promptPath === "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/prompt_requests/S01_start_frame_prompt.md", `${label} S01 prompt path mismatch`);
  assert(Array.isArray(first?.referencePaths), `${label} S01 referencePaths missing`);
  assert(first.referencePaths.includes("real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/project/project.vibe"), `${label} S01 referencePaths should include project.vibe`);
  assert(first.queueOrder === 1, `${label} S01 queue order mismatch`);

  const firstLedgerProjection = payload.ledgerProjection.projections.find((item) => item.taskRunId === first.taskRunId);
  assert(firstLedgerProjection?.envelopeId === first.envelopeId, `${label} S01 ledger envelope mismatch`);
  assert(firstLedgerProjection?.currentStatus === "queued", `${label} S01 ledger status should be queued`);
  assert(firstLedgerProjection?.expectedOutputPath === first.expectedOutputPath, `${label} S01 ledger expected output path mismatch`);
  assert(Array.isArray(firstLedgerProjection?.expectedOutputs), `${label} S01 ledger expectedOutputs missing`);
  assert(firstLedgerProjection.expectedOutputs.some((item) => item.expectedOutputPath === first.expectedOutputPath), `${label} S01 ledger expectedOutputs should include expectedOutputPath`);
}

function assert004ProjectContext(payload, label, source) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.projectRootMode === "request_project_root", `${label} should use request project root`);
  assert((payload.sourceLabel || "").includes(source), `${label} source label should include ${source}`);
  assert(payload.requestContext?.projectRoot === project004Root, `${label} request project root mismatch`);
  assert(payload.requestContext?.projectRootSource === source, `${label} request project root source mismatch`);
  assert(payload.requestContext?.projectId === project004Id, `${label} request project id mismatch`);
  assert(payload.requestContext?.projectIdSource === source, `${label} request project id source mismatch`);
  assert(payload.project?.projectId === project004Id, `${label} project id mismatch`);
  assert(payload.projectId === project004Id, `${label} top-level project id mismatch`);
  assert(payload.identity?.projectId === project004Id, `${label} identity project id mismatch`);
  assert(payload.project?.projectRoot === project004Root, `${label} project root mismatch`);
  assert(payload.projectRoot === project004Root, `${label} top-level project root mismatch`);
  assert(payload.identity?.projectRoot === project004Root, `${label} identity project root mismatch`);
  assert(payload.reportPath === project004ReportPath, `${label} report path mismatch`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run prepare`);
}

const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, VIBE_CORE_RUNTIME_API_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const { baseUrl } = await waitForServer(child);
  const runtimeStatus = await fetchJson(`${baseUrl}/api/runtime/status`);
  assert(runtimeStatus.response.status === 200, "GET runtime status should return 200");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2BatchPlanEndpoint === "/api/runtime/projects/current/image2-batch/plan", "runtime status should expose image2 batch plan endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2BatchRunCheckEndpoint === "/api/runtime/projects/current/image2-batch/run-check", "runtime status should expose image2 batch run-check endpoint");

  const projectStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(projectStatus.response.status === 200, "GET project real-chain status should return 200");
  assertProjectRealChainPayload(projectStatus.payload, "GET project real-chain status");
  assert(projectStatus.payload.source === "runtime_endpoint", "GET project status should come from runtime endpoint");
  assert(projectStatus.payload.providerCalled === false, "GET project status must not call provider");
  assert(projectStatus.payload.prepareRan === false, "GET project status must not run prepare");

  const queryProjectStatus = await fetchJson(
    `${baseUrl}/api/runtime/projects/current/real-chain/status?projectRoot=${encodeURIComponent(project004Root)}&projectId=${encodeURIComponent(project004Id)}`,
  );
  assert(queryProjectStatus.response.status === 200, "GET project status with query context should return 200");
  assert004ProjectContext(queryProjectStatus.payload, "GET project status with query context", "query");
  assert(queryProjectStatus.payload.projectionKind === "project_real_chain_status", "GET project status query projection kind mismatch");
  assert(queryProjectStatus.payload.previewStatus === "blocked", "GET project status query should read 004 report");

  const projectRun = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/run-check`, { method: "POST" });
  assert(projectRun.response.status === 200, "POST project real-chain run-check should return 200");
  assertProjectRealChainPayload(projectRun.payload, "POST project real-chain run-check");
  assert(projectRun.payload.providerCalled === false, "POST project run-check must not call provider");
  assert(projectRun.payload.prepareRan === false, "POST project run-check must not run prepare");
  assert(projectRun.payload.command?.providerCalled === false, "POST project command must not call provider");
  assert(projectRun.payload.command?.prepareRan === false, "POST project command must not run prepare");
  assert(projectRun.payload.command?.verifyScriptRan === false, "POST project command must not run the 005 verify script");
  assert(projectRun.payload.command?.mode === "read_only_projection_check", "POST project command should be a read-only projection check");
  assert(projectRun.payload.command?.exitCode === 0, "POST project command should pass");

  const bodyProjectRun = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: project004Root, projectId: project004Id }),
  });
  assert(bodyProjectRun.response.status === 200, "POST project run-check with body context should return 200");
  assert004ProjectContext(bodyProjectRun.payload, "POST project run-check with body context", "payload");
  assert(bodyProjectRun.payload.command?.mode === "read_only_projection_check", "POST project body command mode mismatch");
  assert(bodyProjectRun.payload.command?.exitCode === 0, "POST project body command should pass");
  assert(bodyProjectRun.payload.command?.verifyScriptRan === false, "POST project body command must not run verify script");

  const image2BatchPlan = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`);
  assert(image2BatchPlan.response.status === 200, "GET image2 batch plan should return 200");
  assertImage2BatchPlanPayload(image2BatchPlan.payload, "GET image2 batch plan");

  const headerImage2BatchPlan = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`, {
    headers: {
      "x-vibe-project-root": project004Root,
      "x-vibe-project-id": project004Id,
    },
  });
  assert(headerImage2BatchPlan.response.status === 200, "GET image2 batch plan with header context should return 200");
  assert004ProjectContext(headerImage2BatchPlan.payload, "GET image2 batch plan with header context", "header");
  assert(headerImage2BatchPlan.payload.projectionKind === "current_project_image2_batch_prepare_plan", "GET image2 batch header projection kind mismatch");
  assert(headerImage2BatchPlan.payload.summary?.plannedCount === 8, "GET image2 batch header should read 004 report");

  const image2BatchRunCheck = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, { method: "POST" });
  assert(image2BatchRunCheck.response.status === 200, "POST image2 batch run-check should return 200");
  assertImage2BatchPlanPayload(image2BatchRunCheck.payload, "POST image2 batch run-check");
  assert(image2BatchRunCheck.payload.command?.mode === "read_only_image2_batch_plan_check", "POST image2 batch command mode mismatch");
  assert(image2BatchRunCheck.payload.command?.exitCode === 0, "POST image2 batch command should pass");
  assert(image2BatchRunCheck.payload.command?.providerCalled === false, "POST image2 batch command must not call provider");
  assert(image2BatchRunCheck.payload.command?.prepareRan === false, "POST image2 batch command must not run prepare");
  assert(image2BatchRunCheck.payload.command?.verifyScriptRan === false, "POST image2 batch command must not run verify script");
  assert(image2BatchRunCheck.payload.command?.liveSubmitAllowed === false, "POST image2 batch command must not allow live submit");
  assert(image2BatchRunCheck.payload.command?.providerSubmissionForbidden === true, "POST image2 batch command must forbid provider submission");
  assert(image2BatchRunCheck.payload.command?.noFileMutation === true, "POST image2 batch command must not mutate files");
  assert(image2BatchRunCheck.payload.command?.workerSpawnForbidden === true, "POST image2 batch command must forbid worker spawn");

  const blockedProjectRoot = await fetchJson(
    `${baseUrl}/api/runtime/projects/current/real-chain/status?projectRoot=${encodeURIComponent("../outside")}&projectId=${encodeURIComponent("blocked_project")}`,
  );
  assert(blockedProjectRoot.response.status === 403, "GET project status with escaping projectRoot should return 403");
  assert(blockedProjectRoot.payload.ok === false, "blocked project root should not be ok");
  assert(blockedProjectRoot.payload.status === "blocked", "blocked project root status mismatch");
  assert(blockedProjectRoot.payload.projectRootMode === "blocked_project_root", "blocked project root mode mismatch");
  assert(blockedProjectRoot.payload.project?.projectRoot === "../outside", "blocked project root should echo requested root");
  assert(/escapes project root/.test(blockedProjectRoot.payload.message || ""), "blocked project root message mismatch");

  const status = await fetchJson(`${baseUrl}/api/runtime/real-demo-e2e/005/status`);
  assert(status.response.status === 200, "GET status should return 200");
  assert005Payload(status.payload, "GET status");
  assert(status.payload.source === "runtime_endpoint", "GET status should come from runtime endpoint");
  assert(status.payload.providerCalled === false, "GET status must not call provider");
  assert(status.payload.prepareRan === false, "GET status must not run prepare");

  const run = await fetchJson(`${baseUrl}/api/runtime/real-demo-e2e/005/run`, { method: "POST" });
  assert(run.response.status === 200, "POST run should return 200");
  assert005Payload(run.payload, "POST run");
  assert(run.payload.source === "runtime_endpoint", "POST run should come from runtime endpoint");
  assert(run.payload.providerCalled === false, "POST run must not call provider");
  assert(run.payload.prepareRan === false, "POST run must not run prepare");
  assert(run.payload.command?.providerCalled === false, "POST run must not call provider");
  assert(run.payload.command?.prepareRan === false, "POST run must not run prepare");
  assert(run.payload.command?.exitCode === 0, "POST run verify command should pass");

  console.log("Local runtime API 005 bridge test passed. No provider was called.");
} finally {
  child.kill("SIGTERM");
}
