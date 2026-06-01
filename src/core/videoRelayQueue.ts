export const videoRelayQueueSchemaVersion = "0.1.0";

export type VideoRelayQueueItemStatus =
  | "planned"
  | "ready"
  | "submitted"
  | "generating"
  | "recoverable_queued"
  | "success"
  | "failed"
  | "blocked"
  | "paused";

export interface VideoRelayQueueItem {
  id: string;
  shotId: string;
  title: string;
  status: VideoRelayQueueItemStatus;
  modelVersion: string;
  videoResolution: string;
  durationSeconds: number;
  promptPath?: string;
  referencePaths: string[];
  submitId?: string;
  resumeCommand?: string;
  outputVideoPath?: string;
  outputVideoSha256?: string;
  localMediaPaths?: string[];
  attemptCount: number;
  blockers: string[];
  notes: string[];
}

export interface VideoRelayQueueState {
  schemaVersion: typeof videoRelayQueueSchemaVersion;
  generatedAt: string;
  queueId: string;
  storyboardConfirmed: boolean;
  status: "blocked" | "paused" | "idle" | "running" | "complete";
  maxConcurrentVideoJobs: 1;
  authorizationPolicy: {
    mode: "storyboard_confirmation_authorizes_serial_relay";
    batchAuthorizationRequired: false;
    perTaskAuthorizationRequired: false;
    reviewStillRequired: true;
    notes: string[];
  };
  counts: {
    total: number;
    ready: number;
    active: number;
    completed: number;
    failed: number;
    blocked: number;
  };
  activeItemIds: string[];
  nextReadyItemId?: string;
  autoSubmitAllowed: boolean;
  resumeCommands: string[];
  items: VideoRelayQueueItem[];
  userSummary: string;
  notes: string[];
}

export interface BuildVideoRelayQueueStateInput {
  generatedAt: string;
  queueId?: string;
  storyboardConfirmed: boolean;
  paused?: boolean;
  items: VideoRelayQueueItem[];
}

function active(status: VideoRelayQueueItemStatus): boolean {
  return status === "submitted" || status === "generating" || status === "recoverable_queued";
}

function ready(status: VideoRelayQueueItemStatus): boolean {
  return status === "planned" || status === "ready";
}

function completed(status: VideoRelayQueueItemStatus): boolean {
  return status === "success";
}

function failed(status: VideoRelayQueueItemStatus): boolean {
  return status === "failed";
}

function blocked(status: VideoRelayQueueItemStatus): boolean {
  return status === "blocked";
}

function terminal(item: VideoRelayQueueItem): boolean {
  return completed(item.status) || failed(item.status) || blocked(item.status);
}

function canQueue(item: VideoRelayQueueItem): boolean {
  return ready(item.status) && item.blockers.length === 0;
}

export function buildVideoRelayQueueState(input: BuildVideoRelayQueueStateInput): VideoRelayQueueState {
  const activeItems = input.items.filter((item) => active(item.status));
  const readyItems = input.items.filter(canQueue);
  const completedItems = input.items.filter((item) => completed(item.status));
  const failedItems = input.items.filter((item) => failed(item.status));
  const blockedItems = input.items.filter((item) => blocked(item.status));
  const paused = input.paused === true;
  const nextReadyItem = !input.storyboardConfirmed || paused || activeItems.length > 0 ? undefined : readyItems[0];
  const allDone = input.items.length > 0 && input.items.every(terminal);
  const status: VideoRelayQueueState["status"] = !input.storyboardConfirmed
    ? "blocked"
    : paused
      ? "paused"
      : activeItems.length
        ? "running"
        : allDone
          ? "complete"
          : "idle";

  return {
    schemaVersion: videoRelayQueueSchemaVersion,
    generatedAt: input.generatedAt,
    queueId: input.queueId || "video_relay_queue_current",
    storyboardConfirmed: input.storyboardConfirmed,
    status,
    maxConcurrentVideoJobs: 1,
    authorizationPolicy: {
      mode: "storyboard_confirmation_authorizes_serial_relay",
      batchAuthorizationRequired: false,
      perTaskAuthorizationRequired: false,
      reviewStillRequired: true,
      notes: [
        "Once the user confirms the storyboard/reference plan, the relay may submit the next video job serially.",
        "No extra batch authorization or per-task authorization is required for this queue.",
        "Returned videos still enter review and are not auto-promoted.",
      ],
    },
    counts: {
      total: input.items.length,
      ready: readyItems.length,
      active: activeItems.length,
      completed: completedItems.length,
      failed: failedItems.length,
      blocked: blockedItems.length,
    },
    activeItemIds: activeItems.map((item) => item.id),
    nextReadyItemId: nextReadyItem?.id,
    autoSubmitAllowed: Boolean(input.storyboardConfirmed && !paused && !activeItems.length && nextReadyItem),
    resumeCommands: input.items
      .map((item) => item.resumeCommand || "")
      .filter(Boolean),
    items: input.items,
    userSummary: !input.storyboardConfirmed
      ? "先确认分镜和参考图，再开始视频生成。"
      : paused
        ? "视频生成已暂停，可以稍后继续。"
        : activeItems.length
          ? "即梦正在处理当前任务，回来后会继续下一个。"
          : nextReadyItem
            ? "已准备好提交下一个视频任务。"
            : allDone
              ? "视频队列已处理完，等待复核。"
              : "视频队列已准备，等待可提交任务。",
    notes: [
      "Jimeng/Seedance is treated as a serial provider: maxConcurrentVideoJobs=1.",
      "Queue state should be persisted beside Project.vibe/runtime state before a packaged app auto-runner is enabled.",
      "Use saved submitId/resumeCommand to recover queued jobs instead of resubmitting.",
    ],
  };
}
