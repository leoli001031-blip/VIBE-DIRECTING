import type { DirectorWorkflowState } from "./directorWorkflow";
import type { DirectorEditAffectedArtifact, DirectorEditPlan, DirectorEditSelection } from "./directorEdit";
import type { ProjectRuntimeState } from "./projectState";
import { ingestQueueDecision, type RuntimeQueueIngestResult } from "./runtimeIngestShell";
import type { BuiltTaskPacket, TaskPacketBuilderState, TaskPacketKind } from "./taskPacketBuilder";
import type { AppendableTaskRunLedgerEvent } from "./taskRunLedger";
import type { ProviderExecutionState, StoryChangeTransaction, TaskEnvelope } from "./types";

export const projectTransactionSchemaVersion = "0.1.0";

export type ProjectTransactionKind =
  | "story_change"
  | "asset_update"
  | "shot_reflow"
  | "artifact_invalidation"
  | "task_enqueue";

export type ProjectTransactionUserStatus =
  | "waiting_confirmation"
  | "pending_project_facts"
  | "queued"
  | "parked"
  | "blocked_missing_knowledge_trace"
  | "blocked";

export type ProjectTransactionChangeKind =
  | "character"
  | "scene"
  | "style"
  | "shot_order"
  | "shot_content"
  | "asset"
  | "voice"
  | "export";

export type ProjectTransactionQueueStatus = "queued" | "parked" | "blocked";

export interface ProjectTransactionSourceFacts {
  projectId: string;
  projectVersion: string;
  projectHash: string;
  sourceIndexHash: string;
  generatedAt: string;
  selection: DirectorEditSelection;
  userIntent: string;
  taskEnvelopeIds: string[];
  sourceRefs: string[];
  knowledgeInjectionTrace: ProjectKnowledgeInjectionTraceSummary;
}

export interface ProjectKnowledgeInjectionTraceItem {
  packetId: string;
  taskKind: TaskPacketKind;
  envelopeId?: string;
  taskEnvelopeId?: string;
  knowledgeRouteResultId?: string;
  contextBudgetId?: string;
  packCount: number;
  snippetIdCount: number;
  snippetCount: number;
  status: "present" | "missing";
  warnings: string[];
}

export interface ProjectKnowledgeInjectionTraceSummary {
  status: "present" | "missing";
  totalTaskEnvelopes: number;
  taskEnvelopesWithTrace: number;
  missingTaskEnvelopeIds: string[];
  items: ProjectKnowledgeInjectionTraceItem[];
}

export interface ProjectStaleArtifactRef {
  artifactId: string;
  artifactType: DirectorEditAffectedArtifact["artifactType"];
  targetId?: string;
  staleReason: string;
  requiresRegeneration: boolean;
  affectedTaskKinds: TaskPacketKind[];
  affectedEnvelopeIds: string[];
  affectedExpectedOutputs: string[];
}

export interface ProjectArtifactInvalidationSummary {
  changeKinds: ProjectTransactionChangeKind[];
  affectedShotIds: string[];
  affectedTaskRunIds: string[];
  affectedEnvelopeIds: string[];
  affectedExpectedOutputs: string[];
  staleArtifacts: ProjectStaleArtifactRef[];
  deleteForbidden: true;
  notes: string[];
}

export interface ProjectTransactionComponent {
  kind: ProjectTransactionKind;
  sourceId: string;
  status: "pending";
  targetIds: string[];
  summary: string;
  noFileMutation: true;
}

export interface ProjectTaskEnqueuePlanItem {
  taskRunId: string;
  packetId: string;
  taskKind: TaskPacketKind;
  envelopeId?: string;
  taskEnvelopeId?: string;
  expectedOutputs: string[];
  providerExecutionState?: ProviderExecutionState;
  providerPolicyStatus: "enabled" | "parked" | "planned" | "unavailable";
  userEnabled: boolean;
  preflightBlocked: boolean;
  validationErrors: string[];
  knowledgeTraceStatus: "present" | "missing";
  queueStatus: ProjectTransactionQueueStatus;
  queueDecision: RuntimeQueueIngestResult;
  ledgerEvents: AppendableTaskRunLedgerEvent[];
}

export interface ProjectTaskEnqueuePlan {
  status: ProjectTransactionQueueStatus | "empty";
  validatedEnvelopeRequired: true;
  noFreeTextTask: true;
  providerSubmissionForbidden: true;
  items: ProjectTaskEnqueuePlanItem[];
  summary: {
    total: number;
    queued: number;
    parked: number;
    blocked: number;
    missingKnowledgeTrace: number;
    ledgerEventCount: number;
  };
}

export interface ProjectVibePendingWritePlanEntry {
  id: string;
  operation: "append_pending_transaction";
  path: string;
  origin: "project_root_relative";
  canExecute: false;
  noFileMutation: true;
  projectVibeWriteAllowed: false;
  notes: string[];
}

export interface ProjectVibeWritePlan {
  mode: "pending_only";
  transactionId: string;
  noFileMutation: true;
  projectVibeWriteAllowed: false;
  entries: ProjectVibePendingWritePlanEntry[];
  futureApplyInterface: {
    confirmPendingTransaction: true;
    applyToProjectFacts: false;
    enqueueValidatedTasks: false;
    requiresKnowledgeTrace: true;
  };
  notes: string[];
}

export interface ProjectPendingTransaction {
  id: string;
  schemaVersion: typeof projectTransactionSchemaVersion;
  status: "pending";
  userStatus: ProjectTransactionUserStatus;
  createdAt: string;
  sourceFacts: ProjectTransactionSourceFacts;
  components: ProjectTransactionComponent[];
  storyChange: StoryChangeTransaction;
  assetUpdate: ProjectTransactionComponent;
  shotReflow: ProjectTransactionComponent;
  artifactInvalidation: ProjectArtifactInvalidationSummary;
  taskEnqueue: ProjectTaskEnqueuePlan;
  noFileMutation: true;
  providerSubmissionForbidden: true;
  projectVibeWriteAllowed: false;
}

export interface ProjectTransactionRuntimeState {
  schemaVersion: typeof projectTransactionSchemaVersion;
  generatedAt: string;
  userStatus: ProjectTransactionUserStatus;
  pendingTransaction: ProjectPendingTransaction;
  projectVibeWritePlan: ProjectVibeWritePlan;
  queueIngestSummary: ProjectTaskEnqueuePlan["summary"];
  runtimeEvents: Array<{
    taskRunId: string;
    envelopeId?: string;
    status: ProjectTransactionQueueStatus;
    ledgerEvents: AppendableTaskRunLedgerEvent[];
    blockers: string[];
    warnings: string[];
  }>;
  hardLocks: {
    pendingOnly: true;
    noFileMutation: true;
    projectVibeWriteAllowed: false;
    providerSubmissionForbidden: true;
    workerSpawnForbidden: true;
  };
  nextUiProjection: {
    status: ProjectTransactionUserStatus;
    shortLabel: string;
    queuedCount: number;
    parkedCount: number;
    blockedCount: number;
    staleArtifactCount: number;
  };
}

export interface BuildProjectTransactionRuntimeInput {
  workflowState: Pick<
    DirectorWorkflowState,
    "generatedAt" | "status" | "confirmationRequired" | "blockedReasons" | "editPlan" | "taskPacketState"
  >;
  runtimeState?: ProjectRuntimeState;
  projectId?: string;
  projectVersion?: string;
  sourceIndexHash?: string;
  userConfirmed?: boolean;
  userEnabled?: boolean;
  capacityStatus?: "available" | "full";
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort() as T[];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vtx_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "project";
}

function packetTaskEnvelope(packet: BuiltTaskPacket): TaskEnvelope | undefined {
  return packet.envelope?.taskEnvelope;
}

function packetEnvelopeId(packet: BuiltTaskPacket): string | undefined {
  return packet.envelope?.id || packet.envelopeId;
}

function traceItem(packet: BuiltTaskPacket): ProjectKnowledgeInjectionTraceItem {
  const taskEnvelope = packetTaskEnvelope(packet);
  const packCount = taskEnvelope?.injectedKnowledgePacks?.length || 0;
  const snippetIdCount = taskEnvelope?.injectedKnowledgeSnippetIds?.length || 0;
  const snippetCount = taskEnvelope?.injectedKnowledgeSnippets?.length || 0;
  const status = packCount > 0 && (snippetIdCount > 0 || snippetCount > 0) ? "present" : "missing";
  return {
    packetId: packet.packetId,
    taskKind: packet.taskKind,
    envelopeId: packetEnvelopeId(packet),
    taskEnvelopeId: taskEnvelope?.id,
    knowledgeRouteResultId: taskEnvelope?.knowledgeRouteResultId,
    contextBudgetId: taskEnvelope?.contextBudgetId,
    packCount,
    snippetIdCount,
    snippetCount,
    status,
    warnings: status === "missing" ? ["TaskEnvelope is missing injectedKnowledgePacks or snippet trace."] : [],
  };
}

function knowledgeTraceSummary(packetState: TaskPacketBuilderState): ProjectKnowledgeInjectionTraceSummary {
  const items = packetState.packets.filter((packet) => packet.envelope).map(traceItem);
  const missing = items.filter((item) => item.status === "missing");
  return {
    status: missing.length ? "missing" : "present",
    totalTaskEnvelopes: items.length,
    taskEnvelopesWithTrace: items.length - missing.length,
    missingTaskEnvelopeIds: missing.map((item) => item.taskEnvelopeId || item.envelopeId || item.packetId),
    items,
  };
}

function sourceIndexHashFor(input: BuildProjectTransactionRuntimeInput): string {
  return (
    input.sourceIndexHash ||
    input.runtimeState?.sourceIndexSummary?.sourceIndexHash ||
    input.runtimeState?.sourceIndex?.sourceIndexHash ||
    input.workflowState.taskPacketState.packets.map(packetTaskEnvelope).find((envelope) => envelope?.sourceIndexHash)?.sourceIndexHash ||
    ""
  );
}

function projectIdFor(input: BuildProjectTransactionRuntimeInput): string {
  return input.projectId || input.runtimeState?.sourceIndexSummary?.projectId || safeId(input.runtimeState?.project?.title || "project");
}

function projectVersionFor(input: BuildProjectTransactionRuntimeInput): string {
  return input.projectVersion || input.runtimeState?.sourceIndexSummary?.projectVersion || "0.1.0";
}

function sourceFacts(input: BuildProjectTransactionRuntimeInput, trace: ProjectKnowledgeInjectionTraceSummary): ProjectTransactionSourceFacts {
  const projectId = projectIdFor(input);
  const projectVersion = projectVersionFor(input);
  const sourceIndexHash = sourceIndexHashFor(input);
  const taskEnvelopeIds = input.workflowState.taskPacketState.packets
    .map((packet) => packetTaskEnvelope(packet)?.id)
    .filter((id): id is string => Boolean(id));
  return {
    projectId,
    projectVersion,
    projectHash: stableHash({
      projectId,
      projectVersion,
      sourceIndexHash,
      taskEnvelopeIds,
      selection: input.workflowState.editPlan.selection,
      userIntent: input.workflowState.editPlan.userIntent,
    }),
    sourceIndexHash,
    generatedAt: input.workflowState.generatedAt,
    selection: input.workflowState.editPlan.selection,
    userIntent: input.workflowState.editPlan.userIntent,
    taskEnvelopeIds,
    sourceRefs: unique(["director_workflow", input.workflowState.editPlan.id, input.workflowState.editPlan.transaction.id, sourceIndexHash]),
    knowledgeInjectionTrace: trace,
  };
}

function changeKindsFor(editPlan: DirectorEditPlan): ProjectTransactionChangeKind[] {
  const text = `${editPlan.userIntent} ${editPlan.transaction.intentType} ${editPlan.transaction.operation}`.toLowerCase();
  return unique([
    /角色|人物|character|identity|服装/.test(text) || editPlan.transaction.operation === "update_character" ? "character" : "",
    /场景|地点|空间|scene|location|layout/.test(text) || editPlan.transaction.operation === "update_scene" ? "scene" : "",
    /风格|色彩|光线|style|look|mood|冷|暖|压抑/.test(text) || editPlan.transaction.operation === "update_style" ? "style" : "",
    /顺序|移动|插入|删除|节奏|reorder|move|insert|delete/.test(text) ||
    ["move_shot", "insert_shot", "delete_shot"].includes(editPlan.transaction.operation)
      ? "shot_order"
      : "",
    editPlan.selection.scopeKind === "asset" || editPlan.transaction.intentType === "asset" ? "asset" : "",
    editPlan.selection.scopeKind === "voice" || editPlan.transaction.intentType === "voice" ? "voice" : "",
    editPlan.selection.scopeKind === "export" || editPlan.transaction.intentType === "export" ? "export" : "",
    editPlan.selection.scopeKind === "shot" || editPlan.selection.scopeKind === "multi-shot" ? "shot_content" : "",
  ] as ProjectTransactionChangeKind[]);
}

function packetMatchesTarget(packet: BuiltTaskPacket, targetId: string | undefined): boolean {
  if (!targetId) return true;
  const envelope = packet.envelope;
  const taskEnvelope = envelope?.taskEnvelope;
  return Boolean(
    envelope?.shotId === targetId ||
      envelope?.sectionId === targetId ||
      taskEnvelope?.dependencies.includes(targetId) ||
      taskEnvelope?.expectedOutputs.some((output) => output.includes(targetId)),
  );
}

function invalidationSummary(editPlan: DirectorEditPlan, packetState: TaskPacketBuilderState): ProjectArtifactInvalidationSummary {
  const staleArtifacts = editPlan.affectedArtifacts.map((artifact) => {
    const affectedPackets = packetState.packets.filter((packet) => packet.envelope && packetMatchesTarget(packet, artifact.targetId));
    return {
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      targetId: artifact.targetId,
      staleReason: artifact.staleReason,
      requiresRegeneration: artifact.requiresRegeneration,
      affectedTaskKinds: unique(affectedPackets.map((packet) => packet.taskKind)) as TaskPacketKind[],
      affectedEnvelopeIds: unique(affectedPackets.map((packet) => packetTaskEnvelope(packet)?.id || "")),
      affectedExpectedOutputs: unique(affectedPackets.flatMap((packet) => packetTaskEnvelope(packet)?.expectedOutputs || [])),
    };
  });
  const affectedEnvelopeIds = unique(staleArtifacts.flatMap((item) => item.affectedEnvelopeIds));
  const affectedExpectedOutputs = unique(staleArtifacts.flatMap((item) => item.affectedExpectedOutputs));
  const affectedShotIds = unique([
    ...(editPlan.selection.shotIds || []),
    editPlan.selection.shotId || "",
    ...editPlan.affectedArtifacts.map((artifact) => artifact.targetId || ""),
    ...packetState.packets.map((packet) => packet.envelope?.shotId || ""),
  ]);
  return {
    changeKinds: changeKindsFor(editPlan),
    affectedShotIds,
    affectedTaskRunIds: affectedEnvelopeIds.map((envelopeId) => `task_run_${safeId(envelopeId)}`),
    affectedEnvelopeIds,
    affectedExpectedOutputs,
    staleArtifacts,
    deleteForbidden: true,
    notes: [
      "Artifacts are marked stale for user review; no output, sidecar, report, or preview file is deleted.",
      "Future regeneration tasks must be created from validated TaskEnvelope facts, never free text.",
    ],
  };
}

function providerPolicyStatusFor(executionState: ProviderExecutionState | undefined): ProjectTaskEnqueuePlanItem["providerPolicyStatus"] {
  if (executionState === "active" || executionState === "enabled" || executionState === "available") return "enabled";
  if (executionState === "parked") return "parked";
  if (executionState === "planned") return "planned";
  return "unavailable";
}

function validateTaskEnvelopeForQueue(packet: BuiltTaskPacket, userConfirmed: boolean): string[] {
  const envelope = packetTaskEnvelope(packet);
  if (!userConfirmed) return ["waiting_confirmation"];
  if (packet.status !== "ready") return packet.blockedReasons.length ? packet.blockedReasons : ["packet_not_ready"];
  if (!envelope) return ["validated_task_envelope_missing"];
  const trace = traceItem(packet);
  return unique([
    envelope.id ? "" : "task_envelope_id_missing",
    envelope.sourceIndexHash ? "" : "source_index_hash_missing",
    envelope.expectedOutputs.length ? "" : "expected_outputs_missing",
    envelope.qaChecklist.length ? "" : "qa_checklist_missing",
    envelope.preflight.status === "pass" ? "" : "task_envelope_preflight_blocked",
    ...envelope.blockingReasons.map((reason) => `task_envelope_blocking_reason:${reason}`),
    trace.status === "present" ? "" : "blocked_missing_knowledge_trace",
  ]);
}

function queuePlanFor(input: BuildProjectTransactionRuntimeInput, trace: ProjectKnowledgeInjectionTraceSummary): ProjectTaskEnqueuePlan {
  const userConfirmed = input.userConfirmed === true;
  const userEnabled = input.userEnabled === true;
  const items = input.workflowState.taskPacketState.packets.map((packet) => {
    const envelope = packetTaskEnvelope(packet);
    const validationErrors = validateTaskEnvelopeForQueue(packet, userConfirmed);
    const taskRunId = `task_run_${safeId(envelope?.id || packet.packetId)}`;
    const providerPolicyStatus = providerPolicyStatusFor(envelope?.executionState);
    const queueDecision = ingestQueueDecision({
      taskRunId,
      envelopeId: envelope?.id,
      at: input.workflowState.generatedAt,
      providerPolicyStatus,
      userEnabled,
      capacityStatus: input.capacityStatus || "available",
      preflightBlocked: validationErrors.length > 0,
      reason: validationErrors[0] || (userEnabled ? undefined : "User has not enabled formal execution."),
    });
    return {
      taskRunId,
      packetId: packet.packetId,
      taskKind: packet.taskKind,
      envelopeId: packetEnvelopeId(packet),
      taskEnvelopeId: envelope?.id,
      expectedOutputs: envelope?.expectedOutputs || [],
      providerExecutionState: envelope?.executionState,
      providerPolicyStatus,
      userEnabled,
      preflightBlocked: validationErrors.length > 0,
      validationErrors,
      knowledgeTraceStatus: trace.items.find((item) => item.packetId === packet.packetId)?.status || "missing",
      queueStatus: queueDecision.status,
      queueDecision,
      ledgerEvents: queueDecision.ledgerEvents,
    };
  });
  const summary = {
    total: items.length,
    queued: items.filter((item) => item.queueStatus === "queued").length,
    parked: items.filter((item) => item.queueStatus === "parked").length,
    blocked: items.filter((item) => item.queueStatus === "blocked").length,
    missingKnowledgeTrace: items.filter((item) => item.validationErrors.includes("blocked_missing_knowledge_trace")).length,
    ledgerEventCount: items.reduce((count, item) => count + item.ledgerEvents.length, 0),
  };
  return {
    status: summary.total === 0 ? "empty" : summary.blocked ? "blocked" : summary.queued ? "queued" : "parked",
    validatedEnvelopeRequired: true,
    noFreeTextTask: true,
    providerSubmissionForbidden: true,
    items,
    summary,
  };
}

function component(kind: ProjectTransactionKind, sourceId: string, targetIds: string[], summary: string): ProjectTransactionComponent {
  return {
    kind,
    sourceId,
    status: "pending",
    targetIds: unique(targetIds),
    summary,
    noFileMutation: true,
  };
}

function transactionComponents(editPlan: DirectorEditPlan, invalidation: ProjectArtifactInvalidationSummary): ProjectTransactionComponent[] {
  return [
    component("story_change", editPlan.transaction.id, editPlan.transaction.targetIds, `Pending ${editPlan.transaction.operation} story transaction.`),
    component("asset_update", editPlan.id, editPlan.selection.assetId ? [editPlan.selection.assetId] : editPlan.transaction.targetIds, "Pending asset memory update plan."),
    component("shot_reflow", editPlan.reflowImpactReport.id, invalidation.affectedShotIds, "Pending shot reflow impact plan."),
    component("artifact_invalidation", editPlan.reflowImpactReport.id, invalidation.staleArtifacts.map((item) => item.artifactId), "Pending stale artifact markers."),
    component("task_enqueue", editPlan.id, invalidation.affectedEnvelopeIds, "Pending validated task enqueue plan."),
  ];
}

function userStatusFor(input: BuildProjectTransactionRuntimeInput, queuePlan: ProjectTaskEnqueuePlan): ProjectTransactionUserStatus {
  if (input.workflowState.blockedReasons.some((reason) => !reason.startsWith("blocked_missing_context:"))) return "blocked";
  if (input.userConfirmed !== true && (input.workflowState.confirmationRequired || input.workflowState.editPlan.confirmationRequired)) {
    return "waiting_confirmation";
  }
  if (queuePlan.summary.missingKnowledgeTrace > 0) return "blocked_missing_knowledge_trace";
  if (queuePlan.summary.blocked > 0) return "blocked";
  if (queuePlan.summary.total === 0) return "pending_project_facts";
  if (queuePlan.summary.queued > 0) return "queued";
  if (queuePlan.summary.parked > 0) return "parked";
  return "pending_project_facts";
}

function shortLabelFor(status: ProjectTransactionUserStatus): string {
  const labels: Record<ProjectTransactionUserStatus, string> = {
    waiting_confirmation: "Waiting for confirmation",
    pending_project_facts: "Pending project facts",
    queued: "Queued",
    parked: "Parked",
    blocked_missing_knowledge_trace: "Blocked: missing knowledge trace",
    blocked: "Blocked",
  };
  return labels[status];
}

function writePlan(transactionId: string): ProjectVibeWritePlan {
  return {
    mode: "pending_only",
    transactionId,
    noFileMutation: true,
    projectVibeWriteAllowed: false,
    entries: [
      {
        id: `pending_write_${transactionId}`,
        operation: "append_pending_transaction",
        path: "project.vibe",
        origin: "project_root_relative",
        canExecute: false,
        noFileMutation: true,
        projectVibeWriteAllowed: false,
        notes: ["This is a pending transaction append plan only; no project.vibe file is written."],
      },
    ],
    futureApplyInterface: {
      confirmPendingTransaction: true,
      applyToProjectFacts: false,
      enqueueValidatedTasks: false,
      requiresKnowledgeTrace: true,
    },
    notes: [
      "Project.vibe remains the future source of truth, but this round records only a pending write plan.",
      "A future sidecar must flip projectVibeWriteAllowed before any real file mutation can occur.",
    ],
  };
}

export function buildProjectTransactionRuntime(input: BuildProjectTransactionRuntimeInput): ProjectTransactionRuntimeState {
  const trace = knowledgeTraceSummary(input.workflowState.taskPacketState);
  const facts = sourceFacts(input, trace);
  const invalidation = invalidationSummary(input.workflowState.editPlan, input.workflowState.taskPacketState);
  const taskEnqueue = queuePlanFor(input, trace);
  const transactionId = `project_tx_${stableHash({
    createdAt: input.workflowState.generatedAt,
    editPlanId: input.workflowState.editPlan.id,
    projectHash: facts.projectHash,
  }).replace(/^vtx_/, "")}`;
  const components = transactionComponents(input.workflowState.editPlan, invalidation);
  const userStatus = userStatusFor(input, taskEnqueue);
  const pendingTransaction: ProjectPendingTransaction = {
    id: transactionId,
    schemaVersion: projectTransactionSchemaVersion,
    status: "pending",
    userStatus,
    createdAt: input.workflowState.generatedAt,
    sourceFacts: facts,
    components,
    storyChange: input.workflowState.editPlan.transaction,
    assetUpdate: components.find((item) => item.kind === "asset_update") as ProjectTransactionComponent,
    shotReflow: components.find((item) => item.kind === "shot_reflow") as ProjectTransactionComponent,
    artifactInvalidation: invalidation,
    taskEnqueue,
    noFileMutation: true,
    providerSubmissionForbidden: true,
    projectVibeWriteAllowed: false,
  };
  const projectVibeWritePlan = writePlan(transactionId);

  return {
    schemaVersion: projectTransactionSchemaVersion,
    generatedAt: input.workflowState.generatedAt,
    userStatus,
    pendingTransaction,
    projectVibeWritePlan,
    queueIngestSummary: taskEnqueue.summary,
    runtimeEvents: taskEnqueue.items.map((item) => ({
      taskRunId: item.taskRunId,
      envelopeId: item.taskEnvelopeId,
      status: item.queueStatus,
      ledgerEvents: item.ledgerEvents,
      blockers: item.queueDecision.blockers,
      warnings: item.queueDecision.warnings,
    })),
    hardLocks: {
      pendingOnly: true,
      noFileMutation: true,
      projectVibeWriteAllowed: false,
      providerSubmissionForbidden: true,
      workerSpawnForbidden: true,
    },
    nextUiProjection: {
      status: userStatus,
      shortLabel: shortLabelFor(userStatus),
      queuedCount: taskEnqueue.summary.queued,
      parkedCount: taskEnqueue.summary.parked,
      blockedCount: taskEnqueue.summary.blocked,
      staleArtifactCount: invalidation.staleArtifacts.length,
    },
  };
}
