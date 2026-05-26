import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

function writeText(filePath, text) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
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

function repoPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function assertNoProvider(payload, label) {
  assert(payload.providerCalled === false, `${label} must not set providerCalled`);
  assert(payload.runtimeProviderSubmitAttempted === false || payload.runtimeProviderSubmitAttempted === undefined, `${label} must not attempt provider submit`);
  assert(payload.runtimeExternalNetworkCallMade === false || payload.runtimeExternalNetworkCallMade === undefined, `${label} must not make external network calls`);
  assert(payload.providerCallAllowed === false || payload.providerCallAllowed === undefined, `${label} must not allow provider calls`);
  assert(payload.actualExecutionAllowed === false || payload.actualExecutionAllowed === undefined, `${label} must not allow actual execution`);
  assert(payload.liveSubmitAllowed === false, `${label} must keep live submit blocked`);
  assert(payload.projectVibeWritten === false, `${label} must not mutate project.vibe`);
  assert(payload.workerSpawnForbidden === true, `${label} must keep worker spawn forbidden`);
  if (payload.submitPolicy) {
    assert(payload.submitPolicy.providerCallAllowed === false, `${label} submitPolicy.providerCallAllowed must stay false`);
    assert(payload.submitPolicy.providerSubmitAllowed === 0, `${label} submitPolicy.providerSubmitAllowed must stay zero`);
    assert(payload.submitPolicy.liveSubmitAllowed === false, `${label} submitPolicy.liveSubmitAllowed must stay false`);
    assert(payload.submitPolicy.projectVibeMutationAllowed === false || payload.submitPolicy.projectVibeMutationAllowed === undefined, `${label} submitPolicy must not allow project.vibe mutation`);
  }
  if (payload.submitPermissionReceipt) {
    assert(payload.submitPermissionReceipt.submitIntent.providerSubmitAllowed === 0, `${label} receipt submit intent must remain zero`);
    assert(payload.submitPermissionReceipt.hardLocks.externalNetworkIoAllowed === false, `${label} receipt network lock must stay false`);
    assert(payload.submitPermissionReceipt.hardLocks.projectVibeMutationAllowed === false, `${label} receipt project.vibe lock must stay false`);
  }
}

async function stopServer(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
  });
}

const generatedAt = new Date().toISOString();
const runId = `run-${generatedAt.replace(/[:.]/g, "-")}`;
const fixtureRoot = `real-test-sandbox/current-project-provider-submit-permission/runs/${runId}`;
const projectId = "current_project_provider_submit_permission";
const shots = ["PSP01", "PSP02", "PSP03", "PSP04"].map((id, index) => ({
  id,
  title: `Provider submit permission ${id}`,
  sceneId: index % 2 === 0 ? "scene_kitchen" : "scene_rooftop",
  roleIds: ["char_lina"],
  prompt: `16:9 calm anime start frame for ${id}. Lina's green raincoat, locked ${index % 2 === 0 ? "kitchen" : "rooftop"} layout, no text.`,
}));

rmSync(fixtureRoot, { recursive: true, force: true });
writeJson(`${fixtureRoot}/project/project.vibe`, {
  schemaVersion: "current_project_provider_submit_permission_project_vibe_v1",
  projectId,
  runId,
  title: "Provider Submit Permission Fixture",
  constraints: {
    startFrameOnly: true,
    imageCount: shots.length,
    providerSubmitPermissionReceiptOnly: true,
    mockEvidenceCanPromoteRealResult: false,
  },
});
writeJson(`${fixtureRoot}/project/story_flow.json`, {
  schemaVersion: "current_project_provider_submit_permission_story_flow_v1",
  sections: [{ id: "act_permission", label: "Permission", shotIds: shots.map((shot) => shot.id) }],
  shots: shots.map((shot, index) => ({
    id: shot.id,
    title: shot.title,
    sectionId: "act_permission",
    sceneId: shot.sceneId,
    roleIds: shot.roleIds,
    order: index + 1,
    generationScope: { startFrameOnly: true },
  })),
});
writeJson(`${fixtureRoot}/project/visual_memory.json`, {
  schemaVersion: "current_project_provider_submit_permission_visual_memory_v1",
  roles: [
    { id: "char_lina", displayName: "Lina", status: "locked", path: `${fixtureRoot}/assets/locked/char_lina.md`, usedByShotIds: shots.map((shot) => shot.id), textConstraints: ["short hair", "green raincoat"] },
  ],
  scenes: [
    { id: "scene_kitchen", displayName: "Kitchen", status: "locked", path: `${fixtureRoot}/assets/locked/scene_kitchen.md`, usedByShotIds: shots.filter((shot) => shot.sceneId === "scene_kitchen").map((shot) => shot.id), spatialAnchors: ["small table", "window light"] },
    { id: "scene_rooftop", displayName: "Rooftop", status: "locked", path: `${fixtureRoot}/assets/locked/scene_rooftop.md`, usedByShotIds: shots.filter((shot) => shot.sceneId === "scene_rooftop").map((shot) => shot.id), spatialAnchors: ["rail", "evening sky"] },
  ],
  style: { id: "style_calm_anime", displayName: "Calm Anime", status: "locked", path: `${fixtureRoot}/assets/locked/style_calm_anime.md`, positive: "clean 2D anime", negative: "no text" },
});
writeJson(`${fixtureRoot}/project/source_index.json`, {
  schemaVersion: "current_project_provider_submit_permission_source_index_v1",
  refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`, `${fixtureRoot}/run_manifest.json`],
});
writeText(`${fixtureRoot}/assets/locked/char_lina.md`, "Locked Lina text reference.\n");
writeText(`${fixtureRoot}/assets/locked/scene_kitchen.md`, "Locked kitchen scene reference.\n");
writeText(`${fixtureRoot}/assets/locked/scene_rooftop.md`, "Locked rooftop scene reference.\n");
writeText(`${fixtureRoot}/assets/locked/style_calm_anime.md`, "Locked calm anime style reference.\n");
for (const shot of shots) {
  writeText(`${fixtureRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`, `# ${shot.id}\n\n${shot.prompt}\n`);
}
writeJson(`${fixtureRoot}/run_manifest.json`, {
  schemaVersion: "current_project_provider_submit_permission_manifest_v1",
  projectId,
  runId,
  providerPolicy: {
    allowedProvider: "openai-image2-api",
    providerCalled: false,
    actualImage2Triggered: false,
  },
  shotPlans: shots.map((shot, index) => ({
    shotId: shot.id,
    order: index + 1,
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    frameRole: "start_frame",
    expectedOutputPath: `${fixtureRoot}/outputs/shots/${shot.id}/start.png`,
    promptPath: `${fixtureRoot}/prompt_requests/${shot.id}_start_frame_prompt.md`,
    status: "prepared_for_submit_permission_receipt",
  })),
});

const projectVibePath = repoPath(`${fixtureRoot}/project/project.vibe`);
const projectVibeHashBefore = sha256File(projectVibePath);
const projectVibeMtimeBefore = statSync(projectVibePath).mtimeMs;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-provider-submit-permission-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
let child = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
});

async function prepareAndConfirm(baseUrl, shotId) {
  const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: shotId, selectedShotIds: [shotId], imageCount: 1, transportMode: "agent_app_server" }),
  });
  assert(prepare.response.status === 200 && prepare.payload.status === "prepared", `${shotId} prepare should pass`);
  assertNoProvider(prepare.payload, `${shotId} prepare`);

  const confirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      expectedOutputPath: prepare.payload.expectedOutputPath,
      receipt: prepare.payload.receipt,
    }),
  });
  assert(confirm.response.status === 200 && confirm.payload.status === "handoff_prepared", `${shotId} confirm should pass`);
  assertNoProvider(confirm.payload, `${shotId} confirm`);
  return prepare.payload;
}

async function triggerPermission(baseUrl, shotId, preparePayload, extra = {}) {
  return fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare-trigger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      expectedOutputPath: preparePayload.expectedOutputPath,
      receiptId: preparePayload.receipt.receiptId,
      transportMode: "agent_app_server",
      submitPermissionReceiptRequired: true,
      maxProviderCallsPerReceipt: 1,
      credentialRef: "secret-store://providers/openai-image2/default",
      actionTimeConfirmation: { required: true, userConfirmedAtActionTime: false },
      ...extra,
    }),
  });
}

try {
  let { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId, displayName: "Provider Submit Permission Fixture" }),
  });
  assert(select.response.status === 200, "fixture should bind");

  const readyPrepare = await prepareAndConfirm(baseUrl, "PSP01");
  const readyTrigger = await triggerPermission(baseUrl, "PSP01", readyPrepare);
  assert(readyTrigger.response.status === 200 && readyTrigger.payload.status === "trigger_plan_prepared", "ready trigger should pass");
  assertNoProvider(readyTrigger.payload, "ready trigger");
  assert(readyTrigger.payload.submitPermissionReceipt?.status === "pending_action_time_confirmation", "submit permission receipt should be pending");
  assert(readyTrigger.payload.submitPermissionReceipt.credential.credentialRef === "secret-store://providers/openai-image2/default", "credentialRef should be saved as ref");
  assert(readyTrigger.payload.submitPermissionReceipt.credential.secretMaterialPresent === false, "secret material must not be present");
  assert(readyTrigger.payload.submitPermissionReceipt.credential.credentialMaterialRead === false, "credential material must not be read");
  assert(readyTrigger.payload.submitPermissionReceipt.submitIntent.maxProviderCallsPerReceipt === 1, "max calls should be pinned");
  assert(readyTrigger.payload.submitPermissionReceipt.submitIntent.providerSubmitAllowed === 0, "submit allowed must stay zero");
  assert(readyTrigger.payload.persistedState.submitPermissionReceiptPresent === true, "permission receipt should be persisted");
  assert(existsSync(repoPath(readyTrigger.payload.submitPermissionReceiptStatePath)), "permission receipt file should exist");
  const persistedReady = readJson(repoPath(readyTrigger.payload.submitPermissionReceiptStatePath));
  assert(persistedReady.credential.credentialRef === "secret-store://providers/openai-image2/default", "persisted receipt should keep only credentialRef");
  assert(!JSON.stringify(persistedReady).includes("sk-"), "persisted receipt must not contain raw key material");

  const readyStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=PSP01`);
  assert(readyStatus.response.status === 200 && readyStatus.payload.submitPermissionReceipt?.status === "pending_action_time_confirmation", "status should reload submit permission receipt");
  assert(readyStatus.payload.persistedState.submitPermissionReceiptPresent === true, "status should show permission receipt present");
  assertNoProvider(readyStatus.payload, "ready status");

  await stopServer(child);
  child = spawnRuntimeServer({
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  });
  ({ baseUrl } = await waitForServer(child));
  const reloadStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=PSP01`);
  assert(reloadStatus.response.status === 200 && reloadStatus.payload.submitPermissionReceipt?.status === "pending_action_time_confirmation", "reloaded server should read submit permission receipt");
  assert(reloadStatus.payload.persistedState.submitPermissionReceiptPresent === true, "reloaded status should show permission receipt present");
  assertNoProvider(reloadStatus.payload, "reload status");

  const missingPrepare = await prepareAndConfirm(baseUrl, "PSP02");
  const missingCredential = await triggerPermission(baseUrl, "PSP02", missingPrepare, { credentialRef: "" });
  assert(missingCredential.response.status === 409 && missingCredential.payload.status === "blocked", "missing credentialRef should fail closed");
  assert(missingCredential.payload.persistedState.submitPermissionReceiptPresent === false, "missing credentialRef must not persist receipt");
  assert(!existsSync(repoPath(missingCredential.payload.submitPermissionReceiptStatePath)), "missing credentialRef receipt file must not exist");
  assertNoProvider(missingCredential.payload, "missing credentialRef trigger");

  const rawPrepare = await prepareAndConfirm(baseUrl, "PSP03");
  const rawCredential = await triggerPermission(baseUrl, "PSP03", rawPrepare, { apiKey: "sk-test123456789" });
  assert(rawCredential.response.status === 409 && rawCredential.payload.status === "blocked", "raw credential should fail closed");
  assert(rawCredential.payload.blockers.some((blocker) => /credential|raw/i.test(blocker)), "raw credential blocker should be reported");
  assert(rawCredential.payload.persistedState.submitPermissionReceiptPresent === false, "raw credential must not persist receipt");
  assert(!existsSync(repoPath(rawCredential.payload.submitPermissionReceiptStatePath)), "raw credential receipt file must not exist");
  assertNoProvider(rawCredential.payload, "raw credential trigger");

  const maxPrepare = await prepareAndConfirm(baseUrl, "PSP04");
  const maxBlocked = await triggerPermission(baseUrl, "PSP04", maxPrepare, { maxProviderCallsPerReceipt: 2 });
  assert(maxBlocked.response.status === 409 && maxBlocked.payload.status === "blocked", "maxProviderCallsPerReceipt!=1 should fail closed");
  assert(maxBlocked.payload.blockers.some((blocker) => /maxProviderCallsPerReceipt/i.test(blocker)), "max blocker should be reported");
  assert(maxBlocked.payload.persistedState.submitPermissionReceiptPresent === false, "max mismatch must not persist receipt");
  assert(!existsSync(repoPath(maxBlocked.payload.submitPermissionReceiptStatePath)), "max mismatch receipt file must not exist");
  assertNoProvider(maxBlocked.payload, "max mismatch trigger");

  assert(sha256File(projectVibePath) === projectVibeHashBefore, "project.vibe hash must not change");
  assert(statSync(projectVibePath).mtimeMs === projectVibeMtimeBefore, "project.vibe mtime must not change");
  console.log(`Current project provider submit permission receipt test passed: ${fixtureRoot}`);
} finally {
  await stopServer(child);
  rmSync(tempRoot, { recursive: true, force: true });
}
