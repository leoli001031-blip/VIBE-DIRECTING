import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildImage2StoryboardReferencePlan } from "../src/core/storyboardReferencePipeline.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type GenerationMode = "scene-state-anchor" | "storyboard-reference";
type ReferencePolicy = "all" | "scene-only" | "none" | "custom";

type ReferenceInput = {
  role: string;
  path: string;
};

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function allArgValues(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith(`${name}=`)) values.push(arg.slice(name.length + 1));
    else if (arg === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeId(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scene-state-anchor";
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function normalizeGenerationMode(value: string | undefined): GenerationMode {
  if (value === "storyboard" || value === "storyboard-reference") return "storyboard-reference";
  return "scene-state-anchor";
}

function normalizeReferencePolicy(value: string | undefined, mode: GenerationMode): ReferencePolicy {
  if (value === "none" || value === "no-references") return "none";
  if (value === "all") return "all";
  if (value === "custom") return "custom";
  if (value === "scene" || value === "scene-only" || value === "scene_baseline") return "scene-only";
  return mode === "storyboard-reference" ? "scene-only" : "all";
}

function defaultReferences(repoRoot: string, policy: ReferencePolicy): ReferenceInput[] {
  const root = path.join(repoRoot, "real-test-sandbox/anime-manga-stylefix-20260520-01/assets");
  const references = [
    { role: "character_identity", path: path.join(root, "characters/hina-main-character.png") },
    { role: "scene_baseline", path: path.join(root, "scenes/after-rain-school-rooftop.png") },
    { role: "prop_reference", path: path.join(root, "props/blue-cassette-case.png") },
  ];
  if (policy === "none" || policy === "custom") return [];
  if (policy === "scene-only") return references.filter((reference) => reference.role === "scene_baseline");
  return references;
}

function readReferences(repoRoot: string, mode: GenerationMode): ReferenceInput[] {
  if (argFlag("--no-references")) return [];
  const values = allArgValues("--reference");
  if (values.length) {
    const parsed = values.filter((value) => value.trim()).map((value, index) => {
      const separator = value.indexOf("=");
      if (separator > 0) {
        return { role: value.slice(0, separator), path: path.resolve(value.slice(separator + 1)) };
      }
      return {
        role: mode === "storyboard-reference" && index === 0 ? "scene_baseline" : `reference_${index + 1}`,
        path: path.resolve(value),
      };
    });
    return mode === "storyboard-reference"
      ? parsed.filter((reference) => reference.role === "scene_baseline").slice(0, 1)
      : parsed;
  }
  const policy = normalizeReferencePolicy(argValue("--reference-policy"), mode);
  return defaultReferences(repoRoot, policy);
}

function buildDefaultPrompt(mode: GenerationMode, references: ReferenceInput[], shotId: string): string {
  if (mode === "storyboard-reference") {
    const sceneReference = references.find((reference) => reference.role === "scene_baseline");
    return buildImage2StoryboardReferencePlan({
      shotId,
      shotTitle: "雨后学校天台，少女握紧蓝色磁带盒",
      camera: "medium shot, gentle slow push-in, three-quarter side angle, quiet breathing rhythm",
      shotDescription: [
        "A teenage anime heroine stands left of center beside a wet rooftop railing.",
        "She holds a small blue cassette case close to her chest with both hands.",
        "The railing, rooftop puddles, corridor roofline, and cloudy after-rain sky make the location and weather readable.",
        "Her body is still enough for a storyboard reference, with subtle tension in her fingers and gaze.",
      ].join(" "),
      dialogue: "A short restrained line of Japanese dialogue; acting should feel hurt but controlled.",
      sceneBaseline: sceneReference
        ? { id: "scene_baseline_default", role: "scene_baseline", path: sceneReference.path, label: "after-rain school rooftop" }
        : undefined,
    }).prompt;
  }

  return [
    "Create one 16:9 Japanese TV anime scene-state anchor frame for video generation.",
    "",
    "Reference roles:",
    "- Image 1 is the character identity and 2D anime style lock: keep Hina's face shape, hair, age, uniform silhouette, and hand-drawn cel-shaded look.",
    "- Image 2 is the scene layout and atmosphere lock: use the after-rain school rooftop/corridor, wet railing, soft cloudy light, and reflective floor cues.",
    "- Image 3 is the prop lock: the translucent blue cassette case must be in Hina's hands.",
    "",
    "Frame composition:",
    "Hina stands left of center beside the wet rooftop railing, half-body medium shot, side-facing the camera at a gentle three-quarter angle. She holds the blue cassette case near her chest with both hands. The railing runs behind her from left to right, the corridor roofline recedes into depth, and the rainy rooftop environment is visibly present instead of a plain background.",
    "",
    "Video readiness:",
    "This is a quiet start frame before motion. Leave room for a slow push-in. Hina can later breathe, blink, and lower her gaze to the cassette. Keep the pose natural but stable, with readable hands and a clear prop silhouette.",
    "",
    "Style and negative constraints:",
    "Pure 2D anime, clean line art, flat cel shading, painted anime background, no live action, no photorealism, no 3D render, no glossy CG, no subtitles, no logos, no extra characters, no collage, no split-screen.",
  ].join("\n");
}

const repoRoot = process.cwd();
const runId = safeId(argValue("--run-id") || `scene-state-anchor-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const packageRoot = path.resolve(argValue("--output-root") || path.join(repoRoot, "real-test-sandbox", runId));
const imageDir = path.join(packageRoot, "scene-state");
const receiptsDir = path.join(packageRoot, "receipts");
const reportDir = path.join(packageRoot, "report");
mkdirSync(imageDir, { recursive: true });
mkdirSync(receiptsDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, LANYI_API_KEY, or OPENAI_API_KEY is required for live Image2 scene-state anchor generation.");
}

const baseUrl = argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || process.env.LANYI_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com/v1";
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || process.env.IMAGE_MODEL || providerStatus?.imageModel || "gpt-image-2";
const size = argValue("--size") || "1280x720";
const quality = argValue("--quality") || "standard";
const shotId = safeId(argValue("--shot-id") || "AN01");
const mode = normalizeGenerationMode(argValue("--mode"));
const artifactSlug = mode === "storyboard-reference" ? "storyboard-reference" : "scene-state-anchor";
const outputPath = path.join(imageDir, `${shotId}-${artifactSlug}.png`);
const rawSsePath = path.join(receiptsDir, `${shotId}-${artifactSlug}.sse.txt`);
const promptPath = path.join(receiptsDir, `${shotId}-${artifactSlug}.prompt.md`);
const receiptPath = path.join(receiptsDir, `${shotId}-${artifactSlug}.json`);
const reportPath = path.join(reportDir, `${artifactSlug}-report.json`);

const references = readReferences(repoRoot, mode);
const prompt = argValue("--prompt") || buildDefaultPrompt(mode, references, shotId);

writeFileSync(promptPath, `${prompt}\n`);

const referenceImages = references.map((reference) => {
  if (!existsSync(reference.path)) throw new Error(`Missing reference image: ${reference.path}`);
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

const result = await fetchLanyiImageViaResponsesStream({
  apiKey,
  baseUrl,
  model,
  prompt,
  size,
  quality,
  referenceImages,
  timeoutMs: 8 * 60 * 1000,
  providerOperation: mode === "storyboard-reference"
    ? "responses.image_generation_storyboard_reference"
    : "responses.image_generation_scene_state_anchor",
});

if (result.rawSseBytes) writeFileSync(rawSsePath, result.rawSseBytes);

const receipt = {
  schemaVersion: "scene_state_anchor_image2_smoke_v1",
  mode,
  runId,
  shotId,
  status: result.ok ? "success" : "failed",
  ok: result.ok,
  providerId: "lanyi-image2-responses-stream",
  model,
  size,
  quality,
  baseUrlRedacted: true,
  rawApiKeyStored: false,
  promptPath,
  outputPath: result.ok ? outputPath : undefined,
  rawSsePath: result.rawSseBytes ? rawSsePath : undefined,
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

if (result.ok) {
  writeFileSync(outputPath, result.bytes);
}
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify({
  schemaVersion: "scene_state_anchor_image2_smoke_report_v1",
  mode,
  runId,
  shotId,
  ok: result.ok,
  outputPath: result.ok ? outputPath : undefined,
  receiptPath,
  promptPath,
  rawSsePath: result.rawSseBytes ? rawSsePath : undefined,
  references: receipt.references,
  providerResponseMetadata: result.providerResponseMetadata,
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: result.ok,
  mode,
  runId,
  shotId,
  outputPath: result.ok ? outputPath : undefined,
  reportPath,
  providerRequestId: result.providerRequestId,
  referenceInputCount: result.providerResponseMetadata?.referenceInputCount,
  elapsedMs: result.providerResponseMetadata?.elapsedMs,
}, null, 2));

if (!result.ok) process.exit(2);
