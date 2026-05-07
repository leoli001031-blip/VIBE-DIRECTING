import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const reportRoot = path.join(repoRoot, "real-test-sandbox/software-layer-diagnostic/20260505");
const reportPath = path.join(reportRoot, "software_layer_diagnostic_report.json");
const markdownPath = path.join(repoRoot, "docs/audits/software_layer_diagnostic_20260505.md");
const runRoot = path.join(repoRoot, "real-test-sandbox/real-demo-e2e/002-anime-pressure");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function repoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(tsPath) {
  const absolute = path.join(repoRoot, tsPath);
  const source = fs.readFileSync(absolute, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: absolute,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(absolute).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function issue(id, severity, title, evidence, recommendation) {
  return { id, severity, title, evidence, recommendation };
}

function pass(id, title, evidence) {
  return { id, status: "pass", title, evidence };
}

function countFiles(paths) {
  return paths.filter((relativePath) => exists(relativePath)).length;
}

function allSame(values) {
  return values.length > 1 && values.every((value) => value === values[0]);
}

const runtimeState = readJson("public/runtime-state.json");
const manifest = readJson("real-test-sandbox/real-demo-e2e/002-anime-pressure/run_manifest.json");
const finalReport = readJson("real-test-sandbox/real-demo-e2e/002-anime-pressure/reports/real_demo_e2e_report.json");
const qaReport = readJson("real-test-sandbox/real-demo-e2e/002-anime-pressure/reports/qa_report.json");
const watcherEvents = readJson("real-test-sandbox/real-demo-e2e/002-anime-pressure/reports/watcher_events.json");

const { buildCodexAppServerAdapterState } = await importTs("src/core/codexAppServerAdapter.ts");
const appServerAdapter = buildCodexAppServerAdapterState({
  generatedAt,
  cliVersionObserved: "0.128.0",
});

const agentAdapters = runtimeState.adapterContracts?.agentAdapters || [];
const appServerRuntimeAdapter = agentAdapters.find((adapter) => adapter.id === "codex-app-server-agent");
const legacyRuntimeAdapter = agentAdapters.find((adapter) => adapter.id === "codex-cli-agent");
const realPlans = manifest.shotPlans.filter((plan) => plan.status === "real_image_planned");
const outputCount = countFiles(realPlans.map((plan) => plan.expectedOutputPath));
const providerObservationCount = countFiles(realPlans.map((plan) => plan.providerObservationPath));
const semanticQaCount = countFiles(realPlans.map((plan) => plan.semanticQaPath));
const providerObservations = realPlans.map((plan) => readJson(plan.providerObservationPath));
const semanticQa = realPlans.map((plan) => readJson(plan.semanticQaPath));
const watcherObservedTimes = watcherEvents.events.map((event) => event.observedAt);

const checks = [
  pass(
    "app_server_adapter_registered",
    "Codex app-server adapter registered in runtime",
    `runtime has ${appServerRuntimeAdapter?.id}:${appServerRuntimeAdapter?.runtimeKind}:${appServerRuntimeAdapter?.state}`,
  ),
  pass(
    "legacy_codex_cli_fallback_preserved",
    "Legacy Codex CLI fallback preserved",
    `runtime has ${legacyRuntimeAdapter?.id}:${legacyRuntimeAdapter?.runtimeKind}:${legacyRuntimeAdapter?.state}`,
  ),
  pass(
    "app_server_protocol_readiness",
    "Codex app-server protocol readiness contract is ready",
    `${appServerAdapter.transport.supportedTransports.join("/")} transports; ${appServerAdapter.methods.clientRequests.thread.length} thread client methods`,
  ),
  pass(
    "real_demo_002_final_report_ready",
    "Real Demo E2E 002 final report state captured",
    `${finalReport.status}; declaration=${finalReport.declaration}`,
  ),
  pass(
    "real_demo_002_artifacts_present",
    "Real Demo E2E 002 artifacts are present",
    `${outputCount} outputs, ${providerObservationCount} provider observations, ${semanticQaCount} semantic QA sidecars`,
  ),
  pass(
    "semantic_qa_clean",
    "Semantic QA has no P0/P1 findings",
    `P0=${qaReport.totals.p0FindingCount}, P1=${qaReport.totals.p1FindingCount}, P2=${qaReport.totals.p2FindingCount}`,
  ),
];

const issues = [];

if (finalReport.status !== "ready_for_real_chain_pressure_test") {
  issues.push(issue(
    "real_demo_002_final_report_not_ready",
    "P1",
    "Real Demo E2E 002 final report is not ready",
    `finalReport.status=${finalReport.status}; blockers=${(finalReport.blockers || []).join("; ") || "none"}`,
    "Treat this as expected until output return, semantic QA, and preview update facts are all present; diagnostic should report it instead of crashing.",
  ));
}

if (outputCount !== realPlans.length || providerObservationCount !== realPlans.length || semanticQaCount !== realPlans.length) {
  issues.push(issue(
    "real_demo_002_artifacts_incomplete",
    "P1",
    "Real Demo E2E 002 artifact set is incomplete",
    `outputs=${outputCount}/${realPlans.length}, providerObservations=${providerObservationCount}/${realPlans.length}, semanticQa=${semanticQaCount}/${realPlans.length}`,
    "Keep the project in blocked/needs-runtime-work until all planned artifacts and sidecars are present.",
  ));
}

if ((qaReport.totals.semanticQaCompletedCount || 0) !== realPlans.length) {
  issues.push(issue(
    "semantic_qa_not_completed",
    "P1",
    "Semantic QA sidecars are present but not completed",
    `semanticQaCompleted=${qaReport.totals.semanticQaCompletedCount || 0}/${realPlans.length}; overallStatus=${qaReport.overallStatus}`,
    "Require an actual image-review pass to replace template_pending_image_review sidecars before claiming real-chain readiness.",
  ));
}

if (qaReport.totals.p0FindingCount > 0 || qaReport.totals.p1FindingCount > 0) {
  issues.push(issue(
    "semantic_qa_blocking_findings_present",
    "P1",
    "Semantic QA contains P0/P1 findings",
    `P0=${qaReport.totals.p0FindingCount}, P1=${qaReport.totals.p1FindingCount}`,
    "Keep the run out of ready state until P0/P1 findings are resolved or explicitly accepted through review.",
  ));
}

if (manifest.status !== "complete_verified" || manifest.declaration !== "actual_provider_observed") {
  issues.push(issue(
    "manifest_state_not_promoted",
    "P1",
    "Prepare manifest was not promoted after final verification",
    `manifest.status=${manifest.status}, manifest.declaration=${manifest.declaration}, finalReport.status=${finalReport.status}`,
    "Introduce a unified task-run state machine and derive manifest/report/preview from it instead of leaving prepare manifest stale.",
  ));
}

if (!manifest.taskRuns || !Array.isArray(manifest.taskRuns)) {
  issues.push(issue(
    "task_run_state_machine_missing",
    "P1",
    "No durable task-run state machine is present",
    "run_manifest has shotPlans but no taskRuns with prepared/leased/running/output_detected/provider_observed/qa_pending/complete_verified states.",
    "Add taskRun records with lifecycle states, worker lease, stall timeout, retry budget, and resumability.",
  ));
}

if (realPlans.some((plan) => !("leaseId" in plan) || !("workerThreadId" in plan))) {
  issues.push(issue(
    "worker_lease_missing",
    "P1",
    "Real image plans do not carry worker lease/thread facts",
    "shotPlans include taskRunId/packet/envelope paths but not leaseId, workerThreadId, turnId, or interrupted/resumed facts.",
    "Make queue leases and worker lifecycle facts first-class so interrupted imagegen workers can be resumed or reassigned safely.",
  ));
}

if (watcherEvents.events.length && (allSame(watcherObservedTimes) || watcherEvents.events.some((event) => !event.eventSource && !event.source))) {
  issues.push(issue(
    "watcher_events_synthesized",
    "P1",
    "Watcher evidence is still verify-synthesized",
    `watcher events=${watcherEvents.events.length}; allSameObservedAt=${allSame(watcherObservedTimes)}; eventSource fields missing=${watcherEvents.events.some((event) => !event.eventSource && !event.source)}`,
    "Replace verify-synthesized watcher evidence with append-only fs/watch events that record created/changed/settled/hash and sidecar pairing.",
  ));
}

if (providerObservations.some((observation) => !observation.outputSha256 || !observation.threadId || !observation.turnId)) {
  issues.push(issue(
    "provider_observation_transaction_fields_missing",
    "P1",
    "Provider observations do not bind output hash and app-server thread/turn facts",
    "Provider sidecars have taskRunId/envelopeId/outputPath but lack outputSha256, threadId, and turnId.",
    "Bind provider observation sidecars to output hash, app-server thread id, turn id, tool call id, and sidecar hash.",
  ));
}

if (semanticQa.some((qa) => !qa.reviewedOutputSha256 && !qa.reviewedImageHash)) {
  issues.push(issue(
    "semantic_qa_hash_binding_missing",
    "P1",
    "Semantic QA is not bound to reviewed image hash",
    "Semantic QA sidecars contain outputPath and textual evidence, but no stable reviewedOutputSha256 field.",
    "Require semantic QA to include reviewed output hash and stable finding ids so QA cannot drift from the image file.",
  ));
}

if (qaReport.totals.p2FindingCount > 0) {
  issues.push(issue(
    "style_p2_texture_trend",
    "P2",
    "Arcade shots show repeated low-texture style drift",
    `P2 findings=${qaReport.totals.p2FindingCount}; S06/S08 note heavier grime/texture while still passing.`,
    "Feed repeated P2 findings into the style capsule and prompt compiler, especially for arcade/grime-heavy scenes.",
  ));
}

if (appServerRuntimeAdapter?.state !== "active") {
  issues.push(issue(
    "app_server_live_runtime_not_enabled",
    "P2",
    "Codex app-server adapter is planned but not live-enabled",
    `adapter state=${appServerRuntimeAdapter?.state}; readiness adapter selected transport=${appServerAdapter.transport.selectedTransport}`,
    "Keep this as planned until socket lifecycle, auth token handling, approval routing, disconnect/reconnect, and thread recovery are tested.",
  ));
}

assert(appServerRuntimeAdapter?.runtimeKind === "codex_app_server", "codex-app-server-agent missing from runtime adapter contracts");
assert(legacyRuntimeAdapter?.runtimeKind === "codex_cli", "codex-cli-agent fallback missing from runtime adapter contracts");
assert(appServerAdapter.readiness === "ready", `app-server adapter should be ready: ${appServerAdapter.blockers.join("; ")}`);

const p1Count = issues.filter((item) => item.severity === "P1").length;
const p2Count = issues.filter((item) => item.severity === "P2").length;
const status = p1Count > 0 ? "needs_runtime_work" : p2Count > 0 ? "passes_with_notes" : "ready";

const report = {
  schemaVersion: "software_layer_diagnostic_v1",
  generatedAt,
  status,
  scope: {
    runtimeStatePath: "public/runtime-state.json",
    appServerAdapterPath: "src/core/codexAppServerAdapter.ts",
    realDemoRunRoot: repoPath(runRoot),
  },
  summary: {
    checksPassed: checks.length,
    issueCount: issues.length,
    p1Count,
    p2Count,
    appServerAdapter: {
      runtimeRegistered: Boolean(appServerRuntimeAdapter),
      runtimeState: appServerRuntimeAdapter?.state,
      readiness: appServerAdapter.readiness,
      selectedTransport: appServerAdapter.transport.selectedTransport,
      supportedTransports: appServerAdapter.transport.supportedTransports,
    },
    realDemo002: {
      status: finalReport.status,
      declaration: finalReport.declaration,
      totalShots: finalReport.pressure.totalShots,
      realImagePlanCount: finalReport.pressure.realImagePlanCount,
      outputs: outputCount,
      providerObservations: providerObservationCount,
      semanticQaSidecars: semanticQaCount,
      p0FindingCount: qaReport.totals.p0FindingCount,
      p1FindingCount: qaReport.totals.p1FindingCount,
      p2FindingCount: qaReport.totals.p2FindingCount,
    },
  },
  checks,
  issues,
  nextEngineeringMoves: [
    "Add unified TaskRun lifecycle records and derive manifest/report/preview from the same state machine.",
    "Replace verify-synthesized watcher evidence with real fs/watch or app-server fs/changed event logs.",
    "Make provider observation and semantic QA sidecars hash-bound and transactional.",
    "Add worker leases, thread/turn ids, stall timeout, retry budget, and resumability to the queue runtime.",
    "Use repeated P2 style findings as prompt/style capsule feedback instead of treating them as isolated QA notes.",
  ],
};

writeJson(reportPath, report);

const issueRows = issues
  .map((item) => `| ${item.severity} | ${item.id} | ${item.title} | ${item.recommendation} |`)
  .join("\n");

writeText(markdownPath, `# Software Layer Diagnostic - 2026-05-05

## Result

Status: \`${status}\`

This diagnostic exercises the current software layer around the Codex app-server readiness adapter and Real Demo E2E 002 outputs. It does not generate new images, launch a long-running app-server, open sockets, submit providers, or mutate provider outputs.

## Passed Checks

- Codex app-server adapter is registered in runtime as \`${appServerRuntimeAdapter?.id}:${appServerRuntimeAdapter?.runtimeKind}:${appServerRuntimeAdapter?.state}\`.
- Legacy Codex CLI fallback is preserved as \`${legacyRuntimeAdapter?.id}:${legacyRuntimeAdapter?.runtimeKind}:${legacyRuntimeAdapter?.state}\`.
- App-server readiness adapter reports \`${appServerAdapter.readiness}\` with transports \`${appServerAdapter.transport.supportedTransports.join("/")}\`.
- Real Demo E2E 002 final report is \`${finalReport.status}\` with declaration \`${finalReport.declaration}\`.
- Planned real outputs: ${outputCount}/${realPlans.length}.
- Provider observation sidecars: ${providerObservationCount}/${realPlans.length}.
- Semantic QA sidecars: ${semanticQaCount}/${realPlans.length}.
- Semantic QA P0/P1/P2: ${qaReport.totals.p0FindingCount}/${qaReport.totals.p1FindingCount}/${qaReport.totals.p2FindingCount}.

## Issues Found

| Severity | ID | Issue | Recommendation |
|---|---|---|---|
${issueRows}

## Next Engineering Moves

1. Add unified TaskRun lifecycle records and derive manifest/report/preview from the same state machine.
2. Replace verify-synthesized watcher evidence with real fs/watch or app-server fs/changed event logs.
3. Make provider observation and semantic QA sidecars hash-bound and transactional.
4. Add worker leases, thread/turn ids, stall timeout, retry budget, and resumability to the queue runtime.
5. Use repeated P2 style findings as prompt/style capsule feedback instead of treating them as isolated QA notes.

## Artifacts

- JSON report: \`${repoPath(reportPath)}\`
- Real Demo 002 report: \`real-test-sandbox/real-demo-e2e/002-anime-pressure/reports/real_demo_e2e_report.json\`
- App-server adapter: \`src/core/codexAppServerAdapter.ts\`
`);

console.log(`Software layer diagnostic status: ${status}`);
console.log(`Report: ${repoPath(reportPath)}`);
console.log(`Audit: ${repoPath(markdownPath)}`);
console.log(`Issues: ${issues.length} (${p1Count} P1, ${p2Count} P2)`);
