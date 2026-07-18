import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
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
  parseProjectVibeText,
  serializeProjectVibe,
} from "../src/project/index.ts";
import { projectAgentGenerationJobLedgerPath } from "../src/project/projectAgentGenerationJobLedger.ts";
import { projectAgentReviewSelectionLedgerPath } from "../src/project/projectAgentReviewSelectionLedger.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

async function waitFor<T>(probe: () => Promise<T | undefined>, message: string, timeoutMs = 30_000): Promise<T> {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await probe();
      if (value !== undefined) return value;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error(`${message}${lastError ? `: ${lastError}` : ""}`);
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  assert(address && typeof address === "object", "could not allocate an acceptance control port");
  await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

class PackagedAcceptanceClient {
  private nextId = 1;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  private buffer = "";

  private constructor(private readonly socket: Socket, private readonly token: string) {
    socket.on("data", (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const payload = JSON.parse(line) as { id?: number; ok?: boolean; value?: unknown; error?: string };
        if (!payload.id) continue;
        const request = this.pending.get(payload.id);
        if (!request) continue;
        this.pending.delete(payload.id);
        if (!payload.ok) request.reject(new Error(payload.error || "packaged acceptance request failed"));
        else request.resolve(payload.value);
      }
    });
    socket.on("close", () => {
      for (const request of this.pending.values()) request.reject(new Error("packaged acceptance socket closed"));
      this.pending.clear();
    });
  }

  static async connect(port: number, token: string): Promise<PackagedAcceptanceClient> {
    const socket = createConnection({ host: "127.0.0.1", port });
    await new Promise<void>((resolveConnect, rejectConnect) => {
      socket.once("connect", resolveConnect);
      socket.once("error", rejectConnect);
    });
    return new PackagedAcceptanceClient(socket, token);
  }

  async send(method: "evaluate" | "close", params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    const result = new Promise((resolveRequest, rejectRequest) => {
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
    });
    this.socket.write(`${JSON.stringify({ id, token: this.token, method, ...params })}\n`);
    return result;
  }

  evaluate<T>(expression: string): Promise<T> {
    return this.send("evaluate", { expression }) as Promise<T>;
  }

  close(): void {
    this.socket.destroy();
  }
}

interface RunningPackagedApp {
  child: ChildProcessWithoutNullStreams;
  client: PackagedAcceptanceClient;
  stdout: string[];
  stderr: string[];
  redirectedStdoutPath?: string;
  redirectedStderrPath?: string;
  darwinLaunchMarker?: string;
}

async function terminateDarwinLaunch(marker: string | undefined): Promise<void> {
  if (!marker) return;
  await new Promise<void>((resolveStop) => {
    const stop = spawn("pkill", ["-TERM", "-f", marker], { stdio: "ignore" });
    stop.once("error", resolveStop);
    stop.once("exit", resolveStop);
  });
}

async function launchPackagedApp(input: {
  appPath: string;
  executablePath: string;
  profileRoot: string;
  projectsRoot: string;
  runtimeRoot: string;
  bindingPath: string;
}): Promise<RunningPackagedApp> {
  const port = await freePort();
  const controlToken = `${randomUUID()}${randomUUID()}`;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const launchEnv = {
    VIBE_DIRECTOR_USER_DATA_DIR: input.profileRoot,
    VIBE_DIRECTOR_PROJECTS_ROOT: input.projectsRoot,
    VIBE_DIRECTOR_RUNTIME_WORKDIR: input.runtimeRoot,
    VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH: input.bindingPath,
    VIBE_DIRECTOR_RUNTIME_API_PORT: "0",
    VIBE_ELECTRON_PACKAGED_ACCEPTANCE: "1",
    VIBE_ELECTRON_ACCEPTANCE_CONTROL_PORT: String(port),
    VIBE_ELECTRON_ACCEPTANCE_CONTROL_TOKEN: controlToken,
    VIBE_APIKEY_FUN_API_KEY: "",
    VIBE_DEEPSEEK_API_KEY: "",
    VIBE_TTS_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GEMINI_API_KEY: "",
  };
  const darwinLaunchMarker = process.platform === "darwin" ? `vibe-packaged-acceptance-id=${port}` : undefined;
  const redirectedStdoutPath = process.platform === "darwin" ? join(input.runtimeRoot, `packaged-app-${port}.stdout.log`) : undefined;
  const redirectedStderrPath = process.platform === "darwin" ? join(input.runtimeRoot, `packaged-app-${port}.stderr.log`) : undefined;
  if (redirectedStdoutPath && redirectedStderrPath) {
    await writeFile(redirectedStdoutPath, "", "utf8");
    await writeFile(redirectedStderrPath, "", "utf8");
  }
  const marker = darwinLaunchMarker || `vibe-packaged-acceptance-id=${port}`;
  const appArgs = [`--user-data-dir=${input.profileRoot}`, `--${marker}`];
  const child = process.platform === "darwin"
    ? spawn("open", [
        "-n",
        "-g",
        "-o",
        redirectedStdoutPath!,
        "--stderr",
        redirectedStderrPath!,
        ...Object.entries(launchEnv).flatMap(([name, value]) => ["--env", `${name}=${value}`]),
        input.appPath,
        "--args",
        ...appArgs,
      ], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] })
    : spawn(input.executablePath, appArgs, {
        cwd: process.cwd(),
        env: { ...process.env, ...launchEnv },
        stdio: ["ignore", "pipe", "pipe"],
      });
  child.stdout.on("data", (chunk) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  child.once("error", (error) => stderr.push(String(error)));

  try {
    const client = await waitFor(async () => {
      if ((child.exitCode !== null || child.signalCode !== null) && process.platform !== "darwin") {
        throw new Error(`packaged App exited with ${child.exitCode}/${child.signalCode}: ${stderr.join("")}`);
      }
      return PackagedAcceptanceClient.connect(port, controlToken).catch(() => undefined);
    }, "packaged acceptance control did not appear", 30_000);
    await waitFor(async () => {
      const ready = await client.evaluate<boolean>("Boolean(document.querySelector('#root') && document.body?.innerText?.includes('AI 导演'))");
      return ready ? true : undefined;
    }, "packaged renderer did not reach the Agent-first surface", 30_000);
    return { child, client, stdout, stderr, redirectedStdoutPath, redirectedStderrPath, darwinLaunchMarker };
  } catch (error) {
    await terminateDarwinLaunch(darwinLaunchMarker);
    child.kill("SIGTERM");
    const redirectedStdout = redirectedStdoutPath && await exists(redirectedStdoutPath) ? await readFile(redirectedStdoutPath, "utf8") : "";
    const redirectedStderr = redirectedStderrPath && await exists(redirectedStderrPath) ? await readFile(redirectedStderrPath, "utf8") : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)}\npackaged stdout:\n${stdout.join("")}${redirectedStdout}\npackaged stderr:\n${stderr.join("")}${redirectedStderr}`);
  }
}

async function closePackagedApp(app: RunningPackagedApp): Promise<void> {
  await app.client.send("close").catch(() => undefined);
  app.client.close();
  if (app.child.exitCode !== null || app.child.signalCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveExit) => app.child.once("exit", resolveExit)),
    new Promise<void>((resolveTimeout) => setTimeout(async () => {
      await terminateDarwinLaunch(app.darwinLaunchMarker);
      if (app.child.exitCode === null && app.child.signalCode === null) app.child.kill("SIGTERM");
      resolveTimeout();
    }, 3000)),
  ]);
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function listFiles(root: string): Promise<string[]> {
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

async function openVideoView(client: PackagedAcceptanceClient): Promise<void> {
  await waitFor(async () => {
    const found = await client.evaluate<boolean>(`[...document.querySelectorAll("button")].some((item) => item.getAttribute("aria-label")?.startsWith("视频，"))`);
    return found ? true : undefined;
  }, "video rail action did not appear");
  await client.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label")?.startsWith("视频，"));
    button?.click();
    return Boolean(button);
  })()`);
}

async function runtimeBoundary(client: PackagedAcceptanceClient): Promise<Record<string, boolean>> {
  return client.evaluate(`(async () => {
    const baseUrl = await window.vibeRuntime.ensureRuntimeApiBaseUrl();
    const token = window.vibeRuntime.runtimeApiToken();
    const response = await fetch(baseUrl + "/api/runtime/status", { headers: { "x-vibe-runtime-token": token } });
    const payload = await response.json();
    return {
      tokenRequired: payload.tokenRequired === true,
      providerCalled: payload.providerCalled === true,
      liveSubmitAllowed: payload.liveSubmitAllowed === true
    };
  })()`);
}

function addLocalReviewCandidate(input: {
  ledger: AgentVideoGenerationJobLedger;
  plan: ReturnType<typeof buildAgentVideoPipelinePlan>;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  version: "a" | "b";
  outputPath: string;
  outputHash: string;
  createdAt: string;
}): AgentVideoGenerationJobLedger {
  const actionId = `p10d8_action_${input.version}`;
  const confirmationId = `p10d8_confirmation_${input.version}`;
  const staged = planAgentVideoProductionAction({
    plan: input.plan,
    ledger: input.ledger,
    action: "submit_video",
    actionId,
    sourceConfirmationId: confirmationId,
    generatedAt: input.createdAt,
    executionMode: "dry_run",
    prompt: `local deterministic candidate ${input.version}`,
  });
  assert(staged.status === "staged_job" && staged.job, `candidate ${input.version} did not stage`);
  const confirmed = transitionAgentVideoGenerationJob({
    ledger: staged.ledger,
    jobId: staged.job.jobId,
    status: "confirmed",
    generatedAt: new Date(Date.parse(input.createdAt) + 1000).toISOString(),
  });
  assert(confirmed.ok && confirmed.job, `candidate ${input.version} did not confirm`);
  const running = transitionAgentVideoGenerationJob({
    ledger: confirmed.ledger,
    jobId: staged.job.jobId,
    status: "running",
    generatedAt: new Date(Date.parse(input.createdAt) + 2000).toISOString(),
    providerCalled: false,
  });
  assert(running.ok && running.job, `candidate ${input.version} did not enter local running`);
  const returned = recordAgentVideoGenerationJobReviewResult({
    ledger: running.ledger,
    jobId: staged.job.jobId,
    result: {
      status: "needs_review",
      projectId: input.projectId,
      projectRoot: input.projectRoot,
      projectFactHash: input.projectFactHash,
      jobId: staged.job.jobId,
      actionId,
      shotId: input.shotId,
      sourceReceiptId: `p10d8_local_receipt_${input.version}`,
      outputPath: input.outputPath,
      outputHash: `sha256:${input.outputHash}`,
      receivedAt: new Date(Date.parse(input.createdAt) + 3000).toISOString(),
    },
  });
  assert(returned.ok && returned.job?.status === "succeeded", `candidate ${input.version} did not return for review`);
  return returned.ledger;
}

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const evidencePath = resolve(process.argv[3] || "docs/evidence/p10-d-review-selection-20260719/packaged-observation.json");
const sourceMediaA = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_1_rainy_ticket.mp4");
const sourceMediaB = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_2_follow_blue_light.mp4");
assert(await exists(executablePath), `packaged App executable is missing: ${executablePath}`);
assert(await exists(sourceMediaA) && await exists(sourceMediaB), "local deterministic media fixtures are missing");

const root = await mkdtemp("/tmp/vibe-director-p10-d8-20260719-");
const profileRoot = join(root, "profile");
const projectsRoot = join(root, "projects");
const runtimeRoot = join(root, "runtime");
const projectRoot = join(projectsRoot, "p10-d8-review-selection");
const projectPath = join(projectRoot, "project.vibe");
const bindingPath = join(profileRoot, "current-project.local.json");
const videoRoot = join(projectRoot, "video");
const outputA = join(videoRoot, "P10D8S01-version-a.mp4");
const outputB = join(videoRoot, "P10D8S01-version-b.mp4");
await mkdir(videoRoot, { recursive: true });
await Promise.all([
  mkdir(profileRoot, { recursive: true }),
  mkdir(runtimeRoot, { recursive: true }),
  copyFile(sourceMediaA, outputA),
  copyFile(sourceMediaB, outputB),
]);

const projectId = "p10_d8_packaged_project";
const shotId = "P10D8S01";
const createdAt = "2026-07-19T01:00:00.000Z";
const project = createProjectVibe({
  projectId,
  title: "P10-D8 Review Selection Acceptance",
  version: "1.0.0",
  createdAt,
  updatedAt: createdAt,
  storyFlow: {
    id: "p10_d8_story",
    sections: [{ id: "section_1", title: "雨夜递出", summary: "女孩把纸飞机递给机器人保安。", sequenceIndex: 0, shotIds: [shotId] }],
    shotOrder: [shotId],
  },
  visualMemory: {
    id: "p10_d8_visual_memory",
    entries: [{
      id: "vm_scene",
      assetId: "scene_store",
      kind: "scene",
      label: "雨夜便利店门口",
      status: "candidate",
      textConstraints: ["雨夜", "便利店灯箱"],
      usedByShotIds: [shotId],
      canUseAsFutureReference: false,
      sourceRefs: ["p10-d8-fixture"],
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
    status: "planned",
    sourceRefs: ["p10-d8-fixture:shot"],
    referenceStrategy: "storyboard_narrative",
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
    status: "candidate",
    textConstraints: ["雨夜", "便利店灯箱"],
    usedByShotIds: [shotId],
    sourceRefs: ["p10-d8-fixture"],
  }],
  runs: [],
});
const projectFactHash = hashProjectVibeFacts(project);
const serializedProject = serializeProjectVibe(project);
const parsedProject = parseProjectVibeText(serializedProject);
assert(parsedProject.ok, `fixture project.vibe is invalid: ${parsedProject.errors.join("; ")}`);
await writeFile(projectPath, serializedProject, "utf8");
await writeFile(bindingPath, `${JSON.stringify({
  projectRoot,
  projectRootRelativePath: projectRoot,
  projectVibeRelativePath: "project.vibe",
  projectId,
  displayName: project.manifest.title,
}, null, 2)}\n`, "utf8");

const outputHashA = await sha256(outputA);
const outputHashB = await sha256(outputB);
assert(outputHashA !== outputHashB, "version pair media fixtures must have distinct SHA-256 values");
const plan = buildAgentVideoPipelinePlan({
  planId: "p10_d8_pair_plan",
  generatedAt: createdAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
let ledger = createAgentVideoGenerationJobLedger({
  ledgerId: "p10_d8_pair_ledger",
  projectId,
  projectRoot,
  projectFactHash,
  createdAt,
});
ledger = addLocalReviewCandidate({
  ledger,
  plan,
  projectId,
  projectRoot,
  projectFactHash,
  shotId,
  version: "a",
  outputPath: outputA,
  outputHash: outputHashA,
  createdAt: "2026-07-19T01:01:00.000Z",
});
ledger = addLocalReviewCandidate({
  ledger,
  plan,
  projectId,
  projectRoot,
  projectFactHash,
  shotId,
  version: "b",
  outputPath: outputB,
  outputHash: outputHashB,
  createdAt: "2026-07-19T01:02:00.000Z",
});
const ledgerPath = join(projectRoot, projectAgentGenerationJobLedgerPath);
const selectionLedgerPath = join(projectRoot, projectAgentReviewSelectionLedgerPath);
await mkdir(dirname(ledgerPath), { recursive: true });
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

const baseline = {
  projectHash: await sha256(projectPath),
  ledgerHash: await sha256(ledgerPath),
  outputHashA,
  outputHashB,
  files: await listFiles(projectRoot),
};
let firstLaunch: RunningPackagedApp | undefined;
let coldLaunch: RunningPackagedApp | undefined;
let promotionLaunch: RunningPackagedApp | undefined;
let promotedColdLaunch: RunningPackagedApp | undefined;
let corruptLaunch: RunningPackagedApp | undefined;
let firstObservation: Record<string, unknown> = {};
let coldObservation: Record<string, unknown> = {};
let promotionObservation: Record<string, unknown> = {};
let promotedColdObservation: Record<string, unknown> = {};
let corruptObservation: Record<string, unknown> = {};
let promotedProjectFactHash = "";
let promotedProjectFileHash = "";

try {
  firstLaunch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openVideoView(firstLaunch.client);
  await waitFor(async () => {
    const step = await firstLaunch!.client.evaluate<string | null>(`document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || null`);
    return step === "compare_versions" ? step : undefined;
  }, "packaged App did not project the A/B Review task");
  firstObservation = await firstLaunch.client.evaluate(`(() => {
    const review = document.querySelector('[aria-label="当前视频复核"]');
    const previewSwitch = document.querySelector('[aria-label="${shotId} 版本切换"]');
    const video = document.querySelector(".preview-stage-video");
    const promotion = [...(review?.querySelectorAll("button") || [])].find((item) => item.textContent?.includes("晋级为项目事实"));
    return {
      currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
      currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
      reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
      versionSwitchCount: document.querySelectorAll('[aria-label="${shotId} 版本切换"]').length,
      activeVersion: [...(previewSwitch?.querySelectorAll("button") || [])].find((item) => item.getAttribute("aria-pressed") === "true")?.textContent?.trim(),
      videoSrc: video?.getAttribute("src") || "",
      selectionLabel: [...(review?.querySelectorAll("button") || [])].find((item) => item.textContent?.includes("选择版本"))?.textContent?.trim(),
      requestChangesEnabled: Boolean([...(review?.querySelectorAll("button") || [])].find((item) => item.textContent?.trim() === "需要修改" && !item.disabled)),
      promotionDisabled: Boolean(promotion?.disabled),
      exportButtonCount: [...(review?.querySelectorAll("button") || [])].filter((item) => item.textContent?.includes("导出")).length
    };
  })()`);
  assert(firstObservation.currentTaskCount === 1 && firstObservation.reviewTurnCount === 1, "A/B Review must expose one Agent current task and one focused turn");
  assert(firstObservation.versionSwitchCount === 1 && firstObservation.activeVersion === "B", "newer candidate B must be the default preview");
  assert(firstObservation.requestChangesEnabled === true, "A/B Review must keep needs-change available");
  assert(firstObservation.promotionDisabled === true && firstObservation.exportButtonCount === 0, "D8 must not promote or export");

  await firstLaunch.client.evaluate(`document.querySelector('[aria-label="${shotId} 版本切换"] button:first-child')?.click(); true`);
  const versionAObservation = await waitFor(async () => {
    const state = await firstLaunch!.client.evaluate<{ activeVersion?: string; videoSrc?: string }>(`(() => {
      const previewSwitch = document.querySelector('[aria-label="${shotId} 版本切换"]');
      return {
        activeVersion: [...(previewSwitch?.querySelectorAll("button") || [])].find((item) => item.getAttribute("aria-pressed") === "true")?.textContent?.trim(),
        videoSrc: document.querySelector(".preview-stage-video")?.getAttribute("src") || ""
      };
    })()`);
    return state.activeVersion === "A" ? state : undefined;
  }, "version A did not become the active packaged preview");
  assert(versionAObservation.videoSrc !== firstObservation.videoSrc, "version A and B must resolve to different preview media");

  await firstLaunch.client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label="当前视频复核"] button')].find((item) => item.textContent?.trim() === "查看 B");
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(async () => {
    const active = await firstLaunch!.client.evaluate<string | undefined>(`[...document.querySelectorAll('[aria-label="${shotId} 版本切换"] button')].find((item) => item.getAttribute("aria-pressed") === "true")?.textContent?.trim()`);
    return active === "B" ? active : undefined;
  }, "Agent 查看 B action did not update the packaged preview");
  await firstLaunch.client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label="当前视频复核"] button')].find((item) => item.textContent?.includes("选择版本 B"));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(async () => {
    const visible = await firstLaunch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="版本选择确认"]'))`);
    return visible ? true : undefined;
  }, "candidate selection did not stop at the independent confirmation boundary");
  const firstBoundary = await runtimeBoundary(firstLaunch.client);
  assert(firstBoundary.tokenRequired && !firstBoundary.providerCalled && !firstBoundary.liveSubmitAllowed, "D8 packaged runtime boundary must remain local and non-live");
  await closePackagedApp(firstLaunch);
  firstLaunch = undefined;

  const stagedSelectionLedger = JSON.parse(await readFile(selectionLedgerPath, "utf8"));
  assert(stagedSelectionLedger.selectionConfirmations?.length === 1, "selection staging must persist exactly one confirmation");
  assert(stagedSelectionLedger.selectionConfirmations[0]?.status === "waiting", "staged selection must remain waiting before explicit confirmation");
  assert(stagedSelectionLedger.selectionConfirmations[0]?.winnerVersion === "B", "staged selection must bind candidate B");
  assert(stagedSelectionLedger.selectionReceipts?.length === 0, "selection staging must not write a selection receipt");
  assert(stagedSelectionLedger.promotionConfirmations?.length === 0, "selection staging must not create a promotion confirmation");
  assert(await sha256(projectPath) === baseline.projectHash, "selection staging must not change Project.vibe");

  coldLaunch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openVideoView(coldLaunch.client);
  await waitFor(async () => {
    const step = await coldLaunch!.client.evaluate<string | null>(`document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || null`);
    return step === "confirm_version_selection" ? step : undefined;
  }, "cold start did not restore the exact version-selection confirmation");
  const restoredSelectionObservation = await coldLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    selectionTurnCount: document.querySelectorAll('[aria-label="版本选择确认"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    confirmationId: document.querySelector('[aria-label="版本选择确认"]')?.getAttribute("data-confirmation-id"),
    confirmButtons: [...document.querySelectorAll('[aria-label="版本选择确认"] button')].filter((item) => item.textContent?.includes("确认选择版本 B") && !item.disabled).length,
    promotionButtons: [...document.querySelectorAll('[aria-label="版本选择确认"] button')].filter((item) => item.textContent?.includes("晋级项目事实")).length,
    bodyText: document.querySelector('[aria-label="版本选择确认"]')?.textContent || ""
  }))()`);
  assert(restoredSelectionObservation.currentTaskCount === 1 && restoredSelectionObservation.selectionTurnCount === 1, "cold restore must expose one selection task and one focused confirmation turn");
  assert(restoredSelectionObservation.reviewTurnCount === 0, "the old passive A/B Review card must not compete with selection confirmation");
  assert(restoredSelectionObservation.confirmationId === stagedSelectionLedger.selectionConfirmations[0].confirmationId, "cold restore must retain the exact selection confirmation id");
  assert(restoredSelectionObservation.confirmButtons === 1 && restoredSelectionObservation.promotionButtons === 0, "selection confirmation must expose only the selection mutation");
  assert(String(restoredSelectionObservation.bodyText).includes("不会修改项目事实"), "selection confirmation must show its project-fact boundary");

  await coldLaunch.client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label="版本选择确认"] button')].find((item) => item.textContent?.includes("确认选择版本 B"));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(async () => {
    const visible = await coldLaunch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="项目事实晋级确认"]'))`);
    return visible ? true : undefined;
  }, "selection confirmation did not stop at the independent promotion boundary");
  const stagedPromotionObservation = await coldLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
    selectionTurnCount: document.querySelectorAll('[aria-label="版本选择确认"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    confirmationId: document.querySelector('[aria-label="项目事实晋级确认"]')?.getAttribute("data-confirmation-id"),
    confirmButtons: [...document.querySelectorAll('[aria-label="项目事实晋级确认"] button')].filter((item) => item.textContent?.includes("确认晋级项目事实") && !item.disabled).length,
    exportButtons: [...document.querySelectorAll('[aria-label="项目事实晋级确认"] button')].filter((item) => item.textContent?.includes("导出")).length,
    bodyText: document.querySelector('[aria-label="项目事实晋级确认"]')?.textContent || ""
  }))()`);
  assert(stagedPromotionObservation.currentTaskStep === "confirm_project_fact_promotion", "selection receipt must advance to project-fact promotion, not Delivery");
  assert(stagedPromotionObservation.currentTaskCount === 1 && stagedPromotionObservation.promotionTurnCount === 1, "promotion confirmation must be the only focused Agent task");
  assert(stagedPromotionObservation.selectionTurnCount === 0 && stagedPromotionObservation.reviewTurnCount === 0, "old selection and Review cards must not remain active");
  assert(stagedPromotionObservation.confirmButtons === 1 && stagedPromotionObservation.exportButtons === 0, "promotion confirmation must remain independent from export");
  assert(String(stagedPromotionObservation.bodyText).includes("不会导出"), "promotion confirmation must show its Delivery boundary");
  coldObservation = {
    restoredSelection: restoredSelectionObservation,
    stagedPromotion: stagedPromotionObservation,
  };
  await closePackagedApp(coldLaunch);
  coldLaunch = undefined;

  const selectedLedger = JSON.parse(await readFile(selectionLedgerPath, "utf8"));
  assert(selectedLedger.selectionConfirmations?.length === 1 && selectedLedger.selectionConfirmations[0]?.status === "resolved", "selection confirmation must resolve exactly once");
  assert(selectedLedger.selectionReceipts?.length === 1, "selection confirmation must write exactly one selection receipt");
  assert(selectedLedger.selectionReceipts[0]?.winnerVersion === "B" && selectedLedger.selectionReceipts[0]?.humanReviewed === true, "selection receipt must bind the human-reviewed winner B");
  assert(selectedLedger.selectionReceipts[0]?.promotionAuthorized === false, "selection receipt must not authorize project-fact promotion");
  assert(selectedLedger.promotionConfirmations?.length === 1 && selectedLedger.promotionConfirmations[0]?.status === "waiting", "selection must stage one separate waiting promotion confirmation");
  assert(selectedLedger.promotionConfirmations[0]?.selectionReceiptId === selectedLedger.selectionReceipts[0]?.receiptId, "promotion confirmation must bind the exact selection receipt");
  assert(await sha256(projectPath) === baseline.projectHash, "winner selection must not change Project.vibe");
  assert(await sha256(ledgerPath) === baseline.ledgerHash, "winner selection must not change the generation ledger");

  promotionLaunch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openVideoView(promotionLaunch.client);
  await waitFor(async () => {
    const step = await promotionLaunch!.client.evaluate<string | null>(`document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || null`);
    return step === "confirm_project_fact_promotion" ? step : undefined;
  }, "second cold start did not restore the exact promotion confirmation");
  promotionObservation = await promotionLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
    confirmationId: document.querySelector('[aria-label="项目事实晋级确认"]')?.getAttribute("data-confirmation-id"),
    confirmButtons: [...document.querySelectorAll('[aria-label="项目事实晋级确认"] button')].filter((item) => item.textContent?.includes("确认晋级项目事实") && !item.disabled).length
  }))()`);
  assert(promotionObservation.currentTaskCount === 1 && promotionObservation.promotionTurnCount === 1, "promotion cold restore must keep one current task");
  assert(promotionObservation.confirmationId === selectedLedger.promotionConfirmations[0].confirmationId, "promotion cold restore must retain the exact confirmation id");
  assert(promotionObservation.confirmButtons === 1, "exact promotion confirmation must be actionable once");
  await promotionLaunch.client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label="项目事实晋级确认"] button')].find((item) => item.textContent?.includes("确认晋级项目事实"));
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(async () => {
    const state = await promotionLaunch!.client.evaluate<{ promotionTurnCount: number; currentTaskStep?: string }>(`(() => ({
      promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
      currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || undefined
    }))()`);
    return state.promotionTurnCount === 0 && state.currentTaskStep !== "confirm_project_fact_promotion" ? state : undefined;
  }, "project-fact promotion did not invalidate the old confirmation task");
  const promotionBoundary = await runtimeBoundary(promotionLaunch.client);
  assert(promotionBoundary.tokenRequired && !promotionBoundary.providerCalled && !promotionBoundary.liveSubmitAllowed, "promotion must remain local and non-live");
  await closePackagedApp(promotionLaunch);
  promotionLaunch = undefined;

  const promotedOpen = parseProjectVibeText(await readFile(projectPath, "utf8"));
  assert(promotedOpen.ok && promotedOpen.project, `promoted Project.vibe must parse: ${promotedOpen.errors.join("; ")}`);
  promotedProjectFactHash = hashProjectVibeFacts(promotedOpen.project);
  promotedProjectFileHash = await sha256(projectPath);
  assert(promotedProjectFactHash !== projectFactHash, "explicit promotion must generate a new project fact hash");
  const promotionReceipts = promotedOpen.project.receipts.reviewReceipts.filter((receipt) => receipt.decisionScope === "agent_video_promotion");
  assert(promotionReceipts.length === 1, "promotion must append exactly one Project.vibe promotion receipt");
  const promotionReceipt = promotionReceipts[0]!;
  assert(promotionReceipt.status === "approved" && promotionReceipt.humanReviewed === true && promotionReceipt.promotionAuthorized === true, "promotion receipt must record explicit human authorization");
  assert(promotionReceipt.selectionReceiptId === selectedLedger.selectionReceipts[0].receiptId, "promotion receipt must bind the exact selection receipt");
  assert(promotionReceipt.versionPairId === selectedLedger.selectionReceipts[0].pairId && promotionReceipt.winnerVersion === "B", "promotion receipt must bind the exact pair and winner");
  assert(promotionReceipt.jobId === selectedLedger.selectionReceipts[0].winner.jobId && promotionReceipt.actionId === selectedLedger.selectionReceipts[0].winner.actionId, "promotion receipt must bind the winning job and action");
  assert(promotionReceipt.outputPath === relative(projectRoot, outputB).replace(/\\/g, "/"), "promotion receipt must store a portable project-relative output path");
  assert(promotionReceipt.outputHash === `sha256:${outputHashB}`, "promotion receipt must bind candidate B SHA-256");
  assert(await sha256(ledgerPath) === baseline.ledgerHash, "promotion must preserve the historical generation ledger");
  assert(await sha256(outputA) === baseline.outputHashA && await sha256(outputB) === baseline.outputHashB, "promotion must preserve winner and loser media byte-for-byte");

  promotedColdLaunch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openVideoView(promotedColdLaunch.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  promotedColdObservation = await promotedColdLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    versionSwitchCount: document.querySelectorAll('[aria-label="${shotId} 版本切换"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    selectionTurnCount: document.querySelectorAll('[aria-label="版本选择确认"]').length,
    promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length
  }))()`);
  assert(promotedColdObservation.currentTaskCount === 1, "promoted cold start must still expose one Agent current task");
  assert(promotedColdObservation.currentTaskStep !== "compare_versions" && promotedColdObservation.currentTaskStep !== "confirm_version_selection" && promotedColdObservation.currentTaskStep !== "confirm_project_fact_promotion", "old fact-bound pair and confirmations must stay invalid after promotion");
  assert(promotedColdObservation.versionSwitchCount === 0 && promotedColdObservation.reviewTurnCount === 0, "old A/B Review must not revive after the fact hash changes");
  assert(promotedColdObservation.selectionTurnCount === 0 && promotedColdObservation.promotionTurnCount === 0, "old confirmation cards must not revive after promotion");
  await closePackagedApp(promotedColdLaunch);
  promotedColdLaunch = undefined;

  const corruptProfileRoot = join(root, "corrupt-profile");
  const corruptRuntimeRoot = join(root, "corrupt-runtime");
  const corruptProjectRoot = join(projectsRoot, "p10-d8-corrupt-ledger");
  const corruptBindingPath = join(corruptProfileRoot, "current-project.local.json");
  await Promise.all([
    mkdir(join(corruptProjectRoot, ".vibe-runtime"), { recursive: true }),
    mkdir(join(corruptProjectRoot, "video"), { recursive: true }),
    mkdir(corruptProfileRoot, { recursive: true }),
    mkdir(corruptRuntimeRoot, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(projectPath, join(corruptProjectRoot, "project.vibe")),
    copyFile(outputA, join(corruptProjectRoot, "video", "P10D8S01-version-a.mp4")),
    copyFile(outputB, join(corruptProjectRoot, "video", "P10D8S01-version-b.mp4")),
    writeFile(join(corruptProjectRoot, projectAgentGenerationJobLedgerPath), "{ invalid ledger\n", "utf8"),
    writeFile(corruptBindingPath, `${JSON.stringify({
      projectRoot: corruptProjectRoot,
      projectRootRelativePath: corruptProjectRoot,
      projectVibeRelativePath: "project.vibe",
      projectId,
      displayName: project.manifest.title,
    }, null, 2)}\n`, "utf8"),
  ]);
  corruptLaunch = await launchPackagedApp({
    appPath,
    executablePath,
    profileRoot: corruptProfileRoot,
    projectsRoot,
    runtimeRoot: corruptRuntimeRoot,
    bindingPath: corruptBindingPath,
  });
  await openVideoView(corruptLaunch.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  corruptObservation = await corruptLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    versionSwitchCount: document.querySelectorAll('[aria-label="${shotId} 版本切换"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    bodyText: document.body.innerText.slice(0, 2000)
  }))()`);
  assert(corruptObservation.currentTaskStep !== "compare_versions", "a damaged ledger must fail closed instead of restoring A/B Review");
  assert(corruptObservation.versionSwitchCount === 0, "a damaged ledger must not expose version controls");
  await closePackagedApp(corruptLaunch);
  corruptLaunch = undefined;
} finally {
  if (firstLaunch) await closePackagedApp(firstLaunch);
  if (coldLaunch) await closePackagedApp(coldLaunch);
  if (promotionLaunch) await closePackagedApp(promotionLaunch);
  if (promotedColdLaunch) await closePackagedApp(promotedColdLaunch);
  if (corruptLaunch) await closePackagedApp(corruptLaunch);
}

const finalState = {
  projectHash: await sha256(projectPath),
  ledgerHash: await sha256(ledgerPath),
  outputHashA: await sha256(outputA),
  outputHashB: await sha256(outputB),
  files: await listFiles(projectRoot),
};
assert(finalState.projectHash === promotedProjectFileHash && finalState.projectHash !== baseline.projectHash, "D8 must change Project.vibe exactly once at explicit promotion");
assert(finalState.ledgerHash === baseline.ledgerHash, "D8 must not change either generation candidate");
assert(finalState.outputHashA === baseline.outputHashA && finalState.outputHashB === baseline.outputHashB, "D8 must preserve both media files byte-for-byte");
const finalSelectionLedger = JSON.parse(await readFile(selectionLedgerPath, "utf8"));

const evidence = {
  schemaVersion: "p10_d8_packaged_acceptance/1.0.0",
  status: "pass",
  acceptedAt: new Date().toISOString(),
  fixture: {
    root,
    profileRoot,
    projectsRoot,
    runtimeRoot,
    projectRoot,
    projectId,
    projectFactHash,
    promotedProjectFactHash,
    shotId,
    appPath,
  },
  candidates: ledger.jobs.map((job, index) => ({
    version: index === 0 ? "A" : "B",
    jobId: job.jobId,
    actionId: job.actionId,
    sourceConfirmationId: job.sourceConfirmationId,
    sourceReceiptId: job.reviewResult?.sourceReceiptId,
    outputPath: job.reviewResult?.outputPath,
    outputHash: job.reviewResult?.outputHash,
    status: job.reviewResult?.status,
    executionMode: job.executionMode,
    providerCalled: job.providerCalled,
  })),
  observations: {
    initial: firstObservation,
    selectionAndPromotionColdStart: coldObservation,
    promotion: promotionObservation,
    promotedColdStart: promotedColdObservation,
    corruptedLedger: corruptObservation,
  },
  selection: {
    selectionConfirmationId: finalSelectionLedger.selectionConfirmations?.[0]?.confirmationId,
    selectionReceiptId: finalSelectionLedger.selectionReceipts?.[0]?.receiptId,
    promotionConfirmationId: finalSelectionLedger.promotionConfirmations?.[0]?.confirmationId,
    winnerVersion: finalSelectionLedger.selectionReceipts?.[0]?.winnerVersion,
  },
  invariants: {
    providerCalls: 0,
    projectFactsChangedOnlyAfterPromotion: true,
    generationLedgerChanged: false,
    candidateMediaChanged: false,
    selectionReceiptWritten: true,
    selectionAndPromotionAreIndependent: true,
    promoted: true,
    loserPreserved: true,
    exported: false,
  },
  baseline,
  finalState,
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "pass",
  root,
  evidencePath,
  projectFactHash,
  promotedProjectFactHash,
  outputHashA,
  outputHashB,
}, null, 2));
