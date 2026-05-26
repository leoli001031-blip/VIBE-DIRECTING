import fs from "node:fs";

import { buildProviderExecutionPermissionGateState } from "../src/core/providerExecutionPermissionGate.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readyLiveGate() {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-05-01T00:00:00.000Z",
    phase: "phase_11_provider_adapter_live_gate",
    slots: [],
    items: [
      {
        gateId: "provider_live_gate_image_task_plan_S01_end",
        sourceKind: "image_task_plan",
        sourceId: "image_task_plan_S01_end",
        providerId: "openai-image2-api",
        slot: "image.edit",
        requiredMode: "image2image",
        shotId: "S01",
        status: "ready_for_confirmation",
        checks: [],
        blockers: [],
        warnings: [],
        confirmationTokenId: "confirm_S01_end_placeholder",
        canRequestUserConfirmation: true,
        canSubmitProvider: false,
        livePathBlocked: true,
        dryRunOnly: true,
        readOnly: true,
        providerSubmissionForbidden: true,
        liveSubmitAllowed: false,
        credentialStorage: false,
        noCredentialRead: true,
        noCredentialWrite: true,
      },
      {
        gateId: "provider_live_gate_video_task_plan_S02",
        sourceKind: "video_task_plan",
        sourceId: "video_task_plan_S02",
        providerId: "seedance2-provider",
        slot: "video.i2v",
        requiredMode: "frames2video",
        shotId: "S02",
        status: "parked",
        checks: [],
        blockers: [],
        warnings: [],
        canRequestUserConfirmation: false,
        canSubmitProvider: false,
        livePathBlocked: true,
        dryRunOnly: true,
        readOnly: true,
        providerSubmissionForbidden: true,
        liveSubmitAllowed: false,
        credentialStorage: false,
        noCredentialRead: true,
        noCredentialWrite: true,
      },
    ],
    summary: {
      totalSlots: 0,
      imageSlotsPendingConfirmation: 1,
      parkedVideoSlots: 1,
      totalItems: 2,
      readyForConfirmation: 1,
      blocked: 0,
      parked: 1,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialStorage: false,
    },
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      readinessPlanOnly: true,
      confirmationPlanOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      credentialStorage: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noApiKeyCreation: true,
      noProviderSubmit: true,
      noArbitraryProviderCommand: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
    },
    phase30Evidence: {
      confirmationTokenPlaceholderPresent: true,
      userConfirmationConfirmed: true,
      providerPacketComplete: true,
      watcherManifestQaClosedLoopRequired: true,
      forbiddenProviderModesAbsent: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      credentialStorage: false,
      liveSubmitAllowed: false,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
    },
    forbiddenActions: [
      "provider_submit",
      "credential_read",
      "credential_write",
      "api_key_create",
      "fast_model",
      "vip_channel",
      "text_to_video_main_path",
      "bgm_in_video_prompt",
      "arbitrary_provider_command",
    ],
    notes: [],
  };
}

const gate = buildProviderExecutionPermissionGateState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  providerLiveGate: readyLiveGate(),
});

assert(gate.schemaVersion === "0.1.0", "schema version drifted");
assert(gate.phase === "phase_31_provider_execution_permission_gate", "phase drifted");
assert(gate.summary.totalRequests === 2, "requests should mirror live gate items");
assert(gate.summary.readyForUserReview === 1, "ready image request should be reviewable");
assert(gate.summary.parked === 1, "video request should remain parked");
assert(gate.summary.providerSubmitAllowed === 0, "provider submit must remain zero");
assert(gate.summary.liveSubmitAllowed === false, "live submit must remain false");
assert(gate.summary.credentialAccessAllowed === false, "credential access must remain false");
assert(gate.summary.automaticSubmitAllowed === false, "automatic submit must remain false");
assert(gate.phase31Evidence.typedEvidencePresent === true, "typed evidence must be present");
assert(gate.phase31Evidence.actionTimeUserConfirmationRequired === true, "action-time confirmation must be required");
assert(gate.phase31Evidence.automaticSubmitForbidden === true, "automatic submit must be forbidden");
assert(gate.phase31Evidence.canSubmitProvider === false, "phase31 must not submit providers");
assert(gate.phase31Evidence.noWorkerSpawn === true, "worker spawn must be blocked");
assert(gate.phase31Evidence.noFileMutation === true, "file mutation must be blocked");

const reviewable = gate.requests.find((request) => request.status === "ready_for_user_review");
assert(reviewable, "ready_for_user_review request missing");
assert(reviewable.canAskUserToConfirm === true, "reviewable request may ask user to confirm later");
assert(reviewable.userConfirmedAtActionTime === false, "action-time confirmation must not be prefilled");
assert(reviewable.canSubmitProvider === false, "reviewable request still cannot submit provider");
assert(reviewable.providerSubmitAllowed === 0, "reviewable request provider submit must stay zero");
assert(
  reviewable.confirmations.some((item) => item.confirmationId === "action_time_user_confirmation" && item.confirmed === false),
  "action-time confirmation must remain unconfirmed",
);

for (const request of gate.requests) {
  assert(request.liveSubmitAllowed === false, `${request.requestId} live submit must be false`);
  assert(request.credentialAccessAllowed === false, `${request.requestId} credential access must be false`);
  assert(request.noWorkerSpawn === true, `${request.requestId} worker spawn must be blocked`);
  assert(request.noFileMutation === true, `${request.requestId} file mutation must be blocked`);
}

for (const key of [
  "dryRunOnly",
  "readOnly",
  "reviewPlanOnly",
  "actionTimeConfirmationRequired",
  "providerSubmissionForbidden",
  "noCredentialRead",
  "noCredentialWrite",
  "noApiKeyCreation",
  "noArbitraryProviderCommand",
  "noWorkerSpawn",
  "noFileMutation",
  "fastModelForbidden",
  "vipChannelForbidden",
  "textToVideoMainPathForbidden",
  "bgmInVideoPromptForbidden",
]) {
  assert(gate.hardLocks[key] === true, `${key} hard lock must be true`);
}
assert(gate.hardLocks.canSubmitProvider === false, "canSubmitProvider hard lock must be false");
assert(gate.hardLocks.providerSubmitAllowed === 0, "providerSubmitAllowed hard lock must be zero");
assert(gate.hardLocks.liveSubmitAllowed === false, "live submit hard lock must be false");
assert(gate.hardLocks.credentialAccessAllowed === false, "credential access hard lock must be false");

const blockedMode = buildProviderExecutionPermissionGateState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  providerLiveGate: {
    ...readyLiveGate(),
    phase30Evidence: {
      ...readyLiveGate().phase30Evidence,
      forbiddenProviderModesAbsent: false,
    },
  },
});
assert(blockedMode.summary.readyForUserReview === 0, "forbidden mode drift must block user review");
assert(blockedMode.requests.some((request) => request.blockers.some((blocker) => /Fast|VIP|text-to-video|BGM/.test(blocker))), "forbidden mode blocker missing");

const phaseDrift = buildProviderExecutionPermissionGateState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  providerLiveGate: {
    ...readyLiveGate(),
    phase: "phase_30_drifted_live_gate",
  },
});
assert(phaseDrift.summary.readyForUserReview === 0, "providerLiveGate phase drift must block user review");
assert(
  phaseDrift.requests.some((request) => request.blockers.includes("provider_live_gate_phase_drift")),
  "providerLiveGate phase drift blocker missing",
);

const dangerousSummaryDrift = buildProviderExecutionPermissionGateState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  providerLiveGate: {
    ...readyLiveGate(),
    summary: {
      ...readyLiveGate().summary,
      providerSubmitAllowed: 1,
      liveSubmitAllowed: true,
      credentialStorage: true,
    },
  },
});
assert(dangerousSummaryDrift.summary.readyForUserReview === 0, "dangerous providerLiveGate summary drift must block review");
for (const blocker of [
  "provider_live_gate_summary_provider_submit_allowed_drift",
  "provider_live_gate_summary_live_submit_allowed_drift",
  "provider_live_gate_summary_credential_storage_drift",
]) {
  assert(dangerousSummaryDrift.requests.some((request) => request.blockers.includes(blocker)), `summary drift blocker ${blocker} missing`);
}

const dangerousPhase30Drift = buildProviderExecutionPermissionGateState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  providerLiveGate: {
    ...readyLiveGate(),
    phase30Evidence: {
      ...readyLiveGate().phase30Evidence,
      canSubmitProvider: true,
      providerSubmitAllowed: 1,
      liveSubmitAllowed: true,
      credentialStorage: true,
    },
  },
});
assert(dangerousPhase30Drift.summary.readyForUserReview === 0, "dangerous Phase30 evidence drift must block review");
for (const blocker of [
  "provider_live_gate_phase30_can_submit_provider_drift",
  "provider_live_gate_phase30_provider_submit_allowed_drift",
  "provider_live_gate_phase30_live_submit_allowed_drift",
  "provider_live_gate_phase30_credential_storage_drift",
]) {
  assert(dangerousPhase30Drift.requests.some((request) => request.blockers.includes(blocker)), `Phase30 drift blocker ${blocker} missing`);
}

const source = fs.readFileSync("src/core/providerExecutionPermissionGate.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `providerExecutionPermissionGate source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/provider_execution_permission_gate.schema.json");
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "provider execution permission gate schema $schema missing");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("provider_execution_permission_gate.schema.json"), "schema registry must include provider execution permission gate schema");
assert(registrySource.includes("ProviderExecutionPermissionGateState"), "schema registry must include provider execution permission gate type");

console.log(
  `Provider execution permission gate tests passed: ${gate.summary.readyForUserReview} reviewable, ${gate.summary.blocked} blocked, ${gate.summary.parked} parked.`,
);
