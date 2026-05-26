import { useEffect, useMemo, useRef, useState } from "react";
import { PauseCircle, Play, Volume2, VolumeX } from "lucide-react";
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
import type { JimengVideoStatusProjection } from "../../core/jimengVideoCli";
import { MediaFrame, toMediaSrc } from "../common/MediaFrame";
import { formatShotNumber } from "./MinimalStoryFlow";

type DisplayItem = PreviewQueueItem & {
  reviewRequired?: boolean;
  previewQaStatus?: string;
  productionQaStatus?: string;
  status?: string;
  videoGeneration?: JimengVideoStatusProjection;
};

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

function previewItemLabel(item?: PreviewQueueItem) {
  if (!item) return "预览画面";
  return formatShotNumber(item.label || item.shotId || "预览画面");
}

function previewSectionLabel(label: string) {
  return /current[-_\s]*project/i.test(label) ? "当前项目故事流" : label;
}

function previewNeedsReview(item?: DisplayItem) {
  if (!item) return false;
  return item.reviewRequired === true
    || /review|复核/i.test(`${item.status || ""} ${item.previewQaStatus || ""} ${item.productionQaStatus || ""}`);
}

function previewVideoStatusVisible(item?: DisplayItem) {
  const video = item?.videoGeneration;
  if (!video) return false;
  return video.status !== "not_generated" || video.hasSubmitId || video.hasVideo || video.hasQueueInfo;
}

function previewVideoStatusLabel(item?: DisplayItem) {
  const video = item?.videoGeneration;
  return previewVideoStatusVisible(item) && video ? `视频${video.label}` : "";
}

function previewVideoStageCopy(item?: DisplayItem) {
  const video = item?.videoGeneration;
  if (!previewVideoStatusVisible(item) || !video) {
    return {
      label: "素材待补齐",
      detail: "镜头参考或视频还没有回到预览。",
    };
  }
  return {
    label: video.label,
    detail: video.detail,
  };
}

export function MinimalPreview({
  previewExport,
  currentProjectPreviewItems,
  emptyStateLabel = "预览还没有可播放素材",
  emptyStateDetail = "等待故事流和素材同步后，这里会自动显示可播放画面。",
  sections,
  shots,
  selectedShotId,
  onSelectShot,
}: {
  previewExport: ProjectPreviewExportState;
  currentProjectPreviewItems?: PreviewQueueItem[];
  emptyStateLabel?: string;
  emptyStateDetail?: string;
  sections: RuntimeView["storySections"];
  shots: ShotRecord[];
  selectedShotId: string;
  onSelectShot: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackQueue = useMemo(() => buildPreviewPlayerQueue(previewExport, shots), [previewExport, shots]);
  const queue = currentProjectPreviewItems ?? fallbackQueue;
  const projection = useMemo(() => buildMinimalRuntimeProjection({ previewQueue: queue }), [queue]);
  const total = queue.length ? Math.max(1, getPreviewPlayerTotalDuration(queue)) : 0;
  const layoutTotal = Math.max(1, total);
  const activeItem = getPreviewPlayerActiveItem(queue, currentTime) as DisplayItem | undefined;
  const activeLabel = previewItemLabel(activeItem);
  const activeNeedsReview = previewNeedsReview(activeItem);
  const activeVideoStatusLabel = previewVideoStatusLabel(activeItem);
  const progress = total > 0 ? Math.min(100, Math.max(0, (currentTime / total) * 100)) : 0;
  const reviewCount = queue.filter((item) => previewNeedsReview(item as DisplayItem)).length;
  const previewStatusLabel = !queue.length
    ? "待准备"
    : activeVideoStatusLabel || (reviewCount > 0 ? `${reviewCount} 个待复核` : "可播放");

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
    video.muted = muted;
  }, [activeItem?.id, activeItem?.kind, muted]);

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

  const missingCopy = previewVideoStageCopy(activeItem);
  const missingDiv = (
    <div className="preview-stage-card missing_placeholder">
      {missingCopy.label === "素材待补齐" ? <b>素材待补齐</b> : <b>{missingCopy.label}</b>}
      <em>{missingCopy.detail}</em>
    </div>
  );
  const isImage = activeItem?.kind === "image_hold";
  const isVideo = activeItem?.kind === "video_clip" && activeItem.mediaPath;
  const isMissing = !isImage && !isVideo && queue.length;
  const isPlaceholder = !isImage && !isVideo && !isMissing;
  const rulerItems = useMemo(() => sections.map((section) => {
    const firstShotId = section.shotIds[0];
    const item = queue.find((candidate) => candidate.shotId === firstShotId);
    const left = item ? (item.startSeconds / layoutTotal) * 100 : 0;
    return { id: section.id, label: previewSectionLabel(section.label), left };
  }), [sections, queue, layoutTotal]);

  return (
    <main className="minimal-preview-view">
      <div className="minimal-preview-head">
        <div>
          <b>预览</b>
          <h2>{activeLabel}</h2>
        </div>
        <div className="preview-status-strip" aria-label="预览状态">
          <b>{queue.length} 段</b>
          <b>{formatDuration(total)}</b>
          <b>{previewStatusLabel}</b>
        </div>
      </div>
      <section
        className="preview-stage selected"
        aria-label={`当前选中预览：${activeLabel}`}
        onClick={() => activeItem?.shotId && onSelectShot(activeItem.shotId)}
      >
        {isImage && <MediaFrame src={activeItem.mediaPath} alt={activeLabel} label={activeLabel} className="preview-stage-image" />}
        {isVideo && <video key={activeItem.id} ref={videoRef} className="preview-stage-video" src={toMediaSrc(activeItem.mediaPath)} muted={muted} playsInline />}
        {isMissing && missingDiv}
        {isPlaceholder && (
          <div className="preview-stage-card missing_placeholder">
            <b>{emptyStateLabel}</b>
            <em>{emptyStateDetail}</em>
          </div>
        )}
        {activeNeedsReview && <b className="preview-review-badge">待复核</b>}
        <button className="preview-play-button" onClick={togglePlaying} aria-label={playing ? "暂停预览" : "播放预览"}>
          {playing ? <PauseCircle size={42} /> : <Play size={42} />}
        </button>
      </section>
      <section className="minimal-preview-controls">
        <div className="preview-ruler">
          {rulerItems.map((ri) => (
            <b key={ri.id} className={ri.left <= 2 ? "edge-start" : ri.left >= 98 ? "edge-end" : undefined} style={{ left: `${ri.left}%` }}>{ri.label}</b>
          ))}
        </div>
        <div className="preview-line">
          {queue.map((item) => (
            <button
              key={item.id}
              className={`preview-line-event ${item.kind} ${previewNeedsReview(item as DisplayItem) ? "needs_review" : ""} ${item.id === activeItem?.id ? "selected" : ""}`}
              style={{
                left: `${(item.startSeconds / layoutTotal) * 100}%`,
                width: `${Math.max(3, (item.durationSeconds / layoutTotal) * 100)}%`,
              }}
              onClick={() => selectPreviewItem(item)}
              aria-label={[previewItemLabel(item), previewVideoStatusLabel(item as DisplayItem)].filter(Boolean).join(" · ")}
            />
          ))}
          <i className="preview-line-progress" style={{ left: `${progress}%` }} />
        </div>
        <div className="preview-time-row">
          <button onClick={togglePlaying} aria-label={playing ? "暂停预览" : "播放预览"}>{playing ? <PauseCircle size={17} /> : <Play size={17} />}</button>
          <button onClick={() => setMuted((value) => !value)} aria-label={muted ? "打开声音" : "静音"}>
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <b>{formatDuration(currentTime)} / {formatDuration(total)}</b>
        </div>
        <p className="preview-export-summary" aria-label="预览摘要">
          {projection.previewSummary.detail} · {formatDuration(total)}
        </p>
      </section>
    </main>
  );
}
