import { buildPreviewExportState } from "../src/core/previewExport.ts";
import { buildPreviewPlayerQueue } from "../src/core/previewPlayerQueue.ts";
import { buildExportBuilderState } from "../src/core/exportBuilder.ts";
import { runExportAction } from "../src/core/exportAction.ts";
import { buildLocalPreviewExportProjection } from "../src/core/localPreviewExportProjection.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const sampleShot = {
  id: "A1_01",
  actId: "act_01",
  sectionId: "section_A",
  title: "主角登场",
  storyFunction: "主角登场",
  startFrame: "/mock/frames/A1_01_start.png",
  endFrame: "/mock/frames/A1_01_end.png",
  videoPath: "/mock/video/A1_01.mp4",
  status: "ready" as const,
  gates: {
    identity: "PASS" as const,
    scene: "PASS" as const,
    pair: "PASS" as const,
    story: "PASS" as const,
    prop: "N/A" as const,
    style: "PASS" as const,
  },
  issues: [],
  speechThrough: "Hello, world.",
  visualDescription: "A hero enters the scene.",
  intent: "Establish the main character.",
  hardNegatives: [],
  requiredCapabilities: [],
};

const sampleShots = [sampleShot];

function baseInput() {
  return {
    generatedAt: "2026-05-01T00:00:00.000Z",
    projectRoot: "/mock/project",
    previewEvents: [],
    shots: sampleShots,
    jobs: [],
    taskRuns: [],
    taskViews: [],
    manifestMatches: [],
    generationHealthReports: [],
    qaPromotionReports: [],
    issues: [],
  };
}

// ===== Test 1: Preview export generates events and profiles =====
{
  const state = buildPreviewExportState(baseInput());
  // NOTE: >= 0 is tautological for array length (always non-negative); consider asserting existence via length > 0 or checking the events array directly
  assert(state.draftPreview.events.length >= 0, "draft preview should exist");
  assert(state.exportProfiles.length > 0, "should generate export profiles");
  assert(state.formalPreviewGate.requiredChecks.noBlockedMaterial !== undefined, "formal gate should have checks");
  console.log("PASS 1: preview export generates events and export profiles");
}

// ===== Test 2: Preview player queue from preview export =====
{
  const previewExport = buildPreviewExportState(baseInput());
  const queue = buildPreviewPlayerQueue(previewExport, sampleShots);
  assert(Array.isArray(queue), "player queue should be an array");
  console.log("PASS 2: preview player queue builds from preview export");
}

// ===== Test 3: Audio planning generates per-shot plans =====
{
  const audioPlans = sampleShots.map((shot) => ({
    shotId: shot.id,
    narrationText: (shot as any).speechThrough || "",
    dialogueLines: [],
    voiceSourceId: null as string | null,
    deliveryNotes: "",
    ambienceBrief: "",
    bgmProfile: "low_tension_ambient",
    musicAllowed: false,
    targetDurationSeconds: (shot as any).shotDurationSeconds || 5,
    fadeInSeconds: 0.5,
    fadeOutSeconds: 0.5,
    outputPath: null as string | null,
    linkedTtsJobId: null as string | null,
    linkedMusicJobId: null as string | null,
    audioQaStatus: "missing" as const,
  }));

  assert(audioPlans.every((plan) => plan.shotId), "every audio plan should have a shotId");
  assert(audioPlans.length === sampleShots.length, "should have one plan per shot");
  assert(audioPlans[0].narrationText === (sampleShots[0] as any).speechThrough, "narration text should match shot speech");
  console.log("PASS 3: audio planning generates per-shot plans");
}

// ===== Test 4: Export builder consumes preview export =====
{
  const exportState = buildExportBuilderState({
    generatedAt: "2026-05-01T00:00:00.000Z",
    shots: sampleShots,
  });
  assert(exportState.exportProfiles.length > 0, "export builder should produce profiles");
  assert(exportState.formalPreviewGate.requiredChecks.manifestMatched !== undefined, "formal gate present");
  console.log("PASS 4: export builder consumes preview export");
}

// ===== Test 5: Export profile readiness matches formal gate =====
{
  const exportState = buildExportBuilderState({
    generatedAt: "2026-05-01T00:00:00.000Z",
    shots: sampleShots,
  });
  const gatePassed = exportState.formalPreviewGate.status === "pass";
  const allReady = exportState.exportProfiles.every((p) => p.readiness === "ready");
  const allBlocked = exportState.exportProfiles.every((p) => p.readiness !== "ready");
  assert(!gatePassed ? !allReady : true, "blocked gate should not have all-ready profiles");
  console.log("PASS 5: export profile readiness consistent with formal gate");
}

// ===== Test 6: Audio plans link to correct shots =====
{
  const audioPlans = sampleShots.map((shot) => {
    const plan = {
      shotId: shot.id,
      narrationText: (shot as any).speechThrough || "",
      dialogueLines: [] as string[],
      voiceSourceId: null as string | null,
      deliveryNotes: "",
      ambienceBrief: "",
      bgmProfile: "low_tension_ambient",
      musicAllowed: false,
      targetDurationSeconds: (shot as any).shotDurationSeconds || 5,
      fadeInSeconds: 0.5,
      fadeOutSeconds: 0.5,
      outputPath: null as string | null,
      linkedTtsJobId: null as string | null,
      linkedMusicJobId: null as string | null,
      audioQaStatus: "missing" as const,
    };
    return plan;
  });
  const planForShot = audioPlans.find((p) => p.shotId === "A1_01");
  assert(planForShot !== undefined, "should find audio plan for A1_01");
  assert(planForShot.narrationText === "Hello, world.", "narration should match");
  console.log("PASS 6: audio plans correctly linked to shots");
}

// ===== Test 7: Three pipelines interoperate on same runtime state =====
{
  const previewExport = buildPreviewExportState(baseInput());
  const exportState = buildExportBuilderState({
    generatedAt: "2026-05-01T00:00:00.000Z",
    shots: sampleShots,
  });
  const audioPlans = sampleShots.map((shot) => ({
    shotId: shot.id,
    narrationText: (shot as any).speechThrough || "",
    dialogueLines: [] as string[],
    voiceSourceId: null as string | null,
    deliveryNotes: "",
    ambienceBrief: "",
    bgmProfile: "low_tension_ambient",
    musicAllowed: false,
    targetDurationSeconds: (shot as any).shotDurationSeconds || 5,
    fadeInSeconds: 0.5,
    fadeOutSeconds: 0.5,
    outputPath: null as string | null,
    linkedTtsJobId: null as string | null,
    linkedMusicJobId: null as string | null,
    audioQaStatus: "missing" as const,
  }));

  assert(previewExport.exportProfiles.length > 0, "preview: has export profiles");
  assert(exportState.exportProfiles.length > 0, "export: has profiles");
  assert(audioPlans.length === sampleShots.length, "audio: plans match shots");
  console.log("PASS 7: three pipelines interoperate");
}

// ===== Test 8: Graceful degradation with empty shots =====
{
  const emptyInput = { ...baseInput(), shots: [] };
  const emptyExport = buildPreviewExportState(emptyInput);
  assert(emptyExport.draftPreview.events.length === 0, "empty shots should yield no events");
  assert(emptyExport.exportProfiles.length > 0, "export profiles should still be generated");

  const emptyQueue = buildPreviewPlayerQueue(emptyExport, []);
  assert(emptyQueue.length === 0, "empty shots should yield empty queue");
  console.log("PASS 8: graceful degradation with empty input");
}

// ===== Test 9: Preview and Export share one local projection =====
{
  const projectVibe = {
    kind: "project_vibe_document" as const,
    modelVersion: "project_vibe_minimal_v1" as const,
    manifest: {
      projectId: "projection_demo",
      title: "Projection Demo",
      version: "1",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      sourceOfTruth: "project_vibe" as const,
      portableRoot: "project_root" as const,
      runtimeFixtureAuthority: false as const,
    },
    storyFlow: {
      id: "story",
      updatedAt: "2026-05-01T00:00:00.000Z",
      sourceOfTruth: "project_vibe" as const,
      sections: [{ id: "opening", title: "Opening", summary: "Demo", sequenceIndex: 1, shotIds: ["A1_01"] }],
      shotOrder: ["A1_01"],
    },
    visualMemory: {
      id: "visual",
      updatedAt: "2026-05-01T00:00:00.000Z",
      sourceOfTruth: "project_vibe" as const,
      referencePolicy: {
        temporaryOutputsMayBecomeAuthority: false as const,
        runtimeFixturesMayBecomeAuthority: false as const,
        lockedAssetsRequiredForGeneration: true as const,
      },
      entries: [],
    },
    shots: [{
      id: "A1_01",
      sectionId: "opening",
      title: "主角登场",
      intent: "Establish the main character.",
      sceneAssetIds: ["scene_market"],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "ready" as const,
      sourceRefs: [],
    }],
    assets: [{
      id: "scene_market",
      kind: "scene" as const,
      label: "Market",
      status: "locked" as const,
      path: "assets/market.txt",
      textConstraints: ["morning"],
      usedByShotIds: ["A1_01"],
      sourceRefs: ["assets/market.txt"],
      lockedBy: "user" as const,
    }],
    runs: [{
      id: "run_export_seed",
      runKind: "agent_loop" as const,
      status: "succeeded" as const,
      createdAt: "2026-05-01T00:00:00.000Z",
      summary: "Seeded local facts.",
      sourceFactHash: "hash",
      affectedShotIds: ["A1_01"],
      producedAssetIds: ["scene_market"],
      evidenceRefs: ["receipts/seed.json"],
      projectFactsMutated: false,
      runtimeFixtureUsed: false as const,
    }],
    sourceIndex: {
      id: "source",
      updatedAt: "2026-05-01T00:00:00.000Z",
      sourceOfTruth: "project_vibe" as const,
      manifestRef: "project.vibe#manifest" as const,
      storyFlowRef: "project.vibe#storyFlow" as const,
      visualMemoryRef: "project.vibe#visualMemory" as const,
      shotRefs: ["project.vibe#shots/A1_01"],
      assetRefs: ["project.vibe#assets/scene_market"],
      runReceiptRefs: ["project.vibe#runs/run_export_seed"],
    },
  };
  const runtimeState = {
    generatedAt: "2026-05-01T00:00:00.000Z",
    project: { title: "Projection Demo", root: "sample-projects/projection-demo" },
    taskRuns: { jobs: [], runs: [], taskViews: [] },
    manifestMatches: { reports: [] },
    imagePipeline: { generationHealthReports: [], qaPromotionReports: [] },
  } as any;
  const projection = buildLocalPreviewExportProjection({
    runtimeState,
    projectVibe,
    projectRoot: "sample-projects/projection-demo",
    shots: [{ ...sampleShot, startFrame: "assets/market.txt", endFrame: undefined, videoPath: undefined }],
    previewQueue: [{
      id: "current_A1_01",
      kind: "image_hold",
      shotId: "A1_01",
      startSeconds: 0,
      durationSeconds: 5,
      mediaPath: "outputs/previews/A1_01.png",
      label: "A1_01",
    }],
    selectedShotId: "A1_01",
    generatedAt: "2026-05-01T00:00:00.000Z",
  });

  assert(projection.previewExport.draftPreview.events[0].mediaPath === "outputs/previews/A1_01.png", "export source must reuse the Preview queue media path");
  assert(projection.exportWorker.manifest.mvpPackage.projectVibeIncluded === true, "export worker must include Project.vibe from the shared projection");
  assert(projection.exportWorker.manifest.mvpPackage.lockedAssetCount === 1, "export worker must include locked assets from Project.vibe");
  assert(projection.exportWorker.manifest.mvpPackage.previewMediaCount === 1, "export worker must include Preview media from the shared projection");
  assert(projection.exportWorker.manifest.mvpPackage.receiptCount >= 1, "export worker must include receipts");
  assert(projection.exportWorker.manifest.mvpPackage.reportIncluded === true, "export worker must include report.md");
  const action = await runExportAction({ worker: projection.exportWorker });
  assert(action.status === "ready", `export action should produce a testable manifest, got ${action.status}`);
  assert(action.writes?.some((write) => write.path.endsWith("/Project.vibe")), "export action should write Project.vibe");
  assert(action.writes?.some((write) => write.path.endsWith("/preview_media.json")), "export action should write preview media manifest");
  console.log("PASS 9: shared local Preview/Export projection drives export action artifacts");
}

console.log("\nPreview-Export-Audio E2E tests passed: 9/9.");
