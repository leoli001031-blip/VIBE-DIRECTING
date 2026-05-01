import type { ManifestMatchReport } from "./manifestMatcher";
import type {
  GenerationHarnessState,
  ImageTaskPlan,
  ProviderSlot,
  QaHarnessState,
  RequiredMode,
  TaskEnvelope,
  TaskRun,
} from "./types";

export const executionLedgerSchemaVersion = "0.1.0";

export type ExecutionLedgerMode = "locked" | "scoped_real_test";
export type ExecutionLedgerStatus = "locked" | "blocked" | "ready_for_scoped_review";

export interface ExecutionLedgerOutputSandbox {
  root: string;
  allowedPrefixes: string[];
  manifestPath: string;
  qaReportPath: string;
  ledgerPath: string;
  projectRootRelative: true;
  outsideRootWriteAllowed: false;
}

export interface ExecutionLedgerTaskView {
  job: {
    id: string;
    providerId?: string;
    slot?: ProviderSlot;
    requiredMode?: RequiredMode;
  };
  shotId?: string;
  envelope: TaskEnvelope;
  taskRun?: TaskRun;
  validator: {
    valid: boolean;
    issues?: string[];
  };
}

export interface ExecutionLedgerEntry {
  ledgerEntryId: string;
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
  status: ExecutionLedgerStatus;
  envelopeValid: boolean;
  outputSandboxValid: boolean;
  manifestStatus: string;
  manifestReady: boolean;
  qaStatus: string;
  qaReady: boolean;
  evidenceRefs: string[];
  blockers: string[];
  warnings: string[];
  attemptOrdinal: 0;
  actualStartedAt?: never;
  actualFinishedAt?: never;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  actualExecutionAllowed: false;
  ledgerRecordOnly: true;
}

export interface ExecutionLedgerHardLocks {
  defaultLocked: true;
  stateOnly: true;
  appendOnly: true;
  ledgerWriteAllowed: false;
  actualExecutionAllowed: false;
  canSpawnWorker: false;
  noWorkerSpawn: true;
  noSubprocess: true;
  noShellExecution: true;
  providerSubmissionForbidden: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  noFileMutation: true;
  outsideSandboxWriteForbidden: true;
}

export interface ExecutionLedgerSourceCoverage {
  layer:
    | "taskViews"
    | "imageTaskPlans"
    | "manifestMatches"
    | "qaHarness"
    | "generationHarness"
    | "outputSandbox";
  referenced: boolean;
  referenceCount: number;
  sourceRefs: string[];
}

export interface ExecutionLedgerState {
  schemaVersion: string;
  generatedAt: string;
  phase: "scoped_real_execution_ledger";
  ledgerId: string;
  mode: ExecutionLedgerMode;
  status: ExecutionLedgerStatus;
  projectId: string;
  batchId?: string;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  selectedEnvelopeIds: string[];
  outputSandbox: ExecutionLedgerOutputSandbox;
  scopeBlockers: string[];
  entries: ExecutionLedgerEntry[];
  summary: {
    totalEntries: number;
    scopedEntries: number;
    locked: number;
    blocked: number;
    readyForScopedReview: number;
    actualExecutions: 0;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialReads: 0;
    workerSpawns: 0;
    ledgerWriteAllowed: false;
  };
  hardLocks: ExecutionLedgerHardLocks;
  sourceCoverage: ExecutionLedgerSourceCoverage[];
  notes: string[];
}

export interface BuildExecutionLedgerInput {
  generatedAt: string;
  mode?: ExecutionLedgerMode;
  projectId: string;
  batchId?: string;
  selectedShotIds?: string[];
  selectedTaskPlanIds?: string[];
  selectedEnvelopeIds?: string[];
  outputSandbox?: Partial<ExecutionLedgerOutputSandbox>;
  taskViews?: ExecutionLedgerTaskView[];
  imageTaskPlans?: ImageTaskPlan[];
  manifestMatches?: ManifestMatchReport[];
  qaHarness?: QaHarnessState;
  generationHarness?: GenerationHarnessState;
}

export const executionLedgerHardLocks: ExecutionLedgerHardLocks = {
  defaultLocked: true,
  stateOnly: true,
  appendOnly: true,
  ledgerWriteAllowed: false,
  actualExecutionAllowed: false,
  canSpawnWorker: false,
  noWorkerSpawn: true,
  noSubprocess: true,
  noShellExecution: true,
  providerSubmissionForbidden: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  credentialAccessAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
  outsideSandboxWriteForbidden: true,
};

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

function resolveSandbox(input: BuildExecutionLedgerInput): ExecutionLedgerOutputSandbox {
  const fallback = defaultSandbox(input.projectId, input.batchId);
  const root = normalizePath(input.outputSandbox?.root || fallback.root);
  const allowedPrefixes = uniqueInOrder(
    (input.outputSandbox?.allowedPrefixes?.length ? input.outputSandbox.allowedPrefixes : fallback.allowedPrefixes)
      .map(normalizePath),
  );

  return {
    root,
    allowedPrefixes: allowedPrefixes.length ? allowedPrefixes : [root],
    manifestPath: normalizePath(input.outputSandbox?.manifestPath || `${root}/manifest.json`),
    qaReportPath: normalizePath(input.outputSandbox?.qaReportPath || `${root}/qa/qa-report.json`),
    ledgerPath: normalizePath(input.outputSandbox?.ledgerPath || `${root}/execution-ledger.json`),
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

function sandboxBlockers(sandbox: ExecutionLedgerOutputSandbox): string[] {
  const paths = [sandbox.root, ...sandbox.allowedPrefixes, sandbox.manifestPath, sandbox.qaReportPath, sandbox.ledgerPath];
  return uniqueSorted([
    ...(sandbox.root ? [] : ["Output sandbox root is required."]),
    ...paths.flatMap((path) => {
      if (!path) return ["Output sandbox path is empty."];
      if (isAbsoluteLike(path)) return [`Output sandbox path must be project-root-relative: ${path}`];
      if (hasParentTraversal(path)) return [`Output sandbox path must not contain parent traversal: ${path}`];
      return [];
    }),
    ...(pathInsideSandbox(sandbox.manifestPath, sandbox) ? [] : ["Manifest path must stay inside the output sandbox."]),
    ...(pathInsideSandbox(sandbox.qaReportPath, sandbox) ? [] : ["QA report path must stay inside the output sandbox."]),
    ...(pathInsideSandbox(sandbox.ledgerPath, sandbox) ? [] : ["Ledger path must stay inside the output sandbox."]),
  ]);
}

function scopeBlockers(input: BuildExecutionLedgerInput, sandbox: ExecutionLedgerOutputSandbox): string[] {
  const mode = input.mode || "locked";
  const selectedShotIds = input.selectedShotIds || [];
  return uniqueSorted([
    ...(input.projectId.trim() ? [] : ["Selected project id is required."]),
    ...(mode === "scoped_real_test" && !input.batchId?.trim() ? ["Selected batch id is required for scoped real test mode."] : []),
    ...(mode === "scoped_real_test" && selectedShotIds.length === 0 ? ["At least one selected shot is required for scoped real test mode."] : []),
    ...sandboxBlockers(sandbox),
  ]);
}

function selectedTaskPlans(input: BuildExecutionLedgerInput): ImageTaskPlan[] {
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

function qaStatus(taskPlan: ImageTaskPlan, qaHarness?: QaHarnessState, generationHarness?: GenerationHarnessState): string {
  const qaItem = qaItemFor(taskPlan, qaHarness);
  if (qaItem?.formalPromotionEligible) return "pass";
  const failedDimension = qaItem?.dimensions.find((dimension) => dimension.status === "FAIL");
  if (failedDimension) return "fail";
  const generationJob = generationJobFor(taskPlan, generationHarness);
  return generationJob?.candidateOutput.qaStatus || "missing";
}

function coverage(input: BuildExecutionLedgerInput, entries: ExecutionLedgerEntry[], sandbox: ExecutionLedgerOutputSandbox): ExecutionLedgerSourceCoverage[] {
  const refs = {
    taskViews: entries.map((entry) => entry.envelopeId || "").filter(Boolean),
    imageTaskPlans: entries.map((entry) => entry.taskPlanId),
    manifestMatches: uniqueSorted(entries.map((entry) => `manifest:${entry.taskPlanId}:${entry.manifestStatus}`)),
    qaHarness: uniqueSorted(entries.map((entry) => `qa:${entry.taskPlanId}:${entry.qaStatus}`)),
    generationHarness: uniqueSorted(entries.flatMap((entry) => entry.evidenceRefs.filter((ref) => ref.startsWith("generationHarness:")))),
    outputSandbox: [sandbox.root, sandbox.manifestPath, sandbox.qaReportPath, sandbox.ledgerPath],
  };

  return (Object.keys(refs) as ExecutionLedgerSourceCoverage["layer"][]).map((layer) => ({
    layer,
    referenced: refs[layer].length > 0,
    referenceCount: refs[layer].length,
    sourceRefs: refs[layer],
  }));
}

function buildEntry(input: BuildExecutionLedgerInput, taskPlan: ImageTaskPlan, sandbox: ExecutionLedgerOutputSandbox, scopedBlockers: string[]): ExecutionLedgerEntry {
  const mode = input.mode || "locked";
  const taskView = taskViewFor(taskPlan, input.taskViews);
  const manifest = manifestFor(taskPlan, input.manifestMatches);
  const generationJob = generationJobFor(taskPlan, input.generationHarness);
  const outputs = outputPaths(taskPlan, taskView);
  const outputSandboxValid = outputs.length > 0 && outputs.every((output) => pathInsideSandbox(output, sandbox));
  const manifestStatus = manifest?.status || "missing_expected_output";
  const manifestReady = readyManifestStatuses.has(manifestStatus);
  const qa = qaStatus(taskPlan, input.qaHarness, input.generationHarness);
  const qaReady = qa === "pass";
  const validEnvelope = envelopeValid(taskPlan, taskView);
  const blockers = uniqueSorted([
    ...scopedBlockers,
    ...taskPlan.blockers,
    ...(taskPlan.status === "blocked" ? ["Image task plan is blocked."] : []),
    ...(validEnvelope ? [] : ["Validated task envelope is required before scoped real test review."]),
    ...(outputSandboxValid ? [] : ["Every expected output must stay inside the selected output sandbox."]),
    ...(manifestReady ? [] : [`Manifest status must be ready before scoped real test review (${manifestStatus}).`]),
    ...(qaReady ? [] : [`Explicit QA pass is required before scoped real test review (${qa}).`]),
  ]);
  const status: ExecutionLedgerStatus = mode === "locked" ? "locked" : blockers.length ? "blocked" : "ready_for_scoped_review";
  const envelopeId = taskView?.envelope.id || taskPlan.taskEnvelopeSummary?.envelopeId;

  return {
    ledgerEntryId: `execution_ledger_${safeId(input.projectId)}_${safeId(input.batchId || "locked")}_${safeId(taskPlan.taskPlanId)}`,
    projectId: input.projectId,
    batchId: input.batchId,
    shotId: taskPlan.shotId,
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    envelopeId,
    providerId: taskPlan.providerId,
    providerSlot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    expectedOutputs: outputs,
    outputSandboxRoot: sandbox.root,
    status,
    envelopeValid: validEnvelope,
    outputSandboxValid,
    manifestStatus,
    manifestReady,
    qaStatus: qa,
    qaReady,
    evidenceRefs: uniqueSorted([
      `project:${input.projectId}`,
      input.batchId ? `batch:${input.batchId}` : "",
      taskPlan.shotId ? `shot:${taskPlan.shotId}` : "",
      `imageTaskPlan:${taskPlan.taskPlanId}`,
      taskPlan.jobId ? `job:${taskPlan.jobId}` : "",
      envelopeId ? `taskEnvelope:${envelopeId}` : "",
      manifest ? `manifestMatch:${manifest.taskId}:${manifest.status}` : "",
      qaItemFor(taskPlan, input.qaHarness)?.qaItemId ? `qaHarness:${qaItemFor(taskPlan, input.qaHarness)?.qaItemId}` : "",
      generationJob?.harnessJobId ? `generationHarness:${generationJob.harnessJobId}` : "",
      `outputSandbox:${sandbox.root}`,
    ]),
    blockers,
    warnings: uniqueSorted([
      ...taskPlan.warnings,
      ...(mode === "locked" ? ["Execution ledger is locked by default; entries are state-only evidence."] : []),
      ...(generationJob?.warnings || []),
    ]),
    attemptOrdinal: 0,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    actualExecutionAllowed: false,
    ledgerRecordOnly: true,
  };
}

export function buildExecutionLedgerState(input: BuildExecutionLedgerInput): ExecutionLedgerState {
  const mode = input.mode || "locked";
  const sandbox = resolveSandbox(input);
  const scopedBlockers = scopeBlockers(input, sandbox);
  const entries = selectedTaskPlans(input).map((taskPlan) => buildEntry(input, taskPlan, sandbox, scopedBlockers));
  const locked = entries.filter((entry) => entry.status === "locked").length;
  const blocked = entries.filter((entry) => entry.status === "blocked").length;
  const readyForScopedReview = entries.filter((entry) => entry.status === "ready_for_scoped_review").length;
  const status: ExecutionLedgerStatus =
    mode === "locked" ? "locked" : scopedBlockers.length || blocked > 0 || readyForScopedReview === 0 ? "blocked" : "ready_for_scoped_review";

  return {
    schemaVersion: executionLedgerSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "scoped_real_execution_ledger",
    ledgerId: `execution_ledger_${safeId(input.projectId)}_${safeId(input.batchId || "locked")}`,
    mode,
    status,
    projectId: input.projectId,
    batchId: input.batchId,
    selectedShotIds: uniqueInOrder(input.selectedShotIds || []),
    selectedTaskPlanIds: uniqueInOrder(input.selectedTaskPlanIds || []),
    selectedEnvelopeIds: uniqueInOrder(input.selectedEnvelopeIds || []),
    outputSandbox: sandbox,
    scopeBlockers: scopedBlockers,
    entries,
    summary: {
      totalEntries: entries.length,
      scopedEntries: entries.length,
      locked,
      blocked,
      readyForScopedReview,
      actualExecutions: 0,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialReads: 0,
      workerSpawns: 0,
      ledgerWriteAllowed: false,
    },
    hardLocks: executionLedgerHardLocks,
    sourceCoverage: coverage(input, entries, sandbox),
    notes: [
      "Execution Ledger records scoped real-test intent as state-only evidence.",
      "No ledger file is written, no worker is spawned, and no provider or credential route is opened.",
      "Ready entries mean the selected scope has envelope, sandbox, manifest, and QA evidence for later user review.",
    ],
  };
}
