import type { ProjectRuntimeState } from "./projectState";
import type { DirectorProductionStrategyId } from "./directorProductionSkill";
import {
  detectDirectorAgentPermissionIntent,
  directorAgentPermissionIntentDisallowsVideoSubmit,
  isDirectorAgentExplainOnlyIntent,
  stripDirectorAgentPermissionControlPhrases,
} from "./directorAgentPermissionIntent";
import {
  buildProjectInboxProjection,
  type ProjectInboxKind,
  type ProjectInboxProjection,
} from "./projectAgentWorkspace";
import type { AssetRecord, ShotRecord } from "./types";

export const DIRECTOR_AGENT_ACTION_SCHEMA_VERSION = "director_agent_action/0.1.0";

export type DirectorAgentActionKind =
  | "revise_story_or_shot"
  | "inspect_project_status"
  | "update_shot_strategy"
  | "review_reference_asset"
  | "request_style_research"
  | "prepare_reference_generation"
  | "prepare_video_submit"
  | "query_video_result"
  | "prepare_export";

export type DirectorAgentActionStatus = "staged" | "blocked";

export type DirectorAgentTargetKind = "project" | "section" | "shot" | "multi_shot" | "asset";

export type DirectorAgentExecutionMode = "plan_only" | "reference_allowed" | "video_allowed";

export type DirectorAgentProjectReadinessStatus =
  | "needs_story"
  | "needs_references"
  | "needs_review"
  | "ready_for_video";

export interface DirectorAgentProjectReadiness {
  status: DirectorAgentProjectReadinessStatus;
  nextActionKind: DirectorAgentActionKind;
  nextActionLabel: string;
  actionQueue: DirectorAgentSuggestedAction[];
  summary: string;
  modeSummary: string;
  referenceSummary: string;
  lockedReferences: number;
  needsReviewReferences: number;
  missingReferences: number;
}

export interface DirectorAgentSuggestedAction {
  kind: DirectorAgentActionKind;
  label: string;
  reason: string;
  priority: "now" | "next" | "later";
}

export interface DirectorAgentExecutionContract {
  mode: DirectorAgentExecutionMode;
  referenceGenerationAllowed: boolean;
  videoSubmitAllowed: boolean;
  providerSubmitAllowed: boolean;
  reason: string;
}

export interface DirectorAgentShotContext {
  storyFunction?: string;
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  camera?: string;
  actionBeats: string[];
  characterGuidance: string[];
  sceneGuidance: string[];
  propGuidance: string[];
}

export interface DirectorAgentShotSummary {
  id: string;
  title: string;
  displayNumber: string;
  durationSeconds?: number;
  referenceStrategy?: DirectorProductionStrategyId;
  status?: string;
  context: DirectorAgentShotContext;
}

export interface DirectorAgentStateSnapshot {
  projectTitle: string;
  projectRoot?: string;
  currentView?: string;
  sectionCount: number;
  totalShots: number;
  totalAssets: number;
  skillCount: number;
  shots: DirectorAgentShotSummary[];
  selectedShotIds: string[];
  selectedAssetId?: string;
  sectionId?: string;
  selectedShot?: DirectorAgentShotSummary;
  selectedAsset?: {
    id: string;
    name: string;
    type: AssetRecord["type"];
    lockedStatus: AssetRecord["lockedStatus"];
  };
  selectedSection?: {
    id: string;
    label: string;
    shotCount: number;
    readyCount: number;
    blockedCount: number;
    shotIds: string[];
  };
  assetCounts: {
    locked: number;
    needsReview: number;
    candidate: number;
    missing: number;
  };
  assetInbox: DirectorAgentAssetInboxSnapshot;
  videoState: DirectorAgentVideoState;
  projectReadiness: DirectorAgentProjectReadiness;
}

export interface DirectorAgentAssetInboxSnapshot {
  summary: string;
  nextAction: string;
  totalCount: number;
  needsReviewCount: number;
  kindSummary: DirectorAgentAssetKindSummary[];
  items: DirectorAgentAssetInboxItem[];
}

export interface DirectorAgentAssetKindSummary {
  kind: ProjectInboxKind;
  label: string;
  count: number;
}

export interface DirectorAgentAssetInboxItem {
  kind: ProjectInboxKind;
  label: string;
  detail: string;
  suggestedBinding: string;
  suggestedAction: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  originLabel: string;
  assetId?: string;
  shotIds?: string[];
}

export type DirectorAgentVideoStatus =
  | "idle"
  | "ready"
  | "submitted"
  | "running"
  | "recoverable"
  | "needs_review"
  | "completed"
  | "failed";

export interface DirectorAgentVideoState {
  status: DirectorAgentVideoStatus;
  canResume: boolean;
  waitingCount: number;
  completedCount: number;
  reviewCount: number;
  detail?: string;
}

export interface DirectorAgentActionTarget {
  kind: DirectorAgentTargetKind;
  ids: string[];
  label: string;
}

export interface DirectorAgentProposedChange {
  field: string;
  from?: string;
  to: string;
  reason: string;
}

export interface DirectorAgentToolPlan {
  toolName:
    | "project_vibe_patch"
    | "web_search"
    | "image2_reference_generation"
    | "seedance_video_submit"
    | "project_export";
  taskEnvelopeRequired: true;
  userConfirmationRequired: true;
  providerSubmitAllowed: boolean;
  expectedReceipt:
    | "project_patch_receipt"
    | "web_research_reference_receipt"
    | "image_reference_receipt"
    | "video_submit_receipt"
    | "export_receipt";
}

export interface DirectorAgentActionEnvelope {
  schemaVersion: typeof DIRECTOR_AGENT_ACTION_SCHEMA_VERSION;
  actionId: string;
  kind: DirectorAgentActionKind;
  status: DirectorAgentActionStatus;
  summary: string;
  userFacingMessage: string;
  target: DirectorAgentActionTarget;
  proposedChanges: DirectorAgentProposedChange[];
  blockers: string[];
  requiresUserConfirmation: true;
  projectWriteMode: "staged_only";
  executionContract: DirectorAgentExecutionContract;
  toolPlan: DirectorAgentToolPlan;
  sourceContext: {
    userIntent: string;
    projectTitle: string;
    projectRoot?: string;
    currentView?: string;
    selectedShotIds: string[];
    selectedShotContexts: DirectorAgentShotSummary[];
    selectedAssetId?: string;
    sectionId?: string;
    totalShots: number;
    projectReadiness: DirectorAgentProjectReadiness;
    videoState: DirectorAgentVideoState;
  };
  createdAt: string;
}

export interface BuildDirectorAgentStateSnapshotInput {
  runtimeState: ProjectRuntimeState;
  currentView?: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  videoStatus?: string;
  videoCanResume?: boolean;
  videoWaitingCount?: number;
  videoCompletedCount?: number;
  videoReviewCount?: number;
  videoDetail?: string;
}

export interface BuildDirectorAgentActionEnvelopeInput {
  userIntent: string;
  snapshot: DirectorAgentStateSnapshot;
  executionContract?: Partial<DirectorAgentExecutionContract>;
  generatedAt?: string;
}

const defaultExecutionContract: DirectorAgentExecutionContract = {
  mode: "plan_only",
  referenceGenerationAllowed: false,
  videoSubmitAllowed: false,
  providerSubmitAllowed: false,
  reason: "默认先只整理计划",
};

const strategyLabels: Record<DirectorProductionStrategyId, string> = {
  storyboard_narrative: "故事板叙事",
  storyboard_rapid_cut: "故事板快切",
  omni_reference: "全能参考",
};

const unknownStrategyLabel = "待判断";

export function buildDirectorAgentStateSnapshot(input: BuildDirectorAgentStateSnapshotInput): DirectorAgentStateSnapshot {
  const shots = input.runtimeState.storyFlow.shots;
  const assets = input.runtimeState.visualMemory.assets;
  const sectionCount = input.runtimeState.storyFlow.sections?.length ?? 0;
  const skillCount = new Set(shots.map((shot) => shot.referenceStrategy).filter(Boolean)).size;
  const selectedShotIds = uniqueStrings([
    ...(input.selectedShotIds || []),
    input.selectedShotId || "",
  ]).filter((shotId) => shots.some((shot) => shot.id === shotId));
  const selectedShot = selectedShotIds.length === 1
    ? shots.find((shot) => shot.id === selectedShotIds[0])
    : undefined;
  const selectedAsset = input.selectedAssetId
    ? assets.find((asset) => asset.id === input.selectedAssetId)
    : undefined;
  const selectedSection = input.sectionId
    ? input.runtimeState.storyFlow.sections.find((section) => section.id === input.sectionId)
    : undefined;
  const videoState = normalizeDirectorAgentVideoState(input);
  const counts = referenceCounts(shots, assets);
  const assetInbox = summarizeAgentAssetInbox(buildProjectInboxProjection({ assets }));

  return {
    projectTitle: input.runtimeState.project.title || "未命名项目",
    projectRoot: input.runtimeState.project.root,
    currentView: input.currentView,
    sectionCount,
    totalShots: shots.length,
    totalAssets: assets.length,
    skillCount,
    shots: shots.map(summarizeShotIndexItem),
    selectedShotIds,
    selectedAssetId: selectedAsset?.id,
    sectionId: selectedSection?.id,
    selectedShot: selectedShot ? summarizeShot(selectedShot) : undefined,
    selectedAsset: selectedAsset ? {
      id: selectedAsset.id,
      name: selectedAsset.name,
      type: selectedAsset.type,
      lockedStatus: selectedAsset.lockedStatus,
    } : undefined,
    selectedSection: selectedSection ? {
      id: selectedSection.id,
      label: selectedSection.label,
      shotCount: selectedSection.shotCount,
      readyCount: selectedSection.readyCount,
      blockedCount: selectedSection.blockedCount,
      shotIds: selectedSection.shotIds,
    } : undefined,
    assetCounts: {
      locked: counts.lockedReferences,
      needsReview: counts.needsReviewReferences,
      candidate: assets.filter((asset) => asset.lockedStatus === "candidate").length,
      missing: counts.missingReferences,
    },
    assetInbox,
    videoState,
    projectReadiness: buildAgentProjectReadiness(shots, assets, counts),
  };
}

function summarizeAgentAssetInbox(inbox: ProjectInboxProjection): DirectorAgentAssetInboxSnapshot {
  return {
    summary: inbox.summary,
    nextAction: inbox.nextAction,
    totalCount: inbox.totalCount,
    needsReviewCount: inbox.needsReviewCount,
    kindSummary: summarizeInboxKinds(inbox),
    items: inbox.items.slice(0, 4).map((item) => ({
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      suggestedBinding: item.suggestedBinding,
      suggestedAction: item.suggestedAction,
      reason: item.reason,
      confidence: item.confidence,
      needsReview: item.needsReview,
      originLabel: item.originLabel,
      assetId: item.assetId,
      shotIds: item.shotIds,
    })),
  };
}

function summarizeInboxKinds(inbox: ProjectInboxProjection): DirectorAgentAssetKindSummary[] {
  const counts = new Map<ProjectInboxKind, number>();
  for (const item of inbox.items) counts.set(item.kind, (counts.get(item.kind) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([kind, count]) => ({
      kind,
      label: agentInboxKindLabel(kind),
      count,
    }));
}

function agentInboxKindLabel(kind: ProjectInboxKind) {
  if (kind === "script") return "脚本";
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "storyboard") return "故事板";
  if (kind === "voice") return "声音";
  if (kind === "video") return "视频";
  if (kind === "prompt") return "提示词";
  if (kind === "receipt") return "生成证据";
  if (kind === "export") return "交付";
  if (kind === "reference") return "参考";
  return "待判断";
}

export function buildDirectorAgentActionEnvelope(input: BuildDirectorAgentActionEnvelopeInput): DirectorAgentActionEnvelope {
  const createdAt = input.generatedAt || new Date().toISOString();
  const userIntent = input.userIntent.trim();
  const kind = classifyDirectorAgentAction(userIntent, input.snapshot);
  const executionContract = normalizeExecutionContractForAction({
    kind,
    base: normalizeExecutionContractForIntent(input.executionContract, userIntent),
    explicitInput: input.executionContract,
    userIntent,
  });
  const target = targetFor(input.snapshot, userIntent);
  const strategy = strategyFromIntent(userIntent);
  const blockers = actionBlockers({ kind, target, strategy, executionContract, userIntent, snapshot: input.snapshot });
  const status: DirectorAgentActionStatus = blockers.length ? "blocked" : "staged";
  const proposedChanges = proposedChangesFor({ kind, strategy, target, snapshot: input.snapshot, userIntent });
  const toolPlan = toolPlanFor(kind, executionContract);
  const sourceContextShotIds = target.kind === "shot" || target.kind === "multi_shot"
    ? target.ids
    : input.snapshot.selectedShotIds;
  const sourceContextShotContexts = sourceContextShotIds
    .map((shotId) => input.snapshot.shots.find((shot) => shot.id === shotId))
    .filter((shot): shot is DirectorAgentShotSummary => Boolean(shot));

  return {
    schemaVersion: DIRECTOR_AGENT_ACTION_SCHEMA_VERSION,
    actionId: `agent_action_${compactId(createdAt)}_${kind}`,
    kind,
    status,
    summary: summaryFor({ kind, target, strategy, status, snapshot: input.snapshot, userIntent }),
    userFacingMessage: userFacingMessageFor({ kind, status, blockers, strategy, target, snapshot: input.snapshot, userIntent }),
    target,
    proposedChanges,
    blockers,
    requiresUserConfirmation: true,
    projectWriteMode: "staged_only",
    executionContract,
    toolPlan,
    sourceContext: {
      userIntent,
      projectTitle: input.snapshot.projectTitle,
      projectRoot: input.snapshot.projectRoot,
      currentView: input.snapshot.currentView,
      selectedShotIds: sourceContextShotIds,
      selectedShotContexts: sourceContextShotContexts,
      selectedAssetId: input.snapshot.selectedAssetId,
      sectionId: input.snapshot.sectionId,
      totalShots: input.snapshot.totalShots,
      projectReadiness: input.snapshot.projectReadiness,
      videoState: input.snapshot.videoState,
    },
    createdAt,
  };
}

export function classifyDirectorAgentAction(userIntent: string, snapshot?: DirectorAgentStateSnapshot): DirectorAgentActionKind {
  const normalizedRaw = normalizeText(userIntent);
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  const permissionIntent = detectDirectorAgentPermissionIntent(userIntent);
  const videoSubmitDisallowed = directorAgentPermissionIntentDisallowsVideoSubmit(userIntent);
  if (!normalized && permissionIntent !== "video_allowed") return "revise_story_or_shot";
  if (isDirectorAgentExplainOnlyIntent(userIntent)) return "inspect_project_status";
  const queuedContinueKind = queuedActionKindFromContinueIntent(normalized, snapshot);
  if (queuedContinueKind && containsAny(normalized, ["按项目状态继续", "项目状态继续"])) return queuedContinueKind;
  if (isVideoQueryIntent(normalized, snapshot)) return "query_video_result";
  if (!videoSubmitDisallowed && explicitlyRequestsMoreVideoSubmit(normalized)) return "prepare_video_submit";
  if (isAssetClassificationIntent(userIntent)) return "inspect_project_status";
  if (isProjectInspectionIntent(normalized)) return "inspect_project_status";
  if (containsAny(normalized, ["导出", "素材包", "finalmp4", "finalvideo", "export"])) return "prepare_export";
  if (shouldClassifyAssetReviewIntent(userIntent, snapshot)) return "review_reference_asset";
  const referenceGenerationRequested =
    isReferenceGenerationIntent(normalized, { includeImageShortcuts: true })
    || (
      !disallowsReferenceGenerationIntent(normalizedRaw)
      && isReferenceGenerationIntent(normalizedRaw, { includeImageShortcuts: false })
    );
  if (strategyFromIntent(userIntent) && !referenceGenerationRequested) return "update_shot_strategy";
  if (isExplicitProjectWriteIntent(normalized, normalizedRaw) && !referenceGenerationRequested) return "revise_story_or_shot";
  if (referenceGenerationRequested) return "prepare_reference_generation";
  if (!videoSubmitDisallowed && (
    containsAny(normalized, ["提交视频", "生成视频", "生视频", "出视频", "即梦", "seedance", "jimeng"]) ||
    (permissionIntent === "video_allowed" && containsAny(normalizedRaw, ["提交视频", "生成视频", "生视频", "出视频", "即梦", "seedance", "jimeng"]))
  )) return "prepare_video_submit";
  if (containsAny(normalized, ["查资料", "搜索", "联网", "websearch", "风格研究", "参考资料", "知识库"])) return "request_style_research";
  if (queuedContinueKind) return queuedContinueKind;
  return "revise_story_or_shot";
}

export function normalizeDirectorAgentExecutionContract(input?: Partial<DirectorAgentExecutionContract>): DirectorAgentExecutionContract {
  return normalizeExecutionContract(input);
}

export function directorAgentExecutionContractFromCreatorBoundary(input: {
  mode: DirectorAgentExecutionMode;
  referenceGenerationAllowed: boolean;
  videoSubmitAllowed: boolean;
  reason: string;
}): DirectorAgentExecutionContract {
  return normalizeExecutionContract({
    ...input,
    providerSubmitAllowed: input.referenceGenerationAllowed || input.videoSubmitAllowed,
  });
}

export function directorAgentActionEvidenceRefs(action: DirectorAgentActionEnvelope): string[] {
  return uniqueStrings([
    `agentAction#${action.actionId}`,
    `agentAction#${action.actionId}/kind/${action.kind}`,
    `agentAction#${action.actionId}/tool/${action.toolPlan.toolName}`,
    `agentAction#${action.actionId}/permission/${action.executionContract.mode}`,
    ...action.target.ids.map((targetId) => `agentAction#${action.actionId}/target/${targetId}`),
  ]);
}

export function directorAgentActionReceiptSummary(action: DirectorAgentActionEnvelope): string {
  return `${action.summary}；工具：${action.toolPlan.toolName}；权限：${action.executionContract.mode}`;
}

export function directorAgentReadinessActions(readiness: DirectorAgentProjectReadiness): DirectorAgentSuggestedAction[] {
  return readiness.actionQueue.length
    ? readiness.actionQueue
    : [{
        kind: readiness.nextActionKind,
        label: readiness.nextActionLabel,
        reason: readiness.summary || "按当前项目状态继续。",
        priority: "now",
      }];
}

function summarizeShot(shot: ShotRecord): DirectorAgentStateSnapshot["selectedShot"] {
  const strategy = referenceStrategyForShot(shot);
  return {
    id: shot.id,
    title: shot.title,
    displayNumber: formatShotNumberForAgent(shot.id),
    durationSeconds: shot.durationSeconds,
    referenceStrategy: strategy,
    status: shot.status,
    context: shotContextForAgent(shot),
  };
}

function summarizeShotIndexItem(shot: ShotRecord): DirectorAgentStateSnapshot["shots"][number] {
  return {
    id: shot.id,
    title: shot.title,
    displayNumber: formatShotNumberForAgent(shot.id),
    durationSeconds: shot.durationSeconds,
    referenceStrategy: referenceStrategyForShot(shot),
    status: shot.status,
    context: shotContextForAgent(shot),
  };
}

function referenceStrategyForShot(shot: ShotRecord): DirectorProductionStrategyId | undefined {
  const value = (shot as ShotRecord & { referenceStrategy?: string }).referenceStrategy;
  if (value === "storyboard_narrative" || value === "storyboard_rapid_cut" || value === "omni_reference") return value;
  return undefined;
}

function shotContextForAgent(shot: ShotRecord): DirectorAgentShotContext {
  return {
    storyFunction: cleanOptional(shot.storyFunction),
    primaryAction: cleanOptional(shot.primaryAction),
    actionTrigger: cleanOptional(shot.actionTrigger),
    microReaction: cleanOptional(shot.microReaction),
    camera: cleanOptional(shot.camera),
    actionBeats: compactStrings(shot.actionBeats),
    characterGuidance: compactStrings(shot.characterGuidance),
    sceneGuidance: compactStrings(shot.sceneGuidance),
    propGuidance: compactStrings(shot.propGuidance),
  };
}

function normalizeExecutionContract(input?: Partial<DirectorAgentExecutionContract>): DirectorAgentExecutionContract {
  const base = { ...defaultExecutionContract, ...(input || {}) };
  const mode = base.mode || (base.videoSubmitAllowed ? "video_allowed" : base.referenceGenerationAllowed ? "reference_allowed" : "plan_only");
  const videoSubmitAllowed = mode === "video_allowed" && Boolean(base.videoSubmitAllowed);
  const referenceGenerationAllowed = mode !== "plan_only" && Boolean(base.referenceGenerationAllowed);
  return {
    mode,
    referenceGenerationAllowed,
    videoSubmitAllowed,
    providerSubmitAllowed: Boolean(referenceGenerationAllowed || videoSubmitAllowed) && Boolean(base.providerSubmitAllowed),
    reason: base.reason || defaultExecutionContract.reason,
  };
}

function normalizeExecutionContractForIntent(
  input: Partial<DirectorAgentExecutionContract> | undefined,
  userIntent: string,
): DirectorAgentExecutionContract {
  const base = normalizeExecutionContract(input);
  const permissionIntent = detectDirectorAgentPermissionIntent(userIntent);
  if (permissionIntent === "plan_only") {
    return normalizeExecutionContract({
      ...base,
      mode: "plan_only",
      referenceGenerationAllowed: false,
      videoSubmitAllowed: false,
      providerSubmitAllowed: false,
      reason: "创作者要求先只做规划",
    });
  }
  if (permissionIntent === "reference_allowed" && (!input?.mode || base.mode === "video_allowed" || base.referenceGenerationAllowed)) {
    return normalizeExecutionContract({
      ...base,
      mode: "reference_allowed",
      referenceGenerationAllowed: true,
      videoSubmitAllowed: false,
      providerSubmitAllowed: input?.mode ? base.providerSubmitAllowed : true,
      reason: "创作者要求先不提交视频",
    });
  }
  return base;
}

function normalizeExecutionContractForAction(input: {
  kind: DirectorAgentActionKind;
  base: DirectorAgentExecutionContract;
  explicitInput?: Partial<DirectorAgentExecutionContract>;
  userIntent: string;
}): DirectorAgentExecutionContract {
  const permissionIntent = detectDirectorAgentPermissionIntent(input.userIntent);
  if (permissionIntent === "plan_only" || input.explicitInput?.mode) return input.base;
  if (input.kind === "prepare_reference_generation" && input.base.mode === "plan_only") {
    return normalizeExecutionContract({
      ...input.base,
      mode: "reference_allowed",
      referenceGenerationAllowed: true,
      videoSubmitAllowed: false,
      providerSubmitAllowed: true,
      reason: "Agent 建议先生成参考，确认后才会执行",
    });
  }
  if (
    input.kind === "prepare_video_submit"
    && input.base.mode === "plan_only"
    && !directorAgentPermissionIntentDisallowsVideoSubmit(input.userIntent)
  ) {
    return normalizeExecutionContract({
      ...input.base,
      mode: "video_allowed",
      referenceGenerationAllowed: true,
      videoSubmitAllowed: true,
      providerSubmitAllowed: true,
      reason: "Agent 建议提交视频，确认后才会执行",
    });
  }
  if (input.kind === "query_video_result" && input.base.mode === "plan_only") {
    return normalizeExecutionContract({
      ...input.base,
      mode: "plan_only",
      referenceGenerationAllowed: false,
      videoSubmitAllowed: false,
      providerSubmitAllowed: false,
      reason: "Agent 建议查询已提交视频的回流状态，不会重复提交新任务",
    });
  }
  return input.base;
}

function strategyFromIntent(userIntent: string): DirectorProductionStrategyId | undefined {
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  if (containsAny(normalized, ["故事板快切", "快切", "rapidcut", "动作预演", "预演故事板"])) return "storyboard_rapid_cut";
  if (containsAny(normalized, ["全能参考", "简单参考", "omni", "场景图人物提示词", "只用参考图"])) return "omni_reference";
  if (containsAny(normalized, ["故事板叙事", "叙事故事板", "故事板", "分镜图"])) return "storyboard_narrative";
  return undefined;
}

function assetReviewDecisionFromIntent(userIntent: string): "locked" | "rejected" | undefined {
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  if (containsAny(normalized, ["不通过", "不要这张", "不用这张", "退回", "拒绝", "重做", "重新生成", "换一张", "不满意"])) return "rejected";
  if (containsAny(normalized, ["通过", "锁定", "确认这个", "采用这个", "用这个", "就这张", "可以用", "满意", "approved", "approve", "lock"])) return "locked";
  return undefined;
}

function assetRoleBindingLabelFromIntent(userIntent: string): string | undefined {
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  if (!normalized) return undefined;
  if (containsAny(normalized, ["故事板参考", "分镜参考", "分镜图参考", "storyboard", "shotboard"])) return "故事板参考";
  if (containsAny(normalized, ["声音参考", "声线参考", "音源参考", "配音参考", "对白音频", "voice reference", "voice"])) return "声音参考";
  if (containsAny(normalized, ["配乐参考", "音乐参考", "bgm参考", "bgm", "music"])) return "后期配乐";
  if (containsAny(normalized, ["风格参考", "画风参考", "美术参考", "look reference", "style"])) return "风格参考";
  if (containsAny(normalized, ["提示词参考", "prompt参考", "prompt"])) return "提示词参考";
  if (containsAny(normalized, ["生成证据", "回执", "receipt", "submit id", "submitid"])) return "生成证据";
  if (containsAny(normalized, ["交付文件", "导出文件", "展示包", "export"])) return "交付文件";
  if (containsAny(normalized, ["回流视频", "成片段落", "视频段", "生成视频", "video clip"])) return "回流视频";
  if (containsAny(normalized, ["场景参考", "天气参考", "环境参考", "地点参考", "空间参考", "scene reference", "environment"])) return "场景参考";
  if (containsAny(normalized, ["道具参考", "物体参考", "物件参考", "车辆参考", "整车参考", "prop reference", "object reference", "vehicle reference"])) return "道具参考";
  if (containsAny(normalized, ["角色参考", "人物参考", "女主参考", "男主参考", "主角参考", "角色身份", "人物身份", "character reference", "identity reference"])) return "角色参考";
  return undefined;
}

function shouldClassifyAssetReviewIntent(userIntent: string, snapshot?: DirectorAgentStateSnapshot): boolean {
  if (!assetReviewDecisionFromIntent(userIntent)) return false;

  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  const explicitlyMentionsReferenceAsset = containsAny(normalized, ["参考", "素材", "候选", "这张", "这幅", "图片", "图像", "照片", "资产"]);
  if (snapshot?.selectedAssetId) return true;
  if (containsAny(normalized, ["镜头", "分镜", "段落", "故事", "剧情", "节奏", "动作"]) && !explicitlyMentionsReferenceAsset) {
    return false;
  }
  if (snapshot?.currentView === "reference") return true;
  return explicitlyMentionsReferenceAsset;
}

function isAssetClassificationIntent(value: string) {
  return /(?:素材|文件|参考素材|项目材料|拖入文件).{0,16}(?:整理|分类|归类|绑定|匹配|建议|识别)|(?:整理|分类|归类|绑定|匹配|识别).{0,16}(?:素材|文件|参考素材|项目材料|拖入文件)|绑定建议/u.test(value);
}

function normalizeDirectorAgentVideoState(input: BuildDirectorAgentStateSnapshotInput): DirectorAgentVideoState {
  const status = normalizeDirectorAgentVideoStatus(input.videoStatus);
  const canResume = Boolean(input.videoCanResume) || status === "recoverable";
  return {
    status: canResume && status === "submitted" ? "recoverable" : status,
    canResume,
    waitingCount: Math.max(0, input.videoWaitingCount || 0),
    completedCount: Math.max(0, input.videoCompletedCount || 0),
    reviewCount: Math.max(0, input.videoReviewCount || 0),
    detail: cleanOptional(input.videoDetail),
  };
}

function normalizeDirectorAgentVideoStatus(value?: string): DirectorAgentVideoStatus {
  const normalized = normalizeText(value || "");
  if (!normalized || containsAny(normalized, ["未发送", "notgenerated", "notsubmitted", "idle"])) return "idle";
  if (containsAny(normalized, ["可发送", "ready"])) return "ready";
  if (containsAny(normalized, ["可查询", "recoverable", "resume", "resumable"])) return "recoverable";
  if (containsAny(normalized, ["提交中", "排队", "已发送", "submitted", "submitting", "queued", "polling"])) return "submitted";
  if (containsAny(normalized, ["生成中", "running", "generating", "inprogress", "processing"])) return "running";
  if (containsAny(normalized, ["待复核", "needsreview", "review"])) return "needs_review";
  if (containsAny(normalized, ["完成", "success", "completed", "done"])) return "completed";
  if (containsAny(normalized, ["失败", "failed", "error"])) return "failed";
  return "idle";
}

function videoStateCanQuery(videoState: DirectorAgentVideoState) {
  return videoState.canResume
    || videoState.status === "recoverable"
    || videoState.status === "running"
    || videoState.status === "submitted";
}

function explicitlyRequestsMoreVideoSubmit(normalized: string) {
  return containsAny(normalized, [
    "继续提交",
    "继续发送",
    "再提交",
    "再发送",
    "发下一段",
    "提交下一段",
    "下一段视频",
    "第二条视频",
    "验证串行",
    "串行队列",
    "完整跑",
    "跑完整",
  ]);
}

function isVideoQueryIntent(normalized: string, snapshot?: DirectorAgentStateSnapshot) {
  void snapshot;
  return containsAny(normalized, ["查询视频", "查视频", "查结果", "查询结果", "回流", "回来了吗", "视频状态", "即梦状态", "seedance状态", "取回结果"]);
}

function assetLockedStatusLabel(status: NonNullable<DirectorAgentStateSnapshot["selectedAsset"]>["lockedStatus"]) {
  if (status === "locked") return "已锁定";
  if (status === "candidate") return "候选";
  if (status === "needs_review") return "待复核";
  return "待处理";
}

function targetFor(snapshot: DirectorAgentStateSnapshot, userIntent = ""): DirectorAgentActionTarget {
  if (intentTargetsWholeProject(userIntent)) {
    return {
      kind: "project",
      ids: [],
      label: snapshot.projectTitle,
    };
  }
  const mentionedShotIds = shotIdsMentionedInIntent(userIntent, snapshot);
  const selectedShotIds = mentionedShotIds.length
    ? mentionedShotIds
    : snapshot.selectedShotIds;

  if (selectedShotIds.length > 1) {
    return {
      kind: "multi_shot",
      ids: selectedShotIds,
      label: `${selectedShotIds.length} 个镜头`,
    };
  }
  if (selectedShotIds.length === 1) {
    const shotId = selectedShotIds[0] || "";
    const shot = snapshot.shots.find((item) => item.id === shotId);
    return {
      kind: "shot",
      ids: selectedShotIds,
      label: shot?.title || snapshot.selectedShot?.title || shotId || "当前镜头",
    };
  }
  if (snapshot.selectedAssetId) {
    return {
      kind: "asset",
      ids: [snapshot.selectedAssetId],
      label: snapshot.selectedAsset?.name || "当前素材",
    };
  }
  if (snapshot.sectionId) {
    return {
      kind: "section",
      ids: [snapshot.sectionId],
      label: snapshot.selectedSection?.label || "当前段落",
    };
  }
  return {
    kind: "project",
    ids: [],
    label: snapshot.projectTitle,
  };
}

type DirectorAgentTargetLabelContext = {
  projectTitle: string;
  selectedShot?: DirectorAgentShotSummary;
  shots?: DirectorAgentShotSummary[];
  selectedShotContexts?: DirectorAgentShotSummary[];
};

export function directorAgentDisplayTargetLabel(target: DirectorAgentActionTarget, snapshot: DirectorAgentTargetLabelContext) {
  const rawLabel = cleanDisplayText(target.label);
  const labelHasReplacementCharacter = rawLabel.includes("\uFFFD");
  if (target.kind === "shot" && target.ids.length === 1) {
    const shotId = target.ids[0] || "";
    const shotPool = snapshot.shots || snapshot.selectedShotContexts || [];
    const shot = shotPool.find((item) => item.id === shotId);
    const displayNumber = shot?.displayNumber || snapshot.selectedShot?.displayNumber || formatShotNumberForAgent(shotId);
    const title = cleanDisplayText(shot?.title || snapshot.selectedShot?.title || (labelHasReplacementCharacter ? "" : rawLabel));
    return ["镜头", displayNumber, title].filter(Boolean).join(" ");
  }
  if (labelHasReplacementCharacter) {
    if (target.kind === "asset") return "当前素材";
    if (target.kind === "section") return "当前段落";
    if (target.kind === "multi_shot") return `${target.ids.length || 2} 个镜头`;
    return snapshot.projectTitle || "当前项目";
  }
  return rawLabel || snapshot.projectTitle || "当前项目";
}

function cleanDisplayText(value?: string) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function intentTargetsWholeProject(userIntent: string) {
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  return intentStartsNewStory(userIntent) || containsAny(normalized, [
    "整个项目",
    "全项目",
    "当前项目",
    "这个项目",
    "项目参考",
    "全部参考",
    "所有参考",
    "整片参考",
    "全片参考",
    "全局参考",
    "补齐项目",
    "补齐全部",
    "补齐所有",
    "新建项目",
    "新项目",
    "新建一个",
    "重新做一个",
    "重做一个",
    "换个主题",
    "新短片",
    "新片子",
    "完整项目",
    "整个短片",
    "整支片",
  ]);
}

function intentStartsNewStory(userIntent: string) {
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  return containsAny(normalized, [
    "新建项目",
    "新项目",
    "新建一个",
    "重新做一个",
    "重做一个",
    "换个主题",
    "新短片",
    "新片子",
    "新视频",
    "另起一个",
  ]);
}

function actionBlockers(input: {
  kind: DirectorAgentActionKind;
  target: DirectorAgentActionTarget;
  strategy?: DirectorProductionStrategyId;
  executionContract: DirectorAgentExecutionContract;
  userIntent: string;
  snapshot: DirectorAgentStateSnapshot;
}) {
  const readiness = input.snapshot.projectReadiness;
  const assetReviewDecision = assetReviewDecisionFromIntent(input.userIntent);
  const selectedAssetStatus = input.snapshot.selectedAsset?.lockedStatus;
  const blockers = [
    input.userIntent.trim() ? "" : "先说一句要改什么。",
    missingScopedTargetBlocker(input.kind, input.target, input.userIntent),
    input.kind === "update_shot_strategy" && !input.strategy ? "没有识别到要切换的参考模式。" : "",
    input.kind === "update_shot_strategy" && input.target.kind !== "shot" && input.target.kind !== "multi_shot" ? "请先选中一个镜头，再改它的参考模式。" : "",
    input.kind === "review_reference_asset" && input.target.kind !== "asset" ? "请先选中一个参考素材，再复核。" : "",
    input.kind === "review_reference_asset" && !assetReviewDecision ? "没有识别到要通过还是退回这个参考。" : "",
    input.kind === "review_reference_asset" && assetReviewDecision === "locked" && selectedAssetStatus === "locked" ? "这个参考已经锁定了，不需要再确认。" : "",
    input.kind === "prepare_reference_generation" && !input.executionContract.referenceGenerationAllowed ? "当前是只整理模式，还不能生成参考。" : "",
    input.kind === "prepare_video_submit" && readiness.status === "needs_story" ? "先整理故事流，再提交视频。" : "",
    input.kind === "prepare_video_submit" && readiness.status === "needs_references" ? "先生成并复核参考，再提交视频。" : "",
	    input.kind === "prepare_video_submit" && readiness.status === "needs_review" ? "先复核参考，再提交视频。" : "",
	    input.kind === "prepare_video_submit" && !input.executionContract.videoSubmitAllowed ? "当前还不能提交视频，需要你先允许。" : "",
	    input.kind === "query_video_result" && !videoStateCanQuery(input.snapshot.videoState) ? "当前没有可查询的视频任务。" : "",
	  ];
	  return uniqueStrings(blockers.filter(Boolean));
	}

function missingScopedTargetBlocker(
  kind: DirectorAgentActionKind,
  target: DirectorAgentActionTarget,
  userIntent: string,
) {
  if (kind !== "revise_story_or_shot" || target.kind !== "project") return "";
  const normalized = normalizeText(stripControlOnlyPhrases(userIntent));
  if (containsAny(normalized, ["这个镜头", "当前镜头", "这个分镜", "当前分镜", "这条镜头"])) {
    return "请先选中一个镜头，再告诉我怎么改。";
  }
  if (containsAny(normalized, ["这一段", "这个段落", "当前段落", "这一组", "这一场", "这场戏"])) {
    return "请先选中一个段落或镜头，再告诉我怎么改。";
  }
  if (containsAny(normalized, ["这张参考", "这张图", "这张图片", "这个参考", "这个素材", "这张素材"])) {
    return "请先选中一个参考素材，再告诉我怎么改。";
  }
  return "";
}

function proposedChangesFor(input: {
  kind: DirectorAgentActionKind;
  strategy?: DirectorProductionStrategyId;
  target: DirectorAgentActionTarget;
  snapshot: DirectorAgentStateSnapshot;
  userIntent: string;
}): DirectorAgentProposedChange[] {
  if (input.kind === "inspect_project_status") {
    return [
      {
        field: "projectStatus",
        to: input.snapshot.projectReadiness.summary,
        reason: `下一步建议：${input.snapshot.projectReadiness.nextActionLabel}。`,
      },
      {
        field: "referenceStatus",
        to: input.snapshot.projectReadiness.referenceSummary,
        reason: input.snapshot.projectReadiness.modeSummary,
      },
      {
        field: "nextActions",
        to: input.snapshot.projectReadiness.actionQueue.slice(0, 3).map(actionQueueLabel).join(" / "),
        reason: "Agent 会按项目状态、权限边界和用户意图选择其中一个进入待确认动作。",
      },
    ];
  }
  if (input.kind === "update_shot_strategy" && input.strategy) {
    const targetShot = input.target.ids.length === 1
      ? input.snapshot.shots.find((shot) => shot.id === input.target.ids[0])
      : undefined;
    return [{
      field: "referenceStrategy",
      from: targetShot?.referenceStrategy
        ? strategyLabels[targetShot.referenceStrategy]
        : input.target.kind === "multi_shot"
          ? "多个镜头"
          : input.snapshot.selectedShot?.referenceStrategy
          ? strategyLabels[input.snapshot.selectedShot.referenceStrategy]
          : "未设置",
      to: strategyLabels[input.strategy],
      reason: "按这次反馈调整该镜头后续的参考图和视频编译方式。",
    }];
  }
  if (input.kind === "request_style_research") {
    return [{
      field: "knowledgeReferences",
      to: "整理外部资料为可确认参考",
      reason: "先补知识和风格依据，再进入分镜或提示词修改。",
    }];
  }
  if (input.kind === "prepare_reference_generation") {
    return [{
      field: "referenceAssets",
      to: "补齐角色、场景、道具或故事板参考",
      reason: "只生成可复核参考，结果不会自动锁定。",
    }];
  }
  if (input.kind === "review_reference_asset") {
    const decision = assetReviewDecisionFromIntent(input.userIntent);
    if (decision === "locked" && input.snapshot.selectedAsset?.lockedStatus === "locked") return [];
    const roleBindingLabel = assetRoleBindingLabelFromIntent(input.userIntent);
    return [
      {
      field: "assetStatus",
      from: input.snapshot.selectedAsset?.lockedStatus ? assetLockedStatusLabel(input.snapshot.selectedAsset.lockedStatus) : undefined,
      to: decision === "locked" ? "已锁定" : "退回复做",
      reason: decision === "locked"
        ? "确认后这个参考会作为后续可用资产。"
        : "确认后这个参考不会作为后续可用资产，会等待重做或替换。",
      },
      ...(roleBindingLabel ? [{
        field: "assetRoleBinding",
        to: roleBindingLabel,
        reason: "确认后写入这个素材在项目里的用途，后续编译会按这个角色使用它。",
      }] : []),
    ];
  }
	  if (input.kind === "prepare_video_submit") {
	    return [{
	      field: "videoQueue",
	      to: "准备提交当前镜头或段落的视频任务",
	      reason: "提交前需要已确认的故事板/全能参考和用户确认。",
	    }];
	  }
	  if (input.kind === "query_video_result") {
	    return [{
	      field: "videoQueue",
	      to: "查询已提交视频的回流状态",
	      reason: "只取回现有 submit id 的结果，不会重复提交新视频任务。",
	    }];
	  }
  const normalizedIntent = normalizeText(stripControlOnlyPhrases(input.userIntent));
  const hasConcreteCreatorIntent = Boolean(normalizedIntent)
    && !isContinueIntent(normalizedIntent)
    && !isProjectInspectionIntent(normalizedIntent);
  const shotFieldChanges = shotFieldChangesFromIntent(input.userIntent);
  if (input.kind === "revise_story_or_shot" && hasConcreteCreatorIntent) {
    const roleBindingLabel = input.target.kind === "asset" ? assetRoleBindingLabelFromIntent(input.userIntent) : undefined;
    if (roleBindingLabel) {
      const scopedIntent = compactCreatorIntent(stripControlOnlyPhrases(input.userIntent));
      return [
        {
          field: "assetRoleBinding",
          to: roleBindingLabel,
          reason: "确认后写入这个素材在项目里的用途，后续编译会按这个角色使用它。",
        },
        {
          field: "selectedScopeDraft",
          to: scopedIntent || "整理为待确认修改",
          reason: `自然语言先进入 staged action，确认后写入 ${directorAgentDisplayTargetLabel(input.target, input.snapshot)}。`,
        },
      ];
    }
    if (
      shotFieldChanges.length &&
      (input.target.kind === "shot" || input.target.kind === "multi_shot" || input.target.kind === "section")
    ) {
      return shotFieldChanges;
    }
    const scopedIntent = compactCreatorIntent(stripControlOnlyPhrases(input.userIntent));
    return [{
      field: input.target.kind === "project" ? "projectDraft" : "selectedScopeDraft",
      to: scopedIntent || "整理为待确认修改",
      reason: input.target.kind === "project"
        ? "自然语言先进入 staged action，确认后才写入项目整体方向。"
        : `自然语言先进入 staged action，确认后写入 ${directorAgentDisplayTargetLabel(input.target, input.snapshot)}。`,
    }];
  }
  if (input.kind === "revise_story_or_shot" && input.snapshot.projectReadiness.status === "needs_review") {
    return [{
      field: "reviewTray",
      to: "先复核待确认参考",
      reason: "参考通过后，Agent 才会继续准备视频提交。",
    }];
  }
  if (input.kind === "revise_story_or_shot" && input.snapshot.projectReadiness.status === "needs_story") {
    return [{
      field: "storyDraft",
      to: "先整理故事草案",
      reason: "空项目需要先形成可确认故事流。",
    }];
  }
  if (input.kind === "prepare_export") {
    return [{
      field: "exportPackage",
      to: "生成项目素材包",
      reason: "导出 Project.vibe、素材、收据和报告。",
    }];
  }
  const scopedIntent = compactCreatorIntent(stripControlOnlyPhrases(input.userIntent));
  return [{
    field: input.target.kind === "project" ? "projectDraft" : "selectedScopeDraft",
    to: scopedIntent || "整理为待确认修改",
    reason: input.target.kind === "project"
      ? "自然语言先进入 staged action，确认后才写入项目整体方向。"
      : `自然语言先进入 staged action，确认后写入 ${directorAgentDisplayTargetLabel(input.target, input.snapshot)}。`,
  }];
}

const shotFieldLabels: Array<{
  field: string;
  labels: string[];
  reason: string;
}> = [
  { field: "title", labels: ["标题", "镜头标题", "分镜标题"], reason: "按用户反馈更新当前镜头标题。" },
  { field: "primaryAction", labels: ["主动作", "主要动作", "核心动作", "动作"], reason: "按用户反馈更新当前镜头的主动作。" },
  { field: "actionTrigger", labels: ["触发", "触发点", "动作触发", "起因"], reason: "按用户反馈更新当前镜头的动作触发。" },
  { field: "microReaction", labels: ["微反应", "反应", "表情", "情绪反应"], reason: "按用户反馈更新当前镜头的微反应。" },
  { field: "camera", labels: ["镜头语言", "运镜", "机位", "相机", "camera"], reason: "按用户反馈更新当前镜头的机位与运镜。" },
  { field: "durationSeconds", labels: ["时长", "持续时间"], reason: "按用户反馈更新当前镜头时长。" },
  { field: "characterGuidance", labels: ["角色约束", "角色", "人物"], reason: "按用户反馈更新当前镜头的角色约束。" },
  { field: "sceneGuidance", labels: ["场景约束", "场景", "地点", "环境"], reason: "按用户反馈更新当前镜头的场景约束。" },
  { field: "propGuidance", labels: ["道具约束", "道具", "物件", "物体"], reason: "按用户反馈更新当前镜头的道具约束。" },
];

function shotFieldChangesFromIntent(userIntent: string): DirectorAgentProposedChange[] {
  const changes: DirectorAgentProposedChange[] = [];
  for (const config of shotFieldLabels) {
    const to = fieldValueFromIntent(userIntent, config.labels);
    if (!to) continue;
    changes.push({
      field: config.field,
      to,
      reason: config.reason,
    });
  }
  return changes;
}

function fieldValueFromIntent(userIntent: string, labels: string[]): string | undefined {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const verbPattern = "(?:改成|改为|改一下为|应该是|设为|设置为|换成|变成|写成|调整为|为|是)";
  const match = userIntent.match(new RegExp(`(?:${labelPattern})\\s*(?:[:：=])?\\s*${verbPattern}\\s*([^，,。！？；;\\n]+)`, "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function toolPlanFor(kind: DirectorAgentActionKind, contract: DirectorAgentExecutionContract): DirectorAgentToolPlan {
  if (kind === "request_style_research") {
    return {
      toolName: "web_search",
      taskEnvelopeRequired: true,
      userConfirmationRequired: true,
      providerSubmitAllowed: false,
      expectedReceipt: "web_research_reference_receipt",
    };
  }
  if (kind === "prepare_reference_generation") {
    return {
      toolName: "image2_reference_generation",
      taskEnvelopeRequired: true,
      userConfirmationRequired: true,
      providerSubmitAllowed: contract.referenceGenerationAllowed && contract.providerSubmitAllowed,
      expectedReceipt: "image_reference_receipt",
    };
  }
	  if (kind === "prepare_video_submit") {
	    return {
	      toolName: "seedance_video_submit",
      taskEnvelopeRequired: true,
      userConfirmationRequired: true,
      providerSubmitAllowed: contract.videoSubmitAllowed && contract.providerSubmitAllowed,
	      expectedReceipt: "video_submit_receipt",
	    };
	  }
	  if (kind === "query_video_result") {
	    return {
	      toolName: "seedance_video_submit",
	      taskEnvelopeRequired: true,
	      userConfirmationRequired: true,
	      providerSubmitAllowed: false,
	      expectedReceipt: "video_submit_receipt",
	    };
	  }
	  if (kind === "prepare_export") {
    return {
      toolName: "project_export",
      taskEnvelopeRequired: true,
      userConfirmationRequired: true,
      providerSubmitAllowed: false,
      expectedReceipt: "export_receipt",
    };
  }
  return {
    toolName: "project_vibe_patch",
    taskEnvelopeRequired: true,
    userConfirmationRequired: true,
    providerSubmitAllowed: false,
    expectedReceipt: "project_patch_receipt",
  };
}

function summaryFor(input: {
  kind: DirectorAgentActionKind;
  target: DirectorAgentActionTarget;
  strategy?: DirectorProductionStrategyId;
  status: DirectorAgentActionStatus;
  snapshot: DirectorAgentStateSnapshot;
  userIntent: string;
}) {
  const prefix = input.status === "blocked" ? "需要补充：" : "已整理：";
  const targetLabel = directorAgentDisplayTargetLabel(input.target, input.snapshot);
  if (input.kind === "update_shot_strategy" && input.strategy) return `${prefix}${targetLabel} 改为${strategyLabels[input.strategy]}`;
  if (input.kind === "request_style_research") return `${prefix}先查资料，再形成可确认参考`;
  if (input.kind === "prepare_reference_generation") return `${prefix}为 ${targetLabel} 生成参考`;
	  if (input.kind === "review_reference_asset") return `${prefix}复核 ${targetLabel}`;
	  if (input.kind === "prepare_video_submit") return `${prefix}准备提交 ${targetLabel} 的视频`;
	  if (input.kind === "query_video_result") return `${prefix}查询 ${targetLabel} 的视频结果`;
	  if (input.kind === "prepare_export") return `${prefix}准备导出项目素材包`;
  if (input.kind === "inspect_project_status") {
    return isAssetClassificationIntent(input.userIntent)
      ? `${prefix}整理项目素材绑定建议`
      : `${prefix}检查当前项目状态`;
  }
  if (input.kind === "revise_story_or_shot" && input.target.kind !== "project") return `${prefix}${targetLabel} 的修改草案`;
  if (input.kind === "revise_story_or_shot" && input.target.kind === "project") {
    return `${prefix}${intentStartsNewStory(input.userIntent) ? "新故事草案" : `${targetLabel} 的修改草案`}`;
  }
  if (input.snapshot.projectReadiness.status === "needs_review") return `${prefix}先复核参考`;
  if (input.snapshot.projectReadiness.status === "needs_story") return `${prefix}先整理故事草案`;
  return `${prefix}${targetLabel} 的修改草案`;
}

function userFacingMessageFor(input: {
  kind: DirectorAgentActionKind;
  status: DirectorAgentActionStatus;
  blockers: string[];
  strategy?: DirectorProductionStrategyId;
  target: DirectorAgentActionTarget;
  snapshot: DirectorAgentStateSnapshot;
  userIntent: string;
}) {
  if (input.status === "blocked") return input.blockers[0] || "需要补充一点信息。";
  if (input.kind === "update_shot_strategy" && input.strategy) return `我会先把这段改成${strategyLabels[input.strategy]}，确认后再写入项目。`;
  if (input.kind === "request_style_research") return "我会先查资料并整理成参考，采用前会让你确认。";
	  if (input.kind === "prepare_reference_generation") return "我会先准备参考生成计划，生成结果会进入复核。";
	  if (input.kind === "review_reference_asset") return "我会先把这张参考的复核决定整理好，确认后写入项目。";
	  if (input.kind === "prepare_video_submit") return "我会准备 1 条代表性视频提交计划，默认走 Seedance 2.0 VIP 720p；提交前需要你确认。";
	  if (input.kind === "query_video_result") return "我会查询已提交视频的回流状态，不会重复发送新任务。";
	  if (input.kind === "prepare_export") return "我会准备导出素材包，导出内容会可复核。";
  if (input.kind === "inspect_project_status") {
    if (isAssetClassificationIntent(input.userIntent)) {
      return "我会先整理当前素材的用途和绑定建议，不会生成参考，也不会提交视频。";
    }
    const queue = input.snapshot.projectReadiness.actionQueue.slice(0, 3).map((action) => action.label).join(" / ");
    return `当前：${input.snapshot.projectReadiness.summary}。建议下一步：${input.snapshot.projectReadiness.nextActionLabel}。后续可走：${queue || "继续整理"}。`;
  }
  const targetLabel = directorAgentDisplayTargetLabel(input.target, input.snapshot);
  if (input.target.kind !== "project") return `我会先把反馈整理到 ${targetLabel}，确认后写入项目。`;
  if (input.snapshot.projectReadiness.status === "needs_review") return "当前有参考需要先看一眼，确认后我再继续往下做。";
  if (input.snapshot.projectReadiness.status === "needs_story") return "我会先把想法整理成故事草案，确认后再进入参考和视频。";
  if (input.kind === "revise_story_or_shot") return "我会先整理成项目级草案，不会生成参考或提交视频。";
  return "我会先整理成待确认修改，不会直接写正式任务。";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]/g, "");
}

function containsAny(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(normalizeText(phrase)));
}

function isReferenceGenerationIntent(value: string, options: { includeImageShortcuts: boolean }) {
  const imageShortcut = options.includeImageShortcuts
    ? containsAny(value, ["生图", "生成图片", "生成画面", "补图"])
    : false;
  return (
    containsAny(value, ["补参考", "补齐参考", "生成参考", "做参考", "补齐素材", "补齐这个项目", "补齐当前项目", "项目参考素材"]) ||
    imageShortcut ||
    /(?:补|生成|做).{0,16}参考/.test(value) ||
    /(?:补|生成|做).{0,12}(?:角色图|场景图|道具图|故事板|分镜图)/.test(value)
  );
}

function disallowsReferenceGenerationIntent(normalizedRaw: string) {
  return containsAny(normalizedRaw, [
    "不要生成参考",
    "不生成参考",
    "先不要生成参考",
    "先不生成参考",
    "不用生成参考",
    "不要生成参考图",
    "不生成参考图",
    "不要补参考",
    "先不要补参考",
    "不生成图片",
    "不要生成图片",
    "不生成画面",
    "不生图",
    "不要生图",
    "不调用生图模型",
  ]);
}

function isExplicitProjectWriteIntent(normalized: string, normalizedRaw: string) {
  const writeOnlyIntent = containsAny(normalizedRaw, [
    "只写项目",
    "只写project",
    "只改项目",
    "只改文字",
    "只整理",
    "不要生成参考",
    "不生成参考",
    "先不生成参考",
    "不生成图片",
    "不生图",
    "不要生图",
    "不调用生图模型",
  ]);
  const editIntent = containsAny(normalized, [
    "改成",
    "改为",
    "修改",
    "调整",
    "重命名",
    "改标题",
    "标题改",
    "名字改",
    "把这个镜头",
    "把这段",
    "这个镜头",
    "这一段",
    "这段",
  ]);
  return writeOnlyIntent || editIntent;
}

function isProjectInspectionIntent(normalized: string) {
  return containsAny(normalized, [
    "项目状态",
    "检查项目",
    "检查一下项目",
    "当前能做什么",
    "现在能做什么",
    "当前可以做什么",
    "现在可以做什么",
    "整理素材",
    "整理一下素材",
    "整理当前素材",
    "整理一下当前素材",
    "盘点素材",
    "盘点一下素材",
    "检查素材",
    "检查一下素材",
    "当前素材",
    "哪些能直接用",
    "哪些可以直接用",
    "哪些需要确认",
    "哪些还要确认",
    "素材能不能用",
    "素材够不够",
    "参考够不够",
    "参考素材够不够",
    "下一步做什么",
    "下一步该做什么",
    "下一步能做什么",
    "接下来做什么",
    "接下来该做什么",
    "接下来能做什么",
    "现在应该做什么",
    "现在该干什么",
    "现在能干什么",
    "还有什么可以做",
    "还有哪些可以做",
    "whatnext",
    "nextstep",
    "nextsteps",
    "whattodo",
    "whatcanido",
    "whatcanwedo",
    "whatshouldido",
    "whatshouldwedo",
    "whatdoidonext",
    "whatdowedonext",
    "demoready",
    "readyfordemo",
    "candeliver",
    "canexport",
    "whatleft",
    "whatmissing",
    "whatsmissing",
    "remainingissues",
    "还有什么功能",
    "还有哪些功能",
    "现在还有什么问题",
    "还有什么问题",
    "还有什么小问题",
    "还有哪些问题",
    "有哪些问题",
    "哪里有问题",
    "有什么问题",
    "有没有问题",
    "存在哪些问题",
    "软件还有什么问题",
    "软件还有哪些问题",
    "还差什么",
    "还缺什么",
    "还缺哪些",
    "闭环还缺",
    "demo还缺",
    "demo差什么",
    "距离demo",
    "demo闭环",
    "demo是不是",
    "demo是否",
    "打磨得差不多",
    "还有什么小修小改",
    "小修小改",
    "存在哪些需要优化",
    "哪些可以优化",
    "哪些可以修改",
    "哪些可以改进",
    "能不能提交",
    "能否提交",
    "能不能导出",
    "能否导出",
    "是否可以导出",
    "能不能交付",
    "能否交付",
    "是否可以交付",
    "可以交付吗",
    "能不能继续",
    "当前状态",
    "现在怎么样",
    "项目怎么样",
    "现在项目怎么样",
    "项目现在怎么样",
    "当前项目怎么样",
  ]);
}

function compactCreatorIntent(value: string) {
  const normalized = cleanCreatorIntentRemainder(value);
  if (normalized.length <= 72) return normalized;
  return `${normalized.slice(0, 69)}...`;
}

function stripControlOnlyPhrases(value: string) {
  return stripDirectorAgentPermissionControlPhrases(value);
}

function cleanCreatorIntentRemainder(value: string) {
  let normalized = value.replace(/\s+/g, " ").trim();
  for (let index = 0; index < 3; index += 1) {
    normalized = normalized.replace(/[，,、；;：:]\s*(也|并且|而且)?\s*([。.!！?？；;，,、])/g, "$2");
  }
  return normalized
    .replace(/^[，,、；;：:。.!！?？\s]+/g, "")
    .replace(/[，,、；;：:\s]+$/g, "")
    .trim();
}

function formatShotNumberForAgent(id: string) {
  const value = id.trim();
  const match = value.match(/^A(\d+)_(\d+)$/i);
  if (match) return `${Number(match[1])}-${Number(match[2])}`;
  const storyboardShotMatch = value.match(/^shot[_\s-]*storyboard[_\s-]*(\d+)[_\s-]+(\d+)(?:[_\s-]+\d+)?$/i);
  if (storyboardShotMatch) return `${Number(storyboardShotMatch[1])}-${Number(storyboardShotMatch[2])}`;
  const simpleSceneShotMatch = value.match(/^S0*(\d+)$/i);
  if (simpleSceneShotMatch) return `1-${Number(simpleSceneShotMatch[1])}`;
  const simpleShotMatch = value.match(/^shot[_\s-]*0*(\d+)$/i);
  if (simpleShotMatch) return `${Number(simpleShotMatch[1])}`;
  const trailingNumberMatch = value.match(/(?:^|[_\s-])0*(\d+)$/);
  if (trailingNumberMatch && /^shot/i.test(value)) return `${Number(trailingNumberMatch[1])}`;
  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLoose(value: string) {
  return value.toLowerCase().replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]+/g, "");
}

function shotNumberRegex(displayNumber: string): RegExp | undefined {
  const match = displayNumber.match(/^(\d+)-(\d+)$/);
  if (!match) return undefined;
  return new RegExp(`(?:镜头|分镜|shot)?\\s*${match[1]}\\s*[-_－—]\\s*0*${match[2]}(?!\\d)`, "i");
}

function shotIdRegex(id: string): RegExp {
  return new RegExp(`(?:^|[^a-zA-Z0-9])${escapeRegExp(id)}(?:$|[^a-zA-Z0-9])`, "i");
}

function shotRangeIdsMentionedInIntent(userIntent: string, snapshot: DirectorAgentStateSnapshot): string[] {
  const match = userIntent.match(
    /(?:镜头|分镜|shot)?\s*(\d+)\s*[-_－—]\s*(\d+)\s*(?:到|至|through|to|[-~–—])\s*(?:镜头|分镜|shot)?\s*(\d+)\s*[-_－—]\s*(\d+)/i,
  );
  if (!match) return [];
  const [, leftSection, leftIndex, rightSection, rightIndex] = match;
  if (leftSection !== rightSection) return [];
  const start = Number(leftIndex);
  const end = Number(rightIndex);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  return snapshot.shots
    .filter((shot) => {
      const shotNumber = shot.displayNumber.match(/^(\d+)-(\d+)$/);
      if (!shotNumber || shotNumber[1] !== leftSection) return false;
      const index = Number(shotNumber[2]);
      return Number.isFinite(index) && index >= min && index <= max;
    })
    .map((shot) => shot.id);
}

function shotIdsMentionedInIntent(userIntent: string, snapshot: DirectorAgentStateSnapshot): string[] {
  const trimmed = userIntent.trim();
  if (!trimmed) return [];
  const rangeIds = shotRangeIdsMentionedInIntent(trimmed, snapshot);
  const looseIntent = normalizeLoose(trimmed);
  const mentioned = snapshot.shots.filter((shot) => {
    const numberPattern = shotNumberRegex(shot.displayNumber);
    if (numberPattern?.test(trimmed)) return true;
    if (shotIdRegex(shot.id).test(trimmed)) return true;
    const looseTitle = normalizeLoose(shot.title);
    return looseTitle.length >= 2 && looseIntent.includes(looseTitle);
  }).map((shot) => shot.id);
  return uniqueStrings([...rangeIds, ...mentioned]).filter((shotId) =>
    snapshot.shots.some((shot) => shot.id === shotId),
  );
}

function buildAgentProjectReadiness(
  shots: ShotRecord[],
  assets: AssetRecord[],
  counts = referenceCounts(shots, assets),
): DirectorAgentProjectReadiness {
  if (!shots.length) {
    return {
      status: "needs_story",
      nextActionKind: "revise_story_or_shot",
      nextActionLabel: "先整理故事",
      actionQueue: [
        {
          kind: "revise_story_or_shot",
          label: "整理故事",
          reason: "项目还没有故事流，先把想法变成可确认镜头。",
          priority: "now",
        },
        {
          kind: "request_style_research",
          label: "查风格资料",
          reason: "如果用户指定风格或片感，可以先补资料再拆分镜。",
          priority: "next",
        },
      ],
      summary: "还没有故事流",
      modeSummary: "待判断",
      referenceSummary: "暂无参考",
      ...counts,
    };
  }

  if (counts.missingReferences > 0) {
    return {
      status: "needs_references",
      nextActionKind: "prepare_reference_generation",
      nextActionLabel: "生成参考",
      actionQueue: [
        {
          kind: "prepare_reference_generation",
          label: "生成参考",
          reason: `还有 ${counts.missingReferences} 个参考没有形成可复核素材。`,
          priority: "now",
        },
        {
          kind: "review_reference_asset",
          label: "复核参考",
          reason: counts.needsReviewReferences > 0
            ? `已有 ${counts.needsReviewReferences} 个参考在复核区，可以先锁定可用素材。`
            : "参考生成后会先进入复核区，不自动锁定。",
          priority: counts.needsReviewReferences > 0 ? "now" : "next",
        },
        {
          kind: "prepare_video_submit",
          label: "准备视频",
          reason: "参考生成并复核后，再进入视频提交前检查。",
          priority: "later",
        },
      ],
      summary: `还有 ${counts.missingReferences} 个参考待生成`,
      modeSummary: summarizeReferenceStrategies(shots),
      referenceSummary: summarizeReferenceCounts(counts),
      ...counts,
    };
  }

  if (counts.needsReviewReferences > 0) {
    return {
      status: "needs_review",
      nextActionKind: "revise_story_or_shot",
      nextActionLabel: "复核参考",
      actionQueue: [
        {
          kind: "review_reference_asset",
          label: "复核参考",
          reason: `还有 ${counts.needsReviewReferences} 个参考需要决定通过还是重做。`,
          priority: "now",
        },
        {
          kind: "prepare_video_submit",
          label: "准备视频",
          reason: "待复核参考通过后，可以提交视频前检查。",
          priority: "next",
        },
        {
          kind: "prepare_export",
          label: "导出素材包",
          reason: "需要交付或回看时，可以导出项目、素材和记录。",
          priority: "later",
        },
      ],
      summary: `还有 ${counts.needsReviewReferences} 个参考待复核`,
      modeSummary: summarizeReferenceStrategies(shots),
      referenceSummary: summarizeReferenceCounts(counts),
      ...counts,
    };
  }

  return {
    status: "ready_for_video",
    nextActionKind: "prepare_video_submit",
    nextActionLabel: "准备视频",
    actionQueue: [
      {
        kind: "prepare_video_submit",
        label: "准备视频",
        reason: "故事和参考都已可进入视频提交前检查。",
        priority: "now",
      },
      {
        kind: "prepare_export",
        label: "导出素材包",
        reason: "需要交付或备份时，可以导出 Project.vibe、素材、记录和报告。",
        priority: "next",
      },
      {
        kind: "inspect_project_status",
        label: "再检查一遍",
        reason: "提交前可以重新检查故事、参考和模式是否对齐。",
        priority: "later",
      },
    ],
    summary: "故事和参考已可进入视频前检查",
    modeSummary: summarizeReferenceStrategies(shots),
    referenceSummary: summarizeReferenceCounts(counts),
    ...counts,
  };
}

function referenceCounts(shots: ShotRecord[], assets: AssetRecord[]) {
  const lockedReferences = assets.filter((asset) => asset.lockedStatus === "locked").length;
  const needsReviewReferences = assets.filter((asset) => asset.lockedStatus === "needs_review" || asset.lockedStatus === "candidate").length;
  const explicitMissingReferences = assets.filter((asset) => asset.lockedStatus === "not_generated" || asset.status === "missing").length;
  const hasNoReferenceProjection = shots.length > 0 && lockedReferences === 0 && needsReviewReferences === 0 && explicitMissingReferences === 0;
  return {
    lockedReferences,
    needsReviewReferences,
    missingReferences: explicitMissingReferences || (hasNoReferenceProjection ? shots.length : 0),
  };
}

function summarizeReferenceStrategies(shots: ShotRecord[]) {
  const entries = new Map<string, number>();
  for (const shot of shots) {
    const label = referenceStrategyForShot(shot);
    const key = label ? strategyLabels[label] : unknownStrategyLabel;
    entries.set(key, (entries.get(key) || 0) + 1);
  }
  return Array.from(entries.entries())
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ") || unknownStrategyLabel;
}

function summarizeReferenceCounts(counts: ReturnType<typeof referenceCounts>) {
  return `已锁定 ${counts.lockedReferences} / 待复核 ${counts.needsReviewReferences} / 待生成 ${counts.missingReferences}`;
}

function actionQueueLabel(action: DirectorAgentSuggestedAction) {
  const prefix = action.priority === "now" ? "现在" : action.priority === "next" ? "接着" : "稍后";
  return `${prefix}${action.label}`;
}

function queuedActionKindFromContinueIntent(
  normalized: string,
  snapshot?: DirectorAgentStateSnapshot,
): DirectorAgentActionKind | undefined {
	if (!snapshot) return undefined;
	const queue = directorAgentReadinessActions(snapshot.projectReadiness);
	if (isContinueIntent(normalized)) {
	  if (videoStateCanQuery(snapshot.videoState)) return "query_video_result";
	  if (snapshot.videoState.completedCount > 0 && !explicitlyRequestsMoreVideoSubmit(normalized)) return "inspect_project_status";
	  return (queue.find((item) => item.priority === "now") || queue[0])?.kind || snapshot.projectReadiness.nextActionKind;
	}
  if (!containsAny(normalized, ["按项目状态继续", "项目状态继续"])) return undefined;
  const mentioned = queue.find((item) => normalized.includes(normalizeText(item.label)));
  return mentioned?.kind || queue[0]?.kind || snapshot.projectReadiness.nextActionKind;
}

function isContinueIntent(normalized: string) {
  if (containsAny(normalized, ["不要继续", "别继续", "先不继续", "不要开始", "别开始"])) return false;
  const compact = normalized
    .replace(/^(可以|好的|好啊|好|ok|okay|那就|那|就|直接|你来|帮我|请)+/, "")
    .replace(/(一下吧|一下|吧)$/g, "");
  if (/(没问题|可以|确认|通过|ok|okay).{0,8}(继续|下一步|进入故事流|确认进故事流)/.test(compact)) return true;
  if (/(继续|下一步|进入故事流|确认进故事流).{0,8}(没问题|可以|确认|通过|ok|okay)/.test(compact)) return true;
  return [
    "继续",
    "继续吧",
    "下一步",
    "下一个",
    "开始",
    "开始吧",
    "执行",
    "做吧",
    "推进",
    "往下做",
    "letgo",
    "letsgo",
    "letsg o",
    "go",
  ].some((phrase) => compact === normalizeText(phrase));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function compactStrings(values: string[] | undefined) {
  return uniqueStrings(values || []);
}

function cleanOptional(value: string | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

function compactId(value: string) {
  return value.replace(/[^0-9A-Za-z]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
