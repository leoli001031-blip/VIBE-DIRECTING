import { ShieldAlert } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { Metric, statusLabel } from "../common/DiagnosticsPrimitives";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length ? value : fallback;
}

function readBooleanLockLabel(
  record: Record<string, unknown>,
  key: string,
  label: string,
  expected: boolean,
) {
  return record[key] === expected ? label : undefined;
}

function readFirstString(records: Record<string, unknown>[], keys: string[], fallback: string) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}

function readFirstNumber(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (Array.isArray(value)) return value.length;
    }
  }
  return undefined;
}

function readFirstBoolean(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") return value;
    }
  }
  return undefined;
}

function firstRecordFrom(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (isRecord(record[key])) return record[key];
  }
  return {};
}

function firstArrayFrom(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function formatHarnessValue(value: unknown, fallbackLabel = "value"): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isRecord(value)) return "";

  const label = readString(
    value.label,
    readString(value.id, readString(value.name, fallbackLabel)),
  );
  const status = readString(value.status, readString(value.value, ""));
  const detail = readString(value.detail, readString(value.path, ""));
  return [label, status, detail].filter(Boolean).join(" / ");
}

function readDisplayList(value: unknown, fallbackLabel = "value") {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => formatHarnessValue(item, `${fallbackLabel}-${index + 1}`))
      .filter(Boolean);
  }
  const single = formatHarnessValue(value, fallbackLabel);
  return single ? [single] : [];
}
type ProviderEnablementGateUiSummary = {
  initialized: boolean;
  readiness: string;
  readyForConfirmation: number;
  blocked: number;
  parked: number;
  confirmationTokenStatus: string;
  packetCompleteStatus: string;
  closedLoopStatus: string;
  forbiddenPathsAbsent: string;
  canSubmitProvider: string;
  submitBlocked: string;
  credentialLiveShellLocked: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type ProviderExecutionPermissionGateUiSummary = {
  initialized: boolean;
  readiness: string;
  readyForUserReview: number;
  blocked: number;
  parked: number;
  canAskUserToConfirm: number;
  actionTimeConfirmation: string;
  automaticSubmit: string;
  providerSubmit: string;
  credentialWorkerFileLocks: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type ProviderActionConfirmationReceiptUiSummary = {
  initialized: boolean;
  readiness: string;
  readyReceipts: number;
  blocked: number;
  parked: number;
  confirmedCount: number;
  providerSubmitBlocked: string;
  credentialWorkerFileLocked: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type ProviderExecutionHandoffUiSummary = {
  initialized: boolean;
  readiness: string;
  handoffCount: number;
  blockedCount: number;
  confirmedCount: number;
  providerSubmitLocked: string;
  credentialWorkerFileLocked: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
function providerEnablementGateReadinessLabel(
  status: string,
  initialized: boolean,
  readyForConfirmation: number,
  blocked: number,
  parked: number,
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (normalized.includes("ready_for_confirmation") || normalized.includes("ready for confirmation")) return "ready_for_confirmation";
  if (normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  if (normalized.includes("parked")) return "parked";
  if (blocked > 0) return "blocked";
  if (readyForConfirmation > 0) return "ready_for_confirmation";
  if (parked > 0) return "parked";
  return status ? statusLabel(status) : "blocked/missing";
}

function readProviderEnablementGateChecks(items: unknown[]) {
  return items.flatMap((item) => isRecord(item) && Array.isArray(item.checks) ? item.checks : []).filter(isRecord);
}

function checkPassed(checks: Record<string, unknown>[], pattern: RegExp) {
  const matching = checks.filter((check) => pattern.test(readString(check.checkId, readString(check.label, ""))));
  if (!matching.length) return undefined;
  return matching.every((check) => check.passed === true || readString(check.status, "").toLowerCase() === "pass");
}

function yesNoMissing(value: boolean | undefined, yes: string, no: string) {
  if (value === true) return yes;
  if (value === false) return no;
  return "blocked/missing";
}

function buildProviderEnablementGateHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const summaryLocks = firstRecordFrom(summary, ["hardLocks", "locks", "hardLockSummary"]);
  const lockRecords = [hardLocksRecord, summaryLocks, rootRecord, summary];
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "readinessPlanOnly", "readiness plan only", true),
    readBooleanLockLabel(hardLocksRecord, "confirmationPlanOnly", "confirmation plan only", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "canSubmitProvider=false", true),
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialStorage", "credential storage locked", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write locked", true),
    readBooleanLockLabel(hardLocksRecord, "noArbitraryProviderCommand", "shell locked", true),
    readBooleanLockLabel(hardLocksRecord, "fastModelForbidden", "Fast absent", true),
    readBooleanLockLabel(hardLocksRecord, "vipChannelForbidden", "VIP absent", true),
    readBooleanLockLabel(hardLocksRecord, "textToVideoMainPathForbidden", "text-to-video absent", true),
    readBooleanLockLabel(hardLocksRecord, "bgmInVideoPromptForbidden", "BGM prompt absent", true),
    readFirstBoolean(lockRecords, ["canSubmitProvider"]) === false ? "canSubmitProvider=false" : undefined,
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

export function buildProviderEnablementGateUiSummary(runtimeState: ProjectRuntimeState): ProviderEnablementGateUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerLiveGate?: unknown }).providerLiveGate;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const items = Array.isArray(rootRecord.items) ? rootRecord.items : [];
  const checks = readProviderEnablementGateChecks(items);
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, rootRecord, hardLocksRecord].filter(isRecord);
  const readyForConfirmation = readFirstNumber(records, ["readyForConfirmation", "ready_for_confirmation"])
    ?? items.filter((item) => isRecord(item) && item.status === "ready_for_confirmation").length;
  const blocked = readFirstNumber(records, ["blocked"])
    ?? items.filter((item) => isRecord(item) && item.status === "blocked").length;
  const parked = readFirstNumber(records, ["parked"])
    ?? items.filter((item) => isRecord(item) && item.status === "parked").length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const tokenPresent = readFirstBoolean(records, [
    "providerConfirmationTokenPlaceholderPresent",
    "confirmationTokenPlaceholderPresent",
    "confirmationTokenPresent",
    "userConfirmationTokenPlaceholderPresent",
  ]) ?? checkPassed(checks, /user_confirmation_token_placeholder|confirmation/i);
  const packetComplete = readFirstBoolean(records, [
    "providerPacketComplete",
    "packetComplete",
    "enablementPacketComplete",
    "completeEnablementPacket",
  ]) ?? checkPassed(checks, /envelope_valid|packet|enablement/i);
  const closedLoopSignals = [
    checkPassed(checks, /asset_readiness|watcher/),
    checkPassed(checks, /envelope_valid|manifest/),
    checkPassed(checks, /pair_qa_pass|qa/),
  ];
  const inferredClosedLoop = closedLoopSignals.every((signal) => signal !== undefined)
    ? closedLoopSignals.every((signal) => signal === true)
    : undefined;
  const closedLoop = readFirstBoolean(records, [
    "closedLoopReady",
    "closedLoopComplete",
    "closedLoopRequirementMet",
    "watcherManifestQaClosedLoop",
  ]) ?? inferredClosedLoop;
  const forbiddenPathSignals = [
    hardLocksRecord.fastModelForbidden,
    hardLocksRecord.vipChannelForbidden,
    hardLocksRecord.textToVideoMainPathForbidden,
    hardLocksRecord.bgmInVideoPromptForbidden,
  ];
  const inferredForbiddenPathsAbsent = forbiddenPathSignals.every((signal) => typeof signal === "boolean")
    ? forbiddenPathSignals.every((signal) => signal === true)
    : undefined;
  const forbiddenPathsAbsent = readFirstBoolean(records, [
    "forbiddenProviderModesAbsent",
    "forbiddenPathsAbsent",
    "forbiddenModesAbsent",
  ]) ?? inferredForbiddenPathsAbsent;
  const canSubmitProvider = readFirstBoolean(records, ["canSubmitProvider"]);
  const providerSubmitBlocked = readFirstBoolean(records, [
    "providerSubmissionForbidden",
    "providerSubmitBlocked",
    "noProviderSubmit",
  ]) ?? hardLocksRecord.providerSubmissionForbidden === true;
  const credentialLiveShellLocked =
    (readFirstBoolean(records, ["credentialStorage"]) === false || hardLocksRecord.noCredentialRead === true || hardLocksRecord.noCredentialWrite === true)
    && (readFirstBoolean(records, ["liveSubmitAllowed"]) === false)
    && (hardLocksRecord.noArbitraryProviderCommand === true || hardLocksRecord.arbitraryShellExecutionBlocked === true);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...items.flatMap((item) => isRecord(item) ? readDisplayList(item.blockers, "blocker") : []),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...items.flatMap((item) => isRecord(item) ? readDisplayList(item.warnings, "warning") : []),
  ].filter(Boolean)));
  const hardLocks = buildProviderEnablementGateHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerEnablementGateReadinessLabel(status, initialized, readyForConfirmation, blocked, parked),
    readyForConfirmation,
    blocked,
    parked,
    confirmationTokenStatus: yesNoMissing(tokenPresent, "placeholder present", "placeholder missing"),
    packetCompleteStatus: yesNoMissing(packetComplete, "complete", "incomplete"),
    closedLoopStatus: yesNoMissing(closedLoop, "closed loop satisfied", "closed loop missing"),
    forbiddenPathsAbsent: yesNoMissing(forbiddenPathsAbsent, "Fast / VIP / text-to-video / BGM prompt absent", "forbidden path present"),
    canSubmitProvider: canSubmitProvider === false ? "canSubmitProvider=false" : "blocked/missing",
    submitBlocked: providerSubmitBlocked ? "provider submit blocked" : "blocked/missing",
    credentialLiveShellLocked: credentialLiveShellLocked ? "credential/live submit/shell locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerLiveGate"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerLiveGate"],
  };
}

function providerExecutionPermissionGateReadinessLabel(
  status: string,
  initialized: boolean,
  readyForUserReview: number,
  blocked: number,
  parked: number,
) {
  if (!initialized) return "blocked/missing";
  if (blocked > 0) return "blocked";
  if (readyForUserReview > 0) return "ready_for_user_review";
  if (parked > 0) return "parked";
  return status ? statusLabel(status) : "blocked/missing";
}

function buildProviderExecutionPermissionGateHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "reviewPlanOnly", "review plan only", true),
    readBooleanLockLabel(hardLocksRecord, "actionTimeConfirmationRequired", "action-time confirmation", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "canSubmitProvider=false", false),
    hardLocksRecord.providerSubmitAllowed === 0 ? "providerSubmitAllowed=0" : undefined,
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialAccessAllowed", "credential access locked", false),
    readBooleanLockLabel(hardLocksRecord, "noWorkerSpawn", "worker spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "fastModelForbidden", "Fast absent", true),
    readBooleanLockLabel(hardLocksRecord, "vipChannelForbidden", "VIP absent", true),
    readBooleanLockLabel(hardLocksRecord, "textToVideoMainPathForbidden", "text-to-video absent", true),
    readBooleanLockLabel(hardLocksRecord, "bgmInVideoPromptForbidden", "BGM prompt absent", true),
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

export function buildProviderExecutionPermissionGateUiSummary(runtimeState: ProjectRuntimeState): ProviderExecutionPermissionGateUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerExecutionPermissionGate?: unknown }).providerExecutionPermissionGate;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const evidence = initialized && isRecord(rootRecord.phase31Evidence) ? rootRecord.phase31Evidence : {};
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, evidence, rootRecord, hardLocksRecord].filter(isRecord);
  const requests = Array.isArray(rootRecord.requests) ? rootRecord.requests : [];
  const readyForUserReview = readFirstNumber(records, ["readyForUserReview", "ready_for_user_review"])
    ?? requests.filter((request) => isRecord(request) && request.status === "ready_for_user_review").length;
  const blocked = readFirstNumber(records, ["blocked"])
    ?? requests.filter((request) => isRecord(request) && request.status === "blocked").length;
  const parked = readFirstNumber(records, ["parked"])
    ?? requests.filter((request) => isRecord(request) && request.status === "parked").length;
  const canAskUserToConfirm = readFirstNumber(records, ["canAskUserToConfirm"])
    ?? requests.filter((request) => isRecord(request) && request.canAskUserToConfirm === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const actionTimeRequired = readFirstBoolean(records, ["actionTimeUserConfirmationRequired", "actionTimeConfirmationRequired"]);
  const automaticSubmitAllowed = readFirstBoolean(records, ["automaticSubmitAllowed"]);
  const automaticSubmitForbidden = readFirstBoolean(records, ["automaticSubmitForbidden"]) ?? automaticSubmitAllowed === false;
  const providerSubmitAllowed = readFirstNumber(records, ["providerSubmitAllowed"]) ?? (readFirstBoolean(records, ["canSubmitProvider"]) === false ? 0 : undefined);
  const liveSubmitAllowed = readFirstBoolean(records, ["liveSubmitAllowed"]);
  const credentialAccessAllowed = readFirstBoolean(records, ["credentialAccessAllowed"]);
  const workerSpawnLocked = readFirstBoolean(records, ["noWorkerSpawn"]);
  const fileMutationLocked = readFirstBoolean(records, ["noFileMutation"]);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...requests.flatMap((request) => isRecord(request) ? readDisplayList(request.blockers, "blocker") : []),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...requests.flatMap((request) => isRecord(request) ? readDisplayList(request.warnings, "warning") : []),
  ].filter(Boolean)));
  const hardLocks = buildProviderExecutionPermissionGateHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerExecutionPermissionGateReadinessLabel(status, initialized, readyForUserReview, blocked, parked),
    readyForUserReview,
    blocked,
    parked,
    canAskUserToConfirm,
    actionTimeConfirmation: actionTimeRequired ? "required" : "blocked/missing",
    automaticSubmit: automaticSubmitForbidden ? "automatic submit blocked" : "blocked/missing",
    providerSubmit: providerSubmitAllowed === 0 ? "provider submit blocked" : "blocked/missing",
    credentialWorkerFileLocks: liveSubmitAllowed === false && credentialAccessAllowed === false && workerSpawnLocked === true && fileMutationLocked === true
      ? "credential/live/worker/file locked"
      : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerExecutionPermissionGate"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerExecutionPermissionGate"],
  };
}

function providerActionConfirmationReceiptReadinessLabel(
  status: string,
  initialized: boolean,
  readyReceipts: number,
  blocked: number,
  parked: number,
  confirmedCount: number,
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (blocked > 0 || normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  if (confirmedCount > 0 || normalized.includes("confirmed")) return "confirmed";
  if (readyReceipts > 0 || normalized.includes("ready")) return "ready_receipts";
  if (parked > 0 || normalized.includes("parked")) return "parked";
  return status ? statusLabel(status) : "blocked/missing";
}

function receiptRowIsConfirmed(row: Record<string, unknown>) {
  if (row.confirmed === true || row.userConfirmedAtActionTime === true || row.confirmedAtActionTime === true) return true;
  const confirmations = Array.isArray(row.confirmations) ? row.confirmations : [];
  return confirmations.some((item) => isRecord(item) && item.confirmed === true);
}

function buildProviderActionConfirmationReceiptHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "receiptOnly", "receipt only", true),
    readBooleanLockLabel(hardLocksRecord, "receiptPlanOnly", "receipt plan only", true),
    readBooleanLockLabel(hardLocksRecord, "reviewShellOnly", "review shell only", true),
    readBooleanLockLabel(hardLocksRecord, "actionTimeConfirmationRequired", "action-time confirmation required", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "canSubmitProvider=false", false),
    hardLocksRecord.providerSubmitAllowed === 0 ? "providerSubmitAllowed=0" : undefined,
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialAccessAllowed", "credential access locked", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write locked", true),
    readBooleanLockLabel(hardLocksRecord, "noWorkerSpawn", "worker spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "workerSpawnAllowed", "worker spawn locked", false),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "fileMutationAllowed", "file mutation locked", false),
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

export function buildProviderActionConfirmationReceiptUiSummary(runtimeState: ProjectRuntimeState): ProviderActionConfirmationReceiptUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerActionConfirmationReceipt?: unknown }).providerActionConfirmationReceipt;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const evidence = initialized && isRecord(rootRecord.phase32Evidence) ? rootRecord.phase32Evidence : {};
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, evidence, rootRecord, hardLocksRecord].filter(isRecord);
  const receiptRows = firstArrayFrom([rootRecord, summary], [
    "receipts",
    "items",
    "confirmationReceipts",
    "actionReceipts",
    "requests",
  ]);
  const receiptRecords = receiptRows.filter(isRecord);
  const readyReceipts = readFirstNumber(records, [
    "readyReceipts",
    "readyReceiptCount",
    "readyForReceipt",
    "readyForActionConfirmation",
    "ready",
  ]) ?? receiptRecords.filter((row) => /ready/.test(readString(row.status, "").toLowerCase())).length;
  const blocked = readFirstNumber(records, ["blocked", "blockedReceipts", "blockedReceiptCount"])
    ?? receiptRecords.filter((row) => readString(row.status, "") === "blocked").length;
  const parked = readFirstNumber(records, ["parked", "parkedReceipts", "parkedReceiptCount"])
    ?? receiptRecords.filter((row) => readString(row.status, "") === "parked").length;
  const confirmedCount = readFirstNumber(records, [
    "confirmedCount",
    "confirmedReceiptCount",
    "confirmedReceipts",
    "confirmed",
  ]) ?? receiptRecords.filter(receiptRowIsConfirmed).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const providerSubmitAllowedNumber = readFirstNumber(records, ["providerSubmitAllowed"]);
  const providerSubmitAllowedBoolean = readFirstBoolean(records, ["providerSubmitAllowed", "canSubmitProvider"]);
  const providerSubmitBlockedFlag = readFirstBoolean(records, [
    "providerSubmitBlocked",
    "providerSubmissionForbidden",
    "noProviderSubmit",
  ]);
  const providerSubmitBlocked = providerSubmitAllowedNumber === 0
    || providerSubmitAllowedBoolean === false
    || providerSubmitBlockedFlag === true;
  const providerSubmitDrift = (providerSubmitAllowedNumber !== undefined && providerSubmitAllowedNumber !== 0)
    || providerSubmitAllowedBoolean === true
    || providerSubmitBlockedFlag === false;
  const credentialLocked = readFirstBoolean(records, ["credentialAccessAllowed", "credentialReadAllowed", "credentialStorage"]) === false
    || records.some((record) => record.noCredentialRead === true || record.noCredentialWrite === true || record.credentialAccessBlocked === true);
  const workerLocked = readFirstBoolean(records, ["workerSpawnAllowed", "canSpawnWorker", "workerExecutionAllowed"]) === false
    || records.some((record) => record.noWorkerSpawn === true || record.workerSpawnBlocked === true);
  const fileLocked = readFirstBoolean(records, ["fileMutationAllowed", "canMutateFiles", "fileWriteAllowed"]) === false
    || records.some((record) => record.noFileMutation === true || record.fileMutationBlocked === true);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...receiptRecords.flatMap((row) => readDisplayList(row.blockers, "blocker")),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...receiptRecords.flatMap((row) => readDisplayList(row.warnings, "warning")),
  ].filter(Boolean)));
  const hardLocks = buildProviderActionConfirmationReceiptHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerActionConfirmationReceiptReadinessLabel(status, initialized, readyReceipts, blocked, parked, confirmedCount),
    readyReceipts,
    blocked,
    parked,
    confirmedCount,
    providerSubmitBlocked: providerSubmitBlocked ? "provider submit blocked" : providerSubmitDrift ? "provider submit drift" : "blocked/missing",
    credentialWorkerFileLocked: credentialLocked && workerLocked && fileLocked ? "credential/worker/file locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerActionConfirmationReceipt"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerActionConfirmationReceipt"],
  };
}

function providerExecutionHandoffReadinessLabel(
  status: string,
  initialized: boolean,
  handoffCount: number,
  blockedCount: number,
  confirmedCount: number,
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (blockedCount > 0 || normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  if (confirmedCount > 0 || normalized.includes("confirmed")) return "confirmed";
  if (handoffCount > 0 || normalized.includes("ready")) return "ready_for_final_action";
  return status ? statusLabel(status) : "blocked/missing";
}

function handoffRowIsConfirmed(row: Record<string, unknown>) {
  if (row.confirmed === true || row.userConfirmedAtActionTime === true || row.finalActionConfirmed === true) return true;
  const receipts = Array.isArray(row.receipts) ? row.receipts : [];
  const confirmations = Array.isArray(row.confirmations) ? row.confirmations : [];
  return [...receipts, ...confirmations].some((item) => isRecord(item) && item.confirmed === true);
}

function buildProviderExecutionHandoffHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "handoffOnly", "handoff only", true),
    readBooleanLockLabel(hardLocksRecord, "finalActionGateOnly", "final action gate only", true),
    readBooleanLockLabel(hardLocksRecord, "actionTimeConfirmationRequired", "action-time confirmation required", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit locked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit locked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "canSubmitProvider=false", false),
    hardLocksRecord.providerSubmitAllowed === 0 ? "providerSubmitAllowed=0" : undefined,
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialAccessAllowed", "credential access locked", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write locked", true),
    readBooleanLockLabel(hardLocksRecord, "noWorkerSpawn", "worker spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "workerSpawnAllowed", "worker spawn locked", false),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "fileMutationAllowed", "file mutation locked", false),
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

export function buildProviderExecutionHandoffUiSummary(runtimeState: ProjectRuntimeState): ProviderExecutionHandoffUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerExecutionHandoff?: unknown }).providerExecutionHandoff;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const evidence = initialized && isRecord(rootRecord.phase33Evidence) ? rootRecord.phase33Evidence : {};
  const finalActionGate = firstRecordFrom(rootRecord, ["finalActionGate", "handoffGate", "executionHandoffGate"]);
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, evidence, finalActionGate, rootRecord, hardLocksRecord].filter(isRecord);
  const handoffRows = firstArrayFrom([rootRecord, summary, finalActionGate], [
    "handoffs",
    "items",
    "handoffItems",
    "executionHandoffs",
    "finalActionRequests",
    "requests",
  ]);
  const handoffRecords = handoffRows.filter(isRecord);
  const handoffCount = readFirstNumber(records, [
    "handoffCount",
    "totalHandoffs",
    "total",
    "readyHandoffCount",
    "readyForFinalAction",
  ]) ?? handoffRecords.length;
  const blockedCount = readFirstNumber(records, [
    "blockedCount",
    "blocked",
    "blockedHandoffs",
    "blockedHandoffCount",
  ]) ?? handoffRecords.filter((row) => /blocked|missing|fail/.test(readString(row.status, "").toLowerCase())).length;
  const confirmedCount = readFirstNumber(records, [
    "confirmedCount",
    "confirmedHandoffCount",
    "confirmedHandoffs",
    "confirmed",
  ]) ?? handoffRecords.filter(handoffRowIsConfirmed).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const providerSubmitAllowedNumber = readFirstNumber(records, ["providerSubmitAllowed"]);
  const providerSubmitAllowedBoolean = readFirstBoolean(records, ["providerSubmitAllowed", "canSubmitProvider", "providerSubmitAllowedNow"]);
  const providerSubmitBlockedFlag = readFirstBoolean(records, [
    "providerSubmitLocked",
    "providerSubmitBlocked",
    "providerSubmissionForbidden",
    "noProviderSubmit",
  ]);
  const providerSubmitLocked = providerSubmitAllowedNumber === 0
    || providerSubmitAllowedBoolean === false
    || providerSubmitBlockedFlag === true;
  const providerSubmitDrift = (providerSubmitAllowedNumber !== undefined && providerSubmitAllowedNumber !== 0)
    || providerSubmitAllowedBoolean === true
    || providerSubmitBlockedFlag === false;
  const credentialLocked = readFirstBoolean(records, ["credentialAccessAllowed", "credentialReadAllowed", "credentialStorage"]) === false
    || records.some((record) => record.noCredentialRead === true || record.noCredentialWrite === true || record.credentialAccessBlocked === true);
  const workerLocked = readFirstBoolean(records, ["workerSpawnAllowed", "canSpawnWorker", "workerExecutionAllowed"]) === false
    || records.some((record) => record.noWorkerSpawn === true || record.workerSpawnBlocked === true);
  const fileLocked = readFirstBoolean(records, ["fileMutationAllowed", "canMutateFiles", "fileWriteAllowed"]) === false
    || records.some((record) => record.noFileMutation === true || record.fileMutationBlocked === true);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(finalActionGate.blockers, "blocker"),
    ...readDisplayList(finalActionGate.blockedReasons, "blocker"),
    ...handoffRecords.flatMap((row) => readDisplayList(row.blockers, "blocker")),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...readDisplayList(finalActionGate.warnings, "warning"),
    ...handoffRecords.flatMap((row) => readDisplayList(row.warnings, "warning")),
  ].filter(Boolean)));
  const hardLocks = buildProviderExecutionHandoffHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerExecutionHandoffReadinessLabel(status, initialized, handoffCount, blockedCount, confirmedCount),
    handoffCount,
    blockedCount,
    confirmedCount,
    providerSubmitLocked: providerSubmitLocked ? "provider submit locked" : providerSubmitDrift ? "provider submit drift" : "blocked/missing",
    credentialWorkerFileLocked: credentialLocked && workerLocked && fileLocked ? "credential/worker/file locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerExecutionHandoff"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerExecutionHandoff"],
  };
}

export function ProviderEnablementGateDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderEnablementGateUiSummary(runtimeState);

  return (
    <section className="machine-panel phase30-provider-gate-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Enablement Gate</span>
      </div>
      <div className="summary-grid phase30-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "read-only status" : "blocked/missing"} />
        <Metric label="Ready" value={`${summary.readyForConfirmation}`} detail="ready_for_confirmation" />
        <Metric label="Blocked" value={`${summary.blocked}`} detail={`${summary.parked} parked`} />
        <Metric label="Token" value={summary.confirmationTokenStatus} detail="confirmation placeholder" />
        <Metric label="Packet" value={summary.packetCompleteStatus} detail="enablement packet" />
        <Metric label="Closed Loop" value={summary.closedLoopStatus} detail="watcher / manifest / QA" />
      </div>
      <div className="phase30-summary-list">
        <div>
          <strong>Forbidden paths absent</strong>
          <small>{summary.forbiddenPathsAbsent}</small>
        </div>
        <div>
          <strong>Provider submit</strong>
          <small>{summary.canSubmitProvider} · {summary.submitBlocked}</small>
        </div>
        <div>
          <strong>Credential / live submit / shell</strong>
          <small>{summary.credentialLiveShellLocked}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase30-lock-strip" aria-label="Phase 30 Provider Enablement Gate hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

export function ProviderExecutionPermissionGateDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderExecutionPermissionGateUiSummary(runtimeState);

  return (
    <section className="machine-panel phase31-provider-permission-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Execution Permission Gate</span>
      </div>
      <div className="summary-grid phase31-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "confirmation shell" : "blocked/missing"} />
        <Metric label="Reviewable" value={`${summary.readyForUserReview}`} detail={`${summary.canAskUserToConfirm} can ask`} />
        <Metric label="Blocked" value={`${summary.blocked}`} detail={`${summary.parked} parked`} />
        <Metric label="Action Confirm" value={summary.actionTimeConfirmation} detail="not prefilled" />
        <Metric label="Auto Submit" value={summary.automaticSubmit} detail="manual gate only" />
        <Metric label="Provider Submit" value={summary.providerSubmit} detail="0 allowed" />
      </div>
      <div className="phase31-summary-list">
        <div>
          <strong>Credential / worker / file</strong>
          <small>{summary.credentialWorkerFileLocks}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase31-lock-strip" aria-label="Phase 31 Provider Execution Permission Gate hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

export function ProviderActionConfirmationReceiptDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderActionConfirmationReceiptUiSummary(runtimeState);

  return (
    <section className="machine-panel phase32-provider-action-receipt-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Action Confirmation Receipt</span>
      </div>
      <div className="summary-grid phase32-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "Phase 32 receipt shell" : "blocked/missing"} />
        <Metric label="Ready Receipts" value={`${summary.readyReceipts}`} detail={`${summary.parked} parked`} />
        <Metric label="Blocked" value={`${summary.blocked}`} detail="receipt blockers" />
        <Metric label="Confirmed Count" value={`${summary.confirmedCount}`} detail="action-time confirmations" />
        <Metric label="Provider Submit" value={summary.providerSubmitBlocked} detail="read-only" />
        <Metric label="Credential / Worker / File" value={summary.credentialWorkerFileLocked} detail="locked route summary" />
      </div>
      <div className="phase32-summary-list">
        <div>
          <strong>Receipt status</strong>
          <small>{summary.readyReceipts} ready receipt(s) · {summary.blocked} blocked · {summary.parked} parked · {summary.confirmedCount} confirmed</small>
        </div>
        <div>
          <strong>Provider submit blocked</strong>
          <small>{summary.providerSubmitBlocked}</small>
        </div>
        <div>
          <strong>Credential / worker / file locked</strong>
          <small>{summary.credentialWorkerFileLocked}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase32-lock-strip" aria-label="Phase 32 Provider Action Confirmation Receipt hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

export function ProviderExecutionHandoffDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderExecutionHandoffUiSummary(runtimeState);

  return (
    <section className="machine-panel phase33-provider-execution-handoff-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Execution Handoff</span>
      </div>
      <div className="summary-grid phase33-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "Phase 33 final action gate" : "blocked/missing"} />
        <Metric label="Handoff Count" value={`${summary.handoffCount}`} detail="handoff rows" />
        <Metric label="Blocked Count" value={`${summary.blockedCount}`} detail="handoff blockers" />
        <Metric label="Confirmed Count" value={`${summary.confirmedCount}`} detail="receipt-backed only" />
        <Metric label="Provider Submit" value={summary.providerSubmitLocked} detail="no live action" />
        <Metric label="Credential / Worker / File" value={summary.credentialWorkerFileLocked} detail="locked route summary" />
      </div>
      <div className="phase33-summary-list">
        <div>
          <strong>Final action gate</strong>
          <small>{summary.handoffCount} handoff(s) · {summary.blockedCount} blocked · {summary.confirmedCount} confirmed</small>
        </div>
        <div>
          <strong>Provider submit locked</strong>
          <small>{summary.providerSubmitLocked}</small>
        </div>
        <div>
          <strong>Credential / worker / file locked</strong>
          <small>{summary.credentialWorkerFileLocked}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase33-lock-strip" aria-label="Phase 33 Provider Execution Handoff hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

