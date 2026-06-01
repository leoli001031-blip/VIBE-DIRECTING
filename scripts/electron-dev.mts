import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import electronPath from "electron";
import { build } from "esbuild";

const appRoot = process.cwd();
const outDir = path.join(appRoot, ".electron-dev");
const mainOut = path.join(outDir, "main.mjs");
const preloadOut = path.join(outDir, "preload.cjs");
const devUrl = process.env.VIBE_ELECTRON_DEV_URL || "http://127.0.0.1:5174";

mkdirSync(outDir, { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(appRoot, "electron", "main.mts")],
    outfile: mainOut,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["electron"],
  }),
  build({
    entryPoints: [path.join(appRoot, "electron", "preload.mts")],
    outfile: preloadOut,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
  }),
  build({
    entryPoints: [path.join(appRoot, "scripts", "local-runtime-api-server.mts")],
    outfile: path.join(appRoot, "electron-runtime", "local-runtime-api-server.mjs"),
    bundle: true,
    minify: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: false,
    logLevel: "silent",
  }),
]);

const electronBinary = String(electronPath);
const child = spawn(electronBinary, [mainOut], {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    VIBE_ELECTRON_APP_ROOT: appRoot,
    VIBE_ELECTRON_PRELOAD: preloadOut,
    VIBE_ELECTRON_DEV_URL: devUrl,
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
