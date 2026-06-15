import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { DirectorView } from "../director/directorTypes";

type ActionStatus = "idle" | "running" | "blocked" | "needs_review" | "verified" | "submitted" | "failed" | "ready";

type ReferenceActionState = {
  status: ActionStatus;
  message?: string;
  disabled?: boolean;
};

type VideoActionState = {
  status: ActionStatus;
  message?: string;
  ready?: boolean;
  canResume?: boolean;
  suggestedActionLabel?: string;
};

type CreatorVideoStageState = "not_submitted" | "in_progress" | "recoverable" | "needs_review" | "completed" | "failed";

type CreatorVideoStageLike = {
  status: CreatorVideoStageState;
  reviewCount?: number;
  canResume?: boolean;
  generation?: {
    statusLabel?: string;
    detail?: string;
    queueSummary?: string;
    completedCount?: number;
    failedCount?: number;
    canResume?: boolean;
    taskFacts?: Array<{
      label: string;
      value: string;
      tone?: "neutral" | "active" | "success" | "warning" | "danger";
    }>;
  };
};

type CreatorAgentStageLike = {
  summary?: string;
  detail?: string;
};

type CreatorAgentCommandLike = {
  kind?: string;
  label?: string;
  summary?: string;
  detail?: string;
};

type NewVideoEntryStatusLike = {
  status: "empty" | "drafting" | "planning" | "ready" | "blocked" | "confirmed";
  title: string;
  detail: string;
  nextAction: string;
  draftShotCount?: number;
  draftReferenceCount?: number;
};

export type ProjectStatusTone = "ready" | "working" | "waiting" | "blocked";

export interface ProjectStatusViewModel {
  stage: string;
  doing: string;
  waitingFor: string;
  nextAction: string;
  tone: ProjectStatusTone;
  issue?: string;
  facts: Array<{ label: string; value: string }>;
}

export interface ProjectStatusViewModelInput {
  runtimeState: ProjectRuntimeState;
  folderReady: boolean;
  projectReady: boolean;
  localProjectBusy?: boolean;
  directorView: DirectorView;
  referenceGenerationAction?: ReferenceActionState;
  endFrameAction?: ReferenceActionState;
  videoSendAction?: VideoActionState;
  videoStage?: CreatorVideoStageLike;
  agentStage?: CreatorAgentStageLike;
  agentCommand?: CreatorAgentCommandLike;
  newVideoStatus?: NewVideoEntryStatusLike;
  exportAction?: ExportActionState;
  exportWorker?: ExportWorkerState;
}

function countLabel(count: number, unit: string) {
  return `${Math.max(0, count)} ${unit}`;
}

function compactPath(value?: string) {
  const clean = value?.trim();
  if (!clean) return "未选择";
  const parts = clean.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return clean;
  return `.../${parts.slice(-2).join("/")}`;
}

function sectionName(view: DirectorView) {
  if (view === "assets") return "参考";
  if (view === "preview") return "预览";
  if (view === "export") return "交付";
  return "故事";
}

function actionMessage(action?: { message?: string }, fallback = "") {
  return action?.message?.trim() || fallback;
}

function videoStageFactLabel(stage: CreatorVideoStageLike) {
  const generation = stage.generation;
  const summary = generation?.queueSummary?.trim() || generation?.statusLabel?.trim();
  if (summary) return summary;
  if (stage.status === "in_progress") return "视频生成中";
  if (stage.status === "recoverable") return "可查询结果";
  if (stage.status === "needs_review") return `${stage.reviewCount || 1} 段待复核`;
  if (stage.status === "completed") return "视频结果已出";
  if (stage.status === "failed") return "有失败段";
  return "";
}

function videoTaskFactsForStatus(stage?: CreatorVideoStageLike): Array<{ label: string; value: string }> {
  const sourceFacts = stage?.generation?.taskFacts || [];
  if (!stage || !sourceFacts.length) return [];
  const priority = stage.status === "failed"
    ? ["当前段", "失败原因", "下一步", "提交号"]
    : stage.status === "completed" || stage.status === "needs_review"
      ? ["当前段", "输出", "下一步", "提交号"]
      : ["当前段", "提交号", "下一步"];
  return priority
    .map((label) => sourceFacts.find((fact) => fact.label === label))
    .filter((fact): fact is { label: string; value: string } => Boolean(fact?.value?.trim()))
    .slice(0, 4)
    .map((fact) => ({ label: fact.label, value: fact.value }));
}

function exportActionMessage(action?: ExportActionState, fallback = "") {
  return action?.detail?.trim() || action?.label?.trim() || fallback;
}

function audioFactLabel(runtimeState: ProjectRuntimeState) {
  const audioPlanning = runtimeState.audioPlanning;
  if (!audioPlanning) return "";
  const voiceReferenceAssets = runtimeState.visualMemory.assets.filter((asset) => asset.roleBinding?.role === "voice_reference" || asset.roleBinding?.role === "audio_reference");
  const dialogueShotCount = audioPlanning.shotPlans.filter((plan) => plan.dialogueLines.length || plan.narrationText.trim()).length;
  if (!voiceReferenceAssets.length && !dialogueShotCount) return "";
  if (voiceReferenceAssets.length) return `${voiceReferenceAssets.length} 段声音参考`;
  return `${dialogueShotCount} 个镜头有台词`;
}

function referenceFactLabel(summary: ProjectRuntimeState["visualMemory"]["summary"]) {
  const locked = summary.locked || 0;
  const review = summary.needsReview || 0;
  const missing = summary.missing || 0;
  if (missing > 0 && review > 0) return "待看，也有待生成";
  if (missing > 0) return "待生成";
  if (review > 0) return "待看";
  if (locked > 0) return "已可用";
  return "待整理";
}

function assetWaitingLabel(input: ProjectStatusViewModelInput) {
  const { visualMemory } = input.runtimeState;
  const missing = visualMemory.summary.missing;
  const review = visualMemory.summary.needsReview;
  if (input.referenceGenerationAction?.status === "running") return "参考图正在生成";
  if (input.referenceGenerationAction?.status === "blocked") return actionMessage(input.referenceGenerationAction, "参考生成被拦住");
  if (input.referenceGenerationAction?.status === "ready" && missing > 0) return "角色、场景、道具或故事板参考待生成";
  if (review > 0) return "参考待看";
  if (missing > 0) return "角色、场景、道具或故事板参考待生成";
  return "";
}

function videoWaitingLabel(input: ProjectStatusViewModelInput) {
  const stage = input.videoStage;
  if (stage && stage.status !== "not_submitted") {
    const generation = stage.generation;
    const summary = generation?.queueSummary || generation?.detail || generation?.statusLabel;
    if (stage.status === "in_progress") return summary || "视频正在排队或生成";
    if (stage.status === "recoverable") return summary || "视频已发送，可以查询结果";
    if (stage.status === "needs_review") return `${stage.reviewCount || 1} 段视频结果已出`;
    if (stage.status === "failed") return summary || "有视频段生成失败";
    if (stage.status === "completed") return summary || "视频结果可预览";
  }

  const video = input.videoSendAction;
  if (!video) return "";
  if (video.status === "submitted" || video.status === "running") return "视频正在排队或生成";
  if (video.status === "needs_review") return "视频结果已出，等待确认";
  if (video.status === "blocked") return actionMessage(video, "视频暂时不能发送");
  return "";
}

export function buildProjectStatusViewModel(input: ProjectStatusViewModelInput): ProjectStatusViewModel {
  const { runtimeState } = input;
  const browserDraftActive = !input.folderReady && !input.projectReady && input.newVideoStatus && input.newVideoStatus.status !== "empty";
  const shotCount = browserDraftActive && input.newVideoStatus?.draftShotCount
    ? input.newVideoStatus.draftShotCount
    : runtimeState.storyFlow.shots.length;
  const assetSummary = runtimeState.visualMemory.summary;
  const draftReferenceCount = browserDraftActive ? input.newVideoStatus?.draftReferenceCount || 0 : 0;
  const folderLabel = compactPath(runtimeState.project.root);
  const videoStage = input.videoStage;
  const videoFact = videoStage && videoStage.status !== "not_submitted"
    ? videoStage.generation?.queueSummary || videoStageFactLabel(videoStage)
    : "";
  const videoTaskFacts = videoTaskFactsForStatus(videoStage);
  const audioFact = audioFactLabel(runtimeState);
  const rawAgentFact = input.agentCommand?.label?.trim() || input.agentStage?.summary?.trim() || "";
  const agentFact = !input.folderReady && input.projectReady && /生成|提交|导出/.test(rawAgentFact)
    ? "先保存项目"
    : rawAgentFact;
  const facts = [
    { label: "项目", value: input.folderReady ? folderLabel : "先写想法" },
    { label: "镜头", value: browserDraftActive && shotCount > 0 ? `草案 ${countLabel(shotCount, "个")}` : countLabel(shotCount, "个") },
    { label: "参考", value: browserDraftActive && draftReferenceCount > 0 ? `已放入 ${draftReferenceCount} 个` : referenceFactLabel(assetSummary) },
    audioFact ? { label: "声音", value: audioFact } : undefined,
    videoFact ? { label: "视频", value: videoFact } : undefined,
    ...videoTaskFacts,
    agentFact ? { label: "AI 导演", value: agentFact } : undefined,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  if (input.localProjectBusy) {
    return {
      stage: "正在处理",
      doing: "项目正在保存或同步",
      waitingFor: "等待当前动作完成",
      nextAction: "完成后继续在底部对话框描述下一步",
      tone: "working",
      facts,
    };
  }

  if (!input.folderReady && !input.projectReady) {
    const newVideoStatus = input.newVideoStatus;
    if (newVideoStatus && newVideoStatus.status !== "empty") {
      return {
        stage: newVideoStatus.status === "planning"
          ? "正在拆镜头"
          : newVideoStatus.status === "ready"
            ? "草案待确认"
            : newVideoStatus.status === "blocked"
              ? "草案待处理"
              : "先写想法",
        doing: newVideoStatus.title,
        waitingFor: newVideoStatus.detail,
        nextAction: newVideoStatus.nextAction,
        tone: newVideoStatus.status === "planning"
          ? "working"
          : newVideoStatus.status === "blocked"
            ? "blocked"
            : "waiting",
        issue: newVideoStatus.status === "blocked" ? newVideoStatus.detail : undefined,
        facts,
      };
    }
    return {
      stage: "准备开始",
      doing: "还没有连接本地项目",
      waitingFor: "一个想法、脚本，或一个项目文件夹",
      nextAction: "在底部输入想法，或点左上角打开项目",
      tone: "waiting",
      facts,
    };
  }

  if (shotCount === 0) {
    return {
      stage: "准备故事",
      doing: input.folderReady ? "项目文件夹已连接" : "正在整理想法",
      waitingFor: "故事想法、脚本或素材",
      nextAction: "把想法写到底部输入框，AI 导演会先拆镜头",
      tone: "waiting",
      facts,
    };
  }

  if (!input.folderReady && input.projectReady) {
    return {
      stage: "需要本地项目",
      doing: "故事已经拆好",
      waitingFor: "一个本地项目文件夹",
      nextAction: "点左上角项目，选择本地文件夹",
      tone: "waiting",
      facts,
    };
  }

  const videoWaiting = videoWaitingLabel(input);
  if (videoWaiting) {
    const blocked = input.videoStage?.status === "failed" || input.videoSendAction?.status === "blocked";
    const needsReview = input.videoStage?.status === "needs_review" || input.videoSendAction?.status === "needs_review";
    const recoverable = input.videoStage?.status === "recoverable" || input.videoSendAction?.canResume;
    const completed = input.videoStage?.status === "completed";
    return {
      stage: blocked ? "视频待处理" : needsReview ? "视频待确认" : completed ? "视频结果已出" : recoverable ? "视频待查询" : "视频生成中",
      doing: videoWaiting,
      waitingFor: blocked ? "重试或跳过失败段" : needsReview ? "确认视频结果" : completed ? "确认交付" : recoverable ? "查询视频结果" : "视频结果",
      nextAction: recoverable
        ? "继续查询结果"
        : completed
          ? "去交付页查看"
          : input.videoSendAction?.suggestedActionLabel || (needsReview ? "去预览页确认" : "等结果出来后看预览"),
      tone: blocked ? "blocked" : needsReview || completed || recoverable ? "ready" : "working",
      issue: blocked ? input.videoStage?.generation?.detail || actionMessage(input.videoSendAction) : undefined,
      facts,
    };
  }

  const assetWaiting = assetWaitingLabel(input);
  if (assetWaiting) {
    const blocked = input.referenceGenerationAction?.status === "blocked";
    const missingReferences = input.runtimeState.visualMemory.summary.missing > 0;
    const referencesNeedReview = input.runtimeState.visualMemory.summary.needsReview > 0;
    const shouldGenerateReferences = missingReferences && !referencesNeedReview;
    const shouldReviewAndGenerateReferences = missingReferences && referencesNeedReview;
    const referenceStage = blocked
      ? "参考待处理"
      : input.referenceGenerationAction?.status === "running"
        ? "参考生成中"
      : shouldReviewAndGenerateReferences
        ? "参考待看，也有待生成"
      : shouldGenerateReferences
        ? "参考待生成"
      : "参考待看";
    const referenceWaitingFor = blocked
      ? "按提示处理条件"
      : input.referenceGenerationAction?.status === "running"
        ? "图片结果"
      : shouldGenerateReferences
        ? "确认生成参考范围"
      : shouldReviewAndGenerateReferences
        ? "先复核，再补缺口"
      : "确认素材";
    const missingReferenceNextAction = input.agentCommand?.kind === "generate_references"
      ? input.agentCommand.label || "生成参考"
      : "生成参考";
    return {
      stage: referenceStage,
      doing: assetWaiting,
      waitingFor: referenceWaitingFor,
      nextAction: blocked
        ? actionMessage(input.referenceGenerationAction, "调整后重试")
        : input.referenceGenerationAction?.status === "running"
          ? "去参考页看进度"
          : missingReferences
            ? missingReferenceNextAction
            : "去参考页确认可用素材",
      tone: blocked ? "blocked" : input.referenceGenerationAction?.status === "running" ? "working" : "waiting",
      issue: blocked ? actionMessage(input.referenceGenerationAction) : undefined,
      facts,
    };
  }

  if (input.exportAction?.status === "running") {
    return {
      stage: "导出中",
      doing: "正在整理交付包",
      waitingFor: "导出完成",
      nextAction: "完成后到交付页查看",
      tone: "working",
      facts,
    };
  }

  if (input.exportWorker?.readiness === "blocked") {
    return {
      stage: "交付待处理",
      doing: input.exportWorker.blockers[0] || "交付包还缺素材或视频结果",
      waitingFor: "补上交付条件",
      nextAction: "回到故事或预览页处理缺口",
      tone: "blocked",
      issue: input.exportWorker.blockers[0],
      facts,
    };
  }

  if (input.exportAction?.status === "failed") {
    return {
      stage: "导出失败",
      doing: exportActionMessage(input.exportAction, "交付包生成失败"),
      waitingFor: "重新导出",
      nextAction: "去交付页重试",
      tone: "blocked",
      issue: exportActionMessage(input.exportAction),
      facts,
    };
  }

  return {
    stage: input.agentCommand?.label ? "下一步已整理" : "可以继续",
    doing: input.agentStage?.summary?.trim() || `当前在${sectionName(input.directorView)}页查看项目`,
    waitingFor: input.agentStage?.detail?.trim() || "你的修改意见、素材，或视频发送许可",
    nextAction: input.agentCommand?.label?.trim() || "直接在底部告诉 AI 导演要改哪里",
    tone: "ready",
    facts,
  };
}
