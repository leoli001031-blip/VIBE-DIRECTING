import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

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

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importPreviewPlayerQueue() {
  const sourcePath = "src/core/previewPlayerQueue.ts";
  const output = ts.transpileModule(readText(sourcePath), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  return import(dataUrl(sourcePath, output.outputText));
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

const {
  buildPreviewPlayerQueue,
  getPreviewPlayerActiveItem,
  getPreviewPlayerTotalDuration,
} = await importPreviewPlayerQueue();

const shots = [shot("S01"), shot("S02"), shot("S03")];
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

const appSource = stripComments(readText("src/App.tsx"));
const stylesSource = stripComments(readText("src/styles.css"));
const packageJson = readJson("package.json");
const previewBody = findFunctionBody(appSource, "MinimalPreview");
const assetBody = findFunctionBody(appSource, "MinimalAssetLibrary");
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

check(packageJson.scripts?.["preview-player:test"] === "node scripts/preview-player-test.mjs", "package.json must expose preview-player:test");
check(/from "\.\/core\/previewPlayerQueue"/.test(appSource), "MinimalPreview must use the core Preview Player queue helper");
check(/buildPreviewPlayerQueue\s*\(/.test(previewBody), "MinimalPreview must consume the queue helper");
check(/currentTime/.test(previewBody) && /requestAnimationFrame/.test(previewBody), "Preview Play must advance currentTime");
check(/getPreviewPlayerActiveItem\s*\(/.test(previewBody), "MinimalPreview must choose active item by currentTime");
check(/selectPreviewItem/.test(previewBody) && /setCurrentTime\(item\.startSeconds\)/.test(previewBody), "timeline click must seek currentTime");
check(/onSelectShot\(item\.shotId\)/.test(previewBody), "timeline click must select the clicked shot");
check(/<video/.test(previewBody) && /preview-stage-video/.test(previewBody), "video clips with mediaPath must render a video shell");
check(!/activeItem\?\.kind === "video_clip" \? "Clip"/.test(previewBody), "missing video placeholders must not show Clip copy");
check(/preview-stage/.test(previewBody) && /preview-line/.test(previewBody), "MinimalPreview must render a large shell and a minimal timeline");
check(!/Formal\s+Gate|Proxy\s+Duration|Draft\s+Events|blockedPlaceholder|provider|schema|manifest|TaskEnvelope/i.test(previewBody), "MinimalPreview must not show engineering counters or terms");
check(/locked/.test(assetBody) && /candidate/.test(assetBody) && /review/.test(assetBody), "Asset Library must retain locked/candidate/review states");
check(!/contactSheets|Voice\s+Source\s+Library|voiceSource/i.test(assetBody), "Asset Library main surface must not become a contact sheet or voice-source diagnostics view");
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
