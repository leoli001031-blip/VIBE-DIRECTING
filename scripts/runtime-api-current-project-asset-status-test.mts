import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiEndpoints } from "./runtime-api-endpoints.mts";
import {
  createRuntimeApiCurrentProjectAssetStatus,
  markCurrentProjectVisualMemoryAssetStatus,
} from "./runtime-api-current-project-asset-status.mts";
import { createProjectVibe } from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeJson(filePath: string, payload: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function response() {
  return {
    statusCode: 0,
    payload: undefined as any,
  };
}

const memory = {
  schemaVersion: "asset_status_test_visual_memory_v1",
  roles: [{
    id: "char_mika",
    displayName: "Mika",
    status: "needs_review",
    referenceAuthority: { path: "assets/mika.png", lockedStatus: "needs_review" },
  }],
  scenes: [{
    sceneId: "scene_bookstore",
    displayName: "清晨旧书店",
    status: "needs_review",
    path: "project-root/assets/scenes/bookstore.png",
    usedByShotIds: ["shot_001"],
  }],
  props: [{
    propId: "prop_ticket",
    displayName: "发光车票",
    status: "candidate",
    path: "project-root/assets/props/ticket.png",
    usedByShotIds: ["shot_001"],
  }],
};

const pureLock = markCurrentProjectVisualMemoryAssetStatus(memory, {
  assetId: "char_mika",
  status: "locked",
  updatedAt: "2026-05-24T00:00:00.000Z",
});
assert(pureLock.ok === true, "pure helper should lock matching role asset");
assert(pureLock.visualMemory.roles[0].status === "locked", "role status should become locked");
assert(pureLock.visualMemory.roles[0].referenceAuthority.canUseAsFutureReference === true, "locked asset should become future reference");
const missing = markCurrentProjectVisualMemoryAssetStatus(memory, { assetId: "missing", status: "locked" });
assert(missing.ok === false && missing.blockers.includes("asset_not_found"), "missing asset should block");

const workingRoot = mkdtempSync(path.join(tmpdir(), "runtime-asset-status-"));
try {
  const projectRoot = path.join(workingRoot, "project-root");
  const visualMemoryPath = path.join(projectRoot, "project", "visual_memory.json");
  const projectVibePath = path.join(projectRoot, "project.vibe");
  writeJson(visualMemoryPath, memory);
  const project = createProjectVibe({
    projectId: "asset_status_project",
    title: "Asset Status Project",
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z",
    storyFlow: {
      id: "story_flow_current",
      sections: [{ id: "sec_001", title: "开场", summary: "测试镜头", sequenceIndex: 0, shotIds: ["shot_001"] }],
      shotOrder: ["shot_001"],
    },
    shots: [{
      id: "shot_001",
      sectionId: "sec_001",
      title: "发现车票",
      intent: "女高中生在旧书店发现发光车票。",
      camera: "俯拍书页",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 4,
      status: "planned",
      sourceRefs: [],
    }],
  });
  writeJson(projectVibePath, project);

  const endpoints = createRuntimeApiEndpoints();
  const source = {
    runRootPath: projectRoot,
    runRootRelativePath: "project-root",
    projectVibePath,
    projectVibeRelativePath: "project-root/project.vibe",
    visualMemoryPath,
    visualMemoryRelativePath: "project-root/project/visual_memory.json",
  };
  const api = createRuntimeApiCurrentProjectAssetStatus({
    currentProjectAssetStatusEndpoint: endpoints.currentProjectAssetStatusEndpoint,
    currentProjectRouteContext: async (req: any, _res: any, _url: URL, endpoint: string) => ({
      requestContext: { endpoint },
      source,
      body: req.body,
    }),
    writeJson: (res: any, statusCode: number, payload: any) => {
      res.statusCode = statusCode;
      res.payload = payload;
    },
    runtimePolicy: () => ({ runtimeApi: "local" }),
    readFileSync,
    writeFileSync,
    mkdirSync,
    running: () => false,
  });

  const lockedResponse = response();
  const handled = await api.handleCurrentProjectAssetStatusRoute(
    {
      method: "POST",
      body: { assetId: "scene_bookstore", status: "locked" },
    },
    lockedResponse,
    new URL(`http://127.0.0.1${endpoints.currentProjectAssetStatusEndpoint}`),
  );
  assert(handled === true, "route should handle asset status endpoint");
  assert(lockedResponse.statusCode === 200, "asset status route should return 200");
  assert(lockedResponse.payload.visualMemoryWritten === true, "route should write visual memory");
  assert(lockedResponse.payload.projectVibeWritten === true, "route should write Project.vibe");
  const afterLock = readJson(visualMemoryPath);
  assert(afterLock.scenes[0].status === "locked", "scene status should persist to visual_memory.json");
  const afterLockProject = readJson(projectVibePath);
  assert(afterLockProject.assets.some((asset: any) => asset.id === "scene_bookstore" && asset.status === "locked"), "locked scene should persist as a Project.vibe asset");
  assert(afterLockProject.visualMemory.entries.some((entry: any) => entry.assetId === "scene_bookstore" && entry.canUseAsFutureReference === true), "locked scene should become future reference in Project.vibe");
  assert(afterLockProject.shots[0].sceneAssetIds.includes("scene_bookstore"), "locked scene should bind back to matching shot");
  assert(afterLockProject.assets.find((asset: any) => asset.id === "scene_bookstore")?.path === "assets/scenes/bookstore.png", "Project.vibe asset path should be project-relative");

  const reviewResponse = response();
  await api.handleCurrentProjectAssetStatusRoute(
    {
      method: "POST",
      body: { assetId: "prop_ticket", status: "needs_review" },
    },
    reviewResponse,
    new URL(`http://127.0.0.1${endpoints.currentProjectAssetStatusEndpoint}`),
  );
  assert(reviewResponse.statusCode === 200, "needs_review update should return 200");
  const afterReview = readJson(visualMemoryPath);
  assert(afterReview.props[0].status === "needs_review", "prop status should persist as needs_review");
  const afterReviewProject = readJson(projectVibePath);
  assert(afterReviewProject.assets.some((asset: any) => asset.id === "prop_ticket" && asset.status === "needs_review"), "needs_review prop should persist as a Project.vibe asset");
  assert(afterReviewProject.shots[0].propAssetIds.includes("prop_ticket"), "prop should bind back to matching shot");

  const blockedResponse = response();
  await api.handleCurrentProjectAssetStatusRoute(
    {
      method: "POST",
      body: { assetId: "unknown_asset", status: "locked" },
    },
    blockedResponse,
    new URL(`http://127.0.0.1${endpoints.currentProjectAssetStatusEndpoint}`),
  );
  assert(blockedResponse.statusCode === 409, "unknown asset should return 409");
  assert(blockedResponse.payload.blockers.includes("asset_not_found"), "unknown asset should explain blocker");
  assert(existsSync(visualMemoryPath), "visual_memory.json should remain on disk");

  console.log("runtime-api-current-project-asset-status-test: ok");
} finally {
  rmSync(workingRoot, { recursive: true, force: true });
}
