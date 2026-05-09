import { CheckCircle2, LockKeyhole, RefreshCw, Sparkles } from "lucide-react";
import "./ProjectRealChainPanel.css";
import type {
  ProjectCurrentBindingStatus,
  ProjectCurrentChoice,
  ProjectImage2BatchUiState,
  ProjectImage2OneShotStatus,
  ProjectImage2OneShotUiState,
  ProjectRealChainPreviewItem,
  ProjectRealChainUiState,
  ProjectRealChainUiStatus,
  ProjectRound5StrictEditPreflightUiState,
} from "../../core/projectRealChainStatus";

export type ProjectRealChainPanelState = ProjectRealChainUiState;
export type ProjectImage2BatchPanelState = ProjectImage2BatchUiState;
export type ProjectImage2OneShotPanelState = ProjectImage2OneShotUiState;
export type ProjectRound5StrictEditPreflightPanelState = ProjectRound5StrictEditPreflightUiState | { status: "idle"; message?: string };

function projectRealChainStatusLabel(status: ProjectRealChainUiStatus) {
  if (status === "running") return "同步中";
  if (status === "needs_review") return "需要复核";
  if (status === "preview_ready_with_review") return "预览待复核";
  if (status === "production_needs_review") return "需要复核";
  if (status === "blocked") return "有阻断";
  return "未同步";
}

function projectRound5GateLabels(summary: ProjectRealChainPanelState["summary"]) {
  const shots = summary?.round5Gate?.shotGateMatrix || [];
  const labels: string[] = [];
  const zp04 = shots.find((shot) => shot.shotId === "ZP04");
  const zp05 = shots.find((shot) => shot.shotId === "ZP05");
  const endBlocked = shots.some((shot) => {
    const gateStatus = `${shot.gateStatus || ""} ${shot.nextAction || ""}`.toLowerCase();
    return gateStatus.includes("end") && (gateStatus.includes("blocked") || gateStatus.includes("provenance"));
  });

  if (zp04?.nextAction && zp04.nextAction !== "none") labels.push("ZP04 重生 start");
  if (zp05?.gateStatus === "end_returned_needs_review") labels.push("ZP05 end 待复核");
  else if (zp05?.gateStatus === "end_edit_preflight_ready" || zp05?.nextAction === "submit_strict_image_edit") labels.push("ZP05 等待 end 回流");
  else if (zp05?.strictEditPilotCandidate) labels.push("ZP05 可做 edit pilot");
  if (endBlocked) labels.push("End 缺证据");
  return labels;
}

function projectRound5EndReturnState(summary: ProjectRealChainPanelState["summary"]) {
  const shots = summary?.round5Gate?.shotGateMatrix || [];
  const returnedShot = shots.find((shot) => (
    shot.gateStatus === "end_returned_needs_review"
    || (shot.endExists === true && Boolean(shot.endFrameSha256))
  ));
  if (returnedShot) {
    const hash = returnedShot.endFrameSha256 ? `${returnedShot.endFrameSha256.slice(0, 18)}…` : "hash-bound";
    return {
      status: "returned" as const,
      shotId: returnedShot.shotId,
      label: "End 已回流，待复核",
      detail: `${returnedShot.shotId} · ${hash}`,
    };
  }

  const waitingShot = shots.find((shot) => (
    shot.gateStatus === "end_edit_preflight_ready"
    || shot.nextAction === "submit_strict_image_edit"
    || shot.strictEditPreflightStatus === "ready_for_provider_edit"
  ));
  if (waitingShot) {
    return {
      status: "waiting" as const,
      shotId: waitingShot.shotId,
      label: "等待真实 end 回流",
      detail: `${waitingShot.shotId} · 状态同步只读，不触发 provider`,
    };
  }

  return {
    status: "none" as const,
    shotId: undefined,
    label: "未到回流阶段",
    detail: "等待 strict edit preflight",
  };
}

function projectRound5StrictEditTargetShotId(summary: ProjectRealChainPanelState["summary"], selectedShotId: string) {
  const shots = summary?.round5Gate?.shotGateMatrix || [];
  const zp05 = shots.find((shot) => shot.shotId === "ZP05");
  if (zp05?.strictEditPilotCandidate) return zp05.shotId;
  const selected = shots.find((shot) => shot.shotId === selectedShotId);
  return selected?.strictEditPilotCandidate ? selected.shotId : selectedShotId;
}

function projectRound5StrictEditLabel(state: ProjectRound5StrictEditPreflightPanelState) {
  if (state.status === "running") return "准备中";
  if (state.status === "prepared") return "已准备";
  if (state.status === "blocked") return "准备失败";
  return "可准备";
}

function projectRealChainVisibleItems(
  items: ProjectRealChainPreviewItem[],
  selectedShotId: string,
) {
  const withImage = items.filter((item) => item.outputExists !== false && (item.imageUrl || item.thumbnailUrl));
  const selected = withImage.find((item) => item.shotId === selectedShotId);
  if (selected) return [selected];
  return withImage.slice(0, 4);
}

function projectReviewCheckStatusLabel(state: ProjectImage2BatchPanelState) {
  if (state.status === "running") return "同步中";
  if (state.status === "ready_for_review") return "可复核";
  if (state.status === "blocked") return "待补齐";
  return "未同步";
}

function projectReviewCheckDetail(summary: ProjectImage2BatchPanelState["summary"]) {
  if (!summary) return "等待当前项目同步";
  return `${summary.readyCount}/${summary.plannedCount} 可复核 · ${summary.blockedCount} 待补齐`;
}

function projectPreviewReadyLabel(summary: ProjectRealChainPanelState["summary"]) {
  const status = `${summary?.previewStatus || ""} ${summary?.previewStatusLabel || ""}`.toLowerCase();
  if (status.includes("blocked")) return "blocked";
  return status.includes("ready") ? "ready" : "not_ready";
}

function projectProductionReviewLabel(summary: ProjectRealChainPanelState["summary"]) {
  if (summary?.productionStatus === "blocked") return "blocked";
  return summary?.productionStatus === "needs_review" ? "needs_review" : "clear";
}

function shortEvidenceToken(value?: string) {
  if (!value) return "未观察";
  if (value.startsWith("sha256:")) return `${value.slice(0, 15)}...`;
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function shortAuthorizationRef(value?: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "未填写";
  const tail = trimmed.split(/[/:]+/).filter(Boolean).at(-1) || trimmed;
  return tail.length > 12 ? `${tail.slice(0, 12)}...` : tail;
}

function projectPermissionReceiptLabel(summary?: ProjectImage2OneShotStatus) {
  if (summary?.submitPermissionReceiptPresent) {
    const state = summary.submitPermissionReceipt?.status === "pending_action_time_confirmation"
      ? "待动作确认"
      : summary.submitPermissionReceipt?.status === "blocked"
        ? "待补齐"
        : "已准备";
    return {
      label: `授权票据 ${state}`,
      tone: state === "待补齐" ? "blocked" : "ready",
    };
  }
  if (summary?.submitPermissionReceiptRequested || (summary?.permissionBlockers?.length || 0) > 0) {
    return {
      label: "授权票据 待补齐",
      tone: "blocked",
    };
  }
  return {
    label: "授权票据 未准备",
    tone: "idle",
  };
}

function projectOneShotEvidence(summary?: ProjectImage2OneShotStatus) {
  if (!summary) {
    return {
      label: "未同步",
      detail: "等待 handoff 准备",
    };
  }
  if (summary.uiStatus === "needs_review" || summary.hashBoundActual) {
    return {
      label: "已 hash-bound 回流，QA needs_review，正式晋级阻断",
      detail: `请求票据 ${shortEvidenceToken(summary.providerRequestId)} · output ${shortEvidenceToken(summary.outputSha256)}`,
    };
  }
  if (summary.uiStatus === "handoff_prepared" || summary.uiStatus === "trigger_plan_prepared" || summary.uiStatus === "waiting_file") {
    return {
      label: "等待外部输出 + 请求票据 + semantic QA",
      detail: summary.returnSource === "unavailable" ? "尚未观察真实回流" : `回流来源 ${summary.returnSource}`,
    };
  }
  if (summary.uiStatus === "prepared") {
    return {
      label: "仅生成 handoff/sidecar 路径，不发起外部调用",
      detail: summary.receipt?.receiptId ? `receipt ${shortEvidenceToken(summary.receipt.receiptId)}` : "等待确认 handoff",
    };
  }
  return {
    label: "仅生成 handoff/sidecar 路径，不发起外部调用",
    detail: summary.selectedShotId ? `镜头 ${summary.selectedShotId}` : "选择镜头后开始",
  };
}

export function ProjectRealChainPanel({
  state,
  image2BatchState,
  image2OneShotState,
  strictEditPreflightState,
  selectedShotId,
  projectTitle,
  runtimeProjectBinding,
  projectPathInput,
  projectChoices,
  projectSelectionStatus,
  authorizationRef,
  onProjectPathChange,
  onSelectProjectChoice,
  onConnectProject,
  onRun,
  onRunImage2Batch,
  onPrepareStrictEditPreflight,
  onPrepareImage2OneShot,
  onAuthorizationRefChange,
  onPrepareImage2OneShotPermissionReceipt,
  onConfirmImage2OneShot,
  onCheckImage2OneShotReturn,
}: {
  state: ProjectRealChainPanelState;
  image2BatchState: ProjectImage2BatchPanelState;
  image2OneShotState: ProjectImage2OneShotPanelState;
  strictEditPreflightState: ProjectRound5StrictEditPreflightPanelState;
  selectedShotId: string;
  projectTitle: string;
  runtimeProjectBinding: ProjectCurrentBindingStatus;
  projectPathInput: string;
  projectChoices: ProjectCurrentChoice[];
  projectSelectionStatus?: "idle" | "connecting" | "connected" | "error";
  authorizationRef: string;
  onProjectPathChange: (value: string) => void;
  onSelectProjectChoice: (choice: ProjectCurrentChoice) => void;
  onConnectProject: () => void;
  onRun: () => void;
  onRunImage2Batch: () => void;
  onPrepareStrictEditPreflight: (shotId: string) => void;
  onPrepareImage2OneShot: () => void;
  onAuthorizationRefChange: (value: string) => void;
  onPrepareImage2OneShotPermissionReceipt: () => void;
  onConfirmImage2OneShot: () => void;
  onCheckImage2OneShotReturn: () => void;
}) {
  const projectBound = runtimeProjectBinding.status === "bound";
  const summary = projectBound ? state.summary : undefined;
  const image2Batch = projectBound ? image2BatchState.summary : undefined;
  const running = state.status === "running";
  const image2BatchRunning = image2BatchState.status === "running";
  const status = projectBound ? projectRealChainStatusLabel(state.status) : "未同步";
  const reviewCheckStatus = projectBound ? projectReviewCheckStatusLabel(image2BatchState) : "未同步";
  const reviewCheckDetail = projectReviewCheckDetail(image2Batch);
  const returnedCount = summary?.returnedImageCount ?? 0;
  const plannedCount = summary?.totalPlannedImages ?? 0;
  const visibleItems = summary ? projectRealChainVisibleItems(summary.previewItems, selectedShotId) : [];
  const round5GateLabels = projectRound5GateLabels(summary);
  const strictEditTargetShotId = projectRound5StrictEditTargetShotId(summary, selectedShotId);
  const zp05Gate = summary?.round5Gate?.shotGateMatrix.find((shot) => shot.shotId === "ZP05");
  const round5EndReturn = projectRound5EndReturnState(summary);
  const showStrictEditPreflight = projectBound
    && zp05Gate?.strictEditPilotCandidate === true
    && round5EndReturn.status === "none"
    && zp05Gate.gateStatus !== "end_edit_preflight_ready";
  const showRound5EndReturn = projectBound && round5EndReturn.status !== "none";
  const strictEditRunning = strictEditPreflightState.status === "running";
  const strictEditLabel = projectRound5StrictEditLabel(strictEditPreflightState);
  const previewLabel = projectPreviewReadyLabel(summary);
  const productionLabel = projectProductionReviewLabel(summary);
  const displayTitle = projectBound
    ? runtimeProjectBinding.projectTitle || projectTitle || "未命名项目"
    : "未选择项目";
  const disabled = !projectBound || running;
  const reviewDisabled = !projectBound || image2BatchRunning;
  const sampleReady = image2OneShotState.status === "prepared";
  const sampleWaiting = image2OneShotState.status === "handoff_prepared" || image2OneShotState.status === "trigger_plan_prepared" || image2OneShotState.status === "waiting_file";
  const sampleReview = image2OneShotState.status === "needs_review";
  const sampleRunning = image2OneShotState.status === "running";
  const sampleBlocked = image2OneShotState.status === "blocked";
  const sampleDisabled = !projectBound || sampleRunning || sampleReview;
  const sampleAction = sampleReady ? onConfirmImage2OneShot : sampleWaiting ? onCheckImage2OneShotReturn : onPrepareImage2OneShot;
  const sampleButtonLabel = sampleWaiting
    ? "检查回流"
    : sampleReview
      ? "需要复核"
      : sampleReady
        ? "确认 handoff"
        : "准备小样包";
  const sampleStatusLabel = sampleReview ? "需要复核" : image2OneShotState.status === "trigger_plan_prepared" ? "等待回流" : sampleWaiting ? "等待文件" : sampleReady ? "待确认" : sampleBlocked ? "待补齐" : "可开始";
  const sampleEvidence = projectOneShotEvidence(image2OneShotState.summary);
  const permissionLabel = projectPermissionReceiptLabel(image2OneShotState.summary);
  const permissionBaseReady = Boolean(image2OneShotState.receipt || image2OneShotState.summary?.receipt)
    && sampleWaiting
    && !sampleRunning
    && !sampleReview;
  const permissionDisabled = !projectBound || !permissionBaseReady || !authorizationRef.trim();
  const connecting = projectSelectionStatus === "connecting";
  const canConnect = projectPathInput.trim().length > 0 && !connecting;

  return (
    <section className={`project-real-chain-panel ${state.status}`} aria-label="当前项目状态">
      <div className="project-real-chain-head">
        <div>
          <span>当前项目</span>
          <strong>{displayTitle}</strong>
        </div>
        <button disabled={disabled} onClick={onRun}>
          <RefreshCw size={15} />
          {running ? "同步中" : "同步状态"}
        </button>
      </div>
      <div className="project-real-chain-select">
        <label htmlFor="current-project-path">项目路径</label>
        <input
          id="current-project-path"
          value={projectPathInput}
          onChange={(event) => onProjectPathChange(event.target.value)}
          placeholder="输入项目路径"
        />
        <button disabled={!canConnect} onClick={onConnectProject}>
          <CheckCircle2 size={14} />
          {connecting ? "连接中" : "连接项目"}
        </button>
      </div>
      {projectChoices.length > 0 && (
        <div className="project-real-chain-recent" aria-label="最近项目">
          <span>最近项目</span>
          {projectChoices.slice(0, 3).map((choice) => (
            <button
              key={choice.projectRoot}
              disabled={connecting}
              onClick={() => onSelectProjectChoice(choice)}
              title={choice.projectRoot}
            >
              {choice.displayName}
            </button>
          ))}
        </div>
      )}
      <div className="project-real-chain-tags">
        <small>项目状态 {status}</small>
        <small>已观察输出 {returnedCount}/{plannedCount} 张</small>
        <small>{summary?.needsReviewCount ?? 0} 张需复核</small>
        <small>Preview {previewLabel}</small>
        <small>Production {productionLabel}</small>
      </div>
      {round5GateLabels.length > 0 && (
        <div className="project-real-chain-gates" aria-label="Round 5 gate 摘要">
          {round5GateLabels.map((label) => (
            <small key={label}>{label}</small>
          ))}
        </div>
      )}
      {showStrictEditPreflight && (
        <div className="project-real-chain-policy" aria-label="Round 5 strict edit preflight">
          <small>ZP05 strict edit · {strictEditLabel}</small>
          <button
            disabled={strictEditRunning}
            onClick={() => onPrepareStrictEditPreflight(strictEditTargetShotId)}
          >
            <Sparkles size={14} />
            {strictEditRunning ? "准备中" : "准备 edit 证据"}
          </button>
        </div>
      )}
      {showRound5EndReturn && (
        <div className={`project-real-chain-policy round5-end-return ${round5EndReturn.status}`} aria-label="Round 5 strict edit return status">
          <small>Round 5 end · {round5EndReturn.label}</small>
          <small>{round5EndReturn.detail}</small>
          <button disabled={running} onClick={onRun}>
            <RefreshCw size={14} />
            {running ? "同步中" : "刷新回流"}
          </button>
        </div>
      )}
      <div className="project-real-chain-batch">
        <div>
          <span>本地复核</span>
          <strong>{reviewCheckStatus}</strong>
          <small>{reviewCheckDetail}</small>
        </div>
        <button disabled={reviewDisabled} onClick={onRunImage2Batch}>
          <RefreshCw size={14} />
          {image2BatchRunning ? "检查中" : "复核检查"}
        </button>
      </div>
      <div className="project-real-chain-one-shot">
        <div>
          <span>单镜头小样</span>
          <strong>{sampleStatusLabel}</strong>
          <small>{image2OneShotState.status === "trigger_plan_prepared" ? "已准备外部执行 handoff，等待回流确认" : selectedShotId ? `镜头 ${selectedShotId}` : "选择镜头后开始"}</small>
        </div>
        <button
          disabled={sampleDisabled && !sampleWaiting}
          onClick={sampleAction}
        >
          {sampleReady ? <CheckCircle2 size={14} /> : <Sparkles size={14} />}
          {sampleRunning ? "准备中" : sampleButtonLabel}
        </button>
      </div>
      <div className={`project-real-chain-evidence ${image2OneShotState.status}`} aria-label="one-shot evidence">
        <small>{sampleEvidence.label}</small>
        <small>{sampleEvidence.detail}</small>
      </div>
      <div className={`project-real-chain-permission ${permissionLabel.tone}`} aria-label="授权票据">
        <div>
          <small>{permissionLabel.label}</small>
          <small>授权引用 {shortAuthorizationRef(authorizationRef)} · 仅记录意图 · 不读取密钥、不发起调用</small>
        </div>
        <label htmlFor="image2-one-shot-authorization-ref">授权引用</label>
        <input
          id="image2-one-shot-authorization-ref"
          type="password"
          value={authorizationRef}
          onChange={(event) => onAuthorizationRefChange(event.target.value)}
          placeholder="授权引用"
          autoComplete="off"
        />
        <button
          disabled={permissionDisabled}
          onClick={onPrepareImage2OneShotPermissionReceipt}
        >
          <LockKeyhole size={14} />
          {sampleRunning ? "准备中" : "准备授权票据"}
        </button>
      </div>
      {visibleItems.length > 0 && (
        <div className="project-real-chain-thumbs" aria-label="当前项目预览图">
          {visibleItems.map((item) => (
            <figure key={item.shotId} className={item.reviewRequired ? "review-overlay" : undefined}>
              <img src={item.thumbnailUrl || item.imageUrl} alt={`${item.shotId} preview`} />
              <figcaption>
                <span>{item.shotId}</span>
                {item.reviewRequired && <small>需复核</small>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <small className="project-real-chain-report">
        {displayTitle} · {summary ? "runtime 状态已同步" : "未同步"}
      </small>
      <div className="project-real-chain-messages">
        {!projectBound && <small className="project-real-chain-message">未选择项目/未同步</small>}
        {state.message && <small className="project-real-chain-message">{state.message}</small>}
        {image2BatchState.message && <small className="project-real-chain-message">{image2BatchState.message}</small>}
        {image2OneShotState.message && <small className="project-real-chain-message">{image2OneShotState.message}</small>}
        {strictEditPreflightState.message && <small className="project-real-chain-message">{strictEditPreflightState.message}</small>}
      </div>
    </section>
  );
}
