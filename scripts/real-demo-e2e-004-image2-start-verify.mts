import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { buildRuntimeTruthLayer } from "../src/core/runtimeTruthLayer.ts";
import { buildRealDemoE2eReport } from "../src/core/realDemoE2e.ts";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/004-image2-start-frames");
const manifestPath = path.join(runRoot, "run_manifest.json");
const reportsRoot = path.join(runRoot, "reports");
const requiredGates = ["identity", "scene", "style", "story", "neighbor", "output"];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function absPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function repoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(filePath) {
  if (!exists(filePath)) return undefined;
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function fileInfo(filePath) {
  if (!exists(filePath)) return null;
  const stat = fs.statSync(filePath);
  return { sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
}

function imageFileInfo(filePath) {
  if (!exists(filePath)) return { mediaKind: "unknown", mediaFormat: "unknown", mediaReadable: false, width: 0, height: 0 };
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 24 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { mediaKind: "image", mediaFormat: "png", mediaReadable: true, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) return { mediaKind: "image", mediaFormat: "jpeg", mediaReadable: true, width: 1, height: 1 };
  return { mediaKind: "unknown", mediaFormat: "unknown", mediaReadable: false, width: 0, height: 0 };
}

function isScopedOutput(relativePath) {
  const absolute = path.resolve(absPath(relativePath));
  const scopedRoot = path.resolve(path.join(runRoot, "outputs/shots"));
  return absolute === scopedRoot || absolute.startsWith(`${scopedRoot}${path.sep}`);
}

function qaStatus(qa) {
  const gates = requiredGates.map((gate) => qa?.gateResults?.[gate]?.status);
  if (gates.some((status) => status === "blocked")) return "blocked";
  if (gates.some((status) => status === "needs_review")) return "needs_review";
  if (gates.every((status) => status === "pass")) return "pass";
  return "blocked";
}

function gateForRuntime(status) {
  if (status === "pass") return "pass";
  if (status === "needs_review") return "warn";
  if (status === "blocked") return "blocked";
  return "missing";
}

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 004 manifest missing. Run npm run real-demo-e2e-004:prepare first.");
  process.exit(1);
}

ensureDir(reportsRoot);
const generatedAt = new Date().toISOString();
const manifest = readJson(manifestPath);
const watcherFile = exists(absPath(manifest.runtimeTruthWatcherPath)) ? readJson(absPath(manifest.runtimeTruthWatcherPath)) : { events: [] };
const blockers = [];

const observations = manifest.shotPlans.map((plan, index) => {
  const outputPath = absPath(plan.expectedOutputPath);
  const providerPath = absPath(plan.providerObservationPath);
  const workerPath = absPath(plan.workerProvenancePath);
  const qaPath = absPath(plan.semanticQaPath);
  const layoutPath = path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`);
  const outputInfo = fileInfo(outputPath);
  const imageInfo = imageFileInfo(outputPath);
  const outputSha256 = sha256File(outputPath);
  const provider = exists(providerPath) ? readJson(providerPath) : null;
  const worker = exists(workerPath) ? readJson(workerPath) : null;
  const qa = exists(qaPath) ? readJson(qaPath) : null;
  const layout = exists(layoutPath) ? readJson(layoutPath) : null;
  const shotEvents = watcherFile.events.filter((event) => event.shotId === plan.shotId);
  const itemBlockers = [
    outputInfo ? "" : `${plan.shotId}: output missing`,
    imageInfo.mediaReadable ? "" : `${plan.shotId}: output unreadable`,
    isScopedOutput(plan.expectedOutputPath) ? "" : `${plan.shotId}: output outside scoped sandbox`,
    provider?.providerObservationMode === "actual_provider_call_observed" ? "" : `${plan.shotId}: provider observation not actual`,
    String(provider?.provider || "").includes("image2") ? "" : `${plan.shotId}: provider is not image2`,
    provider?.outputSha256 === outputSha256 ? "" : `${plan.shotId}: provider hash mismatch`,
    worker?.provenanceMode === "actual_subagent_worker_lease_observed" ? "" : `${plan.shotId}: worker provenance not actual`,
    worker?.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: worker outputPath mismatch`,
    qa?.semanticReviewMode === "actual_image_semantic_review" ? "" : `${plan.shotId}: semantic QA not actual review`,
    qa?.reviewedOutputSha256 === outputSha256 ? "" : `${plan.shotId}: semantic QA hash mismatch`,
    qaStatus(qa) === "pass" ? "" : `${plan.shotId}: semantic QA status ${qaStatus(qa)}`,
    shotEvents.length === 5 && shotEvents.every((event) => event.sourceKind === "app_server_fs_changed") ? "" : `${plan.shotId}: watcher events incomplete`,
    layout?.neighborShots?.current?.shotId === plan.shotId ? "" : `${plan.shotId}: layout neighbor missing`,
    index > 0 && layout?.neighborShots?.previous?.shotId !== manifest.shotPlans[index - 1].shotId ? `${plan.shotId}: previous neighbor mismatch` : "",
    index < manifest.shotPlans.length - 1 && layout?.neighborShots?.next?.shotId !== manifest.shotPlans[index + 1].shotId ? `${plan.shotId}: next neighbor mismatch` : "",
  ].filter(Boolean);
  blockers.push(...itemBlockers);

  const runtimeTruthLayer = outputInfo && provider && worker && qa ? buildRuntimeTruthLayer({
    generatedAt,
    runId: manifest.runId,
    manifestGeneratedAt: manifest.generatedAt,
    taskRunId: plan.taskRunId,
    shotId: plan.shotId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    expectedOutputPath: plan.expectedOutputPath,
    artifact: { artifactPath: plan.expectedOutputPath, exists: true, fileModifiedAt: outputInfo.modifiedAt, sizeBytes: outputInfo.sizeBytes, outputSha256, ...imageInfo },
    workerLease: { ...worker, exists: true, sidecarKind: "worker_provenance", sidecarPath: plan.workerProvenancePath, sidecarModifiedAt: fileInfo(workerPath)?.modifiedAt },
    providerObservation: {
      sidecarPath: plan.providerObservationPath,
      exists: true,
      sidecarModifiedAt: fileInfo(providerPath)?.modifiedAt,
      generatedAt: provider.generatedAt,
      runId: provider.runId,
      taskRunId: provider.taskRunId,
      taskPacketId: provider.taskPacketId,
      envelopeId: provider.envelopeId,
      outputPath: provider.outputPath,
      outputSha256: provider.outputSha256,
      providerId: provider.provider,
      workerId: provider.workerId,
      subagentId: provider.subagentId,
      threadId: provider.threadId,
      turnId: provider.turnId,
      toolCallId: provider.toolCallId,
      providerObservationMode: provider.providerObservationMode,
      manualFileCopyDetected: provider.manualFileCopyDetected === true,
      fixtureReuseDetected: provider.fixtureReuseDetected === true,
      providerSelfReportCompletesTask: provider.providerSelfReportCompletesTask === true,
    },
    semanticQa: {
      sidecarPath: plan.semanticQaPath,
      exists: true,
      sidecarModifiedAt: fileInfo(qaPath)?.modifiedAt,
      reviewedAt: qa.reviewedAt,
      runId: qa.runId,
      taskRunId: qa.taskRunId,
      taskPacketId: qa.taskPacketId,
      envelopeId: qa.envelopeId,
      outputPath: qa.outputPath,
      outputSha256: qa.outputSha256,
      reviewedOutputSha256: qa.reviewedOutputSha256,
      gates: Object.fromEntries(requiredGates.map((gate) => [gate, gateForRuntime(qa.gateResults?.[gate]?.status)])),
      severityCounts: { p0: 0, p1: 0, p2: 0 },
    },
    watcherEvents: shotEvents,
  }) : { status: "blocked", blockers: itemBlockers };
  if (runtimeTruthLayer.status !== "preview_ready") blockers.push(`${plan.shotId}: runtime truth blocked`);

  return {
    order: index + 1,
    shotId: plan.shotId,
    sceneId: layout?.sceneId,
    roleIds: layout?.roleIds || [],
    expectedOutputPath: plan.expectedOutputPath,
    outputSha256,
    imageInfo,
    qaStatus: qaStatus(qa),
    runtimeTruthStatus: runtimeTruthLayer.status,
    runtimeTruthBlockers: runtimeTruthLayer.blockers || [],
    blockers: itemBlockers,
  };
});

const uniqueBlockers = Array.from(new Set(blockers));
const previewPlan = {
  schemaVersion: "real_demo_e2e_004_preview_plan_v1",
  generatedAt,
  runId: manifest.runId,
  status: uniqueBlockers.length ? "blocked" : "real_image2_start_preview_ready",
  totalDurationSeconds: manifest.shotPlans.reduce((sum, plan) => {
    const layout = readJson(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`));
    return sum + (Number(layout.durationSeconds) || 5);
  }, 0),
  clips: observations.map((item) => ({ clipId: `preview_${item.shotId}`, order: item.order, shotId: item.shotId, mediaType: "image_hold", mediaPath: item.expectedOutputPath, status: item.blockers.length ? "blocked" : "returned", durationSeconds: 5 })),
};
writeJson(path.join(reportsRoot, "preview_plan.json"), previewPlan);
writeJson(path.join(reportsRoot, "qa_report.json"), { schemaVersion: "real_demo_e2e_004_qa_report_v1", generatedAt, runId: manifest.runId, overallStatus: uniqueBlockers.length ? "blocked" : "pass", requiredGates, checks: observations.map((item) => ({ shotId: item.shotId, status: item.qaStatus, blockers: item.blockers })) });
writeJson(path.join(reportsRoot, "runtime_truth_layer.json"), { schemaVersion: "real_demo_e2e_004_runtime_truth_layer_v1", generatedAt, runId: manifest.runId, status: uniqueBlockers.length ? "blocked" : "preview_ready", items: observations.map((item) => ({ shotId: item.shotId, status: item.runtimeTruthStatus, blockers: item.runtimeTruthBlockers })) });

const report = buildRealDemoE2eReport({
  generatedAt,
  projectId: manifest.projectId,
  runId: manifest.runId,
  scenarioId: "real_demo_e2e_004_image2_start_frames",
  declaration: "actual_provider_observed",
  projectFacts: {
    projectVibePresent: exists(absPath(manifest.projectFacts.projectVibePath)),
    sourceIndexPresent: exists(absPath(manifest.projectFacts.sourceIndexPath)),
    visualMemoryPresent: exists(absPath(manifest.projectFacts.visualMemoryPath)),
    shotLayoutPresent: exists(absPath(manifest.projectFacts.shotLayoutRoot)),
  },
  chain: {
    generatedByUiAction: exists(absPath(manifest.uiActionPath)),
    validatedEnvelope: uniqueBlockers.length === 0,
    workerProvenance: {
      workerId: "imagegen_subagent_worker",
      subagentId: "imagegen_subagent",
      taskRunId: manifest.shotPlans[0]?.taskRunId,
      taskPacketId: manifest.shotPlans[0]?.taskPacketId,
      envelopeId: manifest.shotPlans[0]?.envelopeId,
      outputPath: manifest.shotPlans[0]?.expectedOutputPath,
    },
    providerCallObserved: uniqueBlockers.length === 0,
    providerObservationMode: "actual_provider_call_observed",
    outputCameFromScopedSandbox: uniqueBlockers.length === 0,
    watcherEventObserved: watcherFile.events.length === manifest.shotPlans.length * 5,
    manifestMatched: uniqueBlockers.length === 0,
    qaReportObserved: uniqueBlockers.length === 0,
    previewUpdatedFromOutput: previewPlan.status === "real_image2_start_preview_ready",
    providerSelfReportCompletesTask: false,
  },
  integrity: { manualFileCopyDetected: false, fixtureReuseDetected: false, simulatedStateDetected: false },
  pressure: {
    totalShots: manifest.shotPlans.length,
    realImagePlanCount: 3,
    queuedOrParkedCount: 5,
    shotPlans: manifest.shotPlans.map((plan, index) => ({ shotId: plan.shotId, status: index < 3 ? "real_image_planned" : index < 6 ? "queued" : "parked", taskPacketId: plan.taskPacketId, envelopeId: plan.envelopeId, workerProvenanceId: plan.workerProvenanceId, expectedOutputPath: plan.expectedOutputPath })),
  },
  quality: { semanticQaStatus: uniqueBlockers.length ? "blocked" : "pass", semanticQaRequired: true, p0FindingCount: 0, p1FindingCount: 0, p2FindingCount: 0, gates: requiredGates },
  notes: ["004 uses actual Image2 start-frame outputs generated by subagents. No video providers are involved."],
});
writeJson(path.join(reportsRoot, "real_demo_e2e_report.json"), report);
writeJson(path.join(reportsRoot, "image2_start_long_chain_report.json"), { schemaVersion: "real_demo_e2e_004_image2_start_long_chain_report_v1", generatedAt, runId: manifest.runId, status: uniqueBlockers.length ? "blocked" : "real_image2_start_chain_ready", shotCount: observations.length, sceneCount: new Set(observations.map((item) => item.sceneId)).size, roleCount: new Set(observations.flatMap((item) => item.roleIds)).size, watcherEventCount: watcherFile.events.length, observations, blockers: uniqueBlockers });

console.log(`Real Demo E2E 004 verify status: ${uniqueBlockers.length ? "blocked" : "real_image2_start_chain_ready"}`);
console.log(`Report: ${repoPath(path.join(reportsRoot, "image2_start_long_chain_report.json"))}`);
if (uniqueBlockers.length || report.status === "blocked") {
  console.error("Blocked:");
  for (const blocker of [...uniqueBlockers, ...report.blockers]) console.error(`- ${blocker}`);
  process.exit(1);
}
console.log("Real Demo E2E 004 Image2 start-frame long chain verified.");
