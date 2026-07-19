import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import { projectAgentGenerationJobLedgerPath } from "../src/project/projectAgentGenerationJobLedger.ts";
import { projectAgentReviewSelectionLedgerPath } from "../src/project/projectAgentReviewSelectionLedger.ts";
import { projectAgentTimelinePath } from "../src/project/projectAgentTimeline.ts";
import {
  assertAcceptance,
  closePackagedAcceptanceApp,
  forceClosePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  observePackagedTask,
  openExportAcceptanceView,
  openVideoAcceptanceView,
  packagedRuntimeProcessIdsForRoot,
  pathExists,
  waitForAcceptance,
  type PackagedAcceptanceClient,
  type RunningPackagedApp,
} from "./lib/packaged-acceptance-harness.mts";

interface ScenarioFixture {
  root: string;
  profileRoot: string;
  projectsRoot: string;
  runtimeRoot: string;
  projectRoot: string;
  projectPath: string;
  bindingPath: string;
  projectId: string;
  title: string;
}

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

async function runCommand(command: string, args: string[], env: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${command} exited with ${code}/${signal}\n${stdout}\n${stderr}`));
    });
  });
}

async function findProjectFile(projectRoot: string): Promise<string> {
  const file = (await readdir(projectRoot)).find((name) => name.toLowerCase() === "project.vibe");
  assertAcceptance(file, `project file is missing in ${projectRoot}`);
  return join(projectRoot, file);
}

async function createScenarioFixture(input: {
  scenariosRoot: string;
  name: string;
  sourceProjectRoot: string;
}): Promise<ScenarioFixture> {
  const root = join(input.scenariosRoot, input.name);
  const profileRoot = join(root, "profile");
  const projectsRoot = join(root, "projects");
  const runtimeRoot = join(root, "runtime");
  const projectRoot = join(projectsRoot, basename(input.sourceProjectRoot));
  await Promise.all([
    mkdir(profileRoot, { recursive: true }),
    mkdir(runtimeRoot, { recursive: true }),
    mkdir(projectsRoot, { recursive: true }),
  ]);
  await cp(input.sourceProjectRoot, projectRoot, { recursive: true, force: true });
  const projectPath = await findProjectFile(projectRoot);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  const projectId = String(project.manifest?.projectId || basename(projectRoot));
  const title = String(project.manifest?.title || projectId);
  const bindingPath = join(profileRoot, "current-project.local.json");
  await writeFile(bindingPath, `${JSON.stringify({
    projectRoot,
    projectRootRelativePath: projectRoot,
    projectVibeRelativePath: basename(projectPath),
    projectId,
    displayName: title,
  }, null, 2)}\n`, "utf8");
  return { root, profileRoot, projectsRoot, runtimeRoot, projectRoot, projectPath, bindingPath, projectId, title };
}

async function createStageScenarioFixture(input: {
  scenariosRoot: string;
  name: string;
  stageProjectRoot: string;
  canonicalProjectRoot: string;
}): Promise<ScenarioFixture> {
  const root = join(input.scenariosRoot, input.name);
  const profileRoot = join(root, "profile");
  const runtimeRoot = join(root, "runtime");
  const projectsRoot = dirname(input.canonicalProjectRoot);
  await rm(input.canonicalProjectRoot, { recursive: true, force: true });
  await Promise.all([
    mkdir(profileRoot, { recursive: true }),
    mkdir(runtimeRoot, { recursive: true }),
    mkdir(projectsRoot, { recursive: true }),
  ]);
  await cp(input.stageProjectRoot, input.canonicalProjectRoot, { recursive: true, force: true });
  const projectPath = await findProjectFile(input.canonicalProjectRoot);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  const projectId = String(project.manifest?.projectId || basename(input.canonicalProjectRoot));
  const title = String(project.manifest?.title || projectId);
  const bindingPath = join(profileRoot, "current-project.local.json");
  await writeFile(bindingPath, `${JSON.stringify({
    projectRoot: input.canonicalProjectRoot,
    projectRootRelativePath: input.canonicalProjectRoot,
    projectVibeRelativePath: basename(projectPath),
    projectId,
    displayName: title,
  }, null, 2)}\n`, "utf8");
  return {
    root,
    profileRoot,
    projectsRoot,
    runtimeRoot,
    projectRoot: input.canonicalProjectRoot,
    projectPath,
    bindingPath,
    projectId,
    title,
  };
}

function launchInput(appPath: string, executablePath: string, fixture: ScenarioFixture, extraEnv?: Record<string, string>) {
  return {
    appPath,
    executablePath,
    profileRoot: fixture.profileRoot,
    projectsRoot: fixture.projectsRoot,
    runtimeRoot: fixture.runtimeRoot,
    bindingPath: fixture.bindingPath,
    extraEnv,
  };
}

async function clickEnabledButton(client: PackagedAcceptanceClient, exactText: string): Promise<void> {
  const clicked = await client.evaluate<boolean>(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === ${JSON.stringify(exactText)} && !item.disabled);
    button?.click();
    return Boolean(button);
  })()`);
  assertAcceptance(clicked, `could not click enabled button: ${exactText}`);
}

async function waitForExportConfirmation(client: PackagedAcceptanceClient): Promise<void> {
  await openExportAcceptanceView(client);
  await waitForAcceptance(async () => {
    const count = await client.evaluate<number>(`[...document.querySelectorAll(".minimal-agent-message.is-current-confirmation")].filter((message) => (
      message.textContent?.includes("建议行动：导出交付包")
      && [...message.querySelectorAll("button")].some((item) => item.textContent?.trim() === "确认导出" && !item.disabled)
    )).length`);
    return count === 1 ? count : undefined;
  }, "the bound footer Delivery confirmation did not become available", 60_000);
}

async function waitForExportFailure(client: PackagedAcceptanceClient): Promise<string> {
  return waitForAcceptance(async () => {
    const message = await client.evaluate<string>(`document.querySelector(".export-action-status.failed")?.textContent?.trim() || ""`);
    return message.includes("导出失败") ? message : undefined;
  }, "packaged export did not surface a deterministic failure", 90_000);
}

async function stagedExportFiles(projectRoot: string): Promise<string[]> {
  const roots = [join(projectRoot, "exports", ".vibe-staging"), join(projectRoot, "reports", "exports", ".vibe-staging")];
  const result: string[] = [];
  for (const root of roots) {
    for (const file of await listFiles(root)) result.push(`${relative(projectRoot, root).replace(/\\/g, "/")}/${file}`);
  }
  return result.sort();
}

async function setTreeReadOnly(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      await setTreeReadOnly(path);
      await chmod(path, 0o555);
    } else {
      await chmod(path, 0o444);
    }
  }
  await chmod(root, 0o555);
}

async function setTreeWritable(root: string): Promise<void> {
  await chmod(root, 0o755);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) await setTreeWritable(path);
    else await chmod(path, 0o644);
  }
}

function assertOneCurrentTask(observation: Record<string, unknown>, label: string): void {
  assertAcceptance(
    observation.currentTaskCount === 1,
    `${label} must retain exactly one current Agent task: ${JSON.stringify(observation)}`,
  );
}

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const evidenceRoot = resolve(process.argv[3] || "docs/evidence/p11-a-packaged-reliability-20260720");
const oldProjectSource = resolve(process.argv[4] || "real-test-sandbox/fresh-storyboard-seedance720-20260522-03");
assertAcceptance(await pathExists(executablePath), `packaged App executable is missing: ${executablePath}`);
assertAcceptance(await pathExists(oldProjectSource), `old project fixture is missing: ${oldProjectSource}`);

await mkdir(evidenceRoot, { recursive: true });
const root = await mkdtemp("/tmp/vibe-director-p11-a-");
const stageSnapshotRoot = join(root, "stage-snapshots");
const p10EvidenceRoot = join(root, "fresh-chain-evidence");
const scenariosRoot = join(root, "scenarios");
await mkdir(scenariosRoot, { recursive: true });

const freshChainRun = await runCommand("npx", [
  "tsx",
  "scripts/agent-director-workflow-packaged-acceptance.mts",
  appPath,
  p10EvidenceRoot,
], {
  VIBE_P11_FORCE_RESTARTS: "1",
  VIBE_P11_STAGE_SNAPSHOT_ROOT: stageSnapshotRoot,
  VIBE_APIKEY_FUN_API_KEY: "",
  VIBE_DEEPSEEK_API_KEY: "",
  VIBE_TTS_API_KEY: "",
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  GEMINI_API_KEY: "",
});
const freshChain = JSON.parse(await readFile(join(p10EvidenceRoot, "packaged-observation.json"), "utf8"));
assertAcceptance(freshChain.status === "pass" && freshChain.invariants?.providerCalls === 0, "forced-restart fresh chain did not pass with Provider closed");
const canonicalFreshProjectRoot = String(freshChain.fixture?.projectRoot || "");
assertAcceptance(canonicalFreshProjectRoot.startsWith("/tmp/vibe-director-p10-e-"), "fresh chain canonical project root must stay inside its /tmp fixture");
await waitForAcceptance(async () => {
  const pids = await packagedRuntimeProcessIdsForRoot(freshChain.fixture?.runtimeRoot || "");
  return pids.length === 0 ? true : undefined;
}, "forced-restart fresh chain left an orphan Runtime process", 10_000);
for (const stage of ["review", "running", "version-review", "selection-confirmation", "promotion-confirmation", "delivery-confirmation", "delivered"]) {
  assertAcceptance(await pathExists(join(stageSnapshotRoot, stage, "project.vibe")), `fresh chain did not preserve ${stage} snapshot`);
}

const results: Record<string, unknown> = {};
const sourceBefore = await hashSnapshot(oldProjectSource);
const migrated = await createScenarioFixture({ scenariosRoot, name: "migrated-old-project", sourceProjectRoot: oldProjectSource });
const migratedBefore = await hashSnapshot(migrated.projectRoot);
let app: RunningPackagedApp | undefined;
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, migrated));
  await waitForAcceptance(async () => {
    const visible = await app!.client.evaluate<boolean>(`document.body.innerText.includes(${JSON.stringify(migrated.title)})`);
    return visible ? true : undefined;
  }, "old project copy did not open in the packaged App");
  const observation = await observePackagedTask(app.client);
  assertOneCurrentTask(observation, "migrated old project");
  results.migratedOldProject = {
    status: "pass",
    sourceProjectRoot: oldProjectSource,
    copiedProjectRoot: migrated.projectRoot,
    observation,
    copyChangedDuringOpen: JSON.stringify(migratedBefore) !== JSON.stringify(await hashSnapshot(migrated.projectRoot)),
  };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}
assertAcceptance(JSON.stringify(sourceBefore) === JSON.stringify(await hashSnapshot(oldProjectSource)), "old source project changed during migration acceptance");

const corruptGeneration = await createStageScenarioFixture({ scenariosRoot, name: "corrupt-generation-ledger", stageProjectRoot: join(stageSnapshotRoot, "running"), canonicalProjectRoot: canonicalFreshProjectRoot });
await writeFile(join(corruptGeneration.projectRoot, projectAgentGenerationJobLedgerPath), "{\"schemaVersion\":", "utf8");
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, corruptGeneration));
  await openVideoAcceptanceView(app.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  const observation = await observePackagedTask(app.client);
  assertOneCurrentTask(observation, "corrupt generation ledger");
  assertAcceptance(observation.runningTurnCount === 0 && observation.promotionTurnCount === 0, "corrupt generation ledger must not restore Running or promotion");
  results.corruptGenerationLedger = { status: "pass", observation };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const corruptSelection = await createStageScenarioFixture({ scenariosRoot, name: "corrupt-selection-ledger", stageProjectRoot: join(stageSnapshotRoot, "promotion-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
await writeFile(join(corruptSelection.projectRoot, projectAgentReviewSelectionLedgerPath), "not-json", "utf8");
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, corruptSelection));
  await openVideoAcceptanceView(app.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  const observation = await observePackagedTask(app.client);
  assertOneCurrentTask(observation, "corrupt selection ledger");
  assertAcceptance(observation.selectionTurnCount === 0 && observation.promotionTurnCount === 0, "corrupt selection ledger must not restore selection or promotion confirmation");
  assertAcceptance((observation.enabledConfirmations as string[]).length === 0, "corrupt selection ledger must not expose an enabled irreversible confirmation");
  results.corruptSelectionLedger = { status: "pass", observation };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const corruptTimeline = await createStageScenarioFixture({ scenariosRoot, name: "corrupt-timeline", stageProjectRoot: join(stageSnapshotRoot, "delivery-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
await writeFile(join(corruptTimeline.projectRoot, projectAgentTimelinePath), "[] trailing-garbage", "utf8");
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, corruptTimeline));
  await openExportAcceptanceView(app.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  const observation = await observePackagedTask(app.client);
  assertOneCurrentTask(observation, "corrupt timeline");
  assertAcceptance(observation.runningTurnCount === 0 && observation.reviewTurnCount === 0 && observation.selectionTurnCount === 0 && observation.promotionTurnCount === 0, "corrupt timeline must not revive stale workflow turns");
  results.corruptTimeline = { status: "pass", observation };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const missingMedia = await createStageScenarioFixture({ scenariosRoot, name: "missing-version-b-media", stageProjectRoot: join(stageSnapshotRoot, "selection-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
await rm(join(missingMedia.projectRoot, "video", "P10ES01-version-b.mp4"), { force: true });
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, missingMedia));
  await openVideoAcceptanceView(app.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  const observation = await observePackagedTask(app.client);
  assertOneCurrentTask(observation, "missing candidate media");
  assertAcceptance(observation.promotionTurnCount === 0, "missing winner media must not reach promotion");
  assertAcceptance(!(observation.enabledConfirmations as string[]).some((label) => label?.includes("确认选择版本 B") || label === "确认晋级项目事实" || label === "确认导出"), "missing winner media must fail closed before selection, promotion, and Delivery");
  results.missingMedia = { status: "pass", observation };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const readOnly = await createStageScenarioFixture({ scenariosRoot, name: "read-only-delivery", stageProjectRoot: join(stageSnapshotRoot, "delivery-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
await setTreeReadOnly(readOnly.projectRoot);
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, readOnly));
  await openExportAcceptanceView(app.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  const confirmationCount = await app.client.evaluate<number>(`[...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length`);
  let failure = "blocked before write";
  if (confirmationCount === 1) {
    await clickEnabledButton(app.client, "确认导出");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2500));
    const surfacedFailure = await app.client.evaluate<string>(`document.querySelector(".export-action-status.failed")?.textContent?.trim() || ""`);
    const retryConfirmationCount = await app.client.evaluate<number>(`[...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length`);
    failure = surfacedFailure || (retryConfirmationCount === 1 ? "write refused; confirmation restored" : "");
    assertAcceptance(failure, "read-only export must fail or return to one explicit confirmation");
  }
  const observation = await observePackagedTask(app.client);
  assertOneCurrentTask(observation, "read-only project");
  assertAcceptance(!await pathExists(join(readOnly.projectRoot, "exports", "current-project")), "read-only project must not publish a Delivery package");
  const readOnlyLedger = JSON.parse(await readFile(join(readOnly.projectRoot, projectAgentGenerationJobLedgerPath), "utf8"));
  assertAcceptance(!readOnlyLedger.jobs?.some((job: { kind?: string }) => job.kind === "export"), "read-only project must not persist a partial export job");
  results.readOnlyProject = { status: "pass", confirmationCount, failure, observation };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
  await setTreeWritable(readOnly.projectRoot);
}

const diskWriteFailure = await createStageScenarioFixture({ scenariosRoot, name: "disk-write-failure", stageProjectRoot: join(stageSnapshotRoot, "delivery-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, diskWriteFailure, {
    VIBE_ELECTRON_ACCEPTANCE_EXPORT_FAULT: "write_enospc",
  }));
  await waitForExportConfirmation(app.client);
  await clickEnabledButton(app.client, "确认导出");
  const failure = await waitForExportFailure(app.client);
  const diskFailureLedger = JSON.parse(await readFile(join(diskWriteFailure.projectRoot, projectAgentGenerationJobLedgerPath), "utf8"));
  const diskFailureJob = [...diskFailureLedger.jobs].reverse().find((job: { kind?: string }) => job.kind === "export");
  assertAcceptance(diskFailureJob?.status === "failed", "simulated disk-full export must persist a failed job");
  assertAcceptance(
    diskFailureJob.statusHistory?.at(-1)?.error?.includes("simulated disk write failure"),
    "simulated disk-full export must preserve the exact failure in job history",
  );
  assertAcceptance(!await pathExists(join(diskWriteFailure.projectRoot, "exports", "current-project")), "disk write failure must not publish a Delivery package");
  const stagingFiles = await stagedExportFiles(diskWriteFailure.projectRoot);
  assertAcceptance(stagingFiles.length === 0, `disk write failure left staging files: ${stagingFiles.join(", ")}`);
  results.diskWriteFailure = { status: "pass", failure, jobStatus: diskFailureJob.status, stagingFiles };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const publishFailure = await createStageScenarioFixture({ scenariosRoot, name: "publish-failure", stageProjectRoot: join(stageSnapshotRoot, "delivery-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, publishFailure, {
    VIBE_ELECTRON_ACCEPTANCE_EXPORT_FAULT: "publish_enospc",
  }));
  await waitForExportConfirmation(app.client);
  await clickEnabledButton(app.client, "确认导出");
  const failure = await waitForExportFailure(app.client);
  assertAcceptance(!await pathExists(join(publishFailure.projectRoot, "exports", "current-project")), "publish failure must not expose a partial final package");
  const stagingFiles = await stagedExportFiles(publishFailure.projectRoot);
  assertAcceptance(stagingFiles.length === 0, `publish failure left staging files: ${stagingFiles.join(", ")}`);
  results.publishFailure = { status: "pass", failure, stagingFiles };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const interruptedExport = await createStageScenarioFixture({ scenariosRoot, name: "interrupted-export", stageProjectRoot: join(stageSnapshotRoot, "delivery-confirmation"), canonicalProjectRoot: canonicalFreshProjectRoot });
try {
  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, interruptedExport, {
    VIBE_ELECTRON_ACCEPTANCE_EXPORT_PUBLISH_DELAY_MS: "30000",
  }));
  await waitForExportConfirmation(app.client);
  await clickEnabledButton(app.client, "确认导出");
  await waitForAcceptance(async () => (await stagedExportFiles(interruptedExport.projectRoot)).length > 0 ? true : undefined, "interrupted export did not reach staging", 30_000);
  await forceClosePackagedAcceptanceApp(app);
  app = undefined;
  assertAcceptance(!await pathExists(join(interruptedExport.projectRoot, "exports", "current-project")), "forced termination must not expose a partial final package");

  app = await launchPackagedAcceptanceApp(launchInput(appPath, executablePath, interruptedExport));
  await openExportAcceptanceView(app.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  const restored = await observePackagedTask(app.client);
  assertOneCurrentTask(restored, "interrupted export restore");
  assertAcceptance(restored.runningTurnCount === 0, "interrupted local export must not remain an unrecoverable Running turn");
  await waitForExportConfirmation(app.client);
  await clickEnabledButton(app.client, "确认导出");
  await waitForAcceptance(async () => await pathExists(join(interruptedExport.projectRoot, "exports", "current-project", "export_manifest.json")) ? true : undefined, "explicit export recovery did not publish", 60_000);
  const stagingFiles = await stagedExportFiles(interruptedExport.projectRoot);
  assertAcceptance(stagingFiles.length === 0, `recovered export left stale staging files: ${stagingFiles.join(", ")}`);
  results.interruptedExport = { status: "pass", restored, stagingFiles };
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

const evidence = {
  schemaVersion: "p11_a_packaged_reliability/1.0.0",
  status: "pass",
  acceptedAt: new Date().toISOString(),
  root,
  appPath,
  freshChain: {
    status: freshChain.status,
    projectRoot: freshChain.fixture?.projectRoot,
    stageSnapshotRoot,
    forcedStageRestarts: freshChain.invariants?.forcedStageRestarts,
    providerCalls: freshChain.invariants?.providerCalls,
    stdoutTail: freshChainRun.stdout.slice(-2000),
  },
  results,
  invariants: {
    providerCalls: 0,
    originalOldProjectUnchanged: true,
    freshProjectCovered: true,
    oldProjectCopyCovered: true,
    forcedWorkflowRestarts: 5,
    corruptSidecarsFailClosed: true,
    missingMediaFailsClosed: true,
    readOnlyPathFailsClosed: true,
    diskWriteFailureFailsClosed: true,
    interruptedExportRequiresExplicitRecovery: true,
    noPartialFinalPackage: true,
  },
};
await writeFile(join(evidenceRoot, "packaged-reliability-observation.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "pass",
  root,
  evidencePath: join(evidenceRoot, "packaged-reliability-observation.json"),
  providerCalls: 0,
}, null, 2));
