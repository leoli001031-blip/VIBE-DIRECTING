import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildImage2StoryboardReferencePlan, type StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type SequenceShot = {
  id: string;
  title: string;
  durationSeconds: number;
  camera: string;
  intent: string;
  sceneReferenceId: string;
  characterReferenceIds: string[];
  propReferenceIds: string[];
  characterGuidance: string[];
  propGuidance: string[];
  dialogue?: string;
};

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeId(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "storyboard-sequence";
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function packageRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableImage2Result(result: any): boolean {
  if (result?.ok) return false;
  if (result?.providerResponseMetadata?.retryable === true) return true;
  if (["timeout", "network_error", "rate_limit"].includes(result?.errorType)) return true;
  return typeof result?.statusCode === "number" && result.statusCode >= 500;
}

const story = {
  title: "雨后旧磁带",
  theme: "一个短发少女在雨后天台把旧磁带还给少年，却发现两人记得的是同一段声音。",
  style: "black-and-white Japanese anime director storyboard, clean pencil and ink, readable motion notes",
  shots: [
    {
      id: "MC01",
      title: "雨后天台，日奈发现磁带还在口袋里",
      durationSeconds: 4,
      sceneReferenceId: "scene_rooftop",
      characterReferenceIds: ["hina"],
      propReferenceIds: ["cassette"],
      camera: "中景建立空间，轻微推进；天台栏杆在画面左后方，湿地面反光，屋顶门在画面右侧远处。",
      intent: "主画面：日奈站在画面左前景靠近栏杆，短发和蝴蝶结保持清楚，低头从校服口袋里摸出蓝色磁带盒。动作小格依次表现：手指碰到磁带盒、她停住呼吸、视线抬向画面右侧屋顶门。箭头标注慢推进、视线从口袋到门口、地面积水微闪。",
      characterGuidance: [
        "Hina: use locked reference identity, short hair, bow/ribbon, school uniform silhouette; never turn her into a long-haired girl.",
      ],
      propGuidance: [
        "Blue cassette case: same locked prop, small rectangular case in Hina's hand.",
      ],
      dialogue: "小声：还在啊。",
    },
    {
      id: "MC02",
      title: "莲推开屋顶门，日奈把磁带藏到身后",
      durationSeconds: 4,
      sceneReferenceId: "scene_rooftop",
      characterReferenceIds: ["hina", "ren"],
      propReferenceIds: ["cassette"],
      camera: "全景转中景，保持 180 度轴线；日奈在画面左前景，莲从画面右后景屋顶门入画。",
      intent: "主画面：莲推开屋顶门站在右后景，日奈在左前景轻微后退，把蓝色磁带盒藏到身后。动作小格依次表现：门被推开、日奈手腕转到身后、莲看向她手的位置。箭头标注莲从右向左入画，日奈向左后退半步，镜头从门口横移回日奈。",
      characterGuidance: [
        "Hina: locked short hair and bow/ribbon, left foreground, do not change hairstyle.",
        "Ren: locked boy reference, slim school-uniform silhouette, right background near rooftop door.",
      ],
      propGuidance: [
        "Blue cassette case: hidden partly behind Hina's back, still readable as the key prop.",
      ],
      dialogue: "莲：你还留着那个？",
    },
    {
      id: "MC03",
      title: "磁带递出，两人隔着雨后反光对望",
      durationSeconds: 5,
      sceneReferenceId: "scene_rooftop",
      characterReferenceIds: ["hina", "ren"],
      propReferenceIds: ["cassette"],
      camera: "中景，侧面双人构图，缓慢推近；日奈保持左侧，莲保持右侧，湿地面反射两人脚下。",
      intent: "主画面：日奈从左侧把蓝色磁带盒递向右侧的莲，莲没有马上接，两人视线在磁带上方相遇。动作小格依次表现：日奈手臂伸出、莲手指犹豫抬起、两人的眼线从磁带转向彼此。箭头标注递出方向、莲手的停顿、慢推近。",
      characterGuidance: [
        "Hina: locked short-hair heroine with bow/ribbon, left side, restrained expression.",
        "Ren: locked boy reference, right side, surprised but gentle posture.",
      ],
      propGuidance: [
        "Blue cassette case: centered between both characters as relationship prop.",
      ],
      dialogue: "日奈：不是要还给你，只是……借你听一次。",
    },
    {
      id: "MC04",
      title: "两人并肩听旧磁带，雨水映出城市灯",
      durationSeconds: 5,
      sceneReferenceId: "scene_rooftop",
      characterReferenceIds: ["hina", "ren"],
      propReferenceIds: ["cassette"],
      camera: "侧面中近景，轻微环绕后停住；天台栏杆和云后夕光形成背景，地面有雨后反光。",
      intent: "主画面：日奈和莲并肩靠近栏杆，日奈在左、莲在右，两人中间是蓝色磁带盒，像在听同一段旧声音。动作小格依次表现：莲接过磁带盒、日奈别开视线但微笑、雨水反光里出现两人的倒影。箭头标注小幅环绕、两人距离缩短、倒影波纹。",
      characterGuidance: [
        "Hina: locked short hair and bow/ribbon, left side, embarrassed small smile.",
        "Ren: locked boy reference, right side, gentle listening posture.",
      ],
      propGuidance: [
        "Blue cassette case: between the two characters, still the emotional anchor.",
      ],
      dialogue: "莲：那就，从头开始听吧。",
    },
  ] satisfies SequenceShot[],
};

async function generateShot(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  quality: string;
  size: string;
  maxRetries: number;
  outputRoot: string;
  referenceAssets: Record<string, StoryboardReferenceAsset>;
  shot: SequenceShot;
}): Promise<Record<string, unknown>> {
  const sceneBaseline = input.referenceAssets[input.shot.sceneReferenceId];
  const characterReferences = input.shot.characterReferenceIds
    .map((id) => input.referenceAssets[id])
    .filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const propReferences = input.shot.propReferenceIds
    .map((id) => input.referenceAssets[id])
    .filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const plan = buildImage2StoryboardReferencePlan({
    shotId: input.shot.id,
    shotTitle: input.shot.title,
    camera: input.shot.camera,
    shotDescription: input.shot.intent,
    sceneBaseline,
    characterReferences,
    propReferences,
    characterGuidance: input.shot.characterGuidance,
    propGuidance: input.shot.propGuidance,
    dialogue: input.shot.dialogue,
    durationSeconds: input.shot.durationSeconds,
    outputSize: input.size,
  });

  const storyboardDir = path.join(input.outputRoot, "storyboards");
  const receiptDir = path.join(input.outputRoot, "receipts", "image2", "storyboards");
  const outputPath = path.join(storyboardDir, `${input.shot.id}-storyboard-reference.png`);
  const promptPath = path.join(receiptDir, `${input.shot.id}.prompt.md`);
  const receiptPath = path.join(receiptDir, `${input.shot.id}.json`);
  writeText(promptPath, `${plan.prompt}\n`);
  const referenceImages = plan.references.map((reference) => {
    if (!existsSync(reference.path)) throw new Error(`Missing reference asset: ${reference.path}`);
    const bytes = readFileSync(reference.path);
    return {
      role: reference.role,
      path: reference.path,
      name: path.basename(reference.path),
      mimeType: inferMime(reference.path),
      bytes,
      sha256: sha256(bytes),
    };
  });

  let result: any;
  let rawSsePath = "";
  const attempts: Array<Record<string, unknown>> = [];
  const maxAttempts = Math.max(1, Math.floor(input.maxRetries) + 1);
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      prompt: plan.prompt,
      size: input.size,
      quality: input.quality,
      providerOperation: "responses.image_generation_storyboard_sequence",
      timeoutMs: 8 * 60 * 1000,
      referenceImages,
    });
    if (result.rawSseBytes) {
      rawSsePath = path.join(receiptDir, `${input.shot.id}.attempt-${attemptNumber}.sse.txt`);
      writeFileSync(rawSsePath, result.rawSseBytes);
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

  if (result.ok) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result.bytes);
  }

  const receipt = {
    schemaVersion: "storyboard_sequence_live_receipt_v1",
    shotId: input.shot.id,
    status: result.ok ? "success" : "failed",
    ok: result.ok,
    model: input.model,
    size: input.size,
    quality: input.quality,
    promptPath: packageRelative(input.outputRoot, promptPath),
    outputPath: result.ok ? packageRelative(input.outputRoot, outputPath) : undefined,
    rawSsePath: rawSsePath ? packageRelative(input.outputRoot, rawSsePath) : undefined,
    rawApiKeyStored: false,
    attempts,
    referencePolicy: plan.referencePolicy,
    references: referenceImages.map((reference) => ({
      role: reference.role,
      path: reference.path,
      sha256: reference.sha256,
      bytes: reference.bytes.length,
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
  writeJson(receiptPath, receipt);

  return {
    shotId: input.shot.id,
    title: input.shot.title,
    ok: result.ok,
    outputPath: result.ok ? outputPath : undefined,
    relativeOutputPath: result.ok ? packageRelative(input.outputRoot, outputPath) : undefined,
    promptPath: packageRelative(input.outputRoot, promptPath),
    receiptPath: packageRelative(input.outputRoot, receiptPath),
    outputHash: result.ok ? sha256(result.bytes) : undefined,
    attempts,
    elapsedMs: result.providerResponseMetadata?.elapsedMs,
    failure: receipt.failure,
  };
}

const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, LANYI_API_KEY, or OPENAI_API_KEY is required.");

const repoRoot = process.cwd();
const runId = safeId(argValue("--run-id") || `storyboard-sequence-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const outputRoot = path.resolve(argValue("--output-root") || path.join(repoRoot, "real-test-sandbox", runId));
const fixtureRoot = path.resolve(argValue("--fixture-root") || path.join(repoRoot, "real-test-sandbox", "storyboard-sheet-chain-flex-live-20260520-01"));
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || process.env.IMAGE_MODEL || providerStatus?.imageModel || "gpt-image-2";
const baseUrl = argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || process.env.LANYI_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com/v1";
const size = argValue("--size") || "1280x720";
const quality = argValue("--quality") || "standard";
const maxRetries = Number(argValue("--max-retries") || "2");
const referenceAssets: Record<string, StoryboardReferenceAsset> = {
  scene_rooftop: {
    id: "scene_rooftop",
    role: "scene_baseline",
    path: path.join(fixtureRoot, "assets", "scenes", "after-rain-school-rooftop.png"),
    label: "雨后学校天台场景基准图",
    notes: ["rain-wet school rooftop", "railing", "rooftop door", "city skyline", "wet reflections"],
  },
  hina: {
    id: "hina",
    role: "character_identity",
    path: path.join(fixtureRoot, "assets", "characters", "hina-main-character.png"),
    label: "日奈角色参考",
    notes: ["short hair", "bow/ribbon", "school uniform", "restrained expression"],
  },
  ren: {
    id: "ren",
    role: "character_identity",
    path: path.join(fixtureRoot, "assets", "characters", "ren-supporting-character.png"),
    label: "莲角色参考",
    notes: ["teenage boy", "school uniform", "gentle posture"],
  },
  cassette: {
    id: "cassette",
    role: "prop_reference",
    path: path.join(fixtureRoot, "assets", "props", "blue-cassette-case.png"),
    label: "蓝色磁带盒道具参考",
    notes: ["small blue cassette case", "relationship prop"],
  },
};

mkdirSync(outputRoot, { recursive: true });
writeJson(path.join(outputRoot, "report", "story.json"), {
  ...story,
  fixtureRoot,
  referenceAssets: Object.values(referenceAssets).map((asset) => ({
    id: asset.id,
    role: asset.role,
    path: asset.path,
    label: asset.label,
    exists: existsSync(asset.path),
  })),
});

const generated = [];
for (const shot of story.shots) {
  generated.push(await generateShot({
    apiKey,
    baseUrl,
    model,
    quality,
    size,
    maxRetries,
    outputRoot,
    referenceAssets,
    shot,
  }));
}

const report = {
  schemaVersion: "storyboard_sequence_live_report_v1",
  runId,
  title: story.title,
  theme: story.theme,
  style: story.style,
  providerCalled: true,
  model,
  size,
  quality,
  fixtureRoot,
  referenceAssets: Object.values(referenceAssets).map((asset) => ({
    id: asset.id,
    role: asset.role,
    path: asset.path,
    label: asset.label,
  })),
  outputRoot,
  generated,
  successCount: generated.filter((item) => item.ok).length,
  missingCount: generated.filter((item) => !item.ok).length,
};
writeJson(path.join(outputRoot, "report", "storyboard-sequence-report.json"), report);
writeText(path.join(outputRoot, "report", "summary.md"), [
  `# ${story.title}`,
  "",
  story.theme,
  "",
  `- run_id: ${runId}`,
  `- model: ${model}`,
  `- size: ${size}`,
  `- success: ${report.successCount}/${generated.length}`,
  "",
  ...generated.map((item) => `- ${item.shotId} ${item.title}: ${item.ok ? item.relativeOutputPath : "failed"}`),
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: report.missingCount === 0,
  runId,
  outputRoot,
  successCount: report.successCount,
  missingCount: report.missingCount,
  storyboards: generated.map((item) => item.outputPath).filter(Boolean),
  reportPath: path.join(outputRoot, "report", "storyboard-sequence-report.json"),
}, null, 2));
