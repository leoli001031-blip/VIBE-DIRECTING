import { Check, Eye, LockKeyhole, RefreshCw, Send, X } from "lucide-react";
import { formatShotNumber } from "./MinimalStoryFlow";
import type { CreatorDeskProjection, CreatorFrameStatus, CreatorReviewLockTarget, CreatorReviewStatus, CreatorReviewTrayItem } from "./creatorDeskTypes";

const jimengExpectedWaitMinutes = 50;

const reviewLabels: Record<CreatorReviewStatus, string> = {
  needs_review: "待复核",
  missing: "待补齐",
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
  return normalizedLabel(value) === "ready" ? "已确认" : "待补齐";
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
  return `${projection.readyCount}/${projection.plannedCount} 张可看 · ${projection.missingCount} 张待补`;
}

function frameStatusLabel(status: CreatorFrameStatus) {
  if (status === "approved") return "已通过";
  if (status === "needs_review") return "待复核";
  if (status === "missing") return "待补齐";
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
  return normalizedLabel(value).includes("retry") ? "重试缺的" : value || "重试缺的";
}

function videoStatusClass(value: string) {
  const normalized = normalizedLabel(value);
  if (normalized === "completed") return "approved";
  if (normalized === "recoverable") return "retry";
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

function isActionMovingStatus(value: string) {
  return value === ["run", "ning"].join("");
}

function videoMetricLabel(projection: CreatorDeskProjection["videoGeneration"]) {
  const waitingCount = videoWaitingCount(projection);
  if (projection.recoverableCount > 0) return `${projection.recoverableCount} 可稍后恢复`;
  if (waitingCount > 0) return `${waitingCount} 排队中`;
  if (projection.generatingCount > 0) return `${projection.generatingCount} 生成中`;
  if (projection.submittedCount > 0) return `${projection.submittedCount} 已提交`;
  if (projection.completedCount > 0) return `${projection.completedCount} 已完成`;
  return "未生成";
}

function pendingCount(projection: CreatorDeskProjection["reviewTray"]) {
  return projection.counts.needs_review + projection.counts.missing + projection.counts.retry;
}

function nextStepLabel(projection: CreatorDeskProjection) {
  const { scriptPlanner, batchGeneration, framePlan, reviewTray, videoGeneration } = projection;
  if (!scriptPlanner.shotCount) return "先描述故事";
  if (videoGeneration.status === "recoverable") return "稍后恢复查询";
  if (videoGeneration.status === ["que", "ued"].join("") || videoGeneration.status === "generating" || videoGeneration.status === "submitted") return "等待视频";
  if (videoGeneration.status === "not_generated" && scriptPlanner.shotCount > 0 && !pendingCount(reviewTray)) return "提交视频";
  if (batchGeneration.missingCount > 0 || reviewTray.counts.missing > 0) return "补齐画面";
  if (reviewTray.counts.needs_review > 0) return "检查画面";
  if (reviewTray.counts.retry > 0) return "重试画面";
  if (videoGeneration.status === "not_generated" && scriptPlanner.shotCount > 0) return "提交视频";
  return "继续创作";
}

function summaryLine(projection: CreatorDeskProjection) {
  const { batchGeneration, reviewTray, videoGeneration } = projection;
  if (videoGeneration.status === "recoverable") return `${videoGeneration.recoverableCount || 1} 可稍后恢复`;
  if (videoGeneration.status === ["que", "ued"].join("")) return `${videoWaitingCount(videoGeneration) || 1} 个视频排队中`;
  if (videoGeneration.status === "generating") return `${videoGeneration.generatingCount || 1} 个视频生成中`;
  if (isVideoSentStatus(videoGeneration.status)) return `${videoGeneration.submittedCount || 1} 个视频已提交`;
  const parts = [
    reviewTray.counts.needs_review ? `${reviewTray.counts.needs_review} 待复核` : "",
    batchGeneration.missingCount || reviewTray.counts.missing ? `${Math.max(batchGeneration.missingCount, reviewTray.counts.missing)} 待补齐` : "",
    reviewTray.counts.retry ? `${reviewTray.counts.retry} 可重试` : "",
    videoGeneration.status !== "not_generated" ? `视频${videoGeneration.statusLabel}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "没有待处理项";
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
  const fallback = item.status === "missing" ? "等待补齐可用画面" : "等待复核";
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

export function CreatorDeskPanels({
  projection,
  onRetryMissing,
  videoSendAction,
  onSendVideo,
  onRetryItem,
  onApproveItem,
  onRejectItem,
  onLockItem,
  onSelectItem,
}: {
  projection: CreatorDeskProjection;
  videoSendAction?: {
    status: "idle" | "running" | "blocked" | "submitted" | "needs_review";
    message?: string;
    disabled?: boolean;
    ready?: boolean;
  };
  onRetryMissing?: () => void;
  onSendVideo?: () => void | Promise<void>;
  onRetryItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onApproveItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRejectItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onLockItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>;
  onSelectItem?: (item: CreatorReviewTrayItem) => void;
}) {
  const { scriptPlanner, batchGeneration, framePlan, videoGeneration, reviewTray } = projection;
  const actionableCount = pendingCount(reviewTray);
  const videoWaiting = videoWaitingCount(videoGeneration);
  const currentVideoPosition = videoPosition(videoGeneration);
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
  return (
    <section className="creator-desk-panels compact" aria-label="待处理">
      <div className="creator-desk-summary">
        <div>
          <span>待处理</span>
          <strong>{actionableCount ? `${actionableCount} 项` : "可以继续"}</strong>
          <small>{summaryLine(projection)}</small>
        </div>
        {batchGeneration.canRetryMissing ? (
          <button onClick={onRetryMissing}>
            <RefreshCw size={14} />
            {nextStepLabel(projection)}
          </button>
        ) : (
          <small className="creator-summary-next">{nextStepLabel(projection)}</small>
        )}
      </div>

      {reviewShortcutItems.length > 0 && (
        <details className="creator-review-shortcuts" aria-label="待复核快捷入口">
          <summary>
            <span>优先查看</span>
            <strong>{reviewShortcutItems.length} 项</strong>
            <small>{actionableCount > reviewShortcutItems.length ? `还有 ${actionableCount - reviewShortcutItems.length} 项在列表里` : "点开处理"}</small>
          </summary>
          <div>
            {reviewShortcutItems.map((item) => {
              const canApprove = item.status === "needs_review" && hasReviewEvidence(item) && Boolean(onApproveItem);
              const canRetry = (item.status === "needs_review" || item.status === "missing" || item.status === "retry")
                && Boolean(item.shotId)
                && Boolean(onRetryItem || onRetryMissing);
              const canLock = (item.status === "needs_review" || item.status === "approved")
                && hasReviewEvidence(item)
                && Boolean(onLockItem);
              return (
                <article key={item.id} className={`review-tray-item ${item.status}`}>
                  <button
                    type="button"
                    className="review-tray-select"
                    disabled={!item.shotId || !onSelectItem}
                    onClick={() => onSelectItem?.(item)}
                  >
                    <span>{itemLabel(item)}</span>
                    <small>{itemDetail(item)}</small>
                  </button>
                  <div>
                    {canApprove && (
                      <button onClick={() => onApproveItem?.(item)}>
                        <Check size={13} />
                        通过
                      </button>
                    )}
                    {canRetry && (
                      <button onClick={() => item.status === "needs_review" ? onRetryItem?.(item) : (onRetryMissing?.() || onRetryItem?.(item))}>
                        <RefreshCw size={13} />
                        重试
                      </button>
                    )}
                    {canLock && (
                      <button onClick={() => onLockItem?.(item, defaultLockTarget(item))}>
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

      <details className="creator-desk-details">
        <summary>更多状态</summary>
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
              <span><b>{batchGeneration.missingCount}</b> 待补</span>
            </div>
            <div className="batch-generation-actions">
              <small>{concurrencyLabel(batchGeneration.concurrencyLabel)}</small>
              <small>{safetyLabel(batchGeneration.safetyLabel)}</small>
              <button disabled={!batchGeneration.canRetryMissing} onClick={onRetryMissing}>
                <RefreshCw size={14} />
                {retryLabel(batchGeneration.retryLabel)}
              </button>
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
            <p>{videoGeneration.detail}</p>
            <div className="creator-panel-metrics">
              <span><b>{videoGeneration.completedCount}</b> 已完成</span>
              <span><b>{videoWaiting + videoGeneration.generatingCount + videoGeneration.submittedCount}</b> 进行中</span>
              <span><b>{videoGeneration.recoverableCount}</b> 可恢复</span>
            </div>
            <div className="batch-generation-actions">
              <small>{videoMetricLabel(videoGeneration)}</small>
              {videoGeneration.shortSubmitId && <small>编号 {videoGeneration.shortSubmitId}</small>}
              {currentVideoPosition !== undefined && currentVideoPosition > 0 && <small>前面约 {currentVideoPosition} 个任务</small>}
              <small>{videoGeneration.canResume ? "可稍后恢复查询" : `即梦常见约 ${jimengExpectedWaitMinutes} 分钟，可以离开后恢复查询`}</small>
              {videoSendAction && (
                <button
                  disabled={Boolean(videoSendAction.disabled) || !videoSendAction.ready || isVideoSentStatus(videoSendAction.status) || videoSendAction.status === "needs_review"}
                  onClick={onSendVideo}
                >
                  {isActionMovingStatus(videoSendAction.status) ? <RefreshCw size={14} /> : <Send size={14} />}
                  {isActionMovingStatus(videoSendAction.status) ? "提交中" : isVideoSentStatus(videoSendAction.status) ? "已提交" : "提交视频"}
                </button>
              )}
            </div>
            {videoSendAction?.message && <small className="creator-action-message">{videoSendAction.message}</small>}
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
              {reviewTray.items.length ? reviewTray.items.map((item) => (
                <div key={item.id} className={`review-tray-item ${item.status}`}>
                  <button
                    type="button"
                    className="review-tray-select"
                    disabled={!item.shotId || !onSelectItem}
                    onClick={() => onSelectItem?.(item)}
                  >
                    <span>{itemLabel(item)}</span>
                    <small>{itemDetail(item)}</small>
                  </button>
                  <div>
                    <button
                      disabled={item.status !== "needs_review" || !hasReviewEvidence(item) || !onApproveItem}
                      onClick={() => onApproveItem?.(item)}
                    >
                      <Check size={13} />
                      通过
                    </button>
                    <button
                      disabled={
                        !(item.status === "needs_review" || item.status === "missing" || item.status === "retry")
                        || !item.shotId
                        || (!onRetryItem && !onRetryMissing)
                      }
                      onClick={() => item.status === "needs_review" ? onRetryItem?.(item) : (onRetryMissing?.() || onRetryItem?.(item))}
                    >
                      <RefreshCw size={13} />
                      重试
                    </button>
                    <button
                      disabled={item.status !== "needs_review" || !onRejectItem}
                      onClick={() => onRejectItem?.(item)}
                    >
                      <X size={13} />
                      拒绝
                    </button>
                    {reviewLockTargets.map((target) => (
                      <button
                        key={target}
                        disabled={
                          !(item.status === "needs_review" || item.status === "approved")
                          || !hasReviewEvidence(item)
                          || !onLockItem
                        }
                        onClick={() => onLockItem?.(item, target)}
                      >
                        <LockKeyhole size={13} />
                        绑定为{reviewLockLabels[target]}
                      </button>
                    ))}
                    <details className="review-prompt-popover">
                      <summary>
                        <Eye size={13} />
                        查看说明
                      </summary>
                      <small>{reviewPromptSummary(item)}</small>
                    </details>
                  </div>
                </div>
              )) : (
                <div className="review-tray-empty">
                  <span>暂无待复核项</span>
                  <small>确认写入后会出现在这里。</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
