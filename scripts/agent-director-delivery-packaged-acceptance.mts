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
  buildAgentDirectorReviewPromotionTransaction,
  confirmAgentDirectorReviewSelection,
  createAgentDirectorReviewSelectionLedger,
  stageAgentDirectorReviewPromotion,
  stageAgentDirectorReviewSelection,
} from "../src/core/agentDirectorReviewSelection.ts";
import { buildAgentDirectorReviewVersionPair } from "../src/core/agentDirectorReviewVersionPair.ts";
import type {
  AgentVideoGenerationJob,
  AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import {
  applyProjectVibeTransaction,
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

function localCandidateJob(input: {
  version: "a" | "b";
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  outputPath: string;
  outputHash: string;
  receivedAt: string;
}): AgentVideoGenerationJob {
  const jobId = `p10d9_job_${input.version}`;
  const actionId = `p10d9_action_${input.version}`;
  return {
    jobId,
    projectId: input.projectId,
    projectRoot: input.projectRoot,
    projectFactHash: input.projectFactHash,
    actionId,
    operation: "execute",
    executionMode: "dry_run",
    providerCalled: false,
    kind: "video_submit",
    providerId: "local-fixture",
    modelId: "local-fixture",
    capability: "image-to-video",
    pipelineStep: "submit_video",
    status: "succeeded",
    sourceConfirmationId: `p10d9_confirmation_${input.version}`,
    prompt: `P10-D9 local deterministic candidate ${input.version}`,
    inputAssets: [],
    outputAssets: [input.outputPath],
    reviewResult: {
      status: "needs_review",
      projectId: input.projectId,
      projectRoot: input.projectRoot,
      projectFactHash: input.projectFactHash,
      jobId,
      actionId,
      shotId: input.shotId,
      sourceReceiptId: `p10d9_generation_receipt_${input.version}`,
      outputPath: input.outputPath,
      outputHash: `sha256:${input.outputHash}`,
      receivedAt: input.receivedAt,
    },
    blockers: [],
    statusHistory: [
      { status: "staged", at: input.receivedAt },
      { status: "confirmed", at: input.receivedAt },
      { status: "running", at: input.receivedAt },
      { status: "succeeded", at: input.receivedAt },
    ],
    createdAt: input.receivedAt,
    updatedAt: input.receivedAt,
  };
}

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const evidencePath = resolve(process.argv[3] || "docs/evidence/p10-d-delivery-handoff-20260719/packaged-observation.json");
const sourceMediaA = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_1_rainy_ticket.mp4");
const sourceMediaB = resolve("showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00/04-generated-videos/shot_2_follow_blue_light.mp4");
const sourceReference = resolve("showcase-package/promo-page-ai-ladies-op-2026-06-18/hero/hero-poster.png");
assert(await exists(executablePath), `packaged App executable is missing: ${executablePath}`);
assert(await exists(sourceMediaA) && await exists(sourceMediaB) && await exists(sourceReference), "local deterministic fixtures are missing");

const root = await mkdtemp("/tmp/vibe-director-p10-d9-20260719-");
const profileRoot = join(root, "profile");
const projectsRoot = join(root, "projects");
const runtimeRoot = join(root, "runtime");
const projectRoot = join(projectsRoot, "p10-d9-delivery-handoff");
const projectPath = join(projectRoot, "project.vibe");
const bindingPath = join(profileRoot, "current-project.local.json");
const outputA = join(projectRoot, "video", "P10D9S01-version-a.mp4");
const outputB = join(projectRoot, "video", "P10D9S01-version-b.mp4");
const referencePath = join(projectRoot, "assets", "reference.png");
const exportRoot = join(projectRoot, "exports", "current-project");
await Promise.all([
  mkdir(profileRoot, { recursive: true }),
  mkdir(runtimeRoot, { recursive: true }),
  mkdir(dirname(outputA), { recursive: true }),
  mkdir(dirname(referencePath), { recursive: true }),
]);
await Promise.all([
  copyFile(sourceMediaA, outputA),
  copyFile(sourceMediaB, outputB),
  copyFile(sourceReference, referencePath),
]);

const projectId = "p10_d9_packaged_project";
const shotId = "P10D9S01";
const createdAt = "2026-07-19T05:00:00.000Z";
const sourceProject = createProjectVibe({
  projectId,
  title: "P10-D9 Delivery Handoff Acceptance",
  version: "1.0.0",
  createdAt,
  updatedAt: createdAt,
  storyFlow: {
    id: "p10_d9_story",
    sections: [{ id: "section_1", title: "雨夜递出", summary: "女孩把纸飞机递给机器人保安。", sequenceIndex: 0, shotIds: [shotId] }],
    shotOrder: [shotId],
  },
  visualMemory: {
    id: "p10_d9_visual_memory",
    entries: [{
      id: "vm_scene",
      assetId: "scene_store",
      kind: "scene",
      label: "雨夜便利店门口",
      status: "locked",
      textConstraints: ["雨夜", "便利店灯箱"],
      usedByShotIds: [shotId],
      canUseAsFutureReference: true,
      sourceRefs: ["p10-d9-local-fixture"],
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
    sourceRefs: ["p10-d9-local-fixture:shot"],
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
    sourceRefs: ["p10-d9-local-fixture"],
    lockedBy: "user",
  }],
  runs: [],
});
const sourceProjectFactHash = hashProjectVibeFacts(sourceProject);
const outputHashA = await sha256(outputA);
const outputHashB = await sha256(outputB);
assert(outputHashA !== outputHashB, "A/B fixtures must have different SHA-256 values");
const generationLedger: AgentVideoGenerationJobLedger = {
  schemaVersion: "agent_video_generation_job_ledger/0.5.0",
  ledgerId: "p10_d9_generation_ledger",
  projectId,
  projectRoot,
  projectFactHash: sourceProjectFactHash,
  createdAt,
  updatedAt: "2026-07-19T05:02:00.000Z",
  jobs: [
    localCandidateJob({ version: "a", projectId, projectRoot, projectFactHash: sourceProjectFactHash, shotId, outputPath: outputA, outputHash: outputHashA, receivedAt: "2026-07-19T05:01:00.000Z" }),
    localCandidateJob({ version: "b", projectId, projectRoot, projectFactHash: sourceProjectFactHash, shotId, outputPath: outputB, outputHash: outputHashB, receivedAt: "2026-07-19T05:02:00.000Z" }),
  ],
};
const pairResult = buildAgentDirectorReviewVersionPair({
  ledger: generationLedger,
  identity: { projectId, projectRoot, projectFactHash: sourceProjectFactHash },
});
assert(pairResult.status === "ready" && pairResult.pair, `fixture A/B pair is invalid: ${pairResult.blockers.join("; ")}`);
const pair = pairResult.pair;
const emptySelectionLedger = createAgentDirectorReviewSelectionLedger({
  projectId,
  projectRoot,
  projectFactHash: sourceProjectFactHash,
  ledgerId: "p10_d9_selection_ledger",
  createdAt,
});
const stagedSelection = stageAgentDirectorReviewSelection({
  ledger: emptySelectionLedger,
  pair,
  winnerVersion: "B",
  generatedAt: "2026-07-19T05:03:00.000Z",
});
assert(stagedSelection.ok && stagedSelection.confirmation, "fixture winner selection did not stage");
const selected = confirmAgentDirectorReviewSelection({
  ledger: stagedSelection.ledger,
  pair,
  confirmationId: stagedSelection.confirmation.confirmationId,
  reviewerId: "local_user",
  generatedAt: "2026-07-19T05:04:00.000Z",
});
assert(selected.ok && selected.receipt?.winnerVersion === "B", "fixture winner B was not selected");
const stagedPromotion = stageAgentDirectorReviewPromotion({
  ledger: selected.ledger,
  pair,
  selectionReceiptId: selected.receipt.receiptId,
  generatedAt: "2026-07-19T05:05:00.000Z",
});
assert(stagedPromotion.ok && stagedPromotion.promotionConfirmation, "fixture promotion confirmation did not stage");
const promotion = buildAgentDirectorReviewPromotionTransaction({
  project: sourceProject,
  projectRoot,
  pair,
  ledger: stagedPromotion.ledger,
  promotionConfirmationId: stagedPromotion.promotionConfirmation.confirmationId,
  reviewerId: "local_user",
  generatedAt: "2026-07-19T05:06:00.000Z",
});
assert(promotion.status === "staged" && promotion.transaction && promotion.promotionReceipt, `fixture promotion failed: ${promotion.blockers.join("; ")}`);
const appliedPromotion = applyProjectVibeTransaction(sourceProject, promotion.transaction);
assert(appliedPromotion.receipt.status === "applied" && appliedPromotion.receipt.afterFactHash, `fixture promotion transaction failed: ${appliedPromotion.receipt.errors.join("; ")}`);
const promotedProject = appliedPromotion.project;
const promotedProjectFactHash = hashProjectVibeFacts(promotedProject);
assert(promotedProjectFactHash === appliedPromotion.receipt.afterFactHash && promotedProjectFactHash !== sourceProjectFactHash, "promotion must create one new fact hash");
const parsedProject = parseProjectVibeText(serializeProjectVibe(promotedProject));
assert(parsedProject.ok, `promoted Project.vibe fixture is invalid: ${parsedProject.errors.join("; ")}`);

const generationLedgerPath = join(projectRoot, projectAgentGenerationJobLedgerPath);
const selectionLedgerPath = join(projectRoot, projectAgentReviewSelectionLedgerPath);
await mkdir(dirname(generationLedgerPath), { recursive: true });
await Promise.all([
  writeFile(projectPath, serializeProjectVibe(promotedProject), "utf8"),
  writeFile(generationLedgerPath, `${JSON.stringify(generationLedger, null, 2)}\n`, "utf8"),
  writeFile(selectionLedgerPath, `${JSON.stringify(stagedPromotion.ledger, null, 2)}\n`, "utf8"),
  writeFile(bindingPath, `${JSON.stringify({
    projectRoot,
    projectRootRelativePath: projectRoot,
    projectVibeRelativePath: "project.vibe",
    projectId,
    displayName: promotedProject.manifest.title,
  }, null, 2)}\n`, "utf8"),
]);

const baseline = {
  projectHash: await sha256(projectPath),
  outputHashA,
  outputHashB,
  referenceHash: await sha256(referencePath),
  selectionLedgerHash: await sha256(selectionLedgerPath),
  exportExists: await exists(exportRoot),
};
assert(!baseline.exportExists, "fresh D9 fixture must not contain an export before confirmation");

let launch: RunningPackagedApp | undefined;
let coldLaunch: RunningPackagedApp | undefined;
let beforeObservation: Record<string, unknown> = {};
let afterObservation: Record<string, unknown> = {};
let coldObservation: Record<string, unknown> = {};
let firstBoundary: Record<string, boolean> = {};
let coldBoundary: Record<string, boolean> = {};

try {
  launch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openExportView(launch.client);
  await waitFor(async () => {
    const state = await launch!.client.evaluate<{ step?: string; confirmButtons: number }>(`(() => ({
      step: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || undefined,
      confirmButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length
    }))()`);
    return state.step === "export" && state.confirmButtons === 1 ? state : undefined;
  }, "promoted winner did not reach the independent Delivery confirmation", 30_000);
  beforeObservation = await launch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskSource: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-source"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    confirmButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    selectionTurnCount: document.querySelectorAll('[aria-label="版本选择确认"]').length,
    promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
    packageStatus: document.querySelector('[aria-label="当前导出状态"]')?.textContent || "",
    bodyText: document.body.innerText.slice(0, 3500)
  }))()`);
  assert(beforeObservation.currentTaskCount === 1 && beforeObservation.currentTaskStep === "export", "Delivery must be the only current Agent task");
  assert(beforeObservation.confirmButtons === 1, "Delivery must expose one exact confirmation button");
  assert(beforeObservation.reviewTurnCount === 0 && beforeObservation.selectionTurnCount === 0 && beforeObservation.promotionTurnCount === 0, "old Review/Selection/Promotion cards must not compete with Delivery");
  assert(!await exists(exportRoot), "opening Delivery must not write files before confirmation");

  const clicked = await launch.client.evaluate<boolean>(`(() => {
    const buttons = [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled);
    if (buttons.length !== 1) return false;
    buttons[0].click();
    return true;
  })()`);
  assert(clicked, "exact Delivery confirmation could not be clicked");
  await waitFor(async () => {
    const state = await launch!.client.evaluate<{ ready: boolean; text: string }>(`(() => {
      const status = document.querySelector(".export-action-status.ready");
      return { ready: Boolean(status), text: status?.textContent || "" };
    })()`);
    return state.ready && state.text.includes("导出包已生成") ? state : undefined;
  }, "packaged local export did not finish", 60_000);
  await waitFor(async () => await exists(join(exportRoot, "export_manifest.json")) ? true : undefined, "atomic export package did not publish", 30_000);
  const timelinePath = join(projectRoot, projectAgentTimelinePath);
  const timeline = await waitFor(async () => {
    if (!await exists(timelinePath)) return undefined;
    const value = JSON.parse(await readFile(timelinePath, "utf8"));
    const entry = value.entries?.find((item: any) => item.details?.executionReceipt?.action === "export" && item.details?.executionReceipt?.status === "succeeded");
    return entry ? value : undefined;
  }, "succeeded export receipt did not persist in the Agent timeline", 30_000);
  const exportEntry = timeline.entries.find((item: any) => item.details?.executionReceipt?.action === "export" && item.details?.executionReceipt?.status === "succeeded");
  const executionReceipt = exportEntry.details.executionReceipt;
  assert(executionReceipt.providerCalled === false, "local export must record providerCalled=false");
  assert(executionReceipt.projectId === projectId && executionReceipt.projectFactHash === promotedProjectFactHash, "export receipt must bind the promoted project fact");
  assert(executionReceipt.deliveryReceipt?.status === "succeeded" && executionReceipt.deliveryReceipt?.executionMode === "live", "packaged filesystem export requires a succeeded local delivery receipt");
  assert(executionReceipt.deliveryReceipt.reviewBindings?.length === 1, "delivery receipt must bind exactly one promoted winner");
  assert(executionReceipt.deliveryReceipt.reviewBindings[0]?.reviewReceiptId === promotion.promotionReceipt.id, "delivery receipt must bind the exact promotion receipt");
  afterObservation = await launch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    confirmButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length,
    exportStatus: document.querySelector(".export-action-status.ready")?.textContent || "",
    bodyText: document.body.innerText.slice(0, 3500)
  }))()`);
  assert(afterObservation.currentTaskCount === 1 && afterObservation.confirmButtons === 0, "completed Delivery must not leave an actionable confirmation");
  firstBoundary = await runtimeBoundary(launch.client);
  assert(firstBoundary.tokenRequired && !firstBoundary.providerCalled && !firstBoundary.liveSubmitAllowed, "D9 must remain local with Provider disabled");
  await closePackagedApp(launch);
  launch = undefined;

  const packageSnapshotBeforeCold = await hashSnapshot(exportRoot);
  coldLaunch = await launchPackagedApp({ appPath, executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await openExportView(coldLaunch.client);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  coldObservation = await coldLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step"),
    currentTaskSource: document.querySelector('[aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-source"),
    currentTaskCount: document.querySelectorAll('[aria-label="AI 导演当前任务"]').length,
    confirmButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认导出" && !item.disabled).length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    selectionTurnCount: document.querySelectorAll('[aria-label="版本选择确认"]').length,
    promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
    bodyText: document.body.innerText.slice(0, 3500)
  }))()`);
  assert(coldObservation.currentTaskCount === 1, "cold restore must keep one Agent current task");
  assert(coldObservation.currentTaskStep === "idle", "completed current-fact Delivery must restore as terminal, not a new export task");
  assert(coldObservation.confirmButtons === 0, "cold restore must not recreate the export confirmation");
  assert(coldObservation.reviewTurnCount === 0 && coldObservation.selectionTurnCount === 0 && coldObservation.promotionTurnCount === 0, "old Review state must stay invalid after Delivery cold restore");
  coldBoundary = await runtimeBoundary(coldLaunch.client);
  assert(coldBoundary.tokenRequired && !coldBoundary.providerCalled && !coldBoundary.liveSubmitAllowed, "cold restore must not call Provider");
  await closePackagedApp(coldLaunch);
  coldLaunch = undefined;
  assert(JSON.stringify(await hashSnapshot(exportRoot)) === JSON.stringify(packageSnapshotBeforeCold), "cold restore must not rewrite the completed package");
} finally {
  if (launch) await closePackagedApp(launch);
  if (coldLaunch) await closePackagedApp(coldLaunch);
}

const exportFiles = await listFiles(exportRoot);
const exportManifest = JSON.parse(await readFile(join(exportRoot, "export_manifest.json"), "utf8"));
assert(exportManifest.readiness === "ready", "published export manifest must be ready");
assert(exportManifest.mediaFiles?.length === 1, "published package must contain exactly one promoted video");
const deliveredMedia = exportManifest.mediaFiles[0];
assert(deliveredMedia.sourcePath === "video/P10D9S01-version-b.mp4", "published package must source the promoted B winner");
assert(deliveredMedia.sourceHash === `sha256:${outputHashB}`, "published manifest must bind winner B SHA-256");
const deliveredMediaPath = join(projectRoot, deliveredMedia.path);
assert(await exists(deliveredMediaPath), "published winner media is missing");
assert(await sha256(deliveredMediaPath) === outputHashB, "published winner media SHA-256 changed");
const exportedVideoFiles = exportFiles.filter((path) => /\.mp4$/i.test(path));
assert(exportedVideoFiles.length === 1, "Delivery package must copy exactly one video");
assert(!exportedVideoFiles.some((path) => path.includes("version-a")), "loser A must not enter the Delivery package");
assert(!exportFiles.some((path) => path.includes(".vibe-staging")), "atomic publish must leave no staged files");
const portableText = (await Promise.all(exportFiles.filter((path) => /\.(?:json|md|tsv)$/i.test(path)).map((path) => readFile(join(exportRoot, path), "utf8")))).join("\n");
assert(!portableText.includes(projectRoot), "portable package must not leak its absolute project root");
assert(await sha256(projectPath) === baseline.projectHash, "Delivery must not mutate Project.vibe");
assert(await sha256(outputA) === baseline.outputHashA && await sha256(outputB) === baseline.outputHashB, "Delivery must preserve both original A/B media files");
assert(await sha256(referencePath) === baseline.referenceHash, "Delivery must not mutate the locked reference");
assert(await sha256(selectionLedgerPath) === baseline.selectionLedgerHash, "Delivery must preserve the historical selection/loser evidence");

const finalTimeline = JSON.parse(await readFile(join(projectRoot, projectAgentTimelinePath), "utf8"));
const completedExportEntries = finalTimeline.entries.filter((item: any) => item.details?.executionReceipt?.action === "export" && item.details?.executionReceipt?.status === "succeeded");
assert(completedExportEntries.length === 1, "exactly one Delivery execution receipt must persist");
const finalReceipt = completedExportEntries[0].details.executionReceipt;

const evidence = {
  schemaVersion: "p10_d9_packaged_acceptance/1.0.0",
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
  promotion: {
    pairId: pair.pairId,
    selectionReceiptId: selected.receipt.receiptId,
    promotionReceiptId: promotion.promotionReceipt.id,
    winnerVersion: "B",
    winnerJobId: pair.candidateB.identity.jobId,
    winnerActionId: pair.candidateB.identity.actionId,
    winnerSourceReceiptId: pair.candidateB.identity.sourceReceiptId,
    winnerOutputPath: pair.candidateB.identity.outputPath,
    winnerOutputHash: pair.candidateB.identity.outputHash,
    loserPreserved: true,
  },
  delivery: {
    exportRoot: "exports/current-project",
    files: exportFiles,
    mediaFiles: exportManifest.mediaFiles,
    executionReceiptId: finalReceipt.receiptId,
    actionId: finalReceipt.actionId,
    confirmationId: finalReceipt.confirmationReceiptId,
    deliveryReceipt: finalReceipt.deliveryReceipt,
  },
  observations: {
    beforeConfirmation: beforeObservation,
    afterExport: afterObservation,
    coldRestore: coldObservation,
  },
  runtimeBoundaries: {
    firstLaunch: firstBoundary,
    coldLaunch: coldBoundary,
  },
  hashes: {
    candidateA: outputHashA,
    candidateB: outputHashB,
    delivered: await sha256(deliveredMediaPath),
    project: await sha256(projectPath),
  },
  invariants: {
    providerCalls: 0,
    promotionAndDeliveryIndependent: true,
    exportConfirmationCount: 1,
    deliveryExecutionCount: 1,
    onlyPromotedWinnerDelivered: true,
    loserMediaPreserved: true,
    projectFactsUnchangedByDelivery: true,
    portablePaths: true,
    atomicPublish: true,
    coldRestoreStable: true,
  },
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "pass",
  root,
  evidencePath,
  sourceProjectFactHash,
  promotedProjectFactHash,
  outputHashA,
  outputHashB,
  deliveredHash: await sha256(deliveredMediaPath),
}, null, 2));
