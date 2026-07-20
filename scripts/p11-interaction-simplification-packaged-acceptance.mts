import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  recordAgentVideoGenerationJobReviewResult,
  transitionAgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  serializeProjectVibe,
} from "../src/project/index.ts";
import { projectAgentGenerationJobLedgerPath } from "../src/project/projectAgentGenerationJobLedger.ts";
import { projectAgentStagedPlanDraftPath } from "../src/project/projectAgentStagedPlanDraft.ts";
import { projectAgentTimelinePath } from "../src/project/projectAgentTimeline.ts";
import {
  assertAcceptance,
  closePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  openVideoAcceptanceView,
  pathExists,
  waitForAcceptance,
  type PackagedAcceptanceClient,
  type RunningPackagedApp,
} from "./lib/packaged-acceptance-harness.mts";

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function filesUnder(root: string): Promise<string[]> {
  if (!await pathExists(root)) return [];
  const result: string[] = [];
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) result.push(relative(root, path).replace(/\\/g, "/"));
    }
  }
  await visit(root);
  return result.sort();
}

async function writeBinding(path: string, input: {
  projectRoot: string;
  projectId: string;
  displayName: string;
}): Promise<void> {
  await writeFile(path, `${JSON.stringify({
    projectRoot: input.projectRoot,
    projectRootRelativePath: input.projectRoot,
    projectVibeRelativePath: "project.vibe",
    projectId: input.projectId,
    displayName: input.displayName,
  }, null, 2)}\n`, "utf8");
}

async function setComposer(client: PackagedAcceptanceClient, value: string): Promise<void> {
  const accepted = await client.evaluate<string>(`(() => {
    const textarea = document.querySelector('textarea[aria-label="和 AI 导演说"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, ${JSON.stringify(value)});
    textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea?.value || "";
  })()`);
  assertAcceptance(accepted === value, "packaged composer did not accept the exact intent");
  await waitForAcceptance(async () => {
    const enabled = await client.evaluate<boolean>(`Boolean(document.querySelector('button[aria-label="发送"]:not(:disabled)'))`);
    return enabled ? true : undefined;
  }, "packaged composer did not enable Send");
}

async function sendComposer(client: PackagedAcceptanceClient): Promise<void> {
  const clicked = await client.evaluate<boolean>(`(() => {
    const button = document.querySelector('button[aria-label="发送"]:not(:disabled)');
    button?.click();
    return Boolean(button);
  })()`);
  assertAcceptance(clicked, "packaged composer Send was unavailable");
}

async function clickTurnButton(client: PackagedAcceptanceClient, ariaLabel: string, copy: string): Promise<void> {
  await waitForAcceptance(async () => {
    const clicked = await client.evaluate<boolean>(`(() => {
      const root = document.querySelector('[aria-label=${JSON.stringify(ariaLabel)}]');
      const button = [...(root?.querySelectorAll("button") || [])].find((item) => item.textContent?.includes(${JSON.stringify(copy)}) && !item.disabled);
      button?.click();
      return Boolean(button);
    })()`);
    return clicked ? true : undefined;
  }, `could not click ${copy} in ${ariaLabel}`);
}

async function capturePage(client: PackagedAcceptanceClient, path: string): Promise<void> {
  const base64 = await client.send("capture_page");
  assertAcceptance(typeof base64 === "string" && base64.length > 1000, "packaged screenshot is empty");
  await writeFile(path, Buffer.from(base64, "base64"));
}

function addReviewCandidate(input: {
  ledger: AgentVideoGenerationJobLedger;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  outputPath: string;
  outputHash: string;
}): AgentVideoGenerationJobLedger {
  const generatedAt = "2026-07-20T12:00:00.000Z";
  const plan = buildAgentVideoPipelinePlan({
    planId: "p11_e_initial_review_plan",
    generatedAt,
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: true,
    referenceMissingCount: 0,
    videoSubmitted: false,
  });
  const staged = planAgentVideoProductionAction({
    plan,
    ledger: input.ledger,
    action: "submit_video",
    actionId: "p11e_action_a",
    sourceConfirmationId: "p11e_confirmation_a",
    generatedAt,
    executionMode: "dry_run",
    prompt: "P11-E local deterministic candidate",
  });
  assertAcceptance(staged.status === "staged_job" && staged.job, "review fixture did not stage");
  const confirmed = transitionAgentVideoGenerationJob({
    ledger: staged.ledger,
    jobId: staged.job.jobId,
    status: "confirmed",
    generatedAt: "2026-07-20T12:00:01.000Z",
  });
  assertAcceptance(confirmed.ok, "review fixture did not confirm");
  const running = transitionAgentVideoGenerationJob({
    ledger: confirmed.ledger,
    jobId: staged.job.jobId,
    status: "running",
    generatedAt: "2026-07-20T12:00:02.000Z",
    providerCalled: false,
  });
  assertAcceptance(running.ok, "review fixture did not enter local Running");
  const returned = recordAgentVideoGenerationJobReviewResult({
    ledger: running.ledger,
    jobId: staged.job.jobId,
    result: {
      status: "needs_review",
      projectId: input.projectId,
      projectRoot: input.projectRoot,
      projectFactHash: input.projectFactHash,
      jobId: staged.job.jobId,
      actionId: staged.job.actionId,
      shotId: input.shotId,
      sourceReceiptId: "p11e_local_return_receipt_a",
      outputPath: input.outputPath,
      outputHash: `sha256:${input.outputHash}`,
      receivedAt: "2026-07-20T12:00:03.000Z",
    },
  });
  assertAcceptance(returned.ok && returned.job?.status === "succeeded", "review fixture did not return to needs_review");
  return returned.ledger;
}

function previewPlan(input: {
  shotId: string;
  mediaPath: string;
  outputHash: string;
}) {
  const item = {
    id: "p11e_local_video",
    clipId: "p11e_local_video",
    order: 1,
    shotId: input.shotId,
    mediaType: "video",
    mediaPath: input.mediaPath,
    sourceReceiptId: "p11e_local_return_receipt_a",
    outputHash: `sha256:${input.outputHash}`,
    outputSha256: input.outputHash,
    durationSeconds: 5,
    status: "returned_with_review_overlay",
    videoStatus: "success",
    reviewRequired: true,
    outputExists: true,
  };
  return {
    schemaVersion: "p11_e_review_fixture/1.0.0",
    generatedAt: "2026-07-20T12:00:03.000Z",
    status: "needs_review",
    previewStatus: "returned_with_review_overlay",
    productionStatus: "needs_review",
    reviewShotIds: [input.shotId],
    totalDurationSeconds: 5,
    clips: [item],
    previewItems: [item],
  };
}

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const evidenceRoot = resolve(process.argv[3] || "docs/evidence/p11-e-interaction-simplification-20260720");
const referenceSource = resolve("test-fixtures/projects/agent-loop-minimal");
const mediaSource = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_1_rainy_ticket.mp4");
const imageSource = resolve("showcase-package/promo-page-ai-ladies-op-2026-06-18/hero/hero-poster.png");
assertAcceptance(await pathExists(executablePath), `packaged executable is missing: ${executablePath}`);
assertAcceptance(await pathExists(referenceSource) && await pathExists(mediaSource) && await pathExists(imageSource), "local fixture source is missing");

await mkdir(evidenceRoot, { recursive: true });
const root = await mkdtemp("/tmp/vibe-director-p11-e-20260720-");
const observation: Record<string, unknown> = {
  schemaVersion: "p11_e_interaction_simplification/1.0.0",
  observedAt: new Date().toISOString(),
  packagedApp: appPath,
  fixtureRoot: root,
  providerCalls: 0,
  providerFees: 0,
};

let runningApp: RunningPackagedApp | undefined;
try {
  const referenceRoot = join(root, "reference");
  const referenceProfile = join(referenceRoot, "profile");
  const referenceProjects = join(referenceRoot, "projects");
  const referenceRuntime = join(referenceRoot, "runtime");
  const referenceProject = join(referenceProjects, "agent-loop-minimal");
  const referenceBinding = join(referenceProfile, "current-project.local.json");
  await Promise.all([
    mkdir(referenceProfile, { recursive: true }),
    mkdir(referenceRuntime, { recursive: true }),
    mkdir(referenceProjects, { recursive: true }),
  ]);
  await cp(referenceSource, referenceProject, { recursive: true, force: true });
  const referenceProjectVibe = JSON.parse(await readFile(join(referenceProject, "project.vibe"), "utf8"));
  await writeBinding(referenceBinding, {
    projectRoot: referenceProject,
    projectId: referenceProjectVibe.manifest.projectId,
    displayName: referenceProjectVibe.manifest.title,
  });
  const referenceIntent = "开始补参考。只形成确认，不执行生成。";
  runningApp = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot: referenceProfile,
    projectsRoot: referenceProjects,
    runtimeRoot: referenceRuntime,
    bindingPath: referenceBinding,
  });
  await setComposer(runningApp.client, referenceIntent);
  await sendComposer(runningApp.client);
  await waitForAcceptance(async () => {
    const state = await runningApp!.client.evaluate<{ confirmation: boolean; genericStatus: boolean }>(`({
      confirmation: [...document.querySelectorAll("button")].some((item) => item.textContent?.includes("确认生成参考") && !item.disabled),
      genericStatus: document.body.innerText.includes("说明下一步")
    })`);
    return state.confirmation && !state.genericStatus ? state : undefined;
  }, "qualified reference request did not stop at reference confirmation", 40_000);
  const stagedReference = JSON.parse(await readFile(join(referenceProject, projectAgentStagedPlanDraftPath), "utf8"));
  assertAcceptance(stagedReference.status === "active" && stagedReference.action?.kind === "prepare_reference_generation", "qualified reference request did not persist the reference action");
  assertAcceptance(!(await filesUnder(referenceProject)).some((path) => /\.(?:png|jpe?g|webp|mp4|mov)$/i.test(path)), "reference confirmation created media before execution");
  await closePackagedAcceptanceApp(runningApp);
  runningApp = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot: referenceProfile,
    projectsRoot: referenceProjects,
    runtimeRoot: referenceRuntime,
    bindingPath: referenceBinding,
  });
  const restoredReference = await waitForAcceptance(async () => {
    const state = await runningApp!.client.evaluate<{ visible: boolean; enabled: boolean; buttonLabel: string; currentTask: string }>(`(() => {
      const confirmationButton = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("确认并执行"));
      return {
      visible: document.body.innerText.includes("确认生成参考"),
      enabled: Boolean(confirmationButton && !confirmationButton.disabled),
      buttonLabel: confirmationButton?.textContent?.trim() || "",
      currentTask: document.querySelector('[aria-label="AI 导演当前任务"] strong')?.textContent?.trim() || ""
      };
    })()`);
    return state.visible ? state : undefined;
  }, "cold restart did not restore the qualified reference confirmation");
  await capturePage(runningApp.client, join(evidenceRoot, "01-qualified-reference-confirmation.png"));
  await closePackagedAcceptanceApp(runningApp);
  runningApp = undefined;
  observation.reference = {
    result: "pass",
    intent: referenceIntent,
    actionKind: stagedReference.action.kind,
    confirmationRestored: true,
    confirmationEnabledAfterRestore: restoredReference.enabled,
    confirmationButtonLabel: restoredReference.buttonLabel,
    restoredCurrentTask: restoredReference.currentTask,
    mediaCreated: 0,
  };

  const reviewRoot = join(root, "review");
  const reviewProfile = join(reviewRoot, "profile");
  const reviewProjects = join(reviewRoot, "projects");
  const reviewRuntime = join(reviewRoot, "runtime");
  const reviewProject = join(reviewProjects, "p11-e-review");
  const reviewBinding = join(reviewProfile, "current-project.local.json");
  const reviewProjectPath = join(reviewProject, "project.vibe");
  const reviewLedgerPath = join(reviewProject, projectAgentGenerationJobLedgerPath);
  const reviewPreviewPath = join(reviewProject, "reports", "preview_plan.json");
  const reviewMediaPath = join(reviewProject, "video", "P11ES01-version-a.mp4");
  const reviewImagePath = join(reviewProject, "assets", "reference.png");
  await Promise.all([
    mkdir(reviewProfile, { recursive: true }),
    mkdir(reviewRuntime, { recursive: true }),
    mkdir(dirname(reviewLedgerPath), { recursive: true }),
    mkdir(dirname(reviewPreviewPath), { recursive: true }),
    mkdir(dirname(reviewMediaPath), { recursive: true }),
    mkdir(dirname(reviewImagePath), { recursive: true }),
  ]);
  await Promise.all([
    copyFile(mediaSource, reviewMediaPath),
    copyFile(imageSource, reviewImagePath),
  ]);
  const projectId = "p11_e_review_project";
  const shotId = "P11ES01";
  const project = createProjectVibe({
    projectId,
    title: "P11-E Interaction Simplification",
    version: "1.0.0",
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
    storyFlow: {
      id: "p11_e_story",
      sections: [{ id: "section_1", title: "雨夜递出", summary: "女孩把纸飞机递给机器人保安。", sequenceIndex: 0, shotIds: [shotId] }],
      shotOrder: [shotId],
    },
    visualMemory: {
      id: "p11_e_visual_memory",
      entries: [{
        id: "vm_scene",
        assetId: "scene_store",
        kind: "scene",
        label: "雨夜便利店门口",
        status: "locked",
        textConstraints: ["雨夜", "便利店灯箱"],
        usedByShotIds: [shotId],
        canUseAsFutureReference: true,
        sourceRefs: ["p11-e-local-fixture"],
      }],
    },
    shots: [{
      id: shotId,
      sectionId: "section_1",
      title: "雨夜递出纸飞机",
      intent: "女孩把纸飞机递给机器人保安，纸飞机在灯箱里亮起来。",
      sceneAssetIds: ["scene_store"],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "generated",
      sourceRefs: ["p11-e-local-fixture:shot"],
      referenceStrategy: "omni_reference",
      executionMode: "relationship_wide",
      primaryAction: "女孩递出纸飞机",
      actionTrigger: "机器人接住纸飞机",
      microReaction: "纸飞机在灯箱里亮起来",
      camera: "中远景轻推",
    }],
    assets: [{
      id: "scene_store",
      kind: "scene",
      label: "雨夜便利店门口",
      status: "locked",
      path: "assets/reference.png",
      textConstraints: ["雨夜", "便利店灯箱"],
      usedByShotIds: [shotId],
      sourceRefs: ["p11-e-local-fixture"],
      lockedBy: "user",
    }],
    runs: [],
  });
  const projectFactHash = hashProjectVibeFacts(project);
  const mediaHash = await sha256(reviewMediaPath);
  let ledger = createAgentVideoGenerationJobLedger({
    ledgerId: "p11_e_generation_ledger",
    projectId,
    projectRoot: reviewProject,
    projectFactHash,
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  ledger = addReviewCandidate({
    ledger,
    projectId,
    projectRoot: reviewProject,
    projectFactHash,
    shotId,
    outputPath: reviewMediaPath,
    outputHash: mediaHash,
  });
  await Promise.all([
    writeFile(reviewProjectPath, serializeProjectVibe(project), "utf8"),
    writeFile(reviewLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8"),
    writeFile(reviewPreviewPath, `${JSON.stringify(previewPlan({ shotId, mediaPath: reviewMediaPath, outputHash: mediaHash }), null, 2)}\n`, "utf8"),
    writeBinding(reviewBinding, { projectRoot: reviewProject, projectId, displayName: project.manifest.title }),
  ]);
  const projectHashBefore = await sha256(reviewProjectPath);
  runningApp = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot: reviewProfile,
    projectsRoot: reviewProjects,
    runtimeRoot: reviewRuntime,
    bindingPath: reviewBinding,
  });
  await openVideoAcceptanceView(runningApp.client);
  await waitForAcceptance(async () => {
    const visible = await runningApp!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频复核"]'))`);
    return visible ? true : undefined;
  }, "review fixture did not enter Review");
  await clickTurnButton(runningApp.client, "当前视频复核", "需要修改");
  await waitForAcceptance(async () => {
    const visible = await runningApp!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频修改意图"]'))`);
    return visible ? true : undefined;
  }, "needs-work did not enter revision discussion");
  const concreteFeedback = "P11ES01 需要修改：纸飞机亮起得太晚。让女孩递出后 1 秒内亮起，机器人先低头看纸飞机再抬眼，保持雨夜灯箱、女孩和机器人外观连续。";
  await setComposer(runningApp.client, concreteFeedback);
  await sendComposer(runningApp.client);
  await waitForAcceptance(async () => {
    const state = await runningApp!.client.evaluate<{ proposal: boolean; clarification: boolean; phase: string }>(`({
      proposal: Boolean(document.querySelector('[aria-label="当前导演提案"]')),
      clarification: Boolean(document.querySelector('[aria-label="当前导演澄清"]')),
      phase: document.querySelector(".minimal-agent-panel")?.getAttribute("data-director-turn-phase") || ""
    })`);
    return state.proposal && !state.clarification && state.phase === "proposal" ? state : undefined;
  }, "concrete Review feedback did not form Proposal directly", 40_000);
  const ledgerBeforeProposalConfirmation = JSON.parse(await readFile(reviewLedgerPath, "utf8"));
  assertAcceptance(ledgerBeforeProposalConfirmation.jobs.length === 1, "forming Proposal created a generation job");
  await capturePage(runningApp.client, join(evidenceRoot, "02-direct-review-proposal.png"));
  await clickTurnButton(runningApp.client, "当前导演提案", "确认重新生成提案");
  await waitForAcceptance(async () => {
    const visible = await runningApp!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前生成任务确认"]'))`);
    return visible ? true : undefined;
  }, "Proposal confirmation did not create the independent execution confirmation");
  const ledgerAfterProposalConfirmation = JSON.parse(await readFile(reviewLedgerPath, "utf8"));
  const stagedJob = ledgerAfterProposalConfirmation.jobs.find((job: any) => job.status === "staged");
  assertAcceptance(ledgerAfterProposalConfirmation.jobs.length === 2, "Proposal confirmation did not add exactly one independent job");
  assertAcceptance(stagedJob?.executionMode === "dry_run" && stagedJob?.providerCalled === false, "new execution confirmation was not pinned to dry-run");
  assertAcceptance(await sha256(reviewProjectPath) === projectHashBefore, "Proposal flow changed project facts");
  assertAcceptance(await sha256(reviewMediaPath) === mediaHash, "Proposal flow changed the returned media");
  assertAcceptance(!await pathExists(join(reviewProject, "exports")), "Proposal flow created an export");
  await closePackagedAcceptanceApp(runningApp);
  runningApp = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot: reviewProfile,
    projectsRoot: reviewProjects,
    runtimeRoot: reviewRuntime,
    bindingPath: reviewBinding,
  });
  await openVideoAcceptanceView(runningApp.client);
  await waitForAcceptance(async () => {
    const ready = await runningApp!.client.evaluate<boolean>(`(() => {
      const video = document.querySelector("video");
      return Boolean(video && (video.readyState >= 2 || video.poster));
    })()`);
    return ready ? true : undefined;
  }, "cold-restored local review media did not become displayable");
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  const coldRestoreState = await waitForAcceptance(async () => {
    const state = await runningApp!.client.evaluate<{ confirmationVisible: boolean; reviewVisible: boolean; phase: string; currentTask: string; taskStep: string; taskSource: string }>(`(() => {
      const confirmation = document.querySelector('[aria-label="当前生成任务确认"]');
      const review = document.querySelector('[aria-label="当前视频复核"]');
      const task = document.querySelector('[aria-label="AI 导演当前任务"]');
      return {
        confirmationVisible: Boolean(confirmation && confirmation.getClientRects().length),
        reviewVisible: Boolean(review && review.getClientRects().length),
        phase: document.querySelector(".minimal-agent-panel")?.getAttribute("data-director-turn-phase") || "",
        currentTask: task?.querySelector("strong")?.textContent?.trim() || "",
        taskStep: task?.getAttribute("data-current-task-step") || "",
        taskSource: task?.getAttribute("data-current-task-source") || ""
      };
    })()`);
    if (state.confirmationVisible
      && !state.reviewVisible
      && state.phase === "confirmation"
      && state.taskStep === "submit_video"
      && state.taskSource === "timeline_confirmation"
      && (state.currentTask === "确认验证视频流程" || state.currentTask.startsWith("确认重新生成"))) return state;
    throw new Error(JSON.stringify(state));
  }, "cold restart or video navigation let the old Review result replace the independent execution confirmation");
  await capturePage(runningApp.client, join(evidenceRoot, "03-execution-confirmation-cold-restore.png"));
  await closePackagedAcceptanceApp(runningApp);
  runningApp = undefined;

  const timeline = JSON.parse(await readFile(join(reviewProject, projectAgentTimelinePath), "utf8"));
  const clarificationEntries = timeline.entries.filter((entry: any) => entry.details?.directorTurnKind === "agent_director_clarification");
  const proposalEntries = timeline.entries.filter((entry: any) => entry.details?.directorTurnKind === "agent_director_review_regeneration_proposal");
  assertAcceptance(clarificationEntries.length === 0, "direct Review feedback persisted a redundant visible Clarify turn");
  assertAcceptance(proposalEntries.length === 1, "direct Review feedback did not persist exactly one Proposal");
  const stagedPlan = JSON.parse(await readFile(join(reviewProject, projectAgentStagedPlanDraftPath), "utf8"));
  observation.review = {
    result: "pass",
    feedback: concreteFeedback,
    visibleClarifyTurns: clarificationEntries.length,
    proposalCount: proposalEntries.length,
    jobsBeforeProposalConfirmation: ledgerBeforeProposalConfirmation.jobs.length,
    jobsAfterProposalConfirmation: ledgerAfterProposalConfirmation.jobs.length,
    finalJobStatus: stagedJob.status,
    finalExecutionMode: stagedJob.executionMode,
    providerCalled: stagedJob.providerCalled,
    stagedActionKind: stagedPlan.action?.kind,
    projectFactsChanged: false,
    mediaChanged: false,
    exportPerformed: false,
    finalExecutionConfirmed: false,
    coldRestore: true,
    coldRestoreCurrentTask: coldRestoreState.currentTask,
    coldRestoreTaskSource: coldRestoreState.taskSource,
    oldReviewVisibleAfterNavigation: coldRestoreState.reviewVisible,
  };
  observation.status = "pass_local_packaged";
  observation.realProviderExecutionVerified = false;
  observation.evidence = [
    "01-qualified-reference-confirmation.png",
    "02-direct-review-proposal.png",
    "03-execution-confirmation-cold-restore.png",
  ];
  observation.evidenceHashes = Object.fromEntries(await Promise.all(
    (observation.evidence as string[]).map(async (name) => [name, await sha256(join(evidenceRoot, name))]),
  ));
  await writeFile(join(evidenceRoot, "observation.json"), `${JSON.stringify(observation, null, 2)}\n`, "utf8");
  console.log(`P11-E packaged interaction simplification PASS: ${root}`);
} finally {
  if (runningApp) await closePackagedAcceptanceApp(runningApp).catch(() => undefined);
}
