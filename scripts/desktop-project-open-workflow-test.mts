import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chooseProjectRoot } from "../src/project/projectRootDialog";
import {
  openLocalProjectVibe,
  resolveLocalProjectVibeFilePath,
  saveLocalProjectVibe,
} from "../src/project/localProjectVibeStorage.ts";
import { createProjectVibe, hashProjectVibeFacts, projectVibeFileName } from "../src/project/index.ts";
import {
  openProjectVibeDraft,
  saveProjectVibeDraft,
} from "../src/project/projectVibeDraftStore";
import type { ProjectVibeDocument, ProjectVibeRunReceipt } from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function installWindowShim(windowShim: unknown) {
  (globalThis as { window?: unknown }).window = windowShim;
}

function assertProject(project: ProjectVibeDocument | undefined, message: string): ProjectVibeDocument {
  assert(project, message);
  return project;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createWorkflowProject(projectId: string): ProjectVibeDocument {
  const run: ProjectVibeRunReceipt = {
    id: "run_desktop_open_001",
    runKind: "qa",
    status: "succeeded",
    createdAt: "2026-05-16T02:00:00.000Z",
    summary: "Desktop project open workflow restored Project.vibe facts.",
    sourceFactHash: "initial_desktop_open_source",
    affectedShotIds: ["S001"],
    producedAssetIds: [],
    evidenceRefs: ["scripts/desktop-project-open-workflow-test.mts"],
    projectFactsMutated: false,
    runtimeFixtureUsed: false,
  };

  return createProjectVibe({
    projectId,
    title: "Desktop Open Workflow",
    createdAt: "2026-05-16T02:00:00.000Z",
    updatedAt: "2026-05-16T02:00:00.000Z",
    storyFlow: {
      id: "story_flow_desktop_open",
      sections: [{
        id: "intro",
        title: "Intro",
        summary: "Open a desktop project root.",
        sequenceIndex: 0,
        shotIds: ["S001"],
      }],
      shotOrder: ["S001"],
    },
    shots: [{
      id: "S001",
      sectionId: "intro",
      title: "Open Project",
      intent: "Verify desktop project open persistence.",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 4,
      status: "planned",
      sourceRefs: ["project.vibe#storyFlow"],
    }],
    runs: [run],
  });
}

const previousWindow = (globalThis as { window?: unknown }).window;
const emptyProjectRoot = mkdtempSync(join(tmpdir(), "desktop-project-open-empty-"));
const bridgeProjectRoot = mkdtempSync(join(tmpdir(), "desktop-project-open-bridge-"));

try {
  installWindowShim({
    vibeRuntime: {
      chooseProjectRoot: async () => ({
        cancelled: false,
        projectRoot: emptyProjectRoot,
        projectPath: projectVibeFileName,
        projectVibePath: resolveLocalProjectVibeFilePath(emptyProjectRoot),
        hasProjectVibe: false,
        displayName: "Desktop Open Empty",
      }),
    },
  });

  const emptySelection = await chooseProjectRoot();
  assert(emptySelection.cancelled === false, "empty project root selection should complete");
  assert(emptySelection.hasProjectVibe === false, "empty project root should report missing project.vibe");
  assert(!existsSync(resolveLocalProjectVibeFilePath(emptyProjectRoot)), "empty project root should start without project.vibe");

  const createdProject = createWorkflowProject("desktop_open_workflow_project");
  const saveCreated = await saveLocalProjectVibe(emptySelection.projectRoot!, createdProject, emptySelection.projectPath);
  assert(saveCreated.ok, `saving project.vibe for empty root failed: ${saveCreated.errors.join("; ")}`);
  assert(existsSync(resolveLocalProjectVibeFilePath(emptyProjectRoot)), "saving empty root should generate project.vibe");

  installWindowShim({
    vibeRuntime: {
      chooseProjectRoot: async () => ({
        cancelled: false,
        projectRoot: emptyProjectRoot,
        projectPath: projectVibeFileName,
        projectVibePath: resolveLocalProjectVibeFilePath(emptyProjectRoot),
        hasProjectVibe: true,
        displayName: "Desktop Open Existing",
      }),
    },
  });

  const existingSelection = await chooseProjectRoot();
  assert(existingSelection.cancelled === false, "existing project root selection should complete");
  assert(existingSelection.hasProjectVibe === true, "existing project root should report project.vibe");

  const reopened = await openLocalProjectVibe(existingSelection.projectRoot!, existingSelection.projectPath);
  assert(reopened.ok, `opening existing project.vibe failed: ${reopened.errors.join("; ")}`);
  const reopenedProject = assertProject(reopened.project, "existing project.vibe should restore a project");
  assert(reopenedProject.manifest.projectId === createdProject.manifest.projectId, "projectId should survive reopen");
  assert(sameJson(reopenedProject.sourceIndex, createdProject.sourceIndex), "sourceIndex should survive reopen");
  assert(sameJson(reopenedProject.runs, createdProject.runs), "runs should survive reopen");
  assert(hashProjectVibeFacts(reopenedProject) === hashProjectVibeFacts(createdProject), "fact hash should survive reopen");

  const bridgeFiles = new Map<string, string>();
  installWindowShim({
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
    vibeRuntime: {
      chooseProjectRoot: async () => ({
        cancelled: false,
        projectRoot: bridgeProjectRoot,
        projectPath: projectVibeFileName,
        projectVibePath: resolveLocalProjectVibeFilePath(bridgeProjectRoot),
        hasProjectVibe: false,
        displayName: "Desktop Open Bridge",
      }),
      sandboxReadFile: async (filePath: string) => {
        const content = bridgeFiles.get(filePath);
        if (content == null) throw new Error(`ENOENT: ${filePath}`);
        return { content, hash: `hash:${content.length}`, path: filePath };
      },
      sandboxWriteFile: async (filePath: string, data: string) => {
        bridgeFiles.set(filePath, data);
        await writeFile(filePath, data, "utf8");
        return { written: true, path: filePath, hash: `hash:${data.length}` };
      },
    },
  });

  const bridgeSelection = await chooseProjectRoot();
  assert(bridgeSelection.cancelled === false, "bridge project root selection should complete");
  const bridgeTarget = {
    projectRoot: bridgeSelection.projectRoot!,
    projectPath: bridgeSelection.projectPath,
    storageKey: "desktop-open-workflow-browser-fallback-must-not-write",
  };

  const bridgeSave = await saveProjectVibeDraft(bridgeTarget, createdProject);
  assert(bridgeSave.ok, `bridge draft save failed: ${bridgeSave.errors.join("; ")}`);
  assert(bridgeSave.mode === "electron_project_file", "bridge draft save should use Electron project-file mode");
  assert(bridgeFiles.has(resolveLocalProjectVibeFilePath(bridgeProjectRoot)), "bridge draft save should call sandboxWriteFile");

  const bridgeOpen = await openProjectVibeDraft(bridgeTarget);
  assert(bridgeOpen.ok, `bridge draft open failed: ${bridgeOpen.errors.join("; ")}`);
  assert(bridgeOpen.mode === "electron_project_file", "bridge draft open should use Electron project-file mode");
  const bridgeProject = assertProject(bridgeOpen.project, "bridge draft open should restore a project");
  assert(bridgeProject.manifest.projectId === createdProject.manifest.projectId, "bridge projectId should survive restore");
  assert(sameJson(bridgeProject.sourceIndex, createdProject.sourceIndex), "bridge sourceIndex should survive restore");
  assert(sameJson(bridgeProject.runs, createdProject.runs), "bridge runs should survive restore");

  const diskBridgeContent = await readFile(resolveLocalProjectVibeFilePath(bridgeProjectRoot), "utf8");
  assert(diskBridgeContent === bridgeFiles.get(resolveLocalProjectVibeFilePath(bridgeProjectRoot)), "bridge write should mirror disk content");

  console.log(
    `desktop-project-open-workflow-test: generated=${resolveLocalProjectVibeFilePath(emptyProjectRoot)}, bridge=${resolveLocalProjectVibeFilePath(bridgeProjectRoot)}, projectId=${createdProject.manifest.projectId}, runs=${createdProject.runs.length}.`,
  );
} finally {
  (globalThis as { window?: unknown }).window = previousWindow;
  rmSync(emptyProjectRoot, { recursive: true, force: true });
  rmSync(bridgeProjectRoot, { recursive: true, force: true });
}
