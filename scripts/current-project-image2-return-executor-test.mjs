import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`)), 15000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
          return;
        } catch {
          // Wait for a complete line.
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

function spawnRuntimeServer(env) {
  return spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assertNoSubmit(payload, label) {
  assert(payload.liveSubmitAllowed === false, `${label} live submit must stay blocked`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.workerSpawnForbidden === true, `${label} worker spawn must stay blocked`);
  assert(payload.submitPolicy?.providerCallAllowed === false, `${label} must not allow provider calls`);
  assert(payload.submitPolicy?.providerSubmitAllowed === 0, `${label} must allow zero automatic submits`);
  assert(payload.submitPolicy?.liveSubmitAllowed === false, `${label} submit policy live submit must stay blocked`);
}

function buildAnimeFixture(fixtureRoot) {
  rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(`${fixtureRoot}/project`, { recursive: true });
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_return_executor_project_vibe_v1",
    projectId: "current_project_image2_return_executor",
    runId: "current_project_image2_return_executor_run",
    title: "Anime Image2 Return Executor",
    constraints: {
      startFrameOnly: true,
      endFrameRealGenerationAllowed: false,
      seedanceAllowed: false,
      jimengAllowed: false,
      videoAllowed: false,
      fastAllowed: false,
      vipAllowed: false,
    },
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_return_executor_story_flow_v1",
    sections: [{ id: "scene_rooftop", label: "Rooftop", shotIds: ["A01"] }],
    shots: [{
      id: "A01",
      title: "Rooftop signal",
      sectionId: "scene_rooftop",
      sceneId: "scene_rooftop",
      roleIds: ["char_ao"],
      action: "Ao watches a small blue signal rise above a quiet anime rooftop.",
      generationScope: {
        startFrameOnly: true,
        endFrame: { contractOnly: true, realGenerationAllowed: false },
      },
    }],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_image2_return_executor_visual_memory_v1",
    roles: [{
      id: "char_ao",
      displayName: "Ao",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/char_ao.png`,
      usedByShotIds: ["A01"],
      textConstraints: ["quiet 2D anime protagonist", "short navy hair"],
    }],
    scenes: [{
      id: "scene_rooftop",
      displayName: "Twilight rooftop",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/scene_rooftop.png`,
      usedByShotIds: ["A01"],
      spatialAnchors: ["railing at back", "city lights below"],
    }],
    style: {
      id: "style_quiet_anime",
      displayName: "Quiet anime",
      status: "locked",
      path: `${fixtureRoot}/assets/locked/style_quiet_anime.png`,
      positive: "clean 2D anime frame, restrained color, stable 16:9 composition",
      negative: "no photorealism, no 3D render, no live action",
    },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_image2_return_executor_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`],
  });
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_image2_return_executor_manifest_v1",
    projectId: "current_project_image2_return_executor",
    runId: "current_project_image2_return_executor_run",
    shotPlans: [{
      shotId: "A01",
      order: 1,
      providerId: "openai-image2-api",
      providerSlot: "image.generate",
      requiredMode: "text2image",
      frameRole: "start_frame",
      startFrameOnly: true,
      expectedOutputPath: `${fixtureRoot}/outputs/shots/A01/start.png`,
      providerObservationPath: `${fixtureRoot}/provider_observations/A01_start_provider_observation.json`,
      semanticQaPath: `${fixtureRoot}/semantic_qa/A01_start_semantic_qa.json`,
      promptPath: `${fixtureRoot}/prompt_requests/A01_start_frame_prompt.md`,
      endFrameContract: {
        status: "contract_only_not_generated",
        requiredMode: "image2image",
        realGenerationAllowed: false,
      },
      status: "queued_for_return_executor_test",
    }],
  });
}

const generatedAt = new Date().toISOString();
const runId = `run-${generatedAt.replace(/[:.]/g, "-")}`;
const fixtureRoot = `real-test-sandbox/current-project-image2-return-executor/runs/${runId}`;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-image2-return-executor-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
buildAnimeFixture(fixtureRoot);
const projectVibePath = `${fixtureRoot}/project/project.vibe`;
const projectVibeBefore = statSync(projectVibePath).mtimeMs;
const child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

try {
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId: "current_project_image2_return_executor", displayName: "Anime Image2 Return Executor" }),
  });
  assert(select.response.status === 200, "fixture should bind as current project");

  const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "A01", selectedShotIds: ["A01"], imageCount: 1, transportMode: "codex_app_server" }),
  });
  assert(prepare.response.status === 200 && prepare.payload.status === "prepared", "prepare should create receipt");
  const confirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: "A01",
      selectedShotIds: ["A01"],
      imageCount: 1,
      expectedOutputPath: prepare.payload.expectedOutputPath,
      receipt: prepare.payload.receipt,
    }),
  });
  assert(confirm.response.status === 200 && confirm.payload.status === "handoff_prepared", "confirm should create app-server handoff");

  const noReturn = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-return`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "A01", selectedShotIds: ["A01"], imageCount: 1, receiptId: prepare.payload.receipt.receiptId }),
  });
  assert(noReturn.response.status === 409, "return endpoint must fail closed without actual hash-bound evidence");
  assert(noReturn.payload.providerCalled === false, "dry return check must not pretend provider was called");
  assert(noReturn.payload.actualImage2Triggered === false, "dry return check must not pretend Image2 triggered");
  assertNoSubmit(noReturn.payload, "dry return check");

  const outputBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
  mkdirSync(path.dirname(prepare.payload.expectedOutputPath), { recursive: true });
  writeFileSync(prepare.payload.expectedOutputPath, outputBytes);
  const outputSha256 = sha256Bytes(outputBytes);
  writeJson(prepare.payload.providerObservationPath, {
    schemaVersion: "current_project_image2_return_executor_provider_observation_v1",
    providerObservationMode: "actual_provider_call_observed",
    provider: "openai-image2-api",
    outputPath: prepare.payload.expectedOutputPath,
    outputSha256,
  });
  writeJson(prepare.payload.semanticQaPath, {
    schemaVersion: "current_project_image2_return_executor_semantic_qa_v1",
    semanticReviewMode: "actual_image_semantic_review",
    outputPath: prepare.payload.expectedOutputPath,
    reviewedOutputSha256: outputSha256,
    status: "needs_review",
    finalAssessment: { status: "needs_review" },
  });
  const incompleteActual = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-return`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "A01", selectedShotIds: ["A01"], imageCount: 1, receiptId: prepare.payload.receipt.receiptId }),
  });
  assert(incompleteActual.response.status === 409, "actual-labelled sidecars without explicit provider/trigger evidence must fail closed");
  assert(incompleteActual.payload.providerCalled === false, "incomplete actual sidecars must not promote providerCalled");
  assert(incompleteActual.payload.actualImage2Triggered === false, "incomplete actual sidecars must not promote actualImage2Triggered");
  assertNoSubmit(incompleteActual.payload, "incomplete actual sidecar return check");

  const returnedOutputPath = `${fixtureRoot}/external_provider_returns/A01/start.png`;
  mkdirSync(path.dirname(returnedOutputPath), { recursive: true });
  writeFileSync(returnedOutputPath, outputBytes);
  const providerObservation = {
    schemaVersion: "current_project_image2_return_executor_provider_observation_v1",
    providerObservationMode: "actual_provider_call_observed",
    provider: "openai-image2-api",
    outputPath: prepare.payload.expectedOutputPath,
    outputSha256,
    providerCalled: true,
    actualImage2Triggered: true,
  };
  const semanticQa = {
    schemaVersion: "current_project_image2_return_executor_semantic_qa_v1",
    semanticReviewMode: "actual_image_semantic_review",
    outputPath: prepare.payload.expectedOutputPath,
    reviewedOutputSha256: outputSha256,
    status: "needs_review",
    finalAssessment: { status: "needs_review" },
  };
  const returned = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/execute-return`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: "A01",
      selectedShotIds: ["A01"],
      imageCount: 1,
      receiptId: prepare.payload.receipt.receiptId,
      actualProviderReturned: true,
      returnedOutputPath,
      providerObservation,
      semanticQa,
    }),
  });
  assert(returned.response.status === 200, "actual return ingest should pass");
  assert(returned.payload.status === "real_provider_returned_needs_review", "actual return should project needs_review");
  assert(returned.payload.providerCalled === true, "actual return should preserve providerCalled fact");
  assert(returned.payload.actualImage2Triggered === true, "actual return should preserve actualImage2Triggered fact");
  assert(returned.payload.executorEvidence.hashBoundActual === true, "actual return should be hash-bound");
  assert(returned.payload.watcherProjection.semanticQaStatus === "needs_review", "actual return should surface needs_review QA");
  assert(existsSync(returned.payload.expectedOutputPath), "actual return should write expected output");
  assert(existsSync(returned.payload.providerObservationPath), "actual return should write provider sidecar");
  assert(existsSync(returned.payload.semanticQaPath), "actual return should write semantic QA sidecar");
  assertNoSubmit(returned.payload, "actual return ingest");

  const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(status.response.status === 200, "real-chain status should reload after return");
  assert(status.payload.providerCalled === false, "real-chain status read must not itself call provider");
  assert(status.payload.actualImage2Triggered === true, "real-chain status should project actual trigger fact");
  assert(status.payload.productionStatus === "needs_review", "real-chain status should project needs_review");
  assert(status.payload.needsReviewShotIds.includes("A01"), "real-chain status should include returned shot in review list");
  assert(statSync(projectVibePath).mtimeMs === projectVibeBefore, "return executor must not mutate project.vibe");

  console.log(`Current project Image2 return executor test passed: ${fixtureRoot}`);
} finally {
  child.kill("SIGTERM");
  rmSync(tempRoot, { recursive: true, force: true });
}
