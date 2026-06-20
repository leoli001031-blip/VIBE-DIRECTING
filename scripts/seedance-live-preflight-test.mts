import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runSeedanceLivePreflight, type JsonRecord, type SeedanceLivePreflightDeps } from "./seedance-live-preflight-core.mts";

function writeJson(filePath: string, value: JsonRecord) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonOptional(filePath: string): JsonRecord | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(readFileSync(filePath, "utf8")) as JsonRecord;
  } catch {
    return undefined;
  }
}

function deps(root: string, keyConfigured = true, cliFound = true): SeedanceLivePreflightDeps {
  return {
    commandExists: () => cliFound,
    env: keyConfigured ? { VIBE_APIKEY_FUN_API_KEY: "test-key" } : {},
    exists: existsSync,
    fileSize: (filePath) => {
      try {
        return statSync(filePath).size;
      } catch {
        return 0;
      }
    },
    homeDir: root,
    now: () => new Date("2026-06-20T00:00:00.000Z"),
    readJsonOptional,
  };
}

function createProject(root: string, name: string, project: JsonRecord) {
  const projectRoot = path.join(root, name);
  mkdirSync(projectRoot, { recursive: true });
  writeJson(path.join(projectRoot, "project.vibe"), project);
  return projectRoot;
}

function writeTinyPng(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"));
}

const root = mkdtempSync(path.join(tmpdir(), "seedance-live-preflight-"));

try {
  const blockedProjectRoot = createProject(root, "blocked", {
    manifest: { title: "缺参考项目" },
    storyFlow: {
      shots: [
        { id: "shot_1", title: "开场", durationSeconds: 4 },
        { id: "shot_2", title: "反应", durationSeconds: 4 },
      ],
    },
    assets: [
      { id: "style_1", kind: "style", label: "90s anime", path: "style.md" },
    ],
  });

  const blocked = runSeedanceLivePreflight({
    projectRootInput: blockedProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_1",
  }, deps(root));

  assert.equal(blocked.ready, false);
  assert.equal(blocked.project.shotCount, 2);
  assert.deepEqual(blocked.project.selectedShotIds, ["shot_1"]);
  assert.equal(blocked.project.usableReferenceAssetCount, 0);
  assert(blocked.blockers.includes("当前项目还没有可用于 Seedance 的角色/场景/道具图片参考。"));
  assert.equal(blocked.submitDefaults.modelVersion, "seedance2.0_vip");
  assert.equal(blocked.submitDefaults.videoResolution, "720p");
  assert.equal(blocked.checks.confirmationPhraseRequired, "submit-seedance-video");

  const readyProjectRoot = createProject(root, "ready", {
    manifest: { title: "可提交项目" },
    storyFlow: {
      shots: [
        { id: "shot_a", title: "单镜头", durationSeconds: 4 },
      ],
    },
    assets: [
      { id: "scene_1", kind: "scene", label: "天桥雨夜", path: "assets/scene.png" },
      { id: "audio_1", kind: "audio", label: "voice", path: "assets/voice.wav" },
    ],
  });
  writeTinyPng(path.join(readyProjectRoot, "assets/scene.png"));

  const ready = runSeedanceLivePreflight({
    durationSeconds: 4,
    projectRootInput: readyProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_a",
  }, deps(root));

  assert.equal(ready.ready, true);
  assert.deepEqual(ready.blockers, []);
  assert.equal(ready.project.assetCount, 2);
  assert.equal(ready.project.usableReferenceAssetCount, 1);
  assert.equal(ready.submitDefaults.durationSeconds, 4);
  assert.equal(ready.checks.imageProviderKeyConfigured, true);
  assert.equal(ready.checks.jimengCliFound, true);

  writeJson(path.join(readyProjectRoot, "reports/video_relay_queue.json"), {
    items: [
      { id: "segment_1", title: "镜头 1", status: "queued" },
    ],
  });

  const queued = runSeedanceLivePreflight({
    durationSeconds: 4,
    projectRootInput: readyProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_a",
  }, deps(root));

  assert.equal(queued.ready, false);
  assert.equal(queued.queue?.active, 1);
  assert(queued.blockers.some((blocker) => blocker.includes("已有视频任务在排队或生成")));

  const missingKey = runSeedanceLivePreflight({
    durationSeconds: 4,
    projectRootInput: readyProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_a",
  }, deps(root, false));

  assert.equal(missingKey.ready, false);
  assert(missingKey.blockers.includes("生成故事板参考需要先配置图片/Responses Key。"));

  console.log("seedance-live-preflight:test passed");
} finally {
  rmSync(root, { force: true, recursive: true });
}
