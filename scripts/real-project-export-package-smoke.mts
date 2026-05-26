import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildExportBuilderState } from "../src/core/exportBuilder.ts";
import { buildExportWorkerState, executeExportWorkerPlan } from "../src/core/exportWorker.ts";
import type { ProjectVibeDocument } from "../src/project/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function argValue(name: string, fallback = "") {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((item) => item === name || item.startsWith(prefix));
  if (!found) return fallback;
  if (found === name) return "1";
  return found.slice(prefix.length);
}

function safeRelative(filePath: string) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(process.cwd(), absolute).replace(/\\/g, "/");
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path must stay inside repo/project root for this smoke: ${filePath}`);
  }
  return relative;
}

class DiskExportAdapter {
  constructor(private readonly projectRoot: string) {}

  mkdir(relativePath: string) {
    mkdirSync(path.join(this.projectRoot, relativePath), { recursive: true });
  }

  writeFile(relativePath: string, content: string) {
    const target = path.join(this.projectRoot, relativePath);
    const scoped = path.relative(this.projectRoot, target);
    if (scoped.startsWith("..") || path.isAbsolute(scoped)) throw new Error(`outside project root: ${relativePath}`);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }

  copyFile(sourcePath: string, destinationPath: string) {
    const source = path.join(this.projectRoot, sourcePath);
    const target = path.join(this.projectRoot, destinationPath);
    for (const candidate of [source, target]) {
      const scoped = path.relative(this.projectRoot, candidate);
      if (scoped.startsWith("..") || path.isAbsolute(scoped)) throw new Error(`outside project root: ${candidate}`);
    }
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}

const generatedAt = "2026-05-19T12:00:00.000Z";
const videoPath = safeRelative(argValue(
  "--video",
  "real-test-sandbox/final-video-jimeng-tts-20260519/final-video/final.mp4",
));
const audioPath = safeRelative(argValue(
  "--audio",
  ".vibe-runtime/tts/local-index-tts/mvp_acceptance_voice.wav",
));
const rawJimengVideoPath = safeRelative(argValue(
  "--raw-video",
  "real-test-sandbox/jimeng-video-live-ms01-20260519/video/e2ebfcfa3c6c77d4_video_1.mp4",
));
const protectedJimengVideoPath = safeRelative(argValue(
  "--protected-video",
  "real-test-sandbox/jimeng-video-live-ms01-20260519/video/e2ebfcfa3c6c77d4_video_1_firstframe-hold.mp4",
));
const exportRoot = argValue("--export-root", "exports/real-project-mvp-acceptance-20260519");

for (const file of [videoPath, audioPath, rawJimengVideoPath, protectedJimengVideoPath]) {
  assert(existsSync(path.join(process.cwd(), file)), `required real artifact missing: ${file}`);
}

const project = JSON.parse(readFileSync("sample-projects/mvp-demo/project.vibe", "utf8")) as ProjectVibeDocument;
project.manifest.projectId = "real_project_mvp_acceptance_20260519";
project.manifest.title = "Real Project MVP Acceptance";
project.manifest.updatedAt = generatedAt;
project.shots = [
  {
    id: "MS01",
    sectionId: "opening",
    title: "Jimeng video with local narration",
    intent: "Verify a real returned Jimeng clip, local TTS audio, final render, and export package.",
    sceneAssetIds: ["scene_morning"],
    characterAssetIds: ["character_vendor"],
    propAssetIds: [],
    durationSeconds: 5,
    status: "generated",
    sourceRefs: ["real_acceptance:MS01"],
  },
] as ProjectVibeDocument["shots"];
project.storyFlow.sections = [
  {
    id: "opening",
    title: "Opening",
    summary: "Single-shot real acceptance lane.",
    sequenceIndex: 0,
    shotIds: ["MS01"],
  },
];
project.storyFlow.shotOrder = ["MS01"];
project.runs.push({
  id: "run_real_acceptance_final_video",
  runKind: "provider_execution",
  createdAt: generatedAt,
  summary: "Real acceptance smoke with Jimeng video, local IndexTTS audio, and final ffmpeg render.",
  sourceFactHash: "real_acceptance_smoke",
  affectedShotIds: ["MS01"],
  producedAssetIds: [],
  status: "succeeded",
  taskEnvelopeId: "task_real_acceptance_final_video",
  projectFactsMutated: false,
  runtimeFixtureUsed: false,
  evidenceRefs: [
    "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-image2video-submit.json",
    "real-test-sandbox/final-video-jimeng-tts-20260519/receipts/final-video-render.json",
    ".vibe-runtime/tts/receipts/mvp_acceptance_voice.json",
  ],
});

const source = buildExportBuilderState({
  generatedAt,
  selectedShotId: "MS01",
  shots: [
    {
      id: "MS01",
      actId: "A1",
      sectionId: "opening",
      title: "Jimeng video with local narration",
      storyFunction: "Acceptance proof for final video render and export package.",
      startFrame: "real-test-sandbox/jimeng-video-live-ms01-20260519/inputs/MS01-start.png",
      videoPath,
      status: "ready",
      gates: { identity: "PASS", scene: "PASS", pair: "PASS", story: "PASS", prop: "N/A", style: "PASS" },
      issues: [],
    },
  ],
  shotMedia: [
    {
      shotId: "MS01",
      videoPath,
      durationSeconds: 5,
      manifestMatched: true,
      promotionPassed: true,
      videoQaPass: true,
    },
  ],
  jobs: [
    {
      id: "jimeng_video_MS01",
      slot: "video.i2v",
      requiredMode: "frames2video",
      providerId: "jimeng-video-cli",
      status: "success",
      outputPath: rawJimengVideoPath,
      promptPath: "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/prompt.md",
      references: [
        "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/submit-plan.json",
        "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-image2video-submit.json",
        "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-query-attempts.jsonl",
        "real-test-sandbox/final-video-jimeng-tts-20260519/receipts/final-video-render.json",
      ],
      submitId: "e2ebfcfa3c6c77d4",
      providerTaskId: "e2ebfcfa3c6c77d4",
      issues: [],
    },
  ],
  taskRuns: [
    {
      taskId: "jimeng_video_MS01",
      localStatus: "succeeded",
      providerStatus: "success",
      providerId: "jimeng-video-cli",
      submitId: "e2ebfcfa3c6c77d4",
      providerTaskId: "e2ebfcfa3c6c77d4",
      retryCount: 0,
      stallTimeoutSeconds: 1800,
      tempDirs: ["real-test-sandbox/jimeng-video-live-ms01-20260519/video"],
      expectedOutputs: [rawJimengVideoPath],
      actualOutputs: [rawJimengVideoPath, protectedJimengVideoPath, videoPath],
      lastEventAt: generatedAt,
    },
    {
      taskId: "local_index_tts_MS01",
      localStatus: "succeeded",
      providerStatus: "success",
      providerId: "local-index-tts",
      retryCount: 0,
      stallTimeoutSeconds: 600,
      tempDirs: [".vibe-runtime/tts/local-index-tts"],
      expectedOutputs: [audioPath],
      actualOutputs: [audioPath],
      lastEventAt: generatedAt,
    },
  ],
  generationHealthReports: [
    {
      reportId: "health_MS01_video",
      taskPlanId: "jimeng_video_MS01",
      jobId: "jimeng_video_MS01",
      shotId: "MS01",
      expectedOutputPath: videoPath,
      outputExists: true,
      manifestStatus: "actual_output_present",
      qaStatus: "pass",
      stalePrompt: false,
      assetReadinessStatus: "ready",
      healthStatus: "formal_ready",
      blockers: [],
      warnings: [],
      nextAction: "human_review_video",
    },
  ],
  qaPromotionReports: [
    {
      reportId: "promotion_MS01_video",
      taskPlanId: "jimeng_video_MS01",
      jobId: "jimeng_video_MS01",
      shotId: "MS01",
      candidatePath: videoPath,
      formalPath: videoPath,
      promotionStatus: "ready_for_promotion",
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
    },
  ],
  audioPlanning: {
    schemaVersion: "0.1.0",
    generatedAt,
    shotPlans: [
      {
        shotId: "MS01",
        narrationText: "这个本地配音测试会作为最终视频合成的旁白音轨。",
        dialogueLines: [],
        voiceSourceId: "voice_reference_local_smoke",
        deliveryNotes: "Local IndexTTS acceptance audio.",
        ambienceBrief: "No additional ambience in this smoke.",
        bgmProfile: "No BGM for video provider",
        musicAllowed: false,
        targetDurationSeconds: 5,
        outputPath: audioPath,
        linkedTtsJobId: "local_index_tts_MS01",
        linkedMusicJobId: null,
        audioQaStatus: "PASS",
      },
    ],
    voiceSourceRegistry: {
      sourceCount: 1,
      placeholderCount: 0,
      plannedCount: 1,
      unavailableCount: 0,
      sources: [],
      storesSecrets: false,
      changeTransactionRequired: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      notes: ["Local voice reference is represented by hash/receipt in export; raw local speaker path is not exported."],
    },
    previewMix: {
      planId: "preview_mix_real_acceptance",
      generatedFromAudioPlan: true,
      eventCount: 1,
      missingOutputPathCount: 0,
      events: [],
      notes: ["Audio track is available for final render."],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    videoProviderPolicy: {
      musicAllowed: false,
      noBgmForVideoProvider: true,
      ambienceSfxPlaceholderAllowed: true,
      bgmHandledBy: "audio_plan_or_post_import",
      summary: "Video provider prompt stays silent; audio is handled in local final render/export.",
    },
    providerSlots: [],
    exportPackageSummary: {
      status: "planned",
      includedInExportProfiles: ["asset_package", "developer_archive"],
      plannedCategories: ["narration_audio", "voice_reference_receipt"],
      plannedPaths: [audioPath, ".vibe-runtime/tts/receipts/mvp_acceptance_voice.json"],
      blockedReasons: [],
      notes: ["Local TTS output included as project-relative export reference."],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: ["Audio was generated locally by IndexTTS with explicit permission receipt."],
  },
  issues: [],
  oneShotResultSummary: {
    submitId: "e2ebfcfa3c6c77d4",
    outputVideoPath: videoPath,
    outputVideoSha256: "sha256:unknown_in_smoke_manifest",
    queryLogPath: "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-query-attempts.jsonl",
    submitLogPath: "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-image2video-submit.json",
    planPath: "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/submit-plan.json",
    resumeCommand: "dreamina query_result --submit_id=e2ebfcfa3c6c77d4 --download_dir=real-test-sandbox/jimeng-video-live-ms01-20260519/video",
  },
});

const worker = buildExportWorkerState({
  source,
  projectVibe: project,
  projectTitle: project.manifest.title,
  exportRoot,
  generatedAt,
  profileSelection: "all",
  executionMode: "adapter_execution",
  confirmation: true,
});
assert(worker.canExecute, `export worker should execute: ${worker.blockers.join("; ")}`);

const result = await executeExportWorkerPlan(worker, new DiskExportAdapter(process.cwd()));
assert(result.ok, `export worker failed: ${result.errors.join("; ")}`);

const manifestPath = path.join(process.cwd(), exportRoot, "export_manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert(manifest.mvpPackage.projectVibeIncluded === true, "export should include Project.vibe");
assert(manifest.mvpPackage.videoResultCount >= 1, "export should include video result");
assert(manifest.mvpPackage.videoNeedsReviewCount >= 1, "real video should remain needs_review");
assert(manifest.mvpPackage.videoApprovedCount === 0, "real video should not auto-approve");
assert(manifest.mvpPackage.receiptCount >= 1, "export should include receipts");

const copiedVideo = path.join(process.cwd(), exportRoot, "final-video/01_MS01.mp4");
assert(existsSync(copiedVideo), "export should copy final video to stable final-video path");
assert(statSync(copiedVideo).size > 0, "copied final video should be non-empty");

const report = {
  ok: true,
  exportRoot,
  manifestPath,
  copiedVideo: path.relative(process.cwd(), copiedVideo).replace(/\\/g, "/"),
  executedCount: result.executed.length,
  videoNeedsReviewCount: manifest.mvpPackage.videoNeedsReviewCount,
  videoApprovedCount: manifest.mvpPackage.videoApprovedCount,
  audioPath,
  providerCalledExternalDuringExport: false,
};
const reportPath = path.join(process.cwd(), exportRoot, "real_project_acceptance_report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
