import type { ExecutionLedgerOutputSandbox, ExecutionLedgerState } from "./executionLedger";
import type { RealExecutionGateState } from "./realExecutionGate";
import type { BuiltTaskPacket } from "./taskPacketBuilder";
import type { Image2AdapterRequest, ImageTaskPlan, ProviderExecutionState, ProviderSlot, RequiredMode, TaskEnvelope } from "./types";

export const realProviderPilotSchemaVersion = "0.1.0";

export type RealProviderPilotMode = "locked" | "pilot_review";
export type RealProviderPilotStatus = "locked" | "blocked" | "review_ready";
export type RealProviderPilotProviderStatus = "image2_first_review_candidate" | "parked_future" | "blocked";
export type RealProviderPilotOutputRole = "start_frame" | "end_frame" | "reference_asset" | "image";

export interface RealProviderPilotProviderPlanInput {
  providerId?: string;
  adapterId?: string;
  providerSlot?: ProviderSlot;
  requiredMode?: RequiredMode;
  capabilityId?: string;
  executionState?: ProviderExecutionState;
}

export interface RealProviderPilotCheck {
  checkId:
    | "selected_project"
    | "project_title"
    | "selected_shots"
    | "output_sandbox"
    | "provider_slot"
    | "provider_adapter"
    | "image2_first_provider"
    | "task_envelope_or_packet"
    | "estimated_image_count"
    | "hard_locks";
  label: string;
  required: true;
  passed: boolean;
  blocker?: string;
  sourceRef?: string;
}

export interface RealProviderPilotItem {
  pilotItemId: string;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  adapterRequestId?: string;
  expectedOutputPath: string;
  status: RealProviderPilotStatus;
  blockers: string[];
  warnings: string[];
  image2First: true;
  seedanceParked: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  canMutateFiles: false;
}

export interface RealProviderPilotHardLocks {
  defaultLocked: true;
  image2FirstOnly: true;
  smallBatchOnly: true;
  seedanceParked: true;
  videoProvidersParked: true;
  providerSubmissionForbidden: true;
  noProviderSubmit: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  providerSubmitAllowedBoolean: false;
  liveSubmitAllowed: false;
  actualExecutionAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  credentialAccessAllowed: false;
  noWorkerSpawn: true;
  canSpawnWorker: false;
  noSubprocess: true;
  noShellExecution: true;
  noImage2Execution: true;
  noSeedanceExecution: true;
  noFileMutation: true;
  dryRunOnly: true;
  canMutateFiles: false;
  reviewOnly: true;
}

export interface RealProviderPilotProviderPlan {
  providerId?: string;
  adapterId?: string;
  providerSlot?: ProviderSlot;
  requiredMode?: RequiredMode;
  capabilityId?: string;
  executionState: ProviderExecutionState | "unknown";
  status: RealProviderPilotProviderStatus;
  image2FirstEligible: boolean;
  seedanceParked: boolean;
  blockers: string[];
  warnings: string[];
}

export interface RealProviderPilotSelectedShot {
  shotId: string;
  sourceRefs: string[];
  expectedImageRoles: RealProviderPilotOutputRole[];
  suggestedOutputPaths: string[];
  taskEnvelopeIds: string[];
  taskPacketIds: string[];
  taskPlanIds: string[];
}

export interface RealProviderPilotOutputPlanItem {
  shotId: string;
  role: RealProviderPilotOutputRole;
  suggestedRelativePath: string;
  suggestedSandboxPath?: string;
  source: "naming_convention" | "task_envelope" | "task_packet" | "image_task_plan";
  noFileMutation: true;
}

export interface RealProviderPilotState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_43_real_provider_pilot";
  pilotKind: "image2_first_small_batch";
  mode: RealProviderPilotMode;
  status: RealProviderPilotStatus;
  projectId: string;
  projectTitle?: string;
  batchId?: string;
  maxBatchSize: number;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  items: RealProviderPilotItem[];
  parkedProviders: Array<{
    providerId: "seedance2-provider" | "jimeng-video" | string;
    slot: ProviderSlot;
    state: "parked";
    liveSubmitAllowed: false;
    reason: string;
  }>;
  scopeSummary: {
    projectId: string;
    projectTitle?: string;
    selectedShotCount: number;
    estimatedImageCount?: number;
    outputSandboxRoot?: string;
    providerSlot?: ProviderSlot;
    providerId?: string;
    adapterId?: string;
    image2FirstOnly: true;
    seedanceParkedForFuture: true;
    maxBatchSize: 3;
    reviewReadyOnly: boolean;
  };
  providerPlan: RealProviderPilotProviderPlan;
  parkedFutureProviderPlans: RealProviderPilotProviderPlan[];
  selectedShots: RealProviderPilotSelectedShot[];
  expectedOutputPlan: {
    sandboxRoot?: string;
    namingConvention: string[];
    estimatedImageCount?: number;
    outputs: RealProviderPilotOutputPlanItem[];
    noFileMutation: true;
  };
  manifestPlan: {
    manifestPath?: string;
    entryCount: number;
    entries: Array<{ shotId: string; expectedOutputs: string[]; status: "planned_for_review" }>;
    writeAllowed: false;
    noFileMutation: true;
  };
  watcherLinkPlan: {
    sandboxRoot?: string;
    watchGlobs: string[];
    manifestPath?: string;
    qaReportPath?: string;
    linkedForFutureReview: true;
    watcherStarted: false;
    noFileMutation: true;
  };
  qaRequiredGates: Array<{
    gateId: string;
    label: string;
    required: true;
    reviewStage: "before_future_submit" | "after_future_output";
  }>;
  userConfirmationRequirements: Array<{
    requirementId: string;
    label: string;
    requiredBeforeAnyFutureSubmit: true;
    satisfied: false;
  }>;
  costRiskEstimatePlaceholder: {
    estimatedImageCount?: number;
    currency: "TBD";
    unitCost: "TBD";
    estimatedTotalCost: "TBD";
    riskLevel: "low_small_batch_unknown_cost";
    notes: string[];
    userMustApproveBeforeAnyFutureSubmit: true;
  };
  checks: RealProviderPilotCheck[];
  blockers: string[];
  warnings: string[];
  summary: {
    totalItems: number;
    locked: number;
    blocked: number;
    reviewReady: number;
    image2Items: number;
    videoItems: 0;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    workerSpawnsAllowed: 0;
    fileMutationsAllowed: 0;
    actualExecutionAllowed: false;
    dryRunOnly: true;
  };
  hardLocks: RealProviderPilotHardLocks;
  forbiddenActions: Array<
    | "provider_submit"
    | "credential_read"
    | "credential_write"
    | "worker_spawn"
    | "file_mutation"
    | "subprocess"
    | "shell_execution"
    | "image2_execution"
    | "seedance_execution"
    | "seedance_submit"
    | "video_submit"
    | "unscoped_real_provider"
  >;
  actualExecutionAllowed: false;
  providerSubmitAllowed: false;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  noFileMutation: true;
  dryRunOnly: true;
  notes: string[];
}

export interface BuildRealProviderPilotInput {
  generatedAt: string;
  mode?: RealProviderPilotMode;
  projectId: string;
  projectTitle?: string;
  batchId?: string;
  selectedShotIds?: string[];
  selectedTaskPlanIds?: string[];
  maxBatchSize?: number;
  outputSandbox?: Partial<ExecutionLedgerOutputSandbox>;
  providerPlan?: RealProviderPilotProviderPlanInput;
  parkedFutureProviderPlans?: RealProviderPilotProviderPlanInput[];
  taskEnvelopes?: TaskEnvelope[];
  taskPackets?: BuiltTaskPacket[];
  imageTaskPlans?: ImageTaskPlan[];
  image2AdapterRequests?: Image2AdapterRequest[];
  expectedImageCount?: number;
  executionLedger?: ExecutionLedgerState;
  realExecutionGate?: RealExecutionGateState;
}

export const realProviderPilotHardLocks: RealProviderPilotHardLocks = {
  defaultLocked: true,
  image2FirstOnly: true,
  smallBatchOnly: true,
  seedanceParked: true,
  videoProvidersParked: true,
  providerSubmissionForbidden: true,
  noProviderSubmit: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  providerSubmitAllowedBoolean: false,
  liveSubmitAllowed: false,
  actualExecutionAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  credentialAccessAllowed: false,
  noWorkerSpawn: true,
  canSpawnWorker: false,
  noSubprocess: true,
  noShellExecution: true,
  noImage2Execution: true,
  noSeedanceExecution: true,
  noFileMutation: true,
  dryRunOnly: true,
  canMutateFiles: false,
  reviewOnly: true,
};

const imageSlots = new Set<ProviderSlot>(["image.generate", "image.edit", "image.reference_asset"]);
const seedancePattern = /seedance|jimeng|video\.i2v/i;
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

function safeId(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "unscoped";
}

function uniqueInOrder(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizePath(value));
}

function isSafeRelativePath(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return !absolutePathPattern.test(value) && !hasParentTraversal(value);
}

function outputRoleFromText(value: string): RealProviderPilotOutputRole {
  const lower = value.toLowerCase();
  if (lower.includes("reference") || lower.includes("asset")) return "reference_asset";
  if (lower.includes("end")) return "end_frame";
  if (lower.includes("start")) return "start_frame";
  return "image";
}

function conventionPath(shotId: string, role: RealProviderPilotOutputRole): string {
  const safeShotId = safeId(shotId);
  if (role === "start_frame") return `shots/${safeShotId}/start.png`;
  if (role === "end_frame") return `shots/${safeShotId}/end.png`;
  if (role === "reference_asset") return `shots/${safeShotId}/reference.png`;
  return `shots/${safeShotId}/image.png`;
}

function sandboxPath(root: string | undefined, relativePath: string): string | undefined {
  return root ? `${normalizePath(root)}/${relativePath}` : undefined;
}

function isImage2Plan(taskPlan: ImageTaskPlan): boolean {
  return imageSlots.has(taskPlan.providerSlot) && taskPlan.providerId.startsWith("openai-image2");
}

function adapterFor(taskPlan: ImageTaskPlan, requests: Image2AdapterRequest[] = []): Image2AdapterRequest | undefined {
  return requests.find((request) => request.taskPlanId === taskPlan.taskPlanId);
}

function ledgerReady(taskPlan: ImageTaskPlan, ledger?: ExecutionLedgerState): boolean {
  if (!ledger) return false;
  return ledger.entries.some((entry) => entry.taskPlanId === taskPlan.taskPlanId && entry.status === "ready_for_scoped_review");
}

function gateReady(taskPlan: ImageTaskPlan, gate?: RealExecutionGateState): boolean {
  if (!gate) return false;
  return gate.items.some((item) => item.taskPlanId === taskPlan.taskPlanId && item.status === "ready_for_scoped_real_test_review");
}

function selectedPlans(input: BuildRealProviderPilotInput): ImageTaskPlan[] {
  const selectedShots = new Set(input.selectedShotIds || []);
  const selectedTaskPlans = new Set(input.selectedTaskPlanIds || []);
  const scoped = (input.imageTaskPlans || []).filter((taskPlan) => {
    if (!isImage2Plan(taskPlan)) return false;
    if (selectedTaskPlans.size) return selectedTaskPlans.has(taskPlan.taskPlanId);
    if (selectedShots.size) return selectedShots.has(taskPlan.shotId);
    return true;
  });
  return scoped.slice(0, Math.max(1, input.maxBatchSize || 3));
}

function buildItem(input: BuildRealProviderPilotInput, taskPlan: ImageTaskPlan): RealProviderPilotItem {
  const mode = input.mode || "locked";
  const request = adapterFor(taskPlan, input.image2AdapterRequests);
  const requestSafe = Boolean(
    request?.submitPolicy?.dry_run_only === true &&
      request.submitPolicy.manual_submit_required === true &&
      request.submitPolicy.live_submit_forbidden === true,
  );
  const needsLedgerGate = mode === "pilot_review" && Boolean(input.executionLedger || input.realExecutionGate);
  const blockers = uniqueSorted([
    ...taskPlan.blockers,
    taskPlan.status === "blocked" ? "Image2 task plan is blocked." : "",
    requestSafe || !input.image2AdapterRequests?.length ? "" : "Image2 adapter request with dry-run/manual-submit/live-submit-forbidden policy is required.",
    needsLedgerGate && !ledgerReady(taskPlan, input.executionLedger) ? "Execution ledger must be ready for scoped review." : "",
    needsLedgerGate && !gateReady(taskPlan, input.realExecutionGate) ? "Real execution gate must be ready for scoped review." : "",
  ]);
  const status: RealProviderPilotStatus = mode === "locked" ? "locked" : blockers.length ? "blocked" : "review_ready";

  return {
    pilotItemId: `real_provider_pilot_${safeId(input.projectId)}_${safeId(input.batchId || "locked")}_${safeId(taskPlan.taskPlanId)}`,
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    providerId: taskPlan.providerId,
    providerSlot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    adapterRequestId: request?.requestId,
    expectedOutputPath: taskPlan.expectedOutputPath,
    status,
    blockers,
    warnings: uniqueSorted([
      ...taskPlan.warnings,
      "Real Provider Pilot is review/state only; it does not submit Image2, read credentials, spawn workers, or mutate files.",
    ]),
    image2First: true,
    seedanceParked: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    canMutateFiles: false,
  };
}

function providerPlan(input: RealProviderPilotProviderPlanInput | undefined): RealProviderPilotProviderPlan {
  const providerSlot = input?.providerSlot;
  const providerId = input?.providerId?.trim();
  const adapterId = input?.adapterId?.trim();
  const executionState = input?.executionState || "unknown";
  const seedanceParked = seedancePattern.test(`${providerId || ""} ${adapterId || ""} ${providerSlot || ""}`);
  const image2FirstEligible = Boolean(providerSlot && imageSlots.has(providerSlot) && providerId && adapterId && !seedanceParked);
  const blockers = uniqueSorted([
    providerSlot ? "" : "Provider slot is required for the Image2 First pilot.",
    providerId ? "" : "Provider id is required for the Image2 First pilot.",
    adapterId ? "" : "Provider adapter id is required for the Image2 First pilot.",
    providerSlot && !imageSlots.has(providerSlot) ? "Image2 First pilot only accepts image.generate, image.edit, or image.reference_asset in the first round." : "",
    seedanceParked ? "Seedance/video provider is parked for a future pilot and cannot enter the Image2 First review set." : "",
  ]);

  return {
    providerId,
    adapterId,
    providerSlot,
    requiredMode: input?.requiredMode,
    capabilityId: input?.capabilityId,
    executionState,
    status: seedanceParked ? "parked_future" : blockers.length ? "blocked" : "image2_first_review_candidate",
    image2FirstEligible,
    seedanceParked,
    blockers,
    warnings: ["Provider plan is review-only; no submit route is opened."],
  };
}

function taskPacketExpectedOutputs(packet: BuiltTaskPacket): string[] {
  return uniqueInOrder([
    ...(packet.hardFields?.expectedOutputs || []),
    ...(packet.envelope?.taskEnvelope.expectedOutputs || []),
  ]);
}

function packetForShot(packet: BuiltTaskPacket, shotId: string): boolean {
  return packet.packetId.includes(shotId)
    || packet.envelope?.taskEnvelope.keyframePairDerivation?.shotId === shotId
    || taskPacketExpectedOutputs(packet).some((output) => output.includes(`/shots/${shotId}/`) || output.includes(`/${shotId}_`));
}

function envelopeForShot(envelope: TaskEnvelope, shotId: string): boolean {
  return envelope.id.includes(shotId)
    || envelope.promptPlanId?.includes(shotId) === true
    || envelope.expectedOutputs.some((output) => output.includes(`/shots/${shotId}/`) || output.includes(`/${shotId}_`));
}

function rolesForShot(input: BuildRealProviderPilotInput, shotId: string): RealProviderPilotOutputRole[] {
  const roles = uniqueInOrder([
    ...(input.taskPackets || []).filter((packet) => packetForShot(packet, shotId)).map((packet) => outputRoleFromText(packet.taskKind)),
    ...(input.taskEnvelopes || []).filter((envelope) => envelopeForShot(envelope, shotId)).flatMap((envelope) => envelope.expectedOutputs.map(outputRoleFromText)),
    ...(input.imageTaskPlans || []).filter((taskPlan) => taskPlan.shotId === shotId).map((taskPlan) => outputRoleFromText(taskPlan.expectedOutputPath)),
  ]) as RealProviderPilotOutputRole[];
  return roles.length ? roles : ["start_frame", "end_frame"];
}

function buildExpectedOutputs(input: BuildRealProviderPilotInput, sandboxRoot?: string): RealProviderPilotOutputPlanItem[] {
  const outputs: RealProviderPilotOutputPlanItem[] = [];
  for (const shotId of uniqueInOrder(input.selectedShotIds || [])) {
    for (const role of rolesForShot(input, shotId)) {
      const relativePath = conventionPath(shotId, role);
      outputs.push({
        shotId,
        role,
        suggestedRelativePath: relativePath,
        suggestedSandboxPath: sandboxPath(sandboxRoot, relativePath),
        source: "naming_convention",
        noFileMutation: true,
      });
    }
  }
  return outputs;
}

function buildSelectedShots(input: BuildRealProviderPilotInput, sandboxRoot?: string): RealProviderPilotSelectedShot[] {
  return uniqueInOrder(input.selectedShotIds || []).map((shotId) => {
    const roles = rolesForShot(input, shotId);
    const taskEnvelopeIds = uniqueInOrder((input.taskEnvelopes || []).filter((envelope) => envelopeForShot(envelope, shotId)).map((envelope) => envelope.id));
    const taskPacketIds = uniqueInOrder((input.taskPackets || []).filter((packet) => packetForShot(packet, shotId)).map((packet) => packet.packetId));
    const taskPlanIds = uniqueInOrder((input.imageTaskPlans || []).filter((taskPlan) => taskPlan.shotId === shotId).map((taskPlan) => taskPlan.taskPlanId));
    return {
      shotId,
      sourceRefs: uniqueSorted([
        `shot:${shotId}`,
        ...taskEnvelopeIds.map((id) => `taskEnvelope:${id}`),
        ...taskPacketIds.map((id) => `taskPacket:${id}`),
        ...taskPlanIds.map((id) => `imageTaskPlan:${id}`),
      ]),
      expectedImageRoles: roles,
      suggestedOutputPaths: roles.map((role) => sandboxPath(sandboxRoot, conventionPath(shotId, role)) || conventionPath(shotId, role)),
      taskEnvelopeIds,
      taskPacketIds,
      taskPlanIds,
    };
  });
}

function check(
  checkId: RealProviderPilotCheck["checkId"],
  label: string,
  passed: boolean,
  blocker: string,
  sourceRef?: string,
): RealProviderPilotCheck {
  return { checkId, label, required: true, passed, blocker: passed ? undefined : blocker, sourceRef };
}

export function buildRealProviderPilotState(input: BuildRealProviderPilotInput): RealProviderPilotState {
  const mode = input.mode || "pilot_review";
  const maxBatchSize = Math.min(3, Math.max(1, input.maxBatchSize || 3));
  const sandboxRoot = input.outputSandbox?.root?.trim() ? normalizePath(input.outputSandbox.root) : undefined;
  const sandboxPaths = uniqueInOrder([
    sandboxRoot,
    ...(input.outputSandbox?.allowedPrefixes || []),
    input.outputSandbox?.manifestPath,
    input.outputSandbox?.qaReportPath,
    input.outputSandbox?.ledgerPath,
  ]);
  const selectedProviderPlan = providerPlan(input.providerPlan);
  const parkedProviderInputs: RealProviderPilotProviderPlanInput[] = input.parkedFutureProviderPlans?.length
    ? input.parkedFutureProviderPlans
    : [{ providerId: "seedance2-provider", adapterId: "seedance-parked", providerSlot: "video.i2v", requiredMode: "frames2video", executionState: "parked" }];
  const parkedFutureProviderPlans = parkedProviderInputs.map(providerPlan);
  const selectedShotIds = uniqueInOrder(input.selectedShotIds || []);
  const items = selectedPlans({ ...input, maxBatchSize }).map((taskPlan) => buildItem(input, taskPlan));
  const expectedOutputs = buildExpectedOutputs(input, sandboxRoot);
  const hasEnvelopeOrPacket = Boolean((input.taskEnvelopes?.length || 0) + (input.taskPackets?.length || 0));
  const sandboxValid = Boolean(sandboxRoot)
    && sandboxPaths.every(isSafeRelativePath)
    && Boolean(input.outputSandbox?.manifestPath)
    && Boolean(input.outputSandbox?.qaReportPath);
  const estimatedImageCountValid = Number.isInteger(input.expectedImageCount) && (input.expectedImageCount || 0) > 0;
  const checks = [
    check("selected_project", "Selected project id", Boolean(input.projectId.trim()), "Project id is required.", input.projectId),
    check("project_title", "Project title", mode === "locked" || Boolean(input.projectTitle?.trim()), "Project title is required.", input.projectTitle),
    check("selected_shots", "Selected shots", mode === "locked" || selectedShotIds.length > 0, "At least one selected shot is required.", selectedShotIds.join(",")),
    check("output_sandbox", "Output sandbox/root", mode === "locked" || sandboxValid, "Output sandbox root, manifest path, and QA report path must be safe project-root-relative paths.", sandboxRoot),
    check("provider_slot", "Provider slot", mode === "locked" || Boolean(input.providerPlan?.providerSlot), "Provider slot is required.", input.providerPlan?.providerSlot),
    check("provider_adapter", "Provider adapter", mode === "locked" || Boolean(input.providerPlan?.adapterId?.trim() && input.providerPlan?.providerId?.trim()), "Provider id and adapter id are required.", input.providerPlan?.adapterId),
    check("image2_first_provider", "Image2 First provider", mode === "locked" || selectedProviderPlan.image2FirstEligible, "First pilot must use an Image2 image slot; Seedance/video stays parked.", selectedProviderPlan.providerSlot),
    check("task_envelope_or_packet", "Task envelope or task packet", mode === "locked" || hasEnvelopeOrPacket, "At least one task envelope or task packet is required.", `${input.taskEnvelopes?.length || 0}:${input.taskPackets?.length || 0}`),
    check("estimated_image_count", "Estimated image count", mode === "locked" || estimatedImageCountValid, "Estimated image count is required and must be a positive integer.", String(input.expectedImageCount ?? "")),
    check("hard_locks", "Hard locks", realProviderPilotHardLocks.actualExecutionAllowed === false && realProviderPilotHardLocks.providerSubmitAllowedBoolean === false && realProviderPilotHardLocks.credentialAccessAllowed === false && realProviderPilotHardLocks.canSpawnWorker === false && realProviderPilotHardLocks.noFileMutation === true && realProviderPilotHardLocks.dryRunOnly === true, "Pilot hard locks must keep execution, provider submit, credential access, worker spawn, and file mutation disabled.", "realProviderPilotHardLocks"),
  ];
  const locked = items.filter((item) => item.status === "locked").length;
  const itemBlocked = items.filter((item) => item.status === "blocked").length;
  const reviewReady = items.filter((item) => item.status === "review_ready").length;
  const blockers = uniqueSorted([
    ...checks.flatMap((item) => item.blocker ? [item.blocker] : []),
    ...selectedProviderPlan.blockers,
    ...items.flatMap((item) => item.blockers),
  ]);
  const status: RealProviderPilotStatus = mode === "locked" ? "locked" : blockers.length || itemBlocked > 0 ? "blocked" : "review_ready";
  const selectedShots = buildSelectedShots(input, sandboxRoot);
  const manifestEntries = selectedShotIds.map((shotId) => ({
    shotId,
    expectedOutputs: expectedOutputs.filter((output) => output.shotId === shotId).map((output) => output.suggestedSandboxPath || output.suggestedRelativePath),
    status: "planned_for_review" as const,
  }));

  return {
    schemaVersion: realProviderPilotSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_43_real_provider_pilot",
    pilotKind: "image2_first_small_batch",
    mode,
    status,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    batchId: input.batchId,
    maxBatchSize,
    selectedShotIds,
    selectedTaskPlanIds: items.map((item) => item.taskPlanId),
    items,
    parkedProviders: [
      { providerId: "seedance2-provider", slot: "video.i2v", state: "parked", liveSubmitAllowed: false, reason: "Image2 First pilot parks Seedance/video routes until a separate video pilot gate exists." },
      { providerId: "jimeng-video", slot: "video.i2v", state: "parked", liveSubmitAllowed: false, reason: "Video providers are excluded from the Image2 First pilot batch." },
    ],
    scopeSummary: {
      projectId: input.projectId,
      projectTitle: input.projectTitle,
      selectedShotCount: selectedShotIds.length,
      estimatedImageCount: input.expectedImageCount,
      outputSandboxRoot: sandboxRoot,
      providerSlot: selectedProviderPlan.providerSlot,
      providerId: selectedProviderPlan.providerId,
      adapterId: selectedProviderPlan.adapterId,
      image2FirstOnly: true,
      seedanceParkedForFuture: true,
      maxBatchSize: 3,
      reviewReadyOnly: status === "review_ready",
    },
    providerPlan: selectedProviderPlan,
    parkedFutureProviderPlans,
    selectedShots,
    expectedOutputPlan: {
      sandboxRoot,
      namingConvention: ["shots/<shotId>/start.png", "shots/<shotId>/end.png", "shots/<shotId>/reference.png"],
      estimatedImageCount: input.expectedImageCount,
      outputs: expectedOutputs,
      noFileMutation: true,
    },
    manifestPlan: {
      manifestPath: input.outputSandbox?.manifestPath ? normalizePath(input.outputSandbox.manifestPath) : undefined,
      entryCount: manifestEntries.length,
      entries: manifestEntries,
      writeAllowed: false,
      noFileMutation: true,
    },
    watcherLinkPlan: {
      sandboxRoot,
      watchGlobs: sandboxRoot ? [`${sandboxRoot}/shots/**/*.png`, `${sandboxRoot}/manifest.json`, `${sandboxRoot}/qa/**/*.json`] : [],
      manifestPath: input.outputSandbox?.manifestPath ? normalizePath(input.outputSandbox.manifestPath) : undefined,
      qaReportPath: input.outputSandbox?.qaReportPath ? normalizePath(input.outputSandbox.qaReportPath) : undefined,
      linkedForFutureReview: true,
      watcherStarted: false,
      noFileMutation: true,
    },
    qaRequiredGates: [
      { gateId: "identity_gate", label: "Identity and locked reference consistency", required: true, reviewStage: "before_future_submit" },
      { gateId: "scene_gate", label: "Scene/layout authority consistency", required: true, reviewStage: "before_future_submit" },
      { gateId: "start_end_pair_gate", label: "Start/end keyframe pair coherence", required: true, reviewStage: "before_future_submit" },
      { gateId: "prompt_route_gate", label: "Image2 route and fallback policy review", required: true, reviewStage: "before_future_submit" },
      { gateId: "artifact_gate", label: "Generated image artifact inspection", required: true, reviewStage: "after_future_output" },
      { gateId: "human_final_gate", label: "Human approval before any promotion", required: true, reviewStage: "after_future_output" },
    ],
    userConfirmationRequirements: [
      { requirementId: "confirm_project_scope", label: "User confirms project/title and selected shots.", requiredBeforeAnyFutureSubmit: true, satisfied: false },
      { requirementId: "confirm_image2_first_only", label: "User confirms this pilot is Image2 First only; Seedance remains parked.", requiredBeforeAnyFutureSubmit: true, satisfied: false },
      { requirementId: "confirm_output_sandbox", label: "User confirms the output sandbox/root and naming plan.", requiredBeforeAnyFutureSubmit: true, satisfied: false },
      { requirementId: "confirm_provider_adapter", label: "User confirms provider slot and adapter are the intended future route.", requiredBeforeAnyFutureSubmit: true, satisfied: false },
      { requirementId: "confirm_cost_risk_placeholder", label: "User acknowledges cost is a placeholder until live pricing is reviewed.", requiredBeforeAnyFutureSubmit: true, satisfied: false },
      { requirementId: "confirm_no_actual_submit", label: "User acknowledges this state cannot submit providers, read credentials, spawn workers, or write files.", requiredBeforeAnyFutureSubmit: true, satisfied: false },
    ],
    costRiskEstimatePlaceholder: {
      estimatedImageCount: input.expectedImageCount,
      currency: "TBD",
      unitCost: "TBD",
      estimatedTotalCost: "TBD",
      riskLevel: "low_small_batch_unknown_cost",
      notes: [
        "Pricing is intentionally not read from credentials or provider APIs.",
        "A future live-submit phase must fill unit cost and receive explicit user approval first.",
      ],
      userMustApproveBeforeAnyFutureSubmit: true,
    },
    checks,
    blockers,
    warnings: uniqueSorted([
      ...selectedProviderPlan.warnings,
      ...parkedFutureProviderPlans.flatMap((item) => item.seedanceParked ? ["Seedance/video provider plan is recorded as parked/future only."] : item.warnings),
      input.expectedImageCount && expectedOutputs.length && input.expectedImageCount !== expectedOutputs.length ? `Estimated image count (${input.expectedImageCount}) differs from planned output count (${expectedOutputs.length}); user review must reconcile it.` : "",
    ]),
    summary: {
      totalItems: items.length,
      locked,
      blocked: itemBlocked,
      reviewReady,
      image2Items: items.length,
      videoItems: 0,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      workerSpawnsAllowed: 0,
      fileMutationsAllowed: 0,
      actualExecutionAllowed: false,
      dryRunOnly: true,
    },
    hardLocks: realProviderPilotHardLocks,
    forbiddenActions: [
      "provider_submit",
      "credential_read",
      "credential_write",
      "worker_spawn",
      "file_mutation",
      "subprocess",
      "shell_execution",
      "image2_execution",
      "seedance_execution",
      "seedance_submit",
      "video_submit",
      "unscoped_real_provider",
    ],
    actualExecutionAllowed: false,
    providerSubmitAllowed: false,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    noFileMutation: true,
    dryRunOnly: true,
    notes: [
      "Phase 43 records the Real Provider Pilot scope as typed state only.",
      "review_ready means ready for user review only; it does not open submit, credential, worker, Image2/Seedance execution, or file mutation routes.",
      "The pilot is Image2 First and small-batch; Seedance/video providers stay parked.",
    ],
  };
}
