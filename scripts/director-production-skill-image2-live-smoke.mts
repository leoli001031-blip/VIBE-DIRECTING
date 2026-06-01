import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildScriptStoryboardPromptPack } from "../src/core/scriptStoryboardPromptPack.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeFile(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function writeJson(filePath: string, payload: unknown): void {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function packageRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function retryableImage2Result(result: any): boolean {
  if (result?.ok) return false;
  if (result?.providerResponseMetadata?.retryable === true) return true;
  if (["timeout", "network_error", "rate_limit", "provider_missing", "server_error"].includes(result?.errorType)) return true;
  return typeof result?.statusCode === "number" && result.statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, LANYI_API_KEY, or OPENAI_API_KEY is required for live Image2 smoke.");

const baseUrl = argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || process.env.LANYI_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com/v1";
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || process.env.IMAGE_MODEL || providerStatus?.imageModel || "gpt-image-2";
const size = argValue("--size") || "1280x720";
const quality = argValue("--quality") || "standard";
const maxRetries = Number(argValue("--max-retries") || "2");
const maxConcurrency = Math.max(1, Math.floor(Number(argValue("--max-concurrency") || "3")));
const selectedShotIds = (argValue("--shot-ids") || "FT02,FT03,FT04").split(",").map((item) => item.trim()).filter(Boolean);

const fixtureRoot = path.resolve("real-test-sandbox/storyboard-sheet-chain-flex-live-20260520-01/assets");
const outputRoot = path.resolve(argValue("--output-root") || path.join(
  "real-test-sandbox",
  `director-production-skill-image2-live-${timestampId()}`,
));
const storyboardOutputDir = path.join(outputRoot, "image2");
const videoOutputDir = path.join(outputRoot, "seedance-plans");

const sceneRooftop: StoryboardReferenceAsset = {
  id: "scene_rooftop_after_rain",
  role: "scene_baseline",
  path: path.join(fixtureRoot, "scenes", "after-rain-school-rooftop.png"),
  label: "雨后学校天台",
};
const hina: StoryboardReferenceAsset = {
  id: "char_hina",
  role: "character_identity",
  path: path.join(fixtureRoot, "characters", "hina-main-character.png"),
  label: "短发少女日奈",
};
const ren: StoryboardReferenceAsset = {
  id: "char_ren",
  role: "character_identity",
  path: path.join(fixtureRoot, "characters", "ren-supporting-character.png"),
  label: "少年莲",
};
const cassette: StoryboardReferenceAsset = {
  id: "prop_blue_cassette",
  role: "prop_reference",
  path: path.join(fixtureRoot, "props", "blue-cassette-case.png"),
  label: "蓝色磁带盒",
};

for (const asset of [sceneRooftop, hina, ren, cassette]) {
  if (!existsSync(asset.path)) throw new Error(`Missing fixture reference: ${asset.path}`);
}

const pack = buildScriptStoryboardPromptPack({
  title: "雨后磁带 Image2 Skill 测试",
  logline: "日奈和莲在雨后天台围绕一盒旧磁带完成安静关系、快切动作和磁带带状动态系统的测试。",
  completeScript: [
    "雨后学校天台。日奈把蓝色磁带盒递给莲，莲的手在快碰到磁带前停住。",
    "门口灯光忽然闪动，两人沿湿地面快步穿过天台，镜头用远景、脚步、手部和回头切点组织动作。",
    "蓝色磁带盒里的磁带被风卷出，像一条黑蓝色丝带一样在空中展开成信号路径，日奈抬头准备追过去。",
  ].join("\n"),
  style: "restrained Japanese TV anime, early Evangelion-like mood, rough director planning, rainy rooftop",
  creativeBrief: {
    filmLikes: ["early Neon Genesis Evangelion TV anime mood"],
    rhythmLikes: ["AI chooses clean state reference for small inserts, storyboard previs for fast cuts"],
    expressionLikes: ["hand detail", "eyeline tension", "rough sakuga planning when motion is complex"],
    notes: "This live smoke checks Image2 visual planning only; do not call Seedance.",
  },
  storyboardOutputDir: storyboardOutputDir,
  videoOutputDir,
  image2OutputSize: size,
  seedanceVideoResolution: "720p",
  referenceBundle: {
    scenes: [sceneRooftop],
    characters: [hina, ren],
    props: [cassette],
  },
  shots: [
    {
      shotId: "FT02",
      title: "磁带递出前一拍",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "手部特写",
      camera: "低一点的手部插入特写，浅景深；背景保留雨后天台反光和校服袖口。",
      frameDescription: "日奈的手托着蓝色磁带盒伸向画面右侧，莲的手从右侧伸进来，在快碰到磁带盒前停住。",
      actionBeats: ["日奈递出蓝色磁带盒", "莲的手靠近", "两只手之间停住半拍"],
      primaryAction: "莲的手慢慢靠近蓝色磁带盒",
      actionTrigger: "日奈把磁带盒递到两人中间",
      microReaction: "日奈的手指轻轻收紧",
      actorAction: "莲的手从右侧伸进来",
      reactorResponse: "日奈没有收回磁带盒，只是手指收紧",
      dialogue: "日奈：你听见了吗？",
      sound: "雨后水滴声，塑料磁带盒轻响。",
    },
    {
      shotId: "FT03",
      title: "天台快切穿行",
      durationSeconds: 10,
      executionMode: "planned_cut_sequence",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "动作快切段落",
      camera: "远景建立天台方向后切脚步、手部、回头和屋顶门灯光闪动；保持日奈左、莲右的空间轴线。",
      frameDescription: "屋顶门灯光忽然闪动，两人沿湿地面快步穿过天台，蓝色磁带盒被握在日奈手里作为方向锚点。",
      actionBeats: ["远景交代天台方向", "日奈握紧磁带盒快步移动", "脚步踩过积水", "莲回头确认屋顶门灯光", "两人绕过天台水箱"],
      primaryAction: "日奈和莲沿天台边缘快步穿行",
      actionTrigger: "屋顶门灯光突然闪动",
      microReaction: "莲回头确认灯光后立刻跟上",
      actorAction: "日奈从左侧带头穿行",
      reactorResponse: "莲在右侧跟上并回头确认",
      dialogue: "-",
      sound: "急促脚步，积水溅起，远处电流声。",
    },
    {
      shotId: "FT04",
      title: "磁带丝带信号路径",
      durationSeconds: 12,
      executionMode: "planned_cut_sequence",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id],
      propIds: [cassette.id],
      shotSize: "动态系统段落",
      camera: "低角度跟随磁带带抬升，随后环绕日奈和空中带状信号路径。",
      frameDescription: "蓝色磁带盒里的黑蓝色磁带被风卷出，从日奈手边爆开，旋成信号波、圆环和通往屋顶门的带状路径。",
      actionBeats: ["磁带带被风卷起", "信号波展开", "圆环绕过日奈", "路径指向屋顶门", "日奈抬头准备追过去"],
      primaryAction: "磁带带展开成带状信号路径",
      actionTrigger: "远处电流声和风同时增强",
      microReaction: "日奈抬头，眼神从犹豫变成决心",
      dialogue: "-",
      sound: "风声增强，电流声变清晰，无配乐。",
    },
  ],
});

const selectedShots = pack.shots.filter((shot) => selectedShotIds.includes(shot.shotId));
if (!selectedShots.length) throw new Error(`No selected shots matched: ${selectedShotIds.join(", ")}`);

writeJson(path.join(outputRoot, "prompt-pack.json"), pack);
writeJson(path.join(outputRoot, "selected-shots.json"), selectedShots.map((shot) => ({
  shotId: shot.shotId,
  strategyId: shot.productionSkillPlan.strategyId,
  strategyLabel: shot.productionSkillPlan.strategyLabel,
  image2Mode: shot.productionSkillPlan.image2Directive.mode,
  promptPath: `prompts/${shot.shotId}.md`,
})));

async function generateShot(shot: typeof selectedShots[number]) {
  const prompt = String(shot.image2StoryboardPlan.prompt || "");
  const shotRoot = path.join(outputRoot, "shots", shot.shotId);
  const promptPath = path.join(outputRoot, "prompts", `${shot.shotId}.md`);
  writeFile(promptPath, `${prompt}\n`);
  const references = (shot.image2StoryboardPlan.references || []).map((reference: any) => {
    const filePath = path.resolve(reference.path);
    if (!existsSync(filePath)) throw new Error(`Missing reference image: ${filePath}`);
    const bytes = readFileSync(filePath);
    return {
      role: reference.role,
      path: filePath,
      name: path.basename(filePath),
      mimeType: inferMime(filePath),
      bytes,
      sha256: sha256(bytes),
    };
  });

  writeJson(path.join(shotRoot, "reference-manifest.json"), references.map((reference) => ({
    role: reference.role,
    path: reference.path,
    name: reference.name,
    mimeType: reference.mimeType,
    sha256: reference.sha256,
    bytes: reference.bytes.length,
  })));

  let result: any;
  let rawSsePath = "";
  const attempts: Array<Record<string, unknown>> = [];
  const maxAttempts = Math.max(1, Math.floor(maxRetries) + 1);
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey,
      baseUrl,
      model,
      prompt,
      size,
      quality,
      providerOperation: `responses.image_generation_director_skill_${shot.productionSkillPlan.strategyId}`,
      timeoutMs: 8 * 60 * 1000,
      referenceImages: references,
    });
    if (result.rawSseBytes) {
      rawSsePath = path.join(shotRoot, "receipts", `attempt-${attemptNumber}.sse.txt`);
      writeFile(rawSsePath, result.rawSseBytes);
    }
    attempts.push({
      attemptNumber,
      ok: result.ok,
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      elapsedMs: result.providerResponseMetadata?.elapsedMs,
      retryable: retryableImage2Result(result),
    });
    if (result.ok || !retryableImage2Result(result) || attemptNumber === maxAttempts) break;
    await sleep(5_000 * attemptNumber);
  }

  const outputImagePath = path.join(shotRoot, `${shot.shotId}-${shot.productionSkillPlan.strategyId}.png`);
  if (result.ok) writeFile(outputImagePath, result.bytes);

  const receipt = {
    schemaVersion: "director_production_skill_image2_live_smoke_v1",
    shotId: shot.shotId,
    ok: Boolean(result.ok),
    model,
    size,
    quality,
    providerCalled: true,
    rawApiKeyStored: false,
    strategyId: shot.productionSkillPlan.strategyId,
    strategyLabel: shot.productionSkillPlan.strategyLabel,
    image2Mode: shot.productionSkillPlan.image2Directive.mode,
    promptPath: packageRelative(outputRoot, promptPath),
    outputImagePath: result.ok ? packageRelative(outputRoot, outputImagePath) : undefined,
    outputImageSha256: result.ok ? sha256(result.bytes) : undefined,
    rawSsePath: rawSsePath ? packageRelative(outputRoot, rawSsePath) : undefined,
    attempts,
    referenceCount: references.length,
    references: references.map((reference) => ({
      role: reference.role,
      path: reference.path,
      sha256: reference.sha256,
    })),
    providerRequestId: result.providerRequestId,
    providerResponseMetadata: result.providerResponseMetadata,
    failure: result.ok ? undefined : {
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      message: result.message,
      diagnostic: result.diagnostic,
    },
  };
  writeJson(path.join(shotRoot, "receipt.json"), receipt);
  return {
    shotId: shot.shotId,
    ok: Boolean(result.ok),
    strategyId: shot.productionSkillPlan.strategyId,
    image2Mode: shot.productionSkillPlan.image2Directive.mode,
    outputImagePath: result.ok ? outputImagePath : undefined,
    receiptPath: path.join(shotRoot, "receipt.json"),
    attempts,
  };
}

const results = await runPool(selectedShots, maxConcurrency, generateShot);
writeJson(path.join(outputRoot, "live-results.json"), results);
writeFile(path.join(outputRoot, "summary.md"), [
  "# Director Production Skill Image2 Live Smoke",
  "",
  `- model: ${model}`,
  `- size: ${size}`,
  `- quality: ${quality}`,
  `- max_concurrency: ${maxConcurrency}`,
  `- raw_api_key_stored: false`,
  `- selected: ${selectedShotIds.join(", ")}`,
  "",
  ...results.map((result) => `- ${result.shotId}: ${result.ok ? "ok" : "failed"} / ${result.strategyId} / ${result.outputImagePath ? packageRelative(outputRoot, result.outputImagePath) : "no image"}`),
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: results.every((result) => result.ok),
  outputRoot,
  results,
  summaryPath: path.join(outputRoot, "summary.md"),
}, null, 2));
