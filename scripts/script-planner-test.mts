import fs from "node:fs";

import { buildScriptPlannerState } from "../src/core/scriptPlanner.ts";
import type { KnowledgePackManifest } from "../src/core/knowledgeTypes.ts";
import { createProjectVibe, patchProjectVibe, validateProjectVibe } from "../src/project/projectVibe.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

const generatedAt = "2026-05-18T00:00:00.000Z";
const manifest = readJson<KnowledgePackManifest>("resources/knowledge_pack_manifest.json");
const emptyProject = createProjectVibe({
  projectId: "script_planner_empty_project",
  title: "Script Planner Empty Project",
  createdAt: generatedAt,
  updatedAt: generatedAt,
});
const idea = "一个雨夜失业女孩在便利店门口不想回家，但老板默默递给她一盒热饭，最后她愿意继续往前走。";

const first = buildScriptPlannerState({
  idea,
  project: emptyProject,
  availableKnowledgePacks: manifest.packs,
  generatedAt,
});
const second = buildScriptPlannerState({
  idea,
  project: emptyProject,
  availableKnowledgePacks: manifest.packs,
  generatedAt,
});

assert(JSON.stringify(first) === JSON.stringify(second), "script planner output must be deterministic for identical input");
assert(first.script_brief.protagonist.includes("女孩"), "script_brief should infer the protagonist");
assert(first.script_brief.structureType === "emotional_short", "rainy kindness idea should use emotional_short structure");
assert(first.sections.length === 5, "emotional_short should produce five sections");
assert(first.shots.length === first.sections.length, "planner should produce one minimal shot per section");
assert(first.shots.every((shot) => shot.sceneAssetIds.length === 0), "minimal script planner must not require scene assets yet");
assert(first.shots.every((shot) => shot.characterAssetIds.length === 0), "minimal script planner must not require character assets yet");
assert(first.sourceKnowledgePackIds.includes("script/core-script-writing"), "source knowledge must include core script writing");
assert(first.sourceKnowledgePackIds.includes("script/script-to-storyflow"), "source knowledge must include script to storyflow");
assert(first.sourceKnowledgePackIds.includes("script/script-qa"), "source knowledge must include script QA");
assert(!first.sourceKnowledgePackIds.some((packId) => packId.startsWith("provider/")), "script planner must not source provider packs");
assert(first.qaBlockers.length === 0, `rich idea should not have blockers: ${JSON.stringify(first.qaBlockers)}`);

const patched = patchProjectVibe(emptyProject, first.projectVibePatchOperations, {
  id: "txn_script_planner_test",
  actor: "agent_loop",
  reason: "Apply script planner draft to Project.vibe.",
  createdAt: generatedAt,
});
assert(patched.receipt.status === "applied", `Project.vibe patch should apply: ${patched.receipt.errors.join("; ")}`);
assert(patched.project.shots.length === first.shots.length, "patched project should receive planner shots");
assert(patched.project.storyFlow.shotOrder.length === first.shots.length, "patched story flow should receive shot order");
assert(validateProjectVibe(patched.project).ok, "patched project must validate");

const sparse = buildScriptPlannerState({
  idea: "孤独与自由",
  availableKnowledgePacks: manifest.packs,
  generatedAt,
});
assert(sparse.sections.length > 0, "sparse idea should still return a minimal structure");
assert(sparse.shots.length === sparse.sections.length, "sparse idea should still return patch-compatible shots");
assert(sparse.missingInfo.some((item) => item.field === "protagonist"), "sparse idea should ask for protagonist");
assert(sparse.qaBlockers.some((item) => item.field === "obstacle"), "sparse idea should block on missing obstacle");
assert(sparse.shots.every((shot) => shot.status === "blocked"), "sparse idea shots should stay blocked");

const serialized = JSON.stringify([first, sparse]);
const forbiddenPatterns = [
  /\blive[-_\s]?submit\b/i,
  /\bsubmit[-_\s]?live\b/i,
  /\bprovider[-_\s]?unlock\b/i,
  /\bapi[-_\s]?key\b/i,
  /\bcredential\b/i,
];
for (const pattern of forbiddenPatterns) {
  assert(!pattern.test(serialized), `script planner result must not include provider/runtime semantics: ${pattern}`);
}

console.log(
  `Script Planner tests passed: plannerId=${first.plannerId}, sections=${first.sections.length}, shots=${first.shots.length}, sparseBlockers=${sparse.qaBlockers.length}.`,
);
