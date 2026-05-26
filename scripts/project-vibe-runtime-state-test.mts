import {
  buildProjectRuntimeStateFromProjectVibe,
  createProjectVibe,
  hashProjectVibeFacts,
  type ProjectVibeDocument,
} from "../src/project/index.ts";
import { buildRuntimeViewFromProjectState } from "../src/core/projectStateBuilder.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function createFixtureProject(): ProjectVibeDocument {
  return createProjectVibe({
    projectId: "project_vibe_runtime_state",
    title: "Project Vibe Runtime State",
    version: "0.2.0",
    createdAt: "2026-05-16T03:00:00.000Z",
    updatedAt: "2026-05-16T03:01:00.000Z",
    storyFlow: {
      id: "story_flow_fixture",
      sections: [
        { id: "section_open", title: "Opening", summary: "Open with a locked place.", sequenceIndex: 0, shotIds: ["S001"] },
        { id: "section_signal", title: "Signal", summary: "Catch the signal.", sequenceIndex: 1, shotIds: ["S002"] },
      ],
      shotOrder: ["S001", "S002"],
    },
    visualMemory: {
      id: "visual_memory_fixture",
      entries: [{
        id: "vm_char_mira",
        assetId: "char_mira",
        kind: "character",
        label: "Mira",
        status: "locked",
        textConstraints: ["blue jacket"],
        usedByShotIds: ["S001", "S002"],
        canUseAsFutureReference: true,
        sourceRefs: ["fixture"],
      }],
    },
    shots: [
      {
        id: "S001",
        sectionId: "section_open",
        title: "Open on Mira",
        intent: "Mira enters the observatory.",
        sceneAssetIds: ["scene_observatory"],
        characterAssetIds: ["char_mira"],
        propAssetIds: [],
        durationSeconds: 5,
        status: "ready",
        sourceRefs: ["fixture:shot:S001", "start-frame:outputs/S001-start.png"],
      },
      {
        id: "S002",
        sectionId: "section_signal",
        title: "Signal appears",
        intent: "A signal flickers on the brass map.",
        sceneAssetIds: ["scene_observatory"],
        characterAssetIds: ["char_mira"],
        propAssetIds: ["prop_map"],
        durationSeconds: 6,
        status: "planned",
        sourceRefs: ["fixture:shot:S002"],
      },
    ],
    assets: [
      {
        id: "char_mira",
        kind: "character",
        label: "Mira",
        status: "locked",
        path: "assets/char_mira.png",
        textConstraints: ["blue jacket"],
        usedByShotIds: ["S001", "S002"],
        sourceRefs: ["fixture:asset:char_mira", "receipt#batch_restore_001", "output_hash#sha256:runtime-state-output"],
        lockedBy: "user",
      },
      {
        id: "scene_observatory",
        kind: "scene",
        label: "Observatory",
        status: "candidate",
        path: "assets/scene_observatory.png",
        textConstraints: ["brass star map"],
        usedByShotIds: ["S001", "S002"],
        sourceRefs: ["fixture:asset:scene_observatory"],
      },
      {
        id: "prop_map",
        kind: "prop",
        label: "Brass Map",
        status: "missing",
        textConstraints: ["etched brass"],
        usedByShotIds: ["S002"],
        sourceRefs: ["fixture:asset:prop_map"],
      },
    ],
    runs: [{
      id: "run_restore_001",
      runKind: "agent_loop",
      status: "succeeded",
      createdAt: "2026-05-16T03:02:00.000Z",
      summary: "Restored a Project.vibe runtime state.",
      sourceFactHash: "fixture_source_hash",
      affectedShotIds: ["S001"],
      producedAssetIds: [],
      evidenceRefs: ["scripts/project-vibe-runtime-state-test.mts"],
      projectFactsMutated: true,
      runtimeFixtureUsed: false,
    }],
    receipts: {
      batchReceipts: [{
        id: "batch_restore_001",
        createdAt: "2026-05-16T03:03:00.000Z",
        batchId: "batch_restore",
        status: "partial",
        sourceFactHash: "fixture_source_hash",
        permissionReceiptId: "permission_restore_001",
        providerId: "lanyi-image2",
        taskEnvelopeIds: ["task_envelope_restore_001"],
        affectedShotIds: ["S001", "S002"],
        attemptIds: ["attempt_restore_001"],
        returnedOutputCount: 1,
        missingOutputCount: 1,
        outputHashes: ["sha256:runtime-state-output"],
        evidenceRefs: ["receipts/provider_observation_restore_001.json"],
        providerSelfReportCanPromote: false,
        projectFactsMutated: false,
        runtimeFixtureUsed: false,
      }],
      reviewReceipts: [{
        id: "review_restore_001",
        createdAt: "2026-05-16T03:04:00.000Z",
        status: "approved",
        reviewerId: "human_reviewer",
        humanReviewed: true,
        shotId: "S001",
        assetId: "char_mira",
        sourceReceiptId: "batch_restore_001",
        sourceRunId: "run_restore_001",
        outputPath: "assets/char_mira.png",
        outputHash: "sha256:runtime-state-output",
        retryRequested: false,
        lateOutput: false,
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        evidenceRefs: ["receipts/review_restore_001.json"],
        blockers: [],
      }],
    },
  });
}

const project = createFixtureProject();
const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectRoot: "/tmp/project-vibe-runtime-state",
  projectPath: "project/project.vibe",
  generatedAt: "2026-05-16T03:05:00.000Z",
});
const view = buildRuntimeViewFromProjectState(runtimeState, { selectedShotId: "S001" });

assert(runtimeState.project.title === "Project Vibe Runtime State", "runtime project title should come from Project.vibe");
assert(runtimeState.project.root === "/tmp/project-vibe-runtime-state", "runtime project root should use opened root");
assert(runtimeState.project.sourceTask === "project/project.vibe", "runtime source task should use opened Project.vibe path");
assert(runtimeState.project.state === "project_vibe_restored", "runtime state should mark Project.vibe restoration");
assert(runtimeState.sourceIndex.projectId === "project_vibe_runtime_state", "sourceIndex projectId should come from Project.vibe manifest");
assert(runtimeState.sourceIndex.confirmedDecisionIds.includes("run_restore_001"), "sourceIndex should retain Project.vibe run receipts as decisions");
assert(runtimeState.sourceIndex.confirmedDecisionIds.includes("batch_restore_001"), "sourceIndex should project durable batch receipts as derived decisions");
assert(runtimeState.sourceIndex.confirmedDecisionIds.includes("review_restore_001"), "sourceIndex should project durable review receipts as derived decisions");
assert(runtimeState.project.metrics.providerEvents === 1, "runtime metrics should derive provider events from batch receipts");
assert(runtimeState.storyFlow.shots.length === 2, "runtime story flow should contain Project.vibe shots");
assert(runtimeState.storyFlow.shots[0].id === "S001", "runtime shot order should follow Project.vibe");
assert(runtimeState.storyFlow.shots[0].startFrame === "outputs/S001-start.png", "runtime shot should use returned Project.vibe start-frame sourceRef before planned placeholders");
assert(runtimeState.storyFlow.shots[0].status === "assets_ready", "ready Project.vibe shot should map to assets_ready");
assert(runtimeState.storyFlow.shots[1].status === "queued", "planned Project.vibe shot should map to queued");
assert(runtimeState.storyFlow.sections[0]?.label === "Opening", "runtime state should preserve Project.vibe section titles for creator-facing UI");
assert(runtimeState.visualMemory.assets.length === 3, "runtime visual memory should contain Project.vibe assets");
assert(runtimeState.visualMemory.assets.find((asset) => asset.id === "char_mira")?.lockedStatus === "locked", "locked Project.vibe asset should stay locked");
assert(runtimeState.visualMemory.assets.find((asset) => asset.id === "char_mira")?.sourceReceiptId === "batch_restore_001", "Project.vibe asset projection should preserve receipt evidence from source refs");
assert(runtimeState.visualMemory.assets.find((asset) => asset.id === "char_mira")?.outputHash === "sha256:runtime-state-output", "Project.vibe asset projection should preserve output hash evidence from source refs");
assert(runtimeState.visualMemory.assets.find((asset) => asset.id === "char_mira")?.usedByShotIds?.join(",") === "S001,S002", "Project.vibe asset projection should preserve shot usage");
assert(runtimeState.visualMemory.assets.find((asset) => asset.id === "prop_map")?.status === "missing", "missing Project.vibe asset should stay missing");
assert(view.storySections.length === 2, "runtime view should expose Project.vibe sections");
assert(view.storySections[0].label === "Opening", "runtime view should expose restored Project.vibe section labels");
assert(view.storySections[0].shotIds.join(",") === "S001", "first runtime section should bind S001");
assert(hashProjectVibeFacts(project).startsWith("pv_"), "fixture Project.vibe should stay hashable");

console.log(
  `project-vibe-runtime-state-test: project=${runtimeState.sourceIndex.projectId}, shots=${runtimeState.storyFlow.shots.length}, assets=${runtimeState.visualMemory.assets.length}, sections=${view.storySections.length}.`,
);
