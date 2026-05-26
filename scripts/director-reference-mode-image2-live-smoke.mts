import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildScriptStoryboardPromptPack } from "../src/core/scriptStoryboardPromptPack.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type ModeSample = {
  id: string;
  label: string;
  mode: "baseline_text" | "shot_state_reference" | "sequence_storyboard" | "motion_system_storyboard";
  prompt: string;
  references: StoryboardReferenceAsset[];
};

function argValue(name: string, fallback = ""): string {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeFile(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

async function runPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

const providerKey = getProviderApiKey("lanyi-image2");
if (!providerKey) throw new Error("Missing local lanyi-image2 credential.");

const provider = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const baseUrl = argValue("--base-url", provider?.baseUrl || "https://lanyiapi.com/v1");
const model = argValue("--model", provider?.imageModel || "gpt-image-2");
const size = argValue("--size", "1280x720");
const quality = argValue("--quality", "standard");
const maxConcurrency = Math.max(1, Math.min(4, Number(argValue("--max-concurrency", "2")) || 2));
const maxRetries = Math.max(0, Math.min(3, Number(argValue("--max-retries", "2")) || 2));
const outputRoot = path.resolve(argValue("--output-root", path.join("real-test-sandbox", `director-reference-modes-${timestampId()}`)));
const fixtureRoot = path.resolve("real-test-sandbox/storyboard-sheet-chain-flex-live-20260520-01/assets");
const selectedIds = new Set(
  argValue("--ids", "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

const scene: StoryboardReferenceAsset = {
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

for (const reference of [scene, hina, ren, cassette]) {
  if (!existsSync(reference.path)) throw new Error(`Missing fixture reference: ${reference.path}`);
}

const pack = buildScriptStoryboardPromptPack({
  title: "四种参考模式对照",
  logline: "同一组日漫素材下，对比 baseline text、状态参考、序列故事板和动态系统故事板。",
  completeScript: [
    "雨后学校天台。日奈和莲围绕一盒蓝色磁带发生短暂沉默。",
    "灯光闪动后，两人快步穿过天台。",
    "磁带被风卷出，像黑蓝色丝带一样形成信号路径。",
  ].join("\n"),
  style: "restrained Japanese TV anime, early Evangelion-like mood, rainy rooftop, clean cinematic framing",
  creativeBrief: {
    filmLikes: ["early Neon Genesis Evangelion TV anime mood"],
    rhythmLikes: ["automatic director skill routing", "clean state reference for inserts", "rough storyboard previs for action"],
    expressionLikes: ["eyeline tension", "hand detail", "rough sakuga planning readability"],
    notes: "Generate four images only for comparing reference modes. Do not call Seedance.",
  },
  referenceBundle: {
    scenes: [scene],
    characters: [hina, ren],
    props: [cassette],
  },
  storyboardOutputDir: path.join(outputRoot, "storyboards"),
  videoOutputDir: path.join(outputRoot, "seedance-plans"),
  image2OutputSize: size,
  seedanceVideoResolution: "720p",
  shots: [
    {
      shotId: "S01",
      title: "磁带递出前一拍",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: scene.id,
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
      dialogue: "-",
      sound: "雨后水滴声，塑料磁带盒轻响。",
    },
    {
      shotId: "S02",
      title: "天台快切穿行",
      durationSeconds: 10,
      executionMode: "planned_cut_sequence",
      sceneId: scene.id,
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
      shotId: "S03",
      title: "磁带丝带信号路径",
      durationSeconds: 12,
      executionMode: "planned_cut_sequence",
      sceneId: scene.id,
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

const stateShot = pack.shots.find((shot) => shot.shotId === "S01")!;
const sequenceShot = pack.shots.find((shot) => shot.shotId === "S02")!;
const motionShot = pack.shots.find((shot) => shot.shotId === "S03")!;

const baselinePrompt = [
  "Create one final-color Japanese TV anime frame in 16:9 using only the written director prompt and locked reference assets.",
  "This represents baseline_text mode: no storyboard sheet, no panel layout, no arrows, no labels, no notes.",
  "Scene: rainy school rooftop after sunset, wet floor reflections, city skyline, quiet pressure.",
  "Characters: short-haired schoolgirl on screen-left, schoolboy on screen-right. Preserve identity from references.",
  "Prop: blue cassette case between their hands.",
  "Action: the boy's hand pauses before touching the cassette; the girl keeps holding it, fingers slightly tense.",
  "Mood: restrained early TV anime drama, cinematic framing, clean readable hands, no photorealism, no text, no watermark.",
].join("\n");

function image2PlanOrFallback(
  shot: typeof pack.shots[number],
  fallbackPrompt: string,
  fallbackReferences: StoryboardReferenceAsset[],
): { prompt: string; references: StoryboardReferenceAsset[]; usedFallback: boolean } {
  if (shot.image2StoryboardPlan?.prompt) {
    return {
      prompt: shot.image2StoryboardPlan.prompt,
      references: shot.image2StoryboardPlan.references,
      usedFallback: false,
    };
  }
  return {
    prompt: fallbackPrompt,
    references: fallbackReferences,
    usedFallback: true,
  };
}

const shotStateFallback = image2PlanOrFallback(stateShot, [
  "[SHOT STATE REFERENCE]",
  "Create one clean 16:9 Japanese TV anime shot-state reference image.",
  "This is not a storyboard sheet. No panel borders, arrows, numbers, labels, handwritten notes, subtitles, logos, or UI.",
  "Use the locked rainy rooftop scene, Hina and Ren character references, and blue cassette prop reference.",
  "Composition: low hand insert close shot. Hina's hand offers the blue cassette from screen-left; Ren's hand enters from screen-right and stops just before contact.",
  "Purpose: one readable still that defines action state, hand placement, eyeline tension and prop scale.",
  "Style: restrained early TV anime mood, clean cel shading, soft painted rainy rooftop background, no photorealism.",
].join("\n"), [scene, hina, ren, cassette]);

const sequenceFallback = image2PlanOrFallback(sequenceShot, [
  "[SEQUENCE STORYBOARD]",
  "Create one 16:9 rough cinematic storyboard reference sheet for a rapid rooftop crossing.",
  "Panel count: 4. Grid: 1x4. Each panel should use 16:9 internal composition.",
  "Focus on planning, staging, camera rhythm and motion readability, not finished illustration quality.",
  "Use rough pencil and ink strokes, grayscale base, minimal color annotations only if useful.",
  "Do not add decorative UI, logos or readable dialogue.",
  "Panels: 1 wide rooftop direction / 2 Hina grips cassette and starts moving / 3 feet splash through puddle / 4 Ren looks back at flickering door light while following.",
].join("\n"), [scene, hina, ren, cassette]);

const motionFallback = image2PlanOrFallback(motionShot, [
  "[MOTION SYSTEM STORYBOARD]",
  "Create one 16:9 rough cinematic motion-system storyboard reference sheet.",
  "Panel count: 6. Grid: 2x3. Each panel shows one clear motion beat.",
  "Base is grayscale rough storyboard. Use limited colored production arrows only for internal motion planning.",
  "No final-color rendering, no subtitles, no logos, no UI.",
  "Action system: black-blue cassette tape rises from the cassette, unfolds into signal waves, forms a circular path around Hina, then points toward the rooftop door.",
  "Prioritize readable tape path, camera direction, body orientation and timing.",
].join("\n"), [scene, hina, cassette]);

const samples: ModeSample[] = [
  {
    id: "M00-baseline_text",
    label: "baseline_text 普通文本导演画面",
    mode: "baseline_text",
    prompt: baselinePrompt,
    references: [scene, hina, ren, cassette],
  },
  {
    id: "M01-shot_state_reference",
    label: "shot_state_reference 镜头状态参考图",
    mode: "shot_state_reference",
    prompt: shotStateFallback.prompt,
    references: shotStateFallback.references,
  },
  {
    id: "M02-sequence_storyboard",
    label: "sequence_storyboard 序列故事板预演",
    mode: "sequence_storyboard",
    prompt: sequenceFallback.prompt,
    references: sequenceFallback.references,
  },
  {
    id: "M03-motion_system_storyboard",
    label: "motion_system_storyboard 动态系统故事板",
    mode: "motion_system_storyboard",
    prompt: motionFallback.prompt,
    references: motionFallback.references,
  },
];
const selectedSamples = selectedIds.size
  ? samples.filter((sample) => selectedIds.has(sample.id) || selectedIds.has(sample.mode))
  : samples;

if (!selectedSamples.length) {
  throw new Error(`No mode samples matched --ids=${Array.from(selectedIds).join(",")}`);
}

async function generate(sample: ModeSample) {
  const promptPath = path.join(outputRoot, "prompts", `${sample.id}.md`);
  const outputPath = path.join(outputRoot, "images", `${sample.id}.png`);
  const receiptPath = path.join(outputRoot, "receipts", `${sample.id}.json`);
  writeFile(promptPath, `${sample.prompt}\n`);

  const referenceImages = sample.references.map((reference) => {
    const filePath = path.resolve(reference.path);
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

  let result: any;
  const attempts: Array<Record<string, unknown>> = [];
  for (let attemptNumber = 1; attemptNumber <= maxRetries + 1; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey: providerKey,
      baseUrl,
      model,
      prompt: sample.prompt,
      size,
      quality,
      providerOperation: `responses.image_generation_reference_mode_${sample.mode}`,
      timeoutMs: 8 * 60 * 1000,
      referenceImages,
    });
    attempts.push({
      attemptNumber,
      ok: result.ok,
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      elapsedMs: result.providerResponseMetadata?.elapsedMs,
      retryable: retryableImage2Result(result),
    });
    if (result.ok || !retryableImage2Result(result) || attemptNumber === maxRetries + 1) break;
    await sleep(5_000 * attemptNumber);
  }

  if (result.ok) writeFile(outputPath, result.bytes);
  const receipt = {
    schemaVersion: "director_reference_mode_image2_live_smoke_v1",
    id: sample.id,
    label: sample.label,
    mode: sample.mode,
    ok: Boolean(result.ok),
    providerCalledExternal: true,
    rawApiKeyStored: false,
    model,
    size,
    quality,
    promptPath: packageRelative(outputRoot, promptPath),
    outputPath: result.ok ? packageRelative(outputRoot, outputPath) : undefined,
    outputSha256: result.ok ? sha256(result.bytes) : undefined,
    references: referenceImages.map((reference) => ({
      role: reference.role,
      path: reference.path,
      sha256: reference.sha256,
    })),
    attempts,
    failure: result.ok ? undefined : {
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      message: result.message,
      diagnostic: result.diagnostic,
    },
  };
  writeJson(receiptPath, receipt);
  return {
    id: sample.id,
    label: sample.label,
    mode: sample.mode,
    ok: Boolean(result.ok),
    outputPath: result.ok ? outputPath : undefined,
    receiptPath,
  };
}

writeJson(path.join(outputRoot, "prompt-pack.json"), pack);
writeJson(path.join(outputRoot, "samples.json"), selectedSamples.map((sample) => ({
  id: sample.id,
  label: sample.label,
  mode: sample.mode,
  referenceRoles: sample.references.map((reference) => reference.role),
})));

const results = await runPool(selectedSamples, maxConcurrency, generate);
writeJson(path.join(outputRoot, "results.json"), results);
writeFile(path.join(outputRoot, "summary.md"), [
  "# Director Reference Modes Image2 Live Smoke",
  "",
  `- model: ${model}`,
  `- size: ${size}`,
  `- quality: ${quality}`,
  `- maxConcurrency: ${maxConcurrency}`,
  "",
  ...results.map((result) => `- ${result.label}: ${result.outputPath ? packageRelative(outputRoot, result.outputPath) : "failed"}`),
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: results.every((result) => result.ok),
  outputRoot,
  results,
}, null, 2));
