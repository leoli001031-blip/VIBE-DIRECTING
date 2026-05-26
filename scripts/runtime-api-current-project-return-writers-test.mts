import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiCurrentProjectReturnWriters } from "./runtime-api-current-project-return-writers.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function normalizeRelativePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function scopedRepoPath(repoRoot, relativePath) {
  const candidate = path.resolve(repoRoot, relativePath || "");
  const rootWithSep = `${repoRoot}${path.sep}`;
  if (candidate !== repoRoot && !candidate.startsWith(rootWithSep)) {
    throw new Error(`Path escapes project root: ${relativePath}`);
  }
  return candidate;
}

function oneShotPathInsideRoot(candidatePath, rootPath) {
  if (typeof candidatePath !== "string" || !candidatePath.trim()) return false;
  if (typeof rootPath !== "string" || !rootPath.trim()) return false;
  const normalizedPath = normalizeRelativePath(candidatePath.trim());
  const normalizedRoot = normalizeRelativePath(rootPath.trim());
  if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) return false;
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  if (!candidatePath || !rootPath) return false;
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-return-writers-"));
const repoRoot = path.join(workingRoot, "repo");
const outsideRoot = path.join(workingRoot, "outside");
const sandboxRoot = "sandbox";
const shotRoot = "sandbox/shots/A01";
const runRootRelativePath = "runs/current";

mkdirSync(path.join(repoRoot, shotRoot), { recursive: true });
mkdirSync(path.join(repoRoot, runRootRelativePath), { recursive: true });
mkdirSync(outsideRoot, { recursive: true });
writeFileSync(path.join(outsideRoot, "outside.json"), "{}\n", "utf8");

const writers = createRuntimeApiCurrentProjectReturnWriters({
  repoRootRealPath: realpathSync(repoRoot),
  scopedRepoPath: (relativePath) => scopedRepoPath(repoRoot, relativePath),
  normalizeRelativePath,
  oneShotPathInsideRoot,
  isPathInsideRealRoot,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
});

writers.writeOneShotExecutorJson(`${shotRoot}/state/provider_observation.json`, { ok: true }, sandboxRoot, shotRoot);
writers.writeOneShotExecutorBytes(`${shotRoot}/outputs/start.png`, Buffer.from("png-bytes"), sandboxRoot, shotRoot);
assert(JSON.parse(readFileSync(path.join(repoRoot, shotRoot, "state/provider_observation.json"), "utf8")).ok === true, "one-shot json write should persist payload");
assert(readFileSync(path.join(repoRoot, shotRoot, "outputs/start.png"), "utf8") === "png-bytes", "one-shot bytes write should persist bytes");
assert(writers.oneShotExecutorPathInsideSandbox(`${shotRoot}/outputs/start.png`, sandboxRoot, shotRoot) === true, "one-shot output should be inside sandbox and shot root");
assert(writers.oneShotExecutorPathInsideSandbox(`${sandboxRoot}/other/start.png`, sandboxRoot, shotRoot) === false, "non-shot output should fail inside check");

assertThrows(() => writers.assertOneShotExecutorSandboxWritePath("../escape.json", sandboxRoot, shotRoot), "one-shot path escape should be rejected");
assertThrows(() => writers.assertOneShotExecutorSandboxWritePath(`${sandboxRoot}/other/file.json`, sandboxRoot, shotRoot), "one-shot writes outside shot root should be rejected");
assertThrows(() => writers.assertOneShotExecutorSandboxWritePath(`${shotRoot}/project/project.vibe`, sandboxRoot, shotRoot), "one-shot project.vibe writes should be rejected");
symlinkSync(path.join(outsideRoot, "outside.json"), path.join(repoRoot, shotRoot, "unsafe-link.json"));
assertThrows(() => writers.assertOneShotExecutorSandboxWritePath(`${shotRoot}/unsafe-link.json`, sandboxRoot, shotRoot), "one-shot unsafe symlink overwrite should be rejected");

const source = {
  runRootRelativePath,
  runRootPath: path.join(repoRoot, runRootRelativePath),
};
writers.writeCurrentProjectRuntimeJson(`${runRootRelativePath}/reports/provider_observation.json`, { status: "ok" }, source);
writers.writeCurrentProjectRuntimeBytes(`${runRootRelativePath}/outputs/end.png`, Buffer.from("end-bytes"), source);
assert(JSON.parse(readFileSync(path.join(repoRoot, runRootRelativePath, "reports/provider_observation.json"), "utf8")).status === "ok", "current project json write should persist payload");
assert(readFileSync(path.join(repoRoot, runRootRelativePath, "outputs/end.png"), "utf8") === "end-bytes", "current project bytes write should persist bytes");
assertThrows(() => writers.assertCurrentProjectRuntimeWritePath(`${runRootRelativePath}/../escape.json`, source), "current project path escape should be rejected");
assertThrows(() => writers.assertCurrentProjectRuntimeWritePath(`${runRootRelativePath}/project/project.vibe`, source), "current project project.vibe writes should be rejected");
assert(existsSync(path.join(repoRoot, runRootRelativePath, "outputs/end.png")), "atomic rename should leave final current project output");
assert(existsSync(path.join(repoRoot, shotRoot, "outputs/start.png")), "atomic rename should leave final one-shot output");

const externalProjectRoot = path.join(workingRoot, "external-project");
mkdirSync(externalProjectRoot, { recursive: true });
const externalSource = {
  runRootRelativePath: externalProjectRoot,
  runRootPath: externalProjectRoot,
};
writers.writeCurrentProjectRuntimeJson(path.join(externalProjectRoot, "provider_observations/assets/asset.json"), { status: "ok" }, externalSource);
writers.writeCurrentProjectRuntimeBytes("assets/generated/short-project-local.png", Buffer.from("external-bytes"), externalSource);
assert(JSON.parse(readFileSync(path.join(externalProjectRoot, "provider_observations/assets/asset.json"), "utf8")).status === "ok", "absolute external current project json write should persist payload");
assert(readFileSync(path.join(externalProjectRoot, "assets/generated/short-project-local.png"), "utf8") === "external-bytes", "short external current project path should resolve inside project root");
assertThrows(() => writers.assertCurrentProjectRuntimeWritePath(path.join(workingRoot, "escape.png"), externalSource), "absolute external path outside project should be rejected");
assertThrows(() => writers.assertCurrentProjectRuntimeWritePath("project/project.vibe", externalSource), "short external project.vibe writes should be rejected");

const serverSource = readFileSync(path.join(process.cwd(), "scripts/local-runtime-api-server.mjs"), "utf8");
const writerSource = readFileSync(path.join(process.cwd(), "scripts/runtime-api-current-project-return-writers.mjs"), "utf8");
for (const name of [
  "oneShotExecutorPathInsideSandbox",
  "assertOneShotExecutorSandboxWritePath",
  "writeOneShotExecutorJson",
  "writeOneShotExecutorBytes",
  "assertCurrentProjectRuntimeWritePath",
  "writeCurrentProjectRuntimeJson",
  "writeCurrentProjectRuntimeBytes",
]) {
  assert(!new RegExp(`function\\s+${name}\\s*\\(`).test(serverSource), `server should not declare ${name}`);
}
for (const forbidden of ["provider submit", "execute-return", "strict-edit", "return ingest"]) {
  assert(!writerSource.toLowerCase().includes(forbidden), `writer module should not contain ${forbidden} semantics`);
}

rmSync(workingRoot, { recursive: true, force: true });
assert(!existsSync(workingRoot), "temp root should be cleaned up");

console.log("runtime-api-current-project-return-writers-test: ok");
