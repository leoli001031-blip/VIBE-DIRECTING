import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendLocalProjectVibeRunReceipt,
  createLocalProjectVibeWorkspace,
  openLocalProjectVibe,
  resolveLocalProjectVibeFilePath,
  saveLocalProjectVibe,
} from "../src/project/localProjectVibeStorage.ts";
import { createProjectVibe, hashProjectVibeFacts, type ProjectVibeDocument } from "../src/project/index.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertOpenProject(project: ProjectVibeDocument | undefined): ProjectVibeDocument {
  assert(project !== undefined, "opened project missing");
  return project;
}

function assertNoAtomicTempFiles(root: string): void {
  const leftovers = readdirSync(root).filter((entry) => entry.includes(".tmp-"));
  assert(leftovers.length === 0, `atomic Project.vibe write left temp files: ${leftovers.join(", ")}`);
}

const projectRoot = mkdtempSync(join(tmpdir(), "project-vibe-local-persistence-"));

try {
  const workspace = createLocalProjectVibeWorkspace(projectRoot);
  const resolvedProjectVibePath = resolveLocalProjectVibeFilePath(projectRoot);
  assert(workspace.projectPath === "project.vibe", "workspace should default to project.vibe");
  assert(workspace.projectFilePath === resolvedProjectVibePath, "workspace project file path drifted");
  assert(resolvedProjectVibePath === join(projectRoot, "project.vibe"), "project.vibe should resolve under project root");

  const created = createProjectVibe({
    projectId: "local_persistence_project",
    title: "Local Persistence Project",
    createdAt: "2026-05-15T03:00:00.000Z",
    updatedAt: "2026-05-15T03:00:00.000Z",
  });
  const createdFactHash = hashProjectVibeFacts(created);

  const saveCreated = await saveLocalProjectVibe(projectRoot, created);
  assert(saveCreated.ok, `initial save failed: ${saveCreated.errors.join("; ")}`);
  assert(existsSync(resolvedProjectVibePath), "project.vibe should be written to disk");
  assertNoAtomicTempFiles(projectRoot);
  assert(saveCreated.factHash === createdFactHash, "initial save factHash drifted");

  const openedCreated = await openLocalProjectVibe(projectRoot);
  assert(openedCreated.ok, `initial open failed: ${openedCreated.errors.join("; ")}`);
  const openedCreatedProject = assertOpenProject(openedCreated.project);
  assert(hashProjectVibeFacts(openedCreatedProject) === createdFactHash, "opened project factHash drifted");
  assert(sameJson(openedCreatedProject.sourceIndex, created.sourceIndex), "opened sourceIndex drifted after initial save");
  assert(openedCreatedProject.runs.length === 0, "created project should start without run receipts");

  const appendResult = await appendLocalProjectVibeRunReceipt({
    projectRoot,
    run: {
      id: "run_local_persistence_001",
      runKind: "agent_loop",
      status: "succeeded",
      createdAt: "2026-05-15T03:05:00.000Z",
      summary: "Recorded a local Project.vibe persistence roundtrip without provider execution.",
      sourceFactHash: createdFactHash,
      affectedShotIds: [],
      producedAssetIds: [],
      evidenceRefs: ["project.vibe#manifest"],
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    },
    transaction: {
      id: "txn_local_persistence_append_run_001",
      actor: "agent_loop",
      reason: "Append a local persistence run receipt.",
      createdAt: "2026-05-15T03:05:00.000Z",
    },
  });

  assert(appendResult.ok, `append run failed: ${appendResult.errors.join("; ")}`);
  assertNoAtomicTempFiles(projectRoot);
  assert(appendResult.factHashBefore === createdFactHash, "append source factHash should match the opened facts");
  assert(appendResult.factHashAfter !== undefined, "append result should expose saved factHash");
  assert(appendResult.factHashAfter !== createdFactHash, "append run should advance the Project.vibe factHash via sourceIndex");
  assert(appendResult.patchResult?.project.runs.length === 1, "append patch should carry one run receipt");
  assert(
    appendResult.patchResult?.project.sourceIndex.runReceiptRefs.includes("project.vibe#runs/run_local_persistence_001") === true,
    "append patch should refresh run receipt sourceIndex refs",
  );

  const reopenedAfterAppend = await openLocalProjectVibe(projectRoot);
  assert(reopenedAfterAppend.ok, `reopen after append failed: ${reopenedAfterAppend.errors.join("; ")}`);
  const reopenedAfterAppendProject = assertOpenProject(reopenedAfterAppend.project);
  assert(hashProjectVibeFacts(reopenedAfterAppendProject) === appendResult.factHashAfter, "reopened factHash drifted after append");
  assert(reopenedAfterAppendProject.runs.length === 1, "reopened project should persist one run receipt");
  assert(reopenedAfterAppendProject.runs[0]?.sourceFactHash === createdFactHash, "run sourceFactHash drifted after reopen");
  assert(
    reopenedAfterAppendProject.sourceIndex.runReceiptRefs[0] === "project.vibe#runs/run_local_persistence_001",
    "reopened sourceIndex should include the persisted run receipt ref",
  );
  assert(
    sameJson(reopenedAfterAppendProject.sourceIndex, appendResult.patchResult?.project.sourceIndex),
    "sourceIndex drifted between append save and reopen",
  );
  assert(sameJson(reopenedAfterAppendProject.runs, appendResult.patchResult?.project.runs), "runs drifted between append save and reopen");

  let escapedPathBlocked = false;
  try {
    createLocalProjectVibeWorkspace(projectRoot, "../escape/project.vibe");
  } catch {
    escapedPathBlocked = true;
  }
  assert(escapedPathBlocked, "local Project.vibe workspace must block paths outside project root");

  console.log(
    `Project.vibe local persistence tests passed: root=${projectRoot}, initial=${createdFactHash}, after=${appendResult.factHashAfter}, runs=${reopenedAfterAppendProject.runs.length}.`,
  );
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}
