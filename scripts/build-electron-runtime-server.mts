import { mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const appRoot = process.cwd();
const outDir = path.join(appRoot, "electron-runtime");
const outFile = path.join(outDir, "local-runtime-api-server.mjs");

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(appRoot, "scripts", "local-runtime-api-server.mts")],
  outfile: outFile,
  bundle: true,
  minify: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "silent",
});

console.log(`electron-runtime: built ${path.relative(appRoot, outFile)}`);
