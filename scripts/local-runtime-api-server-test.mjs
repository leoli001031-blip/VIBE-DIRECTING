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

const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, VIBE_CORE_RUNTIME_API_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const { baseUrl } = await waitForServer(child);
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
