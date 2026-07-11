import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createProjectRootScope, spawnAllowed } from "../electron/projectScope.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function throws(fn: () => unknown, pattern: RegExp, message: string) {
  try {
    fn();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    assert(pattern.test(text), `${message}: ${text}`);
    return;
  }
  throw new Error(`FAIL: ${message}`);
}

const parent = await mkdtemp(path.join(tmpdir(), "vibe-electron-scope-"));
const projectRoot = path.join(parent, "project");
const outsideRoot = path.join(parent, "outside");

try {
  await mkdir(projectRoot, { recursive: true });
  await mkdir(outsideRoot, { recursive: true });
  await writeFile(path.join(projectRoot, "project.vibe"), "inside", "utf8");
  await writeFile(path.join(outsideRoot, "project.vibe"), "outside", "utf8");
  await symlink(outsideRoot, path.join(projectRoot, "outside-link"), "dir");
  await symlink(path.join(outsideRoot, "project.vibe"), path.join(projectRoot, "outside-file-link"), "file");

  const projectRootAlias = path.join(parent, "project-alias");
  await symlink(projectRoot, projectRootAlias, "dir");
  const aliasScope = createProjectRootScope();
  const canonicalAliasRoot = aliasScope.rememberProjectRoot(projectRootAlias);
  assert(canonicalAliasRoot === await realpath(projectRoot), "a symlink project root should authorize only its canonical directory");
  assert(aliasScope.roots().length === 1 && aliasScope.roots()[0] === canonicalAliasRoot, "authorized root export should contain only canonical roots");
  assert(aliasScope.resolveOpenedProjectPath(path.join(projectRootAlias, "project.vibe"), "sandbox:readFile") === path.join(projectRootAlias, "project.vibe"), "files reached through an authorized project-root alias should remain usable");

  const scope = createProjectRootScope();
  const insideProjectVibe = path.join(projectRoot, "project.vibe");
  const nestedInside = path.join(projectRoot, "exports/current/report.md");
  const outsidePath = path.join(outsideRoot, "project.vibe");

  throws(
    () => scope.resolveOpenedProjectPath(insideProjectVibe, "sandbox:readFile"),
    /opened project folder/,
    "unopened project path must fail closed",
  );

  const remembered = scope.rememberProjectRoot(projectRoot);
  assert(remembered === await realpath(projectRoot), "remembered root should be canonicalized");
  assert(scope.resolveAuthorizedProjectRoot(projectRoot, "project:remember") === remembered, "already-authorized project root should resolve");
  assert(scope.resolveOpenedProjectPath(insideProjectVibe, "sandbox:readFile") === path.resolve(insideProjectVibe), "root file should be allowed");
  assert(scope.resolveOpenedProjectPath(nestedInside, "sandbox:writeFile") === path.resolve(nestedInside), "nested root file should be allowed");
  assert(scope.findRoot(nestedInside) === remembered, "findRoot should return the remembered project root");
  throws(
    () => scope.resolveAuthorizedProjectRoot(outsideRoot, "project:remember"),
    /authorized project folder/,
    "an arbitrary existing directory must not become authorized through restore",
  );
  throws(
    () => scope.resolveAuthorizedProjectRoot(path.join(projectRoot, "exports"), "project:remember"),
    /authorized project folder/,
    "a nested path must not be promoted to a new project root",
  );
  throws(
    () => scope.resolveOpenedProjectPath(outsidePath, "sandbox:writeFile"),
    /opened project folder/,
    "outside project file must fail closed",
  );
  throws(
    () => scope.resolveOpenedProjectPath(path.join(projectRoot, "..", "outside", "escape.txt"), "sandbox:readFile"),
    /opened project folder/,
    "parent traversal escape must fail closed after resolution",
  );
  throws(
    () => scope.resolveOpenedProjectPath(path.join(projectRoot, "outside-file-link"), "sandbox:readFile"),
    /opened project folder/,
    "existing file symlinks must not escape the project root",
  );
  throws(
    () => scope.resolveOpenedProjectPath(path.join(projectRoot, "outside-link", "project.vibe"), "sandbox:readFile"),
    /opened project folder/,
    "existing directory symlinks must not escape the project root",
  );
  throws(
    () => scope.resolveOpenedProjectPath(path.join(projectRoot, "outside-link", "new-export.mp4"), "sandbox:writeFile"),
    /opened project folder/,
    "nonexistent write targets below an escaping symlink parent must fail closed",
  );

  assert(spawnAllowed("node", ["--version"]), "node --version should be allowed");
  assert(spawnAllowed("/usr/local/bin/npm", ["-v"]), "npm -v should be allowed");
  assert(!spawnAllowed("node", ["script.js"]), "node script execution should be blocked");
  assert(!spawnAllowed("bash", ["-lc", "echo hi"]), "shell execution should be blocked");
  assert(!spawnAllowed("npx", ["tsx", "scripts/local-runtime-api-server.mts"]), "npx tsx execution should be blocked through bridge");

  assert(scope.forgetProjectRoot(projectRoot) === true, "forget should report a remembered project root");
  throws(
    () => scope.resolveOpenedProjectPath(insideProjectVibe, "sandbox:readFile"),
    /opened project folder/,
    "forgotten project path must fail closed",
  );
  assert(scope.findRoot(nestedInside) === undefined, "findRoot should not return forgotten roots");
  assert(scope.forgetProjectRoot(projectRoot) === false, "forget should report false for unknown project root");

  console.log("electron-project-scope-test: ok");
} finally {
  await rm(parent, { recursive: true, force: true });
}
