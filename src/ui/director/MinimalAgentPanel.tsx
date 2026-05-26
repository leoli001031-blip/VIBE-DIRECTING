import { useRef, useState, type DragEvent } from "react";
import { CheckCircle2, ExternalLink, LockKeyhole, Plus, Search, Send, Sparkles, X } from "lucide-react";
import {
  agentWebSearchSourceLabel,
  buildAgentWebResearchSuggestion,
  defaultAgentWebSearchSettings,
  runAgentWebSearch as requestAgentWebSearch,
  type AgentWebSearchResult,
  type AgentWebSearchSettings,
} from "../../core/agentWebSearchClient";
import {
  buildDirectorFeedbackRecompile,
  type DirectorFeedbackRecompileResult,
} from "../../core/directorFeedbackRecompile";
import { buildDirectorWorkflowState } from "../../core/directorWorkflow";
import type { KnowledgePack, KnowledgePackManifest } from "../../core/knowledgeTypes";
import type { MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { StoryboardReferenceProjectPlannerInput } from "../../core/storyboardReferenceProjectPlanner";
import type { AssetRecord, ShotRecord } from "../../core/types";
import {
  agentProjectionBadges,
  agentProjectionNextStep,
  agentVideoSubmitContractAllowsVideo as agentVideoPermissionAllowsVideo,
  agentVideoSubmitContractDetail as agentVideoPermissionDetail,
  agentVideoSubmitContractForUi as agentVideoPermissionForUi,
  agentVideoSubmitContractLabel as agentVideoPermissionLabel,
  buildAgentPanelProjection,
  buildPrototypeAgentDemoProjection,
  confirmAgentPlanProjection,
  defaultAgentVideoSubmitContract as defaultAgentVideoPermissionContract,
  detectAgentVideoSubmitContract as detectAgentVideoPermissionContract,
  productScopeLabel,
  selectedScopeLabel,
  type AgentVideoSubmitContract as AgentVideoPermissionContract,
  type AgentVideoSubmitMode as AgentVideoPermissionMode,
  type AgentPlanPhase,
  type PrototypeAgentDemoRun,
  type PreviewPrototypeAgentDemoInput,
  workflowBadgeLabels,
  workflowCanConfirm,
  workflowPanelNextStepLabel,
  workflowPlanFacts,
} from "./agentPanelProjection";
import {
  directorFeedbackCanConfirm,
  directorFeedbackGenerationLabel,
  directorFeedbackNeedsConcreteDirection,
} from "./directorFeedbackUi";
import { usesEndpointEndFrame } from "./videoControlModeUi";

type DirectorWorkflowInput = Parameters<typeof buildDirectorWorkflowState>[0];

function withProjectGuide(input: DirectorWorkflowInput, projectGuide?: KnowledgePackManifest): DirectorWorkflowInput {
  return {
    ...input,
    knowledgeManifest: projectGuide,
  };
}

const creatorPathSteps = [
  { id: "natural-language", label: "描述修改", detail: "一句话说明" },
  { id: "draft-plan", label: "生成计划", detail: "先看改动" },
  { id: "confirmed-write", label: "确认应用", detail: "加入待处理" },
];

type PreparedComposerContext = {
  scopeLabel: string;
  selectionHint: string;
  userIntent: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  videoPermissionContract: AgentVideoPermissionContract;
};

type ComposerAttachmentKind = "script" | "image" | "audio" | "video" | "file";

type ComposerAttachment = {
  id: string;
  kind: ComposerAttachmentKind;
  file: File;
};

function composerAttachmentKind(file: File): ComposerAttachmentKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".srt") || file.type.startsWith("text/")) return "script";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function composerAttachmentLabel(kind: ComposerAttachmentKind) {
  if (kind === "script") return "脚本";
  if (kind === "image") return "图片";
  if (kind === "audio") return "音频";
  if (kind === "video") return "视频";
  return "文件";
}

function attachmentIntentLine(attachment: ComposerAttachment) {
  return `${composerAttachmentLabel(attachment.kind)}：${attachment.file.name}`;
}

export function MinimalAgentPanel({
  runtimeState,
  projectScopeLabel,
  shot,
  selectedShots = [],
  asset,
  sectionLabel,
  sectionId,
  onProjectStoreApplyPlanReady,
  latestPrototypeAgentDemo,
  onPreviewPrototypeAgentDemo,
  realSampleAction,
  endFrameAction,
  videoSendAction,
  webSearchSettings = defaultAgentWebSearchSettings,
  projectReferenceGuide,
  onSaveResearchAsReference,
  onCreateP6RealSample,
  onCreateImage2EndFrame,
  onSendSeedanceVideo,
  videoPermissionContract,
  onVideoPermissionContractChange,
  storyboardProjectPlanInput,
  onDirectorFeedbackConfirmed,
}: {
  runtimeState: ProjectRuntimeState;
  projectScopeLabel?: string;
  shot?: ShotRecord;
  selectedShots?: ShotRecord[];
  asset?: AssetRecord;
  sectionLabel?: string;
  sectionId?: string;
  onProjectStoreApplyPlanReady?: (plan: ProjectFactsStagedApplyPlan) => void;
  latestPrototypeAgentDemo?: PrototypeAgentDemoRun;
  onPreviewPrototypeAgentDemo?: (input: PreviewPrototypeAgentDemoInput) => void | Promise<void>;
  realSampleAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "needs_review" | "verified";
    message?: string;
    disabled?: boolean;
  };
  endFrameAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "needs_review" | "verified";
    message?: string;
    disabled?: boolean;
  };
  videoSendAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "submitted" | "needs_review";
    message?: string;
    disabled?: boolean;
    ready?: boolean;
  };
  webSearchSettings?: AgentWebSearchSettings;
  projectReferenceGuide?: KnowledgePackManifest;
  onSaveResearchAsReference?: (input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }) => KnowledgePack | Promise<KnowledgePack>;
  onCreateP6RealSample?: () => void | Promise<void>;
  onCreateImage2EndFrame?: () => void | Promise<void>;
  onSendSeedanceVideo?: () => void | Promise<void>;
  videoPermissionContract?: AgentVideoPermissionContract;
  onVideoPermissionContractChange?: (contract: AgentVideoPermissionContract) => void;
  storyboardProjectPlanInput?: StoryboardReferenceProjectPlannerInput;
  onDirectorFeedbackConfirmed?: (recompile: DirectorFeedbackRecompileResult) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  // File objects in React state can cause memory leaks; consider using a ref or blob URL instead
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [status, setStatus] = useState("等待描述");
  const [planPhase, setPlanPhase] = useState<AgentPlanPhase>("idle");
  const [localPrototypeAgentDemo, setLocalPrototypeAgentDemo] = useState<PrototypeAgentDemoRun | undefined>();
  const [workflow, setWorkflow] = useState<ReturnType<typeof buildDirectorWorkflowState> | undefined>();
  const [projection, setProjection] = useState<MinimalRuntimeProjection | undefined>();
  const [feedbackRecompile, setFeedbackRecompile] = useState<DirectorFeedbackRecompileResult | undefined>();
  const [researchResult, setResearchResult] = useState<AgentWebSearchResult | undefined>();
  const [researchStatus, setResearchStatus] = useState<"idle" | "running" | "ready" | "blocked">("idle");
  const [referenceStatus, setReferenceStatus] = useState<"idle" | "saving" | "saved" | "blocked">("idle");
  const [preparedContext, setPreparedContext] = useState<PreparedComposerContext | undefined>();
  const [localVideoPermissionContract, setLocalVideoPermissionContract] = useState<AgentVideoPermissionContract>(defaultAgentVideoPermissionContract);
  const scopedShotIds = selectedShots.map((item) => item.id);
  const localScopeLabel = selectedScopeLabel(shot, asset, sectionLabel, selectedShots);
  const scopeLabel = projectScopeLabel ? `${productScopeLabel(projectScopeLabel)} · ${localScopeLabel}` : localScopeLabel;
  const hasBoundSelection = Boolean(scopedShotIds.length || shot || asset);
  const hasMultiShotSelection = scopedShotIds.length > 1;
  const hasSectionSelection = Boolean(sectionId && !scopedShotIds.length && !asset);
  const selectionHint = hasMultiShotSelection
    ? `${localScopeLabel} 已绑定。直接说这些镜头哪里不顺，比如节奏太碎、动作太平或场景不连贯。`
    : shot
      ? `${localScopeLabel} 已绑定。直接说这一段哪里不对，比如人物不像、动作太平、需要拆特写、场景天气不对。`
      : asset
        ? `${localScopeLabel} 已绑定。直接说这个素材怎么改，比如只改角色外观、不要影响场景。`
        : hasSectionSelection
          ? `${localScopeLabel} 已绑定。直接说这一段故事要怎么改，比如多拆几个镜头、节奏慢一点或补一个反应。`
          : "可以先说你想拍什么；也可以点一个镜头、段落或素材后，再直接说哪里要改。";
  const displayedScopeLabel = workflow ? preparedContext?.scopeLabel || scopeLabel : scopeLabel;
  const displayedSelectionHint = workflow ? preparedContext?.selectionHint || selectionHint : selectionHint;
  const inputPlaceholder = hasBoundSelection
    ? "说这段想怎么改，例如：递东西别一个中景拍完，先远景再手部特写。"
    : "先点选一段，或直接说整个项目想怎么改；脚本、图片、音频也可以拖进来。";
  const prototypeAgentDemo = latestPrototypeAgentDemo || localPrototypeAgentDemo;
  const prototypeAgentProjection = buildPrototypeAgentDemoProjection(prototypeAgentDemo);
  const realSampleBusy = realSampleAction?.status === "running";
  const endFrameBusy = endFrameAction?.status === "running";
  const videoBusy = videoSendAction?.status === "running";
  const videoAlreadySent = videoSendAction?.status === "submitted" || videoSendAction?.status === "needs_review";
  const activeVideoPermissionContract = videoPermissionContract || localVideoPermissionContract;
  const videoPermissionBlockedByContract = !agentVideoPermissionAllowsVideo(activeVideoPermissionContract);
  const showEndpointEndFrameControls = usesEndpointEndFrame(shot) || selectedShots.some(usesEndpointEndFrame);
  const showRealSampleAction = Boolean(realSampleAction?.keyConfigured || realSampleAction?.status === "running" || realSampleAction?.status === "needs_review" || realSampleAction?.status === "verified");
  const showEndFrameAction = showEndpointEndFrameControls && Boolean(endFrameAction?.keyConfigured || endFrameAction?.status === "running" || endFrameAction?.status === "needs_review" || endFrameAction?.status === "verified");
  const showVideoAction = Boolean(videoSendAction && runtimeState.storyFlow.shots.length > 0);
  const videoPermissionContractForUi = agentVideoPermissionForUi(activeVideoPermissionContract, {
    referenceReady: Boolean(showRealSampleAction || showEndFrameAction),
    videoReady: Boolean(showVideoAction && videoSendAction?.ready && videoSendAction.keyConfigured && !videoAlreadySent),
  });
  const videoPermissionModeItems: Array<{ mode: AgentVideoPermissionMode; label: string }> = [
    { mode: "plan_only", label: "只规划" },
    { mode: "reference_allowed", label: "可生成参考" },
    { mode: "video_allowed", label: "可提交视频" },
  ];
  const realSampleLabel = realSampleBusy
    ? "补齐中"
    : realSampleAction?.status === "needs_review"
      ? "等待复核"
      : realSampleAction?.status === "verified"
        ? "已完成"
        : "补齐参考";
  const endFrameLabel = endFrameBusy
    ? "生成中"
    : endFrameAction?.status === "needs_review"
      ? "等待复核"
      : endFrameAction?.status === "verified"
        ? "已完成"
        : "生成尾帧参考";
  const videoActionLabel = videoBusy
    ? "提交中"
    : videoPermissionBlockedByContract
      ? agentVideoPermissionLabel(activeVideoPermissionContract)
      : videoAlreadySent
      ? "已提交"
      : "提交视频";

  function updateVideoPermissionContract(nextContract: AgentVideoPermissionContract) {
    setLocalVideoPermissionContract(nextContract);
    onVideoPermissionContractChange?.(nextContract);
  }

  function updateText(value: string) {
    setText(value);
    setResearchResult(undefined);
    setResearchStatus("idle");
    setReferenceStatus("idle");
    if (!workflow) return;
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setStatus(value.trim() ? "继续描述" : "等待描述");
  }

  function resetPreparedComposerState(nextStatus?: string) {
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setResearchResult(undefined);
    setResearchStatus("idle");
    setReferenceStatus("idle");
    if (nextStatus) setStatus(nextStatus);
  }

  function addComposerFiles(filesLike: FileList | File[] | null) {
    const files = Array.from(filesLike || []);
    if (!files.length) return;
    const nextAttachments = [
      ...attachments,
      ...files.map((file, index) => ({
        id: `${file.name.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")}_${file.lastModified}_${file.size}_${attachments.length + index}`,
        kind: composerAttachmentKind(file),
        file,
      })),
    ];
    setAttachments(nextAttachments);
    resetPreparedComposerState("素材已放入");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeComposerAttachment(id: string) {
    const nextAttachments = attachments.filter((item) => item.id !== id);
    setAttachments(nextAttachments);
    resetPreparedComposerState(text.trim() || nextAttachments.length ? "继续描述" : "等待描述");
  }

  function handleComposerDrag(event: DragEvent<HTMLElement>, active: boolean) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(active);
  }

  function handleComposerDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    addComposerFiles(event.dataTransfer.files);
  }

  function prepareChange() {
    const userIntent = [text.trim(), attachments.map(attachmentIntentLine).join("\n")].filter(Boolean).join("\n");
    if (!userIntent) {
      setStatus("先说想改什么，或放入文件");
      return;
    }
    const nextVideoPermissionContract = detectAgentVideoPermissionContract(userIntent, activeVideoPermissionContract);
    updateVideoPermissionContract(nextVideoPermissionContract);
    const preparedSelection: PreparedComposerContext = {
      scopeLabel,
      selectionHint,
      userIntent,
      selectedShotId: scopedShotIds.length <= 1 ? shot?.id : undefined,
      selectedShotIds: scopedShotIds.length > 1 ? scopedShotIds : undefined,
      selectedAssetId: asset?.id,
      sectionId: !scopedShotIds.length && !asset ? sectionId : undefined,
      videoPermissionContract: nextVideoPermissionContract,
    };
    const nextWorkflow = buildDirectorWorkflowState(withProjectGuide({
      runtimeState,
      userIntent,
      selection: {
        selectedShotId: preparedSelection.selectedShotId,
        selectedShotIds: preparedSelection.selectedShotIds,
        selectedAssetId: preparedSelection.selectedAssetId,
        sectionId: preparedSelection.sectionId,
      },
    }, projectReferenceGuide));
    const feedbackTargetShotId = preparedSelection.selectedShotId;
    const nextFeedbackRecompile = feedbackTargetShotId && storyboardProjectPlanInput
      ? buildDirectorFeedbackRecompile({
          feedback: userIntent,
          targetShotId: feedbackTargetShotId,
          projectPlanInput: storyboardProjectPlanInput,
        })
      : undefined;
    const nextProjection = buildAgentPanelProjection(nextWorkflow, runtimeState, "review");
    setWorkflow(nextWorkflow);
    setProjection(nextProjection);
    setFeedbackRecompile(nextFeedbackRecompile);
    setPreparedContext(preparedSelection);
    setPlanPhase("review");
    setText("");
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus(!agentVideoPermissionAllowsVideo(nextVideoPermissionContract)
      ? agentVideoPermissionLabel(nextVideoPermissionContract)
      : directorFeedbackCanConfirm(nextFeedbackRecompile)
      ? "待确认重编译"
      : directorFeedbackNeedsConcreteDirection(nextFeedbackRecompile)
        ? "需要具体说法"
        : workflowCanConfirm(nextWorkflow) ? "待确认" : nextProjection.shortLabel);
  }

  function revisePlan() {
    const previousIntent = preparedContext?.userIntent?.trim();
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    if (previousIntent) setText(previousIntent);
    setStatus(previousIntent || text.trim() ? "继续描述" : "等待描述");
  }

  async function confirmPlan() {
    if (!workflow) return;
    const canConfirmFeedback = Boolean(
      directorFeedbackCanConfirm(feedbackRecompile)
      && onDirectorFeedbackConfirmed,
    );
    const preparedUserIntent = preparedContext?.userIntent?.trim() || [text.trim(), attachments.map(attachmentIntentLine).join("\n")].filter(Boolean).join("\n");
    const canPreviewPrototypeDemo = Boolean(onPreviewPrototypeAgentDemo && preparedUserIntent && !canConfirmFeedback);
    if (!workflowCanConfirm(workflow) && !canPreviewPrototypeDemo && !canConfirmFeedback) return;
    const confirmed = workflowCanConfirm(workflow)
      ? confirmAgentPlanProjection(workflow, runtimeState)
      : undefined;
    if (confirmed) setProjection(confirmed.projection);
    setPlanPhase("confirmed");
    setStatus(canConfirmFeedback ? "正在写入修改计划" : canPreviewPrototypeDemo ? "正在整理预览" : "已加入待处理");
    if (confirmed) onProjectStoreApplyPlanReady?.(confirmed.applyPlan);
    if (canConfirmFeedback && feedbackRecompile && onDirectorFeedbackConfirmed) {
      try {
        await onDirectorFeedbackConfirmed(feedbackRecompile);
        setStatus("修改计划已写入项目");
        setLocalPrototypeAgentDemo({
          status: "ready",
          result: {
            label: "修改计划已写入项目",
            projectVibeAdded: true,
            projectSaved: true,
            waitingReview: true,
            status: "ready",
          },
        });
      } catch {
        setStatus("需要复核");
        setLocalPrototypeAgentDemo({
          status: "error",
          result: {
            label: "修改计划写入失败",
            projectVibeAdded: false,
            waitingReview: true,
            status: "error",
          },
        });
      }
      return;
    }
    if (!onPreviewPrototypeAgentDemo) return;
    const userIntent = preparedUserIntent;
    const confirmedVideoPermissionContract = preparedContext?.videoPermissionContract || activeVideoPermissionContract;
    setLocalPrototypeAgentDemo({ status: "running", result: { projectVibeAdded: true, waitingReview: true } });
    try {
      await onPreviewPrototypeAgentDemo({
        userIntent,
        scopeLabel: preparedContext?.scopeLabel || scopeLabel,
        selectedShotId: preparedContext?.selectedShotId,
        selectedShotIds: preparedContext?.selectedShotIds,
        selectedAssetId: preparedContext?.selectedAssetId,
        sectionId: preparedContext?.sectionId,
        videoPermissionContract: confirmedVideoPermissionContract,
        workflowStatus: workflow.status,
        generatedAt: workflow.generatedAt,
        applyPlan: confirmed?.applyPlan,
      });
      setStatus("预览已生成、等待复核");
      setLocalPrototypeAgentDemo({ status: "preview_ready", result: { projectVibeAdded: true, waitingReview: true, previewReady: true } });
    } catch {
      setStatus("需要复核");
      setLocalPrototypeAgentDemo({ status: "error", result: { projectVibeAdded: true, waitingReview: true } });
    }
  }

  function handleNext() {
    if (!workflow || planPhase === "idle") {
      prepareChange();
      return;
    }
    void confirmPlan();
  }

  const canConfirm = workflowCanConfirm(workflow);
  const canConfirmFeedback = Boolean(directorFeedbackCanConfirm(feedbackRecompile) && onDirectorFeedbackConfirmed);
  const hasComposerInput = Boolean(text.trim() || attachments.length);
  const hasPreparedComposerInput = Boolean(preparedContext?.userIntent?.trim() || hasComposerInput);
  const canPreviewPrototypeDemo = Boolean(workflow && onPreviewPrototypeAgentDemo && hasPreparedComposerInput && !canConfirmFeedback);
  const primaryDisabled = !workflow
    ? !hasComposerInput
    : planPhase === "confirmed" || (!canConfirm && !canPreviewPrototypeDemo && !canConfirmFeedback);
  const primaryLabel = !workflow || planPhase === "idle"
    ? "发送"
    : planPhase === "confirmed"
      ? "已加入"
      : "确认修改";
  const showFooterPrimaryAction = !workflow || planPhase === "idle";
  const badges = feedbackRecompile
    ? [
        directorFeedbackCanConfirm(feedbackRecompile) ? "待确认" : "需要复核",
        directorFeedbackCanConfirm(feedbackRecompile) ? "会重编译" : "换个说法",
      ]
    : projection ? agentProjectionBadges(projection, planPhase).slice(0, 2) : workflow ? workflowBadgeLabels(workflow).slice(0, 2) : ["待确认", "会先整理"];
  const nextStep = feedbackRecompile
    ? directorFeedbackCanConfirm(feedbackRecompile)
      ? "确认后写入项目，并重新整理生成参考和视频计划；不会启动生成。"
      : "这条反馈需要说成具体导演修改，例如角色一致性、动作拆分、场景光线或无配乐。"
    : projection ? agentProjectionNextStep(projection, planPhase, canConfirm) : workflow ? workflowPanelNextStepLabel(workflow, planPhase) : "用自然语言描述想调整的镜头、角色或节奏。";
  const feedbackFacts = feedbackRecompile
    ? [
        { label: "修改对象", value: feedbackRecompile.feedbackIntent.targetShotId },
        { label: "会重编译", value: "生成参考 / 视频计划" },
        { label: "生成动作", value: directorFeedbackGenerationLabel(feedbackRecompile) },
      ]
    : [];
  const planFacts = feedbackFacts.length
    ? feedbackFacts
    : workflow
    ? [...workflowPlanFacts(workflow), { label: "作用范围", value: "故事 / 镜头 / 复核记录" }]
    : [];
  const agentUnderstanding = feedbackRecompile
    ? directorFeedbackCanConfirm(feedbackRecompile)
      ? "已整理成结构化导演修改：会更新当前镜头的生成参考和视频计划，确认前不生成。"
      : "这条反馈暂时不能直接进入计划。请说清楚要改角色、动作、分镜、场景还是声音。"
    : preparedContext?.userIntent?.trim()
    ? `我已把这句话整理成一条待确认改动：${preparedContext.userIntent.trim()}`
    : text.trim()
    ? `我会把这句话整理成一条可确认的修改：${text.trim()}`
    : attachments.length
      ? `我会先识别这 ${attachments.length} 个文件，把它们整理成脚本、参考图、音频或素材候选。`
    : "你先说想拍什么，或者点一个镜头/素材后说哪里不对。我会先整理成草案，确认后再写入项目。";
  const enabledResearchSuggestion = buildAgentWebResearchSuggestion(text, { ...webSearchSettings, enabled: true });
  const researchSuggestion = webSearchSettings.enabled
    ? enabledResearchSuggestion
    : {
      ...enabledResearchSuggestion,
      label: enabledResearchSuggestion.shouldSuggest ? "可先查资料" : "查资料未开启",
      detail: enabledResearchSuggestion.shouldSuggest
        ? "这类风格或知识点适合先查外部来源；去设置里选择 Tavily 后再查。"
        : "在设置里开启后，Agent 可以先整理外部来源。",
    };
  const showResearchPrompt = Boolean(text.trim() && (enabledResearchSuggestion.shouldSuggest || researchResult || researchStatus !== "idle"));
  const researchBusy = researchStatus === "running";
  const researchLabel = researchStatus === "running"
    ? "正在查找"
    : researchResult
      ? "来源已整理"
      : researchSuggestion.label;
  const researchDetail = researchResult
    ? `${researchResult.citations.length} 个来源，先作为研究卡等待确认。`
    : researchSuggestion.detail;
  const agentNoteLabel = workflow
    ? planPhase === "confirmed" ? "已确认改动" : "待确认改动"
    : "我先帮你整理";

  async function lookupSources() {
    if (!researchSuggestion.query || researchStatus === "running") return;
    setResearchStatus("running");
    setResearchResult(undefined);
    setReferenceStatus("idle");
    try {
      const result = await requestAgentWebSearch({
        query: researchSuggestion.query,
        purpose: "style_research",
        settings: webSearchSettings,
      });
      setResearchResult(result);
      setResearchStatus("ready");
    } catch {
      setResearchStatus("blocked");
    }
  }

  async function saveReferenceMethod() {
    if (!researchResult || !onSaveResearchAsReference || referenceStatus === "saving") return;
    setReferenceStatus("saving");
    try {
      await onSaveResearchAsReference({ result: researchResult, userIntent: text.trim() || researchResult.query });
      setReferenceStatus("saved");
    } catch {
      setReferenceStatus("blocked");
    }
  }

  return (
    <aside className="minimal-agent-panel">
      <div className="minimal-agent-head">
        <span>和 AI 导演聊一聊</span>
        <strong>{displayedScopeLabel}</strong>
      </div>
      <section className="minimal-agent-selection-context" aria-label="当前沟通对象">
        <span>{hasBoundSelection ? "当前选择" : "沟通方式"}</span>
        <p>{displayedSelectionHint}</p>
      </section>
      <div className="minimal-agent-permission-mode" aria-label="当前生成边界">
        {videoPermissionModeItems.map((item) => (
          <small key={item.mode} className={videoPermissionContractForUi.mode === item.mode ? "is-active" : ""}>
            {item.label}
          </small>
        ))}
        <span>{agentVideoPermissionDetail(videoPermissionContractForUi)}</span>
      </div>
      <section className={`minimal-agent-note ${workflow ? "has-plan" : ""}`} aria-label="AI 导演理解">
        <span>{agentNoteLabel}</span>
        <p>{agentUnderstanding}</p>
        {workflow && (
          <div className="minimal-agent-note-actions">
            <button disabled={primaryDisabled} onClick={handleNext}>
              <CheckCircle2 size={15} />
              {primaryLabel}
            </button>
            {planPhase !== "confirmed" && (
              <button type="button" className="secondary" onClick={revisePlan}>
                再改一下
              </button>
            )}
          </div>
        )}
      </section>
      {showResearchPrompt && (
        <section className={`minimal-agent-research ${researchStatus}`} aria-label="资料来源">
          <div className="minimal-agent-research-head">
            <span>{researchLabel}</span>
            <small>{agentWebSearchSourceLabel(webSearchSettings)}</small>
          </div>
          <p>{researchDetail}</p>
          {researchResult && (
            <div className="minimal-agent-sources">
              {researchResult.citations.slice(0, 3).map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  <span>{source.title}</span>
                  <small>{source.domain}</small>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
          <div className="minimal-agent-research-actions">
            <button
              type="button"
              disabled={!webSearchSettings.enabled || researchBusy}
              onClick={lookupSources}
            >
              <Search size={14} />
              查资料
            </button>
            {researchResult && onSaveResearchAsReference && (
              <button
                type="button"
                className="secondary"
                disabled={referenceStatus === "saving" || referenceStatus === "saved"}
                onClick={saveReferenceMethod}
              >
                <CheckCircle2 size={14} />
                {referenceStatus === "saved" ? "已保存" : referenceStatus === "saving" ? "保存中" : "保存为本片参考"}
              </button>
            )}
            {researchResult && <small>{referenceStatus === "saved" ? "后续整理会参考它。" : "采用前会先让你确认。"}</small>}
            {!webSearchSettings.enabled && <small>在设置里开启。</small>}
            {researchStatus === "blocked" && <small>暂时没有查到，稍后可重试。</small>}
            {referenceStatus === "blocked" && <small>保存失败，可重试。</small>}
          </div>
        </section>
      )}
      <div
        className={`minimal-agent-input ${isDraggingFiles ? "is-dragging" : ""}`}
        onDragEnter={(event) => handleComposerDrag(event, true)}
        onDragOver={(event) => handleComposerDrag(event, true)}
        onDragLeave={(event) => handleComposerDrag(event, false)}
        onDrop={handleComposerDrop}
      >
        <input
          ref={fileInputRef}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          type="file"
          accept=".txt,.md,.srt,text/plain,text/markdown,image/*,audio/*,video/*"
          multiple
          onChange={(event) => addComposerFiles(event.currentTarget.files)}
        />
        {attachments.length > 0 && (
          <div className="minimal-agent-attachments" aria-label="已放入的文件">
            {attachments.map((attachment) => (
              <span key={attachment.id}>
                <b>{composerAttachmentLabel(attachment.kind)}</b>
                <small>{attachment.file.name}</small>
                <button type="button" onClick={() => removeComposerAttachment(attachment.id)} aria-label={`移除 ${attachment.file.name}`}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea value={text} onChange={(event) => updateText(event.target.value)} placeholder={inputPlaceholder} />
        <div className="minimal-agent-input-footer">
          <button type="button" className="minimal-agent-file-button" onClick={() => fileInputRef.current?.click()}>
            <Plus size={15} aria-hidden="true" />
            添加文件
          </button>
          <small>{text.trim() ? `${text.trim().length} 字` : attachments.length ? `${attachments.length} 个文件待整理` : hasBoundSelection ? "反馈会落到当前选择" : "直接描述，或把文件拖进来"}</small>
          {showFooterPrimaryAction && (
            <button disabled={primaryDisabled} onClick={handleNext}>
              <Send size={15} />
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
      <div className="minimal-agent-status-row">
        <span>状态</span>
        <strong className="minimal-agent-status">{status}</strong>
        {projection && (
          <div className="minimal-state-dots agent" aria-label={projection.shortLabel}>
            {projection.progressDots.map((dot) => (
              <i key={dot.id} className={dot.tone} title={dot.label} />
            ))}
          </div>
        )}
      </div>
      <details className="minimal-agent-details">
        <summary>会影响的内容</summary>
        <div className="minimal-agent-badges" aria-label="修改摘要">
          {badges.map((badge) => (
            <small key={badge}>{badge}</small>
          ))}
        </div>
        <div className="minimal-agent-steps" aria-label="创作者路径">
          {creatorPathSteps.map((step, index) => (
            <small
              key={step.id}
              className={
                planPhase === "confirmed" || (workflow && index < 2) || (!workflow && index === 0)
                  ? "is-active"
                  : ""
              }
            >
              {step.label}
              <span>{step.detail}</span>
            </small>
          ))}
        </div>
        {workflow && (
          <div className="minimal-agent-plan" aria-label="修改计划详情">
            {planFacts.map((fact) => (
              <small key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </small>
            ))}
          </div>
        )}
        <small className="minimal-agent-next">{nextStep}</small>
      </details>
      {prototypeAgentProjection && (
        <div className="minimal-agent-badges" aria-label="创作者预览状态">
          <small>{prototypeAgentProjection.statusLabel}</small>
          {prototypeAgentProjection.badges.filter((badge) => badge !== prototypeAgentProjection.statusLabel).map((badge) => (
            <small key={badge}>{badge}</small>
          ))}
        </div>
      )}
      {showRealSampleAction && realSampleAction && (
        <section className={`agent-real-sample-action ${realSampleAction.status}`} aria-label="项目参考补全">
          <div>
            <span>参考素材</span>
            <strong>{realSampleLabel}</strong>
            <small>{realSampleAction.message || "会检查当前故事，缺的参考会放进复核区。"}</small>
          </div>
          <button
            disabled={realSampleAction.disabled || !realSampleAction.keyConfigured || realSampleBusy}
            onClick={onCreateP6RealSample}
          >
            {realSampleAction.keyConfigured ? <Sparkles size={15} /> : <LockKeyhole size={15} />}
            补齐参考
          </button>
        </section>
      )}
      {showVideoAction && videoSendAction && (
        <section className={`agent-real-sample-action ${videoSendAction.status}`} aria-label="视频生成">
          <div>
            <span>视频生成</span>
            <strong>{videoActionLabel}</strong>
            <small>{videoPermissionBlockedByContract ? agentVideoPermissionDetail(activeVideoPermissionContract) : videoSendAction.message || "会按当前故事板/全能参考策略提交；即梦排队时可以稍后恢复查询。"}</small>
          </div>
          <button
            disabled={videoPermissionBlockedByContract || Boolean(videoSendAction.disabled) || !videoSendAction.ready || !videoSendAction.keyConfigured || videoBusy || videoAlreadySent || !onSendSeedanceVideo}
            onClick={() => {
              if (videoPermissionBlockedByContract) return;
              void onSendSeedanceVideo?.();
            }}
          >
            {videoSendAction.keyConfigured ? <Send size={15} /> : <LockKeyhole size={15} />}
            {videoActionLabel}
          </button>
        </section>
      )}
      {showEndFrameAction && endFrameAction && (
        <section className={`agent-real-sample-action ${endFrameAction.status}`} aria-label="当前镜头特殊尾帧参考">
          <div>
            <span>特殊尾帧</span>
            <strong>{endFrameLabel}</strong>
            <small>{endFrameAction.message || "只用于循环、变身或明确首尾控制；生成后先放到复核区。"}</small>
          </div>
          <button
            disabled={endFrameAction.disabled || !endFrameAction.keyConfigured || endFrameBusy}
            onClick={onCreateImage2EndFrame}
          >
            {endFrameAction.keyConfigured ? <Sparkles size={15} /> : <LockKeyhole size={15} />}
            生成
          </button>
        </section>
      )}
    </aside>
  );
}
