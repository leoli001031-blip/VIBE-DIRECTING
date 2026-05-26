import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

function writePng(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"));
}

function repoPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
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
          // Wait for a complete JSON line.
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

async function stopServer(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
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

function createFixture(fixtureRoot) {
  const shotId = "P6S01";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_p6_real_image2_project_vibe_v1",
    projectId: "current_project_p6_real_image2",
    runId: "p6-real-image2-app-action",
    title: "P6 Real Image2 App Action",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_p6_real_image2_story_flow_v1",
    sections: [{ id: "act_p6", label: "P6", shotIds: [shotId] }],
    shots: [{
      id: shotId,
      title: "P6 one-shot",
      sectionId: "act_p6",
      sceneId: "scene_room",
      roleIds: ["char_lina"],
      order: 1,
      generationScope: { startFrameOnly: true },
    }],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_p6_real_image2_visual_memory_v1",
    roles: [{ id: "char_lina", displayName: "Lina", status: "locked", path: `${fixtureRoot}/assets/locked/char_lina.png`, usedByShotIds: [shotId] }],
    scenes: [{ id: "scene_room", displayName: "Room", status: "locked", path: `${fixtureRoot}/assets/locked/scene_room.png`, usedByShotIds: [shotId] }],
    style: { id: "style_anime", displayName: "Anime", status: "locked", path: `${fixtureRoot}/assets/locked/style_anime.md`, positive: "clean anime", negative: "no text" },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_p6_real_image2_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`, `${fixtureRoot}/run_manifest.json`],
  });
  writePng(`${fixtureRoot}/assets/locked/char_lina.png`);
  writePng(`${fixtureRoot}/assets/locked/scene_room.png`);
  writeText(`${fixtureRoot}/assets/locked/style_anime.md`, "Locked anime style.\n");
  writeText(`${fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`, "Anime keyframe, Lina in a locked room scene, clean anime style.\n");
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_p6_real_image2_manifest_v1",
    projectId: "current_project_p6_real_image2",
    runId: "p6-real-image2-app-action",
    shotPlans: [{
      shotId,
      order: 1,
      providerId: "lanyi-image2",
      providerSlot: "image.generate",
      requiredMode: "text2image",
      frameRole: "start_frame",
      expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
      promptPath: `${fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`,
      status: "prepared_for_submit_permission_receipt",
    }],
  });
  return shotId;
}

async function preparePermission(baseUrl, fixtureRoot, shotId) {
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId: "current_project_p6_real_image2", displayName: "P6 Real Image2 App Action" }),
  });
  assert(select.response.status === 200, "fixture should bind");

  const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: shotId, selectedShotIds: [shotId], imageCount: 1, transportMode: "agent_app_server" }),
  });
  assert(prepare.response.status === 200 && prepare.payload.status === "prepared", "one-shot prepare should pass");
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
  assert(confirm.response.status === 200 && confirm.payload.status === "handoff_prepared", "one-shot confirm should pass");
  const permission = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare-trigger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      expectedOutputPath: confirm.payload.expectedOutputPath,
      receiptId: confirm.payload.receipt.receiptId,
      transportMode: "agent_app_server",
      submitPermissionReceiptRequired: true,
      credentialRef: "secret-store://providers/lanyi-image2/default",
      maxProviderCallsPerReceipt: 1,
      actionTimeConfirmation: { required: true, userConfirmedAtActionTime: false },
    }),
  });
  assert(permission.response.status === 200 && permission.payload.status === "trigger_plan_prepared", "permission receipt should be prepared");
  assert(permission.payload.submitPermissionReceipt?.status === "pending_action_time_confirmation", "submit permission receipt should be pending");
  return permission.payload;
}

function submitPayload(permissionPayload, extra = {}) {
  return {
    selectedShotId: permissionPayload.selectedShotId,
    selectedShotIds: [permissionPayload.selectedShotId],
    imageCount: 1,
    receipt: permissionPayload.receipt,
    submitPermissionReceipt: permissionPayload.submitPermissionReceipt,
    providerId: "lanyi-image2",
    mockProviderResult: true,
    ...extra,
  };
}

const fixtureRoot = `real-test-sandbox/current-project-p6-real-image2-app-action/${Date.now()}`;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-p6-real-image2-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const shotId = createFixture(fixtureRoot);
let child;

try {
  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_IMAGE2_API_KEY: "",
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  });
  let { baseUrl } = await waitForServer(child);
  const permissionPayload = await preparePermission(baseUrl, fixtureRoot, shotId);

  const noConfirmation = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload)),
  });
  assert(noConfirmation.response.status === 409, "missing confirmation must block submit");
  assert(noConfirmation.payload.providerCalled === false, "missing confirmation must not call provider");

  const noKey = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: { receiptId: "confirm_no_key", confirmedAt: new Date().toISOString(), phrase: "submit-p6-image2", confirmed: true },
    })),
  });
  assert(noKey.response.status === 409, "missing key must block submit");
  assert(noKey.payload.providerCalled === false, "missing key must not call provider");
  assert(JSON.stringify(noKey.payload).includes("sk-") === false, "blocked payload must not include raw key material");
  await stopServer(child);

  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_IMAGE2_API_KEY: "fake-p6-test-key",
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  });
  ({ baseUrl } = await waitForServer(child));

  const noReceipt = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      receipt: permissionPayload.receipt,
      providerId: "lanyi-image2",
      mockProviderResult: true,
      confirmation: { receiptId: "confirm_missing_receipt", confirmedAt: new Date().toISOString(), phrase: "submit-p6-image2", confirmed: true },
    }),
  });
  assert(noReceipt.response.status === 409, "missing submit permission receipt must block");
  assert(noReceipt.payload.providerCalled === false, "missing submit permission receipt must not call provider");
  assert(noReceipt.payload.p6Ingest === undefined, "missing receipt must not produce promotion ingest");

  const missingReturn = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      mockProviderResult: { status: "missing" },
      confirmation: { receiptId: "confirm_mock_missing", confirmedAt: new Date().toISOString(), phrase: "submit-p6-image2", confirmed: true },
    })),
  });
  assert(missingReturn.response.status === 409, "mock missing provider return should stay blocked");
  assert(missingReturn.payload.status === "missing", "mock missing provider return should project missing");
  assert(missingReturn.payload.retryAvailable === true, "mock missing provider return should be retryable from UI");
  assert(/重试/.test(missingReturn.payload.message), "missing provider message should tell the user retry is possible");
  assert(missingReturn.payload.providerFailureKind === "provider_missing", "missing provider return should preserve failure kind");
  assert(missingReturn.payload.p6Ingest?.shotStatuses?.[0]?.status === "missing", "missing provider return should remain missing");
  assert(missingReturn.payload.p6Ingest?.summary?.missing === 1, "missing provider return should ingest as missing");
  assert(missingReturn.payload.p6Ingest?.summary?.promotionAllowed === false, "missing provider return must not promote");
  assert(JSON.stringify(missingReturn.payload).includes("fake-p6-test-key") === false, "missing payload must not include raw key material");

  const submitted = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: { receiptId: "confirm_mock_ok", confirmedAt: new Date().toISOString(), phrase: "submit-p6-image2", confirmed: true },
    })),
  });
  assert(submitted.response.status === 200, `confirmed mock submit should pass: ${submitted.payload.message}`);
  assert(submitted.payload.status === "needs_review", "confirmed submit should project needs_review");
  assert(submitted.payload.previewProjection?.imageUrl, "confirmed submit should expose a verified runtime file URL for preview");
  assert(submitted.payload.p6Ingest?.summary?.previewEligible === 1, "P6 ingest should allow exactly one preview item");
  assert(submitted.payload.requestedSize === "1280x720", "P6 app action should request Jimeng-matched 1280x720 Image2 start-frame output");
  assert(submitted.payload.requestedAspectRatio === "16:9", "P6 app action should preserve requested 16:9 aspect ratio");
  assert(submitted.payload.providerOperation === "image.edit", "locked image references should switch start frame submit to image.edit");
  assert(submitted.payload.referenceVisualInputCount >= 2, "P6 submit should attach locked character and scene reference images");
  assert(submitted.payload.p6Ingest?.promotionGate?.promotionAllowed === false, "P6 ingest must not promote without QA and authorization");
  assert(submitted.payload.p6Ingest?.exportReport?.receipts?.promotionAuthorizationReceipt?.authorized === false, "missing promotion receipt must stay unauthorized");
  assert(submitted.payload.runtimeProviderSubmitAttempted === false, "mock submit test must not attempt a live provider");
  assert(submitted.payload.runtimeExternalNetworkCallMade === false, "mock submit test must not make external network calls");
  assert(existsSync(repoPath(submitted.payload.outputPath)), "mock output file should be written into controlled output");
  assert(statSync(repoPath(submitted.payload.outputPath)).size > 0, "mock output file should not be empty");
  assert(JSON.stringify(submitted.payload).includes("fake-p6-test-key") === false, "submit payload must not include raw key material");

  const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${shotId}`);
  assert(status.response.status === 200 && status.payload.uiStatus === "needs_review", "one-shot status should reload needs_review projection");
  console.log(`current-project-p6-real-image2-app-action-test: ok ${fixtureRoot}`);
} finally {
  await stopServer(child);
  rmSync(tempRoot, { recursive: true, force: true });
}
