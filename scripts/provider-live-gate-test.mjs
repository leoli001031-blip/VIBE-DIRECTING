import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadProviderLiveGate() {
  const sourcePath = path.resolve("src/core/providerLiveGate.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-provider-live-gate-"));
  const outPath = path.join(tmpDir, "providerLiveGate.mjs");
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function fixtureShot() {
  return {
    id: "S01",
    actId: "A1",
    title: "Ready pair shot",
    storyFunction: "establish the pair",
    startFrame: "outputs/keyframes/S01_start.png",
    endFrame: "outputs/keyframes/S01_end.png",
    status: "keyframe_pair_ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "N/A",
      style: "PASS",
    },
    issues: [],
  };
}

function fixtureImageTaskPlan() {
  return {
    taskPlanId: "image_task_plan_S01_end",
    jobId: "job_image_S01_end",
    shotId: "S01",
    promptPlanId: "prompt_plan_S01_end",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    providerId: "openai-image2-api",
    mode: "image2image",
    status: "ready_for_dry_run",
    expectedOutputPath: "outputs/keyframes/S01_end.png",
    inputReferenceIds: ["ref_character_main"],
    sourcePromptPlanHash: "prompt_hash",
    sourceShotSpecHash: "shot_hash",
    taskEnvelopeSummary: {
      envelopeId: "task_envelope_S01_end",
      providerSlot: "image.edit",
      providerId: "openai-image2-api",
      requiredMode: "image2image",
      sourceIndexHash: "source_hash",
      promptPlanId: "prompt_plan_S01_end",
      promptPlanHash: "prompt_hash",
      sourceShotSpecHash: "shot_hash",
      expectedOutputs: ["outputs/keyframes/S01_end.png"],
      preflightStatus: "pass",
      blockingReasons: [],
    },
    blockers: [],
    warnings: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function fixtureImage2Request(taskPlan) {
  return {
    requestId: "image2_request_image_task_plan_S01_end",
    taskPlanId: taskPlan.taskPlanId,
    adapterId: "image2-dry-run",
    operation: "image2image",
    payload: {
      sourceIntent: ["derive the end frame from the approved start frame"],
      mustPreserve: ["character identity", "scene layout"],
      mustAvoid: ["unapproved props"],
      references: [{ referenceId: "ref_character_main", source: "prompt_plan" }],
      outputPath: taskPlan.expectedOutputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["image2image_to_text2image", "provider_or_mode_fallback"],
  };
}

function fixtureAssetReadiness() {
  return {
    reportId: "asset_readiness_S01",
    shotId: "S01",
    assetIds: ["ref_character_main"],
    status: "ready",
    formalBlocked: false,
    blockers: [],
    warnings: [],
    safeReferenceIds: ["ref_character_main"],
    unsafeReferenceIds: [],
    lockedReferenceIds: ["ref_character_main"],
    candidateReferenceIds: [],
    missingReferenceIds: [],
    rejectedReferenceIds: [],
    tempReferenceIds: [],
    failedReferenceIds: [],
    checkedAt: "2026-04-30T00:00:00.000Z",
  };
}

function fixtureConfirmationToken(taskPlan) {
  return {
    tokenId: "confirm_image_task_plan_S01_end_placeholder",
    taskPlanId: taskPlan.taskPlanId,
    providerId: taskPlan.providerId,
    slot: taskPlan.providerSlot,
    placeholderPresent: true,
    confirmedByUser: true,
    notes: ["Placeholder confirmation only; not a provider credential."],
  };
}

const { buildProviderLiveGateState } = await loadProviderLiveGate();
const runtimeState = readJson("public/runtime-state.json");
const providerRegistry = runtimeState.imagePipeline.providerRegistry;
const adapterContracts = runtimeState.adapterContracts;
const imageTaskPlan = fixtureImageTaskPlan();
const baseInput = {
  generatedAt: "2026-04-30T00:00:00.000Z",
  providerRegistry,
  adapterContracts,
  imageTaskPlans: [imageTaskPlan],
  image2AdapterRequests: [fixtureImage2Request(imageTaskPlan)],
  assetReadinessReports: [fixtureAssetReadiness()],
  shots: [fixtureShot()],
  videoPlanning: runtimeState.videoPlanning,
  videoExecutionPreview: runtimeState.videoExecutionPreview,
  audioPlanning: runtimeState.audioPlanning,
};

const readyState = buildProviderLiveGateState({
  ...baseInput,
  confirmationTokens: [fixtureConfirmationToken(imageTaskPlan)],
});

assert(readyState.schemaVersion === "0.1.0", "provider live gate schemaVersion drifted");
assert(readyState.phase === "phase_11_provider_adapter_live_gate", "provider live gate phase drifted");
assert(readyState.hardLocks.readinessPlanOnly === true, "live gate must be readiness-plan only");
assert(readyState.hardLocks.confirmationPlanOnly === true, "live gate must be confirmation-plan only");
assert(readyState.hardLocks.providerSubmissionForbidden === true, "provider submission must be forbidden");
assert(readyState.hardLocks.liveSubmitAllowed === false, "live submit must remain false");
assert(readyState.hardLocks.credentialStorage === false, "credential storage must remain false");
assert(readyState.hardLocks.noCredentialRead === true, "credential reads must be forbidden");
assert(readyState.hardLocks.noCredentialWrite === true, "credential writes must be forbidden");
assert(readyState.hardLocks.noApiKeyCreation === true, "API key creation must be forbidden");
assert(readyState.summary.providerSubmitAllowed === 0, "no item can allow provider submit");
assert(readyState.summary.liveSubmitAllowed === false, "summary live submit must be false");

const imageSlots = readyState.slots.filter((slot) => slot.slot.startsWith("image."));
assert(imageSlots.length >= 3, "Image2 slots should be represented");
assert(
  imageSlots.some((slot) => slot.state === "user_enabled_pending_confirmation"),
  "Image2 slots must be able to represent user_enabled_pending_confirmation",
);
assert(imageSlots.every((slot) => slot.liveSubmitAllowed === false), "Image2 slots must default liveSubmitAllowed=false");

const readyImageItem = readyState.items.find((item) => item.sourceId === imageTaskPlan.taskPlanId);
assert(readyImageItem, "Image2 readiness item missing");
assert(readyImageItem.status === "ready_for_confirmation", "Image2 item should be ready for confirmation when every gate passes");
for (const checkId of [
  "envelope_valid",
  "asset_readiness_ready",
  "pair_qa_pass",
  "provider_capability_present",
  "image2_adapter_request_valid",
  "user_confirmation_token_placeholder",
]) {
  const check = readyImageItem.checks.find((item) => item.checkId === checkId);
  assert(check?.passed === true, `Image2 readiness check ${checkId} must pass`);
}
assert(readyImageItem.canSubmitProvider === false, "ready confirmation still cannot submit provider");
assert(readyImageItem.liveSubmitAllowed === false, "ready confirmation still cannot allow live submit");

const blockedByConfirmation = buildProviderLiveGateState(baseInput);
const blockedImageItem = blockedByConfirmation.items.find((item) => item.sourceId === imageTaskPlan.taskPlanId);
assert(blockedImageItem.status === "blocked", "missing user confirmation must block the live path");
assert(
  blockedImageItem.checks.find((item) => item.checkId === "user_confirmation_token_placeholder")?.passed === false,
  "missing user confirmation token placeholder must be explicit",
);
assert(blockedImageItem.livePathBlocked === true, "missing confirmation must keep livePathBlocked=true");

const videoItems = readyState.items.filter((item) => item.slot === "video.i2v");
assert(videoItems.length === runtimeState.videoPlanning.taskPlans.length, "video live gate should mirror video task plans");
for (const videoItem of videoItems) {
  assert(videoItem.status === "parked", `${videoItem.gateId} must remain parked`);
  assert(videoItem.canRequestUserConfirmation === false, `${videoItem.gateId} cannot request confirmation while parked`);
  assert(videoItem.canSubmitProvider === false, `${videoItem.gateId} cannot submit provider`);
  for (const checkId of ["video_provider_parked", "no_fast_model", "no_vip_channel", "no_text_to_video_main_path", "no_bgm_in_video_prompt"]) {
    const check = videoItem.checks.find((item) => item.checkId === checkId);
    assert(check?.passed === true, `${videoItem.gateId} ${checkId} must pass`);
  }
}
const parkedVideoSlots = readyState.slots.filter((slot) => slot.slot === "video.i2v");
assert(parkedVideoSlots.length >= 2, "Seedance and Jimeng video slots should be represented");
for (const slot of parkedVideoSlots) {
  assert(slot.state === "parked", `${slot.adapterId} must remain parked`);
  assert(slot.liveSubmitAllowed === false, `${slot.adapterId} liveSubmitAllowed must be false`);
  assert(slot.providerSubmissionForbidden === true, `${slot.adapterId} provider submit must be forbidden`);
}

for (const item of readyState.items) {
  assert(item.providerSubmissionForbidden === true, `${item.gateId} provider submission must be forbidden`);
  assert(item.liveSubmitAllowed === false, `${item.gateId} liveSubmitAllowed must be false`);
  assert(item.credentialStorage === false, `${item.gateId} credential storage must be false`);
}
for (const action of ["provider_submit", "credential_read", "credential_write", "fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt"]) {
  assert(readyState.forbiddenActions.includes(action), `forbidden action ${action} missing`);
}

const source = fs.readFileSync("src/core/providerLiveGate.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "providerTaskId"]) {
  assert(!source.includes(forbiddenCode), `providerLiveGate source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/provider_live_gate.schema.json");
assert(schema.title === "ProviderLiveGateState", "provider live gate schema title drifted");
assert(schema.$defs.hardLocks.properties.providerSubmissionForbidden.const === true, "schema must pin providerSubmissionForbidden");
assert(schema.$defs.hardLocks.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed=false");
assert(schema.$defs.hardLocks.properties.credentialStorage.const === false, "schema must pin credentialStorage=false");
assert(schema.$defs.hardLocks.properties.noApiKeyCreation.const === true, "schema must forbid API key creation");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("provider_live_gate.schema.json"), "schema registry must include provider_live_gate.schema.json");
assert(registrySource.includes("ProviderLiveGateState"), "schema registry must include ProviderLiveGateState type");

console.log(
  `Provider live gate tests passed: ${readyState.summary.imageSlotsPendingConfirmation} Image2 slot(s), ${readyState.summary.parkedVideoSlots} parked video slot(s), ${readyState.items.length} gate item(s).`,
);
