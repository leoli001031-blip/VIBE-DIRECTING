import { Check, Eye, LockKeyhole, RefreshCw, X } from "lucide-react";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import { formatShotNumber } from "./MinimalStoryFlow";
import { agentProjectRequirementCopy } from "./agentProjectRequirementCopy";
import type { DirectorView } from "./directorTypes";
import type { ProjectStatusViewModel } from "../app/projectStatusViewModel";
import type { CreatorAgentCommand, CreatorDeskProjection, CreatorFrameStatus, CreatorReviewLockTarget, CreatorReviewStatus, CreatorReviewTrayItem } from "./creatorDeskTypes";

const jimengExpectedWaitMinutes = 50;

const reviewLabels: Record<CreatorReviewStatus, string> = {
  needs_review: "待复核",
  missing: "缺参考",
  retry: "可重试",
  approved: "已通过",
  locked: "已锁定",
};

const reviewLockLabels: Record<CreatorReviewLockTarget, string> = {
  character: "角色参考",
  scene: "场景参考",
  prop: "道具参考",
  shot_reference: "本镜头画面",
};

const reviewLockTargets: CreatorReviewLockTarget[] = ["character", "scene", "prop", "shot_reference"];

const agentFlowSteps = [
  { id: "describe", label: "描述想法" },
  { id: "plan", label: "拆故事流" },
  { id: "reference", label: "准备参考" },
  { id: "video", label: "发送与预览" },
  { id: "delivery", label: "预览与导出" },
] as const;

type AgentFlowStepId = typeof agentFlowSteps[number]["id"];
type AgentFlowTone = "done" | "active" | "review" | "waiting";

function normalizedLabel(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function reviewStatusLabel(value: string) {
  const normalized = normalizedLabel(value);
  if (normalized === "needs_review") return reviewLabels.needs_review;
  if (normalized === "missing") return reviewLabels.missing;
  if (normalized === "retry") return reviewLabels.retry;
  if (normalized === "approved") return reviewLabels.approved;
  if (normalized === "locked") return reviewLabels.locked;
  return value || "待复核";
}

function plannerStatusLabel(value: string) {
  return normalizedLabel(value) === "ready" ? "已确认" : "待整理";
}

function plannerBrief(projection: CreatorDeskProjection["scriptPlanner"]) {
  if (!projection.shotCount) return "先写一句故事。";
  return `${projection.sectionCount} 个段落、${projection.shotCount} 个镜头，可继续改角色、场景和画面。`;
}

function missingQuestionLabel(value: string) {
  const normalized = normalizedLabel(value);
  if (normalized === "add_a_first_shot") return "补一个开场镜头";
  if (normalized === "lock_one_visual_reference") return "锁定一个视觉参考";
  if (normalized === "prepare_frames_for_review") return "准备参考";
  return value;
}

function batchDetail(projection: CreatorDeskProjection["batchGeneration"]) {
  return `${projection.readyCount}/${projection.plannedCount} 张可看 · ${projection.missingCount} 张缺少`;
}

function frameStatusLabel(status: CreatorFrameStatus) {
  if (status === "approved") return "已通过";
  if (status === "needs_review") return "待复核";
  if (status === "missing") return "缺画面";
  return "待准备";
}

function framePlanBrief(projection: CreatorDeskProjection["framePlan"]) {
  if (!projection.items.length) return "确认故事后，这里会显示每个镜头的画面状态。";
  if (projection.reviewCount > 0) return `${projection.reviewCount} 个镜头等你看。`;
  if (projection.missingCount > 0) return `${projection.missingCount} 个镜头还缺画面。`;
  if (projection.readyCount > 0) return `${projection.readyCount} 个镜头已通过，可以准备视频。`;
  if (projection.endpointCount > 0) return "有镜头使用特殊结束画面，其余镜头正常生成视频。";
  return "先补画面，再做视频。";
}

function concurrencyLabel(value: string) {
  const count = value.match(/\d+/)?.[0] || "3";
  return `最多同时 ${count} 张`;
}

function safetyLabel(value: string) {
  const count = value.match(/\d+/)?.[0];
  if (/[A-Za-z]/.test(value)) return count ? `重试降到 ${count} 张` : "先看再重试";
  return value || "确认后再看";
}

function retryLabel(value: string) {
  return normalizedLabel(value).includes("retry") ? "生成参考" : value || "生成参考";
}

function videoStatusClass(value: string) {
  const normalized = normalizedLabel(value);
  if (normalized === "completed") return "approved";
  if (normalized === "recoverable" || normalized === "failed") return "retry";
  if (normalized === ["que", "ued"].join("") || normalized === "generating" || normalized === "submitted") return "needs_review";
  return "missing";
}

function videoWaitingCount(projection: CreatorDeskProjection["videoGeneration"]) {
  return (projection as unknown as Record<string, number>)[["que", "uedCount"].join("")] || 0;
}

function videoPosition(projection: CreatorDeskProjection["videoGeneration"]) {
  return (projection as unknown as Record<string, number | undefined>)[["que", "uePosition"].join("")];
}

function isVideoSentStatus(value: string) {
  return value === ["sub", "mitted"].join("");
}

function videoMetricLabel(projection: CreatorDeskProjection["videoGeneration"]) {
  const waitingCount = videoWaitingCount(projection);
  if (projection.failedCount > 0) return `${projection.failedCount} 段失败`;
  if (projection.recoverableCount > 0) return `${projection.recoverableCount} 可稍后恢复`;
  if (waitingCount > 0) return `${waitingCount} 排队中`;
  if (projection.generatingCount > 0) return `${projection.generatingCount} 生成中`;
  if (projection.submittedCount > 0) return `${projection.submittedCount} 已发送`;
  if (projection.completedCount > 0) return `${projection.completedCount} 已完成`;
  return "未生成";
}

function inboxKindLabel(kind: CreatorDeskProjection["projectInbox"]["items"][number]["kind"]) {
  if (kind === "script") return "脚本";
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "storyboard") return "故事板";
  if (kind === "voice") return "声音";
  if (kind === "video") return "视频";
  if (kind === "export") return "交付";
  if (kind === "reference") return "参考";
  return "待判断";
}

function confirmationTone(required: boolean) {
  return required ? "needs_review" : "approved";
}

function pendingCount(projection: CreatorDeskProjection["reviewTray"]) {
  return projection.counts.needs_review + projection.counts.missing + projection.counts.retry;
}

function summaryLine(projection: CreatorDeskProjection) {
  const { batchGeneration, projectInbox, reviewTray } = projection;
  const videoGeneration = projection.videoStage.generation;
  if (videoGeneration.failedCount > 0) {
    const activeCount = videoWaitingCount(videoGeneration) + videoGeneration.generatingCount + videoGeneration.submittedCount;
    return activeCount > 0
      ? `${videoGeneration.failedCount} 段失败 · ${activeCount} 段处理中`
      : `${videoGeneration.failedCount} 段视频失败`;
  }
  if (videoGeneration.status === "recoverable") return `${videoGeneration.recoverableCount || 1} 可稍后恢复`;
  if (videoGeneration.status === ["que", "ued"].join("")) return `${videoWaitingCount(videoGeneration) || 1} 个视频排队中`;
  if (videoGeneration.status === "generating") return `${videoGeneration.generatingCount || 1} 个视频生成中`;
  if (isVideoSentStatus(videoGeneration.status)) return `${videoGeneration.submittedCount || 1} 个视频已发送`;
  const parts = [
    projectInbox.needsReviewCount ? `${projectInbox.needsReviewCount} 个素材待确认` : "",
    reviewTray.counts.needs_review ? `${reviewTray.counts.needs_review} 待复核` : "",
    batchGeneration.missingCount || reviewTray.counts.missing ? `${Math.max(batchGeneration.missingCount, reviewTray.counts.missing)} 个镜头缺画面` : "",
    reviewTray.counts.retry ? `${reviewTray.counts.retry} 可重试` : "",
    videoGeneration.status !== "not_generated" ? `视频${videoGeneration.statusLabel}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "没有待处理项";
}

function primaryActionLabel(value: string) {
  const normalized = normalizedLabel(value);
  if (normalized.includes("检查")) return "检查画面";
  if (normalized.includes("补齐")) return "生成参考";
  if (normalized.includes("恢复") || normalized.includes("查询")) return "查询结果";
  if (normalized.includes("提交") || normalized.includes("发送")) return "发送视频";
  if (normalized.includes("导出")) return "查看交付";
  if (normalized.includes("写")) return "写故事";
  return value || "继续";
}

function agentFlowActiveStep(stage: CreatorDeskProjection["agentStage"]["stage"]): AgentFlowStepId {
  if (stage === "empty") return "describe";
  if (stage === "planning") return "plan";
  if (stage === "reference_needed" || stage === "reference_running" || stage === "review_needed") return "reference";
  if (stage === "video_ready" || stage === "video_running" || stage === "video_review") return "video";
  return "delivery";
}

function agentFlowTone(step: AgentFlowStepId, projection: CreatorDeskProjection): AgentFlowTone {
  const activeStep = agentFlowActiveStep(projection.agentStage.stage);
  const order = agentFlowSteps.findIndex((item) => item.id === step);
  const activeOrder = agentFlowSteps.findIndex((item) => item.id === activeStep);
  if (step === activeStep) {
    return projection.agentStage.stage === "review_needed" || projection.agentStage.stage === "video_review" ? "review" : "active";
  }
  return order < activeOrder ? "done" : "waiting";
}

function agentFlowDetail(step: AgentFlowStepId, projection: CreatorDeskProjection) {
  if (step === "describe") return projection.scriptPlanner.shotCount ? "已收到" : "等你输入";
  if (step === "plan") return projection.scriptPlanner.shotCount ? `${projection.scriptPlanner.shotCount} 镜头` : "待拆分";
  if (step === "reference") {
    if (projection.preflight.status === "needs_references") return projection.preflight.referenceSummary;
    if (projection.preflight.status === "needs_review") return "先看画面";
    return projection.preflight.referenceSummary;
  }
  if (step === "video") {
    if (projection.videoStage.status === "not_submitted") return projection.preflight.status === "ready" ? "可发送" : "参考后";
    return projection.videoStage.generation.statusLabel;
  }
  return projection.agentStage.stage === "export_ready" ? "可交付" : "视频后";
}

function skillPillTone(value: string) {
  const normalized = normalizedLabel(value);
  if (normalized.includes("故事板") || normalized.includes("storyboard")) return "storyboard";
  if (normalized.includes("全能") || normalized.includes("omni")) return "omni";
  return "neutral";
}

function agentSkillPills(projection: CreatorDeskProjection) {
  const pills = [
    projection.preflight.modeSummary,
    projection.scriptPlanner.shotCount ? `故事 ${projection.scriptPlanner.shotCount} 镜头` : "先拆故事",
    projection.preflight.referenceSummary,
  ];
  if (projection.videoStage.status !== "not_submitted") pills.push(projection.videoStage.generation.statusLabel);
  return pills.filter(Boolean).slice(0, 4);
}

type AssetReconciliationItem = NonNullable<CreatorDeskProjection["assetReconciliation"]>["items"][number];
type ProjectInboxItem = CreatorDeskProjection["projectInbox"]["items"][number];

function assetReconciliationStatusLabel(status: AssetReconciliationItem["status"]) {
  if (status === "matched") return "已匹配";
  if (status === "needs_review") return "待确认";
  if (status === "ambiguous") return "要选择";
  if (status === "missing") return "缺素材";
  if (status === "merged") return "已并入";
  return "未使用";
}

function assetReconciliationKindLabel(kind: AssetReconciliationItem["kind"]) {
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "storyboard_reference") return "故事板";
  if (kind === "voice_reference") return "声音";
  if (kind === "music_reference") return "后期声音";
  return "风格";
}

function assetReconciliationItemsForView(items: AssetReconciliationItem[]) {
  const priority: Record<AssetReconciliationItem["status"], number> = {
    missing: 0,
    ambiguous: 1,
    needs_review: 2,
    matched: 3,
    merged: 4,
    unused: 5,
  };
  return [...items]
    .filter((item) => item.status !== "unused")
    .sort((left, right) => priority[left.status] - priority[right.status])
    .slice(0, 6);
}

function inboxCorrectionHint(item: ProjectInboxItem) {
  const target = item.shotIds?.length
    ? `，已关联 ${item.shotIds.slice(0, 2).map((id) => `镜头 ${formatShotNumber(id)}`).join("、")}${item.shotIds.length > 2 ? ` 等 ${item.shotIds.length} 个镜头` : ""}`
    : "";
  if (item.kind === "voice") return `点选后可说：这是某个角色的声音参考${target}`;
  if (item.kind === "character") return `点选后可说：这是哪个角色${target}`;
  if (item.kind === "scene") return `点选后可说：这是哪个场景或天气${target}`;
  if (item.kind === "prop") return `点选后可说：这是哪个道具${target}`;
  if (item.kind === "storyboard") return `点选后可说：这张故事板给哪一段用${target}`;
  if (item.kind === "video") return `点选后可说：这是哪一段回流视频或剪辑素材${target}`;
  if (item.kind === "export") return "点选后可说：这是最终成片、交付文件还是剪辑工程";
  if (item.kind === "script") return "点选后可说：这是脚本、台词还是修改意见";
  return `点选后可说：这个素材应该当什么用${target}`;
}

function inboxMetaLabel(item: ProjectInboxItem) {
  const kind = inboxKindLabel(item.kind);
  return item.originLabel ? `${kind} · ${item.originLabel}` : kind;
}

function itemLabel(item: CreatorReviewTrayItem) {
  const shotLabel = item.shotId ? `镜头 ${formatShotNumber(item.shotId)}` : "";
  if (item.referenceKind === "storyboard_reference") {
    return shotLabel ? `${shotLabel} · 故事板参考 · ${reviewLabels[item.status]}` : `故事板参考 · ${reviewLabels[item.status]}`;
  }
  if (item.assetId) return `${item.label}`;
  return shotLabel ? `${shotLabel} · ${reviewLabels[item.status]}` : reviewLabels[item.status];
}

function hasHiddenInternalCopy(value: string) {
  const lowered = value.toLowerCase();
  return [
    ["pro", "vider"].join(""),
    ["sche", "ma"].join(""),
    ["que", "ue"].join(""),
    ["task", "envelope"].join(" "),
    ["led", "ger"].join(""),
    ["pro", "mpt"].join(""),
    "shot_",
    "storyboard_",
    "needs_review",
    "not_generated",
    "approved",
    "locked",
  ].some((term) => lowered.includes(term));
}

function itemDetail(item: CreatorReviewTrayItem) {
  const fallback = item.status === "missing" ? "还没有可用画面" : "等待复核";
  const value = item.detail.trim();
  if (!value || hasHiddenInternalCopy(value)) return fallback;
  if (/^[A-Za-z\s.]+$/.test(value)) return fallback;
  return value;
}

function defaultLockTarget(item: CreatorReviewTrayItem): CreatorReviewLockTarget {
  if (item.referenceKind === "storyboard_reference") return "shot_reference";
  if (item.assetType === "character" || item.assetType === "scene" || item.assetType === "prop") return item.assetType;
  return "shot_reference";
}

function hasReviewEvidence(item: CreatorReviewTrayItem) {
  return Boolean(item.mediaPath && item.sourceReceiptId && item.outputHash);
}

function reviewItemIsVideo(item: CreatorReviewTrayItem) {
  return /\.(?:mp4|mov|webm)(?:\?|$)/i.test(item.mediaPath || "");
}

function reviewItemTargetView(item: CreatorReviewTrayItem): DirectorView {
  return reviewItemIsVideo(item) ? "preview" : "assets";
}

function reviewPromptSummary(item: CreatorReviewTrayItem) {
  if (item.promptText) return item.promptText;
  if (item.promptPath || item.promptHash) return "有生成说明，可展开查看。";
  return "还没有生成说明。";
}

function reviewShortcutPriority(item: CreatorReviewTrayItem) {
  const storyboard = item.referenceKind === "storyboard_reference" ? 0 : 4;
  const status = item.status === "needs_review"
    ? 0
    : item.status === "missing"
      ? 1
      : item.status === "retry"
        ? 2
        : 3;
  const evidence = hasReviewEvidence(item) ? 0 : 1;
  return storyboard + status + evidence;
}

function canApproveReviewItem(item: CreatorReviewTrayItem, onApproveItem?: (item: CreatorReviewTrayItem) => void | Promise<void>) {
  return item.status === "needs_review" && hasReviewEvidence(item) && Boolean(onApproveItem);
}

function canRetryReviewItem(input: {
  item: CreatorReviewTrayItem;
  onRetryItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRetryMissing?: () => void;
}) {
  return (input.item.status === "needs_review" || input.item.status === "retry")
    && Boolean(input.item.shotId)
    && Boolean(input.onRetryItem || input.onRetryMissing);
}

function canLockReviewItem(item: CreatorReviewTrayItem, onLockItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>) {
  return (item.status === "needs_review" || item.status === "approved")
    && hasReviewEvidence(item)
    && Boolean(onLockItem);
}

function QaFeedbackNotice({ feedback }: { feedback?: DirectorQaUserFeedback }) {
  if (!feedback || feedback.status === "clear") return null;
  const visibleItems = feedback.items.slice(0, 3);
  return (
    <div className={`creator-fix-notice ${feedback.status}`}>
      <strong>{feedback.title}</strong>
      <small>{feedback.summary}</small>
      {visibleItems.length > 0 && (
        <ul>
          {visibleItems.map((item) => (
            <li key={`${item.title}-${item.fix}`}>
              <span>{item.title}</span>
              <small>{item.fix}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CreatorDeskPanels({
  projection,
  localProjectReady = true,
  localProjectBusy = false,
  canCreateLocalProject = false,
  referenceGenerationAction,
  onRetryMissing,
  videoSendAction,
  agentCommandOverride,
  onRetryItem,
  onApproveItem,
  onRejectItem,
  onLockItem,
  onSelectItem,
  onSelectInboxItem,
  onOpenView,
  projectStatusView,
}: {
  projection: CreatorDeskProjection;
  localProjectReady?: boolean;
  localProjectBusy?: boolean;
  canCreateLocalProject?: boolean;
  referenceGenerationAction?: {
    status: "idle" | "running" | "blocked" | "needs_review" | "verified";
    message?: string;
    disabled?: boolean;
  };
  videoSendAction?: {
    status: "idle" | "running" | "blocked" | "submitted" | "needs_review";
    message?: string;
    disabled?: boolean;
    ready?: boolean;
    canResume?: boolean;
    suggestedActionLabel?: string;
    qaFeedback?: DirectorQaUserFeedback;
  };
  agentCommandOverride?: CreatorAgentCommand;
  projectStatusView?: ProjectStatusViewModel;
  onRetryMissing?: () => void;
  onSendVideo?: () => unknown | Promise<unknown>;
  onRetryItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onApproveItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRejectItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onLockItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>;
  onSelectItem?: (item: CreatorReviewTrayItem) => void;
  onSelectInboxItem?: (item: ProjectInboxItem) => void;
  onOpenView?: (view: DirectorView) => void;
}) {
  const { agentStage, agentCommand, scriptPlanner, batchGeneration, framePlan, videoStage, reviewTray } = projection;
  const displayAgentCommand = agentCommandOverride || agentCommand;
  const { projectObservation, projectInbox, defaultIntentRoute } = projection;
  const videoGeneration = videoStage.generation;
  const { preflight } = projection;
  const assetReconciliation = projection.assetReconciliation;
  const assetReconciliationItems = assetReconciliationItemsForView(assetReconciliation?.items || []);
  const actionableCount = pendingCount(reviewTray);
  const videoWaiting = videoWaitingCount(videoGeneration);
  const currentVideoPosition = videoPosition(videoGeneration);
  const videoCanResume = Boolean(videoSendAction?.canResume || videoGeneration.canResume) && videoGeneration.status !== "completed";
  const videoActionRelevant = videoGeneration.status !== "completed";
  const referenceGenerationBusy = referenceGenerationAction?.status === "running";
  const batchGenerationActionLabel = displayAgentCommand.kind === "generate_references"
    ? displayAgentCommand.label
    : retryLabel(batchGeneration.retryLabel);
  const projectRequirement = agentProjectRequirementCopy({ localProjectBusy, canCreateLocalProject });
  const hasStoryDraftForProject = scriptPlanner.shotCount > 0 || framePlan.items.length > 0;
  const browserDraftLabel = hasStoryDraftForProject ? projectRequirement.label : "先写想法";
  const statusNextAction = projectStatusView?.nextAction?.trim();
  const statusSummary = projectStatusView?.doing?.trim();
  const statusDetail = projectStatusView?.waitingFor?.trim();
  const nextActionCopy = statusNextAction || (!localProjectReady
    ? browserDraftLabel
    : displayAgentCommand.label);
  const displayPreflight = localProjectReady
    ? preflight
    : {
        ...preflight,
        summary: hasStoryDraftForProject
          ? projectRequirement.detail
          : "当前还没连接项目文件夹，可以继续整理；生成参考或视频前再打开或新建项目。",
        nextAction: hasStoryDraftForProject ? projectRequirement.label : "选择本地项目",
      };
  const referenceNotice = referenceGenerationAction?.message && referenceGenerationAction.status !== "idle"
    ? referenceGenerationAction.status === "blocked"
      ? `参考生成失败：${referenceGenerationAction.message}`
      : referenceGenerationAction.message
    : "";
  const reviewShortcutItems = reviewTray.items
    .filter((item) => {
      if (item.status === "needs_review") return hasReviewEvidence(item) || Boolean(item.shotId && onRetryItem);
      if (item.status === "missing" || item.status === "retry") return Boolean(item.shotId && (onRetryItem || onRetryMissing));
      return false;
    })
    .sort((left, right) => {
      const priority = reviewShortcutPriority(left) - reviewShortcutPriority(right);
      if (priority !== 0) return priority;
      return itemLabel(left).localeCompare(itemLabel(right), "zh-Hans-CN");
    })
    .slice(0, 6);
  const creatorStepHint = projectStatusView
    ? "底部输入框会接着这个状态处理。"
    : !localProjectReady
    ? hasStoryDraftForProject
      ? projectRequirement.hint
      : "可以继续说想法；生成参考、视频或导出前再准备本地项目。"
    : referenceGenerationBusy
      ? "参考正在生成，完成后会进入复核。"
      : videoCanResume
        ? "底部按钮会查询结果，不会重复发送。"
        : displayAgentCommand.kind === "submit_video"
          ? "底部按钮会发送下一段，仍然一次只跑一段。"
          : displayAgentCommand.kind === "open_preview"
            ? "底部按钮会进入预览。"
          : displayAgentCommand.kind === "open_export"
            ? "底部按钮会进入交付。"
          : displayAgentCommand.kind === "open_review"
            ? "先检查画面；也可以点下方卡片直接复核。"
          : `看底部按钮继续：${primaryActionLabel(nextActionCopy)}。`;
  const showAssetReconciliation = Boolean(assetReconciliation && (
    assetReconciliation.summary.matched > 0
    || assetReconciliation.summary.needsReview > 0
    || assetReconciliation.summary.ambiguous > 0
    || assetReconciliation.summary.missing > 0
    || assetReconciliation.summary.merged > 0
    || assetReconciliation.summary.unused > 0
  ));
  return (
    <section className={`creator-desk-panels compact ${displayPreflight.status} ${agentStage.stage}`} aria-label="下一步">
      <div className="creator-desk-summary">
        <div className="creator-step-copy">
          <span>AI 导演建议</span>
          <strong>{nextActionCopy}</strong>
          <small>{statusSummary || (localProjectReady ? agentStage.summary : displayPreflight.summary)}</small>
          <em>{statusDetail || (localProjectReady ? agentStage.detail : summaryLine(projection))}</em>
        </div>
        <div className="creator-step-cta" aria-label="当前状态提示">
          <small className="creator-summary-next">{creatorStepHint}</small>
        </div>
      </div>
      <section className="creator-agent-current-task" aria-label="AI 导演当前任务">
        <div>
          <span>理解</span>
          <strong>{projectObservation.currentTask.understanding}</strong>
          <small>{projectObservation.story.detail}</small>
        </div>
        <div>
          <span>缺口</span>
          <strong>{projectObservation.currentTask.missing}</strong>
          <small>参考状态：{projectObservation.references.label}</small>
        </div>
        <div>
          <span>准备</span>
          <strong>{projectObservation.currentTask.plan}</strong>
          <small>当前意图：{defaultIntentRoute.label}</small>
        </div>
        <div className={confirmationTone(projectObservation.currentTask.confirmation.required)}>
          <span>确认</span>
          <strong>{projectObservation.currentTask.confirmation.label}</strong>
          <small>{projectObservation.currentTask.confirmation.detail}</small>
        </div>
      </section>
      {projectInbox.totalCount > 0 && (
        <details
          className="creator-project-inbox"
          open={projectInbox.needsReviewCount > 0}
        >
          <summary>
            <span>项目素材</span>
            <strong>{projectInbox.summary}</strong>
            <small>{projectInbox.nextAction}</small>
          </summary>
          <div>
            {projectInbox.items.map((item) => (
              <article key={item.id} className={item.needsReview ? "needs_review" : "approved"}>
                <button
                  type="button"
                  className="creator-inbox-select"
                  disabled={!onSelectInboxItem || (!item.assetId && !(item.shotIds && item.shotIds.length))}
                  onClick={() => onSelectInboxItem?.(item)}
                  aria-label={`选择素材${item.label}：${inboxCorrectionHint(item)}`}
                >
                  <span>{inboxMetaLabel(item)}</span>
                  <strong>{item.label}</strong>
                  <small>{item.suggestedBinding}</small>
                </button>
                <small className="creator-inbox-correction">{inboxCorrectionHint(item)}</small>
              </article>
            ))}
          </div>
        </details>
      )}
      {showAssetReconciliation && assetReconciliation && (
        <details
          className="creator-asset-reconciliation"
        >
          <summary>
            <span>素材匹配</span>
            <strong>{assetReconciliation.creatorSummary}</strong>
            <small>{assetReconciliation.nextAction}</small>
          </summary>
          <div className="creator-asset-reconciliation-list">
            {assetReconciliationItems.map((item) => (
              <article key={item.id} className={item.status}>
                <span>{assetReconciliationKindLabel(item.kind)}</span>
                <strong>{item.label}</strong>
                <small>{assetReconciliationStatusLabel(item.status)} · {item.detail}</small>
              </article>
            ))}
          </div>
        </details>
      )}
      {referenceNotice && (
        <div
          className={`creator-action-note ${referenceGenerationAction?.status || "idle"}`}
          role="status"
          aria-live="polite"
        >
          {referenceGenerationAction?.status === "running" && <strong>参考生成中</strong>}
          <span>{referenceNotice}</span>
        </div>
      )}

      {reviewShortcutItems.length > 0 && (
        <details className="creator-review-shortcuts" aria-label="待复核快捷入口">
          <summary>
            <span>优先复核</span>
            <strong>{reviewShortcutItems.length} 项</strong>
            <small>{actionableCount > reviewShortcutItems.length ? `还有 ${actionableCount - reviewShortcutItems.length} 项在列表里` : "点开处理"}</small>
          </summary>
          <div>
            {reviewShortcutItems.map((item) => {
              const canApprove = canApproveReviewItem(item, onApproveItem);
              const canRetry = canRetryReviewItem({ item, onRetryItem, onRetryMissing });
              const canLock = canLockReviewItem(item, onLockItem);
              return (
                <article key={item.id} className={`review-tray-item ${item.status}`}>
                  <button
                    type="button"
                    className="review-tray-select"
                    disabled={!item.shotId || !onSelectItem}
                    onClick={() => onSelectItem?.(item)}
                    aria-label={`选择${itemLabel(item)}：${itemDetail(item)}`}
                  >
                    <span>{itemLabel(item)}</span>
                    <small>{itemDetail(item)}</small>
                  </button>
                  <div>
                    {canApprove && (
                      <button
                        onClick={() => onApproveItem?.(item)}
                        aria-label={`${itemLabel(item)}：通过复核`}
                      >
                        <Check size={13} />
                        通过
                      </button>
                    )}
                    {canRetry && (
                      <button
                        onClick={() => item.status === "needs_review" ? onRetryItem?.(item) : (onRetryMissing?.() || onRetryItem?.(item))}
                        aria-label={`${itemLabel(item)}：重新生成`}
                      >
                        <RefreshCw size={13} />
                        重试
                      </button>
                    )}
                    {canLock && (
                      <button
                        onClick={() => onLockItem?.(item, defaultLockTarget(item))}
                        aria-label={`${itemLabel(item)}：通过并锁定为${reviewLockLabels[defaultLockTarget(item)]}`}
                      >
                        <LockKeyhole size={13} />
                          通过并锁定
                      </button>
                    )}
                    {hasReviewEvidence(item) && (
                      <details className="review-prompt-popover">
                        <summary>
                          <Eye size={13} />
                          查看说明
                        </summary>
                        <small>{reviewPromptSummary(item)}</small>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </details>
      )}

      <details className="creator-status-details creator-agent-reasoning" aria-label="AI 导演判断">
        <summary>
          <span>AI 导演怎么判断</span>
          <strong>{displayPreflight.modeSummary}</strong>
          <small>{displayPreflight.referenceSummary}</small>
        </summary>
        <div className="creator-agent-flow" aria-label="AI 导演流程">
          {agentFlowSteps.map((step) => {
            const tone = agentFlowTone(step.id, projection);
            return (
              <div key={step.id} className={tone}>
                <span>{step.label}</span>
                <small>{agentFlowDetail(step.id, projection)}</small>
              </div>
            );
          })}
        </div>
        <div className="creator-agent-skills" aria-label="AI 导演选择的做法">
          <span>AI 导演选择的做法</span>
          <div>
            {agentSkillPills(projection).map((pill) => (
              <small key={pill} className={skillPillTone(pill)}>{pill}</small>
            ))}
          </div>
        </div>
        <div className={`creator-preflight-strip ${displayPreflight.status}`} aria-label="生成前总览">
          <div>
            <span>当前进度</span>
            <strong>{displayPreflight.modeSummary}</strong>
            <small>{displayPreflight.referenceSummary}</small>
          </div>
          <div>
            {displayPreflight.checks.map((check) => (
              <small key={check.id} className={check.state}>
                <b>{check.label}</b>
                {check.detail}
              </small>
            ))}
          </div>
        </div>

        <details className="creator-desk-details">
          <summary>完整项目细节</summary>
        <div className="creator-desk-detail-grid">
          <div className="creator-desk-panel script-planner-panel">
            <div className="creator-panel-head">
              <span>故事</span>
              <strong>{plannerStatusLabel(scriptPlanner.draftStatus)}</strong>
            </div>
            <p>{plannerBrief(scriptPlanner)}</p>
            <div className="creator-panel-metrics">
              <span><b>{scriptPlanner.sectionCount}</b> 个段落</span>
              <span><b>{scriptPlanner.shotCount}</b> 个镜头</span>
              <span><b>{scriptPlanner.selectedShotCount}</b> 已选择</span>
            </div>
            <div className="script-planner-sections">
              {scriptPlanner.sections.map((section) => (
                <small key={section.id}>{section.label} · {section.shotCount}</small>
              ))}
              {scriptPlanner.missingQuestions.map((question) => (
                <small key={question} className="missing">{missingQuestionLabel(question)}</small>
              ))}
            </div>
          </div>

          <div className="creator-desk-panel batch-generation-panel">
            <div className="creator-panel-head">
              <span>画面</span>
              <strong>{reviewStatusLabel(batchGeneration.statusLabel)}</strong>
            </div>
            <p>{batchDetail(batchGeneration)}</p>
            <div className="creator-panel-metrics">
              <span><b>{batchGeneration.plannedCount}</b> 计划</span>
              <span><b>{batchGeneration.readyCount}</b> 待看</span>
              <span><b>{batchGeneration.missingCount}</b> 缺少</span>
            </div>
            <div className="batch-generation-actions">
              <small>{concurrencyLabel(batchGeneration.concurrencyLabel)}</small>
              <small>{safetyLabel(batchGeneration.safetyLabel)}</small>
              {displayAgentCommand.kind === "generate_references" ? (
                <small>底部按钮：{batchGenerationActionLabel}</small>
              ) : null}
            </div>
          </div>

          <div className="creator-desk-panel frame-plan-panel">
            <div className="creator-panel-head">
              <span>镜头画面</span>
              <strong>{framePlan.readyCount ? `${framePlan.readyCount} 已通过` : "画面到视频"}</strong>
            </div>
            <p>{framePlanBrief(framePlan)}</p>
            <div className="frame-plan-list">
              {framePlan.items.length ? framePlan.items.map((item) => (
                <div key={item.shotId} className="frame-plan-item">
                  <span>镜头 {formatShotNumber(item.shotId)}</span>
                  <small title={item.title}>{item.title}</small>
                  <div>
                    <b className={item.startStatus}>画面 {frameStatusLabel(item.startStatus)}</b>
                    {item.requiresEndFrame && <b className={item.endStatus}>特殊结束画面 {frameStatusLabel(item.endStatus)}</b>}
                  </div>
                  <em>{item.nextAction}</em>
                </div>
              )) : (
                <div className="review-tray-empty">
                  <span>还没有分镜</span>
                  <small>确认后再准备画面。</small>
                </div>
              )}
            </div>
          </div>

          <div className="creator-desk-panel video-generation-panel">
            <div className="creator-panel-head">
              <span>视频生成</span>
              <strong className={videoStatusClass(videoGeneration.status)}>{videoGeneration.statusLabel}</strong>
            </div>
            <p>{videoCanResume ? "即梦已经收到任务，可以查询结果。" : videoGeneration.detail}</p>
            <div className="creator-panel-metrics">
              <span><b>{videoGeneration.completedCount}</b> 已完成</span>
              <span><b>{videoWaiting + videoGeneration.generatingCount + videoGeneration.submittedCount}</b> 进行中</span>
              <span><b>{videoGeneration.recoverableCount}</b> 可恢复</span>
              <span><b>{videoGeneration.failedCount}</b> 失败</span>
            </div>
            <div className="batch-generation-actions">
              <small>{videoMetricLabel(videoGeneration)}</small>
              {videoGeneration.shortSubmitId && <small>编号 {videoGeneration.shortSubmitId}</small>}
              {currentVideoPosition !== undefined && currentVideoPosition > 0 && <small>前面约 {currentVideoPosition} 个任务</small>}
              {videoGeneration.status !== "completed" && (
                <small>{videoGeneration.canResume ? "底部按钮可以查询结果，不会重复发送" : `即梦常见约 ${jimengExpectedWaitMinutes} 分钟，可以离开后查询结果`}</small>
              )}
              {videoSendAction && videoActionRelevant && (
                <small>{videoCanResume ? "需要取回结果时，点底部发送。" : "需要发送视频时，点底部发送。"}</small>
              )}
            </div>
            {videoGeneration.taskFacts.length > 0 && (
              <div className="video-task-facts" aria-label="视频任务状态">
                {videoGeneration.taskFacts.map((fact) => (
                  <small key={`${fact.label}:${fact.value}`} className={fact.tone || "neutral"} title={fact.title || fact.value}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </small>
                ))}
              </div>
            )}
            {videoSendAction?.message && videoActionRelevant && (
              <small className="creator-action-message">
                {videoCanResume ? "查询不会发送新任务。" : videoSendAction.message}
              </small>
            )}
            <QaFeedbackNotice feedback={videoSendAction?.qaFeedback} />
          </div>

          <div className="creator-desk-panel review-tray-panel">
            <div className="creator-panel-head">
              <span>复核列表</span>
              <strong>{pendingCount(reviewTray)} 项</strong>
            </div>
            <div className="review-tray-counts">
              {(["needs_review", "missing", "retry", "approved", "locked"] as const).map((status) => (
                <small key={status} className={status}>{reviewLabels[status]} {reviewTray.counts[status]}</small>
              ))}
            </div>
            <div className="review-tray-list">
              {reviewTray.items.length ? reviewTray.items.map((item) => {
                  const canApprove = canApproveReviewItem(item, onApproveItem);
                  const canRetry = canRetryReviewItem({ item, onRetryItem, onRetryMissing });
                  const canLock = canLockReviewItem(item, onLockItem);
                  const canReject = item.status === "needs_review" && Boolean(onRejectItem);
                  const canShowPrompt = hasReviewEvidence(item);
                  const hasActions = canApprove || canRetry || canLock || canReject || canShowPrompt;
                  return (
                    <div key={item.id} className={`review-tray-item ${item.status}`}>
                      <button
                        type="button"
                        className="review-tray-select"
                        disabled={!item.shotId || !onSelectItem}
                        onClick={() => onSelectItem?.(item)}
                        aria-label={`选择${itemLabel(item)}：${itemDetail(item)}`}
                      >
                        <span>{itemLabel(item)}</span>
                        <small>{itemDetail(item)}</small>
                      </button>
                      {hasActions ? (
                        <div>
                          {canLock ? (
                            <button
                              className="primary-review-action"
                              onClick={() => onLockItem?.(item, defaultLockTarget(item))}
                              aria-label={`${itemLabel(item)}：通过并锁定为${reviewLockLabels[defaultLockTarget(item)]}`}
                            >
                              <LockKeyhole size={13} />
                              通过并锁定
                            </button>
                          ) : canApprove ? (
                            <button
                              className="primary-review-action"
                              onClick={() => onApproveItem?.(item)}
                              aria-label={`${itemLabel(item)}：通过复核`}
                            >
                              <Check size={13} />
                              通过
                            </button>
                          ) : null}
                          {canRetry && (
                            <button
                              onClick={() => item.status === "needs_review" ? onRetryItem?.(item) : (onRetryMissing?.() || onRetryItem?.(item))}
                              aria-label={`${itemLabel(item)}：重新生成`}
                            >
                              <RefreshCw size={13} />
                              重试
                            </button>
                          )}
                          {(canReject || canLock) && (
                            <details className="review-more-actions">
                              <summary>更多</summary>
                              <div>
                                {canReject && (
                                  <button
                                    onClick={() => onRejectItem?.(item)}
                                    aria-label={`${itemLabel(item)}：拒绝`}
                                  >
                                    <X size={13} />
                                    不采用
                                  </button>
                                )}
                                {canLock && canApprove && (
                                  <button
                                    onClick={() => onApproveItem?.(item)}
                                    aria-label={`${itemLabel(item)}：仅通过复核`}
                                  >
                                    <Check size={13} />
                                    仅通过
                                  </button>
                                )}
                                {canLock && reviewLockTargets.map((target) => (
                                  <button
                                    key={target}
                                    onClick={() => onLockItem?.(item, target)}
                                    aria-label={`${itemLabel(item)}：绑定为${reviewLockLabels[target]}`}
                                  >
                                    <LockKeyhole size={13} />
                                    绑定为{reviewLockLabels[target]}
                                  </button>
                                ))}
                              </div>
                            </details>
                          )}
                          {canShowPrompt && (
                            <details className="review-prompt-popover">
                              <summary>
                                <Eye size={13} />
                                查看说明
                              </summary>
                              <small>{reviewPromptSummary(item)}</small>
                            </details>
                          )}
                        </div>
                      ) : (
                        <small className="review-tray-waiting">缺参考，等生成或拖入素材后再复核。</small>
                      )}
                    </div>
                  );
                }) : (
                <div className="review-tray-empty">
                  <span>暂无待复核项</span>
                  <small>确认写入后会出现在这里。</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </details>
      </details>
    </section>
  );
}
