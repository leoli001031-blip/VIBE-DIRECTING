import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

async function importTs(pathValue) {
  const source = fs.readFileSync(pathValue, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: pathValue,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(pathValue).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
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

const {
  buildMotionEndpointContract,
  classifyMotionType,
  endFrameRequiredForMotionType,
  validateMotionEndpointContract,
  motionEndpointContractSchemaVersion,
} = await importTs("src/core/motionPlanning.ts");
const { schemaRegistry, findSchemaByType, findSchemaByFileName } = await importTs("src/core/schemaRegistry.ts");

assert(motionEndpointContractSchemaVersion === "0.1.0", "motion contract schema version drifted");
assert(classifyMotionType("角色眨眼、轻微呼吸，只有微表情变化") === "micro_expression", "micro expression classification failed");
assert(endFrameRequiredForMotionType("micro_expression") === false, "micro expression must not require end frame");

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
assert(objectContract.whetherEndFrameRequired === true, "object interaction must require an end frame");
assert(objectContract.startPoseRequirement.reservedForEndPose === true, "object interaction start pose must reserve future endpoint space");
assert(objectContract.endPoseRequirement.required === true, "object interaction end pose must be required");
assert(objectContract.editableRegions.some((region) => region.id === "hands_and_prop_region"), "object interaction missing editable hands/prop region");
assert(objectContract.protectedRegions.length >= 2, "object interaction missing protected regions");
assert(objectContract.status === "pass", `object interaction contract should pass, got ${objectContract.status}`);

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
assert(bboxOnlyLocomotion.whetherEndFrameRequired === true, "locomotion must require an end frame");
assert(bboxOnlyLocomotion.bodyMechanics.required === true, "locomotion must require body mechanics");
assert(bboxOnlyLocomotion.status === "blocked", "bbox-only locomotion must be blocked");
assert(
  bboxOnlyLocomotion.blockers.some((blocker) => blocker.includes("bbox translation")),
  "bbox-only locomotion should include a bbox translation blocker",
);

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
assert(schema.title === "MotionEndpointContract", "motion schema title mismatch");
assert(schema.$ref === "#/$defs/motionEndpointContract", "motion schema root ref mismatch");
assert(schema.$defs.motionEndpointContract.additionalProperties === false, "motion contract schema must forbid additional properties");
assert(schema.$defs.poseRequirement.additionalProperties === false, "pose requirement schema must forbid additional properties");
assert(schema.$defs.bodyMechanics.additionalProperties === false, "body mechanics schema must forbid additional properties");
assert(schema.$defs.endpointRegion.additionalProperties === false, "endpoint region schema must forbid additional properties");

const registryEntry = findSchemaByType("MotionEndpointContract");
assert(registryEntry, "MotionEndpointContract missing from schema registry");
assert(registryEntry.fileName === "motion_endpoint_contract.schema.json", "registry file name mismatch");
assert(findSchemaByFileName("motion_endpoint_contract.schema.json")?.typeName === "MotionEndpointContract", "registry file lookup mismatch");
assert(
  schemaRegistry.some((entry) => entry.id === "https://vibecore.local/schemas/motion_endpoint_contract.schema.json"),
  "schema registry missing motion contract id",
);

console.log("Motion endpoint contract tests passed: micro-expression, object interaction, locomotion gates, schema, and registry.");
