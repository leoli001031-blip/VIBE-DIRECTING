import fs from "node:fs";
import { buildMotionEndpointContract, classifyMotionType, endFrameRequiredForMotionType, validateMotionEndpointContract, motionEndpointContractSchemaVersion } from "../src/core/motionPlanning.ts";
import { schemaRegistry, findSchemaByType, findSchemaByFileName } from "../src/core/schemaRegistry.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function shot(overrides = {}) {
  return {
    id: overrides.id || "S01",
    actId: "A1",
    title: overrides.title || "Static hold",
    storyFunction: overrides.storyFunction || "Hold the moment.",
    status: "assets_ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    issues: overrides.issues || [],
    ...overrides,
  };
}

function keyframePair(overrides = {}) {
  return {
    shotId: overrides.shotId || "S01",
    startFrameId: "S01:start",
    endFrameId: "S01:end",
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: ["planned endpoint motion"],
    mustPreserve: ["identity", "scene layout"],
    mustNotAdd: ["new character"],
    ...overrides,
  };
}

assert(motionEndpointContractSchemaVersion === "0.1.0", "motion contract schema version drifted");
assert(classifyMotionType("角色眨眼、轻微呼吸，只有微表情变化") === "micro_expression", "micro expression classification failed");
assert(endFrameRequiredForMotionType("micro_expression") === false, "micro expression must not require end frame");
assert(
  classifyMotionType("Head and eye-line shift while seated; no walking and no prop interaction.") === "pose_change_in_place",
  "negated walking/prop text must not override an in-place head or gaze shift",
);
assert(
  classifyMotionType("The index finger touches the approved map contact point; no step is required.") === "object_interaction",
  "negated step text must not hide a hand/prop interaction",
);

const microContract = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_micro",
    title: "Close-up blink and breathing",
    storyFunction: "Micro-expression only; no pose or camera change.",
  }),
});
assert(microContract.motionType === "micro_expression", "micro contract motion type mismatch");
assert(microContract.whetherEndFrameRequired === false, "micro expression should not force an end frame");
assert(microContract.endPoseRequirement.required === false, "micro expression end pose should be optional");
assert(microContract.status === "pass", `micro expression contract should pass, got ${microContract.status}`);

const objectContract = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_object",
    title: "Hero picks up the brass key",
    storyFunction: "Object interaction: hand grabs the approved prop and settles into the end pose.",
  }),
  keyframePair: keyframePair({ shotId: "S_object" }),
});
assert(objectContract.motionType === "object_interaction", "object interaction classification failed");
assert(objectContract.whetherEndFrameRequired === false, "object interaction should default to first-frame video control");
assert(objectContract.startPoseRequirement.reservedForEndPose === false, "default object interaction should not reserve a hard endpoint end pose");
assert(objectContract.endPoseRequirement.required === false, "default object interaction end pose should be optional");
assert(objectContract.editableRegions.some((region) => region.id === "hands_and_prop_region"), "object interaction missing editable hands/prop region");
assert(objectContract.protectedRegions.length >= 2, "object interaction missing protected regions");
assert(objectContract.status === "pass", `object interaction contract should pass, got ${objectContract.status}`);

const endpointObjectContract = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_object_endpoint",
    title: "Hero picks up the brass key",
    storyFunction: "Object interaction: hand grabs the approved prop and settles into the end pose.",
    videoControlMode: "first_last_endpoint",
  }),
  keyframePair: keyframePair({ shotId: "S_object_endpoint" }),
});
assert(endpointObjectContract.motionType === "object_interaction", "endpoint object interaction classification failed");
assert(endpointObjectContract.whetherEndFrameRequired === true, "endpoint mode must require an end frame");
assert(endpointObjectContract.startPoseRequirement.reservedForEndPose === true, "endpoint start pose must reserve future endpoint space");
assert(endpointObjectContract.endPoseRequirement.required === true, "endpoint end pose must be required");
assert(endpointObjectContract.status === "pass", `endpoint object contract should pass, got ${endpointObjectContract.status}`);

const headPoseContract = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_head_pose",
    title: "Seated character lifts his chin toward the rainy window reflection",
    storyFunction: "Head and eye-line shift while the seated body remains anchored at the table; pen hand can relax minimally.",
  }),
  keyframePair: keyframePair({ shotId: "S_head_pose" }),
});
assert(headPoseContract.motionType === "pose_change_in_place", "head/eye-line motion should not be misclassified as object interaction");
assert(headPoseContract.bodyMechanics.centerOfMass === "specified", "anchored seated pose change should carry body anchor evidence");
assert(headPoseContract.bodyMechanics.contactPoints.length > 0, "anchored pose change should include contact/body anchor evidence");

const bboxOnlyLocomotion = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_locomotion_bbox_only",
    title: "Locomotion across the frame",
    storyFunction: "Move the subject by bbox translation only, with no footwork or center of mass description.",
  }),
  keyframePair: keyframePair({ shotId: "S_locomotion_bbox_only" }),
});
assert(bboxOnlyLocomotion.motionType === "locomotion", "locomotion classification failed");
assert(bboxOnlyLocomotion.whetherEndFrameRequired === false, "locomotion should default to first-frame video control");
assert(bboxOnlyLocomotion.bodyMechanics.required === true, "locomotion must require body mechanics");
assert(bboxOnlyLocomotion.status === "blocked", "bbox-only locomotion must be blocked");
assert(
  bboxOnlyLocomotion.blockers.some((blocker) => blocker.includes("bbox translation")),
  "bbox-only locomotion should include a bbox translation blocker",
);

const plannedWalkingLocomotion = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_locomotion_planned",
    title: "Character takes two small steps to camera right",
    storyFunction:
      "Small locomotion endpoint: left foot plants on the floor contact point, center of mass shifts over the planted foot, right foot follows and settles.",
  }),
  keyframePair: keyframePair({ shotId: "S_locomotion_planned" }),
});
assert(plannedWalkingLocomotion.motionType === "locomotion", "planned walking should classify as locomotion");
assert(plannedWalkingLocomotion.status === "pass", `planned walking should pass, got ${plannedWalkingLocomotion.status}`);
assert(plannedWalkingLocomotion.bodyMechanics.footwork.length > 0, "planned walking should include footwork");
assert(plannedWalkingLocomotion.bodyMechanics.centerOfMass === "specified", "planned walking should include center-of-mass transfer");
assert(
  plannedWalkingLocomotion.bodyMechanics.contactPoints.includes("foot_ground_contact_specified"),
  "planned walking should include an explicit foot/ground contact point",
);

const missingContactLocomotion = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_locomotion_missing_contact",
    title: "Character walks to camera right",
    storyFunction: "The plan says steps and center of mass transfer, but without a ground contact point.",
  }),
  keyframePair: keyframePair({ shotId: "S_locomotion_missing_contact" }),
});
assert(missingContactLocomotion.motionType === "locomotion", "missing-contact walk should classify as locomotion");
assert(missingContactLocomotion.status === "warning", "missing-contact walk should warn before hard-gate validation");
assert(missingContactLocomotion.bodyMechanics.footwork.length > 0, "missing-contact walk should still detect footwork");
assert(missingContactLocomotion.bodyMechanics.centerOfMass === "specified", "missing-contact walk should still detect center of mass");
assert(missingContactLocomotion.bodyMechanics.contactPoints.length === 0, "missing-contact walk must not invent contact points");

const weakLocomotion = buildMotionEndpointContract({
  generatedAt: "2026-05-09T00:00:00.000Z",
  shot: shot({
    id: "S_locomotion_weak",
    title: "Character walks into the room",
    storyFunction: "The character walks forward, but the shot does not yet describe center of mass transfer.",
  }),
  keyframePair: keyframePair({ shotId: "S_locomotion_weak" }),
});
assert(weakLocomotion.status === "warning", "locomotion with incomplete mechanics should warn");
assert(weakLocomotion.warnings.length > 0, "weak locomotion should carry warning text");

const repairedLocomotionValidation = validateMotionEndpointContract({
  ...weakLocomotion,
  bodyMechanics: {
    ...weakLocomotion.bodyMechanics,
    centerOfMass: "specified",
    footwork: ["left foot plants before weight transfer"],
    contactPoints: ["left foot ground contact"],
  },
  gateInputs: {
    ...weakLocomotion.gateInputs,
    motionEvidence: ["body_mechanics_language"],
  },
});
assert(repairedLocomotionValidation.status === "pass", "locomotion with mechanics should validate");

const schema = readJson("schemas/motion_endpoint_contract.schema.json");
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "motion schema $schema missing");

const registryEntry = findSchemaByType("MotionEndpointContract");
assert(registryEntry, "MotionEndpointContract missing from schema registry");
assert(registryEntry.fileName === "motion_endpoint_contract.schema.json", "registry file name mismatch");
assert(findSchemaByFileName("motion_endpoint_contract.schema.json")?.typeName === "MotionEndpointContract", "registry file lookup mismatch");
assert(
  schemaRegistry.some((entry) => entry.fileName === "motion_endpoint_contract.schema.json"),
  "schema registry missing motion contract entry",
);

console.log("Motion endpoint contract tests passed: micro-expression, object interaction, locomotion gates, schema, and registry.");
