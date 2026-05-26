import { CheckCircle2, CircleDashed, Image, MessageSquareText, Rows3, ShieldCheck, Sparkles } from "lucide-react";
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

function gateReady(shot: ShotRecord | undefined, keys: Array<keyof ShotRecord["gates"]>) {
  if (!shot) return false;
  return keys.every((key) => shot.gates[key] === "PASS" || shot.gates[key] === "N/A");
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
  const frameReviewCount = creatorDesk?.framePlan.reviewCount || creatorDesk?.reviewTray.counts.needs_review || 0;
  const missingFrames = creatorDesk?.framePlan.missingCount || creatorDesk?.batchGeneration.missingCount || 0;
  const videoReady = Boolean(selectedShot?.videoPath || runtimeState.previewExport.draftPreview.summary.eventCount > 0);
  const hasProjectContent = shots.length > 0 || lockedAssets > 0 || videoReady;
  const selectedReady = Boolean(selectedShot && gateReady(selectedShot, ["identity", "scene", "prop", "story"]));
  const selectedBlocked = Boolean(selectedShot?.status === "blocked" || selectedShot?.issues.some((issue) => /missing|缺|blocked/i.test(issue)));

  const steps = [
    {
      id: "script",
      label: "脚本",
      detail: shots.length ? `${shots.length} 个镜头` : "从文本开始",
      tone: stepTone({ ready: shots.length > 0, active: currentView === "story" && !shots.length }),
      icon: <MessageSquareText size={15} />,
    },
    {
      id: "assets",
      label: "参考",
      detail: lockedAssets ? `${lockedAssets} 个已锁定` : "角色 / 场景 / 道具",
      tone: stepTone({ ready: lockedAssets > 0, active: currentView === "assets" }),
      icon: <Image size={15} />,
    },
    {
      id: "storyboard",
      label: "分镜",
      detail: selectedShot ? selectedShot.title : "选择一个镜头",
      tone: stepTone({ ready: selectedReady, active: currentView === "story" && Boolean(selectedShot), blocked: selectedBlocked }),
      icon: <Rows3 size={15} />,
    },
    {
      id: "frames",
      label: "画面",
      detail: missingFrames ? `${missingFrames} 个待补齐` : frameReviewCount ? `${frameReviewCount} 个待复核` : "画面参考优先",
      tone: stepTone({ ready: videoReady || frameReviewCount === 0 && missingFrames === 0 && shots.length > 0, active: currentView === "preview", review: frameReviewCount > 0, blocked: missingFrames > 0 }),
      icon: <Sparkles size={15} />,
    },
    {
      id: "review",
      label: "复核",
      detail: videoReady ? "可继续预览" : "通过后再导出",
      tone: stepTone({ ready: videoReady, active: currentView === "export", review: frameReviewCount > 0 }),
      icon: <ShieldCheck size={15} />,
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
