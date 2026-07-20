import { createHash } from "node:crypto";
import { access, chmod, copyFile, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

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
import { projectAgentTimelinePath } from "../src/project/projectAgentTimeline.ts";
import {
  assertAcceptance,
  closePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  observePackagedTask,
  openVideoAcceptanceView,
  pathExists,
  waitForAcceptance,
  type PackagedAcceptanceClient,
} from "./lib/packaged-acceptance-harness.mts";

const mode = process.argv.find((argument) => argument.startsWith("--mode="))?.slice("--mode=".length) || "prepare";
const supportedModes = new Set(["prepare", "submit", "query", "inspect", "preflight-invalid"]);
assertAcceptance(supportedModes.has(mode), `unsupported P11 canary mode: ${mode}`);
const paidAuthorization = process.argv.find((argument) => argument.startsWith("--paid-authorization="))?.slice("--paid-authorization=".length) || "";
const exactPaidAuthorization = "confirm-p11s01-seedance2.0_vip-720p-once";
const fixtureExecutionMode = process.env.VIBE_P11_CANARY_FIXTURE_EXECUTION_MODE || "single_continuous_shot";

const canaryRoot = resolve(process.env.VIBE_P11_CANARY_ROOT || "/tmp/vibe-director-p11-b-20260720");
const profileRoot = join(canaryRoot, "profile");
const projectsRoot = join(canaryRoot, "projects");
const runtimeRoot = join(canaryRoot, "runtime");
const evidenceRoot = join(canaryRoot, "evidence");
const projectRoot = join(projectsRoot, "p11-provider-canary");
const projectPath = join(projectRoot, "project.vibe");
const bindingPath = join(profileRoot, "current-project.local.json");
const generationLedgerPath = join(projectRoot, projectAgentGenerationJobLedgerPath);
const timelinePath = join(projectRoot, projectAgentTimelinePath);
const stagedPlanPath = join(projectRoot, ".vibe-runtime", "agent-staged-plan.json");
const reviewSelectionLedgerPath = join(projectRoot, ".vibe-runtime", "agent-review-selection-ledger.json");
const previewPlanPath = join(projectRoot, "reports", "preview_plan.json");
const relayQueuePath = join(projectRoot, "reports", "video_relay_queue.json");
const submitReportPath = join(projectRoot, "reports", "seedance_submit_report.json");
const resumeReportPath = join(projectRoot, "reports", "seedance_resume_report.json");
const preSubmitEvidencePath = join(evidenceRoot, "pre-submit-observation.json");
const submitAttemptPath = join(evidenceRoot, "submit-attempt.json");
const submitEvidencePath = join(evidenceRoot, "submit-observation.json");
const queryAttemptsPath = join(evidenceRoot, "query-attempts.json");
const appPath = resolve(process.env.VIBE_P11_APP_PATH || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const sourceProjectRoot = "/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot";
const sourceMediaA = join(sourceProjectRoot, "video", "seedance_2026-07-14T14-03-45-563Z", "video", "d2c02c02-1c3d-4763-af77-d60816f642cb_video_1.mp4");
const sourceReferences = [
  { id: "character_aoi", kind: "character" as const, label: "葵角色参考", source: join(sourceProjectRoot, "assets", "locked", "aoi-main-character.png"), target: "assets/locked/aoi-main-character.png" },
  { id: "scene_rooftop", kind: "scene" as const, label: "雨后学校屋顶", source: join(sourceProjectRoot, "assets", "locked", "after-rain-rooftop.png"), target: "assets/locked/after-rain-rooftop.png" },
  { id: "prop_paper_plane", kind: "prop" as const, label: "发光纸飞机", source: join(sourceProjectRoot, "assets", "locked", "glowing-paper-plane.png"), target: "assets/locked/glowing-paper-plane.png" },
];

const projectId = "p11_provider_canary";
const shotId = "P11S01";
const createdAt = "2026-07-19T18:00:00.000Z";
const outputA = join(projectRoot, "video", `${shotId}-version-a.mp4`);
const revisionIntent = `${shotId} 使用 Seedance 2.0 VIP + 720p 重新生成：让葵的手指明确触碰纸飞机后蓝光才亮起，并在湿地形成反射；保持同一人物、屋顶构图和中远景连续性，不切镜，不加文字、Logo 或配乐。`;

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function fileSize(path: string): Promise<number> {
  return stat(path).then((value) => value.size).catch(() => 0);
}

async function readJsonFile<T = any>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readOptionalJsonFile<T = any>(path: string): Promise<T | undefined> {
  return pathExists(path).then((exists) => exists ? readJsonFile<T>(path) : undefined);
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizedPath(path: string) {
  return resolve(path).replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
}

async function verifiedProjectArtifact(path: string) {
  const absolutePath = isAbsolute(path) ? resolve(path) : resolve(projectRoot, path);
  const normalizedRoot = normalizedPath(projectRoot);
  const normalizedArtifact = normalizedPath(absolutePath);
  assertAcceptance(
    normalizedArtifact === normalizedRoot || normalizedArtifact.startsWith(`${normalizedRoot}/`),
    `P11 artifact escaped the project root: ${path}`,
  );
  const [realRoot, realArtifact] = await Promise.all([realpath(projectRoot), realpath(absolutePath)]);
  const relativeToRoot = relative(realRoot, realArtifact);
  assertAcceptance(
    relativeToRoot === "" || (!relativeToRoot.startsWith("..") && !isAbsolute(relativeToRoot)),
    `P11 artifact realpath escaped the project root: ${path}`,
  );
  return realArtifact;
}

function relayItems(value: any) {
  return Array.isArray(value?.items) ? value.items : [];
}

function externalTaskIdFrom(value: any) {
  const item = relayItems(value?.relayQueue || value).find((candidate: any) => candidate?.externalTaskId || candidate?.submitId);
  return String(value?.externalTaskId || value?.submitId || item?.externalTaskId || item?.submitId || "").trim();
}

function currentLiveSubmitJob(ledger: AgentVideoGenerationJobLedger, expectedJobId?: string) {
  const jobs = ledger.jobs.filter((job) => (
    job.kind === "video_submit"
    && job.operation === "execute"
    && job.executionMode === "live"
    && (!expectedJobId || job.jobId === expectedJobId)
  ));
  assertAcceptance(jobs.length === 1, `P11 expected exactly one live submit job, found ${jobs.length}`);
  return jobs[0]!;
}

function argValue(args: unknown, name: string) {
  if (!Array.isArray(args)) return "";
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || "") : "";
}

function normalizedHash(value: unknown) {
  const candidate = String(value || "").trim().toLowerCase();
  if (/^sha256:[a-f0-9]{64}$/.test(candidate)) return candidate;
  return /^[a-f0-9]{64}$/.test(candidate) ? `sha256:${candidate}` : "";
}

function reportStatus(value: any) {
  return String(value?.status || value?.uiStatus || "").trim().toLowerCase();
}

function returnedMediaPath(value: any) {
  const item = relayItems(value?.relayQueue || value).find((candidate: any) => candidate?.outputVideoPath || candidate?.localMediaPaths?.length);
  return String(value?.outputVideoPath || item?.outputVideoPath || item?.localMediaPaths?.[0] || "").trim();
}

function activeProviderStatus(value: any) {
  return ["queued", "generating", "submitted", "running", "polling", "recoverable_queued", "timed_out"].includes(reportStatus(value));
}

function failedProviderStatus(value: any) {
  return value?.ok === false || ["failed", "submit_failed", "blocked", "cancelled"].includes(reportStatus(value));
}

async function projectJsonFromReportedPath<T = any>(path: unknown): Promise<{ path: string; value: T }> {
  assertAcceptance(typeof path === "string" && path.trim(), "P11 report omitted an artifact path");
  const absolutePath = isAbsolute(path) ? path : join(projectRoot, path);
  const verifiedPath = await verifiedProjectArtifact(absolutePath);
  return { path: verifiedPath, value: await readJsonFile<T>(verifiedPath) };
}

async function uniqueEnabledButtonTarget(client: PackagedAcceptanceClient, buttonCopy: string) {
  const targets = await client.evaluate<Array<{ x: number; y: number; text: string; hitMatches: boolean; rect: Record<string, number> }>>(`(() => (
    [...document.querySelectorAll("button")]
      .filter((item) => item.textContent?.trim() === ${JSON.stringify(buttonCopy)} && !item.disabled)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          text: button.textContent?.trim() || "",
          hitMatches: hit === button || hit?.closest("button") === button,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        };
      })
  ))()`);
  assertAcceptance(targets.length === 1, `P11 expected exactly one enabled ${buttonCopy} button, found ${targets.length}`);
  assertAcceptance(targets[0]?.hitMatches, `P11 ${buttonCopy} target is occluded: ${JSON.stringify(targets[0])}`);
  return targets[0]!;
}

async function assertPreparedCanary() {
  assertAcceptance(await pathExists(preSubmitEvidencePath), "P11 pre-submit evidence is missing; run prepare first");
  const evidence = await readJsonFile<any>(preSubmitEvidencePath);
  assertAcceptance(evidence.status === "ready_for_single_paid_confirmation", "P11 pre-submit evidence is not ready");
  assertAcceptance(evidence.fixture?.projectRoot === projectRoot, "P11 pre-submit project root changed");
  assertAcceptance(evidence.fixture?.projectId === projectId && evidence.fixture?.shotId === shotId, "P11 pre-submit project or shot identity changed");
  assertAcceptance(evidence.requestedSubmit?.modelVersion === "seedance2.0_vip", "P11 pre-submit model changed");
  assertAcceptance(evidence.requestedSubmit?.videoResolution === "720p", "P11 pre-submit resolution changed");
  assertAcceptance(evidence.requestedSubmit?.durationSeconds === 5 && evidence.requestedSubmit?.ratio === "16:9", "P11 pre-submit duration or ratio changed");
  assertAcceptance(evidence.requestedSubmit?.maxSubmitCount === 1 && evidence.requestedSubmit?.automaticRetry === false, "P11 pre-submit retry boundary changed");
  assertAcceptance(evidence.requestedSubmit?.storyboardImageGeneration === false, "P11 pre-submit must not generate an extra storyboard image");
  const ledger = await readJsonFile<AgentVideoGenerationJobLedger>(generationLedgerPath);
  const job = currentLiveSubmitJob(ledger, evidence.stagedJob?.jobId);
  assertAcceptance(job.status === "staged", `P11 paid job is no longer staged: ${job.status}`);
  assertAcceptance(job.providerId === "jimeng-seedance" && job.modelId === "seedance2.0_vip", "P11 staged provider identity changed");
  assertAcceptance(job.providerCalled === false && !job.externalTaskId, "P11 staged job already contains Provider evidence");
  assertAcceptance(!await pathExists(relayQueuePath), "P11 relay queue already exists before the single submit");
  return { evidence, ledger, job };
}

function addBaselineCandidate(input: {
  ledger: AgentVideoGenerationJobLedger;
  projectFactHash: string;
  outputHash: string;
}): AgentVideoGenerationJobLedger {
  const plan = buildAgentVideoPipelinePlan({
    planId: "p11_canary_baseline_review",
    generatedAt: createdAt,
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
    actionId: "p11_canary_baseline_action",
    sourceConfirmationId: "p11_canary_baseline_confirmation",
    generatedAt: createdAt,
    executionMode: "dry_run",
    prompt: "Imported P6S01 as the immutable local A/B baseline; no Provider call.",
  });
  assertAcceptance(staged.status === "staged_job" && staged.job, "P11 baseline candidate did not stage");
  const confirmed = transitionAgentVideoGenerationJob({
    ledger: staged.ledger,
    jobId: staged.job.jobId,
    status: "confirmed",
    generatedAt: "2026-07-19T18:00:01.000Z",
  });
  assertAcceptance(confirmed.ok, "P11 baseline candidate did not confirm");
  const running = transitionAgentVideoGenerationJob({
    ledger: confirmed.ledger,
    jobId: staged.job.jobId,
    status: "running",
    generatedAt: "2026-07-19T18:00:02.000Z",
    providerCalled: false,
  });
  assertAcceptance(running.ok, "P11 baseline candidate did not enter local Running");
  const returned = recordAgentVideoGenerationJobReviewResult({
    ledger: running.ledger,
    jobId: staged.job.jobId,
    result: {
      status: "needs_review",
      projectId,
      projectRoot,
      projectFactHash: input.projectFactHash,
      jobId: staged.job.jobId,
      actionId: staged.job.actionId,
      shotId,
      sourceReceiptId: "p11_canary_imported_p6_baseline",
      outputPath: outputA,
      outputHash: `sha256:${input.outputHash}`,
      receivedAt: "2026-07-19T18:00:03.000Z",
    },
  });
  assertAcceptance(returned.ok && returned.job?.status === "succeeded", "P11 baseline candidate did not reach Review");
  return returned.ledger;
}

function previewPlanFixture(outputHash: string) {
  const item = {
    id: "p11_canary_baseline_video",
    clipId: "p11_canary_baseline_video",
    order: 1,
    shotId,
    mediaType: "video",
    mediaPath: outputA,
    sourceReceiptId: "p11_canary_imported_p6_baseline",
    outputHash: `sha256:${outputHash}`,
    outputSha256: `sha256:${outputHash}`,
    durationSeconds: 5,
    status: "returned_with_review_overlay",
    videoStatus: "success",
    reviewRequired: true,
    outputExists: true,
  };
  return {
    schemaVersion: "p11_provider_canary_preview/1.0.0",
    generatedAt: "2026-07-19T18:00:03.000Z",
    status: "needs_review",
    previewStatus: "returned_with_review_overlay",
    productionStatus: "needs_review",
    reviewShotIds: [shotId],
    totalDurationSeconds: 5,
    clips: [item],
    previewItems: [item],
  };
}

async function createFixture() {
  assertAcceptance(canaryRoot.startsWith("/tmp/"), "P11 canary fixture must stay under /tmp");
  assertAcceptance(await pathExists(executablePath), `packaged App is missing: ${executablePath}`);
  assertAcceptance(await pathExists(sourceMediaA), `P6 baseline media is missing: ${sourceMediaA}`);
  for (const reference of sourceReferences) {
    assertAcceptance(await pathExists(reference.source), `P6 locked reference is missing: ${reference.source}`);
  }
  await rm(canaryRoot, { recursive: true, force: true });
  await Promise.all([
    mkdir(profileRoot, { recursive: true }),
    mkdir(runtimeRoot, { recursive: true }),
    mkdir(dirname(outputA), { recursive: true }),
    mkdir(dirname(previewPlanPath), { recursive: true }),
    mkdir(evidenceRoot, { recursive: true }),
  ]);
  await copyFile(sourceMediaA, outputA);
  for (const reference of sourceReferences) {
    const target = join(projectRoot, reference.target);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(reference.source, target);
  }

  const project = createProjectVibe({
    projectId,
    title: "P11 Provider Canary",
    version: "1.0.0",
    createdAt,
    updatedAt: createdAt,
    storyFlow: {
      id: "p11_canary_story",
      sections: [{
        id: "section_p11",
        title: "雨后触碰",
        summary: "葵在雨后屋顶触碰发光纸飞机。",
        sequenceIndex: 0,
        shotIds: [shotId],
      }],
      shotOrder: [shotId],
    },
    visualMemory: {
      id: "p11_canary_visual_memory",
      entries: sourceReferences.map((reference) => ({
        id: `vm_${reference.id}`,
        assetId: reference.id,
        kind: reference.kind,
        label: reference.label,
        status: "locked" as const,
        textConstraints: [reference.label],
        usedByShotIds: [shotId],
        canUseAsFutureReference: true,
        sourceRefs: [`p11-canary:${reference.id}`],
      })),
    },
    shots: [{
      id: shotId,
      sectionId: "section_p11",
      title: "雨后屋顶触碰发光纸飞机",
      intent: "雨后的黄昏屋顶，葵蹲下，手指明确触碰纸飞机后蓝光亮起并映在湿地上。",
      sceneAssetIds: ["scene_rooftop"],
      characterAssetIds: ["character_aoi"],
      propAssetIds: ["prop_paper_plane"],
      durationSeconds: 5,
      status: "generated",
      sourceRefs: ["p11-canary:shot"],
      referenceStrategy: "omni_reference",
      executionMode: fixtureExecutionMode,
      primaryAction: "葵伸手触碰纸飞机",
      actionTrigger: "手指与纸飞机明确接触",
      microReaction: "蓝光延迟亮起并映在湿地上",
      camera: "中远景轻推，不切镜",
    }],
    assets: sourceReferences.map((reference) => ({
      id: reference.id,
      kind: reference.kind,
      label: reference.label,
      status: "locked" as const,
      path: reference.target,
      textConstraints: [reference.label],
      usedByShotIds: [shotId],
      sourceRefs: [`p11-canary:${reference.id}`],
      lockedBy: "user",
    })),
    runs: [],
  });
  const projectFactHash = hashProjectVibeFacts(project);
  const outputHashA = await sha256(outputA);
  let ledger = createAgentVideoGenerationJobLedger({
    ledgerId: "p11_provider_canary_generation_ledger",
    projectId,
    projectRoot,
    projectFactHash,
    createdAt,
  });
  ledger = addBaselineCandidate({ ledger, projectFactHash, outputHash: outputHashA });
  await mkdir(dirname(generationLedgerPath), { recursive: true });
  await Promise.all([
    writeFile(projectPath, serializeProjectVibe(project), "utf8"),
    writeFile(generationLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8"),
    writeFile(previewPlanPath, `${JSON.stringify(previewPlanFixture(outputHashA), null, 2)}\n`, "utf8"),
    writeFile(bindingPath, `${JSON.stringify({
      projectRoot,
      projectRootRelativePath: projectRoot,
      projectVibeRelativePath: "project.vibe",
      projectId,
      displayName: project.manifest.title,
    }, null, 2)}\n`, "utf8"),
  ]);
  return { projectFactHash, outputHashA };
}

async function setTextarea(client: PackagedAcceptanceClient, value: string): Promise<void> {
  const accepted = await client.evaluate<string>(`(() => {
    const textarea = document.querySelector('textarea[aria-label="和 AI 导演说"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, ${JSON.stringify(value)});
    textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea?.value || "";
  })()`);
  assertAcceptance(accepted === value, "P11 canary composer did not accept the exact intent");
}

async function clickTurnButton(client: PackagedAcceptanceClient, turnLabel: string, buttonCopy: string): Promise<void> {
  const target = await client.evaluate<{ x: number; y: number; hitMatches: boolean; hitText: string; rect: Record<string, number> } | undefined>(`(() => {
    const turn = document.querySelector('[aria-label=${JSON.stringify(turnLabel)}]');
    const button = [...(turn?.querySelectorAll("button") || [])].find((item) => item.textContent?.includes(${JSON.stringify(buttonCopy)}) && !item.disabled);
    if (!button) return undefined;
    const rect = button.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      hitMatches: hit === button || hit?.closest("button") === button,
      hitText: hit?.closest("button")?.textContent?.trim() || hit?.textContent?.trim().slice(0, 120) || "",
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    };
  })()`);
  assertAcceptance(target, `P11 canary could not locate ${buttonCopy} in ${turnLabel}`);
  assertAcceptance(target.hitMatches, `P11 canary click target is occluded for ${buttonCopy}: ${JSON.stringify(target)}`);
  await client.clickAt(target.x, target.y);
}

async function providerReadiness(client: PackagedAcceptanceClient) {
  return client.evaluate(`(async () => {
    const baseUrl = await window.vibeRuntime.ensureRuntimeApiBaseUrl();
    const token = window.vibeRuntime.runtimeApiToken();
    const response = await fetch(baseUrl + "/api/runtime/credentials", {
      headers: { "x-vibe-runtime-token": token }
    });
    const payload = await response.json();
    const status = (payload.providerConfigs || []).find((item) => item.providerId === "apikey-fun-gpt55-responses-image");
    return {
      responseOk: response.ok,
      generationServiceConfigured: status?.credential?.keyStatus === "configured",
      secretDisplayed: status?.credential?.secretDisplayed !== false
    };
  })()`);
}

async function prepareCanary() {
  assertAcceptance(
    !await pathExists(submitAttemptPath),
    "P11 submit attempt already exists; prepare cannot erase the single-submit lock",
  );
  const baseline = await createFixture();
  let launch;
  try {
  launch = await launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot,
    projectsRoot,
    runtimeRoot,
    bindingPath,
  });
  const readiness = await providerReadiness(launch.client);
  assertAcceptance(readiness.responseOk, "P11 packaged credential-status endpoint is unavailable");
  assertAcceptance(readiness.generationServiceConfigured, "P11 generation-service status is not configured");
  assertAcceptance(!readiness.secretDisplayed, "P11 credential-status response must not expose a secret");

  await openVideoAcceptanceView(launch.client);
  await waitForAcceptance(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频复核"]'))`);
    return visible ? true : undefined;
  }, "P11 baseline candidate did not enter Review");
  await clickTurnButton(launch.client, "当前视频复核", "需要修改");
  await waitForAcceptance(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频修改意图"]'))`);
    return visible ? true : undefined;
  }, "P11 needs-change did not enter revision intent");
  await setTextarea(launch.client, revisionIntent);
  await waitForAcceptance(async () => {
    const enabled = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('button[aria-label="发送"]:not(:disabled)'))`);
    return enabled ? true : undefined;
  }, "P11 revision intent did not enable send");
  await launch.client.evaluate(`document.querySelector('button[aria-label="发送"]')?.click(); true`);
  await waitForAcceptance(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前导演澄清"]'))`);
    return visible ? true : undefined;
  }, "P11 revision intent did not enter Clarify", 40_000);
  const selectedOption = await launch.client.evaluate<string>(`(() => {
    const button = document.querySelector('[aria-label="导演意图选项"] button');
    const label = button?.querySelector("strong")?.textContent?.trim() || "";
    button?.click();
    return label;
  })()`);
  assertAcceptance(Boolean(selectedOption), "P11 Clarify did not expose an option");
  await waitForAcceptance(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前导演提案"]'))`);
    return visible ? true : undefined;
  }, "P11 Clarify did not form a Proposal");
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  await clickTurnButton(launch.client, "当前导演提案", "确认重新生成提案");
  await waitForAcceptance(async () => {
    const state = await launch!.client.evaluate<{ visible: boolean; text: string; status: string; bodyTail: string }>(`({
      visible: Boolean(document.querySelector('[aria-label="当前生成任务确认"]')),
      text: document.querySelector('[aria-label="当前生成任务确认"]')?.textContent || "",
      status: document.querySelector('.minimal-agent-panel')?.getAttribute('data-agent-status') || "",
      bodyTail: document.body.innerText.slice(-2200)
    })`);
    return state.visible && state.text.includes("外部任务") && state.text.includes("seedance2.0_vip") && state.text.includes("720p")
      ? state
      : Promise.reject(new Error(JSON.stringify(state)));
  }, "P11 Proposal did not stop at the exact VIP paid confirmation");
  const observation = await observePackagedTask(launch.client);
  const confirmation = await launch.client.evaluate(`(() => ({
    count: document.querySelectorAll('[aria-label="当前生成任务确认"]').length,
    buttons: [...document.querySelectorAll('[aria-label="当前生成任务确认"] button')].map((item) => ({ text: item.textContent?.trim(), disabled: item.disabled })),
    text: document.querySelector('[aria-label="当前生成任务确认"]')?.textContent || ""
  }))()`);
  await closePackagedAcceptanceApp(launch);
  launch = undefined;

  const ledger = JSON.parse(await readFile(generationLedgerPath, "utf8")) as AgentVideoGenerationJobLedger;
  const stagedLiveJobs = ledger.jobs.filter((job) => job.status === "staged" && job.executionMode === "live");
  assertAcceptance(stagedLiveJobs.length === 1, "P11 pre-submit must persist exactly one staged live job");
  const stagedJob = stagedLiveJobs[0]!;
  assertAcceptance(stagedJob.providerId === "jimeng-seedance", "P11 staged job provider identity is wrong");
  assertAcceptance(stagedJob.modelId === "seedance2.0_vip", "P11 staged job model identity is wrong");
  assertAcceptance(stagedJob.providerCalled === false && !stagedJob.externalTaskId, "P11 pre-submit must not contain Provider evidence");
  const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
  const paidConfirmations = (timeline.entries || []).filter((entry: any) => (
    entry.type === "confirmation_request"
    && entry.id === stagedJob.sourceConfirmationId
    && entry.details?.executionMode === "live"
    && entry.details?.submitProfile?.modelVersion === "seedance2.0_vip"
    && entry.details?.submitProfile?.videoResolution === "720p"
  ));
  assertAcceptance(paidConfirmations.length === 1, "P11 pre-submit must persist one exact paid confirmation");
  assertAcceptance(!await pathExists(relayQueuePath), "P11 pre-submit must not create a relay queue");

  const dreaminaCredentialPath = join(process.env.HOME || "", ".dreamina_cli", "credential.json");
  const evidence = {
    schemaVersion: "p11_provider_canary_pre_submit/1.0.0",
    status: "ready_for_single_paid_confirmation",
    generatedAt: new Date().toISOString(),
    fixture: {
      root: canaryRoot,
      projectRoot,
      projectId,
      shotId,
      projectFactHash: baseline.projectFactHash,
      baselineOutputPath: outputA,
      baselineOutputHash: `sha256:${baseline.outputHashA}`,
      lockedReferences: await Promise.all(sourceReferences.map(async (reference) => ({
        path: reference.target,
        hash: `sha256:${await sha256(join(projectRoot, reference.target))}`,
      }))),
    },
    requestedSubmit: {
      provider: "Jimeng Seedance",
      modelVersion: "seedance2.0_vip",
      videoResolution: "720p",
      durationSeconds: 5,
      ratio: "16:9",
      selectedShotIds: [shotId],
      maxSubmitCount: 1,
      automaticRetry: false,
      storyboardImageGeneration: false,
      revisionIntent,
    },
    stagedJob: {
      jobId: stagedJob.jobId,
      actionId: stagedJob.actionId,
      confirmationId: stagedJob.sourceConfirmationId,
      executionMode: stagedJob.executionMode,
      providerId: stagedJob.providerId,
      modelId: stagedJob.modelId,
      providerCalled: stagedJob.providerCalled,
      externalTaskId: stagedJob.externalTaskId,
    },
    readiness: {
      packagedCredentialStatusConfigured: true,
      packagedCredentialSecretDisplayed: false,
      dreaminaCredentialFilePresent: await fileSize(dreaminaCredentialPath) > 0,
      paidConfirmationCount: confirmation.count,
      relayQueueExists: false,
      providerCalls: 0,
    },
    observation,
    confirmation,
    next: "Obtain one explicit authorization for this exact paid submit, then click the existing confirmation exactly once.",
  };
  await writeFile(preSubmitEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: evidence.status,
    projectRoot,
    shotId,
    modelVersion: evidence.requestedSubmit.modelVersion,
    videoResolution: evidence.requestedSubmit.videoResolution,
    durationSeconds: evidence.requestedSubmit.durationSeconds,
    stagedJob: evidence.stagedJob,
    readiness: evidence.readiness,
    evidencePath: preSubmitEvidencePath,
  }, null, 2));
  } finally {
    if (launch) await closePackagedAcceptanceApp(launch).catch(() => undefined);
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function verifyInvalidExecutionModePreflight() {
  assertAcceptance(
    normalizedPath(canaryRoot) !== "/tmp/vibe-director-p11-b-20260720",
    "P11 invalid preflight must never reuse the consumed live canary root",
  );
  assertAcceptance(
    fixtureExecutionMode === "action_closeup",
    "P11 invalid preflight requires the known noncanonical action_closeup fixture",
  );
  await prepareCanary();
  const prepared = await assertPreparedCanary();

  const guardRoot = join(canaryRoot, "provider-guard");
  const guardPath = join(guardRoot, "dreamina");
  const guardCalledPath = join(guardRoot, "called.txt");
  await mkdir(guardRoot, { recursive: true });
  await writeFile(
    guardPath,
    `#!/bin/sh\nprintf called > ${shellQuote(guardCalledPath)}\nexit 97\n`,
    "utf8",
  );
  await chmod(guardPath, 0o700);

  let launch: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>> | undefined;
  try {
    launch = await launchPackagedAcceptanceApp({
      appPath,
      executablePath,
      profileRoot,
      projectsRoot,
      runtimeRoot,
      bindingPath,
      extraEnv: { VIBE_JIMENG_CLI_PATH: guardPath },
    });
    await openVideoAcceptanceView(launch.client);
    await waitForAcceptance(async () => {
      const state = await launch!.client.evaluate<{ count: number; text: string }>(`(() => ({
        count: document.querySelectorAll('[aria-label="当前生成任务确认"]').length,
        text: document.querySelector('[aria-label="当前生成任务确认"]')?.textContent || ""
      }))()`);
      return state.count === 1 && state.text.includes("seedance2.0_vip") && state.text.includes("720p")
        ? state
        : undefined;
    }, "P11 invalid preflight confirmation did not restore", 60_000);
    const target = await uniqueEnabledButtonTarget(launch.client, "确认并提交 1 次");
    await launch.client.clickAt(target.x, target.y);
    const blockedAction = await waitForAcceptance(async () => {
      const value = await readOptionalJsonFile<any>(join(projectRoot, ".vibe-runtime", "agent-action-log.json"));
      return value?.items?.find((item: any) => (
        item?.id === prepared.job.actionId
        && item?.tone === "blocked"
        && String(item?.result || "").includes("action_closeup")
      ));
    }, "P11 invalid executionMode did not fail at deterministic Rule QA", 60_000);
    const ledger = await readJsonFile<AgentVideoGenerationJobLedger>(generationLedgerPath);
    const submitJob = currentLiveSubmitJob(ledger, prepared.job.jobId);
    assertAcceptance(submitJob.providerCalled === false, "P11 invalid preflight crossed the Provider boundary");
    assertAcceptance(submitJob.status === "staged", "P11 invalid preflight changed the staged live job");
    assertAcceptance(!await pathExists(submitReportPath), "P11 invalid preflight reached the Runtime submit route");
    assertAcceptance(!await pathExists(guardCalledPath), "P11 invalid preflight invoked the guarded dreamina command");
    assertAcceptance(!await pathExists(relayQueuePath), "P11 invalid preflight created a relay queue");
    assertAcceptance(!submitJob.externalTaskId, "P11 invalid preflight invented an externalTaskId");

    const evidence = {
      schemaVersion: "p11_provider_canary_invalid_preflight/1.0.0",
      status: "rule_qa_blocked_before_text_qa_and_provider",
      generatedAt: new Date().toISOString(),
      projectRoot,
      shotId,
      executionMode: fixtureExecutionMode,
      findingCode: "invalid_execution_mode",
      blockedActionResult: blockedAction.result,
      providerCalled: false,
      runtimeSubmitReached: false,
      videoSubmitted: false,
      storyboardGenerated: false,
      providerGuardCalled: false,
      externalTaskId: null,
    };
    await writeJsonFile(join(evidenceRoot, "invalid-execution-mode-preflight.json"), evidence);
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    if (launch) await closePackagedAcceptanceApp(launch).catch(() => undefined);
  }
}

async function inspectCanary() {
  const [preSubmit, submitAttempt, submitEvidence, queryAttempts, ledger, relayQueue, submitReport, resumeReport, previewPlan] = await Promise.all([
    readOptionalJsonFile(preSubmitEvidencePath),
    readOptionalJsonFile(submitAttemptPath),
    readOptionalJsonFile(submitEvidencePath),
    readOptionalJsonFile(queryAttemptsPath),
    readOptionalJsonFile<AgentVideoGenerationJobLedger>(generationLedgerPath),
    readOptionalJsonFile(relayQueuePath),
    readOptionalJsonFile(submitReportPath),
    readOptionalJsonFile(resumeReportPath),
    readOptionalJsonFile(previewPlanPath),
  ]);
  const liveJobs = ledger?.jobs?.filter((job) => job.executionMode === "live") || [];
  const externalTaskId = externalTaskIdFrom(resumeReport || submitReport || relayQueue || submitEvidence);
  const mediaPath = returnedMediaPath(resumeReport || submitReport || relayQueue);
  const attempts = Array.isArray(queryAttempts?.attempts) ? queryAttempts.attempts : [];
  const submitProviderCalls = submitReport?.providerCalled === true ? 1 : 0;
  const queryProviderCalls = attempts.filter((attempt: any) => attempt?.providerCalled === true).length;
  const phase = mediaPath
    ? "returned_needs_review"
    : failedProviderStatus(resumeReport || submitReport)
      ? "provider_terminal_failure"
      : externalTaskId
        ? "submitted_query_only"
        : submitAttempt
          ? "submit_attempt_without_identity"
          : preSubmit
            ? "ready_for_single_paid_confirmation"
            : "not_prepared";
  const observation = {
    schemaVersion: "p11_provider_canary_inspection/1.0.0",
    inspectedAt: new Date().toISOString(),
    phase,
    projectRoot,
    projectId,
    shotId,
    externalTaskId: externalTaskId || undefined,
    returnedMediaPath: mediaPath || undefined,
    previewStatus: previewPlan?.productionStatus || previewPlan?.status,
    files: {
      preSubmitEvidence: Boolean(preSubmit),
      submitAttempt: Boolean(submitAttempt),
      submitEvidence: Boolean(submitEvidence),
      relayQueue: Boolean(relayQueue),
      submitReport: Boolean(submitReport),
      resumeReport: Boolean(resumeReport),
    },
    liveJobs: liveJobs.map((job) => ({
      jobId: job.jobId,
      operation: job.operation,
      status: job.status,
      providerId: job.providerId,
      modelId: job.modelId,
      providerCalled: job.providerCalled,
      externalTaskId: job.externalTaskId,
      reviewStatus: job.reviewResult?.status,
      outputPath: job.reviewResult?.outputPath,
      outputHash: job.reviewResult?.outputHash,
    })),
    submitAttemptCount: submitAttempt ? 1 : 0,
    queryAttemptCount: attempts.length,
    providerCalls: {
      submit: submitProviderCalls,
      query: queryProviderCalls,
      total: submitProviderCalls + queryProviderCalls,
    },
    automaticRetry: false,
  };
  console.log(JSON.stringify(observation, null, 2));
  return observation;
}

async function submitCanary() {
  assertAcceptance(
    paidAuthorization === exactPaidAuthorization,
    `P11 paid submit is locked. Pass --paid-authorization=${exactPaidAuthorization} only after the user confirms the exact 5s 720p seedance2.0_vip shot.`,
  );
  const prepared = await assertPreparedCanary();
  assertAcceptance(!await pathExists(submitAttemptPath), "P11 submit attempt already exists; a second Provider submit is forbidden");

  let launch: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>> | undefined;
  let report: any;
  let waitError = "";
  let observationBefore: Record<string, unknown> | undefined;
  let observationAfter: Record<string, unknown> | undefined;
  try {
    launch = await launchPackagedAcceptanceApp({
      appPath,
      executablePath,
      profileRoot,
      projectsRoot,
      runtimeRoot,
      bindingPath,
    });
    await openVideoAcceptanceView(launch.client);
    await waitForAcceptance(async () => {
      const state = await launch!.client.evaluate<{ count: number; text: string; enabled: string[] }>(`(() => ({
        count: document.querySelectorAll('[aria-label="当前生成任务确认"]').length,
        text: document.querySelector('[aria-label="当前生成任务确认"]')?.textContent || "",
        enabled: [...document.querySelectorAll('[aria-label="当前生成任务确认"] button:not(:disabled)')].map((item) => item.textContent?.trim() || "")
      }))()`);
      return state.count === 1
        && state.text.includes("seedance2.0_vip")
        && state.text.includes("720p")
        && state.enabled.filter((text) => text === "确认并提交 1 次").length === 1
        ? state
        : undefined;
    }, "P11 exact paid confirmation did not restore", 60_000);
    observationBefore = await observePackagedTask(launch.client);
    const target = await uniqueEnabledButtonTarget(launch.client, "确认并提交 1 次");
    const attemptedAt = new Date().toISOString();
    await writeFile(submitAttemptPath, `${JSON.stringify({
      schemaVersion: "p11_provider_canary_submit_attempt/1.0.0",
      attemptId: `p11_submit_${Date.now()}`,
      attemptedAt,
      projectRoot,
      projectId,
      shotId,
      jobId: prepared.job.jobId,
      actionId: prepared.job.actionId,
      confirmationId: prepared.job.sourceConfirmationId,
      providerId: prepared.job.providerId,
      modelId: prepared.job.modelId,
      videoResolution: prepared.evidence.requestedSubmit.videoResolution,
      durationSeconds: prepared.evidence.requestedSubmit.durationSeconds,
      authorization: "exact_phrase_matched",
      maxSubmitCount: 1,
      automaticRetry: false,
      buttonTarget: target,
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await launch.client.clickAt(target.x, target.y);
    try {
      report = await waitForAcceptance(async () => {
        const value = await readOptionalJsonFile<any>(submitReportPath);
        if (!value) return undefined;
        return externalTaskIdFrom(value) || returnedMediaPath(value) || failedProviderStatus(value)
          ? value
          : undefined;
      }, "P11 single submit did not produce a recoverable identity or terminal result", 6 * 60_000);
    } catch (error) {
      waitError = error instanceof Error ? error.message : String(error);
      report = await readOptionalJsonFile(submitReportPath);
    }
    observationAfter = await observePackagedTask(launch.client).catch(() => undefined);
  } finally {
    if (launch) await closePackagedAcceptanceApp(launch).catch(() => undefined);
  }

  const violations: string[] = [];
  const check = (condition: unknown, message: string) => { if (!condition) violations.push(message); };
  const ledger = await readJsonFile<AgentVideoGenerationJobLedger>(generationLedgerPath);
  const submitJob = currentLiveSubmitJob(ledger, prepared.job.jobId);
  const relayQueue = await readOptionalJsonFile<any>(relayQueuePath);
  const externalTaskId = externalTaskIdFrom(report || relayQueue);
  const mediaPath = returnedMediaPath(report || relayQueue);
  let submitLogPath = "";
  let submitLog: any;
  if (report?.submitLogPath) {
    const artifact = await projectJsonFromReportedPath(report.submitLogPath).catch((error) => {
      violations.push(error instanceof Error ? error.message : String(error));
      return undefined;
    });
    submitLogPath = artifact?.path || "";
    submitLog = artifact?.value;
  }
  const args = Array.isArray(submitLog?.args) ? submitLog.args.map(String) : [];
  const imagePaths = args.flatMap((argument: string, index: number) => argument === "--image" ? [String(args[index + 1] || "")] : []);
  const expectedImagePaths = sourceReferences.map((reference) => normalizedPath(join(projectRoot, reference.target))).sort();
  const actualImagePaths = imagePaths.map(normalizedPath).sort();

  check(Boolean(report), "P11 submit report is missing");
  check(report?.providerCalled === true && report?.runtimeExternalNetworkCallMade === true, "P11 submit report does not prove one external Provider call");
  check(report?.storyboardGenerated === false, "P11 submit unexpectedly generated a storyboard image");
  check(report?.videoSubmitted === true || failedProviderStatus(report), "P11 submit report neither submitted nor reached an explicit failure");
  check(Boolean(submitLog), "P11 submit command log is missing");
  check(args[0] === "multimodal2video", "P11 submit command is not multimodal2video");
  check(args.filter((argument: string) => argument === "multimodal2video").length === 1, "P11 submit command count is not exactly one");
  check(argValue(args, "--model_version") === "seedance2.0_vip", "P11 submit model is not seedance2.0_vip");
  check(argValue(args, "--video_resolution") === "720p", "P11 submit resolution is not 720p");
  check(argValue(args, "--duration") === "5", "P11 submit duration is not 5 seconds");
  check(argValue(args, "--ratio") === "16:9", "P11 submit ratio is not 16:9");
  check(imagePaths.length === 3, `P11 submit must use exactly three locked references, found ${imagePaths.length}`);
  check(JSON.stringify(actualImagePaths) === JSON.stringify(expectedImagePaths), "P11 submit reference paths do not match the three locked project references");
  check(submitLog?.rawSecretStored === false, "P11 submit log must not store a raw secret");
  check(submitJob.providerCalled === true, "P11 live submit job does not record the Provider call");
  check(submitJob.providerId === "jimeng-seedance" && submitJob.modelId === "seedance2.0_vip", "P11 live job lost the exact Provider/model identity");
  check(ledger.jobs.filter((job) => job.kind === "video_submit" && job.operation === "execute" && job.executionMode === "live").length === 1, "P11 ledger contains more than one live submit job");
  if (externalTaskId) {
    check(submitJob.externalTaskId === externalTaskId, "P11 job externalTaskId does not match the Provider report");
    check(externalTaskIdFrom(relayQueue) === externalTaskId, "P11 relay queue externalTaskId does not match the Provider report");
  }

  const outcome = mediaPath
    ? "returned_needs_review"
    : failedProviderStatus(report)
      ? "provider_terminal_failure"
      : externalTaskId && activeProviderStatus(report)
        ? "submitted_query_only"
        : "identity_missing_or_ambiguous";
  if (outcome === "submitted_query_only") check(submitJob.status === "running", `P11 submitted job must remain running, got ${submitJob.status}`);
  if (outcome === "returned_needs_review") {
    check(report?.uiStatus === "needs_review", "P11 immediately returned media is not held at needs_review");
    check(submitJob.status === "succeeded" && submitJob.reviewResult?.status === "needs_review", "P11 immediately returned media did not close the submit job into needs_review");
  }
  if (outcome === "identity_missing_or_ambiguous") violations.push(waitError || "P11 Provider result has no exact externalTaskId or terminal status");

  const evidence = {
    schemaVersion: "p11_provider_canary_submit/1.0.0",
    status: violations.length ? "contract_violation" : outcome,
    generatedAt: new Date().toISOString(),
    projectRoot,
    projectId,
    shotId,
    request: prepared.evidence.requestedSubmit,
    job: {
      jobId: submitJob.jobId,
      actionId: submitJob.actionId,
      confirmationId: submitJob.sourceConfirmationId,
      status: submitJob.status,
      providerId: submitJob.providerId,
      modelId: submitJob.modelId,
      providerCalled: submitJob.providerCalled,
      externalTaskId: submitJob.externalTaskId,
      reviewResult: submitJob.reviewResult,
    },
    provider: {
      status: reportStatus(report),
      externalTaskId: externalTaskId || undefined,
      queuePosition: relayItems(relayQueue).find((item: any) => externalTaskIdFrom(item) === externalTaskId)?.queuePosition,
      returnedMediaPath: mediaPath || undefined,
      submitReportPath: await pathExists(submitReportPath) ? submitReportPath : undefined,
      submitLogPath: submitLogPath || undefined,
      relayQueuePath: await pathExists(relayQueuePath) ? relayQueuePath : undefined,
      command: args[0],
      modelVersion: argValue(args, "--model_version"),
      videoResolution: argValue(args, "--video_resolution"),
      durationSeconds: Number(argValue(args, "--duration") || 0),
      ratio: argValue(args, "--ratio"),
      referenceCount: imagePaths.length,
      storyboardGenerated: report?.storyboardGenerated,
    },
    guarantees: {
      submitAttempts: 1,
      automaticRetry: false,
      extraStoryboardImages: 0,
      rawSecretStored: false,
    },
    observationBefore,
    observationAfter,
    waitError: waitError || undefined,
    violations,
    next: outcome === "submitted_query_only"
      ? "Use query mode only; never submit this shot again."
      : outcome === "returned_needs_review"
        ? "Inspect the returned media without approval, promotion, or export."
        : "Stop. Do not retry or submit again.",
  };
  await writeJsonFile(submitEvidencePath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  assertAcceptance(violations.length === 0, `P11 single submit violated its contract: ${violations.join(" ")}`);
  assertAcceptance(outcome !== "provider_terminal_failure", "P11 Provider returned a terminal failure; no retry is allowed");
  assertAcceptance(outcome !== "identity_missing_or_ambiguous", "P11 Provider task identity is missing or ambiguous; no retry is allowed");
}

async function queryCanary() {
  assertAcceptance(await pathExists(submitEvidencePath), "P11 query is locked until the single submit produces exact evidence");
  const submitEvidence = await readJsonFile<any>(submitEvidencePath);
  const externalTaskId = String(submitEvidence?.provider?.externalTaskId || "").trim();
  assertAcceptance(submitEvidence.status === "submitted_query_only", `P11 query requires an active submitted task, got ${submitEvidence.status}`);
  assertAcceptance(Boolean(externalTaskId), "P11 query requires the exact externalTaskId from the single submit evidence");
  const relayQueueBefore = await readJsonFile<any>(relayQueuePath);
  const matchingItems = relayItems(relayQueueBefore).filter((item: any) => externalTaskIdFrom(item) === externalTaskId);
  assertAcceptance(matchingItems.length === 1, `P11 relay queue must contain exactly one matching task, found ${matchingItems.length}`);
  const relayItem = matchingItems[0]!;
  assertAcceptance(activeProviderStatus(relayItem), `P11 task is not queryable: ${reportStatus(relayItem)}`);
  const resumeCommand = String(relayItem.resumeCommand || "").trim();
  assertAcceptance(resumeCommand.includes("query_result"), "P11 resume command is not query_result");
  assertAcceptance(resumeCommand.includes(`--submit_id=${externalTaskId}`), "P11 resume command does not bind the exact externalTaskId");
  assertAcceptance(!resumeCommand.includes("multimodal2video"), "P11 query command contains forbidden multimodal2video");

  const previousResumeMtime = await stat(resumeReportPath).then((value) => value.mtimeMs).catch(() => 0);
  const ledgerBefore = await readJsonFile<AgentVideoGenerationJobLedger>(generationLedgerPath);
  const queryJobsBefore = ledgerBefore.jobs.filter((job) => job.kind === "video_submit" && job.operation === "query");
  const history = await readOptionalJsonFile<any>(queryAttemptsPath) || {
    schemaVersion: "p11_provider_canary_query_attempts/1.0.0",
    projectRoot,
    projectId,
    shotId,
    externalTaskId,
    attempts: [],
  };
  assertAcceptance(history.externalTaskId === externalTaskId, "P11 query history belongs to another task");
  assertAcceptance(Array.isArray(history.attempts), "P11 query history is invalid");

  let launch: Awaited<ReturnType<typeof launchPackagedAcceptanceApp>> | undefined;
  let report: any;
  let waitError = "";
  let attemptIndex = -1;
  try {
    launch = await launchPackagedAcceptanceApp({
      appPath,
      executablePath,
      profileRoot,
      projectsRoot,
      runtimeRoot,
      bindingPath,
    });
    await openVideoAcceptanceView(launch.client);
    await waitForAcceptance(async () => {
      const state = await launch!.client.evaluate<{ task: string; buttons: string[]; body: string }>(`(() => ({
        task: document.querySelector('.minimal-agent-panel [aria-label="AI 导演当前任务"] strong')?.textContent?.trim() || "",
        buttons: [...document.querySelectorAll("button:not(:disabled)")].map((item) => item.textContent?.trim() || ""),
        body: document.querySelector('.minimal-agent-panel')?.textContent || ""
      }))()`);
      return state.task.includes("查询视频结果")
        && state.buttons.filter((text) => text === "确认查询结果").length === 1
        && state.body.includes("不会重复提交")
        ? state
        : undefined;
    }, "P11 packaged App did not restore the query-only confirmation", 60_000);
    const target = await uniqueEnabledButtonTarget(launch.client, "确认查询结果");
    const attempt = {
      attempt: history.attempts.length + 1,
      startedAt: new Date().toISOString(),
      externalTaskId,
      resumeCommand,
      commandValidatedBeforeClick: true,
      forbiddenSubmitCommandAbsent: true,
      buttonTarget: target,
      status: "query_started",
    };
    history.attempts.push(attempt);
    attemptIndex = history.attempts.length - 1;
    await writeJsonFile(queryAttemptsPath, history);
    await launch.client.clickAt(target.x, target.y);
    try {
      report = await waitForAcceptance(async () => {
        const currentStat = await stat(resumeReportPath).catch(() => undefined);
        if (!currentStat || currentStat.mtimeMs <= previousResumeMtime) return undefined;
        return readJsonFile<any>(resumeReportPath);
      }, "P11 query did not produce a fresh resume report", 6 * 60_000);
    } catch (error) {
      waitError = error instanceof Error ? error.message : String(error);
      report = await readOptionalJsonFile(resumeReportPath);
    }
    history.attempts[attemptIndex].packagedObservation = await observePackagedTask(launch.client).catch(() => undefined);
  } finally {
    if (launch) await closePackagedAcceptanceApp(launch).catch(() => undefined);
  }

  const violations: string[] = [];
  const check = (condition: unknown, message: string) => { if (!condition) violations.push(message); };
  let queryLogPath = "";
  let queryLog: any;
  if (report?.queryLogPath) {
    const artifact = await projectJsonFromReportedPath(report.queryLogPath).catch((error) => {
      violations.push(error instanceof Error ? error.message : String(error));
      return undefined;
    });
    queryLogPath = artifact?.path || "";
    queryLog = artifact?.value;
  }
  const args = Array.isArray(queryLog?.args) ? queryLog.args.map(String) : [];
  check(Boolean(report), "P11 query report is missing");
  check(report?.providerCalled === true && report?.runtimeExternalNetworkCallMade === true, "P11 query report does not prove a Provider query");
  check(args[0] === "query_result", "P11 query log does not start with query_result");
  check(args.includes(`--submit_id=${externalTaskId}`), "P11 query log does not bind the exact externalTaskId");
  check(!args.includes("multimodal2video"), "P11 query log contains forbidden multimodal2video");
  check(queryLog?.rawSecretStored === false, "P11 query log must not store a raw secret");
  check(externalTaskIdFrom(report) === externalTaskId, "P11 query response changed the externalTaskId");

  const ledger = await readJsonFile<AgentVideoGenerationJobLedger>(generationLedgerPath);
  const queryJobs = ledger.jobs.filter((job) => job.kind === "video_submit" && job.operation === "query" && job.externalTaskId === externalTaskId);
  check(queryJobs.length === 1, `P11 must reuse one query job, found ${queryJobs.length}`);
  check(queryJobs.length <= queryJobsBefore.length + 1, "P11 query appended duplicate jobs in one attempt");
  const submitJob = currentLiveSubmitJob(ledger, submitEvidence.job.jobId);
  const relayQueue = await readOptionalJsonFile<any>(relayQueuePath);
  const updatedItems = relayItems(relayQueue).filter((item: any) => externalTaskIdFrom(item) === externalTaskId);
  check(updatedItems.length === 1, `P11 updated relay queue lost its exact task identity: ${updatedItems.length}`);
  const updatedItem = updatedItems[0];
  const mediaPath = returnedMediaPath(report || relayQueue);
  const outcome = mediaPath
    ? "returned_needs_review"
    : failedProviderStatus(report) || failedProviderStatus(updatedItem)
      ? "provider_terminal_failure"
      : activeProviderStatus(report) || activeProviderStatus(updatedItem)
        ? "submitted_query_only"
        : "identity_missing_or_ambiguous";

  let returnedMedia: Record<string, unknown> | undefined;
  if (outcome === "returned_needs_review") {
    const realMediaPath = await verifiedProjectArtifact(mediaPath).catch((error) => {
      violations.push(error instanceof Error ? error.message : String(error));
      return "";
    });
    const actualHash = realMediaPath ? `sha256:${await sha256(realMediaPath)}` : "";
    const reportedHash = normalizedHash(report?.outputVideoSha256 || updatedItem?.outputVideoSha256);
    const previewPlan = await readJsonFile<any>(previewPlanPath);
    const previewItem = [...(previewPlan.previewItems || []), ...(previewPlan.clips || [])].find((item: any) => item.externalTaskId === externalTaskId || item.shotId === shotId);
    const project = JSON.parse(await readFile(projectPath, "utf8"));
    const projectFactHash = hashProjectVibeFacts(project);
    check(Boolean(actualHash), "P11 returned media hash could not be calculated");
    check(reportedHash === actualHash, "P11 returned media SHA-256 does not match the Provider report");
    check(normalizedHash(updatedItem?.outputVideoSha256) === actualHash, "P11 relay queue SHA-256 does not match the returned media");
    check(report?.uiStatus === "needs_review", "P11 returned query report is not needs_review");
    check(previewPlan.productionStatus === "needs_review" && previewPlan.previewStatus === "returned_with_review_overlay", "P11 preview did not remain at needs_review");
    check(previewItem?.reviewRequired === true || previewItem?.status === "returned_with_review_overlay", "P11 returned preview is not review-gated");
    check(submitJob.status === "succeeded" && submitJob.reviewResult?.status === "needs_review", "P11 returned media did not close the original submit job into needs_review");
    check(normalizedHash(submitJob.reviewResult?.outputHash) === actualHash, "P11 submit-job Review hash does not match the returned media");
    check(normalizedPath(resolve(projectRoot, submitJob.reviewResult?.outputPath || "")) === normalizedPath(resolve(projectRoot, mediaPath)), "P11 submit-job Review path does not match the returned media");
    check(projectFactHash === submitEvidence.request.projectFactHash || projectFactHash === (await readJsonFile<any>(preSubmitEvidencePath)).fixture.projectFactHash, "P11 query unexpectedly changed project facts");
    check(!await pathExists(reviewSelectionLedgerPath), "P11 query unexpectedly created a selection or promotion ledger");
    check(!await pathExists(join(projectRoot, "exports")), "P11 query unexpectedly created an export");
    returnedMedia = {
      outputPath: realMediaPath,
      outputHash: actualHash,
      bytes: realMediaPath ? await fileSize(realMediaPath) : 0,
      status: "needs_review",
      selected: false,
      promoted: false,
      delivered: false,
    };
  }
  if (outcome === "submitted_query_only") {
    check(submitJob.status === "running", `P11 queued submit job must remain running, got ${submitJob.status}`);
  }
  if (outcome === "identity_missing_or_ambiguous") violations.push(waitError || "P11 query response is ambiguous");

  const attempt = history.attempts[attemptIndex];
  attempt.completedAt = new Date().toISOString();
  attempt.status = violations.length ? "contract_violation" : outcome;
  attempt.providerCalled = report?.providerCalled === true;
  attempt.providerStatus = reportStatus(report);
  attempt.queuePosition = updatedItem?.queuePosition ?? report?.queueInfo?.position;
  attempt.queryLogPath = queryLogPath || undefined;
  attempt.returnedMedia = returnedMedia;
  attempt.waitError = waitError || undefined;
  attempt.violations = violations;
  await writeJsonFile(queryAttemptsPath, history);
  console.log(JSON.stringify({
    status: attempt.status,
    externalTaskId,
    queryAttempt: attempt.attempt,
    providerStatus: attempt.providerStatus,
    queuePosition: attempt.queuePosition,
    returnedMedia,
    violations,
    queryAttemptsPath,
  }, null, 2));
  assertAcceptance(violations.length === 0, `P11 query violated its contract: ${violations.join(" ")}`);
  assertAcceptance(outcome !== "provider_terminal_failure", "P11 Provider returned a terminal failure; no retry or resubmit is allowed");
  assertAcceptance(outcome !== "identity_missing_or_ambiguous", "P11 Provider result is ambiguous; no retry or resubmit is allowed");
}

if (mode === "prepare") await prepareCanary();
if (mode === "submit") await submitCanary();
if (mode === "query") await queryCanary();
if (mode === "inspect") await inspectCanary();
if (mode === "preflight-invalid") await verifyInvalidExecutionModePreflight();
