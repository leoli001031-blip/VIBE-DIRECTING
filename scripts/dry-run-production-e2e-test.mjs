import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

async function loadCoreModules() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-dry-run-e2e-"));
  const modules = [
    ["providerCapabilities", []],
    ["assetLibraryCrud", []],
    ["projectStore", []],
    ["taskPacketBuilder", [['from "./providerCapabilities"', 'from "./providerCapabilities.mjs"']]],
    ["localOrchestrator", []],
    ["providerLiveGate", []],
    ["exportBuilder", []],
    ["visualConsistency", []],
  ];
  for (const [moduleName, rewrites] of modules) {
    fs.writeFileSync(path.join(tmpDir, `${moduleName}.mjs`), transpile(`src/core/${moduleName}.ts`, rewrites), "utf8");
  }
  fs.writeFileSync(path.join(tmpDir, "storyChange.mjs"), transpile("src/core/storyChange.ts"), "utf8");
  fs.writeFileSync(
    path.join(tmpDir, "directorEdit.mjs"),
    transpile("src/core/directorEdit.ts", [['from "./storyChange"', 'from "./storyChange.mjs"']]),
    "utf8",
  );

  const imported = {};
  for (const [moduleName] of modules) {
    imported[moduleName] = await import(pathToFileURL(path.join(tmpDir, `${moduleName}.mjs`)).href);
  }
  imported.directorEdit = await import(pathToFileURL(path.join(tmpDir, "directorEdit.mjs")).href);
  return imported;
}

const {
  assetLibraryCrud,
  projectStore,
  directorEdit,
  taskPacketBuilder,
  localOrchestrator,
  providerLiveGate,
  exportBuilder,
  visualConsistency,
} = await loadCoreModules();

const generatedAt = "2026-04-30T00:00:00.000Z";

function gates(overrides = {}) {
  return {
    identity: "PASS",
    scene: "PASS",
    pair: "PASS",
    story: "PASS",
    prop: "N/A",
    style: "PASS",
    ...overrides,
  };
}

function shot(id, title) {
  return {
    id,
    actId: "A1",
    sectionId: "opening",
    title,
    storyFunction: `${title} story function`,
    startFrame: `outputs/keyframes/${id}_start.png`,
    endFrame: `outputs/keyframes/${id}_end.png`,
    status: "ready",
    gates: gates(),
    issues: [],
  };
}

const shots = [
  shot("S01", "Set up the garage"),
  shot("S02", "Hero notices the sound"),
  shot("S03", "Hero decides to wait"),
];

const storyFlow = {
  schemaVersion: "0.1.0",
  id: "story_flow_dry_run_e2e",
  productionBibleId: "production_bible_dry_run_e2e",
  sectionModel: "adaptive",
  sections: [
    {
      id: "opening",
      label: "Opening",
      sectionKind: "custom",
      sequenceIndex: 0,
      storyFunction: "A compact dry-run sequence.",
      beats: [],
      shots: shots.map((item) => ({ id: item.id, shotSpecId: item.id, storyFunction: item.storyFunction, status: "ready" })),
    },
  ],
  shotOrder: shots.map((item) => item.id),
  shots,
  sourceRefs: ["dry_run_e2e.story_flow"],
  updatedAt: generatedAt,
};

const sourceIndex = {
  projectId: "dry_run_e2e",
  projectVersion: "0.1.0",
  sourceIndexHash: "source_hash_dry_run_e2e",
  currentPromptHashes: {},
  lockedReferenceIds: [
    "hero_locked",
    "visual_memory/characters/hero/main.png",
    "garage_scene_locked",
    "visual_memory/scenes/garage/master.png",
  ],
  candidateReferenceIds: ["candidate_prop"],
  rejectedReferenceIds: [],
  failedReferenceIds: [],
  confirmedDecisionIds: [],
  staleArtifactIds: [],
  updatedAt: generatedAt,
};

const initialProjectStore = projectStore.createProjectStoreSnapshot({
  generatedAt,
  projectId: "dry_run_e2e",
  title: "Dry Run E2E",
  version: "0.1.0",
  sourceIndex,
  sourceIndexHash: sourceIndex.sourceIndexHash,
});
assert(initialProjectStore.hardLocks.noFileMutation === true, "Project Store snapshot must hard-lock no file mutation");
assert(initialProjectStore.projectFile.status === "fixture_only_not_written", "project.vibe must remain fixture-only");

let library = assetLibraryCrud.createAssetLibrarySnapshot({ id: "visual_memory_dry_run_e2e", createdAt: generatedAt });
for (const input of [
  {
    id: "hero_locked",
    assetType: "character",
    name: "Hero Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: "visual_memory/characters/hero/main.png",
    textConstraints: ["same face", "blue work jacket"],
    sourceRefs: ["dry_run_e2e.hero"],
    usedByShotIds: ["S01", "S02", "S03"],
    updatedAt: generatedAt,
  },
  {
    id: "garage_scene_locked",
    assetType: "scene",
    name: "Garage Scene Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: "visual_memory/scenes/garage/master.png",
    textConstraints: ["single garage door", "workbench camera left"],
    sourceRefs: ["dry_run_e2e.scene"],
    usedByShotIds: ["S01", "S02", "S03"],
    updatedAt: generatedAt,
  },
  {
    id: "candidate_prop",
    assetType: "prop",
    name: "Candidate Prop",
    status: "candidate",
    sourceKind: "manual_definition",
    textConstraints: ["unapproved radio prop"],
    sourceRefs: ["dry_run_e2e.candidate"],
    usedByShotIds: ["S02"],
    updatedAt: generatedAt,
  },
]) {
  const result = assetLibraryCrud.addAssetLibraryAsset(library, input);
  assert(result.validation.ok, `${input.id} should validate: ${result.validation.errors.join("; ")}`);
  library = result.library;
}

let sceneResult = assetLibraryCrud.addSceneDerivedViewPlaceholder(library, {
  sceneId: "garage_scene_locked",
  viewId: "garage_reverse_locked",
  status: "locked",
  worldPosition: { x: 1, y: 0, z: 2 },
  cameraVector: { x: 0, y: 0, z: -1 },
  viewImageRefs: ["visual_memory/scenes/garage/reverse.png"],
  derivationEvidence: ["derived_from_master_scene_camera_solve"],
  updatedAt: generatedAt,
});
assert(sceneResult.validation.ok, `derived view should validate: ${sceneResult.validation.errors.join("; ")}`);
library = sceneResult.library;

const blockedImport = assetLibraryCrud.addAssetLibraryAsset(library, {
  id: "blocked_contact_sheet",
  assetType: "character",
  name: "Blocked Contact Sheet",
  status: "locked",
  sourceKind: "contact_sheet",
  path: "reports/contact_sheets/hero_grid.png",
  textConstraints: ["must not enter formal library"],
  updatedAt: generatedAt,
});
assert(blockedImport.rejected, "contact sheet import must be rejected before formal library");
library = blockedImport.library;

const visualMemory = assetLibraryCrud.toVisualMemoryDocument(library);
const projectPatch = projectStore.applyProjectStorePatch(initialProjectStore, {
  id: "patch_project_facts_from_asset_library",
  appliedAt: generatedAt,
  operations: [
    { op: "set_story_flow", value: storyFlow },
    { op: "set_visual_memory", value: visualMemory },
    { op: "set_source_index", value: sourceIndex, sourceIndexHash: sourceIndex.sourceIndexHash },
    ...shots.map((item) => ({
      op: "upsert_shot_spec",
      shotId: item.id,
      value: {
        schemaVersion: "0.1.0",
        id: item.id,
        storyFunction: item.storyFunction,
        sourceRefs: [`dry_run_e2e.shot.${item.id}`],
      },
    })),
  ],
});
assert(projectPatch.validation.ok, `patched Project Store should validate: ${projectPatch.validation.errors.join("; ")}`);
assert(projectPatch.snapshot.factFiles.some((fact) => fact.role === "visual_memory"), "Project Store must carry visual memory fact");
assert(projectPatch.snapshot.factFiles.some((fact) => fact.role === "shot_spec"), "Project Store must carry shot spec facts");

const savedProjectPlan = projectStore.saveProjectStoreSnapshot(projectPatch.snapshot, generatedAt);
assert(savedProjectPlan.savePlan.noFileMutation === true, "Project Store save plan must be no-file-mutation");
assert(savedProjectPlan.savePlan.projectVibeWriteAllowed === false, "Project Store must not write project.vibe in dry-run");

function runtimeAsset(id, type, pathValue, lockedStatus = "locked") {
  return {
    id,
    type,
    name: id,
    path: pathValue,
    status: "exists",
    lockedStatus,
    safeForFutureReference: lockedStatus === "locked",
    issues: [],
  };
}

const keyframePair = {
  shotId: "S02",
  startFrameId: "outputs/keyframes/S02_start.png",
  endFrameId: "outputs/keyframes/S02_end.png",
  endDerivationSource: "start_frame",
  validForI2vPair: true,
  allowedDelta: ["micro-expression"],
  mustPreserve: ["character identity", "scene layout", "style capsule"],
  mustNotAdd: ["new character", "new location", "text-to-video fallback"],
};

const runtimeState = {
  generatedAt,
  sourceIndex,
  sourceIndexSummary: { sourceIndexHash: sourceIndex.sourceIndexHash },
  storyFlow: { shots },
  visualMemory: {
    assets: [
      runtimeAsset("hero_locked", "character", "visual_memory/characters/hero/main.png"),
      runtimeAsset("garage_scene_locked", "scene", "visual_memory/scenes/garage/master.png"),
      runtimeAsset("candidate_prop", "prop", "visual_memory/props/candidate.png", "candidate"),
    ],
  },
  videoPlanning: {
    readinessGates: [
      {
        gateId: "video_gate_S02",
        shotId: "S02",
        keyframePairDerivation: keyframePair,
      },
    ],
    taskPlans: [
      {
        taskPlanId: "video_task_S02",
        shotId: "S02",
        manifestFacts: {
          expectedOutputs: ["outputs/videos/S02.mp4"],
        },
      },
    ],
  },
};

const visualReport = visualConsistency.validateVisualConsistency({
  checkedAt: generatedAt,
  assetLibrary: library,
  shotLayouts: [
    {
      schemaVersion: "0.1.0",
      id: "shot_layout_S02",
      shotId: "S02",
      sceneId: "garage_scene_locked",
      subjectPlacement: {
        subjectId: "hero_locked",
        worldPosition: { x: 0, y: 0, z: 1 },
        framePlacement: "center",
        blockingIntent: "listen without changing position",
      },
      cameraPlacement: {
        worldPosition: { x: 0, y: 1.5, z: -3 },
        cameraVector: { x: 0, y: -0.1, z: 1 },
        height: "eye_level",
        framing: "medium",
      },
      axisAndDirection: {
        axisId: "garage_axis",
        screenDirection: "static",
        worldDirection: { x: 1, y: 0, z: 0 },
        crossesAxis: false,
      },
      startFrame: {
        description: "Hero stands near the workbench.",
        subjectPlacementId: "hero_locked",
        cameraPlacementId: "garage_camera_A",
      },
      endFrameDerivation: {
        derivesFrom: "start_frame",
        derivationMode: "same_camera_state_change",
        allowedChanges: ["micro-expression"],
        forbiddenChanges: ["new character", "new location"],
      },
      cameraConstraints: {
        fixedCamera: true,
        movementAllowed: "none",
        allowedMovements: [],
        forbiddenMovements: ["dolly", "truck"],
      },
      spatialAnchors: ["garage_door", "workbench"],
      updatedAt: generatedAt,
    },
  ],
  startEndDerivations: {
    keyframePairs: [keyframePair],
    promptPlans: [
      {
        promptPlanId: "prompt_S02_end",
        promptPlanHash: "prompt_hash_S02_end",
        sourceShotSpecHash: "shot_hash_S02",
        jobId: "job_S02_end",
        shotId: "S02",
        providerId: "openai-image2-api",
        providerSlot: "image.edit",
        requiredMode: "image2image",
        promptKind: "end_frame",
        sourceIntent: ["derive end frame from start"],
        naturalLanguagePolicy: "source_intent_only",
        mustPreserve: ["character identity", "scene layout"],
        mustAvoid: ["new character", "new location"],
        referenceIds: ["hero_locked", "garage_scene_locked"],
        styleDirectives: [],
        adapterWarnings: [],
        derivesFromStartFrame: true,
        status: "ready_for_envelope",
        blockers: [],
        conflictReportId: "conflict_clear",
        createdAt: generatedAt,
      },
    ],
  },
  postprocessPolicies: [
    {
      policyId: "dry_run_local_postprocess",
      allowedLocalOperations: ["resize", "format_convert", "thumbnail_preview", "metadata_probe", "manifest_match"],
      semanticRepairAllowed: false,
      openCvSemanticRepairAllowed: false,
      localPostprocessCanChangeMeaning: false,
      localPostprocessCanPromoteFormal: false,
      forbiddenActions: ["semantic_postprocess_repair"],
    },
  ],
});
assert(visualReport.status === "pass", `visual consistency should pass: ${visualReport.blockers.join("; ")}`);
assert(visualReport.summary.forbiddenFutureReferences === 0, "blocked contact sheet must not become future reference");

const directorPlan = directorEdit.buildDirectorEditPlan({
  userIntent: "让 S02 的节奏更安静，但保持人物身份和车库场景一致",
  selection: { scopeKind: "shot", shotId: "S02" },
  runtimeState,
  createdAt: generatedAt,
});
assert(directorPlan.providerPromptPatchForbidden === true, "Director Edit must forbid direct provider prompt patches");
assert(directorPlan.providerSubmissionForbidden === true, "Director Edit must forbid provider submission");
assert(directorPlan.status !== "blocked_prompt_bypass", "structured edit should not be prompt-bypass blocked");

const packetState = taskPacketBuilder.buildTaskPackets({
  runtimeState,
  selectedShotId: "S02",
  selectedAssetId: "hero_locked",
  storyChangeTransaction: directorPlan.transaction,
  generatedAt,
});
assert(packetState.summary.ready === packetState.summary.total, "all fixture task packets should be ready");
assert(packetState.providerSubmissionForbidden === true, "Task Packet Builder must forbid provider submission");

function packetCanEnterFormal(packet) {
  return Boolean(
    packet.status === "ready" &&
      packet.envelope &&
      packet.hardFields?.outputSchema === "subagent_result_v1" &&
      packet.hardFields.expectedOutputContract?.format === "subagent_result_v1" &&
      packet.envelope.sourceIndexHash &&
      packet.hardFields.boundAssets?.length &&
      packet.hardFields.previousShot &&
      packet.hardFields.nextShot,
  );
}

const imagePacket = packetState.packets.find((packet) => packet.taskKind === "image");
assert(packetCanEnterFormal(imagePacket), "ready image packet should satisfy schema/hash/asset/context envelope prerequisites");

const missingSchemaPacket = clone(imagePacket);
delete missingSchemaPacket.hardFields.outputSchema;
assert(!packetCanEnterFormal(missingSchemaPacket), "missing output schema must not be formal-ready");

const missingHashState = taskPacketBuilder.buildTaskPackets({
  runtimeState: {
    ...runtimeState,
    sourceIndex: { ...sourceIndex, sourceIndexHash: "" },
    sourceIndexSummary: { sourceIndexHash: "" },
  },
  selectedShotId: "S02",
  selectedAssetId: "hero_locked",
  storyChangeTransaction: directorPlan.transaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
assert(missingHashState.packets[0].status === "blocked_missing_context", "missing source hash must block task packet");
assert(missingHashState.packets[0].missingContext.includes("source_index_hash"), "missing hash blocker must be explicit");

const missingAssetState = taskPacketBuilder.buildTaskPackets({
  runtimeState: { ...runtimeState, visualMemory: { assets: [] } },
  selectedShotId: "S02",
  selectedAssetId: "hero_locked",
  storyChangeTransaction: directorPlan.transaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
assert(missingAssetState.packets[0].status === "blocked_missing_context", "missing bound asset must block task packet");
assert(missingAssetState.packets[0].missingContext.includes("bound_assets"), "missing asset blocker must be explicit");

const missingContextState = taskPacketBuilder.buildTaskPackets({
  runtimeState: { ...runtimeState, storyFlow: { shots: [shots[1]] } },
  selectedShotId: "S02",
  selectedAssetId: "hero_locked",
  storyChangeTransaction: directorPlan.transaction,
  requestedTaskKinds: ["image"],
  generatedAt,
});
assert(missingContextState.packets[0].status === "ready", "edge shot context must use boundary sentinels instead of blocking");
assert(missingContextState.packets[0].hardFields.previousShot.shotId.startsWith("boundary_start_"), "missing previous context must become a start boundary sentinel");
assert(missingContextState.packets[0].hardFields.nextShot.shotId.startsWith("boundary_end_"), "missing next context must become an end boundary sentinel");

const readyPackets = packetState.packets.filter((packet) => packet.status === "ready");
const orchestratorTaskPackets = readyPackets.map((packet, index) => ({
  packetId: packet.packetId,
  taskPlanId: packet.envelope.taskEnvelope.id,
  jobId: `job_${packet.taskKind}_S02`,
  shotId: "S02",
  envelopeId: packet.envelope.taskEnvelope.id,
  taskKind: packet.taskKind,
  expectedOutputs: packet.envelope.taskEnvelope.expectedOutputs,
  dependencies: packet.envelope.taskEnvelope.dependencies,
  queueOrder: index,
  sourceRefs: [packet.packetId],
}));
const taskEnvelopes = readyPackets.map((packet) => packet.envelope.taskEnvelope);
const selfReportEnvelope = taskEnvelopes[0];
const orchestratorState = localOrchestrator.buildLocalOrchestratorState({
  generatedAt,
  taskPackets: orchestratorTaskPackets,
  taskEnvelopes,
  taskRuns: [
    {
      taskId: selfReportEnvelope.id,
      localStatus: "succeeded",
      providerStatus: "success",
      providerId: selfReportEnvelope.providerId,
      retryCount: 0,
      stallTimeoutSeconds: 600,
      tempDirs: [],
      expectedOutputs: selfReportEnvelope.expectedOutputs,
      actualOutputs: selfReportEnvelope.expectedOutputs,
      lastEventAt: generatedAt,
    },
  ],
  options: { autoContinue: true, concurrency: 1 },
});
const selfReportItem = orchestratorState.queue.find((item) => item.envelopeId === selfReportEnvelope.id);
assert(selfReportItem, "orchestrator must contain the self-report task item");
assert(selfReportItem.completionGate.workerSelfReportPresent === true, "worker self-report must be recorded");
assert(selfReportItem.completionGate.workerSelfReportOnly === true, "worker self-report alone must be explicit");
assert(selfReportItem.completionGate.completeVerified === false, "worker self-report success cannot complete the task");
assert(selfReportItem.queueStatus === "needs_review", "worker self-report-only task must need review");
assert(orchestratorState.noFileMutation === true, "Local Orchestrator must preserve noFileMutation");
assert(orchestratorState.daemonStarted === false, "Local Orchestrator must not start daemon");

function providerRegistryFixture() {
  return {
    schemaVersion: "0.1.0",
    registryVersion: "dry-run-e2e",
    strictImageProvider: "image2_only",
    defaultProviderBySlot: {
      "image.edit": "openai-image2-api",
    },
    capabilities: [
      {
        id: "cap_image2_edit",
        providerId: "openai-image2-api",
        providerName: "OpenAI Image2",
        slot: "image.edit",
        requiredMode: "image2image",
        executionState: "active",
        liveSubmitAllowed: false,
        inputKinds: ["text", "image", "reference_image"],
        outputKind: "image",
        supports: {
          referenceImage: true,
          imageEdit: true,
          startEndFrame: true,
          bbox: "unsupported",
          cameraControl: "textual",
          controlNet: "unsupported",
          mask: "planned",
          negativePrompt: "supported",
        },
        maxReferenceImages: 4,
        forbiddenFallbacks: ["provider_or_mode_fallback", "text_to_video_fallback"],
        notes: ["dry-run fixture capability"],
      },
    ],
    notes: ["dry-run fixture registry"],
  };
}

function adapterContractsFixture() {
  return {
    schemaVersion: "0.1.0",
    generatedAt,
    agentAdapters: [],
    workerAdapters: [],
    providerAdapters: [
      {
        id: "image2-edit-provider",
        kind: "provider",
        label: "Image2 Edit Provider",
        providerIds: ["openai-image2-api"],
        slot: "image.edit",
        requiredModes: ["image2image"],
        state: "active",
        dryRunOnly: true,
        readOnly: true,
        liveSubmitAllowed: false,
        credentialStatus: "not_configured",
        credentialStorage: false,
        providerSubmissionForbidden: true,
        arbitraryProviderCommandAllowed: false,
        capabilityRefs: ["cap_image2_edit"],
        capabilitySummary: {
          outputKinds: ["image"],
          supportsReferenceImage: true,
          supportsStartEndFrame: true,
          supportsTextToVideo: false,
        },
        forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
        notes: ["dry-run fixture adapter"],
      },
    ],
    summary: {
      agentAdapters: [],
      workerAdapters: [],
      providerAdapters: ["image2-edit-provider"],
      activeImageProvider: "openai-image2-api",
      parkedVideoProviders: [],
      liveSubmitAllowed: false,
      credentialStorage: false,
      contractViolations: [],
    },
  };
}

const imageTaskPlan = {
  taskPlanId: "image_task_plan_S02_end",
  jobId: "job_image_S02_end",
  shotId: "S02",
  promptPlanId: "prompt_S02_end",
  providerSlot: "image.edit",
  requiredMode: "image2image",
  providerId: "openai-image2-api",
  mode: "image2image",
  status: "ready_for_dry_run",
  expectedOutputPath: imagePacket.envelope.taskEnvelope.expectedOutputs[0],
  inputReferenceIds: ["hero_locked"],
  sourcePromptPlanHash: "prompt_hash_S02_end",
  sourceShotSpecHash: "shot_hash_S02",
  taskEnvelopeSummary: {
    envelopeId: imagePacket.envelope.taskEnvelope.id,
    providerSlot: "image.edit",
    providerId: "openai-image2-api",
    requiredMode: "image2image",
    sourceIndexHash: imagePacket.envelope.taskEnvelope.sourceIndexHash,
    promptPlanId: "prompt_S02_end",
    promptPlanHash: "prompt_hash_S02_end",
    sourceShotSpecHash: "shot_hash_S02",
    expectedOutputs: imagePacket.envelope.taskEnvelope.expectedOutputs,
    preflightStatus: imagePacket.envelope.taskEnvelope.preflight.status,
    blockingReasons: imagePacket.envelope.taskEnvelope.blockingReasons,
  },
  blockers: [],
  warnings: [],
  dryRunOnly: true,
  providerSubmissionForbidden: true,
};

const providerGate = providerLiveGate.buildProviderLiveGateState({
  generatedAt,
  providerRegistry: providerRegistryFixture(),
  adapterContracts: adapterContractsFixture(),
  imageTaskPlans: [imageTaskPlan],
  image2AdapterRequests: [
    {
      requestId: "image2_request_S02_end",
      taskPlanId: imageTaskPlan.taskPlanId,
      adapterId: "image2-dry-run",
      operation: "image2image",
      payload: {
        sourceIntent: ["derive end frame from approved start frame"],
        mustPreserve: ["character identity", "scene layout"],
        mustAvoid: ["candidate prop", "provider submit"],
        references: [{ referenceId: "hero_locked", source: "prompt_plan" }],
        outputPath: imageTaskPlan.expectedOutputPath,
      },
      submitPolicy: {
        dry_run_only: true,
        manual_submit_required: true,
        live_submit_forbidden: true,
      },
      forbiddenFallbacks: ["provider_or_mode_fallback", "text_to_video_fallback"],
    },
  ],
  assetReadinessReports: [
    {
      reportId: "asset_readiness_S02_blocked",
      shotId: "S02",
      assetIds: ["hero_locked", "garage_scene_locked", "candidate_prop"],
      status: "draft_only",
      formalBlocked: true,
      blockers: [],
      warnings: ["Candidate prop is draft-only and blocks formal provider path."],
      safeReferenceIds: ["hero_locked", "garage_scene_locked"],
      unsafeReferenceIds: ["candidate_prop"],
      lockedReferenceIds: ["hero_locked", "garage_scene_locked"],
      candidateReferenceIds: ["candidate_prop"],
      missingReferenceIds: [],
      rejectedReferenceIds: [],
      tempReferenceIds: [],
      failedReferenceIds: [],
      checkedAt: generatedAt,
    },
  ],
  shots,
});
const blockedProviderItem = providerGate.items.find((item) => item.sourceId === imageTaskPlan.taskPlanId);
assert(blockedProviderItem.status === "blocked", "provider live gate must block when asset readiness/confirmation are missing");
assert(blockedProviderItem.canSubmitProvider === false, "blocked provider gate cannot submit provider");
assert(blockedProviderItem.liveSubmitAllowed === false, "blocked provider gate must keep liveSubmitAllowed=false");
assert(providerGate.summary.providerSubmitAllowed === 0, "provider gate summary must allow zero provider submits");
assert(providerGate.hardLocks.noCredentialRead === true, "provider gate must not read credentials");

const exportState = exportBuilder.buildExportBuilderState({
  generatedAt,
  shots: [shots[1]],
  shotMedia: [
    {
      shotId: "S02",
      imagePath: "outputs/keyframes/S02_start.png",
      videoPath: "outputs/videos/S02.mp4",
      durationSeconds: 4,
      manifestMatched: false,
      promotionPassed: false,
      videoQaPass: false,
      blockedReason: "blocked contact-sheet/candidate material cannot enter formal preview",
    },
  ],
  generationHealthReports: [
    {
      reportId: "health_S02_missing_manifest",
      taskPlanId: "video_task_S02",
      jobId: "job_video_S02",
      shotId: "S02",
      expectedOutputPath: "outputs/videos/S02.mp4",
      outputExists: true,
      manifestStatus: "missing_expected_output",
      qaStatus: "missing",
      stalePrompt: false,
      assetReadinessStatus: "draft_only",
      healthStatus: "qa_pending",
      blockers: ["manifest missing", "QA missing", "asset readiness draft_only"],
      warnings: [],
      nextAction: "keep formal preview blocked",
    },
  ],
  qaPromotionReports: [
    {
      reportId: "promotion_S02_blocked",
      taskPlanId: "video_task_S02",
      jobId: "job_video_S02",
      shotId: "S02",
      candidatePath: "outputs/videos/S02.mp4",
      formalPath: "outputs/formal/S02.mp4",
      promotionStatus: "blocked",
      requiredGates: {
        expectedOutput: true,
        manifestMatch: false,
        promptFresh: true,
        assetReadiness: false,
        qaPass: false,
      },
      blockers: ["manifest missing", "QA missing", "asset readiness draft_only"],
      warnings: [],
      canPromoteToFormal: false,
    },
  ],
  issues: [
    {
      id: "P0_blocked_material_S02",
      severity: "blocker",
      type: "reference_contamination",
      title: "Blocked material",
      detail: "Contact sheet/candidate material cannot enter formal preview.",
      target: "S02",
      recommendation: "Regenerate from locked references.",
    },
  ],
  defaultImageHoldSeconds: 4,
});
assert(exportState.dryRunOnly === true, "Export Builder must be dry-run only");
assert(exportState.noFileMutation === true, "Export Builder must pin noFileMutation=true");
assert(exportState.fileMutationPlan.writeFiles === false, "Export Builder must not plan writes");
assert(exportState.fileMutationPlan.createDirectories === false, "Export Builder must not create directories");
assert(exportState.formalPreview.status === "blocked", "missing QA/manifest/asset gate must block formal preview");
assert(exportState.formalPreviewGate.requiredChecks.manifestMatched === false, "missing manifest must be explicit");
assert(exportState.formalPreviewGate.requiredChecks.promotionPassed === false, "missing QA promotion must be explicit");
assert(exportState.formalPreview.events.every((event) => event.type !== "blocked_placeholder"), "formal preview cannot include blocked placeholders");
assert(!exportState.formalPreview.events.some((event) => event.shotId === "S02"), "blocked material must not enter formal preview");
assert(exportState.draftPreview.events.some((event) => event.type === "blocked_placeholder"), "blocked material can only appear as draft placeholder");

for (const state of [orchestratorState, exportState]) {
  assert(state.providerSubmissionForbidden === true, "provider submission must be forbidden end-to-end");
  assert(state.liveSubmitAllowed === false, "live submit must be false end-to-end");
  assert(state.noFileMutation === true, "no file mutation must remain true end-to-end");
}

console.log(
  `Dry-run production E2E tests passed: ${projectPatch.snapshot.factFiles.length} fact files, ${packetState.summary.ready} packets, provider=${blockedProviderItem.status}, formal=${exportState.formalPreview.status}.`,
);
