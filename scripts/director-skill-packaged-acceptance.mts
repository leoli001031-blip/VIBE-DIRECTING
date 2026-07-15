import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import { dirname, join, relative, resolve } from "node:path";

import {
  parseDirectorSkillDefinition,
  parseDirectorSkillRecipe,
  type DirectorSkillDefinition,
} from "../src/core/directorSkillContract.ts";
import {
  createDirectorSkillCase,
  parseDirectorSkillInvocationLedger,
} from "../src/core/directorSkillEvidence.ts";
import {
  createDirectorSkillRegistry,
  promoteDirectorSkillToGlobal,
  rollbackDirectorSkillVersion,
  serializeDirectorSkillRegistry,
  type DirectorSkillRegistryConfirmation,
} from "../src/core/directorSkillRegistry.ts";
import {
  parseDirectorSkillStackIndexWithStatus,
} from "../src/core/directorSkillLibrary.ts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  parseProjectVibeText,
  serializeProjectVibe,
} from "../src/project/index.ts";
import { projectDirectorSkillInvocationLedgerPath } from "../src/project/projectDirectorSkillInvocationStore.ts";

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
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  assert(address && typeof address === "object", "could not allocate a CDP port");
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
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
      socket.once("connect", () => resolveConnect());
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

  async evaluate<T>(expression: string): Promise<T> {
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
    stop.once("error", () => resolveStop());
    stop.once("exit", () => resolveStop());
  });
}

async function launchPackagedApp(input: {
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
  const appArgs = [
    `--user-data-dir=${input.profileRoot}`,
    `--${darwinLaunchMarker || `vibe-packaged-acceptance-id=${port}`}`,
  ];
  const child = process.platform === "darwin"
    ? spawn("open", [
        "-n",
        "-g",
        "-o",
        redirectedStdoutPath!,
        "--stderr",
        redirectedStderrPath!,
        ...Object.entries(launchEnv).flatMap(([name, value]) => ["--env", `${name}=${value}`]),
        resolve(dirname(input.executablePath), "../.."),
        "--args",
        ...appArgs,
      ], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : spawn(input.executablePath, appArgs, {
        cwd: process.cwd(),
        env: { ...process.env, ...launchEnv },
        stdio: ["ignore", "pipe", "pipe"],
      });
  child.stdout.on("data", (chunk) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  child.once("error", (error) => stderr.push(String(error)));

  try {
    let client: PackagedAcceptanceClient | undefined;
    client = await waitFor(async () => {
      if ((child.exitCode !== null || child.signalCode !== null) && process.platform !== "darwin") {
        const redirectedError = redirectedStderrPath && await exists(redirectedStderrPath)
          ? await readFile(redirectedStderrPath, "utf8")
          : "";
        throw new Error(`packaged App exited with ${child.exitCode}/${child.signalCode}: ${stderr.join("")}${redirectedError}`);
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
    const redirectedStdout = redirectedStdoutPath && await exists(redirectedStdoutPath)
      ? await readFile(redirectedStdoutPath, "utf8")
      : "";
    const redirectedStderr = redirectedStderrPath && await exists(redirectedStderrPath)
      ? await readFile(redirectedStderrPath, "utf8")
      : "";
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\npackaged stdout:\n${stdout.join("")}${redirectedStdout}\npackaged stderr:\n${stderr.join("")}${redirectedStderr}`);
  }
}

async function closePackagedApp(app: RunningPackagedApp): Promise<void> {
  await app.client.send("close").catch(() => undefined);
  app.client.close();
  if (app.child.exitCode !== null || app.child.signalCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveExit) => app.child.once("exit", () => resolveExit())),
    new Promise<void>((resolveTimeout) => setTimeout(async () => {
      await terminateDarwinLaunch(app.darwinLaunchMarker);
      if (app.child.exitCode === null && app.child.signalCode === null) app.child.kill("SIGTERM");
      resolveTimeout();
    }, 3000)),
  ]);
}

async function runtimeBoundary(client: PackagedAcceptanceClient): Promise<{ providerCalled: boolean; liveSubmitAllowed: boolean; tokenRequired: boolean }> {
  return client.evaluate(`
    (async () => {
      const baseUrl = await window.vibeRuntime.ensureRuntimeApiBaseUrl();
      const token = window.vibeRuntime.runtimeApiToken();
      const response = await fetch(baseUrl + "/api/runtime/status", { headers: { "x-vibe-runtime-token": token } });
      const payload = await response.json();
      return { providerCalled: payload.providerCalled === true, liveSubmitAllowed: payload.liveSubmitAllowed === true, tokenRequired: payload.tokenRequired === true };
    })()
  `);
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

const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
assert(await exists(executablePath), `packaged App executable is missing: ${executablePath}`);

const root = await mkdtemp("/tmp/vibe-director-p10-s-packaged-");
const profileRoot = join(root, "profile");
const projectsRoot = join(root, "projects");
const runtimeRoot = join(root, "runtime");
const globalSkillLibraryRoot = join(root, "global-skill-library");
const projectRoot = join(projectsRoot, "p10-s-project-local-candidate");
const bindingPath = join(profileRoot, "current-project.local.json");
const projectPath = join(projectRoot, "project.vibe");
await Promise.all([
  mkdir(profileRoot, { recursive: true }),
  mkdir(projectRoot, { recursive: true }),
  mkdir(runtimeRoot, { recursive: true }),
  mkdir(globalSkillLibraryRoot, { recursive: true }),
]);

const createdAt = "2026-07-16T08:00:00.000Z";
const project = createProjectVibe({
  projectId: "p10-s-packaged-project",
  title: "P10-S Packaged Skill Acceptance",
  version: "1.0.0",
  createdAt,
  updatedAt: createdAt,
  storyFlow: {
    id: "p10_s_story",
    sections: [{ id: "section_1", title: "雨夜递出", summary: "女孩在雨夜向机器人递出纸飞机。", sequenceIndex: 0, shotIds: ["P10S01"] }],
    shotOrder: ["P10S01"],
  },
  visualMemory: {
    id: "p10_s_visual_memory",
    entries: [
      { id: "vm_scene", assetId: "scene_store", kind: "scene", label: "雨夜便利店门口", status: "candidate", textConstraints: ["雨夜", "便利店灯箱"], usedByShotIds: ["P10S01"], canUseAsFutureReference: false, sourceRefs: ["p10-s-fixture"] },
      { id: "vm_girl", assetId: "char_girl", kind: "character", label: "女孩", status: "candidate", textConstraints: ["湿发", "手持纸飞机"], usedByShotIds: ["P10S01"], canUseAsFutureReference: false, sourceRefs: ["p10-s-fixture"] },
      { id: "vm_robot", assetId: "char_robot", kind: "character", label: "机器人保安", status: "candidate", textConstraints: ["门口执勤", "克制动作"], usedByShotIds: ["P10S01"], canUseAsFutureReference: false, sourceRefs: ["p10-s-fixture"] },
      { id: "vm_plane", assetId: "prop_plane", kind: "prop", label: "纸飞机", status: "candidate", textConstraints: ["纸质", "灯箱中发光"], usedByShotIds: ["P10S01"], canUseAsFutureReference: false, sourceRefs: ["p10-s-fixture"] },
    ],
  },
  shots: [{
    id: "P10S01",
    sectionId: "section_1",
    title: "雨夜递出纸飞机",
    intent: "女孩把纸飞机递给机器人保安，机器人伸手挡雨，女孩松开手指后停顿半拍。",
    sceneAssetIds: ["scene_store"],
    characterAssetIds: ["char_girl", "char_robot"],
    propAssetIds: ["prop_plane"],
    durationSeconds: 6,
    status: "planned",
    sourceRefs: ["p10-s-fixture:shot:P10S01"],
    referenceStrategy: "storyboard_narrative",
    executionMode: "relationship_wide",
    primaryAction: "女孩递出纸飞机",
    actionTrigger: "机器人伸手挡住雨",
    microReaction: "女孩松开手指后停顿半拍",
    camera: "中远景轻推，保持两人站位关系",
  }],
  assets: [
    { id: "scene_store", kind: "scene", label: "雨夜便利店门口", status: "candidate", textConstraints: ["雨夜", "便利店灯箱"], usedByShotIds: ["P10S01"], sourceRefs: ["p10-s-fixture"] },
    { id: "char_girl", kind: "character", label: "女孩", status: "candidate", textConstraints: ["湿发", "手持纸飞机"], usedByShotIds: ["P10S01"], sourceRefs: ["p10-s-fixture"] },
    { id: "char_robot", kind: "character", label: "机器人保安", status: "candidate", textConstraints: ["门口执勤", "克制动作"], usedByShotIds: ["P10S01"], sourceRefs: ["p10-s-fixture"] },
    { id: "prop_plane", kind: "prop", label: "纸飞机", status: "candidate", textConstraints: ["纸质", "灯箱中发光"], usedByShotIds: ["P10S01"], sourceRefs: ["p10-s-fixture"] },
  ],
  runs: [],
});
const projectFactHash = hashProjectVibeFacts(project);
const serializedProject = serializeProjectVibe(project);
const parsedProject = parseProjectVibeText(serializedProject);
assert(parsedProject.ok, `packaged fixture project.vibe must pass the production parser: ${parsedProject.errors.join("; ")}`);
await writeFile(projectPath, serializedProject, "utf8");
await writeFile(bindingPath, `${JSON.stringify({
  projectRoot,
  projectRootRelativePath: projectRoot,
  projectVibeRelativePath: "project.vibe",
  projectId: project.manifest.projectId,
  displayName: project.manifest.title,
}, null, 2)}\n`, "utf8");

let firstLaunch: RunningPackagedApp | undefined;
let secondLaunch: RunningPackagedApp | undefined;
let firstObservation: Record<string, unknown> = {};
let coldObservation: Record<string, unknown> = {};
try {
  firstLaunch = await launchPackagedApp({ executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await waitFor(async () => {
    const found = await firstLaunch!.client.evaluate<boolean>("Boolean(document.querySelector('button[aria-label^=\"保存为 Skill：\"]'))");
    return found ? true : undefined;
  }, "project-local Skill save action did not appear in packaged App");
  await firstLaunch.client.evaluate(`
    (() => {
      const details = document.querySelector("details.minimal-agent-skill-disclosure");
      if (details && !details.open) details.querySelector("summary")?.click();
      return Boolean(document.querySelector('button[aria-label^="保存为 Skill："]'));
    })()
  `);
  await firstLaunch.client.evaluate("document.querySelector('button[aria-label^=\"保存为 Skill：\"]')?.click(); true");
  await waitFor(async () => {
    const state = await firstLaunch!.client.evaluate<{ found: boolean; disabled: boolean }>(`(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "确认保存");
      return { found: Boolean(button), disabled: Boolean(button?.disabled) };
    })()`);
    return state.found && !state.disabled ? state : undefined;
  }, "save_skill confirmation did not become actionable");
  assert(!(await exists(join(projectRoot, "skills", "skill-index.json"))), "save_skill must not write before confirmation");
  await firstLaunch.client.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "确认保存" && !item.disabled);
    button?.click();
    return Boolean(button);
  })()`);
  await waitFor(async () => await exists(join(projectRoot, "skills", "skill-index.json")) ? true : undefined, "confirmed packaged save did not write skill-index.json");
  await waitFor(async () => {
    const done = await firstLaunch!.client.evaluate<boolean>("document.body.innerText.includes('导演经验已保存')");
    return done ? true : undefined;
  }, "packaged App did not report completed Skill save");
  const firstBoundary = await runtimeBoundary(firstLaunch.client);
  assert(firstBoundary.tokenRequired && !firstBoundary.providerCalled && !firstBoundary.liveSubmitAllowed, "packaged save must keep Runtime provider and live-submit boundaries closed");
  firstObservation = await firstLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector("[data-current-task-step]")?.getAttribute("data-current-task-step"),
    loadedSkillText: document.querySelector(".minimal-agent-skill-groups")?.textContent || "",
    activeConfirmSaveButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认保存" && !item.disabled).length,
    saveButtons: document.querySelectorAll('button[aria-label^="保存为 Skill："]').length
  }))()`);
  await closePackagedApp(firstLaunch);
  firstLaunch = undefined;

  secondLaunch = await launchPackagedApp({ executablePath, profileRoot, projectsRoot, runtimeRoot, bindingPath });
  await waitFor(async () => {
    const restored = await secondLaunch!.client.evaluate<boolean>("Boolean(document.querySelector('.minimal-agent-skill-groups')?.textContent?.includes('已加载 1 个'))");
    return restored ? true : undefined;
  }, "cold-start packaged App did not restore the project-local candidate");
  await waitFor(async () => {
    const ready = await secondLaunch!.client.evaluate<boolean>(`[...document.querySelectorAll("button")].some((item) => (
      item.getAttribute("aria-label")?.startsWith("选择镜头 P10S01：")
      && item.getAttribute("aria-pressed") === "true"
    ))`);
    return ready ? true : undefined;
  }, "cold-start packaged App did not restore and select the fixture shot");
  coldObservation = await secondLaunch.client.evaluate(`(() => ({
    currentTaskStep: document.querySelector("[data-current-task-step]")?.getAttribute("data-current-task-step"),
    loadedSkillText: document.querySelector(".minimal-agent-skill-groups")?.textContent || "",
    activeConfirmSaveButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认保存" && !item.disabled).length,
    totalConfirmSaveButtons: [...document.querySelectorAll("button")].filter((item) => item.textContent?.trim() === "确认保存").length,
    saveButtons: document.querySelectorAll('button[aria-label^="保存为 Skill："]').length
  }))()`);
  assert(coldObservation.activeConfirmSaveButtons === 0, "cold start must not revive the old save_skill confirmation");
  assert(coldObservation.saveButtons === 0, "restored candidate should not be offered as an unsaved duplicate");

  await secondLaunch.client.evaluate(`(() => {
    const textarea = document.querySelector('textarea[aria-label="和 AI 导演说"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, "把当前镜头的主动作改成女孩递出纸飞机后停顿半拍，保持中远景。");
    textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea?.value || "";
  })()`);
  await waitFor(async () => {
    const ready = await secondLaunch!.client.evaluate<boolean>(`(() => {
      const button = document.querySelector('button[aria-label="发送"]');
      return Boolean(button && !button.disabled);
    })()`);
    return ready ? true : undefined;
  }, "packaged composer did not accept the local feedback instruction");
  await secondLaunch.client.evaluate("document.querySelector('button[aria-label=\"发送\"]')?.click(); true");

  const ledgerPath = join(projectRoot, projectDirectorSkillInvocationLedgerPath);
  await waitFor(async () => await exists(ledgerPath) ? true : undefined, "packaged dry-run Planner/Prompt/QA did not persist a Skill invocation receipt", 40_000);
  const secondBoundary = await runtimeBoundary(secondLaunch.client);
  assert(secondBoundary.tokenRequired && !secondBoundary.providerCalled && !secondBoundary.liveSubmitAllowed, "packaged dry-run injection must keep providers closed");
  await closePackagedApp(secondLaunch);
  secondLaunch = undefined;
} finally {
  if (firstLaunch) await closePackagedApp(firstLaunch);
  if (secondLaunch) await closePackagedApp(secondLaunch);
}

const indexResult = parseDirectorSkillStackIndexWithStatus(await readFile(join(projectRoot, "skills", "skill-index.json"), "utf8"));
assert(indexResult.ok && indexResult.index.skills.length === 1, `saved Skill index should restore exactly one candidate: ${indexResult.errors.join("; ")}`);
const skillIndexItem = indexResult.index.skills[0]!;
assert(skillIndexItem.scope === "project_local" && skillIndexItem.maturity === "candidate" && skillIndexItem.enabled === true, "packaged save must create one enabled project-local candidate");
assert(skillIndexItem.definitionPath && skillIndexItem.recipePath, "v2 Skill index must bind canonical definition and Recipe paths");
const definitionResult = parseDirectorSkillDefinition(await readFile(join(projectRoot, skillIndexItem.definitionPath), "utf8"));
const recipeResult = parseDirectorSkillRecipe(await readFile(join(projectRoot, skillIndexItem.recipePath), "utf8"));
assert(definitionResult.ok && definitionResult.value, `saved definition should validate: ${definitionResult.ok ? "missing definition" : definitionResult.errors.join("; ")}`);
assert(recipeResult.ok && recipeResult.value, `saved Recipe should validate: ${recipeResult.ok ? "missing Recipe" : recipeResult.errors.join("; ")}`);

const invocationResult = parseDirectorSkillInvocationLedger(await readFile(join(projectRoot, projectDirectorSkillInvocationLedgerPath), "utf8"), {
  projectId: project.manifest.projectId,
  projectRoot,
  projectFactHash,
});
assert(invocationResult.ok && invocationResult.value?.receipts.length === 1, `packaged invocation ledger should contain one current fact-bound receipt: ${invocationResult.ok ? "unexpected receipt count" : invocationResult.errors.join("; ")}`);
const invocationReceipt = invocationResult.value.receipts[0]!;
assert(invocationReceipt.skillId === definitionResult.value.id && invocationReceipt.skillContentHash === definitionResult.value.contentHash, "packaged receipt must bind the restored candidate version and hash");
assert(invocationReceipt.status === "validated" && invocationReceipt.qa.status === "pass", "packaged dry-run receipt must record Planner/Prompt/QA validation");
assert(invocationReceipt.provider.executionMode === "dry_run", "packaged receipt must not claim provider-backed execution");

function promotionCase(definition: DirectorSkillDefinition, projectId: string, index: number) {
  const at = `2026-07-16T09:0${index}:00.000Z`;
  return createDirectorSkillCase({
    projectId,
    projectRoot: join(root, "promotion-fixtures", projectId),
    projectFactHash: `fact_${projectId}`,
    shotId: `P10S0${index}`,
    actionId: `action_${projectId}`,
    jobId: `job_${projectId}`,
    skillId: definition.id,
    skillVersion: definition.version,
    skillContentHash: definition.contentHash,
    routeId: `route_${projectId}`,
    inputHash: `input_${projectId}`,
    outputHash: `output_${projectId}`,
    knowledgePacks: [],
    provider: { executionMode: "dry_run" },
    qa: { status: "pass", checkedSkillHash: definition.contentHash, checkedKnowledgePackHashes: [], findings: [] },
    humanDecision: { decision: "accepted", decidedBy: "user", decidedAt: at, confirmationId: `confirm_case_${projectId}` },
    outcome: "accepted",
    summary: "Isolated accepted dry-run promotion fixture.",
    createdAt: at,
  });
}

function registryConfirmation(
  skillId: string,
  targetVersion: string,
  targetMaturity: "verified" | "trusted",
  suffix: string,
): DirectorSkillRegistryConfirmation {
  return {
    confirmationId: `confirm_promote_${suffix}`,
    confirmedBy: "user",
    confirmedAt: "2026-07-16T09:10:00.000Z",
    operation: "promote",
    skillId,
    targetVersion,
    targetMaturity,
  };
}

const emptyRegistry = createDirectorSkillRegistry("p10-s-packaged-isolated-global", "2026-07-16T09:00:00.000Z");
const verified = promoteDirectorSkillToGlobal({
  registry: emptyRegistry,
  definition: definitionResult.value,
  recipes: [recipeResult.value],
  cases: [promotionCase(definitionResult.value, "promotion-a", 1), promotionCase(definitionResult.value, "promotion-b", 2)],
  requestedMaturity: "verified",
  confirmation: registryConfirmation(definitionResult.value.id, "1.1.0", "verified", "verified"),
  promotedAt: "2026-07-16T09:10:00.000Z",
});
assert(verified.ok, `isolated verified promotion should pass: ${verified.errors.join("; ")}`);
const verifiedVersion = verified.registry.entries[0]!.versions[0]!;
const trusted = promoteDirectorSkillToGlobal({
  registry: verified.registry,
  definition: verifiedVersion.definition,
  recipes: verifiedVersion.recipes,
  cases: [promotionCase(verifiedVersion.definition, "promotion-c", 3), promotionCase(verifiedVersion.definition, "promotion-d", 4)],
  requestedMaturity: "trusted",
  confirmation: registryConfirmation(definitionResult.value.id, "1.2.0", "trusted", "trusted"),
  promotedAt: "2026-07-16T09:20:00.000Z",
});
assert(trusted.ok, `isolated trusted promotion should pass: ${trusted.errors.join("; ")}`);
const rollback = rollbackDirectorSkillVersion({
  registry: trusted.registry,
  skillId: definitionResult.value.id,
  targetVersion: "1.1.0",
  confirmation: {
    confirmationId: "confirm_packaged_fixture_rollback",
    confirmedBy: "user",
    confirmedAt: "2026-07-16T09:30:00.000Z",
    operation: "rollback",
    skillId: definitionResult.value.id,
    targetVersion: "1.1.0",
  },
  createdAt: "2026-07-16T09:30:00.000Z",
});
assert(rollback.ok && rollback.registry.entries[0]?.activeVersion === "1.1.0", "isolated global Skill rollback should restore the verified version");
const globalRegistryPath = join(globalSkillLibraryRoot, "director-skills", "registry.json");
await mkdir(dirname(globalRegistryPath), { recursive: true });
await writeFile(globalRegistryPath, serializeDirectorSkillRegistry(rollback.registry), "utf8");

const projectFiles = await listFiles(projectRoot);
const generatedMedia = projectFiles.filter((path) => /\.(?:png|jpe?g|webp|gif|mp4|mov|wav|mp3|m4a)$/i.test(path));
assert(generatedMedia.length === 0, `packaged no-provider acceptance must not generate media: ${generatedMedia.join(", ")}`);

const report = {
  schemaVersion: "director_skill_packaged_acceptance/1.0.0",
  status: "PASS",
  root,
  appPath,
  profileRoot,
  projectRoot,
  globalSkillLibraryRoot,
  projectFactHash,
  savedCandidate: {
    skillId: definitionResult.value.id,
    version: definitionResult.value.version,
    contentHash: definitionResult.value.contentHash,
    scope: definitionResult.value.scope,
    maturity: definitionResult.value.maturity,
    indexCount: indexResult.index.skills.length,
  },
  firstLaunch: firstObservation,
  coldStart: coldObservation,
  invocation: {
    receiptId: invocationReceipt.receiptId,
    status: invocationReceipt.status,
    qaStatus: invocationReceipt.qa.status,
    executionMode: invocationReceipt.provider.executionMode,
    projectFactHash: invocationReceipt.projectFactHash,
  },
  isolatedGlobalFixture: {
    verifiedVersion: "1.1.0",
    trustedVersion: "1.2.0",
    rollbackVersion: rollback.registry.entries[0]?.activeVersion,
    registryPath: globalRegistryPath,
  },
  providerCalls: 0,
  generatedMedia,
  appProcessesClosed: true,
  projectFiles,
  completedAt: new Date().toISOString(),
};
const reportPath = join(root, "reports", "p10-s-packaged-acceptance.json");
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ ...report, reportPath }, null, 2));
