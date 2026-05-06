import fs from "node:fs";
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
  return { exists: true, valid: blockers.length === 0, observation, blockers };
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
  const observationResult = loadObservation(plan);
  return {
    shotId: plan.shotId,
    taskRunId: plan.taskRunId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    expectedOutputPath: plan.expectedOutputPath,
    providerObservationPath: plan.providerObservationPath,
    outputExists: Boolean(outputInfo),
    outputInfo,
    scopedOutput: isScopedOutput(plan.expectedOutputPath),
    envelopeValid: envelopeIsValid(plan),
    providerObservationExists: observationResult.exists,
    providerObservationValid: observationResult.valid,
    providerObservationBlockers: observationResult.blockers,
    providerObservation: observationResult.observation,
  };
});

const watcherEvents = {
  schemaVersion: "real_demo_e2e_001_watcher_events_v1",
  generatedAt,
  runId: manifest.runId,
  events: outputObservations
    .filter((item) => item.outputExists)
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

const manifestMatch = {
  schemaVersion: "real_demo_e2e_001_manifest_match_v1",
  generatedAt,
  runId: manifest.runId,
  status: outputObservations.every((item) => item.outputExists && item.scopedOutput && item.providerObservationValid)
    ? "matched"
    : "blocked",
  matches: outputObservations.map((item) => ({
    shotId: item.shotId,
    expectedOutputPath: item.expectedOutputPath,
    outputExists: item.outputExists,
    scopedOutput: item.scopedOutput,
    providerObservationValid: item.providerObservationValid,
    status: item.outputExists && item.scopedOutput && item.providerObservationValid ? "matched" : "blocked",
    blockers: [
      item.outputExists ? "" : "expected output missing",
      item.scopedOutput ? "" : "output is outside scoped sandbox",
      item.providerObservationValid ? "" : "provider observation invalid or missing",
      ...item.providerObservationBlockers,
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
    status: item.outputExists && item.scopedOutput && item.providerObservationValid
      ? "structural_pass_semantic_needs_review"
      : "blocked",
    gates: {
      outputExists: item.outputExists,
      nonEmptyFile: Boolean(item.outputInfo?.sizeBytes > 0),
      scopedSandbox: item.scopedOutput,
      envelopeValid: item.envelopeValid,
      providerObservationValid: item.providerObservationValid,
    },
    blockers: [
      item.outputExists ? "" : "expected output missing",
      item.outputInfo?.sizeBytes > 0 ? "" : "output is empty or missing",
      item.scopedOutput ? "" : "output path is not inside real-demo-e2e/001/outputs/shots",
      item.envelopeValid ? "" : "subagent envelope is incomplete",
      item.providerObservationValid ? "" : "provider observation is incomplete",
      ...item.providerObservationBlockers,
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
      mediaType: returned?.outputExists ? "image_hold" : "placeholder",
      mediaPath: returned?.outputExists ? plan.expectedOutputPath : null,
      status: returned?.outputExists ? "returned" : plan.status,
      durationSeconds: 5,
    };
  }),
};

writeJson(path.join(reportsRoot, "preview_plan.json"), previewPlan);

const allOutputsExist = outputObservations.length > 0 && outputObservations.every((item) => item.outputExists);
const allScoped = outputObservations.every((item) => item.scopedOutput);
const allEnvelopesValid = outputObservations.length > 0 && outputObservations.every((item) => item.envelopeValid);
const providerObservedAll = outputObservations.length > 0 &&
  outputObservations.every((item) => item.outputExists && item.providerObservationValid);
const firstValidObservation = outputObservations.find((item) => item.providerObservationValid)?.providerObservation;
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
    workerProvenance: firstValidObservation ? {
      workerId: firstValidObservation.workerId || "imagegen_subagent_worker",
      subagentId: firstValidObservation.subagentId,
      taskRunId: firstValidObservation.taskRunId,
      taskPacketId: firstValidObservation.taskPacketId,
      envelopeId: firstValidObservation.envelopeId,
      outputPath: firstValidObservation.outputPath,
    } : undefined,
    providerCallObserved: providerObservedAll,
    providerObservationMode: providerObservedAll ? "actual_provider_call_observed" : "not_observed",
    outputCameFromScopedSandbox: allOutputsExist && allScoped,
    watcherEventObserved: allOutputsExist && watcherEvents.events.length === outputObservations.length,
    manifestMatched: manifestMatch.status === "matched",
    qaReportObserved: allOutputsExist && qaReport.checks.length === outputObservations.length,
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
