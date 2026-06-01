import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildCurrentProjectPreviewProjection } from "../src/core/currentProjectPreviewProjection.ts";
import { buildExportWorkerState, executeExportWorkerPlan } from "../src/core/exportWorker.ts";
import { buildLocalPreviewExportProjection } from "../src/core/localPreviewExportProjection.ts";
import { deriveP6LiveReportProjection } from "../src/core/p6LiveReportProjection.ts";
import { buildPreviewExportState } from "../src/core/previewExport.ts";
import { buildPreviewPlayerQueue } from "../src/core/previewPlayerQueue.ts";
import { deriveProjectRealChainStatus } from "../src/core/projectRealChainStatus.ts";
import type { GenerationHealthReport, GenerationJob, QaPromotionReport, ShotRecord, TaskRun } from "../src/core/types.ts";
import { projectVibeModelVersion, type ProjectVibeDocument } from "../src/project/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function argValue(name: string) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, label: string): string {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
  return value;
}

function numberValue(value: unknown, label: string): number {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
  return value;
}

function assertNoRawSecret(payload: unknown, label: string) {
  const text = JSON.stringify(payload);
  assert(!/\bsk-[A-Za-z0-9_-]{12,}\b/.test(text), `${label} must not contain a raw sk-* key`);
  assert(!/\bBearer\s+[A-Za-z0-9._-]{12,}\b/i.test(text), `${label} must not contain a bearer token`);
  assert(!/"apiKey"\s*:/.test(text), `${label} must not expose apiKey fields`);
}

function assertProjectRelative(referencePath: string, label: string) {
  assert(!path.isAbsolute(referencePath), `${label} must stay project-root-relative`);
  assert(!referencePath.split(/[\\/]+/).includes(".."), `${label} must not include parent traversal`);
}

class DiskExportAdapter {
  constructor(private readonly projectRoot: string) {}

  async mkdir(relativePath: string) {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(this.projectRoot, relativePath), { recursive: true }));
  }

  async writeFile(relativePath: string, content: string) {
    const target = path.join(this.projectRoot, relativePath);
    const scoped = path.relative(this.projectRoot, target);
    assert(!scoped.startsWith("..") && !path.isAbsolute(scoped), `write outside project root is blocked: ${relativePath}`);
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    });
  }
}

interface LiveOutputFacts {
  shotId: string;
  outputPath: string;
  outputSha256: string;
  outputMimeType: string;
  outputFormat: string;
  runId: string;
  generatedAt: string;
}

function liveReportOutputs(report: Record<string, unknown>): LiveOutputFacts[] {
  const outputs = report.outputs;
  assert(Array.isArray(outputs) && outputs.length >= 1 && outputs.length <= 3, "preview/export bridge expects a 1-3 shot live report with at least one returned output");
  const ingest = report.ingest;
  assert(isRecord(ingest), "live report must include ingest");
  const summary = ingest.summary;
  assert(isRecord(summary), "live report ingest must include summary");

  assert(report.liveRequested === true, "report must be a live run");
  assert(report.providerCalled === true, "live report must record providerCalled=true");
  assert(report.runtimeExternalNetworkCallMade === true, "live report must record external network IO");
  assert(
    report.providerRequestStrategy === "serial_one_shot"
      || report.providerRequestStrategy === "scheduler_one_shot_with_retry",
    "live report must use bounded one-shot provider requests",
  );
  assert(numberValue(report.maxConcurrency, "report.maxConcurrency") >= 1, "live report must include maxConcurrency");
  assert(numberValue(report.maxConcurrency, "report.maxConcurrency") <= 3, "live report must cap maxConcurrency to 3");
  assert(numberValue(report.maxAutoRetries, "report.maxAutoRetries") >= 0, "live report must include maxAutoRetries");
  assert(numberValue(report.maxAutoRetries, "report.maxAutoRetries") <= 2, "live report must cap maxAutoRetries to 2");
  if (report.providerRequestStrategy === "scheduler_one_shot_with_retry") {
    assert(isRecord(report.retrySummary), "retry-scheduler live report must include retrySummary");
    assert(report.retrySummary.promotionAllowed === false, "retry scheduler must not promote outputs");
    assert(Array.isArray(report.retryAttemptReceipts), "retry-scheduler live report must include retryAttemptReceipts");
  }
  assert(ingest.providerSelfReportIgnoredForCompletion === true, "ingest must ignore provider self-report for completion");
  assert(numberValue(summary.previewEligible, "ingest.summary.previewEligible") >= 1, "live report should expose at least one preview eligible return");
  assert(summary.promotionAllowed === false, "live report must not auto-promote");

  const runId = stringValue(report.runId ?? ingest.runId, "report.runId");
  const generatedAt = typeof ingest.generatedAt === "string" ? ingest.generatedAt : new Date().toISOString();
  return outputs.map((output, index) => {
    assert(isRecord(output), `live report output ${index + 1} must be an object`);
    const shotId = stringValue(output.shotId, `outputs[${index}].shotId`);
    const outputPath = stringValue(output.outputPath, `outputs[${index}].outputPath`);
    const outputSha256 = stringValue(output.outputSha256, `outputs[${index}].outputSha256`);
    const outputMimeType = stringValue(output.outputMimeType, `outputs[${index}].outputMimeType`);
    const outputFormat = stringValue(output.outputFormat, `outputs[${index}].outputFormat`);
    assert(/^sha256:[a-f0-9]{64}$/.test(outputSha256), `output ${shotId} must be hash-bound`);
    assert(["image/png", "image/jpeg", "image/webp"].includes(outputMimeType), `output ${shotId} MIME must be preview supported`);
    assert(["png", "jpeg", "webp"].includes(outputFormat), `output ${shotId} format must be preview supported`);
    assertProjectRelative(outputPath, `output ${shotId} path`);
    return { shotId, outputPath, outputSha256, outputMimeType, outputFormat, runId, generatedAt };
  });
}

function p6Shot(facts: LiveOutputFacts): ShotRecord {
  return {
    id: facts.shotId,
    actId: "P6",
    sectionId: "real_image2_live",
    title: "P6 live Image2 return",
    storyFunction: "Verify that a real needs_review Image2 return can drive preview and export without trusting provider self-report.",
    startFrame: facts.outputPath,
    status: "ready",
    gates: { identity: "PASS", scene: "PASS", pair: "PARTIAL", story: "PASS", prop: "N/A", style: "PARTIAL" },
    issues: ["Requires human QA before promotion."],
  };
}

function p6Job(facts: LiveOutputFacts): GenerationJob {
  return {
    id: `job_${facts.runId}_${facts.shotId}`,
    slot: "image.generate",
    requiredMode: "text2image",
    providerId: "lanyi-image2",
    status: "success",
    outputPath: facts.outputPath,
    references: [],
    submitId: facts.runId,
    providerTaskId: facts.runId,
    issues: [],
  };
}

function p6TaskRun(facts: LiveOutputFacts, job: GenerationJob): TaskRun {
  return {
    taskId: job.id,
    localStatus: "qa_pending",
    providerStatus: "success",
    providerId: job.providerId,
    submitId: facts.runId,
    providerTaskId: facts.runId,
    retryCount: 0,
    stallTimeoutSeconds: 0,
    tempDirs: [],
    expectedOutputs: [facts.outputPath],
    actualOutputs: [facts.outputPath],
    lastEventAt: facts.generatedAt,
  };
}

function p6GenerationHealth(facts: LiveOutputFacts, job: GenerationJob): GenerationHealthReport {
  return {
    reportId: `health_${facts.runId}_${facts.shotId}`,
    taskPlanId: `task_plan_${facts.runId}_${facts.shotId}`,
    jobId: job.id,
    shotId: facts.shotId,
    expectedOutputPath: facts.outputPath,
    outputExists: true,
    manifestStatus: "actual_output_present",
    qaStatus: "pending",
    stalePrompt: false,
    assetReadinessStatus: "draft_only",
    healthStatus: "qa_pending",
    blockers: [],
    warnings: ["Human QA is still required before promotion."],
    nextAction: "Review returned image hash and decide whether to promote.",
  };
}

function p6PromotionReport(facts: LiveOutputFacts, job: GenerationJob): QaPromotionReport {
  return {
    reportId: `promotion_${facts.runId}_${facts.shotId}`,
    taskPlanId: `task_plan_${facts.runId}_${facts.shotId}`,
    jobId: job.id,
    shotId: facts.shotId,
    candidatePath: facts.outputPath,
    formalPath: `outputs/formal/${facts.shotId}/image2.${facts.outputFormat}`,
    promotionStatus: "qa_pending",
    requiredGates: {
      expectedOutput: true,
      manifestMatch: true,
      promptFresh: true,
      assetReadiness: true,
      qaPass: false,
    },
    blockers: ["Explicit human QA approval is required before promotion."],
    warnings: [],
    canPromoteToFormal: false,
  };
}

function p6ManifestMatch(facts: LiveOutputFacts, job: GenerationJob) {
  return {
    taskId: job.id,
    status: "actual_output_present" as const,
    expectedOutputCount: 1,
    presentOutputCount: 1,
    missingExpectedOutputs: [],
    actualOutputsPresent: [facts.outputPath],
    recoverableOutputs: [],
    outputMatches: [
      {
        expectedPath: facts.outputPath,
        status: "actual_output_present" as const,
        actualPath: facts.outputPath,
        recoverableCandidates: [],
        reason: "P6 live report output exists on disk.",
      },
    ],
  };
}

function p6ProjectVibe(firstFacts: LiveOutputFacts, allFacts: LiveOutputFacts[]): ProjectVibeDocument {
  return {
    kind: "project_vibe_document",
    modelVersion: projectVibeModelVersion,
    manifest: {
      projectId: `p6_live_${firstFacts.runId}`,
      title: "P6 Live Image2 Preview Export Bridge",
      version: "0.1.0",
      createdAt: firstFacts.generatedAt,
      updatedAt: firstFacts.generatedAt,
      sourceOfTruth: "project_vibe",
      portableRoot: "project_root",
      runtimeFixtureAuthority: false,
    },
    storyFlow: {
      id: "story_flow_p6_live",
      updatedAt: firstFacts.generatedAt,
      sourceOfTruth: "project_vibe",
      sections: [
        {
          id: "real_image2_live",
          title: "Real Image2 Live",
          summary: "Real Image2 returns remain needs_review and preview eligible.",
          sequenceIndex: 1,
          shotIds: allFacts.map((facts) => facts.shotId),
        },
      ],
      shotOrder: allFacts.map((facts) => facts.shotId),
    },
    visualMemory: {
      id: "visual_memory_p6_live",
      updatedAt: firstFacts.generatedAt,
      sourceOfTruth: "project_vibe",
      referencePolicy: {
        temporaryOutputsMayBecomeAuthority: false,
        runtimeFixturesMayBecomeAuthority: false,
        lockedAssetsRequiredForGeneration: true,
      },
      entries: [],
    },
    shots: allFacts.map((facts) => ({
        id: facts.shotId,
        sectionId: "real_image2_live",
        title: "P6 live Image2 return",
        intent: "Use the real returned image as preview-only material until QA promotes it.",
        sceneAssetIds: [],
        characterAssetIds: [],
        propAssetIds: [],
        durationSeconds: 3,
        status: "generated",
        sourceRefs: [facts.outputPath, facts.outputSha256],
      })),
    assets: allFacts.map((facts) => ({
        id: `asset_${facts.shotId}_candidate`,
        kind: "reference",
        label: "P6 live Image2 candidate",
        status: "needs_review",
        path: facts.outputPath,
        textConstraints: ["Candidate preview only; not a locked asset."],
        usedByShotIds: [facts.shotId],
        sourceRefs: [facts.outputSha256],
      })),
    runs: [
      {
        id: `run_${firstFacts.runId}`,
        runKind: "provider",
        status: "succeeded",
        createdAt: firstFacts.generatedAt,
        summary: `P6 real Image2 returned ${allFacts.length} image(s) and ingested them as needs_review.`,
        sourceFactHash: firstFacts.outputSha256,
        affectedShotIds: allFacts.map((facts) => facts.shotId),
        producedAssetIds: allFacts.map((facts) => `asset_${facts.shotId}_candidate`),
        evidenceRefs: allFacts.map((facts) => facts.outputPath),
        projectFactsMutated: false,
        runtimeFixtureUsed: false,
      },
    ],
    sourceIndex: {
      id: "source_index_p6_live",
      updatedAt: firstFacts.generatedAt,
      sourceOfTruth: "project_vibe",
      manifestRef: "project.vibe#manifest",
      storyFlowRef: "project.vibe#storyFlow",
      visualMemoryRef: "project.vibe#visualMemory",
      shotRefs: allFacts.map((facts) => facts.shotId),
      assetRefs: allFacts.map((facts) => `asset_${facts.shotId}_candidate`),
      runReceiptRefs: [`run_${firstFacts.runId}`],
    },
  };
}

const defaultReport = "test_artifacts/p6-real-image2/p6-lanyi-live-1shot-current-2/report.json";
const reportPath = argValue("--report") || defaultReport;
const report = JSON.parse(await readFile(reportPath, "utf8")) as Record<string, unknown>;
assertNoRawSecret(report, "P6 live report");

const p6Projection = deriveP6LiveReportProjection(report);
assert(p6Projection, "P6 live report should project into current-project Preview/Export inputs");
const outputFacts = liveReportOutputs(report);
const facts = outputFacts[0];
assert(facts, "live report should include a primary output");
await Promise.all(outputFacts.map((item) => access(path.resolve(item.outputPath))));

const shots = outputFacts.map(p6Shot);
const jobs = outputFacts.map(p6Job);
const taskRuns = outputFacts.map((item, index) => p6TaskRun(item, jobs[index]));
const manifestMatches = outputFacts.map((item, index) => p6ManifestMatch(item, jobs[index]));
const generationHealthReports = outputFacts.map((item, index) => p6GenerationHealth(item, jobs[index]));
const qaPromotionReports = outputFacts.map((item, index) => p6PromotionReport(item, jobs[index]));
const taskViews = outputFacts.map((item, index) => ({
  job: jobs[index],
  shotId: item.shotId,
  taskRun: taskRuns[index],
  manifestMatch: manifestMatches[index],
}));

const previewExport = buildPreviewExportState({
  generatedAt: facts.generatedAt,
  projectRoot: ".",
  selectedShotId: facts.shotId,
  previewEvents: [],
  shots,
  jobs,
  taskRuns,
  taskViews,
  manifestMatches,
  generationHealthReports,
  qaPromotionReports,
  issues: [],
  oneShotResultSummary: {
    runId: facts.runId,
    shotId: facts.shotId,
    outputPath: facts.outputPath,
    outputSha256: facts.outputSha256,
    outputMimeType: facts.outputMimeType,
    status: "needs_review",
    promotionAllowed: false,
  },
});

assert(previewExport.draftPreview.status === "draft_only", "draft preview should stay draft_only from needs_review image hold");
assert(previewExport.formalPreview.status === "blocked", "formal preview should remain blocked until promotion gates pass");
const draftEvent = previewExport.draftPreview.events.find((event) => event.shotId === facts.shotId);
assert(draftEvent?.type === "image_hold", "draft preview must use an image hold");
assert(draftEvent.mediaPath === facts.outputPath, "draft preview must reference the live Image2 output path");
assert(previewExport.draftPreview.summary.imageHoldCount === outputFacts.length, "draft preview should include every live Image2 output as an image hold");
assert(previewExport.exportPackagePlan.status === "draft_only", "export package should stay draft_only before QA promotion");

const queue = buildPreviewPlayerQueue(previewExport, shots);
assert(queue.length === outputFacts.length, "preview player queue should include every live output");
const queuePrimary = queue.find((item) => item.shotId === facts.shotId);
assert(queuePrimary?.kind === "image_hold", "preview player queue must expose an image hold");
assert(queuePrimary.mediaPath === facts.outputPath, "preview player queue must use the live output path");

const currentProjection = buildCurrentProjectPreviewProjection({
  projectId: p6Projection.projectId || `p6_live_${facts.runId}`,
  projectRoot: p6Projection.projectRoot || ".",
  generatedAt: p6Projection.generatedAt || facts.generatedAt,
  summary: p6Projection.summary,
  previewItems: p6Projection.previewItems,
});
const realChainStatus = deriveProjectRealChainStatus(report, "runtime_endpoint");
const appPathProjection = buildCurrentProjectPreviewProjection({
  summary: realChainStatus,
  previewItems: realChainStatus.previewItems,
  projectId: realChainStatus.projectId,
  projectRoot: realChainStatus.projectRoot,
  generatedAt: realChainStatus.generatedAt,
});
const appPathPrimary = appPathProjection.items.find((item) => item.shotId === facts.shotId);
assert(realChainStatus.previewItems.some((item) => item.shotId === facts.shotId), "real-chain status should expose P6 preview items to App projection");
assert(appPathPrimary?.kind === "image_hold", "App real-chain projection should expose primary P6 output as image hold");
assert(appPathPrimary.returned === true, "App real-chain projection should count primary P6 output as returned");
assert(currentProjection.available === true, "current project projection should be available");
assert(currentProjection.providerCalled === false, "preview projection must never submit provider work");
const projectedPrimary = p6Projection.previewItems.find((item) => item.shotId === facts.shotId);
const currentPrimary = currentProjection.items.find((item) => item.shotId === facts.shotId);
assert(projectedPrimary, "P6 projection should include the primary returned shot");
assert(currentPrimary?.kind === "image_hold", "current project projection must expose the primary return as an image hold");
assert(currentPrimary.returned === true, "primary live return should count as returned");
assert(currentPrimary.reviewRequired === (projectedPrimary.status === "needs_review"), "current project review marker should follow P6 projection status");
assert(currentProjection.items.length === p6Projection.previewItems.length, "current project projection should include every P6 preview item");
assert(currentProjection.returnedCount === p6Projection.returnedImageCount, "current project projection returned count should match P6 projection");
assert(currentProjection.reviewCount === p6Projection.needsReviewCount, "current project projection review count should match P6 projection");

const projectVibe = p6ProjectVibe(facts, outputFacts);
const runtimeState = {
  generatedAt: facts.generatedAt,
  project: { title: projectVibe.manifest.title, root: "." },
  taskRuns: { jobs, runs: taskRuns, taskViews },
  manifestMatches: { reports: manifestMatches },
  imagePipeline: {
    generationHealthReports,
    qaPromotionReports,
  },
};
const localProjection = buildLocalPreviewExportProjection({
  runtimeState: runtimeState as any,
  previewQueue: currentProjection.queue,
  shots,
  projectVibe,
  projectRoot: ".",
  selectedShotId: facts.shotId,
  generatedAt: facts.generatedAt,
  exportRoot: "exports/p6-live-local-projection",
});
const localProjectionPrimary = localProjection.previewQueue.find((item) => item.shotId === facts.shotId);
const localPreviewExportPrimary = localProjection.previewExport.draftPreview.events.find((event) => event.shotId === facts.shotId);
assert(localProjectionPrimary?.mediaPath === facts.outputPath, "local projection must reuse current preview media path");
assert(localPreviewExportPrimary?.mediaPath === facts.outputPath, "local Preview/Export projection must carry live output path");
assert(
  localProjection.exportWorker.manifest.mvpPackage.previewMediaCount === p6Projection.returnedImageCount,
  "local export worker must include returned live preview media",
);
assert(localProjection.exportWorker.hardLocks.noProviderSubmit === true, "local export worker must keep provider submit blocked");

const projectRoot = await mkdtemp(path.join(tmpdir(), "vibe-p6-preview-export-"));
try {
  const worker = buildExportWorkerState({
    source: previewExport,
    projectVibe,
    projectTitle: "P6 Live Image2 Preview Export Bridge",
    exportRoot: "exports/p6-live-preview-export",
    generatedAt: facts.generatedAt,
    profileSelection: ["rough_cut", "asset_package", "storyboard_table", "developer_archive"],
    executionMode: "adapter_execution",
    confirmation: true,
  });
  assert(worker.canExecute, `export worker should be executable: ${worker.blockers.join("; ")}`);

  const result = await executeExportWorkerPlan(worker, new DiskExportAdapter(projectRoot));
  assert(result.ok, `export worker execution failed: ${result.errors.join("; ")}`);

  const exportRoot = path.join(projectRoot, "exports/p6-live-preview-export");
  const exportManifest = JSON.parse(await readFile(path.join(exportRoot, "export_manifest.json"), "utf8"));
  assert(exportManifest.mvpPackage.projectVibeIncluded === true, "export must include Project.vibe");
  assert(exportManifest.mvpPackage.previewMediaCount === p6Projection.returnedImageCount, "export must include every live preview media reference");
  assert(exportManifest.mvpPackage.receiptCount >= 1, "export must include receipt references");

  const previewMedia = JSON.parse(await readFile(path.join(exportRoot, "preview_media.json"), "utf8"));
  assert(previewMedia.media?.length === p6Projection.returnedImageCount, "preview_media manifest must include every returned image");
  assert(previewMedia.media?.some((item) => item.mediaPath === facts.outputPath), "preview_media manifest must reference live output path");
  assert(previewMedia.media?.every((item) => item.type === "image_hold"), "preview_media manifest must keep image_hold type");

  const reportMd = await readFile(path.join(exportRoot, "report.md"), "utf8");
  assert(reportMd.includes(`Preview media: ${p6Projection.returnedImageCount}`), "export report must count live preview media");
  assertNoRawSecret(exportManifest, "export manifest");
  assertNoRawSecret(previewMedia, "preview media manifest");
  assertNoRawSecret(reportMd, "export report");

  console.log(
    `p6-real-image2-preview-export-test: ok (${outputFacts.length} output(s), ${p6Projection.needsReviewCount} review, ${result.executed.length} writes)`,
  );
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
