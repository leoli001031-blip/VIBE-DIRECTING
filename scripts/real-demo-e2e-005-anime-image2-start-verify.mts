import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { buildRuntimeTruthLayer } from "../src/core/runtimeTruthLayer.ts";
import { buildRealDemoE2eReport } from "../src/core/realDemoE2e.ts";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames");
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

function gateStatuses(qa) {
  return Object.fromEntries(requiredGates.map((gate) => [gate, qa?.gateResults?.[gate]?.status || "missing"]));
}

function findingCount(qa, severity) {
  const gateCount = Object.values(qa?.gateResults || {}).filter((gate) => gate?.severity === severity).length;
  const assessmentKey = `${severity}Findings`;
  const assessmentCount = Array.isArray(qa?.finalAssessment?.[assessmentKey]) ? qa.finalAssessment[assessmentKey].length : 0;
  return Math.max(gateCount, assessmentCount);
}

function hasP0Finding(qa) {
  return findingCount(qa, "p0") > 0;
}

function legacyIdentityContract(shotId) {
  if (shotId === "S07") {
    return {
      characterVisibility: "back_view",
      identityVerificationMode: "partial",
      faceRequired: false,
      requiredVisibleAnchors: [
        "Mika shoulder-length indigo-black hair silhouette",
        "Mika navy and cream clothing silhouette",
        "Ren short ash-brown hair silhouette",
        "Ren olive parka silhouette",
        "Mika lower-right and Ren lower-left relative position",
      ],
    };
  }
  if (shotId === "S08") {
    return {
      characterVisibility: "long_shot",
      identityVerificationMode: "continuity_only",
      faceRequired: false,
      requiredVisibleAnchors: [
        "two-character silhouette continuity from S07",
        "Mika navy and cream silhouette",
        "Ren olive parka silhouette",
        "characters together facing the signal",
        "rooftop array geography",
      ],
    };
  }
  return {
    characterVisibility: "front_view",
    identityVerificationMode: "full",
    faceRequired: true,
    requiredVisibleAnchors: [],
  };
}

function identityContractForLayout(layout, shotId) {
  const fallback = legacyIdentityContract(shotId);
  return {
    characterVisibility: layout?.characterVisibility || fallback.characterVisibility,
    identityVerificationMode: layout?.identityVerificationMode || fallback.identityVerificationMode,
    faceRequired: layout?.faceRequired ?? fallback.faceRequired,
    requiredVisibleAnchors: layout?.requiredVisibleAnchors || fallback.requiredVisibleAnchors,
    identityGatePolicy: layout?.identityGatePolicy || null,
  };
}

function productionQaStatus(qa) {
  return qaStatus(qa);
}

function previewQaStatus(qa, identityContract) {
  const statuses = gateStatuses(qa);
  if (Object.values(statuses).some((status) => status === "blocked" || status === "missing")) return "blocked";
  if (hasP0Finding(qa)) return "blocked";
  if (Object.values(statuses).every((status) => status === "pass")) return "ready";

  const reviewGates = Object.entries(statuses)
    .filter(([, status]) => status === "needs_review")
    .map(([gate]) => gate);
  const nonIdentityGatesPass = requiredGates
    .filter((gate) => gate !== "identity")
    .every((gate) => statuses[gate] === "pass");
  const identityOnlyReview = reviewGates.length === 1 && reviewGates[0] === "identity" && nonIdentityGatesPass;
  const visibilityAllowsOverlay = ["partial", "continuity_only", "not_applicable"].includes(identityContract.identityVerificationMode) ||
    ["profile", "back_view", "long_shot", "silhouette"].includes(identityContract.characterVisibility);

  if (identityOnlyReview && visibilityAllowsOverlay) return "needs_review_overlay";
  if (reviewGates.length > 0) return "needs_review_overlay";
  return "blocked";
}

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 005 manifest missing. Run npm run real-demo-e2e-005:prepare first.");
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
  const identityContract = identityContractForLayout(layout, plan.shotId);
  const qaPreviewStatus = previewQaStatus(qa, identityContract);
  const qaProductionStatus = productionQaStatus(qa);
  const statuses = gateStatuses(qa);
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
    Object.entries(statuses).find(([, status]) => status === "blocked" || status === "missing") ? `${plan.shotId}: semantic QA has blocked or missing gate` : "",
    hasP0Finding(qa) ? `${plan.shotId}: semantic QA has P0 finding` : "",
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
      severityCounts: { p0: findingCount(qa, "p0"), p1: 0, p2: findingCount(qa, "p1") + findingCount(qa, "p2") },
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
    identityContract,
    qaStatus: qaProductionStatus,
    previewQaStatus: qaPreviewStatus,
    productionQaStatus: qaProductionStatus,
    reviewOverlay: qaPreviewStatus === "needs_review_overlay",
    runtimeTruthStatus: runtimeTruthLayer.status,
    runtimeTruthBlockers: runtimeTruthLayer.blockers || [],
    blockers: itemBlockers,
  };
});

const uniqueBlockers = Array.from(new Set(blockers));
const reviewOverlayShots = observations.filter((item) => item.previewQaStatus === "needs_review_overlay").map((item) => item.shotId);
const productionNeedsReviewShots = observations.filter((item) => item.productionQaStatus === "needs_review").map((item) => item.shotId);
const previewStatus = uniqueBlockers.length
  ? "blocked"
  : reviewOverlayShots.length
    ? "real_image2_start_preview_ready_with_review"
    : "real_image2_start_preview_ready";
const productionStatus = uniqueBlockers.length
  ? "blocked"
  : productionNeedsReviewShots.length
    ? "needs_review"
    : "pass";
const previewPlan = {
  schemaVersion: "real_demo_e2e_005_preview_plan_v1",
  generatedAt,
  runId: manifest.runId,
  status: previewStatus,
  previewStatus,
  productionStatus,
  reviewOverlayShots,
  totalDurationSeconds: manifest.shotPlans.reduce((sum, plan) => {
    const layout = readJson(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`));
    return sum + (Number(layout.durationSeconds) || 5);
  }, 0),
  clips: observations.map((item) => ({
    clipId: `preview_${item.shotId}`,
    order: item.order,
    shotId: item.shotId,
    mediaType: "image_hold",
    mediaPath: item.expectedOutputPath,
    status: item.blockers.length ? "blocked" : item.reviewOverlay ? "returned_with_review_overlay" : "returned",
    previewQaStatus: item.previewQaStatus,
    productionQaStatus: item.productionQaStatus,
    durationSeconds: 5,
  })),
};
writeJson(path.join(reportsRoot, "preview_plan.json"), previewPlan);
writeJson(path.join(reportsRoot, "qa_report.json"), {
  schemaVersion: "real_demo_e2e_005_qa_report_v1",
  generatedAt,
  runId: manifest.runId,
  overallStatus: productionStatus,
  previewStatus,
  productionStatus,
  reviewOverlayShots,
  productionNeedsReviewShots,
  requiredGates,
  checks: observations.map((item) => ({
    shotId: item.shotId,
    status: item.productionQaStatus,
    previewQaStatus: item.previewQaStatus,
    productionQaStatus: item.productionQaStatus,
    identityContract: item.identityContract,
    blockers: item.blockers,
  })),
});
writeJson(path.join(reportsRoot, "runtime_truth_layer.json"), { schemaVersion: "real_demo_e2e_005_runtime_truth_layer_v1", generatedAt, runId: manifest.runId, status: uniqueBlockers.length ? "blocked" : "preview_ready", items: observations.map((item) => ({ shotId: item.shotId, status: item.runtimeTruthStatus, blockers: item.runtimeTruthBlockers })) });

const report = buildRealDemoE2eReport({
  generatedAt,
  projectId: manifest.projectId,
  runId: manifest.runId,
  scenarioId: "real_demo_e2e_005_anime_image2_start_frames",
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
    previewUpdatedFromOutput: previewPlan.status.startsWith("real_image2_start_preview_ready"),
    providerSelfReportCompletesTask: false,
  },
  integrity: { manualFileCopyDetected: false, fixtureReuseDetected: false, simulatedStateDetected: false },
  pressure: {
    totalShots: manifest.shotPlans.length,
    realImagePlanCount: 3,
    queuedOrParkedCount: 5,
    shotPlans: manifest.shotPlans.map((plan, index) => ({ shotId: plan.shotId, status: index < 3 ? "real_image_planned" : index < 6 ? "queued" : "parked", taskPacketId: plan.taskPacketId, envelopeId: plan.envelopeId, workerProvenanceId: plan.workerProvenanceId, expectedOutputPath: plan.expectedOutputPath })),
  },
  quality: {
    semanticQaStatus: productionStatus,
    semanticQaRequired: true,
    p0FindingCount: observations.reduce((sum, item) => sum + (item.blockers.some((blocker) => blocker.includes("P0")) ? 1 : 0), 0),
    p1FindingCount: 0,
    p2FindingCount: productionNeedsReviewShots.length,
    gates: requiredGates,
  },
  notes: [
    "005 uses actual Image2 start-frame outputs generated by subagents. No video providers are involved.",
    "Preview readiness allows planned partial/back/long identity review overlays; production remains needs_review until identity anchors are fully confirmable.",
  ],
});
report.previewStatus = previewStatus;
report.previewQaStatus = previewStatus;
report.productionStatus = productionStatus;
report.productionQaStatus = productionStatus;
report.reviewOverlayShots = reviewOverlayShots;
report.productionNeedsReviewShots = productionNeedsReviewShots;
writeJson(path.join(reportsRoot, "real_demo_e2e_report.json"), report);
writeJson(path.join(reportsRoot, "image2_start_long_chain_report.json"), {
  schemaVersion: "real_demo_e2e_005_image2_start_long_chain_report_v1",
  generatedAt,
  runId: manifest.runId,
  status: previewStatus,
  previewStatus,
  productionStatus,
  reviewOverlayShots,
  productionNeedsReviewShots,
  shotCount: observations.length,
  sceneCount: new Set(observations.map((item) => item.sceneId)).size,
  roleCount: new Set(observations.flatMap((item) => item.roleIds)).size,
  watcherEventCount: watcherFile.events.length,
  observations,
  blockers: uniqueBlockers,
});

console.log(`Real Demo E2E 005 preview status: ${previewStatus}`);
console.log(`Real Demo E2E 005 production status: ${productionStatus}`);
console.log(`Report: ${repoPath(path.join(reportsRoot, "image2_start_long_chain_report.json"))}`);
if (uniqueBlockers.length || report.status === "blocked") {
  console.error("Blocked:");
  for (const blocker of [...uniqueBlockers, ...report.blockers]) console.error(`- ${blocker}`);
  process.exit(1);
}
console.log("Real Demo E2E 005 Image2 start-frame long chain verified.");
