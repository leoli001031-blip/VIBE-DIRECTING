import fs from "node:fs";
import {
  assert,
  loadCore,
} from "./demo-runtime-fixture.mts";

async function loadCurrentProjectPreviewProjectionCore() {
  const core = await loadCore();
  return core.currentProjectPreviewProjection;
}

const {
  buildCurrentProjectPreviewProjection,
  currentProjectPreviewProjectionSource,
} = await loadCurrentProjectPreviewProjectionCore();

const sourceText = fs.readFileSync("src/core/currentProjectPreviewProjection.ts", "utf8");
assert(!sourceText.includes("previewExport"), "current project preview projection must not depend on runtimeState.previewExport");
assert(!sourceText.includes("image2_start_long_chain_report"), "current project preview projection must not depend on legacy image2 report fallback");

const currentProject = {
  projectId: "self_contained_preview_projection",
  projectRoot: "/workspace/self-contained",
};

const previewPlan = {
  previewStatus: "ready_with_review",
  productionStatus: "needs_review",
  clips: [
    {
      clipId: "clip-s01",
      order: 1,
      shotId: "S01",
      type: "image",
      mediaPath: "/api/runtime/files?path=outputs%2FS01.png",
      durationSeconds: 2.5,
      status: "returned",
    },
    {
      clipId: "clip-s02",
      order: 2,
      shotId: "S02",
      mediaType: "video/mp4",
      fileUrl: "/api/runtime/files?path=outputs%2FS02.mp4",
      durationSeconds: 6,
      status: "returned_with_review_overlay",
      previewQaStatus: "needs_review",
    },
    {
      clipId: "clip-s03",
      order: 3,
      shotId: "S03",
      type: "image",
      durationSeconds: 1.5,
      status: "missing",
    },
    {
      clipId: "clip-s04",
      order: 4,
      shotId: "S04",
      mediaType: "video/mp4",
      mediaPath: "/workspace/self-contained/outputs/S04.mp4",
      durationSeconds: 4,
      status: "blocked_by_runtime_truth",
    },
  ],
};

const summary = {
  status: "preview_ready_with_review",
  projectId: currentProject.projectId,
  projectRoot: currentProject.projectRoot,
  generatedAt: "2026-05-18T00:00:00.000Z",
  previewStatus: previewPlan.previewStatus,
  productionStatus: previewPlan.productionStatus,
  reviewShotIds: ["S02"],
};

const planOnlyProjection = buildCurrentProjectPreviewProjection({
  summary,
  previewPlan,
});
assert(planOnlyProjection.available === true, "plan-only projection should be available");
assert(planOnlyProjection.source === currentProjectPreviewProjectionSource, "projection source must identify current project runtime truth");
assert(planOnlyProjection.providerCalled === false, "projection must hard-lock provider calls");
assert(planOnlyProjection.liveSubmitAllowed === false, "projection must hard-lock live submit");
assert(planOnlyProjection.workerSpawnForbidden === true, "projection must hard-lock worker spawn");
assert(planOnlyProjection.projectId === currentProject.projectId, "project id should be preserved");
assert(planOnlyProjection.projectRoot === currentProject.projectRoot, "project root should be preserved");
assert(planOnlyProjection.items.map((item) => item.shotId).join(",") === "S01,S02,S03,S04", "projection order should follow preview plan");
assert(planOnlyProjection.items.map((item) => item.kind).join(",") === "image_hold,video_clip,missing_placeholder,missing_placeholder", "projection must map image/video/missing/blocked kinds for Preview Player");
assert(planOnlyProjection.items.map((item) => item.durationSeconds).join(",") === "2.5,6,1.5,4", "projection must preserve clip durations");
assert(planOnlyProjection.items.map((item) => item.startSeconds).join(",") === "0,2.5,8.5,10", "projection must accumulate startSeconds from durations");
assert(planOnlyProjection.totalDurationSeconds === 14, "projection total duration must include placeholders");
assert(planOnlyProjection.items.find((item) => item.shotId === "S02")?.reviewRequired === true, "review state must be preserved");
assert(planOnlyProjection.reviewCount === 1, "review count should preserve S02 only");
assert(planOnlyProjection.returnedCount === 2, "returned count should include returned image/video clips");
assert(planOnlyProjection.blockedCount === 2, "missing and blocked clips should count as blocked");
assert(planOnlyProjection.missingCount === 2, "missing and blocked placeholders should count as missing");
assert(planOnlyProjection.items.find((item) => item.shotId === "S03")?.mediaPath === undefined, "missing clip must not expose media");
assert(planOnlyProjection.items.find((item) => item.shotId === "S04")?.mediaPath === undefined, "blocked clip must not expose media");

const runtimeProjection = buildCurrentProjectPreviewProjection({
  summary: {
    ...summary,
    reviewShotIds: [],
    previewItems: [
      {
        id: "runtime-s01",
        shotId: "S01",
        order: 1,
        imageUrl: "/api/runtime/files?path=runtime%2FS01.png",
        outputExists: true,
        status: "returned",
      },
      {
        id: "runtime-s02",
        shotId: "S02",
        order: 2,
        imageUrl: "/api/runtime/files?path=runtime%2FS02.png",
        outputExists: true,
        status: "returned_with_review_overlay",
        reviewOverlay: true,
      },
      {
        id: "runtime-s03",
        shotId: "S03",
        order: 3,
        expectedOutputPath: "runtime/S03.png",
        outputExists: false,
        status: "provider_self_reported_success",
      },
    ],
  },
  previewPlan,
});
assert(runtimeProjection.available === true, "runtime preview projection should be available");
assert(runtimeProjection.items.map((item) => item.shotId).join(",") === "S01,S02,S03", "runtime items should override plan-only clips");
assert(runtimeProjection.returnedCount === 2, "runtime projection should trust returned files only");
assert(runtimeProjection.missingCount === 1, "provider self-report without output should become missing");
assert(runtimeProjection.items.find((item) => item.shotId === "S03")?.kind === "missing_placeholder", "provider self-report must not render media");
assert(!JSON.stringify(runtimeProjection).includes("real-demo-005"), "projection must not leak legacy fixture identity");

const defaultDurationProjection = buildCurrentProjectPreviewProjection({
  summary,
  previewPlan: { ...previewPlan, clips: previewPlan.clips.map(({ durationSeconds, ...clip }) => clip) },
});
assert(defaultDurationProjection.items.every((item) => item.durationSeconds === 5), "missing clip duration should default to 5s");

const unbound = buildCurrentProjectPreviewProjection({
  summary: { status: "unbound", projectId: "should_not_queue", previewItems: [] },
  previewItems: [],
  previewPlan: { clips: [] },
});
assert(unbound.available === false, "unbound summary should be unavailable");
assert(unbound.queue.length === 0, "unbound summary should output an empty queue");
assert(unbound.totalDurationSeconds === 0, "unbound summary should not create duration");

console.log("Current project preview projection tests passed. Self-contained runtime truth + preview plan data produce a Preview Player queue without provider calls.");
