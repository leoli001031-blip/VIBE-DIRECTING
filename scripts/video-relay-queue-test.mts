import { buildVideoRelayQueueState, type VideoRelayQueueItem } from "../src/core/videoRelayQueue.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-22T21:40:00.000Z";

function item(id: string, status: VideoRelayQueueItem["status"], extra: Partial<VideoRelayQueueItem> = {}): VideoRelayQueueItem {
  return {
    id,
    shotId: id.replace(/^video_/, "shot_"),
    title: `镜头 ${id}`,
    status,
    modelVersion: "seedance2.0",
    videoResolution: "720p",
    durationSeconds: 8,
    promptPath: `prompts/${id}.md`,
    referencePaths: [`storyboards/${id}.png`],
    attemptCount: 0,
    blockers: [],
    notes: [],
    ...extra,
  };
}

const blockedBeforeConfirmation = buildVideoRelayQueueState({
  generatedAt,
  storyboardConfirmed: false,
  items: [item("video_001", "ready")],
});
assert(blockedBeforeConfirmation.status === "blocked", "relay should block before storyboard confirmation");
assert(blockedBeforeConfirmation.autoSubmitAllowed === false, "relay must not submit before storyboard confirmation");
assert(blockedBeforeConfirmation.authorizationPolicy.batchAuthorizationRequired === false, "batch auth should not be required");
assert(blockedBeforeConfirmation.authorizationPolicy.perTaskAuthorizationRequired === false, "per-task auth should not be required");

const firstReady = buildVideoRelayQueueState({
  generatedAt,
  storyboardConfirmed: true,
  items: [
    item("video_001", "ready"),
    item("video_002", "ready"),
  ],
});
assert(firstReady.status === "idle", "confirmed queue with ready work should be idle before submit");
assert(firstReady.autoSubmitAllowed === true, "confirmed queue should allow next serial submit");
assert(firstReady.nextReadyItemId === "video_001", "relay should choose the first ready item");
assert(firstReady.maxConcurrentVideoJobs === 1, "Jimeng relay must stay serial");

const running = buildVideoRelayQueueState({
  generatedAt,
  storyboardConfirmed: true,
  items: [
    item("video_001", "recoverable_queued", {
      submitId: "submit-001",
      resumeCommand: "dreamina query_result --submit_id=submit-001 --download_dir=video/001",
    }),
    item("video_002", "ready"),
  ],
});
assert(running.status === "running", "queued provider task should mark relay running");
assert(running.autoSubmitAllowed === false, "relay must not submit another job while one is active");
assert(running.activeItemIds.join(",") === "video_001", "active item mismatch");
assert(running.resumeCommands.length === 1, "resume command should be preserved");

const resumedNext = buildVideoRelayQueueState({
  generatedAt,
  storyboardConfirmed: true,
  items: [
    item("video_001", "success", {
      submitId: "submit-001",
      resumeCommand: "dreamina query_result --submit_id=submit-001 --download_dir=video/001",
    }),
    item("video_002", "ready"),
  ],
});
assert(resumedNext.autoSubmitAllowed === true, "relay should continue after previous success");
assert(resumedNext.nextReadyItemId === "video_002", "relay should move to the next item after success");

const failedWithNextReady = buildVideoRelayQueueState({
  generatedAt,
  storyboardConfirmed: true,
  items: [
    item("video_001", "success"),
    item("video_002", "failed", {
      blockers: ["上一轮提交失败，等待重试或跳过。"],
    }),
    item("video_003", "ready"),
  ],
});
assert(failedWithNextReady.status === "idle", "failed item with blockers must not make a queue with ready work look complete");
assert(failedWithNextReady.nextReadyItemId === "video_003", "relay should still expose the next ready item after a failed segment");
assert(failedWithNextReady.autoSubmitAllowed === true, "relay may continue to ready work after a failed segment when storyboard authorization is already confirmed");
assert(failedWithNextReady.counts.failed === 1, "failed count mismatch");
assert(failedWithNextReady.counts.blocked === 0, "failed items must not be double-counted as blocked just because they carry blocker notes");

const paused = buildVideoRelayQueueState({
  generatedAt,
  storyboardConfirmed: true,
  paused: true,
  items: [item("video_001", "ready")],
});
assert(paused.status === "paused", "paused relay should expose paused status");
assert(paused.autoSubmitAllowed === false, "paused relay must not submit");

const serialized = JSON.stringify({ blockedBeforeConfirmation, firstReady, running, resumedNext, paused });
for (const forbidden of ["sk-", "api_key", "credential", "password"]) {
  assert(!serialized.toLowerCase().includes(forbidden), `relay queue must not leak secret-like data: ${forbidden}`);
}

console.log("video-relay-queue-test: ok");
