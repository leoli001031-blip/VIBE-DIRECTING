export const IMAGE2_CLEAN_BASE_PROMPT_VERSION = "image2_clean_base_prompt_v1";
export const IMAGE2_VIDEO_START_ANCHOR_PROMPT_VERSION = "image2_video_start_anchor_prompt_v1";
export const IMAGE2_STORYBOARD_REFERENCE_PROMPT_VERSION = "image2_storyboard_reference_prompt_v2";

export const IMAGE2_CLEAN_BASE_PROMPT = [
  `${IMAGE2_CLEAN_BASE_PROMPT_VERSION}: create one clean, readable cinematic frame for this shot.`,
  "Prefer a simple composition, one clear focal action, restrained detail, natural lighting, and a limited palette.",
  "Use attached or locked references as authority when present; keep identity, scene layout, and style stable.",
  "If the shot facts declare a non-photographic style such as anime, manga, cel animation, sketch, or illustration, preserve that style exactly and do not convert it into live-action photography.",
  "Do not add extra characters, readable text, labels, UI, logos, watermarks, or decorative clutter unless the shot facts explicitly require them.",
].join(" ");

export const IMAGE2_VIDEO_START_ANCHOR_PROMPT = [
  `${IMAGE2_VIDEO_START_ANCHOR_PROMPT_VERSION}: this image is a first frame for image-to-video, not a poster, final key art, or generic illustration.`,
  "Make the frame easy for video: choose the shot scale that fits the intended action. Close-ups are valid for emotion, eyes, breath, lips, fingers, or prop details; medium/wide frames are better for body movement, blocking, travel, or camera moves.",
  "For close-ups, keep facial geometry stable, avoid cropping the chin/forehead too tightly, preserve eye direction, and use micro-motion such as blinking, breath, tiny gaze shifts, or a small hand/prop movement.",
  "For body/action shots, keep readable full/half body when motion involves the body and leave at least 5% safe margin around important characters and props.",
  "Create a pre-action or early-action pose with a clear next motion; leave screen space in the direction of travel or gesture.",
  "Avoid peak-action freezes, extreme close-ups, cropped limbs, motion blur, fisheye distortion, dense tiny background detail, crowds, complex text, and multiple simultaneous actions.",
  "Keep geometry stable for video: clean hands, stable face, simple silhouette separation, consistent attached reference identity/style, and no invented live-action reinterpretation.",
].join(" ");

export const IMAGE2_STORYBOARD_REFERENCE_PROMPT = [
  `${IMAGE2_STORYBOARD_REFERENCE_PROMPT_VERSION}: create one clean black-and-white anime storyboard sheet in 16:9 for video generation.`,
  "Use text shot facts as the main source of truth for blocking, camera, gesture, and action.",
  "If one scene baseline image is attached, use it only for location, weather, time of day, spatial anchors, and atmosphere.",
  "If locked character references are attached, use them only for identity, hair, outfit silhouette, body design, and screen-left/screen-right continuity; simplify them into storyboard line art and do not redesign them.",
  "If prop references are attached, use them only for object shape, scale, material cue, and hand interaction; never draw a prop reference image as its own storyboard panel, cutaway, background, or separate video beat.",
  "Reference dimension locking: scene references lock environment, character references lock identity, prop references lock objects. Do not blend all references into a new hybrid style board.",
  "Do not copy final color, lighting, or painting style from the scene baseline; translate the environment into clean storyboard line art.",
  "Layout: start from a strong main composition that locks scene geography, screen direction, character positions, camera angle, key prop placement, and movement direction.",
  "Add any supporting action panels, inserts, arrows, thumbnails, or brief notes that help explain actor movement, camera movement, eyelines, hand/prop details, and environment motion.",
  "Let the storyboard layout be natural for this shot; do not force a fixed number of small panels.",
  "For multiple characters, lock screen-left/screen-right positions and eyelines in the main composition, keep the 180-degree side consistent, and use over-the-shoulder, reaction, insert, or hand/prop details without changing established positions.",
  "A compact note strip may contain short production notes/icons such as CAMERA, ACTION, or BACKGROUND; no dialogue text, no subtitles, no speech bubbles, no watermark.",
].join(" ");

export interface BuildImage2CleanBasePromptInput {
  sourcePrompt: string;
  frameRole?: string;
  aspectRatio?: string;
  maxSourceCharacters?: number;
}

export interface BuildImage2VideoStartAnchorPromptInput extends BuildImage2CleanBasePromptInput {
  motionIntent?: string;
  subjectAnchor?: string;
}

export interface BuildImage2StoryboardReferencePromptInput extends BuildImage2CleanBasePromptInput {
  sceneBaselineLabel?: string;
  shotCamera?: string;
  dialogueContext?: string;
}

const DEFAULT_MAX_SOURCE_CHARACTERS = 640;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function stripLocalPathReferences(value: string): string {
  return value.replace(
    /(?:file:\/\/|\/Users\/|[A-Za-z]:[\\/]|\.{1,2}\/|[\w.-]+\/)[^\s"'()]+\.(?:png|jpe?g|webp|gif|tiff?)(?:\b|$)/gi,
    "attached reference image",
  );
}

function sourceSegments(value: string): string[] {
  return stripLocalPathReferences(value)
    .split(/(?:\r?\n|[。！？!?;；]\s*)/u)
    .map(cleanText)
    .filter(Boolean);
}

export function compactImage2PromptSource(sourcePrompt: string, maxCharacters = DEFAULT_MAX_SOURCE_CHARACTERS): string {
  const maxLength = Math.max(160, Math.floor(maxCharacters));
  const normalized = cleanText(stripLocalPathReferences(sourcePrompt));
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  const selected: string[] = [];
  let total = 0;
  for (const segment of sourceSegments(sourcePrompt)) {
    const nextLength = total + segment.length + (selected.length ? 2 : 0);
    if (nextLength > maxLength) break;
    selected.push(segment);
    total = nextLength;
  }
  const compacted = selected.join(". ");
  if (compacted.length >= 80) {
    return compacted.length <= maxLength
      ? compacted
      : `${compacted.slice(0, maxLength - 3).trim()}...`;
  }
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

export function buildImage2CleanBasePrompt(input: BuildImage2CleanBasePromptInput): string {
  const existing = typeof input.sourcePrompt === "string" ? input.sourcePrompt.trim() : "";
  if (existing.includes(IMAGE2_CLEAN_BASE_PROMPT_VERSION)) return existing;

  const source = compactImage2PromptSource(input.sourcePrompt, input.maxSourceCharacters);
  const frameRole = cleanText(input.frameRole) || "start_frame";
  const aspectRatio = cleanText(input.aspectRatio);
  return [
    IMAGE2_CLEAN_BASE_PROMPT,
    `Frame role: ${frameRole}${aspectRatio ? `, aspect ratio ${aspectRatio}` : ""}.`,
    "Shot facts:",
    source || "Use the current shot facts and locked project references.",
    "If the facts feel dense, prioritize subject, action, scene, camera distance, and mood over small surface details.",
  ].join("\n");
}

export function buildImage2VideoStartAnchorPrompt(input: BuildImage2VideoStartAnchorPromptInput): string {
  const existing = typeof input.sourcePrompt === "string" ? input.sourcePrompt.trim() : "";
  if (existing.includes(IMAGE2_VIDEO_START_ANCHOR_PROMPT_VERSION)) return existing;

  const source = compactImage2PromptSource(input.sourcePrompt, input.maxSourceCharacters ?? 1200);
  const motionIntent = cleanText(input.motionIntent);
  const subjectAnchor = cleanText(input.subjectAnchor);
  const frameRole = cleanText(input.frameRole) || "video_start_anchor";
  const aspectRatio = cleanText(input.aspectRatio);
  return [
    IMAGE2_CLEAN_BASE_PROMPT,
    IMAGE2_VIDEO_START_ANCHOR_PROMPT,
    `Frame role: ${frameRole}${aspectRatio ? `, aspect ratio ${aspectRatio}` : ""}.`,
    subjectAnchor ? `Subject anchor: ${subjectAnchor}.` : "",
    motionIntent ? `Next motion intent: ${motionIntent}.` : "",
    "Shot facts:",
    source || "Use the current shot facts and locked project references.",
    "If the facts feel dense, prioritize subject, shot scale, next motion, scene, camera distance, and mood over small surface details.",
  ].filter(Boolean).join("\n");
}

export function buildImage2StoryboardReferencePrompt(input: BuildImage2StoryboardReferencePromptInput): string {
  const existing = typeof input.sourcePrompt === "string" ? input.sourcePrompt.trim() : "";
  if (existing.includes(IMAGE2_STORYBOARD_REFERENCE_PROMPT_VERSION)) return existing;

  const source = compactImage2PromptSource(input.sourcePrompt, input.maxSourceCharacters ?? 900);
  const frameRole = cleanText(input.frameRole) || "storyboard_reference";
  const aspectRatio = cleanText(input.aspectRatio) || "16:9";
  const sceneBaselineLabel = cleanText(input.sceneBaselineLabel);
  const shotCamera = cleanText(input.shotCamera);
  const dialogueContext = cleanText(input.dialogueContext);
  return [
    IMAGE2_STORYBOARD_REFERENCE_PROMPT,
    `Frame role: ${frameRole}, aspect ratio ${aspectRatio}.`,
    sceneBaselineLabel
      ? `Attached scene baseline: ${sceneBaselineLabel}. Use it for weather, environment, spatial anchors, and atmosphere only.`
      : "Attached scene baseline: none. Use only the written scene facts for weather and environment.",
    shotCamera ? `Camera plan: ${shotCamera}.` : "",
    dialogueContext ? `Dialogue context for acting only: ${dialogueContext}.` : "",
    "Shot facts:",
    source || "Use the current shot facts to make one clear, drawable storyboard frame.",
    "Keep the drawing simple enough for Seedance to read composition and motion, while preserving scene/weather continuity.",
  ].filter(Boolean).join("\n");
}
