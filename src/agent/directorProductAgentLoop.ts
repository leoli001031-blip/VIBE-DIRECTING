import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
  type BuildDirectorAgentStateSnapshotInput,
  type DirectorAgentActionEnvelope,
  type DirectorAgentExecutionContract,
  type DirectorAgentStateSnapshot,
} from "../core/directorAgentAction";
import {
  buildDirectorAgentToolHandoff,
  defaultDirectorAgentToolAvailability,
  type DirectorAgentToolAvailability,
  type DirectorAgentToolHandoff,
} from "../core/directorAgentToolHandoff";
import type { ProjectRuntimeState } from "../core/projectState";
import type { KnowledgePackManifest } from "../core/knowledgeTypes";
import {
  buildDirectorQaUserFeedback,
  type DirectorQaUserFeedback,
} from "../core/directorQaUserFeedback";
import {
  runDirectorRuleQa,
  type DirectorRuleQaReport,
} from "../core/directorRuleQa";
import type { DirectorTextQaReport } from "../core/directorTextQa";
import {
  confirmProjectVibeCreativeLoop,
  stageProjectVibeCreativeLoop,
  type ProjectVibeCreativeLoopConfirmResult,
  type ProjectVibeCreativeLoopStageResult,
} from "../project/projectVibeCreativeLoop";
import { buildProjectRuntimeStateFromProjectVibe } from "../project/projectVibeRuntimeState";
import type { ProjectVibeDocument } from "../project/types";

export const directorProductAgentLoopSchemaVersion = "director_product_agent_loop/0.1.0";

export type DirectorProductAgentLoopStatus =
  | "awaiting_confirmation"
  | "inspected"
  | "tool_ready"
  | "project_patch_written"
  | "project_written"
  | "blocked";

export interface DirectorProductAgentLoopSelection {
  currentView?: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
}

export interface RunDirectorProductAgentLoopInput {
  project: ProjectVibeDocument;
  runtimeState: ProjectRuntimeState;
  userIntent: string;
  userConfirmed: boolean;
  generatedAt?: string;
  projectRoot?: string;
  projectPath?: string;
  selection?: DirectorProductAgentLoopSelection;
  executionContract?: Partial<DirectorAgentExecutionContract>;
  availability?: Partial<DirectorAgentToolAvailability>;
  agentActionEnvelope?: DirectorAgentActionEnvelope;
  agentToolHandoff?: DirectorAgentToolHandoff;
  textQaReport?: DirectorTextQaReport;
  knowledgeManifest?: KnowledgePackManifest;
}

export interface DirectorProductAgentLoopResult {
  schemaVersion: typeof directorProductAgentLoopSchemaVersion;
  status: DirectorProductAgentLoopStatus;
  generatedAt: string;
  snapshot: DirectorAgentStateSnapshot;
  action: DirectorAgentActionEnvelope;
  toolHandoff: DirectorAgentToolHandoff;
  stageResult?: ProjectVibeCreativeLoopStageResult;
  confirmResult?: ProjectVibeCreativeLoopConfirmResult;
  ruleQaReport?: DirectorRuleQaReport;
  textQaReport?: DirectorTextQaReport;
  qaFeedback?: DirectorQaUserFeedback;
  nextProject?: ProjectVibeDocument;
  nextRuntimeState?: ProjectRuntimeState;
  projectVibeWritten: boolean;
  providerCalled: false;
  workerSpawned: false;
  toolInvocationReady: boolean;
  blockedReasons: string[];
}

function snapshotInputFor(input: RunDirectorProductAgentLoopInput): BuildDirectorAgentStateSnapshotInput {
  return {
    runtimeState: input.runtimeState,
    currentView: input.selection?.currentView,
    selectedShotId: input.selection?.selectedShotId,
    selectedShotIds: input.selection?.selectedShotIds,
    selectedAssetId: input.selection?.selectedAssetId,
    sectionId: input.selection?.sectionId,
  };
}

function availabilityFor(input: RunDirectorProductAgentLoopInput): DirectorAgentToolAvailability {
  const hasConcreteProjectRoot = Boolean(
    concreteRuntimeProjectRoot(input.projectRoot)
      || concreteRuntimeProjectRoot(input.runtimeState.project.root),
  );
  return {
    ...defaultDirectorAgentToolAvailability,
    ...(input.availability || {}),
    projectReady: hasConcreteProjectRoot && input.availability?.projectReady !== false,
  };
}

function concreteRuntimeProjectRoot(value?: string) {
  const root = value?.trim();
  return root && root !== "project_root" ? root : "";
}

function uniqueMessages(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function effectiveSelectionFor(
  input: RunDirectorProductAgentLoopInput,
  action: DirectorAgentActionEnvelope,
): DirectorProductAgentLoopSelection {
  const actionShotIds = action.target.kind === "shot" || action.target.kind === "multi_shot"
    ? action.target.ids
    : [];
  if (actionShotIds.length) {
    return {
      ...input.selection,
      selectedShotId: actionShotIds.length === 1 ? actionShotIds[0] : undefined,
      selectedShotIds: actionShotIds.length > 1 ? actionShotIds : undefined,
      sectionId: undefined,
    };
  }
  if (action.target.kind === "asset" && action.target.ids[0]) {
    return {
      ...input.selection,
      selectedAssetId: action.target.ids[0],
    };
  }
  if (action.target.kind === "section" && action.target.ids[0]) {
    return {
      ...input.selection,
      sectionId: action.target.ids[0],
    };
  }
  return input.selection || {};
}

function statusFor(confirmResult: ProjectVibeCreativeLoopConfirmResult, handoff: DirectorAgentToolHandoff): DirectorProductAgentLoopStatus {
  if (confirmResult.status !== "project_facts_written") return "blocked";
  if (handoff.status === "ready") return "tool_ready";
  if (handoff.status === "handled_by_project_write") return "project_patch_written";
  return "project_written";
}

function scopedShotIdsForAction(
  input: RunDirectorProductAgentLoopInput,
  action: DirectorAgentActionEnvelope,
): string[] {
  if (action.target.kind === "shot" || action.target.kind === "multi_shot") return action.target.ids;
  if (action.target.kind === "section") {
    const targetSectionIds = new Set(action.target.ids);
    return input.project.storyFlow.sections
      .filter((section) => targetSectionIds.has(section.id))
      .flatMap((section) => section.shotIds);
  }
  if (action.target.kind === "asset") {
    const targetAssetIds = new Set(action.target.ids);
    return input.project.assets
      .filter((asset) => targetAssetIds.has(asset.id))
      .flatMap((asset) => asset.usedByShotIds);
  }
  return input.project.shots.map((shot) => shot.id);
}

function scopedAssetsForShots(input: RunDirectorProductAgentLoopInput, shotIds: string[]) {
  const scopedShotIdSet = new Set(shotIds);
  const explicitAssetIds = new Set(
    input.project.shots
      .filter((shot) => scopedShotIdSet.has(shot.id))
      .flatMap((shot) => [
        ...shot.characterAssetIds,
        ...shot.sceneAssetIds,
        ...shot.propAssetIds,
      ]),
  );
  return input.project.assets.filter((asset) =>
    explicitAssetIds.has(asset.id)
      || asset.usedByShotIds.some((shotId) => scopedShotIdSet.has(shotId)),
  ).map((asset) => ({
    ...asset,
    usedByShotIds: asset.usedByShotIds.filter((shotId) => scopedShotIdSet.has(shotId)),
  }));
}

function ruleQaPreflightFor(
  input: RunDirectorProductAgentLoopInput,
  action: DirectorAgentActionEnvelope,
): DirectorRuleQaReport | undefined {
  const shouldInspect = action.kind === "inspect_project_status";
  const shouldPreflightVideo = action.kind === "prepare_video_submit";
  if ((!shouldInspect && !shouldPreflightVideo) || action.status === "blocked") return undefined;
  const scopedShotIdSet = new Set(scopedShotIdsForAction(input, action));
  const scopedShots = input.project.shots.filter((shot) => scopedShotIdSet.has(shot.id));
  const targetDurationSeconds = scopedShots.reduce((sum, shot) => sum + (Number(shot.durationSeconds) || 0), 0);
  return runDirectorRuleQa({
    shots: scopedShots,
    assets: scopedAssetsForShots(input, scopedShots.map((shot) => shot.id)),
    targetDurationSeconds: targetDurationSeconds || undefined,
  });
}

function normalizeProjectRootForAgent(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}

function actionContextBlockers(
  action: DirectorAgentActionEnvelope,
  snapshot: DirectorAgentStateSnapshot,
): string[] {
  const actionProjectRoot = normalizeProjectRootForAgent(action.sourceContext.projectRoot);
  const snapshotProjectRoot = normalizeProjectRootForAgent(snapshot.projectRoot);
  if (actionProjectRoot && snapshotProjectRoot && actionProjectRoot !== snapshotProjectRoot) {
    return ["agent_action_project_context_mismatch"];
  }
  return [];
}

function qaBlockerMessages(input: {
  ruleQaReport?: DirectorRuleQaReport;
  textQaReport?: DirectorTextQaReport;
}): string[] {
  return uniqueMessages([
    ...(input.ruleQaReport?.findings || [])
      .filter((finding) => finding.severity === "blocker")
      .map((finding) => finding.message),
    ...(input.textQaReport?.findings || [])
      .filter((finding) => finding.severity === "blocker")
      .map((finding) => finding.message),
  ]);
}

function actionWithQaBlockers(
  action: DirectorAgentActionEnvelope,
  qaFeedback: DirectorQaUserFeedback | undefined,
  blockerMessages: string[],
): DirectorAgentActionEnvelope {
  if (action.kind === "inspect_project_status") return action;
  if (!qaFeedback || qaFeedback.status !== "blocked") return action;
  const primaryMessage = qaFeedback?.summary || blockerMessages[0] || "提交前检查发现需要先修复的问题。";
  return {
    ...action,
    status: "blocked",
    summary: qaFeedback?.title || "需要修复：视频提交前检查",
    userFacingMessage: primaryMessage,
    blockers: [...action.blockers, ...blockerMessages],
  };
}

function handoffBindingBlockers(
  action: DirectorAgentActionEnvelope,
  handoff: DirectorAgentToolHandoff | undefined,
): string[] {
  if (!handoff) return [];
  const taskEnvelope = handoff.invocation?.taskEnvelope;
  return [
    handoff.actionId === action.actionId ? "" : "agent_tool_handoff_action_id_mismatch",
    handoff.handler === action.toolPlan.toolName ? "" : "agent_tool_handoff_handler_mismatch",
    handoff.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_handoff_receipt_mismatch",
    handoff.status === "ready" && !taskEnvelope ? "agent_tool_handoff_task_envelope_missing" : "",
    handoff.invocation?.confirmation.actionId === action.actionId ? "" : handoff.status === "ready" ? "agent_tool_handoff_confirmation_action_id_mismatch" : "",
    handoff.invocation?.confirmation.expectedReceipt === action.toolPlan.expectedReceipt ? "" : handoff.status === "ready" ? "agent_tool_handoff_confirmation_receipt_mismatch" : "",
    !taskEnvelope || taskEnvelope.actionId === action.actionId ? "" : "agent_tool_handoff_task_action_id_mismatch",
    !taskEnvelope || taskEnvelope.handler === action.toolPlan.toolName ? "" : "agent_tool_handoff_task_handler_mismatch",
    !taskEnvelope || taskEnvelope.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_handoff_task_receipt_mismatch",
    !taskEnvelope || taskEnvelope.providerSubmitAllowed === action.toolPlan.providerSubmitAllowed ? "" : "agent_tool_handoff_task_provider_policy_mismatch",
    !taskEnvelope || normalizeProjectRootForAgent(taskEnvelope.sourceContext.projectRoot) === normalizeProjectRootForAgent(action.sourceContext.projectRoot) ? "" : "agent_tool_handoff_task_project_context_mismatch",
    !taskEnvelope || taskEnvelope.policyBinding === "director_agent_tool_handoff" ? "" : "agent_tool_handoff_task_policy_mismatch",
    !taskEnvelope || taskEnvelope.projectWriteRequiredBeforeInvocation === true ? "" : "agent_tool_handoff_task_write_gate_mismatch",
    !taskEnvelope || Boolean(taskEnvelope.inputHash) ? "" : "agent_tool_handoff_task_input_hash_missing",
  ].filter(Boolean);
}

function actionWithHandoffBindingBlockers(
  action: DirectorAgentActionEnvelope,
  blockers: string[],
): DirectorAgentActionEnvelope {
  if (!blockers.length) return action;
  return {
    ...action,
    status: "blocked",
    summary: "需要重新生成：Agent 执行动作已过期",
    userFacingMessage: "这次确认对应的动作已经变了，请重新发送一次。",
    blockers: [...action.blockers, ...blockers],
  };
}

function earlyBlockedResult(input: {
  generatedAt: string;
  snapshot: DirectorAgentStateSnapshot;
  action: DirectorAgentActionEnvelope;
  toolHandoff: DirectorAgentToolHandoff;
  ruleQaReport?: DirectorRuleQaReport;
  textQaReport?: DirectorTextQaReport;
  qaFeedback?: DirectorQaUserFeedback;
}): DirectorProductAgentLoopResult {
  return {
    schemaVersion: directorProductAgentLoopSchemaVersion,
    status: "blocked",
    generatedAt: input.generatedAt,
    snapshot: input.snapshot,
    action: input.action,
    toolHandoff: input.toolHandoff,
    ruleQaReport: input.ruleQaReport,
    textQaReport: input.textQaReport,
    qaFeedback: input.qaFeedback,
    projectVibeWritten: false,
    providerCalled: false,
    workerSpawned: false,
    toolInvocationReady: false,
    blockedReasons: uniqueMessages([
      ...input.action.blockers,
      ...input.toolHandoff.blockers.map((blocker) => `agent_tool_handoff_blocked:${blocker}`),
    ]),
  };
}

function inspectedResult(input: {
  generatedAt: string;
  snapshot: DirectorAgentStateSnapshot;
  action: DirectorAgentActionEnvelope;
  toolHandoff: DirectorAgentToolHandoff;
  ruleQaReport?: DirectorRuleQaReport;
  textQaReport?: DirectorTextQaReport;
  qaFeedback?: DirectorQaUserFeedback;
}): DirectorProductAgentLoopResult {
  return {
    schemaVersion: directorProductAgentLoopSchemaVersion,
    status: "inspected",
    generatedAt: input.generatedAt,
    snapshot: input.snapshot,
    action: input.action,
    toolHandoff: input.toolHandoff,
    ruleQaReport: input.ruleQaReport,
    textQaReport: input.textQaReport,
    qaFeedback: input.qaFeedback,
    projectVibeWritten: false,
    providerCalled: false,
    workerSpawned: false,
    toolInvocationReady: false,
    blockedReasons: [],
  };
}

export function runDirectorProductAgentLoop(input: RunDirectorProductAgentLoopInput): DirectorProductAgentLoopResult {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const snapshot = buildDirectorAgentStateSnapshot(snapshotInputFor(input));
  const initialAction = input.agentActionEnvelope || buildDirectorAgentActionEnvelope({
    userIntent: input.userIntent,
    snapshot,
    executionContract: input.executionContract,
    generatedAt,
  });
  const contextCheckedAction = actionWithHandoffBindingBlockers(initialAction, actionContextBlockers(initialAction, snapshot));
  const ruleQaReport = ruleQaPreflightFor(input, contextCheckedAction);
  const qaFeedback = buildDirectorQaUserFeedback({
    ruleQaReport,
    textQaReport: input.textQaReport,
  });
  const qaCheckedAction = actionWithQaBlockers(
    contextCheckedAction,
    qaFeedback,
    qaBlockerMessages({ ruleQaReport, textQaReport: input.textQaReport }),
  );
  const handoffBindingIssues = handoffBindingBlockers(qaCheckedAction, input.agentToolHandoff);
  const action = actionWithHandoffBindingBlockers(qaCheckedAction, handoffBindingIssues);
  const toolHandoff = input.agentToolHandoff && action === initialAction && handoffBindingIssues.length === 0
    ? input.agentToolHandoff
    : buildDirectorAgentToolHandoff({
        action,
        userConfirmed: input.userConfirmed,
        confirmedAt: generatedAt,
        availability: availabilityFor(input),
      });
  const effectiveSelection = effectiveSelectionFor(input, action);

  if (action.kind === "inspect_project_status" && action.status !== "blocked") {
    return inspectedResult({
      generatedAt,
      snapshot,
      action,
      toolHandoff,
      ruleQaReport,
      textQaReport: input.textQaReport,
      qaFeedback,
    });
  }

  if (action.status === "blocked") {
    return earlyBlockedResult({
      generatedAt,
      snapshot,
      action,
      toolHandoff,
      ruleQaReport,
      textQaReport: input.textQaReport,
      qaFeedback,
    });
  }

  if (!input.userConfirmed) {
    const stageResult = stageProjectVibeCreativeLoop({
      project: input.project,
      userIntent: input.userIntent,
      selectedShotId: effectiveSelection.selectedShotId,
      selectedShotIds: effectiveSelection.selectedShotIds,
      selectedAssetId: effectiveSelection.selectedAssetId,
      sectionId: effectiveSelection.sectionId,
      generatedAt,
      projectRoot: input.projectRoot,
      projectPath: input.projectPath,
      runtimeState: input.runtimeState,
      agentActionEnvelope: action,
      agentToolHandoff: toolHandoff,
    });
    const handoffBlockers = toolHandoff.blockers.filter((blocker) => blocker !== "user_confirmation_required");
    const blockedReasons = uniqueMessages([
      ...stageResult.blockedReasons,
      ...action.blockers,
      ...handoffBlockers,
    ]);
    return {
      schemaVersion: directorProductAgentLoopSchemaVersion,
      status: blockedReasons.length ? "blocked" : "awaiting_confirmation",
      generatedAt,
      snapshot,
      action,
      toolHandoff,
      ruleQaReport,
      textQaReport: input.textQaReport,
      qaFeedback,
      stageResult,
      projectVibeWritten: false,
      providerCalled: false,
      workerSpawned: false,
      toolInvocationReady: false,
      blockedReasons,
    };
  }

  const confirmResult = confirmProjectVibeCreativeLoop({
    project: input.project,
    userIntent: input.userIntent,
    selectedShotId: effectiveSelection.selectedShotId,
    selectedShotIds: effectiveSelection.selectedShotIds,
    selectedAssetId: effectiveSelection.selectedAssetId,
    sectionId: effectiveSelection.sectionId,
    generatedAt,
    projectRoot: input.projectRoot,
    projectPath: input.projectPath,
    runtimeState: input.runtimeState,
    agentActionEnvelope: action,
    agentToolHandoff: toolHandoff,
    userConfirmed: true,
  });
  const nextRuntimeState = confirmResult.status === "project_facts_written" && confirmResult.nextProject
    ? buildProjectRuntimeStateFromProjectVibe({
        project: confirmResult.nextProject,
        projectRoot: input.projectRoot,
        projectPath: input.projectPath,
        generatedAt,
        knowledgeManifest: input.knowledgeManifest,
      })
    : undefined;

  return {
    schemaVersion: directorProductAgentLoopSchemaVersion,
    status: statusFor(confirmResult, toolHandoff),
    generatedAt,
    snapshot,
    action,
    toolHandoff,
    ruleQaReport,
    textQaReport: input.textQaReport,
    qaFeedback,
    confirmResult,
    nextProject: confirmResult.nextProject,
    nextRuntimeState,
    projectVibeWritten: confirmResult.projectVibeWritten,
    providerCalled: false,
    workerSpawned: false,
    toolInvocationReady: confirmResult.status === "project_facts_written" && toolHandoff.status === "ready",
    blockedReasons: uniqueMessages([
      ...confirmResult.blockedReasons,
      ...action.blockers,
      ...toolHandoff.blockers.map((blocker) => `agent_tool_handoff_blocked:${blocker}`),
    ]),
  };
}
