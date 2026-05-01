import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const { buildTaskPackets, taskPacketKinds } = await importTs("src/core/taskPacketBuilder.ts");

const generatedAt = "2026-04-30T00:00:00.000Z";

function shot(id) {
  return {
    id,
    actId: "A1",
    sectionId: "section-1",
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

function asset(id, type = "character") {
  return {
    id,
    type,
    name: id,
    path: `visual_memory/${id}.png`,
    status: "exists",
    lockedStatus: "locked",
    safeForFutureReference: true,
    issues: [],
  };
}

const keyframePair = {
  shotId: "1-2",
  startFrameId: "outputs/keyframes/1-2_start.png",
  endFrameId: "outputs/keyframes/1-2_end.png",
  endDerivationSource: "start_frame",
  validForI2vPair: true,
  allowedDelta: ["motion", "micro-expression", "camera movement"],
  mustPreserve: ["character identity", "scene layout", "style capsule"],
  mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
};

function runtime(overrides = {}) {
  return {
    generatedAt,
    sourceIndex: {
      sourceIndexHash: "source_hash_123",
    },
    sourceIndexSummary: {
      sourceIndexHash: "source_hash_123",
    },
    storyFlow: {
      shots: [shot("1-1"), shot("1-2"), shot("1-3")],
    },
    visualMemory: {
      assets: [asset("hero_locked"), asset("garage_scene_locked", "scene")],
    },
    videoPlanning: {
      readinessGates: [
        {
          gateId: "video_gate_1-2",
          shotId: "1-2",
          keyframePairDerivation: keyframePair,
        },
      ],
      taskPlans: [
        {
          taskPlanId: "video_task_1-2",
          shotId: "1-2",
          manifestFacts: {
            expectedOutputs: ["outputs/videos/1-2.mp4"],
          },
        },
      ],
    },
    ...overrides,
  };
}

const storyChangeTransaction = {
  id: "change_1",
  mustPreserve: ["preserve_character_identity", "preserve_scene_setting"],
  mustNotAdd: ["provider_submit", "direct_prompt_patch"],
};

const state = buildTaskPackets({
  runtimeState: runtime(),
  selectedShotId: "1-2",
  selectedAssetId: "hero_locked",
  storyChangeTransaction,
  generatedAt,
});

assert(state.noFreeTextTask === true, "Task Packet Builder must hard-lock noFreeTextTask=true");
assert(state.providerSubmissionForbidden === true, "Task Packet Builder must forbid provider submission");
assert(state.liveSubmitAllowed === false, "Task Packet Builder live submit must be false");
const requiredTaskKinds = [
  "image",
  "asset",
  "start_frame",
  "end_frame",
  "image_edit",
  "identity_qa",
  "scene_qa",
  "pair_qa",
  "story_audit",
  "video_execution",
  "audio",
  "export",
];
assert(state.packets.length === requiredTaskKinds.length, "builder must create all Phase38 task packet classes by default");
assert(state.summary.ready === requiredTaskKinds.length, `all fixture packets should be ready, got ${state.summary.ready}`);
for (const kind of requiredTaskKinds) {
  assert(taskPacketKinds.includes(kind), `taskPacketKinds missing Phase38 kind ${kind}`);
}

for (const kind of taskPacketKinds) {
  const packet = state.packets.find((candidate) => candidate.taskKind === kind);
  assert(packet, `missing packet kind ${kind}`);
  assert(packet.status === "ready", `${kind} packet should be ready`);
  assert(packet.envelope, `${kind} packet must include a validated-style envelope when ready`);
  assert(packet.envelopeId === packet.envelope.id, `${kind} envelope id mismatch`);
  assert(packet.hardFields, `${kind} missing hard fields`);
  assert(packet.hardFields.purpose === packet.envelope.purpose, `${kind} purpose must be mirrored into envelope`);
  assert(packet.hardFields.contextCapsule.some((item) => item.startsWith(`task_kind:${kind}`)), `${kind} context capsule missing task kind`);
  assert(packet.hardFields.storyFunction === "story beat 1-2", `${kind} story function missing`);
  assert(packet.hardFields.previousShot.shotId === "1-1", `${kind} previous shot missing`);
  assert(packet.hardFields.nextShot.shotId === "1-3", `${kind} next shot missing`);
  assert(packet.hardFields.beforeAfterShots.length === 2, `${kind} before/after shots must be explicit`);
  assert(packet.hardFields.boundAssets.length > 0, `${kind} bound assets missing`);
  assert(packet.hardFields.referenceAuthority.some((item) => item.startsWith("locked:")), `${kind} reference authority missing locked refs`);
  assert(packet.hardFields.expectedOutputs.length > 0, `${kind} expected outputs missing`);
  assert(packet.hardFields.mustPreserve.includes("source_index_hash"), `${kind} mustPreserve missing source index`);
  assert(packet.hardFields.allowedDelta.includes("structured_delta_only"), `${kind} allowed delta must be structured`);
  assert(packet.hardFields.mustAvoid.includes("provider_submit"), `${kind} mustAvoid missing provider_submit`);
  assert(packet.hardFields.hardNegatives.includes("free_text_task"), `${kind} hard negatives missing free_text_task`);
  assert(packet.hardFields.qaChecklist.length > 0, `${kind} qaChecklist missing`);
  assert(packet.hardFields.allowedReadScope.includes("source_index"), `${kind} allowed read scope missing source_index`);
  assert(packet.hardFields.forbiddenActions.includes("no_free_text_task"), `${kind} forbidden actions missing no_free_text_task`);
  assert(packet.hardFields.outputSchema === "subagent_result_v1", `${kind} output schema drifted`);
  assert(packet.hardFields.expectedOutputContract.format === "subagent_result_v1", `${kind} expected output contract format drifted`);
  assert(packet.envelope.expectedOutputContract.requiredFields.includes("summaryForMainAgent"), `${kind} output contract missing summaryForMainAgent`);
  assert(packet.envelope.expectedOutputContract.gateFields.length === 6, `${kind} output contract gate fields incomplete`);
  assert(packet.envelope.userIntent.includes(`task_kind:${kind}`), `${kind} envelope context capsule missing from userIntent`);
  assert(packet.envelope.taskEnvelope.expectedOutputs.length > 0, `${kind} envelope expected output missing`);
  assert(packet.envelope.neighborShots.some((shot) => shot.position === "previous"), `${kind} envelope previous shot missing`);
  assert(packet.envelope.neighborShots.some((shot) => shot.position === "next"), `${kind} envelope next shot missing`);
  assert(packet.envelope.lockedReferences.length > 0, `${kind} envelope locked reference authority missing`);
  assert(packet.envelope.mustNotAdd.length > 0, `${kind} envelope hard negatives missing`);
  assert(packet.envelope.allowedReadScopes.length > 0, `${kind} envelope allowed read scopes missing`);
  assert(packet.envelope.disallowedReadScopes.includes("provider_credentials"), `${kind} provider credentials must be forbidden`);
  assert(packet.canSubmitProvider === false, `${kind} cannot submit provider`);
}

assert(state.packets.find((packet) => packet.taskKind === "start_frame").envelope.taskEnvelope.expectedOutputs[0].endsWith("_start.png"), "start frame output must target start frame");
assert(state.packets.find((packet) => packet.taskKind === "end_frame").envelope.taskEnvelope.expectedOutputs[0].endsWith("_end.png"), "end frame output must target end frame");
assert(state.packets.find((packet) => packet.taskKind === "image_edit").envelope.taskEnvelope.providerSlot === "image.edit", "image edit must use image.edit slot");
assert(state.packets.find((packet) => packet.taskKind === "identity_qa").envelope.qaChecklist.includes("identity_gate"), "identity QA must include identity gate");

const videoPacket = state.packets.find((packet) => packet.taskKind === "video_execution");
for (const lock of ["no_fast_model", "no_vip_channel", "no_text_to_video_main_path", "no_bgm_in_video_prompt"]) {
  assert(videoPacket.hardFields.forbiddenActions.includes(lock), `video packet missing hard lock ${lock}`);
  assert(videoPacket.envelope.taskEnvelope.hardRules.includes(lock), `video task envelope must inherit ${lock}`);
  assert(videoPacket.envelope.mustNotAdd.includes(lock), `video subagent envelope must avoid ${lock}`);
}
assert(videoPacket.envelope.taskEnvelope.providerSlot === "video.i2v", "video packet must use video.i2v slot");
assert(videoPacket.envelope.taskEnvelope.requiredMode === "frames2video", "video packet must require frames2video");
assert(videoPacket.envelope.taskEnvelope.keyframePairDerivation.validForI2vPair === true, "video packet must keep keyframe pair derivation");

const noNeighborState = buildTaskPackets({
  runtimeState: runtime({ storyFlow: { shots: [shot("solo")] } }),
  selectedShotId: "solo",
  selectedAssetId: "hero_locked",
  storyChangeTransaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
const noNeighborPacket = noNeighborState.packets[0];
assert(noNeighborPacket.status === "blocked_missing_context", "missing neighbor shots must block packet");
assert(!noNeighborPacket.envelope, "blocked packet must not expose an envelope");
assert(noNeighborPacket.missingContext.includes("previous_shot"), "missing previous shot must be explicit");
assert(noNeighborPacket.missingContext.includes("next_shot"), "missing next shot must be explicit");
assert(noNeighborState.summary.envelopeReady === 0, "no envelope means not ready");

const noAssetState = buildTaskPackets({
  runtimeState: runtime({ visualMemory: { assets: [] } }),
  selectedShotId: "1-2",
  selectedAssetId: "missing_asset",
  storyChangeTransaction,
  requestedTaskKinds: ["image", "asset"],
  generatedAt,
});
for (const packet of noAssetState.packets) {
  assert(packet.status === "blocked_missing_context", `${packet.taskKind} must block when bound assets are missing`);
  assert(packet.missingContext.includes("bound_assets"), `${packet.taskKind} must report missing bound assets`);
  assert(!packet.envelope, `${packet.taskKind} must not be ready without envelope`);
}

console.log(
  `Task packet builder tests passed: ${state.summary.ready} ready packets, ${noNeighborPacket.missingContext.length} neighbor blockers, ${noAssetState.packets.length} asset blockers.`,
);
