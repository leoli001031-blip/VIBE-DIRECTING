import {
  buildDirectorAiStoryboardPrompt,
  normalizeDirectorAiStoryboardPlan,
} from "../src/core/directorAiStoryboardPlanner.ts";
import {
  buildDirectorProductionSkillPlan,
  productionSkillImage2PromptBlock,
} from "../src/core/directorProductionSkill.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prompt = buildDirectorAiStoryboardPrompt({
  scriptText: [
    "[Intro]",
    "Five",
    "Four",
    "0:00 - 0:04",
    "山脚便利店，SU7 Ultra 点灯",
    "Xiaomi SU7 Ultra 停在便利店门口，雨水反光。",
    "0:04 - 0:08",
    "女车手睁眼",
    "车内仪表亮起，她切换运动模式。",
  ].join("\n"),
  styleText: "90 年代日漫赛车感，动作要拆成可拍镜头。",
  structuralRows: [
    {
      id: "timecoded_1",
      title: "山脚便利店，SU7 Ultra 点灯",
      text: "Xiaomi SU7 Ultra 停在便利店门口，雨水反光。",
      durationSeconds: 4,
      timeRange: "0:00-0:04",
      scene: "山脚便利店",
      props: "Xiaomi SU7 Ultra、车灯",
    },
    {
      id: "timecoded_2",
      title: "女车手睁眼",
      text: "车内仪表亮起，她切换运动模式。",
      durationSeconds: 4,
      timeRange: "0:04-0:08",
      characters: "女车手",
      scene: "车内",
      props: "仪表/模式开关",
    },
  ],
});

assert(prompt.includes("不是机械分段器"), "prompt should explicitly avoid mechanical splitting");
assert(prompt.includes("不要把歌词、倒计时、素材说明机械变成镜头"), "prompt should protect against lyric/countdown rows");
assert(prompt.includes("storyboard_rapid_cut"), "prompt should expose rapid-cut strategy");
assert(prompt.includes("视频段/故事板段"), "prompt should treat rows as generation segments, not raw edit cuts");
assert(prompt.includes("不要把每个小切点都拆成单独 shot"), "prompt should keep rapid-cut UI rows compact");
assert(prompt.includes("visibleClips 是最终视频里可见剪辑段数量"), "prompt should define visibleClips/storyboardPanels/actionBeats");
assert(prompt.includes("storyboardPanels 多于 visibleClips"), "prompt should explain extra storyboard panels are internal action planning");
assert(prompt.includes("建议输出约"), "prompt should include a restrained shot-count target");
assert(prompt.includes("建议输出约 3 个 shots"), "short scripts should not be nudged toward too many shots");
assert(prompt.includes("所有字段必须短句化"), "prompt should keep AI output compact enough for large scripts");
assert(prompt.includes("不要使用英文双引号"), "prompt should protect JSON strings from raw dialogue quotes");
assert(prompt.includes("不要把车、手机、书、票、道具写进 characters"), "prompt should prevent object references from becoming characters");
assert(prompt.includes("未命名但持续表演的人物"), "prompt should require functional names for unnamed recurring performers");
assert(prompt.includes("咖啡果、咖啡豆"), "prompt should force anthropomorphic object protagonists into characters");
assert(prompt.includes("车灯、轮胎、仪表"), "prompt should tell the LLM to keep object components out of standalone props");
assert(prompt.includes("本地结构行 JSON"), "prompt should include local structure as hints only");
assert(prompt.includes("标题、片名、项目名"), "prompt should tell the LLM that title metadata is not visual content");

const titleMetadataPrompt = buildDirectorAiStoryboardPrompt({
  scriptText: [
    "标题：《海雾灯塔的鲸歌维修员》",
    "请先不要提交视频测试，也不要真实生图。",
    "雨后的海边小镇，少女维修员带着机械猫走向废弃灯塔。",
  ].join("\n"),
  structuralRows: [
    {
      id: "title_row",
      title: "标题：《海雾灯塔的鲸歌维修员》",
      text: "标题：《海雾灯塔的鲸歌维修员》",
      durationSeconds: 4,
    },
    {
      id: "story_row",
      title: "少女走向灯塔",
      text: "雨后的海边小镇，少女维修员带着机械猫走向废弃灯塔。",
      durationSeconds: 5,
    },
  ],
});
assert(!titleMetadataPrompt.includes("完整脚本：\n标题：《海雾灯塔的鲸歌维修员》"), "explicit title lines should be stripped from the story text sent to the LLM");
assert(!titleMetadataPrompt.includes('"title": "标题：《海雾灯塔的鲸歌维修员》"'), "explicit title rows should not become structural storyboard rows");
assert(titleMetadataPrompt.includes("少女走向灯塔"), "real story rows should remain after title metadata is stripped");

const longPrompt = buildDirectorAiStoryboardPrompt({
  scriptText: "做一个 210 秒的完整短片，山路追逐、对白、回忆和结尾余韵都要保留。",
  styleText: "90 年代日漫，节奏有快有慢。",
  targetDurationSeconds: 210,
  structuralRows: [{
    id: "long_idea",
    title: "三分半短片",
    text: "一个三分半左右的完整短片。",
    durationSeconds: 210,
  }],
});
assert(longPrompt.includes("这是长项目规划"), "long projects should not be constrained by short-project shot-count guidance");
assert(longPrompt.includes("允许输出 42 个左右的视频段"), "210s project should suggest a realistic segment count instead of a tiny cap");

const plan = normalizeDirectorAiStoryboardPlan({
  narrativeGoal: "用雨夜山路赛车的节奏建立对决。",
  totalDurationSeconds: 8,
  warnings: ["倒计时只作为节奏，不单独成镜。"],
  shots: [
    {
      shotNo: "1-1",
      title: "车灯点亮",
      durationSeconds: 4,
      shotSize: "全景",
      camera: "低机位侧前方，雨地反光中轻微推近。",
      visualDescription: "便利店门口，SU7 Ultra 在画面左侧点亮车灯，雨水映出车身轮廓。",
      primaryAction: "SU7 Ultra 点亮车灯。",
      actionTrigger: "倒计时前的引擎声压低。",
      microReaction: "车灯亮起后雨水反光轻微跳动。",
      executionMode: "single_continuous_shot",
      referenceStrategy: "omni_reference",
      subtitle: "-",
      sound: "雨声、低沉引擎声",
      characters: "女车手",
      scene: "山脚便利店",
      props: "Xiaomi SU7 Ultra、车灯",
      audioUsage: "现场声",
      rhythmProfile: "suspense_pressure",
      rhythmReason: "第一镜先建立空间和车的气势。",
      sourceRowIds: ["timecoded_1"],
    },
    {
      shotNo: "1-2",
      title: "切入运动模式",
      durationSeconds: 4,
      shotSize: "特写",
      camera: "车内手部特写，短推到仪表。",
      visualDescription: "女车手右手按下模式开关，仪表光映在她的眼睛边缘。",
      primaryAction: "她切换运动模式。",
      actionTrigger: "车外倒计时进入最后一秒。",
      microReaction: "她睫毛轻颤后眼神定住。",
      executionMode: "action_insert",
      referenceStrategy: "omni_reference",
      visibleCutBudget: "最多 1 个反应切点",
      subtitle: "-",
      sound: "按键声、仪表启动声",
      characters: "女车手",
      scene: "车内",
      props: "仪表/模式开关",
      audioUsage: "现场声",
      rhythmProfile: "anime_emotion",
      rhythmReason: "用手部和眼神切分日漫起势。",
      sourceRowIds: ["timecoded_2"],
    },
  ],
});

assert(plan.planningSource === "ai_director_validated", "normalized plan should mark AI director source");
assert(plan.shots.length === 2, "plan should preserve validated shots");
assert(plan.shots[0]!.referenceStrategy === "omni_reference", "reference strategy should validate");
assert(plan.shots[0]!.props === "Xiaomi SU7 Ultra", "object details such as headlights should be removed from standalone props");
assert(plan.shots[1]!.props === "模式开关", "dashboard components should collapse into the parent action/object instead of becoming prop assets");
assert(plan.shots[1]!.visibleCutBudget === "最多 1 个反应切点", "visible cut budget should pass through");
assert(plan.shots[1]!.visibleClips === 1, "action inserts should default to one final visible clip");
assert(plan.shots[1]!.storyboardPanels === 0, "omni references should not request storyboard panels");
assert(plan.shots[1]!.actionBeats.length === 3, "normalization should provide action beats for prompt contracts");

const vehicleNormalized = normalizeDirectorAiStoryboardPlan({
  shots: [{
    title: "两车山路对峙",
    characters: "女主、白色双门车、黑色双门车",
    scene: "雨后山脚便利店外山路、积水、天光",
    props: "便利店霓虹、车灯、黑色双门车",
  }],
});
assert(vehicleNormalized.shots[0]!.characters === "女主", "vehicles should not stay in the character field");
assert(vehicleNormalized.shots[0]!.props === "黑色双门车、白色双门车", "whole vehicles should move into standalone props while parts/scene states are dropped");

const inferredDriverNormalized = normalizeDirectorAiStoryboardPlan({
  shots: [{
    title: "雨停对峙",
    characters: "待确认",
    visualDescription: "白色双门跑车与黑色双门跑车并排停在便利店外，两个年轻车手隔车相望。",
    primaryAction: "两名车手静默确认比赛",
    props: "白色双门跑车、黑色双门跑车",
  }],
});
assert(inferredDriverNormalized.shots[0]!.characters === "白车车手、黑车车手", "unnamed recurring drivers should be inferred as functional character roles instead of staying pending");

const racingAuthorityNormalized = normalizeDirectorAiStoryboardPlan({
  narrativeGoal: "用雨夜山路快切建立赛车对决，同时保护关键物道具。",
  totalDurationSeconds: 10,
  shots: [{
    shotNo: "R-1",
    title: "山路三连快切",
    durationSeconds: 10,
    shotSize: "混合快切",
    camera: "低机位跟车，三格快切：车头、弯心、车内副驾。",
    visualDescription: "白色赛车切入弯心，车灯扫过湿路，轮胎压过水坑；副驾旧书震动，发光车票贴在仪表旁。",
    primaryAction: "白色赛车切内线超过黑车。",
    actionTrigger: "倒计时结束后两车同时冲出。",
    microReaction: "黑车车手握紧方向盘，发光车票闪一下。",
    executionMode: "planned_cut_sequence",
    referenceStrategy: "storyboard_rapid_cut",
    subtitle: "-",
    sound: "引擎声、轮胎水声",
    characters: "白车车手、黑车车手",
    scene: "雨夜山路、雾、湿路、天空",
    props: "白色赛车、车灯、轮胎、旧书、发光车票",
    audioUsage: "现场声",
    rhythmProfile: "action_fast_cut",
    rhythmReason: "赛车动作链需要内部快切预演。",
    sourceRowIds: ["idea_racing_authority"],
  }],
});
const racingAuthorityShot = racingAuthorityNormalized.shots[0]!;
assert(racingAuthorityShot.referenceStrategy === "storyboard_rapid_cut", "racing idea should preserve rapid-cut strategy");
assert(racingAuthorityShot.visibleCutBudget === "1-2 个可见切点", "rapid cut should keep a visible cut budget instead of becoming a static panel");
assert(racingAuthorityShot.visibleClips === 3, "1-2 visible cut points should normalize to three visible clips for this duration");
assert(racingAuthorityShot.storyboardPanels >= racingAuthorityShot.visibleClips, "rapid storyboard panels should be explicit and never below visible clips");
assert(racingAuthorityShot.props === "白色赛车、旧书、发光车票", "car lights and tires should stay parent-object constraints while old book/ticket remain independent props");
assert(racingAuthorityShot.characters === "白车车手、黑车车手", "racing drivers should stay functional character identities");

const racingStrategyPlan = buildDirectorProductionSkillPlan({
  shotId: "R-1",
  title: racingAuthorityShot.title,
  durationSeconds: racingAuthorityShot.durationSeconds,
  executionMode: racingAuthorityShot.executionMode,
  referenceStrategy: racingAuthorityShot.referenceStrategy,
  shotText: [
    racingAuthorityShot.visualDescription,
    racingAuthorityShot.primaryAction,
    racingAuthorityShot.actionTrigger,
    racingAuthorityShot.microReaction,
  ].join("\n"),
  actionBeats: ["车头切入弯心", "轮胎压过水坑", "黑车反打方向", "旧书震动", "发光车票闪一下"],
  assetState: { scene: "locked", characters: "locked", props: "locked" },
});
assert(racingStrategyPlan.strategyId === "storyboard_rapid_cut", "racing strategy should stay rapid-cut after production contract routing");
assert(racingStrategyPlan.panelCountIntent > 1, "rapid-cut production strategy must not collapse to a single panel");
assert(racingStrategyPlan.strategyContract.visibleCutSemantics.includes("internal choreography"), "strategy contract should expose rapid-cut visible cut semantics");
assert(racingStrategyPlan.assetAuthorityContract.examples.independentProps.includes("旧书"), "asset authority graph should keep old book as an independent prop example");
assert(racingStrategyPlan.assetAuthorityContract.examples.independentProps.includes("发光车票"), "asset authority graph should keep glowing ticket as an independent prop example");
const racingImage2Prompt = productionSkillImage2PromptBlock(racingStrategyPlan);
assert(racingImage2Prompt.includes("component_ownership_rule"), "Image2 contract should carry parent-object component ownership rules");
assert(racingImage2Prompt.includes("independent_props: 旧书、发光车票"), "Image2 contract should name key independent prop examples");

const invalid = normalizeDirectorAiStoryboardPlan({
  shots: [{
    title: "错误值也要兜底",
    executionMode: "everything_all_at_once",
    referenceStrategy: "bad",
    rhythmProfile: "wrong",
  }],
});
assert(invalid.shots[0]!.executionMode === "single_continuous_shot", "invalid execution mode should fallback");
assert(invalid.shots[0]!.referenceStrategy === "omni_reference", "invalid reference strategy should fallback");

const inheritedDetail = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 8,
  shots: [
    {
      title: "模特走近橱窗",
      durationSeconds: 4,
      characters: "模特",
      scene: "雨天街口",
      props: "风衣",
    },
    {
      title: "风衣袖口细节",
      durationSeconds: 4,
      executionMode: "action_insert",
      characters: "待确认",
      scene: "待确认",
      props: "袖口",
    },
  ],
});
assert(inheritedDetail.shots[1]!.characters === "模特", "detail shots should inherit the nearest clear character instead of staying pending");
assert(inheritedDetail.shots[1]!.scene === "雨天街口", "detail shots should inherit the nearest clear scene instead of staying pending");

const sceneOnlyAndSameScene = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 8,
  shots: [
    {
      title: "空书店建立",
      durationSeconds: 4,
      characters: "待确认",
      scene: "清晨旧书店",
      props: "旧书、书架",
    },
    {
      title: "书页特写",
      durationSeconds: 4,
      executionMode: "action_insert",
      characters: "待确认",
      scene: "同上",
      props: "发光车票",
    },
  ],
});
assert(sceneOnlyAndSameScene.shots[0]!.characters === "无", "scene-only shots should not keep a visible 待确认 character label");
assert(sceneOnlyAndSameScene.shots[1]!.characters === "无", "scene-only detail shots should remain character-free when no prior character exists");
assert(sceneOnlyAndSameScene.shots[1]!.scene === "清晨旧书店", "same-scene placeholders should inherit the previous concrete scene");

const durationNormalized = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 45,
  shots: [
    { title: "一", durationSeconds: 12 },
    { title: "二", durationSeconds: 12 },
    { title: "三", durationSeconds: 12 },
    { title: "四", durationSeconds: 11 },
  ],
});
const normalizedSum = Math.round(durationNormalized.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0) * 10) / 10;
assert(normalizedSum === 45, "shot durations should normalize to requested total duration");
assert(durationNormalized.warnings.some((warning) => warning.includes("归一化")), "duration normalization should leave a warning");

const halfSecondDriftNormalized = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 10,
  shots: [
    { title: "旧机器亮起", durationSeconds: 3.5 },
    { title: "投币吐出票", durationSeconds: 4 },
    { title: "抬头见电车", durationSeconds: 3 },
  ],
});
const halfSecondDriftSum = Math.round(halfSecondDriftNormalized.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0) * 10) / 10;
assert(halfSecondDriftSum === 10, "explicit user duration should absorb 0.5s planning drift before the draft reaches UI");
assert(halfSecondDriftNormalized.warnings.some((warning) => warning.includes("归一化")), "half-second duration drift should leave a warning");

const manyShots = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 320,
  shots: Array.from({ length: 72 }, (_, index) => ({
    title: `长片镜头 ${index + 1}`,
    durationSeconds: 4,
  })),
});
assert(manyShots.shots.length === 72, "AI storyboard normalization should preserve long-project shot plans well beyond 24 shots");

console.log(`director-ai-storyboard-planner-test: shots=${plan.shots.length}, prompt=${prompt.length}.`);
