import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModule(sourcePath, exportPath) {
  const resolved = path.resolve(sourcePath);
  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: resolved,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-provider-action-confirmation-receipt-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function permissionRequest(overrides = {}) {
  return {
    requestId: "provider_execution_permission_provider_live_gate_image_task_plan_S01_end",
    sourceGateId: "provider_live_gate_image_task_plan_S01_end",
    sourceId: "image_task_plan_S01_end",
    providerId: "openai-image2-api",
    slot: "image.edit",
    requiredMode: "image2image",
    shotId: "S01",
    status: "ready_for_user_review",
    confirmations: [
      {
        confirmationId: "review_provider_packet",
        label: "Review provider packet",
        required: true,
        present: true,
        confirmed: true,
      },
      {
        confirmationId: "action_time_user_confirmation",
        label: "Action-time user confirmation",
        required: true,
        present: true,
        confirmed: false,
        blocker: "Action-time user confirmation has not been captured.",
      },
    ],
    blockers: [],
    warnings: [],
    executionOrder: [
      "review_provider_packet",
      "ask_action_time_confirmation",
      "record_confirmation_receipt",
      "wait_for_future_execution_gate",
    ],
    canAskUserToConfirm: true,
    actionTimeConfirmationRequired: true,
    userConfirmedAtActionTime: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    credentialStorage: false,
    dryRunOnly: true,
    readOnly: true,
    noWorkerSpawn: true,
    noFileMutation: true,
    ...overrides,
  };
}

function permissionGate() {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-05-01T00:00:00.000Z",
    phase: "phase_31_provider_execution_permission_gate",
    requests: [
      permissionRequest(),
      permissionRequest({
        requestId: "provider_execution_permission_provider_live_gate_video_task_plan_S02",
        sourceGateId: "provider_live_gate_video_task_plan_S02",
        sourceId: "video_task_plan_S02",
        providerId: "seedance2-provider",
        slot: "video.i2v",
        requiredMode: "frames2video",
        shotId: "S02",
        status: "parked",
        blockers: ["Provider slot is parked and cannot request action-time confirmation."],
        canAskUserToConfirm: false,
      }),
    ],
    summary: {
      totalRequests: 2,
      readyForUserReview: 1,
      blocked: 0,
      parked: 1,
      canAskUserToConfirm: 1,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
    },
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      reviewPlanOnly: true,
      actionTimeConfirmationRequired: true,
      providerSubmissionForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noApiKeyCreation: true,
      noArbitraryProviderCommand: true,
      noWorkerSpawn: true,
      noFileMutation: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
    },
    phase31Evidence: {
      phaseId: "phase_31_provider_execution_permission_gate",
      typedEvidencePresent: true,
      phase30GateConsumed: true,
      actionTimeUserConfirmationRequired: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
      forbiddenProviderModesAbsent: true,
    },
    forbiddenActions: [
      "provider_submit",
      "credential_read",
      "credential_write",
      "api_key_create",
      "arbitrary_provider_command",
      "worker_spawn",
      "file_mutation",
      "fast_model",
      "vip_channel",
      "text_to_video_main_path",
      "bgm_in_video_prompt",
    ],
    notes: [],
  };
}

const { buildProviderActionConfirmationReceiptState } = await loadModule(
  "src/core/providerActionConfirmationReceipt.ts",
  "providerActionConfirmationReceipt.mjs",
);

function build(gate = permissionGate()) {
  return buildProviderActionConfirmationReceiptState({
    generatedAt: "2026-05-01T00:00:00.000Z",
    providerExecutionPermissionGate: gate,
  });
}

const state = build();

assert(state.schemaVersion === "0.1.0", "schema version drifted");
assert(state.phase === "phase_32_action_time_confirmation_receipt", "phase drifted");
assert(state.summary.totalRequests === 2, "requests should mirror Phase 31 requests");
assert(state.summary.totalReceipts === 2, "receipts should mirror Phase 31 requests");
assert(state.summary.readyForReceipt === 1, "ready Phase 31 request should be ready for receipt");
assert(state.summary.parked === 0, "Phase 31 parked source requests should not remain receipt-ready parked");
assert(state.summary.blocked === 1, "Phase 31 parked source request should block receipt recording");
assert(state.summary.receiptPlaceholderCount === 2, "receipt placeholders should be generated for every request");
assert(state.summary.confirmedReceiptCount === 0, "confirmed receipt count must default to zero");
assert(state.summary.userConfirmedAtActionTime === false, "user confirmation must default to false");
assert(state.summary.providerSubmitAllowed === 0, "provider submit must remain zero");
assert(state.summary.liveSubmitAllowed === false, "live submit must remain false");
assert(state.summary.credentialAccessAllowed === false, "credential access must remain false");
assert(state.summary.automaticSubmitAllowed === false, "automatic submit must remain false");
assert(state.phase32Evidence.typedEvidencePresent === true, "typed evidence must be present");
assert(state.phase32Evidence.phase31GateConsumed === true, "Phase 31 gate must be consumed");
assert(state.phase32Evidence.phase31RequestsMirrored === 2, "Phase 31 request count should be mirrored");
assert(state.phase32Evidence.receiptPlaceholdersPresent === true, "receipt placeholders must be present");
assert(state.phase32Evidence.defaultUserConfirmedAtActionTime === false, "Phase 32 must start unconfirmed");
assert(state.phase32Evidence.confirmedReceiptCount === 0, "Phase 32 evidence must not confirm receipts");
assert(state.phase32Evidence.finalExecutionGateRequired === true, "final execution gate must be required");
assert(state.phase32Evidence.canSubmitProvider === false, "Phase 32 must not submit providers");

const readyRequest = state.requests.find((request) => request.status === "ready_for_receipt");
assert(readyRequest, "ready_for_receipt request missing");
assert(readyRequest.canRecordReceipt === true, "ready request may record receipt evidence");
assert(readyRequest.confirmationReceiptPlaceholderPresent === true, "ready request receipt placeholder missing");
assert(readyRequest.userConfirmedAtActionTime === false, "ready request must not prefill confirmation");
assert(readyRequest.confirmedReceiptCount === 0, "ready request must not count a receipt");
assert(readyRequest.finalExecutionGateRequired === true, "ready request must wait for final execution gate");
assert(readyRequest.canSubmitProvider === false, "ready request still cannot submit provider");
assert(readyRequest.automaticSubmitAllowed === false, "ready request cannot auto-submit");

const readyReceipt = state.receipts.find((receipt) => receipt.sourcePermissionRequestId === readyRequest.sourcePermissionRequestId);
assert(readyReceipt, "ready receipt missing");
assert(readyReceipt.status === "ready_for_receipt", "ready receipt status drifted");
assert(readyReceipt.placeholderPresent === true, "receipt placeholder must be present");
assert(readyReceipt.typedEvidencePresent === true, "receipt typed evidence must be present");
assert(readyReceipt.confirmed === false, "receipt must not be confirmed by default");
assert(readyReceipt.userConfirmedAtActionTime === false, "receipt user confirmation must default to false");
assert(readyReceipt.confirmedReceiptCount === 0, "receipt count must default to zero");
assert(readyReceipt.finalExecutionGateRequired === true, "receipt must wait for final execution gate");

const parkedSourceRequest = state.requests.find((request) => request.sourcePermissionRequestId.includes("video_task_plan_S02"));
assert(parkedSourceRequest, "parked source request missing");
assert(parkedSourceRequest.status === "blocked", "parked Phase 31 source must block Phase 32 receipt recording");
assert(parkedSourceRequest.canRecordReceipt === false, "parked source must not record a receipt");
assert(
  parkedSourceRequest.blockers.some((blocker) => /parked/i.test(blocker)),
  "parked source blocker missing",
);

for (const item of [...state.requests, ...state.receipts]) {
  assert(item.canSubmitProvider === false, `${item.requestId ?? item.receiptId} provider submit must be false`);
  assert(item.providerSubmitAllowed === 0, `${item.requestId ?? item.receiptId} provider submit count must be zero`);
  assert(item.liveSubmitAllowed === false, `${item.requestId ?? item.receiptId} live submit must be false`);
  assert(item.credentialAccessAllowed === false, `${item.requestId ?? item.receiptId} credential access must be false`);
  assert(item.automaticSubmitAllowed === false, `${item.requestId ?? item.receiptId} automatic submit must be false`);
  assert(item.credentialStorage === false, `${item.requestId ?? item.receiptId} credential storage must be false`);
  assert(item.noCredentialRead === true, `${item.requestId ?? item.receiptId} credential reads must be blocked`);
  assert(item.noCredentialWrite === true, `${item.requestId ?? item.receiptId} credential writes must be blocked`);
  assert(item.noApiKeyCreation === true, `${item.requestId ?? item.receiptId} API key creation must be blocked`);
  assert(item.noArbitraryProviderCommand === true, `${item.requestId ?? item.receiptId} arbitrary provider command must be blocked`);
  assert(item.noWorkerSpawn === true, `${item.requestId ?? item.receiptId} worker spawn must be blocked`);
  assert(item.noFileMutation === true, `${item.requestId ?? item.receiptId} file mutation must be blocked`);
}

for (const key of [
  "dryRunOnly",
  "readOnly",
  "reviewShellOnly",
  "receiptPlanOnly",
  "actionTimeConfirmationRequired",
  "finalExecutionGateRequired",
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
  assert(state.hardLocks[key] === true, `${key} hard lock must be true`);
}
assert(state.hardLocks.canSubmitProvider === false, "canSubmitProvider hard lock must be false");
assert(state.hardLocks.providerSubmitAllowed === 0, "providerSubmitAllowed hard lock must be zero");
assert(state.hardLocks.liveSubmitAllowed === false, "live submit hard lock must be false");
assert(state.hardLocks.credentialAccessAllowed === false, "credential access hard lock must be false");
assert(state.hardLocks.automaticSubmitAllowed === false, "automatic submit hard lock must be false");
assert(state.hardLocks.credentialStorage === false, "credential storage hard lock must be false");

function blockedFirstRequest(gateMutation, expectedPattern, label) {
  const gate = clone(permissionGate());
  gateMutation(gate);
  const blocked = build(gate).requests.find((request) => request.sourcePermissionRequestId === gate.requests[0].requestId);
  assert(blocked.status === "blocked", `${label} should block the Phase 32 request`);
  assert(blocked.canRecordReceipt === false, `${label} should not allow receipt recording`);
  assert(blocked.blockers.some((blocker) => expectedPattern.test(blocker)), `${label} blocker missing`);
}

blockedFirstRequest(
  (gate) => {
    gate.requests[0].status = "blocked";
  },
  /not ready/i,
  "non-ready Phase 31 request",
);

blockedFirstRequest(
  (gate) => {
    gate.requests[0].actionTimeConfirmationRequired = false;
  },
  /Action-time confirmation/i,
  "missing action-time confirmation requirement",
);

blockedFirstRequest(
  (gate) => {
    gate.requests[0].providerSubmitAllowed = 1;
  },
  /provider, live, credential, worker, or file/i,
  "provider path drift",
);

blockedFirstRequest(
  (gate) => {
    gate.requests[0].liveSubmitAllowed = true;
  },
  /provider, live, credential, worker, or file/i,
  "live path drift",
);

blockedFirstRequest(
  (gate) => {
    gate.requests[0].credentialAccessAllowed = true;
  },
  /provider, live, credential, worker, or file/i,
  "credential path drift",
);

blockedFirstRequest(
  (gate) => {
    gate.requests[0].noWorkerSpawn = false;
  },
  /provider, live, credential, worker, or file/i,
  "worker path drift",
);

blockedFirstRequest(
  (gate) => {
    gate.requests[0].noFileMutation = false;
  },
  /provider, live, credential, worker, or file/i,
  "file path drift",
);

blockedFirstRequest(
  (gate) => {
    gate.hardLocks.liveSubmitAllowed = true;
  },
  /global provider, live, credential, worker, or file/i,
  "global hard lock drift",
);

const source = fs.readFileSync("src/core/providerActionConfirmationReceipt.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `providerActionConfirmationReceipt source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/provider_action_confirmation_receipt.schema.json");
assert(schema.title === "ProviderActionConfirmationReceiptState", "schema title drifted");
assert(schema.properties.phase.const === "phase_32_action_time_confirmation_receipt", "schema phase const drifted");
assert(schema.$defs.status.enum.includes("ready_for_receipt"), "schema must allow ready_for_receipt");
assert(schema.$defs.status.enum.includes("blocked"), "schema must allow blocked");
assert(schema.$defs.status.enum.includes("parked"), "schema must allow parked");
assert(schema.$defs.hardLocks.properties.canSubmitProvider.const === false, "schema must pin canSubmitProvider=false");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema must pin providerSubmitAllowed=0");
assert(schema.$defs.hardLocks.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed=false");
assert(schema.$defs.hardLocks.properties.credentialAccessAllowed.const === false, "schema must pin credentialAccessAllowed=false");
assert(schema.$defs.hardLocks.properties.automaticSubmitAllowed.const === false, "schema must pin automaticSubmitAllowed=false");
assert(schema.$defs.hardLocks.properties.noCredentialRead.const === true, "schema must block credential reads");
assert(schema.$defs.hardLocks.properties.noCredentialWrite.const === true, "schema must block credential writes");
assert(schema.$defs.hardLocks.properties.noApiKeyCreation.const === true, "schema must block API key creation");
assert(schema.$defs.hardLocks.properties.noArbitraryProviderCommand.const === true, "schema must block arbitrary provider commands");
assert(schema.$defs.hardLocks.properties.noWorkerSpawn.const === true, "schema must block worker spawn");
assert(schema.$defs.hardLocks.properties.noFileMutation.const === true, "schema must block file mutation");
assert(schema.$defs.request.properties.userConfirmedAtActionTime.const === false, "request schema must default to unconfirmed");
assert(schema.$defs.request.properties.confirmedReceiptCount.const === 0, "request schema must pin zero confirmed receipts");
assert(schema.$defs.receipt.properties.confirmed.const === false, "receipt schema must pin confirmed=false");
assert(schema.$defs.receipt.properties.confirmedReceiptCount.const === 0, "receipt schema must pin zero confirmed receipts");
assert(schema.$defs.phase32Evidence.properties.finalExecutionGateRequired.const === true, "schema must require final execution gate");

console.log(
  `Provider action confirmation receipt tests passed: ${state.summary.readyForReceipt} ready, ${state.summary.blocked} blocked, ${state.summary.parked} parked, ${state.summary.confirmedReceiptCount} confirmed.`,
);
