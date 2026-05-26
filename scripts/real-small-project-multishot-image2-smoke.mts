import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { deflateSync } from "node:zlib";

import { buildImage2CleanBasePrompt } from "../src/core/image2PromptBase.ts";
import {
  IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  IMAGE2_GENERATE_DEFAULT_SIZE,
} from "../src/core/providerPolicy.ts";
import {
  appendProviderRetryAttemptResult,
  createProviderRetrySchedulerState,
  markProviderRetryAttemptsRunning,
  providerRetryAttemptReceiptCandidates,
  queueNextProviderRetryBatch,
  type ProviderRetryAttempt,
  type ProviderRetryFailureKind,
  type ProviderRetryPolicy,
  type ProviderRetryResult,
  type ProviderRetrySchedulerState,
} from "../src/core/providerRetryScheduler.ts";
import { projectVibeModelVersion, type ProjectVibeDocument } from "../src/project/types.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type PhaseId = "assets" | "start_frames";
type OutputKind = "character_asset" | "scene_asset" | "prop_asset" | "start_frame";
type ReturnStatus = "needs_review" | "missing" | "skipped";
type RunMode = "mock" | "live";

const liveSmokeVisualStyle = [
  "Visual style contract for this smoke: 1990s Japanese TV anime, clean cel shading, soft hand-painted backgrounds, restrained color, quiet suspense.",
  "Avoid photorealism, glossy 3D, live-action cinematography, game render, fake UI text, logos, watermarks, and readable signage.",
].join(" ");

interface ShotPlan {
  id: string;
  title: string;
  intent: string;
  prompt: string;
  durationSeconds: number;
}

interface PlannedOutput {
  id: string;
  phase: PhaseId;
  kind: OutputKind;
  shotId?: string;
  label: string;
  prompt: string;
  outputPath: string;
  receiptPath: string;
  promptPath: string;
  references: string[];
  mockColor: [number, number, number];
}

interface OutputRecord {
  id: string;
  phase: PhaseId;
  kind: OutputKind;
  shotId?: string;
  label: string;
  status: "success" | "failure" | "missing" | "recovered";
  returnStatus: ReturnStatus;
  outputPath?: string;
  outputSha256?: string;
  outputFormat?: "png" | "jpeg" | "webp" | "unknown";
  outputMimeType?: string;
  dimensions?: string;
  receiptPath?: string;
  promptPath?: string;
  references: string[];
  providerRequestId?: string;
  attemptId?: string;
  attemptNumber?: number;
  elapsedMs?: number;
  failureKind?: ProviderRetryFailureKind | "empty_file" | "live_blocked";
  errorMessage?: string;
  providerCalledExternal: boolean;
  mockProviderCalled: boolean;
  recoveredFromExisting?: boolean;
  promotionAllowed: false;
}

interface PhaseRunResult {
  phase: PhaseId;
  records: OutputRecord[];
  retryState: ProviderRetrySchedulerState;
  requestedCount: number;
  returnedCount: number;
  recoveredFromExistingCount: number;
  retryAttemptedIds: string[];
  retryRecoveredIds: string[];
  missingIds: string[];
}

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

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function safeInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "item";
}

function redact(value: unknown): string {
  return String(value || "")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .slice(0, 700);
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function sha256(buffer: Buffer | string): string {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function packageRelative(packageRoot: string, filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  return path.relative(packageRoot, path.resolve(filePath)).replace(/\\/g, "/");
}

function imageFormat(buffer: Buffer): OutputRecord["outputFormat"] {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "unknown";
}

function imageMime(format: OutputRecord["outputFormat"]): string {
  if (format === "png") return "image/png";
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "application/octet-stream";
}

function inferMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function referenceImagesForPlan(packageRoot: string, references: string[]): Array<{
  path: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
}> {
  return references
    .filter((reference) => !reference.startsWith("planned-shot:"))
    .map((reference) => path.resolve(packageRoot, reference))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => ({
      path: filePath,
      name: path.basename(filePath),
      mimeType: inferMimeFromPath(filePath),
      bytes: readFileSync(filePath),
    }));
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

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.concat([typeBuffer, data]);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(chunk), 8 + data.length);
  return output;
}

function createMockPng(width: number, height: number, color: [number, number, number]): Buffer {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * bytesPerPixel;
      raw[offset] = (color[0] + Math.floor((x / Math.max(1, width - 1)) * 24)) & 0xff;
      raw[offset + 1] = (color[1] + Math.floor((y / Math.max(1, height - 1)) * 24)) & 0xff;
      raw[offset + 2] = color[2];
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function providerFailureKind(value: string | undefined): ProviderRetryFailureKind {
  if (value === "auth" || value === "rate_limit" || value === "timeout" || value === "network_error") return value;
  if (value === "provider_missing" || value === "validation_error" || value === "content_policy") return value;
  return "server_error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phaseFileSlug(phase: PhaseId): string {
  return phase === "start_frames" ? "start-frames" : phase;
}

function buildShots(shotCount: number): ShotPlan[] {
  return [
    {
      id: "MS01",
      title: "Platform signal",
      intent: "Open on the rain station and the courier noticing the star-map signal.",
      durationSeconds: 4,
      prompt: "16:9 cinematic start frame. Rainy elevated train platform at night, the courier in a teal coat stops mid-step as a faint star-map signal glows on an old timetable board. Clear foreground silhouette, wet floor reflections, no text overlays.",
    },
    {
      id: "MS02",
      title: "Ticket opens",
      intent: "Show the prop discovery close enough to anchor continuity.",
      durationSeconds: 4,
      prompt: "16:9 cinematic start frame. Medium close shot of the courier opening a brass transit ticket locket with a blue star enamel mark; the rainy platform stays visible behind her shoulder. The locket and her face are both readable, no extra characters.",
    },
    {
      id: "MS03",
      title: "Clockroom door",
      intent: "Move from discovery toward the hidden station interior.",
      durationSeconds: 5,
      prompt: "16:9 cinematic start frame. The courier stands before a half-open station clockroom door, holding the star ticket up to the lock. Amber light leaks through the doorway, rain and rails remain outside, same teal coat and shoulder bag.",
    },
    {
      id: "MS04",
      title: "Observatory carriage",
      intent: "Reveal the small-film promise without requiring video generation.",
      durationSeconds: 5,
      prompt: "16:9 cinematic start frame. Inside an old train carriage transformed into a tiny observatory, brass rings and star charts surround the courier as she looks up. Keep the blue star ticket visible in her hand, clean readable composition.",
    },
    {
      id: "MS05",
      title: "Departure light",
      intent: "End the smoke's front half with a stable launch image.",
      durationSeconds: 5,
      prompt: "16:9 cinematic start frame. Exterior wide shot of the last train beginning to glow at the rainy elevated platform. The courier stands near the open carriage door holding the star ticket, city lights below, no text or logos.",
    },
    {
      id: "MS06",
      title: "Glass reflection warning",
      intent: "Check continuity when the protagonist appears through a reflective surface.",
      durationSeconds: 4,
      prompt: "16:9 cinematic start frame. The courier's face appears reflected in the rain-streaked train window while the blue star ticket glows near the glass. Keep the teal raincoat and round glasses consistent, no readable text.",
    },
    {
      id: "MS07",
      title: "Clockwork map unfolds",
      intent: "Stress-test a prop-driven visual beat without spawning extra component assets.",
      durationSeconds: 5,
      prompt: "16:9 cinematic start frame. The brass star ticket unfolds into a small clockwork map above the carriage table, with the courier's hands framing it but not becoming separate subject references. Old train interior, warm brass light.",
    },
    {
      id: "MS08",
      title: "Bridge into dawn",
      intent: "Close the larger test with a new outdoor scene while preserving the same character and prop.",
      durationSeconds: 6,
      prompt: "16:9 cinematic start frame. Dawn breaks over an elevated railway bridge above the city. The courier stands at the open train doorway holding the star ticket, rain clouds clearing, hopeful quiet ending frame.",
    },
  ].slice(0, shotCount);
}

function assetPlans(packageRoot: string, runId: string, shotIds: string[]): PlannedOutput[] {
  return [
    {
      id: "asset_character_mira",
      phase: "assets",
      kind: "character_asset",
      label: "Mira courier character",
      outputPath: path.join(packageRoot, "assets", "character-mira.png"),
      receiptPath: path.join(packageRoot, "receipts", "assets", "character-mira.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-character-mira.md"),
      references: [],
      mockColor: [31, 114, 132],
      prompt: "16:9 character asset for a small AI film. Mira is a young night courier in a teal raincoat, short black hair, round glasses, practical shoulder bag, calm determined expression. Clean readable cinematic 2D look, neutral pose, no text.",
    },
    {
      id: "asset_scene_rain_station",
      phase: "assets",
      kind: "scene_asset",
      label: "Rainy elevated station scene",
      outputPath: path.join(packageRoot, "assets", "scene-rain-station.png"),
      receiptPath: path.join(packageRoot, "receipts", "assets", "scene-rain-station.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-scene-rain-station.md"),
      references: [],
      mockColor: [40, 61, 84],
      prompt: "16:9 scene asset. Rainy elevated train platform at night, wet rails, old timetable board, small station clockroom door, distant city lights below. No people, no text, readable cinematic layout.",
    },
    {
      id: "asset_prop_star_ticket",
      phase: "assets",
      kind: "prop_asset",
      label: "Star ticket locket prop",
      outputPath: path.join(packageRoot, "assets", "prop-star-ticket.png"),
      receiptPath: path.join(packageRoot, "receipts", "assets", "prop-star-ticket.json"),
      promptPath: path.join(packageRoot, "receipts", "prompts", "asset-prop-star-ticket.md"),
      references: [],
      mockColor: [163, 115, 48],
      prompt: "16:9 prop asset. Brass transit ticket locket with a small blue enamel star and subtle compass lines, shown clearly on dark fabric. Simple silhouette, no hands, no text, no decorative clutter.",
    },
  ].map((plan) => ({ ...plan, references: shotIds.map((shotId) => `planned-shot:${shotId}`) }));
}

function startFramePlans(packageRoot: string, shots: ShotPlan[], assetRefs: string[]): PlannedOutput[] {
  return shots.map((shot, index) => ({
    id: `${shot.id}_start_frame`,
    phase: "start_frames",
    kind: "start_frame",
    shotId: shot.id,
    label: `${shot.id} start frame`,
    outputPath: path.join(packageRoot, "start-frames", `${shot.id}-start.png`),
    receiptPath: path.join(packageRoot, "receipts", "start-frames", `${shot.id}-start.json`),
    promptPath: path.join(packageRoot, "receipts", "prompts", `${shot.id}-start.md`),
    references: assetRefs,
    mockColor: [
      54 + index * 18,
      72 + index * 12,
      111 + index * 9,
    ] as [number, number, number],
    prompt: [
      shot.prompt,
      "Use the locked visual memory from the generated character, station scene, and star-ticket prop assets.",
      "Keep continuity stable across shots; this smoke generates start frames only, not endpoint frames or video.",
    ].join(" "),
  }));
}

function existingOutputFromReceipt(packageRoot: string, plan: PlannedOutput): OutputRecord | undefined {
  if (!existsSync(plan.receiptPath)) return undefined;
  const receipt = readJson(plan.receiptPath);
  const outputPath = typeof receipt.outputPath === "string"
    ? path.join(packageRoot, receipt.outputPath)
    : plan.outputPath;
  if (!existsSync(outputPath)) return undefined;
  const bytes = readFileSync(outputPath);
  const format = imageFormat(bytes);
  return {
    id: plan.id,
    phase: plan.phase,
    kind: plan.kind,
    shotId: plan.shotId,
    label: plan.label,
    status: "recovered",
    returnStatus: receipt.status === "missing" ? "missing" : "needs_review",
    outputPath,
    outputSha256: sha256(bytes),
    outputFormat: format,
    outputMimeType: imageMime(format),
    dimensions: fileDimensions(outputPath),
    receiptPath: plan.receiptPath,
    promptPath: plan.promptPath,
    references: plan.references,
    providerRequestId: receipt.providerRequestId,
    attemptId: receipt.attemptId,
    attemptNumber: receipt.attemptNumber,
    providerCalledExternal: false,
    mockProviderCalled: false,
    recoveredFromExisting: true,
    promotionAllowed: false,
  };
}

function writeOutputReceipt(input: {
  packageRoot: string;
  runId: string;
  plan: PlannedOutput;
  record: OutputRecord;
  mode: RunMode;
  requestedSize: string;
  requestedAspectRatio: string;
}): void {
  writeJson(input.plan.receiptPath, {
    schemaVersion: "image2_multishot_smoke_output_receipt_v1",
    receiptId: `receipt_${input.runId}_${safeId(input.plan.id)}`,
    runId: input.runId,
    mode: input.mode,
    phase: input.plan.phase,
    outputId: input.plan.id,
    shotId: input.plan.shotId,
    kind: input.plan.kind,
    label: input.plan.label,
    status: input.record.returnStatus,
    providerCalledExternal: input.record.providerCalledExternal,
    mockProviderCalled: input.record.mockProviderCalled,
    providerRequestId: input.record.providerRequestId,
    attemptId: input.record.attemptId,
    attemptNumber: input.record.attemptNumber,
    requestedSize: input.requestedSize,
    requestedAspectRatio: input.requestedAspectRatio,
    outputPath: packageRelative(input.packageRoot, input.record.outputPath),
    outputSha256: input.record.outputSha256,
    outputMimeType: input.record.outputMimeType,
    dimensions: input.record.dimensions,
    promptPath: packageRelative(input.packageRoot, input.plan.promptPath),
    references: input.plan.references,
    promotionAllowed: false,
    providerSelfReportIgnoredForCompletion: true,
    notes: [
      "Output is available for preview only after human review.",
      "This smoke intentionally does not generate endpoint/end frames or video.",
    ],
  });
}

async function callMockProvider(input: {
  packageRoot: string;
  plan: PlannedOutput;
  attempt: ProviderRetryAttempt;
  runId: string;
  recoverableFailureId?: string;
  finalMissingId?: string;
  requestedSize: string;
  requestedAspectRatio: string;
}): Promise<{ schedulerResult: ProviderRetryResult; record?: OutputRecord; providerResult: Record<string, unknown> }> {
  const started = performance.now();
  if (input.finalMissingId === input.plan.id) {
    return {
      schedulerResult: { status: "missing", failureKind: "provider_missing", message: "mock final missing output" },
      providerResult: {
        outputId: input.plan.id,
        shotId: input.plan.shotId,
        attemptId: input.attempt.attemptId,
        attemptNumber: input.attempt.attemptNumber,
        ok: true,
        providerReturnedCount: 0,
        failureKind: "provider_missing",
        mockProviderCalled: true,
      },
    };
  }
  if (input.recoverableFailureId === input.plan.id && input.attempt.attemptNumber === 1) {
    return {
      schedulerResult: { status: "failure", failureKind: "network_error", message: "mock recoverable network error" },
      providerResult: {
        outputId: input.plan.id,
        shotId: input.plan.shotId,
        attemptId: input.attempt.attemptId,
        attemptNumber: input.attempt.attemptNumber,
        ok: false,
        failureKind: "network_error",
        mockProviderCalled: true,
      },
    };
  }

  const [width, height] = input.requestedSize.split("x").map((item) => Number(item));
  const bytes = createMockPng(width || 1280, height || 720, input.plan.mockColor);
  mkdirSync(path.dirname(input.plan.outputPath), { recursive: true });
  writeFileSync(input.plan.outputPath, bytes);
  const format = imageFormat(bytes);
  const record: OutputRecord = {
    id: input.plan.id,
    phase: input.plan.phase,
    kind: input.plan.kind,
    shotId: input.plan.shotId,
    label: input.plan.label,
    status: "success",
    returnStatus: "needs_review",
    outputPath: input.plan.outputPath,
    outputSha256: sha256(bytes),
    outputFormat: format,
    outputMimeType: imageMime(format),
    dimensions: fileDimensions(input.plan.outputPath),
    receiptPath: input.plan.receiptPath,
    promptPath: input.plan.promptPath,
    references: input.plan.references,
    providerRequestId: `mock_${safeId(input.runId)}_${safeId(input.plan.id)}_${input.attempt.attemptNumber}`,
    attemptId: input.attempt.attemptId,
    attemptNumber: input.attempt.attemptNumber,
    elapsedMs: Math.round(performance.now() - started),
    providerCalledExternal: false,
    mockProviderCalled: true,
    promotionAllowed: false,
  };
  writeOutputReceipt({
    packageRoot: input.packageRoot,
    runId: input.runId,
    plan: input.plan,
    record,
    mode: "mock",
    requestedSize: input.requestedSize,
    requestedAspectRatio: input.requestedAspectRatio,
  });
  return {
    schedulerResult: {
      status: "success",
      providerRequestId: record.providerRequestId || `mock_${input.plan.id}`,
      outputPath: input.plan.outputPath,
      outputSha256: record.outputSha256 || sha256(bytes),
    },
    record,
    providerResult: {
      outputId: input.plan.id,
      shotId: input.plan.shotId,
      attemptId: input.attempt.attemptId,
      attemptNumber: input.attempt.attemptNumber,
      ok: true,
      providerReturnedCount: 1,
      providerRequestId: record.providerRequestId,
      outputPath: packageRelative(input.packageRoot, record.outputPath),
      outputSha256: record.outputSha256,
      mockProviderCalled: true,
    },
  };
}

async function callLiveProvider(input: {
  packageRoot: string;
  plan: PlannedOutput;
  attempt: ProviderRetryAttempt;
  runId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  requestedSize: string;
  requestedAspectRatio: string;
}): Promise<{ schedulerResult: ProviderRetryResult; record?: OutputRecord; providerResult: Record<string, unknown> }> {
  const started = performance.now();
  const prompt = buildImage2CleanBasePrompt({
    sourcePrompt: `${input.plan.prompt}\n${liveSmokeVisualStyle}`,
    frameRole: input.plan.kind,
    aspectRatio: input.requestedAspectRatio,
  });
  const providerResult = await fetchLanyiImageViaResponsesStream({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    model: input.model,
    prompt,
    size: input.requestedSize,
    timeoutMs: input.timeoutMs,
    providerOperation: "responses.image_generation",
    referenceImages: referenceImagesForPlan(input.packageRoot, input.plan.references),
  });

  if (providerResult.rawSseBytes?.length) {
    const ssePath = path.join(input.packageRoot, "receipts", "provider-events", `${safeId(input.plan.id)}-${input.attempt.attemptNumber}.sse.txt`);
    mkdirSync(path.dirname(ssePath), { recursive: true });
    writeFileSync(ssePath, providerResult.rawSseBytes);
  }

  if (!providerResult.ok) {
    const failureKind = providerFailureKind(providerResult.failureKind || providerResult.errorType);
    return {
      schedulerResult: {
        status: "failure",
        failureKind,
        message: redact(providerResult.message || providerResult.diagnostic?.message || "provider did not return image bytes"),
      },
      providerResult: {
        outputId: input.plan.id,
        shotId: input.plan.shotId,
        attemptId: input.attempt.attemptId,
        attemptNumber: input.attempt.attemptNumber,
        ok: false,
        failureKind,
        message: redact(providerResult.message || providerResult.diagnostic?.message),
        providerCalledExternal: true,
      },
    };
  }

  mkdirSync(path.dirname(input.plan.outputPath), { recursive: true });
  writeFileSync(input.plan.outputPath, providerResult.bytes);
  const bytes = readFileSync(input.plan.outputPath);
  const format = imageFormat(bytes);
  const record: OutputRecord = {
    id: input.plan.id,
    phase: input.plan.phase,
    kind: input.plan.kind,
    shotId: input.plan.shotId,
    label: input.plan.label,
    status: "success",
    returnStatus: "needs_review",
    outputPath: input.plan.outputPath,
    outputSha256: sha256(bytes),
    outputFormat: format,
    outputMimeType: imageMime(format),
    dimensions: fileDimensions(input.plan.outputPath),
    receiptPath: input.plan.receiptPath,
    promptPath: input.plan.promptPath,
    references: input.plan.references,
    providerRequestId: providerResult.providerRequestId,
    attemptId: input.attempt.attemptId,
    attemptNumber: input.attempt.attemptNumber,
    elapsedMs: Math.round(performance.now() - started),
    providerCalledExternal: true,
    mockProviderCalled: false,
    promotionAllowed: false,
  };
  writeOutputReceipt({
    packageRoot: input.packageRoot,
    runId: input.runId,
    plan: input.plan,
    record,
    mode: "live",
    requestedSize: input.requestedSize,
    requestedAspectRatio: input.requestedAspectRatio,
  });
  return {
    schedulerResult: {
      status: "success",
      providerRequestId: record.providerRequestId || `live_${input.plan.id}`,
      outputPath: input.plan.outputPath,
      outputSha256: record.outputSha256 || sha256(bytes),
    },
    record,
    providerResult: {
      outputId: input.plan.id,
      shotId: input.plan.shotId,
      attemptId: input.attempt.attemptId,
      attemptNumber: input.attempt.attemptNumber,
      ok: true,
      providerReturnedCount: 1,
      providerRequestId: record.providerRequestId,
      outputPath: packageRelative(input.packageRoot, record.outputPath),
      outputSha256: record.outputSha256,
      providerCalledExternal: true,
    },
  };
}

async function runPhase(input: {
  phase: PhaseId;
  packageRoot: string;
  runId: string;
  mode: RunMode;
  plans: PlannedOutput[];
  retryPolicy: ProviderRetryPolicy;
  requestedSize: string;
  requestedAspectRatio: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs: number;
  recoverableFailureId?: string;
  finalMissingId?: string;
}): Promise<PhaseRunResult & { providerResults: Record<string, unknown>[] }> {
  const recovered = input.plans
    .map((plan) => existingOutputFromReceipt(input.packageRoot, plan))
    .filter((record): record is OutputRecord => Boolean(record));
  const recoveredIds = new Set(recovered.map((record) => record.id));
  const runnablePlans = input.plans.filter((plan) => !recoveredIds.has(plan.id));
  const planByTaskId = new Map<string, PlannedOutput>();

  const retryStatePath = path.join(input.packageRoot, "receipts", `${phaseFileSlug(input.phase)}-retry-scheduler-state.json`);
  const retryAttemptReceiptsPath = path.join(input.packageRoot, "receipts", `${phaseFileSlug(input.phase)}-retry-attempt-receipts.json`);
  let retryState = createProviderRetrySchedulerState({
    generatedAt: new Date().toISOString(),
    policy: input.retryPolicy,
    tasks: runnablePlans.map((plan, index) => {
      const taskId = `${input.runId}-${plan.id}`;
      planByTaskId.set(taskId, plan);
      return {
        taskId,
        shotId: plan.shotId || plan.id,
        inputHash: sha256Text(`${input.mode}:${input.requestedSize}:${plan.id}:${plan.prompt}`),
        permissionReceiptId: `permission_${input.runId}_${input.phase}`,
        expectedOutputPath: plan.outputPath,
        priority: runnablePlans.length - index,
      };
    }),
  });

  const records = [...recovered];
  const providerResults: Record<string, unknown>[] = [];
  for (const plan of input.plans) writeText(plan.promptPath, `${plan.prompt}\n`);

  for (let tick = 0; tick < Math.max(20, runnablePlans.length * (input.retryPolicy.maxAutoRetries + 2) * 4); tick += 1) {
    const now = new Date().toISOString();
    const batch = queueNextProviderRetryBatch(retryState, now);
    if (batch.length === 0) {
      const queued = retryState.attempts.filter((attempt) => attempt.status === "queued");
      if (queued.length === 0 && retryState.summary.running === 0) break;
      const nextDueAt = Math.min(...queued.map((attempt) => new Date(attempt.scheduledAt).getTime()));
      await sleep(Math.max(0, Math.min(5_000, nextDueAt - Date.now())));
      continue;
    }

    retryState = markProviderRetryAttemptsRunning(retryState, batch.map((attempt) => attempt.attemptId), now);
    writeJson(retryStatePath, retryState);

    const attemptResults = await Promise.all(batch.map(async (attempt) => {
      const plan = planByTaskId.get(attempt.taskId);
      if (!plan) throw new Error(`Missing plan for ${attempt.taskId}`);
      if (input.mode === "live") {
        if (!input.apiKey || !input.baseUrl || !input.model) throw new Error("Live provider config is incomplete.");
        return callLiveProvider({
          packageRoot: input.packageRoot,
          plan,
          attempt,
          runId: input.runId,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
          model: input.model,
          timeoutMs: input.timeoutMs,
          requestedSize: input.requestedSize,
          requestedAspectRatio: input.requestedAspectRatio,
        });
      }
      return callMockProvider({
        packageRoot: input.packageRoot,
        plan,
        attempt,
        runId: input.runId,
        recoverableFailureId: input.recoverableFailureId,
        finalMissingId: input.finalMissingId,
        requestedSize: input.requestedSize,
        requestedAspectRatio: input.requestedAspectRatio,
      });
    }));

    const completedAt = new Date().toISOString();
    for (const result of attemptResults) {
      providerResults.push(result.providerResult);
      retryState = appendProviderRetryAttemptResult(
        retryState,
        String(result.providerResult.attemptId),
        result.schedulerResult,
        completedAt,
      );
      if (result.record) records.push(result.record);
      writeJson(
        path.join(input.packageRoot, "receipts", "attempts", `${safeId(String(result.providerResult.attemptId))}.json`),
        {
          schemaVersion: "image2_multishot_smoke_attempt_receipt_v1",
          runId: input.runId,
          phase: input.phase,
          ...result.providerResult,
          schedulerResult: result.schedulerResult,
          promotionAllowed: false,
          providerSelfReportIgnoredForCompletion: true,
        },
      );
    }

    writeJson(retryStatePath, retryState);
    writeJson(retryAttemptReceiptsPath, providerRetryAttemptReceiptCandidates(retryState));
  }

  if (retryState.summary.queued > 0 || retryState.summary.running > 0) {
    throw new Error(`Retry scheduler did not settle for ${input.phase}.`);
  }

  const recordById = new Map(records.map((record) => [record.id, record]));
  for (const plan of input.plans) {
    if (recordById.has(plan.id)) continue;
    const terminalAttempt = retryState.attempts
      .filter((attempt) => attempt.taskId === `${input.runId}-${plan.id}`)
      .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
    const missingRecord: OutputRecord = {
      id: plan.id,
      phase: plan.phase,
      kind: plan.kind,
      shotId: plan.shotId,
      label: plan.label,
      status: "missing",
      returnStatus: "missing",
      receiptPath: plan.receiptPath,
      promptPath: plan.promptPath,
      references: plan.references,
      attemptId: terminalAttempt?.attemptId,
      attemptNumber: terminalAttempt?.attemptNumber,
      failureKind: terminalAttempt?.failureKind || "provider_missing",
      errorMessage: terminalAttempt?.failureMessage || "Output missing after retry budget.",
      providerCalledExternal: input.mode === "live",
      mockProviderCalled: input.mode === "mock",
      promotionAllowed: false,
    };
    records.push(missingRecord);
    writeOutputReceipt({
      packageRoot: input.packageRoot,
      runId: input.runId,
      plan,
      record: missingRecord,
      mode: input.mode,
      requestedSize: input.requestedSize,
      requestedAspectRatio: input.requestedAspectRatio,
    });
  }

  writeJson(retryStatePath, retryState);
  writeJson(retryAttemptReceiptsPath, providerRetryAttemptReceiptCandidates(retryState));

  const retryAttemptedIds = Array.from(new Set(retryState.attempts.filter((attempt) => attempt.attemptNumber > 1).map((attempt) => attempt.shotId))).sort();
  const retryRecoveredIds = Array.from(new Set(retryState.attempts.filter((attempt) => attempt.status === "succeeded" && attempt.attemptNumber > 1).map((attempt) => attempt.shotId))).sort();
  const missingIds = records.filter((record) => record.returnStatus === "missing").map((record) => record.shotId || record.id).sort();
  return {
    phase: input.phase,
    records: records.sort((left, right) => input.plans.findIndex((plan) => plan.id === left.id) - input.plans.findIndex((plan) => plan.id === right.id)),
    retryState,
    requestedCount: providerResults.length,
    returnedCount: records.filter((record) => record.status === "success").length,
    recoveredFromExistingCount: recovered.length,
    retryAttemptedIds,
    retryRecoveredIds,
    missingIds,
    providerResults,
  };
}

function assertNonEmptyOutputs(records: OutputRecord[]): void {
  for (const record of records) {
    if (!record.outputPath) continue;
    const stat = statSync(record.outputPath);
    if (stat.size > 0) continue;
    record.status = "failure";
    record.returnStatus = "missing";
    record.failureKind = "empty_file";
    record.errorMessage = "Output file is empty.";
  }
}

function buildProjectVibe(input: {
  packageRoot: string;
  runId: string;
  generatedAt: string;
  shots: ShotPlan[];
  records: OutputRecord[];
}): ProjectVibeDocument {
  const recordById = new Map(input.records.map((record) => [record.id, record]));
  const startRecords = input.records.filter((record) => record.phase === "start_frames");
  const assetRecords = input.records.filter((record) => record.phase === "assets");
  const assetUsedByShotIds = input.shots.map((shot) => shot.id);
  const assets = [
    {
      id: "asset_character_mira",
      kind: "character" as const,
      label: "Mira courier character",
      record: recordById.get("asset_character_mira"),
      textConstraints: ["teal raincoat", "round glasses", "short black hair", "practical shoulder bag"],
    },
    {
      id: "asset_scene_rain_station",
      kind: "scene" as const,
      label: "Rainy elevated station",
      record: recordById.get("asset_scene_rain_station"),
      textConstraints: ["rainy elevated platform", "old timetable board", "station clockroom door", "wet rail reflections"],
    },
    {
      id: "asset_prop_star_ticket",
      kind: "prop" as const,
      label: "Star ticket locket",
      record: recordById.get("asset_prop_star_ticket"),
      textConstraints: ["brass transit ticket locket", "blue enamel star", "small compass lines"],
    },
  ];

  return {
    kind: "project_vibe_document",
    modelVersion: projectVibeModelVersion,
    manifest: {
      projectId: "image2_multishot_smoke_small_film",
      title: "Image2 Multi-Shot Smoke Package",
      version: "0.1.0",
      createdAt: input.generatedAt,
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      portableRoot: "project_root",
      runtimeFixtureAuthority: false,
    },
    storyFlow: {
      id: "story_flow_multishot_smoke",
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      sections: [{
        id: "front_half",
        title: "Front half",
        summary: "Asset generation plus start-frame generation for the first shots of a small film.",
        sequenceIndex: 1,
        shotIds: input.shots.map((shot) => shot.id),
      }],
      shotOrder: input.shots.map((shot) => shot.id),
    },
    visualMemory: {
      id: "visual_memory_multishot_smoke",
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      referencePolicy: {
        temporaryOutputsMayBecomeAuthority: false,
        runtimeFixturesMayBecomeAuthority: false,
        lockedAssetsRequiredForGeneration: true,
      },
      entries: assets.map((asset) => ({
        id: `vm_${asset.id}`,
        assetId: asset.id,
        kind: asset.kind,
        label: asset.label,
        status: asset.record?.returnStatus === "needs_review" ? "needs_review" : "missing",
        textConstraints: asset.textConstraints,
        usedByShotIds: assetUsedByShotIds,
        canUseAsFutureReference: false,
        sourceRefs: asset.record?.receiptPath ? [`receipts:${packageRelative(input.packageRoot, asset.record.receiptPath)}`] : [],
      })),
    },
    shots: input.shots.map((shot) => {
      const record = startRecords.find((item) => item.shotId === shot.id);
      return {
        id: shot.id,
        sectionId: "front_half",
        title: shot.title,
        intent: shot.intent,
        videoControlMode: "first_frame_default",
        sceneAssetIds: ["asset_scene_rain_station"],
        characterAssetIds: ["asset_character_mira"],
        propAssetIds: ["asset_prop_star_ticket"],
        durationSeconds: shot.durationSeconds,
        status: record?.returnStatus === "needs_review" ? "generated" : "blocked",
        sourceRefs: [
          record?.outputPath ? `start-frame:${packageRelative(input.packageRoot, record.outputPath)}` : undefined,
          record?.receiptPath ? `receipt:${packageRelative(input.packageRoot, record.receiptPath)}` : undefined,
        ].filter((item): item is string => Boolean(item)),
      };
    }),
    assets: assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      label: asset.label,
      status: asset.record?.returnStatus === "needs_review" ? "needs_review" : "missing",
      path: packageRelative(input.packageRoot, asset.record?.outputPath),
      textConstraints: asset.textConstraints,
      usedByShotIds: assetUsedByShotIds,
      sourceRefs: asset.record?.receiptPath ? [`receipt:${packageRelative(input.packageRoot, asset.record.receiptPath)}`] : [],
    })),
    runs: [{
      id: `run_${safeId(input.runId)}`,
      runKind: "provider",
      status: startRecords.some((record) => record.returnStatus === "missing") ? "failed" : "succeeded",
      createdAt: input.generatedAt,
      summary: `${assetRecords.length} asset outputs and ${startRecords.length} start-frame outputs were produced or recovered for review.`,
      sourceFactHash: sha256Text(JSON.stringify({ shots: input.shots, assets: assetRecords.map((record) => record.id) })),
      affectedShotIds: input.shots.map((shot) => shot.id),
      producedAssetIds: assetRecords.map((record) => record.id),
      evidenceRefs: [
        "report/report.json",
        "receipts/export-package-manifest.json",
      ],
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    }],
    receipts: {
      scriptPlanningReceipts: [],
      promptKeyframePlanningReceipts: [],
      batchReceipts: [
        {
          id: `batch_${safeId(input.runId)}_assets`,
          createdAt: input.generatedAt,
          batchId: `${input.runId}:assets`,
          status: assetRecords.some((record) => record.returnStatus === "missing") ? "partial" : "succeeded",
          sourceFactHash: sha256Text(assetRecords.map((record) => record.id).join("|")),
          providerId: "lanyi-image2",
          taskEnvelopeIds: assetRecords.map((record) => record.id),
          affectedShotIds: input.shots.map((shot) => shot.id),
          attemptIds: assetRecords.map((record) => record.attemptId || "").filter(Boolean),
          returnedOutputCount: assetRecords.filter((record) => record.returnStatus === "needs_review").length,
          missingOutputCount: assetRecords.filter((record) => record.returnStatus === "missing").length,
          outputHashes: assetRecords.map((record) => record.outputSha256 || "").filter(Boolean),
          evidenceRefs: assetRecords.map((record) => `receipt:${packageRelative(input.packageRoot, record.receiptPath)}`),
          providerSelfReportCanPromote: false,
          projectFactsMutated: false,
          runtimeFixtureUsed: false,
        },
        {
          id: `batch_${safeId(input.runId)}_start_frames`,
          createdAt: input.generatedAt,
          batchId: `${input.runId}:start_frames`,
          status: startRecords.some((record) => record.returnStatus === "missing") ? "partial" : "succeeded",
          sourceFactHash: sha256Text(startRecords.map((record) => record.id).join("|")),
          providerId: "lanyi-image2",
          taskEnvelopeIds: startRecords.map((record) => record.id),
          affectedShotIds: startRecords.map((record) => record.shotId || record.id),
          attemptIds: startRecords.map((record) => record.attemptId || "").filter(Boolean),
          returnedOutputCount: startRecords.filter((record) => record.returnStatus === "needs_review").length,
          missingOutputCount: startRecords.filter((record) => record.returnStatus === "missing").length,
          outputHashes: startRecords.map((record) => record.outputSha256 || "").filter(Boolean),
          evidenceRefs: startRecords.map((record) => `receipt:${packageRelative(input.packageRoot, record.receiptPath)}`),
          providerSelfReportCanPromote: false,
          projectFactsMutated: false,
          runtimeFixtureUsed: false,
        },
      ],
      reviewReceipts: input.records.map((record) => ({
        id: `review_${safeId(record.id)}`,
        createdAt: input.generatedAt,
        status: record.returnStatus,
        humanReviewed: false,
        shotId: record.shotId,
        assetId: record.phase === "assets" ? record.id : undefined,
        sourceReceiptId: record.receiptPath ? `receipt_${input.runId}_${safeId(record.id)}` : undefined,
        sourceRunId: input.runId,
        outputPath: packageRelative(input.packageRoot, record.outputPath),
        outputHash: record.outputSha256,
        retryRequested: record.returnStatus === "missing",
        lateOutput: false,
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        evidenceRefs: record.receiptPath ? [`receipt:${packageRelative(input.packageRoot, record.receiptPath)}`] : [],
        blockers: record.returnStatus === "needs_review"
          ? ["Human review is required before this output can become authoritative visual memory."]
          : ["Output is missing or failed after the retry budget."],
      })),
    },
    sourceIndex: {
      id: "source_index_multishot_smoke",
      updatedAt: input.generatedAt,
      sourceOfTruth: "project_vibe",
      manifestRef: "project.vibe#manifest",
      storyFlowRef: "project.vibe#storyFlow",
      visualMemoryRef: "project.vibe#visualMemory",
      shotRefs: input.shots.map((shot) => `project.vibe#shots/${shot.id}`),
      assetRefs: assets.map((asset) => `project.vibe#assets/${asset.id}`),
      runReceiptRefs: [`project.vibe#runs/run_${safeId(input.runId)}`],
      batchReceiptRefs: [
        `project.vibe#receipts/batches/batch_${safeId(input.runId)}_assets`,
        `project.vibe#receipts/batches/batch_${safeId(input.runId)}_start_frames`,
      ],
      reviewReceiptRefs: input.records.map((record) => `project.vibe#receipts/reviews/review_${safeId(record.id)}`),
    },
  };
}

function writePackageManifest(input: {
  packageRoot: string;
  runId: string;
  generatedAt: string;
  shots: ShotPlan[];
  records: OutputRecord[];
  reportPath: string;
  mode: RunMode;
  providerCalledExternal: boolean;
  mockProviderCalled: boolean;
  maxConcurrency: number;
  retryConcurrency: number;
  maxAutoRetries: number;
  requestedSize: string;
  requestedAspectRatio: string;
}): string {
  const manifestPath = path.join(input.packageRoot, "receipts", "export-package-manifest.json");
  const assets = input.records.filter((record) => record.phase === "assets");
  const startFrames = input.records.filter((record) => record.phase === "start_frames");
  writeJson(manifestPath, {
    schemaVersion: "image2_multishot_smoke_export_package_v1",
    runId: input.runId,
    generatedAt: input.generatedAt,
    projectVibe: "Project.vibe",
    folders: {
      assets: "assets/",
      startFrames: "start-frames/",
      receipts: "receipts/",
      report: "report/",
    },
    mode: input.mode,
    provider: {
      providerId: "lanyi-image2",
      providerCalledExternal: input.providerCalledExternal,
      mockProviderCalled: input.mockProviderCalled,
      requestedSize: input.requestedSize,
      requestedAspectRatio: input.requestedAspectRatio,
      maxConcurrency: input.maxConcurrency,
      retryConcurrency: input.retryConcurrency,
      maxAutoRetries: input.maxAutoRetries,
      rawCredentialMaterialIncluded: false,
    },
    shots: input.shots.map((shot) => {
      const record = startFrames.find((item) => item.shotId === shot.id);
      return {
        shotId: shot.id,
        title: shot.title,
        status: record?.returnStatus || "missing",
        startFrame: packageRelative(input.packageRoot, record?.outputPath),
        receipt: packageRelative(input.packageRoot, record?.receiptPath),
      };
    }),
    assets: assets.map((record) => ({
      id: record.id,
      kind: record.kind,
      status: record.returnStatus,
      path: packageRelative(input.packageRoot, record.outputPath),
      receipt: packageRelative(input.packageRoot, record.receiptPath),
    })),
    advancedBranches: {
      endFrames: "skipped_by_default",
      endpointLoop: "skipped_by_default",
      transformation: "skipped_by_default",
      videoGeneration: "skipped_by_default",
    },
    report: packageRelative(input.packageRoot, input.reportPath),
    promotionAllowed: false,
    notes: [
      "This package is intentionally shaped for a user to inspect: Project.vibe, assets, start-frames, receipts, and report.",
      "Every returned image is needs_review; nothing is promoted automatically.",
    ],
  });
  return manifestPath;
}

function writeSummaryMarkdown(input: {
  packageRoot: string;
  reportPath: string;
  runId: string;
  mode: RunMode;
  records: OutputRecord[];
  providerCalledExternal: boolean;
  maxConcurrency: number;
  retryConcurrency: number;
  maxAutoRetries: number;
}): string {
  const markdownPath = path.join(input.packageRoot, "report", "summary.md");
  const assets = input.records.filter((record) => record.phase === "assets");
  const startFrames = input.records.filter((record) => record.phase === "start_frames");
  const lines = [
    "# Image2 Multi-Shot Smoke Report",
    "",
    `Run: ${input.runId}`,
    `Mode: ${input.mode}`,
    `External provider called: ${input.providerCalledExternal ? "yes" : "no"}`,
    `Concurrency: max ${input.maxConcurrency}, retry ${input.retryConcurrency}, max auto retries ${input.maxAutoRetries}`,
    "",
    "## Package",
    "",
    "- Project.vibe",
    "- assets/",
    "- start-frames/",
    "- receipts/",
    "- report/",
    "",
    "## Assets",
    "",
    ...assets.map((record) => `- ${record.id}: ${record.returnStatus}${record.outputPath ? ` (${packageRelative(input.packageRoot, record.outputPath)})` : ""}`),
    "",
    "## Start Frames",
    "",
    ...startFrames.map((record) => `- ${record.shotId}: ${record.returnStatus}${record.outputPath ? ` (${packageRelative(input.packageRoot, record.outputPath)})` : ""}`),
    "",
    "End frames, endpoint loops, transformations, and video generation were skipped by default.",
    `JSON report: ${packageRelative(input.packageRoot, input.reportPath)}`,
    "",
  ];
  writeText(markdownPath, lines.join("\n"));
  return markdownPath;
}

function writeBlockedLiveReport(input: {
  packageRoot: string;
  reportPath: string;
  runId: string;
  generatedAt: string;
  blockers: string[];
  maxConcurrency: number;
  retryConcurrency: number;
  maxAutoRetries: number;
  requestedSize: string;
  requestedAspectRatio: string;
}): void {
  writeJson(input.reportPath, {
    schemaVersion: "image2_multishot_smoke_report_v1",
    runId: input.runId,
    generatedAt: input.generatedAt,
    mode: "live",
    status: "live_submit_blocked_before_provider_call",
    ok: false,
    blockers: input.blockers,
    provider: {
      providerId: "lanyi-image2",
      providerCalledExternal: false,
      mockProviderCalled: false,
      requestedSize: input.requestedSize,
      requestedAspectRatio: input.requestedAspectRatio,
      maxConcurrency: input.maxConcurrency,
      retryConcurrency: input.retryConcurrency,
      maxAutoRetries: input.maxAutoRetries,
      rawCredentialMaterialIncluded: false,
    },
    commandExamples: {
      mock: "npm run real-small-project-multishot-image2:smoke",
      live: "VIBE_REAL_SMALL_PROJECT_MULTISHOT_LIVE=1 VIBE_REAL_SMALL_PROJECT_MULTISHOT_CONFIRM=submit-multishot-image2 npm run real-small-project-multishot-image2:live -- --shot-count=4",
    },
  });
}

const generatedAt = new Date().toISOString();
const runId = argValue("--run-id") || `multishot-image2-smoke-${generatedAt.replace(/[:.]/g, "-")}`;
const packageRoot = path.resolve(argValue("--fixture-root") || path.join("real-test-sandbox", runId));
const reportPath = path.join(packageRoot, "report", "report.json");
const shotCount = clampInteger(safeInteger(argValue("--shot-count") || argValue("--shots"), 4), 3, 8);
const maxConcurrency = clampInteger(safeInteger(argValue("--max-concurrency") || process.env.VIBE_MULTISHOT_IMAGE2_MAX_CONCURRENCY, 3), 1, 3);
const retryConcurrency = clampInteger(safeInteger(argValue("--retry-concurrency") || process.env.VIBE_MULTISHOT_IMAGE2_RETRY_CONCURRENCY, Math.min(2, maxConcurrency)), 1, maxConcurrency);
const maxAutoRetries = clampInteger(safeInteger(argValue("--max-auto-retries") || process.env.VIBE_MULTISHOT_IMAGE2_MAX_AUTO_RETRIES, 2), 0, 2);
const requestedSize = argValue("--size") || process.env.VIBE_MULTISHOT_IMAGE2_SIZE || IMAGE2_GENERATE_DEFAULT_SIZE;
const requestedAspectRatio = argValue("--aspect-ratio") || process.env.VIBE_MULTISHOT_IMAGE2_ASPECT_RATIO || IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO;
const timeoutMs = safeInteger(argValue("--timeout-ms") || process.env.VIBE_IMAGE2_PROVIDER_TIMEOUT_MS, 900_000);
const liveRequested = argFlag("--live") || process.env.VIBE_REAL_SMALL_PROJECT_MULTISHOT_LIVE === "1";
const liveConfirmPhrase = argValue("--confirm-live") || process.env.VIBE_REAL_SMALL_PROJECT_MULTISHOT_CONFIRM || "";
const liveConfirmed = liveConfirmPhrase === "submit-multishot-image2";
const mode: RunMode = liveRequested ? "live" : "mock";
const mockScenario = argValue("--mock-scenario") || "recoverable-start-frame";
const finalMissingId = argValue("--mock-final-missing");

mkdirSync(packageRoot, { recursive: true });
mkdirSync(path.join(packageRoot, "assets"), { recursive: true });
mkdirSync(path.join(packageRoot, "start-frames"), { recursive: true });
mkdirSync(path.join(packageRoot, "receipts"), { recursive: true });
mkdirSync(path.join(packageRoot, "report"), { recursive: true });

const retryPolicy: ProviderRetryPolicy = {
  maxConcurrency,
  retryConcurrency,
  maxAutoRetries,
  baseDelayMs: clampInteger(safeInteger(process.env.VIBE_MULTISHOT_IMAGE2_RETRY_BASE_DELAY_MS, 0), 0, 60_000),
  maxDelayMs: clampInteger(safeInteger(process.env.VIBE_MULTISHOT_IMAGE2_RETRY_MAX_DELAY_MS, 0), 0, 60_000),
  jitterRatio: 0,
  retryableFailureKinds: ["timeout", "rate_limit", "server_error", "network_error", "provider_missing"],
  terminalFailureKinds: ["auth", "validation_error", "content_policy", "qa_failed", "cancelled"],
};

let apiKey = "";
let baseUrl = "https://lanyiapi.com";
let model = "gpt-image-2";
if (liveRequested) {
  const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
  baseUrl = (providerStatus?.baseUrl || baseUrl).replace(/\/+$/, "");
  model = providerStatus?.imageModel || model;
  apiKey = getProviderApiKey("lanyi-image2") || process.env.VIBE_IMAGE2_API_KEY || "";
  const blockers = [
    !liveConfirmed ? "VIBE_REAL_SMALL_PROJECT_MULTISHOT_CONFIRM must equal submit-multishot-image2, or pass --confirm-live=submit-multishot-image2." : "",
    !apiKey ? "Lanyi Image2 API key is required for live submit." : "",
  ].filter(Boolean);
  if (blockers.length) {
    writeBlockedLiveReport({
      packageRoot,
      reportPath,
      runId,
      generatedAt,
      blockers,
      maxConcurrency,
      retryConcurrency,
      maxAutoRetries,
      requestedSize,
      requestedAspectRatio,
    });
    console.error(`Image2 multi-shot live submit blocked before provider call. Report: ${reportPath}`);
    process.exit(2);
  }
}

const shots = buildShots(shotCount);
const assetPlanList = assetPlans(packageRoot, runId, shots.map((shot) => shot.id));
const recoverableFailureId = mockScenario === "recoverable-start-frame" && shots[1]
  ? `${shots[1].id}_start_frame`
  : undefined;

const assetPhase = await runPhase({
  phase: "assets",
  packageRoot,
  runId,
  mode,
  plans: assetPlanList,
  retryPolicy,
  requestedSize,
  requestedAspectRatio,
  apiKey,
  baseUrl,
  model,
  timeoutMs,
  finalMissingId,
});

const assetRefs = assetPhase.records
  .filter((record) => record.outputPath)
  .map((record) => packageRelative(packageRoot, record.outputPath))
  .filter((item): item is string => Boolean(item));
const startFramePlanList = startFramePlans(packageRoot, shots, assetRefs);

const startFramePhase = await runPhase({
  phase: "start_frames",
  packageRoot,
  runId,
  mode,
  plans: startFramePlanList,
  retryPolicy,
  requestedSize,
  requestedAspectRatio,
  apiKey,
  baseUrl,
  model,
  timeoutMs,
  recoverableFailureId,
  finalMissingId,
});

const records = [...assetPhase.records, ...startFramePhase.records];
assertNonEmptyOutputs(records);

const projectVibe = buildProjectVibe({
  packageRoot,
  runId,
  generatedAt,
  shots,
  records,
});
writeJson(path.join(packageRoot, "Project.vibe"), projectVibe);

const providerCalledExternal = records.some((record) => record.providerCalledExternal);
const mockProviderCalled = records.some((record) => record.mockProviderCalled);
const exportManifestPath = writePackageManifest({
  packageRoot,
  runId,
  generatedAt,
  shots,
  records,
  reportPath,
  mode,
  providerCalledExternal,
  mockProviderCalled,
  maxConcurrency,
  retryConcurrency,
  maxAutoRetries,
  requestedSize,
  requestedAspectRatio,
});

const summary = {
  totalOutputs: records.length,
  assetsPlanned: assetPlanList.length,
  assetsNeedsReview: records.filter((record) => record.phase === "assets" && record.returnStatus === "needs_review").length,
  startFramesPlanned: startFramePlanList.length,
  startFramesNeedsReview: records.filter((record) => record.phase === "start_frames" && record.returnStatus === "needs_review").length,
  missing: records.filter((record) => record.returnStatus === "missing").length,
  recoveredFromExisting: records.filter((record) => record.recoveredFromExisting).length,
  retryAttempted: assetPhase.retryAttemptedIds.length + startFramePhase.retryAttemptedIds.length,
  retryRecovered: assetPhase.retryRecoveredIds.length + startFramePhase.retryRecoveredIds.length,
  promotionAllowed: false,
};

const report = {
  schemaVersion: "image2_multishot_smoke_report_v1",
  runId,
  generatedAt,
  packageRoot,
  mode,
  status: summary.missing === 0 ? "completed_needs_review" : "completed_with_missing_outputs",
  ok: summary.missing === 0,
  story: {
    title: "Image2 Multi-Shot Smoke Package",
    shotCount: shots.length,
    shotIds: shots.map((shot) => shot.id),
  },
  provider: {
    providerId: "lanyi-image2",
    model,
    baseUrl: mode === "live" ? baseUrl : "mock://local-image2-smoke",
    providerCalledExternal,
    mockProviderCalled,
    requestedSize,
    requestedAspectRatio,
    maxConcurrency,
    retryConcurrency,
    maxAutoRetries,
    rawCredentialMaterialIncluded: false,
  },
  summary,
  phases: {
    assets: {
      requestedCount: assetPhase.requestedCount,
      returnedCount: assetPhase.returnedCount,
      recoveredFromExistingCount: assetPhase.recoveredFromExistingCount,
      retryAttemptedIds: assetPhase.retryAttemptedIds,
      retryRecoveredIds: assetPhase.retryRecoveredIds,
      missingIds: assetPhase.missingIds,
      retrySummary: assetPhase.retryState.summary,
    },
    startFrames: {
      requestedCount: startFramePhase.requestedCount,
      returnedCount: startFramePhase.returnedCount,
      recoveredFromExistingCount: startFramePhase.recoveredFromExistingCount,
      retryAttemptedIds: startFramePhase.retryAttemptedIds,
      retryRecoveredIds: startFramePhase.retryRecoveredIds,
      missingIds: startFramePhase.missingIds,
      retrySummary: startFramePhase.retryState.summary,
    },
  },
  outputs: records.map((record) => ({
    ...record,
    outputPath: packageRelative(packageRoot, record.outputPath),
    receiptPath: packageRelative(packageRoot, record.receiptPath),
    promptPath: packageRelative(packageRoot, record.promptPath),
  })),
  providerResults: [...assetPhase.providerResults, ...startFramePhase.providerResults],
  recoverability: {
    resumable: true,
    resumeKey: "same --fixture-root and --run-id",
    recoveredFromExistingCount: summary.recoveredFromExisting,
    retrySchedulerStatePaths: [
      "receipts/assets-retry-scheduler-state.json",
      "receipts/start-frames-retry-scheduler-state.json",
    ],
    retryAttemptReceiptsPath: [
      "receipts/assets-retry-attempt-receipts.json",
      "receipts/start-frames-retry-attempt-receipts.json",
    ],
    partialReturnPolicy: "returned outputs stay needs_review; missing outputs stay visible and retryable on rerun.",
  },
  exportPackage: {
    projectVibePath: "Project.vibe",
    assetsDir: "assets/",
    startFramesDir: "start-frames/",
    receiptsDir: "receipts/",
    reportDir: "report/",
    manifestPath: packageRelative(packageRoot, exportManifestPath),
  },
  advancedBranches: {
    endFrameStatus: "skipped",
    videoStatus: "skipped",
    endpointLoopStatus: "skipped",
    transformationStatus: "skipped",
    reason: "Default smoke covers the stable front half: assets plus start frames only.",
  },
};

writeJson(reportPath, report);
const summaryMarkdownPath = writeSummaryMarkdown({
  packageRoot,
  reportPath,
  runId,
  mode,
  records,
  providerCalledExternal,
  maxConcurrency,
  retryConcurrency,
  maxAutoRetries,
});

console.log(JSON.stringify({
  status: report.status,
  ok: report.ok,
  mode,
  packageRoot,
  reportPath,
  summaryMarkdownPath,
  summary,
}, null, 2));

if (!report.ok) process.exit(2);
