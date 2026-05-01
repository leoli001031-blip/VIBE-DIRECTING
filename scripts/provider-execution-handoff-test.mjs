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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-provider-execution-handoff-"));
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

function actionReceiptRequest(overrides = {}) {
  return {
    requestId: "provider_action_confirmation_receipt_request_provider_execution_permission_provider_live_gate_image_task_plan_S01_end",
    sourcePermissionRequestId: "provider_execution_permission_provider_live_gate_image_task_plan_S01_end",
    sourceGateId: "provider_live_gate_image_task_plan_S01_end",
    sourceId: "image_task_plan_S01_end",
    providerId: "openai-image2-api",
    slot: "image.edit",
    requiredMode: "image2image",
    shotId: "S01",
    receiptId: "provider_action_confirmation_receipt_provider_execution_permission_provider_live_gate_image_task_plan_S01_end",
    status: "ready_for_receipt",
    blockers: [],
    warnings: [],
    reviewOrder: [
      "review_phase31_permission_request",
      "collect_action_time_confirmation",
      "record_confirmation_receipt",
      "hold_for_final_execution_gate",
    ],
    canRecordReceipt: true,
    confirmationReceiptRequired: true,
    confirmationReceiptPlaceholderPresent: true,
    actionTimeConfirmationRequired: true,
    userConfirmedAtActionTime: false,
    confirmedReceiptCount: 0,
    finalExecutionGateRequired: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    automaticSubmitAllowed: false,
    credentialStorage: false,
    dryRunOnly: true,
    readOnly: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    noApiKeyCreation: true,
    noArbitraryProviderCommand: true,
    noWorkerSpawn: true,
    noFileMutation: true,
    ...overrides,
  };
}

function actionReceipt(overrides = {}) {
  const request = actionReceiptRequest();
  return {
    receiptId: request.receiptId,
    sourcePermissionRequestId: request.sourcePermissionRequestId,
    sourceGateId: request.sourceGateId,
    sourceId: request.sourceId,
    providerId: request.providerId,
    slot: request.slot,
    requiredMode: request.requiredMode,
    shotId: request.shotId,
    status: "ready_for_receipt",
    receiptKind: "action_time_user_confirmation_receipt",
    placeholderPresent: true,
    typedEvidencePresent: true,
    confirmationRequired: true,
    actionTimeConfirmationRequired: true,
    userConfirmedAtActionTime: false,
    confirmed: false,
    confirmedReceiptCount: 0,
    finalExecutionGateRequired: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    automaticSubmitAllowed: false,
    credentialStorage: false,
    dryRunOnly: true,
    readOnly: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    noApiKeyCreation: true,
    noArbitraryProviderCommand: true,
    noWorkerSpawn: true,
    noFileMutation: true,
    blockers: [],
    warnings: [],
    ...overrides,
  };
}

function actionReceiptState() {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-05-01T00:00:00.000Z",
    phase: "phase_32_action_time_confirmation_receipt",
    requests: [actionReceiptRequest()],
    receipts: [actionReceipt()],
    summary: {
      totalRequests: 1,
      readyForReceipt: 1,
      blocked: 0,
      parked: 0,
      totalReceipts: 1,
      receiptPlaceholderCount: 1,
      confirmedReceiptCount: 0,
      canRecordReceipt: 1,
      userConfirmedAtActionTime: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
    },
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      reviewShellOnly: true,
      receiptPlanOnly: true,
      actionTimeConfirmationRequired: true,
      finalExecutionGateRequired: true,
      providerSubmissionForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
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
    phase32Evidence: {
      phaseId: "phase_32_action_time_confirmation_receipt",
      typedEvidencePresent: true,
      phase31GateConsumed: true,
      phase31RequestsMirrored: 1,
      receiptPlaceholdersPresent: true,
      defaultUserConfirmedAtActionTime: false,
      confirmedReceiptCount: 0,
      actionTimeConfirmationRequired: true,
      finalExecutionGateRequired: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
    },
    forbiddenActions: [
      "provider_submit",
      "automatic_submit",
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

const { buildProviderExecutionHandoffState } = await loadModule(
  "src/core/providerExecutionHandoff.ts",
  "providerExecutionHandoff.mjs",
);

function build(providerActionConfirmationReceipt = actionReceiptState()) {
  return buildProviderExecutionHandoffState({
    generatedAt: "2026-05-01T00:00:00.000Z",
    providerActionConfirmationReceipt,
  });
}

const defaultState = build();

assert(defaultState.schemaVersion === "0.1.0", "schema version drifted");
assert(defaultState.phase === "phase_33_provider_execution_handoff", "phase drifted");
assert(defaultState.status === "blocked_missing_action_confirmation", "default status should block on missing action confirmation");
assert(defaultState.summary.totalHandoffs === 1, "Phase 33 must map Phase 32 requests to handoffs");
assert(defaultState.summary.blockedMissingActionConfirmation === 1, "default handoff must block on missing confirmation");
assert(defaultState.summary.readyForFinalUserHandoffReview === 0, "default must not enter final handoff review");
assert(defaultState.summary.blocked === 0, "default closed route should not hard-block");
assert(defaultState.summary.confirmedReceiptCountObserved === 0, "default confirmed receipt count must be zero");
assert(defaultState.summary.userConfirmedAtActionTimeObserved === false, "default user confirmation must be false");
assert(defaultState.summary.providerSubmitAllowed === 0, "provider submit must remain zero");
assert(defaultState.summary.liveSubmitAllowed === false, "live submit must remain false");
assert(defaultState.summary.credentialAccessAllowed === false, "credential access must remain false");
assert(defaultState.summary.automaticSubmitAllowed === false, "automatic submit must remain false");
assert(defaultState.summary.canSpawnWorker === false, "worker spawn must remain false");
assert(defaultState.summary.fileMutationAllowed === false, "file mutation must remain false");
assert(defaultState.summary.handoffPlanOnly === true, "Phase 33 must emit plan only");
assert(defaultState.summary.finalActionGateRequired === true, "Phase 33 must require final action gate");

const defaultHandoff = defaultState.handoffs[0];
assert(defaultHandoff.status === "blocked_missing_action_confirmation", "default handoff must block on missing confirmation");
assert(defaultHandoff.receiptConfirmed === false, "default handoff must not be confirmed");
assert(defaultHandoff.canEnterFinalUserHandoffReview === false, "default handoff must not enter final review");
assert(
  defaultHandoff.blockers.some((blocker) => /confirmation receipt has not been captured/i.test(blocker)),
  "default missing confirmation blocker absent",
);
assert(defaultState.phase33Evidence.phase32ReceiptStateConsumed === true, "Phase 32 receipt state must be consumed");
assert(defaultState.phase33Evidence.phase32RequestsObserved === 1, "Phase 32 requests observed drifted");
assert(defaultState.phase33Evidence.phase32ReceiptsObserved === 1, "Phase 32 receipts observed drifted");
assert(defaultState.phase33Evidence.confirmedReceiptCountObserved === 0, "Phase 33 evidence must observe zero confirmations by default");
assert(defaultState.phase33Evidence.allPhase32ProviderRoutesClosed === true, "Phase 32 provider routes should remain closed");

for (const key of [
  "dryRunOnly",
  "readOnly",
  "handoffPlanOnly",
  "finalActionGateRequired",
  "noProviderSubmit",
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
  assert(defaultState.hardLocks[key] === true, `${key} hard lock must be true`);
  assert(defaultHandoff[key] === true, `${key} handoff lock must be true`);
}

for (const key of [
  "canSubmitProvider",
  "liveSubmitAllowed",
  "credentialAccessAllowed",
  "automaticSubmitAllowed",
  "canSpawnWorker",
  "fileMutationAllowed",
]) {
  assert(defaultState.hardLocks[key] === false, `${key} hard lock must be false`);
  assert(defaultHandoff[key] === false, `${key} handoff lock must be false`);
}

assert(defaultState.hardLocks.providerSubmitAllowed === 0, "providerSubmitAllowed hard lock must be zero");
assert(defaultHandoff.providerSubmitAllowed === 0, "providerSubmitAllowed handoff lock must be zero");

const confirmedReceiptState = clone(actionReceiptState());
confirmedReceiptState.summary.confirmedReceiptCount = 1;
confirmedReceiptState.summary.userConfirmedAtActionTime = true;
confirmedReceiptState.requests[0].userConfirmedAtActionTime = true;
confirmedReceiptState.requests[0].confirmedReceiptCount = 1;
confirmedReceiptState.receipts[0].confirmed = true;
confirmedReceiptState.receipts[0].userConfirmedAtActionTime = true;
confirmedReceiptState.receipts[0].confirmedReceiptCount = 1;

const confirmedHandoffState = build(confirmedReceiptState);
assert(
  confirmedHandoffState.status === "ready_for_final_user_handoff_review",
  "confirmed receipt should become review-ready",
);
assert(confirmedHandoffState.summary.readyForFinalUserHandoffReview === 1, "confirmed receipt should create one review-ready handoff");
assert(confirmedHandoffState.summary.confirmedReceiptCountObserved === 1, "confirmed receipt count should be observed");
assert(confirmedHandoffState.summary.userConfirmedAtActionTimeObserved === true, "user confirmation should be observed");
assert(confirmedHandoffState.summary.providerSubmitAllowed === 0, "review-ready handoff still cannot submit provider");
assert(confirmedHandoffState.summary.canSpawnWorker === false, "review-ready handoff still cannot spawn worker");
assert(confirmedHandoffState.summary.fileMutationAllowed === false, "review-ready handoff still cannot mutate files");
assert(confirmedHandoffState.handoffs[0].status === "ready_for_final_user_handoff_review", "handoff should be ready for final review");
assert(confirmedHandoffState.handoffs[0].receiptConfirmed === true, "handoff should observe confirmed receipt");
assert(confirmedHandoffState.handoffs[0].canSubmitProvider === false, "confirmed handoff still cannot submit provider");
assert(confirmedHandoffState.handoffs[0].providerSubmitAllowed === 0, "confirmed handoff provider submit count must stay zero");
assert(confirmedHandoffState.handoffs[0].noCredentialRead === true, "confirmed handoff must not read credentials");
assert(confirmedHandoffState.handoffs[0].noWorkerSpawn === true, "confirmed handoff must not spawn workers");
assert(confirmedHandoffState.handoffs[0].noFileMutation === true, "confirmed handoff must not mutate files");

const globalDriftState = clone(confirmedReceiptState);
globalDriftState.hardLocks.liveSubmitAllowed = true;
const globalDriftHandoff = build(globalDriftState);
assert(globalDriftHandoff.status === "blocked", "global hard lock drift must block state");
assert(globalDriftHandoff.handoffs[0].status === "blocked", "global hard lock drift must block handoff");
assert(globalDriftHandoff.phase33Evidence.allPhase32ProviderRoutesClosed === false, "global drift evidence must be false");
assert(
  globalDriftHandoff.handoffs[0].blockers.some((blocker) => /Phase 32 provider, live, credential, worker, or file locks drifted/i.test(blocker)),
  "global drift blocker missing",
);

const receiptDriftState = clone(confirmedReceiptState);
receiptDriftState.receipts[0].providerSubmitAllowed = 1;
const receiptDriftHandoff = build(receiptDriftState);
assert(receiptDriftHandoff.status === "blocked", "receipt hard lock drift must block state");
assert(receiptDriftHandoff.handoffs[0].status === "blocked", "receipt hard lock drift must block handoff");
assert(
  receiptDriftHandoff.handoffs[0].blockers.some((blocker) => /receipt provider, live, credential, worker, or file locks drifted/i.test(blocker)),
  "receipt drift blocker missing",
);

const missingReceiptState = clone(actionReceiptState());
missingReceiptState.receipts = [];
const missingReceiptHandoff = build(missingReceiptState);
assert(missingReceiptHandoff.status === "blocked", "missing receipt must block state");
assert(missingReceiptHandoff.handoffs[0].status === "blocked", "missing receipt must block handoff");
assert(
  missingReceiptHandoff.handoffs[0].blockers.some((blocker) => /receipt is missing/i.test(blocker)),
  "missing receipt blocker missing",
);

const source = fs.readFileSync("src/core/providerExecutionHandoff.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `providerExecutionHandoff source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/provider_execution_handoff.schema.json");
assert(schema.title === "ProviderExecutionHandoffState", "schema title drifted");
assert(schema.properties.phase.const === "phase_33_provider_execution_handoff", "schema phase const drifted");
assert(schema.$defs.status.enum.includes("blocked_missing_action_confirmation"), "schema must allow missing confirmation block");
assert(schema.$defs.status.enum.includes("ready_for_final_user_handoff_review"), "schema must allow review-ready status");
assert(schema.$defs.status.enum.includes("blocked"), "schema must allow hard blocked status");
assert(schema.$defs.hardLocks.properties.canSubmitProvider.const === false, "schema must pin canSubmitProvider=false");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema must pin providerSubmitAllowed=0");
assert(schema.$defs.hardLocks.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed=false");
assert(schema.$defs.hardLocks.properties.credentialAccessAllowed.const === false, "schema must pin credentialAccessAllowed=false");
assert(schema.$defs.hardLocks.properties.automaticSubmitAllowed.const === false, "schema must pin automaticSubmitAllowed=false");
assert(schema.$defs.hardLocks.properties.canSpawnWorker.const === false, "schema must pin canSpawnWorker=false");
assert(schema.$defs.hardLocks.properties.fileMutationAllowed.const === false, "schema must pin fileMutationAllowed=false");
assert(schema.$defs.hardLocks.properties.dryRunOnly.const === true, "schema must pin dryRunOnly=true");
assert(schema.$defs.hardLocks.properties.readOnly.const === true, "schema must pin readOnly=true");
assert(schema.$defs.hardLocks.properties.handoffPlanOnly.const === true, "schema must pin handoffPlanOnly=true");
assert(schema.$defs.hardLocks.properties.finalActionGateRequired.const === true, "schema must pin finalActionGateRequired=true");
assert(schema.$defs.hardLocks.properties.noProviderSubmit.const === true, "schema must block provider submit");
assert(schema.$defs.hardLocks.properties.noCredentialRead.const === true, "schema must block credential reads");
assert(schema.$defs.hardLocks.properties.noCredentialWrite.const === true, "schema must block credential writes");
assert(schema.$defs.hardLocks.properties.noApiKeyCreation.const === true, "schema must block API key creation");
assert(schema.$defs.hardLocks.properties.noArbitraryProviderCommand.const === true, "schema must block arbitrary provider commands");
assert(schema.$defs.hardLocks.properties.noWorkerSpawn.const === true, "schema must block worker spawn");
assert(schema.$defs.hardLocks.properties.noFileMutation.const === true, "schema must block file mutation");
assert(schema.$defs.hardLocks.properties.fastModelForbidden.const === true, "schema must forbid fast model");
assert(schema.$defs.hardLocks.properties.vipChannelForbidden.const === true, "schema must forbid VIP channel");
assert(schema.$defs.hardLocks.properties.textToVideoMainPathForbidden.const === true, "schema must forbid text-to-video main path");
assert(schema.$defs.hardLocks.properties.bgmInVideoPromptForbidden.const === true, "schema must forbid BGM in video prompt");
assert(schema.$defs.phase33Evidence.properties.phaseId.const === "phase_33_provider_execution_handoff", "schema phase33 evidence id drifted");
assert(schema.$defs.phase33Evidence.properties.handoffPlanOnly.const === true, "schema evidence must be plan-only");
assert(schema.$defs.handoff.properties.canSubmitProvider.const === false, "schema handoff must pin canSubmitProvider=false");
assert(schema.$defs.handoff.properties.providerSubmitAllowed.const === 0, "schema handoff must pin providerSubmitAllowed=0");
assert(schema.$defs.handoff.properties.noProviderSubmit.const === true, "schema handoff must block provider submit");

console.log(
  `Provider execution handoff tests passed: ${defaultState.summary.blockedMissingActionConfirmation} blocked_missing_action_confirmation, ${confirmedHandoffState.summary.readyForFinalUserHandoffReview} review-ready, ${globalDriftHandoff.summary.blocked} drift-blocked.`,
);
