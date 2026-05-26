import type { BaseHardLocks, ProviderSlot, RequiredMode } from "./types";

export const providerSubmitPermissionReceiptSchemaVersion = "0.1.0";

export type ProviderSubmitPermissionReceiptStatus = "pending_action_time_confirmation" | "blocked";
export type ProviderSubmitRequestState = "pending_action_time_confirmation";

export interface ProviderSubmitPermissionExpectedOutput {
  shotId: string;
  expectedOutputPath: string;
  providerObservationPath: string;
  semanticQaPath: string;
}

export interface ProviderSubmitPermissionCredential {
  credentialRef: string;
  authorizedReferenceOnly: true;
  secretMaterialPresent: false;
  credentialMaterialStored: false;
  credentialMaterialRead: false;
}

export interface ProviderSubmitPermissionSubmitIntent {
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  maxProviderCallsPerReceipt: 1;
  providerSubmitAllowed: 0;
  providerSubmitRequestState: ProviderSubmitRequestState;
}

export interface ProviderSubmitPermissionHardLocks extends BaseHardLocks {
  defaultLocked: true;
  actualExecutionAllowed: false;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  automaticSubmitAllowed: false;
  externalNetworkIoAllowed: false;
  credentialMaterialAccessAllowed: false;
  projectVibeMutationAllowed: false;
  maxConcurrency: 1;
  maxAutoRetries: 0;
}

export interface ProviderSubmitPermissionActionTimeConfirmation {
  required: true;
  userConfirmedAtActionTime: false;
  confirmationReceiptId?: string;
  confirmationCapturedAt?: string;
}

export interface ProviderSubmitPermissionReceiptState {
  schemaVersion: string;
  generatedAt: string;
  receiptId: string;
  handoffId: string;
  status: ProviderSubmitPermissionReceiptStatus;
  blockers: string[];
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  selectedShotIds: string[];
  expectedOutputs: ProviderSubmitPermissionExpectedOutput[];
  credential: ProviderSubmitPermissionCredential;
  submitIntent: ProviderSubmitPermissionSubmitIntent;
  actionTimeConfirmationRequired: true;
  actionTimeConfirmation: ProviderSubmitPermissionActionTimeConfirmation;
  promptPath?: string;
  promptSha256?: string;
  promptSnapshotPath?: string;
  maxProviderCallsPerReceipt: 1;
  providerCalled: false;
  runtimeProviderSubmitAttempted: false;
  runtimeExternalNetworkCallMade: false;
  projectVibeWritten: false;
  hardLocks: ProviderSubmitPermissionHardLocks;
  notes: string[];
}

export interface BuildProviderSubmitPermissionReceiptInput {
  generatedAt: string;
  receiptId: string;
  handoffId: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  selectedShotIds: string[];
  expectedOutputs: ProviderSubmitPermissionExpectedOutput[];
  credentialRef: string;
  maxProviderCallsPerReceipt: number;
  actionTimeConfirmation?: Partial<ProviderSubmitPermissionActionTimeConfirmation>;
  promptPath?: string;
  promptSha256?: string;
  promptSnapshotPath?: string;
}

export const providerSubmitPermissionReceiptHardLocks: ProviderSubmitPermissionHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  defaultLocked: true,
  actualExecutionAllowed: false,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  automaticSubmitAllowed: false,
  externalNetworkIoAllowed: false,
  credentialMaterialAccessAllowed: false,
  projectVibeMutationAllowed: false,
  maxConcurrency: 1,
  maxAutoRetries: 0,
};

const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key\s*[=:]|private[_-]?key|raw[-_ ]?secret)/i;
const credentialishKeyPattern = /(api[_-]?key|access[_-]?token|authorization|bearer|credential|secret|password|private[_-]?key|raw[_-]?credential)/i;

function compactUnique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function inspectForCredentialMaterial(value: unknown, parentKey = ""): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return rawSecretValuePattern.test(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => inspectForCredentialMaterial(item, parentKey));
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (key !== "credentialRef" && credentialishKeyPattern.test(key)) return true;
    return inspectForCredentialMaterial(child, key);
  });
}

function selectedShotsValid(selectedShotIds: string[]): boolean {
  return selectedShotIds.length >= 1
    && selectedShotIds.length <= 3
    && selectedShotIds.every((shotId) => typeof shotId === "string" && Boolean(shotId.trim()))
    && new Set(selectedShotIds).size === selectedShotIds.length;
}

function expectedOutputsMatch(
  selectedShotIds: string[],
  expectedOutputs: ProviderSubmitPermissionExpectedOutput[],
): boolean {
  if (expectedOutputs.length !== selectedShotIds.length) return false;
  const expectedShotIds = expectedOutputs.map((output) => output.shotId);
  if (expectedShotIds.some((shotId) => !selectedShotIds.includes(shotId))) return false;
  return expectedOutputs.every((output) =>
    Boolean(output.shotId?.trim())
    && Boolean(output.expectedOutputPath?.trim())
    && Boolean(output.providerObservationPath?.trim())
    && Boolean(output.semanticQaPath?.trim())
  );
}

export function buildProviderSubmitPermissionReceipt(
  input: BuildProviderSubmitPermissionReceiptInput,
): ProviderSubmitPermissionReceiptState {
  const selectedShotIds = Array.isArray(input.selectedShotIds)
    ? input.selectedShotIds.map((shotId) => String(shotId || "").trim()).filter(Boolean)
    : [];
  const expectedOutputs = Array.isArray(input.expectedOutputs)
    ? input.expectedOutputs.map((output) => ({
      shotId: String(output?.shotId || "").trim(),
      expectedOutputPath: String(output?.expectedOutputPath || "").trim(),
      providerObservationPath: String(output?.providerObservationPath || "").trim(),
      semanticQaPath: String(output?.semanticQaPath || "").trim(),
    }))
    : [];
  const credentialRef = String(input.credentialRef || "").trim();
  const blockers = compactUnique([
    input.receiptId ? undefined : "receiptId is required.",
    input.handoffId ? undefined : "handoffId is required.",
    input.providerId ? undefined : "providerId is required.",
    input.providerSlot ? undefined : "providerSlot is required.",
    input.requiredMode ? undefined : "requiredMode is required.",
    selectedShotsValid(selectedShotIds) ? undefined : "selectedShotIds must contain 1 to 3 unique shot ids.",
    expectedOutputsMatch(selectedShotIds, expectedOutputs) ? undefined : "expectedOutputs must align one-to-one with selectedShotIds.",
    credentialRef ? undefined : "credentialRef is required as an opaque reference.",
    rawSecretValuePattern.test(credentialRef) ? "credentialRef must be an opaque reference, not raw credential material." : undefined,
    input.maxProviderCallsPerReceipt === 1 ? undefined : "maxProviderCallsPerReceipt must equal 1.",
    inspectForCredentialMaterial(input) ? "Raw credential material or credential-like keys are forbidden." : undefined,
  ]);
  const status: ProviderSubmitPermissionReceiptStatus = blockers.length ? "blocked" : "pending_action_time_confirmation";

  return {
    schemaVersion: providerSubmitPermissionReceiptSchemaVersion,
    generatedAt: input.generatedAt,
    receiptId: input.receiptId,
    handoffId: input.handoffId,
    status,
    blockers,
    providerId: input.providerId,
    providerSlot: input.providerSlot,
    requiredMode: input.requiredMode,
    selectedShotIds,
    expectedOutputs,
    credential: {
      credentialRef,
      authorizedReferenceOnly: true,
      secretMaterialPresent: false,
      credentialMaterialStored: false,
      credentialMaterialRead: false,
    },
    submitIntent: {
      providerId: input.providerId,
      providerSlot: input.providerSlot,
      requiredMode: input.requiredMode,
      maxProviderCallsPerReceipt: 1,
      providerSubmitAllowed: 0,
      providerSubmitRequestState: "pending_action_time_confirmation",
    },
    actionTimeConfirmationRequired: true,
    actionTimeConfirmation: {
      required: true,
      userConfirmedAtActionTime: false,
      confirmationReceiptId: input.actionTimeConfirmation?.confirmationReceiptId,
      confirmationCapturedAt: input.actionTimeConfirmation?.confirmationCapturedAt,
    },
    promptPath: input.promptPath,
    promptSha256: input.promptSha256,
    promptSnapshotPath: input.promptSnapshotPath,
    maxProviderCallsPerReceipt: 1,
    providerCalled: false,
    runtimeProviderSubmitAttempted: false,
    runtimeExternalNetworkCallMade: false,
    projectVibeWritten: false,
    hardLocks: providerSubmitPermissionReceiptHardLocks,
    notes: [
      "This receipt records small-batch provider submit permission intent only.",
      "It does not submit providers, read credentials, spawn workers, perform network IO, or mutate project.vibe.",
      "A later action-time confirmation and execution gate must still remain explicit.",
    ],
  };
}
