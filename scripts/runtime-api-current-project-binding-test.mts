import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync as fsWriteFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mts";
import { createRuntimeApiCurrentProjectBinding } from "./runtime-api-current-project-binding.mts";

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

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "vibe-current-project-binding-"));
const repoRoot = path.join(workingRoot, "repo");
const projectRoot = path.join(repoRoot, "projects/current");
const projectVibePath = path.join(projectRoot, "project/project.vibe");
const externalProjectRoot = path.join(workingRoot, "external/selected-project");
const externalProjectVibePath = path.join(externalProjectRoot, "project/project.vibe");
const bindingPath = path.join(workingRoot, "runtime/current-project.local.json");
const fixedNow = "2026-05-10T01:02:03.004Z";

mkdirSync(path.dirname(projectVibePath), { recursive: true });
fsWriteFileSync(projectVibePath, JSON.stringify({
  schemaVersion: "project_vibe_test_v1",
  projectId: "current_project_binding_test",
  manifest: { title: "Creator Facing Current Project" },
  runId: "run_current_project_binding_test",
  roleIds: ["r1"],
  sceneIds: ["s1"],
}, null, 2), "utf8");
mkdirSync(path.dirname(externalProjectVibePath), { recursive: true });
fsWriteFileSync(externalProjectVibePath, JSON.stringify({
  schemaVersion: "project_vibe_test_v1",
  projectId: "external_current_project_binding_test",
  manifest: { title: "External Creator Project" },
  runId: "run_external_current_project_binding_test",
  roleIds: ["external-r1"],
  sceneIds: ["external-s1"],
}, null, 2), "utf8");

const boundary = createRuntimeApiBoundary({
  repoRoot,
  repoRootRealPath: realpathSync(repoRoot),
});

const baseDeps = {
  repoRoot,
  sandboxRunRootRelativePath: "projects/current",
  knownProjectFixtureRoots: [],
  round5FullRealChainReportFileName: "round5_full_real_chain_report.json",
  currentProjectBindingEndpoint: "/api/runtime/projects/current",
  currentProjectSelectEndpoint: "/api/runtime/projects/select",
  currentProjectRecentEndpoint: "/api/runtime/projects/recent",
  currentProjectBindingPathInput: () => bindingPath,
  resolveRepoInputPath: boundary.resolveRepoInputPath,
  repoRelativePath: boundary.repoRelativePath,
  pathWithinRoot: boundary.pathWithinRoot,
  runtimePolicy: boundary.runtimePolicy,
  normalizeRelativePath: boundary.normalizeRelativePath,
  readJsonIfPresent,
  existsSync,
  statSync,
  mkdirSync,
  writeFileSync: fsWriteFileSync,
  now: () => new Date(fixedNow),
};

try {
  assertThrows(() => createRuntimeApiCurrentProjectBinding({ ...baseDeps, repoRoot: "" }), "repoRoot should be required");
  assertThrows(() => createRuntimeApiCurrentProjectBinding({ ...baseDeps, runtimePolicy: undefined }), "runtimePolicy should be required");

  const unboundApi = createRuntimeApiCurrentProjectBinding(baseDeps);
  const unboundStatus = unboundApi.currentProjectBindingStatusResponse();
  assert(unboundStatus.status === "unbound", "status response should fail closed when no binding exists");
  assert(unboundStatus.currentProject?.bound === false, "unbound status must not expose a bound project");
  assert(unboundStatus.liveSubmitAllowed === false, "unbound status should hard-lock live submit");
  assert(unboundStatus.dryRunOnly === true, "unbound status should stay dry-run only");
  assert(unboundStatus.workerSpawnForbidden === true, "unbound status should forbid worker spawn");

  const unboundBlocked = unboundApi.unboundCurrentProjectResponse("/api/runtime/projects/current/real-chain/status", {
    projectRoot: "projects/current",
    projectRootSource: "query",
    projectId: "ignored",
    projectIdSource: "header",
  });
  assert(unboundBlocked.status === "unbound", "unbound project response status mismatch");
  assert(unboundBlocked.productionStatus === "blocked", "unbound response should block production");
  assert(unboundBlocked.projectVibeWritten === false, "unbound response must not imply project.vibe writes");
  assert(unboundBlocked.providerCalled === false, "unbound response must not imply provider calls");
  assert(unboundBlocked.prepareRan === false, "unbound response must not imply prepare runs");
  assert(unboundBlocked.requestContext.ignoredProjectRootProvided === true, "unbound response should report ignored root override");
  assert(unboundBlocked.projectRoot === undefined && unboundBlocked.projectId === undefined, "unbound response must not bind request identity");

  const writes = [];
  const selectApi = createRuntimeApiCurrentProjectBinding({
    ...baseDeps,
    writeFileSync(filePath, contents, encoding) {
      writes.push(filePath);
      return fsWriteFileSync(filePath, contents, encoding);
    },
  });

  const projectVibeBefore = readFileSync(projectVibePath, "utf8");
  const selected = selectApi.selectCurrentProjectBindingResponse({
    project: {
      projectRoot: "projects/current",
      projectId: "current_project_binding_test",
      displayName: "Current Binding Test",
    },
  });
  const projectVibeAfter = readFileSync(projectVibePath, "utf8");

  assert(selected.statusCode === 200, "select response should succeed for repo-local project");
  assert(selected.payload.status === "bound", "select response status mismatch");
  assert(selected.payload.currentProject.project.title === "Creator Facing Current Project", "select response should expose Project.vibe manifest title");
  assert(selected.payload.currentProject.binding.selectedAt === fixedNow, "select response should use injected now()");
  assert(selected.payload.currentProject.bindingPath === bindingPath, "external binding path should be reported without repo-relative coercion");
  assert(selected.payload.projectVibeWritten === false, "select response should keep projectVibeWritten=false");
  assert(selected.payload.providerCalled === false, "select response should not call providers");
  assert(selected.payload.prepareRan === false, "select response should not run prepare");
  assert(selected.payload.liveSubmitAllowed === false, "select response should hard-lock live submit");
  assert(selected.payload.dryRunOnly === true, "select response should stay dry-run only");
  assert(selected.payload.workerSpawnForbidden === true, "select response should forbid worker spawn");
  assert(writes.length === 1 && writes[0] === bindingPath, "select should only write the runtime binding file");
  assert(projectVibeAfter === projectVibeBefore, "select must not mutate project.vibe");

  const binding = readJsonIfPresent(bindingPath);
  assert(binding.selectedAt === fixedNow, "persisted binding should use injected now()");
  assert(binding.projectRoot === "projects/current", "persisted binding should store repo-relative project root");

  const cleared = selectApi.clearCurrentProjectBindingResponse();
  const clearedBinding = readJsonIfPresent(bindingPath);
  assert(cleared.statusCode === 200, "clear response should succeed");
  assert(cleared.payload.status === "unbound", "clear response status mismatch");
  assert(cleared.payload.currentProject.bound === false, "clear response must leave project unbound");
  assert(cleared.payload.projectVibeWritten === false, "clear response must not mutate project.vibe");
  assert(cleared.payload.providerCalled === false, "clear response must not call providers");
  assert(clearedBinding.status === "cleared", "persisted clear marker should be explicit");
  assert(!clearedBinding.projectRoot, "persisted clear marker must not keep a project root");
  assert(readFileSync(projectVibePath, "utf8") === projectVibeBefore, "clear must not mutate project.vibe");

  const blockedExternal = selectApi.selectCurrentProjectBindingResponse({
    projectRoot: externalProjectRoot,
    projectId: "external_current_project_binding_test",
    displayName: "Blocked External",
  });
  assert(blockedExternal.statusCode === 403, "external project roots must stay blocked without explicit allowance");

  const externalBoundary = createRuntimeApiBoundary({
    repoRoot,
    repoRootRealPath: realpathSync(repoRoot),
    allowedProjectRootInputs: () => [externalProjectRoot],
  });
  const externalApi = createRuntimeApiCurrentProjectBinding({
    ...baseDeps,
    resolveRepoInputPath: externalBoundary.resolveRepoInputPath,
    repoRelativePath: externalBoundary.repoRelativePath,
    pathWithinRoot: externalBoundary.pathWithinRoot,
  });
  const externalSelected = externalApi.selectCurrentProjectBindingResponse({
    projectRoot: externalProjectRoot,
    projectId: "external_current_project_binding_test",
    displayName: "External Current Binding Test",
  });
  assert(externalSelected.statusCode === 200, `explicitly allowed external project root should bind: ${JSON.stringify(externalSelected.payload)}`);
  assert(externalSelected.payload.currentProject.project.projectId === "external_current_project_binding_test", "external project identity should be read from Project.vibe");
  assert(externalSelected.payload.currentProject.project.title === "External Creator Project", "external project title should be read from Project.vibe");
  assert(externalSelected.payload.currentProject.projectRoot === externalProjectRoot, "external binding should keep an absolute project root");
  const externalBinding = readJsonIfPresent(bindingPath);
  assert(externalBinding.projectRoot === externalProjectRoot, "external binding should persist the absolute selected root");
} finally {
  rmSync(workingRoot, { recursive: true, force: true });
}

console.log("runtime-api-current-project-binding-test: ok");
