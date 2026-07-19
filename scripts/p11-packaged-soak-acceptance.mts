import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  assertAcceptance,
  closePackagedAcceptanceApp,
  forceClosePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  observePackagedTask,
  openExportAcceptanceView,
  openVideoAcceptanceView,
  packagedProcessRssKb,
  packagedRuntimeProcessIdsForRoot,
  pathExists,
  waitForAcceptance,
  type RunningPackagedApp,
} from "./lib/packaged-acceptance-harness.mts";

const minimumDurationMs = 60 * 60 * 1000;
const preflightMode = process.env.VIBE_P11_SOAK_PREFLIGHT === "1";
const requiredRestarts = preflightMode ? 2 : 10;
const requiredStateAdvances = preflightMode ? 4 : 20;
const sampleIntervalMs = preflightMode ? 5_000 : 30_000;
const requiredDurationMs = preflightMode ? 30_000 : minimumDurationMs;

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function listFiles(root: string): Promise<string[]> {
  if (!await pathExists(root)) return [];
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) files.push(relative(root, path).replace(/\\/g, "/"));
    }
  }
  await visit(root);
  return files.sort();
}

async function hashSnapshot(root: string): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all((await listFiles(root)).map(async (path) => [path, await sha256(join(root, path))])));
}

async function stagedExportFiles(projectRoot: string): Promise<string[]> {
  const result: string[] = [];
  for (const root of [join(projectRoot, "exports", ".vibe-staging"), join(projectRoot, "reports", "exports", ".vibe-staging")]) {
    for (const path of await listFiles(root)) result.push(`${relative(projectRoot, root).replace(/\\/g, "/")}/${path}`);
  }
  return result.sort();
}

async function findProjectPath(projectRoot: string): Promise<string> {
  const fileName = (await readdir(projectRoot)).find((name) => name.toLowerCase() === "project.vibe");
  assertAcceptance(fileName, `project.vibe is missing in ${projectRoot}`);
  return join(projectRoot, fileName);
}

function taskIdentity(observation: Record<string, unknown>) {
  return [observation.currentTaskStep, observation.currentTaskSource, observation.currentTaskLabel].join("::");
}

function sanitizeLogLine(line: string, replacements: string[]) {
  let sanitized = line;
  for (const value of replacements.filter(Boolean).sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.split(value).join(value.includes("Vibe Director Studio.app") ? "<packaged_app>" : "<local_path>");
  }
  return sanitized
    .replace(/\b(api[_-]?key|authorization|access[_-]?token|auth[_-]?token|secret|password)=\S+/gi, "$1=<redacted>")
    .slice(0, 1000);
}

async function runtimeLogSummary(runtimeRoot: string, replacements: string[]) {
  const files = (await listFiles(runtimeRoot)).filter((path) => path.endsWith(".stderr.log"));
  const summaries = [];
  let unexpectedErrorCount = 0;
  let knownWarningCount = 0;
  for (const path of files) {
    const lines = (await readFile(join(runtimeRoot, path), "utf8")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const known = lines.filter((line) => line.includes("error messaging the mach port for IMKCFRunLoopWakeUpReliable"));
    const unexpected = lines.filter((line) => !line.includes("error messaging the mach port for IMKCFRunLoopWakeUpReliable"));
    knownWarningCount += known.length;
    unexpectedErrorCount += unexpected.length;
    summaries.push({
      path,
      lineCount: lines.length,
      knownWarningCount: known.length,
      unexpectedErrorCount: unexpected.length,
      unexpectedTail: unexpected.slice(-5).map((line) => sanitizeLogLine(line, replacements)),
    });
  }
  return { files: summaries, knownWarningCount, unexpectedErrorCount };
}

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const projectRoot = resolve(process.argv[3] || "");
const evidenceRoot = resolve(process.argv[4] || "docs/evidence/p11-a-packaged-reliability-20260720");
const configuredDurationMs = Number(process.env.VIBE_P11_SOAK_DURATION_MS || requiredDurationMs);
const durationMs = Number.isFinite(configuredDurationMs) ? Math.floor(configuredDurationMs) : requiredDurationMs;

assertAcceptance(await pathExists(executablePath), `packaged App executable is missing: ${executablePath}`);
assertAcceptance(projectRoot.startsWith("/tmp/") || projectRoot.startsWith("/private/tmp/"), "P11-A soak project must be an isolated /tmp fixture");
assertAcceptance(await pathExists(projectRoot), `P11-A soak project is missing: ${projectRoot}`);
assertAcceptance(durationMs >= requiredDurationMs, `P11-A ${preflightMode ? "preflight" : "soak"} must run at least ${requiredDurationMs}ms`);

const projectPath = await findProjectPath(projectRoot);
const project = JSON.parse(await readFile(projectPath, "utf8"));
const projectId = String(project.manifest?.projectId || basename(projectRoot));
const displayName = String(project.manifest?.title || projectId);
const root = await mkdtemp("/tmp/vibe-director-p11-a-soak-");
const profileRoot = join(root, "profile");
const runtimeRoot = join(root, "runtime");
const bindingPath = join(profileRoot, "current-project.local.json");
await Promise.all([mkdir(profileRoot, { recursive: true }), mkdir(runtimeRoot, { recursive: true }), mkdir(evidenceRoot, { recursive: true })]);
await writeFile(bindingPath, `${JSON.stringify({
  projectRoot,
  projectRootRelativePath: projectRoot,
  projectVibeRelativePath: basename(projectPath),
  projectId,
  displayName,
}, null, 2)}\n`, "utf8");

const evidencePath = join(evidenceRoot, "packaged-soak-observation.json");
const startedAtMs = Date.now();
const startedAt = new Date(startedAtMs).toISOString();
let baselineProjectHashes: Record<string, string> | undefined;
const restartThresholds = Array.from({ length: requiredRestarts }, (_, index) => Math.floor(durationMs * (index + 1) / (requiredRestarts + 1)));
const advanceThresholds = Array.from({ length: requiredStateAdvances }, (_, index) => Math.floor(durationMs * (index + 1) / (requiredStateAdvances + 1)));
const observations: Array<Record<string, unknown>> = [];
const restarts: Array<Record<string, unknown>> = [];
const stateAdvances: Array<Record<string, unknown>> = [];
let launchCount = 0;
let sampleCount = 0;
let restartCount = 0;
let stateAdvanceCount = 0;
let nextSampleAt = 0;
let app: RunningPackagedApp | undefined;
let activeView: "preview" | "export" = "preview";
let failure = "";

function launchInput() {
  return {
    appPath,
    executablePath,
    profileRoot,
    projectsRoot: dirname(projectRoot),
    runtimeRoot,
    bindingPath,
  };
}

async function activeRailView(app: RunningPackagedApp) {
  return app.client.evaluate<string>(`(() => {
    const active = [...document.querySelectorAll('button[aria-current="page"]')].find((item) => {
      const label = item.getAttribute("aria-label") || "";
      return label.startsWith("视频，") || label === "交付，展示包";
    });
    const label = active?.getAttribute("aria-label") || "";
    return label.startsWith("视频，") ? "preview" : label === "交付，展示包" ? "export" : "";
  })()`);
}

async function waitForSettledTask(label: string) {
  assertAcceptance(app, "packaged soak app is not running");
  let stableIdentity = "";
  let stableSince = 0;
  return waitForAcceptance(async () => {
    const observation = await observePackagedTask(app!.client);
    assertAcceptance(observation.currentTaskCount === 1, `${label} must expose exactly one right Agent current task`);
    const identity = taskIdentity(observation);
    if (identity !== stableIdentity) {
      stableIdentity = identity;
      stableSince = Date.now();
      return undefined;
    }
    return Date.now() - stableSince >= 2_000 ? observation : undefined;
  }, `${label} current Agent task did not settle`, 20_000);
}

async function observe(label: string) {
  assertAcceptance(app, "packaged soak app is not running");
  const observation = await observePackagedTask(app.client);
  assertAcceptance(observation.currentTaskCount === 1, `${label} must expose exactly one right Agent current task`);
  const stagingFiles = await stagedExportFiles(projectRoot);
  assertAcceptance(stagingFiles.length === 0, `${label} found residual export staging files: ${stagingFiles.join(", ")}`);
  const rssKb = await packagedProcessRssKb(app);
  const view = await activeRailView(app);
  const entry = {
    label,
    observedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAtMs,
    launchCount,
    view,
    rssKb,
    task: {
      step: observation.currentTaskStep,
      source: observation.currentTaskSource,
      label: observation.currentTaskLabel,
      identity: taskIdentity(observation),
    },
    duplicateCurrentTask: false,
    stagingFileCount: 0,
  };
  observations.push(entry);
  return { observation, entry };
}

async function openView(view: "preview" | "export") {
  assertAcceptance(app, "packaged soak app is not running");
  if (view === "preview") await openVideoAcceptanceView(app.client);
  else await openExportAcceptanceView(app.client);
  await waitForAcceptance(async () => await activeRailView(app!) === view ? true : undefined, `${view} view did not become active`);
  activeView = view;
}

async function persistEvidence(status: "running" | "preflight_pass" | "pass" | "failed", extra: Record<string, unknown> = {}) {
  const rss = observations.map((item) => Number(item.rssKb)).filter((value) => Number.isFinite(value) && value > 0);
  await writeFile(evidencePath, `${JSON.stringify({
    schemaVersion: "p11_a_packaged_soak/1.0.0",
    status,
    mode: preflightMode ? "preflight" : "acceptance",
    startedAt,
    updatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAtMs,
    required: {
      minimumDurationMs,
      restartCount: requiredRestarts,
      stateAdvanceCount: requiredStateAdvances,
      sampleIntervalMs,
    },
    fixture: { root, projectRoot, projectId, appPath },
    counts: { launchCount, sampleCount, restartCount, stateAdvanceCount },
    rss: {
      sampleCount: rss.length,
      firstKb: rss[0],
      lastKb: rss.at(-1),
      minKb: rss.length ? Math.min(...rss) : undefined,
      maxKb: rss.length ? Math.max(...rss) : undefined,
      deltaKb: rss.length > 1 ? rss.at(-1)! - rss[0]! : undefined,
    },
    observations,
    restarts,
    stateAdvances,
    providerCalls: 0,
    ...extra,
  }, null, 2)}\n`, "utf8");
}

try {
  app = await launchPackagedAcceptanceApp(launchInput());
  launchCount += 1;
  await openView(activeView);
  await waitForSettledTask("initial");
  await observe("initial");
  baselineProjectHashes = await hashSnapshot(projectRoot);
  await persistEvidence("running");

  while (Date.now() - startedAtMs < durationMs) {
    const elapsed = Date.now() - startedAtMs;
    if (restartCount < requiredRestarts && elapsed >= restartThresholds[restartCount]) {
      const before = await observe(`restart_${restartCount + 1}_before`);
      const viewBefore = await activeRailView(app);
      await forceClosePackagedAcceptanceApp(app);
      app = undefined;
      await waitForAcceptance(async () => (await packagedRuntimeProcessIdsForRoot(runtimeRoot)).length === 0 ? true : undefined, `restart ${restartCount + 1} left an orphan Runtime process`, 15_000);
      app = await launchPackagedAcceptanceApp(launchInput());
      launchCount += 1;
      await openView(viewBefore === "export" ? "export" : "preview");
      await waitForSettledTask(`restart_${restartCount + 1}_after`);
      const after = await observe(`restart_${restartCount + 1}_after`);
      assertAcceptance(taskIdentity(before.observation) === taskIdentity(after.observation), `restart ${restartCount + 1} changed the current Agent task identity`);
      restartCount += 1;
      restarts.push({
        index: restartCount,
        atElapsedMs: Date.now() - startedAtMs,
        signal: "SIGKILL",
        runtimeOrphansAfterKill: 0,
        view: viewBefore,
        taskIdentityBefore: taskIdentity(before.observation),
        taskIdentityAfter: taskIdentity(after.observation),
        drift: false,
      });
      await persistEvidence("running");
      continue;
    }

    if (stateAdvanceCount < requiredStateAdvances && elapsed >= advanceThresholds[stateAdvanceCount]) {
      const from = await activeRailView(app);
      const target = stateAdvanceCount % 2 === 0 ? "export" : "preview";
      await openView(target);
      await waitForSettledTask(`state_advance_${stateAdvanceCount + 1}_${target}`);
      const observed = await observe(`state_advance_${stateAdvanceCount + 1}_${target}`);
      stateAdvanceCount += 1;
      stateAdvances.push({
        index: stateAdvanceCount,
        atElapsedMs: Date.now() - startedAtMs,
        kind: "packaged_view_state",
        from,
        to: target,
        activeView: observed.entry.view,
        taskIdentity: taskIdentity(observed.observation),
      });
      await persistEvidence("running");
      continue;
    }

    if (elapsed >= nextSampleAt) {
      sampleCount += 1;
      await observe(`sample_${sampleCount}`);
      nextSampleAt = elapsed + sampleIntervalMs;
      await persistEvidence("running");
    }
    const nextEventAt = Math.min(
      nextSampleAt,
      restartThresholds[restartCount] ?? durationMs,
      advanceThresholds[stateAdvanceCount] ?? durationMs,
      durationMs,
    );
    await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(250, Math.min(5_000, nextEventAt - (Date.now() - startedAtMs)))));
  }

  assertAcceptance(Date.now() - startedAtMs >= requiredDurationMs, "packaged soak elapsed time is below its required duration");
  assertAcceptance(restartCount >= requiredRestarts, `packaged soak did not complete ${requiredRestarts} forced restarts`);
  assertAcceptance(stateAdvanceCount >= requiredStateAdvances, `packaged soak did not complete ${requiredStateAdvances} state advances`);
  const finalObservation = await observe("final");
  assertAcceptance(finalObservation.observation.currentTaskCount === 1, "final packaged soak state lost the unique current task");
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const runtimeOrphans = await waitForAcceptance(async () => {
  const pids = await packagedRuntimeProcessIdsForRoot(runtimeRoot);
  return pids.length === 0 ? [] : undefined;
}, "packaged soak left an orphan Runtime process", 15_000).catch(() => packagedRuntimeProcessIdsForRoot(runtimeRoot));
const finalProjectHashes = await hashSnapshot(projectRoot);
const projectStateDrift = !baselineProjectHashes || JSON.stringify(baselineProjectHashes) !== JSON.stringify(finalProjectHashes);
const finalStagingFiles = await stagedExportFiles(projectRoot);
const logs = await runtimeLogSummary(runtimeRoot, [root, projectRoot, appPath, process.cwd()]);
const rssValues = observations.map((item) => Number(item.rssKb)).filter((value) => Number.isFinite(value) && value > 0);
const rssMaxKb = rssValues.length ? Math.max(...rssValues) : 0;

if (!failure && runtimeOrphans.length > 0) failure = `orphan Runtime processes remain: ${runtimeOrphans.join(",")}`;
if (!failure && projectStateDrift) failure = "project or media files changed during non-mutating soak";
if (!failure && finalStagingFiles.length > 0) failure = `staging files remain: ${finalStagingFiles.join(",")}`;
if (!failure && logs.unexpectedErrorCount > 0) failure = `unexpected packaged stderr lines: ${logs.unexpectedErrorCount}`;
if (!failure && rssValues.length < requiredRestarts + 1) failure = "insufficient RSS samples were captured";
if (!failure && rssMaxKb > 2 * 1024 * 1024) failure = `packaged RSS exceeded 2 GiB: ${rssMaxKb} KiB`;

await persistEvidence(failure ? "failed" : preflightMode ? "preflight_pass" : "pass", {
  completedAt: new Date().toISOString(),
  projectStateDrift,
  finalStagingFiles,
  runtimeOrphanPids: runtimeOrphans,
  logs,
  failure: failure || undefined,
  invariants: {
    elapsedAtLeast60Minutes: !preflightMode && Date.now() - startedAtMs >= minimumDurationMs,
    forcedRestartsAtLeast10: restartCount >= requiredRestarts,
    stateAdvancesAtLeast20: stateAdvanceCount >= requiredStateAdvances,
    oneCurrentTaskAtEveryObservation: observations.every((item) => item.duplicateCurrentTask === false),
    noProjectStateDrift: !projectStateDrift,
    noResidualStaging: finalStagingFiles.length === 0,
    noRuntimeOrphans: runtimeOrphans.length === 0,
    noUnexpectedErrors: logs.unexpectedErrorCount === 0,
    providerCalls: 0,
  },
});

if (failure) throw new Error(`P11-A packaged soak failed: ${failure}. Evidence: ${evidencePath}`);
console.log(JSON.stringify({
  status: preflightMode ? "preflight_pass" : "pass",
  evidencePath,
  elapsedMs: Date.now() - startedAtMs,
  restartCount,
  stateAdvanceCount,
  sampleCount,
  providerCalls: 0,
}, null, 2));
