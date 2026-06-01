import { mkdtemp, rm } from "node:fs/promises";
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
  assert(remembered === path.resolve(projectRoot), "remembered root should be resolved");
  assert(scope.resolveOpenedProjectPath(insideProjectVibe, "sandbox:readFile") === path.resolve(insideProjectVibe), "root file should be allowed");
  assert(scope.resolveOpenedProjectPath(nestedInside, "sandbox:writeFile") === path.resolve(nestedInside), "nested root file should be allowed");
  assert(scope.findRoot(nestedInside) === path.resolve(projectRoot), "findRoot should return the remembered project root");
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
