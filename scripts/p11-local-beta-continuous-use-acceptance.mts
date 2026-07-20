import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  assertAcceptance,
  closePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  observePackagedTask,
  openVideoAcceptanceView,
  packagedRuntimeProcessIdsForRoot,
  pathExists,
  waitForAcceptance,
  type RunningPackagedApp,
} from "./lib/packaged-acceptance-harness.mts";

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
  return Object.fromEntries(await Promise.all(
    (await listFiles(root)).map(async (path) => [path, await sha256(join(root, path))]),
  ));
}

function unzip(source: string, destination: string): void {
  const result = spawnSync("/usr/bin/ditto", ["-x", "-k", source, destination], { encoding: "utf8" });
  assertAcceptance(result.status === 0, `diagnostic ZIP extraction failed: ${result.stderr || result.stdout}`);
}

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const projectRoot = resolve(process.argv[3] || "");
const evidenceRoot = resolve(process.argv[4] || "docs/evidence/p11-f-local-beta-continuous-use-20260721");

assertAcceptance(await pathExists(executablePath), `packaged executable is missing: ${executablePath}`);
assertAcceptance(projectRoot.startsWith("/tmp/") || projectRoot.startsWith("/private/tmp/"), "P11-F diagnostics must use an isolated /tmp project");
assertAcceptance(await pathExists(projectRoot), `P11-F project is missing: ${projectRoot}`);

const projectFileName = (await readdir(projectRoot)).find((name) => name.toLowerCase() === "project.vibe");
assertAcceptance(projectFileName, "P11-F project.vibe is missing");
const projectPath = join(projectRoot, projectFileName);
const project = JSON.parse(await readFile(projectPath, "utf8"));
const projectId = String(project.manifest?.projectId || basename(projectRoot));
const displayName = String(project.manifest?.title || projectId);

await mkdir(evidenceRoot, { recursive: true });
const root = await mkdtemp("/tmp/vibe-director-p11-f-diagnostics-");
const profileRoot = join(root, "profile");
const runtimeRoot = join(root, "runtime");
const bindingPath = join(profileRoot, "current-project.local.json");
const diagnosticOutputPath = join(root, "Vibe-Director-Diagnostics.zip");
const diagnosticExtractRoot = join(root, "diagnostic-extracted");
const screenshotPath = join(evidenceRoot, "01-post-soak-confirmation-and-diagnostics.png");
const diagnosticSettingsScreenshotPath = join(evidenceRoot, "02-diagnostic-exported-from-settings.png");
await Promise.all([
  mkdir(profileRoot, { recursive: true }),
  mkdir(runtimeRoot, { recursive: true }),
  mkdir(diagnosticExtractRoot, { recursive: true }),
]);
await writeFile(bindingPath, `${JSON.stringify({
  projectRoot,
  projectRootRelativePath: projectRoot,
  projectVibeRelativePath: projectFileName,
  projectId,
  displayName,
}, null, 2)}\n`, "utf8");

const projectHashesBefore = await hashSnapshot(projectRoot);
let app: RunningPackagedApp | undefined;
let currentTask: Awaited<ReturnType<typeof observePackagedTask>> | undefined;
try {
  app = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot,
    projectsRoot: dirname(projectRoot),
    runtimeRoot,
    bindingPath,
    extraEnv: { VIBE_ELECTRON_ACCEPTANCE_DIAGNOSTICS_OUTPUT: diagnosticOutputPath },
  });
  await openVideoAcceptanceView(app.client);
  currentTask = await waitForAcceptance(async () => {
    const task = await observePackagedTask(app!.client);
    const state = await app!.client.evaluate<{
      confirmationVisible: boolean;
      reviewVisible: boolean;
      confirmationEnabled: boolean;
      mediaReady: boolean;
    }>(`(() => {
      const confirmation = document.querySelector('[aria-label="当前生成任务确认"]');
      const review = document.querySelector('[aria-label="当前视频复核"]');
      const button = [...(confirmation?.querySelectorAll("button") || [])].find((item) => item.textContent?.includes("确认并"));
      const video = document.querySelector("video");
      return {
        confirmationVisible: Boolean(confirmation && confirmation.getClientRects().length),
        reviewVisible: Boolean(review && review.getClientRects().length),
        confirmationEnabled: Boolean(button && !button.disabled),
        mediaReady: Boolean(video && video.readyState >= 2)
      };
    })()`);
    return task.currentTaskCount === 1
      && task.currentTaskStep === "submit_video"
      && task.currentTaskSource === "timeline_confirmation"
      && task.currentTaskLabel === "确认验证视频流程"
      && state.confirmationVisible
      && !state.reviewVisible
      && state.confirmationEnabled
      && state.mediaReady
      ? task
      : undefined;
  }, "post-soak packaged state did not restore the one enabled execution confirmation", 40_000);

  const seekStarted = await app.client.evaluate<boolean>(`(() => {
    const video = document.querySelector("video");
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return false;
    video.currentTime = Math.min(1, video.duration / 2);
    return true;
  })()`);
  assertAcceptance(seekStarted, "P11-F local review media could not seek for visual evidence");
  await waitForAcceptance(async () => {
    const painted = await app!.client.evaluate<boolean>(`(() => {
      const video = document.querySelector("video");
      return Boolean(video && !video.seeking && video.currentTime >= 0.5 && video.readyState >= 2);
    })()`);
    return painted ? true : undefined;
  }, "P11-F local review media did not paint a non-initial frame");
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));

  const screenshot = await app.client.send("capture_page");
  assertAcceptance(typeof screenshot === "string" && screenshot.length > 1000, "P11-F packaged screenshot is empty");
  await writeFile(screenshotPath, Buffer.from(screenshot, "base64"));

  const settingsOpened = await app.client.evaluate<boolean>(`(() => {
    const button = document.querySelector('button[aria-label="设置"]');
    button?.click();
    return Boolean(button);
  })()`);
  assertAcceptance(settingsOpened, "P11-F could not open packaged Settings");
  await waitForAcceptance(async () => {
    const visible = await app!.client.evaluate<boolean>(`Boolean(document.querySelector('[role="dialog"][aria-label="设置"]'))`);
    return visible ? true : undefined;
  }, "P11-F packaged Settings did not become visible");
  await waitForAcceptance(async () => {
    const clicked = await app!.client.evaluate<boolean>(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="设置"]');
      const button = [...(dialog?.querySelectorAll("button") || [])].find((item) => item.textContent?.trim() === "导出诊断日志" && !item.disabled);
      button?.click();
      return Boolean(button);
    })()`);
    return clicked ? true : undefined;
  }, "P11-F packaged diagnostic export button was unavailable");
  const diagnosticStatus = await waitForAcceptance(async () => {
    const status = await app!.client.evaluate<string>(`document.querySelector('[role="dialog"][aria-label="设置"] [role="status"]')?.textContent?.trim() || ""`);
    return status.endsWith("已导出。") ? status : undefined;
  }, "P11-F packaged diagnostic export did not complete");
  assertAcceptance(diagnosticStatus.length > 0, "P11-F packaged diagnostic export did not report completion");
  assertAcceptance(await pathExists(diagnosticOutputPath), "P11-F diagnostic ZIP was not created");
  const diagnosticSettingsScreenshot = await app.client.send("capture_page");
  assertAcceptance(typeof diagnosticSettingsScreenshot === "string" && diagnosticSettingsScreenshot.length > 1000, "P11-F packaged Settings screenshot is empty");
  await writeFile(diagnosticSettingsScreenshotPath, Buffer.from(diagnosticSettingsScreenshot, "base64"));
} finally {
  if (app) await closePackagedAcceptanceApp(app).catch(() => undefined);
}

const runtimeOrphanPids = await waitForAcceptance(async () => {
  const pids = await packagedRuntimeProcessIdsForRoot(runtimeRoot);
  return pids.length === 0 ? [] : undefined;
}, "P11-F diagnostics left an orphan Runtime process", 15_000).catch(() => packagedRuntimeProcessIdsForRoot(runtimeRoot));
assertAcceptance(runtimeOrphanPids.length === 0, `P11-F diagnostics left Runtime processes: ${runtimeOrphanPids.join(",")}`);

const projectHashesAfter = await hashSnapshot(projectRoot);
assertAcceptance(JSON.stringify(projectHashesAfter) === JSON.stringify(projectHashesBefore), "diagnostic export or restore changed the soaked project");

unzip(diagnosticOutputPath, diagnosticExtractRoot);
const diagnosticRoot = join(diagnosticExtractRoot, "Vibe Director Diagnostics");
const manifestPath = join(diagnosticRoot, "diagnostics.json");
const manifestText = await readFile(manifestPath, "utf8");
const runtimeLogText = await readFile(join(diagnosticRoot, "runtime.log"), "utf8");
const readmeText = await readFile(join(diagnosticRoot, "README.txt"), "utf8");
const combinedText = `${manifestText}\n${runtimeLogText}\n${readmeText}`;
const manifest = JSON.parse(manifestText);

assertAcceptance(manifest.app?.packaged === true, "diagnostics did not identify a packaged App");
assertAcceptance(manifest.project?.bound === true && manifest.project?.projectVibePresent === true, "diagnostics did not identify the bound project");
assertAcceptance(manifest.project?.projectVibeSha256 === `sha256:${await sha256(projectPath)}`, "diagnostics project hash does not match project.vibe");
for (const key of ["credentialsIncluded", "tokensIncluded", "fullProjectFilesIncluded", "mediaIncluded", "absolutePathsIncluded"]) {
  assertAcceptance(manifest.privacy?.[key] === false, `diagnostics privacy boundary failed: ${key}`);
}
for (const forbidden of [projectRoot, profileRoot, runtimeRoot, process.cwd(), "P11ES01-version-a.mp4"]) {
  assertAcceptance(!combinedText.includes(forbidden), `diagnostics leaked forbidden material: ${forbidden}`);
}
assertAcceptance(!/(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/.test(combinedText), "diagnostics leaked credential-like material");

const sidecars = new Map<string, any>((manifest.sidecars || []).map((item: any) => [item.relativePath, item]));
const generationLedger = sidecars.get(".vibe-runtime/agent-generation-job-ledger.json");
const stagedPlan = sidecars.get(".vibe-runtime/agent-staged-plan.json");
const timeline = sidecars.get(".vibe-runtime/agent-timeline.json");
assertAcceptance(generationLedger?.recordCount === 2, "diagnostics did not summarize both generation jobs");
assertAcceptance(
  Number(generationLedger?.statusCounts?.succeeded || 0) >= 1
    && Number(generationLedger?.statusCounts?.staged || 0) >= 1,
  "diagnostics did not retain succeeded + staged job statuses",
);
assertAcceptance(stagedPlan?.topLevelStatus === "active", "diagnostics did not retain the active staged-plan status");
assertAcceptance(Number(timeline?.recordCount || 0) >= 5, "diagnostics did not retain the Agent timeline structure");

const observation = {
  schemaVersion: "p11_f_local_beta_continuous_use/1.0.0",
  observedAt: new Date().toISOString(),
  status: "pass_local_packaged",
  packagedApp: appPath,
  fixtureRoot: root,
  projectRoot,
  currentTask: {
    count: currentTask?.currentTaskCount,
    step: currentTask?.currentTaskStep,
    source: currentTask?.currentTaskSource,
    label: currentTask?.currentTaskLabel,
    confirmationEnabled: true,
    oldReviewVisible: false,
  },
  diagnostic: {
    outputPath: diagnosticOutputPath,
    fileName: basename(diagnosticOutputPath),
    sizeBytes: (await stat(diagnosticOutputPath)).size,
    sha256: await sha256(diagnosticOutputPath),
    sidecarCount: manifest.sidecars.length,
    generationLedger: {
      recordCount: generationLedger.recordCount,
      statusCounts: generationLedger.statusCounts,
    },
    stagedPlanStatus: stagedPlan.topLevelStatus,
    timelineRecordCount: timeline.recordCount,
    privacy: manifest.privacy,
  },
  projectStateDrift: false,
  runtimeOrphanPids,
  providerCalls: 0,
  providerFees: 0,
  finalExecutionConfirmed: false,
  exportPerformed: false,
  realProviderExecutionVerified: false,
  screenshot: {
    fileName: basename(screenshotPath),
    sha256: await sha256(screenshotPath),
  },
  diagnosticSettingsScreenshot: {
    fileName: basename(diagnosticSettingsScreenshotPath),
    sha256: await sha256(diagnosticSettingsScreenshotPath),
  },
};
await writeFile(join(evidenceRoot, "diagnostic-observation.json"), `${JSON.stringify(observation, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: observation.status,
  evidenceRoot,
  diagnosticSha256: observation.diagnostic.sha256,
  screenshotSha256: observation.screenshot.sha256,
  providerCalls: 0,
}, null, 2));
