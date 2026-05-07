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

function assertProjectRealChainPayload(payload, label) {
  assert005Payload(payload, label);
  assert(payload.projectionKind === "project_real_chain_status", `${label} projection kind mismatch`);
  assert(payload.projectRootMode === "sandbox_fixture_projection", `${label} project root mode mismatch`);
  assert(payload.project?.projectId === "real_demo_e2e_005_anime_image2_start_frames", `${label} project id mismatch`);
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

const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, VIBE_CORE_RUNTIME_API_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const { baseUrl } = await waitForServer(child);
  const projectStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(projectStatus.response.status === 200, "GET project real-chain status should return 200");
  assertProjectRealChainPayload(projectStatus.payload, "GET project real-chain status");
  assert(projectStatus.payload.source === "runtime_endpoint", "GET project status should come from runtime endpoint");
  assert(projectStatus.payload.providerCalled === false, "GET project status must not call provider");
  assert(projectStatus.payload.prepareRan === false, "GET project status must not run prepare");

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
