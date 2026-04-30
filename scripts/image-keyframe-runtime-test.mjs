import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

async function importTs(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asset(id, type, lockedStatus = "locked", issues = []) {
  return {
    id,
    type,
    name: id,
    path: `visual_memory/${type}s/${id}.png`,
    status: lockedStatus === "not_generated" ? "planned" : "exists",
    lockedStatus,
    safeForFutureReference: lockedStatus === "locked",
    issues,
  };
}

function job(id, slot, requiredMode, providerId, outputPath) {
  return {
    id,
    slot,
    requiredMode,
    providerId,
    status: "planned",
    outputPath,
    references: ["hero_locked", "garage_scene_locked"],
    issues: [],
  };
}

function promptPlan(overrides = {}) {
  const isEnd = overrides.promptKind === "end_frame";
  return {
    promptPlanId: isEnd ? "prompt_S01_end" : "prompt_S01_start",
    promptPlanHash: isEnd ? "prompt_hash_end" : "prompt_hash_start",
    sourceShotSpecHash: "shot_hash_S01",
    jobId: isEnd ? "job_S01_end" : "job_S01_start",
    shotId: "S01",
    providerId: isEnd ? "openai-image2-api" : "openai-image2-codex-cli",
    providerSlot: isEnd ? "image.edit" : "image.generate",
    requiredMode: isEnd ? "image2image" : "text2image",
    promptKind: isEnd ? "end_frame" : "start_frame",
    sourceIntent: [isEnd ? "derive end frame from approved start frame" : "generate approved start frame"],
    naturalLanguagePolicy: "source_intent_only",
    mustPreserve: ["hero identity", "garage layout"],
    mustAvoid: ["new character", "new location", "text-to-video fallback"],
    referenceIds: ["hero_locked", "garage_scene_locked"],
    styleDirectives: ["same restrained visual style"],
    adapterWarnings: [],
    derivesFromStartFrame: isEnd ? true : undefined,
    status: "ready_for_envelope",
    blockers: [],
    conflictReportId: "conflict_clear",
    createdAt: generatedAt,
    ...overrides,
  };
}

function keyframePair(overrides = {}) {
  return {
    shotId: "S01",
    startFrameId: "outputs/keyframes/S01_start.png",
    endFrameId: "outputs/keyframes/S01_end.png",
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: ["micro-expression", "small hand movement"],
    mustPreserve: ["hero identity", "garage layout", "style capsule"],
    mustNotAdd: ["new character", "new location", "unapproved prop"],
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    generatedAt,
    sourceIndex,
    assets,
    jobs: [
      job("job_S01_start", "image.generate", "text2image", "openai-image2-codex-cli", "outputs/keyframes/S01_start.png"),
      job("job_S01_end", "image.edit", "image2image", "openai-image2-api", "outputs/keyframes/S01_end.png"),
    ],
    promptPlans: [promptPlan({ promptKind: "start_frame" }), promptPlan({ promptKind: "end_frame" })],
    keyframePairs: [keyframePair()],
    ...overrides,
  };
}

function byGate(plan, gateId) {
  return plan.runtimeLockGates.find((gate) => gate.gateId === gateId);
}

function byReference(plan, referenceId) {
  return plan.assetReferencePlanning.references.find((reference) => reference.referenceId === referenceId);
}

function assertNoProviderSubmit(value, path = "plan") {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const currentPath = `${path}.${key}`;
    if (key === "noProviderSubmit") assert(item === true, `${currentPath} must be true`);
    if (key === "providerSubmissionForbidden") assert(item === true, `${currentPath} must be true`);
    if (key === "dryRunOnly") assert(item === true, `${currentPath} must be true`);
    if (key === "liveSubmitAllowed") assert(item === false, `${currentPath} must be false`);
    if (key === "canSubmitProvider") assert(item === false, `${currentPath} must be false`);
    if (key === "providerSubmitAllowed") assert(item === false, `${currentPath} must be false`);
    assert(key !== "submitId", `${currentPath} must not expose submitId`);
    assert(key !== "providerTaskId", `${currentPath} must not expose providerTaskId`);
    assertNoProviderSubmit(item, currentPath);
  }
}

const generatedAt = "2026-04-30T00:00:00.000Z";
const assets = [
  asset("hero_locked", "character"),
  asset("garage_scene_locked", "scene"),
  asset("style_candidate", "style", "candidate"),
  asset("bad_prop_rejected", "prop", "not_generated", ["rejected"]),
];
const sourceIndex = {
  projectId: "phase17_fixture",
  projectVersion: "0.1.0",
  sourceIndexHash: "source_hash_phase17",
  currentPromptHashes: {},
  lockedReferenceIds: ["hero_locked", "garage_scene_locked"],
  candidateReferenceIds: ["style_candidate"],
  rejectedReferenceIds: ["bad_prop_rejected"],
  failedReferenceIds: [],
  confirmedDecisionIds: [],
  staleArtifactIds: [],
  updatedAt: generatedAt,
};

const { buildImageKeyframeRuntimePlan } = await importTs("src/core/imageKeyframeRuntime.ts");

const cleanPlan = buildImageKeyframeRuntimePlan(baseInput());
assert(cleanPlan.schemaVersion === "0.1.0", "runtime plan schema version drifted");
assert(cleanPlan.phase === "phase17_image2_asset_keyframe_runtime", "phase id drifted");
assert(cleanPlan.status === "ready_for_dry_run", `clean plan should be ready, got ${cleanPlan.status}: ${cleanPlan.blockers.join("; ")}`);
assert(cleanPlan.summary.startFramePlans === 1, "clean plan should create one start frame plan");
assert(cleanPlan.summary.endFramePlans === 1, "clean plan should create one end frame plan");
assert(cleanPlan.summary.keyframePairGates === 1, "clean plan should create one keyframe gate");
assert(cleanPlan.summary.readyKeyframePairs === 1, "clean keyframe pair should be ready");
assert(cleanPlan.runtimeLocks.noProviderSubmit === true, "runtime lock noProviderSubmit missing");
assert(cleanPlan.runtimeLocks.noCredentialRead === true, "runtime lock noCredentialRead missing");
assert(cleanPlan.runtimeLocks.noFileMutation === true, "runtime lock noFileMutation missing");
assert(cleanPlan.runtimeLocks.noShell === true, "runtime lock noShell missing");
assert(cleanPlan.runtimeLocks.noFast === true, "runtime lock noFast missing");
assert(cleanPlan.runtimeLocks.noVip === true, "runtime lock noVip missing");
assert(cleanPlan.runtimeLocks.noTextToVideo === true, "runtime lock noTextToVideo missing");
assert(cleanPlan.runtimeLocks.noImage2Fallback === true, "runtime lock noImage2Fallback missing");
assert(cleanPlan.runtimeLocks.noIndependentEndFrame === true, "runtime lock noIndependentEndFrame missing");
assert(cleanPlan.runtimeLockGates.every((gate) => gate.status === "pass"), "clean plan runtime gates should pass");
assertNoProviderSubmit(cleanPlan);

const startPlan = cleanPlan.image2StartFramePlans[0];
assert(startPlan.providerSlot === "image.generate", "start frame must use image.generate");
assert(startPlan.requiredMode === "text2image", "start frame generate must use text2image");
assert(startPlan.image2Operation === "text2image", "start frame Image2 operation must be text2image");
assert(startPlan.adapterRequestPreview.adapterId === "image2-dry-run", "start frame adapter preview must be Image2 dry-run");
assert(startPlan.adapterRequestPreview.submitPolicy.noProviderSubmit === true, "start frame submit policy must forbid provider submit");

const endPlan = cleanPlan.image2EndFramePlans[0];
assert(endPlan.providerSlot === "image.edit", "end frame must use image.edit");
assert(endPlan.requiredMode === "image2image", "end frame must use image2image");
assert(endPlan.image2Operation === "image2image", "end frame operation must be image2image");
assert(endPlan.endDerivation.derivesFrom === "start_frame", "end frame must derive from start frame");
assert(endPlan.endDerivation.sourceStartFrameId === "outputs/keyframes/S01_start.png", "end frame source start frame missing");
assert(endPlan.adapterRequestPreview.payload.sourceStartFrameId === "outputs/keyframes/S01_start.png", "adapter preview must carry source start frame");
assert(endPlan.adapterRequestPreview.forbiddenFallbacks.includes("image2image_to_text2image"), "end frame must forbid image2image fallback");
assert(endPlan.adapterRequestPreview.forbiddenFallbacks.includes("independent_end_frame_generation"), "end frame must forbid independent generation");

const gate = cleanPlan.keyframePairGates[0];
assert(gate.status === "pass", `keyframe gate should pass: ${gate.blockers.join("; ")}`);
assert(gate.endDerivationSource === "start_frame", "keyframe gate must record start_frame derivation");
assert(gate.validForPromotionHandoff === true, "keyframe gate must be handoff-ready");

assert(cleanPlan.promotionHandoffPlan.targetProviderId === "seedance2-provider", "handoff target must be Seedance 2");
assert(cleanPlan.promotionHandoffPlan.providerState === "parked_dry_run_only", "Seedance handoff must stay parked");
assert(cleanPlan.promotionHandoffPlan.canSubmitProvider === false, "handoff cannot submit provider");
assert(cleanPlan.promotionHandoffPlan.noFast === true, "handoff must forbid fast");
assert(cleanPlan.promotionHandoffPlan.noVip === true, "handoff must forbid VIP");
assert(cleanPlan.promotionHandoffPlan.noTextToVideo === true, "handoff must forbid text-to-video");
assert(cleanPlan.promotionHandoffPlan.items[0].status === "ready_for_manual_review", "clean handoff item should be review-ready");
assert(cleanPlan.promotionHandoffPlan.items[0].canSubmitProvider === false, "handoff item cannot submit provider");

assert(byReference(cleanPlan, "hero_locked").status === "locked", "locked asset reference must be locked");
assert(byReference(cleanPlan, "style_candidate").status === "candidate", "candidate asset reference must be candidate");
assert(byReference(cleanPlan, "style_candidate").canUseAsFutureReference === false, "candidate cannot become future reference");
assert(byReference(cleanPlan, "bad_prop_rejected").status === "rejected", "rejected asset reference must be rejected");
assert(byReference(cleanPlan, "bad_prop_rejected").authority === "negative_rejected", "rejected asset must be negative memory");
assert(cleanPlan.assetReferencePlanning.policy.assetLibraryIsGallery === false, "asset library cannot become gallery");

const candidateInput = baseInput({
  promptPlans: [
    promptPlan({ promptKind: "start_frame", referenceIds: ["hero_locked", "garage_scene_locked", "style_candidate"] }),
    promptPlan({ promptKind: "end_frame" }),
  ],
});
const candidatePlan = buildImageKeyframeRuntimePlan(candidateInput);
assert(candidatePlan.status === "draft_only", "candidate reference should keep runtime draft-only");
assert(candidatePlan.image2StartFramePlans[0].warnings.some((warning) => warning.includes("candidate-only")), "candidate reference warning missing");
assert(candidatePlan.image2StartFramePlans[0].blockers.length === 0, "candidate reference should not hard-block dry-run planning");

const rejectedInput = baseInput({
  promptPlans: [
    promptPlan({ promptKind: "start_frame", referenceIds: ["hero_locked", "bad_prop_rejected"] }),
    promptPlan({ promptKind: "end_frame" }),
  ],
});
const rejectedPlan = buildImageKeyframeRuntimePlan(rejectedInput);
assert(rejectedPlan.status === "blocked", "rejected reference should block runtime plan");
assert(rejectedPlan.assetReferencePlanning.blockers.some((blocker) => blocker.includes("bad_prop_rejected")), "rejected reference blocker missing");
assert(rejectedPlan.image2StartFramePlans[0].status === "blocked", "rejected start frame plan should block");

const independentInput = baseInput({
  jobs: [
    job("job_S01_start", "image.generate", "text2image", "openai-image2-codex-cli", "outputs/keyframes/S01_start.png"),
    job("job_S01_end", "image.generate", "text2image", "openai-image2-api", "outputs/keyframes/S01_end.png"),
  ],
  promptPlans: [
    promptPlan({ promptKind: "start_frame" }),
    promptPlan({
      promptKind: "end_frame",
      providerSlot: "image.generate",
      requiredMode: "text2image",
      derivesFromStartFrame: false,
    }),
  ],
  keyframePairs: [keyframePair({ endDerivationSource: "independent_exception", exceptionReason: "fixture should still block" })],
});
const independentPlan = buildImageKeyframeRuntimePlan(independentInput);
assert(independentPlan.status === "blocked", "independent end frame must block");
assert(independentPlan.image2EndFramePlans[0].status === "blocked", "independent end frame plan must block");
assert(independentPlan.image2EndFramePlans[0].endDerivation.derivesFrom === "blocked_independent_end_frame", "independent end frame must be marked");
assert(byGate(independentPlan, "noIndependentEndFrame").status === "blocked", "noIndependentEndFrame gate must block independent end frame");
assert(byGate(independentPlan, "noImage2Fallback").status === "blocked", "noImage2Fallback gate must block end text2image path");
assert(independentPlan.promotionHandoffPlan.status === "blocked", "independent keyframe pair cannot hand off");

const textToVideoInput = baseInput({
  jobs: [
    ...baseInput().jobs,
    job("job_S01_t2v", "video.t2v.experimental", "text2video", "seedance2-provider", "outputs/videos/S01.mp4"),
  ],
});
const textToVideoPlan = buildImageKeyframeRuntimePlan(textToVideoInput);
assert(byGate(textToVideoPlan, "noTextToVideo").status === "blocked", "text-to-video job must trip noTextToVideo gate");
assert(textToVideoPlan.image2StartFramePlans.length === 1, "text-to-video job must not create an Image2 start plan");
assert(textToVideoPlan.image2EndFramePlans.length === 1, "text-to-video job must not create an Image2 end plan");

const submittedInput = clone(baseInput());
submittedInput.jobs[0].submitId = "provider_submit_should_block";
const submittedPlan = buildImageKeyframeRuntimePlan(submittedInput);
assert(byGate(submittedPlan, "noProviderSubmit").status === "blocked", "provider submission state must block noProviderSubmit gate");

const schema = readJson("schemas/image_keyframe_runtime.schema.json");
assert(schema.title === "ImageKeyframeRuntimePlan", "schema title drifted");
for (const required of [
  "schemaVersion",
  "assetReferencePlanning",
  "image2StartFramePlans",
  "image2EndFramePlans",
  "keyframePairGates",
  "promotionHandoffPlan",
  "runtimeLocks",
  "runtimeLockGates",
  "noProviderSubmit",
]) {
  assert(schema.required.includes(required), `schema must require ${required}`);
}
for (const [key, expected] of Object.entries(cleanPlan.runtimeLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hardLocks must pin ${key}=${expected}`);
}
assert(schema.properties.phase.const === "phase17_image2_asset_keyframe_runtime", "schema must pin phase const");
assert(schema.properties.noProviderSubmit.const === true, "schema must pin top-level noProviderSubmit");
assert(schema.properties.providerSubmissionForbidden.const === true, "schema must pin top-level providerSubmissionForbidden");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin top-level liveSubmitAllowed=false");
assert(schema.$defs.assetReferencePlanning.properties.policy.properties.assetLibraryPurpose.const === "asset_consistency_memory", "schema must pin asset library purpose");
assert(schema.$defs.assetReferencePlanning.properties.policy.properties.assetLibraryIsGallery.const === false, "schema must pin not-gallery policy");
assert(schema.$defs.adapterPreview.properties.adapterId.const === "image2-dry-run", "schema must pin Image2 dry-run adapter");
assert(schema.$defs.adapterPreview.properties.submitPolicy.properties.noProviderSubmit.const === true, "schema submitPolicy must forbid provider submit");
assert(schema.$defs.adapterPreview.properties.submitPolicy.properties.noCredentialRead.const === true, "schema submitPolicy must forbid credential read");
assert(schema.$defs.endDerivation.properties.noIndependentEndFrame.const === true, "schema must pin no independent end frame");
assert(schema.$defs.promotionHandoffPlan.properties.targetProviderId.const === "seedance2-provider", "schema must pin Seedance handoff target");
assert(schema.$defs.promotionHandoffPlan.properties.canSubmitProvider.const === false, "schema must forbid Seedance submit");
assert(schema.$defs.promotionHandoffItem.properties.fastModeAllowed.const === false, "schema must forbid fast handoff item");
assert(schema.$defs.promotionHandoffItem.properties.vipChannelAllowed.const === false, "schema must forbid VIP handoff item");
assert(schema.$defs.promotionHandoffItem.properties.textToVideoAllowed.const === false, "schema must forbid text-to-video handoff item");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("image_keyframe_runtime.schema.json"), "schema registry must include image_keyframe_runtime.schema.json");
assert(registrySource.includes("ImageKeyframeRuntimePlan"), "schema registry must include ImageKeyframeRuntimePlan type");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("imageKeyframeRuntime"), "project runtime schema must require imageKeyframeRuntime");
assert(projectSchema.properties.imageKeyframeRuntime.$ref === "image_keyframe_runtime.schema.json", "project runtime schema must reference image keyframe runtime schema");

const packageJson = readJson("package.json");
assert(packageJson.scripts["image-keyframe:test"] === "node scripts/image-keyframe-runtime-test.mjs", "package script image-keyframe:test missing");

console.log(
  `Image keyframe runtime tests passed: ${cleanPlan.summary.startFramePlans} start, ${cleanPlan.summary.endFramePlans} end, ${cleanPlan.summary.readyKeyframePairs} handoff-ready pair.`,
);
