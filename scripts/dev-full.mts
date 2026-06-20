import { execFile, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

const children: ChildProcess[] = [];
let keepAlive: NodeJS.Timeout | undefined;
const viteUrl = "http://127.0.0.1:5174/";
const runtimeUrl = "http://127.0.0.1:8790";

const frontendFreshnessChecks = [
  {
    path: "/src/core/directorAgentPermissionIntent.ts",
    markers: ["isDirectorAgentExplainOnlyIntent", "只告诉我"],
  },
  {
    path: "/src/ui/director/useSeedanceVideoSubmitAction.ts",
    markers: ["需要时可以重新确认"],
  },
];

function isPortOpen(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(350);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function prefix(stream: "stdout" | "stderr", tag: string, child: ChildProcess) {
  const target = stream === "stderr" ? process.stderr : process.stdout;
  child.stdout?.on("data", (data: Buffer) => {
    target.write(`[${tag}] ${data}`);
  });
  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[${tag}] ${data}`);
  });
}

function cleanup() {
  if (keepAlive) clearInterval(keepAlive);
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

function startChild(tag: string, command: string, args: string[]) {
  const child = spawn(command, args, { stdio: "pipe" });
  children.push(child);
  prefix("stdout", tag, child);
  child.on("close", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${tag}] exited with code ${code}`);
    }
    cleanup();
  });
  return child;
}

function listPortPids(port: number) {
  return new Promise<string[]>((resolve) => {
    execFile("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      resolve(stdout.split(/\s+/).filter(Boolean));
    });
  });
}

async function checkExistingViteFreshness() {
  for (const check of frontendFreshnessChecks) {
    const sourceUrl = new URL(check.path, viteUrl);
    sourceUrl.searchParams.set("devFullFreshness", String(Date.now()));
    let response: Response;
    try {
      response = await fetch(sourceUrl);
    } catch (error) {
      return {
        ok: false,
        reason: `could not fetch ${check.path}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (!response.ok) {
      return { ok: false, reason: `${check.path} returned HTTP ${response.status}` };
    }
    const cacheControl = response.headers.get("cache-control") || "";
    if (!cacheControl.toLowerCase().includes("no-store")) {
      return { ok: false, reason: `${check.path} did not return Cache-Control: no-store` };
    }
    const source = await response.text();
    for (const marker of check.markers) {
      if (!source.includes(marker)) {
        return { ok: false, reason: `${check.path} is missing marker "${marker}"` };
      }
    }
  }
  return { ok: true, reason: "fresh" };
}

const viteAlreadyRunning = await isPortOpen(5174);
const runtimeAlreadyRunning = await isPortOpen(8790);

if (viteAlreadyRunning) {
  const freshness = await checkExistingViteFreshness();
  if (!freshness.ok) {
    const pids = await listPortPids(5174);
    console.error("Vibe Director Studio — existing Vite dev server looks stale.");
    console.error(`  ${viteUrl} is already running, but ${freshness.reason}.`);
    if (pids.length) {
      console.error(`  Occupying PID(s): ${pids.join(", ")}`);
      console.error(`  Stop command: kill ${pids.join(" ")}`);
    }
    console.error("  Stop the old Vite process, then run npm run dev:full again before recording.");
    console.error(`  Check with: VIBE_FRONTEND_URL=${viteUrl} npm run demo:artifact-freshness:test\n`);
    process.exit(1);
  }
}

if (!viteAlreadyRunning) {
  startChild("vite", "npx", ["vite", "--host", "127.0.0.1"]);
}

if (!runtimeAlreadyRunning) {
  startChild("runtime", "npx", ["tsx", "scripts/local-runtime-api-server.mts"]);
}

// Keep the wrapper alive even when both services were already running.
keepAlive = setInterval(() => undefined, 60_000);

console.log("Vibe Director Studio — dev servers:");
console.log(`  Vite dev server  → ${viteUrl} ${viteAlreadyRunning ? "(already running, fresh)" : "(starting)"}`);
console.log(`  Runtime API      → ${runtimeUrl} ${runtimeAlreadyRunning ? "(already running)" : "(starting)"}`);
console.log("Press Ctrl+C to stop servers started by this command.\n");
