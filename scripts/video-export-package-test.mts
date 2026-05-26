import { buildExportBuilderState } from "../src/core/exportBuilder.ts";
import { buildExportWorkerState, executeExportWorkerPlan } from "../src/core/exportWorker.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

class MemoryExportAdapter {
  files = new Map<string, string>();
  directories = new Set<string>();
  copies = new Map<string, string>();

  mkdir(path: string) {
    this.directories.add(path);
  }

  writeFile(path: string, content: string) {
    this.files.set(path, content);
  }

  copyFile(sourcePath: string, destinationPath: string) {
    this.copies.set(destinationPath, sourcePath);
  }
}

const generatedAt = "2026-05-19T02:00:00.000Z";
const rawVideoPath = "real-test-sandbox/jimeng-video-live-ms01-20260519/video/e2ebfcfa3c6c77d4_video_1.mp4";
const protectedVideoPath = "real-test-sandbox/jimeng-video-live-ms01-20260519/video/e2ebfcfa3c6c77d4_video_1_firstframe-hold.mp4";
const queryLogPath = "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-query-attempts.jsonl";
const submitReceiptPath = "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/dreamina-image2video-submit.json";
const planPath = "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/submit-plan.json";

const source = buildExportBuilderState({
  generatedAt,
  selectedShotId: "MS01",
  shots: [
    {
      id: "MS01",
      actId: "A1",
      sectionId: "opening",
      title: "Jimeng live smoke",
      storyFunction: "Check the first real image-to-video result.",
      startFrame: "real-test-sandbox/jimeng-video-live-ms01-20260519/inputs/MS01-start.png",
      videoPath: rawVideoPath,
      status: "ready",
      gates: { identity: "PASS", scene: "PASS", pair: "PASS", story: "PASS", prop: "N/A", style: "PASS" },
      issues: [],
    },
  ],
  jobs: [
    {
      id: "jimeng_video_MS01",
      slot: "video.i2v",
      requiredMode: "frames2video",
      providerId: "jimeng-video-cli",
      status: "success",
      outputPath: rawVideoPath,
      promptPath: "real-test-sandbox/jimeng-video-live-ms01-20260519/receipts/prompt.md",
      references: [planPath, submitReceiptPath, queryLogPath, "real-test-sandbox/jimeng-video-live-ms01-20260519/report/summary.md"],
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
      stallTimeoutSeconds: 120,
      tempDirs: ["real-test-sandbox/jimeng-video-live-ms01-20260519/video"],
      expectedOutputs: [rawVideoPath],
      actualOutputs: [rawVideoPath, protectedVideoPath],
      lastEventAt: generatedAt,
    },
  ],
  generationHealthReports: [
    {
      reportId: "health_MS01_video",
      taskPlanId: "jimeng_video_MS01",
      jobId: "jimeng_video_MS01",
      shotId: "MS01",
      expectedOutputPath: rawVideoPath,
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
      candidatePath: rawVideoPath,
      formalPath: rawVideoPath,
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
  issues: [],
  oneShotResultSummary: {
    submitId: "e2ebfcfa3c6c77d4",
    outputVideoPath: rawVideoPath,
    outputVideoSha256: "sha256:77df8280455ec698f8dfb195f5f2ce89c066794514ef8932c497cb05816c6876",
    queryLogPath,
    submitLogPath: submitReceiptPath,
    planPath,
    queryAttempts: 1,
    resumeCommand: "dreamina query_result --submit_id=e2ebfcfa3c6c77d4 --download_dir=real-test-sandbox/jimeng-video-live-ms01-20260519/video",
  },
});

const sourceVideoResult = source.demoPackageFacts?.videoResults?.[0];
assert(sourceVideoResult, "builder must include a video result");
assert(sourceVideoResult.reviewStatus === "needs_review", "builder must default video results to needs_review");
assert(sourceVideoResult.firstFrameProtectedVideoPath === protectedVideoPath, "builder must keep first-frame protected video when present");

const worker = buildExportWorkerState({
  source,
  exportRoot: "exports/jimeng-video-review",
  generatedAt,
  profileSelection: "all",
  executionMode: "adapter_execution",
  confirmation: true,
});

assert(worker.canExecute, `worker should be executable: ${worker.blockers.join("; ")}`);
assert(worker.manifest.mvpPackage.videoResultCount === 1, "manifest must count one video result");
assert(worker.manifest.mvpPackage.videoNeedsReviewCount === 1, "video result must remain needs_review");
assert(worker.manifest.mvpPackage.videoApprovedCount === 0, "video result must not auto-approve");

const adapter = new MemoryExportAdapter();
const result = await executeExportWorkerPlan(worker, adapter);
assert(result.ok, `worker execution should pass: ${result.errors.join("; ")}`);

const videoManifest = JSON.parse(adapter.files.get("exports/jimeng-video-review/videos/video_manifest.json") || "{}");
assert(videoManifest.videos[0].rawVideoPath === rawVideoPath, "video manifest must include raw video path");
assert(videoManifest.videos[0].firstFrameProtectedVideoPath === protectedVideoPath, "video manifest must include first-frame protected path");
assert(videoManifest.videos[0].reviewLabel === "待复核", "video manifest must use user-readable review label");
assert(videoManifest.videos[0].autoPromoted === false, "video manifest must not auto-promote");

const videoReceipts = JSON.parse(adapter.files.get("exports/jimeng-video-review/receipts/video/video_receipts.json") || "{}");
assert(videoReceipts.queuePolicy.defaultConcurrentSubmissions === 1, "video receipts must document single concurrency");
assert(videoReceipts.queuePolicy.expectedQueueWaitMinutes === 50, "video receipts must document expected Jimeng long wait");
assert(videoReceipts.queuePolicy.recommendedResumeIntervalSeconds === 10 * 60, "video receipts must document resume interval");
assert(videoReceipts.items[0].submitId === "e2ebfcfa3c6c77d4", "video receipts must include submit_id");
assert(videoReceipts.items[0].queueLogPaths.includes(queryLogPath), "video receipts must include query attempt log");
assert(/query_result --submit_id=e2ebfcfa3c6c77d4/.test(videoReceipts.items[0].resumeCommand), "video receipts must include resume command");

const videoReport = adapter.files.get("exports/jimeng-video-review/video-report/summary.md") || "";
assert(videoReport.includes("待复核: 1"), "video report must show needs_review count");
assert(videoReport.includes("已通过: 0"), "video report must show approved count");
assert(videoReport.includes("缺失: 0"), "video report must show missing count");
assert(videoReport.includes("e2ebfcfa3c6c77d4"), "video report must include submit_id for review");

console.log(`video-export-package-test: ok (${result.executed.length} writes, ${worker.manifest.mvpPackage.videoNeedsReviewCount} needs_review)`);
