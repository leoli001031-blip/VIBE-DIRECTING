import type { ManifestMatchReport } from "./manifestMatcher";
import type {
  ExecutionLedgerOutputSandbox,
  ExecutionLedgerState,
  ExecutionLedgerStatus,
  ExecutionLedgerTaskView,
} from "./executionLedger";
import type { GenerationHarnessState, ImageTaskPlan, ProviderSlot, QaHarnessState, RequiredMode } from "./types";
import type { LocalOrchestratorState } from "./localOrchestrator";
import type { ProviderExecutionHandoffState } from "./providerExecutionHandoff";

export const realExecutionGateSchemaVersion = "0.1.0";

export type RealExecutionGateMode = "locked" | "scoped_real_test";
export type RealExecutionGateStatus = "locked" | "blocked" | "ready_for_scoped_real_test_review";
export type RealExecutionGateCheckId =
  | "selected_project"
  | "selected_batch"
  | "selected_shot"
  | "validated_envelope"
  | "output_sandbox"
  | "manifest_ready"
  | "qa_ready"
  | "ledger_ready"
  | "provider_routes_closed"
  | "worker_spawn_closed"
  | "credential_routes_closed";

export interface RealExecutionGateCheck {
  checkId: RealExecutionGateCheckId;
  label: string;
  required: true;
  passed: boolean;
  blocker?: string;
  sourceRef?: string;
}

export interface RealExecutionGateItem {
  gateItemId: string;
  projectId: string;
  batchId?: string;
  shotId?: string;
  taskPlanId: string;
  jobId: string;
  envelopeId?: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  expectedOutputs: string[];
  outputSandboxRoot: string;
  ledgerEntryId?: string;
  status: RealExecutionGateStatus;
  checks: RealExecutionGateCheck[];
  blockers: string[];
  warnings: string[];
  canEnterScopedRealTestMode: boolean;
  scopedRealTestReviewOnly: true;
  actualExecutionAllowed: false;
  canExecute: false;
  canSpawnWorker: false;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  noWorkerSpawn: true;
  noProviderSubmit: true;
  noCredentialRead: true;
  noFileMutation: true;
}

export interface RealExecutionGateHardLocks {
  defaultLocked: true;
  scopedRealTestReviewOnly: true;
  actualExecutionAllowed: false;
  canExecute: false;
  canSpawnWorker: false;
  noWorkerSpawn: true;
  noSubprocess: true;
  noShellExecution: true;
  providerSubmissionForbidden: true;
  noProviderSubmit: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  noFileMutation: true;
  selectedScopeRequired: true;
  validatedEnvelopeRequired: true;
  outputSandboxRequired: true;
  manifestRequired: true;
  qaRequired: true;
  ledgerRequired: true;
}

export interface RealExecutionGateState {
  schemaVersion: string;
  generatedAt: string;
  phase: "scoped_real_execution_gate";
  mode: RealExecutionGateMode;
  status: RealExecutionGateStatus;
  projectId: string;
  batchId?: string;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  selectedEnvelopeIds: string[];
  outputSandbox: ExecutionLedgerOutputSandbox;
  items: RealExecutionGateItem[];
  summary: {
    totalItems: number;
    locked: number;
    blocked: number;
    readyForScopedRealTestReview: number;
    canEnterScopedRealTestMode: number;
    actualExecutionAllowed: false;
    canExecute: false;
    workerSpawnsAllowed: 0;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
  };
  hardLocks: RealExecutionGateHardLocks;
  forbiddenActions: Array<
    | "unscoped_project"
    | "unscoped_batch"
    | "unscoped_shot"
    | "unvalidated_envelope"
    | "output_path_outside_sandbox"
    | "missing_manifest"
    | "missing_qa"
    | "missing_ledger"
    | "worker_spawn"
    | "subprocess"
    | "shell_execution"
    | "provider_submit"
    | "credential_read"
    | "credential_write"
    | "file_mutation"
  >;
  notes: string[];
}

export interface BuildRealExecutionGateInput {
  generatedAt: string;
  mode?: RealExecutionGateMode;
  projectId: string;
  batchId?: string;
  selectedShotIds?: string[];
  selectedTaskPlanIds?: string[];
  selectedEnvelopeIds?: string[];
  outputSandbox?: ExecutionLedgerOutputSandbox;
  taskViews?: ExecutionLedgerTaskView[];
  imageTaskPlans?: ImageTaskPlan[];
  manifestMatches?: ManifestMatchReport[];
  qaHarness?: QaHarnessState;
  generationHarness?: GenerationHarnessState;
  localOrchestrator?: LocalOrchestratorState;
  providerExecutionHandoff?: ProviderExecutionHandoffState;
  executionLedger?: ExecutionLedgerState;
}

export const realExecutionGateHardLocks: RealExecutionGateHardLocks = {
  defaultLocked: true,
  scopedRealTestReviewOnly: true,
  actualExecutionAllowed: false,
  canExecute: false,
  canSpawnWorker: false,
  noWorkerSpawn: true,
  noSubprocess: true,
  noShellExecution: true,
  providerSubmissionForbidden: true,
  noProviderSubmit: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  credentialAccessAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
  selectedScopeRequired: true,
  validatedEnvelopeRequired: true,
  outputSandboxRequired: true,
  manifestRequired: true,
  qaRequired: true,
  ledgerRequired: true,
};

export const realExecutionGateForbiddenActions: RealExecutionGateState["forbiddenActions"] = [
  "unscoped_project",
  "unscoped_batch",
  "unscoped_shot",
  "unvalidated_envelope",
  "output_path_outside_sandbox",
  "missing_manifest",
  "missing_qa",
  "missing_ledger",
  "worker_spawn",
  "subprocess",
  "shell_execution",
  "provider_submit",
  "credential_read",
  "credential_write",
  "file_mutation",
];

const readyManifestStatuses = new Set(["actual_output_present", "complete", "matched"]);
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

function safeId(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "unscoped";
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizePath(value));
}

function isAbsoluteLike(value: string): boolean {
  return absolutePathPattern.test(value.trim());
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function defaultSandbox(projectId: string, batchId?: string): ExecutionLedgerOutputSandbox {
  const root = `real-test-sandbox/${safeId(projectId)}/${safeId(batchId || "locked")}`;
  return {
    root,
    allowedPrefixes: [root],
    manifestPath: `${root}/manifest.json`,
    qaReportPath: `${root}/qa/qa-report.json`,
    ledgerPath: `${root}/execution-ledger.json`,
    projectRootRelative: true,
    outsideRootWriteAllowed: false,
  };
}

function pathInsidePrefix(path: string, prefix: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

function pathInsideSandbox(path: string, sandbox: ExecutionLedgerOutputSandbox): boolean {
  if (!path.trim() || isAbsoluteLike(path) || hasParentTraversal(path)) return false;
  return sandbox.allowedPrefixes.some((prefix) => pathInsidePrefix(path, prefix));
}

function check(checkId: RealExecutionGateCheckId, label: string, passed: boolean, blocker: string, sourceRef?: string): RealExecutionGateCheck {
  return {
    checkId,
    label,
    required: true,
    passed,
    blocker: passed ? undefined : blocker,
    sourceRef,
  };
}

function selectedTaskPlans(input: BuildRealExecutionGateInput): ImageTaskPlan[] {
  const selectedShots = new Set(input.selectedShotIds || []);
  const selectedTaskPlans = new Set(input.selectedTaskPlanIds || []);
  const selectedEnvelopes = new Set(input.selectedEnvelopeIds || []);
  return (input.imageTaskPlans || []).filter((taskPlan) => {
    if (selectedTaskPlans.has(taskPlan.taskPlanId)) return true;
    if (selectedEnvelopes.size && taskPlan.taskEnvelopeSummary?.envelopeId && selectedEnvelopes.has(taskPlan.taskEnvelopeSummary.envelopeId)) return true;
    return selectedShots.has(taskPlan.shotId);
  });
}

function taskViewFor(taskPlan: ImageTaskPlan, taskViews: ExecutionLedgerTaskView[] = []): ExecutionLedgerTaskView | undefined {
  return taskViews.find(
    (taskView) =>
      taskView.job.id === taskPlan.jobId ||
      taskView.envelope.id === taskPlan.taskEnvelopeSummary?.envelopeId ||
      taskView.envelope.promptPlanId === taskPlan.promptPlanId,
  );
}

function manifestFor(taskPlan: ImageTaskPlan, reports: ManifestMatchReport[] = []): ManifestMatchReport | undefined {
  return reports.find((report) => report.taskId === taskPlan.taskPlanId || report.taskId === taskPlan.jobId);
}

function generationJobFor(taskPlan: ImageTaskPlan, generationHarness?: GenerationHarnessState) {
  return generationHarness?.jobs.find((job) => job.taskPlanId === taskPlan.taskPlanId || job.jobId === taskPlan.jobId);
}

function qaItemFor(taskPlan: ImageTaskPlan, qaHarness?: QaHarnessState) {
  return qaHarness?.items.find(
    (item) => item.taskPlanId === taskPlan.taskPlanId || item.jobId === taskPlan.jobId || item.shotId === taskPlan.shotId,
  );
}

function envelopeValid(taskPlan: ImageTaskPlan, taskView?: ExecutionLedgerTaskView): boolean {
  if (taskView) {
    return taskView.validator.valid === true
      && taskView.envelope.preflight.status !== "blocked"
      && taskView.envelope.expectedOutputs.length > 0
      && taskView.envelope.blockingReasons.length === 0;
  }

  const summary = taskPlan.taskEnvelopeSummary;
  return Boolean(summary && summary.preflightStatus !== "blocked" && summary.expectedOutputs.length > 0 && summary.blockingReasons.length === 0);
}

function outputPaths(taskPlan: ImageTaskPlan, taskView?: ExecutionLedgerTaskView): string[] {
  return uniqueInOrder([
    ...(taskView?.envelope.expectedOutputs || []),
    ...(taskPlan.taskEnvelopeSummary?.expectedOutputs || []),
    taskPlan.expectedOutputPath,
  ]);
}

function qaReady(taskPlan: ImageTaskPlan, qaHarness?: QaHarnessState, generationHarness?: GenerationHarnessState): boolean {
  const qaItem = qaItemFor(taskPlan, qaHarness);
  if (qaItem?.formalPromotionEligible === true) return true;
  const generationJob = generationJobFor(taskPlan, generationHarness);
  return generationJob?.candidateOutput.qaStatus === "pass";
}

function ledgerEntryFor(taskPlan: ImageTaskPlan, ledger?: ExecutionLedgerState) {
  return ledger?.entries.find((entry) => entry.taskPlanId === taskPlan.taskPlanId || entry.jobId === taskPlan.jobId);
}

function ledgerEntryReady(status?: ExecutionLedgerStatus): boolean {
  return status === "ready_for_scoped_review";
}

function ledgerRoutesClosed(ledger?: ExecutionLedgerState): boolean {
  if (!ledger) return false;
  return ledger.hardLocks.actualExecutionAllowed === false
    && ledger.hardLocks.canSpawnWorker === false
    && ledger.hardLocks.providerSubmitAllowed === 0
    && ledger.hardLocks.liveSubmitAllowed === false
    && ledger.hardLocks.credentialAccessAllowed === false
    && ledger.hardLocks.noCredentialRead === true
    && ledger.hardLocks.noCredentialWrite === true
    && ledger.hardLocks.noFileMutation === true
    && ledger.summary.actualExecutions === 0
    && ledger.summary.workerSpawns === 0
    && ledger.summary.providerSubmitAllowed === 0;
}

function providerRoutesClosed(handoff?: ProviderExecutionHandoffState): boolean {
  if (!handoff) return false;
  return handoff.hardLocks.canSubmitProvider === false
    && handoff.hardLocks.providerSubmitAllowed === 0
    && handoff.hardLocks.liveSubmitAllowed === false
    && handoff.hardLocks.credentialAccessAllowed === false
    && handoff.hardLocks.automaticSubmitAllowed === false
    && handoff.hardLocks.canSpawnWorker === false
    && handoff.hardLocks.fileMutationAllowed === false
    && handoff.hardLocks.noProviderSubmit === true
    && handoff.hardLocks.noCredentialRead === true
    && handoff.hardLocks.noCredentialWrite === true
    && handoff.hardLocks.noWorkerSpawn === true
    && handoff.hardLocks.noFileMutation === true
    && handoff.phase33Evidence.noProviderSubmit === true
    && handoff.phase33Evidence.noWorkerSpawn === true
    && handoff.phase33Evidence.noFileMutation === true;
}

function localWorkerRoutesClosed(localOrchestrator?: LocalOrchestratorState): boolean {
  if (!localOrchestrator) return true;
  return localOrchestrator.hardLocks.noSpawnCodex === true
    && localOrchestrator.hardLocks.noSubprocess === true
    && localOrchestrator.hardLocks.noShellExecution === true
    && localOrchestrator.hardLocks.noProviderExecution === true
    && localOrchestrator.hardLocks.noCredentialRead === true
    && localOrchestrator.hardLocks.noFileMutation === true
    && localOrchestrator.summary.daemonStarted === false;
}

function buildGateItem(input: BuildRealExecutionGateInput, taskPlan: ImageTaskPlan, sandbox: ExecutionLedgerOutputSandbox): RealExecutionGateItem {
  const mode = input.mode || "locked";
  const taskView = taskViewFor(taskPlan, input.taskViews);
  const manifest = manifestFor(taskPlan, input.manifestMatches);
  const ledgerEntry = ledgerEntryFor(taskPlan, input.executionLedger);
  const outputs = outputPaths(taskPlan, taskView);
  const outputSandboxValid = outputs.length > 0 && outputs.every((output) => pathInsideSandbox(output, sandbox));
  const manifestReady = readyManifestStatuses.has(manifest?.status || "missing_expected_output");
  const providerClosed = providerRoutesClosed(input.providerExecutionHandoff) && ledgerRoutesClosed(input.executionLedger);
  const workerClosed = localWorkerRoutesClosed(input.localOrchestrator) && ledgerRoutesClosed(input.executionLedger);
  const credentialClosed = providerClosed && input.executionLedger?.hardLocks.credentialAccessAllowed === false;
  const checks = [
    check("selected_project", "Selected project", Boolean(input.projectId.trim()), "Selected project id is required.", `project:${input.projectId}`),
    check("selected_batch", "Selected batch", mode === "locked" || Boolean(input.batchId?.trim()), "Selected batch id is required for scoped real test mode.", input.batchId ? `batch:${input.batchId}` : undefined),
    check("selected_shot", "Selected shot", (input.selectedShotIds || []).includes(taskPlan.shotId), "Task plan must be in the selected shot scope.", `shot:${taskPlan.shotId}`),
    check("validated_envelope", "Validated envelope", envelopeValid(taskPlan, taskView), "Validated task envelope is required.", taskView?.envelope.id || taskPlan.taskEnvelopeSummary?.envelopeId),
    check("output_sandbox", "Output sandbox", outputSandboxValid, "Expected outputs must stay inside the output sandbox.", sandbox.root),
    check("manifest_ready", "Manifest ready", manifestReady, "Manifest must show the expected output is present or complete.", manifest ? `manifestMatch:${manifest.taskId}:${manifest.status}` : undefined),
    check("qa_ready", "QA ready", qaReady(taskPlan, input.qaHarness, input.generationHarness), "Explicit QA pass is required.", qaItemFor(taskPlan, input.qaHarness)?.qaItemId),
    check("ledger_ready", "Ledger ready", ledgerEntryReady(ledgerEntry?.status), "Execution ledger entry must be ready for scoped review.", ledgerEntry?.ledgerEntryId),
    check("provider_routes_closed", "Provider routes closed", providerClosed, "Provider submit routes must remain closed.", input.providerExecutionHandoff?.phase),
    check("worker_spawn_closed", "Worker spawn closed", workerClosed, "Worker spawn, subprocess, and shell routes must remain closed.", input.localOrchestrator ? "localOrchestrator" : "hardLocks"),
    check("credential_routes_closed", "Credential routes closed", credentialClosed, "Credential routes must remain closed.", input.executionLedger?.ledgerId),
  ];
  const blockers = uniqueSorted(checks.flatMap((item) => (item.blocker ? [item.blocker] : [])));
  const status: RealExecutionGateStatus = mode === "locked" ? "locked" : blockers.length ? "blocked" : "ready_for_scoped_real_test_review";

  return {
    gateItemId: `real_execution_gate_${safeId(input.projectId)}_${safeId(input.batchId || "locked")}_${safeId(taskPlan.taskPlanId)}`,
    projectId: input.projectId,
    batchId: input.batchId,
    shotId: taskPlan.shotId,
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    envelopeId: taskView?.envelope.id || taskPlan.taskEnvelopeSummary?.envelopeId,
    providerId: taskPlan.providerId,
    providerSlot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    expectedOutputs: outputs,
    outputSandboxRoot: sandbox.root,
    ledgerEntryId: ledgerEntry?.ledgerEntryId,
    status,
    checks,
    blockers,
    warnings: uniqueSorted([
      ...taskPlan.warnings,
      ...(mode === "locked" ? ["Real execution gate is locked by default."] : []),
      "Scoped real test review does not spawn workers, submit providers, read credentials, or mutate files.",
    ]),
    canEnterScopedRealTestMode: status === "ready_for_scoped_real_test_review",
    scopedRealTestReviewOnly: true,
    actualExecutionAllowed: false,
    canExecute: false,
    canSpawnWorker: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    noWorkerSpawn: true,
    noProviderSubmit: true,
    noCredentialRead: true,
    noFileMutation: true,
  };
}

export function buildRealExecutionGateState(input: BuildRealExecutionGateInput): RealExecutionGateState {
  const mode = input.mode || "locked";
  const sandbox = input.outputSandbox || input.executionLedger?.outputSandbox || defaultSandbox(input.projectId, input.batchId);
  const items = selectedTaskPlans(input).map((taskPlan) => buildGateItem(input, taskPlan, sandbox));
  const locked = items.filter((item) => item.status === "locked").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const readyForScopedRealTestReview = items.filter((item) => item.status === "ready_for_scoped_real_test_review").length;
  const status: RealExecutionGateStatus =
    mode === "locked" ? "locked" : blocked > 0 || readyForScopedRealTestReview === 0 ? "blocked" : "ready_for_scoped_real_test_review";

  return {
    schemaVersion: realExecutionGateSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "scoped_real_execution_gate",
    mode,
    status,
    projectId: input.projectId,
    batchId: input.batchId,
    selectedShotIds: uniqueInOrder(input.selectedShotIds || []),
    selectedTaskPlanIds: uniqueInOrder(input.selectedTaskPlanIds || []),
    selectedEnvelopeIds: uniqueInOrder(input.selectedEnvelopeIds || []),
    outputSandbox: sandbox,
    items,
    summary: {
      totalItems: items.length,
      locked,
      blocked,
      readyForScopedRealTestReview,
      canEnterScopedRealTestMode: items.filter((item) => item.canEnterScopedRealTestMode).length,
      actualExecutionAllowed: false,
      canExecute: false,
      workerSpawnsAllowed: 0,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
    },
    hardLocks: realExecutionGateHardLocks,
    forbiddenActions: realExecutionGateForbiddenActions,
    notes: [
      "This gate scopes real-test intent to a selected project, batch, and shots.",
      "A ready item is review-only evidence: actual execution remains disabled.",
      "Provider submission, worker spawn, credential access, and file mutation stay forbidden by hard locks.",
    ],
  };
}
