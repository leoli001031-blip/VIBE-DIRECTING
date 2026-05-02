import type { Image2OneShotRealCallPayload } from "./providerAdapters/image2Adapter";
import type { RealProviderOneShotState, RealProviderOneShotStatus, RealProviderOneShotUserReadableStatus } from "./realProviderOneShot";

export const realProviderTransportSchemaVersion = "0.1.0";

export type RealProviderTransportMode = "mock_dry_run" | "manual_real_transport";

export type RealProviderTransportPlanStatus =
  | "blocked"
  | "mock_submit_ready"
  | "requires_external_action"
  | "ready_for_manual_transport";

export type RealProviderTransportReceiptStatus =
  | "blocked"
  | "mock_submitted"
  | "requires_external_action"
  | "ready_for_manual_transport";

export type RealProviderTransportResultStatus =
  | "blocked"
  | "waiting_for_file"
  | "provider_call_failed"
  | "output_missing"
  | "needs_review";

export interface RealProviderTransportPlanInput {
  generatedAt: string;
  oneShotState: Pick<
    RealProviderOneShotState,
    "status" | "userReadableStatus" | "summary" | "compiledPayload" | "blockers" | "warnings" | "gateEvidence"
  >;
  transportMode?: RealProviderTransportMode;
  credentialRef?: string;
  attemptNumber?: number;
  manualTransportAcknowledged?: boolean;
}

export interface RealProviderTransportPlan {
  schemaVersion: string;
  generatedAt: string;
  phase: "round_5_real_provider_transport_contract";
  status: RealProviderTransportPlanStatus;
  transportMode: RealProviderTransportMode;
  userReadableStatus: RealProviderOneShotUserReadableStatus;
  userMessage: string;
  payload?: Image2OneShotRealCallPayload;
  credential: {
    credentialRef?: string;
    authorizedReferenceOnly: true;
    secretMaterialPresent: false;
    source: "compiled_payload" | "explicit_reference" | "missing";
  };
  attempt: {
    attemptNumber: number;
    maxProviderSubmits: 1;
    providerSubmitsRemaining: 0 | 1;
    maxAutoRetries: 0;
    automaticRetryAllowed: false;
  };
  transportPolicy: {
    mockDryRunDefault: true;
    automaticProviderSubmitAllowed: false;
    externalNetworkIoAllowed: false;
    arbitraryShellAllowed: false;
    credentialMaterialAccessAllowed: false;
    scopedSandboxOnly: true;
    outsideSandboxWriteAllowed: false;
    outputReturnPath: "watcher_manifest_qa";
    providerSelfReportCanComplete: false;
  };
  outputContract?: {
    expectedOutputPath: string;
    sandboxRoot: string;
    manifestPath: string;
    qaReportPath: string;
    mustReturnThroughWatcher: true;
    mustMatchManifest: true;
    mustPassQa: true;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

export interface RealProviderTransportReceiptInput {
  generatedAt: string;
  plan: RealProviderTransportPlan;
  providerAccepted?: boolean;
  providerTaskRef?: string;
  providerSelfReportedComplete?: boolean;
  providerErrorMessage?: string;
}

export interface RealProviderTransportReceipt {
  schemaVersion: string;
  generatedAt: string;
  phase: "round_5_real_provider_transport_receipt";
  status: RealProviderTransportReceiptStatus;
  transportMode: RealProviderTransportMode;
  userReadableStatus: RealProviderOneShotUserReadableStatus;
  userMessage: string;
  providerTaskRef?: string;
  providerSelfReportedComplete: boolean;
  providerSelfReportIgnoredForCompletion: true;
  attempt: RealProviderTransportPlan["attempt"];
  outputContract?: RealProviderTransportPlan["outputContract"];
  blockers: string[];
  warnings: string[];
  notes: string[];
}

export interface RealProviderTransportResultInput {
  generatedAt: string;
  receipt: RealProviderTransportReceipt;
  watcherExpectedOutputDetected?: boolean;
  manifestMatched?: boolean;
  qaPassed?: boolean;
  providerErrorMessage?: string;
}

export interface RealProviderTransportResult {
  schemaVersion: string;
  generatedAt: string;
  phase: "round_5_real_provider_transport_result";
  status: RealProviderTransportResultStatus;
  userReadableStatus: RealProviderOneShotUserReadableStatus;
  userMessage: string;
  gateEvidence: {
    watcherExpectedOutputDetected: boolean;
    manifestMatched: boolean;
    qaPassed: boolean;
    providerSelfReportIgnoredForCompletion: true;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

const readyStatuses = new Set<RealProviderOneShotStatus>(["ready_to_submit"]);
const secretKeyPattern = /(api[_-]?key|access[_-]?token|secret|password|bearer|credentialmaterial|rawcredential|private[_-]?key)/i;
const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key=|private[_-]?key|raw-secret)/i;

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function inspectForRawCredentialMaterial(value: unknown, keyPath = ""): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return rawSecretValuePattern.test(value);
  if (typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item, index) => inspectForRawCredentialMaterial(item, `${keyPath}[${index}]`));
  }

  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    const nextKeyPath = keyPath ? `${keyPath}.${key}` : key;
    if (key !== "credentialRef" && secretKeyPattern.test(key)) return true;
    return inspectForRawCredentialMaterial(child, nextKeyPath);
  });
}

function credentialRefFor(input: RealProviderTransportPlanInput): RealProviderTransportPlan["credential"] {
  const payloadRef = input.oneShotState.compiledPayload?.credentialRef;
  const explicitRef = input.credentialRef;
  return {
    credentialRef: explicitRef || payloadRef,
    authorizedReferenceOnly: true,
    secretMaterialPresent: false,
    source: explicitRef ? "explicit_reference" : payloadRef ? "compiled_payload" : "missing",
  };
}

function baseTransportPolicy(): RealProviderTransportPlan["transportPolicy"] {
  return {
    mockDryRunDefault: true,
    automaticProviderSubmitAllowed: false,
    externalNetworkIoAllowed: false,
    arbitraryShellAllowed: false,
    credentialMaterialAccessAllowed: false,
    scopedSandboxOnly: true,
    outsideSandboxWriteAllowed: false,
    outputReturnPath: "watcher_manifest_qa",
    providerSelfReportCanComplete: false,
  };
}

function outputContractFor(payload?: Image2OneShotRealCallPayload): RealProviderTransportPlan["outputContract"] | undefined {
  if (!payload) return undefined;
  return {
    expectedOutputPath: payload.output.path,
    sandboxRoot: payload.output.sandboxRoot,
    manifestPath: payload.output.manifestPath,
    qaReportPath: payload.output.qaReportPath,
    mustReturnThroughWatcher: true,
    mustMatchManifest: true,
    mustPassQa: true,
  };
}

function planBlockers(input: RealProviderTransportPlanInput, credential: RealProviderTransportPlan["credential"], attemptNumber: number): string[] {
  const oneShotState = input.oneShotState;
  const payload = oneShotState.compiledPayload;
  return uniqueSorted([
    payload ? "" : "Compiled Image2 one-shot payload is required before transport planning.",
    readyStatuses.has(oneShotState.status) ? "" : "Transport can only plan from ready_to_submit one-shot state.",
    oneShotState.summary.providerSubmitAllowed === 1 ? "" : "One-shot summary must allow exactly one provider submit.",
    oneShotState.summary.maxProviderSubmits === 1 ? "" : "Transport contract requires maxProviderSubmits=1.",
    oneShotState.summary.maxAutoRetries === 0 ? "" : "Transport contract requires maxAutoRetries=0.",
    oneShotState.summary.arbitraryShellAllowed === false ? "" : "Arbitrary shell execution must be forbidden.",
    oneShotState.summary.outsideSandboxWriteAllowed === false ? "" : "Transport output must stay in the scoped sandbox.",
    oneShotState.summary.outputMayCompleteFromProviderSelfReport === false ? "" : "Provider self-report cannot complete transport output.",
    credential.credentialRef ? "" : "Credential reference is required; raw credential material is forbidden.",
    payload && credential.credentialRef && credential.credentialRef !== payload.credentialRef ? "Credential reference must match the compiled payload reference." : "",
    inspectForRawCredentialMaterial(input) ? "Raw credential material is forbidden; use an authorized credentialRef only." : "",
    attemptNumber <= 1 ? "" : "Transport contract allows exactly one provider submit attempt.",
    payload?.executionPolicy.maxProviderSubmits === 1 ? "" : "Compiled payload must cap maxProviderSubmits at one.",
    payload?.executionPolicy.maxAutoRetries === 0 ? "" : "Compiled payload must forbid automatic retries.",
    payload?.executionPolicy.arbitraryShellAllowed === false ? "" : "Compiled payload must forbid arbitrary shell execution.",
    payload?.executionPolicy.scopedSandboxOnly === true ? "" : "Compiled payload must require scoped sandbox output.",
    payload?.executionPolicy.outputMayCompleteFromProviderSelfReport === false ? "" : "Compiled payload must require watcher/manifest/QA completion.",
  ]);
}

function planStatusFor(input: RealProviderTransportPlanInput, blockers: string[]): RealProviderTransportPlanStatus {
  if (blockers.length > 0) return "blocked";
  if (input.transportMode === "manual_real_transport") {
    return input.manualTransportAcknowledged ? "ready_for_manual_transport" : "requires_external_action";
  }
  return "mock_submit_ready";
}

function planMessageFor(status: RealProviderTransportPlanStatus): string {
  if (status === "mock_submit_ready") return "Mock transport is ready. It will create a receipt only, then wait for watcher/manifest/QA evidence.";
  if (status === "requires_external_action") return "Manual real transport requires an external user action; the app must not call the provider automatically.";
  if (status === "ready_for_manual_transport") return "Manual real transport is prepared for user-operated submission outside automatic transport.";
  return "Transport planning is blocked by hard safety constraints.";
}

export function buildRealProviderTransportPlan(input: RealProviderTransportPlanInput): RealProviderTransportPlan {
  const transportMode = input.transportMode || "mock_dry_run";
  const attemptNumber = input.attemptNumber ?? 0;
  const credential = credentialRefFor(input);
  const blockers = planBlockers(input, credential, attemptNumber);
  const status = planStatusFor({ ...input, transportMode }, blockers);
  const payload = blockers.length === 0 ? input.oneShotState.compiledPayload : undefined;

  return {
    schemaVersion: realProviderTransportSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "round_5_real_provider_transport_contract",
    status,
    transportMode,
    userReadableStatus: status === "blocked" ? "需要复核" : "准备调用",
    userMessage: planMessageFor(status),
    payload,
    credential,
    attempt: {
      attemptNumber,
      maxProviderSubmits: 1,
      providerSubmitsRemaining: status === "mock_submit_ready" || status === "ready_for_manual_transport" ? 1 : 0,
      maxAutoRetries: 0,
      automaticRetryAllowed: false,
    },
    transportPolicy: baseTransportPolicy(),
    outputContract: outputContractFor(payload),
    blockers,
    warnings: uniqueSorted([
      ...input.oneShotState.warnings,
      transportMode === "manual_real_transport" ? "Manual real transport is only a handoff state; automatic provider calls remain forbidden." : "",
    ]),
    notes: [
      "Default transport is mock dry-run and creates no provider side effects.",
      "Real provider transport can only be represented as manual/external action states in this core contract.",
      "Outputs must return through watcher, manifest, and QA evidence before completion.",
    ],
  };
}

export function buildRealProviderTransportReceipt(input: RealProviderTransportReceiptInput): RealProviderTransportReceipt {
  const plan = input.plan;
  const blocked = plan.status === "blocked" || plan.blockers.length > 0;
  const status: RealProviderTransportReceiptStatus = blocked
    ? "blocked"
    : plan.status === "mock_submit_ready"
      ? "mock_submitted"
      : plan.status;
  const providerFailed = Boolean(input.providerErrorMessage);

  return {
    schemaVersion: realProviderTransportSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "round_5_real_provider_transport_receipt",
    status,
    transportMode: plan.transportMode,
    userReadableStatus: blocked ? "需要复核" : providerFailed ? "调用失败" : status === "mock_submitted" ? "等待文件" : "准备调用",
    userMessage: blocked
      ? "Transport receipt cannot be created from a blocked plan."
      : providerFailed
        ? input.providerErrorMessage || "Provider transport failed."
        : status === "mock_submitted"
          ? "Mock submit receipt recorded; waiting for watcher/manifest/QA output evidence."
          : "Manual/external transport remains outside automatic execution.",
    providerTaskRef: input.providerTaskRef,
    providerSelfReportedComplete: Boolean(input.providerSelfReportedComplete),
    providerSelfReportIgnoredForCompletion: true,
    attempt: {
      ...plan.attempt,
      attemptNumber: status === "mock_submitted" ? 1 : plan.attempt.attemptNumber,
      providerSubmitsRemaining: 0,
    },
    outputContract: plan.outputContract,
    blockers: uniqueSorted([
      ...plan.blockers,
      providerFailed ? input.providerErrorMessage : "",
    ]),
    warnings: uniqueSorted([
      ...plan.warnings,
      input.providerSelfReportedComplete ? "Provider self-report is stored as a receipt signal only and cannot complete output." : "",
    ]),
    notes: [
      "Receipt does not prove output availability.",
      "The next valid state must come from watcher, manifest, and QA evidence.",
    ],
  };
}

export function buildRealProviderTransportResult(input: RealProviderTransportResultInput): RealProviderTransportResult {
  const receipt = input.receipt;
  const providerFailed = Boolean(input.providerErrorMessage || receipt.blockers.length > 0);
  const watcherDetected = Boolean(input.watcherExpectedOutputDetected);
  const manifestMatched = Boolean(input.manifestMatched);
  const qaPassed = Boolean(input.qaPassed);
  const outputReturned = watcherDetected && manifestMatched;
  const completeEvidence = outputReturned && qaPassed;
  const status: RealProviderTransportResultStatus = receipt.status === "blocked"
    ? "blocked"
    : providerFailed
      ? "provider_call_failed"
      : completeEvidence
        ? "needs_review"
        : receipt.providerSelfReportedComplete && !outputReturned
          ? "output_missing"
          : "waiting_for_file";

  return {
    schemaVersion: realProviderTransportSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "round_5_real_provider_transport_result",
    status,
    userReadableStatus: status === "provider_call_failed" ? "调用失败" : status === "output_missing" ? "输出缺失" : status === "waiting_for_file" ? "等待文件" : "需要复核",
    userMessage: status === "provider_call_failed"
      ? input.providerErrorMessage || "Provider transport failed and needs review before any new action."
      : status === "output_missing"
        ? "Provider self-reported completion, but watcher/manifest output evidence is missing."
        : status === "waiting_for_file"
          ? "Transport receipt exists; waiting for expected sandbox output through watcher/manifest/QA."
          : "Output evidence has returned through watcher/manifest/QA and now requires human review.",
    gateEvidence: {
      watcherExpectedOutputDetected: watcherDetected,
      manifestMatched,
      qaPassed,
      providerSelfReportIgnoredForCompletion: true,
    },
    blockers: uniqueSorted([
      ...receipt.blockers,
      status === "blocked" ? "Transport result cannot advance from a blocked receipt." : "",
      providerFailed ? input.providerErrorMessage || "Provider transport failed." : "",
    ]),
    warnings: uniqueSorted([
      ...receipt.warnings,
      receipt.providerSelfReportedComplete && !outputReturned ? "Provider self-report did not satisfy watcher/manifest output evidence." : "",
      completeEvidence ? "Formal acceptance remains a human review step after QA evidence." : "",
    ]),
    notes: [
      "Result cannot become complete from provider status alone.",
      "Watcher, manifest, and QA are the only output return channel in this contract.",
    ],
  };
}
