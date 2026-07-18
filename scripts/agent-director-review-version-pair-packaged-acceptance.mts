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
  const actionId = `p10d7_action_${input.version}`;
  const confirmationId = `p10d7_confirmation_${input.version}`;
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
      sourceReceiptId: `p10d7_local_receipt_${input.version}`,
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
const evidencePath = resolve(process.argv[3] || "docs/evidence/p10-d-version-pair-20260719/packaged-observation.json");
const sourceMediaA = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_1_rainy_ticket.mp4");
const sourceMediaB = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_2_follow_blue_light.mp4");
assert(await exists(executablePath), `packaged App executable is missing: ${executablePath}`);
assert(await exists(sourceMediaA) && await exists(sourceMediaB), "local deterministic media fixtures are missing");

const root = await mkdtemp("/tmp/vibe-director-p10-d7-20260719-");
const profileRoot = join(root, "profile");
const projectsRoot = join(root, "projects");
const runtimeRoot = join(root, "runtime");
const projectRoot = join(projectsRoot, "p10-d7-version-pair");
const projectPath = join(projectRoot, "project.vibe");
const bindingPath = join(profileRoot, "current-project.local.json");
const videoRoot = join(projectRoot, "video");
const outputA = join(videoRoot, "P10D7S01-version-a.mp4");
const outputB = join(videoRoot, "P10D7S01-version-b.mp4");
await mkdir(videoRoot, { recursive: true });
await Promise.all([
  mkdir(profileRoot, { recursive: true }),
  mkdir(runtimeRoot, { recursive: true }),
  copyFile(sourceMediaA, outputA),
  copyFile(sourceMediaB, outputB),
]);

const projectId = "p10_d7_packaged_project";
const shotId = "P10D7S01";
const createdAt = "2026-07-19T01:00:00.000Z";
const project = createProjectVibe({
  projectId,
  title: "P10-D7 Version Pair Acceptance",
  version: "1.0.0",
  createdAt,
  updatedAt: createdAt,
  storyFlow: {
    id: "p10_d7_story",
    sections: [{ id: "section_1", title: "雨夜递出", summary: "女孩把纸飞机递给机器人保安。", sequenceIndex: 0, shotIds: [shotId] }],
    shotOrder: [shotId],
  },
  visualMemory: {
    id: "p10_d7_visual_memory",
    entries: [{
      id: "vm_scene",
      assetId: "scene_store",
      kind: "scene",
      label: "雨夜便利店门口",
      status: "candidate",
      textConstraints: ["雨夜", "便利店灯箱"],
      usedByShotIds: [shotId],
      canUseAsFutureReference: false,
      sourceRefs: ["p10-d7-fixture"],
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
    sourceRefs: ["p10-d7-fixture:shot"],
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
    sourceRefs: ["p10-d7-fixture"],
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
  planId: "p10_d7_pair_plan",
  generatedAt: createdAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
let ledger = createAgentVideoGenerationJobLedger({
  ledgerId: "p10_d7_pair_ledger",
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
let corruptLaunch: RunningPackagedApp | undefined;
let firstObservation: Record<string, unknown> = {};
let coldObservation: Record<string, unknown> = {};
let revisionObservation: Record<string, unknown> = {};
let corruptObservation: Record<string, unknown> = {};

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
  assert(firstObservation.promotionDisabled === true && firstObservation.exportButtonCount === 0, "D7 must not promote or export");

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
  assert(firstBoundary.tokenRequired && !firstBoundary.providerCalled && !firstBoundary.liveSubmitAllowed, "D7 packaged runtime boundary must remain local and non-live");
  await closePackagedApp(firstLaunch);
  firstLaunch = undefined;

  coldLaunch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openVideoView(coldLaunch.client);
  await waitFor(async () => {
    const step = await coldLaunch!.client.evaluate<string | null>(`document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || null`);
    return step === "compare_versions" ? step : undefined;
  }, "cold start did not restore the A/B Review task");
  coldObservation = await coldLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    versionSwitchCount: document.querySelectorAll('[aria-label="${shotId} 版本切换"]').length,
    activeVersion: [...document.querySelectorAll('[aria-label="${shotId} 版本切换"] button')].find((item) => item.getAttribute("aria-pressed") === "true")?.textContent?.trim(),
    activeSelectionConfirmations: [...document.querySelectorAll("button")].filter((item) => item.textContent?.includes("确认选择") && !item.disabled).length,
    activePromotions: [...document.querySelectorAll("button")].filter((item) => item.textContent?.includes("晋级为项目事实") && !item.disabled).length
  }))()`);
  assert(coldObservation.currentTaskCount === 1 && coldObservation.reviewTurnCount === 1, "cold restore must not duplicate the A/B task or Review turn");
  assert(coldObservation.versionSwitchCount === 1 && coldObservation.activeVersion === "B", "cold restore must deterministically return to version B");
  assert(coldObservation.activeSelectionConfirmations === 0 && coldObservation.activePromotions === 0, "D7 cold restore must not invent selection or promotion state");

  await coldLaunch.client.evaluate(`(() => {
    const button = [...document.querySelectorAll('[aria-label="当前视频复核"] button')].find((item) => item.textContent?.trim() === "需要修改");
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(async () => {
    const visible = await coldLaunch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频修改意图"]'))`);
    return visible ? true : undefined;
  }, "needs-change did not enter the structured revision turn");
  revisionObservation = await coldLaunch.client.evaluate(`(() => ({
    revisionTurnCount: document.querySelectorAll('[aria-label="当前视频修改意图"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    currentTaskLabel: document.querySelector('[aria-label="AI 导演当前任务"] strong')?.textContent?.trim(),
    boundaryText: document.querySelector('[aria-label="修改意图边界"]')?.textContent || "",
    composerValue: document.querySelector('textarea[aria-label="和 AI 导演说"]')?.value || ""
  }))()`);
  assert(revisionObservation.revisionTurnCount === 1 && revisionObservation.reviewTurnCount === 0, "needs-change must replace passive Review with one focused revision turn");
  assert(revisionObservation.currentTaskLabel === "说明修改方向", "revision turn must own the Agent current-task label");
  assert(String(revisionObservation.boundaryText).includes("保持不变") && String(revisionObservation.boundaryText).includes("尚未创建"), "revision turn must preserve both original candidates and avoid a new task");
  await closePackagedApp(coldLaunch);
  coldLaunch = undefined;

  const corruptProfileRoot = join(root, "corrupt-profile");
  const corruptRuntimeRoot = join(root, "corrupt-runtime");
  const corruptProjectRoot = join(projectsRoot, "p10-d7-corrupt-ledger");
  const corruptBindingPath = join(corruptProfileRoot, "current-project.local.json");
  await Promise.all([
    mkdir(join(corruptProjectRoot, ".vibe-runtime"), { recursive: true }),
    mkdir(join(corruptProjectRoot, "video"), { recursive: true }),
    mkdir(corruptProfileRoot, { recursive: true }),
    mkdir(corruptRuntimeRoot, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(projectPath, join(corruptProjectRoot, "project.vibe")),
    copyFile(outputA, join(corruptProjectRoot, "video", "P10D7S01-version-a.mp4")),
    copyFile(outputB, join(corruptProjectRoot, "video", "P10D7S01-version-b.mp4")),
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
  if (corruptLaunch) await closePackagedApp(corruptLaunch);
}

const finalState = {
  projectHash: await sha256(projectPath),
  ledgerHash: await sha256(ledgerPath),
  outputHashA: await sha256(outputA),
  outputHashB: await sha256(outputB),
  files: await listFiles(projectRoot),
};
assert(finalState.projectHash === baseline.projectHash, "D7 packaged Review must not change project facts");
assert(finalState.ledgerHash === baseline.ledgerHash, "D7 packaged Review must not change either generation candidate");
assert(finalState.outputHashA === baseline.outputHashA && finalState.outputHashB === baseline.outputHashB, "D7 packaged Review must preserve both media files byte-for-byte");

const evidence = {
  schemaVersion: "p10_d7_packaged_acceptance/1.0.0",
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
    coldStart: coldObservation,
    needsChange: revisionObservation,
    corruptedLedger: corruptObservation,
  },
  invariants: {
    providerCalls: 0,
    projectFactsChanged: false,
    generationLedgerChanged: false,
    candidateMediaChanged: false,
    selectionReceiptWritten: false,
    promoted: false,
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
  outputHashA,
  outputHashB,
}, null, 2));
