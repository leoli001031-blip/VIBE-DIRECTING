import {
  buildDirectorWorkflowState,
  type DirectorWorkflowSelectionInput,
  type DirectorWorkflowState,
} from "../core/directorWorkflow";
import type { ProjectRuntimeState } from "../core/projectState";
import {
  buildProjectStoreApplyPlanForStagedFacts,
  buildProjectTransactionRuntime,
  confirmProjectPendingTransactionForRuntime,
  stageProjectFactsForCommit,
  type ProjectConfirmedProjectionReceipt,
  type ProjectFactsStagedApplyPlan,
  type ProjectFactsStagedCommitReceipt,
  type ProjectPendingTransaction,
  type ProjectTaskEnqueuePlan,
  type ProjectTaskEnqueuePlanItem,
  type ProjectTransactionRuntimeState,
} from "../core/projectTransaction";
import type { BuiltTaskPacket, TaskPacketValidationReceipt } from "../core/taskPacketBuilder";
import { applyProjectVibeTransaction, hashProjectVibeFacts } from "./projectVibe";
import { buildProjectRuntimeStateFromProjectVibe } from "./projectVibeRuntimeState";
import type {
  ProjectVibeDocument,
  ProjectVibePatchOperation,
  ProjectVibeRunReceipt,
  ProjectVibeShotStatus,
  ProjectVibeTransactionReceipt,
} from "./types";

export type ProjectVibeCreativeLoopStageStatus = "awaiting_confirmation" | "blocked";
export type ProjectVibeCreativeLoopConfirmStatus = "project_facts_written" | "blocked_not_confirmed" | "blocked";

export interface ProjectVibeCreativeLoopInput {
  project: ProjectVibeDocument;
  userIntent: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  generatedAt?: string;
  projectRoot?: string;
  projectPath?: string;
  runtimeState?: ProjectRuntimeState;
}

export interface ConfirmProjectVibeCreativeLoopInput extends ProjectVibeCreativeLoopInput {
  userConfirmed: boolean;
}

export interface ProjectVibeFormalTaskEnvelopeEvidence {
  packetId: string;
  taskRunId?: string;
  taskKind: string;
  queueStatus?: ProjectTaskEnqueuePlanItem["queueStatus"];
  envelopeId?: string;
  taskEnvelopeId?: string;
  taskEnvelopeInputHash?: string;
  policyBinding?: string;
  sourceIndexHash?: string;
  sourceFactTrace: string[];
  expectedOutputs: string[];
  qaChecklist: string[];
  knowledgeTraceStatus?: ProjectTaskEnqueuePlanItem["knowledgeTraceStatus"];
  validationReceipt: TaskPacketValidationReceipt;
  validationErrors: string[];
  forbiddenActions: string[];
  rawUserIntentAcceptedAsTask: false;
  validatedForFormalQueue: boolean;
}

export interface ProjectVibeCreativeLoopStageResult {
  status: ProjectVibeCreativeLoopStageStatus;
  generatedAt: string;
  sourceFactHash: string;
  workflow: DirectorWorkflowState;
  runtimeState: ProjectRuntimeState;
  transactionRuntime: ProjectTransactionRuntimeState;
  stagedTransaction: ProjectPendingTransaction;
  taskEnqueuePlan: ProjectTaskEnqueuePlan;
  formalTaskEnvelopeEvidence: ProjectVibeFormalTaskEnvelopeEvidence[];
  blockedReasons: string[];
  noProjectMutation: true;
  projectVibeWritten: false;
  providerCalled: false;
  workerSpawned: false;
  formalTaskInputsAreValidated: boolean;
  freeTextFormalTaskBlocked: true;
}

export interface ProjectVibeCreativeLoopConfirmResult {
  status: ProjectVibeCreativeLoopConfirmStatus;
  generatedAt: string;
  sourceFactHash: string;
  workflow: DirectorWorkflowState;
  runtimeState: ProjectRuntimeState;
  transactionRuntime: ProjectTransactionRuntimeState;
  stagedTransaction: ProjectPendingTransaction;
  taskEnqueuePlan: ProjectTaskEnqueuePlan;
  formalTaskEnvelopeEvidence: ProjectVibeFormalTaskEnvelopeEvidence[];
  confirmationReceipt?: ProjectConfirmedProjectionReceipt;
  stagedReceipt?: ProjectFactsStagedCommitReceipt;
  applyPlan?: ProjectFactsStagedApplyPlan;
  runReceipt?: ProjectVibeRunReceipt;
  transactionReceipt?: ProjectVibeTransactionReceipt;
  nextProject?: ProjectVibeDocument;
  queuedTaskRunIds: string[];
  parkedTaskRunIds: string[];
  blockedTaskRunIds: string[];
  blockedReasons: string[];
  formalTaskInputsAreValidated: boolean;
  freeTextFormalTaskBlocked: true;
  projectVibeWritten: boolean;
  providerCalled: false;
  workerSpawned: false;
}

const fatalBlockerPrefixes = [
  "live_or_provider_submit_forbidden",
  "credential_or_api_key_access_forbidden",
  "prompt_bypass_forbidden",
];

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "project";
}

function compactTime(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14) || `${Date.now()}`;
}

function selectionFor(input: ProjectVibeCreativeLoopInput): DirectorWorkflowSelectionInput {
  return {
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds,
    selectedAssetId: input.selectedAssetId,
    sectionId: input.sectionId,
  };
}

function runtimeStateFor(input: ProjectVibeCreativeLoopInput, generatedAt: string): ProjectRuntimeState {
  return input.runtimeState || buildProjectRuntimeStateFromProjectVibe({
    project: input.project,
    projectRoot: input.projectRoot,
    projectPath: input.projectPath,
    generatedAt,
  });
}

function fatalWorkflowBlockers(workflow: DirectorWorkflowState): string[] {
  return unique(
    workflow.blockedReasons.filter((reason) =>
      fatalBlockerPrefixes.some((prefix) => reason === prefix || reason.startsWith(`${prefix}:`)),
    ),
  );
}

function verifiedQueuedItems(plan: ProjectTaskEnqueuePlan): ProjectTaskEnqueuePlanItem[] {
  return plan.items.filter((item) =>
    item.queueStatus === "queued" &&
    Boolean(item.taskEnvelopeId) &&
    item.expectedOutputs.length > 0 &&
    item.validationErrors.length === 0 &&
    item.knowledgeTraceStatus === "present",
  );
}

function formalTaskInputsAreValidated(plan: ProjectTaskEnqueuePlan): boolean {
  return plan.noFreeTextTask === true &&
    plan.validatedEnvelopeRequired === true &&
    verifiedQueuedItems(plan).length === plan.items.filter((item) => item.queueStatus === "queued").length;
}

function formalTaskEnvelopeEvidence(
  plan: ProjectTaskEnqueuePlan,
  packets: BuiltTaskPacket[],
): ProjectVibeFormalTaskEnvelopeEvidence[] {
  const queueItemByPacketId = new Map(plan.items.map((item) => [item.packetId, item]));
  return packets.map((packet) => {
    const queueItem = queueItemByPacketId.get(packet.packetId);
    const taskEnvelope = packet.envelope?.taskEnvelope;
    const validationErrors = queueItem?.validationErrors || packet.validationReceipt.blockers;
    const expectedOutputs = queueItem?.expectedOutputs || taskEnvelope?.expectedOutputs || [];
    return {
      packetId: packet.packetId,
      taskRunId: queueItem?.taskRunId,
      taskKind: packet.taskKind,
      queueStatus: queueItem?.queueStatus,
      envelopeId: packet.envelopeId || packet.envelope?.id,
      taskEnvelopeId: taskEnvelope?.id,
      taskEnvelopeInputHash: taskEnvelope?.inputHash,
      policyBinding: taskEnvelope?.policyBinding,
      sourceIndexHash: taskEnvelope?.sourceIndexHash,
      sourceFactTrace: packet.sourceFactTrace,
      expectedOutputs,
      qaChecklist: taskEnvelope?.qaChecklist || [],
      knowledgeTraceStatus: queueItem?.knowledgeTraceStatus,
      validationReceipt: packet.validationReceipt,
      validationErrors,
      forbiddenActions: taskEnvelope && "forbiddenActions" in taskEnvelope
        ? ((taskEnvelope as { forbiddenActions?: string[] }).forbiddenActions || [])
        : [],
      rawUserIntentAcceptedAsTask: false,
      validatedForFormalQueue: Boolean(
        queueItem?.queueStatus === "queued" &&
          queueItem.taskEnvelopeId &&
          expectedOutputs.length > 0 &&
          validationErrors.length === 0 &&
          queueItem.knowledgeTraceStatus === "present" &&
          packet.validationReceipt.status === "pass",
      ),
    };
  });
}

function buildConfirmedTransactionRuntime(stage: ProjectVibeCreativeLoopStageResult): ProjectTransactionRuntimeState {
  return buildProjectTransactionRuntime({
    workflowState: {
      generatedAt: stage.workflow.generatedAt,
      status: stage.workflow.status,
      confirmationRequired: stage.workflow.confirmationRequired,
      blockedReasons: stage.workflow.blockedReasons,
      editPlan: stage.workflow.editPlan,
      taskPacketState: stage.workflow.taskPacketState,
    },
    runtimeState: stage.runtimeState,
    projectId: stage.workflow.transactionRuntime.pendingTransaction.sourceFacts.projectId,
    projectVersion: stage.workflow.transactionRuntime.pendingTransaction.sourceFacts.projectVersion,
    sourceIndexHash: stage.sourceFactHash,
    userConfirmed: true,
    userEnabled: true,
  });
}

function affectedShotIdsFor(input: ProjectVibeCreativeLoopInput, runtime: ProjectTransactionRuntimeState): string[] {
  const existingShotIds = new Set(input.project.shots.map((shot) => shot.id));
  return unique([
    input.selectedShotId,
    ...(input.selectedShotIds || []),
    ...runtime.pendingTransaction.artifactInvalidation.affectedShotIds,
    ...runtime.pendingTransaction.sourceFacts.selectedScope.selectedShotIds,
  ]).filter((shotId) => existingShotIds.has(shotId));
}

function runReceiptFor(input: ProjectVibeCreativeLoopInput, params: {
  generatedAt: string;
  sourceFactHash: string;
  runtime: ProjectTransactionRuntimeState;
  confirmationReceipt: ProjectConfirmedProjectionReceipt;
  stagedReceipt: ProjectFactsStagedCommitReceipt;
  queuedItems: ProjectTaskEnqueuePlanItem[];
  affectedShotIds: string[];
}): ProjectVibeRunReceipt {
  const scopeId = safeId(params.affectedShotIds[0] || input.selectedAssetId || input.sectionId || input.project.manifest.projectId);
  const runId = `run_creative_loop_${scopeId}_${compactTime(params.generatedAt)}`;
  const queuedEnvelopeRefs = params.queuedItems.map((item) => `taskEnvelope#${item.taskEnvelopeId}`);
  const queuedTaskRefs = params.queuedItems.map((item) => `taskRun#${item.taskRunId}`);
  return {
    id: runId,
    runKind: "agent_loop",
    status: "planned",
    createdAt: params.generatedAt,
    summary: `Confirmed creator change; queued ${params.queuedItems.length} validated task envelope(s).`,
    sourceFactHash: params.sourceFactHash,
    affectedShotIds: params.affectedShotIds,
    producedAssetIds: [],
    evidenceRefs: unique([
      `projectTransaction#${params.runtime.pendingTransaction.id}`,
      `projectConfirmation#${params.confirmationReceipt.receiptId}`,
      `projectFactsStage#${params.stagedReceipt.receiptId}`,
      ...params.affectedShotIds.map((shotId) => `project.vibe#shots/${shotId}`),
      ...params.affectedShotIds.map((shotId) => `project.vibe#shots/${shotId}/intent`),
      ...queuedEnvelopeRefs,
      ...queuedTaskRefs,
    ]),
    projectFactsMutated: true,
    runtimeFixtureUsed: false,
  };
}

function confirmedCreativeIntent(previousIntent: string, userIntent: string): string {
  const trimmedIntent = userIntent.trim();
  if (!trimmedIntent) return previousIntent;
  const typedFactLine = `Confirmed creator intent: ${trimmedIntent}`;
  if (previousIntent.includes(typedFactLine)) return previousIntent;
  return unique([previousIntent.trim(), typedFactLine]).join("\n");
}

function plannedShotStatusForCreativeFact(status: ProjectVibeShotStatus): ProjectVibeShotStatus {
  return status === "blocked" ? "blocked" : "planned";
}

function patchOperationsFor(input: ProjectVibeCreativeLoopInput, runReceipt: ProjectVibeRunReceipt): ProjectVibePatchOperation[] {
  const runRef = `project.vibe#runs/${runReceipt.id}`;
  const shotOperations = runReceipt.affectedShotIds
    .map((shotId) => input.project.shots.find((shot) => shot.id === shotId))
    .filter((shot): shot is ProjectVibeDocument["shots"][number] => Boolean(shot))
    .map((shot) => ({
      op: "upsert_shot" as const,
      shot: {
        ...shot,
        intent: confirmedCreativeIntent(shot.intent, input.userIntent),
        status: plannedShotStatusForCreativeFact(shot.status),
        sourceRefs: unique([
          ...shot.sourceRefs,
          runRef,
          `project.vibe#shots/${shot.id}/intent`,
        ]),
      },
    }));

  return [
    ...shotOperations,
    {
      op: "append_run_receipt",
      run: runReceipt,
    },
  ];
}

export function stageProjectVibeCreativeLoop(input: ProjectVibeCreativeLoopInput): ProjectVibeCreativeLoopStageResult {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const sourceFactHash = hashProjectVibeFacts(input.project);
  const runtimeState = runtimeStateFor(input, generatedAt);
  const workflow = buildDirectorWorkflowState({
    runtimeState,
    userIntent: input.userIntent.trim(),
    selection: selectionFor(input),
    generatedAt,
  });
  const transactionRuntime = workflow.transactionRuntime;
  const taskEnqueuePlan = transactionRuntime.pendingTransaction.taskEnqueue;
  const formalTaskEvidence = formalTaskEnvelopeEvidence(taskEnqueuePlan, workflow.taskPacketState.packets);
  const blockers = unique([
    input.userIntent.trim() ? "" : "user_intent_required",
    ...fatalWorkflowBlockers(workflow),
  ]);

  return {
    status: blockers.length ? "blocked" : "awaiting_confirmation",
    generatedAt,
    sourceFactHash,
    workflow,
    runtimeState,
    transactionRuntime,
    stagedTransaction: transactionRuntime.pendingTransaction,
    taskEnqueuePlan,
    formalTaskEnvelopeEvidence: formalTaskEvidence,
    blockedReasons: blockers,
    noProjectMutation: true,
    projectVibeWritten: false,
    providerCalled: false,
    workerSpawned: false,
    formalTaskInputsAreValidated: formalTaskInputsAreValidated(taskEnqueuePlan),
    freeTextFormalTaskBlocked: true,
  };
}

export function confirmProjectVibeCreativeLoop(input: ConfirmProjectVibeCreativeLoopInput): ProjectVibeCreativeLoopConfirmResult {
  const stage = stageProjectVibeCreativeLoop(input);
  if (!input.userConfirmed) {
    return {
      ...stage,
      status: "blocked_not_confirmed",
      queuedTaskRunIds: [],
      parkedTaskRunIds: [],
      blockedTaskRunIds: stage.taskEnqueuePlan.items.map((item) => item.taskRunId),
      blockedReasons: unique([...stage.blockedReasons, "pending_transaction_not_confirmed"]),
      projectVibeWritten: false,
    };
  }
  if (stage.status === "blocked") {
    return {
      ...stage,
      status: "blocked",
      queuedTaskRunIds: [],
      parkedTaskRunIds: [],
      blockedTaskRunIds: stage.taskEnqueuePlan.items.map((item) => item.taskRunId),
      projectVibeWritten: false,
    };
  }

  const transactionRuntime = buildConfirmedTransactionRuntime(stage);
  const taskEnqueuePlan = transactionRuntime.pendingTransaction.taskEnqueue;
  const formalTaskEvidence = formalTaskEnvelopeEvidence(taskEnqueuePlan, stage.workflow.taskPacketState.packets);
  const confirmationReceipt = confirmProjectPendingTransactionForRuntime(transactionRuntime);
  const stagedReceipt = stageProjectFactsForCommit({ runtime: transactionRuntime, confirmationReceipt });
  const applyPlan = buildProjectStoreApplyPlanForStagedFacts({
    receipt: stagedReceipt,
    generatedAt: stage.generatedAt,
  });
  const queuedItems = verifiedQueuedItems(taskEnqueuePlan);
  const queuedTaskRunIds = unique(queuedItems.map((item) => item.taskRunId));
  const parkedTaskRunIds = unique(taskEnqueuePlan.items.filter((item) => item.queueStatus === "parked").map((item) => item.taskRunId));
  const blockedTaskRunIds = unique(taskEnqueuePlan.items.filter((item) => item.queueStatus === "blocked").map((item) => item.taskRunId));
  const blockers = unique([
    ...fatalWorkflowBlockers(stage.workflow),
    confirmationReceipt.status === "blocked_not_confirmed" ? confirmationReceipt.status : "",
    confirmationReceipt.status === "blocked_missing_knowledge_trace" ? confirmationReceipt.status : "",
    queuedItems.length ? "" : "validated_task_envelope_required",
    taskEnqueuePlan.noFreeTextTask === true ? "" : "free_text_task_forbidden",
    taskEnqueuePlan.validatedEnvelopeRequired === true ? "" : "validated_task_envelope_required",
    ...taskEnqueuePlan.items
      .filter((item) => item.queueStatus === "queued" && !queuedItems.includes(item))
      .flatMap((item) => item.validationErrors.length ? item.validationErrors : ["queued_task_missing_validation_evidence"]),
  ]);

  if (blockers.length) {
    return {
      ...stage,
      status: "blocked",
      transactionRuntime,
      stagedTransaction: transactionRuntime.pendingTransaction,
      taskEnqueuePlan,
      formalTaskEnvelopeEvidence: formalTaskEvidence,
      confirmationReceipt,
      stagedReceipt,
      applyPlan,
      queuedTaskRunIds,
      parkedTaskRunIds,
      blockedTaskRunIds,
      blockedReasons: blockers,
      formalTaskInputsAreValidated: formalTaskInputsAreValidated(taskEnqueuePlan),
      projectVibeWritten: false,
    };
  }

  const affectedShotIds = affectedShotIdsFor(input, transactionRuntime);
  const runReceipt = runReceiptFor(input, {
    generatedAt: stage.generatedAt,
    sourceFactHash: stage.sourceFactHash,
    runtime: transactionRuntime,
    confirmationReceipt,
    stagedReceipt,
    queuedItems,
    affectedShotIds,
  });
  const patchResult = applyProjectVibeTransaction(input.project, {
    id: `txn_${runReceipt.id}`,
    actor: "agent_loop",
    reason: "Commit confirmed creative loop facts and validated task enqueue plan to Project.vibe.",
    createdAt: stage.generatedAt,
    operations: patchOperationsFor(input, runReceipt),
  });

  if (patchResult.receipt.status !== "applied") {
    return {
      ...stage,
      status: "blocked",
      transactionRuntime,
      stagedTransaction: transactionRuntime.pendingTransaction,
      taskEnqueuePlan,
      formalTaskEnvelopeEvidence: formalTaskEvidence,
      confirmationReceipt,
      stagedReceipt,
      applyPlan,
      runReceipt,
      transactionReceipt: patchResult.receipt,
      queuedTaskRunIds,
      parkedTaskRunIds,
      blockedTaskRunIds,
      blockedReasons: patchResult.receipt.errors,
      formalTaskInputsAreValidated: formalTaskInputsAreValidated(taskEnqueuePlan),
      projectVibeWritten: false,
    };
  }

  return {
    ...stage,
    status: "project_facts_written",
    transactionRuntime,
    stagedTransaction: transactionRuntime.pendingTransaction,
    taskEnqueuePlan,
    formalTaskEnvelopeEvidence: formalTaskEvidence,
    confirmationReceipt,
    stagedReceipt,
    applyPlan,
    runReceipt,
    transactionReceipt: patchResult.receipt,
    nextProject: patchResult.project,
    queuedTaskRunIds,
    parkedTaskRunIds,
    blockedTaskRunIds,
    blockedReasons: [],
    formalTaskInputsAreValidated: true,
    freeTextFormalTaskBlocked: true,
    projectVibeWritten: true,
    providerCalled: false,
    workerSpawned: false,
  };
}
