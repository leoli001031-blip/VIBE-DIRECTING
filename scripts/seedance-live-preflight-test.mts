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
  writeJson(path.join(root, ".dreamina_cli/credential.json"), { configured: true });
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
  assert.equal(blocked.submitDefaults.modelVersion, "seedance2.0");
  assert.equal(blocked.submitDefaults.videoResolution, "720p");
  assert.equal(blocked.checks.confirmationPhraseRequired, "submit-seedance-video");

  const readyProjectRoot = createProject(root, "ready", {
    manifest: { title: "可提交项目" },
    storyFlow: {
      shots: [
        { id: "shot_a", title: "单镜头", durationSeconds: 5 },
      ],
    },
    assets: [
      { id: "scene_1", kind: "scene", label: "天桥雨夜", path: "assets/scene.png" },
      { id: "audio_1", kind: "audio", label: "voice", path: "assets/voice.wav" },
    ],
  });
  writeTinyPng(path.join(readyProjectRoot, "assets/scene.png"));

  const ready = runSeedanceLivePreflight({
    durationSeconds: 5,
    projectRootInput: readyProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_a",
  }, deps(root));

  assert.equal(ready.ready, true);
  assert.equal(ready.status, "ready_for_video_authorization");
  assert.deepEqual(ready.blockers, []);
  assert.equal(ready.project.assetCount, 2);
  assert.equal(ready.project.usableReferenceAssetCount, 1);
  assert.equal(ready.submitDefaults.durationSeconds, 5);
  assert.equal(ready.checks.storyboardReferenceGenerationExpected, false);
  assert.equal(ready.checks.imageProviderKeyRequired, false);
  assert.equal(ready.checks.imageProviderKeyConfigured, false);
  assert.equal(ready.checks.jimengCliFound, true);
  assert.equal(ready.checks.jimengCredentialFileFound, true);
  assert.deepEqual(ready.executionPolicy, {
    preflightOnly: true,
    liveVideoAuthorizationRequired: true,
    providerCalled: false,
    runtimeExternalNetworkCallMade: false,
    videoSubmitted: false,
    maxProviderSubmitCountAfterAuthorization: 1,
    queryMustReuseExternalTaskId: true,
    retryRequiresNewConfirmation: true,
  });

  const missingSelection = runSeedanceLivePreflight({
    projectRootInput: readyProjectRoot,
    repoRoot: root,
  }, deps(root));
  assert.equal(missingSelection.ready, false);
  assert(missingSelection.blockers.includes("P6-D 真实试运行必须明确指定 1 个镜头。"));

  const tooShort = runSeedanceLivePreflight({
    durationSeconds: 4,
    projectRootInput: readyProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_a",
  }, deps(root));
  assert.equal(tooShort.ready, false);
  assert(tooShort.blockers.some((blocker) => blocker.includes("只允许 5-8 秒")));

  writeJson(path.join(readyProjectRoot, "reports/video_relay_queue.json"), {
    items: [
      { id: "segment_1", title: "镜头 1", status: "queued" },
    ],
  });

  const queued = runSeedanceLivePreflight({
    durationSeconds: 5,
    projectRootInput: readyProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_a",
  }, deps(root));

  assert.equal(queued.ready, false);
  assert.equal(queued.queue?.active, 1);
  assert(queued.blockers.some((blocker) => blocker.includes("已有视频任务在排队或生成")));

  const storyboardProjectRoot = createProject(root, "storyboard", {
    manifest: { title: "需要故事板的项目" },
    storyFlow: {
      shots: [
        { id: "shot_storyboard", title: "故事板镜头", durationSeconds: 6, referenceStrategy: "storyboard_narrative" },
      ],
    },
    assets: [
      { id: "scene_storyboard", kind: "scene", label: "雨夜街道", path: "assets/scene.png" },
    ],
  });
  writeTinyPng(path.join(storyboardProjectRoot, "assets/scene.png"));

  const missingKey = runSeedanceLivePreflight({
    durationSeconds: 6,
    projectRootInput: storyboardProjectRoot,
    repoRoot: root,
    selectedShotId: "shot_storyboard",
  }, deps(root, false));

  assert.equal(missingKey.ready, false);
  assert.equal(missingKey.checks.storyboardReferenceGenerationExpected, true);
  assert.equal(missingKey.checks.imageProviderKeyRequired, true);
  assert(missingKey.blockers.includes("当前镜头需要生成故事板参考，请先配置图片/Responses Key。"));

  console.log("seedance-live-preflight:test passed");
} finally {
  rmSync(root, { force: true, recursive: true });
}
