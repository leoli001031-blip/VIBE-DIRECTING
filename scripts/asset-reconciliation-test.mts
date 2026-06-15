import { buildAssetReconciliationProjection } from "../src/core/assetReconciliation.ts";
import type { AssetRecord, ShotRecord } from "../src/core/types/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asset(input: Partial<AssetRecord> & Pick<AssetRecord, "id" | "type" | "name">): AssetRecord {
  return {
    id: input.id,
    type: input.type,
    name: input.name,
    path: input.path || `/project/assets/${input.name}.png`,
    status: input.status || "exists",
    lockedStatus: input.lockedStatus || "locked",
    safeForFutureReference: input.safeForFutureReference ?? true,
    issues: input.issues || [],
    usedByShotIds: input.usedByShotIds,
    sourceRefs: input.sourceRefs,
    textConstraints: input.textConstraints,
    roleBinding: input.roleBinding,
  };
}

function shot(input: Partial<ShotRecord> & Pick<ShotRecord, "id" | "title">): ShotRecord {
  return {
    id: input.id,
    actId: input.actId || "act_1",
    title: input.title,
    storyFunction: input.storyFunction || input.title,
    status: input.status || "video_missing",
    gates: input.gates || {},
    issues: input.issues || [],
    referenceStrategy: input.referenceStrategy || "omni_reference",
    characterGuidance: input.characterGuidance,
    sceneGuidance: input.sceneGuidance,
    propGuidance: input.propGuidance,
    dialogueLines: input.dialogueLines,
    audioUsage: input.audioUsage,
    sound: input.sound,
  };
}

const projection = buildAssetReconciliationProjection({
  shots: [
    shot({
      id: "shot_1",
      title: "山路启动",
      referenceStrategy: "storyboard_rapid_cut",
      characterGuidance: ["白车车手", "黑车车手"],
      sceneGuidance: ["山脚便利店外山路", "雨雾", "自动售货机旁"],
      propGuidance: ["白色双门车", "黑色双门车", "车灯", "轮胎", "指尖"],
      dialogueLines: ["行くぞ。"],
    }),
    shot({
      id: "shot_2",
      title: "旧书店发现",
      referenceStrategy: "omni_reference",
      characterGuidance: ["戴耳机的高中女生"],
      sceneGuidance: ["清晨旧书店"],
      propGuidance: ["旧书", "发光车票", "书页"],
    }),
  ],
  assets: [
    asset({
      id: "white_car",
      type: "prop",
      name: "白色双门车",
      usedByShotIds: ["shot_1"],
      sourceRefs: ["imported:file:white-car.png"],
    }),
    asset({
      id: "black_car_candidate",
      type: "prop",
      name: "黑色双门车",
      lockedStatus: "needs_review",
      sourceRefs: ["imported:file:black-car.png"],
    }),
    asset({
      id: "mountain_road",
      type: "scene",
      name: "山脚便利店外山路",
      usedByShotIds: ["shot_1"],
    }),
    asset({
      id: "bookstore",
      type: "scene",
      name: "清晨旧书店",
      usedByShotIds: ["shot_2"],
    }),
    asset({
      id: "girl",
      type: "character",
      name: "戴耳机的高中女生",
      usedByShotIds: ["shot_2"],
    }),
    asset({
      id: "voice_jp",
      type: "unknown",
      name: "日语女生声音，不是配乐",
      path: "/project/audio/voice-reference.wav",
      lockedStatus: "needs_review",
      roleBinding: { role: "voice_reference", useFor: ["shot_1"], ignoreFor: [] },
      sourceRefs: ["imported:file:voice-reference.wav"],
    }),
    asset({
      id: "eurobeat_music",
      type: "unknown",
      name: "eurobeat 配乐.wav",
      path: "/project/audio/eurobeat.wav",
      lockedStatus: "needs_review",
      roleBinding: { role: "music_reference", useFor: [], ignoreFor: [] },
      sourceRefs: ["imported:file:eurobeat.wav"],
    }),
    asset({
      id: "storyboard_1",
      type: "unknown",
      name: "山路启动故事板",
      path: "/project/assets/storyboard-shot-1.png",
      roleBinding: { role: "storyboard_reference", useFor: ["shot_1"], ignoreFor: [] },
    }),
  ],
});

function byLabel(label: string) {
  return projection.items.find((item) => item.label === label);
}

assert(byLabel("白色双门车")?.status === "matched", "locked whole-car asset should auto match");
assert(byLabel("黑色双门车")?.status === "needs_review", "candidate imported car should ask for confirmation");
assert(byLabel("山脚便利店外山路")?.status === "matched", "scene asset should auto match by shot binding");
assert(byLabel("戴耳机的高中女生")?.status === "matched", "character asset should auto match by shot binding");
assert(byLabel("旧书")?.status === "missing", "missing standalone prop should be surfaced");
assert(byLabel("发光车票")?.status === "missing", "missing standalone ticket should be surfaced");
assert(byLabel("车灯")?.status === "merged", "vehicle lights should be merged into parent car/action");
assert(byLabel("轮胎")?.status === "merged", "tires should be merged into parent car/action");
assert(byLabel("指尖")?.status === "merged", "body details should be merged into character/action");
assert(byLabel("雨雾")?.status === "merged", "weather details should be merged into the scene baseline");
assert(byLabel("自动售货机旁")?.status === "merged", "object-relative scene labels should be merged into the scene baseline");
assert(projection.items.some((item) => item.kind === "storyboard_reference" && item.status === "matched"), "storyboard mode should require and match storyboard reference");
assert(projection.items.some((item) => item.kind === "voice_reference" && item.status === "needs_review"), "dialogue should require a voice reference candidate");
assert(!projection.items.some((item) => item.kind === "music_reference" && item.label.includes("不是配乐")), "not-music voice references must not be reconciled as music");
assert(!projection.items.some((item) => item.kind === "voice_reference" && item.label.includes("eurobeat")), "obvious music assets must not be reconciled as character voice references");
assert(projection.creatorSummary.includes("已匹配"), "creator summary should be human-readable");
assert(projection.nextAction === "让 AI 准备参考", "missing standalone props should drive Agent reference preparation");

const emptyProjection = buildAssetReconciliationProjection({ shots: [], assets: [] });
assert(emptyProjection.creatorSummary === "当前没有需要匹配的素材。", "empty reconciliation summary should not tell users to write story again");
assert(emptyProjection.nextAction === "继续整理", "empty reconciliation next action should stay generic");

const folderProjection = buildAssetReconciliationProjection({
  shots: [
    shot({
      id: "shot_folder_1",
      title: "素材文件夹接管",
      referenceStrategy: "storyboard_narrative",
      characterGuidance: ["戴耳机的高中女生"],
      sceneGuidance: ["雨夜天桥"],
      propGuidance: ["发光车票"],
    }),
  ],
  assets: [
    asset({
      id: "folder_character_candidate",
      type: "unknown",
      name: "lin-an.png",
      path: "/project/characters/lin-an.png",
    }),
    asset({
      id: "folder_scene_candidate",
      type: "unknown",
      name: "rain-bridge.png",
      path: "/project/scenes/rain-bridge.png",
    }),
    asset({
      id: "folder_prop_candidate",
      type: "unknown",
      name: "ticket.png",
      path: "/project/props/ticket.png",
    }),
    asset({
      id: "folder_storyboard_candidate",
      type: "unknown",
      name: "bridge-board.png",
      path: "/project/storyboards/bridge-board.png",
    }),
  ],
});

assert(folderProjection.items.find((item) => item.label === "戴耳机的高中女生")?.status === "needs_review", "character folder assets should become review candidates for character requirements");
assert(folderProjection.items.find((item) => item.label === "雨夜天桥")?.status === "needs_review", "scene folder assets should become review candidates for scene requirements");
assert(folderProjection.items.find((item) => item.label === "发光车票")?.status === "needs_review", "prop folder assets should become review candidates for prop requirements");
assert(folderProjection.items.some((item) => item.kind === "storyboard_reference" && item.status === "needs_review"), "storyboard folder assets should become review candidates for storyboard requirements");

console.log("asset-reconciliation-test: ok");
