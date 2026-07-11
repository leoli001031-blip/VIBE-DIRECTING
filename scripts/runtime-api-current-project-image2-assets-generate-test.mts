import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProjectVibe, serializeProjectVibe } from "../src/project/index.ts";

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

function readProviderObservationByAsset(fixtureRoot, predicate) {
  const observationDir = repoPath(`${fixtureRoot}/provider_observations/assets`);
  const files = existsSync(observationDir)
    ? readdirSync(observationDir).filter((file) => file.endsWith(".json"))
    : [];
  for (const file of files) {
    const observation = readJson(path.join(observationDir, file));
    if (predicate(observation)) return observation;
  }
  throw new Error(`Provider observation not found in ${observationDir}`);
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
  const storyShots = [
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
      referenceStrategy: "storyboard_narrative",
      visibleClips: 1,
      storyboardPanels: 3,
      durationSeconds: 4,
      camera: "低机位轻推，建立旧书店空间与人物位置。",
      actionBeats: ["书架前停步", "手指触到旧书", "翻开书页"],
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
      characterGuidance: ["女高中生（手部）"],
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
  ];
  const projectShots = storyShots.map((shot) => ({
    id: shot.id,
    sectionId: shot.sectionId,
    title: shot.title,
    intent: shot.storyFunction,
    camera: shot.camera,
    referenceStrategy: shot.referenceStrategy,
    visibleClips: shot.visibleClips,
    storyboardPanels: shot.storyboardPanels,
    actionBeats: shot.actionBeats || [],
    characterGuidance: shot.characterGuidance || [],
    sceneGuidance: shot.sceneGuidance || [],
    propGuidance: shot.propGuidance || [],
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: shot.durationSeconds || 4,
    status: "planned",
    sourceRefs: [`project/story_flow.json#shots/${shot.id}`],
  }));
  const project = createProjectVibe({
    projectId: "current_project_image2_asset_generate",
    title: "Image2 Assets Generate",
    storyFlow: {
      id: "story_flow_current",
      sections: [{
        id: "act_asset",
        title: "Asset",
        summary: "Fixture shots for current-project reference generation.",
        sequenceIndex: 0,
        shotIds: [shotId, shot2Id, shot3Id],
      }],
      shotOrder: [shotId, shot2Id, shot3Id],
    },
    shots: projectShots,
  });
  mkdirSync(`${fixtureRoot}/project`, { recursive: true });
  writeFileSync(`${fixtureRoot}/project/project.vibe`, serializeProjectVibe(project), "utf8");
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_asset", label: "Asset", shotIds: [shotId, shot2Id, shot3Id] }],
    shots: storyShots,
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
      providerId: "apikey-fun-gpt55-responses-image",
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
    assets: [{
      id: "style_text_anime_90s",
      kind: "style",
      label: "文字风格方向",
      status: "candidate",
      textConstraints: [
        "项目视觉风格：1990年代日本TV动画，克制色彩，干净手绘赛璐珞上色，柔和手绘背景，无真人写实，无照片级真实感，无3D CG。",
      ],
      usedByShotIds: [shotId],
      sourceRefs: ["fixture:text_style"],
    }],
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

function createVendingTicketFixture(fixtureRoot) {
  const shotIds = ["V001", "V002", "V003"];
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_asset_generate_project_vibe_v1",
    projectId: "current_project_image2_asset_generate_vending_ticket",
    runId: "image2-assets-generate-vending-ticket",
    title: "Midnight Vending Ticket",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_vending_ticket", label: "Vending Ticket", shotIds }],
    shots: [
      {
        id: shotIds[0],
        title: "售货机吐出发光车票",
        sectionId: "act_vending_ticket",
        storyFunction: "午夜天桥下，老旧自动售货机忽然吐出一张发光车票，蓝光落在湿地上。",
        sceneGuidance: ["午夜天桥下", "旧自动售货机前"],
        characterGuidance: ["戴耳机的女高中生"],
        propGuidance: ["发光车票"],
        order: 1,
      },
      {
        id: shotIds[1],
        title: "少女拾起蓝光指引",
        sectionId: "act_vending_ticket",
        storyFunction: "少女在售货机旁蹲下，蓝光沿着积水指向月台方向。",
        sceneGuidance: ["售货机旁", "地面有积水", "背景天桥钢架"],
        characterGuidance: ["戴耳机的女高中生"],
        propGuidance: ["发光车票"],
        order: 2,
      },
      {
        id: shotIds[2],
        title: "追光跑向末班电车",
        sectionId: "act_vending_ticket",
        storyFunction: "她追着蓝光跑向天桥下月台，最后一班电车正缓缓启动。",
        sceneGuidance: ["天桥下月台", "最后一班电车正缓缓启动"],
        characterGuidance: ["戴耳机的女高中生"],
        propGuidance: ["发光车票"],
        order: 3,
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
  return shotIds;
}

function createReferenceFieldBoundaryFixture(fixtureRoot) {
  const shotId = "B001";
  writeJson(`${fixtureRoot}/project/project.vibe`, {
    schemaVersion: "current_project_image2_asset_generate_project_vibe_v1",
    projectId: "current_project_image2_asset_generate_reference_field_boundary",
    runId: "image2-assets-generate-reference-field-boundary",
    title: "Reference Field Boundary",
  });
  writeJson(`${fixtureRoot}/project/story_flow.json`, {
    schemaVersion: "current_project_image2_asset_generate_story_flow_v1",
    sections: [{ id: "act_boundary", label: "Boundary", shotIds: [shotId] }],
    shots: [{
      id: shotId,
      title: "雨夜发现",
      sectionId: "act_boundary",
      storyFunction: "场景：雨夜旧巴士站 角色：戴耳机女高中生 道具：发光车票 参考策略：故事板叙事 主动作：她蹲下接过车票",
      sceneGuidance: ["雨夜旧巴士站 参考策略：故事板叙事 镜头节奏：慢推"],
      characterGuidance: ["戴耳机女高中生 参考策略：全能参考 微反应：抬眼"],
      propGuidance: ["发光车票 参考策略：故事板叙事 主动作：她接过车票"],
      order: 1,
    }],
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
    VIBE_APIKEY_FUN_API_KEY: "fake-asset-generation-key",
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
      providerId: "apikey-fun-gpt55-responses-image",
      mockProviderResult: true,
    }),
  });
  assert(blocked.response.status === 409, "asset generation must require explicit confirmation");
  assert(blocked.payload.providerCalled === false, "blocked asset generation must not call provider");

  const agentTaskEnvelope = {
    id: "agent_tool_task_image2_assets_test_001",
    inputHash: "sha256:agent-tool-image2-assets-test",
    policyBinding: "director_agent_tool_handoff",
    actionId: "agent_action_image2_assets_test_001",
    handoffId: "agent_handoff_image2_assets_test_001",
    handler: "image2_reference_generation",
    expectedReceipt: "image_reference_receipt",
    preflight: {
      projectWriteReceiptRequired: true,
      ruleQaRequired: false,
      textQaRequired: false,
      noBgmGuardRequired: false,
      providerSubmitAfterPreflightOnly: false,
    },
  };
  const blockedBadAgentEnvelope = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "apikey-fun-gpt55-responses-image",
      assetTypes: ["character"],
      agentTaskEnvelope: {
        ...agentTaskEnvelope,
        expectedReceipt: "video_submit_receipt",
        preflight: {
          ...agentTaskEnvelope.preflight,
          textQaRequired: true,
        },
      },
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_bad_agent_envelope",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(blockedBadAgentEnvelope.response.status === 409, "Agent-triggered asset generation must validate the tool envelope");
  assert(blockedBadAgentEnvelope.payload.providerCalled === false, "invalid Agent reference envelope must not call provider");
  assert(blockedBadAgentEnvelope.payload.blockers.some((item: string) => item.includes("回执类型")), "invalid Agent reference envelope should explain receipt mismatch");
  const generated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "apikey-fun-gpt55-responses-image",
      assetTypes: ["character", "scene", "prop"],
      agentTaskEnvelope,
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
  assert(generated.payload.projectVibeWritten === true, `asset generation must write reviewable assets back to project.vibe: ${JSON.stringify({
    projectVibeError: generated.payload.projectVibeError,
    projectVibeSkipped: generated.payload.projectVibeSkipped,
    projectVibeAssetIds: generated.payload.projectVibeAssetIds,
  })}`);
  assert(generated.payload.runtimeExternalNetworkCallMade === false, "mock asset generation must not make network calls");
  assert(generated.payload.agentTaskEnvelopeId === agentTaskEnvelope.id, "asset generation should preserve the Agent tool task id");
  assert(generated.payload.agentTaskInputHash === agentTaskEnvelope.inputHash, "asset generation should preserve the Agent tool input hash");
  assert(generated.payload.agentTaskEnvelope.preflight.projectWriteReceiptRequired === true, "asset generation should preserve the Agent write preflight contract");
  assert(generated.payload.agentTaskEnvelope.preflight.textQaRequired === false, "asset generation should not inherit video text QA preflight");
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
  const projectAfterGeneration = readJson(projectVibePath);
  assert(projectAfterGeneration.assets.length === 3, "project.vibe should receive the three generated reference assets");
  assert(projectAfterGeneration.visualMemory.entries.length === 3, "project.vibe visual memory should receive review entries");
  assert(projectAfterGeneration.assets.every((asset) => asset.status === "needs_review"), "generated project.vibe assets should wait for review");
  assert(projectAfterGeneration.visualMemory.entries.every((entry) => entry.canUseAsFutureReference === false), "unreviewed references must not become future authority");
  assert(projectAfterGeneration.assets.every((asset) => !asset.path.startsWith(fixtureRoot)), "project.vibe asset paths should be project-root-relative");
  assert(projectAfterGeneration.assets.every((asset) => asset.sourceReceiptId), "generated project.vibe assets should carry source receipt evidence for review locking");
  assert(projectAfterGeneration.assets.every((asset) => asset.outputHash), "generated project.vibe assets should carry output hashes for review locking");
  assert(projectAfterGeneration.assets.every((asset) => asset.providerObservationPath), "generated project.vibe assets should expose provider observation paths");
  const firstShotAfterGeneration = projectAfterGeneration.shots.find((shot) => shot.id === shotId);
  assert(firstShotAfterGeneration.characterAssetIds.includes("char_mika"), "project.vibe shot should bind generated character asset");
  assert(firstShotAfterGeneration.sceneAssetIds.includes("scene_morning_bookstore"), "project.vibe shot should bind generated scene asset");
  assert(firstShotAfterGeneration.propAssetIds.includes("prop_old_book"), "project.vibe shot should bind generated prop asset");
  const characterObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/character_char_mika.json`));
  assert(characterObservation.requestPromptVersion === "reference_asset_prompt_v3", "asset provider observation should record the multi-view prompt contract version");
  assert(characterObservation.requestPromptText.includes("character model sheet / multi-view identity reference"), "character asset prompt should request a multi-view model sheet");
  assert(characterObservation.requestPromptText.includes("front, three-quarter, side, and back"), "character asset prompt should request multiple consistent views");
  const sceneObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/scene_scene_morning_bookstore.json`));
  assert(sceneObservation.requestPromptVersion === "reference_asset_prompt_v3", "asset provider observation should record prompt contract version");
  assert(sceneObservation.requestPromptText.includes("清晨旧书店"), "scene asset prompt must use the scene name");
  assert(sceneObservation.requestPromptText.includes("木地板"), "scene asset prompt must preserve scene-specific guidance");
  assert(sceneObservation.requestPromptText.includes("Do not make a multi-view sheet"), "scene asset prompt should remain a single coherent baseline plate");
  assert(sceneObservation.requestPromptText.includes("No train station"), "bookstore scene prompt must guard against station contamination");
  assert(!sceneObservation.requestPromptText.includes("rainy night train platform"), "scene asset prompt must not contain the old hardcoded train-platform prompt");
  const propObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/prop_prop_old_book.json`));
  assert(propObservation.requestPromptVersion === "reference_asset_prompt_v3", "prop provider observation should record the multi-angle prompt contract version");
  assert(propObservation.requestPromptText.includes("multi-angle prop/object reference sheet"), "prop prompt should request a multi-angle object sheet");
  assert(propObservation.requestPromptText.includes("front/side/back or top/side/detail"), "prop prompt should request practical object angles");
  assert(!propObservation.requestPromptText.includes("worn old train ticket"), "prop prompt must not contain the old hardcoded ticket prompt");

  const storyboardGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      providerId: "apikey-fun-gpt55-responses-image",
      assetTypes: ["storyboard"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_storyboard_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(storyboardGenerated.response.status === 200, `storyboard generation should pass: ${storyboardGenerated.payload.message}`);
  assert(storyboardGenerated.payload.generatedAssetCount === 1, "storyboard generation should create one storyboard reference");
  const storyboardAsset = storyboardGenerated.payload.assets[0];
  assert(storyboardAsset.type === "storyboard", "storyboard result should preserve storyboard type");
  assert(storyboardAsset.usedByShotIds.join(",") === shotId, "storyboard reference should bind to the active shot");
  const storyboardObservation = readJson(repoPath(storyboardAsset.providerObservationPath));
  assert(storyboardObservation.providerSlot === "image.storyboard_reference", "storyboard provider observation should use storyboard slot");
  assert(storyboardObservation.requestPromptVersion === "storyboard_reference_prompt_v3", "storyboard prompt version should be explicit");
  assert(storyboardObservation.requestPromptText.includes("Panel count: exactly 3"), "storyboard prompt should preserve panel count");
  assert(storyboardObservation.requestPromptText.includes("Final visible video clips: exactly 1"), "storyboard prompt should separate visible clips from panels");
  assert(storyboardObservation.referenceImageCount >= 3, "storyboard generation should use generated character/scene/prop references when available");
  const storyboardVisualMemory = readJson(repoPath(`${fixtureRoot}/project/visual_memory.json`));
  const storedStoryboard = storyboardVisualMemory.entries.find((asset) => asset.id === `storyboard_reference_${shotId}`);
  assert(storedStoryboard?.type === "storyboard_reference", "visual memory should store storyboard references as reusable entries");
  assert(storyboardVisualMemory.assets.find((asset) => asset.id === `storyboard_reference_${shotId}`)?.type === "storyboard_reference", "visual memory should keep legacy assets compatibility for storyboard references");
  assert(storedStoryboard?.usedByShotIds.includes(shotId), "visual memory storyboard should bind to its shot");
  const projectAfterStoryboard = readJson(projectVibePath);
  assert(projectAfterStoryboard.assets.find((asset) => asset.id === `storyboard_reference_${shotId}`)?.kind === "reference", "project.vibe should store storyboard as reference asset");
  assert(!projectAfterStoryboard.shots.find((shot) => shot.id === shotId).propAssetIds.includes(`storyboard_reference_${shotId}`), "storyboard reference must not be mixed into prop asset ids");

  const projectGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope: "project",
      providerId: "apikey-fun-gpt55-responses-image",
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
  assert(projectGenerated.payload.generatedAssetCount === 4, "project-scope asset generation should reuse existing references and only prepare missing bindings/assets");
  assert(!projectGenerated.payload.assets.some((asset) => /手|hand/i.test(asset.name || asset.id)), "body-part shot details must not become standalone reference assets");
  assert(!projectGenerated.payload.assets.some((asset) => asset.type === "prop" && asset.id === "char_mika"), "character subjects repeated in prop fields must not generate duplicate prop references");
  assert(!projectGenerated.payload.assets.some((asset) => asset.type === "prop" && /storyboard|分镜/i.test(asset.id || asset.name)), "storyboard references must not be regenerated as prop assets");

  const fullVisualMemory = readJson(repoPath(`${fixtureRoot}/project/visual_memory.json`));
  assert(fullVisualMemory.roles.length === 1, "project-scope generation should dedupe shared character assets");
  assert(!fullVisualMemory.roles.some((role) => /手|hand/i.test(role.displayName || role.name || role.id)), "visual memory must not promote hands into character assets");
  assert(fullVisualMemory.scenes.length === 1, "project-scope generation should dedupe scene variants that one scene baseline can cover");
  assert(fullVisualMemory.scenes[0].usedByShotIds.length === 3, "shared scene baseline should bind to all shots in the same old-bookstore cluster");
  assert(fullVisualMemory.props.length === 3, "project-scope generation should create all prop references");
  assert(!fullVisualMemory.props.some((prop) => prop.id === "char_mika"), "visual memory must not contain a character duplicate in props");
  const deskObservation = readJson(repoPath(`${fixtureRoot}/provider_observations/assets/scene_scene_morning_bookstore.json`));
  assert(deskObservation.requestPromptText.includes("No train station"), "project-scope bookstore scene prompt must guard against train-station contamination");
  const ticketObservation = readProviderObservationByAsset(
    fixtureRoot,
    (observation) => observation.assetType === "prop" && /发光车票/.test(`${observation.assetId} ${observation.assetName}`),
  );
  assert(ticketObservation.requestPromptText.includes("发光车票"), "project-scope prop prompt must use prop-specific guidance");
  assert(!ticketObservation.requestPromptText.includes("worn old train ticket"), "project-scope prop prompt must not reuse old hardcoded ticket prompt");
  assert(statSync(projectVibePath).mtimeMs >= projectVibeMtime, "project.vibe should be allowed to receive generated reference metadata");
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
      providerId: "apikey-fun-gpt55-responses-image",
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
      providerId: "apikey-fun-gpt55-responses-image",
      assetTypes: ["character", "scene", "prop"],
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
  assert(!convenienceGenerated.payload.assets.some((asset) => /style|风格/u.test(`${asset.id} ${asset.name} ${asset.label || ""}`)), "text-only style assets must not be generated as prop references");
  assert(!convenienceGenerated.payload.assets.some((asset) => /山路|mountain/u.test(`${asset.id} ${asset.name}`)), "convenience-store scene must not be misclassified as mountain road");
  const convenienceSceneObservation = readJson(repoPath(`${convenienceFixtureRoot}/provider_observations/assets/scene_scene_convenience_store.json`));
  assert(convenienceSceneObservation.requestPromptText.includes("山脚便利店门口"), "convenience-store prompt should preserve the source location wording");
  assert(!convenienceSceneObservation.requestPromptText.includes("雨夜山路环境"), "convenience-store prompt must not inherit mountain-road cluster wording");
  assert(convenienceSceneObservation.requestPromptText.includes("Project visual style lock"), "convenience-store scene prompt should inherit text-only style assets");
  assert(convenienceSceneObservation.requestPromptText.includes("无真人写实"), "convenience-store scene prompt should preserve no-photoreal style constraints");

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
      providerId: "apikey-fun-gpt55-responses-image",
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

  const vendingFixtureRoot = `real-test-sandbox/current-project-image2-assets-generate-vending-ticket/${Date.now()}`;
  createVendingTicketFixture(vendingFixtureRoot);
  const vendingSelect = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: vendingFixtureRoot, projectId: "current_project_image2_asset_generate_vending_ticket", displayName: "Midnight Vending Ticket" }),
  });
  assert(vendingSelect.response.status === 200, "vending-ticket fixture should bind");
  const vendingGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope: "project",
      providerId: "apikey-fun-gpt55-responses-image",
      assetTypes: ["character", "scene", "prop"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_vending_ticket_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(vendingGenerated.response.status === 200, `vending-ticket asset generation should pass: ${vendingGenerated.payload.message}`);
  assert(vendingGenerated.payload.generatedAssetCount === 4, "vending-ticket project should create one character, two real scene baselines, and one ticket prop");
  assert(!vendingGenerated.payload.assets.some((asset) => /售货机旁|自动售货机前|地面有积水/u.test(`${asset.id} ${asset.name}`)), "relative scene labels must not become standalone generated assets");
  const vendingVisualMemory = readJson(repoPath(`${vendingFixtureRoot}/project/visual_memory.json`));
  assert(vendingVisualMemory.roles.length === 1, "vending-ticket project should dedupe the shared heroine");
  assert(vendingVisualMemory.props.length === 1, "vending-ticket project should dedupe the shared glowing ticket prop");
  assert(vendingVisualMemory.scenes.length === 2, "vending-ticket project should keep only the two real scene baselines");
  assert(vendingVisualMemory.scenes.some((scene) => scene.usedByShotIds.includes("V002")), "relative middle shot should attach to the carried scene baseline");

  const boundaryFixtureRoot = `real-test-sandbox/current-project-image2-assets-generate-reference-boundary/${Date.now()}`;
  const boundaryShotId = createReferenceFieldBoundaryFixture(boundaryFixtureRoot);
  const boundarySelect = await fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: boundaryFixtureRoot, projectId: "current_project_image2_asset_generate_reference_field_boundary", displayName: "Reference Field Boundary" }),
  });
  assert(boundarySelect.response.status === 200, "reference-field-boundary fixture should bind");
  const boundaryGenerated = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-assets/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: boundaryShotId,
      selectedShotIds: [boundaryShotId],
      providerId: "apikey-fun-gpt55-responses-image",
      assetTypes: ["character", "scene", "prop"],
      mockProviderResult: true,
      confirmation: {
        receiptId: "confirm_assets_reference_field_boundary_mock_ok",
        confirmedAt: new Date().toISOString(),
        phrase: "generate-image2-assets",
        confirmed: true,
      },
    }),
  });
  assert(boundaryGenerated.response.status === 200, `reference-field-boundary asset generation should pass: ${boundaryGenerated.payload.message}`);
  assert(boundaryGenerated.payload.generatedAssetCount === 3, "field-boundary generation should create one character, one scene, and one prop");
  const pollutedFieldPattern = /参考策略|主动作|触发|微反应|镜头节奏/u;
  assert(!boundaryGenerated.payload.assets.some((asset) => pollutedFieldPattern.test(`${asset.id} ${asset.name}`)), "generated asset identities must strip adjacent planning fields");
  const boundaryTicketObservation = readProviderObservationByAsset(
    boundaryFixtureRoot,
    (observation) => observation.assetType === "prop" && /发光车票/.test(`${observation.assetId} ${observation.assetName}`),
  );
  assert(!pollutedFieldPattern.test(`${boundaryTicketObservation.assetId} ${boundaryTicketObservation.assetName}`), "provider observations must store clean prop identity");
  assert(!pollutedFieldPattern.test(boundaryTicketObservation.requestPromptText), "provider prompt must not include planning field spillover as prop description");

  console.log(`runtime-api-current-project-image2-assets-generate-test: ok ${fixtureRoot}`);
} finally {
  await stopServer(child);
  rmSync(tempRoot, { recursive: true, force: true });
}
