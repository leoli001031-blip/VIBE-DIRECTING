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
  const knowledgeManifestUrl = `data:text/javascript;base64,${Buffer.from(`${transpileSource("src/core/knowledgeManifest.ts")}\n//# sourceURL=${pathToFileURL("src/core/knowledgeManifest.ts").href}`).toString("base64")}`;
  const knowledgeContextBudgetOutput = transpileSource("src/core/knowledgeContextBudget.ts").replaceAll(
    'from "./knowledgeManifest";',
    `from "${knowledgeManifestUrl}";`,
  );
  const knowledgeContextBudgetUrl = `data:text/javascript;base64,${Buffer.from(`${knowledgeContextBudgetOutput}\n//# sourceURL=${pathToFileURL("src/core/knowledgeContextBudget.ts").href}`).toString("base64")}`;
  const knowledgeDefaultsOutput = transpileSource("src/core/knowledgeDefaults.ts").replaceAll(
    'from "./knowledgeManifest";',
    `from "${knowledgeManifestUrl}";`,
  );
  const knowledgeDefaultsUrl = `data:text/javascript;base64,${Buffer.from(`${knowledgeDefaultsOutput}\n//# sourceURL=${pathToFileURL("src/core/knowledgeDefaults.ts").href}`).toString("base64")}`;
  const knowledgeLibraryOutput = transpileSource("src/core/knowledgeLibrary.ts").replaceAll(
    'from "./knowledgeManifest";',
    `from "${knowledgeManifestUrl}";`,
  );
  const knowledgeLibraryUrl = `data:text/javascript;base64,${Buffer.from(`${knowledgeLibraryOutput}\n//# sourceURL=${pathToFileURL("src/core/knowledgeLibrary.ts").href}`).toString("base64")}`;
  const knowledgeRouterOutput = transpileSource("src/core/knowledgeRouter.ts")
    .replaceAll('from "./knowledgeManifest";', `from "${knowledgeManifestUrl}";`)
    .replaceAll('from "./knowledgeContextBudget";', `from "${knowledgeContextBudgetUrl}";`);
  const knowledgeRouterUrl = `data:text/javascript;base64,${Buffer.from(`${knowledgeRouterOutput}\n//# sourceURL=${pathToFileURL("src/core/knowledgeRouter.ts").href}`).toString("base64")}`;

  return importTs("src/core/taskPacketBuilder.ts", [
    ['from "./providerCapabilities";', `from "${providerCapabilitiesUrl}";`],
    ['from "./knowledgeContextBudget";', `from "${knowledgeContextBudgetUrl}";`],
    ['from "./knowledgeDefaults";', `from "${knowledgeDefaultsUrl}";`],
    ['from "./knowledgeLibrary";', `from "${knowledgeLibraryUrl}";`],
    ['from "./knowledgeManifest";', `from "${knowledgeManifestUrl}";`],
    ['from "./knowledgeRouter";', `from "${knowledgeRouterUrl}";`],
  ]);
}

function transpileSource(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
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

const motionEndpointContract = {
  schemaVersion: "0.1.0",
  generatedAt,
  shotId: "1-2",
  motionType: "pose_change_in_place",
  whetherEndFrameRequired: true,
  endFrameRequiredReason: "End pose is required to preserve the planned start-to-end motion endpoint.",
  startPoseRequirement: {
    required: true,
    description: "Hero starts grounded beside the garage door.",
    mustPreserve: ["character identity", "garage layout"],
    reservedForEndPose: false,
  },
  endPoseRequirement: {
    required: true,
    description: "Hero finishes with the raised-arm silhouette from the approved end frame.",
    mustPreserve: ["character identity", "scene layout"],
    reservedForEndPose: true,
  },
  bodyMechanics: {
    required: true,
    description: "Weight shifts through the hips before the arm lift reaches the end pose.",
    centerOfMass: "hips shift from left foot to centered stance",
    footwork: ["left foot stays planted", "right foot pivots slightly"],
    contactPoints: ["both feet remain on floor"],
    timing: "anticipation, lift, settle",
  },
  editableRegions: [
    {
      id: "hero_pose",
      label: "hero pose",
      kind: "subject",
      frameRole: "both",
      description: "The hero body pose may move between endpoint frames.",
      constraints: ["preserve identity", "preserve clothing"],
    },
    {
      id: "hero_hands",
      label: "hero hands",
      kind: "hands",
      frameRole: "end",
      description: "Hand position can resolve into the approved end pose.",
      constraints: ["no extra fingers"],
    },
  ],
  protectedRegions: [
    {
      id: "garage_background",
      label: "garage background",
      kind: "background",
      frameRole: "both",
      description: "Garage layout must not drift.",
      constraints: ["no new props", "no layout change"],
    },
  ],
  bboxAnchors: [
    {
      id: "hero_bbox",
      target: "hero",
      frameRole: "both",
      notes: ["bbox is an anchor, not a substitute for motion mechanics"],
    },
  ],
  qaThresholds: {
    identityPreservation: "strict",
    scenePreservation: "strict",
    maxUnexplainedBboxShift: "small",
    requireDerivedEndFrame: true,
    requireBodyMechanicsEvidence: true,
  },
  gateInputs: {
    shotText: "Hero shifts weight and raises one hand.",
    motionEvidence: ["raised-arm endpoint", "grounded feet"],
    keyframePairPresent: true,
    keyframePairDerivesFromStart: true,
    bboxOnlyMotionForbidden: true,
  },
  keyframePairDerivation: keyframePair,
  status: "pass",
  blockers: [],
  warnings: [],
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
          motionEndpointContract,
        },
      ],
      taskPlans: [
        {
          taskPlanId: "video_task_1-2",
          shotId: "1-2",
          manifestFacts: {
            expectedOutputs: ["outputs/videos/1-2.mp4"],
          },
          motionEndpointFacts: {
            motionType: motionEndpointContract.motionType,
            whetherEndFrameRequired: motionEndpointContract.whetherEndFrameRequired,
            contractStatus: motionEndpointContract.status,
            editableRegionIds: motionEndpointContract.editableRegions.map((region) => region.id),
            protectedRegionIds: motionEndpointContract.protectedRegions.map((region) => region.id),
            bodyMechanicsRequired: motionEndpointContract.bodyMechanics.required,
            bboxOnlyMotionForbidden: motionEndpointContract.gateInputs.bboxOnlyMotionForbidden,
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
const motionTraceTaskKinds = ["start_frame", "end_frame", "pair_qa", "video_execution"];
const motionQaTaskKinds = ["end_frame", "pair_qa", "video_execution"];
const motionQaGates = ["motion_endpoint_contract_gate", "body_mechanics_gate", "editable_protected_region_gate"];
assert(state.packets.length === requiredTaskKinds.length, "builder must create all Phase38 task packet classes by default");
assert(state.summary.ready === requiredTaskKinds.length, `all fixture packets should be ready, got ${state.summary.ready}`);
assert(state.summary.validatedEnvelopeReady === requiredTaskKinds.length, "all ready packets must have validated envelopes");
assert(state.plannerReceipt.receiptKind === "phase38_full_task_subagent_packet_planner", "planner receipt kind drifted");
assert(state.plannerReceipt.status === "pass", `planner receipt should pass: ${state.plannerReceipt.blockedReasons.join("; ")}`);
assert(state.plannerReceipt.allProductionTaskKindsCovered === true, "planner receipt must cover every formal production task kind");
assert(state.plannerReceipt.productionTaskKinds.length === requiredTaskKinds.length, "planner receipt production task kind coverage drifted");
assert(state.plannerReceipt.validatedEnvelopeRequired === true, "planner receipt must require validated envelopes");
assert(state.plannerReceipt.formalTaskRejectsMissingPacket === true, "planner receipt must reject missing formal packets");
assert(state.plannerReceipt.expectedOutputsIncluded === true, "planner receipt must include expected outputs");
assert(state.plannerReceipt.sourceFactTraceRecorded === true, "planner receipt must include source fact trace");
assert(state.plannerReceipt.knowledgePacksRecorded === true, "planner receipt must include injected knowledge trace");
assert(state.plannerReceipt.phase37VisualConsistencyTraceRequired === true, "planner receipt must require Phase37 visual trace");
assert(state.plannerReceipt.noFreeTextWorker === true, "planner receipt must forbid free-text workers");
assert(state.plannerReceipt.providerSubmissionForbidden === true, "planner receipt must forbid provider submission");
assert(state.plannerReceipt.liveSubmitAllowed === false, "planner receipt live submit must be false");
for (const kind of requiredTaskKinds) {
  assert(taskPacketKinds.includes(kind), `taskPacketKinds missing Phase38 kind ${kind}`);
  assert(state.plannerReceipt.coverage.some((item) => item.taskKind === kind && item.status === "covered_ready"), `planner receipt missing ready coverage for ${kind}`);
}

for (const kind of taskPacketKinds) {
  const packet = state.packets.find((candidate) => candidate.taskKind === kind);
  assert(packet, `missing packet kind ${kind}`);
  assert(packet.status === "ready", `${kind} packet should be ready`);
  assert(packet.envelope, `${kind} packet must include a validated-style envelope when ready`);
  assert(packet.validationReceipt.status === "pass", `${kind} validation receipt must pass`);
  for (const [field, value] of Object.entries(packet.validationReceipt.requiredFields)) {
    assert(value === true, `${kind} validation receipt field ${field} must be true`);
  }
  assert(packet.sourceFactTrace.length > 0, `${kind} source fact trace missing`);
  for (const phase37Gate of ["identity", "scene", "shot_layout", "spatial_memory", "keyframe_pair", "master_inheritance_qa"]) {
    assert(packet.sourceFactTrace.some((item) => item.startsWith(`phase37_gate:${phase37Gate}:`)), `${kind} missing Phase37 ${phase37Gate} source trace`);
  }
  if (motionTraceTaskKinds.includes(kind)) {
    assert(
      packet.sourceFactTrace.includes("motion_contract:shot:1-2:status:pass:type:pose_change_in_place"),
      `${kind} missing motion contract status/type trace`,
    );
    assert(packet.sourceFactTrace.includes("motion_contract:end_required:true"), `${kind} missing motion end-required trace`);
    assert(packet.sourceFactTrace.includes("motion_contract:body_mechanics_required:true"), `${kind} missing body mechanics trace`);
    assert(packet.sourceFactTrace.includes("motion_contract:editable_regions:hero_pose,hero_hands"), `${kind} missing editable regions trace`);
    assert(packet.sourceFactTrace.includes("motion_contract:protected_regions:garage_background"), `${kind} missing protected regions trace`);
    assert(packet.sourceFactTrace.includes("motion_contract:bbox_only_forbidden:true"), `${kind} missing bbox-only forbidden trace`);
    assert(
      packet.sourceFactTrace.includes("motion_contract:keyframe_pair:1-2:outputs/keyframes/1-2_start.png:outputs/keyframes/1-2_end.png:start_frame:true"),
      `${kind} missing motion keyframe-pair trace`,
    );
  } else {
    assert(!packet.sourceFactTrace.some((item) => item.startsWith("motion_contract:")), `${kind} should not receive motion contract trace`);
  }
  assert(packet.injectedKnowledgeTrace.status === "present", `${kind} injected knowledge trace must be present`);
  assert(packet.injectedKnowledgeTrace.packIds.length > 0, `${kind} injected knowledge pack trace missing`);
  assert(packet.injectedKnowledgeTrace.snippetIds.length > 0, `${kind} injected knowledge snippet trace missing`);
  assert(packet.envelopeId === packet.envelope.id, `${kind} envelope id mismatch`);
  assert(packet.hardFields, `${kind} missing hard fields`);
  assert(packet.hardFields.purpose === packet.envelope.purpose, `${kind} purpose must be mirrored into envelope`);
  assert(packet.hardFields.providerRequirements.slot === packet.envelope.taskEnvelope.providerSlot, `${kind} provider requirement slot must mirror task envelope slot`);
  assert(packet.hardFields.providerRequirements.requiredMode === packet.envelope.taskEnvelope.requiredMode, `${kind} provider requirement mode must mirror task envelope mode`);
  assert(packet.envelope.taskEnvelope.providerRequirements.outputKind === packet.hardFields.providerRequirements.outputKind, `${kind} task envelope must carry capability requirements`);
  assert(packet.envelope.providerPolicySummary.some((item) => item.startsWith("providerSelection=")), `${kind} provider selection source missing`);
  assert(!packet.envelope.providerPolicySummary.some((item) => item.startsWith("provider=")), `${kind} provider summary must not hard-code provider identity`);
  assert(packet.envelope.providerPolicySummary.includes("noFreeTextTask=true"), `${kind} provider summary must carry noFreeTextTask=true`);
  assert(packet.envelope.providerPolicySummary.includes("noFreeTextWorker=true"), `${kind} provider summary must carry noFreeTextWorker=true`);
  assert(packet.envelope.providerPolicySummary.includes("providerSubmissionForbidden=true"), `${kind} provider summary must carry providerSubmissionForbidden=true`);
  assert(packet.envelope.providerPolicySummary.includes("liveSubmitAllowed=false"), `${kind} provider summary must carry liveSubmitAllowed=false`);
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
  for (const gate of motionQaGates) {
    if (motionQaTaskKinds.includes(kind)) {
      assert(packet.hardFields.qaChecklist.includes(gate), `${kind} qaChecklist missing ${gate}`);
      assert(packet.envelope.qaChecklist.includes(gate), `${kind} envelope qaChecklist missing ${gate}`);
      assert(packet.envelope.taskEnvelope.qaChecklist.includes(gate), `${kind} task envelope qaChecklist missing ${gate}`);
    } else {
      assert(!packet.hardFields.qaChecklist.includes(gate), `${kind} should not include ${gate}`);
    }
  }
  assert(packet.hardFields.allowedReadScope.includes("source_index"), `${kind} allowed read scope missing source_index`);
  assert(packet.hardFields.forbiddenActions.includes("no_free_text_task"), `${kind} forbidden actions missing no_free_text_task`);
  assert(packet.hardFields.forbiddenActions.includes("no_free_text_worker"), `${kind} forbidden actions missing no_free_text_worker`);
  assert(packet.hardFields.outputSchema === "subagent_result_v1", `${kind} output schema drifted`);
  assert(packet.hardFields.expectedOutputContract.format === "subagent_result_v1", `${kind} expected output contract format drifted`);
  assert(packet.envelope.expectedOutputContract.requiredFields.includes("summaryForMainAgent"), `${kind} output contract missing summaryForMainAgent`);
  assert(packet.envelope.expectedOutputContract.gateFields.length === 6, `${kind} output contract gate fields incomplete`);
  assert(packet.envelope.userIntent.includes(`task_kind:${kind}`), `${kind} envelope context capsule missing from userIntent`);
  assert(packet.envelope.taskEnvelope.expectedOutputs.length > 0, `${kind} envelope expected output missing`);
  assert(packet.envelope.taskEnvelope.sourceFactTrace.length > 0, `${kind} task envelope source fact trace missing`);
  assert(packet.envelope.sourceFactTrace.length === packet.sourceFactTrace.length, `${kind} subagent source fact trace must mirror packet`);
  assert(packet.envelope.resultSchema === "subagent_result_v1", `${kind} subagent result schema missing`);
  assert(packet.envelope.forbiddenActions.includes("no_free_text_task"), `${kind} subagent forbidden actions missing no_free_text_task`);
  assert(packet.envelope.injectedKnowledgeTrace.status === "present", `${kind} subagent injected knowledge trace must be present`);
  assert(packet.envelope.taskEnvelope.knowledgeRouteResultId, `${kind} task envelope missing knowledge route result id`);
  assert(packet.envelope.taskEnvelope.contextBudgetId, `${kind} task envelope missing context budget id`);
  assert(packet.envelope.taskEnvelope.knowledgeInputHash, `${kind} task envelope missing knowledge input hash`);
  assert(packet.envelope.taskEnvelope.knowledgeManifestHash, `${kind} task envelope missing knowledge manifest hash`);
  assert(packet.envelope.taskEnvelope.injectedKnowledgePacks.length > 0, `${kind} task envelope must carry injected knowledge packs`);
  assert(packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds.length > 0, `${kind} task envelope must carry injected knowledge snippet ids`);
  assert(packet.envelope.taskEnvelope.injectedKnowledgeSnippets.length > 0, `${kind} task envelope must carry injected knowledge snippets`);
  assert(packet.envelope.knowledgeRouteResultId === packet.envelope.taskEnvelope.knowledgeRouteResultId, `${kind} subagent knowledge route id must mirror task envelope`);
  assert(packet.envelope.contextBudgetId === packet.envelope.taskEnvelope.contextBudgetId, `${kind} subagent context budget id must mirror task envelope`);
  assert(packet.envelope.injectedKnowledgePacks.length === packet.envelope.taskEnvelope.injectedKnowledgePacks.length, `${kind} subagent knowledge packs must mirror task envelope`);
  assert(packet.envelope.injectedKnowledgeSnippetIds.length === packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds.length, `${kind} subagent knowledge snippet ids must mirror task envelope`);
  assert(packet.envelope.injectedKnowledgeSnippets.length === packet.envelope.taskEnvelope.injectedKnowledgeSnippets.length, `${kind} subagent knowledge snippets must mirror task envelope`);
  assert(packet.envelope.routeWarnings.some((warning) => warning.includes("knowledge_manifest_missing")), `${kind} should record fallback warning when no manifest is supplied`);
  assert(packet.envelope.injectedKnowledgePacks.length <= 6, `${kind} must not inject a broad knowledge library`);
  assert(Object.values(packet.envelope.qaPackBindings).some((binding) => binding.hash), `${kind} must preserve QA pack version/hash binding`);
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
assert(
  videoPacket.envelope.taskEnvelope.injectedKnowledgePacks.some((pack) => pack.packId === "audio/core-audio-planning"),
  "video packet must inject audio pack for default no-BGM separation",
);

const minimalMotionTraceState = buildTaskPackets({
  runtimeState: runtime({
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
  }),
  selectedShotId: "1-2",
  selectedAssetId: "hero_locked",
  storyChangeTransaction,
  requestedTaskKinds: ["start_frame", "end_frame", "pair_qa", "video_execution"],
  generatedAt,
});
for (const packet of minimalMotionTraceState.packets) {
  assert(packet.sourceFactTrace.includes("motion_contract:source:keyframe_pair_derived_minimal"), `${packet.taskKind} missing minimal motion source marker`);
  assert(
    packet.sourceFactTrace.includes("motion_contract:shot:1-2:status:derived_minimal:type:unknown"),
    `${packet.taskKind} missing minimal motion status/type trace`,
  );
}

const audioPacket = state.packets.find((packet) => packet.taskKind === "audio");
assert(audioPacket.envelope.taskEnvelope.purpose === "audio", "audio task envelope purpose must be audio");
assert(audioPacket.envelope.taskEnvelope.providerSlot === "audio.tts", "audio packet must use audio.tts slot");
assert(
  audioPacket.envelope.taskEnvelope.injectedKnowledgePacks.some((pack) => pack.packId === "audio/core-audio-planning"),
  "audio packet must inject audio planning pack",
);

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
  assert(packet.validationReceipt.status === "blocked", `${packet.taskKind} missing assets must block validation receipt`);
  assert(packet.validationReceipt.blockers.includes("blocked_missing_context:bound_assets"), `${packet.taskKind} validation receipt must record bound asset blocker`);
  assert(!packet.envelope, `${packet.taskKind} must not be ready without envelope`);
}

console.log(
  `Task packet builder tests passed: ${state.summary.ready} ready packets, ${noNeighborPacket.hardFields.beforeAfterShots.length} boundary refs, ${noAssetState.packets.length} asset blockers.`,
);
