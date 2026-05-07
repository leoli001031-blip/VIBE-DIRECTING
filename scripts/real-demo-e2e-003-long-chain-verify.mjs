import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/003-long-chain-software");
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

function sha256File(filePath) {
  if (!exists(filePath)) return undefined;
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
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

function imageFileInfo(filePath) {
  if (!exists(filePath)) return { mediaReadable: false, width: 0, height: 0, mediaFormat: "missing" };
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 24 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return {
      mediaReadable: true,
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      mediaFormat: "png",
    };
  }
  return { mediaReadable: false, width: 0, height: 0, mediaFormat: "unknown" };
}

function isScopedOutput(relativePath) {
  const absolute = path.resolve(absPath(relativePath));
  const scopedRoot = path.resolve(path.join(runRoot, "outputs/shots"));
  return absolute === scopedRoot || absolute.startsWith(`${scopedRoot}${path.sep}`);
}

function gateStatus(qa, gateId) {
  return qa.gateResults?.[gateId]?.status;
}

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 003 manifest missing. Run npm run real-demo-e2e-003:prepare first.");
  process.exit(1);
}

ensureDir(reportsRoot);

const generatedAt = new Date().toISOString();
const manifest = readJson(manifestPath);
const watcherFile = readJson(absPath(manifest.runtimeTruthWatcherPath));
const { buildRealDemoE2eReport } = await importTs(path.join(repoRoot, "src/core/realDemoE2e.ts"));
const { buildRuntimeTruthLayer } = await importRuntimeTruthLayer();

const blockers = [];
const manifestSceneSet = new Set(manifest.scenario.scenes);
const manifestRoleSet = new Set(manifest.scenario.roles);
const actualProviderForbidden = manifest.scenario.actualProvidersCalled === false &&
  manifest.declaration === "readiness_harness_only" &&
  manifest.notes.some((note) => note.includes("No Image2"));
if (!actualProviderForbidden) blockers.push("003 must remain software-layer only and must not claim actual provider execution.");
if (manifest.scenario.totalShots !== 10) blockers.push("003 must contain exactly 10 shots.");
if (manifestSceneSet.size !== 3) blockers.push("003 manifest must declare exactly 3 scenes.");
if (manifestRoleSet.size !== 2) blockers.push("003 manifest must declare exactly 2 roles.");

const observations = manifest.shotPlans.map((plan, index) => {
  const outputPath = absPath(plan.expectedOutputPath);
  const providerPath = absPath(plan.providerObservationPath);
  const workerPath = absPath(plan.workerProvenancePath);
  const qaPath = absPath(plan.semanticQaPath);
  const envelopePath = absPath(plan.envelopePath);
  const packetPath = absPath(plan.packetPath);
  const layoutPath = path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`);
  const outputInfo = fileInfo(outputPath);
  const imageInfo = imageFileInfo(outputPath);
  const outputSha256 = sha256File(outputPath);
  const provider = exists(providerPath) ? readJson(providerPath) : null;
  const worker = exists(workerPath) ? readJson(workerPath) : null;
  const qa = exists(qaPath) ? readJson(qaPath) : null;
  const envelope = exists(envelopePath) ? readJson(envelopePath) : null;
  const layout = exists(layoutPath) ? readJson(layoutPath) : null;
  const shotEvents = watcherFile.events.filter((event) => event.shotId === plan.shotId);
  const requiredEventTypes = ["file_observed", "file_stable", "hash_recorded", "provider_observation_paired", "semantic_qa_paired"];
  const qaGateStatuses = qa ? Object.fromEntries(requiredGates.map((gate) => [gate, gateStatus(qa, gate)])) : {};
  const itemBlockers = [
    plan.status === "returned" ? "" : `${plan.shotId}: status must be returned`,
    exists(packetPath) ? "" : `${plan.shotId}: task packet missing`,
    envelope?.expectedOutputContract?.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: envelope output contract mismatch`,
    layout?.neighborShots?.current?.shotId === plan.shotId ? "" : `${plan.shotId}: neighbor summary missing`,
    layout?.neighborShots?.previous?.shotId === (index > 0 ? manifest.shotPlans[index - 1].shotId : undefined) ||
      (index === 0 && layout?.neighborShots?.previous === null)
      ? ""
      : `${plan.shotId}: previous neighbor mismatch`,
    layout?.neighborShots?.next?.shotId === (index < manifest.shotPlans.length - 1 ? manifest.shotPlans[index + 1].shotId : undefined) ||
      (index === manifest.shotPlans.length - 1 && layout?.neighborShots?.next === null)
      ? ""
      : `${plan.shotId}: next neighbor mismatch`,
    outputInfo ? "" : `${plan.shotId}: output missing`,
    imageInfo.mediaReadable ? "" : `${plan.shotId}: output PNG unreadable`,
    isScopedOutput(plan.expectedOutputPath) ? "" : `${plan.shotId}: output outside scoped sandbox`,
    provider?.providerObservationMode === "mock_readiness_evidence" ? "" : `${plan.shotId}: provider observation must be mock_readiness_evidence`,
    provider?.actualProviderCalled === false ? "" : `${plan.shotId}: provider observation must not claim actual provider call`,
    provider?.outputSha256 === outputSha256 ? "" : `${plan.shotId}: provider hash mismatch`,
    worker?.provenanceMode === "software_layer_subagent_worker_fixture" ? "" : `${plan.shotId}: worker provenance mode mismatch`,
    worker?.taskRunId === plan.taskRunId ? "" : `${plan.shotId}: worker taskRunId mismatch`,
    qa?.semanticReviewMode === "software_layer_semantic_gate_fixture" ? "" : `${plan.shotId}: semantic QA mode mismatch`,
    qa?.reviewedOutputSha256 === outputSha256 ? "" : `${plan.shotId}: semantic QA hash mismatch`,
    requiredGates.every((gate) => gateStatus(qa, gate) === "pass") ? "" : `${plan.shotId}: semantic QA gates incomplete`,
    requiredEventTypes.every((eventType) => shotEvents.some((event) => event.eventType === eventType)) ? "" : `${plan.shotId}: watcher events incomplete`,
    shotEvents.every((event) => event.sourceKind === "software_layer_fs_event") ? "" : `${plan.shotId}: watcher source kind must be software_layer_fs_event`,
  ].filter(Boolean);
  blockers.push(...itemBlockers);
  return {
    order: index + 1,
    shotId: plan.shotId,
    sceneId: layout?.sceneId,
    roleIds: layout?.roleIds || [],
    expectedOutputPath: plan.expectedOutputPath,
    outputExists: Boolean(outputInfo),
    outputSha256,
    imageInfo,
    providerMode: provider?.providerObservationMode,
    actualProviderCalled: provider?.actualProviderCalled === true,
    workerMode: worker?.provenanceMode,
    semanticQaMode: qa?.semanticReviewMode,
    qaGateStatuses,
    watcherEventCount: shotEvents.length,
    blockers: itemBlockers,
  };
});

const actualSceneSet = new Set(observations.map((item) => item.sceneId).filter(Boolean));
const actualRoleSet = new Set(observations.flatMap((item) => item.roleIds));
if (actualSceneSet.size !== 3) blockers.push("003 shot layouts must actually span exactly 3 scenes.");
if (actualRoleSet.size !== 2) blockers.push("003 shot layouts must actually include exactly 2 roles.");

const allShotsReturned = observations.length === 10 && observations.every((item) => item.blockers.length === 0);
const projectFacts = {
  projectVibePresent: exists(absPath(manifest.projectFacts.projectVibePath)),
  sourceIndexPresent: exists(absPath(manifest.projectFacts.sourceIndexPath)),
  visualMemoryPresent: exists(absPath(manifest.projectFacts.visualMemoryPath)),
  shotLayoutPresent: exists(absPath(manifest.projectFacts.shotLayoutRoot)) &&
    manifest.shotPlans.every((plan) => exists(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`))),
};

const previewPlan = {
  schemaVersion: "real_demo_e2e_003_preview_plan_v1",
  generatedAt,
  runId: manifest.runId,
  status: allShotsReturned ? "software_layer_preview_ready" : "blocked",
  totalDurationSeconds: manifest.shotPlans.reduce((sum, plan) => {
    const layout = readJson(path.join(absPath(manifest.projectFacts.shotLayoutRoot), `${plan.shotId}.json`));
    return sum + (Number(layout.durationSeconds) || 5);
  }, 0),
  clips: observations.map((item) => ({
    clipId: `preview_${item.shotId}`,
    order: item.order,
    shotId: item.shotId,
    mediaType: "software_layer_image_hold",
    mediaPath: item.expectedOutputPath,
    status: item.blockers.length ? "blocked" : "returned",
    durationSeconds: 5,
  })),
};
writeJson(path.join(reportsRoot, "preview_plan.json"), previewPlan);

const qaReport = {
  schemaVersion: "real_demo_e2e_003_qa_report_v1",
  generatedAt,
  runId: manifest.runId,
  overallStatus: blockers.length ? "blocked" : "pass",
  requiredGates,
  checks: observations.map((item) => ({
    shotId: item.shotId,
    status: item.blockers.length ? "blocked" : "pass",
    gates: item.qaGateStatuses,
    blockers: item.blockers,
  })),
};
writeJson(path.join(reportsRoot, "qa_report.json"), qaReport);

const runtimeTruthItems = observations.map((item) => {
  const plan = manifest.shotPlans.find((candidate) => candidate.shotId === item.shotId);
  const outputPath = absPath(plan.expectedOutputPath);
  const outputInfo = fileInfo(outputPath);
  const provider = readJson(absPath(plan.providerObservationPath));
  const worker = readJson(absPath(plan.workerProvenancePath));
  const qa = readJson(absPath(plan.semanticQaPath));
  const outputSha256 = item.outputSha256;
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
      exists: item.outputExists,
      fileModifiedAt: outputInfo?.modifiedAt,
      sizeBytes: outputInfo?.sizeBytes,
      outputSha256,
      mediaKind: "image",
      mediaFormat: item.imageInfo.mediaFormat,
      mediaReadable: item.imageInfo.mediaReadable,
      width: item.imageInfo.width,
      height: item.imageInfo.height,
    },
    workerLease: {
      ...worker,
      exists: true,
      sidecarKind: "worker_provenance",
      sidecarPath: plan.workerProvenancePath,
      sidecarModifiedAt: fileInfo(absPath(plan.workerProvenancePath))?.modifiedAt,
    },
    providerObservation: {
      sidecarPath: plan.providerObservationPath,
      exists: true,
      sidecarModifiedAt: fileInfo(absPath(plan.providerObservationPath))?.modifiedAt,
      generatedAt: provider.generatedAt,
      runId: provider.runId,
      taskRunId: provider.taskRunId,
      taskPacketId: provider.taskPacketId,
      envelopeId: provider.envelopeId,
      outputPath: provider.outputPath,
      outputSha256: provider.outputSha256,
      providerId: provider.provider,
      providerObservationMode: provider.providerObservationMode,
      manualFileCopyDetected: provider.manualFileCopyDetected === true,
      fixtureReuseDetected: provider.fixtureReuseDetected === true,
      providerSelfReportCompletesTask: provider.providerSelfReportCompletesTask === true,
    },
    semanticQa: {
      sidecarPath: plan.semanticQaPath,
      exists: true,
      sidecarModifiedAt: fileInfo(absPath(plan.semanticQaPath))?.modifiedAt,
      reviewedAt: qa.reviewedAt,
      runId: qa.runId,
      taskRunId: qa.taskRunId,
      taskPacketId: qa.taskPacketId,
      envelopeId: qa.envelopeId,
      outputPath: qa.outputPath,
      outputSha256: qa.outputSha256,
      reviewedOutputSha256: qa.reviewedOutputSha256,
      gates: Object.fromEntries(requiredGates.map((gate) => [gate, "pass"])),
      severityCounts: { p0: 0, p1: 0, p2: 0 },
    },
    watcherEvents: watcherFile.events
      .filter((event) => event.shotId === plan.shotId)
      .map((event) => ({
        ...event,
        eventType: event.eventType === "provider_observation_paired" ? "sidecar_paired" : event.eventType === "semantic_qa_paired" ? "qa_paired" : event.eventType,
        sidecarKind: event.eventType === "provider_observation_paired" ? "provider_observation" : event.eventType === "semantic_qa_paired" ? "semantic_qa" : event.sidecarKind,
      })),
  });
  return {
    shotId: item.shotId,
    status: runtimeTruthLayer.status,
    expectedBlocked: true,
    blockers: runtimeTruthLayer.blockers,
    lifecycle: runtimeTruthLayer.lifecycle,
    verification: runtimeTruthLayer.verification,
  };
});

writeJson(path.join(reportsRoot, "runtime_truth_layer.json"), {
  schemaVersion: "real_demo_e2e_003_runtime_truth_layer_projection_v1",
  generatedAt,
  runId: manifest.runId,
  status: runtimeTruthItems.every((item) => item.status === "blocked") ? "software_layer_expected_blocked" : "unexpected_preview_ready",
  items: runtimeTruthItems,
  notes: [
    "RuntimeTruthLayer is intentionally projected and intentionally blocked for 003.",
    "Software-layer fixtures use mock readiness evidence and software_layer_fs_event watcher sources, so they must not satisfy actual provider Runtime Truth gates.",
  ],
});

const chainReport = {
  schemaVersion: "real_demo_e2e_003_long_chain_software_report_v1",
  generatedAt,
  runId: manifest.runId,
  status: blockers.length ? "blocked" : "software_long_chain_ready",
  declaration: "readiness_harness_only",
  actualProvidersCalled: false,
  shotCount: observations.length,
  sceneCount: actualSceneSet.size,
  roleCount: actualRoleSet.size,
  watcherEventCount: watcherFile.events.length,
  runtimeTruthProjectionStatus: runtimeTruthItems.every((item) => item.status === "blocked") ? "expected_blocked_for_software_layer" : "unexpected_preview_ready",
  observations,
  blockers: Array.from(new Set(blockers)),
  notes: [
    "Software-layer long-chain test only. It validates orchestration shape and evidence plumbing.",
    "It does not call Image2, Seedance, Jimeng, Fast, VIP, text-to-video, or video generation.",
  ],
};
writeJson(path.join(reportsRoot, "long_chain_software_report.json"), chainReport);

const report = buildRealDemoE2eReport({
  generatedAt,
  projectId: manifest.projectId,
  runId: manifest.runId,
  scenarioId: "real_demo_e2e_003_long_chain_software",
  declaration: "readiness_harness_only",
  projectFacts,
  chain: {
    generatedByUiAction: exists(absPath(manifest.uiActionPath)),
    validatedEnvelope: allShotsReturned,
    workerProvenance: {
      workerId: "software_long_chain_worker",
      subagentId: "software_layer_harness",
      taskRunId: manifest.shotPlans[0]?.taskRunId,
      taskPacketId: manifest.shotPlans[0]?.taskPacketId,
      envelopeId: manifest.shotPlans[0]?.envelopeId,
      outputPath: manifest.shotPlans[0]?.expectedOutputPath,
    },
    providerCallObserved: false,
    providerObservationMode: "mock_readiness_evidence",
    outputCameFromScopedSandbox: observations.every((item) => item.outputExists),
    watcherEventObserved: watcherFile.events.length === observations.length * 5,
    manifestMatched: allShotsReturned,
    qaReportObserved: qaReport.overallStatus === "pass",
    previewUpdatedFromOutput: previewPlan.status === "software_layer_preview_ready",
    providerSelfReportCompletesTask: false,
  },
  integrity: {
    manualFileCopyDetected: false,
    fixtureReuseDetected: false,
    simulatedStateDetected: false,
  },
  pressure: {
    totalShots: observations.length,
    realImagePlanCount: 3,
    queuedOrParkedCount: 7,
    shotPlans: manifest.shotPlans.map((plan, index) => ({
      shotId: plan.shotId,
      status: index < 3 ? "real_image_planned" : index < 7 ? "queued" : "parked",
      taskPacketId: plan.taskPacketId,
      envelopeId: plan.envelopeId,
      workerProvenanceId: plan.workerProvenanceId,
      expectedOutputPath: plan.expectedOutputPath,
    })),
  },
  quality: {
    semanticQaStatus: qaReport.overallStatus === "pass" ? "pass" : "blocked",
    semanticQaRequired: true,
    p0FindingCount: 0,
    p1FindingCount: 0,
    p2FindingCount: 0,
    gates: requiredGates,
  },
  notes: [
    "003 is a software-layer long-chain test. Provider observation evidence is mock readiness evidence, not actual provider observation.",
    "Do not claim real provider generation completion from this report.",
  ],
});
writeJson(path.join(reportsRoot, "real_demo_e2e_report.json"), report);

console.log(`Real Demo E2E 003 verify status: ${chainReport.status}`);
console.log(`Report: ${repoPath(path.join(reportsRoot, "long_chain_software_report.json"))}`);
if (chainReport.blockers.length || report.completionClaim.realProviderGenerationCompleted) {
  console.error("Blocked:");
  for (const blocker of [...chainReport.blockers, ...report.blockers]) console.error(`- ${blocker}`);
  process.exit(1);
}
console.log("Real Demo E2E 003 software-layer long chain verified. No providers were called.");
