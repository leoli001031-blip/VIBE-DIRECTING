import { readFileSync } from "node:fs";

import { buildDirectorFeedbackRecompile } from "../src/core/directorFeedbackRecompile.ts";
import {
  applyDirectorFeedbackRecompileToProjectVibe,
  buildProjectVibeStoryboardPlannerInput,
} from "../src/core/directorFeedbackProjectVibe.ts";
import {
  hashProjectVibeFacts,
  parseProjectVibeText,
  validateProjectVibe,
  type ProjectVibeDocument,
} from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const createdAt = "2026-05-22T01:00:00.000Z";
const opened = parseProjectVibeText(readFileSync("test-fixtures/projects/agent-loop-minimal/project.vibe", "utf8"));
assert(opened.ok && opened.project, `fixture should parse: ${opened.errors.join("; ")}`);

const project = opened.project as ProjectVibeDocument;
const beforeHash = hashProjectVibeFacts(project);
const plannerInput = buildProjectVibeStoryboardPlannerInput(project, {
  storyboardOutputRoot: "storyboards",
  videoOutputRoot: "video",
  outputSize: "16:9",
});

assert(plannerInput.projectId === project.manifest.projectId, "planner input should preserve project id");
assert(plannerInput.shots.some((shot) => shot.id === "shot_002" && shot.intent.includes("Mira")), "planner input should carry Project.vibe shot intent");
assert(plannerInput.assets.some((asset) => asset.id === "asset_char_mira" && asset.path === "assets/locked/char_mira.md"), "planner input should carry locked asset references");
assert(plannerInput.storyboardOutputRoot === "storyboards", "planner input should expose storyboard output root");

const recompile = buildDirectorFeedbackRecompile({
  feedback: "这个人物不像短发主角，动作太平了，拆一下手部特写和眼神反应，no BGM。",
  targetShotId: "shot_002",
  projectPlanInput: plannerInput,
  createdAt,
});

assert(recompile.status === "ready_for_confirmation", `feedback should be ready: ${recompile.blockedReasons.join("; ")}`);
assert(recompile.providerCalled === false, "feedback recompile must not call provider");
assert(recompile.liveSubmitAllowed === false, "feedback recompile must not submit live tasks");

const applied = applyDirectorFeedbackRecompileToProjectVibe({
  project,
  recompile,
  createdAt,
});

assert(applied.status === "applied", `feedback should apply: ${applied.blockedReasons.join("; ")}`);
assert(applied.providerCalled === false, "Project.vibe feedback apply must not call provider");
assert(applied.providerSubmissionForbidden === true, "Project.vibe feedback apply must keep provider submit forbidden");
assert(applied.projectVibeWritten === true, "confirmed feedback should mutate Project.vibe facts in memory");
assert(validateProjectVibe(applied.project).ok, "patched Project.vibe should validate");
assert(hashProjectVibeFacts(applied.project) !== beforeHash, "feedback apply should change project facts hash");

const patchedShot = applied.project.shots.find((shot) => shot.id === "shot_002");
assert(patchedShot, "patched shot missing");
assert(patchedShot.rhythmProfile === "anime_emotion", "feedback should persist rhythm profile");
assert(patchedShot.splitPolicy === "split_for_reaction", "feedback should persist split policy");
assert(patchedShot.executionMode === "planned_cut_sequence", "feedback should persist planned cut mode");
assert(patchedShot.directorFeedbackDirectives?.some((item) => item.includes("表演过平")), "feedback directives should persist");
assert(patchedShot.characterGuidance?.some((item) => /Locked character references/i.test(item)), "character guidance should persist");
assert(patchedShot.seedanceDirection?.includes("no BGM"), "Seedance direction should persist no-BGM directive");
assert(patchedShot.sourceRefs.includes(`director_feedback_recompile:${recompile.id}`), "shot should reference feedback recompile evidence");
assert(applied.project.runs.some((run) => run.id === `run_${recompile.id}` && run.runKind === "agent_loop"), "feedback apply should append an agent loop run receipt");

const rebuiltPlannerInput = buildProjectVibeStoryboardPlannerInput(applied.project);
const rebuiltShot = rebuiltPlannerInput.shots.find((shot) => shot.id === "shot_002");
assert(rebuiltShot?.feedbackDirectives?.length, "rebuilt planner input should preserve feedback directives");
assert(rebuiltShot?.seedanceDirection?.includes("no BGM"), "rebuilt planner input should preserve video direction");

console.log("director-feedback-project-vibe-test: Project.vibe feedback apply passed.");
