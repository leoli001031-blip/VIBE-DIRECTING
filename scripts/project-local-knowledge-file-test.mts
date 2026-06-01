import { buildProjectRuntimeStateFromProjectVibe, createProjectVibe, isPortableProjectPath } from "../src/project";
import {
  buildProjectLocalKnowledgeManifest,
  buildProjectLocalKnowledgePackFromWebSearch,
  buildProjectLocalKnowledgeReferenceStagedTransaction,
  commitProjectLocalKnowledgeReferenceStagedTransaction,
  openProjectLocalKnowledgePacks,
  parseProjectLocalKnowledgePack,
  portableProjectLocalKnowledgePackPath,
  saveProjectLocalKnowledgePack,
  serializeProjectLocalKnowledgePack,
} from "../src/core/projectLocalKnowledge";
import type { AgentWebSearchResult } from "../src/core/agentWebSearchClient";

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

const projectRoot = "/tmp/vibe-project-local-knowledge";
const project = createProjectVibe({
  projectId: "portable-film-001",
  title: "Portable Film",
  createdAt: "2026-05-19T09:00:00.000Z",
  updatedAt: "2026-05-19T09:00:00.000Z",
  storyFlow: {
    id: "story_flow_portable_film",
    sections: [{
      id: "section_station",
      title: "Station",
      summary: "A quiet station scene.",
      sequenceIndex: 0,
      shotIds: ["S001"],
    }],
    shotOrder: ["S001"],
  },
  shots: [{
    id: "S001",
    sectionId: "section_station",
    title: "Quiet science fiction station signal",
    intent: "A courier waits in a quiet science fiction station under monitor light while the platform signal changes without warning.",
    sceneAssetIds: ["scene_station"],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: 5,
    status: "ready",
    sourceRefs: ["fixture:shot:S001"],
  }],
  assets: [{
    id: "scene_station",
    kind: "scene",
    label: "Station",
    status: "locked",
    path: "assets/scene_station.png",
    textConstraints: ["empty platform", "cool monitor light"],
    usedByShotIds: ["S001"],
    sourceRefs: ["fixture:asset:scene_station"],
    lockedBy: "user",
  }],
});

const result: AgentWebSearchResult = {
  kind: "agent_web_search_result",
  status: "succeeded",
  provider: "tavily_search",
  query: "quiet science fiction station visual style",
  purpose: "style_research",
  resultCount: 2,
  citations: [
    {
      rank: 1,
      title: "Quiet station language",
      url: "https://cinema.example/quiet-station",
      domain: "cinema.example",
      snippet: "A concise citation about negative space, restrained blocking, and monitor light. ".repeat(12),
      source: "tavily_search",
      hash: "web_source_quiet_station",
    },
    {
      rank: 2,
      title: "Dialogue pressure",
      url: "https://craft.example/dialogue-pressure",
      domain: "craft.example",
      snippet: "Public summary about delayed disclosure and calm dialogue under pressure.",
      source: "tavily_search",
      hash: "web_source_dialogue_pressure",
    },
  ],
  evidenceRef: "web_search#/Users/local/secret/web-evidence.json",
  evidencePath: "/Users/local/secret/web-evidence.json",
  retrievedAt: "2026-05-19T09:00:00.000Z",
  networkCalled: true,
  reviewRequired: true,
  promotionAllowed: false,
  warnings: [],
};

const electronFiles = new Map<string, string>();
const browserStorage = createLocalStorageShim();

try {
  installWindowShim({
    localStorage: browserStorage.storage,
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

  const pack = buildProjectLocalKnowledgePackFromWebSearch({
    result,
    userIntent: "保留安静科幻站台里的压迫感方法",
    projectId: project.manifest.projectId,
    projectTitle: project.manifest.title,
    createdAt: "2026-05-19T09:00:00.000Z",
  });
  const packPath = portableProjectLocalKnowledgePackPath(pack);
  assert(packPath.startsWith(`project-knowledge/${project.manifest.projectId}/`), "pack path should live under project-knowledge/<project-id>");
  assert(isPortableProjectPath(packPath), "pack path must be project-root-relative and portable");

  const staged = buildProjectLocalKnowledgeReferenceStagedTransaction({
    project,
    pack,
    result,
    userIntent: "保留安静科幻站台里的压迫感方法",
    generatedAt: "2026-05-19T09:00:01.000Z",
  });
  assert(!staged.blocked, `staged reference should not be blocked: ${staged.blockedReasons.join(",")}`);

  const committed = commitProjectLocalKnowledgeReferenceStagedTransaction({ project, stagedTransaction: staged });
  assert(committed.status === "applied", `Project.vibe reference transaction should apply: ${committed.blockedReasons.join(",")}`);
  const lockedAsset = committed.project.assets.find((asset) => asset.id === staged.assetId);
  assert(lockedAsset?.status === "locked" && lockedAsset.kind === "style", "Project.vibe should contain the locked style research asset");
  assert(lockedAsset.sourceRefs.includes(`knowledge_pack#${pack.id}`), "locked style asset should link to pack id");
  assert(lockedAsset.sourceRefs.includes(`knowledge_pack_hash#${pack.hash}`), "locked style asset should link to pack hash");
  assert(lockedAsset.sourceRefs.includes(`knowledge_pack_path#${pack.path}`), "locked style asset should link to pack path");

  const save = await saveProjectLocalKnowledgePack(project.manifest.projectId, pack, { projectRoot });
  assert(save.ok, `pack file save should succeed: ${save.errors.join(",")}`);
  assert(save.mode === "electron_project_file", "Electron project file mode should be used when projectRoot and bridge are present");
  assert(save.path === pack.path, "save result path should match pack path");
  assert(electronFiles.has(`${projectRoot}/${pack.path}`), "pack JSON should be written under the opened project root");
  assert(browserStorage.values.size === 0, "Electron project file mode should not write browser localStorage");

  const savedJson = electronFiles.get(`${projectRoot}/${pack.path}`) || "";
  const restoredPack = parseProjectLocalKnowledgePack(savedJson);
  assert(restoredPack.hash === pack.hash, "pack hash should survive serialize/read/parse unchanged");
  assert(serializeProjectLocalKnowledgePack(restoredPack) === savedJson, "pack serialization should be stable after read");
  assert(!savedJson.includes(projectRoot), "pack JSON must not include the local absolute project root");
  assert(!savedJson.includes("/Users/local/secret"), "pack JSON must not include local absolute evidence paths");
  assert(!JSON.stringify(committed.project).includes("/Users/local/secret"), "Project.vibe facts must not include local absolute evidence paths");
  assert(!/api[_-]?key/i.test(savedJson), "pack JSON must not include API key fields");

  const opened = await openProjectLocalKnowledgePacks(project.manifest.projectId, { projectRoot }, committed.project);
  assert(opened.ok, `open should succeed: ${opened.errors.join(",")} ${opened.warnings.join(",")}`);
  assert(opened.mode === "electron_project_file", "open should prefer Electron project files");
  assert(opened.paths.includes(pack.path), "open should discover pack path from Project.vibe sourceRefs");
  assert(opened.packs.some((item) => item.id === pack.id && item.hash === pack.hash), "open should restore the pack from the project file");
  const restoredRuntime = buildProjectRuntimeStateFromProjectVibe({
    project: committed.project,
    projectRoot,
    projectPath: "project.vibe",
    generatedAt: "2026-05-19T09:00:02.000Z",
    knowledgeManifest: buildProjectLocalKnowledgeManifest(project.manifest.projectId, opened.packs, "2026-05-19T09:00:02.000Z"),
  });
  const restoredStyleAsset = restoredRuntime.visualMemory.assets.find((asset) => asset.id === staged.assetId);
  assert(restoredStyleAsset?.textConstraints?.some((line) => line.includes("致敬边界")), "runtime asset should preserve Project.vibe text constraints");
  assert(restoredStyleAsset?.sourceRefs?.includes(`knowledge_pack#${pack.id}`), "runtime asset should preserve Project.vibe source refs");
  const envelopeReferences = restoredRuntime.taskRuns.taskViews.flatMap((task) => task.envelope.references);
  const styleReference = envelopeReferences.find((reference) => reference.id === staged.assetId);
  assert(styleReference?.textConstraints?.some((line) => line.includes("致敬边界")), "task envelope reference authority should include text constraints");
  assert(styleReference?.sourceRefs?.includes(`knowledge_pack#${pack.id}`), "task envelope reference authority should include source refs");
  const styleDirectives = restoredRuntime.imagePipeline.promptPlans.flatMap((plan) => plan.styleDirectives);
  assert(styleDirectives.some((line) => line.includes("本片参考") && line.includes("方法")), "prompt plan should include project-local method summary, not only pack hash");
  assert(styleDirectives.some((line) => line.includes("致敬边界") || line.includes("不允许变成原作复刻")), "prompt plan should include homage boundary summary");
  assert(!styleDirectives.join("\n").includes("web_source_quiet_station"), "prompt directives should not include raw citation hashes as prose");

  const browserOnlyStorage = createLocalStorageShim();
  installWindowShim({ localStorage: browserOnlyStorage.storage });
  const browserSave = await saveProjectLocalKnowledgePack(project.manifest.projectId, pack);
  assert(browserSave.ok, `browser local save should succeed: ${browserSave.errors.join(",")}`);
  assert(browserSave.mode === "browser_local", "browser local mode should be explicit without Electron project file access");
  assert(browserOnlyStorage.values.size >= 2, "browser local mode should write localStorage pack list and pack JSON");
  const browserOpen = await openProjectLocalKnowledgePacks(project.manifest.projectId, {}, committed.project);
  assert(browserOpen.ok, `browser local open should succeed: ${browserOpen.errors.join(",")}`);
  assert(browserOpen.mode === "browser_local", "browser local open should report browser_local mode");
  assert(browserOpen.packs.some((item) => item.id === pack.id && item.hash === pack.hash), "browser local open should restore the saved pack");

  console.log(`project-local-knowledge-file-test passed: path=${pack.path}, hash=${pack.hash}, asset=${staged.assetId}`);
} finally {
  delete (globalThis as { window?: unknown }).window;
}
