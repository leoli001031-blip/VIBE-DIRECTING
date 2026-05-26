import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID } from "./apikey-fun-responses-image-transport.mts";
import { createRuntimeApiCurrentProjectSeedanceSubmit } from "./runtime-routes/current-project-seedance-submit.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeFile(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function writeJson(filePath: string, payload: unknown): void {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256Bytes(bytes: Buffer | Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

const repoRoot = process.cwd();
const runRootRelativePath = ".vibe-runtime/test-current-project-seedance-mode-compiler";
const runRootPath = path.resolve(repoRoot, runRootRelativePath);
rmSync(runRootPath, { recursive: true, force: true });
mkdirSync(runRootPath, { recursive: true });

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const scenePath = path.join(runRootPath, "assets/scene.png");
const characterPath = path.join(runRootPath, "assets/character.png");
const propPath = path.join(runRootPath, "assets/prop.png");
writeFile(scenePath, tinyPng);
writeFile(characterPath, tinyPng);
writeFile(propPath, tinyPng);

const source = {
  runRootPath,
  runRootRelativePath,
  projectVibePath: path.join(runRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${runRootRelativePath}/project/project.vibe`,
  previewPlanPath: path.join(runRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${runRootRelativePath}/reports/preview_plan.json`,
};

let projectFacts: any = {
  projectVibe: {
    shots: [
      {
        id: "S01",
        storyboardGroupId: "station_escape_sequence",
        title: "雨站对望",
        durationSeconds: 6,
        executionMode: "relationship_wide",
        referenceStrategy: "storyboard_narrative",
        rhythmProfile: "anime_emotion",
        intent: "雨夜站台里，短发少女在画面左侧，少年在右后方门边，两人隔着湿地反光对望。",
        camera: "从少女眼神切到少年停住脚步，保持 180 度轴线，轻微推进。",
        primaryAction: "两人隔着雨水反光对望。",
        actionTrigger: "远处列车灯闪一下。",
        microReaction: "少女眨眼，少年停住脚步。",
        characterGuidance: ["短发少女", "少年"],
        sceneGuidance: ["雨夜电车站"],
      },
      {
        id: "S02",
        storyboardGroupId: "station_escape_sequence",
        title: "车票发光",
        durationSeconds: 4,
        executionMode: "action_insert",
        referenceStrategy: "omni_reference",
        rhythmProfile: "anime_emotion",
        intent: "手部特写，少女手里的旧车票发出蓝光，指尖轻轻收紧。",
        camera: "手部特写，轻微上摇到眼神。",
        primaryAction: "旧车票发光。",
        actionTrigger: "票面纹路突然亮起。",
        microReaction: "她的指尖收紧。",
        propGuidance: ["发蓝光的旧车票"],
      },
      {
        id: "S03",
        storyboardGroupId: "station_escape_sequence",
        title: "跑向列车",
        durationSeconds: 8,
        executionMode: "planned_cut_sequence",
        referenceStrategy: "storyboard_rapid_cut",
        rhythmProfile: "action_fast_cut",
        intent: "两人听见列车进站，快速切换远景、脚步、手部和回头反应，奔向黑色车门。",
        camera: "快切：远景建立，脚步特写，手部拉住，回头近景。",
        primaryAction: "两人奔向黑色车门。",
        sound: "音乐节奏参考，湿路脚步声。",
        seedanceDirection: "承接音乐节拍做快切，但不要让视频模型生成配乐。",
        actionBeats: ["远景看到列车进站", "脚步踏过雨水", "少女拉住少年手腕", "两人回头", "冲向黑色车门"],
        visibleClips: 3,
        storyboardPanels: 5,
        splitPolicy: "快切动作链",
        characterGuidance: ["短发少女", "少年"],
        sceneGuidance: ["雨夜电车站"],
        propGuidance: ["发蓝光的旧车票"],
      },
    ],
  },
};

const workbenchFacts: any = {
  visualMemory: {
    assets: [
      { type: "scene", name: "雨夜电车站", path: `${runRootRelativePath}/assets/scene.png` },
      { type: "character", name: "短发少女", path: `${runRootRelativePath}/assets/character.png` },
      { type: "prop", name: "旧车票", path: `${runRootRelativePath}/assets/prop.png` },
    ],
  },
};

const route = createRuntimeApiCurrentProjectSeedanceSubmit({
  endpoint: "/api/runtime/projects/current/seedance/submit",
  repoRoot,
  currentProjectRouteContext: async () => undefined,
  readProjectFacts: () => projectFacts,
  currentProjectWorkbenchFacts: () => workbenchFacts,
  getProviderApiKey: () => "sk-test-not-real",
  getProviderConfigStatuses: () => [{
    providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
    baseUrl: "https://api.apikey.fun/v1/responses",
    imageModel: "gpt-5.5",
    credential: { keyStatus: "configured" },
  }],
  requestOverrideDiagnostics: () => ({}),
  runtimePolicy: (extra = {}) => ({ providerPolicyVersion: "test", ...extra }),
  scopedRepoPath(relativePath: string): string {
    return path.resolve(repoRoot, relativePath);
  },
  sha256Bytes,
  writeCurrentProjectRuntimeBytes(relativePath: string, bytes: Buffer, routeSource: typeof source): string {
    assert(relativePath.startsWith(routeSource.runRootRelativePath), `write escaped source root: ${relativePath}`);
    const filePath = path.resolve(repoRoot, relativePath);
    writeFile(filePath, bytes);
    return filePath;
  },
  writeCurrentProjectRuntimeJson(relativePath: string, payload: unknown, routeSource: typeof source): void {
    assert(relativePath.startsWith(routeSource.runRootRelativePath), `write escaped source root: ${relativePath}`);
    writeJson(path.resolve(repoRoot, relativePath), payload);
  },
  writeJson: () => undefined,
  running: false,
  setRunning: () => undefined,
});

const response = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "9:16",
  durationSeconds: 18,
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, source);

assert(response.ok === true, `mock submit should pass: ${JSON.stringify(response)}`);
assert(response.compilerMode === "storyboard_rapid_cut", "multi-shot action sequence should compile to storyboard_rapid_cut");
assert(response.storyboardPromptPath, "rapid cut mode must write an Image2 storyboard prompt");
assert(response.promptPath, "Seedance prompt path missing");

const storyboardPrompt = readFileSync(path.resolve(repoRoot, response.storyboardPromptPath), "utf8");
const seedancePrompt = readFileSync(path.resolve(repoRoot, response.promptPath), "utf8");
const manifestPath = path.join(path.dirname(path.resolve(repoRoot, response.promptPath)), "input-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const submitProgressPath = path.join(path.dirname(path.resolve(repoRoot, response.promptPath)), "submit-progress.json");
const submitProgress = JSON.parse(readFileSync(submitProgressPath, "utf8"));

assert(storyboardPrompt.includes("Compiler mode: storyboard_rapid_cut / 故事板快切"), "storyboard prompt must expose compiler mode");
assert(storyboardPrompt.includes("Create one 16:9 Japanese TV anime storyboard reference sheet"), "storyboard prompt should keep a unified 16:9 app-readable storyboard canvas");
assert(storyboardPrompt.includes("Use a unified 16:9 storyboard canvas for readability inside the app"), "storyboard prompt must separate storyboard canvas from final video ratio");
assert(storyboardPrompt.includes("Panel shapes may be long, narrow, large, or small"), "storyboard prompt should allow flexible internal panel shapes");
assert(storyboardPrompt.includes("Storyboard panel count: exactly 7"), "rapid storyboard prompt must follow the shot-level storyboard panel sum");
assert(storyboardPrompt.includes("Final visible clips requested from Seedance: exactly 5"), "rapid storyboard prompt must separate storyboard panels from final visible clips");
assert(storyboardPrompt.includes("storyboardPanels=7; visibleClips=5"), "storyboard prompt must expose the contract fields");
assert(storyboardPrompt.includes("Color key: RED=camera"), "rapid-cut storyboard prompt must include production color key");
assert(storyboardPrompt.includes("Prop reference isolation"), "storyboard prompt must prevent prop-sheet leakage");
assert(storyboardPrompt.includes("rough action previs / timing-sheet storyboard"), "rapid storyboard prompt must use rough previs grammar");
assert(!storyboardPrompt.includes("Create one clean 16:9 rough Japanese TV anime storyboard reference sheet"), "old fixed storyboard wording leaked back");

assert(seedancePrompt.includes("故事板快切 video request"), "Seedance prompt must expose creator-facing compiler mode");
assert(seedancePrompt.includes("Create exactly 5 visible clip(s) in the final video"), "Seedance prompt must lock final visible clips separately from storyboard panels");
assert(seedancePrompt.includes("Use the 7 storyboard panel(s) only as internal staging"), "Seedance prompt must explain storyboard panels are internal guidance");
assert(seedancePrompt.includes("not as visible artwork, split screen, texture, background, or picture-in-picture content"), "Seedance prompt must prevent storyboard reference from becoming visible content");
assert(seedancePrompt.includes("Priority order: Timing and visible clip count > storyboard panel order"), "Seedance prompt must state reference priority order");
assert(seedancePrompt.includes("visible cut 5/5"), "Seedance prompt must expose every planned final visible clip in the timing map");
assert(seedancePrompt.includes("actionBeats only"), "Seedance prompt must prevent extra storyboard panels from becoming final clips");
assert(!seedancePrompt.includes("Hard cut budget"), "Seedance prompt should avoid verbose internal compiler wording");
assert(seedancePrompt.includes("从少女眼神连续转向少年停住脚步"), "Seedance prompt should rewrite internal cut wording into continuous camera motion");
assert(!seedancePrompt.includes("从少女眼神切到少年停住脚步"), "Seedance prompt should not leak cut-to wording that creates extra visible edits");
assert(seedancePrompt.includes("RED=camera/lens/framing/camera move"), "Seedance prompt must explain annotation colors internally");
assert(seedancePrompt.includes("Do not render storyboard artifacts"), "Seedance prompt must strip storyboard artifacts");
assert(seedancePrompt.includes("clear action readability"), "Seedance prompt should derive the style tail from action rhythm instead of using one fixed mood");
assert(!seedancePrompt.includes("quiet suspense. No photorealism"), "Seedance prompt must not use the old hardcoded quiet-suspense style tail for every genre");
assert(seedancePrompt.includes("No music, no BGM"), "Seedance prompt must keep provider video free of BGM");
const seedancePromptWithoutNoBgmLine = seedancePrompt.replace(/No music, no BGM, no subtitles\./g, "");
assert(!/音乐|配乐|背景音乐|\bmusic\b|\bBGM\b|\bsoundtrack\b/i.test(seedancePromptWithoutNoBgmLine), "Seedance prompt must sanitize music-planning language outside the no-BGM guard line");

assert(manifest.compilerMode === "storyboard_rapid_cut", "manifest compiler mode drifted");
assert(manifest.ruleQaStatus === "pass" || manifest.ruleQaStatus === "warning", "Seedance submit should persist a non-blocking director rule QA report");
assert(existsSync(path.resolve(repoRoot, manifest.ruleQaReportPath)), "director rule QA report should be written before provider submit");
assert(manifest.textQaStatus === "pass" || manifest.textQaStatus === "needs_revision" || manifest.textQaStatus === "skipped", "Seedance submit should persist a non-blocking director text QA report");
assert(existsSync(path.resolve(repoRoot, manifest.textQaReportPath)), "director text QA report should be written before Image2/Seedance submit");
assert(manifest.ratio === "9:16", "manifest should preserve requested video ratio");
assert(manifest.storyboardAspectRatio === "16:9", "manifest should keep the storyboard canvas 16:9 even when video ratio differs");
assert(manifest.storyboardOutputSize === "1280x720", "manifest should keep storyboard Image2 output size app-readable");
assert(manifest.referenceBundle?.sceneBaseline?.reusableAcrossCameraAngles === true, "scene baseline should be reusable across camera angles");
assert(manifest.referenceBundle?.storyboardReference?.groupingRule.includes("one explicit video generation task"), "storyboard references must be scoped to the provider submit, not the whole scene");
assert(manifest.referenceBundle?.propReferences?.detailRule.includes("parent character/object/scene"), "dependent details should remain constraints on parent assets");
assert(submitProgress.phase === "waiting_for_provider_task", "submit progress should be persisted before the CLI returns");
assert(submitProgress.relayQueuePath === ".vibe-runtime/test-current-project-seedance-mode-compiler/reports/video_relay_queue.json", "submit progress should point to the persisted relay queue");
const strategies = new Set(manifest.shotStrategies.map((item: { strategyId: string }) => item.strategyId));
assert(strategies.has("storyboard_narrative"), "manifest should preserve narrative per-shot strategy");
assert(strategies.has("omni_reference"), "manifest should preserve omni per-shot strategy");
assert(strategies.has("storyboard_rapid_cut"), "manifest should preserve rapid per-shot strategy");
const strategyByShot = new Map(manifest.shotStrategies.map((item: { shotId: string; strategyId: string }) => [item.shotId, item.strategyId]));
assert(strategyByShot.get("S01") === "storyboard_narrative", "compiler should honor the AI-selected narrative strategy");
assert(strategyByShot.get("S02") === "omni_reference", "compiler should honor the AI-selected omni strategy");
assert(strategyByShot.get("S03") === "storyboard_rapid_cut", "compiler should honor the AI-selected rapid-cut strategy");
assert(manifest.videoResolution === "720p", "video resolution should stay 720p in this lane");
assert(manifest.modelVersion === "seedance2.0", "model version should stay normal seedance2.0");

projectFacts = {
  projectVibe: {
    shots: [
      {
        id: "N01",
        storyboardGroupId: "bookstore_ticket_sequence",
        title: "旧书店翻书",
        durationSeconds: 4,
        executionMode: "relationship_wide",
        rhythmProfile: "anime_emotion",
        intent: "清晨旧书店，女高中生侧身站在窗边书架前翻开旧书。",
        camera: "低机位轻微推入书架与窗边。",
        primaryAction: "她翻开旧书。",
        characterGuidance: ["女高中生"],
        sceneGuidance: ["清晨旧书店"],
        propGuidance: ["旧书"],
      },
      {
        id: "N02",
        storyboardGroupId: "bookstore_ticket_sequence",
        title: "车票发光",
        durationSeconds: 4,
        executionMode: "action_insert",
        rhythmProfile: "anime_emotion",
        intent: "书页间的车票泛出蓝白光，她的手指停住。",
        camera: "俯拍手部，缓慢压近书页缝隙。",
        primaryAction: "她发现发光车票。",
        characterGuidance: ["女高中生"],
        sceneGuidance: ["清晨旧书店"],
        propGuidance: ["发光车票", "旧书"],
      },
      {
        id: "N03",
        storyboardGroupId: "bookstore_ticket_sequence",
        title: "雾中电车",
        durationSeconds: 4,
        executionMode: "relationship_wide",
        rhythmProfile: "anime_emotion",
        intent: "她抬头看见雾中的电车从窗外慢慢经过。",
        camera: "从她的眼神连续转向窗外电车影。",
        primaryAction: "她抬头看见雾中电车。",
        characterGuidance: ["女高中生"],
        sceneGuidance: ["清晨旧书店", "雾中街道"],
        propGuidance: ["发光车票"],
      },
    ],
  },
};

const narrativeRunRootRelativePath = ".vibe-runtime/test-current-project-seedance-mode-compiler-narrative";
const narrativeRunRootPath = path.resolve(repoRoot, narrativeRunRootRelativePath);
rmSync(narrativeRunRootPath, { recursive: true, force: true });
mkdirSync(narrativeRunRootPath, { recursive: true });
const narrativeScenePath = path.join(narrativeRunRootPath, "assets/scene.png");
const narrativeCharacterPath = path.join(narrativeRunRootPath, "assets/character.png");
const narrativePropPath = path.join(narrativeRunRootPath, "assets/prop.png");
writeFile(narrativeScenePath, tinyPng);
writeFile(narrativeCharacterPath, tinyPng);
writeFile(narrativePropPath, tinyPng);

const narrativeSource = {
  ...source,
  runRootPath: narrativeRunRootPath,
  runRootRelativePath: narrativeRunRootRelativePath,
  projectVibePath: path.join(narrativeRunRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${narrativeRunRootRelativePath}/project/project.vibe`,
  previewPlanPath: path.join(narrativeRunRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${narrativeRunRootRelativePath}/reports/preview_plan.json`,
};

workbenchFacts.visualMemory.assets = [
  { type: "scene", name: "清晨旧书店", path: `${narrativeRunRootRelativePath}/assets/scene.png` },
  { type: "character", name: "女高中生", path: `${narrativeRunRootRelativePath}/assets/character.png` },
  { type: "prop", name: "旧书", path: `${narrativeRunRootRelativePath}/assets/prop.png` },
];

const narrativeResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_narrative",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  durationSeconds: 12,
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, narrativeSource);

assert(narrativeResponse.ok === true, `mock narrative submit should pass: ${JSON.stringify(narrativeResponse)}`);
assert(narrativeResponse.compilerMode === "storyboard_narrative", "narrative sequence should compile to storyboard_narrative");
assert(narrativeResponse.storyboardPromptPath, "narrative mode must write an Image2 storyboard prompt");
const narrativeStoryboardPrompt = readFileSync(path.resolve(repoRoot, narrativeResponse.storyboardPromptPath), "utf8");
const narrativeSeedancePrompt = readFileSync(path.resolve(repoRoot, narrativeResponse.promptPath), "utf8");

assert(narrativeStoryboardPrompt.includes("Compiler mode: storyboard_narrative / 故事板叙事"), "narrative storyboard prompt must expose compiler mode");
assert(narrativeStoryboardPrompt.includes("Layout grammar: flexible director storyboard"), "narrative prompt must use flexible storyboard grammar");
assert(narrativeStoryboardPrompt.includes("Do not force one dominant main composition"), "narrative prompt must not hardcode a dominant-main layout");
assert(narrativeStoryboardPrompt.includes("Primary cut count: exactly 3"), "narrative prompt must still expose primary cut count");
assert(!narrativeStoryboardPrompt.includes("Panel count: exactly 3. Each panel is one final visible video cut"), "old rigid equal-panel narrative wording leaked back");
assert(narrativeSeedancePrompt.includes("Create exactly 3 visible clip(s) in the final video"), "Seedance prompt must use compact visible-clip language");
assert(narrativeSeedancePrompt.includes("Use the 3 storyboard panel(s) only as internal staging"), "Seedance prompt must separate storyboard panels from final clips");
assert(narrativeSeedancePrompt.includes("weather, light direction"), "Seedance prompt must not hardcode rainy scene guidance");
assert(!narrativeSeedancePrompt.includes("rainy atmosphere"), "old rainy scene-reference wording leaked back");

projectFacts = {
  projectVibe: {
    shots: [
      {
        id: "M01",
        title: "弯道前对峙",
        durationSeconds: 4,
        executionMode: "relationship_wide",
        rhythmProfile: "anime_emotion",
        intent: "雨夜山路弯道前，白色跑车与黑色跑车并排短暂停住，便利店远处霓虹微亮。",
        camera: "低机位静置，雨水前景压住两车距离。",
        primaryAction: "两辆跑车在弯道前对峙停住。",
        sceneGuidance: ["雨夜山路弯道"],
        characterGuidance: ["白色跑车驾驶者", "黑色跑车驾驶者"],
        propGuidance: ["白色跑车", "黑色跑车"],
      },
      {
        id: "M02",
        title: "霓虹启动",
        durationSeconds: 4,
        executionMode: "planned_cut_sequence",
        rhythmProfile: "action_fast_cut",
        intent: "山脚便利店外山路，便利店霓虹闪一下，两车同时启动冲出弯道。",
        camera: "计划快切，霓虹、脚踏、轮胎、车灯连击。",
        primaryAction: "两车同时启动冲出弯道。",
        sceneGuidance: ["山脚便利店外山路"],
        characterGuidance: ["白色跑车驾驶者", "黑色跑车驾驶者"],
        propGuidance: ["便利店霓虹灯", "轮胎", "车灯"],
      },
      {
        id: "M03",
        title: "天空余声",
        durationSeconds: 4,
        executionMode: "single_continuous_shot",
        rhythmProfile: "anime_emotion",
        intent: "两车尾灯消失在雨雾弯道后，镜头从湿亮山路缓慢抬起，露出泛白天空和黑色山脊。",
        camera: "跟随尾灯上仰，慢慢抬到山路与泛白天空。",
        primaryAction: "镜头抬向天空留下余韵。",
        sceneGuidance: ["雨夜山路与泛白天空", "山脊"],
        propGuidance: ["湿路", "尾灯残光", "山脊"],
      },
    ],
  },
};

const mountainRunRootRelativePath = ".vibe-runtime/test-current-project-seedance-mode-compiler-mountain";
const mountainRunRootPath = path.resolve(repoRoot, mountainRunRootRelativePath);
rmSync(mountainRunRootPath, { recursive: true, force: true });
mkdirSync(mountainRunRootPath, { recursive: true });
const mountainScenePath = path.join(mountainRunRootPath, "assets/scene.png");
const mountainCharacterPath = path.join(mountainRunRootPath, "assets/character.png");
const mountainPropPath = path.join(mountainRunRootPath, "assets/prop.png");
const mountainPropBlackPath = path.join(mountainRunRootPath, "assets/prop-black.png");
const mountainPropLightPath = path.join(mountainRunRootPath, "assets/prop-light.png");
writeFile(mountainScenePath, tinyPng);
writeFile(mountainCharacterPath, tinyPng);
writeFile(mountainPropPath, tinyPng);
writeFile(mountainPropBlackPath, tinyPng);
writeFile(mountainPropLightPath, tinyPng);

const mountainSource = {
  ...source,
  runRootPath: mountainRunRootPath,
  runRootRelativePath: mountainRunRootRelativePath,
  projectVibePath: path.join(mountainRunRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${mountainRunRootRelativePath}/project/project.vibe`,
  previewPlanPath: path.join(mountainRunRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${mountainRunRootRelativePath}/reports/preview_plan.json`,
};

workbenchFacts.visualMemory.assets = [
  { type: "scene", name: "雨夜山路弯道", path: `${mountainRunRootRelativePath}/assets/scene.png`, usedByShotIds: ["M01"] },
  { type: "character", name: "白色跑车驾驶者", path: `${mountainRunRootRelativePath}/assets/character.png`, usedByShotIds: ["M01", "M02"] },
  { type: "prop", name: "白色跑车", path: `${mountainRunRootRelativePath}/assets/prop.png`, usedByShotIds: ["M01"] },
  { type: "prop", name: "黑色跑车", path: `${mountainRunRootRelativePath}/assets/prop-black.png`, usedByShotIds: ["M01"] },
  { type: "prop", name: "车灯", path: `${mountainRunRootRelativePath}/assets/prop-light.png`, usedByShotIds: ["M01", "M02"] },
];

const mountainResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_mountain",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  durationSeconds: 12,
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, mountainSource);

assert(mountainResponse.ok === true, `mountain road sequence should submit: ${JSON.stringify(mountainResponse)}`);
const mountainManifestPath = path.join(path.dirname(path.resolve(repoRoot, mountainResponse.promptPath)), "input-manifest.json");
const mountainManifest = JSON.parse(readFileSync(mountainManifestPath, "utf8"));
assert(mountainManifest.segmentPlan.length === 3, "same scene cluster should not implicitly merge three story shots into one storyboard/video unit");
assert(mountainManifest.activeSegmentId === "segment_1", "unselected submit should start with the first story shot segment");
assert(mountainManifest.shots.length === 1 && mountainManifest.shots[0].id === "M01", "active video unit should contain exactly one story shot unless an explicit storyboardGroupId is present");
assert(mountainManifest.referenceBundle?.videoTaskScope?.oneBundlePerProviderSubmit === true, "reference bundle must be scoped to the active video task");
assert(mountainManifest.referenceBundle?.sceneBaseline?.reusableAcrossShots === true, "scene baseline may be reused across multiple shots in the same location");
assert(mountainManifest.referenceBundle?.storyboardReference?.groupingRule.includes("not to every shot in the same scene"), "storyboard reference must not be implied by scene reuse");
assert(mountainManifest.references.some((ref: { role: string; name: string }) => ref.role === "scene_reference" && ref.name === "雨夜山路弯道"), "single-shot segment should still reuse the matching scene baseline reference");
assert(!mountainManifest.references.some((ref: { role: string; name: string }) => ref.role === "character_reference" && /驾驶者|driver/i.test(ref.name)), "vehicle-controller labels must not become character references");
assert(!mountainManifest.references.some((ref: { role: string; name: string }) => ref.role === "prop_reference" && /车灯|轮胎|湿路|山脊/u.test(ref.name)), "vehicle/scene details must not become prop references for Seedance");
assert(mountainManifest.references.filter((ref: { role: string }) => ref.role === "prop_reference").length >= 1, "standalone car references should remain available after filtering dependent vehicle details");

const mountainRapidRunRootRelativePath = ".vibe-runtime/test-current-project-seedance-mode-compiler-mountain-rapid";
const mountainRapidRunRootPath = path.resolve(repoRoot, mountainRapidRunRootRelativePath);
rmSync(mountainRapidRunRootPath, { recursive: true, force: true });
mkdirSync(mountainRapidRunRootPath, { recursive: true });
writeFile(path.join(mountainRapidRunRootPath, "assets/scene.png"), tinyPng);
writeFile(path.join(mountainRapidRunRootPath, "assets/character.png"), tinyPng);
writeFile(path.join(mountainRapidRunRootPath, "assets/prop.png"), tinyPng);
writeFile(path.join(mountainRapidRunRootPath, "assets/prop-black.png"), tinyPng);
writeFile(path.join(mountainRapidRunRootPath, "assets/prop-light.png"), tinyPng);

const mountainRapidSource = {
  ...source,
  runRootPath: mountainRapidRunRootPath,
  runRootRelativePath: mountainRapidRunRootRelativePath,
  projectVibePath: path.join(mountainRapidRunRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${mountainRapidRunRootRelativePath}/project/project.vibe`,
  previewPlanPath: path.join(mountainRapidRunRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${mountainRapidRunRootRelativePath}/reports/preview_plan.json`,
};

workbenchFacts.visualMemory.assets = [
  { type: "scene", name: "雨夜山路弯道", path: `${mountainRapidRunRootRelativePath}/assets/scene.png`, usedByShotIds: ["M01", "M02"] },
  { type: "character", name: "白色跑车驾驶者", path: `${mountainRapidRunRootRelativePath}/assets/character.png`, usedByShotIds: ["M01", "M02"] },
  { type: "prop", name: "白色跑车", path: `${mountainRapidRunRootRelativePath}/assets/prop.png`, usedByShotIds: ["M01", "M02"] },
  { type: "prop", name: "黑色跑车", path: `${mountainRapidRunRootRelativePath}/assets/prop-black.png`, usedByShotIds: ["M01", "M02"] },
  { type: "prop", name: "车灯", path: `${mountainRapidRunRootRelativePath}/assets/prop-light.png`, usedByShotIds: ["M02"] },
];

const mountainRapidResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_mountain_rapid",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  selectedShotIds: ["M02"],
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  durationSeconds: 4,
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, mountainRapidSource);

assert(mountainRapidResponse.ok === true, `selected rapid shot should submit: ${JSON.stringify(mountainRapidResponse)}`);
assert(mountainRapidResponse.compilerMode === "storyboard_rapid_cut", "planned quick-cut shot should compile to storyboard_rapid_cut");
const mountainRapidStoryboardPrompt = readFileSync(path.resolve(repoRoot, mountainRapidResponse.storyboardPromptPath), "utf8");
const mountainRapidSeedancePrompt = readFileSync(path.resolve(repoRoot, mountainRapidResponse.promptPath), "utf8");
assert(mountainRapidStoryboardPrompt.includes("Storyboard panel count: exactly 4"), "mixed/rapid quick-cut shot must expand into storyboard panels instead of one panel");
assert(mountainRapidSeedancePrompt.includes("Create exactly 4 visible clip(s) in the final video"), "Seedance prompt must lock quick-cut visible clip count");
assert(mountainRapidSeedancePrompt.includes("visible cut 4/4"), "Seedance prompt must expose every inferred quick-cut beat");
assert(mountainRapidSeedancePrompt.includes("Visible cut direction:"), "rapid prompt should use visible-cut direction rows");
assert(!mountainRapidSeedancePrompt.includes("action beat: ："), "rapid prompt must not leak empty colon beat labels");
assert(!mountainRapidSeedancePrompt.includes("Cut 1: 霓虹启动"), "rapid prompt must not collapse all quick-cut beats into one Cut 1 block");
assert(!mountainRapidSeedancePrompt.includes("Follow exactly 1 primary storyboard panel(s)"), "rapid prompt must never downgrade planned quick-cut to one storyboard panel");

projectFacts = {
  projectVibe: {
    shots: [
      {
        id: "G01",
        title: "旧书店翻书",
        durationSeconds: 4,
        executionMode: "relationship_wide",
        rhythmProfile: "anime_emotion",
        intent: "清晨旧书店，女高中生侧身站在窗边书架前翻开旧书。",
        camera: "低机位轻微推入书架与窗边。",
        primaryAction: "她翻开旧书。",
        sceneGuidance: ["清晨旧书店"],
        characterGuidance: ["女高中生"],
        propGuidance: ["旧书"],
      },
      {
        id: "G02",
        title: "雾中站台",
        durationSeconds: 5,
        executionMode: "relationship_wide",
        rhythmProfile: "anime_emotion",
        intent: "雾中电车站台，女高中生抬头看见列车灯。",
        camera: "远景建立站台，再轻微推进角色侧脸。",
        primaryAction: "她看见雾中电车。",
        sceneGuidance: ["雾中电车站台"],
        characterGuidance: ["女高中生"],
        propGuidance: ["发光车票"],
      },
    ],
  },
};

const groupedRunRootRelativePath = ".vibe-runtime/test-current-project-seedance-mode-compiler-groups";
const groupedRunRootPath = path.resolve(repoRoot, groupedRunRootRelativePath);
rmSync(groupedRunRootPath, { recursive: true, force: true });
mkdirSync(groupedRunRootPath, { recursive: true });
const groupedBookstoreScenePath = path.join(groupedRunRootPath, "assets/bookstore_scene.png");
const groupedStationScenePath = path.join(groupedRunRootPath, "assets/station_scene.png");
const groupedCharacterPath = path.join(groupedRunRootPath, "assets/character.png");
const groupedPropPath = path.join(groupedRunRootPath, "assets/prop.png");
writeFile(groupedBookstoreScenePath, tinyPng);
writeFile(groupedStationScenePath, tinyPng);
writeFile(groupedCharacterPath, tinyPng);
writeFile(groupedPropPath, tinyPng);

const groupedSource = {
  ...source,
  runRootPath: groupedRunRootPath,
  runRootRelativePath: groupedRunRootRelativePath,
  projectVibePath: path.join(groupedRunRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${groupedRunRootRelativePath}/project/project.vibe`,
  previewPlanPath: path.join(groupedRunRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${groupedRunRootRelativePath}/reports/preview_plan.json`,
};

workbenchFacts.visualMemory.assets = [
  {
    type: "scene",
    name: "清晨旧书店",
    path: `${groupedRunRootRelativePath}/assets/bookstore_scene.png`,
    usedByShotIds: ["G01"],
  },
  {
    type: "scene",
    name: "雾中电车站台",
    path: `${groupedRunRootRelativePath}/assets/station_scene.png`,
    usedByShotIds: ["G02"],
  },
  {
    type: "character",
    name: "女高中生",
    path: `${groupedRunRootRelativePath}/assets/character.png`,
    usedByShotIds: ["G01", "G02"],
  },
  {
    type: "prop",
    name: "发光车票",
    path: `${groupedRunRootRelativePath}/assets/prop.png`,
    usedByShotIds: ["G02"],
  },
];

const groupedResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_groups",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  selectedShotIds: ["G02"],
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, groupedSource);

assert(groupedResponse.ok === true, `grouped submit should pass: ${JSON.stringify(groupedResponse)}`);
const groupedManifestPath = path.join(path.dirname(path.resolve(repoRoot, groupedResponse.promptPath)), "input-manifest.json");
const groupedManifest = JSON.parse(readFileSync(groupedManifestPath, "utf8"));
assert(groupedManifest.segmentPlan.length === 2, "different scene clusters should create two reference segments");
assert(groupedManifest.activeSegmentId === "segment_2", "selected shot should submit its own scene segment");
assert(groupedManifest.shots.length === 1 && groupedManifest.shots[0].id === "G02", "active segment should not mix unrelated scenes into one storyboard/video prompt");
assert(groupedManifest.references.some((ref: { role: string; name: string }) => ref.role === "scene_reference" && ref.name === "雾中电车站台"), "active segment should use its own scene baseline reference");
assert(!groupedManifest.references.some((ref: { role: string; name: string }) => ref.role === "scene_reference" && ref.name === "清晨旧书店"), "inactive scene reference must not be uploaded for the selected segment");
assert(groupedResponse.relayQueue?.maxConcurrentVideoJobs === 1, "segment relay queue must stay serial");
assert(groupedResponse.relayQueue?.activeItemIds?.length === 1, "submitted segment should become the only active relay item");
assert(groupedResponse.relayQueue?.items?.some((item: { segmentId: string; status: string; shotIds?: string[] }) =>
  item.segmentId === "segment_2" && item.status === "submitted" && item.shotIds?.[0] === "G02"
), "relay queue should persist the active selected scene segment");

const groupedBlockedResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_groups_blocked",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, groupedSource);

assert(groupedBlockedResponse.ok === false, "relay queue should block another submit while one segment is active");
assert(groupedBlockedResponse.relayQueue?.status === "running", "blocked relay response should expose the running queue state");
assert(String(groupedBlockedResponse.message || "").includes("已有视频段正在排队或生成"), "blocked relay message should be user-readable");

writeJson(path.join(groupedRunRootPath, "reports/video_relay_queue.json"), {
  items: [
    {
      id: "seedance_segment_1",
      segmentId: "segment_1",
      shotId: "G01",
      shotIds: ["G01"],
      title: "旧书店",
      status: "success",
      modelVersion: "seedance2.0",
      videoResolution: "720p",
      durationSeconds: 4,
      referencePaths: [],
      attemptCount: 1,
      blockers: [],
      notes: [],
    },
    {
      id: "seedance_segment_2",
      segmentId: "segment_2",
      shotId: "G02",
      shotIds: ["G02"],
      title: "车站",
      status: "ready",
      modelVersion: "seedance2.0",
      videoResolution: "720p",
      durationSeconds: 4,
      referencePaths: [],
      attemptCount: 0,
      blockers: [],
      notes: [],
    },
  ],
});
writeJson(groupedSource.previewPlanPath, {
  clips: [
    {
      id: "seedance_storyboard_video_segment_1",
      relayQueueItemId: "seedance_segment_1",
      segmentId: "segment_1",
      shotId: "G01",
      mediaPath: "video/segment1.mp4",
      status: "returned_with_review_overlay",
    },
  ],
  previewItems: [
    {
      id: "seedance_storyboard_video_segment_1",
      relayQueueItemId: "seedance_segment_1",
      segmentId: "segment_1",
      shotId: "G01",
      mediaPath: "video/segment1.mp4",
      status: "returned_with_review_overlay",
    },
  ],
});

const groupedAppendResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_groups_append",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  selectedShotIds: ["G02"],
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, groupedSource);

assert(groupedAppendResponse.ok === true, "relay queue should submit the next ready segment after a previous segment completed");
const appendedPreviewPlan = JSON.parse(readFileSync(groupedSource.previewPlanPath, "utf8"));
assert(appendedPreviewPlan.clips.length === 2, "preview plan should keep previous segment videos when appending the next segment");
assert(appendedPreviewPlan.clips.some((item: { segmentId?: string }) => item.segmentId === "segment_1"), "previous segment clip should remain visible");
assert(appendedPreviewPlan.clips.some((item: { segmentId?: string }) => item.segmentId === "segment_2"), "new segment clip should be added");

const longProjectShotCount = 36;
projectFacts = {
  projectVibe: {
    shots: Array.from({ length: longProjectShotCount }, (_, index) => ({
      id: `L0${index + 1}`,
      title: `长项目镜头 ${index + 1}`,
      durationSeconds: 4,
      executionMode: "single_continuous_shot",
      referenceStrategy: "omni_reference",
      rhythmProfile: "anime_emotion",
      intent: `清晨旧书店第 ${index + 1} 个连续镜头。`,
      camera: "缓慢推进，保持连续镜头。",
      primaryAction: "角色安静观察书架。",
      sceneGuidance: ["清晨旧书店"],
      characterGuidance: ["女高中生"],
    })),
  },
};

const longRunRootRelativePath = ".vibe-runtime/test-current-project-seedance-mode-compiler-long";
const longRunRootPath = path.resolve(repoRoot, longRunRootRelativePath);
rmSync(longRunRootPath, { recursive: true, force: true });
mkdirSync(longRunRootPath, { recursive: true });
writeFile(path.join(longRunRootPath, "assets/scene.png"), tinyPng);
writeFile(path.join(longRunRootPath, "assets/character.png"), tinyPng);
writeFile(path.join(longRunRootPath, "assets/unrelated-prop.png"), tinyPng);
const longSource = {
  ...source,
  runRootPath: longRunRootPath,
  runRootRelativePath: longRunRootRelativePath,
  projectVibePath: path.join(longRunRootPath, "project/project.vibe"),
  projectVibeRelativePath: `${longRunRootRelativePath}/project/project.vibe`,
  previewPlanPath: path.join(longRunRootPath, "reports/preview_plan.json"),
  previewPlanRelativePath: `${longRunRootRelativePath}/reports/preview_plan.json`,
};
workbenchFacts.visualMemory.assets = [
  { type: "scene", name: "清晨旧书店", path: `${longRunRootRelativePath}/assets/scene.png` },
  { type: "character", name: "女高中生", path: `${longRunRootRelativePath}/assets/character.png` },
  { type: "prop", name: "发光车票", path: `${longRunRootRelativePath}/assets/unrelated-prop.png`, usedByShotIds: ["OTHER_SHOT"] },
];
const longResponse = await route.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "receipt_test_long",
    confirmedAt: "2026-05-23T00:00:00.000Z",
  },
  selectedShotIds: ["L036"],
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, longSource);

assert(longResponse.ok === true, `long project selected shot should submit: ${JSON.stringify(longResponse)}`);
const longManifestPath = path.join(path.dirname(path.resolve(repoRoot, longResponse.promptPath)), "input-manifest.json");
const longManifest = JSON.parse(readFileSync(longManifestPath, "utf8"));
assert(longManifest.segmentPlan.length === longProjectShotCount, "long projects must keep every video segment in the relay plan without an artificial compiler cap");
assert(longManifest.activeSegmentId === `segment_${longProjectShotCount}`, "selected shot far beyond the old cap should be reachable");
assert(longManifest.shots.length === 1 && longManifest.shots[0].id === "L036", "selected long-project segment should contain the requested shot");
assert(!longManifest.references.some((ref: { role: string; name: string }) => ref.role === "prop_reference" && ref.name === "发光车票"), "unrelated prop fallback must not leak into a selected segment");

console.log("current-project-seedance-mode-compiler-test: ok");
