import { buildProjectVibePlanningProjection } from "../src/core/projectVibePlanningProjection.ts";
import { buildScriptPlannerState } from "../src/core/scriptPlanner.ts";
import { buildProjectRuntimeStateFromProjectVibe, createProjectVibe, type ProjectVibeDocument } from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const generatedAt = "2026-05-18T09:00:00.000Z";

function fixtureProject(shotOverrides: Partial<ProjectVibeDocument["shots"][number]> = {}): ProjectVibeDocument {
  return createProjectVibe({
    projectId: "project_vibe_prompt_keyframe",
    title: "Prompt Keyframe Projection",
    version: "0.3.0",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    storyFlow: {
      id: "story_flow_prompt_keyframe",
      sections: [
        {
          id: "section_departure",
          title: "Departure",
          summary: "A courier notices the impossible signal.",
          sequenceIndex: 0,
          shotIds: ["S010"],
        },
      ],
      shotOrder: ["S010"],
    },
    visualMemory: {
      id: "visual_memory_prompt_keyframe",
      entries: [
        {
          id: "vm_courier",
          assetId: "char_courier",
          kind: "character",
          label: "Courier",
          status: "locked",
          textConstraints: ["yellow raincoat", "tired eyes"],
          usedByShotIds: ["S010"],
          canUseAsFutureReference: true,
          sourceRefs: ["fixture"],
        },
        {
          id: "vm_station",
          assetId: "scene_station",
          kind: "scene",
          label: "Station",
          status: "locked",
          textConstraints: ["empty platform", "wet neon"],
          usedByShotIds: ["S010"],
          canUseAsFutureReference: true,
          sourceRefs: ["fixture"],
        },
      ],
    },
    shots: [
      {
        id: "S010",
        sectionId: "section_departure",
        title: "Signal on the platform",
        intent: "The courier pauses on the rain-wet platform as a signal lights up on the old timetable.",
        sceneAssetIds: ["scene_station"],
        characterAssetIds: ["char_courier"],
        propAssetIds: [],
        durationSeconds: 6,
        status: "ready",
        sourceRefs: ["fixture:shot:S010"],
        ...shotOverrides,
      },
    ],
    assets: [
      {
        id: "char_courier",
        kind: "character",
        label: "Courier",
        status: "locked",
        path: "assets/char_courier.png",
        textConstraints: ["yellow raincoat", "tired eyes"],
        usedByShotIds: ["S010"],
        sourceRefs: ["fixture:asset:char_courier"],
        lockedBy: "user",
      },
      {
        id: "scene_station",
        kind: "scene",
        label: "Station",
        status: "locked",
        path: "assets/scene_station.png",
        textConstraints: ["empty platform", "wet neon"],
        usedByShotIds: ["S010"],
        sourceRefs: ["fixture:asset:scene_station"],
        lockedBy: "user",
      },
    ],
    runs: [],
  });
}

const project = fixtureProject();
const projection = buildProjectVibePlanningProjection({ project, generatedAt });
assert(projection.jobs.length === 1, "Default Project.vibe projection should create a start-frame image job only.");
assert(projection.keyframePairs.length === 0, "Default Project.vibe projection should not create endpoint keyframe pairs.");
assert(projection.shots[0]?.shot.startFrame?.endsWith("S010_start.png"), "Projected shot should carry planned start frame path.");
assert(!projection.shots[0]?.shot.endFrame, "Default projected shot should not require a planned end frame.");
assert(projection.shots[0]?.shot.videoControlMode === "first_frame_default", "Default projected shot should use first-frame video control.");
const projectedStartJob = projection.jobs.find((job) => job.slot === "image.generate");
const projectedEndJob = projection.jobs.find((job) => job.slot === "image.edit");
assert(projectedStartJob?.requiredMode === "text2image", "Projected start frame must use text-to-image.");
assert(!projectedEndJob, "Default projection must not create an end-frame image edit job.");

const endpointProject = fixtureProject({ videoControlMode: "first_last_endpoint" });
const endpointProjection = buildProjectVibePlanningProjection({ project: endpointProject, generatedAt });
const endpointEndJob = endpointProjection.jobs.find((job) => job.slot === "image.edit");
assert(endpointProjection.jobs.length === 2, "Endpoint mode should create start and end image jobs.");
assert(endpointProjection.keyframePairs[0]?.endDerivationSource === "start_frame", "Endpoint end frame should derive from start frame.");
assert(!endpointProjection.shots[0]?.shot.endFrame, "Endpoint shot should not expose a planned end frame path before provider return.");
assert(endpointProjection.keyframePairs[0]?.endFrameId.endsWith("S010_end.png"), "Endpoint pair contract should retain the planned end-frame target.");
assert(endpointEndJob?.requiredMode === "image2image", "Endpoint end frame must use image-to-image.");
assert(
  endpointEndJob?.references.some((reference) => reference === "source_start_frame:planned/keyframes/project_vibe_prompt_keyframe/S010_start.png"),
  "Endpoint end frame job should reference the planned start-frame source image.",
);
assert(!endpointEndJob?.promptPath, "Endpoint end frame job must not hide local image paths in a prompt file.");

const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectRoot: "/tmp/project-vibe-prompt-keyframe",
  projectPath: "project/project.vibe",
  generatedAt,
});

const promptPlans = runtimeState.imagePipeline.promptPlans.filter((plan) => plan.shotId === "S010");
const startPrompt = promptPlans.find((plan) => plan.promptKind === "start_frame");
const endPrompt = promptPlans.find((plan) => plan.promptKind === "end_frame");
const imageTasks = runtimeState.imagePipeline.imageTaskPlans.filter((plan) => plan.shotId === "S010");
const startFramePlan = runtimeState.imageKeyframeRuntime.image2StartFramePlans.find((plan) => plan.shotId === "S010");
const endFramePlan = runtimeState.imageKeyframeRuntime.image2EndFramePlans.find((plan) => plan.shotId === "S010");
const pairGate = runtimeState.imageKeyframeRuntime.keyframePairGates.find((gate) => gate.shotId === "S010");

assert(startPrompt, "Runtime should compile a start-frame prompt plan from Project.vibe shot intent.");
assert(!endPrompt, "Default runtime should not compile an end-frame prompt plan.");
assert(startPrompt.sourceIntent.some((item) => item.includes("Signal on the platform")), "Start prompt should preserve shot title.");
assert(imageTasks.length === 1, "Default runtime should produce the start-frame image task only.");
assert(startFramePlan?.outputPath.endsWith("S010_start.png"), "Image keyframe runtime should plan the start frame output.");
assert(!endFramePlan, "Default image keyframe runtime should not plan an end frame.");
assert(!pairGate, "Default keyframe runtime should not create an endpoint pair gate.");
assert(runtimeState.imageKeyframeRuntime.noProviderSubmit === true, "Integration path must remain dry-run only.");

const endpointRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project: endpointProject,
  projectRoot: "/tmp/project-vibe-prompt-keyframe-endpoint",
  projectPath: "project/project.vibe",
  generatedAt,
});
const endpointEndPrompt = endpointRuntimeState.imagePipeline.promptPlans.find((plan) => plan.shotId === "S010" && plan.promptKind === "end_frame");
const endpointEndFramePlan = endpointRuntimeState.imageKeyframeRuntime.image2EndFramePlans.find((plan) => plan.shotId === "S010");
const endpointPairGate = endpointRuntimeState.imageKeyframeRuntime.keyframePairGates.find((gate) => gate.shotId === "S010");
assert(endpointEndPrompt?.derivesFromStartFrame === true, "Endpoint runtime should compile a derived end-frame prompt.");
assert(endpointEndPrompt.referenceImageInputs.some((input) => input.role === "source_start_frame"), "Endpoint end prompt should carry source start-frame image input.");
assert(endpointEndFramePlan?.endDerivation.derivesFrom === "start_frame", "Endpoint keyframe runtime should keep end-frame derivation locked to start frame.");
assert(endpointPairGate?.endDerivationSource === "start_frame", "Endpoint pair gate should record start-frame derivation.");

const scriptPlanner = buildScriptPlannerState({
  idea: "一个女孩在雨夜地铁站寻找丢失的钥匙，但屏幕突然显示她未来的名字，最后她决定继续向前走。",
  generatedAt,
  maxSections: 2,
});
const scriptProjection = buildProjectVibePlanningProjection({ scriptPlannerResult: scriptPlanner, generatedAt });
assert(scriptProjection.source === "script_planner", "Script Planner result should project through the same planning adapter.");
assert(scriptProjection.shots.length === 2, "Script Planner projection should retain planned shots.");
assert(
  scriptProjection.shots[0]?.shot.storyFunction.includes("visual_anchor:"),
  "Script Planner plannerNotes should be folded into projected story function.",
);
assert(
  !scriptProjection.jobs.some((job) => job.slot === "image.edit" && job.requiredMode === "image2image"),
  "Script Planner default projection should not create end-frame image2image jobs.",
);

console.log(
  `project-vibe-prompt-keyframe-integration-test: prompts=${promptPlans.length}, imageTasks=${imageTasks.length}, startPlans=${runtimeState.imageKeyframeRuntime.summary.startFramePlans}, endPlans=${runtimeState.imageKeyframeRuntime.summary.endFramePlans}, scriptShots=${scriptProjection.shots.length}.`,
);
