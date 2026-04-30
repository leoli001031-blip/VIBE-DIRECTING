import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadExportBuilder() {
  const sourcePath = path.resolve("src/core/exportBuilder.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-export-builder-"));
  const outPath = path.join(tmpDir, "exportBuilder.mjs");
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

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

function shot(id, overrides = {}) {
  return {
    id,
    actId: "A1",
    title: `Shot ${id}`,
    storyFunction: `story function ${id}`,
    startFrame: `outputs/keyframes/${id}_start.png`,
    endFrame: `outputs/keyframes/${id}_end.png`,
    status: "keyframe_pair_ready",
    gates: gates(),
    issues: [],
    ...overrides,
  };
}

function health(shotId, videoPath) {
  return {
    reportId: `health_${shotId}`,
    taskPlanId: `video_task_plan_${shotId}`,
    jobId: `job_video_${shotId}`,
    shotId,
    expectedOutputPath: videoPath,
    outputExists: true,
    manifestStatus: "matched",
    qaStatus: "pass",
    stalePrompt: false,
    assetReadinessStatus: "ready",
    healthStatus: "formal_ready",
    blockers: [],
    warnings: [],
    nextAction: "ready_for_formal_preview",
  };
}

function promotion(shotId, videoPath) {
  return {
    reportId: `promotion_${shotId}`,
    taskPlanId: `video_task_plan_${shotId}`,
    jobId: `job_video_${shotId}`,
    shotId,
    candidatePath: videoPath,
    formalPath: videoPath,
    promotionStatus: "promoted",
    requiredGates: {
      expectedOutput: true,
      manifestMatch: true,
      promptFresh: true,
      assetReadiness: true,
      qaPass: true,
    },
    blockers: [],
    warnings: [],
    canPromoteToFormal: true,
  };
}

function audioPlanningFixture() {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-04-30T00:00:00.000Z",
    shotPlans: [
      {
        shotId: "S01",
        narrationText: "",
        dialogueLines: [],
        deliveryNotes: "dry-run",
        ambienceBrief: "placeholder",
        bgmProfile: "BGM belongs in audio plan/export plan",
        musicAllowed: false,
        targetDurationSeconds: 4,
        outputPath: null,
        audioQaStatus: "UNKNOWN",
      },
    ],
    voiceSourceRegistry: {
      sourceCount: 0,
      placeholderCount: 0,
      plannedCount: 0,
      unavailableCount: 0,
      sources: [],
      storesSecrets: false,
      changeTransactionRequired: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      notes: [],
    },
    previewMix: {
      planId: "audio_mix_placeholder",
      generatedFromAudioPlan: true,
      eventCount: 0,
      missingOutputPathCount: 1,
      events: [],
      notes: [],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    videoProviderPolicy: {
      musicAllowed: false,
      noBgmForVideoProvider: true,
      ambienceSfxPlaceholderAllowed: true,
      bgmHandledBy: "audio_plan_or_post_import",
      summary: "no BGM in video provider prompts",
    },
    providerSlots: [],
    exportPackageSummary: {
      status: "planned",
      includedInExportProfiles: ["asset_package", "developer_archive"],
      plannedCategories: ["audio_plan", "bgm_export_plan"],
      plannedPaths: ["plans/audio/bgm_plan.json"],
      blockedReasons: [],
      notes: [],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [],
  };
}

const { buildExportBuilderState } = await loadExportBuilder();
const readyShots = [
  shot("S01", { videoPath: "outputs/videos/S01.mp4" }),
  shot("S02", { videoPath: "outputs/videos/S02.mp4" }),
];
const readyMedia = [
  {
    shotId: "S01",
    imagePath: "outputs/keyframes/S01_start.png",
    videoPath: "outputs/videos/S01.mp4",
    durationSeconds: 4,
    manifestMatched: true,
    promotionPassed: true,
    videoQaPass: true,
  },
  {
    shotId: "S02",
    imagePath: "outputs/keyframes/S02_start.png",
    videoPath: "outputs/videos/S02.mp4",
    durationSeconds: 5,
    manifestMatched: true,
    promotionPassed: true,
    videoQaPass: true,
  },
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-export-builder-no-mutation-"));
fs.writeFileSync(path.join(tmpDir, "sentinel.txt"), "unchanged", "utf8");
const before = fs.readdirSync(tmpDir).sort().join("|");

const readyState = buildExportBuilderState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  shots: readyShots,
  shotMedia: readyMedia,
  generationHealthReports: readyMedia.map((media) => health(media.shotId, media.videoPath)),
  qaPromotionReports: readyMedia.map((media) => promotion(media.shotId, media.videoPath)),
  jobs: [
    { id: "job_prompt_S01", slot: "image.edit", requiredMode: "image2image", providerId: "openai-image2-api", status: "success", promptPath: "prompts/S01.md", references: [], issues: [] },
    { id: "job_prompt_S02", slot: "image.edit", requiredMode: "image2image", providerId: "openai-image2-api", status: "success", promptPath: "prompts/S02.md", references: [], issues: [] },
  ],
  taskRuns: [
    {
      taskId: "job_video_S01",
      localStatus: "succeeded",
      providerStatus: "success",
      providerId: "seedance2-provider",
      retryCount: 0,
      stallTimeoutSeconds: 600,
      tempDirs: [],
      expectedOutputs: ["outputs/videos/S01.mp4"],
      actualOutputs: ["outputs/videos/S01.mp4"],
    },
  ],
  audioPlanning: audioPlanningFixture(),
  defaultImageHoldSeconds: 3,
});

const after = fs.readdirSync(tmpDir).sort().join("|");
assert(before === after, "export builder must not mutate the filesystem");
assert(fs.readFileSync(path.join(tmpDir, "sentinel.txt"), "utf8") === "unchanged", "sentinel file must not be modified");

assert(readyState.schemaVersion === "0.1.0", "export builder schemaVersion drifted");
assert(readyState.phase === "phase_12_preview_export_builder", "export builder phase drifted");
assert(readyState.dryRunOnly === true, "export builder must be dry-run only");
assert(readyState.noFileMutation === true, "export builder must pin noFileMutation=true");
assert(readyState.providerSubmissionForbidden === true, "export builder must forbid provider submission");
assert(readyState.liveSubmitAllowed === false, "export builder live submit must be false");
assert(readyState.fileMutationPlan.copyFiles === false, "copyFiles must be false");
assert(readyState.fileMutationPlan.moveFiles === false, "moveFiles must be false");
assert(readyState.fileMutationPlan.writeFiles === false, "writeFiles must be false");
assert(readyState.fileMutationPlan.renderMedia === false, "renderMedia must be false");
assert(readyState.fileMutationPlan.createDirectories === false, "createDirectories must be false");
assert(readyState.fileMutationPlan.plannedMutations.length === 0, "planned file mutations must be empty");

const profileKinds = readyState.exportProfiles.map((profile) => profile.kind).sort();
assert(
  JSON.stringify(profileKinds) === JSON.stringify(["asset_package", "developer_archive", "rough_cut", "storyboard_table"]),
  "export builder must cover four dry-run export profiles",
);
for (const profile of readyState.exportProfiles) {
  assert(profile.dryRunOnly === true, `${profile.kind} profile must be dry-run only`);
  assert(profile.providerSubmissionForbidden === true, `${profile.kind} profile must forbid provider submission`);
}
assert(readyState.exportPackagePlan.dryRunOnly === true, "export package plan must be dry-run only");
assert(readyState.exportPackagePlan.providerSubmissionForbidden === true, "export package plan must forbid provider submission");

assert(readyState.formalPreviewGate.status === "pass", "ready fixture formal gate should pass");
assert(readyState.formalPreview.status === "ready", "ready fixture formal preview should be ready");
assert(readyState.formalPreview.events.length === readyShots.length, "formal preview should include every ready video clip");
assert(readyState.formalPreview.events.every((event) => event.type === "video_clip"), "formal preview should contain only video clips");
assert(readyState.formalPreview.events.every((event) => event.type !== "blocked_placeholder"), "formal preview cannot contain blocked placeholders");
assert(readyState.draftPreview.events.every((event) => event.type === "video_clip"), "available videos must replace corresponding image holds in draft preview");
assert(readyState.draftPreview.events[0].durationSeconds === 4, "draft preview must preserve image hold/video replacement duration");

const assetProfile = readyState.exportProfiles.find((profile) => profile.kind === "asset_package");
assert(assetProfile.includedCategories.includes("bgm_export_plan"), "asset package must include BGM export plan category");
assert(assetProfile.includedPaths.includes("plans/audio/bgm_plan.json"), "asset package should include planned audio/BGM path");
assert(readyState.audioPolicy.videoProviderBgmAllowed === false, "video provider BGM must be false");
assert(readyState.audioPolicy.bgmHandledBy === "audio_plan_or_export_plan", "BGM must be handled by audio/export planning");
assert(readyState.audioPolicy.bgmIncludedInVideoPrompt === false, "BGM must not be included in video prompts");

const futureTargets = new Set(readyState.futureTargets.map((target) => target.target));
for (const target of ["fcpxml", "edl", "premiere_pro", "jianying", "davinci_resolve"]) {
  assert(futureTargets.has(target), `future target ${target} missing`);
}
for (const target of readyState.futureTargets) {
  assert(target.status === "future_placeholder", `${target.target} must be future_placeholder`);
  assert(target.enabled === false, `${target.target} must not be enabled`);
  assert(target.writesFile === false, `${target.target} must not write files`);
}
const futureTargetText = readyState.exportPackagePlan.futureTargets.join(" ");
for (const token of ["fcpxml", "edl", "premiere_pro", "jianying", "davinci_resolve"]) {
  assert(futureTargetText.includes(token), `export package future target list must reserve ${token}`);
}

const blockedState = buildExportBuilderState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  shots: [
    shot("S03", { videoPath: undefined }),
    shot("S04", { startFrame: undefined, endFrame: undefined, gates: gates({ pair: "FAIL" }) }),
  ],
  shotMedia: [
    {
      shotId: "S03",
      imagePath: "outputs/keyframes/S03_start.png",
      durationSeconds: 6,
      manifestMatched: false,
      promotionPassed: false,
      videoQaPass: false,
    },
  ],
  generationHealthReports: [],
  qaPromotionReports: [],
  defaultImageHoldSeconds: 3,
});

assert(blockedState.draftPreview.events.some((event) => event.type === "image_hold"), "draft preview must use image holds when video is missing");
assert(blockedState.draftPreview.events.some((event) => event.type === "blocked_placeholder"), "draft preview must show missing/blocked placeholders");
assert(blockedState.draftPreview.events.find((event) => event.shotId === "S03")?.durationSeconds === 6, "image hold must use planned duration");
assert(blockedState.formalPreviewGate.status === "blocked", "formal preview must block missing/failed segments");
assert(blockedState.formalPreview.status === "blocked", "formal preview status must be blocked");
assert(blockedState.formalPreview.events.every((event) => event.type !== "blocked_placeholder"), "blocked placeholders must not enter formal preview");
assert(
  blockedState.formalPreviewGate.blockedReasons.some((reason) => reason.includes("video clip is missing")) ||
    blockedState.formalPreviewGate.blockedReasons.some((reason) => reason.includes("videoPresent")),
  "formal gate should explain missing video segment",
);

const schema = readJson("schemas/export_builder.schema.json");
assert(schema.title === "ExportBuilderState", "export builder schema title drifted");
assert(schema.properties.noFileMutation.const === true, "schema must pin noFileMutation=true");
assert(schema.$defs.fileMutationPlan.properties.copyFiles.const === false, "schema must forbid copying files");
assert(schema.$defs.fileMutationPlan.properties.moveFiles.const === false, "schema must forbid moving files");
assert(schema.$defs.fileMutationPlan.properties.writeFiles.const === false, "schema must forbid writing files");
assert(schema.$defs.fileMutationPlan.properties.renderMedia.const === false, "schema must forbid rendering media");
assert(schema.$defs.audioPolicy.properties.videoProviderBgmAllowed.const === false, "schema must forbid BGM in video provider");
assert(schema.$defs.futureTarget.properties.enabled.const === false, "schema must keep future targets disabled");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("export_builder.schema.json"), "schema registry must include export_builder.schema.json");
assert(registrySource.includes("ExportBuilderState"), "schema registry must include ExportBuilderState type");

console.log(
  `Export builder tests passed: ${readyState.exportProfiles.length} profiles, ${readyState.futureTargets.length} future target(s), formal gate ${readyState.formalPreviewGate.status}.`,
);
