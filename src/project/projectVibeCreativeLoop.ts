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
import { requestedStoryboardShotCountFromIntent } from "../core/projectAgentWorkspace";
import type { BuiltTaskPacket, TaskPacketValidationReceipt } from "../core/taskPacketBuilder";
import type { AssetRecord } from "../core/types";
import { applyProjectVibeTransaction, hashProjectVibeFacts } from "./projectVibe";
import { buildProjectRuntimeStateFromProjectVibe } from "./projectVibeRuntimeState";
import type {
  ProjectVibeAsset,
  ProjectVibeAssetStatus,
  ProjectVibeDocument,
  ProjectVibeAssetKind,
  ProjectVibePatchOperation,
  ProjectVibeReferenceRoleBinding,
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
  const runtimeAssetIds = new Set((input.runtimeState?.visualMemory.assets || []).map((asset) => asset.id));
  return unique([
    ...(actionTarget?.kind === "asset" ? actionTarget.ids : []),
    input.selectedAssetId,
  ]).filter((assetId) => existingAssetIds.has(assetId) || runtimeAssetIds.has(assetId));
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
  const writesAssetRoleBinding = Boolean(agentProposedAssetRoleBindingLabel(input));
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
      ...(writesAssetRoleBinding ? affectedAssetIds.map((assetId) => `project.vibe#assets/${assetId}/roleBinding`) : []),
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

function agentProposedAssetRoleBindingLabel(input: ProjectVibeCreativeLoopInput): string | undefined {
  if (input.agentActionEnvelope?.toolPlan.toolName !== "project_vibe_patch") return undefined;
  return input.agentActionEnvelope.proposedChanges
    .map((change) => change.field === "assetRoleBinding" ? change.to.trim() : undefined)
    .find(Boolean);
}

function roleBindingTemplate(label: string): ProjectVibeReferenceRoleBinding | undefined {
  const normalized = label.toLowerCase().replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]+/g, "");
  if (normalized.includes("角色") || normalized.includes("人物") || normalized.includes("女主") || normalized.includes("男主") || normalized.includes("character")) {
    return {
      role: "character_identity",
      useFor: ["identity", "face", "hair", "outfit", "silhouette"],
      ignoreFor: ["camera_path", "scene_weather", "storyboard_timing"],
      priority: 1,
      conflictRule: "Character references control identity only; storyboard, scene, and prop references keep their own authority.",
    };
  }
  if (normalized.includes("场景") || normalized.includes("天气") || normalized.includes("环境") || normalized.includes("地点") || normalized.includes("空间") || normalized.includes("scene")) {
    return {
      role: "scene_baseline",
      useFor: ["location", "layout", "weather", "lighting", "color_temperature"],
      ignoreFor: ["character_identity", "prop_design", "storyboard_timing"],
      priority: 1,
      conflictRule: "Scene references control space, weather, and light; they do not redesign characters or props.",
    };
  }
  if (normalized.includes("道具") || normalized.includes("物体") || normalized.includes("物件") || normalized.includes("车辆") || normalized.includes("整车") || normalized.includes("prop") || normalized.includes("object") || normalized.includes("vehicle")) {
    return {
      role: "prop_reference",
      useFor: ["object_shape", "material", "scale", "interaction"],
      ignoreFor: ["character_identity", "camera_path", "scene_weather"],
      priority: 1,
      conflictRule: "Prop references control the object appearance only; they should not become extra shots or backgrounds.",
    };
  }
  if (normalized.includes("故事板") || normalized.includes("分镜") || normalized.includes("storyboard") || normalized.includes("shotboard")) {
    return {
      role: "storyboard_reference",
      useFor: ["composition", "blocking", "camera", "timing"],
      ignoreFor: ["character_identity", "scene_weather", "prop_design"],
      priority: 1,
      conflictRule: "Storyboards guide motion and layout only; locked character, scene, and prop references remain authoritative.",
    };
  }
  if (normalized.includes("声音") || normalized.includes("声线") || normalized.includes("音源") || normalized.includes("配音") || normalized.includes("voice")) {
    return {
      role: "voice_reference",
      useFor: ["speaker_identity", "dialogue_voice", "delivery"],
      ignoreFor: ["music", "bgm", "visual_identity"],
      priority: 1,
      conflictRule: "Voice references control spoken voice only; they do not authorize music or visual design.",
    };
  }
  if (normalized.includes("配乐") || normalized.includes("音乐") || normalized.includes("bgm") || normalized.includes("music")) {
    return {
      role: "music_reference",
      useFor: ["post_export_music", "rhythm_reference"],
      ignoreFor: ["video_model", "dialogue_voice", "visual_identity"],
      priority: 1,
      conflictRule: "Music references are for rhythm or final export only; Seedance video prompts must still stay no BGM.",
    };
  }
  if (normalized.includes("风格") || normalized.includes("画风") || normalized.includes("美术") || normalized.includes("style")) {
    return {
      role: "style_reference",
      useFor: ["visual_style", "palette", "rendering_language"],
      ignoreFor: ["dialogue_voice", "music"],
      priority: 1,
      conflictRule: "Style references guide look and rendering language; they do not replace character, scene, or prop references.",
    };
  }
  if (normalized.includes("提示词") || normalized.includes("prompt")) {
    return {
      role: "prompt_reference",
      useFor: ["prompt_evidence", "language_rules"],
      ignoreFor: ["voice", "music", "visual_identity"],
      priority: 1,
      conflictRule: "Prompt references are evidence for language rules only; they are not visual references.",
    };
  }
  if (normalized.includes("证据") || normalized.includes("回执") || normalized.includes("receipt") || normalized.includes("submitid")) {
    return {
      role: "generation_receipt",
      useFor: ["provider_receipt", "audit_trail"],
      ignoreFor: ["video_model", "voice", "music"],
      priority: 1,
      conflictRule: "Generation receipts document provenance only; they should never be sent as creative references.",
    };
  }
  if (normalized.includes("视频") || normalized.includes("成片") || normalized.includes("回流") || normalized.includes("clip")) {
    return {
      role: "video_reference",
      useFor: ["generated_clip", "review", "preview"],
      ignoreFor: ["character_identity", "scene_weather", "prop_design"],
      priority: 1,
      conflictRule: "Returned videos are review outputs unless explicitly promoted; they should not silently become identity references.",
    };
  }
  if (normalized.includes("交付") || normalized.includes("导出") || normalized.includes("展示包") || normalized.includes("export")) {
    return {
      role: "export_reference",
      useFor: ["delivery_package", "showcase"],
      ignoreFor: ["video_model", "voice", "music"],
      priority: 1,
      conflictRule: "Export files are delivery artifacts only; they should not become generation inputs.",
    };
  }
  return undefined;
}

function projectVibeKindFromRuntimeAsset(asset: AssetRecord): ProjectVibeAssetKind {
  if (asset.type === "character" || asset.type === "scene" || asset.type === "prop" || asset.type === "style") return asset.type;
  return "reference";
}

function projectVibeStatusFromRuntimeAsset(asset: AssetRecord): ProjectVibeAssetStatus {
  if (asset.status === "rejected") return "rejected";
  if (asset.status === "missing") return "missing";
  if (asset.lockedStatus === "locked") return "locked";
  if (asset.lockedStatus === "candidate") return "candidate";
  return "needs_review";
}

function roleBindingFromRuntimeAsset(asset: AssetRecord): ProjectVibeReferenceRoleBinding | undefined {
  const role = asset.roleBinding?.role?.trim();
  if (!role) return undefined;
  const template = roleBindingTemplate(role);
  if (template) {
    return {
      ...template,
      useFor: unique([...template.useFor, ...(asset.roleBinding?.useFor || [])]),
      ignoreFor: unique([...template.ignoreFor, ...(asset.roleBinding?.ignoreFor || [])]),
    };
  }
  return {
    role,
    useFor: unique(asset.roleBinding?.useFor || []),
    ignoreFor: unique(asset.roleBinding?.ignoreFor || []),
    priority: 2,
    conflictRule: "Project-folder asset role was imported from Agent classification and still respects explicit creator confirmation.",
  };
}

function runtimeAssetFor(input: ProjectVibeCreativeLoopInput, assetId: string): AssetRecord | undefined {
  return input.runtimeState?.visualMemory.assets.find((asset) => asset.id === assetId);
}

function projectRelativeRuntimeAssetPath(runtimePath: string | undefined, projectRoot: string | undefined): string | undefined {
  const cleanedPath = runtimePath?.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleanedPath) return undefined;
  const cleanedRoot = projectRoot?.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const relativePath = cleanedRoot && cleanedPath.startsWith(`${cleanedRoot}/`)
    ? cleanedPath.slice(cleanedRoot.length + 1)
    : cleanedPath;
  return relativePath && !relativePath.startsWith("/") && !relativePath.includes("../") ? relativePath : undefined;
}

function promotedProjectAssetFromRuntimeAsset(
  input: ProjectVibeCreativeLoopInput,
  assetId: string,
  runRef: string,
  affectedShotIds: string[],
): ProjectVibeAsset | undefined {
  const runtimeAsset = runtimeAssetFor(input, assetId);
  if (!runtimeAsset) return undefined;
  const projectRelativePath = projectRelativeRuntimeAssetPath(runtimeAsset.path, input.projectRoot);
  return {
    id: runtimeAsset.id,
    kind: projectVibeKindFromRuntimeAsset(runtimeAsset),
    label: runtimeAsset.name || runtimeAsset.id,
    status: projectVibeStatusFromRuntimeAsset(runtimeAsset),
    ...(projectRelativePath ? { path: projectRelativePath } : {}),
    textConstraints: unique(runtimeAsset.textConstraints || []),
    usedByShotIds: unique([...(runtimeAsset.usedByShotIds || []), ...affectedShotIds]),
    sourceRefs: unique([
      ...(runtimeAsset.sourceRefs || []),
      runRef,
      `project.vibe#assets/${runtimeAsset.id}`,
    ]),
    ...(runtimeAsset.lockedStatus === "locked" ? { lockedBy: "user" as const } : {}),
    ...(roleBindingFromRuntimeAsset(runtimeAsset) ? { roleBinding: roleBindingFromRuntimeAsset(runtimeAsset) } : {}),
  };
}

function assetRoleBindingFromAgentChange(
  input: ProjectVibeCreativeLoopInput,
  asset: ProjectVibeAsset,
  affectedShotIds: string[],
): ProjectVibeReferenceRoleBinding | undefined {
  const template = roleBindingTemplate(agentProposedAssetRoleBindingLabel(input) || "");
  if (!template) return undefined;
  const existing = asset.roleBinding;
  const keepExistingDetails = existing?.role === template.role;
  return {
    role: template.role,
    useFor: unique([
      ...(keepExistingDetails ? existing?.useFor || [] : []),
      ...template.useFor,
      ...affectedShotIds,
    ]),
    ignoreFor: unique([
      ...template.ignoreFor,
      ...(keepExistingDetails ? existing?.ignoreFor || [] : []),
    ]),
    priority: keepExistingDetails ? existing?.priority ?? template.priority : template.priority,
    conflictRule: keepExistingDetails ? existing?.conflictRule || template.conflictRule : template.conflictRule,
  };
}

function applyAgentProposedAssetChanges(
  asset: ProjectVibeAsset,
  input: ProjectVibeCreativeLoopInput,
  runRef: string,
  affectedShotIds: string[],
): ProjectVibeAsset {
  const proposedStatus = agentProposedAssetStatus(input);
  const proposedRoleBinding = assetRoleBindingFromAgentChange(input, asset, affectedShotIds);
  return {
    ...asset,
    ...(proposedStatus ? { status: proposedStatus } : {}),
    ...(proposedStatus ? { lockedBy: proposedStatus === "locked" ? "user" as const : undefined } : {}),
    ...(proposedRoleBinding ? { roleBinding: proposedRoleBinding } : {}),
    textConstraints: confirmedCreativeConstraint(asset.textConstraints, input.userIntent),
    usedByShotIds: unique([...asset.usedByShotIds, ...affectedShotIds]),
    sourceRefs: unique([
      ...asset.sourceRefs,
      runRef,
      `project.vibe#assets/${asset.id}/textConstraints`,
      ...(proposedStatus ? [`project.vibe#assets/${asset.id}/status`] : []),
      ...(proposedRoleBinding ? [`project.vibe#assets/${asset.id}/roleBinding`] : []),
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

function requestedProjectShotCount(input: ProjectVibeCreativeLoopInput): number | undefined {
  const action = input.agentActionEnvelope;
  if (
    action &&
    (
      action.kind !== "revise_story_or_shot" ||
      action.target.kind !== "project" ||
      action.toolPlan.toolName !== "project_vibe_patch"
    )
  ) {
    return undefined;
  }
  return requestedStoryboardShotCountFromIntent(input.userIntent);
}

function parseStoryOutlineOrdinal(value: string): number | undefined {
  const normalized = value.trim().replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  if (/^\d{1,3}$/.test(normalized)) return Number.parseInt(normalized, 10);
  const digitValues: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (normalized === "十") return 10;
  const teenMatch = normalized.match(/^十([一二两俩三四五六七八九])$/u);
  if (teenMatch) return 10 + digitValues[teenMatch[1] || ""]!;
  const tenMatch = normalized.match(/^([一二两俩三四五六七八九])十([一二两俩三四五六七八九])?$/u);
  if (tenMatch) return digitValues[tenMatch[1] || ""]! * 10 + (digitValues[tenMatch[2] || ""] || 0);
  return digitValues[normalized];
}

function cleanStoryShotOutlineText(value: string): string {
  return value
    .replace(/^[\s:：、，,。；;]+/u, "")
    .replace(/(?:[。；;，,]\s*)?(?:不要|不|别|不用|不必|无需|先不要|先别|先不).{0,48}(?:参考|参考图|角色图|场景图|道具图|故事板|视频|提交|发送|导出).*/u, "")
    .replace(/[\s。；;，,]+$/u, "")
    .trim();
}

function explicitStoryShotOutlinesFromIntent(value: string, requestedCount: number): Map<number, string> {
  const outlines = new Map<number, string>();
  const markerPattern = /第([一二两俩三四五六七八九十0-9０-９]{1,3})(?:个)?(?:镜头|镜|分镜|段)\s*[：:、，,]*/gu;
  const matches = Array.from(value.matchAll(markerPattern));
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (match.index == null) continue;
    const ordinal = parseStoryOutlineOrdinal(match[1] || "");
    if (!ordinal || ordinal < 1 || ordinal > requestedCount) continue;
    const nextMatch = matches[index + 1];
    const start = match.index + match[0].length;
    const end = nextMatch?.index ?? value.length;
    const outline = cleanStoryShotOutlineText(value.slice(start, end));
    if (outline) outlines.set(ordinal - 1, outline);
  }
  return outlines;
}

function storyShotOutlineTitle(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").replace(/[\s。；;，,]+$/u, "").trim();
  if (!normalized) return fallback;
  return normalized.length > 30 ? `${normalized.slice(0, 30)}...` : normalized;
}

function explicitStoryShotSectionFor(input: {
  index: number;
  requestedCount: number;
  orderedSections: ProjectVibeStoryFlow["sections"];
  fallbackSection: ProjectVibeStoryFlow["sections"][number];
}): ProjectVibeStoryFlow["sections"][number] {
  if (input.orderedSections.length <= 1) return input.fallbackSection;
  const sectionIndex = Math.min(
    input.orderedSections.length - 1,
    Math.max(0, Math.ceil(((input.index + 1) * input.orderedSections.length) / input.requestedCount) - 1),
  );
  return input.orderedSections[sectionIndex] || input.fallbackSection;
}

function nextStoryShotId(usedIds: Set<string>, index: number): string {
  let candidate = `shot_${String(index + 1).padStart(3, "0")}`;
  let suffix = index + 1;
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `shot_${String(suffix).padStart(3, "0")}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function projectShotCountRestructure(input: ProjectVibeCreativeLoopInput, runReceipt: ProjectVibeRunReceipt, runRef: string): {
  storyFlow: ProjectVibeStoryFlow;
  shots: ProjectVibeShot[];
} | undefined {
  const requestedCount = requestedProjectShotCount(input);
  if (!requestedCount) return undefined;
  const existingShotById = new Map(input.project.shots.map((shot) => [shot.id, shot]));
  const existingOrder = input.project.storyFlow.shotOrder.length
    ? input.project.storyFlow.shotOrder
    : input.project.shots.map((shot) => shot.id);
  const baseShot =
    existingOrder.map((shotId) => existingShotById.get(shotId)).find(Boolean) ||
    input.project.shots[0];
  if (!baseShot) return undefined;
  const targetSection =
    input.project.storyFlow.sections.find((section) => section.shotIds.includes(baseShot.id)) ||
    input.project.storyFlow.sections[0];
  if (!targetSection) return undefined;
  const explicitShotOutlines = explicitStoryShotOutlinesFromIntent(input.userIntent, requestedCount);
  const hasExplicitShotOutlines = explicitShotOutlines.size > 0;
  const orderedSections = [...input.project.storyFlow.sections].sort((left, right) => left.sequenceIndex - right.sequenceIndex);

  const nextShotIds = existingOrder.slice(0, requestedCount);
  const usedShotIds = new Set(input.project.shots.map((shot) => shot.id));
  while (nextShotIds.length < requestedCount) {
    nextShotIds.push(nextStoryShotId(usedShotIds, nextShotIds.length));
  }
  const retainedShotIds = new Set(nextShotIds);

  const nextShots = nextShotIds.map((shotId, index): ProjectVibeShot => {
    const existingShot = existingShotById.get(shotId);
    const sourceShot = existingShot || baseShot;
    const outline = explicitShotOutlines.get(index);
    const shotSection = hasExplicitShotOutlines
      ? explicitStoryShotSectionFor({ index, requestedCount, orderedSections, fallbackSection: targetSection })
      : input.project.storyFlow.sections.find((section) => section.id === existingShot?.sectionId) || targetSection;
    const outlineIntent = outline ? `镜头 ${index + 1}：${outline}` : "";
    return {
      ...sourceShot,
      id: shotId,
      sectionId: shotSection.id,
      title: outline
        ? storyShotOutlineTitle(outline, `${shotSection.title || "镜头"} ${index + 1}`)
        : existingShot?.title || `${shotSection.title || "镜头"} ${index + 1}`,
      intent: outline
        ? confirmedCreativeIntent("", outlineIntent)
        : confirmedCreativeIntent(sourceShot.intent || shotSection.summary, input.userIntent),
      ...(outline ? { primaryAction: outline } : {}),
      status: plannedShotStatusForCreativeFact(sourceShot.status),
      sourceRefs: unique([
        ...sourceShot.sourceRefs,
        runRef,
        `project.vibe#storyFlow`,
        `project.vibe#shots/${shotId}`,
      ]),
    };
  });
  const nextShotIdsBySectionId = new Map(input.project.storyFlow.sections.map((section) => [section.id, [] as string[]]));
  const explicitOutlinesBySectionId = new Map(input.project.storyFlow.sections.map((section) => [section.id, [] as string[]]));
  for (const shot of nextShots) {
    nextShotIdsBySectionId.set(shot.sectionId, [...(nextShotIdsBySectionId.get(shot.sectionId) || []), shot.id]);
    const outline = explicitShotOutlines.get(nextShotIds.indexOf(shot.id));
    if (outline) {
      explicitOutlinesBySectionId.set(shot.sectionId, [...(explicitOutlinesBySectionId.get(shot.sectionId) || []), outline]);
    }
  }

  const storyFlow: ProjectVibeStoryFlow = {
    ...input.project.storyFlow,
    updatedAt: runReceipt.createdAt,
    sections: input.project.storyFlow.sections.map((item) => {
      const sectionShotIds = nextShotIdsBySectionId.get(item.id) || [];
      const sectionOutlines = explicitOutlinesBySectionId.get(item.id) || [];
      return {
        ...item,
        summary: hasExplicitShotOutlines && sectionOutlines.length
          ? confirmedCreativeSummary(item.summary, sectionOutlines.join("；"))
          : item.id === targetSection.id
            ? confirmedCreativeSummary(item.summary, input.userIntent)
            : item.summary,
        shotIds: unique(sectionShotIds.filter((shotId) => retainedShotIds.has(shotId))),
      };
    }),
    shotOrder: nextShotIds,
  };

  return { storyFlow, shots: nextShots };
}

function patchOperationsFor(input: ProjectVibeCreativeLoopInput, runReceipt: ProjectVibeRunReceipt): ProjectVibePatchOperation[] {
  const runRef = `project.vibe#runs/${runReceipt.id}`;
  const storyShotCountRestructure = projectShotCountRestructure(input, runReceipt, runRef);
  const storyFlow = storyShotCountRestructure?.storyFlow || applyAgentProposedSectionChanges(input, runReceipt);
  const writesShotIntentFact = shouldWriteShotIntentFact(input);
  const writesShotFeedbackDirective = shouldWriteShotFeedbackDirective(input);
  const writesProposedShotField = shouldWriteAgentProposedShotFields(input);
  const restructuredShotIds = new Set(storyShotCountRestructure?.shots.map((shot) => shot.id) || []);
  const storyShotCountOperations = (storyShotCountRestructure?.shots || []).map((shot) => ({
    op: "upsert_shot" as const,
    shot,
  }));
  const shotOperations = shouldWriteShotPatch(input)
    ? runReceipt.affectedShotIds
      .map((shotId) => input.project.shots.find((shot) => shot.id === shotId))
      .filter((shot): shot is ProjectVibeDocument["shots"][number] => Boolean(shot))
      .filter((shot) => !restructuredShotIds.has(shot.id))
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
    .map((assetId) =>
      input.project.assets.find((asset) => asset.id === assetId) ||
      promotedProjectAssetFromRuntimeAsset(input, assetId, runRef, runReceipt.affectedShotIds),
    )
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
    ...storyShotCountOperations,
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
