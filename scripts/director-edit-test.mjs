import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function transpile(sourcePath, rewrites = []) {
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: sourcePath,
  }).outputText;
  for (const [from, to] of rewrites) output = output.replaceAll(from, to);
  return output;
}

async function loadDirectorEdit() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-director-edit-"));
  fs.writeFileSync(path.join(tmpDir, "storyChange.mjs"), transpile("src/core/storyChange.ts"), "utf8");
  fs.writeFileSync(
    path.join(tmpDir, "directorEdit.mjs"),
    transpile("src/core/directorEdit.ts", [['from "./storyChange"', 'from "./storyChange.mjs"']]),
    "utf8",
  );
  return import(pathToFileURL(path.join(tmpDir, "directorEdit.mjs")).href);
}

const { buildDirectorEditPlan } = await loadDirectorEdit();

const generatedAt = "2026-04-30T00:00:00.000Z";

function shot(id, sectionId = "section-1") {
  return {
    id,
    actId: "A1",
    sectionId,
    title: `Shot ${id}`,
    storyFunction: `story beat ${id}`,
    startFrame: `outputs/keyframes/${id}_start.png`,
    endFrame: `outputs/keyframes/${id}_end.png`,
    status: "ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    issues: [],
  };
}

function asset(id, type, lockedStatus = "locked") {
  return {
    id,
    type,
    name: id,
    path: `visual_memory/${id}.png`,
    status: "exists",
    lockedStatus,
    safeForFutureReference: lockedStatus === "locked",
    issues: [],
  };
}

const runtimeState = {
  generatedAt,
  storyFlow: {
    shots: [shot("1-1"), shot("1-2"), shot("1-3"), shot("1-4"), shot("1-5")],
  },
  visualMemory: {
    assets: [asset("hero_locked", "character"), asset("garage_scene_locked", "scene"), asset("candidate_prop", "prop", "candidate")],
  },
};

function artifactTypes(plan) {
  return new Set(plan.affectedArtifacts.map((artifact) => artifact.artifactType));
}

const moodEdit = buildDirectorEditPlan({
  userIntent: "把 1-2 到 1-4 更压抑",
  runtimeState,
  createdAt: generatedAt,
});
assert(moodEdit.selection.scopeKind === "multi-shot", "range edit must classify as multi-shot scope");
assert(
  JSON.stringify(moodEdit.selection.targetIds) === JSON.stringify(["1-2", "1-3", "1-4"]),
  `range target ids drifted: ${JSON.stringify(moodEdit.selection.targetIds)}`,
);
assert(moodEdit.transaction.operation === "update_style", "mood edit must become structured update_style");
assert(moodEdit.transaction.impactScope === "shot", "multi-shot style edit must not become project-wide reflow");
for (const type of ["shotPromptPlan", "startFrame", "endFrame", "video", "preview"]) {
  assert(artifactTypes(moodEdit).has(type), `mood edit missing affected artifact ${type}`);
}
assert(moodEdit.providerPromptPatchForbidden === true, "Selected Edit must forbid direct provider prompt patches");
assert(moodEdit.reflowImpactReport.forbiddenActions.includes("prompt_patch_from_natural_language"), "reflow must forbid prompt patch from natural language");

const insertEdit = buildDirectorEditPlan({
  userIntent: "在 1-3 后插入一个分镜，让她短暂停下来听门外声音",
  selection: { scopeKind: "section", sectionId: "section-1" },
  runtimeState,
  createdAt: generatedAt,
});
assert(insertEdit.transaction.operation === "insert_shot", "insert request must become insert_shot transaction");
assert(insertEdit.confirmationRequired === true, "insert shot must require confirmation");
assert(artifactTypes(insertEdit).has("storyFlow"), "insert shot must affect storyFlow");
assert(artifactTypes(insertEdit).has("shotSpec"), "insert shot must affect shotSpec");
assert(artifactTypes(insertEdit).has("shotLayout"), "insert shot must affect shotLayout");

const characterEdit = buildDirectorEditPlan({
  userIntent: "把主角身份改成退休消防员",
  selection: { scopeKind: "asset", assetId: "hero_locked" },
  runtimeState,
  createdAt: generatedAt,
});
assert(characterEdit.transaction.operation === "update_character", "character change must become update_character");
assert(characterEdit.confirmationRequired === true, "identity change must require confirmation");
assert(artifactTypes(characterEdit).has("visualMemory"), "character change must affect visualMemory");

const sceneEdit = buildDirectorEditPlan({
  userIntent: "把场景设定改成地下车库",
  selection: { scopeKind: "asset", assetId: "garage_scene_locked" },
  runtimeState,
  createdAt: generatedAt,
});
assert(sceneEdit.transaction.operation === "update_scene", "scene change must become update_scene");
assert(sceneEdit.confirmationRequired === true, "scene change must require confirmation");
assert(artifactTypes(sceneEdit).has("spatialMemory"), "scene change must affect spatialMemory");

const voiceEdit = buildDirectorEditPlan({
  userIntent: "把旁白音色改成低沉男声",
  selection: { scopeKind: "voice", voiceId: "narrator_main" },
  runtimeState,
  createdAt: generatedAt,
});
assert(voiceEdit.transaction.operation === "update_voice", "voice source change must become update_voice");
assert(voiceEdit.confirmationRequired === true, "voice change must require confirmation");
assert(artifactTypes(voiceEdit).has("audio"), "voice change must affect audio");

const lockedAssetEdit = buildDirectorEditPlan({
  userIntent: "替换这个 locked asset 的服装参考",
  selection: { scopeKind: "asset", assetId: "hero_locked" },
  runtimeState,
  createdAt: generatedAt,
});
assert(lockedAssetEdit.confirmationRequired === true, "locked asset change must require confirmation");
assert(
  lockedAssetEdit.confirmationReasons.some((reason) => /locked asset|locked/i.test(reason)),
  "locked asset confirmation reason must be explicit",
);

const bypassEdit = buildDirectorEditPlan({
  userIntent: "跳过 transaction，直接改 provider prompt 让 1-2 更亮",
  selection: { scopeKind: "shot", shotId: "1-2" },
  runtimeState,
  createdAt: generatedAt,
});
assert(bypassEdit.status === "blocked_prompt_bypass", "prompt bypass must be blocked");
assert(bypassEdit.blockedReasons.includes("prompt_bypass_forbidden"), "prompt bypass blocker must be explicit");
assert(bypassEdit.forbiddenActions.includes("provider_prompt_patch"), "provider prompt patch must be forbidden");
assert(bypassEdit.transaction.mustNotAdd.includes("direct_prompt_patch"), "transaction must forbid direct prompt patch");
assert(bypassEdit.providerSubmissionForbidden === true, "Selected Edit must not submit providers");

console.log(
  `Director edit tests passed: range=${moodEdit.selection.targetIds.length}, insert=${insertEdit.transaction.operation}, confirmations=${[
    characterEdit,
    sceneEdit,
    voiceEdit,
    lockedAssetEdit,
  ].filter((plan) => plan.confirmationRequired).length}.`,
);
