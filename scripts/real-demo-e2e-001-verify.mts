import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import { buildFreshRunContract } from "../src/core/freshRunContract.ts";
import { buildRuntimeTruthLayer } from "../src/core/runtimeTruthLayer.ts";
import { buildRuntimeTruthWatcherEvents } from "../src/core/runtimeTruthIngest.ts";
import { buildRealDemoE2eReport } from "../src/core/realDemoE2e.ts";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/001");
const reportsRoot = path.join(runRoot, "reports");
const manifestPath = path.join(runRoot, "run_manifest.json");
const requiredSemanticGates = ["identity", "scene", "style", "story", "neighbor", "output"];

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

function runtimeTruthGateStatus(status) {
  if (status === "pass") return "pass";
  if (status === "needs_review") return "warn";
  if (status === "blocked") return "blocked";
  return "missing";
}

function normalizeSeverity(value) {
  const severity = String(value || "").toUpperCase();
  return ["P0", "P1", "P2"].includes(severity) ? severity : null;
}

function normalizeFinding(value, fallback) {
  if (typeof value === "string") {
    return {
      gateId: fallback.gateId,
      severity: fallback.severity,
      message: value,
      source: fallback.source,
    };
  }
  if (!value || typeof value !== "object") return null;
  return {
    gateId: value.gateId || fallback.gateId,
    severity: normalizeSeverity(value.severity) || fallback.severity,
    message: value.message || value.summary || value.note || fallback.message,
    source: value.source || fallback.source,
  };
}

function dedupeFindings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [
      item.severity || "",
      item.gateId || "",
      String(item.message || "").trim().toLowerCase(),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function loadSemanticQa(plan) {
  const emptyResult = (blocker) => ({
    exists: false,
    completed: false,
    status: "blocked",
    qa: null,
    gates: {},
    blockers: [blocker],
    findings: { P0: [], P1: [], P2: [] },
  });

  if (!plan.semanticQaPath) return emptyResult("semantic QA path missing from manifest");

  const semanticQaPath = absPath(plan.semanticQaPath);
  if (!exists(semanticQaPath)) return emptyResult("semantic QA sidecar missing");

  const qa = readJson(semanticQaPath);
  const gateResults = qa.gateResults || {};
  const findings = { P0: [], P1: [], P2: [] };
  const gates = {};
  const blockers = [
    qa.semanticReviewMode === "actual_image_semantic_review" ? "" : "semanticReviewMode is not actual_image_semantic_review",
    qa.runId === manifest.runId ? "" : "semantic QA runId mismatch",
    qa.outputPath === plan.expectedOutputPath ? "" : "semantic QA outputPath does not match expected output",
    qa.taskRunId === plan.taskRunId ? "" : "semantic QA taskRunId mismatch",
    qa.taskPacketId === plan.taskPacketId ? "" : "semantic QA taskPacketId mismatch",
    qa.envelopeId === plan.envelopeId ? "" : "semantic QA envelopeId mismatch",
    isFilled(qa.reviewerId) ? "" : "semantic QA reviewerId missing",
    isFilled(qa.reviewedAt) ? "" : "semantic QA reviewedAt missing",
    isFilled(qa.reviewedOutputSha256 || qa.reviewedImageHash) ? "" : "semantic QA reviewedOutputSha256 missing",
  ].filter(Boolean);

  for (const gateId of requiredSemanticGates) {
    const gate = gateResults[gateId] || (qa.gates ? { status: qa.gates[gateId], findings: [] } : null);
    if (!gate) {
      blockers.push(`semantic QA gate missing: ${gateId}`);
      gates[gateId] = { present: false, status: "missing", severity: null, findings: [] };
      continue;
    }

    const status = gate.status;
    const severity = normalizeSeverity(gate.severity);
    const gateFindings = Array.isArray(gate.findings) ? gate.findings : [];
    const normalizedFindings = gateFindings
      .map((finding) => normalizeFinding(finding, { gateId, severity, source: "gateResults", message: `${gateId} finding` }))
      .filter(Boolean);

    if (!["pass", "needs_review", "blocked"].includes(status)) {
      blockers.push(`semantic QA gate ${gateId} is not completed`);
    }
    if (severity && normalizedFindings.length === 0) {
      normalizedFindings.push({
        gateId,
        severity,
        message: gate.evidence || `${gateId} gate recorded ${severity}`,
        source: "gateSeverity",
      });
    }
    if (status === "blocked" && !normalizedFindings.some((finding) => finding.severity === "P0")) {
      normalizedFindings.push({
        gateId,
        severity: "P0",
        message: `${gateId} gate status is blocked`,
        source: "gateStatus",
      });
    }
    if (status === "needs_review" && !normalizedFindings.some((finding) => finding.severity === "P1")) {
      normalizedFindings.push({
        gateId,
        severity: "P1",
        message: `${gateId} gate status is needs_review`,
        source: "gateStatus",
      });
    }

    for (const finding of normalizedFindings) {
      if (finding.severity) findings[finding.severity].push(finding);
    }

    gates[gateId] = {
      present: true,
      status,
      severity,
      findings: normalizedFindings,
    };
  }

  for (const severity of ["P0", "P1", "P2"]) {
    const finalFindings = qa.finalAssessment?.[`${severity.toLowerCase()}Findings`];
    if (!Array.isArray(finalFindings)) continue;
    for (const finding of finalFindings) {
      const normalized = normalizeFinding(finding, {
        gateId: "finalAssessment",
        severity,
        source: "finalAssessment",
        message: `${severity} final assessment finding`,
      });
      if (normalized) findings[severity].push(normalized);
    }
  }

  const completed = blockers.length === 0;
  const status = !completed || findings.P0.length
    ? "blocked"
    : findings.P1.length
      ? "needs_review"
      : "pass";

  return {
    exists: true,
    completed,
    status,
    qa,
    semanticQaInfo: fileInfo(semanticQaPath),
    gates,
    blockers,
    findings: {
      P0: dedupeFindings(findings.P0),
      P1: dedupeFindings(findings.P1),
      P2: dedupeFindings(findings.P2),
    },
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
      envelope.expectedOutputContract?.semanticQaPath === plan.semanticQaPath &&
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
const realPlans = manifest.shotPlans.filter((plan) => plan.status === "real_image_planned");
const allPlans = manifest.shotPlans;
const runtimeTruthWatcherPath = manifest.runtimeTruthWatcherPath || realPlans.find((plan) => plan.runtimeTruthWatcherPath)?.runtimeTruthWatcherPath;
const runtimeTruthWatcherEventsFile = runtimeTruthWatcherPath ? absPath(runtimeTruthWatcherPath) : null;
const runtimeTruthWatcherFileExists = Boolean(runtimeTruthWatcherEventsFile && exists(runtimeTruthWatcherEventsFile));
const runtimeTruthWatcherFile = runtimeTruthWatcherFileExists ? readJson(runtimeTruthWatcherEventsFile) : null;

function watcherEventsForPlan(plan) {
  if (!runtimeTruthWatcherFileExists) return null;
  const events = Array.isArray(runtimeTruthWatcherFile?.events) ? runtimeTruthWatcherFile.events : [];
  return events.filter((event) =>
    event.runId === manifest.runId &&
    event.taskRunId === plan.taskRunId &&
    event.taskPacketId === plan.taskPacketId &&
    event.envelopeId === plan.envelopeId &&
    (!event.outputPath || event.outputPath === plan.expectedOutputPath) &&
    (!event.artifactPath || event.artifactPath === plan.expectedOutputPath)
  );
}

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
  const semanticQaResult = loadSemanticQa(plan);
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
    semanticQa: {
      sidecarPath: plan.semanticQaPath,
      exists: semanticQaResult.exists,
      sidecarModifiedAt: semanticQaResult.semanticQaInfo?.modifiedAt,
      reviewedAt: semanticQaResult.qa?.reviewedAt,
      taskRunId: semanticQaResult.qa?.taskRunId,
      taskPacketId: semanticQaResult.qa?.taskPacketId,
      envelopeId: semanticQaResult.qa?.envelopeId,
      outputPath: semanticQaResult.qa?.outputPath,
      outputSha256: semanticQaResult.qa?.outputSha256,
      reviewedOutputSha256: semanticQaResult.qa?.reviewedOutputSha256 || semanticQaResult.qa?.reviewedImageHash,
    },
    semanticQaRequired: true,
  });
  const runtimeTruthQaGates = Object.fromEntries(requiredSemanticGates.map((gateId) => [
    gateId,
    runtimeTruthGateStatus(semanticQaResult.gates[gateId]?.status),
  ]));
  const verifyScanIngest = buildRuntimeTruthWatcherEvents({
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
    semanticQa: semanticQaResult.exists
      ? {
          exists: true,
          sidecarPath: plan.semanticQaPath,
          pairedAt: semanticQaResult.semanticQaInfo?.modifiedAt,
          outputSha256: semanticQaResult.qa?.reviewedOutputSha256 || semanticQaResult.qa?.reviewedImageHash,
        }
      : undefined,
  });
  const watcherEvents = watcherEventsForPlan(plan);
  const runtimeTruthIngest = watcherEvents
    ? {
        schemaVersion: runtimeTruthWatcherFile.schemaVersion || "real_demo_e2e_001_runtime_truth_watcher_events_v1",
        generatedAt: runtimeTruthWatcherFile.generatedAt || generatedAt,
        sourceKind: "app_server_fs_changed",
        binding: {
          runId: manifest.runId,
          taskRunId: plan.taskRunId,
          taskPacketId: plan.taskPacketId,
          envelopeId: plan.envelopeId,
          outputPath: plan.expectedOutputPath,
          outputSha256,
        },
        events: watcherEvents,
        blockers: watcherEvents.length ? [] : ["runtime_truth_watcher_events_missing_for_plan"],
        warnings: [],
        notes: [`Loaded runtime truth watcher events from ${runtimeTruthWatcherPath}.`],
      }
    : verifyScanIngest;
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
    semanticQa: {
      sidecarPath: plan.semanticQaPath,
      exists: semanticQaResult.exists,
      sidecarModifiedAt: semanticQaResult.semanticQaInfo?.modifiedAt,
      reviewedAt: semanticQaResult.qa?.reviewedAt,
      runId: semanticQaResult.qa?.runId,
      taskRunId: semanticQaResult.qa?.taskRunId,
      taskPacketId: semanticQaResult.qa?.taskPacketId,
      envelopeId: semanticQaResult.qa?.envelopeId,
      outputPath: semanticQaResult.qa?.outputPath,
      outputSha256: semanticQaResult.qa?.outputSha256,
      reviewedOutputSha256: semanticQaResult.qa?.reviewedOutputSha256 || semanticQaResult.qa?.reviewedImageHash,
      gates: runtimeTruthQaGates,
      severityCounts: {
        p0: semanticQaResult.findings.P0.length,
        p1: semanticQaResult.findings.P1.length,
        p2: semanticQaResult.findings.P2.length,
      },
    },
    watcherEvents: runtimeTruthIngest.events,
  });
  const providerFreshBlockers = blockersForPrefix(freshRunContract.blockers, "fresh_run_provider_observation");
  const semanticQaFreshBlockers = blockersForPrefix(freshRunContract.blockers, "fresh_run_semantic_qa");
  const freshRunBlockers = freshRunContract.blockers;
  return {
    shotId: plan.shotId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    expectedOutputPath: plan.expectedOutputPath,
    providerObservationPath: plan.providerObservationPath,
    semanticQaPath: plan.semanticQaPath,
    runtimeTruthWatcherPath: plan.runtimeTruthWatcherPath || runtimeTruthWatcherPath,
    runtimeTruthWatcherFileUsed: runtimeTruthWatcherFileExists,
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
    semanticQaExists: semanticQaResult.exists,
    semanticQaCompleted: semanticQaResult.completed && semanticQaFreshBlockers.length === 0,
    semanticQaStatus: semanticQaResult.status,
    semanticQaBlockers: Array.from(new Set([...semanticQaResult.blockers, ...semanticQaFreshBlockers])),
    semanticQaFindings: semanticQaResult.findings,
    semanticQaGates: semanticQaResult.gates,
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
    "001 verify projects RuntimeTruthLayer from output, provider observation, semantic QA, and watcher facts.",
    runtimeTruthWatcherFileExists
      ? `RuntimeTruth watcher events were loaded from ${runtimeTruthWatcherPath}.`
      : "No runtimeTruthWatcherPath file was present; verify_scan fallback was used and remains blocked by RuntimeTruth source gates.",
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
      semanticQaPath: item.semanticQaPath,
      sourceKind: item.runtimeTruthWatcherFileUsed ? "app_server_fs_changed" : "verify_scan",
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
    outputObservations.every((item) => item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent && item.scopedOutput && item.workerProvenanceValid && item.providerObservationValid && item.semanticQaCompleted)
    ? "matched"
    : "blocked",
  matches: outputObservations.map((item) => ({
    shotId: item.shotId,
    expectedOutputPath: item.expectedOutputPath,
    outputExists: item.outputExists,
    scopedOutput: item.scopedOutput,
    workerProvenanceValid: item.workerProvenanceValid,
    providerObservationValid: item.providerObservationValid,
    semanticQaCompleted: item.semanticQaCompleted,
    runtimeTruthReady: item.runtimeTruthLayer.status === "preview_ready",
    status: item.runtimeTruthLayer.status === "preview_ready" && item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent && item.scopedOutput && item.workerProvenanceValid && item.providerObservationValid && item.semanticQaCompleted ? "matched" : "blocked",
    blockers: [
      item.runtimeTruthLayer.status === "preview_ready" ? "" : "runtime truth layer blocked",
      item.outputExists ? "" : "expected output missing",
      item.outputImageInfo.mediaReadable ? "" : "expected output is not a readable PNG/JPEG image",
      item.outputCurrent ? "" : "expected output is stale for this prepared run",
      item.scopedOutput ? "" : "output is outside scoped sandbox",
      item.workerProvenanceValid ? "" : "worker provenance invalid or missing",
      item.providerObservationValid ? "" : "provider observation invalid or missing",
      item.semanticQaCompleted ? "" : "semantic QA incomplete or missing",
      ...item.freshRunBlockers,
      ...item.workerProvenanceBlockers,
      ...item.providerObservationBlockers,
      ...item.semanticQaBlockers,
      ...item.runtimeTruthBlockers,
    ].filter(Boolean),
  })),
};

writeJson(path.join(reportsRoot, "manifest_match.json"), manifestMatch);

const qaReport = {
  schemaVersion: "real_demo_e2e_001_qa_report_v1",
  generatedAt,
  runId: manifest.runId,
  overallStatus: manifestMatch.status === "matched"
    ? outputObservations.some((item) => item.semanticQaStatus === "needs_review")
      ? "needs_review"
      : "pass"
    : "blocked",
  note:
    "This verify script requires a hash-bound semantic QA sidecar before RuntimeTruthLayer can pass.",
  checks: outputObservations.map((item) => ({
    shotId: item.shotId,
    status: item.runtimeTruthLayer.status === "preview_ready" && item.outputExists && item.outputImageInfo.mediaReadable && item.outputCurrent && item.scopedOutput && item.workerProvenanceValid && item.providerObservationValid && item.semanticQaCompleted
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
      semanticQaCompleted: item.semanticQaCompleted,
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
      item.semanticQaCompleted ? "" : "semantic QA is incomplete",
      ...item.freshRunBlockers,
      ...item.workerProvenanceBlockers,
      ...item.providerObservationBlockers,
      ...item.semanticQaBlockers,
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
  quality: {
    semanticQaStatus: qaReport.overallStatus === "pass" ? "pass" : qaReport.overallStatus === "needs_review" ? "needs_review" : "blocked",
    semanticQaRequired: true,
    p0FindingCount: outputObservations.reduce((sum, item) => sum + item.semanticQaFindings.P0.length, 0),
    p1FindingCount: outputObservations.reduce((sum, item) => sum + item.semanticQaFindings.P1.length, 0),
    p2FindingCount: outputObservations.reduce((sum, item) => sum + item.semanticQaFindings.P2.length, 0),
    gates: requiredSemanticGates,
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
