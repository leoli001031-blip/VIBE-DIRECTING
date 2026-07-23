import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import {
  closePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  openVideoAcceptanceView,
  waitForAcceptance,
} from "./lib/packaged-acceptance-harness.mts";

const projectRoot = resolve(process.env.VIBE_P13_REVIEW_PROJECT_ROOT || "/tmp/vibe-director-p13-a-20260723/projects/p13-provider-canary");
const acceptanceRoot = resolve(process.env.VIBE_P13_D_ACCEPTANCE_ROOT || "/tmp/vibe-director-p13-d-session-timeline-20260723");
const appPath = resolve(process.env.VIBE_P13_APP_PATH || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const projectPath = join(projectRoot, "project.vibe");
const ledgerPath = join(projectRoot, ".vibe-runtime", "agent-generation-job-ledger.json");
const resultReceiptPath = join(projectRoot, "reports", "p13-provider-canary", "seedance-result-receipt.json");
const profileRoot = join(acceptanceRoot, "profile");
const runtimeRoot = join(acceptanceRoot, "runtime");
const evidenceRoot = join(acceptanceRoot, "evidence");
const bindingPath = join(profileRoot, "current-project.local.json");
const observationPath = join(evidenceRoot, "packaged-observation.json");
const desktopScreenshotPath = join(evidenceRoot, "01-review-session-timeline-desktop.png");
const constrainedScreenshotPath = join(evidenceRoot, "02-review-session-timeline-constrained.png");

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function exists(path: string) {
  return access(path).then(() => true).catch(() => false);
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function readJson<T = any>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function setBoundsAndWait(client: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>>["client"], width: number, height: number) {
  await client.send("set_bounds", { width, height });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 450));
}

async function observeSessionTimeline(client: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>>["client"]) {
  return client.evaluate<any>(`(() => {
    const timeline = document.querySelector('[aria-label="导演会话时间线"]');
    const phaseRows = [...(timeline?.querySelectorAll('[data-session-phase]') || [])];
    const phase = (id) => phaseRows.find((row) => row.getAttribute('data-session-phase') === id);
    const review = document.querySelector('[aria-label="当前视频复核"]');
    const reviewButtons = [...(review?.querySelectorAll('button') || [])];
    const buttonByText = (text) => reviewButtons.find((button) => button.textContent?.trim() === text);
    const approve = buttonByText('通过预览');
    const revise = buttonByText('需要修改');
    const promotion = review?.querySelector('.minimal-agent-review-promotion');
    const timelineRect = timeline?.getBoundingClientRect();
    const reviewRect = review?.getBoundingClientRect();
    const composerRect = document.querySelector('.director-agent-rail .minimal-agent-input')?.getBoundingClientRect();
    const visibleReview = Boolean(reviewRect && reviewRect.width > 0 && reviewRect.height > 0);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timelineCount: document.querySelectorAll('[aria-label="导演会话时间线"]').length,
      phaseCount: phaseRows.length,
      currentPhaseCount: phaseRows.filter((row) => row.getAttribute('data-session-phase-state') === 'current').length,
      currentPhase: timeline?.getAttribute('data-session-current-phase') || '',
      ariaCurrentPhase: phaseRows.find((row) => row.getAttribute('aria-current') === 'step')?.getAttribute('data-session-phase') || '',
      clarifyState: phase('clarify')?.getAttribute('data-session-phase-state') || '',
      proposalState: phase('proposal')?.getAttribute('data-session-phase-state') || '',
      confirmationState: phase('confirmation')?.getAttribute('data-session-phase-state') || '',
      runningState: phase('running')?.getAttribute('data-session-phase-state') || '',
      reviewState: phase('review')?.getAttribute('data-session-phase-state') || '',
      promotionState: phase('promotion')?.getAttribute('data-session-phase-state') || '',
      deliveryState: phase('delivery')?.getAttribute('data-session-phase-state') || '',
      reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
      reviewVisible: visibleReview,
      reviewApprovalEnabled: Boolean(approve && !approve.disabled),
      reviewRevisionEnabled: Boolean(revise && !revise.disabled),
      promotionDisabled: Boolean(promotion?.disabled),
      runningTurnCount: document.querySelectorAll('[aria-label="当前运行任务"]').length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      reviewWithinTimeline: Boolean(timelineRect && reviewRect && reviewRect.left >= timelineRect.left && reviewRect.right <= timelineRect.right + 1),
      composerAfterTimeline: Boolean(timelineRect && composerRect && composerRect.top >= timelineRect.bottom - 1),
      actionTextFits: [approve, revise, promotion].filter(Boolean).every((button) => button.scrollWidth <= button.clientWidth + 1),
      bodyText: document.body.innerText.slice(0, 7000),
    };
  })()`);
}

function assertTimelineObservation(observation: any, label: string) {
  assertCondition(observation.timelineCount === 1, `${label}: expected one Session Timeline`);
  assertCondition(observation.phaseCount === 7, `${label}: expected seven bounded phases`);
  assertCondition(observation.currentPhaseCount === 1, `${label}: expected exactly one current phase`);
  assertCondition(observation.currentPhase === "review" && observation.ariaCurrentPhase === "review", `${label}: Review is not the sole current phase`);
  assertCondition(observation.runningState === "complete" && observation.runningTurnCount === 0, `${label}: old Running still appears active`);
  assertCondition(observation.reviewState === "current" && observation.reviewTurnCount === 1 && observation.reviewVisible, `${label}: Review turn is not visible inside the current phase`);
  assertCondition(observation.promotionState === "locked" && observation.deliveryState === "locked", `${label}: future confirmation boundaries are not locked`);
  assertCondition(observation.reviewApprovalEnabled && observation.reviewRevisionEnabled, `${label}: existing Review actions are not available`);
  assertCondition(observation.promotionDisabled, `${label}: project-fact promotion became actionable`);
  assertCondition(!observation.horizontalOverflow, `${label}: page has horizontal overflow`);
  assertCondition(observation.reviewWithinTimeline, `${label}: Review content escapes the timeline width`);
  assertCondition(observation.composerAfterTimeline, `${label}: composer overlaps the timeline`);
  assertCondition(observation.actionTextFits, `${label}: Review action text is clipped`);
}

for (const path of [projectPath, ledgerPath, resultReceiptPath, executablePath]) {
  assertCondition(await exists(path), `missing packaged acceptance input: ${path}`);
}

const resultReceipt = await readJson<any>(resultReceiptPath);
assertCondition(resultReceipt.status === "needs_review", "P13-D requires the existing needs_review result");
const outputPath = isAbsolute(resultReceipt.outputPath)
  ? resultReceipt.outputPath
  : resolve(projectRoot, resultReceipt.outputPath || resultReceipt.outputRelativePath || "");
assertCondition(await exists(outputPath), "P13-D Review media is missing");

const protectedPaths = [projectPath, ledgerPath, resultReceiptPath, outputPath];
const hashesBefore = Object.fromEntries(await Promise.all(protectedPaths.map(async (path) => [path, await sha256(path)])));

await rm(acceptanceRoot, { recursive: true, force: true });
await Promise.all([mkdir(profileRoot, { recursive: true }), mkdir(runtimeRoot, { recursive: true }), mkdir(evidenceRoot, { recursive: true })]);
await writeFile(bindingPath, `${JSON.stringify({
  projectRoot,
  projectRootRelativePath: projectRoot,
  projectVibeRelativePath: "project.vibe",
  projectId: "p13_provider_canary",
  displayName: "P13 Provider Canary",
}, null, 2)}\n`, "utf8");

let app: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>> | undefined;
try {
  app = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot,
    projectsRoot: dirname(projectRoot),
    runtimeRoot,
    bindingPath,
    extraEnv: { VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS: "1" },
  });
  await setBoundsAndWait(app.client, 1480, 980);
  await openVideoAcceptanceView(app.client);
  const desktop = await waitForAcceptance(async () => {
    const observation = await observeSessionTimeline(app!.client);
    return observation.timelineCount === 1 && observation.reviewTurnCount === 1 ? observation : undefined;
  }, "P13-D desktop Session Timeline did not appear", 60_000);
  assertTimelineObservation(desktop, "desktop");
  await writeFile(desktopScreenshotPath, Buffer.from(await app.client.send("capture_page"), "base64"));

  await setBoundsAndWait(app.client, 980, 820);
  const constrained = await waitForAcceptance(async () => {
    const observation = await observeSessionTimeline(app!.client);
    return observation.viewport.width <= 980 && observation.timelineCount === 1 ? observation : undefined;
  }, "P13-D constrained Session Timeline did not settle", 30_000);
  assertTimelineObservation(constrained, "constrained");
  await writeFile(constrainedScreenshotPath, Buffer.from(await app.client.send("capture_page"), "base64"));

  const hashesAfter = Object.fromEntries(await Promise.all(protectedPaths.map(async (path) => [path, await sha256(path)])));
  assertCondition(JSON.stringify(hashesAfter) === JSON.stringify(hashesBefore), "P13-D packaged visual acceptance modified the source project or media");

  const report = {
    schemaVersion: "p13_session_timeline_packaged_observation/1.0.0",
    status: "pass",
    observedAt: new Date().toISOString(),
    selectedDirection: 3,
    scope: "review_needs_review_vertical_slice",
    projectRoot,
    resultStatus: resultReceipt.status,
    outputHash: resultReceipt.outputHash,
    providerCalls: 0,
    reviewActionsInvoked: 0,
    projectFactPromotions: 0,
    deliveries: 0,
    exports: 0,
    protectedHashes: hashesAfter,
    desktop,
    constrained,
  };
  await writeFile(observationPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "pass",
    currentPhase: desktop.currentPhase,
    currentPhaseCount: desktop.currentPhaseCount,
    providerCalls: 0,
    reviewActionsInvoked: 0,
    observationPath,
    desktopScreenshotPath,
    constrainedScreenshotPath,
  }, null, 2));
} finally {
  if (app) await closePackagedAcceptanceApp(app).catch(() => undefined);
}
