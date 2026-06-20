import { createProjectVibe, hashProjectVibeFacts, projectVibeFileName } from "../src/project";
import {
  openProjectVibeDraft,
  projectVibeDraftTargetId,
  readProjectVibeSidecarText,
  saveProjectVibeDraft,
  writeProjectVibeSidecarText,
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

let previousFetch: unknown;

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
      sceneAssetIds: ["scene_intro"],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: ["test"],
    }],
    assets: [{
      id: "scene_intro",
      kind: "scene",
      label: "Intro scene",
      status: "locked",
      textConstraints: ["A stable opening scene."],
      usedByShotIds: ["A1_01"],
      sourceRefs: ["test"],
    }],
    visualMemory: {
      entries: [{
        id: "vm_scene_intro",
        assetId: "scene_intro",
        kind: "scene",
        label: "Intro scene",
        status: "locked",
        textConstraints: ["A stable opening scene."],
        usedByShotIds: ["A1_01"],
        canUseAsFutureReference: true,
        sourceRefs: ["test"],
      }],
    },
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

  const browserSidecarWrite = await writeProjectVibeSidecarText(browserTarget, ".vibe-runtime/test-sidecar.json", "{\"ok\":true}");
  assert(browserSidecarWrite.ok && browserSidecarWrite.status === "written", "browser sidecar write should succeed");
  assert(
    browserStorage.values.get("test:project-vibe-draft-store:.vibe-runtime/test-sidecar.json") === "{\"ok\":true}",
    "browser sidecar should use the requested project-relative path",
  );
  const browserSidecarRead = await readProjectVibeSidecarText(browserTarget, ".vibe-runtime/test-sidecar.json");
  assert(browserSidecarRead.ok && browserSidecarRead.content === "{\"ok\":true}", "browser sidecar read should restore content");

  const runtimeStorage = createLocalStorageShim();
  previousFetch = (globalThis as { fetch?: unknown }).fetch;
  const runtimeRequests: Array<{ url: string; body: unknown; method: string }> = [];
  installWindowShim({
    localStorage: runtimeStorage.storage,
    location: { hostname: "127.0.0.1", port: "5174" },
  });
  (globalThis as { fetch?: unknown }).fetch = async (url: string, init?: { body?: string; method?: string }) => {
    const requestUrl = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : undefined;
    runtimeRequests.push({ url: requestUrl, body, method });
    if (requestUrl.includes("/api/runtime/projects/current") && !requestUrl.includes("/project-vibe/save")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          status: "bound",
          currentProject: {
            bound: true,
            projectRoot: ".vibe-runtime/browser-projects/runtime-save",
            projectRootRelativePath: ".vibe-runtime/browser-projects/runtime-save",
            binding: {
              projectRoot: ".vibe-runtime/browser-projects/runtime-save",
              projectRootRelativePath: ".vibe-runtime/browser-projects/runtime-save",
            },
          },
        }),
        json: async () => ({
          ok: true,
          status: "bound",
          currentProject: {
            bound: true,
            projectRoot: ".vibe-runtime/browser-projects/runtime-save",
            projectRootRelativePath: ".vibe-runtime/browser-projects/runtime-save",
            binding: {
              projectRoot: ".vibe-runtime/browser-projects/runtime-save",
              projectRootRelativePath: ".vibe-runtime/browser-projects/runtime-save",
            },
          },
        }),
      };
    }
    if (requestUrl.includes("/api/runtime/files")) {
      const parsed = new URL(requestUrl);
      const filePath = parsed.searchParams.get("path");
      if (filePath === projectVibeFileName) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(browserProject),
          json: async () => browserProject,
        };
      }
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ ok: false, status: "not_found" }),
        json: async () => ({ ok: false, status: "not_found" }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, status: "saved", projectVibeWritten: true }),
      json: async () => ({ ok: true, status: "saved", projectVibeWritten: true }),
    };
  };
  const runtimeTarget = {
    projectRoot: ".vibe-runtime/browser-projects/runtime-save",
    storageKey: "test:runtime-fallback-should-not-write",
  };
  const runtimeOpen = await openProjectVibeDraft(runtimeTarget);
  assert(runtimeOpen.ok && runtimeOpen.project, "runtime draft open should restore the selected project file");
  assert(runtimeOpen.mode === "runtime_project_file", "runtime draft open should use runtime project-file mode");
  assert(runtimeOpen.factHash === hashProjectVibeFacts(browserProject), "runtime draft open fact hash should match the project file");
  assert(!runtimeStorage.values.size, "runtime draft open should not fall back to browser local storage");
  assert(
    runtimeRequests.some((request) => request.url.includes("/api/runtime/projects/current")),
    "runtime draft open should verify the selected runtime project binding",
  );
  assert(
    runtimeRequests.some((request) => request.url.includes("/api/runtime/files") && request.url.includes("scope=current-project") && request.url.includes("path=project.vibe")),
    "runtime draft open should read Project.vibe through the current-project runtime file endpoint",
  );
  assert(
    !runtimeRequests.some((request) => request.url.includes("visual_memory.json")),
    "runtime draft open should not probe legacy visual_memory sidecar when Project.vibe has inline assets",
  );

  const runtimeSave = await saveProjectVibeDraft(runtimeTarget, browserProject);
  assert(runtimeSave.ok, "runtime draft save should succeed");
  assert(runtimeSave.mode === "runtime_project_file", "runtime draft save should use runtime project-file mode");
  assert(!runtimeStorage.values.size, "runtime draft save should not fall back to browser local storage");
  const runtimeSaveRequest = runtimeRequests.find((request) => request.url.includes("/api/runtime/projects/current/project-vibe/save"));
  assert(runtimeSaveRequest, "runtime draft save should use the current project save endpoint");
  assert(runtimeSaveRequest.url.includes("projectRoot=.vibe-runtime%2Fbrowser-projects%2Fruntime-save"), "runtime draft save should scope the request to the selected project root");
  assert(
    (runtimeSaveRequest.body as { projectRoot?: string; project?: { manifest?: { projectId?: string } } }).projectRoot === runtimeTarget.projectRoot,
    "runtime draft save should include the project root in the request body",
  );
  assert(
    (runtimeSaveRequest.body as { projectRoot?: string; project?: { manifest?: { projectId?: string } } }).project?.manifest?.projectId === "draft_store_browser",
    "runtime draft save should submit the Project.vibe document",
  );
  assert(
    projectVibeDraftTargetId(runtimeTarget) === "project-file:.vibe-runtime/browser-projects/runtime-save/project.vibe",
    "runtime draft target id should describe the project file, not browser storage",
  );

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

  const electronSidecarWrite = await writeProjectVibeSidecarText(electronTarget, ".vibe-runtime/test-sidecar.json", "{\"electron\":true}");
  assert(electronSidecarWrite.ok, "electron sidecar write should succeed");
  assert(
    electronFiles.get("/tmp/vibe-project/.vibe-runtime/test-sidecar.json") === "{\"electron\":true}",
    "electron sidecar should write under the project root",
  );
  const electronSidecarRead = await readProjectVibeSidecarText(electronTarget, ".vibe-runtime/test-sidecar.json");
  assert(electronSidecarRead.ok && electronSidecarRead.content === "{\"electron\":true}", "electron sidecar read should restore content");
} finally {
  if (previousFetch !== undefined) (globalThis as { fetch?: unknown }).fetch = previousFetch;
  delete (globalThis as { window?: unknown }).window;
}

console.log("project-vibe-draft-store-test: browser and Electron draft storage checks completed.");
