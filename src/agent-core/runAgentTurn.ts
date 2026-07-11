import {
  buildDirectorAgentActionEnvelope,
  directorAgentDisplayTargetLabel,
} from "../core/directorAgentAction";
import type {
  DirectorAgentActionEnvelope,
  DirectorAgentStateSnapshot,
} from "../core/directorAgentAction";
import {
  appendVibeAgentTimelineEntries,
  createVibeAgentTimelineDocument,
} from "./timelineDocument";
import type {
  VibeAgentProjectSnapshot,
  VibeAgentKernelTurn,
  VibeAgentActionLifecycleStatus,
  VibeAgentExecutionBoundary,
  VibeAgentKernelActionName,
  VibeAgentSelectedContext,
  VibeAgentTimelineDocument,
  VibeAgentToolName,
  VibeAgentTurnInput,
  VibeAgentTurnResult,
} from "./types";
import { VIBE_AGENT_CORE_SCHEMA_VERSION } from "./types";
import { evaluateVibeAgentPermission } from "./permissionGate";
import { buildVibeAgentDispatchPlan } from "./actionDispatch";
import {
  buildVibeAgentTurnTimelineEntries,
  confirmationTokenFor,
} from "./toolEvents";

export function runVibeAgentTurn(input: VibeAgentTurnInput): VibeAgentTurnResult {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const projectSnapshot = summarizeProjectForAgent(input.snapshot, input.projectId);
  const action = input.action || buildDirectorAgentActionEnvelope({
    userIntent: input.userMessage,
    snapshot: input.snapshot,
    executionContract: planningExecutionContract(),
    generatedAt,
  });
  const permissionDecision = evaluateVibeAgentPermission({
    action,
    permissionMode: input.permissionMode,
    userConfirmed: input.userConfirmed,
  });
  const timelineBase = input.previousTimeline || createVibeAgentTimelineDocument({
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    projectRoot: input.projectRoot,
    generatedAt,
  });
  const newEntries = buildVibeAgentTurnTimelineEntries({
    generatedAt,
    userMessage: input.userMessage,
    action,
    projectSnapshot,
    permissionDecision,
    userConfirmed: Boolean(input.userConfirmed),
  });
  const timeline = appendVibeAgentTimelineEntries(timelineBase, newEntries, generatedAt);
  const kernelTurn = buildKernelTurn({
    userMessage: input.userMessage,
    action,
    projectSnapshot,
    permissionDecision,
    userConfirmed: Boolean(input.userConfirmed),
  });
  return {
    schemaVersion: VIBE_AGENT_CORE_SCHEMA_VERSION,
    status: statusFor(action, permissionDecision),
    generatedAt,
    action,
    projectSnapshot,
    permissionDecision,
    kernelTurn,
    timeline,
    pendingConfirmationToken: permissionDecision.requiresConfirmation
      ? confirmationTokenFor(action)
      : undefined,
  };
}

function buildKernelTurn(input: {
  userMessage: string;
  action: DirectorAgentActionEnvelope;
  projectSnapshot: VibeAgentProjectSnapshot;
  permissionDecision: { allowed: boolean; requiresConfirmation: boolean; reason: string };
  userConfirmed: boolean;
}): VibeAgentKernelTurn {
  const dispatch = buildVibeAgentDispatchPlan(input.action);
  const selectedContext = selectedContextFor(input.action);
  const actionName = kernelActionNameFor(input.action, dispatch.executorTool);
  const relatedShots = relatedShotIdsFor(input.action, input.projectSnapshot);
  const relatedAssets = relatedAssetIdsFor(input.action, input.projectSnapshot);
  const lifecycle = kernelLifecycleFor({ ...input, executorTool: dispatch.executorTool });
  const callsProvider = dispatch.executor.callsProvider;
  const mutatesProject = dispatch.executor.mutatesProject;
  const executionBoundary = executionBoundaryFor({
    callsProvider,
    mutatesProject,
    requiresConfirmation: input.permissionDecision.requiresConfirmation,
    executorTool: dispatch.executorTool,
  });
  const executionResult = executionResultFor({
    action: input.action,
    permissionDecision: input.permissionDecision,
    lifecycle,
    executorTool: dispatch.executorTool,
  });
  return {
    userMessage: input.userMessage,
    agentUnderstanding: input.action.userFacingMessage || input.action.summary,
    projectStateSummary: projectStateSummary(input.projectSnapshot),
    projectHierarchy: projectHierarchyLabel(input.projectSnapshot),
    projectDiagnostics: projectDiagnosticsFor(input.projectSnapshot, input.action),
    selectedContext,
    proposedActions: [{
      name: actionName,
      label: dispatch.label,
      lifecycle,
      target: selectedContext,
      requiresConfirmation: input.permissionDecision.requiresConfirmation,
      mutatesProject,
      callsProvider,
      costLabel: callsProvider ? "会使用生成或外部服务" : mutatesProject ? "会写入项目" : "只读取项目",
    }],
    executionBoundary,
    executionResult,
    requiredConfirmation: input.permissionDecision.requiresConfirmation,
    executionCost: executionBoundary.summary,
    externalSubmissionRisk: executionBoundary.submitsExternalTask
      ? "确认后提交 Seedance；保持串行，不并发。"
      : callsProvider
        ? "确认后会调用生成或联网服务。"
        : "不会提交视频。",
    resultSummary: executionResult.summary,
    nextSuggestion: executionResult.next,
    relatedShots,
    relatedAssets,
    relatedSkills: skillsFor(input.action),
    createdOrUpdatedFiles: expectedFilesFor(input.action, dispatch.executorTool),
    errors: input.action.blockers,
  };
}

function kernelLifecycleFor(input: {
  action: DirectorAgentActionEnvelope;
  permissionDecision: { allowed: boolean; requiresConfirmation: boolean };
  userConfirmed: boolean;
  executorTool: VibeAgentToolName;
}): VibeAgentActionLifecycleStatus {
  if (input.action.status === "blocked") return "needs_user_input";
  if (!input.permissionDecision.allowed && input.permissionDecision.requiresConfirmation) return "waiting_for_confirmation";
  if (!input.permissionDecision.allowed) return "needs_user_input";
  if (input.userConfirmed) return "running";
  if (!input.permissionDecision.requiresConfirmation && isImmediateObservationTool(input.executorTool)) return "succeeded";
  return "proposed";
}

function executionBoundaryFor(input: {
  callsProvider: boolean;
  mutatesProject: boolean;
  requiresConfirmation: boolean;
  executorTool?: VibeAgentToolName;
}): VibeAgentExecutionBoundary {
  const submitsExternalTask = input.executorTool === "submit_video";
  const costRisk = submitsExternalTask
    ? "external_video_submission"
    : input.callsProvider
      ? "external_provider"
      : input.mutatesProject
        ? "project_write"
        : "none";
  const summary = submitsExternalTask
    ? "会提交 Seedance 视频任务"
    : input.executorTool === "generate_references"
      ? "会生成参考图"
      : input.executorTool === "research_style"
        ? "会联网查资料"
        : input.callsProvider
          ? "会调用生成或联网服务"
          : input.mutatesProject
            ? "只保存项目修改"
            : "只读取项目";
  return {
    mutatesProject: input.mutatesProject,
    callsProvider: input.callsProvider,
    submitsExternalTask,
    requiresConfirmation: input.requiresConfirmation,
    costRisk,
    summary,
  };
}

function executionResultFor(input: {
  action: DirectorAgentActionEnvelope;
  permissionDecision: { allowed: boolean; requiresConfirmation: boolean; reason: string };
  lifecycle: VibeAgentActionLifecycleStatus;
  executorTool: VibeAgentToolName;
}) {
  if (input.action.status === "blocked" || (!input.permissionDecision.allowed && !input.permissionDecision.requiresConfirmation)) {
    return {
      lifecycle: input.lifecycle,
      status: "blocked" as const,
      summary: input.action.blockers[0] || input.permissionDecision.reason,
      next: "先处理阻断项，或者告诉我怎么调整。",
    };
  }
  if (input.permissionDecision.requiresConfirmation) {
    return {
      lifecycle: input.lifecycle,
      status: "awaiting_confirmation" as const,
      summary: input.permissionDecision.reason,
      next: "确认后我再执行；你也可以直接说要改哪里。",
    };
  }
  if (input.lifecycle === "succeeded" && isImmediateObservationTool(input.executorTool)) {
    return {
      lifecycle: input.lifecycle,
      status: "succeeded" as const,
      summary: input.executorTool === "classify_assets"
        ? "已整理素材用途和绑定建议，并写进消息流。"
        : "已读取项目状态，并写进消息流。",
      next: input.executorTool === "classify_assets"
        ? "先确认待定素材，或继续告诉我下一步。"
        : "按上面的项目状态继续，或直接说要改哪里。",
    };
  }
  if (input.lifecycle === "running") {
    return {
      lifecycle: input.lifecycle,
      status: "running" as const,
      summary: "已确认，正在执行。",
      next: "我会把执行结果写回消息流，并提示下一步。",
    };
  }
  return {
    lifecycle: input.lifecycle,
    status: "ready_to_run" as const,
    summary: "可以执行下一步。",
    next: "我会把结果写回消息流，并提示下一步。",
  };
}

function isImmediateObservationTool(toolName: VibeAgentToolName) {
  return toolName === "inspect_project" || toolName === "classify_assets";
}

function relatedShotIdsFor(action: DirectorAgentActionEnvelope, snapshot: VibeAgentProjectSnapshot) {
  return uniqueStrings([
    ...(action.target.kind === "shot" || action.target.kind === "multi_shot" ? action.target.ids : []),
    ...action.sourceContext.selectedShotIds,
    ...(snapshot.assetInbox?.items || []).flatMap((item) => item.shotIds || []),
  ]).slice(0, 12);
}

function relatedAssetIdsFor(action: DirectorAgentActionEnvelope, snapshot: VibeAgentProjectSnapshot) {
  return uniqueStrings([
    action.sourceContext.selectedAssetId || "",
    ...(snapshot.assetInbox?.items || [])
      .filter((item) => item.needsReview)
      .map((item) => item.assetId || ""),
  ]).slice(0, 12);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function selectedContextFor(action: DirectorAgentActionEnvelope): VibeAgentSelectedContext {
  return {
    kind: action.target.kind === "multi_shot" ? "multi_shot" : action.target.kind,
    label: directorAgentDisplayTargetLabel(action.target, action.sourceContext),
    ids: action.target.ids,
  };
}

function projectStateSummary(snapshot: VibeAgentProjectSnapshot) {
  const parts = [
    projectHierarchyLabel(snapshot),
    snapshot.missingReferences ? `${snapshot.missingReferences} 个参考待补` : "",
    snapshot.needsReviewReferences ? `${snapshot.needsReviewReferences} 个参考待复核` : "",
    snapshot.videoWaitingCount ? `${snapshot.videoWaitingCount} 段视频等待回流` : "",
    snapshot.videoCompletedCount ? `${snapshot.videoCompletedCount} 段视频已返回` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("，") : "项目还在起步阶段。";
}

function projectHierarchyLabel(snapshot: Pick<VibeAgentProjectSnapshot, "totalSections" | "totalShots" | "totalAssets" | "skillCount">) {
  const storyPart = snapshot.totalSections > 0
    ? `${snapshot.totalSections} 个段落 / ${snapshot.totalShots} 个镜头`
    : `${snapshot.totalShots} 个镜头`;
  const assetPart = `${snapshot.totalAssets} 个素材`;
  const skillPart = `${snapshot.skillCount} 个 Skills`;
  return `${storyPart} / ${assetPart} / ${skillPart}`;
}

function projectDiagnosticsFor(snapshot: VibeAgentProjectSnapshot, action: DirectorAgentActionEnvelope) {
  const diagnostics: string[] = [];
  if (snapshot.missingReferences > 0) {
    diagnostics.push(`参考缺口：还有 ${snapshot.missingReferences} 项参考要补齐，生成前需要确认范围。`);
  }
  if (snapshot.needsReviewReferences > 0 || (snapshot.assetInbox?.needsReviewCount || 0) > 0) {
    const count = Math.max(snapshot.needsReviewReferences, snapshot.assetInbox?.needsReviewCount || 0);
    diagnostics.push(`素材复核：${count} 项素材或参考还要确认用途。`);
  }
  if (/待判断/.test(action.sourceContext.projectReadiness.modeSummary)) {
    diagnostics.push("镜头方式：有镜头还没判断故事板叙事、故事板快切或全能参考。");
  }
  const selectedScenes = Array.from(new Set(action.sourceContext.selectedShotContexts
    .flatMap((shot) => shot.context.sceneGuidance)
    .map((value) => value.trim())
    .filter(Boolean)));
  if (selectedScenes.length > 1) {
    diagnostics.push("场景范围：当前选中的多个镜头包含不同场景，生成故事板或视频前要确认是否拆段。");
  }
  if (action.sourceContext.videoState.canResume || action.sourceContext.videoState.waitingCount > 0) {
    diagnostics.push("视频回流：已有 Seedance 任务在排队或可查询，继续时应先查结果，避免重复提交。");
  }
  if (!diagnostics.length) diagnostics.push("暂时没有明显阻断，可以继续按 Agent 建议推进。");
  return diagnostics.slice(0, 4);
}

function kernelActionNameFor(
  action: DirectorAgentActionEnvelope,
  executorTool?: VibeAgentToolName,
): VibeAgentKernelActionName {
  if (executorTool === "generate_references") return "generate_references";
  if (executorTool === "classify_assets") return "classify_assets";
  if (executorTool === "compile_video_request") return "compile_video_request";
  if (executorTool === "submit_video") return "submit_video";
  if (executorTool === "query_video") return "query_video";
  if (executorTool === "export_showcase" || executorTool === "export_project") return "export_showcase";
  if (executorTool === "save_skill") return "save_skill";
  if (action.kind === "inspect_project_status") return "inspect_project";
  if (action.kind === "revise_story_or_shot" || action.kind === "update_shot_strategy") return "revise_shot";
  if (action.kind === "prepare_reference_generation") return "generate_references";
  if (action.kind === "prepare_video_submit") return "submit_video";
  if (action.kind === "query_video_result") return "query_video";
  if (action.kind === "prepare_export") return "export_showcase";
  return "plan_story";
}

function skillsFor(action: DirectorAgentActionEnvelope) {
  const strategyLabels: Record<string, string> = {
    storyboard_narrative: "故事板叙事",
    storyboard_rapid_cut: "故事板快切",
    omni_reference: "全能参考",
  };
  return Array.from(new Set(action.sourceContext.selectedShotContexts
    .map((shot) => shot.referenceStrategy ? strategyLabels[shot.referenceStrategy] || shot.referenceStrategy : undefined)
    .filter((value): value is string => Boolean(value))));
}

function expectedFilesFor(action: DirectorAgentActionEnvelope, executorTool?: VibeAgentToolName) {
  if (action.kind === "prepare_export") return ["exports/"];
  if (action.kind === "prepare_reference_generation") return ["assets/generated/", ".vibe-runtime/"];
  if (executorTool === "compile_video_request") return ["Project.vibe"];
  if (action.kind === "prepare_video_submit" || action.kind === "query_video_result") return [".vibe-runtime/video-relay-queue.json"];
  if (action.kind === "revise_story_or_shot" || action.kind === "update_shot_strategy") return ["Project.vibe"];
  return [];
}

function summarizeProjectForAgent(
  snapshot: DirectorAgentStateSnapshot,
  projectId: string,
): VibeAgentProjectSnapshot {
  return {
    projectId,
    projectTitle: snapshot.projectTitle,
    projectRoot: snapshot.projectRoot,
    totalSections: snapshot.sectionCount,
    totalShots: snapshot.totalShots,
    totalAssets: snapshot.totalAssets,
    skillCount: snapshot.skillCount,
    missingReferences: snapshot.assetCounts.missing,
    needsReviewReferences: snapshot.assetCounts.needsReview,
    lockedReferences: snapshot.assetCounts.locked,
    readyForVideo: snapshot.projectReadiness.status === "ready_for_video",
    videoStatus: snapshot.videoState.status,
    videoCanResume: snapshot.videoState.canResume,
    videoWaitingCount: snapshot.videoState.waitingCount,
    videoCompletedCount: snapshot.videoState.completedCount,
    videoReviewCount: snapshot.videoState.reviewCount,
    currentView: snapshot.currentView,
    selectedShotIds: snapshot.selectedShotIds,
    selectedAssetId: snapshot.selectedAssetId,
    assetInbox: snapshot.assetInbox,
  };
}

function planningExecutionContract() {
  return {
    mode: "video_allowed" as const,
    referenceGenerationAllowed: true,
    videoSubmitAllowed: true,
    providerSubmitAllowed: true,
    reason: "Agent 内核先规划最佳动作，实际执行由 Vibe 权限门和用户确认决定。",
  };
}

function statusFor(
  action: DirectorAgentActionEnvelope,
  permissionDecision: { allowed: boolean; requiresConfirmation: boolean },
): VibeAgentTurnResult["status"] {
  if (action.status === "blocked") return "blocked";
  if (permissionDecision.requiresConfirmation) return "awaiting_confirmation";
  if (action.kind === "inspect_project_status") return "inspected";
  return "action_ready";
}
