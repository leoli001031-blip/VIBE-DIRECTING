import { useEffect, useMemo, useRef, useState } from "react";
import { PauseCircle, Play } from "lucide-react";
import { buildMinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";
import {
  buildPreviewPlayerQueue as buildCorePreviewPlayerQueue,
  getPreviewPlayerActiveItem,
  getPreviewPlayerTotalDuration,
  type PreviewQueueItem,
  type PreviewQueueItemKind,
} from "../../core/previewPlayerQueue";
import type { PreviewEvent, ProjectPreviewExportState, ShotRecord } from "../../core/types";
import type { RuntimeView } from "../../core/runtimeView";
import { MediaFrame, toMediaSrc } from "../common/MediaFrame";
import { shortStoryFunction } from "./MinimalStoryFlow";

function previewQueueKind(event: PreviewEvent): PreviewQueueItemKind {
  if (event.type === "blocked_placeholder" || !event.mediaPath) return "missing_placeholder";
  if (event.type === "video_clip") return "video_clip";
  return "image_hold";
}

function buildPreviewPlayerQueue(previewExport: ProjectPreviewExportState, shots: ShotRecord[]): PreviewQueueItem[] {
  const draftEvents = previewExport.draftPreview.events.filter(
    (event) =>
      event.type === "image_hold" ||
      event.type === "video_clip" ||
      (event.type === "blocked_placeholder" && previewQueueKind(event) === "missing_placeholder"),
  );
  return buildCorePreviewPlayerQueue(
    { ...previewExport, draftPreview: { ...previewExport.draftPreview, events: draftEvents } },
    shots,
  );
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function MinimalPreview({
  previewExport,
  currentProjectPreviewItems,
  sections,
  shots,
  selectedShotId,
  onSelectShot,
}: {
  previewExport: ProjectPreviewExportState;
  currentProjectPreviewItems?: PreviewQueueItem[];
  sections: RuntimeView["storySections"];
  shots: ShotRecord[];
  selectedShotId: string;
  onSelectShot: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackQueue = useMemo(() => buildPreviewPlayerQueue(previewExport, shots), [previewExport, shots]);
  const queue = currentProjectPreviewItems ?? fallbackQueue;
  const projection = useMemo(() => buildMinimalRuntimeProjection({ previewQueue: queue }), [queue]);
  const total = Math.max(1, getPreviewPlayerTotalDuration(queue));
  const activeItem = getPreviewPlayerActiveItem(queue, currentTime);
  const activeShot = activeItem?.shotId ? shots.find((shot) => shot.id === activeItem.shotId) : undefined;
  const progress = Math.min(100, Math.max(0, (currentTime / total) * 100));

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!queue.length) {
      setPlaying(false);
      currentTimeRef.current = 0;
      setCurrentTime(0);
      return;
    }
    setCurrentTime((time) => {
      const nextTime = Math.min(Math.max(0, time), total);
      currentTimeRef.current = nextTime;
      return nextTime;
    });
  }, [queue, total]);

  useEffect(() => {
    if (!playing || !queue.length) return undefined;
    let frame = 0;
    let stopped = false;
    let previous = performance.now();
    const tick = (now: number) => {
      if (stopped) return;
      const deltaSeconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      const nextTime = Math.min(total, currentTimeRef.current + deltaSeconds);
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      if (nextTime >= total) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [playing, queue.length, total]);

  useEffect(() => {
    const selectedItem = queue.find((item) => item.shotId === selectedShotId);
    if (!selectedItem) return;
    setCurrentTime((time) => {
      const itemAtTime = getPreviewPlayerActiveItem(queue, time);
      if (playing && itemAtTime?.shotId === selectedShotId) return time;
      const nextTime = Math.abs(time - selectedItem.startSeconds) < 0.05 ? time : selectedItem.startSeconds;
      currentTimeRef.current = nextTime;
      return nextTime;
    });
  }, [playing, queue, selectedShotId]);

  useEffect(() => {
    if (playing && activeItem?.shotId && activeItem.shotId !== selectedShotId) onSelectShot(activeItem.shotId);
  }, [activeItem?.shotId, onSelectShot, playing, selectedShotId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.kind !== "video_clip") return;
    const mediaTime = Math.max(0, currentTime - activeItem.startSeconds);
    if (Number.isFinite(mediaTime) && Math.abs(video.currentTime - mediaTime) > 0.75) {
      try {
        video.currentTime = mediaTime;
      } catch {
        // Some browsers reject seeks before metadata is ready.
      }
    }
  }, [activeItem?.id, activeItem?.kind, activeItem?.startSeconds, currentTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.kind !== "video_clip") return;
    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [activeItem?.id, activeItem?.kind, playing]);

  const togglePlaying = () => {
    if (!queue.length) return;
    setPlaying((value) => {
      if (value) return false;
      setCurrentTime((time) => {
        const nextTime = time >= total ? 0 : time;
        currentTimeRef.current = nextTime;
        return nextTime;
      });
      return true;
    });
  };

  const selectPreviewItem = (item: PreviewQueueItem) => {
    currentTimeRef.current = item.startSeconds;
    setCurrentTime(item.startSeconds);
    if (item.shotId) onSelectShot(item.shotId);
  };

  return (
    <main className="minimal-preview-view">
      <section className="preview-stage">
        {activeItem?.kind === "image_hold" ? (
          <MediaFrame
            src={activeItem.mediaPath}
            alt={activeItem.shotId || "Preview"}
            label={activeItem.label}
            className="preview-stage-image"
          />
        ) : activeItem?.kind === "video_clip" && activeItem.mediaPath ? (
          <video
            key={activeItem.id}
            ref={videoRef}
            className="preview-stage-video"
            src={toMediaSrc(activeItem.mediaPath)}
            muted
            playsInline
          />
        ) : (
          <div className={`preview-stage-card ${activeItem?.kind || "missing_placeholder"}`}>
            <span>Missing</span>
            <strong>{activeItem?.label || "Preview"}</strong>
            <small>{activeShot ? shortStoryFunction(activeShot, shots.indexOf(activeShot)) : "Hold"}</small>
          </div>
        )}
        <button className="preview-play-button" onClick={togglePlaying} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseCircle size={42} /> : <Play size={42} />}
        </button>
      </section>
      <section className="minimal-preview-controls">
        <div className="preview-ruler">
          {sections.map((section) => {
            const firstShotId = section.shotIds[0];
            const item = queue.find((candidate) => candidate.shotId === firstShotId);
            const left = item ? (item.startSeconds / total) * 100 : 0;
            return (
              <span
                key={section.id}
                className={left <= 2 ? "edge-start" : left >= 98 ? "edge-end" : undefined}
                style={{ left: `${left}%` }}
              >
                {section.label}
              </span>
            );
          })}
        </div>
        <div className="preview-line">
          {queue.map((item) => (
            <button
              key={item.id}
              className={`preview-line-event ${item.kind} ${item.id === activeItem?.id ? "selected" : ""}`}
              style={{
                left: `${(item.startSeconds / total) * 100}%`,
                width: `${Math.max(3, (item.durationSeconds / total) * 100)}%`,
              }}
              onClick={() => selectPreviewItem(item)}
              aria-label={item.label}
            />
          ))}
          <span className="preview-line-progress" style={{ left: `${progress}%` }} />
        </div>
        <div className="preview-time-row">
          <button onClick={togglePlaying}>{playing ? <PauseCircle size={17} /> : <Play size={17} />}</button>
          <span>{formatDuration(currentTime)} / {formatDuration(total)}</span>
        </div>
        <p className="preview-export-summary" aria-label="Preview summary">
          {projection.previewSummary.detail} · {formatDuration(total)}
        </p>
      </section>
    </main>
  );
}
