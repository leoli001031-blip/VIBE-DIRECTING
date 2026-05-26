import { createProjectVibe, hashProjectVibeFacts, projectVibeFileName } from "../src/project";
import {
  openProjectVibeDraft,
  projectVibeDraftTargetId,
  saveProjectVibeDraft,
} from "../src/project/projectVibeDraftStore";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function installWindowShim(windowShim: unknown) {
  (globalThis as { window?: unknown }).window = windowShim;
}

function createLocalStorageShim() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    },
  };
}

try {
  const browserStorage = createLocalStorageShim();
  installWindowShim({ localStorage: browserStorage.storage });

  const browserProject = createProjectVibe({
    projectId: "draft_store_browser",
    title: "Draft Store Browser",
    storyFlow: {
      id: "story_flow_current",
      sections: [{
        id: "intro",
        title: "Intro",
        summary: "Opening section",
        sequenceIndex: 0,
        shotIds: ["A1_01"],
      }],
      shotOrder: ["A1_01"],
    },
    shots: [{
      id: "A1_01",
      sectionId: "intro",
      title: "Opening shot",
      intent: "Establish the project.",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: ["test"],
    }],
  });
  const browserTarget = { storageKey: "test:project-vibe-draft-store" };
  const browserSave = await saveProjectVibeDraft(browserTarget, browserProject);
  assert(browserSave.ok, "browser draft save should succeed");
  assert(browserSave.mode === "browser_local", "browser draft save should use local storage");
  assert(browserSave.path === projectVibeFileName, "browser draft path should default to project.vibe");
  assert(browserStorage.values.has("test:project-vibe-draft-store:project.vibe"), "browser draft should write the local storage key");

  const browserOpen = await openProjectVibeDraft(browserTarget);
  assert(browserOpen.ok && browserOpen.project, "browser draft open should restore the saved project");
  assert(browserOpen.status === "restored", "browser draft open should report restored");
  assert(browserOpen.factHash === hashProjectVibeFacts(browserProject), "browser draft fact hash should match saved project");
  assert(
    projectVibeDraftTargetId(browserTarget) === "browser-draft:test:project-vibe-draft-store:project.vibe",
    "browser draft target id should describe local draft storage",
  );

  const missingOpen = await openProjectVibeDraft({ storageKey: "test:missing-draft" });
  assert(!missingOpen.ok && missingOpen.status === "missing", "missing browser draft should be classified as missing");

  const electronStorage = createLocalStorageShim();
  const electronFiles = new Map<string, string>();
  installWindowShim({
    localStorage: electronStorage.storage,
    vibeRuntime: {
      sandboxWatch: async (watchDir: string) => ({ watching: true, dir: watchDir }),
      sandboxReadFile: async (filePath: string) => {
        const content = electronFiles.get(filePath);
        if (content == null) throw new Error(`ENOENT: ${filePath}`);
        return { content, hash: `hash:${content.length}`, path: filePath };
      },
      sandboxWriteFile: async (filePath: string, data: string) => {
        electronFiles.set(filePath, data);
        return { written: true, path: filePath, hash: `hash:${data.length}` };
      },
      sandboxSpawn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    },
  });

  const electronTarget = {
    projectRoot: "/tmp/vibe-project",
    storageKey: "test:electron-fallback-should-not-write",
  };
  const electronSave = await saveProjectVibeDraft(electronTarget, browserProject);
  assert(electronSave.ok, "electron draft save should succeed");
  assert(electronSave.mode === "electron_project_file", "electron draft save should write the project file");
  assert(electronFiles.has("/tmp/vibe-project/project.vibe"), "electron draft should write project.vibe under project root");
  assert(!electronStorage.values.size, "electron draft should not also write browser local storage");
  assert(
    projectVibeDraftTargetId(electronTarget) === "project-file:/tmp/vibe-project/project.vibe",
    "electron draft target id should describe the project file",
  );

  const electronOpen = await openProjectVibeDraft(electronTarget);
  assert(electronOpen.ok && electronOpen.project, "electron draft open should restore the saved project");
  assert(electronOpen.mode === "electron_project_file", "electron draft open should use the Electron bridge");
} finally {
  delete (globalThis as { window?: unknown }).window;
}

console.log("project-vibe-draft-store-test: browser and Electron draft storage checks completed.");
