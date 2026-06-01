import assert from "node:assert/strict";
import {
  IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  IMAGE2_GENERATE_DEFAULT_SIZE,
  IMAGE2_GENERATE_SIZE_PRESETS,
  JIMENG_VIDEO_DEFAULT_RESOLUTION,
  JIMENG_COMPATIBLE_VIDEO_720P_SIZE_PRESETS,
  image2GenerateSizeForAspectRatio,
  jimengCompatibleVideoInputSizeForAspectRatio,
} from "../src/core/providerPolicy.ts";

const expectedImage2GenerateSizes = {
  "16:9": "1280x720",
  "4:3": "960x720",
  "1:1": "960x960",
  "3:4": "720x960",
  "9:16": "720x1280",
  "21:9": "1456x624",
} as const;

const expectedJimengVideoInputSizes = {
  "16:9": "1280x720",
  "4:3": "960x720",
  "1:1": "960x960",
  "3:4": "720x960",
  "9:16": "720x1280",
  "21:9": "1456x624",
} as const;

const ratioParts = {
  "16:9": [16, 9],
  "4:3": [4, 3],
  "1:1": [1, 1],
  "3:4": [3, 4],
  "9:16": [9, 16],
  "21:9": [21, 9],
} as const;

function parseSize(size: string) {
  const match = /^(\d+)x(\d+)$/.exec(size);
  assert(match, `Invalid size format: ${size}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

assert.equal(JIMENG_VIDEO_DEFAULT_RESOLUTION, "720p", "MVP default should stay on Jimeng's low video tier");
assert.equal(IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO, "16:9", "Default video frame aspect should stay 16:9");
assert.equal(IMAGE2_GENERATE_DEFAULT_SIZE, "1280x720", "Default Image2 start-frame size should match the Jimeng 720p input grid");
assert.deepEqual(IMAGE2_GENERATE_SIZE_PRESETS, expectedImage2GenerateSizes, "Image2 generate size presets drifted");
assert.deepEqual(IMAGE2_GENERATE_SIZE_PRESETS, JIMENG_COMPATIBLE_VIDEO_720P_SIZE_PRESETS, "Image2 start-frame presets must stay unified with Jimeng-compatible video inputs");
for (const [aspectRatio, size] of Object.entries(IMAGE2_GENERATE_SIZE_PRESETS)) {
  const { width, height } = parseSize(size);
  const [ratioWidth, ratioHeight] = ratioParts[aspectRatio as keyof typeof ratioParts];
  assert.equal(width * ratioHeight, height * ratioWidth, `${aspectRatio} Image2 preset must preserve the requested aspect exactly`);
  assert.equal(image2GenerateSizeForAspectRatio(aspectRatio), size, `${aspectRatio} Image2 lookup must return the generate preset size`);
}
assert.equal(image2GenerateSizeForAspectRatio("unsupported"), IMAGE2_GENERATE_DEFAULT_SIZE, "Unsupported Image2 aspect should fall back to default");
assert.deepEqual(JIMENG_COMPATIBLE_VIDEO_720P_SIZE_PRESETS, expectedJimengVideoInputSizes, "Jimeng-compatible 720p video presets drifted");

for (const [aspectRatio, size] of Object.entries(JIMENG_COMPATIBLE_VIDEO_720P_SIZE_PRESETS)) {
  const { width, height } = parseSize(size);
  const [ratioWidth, ratioHeight] = ratioParts[aspectRatio as keyof typeof ratioParts];
  const pixels = width * height;

  assert.equal(width % 16, 0, `${aspectRatio} width must be a 16px multiple for Image2`);
  assert.equal(height % 16, 0, `${aspectRatio} height must be a 16px multiple for Image2`);
  assert(width <= 3840 && height <= 3840, `${aspectRatio} must stay inside Image2 max side bounds`);
  assert(pixels >= 655_360 && pixels <= 8_294_400, `${aspectRatio} must stay inside Image2 total pixel bounds`);
  assert(Math.max(width, height) / Math.min(width, height) <= 3, `${aspectRatio} must stay inside Image2 max ratio bounds`);
  assert.equal(width * ratioHeight, height * ratioWidth, `${aspectRatio} preset must preserve the requested aspect exactly`);
  assert.equal(jimengCompatibleVideoInputSizeForAspectRatio(aspectRatio), size, `${aspectRatio} lookup must return the Jimeng-compatible video preset size`);
}

assert.equal(jimengCompatibleVideoInputSizeForAspectRatio("unsupported"), expectedJimengVideoInputSizes["16:9"], "Unsupported Jimeng-compatible video aspect should fall back to 16:9 720p");

console.log("image2-aspect-ratio-presets-test: ok");
