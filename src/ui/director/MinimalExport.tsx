import { Box, Download, FileArchive, FileText, Film } from "lucide-react";
import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
import type { AudioPlanningState, ProjectPreviewExportState } from "../../core/types";
import type { AgentControlledToolInvocationTarget } from "./agentPanelProjection";

function kindIcon(kind: string) {
  if (kind === "asset_package") return Box;
  if (kind === "developer_archive") return FileArchive;
  if (kind === "storyboard_table") return FileText;
  return Film;
}

function kindLabel(kind: string): string {
  if (kind === "asset_package") return "素材包";
  if (kind === "developer_archive") return "确认结果";
  if (kind === "storyboard_table") return "分镜表";
  if (kind === "rough_cut_timeline") return "粗剪时间线";
  return "导出项目";
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    audio_plan: "音频设计",
    bgm_export_plan: "配乐计划",
    blocked_placeholders_when_draft: "缺少画面",
    duration: "时长",
    gate_summary: "确认摘要",
    generation_health: "制作检查",
    image_holds: "静帧画面",
    keyframes: "关键帧",
    manifest_matches: "素材清单",
    media_status: "素材状态",
    missing_placeholders_when_draft: "缺少画面",
    preview_event_refs: "预览段落",
    preview_timeline: "预览时间线",
    project_facts_snapshot: "项目快照",
    prompt_qa_trace: "创作检查",
    prompt_request_previews: "创作过程",
    prompts: "创作过程",
    qa_promotion: "确认结论",
    qa_reports: "确认结果",
    reference_assets: "参考素材",
    rough_cut_proxy_plan: "粗剪草案",
    selected_keyframes: "选中关键帧",
    shot_order: "镜头顺序",
    story_function: "故事功能",
    storyboard_table: "分镜表",
    task_outputs: "输出素材",
    task_runs: "制作过程",
    video_clips: "视频片段",
    videos: "视频素材",
  };
  return labels[category] || "其他内容";
}

function categorySummary(categories: string[]) {
  const labels = Array.from(new Set(categories.map(categoryLabel)));
  const visible = labels.slice(0, 4);
  const overflow = labels.length - visible.length;
  return overflow > 0 ? `${visible.join("、")}等 ${labels.length} 类` : visible.join("、");
}

function blockerLabel(reason: string) {
  if (/No preview media paths/i.test(reason)) return "还没有可用于粗剪的预览素材。";
  if (/No asset or task output paths/i.test(reason)) return "还没有可打包的素材。";
  if (/No assets are available/i.test(reason)) return "还没有可打包的素材。";
  if (/No shots are available/i.test(reason)) return "还没有可打包的镜头。";
  if (/No prompt, task output, or QA paths/i.test(reason)) return "还没有可归档的制作结果。";
  if (/manifestMatched|manifest match/i.test(reason)) return "素材清单还未核对完成。";
  if (/pairQaPass|pair QA/i.test(reason)) return "关键画面对齐还需确认。";
  if (/videoPresent|video output path|video task run/i.test(reason)) return "视频结果还没出来或还没确认。";
  if (/Formal preview check failed/i.test(reason)) return "正式预览还有检查未完成。";
  return "还有制作检查未完成。";
}

function uniqueBlockerLabels(reasons: string[], limit = 5) {
  return Array.from(new Set(reasons.map(blockerLabel))).slice(0, limit);
}

function targetLabel(target: string) {
  const labels: Record<string, string> = {
    davinci_resolve_folder_slot: "DaVinci 文件夹",
    edl_future_slot: "EDL",
    fcpxml_future_slot: "FCPXML",
    jianying_folder_slot: "剪映文件夹",
    premiere_pro_xml_slot: "Premiere XML",
  };
  return labels[target] || "后续接口";
}

function futureTargetSummary(targets?: string[]) {
  const labels = Array.from(new Set((targets || []).map(targetLabel).filter((label) => label !== "后续接口")));
  if (!labels.length) return "";
  return labels.join("、");
}

function exportProfileFutureTargetCopy(profile: ProjectPreviewExportState["exportProfiles"][number]) {
  const futureTargets = futureTargetSummary(profile.futureTargets);
  if (!futureTargets || profile.readiness !== "ready") return "";
  return `可交接给：${futureTargets}`;
}

function isChecklistExportLabel(label?: string) {
  return /清[\s\S]{0,4}单|checklist|manifest/i.test(label || "");
}

function packageContentSummary(exportWorker?: ExportWorkerState) {
  if (!exportWorker) return "等待项目内容同步";
  const videoResultLabel = exportWorker.manifest.mvpPackage.videoResultCount
    ? exportWorker.manifest.mvpPackage.videoMissingCount > 0 ? "视频素材" : "视频结果"
    : "";
  const parts = [
    exportWorker.manifest.mvpPackage.projectVibeIncluded ? "项目文件" : "",
    exportWorker.manifest.mvpPackage.lockedAssetCount ? "锁定素材" : "",
    exportWorker.manifest.mvpPackage.knowledgeReferenceCount ? "本片参考" : "",
    exportWorker.manifest.mvpPackage.previewMediaCount ? "预览媒体" : "",
    videoResultLabel,
    exportWorker.manifest.mvpPackage.receiptCount ? "确认结果" : "",
    exportWorker.manifest.mvpPackage.reportIncluded ? "制作报告" : "",
  ].filter(Boolean);
  return parts.length ? parts.join("、") : "等待项目内容同步";
}

function videoReviewSummary(exportWorker?: ExportWorkerState) {
  if (!exportWorker?.manifest.mvpPackage.videoResultCount) return "";
  const review = exportWorker.manifest.mvpPackage.videoNeedsReviewCount;
  const approved = exportWorker.manifest.mvpPackage.videoApprovedCount;
  const missing = exportWorker.manifest.mvpPackage.videoMissingCount;
  const packageScope = review > 0 || missing > 0 ? "本轮只准备本地资料包" : "视频素材已确认";
  return `${review} 待确认 · ${approved} 已通过 · ${missing} 缺失；${packageScope}`;
}

function exportReadyDetail(exportWorker: ExportWorkerState | undefined, plannedFiles: number) {
  if (!exportWorker) return "等待项目内容同步";
  const missing = exportWorker.manifest.mvpPackage.videoMissingCount;
  const needsReview = exportWorker.manifest.mvpPackage.videoNeedsReviewCount;
  if (missing > 0) return `${plannedFiles} 个文件 · 视频还在回流，先打包项目文件、参考和制作报告`;
  if (needsReview > 0) return `${plannedFiles} 个文件 · 视频需要复核，确认后再导出最终成片`;
  return `${plannedFiles} 个文件 · ${packageContentSummary(exportWorker)}`;
}

function exportActionVisibleLabel(action: ExportActionState | undefined, checklistExport: boolean, fallbackLabel: string) {
  if (!action || action.status === "idle") return fallbackLabel;
  if (checklistExport && action.status === "ready") return "交付清单已生成";
  return action.label;
}

function exportActionVisibleDetail(action: ExportActionState | undefined, checklistExport: boolean, packageGeneratedLabel: string) {
  if (!action) return "";
  if (action.status === "blocked" || action.status === "failed") return "先处理待确认内容。";
  if (checklistExport) return `${action.executedCount || 0} 步完成 · 清单已整理好`;
  return `${action.executedCount || 0} 步完成 · ${packageGeneratedLabel}`;
}

function exportProfileFileSummary(profile: ProjectPreviewExportState["exportProfiles"][number], plannedFiles: number) {
  if (profile.kind === "asset_package" && profile.readiness === "ready" && !profile.includedPaths.length && plannedFiles > 0) {
    return `${plannedFiles} 个文件`;
  }
  if (profile.kind === "developer_archive" && profile.readiness !== "ready" && !profile.includedPaths.length) {
    return "等待制作结果";
  }
  if (profile.readiness === "ready" && !profile.includedPaths.length) {
    return "确认后生成文件";
  }
  return `${profile.includedPaths.length} 个文件`;
}

export function MinimalExport({
  previewExport,
  audioPlanning,
  exportWorker,
  exportAction,
  localProjectReady = true,
  pendingConfirmationLabel,
  onRunExport,
}: {
  previewExport: ProjectPreviewExportState;
  audioPlanning: AudioPlanningState;
  exportWorker?: ExportWorkerState;
  exportAction?: ExportActionState;
  localProjectReady?: boolean;
  pendingConfirmationLabel?: string;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace">) => unknown | Promise<unknown>;
}) {
  const profiles = previewExport.exportProfiles;
	  const gate = previewExport.formalPreviewGate;
	  const hasEvents = previewExport.draftPreview.events.length > 0;
  const plannedFiles = exportWorker?.manifest.files.length || 0;
  const readyProfiles = profiles.filter((profile) => profile.readiness === "ready").length;
  const blockedProfiles = profiles.length - readyProfiles;
  const exportBlockedByAgentConfirmation = Boolean(pendingConfirmationLabel);
  const canPrepareExport = Boolean(onRunExport)
    && !exportBlockedByAgentConfirmation
    && exportAction?.status !== "running"
    && Boolean(exportWorker?.manifest.mvpPackage.reportIncluded)
    && readyProfiles > 0;
  const canExport = false;
  const videoSummary = videoReviewSummary(exportWorker);
  const checklistExport = isChecklistExportLabel(exportAction?.label);
  const finalVideoPending = Boolean((exportWorker?.manifest.mvpPackage.videoMissingCount || 0) > 0
    || (exportWorker?.manifest.mvpPackage.videoNeedsReviewCount || 0) > 0);
  const packageLabel = finalVideoPending ? "项目资料包" : "交付包";
  const packageGeneratedLabel = finalVideoPending ? "资料包已生成" : "交付包已生成";
  const videoSummaryLabel = finalVideoPending ? "视频素材" : "视频结果";
  const readyProfileLabel = "可打包资料";
  const blockedProfileLabel = canPrepareExport ? "后续可补" : "待处理";
  const exportPackageReady = exportAction?.status === "ready" || /已生成/.test(exportAction?.label || "");
  const exportPackageReadyLabel = checklistExport ? "交付清单已生成" : packageGeneratedLabel;
  const exportActionLabel = exportActionVisibleLabel(exportAction, checklistExport, packageGeneratedLabel);
  const exportActionDetail = exportActionVisibleDetail(exportAction, checklistExport, packageGeneratedLabel);
  const exportReadyLabel = exportAction?.status === "ready"
    ? checklistExport ? "清单已生成" : "已生成包"
    : canPrepareExport ? `待确认${packageLabel}` : "未就绪";
  const gateBlockerLabels = uniqueBlockerLabels(gate.blockedReasons);

  if (!localProjectReady) {
    return (
      <section className="minimal-export">
        <div className="export-head">
          <div>
            <span>交付准备</span>
            <h3>项目资料包</h3>
          </div>
          <span className="export-gate-status" data-status="blocked">
            先选择保存位置
          </span>
        </div>
        <div className="export-action-row">
          <button className="export-run-button" disabled>
            <Download size={16} aria-hidden="true" />
            <span>生成资料包</span>
          </button>
          <small className="muted-copy">选择保存位置后，这里会整理交付文件。</small>
        </div>
        <div className="export-summary-strip" aria-label="资料包摘要">
          <span><strong>0</strong><small>文件</small></span>
          <span><strong>0</strong><small>可打包资料</small></span>
          <span><strong>0</strong><small>待复核</small></span>
          <span><strong>0</strong><small>本片参考</small></span>
          <span><strong>0</strong><small>声音参考</small></span>
        </div>
        <p className="empty-state">先选择保存位置。交付包会包含项目文件、锁定素材、预览和报告。</p>
      </section>
    );
  }

  return (
    <section className="minimal-export">
      <div className="export-head">
        <div>
          <span>交付准备</span>
          <h3>{packageLabel}</h3>
        </div>
        <span className="export-gate-status" data-status={exportAction?.status === "ready" ? "pass" : gate.status}>
          {exportBlockedByAgentConfirmation ? "先处理确认" : exportReadyLabel}
        </span>
      </div>
      <div className="export-action-row">
        <button className="export-run-button" disabled title={canPrepareExport ? "先在右侧 AI 导演消息里确认，确认后才会写入导出文件。" : undefined}>
          <Download size={16} aria-hidden="true" />
          <span>{exportAction?.status === "running" ? "正在生成" : exportPackageReady ? packageGeneratedLabel : canPrepareExport ? `去右侧确认${packageLabel}` : `生成${packageLabel}`}</span>
        </button>
        <small className="muted-copy">
          {exportBlockedByAgentConfirmation
            ? `先处理右侧消息里的「${pendingConfirmationLabel}」，确认前不会导出文件。`
            : canPrepareExport
              ? `右侧消息里确认后，才会写入 ${exportWorker?.exportRoot || "exports"}。`
            : plannedFiles ? `${plannedFiles} 个文件 · ${packageContentSummary(exportWorker)} · ${exportWorker?.exportRoot || "exports"}` : "等待项目内容同步"}
        </small>
      </div>
	      <div className="export-summary-strip" aria-label="资料包摘要">
        <span><strong>{plannedFiles}</strong><small>文件</small></span>
        <span><strong>{readyProfiles}</strong><small>{readyProfileLabel}</small></span>
        <span><strong>{blockedProfiles}</strong><small>{blockedProfileLabel}</small></span>
        <span><strong>{exportWorker?.manifest.mvpPackage.knowledgeReferenceCount || 0}</strong><small>本片参考</small></span>
	        <span><strong>{audioPlanning.shotPlans.length}</strong><small>声音参考</small></span>
	      </div>
	      {videoSummary && (
	        <small className="muted-copy">
          {videoSummaryLabel}：{videoSummary}
	        </small>
	      )}
      {exportAction && exportAction.status !== "idle" && (
        <div className={`export-action-status ${exportAction.status}`}>
          <strong>{exportActionLabel}</strong>
          <small className="muted-copy">
            {exportActionDetail}
          </small>
        </div>
      )}

      {!hasEvents && (
        <p className="empty-state">还没有预览素材。先准备故事和参考。</p>
      )}

      <section className={`export-primary-summary ${canExport ? "ready" : "blocked"}`} aria-label="当前导出状态">
        <div>
          <strong>{exportPackageReady ? exportPackageReadyLabel : canPrepareExport ? `等待你确认生成${packageLabel}` : "资料包还没准备好"}</strong>
          <small className="muted-copy">
            {canPrepareExport
              ? "右侧 AI 导演会说明写入文件范围，确认前不会导出文件。"
              : gate.blockedReasons.length ? blockerLabel(gate.blockedReasons[0]) : "等待项目内容同步"}
          </small>
        </div>
      </section>

      <details className="export-detail-disclosure">
        <summary>
          <span>查看本地包明细</span>
          <small>{readyProfiles} 个{readyProfileLabel} · {blockedProfiles} 个{blockedProfileLabel}</small>
        </summary>
        <div className="export-profile-list">
          {profiles.map((profile) => {
            const Icon = kindIcon(profile.kind);
            const ready = profile.readiness === "ready";
            const futureTargetCopy = exportProfileFutureTargetCopy(profile);
            const profileBlockerLabels = uniqueBlockerLabels(profile.blockedReasons, 3);
            const displayedProfileFileSummary = exportProfileFileSummary(profile, plannedFiles);

            return (
              <div key={profile.profileId} className={`export-profile ${ready ? "ready" : "blocked"}`}>
                <div className="export-profile-head">
                  <Icon size={16} />
                  <strong>{kindLabel(profile.kind)}</strong>
                  <span className={`status-label ${ready ? "ready" : "blocked"}`}>
                    {ready ? readyProfileLabel : blockedProfileLabel}
                  </span>
                </div>
                <small className="muted-copy">
                  {displayedProfileFileSummary} · {categorySummary(profile.includedCategories)}
                </small>
                {profileBlockerLabels.length > 0 && (
                  <ul className="export-blockers">
                    {profileBlockerLabels.map((label, i) => (
                      <li key={`${profile.profileId}-${i}`} className="muted-copy">{label}</li>
                    ))}
                  </ul>
                )}
                {futureTargetCopy && (
                  <small className="muted-copy">
                    {futureTargetCopy}
                  </small>
                )}
              </div>
            );
          })}
        </div>
      </details>

      {!canExport && gateBlockerLabels.length > 0 && (
        <div className="export-gate-blockers">
          <small className="muted-copy">正式预览还需复核：</small>
          {gateBlockerLabels.map((label, i) => (
            <small key={`gate-blocker-${i}`} className="muted-copy">{label}</small>
          ))}
        </div>
      )}

      <div className="export-audio-summary">
        <small className="muted-copy">
          声音计划：{audioPlanning.shotPlans.length} 个镜头 · 声音参考随视频模型使用，配乐留到后期
        </small>
      </div>
    </section>
  );
}
