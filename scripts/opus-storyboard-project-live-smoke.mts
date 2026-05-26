import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { buildScriptStoryboardPromptPack, type ScriptStoryboardShotInput } from "../src/core/scriptStoryboardPromptPack.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";
import { createProjectVibe, validateProjectVibe } from "../src/project/projectVibe.ts";

type PlannedAssetKind = "character" | "scene" | "prop";

type PlannedAsset = {
  id: string;
  kind: PlannedAssetKind;
  label: string;
  prompt: string;
  textConstraints?: string[];
  usedByShotIds?: string[];
};

type PlannedShot = {
  id: string;
  title: string;
  durationSeconds: number;
  executionMode?: ScriptStoryboardShotInput["executionMode"];
  shotSize: string;
  camera: string;
  frameDescription: string;
  primaryAction: string;
  actionTrigger?: string;
  microReaction?: string;
  actorAction?: string;
  reactorResponse?: string;
  actionBeats: string[];
  dialogue?: string;
  sound?: string;
  animeShotGrammar?: string[];
  rhythmProfile?: ScriptStoryboardShotInput["rhythmProfile"];
  rhythmReason?: string;
  actionDensity?: ScriptStoryboardShotInput["actionDensity"];
  splitPolicy?: ScriptStoryboardShotInput["splitPolicy"];
  sceneAssetIds: string[];
  characterAssetIds: string[];
  propAssetIds: string[];
};

type OpusProjectPlan = {
  title: string;
  logline: string;
  style: string;
  assets: PlannedAsset[];
  shots: PlannedShot[];
};

type ImageRecord = {
  id: string;
  kind: PlannedAssetKind | "storyboard";
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
  failure?: unknown;
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
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "opus-storyboard-project";
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

function packageRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function roleForKind(kind: PlannedAssetKind): StoryboardReferenceAsset["role"] {
  if (kind === "scene") return "scene_baseline";
  if (kind === "prop") return "prop_reference";
  return "character_identity";
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

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude Opus did not return a JSON object.");
  return JSON.parse(source.slice(start, end + 1));
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

const executionModes: NonNullable<ScriptStoryboardShotInput["executionMode"]>[] = [
  "single_continuous_shot",
  "relationship_wide",
  "action_insert",
  "reaction_closeup",
  "planned_cut_sequence",
];

const rhythmProfiles: NonNullable<ScriptStoryboardShotInput["rhythmProfile"]>[] = [
  "quiet_dialogue",
  "anime_emotion",
  "action_fast_cut",
  "comedy_reaction",
  "suspense_pressure",
  "commercial_short",
  "emotion_montage",
  "lyrical_observation",
];

const actionDensities: NonNullable<ScriptStoryboardShotInput["actionDensity"]>[] = ["low", "medium", "high"];
const splitPolicies: NonNullable<ScriptStoryboardShotInput["splitPolicy"]>[] = [
  "hold_single_shot",
  "split_for_reaction",
  "split_for_action",
  "montage_sequence",
];

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  const normalized = String(value || "").trim();
  return options.find((option) => option === normalized);
}

function normalizePlan(raw: unknown): OpusProjectPlan {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const assetsRaw = Array.isArray(record.assets) ? record.assets : [];
  const shotsRaw = Array.isArray(record.shots) ? record.shots : [];
  const assets = assetsRaw.map((item, index): PlannedAsset => {
    const asset = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const kind = asset.kind === "scene" || asset.kind === "prop" || asset.kind === "character"
      ? asset.kind
      : index === 0 ? "scene" : index === 1 ? "character" : "prop";
    return {
      id: safeId(String(asset.id || `${kind}_${index + 1}`)),
      kind,
      label: String(asset.label || asset.id || `${kind}_${index + 1}`),
      prompt: String(asset.prompt || ""),
      textConstraints: textArray(asset.textConstraints),
      usedByShotIds: textArray(asset.usedByShotIds),
    };
  }).filter((asset) => asset.prompt.trim());
  const assetIds = new Set(assets.map((asset) => asset.id));
  const sceneIds = assets.filter((asset) => asset.kind === "scene").map((asset) => asset.id);
  const characterIds = assets.filter((asset) => asset.kind === "character").map((asset) => asset.id);
  const propIds = assets.filter((asset) => asset.kind === "prop").map((asset) => asset.id);
  const shots = shotsRaw.map((item, index): PlannedShot => {
    const shot = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const id = safeId(String(shot.id || `OS${String(index + 1).padStart(2, "0")}`));
    return {
      id,
      title: String(shot.title || id),
      durationSeconds: clamp(Number(shot.durationSeconds || 5), 4, 15),
      executionMode: oneOf(shot.executionMode, executionModes),
      shotSize: String(shot.shotSize || "中景"),
      camera: String(shot.camera || "平视中景，轻微推进。"),
      frameDescription: String(shot.frameDescription || shot.primaryAction || "角色在场景中完成一个清晰动作。"),
      primaryAction: String(shot.primaryAction || shot.frameDescription || "角色完成一个清晰动作。"),
      actionTrigger: typeof shot.actionTrigger === "string" ? shot.actionTrigger : undefined,
      microReaction: typeof shot.microReaction === "string" ? shot.microReaction : undefined,
      actorAction: typeof shot.actorAction === "string" ? shot.actorAction : undefined,
      reactorResponse: typeof shot.reactorResponse === "string" ? shot.reactorResponse : undefined,
      actionBeats: textArray(shot.actionBeats).slice(0, 4),
      dialogue: typeof shot.dialogue === "string" ? shot.dialogue : undefined,
      sound: typeof shot.sound === "string" ? shot.sound : undefined,
      animeShotGrammar: textArray(shot.animeShotGrammar).slice(0, 5),
      rhythmProfile: oneOf(shot.rhythmProfile, rhythmProfiles),
      rhythmReason: typeof shot.rhythmReason === "string" ? shot.rhythmReason : undefined,
      actionDensity: oneOf(shot.actionDensity, actionDensities),
      splitPolicy: oneOf(shot.splitPolicy, splitPolicies),
      sceneAssetIds: textArray(shot.sceneAssetIds).filter((assetId) => assetIds.has(assetId)).slice(0, 1).concat(sceneIds.slice(0, 1)).slice(0, 1),
      characterAssetIds: textArray(shot.characterAssetIds).filter((assetId) => assetIds.has(assetId)).concat(characterIds).filter((value, at, all) => all.indexOf(value) === at).slice(0, 2),
      propAssetIds: textArray(shot.propAssetIds).filter((assetId) => assetIds.has(assetId)).concat(propIds).filter((value, at, all) => all.indexOf(value) === at).slice(0, 2),
    };
  }).slice(0, 4);
  if (!assets.length) throw new Error("Claude Opus plan did not include image assets.");
  if (!shots.length) throw new Error("Claude Opus plan did not include shots.");
  return {
    title: String(record.title || "Opus 分镜小项目"),
    logline: String(record.logline || "一个用于测试导演分镜逻辑的小项目。"),
    style: String(record.style || "clean Japanese TV anime, simple cinematic composition, no photorealism"),
    assets,
    shots,
  };
}

function plannerPrompt(topic: string): string {
  return [
    "你是 Vibe Director 的导演分镜规划器。请输出严格 JSON，不要 Markdown 解释。",
    "目标：为一个小型日漫风短片创建可用于 Image2 出资产图和分镜图的项目计划。",
    "关键规则：",
    "- 先规划角色/场景/道具基准资产，再让软件内部 director skill 自动决定每个镜头走：clean state reference、rough sequence storyboard、rough motion-system storyboard 或纯文本导演提示。",
    "- 不要把所有镜头都写成同一种“大主格 + 小格”模板；每个镜头必须按动作密度、时长、节奏和用户风格诉求选择 executionMode。",
    "- executionMode 只能从 single_continuous_shot、relationship_wide、action_insert、reaction_closeup、planned_cut_sequence 中选择。",
    "- action_insert / reaction_closeup 通常是干净起势参考；planned_cut_sequence 用于快切、动作节点、日漫特写切分或段落式镜头预演。",
    "- 每个镜头 4-6 秒优先一个主动作；动作复杂时拆镜或把 executionMode 标成 planned_cut_sequence，让内部 skill 处理故事板策略。",
    "- durationSeconds 必须按内容节奏规划，不要全部写 5 秒：安静建立/情绪停顿可 6-8 秒，快切或动作段可 8-12 秒，复杂段落最多 15 秒；每个 actionBeats 必须能对应这个时长里的清楚时间段。",
    "- planned_cut_sequence 的 actionBeats 要按时间顺序写成 2-4 个可执行节点，避免把 8 个以上动作塞进 10 秒视频。",
    "- 时间、动作、节奏写在 JSON 字段里；不要要求 Image2 把时间码、文字、箭头或标题写进最终视频画面。",
    "- 多人镜头必须明确行动者和反应者，保持 screen-left/screen-right 和视线关系。",
    "- 全部图片提示词都要求 16:9、原创、日漫 TV 动画风、无文字、无 logo、无水印、非真人写实。",
    "JSON schema:",
    "{ title, logline, style, assets:[{id,kind,label,prompt,textConstraints,usedByShotIds}], shots:[{id,title,durationSeconds,executionMode,shotSize,camera,frameDescription,primaryAction,actionTrigger,microReaction,actorAction,reactorResponse,actionBeats,animeShotGrammar,rhythmProfile,rhythmReason,actionDensity,splitPolicy,dialogue,sound,sceneAssetIds,characterAssetIds,propAssetIds}] }",
    "资产要求：1 个场景、2 个角色、1 个关键道具。镜头要求：3-4 个镜头。",
    `主题：${topic}`,
  ].join("\n");
}

async function fetchOpusProjectPlan(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  topic: string;
  outputRoot: string;
}): Promise<OpusProjectPlan> {
  const endpoint = `${input.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/chat/completions`;
  const body = {
    model: input.model,
    temperature: 0.35,
    max_tokens: 5000,
    messages: [
      { role: "system", content: "Return only valid JSON. You are a precise film storyboard planner for AIGC video workflows." },
      { role: "user", content: plannerPrompt(input.topic) },
    ],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  writeJson(path.join(input.outputRoot, "receipts", "opus", "request.json"), {
    endpoint: "/v1/chat/completions",
    model: input.model,
    rawApiKeyStored: false,
    temperature: body.temperature,
    maxTokens: body.max_tokens,
    topic: input.topic,
  });
  writeText(path.join(input.outputRoot, "receipts", "opus", "response.json"), text);
  if (!response.ok) throw new Error(`Claude Opus planning failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  const payload = JSON.parse(text);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Claude Opus response did not include message content.");
  writeText(path.join(input.outputRoot, "project-plan-opus-raw.md"), content);
  const plan = normalizePlan(extractJsonObject(content));
  writeJson(path.join(input.outputRoot, "project-plan-opus.json"), plan);
  return plan;
}

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const runId = safeId(argValue("--run-id", `opus-storyboard-project-${generatedAt.replace(/[:.]/g, "-")}`));
const outputRoot = path.resolve(argValue("--output-root", path.join(repoRoot, "real-test-sandbox", runId)));
const live = argFlag("--live") || process.env.VIBE_OPUS_STORYBOARD_LIVE === "1";
const confirmed = argValue("--confirm-live", process.env.VIBE_OPUS_STORYBOARD_CONFIRM || "") === "submit-opus-storyboard-project";
const providerKey = getProviderApiKey("lanyi-image2");
const status = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const baseUrl = argValue("--base-url", process.env.VIBE_IMAGE2_BASE_URL || status?.baseUrl || "https://lanyiapi.com");
const chatModel = argValue("--chat-model", process.env.VIBE_CHAT_MODEL || status?.chatModel || "claude-opus-4-6");
const imageModel = argValue("--image-model", process.env.VIBE_IMAGE2_MODEL || status?.imageModel || "gpt-image-2");
const size = argValue("--size", "1280x720");
const quality = argValue("--quality", "standard");
const maxConcurrency = clamp(safeInteger(argValue("--max-concurrency", "3"), 3), 1, 10);
const maxRetries = clamp(safeInteger(argValue("--max-retries", "2"), 2), 0, 3);
const topic = argValue("--topic", "雨后旧电车站，短发少女和戴耳机的少年追踪一枚会发光的纸车票，找到废弃广播室里的夏日约定。");

mkdirSync(outputRoot, { recursive: true });
mkdirSync(path.join(outputRoot, "receipts"), { recursive: true });
mkdirSync(path.join(outputRoot, "report"), { recursive: true });

if (!live || !confirmed || !providerKey) {
  const report = {
    ok: false,
    status: !live ? "mock_ready" : !providerKey ? "blocked_missing_lanyi_key" : "blocked_missing_confirmation",
    providerCalledExternal: false,
    outputRoot,
    blockers: [
      live && !providerKey ? "local lanyi-image2 credential is required" : "",
      live && !confirmed ? "missing --confirm-live=submit-opus-storyboard-project" : "",
    ].filter(Boolean),
    commandExample: "npx tsx scripts/opus-storyboard-project-live-smoke.mts --live --confirm-live=submit-opus-storyboard-project",
  };
  writeJson(path.join(outputRoot, "report", "report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "mock_ready" ? 0 : 1);
}

const plan = await fetchOpusProjectPlan({
  apiKey: providerKey,
  baseUrl,
  model: chatModel,
  topic,
  outputRoot,
});

async function generateImage(input: {
  id: string;
  kind: PlannedAssetKind | "storyboard";
  label: string;
  prompt: string;
  outputPath: string;
  promptPath: string;
  receiptPath: string;
  usedByShotIds: string[];
  textConstraints: string[];
  referenceImages?: Array<{ path: string; role: string }>;
}): Promise<ImageRecord> {
  if (existsSync(input.outputPath) && statSync(input.outputPath).size > 0) {
    const bytes = readFileSync(input.outputPath);
    return {
      id: input.id,
      kind: input.kind,
      label: input.label,
      status: "needs_review",
      outputPath: input.outputPath,
      relativeOutputPath: packageRelative(outputRoot, input.outputPath),
      outputSha256: sha256(bytes),
      promptPath: packageRelative(outputRoot, input.promptPath),
      receiptPath: packageRelative(outputRoot, input.receiptPath),
      usedByShotIds: input.usedByShotIds,
      textConstraints: input.textConstraints,
      attemptCount: 0,
    };
  }
  writeText(input.promptPath, `${input.prompt}\n`);
  const references = (input.referenceImages || []).map((reference) => {
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
      apiKey: providerKey,
      baseUrl,
      model: imageModel,
      prompt: input.prompt,
      size,
      quality,
      timeoutMs: 8 * 60 * 1000,
      providerOperation: input.kind === "storyboard"
        ? "responses.image_generation.opus_storyboard_reference"
        : "responses.image_generation.opus_project_asset",
      referenceImages: references,
    });
    if (result.rawSseBytes) {
      rawSsePath = path.join(outputRoot, "receipts", "image2", `${input.id}.attempt-${attemptNumber}.sse.txt`);
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
  if (result.ok) writeText(input.outputPath, result.bytes);
  const record: ImageRecord = {
    id: input.id,
    kind: input.kind,
    label: input.label,
    status: result.ok ? "needs_review" : "missing",
    outputPath: result.ok ? input.outputPath : undefined,
    relativeOutputPath: result.ok ? packageRelative(outputRoot, input.outputPath) : undefined,
    outputSha256: result.ok ? sha256(result.bytes) : undefined,
    promptPath: packageRelative(outputRoot, input.promptPath),
    receiptPath: packageRelative(outputRoot, input.receiptPath),
    usedByShotIds: input.usedByShotIds,
    textConstraints: input.textConstraints,
    attemptCount: attempts.length,
    failure: result.ok ? undefined : {
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      message: result.message,
      diagnostic: result.diagnostic,
    },
  };
  writeJson(input.receiptPath, {
    schemaVersion: "opus_storyboard_project_image_receipt_v1",
    id: input.id,
    kind: input.kind,
    status: record.status,
    providerId: "lanyi-image2-responses-stream",
    providerCalledExternal: true,
    rawApiKeyStored: false,
    model: imageModel,
    size,
    quality,
    promptPath: record.promptPath,
    outputPath: record.relativeOutputPath,
    outputSha256: record.outputSha256,
    rawSsePath: rawSsePath ? packageRelative(outputRoot, rawSsePath) : undefined,
    referenceCount: references.length,
    references: references.map((reference) => ({ role: reference.role, path: packageRelative(outputRoot, reference.path), sha256: reference.sha256 })),
    attempts,
    humanReviewRequired: true,
    providerSelfReportCanPromote: false,
    failure: record.failure,
  });
  console.log(`[image2:${input.kind}] ${input.id}: ${record.status}`);
  return record;
}

const assetInputs = plan.assets.map((asset) => ({
  id: asset.id,
  kind: asset.kind,
  label: asset.label,
  prompt: [
    plan.style,
    asset.prompt,
    "16:9 single image, original Japanese TV anime production reference, simple readable composition, no text, no labels, no subtitles, no logo, no watermark, no photorealism.",
  ].join("\n"),
  outputPath: path.join(outputRoot, "assets", `${asset.kind}s`, `${asset.id}.png`),
  promptPath: path.join(outputRoot, "receipts", "prompts", "assets", `${asset.id}.md`),
  receiptPath: path.join(outputRoot, "receipts", "image2", "assets", `${asset.id}.json`),
  usedByShotIds: asset.usedByShotIds?.length ? asset.usedByShotIds : plan.shots.filter((shot) => [
    ...shot.sceneAssetIds,
    ...shot.characterAssetIds,
    ...shot.propAssetIds,
  ].includes(asset.id)).map((shot) => shot.id),
  textConstraints: asset.textConstraints || [],
}));

const assetRecords = await runWithConcurrency(assetInputs, maxConcurrency, generateImage);
const assetRecordById = new Map(assetRecords.map((record) => [record.id, record]));
const assetPlanById = new Map(plan.assets.map((asset) => [asset.id, asset]));

function referenceFromAsset(assetId: string): StoryboardReferenceAsset | undefined {
  const planned = assetPlanById.get(assetId);
  const record = assetRecordById.get(assetId);
  if (!planned || !record?.outputPath) return undefined;
  return {
    id: planned.id,
    role: roleForKind(planned.kind),
    path: record.outputPath,
    label: planned.label,
    notes: planned.textConstraints,
  };
}

const referenceBundle = {
  scenes: plan.assets.filter((asset) => asset.kind === "scene").map((asset) => referenceFromAsset(asset.id)).filter((asset): asset is StoryboardReferenceAsset => Boolean(asset)),
  characters: plan.assets.filter((asset) => asset.kind === "character").map((asset) => referenceFromAsset(asset.id)).filter((asset): asset is StoryboardReferenceAsset => Boolean(asset)),
  props: plan.assets.filter((asset) => asset.kind === "prop").map((asset) => referenceFromAsset(asset.id)).filter((asset): asset is StoryboardReferenceAsset => Boolean(asset)),
};

const promptPack = buildScriptStoryboardPromptPack({
  title: plan.title,
  logline: plan.logline,
  completeScript: [
    plan.logline,
    ...plan.shots.map((shot) => `${shot.id} ${shot.title}: ${shot.frameDescription}`),
  ].join("\n"),
  style: plan.style,
  creativeBrief: {
    filmLikes: [topic],
    rhythmLikes: ["让 AI 按每段动作密度自动选择 clean state reference 或 storyboard previs，不让用户手选模式。"],
    expressionLikes: ["日漫特写切分、手部插入、眼神反应、清楚走位、动作前一拍"],
    notes: "This project uses the internal director production skill routing before Image2 storyboard generation.",
  },
  referenceBundle,
  storyboardOutputDir: path.join(outputRoot, "storyboards"),
  videoOutputDir: path.join(outputRoot, "video-plans"),
  image2OutputSize: size,
  seedanceVideoResolution: "720p",
  shots: plan.shots.map((shot): ScriptStoryboardShotInput => ({
    shotId: shot.id,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    executionMode: shot.executionMode,
    sceneId: shot.sceneAssetIds[0],
    characterIds: shot.characterAssetIds,
    propIds: shot.propAssetIds,
    shotSize: shot.shotSize,
    camera: shot.camera,
    frameDescription: shot.frameDescription,
    actionBeats: shot.actionBeats,
    primaryAction: shot.primaryAction,
    actionTrigger: shot.actionTrigger,
    microReaction: shot.microReaction,
    actorAction: shot.actorAction,
    reactorResponse: shot.reactorResponse,
    rhythmProfile: shot.rhythmProfile,
    rhythmReason: shot.rhythmReason,
    actionDensity: shot.actionDensity,
    splitPolicy: shot.splitPolicy,
    dialogue: shot.dialogue,
    sound: shot.sound,
    animeShotGrammar: shot.animeShotGrammar,
    characterGuidance: ["Use locked character references for identity; storyboard rough placeholders must not replace face, hair, outfit silhouette, or body design."],
    propGuidance: ["Show only prop interaction needed for this shot; keep prop shape and hand placement readable."],
  })),
});
writeJson(path.join(outputRoot, "director-prompt-pack.json"), promptPack);
writeJson(path.join(outputRoot, "director-storyboard-table.json"), promptPack.directorRows);

const storyboardInputs = promptPack.shots.map((shot) => {
  const storyboardPlan = shot.image2StoryboardPlan;
  return {
    id: `${shot.shotId}_storyboard_reference`,
    kind: "storyboard" as const,
    label: `镜头 ${shot.shotId.replace(/^shot[_-]*0*/i, "")} 分镜参考图`,
    prompt: storyboardPlan.prompt,
    outputPath: path.join(outputRoot, "storyboards", `${shot.shotId}-storyboard-reference.png`),
    promptPath: path.join(outputRoot, "receipts", "prompts", "storyboards", `${shot.shotId}.md`),
    receiptPath: path.join(outputRoot, "receipts", "image2", "storyboards", `${shot.shotId}.json`),
    usedByShotIds: [shot.shotId],
    textConstraints: [
      shot.productionSkillPlan.strategyLabel,
      shot.productionSkillPlan.userFacingSummary,
      `Image2 模式：${shot.productionSkillPlan.image2Directive.mode}`,
      "Seedance 全能参考用",
    ],
    referenceImages: storyboardPlan.references.map((reference) => ({ path: reference.path, role: reference.role })),
  };
});

const storyboardRecords = await runWithConcurrency(storyboardInputs, maxConcurrency, generateImage);
const now = new Date().toISOString();
const allRecords = [...assetRecords, ...storyboardRecords];
const projectAssets = allRecords.map((record) => ({
  id: record.id,
  kind: record.kind === "storyboard" ? "reference" : record.kind,
  label: record.label,
  status: record.status,
  path: record.relativeOutputPath,
  textConstraints: record.textConstraints,
  usedByShotIds: record.usedByShotIds,
  sourceRefs: [`receipt:${record.receiptPath}`, `prompt:${record.promptPath}`],
}));

const project = createProjectVibe({
  projectId: runId,
  title: plan.title,
  createdAt: now,
  updatedAt: now,
  storyFlow: {
    id: "story_flow_current",
    shotOrder: plan.shots.map((shot) => shot.id),
    sections: [{
      id: "main_sequence",
      title: plan.title,
      summary: plan.logline,
      sequenceIndex: 1,
      shotIds: plan.shots.map((shot) => shot.id),
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
  shots: plan.shots.map((shot) => ({
    id: shot.id,
    sectionId: "main_sequence",
    title: shot.title,
    intent: shot.frameDescription,
    videoControlMode: "reference_driven",
    sceneAssetIds: shot.sceneAssetIds,
    characterAssetIds: shot.characterAssetIds,
    propAssetIds: shot.propAssetIds,
    durationSeconds: shot.durationSeconds,
    status: storyboardRecords.find((record) => record.id === `${shot.id}_storyboard_reference`)?.status === "needs_review" ? "ready" : "blocked",
    sourceRefs: [`opus-plan:${shot.id}`],
  })),
  assets: projectAssets,
  runs: [{
    id: "run_opus_storyboard_project_image2",
    runKind: "provider",
    status: allRecords.every((record) => record.status === "needs_review") ? "succeeded" : "failed",
    createdAt: now,
    summary: "Claude Opus planned a small project; Image2 generated locked assets and storyboard references.",
    sourceFactHash: sha256(JSON.stringify(plan)),
    affectedShotIds: plan.shots.map((shot) => shot.id),
    producedAssetIds: projectAssets.map((asset) => asset.id),
    evidenceRefs: allRecords.flatMap((record) => [`receipt:${record.receiptPath}`, `prompt:${record.promptPath}`]),
    projectFactsMutated: false,
    runtimeFixtureUsed: false,
  }],
  receipts: {
    scriptPlanningReceipts: [{
      id: "opus_storyboard_project_plan",
      kind: "script_planning",
      createdAt: now,
      plannerId: chatModel,
      sourceFactHash: sha256(JSON.stringify(plan)),
      sectionIds: ["main_sequence"],
      shotIds: plan.shots.map((shot) => shot.id),
      blockerCount: 0,
      evidenceRefs: ["project-plan-opus.json"],
      providerSelfReportUsed: false,
      runtimeFixtureUsed: false,
    }],
    promptKeyframePlanningReceipts: [],
    batchReceipts: [{
      id: "batch_opus_storyboard_project_image2",
      createdAt: now,
      batchId: runId,
      status: allRecords.every((record) => record.status === "needs_review") ? "succeeded" : allRecords.some((record) => record.status === "needs_review") ? "partial" : "failed",
      sourceFactHash: sha256(JSON.stringify(plan)),
      providerId: "lanyi-image2-responses-stream",
      taskEnvelopeIds: allRecords.map((record) => `task_${record.id}`),
      affectedShotIds: plan.shots.map((shot) => shot.id),
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
      sourceRunId: "run_opus_storyboard_project_image2",
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
writeJson(path.join(outputRoot, "Project.vibe"), project);
const report = {
  schemaVersion: "opus_storyboard_project_live_smoke_report_v1",
  ok: validation.ok && allRecords.every((record) => record.status === "needs_review"),
  runId,
  title: plan.title,
  logline: plan.logline,
  outputRoot,
  projectVibePath: path.join(outputRoot, "Project.vibe"),
  opus: {
    providerCalledExternal: true,
    model: chatModel,
    planPath: packageRelative(outputRoot, path.join(outputRoot, "project-plan-opus.json")),
  },
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
  projectValidation: validation,
  assets: assetRecords,
  storyboards: storyboardRecords,
};
writeJson(path.join(outputRoot, "report", "report.json"), report);
writeText(path.join(outputRoot, "report", "summary.md"), [
  `# ${plan.title}`,
  "",
  plan.logline,
  "",
  `- Claude Opus: ${chatModel}`,
  `- Image2 assets: ${report.image2.assetSuccessCount}/${assetRecords.length}`,
  `- Image2 storyboards: ${report.image2.storyboardSuccessCount}/${storyboardRecords.length}`,
  `- Project.vibe: ${validation.ok ? "ok" : validation.errors.join("; ")}`,
  "",
  "## Assets",
  ...assetRecords.map((record) => `- ${record.label}: ${record.relativeOutputPath || "missing"}`),
  "",
  "## Storyboards",
  ...storyboardRecords.map((record) => `- ${record.label}: ${record.relativeOutputPath || "missing"}`),
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: report.ok,
  runId,
  outputRoot,
  reportPath: path.join(outputRoot, "report", "report.json"),
  projectVibePath: report.projectVibePath,
  opus: report.opus,
  image2: report.image2,
}, null, 2));
process.exit(report.ok ? 0 : 2);
