import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(path, rewrites = []) {
  const source = fs.readFileSync(path, "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  for (const [from, to] of rewrites) output = output.replaceAll(from, to);
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

async function importTaskPacketBuilder() {
  const providerCapabilitiesSource = fs.readFileSync("src/core/providerCapabilities.ts", "utf8");
  const providerCapabilitiesOutput = ts.transpileModule(providerCapabilitiesSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: "src/core/providerCapabilities.ts",
  }).outputText;
  const providerCapabilitiesUrl = `data:text/javascript;base64,${Buffer.from(`${providerCapabilitiesOutput}\n//# sourceURL=${pathToFileURL("src/core/providerCapabilities.ts").href}`).toString("base64")}`;
  return importTs("src/core/taskPacketBuilder.ts", [['from "./providerCapabilities";', `from "${providerCapabilitiesUrl}";`]]);
}

const { buildTaskPackets, taskPacketKinds } = await importTaskPacketBuilder();

const generatedAt = "2026-04-30T00:00:00.000Z";

function shot(id, overrides = {}) {
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
    ...overrides,
  };
}

function asset(id, type = "character", overrides = {}) {
  return {
    id,
    type,
    name: id,
    path: `visual_memory/${id}.png`,
    status: "exists",
    lockedStatus: "locked",
    safeForFutureReference: true,
    issues: [],
    ...overrides,
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
      assets: [
        asset("hero_locked", "character", { usedByShotIds: ["1-2"] }),
        asset("garage_scene_locked", "scene", { usedByShotIds: ["1-2"] }),
        asset("villain_locked", "character", { usedByShotIds: ["1-3"] }),
        asset("global_style_locked", "style"),
      ],
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
  assert(packet.hardFields.providerRequirements.slot === packet.envelope.taskEnvelope.providerSlot, `${kind} provider requirement slot must mirror task envelope slot`);
  assert(packet.hardFields.providerRequirements.requiredMode === packet.envelope.taskEnvelope.requiredMode, `${kind} provider requirement mode must mirror task envelope mode`);
  assert(packet.envelope.taskEnvelope.providerRequirements.outputKind === packet.hardFields.providerRequirements.outputKind, `${kind} task envelope must carry capability requirements`);
  assert(packet.envelope.providerPolicySummary.some((item) => item.startsWith("providerSelection=")), `${kind} provider selection source missing`);
  assert(!packet.envelope.providerPolicySummary.some((item) => item.startsWith("provider=")), `${kind} provider summary must not hard-code provider identity`);
  assert(packet.hardFields.contextCapsule.some((item) => item.startsWith(`task_kind:${kind}`)), `${kind} context capsule missing task kind`);
  assert(packet.hardFields.storyFunction === "story beat 1-2", `${kind} story function missing`);
  assert(packet.hardFields.previousShot.shotId === "1-1", `${kind} previous shot missing`);
  assert(packet.hardFields.nextShot.shotId === "1-3", `${kind} next shot missing`);
  assert(packet.hardFields.beforeAfterShots.length === 2, `${kind} before/after shots must be explicit`);
  assert(packet.hardFields.boundAssets.length > 0, `${kind} bound assets missing`);
  const boundAssetIds = packet.hardFields.boundAssets.map((item) => item.id);
  if (kind === "asset") {
    assert(boundAssetIds.length === 1 && boundAssetIds.includes("hero_locked"), "asset packet must stay scoped to the selected asset");
  } else {
    assert(boundAssetIds.includes("hero_locked"), `${kind} must include selected asset scope`);
    assert(boundAssetIds.includes("garage_scene_locked"), `${kind} must include current shot scene scope`);
    assert(boundAssetIds.includes("global_style_locked"), `${kind} must include style scope`);
    assert(!boundAssetIds.includes("villain_locked"), `${kind} must not bind unrelated locked assets`);
  }
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

const customRegistry = {
  schemaVersion: "0.1.0",
  registryVersion: "provider-registry/custom-test",
  strictImageProvider: "registry_default",
  defaultProviderBySlot: {
    "image.edit": "custom-image-edit-provider",
  },
  capabilities: [
    {
      id: "custom-image-edit-provider:image.edit:image2image",
      providerId: "custom-image-edit-provider",
      providerName: "Custom Image Edit Provider",
      slot: "image.edit",
      requiredMode: "image2image",
      executionState: "active",
      liveSubmitAllowed: false,
      inputKinds: ["text", "image", "reference_image"],
      outputKind: "image",
      supports: {
        referenceImage: true,
        imageEdit: true,
        startEndFrame: false,
        bbox: "unsupported",
        cameraControl: "textual",
        controlNet: "unsupported",
        mask: "planned",
        negativePrompt: "supported",
      },
      maxReferenceImages: 2,
      forbiddenFallbacks: ["image2image_to_text2image"],
      notes: ["fixture custom default provider"],
    },
  ],
  notes: ["fixture registry"],
};
const customProviderState = buildTaskPackets({
  runtimeState: runtime(),
  selectedShotId: "1-2",
  selectedAssetId: "hero_locked",
  requestedTaskKinds: ["image_edit"],
  providerRegistry: customRegistry,
  generatedAt,
});
const customProviderEnvelope = customProviderState.packets[0].envelope.taskEnvelope;
assert(customProviderEnvelope.providerId === "custom-image-edit-provider", "task packet provider id must be selected from registry default");
assert(customProviderEnvelope.providerRequirements.slot === "image.edit", "task packet must express image edit slot requirement");

const noNeighborState = buildTaskPackets({
  runtimeState: runtime({ storyFlow: { shots: [shot("solo")] } }),
  selectedShotId: "solo",
  selectedAssetId: "hero_locked",
  storyChangeTransaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
const noNeighborPacket = noNeighborState.packets[0];
assert(noNeighborPacket.status === "ready", "edge shots must use boundary sentinels instead of blocking");
assert(noNeighborPacket.envelope, "edge shot packet must expose a boundary-aware envelope");
assert(noNeighborPacket.hardFields.previousShot.shotId.startsWith("boundary_start_"), "missing previous shot must become a start boundary sentinel");
assert(noNeighborPacket.hardFields.nextShot.shotId.startsWith("boundary_end_"), "missing next shot must become an end boundary sentinel");
assert(noNeighborPacket.hardFields.previousShot.continuityNotes.includes("boundary_sentinel:start"), "start boundary note missing");
assert(noNeighborPacket.hardFields.nextShot.continuityNotes.includes("boundary_sentinel:end"), "end boundary note missing");
assert(noNeighborState.summary.envelopeReady === 1, "boundary sentinels should allow the envelope to be ready");

const crossActState = buildTaskPackets({
  runtimeState: runtime({
    storyFlow: {
      shots: [
        shot("A1-last", { actId: "A1" }),
        shot("A2-first", { actId: "A2", sectionId: "section-2" }),
        shot("A2-second", { actId: "A2", sectionId: "section-2" }),
      ],
    },
  }),
  selectedShotId: "A2-first",
  selectedAssetId: "hero_locked",
  storyChangeTransaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
const crossActPacket = crossActState.packets[0];
assert(crossActPacket.status === "ready", "cross-act boundary should not block packet");
assert(crossActPacket.hardFields.previousShot.shotId.startsWith("boundary_start_A2"), "cross-act previous shot must become an act boundary anchor");
assert(crossActPacket.hardFields.previousShot.continuityNotes.some((note) => note.startsWith("cross_act:")), "cross-act boundary note missing");

const scopedShotState = buildTaskPackets({
  runtimeState: runtime(),
  selectedShotId: "1-2",
  storyChangeTransaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
const scopedShotAssetIds = scopedShotState.packets[0].hardFields.boundAssets.map((item) => item.id);
assert(scopedShotState.packets[0].status === "ready", "shot-scoped assets should satisfy bound asset context");
assert(scopedShotAssetIds.includes("hero_locked"), "shot scope should bind current shot character asset");
assert(scopedShotAssetIds.includes("garage_scene_locked"), "shot scope should bind current shot scene asset");
assert(scopedShotAssetIds.includes("global_style_locked"), "shot scope should bind global style asset");
assert(!scopedShotAssetIds.includes("villain_locked"), "shot scope must exclude unrelated locked assets");

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
  `Task packet builder tests passed: ${state.summary.ready} ready packets, ${noNeighborPacket.hardFields.beforeAfterShots.length} boundary refs, ${noAssetState.packets.length} asset blockers.`,
);
