import { spawn, type ChildProcess } from "node:child_process";

const children: ChildProcess[] = [];

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
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const vite = spawn("npx", ["vite", "--host", "127.0.0.1"], {
  stdio: "pipe",
});
children.push(vite);
prefix("stdout", "vite", vite);

const runtime = spawn("npx", ["tsx", "scripts/local-runtime-api-server.mts"], {
  stdio: "pipe",
});
children.push(runtime);
prefix("stdout", "runtime", runtime);

console.log("Vibe Director Studio — starting both servers:");
console.log("  Vite dev server  → http://127.0.0.1:5174");
console.log("  Runtime API      → http://127.0.0.1:8790");
console.log("Press Ctrl+C to stop both.\n");

vite.on("close", (code) => {
  if (code !== null && code !== 0) {
    console.error(`[vite] exited with code ${code}`);
  }
  cleanup();
});

runtime.on("close", (code) => {
  if (code !== null && code !== 0) {
    console.error(`[runtime] exited with code ${code}`);
  }
  cleanup();
});
