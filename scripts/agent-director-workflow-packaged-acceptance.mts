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
import { projectAgentTimelinePath } from "../src/project/projectAgentTimeline.ts";

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
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert(address && typeof address === "object", "could not allocate an acceptance control port");
  await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

type AcceptanceMethod = "evaluate" | "set_bounds" | "capture_page" | "close";

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

  async send(method: AcceptanceMethod, params: Record<string, unknown> = {}): Promise<any> {
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
  if (!await exists(root)) return [];
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

async function hashSnapshot(root: string) {
  return Object.fromEntries(await Promise.all((await listFiles(root)).map(async (path) => [path, await sha256(join(root, path))])));
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

async function openExportView(client: PackagedAcceptanceClient): Promise<void> {
  await waitFor(async () => {
    const found = await client.evaluate<boolean>(`Boolean(document.querySelector('button[aria-label="交付，展示包"]'))`);
    return found ? true : undefined;
  }, "Delivery rail action did not appear");
  await client.evaluate(`(() => {
    const button = document.querySelector('button[aria-label="交付，展示包"]');
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

async function observeTurns(client: PackagedAcceptanceClient): Promise<Record<string, any>> {
  return client.evaluate(`(() => {
    const focused = [
      "当前导演澄清",
      "当前导演提案",
      "当前生成任务确认",
      "当前运行任务",
      "当前视频复核",
      "当前视频修改意图",
      "版本选择确认",
      "项目事实晋级确认"
    ];
    const counts = Object.fromEntries(focused.map((label) => [label, document.querySelectorAll('[aria-label="' + label + '"]').length]));
    return {
      currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || "",
      currentTaskSource: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-source") || "",
      currentTaskLabel: document.querySelector('[aria-label="AI 导演当前任务"] strong')?.textContent?.trim() || "",
      currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
      turnPhase: document.querySelector(".minimal-agent-panel")?.getAttribute("data-director-turn-phase") || "",
      focusedTurnCount: Object.values(counts).reduce((sum, value) => sum + Number(value), 0),
      counts,
      bodyText: document.body.innerText.slice(0, 5000)
    };
  })()`);
}

function assertSingleFocusedTurn(observation: Record<string, any>, expectedLabel: string): void {
  assert(observation.currentTaskCount === 1, `${expectedLabel} must expose exactly one Agent current task`);
  assert(observation.focusedTurnCount === 1, `${expectedLabel} must expose exactly one focused turn`);
  assert(observation.counts?.[expectedLabel] === 1, `${expectedLabel} turn is missing`);
}

async function setTextarea(client: PackagedAcceptanceClient, value: string): Promise<void> {
  const encoded = JSON.stringify(value);
  const accepted = await client.evaluate<string>(`(() => {
    const textarea = document.querySelector('textarea[aria-label="和 AI 导演说"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, ${encoded});
    textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea?.value || "";
  })()`);
  assert(accepted === value, "packaged composer did not accept the exact revision feedback");
}

async function clickButton(client: PackagedAcceptanceClient, containerLabel: string, textIncludes: string): Promise<void> {
  const container = JSON.stringify(containerLabel);
  const copy = JSON.stringify(textIncludes);
  const clicked = await client.evaluate<boolean>(`(() => {
    const root = document.querySelector('[aria-label=' + ${container} + ']');
    const button = [...(root?.querySelectorAll("button") || [])].find((item) => item.textContent?.includes(${copy}) && !item.disabled);
    button?.click();
    return Boolean(button);
  })()`);
  assert(clicked, `could not click ${textIncludes} in ${containerLabel}`);
}

async function capturePage(client: PackagedAcceptanceClient, path: string): Promise<void> {
  const base64 = await client.send("capture_page");
  assert(typeof base64 === "string" && base64.length > 1000, "packaged screenshot is empty");
  await writeFile(path, Buffer.from(base64, "base64"));
}

async function setBounds(client: PackagedAcceptanceClient, width: number, height: number): Promise<void> {
  await client.send("set_bounds", { width, height });
  await waitFor(async () => {
    const size = await client.evaluate<{ width: number; height: number }>(`({ width: window.innerWidth, height: window.innerHeight })`);
    return Math.abs(size.width - width) <= 24 && Math.abs(size.height - height) <= 48 ? size : undefined;
  }, `packaged window did not resize to ${width}x${height}`);
}

async function geometryObservation(client: PackagedAcceptanceClient): Promise<Record<string, any>> {
  return client.evaluate(`(() => {
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const panel = document.querySelector(".minimal-agent-panel");
    const task = document.querySelector('[aria-label="AI 导演当前任务"]');
    const turn = document.querySelector('[aria-label="当前视频复核"]');
    const footer = document.querySelector(".minimal-agent-input-footer");
    const footerCopy = footer?.querySelector(".minimal-agent-footer-copy");
    const footerButtons = [...(footer?.querySelectorAll("button") || [])].filter((item) => {
      const value = item.getBoundingClientRect();
      return value.width > 0 && value.height > 0;
    });
    const assetSummary = document.querySelector(".minimal-agent-asset-inbox-summary");
    const assetSummaryItems = [...(assetSummary?.querySelectorAll(":scope > small") || [])];
    const visibleButtons = [...(turn?.querySelectorAll("button") || [])].filter((item) => {
      const value = item.getBoundingClientRect();
      return value.width > 0 && value.height > 0;
    });
    const panelRect = rect(panel);
    const taskRect = rect(task);
    const turnRect = rect(turn);
    const footerRect = rect(footer);
    const footerCopyRect = rect(footerCopy);
    const overlaps = (left, right) => Boolean(left && right
      && left.left < right.right - 1
      && left.right > right.left + 1
      && left.top < right.bottom - 1
      && left.bottom > right.top + 1);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentScrollWidth: document.documentElement.scrollWidth,
      panel: panelRect,
      task: taskRect,
      turn: turnRect,
      panelInsideViewport: Boolean(panelRect && panelRect.left >= -1 && panelRect.right <= window.innerWidth + 1),
      taskBeforeTurn: Boolean(taskRect && turnRect && taskRect.bottom <= turnRect.top + 1),
      focusedTurnOverflow: turn ? turn.scrollWidth - turn.clientWidth : 0,
      clippedButtons: visibleButtons.filter((item) => item.scrollWidth > item.clientWidth + 2 || item.scrollHeight > item.clientHeight + 2).map((item) => item.textContent?.trim()),
      buttonsOutsideTurn: visibleButtons.filter((item) => {
        const value = item.getBoundingClientRect();
        return !turnRect || value.left < turnRect.left - 1 || value.right > turnRect.right + 1;
      }).map((item) => item.textContent?.trim()),
      footer: footerRect,
      footerInsidePanel: Boolean(panelRect && footerRect
        && footerRect.left >= panelRect.left - 1
        && footerRect.right <= panelRect.right + 1
        && footerRect.top >= panelRect.top - 1
        && footerRect.bottom <= panelRect.bottom + 1),
      footerCopyOverlapsButtons: footerButtons.filter((item) => overlaps(footerCopyRect, rect(item))).map((item) => item.textContent?.trim()),
      assetSummaryOverflow: assetSummary ? assetSummary.scrollWidth - assetSummary.clientWidth : 0,
      assetSummaryItemWidths: assetSummaryItems.map((item) => rect(item)?.width || 0),
      activeElementLabel: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 80) || ""
    };
  })()`);
}

function addInitialReviewCandidate(input: {
  ledger: AgentVideoGenerationJobLedger;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  outputPath: string;
  outputHash: string;
  createdAt: string;
}): AgentVideoGenerationJobLedger {
  const plan = buildAgentVideoPipelinePlan({
    planId: "p10_e_initial_review_plan",
    generatedAt: input.createdAt,
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
    actionId: "p10e_action_a",
    sourceConfirmationId: "p10e_confirmation_a",
    generatedAt: input.createdAt,
    executionMode: "dry_run",
    prompt: "P10-E local deterministic candidate A",
  });
  assert(staged.status === "staged_job" && staged.job, "candidate A did not stage");
  const confirmed = transitionAgentVideoGenerationJob({
    ledger: staged.ledger,
    jobId: staged.job.jobId,
    status: "confirmed",
    generatedAt: new Date(Date.parse(input.createdAt) + 1000).toISOString(),
  });
  assert(confirmed.ok, "candidate A did not confirm");
  const running = transitionAgentVideoGenerationJob({
    ledger: confirmed.ledger,
    jobId: staged.job.jobId,
    status: "running",
    generatedAt: new Date(Date.parse(input.createdAt) + 2000).toISOString(),
    providerCalled: false,
  });
  assert(running.ok, "candidate A did not enter local Running");
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
      sourceReceiptId: "p10e_local_return_receipt_a",
      outputPath: input.outputPath,
      outputHash: `sha256:${input.outputHash}`,
      receivedAt: new Date(Date.parse(input.createdAt) + 3000).toISOString(),
    },
  });
  assert(returned.ok && returned.job?.status === "succeeded", "candidate A did not return as needs_review");
  return returned.ledger;
}

function previewPlanFixture(input: {
  shotId: string;
  mediaPath: string;
  sourceReceiptId: string;
  outputHash: string;
  generatedAt: string;
}) {
  const item = {
    id: `p10e_local_video_${input.shotId.toLowerCase()}`,
    clipId: `p10e_local_video_${input.shotId.toLowerCase()}`,
    order: 1,
    shotId: input.shotId,
    mediaType: "video",
    mediaPath: input.mediaPath,
    sourceReceiptId: input.sourceReceiptId,
    outputHash: input.outputHash,
    outputSha256: input.outputHash,
    durationSeconds: 5,
    status: "returned_with_review_overlay",
    videoStatus: "success",
    reviewRequired: true,
    outputExists: true,
  };
  return {
    schemaVersion: "p10_e_running_review_fixture/1.0.0",
    generatedAt: input.generatedAt,
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
const evidenceRoot = resolve(process.argv[3] || "docs/evidence/p10-e-packaged-director-workflow-20260719");
const evidencePath = join(evidenceRoot, "packaged-observation.json");
const sourceMediaA = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_1_rainy_ticket.mp4");
const sourceMediaB = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_2_follow_blue_light.mp4");
const sourceReference = resolve("showcase-package/promo-page-ai-ladies-op-2026-06-18/hero/hero-poster.png");
assert(await exists(executablePath), `packaged App executable is missing: ${executablePath}`);
assert(await exists(sourceMediaA) && await exists(sourceMediaB) && await exists(sourceReference), "local deterministic fixtures are missing");

await mkdir(evidenceRoot, { recursive: true });
const root = await mkdtemp("/tmp/vibe-director-p10-e-20260719-");
const profileRoot = join(root, "profile");
const projectsRoot = join(root, "projects");
const runtimeRoot = join(root, "runtime");
const projectRoot = join(projectsRoot, "p10-e-packaged-director-workflow");
const projectPath = join(projectRoot, "project.vibe");
const bindingPath = join(profileRoot, "current-project.local.json");
const outputA = join(projectRoot, "video", "P10ES01-version-a.mp4");
const outputB = join(projectRoot, "video", "P10ES01-version-b.mp4");
const referencePath = join(projectRoot, "assets", "reference.png");
const exportRoot = join(projectRoot, "exports", "current-project");
const generationLedgerPath = join(projectRoot, projectAgentGenerationJobLedgerPath);
const selectionLedgerPath = join(projectRoot, projectAgentReviewSelectionLedgerPath);
const previewPlanPath = join(projectRoot, "reports", "preview_plan.json");
await Promise.all([
  mkdir(profileRoot, { recursive: true }),
  mkdir(runtimeRoot, { recursive: true }),
  mkdir(dirname(outputA), { recursive: true }),
  mkdir(dirname(referencePath), { recursive: true }),
  mkdir(dirname(previewPlanPath), { recursive: true }),
]);
await Promise.all([
  copyFile(sourceMediaA, outputA),
  copyFile(sourceMediaB, outputB),
  copyFile(sourceReference, referencePath),
]);

const projectId = "p10_e_packaged_project";
const shotId = "P10ES01";
const createdAt = "2026-07-18T16:00:00.000Z";
const sourceProject = createProjectVibe({
  projectId,
  title: "P10-E Packaged Director Workflow Acceptance",
  version: "1.0.0",
  createdAt,
  updatedAt: createdAt,
  storyFlow: {
    id: "p10_e_story",
    sections: [{ id: "section_1", title: "雨夜递出", summary: "女孩把纸飞机递给机器人保安。", sequenceIndex: 0, shotIds: [shotId] }],
    shotOrder: [shotId],
  },
  visualMemory: {
    id: "p10_e_visual_memory",
    entries: [{
      id: "vm_scene",
      assetId: "scene_store",
      kind: "scene",
      label: "雨夜便利店门口",
      status: "locked",
      textConstraints: ["雨夜", "便利店灯箱"],
      usedByShotIds: [shotId],
      canUseAsFutureReference: true,
      sourceRefs: ["p10-e-local-fixture"],
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
    sourceRefs: ["p10-e-local-fixture:shot"],
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
    sourceRefs: ["p10-e-local-fixture"],
    lockedBy: "user",
  }],
  runs: [],
});
const sourceProjectFactHash = hashProjectVibeFacts(sourceProject);
const outputHashA = await sha256(outputA);
const outputHashB = await sha256(outputB);
assert(outputHashA !== outputHashB, "A/B fixtures must have different SHA-256 values");
let generationLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "p10_e_generation_ledger",
  projectId,
  projectRoot,
  projectFactHash: sourceProjectFactHash,
  createdAt,
});
generationLedger = addInitialReviewCandidate({
  ledger: generationLedger,
  projectId,
  projectRoot,
  projectFactHash: sourceProjectFactHash,
  shotId,
  outputPath: outputA,
  outputHash: outputHashA,
  createdAt: "2026-07-18T16:01:00.000Z",
});
const candidateAJobId = generationLedger.jobs[0]!.jobId;
await mkdir(dirname(generationLedgerPath), { recursive: true });
await Promise.all([
  writeFile(projectPath, serializeProjectVibe(sourceProject), "utf8"),
  writeFile(generationLedgerPath, `${JSON.stringify(generationLedger, null, 2)}\n`, "utf8"),
  writeFile(previewPlanPath, `${JSON.stringify(previewPlanFixture({
    shotId,
    mediaPath: outputA,
    sourceReceiptId: "p10e_local_return_receipt_a",
    outputHash: `sha256:${outputHashA}`,
    generatedAt: "2026-07-18T16:01:03.000Z",
  }), null, 2)}\n`, "utf8"),
  writeFile(bindingPath, `${JSON.stringify({
    projectRoot,
    projectRootRelativePath: projectRoot,
    projectVibeRelativePath: "project.vibe",
    projectId,
    displayName: sourceProject.manifest.title,
  }, null, 2)}\n`, "utf8"),
]);

const baseline = {
  projectFileHash: await sha256(projectPath),
  candidateAHash: outputHashA,
  candidateBHash: outputHashB,
  referenceHash: await sha256(referencePath),
};
const stages: Record<string, unknown> = {};
const runtimeBoundaries: Record<string, unknown> = {};
let launch: RunningPackagedApp | undefined;
let promotedProjectFactHash = "";
let candidateBJobId = "";

try {
  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await setBounds(launch.client, 1440, 900);
  await openVideoView(launch.client);
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频复核"]'))`);
    return visible ? true : undefined;
  }, "initial needs_review result did not enter Review");
  stages.review = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.review as Record<string, any>, "当前视频复核");
  assert((stages.review as any).currentTaskStep === "submit_video", "single returned candidate must remain a submit_video Review task");
  stages.reviewActions = await launch.client.evaluate(`(() => ({
    buttons: [...document.querySelectorAll('[aria-label="当前视频复核"] button')].map((item) => ({
      text: item.textContent?.trim(),
      disabled: item.disabled,
      title: item.getAttribute("title") || ""
    })),
    text: document.querySelector('[aria-label="当前视频复核"]')?.textContent || ""
  }))()`);

  await waitFor(async () => {
    const enabled = await launch!.client.evaluate<boolean>(`[...document.querySelectorAll('[aria-label="当前视频复核"] button')].some((item) => item.textContent?.trim() === "需要修改" && !item.disabled)`);
    return enabled ? true : undefined;
  }, `initial Review never enabled the needs-change action: ${JSON.stringify(stages.reviewActions)}`);
  await clickButton(launch.client, "当前视频复核", "需要修改");
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前视频修改意图"]'))`);
    return visible ? true : undefined;
  }, "needs-change did not enter the structured revision turn");
  stages.revision = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.revision as Record<string, any>, "当前视频修改意图");
  assert(!(stages.revision as any).bodyText.includes("预览已通过"), "needs-change must not approve the returned media");

  const feedback = "纸飞机亮得太早了。让机器人接稳以后再亮，保留女孩递出动作和中远景连续性。";
  await setTextarea(launch.client, feedback);
  await waitFor(async () => {
    const enabled = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('button[aria-label="发送"]:not(:disabled)'))`);
    return enabled ? true : undefined;
  }, "revision feedback did not enable the composer");
  await launch.client.evaluate(`document.querySelector('button[aria-label="发送"]')?.click(); true`);
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前导演澄清"]'))`);
    return visible ? true : undefined;
  }, "revision feedback did not enter Clarify", 40_000);
  stages.clarify = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.clarify as Record<string, any>, "当前导演澄清");
  assert((stages.clarify as any).turnPhase === "clarification", "Clarify must own the Agent turn phase");

  const selectedOption = await launch.client.evaluate<string>(`(() => {
    const button = document.querySelector('[aria-label="导演意图选项"] button');
    const label = button?.querySelector("strong")?.textContent?.trim() || "";
    button?.click();
    return label;
  })()`);
  assert(selectedOption, "Clarify did not expose a deterministic option");
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前导演提案"]'))`);
    return visible ? true : undefined;
  }, "Clarify resolution did not form a Proposal");
  stages.proposal = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.proposal as Record<string, any>, "当前导演提案");
  assert((stages.proposal as any).turnPhase === "proposal", "Proposal must own the Agent turn phase");
  assert((stages.proposal as any).bodyText.includes("确认重新生成提案"), "regeneration Proposal must expose its explicit confirmation copy");

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
  await clickButton(launch.client, "当前导演提案", "确认重新生成提案");
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="当前生成任务确认"]'))`);
    return visible ? true : undefined;
  }, "Proposal confirmation did not create a new independent Confirmation");
  stages.confirmation = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.confirmation as Record<string, any>, "当前生成任务确认");
  assert((stages.confirmation as any).turnPhase === "confirmation", "new local task must stop at Confirmation");
  assert((stages.confirmation as any).bodyText.includes("本地验证 · 不计费"), "new Confirmation must remain visibly local and free");
  assert((stages.confirmation as any).bodyText.includes("确认并提交 1 次"), "new Confirmation must expose exactly one submit action");
  runtimeBoundaries.beforeRunning = await runtimeBoundary(launch.client);
  assert((runtimeBoundaries.beforeRunning as any).tokenRequired && !(runtimeBoundaries.beforeRunning as any).providerCalled && !(runtimeBoundaries.beforeRunning as any).liveSubmitAllowed, "Confirmation must keep Provider closed");
  await closePackagedApp(launch);
  launch = undefined;

  const stagedLedger = JSON.parse(await readFile(generationLedgerPath, "utf8")) as AgentVideoGenerationJobLedger;
  const candidateB = stagedLedger.jobs.find((job) => job.jobId !== candidateAJobId && job.status === "staged");
  assert(candidateB, "Proposal confirmation did not persist one fresh staged candidate job");
  candidateBJobId = candidateB.jobId;
  assert(candidateB.actionId !== generationLedger.jobs[0]!.actionId, "regeneration must use a fresh action id");
  assert(candidateB.sourceConfirmationId !== generationLedger.jobs[0]!.sourceConfirmationId, "regeneration must use a fresh confirmation id");
  const confirmedB = transitionAgentVideoGenerationJob({
    ledger: stagedLedger,
    jobId: candidateB.jobId,
    status: "confirmed",
    generatedAt: new Date().toISOString(),
  });
  assert(confirmedB.ok, "local candidate B did not enter confirmed state");
  const runningB = transitionAgentVideoGenerationJob({
    ledger: confirmedB.ledger,
    jobId: candidateB.jobId,
    status: "running",
    generatedAt: new Date(Date.now() + 1000).toISOString(),
    providerCalled: false,
  });
  assert(runningB.ok && runningB.job?.providerCalled === false, "local candidate B did not enter dry-run Running");
  await writeFile(generationLedgerPath, `${JSON.stringify(runningB.ledger, null, 2)}\n`, "utf8");

  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await setBounds(launch.client, 1440, 900);
  await openVideoView(launch.client);
  await waitFor(async () => {
    const jobId = await launch!.client.evaluate<string>(`document.querySelector('[aria-label="当前运行任务"]')?.getAttribute("data-job-id") || ""`);
    return jobId === candidateBJobId ? jobId : undefined;
  }, "cold restore did not project the exact local Running job");
  stages.running = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.running as Record<string, any>, "当前运行任务");
  assert((stages.running as any).turnPhase === "running", "Running must own the Agent turn phase");
  assert((stages.running as any).bodyText.includes("不会自动重试、批准、晋级或导出"), "Running must retain its non-escalation boundary");
  await capturePage(launch.client, join(evidenceRoot, "01-running-desktop.png"));
  runtimeBoundaries.running = await runtimeBoundary(launch.client);
  assert(!(runtimeBoundaries.running as any).providerCalled, "local Running must not call Provider");
  await closePackagedApp(launch);
  launch = undefined;

  const runningLedger = JSON.parse(await readFile(generationLedgerPath, "utf8")) as AgentVideoGenerationJobLedger;
  const returnedB = recordAgentVideoGenerationJobReviewResult({
    ledger: runningLedger,
    jobId: candidateBJobId,
    result: {
      status: "needs_review",
      projectId: candidateB.projectId,
      projectRoot: candidateB.projectRoot,
      projectFactHash: candidateB.projectFactHash,
      jobId: candidateB.jobId,
      actionId: candidateB.actionId,
      shotId,
      sourceReceiptId: "p10e_local_return_receipt_b",
      outputPath: outputB,
      outputHash: `sha256:${outputHashB}`,
      receivedAt: new Date(Date.now() + 2000).toISOString(),
    },
  });
  assert(returnedB.ok && returnedB.job?.status === "succeeded" && returnedB.job.reviewResult?.status === "needs_review", "local candidate B did not return to needs_review");
  await Promise.all([
    writeFile(generationLedgerPath, `${JSON.stringify(returnedB.ledger, null, 2)}\n`, "utf8"),
    writeFile(previewPlanPath, `${JSON.stringify(previewPlanFixture({
      shotId,
      mediaPath: outputB,
      sourceReceiptId: "p10e_local_return_receipt_b",
      outputHash: `sha256:${outputHashB}`,
      generatedAt: new Date(Date.now() + 2000).toISOString(),
    }), null, 2)}\n`, "utf8"),
  ]);

  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await setBounds(launch.client, 1440, 900);
  await openVideoView(launch.client);
  await waitFor(async () => {
    const step = await launch!.client.evaluate<string>(`document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || ""`);
    return step === "compare_versions" ? step : undefined;
  }, "two returned candidates did not form A/B Review");
  stages.versionReviewDesktop = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.versionReviewDesktop as Record<string, any>, "当前视频复核");
  assert((stages.versionReviewDesktop as any).counts["当前生成任务确认"] === 0, "old generation Confirmation must not preempt A/B Review");
  assert((stages.versionReviewDesktop as any).counts["当前视频修改意图"] === 0, "old revision turn must not preempt A/B Review");
  const activeVersion = await launch.client.evaluate<string>(`[...document.querySelectorAll('[aria-label="${shotId} 版本切换"] button')].find((item) => item.getAttribute("aria-pressed") === "true")?.textContent?.trim() || ""`);
  assert(activeVersion === "B", "newer returned candidate B must be the active A/B preview");
  stages.desktopGeometry = await geometryObservation(launch.client);
  assert((stages.desktopGeometry as any).panelInsideViewport && (stages.desktopGeometry as any).taskBeforeTurn, "desktop Agent task and Review turn must remain ordered inside the viewport");
  await capturePage(launch.client, join(evidenceRoot, "02-version-review-desktop.png"));

  await setBounds(launch.client, 900, 760);
  stages.constrainedGeometry = await geometryObservation(launch.client);
  assert((stages.constrainedGeometry as any).documentScrollWidth <= (stages.constrainedGeometry as any).viewport.width + 1, "constrained packaged view has horizontal page overflow");
  assert((stages.constrainedGeometry as any).panelInsideViewport, "constrained Agent panel escapes the viewport");
  assert((stages.constrainedGeometry as any).taskBeforeTurn, "constrained current task overlaps the Review turn");
  assert((stages.constrainedGeometry as any).focusedTurnOverflow <= 1, "constrained A/B Review content overflows its turn");
  assert((stages.constrainedGeometry as any).clippedButtons.length === 0, "constrained A/B Review clips button copy");
  assert((stages.constrainedGeometry as any).buttonsOutsideTurn.length === 0, "constrained A/B Review buttons escape their parent");
  assert((stages.constrainedGeometry as any).footerInsidePanel, "constrained composer footer escapes the Agent panel");
  assert((stages.constrainedGeometry as any).footerCopyOverlapsButtons.length === 0, "constrained composer copy overlaps its buttons");
  await capturePage(launch.client, join(evidenceRoot, "03-version-review-constrained.png"));
  await setBounds(launch.client, 1440, 900);

  await clickButton(launch.client, "当前视频复核", "选择版本 B");
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="版本选择确认"]'))`);
    return visible ? true : undefined;
  }, "winner selection did not stop at its independent confirmation");
  stages.selectionConfirmation = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.selectionConfirmation as Record<string, any>, "版本选择确认");
  assert(await sha256(projectPath) === baseline.projectFileHash, "staging winner selection must not change Project.vibe");

  await clickButton(launch.client, "版本选择确认", "确认选择版本 B");
  await waitFor(async () => {
    const visible = await launch!.client.evaluate<boolean>(`Boolean(document.querySelector('[aria-label="项目事实晋级确认"]'))`);
    return visible ? true : undefined;
  }, "winner selection did not stop at the separate promotion confirmation");
  stages.promotionConfirmation = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.promotionConfirmation as Record<string, any>, "项目事实晋级确认");
  assert(await sha256(projectPath) === baseline.projectFileHash, "winner selection receipt must not change Project.vibe");
  const selectedLedger = JSON.parse(await readFile(selectionLedgerPath, "utf8"));
  assert(selectedLedger.selectionReceipts?.length === 1 && selectedLedger.selectionReceipts[0]?.winnerVersion === "B", "selection must persist one exact winner-B receipt");
  assert(selectedLedger.selectionReceipts[0]?.promotionAuthorized === false, "selection receipt must not authorize promotion");

  await closePackagedApp(launch);
  launch = undefined;
  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await setBounds(launch.client, 1440, 900);
  await openVideoView(launch.client);
  await waitFor(async () => {
    const state = await launch!.client.evaluate<{ step: string; turnCount: number }>(`({
      step: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || "",
      turnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length
    })`);
    return state.step === "confirm_project_fact_promotion" && state.turnCount === 1 ? state : undefined;
  }, "cold restore did not recover the exact promotion confirmation");
  stages.promotionColdRestore = await observeTurns(launch.client);
  assertSingleFocusedTurn(stages.promotionColdRestore as Record<string, any>, "项目事实晋级确认");
  await clickButton(launch.client, "项目事实晋级确认", "确认晋级项目事实");
  await waitFor(async () => {
    const state = await launch!.client.evaluate<{ promotion: number; step: string }>(`({
      promotion: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
      step: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || ""
    })`);
    return state.promotion === 0 && state.step !== "confirm_project_fact_promotion" ? state : undefined;
  }, "explicit promotion did not invalidate the old Review state");
  const promotedOpen = parseProjectVibeText(await readFile(projectPath, "utf8"));
  assert(promotedOpen.ok && promotedOpen.project, `promoted Project.vibe must parse: ${promotedOpen.errors.join("; ")}`);
  promotedProjectFactHash = hashProjectVibeFacts(promotedOpen.project);
  assert(promotedProjectFactHash !== sourceProjectFactHash, "explicit promotion must generate a new fact hash");
  const promotionReceipts = promotedOpen.project.receipts.reviewReceipts.filter((receipt) => receipt.decisionScope === "agent_video_promotion");
  assert(promotionReceipts.length === 1 && promotionReceipts[0]?.outputHash === `sha256:${outputHashB}`, "promotion must bind exact winner B and its SHA-256");
  stages.promoted = await observeTurns(launch.client);
  assert((stages.promoted as any).counts["当前视频复核"] === 0, "old A/B Review must disappear after fact promotion");

  await closePackagedApp(launch);
  launch = undefined;
  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await setBounds(launch.client, 1440, 900);
  await openExportView(launch.client);
  await waitFor(async () => {
    const state = await launch!.client.evaluate<{ step: string; buttons: number }>(`({
      step: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || "",
      buttons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length
    })`);
    return state.step === "export" && state.buttons === 1 ? state : undefined;
  }, "promoted winner did not reach the independent Delivery confirmation");
  stages.deliveryConfirmation = await observeTurns(launch.client);
  assert((stages.deliveryConfirmation as any).currentTaskCount === 1, "Delivery must remain the only current task");
  assert((stages.deliveryConfirmation as any).focusedTurnCount === 0, "old Review turns must not compete with Delivery");
  assert(!await exists(exportRoot), "Delivery must not publish before explicit confirmation");
  await capturePage(launch.client, join(evidenceRoot, "04-delivery-confirmation-desktop.png"));

  const exportClicked = await launch.client.evaluate<boolean>(`(() => {
    const buttons = [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled);
    if (buttons.length !== 1) return false;
    buttons[0].click();
    return true;
  })()`);
  assert(exportClicked, "exact Delivery confirmation could not be clicked");
  await waitFor(async () => {
    const status = await launch!.client.evaluate<string>(`document.querySelector(".export-action-status.ready")?.textContent || ""`);
    return status.includes("导出包已生成") ? status : undefined;
  }, "packaged local export did not finish", 60_000);
  await waitFor(async () => await exists(join(exportRoot, "export_manifest.json")) ? true : undefined, "atomic export package did not publish", 30_000);
  stages.delivered = await observeTurns(launch.client);
  assert((stages.delivered as any).currentTaskCount === 1, "completed Delivery must retain one terminal current task");
  runtimeBoundaries.delivery = await runtimeBoundary(launch.client);
  assert((runtimeBoundaries.delivery as any).tokenRequired && !(runtimeBoundaries.delivery as any).providerCalled && !(runtimeBoundaries.delivery as any).liveSubmitAllowed, "Delivery must not open Provider execution");
  await closePackagedApp(launch);
  launch = undefined;

  const packageSnapshotBeforeCold = await hashSnapshot(exportRoot);
  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await setBounds(launch.client, 1440, 900);
  await openExportView(launch.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
  stages.coldRestore = await observeTurns(launch.client);
  assert((stages.coldRestore as any).currentTaskCount === 1 && (stages.coldRestore as any).currentTaskStep === "idle", "cold restore must project one terminal idle task");
  assert((stages.coldRestore as any).focusedTurnCount === 0, "cold restore must not revive old Review or confirmation turns");
  const staleConfirmations = await launch.client.evaluate<number>(`[...document.querySelectorAll("button")].filter((item) => (
    item.textContent?.includes("确认重新生成提案")
    || item.textContent?.includes("确认并提交 1 次")
    || item.textContent?.includes("确认选择版本")
    || item.textContent?.includes("确认晋级项目事实")
    || item.textContent?.trim() === "确认导出"
  ) && !item.disabled).length`);
  assert(staleConfirmations === 0, "cold restore must not revive any old actionable confirmation");
  runtimeBoundaries.coldRestore = await runtimeBoundary(launch.client);
  assert(!(runtimeBoundaries.coldRestore as any).providerCalled, "cold restore must not call Provider");
  stages.coldRestoreGeometry = await geometryObservation(launch.client);
  assert((stages.coldRestoreGeometry as any).footerInsidePanel, "cold-restore composer footer escapes the Agent panel");
  assert((stages.coldRestoreGeometry as any).footerCopyOverlapsButtons.length === 0, "cold-restore composer copy overlaps its buttons");
  assert((stages.coldRestoreGeometry as any).assetSummaryOverflow <= 1, "cold-restore material summary overflows its history card");
  assert(
    (stages.coldRestoreGeometry as any).assetSummaryItemWidths.length === 0
      || (stages.coldRestoreGeometry as any).assetSummaryItemWidths.every((width: number) => width >= 110),
    "cold-restore material summary collapses below a readable width",
  );
  await capturePage(launch.client, join(evidenceRoot, "05-delivered-cold-restore.png"));
  await closePackagedApp(launch);
  launch = undefined;
  assert(JSON.stringify(await hashSnapshot(exportRoot)) === JSON.stringify(packageSnapshotBeforeCold), "cold restore must not rewrite the completed package");
} finally {
  if (launch) await closePackagedApp(launch);
}

const finalProject = parseProjectVibeText(await readFile(projectPath, "utf8"));
assert(finalProject.ok && finalProject.project, `final Project.vibe must parse: ${finalProject.errors.join("; ")}`);
assert(hashProjectVibeFacts(finalProject.project) === promotedProjectFactHash, "Delivery must not mutate promoted project facts");
const finalSelectionLedger = JSON.parse(await readFile(selectionLedgerPath, "utf8"));
assert(finalSelectionLedger.selectionReceipts?.length === 1, "exactly one winner selection receipt must persist");
assert(finalSelectionLedger.promotionConfirmations?.length === 1 && finalSelectionLedger.promotionConfirmations[0]?.status === "waiting", "the old-fact promotion confirmation must remain immutable historical evidence");
assert(finalSelectionLedger.promotionConfirmations[0]?.projectFactHash === sourceProjectFactHash, "the historical promotion confirmation must stay bound to the superseded fact");
const finalGenerationLedger = JSON.parse(await readFile(generationLedgerPath, "utf8")) as AgentVideoGenerationJobLedger;
assert(finalGenerationLedger.projectFactHash === promotedProjectFactHash, "the current generation ledger must rotate to the promoted fact");
assert(finalGenerationLedger.jobs.every((job) => job.projectFactHash === promotedProjectFactHash), "old-fact A/B jobs must not revive in the current ledger");
assert(!finalGenerationLedger.jobs.some((job) => job.jobId === candidateAJobId || job.jobId === candidateBJobId), "superseded A/B jobs must remain historical instead of current");
assert(finalGenerationLedger.jobs.filter((job) => job.kind === "export" && job.status === "succeeded").length === 1, "the promoted fact must retain exactly one succeeded local export job");
const historicalSelection = finalSelectionLedger.selectionReceipts[0];
assert(historicalSelection.winner.outputHash === `sha256:${outputHashB}`, "historical selection must preserve winner B SHA-256");
assert(historicalSelection.loser.outputHash === `sha256:${outputHashA}`, "historical selection must preserve loser A SHA-256");

const exportFiles = await listFiles(exportRoot);
const exportManifest = JSON.parse(await readFile(join(exportRoot, "export_manifest.json"), "utf8"));
assert(exportManifest.readiness === "ready" && exportManifest.mediaFiles?.length === 1, "Delivery package must contain exactly one ready promoted media file");
assert(exportManifest.mediaFiles[0]?.sourcePath === "video/P10ES01-version-b.mp4", "Delivery must package only winner B");
assert(exportManifest.mediaFiles[0]?.sourceHash === `sha256:${outputHashB}`, "Delivery manifest must bind winner B SHA-256");
assert(await sha256(join(projectRoot, exportManifest.mediaFiles[0].path)) === outputHashB, "delivered winner media SHA-256 changed");
assert(!exportFiles.some((path) => path.includes("version-a") || path.includes(".vibe-staging")), "Delivery must exclude loser A and staged files");
const portableText = (await Promise.all(exportFiles.filter((path) => /\.(?:json|md|tsv)$/i.test(path)).map((path) => readFile(join(exportRoot, path), "utf8")))).join("\n");
assert(!portableText.includes(projectRoot), "portable Delivery package must not leak its absolute project root");
assert(await sha256(outputA) === baseline.candidateAHash && await sha256(outputB) === baseline.candidateBHash, "acceptance must preserve both local fixture media files");
assert(await sha256(referencePath) === baseline.referenceHash, "acceptance must preserve the locked local reference");

const timeline = JSON.parse(await readFile(join(projectRoot, projectAgentTimelinePath), "utf8"));
const exportReceipts = timeline.entries.filter((entry: any) => entry.details?.executionReceipt?.action === "export" && entry.details?.executionReceipt?.status === "succeeded");
assert(exportReceipts.length === 1, "exactly one succeeded Delivery receipt must persist");
const deliveryReceipt = exportReceipts[0].details.executionReceipt;
assert(deliveryReceipt.providerCalled === false && deliveryReceipt.projectFactHash === promotedProjectFactHash, "Delivery receipt must bind the promoted fact with Provider disabled");
assert(deliveryReceipt.deliveryReceipt?.reviewBindings?.length === 1, "Delivery receipt must bind exactly one promoted winner");

const evidence = {
  schemaVersion: "p10_e_packaged_director_workflow/1.0.0",
  status: "pass",
  acceptedAt: new Date().toISOString(),
  fixture: {
    root,
    profileRoot,
    projectsRoot,
    runtimeRoot,
    projectRoot,
    projectId,
    sourceProjectFactHash,
    promotedProjectFactHash,
    shotId,
    appPath,
  },
  chain: [
    "review",
    "revision",
    "clarify",
    "proposal",
    "confirmation",
    "running",
    "needs_review_pair",
    "selected",
    "promoted",
    "delivery_confirmation",
    "delivered",
    "cold_restore",
  ],
  identities: {
    candidateAJobId,
    candidateBJobId,
    selectionReceiptId: finalSelectionLedger.selectionReceipts[0].receiptId,
    promotionConfirmationId: finalSelectionLedger.promotionConfirmations[0].confirmationId,
    promotionReceiptId: finalProject.project.receipts.reviewReceipts.find((receipt) => receipt.decisionScope === "agent_video_promotion")?.id,
    deliveryActionId: deliveryReceipt.actionId,
    deliveryConfirmationId: deliveryReceipt.confirmationReceiptId,
    deliveryReceiptId: deliveryReceipt.receiptId,
  },
  stages,
  runtimeBoundaries,
  screenshots: [
    "01-running-desktop.png",
    "02-version-review-desktop.png",
    "03-version-review-constrained.png",
    "04-delivery-confirmation-desktop.png",
    "05-delivered-cold-restore.png",
  ],
  delivery: {
    exportRoot: "exports/current-project",
    files: exportFiles,
    mediaFiles: exportManifest.mediaFiles,
    receipt: deliveryReceipt.deliveryReceipt,
  },
  hashes: {
    candidateA: outputHashA,
    candidateB: outputHashB,
    delivered: await sha256(join(projectRoot, exportManifest.mediaFiles[0].path)),
  },
  stateMatrix: {
    candidateA: "needs_review_historical",
    candidateB: "needs_review_historical",
    winnerSelection: "selected",
    projectFact: "promoted",
    delivery: "delivered",
    dryRunGeneration: true,
    providerExecution: "not_verified",
  },
  invariants: {
    providerCalls: 0,
    oneCurrentTaskAtEveryObservedStage: true,
    independentConfirmations: true,
    identitiesBoundEndToEnd: true,
    candidatesPreserved: true,
    onlyWinnerDelivered: true,
    portablePaths: true,
    atomicPublish: true,
    coldRestoreStable: true,
    originalUserProjectsTouched: false,
  },
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "pass",
  root,
  evidencePath,
  sourceProjectFactHash,
  promotedProjectFactHash,
  outputHashA,
  outputHashB,
  providerCalls: 0,
}, null, 2));
