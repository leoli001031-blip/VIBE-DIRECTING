export const realImage2ExecutorAdapterSchemaVersion = "0.1.0";

export type RealImage2ExecutorAdapterMode = "mock_executor" | "dry_run_executor" | "real_provider_call";

export type RealImage2ExecutorAdapterStatus =
  | "executor_ready_mock"
  | "dry_run_executor_ready"
  | "mock_output_returned_needs_review"
  | "blocked";

export type RealImage2ExecutorAdapterCheckStatus = "passed" | "blocked";

export interface RealImage2ExecutorExplicitRealGate {
  explicitUserConfirmed?: boolean;
  allowRealProviderCall?: boolean;
  confirmationScope?: "single_image2_one_shot";
  maxProviderCalls?: 1;
  mainThreadFinalConfirmation?: true;
}

export interface RealImage2ExecutorAdapterInput {
  generatedAt: string;
  mode?: string;
  selectedShotId?: string;
  receiptId?: string;
  expectedOutputPath?: string;
  persistedPrepareReceipt?: unknown;
  persistedHandoffPacket?: unknown;
  realProviderGate?: RealImage2ExecutorExplicitRealGate;
  outputReturned?: boolean;
  providerObservationPath?: string;
  semanticQaPath?: string;
  manifestPath?: string;
  qaReportPath?: string;
}

export interface RealImage2ExecutorAdapterCheck {
  checkId: string;
  status: RealImage2ExecutorAdapterCheckStatus;
  blocker?: string;
}

export interface RealImage2ExecutorAdapterOutputReturnContract {
  expectedOutputPath?: string;
  sandboxRoot?: string;
  shotRoot?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  manifestPath?: string;
  qaReportPath?: string;
  watcherProjection: {
    expectedOutputDetected: boolean;
    watcherStarted: false;
    daemonStarted: false;
    source: "mock_executor_sandbox_write" | "dry_run_projection_only";
  };
  providerObservation: {
    providerId: "openai-image2-api";
    providerObservationMode: "mock_readiness_evidence" | "not_observed";
    providerCalled: false;
    externalNetworkCallMade: false;
  };
  manifest: {
    manifestMatched: boolean;
    status: "mock_output_present" | "not_written";
  };
  semanticQa: {
    semanticReviewMode: "mock_executor_semantic_review" | "not_observed";
    status: "needs_review" | "not_written";
  };
  previewProjection: {
    status: "mock_output_returned_needs_review" | "executor_ready_mock" | "dry_run_executor_ready" | "blocked";
    needsHumanReview: boolean;
  };
}

export interface RealImage2ExecutorAdapterContract {
  schemaVersion: typeof realImage2ExecutorAdapterSchemaVersion;
  generatedAt: string;
  phase: "real_image2_executor_adapter_contract";
  mode: RealImage2ExecutorAdapterMode;
  status: RealImage2ExecutorAdapterStatus;
  selectedShotId?: string;
  receiptId?: string;
  expectedOutputPath?: string;
  checks: RealImage2ExecutorAdapterCheck[];
  outputReturnContract: RealImage2ExecutorAdapterOutputReturnContract;
  providerCallContract: {
    maxProviderCallsPerExecution: 1;
    providerCallsAttempted: 0;
    providerCalled: false;
    externalNetworkIoAllowed: false;
    rawCredentialAccessAllowed: false;
    workerSpawnAllowed: false;
    projectVibeMutationAllowed: false;
    realProviderCallRequiresExplicitGate: true;
    realProviderGateSatisfied: boolean;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

type JsonRecord = Record<string, unknown>;

const allowedModes = new Set<RealImage2ExecutorAdapterMode>(["mock_executor", "dry_run_executor", "real_provider_call"]);
const secretKeyPattern = /(api[_-]?key|access[_-]?token|secret|password|bearer|credentialmaterial|rawcredential|private[_-]?key)/i;
const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key=|private[_-]?key|raw-secret)/i;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function normalizePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function pathHasTraversal(value: string | undefined): boolean {
  const normalized = normalizePath(value);
  return !normalized || normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../");
}

function pathInsideRoot(candidate: string | undefined, root: string | undefined): boolean {
  const normalizedCandidate = normalizePath(candidate);
  const normalizedRoot = normalizePath(root);
  if (!normalizedCandidate || !normalizedRoot || pathHasTraversal(normalizedCandidate) || pathHasTraversal(normalizedRoot)) return false;
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function inspectForRawCredentialMaterial(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return rawSecretValuePattern.test(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => inspectForRawCredentialMaterial(item));
  return Object.entries(value as JsonRecord).some(([key, child]) => {
    if (key !== "credentialRef" && secretKeyPattern.test(key)) return true;
    return inspectForRawCredentialMaterial(child);
  });
}

function nestedRecord(root: JsonRecord, key: string): JsonRecord {
  return asRecord(root[key]);
}

function realProviderGateSatisfied(gate: RealImage2ExecutorExplicitRealGate | undefined): boolean {
  return Boolean(
    gate &&
      gate.explicitUserConfirmed === true &&
      gate.allowRealProviderCall === true &&
      gate.confirmationScope === "single_image2_one_shot" &&
      gate.maxProviderCalls === 1 &&
      gate.mainThreadFinalConfirmation === true,
  );
}

function check(checkId: string, passed: boolean, blocker: string): RealImage2ExecutorAdapterCheck {
  return {
    checkId,
    status: passed ? "passed" : "blocked",
    blocker: passed ? undefined : blocker,
  };
}

function providerLockChecks(receipt: JsonRecord, handoff: JsonRecord, transportPlan: JsonRecord, appServerContract: JsonRecord): RealImage2ExecutorAdapterCheck[] {
  const policy = nestedRecord(receipt, "policy");
  return [
    check("receipt_provider_called_false", policy.providerCalled === false, "Persisted prepare receipt must keep providerCalled=false."),
    check("receipt_provider_submit_zero", policy.providerSubmitAllowed === 0, "Persisted prepare receipt must keep providerSubmitAllowed=0."),
    check("receipt_automatic_submit_false", policy.automaticSubmitAllowed === false, "Persisted prepare receipt must keep automaticSubmitAllowed=false."),
    check("receipt_live_submit_false", policy.liveSubmitAllowed === false, "Persisted prepare receipt must keep liveSubmitAllowed=false."),
    check("receipt_external_network_false", policy.externalNetworkIoAllowed === false, "Persisted prepare receipt must keep externalNetworkIoAllowed=false."),
    check("receipt_worker_spawn_forbidden", policy.workerSpawnForbidden === true, "Persisted prepare receipt must keep workerSpawnForbidden=true."),
    check("receipt_project_vibe_not_written", policy.projectVibeWritten === false, "Persisted prepare receipt must keep projectVibeWritten=false."),
    check("handoff_provider_called_false", handoff.providerCalled === false, "Persisted handoff packet must keep providerCalled=false."),
    check("handoff_live_submit_false", handoff.liveSubmitAllowed === false, "Persisted handoff packet must keep liveSubmitAllowed=false."),
    check("handoff_worker_spawn_forbidden", handoff.workerSpawnForbidden === true, "Persisted handoff packet must keep workerSpawnForbidden=true."),
    check("handoff_project_vibe_not_written", handoff.projectVibeWritten === false, "Persisted handoff packet must keep projectVibeWritten=false."),
    check("transport_actual_execution_false", transportPlan.actualExecutionAllowed === false, "Handoff transport plan must keep actualExecutionAllowed=false."),
    check("transport_provider_called_false", transportPlan.providerCalled === false, "Handoff transport plan must keep providerCalled=false."),
    check("transport_live_submit_false", transportPlan.liveSubmitAllowed === false, "Handoff transport plan must keep liveSubmitAllowed=false."),
    check("transport_worker_spawn_forbidden", transportPlan.workerSpawnForbidden === true, "Handoff transport plan must keep workerSpawnForbidden=true."),
    check("app_server_manual_transport_required", appServerContract.manualTransportRequired === true, "App-server contract must require manual transport."),
    check("app_server_automatic_submit_false", appServerContract.automaticSubmitAllowed === false, "App-server contract must keep automaticSubmitAllowed=false."),
    check("app_server_actual_execution_false", appServerContract.actualExecutionAllowed === false, "App-server contract must keep actualExecutionAllowed=false."),
  ];
}

export function buildRealImage2ExecutorAdapterContract(input: RealImage2ExecutorAdapterInput): RealImage2ExecutorAdapterContract {
  const rawMode = asString(input.mode) || "dry_run_executor";
  const mode: RealImage2ExecutorAdapterMode = allowedModes.has(rawMode as RealImage2ExecutorAdapterMode)
    ? rawMode as RealImage2ExecutorAdapterMode
    : "dry_run_executor";
  const receipt = asRecord(input.persistedPrepareReceipt);
  const handoff = asRecord(input.persistedHandoffPacket);
  const receiptSandbox = nestedRecord(receipt, "sandbox");
  const transportPlan = nestedRecord(handoff, "transportPlan");
  const appServerContract = nestedRecord(handoff, "appServerContract");
  const expectedOutputPath = normalizePath(asString(handoff.expectedOutputPath) || asString(receipt.expectedOutputPath));
  const selectedShotId = asString(handoff.selectedShotId) || asString(receipt.selectedShotId);
  const receiptId = asString(handoff.receiptId) || asString(receipt.receiptId);
  const sandboxRoot = normalizePath(asString(receiptSandbox.root));
  const shotRoot = normalizePath(asString(receiptSandbox.shotRoot));
  const providerObservationPath = normalizePath(input.providerObservationPath || asString(handoff.providerObservationPath) || asString(receipt.providerObservationPath));
  const semanticQaPath = normalizePath(input.semanticQaPath || asString(handoff.semanticQaPath) || asString(receipt.semanticQaPath));
  const manifestPath = normalizePath(input.manifestPath || asString(receiptSandbox.manifestPath));
  const qaReportPath = normalizePath(input.qaReportPath || asString(receiptSandbox.qaReportPath));
  const requestedOutputPath = normalizePath(input.expectedOutputPath);
  const gateSatisfied = realProviderGateSatisfied(input.realProviderGate);

  const checks: RealImage2ExecutorAdapterCheck[] = [
    check("mode_allowlisted", allowedModes.has(rawMode as RealImage2ExecutorAdapterMode), "Executor mode must be mock_executor, dry_run_executor, or explicitly gated real_provider_call."),
    check("persisted_prepare_receipt_present", isRecord(input.persistedPrepareReceipt), "Persisted prepare receipt is required."),
    check("persisted_handoff_packet_present", isRecord(input.persistedHandoffPacket), "Persisted handoff packet is required."),
    check("prepare_receipt_schema", receipt.schemaVersion === "vibe_core_current_project_image2_one_shot_receipt_v1", "Persisted prepare receipt schema is not recognized."),
    check("prepare_receipt_status", receipt.status === "prepared", "Persisted prepare receipt must have status=prepared."),
    check("handoff_schema", handoff.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1", "Persisted handoff packet schema is not recognized."),
    check("handoff_status", handoff.status === "ready_for_manual_transport", "Persisted handoff packet must have status=ready_for_manual_transport."),
    check("handoff_receipt_id_matches", asString(handoff.receiptId) === asString(receipt.receiptId), "Handoff receiptId must match the persisted prepare receipt."),
    check("handoff_packet_id_matches", asString(handoff.packetId) === `handoff_${asString(receipt.receiptId) || ""}`, "Handoff packetId must derive from receiptId."),
    check("selected_shot_matches", asString(handoff.selectedShotId) === asString(receipt.selectedShotId), "Handoff selectedShotId must match the persisted prepare receipt."),
    check("expected_output_matches", normalizePath(asString(handoff.expectedOutputPath)) === normalizePath(asString(receipt.expectedOutputPath)), "Handoff expectedOutputPath must match the persisted prepare receipt."),
    check("request_selected_shot_matches", !input.selectedShotId || input.selectedShotId === selectedShotId, "Requested selectedShotId must match persisted handoff packet."),
    check("request_receipt_id_matches", !input.receiptId || input.receiptId === receiptId, "Requested receiptId must match persisted prepare receipt."),
    check("request_expected_output_matches", !requestedOutputPath || requestedOutputPath === expectedOutputPath, "Requested expectedOutputPath must match persisted handoff packet."),
    check("sandbox_root_present", Boolean(sandboxRoot), "Persisted prepare receipt sandbox.root is required."),
    check("shot_root_inside_sandbox", pathInsideRoot(shotRoot, sandboxRoot), "Persisted prepare receipt shotRoot must stay inside sandbox.root."),
    check("expected_output_inside_sandbox", pathInsideRoot(expectedOutputPath, sandboxRoot) && pathInsideRoot(expectedOutputPath, shotRoot), "Expected output path must stay inside the one-shot sandbox."),
    check("provider_observation_inside_sandbox", pathInsideRoot(providerObservationPath, sandboxRoot) && pathInsideRoot(providerObservationPath, shotRoot), "Provider observation path must stay inside the one-shot sandbox."),
    check("semantic_qa_inside_sandbox", pathInsideRoot(semanticQaPath, sandboxRoot) && pathInsideRoot(semanticQaPath, shotRoot), "Semantic QA path must stay inside the one-shot sandbox."),
    check("manifest_inside_sandbox", pathInsideRoot(manifestPath, sandboxRoot) && pathInsideRoot(manifestPath, shotRoot), "Manifest path must stay inside the one-shot sandbox."),
    check("qa_report_inside_sandbox", pathInsideRoot(qaReportPath, sandboxRoot) && pathInsideRoot(qaReportPath, shotRoot), "QA report path must stay inside the one-shot sandbox."),
    check("receipt_state_inside_sandbox", pathInsideRoot(asString(receiptSandbox.receiptStatePath), sandboxRoot) && pathInsideRoot(asString(receiptSandbox.receiptStatePath), shotRoot), "Receipt state path must stay inside the one-shot sandbox."),
    check("handoff_state_inside_sandbox", pathInsideRoot(asString(receiptSandbox.handoffStatePath), sandboxRoot) && pathInsideRoot(asString(receiptSandbox.handoffStatePath), shotRoot), "Handoff state path must stay inside the one-shot sandbox."),
    check("transport_mode_agent_app_server", transportPlan.mode === "agent_app_server", "Executor can only consume agent_app_server handoff transport."),
    check("transport_target_agent_app_server", transportPlan.target === "agent_app_server", "Executor can only consume agent_app_server target handoffs."),
    check("transport_endpoint_agent_app_server", transportPlan.endpoint === "/api/agent/app-server/image2/one-shot", "Agent app-server handoff endpoint drifted."),
    check("transport_prepared_only", transportPlan.externalCallPreparedOnly === true, "Agent app-server handoff must remain prepared-only before executor consumption."),
    check("app_server_contract_mode", appServerContract.mode === "agent_app_server_handoff_only", "App-server contract mode must remain handoff-only."),
    check("requires_external_action", handoff.requiresExternalAction === true, "Handoff packet must require an external action boundary."),
    check("one_shot_only", receipt.oneShotOnly === true && asNumber(receipt.imageCount) === 1, "Executor contract only consumes one shot and one image per handoff."),
    check("raw_credentials_absent", !inspectForRawCredentialMaterial(input), "Raw credential material is forbidden; executor may only see scoped references."),
    ...providerLockChecks(receipt, handoff, transportPlan, appServerContract),
  ];

  if (mode === "real_provider_call") {
    checks.push(
      check("real_provider_gate_satisfied", gateSatisfied, "Real provider call mode requires an explicit single-call main-thread gate."),
      check("real_provider_runtime_blocked", false, "Real provider execution remains blocked in this adapter until the main thread explicitly enables a live provider implementation."),
    );
  }

  const blockers = uniqueSorted(checks.map((item) => item.blocker));
  const outputReturned = input.outputReturned === true && mode === "mock_executor" && blockers.length === 0;
  const status: RealImage2ExecutorAdapterStatus = blockers.length
    ? "blocked"
    : outputReturned
      ? "mock_output_returned_needs_review"
      : mode === "mock_executor"
        ? "executor_ready_mock"
        : "dry_run_executor_ready";

  return {
    schemaVersion: realImage2ExecutorAdapterSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "real_image2_executor_adapter_contract",
    mode,
    status,
    selectedShotId,
    receiptId,
    expectedOutputPath,
    checks,
    outputReturnContract: {
      expectedOutputPath,
      sandboxRoot,
      shotRoot,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      watcherProjection: {
        expectedOutputDetected: outputReturned,
        watcherStarted: false,
        daemonStarted: false,
        source: mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
      },
      providerObservation: {
        providerId: "openai-image2-api",
        providerObservationMode: outputReturned ? "mock_readiness_evidence" : "not_observed",
        providerCalled: false,
        externalNetworkCallMade: false,
      },
      manifest: {
        manifestMatched: outputReturned,
        status: outputReturned ? "mock_output_present" : "not_written",
      },
      semanticQa: {
        semanticReviewMode: outputReturned ? "mock_executor_semantic_review" : "not_observed",
        status: outputReturned ? "needs_review" : "not_written",
      },
      previewProjection: {
        status,
        needsHumanReview: outputReturned,
      },
    },
    providerCallContract: {
      maxProviderCallsPerExecution: 1,
      providerCallsAttempted: 0,
      providerCalled: false,
      externalNetworkIoAllowed: false,
      rawCredentialAccessAllowed: false,
      workerSpawnAllowed: false,
      projectVibeMutationAllowed: false,
      realProviderCallRequiresExplicitGate: true,
      realProviderGateSatisfied: gateSatisfied,
    },
    blockers,
    warnings: uniqueSorted([
      mode === "mock_executor" ? "Mock executor may write only test output and sidecars inside the one-shot sandbox." : "",
      mode === "dry_run_executor" ? "Dry-run executor validates the handoff but does not write output files." : "",
      outputReturned ? "Mock output is review evidence only and is not a real provider result." : "",
    ]),
    notes: [
      "Executor input must be the persisted prepare receipt plus persisted handoff packet.",
      "The adapter allows at most one provider call by contract, but this mock/dry-run implementation attempts zero provider calls.",
      "Completion must flow through output, provider observation, manifest, semantic QA, and preview projection evidence.",
    ],
  };
}
