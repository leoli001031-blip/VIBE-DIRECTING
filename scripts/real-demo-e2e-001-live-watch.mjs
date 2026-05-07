import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/001");
const manifestPath = path.join(runRoot, "run_manifest.json");

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
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function fileInfo(filePath) {
  if (!exists(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("FILL_BY");
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

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 001 run_manifest.json is missing. Run npm run real-demo-e2e-001:prepare first.");
  process.exit(1);
}

const generatedAt = new Date().toISOString();
const manifest = readJson(manifestPath);
const runtimeTruthWatcherPath = manifest.runtimeTruthWatcherPath || manifest.shotPlans.find((plan) => plan.runtimeTruthWatcherPath)?.runtimeTruthWatcherPath;
if (!runtimeTruthWatcherPath) {
  console.error("runtimeTruthWatcherPath is missing from the 001 run manifest. Run npm run real-demo-e2e-001:prepare first.");
  process.exit(1);
}

const { buildRuntimeTruthWatcherEvents } = await importTs(path.join(repoRoot, "src/core/runtimeTruthIngest.ts"));
const realPlans = manifest.shotPlans.filter((plan) => plan.status === "real_image_planned");
const timeoutMs = Number(process.env.REAL_DEMO_E2E_001_WATCH_TIMEOUT_MS || 15 * 60 * 1000);
const intervalMs = Number(process.env.REAL_DEMO_E2E_001_WATCH_INTERVAL_MS || 2000);
const startedAt = Date.now();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectWatcherEvents() {
  const blockers = [];
  const events = [];

  for (const plan of realPlans) {
    const outputPath = absPath(plan.expectedOutputPath);
    const providerObservationPath = absPath(plan.providerObservationPath);
    const workerProvenancePath = absPath(plan.workerProvenancePath);
    const semanticQaPath = absPath(plan.semanticQaPath);
    const outputInfo = fileInfo(outputPath);
    const providerInfo = fileInfo(providerObservationPath);
    const workerInfo = fileInfo(workerProvenancePath);
    const semanticQaInfo = fileInfo(semanticQaPath);

    if (!outputInfo) blockers.push(`${plan.shotId}: output missing`);
    if (!providerInfo) blockers.push(`${plan.shotId}: provider observation missing`);
    if (!workerInfo) blockers.push(`${plan.shotId}: worker provenance missing`);
    if (!semanticQaInfo) blockers.push(`${plan.shotId}: semantic QA missing`);
    if (!outputInfo || !providerInfo || !workerInfo || !semanticQaInfo) continue;

    const outputSha256 = sha256File(outputPath);
    const providerObservation = readJson(providerObservationPath);
    const workerProvenance = readJson(workerProvenancePath);
    const semanticQa = readJson(semanticQaPath);

    const planBlockers = [
      providerObservation.providerObservationMode === "actual_provider_call_observed" ? "" : `${plan.shotId}: provider observation is not actual`,
      providerObservation.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: provider observation outputPath mismatch`,
      providerObservation.outputSha256 === outputSha256 ? "" : `${plan.shotId}: provider observation hash mismatch`,
      workerProvenance.provenanceMode === "actual_subagent_worker_lease_observed" ? "" : `${plan.shotId}: worker provenance is not actual`,
      workerProvenance.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: worker provenance outputPath mismatch`,
      semanticQa.semanticReviewMode === "actual_image_semantic_review" ? "" : `${plan.shotId}: semantic QA review is not actual`,
      semanticQa.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: semantic QA outputPath mismatch`,
      (semanticQa.reviewedOutputSha256 || semanticQa.reviewedImageHash) === outputSha256 ? "" : `${plan.shotId}: semantic QA reviewed hash mismatch`,
      isFilled(semanticQa.reviewedAt) ? "" : `${plan.shotId}: semantic QA reviewedAt missing`,
    ].filter(Boolean);
    blockers.push(...planBlockers);
    if (planBlockers.length) continue;

    const ingest = buildRuntimeTruthWatcherEvents({
      generatedAt,
      sourceKind: "app_server_fs_changed",
      eventIdPrefix: `runtime_truth_real_demo_001_live_${plan.shotId}`,
      binding: {
        runId: manifest.runId,
        taskRunId: plan.taskRunId,
        taskPacketId: plan.taskPacketId,
        envelopeId: plan.envelopeId,
        outputPath: plan.expectedOutputPath,
        outputSha256,
      },
      file: {
        exists: true,
        stable: true,
        outputPath: plan.expectedOutputPath,
        outputSha256,
        observedAt: outputInfo.modifiedAt,
        stableAt: outputInfo.modifiedAt,
        hashRecordedAt: outputInfo.modifiedAt,
      },
      providerObservation: {
        exists: true,
        sidecarPath: plan.providerObservationPath,
        pairedAt: providerInfo.modifiedAt,
        outputSha256,
      },
      semanticQa: {
        exists: true,
        sidecarPath: plan.semanticQaPath,
        pairedAt: semanticQaInfo.modifiedAt,
        outputSha256,
      },
    });
    events.push(...ingest.events);
  }

  return { blockers, events };
}

let result = collectWatcherEvents();
while (result.blockers.length && Date.now() - startedAt < timeoutMs) {
  console.log(`Real Demo E2E 001 live watcher waiting: ${result.blockers.slice(0, 4).join("; ")}`);
  await sleep(intervalMs);
  result = collectWatcherEvents();
}

if (result.blockers.length) {
  console.error("Real Demo E2E 001 live watcher timed out. No watcher event file was written.");
  for (const blocker of result.blockers) console.error(`- ${blocker}`);
  process.exit(1);
}

writeJson(absPath(runtimeTruthWatcherPath), {
  schemaVersion: "real_demo_e2e_001_runtime_truth_watcher_events_v1",
  generatedAt,
  runId: manifest.runId,
  sourceKind: "app_server_fs_changed",
  eventSource: "real-demo-e2e-001-live-watch-poller",
  watcherMode: "live_poll_app_server_fs_changed",
  events: result.events,
  notes: [
    "This file is written only after the real image, provider observation, worker provenance, and semantic QA sidecars are present.",
    "Events use sourceKind app_server_fs_changed. This script does not call providers, create images, submit video, copy fixtures, or write mock/manual-copy evidence.",
  ],
});

console.log("Real Demo E2E 001 live watcher events written.");
console.log(`Watcher events: ${runtimeTruthWatcherPath}`);
console.log(`Event count: ${result.events.length}`);
