import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  const shotIds = ["P6S01", "P6S02", "P6S03"];
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_p6_real_image2_serial_project_vibe_v1",
    projectId: "current_project_p6_real_image2_serial",
    runId: "p6-real-image2-serial-batch",
    title: "P6 Real Image2 Serial Batch",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_p6_real_image2_serial_story_flow_v1",
    sections: [{ id: "act_p6", label: "P6", shotIds }],
    shots: shotIds.map((shotId, index) => ({
      id: shotId,
      title: `P6 serial shot ${index + 1}`,
      sectionId: "act_p6",
      sceneId: "scene_room",
      roleIds: ["char_lina"],
      order: index + 1,
      generationScope: { startFrameOnly: true },
    })),
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_p6_real_image2_serial_visual_memory_v1",
    roles: [{ id: "char_lina", displayName: "Lina", status: "locked", path: `${fixtureRoot}/assets/locked/char_lina.md`, usedByShotIds: shotIds }],
    scenes: [{ id: "scene_room", displayName: "Room", status: "locked", path: `${fixtureRoot}/assets/locked/scene_room.md`, usedByShotIds: shotIds }],
    style: { id: "style_anime", displayName: "Anime", status: "locked", path: `${fixtureRoot}/assets/locked/style_anime.md`, positive: "clean anime", negative: "no text" },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_p6_real_image2_serial_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`, `${fixtureRoot}/run_manifest.json`],
  });
  writeText(`${fixtureRoot}/assets/locked/char_lina.md`, "Locked Lina character.\n");
  writeText(`${fixtureRoot}/assets/locked/scene_room.md`, "Locked room scene.\n");
  writeText(`${fixtureRoot}/assets/locked/style_anime.md`, "Locked anime style.\n");
  for (const shotId of shotIds) {
    writeText(`${fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`, `Anime keyframe for ${shotId}, Lina in a locked room scene, clean anime style.\n`);
  }
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_p6_real_image2_serial_manifest_v1",
    projectId: "current_project_p6_real_image2_serial",
    runId: "p6-real-image2-serial-batch",
    shotPlans: shotIds.map((shotId, index) => ({
      shotId,
      order: index + 1,
      providerId: "lanyi-image2",
      providerSlot: "image.generate",
      requiredMode: "text2image",
      frameRole: "start_frame",
      expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
      promptPath: `${fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`,
      status: "prepared_for_submit_permission_receipt",
    })),
  });
  return shotIds;
}

async function preparePermission(baseUrl, shotId) {
  const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: shotId, selectedShotIds: [shotId], imageCount: 1, transportMode: "agent_app_server" }),
  });
  assert(prepare.response.status === 200 && prepare.payload.status === "prepared", `${shotId} one-shot prepare should pass`);
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
  assert(confirm.response.status === 200 && confirm.payload.status === "handoff_prepared", `${shotId} one-shot confirm should pass`);
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
  assert(permission.response.status === 200 && permission.payload.status === "trigger_plan_prepared", `${shotId} permission receipt should be prepared`);
  return permission.payload;
}

function serialShot(permissionPayload, status, index) {
  return {
    selectedShotId: permissionPayload.selectedShotId,
    receipt: permissionPayload.receipt,
    submitPermissionReceipt: permissionPayload.submitPermissionReceipt,
    providerId: "lanyi-image2",
    mockProviderResult: { status },
    confirmation: {
      receiptId: `confirm_serial_${index}`,
      confirmedAt: new Date(Date.now() + index).toISOString(),
      phrase: "submit-p6-image2",
      confirmed: true,
    },
  };
}

const fixtureRoot = `real-test-sandbox/current-project-p6-real-image2-serial-batch/${Date.now()}`;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-p6-real-image2-serial-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const shotIds = createFixture(fixtureRoot);
let child;

try {
  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_IMAGE2_API_KEY: "fake-p6-serial-test-key",
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  });
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId: "current_project_p6_real_image2_serial", displayName: "P6 Real Image2 Serial Batch" }),
  });
  assert(select.response.status === 200, "fixture should bind");

  const permissions = [];
  for (const shotId of shotIds) {
    permissions.push(await preparePermission(baseUrl, shotId));
  }

  const submitted = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit-serial`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotIds: shotIds,
      providerId: "lanyi-image2",
      shots: [
        serialShot(permissions[0], "success", 1),
        serialShot(permissions[1], "needs_review", 2),
        serialShot(permissions[2], "missing", 3),
      ],
    }),
  });

  assert(submitted.response.status === 200, `serial partial submit should return payload: ${submitted.payload.message}`);
  assert(submitted.payload.providerRequestStrategy === "serial_one_shot", "serial batch must use one-shot strategy");
  assert(submitted.payload.maxConcurrency === 1, "serial batch maxConcurrency must stay 1");
  assert(submitted.payload.maxAutoRetries === 0, "serial batch maxAutoRetries must stay 0");
  assert(submitted.payload.summary?.success === 1, "serial batch should count one success/verified shot");
  assert(submitted.payload.summary?.needsReview === 1, "serial batch should count one needs_review shot");
  assert(submitted.payload.summary?.missing === 1, "serial batch should count one missing shot");
  assert(submitted.payload.summary?.promotionAllowed === false, "serial batch must not promote by default");
  assert(submitted.payload.runtimeProviderSubmitAttempted === false, "mock serial test must not attempt live provider submit");
  assert(submitted.payload.runtimeExternalNetworkCallMade === false, "mock serial test must not make external network calls");
  assert(JSON.stringify(submitted.payload).includes("fake-p6-serial-test-key") === false, "serial payload must not include raw key material");

  const byShot = new Map(submitted.payload.shotResults.map((item) => [item.shotId, item]));
  assert(byShot.get("P6S01")?.status === "verified", "P6S01 should become verified from mock success");
  assert(byShot.get("P6S02")?.status === "needs_review", "P6S02 should stay needs_review");
  assert(byShot.get("P6S03")?.status === "missing", "P6S03 should become missing placeholder");
  assert(existsSync(repoPath(byShot.get("P6S01")?.outputPath)), "verified mock output should be written");
  assert(existsSync(repoPath(byShot.get("P6S02")?.outputPath)), "needs_review mock output should be written");
  assert(statSync(repoPath(byShot.get("P6S01")?.outputPath)).size > 0, "verified mock output should not be empty");
  assert(byShot.get("P6S03")?.p6Ingest?.summary?.missing === 1, "missing shot should carry missing return ingest");

  console.log(`current-project-p6-real-image2-serial-batch-test: ok ${fixtureRoot}`);
} finally {
  await stopServer(child);
  rmSync(tempRoot, { recursive: true, force: true });
}
