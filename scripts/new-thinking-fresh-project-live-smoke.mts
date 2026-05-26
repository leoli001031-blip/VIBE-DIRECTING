import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  JIMENG_CLI_DEFAULT_BINARY,
  JIMENG_CLI_DEFAULT_MODEL_VERSION,
  JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
  normalizeDreaminaStatus,
  type DreaminaTaskInfo,
  type JimengVideoCliStatus,
} from "../src/core/jimengVideoCli.ts";
import {
  buildImage2StoryboardReferencePlan,
  buildSeedanceStoryboardVideoPlan,
  buildStoryboardDirectorPlan,
  type StoryboardReferenceAsset,
} from "../src/core/storyboardReferencePipeline.ts";
import { createProjectVibe, validateProjectVibe } from "../src/project/projectVibe.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
};

type AssetPlan = {
  id: string;
  kind: "character" | "scene" | "prop";
  role: StoryboardReferenceAsset["role"];
  label: string;
  outputPath: string;
  promptPath: string;
  receiptPath: string;
  usedByShotIds: string[];
  textConstraints: string[];
  prompt: string;
};

type ProviderImageRecord = {
  id: string;
  kind: "character" | "scene" | "prop" | "reference";
  label: string;
  status: "needs_review" | "missing";
  outputPath?: string;
  relativeOutputPath?: string;
  outputSha256?: string;
  promptPath: string;
  receiptPath: string;
  usedByShotIds: string[];
  textConstraints: string[];
  attemptCount: number;
  providerRequestId?: string;
  failure?: unknown;
};

type ShotPlan = {
  id: string;
  title: string;
  durationSeconds: number;
  shotSize: string;
  camera: string;
  frameDescription: string;
  actionBeats: string[];
  dialogue?: string;
  sound: string;
  sceneAssetIds: string[];
  characterAssetIds: string[];
  propAssetIds: string[];
};

function argValue(name: string, fallback = ""): string {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] || fallback;
  return fallback;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeId(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "fresh-project";
}

function safeInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .slice(0, 4000);
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

function retryableImage2Result(result: any): boolean {
  if (result?.ok) return false;
  if (result?.providerResponseMetadata?.retryable === true) return true;
  if (["timeout", "network_error", "rate_limit", "provider_missing", "server_error"].includes(result?.errorType)) return true;
  return typeof result?.statusCode === "number" && result.statusCode >= 500;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findVideoFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const output: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (/\.(mp4|mov|webm)$/i.test(entry.name) && statSync(absolute).size > 0) {
        output.push(absolute);
      }
    }
  };
  visit(dir);
  return output.sort();
}

function mergeTaskInfo(left: DreaminaTaskInfo, right: DreaminaTaskInfo): DreaminaTaskInfo {
  return {
    submitId: right.submitId || left.submitId,
    taskId: right.taskId || left.taskId,
    status: right.status !== "unknown" ? right.status : left.status,
    queueInfo: right.queueInfo || left.queueInfo,
    videoUrls: Array.from(new Set([...left.videoUrls, ...right.videoUrls])),
    localMediaPaths: Array.from(new Set([...left.localMediaPaths, ...right.localMediaPaths])),
    rawJsonCount: left.rawJsonCount + right.rawJsonCount,
    notes: [...left.notes, ...right.notes],
  };
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const runId = safeId(argValue("--run-id", `new-thinking-fresh-project-${generatedAt.replace(/[:.]/g, "-")}`));
const packageRoot = path.resolve(argValue("--output-root", path.join(repoRoot, "real-test-sandbox", runId)));
const image2Live = argFlag("--live") || process.env.VIBE_NEW_THINKING_FRESH_LIVE === "1";
const image2Confirmed = argValue("--confirm-live", process.env.VIBE_NEW_THINKING_FRESH_CONFIRM || "") === "submit-new-thinking-fresh-project";
const submitSeedance = argFlag("--submit-seedance") || process.env.VIBE_NEW_THINKING_FRESH_SEEDANCE === "1";
const seedanceConfirmed = argValue("--confirm-seedance", process.env.VIBE_NEW_THINKING_SEEDANCE_CONFIRM || "") === "submit-seedance-standard";
const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.OPENAI_API_KEY || argValue("--api-key");
const baseUrl = argValue("--base-url", process.env.VIBE_IMAGE2_BASE_URL || process.env.LANYI_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com/v1");
const imageModel = argValue("--model", process.env.VIBE_IMAGE2_MODEL || process.env.IMAGE_MODEL || providerStatus?.imageModel || "gpt-image-2");
const size = argValue("--size", "1280x720");
const quality = argValue("--quality", "standard");
const maxConcurrency = clamp(safeInteger(argValue("--max-concurrency", "3"), 3), 1, 10);
const maxRetries = clamp(safeInteger(argValue("--max-retries", "2"), 2), 0, 3);
const cliPath = argValue("--cli", process.env.VIBE_JIMENG_CLI_PATH || JIMENG_CLI_DEFAULT_BINARY);
const shortPollSeconds = safeInteger(argValue("--short-poll-seconds", "30"), 30);
const pollIntervalSeconds = safeInteger(argValue("--poll-interval-seconds", "15"), 15);
const queueWaitSeconds = safeInteger(argValue("--queue-wait-seconds", "120"), 120);
const seedanceShotId = argValue("--seedance-shot", "AO02");
const resumeSubmitId = argValue("--submit-id", process.env.VIBE_NEW_THINKING_FRESH_SEEDANCE_SUBMIT_ID || "");

mkdirSync(packageRoot, { recursive: true });
mkdirSync(path.join(packageRoot, "report"), { recursive: true });
mkdirSync(path.join(packageRoot, "receipts"), { recursive: true });

const title = "雨后纸飞机";
const logline = "放学后的雨停了，短发少女葵在天台捡到一架会发光的纸飞机，并和少年悠真确认它来自两人曾经约定过的广播社。";
const style = "clean Japanese TV anime, soft dusk after rain, delicate linework, restrained acting, no photorealism";
const shots: ShotPlan[] = [
  {
    id: "AO01",
    title: "葵在雨后天台发现发光纸飞机",
    durationSeconds: 4,
    shotSize: "中景",
    camera: "从天台门口方向轻微推进，栏杆和湿润地面形成纵深，城市灯在远处刚亮。",
    frameDescription: "葵站在画面左前景，短发和黄色发夹清楚，低头看见一架淡蓝发光纸飞机停在积水旁。",
    actionBeats: ["葵停下脚步", "她低头看向纸飞机", "纸飞机边缘微微发光"],
    dialogue: "葵：这不是昨天那架吗？",
    sound: "雨后风声，远处社团楼的广播电流声。",
    sceneAssetIds: ["asset_scene_rooftop"],
    characterAssetIds: ["asset_character_aoi"],
    propAssetIds: ["asset_prop_paper_plane"],
  },
  {
    id: "AO02",
    title: "悠真从门口入画，葵把纸飞机递给他",
    durationSeconds: 5,
    shotSize: "中远景到手部插入",
    camera: "保持 180 度轴线，葵在画面左侧，悠真从右侧天台门入画；先宽后切手部插入。",
    frameDescription: "葵从左侧把发光纸飞机递向右侧的悠真，悠真的手停顿半拍，两人的视线先看纸飞机再看彼此。",
    actionBeats: ["悠真从右侧屋顶门入画", "葵递出纸飞机", "悠真的手在接近时停顿"],
    dialogue: "悠真：原来你也听见了。",
    sound: "门轴轻响，纸飞机的微弱嗡鸣。",
    sceneAssetIds: ["asset_scene_rooftop"],
    characterAssetIds: ["asset_character_aoi", "asset_character_yuma"],
    propAssetIds: ["asset_prop_paper_plane"],
  },
  {
    id: "AO03",
    title: "纸飞机飞向广播塔，两人并肩抬头",
    durationSeconds: 6,
    shotSize: "宽中景",
    camera: "从两人背后缓慢后拉，纸飞机沿栏杆上方飞向远处旧广播塔。",
    frameDescription: "葵和悠真并肩站在画面下方，纸飞机从两人中间飞出，拖出很短的蓝光轨迹，远处广播塔灯亮起。",
    actionBeats: ["纸飞机从两人中间飞出", "两人同时抬头", "远处旧广播塔灯亮起"],
    dialogue: "葵：那就明天，重新开始吧。",
    sound: "风声变轻，远处广播台启动的低频声。",
    sceneAssetIds: ["asset_scene_rooftop"],
    characterAssetIds: ["asset_character_aoi", "asset_character_yuma"],
    propAssetIds: ["asset_prop_paper_plane"],
  },
];

const assetPlans: AssetPlan[] = [
  {
    id: "asset_character_aoi",
    kind: "character",
    role: "character_identity",
    label: "葵角色参考",
    outputPath: path.join(packageRoot, "assets", "characters", "aoi-main-character.png"),
    promptPath: path.join(packageRoot, "receipts", "prompts", "asset-aoi-main-character.md"),
    receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "aoi-main-character.json"),
    usedByShotIds: ["AO01", "AO02", "AO03"],
    textConstraints: ["短发少女", "黄色发夹", "深蓝校服", "克制但好奇"],
    prompt: [
      style,
      "16:9 original Japanese anime character reference sheet, neutral light gray background, no text.",
      "Aoi, 16-year-old high school girl, short black bob hair, small yellow hairpin, navy school blazer, white shirt, warm yellow ribbon, slim school bag.",
      "Show a clean front three-quarter pose and a smaller side pose in the same frame, consistent face and proportions, expressive but restrained.",
    ].join(" "),
  },
  {
    id: "asset_character_yuma",
    kind: "character",
    role: "character_identity",
    label: "悠真角色参考",
    outputPath: path.join(packageRoot, "assets", "characters", "yuma-supporting-character.png"),
    promptPath: path.join(packageRoot, "receipts", "prompts", "asset-yuma-supporting-character.md"),
    receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "yuma-supporting-character.json"),
    usedByShotIds: ["AO02", "AO03"],
    textConstraints: ["少年", "灰色针织背心", "广播社耳机", "温和迟疑"],
    prompt: [
      style,
      "16:9 original Japanese anime character reference sheet, neutral light gray background, no text.",
      "Yuma, 16-year-old high school boy, soft black hair, white shirt, gray knit vest, black headphones around his neck, gentle hesitant expression.",
      "Show one front three-quarter pose and one smaller side pose in the same frame, consistent face and proportions.",
    ].join(" "),
  },
  {
    id: "asset_scene_rooftop",
    kind: "scene",
    role: "scene_baseline",
    label: "雨后学校天台场景参考",
    outputPath: path.join(packageRoot, "assets", "scenes", "after-rain-rooftop-broadcast-tower.png"),
    promptPath: path.join(packageRoot, "receipts", "prompts", "asset-scene-rooftop.md"),
    receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "after-rain-rooftop-broadcast-tower.json"),
    usedByShotIds: ["AO01", "AO02", "AO03"],
    textConstraints: ["雨后学校天台", "黄昏", "湿地面反光", "远处旧广播塔", "天台门"],
    prompt: [
      style,
      "16:9 scene reference for an original Japanese anime short film, no characters, no text.",
      "After-rain high school rooftop at dusk, wet floor reflections, rooftop door on the right, railings, distant low city skyline, an old broadcast tower visible beyond the railings, soft blue-orange sky.",
      "Clear spatial layout for wide shots, medium shots, and a character entering from the rooftop door.",
    ].join(" "),
  },
  {
    id: "asset_prop_paper_plane",
    kind: "prop",
    role: "prop_reference",
    label: "发光纸飞机道具参考",
    outputPath: path.join(packageRoot, "assets", "props", "glowing-paper-plane.png"),
    promptPath: path.join(packageRoot, "receipts", "prompts", "asset-prop-paper-plane.md"),
    receiptPath: path.join(packageRoot, "receipts", "image2", "assets", "glowing-paper-plane.json"),
    usedByShotIds: ["AO01", "AO02", "AO03"],
    textConstraints: ["折纸飞机", "淡蓝发光边缘", "小巧", "没有文字"],
    prompt: [
      style,
      "16:9 prop reference for an original Japanese anime short film, no text, no logo.",
      "A small folded paper airplane with faint pale-blue glowing edges, lying on a wet school rooftop floor with tiny water reflections.",
      "Simple iconic shape, readable in hand close-ups and wide shots.",
    ].join(" "),
  },
];

if (!image2Live || !image2Confirmed || (image2Live && !apiKey)) {
  const report = {
    ok: false,
    status: !image2Live ? "mock_ready" : !apiKey ? "blocked_missing_image2_api_key" : "blocked_missing_live_confirmation",
    packageRoot,
    providerCalledExternal: false,
    blockers: [
      image2Live && !apiKey ? "LANYI_API_KEY or OPENAI_API_KEY is required" : "",
      image2Live && !image2Confirmed ? "missing --confirm-live=submit-new-thinking-fresh-project" : "",
    ].filter(Boolean),
    commandExample: "npx tsx scripts/new-thinking-fresh-project-live-smoke.mts --live --confirm-live=submit-new-thinking-fresh-project --submit-seedance --confirm-seedance=submit-seedance-standard",
  };
  writeJson(path.join(packageRoot, "report", "report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "mock_ready" ? 0 : 1);
}

async function generateAsset(plan: AssetPlan): Promise<ProviderImageRecord> {
  if (existsSync(plan.outputPath) && statSync(plan.outputPath).size > 0) {
    const bytes = readFileSync(plan.outputPath);
    console.log(`[image2:asset] ${plan.id}: needs_review (reused)`);
    return {
      id: plan.id,
      kind: plan.kind,
      label: plan.label,
      status: "needs_review",
      outputPath: plan.outputPath,
      relativeOutputPath: packageRelative(packageRoot, plan.outputPath),
      outputSha256: sha256(bytes),
      promptPath: packageRelative(packageRoot, plan.promptPath),
      receiptPath: packageRelative(packageRoot, plan.receiptPath),
      usedByShotIds: plan.usedByShotIds,
      textConstraints: plan.textConstraints,
      attemptCount: 0,
    };
  }
  writeText(plan.promptPath, `${plan.prompt}\n`);
  let result: any;
  let rawSsePath = "";
  const attempts: Array<Record<string, unknown>> = [];
  for (let attemptNumber = 1; attemptNumber <= maxRetries + 1; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey,
      baseUrl,
      model: imageModel,
      prompt: plan.prompt,
      size,
      quality,
      timeoutMs: 8 * 60 * 1000,
      providerOperation: "responses.image_generation.new_thinking_fresh_asset",
    });
    if (result.rawSseBytes) {
      rawSsePath = path.join(packageRoot, "receipts", "image2", "assets", `${plan.id}.attempt-${attemptNumber}.sse.txt`);
      writeText(rawSsePath, result.rawSseBytes);
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
    if (result.ok || !retryableImage2Result(result) || attemptNumber === maxRetries + 1) break;
    await sleep(5_000 * attemptNumber);
  }

  if (result.ok) writeText(plan.outputPath, result.bytes);
  const record: ProviderImageRecord = {
    id: plan.id,
    kind: plan.kind,
    label: plan.label,
    status: result.ok ? "needs_review" : "missing",
    outputPath: result.ok ? plan.outputPath : undefined,
    relativeOutputPath: result.ok ? packageRelative(packageRoot, plan.outputPath) : undefined,
    outputSha256: result.ok ? sha256(result.bytes) : undefined,
    promptPath: packageRelative(packageRoot, plan.promptPath),
    receiptPath: packageRelative(packageRoot, plan.receiptPath),
    usedByShotIds: plan.usedByShotIds,
    textConstraints: plan.textConstraints,
    attemptCount: attempts.length,
    providerRequestId: result.providerRequestId,
    failure: result.ok ? undefined : {
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      message: redact(result.message || ""),
      diagnostic: result.diagnostic,
    },
  };
  writeJson(plan.receiptPath, {
    schemaVersion: "new_thinking_fresh_project_asset_receipt_v1",
    id: plan.id,
    kind: plan.kind,
    role: plan.role,
    status: record.status,
    providerId: "lanyi-image2-responses-stream",
    providerCalledExternal: true,
    model: imageModel,
    size,
    quality,
    outputPath: record.relativeOutputPath,
    outputSha256: record.outputSha256,
    promptPath: record.promptPath,
    rawSsePath: rawSsePath ? packageRelative(packageRoot, rawSsePath) : undefined,
    rawApiKeyStored: false,
    attempts,
    providerRequestId: result.providerRequestId,
    humanReviewRequired: true,
    providerSelfReportCanPromote: false,
    failure: record.failure,
  });
  console.log(`[image2:asset] ${plan.id}: ${record.status}`);
  return record;
}

const assetRecords = await runWithConcurrency(assetPlans, maxConcurrency, generateAsset);
const assetPlanById = new Map(assetPlans.map((plan) => [plan.id, plan]));
const assetRecordById = new Map(assetRecords.map((record) => [record.id, record]));

function storyboardAssetFrom(assetId: string): StoryboardReferenceAsset | undefined {
  const plan = assetPlanById.get(assetId);
  const record = assetRecordById.get(assetId);
  if (!plan || !record?.outputPath) return undefined;
  return {
    id: plan.id,
    role: plan.role,
    path: record.outputPath,
    label: plan.label,
    notes: plan.textConstraints,
  };
}

async function generateStoryboard(shot: ShotPlan): Promise<ProviderImageRecord> {
  const outputPath = path.join(packageRoot, "storyboards", `${shot.id}-storyboard-reference.png`);
  const promptPath = path.join(packageRoot, "receipts", "prompts", `${shot.id}-storyboard-reference.md`);
  const receiptPath = path.join(packageRoot, "receipts", "image2", "storyboards", `${shot.id}.json`);
  if (existsSync(outputPath) && statSync(outputPath).size > 0) {
    const bytes = readFileSync(outputPath);
    console.log(`[image2:storyboard] ${shot.id}: needs_review (reused)`);
    return {
      id: `asset_storyboard_${shot.id}`,
      kind: "reference",
      label: `${shot.id} 分镜参考图`,
      status: "needs_review",
      outputPath,
      relativeOutputPath: packageRelative(packageRoot, outputPath),
      outputSha256: sha256(bytes),
      promptPath: packageRelative(packageRoot, promptPath),
      receiptPath: packageRelative(packageRoot, receiptPath),
      usedByShotIds: [shot.id],
      textConstraints: ["黑白导演分镜参考", "主画面锁构图", "动作支持格解释节奏", "Seedance 全能参考输入"],
      attemptCount: 0,
    };
  }
  const sceneBaseline = storyboardAssetFrom(shot.sceneAssetIds[0]);
  const characterReferences = shot.characterAssetIds
    .map(storyboardAssetFrom)
    .filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const propReferences = shot.propAssetIds
    .map(storyboardAssetFrom)
    .filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const directorPlan = buildStoryboardDirectorPlan({
    shotId: shot.id,
    shotTitle: shot.title,
    durationSeconds: shot.durationSeconds,
    camera: shot.camera,
    frameDescription: shot.frameDescription,
    actionBeats: shot.actionBeats,
    primaryAction: shot.actionBeats[0] || shot.frameDescription,
    microReaction: shot.actionBeats.find((beat) => /看|停|抬头|低头|反应|视线/.test(beat)),
  });
  const plan = buildImage2StoryboardReferencePlan({
    shotId: shot.id,
    shotTitle: shot.title,
    directorPlan,
    camera: shot.camera,
    shotDescription: [
      shot.frameDescription,
      `Start-frame anchor: ${directorPlan.mainComposition.startFrameAnchor}`,
      `Primary action after start frame: ${directorPlan.primaryAction}`,
      directorPlan.microReaction ? `Micro-reaction: ${directorPlan.microReaction}` : "",
      "Make the storyboard read like a real anime storyboard page: the large main panel is the start-frame anchor before motion begins; sparse small continuity panels show the next action beats.",
    ].join("\n"),
    dialogue: shot.dialogue,
    durationSeconds: shot.durationSeconds,
    outputSize: size,
    sceneBaseline,
    characterReferences,
    propReferences,
    characterGuidance: [
      "Keep generated character identities from the reference sheets; do not change hairstyle, age impression, outfit silhouette, or face type.",
      "For two-person shots, keep screen-left/screen-right relationship stable and make eye-lines explicit.",
    ],
    propGuidance: ["The glowing paper airplane is the key action prop; make hand placement and direction of travel readable."],
  });
  writeText(promptPath, `${plan.prompt}\n`);
  const references = plan.references.map((reference) => {
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
  for (let attemptNumber = 1; attemptNumber <= maxRetries + 1; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey,
      baseUrl,
      model: imageModel,
      prompt: plan.prompt,
      size,
      quality,
      timeoutMs: 8 * 60 * 1000,
      providerOperation: "responses.image_generation.new_thinking_fresh_storyboard",
      referenceImages: references,
    });
    if (result.rawSseBytes) {
      rawSsePath = path.join(packageRoot, "receipts", "image2", "storyboards", `${shot.id}.attempt-${attemptNumber}.sse.txt`);
      writeText(rawSsePath, result.rawSseBytes);
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
    if (result.ok || !retryableImage2Result(result) || attemptNumber === maxRetries + 1) break;
    await sleep(5_000 * attemptNumber);
  }

  if (result.ok) writeText(outputPath, result.bytes);
  const record: ProviderImageRecord = {
    id: `asset_storyboard_${shot.id}`,
    kind: "reference",
    label: `${shot.id} 分镜参考图`,
    status: result.ok ? "needs_review" : "missing",
    outputPath: result.ok ? outputPath : undefined,
    relativeOutputPath: result.ok ? packageRelative(packageRoot, outputPath) : undefined,
    outputSha256: result.ok ? sha256(result.bytes) : undefined,
    promptPath: packageRelative(packageRoot, promptPath),
    receiptPath: packageRelative(packageRoot, receiptPath),
    usedByShotIds: [shot.id],
    textConstraints: ["黑白导演分镜参考", "主画面锁构图", "动作支持格解释节奏", "Seedance 全能参考输入"],
    attemptCount: attempts.length,
    providerRequestId: result.providerRequestId,
    failure: result.ok ? undefined : {
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      message: redact(result.message || ""),
      diagnostic: result.diagnostic,
    },
  };
  writeJson(receiptPath, {
    schemaVersion: "new_thinking_fresh_project_storyboard_receipt_v1",
    shotId: shot.id,
    status: record.status,
    providerId: "lanyi-image2-responses-stream",
    providerCalledExternal: true,
    model: imageModel,
    size,
    quality,
    outputPath: record.relativeOutputPath,
    outputSha256: record.outputSha256,
    promptPath: record.promptPath,
    rawSsePath: rawSsePath ? packageRelative(packageRoot, rawSsePath) : undefined,
    rawApiKeyStored: false,
    references: references.map((reference) => ({
      role: reference.role,
      path: packageRelative(packageRoot, reference.path),
      sha256: reference.sha256,
    })),
    attempts,
    providerRequestId: result.providerRequestId,
    humanReviewRequired: true,
    providerSelfReportCanPromote: false,
    failure: record.failure,
  });
  console.log(`[image2:storyboard] ${shot.id}: ${record.status}`);
  return record;
}

const storyboardRecords = await runWithConcurrency(shots, maxConcurrency, generateStoryboard);

async function submitSeedanceShot(): Promise<Record<string, unknown> | undefined> {
  if (!submitSeedance) return undefined;
  if (!seedanceConfirmed) {
    return {
      ok: false,
      status: "blocked_missing_seedance_confirmation",
      providerCalledExternal: false,
      blocker: "missing --confirm-seedance=submit-seedance-standard",
    };
  }
  const shot = shots.find((item) => item.id === seedanceShotId) || shots[0];
  const storyboardRecord = storyboardRecords.find((record) => record.id === `asset_storyboard_${shot.id}`);
  if (!storyboardRecord?.outputPath) {
    return {
      ok: false,
      status: "blocked_missing_storyboard",
      providerCalledExternal: false,
      shotId: shot.id,
    };
  }
  const sceneBaseline = storyboardAssetFrom(shot.sceneAssetIds[0]);
  const characterReferences = shot.characterAssetIds
    .map(storyboardAssetFrom)
    .filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const propReferences = shot.propAssetIds
    .map(storyboardAssetFrom)
    .filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const outputDir = path.join(packageRoot, "video", shot.id);
  const directorPlan = buildStoryboardDirectorPlan({
    shotId: shot.id,
    shotTitle: shot.title,
    durationSeconds: shot.durationSeconds,
    camera: shot.camera,
    frameDescription: shot.frameDescription,
    actionBeats: shot.actionBeats,
    primaryAction: shot.actionBeats[0] || shot.frameDescription,
    microReaction: shot.actionBeats.find((beat) => /看|停|抬头|低头|反应|视线/.test(beat)),
  });
  const plan = buildSeedanceStoryboardVideoPlan({
    shotId: shot.id,
    storyboardReference: {
      id: `storyboard_${shot.id}`,
      role: "storyboard_reference",
      path: storyboardRecord.outputPath,
      label: `${shot.id} storyboard reference`,
    },
    sceneBaseline,
    characterReferences,
    propReferences,
    outputDir,
    prompt: [
      `Project: ${title}.`,
      `Shot ${shot.id}: ${shot.title}.`,
      shot.frameDescription,
      `Start frame anchor: ${directorPlan.mainComposition.startFrameAnchor}.`,
      `Primary action after start frame: ${shot.actionBeats[0] || shot.frameDescription}.`,
      `Camera: ${shot.camera}`,
      "Use storyboard for composition, camera, blocking, eyelines, and motion only.",
      "Use character references for identity and scene reference for weather/location. If references conflict, character identity wins.",
      "Final output must be clean Japanese TV anime, not manga page, not photorealistic.",
      "No BGM, no music, no subtitles, no on-screen text, no watermark.",
    ].join(" "),
    durationSeconds: shot.durationSeconds,
    ratio: "16:9",
    modelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
    videoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    shortPollSeconds,
    cliPath,
    directorPlan,
  });
  const receiptDir = path.join(packageRoot, "receipts", "jimeng", shot.id);
  const submitLogPath = path.join(receiptDir, "dreamina-multimodal-submit.json");
  const queryLogPath = path.join(receiptDir, "dreamina-query-attempts.jsonl");
  const planPath = path.join(receiptDir, "seedance-submit-plan.json");
  writeJson(planPath, {
    ...plan,
    noVip: true,
    liveSubmitRequires: "--submit-seedance --confirm-seedance=submit-seedance-standard",
  });
  writeText(path.join(receiptDir, "prompt.md"), `${plan.prompt}\n`);

  const startedAt = Date.now();
  let taskInfo: DreaminaTaskInfo;
  if (resumeSubmitId) {
    taskInfo = {
      submitId: resumeSubmitId,
      status: "submitted",
      videoUrls: [],
      localMediaPaths: [],
      rawJsonCount: 0,
      notes: ["Resumed from an existing Dreamina/Jimeng submit_id without resubmitting."],
    };
    writeJson(submitLogPath, {
      resumed: true,
      submitId: resumeSubmitId,
      providerCalledExternal: false,
    });
  } else {
    const submit = await runCommand(plan.cliPath, plan.args, {
      cwd: repoRoot,
      timeoutMs: Math.max(60, shortPollSeconds + 45) * 1000,
    });
    writeJson(submitLogPath, {
      command: plan.cliPath,
      args: plan.args,
      exitCode: submit.exitCode,
      timedOut: submit.timedOut,
      durationMs: submit.durationMs,
      stdout: redact(submit.stdout),
      stderr: redact(submit.stderr),
    });
    taskInfo = extractDreaminaTaskInfo(submit.stdout, submit.stderr);
    if (submit.exitCode !== 0 && !taskInfo.submitId) {
      return {
        ok: false,
        status: "submit_failed",
        providerCalledExternal: true,
        shotId: shot.id,
        modelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
        videoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
        noVip: true,
        planPath: packageRelative(packageRoot, planPath),
        submitLogPath: packageRelative(packageRoot, submitLogPath),
        error: redact(submit.stderr || submit.stdout),
      };
    }
  }

  let status: JimengVideoCliStatus = normalizeDreaminaStatus(taskInfo.status);
  let queryAttempts = 0;
  let finalVideoFiles = findVideoFiles(outputDir);
  const deadline = startedAt + queueWaitSeconds * 1000;
  while (taskInfo.submitId && Date.now() < deadline) {
    queryAttempts += 1;
    const query = await runCommand(plan.cliPath, [
      "query_result",
      `--submit_id=${taskInfo.submitId}`,
      `--download_dir=${outputDir}`,
    ], {
      cwd: repoRoot,
      timeoutMs: 120_000,
    });
    const queriedInfo = extractDreaminaTaskInfo(query.stdout, query.stderr);
    taskInfo = mergeTaskInfo(taskInfo, queriedInfo);
    finalVideoFiles = findVideoFiles(outputDir);
    status = finalVideoFiles.length > 0 ? "success" : normalizeDreaminaStatus(taskInfo.status);
    writeText(queryLogPath, `${JSON.stringify({
      attempt: queryAttempts,
      at: new Date().toISOString(),
      exitCode: query.exitCode,
      durationMs: query.durationMs,
      status,
      submitId: taskInfo.submitId,
      videoFiles: finalVideoFiles.map((file) => packageRelative(packageRoot, file)),
      stdout: redact(query.stdout),
      stderr: redact(query.stderr),
    })}\n`);
    if (status === "success" || status === "failed") break;
    await sleep(pollIntervalSeconds * 1000);
  }

  const recoverable = Boolean(taskInfo.submitId && status !== "success" && status !== "failed");
  const resumeCommand = taskInfo.submitId
    ? jimengResumeCommand({ submitId: taskInfo.submitId, downloadDir: outputDir, cliPath: plan.cliPath })
    : undefined;
  return {
    ok: status === "success" || recoverable,
    status: status === "success" ? "success" : recoverable ? "recoverable_queued" : status,
    providerCalledExternal: true,
    shotId: shot.id,
    modelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
    videoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    noVip: true,
    durationSeconds: plan.durationSeconds,
    submitId: taskInfo.submitId,
    queryAttempts,
    queueWaitSeconds,
    resumeCommand,
    outputVideoPaths: finalVideoFiles,
    relativeOutputVideoPaths: finalVideoFiles.map((file) => packageRelative(packageRoot, file)),
    planPath: packageRelative(packageRoot, planPath),
    submitLogPath: packageRelative(packageRoot, submitLogPath),
    queryLogPath: existsSync(queryLogPath) ? packageRelative(packageRoot, queryLogPath) : undefined,
    durationMs: Date.now() - startedAt,
    taskInfo,
  };
}

const seedanceResult = await submitSeedanceShot();
const now = new Date().toISOString();
const allRecords = [...assetRecords, ...storyboardRecords];
const projectAssets = allRecords.map((record) => ({
  id: record.id,
  kind: record.kind,
  label: record.label,
  status: record.status,
  path: record.relativeOutputPath,
  textConstraints: record.textConstraints,
  usedByShotIds: record.usedByShotIds,
  sourceRefs: [`receipt:${record.receiptPath}`, `prompt:${record.promptPath}`],
}));
const project = createProjectVibe({
  projectId: runId,
  title,
  createdAt: now,
  updatedAt: now,
  storyFlow: {
    id: "story_flow_current",
    shotOrder: shots.map((shot) => shot.id),
    sections: [{
      id: "main_sequence",
      title,
      summary: logline,
      sequenceIndex: 1,
      shotIds: shots.map((shot) => shot.id),
    }],
  },
  visualMemory: {
    id: "visual_memory_current",
    entries: projectAssets.map((asset) => ({
      id: `vm_${asset.id}`,
      assetId: asset.id,
      kind: asset.kind,
      label: asset.label,
      status: asset.status,
      textConstraints: asset.textConstraints,
      usedByShotIds: asset.usedByShotIds,
      canUseAsFutureReference: false,
      sourceRefs: asset.sourceRefs,
    })),
  },
  shots: shots.map((shot) => ({
    id: shot.id,
    sectionId: "main_sequence",
    title: shot.title,
    intent: shot.frameDescription,
    videoControlMode: "reference_driven",
    sceneAssetIds: shot.sceneAssetIds,
    characterAssetIds: shot.characterAssetIds,
    propAssetIds: shot.propAssetIds,
    durationSeconds: shot.durationSeconds,
    status: storyboardRecords.find((record) => record.id === `asset_storyboard_${shot.id}`)?.status === "needs_review" ? "ready" : "blocked",
    sourceRefs: [`script:${shot.id}`],
  })),
  assets: projectAssets,
  runs: [{
    id: "run_fresh_project_image2",
    runKind: "provider",
    status: allRecords.every((record) => record.status === "needs_review") ? "succeeded" : "failed",
    createdAt: now,
    summary: "Fresh project smoke generated new assets and storyboard references through Image2, then optionally submitted one Seedance standard 720p clip.",
    sourceFactHash: sha256(JSON.stringify({ title, logline, shots })),
    affectedShotIds: shots.map((shot) => shot.id),
    producedAssetIds: projectAssets.map((asset) => asset.id),
    evidenceRefs: allRecords.flatMap((record) => [`receipt:${record.receiptPath}`, `prompt:${record.promptPath}`]),
    projectFactsMutated: false,
    runtimeFixtureUsed: false,
  }],
  receipts: {
    scriptPlanningReceipts: [{
      id: "script_plan_fresh_project",
      kind: "script_planning",
      createdAt: now,
      plannerId: "new-thinking-fresh-project-live-smoke",
      sourceFactHash: sha256(JSON.stringify({ title, logline, shots })),
      sectionIds: ["main_sequence"],
      shotIds: shots.map((shot) => shot.id),
      blockerCount: 0,
      evidenceRefs: ["report:report/fresh-project-plan.json"],
      providerSelfReportUsed: false,
      runtimeFixtureUsed: false,
    }],
    promptKeyframePlanningReceipts: [],
    batchReceipts: [{
      id: "batch_fresh_project_image2",
      createdAt: now,
      batchId: runId,
      status: allRecords.every((record) => record.status === "needs_review") ? "succeeded" : allRecords.some((record) => record.status === "needs_review") ? "partial" : "failed",
      sourceFactHash: sha256(JSON.stringify({ title, logline, shots })),
      providerId: "lanyi-image2-responses-stream",
      taskEnvelopeIds: allRecords.map((record) => `task_${record.id}`),
      affectedShotIds: shots.map((shot) => shot.id),
      attemptIds: allRecords.map((record) => `attempt_${record.id}`),
      returnedOutputCount: allRecords.filter((record) => record.status === "needs_review").length,
      missingOutputCount: allRecords.filter((record) => record.status === "missing").length,
      outputHashes: allRecords.map((record) => record.outputSha256 || "").filter(Boolean),
      evidenceRefs: allRecords.flatMap((record) => [`receipt:${record.receiptPath}`, `prompt:${record.promptPath}`]),
      providerSelfReportCanPromote: false,
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    }],
    reviewReceipts: allRecords.map((record) => ({
      id: `review_${record.id}`,
      createdAt: now,
      status: record.status,
      humanReviewed: false,
      shotId: record.usedByShotIds[0],
      assetId: record.id,
      sourceRunId: "run_fresh_project_image2",
      outputPath: record.relativeOutputPath,
      outputHash: record.outputSha256,
      retryRequested: false,
      lateOutput: false,
      providerSelfReportIgnored: true,
      promotionAuthorized: false,
      evidenceRefs: [`receipt:${record.receiptPath}`, `prompt:${record.promptPath}`],
      blockers: record.status === "missing" ? ["真实返回缺失，不能推广为正式资产。"] : [],
    })),
  },
});
const validation = validateProjectVibe(project);
writeJson(path.join(packageRoot, "Project.vibe"), project);
writeJson(path.join(packageRoot, "report", "fresh-project-plan.json"), { title, logline, style, shots });
const report = {
  schemaVersion: "new_thinking_fresh_project_live_smoke_report_v1",
  ok: validation.ok && allRecords.every((record) => record.status === "needs_review") && (!submitSeedance || seedanceResult?.ok === true),
  runId,
  title,
  logline,
  packageRoot,
  projectVibePath: path.join(packageRoot, "Project.vibe"),
  image2: {
    providerCalledExternal: true,
    model: imageModel,
    size,
    quality,
    maxConcurrency,
    maxRetries,
    assetSuccessCount: assetRecords.filter((record) => record.status === "needs_review").length,
    storyboardSuccessCount: storyboardRecords.filter((record) => record.status === "needs_review").length,
    missingCount: allRecords.filter((record) => record.status === "missing").length,
  },
  seedance: seedanceResult || {
    status: "not_requested",
    providerCalledExternal: false,
    modelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
    videoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    noVip: true,
  },
  projectValidation: validation,
  assets: assetRecords,
  storyboards: storyboardRecords,
};
writeJson(path.join(packageRoot, "report", "report.json"), report);
writeText(path.join(packageRoot, "report", "summary.md"), [
  `# ${title}`,
  "",
  logline,
  "",
  `- Image2 assets: ${report.image2.assetSuccessCount}/${assetRecords.length}`,
  `- Image2 storyboards: ${report.image2.storyboardSuccessCount}/${storyboardRecords.length}`,
  `- Project.vibe: ${validation.ok ? "ok" : validation.errors.join("; ")}`,
  `- Seedance: ${String((report.seedance as any).status || "not_requested")}`,
  `- Seedance lane: ${JIMENG_CLI_DEFAULT_MODEL_VERSION} / ${JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION} / no VIP`,
  "",
  "## Storyboards",
  ...storyboardRecords.map((record) => `- ${record.id}: ${record.relativeOutputPath || "missing"}`),
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: report.ok,
  runId,
  packageRoot,
  projectVibePath: report.projectVibePath,
  reportPath: path.join(packageRoot, "report", "report.json"),
  image2: report.image2,
  seedance: report.seedance,
}, null, 2));
process.exit(report.ok ? 0 : 2);
