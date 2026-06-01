import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function waitForServer(child: ReturnType<typeof spawn>) {
  return new Promise<{ baseUrl: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for bundled runtime server. stdout=${stdout} stderr=${stderr}`)),
      15000,
    );
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
          return;
        } catch {
          // Wait for a complete line.
        }
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Bundled runtime server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function stopServer(child: ReturnType<typeof spawn>) {
  if (!child || child.killed) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
  });
}

const bundlePath = "electron-runtime/local-runtime-api-server.mjs";
assert(existsSync(bundlePath), "electron runtime bundle must exist before bundle smoke");
const bundleSource = readFileSync(bundlePath, "utf8");
assert(!bundleSource.includes("tsx/esm/api"), "electron runtime bundle must not depend on tsx register");
assert(!bundleSource.includes("await import(\"./local-runtime-api-server.mts\")"), "electron runtime bundle must not import the .mts source wrapper");

const child = spawn(process.execPath, [bundlePath], {
  cwd: process.cwd(),
  env: { ...process.env, VIBE_CORE_RUNTIME_API_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const { baseUrl } = await waitForServer(child);
  const response = await fetch(`${baseUrl}/api/runtime/status`);
  assert(response.status === 200, "bundled runtime status endpoint should respond");
  const payload = await response.json();
  assert(payload.providerCalled === false, "bundled runtime status must not imply provider calls");
  assert(payload.liveSubmitAllowed === false, "bundled runtime status must keep live submit blocked");
  console.log("electron-runtime-bundle-test: ok");
} finally {
  await stopServer(child);
}
