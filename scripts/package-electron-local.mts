import { spawn } from "node:child_process";
import path from "node:path";

const electronBuilderBin = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
);

const args = process.argv.slice(2);
const builderArgs = args.length ? args : ["--dir"];

function withNoDeprecation(nodeOptions: string | undefined) {
  const parts = (nodeOptions || "").split(/\s+/).filter(Boolean);
  return parts.includes("--no-deprecation") ? parts.join(" ") : [...parts, "--no-deprecation"].join(" ");
}

function hasConfigArg(prefix: string) {
  return builderArgs.some((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
}

const finalArgs = [...builderArgs];
if (process.platform === "darwin" && !hasConfigArg("--config.mac.identity")) {
  finalArgs.push("--config.mac.identity=-");
}
if (process.platform === "darwin" && !hasConfigArg("--config.mac.notarize")) {
  finalArgs.push("--config.mac.notarize=false");
}

const suppressedLinePatterns = [
  /\[DEP0190\]/,
  /skipped macOS notarization\s+reason=`notarize` options were set explicitly `false`/,
];

function pipeFiltered(stream: NodeJS.ReadableStream, target: NodeJS.WriteStream) {
  let buffer = "";
  stream.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (suppressedLinePatterns.some((pattern) => pattern.test(line))) continue;
      target.write(`${line}\n`);
    }
  });
  stream.on("end", () => {
    if (!buffer) return;
    if (!suppressedLinePatterns.some((pattern) => pattern.test(buffer))) target.write(`${buffer}\n`);
  });
}

const child = spawn(electronBuilderBin, finalArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_OPTIONS: withNoDeprecation(process.env.NODE_OPTIONS),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

pipeFiltered(child.stdout, process.stdout);
pipeFiltered(child.stderr, process.stderr);

const code = await new Promise<number | null>((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", resolve);
});

if (code !== 0) {
  process.exit(code || 1);
}

if (process.platform === "darwin") {
  console.log("electron-builder-local: ok (local ad-hoc signing, notarization intentionally outside smoke)");
} else {
  console.log("electron-builder-local: ok");
}
