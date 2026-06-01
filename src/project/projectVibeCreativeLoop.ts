import {
  buildDirectorWorkflowState,
  type DirectorWorkflowSelectionInput,
  type DirectorWorkflowState,
} from "../core/directorWorkflow";
import {
  directorAgentActionEvidenceRefs,
  directorAgentActionReceiptSummary,
  type DirectorAgentActionEnvelope,
} from "../core/directorAgentAction";
import {
  directorAgentToolHandoffEvidenceRefs,
  directorAgentToolHandoffReceiptSummary,
  type DirectorAgentToolHandoff,
} from "../core/directorAgentToolHandoff";
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
  ProjectVibeAsset,
  ProjectVibeAssetStatus,
  ProjectVibeDocument,
  ProjectVibePatchOperation,
  ProjectVibeRunReceipt,
  ProjectVibeShot,
  ProjectVibeShotStatus,
  ProjectVibeStoryFlow,
  ProjectVibeTransactionReceipt,
  ProjectVibeVisualMemoryEntry,
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
  agentActionEnvelope?: DirectorAgentActionEnvelope;
  agentToolHandoff?: DirectorAgentToolHandoff;
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

function projectPatchOnlyAgentAction(input: ProjectVibeCreativeLoopInput): boolean {
  return input.agentActionEnvelope?.toolPlan.toolName === "project_vibe_patch" &&
    input.agentToolHandoff?.status === "handled_by_project_write";
}

function agentToolHandoffHasValidatedEnvelope(input: ProjectVibeCreativeLoopInput): boolean {
  const action = input.agentActionEnvelope;
  const handoff = input.agentToolHandoff;
  const envelope = handoff?.invocation?.taskEnvelope;
  return Boolean(
    action &&
      handoff?.status === "ready" &&
      envelope &&
      handoff.actionId === action.actionId &&
      handoff.handler === action.toolPlan.toolName &&
      handoff.expectedReceipt === action.toolPlan.expectedReceipt &&
      handoff.taskEnvelopeRequired === action.toolPlan.taskEnvelopeRequired &&
      handoff.invocation?.confirmation.actionId === action.actionId &&
      handoff.invocation?.confirmation.expectedReceipt === action.toolPlan.expectedReceipt &&
      envelope.actionId === action.actionId &&
      envelope.handoffId === handoff.handoffId &&
      envelope.handler === action.toolPlan.toolName &&
      envelope.expectedReceipt === action.toolPlan.expectedReceipt &&
      envelope.providerSubmitAllowed === action.toolPlan.providerSubmitAllowed &&
      envelope.policyBinding === "director_agent_tool_handoff" &&
      envelope.projectWriteRequiredBeforeInvocation === true &&
      envelope.userConfirmationRequired === true &&
      envelope.projectWriteMode === "staged_only" &&
      Boolean(envelope.inputHash),
  );
}

function readyAgentToolHandoffBindingBlockers(input: ProjectVibeCreativeLoopInput): string[] {
  const action = input.agentActionEnvelope;
  const handoff = input.agentToolHandoff;
  if (!handoff || handoff.status !== "ready") return [];
  const envelope = handoff.invocation?.taskEnvelope;
  if (!action) return ["agent_tool_handoff_action_missing"];
  return unique([
    handoff.actionId === action.actionId ? "" : "agent_tool_handoff_action_id_mismatch",
    handoff.handler === action.toolPlan.toolName ? "" : "agent_tool_handoff_handler_mismatch",
    handoff.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_handoff_receipt_mismatch",
    handoff.taskEnvelopeRequired === action.toolPlan.taskEnvelopeRequired ? "" : "agent_tool_handoff_task_required_mismatch",
    envelope ? "" : "agent_tool_handoff_task_envelope_missing",
    handoff.invocation?.confirmation.actionId === action.actionId ? "" : "agent_tool_handoff_confirmation_action_id_mismatch",
    handoff.invocation?.confirmation.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_handoff_confirmation_receipt_mismatch",
    !envelope || envelope.actionId === action.actionId ? "" : "agent_tool_handoff_task_action_id_mismatch",
    !envelope || envelope.handoffId === handoff.handoffId ? "" : "agent_tool_handoff_task_handoff_id_mismatch",
    !envelope || envelope.handler === action.toolPlan.toolName ? "" : "agent_tool_handoff_task_handler_mismatch",
    !envelope || envelope.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_handoff_task_receipt_mismatch",
    !envelope || envelope.providerSubmitAllowed === action.toolPlan.providerSubmitAllowed ? "" : "agent_tool_handoff_task_provider_policy_mismatch",
    !envelope || envelope.policyBinding === "director_agent_tool_handoff" ? "" : "agent_tool_handoff_task_policy_mismatch",
    !envelope || envelope.projectWriteRequiredBeforeInvocation === true ? "" : "agent_tool_handoff_task_write_gate_mismatch",
    !envelope || envelope.userConfirmationRequired === true ? "" : "agent_tool_handoff_task_confirmation_gate_mismatch",
    !envelope || envelope.projectWriteMode === "staged_only" ? "" : "agent_tool_handoff_task_write_mode_mismatch",
    !envelope || Boolean(envelope.inputHash) ? "" : "agent_tool_handoff_task_input_hash_missing",
  ]);
}

function agentToolHandoffBlockers(input: ProjectVibeCreativeLoopInput): string[] {
  if (!input.agentToolHandoff || input.agentToolHandoff.status !== "blocked") return [];
  return input.agentToolHandoff.blockers.map((blocker) => `agent_tool_handoff_blocked:${blocker}`);
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
  const includeWorkflowImpact = shouldUseWorkflowAffectedShots(input);
  return unique([
    input.selectedShotId,
    ...(input.selectedShotIds || []),
    ...targetSectionShotIdsFor(input),
    ...(includeWorkflowImpact ? runtime.pendingTransaction.artifactInvalidation.affectedShotIds : []),
    ...(includeWorkflowImpact ? runtime.pendingTransaction.sourceFacts.selectedScope.selectedShotIds : []),
  ]).filter((shotId) => existingShotIds.has(shotId));
}

function shouldUseWorkflowAffectedShots(input: ProjectVibeCreativeLoopInput): boolean {
  const action = input.agentActionEnvelope;
  if (!action) return true;
  return action.toolPlan.toolName === "project_vibe_patch" ||
    action.toolPlan.toolName === "image2_reference_generation" ||
    action.toolPlan.toolName === "seedance_video_submit";
}

function targetSectionIdsFor(input: ProjectVibeCreativeLoopInput): string[] {
  const actionTarget = input.agentActionEnvelope?.target;
  const existingSectionIds = new Set(input.project.storyFlow.sections.map((section) => section.id));
  return unique([
    ...(actionTarget?.kind === "section" ? actionTarget.ids : []),
    input.sectionId,
  ]).filter((sectionId) => existingSectionIds.has(sectionId));
}

function targetSectionShotIdsFor(input: ProjectVibeCreativeLoopInput): string[] {
  const sectionIds = new Set(targetSectionIdsFor(input));
  if (!sectionIds.size) return [];
  return unique(
    input.project.storyFlow.sections
      .filter((section) => sectionIds.has(section.id))
      .flatMap((section) => section.shotIds),
  );
}

function targetAssetIdsFor(input: ProjectVibeCreativeLoopInput): string[] {
  const actionTarget = input.agentActionEnvelope?.target;
  const existingAssetIds = new Set(input.project.assets.map((asset) => asset.id));
  return unique([
    ...(actionTarget?.kind === "asset" ? actionTarget.ids : []),
    input.selectedAssetId,
  ]).filter((assetId) => existingAssetIds.has(assetId));
}

const projectDirectionAssetId = "asset_project_direction";

function shouldWriteProjectDirection(input: ProjectVibeCreativeLoopInput): boolean {
  const action = input.agentActionEnvelope;
  return Boolean(
    action?.target.kind === "project" &&
    action.kind === "revise_story_or_shot" &&
    action.toolPlan.toolName === "project_vibe_patch" &&
    input.userIntent.trim(),
  );
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
  const affectedAssetIds = targetAssetIdsFor(input);
  const affectedSectionIds = targetSectionIdsFor(input);
  const scopeId = safeId(params.affectedShotIds[0] || affectedAssetIds[0] || affectedSectionIds[0] || input.selectedAssetId || input.sectionId || input.project.manifest.projectId);
  const runId = `run_creative_loop_${scopeId}_${compactTime(params.generatedAt)}`;
  const queuedEnvelopeRefs = params.queuedItems.map((item) => `taskEnvelope#${item.taskEnvelopeId}`);
  const queuedTaskRefs = params.queuedItems.map((item) => `taskRun#${item.taskRunId}`);
  const agentActionRefs = input.agentActionEnvelope ? directorAgentActionEvidenceRefs(input.agentActionEnvelope) : [];
  const agentActionSummary = input.agentActionEnvelope
    ? `Agent action: ${directorAgentActionReceiptSummary(input.agentActionEnvelope)}. `
    : "";
  const agentToolHandoffRefs = input.agentToolHandoff ? directorAgentToolHandoffEvidenceRefs(input.agentToolHandoff) : [];
  const agentToolHandoffSummary = input.agentToolHandoff
    ? `Agent tool handoff: ${directorAgentToolHandoffReceiptSummary(input.agentToolHandoff)}. `
    : "";
  const controlledToolPrepared = agentToolHandoffHasValidatedEnvelope(input);
  const confirmedChangeSummary = params.queuedItems.length
    ? `Confirmed creator change; queued ${params.queuedItems.length} validated task envelope(s).`
    : projectPatchOnlyAgentAction(input)
      ? "Confirmed creator change; project update handled without provider task."
      : controlledToolPrepared
        ? "Confirmed creator change; project facts written before controlled tool handoff."
        : "Confirmed creator change; no provider task was queued.";
  const controlledToolSummary = controlledToolPrepared
    ? ` controlled ${input.agentToolHandoff?.handler || "tool"} handoff prepared after Project.vibe write.`
    : "";
  const writesShotFeedbackDirective = shouldWriteShotFeedbackDirective(input);
  const writesShotIntentFact = shouldWriteShotIntentFact(input);
  const writesProposedShotField = shouldWriteAgentProposedShotFields(input);
  return {
    id: runId,
    runKind: "agent_loop",
    status: "planned",
    createdAt: params.generatedAt,
    summary: `${agentActionSummary}${agentToolHandoffSummary}${confirmedChangeSummary}${controlledToolSummary}`,
    sourceFactHash: params.sourceFactHash,
    affectedShotIds: params.affectedShotIds,
    producedAssetIds: [],
    evidenceRefs: unique([
      ...agentActionRefs,
      ...agentToolHandoffRefs,
      `projectTransaction#${params.runtime.pendingTransaction.id}`,
      `projectConfirmation#${params.confirmationReceipt.receiptId}`,
      `projectFactsStage#${params.stagedReceipt.receiptId}`,
      ...(shouldWriteShotPatch(input) ? params.affectedShotIds.map((shotId) => `project.vibe#shots/${shotId}`) : []),
      ...(writesShotIntentFact ? params.affectedShotIds.map((shotId) => `project.vibe#shots/${shotId}/intent`) : []),
      ...(writesProposedShotField ? proposedShotFieldEvidenceRefs(input, params.affectedShotIds) : []),
      ...affectedSectionIds.map((sectionId) => `project.vibe#storyFlow/sections/${sectionId}`),
      ...affectedSectionIds.map((sectionId) => `project.vibe#storyFlow/sections/${sectionId}/summary`),
      ...affectedAssetIds.map((assetId) => `project.vibe#assets/${assetId}`),
      ...affectedAssetIds.map((assetId) => `project.vibe#assets/${assetId}/textConstraints`),
      ...(agentProposedAssetStatus(input) ? affectedAssetIds.map((assetId) => `project.vibe#assets/${assetId}/status`) : []),
      ...(writesShotFeedbackDirective
        ? params.affectedShotIds.map((shotId) => `project.vibe#shots/${shotId}/directorFeedbackDirectives`)
        : []),
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

function confirmedCreativeConstraint(textConstraints: string[], userIntent: string): string[] {
  const trimmedIntent = userIntent.trim();
  if (!trimmedIntent) return textConstraints;
  return unique([...textConstraints, `Confirmed creator constraint: ${trimmedIntent}`]);
}

function confirmedCreativeSummary(previousSummary: string, userIntent: string): string {
  const trimmedIntent = userIntent.trim();
  if (!trimmedIntent) return previousSummary;
  const typedFactLine = `Confirmed creator direction: ${trimmedIntent}`;
  if (previousSummary.includes(typedFactLine)) return previousSummary;
  return unique([previousSummary.trim(), typedFactLine]).join("\n");
}

function shouldWriteShotIntentFact(input: ProjectVibeCreativeLoopInput): boolean {
  const action = input.agentActionEnvelope;
  if (!action) return Boolean(input.userIntent.trim());
  return action.kind === "revise_story_or_shot" &&
    action.toolPlan.toolName === "project_vibe_patch" &&
    (action.target.kind === "shot" || action.target.kind === "multi_shot" || action.target.kind === "section") &&
    Boolean(input.userIntent.trim());
}

function shouldWriteAgentProposedShotFields(input: ProjectVibeCreativeLoopInput): boolean {
  const action = input.agentActionEnvelope;
  if (!action) return false;
  if (action.toolPlan.toolName !== "project_vibe_patch") return false;
  if (action.target.kind !== "shot" && action.target.kind !== "multi_shot" && action.target.kind !== "section") return false;
  return action.proposedChanges.some((change) => Boolean(proposedShotFieldValue(change.field, change.to)));
}

function shouldWriteShotFeedbackDirective(input: ProjectVibeCreativeLoopInput): boolean {
  const action = input.agentActionEnvelope;
  return Boolean(
    action?.kind === "revise_story_or_shot" &&
    (action.target.kind === "shot" || action.target.kind === "multi_shot" || action.target.kind === "section") &&
    action.toolPlan.toolName === "project_vibe_patch" &&
    input.userIntent.trim(),
  );
}

function shouldWriteShotPatch(input: ProjectVibeCreativeLoopInput): boolean {
  return shouldWriteShotIntentFact(input) ||
    shouldWriteShotFeedbackDirective(input) ||
    shouldWriteAgentProposedShotFields(input);
}

function confirmedShotFeedbackDirectives(
  previousDirectives: string[] | undefined,
  input: ProjectVibeCreativeLoopInput,
): string[] | undefined {
  if (!shouldWriteShotFeedbackDirective(input)) return previousDirectives;
  const trimmedIntent = input.userIntent.trim();
  if (!trimmedIntent) return previousDirectives;
  return unique([...(previousDirectives || []), `Confirmed director feedback: ${trimmedIntent}`]);
}

function plannedShotStatusForCreativeFact(status: ProjectVibeShotStatus): ProjectVibeShotStatus {
  return status === "blocked" ? "blocked" : "planned";
}

function referenceStrategyFromAgentChange(value: string): ProjectVibeShot["referenceStrategy"] | undefined {
  const normalized = value.toLowerCase().replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]+/g, "");
  if (normalized.includes("storyboardrapidcut") || normalized.includes("故事板快切") || normalized.includes("快切")) return "storyboard_rapid_cut";
  if (normalized.includes("storyboardnarrative") || normalized.includes("故事板叙事") || normalized.includes("叙事故事板")) return "storyboard_narrative";
  if (normalized.includes("omnireference") || normalized.includes("全能参考") || normalized.includes("简单参考")) return "omni_reference";
  return undefined;
}

const writableShotFields = new Set([
  "title",
  "primaryAction",
  "actionTrigger",
  "microReaction",
  "camera",
  "durationSeconds",
  "referenceStrategy",
  "characterGuidance",
  "sceneGuidance",
  "propGuidance",
]);

function proposedShotFieldValue(field: string, value: string): unknown {
  const cleaned = value.trim();
  if (!cleaned || !writableShotFields.has(field)) return undefined;
  if (field === "referenceStrategy") return referenceStrategyFromAgentChange(cleaned);
  if (field === "durationSeconds") {
    const parsed = Number(cleaned.match(/\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (field === "characterGuidance" || field === "sceneGuidance" || field === "propGuidance") return [cleaned];
  return cleaned;
}

function proposedShotFieldEvidenceRefs(input: ProjectVibeCreativeLoopInput, shotIds: string[]): string[] {
  const fields = unique(
    (input.agentActionEnvelope?.proposedChanges || [])
      .map((change) => proposedShotFieldValue(change.field, change.to) === undefined ? undefined : change.field),
  );
  return shotIds.flatMap((shotId) => fields.map((field) => `project.vibe#shots/${shotId}/${field}`));
}

function proposedShotFieldSourceRefs(input: ProjectVibeCreativeLoopInput, shotId: string): string[] {
  return proposedShotFieldEvidenceRefs(input, [shotId]);
}

function applyAgentProposedShotChanges(shot: ProjectVibeShot, input: ProjectVibeCreativeLoopInput): ProjectVibeShot {
  let nextShot = shot;
  for (const change of input.agentActionEnvelope?.proposedChanges || []) {
    const value = proposedShotFieldValue(change.field, change.to);
    if (value === undefined) continue;
    nextShot = { ...nextShot, [change.field]: value };
  }
  return nextShot;
}

function assetStatusFromAgentChange(value: string): ProjectVibeAssetStatus | undefined {
  const normalized = value.toLowerCase().replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]+/g, "");
  if (normalized.includes("已锁定") || normalized.includes("锁定") || normalized.includes("通过") || normalized.includes("采用") || normalized.includes("locked")) return "locked";
  if (normalized.includes("退回复做") || normalized.includes("退回") || normalized.includes("拒绝") || normalized.includes("重做") || normalized.includes("rejected")) return "rejected";
  return undefined;
}

function agentProposedAssetStatus(input: ProjectVibeCreativeLoopInput): ProjectVibeAssetStatus | undefined {
  if (input.agentActionEnvelope?.kind !== "review_reference_asset") return undefined;
  if (input.agentActionEnvelope.toolPlan.toolName !== "project_vibe_patch") return undefined;
  return input.agentActionEnvelope.proposedChanges
    .map((change) => change.field === "assetStatus" ? assetStatusFromAgentChange(change.to) : undefined)
    .find(Boolean);
}

function applyAgentProposedAssetChanges(
  asset: ProjectVibeAsset,
  input: ProjectVibeCreativeLoopInput,
  runRef: string,
  affectedShotIds: string[],
): ProjectVibeAsset {
  const proposedStatus = agentProposedAssetStatus(input);
  return {
    ...asset,
    ...(proposedStatus ? { status: proposedStatus } : {}),
    ...(proposedStatus ? { lockedBy: proposedStatus === "locked" ? "user" as const : undefined } : {}),
    textConstraints: confirmedCreativeConstraint(asset.textConstraints, input.userIntent),
    usedByShotIds: unique([...asset.usedByShotIds, ...affectedShotIds]),
    sourceRefs: unique([
      ...asset.sourceRefs,
      runRef,
      `project.vibe#assets/${asset.id}/textConstraints`,
      ...(proposedStatus ? [`project.vibe#assets/${asset.id}/status`] : []),
    ]),
  };
}

function projectDirectionAssetFor(
  input: ProjectVibeCreativeLoopInput,
  runRef: string,
): ProjectVibeAsset | undefined {
  if (!shouldWriteProjectDirection(input)) return undefined;
  const existing = input.project.assets.find((asset) => asset.id === projectDirectionAssetId);
  const shotIds = input.project.storyFlow.shotOrder.length
    ? input.project.storyFlow.shotOrder
    : input.project.shots.map((shot) => shot.id);
  return {
    id: projectDirectionAssetId,
    kind: "style",
    label: "项目整体方向",
    status: "locked",
    ...(existing?.path ? { path: existing.path } : {}),
    textConstraints: confirmedCreativeConstraint(existing?.textConstraints || [], input.userIntent),
    usedByShotIds: unique([...(existing?.usedByShotIds || []), ...shotIds]),
    sourceRefs: unique([
      ...(existing?.sourceRefs || []),
      runRef,
      `project.vibe#assets/${projectDirectionAssetId}/textConstraints`,
    ]),
    lockedBy: existing?.lockedBy || "agent_loop",
    roleBinding: existing?.roleBinding,
  };
}

function visualMemoryEntryForAsset(asset: ProjectVibeAsset): ProjectVibeVisualMemoryEntry {
  return {
    id: `vm_${asset.id}`,
    assetId: asset.id,
    kind: asset.kind,
    label: asset.label,
    status: asset.status,
    textConstraints: asset.textConstraints,
    usedByShotIds: asset.usedByShotIds,
    canUseAsFutureReference: asset.status === "locked",
    sourceRefs: unique([`project.vibe#assets/${asset.id}`, ...asset.sourceRefs]),
    roleBinding: asset.roleBinding,
  };
}

function applyAgentProposedSectionChanges(input: ProjectVibeCreativeLoopInput, runReceipt: ProjectVibeRunReceipt): ProjectVibeStoryFlow | undefined {
  const sectionIds = new Set(targetSectionIdsFor(input));
  if (!sectionIds.size) return undefined;
  return {
    ...input.project.storyFlow,
    updatedAt: runReceipt.createdAt,
    sections: input.project.storyFlow.sections.map((section) => {
      if (!sectionIds.has(section.id)) return section;
      return {
        ...section,
        summary: confirmedCreativeSummary(section.summary, input.userIntent),
      };
    }),
  };
}

function patchOperationsFor(input: ProjectVibeCreativeLoopInput, runReceipt: ProjectVibeRunReceipt): ProjectVibePatchOperation[] {
  const runRef = `project.vibe#runs/${runReceipt.id}`;
  const storyFlow = applyAgentProposedSectionChanges(input, runReceipt);
  const writesShotIntentFact = shouldWriteShotIntentFact(input);
  const writesShotFeedbackDirective = shouldWriteShotFeedbackDirective(input);
  const writesProposedShotField = shouldWriteAgentProposedShotFields(input);
  const shotOperations = shouldWriteShotPatch(input)
    ? runReceipt.affectedShotIds
      .map((shotId) => input.project.shots.find((shot) => shot.id === shotId))
      .filter((shot): shot is ProjectVibeDocument["shots"][number] => Boolean(shot))
      .map((shot) => applyAgentProposedShotChanges(shot, input))
      .map((shot) => {
        const directorFeedbackDirectives = confirmedShotFeedbackDirectives(shot.directorFeedbackDirectives, input);
        return {
          op: "upsert_shot" as const,
          shot: {
            ...shot,
            ...(writesShotIntentFact ? { intent: confirmedCreativeIntent(shot.intent, input.userIntent) } : {}),
            ...(directorFeedbackDirectives ? { directorFeedbackDirectives } : {}),
            status: plannedShotStatusForCreativeFact(shot.status),
            sourceRefs: unique([
              ...shot.sourceRefs,
              runRef,
              ...(writesShotIntentFact ? [`project.vibe#shots/${shot.id}/intent`] : []),
              ...(writesProposedShotField ? proposedShotFieldSourceRefs(input, shot.id) : []),
              ...(writesShotFeedbackDirective ? [`project.vibe#shots/${shot.id}/directorFeedbackDirectives`] : []),
            ]),
          },
        };
      })
    : [];
  const selectedAssetOperations = targetAssetIdsFor(input)
    .map((assetId) => input.project.assets.find((asset) => asset.id === assetId))
    .filter((asset): asset is ProjectVibeAsset => Boolean(asset))
    .map((asset) => ({
      op: "upsert_asset" as const,
      asset: applyAgentProposedAssetChanges(asset, input, runRef, runReceipt.affectedShotIds),
    }));
  const projectDirectionAsset = projectDirectionAssetFor(input, runRef);
  const assetOperations = [
    ...selectedAssetOperations,
    ...(projectDirectionAsset ? [{ op: "upsert_asset" as const, asset: projectDirectionAsset }] : []),
  ];
  const patchedAssetsById = new Map(assetOperations.map((operation) => [operation.asset.id, operation.asset]));
  const existingVisualMemoryAssetIds = new Set(input.project.visualMemory.entries.map((entry) => entry.assetId));
  const newVisualMemoryEntries = assetOperations
    .filter((operation) => !existingVisualMemoryAssetIds.has(operation.asset.id))
    .map((operation) => visualMemoryEntryForAsset(operation.asset));
  const visualMemoryOperation = assetOperations.length
    ? {
        op: "set_visual_memory" as const,
        visualMemory: {
          ...input.project.visualMemory,
          updatedAt: runReceipt.createdAt,
          entries: [
            ...input.project.visualMemory.entries.map((entry) => {
              const patchedAsset = patchedAssetsById.get(entry.assetId);
              if (!patchedAsset) return entry;
              return {
                ...entry,
                status: patchedAsset.status,
                canUseAsFutureReference: patchedAsset.status === "locked",
                textConstraints: patchedAsset.textConstraints,
                usedByShotIds: patchedAsset.usedByShotIds,
                sourceRefs: unique([...entry.sourceRefs, ...patchedAsset.sourceRefs]),
                roleBinding: patchedAsset.roleBinding || entry.roleBinding,
              };
            }),
            ...newVisualMemoryEntries,
          ],
        },
      }
    : undefined;

  return [
    ...(storyFlow ? [{ op: "set_story_flow" as const, storyFlow }] : []),
    ...shotOperations,
    ...assetOperations,
    ...(visualMemoryOperation ? [visualMemoryOperation] : []),
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
  const patchOnly = projectPatchOnlyAgentAction(input);
  const handoffBindingBlockers = readyAgentToolHandoffBindingBlockers(input);
  const controlledToolReady = handoffBindingBlockers.length === 0 && agentToolHandoffHasValidatedEnvelope(input);
  const blockers = unique([
    ...fatalWorkflowBlockers(stage.workflow),
    ...agentToolHandoffBlockers(input),
    ...handoffBindingBlockers,
    confirmationReceipt.status === "blocked_not_confirmed" ? confirmationReceipt.status : "",
    confirmationReceipt.status === "blocked_missing_knowledge_trace" ? confirmationReceipt.status : "",
    queuedItems.length || patchOnly || controlledToolReady ? "" : "validated_task_envelope_required",
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
