import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/004-image2-start-frames");
const manifestPath = path.join(runRoot, "run_manifest.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function absPath(relativePath) {
  return path.join(repoRoot, relativePath);
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
  return { sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
}

function isFilled(value) {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("FILL_BY");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (!exists(manifestPath)) {
  console.error("Real Demo E2E 004 manifest missing. Run npm run real-demo-e2e-004:prepare first.");
  process.exit(1);
}

const manifest = readJson(manifestPath);
const timeoutMs = Number(process.env.REAL_DEMO_E2E_004_WATCH_TIMEOUT_MS || 30 * 60 * 1000);
const intervalMs = Number(process.env.REAL_DEMO_E2E_004_WATCH_INTERVAL_MS || 3000);
const startedAt = Date.now();

function collect() {
  const blockers = [];
  const events = [];

  for (const plan of manifest.shotPlans) {
    const outputPath = absPath(plan.expectedOutputPath);
    const providerPath = absPath(plan.providerObservationPath);
    const workerPath = absPath(plan.workerProvenancePath);
    const qaPath = absPath(plan.semanticQaPath);
    const outputInfo = fileInfo(outputPath);
    const providerInfo = fileInfo(providerPath);
    const workerInfo = fileInfo(workerPath);
    const qaInfo = fileInfo(qaPath);

    if (!outputInfo) blockers.push(`${plan.shotId}: output missing`);
    if (!providerInfo) blockers.push(`${plan.shotId}: provider observation missing`);
    if (!workerInfo) blockers.push(`${plan.shotId}: worker provenance missing`);
    if (!qaInfo) blockers.push(`${plan.shotId}: semantic QA missing`);
    if (!outputInfo || !providerInfo || !workerInfo || !qaInfo) continue;

    const outputSha256 = sha256File(outputPath);
    const provider = readJson(providerPath);
    const worker = readJson(workerPath);
    const qa = readJson(qaPath);
    const planBlockers = [
      provider.providerObservationMode === "actual_provider_call_observed" ? "" : `${plan.shotId}: provider observation is not actual`,
      String(provider.provider || "").includes("image2") ? "" : `${plan.shotId}: provider is not image2`,
      provider.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: provider outputPath mismatch`,
      provider.outputSha256 === outputSha256 ? "" : `${plan.shotId}: provider hash mismatch`,
      worker.sidecarKind === "worker_provenance" ? "" : `${plan.shotId}: worker sidecarKind mismatch`,
      worker.provenanceMode === "actual_subagent_worker_lease_observed" ? "" : `${plan.shotId}: worker provenance is not actual`,
      worker.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: worker outputPath mismatch`,
      worker.taskRunId === plan.taskRunId ? "" : `${plan.shotId}: worker taskRunId mismatch`,
      qa.semanticReviewMode === "actual_image_semantic_review" ? "" : `${plan.shotId}: semantic QA review is not actual`,
      qa.outputPath === plan.expectedOutputPath ? "" : `${plan.shotId}: semantic QA outputPath mismatch`,
      (qa.reviewedOutputSha256 || qa.reviewedImageHash) === outputSha256 ? "" : `${plan.shotId}: semantic QA hash mismatch`,
      isFilled(qa.reviewedAt) ? "" : `${plan.shotId}: semantic QA reviewedAt missing`,
    ].filter(Boolean);
    blockers.push(...planBlockers);
    if (planBlockers.length) continue;

    const base = {
      runId: manifest.runId,
      shotId: plan.shotId,
      taskRunId: plan.taskRunId,
      taskPacketId: plan.taskPacketId,
      envelopeId: plan.envelopeId,
      artifactPath: plan.expectedOutputPath,
      outputPath: plan.expectedOutputPath,
      outputSha256,
      sourceKind: "app_server_fs_changed",
    };
    events.push(
      { ...base, eventId: `watcher_004_${plan.shotId}_file_observed`, sequence: events.length + 1, eventType: "file_observed", occurredAt: outputInfo.modifiedAt },
      { ...base, eventId: `watcher_004_${plan.shotId}_file_stable`, sequence: events.length + 2, eventType: "file_stable", occurredAt: outputInfo.modifiedAt },
      { ...base, eventId: `watcher_004_${plan.shotId}_hash_recorded`, sequence: events.length + 3, eventType: "hash_recorded", occurredAt: outputInfo.modifiedAt },
      { ...base, eventId: `watcher_004_${plan.shotId}_provider_paired`, sequence: events.length + 4, eventType: "sidecar_paired", sidecarKind: "provider_observation", sidecarPath: plan.providerObservationPath, occurredAt: providerInfo.modifiedAt },
      { ...base, eventId: `watcher_004_${plan.shotId}_qa_paired`, sequence: events.length + 5, eventType: "qa_paired", sidecarKind: "semantic_qa", sidecarPath: plan.semanticQaPath, occurredAt: qaInfo.modifiedAt },
    );
  }

  return { blockers, events };
}

let result = collect();
while (result.blockers.length && Date.now() - startedAt < timeoutMs) {
  console.log(`Real Demo E2E 004 watcher waiting: ${result.blockers.slice(0, 6).join("; ")}`);
  await sleep(intervalMs);
  result = collect();
}

if (result.blockers.length) {
  console.error("Real Demo E2E 004 watcher timed out. No watcher event file was written.");
  for (const blocker of result.blockers) console.error(`- ${blocker}`);
  process.exit(1);
}

writeJson(absPath(manifest.runtimeTruthWatcherPath), {
  schemaVersion: "real_demo_e2e_004_runtime_truth_watcher_events_v1",
  generatedAt: new Date().toISOString(),
  runId: manifest.runId,
  sourceKind: "app_server_fs_changed",
  eventSource: "real-demo-e2e-004-image2-start-watch-poller",
  events: result.events,
});

console.log("Real Demo E2E 004 watcher events written.");
console.log(`Event count: ${result.events.length}`);
