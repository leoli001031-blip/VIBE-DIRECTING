import { spawn } from "node:child_process";
import path from "node:path";

const electronBuilderBin = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
);

function withNoDeprecation(nodeOptions: string | undefined) {
  const parts = (nodeOptions || "").split(/\s+/).filter(Boolean);
  return parts.includes("--no-deprecation") ? parts.join(" ") : [...parts, "--no-deprecation"].join(" ");
}

const args = process.argv.slice(2);
const child = spawn(electronBuilderBin, args.length ? args : ["--mac"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_OPTIONS: withNoDeprecation(process.env.NODE_OPTIONS),
  },
  stdio: "inherit",
});

const code = await new Promise<number | null>((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", resolve);
});

process.exit(code || 0);
