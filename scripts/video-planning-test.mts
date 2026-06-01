import fs from "node:fs";

import { buildMotionEndpointContract } from "../src/core/motionPlanning.ts";
import { buildVideoPlanningState } from "../src/core/videoPlanning.ts";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function shotRecord(overrides = {}) {
  return {
    id: overrides.id || "S01",
    actId: "A1",
    title: overrides.title || "Static hold",
    storyFunction: overrides.storyFunction || "Hold the moment with only subtle motion.",
    status: "assets_ready",
    startFrame: `${overrides.id || "S01"}_start.png`,
    endFrame: `${overrides.id || "S01"}_end.png`,
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    issues: [],
    ...overrides,
  };
}

function keyframePair(shotId) {
  return {
    shotId,
    startFrameId: `${shotId}:start`,
    endFrameId: `${shotId}:end`,
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: ["planned endpoint motion"],
    mustPreserve: ["identity", "scene layout"],
    mustNotAdd: ["new character"],
  };
}

async function assertMotionEndpointContractIntegration() {
  const generatedAt = "2026-05-09T00:00:00.000Z";
  const explicitShot = shotRecord({
    id: "S_explicit",
    title: "Hero picks up the brass key",
    storyFunction: "Object interaction: hand grabs the approved prop and settles into the end pose.",
  });
  const fallbackShot = shotRecord({
    id: "S_fallback",
    title: "Close-up blink and breathing",
    storyFunction: "Micro-expression only; no pose or camera change.",
  });
  const explicitContract = buildMotionEndpointContract({
    generatedAt,
    shot: explicitShot,
    keyframePair: keyframePair(explicitShot.id),
  });
  const syntheticPlanning = buildVideoPlanningState({
    generatedAt,
    shots: [explicitShot, fallbackShot],
    jobs: [],
    taskViews: [],
    providerRegistry: {
      defaultProviderBySlot: { "video.i2v": "seedance_shell" },
      capabilities: [
        {
          providerId: "seedance_shell",
          slot: "video.i2v",
          requiredMode: "frames2video",
          executionState: "parked",
          liveSubmitAllowed: false,
        },
      ],
    },
    audioPlanning: {
      videoProviderPolicy: {
        noBgmForVideoProvider: true,
      },
    },
    issues: [],
    motionEndpointContracts: [explicitContract],
  });

  for (const gate of syntheticPlanning.readinessGates) {
    assert(gate.motionEndpointContract, `${gate.shotId} missing motionEndpointContract`);
    assert(gate.motionEndpointContract.shotId === gate.shotId, `${gate.shotId} motion contract shot mismatch`);
  }
  const fallbackGate = syntheticPlanning.readinessGates.find((gate) => gate.shotId === fallbackShot.id);
  assert(fallbackGate, "fallback shot missing readiness gate");
  assert(fallbackGate.motionEndpointContract.motionType === "micro_expression", "fallback contract was not derived from shot motion text");
  assert(
    fallbackGate.checks.find((item) => item.id === "motion_contract_present_or_derived")?.detail.includes("derived"),
    "fallback contract should be marked as derived",
  );
  for (const taskPlan of syntheticPlanning.taskPlans) {
    assert(taskPlan.motionEndpointFacts, `${taskPlan.shotId} missing motionEndpointFacts`);
    assert(typeof taskPlan.motionEndpointFacts.motionType === "string", `${taskPlan.shotId} missing motion type fact`);
    assert(typeof taskPlan.motionEndpointFacts.whetherEndFrameRequired === "boolean", `${taskPlan.shotId} missing end-frame requirement fact`);
    assert(taskPlan.motionEndpointFacts.endFrameRequiredReason, `${taskPlan.shotId} missing end-frame reason fact`);
    assert(["pass", "blocked", "warning"].includes(taskPlan.motionEndpointFacts.contractStatus), `${taskPlan.shotId} invalid contract status fact`);
    assert(Array.isArray(taskPlan.motionEndpointFacts.editableRegionIds), `${taskPlan.shotId} missing editable region facts`);
    assert(Array.isArray(taskPlan.motionEndpointFacts.protectedRegionIds), `${taskPlan.shotId} missing protected region facts`);
    assert(typeof taskPlan.motionEndpointFacts.bodyMechanicsRequired === "boolean", `${taskPlan.shotId} missing body mechanics fact`);
    assert(taskPlan.motionEndpointFacts.bboxOnlyMotionForbidden === true, `${taskPlan.shotId} bbox-only motion must be forbidden`);
    assert(
      taskPlan.promptConstraints.some((constraint) => constraint.includes("protect first 0.5s")),
      `${taskPlan.shotId} must include first-frame protection prompt constraint`,
    );
  }
}

function summarizeQueueShell(taskPlans) {
  const counts = {
    total: taskPlans.length,
    pending: taskPlans.filter((plan) => plan.queueStatus === "pending").length,
    ready: taskPlans.filter((plan) => plan.queueStatus === "ready").length,
    blocked: taskPlans.filter((plan) => plan.queueStatus === "blocked").length,
    parked: taskPlans.filter((plan) => plan.queueStatus === "parked").length,
  };
  const status =
    counts.total === 0
      ? "empty"
      : counts.blocked > 0 && (counts.parked > 0 || counts.ready > 0)
        ? "blocked_with_ready_gates"
        : counts.blocked > 0
          ? "blocked"
          : counts.parked > 0
            ? "parked"
            : "ready";

  return { status, counts };
}

function plan(queueStatus) {
  return { queueStatus };
}

const queueFixtures = [
  { name: "empty", plans: [], expected: "empty" },
  { name: "all blocked", plans: [plan("blocked"), plan("blocked")], expected: "blocked" },
  { name: "all parked", plans: [plan("parked")], expected: "parked" },
  { name: "all ready", plans: [plan("ready"), plan("ready")], expected: "ready" },
  { name: "blocked plus parked", plans: [plan("blocked"), plan("parked")], expected: "blocked_with_ready_gates" },
  { name: "blocked plus ready", plans: [plan("blocked"), plan("ready")], expected: "blocked_with_ready_gates" },
  { name: "blocked plus pending", plans: [plan("blocked"), plan("pending")], expected: "blocked" },
];

for (const fixture of queueFixtures) {
  const result = summarizeQueueShell(fixture.plans);
  assert(result.status === fixture.expected, `${fixture.name}: expected ${fixture.expected}, got ${result.status}`);
}

const state = readJson("fixtures/runtime-state.json");
const videoPlanning = state.videoPlanning;
assert(videoPlanning, "runtime-state missing videoPlanning");
const videoExecutionPreview = state.videoExecutionPreview;
assert(videoExecutionPreview, "runtime-state missing videoExecutionPreview");

const runtimeQueue = summarizeQueueShell(videoPlanning.taskPlans);
assert(
  runtimeQueue.status === videoPlanning.queueShell.status,
  `runtime queue status mismatch: expected ${runtimeQueue.status}, got ${videoPlanning.queueShell.status}`,
);
assert(
  JSON.stringify(runtimeQueue.counts) === JSON.stringify(videoPlanning.queueShell.counts),
  "runtime queue counts mismatch",
);

await assertMotionEndpointContractIntegration();

for (const taskPlan of videoPlanning.taskPlans) {
  assert(taskPlan.dryRunOnly === true, `${taskPlan.shotId} dryRunOnly must be true`);
  assert(taskPlan.providerSubmissionForbidden === true, `${taskPlan.shotId} provider submit must be forbidden`);
  assert(taskPlan.fastModelForbidden === true, `${taskPlan.shotId} fast model must be forbidden`);
  assert(taskPlan.vipChannelForbidden === true, `${taskPlan.shotId} VIP channel must be forbidden`);
  assert(taskPlan.textToVideoForbidden === true, `${taskPlan.shotId} text-to-video must be forbidden`);
  assert(taskPlan.liveSubmitAllowed === false, `${taskPlan.shotId} live submit must be false`);
  assert(taskPlan.promptConstraints.includes("no bgm"), `${taskPlan.shotId} must include no bgm`);
  assert(taskPlan.queueStatus !== "blocked_with_ready_gates", `${taskPlan.shotId} cannot use mixed status at task level`);
}

const requiredPreviewLocks = [
  "no_live_submit",
  "no_fast_model",
  "no_vip_channel",
  "no_text_to_video_main_path",
  "no_bgm_in_video_prompt",
  "first_frame_video_default",
  "endpoint_end_frame_optional",
  "subagent_must_use_packet",
];
const expectedOrder = [
  "prepare_subagent_packet",
  "inspect_readiness_gate",
  "compile_provider_adapter_payload_placeholder",
  "wait_for_user_enablement",
];
assert(videoExecutionPreview.dryRunOnly === true, "videoExecutionPreview dryRunOnly must be true");
assert(videoExecutionPreview.providerSubmissionForbidden === true, "videoExecutionPreview provider submit must be forbidden");
assert(videoExecutionPreview.liveSubmitAllowed === false, "videoExecutionPreview live submit must be false");
assert(
  videoExecutionPreview.previews.length === videoPlanning.taskPlans.length,
  "videoExecutionPreview should include one preview per video task plan",
);
const previewByTaskPlanId = new Map(videoExecutionPreview.previews.map((preview) => [preview.taskPlanId, preview]));
for (const taskPlan of videoPlanning.taskPlans) {
  const preview = previewByTaskPlanId.get(taskPlan.taskPlanId);
  assert(preview, `${taskPlan.taskPlanId} missing execution preview`);
  assert(preview.providerSlot === "video.i2v", `${preview.previewId} provider slot must be video.i2v`);
  assert(preview.requiredMode === "frames2video", `${preview.previewId} mode must be frames2video`);
  assert(preview.subagentPurpose === "video_generation", `${preview.previewId} purpose must be video_generation`);
  assert(preview.dryRunOnly === true, `${preview.previewId} dryRunOnly must be true`);
  assert(preview.providerSubmissionForbidden === true, `${preview.previewId} provider submit must be forbidden`);
  assert(preview.liveSubmitAllowed === false, `${preview.previewId} live submit must be false`);
  assert(preview.canExecute === false, `${preview.previewId} canExecute must be false`);
  for (const lock of requiredPreviewLocks) {
    assert(preview.hardLocks.includes(lock), `${preview.previewId} missing hard lock ${lock}`);
  }
  assert(JSON.stringify(preview.executionOrderPreview) === JSON.stringify(expectedOrder), `${preview.previewId} execution order drifted`);
  assert(preview.subagentPacketPreview, `${preview.previewId} missing structured packet preview`);
  assert(preview.subagentTaskEnvelope, `${preview.previewId} missing standard subagent task envelope`);
  assert(preview.subagentTaskEnvelope.parentTaskId === taskPlan.jobId, `${preview.previewId} subagent envelope parent mismatch`);
  assert(preview.subagentTaskEnvelope.purpose === "video_generation", `${preview.previewId} subagent envelope purpose mismatch`);
  assert(preview.subagentTaskEnvelope.sourceIndexRequired === true, `${preview.previewId} subagent envelope must require source index`);
  assert(preview.subagentTaskEnvelope.resultMustReferencePackHashes === true, `${preview.previewId} subagent result must reference pack hashes`);
  assert(preview.subagentTaskEnvelope.allowedReadScopes.includes("injected_knowledge_snippets"), `${preview.previewId} must allow only injected knowledge snippets`);
  assert(preview.subagentTaskEnvelope.disallowedReadScopes.includes("unrouted_knowledge_library"), `${preview.previewId} must forbid unrouted knowledge library`);
  assert(preview.subagentTaskEnvelope.injectedKnowledgePacks.length > 0, `${preview.previewId} missing injected knowledge packs`);
  assert(preview.subagentPacketPreview.selectedShot.shotId === taskPlan.shotId, `${preview.previewId} selected shot mismatch`);
  assert(preview.subagentPacketPreview.startFrameRef.shotFrameId === taskPlan.startFrameRef.shotFrameId, `${preview.previewId} start frame mismatch`);
  assert(preview.subagentPacketPreview.endFrameRef.shotFrameId === taskPlan.endFrameRef.shotFrameId, `${preview.previewId} end frame mismatch`);
  assert(preview.subagentPacketPreview.expectedOutputContract.artifactPolicy === "no_real_prompt_file_no_provider_task", `${preview.previewId} artifact policy drifted`);
  assert(preview.subagentPacketPreview.requiredKnowledgeCategories.includes("provider"), `${preview.previewId} must require provider knowledge category`);
  if (taskPlan.status === "blocked") {
    assert(preview.status === "blocked", `${preview.previewId} blocked task must produce blocked preview`);
    assert(preview.canPreviewPacket === false, `${preview.previewId} blocked task cannot preview packet`);
    assert(preview.canExecute === false, `${preview.previewId} blocked task cannot execute`);
  }
  const previewText = JSON.stringify(preview).toLowerCase();
  for (const forbiddenHint of ["submit provider", "provider submit now", "run seedance", "run jimeng", "generate video now", "create prompt file"]) {
    assert(!previewText.includes(forbiddenHint), `${preview.previewId} contains execution hint: ${forbiddenHint}`);
  }
}

const adapters = state.runtime.config.providerAdapterSettings || [];
assert(adapters.length >= 3, "providerAdapterSettings should include Image2, Seedance, and Jimeng shells");
const videoAdapters = adapters.filter((adapter) => adapter.slot === "video.i2v");
assert(videoAdapters.length >= 2, "video.i2v should expose Seedance/Jimeng adapter shells");
for (const adapter of adapters) {
  assert(adapter.dryRunOnly === true, `${adapter.id} dryRunOnly must be true`);
  assert(adapter.providerSubmissionForbidden === true, `${adapter.id} provider submit must be forbidden`);
  assert(adapter.liveSubmitAllowed === false, `${adapter.id} live submit must be false`);
  assert(adapter.supports.fastModel === false, `${adapter.id} fast model must be false`);
  assert(adapter.supports.vipChannel === false, `${adapter.id} VIP channel must be false`);
  assert(adapter.supports.bgmInVideoPrompt === false, `${adapter.id} BGM in video prompt must be false`);
  assert(adapter.forbiddenRoutes.includes("live_submit"), `${adapter.id} must forbid live submit`);
}

const videoSchema = readJson("schemas/video_task_plan.schema.json");
assert(videoSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "video schema $schema missing");
const videoExecutionSchema = readJson("schemas/video_execution_preview.schema.json");
assert(videoExecutionSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "video execution schema $schema missing");

const queueCondition = "counts.blocked > 0 && (counts.parked > 0 || counts.ready > 0)";
assert(fs.readFileSync("src/core/videoPlanning.ts", "utf8").includes(queueCondition), "core queue mixed-state condition drifted");
assert(fs.readFileSync("scripts/import-runtime-test.mts", "utf8").includes(queueCondition), "import queue mixed-state condition drifted");
const videoPlanningSource = fs.readFileSync("src/core/videoPlanning.ts", "utf8");
for (const checkId of [
  "motion_contract_present_or_derived",
  "motion_contract_not_blocked",
  "motion_endpoint_requirements_present",
  "motion_gate_inputs_pass",
  "motion_regions_declared",
  "motion_qa_thresholds_strict",
  "motion_end_frame_requirement_satisfied",
]) {
  assert(videoPlanningSource.includes(`"${checkId}"`), `videoPlanning missing motion check id ${checkId}`);
}

console.log(`Video planning tests passed: ${queueFixtures.length} queue fixtures, ${videoPlanning.taskPlans.length} runtime task plans, ${videoExecutionPreview.previews.length} execution previews, ${adapters.length} adapter shells.`);
