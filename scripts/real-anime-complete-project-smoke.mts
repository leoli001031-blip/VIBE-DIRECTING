import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { buildImage2CleanBasePrompt } from "../src/core/image2PromptBase.ts";
import { buildImage2VideoStartAnchorPrompt } from "../src/core/image2PromptBase.ts";
import {
  IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  IMAGE2_GENERATE_DEFAULT_SIZE,
} from "../src/core/providerPolicy.ts";
import { projectVibeModelVersion } from "../src/project/types.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";
import {
  buildLocalQwen3TtsClonePlan,
  runLocalQwen3TtsClonePlan,
} from "./runtime-routes/local-qwen3-tts-clone.mts";

type OutputKind = "character_asset" | "scene_asset" | "prop_asset" | "start_frame";
type OutputStatus = "needs_review" | "missing";
type ProviderRecord = {
  id: string;
  kind: OutputKind;
  shotId?: string;
  label: string;
  status: OutputStatus;
  outputPath?: string;
  outputSha256?: string;
  outputMimeType?: string;
  dimensions?: string;
  receiptPath: string;
  promptPath: string;
  attemptCount: number;
  providerRequestId?: string;
  errorMessage?: string;
  providerCalledExternal: boolean;
  promotionAllowed: false;
};

type ReferenceImage = {
  name: string;
  path: string;
  bytes: Buffer;
  mimeType: string;
  sha256: string;
};

type AssetKind = "character" | "scene" | "prop";

interface ShotPlan {
  id: string;
  title: string;
  durationSeconds: number;
  sceneAssetIds: string[];
  characterAssetIds: string[];
  propAssetIds: string[];
  dialogueJa: string;
  dialogueZh: string;
  startFramePrompt: string;
  videoPrompt: string;
}

interface ImagePlan {
  id: string;
  kind: OutputKind;
  assetKind?: AssetKind;
  shotId?: string;
  label: string;
  prompt: string;
  outputPath: string;
  receiptPath: string;
  promptPath: string;
  usedByShotIds: string[];
  constraints: string[];
}

interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

function argValue(name: string, fallback = ""): string {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1] || fallback;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "item";
}

function safeInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function packageRelative(packageRoot: string, filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  return path.relative(packageRoot, path.resolve(filePath)).replace(/\\/g, "/");
}

function imageFormat(buffer: Buffer): "png" | "jpeg" | "webp" | "unknown" {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "unknown";
}

function imageMime(format: ReturnType<typeof imageFormat>): string {
  if (format === "png") return "image/png";
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "application/octet-stream";
}

function imageMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function fileDimensions(filePath: string): string | undefined {
  try {
    const header = Buffer.from(readFileSync(filePath)).subarray(0, 24);
    if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function redact(value: unknown): string {
  return String(value || "")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .slice(0, 1400);
}

function runCommand(command: string, args: string[], options: { cwd: string; timeoutMs: number }): Promise<CommandResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut, durationMs: Date.now() - startedAt });
    });
  });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  async function runNext(): Promise<void> {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await runNext();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()));
  return results;
}

function animeStyleLine(): string {
  return [
    "ABSOLUTE STYLE LOCK: 2D Japanese TV anime, cel-shaded hand-drawn animation frame, clean line art, flat color blocks, illustrated skin, expressive anime eyes.",
    "Never render as live-action, real people, photorealistic portrait, cosplay photo, 3D CG, realistic skin pores, photographic lens blur, or cinematic realism.",
    "Use a restrained palette, clear silhouette, gentle after-rain atmosphere, simple composition, no text, captions, logos, watermarks, speech bubbles, extra fingers, distorted faces.",
  ].join(" ");
}

function buildShots(): ShotPlan[] {
  return [
    {
      id: "AN01",
      title: "雨后天台",
      durationSeconds: 5,
      sceneAssetIds: ["asset_scene_rooftop"],
      characterAssetIds: ["asset_character_hina"],
      propAssetIds: ["asset_prop_blue_cassette"],
      dialogueJa: "雨が止んだら、世界は少しだけ別の色になる。",
      dialogueZh: "雨停以后，世界会变成另一种颜色。",
      startFramePrompt: "16:9 start frame. A high school rooftop just after rain at blue hour. Hina stands left of center, side-facing the camera, one hand on the wet railing, the blue cassette case partly visible in her other hand. Her hair and skirt move slightly in the wind, puddles reflect the pale sky, the city is soft in the distance.",
      videoPrompt: "Use the first frame as the exact visual anchor. Create a gentle Japanese anime shot: very slow push-in, rainwater sliding from the railing, Hina breathes, blinks, and turns her eyes toward the cassette. Preserve character design and scene layout, no subtitles, no music.",
    },
    {
      id: "AN02",
      title: "走廊里的磁带",
      durationSeconds: 5,
      sceneAssetIds: ["asset_scene_rooftop"],
      characterAssetIds: ["asset_character_hina", "asset_character_ren"],
      propAssetIds: ["asset_prop_blue_cassette"],
      dialogueJa: "そのテープ、まだ聞かないで。",
      dialogueZh: "那盘磁带，现在还不能听。",
      startFramePrompt: "16:9 start frame. School corridor near the rooftop door, warm indoor light behind Ren on the right, cool rainy daylight from the left. Ren faces Hina with one hand raised gently as if stopping her; Hina is foreground left, back three-quarter to camera, holding the blue cassette case at chest level. Clear distance between them.",
      videoPrompt: "Use the first frame as the exact visual anchor. Create a slow handheld anime shot with subtle breathing motion: Ren lowers his raised hand a little, Hina grips the cassette tighter, hallway lights flicker softly. Preserve positions, no extra characters, no subtitles, no music.",
    },
    {
      id: "AN03",
      title: "河边电车站",
      durationSeconds: 5,
      sceneAssetIds: ["asset_scene_tram_stop"],
      characterAssetIds: ["asset_character_hina"],
      propAssetIds: ["asset_prop_blue_cassette"],
      dialogueJa: "でも、今じゃなきゃ間に合わない。",
      dialogueZh: "可是如果不是现在，就来不及了。",
      startFramePrompt: "16:9 start frame. Riverside tram stop after rain, Hina runs in from frame left toward the ticket gate on the right, cassette case in a small shoulder pouch, wet pavement reflecting orange signal lights. She looks forward with urgency, one foot just above the ground, clear motion-ready pose.",
      videoPrompt: "Use the first frame as the exact visual anchor. Create a smooth anime tracking shot: Hina takes two quick running steps, her bag swings, puddles ripple, the tram signal changes in the background. Motion starts gently then becomes quicker, no subtitles, no music.",
    },
    {
      id: "AN04",
      title: "桥下约定",
      durationSeconds: 5,
      sceneAssetIds: ["asset_scene_tram_stop"],
      characterAssetIds: ["asset_character_hina", "asset_character_ren"],
      propAssetIds: ["asset_prop_blue_cassette"],
      dialogueJa: "じゃあ一緒に走ろう。最後の電車まで。",
      dialogueZh: "那就一起跑吧，赶上最后一班电车。",
      startFramePrompt: "16:9 start frame. Under a riverside rail bridge, Hina stands on the left catching her breath, Ren stands on the right offering his hand, both side-facing the camera. The blue cassette case is visible between them. Reflected water light moves across the bridge columns, hopeful but quiet mood.",
      videoPrompt: "Use the first frame as the exact visual anchor. Create a warm anime shot: Ren's hand moves slightly closer, Hina hesitates then reaches toward him, water reflections shimmer on their faces. Keep the gesture small and readable, no subtitles, no music.",
    },
    {
      id: "AN05",
      title: "黎明前的电车",
      durationSeconds: 6,
      sceneAssetIds: ["asset_scene_tram_stop"],
      characterAssetIds: ["asset_character_hina", "asset_character_ren"],
      propAssetIds: ["asset_prop_blue_cassette"],
      dialogueJa: "うん。朝が来る前に、届けよう。",
      dialogueZh: "嗯，在天亮之前，把它送到。",
      startFramePrompt: "16:9 start frame. Wide shot of the first dawn light at the riverside tram platform. Hina and Ren run together from left to right toward an arriving tram, the blue cassette case secured in Hina's hand. The city horizon is pale, wet rails gleam, strong clean silhouettes.",
      videoPrompt: "Use the first frame as the exact visual anchor. Create a cinematic anime shot: the tram doors open, Hina and Ren slow down as they reach the platform edge, dawn light expands across the wet tracks. Preserve the 16:9 composition, no subtitles, no music.",
    },
  ];
}

function buildImagePlans(packageRoot: string, shots: ShotPlan[]): ImagePlan[] {
  const style = animeStyleLine();
  const allShotIds = shots.map((shot) => shot.id);
  const assetPlans: ImagePlan[] = [
    {
      id: "asset_character_hina",
      kind: "character_asset",
      assetKind: "character",
      label: "Hina main character reference",
      outputPath: path.join(packageRoot, "assets", "characters", "hina-main-character.png"),
      receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "hina-main-character.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-hina-main-character.md"),
      usedByShotIds: allShotIds,
      constraints: ["navy school jacket", "short dark bob hair", "red umbrella strap", "quiet determined expression"],
      prompt: [
        style,
        "16:9 character reference sheet for an original short anime film.",
        "Hina, 17-year-old Japanese high school girl, short dark bob hair, navy school jacket, white shirt, muted red ribbon, red umbrella strap on her shoulder, slim school bag.",
        "Show one clean front three-quarter pose and one small side pose in the same frame, neutral background, consistent face, expressive but grounded.",
      ].join(" "),
    },
    {
      id: "asset_character_ren",
      kind: "character_asset",
      assetKind: "character",
      label: "Ren supporting character reference",
      outputPath: path.join(packageRoot, "assets", "characters", "ren-supporting-character.png"),
      receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "ren-supporting-character.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-ren-supporting-character.md"),
      usedByShotIds: ["AN02", "AN04", "AN05"],
      constraints: ["school cardigan", "black headphones around neck", "small wrist bandage", "gentle anxious expression"],
      prompt: [
        style,
        "16:9 character reference sheet for an original short anime film.",
        "Ren, 17-year-old Japanese high school boy, soft black hair, gray school cardigan, black headphones around his neck, small white bandage on his wrist, gentle anxious expression.",
        "Show one front three-quarter pose and one small side pose in the same frame, neutral background, consistent face and proportions.",
      ].join(" "),
    },
    {
      id: "asset_scene_rooftop",
      kind: "scene_asset",
      assetKind: "scene",
      label: "After-rain school rooftop and corridor",
      outputPath: path.join(packageRoot, "assets", "scenes", "after-rain-school-rooftop.png"),
      receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "after-rain-school-rooftop.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-scene-rooftop.md"),
      usedByShotIds: ["AN01", "AN02"],
      constraints: ["wet rooftop railing", "blue hour city view", "rooftop door corridor", "puddle reflections"],
      prompt: [
        style,
        "16:9 scene reference for an original Japanese anime short film.",
        "After-rain high school rooftop at blue hour with wet railing, rooftop door, nearby corridor entrance, puddles, distant low city skyline, quiet wind.",
        "No characters, no text, clear layout that can support medium shots and wide shots.",
      ].join(" "),
    },
    {
      id: "asset_scene_tram_stop",
      kind: "scene_asset",
      assetKind: "scene",
      label: "Riverside tram stop and rail bridge",
      outputPath: path.join(packageRoot, "assets", "scenes", "riverside-tram-stop.png"),
      receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "riverside-tram-stop.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-scene-tram-stop.md"),
      usedByShotIds: ["AN03", "AN04", "AN05"],
      constraints: ["riverside tram platform", "wet rails", "rail bridge columns", "orange signal lights", "dawn horizon"],
      prompt: [
        style,
        "16:9 scene reference for an original Japanese anime short film.",
        "Riverside tram stop after rain, wet platform and rails, rail bridge columns, river reflections, orange signal lamps, pale dawn horizon beyond the city.",
        "No characters, no text, clean visual map for tracking shots and wide shots.",
      ].join(" "),
    },
    {
      id: "asset_prop_blue_cassette",
      kind: "prop_asset",
      assetKind: "prop",
      label: "Blue cassette case prop",
      outputPath: path.join(packageRoot, "assets", "props", "blue-cassette-case.png"),
      receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "blue-cassette-case.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-prop-blue-cassette.md"),
      usedByShotIds: allShotIds,
      constraints: ["translucent blue cassette case", "small handwritten white label without readable text", "worn corner", "important story prop"],
      prompt: [
        style,
        "16:9 prop reference for an original Japanese anime short film.",
        "A translucent blue cassette tape case with a worn corner and a tiny blank white label, shown clearly on a wet school uniform cloth.",
        "Keep it simple and iconic, no readable text, no hands, no logo.",
      ].join(" "),
    },
  ];

  const startFrames = shots.map((shot, index): ImagePlan => ({
    id: `${shot.id}_start_frame`,
    kind: "start_frame",
    shotId: shot.id,
    label: `${shot.id} start frame`,
    outputPath: path.join(packageRoot, "start-frames", `${shot.id}-start.png`),
    receiptPath: path.join(packageRoot, "receipts", "image2", "start-frames", `${shot.id}-start.json`),
    promptPath: path.join(packageRoot, "receipts", "prompts", `${shot.id}-start.md`),
    usedByShotIds: [shot.id],
    constraints: [
      "use locked character/scene/prop visual memory",
      "motion-ready first frame",
      "no endpoint frame",
      `sequence index ${index + 1}`,
    ],
    prompt: [
      style,
      "The attached reference images are visual authority for character identity, anime style, scene layout, and prop design.",
      "Do not reinterpret the attached anime references as real people, live-action actors, cosplay, 3D, or photographic realism.",
      shot.startFramePrompt,
      "Use the visual memory from the generated character, scene, and prop references.",
      "This is only the first frame for image-to-video; make the pose motion-ready with small living details.",
    ].join(" "),
  }));

  return [...assetPlans, ...startFrames];
}

async function generateImagePlan(input: {
  plan: ImagePlan;
  referenceImages?: ReferenceImage[];
  packageRoot: string;
  runId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  requestedSize: string;
  requestedAspectRatio: string;
  timeoutMs: number;
  maxAutoRetries: number;
}): Promise<ProviderRecord> {
  writeText(input.plan.promptPath, `${input.plan.prompt}\n`);
  let lastMessage = "";
  for (let attempt = 1; attempt <= input.maxAutoRetries + 1; attempt += 1) {
    const prompt = input.plan.kind === "start_frame"
      ? buildImage2VideoStartAnchorPrompt({
          sourcePrompt: input.plan.prompt,
          frameRole: "video_start_anchor",
          aspectRatio: input.requestedAspectRatio,
          maxSourceCharacters: 1800,
          subjectAnchor: input.plan.label,
        })
      : buildImage2CleanBasePrompt({
          sourcePrompt: input.plan.prompt,
          frameRole: input.plan.kind,
          aspectRatio: input.requestedAspectRatio,
          maxSourceCharacters: 1800,
        });
    const references = input.referenceImages || [];
    const result = await fetchLanyiImageViaResponsesStream({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      prompt,
      size: input.requestedSize,
      referenceImages: references,
      timeoutMs: input.timeoutMs,
      providerOperation: references.length
        ? "responses.image_generation.start_frame_with_visual_references"
        : input.plan.kind === "start_frame" ? "responses.image_generation.start_frame" : "responses.image_generation.asset",
    });

    const attemptReceiptPath = path.join(input.packageRoot, "receipts", "image2", "attempts", `${safeId(input.plan.id)}-${attempt}.json`);
    writeJson(attemptReceiptPath, {
      schemaVersion: "anime_complete_project_image2_attempt_v1",
      runId: input.runId,
      outputId: input.plan.id,
      shotId: input.plan.shotId,
      attempt,
      ok: result.ok === true,
      providerRequestId: result.providerRequestId,
      providerCalledExternal: true,
      attachedReferenceCount: references.length,
      attachedReferenceHashes: references.map((reference) => reference.sha256),
      message: redact(result.message || result.diagnostic?.message || ""),
      statusCode: result.statusCode,
      failureKind: result.failureKind || result.errorType,
      rawCredentialMaterialIncluded: false,
    });

    if (result.ok && result.bytes?.length) {
      mkdirSync(path.dirname(input.plan.outputPath), { recursive: true });
      writeFileSync(input.plan.outputPath, result.bytes);
      const bytes = readFileSync(input.plan.outputPath);
      const format = imageFormat(bytes);
      const record: ProviderRecord = {
        id: input.plan.id,
        kind: input.plan.kind,
        shotId: input.plan.shotId,
        label: input.plan.label,
        status: "needs_review",
        outputPath: input.plan.outputPath,
        outputSha256: sha256(bytes),
        outputMimeType: imageMime(format),
        dimensions: fileDimensions(input.plan.outputPath),
        receiptPath: input.plan.receiptPath,
        promptPath: input.plan.promptPath,
        attemptCount: attempt,
        providerRequestId: result.providerRequestId,
        providerCalledExternal: true,
        promotionAllowed: false,
      };
      writeJson(input.plan.receiptPath, {
        schemaVersion: "anime_complete_project_image2_output_receipt_v1",
        receiptId: `receipt_${safeId(input.runId)}_${safeId(input.plan.id)}`,
        runId: input.runId,
        outputId: input.plan.id,
        kind: input.plan.kind,
        assetKind: input.plan.assetKind,
        shotId: input.plan.shotId,
        label: input.plan.label,
        status: record.status,
        providerId: "lanyi-image2",
        providerCalledExternal: true,
        providerRequestId: result.providerRequestId,
        requestedSize: input.requestedSize,
        requestedAspectRatio: input.requestedAspectRatio,
        outputPath: packageRelative(input.packageRoot, record.outputPath),
        outputSha256: record.outputSha256,
        outputMimeType: record.outputMimeType,
        dimensions: record.dimensions,
        promptPath: packageRelative(input.packageRoot, input.plan.promptPath),
        constraints: input.plan.constraints,
        usedByShotIds: input.plan.usedByShotIds,
        attachedReferenceCount: references.length,
        attachedReferences: references.map((reference) => ({
          name: reference.name,
          sha256: reference.sha256,
          mimeType: reference.mimeType,
        })),
        humanReviewRequired: true,
        promotionAllowed: false,
        providerSelfReportIgnoredForCompletion: true,
      });
      return record;
    }

    lastMessage = redact(result.message || result.diagnostic?.message || "image output missing");
  }

  const record: ProviderRecord = {
    id: input.plan.id,
    kind: input.plan.kind,
    shotId: input.plan.shotId,
    label: input.plan.label,
    status: "missing",
    receiptPath: input.plan.receiptPath,
    promptPath: input.plan.promptPath,
    attemptCount: input.maxAutoRetries + 1,
    errorMessage: lastMessage || "Image output missing after retry budget.",
    providerCalledExternal: true,
    promotionAllowed: false,
  };
  writeJson(input.plan.receiptPath, {
    schemaVersion: "anime_complete_project_image2_output_receipt_v1",
    receiptId: `receipt_${safeId(input.runId)}_${safeId(input.plan.id)}`,
    runId: input.runId,
    outputId: input.plan.id,
    kind: input.plan.kind,
    assetKind: input.plan.assetKind,
    shotId: input.plan.shotId,
    label: input.plan.label,
    status: "missing",
    providerId: "lanyi-image2",
    providerCalledExternal: true,
    requestedSize: input.requestedSize,
    requestedAspectRatio: input.requestedAspectRatio,
    errorMessage: record.errorMessage,
    promptPath: packageRelative(input.packageRoot, input.plan.promptPath),
    attachedReferenceCount: input.referenceImages?.length || 0,
    attachedReferences: (input.referenceImages || []).map((reference) => ({
      name: reference.name,
      sha256: reference.sha256,
      mimeType: reference.mimeType,
    })),
    humanReviewRequired: true,
    promotionAllowed: false,
    providerSelfReportIgnoredForCompletion: true,
  });
  return record;
}

async function generateImages(input: {
  plans: ImagePlan[];
  referenceImagesForPlan?: (plan: ImagePlan) => ReferenceImage[];
  packageRoot: string;
  runId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  requestedSize: string;
  requestedAspectRatio: string;
  timeoutMs: number;
  maxConcurrency: number;
  maxAutoRetries: number;
}): Promise<ProviderRecord[]> {
  return runWithConcurrency(input.plans, input.maxConcurrency, async (plan) => {
    const referenceImages = input.referenceImagesForPlan?.(plan) || [];
    const record = await generateImagePlan({
      plan,
      referenceImages,
      packageRoot: input.packageRoot,
      runId: input.runId,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      requestedSize: input.requestedSize,
      requestedAspectRatio: input.requestedAspectRatio,
      timeoutMs: input.timeoutMs,
      maxAutoRetries: input.maxAutoRetries,
    });
    console.log(`[image2] ${plan.id}: ${record.status}${record.dimensions ? ` ${record.dimensions}` : ""}${referenceImages.length ? ` refs=${referenceImages.length}` : ""}`);
    return record;
  });
}

function referenceImagesForStartPlan(input: {
  plan: ImagePlan;
  shots: ShotPlan[];
  assetPlans: ImagePlan[];
  assetRecords: ProviderRecord[];
}): ReferenceImage[] {
  if (input.plan.kind !== "start_frame" || !input.plan.shotId) return [];
  const shot = input.shots.find((item) => item.id === input.plan.shotId);
  if (!shot) return [];
  const requiredAssetIds = new Set([
    ...shot.characterAssetIds,
    ...shot.sceneAssetIds,
    ...shot.propAssetIds,
  ]);
  const assetPlanById = new Map(input.assetPlans.map((plan) => [plan.id, plan]));
  const recordsById = new Map(input.assetRecords.map((record) => [record.id, record]));
  return Array.from(requiredAssetIds).flatMap((assetId) => {
    const record = recordsById.get(assetId);
    if (!record?.outputPath || !existsSync(record.outputPath)) return [];
    const bytes = readFileSync(record.outputPath);
    return [{
      name: assetPlanById.get(assetId)?.label || assetId,
      path: record.outputPath,
      bytes,
      mimeType: record.outputMimeType || imageMimeFromPath(record.outputPath),
      sha256: record.outputSha256 || sha256(bytes),
    }];
  });
}

function defaultQwenReferencePath(repoRoot: string): string {
  const candidates = [
    path.join(repoRoot, "real-test-sandbox/tts-japanese-boy-20260520/references/shirakami_kotarou-normal-reference.wav"),
    path.join(repoRoot, "real-test-sandbox/qwen3-tts-reference-20260520/references/qwen_official_clone.wav"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

async function generateDialogueAudio(input: {
  packageRoot: string;
  runId: string;
  shots: ShotPlan[];
  enabled: boolean;
  confirmed: boolean;
  referenceAudioPath: string;
  timeoutMs: number;
}) {
  const receiptPath = path.join(input.packageRoot, "receipts", "audio", "dialogue-full-qwen3.json");
  const cuePath = path.join(input.packageRoot, "audio", "dialogue", "dialogue-cues.json");
  const outputRelativePath = "audio/dialogue/dialogue-full-qwen3.wav";
  const dialogueText = input.shots.map((shot) => `${shot.dialogueJa}`).join(" ");
  writeJson(cuePath, {
    schemaVersion: "anime_complete_project_dialogue_cues_v1",
    runId: input.runId,
    language: "Japanese",
    output: outputRelativePath,
    cues: input.shots.map((shot, index) => ({
      shotId: shot.id,
      order: index + 1,
      textJa: shot.dialogueJa,
      textZh: shot.dialogueZh,
      durationHintSeconds: shot.durationSeconds,
    })),
  });

  if (!input.enabled) {
    writeJson(receiptPath, {
      schemaVersion: "anime_complete_project_tts_receipt_v1",
      runId: input.runId,
      providerId: "local-qwen3-tts-clone",
      status: "skipped",
      providerCalledExternal: false,
      localRuntimeCalled: false,
      outputPath: outputRelativePath,
    });
    return { status: "skipped", receiptPath, cuePath, outputPath: undefined as string | undefined };
  }
  if (!input.confirmed) {
    writeJson(receiptPath, {
      schemaVersion: "anime_complete_project_tts_receipt_v1",
      runId: input.runId,
      providerId: "local-qwen3-tts-clone",
      status: "blocked_missing_confirmation",
      providerCalledExternal: false,
      localRuntimeCalled: false,
      outputPath: outputRelativePath,
      message: "Local voice-clone TTS needs an explicit confirmation token.",
    });
    return { status: "blocked_missing_confirmation", receiptPath, cuePath, outputPath: undefined as string | undefined };
  }

  try {
    const plan = buildLocalQwen3TtsClonePlan({
      text: dialogueText,
      language: "Japanese",
      shotId: "dialogue_full",
      referenceAudioPath: input.referenceAudioPath,
      xVectorOnlyMode: true,
      confirmationToken: "submit-local-qwen3-tts-clone",
      permissionReceiptId: `permission_${input.runId}_local_qwen3_tts_clone`,
      outputRelativePath,
      timeoutMs: input.timeoutMs,
    }, { runtimeRoot: input.packageRoot });
    const result = await runLocalQwen3TtsClonePlan(plan);
    if (!result.ok) {
      writeJson(receiptPath, {
        schemaVersion: "anime_complete_project_tts_receipt_v1",
        runId: input.runId,
        providerId: "local-qwen3-tts-clone",
        status: result.status,
        ok: false,
        outputPath: outputRelativePath,
        textHash: plan.textHash,
        referenceAudioSha256: plan.referenceAudioHash,
        rawReferencePathRedacted: true,
        localRuntimeCalled: true,
        providerCalledExternal: false,
        runtimeExternalNetworkCallMade: false,
        message: redact(result.message || result.stderr || result.stdout),
      });
      return { status: result.status, receiptPath, cuePath, outputPath: undefined as string | undefined };
    }
    writeJson(receiptPath, {
      schemaVersion: "anime_complete_project_tts_receipt_v1",
      runId: input.runId,
      providerId: "local-qwen3-tts-clone",
      status: "created",
      ok: true,
      language: plan.language,
      outputPath: outputRelativePath,
      outputSha256: result.outputSha256,
      outputSizeBytes: result.outputSizeBytes,
      textHash: plan.textHash,
      referenceAudioSha256: plan.referenceAudioHash,
      rawReferencePathRedacted: true,
      localRuntimeCalled: true,
      providerCalledExternal: false,
      runtimeExternalNetworkCallMade: false,
      permissionReceiptId: plan.permissionReceiptId,
    });
    console.log(`[tts] dialogue_full: created (${result.outputSizeBytes} bytes)`);
    return { status: "created", receiptPath, cuePath, outputPath: path.join(input.packageRoot, outputRelativePath) };
  } catch (error) {
    writeJson(receiptPath, {
      schemaVersion: "anime_complete_project_tts_receipt_v1",
      runId: input.runId,
      providerId: "local-qwen3-tts-clone",
      status: "blocked",
      ok: false,
      outputPath: outputRelativePath,
      rawReferencePathRedacted: true,
      localRuntimeCalled: false,
      providerCalledExternal: false,
      runtimeExternalNetworkCallMade: false,
      message: redact(error instanceof Error ? error.message : String(error)),
    });
    return { status: "blocked", receiptPath, cuePath, outputPath: undefined as string | undefined };
  }
}

async function runJimengShot(input: {
  repoRoot: string;
  packageRoot: string;
  runId: string;
  shot: ShotPlan;
  imagePath: string;
  live: boolean;
  confirmed: boolean;
  queueWaitSeconds: number;
  shortPollSeconds: number;
  pollIntervalSeconds: number;
}): Promise<Record<string, unknown>> {
  const outputRoot = path.join(input.packageRoot, "video", input.shot.id);
  const args = [
    "tsx",
    "scripts/jimeng-video-cli-smoke.mts",
    "--shot-id", input.shot.id,
    "--image", input.imagePath,
    "--prompt", input.shot.videoPrompt,
    "--output-root", outputRoot,
    "--duration", String(input.shot.durationSeconds),
    "--video-resolution", "720p",
    "--model-version", "seedance2.0",
    "--queue-wait-seconds", String(input.queueWaitSeconds),
    "--short-poll-seconds", String(input.shortPollSeconds),
    "--poll-interval-seconds", String(input.pollIntervalSeconds),
  ];
  if (input.live) args.push("--live");
  if (input.confirmed) args.push("--confirm-live", "submit-jimeng-video");

  const startedAt = Date.now();
  const result = await runCommand("npx", args, {
    cwd: input.repoRoot,
    timeoutMs: Math.max(300_000, (input.queueWaitSeconds + 180) * 1000),
  });
  const reportPath = path.join(outputRoot, "report", "report.json");
  let report: Record<string, unknown> = {
    ok: false,
    status: result.exitCode === 0 ? "missing_report" : "command_failed",
    shotId: input.shot.id,
    providerCalledExternal: input.live && input.confirmed,
    durationMs: Date.now() - startedAt,
    stdoutTail: redact(result.stdout).slice(-1200),
    stderrTail: redact(result.stderr).slice(-1200),
  };
  if (existsSync(reportPath)) {
    try {
      report = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch {
      report = {
        ...report,
        status: "report_parse_failed",
      };
    }
  }
  console.log(`[jimeng] ${input.shot.id}: ${String(report.status || "unknown")}`);
  return {
    shotId: input.shot.id,
    outputRoot: packageRelative(input.packageRoot, outputRoot),
    reportPath: packageRelative(input.packageRoot, reportPath),
    commandExitCode: result.exitCode,
    commandTimedOut: result.timedOut,
    commandDurationMs: result.durationMs,
    ...report,
  };
}

async function renderFinalVideo(input: {
  repoRoot: string;
  packageRoot: string;
  runId: string;
  shots: ShotPlan[];
  videoReports: Record<string, unknown>[];
  audioPath?: string;
}): Promise<Record<string, unknown>> {
  const clips = input.videoReports
    .map((report) => ({
      shotId: String(report.shotId || ""),
      videoPath: String(report.firstFrameProtectedVideoPath || report.outputVideoPath || ""),
    }))
    .filter((item) => item.shotId && item.videoPath && existsSync(item.videoPath));
  if (!clips.length) {
    const report = {
      ok: false,
      status: "skipped_no_video_clips",
      providerCalledExternal: false,
      runtimeExternalNetworkCallMade: false,
      clipCount: 0,
      audioIncluded: Boolean(input.audioPath),
    };
    writeJson(path.join(input.packageRoot, "final-video", "final-video-render-report.json"), report);
    return report;
  }

  const args = [
    "tsx",
    "scripts/final-video-render-smoke.mts",
    "--run-id", `${input.runId}-final-video`,
    "--output-root", path.join(input.packageRoot, "final-video-render"),
    "--output", path.join(input.packageRoot, "final-video", "final.mp4"),
  ];
  clips.forEach((clip, index) => {
    args.push("--clip", clip.videoPath);
    args.push(`--clip-${index + 1}-shot`, clip.shotId);
  });
  if (input.audioPath && existsSync(input.audioPath)) args.push("--audio", input.audioPath);

  const result = await runCommand("npx", args, {
    cwd: input.repoRoot,
    timeoutMs: 10 * 60 * 1000,
  });
  const reportPath = path.join(input.packageRoot, "final-video-render", "report", "final-video-render-report.json");
  let report: Record<string, unknown> = {
    ok: false,
    status: result.exitCode === 0 ? "missing_report" : "command_failed",
    providerCalledExternal: false,
    runtimeExternalNetworkCallMade: false,
    clipCount: clips.length,
    audioIncluded: Boolean(input.audioPath),
    stdoutTail: redact(result.stdout).slice(-1200),
    stderrTail: redact(result.stderr).slice(-1200),
  };
  if (existsSync(reportPath)) {
    try {
      report = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch {
      report = { ...report, status: "report_parse_failed" };
    }
  }
  writeJson(path.join(input.packageRoot, "final-video", "final-video-render-summary.json"), {
    ...report,
    clips: clips.map((clip) => ({
      shotId: clip.shotId,
      videoPath: packageRelative(input.packageRoot, clip.videoPath),
    })),
  });
  console.log(`[final-video] ${String(report.status || "unknown")}`);
  return report;
}

function writeProjectVibe(input: {
  packageRoot: string;
  runId: string;
  generatedAt: string;
  shots: ShotPlan[];
  imagePlans: ImagePlan[];
  imageRecords: ProviderRecord[];
  audio: Awaited<ReturnType<typeof generateDialogueAudio>>;
  videoReports: Record<string, unknown>[];
  finalVideo: Record<string, unknown>;
}): string {
  const recordById = new Map(input.imageRecords.map((record) => [record.id, record]));
  const imagePlanById = new Map(input.imagePlans.map((plan) => [plan.id, plan]));
  const videoByShotId = new Map(input.videoReports.map((report) => [String(report.shotId || ""), report]));
  const assets = input.imagePlans.filter((plan) => plan.kind !== "start_frame").map((plan) => {
    const record = recordById.get(plan.id);
    return {
      id: plan.id,
      kind: plan.assetKind,
      label: plan.label,
      status: record?.status || "missing",
      path: packageRelative(input.packageRoot, record?.outputPath),
      textConstraints: plan.constraints,
      usedByShotIds: plan.usedByShotIds,
      sourceRefs: [
        record?.receiptPath ? `receipt:${packageRelative(input.packageRoot, record.receiptPath)}` : undefined,
        plan.promptPath ? `prompt:${packageRelative(input.packageRoot, plan.promptPath)}` : undefined,
      ].filter(Boolean),
    };
  });

  const project = {
    kind: "project_vibe_document",
    modelVersion: projectVibeModelVersion,
    manifest: {
      projectId: "real_anime_complete_project_smoke",
      title: "雨后第七封信",
      version: "0.1.0",
      createdAt: input.generatedAt,
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      portableRoot: "project_root",
      runtimeFixtureAuthority: false,
    },
    storyFlow: {
      id: "story_flow_after_rain_seventh_letter",
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      sections: [{
        id: "main_sequence",
        title: "雨后第七封信",
        summary: "A compact five-shot Japanese anime style test project with visual assets, start frames, dialogue audio, Jimeng video jobs, and exportable receipts.",
        sequenceIndex: 1,
        shotIds: input.shots.map((shot) => shot.id),
      }],
      shotOrder: input.shots.map((shot) => shot.id),
    },
    visualMemory: {
      id: "visual_memory_after_rain_seventh_letter",
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      referencePolicy: {
        temporaryOutputsMayBecomeAuthority: false,
        runtimeFixturesMayBecomeAuthority: false,
        lockedAssetsRequiredForGeneration: true,
        endpointFramesDefault: "disabled",
      },
      entries: assets.map((asset) => ({
        id: `vm_${asset.id}`,
        assetId: asset.id,
        kind: asset.kind,
        label: asset.label,
        status: asset.status,
        textConstraints: asset.textConstraints,
        usedByShotIds: asset.usedByShotIds,
        canUseAsFutureReference: asset.status === "needs_review",
        sourceRefs: asset.sourceRefs,
      })),
    },
    shots: input.shots.map((shot) => {
      const startPlan = imagePlanById.get(`${shot.id}_start_frame`);
      const startRecord = recordById.get(`${shot.id}_start_frame`);
      const video = videoByShotId.get(shot.id);
      return {
        id: shot.id,
        sectionId: "main_sequence",
        title: shot.title,
        durationSeconds: shot.durationSeconds,
        videoControlMode: "first_frame_default",
        endpointFramePolicy: "disabled_by_default",
        sceneAssetIds: shot.sceneAssetIds,
        characterAssetIds: shot.characterAssetIds,
        propAssetIds: shot.propAssetIds,
        dialogue: {
          language: "Japanese",
          textJa: shot.dialogueJa,
          textZh: shot.dialogueZh,
          audioTrack: input.audio.outputPath ? "audio/dialogue/dialogue-full-qwen3.wav" : undefined,
        },
        startFrame: {
          status: startRecord?.status || "missing",
          path: packageRelative(input.packageRoot, startRecord?.outputPath),
          promptPath: packageRelative(input.packageRoot, startPlan?.promptPath),
          receiptPath: packageRelative(input.packageRoot, startRecord?.receiptPath),
        },
        video: {
          providerId: "jimeng-video-cli",
          status: String(video?.status || "planned"),
          submitId: video?.submitId,
          outputVideoPath: packageRelative(input.packageRoot, String(video?.outputVideoPath || "") || undefined),
          firstFrameProtectedVideoPath: packageRelative(input.packageRoot, String(video?.firstFrameProtectedVideoPath || "") || undefined),
          reportPath: video?.reportPath,
          resumeCommand: video?.resumeCommand,
        },
        status: startRecord?.status === "needs_review" ? "generated" : "blocked",
        sourceRefs: [
          startRecord?.receiptPath ? `receipt:${packageRelative(input.packageRoot, startRecord.receiptPath)}` : undefined,
          video?.reportPath ? `video-report:${video.reportPath}` : undefined,
        ].filter(Boolean),
      };
    }),
    assets,
    audio: {
      dialogueTrack: {
        providerId: "local-qwen3-tts-clone",
        status: input.audio.status,
        language: "Japanese",
        path: input.audio.outputPath ? "audio/dialogue/dialogue-full-qwen3.wav" : undefined,
        cueSheet: packageRelative(input.packageRoot, input.audio.cuePath),
        receiptPath: packageRelative(input.packageRoot, input.audio.receiptPath),
      },
    },
    runs: [{
      id: `run_${safeId(input.runId)}`,
      runKind: "real_project_smoke",
      status: input.imageRecords.some((record) => record.status === "missing") ? "partial" : "succeeded",
      createdAt: input.generatedAt,
      summary: "Real anime-style project smoke: assets, start frames, local dialogue TTS, Jimeng video jobs, and final video render when clips are available.",
      sourceFactHash: sha256Text(JSON.stringify({ shots: input.shots.map((shot) => shot.id), assets: assets.map((asset) => asset.id) })),
      affectedShotIds: input.shots.map((shot) => shot.id),
      producedAssetIds: assets.map((asset) => asset.id),
      evidenceRefs: [
        "report/report.json",
        "receipts/export-package-manifest.json",
        "Project.vibe",
      ],
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    }],
    receipts: {
      batchReceipts: [{
        id: `batch_${safeId(input.runId)}_image2`,
        createdAt: input.generatedAt,
        batchId: `${input.runId}:image2`,
        status: input.imageRecords.some((record) => record.status === "missing") ? "partial" : "succeeded",
        providerId: "lanyi-image2",
        taskEnvelopeIds: input.imageRecords.map((record) => record.id),
        affectedShotIds: input.shots.map((shot) => shot.id),
        returnedOutputCount: input.imageRecords.filter((record) => record.status === "needs_review").length,
        missingOutputCount: input.imageRecords.filter((record) => record.status === "missing").length,
        outputHashes: input.imageRecords.map((record) => record.outputSha256).filter(Boolean),
        providerSelfReportCanPromote: false,
        projectFactsMutated: false,
        runtimeFixtureUsed: false,
      }],
      reviewReceipts: input.imageRecords.map((record) => ({
        id: `review_${safeId(record.id)}`,
        createdAt: input.generatedAt,
        status: record.status,
        humanReviewed: false,
        shotId: record.shotId,
        assetId: record.kind !== "start_frame" ? record.id : undefined,
        sourceReceiptId: `receipt_${safeId(input.runId)}_${safeId(record.id)}`,
        sourceRunId: input.runId,
        outputPath: packageRelative(input.packageRoot, record.outputPath),
        outputHash: record.outputSha256,
        retryRequested: record.status === "missing",
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        blockers: record.status === "needs_review"
          ? ["Human review is required before this output becomes authoritative visual memory."]
          : ["Output is missing after retry budget."],
      })),
    },
    sourceIndex: {
      id: "source_index_after_rain_seventh_letter",
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      manifestRef: "Project.vibe#manifest",
      shotRefs: input.shots.map((shot) => `Project.vibe#shots/${shot.id}`),
      assetRefs: assets.map((asset) => `Project.vibe#assets/${asset.id}`),
      audioRefs: ["Project.vibe#audio/dialogueTrack"],
    },
  };
  const projectPath = path.join(input.packageRoot, "Project.vibe");
  writeJson(projectPath, project);
  return projectPath;
}

function writePackageReport(input: {
  packageRoot: string;
  runId: string;
  generatedAt: string;
  shots: ShotPlan[];
  imageRecords: ProviderRecord[];
  audio: Awaited<ReturnType<typeof generateDialogueAudio>>;
  videoReports: Record<string, unknown>[];
  finalVideo: Record<string, unknown>;
  projectPath: string;
  requestedSize: string;
  requestedAspectRatio: string;
  maxConcurrency: number;
  maxAutoRetries: number;
}): void {
  const reportPath = path.join(input.packageRoot, "report", "report.json");
  const manifestPath = path.join(input.packageRoot, "receipts", "export-package-manifest.json");
  const assets = input.imageRecords.filter((record) => record.kind !== "start_frame");
  const startFrames = input.imageRecords.filter((record) => record.kind === "start_frame");
  const pendingVideoStatuses = new Set(["queued", "generating", "submitted", "timed_out"]);
  const videoSuccessCount = input.videoReports.filter((report) => String(report.status) === "success").length;
  const videoPendingCount = input.videoReports.filter((report) => pendingVideoStatuses.has(String(report.status))).length;
  const videoSubmittedCount = input.videoReports.filter((report) => report.providerCalledExternal === true).length;
  const report = {
    schemaVersion: "anime_complete_project_smoke_report_v1",
    runId: input.runId,
    generatedAt: input.generatedAt,
    ok: input.imageRecords.every((record) => record.status === "needs_review") && input.audio.status === "created",
    status: input.imageRecords.some((record) => record.status === "missing") ? "partial_images" : "project_package_created",
    packageRoot: input.packageRoot,
    projectVibe: packageRelative(input.packageRoot, input.projectPath),
    image2: {
      providerId: "lanyi-image2",
      providerCalledExternal: true,
      requestedSize: input.requestedSize,
      requestedAspectRatio: input.requestedAspectRatio,
      maxConcurrency: input.maxConcurrency,
      maxAutoRetries: input.maxAutoRetries,
      assetCount: assets.length,
      startFrameCount: startFrames.length,
      returnedCount: input.imageRecords.filter((record) => record.status === "needs_review").length,
      missingCount: input.imageRecords.filter((record) => record.status === "missing").length,
    },
    audio: {
      providerId: "local-qwen3-tts-clone",
      status: input.audio.status,
      outputPath: input.audio.outputPath ? packageRelative(input.packageRoot, input.audio.outputPath) : undefined,
      cuePath: packageRelative(input.packageRoot, input.audio.cuePath),
      providerCalledExternal: false,
    },
    jimeng: {
      providerId: "jimeng-video-cli",
      submittedCount: videoSubmittedCount,
      successCount: videoSuccessCount,
      pendingOrTimedOutCount: videoPendingCount,
      reports: input.videoReports.map((report) => ({
        shotId: report.shotId,
        status: report.status,
        submitId: report.submitId,
        outputVideoPath: packageRelative(input.packageRoot, String(report.outputVideoPath || "") || undefined),
        firstFrameProtectedVideoPath: packageRelative(input.packageRoot, String(report.firstFrameProtectedVideoPath || "") || undefined),
        reportPath: report.reportPath,
        resumeCommand: report.resumeCommand,
      })),
    },
    finalVideo: input.finalVideo,
    promotionAllowed: false,
    notes: [
      "All Image2 outputs are needs_review and are not auto-promoted.",
      "Endpoint/end frames are disabled by default for this project.",
      "Jimeng video submit is serial-finish by default: if one shot is still queued/generating/timed_out, later shots are planned but not submitted.",
      "Jimeng may return timed_out when the queue is long; submitId and resumeCommand are kept in each shot report.",
      "No raw API keys or raw reference audio paths are included in package reports.",
    ],
  };
  writeJson(reportPath, report);
  writeJson(manifestPath, {
    schemaVersion: "anime_complete_project_export_package_v1",
    runId: input.runId,
    generatedAt: input.generatedAt,
    folders: {
      project: "Project.vibe",
      assets: "assets/",
      startFrames: "start-frames/",
      audio: "audio/",
      video: "video/",
      finalVideo: "final-video/",
      receipts: "receipts/",
      report: "report/",
    },
    image2: report.image2,
    audio: report.audio,
    jimeng: report.jimeng,
    finalVideo: report.finalVideo,
    rawCredentialMaterialIncluded: false,
    rawReferenceAudioPathIncluded: false,
    promotionAllowed: false,
  });
  writeText(path.join(input.packageRoot, "report", "summary.md"), [
    "# 雨后第七封信 - Real Anime Project Smoke",
    "",
    `Run: ${input.runId}`,
    `Image2: ${report.image2.returnedCount}/${input.imageRecords.length} returned, size ${input.requestedSize}`,
    `Audio: ${input.audio.status}${input.audio.outputPath ? ` (${packageRelative(input.packageRoot, input.audio.outputPath)})` : ""}`,
    `Jimeng: ${videoSuccessCount} success, ${videoPendingCount} pending/timed out, ${videoSubmittedCount} submitted`,
    `Final video: ${String(input.finalVideo.status || "-")}`,
    "",
    "## Shots",
    "",
    ...input.shots.map((shot) => {
      const image = startFrames.find((record) => record.shotId === shot.id);
      const video = input.videoReports.find((item) => item.shotId === shot.id);
      return `- ${shot.id} ${shot.title}: start=${image?.status || "missing"}, video=${String(video?.status || "not_submitted")}, line=${shot.dialogueJa}`;
    }),
    "",
    "所有图片先进入待复核；默认不生成结束帧。",
    "",
  ].join("\n"));
}

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const runId = safeId(argValue("--run-id", `anime-complete-${generatedAt.replace(/[:.]/g, "-")}`));
const packageRoot = path.resolve(argValue("--output-root", path.join(repoRoot, "real-test-sandbox", runId)));
const live = argFlag("--live") || process.env.VIBE_REAL_ANIME_COMPLETE_LIVE === "1";
const liveConfirmed = argValue("--confirm-live", process.env.VIBE_REAL_ANIME_COMPLETE_CONFIRM || "") === "submit-anime-complete-project";
const ttsEnabled = !argFlag("--skip-tts");
const ttsConfirmed = argValue("--confirm-tts", process.env.VIBE_REAL_ANIME_TTS_CONFIRM || "") === "submit-local-qwen3-tts-clone";
const jimengEnabled = argFlag("--submit-jimeng") || process.env.VIBE_REAL_ANIME_JIMENG === "1";
const jimengConfirmed = argValue("--confirm-jimeng", process.env.VIBE_JIMENG_CLI_CONFIRM || "") === "submit-jimeng-video";
const requestedSize = argValue("--size", IMAGE2_GENERATE_DEFAULT_SIZE);
const requestedAspectRatio = argValue("--aspect-ratio", IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO);
const maxConcurrency = clampInteger(safeInteger(argValue("--max-concurrency", process.env.VIBE_MULTISHOT_IMAGE2_MAX_CONCURRENCY || "3"), 3), 1, 10);
const maxAutoRetries = clampInteger(safeInteger(argValue("--max-auto-retries", process.env.VIBE_MULTISHOT_IMAGE2_MAX_AUTO_RETRIES || "2"), 2), 0, 3);
const timeoutMs = safeInteger(argValue("--timeout-ms", process.env.VIBE_IMAGE2_PROVIDER_TIMEOUT_MS || "900000"), 900_000);
const ttsTimeoutMs = safeInteger(argValue("--tts-timeout-ms", "1800000"), 1_800_000);
const jimengShotLimitArg = argValue("--jimeng-shots", jimengEnabled ? "5" : "0");
const jimengShotLimit = jimengShotLimitArg === "all" ? 5 : clampInteger(safeInteger(jimengShotLimitArg, 0), 0, 5);
const allowJimengPendingSubmits = argFlag("--allow-jimeng-pending-submits") || process.env.VIBE_JIMENG_ALLOW_PENDING_SUBMITS === "1";
const queueWaitSeconds = safeInteger(argValue("--queue-wait-seconds", "90"), 90);
const shortPollSeconds = safeInteger(argValue("--short-poll-seconds", "20"), 20);
const pollIntervalSeconds = safeInteger(argValue("--poll-interval-seconds", "20"), 20);
const referenceAudioPath = path.resolve(argValue("--reference-audio", process.env.VIBE_QWEN3_TTS_SPEAKER_WAV || defaultQwenReferencePath(repoRoot)));

mkdirSync(packageRoot, { recursive: true });
mkdirSync(path.join(packageRoot, "report"), { recursive: true });
mkdirSync(path.join(packageRoot, "receipts"), { recursive: true });

const shots = buildShots();
const imagePlans = buildImagePlans(packageRoot, shots);

if (!live || !liveConfirmed) {
  const reportPath = path.join(packageRoot, "report", "report.json");
  writeJson(reportPath, {
    schemaVersion: "anime_complete_project_smoke_report_v1",
    runId,
    generatedAt,
    ok: false,
    status: live ? "live_submit_blocked_before_provider_call" : "mock_not_supported",
    packageRoot,
    providerCalledExternal: false,
    blockers: live
      ? ["missing --confirm-live=submit-anime-complete-project"]
      : ["this script is intended for a real complete-project smoke; pass --live and the confirmation token"],
    commandExample: "npx tsx scripts/real-anime-complete-project-smoke.mts --live --confirm-live=submit-anime-complete-project --confirm-tts=submit-local-qwen3-tts-clone --submit-jimeng --confirm-jimeng=submit-jimeng-video",
  });
  console.error(`Blocked before provider call. See ${reportPath}`);
  process.exit(1);
}

const providerStatus = getProviderConfigStatuses().find((status) => status.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2");
if (!apiKey || !providerStatus) {
  const reportPath = path.join(packageRoot, "report", "report.json");
  writeJson(reportPath, {
    schemaVersion: "anime_complete_project_smoke_report_v1",
    runId,
    generatedAt,
    ok: false,
    status: "live_submit_blocked_missing_image2_config",
    packageRoot,
    providerCalledExternal: false,
    blockers: ["Lanyi/Image2 key or provider config is missing"],
  });
  console.error(`Blocked before provider call. See ${reportPath}`);
  process.exit(1);
}

console.log(`[project] ${runId}`);
console.log(`[image2] ${imagePlans.length} outputs, concurrency ${maxConcurrency}, retry ${maxAutoRetries}, size ${requestedSize}`);
const assetPlans = imagePlans.filter((plan) => plan.kind !== "start_frame");
const startFramePlans = imagePlans.filter((plan) => plan.kind === "start_frame");
const assetRecords = await generateImages({
  plans: assetPlans,
  packageRoot,
  runId,
  apiKey,
  baseUrl: providerStatus.baseUrl,
  model: providerStatus.imageModel || process.env.VIBE_IMAGE2_MODEL || "gpt-image-2",
  requestedSize,
  requestedAspectRatio,
  timeoutMs,
  maxConcurrency,
  maxAutoRetries,
});
const startFrameRecords = await generateImages({
  plans: startFramePlans,
  referenceImagesForPlan: (plan) => referenceImagesForStartPlan({
    plan,
    shots,
    assetPlans,
    assetRecords,
  }),
  packageRoot,
  runId,
  apiKey,
  baseUrl: providerStatus.baseUrl,
  model: providerStatus.imageModel || process.env.VIBE_IMAGE2_MODEL || "gpt-image-2",
  requestedSize,
  requestedAspectRatio,
  timeoutMs,
  maxConcurrency,
  maxAutoRetries,
});
const imageRecords = [...assetRecords, ...startFrameRecords];

const audio = await generateDialogueAudio({
  packageRoot,
  runId,
  shots,
  enabled: ttsEnabled,
  confirmed: ttsConfirmed,
  referenceAudioPath,
  timeoutMs: ttsTimeoutMs,
});

const startFrameByShotId = new Map(
  imageRecords
    .filter((record) => record.kind === "start_frame" && record.outputPath)
    .map((record) => [record.shotId || record.id, record.outputPath as string]),
);
const videoReports: Record<string, unknown>[] = [];
if (jimengEnabled && jimengShotLimit > 0) {
  const jimengShots = shots.slice(0, jimengShotLimit);
  let pendingBlocker: Record<string, unknown> | undefined;
  for (const shot of jimengShots) {
    if (pendingBlocker && !allowJimengPendingSubmits) {
      videoReports.push({
        ok: true,
        status: "blocked_wait_previous_jimeng_task",
        shotId: shot.id,
        providerCalledExternal: false,
        blockedByShotId: pendingBlocker.shotId,
        previousStatus: pendingBlocker.status,
        previousSubmitId: pendingBlocker.submitId,
        message: "Jimeng is single-lane for this workflow; the next shot is not submitted until the previous task finishes.",
        prompt: shot.videoPrompt,
      });
      continue;
    }
    const imagePath = startFrameByShotId.get(shot.id);
    if (!imagePath) {
      videoReports.push({
        ok: false,
        status: "blocked_missing_start_frame",
        shotId: shot.id,
        providerCalledExternal: false,
      });
      continue;
    }
    const report = await runJimengShot({
      repoRoot,
      packageRoot,
      runId,
      shot,
      imagePath,
      live: true,
      confirmed: jimengConfirmed,
      queueWaitSeconds,
      shortPollSeconds,
      pollIntervalSeconds,
    });
    videoReports.push(report);
    const status = String(report.status || "");
    const taskStillPending = ["timed_out", "queued", "generating", "submitted"].includes(status);
    if (taskStillPending) pendingBlocker = report;
  }
} else {
  for (const shot of shots) {
    videoReports.push({
      ok: true,
      status: "planned_not_submitted",
      shotId: shot.id,
      providerCalledExternal: false,
      prompt: shot.videoPrompt,
    });
  }
}

const finalVideo = await renderFinalVideo({
  repoRoot,
  packageRoot,
  runId,
  shots,
  videoReports,
  audioPath: audio.outputPath,
});

const projectPath = writeProjectVibe({
  packageRoot,
  runId,
  generatedAt,
  shots,
  imagePlans,
  imageRecords,
  audio,
  videoReports,
  finalVideo,
});

writePackageReport({
  packageRoot,
  runId,
  generatedAt,
  shots,
  imageRecords,
  audio,
  videoReports,
  finalVideo,
  projectPath,
  requestedSize,
  requestedAspectRatio,
  maxConcurrency,
  maxAutoRetries,
});

console.log(JSON.stringify({
  ok: imageRecords.every((record) => record.status === "needs_review"),
  runId,
  packageRoot,
  imageReturned: imageRecords.filter((record) => record.status === "needs_review").length,
  imageMissing: imageRecords.filter((record) => record.status === "missing").length,
  audioStatus: audio.status,
  jimengStatuses: videoReports.map((report) => ({ shotId: report.shotId, status: report.status, submitId: report.submitId })),
  finalVideoStatus: finalVideo.status,
  reportPath: path.join(packageRoot, "report", "report.json"),
}, null, 2));
