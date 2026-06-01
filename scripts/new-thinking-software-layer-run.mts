import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildScriptStoryboardPromptPack,
  type ScriptStoryboardPromptPack,
  type ScriptStoryboardShotInput,
} from "../src/core/scriptStoryboardPromptPack.ts";
import {
  JIMENG_CLI_DEFAULT_MODEL_VERSION,
  JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
} from "../src/core/jimengVideoCli.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function compactPlan(pack: ScriptStoryboardPromptPack) {
  return pack.shots.map((shot) => ({
    shotId: shot.shotId,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    actionQA: shot.actionQA,
    image2Storyboard: {
      operation: shot.image2StoryboardPlan.operation,
      outputSize: shot.image2StoryboardPlan.outputSize,
      referenceRoles: shot.image2StoryboardPlan.references.map((reference) => reference.role),
      userFacingSummary: shot.image2StoryboardPlan.referencePolicy.userFacingSummary,
      promptPreview: shot.image2StoryboardPlan.prompt.slice(0, 1200),
    },
    seedanceVideo: {
      command: shot.seedanceVideoPlan.command,
      modelVersion: shot.seedanceVideoPlan.modelVersion,
      videoResolution: shot.seedanceVideoPlan.videoResolution,
      ratio: shot.seedanceVideoPlan.ratio,
      durationSeconds: shot.seedanceVideoPlan.durationSeconds,
      imageRoles: shot.seedanceVideoPlan.inputs.images.map((image) => image.role),
      audioRoles: shot.seedanceVideoPlan.inputs.audio.map((audio) => audio.role),
      maxConcurrentVideoJobs: shot.seedanceVideoPlan.queuePolicy.maxConcurrentVideoJobs,
      expectedQueueWaitMinutes: shot.seedanceVideoPlan.queuePolicy.expectedQueueWaitMinutes,
      userFacingSummary: shot.seedanceVideoPlan.referencePolicy.userFacingSummary,
      promptPreview: shot.seedanceVideoPlan.prompt.slice(0, 1600),
    },
  }));
}

const outputRoot = path.resolve(
  process.argv.includes("--output-root")
    ? process.argv[process.argv.indexOf("--output-root") + 1] || ""
    : path.join("test_artifacts", `new-thinking-software-layer-${safeRunId()}`),
);
mkdirSync(outputRoot, { recursive: true });

const referenceBundle = {
  scenes: [
    {
      id: "scene_rain_station",
      role: "scene_baseline" as const,
      path: "/project/assets/scenes/rain-elevated-station.png",
      label: "雨后高架车站",
      notes: ["湿润站台、冷蓝夜色、远处城市灯、地面反光稳定。"],
    },
    {
      id: "scene_observatory_room",
      role: "scene_baseline" as const,
      path: "/project/assets/scenes/old-observatory-room.png",
      label: "旧天文社活动室",
      notes: ["木桌、旧星图、暖色台灯、窗外雨声，空间关系稳定。"],
    },
  ],
  characters: [
    {
      id: "char_hina",
      role: "character_identity" as const,
      path: "/project/assets/characters/hina-short-bob-ribbon.png",
      label: "日奈",
      notes: ["短发、细小蝴蝶结、深色制服外套，克制但敏感。"],
    },
    {
      id: "char_ren",
      role: "character_identity" as const,
      path: "/project/assets/characters/ren-green-parka.png",
      label: "莲",
      notes: ["少年感、绿色派克外套、斜挎包，动作略犹豫。"],
    },
  ],
  props: [
    {
      id: "prop_blue_cassette",
      role: "prop_reference" as const,
      path: "/project/assets/props/blue-cassette-case.png",
      label: "蓝色磁带盒",
      notes: ["蓝色半透明外壳，手部交互要清楚。"],
    },
    {
      id: "prop_telescope",
      role: "prop_reference" as const,
      path: "/project/assets/props/brass-telescope.png",
      label: "旧望远镜",
      notes: ["黄铜筒身、三脚架，作为空间和动作锚点。"],
    },
  ],
  audio: [
    {
      id: "audio_hina_line",
      role: "dialogue_audio" as const,
      path: "/project/audio/dialogue/hina-line-01.wav",
      label: "日奈对白音频",
    },
    {
      id: "audio_ren_line",
      role: "dialogue_audio" as const,
      path: "/project/audio/dialogue/ren-line-01.wav",
      label: "莲对白音频",
    },
  ],
};

const shots: ScriptStoryboardShotInput[] = [
  {
    shotId: "NT01",
    title: "雨后车站建立空间",
    durationSeconds: 5,
    executionMode: "relationship_wide",
    sceneId: "scene_rain_station",
    characterIds: ["char_hina"],
    propIds: ["prop_blue_cassette"],
    shotSize: "全景到中景",
    camera: "站台纵深构图，轻微推进，保持轨道和候车亭方向清楚。",
    frameDescription: "日奈站在湿润站台左前景，双手握着蓝色磁带盒，右侧留出空站台和远处城市灯。",
    actionBeats: ["雨滴在站台反光里扩散", "日奈抬眼看向画面右侧", "她把磁带盒贴近胸口"],
    primaryAction: "日奈抬眼看向画面右侧",
    actionTrigger: "远处广播忽然停顿，站台安静下来",
    microReaction: "日奈轻轻吸气，手指收紧磁带盒",
    animeShotGrammar: ["先用宽一点的关系镜头建立空间", "动作很小，靠环境和眼神推进"],
    sound: "雨后站台环境音，远处电车低鸣。",
  },
  {
    shotId: "NT02",
    title: "莲入画但不抢身份",
    durationSeconds: 4,
    executionMode: "single_continuous_shot",
    sceneId: "scene_rain_station",
    characterIds: ["char_hina", "char_ren"],
    propIds: ["prop_blue_cassette"],
    shotSize: "中远景",
    camera: "低机位轻微横移，保持日奈在左、莲从右侧入画。",
    frameDescription: "莲从画面右侧进入站台，停在日奈右后方半步，日奈没有立刻回头。",
    actionBeats: ["莲从右侧入画", "他停住脚步", "日奈只用余光确认他的位置"],
    primaryAction: "莲从右侧入画并停在日奈右后方",
    actionTrigger: "莲看到日奈手里的磁带盒",
    microReaction: "日奈肩膀微微绷紧但没有转身",
    actorAction: "莲放慢脚步停住",
    reactorResponse: "日奈用余光确认他的位置",
    animeShotGrammar: ["多人关系先拉远一点", "不要直接正反打，保留空间距离"],
    sound: "鞋底踏过湿地的轻声。",
  },
  {
    shotId: "NT03",
    title: "磁带盒动作特写",
    durationSeconds: 4,
    executionMode: "action_insert",
    sceneId: "scene_rain_station",
    characterIds: ["char_hina", "char_ren"],
    propIds: ["prop_blue_cassette"],
    dialogueAudioId: "audio_hina_line",
    shotSize: "手部特写",
    camera: "切到手部插入镜头，轻微下摇跟随磁带盒。",
    frameDescription: "日奈的手从左侧伸出，蓝色磁带盒递到画面中央，莲的手从右下角迟疑接近。",
    actionBeats: ["日奈伸出磁带盒", "莲的手迟疑靠近", "磁带盒停在两人手之间"],
    primaryAction: "日奈把蓝色磁带盒递到画面中央",
    actionTrigger: "莲没有开口，日奈先做出选择",
    microReaction: "莲的手停顿半拍才继续靠近",
    actorAction: "日奈伸出磁带盒",
    reactorResponse: "莲的手迟疑停顿",
    dialogue: "日奈：别让它再丢一次。",
    sound: "雨声变轻，磁带盒塑料轻响。",
    animeShotGrammar: ["关键关系动作拆成手部插入", "特写只承担一个主动作"],
  },
  {
    shotId: "NT04",
    title: "莲的反应近景",
    durationSeconds: 4,
    executionMode: "reaction_closeup",
    sceneId: "scene_rain_station",
    characterIds: ["char_ren"],
    propIds: ["prop_blue_cassette"],
    dialogueAudioId: "audio_ren_line",
    shotSize: "近景",
    camera: "莲三分之二侧脸近景，慢慢推近到眼神。",
    frameDescription: "莲低头看着手里的磁带盒，雨光在眼角闪一下，他终于抬眼看向日奈。",
    actionBeats: ["莲低头看磁带盒", "他眨眼一次", "他抬眼看向日奈"],
    primaryAction: "莲从磁带盒抬眼看向日奈",
    actionTrigger: "磁带盒的重量让他意识到日奈不是在开玩笑",
    microReaction: "莲眨眼一次，嘴角压住想说的话",
    dialogue: "莲：你一直留着？",
    sound: "近处呼吸声，远处广播恢复。",
    animeShotGrammar: ["情绪用近景和眼神，不用夸张表情"],
  },
  {
    shotId: "NT05",
    title: "旧天文社空间转换",
    durationSeconds: 8,
    executionMode: "planned_cut_sequence",
    sceneId: "scene_observatory_room",
    characterIds: ["char_hina", "char_ren"],
    propIds: ["prop_blue_cassette", "prop_telescope"],
    shotSize: "两段式关系镜头",
    camera: "先宽镜建立旧天文社，再切到桌面磁带盒和望远镜的关系。",
    frameDescription: "两人站在旧天文社门口，桌上有旧望远镜，蓝色磁带盒放在星图旁边。",
    actionBeats: ["两人推门进入旧天文社", "日奈把磁带盒放在星图旁", "莲看向旧望远镜"],
    primaryAction: "日奈把磁带盒放在星图旁",
    actionTrigger: "莲认出旧天文社仍保留原来的星图",
    microReaction: "日奈松开手指后轻轻退开半步",
    actorAction: "日奈把磁带盒放下",
    reactorResponse: "莲看向旧望远镜",
    animeShotGrammar: ["8 秒可以允许短切镜头", "每个切点只服务空间转换和道具关系"],
    sound: "木门轻响，室内雨声变闷。",
  },
  {
    shotId: "NT06",
    title: "望远镜校准动作",
    durationSeconds: 6,
    executionMode: "single_continuous_shot",
    sceneId: "scene_observatory_room",
    characterIds: ["char_ren", "char_hina"],
    propIds: ["prop_telescope"],
    shotSize: "中景到动作特写",
    camera: "从莲背后轻推，跟到他旋转望远镜调焦环。",
    frameDescription: "莲站在旧望远镜后方调焦，日奈在左后景看着他，桌面星图被暖灯照亮。",
    actionBeats: ["莲扶住望远镜", "他慢慢旋转调焦环", "日奈在后景安静看着"],
    primaryAction: "莲慢慢旋转望远镜调焦环",
    actionTrigger: "莲想确认那卷磁带记录的坐标",
    microReaction: "日奈在后景轻轻点头",
    actorAction: "莲旋转调焦环",
    reactorResponse: "日奈轻轻点头",
    animeShotGrammar: ["道具动作要清楚", "后景反应用于保持人物关系"],
    sound: "金属调焦环细微摩擦声。",
  },
  {
    shotId: "NT07",
    title: "星图投影收束",
    durationSeconds: 8,
    executionMode: "relationship_wide",
    sceneId: "scene_observatory_room",
    characterIds: ["char_hina", "char_ren"],
    propIds: ["prop_blue_cassette", "prop_telescope"],
    shotSize: "宽中景",
    camera: "缓慢后拉，保留两人、望远镜、星图投影的空间关系。",
    frameDescription: "旧星图光点投到墙面，日奈和莲并肩站在画面下方，蓝色磁带盒在桌面中央。",
    actionBeats: ["墙面出现旧星图光点", "两人同时抬头", "日奈向莲靠近半步"],
    primaryAction: "日奈向莲靠近半步并一起抬头看星图",
    actionTrigger: "星图投影终于对准墙面",
    microReaction: "莲放松肩膀，日奈轻轻笑了一下",
    actorAction: "日奈靠近半步",
    reactorResponse: "莲放松肩膀",
    animeShotGrammar: ["结尾用宽一点关系镜头", "动作很小但空间要完整"],
    sound: "磁带机轻微转动声，雨声远离。",
    transition: "画面停在两人并肩背影和墙面星图上。",
  },
];

const pack = buildScriptStoryboardPromptPack({
  title: "雨后星图",
  logline: "两个少年在雨后车站找回一卷旧磁带，并把它变成重启天文社的第一张星图。",
  completeScript: [
    "雨后的高架车站空荡，日奈握着蓝色磁带盒等莲出现。",
    "莲从站台右侧走来，看到磁带盒后停住。",
    "日奈把磁带盒递给他，说：别让它再丢一次。",
    "莲接过磁带盒，低声问：你一直留着？",
    "两人进入旧天文社，把磁带盒放在星图旁，重新校准旧望远镜。",
    "墙面出现星图投影，两人并肩抬头，雨声慢慢远去。",
  ].join("\n"),
  style: "clean Japanese TV anime, emotional but restrained, soft rain atmosphere, readable staging, no photorealism",
  referenceBundle,
  shots,
  storyboardOutputDir: "/project/storyboards",
  videoOutputDir: "/project/final-video/clips",
  image2OutputSize: "1280x720",
  seedanceModelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
  seedanceVideoResolution: "720p",
});

assert(pack.blockers.length === 0, `software run should not have action blockers: ${pack.blockers.join("; ")}`);
assert(pack.warnings.length === 0, `software run should not have action warnings: ${pack.warnings.join("; ")}`);
assert(pack.shots.length === 7, "software run should produce seven shot plans");

for (const shot of pack.shots) {
  assert(shot.image2StoryboardPlan.outputSize === "1280x720", `${shot.shotId} storyboard should be 16:9 1280x720`);
  assert(!shot.image2StoryboardPlan.prompt.includes("/project/"), `${shot.shotId} Image2 prompt must not leak local paths`);
  assert(shot.image2StoryboardPlan.prompt.includes("do not force a fixed number of small panels"), `${shot.shotId} storyboard layout should stay flexible`);
  assert(shot.image2StoryboardPlan.prompt.includes("Duration budget"), `${shot.shotId} storyboard prompt should include duration budget`);
  assert(shot.seedanceVideoPlan.modelVersion === JIMENG_CLI_DEFAULT_MODEL_VERSION, `${shot.shotId} should use standard Seedance option`);
  assert(shot.seedanceVideoPlan.videoResolution === "720p", `${shot.shotId} should stay at 720p`);
  assert(shot.seedanceVideoPlan.ratio === "16:9", `${shot.shotId} should use 16:9`);
  assert(shot.seedanceVideoPlan.queuePolicy.maxConcurrentVideoJobs === 1, `${shot.shotId} Jimeng should stay single-lane`);
  assert(shot.seedanceVideoPlan.queuePolicy.expectedQueueWaitMinutes === JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES, `${shot.shotId} should expose long queue expectation`);
  assert(shot.seedanceVideoPlan.inputs.images[0]?.role === "storyboard_reference", `${shot.shotId} video should put storyboard first`);
  assert(shot.seedanceVideoPlan.inputs.images.some((image) => image.role === "scene_baseline"), `${shot.shotId} video should include scene baseline`);
  assert(shot.seedanceVideoPlan.inputs.images.some((image) => image.role === "character_identity"), `${shot.shotId} video should include character reference`);
  assert(/no BGM, no music/i.test(shot.seedanceVideoPlan.prompt), `${shot.shotId} video prompt should enforce no BGM`);
  assert(!/1080p/i.test(shot.seedanceVideoPlan.args.join(" ")), `${shot.shotId} should not silently use 1080p`);
  assert(!/end frame|ending frame/i.test(shot.seedanceVideoPlan.prompt), `${shot.shotId} should not use end-frame flow`);
}

const report = {
  schemaVersion: "new_thinking_software_layer_run_v1",
  providerCalled: false,
  title: pack.title,
  outputRoot,
  modelLane: {
    image2Storyboard: "lanyi-image2-responses-stream planned only",
    video: JIMENG_CLI_DEFAULT_MODEL_VERSION,
    videoResolution: "720p",
    ratio: "16:9",
    maxConcurrentVideoJobs: 1,
    expectedQueueWaitMinutes: JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
  },
  flow: [
    "完整脚本先拆成可执行镜头表",
    "角色/场景/道具/音频参考各自绑定职责",
    "Image2 只生成黑白分镜参考图",
    "Seedance 全能参考接收分镜图、场景基准、角色/道具参考和可选对白音频",
    "视频 prompt 默认 no BGM，音频留给 TTS/后期",
    "不使用默认结束帧，不启用首帧保护后处理",
  ],
  totals: {
    shots: pack.shots.length,
    totalDurationSeconds: pack.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0),
    storyboardPlans: pack.shots.length,
    videoPlans: pack.shots.length,
    audioBackedShots: pack.shots.filter((shot) => shot.seedanceVideoPlan.inputs.audio.length > 0).length,
  },
  warnings: pack.warnings,
  blockers: pack.blockers,
  compactPlan: compactPlan(pack),
};

writeJson(path.join(outputRoot, "software-layer-report.json"), report);
writeJson(path.join(outputRoot, "director-table.json"), pack.directorRows);
writeJson(path.join(outputRoot, "image2-storyboard-plans.json"), pack.shots.map((shot) => shot.image2StoryboardPlan));
writeJson(path.join(outputRoot, "seedance-video-plans.json"), pack.shots.map((shot) => shot.seedanceVideoPlan));
writeFileSync(
  path.join(outputRoot, "README.md"),
  [
    "# New Thinking Software Layer Run",
    "",
    `- providerCalled: false`,
    `- shots: ${report.totals.shots}`,
    `- totalDurationSeconds: ${report.totals.totalDurationSeconds}`,
    `- video model: ${JIMENG_CLI_DEFAULT_MODEL_VERSION}`,
    "- video resolution: 720p",
    "- ratio: 16:9",
    "- Jimeng max concurrency: 1",
    "- default video prompt: no BGM",
    "- end-frame flow: disabled",
    "",
    "Generated files:",
    "- software-layer-report.json",
    "- director-table.json",
    "- image2-storyboard-plans.json",
    "- seedance-video-plans.json",
    "",
  ].join("\n"),
);

console.log(`new-thinking-software-layer-run: ok`);
console.log(`outputRoot=${outputRoot}`);
console.log(`shots=${report.totals.shots} totalDurationSeconds=${report.totals.totalDurationSeconds} audioBackedShots=${report.totals.audioBackedShots}`);
console.log(`videoLane=${JIMENG_CLI_DEFAULT_MODEL_VERSION}/720p/16:9 maxConcurrency=1 providerCalled=false`);
