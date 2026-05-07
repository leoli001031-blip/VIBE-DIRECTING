import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/002-anime-pressure");
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

function fileInfo(filePath) {
  if (!exists(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function isScopedOutput(relativePath) {
  const absolute = path.resolve(absPath(relativePath));
  const scopedRoot = path.resolve(path.join(runRoot, "outputs/shots"));
  return absolute === scopedRoot || absolute.startsWith(`${scopedRoot}${path.sep}`);
}

function blockersForPrefix(blockers, prefix) {
  return blockers.filter((blocker) => blocker.startsWith(prefix));
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
  if (!exists(observationPath)) {
    return {
      exists: false,
      valid: false,
      observation: null,
      blockers: ["provider observation sidecar missing"],
    };
  }

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
    qa.outputPath === plan.expectedOutputPath ? "" : "semantic QA outputPath does not match expected output",
    qa.taskRunId === plan.taskRunId ? "" : "semantic QA taskRunId mismatch",
    qa.taskPacketId === plan.taskPacketId ? "" : "semantic QA taskPacketId mismatch",
    qa.envelopeId === plan.envelopeId ? "" : "semantic QA envelopeId mismatch",
    qa.reviewerId && qa.reviewerId !== "FILL_BY_SEMANTIC_QA_REVIEWER" ? "" : "semantic QA reviewerId missing",
    qa.reviewedAt && qa.reviewedAt !== "FILL_BY_SEMANTIC_QA_REVIEWER_ISO_TIME" ? "" : "semantic QA reviewedAt missing",
  ].filter(Boolean);

  for (const gateId of requiredSemanticGates) {
    const gate = gateResults[gateId];
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
      envelope.lockedReferences?.characters?.length &&
      envelope.lockedReferences?.scene?.id &&
      envelope.lockedReferences?.style?.id &&
      envelope.neighborShots?.current?.shotId === plan.shotId &&
      Array.isArray(envelope.mustPreserve) &&
      envelope.mustPreserve.length &&
      Array.isArray(envelope.mustAvoid) &&
      envelope.mustAvoid.length &&
      Array.isArray(envelope.qaChecklist) &&
      envelope.qaChecklist.length,
  );
}

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 002 Anime Pressure run_manifest.json is missing. Run npm run real-demo-e2e-002:prepare first.");
  process.exit(1);
}

ensureDir(reportsRoot);

const generatedAt = new Date().toISOString();
const manifest = readJson(manifestPath);
const { buildFreshRunContract } = await importTs(path.join(repoRoot, "src/core/freshRunContract.ts"));
const realPlans = manifest.shotPlans.filter((plan) => plan.status === "real_image_planned");
const allPlans = manifest.shotPlans;
const scenarioBlockers = [
  allPlans.length === 16 ? "" : "002 must contain exactly 16 shot plans",
  realPlans.length === 6 ? "" : "002 must contain exactly 6 planned real image shots",
  manifest.scenario?.scenes?.length === 3 ? "" : "002 must contain exactly 3 scenes",
  manifest.scenario?.roles?.length === 3 ? "" : "002 must contain exactly 3 roles",
].filter(Boolean);

const projectFacts = {
  projectVibePresent: exists(absPath(manifest.projectFacts.projectVibePath)),
  sourceIndexPresent: exists(absPath(manifest.projectFacts.sourceIndexPath)),
  visualMemoryPresent: exists(absPath(manifest.projectFacts.visualMemoryPath)),
  shotLayoutPresent:
    exists(absPath(manifest.projectFacts.shotLayoutRoot)) &&
    allPlans.every((plan) => exists(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`))),
};

const outputObservations = realPlans.map((plan) => {
  const outputAbsolutePath = absPath(plan.expectedOutputPath);
  const outputInfo = fileInfo(outputAbsolutePath);
  const observationResult = loadObservation(plan);
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
    outputExists: Boolean(outputInfo),
    outputInfo,
    outputCurrent: freshRunContract.verification.artifactFresh,
    scopedOutput: isScopedOutput(plan.expectedOutputPath),
    envelopeValid: envelopeIsValid(plan),
    providerObservationExists: observationResult.exists,
    providerObservationValid: observationResult.valid && providerFreshBlockers.length === 0,
    providerObservationBlockers: Array.from(new Set([...observationResult.blockers, ...providerFreshBlockers])),
    providerObservation: observationResult.observation,
    semanticQaExists: semanticQaResult.exists,
    semanticQaCompleted: semanticQaResult.completed && semanticQaFreshBlockers.length === 0,
    semanticQaStatus: semanticQaResult.status,
    semanticQaBlockers: Array.from(new Set([...semanticQaResult.blockers, ...semanticQaFreshBlockers])),
    semanticQaFindings: semanticQaResult.findings,
    semanticQaGates: semanticQaResult.gates,
    freshRunContract,
    freshRunBlockers,
  };
});

const watcherEvents = {
  schemaVersion: "real_demo_e2e_002_anime_pressure_watcher_events_v1",
  generatedAt,
  runId: manifest.runId,
  events: outputObservations
    .filter((item) => item.outputExists && item.outputCurrent)
    .map((item, index) => ({
      eventId: `watcher_event_real_demo_002_anime_${String(index + 1).padStart(2, "0")}`,
      eventType: "expected_output_observed",
      shotId: item.shotId,
      artifactPath: item.expectedOutputPath,
      providerObservationPath: item.providerObservationPath,
      semanticQaPath: item.semanticQaPath,
      observedAt: generatedAt,
      file: item.outputInfo,
    })),
};

writeJson(path.join(reportsRoot, "watcher_events.json"), watcherEvents);

const manifestMatch = {
  schemaVersion: "real_demo_e2e_002_anime_pressure_manifest_match_v1",
  generatedAt,
  runId: manifest.runId,
  status: scenarioBlockers.length === 0 &&
    outputObservations.every((item) => item.outputExists && item.outputCurrent && item.scopedOutput && item.providerObservationValid)
    ? "matched"
    : "blocked",
  matches: outputObservations.map((item) => ({
    shotId: item.shotId,
    expectedOutputPath: item.expectedOutputPath,
    providerObservationPath: item.providerObservationPath,
    semanticQaPath: item.semanticQaPath,
    outputExists: item.outputExists,
    scopedOutput: item.scopedOutput,
    providerObservationValid: item.providerObservationValid,
    status: item.outputExists && item.outputCurrent && item.scopedOutput && item.providerObservationValid ? "matched" : "blocked",
    blockers: [
      ...scenarioBlockers,
      item.outputExists ? "" : "expected output missing",
      item.outputCurrent ? "" : "expected output is stale for this prepared run",
      item.scopedOutput ? "" : "output is outside scoped sandbox",
      item.providerObservationValid ? "" : "provider observation invalid or missing",
      ...item.freshRunBlockers,
      ...item.providerObservationBlockers,
    ].filter(Boolean),
  })),
};

writeJson(path.join(reportsRoot, "manifest_match.json"), manifestMatch);

const qaChecks = outputObservations.map((item) => {
  const blockers = [
    ...scenarioBlockers,
    item.outputExists ? "" : "expected output missing",
    item.outputInfo?.sizeBytes > 0 ? "" : "output is empty or missing",
    item.outputCurrent ? "" : "expected output is stale for this prepared run",
    item.scopedOutput ? "" : "output path is not inside real-demo-e2e/002-anime-pressure/outputs/shots",
    item.envelopeValid ? "" : "subagent envelope is incomplete",
    item.providerObservationValid ? "" : "provider observation is incomplete",
    item.semanticQaExists ? "" : "semantic QA sidecar missing",
    item.semanticQaCompleted ? "" : "semantic QA sidecar is incomplete",
    item.semanticQaFindings.P0.length ? "semantic QA contains P0 findings" : "",
    ...item.freshRunBlockers,
    ...item.providerObservationBlockers,
    ...item.semanticQaBlockers,
  ].filter(Boolean);

  return {
    shotId: item.shotId,
    status: blockers.length || item.semanticQaStatus === "blocked"
      ? "blocked"
      : item.semanticQaStatus === "needs_review"
        ? "needs_review"
        : "pass",
    gates: {
      outputExists: item.outputExists,
      nonEmptyFile: Boolean(item.outputInfo?.sizeBytes > 0),
      outputCurrent: item.outputCurrent,
      scopedSandbox: item.scopedOutput,
      envelopeValid: item.envelopeValid,
      providerObservationValid: item.providerObservationValid,
      semanticQaCompleted: item.semanticQaCompleted,
      semanticQaRequiredGates: Object.fromEntries(requiredSemanticGates.map((gateId) => [
        gateId,
        item.semanticQaGates[gateId]?.status || "missing",
      ])),
    },
    semanticQaPath: item.semanticQaPath,
    semanticQaStatus: item.semanticQaStatus,
    semanticQaFindings: item.semanticQaFindings,
    blockers,
  };
});

const qaReport = {
  schemaVersion: "real_demo_e2e_002_anime_pressure_qa_report_v1",
  generatedAt,
  runId: manifest.runId,
  overallStatus: qaChecks.some((item) => item.status === "blocked")
    ? "blocked"
    : qaChecks.some((item) => item.status === "needs_review")
      ? "needs_review"
      : "pass",
  severityPolicy: {
    P0: "blocked",
    P1: "needs_review",
    P2: "record_only",
  },
  note:
    "Verify requires completed semantic QA for identity, scene, style, story, neighbor, and output gates. P0 blocks, P1 needs review, and P2 is recorded.",
  checks: qaChecks,
  totals: {
    plannedRealImages: realPlans.length,
    outputCount: outputObservations.filter((item) => item.outputExists && item.outputCurrent).length,
    providerObservationCount: outputObservations.filter((item) => item.providerObservationValid).length,
    semanticQaCompletedCount: outputObservations.filter((item) => item.semanticQaCompleted).length,
    p0FindingCount: outputObservations.reduce((sum, item) => sum + item.semanticQaFindings.P0.length, 0),
    p1FindingCount: outputObservations.reduce((sum, item) => sum + item.semanticQaFindings.P1.length, 0),
    p2FindingCount: outputObservations.reduce((sum, item) => sum + item.semanticQaFindings.P2.length, 0),
  },
};

writeJson(path.join(reportsRoot, "qa_report.json"), qaReport);

const previewPlan = {
  schemaVersion: "real_demo_e2e_002_anime_pressure_preview_plan_v1",
  generatedAt,
  runId: manifest.runId,
  status: manifestMatch.status !== "matched" || qaReport.overallStatus === "blocked"
    ? "blocked"
    : qaReport.overallStatus === "needs_review"
      ? "draft_preview_needs_review"
      : "draft_preview_ready",
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

const allOutputsExist = outputObservations.length > 0 && outputObservations.every((item) => item.outputExists && item.outputCurrent);
const allScoped = outputObservations.every((item) => item.scopedOutput);
const allEnvelopesValid = outputObservations.length > 0 && outputObservations.every((item) => item.envelopeValid);
const providerObservedAll =
  outputObservations.length > 0 &&
  outputObservations.every((item) => item.outputExists && item.outputCurrent && item.providerObservationValid);
const semanticQaCompletedAll =
  outputObservations.length > 0 && outputObservations.every((item) => item.semanticQaCompleted);
const firstValidObservation = outputObservations.find((item) => item.providerObservationValid)?.providerObservation;
const anyOutputWithoutObservation = outputObservations.some((item) => item.outputExists && !item.providerObservationValid);
const providerSelfReportCompletesTask = outputObservations.some((item) => item.providerObservation?.providerSelfReportCompletesTask === true);
const manualFileCopyDetected =
  anyOutputWithoutObservation || outputObservations.some((item) => item.providerObservation?.manualFileCopyDetected === true);
const fixtureReuseDetected = outputObservations.some((item) => item.providerObservation?.fixtureReuseDetected === true);

const { buildRealDemoE2eReport } = await importTs(path.join(repoRoot, "src/core/realDemoE2e.ts"));

const report = buildRealDemoE2eReport({
  generatedAt,
  projectId: manifest.projectId,
  runId: manifest.runId,
  scenarioId: "real_demo_e2e_002_anime_pressure",
  declaration: providerObservedAll ? "actual_provider_observed" : "readiness_harness_only",
  projectFacts,
  chain: {
    generatedByUiAction: exists(absPath(manifest.uiActionPath)),
    validatedEnvelope: allEnvelopesValid,
    workerProvenance: firstValidObservation
      ? {
          workerId: firstValidObservation.workerId || "imagegen_subagent_worker",
          subagentId: firstValidObservation.subagentId,
          taskRunId: firstValidObservation.taskRunId,
          taskPacketId: firstValidObservation.taskPacketId,
          envelopeId: firstValidObservation.envelopeId,
          outputPath: firstValidObservation.outputPath,
        }
      : undefined,
    providerCallObserved: providerObservedAll,
    providerObservationMode: providerObservedAll ? "actual_provider_call_observed" : "not_observed",
    outputCameFromScopedSandbox: allOutputsExist && allScoped,
    watcherEventObserved: allOutputsExist && watcherEvents.events.length === outputObservations.length,
    manifestMatched: manifestMatch.status === "matched",
    qaReportObserved: allOutputsExist && providerObservedAll && semanticQaCompletedAll,
    previewUpdatedFromOutput: ["draft_preview_ready", "draft_preview_needs_review"].includes(previewPlan.status),
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
    constraints: manifest.scenario.pressureConstraints,
    shotPlans: allPlans.map((plan) => ({
      shotId: plan.shotId,
      status: plan.status,
      taskPacketId: plan.taskPacketId,
      envelopeId: plan.envelopeId,
      workerProvenanceId: plan.workerProvenanceId,
      expectedOutputPath: plan.expectedOutputPath,
    })),
  },
  quality: {
    semanticQaStatus: qaReport.overallStatus === "pass" ? "pass" : qaReport.overallStatus === "needs_review" ? "needs_review" : "blocked",
    semanticQaRequired: true,
    p0FindingCount: qaReport.totals.p0FindingCount,
    p1FindingCount: qaReport.totals.p1FindingCount,
    p2FindingCount: qaReport.totals.p2FindingCount,
    gates: requiredSemanticGates,
  },
  notes: [
    "Real Demo E2E 002 Anime Pressure is Image2-first. No Seedance, Jimeng, Fast model, VIP channel, video provider, or text-to-video is accepted.",
    "This is a larger pressure run than 001: 16 shots across 3 scenes, 3 roles, 6 real image plans.",
    "Output existence, provider observation sidecar, and completed semantic QA sidecar are required before the return path can pass.",
    qaReport.note,
  ],
});

writeJson(path.join(reportsRoot, "real_demo_e2e_report.json"), report);

console.log(`Real Demo E2E 002 Anime Pressure verify status: ${report.status}`);
console.log(`Report: ${repoPath(path.join(reportsRoot, "real_demo_e2e_report.json"))}`);
if (report.status === "blocked") {
  console.error("Blocked:");
  for (const blocker of report.blockers) console.error(`- ${blocker}`);
  process.exit(1);
}
if (report.status === "needs_review") {
  console.error("Needs review:");
  for (const warning of report.warnings) console.error(`- ${warning}`);
  process.exit(2);
}

console.log("Real Demo E2E 002 Anime Pressure return path verified with actual provider observation and clean semantic QA.");
