import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  realpath,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  buildAgentVideoPipelinePlan,
  buildLiveSeedanceAgentVideoProviderCapabilityRegistry,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  recordAgentVideoGenerationJobExecution,
  recordAgentVideoGenerationJobReviewResult,
  transitionAgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import {
  buildJimengImage2VideoPlan,
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  normalizeDreaminaStatus,
} from "../src/core/jimengVideoCli.ts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  serializeProjectVibe,
} from "../src/project/index.ts";
import { projectAgentGenerationJobLedgerPath } from "../src/project/projectAgentGenerationJobLedger.ts";
import {
  buildVideoRelayQueueState,
  type VideoRelayQueueItemStatus,
} from "../src/core/videoRelayQueue.ts";
import {
  fetchApikeyFunImageViaResponses,
} from "./apikey-fun-responses-image-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";
import {
  closePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  observePackagedTask,
  openVideoAcceptanceView,
  waitForAcceptance,
} from "./lib/packaged-acceptance-harness.mts";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
};

const mode = process.argv.find((item) => item.startsWith("--mode="))?.slice("--mode=".length) || "inspect";
const authorization = process.argv.find((item) => item.startsWith("--authorization="))?.slice("--authorization=".length) || "";
const authorizationPhrase = "confirm-p13s01-image2-and-seedance-once";
const supportedModes = new Set(["prepare", "image", "normalize-image", "video", "query", "ingest-return", "repair-paths", "packaged", "inspect"]);

const root = resolve(process.env.VIBE_P13_CANARY_ROOT || "/tmp/vibe-director-p13-a-20260723");
const projectRoot = join(root, "projects", "p13-provider-canary");
const projectPath = join(projectRoot, "project.vibe");
const reportRoot = join(projectRoot, "reports", "p13-provider-canary");
const planPath = join(reportRoot, "canary-plan.json");
const ledgerPath = join(projectRoot, projectAgentGenerationJobLedgerPath);
const imageAttemptPath = join(reportRoot, "image2-attempt.json");
const imageReceiptPath = join(reportRoot, "image2-receipt.json");
const imageOutputPath = join(projectRoot, "assets", "candidates", "P13S01-image2-reference.png");
const imageNormalizedOutputPath = join(projectRoot, "assets", "candidates", "P13S01-image2-reference-1280x720.png");
const videoAttemptPath = join(reportRoot, "seedance-submit-attempt.json");
const videoPlanPath = join(reportRoot, "seedance-submit-plan.json");
const videoSubmitReceiptPath = join(reportRoot, "seedance-submit-receipt.json");
const videoResultReceiptPath = join(reportRoot, "seedance-result-receipt.json");
const relayQueuePath = join(projectRoot, "reports", "video_relay_queue.json");
const previewPlanPath = join(projectRoot, "reports", "preview_plan.json");
const queryHistoryPath = join(reportRoot, "seedance-query-attempts.json");
const videoReturnRoot = join(projectRoot, "video", "provider-return");
const cliPath = process.env.VIBE_JIMENG_CLI_PATH || "dreamina";
const appPath = resolve(process.env.VIBE_P13_APP_PATH || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const packagedRoot = join(root, "packaged");
const packagedProfileRoot = join(packagedRoot, "profile");
const packagedRuntimeRoot = join(packagedRoot, "runtime");
const packagedBindingPath = join(packagedProfileRoot, "current-project.local.json");
const packagedObservationPath = join(reportRoot, "packaged-needs-review-observation.json");
const packagedScreenshotPath = join(reportRoot, "packaged-needs-review.png");
const inspectionPath = join(reportRoot, "canary-inspection.json");

const projectId = "p13_provider_canary";
const shotId = "P13S01";
const imageActionId = "p13s01_image2_action_once";
const imageJobId = "p13s01_image2_job_once";
const imageReceiptId = "p13s01_image2_receipt_once";
const videoActionId = "p13s01_seedance_action_once";
const videoConfirmationId = "p13s01_seedance_confirmation_once";
const videoReceiptId = "p13s01_seedance_submit_receipt_once";
const createdAt = "2026-07-23T00:00:00.000Z";

const imagePrompt = [
  "Create one restrained realistic 16:9 cinematic production reference frame for P13S01.",
  "Early morning in an open-air market just after rain; stalls are present but no other people are visible.",
  "One elderly man in practical muted clothing raises a clearly empty woven market basket to block a diagonal shaft of pale morning sunlight.",
  "A single subtle translucent fish shape is fading inside the shaft of light; it must feel fleeting and observational, not like a glowing magical creature.",
  "Wet pavement and one foreground puddle reflect the pale sky; compose the frame so the puddle can become the ending visual anchor.",
  "Medium-wide single-scene film still, natural skin and fabric, restrained color, quiet emotion, believable light.",
  "No flashback, no magic explanation, no melodrama, no extra characters, no montage, no split screen, no text, no logo, no watermark.",
].join(" ");

const videoPrompt = [
  "Create one continuous five-second restrained realistic shot from the supplied 16:9 reference frame.",
  "The elderly man completes one readable action: he raises the clearly empty basket into the diagonal morning light to shade his eyes.",
  "The translucent fish shape gently fades as the basket reaches the light; do not make it glow, burst, transform, or become an explained fantasy event.",
  "Use a nearly locked medium-wide camera with only a very subtle forward drift.",
  "End by letting the foreground puddle hold a clean reflection of the pale sky while the man remains in the same market space.",
  "Preserve the same man, clothing, basket, market layout, wet ground, light direction, and realistic visual treatment.",
  "No cuts, no flashback, no montage, no extra characters, no melodrama, no captions, no logo, no watermark, no music.",
].join(" ");

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function pathExists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

async function readJson<T = any>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readOptionalJson<T = any>(path: string): Promise<T | undefined> {
  return pathExists(path).then((exists) => exists ? readJson<T>(path) : undefined);
}

async function writeJson(path: string, value: unknown, exclusive = false): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    ...(exclusive ? { flag: "wx" as const } : {}),
  });
}

function sha256Bytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function sha256File(path: string): Promise<string> {
  return sha256Bytes(await readFile(path));
}

function normalizedPath(path: string): string {
  return resolve(path).replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
}

function seedanceSourceReceiptId(externalTaskId: string): string {
  const value = externalTaskId.trim();
  assertCondition(Boolean(value), "P13 Seedance source receipt requires an external task identity");
  return `seedance_submit_${value}`;
}

async function assertProjectFile(path: string): Promise<string> {
  const [realRoot, realFile] = await Promise.all([realpath(projectRoot), realpath(path)]);
  const relativePath = relative(realRoot, realFile);
  assertCondition(
    relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath)),
    `P13 artifact escaped project root: ${path}`,
  );
  return realFile;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature) return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function redact(value: string): string {
  return String(value || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .replace(/(sessionid|sid_tt|passport_csrf_token)[=:]\s*[^\s,;]+/gi, "$1=REDACTED")
    .slice(-6000);
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  const startedAt = Date.now();
  return new Promise((resolveCommand) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveCommand({
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolveCommand({ exitCode, stdout, stderr, timedOut, durationMs: Date.now() - startedAt });
    });
  });
}

async function videoFiles(path: string): Promise<string[]> {
  if (!await pathExists(path)) return [];
  const files: string[] = [];
  async function visit(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (/\.(mp4|mov|webm)$/i.test(entry.name) && (await stat(absolute)).size > 0) files.push(absolute);
    }
  }
  await visit(path);
  return files.sort();
}

async function retainReturnedMedia(localPaths: string[]): Promise<string | undefined> {
  const candidates = [
    ...(await videoFiles(videoReturnRoot)),
    ...localPaths.map((path) => isAbsolute(path) ? path : resolve(projectRoot, path)),
  ];
  let source: string | undefined;
  for (const candidate of [...new Set(candidates)]) {
    if (await pathExists(candidate)) {
      source = candidate;
      break;
    }
  }
  if (!source) return undefined;
  const target = join(videoReturnRoot, `${shotId}-seedance2.0_vip.mp4`);
  await mkdir(dirname(target), { recursive: true });
  if (normalizedPath(source) !== normalizedPath(target)) await copyFile(source, target);
  return assertProjectFile(target);
}

async function createFixture() {
  assertCondition(supportedModes.has(mode), `Unsupported P13 canary mode: ${mode}`);
  assertCondition(normalizedPath(root).startsWith("/tmp/"), "P13 canary root must stay under /tmp");
  assertCondition(!await pathExists(imageAttemptPath), "Image2 attempt lock already exists; prepare cannot reset it");
  assertCondition(!await pathExists(videoAttemptPath), "Seedance submit lock already exists; prepare cannot reset it");
  if (await pathExists(planPath)) {
    const existing = await readJson<any>(planPath);
    assertCondition(existing.projectId === projectId && existing.shotId === shotId, "Existing P13 plan has different identity");
    return existing;
  }

  await mkdir(dirname(projectPath), { recursive: true });
  const project = createProjectVibe({
    projectId,
    title: "P13 Provider Canary",
    version: "1.0.0",
    createdAt,
    updatedAt: createdAt,
    storyFlow: {
      id: "p13_canary_story",
      sections: [{
        id: "section_p13",
        title: "清晨菜市场",
        summary: "老人举起空菜篮挡住斜照晨光，透明鱼淡去，水洼留下天空倒影。",
        sequenceIndex: 0,
        shotIds: [shotId],
      }],
      shotOrder: [shotId],
    },
    visualMemory: { id: "p13_canary_visual_memory", entries: [] },
    shots: [{
      id: shotId,
      sectionId: "section_p13",
      title: "空菜篮挡住晨光",
      intent: "清晨菜市场，老人举起空菜篮挡住斜照晨光，透明鱼淡去，结尾水洼只剩天空倒影。",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: ["p13-canary:shot"],
      referenceStrategy: "omni_reference",
      executionMode: "single_continuous_shot",
      primaryAction: "老人举起空菜篮挡住斜照晨光",
      actionTrigger: "晨光斜穿过菜市场",
      microReaction: "透明鱼淡去，水洼留下天空倒影",
      camera: "中远景近乎固定，只做极轻微前移，不切镜",
    }],
    assets: [],
    runs: [],
  });
  const projectFactHash = hashProjectVibeFacts(project);
  const ledgerCreatedAt = new Date().toISOString();
  const ledger = createAgentVideoGenerationJobLedger({
    ledgerId: "p13_provider_canary_generation_ledger",
    projectId,
    projectRoot,
    projectFactHash,
    createdAt: ledgerCreatedAt,
  });
  const plan = {
    schemaVersion: "p13_provider_canary_plan/1.0.0",
    createdAt: new Date().toISOString(),
    projectId,
    projectRoot,
    projectFactHash,
    shotId,
    image: {
      providerId: "apikey-fun-gpt55-responses-image",
      model: "gpt-5.5",
      size: "1280x720",
      quality: "standard",
      maxSubmitCount: 1,
      automaticRetry: false,
      actionId: imageActionId,
      jobId: imageJobId,
      receiptId: imageReceiptId,
      prompt: imagePrompt,
    },
    video: {
      providerId: "jimeng-seedance",
      modelVersion: "seedance2.0_vip",
      videoResolution: "720p",
      ratio: "16:9",
      durationSeconds: 5,
      maxSubmitCount: 1,
      automaticRetry: false,
      actionId: videoActionId,
      confirmationId: videoConfirmationId,
      receiptId: videoReceiptId,
      prompt: videoPrompt,
    },
    gates: {
      seedanceRequiresValidImage2: true,
      returnedMediaStatus: "needs_review",
      autoApprove: false,
      autoPromote: false,
      autoDeliver: false,
      autoExport: false,
    },
  };
  await Promise.all([
    writeFile(projectPath, serializeProjectVibe(project), "utf8"),
    writeJson(ledgerPath, ledger),
    writeJson(planPath, plan, true),
  ]);
  console.log(JSON.stringify({ status: "prepared", planPath, projectRoot, projectFactHash }, null, 2));
  return plan;
}

async function runImageCanary() {
  assertCondition(authorization === authorizationPhrase, "P13 Image2 call requires the exact one-shot authorization phrase");
  const plan = await readJson<any>(planPath);
  assertCondition(!await pathExists(imageAttemptPath), "P13 Image2 attempt already exists; retry is forbidden");
  assertCondition(!await pathExists(imageReceiptPath), "P13 Image2 receipt already exists; retry is forbidden");
  const provider = getProviderConfigStatuses().find((item) => item.providerId === plan.image.providerId);
  const apiKey = getProviderApiKey(plan.image.providerId);
  assertCondition(provider?.credential.keyStatus === "configured" && apiKey, "P13 Image2 credential is not configured");
  assertCondition(provider.credential.secretDisplayed === false, "P13 Image2 credential status exposed a secret");
  await writeJson(imageAttemptPath, {
    schemaVersion: "p13_provider_image2_attempt/1.0.0",
    attemptedAt: new Date().toISOString(),
    projectId,
    projectRoot,
    projectFactHash: plan.projectFactHash,
    shotId,
    actionId: imageActionId,
    jobId: imageJobId,
    receiptId: imageReceiptId,
    endpoint: provider.baseUrl,
    model: provider.imageModel || plan.image.model,
    size: plan.image.size,
    quality: plan.image.quality,
    maxSubmitCount: 1,
    automaticRetry: false,
    fallbackEndpointDisabled: true,
    rawSecretStored: false,
  }, true);

  const result = await fetchApikeyFunImageViaResponses({
    apiKey,
    endpoint: provider.baseUrl,
    fallbackEndpoint: provider.baseUrl,
    model: provider.imageModel || plan.image.model,
    prompt: plan.image.prompt,
    size: plan.image.size,
    quality: plan.image.quality,
    stream: true,
    timeoutMs: 8 * 60 * 1000,
  });
  if (!result.ok) {
    const receipt = {
      schemaVersion: "p13_provider_image2_receipt/1.0.0",
      status: "failed",
      receivedAt: new Date().toISOString(),
      projectId,
      projectRoot,
      projectFactHash: plan.projectFactHash,
      shotId,
      actionId: imageActionId,
      jobId: imageJobId,
      receiptId: imageReceiptId,
      providerCalled: true,
      providerCallCount: 1,
      automaticRetry: false,
      errorType: result.errorType,
      statusCode: result.statusCode,
      message: result.message,
      outputPath: null,
      rawSecretStored: false,
    };
    await writeJson(imageReceiptPath, receipt, true);
    console.log(JSON.stringify(receipt, null, 2));
    throw new Error("P13 Image2 failed; Seedance must not be submitted");
  }

  await mkdir(dirname(imageOutputPath), { recursive: true });
  await writeFile(imageOutputPath, result.bytes, { flag: "wx" });
  const dimensions = pngDimensions(result.bytes);
  const aspectRatio = dimensions ? dimensions.width / dimensions.height : 0;
  const nearSixteenNine = Math.abs(aspectRatio - (16 / 9)) <= 0.01;
  const validForSeedance = Boolean(
    dimensions?.width === 1280
    && dimensions.height === 720
    && result.bytes.length > 10_000,
  );
  const receipt = {
    schemaVersion: "p13_provider_image2_receipt/1.0.0",
    status: validForSeedance ? "needs_review" : nearSixteenNine ? "normalization_required" : "invalid_return",
    receivedAt: new Date().toISOString(),
    projectId,
    projectRoot,
    projectFactHash: plan.projectFactHash,
    shotId,
    actionId: imageActionId,
    jobId: imageJobId,
    receiptId: imageReceiptId,
    providerId: result.providerId,
    requestedModel: result.requestedModel,
    returnedModel: result.returnedModel,
    providerRequestId: result.providerRequestId,
    providerCalled: true,
    providerCallCount: 1,
    automaticRetry: false,
    outputPath: relative(projectRoot, imageOutputPath),
    outputHash: sha256Bytes(result.bytes),
    outputBytes: result.bytes.length,
    dimensions,
    aspectRatio,
    nearSixteenNine,
    validForSeedance,
    reviewRequired: true,
    promoted: false,
    delivered: false,
    exported: false,
    transport: result.transport,
    metadata: result.metadata,
    rawSecretStored: false,
  };
  await writeJson(imageReceiptPath, receipt, true);
  console.log(JSON.stringify({
    status: receipt.status,
    outputPath: imageOutputPath,
    outputHash: receipt.outputHash,
    outputBytes: receipt.outputBytes,
    dimensions,
    providerRequestId: receipt.providerRequestId,
    providerCallCount: 1,
    automaticRetry: false,
  }, null, 2));
  assertCondition(validForSeedance, "P13 Image2 return is not a valid 1280x720 PNG; Seedance must not be submitted");
}

async function normalizeImageCanary() {
  const receipt = await readJson<any>(imageReceiptPath);
  assertCondition(receipt.providerCallCount === 1 && receipt.automaticRetry === false, "P13 Image2 receipt lost its one-shot boundary");
  assertCondition(["invalid_return", "normalization_required"].includes(receipt.status), `P13 Image2 does not require normalization: ${receipt.status}`);
  assertCondition(!await pathExists(imageNormalizedOutputPath), "P13 normalized Image2 candidate already exists");
  assertCondition(await sha256File(imageOutputPath) === receipt.outputHash, "P13 original Image2 output hash changed before normalization");
  const sourceBytes = await readFile(imageOutputPath);
  const sourceDimensions = pngDimensions(sourceBytes);
  const sourceAspectRatio = sourceDimensions ? sourceDimensions.width / sourceDimensions.height : 0;
  assertCondition(sourceBytes.length > 10_000, "P13 original Image2 output is empty");
  assertCondition(Math.abs(sourceAspectRatio - (16 / 9)) <= 0.01, "P13 original Image2 output is not safely normalizable to 16:9");
  const normalized = await runCommand("/usr/bin/sips", [
    "--resampleHeightWidth", "720", "1280",
    imageOutputPath,
    "--out", imageNormalizedOutputPath,
  ], 60_000);
  assertCondition(normalized.exitCode === 0 && await pathExists(imageNormalizedOutputPath), `P13 local image normalization failed: ${redact(normalized.stderr)}`);
  const normalizedBytes = await readFile(imageNormalizedOutputPath);
  const dimensions = pngDimensions(normalizedBytes);
  assertCondition(dimensions?.width === 1280 && dimensions.height === 720 && normalizedBytes.length > 10_000, "P13 local normalized candidate is not a valid 1280x720 PNG");
  const nextReceipt = {
    ...receipt,
    status: "needs_review",
    sourceOutputPath: receipt.outputPath,
    sourceOutputHash: receipt.outputHash,
    sourceOutputBytes: receipt.outputBytes,
    sourceDimensions,
    sourceAspectRatio,
    outputPath: relative(projectRoot, imageNormalizedOutputPath),
    outputHash: sha256Bytes(normalizedBytes),
    outputBytes: normalizedBytes.length,
    dimensions,
    aspectRatio: 16 / 9,
    nearSixteenNine: true,
    validForSeedance: true,
    localNormalization: {
      appliedAt: new Date().toISOString(),
      command: "sips --resampleHeightWidth 720 1280",
      providerCalled: false,
      preservesOriginal: true,
      stdout: redact(normalized.stdout),
      stderr: redact(normalized.stderr),
    },
  };
  await writeJson(imageReceiptPath, nextReceipt);
  console.log(JSON.stringify({
    status: nextReceipt.status,
    providerCallCount: nextReceipt.providerCallCount,
    automaticRetry: false,
    sourceOutputPath: nextReceipt.sourceOutputPath,
    sourceOutputHash: nextReceipt.sourceOutputHash,
    sourceDimensions,
    outputPath: nextReceipt.outputPath,
    outputHash: nextReceipt.outputHash,
    dimensions,
    localNormalizationProviderCalls: 0,
  }, null, 2));
}

async function stagedVideoJob(plan: any) {
  const imageReceipt = await readJson<any>(imageReceiptPath);
  assertCondition(imageReceipt.status === "needs_review" && imageReceipt.validForSeedance === true, "P13 Seedance requires one valid Image2 candidate");
  const imagePath = resolve(projectRoot, imageReceipt.outputPath);
  assertCondition(await assertProjectFile(imagePath), "P13 Image2 candidate escaped the project root");
  assertCondition(await sha256File(imagePath) === imageReceipt.outputHash, "P13 Image2 output hash changed before Seedance");
  const existing = await readJson<AgentVideoGenerationJobLedger>(ledgerPath);
  assertCondition(existing.jobs.length === 0, "P13 video ledger already contains a job");
  const pipelinePlan = buildAgentVideoPipelinePlan({
    planId: "p13_provider_canary_video_plan",
    generatedAt: new Date().toISOString(),
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: true,
    referenceMissingCount: 0,
    videoSubmitted: false,
  });
  const staged = planAgentVideoProductionAction({
    plan: pipelinePlan,
    ledger: existing,
    action: "submit_video",
    actionId: videoActionId,
    sourceConfirmationId: videoConfirmationId,
    generatedAt: new Date().toISOString(),
    executionMode: "live",
    prompt: `${plan.video.prompt}\nExecution specification: Seedance 2.0 VIP + 720p.`,
    inputAssets: [relative(projectRoot, imagePath)],
    outputAssets: [],
    registry: buildLiveSeedanceAgentVideoProviderCapabilityRegistry({
      modelVersion: plan.video.modelVersion,
      videoResolution: plan.video.videoResolution,
      generatedAt: new Date().toISOString(),
    }),
  });
  assertCondition(staged.status === "staged_job" && staged.job, `P13 video job did not stage: ${staged.blockers.join(" ")}`);
  const confirmed = transitionAgentVideoGenerationJob({
    ledger: staged.ledger,
    jobId: staged.job.jobId,
    status: "confirmed",
    generatedAt: new Date().toISOString(),
  });
  assertCondition(confirmed.ok && confirmed.job, `P13 video job did not confirm: ${confirmed.blockers.join(" ")}`);
  await writeJson(ledgerPath, confirmed.ledger);
  return { ledger: confirmed.ledger, job: confirmed.job, imagePath };
}

async function writeNeedsReviewPreview(input: { outputPath: string; outputHash: string; sourceReceiptId: string }) {
  const item = {
    id: "p13s01_seedance_vip_candidate",
    clipId: "p13s01_seedance_vip_candidate",
    order: 1,
    shotId,
    mediaType: "video",
    mediaPath: input.outputPath,
    sourceReceiptId: input.sourceReceiptId,
    providerReceiptId: input.sourceReceiptId,
    outputHash: input.outputHash,
    outputSha256: input.outputHash,
    durationSeconds: 5,
    status: "returned_with_review_overlay",
    videoStatus: "success",
    reviewRequired: true,
    outputExists: true,
  };
  await writeJson(previewPlanPath, {
    schemaVersion: "p13_provider_canary_preview/1.0.0",
    generatedAt: new Date().toISOString(),
    status: "needs_review",
    previewStatus: "returned_with_review_overlay",
    productionStatus: "needs_review",
    reviewShotIds: [shotId],
    totalDurationSeconds: 5,
    clips: [item],
    previewItems: [item],
  });
}

async function writeCanaryRelayQueue(input: {
  status: VideoRelayQueueItemStatus;
  externalTaskId: string;
  resumeCommand?: string;
  queueInfo?: Record<string, unknown>;
  outputPath?: string;
  outputHash?: string;
  attemptCount?: number;
}) {
  const imageReceipt = await readJson<any>(imageReceiptPath);
  const queue = buildVideoRelayQueueState({
    generatedAt: new Date().toISOString(),
    queueId: "p13_provider_canary_video_queue",
    storyboardConfirmed: true,
    items: [{
      id: "p13s01_seedance_vip_item",
      shotId,
      title: "空菜篮挡住晨光",
      status: input.status,
      modelVersion: "seedance2.0_vip",
      videoResolution: "720p",
      durationSeconds: 5,
      referencePaths: [imageReceipt.outputPath],
      submitId: input.externalTaskId,
      externalTaskId: input.externalTaskId,
      resumeCommand: input.resumeCommand,
      queueInfo: input.queueInfo,
      outputVideoPath: input.outputPath,
      outputVideoSha256: input.outputHash,
      localMediaPaths: input.outputPath ? [input.outputPath] : [],
      attemptCount: input.attemptCount || 0,
      blockers: [],
      notes: [
        "P13S01 single authorized Seedance 2.0 VIP canary.",
        "Returned media requires review and is not auto-promoted or delivered.",
      ],
    }],
  });
  await writeJson(relayQueuePath, queue);
}

async function recordReturnedVideo(input: {
  ledger: AgentVideoGenerationJobLedger;
  jobId: string;
  externalTaskId: string;
  mediaPath: string;
  projectFactHash: string;
}) {
  const outputPath = await assertProjectFile(input.mediaPath);
  const outputRelativePath = relative(await realpath(projectRoot), outputPath);
  const outputHash = await sha256File(outputPath);
  const sourceReceiptId = seedanceSourceReceiptId(input.externalTaskId);
  const result = recordAgentVideoGenerationJobReviewResult({
    ledger: input.ledger,
    jobId: input.jobId,
    result: {
      status: "needs_review",
      projectId,
      projectRoot,
      projectFactHash: input.projectFactHash,
      jobId: input.jobId,
      actionId: videoActionId,
      shotId,
      sourceReceiptId,
      outputPath,
      outputHash,
      receivedAt: new Date().toISOString(),
    },
  });
  assertCondition(result.ok && result.job?.reviewResult?.status === "needs_review", `P13 video result did not enter needs_review: ${result.blockers.join(" ")}`);
  await writeJson(ledgerPath, result.ledger);
  await writeJson(videoResultReceiptPath, {
    schemaVersion: "p13_provider_seedance_result_receipt/1.0.0",
    status: "needs_review",
    receivedAt: result.job.reviewResult.receivedAt,
    projectId,
    projectRoot,
    projectFactHash: input.projectFactHash,
    shotId,
    jobId: input.jobId,
    actionId: videoActionId,
    receiptId: sourceReceiptId,
    plannedReceiptId: videoReceiptId,
    sourceReceiptId,
    externalTaskId: input.externalTaskId,
    outputPath,
    outputRelativePath,
    outputHash,
    outputBytes: (await stat(outputPath)).size,
    reviewRequired: true,
    approved: false,
    promoted: false,
    delivered: false,
    exported: false,
  });
  await writeNeedsReviewPreview({ outputPath, outputHash, sourceReceiptId });
  const queryHistory = await readOptionalJson<any>(queryHistoryPath);
  await writeCanaryRelayQueue({
    status: "success",
    externalTaskId: input.externalTaskId,
    outputPath,
    outputHash,
    attemptCount: Array.isArray(queryHistory?.attempts) ? queryHistory.attempts.length : 0,
  });
  return { outputPath, outputRelativePath, outputHash, ledger: result.ledger };
}

async function runVideoCanary() {
  assertCondition(authorization === authorizationPhrase, "P13 Seedance submit requires the exact one-shot authorization phrase");
  const plan = await readJson<any>(planPath);
  assertCondition(!await pathExists(videoAttemptPath), "P13 Seedance submit attempt already exists; retry is forbidden");
  assertCondition(!await pathExists(videoSubmitReceiptPath), "P13 Seedance submit receipt already exists; retry is forbidden");
  const staged = await stagedVideoJob(plan);
  const commandPlan = buildJimengImage2VideoPlan({
    imagePath: staged.imagePath,
    prompt: plan.video.prompt,
    outputDir: videoReturnRoot,
    durationSeconds: 5,
    videoResolution: "720p",
    modelVersion: "seedance2.0_vip",
    shortPollSeconds: 90,
    pollIntervalSeconds: 60,
    queueWaitSeconds: 180,
    cliPath,
    firstFrameProtectionEnabled: true,
  });
  assertCondition(commandPlan.command === "image2video", "P13 Seedance canary must use one image2video submit");
  assertCondition(commandPlan.args.filter((item) => item === "image2video").length === 1, "P13 Seedance command contains multiple submits");
  assertCondition(commandPlan.args.filter((item) => item === "--image").length === 1, "P13 Seedance command must use exactly one Image2 candidate");
  assertCondition(commandPlan.modelVersion === "seedance2.0_vip" && commandPlan.videoResolution === "720p", "P13 Seedance specification drifted");
  await writeJson(videoPlanPath, {
    schemaVersion: "p13_provider_seedance_submit_plan/1.0.0",
    projectId,
    projectRoot,
    projectFactHash: plan.projectFactHash,
    shotId,
    jobId: staged.job.jobId,
    actionId: videoActionId,
    confirmationId: videoConfirmationId,
    receiptId: externalTaskId ? seedanceSourceReceiptId(externalTaskId) : videoReceiptId,
    plannedReceiptId: videoReceiptId,
    sourceReceiptId: externalTaskId ? seedanceSourceReceiptId(externalTaskId) : undefined,
    command: commandPlan.cliPath,
    args: commandPlan.args,
    ratio: "16:9 from validated 1280x720 Image2 input",
    maxSubmitCount: 1,
    automaticRetry: false,
    rawSecretStored: false,
  }, true);
  await writeJson(videoAttemptPath, {
    schemaVersion: "p13_provider_seedance_submit_attempt/1.0.0",
    attemptedAt: new Date().toISOString(),
    projectId,
    projectRoot,
    projectFactHash: plan.projectFactHash,
    shotId,
    jobId: staged.job.jobId,
    actionId: videoActionId,
    confirmationId: videoConfirmationId,
    receiptId: videoReceiptId,
    modelVersion: "seedance2.0_vip",
    videoResolution: "720p",
    ratio: "16:9",
    durationSeconds: 5,
    maxSubmitCount: 1,
    automaticRetry: false,
  }, true);

  const command = await runCommand(commandPlan.cliPath, commandPlan.args, 4 * 60 * 1000);
  const taskInfo = extractDreaminaTaskInfo(command.stdout, command.stderr);
  const externalTaskId = String(taskInfo.submitId || "").trim();
  const retainedMedia = await retainReturnedMedia(taskInfo.localMediaPaths);
  const normalizedStatus = retainedMedia ? "success" : normalizeDreaminaStatus(taskInfo.status);
  let ledger = staged.ledger;
  const running = transitionAgentVideoGenerationJob({
    ledger,
    jobId: staged.job.jobId,
    status: "running",
    generatedAt: new Date().toISOString(),
    providerCalled: true,
    externalTaskId: externalTaskId || undefined,
  });
  assertCondition(running.ok && running.job, `P13 Seedance job did not enter running: ${running.blockers.join(" ")}`);
  ledger = running.ledger;

  const terminalFailure = command.exitCode !== 0 && !externalTaskId && !retainedMedia;
  if (terminalFailure) {
    const failed = transitionAgentVideoGenerationJob({
      ledger,
      jobId: staged.job.jobId,
      status: "failed",
      generatedAt: new Date().toISOString(),
      providerCalled: true,
      error: redact(command.stderr || command.stdout) || "Seedance submit failed without task identity",
    });
    assertCondition(failed.ok, `P13 failed job did not persist: ${failed.blockers.join(" ")}`);
    ledger = failed.ledger;
  } else if (externalTaskId) {
    const updated = recordAgentVideoGenerationJobExecution({
      ledger,
      jobId: staged.job.jobId,
      generatedAt: new Date().toISOString(),
      providerCalled: true,
      externalTaskId,
    });
    assertCondition(updated.ok, `P13 Seedance task identity did not persist: ${updated.blockers.join(" ")}`);
    ledger = updated.ledger;
  }
  await writeJson(ledgerPath, ledger);

  const submitReceipt = {
    schemaVersion: "p13_provider_seedance_submit_receipt/1.0.0",
    status: terminalFailure ? "provider_terminal_failure" : !externalTaskId ? "identity_missing_or_ambiguous" : retainedMedia ? "returned_needs_review" : "submitted_query_only",
    receivedAt: new Date().toISOString(),
    projectId,
    projectRoot,
    projectFactHash: plan.projectFactHash,
    shotId,
    jobId: staged.job.jobId,
    actionId: videoActionId,
    confirmationId: videoConfirmationId,
    receiptId: videoReceiptId,
    providerId: "jimeng-seedance",
    modelVersion: "seedance2.0_vip",
    videoResolution: "720p",
    ratio: "16:9",
    durationSeconds: 5,
    providerCalled: true,
    providerSubmitCount: 1,
    automaticRetry: false,
    command: commandPlan.command,
    exitCode: command.exitCode,
    timedOut: command.timedOut,
    durationMs: command.durationMs,
    normalizedStatus,
    externalTaskId: externalTaskId || null,
    queueInfo: taskInfo.queueInfo,
    localMediaPath: retainedMedia ? relative(projectRoot, retainedMedia) : null,
    stdout: redact(command.stdout),
    stderr: redact(command.stderr),
    rawSecretStored: false,
  };
  await writeJson(videoSubmitReceiptPath, submitReceipt, true);
  if (externalTaskId) {
    const activeStatus: VideoRelayQueueItemStatus = ["submitted", "queued", "generating", "running", "polling", "recoverable_queued"].includes(normalizedStatus)
      ? normalizedStatus as VideoRelayQueueItemStatus
      : "submitted";
    await writeCanaryRelayQueue({
      status: retainedMedia ? "success" : activeStatus,
      externalTaskId,
      resumeCommand: retainedMedia ? undefined : jimengResumeCommand({ submitId: externalTaskId, downloadDir: videoReturnRoot, cliPath }),
      queueInfo: taskInfo.queueInfo,
      outputPath: retainedMedia,
      outputHash: retainedMedia ? await sha256File(retainedMedia) : undefined,
    });
  }
  if (retainedMedia && externalTaskId) {
    await recordReturnedVideo({
      ledger,
      jobId: staged.job.jobId,
      externalTaskId,
      mediaPath: retainedMedia,
      projectFactHash: plan.projectFactHash,
    });
  }
  console.log(JSON.stringify({
    status: submitReceipt.status,
    externalTaskId: submitReceipt.externalTaskId,
    normalizedStatus,
    providerSubmitCount: 1,
    automaticRetry: false,
    localMediaPath: submitReceipt.localMediaPath,
    receiptPath: videoSubmitReceiptPath,
  }, null, 2));
  assertCondition(!terminalFailure, "P13 Seedance returned a terminal failure; no retry is allowed");
  assertCondition(Boolean(externalTaskId), "P13 Seedance task identity is missing or ambiguous; no retry is allowed");
}

async function queryVideoCanary() {
  const plan = await readJson<any>(planPath);
  const submitReceipt = await readJson<any>(videoSubmitReceiptPath);
  assertCondition(submitReceipt.providerSubmitCount === 1, "P13 query requires exactly one prior submit");
  assertCondition(submitReceipt.automaticRetry === false, "P13 submit retry boundary changed");
  assertCondition(submitReceipt.status === "submitted_query_only", `P13 task is not queryable: ${submitReceipt.status}`);
  const externalTaskId = String(submitReceipt.externalTaskId || "").trim();
  assertCondition(Boolean(externalTaskId), "P13 query requires one exact externalTaskId");
  const history = await readOptionalJson<any>(queryHistoryPath) || {
    schemaVersion: "p13_provider_seedance_query_attempts/1.0.0",
    projectId,
    projectRoot,
    projectFactHash: plan.projectFactHash,
    shotId,
    externalTaskId,
    attempts: [],
  };
  assertCondition(history.externalTaskId === externalTaskId, "P13 query history belongs to a different task");
  const args = ["query_result", `--submit_id=${externalTaskId}`, `--download_dir=${videoReturnRoot}`];
  assertCondition(!args.includes("image2video") && !args.includes("multimodal2video"), "P13 query command contains a forbidden submit operation");
  const attempt = {
    attempt: history.attempts.length + 1,
    startedAt: new Date().toISOString(),
    command: cliPath,
    args,
  };
  history.attempts.push(attempt);
  await writeJson(queryHistoryPath, history);
  const command = await runCommand(cliPath, args, 2 * 60 * 1000);
  const taskInfo = extractDreaminaTaskInfo(command.stdout, command.stderr);
  const queriedId = String(taskInfo.submitId || externalTaskId).trim();
  assertCondition(queriedId === externalTaskId, "P13 query returned a different task identity");
  const retainedMedia = await retainReturnedMedia(taskInfo.localMediaPaths);
  const status = retainedMedia ? "success" : normalizeDreaminaStatus(taskInfo.status);
  Object.assign(attempt, {
    completedAt: new Date().toISOString(),
    exitCode: command.exitCode,
    timedOut: command.timedOut,
    durationMs: command.durationMs,
    providerCalled: true,
    status,
    queueInfo: taskInfo.queueInfo,
    localMediaPath: retainedMedia ? relative(projectRoot, retainedMedia) : null,
    stdout: redact(command.stdout),
    stderr: redact(command.stderr),
  });
  await writeJson(queryHistoryPath, history);
  let ledger = await readJson<AgentVideoGenerationJobLedger>(ledgerPath);
  const job = ledger.jobs.find((item) => item.executionMode === "live" && item.kind === "video_submit");
  assertCondition(job?.externalTaskId === externalTaskId, "P13 running job does not match the query task");
  if (retainedMedia) {
    const recorded = await recordReturnedVideo({
      ledger,
      jobId: job.jobId,
      externalTaskId,
      mediaPath: retainedMedia,
      projectFactHash: plan.projectFactHash,
    });
    ledger = recorded.ledger;
    submitReceipt.status = "returned_needs_review";
    submitReceipt.localMediaPath = recorded.outputPath;
    submitReceipt.localMediaRelativePath = recorded.outputRelativePath;
    submitReceipt.outputHash = recorded.outputHash;
    submitReceipt.updatedAt = new Date().toISOString();
    await writeJson(videoSubmitReceiptPath, submitReceipt);
  } else {
    const updated = recordAgentVideoGenerationJobExecution({
      ledger,
      jobId: job.jobId,
      generatedAt: new Date().toISOString(),
      providerCalled: true,
      externalTaskId,
      error: status === "failed" ? redact(command.stderr || command.stdout) : undefined,
    });
    assertCondition(updated.ok, `P13 query status did not persist: ${updated.blockers.join(" ")}`);
    ledger = updated.ledger;
    await writeJson(ledgerPath, ledger);
  }
  console.log(JSON.stringify({
    status: retainedMedia ? "needs_review" : status,
    externalTaskId,
    queryAttempt: attempt.attempt,
    localMediaPath: retainedMedia ? relative(projectRoot, retainedMedia) : null,
    providerSubmitCount: 1,
    automaticRetry: false,
  }, null, 2));
  assertCondition(status !== "failed", "P13 Seedance entered terminal failure; no retry is allowed");
}

async function ingestReturnedVideoLocally() {
  const plan = await readJson<any>(planPath);
  const submitReceipt = await readJson<any>(videoSubmitReceiptPath);
  const queryHistory = await readJson<any>(queryHistoryPath);
  assertCondition(submitReceipt.status === "submitted_query_only", `P13 local ingest requires a submitted task, got ${submitReceipt.status}`);
  assertCondition(submitReceipt.providerSubmitCount === 1 && submitReceipt.automaticRetry === false, "P13 local ingest lost the one-submit boundary");
  assertCondition(!await pathExists(videoResultReceiptPath), "P13 video result receipt already exists");
  const externalTaskId = String(submitReceipt.externalTaskId || "").trim();
  assertCondition(Boolean(externalTaskId) && queryHistory.externalTaskId === externalTaskId, "P13 local ingest task identity is missing or changed");
  const successfulQuery = [...(Array.isArray(queryHistory.attempts) ? queryHistory.attempts : [])]
    .reverse()
    .find((attempt: any) => attempt?.status === "success" && attempt?.localMediaPath);
  assertCondition(successfulQuery, "P13 local ingest requires an already downloaded successful query result");
  const mediaPath = resolve(projectRoot, successfulQuery.localMediaPath);
  assertCondition(await pathExists(mediaPath), "P13 locally returned media is missing");
  const ledger = await readJson<AgentVideoGenerationJobLedger>(ledgerPath);
  const job = ledger.jobs.find((item) => item.executionMode === "live" && item.kind === "video_submit");
  assertCondition(job?.status === "running" && job.externalTaskId === externalTaskId, "P13 running job does not match the local return");
  const recorded = await recordReturnedVideo({
    ledger,
    jobId: job.jobId,
    externalTaskId,
    mediaPath,
    projectFactHash: plan.projectFactHash,
  });
  submitReceipt.status = "returned_needs_review";
  submitReceipt.localMediaPath = recorded.outputPath;
  submitReceipt.localMediaRelativePath = recorded.outputRelativePath;
  submitReceipt.outputHash = recorded.outputHash;
  submitReceipt.updatedAt = new Date().toISOString();
  await writeJson(videoSubmitReceiptPath, submitReceipt);
  console.log(JSON.stringify({
    status: "needs_review",
    externalTaskId,
    outputPath: recorded.outputPath,
    outputRelativePath: recorded.outputRelativePath,
    outputHash: recorded.outputHash,
    providerSubmitCount: 1,
    additionalProviderCalls: 0,
    approved: false,
    promoted: false,
    delivered: false,
    exported: false,
  }, null, 2));
}

async function repairReturnedVideoPortablePaths() {
  const [resultReceipt, submitReceipt, queryHistory, ledger] = await Promise.all([
    readJson<any>(videoResultReceiptPath),
    readJson<any>(videoSubmitReceiptPath),
    readOptionalJson<any>(queryHistoryPath),
    readJson<AgentVideoGenerationJobLedger>(ledgerPath),
  ]);
  assertCondition(resultReceipt.status === "needs_review", "P13 portable-path repair requires a needs_review result");
  const outputPath = await assertProjectFile(resultReceipt.outputPath);
  const outputRelativePath = relative(await realpath(projectRoot), outputPath);
  assertCondition(outputRelativePath && !outputRelativePath.startsWith("..") && !isAbsolute(outputRelativePath), "P13 repaired media path is not portable");
  assertCondition(await sha256File(outputPath) === resultReceipt.outputHash, "P13 returned media hash changed before portable-path repair");
  const sourceReceiptId = seedanceSourceReceiptId(resultReceipt.externalTaskId);
  const repairedAt = new Date().toISOString();
  const repairedJobs = ledger.jobs.map((job) => job.jobId === resultReceipt.jobId && job.reviewResult
    ? {
        ...job,
        updatedAt: job.statusHistory[job.statusHistory.length - 1]?.at || job.updatedAt,
        reviewResult: {
          ...job.reviewResult,
          sourceReceiptId,
        },
      }
    : job);
  assertCondition(repairedJobs.some((job) => job.jobId === resultReceipt.jobId && job.reviewResult?.sourceReceiptId === sourceReceiptId), "P13 Review job identity could not be repaired");
  const repairedLedger: AgentVideoGenerationJobLedger = {
    ...ledger,
    createdAt: [ledger.createdAt, ...repairedJobs.map((job) => job.createdAt)].sort()[0] || ledger.createdAt,
    updatedAt: repairedAt,
    jobs: repairedJobs,
  };
  assertCondition(Date.parse(repairedLedger.updatedAt) >= Date.parse(repairedLedger.createdAt), "P13 repaired ledger chronology is invalid");
  resultReceipt.outputRelativePath = outputRelativePath;
  resultReceipt.plannedReceiptId = resultReceipt.plannedReceiptId || videoReceiptId;
  resultReceipt.receiptId = sourceReceiptId;
  resultReceipt.sourceReceiptId = sourceReceiptId;
  submitReceipt.localMediaRelativePath = outputRelativePath;
  submitReceipt.plannedReceiptId = submitReceipt.plannedReceiptId || videoReceiptId;
  submitReceipt.receiptId = sourceReceiptId;
  submitReceipt.sourceReceiptId = sourceReceiptId;
  await Promise.all([
    writeJson(videoResultReceiptPath, resultReceipt),
    writeJson(videoSubmitReceiptPath, submitReceipt),
    writeJson(ledgerPath, repairedLedger),
    writeNeedsReviewPreview({ outputPath, outputHash: resultReceipt.outputHash, sourceReceiptId }),
    writeCanaryRelayQueue({
      status: "success",
      externalTaskId: resultReceipt.externalTaskId,
      outputPath,
      outputHash: resultReceipt.outputHash,
      attemptCount: Array.isArray(queryHistory?.attempts) ? queryHistory.attempts.length : 0,
    }),
  ]);
  console.log(JSON.stringify({
    status: "repaired_local_portable_path",
    outputPath,
    outputRelativePath,
    outputHash: resultReceipt.outputHash,
    sourceReceiptId,
    providerCalls: 0,
  }, null, 2));
}

async function inspectPackagedNeedsReview() {
  const [plan, resultReceipt, ledger] = await Promise.all([
    readJson<any>(planPath),
    readJson<any>(videoResultReceiptPath),
    readJson<AgentVideoGenerationJobLedger>(ledgerPath),
  ]);
  assertCondition(resultReceipt.status === "needs_review", "P13 packaged inspection requires a needs_review result");
  const liveJobs = ledger.jobs.filter((job) => job.executionMode === "live" && job.kind === "video_submit");
  assertCondition(liveJobs.length === 1 && liveJobs[0]?.reviewResult?.status === "needs_review", "P13 packaged inspection requires one exact live Review job");
  await Promise.all([
    mkdir(packagedProfileRoot, { recursive: true }),
    mkdir(packagedRuntimeRoot, { recursive: true }),
    writeJson(packagedBindingPath, {
      projectRoot,
      projectRootRelativePath: projectRoot,
      projectVibeRelativePath: "project.vibe",
      projectId,
      displayName: "P13 Provider Canary",
    }),
  ]);
  let app: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>> | undefined;
  let lastObservation: any;
  try {
    app = await launchPackagedAcceptanceApp({
      appPath,
      executablePath,
      profileRoot: packagedProfileRoot,
      projectsRoot: join(root, "projects"),
      runtimeRoot: packagedRuntimeRoot,
      bindingPath: packagedBindingPath,
      extraEnv: { VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS: "1" },
    });
    await openVideoAcceptanceView(app.client);
    let observation: any;
    try {
      observation = await waitForAcceptance(async () => {
      const value = await observePackagedTask(app!.client) as any;
      const reviewControls = await app!.client.evaluate<any>(`(() => {
        const review = document.querySelector('[aria-label="当前视频复核"]');
        const buttons = [...(review?.querySelectorAll("button") || [])];
        const byText = (text) => buttons.find((button) => button.textContent?.trim() === text);
        const approve = byText("通过预览");
        const revise = byText("需要修改");
        return {
          reviewApprovalEnabled: Boolean(approve && !approve.disabled),
          reviewRevisionEnabled: Boolean(revise && !revise.disabled),
          reviewApprovalTitle: approve?.getAttribute("title") || "",
          reviewRevisionTitle: revise?.getAttribute("title") || "",
        };
      })()`);
      const observed = { ...value, ...reviewControls };
      lastObservation = observed;
      return observed.currentTaskCount === 1
        && observed.currentTaskStep === "submit_video"
        && observed.reviewTurnCount === 1
        && observed.reviewApprovalEnabled === true
        && observed.reviewRevisionEnabled === true
        && !String(observed.bodyText || "").includes("当前复核结果缺少回执或输出哈希")
        && String(observed.bodyText || "").includes("needs_review")
        && String(observed.bodyText || "").includes(shotId)
        ? observed
        : undefined;
      }, "P13 packaged App did not project one needs_review Review task", 60_000);
    } catch (error) {
      lastObservation = await observePackagedTask(app.client).catch(() => lastObservation);
      const screenshot = await app.client.send("capture_page").catch(() => undefined);
      if (screenshot) await writeFile(packagedScreenshotPath, Buffer.from(screenshot, "base64"));
      await writeJson(packagedObservationPath, {
        schemaVersion: "p13_provider_canary_packaged_observation/1.0.0",
        observedAt: new Date().toISOString(),
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
        projectId,
        projectRoot,
        projectFactHash: plan.projectFactHash,
        shotId,
        externalTaskId: resultReceipt.externalTaskId,
        outputPath: resultReceipt.outputPath,
        outputHash: resultReceipt.outputHash,
        providerCallsDuringPackagedInspection: 0,
        observation: lastObservation,
      });
      console.log(JSON.stringify({
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
        observation: lastObservation,
        observationPath: packagedObservationPath,
        screenshotPath: screenshot ? packagedScreenshotPath : null,
      }, null, 2));
      throw error;
    }
    assertCondition(Array.isArray(observation.enabledConfirmations) && observation.enabledConfirmations.length === 0, "P13 packaged Review exposed an unrelated confirmation");
    const screenshot = await app.client.send("capture_page");
    await writeFile(packagedScreenshotPath, Buffer.from(screenshot, "base64"));
    await writeJson(packagedObservationPath, {
      schemaVersion: "p13_provider_canary_packaged_observation/1.0.0",
      observedAt: new Date().toISOString(),
      status: "pass",
      projectId,
      projectRoot,
      projectFactHash: plan.projectFactHash,
      shotId,
      externalTaskId: resultReceipt.externalTaskId,
      outputPath: resultReceipt.outputPath,
      outputHash: resultReceipt.outputHash,
      providerCallsDuringPackagedInspection: 0,
      observation,
      gates: {
        reviewRequired: true,
        approved: false,
        promoted: false,
        delivered: false,
        exported: false,
      },
    });
    console.log(JSON.stringify({
      status: "pass",
      currentTaskStep: observation.currentTaskStep,
      currentTaskLabel: observation.currentTaskLabel,
      currentTaskCount: observation.currentTaskCount,
      reviewTurnCount: observation.reviewTurnCount,
      providerCallsDuringPackagedInspection: 0,
      observationPath: packagedObservationPath,
      screenshotPath: packagedScreenshotPath,
    }, null, 2));
  } finally {
    if (app) await closePackagedAcceptanceApp(app).catch(() => undefined);
  }
}

async function inspectCanary() {
  const [plan, imageAttempt, imageReceipt, videoAttempt, videoSubmit, videoResult, queryHistory, ledger] = await Promise.all([
    readOptionalJson<any>(planPath),
    readOptionalJson<any>(imageAttemptPath),
    readOptionalJson<any>(imageReceiptPath),
    readOptionalJson<any>(videoAttemptPath),
    readOptionalJson<any>(videoSubmitReceiptPath),
    readOptionalJson<any>(videoResultReceiptPath),
    readOptionalJson<any>(queryHistoryPath),
    readOptionalJson<AgentVideoGenerationJobLedger>(ledgerPath),
  ]);
  const liveJobs = ledger?.jobs.filter((job) => job.executionMode === "live") || [];
  const observation = {
    schemaVersion: "p13_provider_canary_inspection/1.0.0",
    inspectedAt: new Date().toISOString(),
    projectRoot,
    projectId,
    projectFactHash: plan?.projectFactHash,
    shotId,
    image: {
      attemptCount: imageAttempt ? 1 : 0,
      status: imageReceipt?.status || (imageAttempt ? "attempted_without_receipt" : "not_started"),
      outputPath: imageReceipt?.outputPath,
      outputHash: imageReceipt?.outputHash,
      sourceOutputPath: imageReceipt?.sourceOutputPath,
      sourceOutputHash: imageReceipt?.sourceOutputHash,
      dimensions: imageReceipt?.dimensions,
      localNormalization: imageReceipt?.localNormalization,
      providerCallCount: imageReceipt?.providerCallCount || 0,
      automaticRetry: false,
    },
    video: {
      submitAttemptCount: videoAttempt ? 1 : 0,
      status: videoResult?.status || videoSubmit?.status || (videoAttempt ? "attempted_without_receipt" : "not_started"),
      externalTaskId: videoSubmit?.externalTaskId,
      outputPath: videoResult?.outputPath,
      outputHash: videoResult?.outputHash,
      providerSubmitCount: videoSubmit?.providerSubmitCount || 0,
      queryAttemptCount: Array.isArray(queryHistory?.attempts) ? queryHistory.attempts.length : 0,
      automaticRetry: false,
    },
    liveJobs: liveJobs.map((job) => ({
      jobId: job.jobId,
      actionId: job.actionId,
      sourceConfirmationId: job.sourceConfirmationId,
      status: job.status,
      providerId: job.providerId,
      modelId: job.modelId,
      providerCalled: job.providerCalled,
      externalTaskId: job.externalTaskId,
      reviewStatus: job.reviewResult?.status,
      outputPath: job.reviewResult?.outputPath,
      outputHash: job.reviewResult?.outputHash,
    })),
    gates: {
      reviewRequired: true,
      approved: false,
      promoted: false,
      delivered: false,
      exported: false,
    },
  };
  await writeJson(inspectionPath, observation);
  console.log(JSON.stringify(observation, null, 2));
}

assertCondition(supportedModes.has(mode), `Unsupported P13 canary mode: ${mode}`);
if (mode === "prepare") await createFixture();
if (mode === "image") await runImageCanary();
if (mode === "normalize-image") await normalizeImageCanary();
if (mode === "video") await runVideoCanary();
if (mode === "query") await queryVideoCanary();
if (mode === "ingest-return") await ingestReturnedVideoLocally();
if (mode === "repair-paths") await repairReturnedVideoPortablePaths();
if (mode === "packaged") await inspectPackagedNeedsReview();
if (mode === "inspect") await inspectCanary();
