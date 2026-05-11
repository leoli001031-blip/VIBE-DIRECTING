import type { ShotRecord } from "../../core/types";
import { MediaFrame } from "../common/MediaFrame";

export function formatShotNumber(id: string) {
  if (id === "CURRENT_PROJECT") return "当前项目";
  const match = id.match(/^A(\d+)_(\d+)$/i);
  if (!match) return id;
  return `${Number(match[1])}-${Number(match[2])}`;
}

const storyFunctionLabels = ["开场", "信号", "选择", "行动", "揭示", "测试", "转折", "决定", "回应", "收束"];

export function shortStoryFunction(shot: ShotRecord, index: number) {
  const value = shot.storyFunction.trim();
  if (shot.id === "CURRENT_PROJECT" || shot.issues.includes("current_project_story_pending")) {
    return value.includes("未同步") ? "等待同步" : "待补齐故事流";
  }
  if (/^setup$/i.test(value)) return "开场";
  if (/^[A-Za-z][A-Za-z\s-]{1,16}$/.test(value)) return value;
  return storyFunctionLabels[index % storyFunctionLabels.length];
}

export function shotStatusTone(shot: ShotRecord) {
  if (shot.status === "blocked" || shot.issues.some((issue) => issue.includes("missing"))) return "bad";
  if (shot.issues.length || shot.status === "video_missing") return "warn";
  return "ok";
}

export function shotStatusLabel(shot: ShotRecord) {
  if (shot.id === "CURRENT_PROJECT" || shot.issues.includes("current_project_story_pending")) return "待补齐";
  if (shot.status === "blocked" || shot.issues.some((issue) => issue.includes("missing"))) return "需复核";
  if (shot.issues.length || shot.status === "video_missing") return "待补齐";
  return "已就绪";
}

export function MinimalStoryFlow({
  sectionLabel,
  shots,
  selectedShotId,
  selectedShotIds,
  onSelectShot,
}: {
  sectionLabel: string;
  shots: ShotRecord[];
  selectedShotId: string;
  selectedShotIds: string[];
  onSelectShot: (id: string, additive?: boolean) => void;
}) {
  const selectedSet = new Set(selectedShotIds.length ? selectedShotIds : [selectedShotId]);
  return (
    <main className="minimal-story-flow">
      <h2 title={sectionLabel}>{sectionLabel.length > 24 ? `${sectionLabel.slice(0, 23).trim()}...` : sectionLabel}</h2>
      <div className="minimal-shot-grid">
        {shots.map((shot, index) => (
          <button
            key={shot.id}
            className={`minimal-shot-card ${selectedSet.has(shot.id) ? "selected" : ""} ${selectedShotId === shot.id ? "primary" : ""}`}
            onClick={(event) => onSelectShot(shot.id, event.metaKey || event.ctrlKey || event.shiftKey)}
            aria-pressed={selectedSet.has(shot.id)}
          >
            <MediaFrame
              src={shot.startFrame || shot.endFrame}
              alt={shot.title}
              label={formatShotNumber(shot.id)}
              className="minimal-shot-image"
            />
            <span className="minimal-shot-caption">
              <strong>{formatShotNumber(shot.id)}</strong>
              <span>{shortStoryFunction(shot, index)}</span>
              <i className={`dot ${shotStatusTone(shot)}`} aria-label={shotStatusLabel(shot)} />
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
