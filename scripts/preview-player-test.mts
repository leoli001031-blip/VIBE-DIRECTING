import fs from "node:fs";
import {
  buildMissingPreviewQueueFromShots,
  buildPreviewPlayerQueue,
  getPreviewPlayerActiveItem,
  getPreviewPlayerTotalDuration,
} from "../src/core/previewPlayerQueue.ts";
import { buildPreviewExportState } from "../src/core/previewExport.ts";

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} is missing`);

  const paramsOpen = source.indexOf("(", start);
  let paramDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramDepth += 1;
    if (char === ")") paramDepth -= 1;
    if (paramDepth === 0) {
      paramsClose = index;
      break;
    }
  }

  const open = source.indexOf("{", paramsClose);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }

  throw new Error(`${functionName} body was not closed`);
}

function countPattern(source, pattern) {
  return (source.match(pattern) || []).length;
}

function visibleUiCopy(source) {
  const copies = [];
  for (const match of source.matchAll(/>([^<>{}]+)</g)) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (text) copies.push(text);
  }
  for (const match of source.matchAll(/aria-label=\{[^?]+\?\s*"([^"]+)"\s*:\s*"([^"]+)"\}/g)) {
    copies.push(match[1], match[2]);
  }
  for (const match of source.matchAll(/aria-label="([^"]+)"/g)) copies.push(match[1]);
  return copies.join(" ");
}

function event(overrides) {
  return {
    id: overrides.id,
    mode: "draft",
    type: "image_hold",
    shotId: overrides.shotId,
    startSeconds: 0,
    durationSeconds: 3,
    mediaPath: "media/default.png",
    qaStatus: "PASS",
    ...overrides,
  };
}

function previewExport(events) {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-05-01T00:00:00.000Z",
    draftPreview: {
      schemaVersion: "0.1.0",
      planId: "draft",
      mode: "draft",
      status: "draft_only",
      summary: {
        mode: "draft",
        status: "draft_only",
        eventCount: events.length,
        videoClipCount: 0,
        imageHoldCount: 0,
        blockedPlaceholderCount: 0,
        totalDurationSeconds: 0,
        blockedShotIds: [],
        blockedReasons: [],
      },
      events,
      blockedReasons: [],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    formalPreview: {
      schemaVersion: "0.1.0",
      planId: "formal",
      mode: "formal",
      status: "blocked",
      summary: {
        mode: "formal",
        status: "blocked",
        eventCount: 0,
        videoClipCount: 0,
        imageHoldCount: 0,
        blockedPlaceholderCount: 0,
        totalDurationSeconds: 0,
        blockedShotIds: [],
        blockedReasons: [],
      },
      events: [],
      blockedReasons: [],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    formalPreviewGate: {
      status: "blocked",
      requiredChecks: {
        noBlockedMaterial: false,
        pairQaPass: false,
        videoQaPass: false,
        manifestMatched: false,
        promotionPassed: false,
        noP0Issues: false,
        noUnknownGate: false,
        videoPresent: false,
      },
      blockedReasons: [],
    },
    roughCutProxy: {
      status: "blocked",
      sourcePreviewPlanId: "draft",
      totalDurationSeconds: 0,
      eventCount: 0,
      proxyOnly: true,
      notes: [],
    },
    exportProfiles: [],
    exportPackagePlan: {
      schemaVersion: "0.1.0",
      planId: "package",
      status: "blocked",
      profiles: [],
      futureTargets: [],
      blockedReasons: [],
      notes: [],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
  };
}

function shot(id) {
  return {
    id,
    actId: "A1",
    title: id,
    storyFunction: "Beat",
    status: "ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "N/A",
      style: "PASS",
    },
    issues: [],
  };
}

const shots = [shot("S01"), shot("S02"), shot("S03")];
const mixedQueue = buildPreviewPlayerQueue(
  previewExport([
    event({ id: "missing-third", type: "blocked_placeholder", shotId: "S03", startSeconds: 8.5, durationSeconds: 1.5, mediaPath: "media/hidden-debug.png" }),
    event({ id: "video-second", type: "video_clip", shotId: "S02", startSeconds: 2.5, durationSeconds: 6, mediaPath: "media/s02.mp4" }),
    event({ id: "image-first", type: "image_hold", shotId: "S01", startSeconds: 0, durationSeconds: 2.5, mediaPath: "media/s01.png" }),
  ]),
  shots,
);
assert(mixedQueue.map((item) => item.id).join(",") === "image-first,video-second,missing-third", "mixed queue must sort image/video/missing by timeline start");
assert(mixedQueue.map((item) => item.kind).join(",") === "image_hold,video_clip,missing_placeholder", "mixed queue must preserve image/video and convert missing to placeholder");
assert(mixedQueue.map((item) => item.startSeconds).join(",") === "0,2.5,8.5", "mixed queue must preserve startSeconds");
assert(mixedQueue.map((item) => item.durationSeconds).join(",") === "2.5,6,1.5", "mixed queue must preserve shot durations");
assert(mixedQueue[1].mediaPath === "media/s02.mp4", "video clip must carry its media path");
assert(mixedQueue[2].mediaPath === undefined, "missing placeholder must not carry a hidden media path");
assert(getPreviewPlayerTotalDuration(mixedQueue) === 10, "mixed queue total duration must equal the final shot end");
assert(getPreviewPlayerActiveItem(mixedQueue, 0)?.id === "image-first", "image hold must be active at timeline start");
assert(getPreviewPlayerActiveItem(mixedQueue, 2.5)?.id === "video-second", "video clip must replace the image hold at its boundary");
assert(getPreviewPlayerActiveItem(mixedQueue, 8.5)?.id === "missing-third", "missing placeholder must become active at its boundary");

const replacementQueue = buildPreviewPlayerQueue(
  previewExport([
    event({ id: "image-replaced", type: "image_hold", shotId: "S01", startSeconds: 0, durationSeconds: 3, mediaPath: "media/s01.png" }),
    event({ id: "video-same-start", type: "video_clip", shotId: "S01", startSeconds: 0, durationSeconds: 3, mediaPath: "media/s01.mp4" }),
    event({ id: "image-other-shot-same-start", type: "image_hold", shotId: "S02", startSeconds: 0, durationSeconds: 2, mediaPath: "media/s02.png" }),
    event({ id: "image-same-shot-later", type: "image_hold", shotId: "S01", startSeconds: 3, durationSeconds: 2, mediaPath: "media/s01-later.png" }),
  ]),
  shots,
);
assert(
  replacementQueue.map((item) => item.id).join(",") === "video-same-start,image-other-shot-same-start,image-same-shot-later",
  "renderable video_clip must replace only the same-shot same-start image_hold",
);
assert(replacementQueue[0].kind === "video_clip" && replacementQueue[0].mediaPath === "media/s01.mp4", "same-start replacement must keep the renderable video item");
assert(replacementQueue[1].kind === "image_hold", "same-start image_hold for a different shot must remain");
assert(replacementQueue[2].kind === "image_hold" && replacementQueue[2].startSeconds === 3, "same-shot image_hold at a different start must remain");
assert(getPreviewPlayerTotalDuration(replacementQueue) === 5, "replacement queue total duration must still use remaining segment durations");
assert(getPreviewPlayerActiveItem(replacementQueue, 0)?.id === "video-same-start", "replacement video must be active at its segment start");
assert(getPreviewPlayerActiveItem(replacementQueue, 3)?.id === "image-same-shot-later", "later same-shot image hold must remain playable");

const queue = buildPreviewPlayerQueue(
  previewExport([
    event({ id: "clip-missing", type: "video_clip", shotId: "S02", startSeconds: 4, durationSeconds: 0, mediaPath: undefined }),
    event({ id: "audio-filtered", type: "narration_audio", shotId: "S01", startSeconds: 1, durationSeconds: 9, mediaPath: undefined }),
    event({ id: "image-first", type: "image_hold", shotId: "S01", startSeconds: 0, durationSeconds: 4, mediaPath: "media/s01.png" }),
    event({ id: "video-third", type: "video_clip", shotId: "S03", startSeconds: 8, durationSeconds: Number.NaN, mediaPath: "media/s03.mp4" }),
    event({ id: "blocked-fourth", type: "blocked_placeholder", shotId: "S04", startSeconds: 12, durationSeconds: -2, mediaPath: "media/blocked.png" }),
  ]),
  shots,
);

assert(queue.map((item) => item.id).join(",") === "image-first,clip-missing,video-third,blocked-fourth", "queue must sort by sanitized timeline start and filter non-visual events");
assert(queue[0].kind === "image_hold", "image hold with media must stay image_hold");
assert(queue[1].kind === "missing_placeholder", "video_clip without mediaPath must become missing_placeholder");
assert(queue[1].mediaPath === undefined, "missing video item must not keep a media path");
assert(queue[2].kind === "video_clip" && queue[2].mediaPath === "media/s03.mp4", "video_clip with mediaPath must stay renderable");
assert(queue[1].durationSeconds === 1, "zero duration must sanitize to one second");
assert(queue[2].durationSeconds === 1, "NaN duration must sanitize to one second");
assert(queue[3].durationSeconds === 1, "negative duration must sanitize to one second");
assert(getPreviewPlayerTotalDuration(queue) === 13, "total duration must include sanitized placeholder duration");
assert(buildPreviewPlayerQueue(previewExport([]), shots).length === 0, "empty draft preview must produce an empty queue");
assert(getPreviewPlayerActiveItem([], 2) === undefined, "empty queue has no active item");
assert(getPreviewPlayerActiveItem(queue, 0)?.id === "image-first", "active item at start should be first event");
assert(getPreviewPlayerActiveItem(queue, 4)?.id === "clip-missing", "active item should switch on exact event boundary");
assert(getPreviewPlayerActiveItem(queue, 8.5)?.id === "video-third", "active item should follow current time");
assert(getPreviewPlayerActiveItem(queue, 99)?.id === "blocked-fourth", "active item after the end should remain stable");

const previewExportState = buildPreviewExportState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  projectRoot: "/workspace/demo",
  previewEvents: [
    event({ id: "stale-s01-image", type: "image_hold", shotId: "S01", startSeconds: 99, durationSeconds: 4, mediaPath: "outputs/keyframes/S01_start.png", mode: "draft_preview" }),
  ],
  shots: [
    { ...shot("S01"), startFrame: "outputs/keyframes/S01_start.png", videoPath: "outputs/videos/S01.mp4" },
    { ...shot("S02"), startFrame: "outputs/keyframes/S02_start.png" },
    { ...shot("S03"), startFrame: undefined, endFrame: undefined },
  ],
  jobs: [],
  taskRuns: [],
  taskViews: [],
  manifestMatches: [],
  generationHealthReports: [],
  qaPromotionReports: [],
  issues: [],
  selectedShotId: "S02",
});
const autoEvents = previewExportState.draftPreview.events;
assert(autoEvents.map((item) => item.shotId).join(",") === "S01,S02,S03", "preview export must rebuild draft queue in shot order");
assert(autoEvents[0].type === "video_clip" && autoEvents[0].mediaPath === "outputs/videos/S01.mp4", "existing video must replace a matching image hold");
assert(autoEvents[1].type === "image_hold" && autoEvents[1].durationSeconds === 3, "image-only shot must become a duration-based image hold");
assert(autoEvents[2].type === "blocked_placeholder" && !autoEvents[2].mediaPath, "missing shot media must become a minimal placeholder");
assert(autoEvents[1].startSeconds === autoEvents[0].durationSeconds, "auto preview queue must keep shot timing contiguous");
assert(previewExportState.demoPackageFacts.projectFactsSnapshot.selectedShotId === "S02", "selected shot fact must be carried with preview/export state");
assert(previewExportState.demoPackageFacts.selectedKeyframes.length === 1, "selected keyframes should narrow to the selected shot when present");
assert(previewExportState.demoPackageFacts.selectedKeyframes[0].shotId === "S02", "selected keyframes must sync with selected shot");

const localPlaceholderQueue = buildMissingPreviewQueueFromShots([
  { ...shot("S01"), durationSeconds: 4 },
  { ...shot("S02"), durationSeconds: 6 },
  { ...shot("S03"), durationSeconds: 2 },
]);
assert(localPlaceholderQueue.map((item) => item.durationSeconds).join(",") === "4,6,2", "local story placeholders must preserve per-shot duration");
assert(localPlaceholderQueue.map((item) => item.startSeconds).join(",") === "0,4,10", "local story placeholders must accumulate per-shot timing");

const returnedOutputPreview = buildPreviewExportState({
  generatedAt: "2026-05-01T00:00:00.000Z",
  projectRoot: "/workspace/demo",
  previewEvents: [],
  shots: [
    { ...shot("S10"), startFrame: undefined, endFrame: undefined },
  ],
  jobs: [
    {
      id: "S10_start_image2",
      slot: "image.generate",
      requiredMode: "text2image",
      providerId: "openai-image2-agent-cli",
      status: "planned",
      outputPath: "outputs/expected/S10_start.png",
      references: [],
      issues: [],
    },
  ],
  taskRuns: [
    {
      taskId: "S10_start_image2",
      localStatus: "succeeded",
      providerStatus: "succeeded",
      providerId: "openai-image2-agent-cli",
      retryCount: 0,
      stallTimeoutSeconds: 0,
      tempDirs: [],
      expectedOutputs: ["outputs/expected/S10_start.png"],
      actualOutputs: ["outputs/returned/S10_start.png"],
    },
  ],
  taskViews: [
    {
      job: {
        id: "S10_start_image2",
        slot: "image.generate",
        requiredMode: "text2image",
        providerId: "openai-image2-agent-cli",
        status: "planned",
        outputPath: "outputs/expected/S10_start.png",
        references: [],
        issues: [],
      },
      shotId: "S10",
      taskRun: {
        taskId: "S10_start_image2",
        localStatus: "succeeded",
        providerStatus: "succeeded",
        providerId: "openai-image2-agent-cli",
        retryCount: 0,
        stallTimeoutSeconds: 0,
        tempDirs: [],
        expectedOutputs: ["outputs/expected/S10_start.png"],
        actualOutputs: ["outputs/returned/S10_start.png"],
      },
      manifestMatch: {
        taskId: "S10_start_image2",
        status: "complete",
        expectedOutputCount: 1,
        presentOutputCount: 1,
        missingExpectedOutputs: [],
        actualOutputsPresent: ["outputs/returned/S10_start.png"],
        recoverableOutputs: [],
        outputMatches: [],
      },
    },
  ],
  manifestMatches: [],
  generationHealthReports: [],
  qaPromotionReports: [],
  issues: [],
});
assert(returnedOutputPreview.draftPreview.events.length === 1, "returned output preview should have one draft event");
assert(returnedOutputPreview.draftPreview.events[0].type === "image_hold", "returned output without shot.startFrame must become image_hold");
assert(
  returnedOutputPreview.draftPreview.events[0].mediaPath === "outputs/returned/S10_start.png",
  "returned output image_hold must use actual output path",
);
assert(returnedOutputPreview.formalPreview.status === "blocked", "returned output draft preview must not auto-promote formal preview");

const previewSource = stripComments(readText("src/ui/director/MinimalPreview.tsx"));
const stylesSource = stripComments(`${readText("src/styles.css")}\n${readText("src/styles/director.css")}`);
const packageJson = readJson("package.json");
const previewBody = findFunctionBody(previewSource, "MinimalPreview");
const previewCopy = visibleUiCopy(previewBody);
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

check(packageJson.scripts?.["preview-player:test"] === "tsx scripts/preview-player-test.mts", "package.json must expose preview-player:test");
check(packageJson.scripts?.["minimal-runtime-projection:test"] === "tsx scripts/minimal-runtime-projection-test.mts", "package.json must expose minimal-runtime-projection:test");
check(/from "\.\.\/\.\.\/core\/previewPlayerQueue"/.test(previewSource), "MinimalPreview must use the core Preview Player queue helper");
check(/buildPreviewPlayerQueue\s*\(/.test(previewBody), "MinimalPreview must consume the queue helper");
check(/buildMinimalRuntimeProjection\s*\(/.test(previewBody), "MinimalPreview must consume the minimal runtime projection helper");
check(/previewSummary\.detail/.test(previewBody), "MinimalPreview must show a short preview summary");
check(/currentTime/.test(previewBody) && /requestAnimationFrame/.test(previewBody), "Preview Play must advance currentTime");
check(/getPreviewPlayerActiveItem\s*\(/.test(previewBody), "MinimalPreview must choose active item by currentTime");
check(/selectPreviewItem/.test(previewBody) && /setCurrentTime\(item\.startSeconds\)/.test(previewBody), "timeline click must seek currentTime");
check(/onSelectShot\(item\.shotId\)/.test(previewBody), "timeline click must select the clicked shot");
check(/<video/.test(previewBody) && /preview-stage-video/.test(previewBody), "video clips with mediaPath must render a video shell");
check(/activeItem\?\.kind === "image_hold"[\s\S]*<MediaFrame/.test(previewBody), "image holds must render through MediaFrame");
check(/activeItem\?\.kind === "video_clip" && activeItem\.mediaPath[\s\S]*<video/.test(previewBody), "video clips must replace the image hold render branch");
check(/preview-stage-card/.test(previewBody) && />素材待补齐</.test(previewBody), "missing media must render only a light placeholder");
check(!/blockedReasons|formalPreviewGate|requiredChecks|providerSubmissionForbidden|sourceTaskId/.test(previewBody), "Preview Player source must not surface engineering state branches");
check(!/activeItem\?\.kind === "video_clip" \? "Clip"/.test(previewBody), "missing video placeholders must not show Clip copy");
check(/preview-stage/.test(previewBody) && /preview-line/.test(previewBody), "MinimalPreview must render a large shell and a minimal timeline");
check(!/\b(provider|gate|receipt|queue|round|phase|strict edit|handoff)\b/i.test(previewCopy), `Preview Player visible copy must stay user-facing: ${previewCopy}`);
check(/preview-stage-card/.test(stylesSource), "Preview shell styling is missing");
check(/preview-stage-video/.test(stylesSource), "Video stage styling is missing");
check(/preview-line-progress/.test(stylesSource), "Preview progress styling is missing");
check(/preview-line-event\.image_hold/.test(stylesSource), "Image hold timeline styling is missing");
check(/preview-line-event\.video_clip/.test(stylesSource), "Video clip timeline styling is missing");
check(/preview-line-event\.missing_placeholder/.test(stylesSource), "Missing placeholder timeline styling is missing");

const shortCopyTerms = Array.from(previewBody.matchAll(/>([^<>{}]{2,28})</g)).map((match) => match[1].trim()).filter(Boolean);
check(shortCopyTerms.every((term) => term.length <= 18), `Preview Player copy should stay short: ${shortCopyTerms.join(", ")}`);
check(countPattern(previewBody, /small|span|strong/g) <= 12, "Preview Player should keep visible text sparse");

if (failures.length) {
  console.error("Preview Player tests failed:");
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log("Preview Player tests passed.");
