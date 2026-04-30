import fs from "node:fs";

function readText(path) {
  return fs.readFileSync(path, "utf8");
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

const appSource = stripComments(readText("src/App.tsx"));
const stylesSource = stripComments(readText("src/styles.css"));
const packageJson = JSON.parse(readText("package.json"));
const queueBody = findFunctionBody(appSource, "buildPreviewPlayerQueue");
const queueKindBody = findFunctionBody(appSource, "previewQueueKind");
const previewBody = findFunctionBody(appSource, "MinimalPreview");
const assetBody = findFunctionBody(appSource, "MinimalAssetLibrary");

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

check(packageJson.scripts?.["preview-player:test"] === "node scripts/preview-player-test.mjs", "package.json must expose preview-player:test");
check(/previewExport\.draftPreview\.events/.test(queueBody), "Preview queue must be based on previewExport.draftPreview.events");
check(/event\.durationSeconds/.test(queueBody) && /Math\.max\(1,\s*event\.durationSeconds\)/.test(queueBody), "Preview queue must preserve shot/event duration with a safe minimum");
check(/image_hold/.test(queueBody), "Preview queue must include image hold items");
check(/video_clip/.test(queueBody), "Preview queue must include video clip items");
check(/blocked_placeholder/.test(queueKindBody) && /missing_placeholder/.test(queueKindBody), "Preview queue must map missing material to placeholders");
check(/sort\(/.test(queueBody) && /startSeconds/.test(queueBody), "Preview queue must be ordered by timeline start");
check(/buildPreviewPlayerQueue\s*\(/.test(previewBody), "MinimalPreview must consume the queue helper");
check(/preview-stage/.test(previewBody) && /preview-line/.test(previewBody), "MinimalPreview must render a large shell and a minimal timeline");
check(!/Formal\s+Gate|Proxy\s+Duration|Draft\s+Events|blockedPlaceholder|provider|schema|manifest|TaskEnvelope/i.test(previewBody), "MinimalPreview must not show engineering counters or terms");
check(/locked/.test(assetBody) && /candidate/.test(assetBody) && /review/.test(assetBody), "Asset Library must retain locked/candidate/review states");
check(!/contactSheets|Voice\s+Source\s+Library|voiceSource/i.test(assetBody), "Asset Library main surface must not become a contact sheet or voice-source diagnostics view");
check(/preview-stage-card/.test(stylesSource), "Preview shell styling is missing");
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
