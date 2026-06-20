import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

import { runSeedanceLivePreflight, type JsonRecord } from "./seedance-live-preflight-core.mts";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonOptional(filePath: string): JsonRecord | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function commandExists(command: string) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function argValue(name: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() || "";
}

const requestedDuration = Number(argValue("duration-seconds"));
const report = runSeedanceLivePreflight({
  durationSeconds: Number.isFinite(requestedDuration) ? requestedDuration : undefined,
  modelVersion: argValue("model-version") || undefined,
  projectRootInput: argValue("project-root") || undefined,
  repoRoot: process.cwd(),
  selectedShotId: argValue("selected-shot-id") || undefined,
  videoResolution: argValue("video-resolution") || undefined,
}, {
  commandExists,
  env: process.env,
  exists: existsSync,
  fileSize: (filePath) => {
    try {
      return statSync(filePath).size;
    } catch {
      return 0;
    }
  },
  homeDir: homedir(),
  readJsonOptional,
});

console.log(JSON.stringify(report, null, 2));
