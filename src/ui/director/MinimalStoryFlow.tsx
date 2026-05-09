import { useEffect, useState } from "react";
import type { ShotRecord } from "../../core/types";

export function toMediaSrc(path?: string) {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("/")) return `/@fs${path}`;
  return path;
}

export function formatShotNumber(id: string) {
  const match = id.match(/^A(\d+)_(\d+)$/i);
  if (!match) return id;
  return `${Number(match[1])}-${Number(match[2])}`;
}

const storyFunctionLabels = ["Setup", "Signal", "Choice", "Move", "Reveal", "Test", "Turn", "Decision", "Payoff", "Close"];

export function shortStoryFunction(shot: ShotRecord, index: number) {
  const value = shot.storyFunction.trim();
  if (/^[A-Za-z][A-Za-z\s-]{1,16}$/.test(value)) return value;
  return storyFunctionLabels[index % storyFunctionLabels.length];
}

export function shotStatusTone(shot: ShotRecord) {
  if (shot.status === "blocked" || shot.issues.some((issue) => issue.includes("missing"))) return "bad";
  if (shot.issues.length || shot.status === "video_missing") return "warn";
  return "ok";
}

export function MediaFrame({
  src,
  alt,
  label,
  className = "",
}: {
  src?: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const mediaSrc = toMediaSrc(src);
  if (!mediaSrc || failed) {
    return <div className={`minimal-media-placeholder ${className}`}>{label}</div>;
  }

  return <img className={className} src={mediaSrc} alt={alt} onError={() => setFailed(true)} />;
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
              <i className={`dot ${shotStatusTone(shot)}`} aria-label={shot.status} />
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
