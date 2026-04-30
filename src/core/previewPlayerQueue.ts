import type { PreviewEvent, ProjectPreviewExportState, ShotRecord } from "./types";

export type PreviewQueueItemKind = "image_hold" | "video_clip" | "missing_placeholder";

export interface PreviewQueueItem {
  id: string;
  kind: PreviewQueueItemKind;
  shotId?: string;
  startSeconds: number;
  durationSeconds: number;
  mediaPath?: string;
  label: string;
}

function formatShotNumber(id: string) {
  const match = id.match(/^A(\d+)_(\d+)$/i);
  if (!match) return id;
  return `${Number(match[1])}-${Number(match[2])}`;
}

function previewQueueKind(event: PreviewEvent): PreviewQueueItemKind {
  if (event.type === "blocked_placeholder") return "missing_placeholder";
  if (!event.mediaPath) return "missing_placeholder";
  if (event.type === "video_clip") return "video_clip";
  return "image_hold";
}

function previewQueueLabel(event: PreviewEvent, kind: PreviewQueueItemKind) {
  if (event.shotId) return formatShotNumber(event.shotId);
  if (kind === "video_clip") return "Clip";
  if (kind === "missing_placeholder") return "Missing";
  return "Hold";
}

function safeStartSeconds(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function safeDurationSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(1, value);
}

export function buildPreviewPlayerQueue(previewExport: ProjectPreviewExportState, shots: ShotRecord[]): PreviewQueueItem[] {
  const shotOrder = new Map(shots.map((shot, index) => [shot.id, index]));
  return previewExport.draftPreview.events
    .filter((event) => event.type === "image_hold" || event.type === "video_clip" || event.type === "blocked_placeholder")
    .sort((left, right) => {
      const leftStart = safeStartSeconds(left.startSeconds);
      const rightStart = safeStartSeconds(right.startSeconds);
      const timeDelta = leftStart - rightStart;
      if (timeDelta !== 0) return timeDelta;
      return (shotOrder.get(left.shotId || "") ?? 9999) - (shotOrder.get(right.shotId || "") ?? 9999);
    })
    .map((event) => {
      const kind = previewQueueKind(event);
      return {
        id: event.id,
        kind,
        shotId: event.shotId,
        startSeconds: safeStartSeconds(event.startSeconds),
        durationSeconds: safeDurationSeconds(event.durationSeconds),
        mediaPath: kind === "missing_placeholder" ? undefined : event.mediaPath,
        label: previewQueueLabel(event, kind),
      };
    });
}

export function getPreviewPlayerTotalDuration(queue: PreviewQueueItem[]) {
  return queue.reduce((max, item) => Math.max(max, item.startSeconds + item.durationSeconds), 0);
}

export function getPreviewPlayerActiveItem(queue: PreviewQueueItem[], currentTime: number) {
  if (!queue.length) return undefined;
  const time = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  const active = queue.find((item) => time >= item.startSeconds && time < item.startSeconds + item.durationSeconds);
  if (active) return active;
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (time >= queue[index].startSeconds) return queue[index];
  }
  return queue[0];
}
