import { CheckCircle2, CircleDashed, Clapperboard, FolderOpen, Image, MessageSquareText, PackageCheck, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { ShotRecord } from "../../core/types";
import type { CreatorDeskProjection } from "./creatorDeskTypes";
import type { DirectorView } from "./directorTypes";

type FlowTone = "done" | "active" | "review" | "blocked" | "idle";

function toneIcon(tone: FlowTone) {
  if (tone === "done") return <CheckCircle2 size={15} />;
  if (tone === "active") return <Sparkles size={15} />;
  if (tone === "review") return <ShieldCheck size={15} />;
  if (tone === "blocked") return <CircleDashed size={15} />;
  return <CircleDashed size={15} />;
}

function viewLabel(view: DirectorView) {
  if (view === "assets") return "参考资产";
  if (view === "preview") return "预览";
  if (view === "export") return "导出";
  return "故事流";
}

function stepTone(input: { ready: boolean; active: boolean; blocked?: boolean; review?: boolean }): FlowTone {
  if (input.blocked) return "blocked";
  if (input.review) return "review";
  if (input.active) return "active";
  if (input.ready) return "done";
  return "idle";
}

export function DirectorWorkflowOverview({
  runtimeState,
  shots,
  selectedShot,
  currentView,
  creatorDesk,
  localProjectReady,
}: {
  runtimeState: ProjectRuntimeState;
  shots: ShotRecord[];
  selectedShot?: ShotRecord;
  currentView: DirectorView;
  creatorDesk?: CreatorDeskProjection;
  localProjectReady?: boolean;
}) {
  const lockedAssets = runtimeState.visualMemory.assets.filter((asset) => asset.lockedStatus === "locked").length;
  const videoReady = Boolean(selectedShot?.videoPath || runtimeState.previewExport.draftPreview.summary.eventCount > 0);
  const hasProjectContent = shots.length > 0 || lockedAssets > 0 || videoReady;
  const missingReferenceCount = Math.max(
    creatorDesk?.reviewTray.counts.missing || 0,
    creatorDesk?.batchGeneration.missingCount || 0,
    creatorDesk?.framePlan.missingCount || 0,
  );
  const reviewCount = Math.max(
    creatorDesk?.reviewTray.counts.needs_review || 0,
    creatorDesk?.framePlan.reviewCount || 0,
    creatorDesk?.videoStage.reviewCount || 0,
  );
  const preflightStatus = creatorDesk?.preflight.status;
  const videoStage = creatorDesk?.videoStage;
  const videoGeneration = videoStage?.generation;
  const videoInProgress = videoStage?.status === "in_progress" || videoStage?.status === "recoverable";
  const videoNeedsReview = videoStage?.status === "needs_review";
  const videoComplete = videoStage?.status === "completed" || videoNeedsReview || videoReady;
  const videoCanSubmit = preflightStatus === "ready" && videoStage?.status === "not_submitted";
  const exportReady = currentView === "export" || videoComplete;

  const steps = [
    {
      id: "project",
      label: "创建项目",
      detail: localProjectReady ? "已连接" : "选择文件夹",
      tone: stepTone({ ready: Boolean(localProjectReady), active: !localProjectReady }),
      icon: <FolderOpen size={15} />,
    },
    {
      id: "split",
      label: "AI 拆分",
      detail: shots.length ? `${shots.length} 个镜头` : "先发想法",
      tone: stepTone({ ready: shots.length > 0, active: currentView === "story" && Boolean(localProjectReady) && !shots.length }),
      icon: <MessageSquareText size={15} />,
    },
    {
      id: "references",
      label: "生成参考",
      detail: missingReferenceCount ? `${missingReferenceCount} 待生成` : lockedAssets ? `${lockedAssets} 已通过` : "角色/场景/道具",
      tone: stepTone({ ready: lockedAssets > 0 && missingReferenceCount === 0, active: currentView === "assets", blocked: missingReferenceCount > 0 }),
      icon: <Image size={15} />,
    },
    {
      id: "review",
      label: "复核",
      detail: reviewCount ? `${reviewCount} 待看` : shots.length ? "确认后继续" : "等内容",
      tone: stepTone({ ready: shots.length > 0 && reviewCount === 0 && missingReferenceCount === 0, active: currentView === "assets" && reviewCount > 0, review: reviewCount > 0 }),
      icon: <ShieldCheck size={15} />,
    },
    {
      id: "submit",
      label: "发送视频",
      detail: videoInProgress ? videoGeneration?.statusLabel || "处理中" : videoCanSubmit ? "可发送" : "参考通过后",
      tone: stepTone({ ready: videoComplete, active: videoCanSubmit, review: videoInProgress }),
      icon: <Clapperboard size={15} />,
    },
    {
      id: "preview",
      label: "预览",
      detail: videoComplete ? "可播放" : "等结果出来",
      tone: stepTone({ ready: videoComplete, active: currentView === "preview" }),
      icon: <PlayCircle size={15} />,
    },
    {
      id: "export",
      label: "导出",
      detail: exportReady ? "可交付" : "预览后导出",
      tone: stepTone({ ready: exportReady, active: currentView === "export" }),
      icon: <PackageCheck size={15} />,
    },
  ];

  return (
    <section className="director-flow-overview" aria-label="创作流程">
      <div className="director-flow-title">
        <span>{localProjectReady ? "本地项目已就绪" : hasProjectContent ? "当前项目" : "先创建本地项目"}</span>
        <strong>{viewLabel(currentView)}</strong>
      </div>
      <div className="director-flow-steps">
        {steps.map((step) => (
          <div key={step.id} className={`director-flow-step ${step.tone}`}>
            <i>{step.icon || toneIcon(step.tone)}</i>
            <span>{step.label}</span>
            <small title={step.detail}>{step.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
