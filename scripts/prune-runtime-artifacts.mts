import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Candidate = {
  label: string;
  path: string;
  bytes: number;
  reason: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const args = new Set(process.argv.slice(2));
const confirmed = args.has("--confirm=prune-runtime-artifacts");
const includeUvCache = args.has("--include-uv-cache");
const all = args.has("--all");
const json = args.has("--json");

function argValue(name: string) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function safeNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const maxAgeHours = safeNumber(argValue("--max-age-hours"), 72);
const now = Date.now();

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function insideRepo(targetPath: string) {
  const resolved = path.resolve(targetPath);
  return resolved === repoRoot || resolved.startsWith(`${repoRoot}${path.sep}`);
}

function entryAgeHours(stats: fs.Stats) {
  return (now - stats.mtimeMs) / 3_600_000;
}

function directorySize(targetPath: string): number {
  const stats = fs.lstatSync(targetPath);
  if (stats.isSymbolicLink()) return 0;
  if (!stats.isDirectory()) return stats.size;
  let total = 0;
  for (const entry of fs.readdirSync(targetPath)) {
    total += directorySize(path.join(targetPath, entry));
  }
  return total;
}

function collectChildren(rootRelativePath: string, label: string): Candidate[] {
  const root = path.join(repoRoot, rootRelativePath);
  if (!fs.existsSync(root)) return [];
  const candidates: Candidate[] = [];
  for (const entry of fs.readdirSync(root)) {
    const fullPath = path.join(root, entry);
    const stats = fs.lstatSync(fullPath);
    if (stats.isSymbolicLink()) continue;
    const ageHours = entryAgeHours(stats);
    if (!all && ageHours < maxAgeHours) continue;
    candidates.push({
      label,
      path: fullPath,
      bytes: directorySize(fullPath),
      reason: all ? "explicit --all" : `older than ${maxAgeHours}h`,
    });
  }
  return candidates;
}

function collectRoot(rootRelativePath: string, label: string, reason: string): Candidate[] {
  const fullPath = path.join(repoRoot, rootRelativePath);
  if (!fs.existsSync(fullPath)) return [];
  const stats = fs.lstatSync(fullPath);
  if (stats.isSymbolicLink()) return [];
  return [{
    label,
    path: fullPath,
    bytes: directorySize(fullPath),
    reason,
  }];
}

const candidates = [
  ...collectChildren("real-test-sandbox", "real test runs"),
  ...collectChildren("test_artifacts", "test artifacts"),
  ...collectChildren("tmp", "temporary demo files"),
  ...(includeUvCache ? collectRoot(".vibe-runtime/uv-cache", "uv cache", "regenerable dependency cache") : []),
].filter((candidate) => candidate.bytes > 0);

for (const candidate of candidates) {
  if (!insideRepo(candidate.path)) {
    throw new Error(`Refusing to prune outside repo: ${candidate.path}`);
  }
}

const totalBytes = candidates.reduce((sum, candidate) => sum + candidate.bytes, 0);

if (confirmed) {
  for (const candidate of candidates) {
    fs.rmSync(candidate.path, { recursive: true, force: true });
  }
}

if (json) {
  console.log(JSON.stringify({
    dryRun: !confirmed,
    includeUvCache,
    all,
    maxAgeHours,
    totalBytes,
    total: formatBytes(totalBytes),
    candidates: candidates.map((candidate) => ({
      ...candidate,
      relativePath: path.relative(repoRoot, candidate.path),
      size: formatBytes(candidate.bytes),
    })),
  }, null, 2));
} else {
  console.log(`${confirmed ? "pruned" : "dry-run"} ${candidates.length} item(s), ${formatBytes(totalBytes)} total.`);
  for (const candidate of candidates.slice(0, 30)) {
    console.log(`- ${formatBytes(candidate.bytes)} ${path.relative(repoRoot, candidate.path)} (${candidate.label}, ${candidate.reason})`);
  }
  if (candidates.length > 30) console.log(`... ${candidates.length - 30} more item(s)`);
  if (!confirmed) {
    const applyCommand = includeUvCache ? "runtime:prune:caches:apply" : "runtime:prune:apply";
    console.log(`Run ${applyCommand} to delete these artifacts.`);
  }
}
