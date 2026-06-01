import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const source = readFileSync("scripts/real-anime-complete-project-smoke.mts", "utf8");

assert(
  packageJson.scripts["real-anime-complete-project:live"] === "tsx scripts/real-anime-complete-project-smoke.mts --live",
  "real anime complete project live script drifted",
);
assert(
  packageJson.scripts["real-anime-complete-project:test"] === "tsx scripts/real-anime-complete-project-smoke-test.mts",
  "real anime complete project test script missing",
);
assert(
  source.includes("blocked_wait_previous_jimeng_task"),
  "Jimeng serial-finish blocker status is missing",
);
assert(
  source.includes("VIBE_JIMENG_ALLOW_PENDING_SUBMITS"),
  "Jimeng pending-submit override must remain explicit",
);
assert(
  source.includes('["timed_out", "queued", "generating", "submitted"]'),
  "Jimeng pending statuses must block later submits by default",
);
assert(
  source.includes("Jimeng video submit is serial-finish by default"),
  "report must explain the Jimeng serial-finish contract",
);
assert(
  source.includes("referenceImagesForStartPlan"),
  "start frames must attach generated asset references instead of relying on text-only prompts",
);
assert(
  source.includes("start_frame_with_visual_references"),
  "start-frame provider operation must record visual-reference usage",
);
assert(
  source.includes("Never render as live-action"),
  "anime style lock must explicitly block live-action rendering",
);
assert(
  source.includes("buildImage2VideoStartAnchorPrompt"),
  "complete project smoke must use the video-start-anchor prompt builder for start frames",
);

console.log("real-anime-complete-project-smoke-test: ok");
