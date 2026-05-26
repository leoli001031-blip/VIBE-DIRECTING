import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildStoryboardReferenceProjectPlan } from "../src/core/storyboardReferenceProjectPlanner.ts";
import { buildImage2StoryboardReferencePlan, type StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";
import { createProjectVibe, validateProjectVibe } from "../src/project/projectVibe.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type ShotFixture = {
  id: string;
  title: string;
  camera: string;
  intent: string;
  dialogue?: string;
  durationSeconds: number;
  characterAssetIds: string[];
  propAssetIds: string[];
};

type GeneratedStoryboard = {
  shot: ShotFixture;
  ok: boolean;
  outputPath?: string;
  relativeOutputPath?: string;
  promptPath: string;
  receiptPath: string;
  rawSsePath?: string;
  outputHash?: string;
  providerRequestId?: string;
  elapsedMs?: number;
  attemptCount: number;
  attempts: Array<{
    attemptNumber: number;
    ok: boolean;
    statusCode?: number;
    errorType?: string;
    failureKind?: string;
    elapsedMs?: number;
    retryable?: boolean;
  }>;
  failure?: unknown;
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
    .slice(0, 90) || "storyboard-sheet-chain";
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function sha256(bytes: Buffer | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function packageRelative(packageRoot: string, filePath: string): string {
  return path.relative(packageRoot, filePath).replace(/\\/g, "/");
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
  if (result?.errorType === "timeout" || result?.errorType === "network_error" || result?.errorType === "rate_limit") return true;
  return typeof result?.statusCode === "number" && result.statusCode >= 500;
}

function copyFixtureAsset(input: { fixtureRoot: string; packageRoot: string; from: string; to: string }): string {
  const source = path.join(input.fixtureRoot, input.from);
  const target = path.join(input.packageRoot, input.to);
  if (!existsSync(source)) throw new Error(`Missing fixture asset: ${source}`);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return target;
}

async function generateStoryboard(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  quality: string;
  size: string;
  maxRetries: number;
  packageRoot: string;
  sceneBaseline: StoryboardReferenceAsset;
  shot: ShotFixture;
}): Promise<GeneratedStoryboard> {
  const plan = buildImage2StoryboardReferencePlan({
    shotId: input.shot.id,
    shotTitle: input.shot.title,
    camera: input.shot.camera,
    shotDescription: input.shot.intent,
    dialogue: input.shot.dialogue,
    durationSeconds: input.shot.durationSeconds,
    outputSize: input.size,
    sceneBaseline: input.sceneBaseline,
  });
  const storyboardDir = path.join(input.packageRoot, "storyboards");
  const receiptsDir = path.join(input.packageRoot, "receipts", "image2", "storyboards");
  const outputPath = path.join(storyboardDir, `${input.shot.id}-storyboard-reference.png`);
  const promptPath = path.join(receiptsDir, `${input.shot.id}.prompt.md`);
  const receiptPath = path.join(receiptsDir, `${input.shot.id}.json`);
  writeText(promptPath, `${plan.prompt}\n`);

  const sceneBytes = readFileSync(input.sceneBaseline.path);
  const attempts: GeneratedStoryboard["attempts"] = [];
  let result: any;
  let rawSsePath: string | undefined;
  const maxAttempts = Math.max(1, Math.floor(input.maxRetries) + 1);
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      prompt: plan.prompt,
      size: input.size,
      quality: input.quality,
      providerOperation: "responses.image_generation_storyboard_reference",
      timeoutMs: 8 * 60 * 1000,
      referenceImages: [{
        role: "scene_baseline",
        path: input.sceneBaseline.path,
        name: path.basename(input.sceneBaseline.path),
        mimeType: inferMime(input.sceneBaseline.path),
        bytes: sceneBytes,
        sha256: sha256(sceneBytes),
      }],
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
    if (result.rawSseBytes) {
      rawSsePath = path.join(receiptsDir, `${input.shot.id}.attempt-${attemptNumber}.sse.txt`);
      writeFileSync(rawSsePath, result.rawSseBytes);
    }
    if (result.ok || !retryableImage2Result(result) || attemptNumber === maxAttempts) break;
    await sleep(5_000 * attemptNumber);
  }

  const receipt = {
    schemaVersion: "storyboard_sheet_chain_live_receipt_v1",
    shotId: input.shot.id,
    providerId: "lanyi-image2-responses-stream",
    operation: "image2.storyboard_sheet",
    status: result.ok ? "success" : "failed",
    ok: result.ok,
    model: input.model,
    size: input.size,
    quality: input.quality,
    rawApiKeyStored: false,
    attempts,
    promptPath: packageRelative(input.packageRoot, promptPath),
    outputPath: result.ok ? packageRelative(input.packageRoot, outputPath) : undefined,
    rawSsePath: rawSsePath ? packageRelative(input.packageRoot, rawSsePath) : undefined,
    referencePolicy: plan.referencePolicy,
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

  if (result.ok) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, result.bytes);
  }
  writeJson(receiptPath, receipt);

  return {
    shot: input.shot,
    ok: result.ok,
    outputPath: result.ok ? outputPath : undefined,
    relativeOutputPath: result.ok ? packageRelative(input.packageRoot, outputPath) : undefined,
    promptPath: packageRelative(input.packageRoot, promptPath),
    receiptPath: packageRelative(input.packageRoot, receiptPath),
    rawSsePath: result.rawSseBytes ? packageRelative(input.packageRoot, rawSsePath) : undefined,
    outputHash: result.ok ? sha256(result.bytes) : undefined,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.providerResponseMetadata?.elapsedMs,
    attemptCount: attempts.length,
    attempts,
    failure: result.ok ? undefined : receipt.failure,
  };
}

const repoRoot = process.cwd();
const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, LANYI_API_KEY, or OPENAI_API_KEY is required.");

const runId = safeId(argValue("--run-id") || `storyboard-sheet-chain-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const packageRoot = path.resolve(argValue("--output-root") || path.join(repoRoot, "real-test-sandbox", runId));
const fixtureRoot = path.resolve(argValue("--fixture-root") || path.join(repoRoot, "real-test-sandbox", "anime-manga-stylefix-20260520-01"));
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || process.env.IMAGE_MODEL || providerStatus?.imageModel || "gpt-image-2";
const baseUrl = argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || process.env.LANYI_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com/v1";
const size = argValue("--size") || "1280x720";
const quality = argValue("--quality") || "standard";
const maxRetries = Number(argValue("--max-retries") || "2");

mkdirSync(packageRoot, { recursive: true });

const scenePath = copyFixtureAsset({
  fixtureRoot,
  packageRoot,
  from: "assets/scenes/after-rain-school-rooftop.png",
  to: "assets/scenes/after-rain-school-rooftop.png",
});
const hinaPath = copyFixtureAsset({
  fixtureRoot,
  packageRoot,
  from: "assets/characters/hina-main-character.png",
  to: "assets/characters/hina-main-character.png",
});
const renPath = copyFixtureAsset({
  fixtureRoot,
  packageRoot,
  from: "assets/characters/ren-supporting-character.png",
  to: "assets/characters/ren-supporting-character.png",
});
const cassettePath = copyFixtureAsset({
  fixtureRoot,
  packageRoot,
  from: "assets/props/blue-cassette-case.png",
  to: "assets/props/blue-cassette-case.png",
});

const shots: ShotFixture[] = [
  {
    id: "AN01",
    title: "雨后天台，日奈握紧蓝色磁带盒",
    durationSeconds: 5,
    characterAssetIds: ["asset_character_hina"],
    propAssetIds: ["asset_prop_cassette"],
    camera: "中景，三分之二侧面，缓慢推进；主画面锁定天台栏杆、湿地面、右侧屋顶门和城市远景。",
    dialogue: "小声日语台词：まだ、聞こえる。",
    intent: [
      "日奈站在画面左侧偏前景，身体三分之二侧面对镜头，双手把蓝色磁带盒贴近胸口。",
      "动作小格依次表现：轻轻呼气、眨眼、视线从镜头右侧落到磁带盒。",
      "箭头标注慢推进、眼线下移、地面积水轻微闪动。",
    ].join(" "),
  },
  {
    id: "AN02",
    title: "莲从屋顶门出现，两人隔着雨后天台对望",
    durationSeconds: 5,
    characterAssetIds: ["asset_character_hina", "asset_character_ren"],
    propAssetIds: ["asset_prop_cassette"],
    camera: "全景转中景，轻微横移后停住；保持 180 度轴线，日奈在画面左侧，莲从画面右侧屋顶门入画。",
    dialogue: "小声日语台词：日奈、それを返して。",
    intent: [
      "主画面交代两人位置：日奈在左前景靠近栏杆，莲在右后景门口，二人隔着湿地面对望，蓝色磁带盒在日奈手中。",
      "动作小格依次表现：莲推门入画、日奈手指收紧磁带盒、两人眼线相接。",
      "箭头标注莲从右向左入画、日奈轻微后缩、镜头从门口横移回日奈。",
      "多人关系必须保持屏幕方向，不能互换左右站位。",
    ].join(" "),
  },
];

const sceneBaseline: StoryboardReferenceAsset = {
  id: "asset_scene_rooftop",
  role: "scene_baseline",
  path: scenePath,
  label: "雨后学校天台场景基准图",
};

const generated: GeneratedStoryboard[] = [];
for (const shot of shots) {
  generated.push(await generateStoryboard({
    apiKey,
    baseUrl,
    model,
    quality,
    size,
    maxRetries,
    packageRoot,
    sceneBaseline,
    shot,
  }));
}

const now = new Date().toISOString();
const generatedStoryboards = generated.filter((item) => item.ok && item.outputPath);
const planner = buildStoryboardReferenceProjectPlan({
  projectId: "storyboard_sheet_chain_live_smoke",
  outputSize: size,
  storyboardOutputRoot: path.join(packageRoot, "storyboards"),
  videoOutputRoot: path.join(packageRoot, "video"),
  shots: shots.map((shot) => ({
    id: shot.id,
    title: shot.title,
    intent: shot.intent,
    camera: shot.camera,
    durationSeconds: shot.durationSeconds,
    sceneAssetIds: ["asset_scene_rooftop"],
    characterAssetIds: shot.characterAssetIds,
    propAssetIds: shot.propAssetIds,
  })),
  assets: [
    { id: "asset_scene_rooftop", kind: "scene", role: "scene_baseline", label: "雨后学校天台", path: scenePath, usedByShotIds: shots.map((shot) => shot.id) },
    { id: "asset_character_hina", kind: "character", role: "character_identity", label: "日奈角色参考", path: hinaPath, usedByShotIds: ["AN01", "AN02"] },
    { id: "asset_character_ren", kind: "character", role: "character_identity", label: "莲角色参考", path: renPath, usedByShotIds: ["AN02"] },
    { id: "asset_prop_cassette", kind: "prop", role: "prop_reference", label: "蓝色磁带盒", path: cassettePath, usedByShotIds: ["AN01", "AN02"] },
  ],
  storyboardReferences: generatedStoryboards.map((item) => ({
    id: `storyboard_${item.shot.id}`,
    kind: "reference",
    role: "storyboard_reference",
    label: `${item.shot.title} 分镜页`,
    path: item.outputPath,
    usedByShotIds: [item.shot.id],
  })),
});

for (const shotPlan of planner.shotPlans) {
  writeJson(path.join(packageRoot, "video-plans", `${shotPlan.shotId}.json`), shotPlan.seedanceVideoPlan || {
    blocked: true,
    blockedReasons: shotPlan.blockedReasons,
  });
}

const projectAssets = [
  { id: "asset_scene_rooftop", kind: "scene" as const, label: "雨后学校天台", status: "locked" as const, path: "assets/scenes/after-rain-school-rooftop.png", textConstraints: ["雨后", "学校天台", "湿润地面", "城市远景"], usedByShotIds: ["AN01", "AN02"], sourceRefs: ["copied_fixture:anime-manga-stylefix-20260520-01"], lockedBy: "user" as const },
  { id: "asset_character_hina", kind: "character" as const, label: "日奈", status: "locked" as const, path: "assets/characters/hina-main-character.png", textConstraints: ["短发少女", "校服", "克制情绪"], usedByShotIds: ["AN01", "AN02"], sourceRefs: ["copied_fixture:anime-manga-stylefix-20260520-01"], lockedBy: "user" as const },
  { id: "asset_character_ren", kind: "character" as const, label: "莲", status: "locked" as const, path: "assets/characters/ren-supporting-character.png", textConstraints: ["少年", "校服", "门口入画"], usedByShotIds: ["AN02"], sourceRefs: ["copied_fixture:anime-manga-stylefix-20260520-01"], lockedBy: "user" as const },
  { id: "asset_prop_cassette", kind: "prop" as const, label: "蓝色磁带盒", status: "locked" as const, path: "assets/props/blue-cassette-case.png", textConstraints: ["蓝色透明磁带盒", "被日奈双手握住"], usedByShotIds: ["AN01", "AN02"], sourceRefs: ["copied_fixture:anime-manga-stylefix-20260520-01"], lockedBy: "user" as const },
  ...generatedStoryboards.map((item) => ({
    id: `asset_storyboard_${item.shot.id}`,
    kind: "reference" as const,
    label: `${item.shot.id} 分镜页`,
    status: "needs_review" as const,
    path: item.relativeOutputPath,
    textConstraints: ["主画面锁定空间关系", "动作小格交代动作节拍", "Seedance 全能参考输入"],
    usedByShotIds: [item.shot.id],
    sourceRefs: [`receipt:${item.receiptPath}`, `prompt:${item.promptPath}`],
  })),
];

const project = createProjectVibe({
  projectId: "storyboard_sheet_chain_live_smoke",
  title: "雨后磁带分镜页真实链路测试",
  createdAt: now,
  updatedAt: now,
  storyFlow: {
    id: "story_flow_storyboard_sheet_chain",
    shotOrder: shots.map((shot) => shot.id),
    sections: [{
      id: "main_sequence",
      title: "雨后磁带",
      summary: "两镜头真实链路：场景基准图 -> Image2 黑白分镜页 -> Seedance 全能参考计划。",
      sequenceIndex: 1,
      shotIds: shots.map((shot) => shot.id),
    }],
  },
  visualMemory: {
    id: "visual_memory_storyboard_sheet_chain",
    entries: projectAssets.map((asset) => ({
      id: `vm_${asset.id}`,
      assetId: asset.id,
      kind: asset.kind,
      label: asset.label,
      status: asset.status,
      textConstraints: asset.textConstraints,
      usedByShotIds: asset.usedByShotIds,
      canUseAsFutureReference: asset.status === "locked",
      sourceRefs: asset.sourceRefs,
    })),
  },
  shots: shots.map((shot) => ({
    id: shot.id,
    sectionId: "main_sequence",
    title: shot.title,
    intent: shot.intent,
    videoControlMode: "reference_driven",
    sceneAssetIds: ["asset_scene_rooftop"],
    characterAssetIds: shot.characterAssetIds,
    propAssetIds: shot.propAssetIds,
    durationSeconds: shot.durationSeconds,
    status: generated.find((item) => item.shot.id === shot.id)?.ok ? "ready" : "blocked",
    sourceRefs: [`storyboard_chain#shots/${shot.id}`],
  })),
  assets: projectAssets,
  runs: [{
    id: "run_storyboard_sheet_chain_live",
    runKind: "provider",
    status: generated.every((item) => item.ok) ? "succeeded" : "failed",
    createdAt: now,
    summary: "真实调用 Image2 生成黑白导演分镜页，并生成后续 Seedance 全能参考计划。",
    sourceFactHash: sha256(JSON.stringify(shots)),
    affectedShotIds: shots.map((shot) => shot.id),
    producedAssetIds: generatedStoryboards.map((item) => `asset_storyboard_${item.shot.id}`),
    evidenceRefs: generated.flatMap((item) => [`receipt:${item.receiptPath}`, `prompt:${item.promptPath}`]),
    projectFactsMutated: false,
    runtimeFixtureUsed: false,
  }],
  receipts: {
    scriptPlanningReceipts: [],
    promptKeyframePlanningReceipts: [],
    batchReceipts: [{
      id: "batch_storyboard_sheet_chain_live",
      createdAt: now,
      batchId: runId,
      status: generated.every((item) => item.ok) ? "succeeded" : generated.some((item) => item.ok) ? "partial" : "failed",
      sourceFactHash: sha256(JSON.stringify(shots)),
      providerId: "lanyi-image2-responses-stream",
      taskEnvelopeIds: shots.map((shot) => `task_storyboard_${shot.id}`),
      affectedShotIds: shots.map((shot) => shot.id),
      attemptIds: generated.map((item) => `attempt_storyboard_${item.shot.id}`),
      returnedOutputCount: generatedStoryboards.length,
      missingOutputCount: generated.length - generatedStoryboards.length,
      outputHashes: generatedStoryboards.map((item) => item.outputHash || "").filter(Boolean),
      evidenceRefs: generated.flatMap((item) => [`receipt:${item.receiptPath}`, `prompt:${item.promptPath}`]),
      providerSelfReportCanPromote: false,
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    }],
    reviewReceipts: generated.map((item) => ({
      id: `review_storyboard_${item.shot.id}`,
      createdAt: now,
      status: item.ok ? "needs_review" as const : "missing" as const,
      humanReviewed: false,
      shotId: item.shot.id,
      assetId: item.ok ? `asset_storyboard_${item.shot.id}` : undefined,
      sourceRunId: "run_storyboard_sheet_chain_live",
      outputPath: item.relativeOutputPath,
      outputHash: item.outputHash,
      retryRequested: false,
      lateOutput: false,
      providerSelfReportIgnored: true,
      promotionAuthorized: false,
      evidenceRefs: [`receipt:${item.receiptPath}`, `prompt:${item.promptPath}`],
      blockers: item.ok ? [] : ["分镜页没有返回，不能进入视频生成。"],
    })),
  },
});

const validation = validateProjectVibe(project);
writeJson(path.join(packageRoot, "Project.vibe"), project);
writeJson(path.join(packageRoot, "report", "storyboard-sheet-chain-report.json"), {
  schemaVersion: "storyboard_sheet_chain_live_report_v1",
  runId,
  ok: generated.every((item) => item.ok) && validation.ok && !planner.blocked,
  packageRoot,
  image2: {
    model,
    size,
    quality,
    providerCalled: true,
    maxRetries,
    generatedCount: generatedStoryboards.length,
    missingCount: generated.length - generatedStoryboards.length,
  },
  projectValidation: validation,
  planner: {
    schemaVersion: planner.schemaVersion,
    blocked: planner.blocked,
    blockedReasons: planner.blockedReasons,
    shotCount: planner.shotPlans.length,
    videoPlanCount: planner.shotPlans.filter((shot) => Boolean(shot.seedanceVideoPlan)).length,
  },
  storyboards: generated.map((item) => ({
    shotId: item.shot.id,
    ok: item.ok,
    outputPath: item.relativeOutputPath,
    promptPath: item.promptPath,
    receiptPath: item.receiptPath,
    providerRequestId: item.providerRequestId,
    elapsedMs: item.elapsedMs,
    attemptCount: item.attemptCount,
    attempts: item.attempts,
    failure: item.failure,
  })),
});

writeText(path.join(packageRoot, "report", "summary.md"), [
  "# Storyboard Sheet Chain Live Smoke",
  "",
  `- Run: ${runId}`,
  `- Image2: ${model}, ${size}, ${quality}`,
  `- Generated storyboards: ${generatedStoryboards.length}/${generated.length}`,
  `- Project.vibe validation: ${validation.ok ? "ok" : validation.errors.join("; ")}`,
  `- Seedance plan ready: ${planner.shotPlans.filter((shot) => Boolean(shot.seedanceVideoPlan)).length}/${planner.shotPlans.length}`,
  "",
  "## Outputs",
  ...generated.map((item) => `- ${item.shot.id}: ${item.ok ? item.relativeOutputPath : "missing"}`),
].join("\n"));

console.log(JSON.stringify({
  ok: generated.every((item) => item.ok) && validation.ok && !planner.blocked,
  runId,
  packageRoot,
  projectVibePath: path.join(packageRoot, "Project.vibe"),
  reportPath: path.join(packageRoot, "report", "storyboard-sheet-chain-report.json"),
  generated: generated.map((item) => ({
    shotId: item.shot.id,
    ok: item.ok,
    outputPath: item.outputPath,
    elapsedMs: item.elapsedMs,
    attemptCount: item.attemptCount,
  })),
  projectValidationOk: validation.ok,
  plannerBlocked: planner.blocked,
}, null, 2));

if (!generated.every((item) => item.ok) || !validation.ok || planner.blocked) process.exit(2);
