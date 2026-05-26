import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const appRoot = process.cwd();
const outDir = path.join(appRoot, "electron-dist");
const mainOut = path.join(outDir, "main.mjs");
const preloadOut = path.join(outDir, "preload.cjs");

rmSync(outDir, { recursive: true, force: true });
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
]);

console.log("build-electron-app: ok");
