import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import { join } from "node:path";

export function assertAcceptance(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function pathExists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

export async function waitForAcceptance<T>(
  probe: () => Promise<T | undefined>,
  message: string,
  timeoutMs = 30_000,
): Promise<T> {
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
  assertAcceptance(address && typeof address === "object", "could not allocate an acceptance control port");
  await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

type AcceptanceMethod = "evaluate" | "set_bounds" | "capture_page" | "click_at" | "close";

export class PackagedAcceptanceClient {
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

  clickAt(x: number, y: number): Promise<{ x: number; y: number }> {
    return this.send("click_at", { x, y }) as Promise<{ x: number; y: number }>;
  }

  close(): void {
    this.socket.destroy();
  }
}

export interface RunningPackagedApp {
  child: ChildProcessWithoutNullStreams;
  client: PackagedAcceptanceClient;
  stdout: string[];
  stderr: string[];
  redirectedStdoutPath?: string;
  redirectedStderrPath?: string;
  darwinLaunchMarker?: string;
}

async function terminateDarwinLaunch(marker: string | undefined, signal: "TERM" | "KILL"): Promise<void> {
  if (!marker) return;
  await new Promise<void>((resolveStop) => {
    const stop = spawn("pkill", [`-${signal}`, "-f", marker], { stdio: "ignore" });
    stop.once("error", resolveStop);
    stop.once("exit", resolveStop);
  });
}

export async function launchPackagedAcceptanceApp(input: {
  appPath: string;
  executablePath: string;
  profileRoot: string;
  projectsRoot: string;
  runtimeRoot: string;
  bindingPath: string;
  extraEnv?: Record<string, string>;
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
    ...input.extraEnv,
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
    const client = await waitForAcceptance(async () => {
      if ((child.exitCode !== null || child.signalCode !== null) && process.platform !== "darwin") {
        throw new Error(`packaged App exited with ${child.exitCode}/${child.signalCode}: ${stderr.join("")}`);
      }
      return PackagedAcceptanceClient.connect(port, controlToken).catch(() => undefined);
    }, "packaged acceptance control did not appear", 30_000);
    await waitForAcceptance(async () => {
      const ready = await client.evaluate<boolean>("Boolean(document.querySelector('#root') && document.body?.innerText?.includes('AI 导演'))");
      return ready ? true : undefined;
    }, "packaged renderer did not reach the Agent-first surface", 30_000);
    return { child, client, stdout, stderr, redirectedStdoutPath, redirectedStderrPath, darwinLaunchMarker };
  } catch (error) {
    await terminateDarwinLaunch(darwinLaunchMarker, "TERM");
    child.kill("SIGTERM");
    const redirectedStdout = redirectedStdoutPath && await pathExists(redirectedStdoutPath) ? await readFile(redirectedStdoutPath, "utf8") : "";
    const redirectedStderr = redirectedStderrPath && await pathExists(redirectedStderrPath) ? await readFile(redirectedStderrPath, "utf8") : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)}\npackaged stdout:\n${stdout.join("")}${redirectedStdout}\npackaged stderr:\n${stderr.join("")}${redirectedStderr}`);
  }
}

export async function closePackagedAcceptanceApp(app: RunningPackagedApp): Promise<void> {
  await app.client.send("close").catch(() => undefined);
  app.client.close();
  if (app.child.exitCode !== null || app.child.signalCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveExit) => app.child.once("exit", resolveExit)),
    new Promise<void>((resolveTimeout) => setTimeout(async () => {
      await terminateDarwinLaunch(app.darwinLaunchMarker, "TERM");
      if (app.child.exitCode === null && app.child.signalCode === null) app.child.kill("SIGTERM");
      resolveTimeout();
    }, 3000)),
  ]);
}

export async function forceClosePackagedAcceptanceApp(app: RunningPackagedApp): Promise<void> {
  app.client.close();
  await terminateDarwinLaunch(app.darwinLaunchMarker, "KILL");
  if (app.child.exitCode === null && app.child.signalCode === null) app.child.kill("SIGKILL");
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
}

export async function openVideoAcceptanceView(client: PackagedAcceptanceClient): Promise<void> {
  await waitForAcceptance(async () => {
    const found = await client.evaluate<boolean>(`[...document.querySelectorAll("button")].some((item) => item.getAttribute("aria-label")?.startsWith("视频，"))`);
    return found ? true : undefined;
  }, "video rail action did not appear");
  await client.evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label")?.startsWith("视频，"));
    button?.click();
    return Boolean(button);
  })()`);
}

export async function openExportAcceptanceView(client: PackagedAcceptanceClient): Promise<void> {
  await waitForAcceptance(async () => {
    const found = await client.evaluate<boolean>(`Boolean(document.querySelector('button[aria-label="交付，展示包"]'))`);
    return found ? true : undefined;
  }, "Delivery rail action did not appear");
  await client.evaluate(`(() => {
    const button = document.querySelector('button[aria-label="交付，展示包"]');
    button?.click();
    return Boolean(button);
  })()`);
}

export async function observePackagedTask(client: PackagedAcceptanceClient): Promise<Record<string, unknown>> {
  return client.evaluate(`(() => ({
    currentTaskStep: document.querySelector('.minimal-agent-panel [aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-step") || "",
    currentTaskSource: document.querySelector('.minimal-agent-panel [aria-label="AI 导演当前任务"]')?.getAttribute("data-current-task-source") || "",
    currentTaskLabel: document.querySelector('.minimal-agent-panel [aria-label="AI 导演当前任务"] strong')?.textContent?.trim() || "",
    currentTaskCount: document.querySelectorAll('.minimal-agent-panel [aria-label="AI 导演当前任务"]').length,
    runningTurnCount: document.querySelectorAll('[aria-label="当前运行任务"]').length,
    reviewTurnCount: document.querySelectorAll('[aria-label="当前视频复核"]').length,
    selectionTurnCount: document.querySelectorAll('[aria-label="版本选择确认"]').length,
    promotionTurnCount: document.querySelectorAll('[aria-label="项目事实晋级确认"]').length,
    enabledConfirmations: [...document.querySelectorAll("button")].filter((item) => !item.disabled && (
      item.textContent?.includes("确认选择版本")
      || item.textContent?.includes("确认晋级项目事实")
      || item.textContent?.trim() === "确认导出"
    )).map((item) => item.textContent?.trim()),
    bodyText: document.body.innerText.slice(0, 6000)
  }))()`);
}

export async function packagedProcessRssKb(app: RunningPackagedApp): Promise<number | undefined> {
  const marker = app.darwinLaunchMarker;
  if (!marker) return undefined;
  const pids = await new Promise<string[]>((resolvePids) => {
    const child = spawn("pgrep", ["-f", marker], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", () => resolvePids([]));
    child.once("exit", () => resolvePids(output.trim().split(/\s+/).filter(Boolean)));
  });
  if (pids.length === 0) return undefined;
  return new Promise<number | undefined>((resolveRss) => {
    const child = spawn("ps", ["-o", "rss=", "-p", pids.join(",")], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", () => resolveRss(undefined));
    child.once("exit", () => {
      const values = output.trim().split(/\s+/).map(Number).filter(Number.isFinite);
      resolveRss(values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined);
    });
  });
}

export async function packagedRuntimeProcessIdsForRoot(runtimeRoot: string): Promise<number[]> {
  if (process.platform !== "darwin") return [];
  return new Promise((resolvePids) => {
    const child = spawn("ps", ["eww", "-axo", "pid=,command="], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", () => resolvePids([]));
    child.once("exit", () => {
      const marker = `VIBE_DIRECTOR_RUNTIME_WORKDIR=${runtimeRoot}`;
      resolvePids(output.split(/\r?\n/).flatMap((line) => {
        if (!line.includes(marker) || !line.includes("local-runtime-api-server.mjs")) return [];
        const pid = Number(line.trim().split(/\s+/, 1)[0]);
        return Number.isInteger(pid) ? [pid] : [];
      }));
    });
  });
}
