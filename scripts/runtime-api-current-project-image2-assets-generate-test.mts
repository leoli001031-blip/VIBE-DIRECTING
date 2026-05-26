import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function repoPath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`)), 15000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
          return;
        } catch {
          // Wait for a complete JSON line.
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function stopServer(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

function spawnRuntimeServer(env) {
  return spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createFixture(fixtureRoot) {
  const shotId = "A001";
  const shot2Id = "A002";
  const shot3Id = "A003";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_asset_generate_project_vibe_v1",
    projectId: "current_project_image2_asset_generate",
    runId: "image2-assets-generate",
    title: "Image2 Assets Generate",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_asset", label: "Asset", shotIds: [shotId, shot2Id, shot3Id] }],
    shots: [
      {
        id: shotId,
        title: "清晨旧书店",
        sectionId: "act_asset",
        sceneId: "scene_morning_bookstore",
        roleIds: ["char_mika"],
        propIds: ["prop_old_book"],
        storyFunction: "清晨旧书店，木地板和高书架泛着冷光。Mika 侧身站在书架前，翻开一本旧书，窗外有淡雾。",
        sceneGuidance: ["清晨旧书店", "木地板", "高书架", "窗外淡雾"],
        characterGuidance: ["Mika 戴耳机，女高中生，安静观察"],
        propGuidance: ["一本磨损的旧书"],
        order: 1,
      },
      {
        id: shot2Id,
        title: "发光车票",
        sectionId: "act_asset",
        sceneId: "scene_bookstore_desk",
        propIds: ["char_mika", "prop_glowing_ticket"],
        storyFunction: "旧书店书桌前，Mika 发现夹在书页里的发光车票，蓝色微光照亮她的指尖。",
        sceneGuidance: ["旧书店书桌前", "堆叠旧书", "清晨冷光"],
        characterGuidance: ["女高中生的手"],
        propGuidance: ["发光车票"],
        order: 2,
      },
      {
        id: shot3Id,
        title: "雾中电车",
        sectionId: "act_asset",
        sceneId: "scene_foggy_street_window",
        roleIds: ["char_mika"],
        propIds: ["prop_tram"],
        storyFunction: "旧书店窗边与雾中街道，远处电车从雾里缓慢驶过。",
        sceneGuidance: ["旧书店窗边", "雾中街道", "清晨"],
        propGuidance: ["电车"],
        order: 3,
      },
    ],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_image2_asset_generate_visual_memory_v1",
    roles: [{ id: "char_mika", displayName: "Mika", status: "missing", usedByShotIds: [shotId] }],
    scenes: [{ id: "scene_morning_bookstore", displayName: "清晨旧书店", status: "candidate", usedByShotIds: [shotId] }],
    props: [{ id: "prop_old_book", displayName: "旧书", status: "missing", usedByShotIds: [shotId] }],
    style: { id: "style_clean", displayName: "Clean cinematic", status: "locked", path: `${fixtureRoot}/assets/style.md` },
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_image2_asset_generate_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`, `${fixtureRoot}/run_manifest.json`],
  });
  writeJson(`${fixtureRoot}/run_manifest.json`, {
    schemaVersion: "current_project_image2_asset_generate_manifest_v1",
    projectId: "current_project_image2_asset_generate",
    runId: "image2-assets-generate",
    shotPlans: [{
      shotId,
      order: 1,
      providerId: "lanyi-image2",
      providerSlot: "image.generate",
      expectedOutputPath: `${fixtureRoot}/outputs/shots/${shotId}/start.png`,
    }],
  });
  return shotId;
}

function createRainyNeonFixture(fixtureRoot) {
  const shotId = "N001";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_asset_generate_project_vibe_v1",
    projectId: "current_project_image2_asset_generate_rainy_neon",
    runId: "image2-assets-generate-rainy-neon",
    title: "Rainy Neon Repair",
    receipts: {
      scriptPlanningReceipts: [{
        evidenceRefs: [
          "director_turn:intake_风格_1990_年代日本_tv_动画_克制色彩_手绘赛璐珞质感",
          "staged_fact:intake_no_photoreal_no_3d",
        ],
      }],
    },
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_rainy_neon", label: "Rainy Neon", shotIds: [shotId] }],
    shots: [
      {
        id: shotId,
        title: "雨夜霓虹抢修",
        sectionId: "act_rainy_neon",
        sceneId: "scene_rainy_city_street",
        storyFunction: "雨夜城市屋顶霓虹招牌闪烁，湿漉漉的街道被粉蓝色光照亮，黄色雨衣女生和小型维修机器人一起抢修。",
        sceneGuidance: ["雨夜城市屋顶霓虹招牌旁", "湿漉漉的街道", "粉蓝色霓虹反光"],
        propGuidance: ["霓虹招牌", "梯子", "电线", "检修盒"],
        order: 1,
      },
    ],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_image2_asset_generate_visual_memory_v1",
    roles: [],
    scenes: [],
    props: [],
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_image2_asset_generate_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`],
  });
  return shotId;
}

function createConvenienceStoreFixture(fixtureRoot) {
  const shotId = "C001";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_asset_generate_project_vibe_v1",
    projectId: "current_project_image2_asset_generate_convenience_store",
    runId: "image2-assets-generate-convenience-store",
    title: "Rainy Convenience Store Cat",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_convenience_store", label: "Convenience Store", shotIds: [shotId] }],
    shots: [
      {
        id: shotId,
        title: "门旁黑猫",
        sectionId: "act_convenience_store",
        sceneId: "scene_convenience_store_entrance",
        storyFunction: "山脚便利店门口，雨夜湿地映出霓虹。黑猫坐在自动门旁不动，招牌忽明忽暗，店内冷白光隔着玻璃闪烁。",
        sceneGuidance: ["山脚便利店门口", "雨夜", "自动门旁", "店内冷白光", "湿地反光"],
        propGuidance: ["无"],
        order: 1,
      },
    ],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_image2_asset_generate_visual_memory_v1",
    roles: [],
    scenes: [],
    props: [],
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_image2_asset_generate_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`],
  });
  return shotId;
}

function createWhaleTramFixture(fixtureRoot) {
  const shotId = "W001";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_asset_generate_project_vibe_v1",
    projectId: "current_project_image2_asset_generate_whale_tram",
    runId: "image2-assets-generate-whale-tram",
    title: "Whale Tram Lighthouse",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_whale_tram", label: "Whale Tram", shotIds: [shotId] }],
    shots: [
      {
        id: shotId,
        title: "鲸鱼电车浮现",
        sectionId: "act_whale_tram",
        sceneId: "海雾中的鲸鱼电车与海面",
        storyFunction: "大全景，海面雾气中出现像鲸鱼一样发光的电车，车窗里有海水和星光，少女灯塔维修员在远处灯塔里望向海面。",
        sceneGuidance: ["海雾中的鲸鱼电车与海面", "海面", "雾气", "发光电车", "远处灯塔"],
        propGuidance: ["无"],
        order: 1,
      },
    ],
  });
  writeJson(`${fixtureRoot}/project/visual_memory.json`, {
    schemaVersion: "current_project_image2_asset_generate_visual_memory_v1",
    roles: [],
    scenes: [{
      id: "scene_lighthouse_interior",
      displayName: "灯塔内部维修室",
      status: "needs_review",
      path: `${fixtureRoot}/assets/generated/scene_scene_lighthouse_interior.png`,
      usedByShotIds: ["OLD_INTERIOR"],
    }],
    props: [],
  });
  writeJson(`${fixtureRoot}/project/source_index.json`, {
    schemaVersion: "current_project_image2_asset_generate_source_index_v1",
    refs: [`${fixtureRoot}/project/project.vibe`, `${fixtureRoot}/project/story_flow.json`, `${fixtureRoot}/project/visual_memory.json`],
  });
  return shotId;
}

const fixtureRoot = `real-test-sandbox/current-project-image2-assets-generate/${Date.now()}`;
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-image2-assets-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const shotId = createFixture(fixtureRoot);
const projectVibePath = repoPath(`${fixtureRoot}/project/project.vibe`);
const projectVibeMtime = statSync(projectVibePath).mtimeMs;
let child;

try {
  child = spawnRuntimeServer({
    HOME: tempRoot,
    VIBE_IMAGE2_API_KEY: "fake-asset-generation-key",
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  });
  const { baseUrl } = await waitForServer(child);
  const select = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: fixtureRoot, projectId: "current_project_image2_asset_generate", displayName: "Image2 Assets Generate" }),
  });
  assert(select.response.status === 200, "fixture should bind");

  const blocked = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "lanyi-image2",
      mockProviderResult: true,
    }),
  });
  assert(blocked.response.status === 409, "asset generation must require explicit confirmation");
  assert(blocked.payload.providerCalled === false, "blocked asset generation must not call provider");

  const generated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "lanyi-image2",
      assetTypes: ["character", "scene", "prop"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(generated.response.status === 200, `confirmed asset generation should pass: ${generated.payload.message}`);
  assert(generated.payload.status === "needs_review", "asset generation should return needs_review");
  assert(generated.payload.generatedAssetCount === 3, "asset generation should create three references for the selected shot");
  assert(generated.payload.scope === "selected_shots", "default asset generation scope should preserve selected-shot behavior");
  assert(generated.payload.visualMemoryWritten === true, "asset generation should update visual memory");
  assert(generated.payload.projectVibeWritten === false, "asset generation must not write project.vibe");
  assert(generated.payload.runtimeExternalNetworkCallMade === false, "mock asset generation must not make network calls");
  for (const asset of generated.payload.assets) {
    assert(asset.status === "needs_review", "generated assets must enter review first");
    assert(asset.imageUrl, "generated assets should expose runtime image URLs");
    assert(existsSync(repoPath(asset.path)), `generated asset output should exist: ${asset.path}`);
  }

  const visualMemory = readJson(repoPath(`${fixtureRoot}/project/visual_memory.json`));
  assert(visualMemory.roles[0].status === "needs_review", "character reference should be pending review");
  assert(visualMemory.scenes[0].status === "needs_review", "scene reference should be pending review");
  assert(visualMemory.props[0].status === "needs_review", "prop reference should be pending review");
  assert(visualMemory.roles[0].path.endsWith(".png"), "character reference should point to generated media");
  const sceneObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/scene_scene_morning_bookstore.json`));
  assert(sceneObservation.requestPromptVersion === "reference_asset_prompt_v2", "asset provider observation should record prompt contract version");
  assert(sceneObservation.requestPromptText.includes("清晨旧书店"), "scene asset prompt must use the scene name");
  assert(sceneObservation.requestPromptText.includes("木地板"), "scene asset prompt must preserve scene-specific guidance");
  assert(sceneObservation.requestPromptText.includes("No train station"), "bookstore scene prompt must guard against station contamination");
  assert(!sceneObservation.requestPromptText.includes("rainy night train platform"), "scene asset prompt must not contain the old hardcoded train-platform prompt");
  const propObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/prop_prop_old_book.json`));
  assert(!propObservation.requestPromptText.includes("worn old train ticket"), "prop prompt must not contain the old hardcoded ticket prompt");

  const projectGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope: "project",
      providerId: "lanyi-image2",
      assetTypes: ["character", "scene", "prop"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_project_scope_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(projectGenerated.response.status === 200, `project-scope asset generation should pass: ${projectGenerated.payload.message}`);
  assert(projectGenerated.payload.scope === "project", "project-scope asset generation should report project scope");
  assert(projectGenerated.payload.selectedShotIds.length === 3, "project-scope asset generation should scan all project shots");
  assert(projectGenerated.payload.generatedAssetCount === 5, "project-scope asset generation should reuse one scene baseline for the old-bookstore sequence");
  assert(!projectGenerated.payload.assets.some((asset) => /手|hand/i.test(asset.name || asset.id)), "body-part shot details must not become standalone reference assets");
  assert(!projectGenerated.payload.assets.some((asset) => asset.type === "prop" && asset.id === "char_mika"), "character subjects repeated in prop fields must not generate duplicate prop references");

  const fullVisualMemory = readJson(repoPath(`${fixtureRoot}/project/visual_memory.json`));
  assert(fullVisualMemory.roles.length === 1, "project-scope generation should dedupe shared character assets");
  assert(!fullVisualMemory.roles.some((role) => /手|hand/i.test(role.displayName || role.name || role.id)), "visual memory must not promote hands into character assets");
  assert(fullVisualMemory.scenes.length === 1, "project-scope generation should dedupe scene variants that one scene baseline can cover");
  assert(fullVisualMemory.scenes[0].usedByShotIds.length === 3, "shared scene baseline should bind to all shots in the same old-bookstore cluster");
  assert(fullVisualMemory.props.length === 3, "project-scope generation should create all prop references");
  assert(!fullVisualMemory.props.some((prop) => prop.id === "char_mika"), "visual memory must not contain a character duplicate in props");
  const deskObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/scene_scene_morning_bookstore.json`));
  assert(deskObservation.requestPromptText.includes("旧书店书桌前"), "shared scene prompt must keep second-shot scene guidance");
  assert(deskObservation.requestPromptText.includes("No train station"), "project-scope bookstore scene prompt must guard against train-station contamination");
  const ticketObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/prop_prop_glowing_ticket.json`));
  assert(ticketObservation.requestPromptText.includes("发光车票"), "project-scope prop prompt must use prop-specific guidance");
  assert(!ticketObservation.requestPromptText.includes("worn old train ticket"), "project-scope prop prompt must not reuse old hardcoded ticket prompt");
  assert(statSync(projectVibePath).mtimeMs === projectVibeMtime, "project.vibe must not be mutated by asset generation");
  assert(JSON.stringify(generated.payload).includes("fake-asset-generation-key") === false, "payload must not include raw key material");

  const rainyFixtureRoot = `real-test-sandbox/current-project-image2-assets-generate-rainy-neon/${Date.now()}`;
  const rainyShotId = createRainyNeonFixture(rainyFixtureRoot);
  const rainySelect = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: rainyFixtureRoot, projectId: "current_project_image2_asset_generate_rainy_neon", displayName: "Rainy Neon Repair" }),
  });
  assert(rainySelect.response.status === 200, "rainy-neon fixture should bind");
  const rainyGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: rainyShotId,
      selectedShotIds: [rainyShotId],
      providerId: "lanyi-image2",
      assetTypes: ["scene", "prop"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_rainy_neon_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(rainyGenerated.response.status === 200, `rainy-neon asset generation should pass: ${rainyGenerated.payload.message}`);
  assert(rainyGenerated.payload.generatedAssetCount === 2, "rainy-neon generation should create one city scene and one parent sign prop only");
  assert(!rainyGenerated.payload.assets.some((asset) => /山路|mountain|梯子|电线|检修盒/u.test(`${asset.id} ${asset.name}`)), "wet city street and repair details must not become mountain-road or standalone detail assets");
  const rainySceneObservation = readJson(repoPath(`${rainyFixtureRoot}/provider_observations/assets/scene_scene_street.json`));
  assert(rainySceneObservation.requestPromptText.includes("湿漉漉的街道"), "rainy city street scene prompt should preserve wet-street guidance");
  assert(rainySceneObservation.requestPromptText.includes("粉蓝色霓虹反光"), "rainy city street scene prompt should preserve neon reflection guidance");
  assert(!rainySceneObservation.requestPromptText.includes("雨夜山路"), "rainy city street scene prompt must not be misclassified as mountain road");
  assert(rainySceneObservation.requestPromptText.includes("Style lock: clean 2D Japanese TV anime"), "asset prompts should carry project-level anime style hints");
  const rainySignAsset = rainyGenerated.payload.assets.find((asset) => asset.type === "prop" && asset.name === "霓虹招牌");
  assert(rainySignAsset?.providerObservationPath, "rainy-neon sign prop should expose its provider observation");
  const rainyPropObservation = readJson(repoPath(rainySignAsset.providerObservationPath));
  assert(rainyPropObservation.requestPromptText.includes("梯子"), "parent sign prop prompt should carry repair-tool constraints as text");
  assert(rainyPropObservation.requestPromptText.includes("电线"), "parent sign prop prompt should carry wire constraints as text");
  assert(rainyPropObservation.requestPromptText.includes("检修盒"), "parent sign prop prompt should carry repair-hatch constraints as text");

  const convenienceFixtureRoot = `real-test-sandbox/current-project-image2-assets-generate-convenience-store/${Date.now()}`;
  const convenienceShotId = createConvenienceStoreFixture(convenienceFixtureRoot);
  const convenienceSelect = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: convenienceFixtureRoot, projectId: "current_project_image2_asset_generate_convenience_store", displayName: "Rainy Convenience Store Cat" }),
  });
  assert(convenienceSelect.response.status === 200, "convenience-store fixture should bind");
  const convenienceGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: convenienceShotId,
      selectedShotIds: [convenienceShotId],
      providerId: "lanyi-image2",
      assetTypes: ["scene"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_convenience_store_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(convenienceGenerated.response.status === 200, `convenience-store asset generation should pass: ${convenienceGenerated.payload.message}`);
  assert(convenienceGenerated.payload.generatedAssetCount === 1, "convenience-store generation should create one scene baseline");
  assert(!convenienceGenerated.payload.assets.some((asset) => /山路|mountain/u.test(`${asset.id} ${asset.name}`)), "convenience-store scene must not be misclassified as mountain road");
  const convenienceSceneObservation = readJson(repoPath(`${convenienceFixtureRoot}/provider_observations/assets/scene_scene_convenience_store.json`));
  assert(convenienceSceneObservation.requestPromptText.includes("山脚便利店门口"), "convenience-store prompt should preserve the source location wording");
  assert(!convenienceSceneObservation.requestPromptText.includes("雨夜山路环境"), "convenience-store prompt must not inherit mountain-road cluster wording");

  const whaleFixtureRoot = `real-test-sandbox/current-project-image2-assets-generate-whale-tram/${Date.now()}`;
  const whaleShotId = createWhaleTramFixture(whaleFixtureRoot);
  const whaleSelect = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: whaleFixtureRoot, projectId: "current_project_image2_asset_generate_whale_tram", displayName: "Whale Tram Lighthouse" }),
  });
  assert(whaleSelect.response.status === 200, "whale-tram fixture should bind");
  const whaleGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: whaleShotId,
      selectedShotIds: [whaleShotId],
      providerId: "lanyi-image2",
      assetTypes: ["scene"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_whale_tram_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(whaleGenerated.response.status === 200, `whale-tram asset generation should pass: ${whaleGenerated.payload.message}`);
  assert(whaleGenerated.payload.generatedAssetCount === 1, "whale-tram generation should create the explicit whale-tram ocean scene");
  const whaleSceneAsset = whaleGenerated.payload.assets.find((asset) => asset.type === "scene");
  assert(whaleSceneAsset?.id === "scene_whale_tram_ocean", `whale-tram scene should not reuse lighthouse interior: ${whaleSceneAsset?.id}`);
  const whaleVisualMemory = readJson(repoPath(`${whaleFixtureRoot}/project/visual_memory.json`));
  assert(whaleVisualMemory.scenes.some((scene) => scene.id === "scene_whale_tram_ocean"), "visual memory should add whale-tram ocean scene");
  assert(!whaleVisualMemory.scenes.find((scene) => scene.id === "scene_lighthouse_interior")?.usedByShotIds.includes(whaleShotId), "explicit whale-tram scene must not attach to lighthouse interior");

  console.log(`runtime-api-current-project-image2-assets-generate-test: ok ${fixtureRoot}`);
} finally {
  await stopServer(child);
  rmSync(tempRoot, { recursive: true, force: true });
}
