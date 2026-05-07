import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assert,
  compact,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mjs";

const generatedAt = "2026-05-08T09:00:00.000Z";
const projectId = "software_layer_demo_fixture";
const runId = "software_layer_demo_image2_batch_001";
const runRoot = `${smallProjectFixture.projectRoot}/real-test-sandbox/${runId}`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentLoadCoreDirs() {
  return fs
    .readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vibe-small-project-"))
    .map((entry) => path.join(os.tmpdir(), entry.name));
}

async function loadSoftwareLayerDemoCore() {
  const before = new Set(currentLoadCoreDirs());
  await loadCore();
  const created = currentLoadCoreDirs()
    .filter((dir) => !before.has(dir))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  const coreDir = created[0] || currentLoadCoreDirs().sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
  assert(coreDir, "loadCore did not create a transpiled core directory");

  return {
    assetLibrary: await import(pathToFileURL(path.join(coreDir, "assetLibraryCrud.mjs")).href),
    currentProjectImage2Batch: await import(pathToFileURL(path.join(coreDir, "currentProjectImage2Batch.mjs")).href),
    directorWorkflow: await import(pathToFileURL(path.join(coreDir, "directorWorkflow.mjs")).href),
    projectTransaction: await import(pathToFileURL(path.join(coreDir, "projectTransaction.mjs")).href),
    minimalRuntimeProjection: await import(pathToFileURL(path.join(coreDir, "minimalRuntimeProjection.mjs")).href),
  };
}

function addAsset(addAssetLibraryAsset, library, input) {
  const result = addAssetLibraryAsset(library, {
    textConstraints: ["fixture-only locked visual consistency reference"],
    updatedAt: generatedAt,
    ...input,
  });
  assert(result.validation.ok, `asset should validate: ${result.validation.errors.join("; ")}`);
  return result.library;
}

function buildLockedAssetLibrary(assetLibraryCore) {
  const { addAssetLibraryAsset, createAssetLibrarySnapshot } = assetLibraryCore;
  let library = createAssetLibrarySnapshot({ id: "software_layer_demo_asset_library", createdAt: generatedAt });

  library = addAsset(addAssetLibraryAsset, library, {
    id: "demo_character_locked",
    assetType: "character",
    name: "Demo Character Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: smallProjectFixture.characterPath,
  });
  library = addAsset(addAssetLibraryAsset, library, {
    id: "demo_scene_locked",
    assetType: "scene",
    name: "Demo Scene Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: smallProjectFixture.scenePath,
  });
  library = addAsset(addAssetLibraryAsset, library, {
    id: "demo_style_locked",
    assetType: "style",
    name: "Demo Style Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: smallProjectFixture.stylePath,
  });

  for (const blocked of [
    ["demo_candidate_character", "character", "candidate", "source_asset", `${smallProjectFixture.projectRoot}/assets/characters/candidate/main.png`],
    ["demo_rejected_style", "style", "rejected", "source_asset", `${smallProjectFixture.projectRoot}/assets/styles/rejected/style.png`],
    ["demo_temp_character", "character", "locked", "provider_temp_output", "outputs/temp/demo-character.png"],
    ["demo_contact_sheet", "style", "locked", "contact_sheet", "reports/contact_sheets/demo-style.png"],
  ]) {
    const [id, assetType, status, sourceKind, assetPath] = blocked;
    const result = addAssetLibraryAsset(library, {
      id,
      assetType,
      name: id,
      status,
      sourceKind,
      path: assetPath,
      textConstraints: ["not allowed to become a positive future reference"],
      updatedAt: generatedAt,
    });
    library = result.library;
    if (sourceKind === "provider_temp_output" || sourceKind === "contact_sheet") {
      assert(result.rejected, `${sourceKind} must be rejected before positive refs`);
    } else {
      assert(result.validation.ok, `${id} should be retained only as non-positive review evidence`);
    }
  }

  return library;
}

function assertSubmitLocks(policy, label) {
  assert(policy.providerCallAllowed === false, `${label}.providerCallAllowed must be false`);
  assert(policy.dryRunOnly === true, `${label}.dryRunOnly must be true`);
  assert(policy.manualSubmitRequired === true, `${label}.manualSubmitRequired must be true`);
  assert(policy.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must be false`);
}

function assertRuntimeLocks(summary, label) {
  assert(summary.providerCalled === false, `${label}.providerCalled must be false`);
  assert(summary.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must be false`);
  assert(summary.noFileMutation === true, `${label}.noFileMutation must be true`);
  assert(summary.workerSpawnForbidden === true, `${label}.workerSpawnForbidden must be true`);
}

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

function runtimeAsset(id, type, overrides = {}) {
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

function buildTransactionRuntimeState() {
  return {
    schemaVersion: "0.1.0",
    coreStateVersion: "project-runtime-state/0.1.0",
    generatedAt,
    project: {
      title: "Software Layer Demo Fixture",
      providerPolicy: { rules: [] },
    },
    sourceIndex: {
      sourceIndexHash: "source_hash_software_layer_demo",
    },
    sourceIndexSummary: {
      projectId,
      projectVersion: "0.4.0",
      sourceIndexHash: "source_hash_software_layer_demo",
    },
    storyFlow: {
      shots: [shot("A1_01"), shot("A1_02"), shot("A1_03")],
    },
    visualMemory: {
      assets: [
        runtimeAsset("demo_character_locked", "character", { usedByShotIds: ["A1_02"] }),
        runtimeAsset("demo_scene_locked", "scene", { usedByShotIds: ["A1_02"] }),
        runtimeAsset("demo_style_locked", "style"),
      ],
    },
    videoPlanning: {
      readinessGates: [
        {
          gateId: "video_gate_A1_02",
          shotId: "A1_02",
          keyframePairDerivation: {
            shotId: "A1_02",
            startFrameId: "outputs/keyframes/A1_02_start.png",
            endFrameId: "outputs/keyframes/A1_02_end.png",
            endDerivationSource: "start_frame",
            validForI2vPair: true,
            allowedDelta: ["motion", "camera movement"],
            mustPreserve: ["character identity", "scene layout"],
            mustNotAdd: ["new characters", "text-to-video fallback"],
          },
        },
      ],
      taskPlans: [
        {
          taskPlanId: "video_task_A1_02",
          shotId: "A1_02",
          manifestFacts: {
            expectedOutputs: ["outputs/videos/A1_02.mp4"],
          },
        },
      ],
    },
    imagePipeline: {},
    previewEvents: [],
    taskRuns: { jobs: [], runs: [] },
    diagnostics: { issues: [] },
  };
}

function hydrateKnowledge(workflowState) {
  const next = clone(workflowState);
  for (const packet of next.taskPacketState.packets) {
    if (!packet.envelope?.taskEnvelope) continue;
    const record = {
      packId: `pack_${packet.taskKind}`,
      version: "0.1.0",
      hash: `hash_${packet.taskKind}`,
      category: packet.taskKind === "audio" ? "audio" : packet.taskKind === "video_execution" ? "camera" : "storyflow",
      reason: `software-layer fixture route for ${packet.taskKind}`,
      consumer: "subagent_context",
      injectedSnippetIds: [`snippet_${packet.taskKind}`],
      summaryHash: `summary_${packet.taskKind}`,
      truncated: false,
    };
    const snippet = {
      packId: record.packId,
      snippetId: `snippet_${packet.taskKind}`,
      title: `Snippet ${packet.taskKind}`,
      content: `Bounded knowledge snippet for ${packet.taskKind}.`,
      tokenEstimate: 12,
      hash: `snippet_hash_${packet.taskKind}`,
    };
    packet.envelope.taskEnvelope.knowledgeRouteResultId = `route_${packet.taskKind}`;
    packet.envelope.taskEnvelope.contextBudgetId = `budget_${packet.taskKind}`;
    packet.envelope.taskEnvelope.injectedKnowledgePacks = [record];
    packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds = [`${record.packId}:${snippet.snippetId}`];
    packet.envelope.taskEnvelope.injectedKnowledgeSnippets = [snippet];
    packet.envelope.taskEnvelope.knowledgeInputHash = `knowledge_input_${packet.taskKind}`;
    packet.envelope.taskEnvelope.knowledgeManifestHash = "knowledge_manifest_software_layer_fixture";
    packet.envelope.knowledgeRouteResultId = packet.envelope.taskEnvelope.knowledgeRouteResultId;
    packet.envelope.contextBudgetId = packet.envelope.taskEnvelope.contextBudgetId;
    packet.envelope.injectedKnowledgePacks = [record];
    packet.envelope.injectedKnowledgeSnippetIds = packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds;
    packet.envelope.injectedKnowledgeSnippets = [snippet];
    packet.envelope.knowledgeInputHash = packet.envelope.taskEnvelope.knowledgeInputHash;
    packet.envelope.knowledgeManifestHash = packet.envelope.taskEnvelope.knowledgeManifestHash;
    packet.injectedKnowledgeTrace = {
      status: "present",
      knowledgeRouteResultId: packet.envelope.taskEnvelope.knowledgeRouteResultId,
      contextBudgetId: packet.envelope.taskEnvelope.contextBudgetId,
      knowledgeInputHash: packet.envelope.taskEnvelope.knowledgeInputHash,
      knowledgeManifestHash: packet.envelope.taskEnvelope.knowledgeManifestHash,
      packIds: [record.packId],
      snippetIds: packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds,
      snippetCount: 1,
      qaPackBindingIds: [],
      warnings: [],
    };
    packet.envelope.injectedKnowledgeTrace = packet.injectedKnowledgeTrace;
  }
  return next;
}

function readyEnvelopeWorkflow(workflowState) {
  const next = clone(workflowState);
  next.taskPacketState.packets = next.taskPacketState.packets.filter((packet) => packet.envelope);
  next.taskPacketState.summary.total = next.taskPacketState.packets.length;
  next.taskPacketState.summary.ready = next.taskPacketState.packets.length;
  next.taskPacketState.summary.blockedMissingContext = 0;
  next.taskPacketState.summary.envelopeReady = next.taskPacketState.packets.length;
  return next;
}

const {
  assetLibrary: assetLibraryCore,
  currentProjectImage2Batch,
  directorWorkflow,
  projectTransaction,
  minimalRuntimeProjection,
} = await loadSoftwareLayerDemoCore();

const assetLibrary = buildLockedAssetLibrary(assetLibraryCore);
assert(assetLibrary.hardLocks.inMemoryOnly === true, "asset library must be in-memory only");
assert(assetLibrary.hardLocks.noFileMutation === true, "asset library must forbid file mutation");
assert(assetLibrary.hardLocks.noProviderSubmit === true, "asset library must forbid provider submit");

const image2References = currentProjectImage2Batch.buildCurrentProjectImage2ReferencesFromAssetLibrary(assetLibrary);
assert(image2References.blockers.length === 0, `locked library must produce references: ${compact(image2References.blockers)}`);
assert(image2References.summary.eligibleCount === 3, "only locked character/scene/style should enter positive refs");
assert(image2References.summary.warningCount >= 4, "candidate/rejected/temp/contact sheet entries should be reported outside positive refs");
assert(image2References.summary.byRole.character === 1, "candidate/temp character must not add extra character refs");
assert(image2References.summary.byRole.scene === 1, "scene refs should include only locked scene");
assert(image2References.summary.byRole.style === 1, "rejected/contact sheet style must not add extra style refs");
assert(
  !JSON.stringify(image2References.references).includes("candidate/main.png"),
  "candidate references must be excluded from positive refs",
);
assert(
  image2References.warnings.some((warning) => warning.includes("status_rejected_not_locked")),
  "rejected references must be reported but excluded",
);
assert(
  image2References.warnings.some((warning) => warning === "asset_library_blocked_import_provider_temp_output_not_future_reference"),
  "temp outputs must be blocked from future refs",
);
assert(
  image2References.warnings.some((warning) => warning === "asset_library_blocked_import_contact_sheet_not_future_reference"),
  "contact sheets must be blocked from future refs",
);

const readyPlan = currentProjectImage2Batch.buildCurrentProjectImage2BatchPlan({
  projectId,
  runId,
  projectRoot: smallProjectFixture.projectRoot,
  runRoot,
  generatedAt,
  assetLibrary,
  selectedShotIds: ["S01", "S02"],
});
assert(readyPlan.status === "ready_for_review", `Image2 batch plan must be ready: ${compact(readyPlan.blockers)}`);
assert(readyPlan.items.length === 2, "ready fixture should plan two Image2 items");
assertSubmitLocks(readyPlan.submitPolicy, "readyPlan.submitPolicy");
assert(readyPlan.items.every((item) => item.referencePaths.length === 3), "each Image2 item must receive character/scene/style refs");

const readyLedgers = currentProjectImage2Batch.projectCurrentProjectImage2BatchLedgers(readyPlan);
const readyRuntimeProjection = currentProjectImage2Batch.projectCurrentProjectImage2BatchRuntimeProjection(readyPlan);
assert(readyLedgers.summary.queued === 2, "ready ledgers must project queued work");
assert(readyRuntimeProjection.summary.queued === 2, "ready runtime must expose queued work");
assert(readyRuntimeProjection.items.every((item) => item.previewStatus === "missing"), "queued items should remain preview-missing until outputs return");
assertRuntimeLocks(readyLedgers.summary, "readyLedgers.summary");
assertRuntimeLocks(readyRuntimeProjection.summary, "readyRuntimeProjection.summary");

const parkedPlan = currentProjectImage2Batch.buildCurrentProjectImage2BatchPlan({
  projectId,
  runId: `${runId}_parked`,
  projectRoot: smallProjectFixture.projectRoot,
  runRoot: `${smallProjectFixture.projectRoot}/real-test-sandbox/${runId}_parked`,
  generatedAt,
  references: {
    character: image2References.references.character,
    scene: image2References.references.scene,
    style: [{ path: smallProjectFixture.stylePath, lockedStatus: "candidate", safeForFutureReference: false }],
  },
  selectedShotIds: ["S03"],
});
assert(parkedPlan.status === "blocked", "parked fixture plan should block before provider submit");
const parkedRuntimeProjection = currentProjectImage2Batch.projectCurrentProjectImage2BatchRuntimeProjection(parkedPlan);
assert(parkedRuntimeProjection.summary.parked === 1, "blocked Image2 item must project parked");
assert(parkedRuntimeProjection.items[0].previewStatus === "parked", "parked Image2 item must project parked preview");
assertRuntimeLocks(parkedRuntimeProjection.summary, "parkedRuntimeProjection.summary");

const transactionRuntimeState = buildTransactionRuntimeState();
const workflowState = directorWorkflow.buildDirectorWorkflowState({
  runtimeState: transactionRuntimeState,
  userIntent: "把当前镜头的服装做旧一点，场景更冷，整体风格更压抑，但保持身份、镜头顺序和资产来源可追踪",
  selection: { selectedShotId: "A1_02" },
  generatedAt,
});
assert(workflowState.transactionRuntime.projectVibeWritePlan.mode === "pending_only", "workflow must create a pending-only transaction plan");
assert(workflowState.hardLocks.providerSubmissionForbidden === true, "workflow must forbid provider submission");
assert(workflowState.hardLocks.noFileMutation === true, "workflow must forbid file mutation");

const hydratedWorkflow = hydrateKnowledge(readyEnvelopeWorkflow(workflowState));
const transactionRuntime = projectTransaction.buildProjectTransactionRuntime({
  workflowState: hydratedWorkflow,
  runtimeState: transactionRuntimeState,
  userConfirmed: true,
  userEnabled: true,
});
assert(transactionRuntime.pendingTransaction, "natural-language edit must produce a pending transaction");
assert(transactionRuntime.userStatus === "queued", `confirmed hydrated edit should queue software-layer work, got ${transactionRuntime.userStatus}`);
assert(transactionRuntime.queueIngestSummary.queued > 0, "pending transaction must enqueue active fixture work");
assert(transactionRuntime.queueIngestSummary.parked > 0, "provider-planned work must remain parked for review");
assert(transactionRuntime.projectVibeWritePlan.noFileMutation === true, "transaction runtime must not mutate files");
assert(transactionRuntime.projectVibeWritePlan.projectVibeWriteAllowed === false, "transaction runtime must not write project.vibe");

const confirmationReceipt = projectTransaction.confirmProjectPendingTransactionForRuntime(transactionRuntime);
assert(confirmationReceipt.status === "confirmed", "confirmed runtime must produce a confirmation receipt");
assert(confirmationReceipt.projectVibeWriteAllowed === false, "confirmation receipt must not allow project.vibe writes");
assert(confirmationReceipt.projectVibeWriteExecuted === false, "confirmation receipt must not execute project.vibe writes");
assert(confirmationReceipt.noFileMutation === true, "confirmation receipt must be mutation-free");
assert(confirmationReceipt.providerSubmissionForbidden === true, "confirmation receipt must forbid provider submission");
assert(confirmationReceipt.workerSpawnForbidden === true, "confirmation receipt must forbid worker spawn");
assert(confirmationReceipt.queuedCount === transactionRuntime.queueIngestSummary.queued, "receipt queued count must be derived from pending transaction");
assert(confirmationReceipt.parkedCount === transactionRuntime.queueIngestSummary.parked, "receipt parked count must be derived from pending transaction");

const creatorProjection = minimalRuntimeProjection.buildMinimalRuntimeProjection({
  generatedAt,
  transactionRuntime,
  assetLibrary,
  previewQueue: [
    {
      id: "preview_S01",
      kind: "image_hold",
      startSeconds: 0,
      durationSeconds: 3,
      label: "S01",
      mediaPath: "preview/S01.png",
    },
    {
      id: "preview_S02_missing",
      kind: "missing_placeholder",
      startSeconds: 3,
      durationSeconds: 3,
      label: "S02",
    },
  ],
  ledgerProjections: [...readyLedgers.projections, ...parkedRuntimeProjection.items],
});
assert(creatorProjection.shortLabel === "已加入计划", "creator projection should say planned work was added");
assert(creatorProjection.countSummary.includes("已加入计划"), "creator projection must expose added-to-plan count");
assert(creatorProjection.countSummary.includes("等待复核"), "creator projection must expose waiting-review work");
assert(creatorProjection.previewSummary.detail.includes("待补齐"), "creator projection must expose missing preview media");
assert(creatorProjection.progressDots.some((dot) => dot.id === "review" && dot.tone === "review"), "review dot should reflect parked/review work");

const serialized = JSON.stringify({
  assetLibrary,
  readyPlan,
  readyRuntimeProjection,
  parkedRuntimeProjection,
  transactionRuntime,
  confirmationReceipt,
  creatorProjection,
});
for (const forbidden of ["submitId", "providerTaskId", "apiKey", "credential", process.cwd()]) {
  assert(!serialized.includes(forbidden), `software-layer demo must not leak ${forbidden}`);
}

console.log(
  [
    "Software-layer demo passed.",
    `assetRefs=${image2References.summary.eligibleCount}`,
    `image2Queued=${readyRuntimeProjection.summary.queued}`,
    `image2Parked=${parkedRuntimeProjection.summary.parked}`,
    `previewMissing=${readyRuntimeProjection.items.filter((item) => item.previewStatus === "missing").length}`,
    `txQueued=${confirmationReceipt.queuedCount}`,
    `txParked=${confirmationReceipt.parkedCount}`,
    `creator="${creatorProjection.shortLabel} / ${creatorProjection.countSummary} / ${creatorProjection.previewSummary.detail}"`,
  ].join(" "),
);
