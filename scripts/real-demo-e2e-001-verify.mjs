import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/001");
const reportsRoot = path.join(runRoot, "reports");
const manifestPath = path.join(runRoot, "run_manifest.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function repoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function absPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

async function importTs(tsPath) {
  const source = fs.readFileSync(tsPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: tsPath,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(tsPath).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

async function importRuntimeTruthLayer() {
  const freshRunPath = path.join(repoRoot, "src/core/freshRunContract.ts");
  const freshRunOutput = ts.transpileModule(fs.readFileSync(freshRunPath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: freshRunPath,
  }).outputText;
  const freshRunUrl = `data:text/javascript;base64,${Buffer.from(`${freshRunOutput}\n//# sourceURL=${pathToFileURL(freshRunPath).href}`).toString("base64")}`;
  const runtimeTruthPath = path.join(repoRoot, "src/core/runtimeTruthLayer.ts");
  const runtimeTruthOutput = ts.transpileModule(fs.readFileSync(runtimeTruthPath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: runtimeTruthPath,
  }).outputText.replace(/from ["']\.\/freshRunContract["'];/g, `from "${freshRunUrl}";`);
  const encoded = Buffer.from(`${runtimeTruthOutput}\n//# sourceURL=${pathToFileURL(runtimeTruthPath).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function fileInfo(filePath) {
  if (!exists(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function sha256File(filePath) {
  if (!exists(filePath)) return undefined;
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function imageFileInfo(filePath) {
  if (!exists(filePath)) return { mediaKind: "unknown", mediaFormat: "unknown", mediaReadable: false, width: 0, height: 0 };
  const buffer = fs.readFileSync(filePath);
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length >= 24 && buffer.subarray(0, 8).toString("hex") === pngSignature) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { mediaKind: "image", mediaFormat: "png", mediaReadable: width > 0 && height > 0, width, height };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { mediaKind: "image", mediaFormat: "jpeg", mediaReadable: width > 0 && height > 0, width, height };
      }
      offset += 2 + length;
    }
  }
  return { mediaKind: "unknown", mediaFormat: "unknown", mediaReadable: false, width: 0, height: 0 };
}

function isScopedOutput(relativePath) {
  const absolute = path.resolve(absPath(relativePath));
  const scopedRoot = path.resolve(path.join(runRoot, "outputs/shots"));
  return absolute === scopedRoot || absolute.startsWith(`${scopedRoot}${path.sep}`);
}

function blockersForPrefix(blockers, prefix) {
  return blockers.filter((blocker) => blocker.startsWith(prefix));
}

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("FILL_BY");
}

function loadObservation(plan) {
  const observationPath = absPath(plan.providerObservationPath);
  if (!exists(observationPath)) return { exists: false, valid: false, observation: null, blockers: ["provider observation sidecar missing"] };
  const observation = readJson(observationPath);
  const blockers = [
    observation.providerObservationMode === "actual_provider_call_observed" ? "" : "providerObservationMode is not actual_provider_call_observed",
    String(observation.provider || "").includes("image2") ? "" : "provider is not image2",
    observation.outputPath === plan.expectedOutputPath ? "" : "observation outputPath does not match expected output",
    observation.taskRunId === plan.taskRunId ? "" : "observation taskRunId mismatch",
    observation.taskPacketId === plan.taskPacketId ? "" : "observation taskPacketId mismatch",
    observation.envelopeId === plan.envelopeId ? "" : "observation envelopeId mismatch",
    observation.subagentId && observation.subagentId !== "FILL_BY_IMAGEGEN_SUBAGENT" ? "" : "observation subagentId missing",
    observation.providerSelfReportCompletesTask === false ? "" : "provider self-report attempted to complete task",
    observation.manualFileCopyDetected === false ? "" : "manual file copy detected by observation",
    observation.fixtureReuseDetected === false ? "" : "fixture reuse detected by observation",
  ].filter(Boolean);
  return { exists: true, valid: blockers.length === 0, observation, observationInfo: fileInfo(observationPath), blockers };
}

function loadWorkerLease(plan) {
  if (!plan.workerProvenancePath) {
    return { exists: false, valid: false, lease: null, leaseInfo: null, blockers: ["worker provenance path missing from manifest"] };
  }
  const leasePath = absPath(plan.workerProvenancePath);
  if (!exists(leasePath)) {
    return { exists: false, valid: false, lease: null, leaseInfo: null, blockers: ["worker provenance sidecar missing"] };
  }
  const lease = readJson(leasePath);
  const blockers = [
    lease.sidecarKind === "worker_provenance" ? "" : "worker provenance sidecarKind mismatch",
    lease.provenanceMode === "actual_subagent_worker_lease_observed" ? "" : "worker provenance mode is not actual_subagent_worker_lease_observed",
    lease.runId === manifest.runId ? "" : "worker provenance runId mismatch",
    isFilled(lease.leaseId) ? "" : "worker provenance leaseId missing",
    isFilled(lease.workerId) ? "" : "worker provenance workerId missing",
    isFilled(lease.subagentId) ? "" : "worker provenance subagentId missing",
    isFilled(lease.threadId) ? "" : "worker provenance threadId missing",
    isFilled(lease.turnId) ? "" : "worker provenance turnId missing",
    isFilled(lease.toolCallId) ? "" : "worker provenance toolCallId missing",
    lease.taskRunId === plan.taskRunId ? "" : "worker provenance taskRunId mismatch",
    lease.taskPacketId === plan.taskPacketId ? "" : "worker provenance taskPacketId mismatch",
    lease.envelopeId === plan.envelopeId ? "" : "worker provenance envelopeId mismatch",
    lease.outputPath === plan.expectedOutputPath ? "" : "worker provenance outputPath mismatch",
    isFilled(lease.leaseStartedAt) ? "" : "worker provenance leaseStartedAt missing",
    isFilled(lease.leaseExpiresAt) ? "" : "worker provenance leaseExpiresAt missing",
    Number.isInteger(lease.retryBudget) && lease.retryBudget >= 0 ? "" : "worker provenance retryBudget missing",
  ].filter(Boolean);
  const leaseInfo = fileInfo(leasePath);
  return {
    exists: true,
    valid: blockers.length === 0,
    lease: { ...lease, exists: true, sidecarKind: "worker_provenance", sidecarPath: plan.workerProvenancePath, sidecarModifiedAt: leaseInfo?.modifiedAt },
    leaseInfo,
    blockers,
  };
}

function envelopeIsValid(plan) {
  const envelopePath = absPath(plan.envelopePath);
  const packetPath = absPath(plan.packetPath);
  const promptPath = absPath(plan.promptRequestPath);
  if (!exists(envelopePath) || !exists(packetPath) || !exists(promptPath)) return false;
  const envelope = readJson(envelopePath);
  return Boolean(
    envelope.sourceIndexHash &&
      envelope.taskRunId === plan.taskRunId &&
      envelope.taskPacketId === plan.taskPacketId &&
      envelope.envelopeId === plan.envelopeId &&
      envelope.expectedOutputContract?.outputPath === plan.expectedOutputPath &&
      envelope.expectedOutputContract?.providerObservationPath === plan.providerObservationPath &&
      Array.isArray(envelope.neighborShots ? [envelope.neighborShots] : []) &&
      Array.isArray(envelope.mustPreserve) &&
      envelope.mustPreserve.length &&
      Array.isArray(envelope.mustAvoid) &&
      envelope.mustAvoid.length &&
      Array.isArray(envelope.qaChecklist) &&
      envelope.qaChecklist.length,
  );
}

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 001 run_manifest.json is missing. Run npm run real-demo-e2e-001:prepare first.");
  process.exit(1);
}

ensureDir(reportsRoot);

const generatedAt = new Date().toISOString();
const manifest = readJson(manifestPath);
const { buildFreshRunContract } = await importTs(path.join(repoRoot, "src/core/freshRunContract.ts"));
const { buildRuntimeTruthLayer } = await importRuntimeTruthLayer();
const { buildRuntimeTruthWatcherEvents } = await importTs(path.join(repoRoot, "src/core/runtimeTruthIngest.ts"));
const realPlans = manifest.shotPlans.filter((plan) => plan.status === "real_image_planned");
const allPlans = manifest.shotPlans;

const projectFacts = {
  projectVibePresent: exists(absPath(manifest.projectFacts.projectVibePath)),
  sourceIndexPresent: exists(absPath(manifest.projectFacts.sourceIndexPath)),
  visualMemoryPresent: exists(absPath(manifest.projectFacts.visualMemoryPath)),
  shotLayoutPresent: exists(absPath(manifest.projectFacts.shotLayoutRoot)) &&
    allPlans.every((plan) => exists(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`))),
};

const outputObservations = realPlans.map((plan) => {
  const outputAbsolutePath = absPath(plan.expectedOutputPath);
  const outputInfo = fileInfo(outputAbsolutePath);
  const outputImageInfo = imageFileInfo(outputAbsolutePath);
  const outputSha256 = outputInfo ? sha256File(outputAbsolutePath) : undefined;
  const observationResult = loadObservation(plan);
  const workerLeaseResult = loadWorkerLease(plan);
  const freshRunContract = buildFreshRunContract({
    generatedAt,
    runId: manifest.runId,
    manifestGeneratedAt: manifest.generatedAt,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    outputPath: plan.expectedOutputPath,
    artifact: {
      artifactPath: plan.expectedOutputPath,
      exists: Boolean(outputInfo),
      fileModifiedAt: outputInfo?.modifiedAt,
      sizeBytes: outputInfo?.sizeBytes,
      outputSha256,
      ...outputImageInfo,
    },
    providerObservation: {
      sidecarPath: plan.providerObservationPath,
      exists: observationResult.exists,
      sidecarModifiedAt: observationResult.observationInfo?.modifiedAt,
      sidecarGeneratedAt: observationResult.observation?.generatedAt,
      taskRunId: observationResult.observation?.taskRunId,
      taskPacketId: observationResult.observation?.taskPacketId,
      envelopeId: observationResult.observation?.envelopeId,
      outputPath: observationResult.observation?.outputPath,
      outputSha256: observationResult.observation?.outputSha256,
    },
    providerObservationRequired: true,
    semanticQaRequired: false,
  });
  const runtimeTruthIngest = buildRuntimeTruthWatcherEvents({
    generatedAt,
    sourceKind: "verify_scan",
    eventIdPrefix: `runtime_truth_real_demo_001_${plan.shotId}`,
    binding: {
      runId: manifest.runId,
      taskRunId: plan.taskRunId,
      taskPacketId: plan.taskPacketId,
      envelopeId: plan.envelopeId,
      outputPath: plan.expectedOutputPath,
      outputSha256,
    },
    file: {
      exists: Boolean(outputInfo),
      stable: Boolean(outputInfo),
      outputPath: plan.expectedOutputPath,
      outputSha256,
      observedAt: outputInfo?.modifiedAt,
      stableAt: outputInfo?.modifiedAt,
      hashRecordedAt: outputInfo?.modifiedAt,
    },
    providerObservation: observationResult.exists
      ? {
          exists: true,
          sidecarPath: plan.providerObservationPath,
          pairedAt: observationResult.observationInfo?.modifiedAt,
          outputSha256: observationResult.observation?.outputSha256,
        }
      : undefined,
  });
  const runtimeTruthLayer = buildRuntimeTruthLayer({
    generatedAt,
    runId: manifest.runId,
    manifestGeneratedAt: manifest.generatedAt,
    taskRunId: plan.taskRunId,
    shotId: plan.shotId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    expectedOutputPath: plan.expectedOutputPath,
    artifact: {
      artifactPath: plan.expectedOutputPath,
      exists: Boolean(outputInfo),
      fileModifiedAt: outputInfo?.modifiedAt,
      sizeBytes: outputInfo?.sizeBytes,
      outputSha256,
      ...outputImageInfo,
    },
    workerLease: workerLeaseResult.valid ? workerLeaseResult.lease : undefined,
    providerObservation: {
      sidecarPath: plan.providerObservationPath,
      exists: observationResult.exists,
      sidecarModifiedAt: observationResult.observationInfo?.modifiedAt,
      generatedAt: observationResult.observation?.generatedAt,
      runId: observationResult.observation?.runId,
      taskRunId: observationResult.observation?.taskRunId,
      taskPacketId: observationResult.observation?.taskPacketId,
      envelopeId: observationResult.observation?.envelopeId,
      outputPath: observationResult.observation?.outputPath,
      outputSha256: observationResult.observation?.outputSha256,
      providerId: observationResult.observation?.provider || observationResult.observation?.providerId,
      workerId: observationResult.observation?.workerId,
      subagentId: observationResult.observation?.subagentId,
      threadId: observationResult.observation?.threadId,
      turnId: observationResult.observation?.turnId,
      toolCallId: observationResult.observation?.toolCallId,
      providerObservationMode: observationResult.observation?.providerObservationMode,
      manualFileCopyDetected: observationResult.observation?.manualFileCopyDetected === true,
      fixtureReuseDetected: observationResult.observation?.fixtureReuseDetected === true,
      providerSelfReportedComplete: observationResult.observation?.providerSelfReportedComplete === true ||
        observationResult.observation?.providerSelfReportCompletesTask === true,
      providerSelfReportCompletesTask: observationResult.observation?.providerSelfReportCompletesTask === true,
    },
    semanticQa: undefined,
    watcherEvents: runtimeTruthIngest.events,
  });
  const providerFreshBlockers = blockersForPrefix(freshRunContract.blockers, "fresh_run_provider_observation");
  const freshRunBlockers = freshRunContract.blockers;
  return {
    shotId: plan.shotId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    expectedOutputPath: plan.expectedOutputPath,
    providerObservationPath: plan.providerObservationPath,
    outputExists: Boolean(outputInfo),
    outputInfo,
    outputImageInfo,
    outputSha256,
    outputCurrent: freshRunContract.verification.artifactFresh,
    scopedOutput: isScopedOutput(plan.expectedOutputPath),
    envelopeValid: envelopeIsValid(plan),
    providerObservationExists: observationResult.exists,
    providerObservationValid: observationResult.valid && providerFreshBlockers.length === 0,
    providerObservationBlockers: Array.from(new Set([...observationResult.blockers, ...providerFreshBlockers])),
    providerObservation: observationResult.observation,
    workerProvenanceExists: workerLeaseResult.exists,
    workerProvenanceValid: workerLeaseResult.valid,
    workerProvenanceBlockers: workerLeaseResult.blockers,
    workerLease: workerLeaseResult.lease,
    freshRunContract,
    freshRunBlockers,
    runtimeTruthIngest,
    runtimeTruthLayer,
    runtimeTruthBlockers: runtimeTruthLayer.blockers,
  };
});

writeJson(path.join(reportsRoot, "runtime_truth_layer.json"), {
  schemaVersion: "real_demo_e2e_001_runtime_truth_layer_v1",
  generatedAt,
  runId: manifest.runId,
  status: outputObservations.length > 0 && outputObservations.every((item) => item.runtimeTruthLayer.status === "preview_ready")
    ? "preview_ready"
    : "blocked",
  items: outputObservations.map((item) => ({
    shotId: item.shotId,
    status: item.runtimeTruthLayer.status,
    lifecycle: item.runtimeTruthLayer.lifecycle,
    verification: item.runtimeTruthLayer.verification,
    blockers: item.runtimeTruthLayer.blockers,
    warnings: item.runtimeTruthLayer.warnings,
  })),
  notes: [
    "001 verify now projects RuntimeTruthLayer from the same scan facts used by freshness verification.",
    "Semantic QA is intentionally absent in 001, so RuntimeTruthLayer remains blocked until a hash-bound semantic QA receipt exists.",
  ],
});

const watcherEvents = {
  schemaVersion: "real_demo_e2e_001_watcher_events_v1",
  generatedAt,
  runId: manifest.runId,
  events: outputObservations
    .filter((item) => item.outputExists && item.outputCurrent)
    .map((item, index) => ({
      eventId: `watcher_event_real_demo_001_${String(index + 1).padStart(2, "0")}`,
      eventType: "expected_output_observed",
      shotId: item.shotId,
      artifactPath: item.expectedOutputPath,
      providerObservationPath: item.providerObservationPath,
      observedAt: generatedAt,
      file: item.outputInfo,
    })),
};

writeJson(path.join(reportsRoot, "watcher_events.json"), watcherEvents);

const runtimeTruthReadyAll = outputObservations.length > 0 &&
  outputObservations.every((item) => item.runtimeTruthLayer.status === "preview_ready");

const manifestMatch = {
  schemaVersion: "real_demo_e2e_001_manifest_match_v1",
  generatedAt,
  runId: manifest.runId,
  status: runtimeTruthReadyAll &&
    outputObservations.every((item) => item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent && item.scopedOutput && item.workerProvenanceValid && item.providerObservationValid)
    ? "matched"
    : "blocked",
  matches: outputObservations.map((item) => ({
    shotId: item.shotId,
    expectedOutputPath: item.expectedOutputPath,
    outputExists: item.outputExists,
    scopedOutput: item.scopedOutput,
    workerProvenanceValid: item.workerProvenanceValid,
    providerObservationValid: item.providerObservationValid,
    runtimeTruthReady: item.runtimeTruthLayer.status === "preview_ready",
    status: item.runtimeTruthLayer.status === "preview_ready" && item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent && item.scopedOutput && item.workerProvenanceValid && item.providerObservationValid ? "matched" : "blocked",
    blockers: [
      item.runtimeTruthLayer.status === "preview_ready" ? "" : "runtime truth layer blocked",
      item.outputExists ? "" : "expected output missing",
      item.outputImageInfo.mediaReadable ? "" : "expected output is not a readable PNG/JPEG image",
      item.outputCurrent ? "" : "expected output is stale for this prepared run",
      item.scopedOutput ? "" : "output is outside scoped sandbox",
      item.workerProvenanceValid ? "" : "worker provenance invalid or missing",
      item.providerObservationValid ? "" : "provider observation invalid or missing",
      ...item.freshRunBlockers,
      ...item.workerProvenanceBlockers,
      ...item.providerObservationBlockers,
      ...item.runtimeTruthBlockers,
    ].filter(Boolean),
  })),
};

writeJson(path.join(reportsRoot, "manifest_match.json"), manifestMatch);

const qaReport = {
  schemaVersion: "real_demo_e2e_001_qa_report_v1",
  generatedAt,
  runId: manifest.runId,
  overallStatus: manifestMatch.status === "matched" ? "needs_human_semantic_review" : "blocked",
  note:
    "This verify script performs return-path and provenance QA only. It does not perform semantic image critique; a human or visual QA subagent should review identity, scene, and style quality.",
  checks: outputObservations.map((item) => ({
    shotId: item.shotId,
    status: item.runtimeTruthLayer.status === "preview_ready" && item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent && item.scopedOutput && item.workerProvenanceValid && item.providerObservationValid
      ? "structural_pass_semantic_needs_review"
      : "blocked",
    gates: {
      outputExists: item.outputExists,
      nonEmptyFile: Boolean(item.outputInfo?.sizeBytes > 0),
      readableImage: item.outputImageInfo.mediaReadable,
      imageWidth: item.outputImageInfo.width,
      imageHeight: item.outputImageInfo.height,
      outputCurrent: item.outputCurrent,
      scopedSandbox: item.scopedOutput,
      envelopeValid: item.envelopeValid,
      workerProvenanceValid: item.workerProvenanceValid,
      providerObservationValid: item.providerObservationValid,
      runtimeTruthReady: item.runtimeTruthLayer.status === "preview_ready",
    },
    blockers: [
      item.runtimeTruthLayer.status === "preview_ready" ? "" : "runtime truth layer blocked",
      item.outputExists ? "" : "expected output missing",
      item.outputInfo?.sizeBytes > 0 ? "" : "output is empty or missing",
      item.outputImageInfo.mediaReadable ? "" : "output is not a readable PNG/JPEG image",
      item.outputCurrent ? "" : "expected output is stale for this prepared run",
      item.scopedOutput ? "" : "output path is not inside real-demo-e2e/001/outputs/shots",
      item.envelopeValid ? "" : "subagent envelope is incomplete",
      item.workerProvenanceValid ? "" : "worker provenance is incomplete",
      item.providerObservationValid ? "" : "provider observation is incomplete",
      ...item.freshRunBlockers,
      ...item.workerProvenanceBlockers,
      ...item.providerObservationBlockers,
      ...item.runtimeTruthBlockers,
    ].filter(Boolean),
  })),
};

writeJson(path.join(reportsRoot, "qa_report.json"), qaReport);

const previewPlan = {
  schemaVersion: "real_demo_e2e_001_preview_plan_v1",
  generatedAt,
  runId: manifest.runId,
  status: manifestMatch.status === "matched" ? "draft_preview_ready" : "blocked",
  totalDurationSeconds: allPlans.reduce((sum, plan) => {
    const shot = readJson(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`));
    return sum + (Number(shot?.durationSeconds) || 5);
  }, 0),
  clips: allPlans.map((plan, index) => {
    const returned = outputObservations.find((item) => item.shotId === plan.shotId);
    return {
      clipId: `preview_clip_${plan.shotId}`,
      order: index + 1,
      shotId: plan.shotId,
      mediaType: returned?.outputExists && returned?.outputCurrent ? "image_hold" : "placeholder",
      mediaPath: returned?.outputExists && returned?.outputCurrent ? plan.expectedOutputPath : null,
      status: returned?.outputExists && returned?.outputCurrent ? "returned" : plan.status,
      durationSeconds: 5,
    };
  }),
};

writeJson(path.join(reportsRoot, "preview_plan.json"), previewPlan);

const allOutputsExist = outputObservations.length > 0 && outputObservations.every((item) => item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent);
const allScoped = outputObservations.every((item) => item.scopedOutput);
const allEnvelopesValid = outputObservations.length > 0 && outputObservations.every((item) => item.envelopeValid);
const providerObservedAll = runtimeTruthReadyAll &&
  outputObservations.every((item) => item.outputExists && item.outputCurrent && item.providerObservationValid);
const firstValidWorkerLease = outputObservations.find((item) => item.workerProvenanceValid)?.workerLease;
const anyOutputWithoutObservation = outputObservations.some((item) => item.outputExists && !item.providerObservationValid);
const providerSelfReportCompletesTask = outputObservations.some((item) => item.providerObservation?.providerSelfReportCompletesTask === true);
const manualFileCopyDetected = anyOutputWithoutObservation ||
  outputObservations.some((item) => item.providerObservation?.manualFileCopyDetected === true);
const fixtureReuseDetected = outputObservations.some((item) => item.providerObservation?.fixtureReuseDetected === true);

const { buildRealDemoE2eReport } = await importTs(path.join(repoRoot, "src/core/realDemoE2e.ts"));

const report = buildRealDemoE2eReport({
  generatedAt,
  projectId: manifest.projectId,
  runId: manifest.runId,
  scenarioId: "real_demo_e2e_001",
  declaration: providerObservedAll ? "actual_provider_observed" : "readiness_harness_only",
  projectFacts,
  chain: {
    generatedByUiAction: exists(absPath(manifest.uiActionPath)),
    validatedEnvelope: allEnvelopesValid,
    workerProvenance: firstValidWorkerLease ? {
      workerId: firstValidWorkerLease.workerId,
      subagentId: firstValidWorkerLease.subagentId,
      taskRunId: firstValidWorkerLease.taskRunId,
      taskPacketId: firstValidWorkerLease.taskPacketId,
      envelopeId: firstValidWorkerLease.envelopeId,
      outputPath: firstValidWorkerLease.outputPath,
    } : undefined,
    providerCallObserved: providerObservedAll,
    providerObservationMode: providerObservedAll ? "actual_provider_call_observed" : "not_observed",
    outputCameFromScopedSandbox: allOutputsExist && allScoped,
    watcherEventObserved: runtimeTruthReadyAll,
    manifestMatched: manifestMatch.status === "matched",
    qaReportObserved: runtimeTruthReadyAll && allOutputsExist && qaReport.checks.length === outputObservations.length,
    previewUpdatedFromOutput: previewPlan.status === "draft_preview_ready",
    providerSelfReportCompletesTask,
  },
  integrity: {
    manualFileCopyDetected,
    fixtureReuseDetected,
    simulatedStateDetected: false,
  },
  pressure: {
    totalShots: allPlans.length,
    realImagePlanCount: realPlans.length,
    queuedOrParkedCount: allPlans.filter((plan) => plan.status === "queued" || plan.status === "parked").length,
    shotPlans: allPlans.map((plan) => ({
      shotId: plan.shotId,
      status: plan.status,
      taskPacketId: plan.taskPacketId,
      envelopeId: plan.envelopeId,
      workerProvenanceId: plan.workerProvenanceId,
      expectedOutputPath: plan.expectedOutputPath,
    })),
  },
  notes: [
    "Real Demo E2E 001 is Image2-first. No Seedance, Jimeng, Fast model, VIP channel, or video provider is accepted.",
    "Output existence plus provider observation sidecar is required before the return path can pass.",
    qaReport.note,
  ],
});

writeJson(path.join(reportsRoot, "real_demo_e2e_report.json"), report);

console.log(`Real Demo E2E 001 verify status: ${report.status}`);
console.log(`Report: ${repoPath(path.join(reportsRoot, "real_demo_e2e_report.json"))}`);
if (report.blockers.length) {
  console.error("Blocked:");
  for (const blocker of report.blockers) console.error(`- ${blocker}`);
  process.exit(1);
}

console.log("Real Demo E2E 001 return path verified with actual provider observation.");
