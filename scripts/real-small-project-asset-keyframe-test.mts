import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { buildImage2CleanBasePrompt } from "../src/core/image2PromptBase.ts";
import { IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO, IMAGE2_GENERATE_DEFAULT_SIZE } from "../src/core/providerPolicy.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type ImageOutput = {
  id: string;
  kind: "character_asset" | "scene_asset" | "prop_asset" | "start_frame" | "end_frame" | "preview_video";
  status: "success" | "failure" | "skipped";
  elapsedMs?: number;
  prompt?: string;
  outputPath?: string;
  outputSha256?: string;
  format?: "png" | "jpeg" | "webp" | "mp4" | "unknown";
  dimensions?: string;
  failureKind?: string;
  errorMessage?: string;
  providerRequestId?: string;
  route?: "direct_image_generate" | "current_project_p6_real_image2" | "current_project_image2_end_frame" | "direct_image_edit" | "local_silent_video_export";
  notes?: string[];
};

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 90) || "item";
}

function sha256(buffer: Buffer | string): string {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function imageFormat(buffer: Buffer): ImageOutput["format"] {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "unknown";
}

function fileDimensions(filePath: string): string | undefined {
  try {
    const output = Buffer.from(readFileSync(filePath)).subarray(0, 24);
    if (output.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return `${output.readUInt32BE(16)}x${output.readUInt32BE(20)}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function redact(value: unknown): string {
  return String(value || "")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-REDACTED")
    .slice(0, 600);
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function repoRelative(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

async function generateImage(input: {
  id: string;
  kind: ImageOutput["kind"];
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  outputPath: string;
  size: string;
  timeoutMs: number;
}): Promise<ImageOutput> {
  const started = performance.now();
  const prompt = buildImage2CleanBasePrompt({
    sourcePrompt: input.prompt,
    frameRole: input.kind,
    aspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  });
  try {
    const providerResult = await fetchLanyiImageViaResponsesStream({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      prompt,
      size: input.size,
      timeoutMs: input.timeoutMs,
      providerOperation: "responses.image_generation",
    });
    if (providerResult.rawSseBytes?.length) {
      await mkdir(path.dirname(input.outputPath), { recursive: true });
      await writeFile(input.outputPath.replace(/\.[^.]+$/, ".sse.txt"), providerResult.rawSseBytes);
    }
    if (!providerResult.ok) {
      return {
        id: input.id,
        kind: input.kind,
        status: "failure",
        route: "direct_image_generate",
        elapsedMs: Math.round(performance.now() - started),
        prompt,
        failureKind: providerResult.failureKind || providerResult.errorType || "provider_missing",
        errorMessage: redact(providerResult.message || providerResult.diagnostic?.message || "Provider did not return a usable image payload."),
        notes: [
          "transport=responses_stream",
          `eventCounts=${JSON.stringify(providerResult.providerResponseMetadata?.eventCounts || {})}`,
        ],
      };
    }
    await mkdir(path.dirname(input.outputPath), { recursive: true });
    await writeFile(input.outputPath, providerResult.bytes);
    return {
      id: input.id,
      kind: input.kind,
      status: "success",
      route: "direct_image_generate",
      elapsedMs: Math.round(performance.now() - started),
      prompt,
      outputPath: input.outputPath,
      outputSha256: sha256(providerResult.bytes),
      format: imageFormat(providerResult.bytes),
      dimensions: fileDimensions(input.outputPath),
      providerRequestId: providerResult.providerRequestId,
      notes: [
        "transport=responses_stream",
        `firstChunkMs=${providerResult.providerResponseMetadata?.firstChunkMs ?? ""}`,
        `keepalive=${providerResult.providerResponseMetadata?.eventCounts?.keepalive || 0}`,
      ],
    };
  } catch (error) {
    return {
      id: input.id,
      kind: input.kind,
      status: "failure",
      route: "direct_image_generate",
      elapsedMs: Math.round(performance.now() - started),
      prompt,
      failureKind: "network_error",
      errorMessage: redact(error instanceof Error ? error.message : error),
    };
  }
}

async function editImage(input: {
  id: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  referencePath: string;
  outputPath: string;
  size: string;
  timeoutMs: number;
}): Promise<ImageOutput> {
  const started = performance.now();
  const referenceBuffer = await readFile(input.referencePath);
  const prompt = buildImage2CleanBasePrompt({
    sourcePrompt: input.prompt,
    frameRole: "end_frame_from_start_frame",
    aspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  });
  try {
    const providerResult = await fetchLanyiImageViaResponsesStream({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      prompt,
      size: input.size,
      timeoutMs: input.timeoutMs,
      referenceImages: [{
        name: path.basename(input.referencePath),
        path: input.referencePath,
        mimeType: "image/png",
        bytes: referenceBuffer,
      }],
      providerOperation: "responses.image_generation_reference",
    });
    if (providerResult.rawSseBytes?.length) {
      await mkdir(path.dirname(input.outputPath), { recursive: true });
      await writeFile(input.outputPath.replace(/\.[^.]+$/, ".sse.txt"), providerResult.rawSseBytes);
    }
    if (!providerResult.ok) {
      return {
        id: input.id,
        kind: "end_frame",
        status: "failure",
        route: "direct_image_edit",
        elapsedMs: Math.round(performance.now() - started),
        prompt,
        failureKind: providerResult.failureKind || providerResult.errorType || "provider_missing",
        errorMessage: redact(providerResult.message || providerResult.diagnostic?.message || "Provider did not return a usable image payload."),
        notes: [`referenceSha256=${sha256(referenceBuffer)}`, "transport=responses_stream"],
      };
    }
    await mkdir(path.dirname(input.outputPath), { recursive: true });
    await writeFile(input.outputPath, providerResult.bytes);
    return {
      id: input.id,
      kind: "end_frame",
      status: "success",
      route: "direct_image_edit",
      elapsedMs: Math.round(performance.now() - started),
      prompt,
      outputPath: input.outputPath,
      outputSha256: sha256(providerResult.bytes),
      format: imageFormat(providerResult.bytes),
      dimensions: fileDimensions(input.outputPath),
      providerRequestId: providerResult.providerRequestId,
      notes: [
        `referenceSha256=${sha256(referenceBuffer)}`,
        "transport=responses_stream",
        `firstChunkMs=${providerResult.providerResponseMetadata?.firstChunkMs ?? ""}`,
        `keepalive=${providerResult.providerResponseMetadata?.eventCounts?.keepalive || 0}`,
      ],
    };
  } catch (error) {
    return {
      id: input.id,
      kind: "end_frame",
      status: "failure",
      route: "direct_image_edit",
      elapsedMs: Math.round(performance.now() - started),
      prompt,
      failureKind: "network_error",
      errorMessage: redact(error instanceof Error ? error.message : error),
      notes: [`referenceSha256=${sha256(referenceBuffer)}`],
    };
  }
}

function ffmpegPath(): string | undefined {
  const configured = process.env.FFMPEG_PATH;
  if (configured && existsSync(configured)) return configured;
  for (const candidate of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"]) {
    if (candidate === "ffmpeg" || existsSync(candidate)) return candidate;
  }
  return undefined;
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function renderSilentKeyframeVideo(input: {
  id: string;
  startPath: string;
  endPath: string;
  outputPath: string;
  timeoutMs: number;
}): Promise<ImageOutput> {
  const started = performance.now();
  const ffmpeg = ffmpegPath();
  if (!ffmpeg) {
    return {
      id: input.id,
      kind: "preview_video",
      status: "skipped",
      route: "local_silent_video_export",
      failureKind: "ffmpeg_missing",
      errorMessage: "ffmpeg is not available, so the silent preview video was skipped.",
    };
  }
  try {
    await mkdir(path.dirname(input.outputPath), { recursive: true });
    const args = [
      "-y",
      "-loop", "1",
      "-t", "2.2",
      "-i", input.startPath,
      "-loop", "1",
      "-t", "2.2",
      "-i", input.endPath,
      "-filter_complex",
      "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];[v0][v1]xfade=transition=fade:duration=0.35:offset=1.85,format=yuv420p[v]",
      "-map", "[v]",
      "-r", "24",
      "-an",
      "-movflags", "+faststart",
      input.outputPath,
    ];
    const result = await runProcess(ffmpeg, args, Math.max(30_000, input.timeoutMs));
    if (result.code !== 0) {
      return {
        id: input.id,
        kind: "preview_video",
        status: "failure",
        route: "local_silent_video_export",
        elapsedMs: Math.round(performance.now() - started),
        failureKind: "ffmpeg_failed",
        errorMessage: redact(result.stderr || result.stdout || `ffmpeg exited with ${result.code}`),
      };
    }
    const bytes = readFileSync(input.outputPath);
    return {
      id: input.id,
      kind: "preview_video",
      status: "success",
      route: "local_silent_video_export",
      elapsedMs: Math.round(performance.now() - started),
      outputPath: input.outputPath,
      outputSha256: sha256(bytes),
      format: "mp4",
      dimensions: "1280x720",
      notes: [
        `sourceStartSha256=${sha256(readFileSync(input.startPath))}`,
        `sourceEndSha256=${sha256(readFileSync(input.endPath))}`,
        "silent_preview_video_no_audio_tts",
      ],
    };
  } catch (error) {
    return {
      id: input.id,
      kind: "preview_video",
      status: "failure",
      route: "local_silent_video_export",
      elapsedMs: Math.round(performance.now() - started),
      failureKind: "video_render_error",
      errorMessage: redact(error instanceof Error ? error.message : error),
    };
  }
}

function waitForServer(child: ChildProcessWithoutNullStreams): Promise<{ baseUrl: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`)), 15000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
          return;
        } catch {
          // wait for a complete JSON line
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function stopServer(child?: ChildProcessWithoutNullStreams) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
  });
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

function createRuntimeProject(input: {
  fixtureRoot: string;
  runId: string;
  assetResults: ImageOutput[];
  endpointEndFrame: boolean;
}) {
  const shotId = "MSP01";
  const projectId = "mist_signal_asset_keyframe_test";
  const character = input.assetResults.find((item) => item.id === "asset_character");
  const scene = input.assetResults.find((item) => item.id === "asset_scene");
  const prop = input.assetResults.find((item) => item.id === "asset_prop");
  const stylePath = `${input.fixtureRoot}/assets/locked/style_clean_cinematic.md`;
  const promptPath = `${input.fixtureRoot}/prompt_requests/${shotId}_start_frame_prompt.md`;
  const expectedOutputPath = `${input.fixtureRoot}/outputs/shots/${shotId}/start.png`;
  const characterPath = repoRelative(character?.outputPath);
  const scenePath = repoRelative(scene?.outputPath);
  const propPath = repoRelative(prop?.outputPath);
  const stylePathRef = repoRelative(stylePath);
  const promptPathRef = repoRelative(promptPath);
  const expectedOutputPathRef = repoRelative(expectedOutputPath);
  const projectVibePathRef = repoRelative(`${input.fixtureRoot}/project/project.vibe`);
  const storyFlowPathRef = repoRelative(`${input.fixtureRoot}/project/story_flow.json`);
  const visualMemoryPathRef = repoRelative(`${input.fixtureRoot}/project/visual_memory.json`);
  const runManifestPathRef = repoRelative(`${input.fixtureRoot}/run_manifest.json`);

  writeJson(`${input.fixtureRoot}/project/project.vibe`, {
    schemaVersion: "real_small_project_asset_keyframe_project_vibe_v1",
    projectId,
    runId: input.runId,
    title: "雾灯邮差",
  });
  writeJson(`${input.fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "real_small_project_asset_keyframe_story_flow_v1",
    sections: [{ id: "act_1", label: "雾灯站台", shotIds: [shotId] }],
    shots: [{
      id: shotId,
      title: "雾灯亮起",
      sectionId: "act_1",
      sceneId: "scene_tram_stop",
      roleIds: ["char_mira"],
      propIds: ["prop_compass_locket"],
      videoControlMode: input.endpointEndFrame ? "first_last_endpoint" : "first_frame_default",
      storyFunction: "Mira discovers the compass locket can wake the fog lamp: the start frame is staged at arm's reach with the open locket just below the dark lamp glass; the end frame lifts the wrist a few centimeters so the locket touches the lamp glass, the lamp turns warm amber, and Mira's gaze tilts up to the light.",
      motionIntent: "Small object interaction, not a static hold: hand and wrist lift the compass locket a short distance toward the lamp, head and eye-line tilt upward, the lamp changes from dark to lit. Feet, coat, bag, camera angle, and tram stop layout stay stable.",
      startPose: "Medium close shot at arm's reach. Mira stands beside the unlit fog lamp with the open compass locket held just below the lamp glass, wrist relaxed, before the action completes.",
      endEndpoint: "Same camera and scene. Mira's hand and wrist lift a few centimeters, the open compass locket touches or nearly touches the lamp glass, her head is slightly tilted toward the lamp, and the fog lamp is visibly lit warm amber.",
      endFrameIntent: "Show the completed physical endpoint of the object interaction while preserving identity and scene continuity.",
      motionEndpointContract: {
        motionType: "object_interaction",
        requiredVisibleDelta: [
          "compass locket moves a short distance from just below the lamp glass to touching or nearly touching it",
          "Mira's wrist and hand are raised a few centimeters",
          "Mira's gaze/head angle turns upward",
          "fog lamp changes from dark to warm glowing",
        ],
        protectedRegions: ["face identity", "teal raincoat", "shoulder bag", "tram stop layout", "camera angle"],
        editableRegions: ["right hand", "wrist", "compass locket", "lamp glow"],
        forbiddenDelta: ["walking", "new character", "camera cut", "new prop", "costume change"],
      },
      order: 1,
      generationScope: { startFrame: true, endFrame: input.endpointEndFrame },
    }],
  });
  writeJson(`${input.fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "real_small_project_asset_keyframe_visual_memory_v1",
    roles: [{
      id: "char_mira",
      displayName: "Mira",
      status: "locked",
      path: characterPath,
      usedByShotIds: [shotId],
    }],
    scenes: [{
      id: "scene_tram_stop",
      displayName: "Fog Tram Stop",
      status: "locked",
      path: scenePath,
      usedByShotIds: [shotId],
    }],
    props: [{
      id: "prop_compass_locket",
      displayName: "Compass Locket",
      status: "locked",
      path: propPath,
      usedByShotIds: [shotId],
    }],
    style: {
      id: "style_clean_cinematic",
      displayName: "Clean cinematic still",
      status: "locked",
      path: stylePathRef,
      positive: "clean readable cinematic 2D frame, restrained detail, limited palette",
      negative: "no text, no logos, no extra characters, no decorative clutter",
    },
  });
  writeJson(`${input.fixtureRoot}/project/source_index.json`, {
    schemaVersion: "real_small_project_asset_keyframe_source_index_v1",
    refs: [
      projectVibePathRef,
      storyFlowPathRef,
      visualMemoryPathRef,
      runManifestPathRef,
      characterPath,
      scenePath,
      propPath,
    ].filter(Boolean),
  });
  writeText(stylePath, "Locked style: clean readable cinematic stills, restrained detail, no text overlays.\n");
  writeText(promptPath, [
    "16:9 start frame, medium close shot. Mira, the night courier in a teal raincoat, stands beside an unlit fog lamp at an abandoned hillside tram stop after rain.",
    "Stage the action at arm's reach: her right hand holds the open brass compass locket just below the dark lamp glass, wrist relaxed, before she lifts it.",
    "The locket, hand, and lamp must all be clearly visible in the same part of the frame so the end frame can show a short wrist lift and the lamp turning on.",
    "Clean readable composition, one clear focal action, limited teal and amber palette, no text or extra characters.",
  ].join(" "));
  writeJson(`${input.fixtureRoot}/run_manifest.json`, {
    schemaVersion: "real_small_project_asset_keyframe_manifest_v1",
    projectId,
    runId: input.runId,
    shotPlans: [{
      shotId,
      order: 1,
      providerId: "lanyi-image2",
      providerSlot: "image.generate",
      requiredMode: "text2image",
      frameRole: "start_frame",
      expectedOutputPath: expectedOutputPathRef,
      promptPath: promptPathRef,
      referenceAssetPaths: [characterPath, scenePath, propPath].filter(Boolean),
      status: "prepared_for_submit_permission_receipt",
    }],
  });
  return { projectId, shotId, promptPath, expectedOutputPath };
}

function writeProjectAndExportPackage(input: {
  fixtureRoot: string;
  runId: string;
  projectId: string;
  shotId: string;
  endpointEndFrame: boolean;
  assetResults: ImageOutput[];
  startResult: ImageOutput;
  endResult: ImageOutput;
  videoResult: ImageOutput;
  reportPath: string;
}) {
  const generatedAt = new Date().toISOString();
  const storyFlowPath = `${input.fixtureRoot}/project/story_flow.json`;
  const storyFlow = readJson(storyFlowPath);
  const startFrame = repoRelative(input.startResult.outputPath);
  const endFrame = input.endpointEndFrame ? repoRelative(input.endResult.outputPath) : undefined;
  const videoPath = repoRelative(input.videoResult.outputPath);
  if (Array.isArray(storyFlow.shots)) {
    storyFlow.shots = storyFlow.shots.map((shot: any) => shot?.id === input.shotId
      ? {
          ...shot,
          startFrame,
          ...(endFrame ? { endFrame } : {}),
          videoPath: input.videoResult.status === "success" ? videoPath : shot.videoPath,
          status: input.endpointEndFrame
            ? input.startResult.status === "success" && input.endResult.status === "success" ? "keyframe_pair_needs_review" : shot.status
            : input.startResult.status === "success" ? "start_frame_needs_review" : shot.status,
        }
      : shot);
  }
  writeJson(storyFlowPath, storyFlow);

  const projectVibePath = `${input.fixtureRoot}/project/project.vibe`;
  const projectVibe = readJson(projectVibePath);
  writeJson(`${input.fixtureRoot}/project/keyframe_pairs.json`, {
    schemaVersion: "real_small_project_asset_keyframe_pairs_v1",
    generatedAt,
    shotId: input.shotId,
    videoControlMode: input.endpointEndFrame ? "first_last_endpoint" : "first_frame_default",
    endFrameRequired: input.endpointEndFrame,
    startFrame,
    ...(endFrame ? { endFrame } : {}),
    videoPath: input.videoResult.status === "success" ? videoPath : undefined,
    endFrameDerivationSource: input.endpointEndFrame ? "approved_start_frame" : "not_required",
    status: input.endpointEndFrame
      ? input.startResult.status === "success" && input.endResult.status === "success" ? "needs_review" : "missing"
      : input.startResult.status === "success" ? "first_frame_needs_review" : "missing",
    promotionAllowed: false,
    notes: [
      input.endpointEndFrame
        ? "End frame was generated with Image2 image.edit from the returned start frame."
        : "Default video control skips end-frame generation; the start frame is the video anchor.",
      "The generated video is a silent preview export only; audio/TTS is intentionally excluded in this round.",
    ],
  });
  writeJson(`${input.fixtureRoot}/exports/Project.vibe`, projectVibe);
  const lockedAssets = input.assetResults
    .filter((asset) => asset.status === "success" && asset.outputPath)
    .map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      path: repoRelative(asset.outputPath),
      sha256: asset.outputSha256,
      dimensions: asset.dimensions,
    }));
  const previewMedia = [input.startResult, input.endResult, input.videoResult]
    .filter((item) => item.status === "success" && item.outputPath)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      shotId: input.shotId,
      path: repoRelative(item.outputPath),
      sha256: item.outputSha256,
      format: item.format,
      dimensions: item.dimensions,
    }));
  writeJson(`${input.fixtureRoot}/exports/export_package_manifest.json`, {
    schemaVersion: "real_small_project_export_package_v1",
    generatedAt,
    projectId: input.projectId,
    runId: input.runId,
    shotId: input.shotId,
    projectVibe: repoRelative(projectVibePath),
    exportedProjectVibe: repoRelative(`${input.fixtureRoot}/exports/Project.vibe`),
    lockedAssets,
    previewMedia,
    video: input.videoResult.status === "success"
      ? {
          path: repoRelative(input.videoResult.outputPath),
          sha256: input.videoResult.outputSha256,
          format: input.videoResult.format,
          audioIncluded: false,
          ttsIncluded: false,
        }
      : undefined,
    receiptsAndReports: [
      repoRelative(input.reportPath),
      repoRelative(`${input.fixtureRoot}/project/keyframe_pairs.json`),
    ].filter(Boolean),
    rawCredentialMaterialIncluded: false,
    notes: [
      input.endpointEndFrame
        ? "This package includes the silent preview video file generated from explicit start/end endpoint frames."
        : "This package includes first-frame preview media; video-provider generation is not run by the default start-frame test.",
      "Audio and TTS assets are intentionally out of scope for this test package.",
    ],
  });
}

async function runP6StartFrame(input: {
  fixtureRoot: string;
  projectId: string;
  shotId: string;
  apiKey: string;
}): Promise<ImageOutput> {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-small-project-real-"));
  const bindingPath = path.join(tempRoot, "current-project.local.json");
  const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: tempRoot,
      VIBE_IMAGE2_API_KEY: input.apiKey,
      VIBE_IMAGE2_PROVIDER_TIMEOUT_MS: process.env.VIBE_IMAGE2_PROVIDER_TIMEOUT_MS || "900000",
      VIBE_CORE_RUNTIME_API_PORT: "0",
      VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const started = performance.now();
  try {
    const { baseUrl } = await waitForServer(child);
    const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectRoot: input.fixtureRoot, projectId: input.projectId, displayName: "雾灯邮差" }),
    });
    if (select.response.status !== 200) throw new Error(`project select failed: ${JSON.stringify(select.payload)}`);

    const prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedShotId: input.shotId, selectedShotIds: [input.shotId], imageCount: 1, transportMode: "agent_app_server" }),
    });
    if (prepare.response.status !== 200 || prepare.payload.status !== "prepared") throw new Error(`prepare failed: ${JSON.stringify(prepare.payload)}`);

    const confirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: input.shotId,
        selectedShotIds: [input.shotId],
        imageCount: 1,
        expectedOutputPath: prepare.payload.expectedOutputPath,
        receipt: prepare.payload.receipt,
      }),
    });
    if (confirm.response.status !== 200 || confirm.payload.status !== "handoff_prepared") throw new Error(`confirm failed: ${JSON.stringify(confirm.payload)}`);

    const permission = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare-trigger`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: input.shotId,
        selectedShotIds: [input.shotId],
        imageCount: 1,
        expectedOutputPath: confirm.payload.expectedOutputPath,
        receiptId: confirm.payload.receipt.receiptId,
        transportMode: "agent_app_server",
        submitPermissionReceiptRequired: true,
        credentialRef: "secret-store://providers/lanyi-image2/default",
        maxProviderCallsPerReceipt: 1,
        actionTimeConfirmation: { required: true, userConfirmedAtActionTime: false },
      }),
    });
    if (permission.response.status !== 200 || permission.payload.status !== "trigger_plan_prepared") throw new Error(`permission failed: ${JSON.stringify(permission.payload)}`);

    const submit = await fetchJson(`${baseUrl}/api/runtime/projects/current/p6-real-image2/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: input.shotId,
        selectedShotIds: [input.shotId],
        imageCount: 1,
        receipt: permission.payload.receipt,
        submitPermissionReceipt: permission.payload.submitPermissionReceipt,
        providerId: "lanyi-image2",
        confirmation: {
          receiptId: `confirm_${input.shotId}_${Date.now()}`,
          confirmedAt: new Date().toISOString(),
          phrase: "submit-p6-image2",
          confirmed: true,
        },
      }),
    });
    if (submit.response.status !== 200 || submit.payload?.p6Ingest?.summary?.needsReview !== 1) {
      throw new Error(`submit failed: ${JSON.stringify(submit.payload)}`);
    }
    const outputPath = submit.payload.outputPath || submit.payload.expectedOutputPath || submit.payload.previewProjection?.mediaPath || `${input.fixtureRoot}/real-trigger-one-shot/${input.shotId}/image2-start.png`;
    const bytes = readFileSync(outputPath);
    return {
      id: "shot_start_frame",
      kind: "start_frame",
      status: "success",
      route: "current_project_p6_real_image2",
      elapsedMs: Math.round(performance.now() - started),
      prompt: submit.payload.plan?.prompt,
      outputPath,
      outputSha256: sha256(bytes),
      format: imageFormat(bytes),
      dimensions: fileDimensions(outputPath),
      providerRequestId: submit.payload.providerObservation?.providerRequestId,
      notes: [
        `uiStatus=${submit.payload.uiStatus}`,
        `providerOperation=${submit.payload.providerOperation || "unknown"}`,
        `referenceVisualInputCount=${submit.payload.referenceVisualInputCount ?? 0}`,
        `promotionAllowed=${submit.payload.summary?.promotionAllowed === true}`,
      ],
    };
  } catch (error) {
    return {
      id: "shot_start_frame",
      kind: "start_frame",
      status: "failure",
      route: "current_project_p6_real_image2",
      elapsedMs: Math.round(performance.now() - started),
      failureKind: "runtime_or_provider_failure",
      errorMessage: redact(error instanceof Error ? error.message : error),
    };
  } finally {
    await stopServer(child);
  }
}

async function runImage2EndFrame(input: {
  fixtureRoot: string;
  projectId: string;
  shotId: string;
  apiKey: string;
}): Promise<ImageOutput> {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-small-project-end-frame-"));
  const bindingPath = path.join(tempRoot, "current-project.local.json");
  const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: tempRoot,
      VIBE_IMAGE2_API_KEY: input.apiKey,
      VIBE_IMAGE2_PROVIDER_TIMEOUT_MS: process.env.VIBE_IMAGE2_PROVIDER_TIMEOUT_MS || "900000",
      VIBE_CORE_RUNTIME_API_PORT: "0",
      VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const started = performance.now();
  try {
    const { baseUrl } = await waitForServer(child);
    const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectRoot: input.fixtureRoot, projectId: input.projectId, displayName: "雾灯邮差" }),
    });
    if (select.response.status !== 200) throw new Error(`project select failed: ${JSON.stringify(select.payload)}`);

    const submit = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-end-frame/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: input.shotId,
        selectedShotIds: [input.shotId],
        providerId: "lanyi-image2",
        confirmation: {
          receiptId: `confirm_end_${input.shotId}_${Date.now()}`,
          confirmedAt: new Date().toISOString(),
          phrase: "generate-image2-end-frame",
          confirmed: true,
        },
      }),
    });
    if (submit.response.status !== 200 || submit.payload?.status !== "needs_review") {
      throw new Error(`end frame submit failed: ${JSON.stringify(submit.payload)}`);
    }
    const outputPath = submit.payload.outputPath || path.join(input.fixtureRoot, "outputs", "shots", input.shotId, "end.png");
    const bytes = readFileSync(outputPath);
    return {
      id: "shot_end_frame",
      kind: "end_frame",
      status: "success",
      route: "current_project_image2_end_frame",
      elapsedMs: Math.round(performance.now() - started),
      outputPath,
      outputSha256: sha256(bytes),
      format: imageFormat(bytes),
      dimensions: fileDimensions(outputPath),
      providerRequestId: submit.payload.providerRequestId,
      notes: [
        `uiStatus=${submit.payload.uiStatus}`,
        `providerOperation=${submit.payload.providerOperation || "unknown"}`,
        `sourceStartFrameSha256=${submit.payload.sourceStartFrameSha256 || "missing"}`,
      ],
    };
  } catch (error) {
    return {
      id: "shot_end_frame",
      kind: "end_frame",
      status: "failure",
      route: "current_project_image2_end_frame",
      elapsedMs: Math.round(performance.now() - started),
      failureKind: "runtime_or_provider_failure",
      errorMessage: redact(error instanceof Error ? error.message : error),
    };
  } finally {
    await stopServer(child);
  }
}

const runId = argValue("--run-id") || `small-project-assets-keyframes-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const fixtureRoot = path.resolve(argValue("--fixture-root") || path.join("real-test-sandbox", runId));
const reportPath = path.join(fixtureRoot, "report.json");
const timeoutMs = Number(argValue("--timeout-ms") || process.env.VIBE_IMAGE2_PROVIDER_TIMEOUT_MS || 900000);
const endpointEndFrame = argFlag("--endpoint-end-frame") || argValue("--video-control-mode") === "first_last_endpoint";
const providerStatus = getProviderConfigStatuses()[0];
const apiKey = getProviderApiKey("lanyi-image2");
if (!apiKey) {
  throw new Error("Lanyi Image2 key is not configured in Settings or VIBE_IMAGE2_API_KEY.");
}
const baseUrl = (providerStatus.baseUrl || "https://lanyiapi.com").replace(/\/+$/, "");
const model = providerStatus.imageModel || "gpt-image-2";

mkdirSync(fixtureRoot, { recursive: true });

const assetSpecs = [
  {
    id: "asset_character",
    kind: "character_asset" as const,
    outputPath: path.join(fixtureRoot, "assets", "generated", "character_mira.png"),
    prompt: "16:9 character reference asset. Mira is a young night courier with a teal raincoat, round glasses, short black hair, practical shoulder bag, quiet determined expression. Simple three-quarter standing pose, clean readable 2D cinematic style, limited teal and amber palette.",
  },
  {
    id: "asset_scene",
    kind: "scene_asset" as const,
    outputPath: path.join(fixtureRoot, "assets", "generated", "scene_fog_tram_stop.png"),
    prompt: "16:9 scene reference asset. An abandoned hillside tram stop after rain, wet rails, a single fog lamp, small shelter, distant city lights below. Clean readable layout, no people, limited teal and amber palette.",
  },
  {
    id: "asset_prop",
    kind: "prop_asset" as const,
    outputPath: path.join(fixtureRoot, "assets", "generated", "prop_compass_locket.png"),
    prompt: "16:9 prop reference asset. A brass compass locket with a small blue enamel star, shown clearly on dark fabric, simple readable silhouette, no text, no hands, no decorative clutter.",
  },
];

const assetResults: ImageOutput[] = [];
for (const spec of assetSpecs) {
  assetResults.push(await generateImage({
    ...spec,
    apiKey,
    baseUrl,
    model,
    size: IMAGE2_GENERATE_DEFAULT_SIZE,
    timeoutMs,
  }));
  writeJson(reportPath, {
    status: "running",
    runId,
    fixtureRoot,
    assetResults,
    rawApiKeyStored: false,
  });
}

const runtimeProject = createRuntimeProject({ fixtureRoot, runId, assetResults, endpointEndFrame });
const startResult = await runP6StartFrame({
  fixtureRoot,
  projectId: runtimeProject.projectId,
  shotId: runtimeProject.shotId,
  apiKey,
});

const endResult = endpointEndFrame && startResult.status === "success" && startResult.outputPath
  ? await runImage2EndFrame({
      fixtureRoot,
      projectId: runtimeProject.projectId,
      shotId: runtimeProject.shotId,
      apiKey,
    })
  : {
      id: "shot_end_frame",
      kind: "end_frame" as const,
      status: "skipped" as const,
      route: "current_project_image2_end_frame" as const,
      failureKind: endpointEndFrame ? "missing_start_frame" : "endpoint_end_frame_not_selected",
      errorMessage: endpointEndFrame
        ? "Start frame did not succeed, so end-frame edit was skipped."
        : "Default first-frame video control does not generate an end frame.",
    };

const videoResult = endpointEndFrame && startResult.status === "success" && startResult.outputPath && endResult.status === "success" && endResult.outputPath
  ? await renderSilentKeyframeVideo({
      id: "shot_silent_preview_video",
      startPath: startResult.outputPath,
      endPath: endResult.outputPath,
      outputPath: path.join(fixtureRoot, "exports", "video", `${runtimeProject.shotId}_silent_preview.mp4`),
      timeoutMs: 120000,
    })
  : {
      id: "shot_silent_preview_video",
      kind: "preview_video" as const,
      status: "skipped" as const,
      route: "local_silent_video_export" as const,
      failureKind: endpointEndFrame ? "missing_keyframe_pair" : "endpoint_end_frame_not_selected",
      errorMessage: endpointEndFrame
        ? "Start/end frame pair did not succeed, so silent preview video export was skipped."
        : "Default first-frame video control skips local start/end preview export.",
    };

writeProjectAndExportPackage({
  fixtureRoot,
  runId,
  projectId: runtimeProject.projectId,
  shotId: runtimeProject.shotId,
  endpointEndFrame,
  assetResults,
  startResult,
  endResult,
  videoResult,
  reportPath,
});

const outputs = [...assetResults, startResult, endResult, videoResult];
for (const output of outputs) {
  if (output.outputPath) {
    const stat = statSync(output.outputPath);
    if (stat.size <= 0) {
      output.status = "failure";
      output.failureKind = "empty_file";
      output.errorMessage = "Output file is empty.";
    }
  }
}

const productGaps = [
  endResult.dimensions && startResult.dimensions && endResult.dimensions !== startResult.dimensions
    ? `End-frame dimensions differ from start frame: start=${startResult.dimensions}, end=${endResult.dimensions}.`
    : "",
].filter(Boolean);

const report = {
  schemaVersion: "real_small_project_asset_keyframe_test_v1",
  runId,
  generatedAt: new Date().toISOString(),
  fixtureRoot,
  projectId: runtimeProject.projectId,
  shotId: runtimeProject.shotId,
  provider: {
    providerId: "lanyi-image2",
    baseUrl,
    model,
    size: IMAGE2_GENERATE_DEFAULT_SIZE,
    aspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
    videoControlMode: endpointEndFrame ? "first_last_endpoint" : "first_frame_default",
    timeoutMs,
    rawApiKeyStored: false,
  },
  summary: {
    total: outputs.length,
    succeeded: outputs.filter((item) => item.status === "success").length,
    failed: outputs.filter((item) => item.status === "failure").length,
    skipped: outputs.filter((item) => item.status === "skipped").length,
    assetSucceeded: assetResults.filter((item) => item.status === "success").length,
    startFrameStatus: startResult.status,
    endFrameStatus: endResult.status,
    videoExportStatus: videoResult.status,
    promotionAllowed: false,
  },
  outputs,
  exportPackage: {
    manifestPath: path.join(fixtureRoot, "exports", "export_package_manifest.json"),
    projectVibePath: path.join(fixtureRoot, "exports", "Project.vibe"),
    videoPath: videoResult.outputPath,
    audioIncluded: false,
    ttsIncluded: false,
  },
  productGaps,
};
writeJson(reportPath, report);
console.log(JSON.stringify({
  status: report.summary.failed === 0 && (endpointEndFrame ? report.summary.skipped === 0 : report.summary.startFrameStatus === "success") ? "passed" : "completed_with_gaps",
  reportPath,
  fixtureRoot,
  summary: report.summary,
  productGaps,
}, null, 2));

if (report.summary.failed > 0 || (endpointEndFrame && report.summary.skipped > 0)) process.exit(2);
