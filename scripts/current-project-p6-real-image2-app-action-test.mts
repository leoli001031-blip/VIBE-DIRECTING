import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProjectVibe, serializeProjectVibe } from "../src/project/index.ts";

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
  const project = createProjectVibe({
    projectId: "current_project_p6_real_image2",
    title: "P6 Real Image2 App Action",
    storyFlow: {
      id: "story_flow_p6_real_image2",
      sections: [{
        id: "act_p6",
        title: "P6",
        summary: "P6 one-shot review.",
        sequenceIndex: 0,
        shotIds: [shotId],
      }],
      shotOrder: [shotId],
    },
    shots: [{
      id: shotId,
      sectionId: "act_p6",
      title: "P6 one-shot",
      intent: "Review one returned Image2 start frame.",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: [],
    }],
  });
  writeText(`${fixtureRoot}/project/project.vibe`, serializeProjectVibe(project));
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
      providerId: "apikey-fun-gpt55-responses-image",
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
  assert(prepare.response.status === 200 && prepare.payload.status === "prepared", `one-shot prepare should pass: ${JSON.stringify(prepare.payload.blockers)}`);
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
      credentialRef: "secret-store://providers/apikey-fun-gpt55-responses-image/default",
      maxProviderCallsPerReceipt: 1,
      actionTimeConfirmation: { required: true, userConfirmedAtActionTime: false },
    }),
  });
  assert(permission.response.status === 200 && permission.payload.status === "trigger_plan_prepared", "permission receipt should be prepared");
  assert(permission.payload.submitPermissionReceipt?.status === "pending_action_time_confirmation", "submit permission receipt should be pending");
  assert(permission.payload.submitPermissionReceipt.permissionReceiptId, "submit permission receipt should have a single-use id");
  assert(permission.payload.projectFactHash === permission.payload.receipt.projectFactHash, "permission payload should retain projectFactHash");
  assert(permission.payload.actionId === permission.payload.receipt.actionId, "permission payload should retain actionId");
  assert(permission.payload.promptSha256 === permission.payload.receipt.promptSha256, "permission payload should retain promptSha256");
  assert(permission.payload.submitPermissionReceipt.projectFactHash === permission.payload.projectFactHash, "permission receipt should bind projectFactHash");
  assert(permission.payload.submitPermissionReceipt.actionId === permission.payload.actionId, "permission receipt should bind actionId");
  assert(permission.payload.submitPermissionReceipt.promptSha256 === permission.payload.promptSha256, "permission receipt should bind promptSha256");
  return permission.payload;
}

function submitPayload(permissionPayload, extra = {}) {
  return {
    selectedShotId: permissionPayload.selectedShotId,
    selectedShotIds: [permissionPayload.selectedShotId],
    imageCount: 1,
    receipt: permissionPayload.receipt,
    submitPermissionReceipt: permissionPayload.submitPermissionReceipt,
    providerId: "apikey-fun-gpt55-responses-image",
    mockProviderResult: true,
    ...extra,
  };
}

function confirmationFor(permissionPayload, receiptId, actionId = permissionPayload.receipt.actionId) {
  return {
    receiptId,
    actionId,
    confirmedAt: new Date().toISOString(),
    phrase: "submit-p6-image2",
    confirmed: true,
  };
}

const loopbackImage = Buffer.concat([
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
  Buffer.alloc(1024),
]).toString("base64");
let loopbackProviderCalls = 0;
const loopbackProvider = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/responses") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  loopbackProviderCalls += 1;
  request.resume();
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end([
    "event: response.image_generation_call.completed",
    `data: ${JSON.stringify({ response: { id: "resp_p6_loopback" }, model: "gpt-5.5", result: loopbackImage })}`,
    "",
    "event: response.completed",
    `data: ${JSON.stringify({ response: { id: "resp_p6_loopback" }, model: "gpt-5.5" })}`,
    "",
  ].join("\n"));
});
await new Promise((resolve) => loopbackProvider.listen(0, "127.0.0.1", resolve));
const loopbackAddress = loopbackProvider.address();
assert(loopbackAddress && typeof loopbackAddress === "object", "loopback provider should expose a port");
const loopbackEndpoint = `http://127.0.0.1:${loopbackAddress.port}/v1/responses`;

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-p6-real-image2-"));
const fixtureRoot = path.join(tempRoot, "projects", `current-project-p6-real-image2-app-action-${Date.now()}`);
const bindingPath = path.join(tempRoot, "current-project.local.json");
const shotId = createFixture(fixtureRoot);
let child;

try {
  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_APIKEY_FUN_API_KEY: "",
    VIBE_APIKEY_FUN_RESPONSES_ENDPOINT: loopbackEndpoint,
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    VIBE_CORE_ALLOWED_PROJECT_ROOTS: fixtureRoot,
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
      confirmation: confirmationFor(permissionPayload, "confirm_no_key"),
    })),
  });
  assert(noKey.response.status === 409, "missing key must block submit");
  assert(noKey.payload.providerCalled === false, "missing key must not call provider");
  assert(JSON.stringify(noKey.payload).includes("sk-") === false, "blocked payload must not include raw key material");
  await stopServer(child);

  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_APIKEY_FUN_API_KEY: "fake-p6-test-key",
    VIBE_APIKEY_FUN_RESPONSES_ENDPOINT: loopbackEndpoint,
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    VIBE_CORE_ALLOWED_PROJECT_ROOTS: fixtureRoot,
  });
  ({ baseUrl } = await waitForServer(child));

  const actionMismatch = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: confirmationFor(permissionPayload, "confirm_action_mismatch", "image2_one_shot_wrong_action"),
    })),
  });
  assert(actionMismatch.response.status === 409, "mismatched actionId must block submit");
  assert(actionMismatch.payload.providerCalled === false, "mismatched actionId must not call provider");

  const promptPath = repoPath(`${fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`);
  const originalPrompt = readFileSync(promptPath, "utf8");
  writeFileSync(promptPath, `${originalPrompt.trim()} Changed after permission.\n`, "utf8");
  const stalePromptStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${shotId}`);
  assert(stalePromptStatus.payload.persistedState?.submitPermissionReceiptPresent === false, "stale prompt permission must not restore as current");
  const stalePrompt = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: confirmationFor(permissionPayload, "confirm_stale_prompt"),
    })),
  });
  assert(stalePrompt.response.status === 409, "prompt mutation after permission must block submit");
  assert(stalePrompt.payload.providerCalled === false, "stale prompt permission must not call provider");
  writeFileSync(promptPath, originalPrompt, "utf8");

  const projectVibePath = repoPath(`${fixtureRoot}/project/project.vibe`);
  const originalProjectVibe = readFileSync(projectVibePath, "utf8");
  const changedProjectVibe = JSON.parse(originalProjectVibe);
  changedProjectVibe.manifest.title = "Changed after permission";
  writeFileSync(projectVibePath, `${JSON.stringify(changedProjectVibe, null, 2)}\n`, "utf8");
  const staleFact = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: confirmationFor(permissionPayload, "confirm_stale_fact"),
    })),
  });
  assert(staleFact.response.status === 409, "Project.vibe mutation after permission must block submit");
  assert(staleFact.payload.providerCalled === false, "stale project fact permission must not call provider");
  writeFileSync(projectVibePath, originalProjectVibe, "utf8");

  const referencePath = repoPath(`${fixtureRoot}/assets/locked/char_lina.png`);
  const originalReference = readFileSync(referencePath);
  writeFileSync(referencePath, Buffer.concat([originalReference, Buffer.from([0])]));
  const staleReference = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: confirmationFor(permissionPayload, "confirm_stale_reference"),
    })),
  });
  assert(staleReference.response.status === 409, "reference mutation after permission must block submit");
  assert(staleReference.payload.providerCalled === false, "stale reference permission must not call provider");
  writeFileSync(referencePath, originalReference);
  assert(!existsSync(repoPath(permissionPayload.expectedOutputPath)), "blocked identity checks must not write an output image");

  const noReceipt = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      receipt: permissionPayload.receipt,
      providerId: "apikey-fun-gpt55-responses-image",
      mockProviderResult: true,
      confirmation: confirmationFor(permissionPayload, "confirm_missing_receipt"),
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
      confirmation: confirmationFor(permissionPayload, "confirm_mock_missing"),
    })),
  });
  assert(missingReturn.response.status === 409, "mock missing provider return should stay blocked");
  assert(missingReturn.payload.status === "missing", `mock missing provider return should project missing: ${JSON.stringify(missingReturn.payload)}`);
  assert(missingReturn.payload.retryAvailable === true, "mock missing provider return should be retryable from UI");
  assert(/重试/.test(missingReturn.payload.message), "missing provider message should tell the user retry is possible");
  assert(missingReturn.payload.providerFailureKind === "provider_missing", "missing provider return should preserve failure kind");
  assert(missingReturn.payload.p6Ingest?.shotStatuses?.[0]?.status === "missing", "missing provider return should remain missing");
  assert(missingReturn.payload.p6Ingest?.summary?.missing === 1, "missing provider return should ingest as missing");
  assert(missingReturn.payload.p6Ingest?.summary?.promotionAllowed === false, "missing provider return must not promote");
  assert(missingReturn.payload.providerCalled === false, "mock missing return must not claim a real provider call");
  assert(missingReturn.payload.previewProjection?.providerCalled === false, "mock missing preview must preserve providerCalled=false");
  assert(JSON.stringify(missingReturn.payload).includes("fake-p6-test-key") === false, "missing payload must not include raw key material");
  const missingStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${shotId}`);
  const consumedMockClaim = JSON.parse(readFileSync(missingStatus.payload.submitPermissionReceiptClaimStatePath, "utf8"));
  assert(consumedMockClaim.status === "mock_submit_consumed", "mock submit claim should be marked consumed without implying a real call");
  assert(consumedMockClaim.providerCalled === false, "mock submit claim must not claim a real provider call");
  assert(consumedMockClaim.runtimeProviderSubmitAttempted === false, "mock submit claim must not claim a runtime provider attempt");
  assert(consumedMockClaim.runtimeExternalNetworkCallMade === false, "mock submit claim must not claim external network IO");

  const replayedPermission = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(permissionPayload, {
      confirmation: confirmationFor(permissionPayload, "confirm_replayed_permission"),
    })),
  });
  assert(replayedPermission.response.status === 409, "one permission receipt must allow at most one submit");
  assert(replayedPermission.payload.providerCalled === false, "replayed permission must not call provider");

  const retryPermissionPayload = await preparePermission(baseUrl, fixtureRoot, shotId);
  assert(
    retryPermissionPayload.submitPermissionReceipt.permissionReceiptId !== permissionPayload.submitPermissionReceipt.permissionReceiptId,
    "an explicit retry should receive a new permission id",
  );

  const submitted = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submitPayload(retryPermissionPayload, {
      mockProviderResult: false,
      confirmation: confirmationFor(retryPermissionPayload, "confirm_loopback_transport"),
    })),
  });
  assert(submitted.response.status === 200, `loopback transport submit should pass: ${JSON.stringify(submitted.payload)}`);
  assert(loopbackProviderCalls === 1, "loopback transport should receive exactly one provider request");
  assert(submitted.payload.status === "needs_review", "confirmed submit should project needs_review");
  assert(submitted.payload.previewProjection?.imageUrl, "confirmed submit should expose a verified runtime file URL for preview");
  assert(submitted.payload.p6Ingest?.summary?.previewEligible === 1, "P6 ingest should allow exactly one preview item");
  assert(submitted.payload.requestedSize === "1280x720", "P6 app action should request Jimeng-matched 1280x720 Image2 start-frame output");
  assert(submitted.payload.requestedAspectRatio === "16:9", "P6 app action should preserve requested 16:9 aspect ratio");
  assert(submitted.payload.providerOperation === "image.edit", "locked image references should switch start frame submit to image.edit");
  assert(submitted.payload.referenceVisualInputCount >= 2, "P6 submit should attach locked character and scene reference images");
  assert(submitted.payload.p6Ingest?.promotionGate?.promotionAllowed === false, "P6 ingest must not promote without QA and authorization");
  assert(submitted.payload.p6Ingest?.exportReport?.receipts?.promotionAuthorizationReceipt?.authorized === false, "missing promotion receipt must stay unauthorized");
  assert(submitted.payload.providerCalled === true, "loopback transport should record a provider call");
  assert(submitted.payload.runtimeProviderSubmitAttempted === true, "loopback transport should record the runtime submit attempt");
  assert(submitted.payload.runtimeExternalNetworkCallMade === true, "loopback transport should record network IO");
  assert(!path.isAbsolute(submitted.payload.outputPath), "loopback output path should stay project-relative");
  assert(existsSync(submitted.payload.outputFilePath), "loopback output file should be written into controlled output");
  assert(statSync(submitted.payload.outputFilePath).size > 0, "loopback output file should not be empty");
  assert(/^sha256:[a-f0-9]{64}$/.test(submitted.payload.outputSha256), "loopback output should be hash-bound");
  assert(JSON.stringify(submitted.payload).includes("fake-p6-test-key") === false, "submit payload must not include raw key material");

  const status = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${shotId}`);
  assert(status.response.status === 200 && status.payload.uiStatus === "needs_review", "one-shot status should reload needs_review projection");
  assert(status.payload.persistedState?.submitPermissionReceiptClaimed === true, "status should remember the consumed permission claim");
  assert(status.payload.persistedState?.submitPermissionReceiptPresent === false, "consumed permission must not restore as current");
  const consumedClaim = JSON.parse(readFileSync(status.payload.submitPermissionReceiptClaimStatePath, "utf8"));
  assert(consumedClaim.status === "provider_submit_succeeded", "loopback claim should persist successful provider completion");
  assert(consumedClaim.providerCalled === true, "loopback claim should preserve provider call truth");
  assert(consumedClaim.runtimeProviderSubmitAttempted === true, "loopback claim should preserve runtime submit truth");
  assert(consumedClaim.runtimeExternalNetworkCallMade === true, "loopback claim should preserve network truth");
  assert(consumedClaim.outputSha256 === submitted.payload.outputSha256, "loopback claim should bind the returned output hash");

  const review = await fetchJson(`${baseUrl}/api/runtime/projects/current/review/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "approve",
      reviewedAt: new Date().toISOString(),
      reviewerId: "local_user",
      item: {
        id: `p6_one_shot_${shotId}`,
        shotId,
        label: shotId,
        mediaPath: submitted.payload.outputPath,
        sourceReceiptId: status.payload.receipt.receiptId,
        outputHash: submitted.payload.outputSha256,
        status: "needs_review",
      },
      candidate: {
        shotId,
        label: shotId,
        outputPath: submitted.payload.outputPath,
        sourceReceiptId: status.payload.receipt.receiptId,
        outputHash: submitted.payload.outputSha256,
        evidenceRefs: [`preview#p6_one_shot_${shotId}`],
      },
      decision: {
        assetKind: "reference",
        assetLabel: shotId,
        usedByShotIds: [shotId],
      },
    }),
  });
  assert(review.response.status === 200 && review.payload.status === "approved", "hash-bound one-shot review should be approved");
  assert(review.payload.projectVibeWritten === true, "approved one-shot review should persist Project.vibe");
  const approvedStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${shotId}`);
  assert(approvedStatus.payload.uiStatus === "verified", "approved one-shot output should immediately project verified");
  assert(approvedStatus.payload.reviewRecoveredFromProjectVibe === true, "approved one-shot output should use the persisted review receipt");
  assert(approvedStatus.payload.sourceReceiptId === status.payload.receipt.receiptId, "approved one-shot output should retain the provider receipt identity");
  assert(approvedStatus.payload.previewProjection?.reviewRequired === false, "approved one-shot output should leave the review queue");

  await stopServer(child);
  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_APIKEY_FUN_API_KEY: "fake-p6-test-key",
    VIBE_APIKEY_FUN_RESPONSES_ENDPOINT: loopbackEndpoint,
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    VIBE_CORE_ALLOWED_PROJECT_ROOTS: fixtureRoot,
  });
  ({ baseUrl } = await waitForServer(child));
  const coldStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=${shotId}`);
  assert(coldStatus.response.status === 200 && coldStatus.payload.uiStatus === "verified", "cold restart should restore approved output as verified");
  assert(coldStatus.payload.reviewRecoveredFromProjectVibe === true, "cold restart should recover the Project.vibe review receipt");
  assert(coldStatus.payload.sourceReceiptId === status.payload.receipt.receiptId, "cold restart should retain the reviewed provider receipt identity");
  assert(coldStatus.payload.previewProjection?.reviewRequired === false, "cold restart must not restore an approved output into the review queue");
  assert(coldStatus.payload.persistedState?.submitPermissionReceiptClaimed === true, "cold restart should retain the consumed permission claim");
  assert(coldStatus.payload.submitPermissionReceipt === undefined, "cold restart must not expose a consumed permission as current");
  const coldRealChain = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(coldRealChain.payload.workbenchFacts?.visualMemory?.folderScan?.discoveredAssetCount === 0, "cold restart must not duplicate locked assets through /private/var path aliases");
  assert(coldRealChain.payload.workbenchFacts?.visualMemory?.summary?.needsReview === 0, "locked project assets must not reappear as review candidates");
  console.log(`current-project-p6-real-image2-app-action-test: ok ${fixtureRoot}`);
} finally {
  await stopServer(child);
  await new Promise((resolve, reject) => loopbackProvider.close((error) => error ? reject(error) : resolve()));
  rmSync(tempRoot, { recursive: true, force: true });
}
