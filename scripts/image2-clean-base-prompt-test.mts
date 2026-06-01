import {
  buildImage2StoryboardReferencePrompt,
  buildImage2VideoStartAnchorPrompt,
  buildImage2CleanBasePrompt,
  compactImage2PromptSource,
  IMAGE2_CLEAN_BASE_PROMPT_VERSION,
  IMAGE2_STORYBOARD_REFERENCE_PROMPT_VERSION,
  IMAGE2_VIDEO_START_ANCHOR_PROMPT_VERSION,
} from "../src/core/image2PromptBase.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const overloadedPrompt = [
  "16:9 cinematic anime keyframe. Shot RV01: a girl walks into a rain-soaked observatory.",
  "Character: Lina, blue coat, small shoulder bag, tired eyes, wet hair, scarf, gloves, boots, many pins.",
  "Scene: old dome, wet stairs, moss, neon puddles, signs, posters, cables, boxes, dozens of tiny props.",
  "Reference path: /Users/example/project/assets/lina.png",
  ...Array.from({ length: 30 }, (_, index) => `extra decorative detail ${index + 1}`),
].join(" ");

const compacted = compactImage2PromptSource(overloadedPrompt, 300);
assert(compacted.length <= 300, "compacted source should stay within the requested budget");
assert(!compacted.includes("/Users/example"), "compacted source must remove local file paths");
assert(!compacted.includes("extra decorative detail 30"), "compacted source should drop late overload details");

const prompt = buildImage2CleanBasePrompt({
  sourcePrompt: overloadedPrompt,
  frameRole: "start_frame",
  aspectRatio: "16:9",
  maxSourceCharacters: 300,
});

assert(prompt.includes(IMAGE2_CLEAN_BASE_PROMPT_VERSION), "base prompt version marker should be present");
assert(prompt.includes("aspect ratio 16:9"), "prompt should preserve aspect ratio");
assert(prompt.includes("Prefer a simple composition"), "prompt should carry the clean composition rule");
assert(prompt.includes("Shot facts:"), "prompt should separate base guidance from shot facts");
assert(!prompt.includes("/Users/example"), "provider prompt must not include local file paths");
assert(!prompt.includes("extra decorative detail 30"), "provider prompt should avoid detail overload");
assert(buildImage2CleanBasePrompt({ sourcePrompt: prompt }) === prompt, "base prompt wrapping should be idempotent");

const videoStartPrompt = buildImage2VideoStartAnchorPrompt({
  sourcePrompt: overloadedPrompt,
  aspectRatio: "16:9",
  subjectAnchor: "Lina stands left of center with a shoulder bag.",
  motionIntent: "Lina takes one careful step forward while rain drips from the railing.",
});
assert(videoStartPrompt.includes(IMAGE2_VIDEO_START_ANCHOR_PROMPT_VERSION), "video start anchor marker should be present");
assert(videoStartPrompt.includes("first frame for image-to-video"), "video start prompt should name the I2V purpose");
assert(videoStartPrompt.includes("Close-ups are valid"), "video start prompt should allow close-ups when the shot calls for them");
assert(videoStartPrompt.includes("micro-motion"), "video start prompt should define close-up motion language");
assert(videoStartPrompt.includes("pre-action or early-action pose"), "video start prompt should ask for a motion-ready pose");
assert(videoStartPrompt.includes("Avoid peak-action freezes"), "video start prompt should block poster-like peak action");
assert(videoStartPrompt.includes("Next motion intent:"), "video start prompt should carry next-motion intent");
assert(!videoStartPrompt.includes("/Users/example"), "video start prompt must not leak local paths");
assert(buildImage2VideoStartAnchorPrompt({ sourcePrompt: videoStartPrompt }) === videoStartPrompt, "video start prompt wrapping should be idempotent");

const storyboardPrompt = buildImage2StoryboardReferencePrompt({
  sourcePrompt: overloadedPrompt,
  aspectRatio: "16:9",
  sceneBaselineLabel: "雨后学校天台",
  shotCamera: "中景，轻微推进，三分之二侧面",
  dialogueContext: "日语女声台词，情绪克制",
  maxSourceCharacters: 320,
});
assert(storyboardPrompt.includes(IMAGE2_STORYBOARD_REFERENCE_PROMPT_VERSION), "storyboard prompt marker should be present");
assert(storyboardPrompt.includes("black-and-white anime storyboard sheet"), "storyboard prompt must name storyboard sheet purpose");
assert(storyboardPrompt.includes("Use text shot facts as the main source of truth"), "storyboard prompt should stay text-led");
assert(storyboardPrompt.includes("one scene baseline image"), "storyboard prompt should allow exactly one scene baseline");
assert(storyboardPrompt.includes("weather, environment, spatial anchors, and atmosphere only"), "storyboard prompt must constrain scene baseline role");
assert(storyboardPrompt.includes("locked character references"), "storyboard prompt should allow locked character references");
assert(storyboardPrompt.includes("use them only for identity"), "storyboard prompt must constrain character reference authority");
assert(storyboardPrompt.includes("prop references"), "storyboard prompt should allow prop references");
assert(storyboardPrompt.includes("never draw a prop reference image as its own storyboard panel"), "storyboard prompt must prevent prop references becoming video beats");
assert(storyboardPrompt.includes("Reference dimension locking"), "storyboard prompt must separate reference duties");
assert(storyboardPrompt.includes("Do not blend all references"), "storyboard prompt must block hybrid reference blending");
assert(storyboardPrompt.includes("strong main composition"), "storyboard prompt must request a main composition");
assert(storyboardPrompt.includes("supporting action panels"), "storyboard prompt must allow action panels");
assert(storyboardPrompt.includes("do not force a fixed number"), "storyboard prompt must keep layout flexible");
assert(storyboardPrompt.includes("arrows"), "storyboard prompt must request motion arrows");
assert(storyboardPrompt.includes("multiple characters"), "storyboard prompt must include multi-character blocking guidance");
assert(storyboardPrompt.includes("no dialogue text"), "storyboard prompt must block dialogue/subtitles");
assert(!storyboardPrompt.includes("/Users/example"), "storyboard prompt must not leak local paths");
assert(
  buildImage2StoryboardReferencePrompt({ sourcePrompt: storyboardPrompt }) === storyboardPrompt,
  "storyboard prompt wrapping should be idempotent",
);

console.log("image2-clean-base-prompt-test: ok");
