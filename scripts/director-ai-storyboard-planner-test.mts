import {
  buildDirectorAiStoryboardPrompt,
  extractRequestedShotCount,
  normalizeDirectorAiStoryboardPlan,
  splitCreativePlanningText,
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
assert(prompt.includes("建议输出约 2 个 shots"), "short scripts should stay within executable 4s-minimum video segments");
assert(prompt.includes("所有字段必须短句化"), "prompt should keep AI output compact enough for large scripts");
assert(prompt.includes("不要使用英文双引号"), "prompt should protect JSON strings from raw dialogue quotes");
assert(prompt.includes("不要把车、手机、书、票、道具写进 characters"), "prompt should prevent object references from becoming characters");
assert(prompt.includes("未命名但持续表演的人物"), "prompt should require functional names for unnamed recurring performers");
assert(prompt.includes("咖啡果、咖啡豆"), "prompt should force anthropomorphic object protagonists into characters");
assert(prompt.includes("车灯、轮胎、仪表"), "prompt should tell the LLM to keep object components out of standalone props");
assert(prompt.includes("本地结构行 JSON"), "prompt should include local structure as hints only");
assert(prompt.includes("标题、片名、项目名"), "prompt should tell the LLM that title metadata is not visual content");

assert(extractRequestedShotCount("总共两个视频，每个 4 秒。视频1：女孩举纸飞机。视频2：纸飞机发光。") === 2, "explicit video segment counts should lock the generated shot count");
assert(extractRequestedShotCount("视频1：开场。视频2：追逐。") === 2, "enumerated video labels should infer the generated shot count");
const twoVideoPrompt = buildDirectorAiStoryboardPrompt({
  scriptText: "总共两个视频，每个 4 秒，16:9。视频1：女孩站在便利店门口举起纸飞机。视频2：女孩放飞纸飞机，纸飞机泛起蓝光。",
  structuralRows: [
    { id: "video_1", title: "视频1", text: "女孩站在便利店门口举起纸飞机。", durationSeconds: 4 },
    { id: "video_2", title: "视频2", text: "女孩放飞纸飞机，纸飞机泛起蓝光。", durationSeconds: 4 },
  ],
});
assert(twoVideoPrompt.includes("用户已经明确要求 2 个镜头"), "prompt should treat explicit video counts as hard shot counts");

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

const mixedBrief = splitCreativePlanningText("做一个8秒短片：清晨海边自动贩卖机旁，少女捡到一枚会发光的贝壳。想要90年代日漫安静悬疑感，先查一下这种风格和分镜参考。");
assert(mixedBrief.storyText.includes("清晨海边自动贩卖机旁"), "story text should keep the actual scene");
assert(mixedBrief.storyText.includes("少女捡到一枚会发光的贝壳"), "story text should keep the actual action");
assert(!mixedBrief.storyText.includes("先查一下"), "story text should not include web-search operation instructions");
assert(mixedBrief.directiveText.includes("90年代日漫"), "style/search directives should move into planning preference text");

const planOnlyBrief = splitCreativePlanningText("做一个 18 秒 1990 年代日漫感短片：深夜自动售货机旁，一只黑猫叼着一张湿掉的电影票，带一个穿雨衣的少女走进空无一人的旧电影院。节奏先安静悬疑，中段有一个快速发现线索的快切，结尾停在银幕亮起。先只规划，不生图不提交视频。");
assert(planOnlyBrief.storyText.includes("黑猫叼着一张湿掉的电影票"), "story text should keep the creative subject before plan-only controls");
assert(planOnlyBrief.storyText.includes("旧电影院"), "story text should keep the destination scene before plan-only controls");
assert(planOnlyBrief.storyText.includes("结尾停在银幕亮起"), "story-like ending beats inside rhythm directives should remain available to the fallback storyboard");
assert(!planOnlyBrief.storyText.includes("做一个 18 秒"), "creation request prefixes with style words should not become storyboard content");
assert(!planOnlyBrief.storyText.includes("先只规划"), "plan-only controls must not become storyboard story text");
assert(!planOnlyBrief.storyText.includes("不生图"), "no-image controls must not become storyboard story text");
assert(!planOnlyBrief.storyText.includes("不提交视频"), "no-video controls must not become storyboard story text");
assert(planOnlyBrief.directiveText.includes("执行边界"), "removed generation controls should be preserved as planning boundary metadata");

const strategyOnlyBrief = splitCreativePlanningText("做一个 20 秒短片：深夜海边自动售货机旁，一个送报少女发现机器吐出一枚发热的蓝色硬币。她沿着防波堤追着硬币滚动的光，看到远处灯塔像在发送摩斯电码。先做规划和分镜策略，不提交视频。");
assert(strategyOnlyBrief.storyText.includes("自动售货机旁"), "story text should keep the creative opening before strategy-only controls");
assert(!strategyOnlyBrief.storyText.includes("先做规划"), "strategy-only controls must not appear in story text");
assert(!strategyOnlyBrief.storyText.includes("不提交视频"), "submit boundaries must not appear in story text");

const styleColonBrief = splitCreativePlanningText("做一个 20 秒短片，风格是 90 年代日本 TV 动画加一点轻赛博朋克：凌晨的无人洗衣店里，一个兼职少女发现 7 号烘干机里滚出一只会发光的纸鹤。她追着纸鹤穿过雨夜巷子。");
assert(styleColonBrief.storyText.includes("凌晨的无人洗衣店"), "story text should keep story content after a style colon");
assert(styleColonBrief.storyText.includes("7 号烘干机"), "story text should keep the opening prop after a style colon");
assert(!styleColonBrief.storyText.includes("风格是"), "style prefix should move out of story text");

const mixedBriefPrompt = buildDirectorAiStoryboardPrompt({
  scriptText: "做一个8秒短片：清晨海边自动贩卖机旁，少女捡到一枚会发光的贝壳。想要90年代日漫安静悬疑感，先查一下这种风格和分镜参考。",
  structuralRows: [{
    id: "mixed_1",
    title: "清晨海边",
    text: "清晨海边自动贩卖机旁，少女捡到一枚会发光的贝壳。想要90年代日漫安静悬疑感，先查一下这种风格和分镜参考。",
    durationSeconds: 8,
  }],
});
assert(!mixedBriefPrompt.includes("完整脚本：\n做一个8秒短片"), "creation request prefix should not be sent as story content");
assert(!mixedBriefPrompt.includes("完整脚本：\n清晨海边自动贩卖机旁，少女捡到一枚会发光的贝壳。想要"), "inline style/search directive should not stay in complete script");
assert(mixedBriefPrompt.includes("用户补充偏好："), "prompt should preserve removed style/search directives as preferences");

const planOnlyPrompt = buildDirectorAiStoryboardPrompt({
  scriptText: "做一个 18 秒 1990 年代日漫感短片：深夜自动售货机旁，一只黑猫叼着一张湿掉的电影票，带一个穿雨衣的少女走进空无一人的旧电影院。先只规划，不生图不提交视频。",
  structuralRows: [{
    id: "plan_only_control",
    title: "先只规划，不生图不提交视频",
    text: "先只规划，不生图不提交视频",
    durationSeconds: 4,
  }, {
    id: "story_subject",
    title: "黑猫带路",
    text: "深夜自动售货机旁，一只黑猫叼着一张湿掉的电影票，带一个穿雨衣的少女走进空无一人的旧电影院。",
    durationSeconds: 8,
  }],
});
assert(!planOnlyPrompt.includes("完整脚本：\n深夜自动售货机旁，一只黑猫叼着一张湿掉的电影票，带一个穿雨衣的少女走进空无一人的旧电影院。先只规划"), "complete script should remove inline plan-only controls before LLM planning");
assert(!planOnlyPrompt.includes('"text": "先只规划'), "plan-only structural rows must not be sent as storyboard seeds");
assert(planOnlyPrompt.includes("黑猫带路"), "real creative storyboard rows should remain after filtering plan-only controls");

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

const costumeAndBudgetNormalized = normalizeDirectorAiStoryboardPlan({
  shots: [{
    title: "雨衣少女捡到票",
    durationSeconds: 4,
    characters: "穿雨衣的少女、黑猫",
    props: "湿电影票、透明雨衣",
    visibleCutBudget: "1",
  }],
});
assert(costumeAndBudgetNormalized.shots[0]!.props === "湿电影票", "clothing/costume details should not become independent prop references");
assert(costumeAndBudgetNormalized.shots[0]!.visibleCutBudget === "1 个最终可见剪辑", "bare numeric visible cut budgets should become explicit final visible clip language");

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

const visibleCharacterInferenceNormalized = normalizeDirectorAiStoryboardPlan({
  shots: [{
    title: "空地铁站听见海浪声",
    characters: "无",
    visualDescription: "凌晨的空地铁站，一个女生戴着耳机停在储物柜前，听见柜门缝里传来海浪声。",
    primaryAction: "女生停住脚步看向储物柜。",
    scene: "空地铁站",
    props: "储物柜",
  }],
});
assert(visibleCharacterInferenceNormalized.shots[0]!.characters === "女生", "visible human subjects in shot text should override an incorrect 无 character field");

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
assert(racingAuthorityShot.visibleCutBudget === "2-3 个最终可见剪辑", "rapid cut should keep a final visible clip budget instead of becoming a static panel");
assert(racingAuthorityShot.visibleClips === 3, "2-3 final visible clips should normalize to three visible clips for this duration");
assert(racingAuthorityShot.storyboardPanels >= racingAuthorityShot.visibleClips, "rapid storyboard panels should be explicit and never below visible clips");
assert(racingAuthorityShot.props === "白色赛车、旧书、发光车票", "car lights and tires should stay parent-object constraints while old book/ticket remain independent props");
assert(racingAuthorityShot.characters === "白车车手、黑车车手", "racing drivers should stay functional character identities");

const cutPointBudgetNormalized = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 4,
  shots: [{
    title: "线索快切",
    durationSeconds: 4,
    executionMode: "planned_cut_sequence",
    referenceStrategy: "storyboard_rapid_cut",
    visibleCutBudget: "3个切点",
    actionBeats: ["车票", "海报", "指示灯", "少年影子"],
  }],
});
assert(cutPointBudgetNormalized.shots[0]!.visibleCutBudget === "4 个最终可见剪辑", "cut-point wording should normalize to final visible clip wording before reaching the UI");
assert(cutPointBudgetNormalized.shots[0]!.visibleClips === 4, "cut-point wording should still infer the correct final visible clip count");

const visibleClipWordingNormalized = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 4,
  shots: [{
    title: "可见剪辑 wording",
    durationSeconds: 4,
    executionMode: "planned_cut_sequence",
    referenceStrategy: "storyboard_rapid_cut",
    visibleCutBudget: "3-4个可见剪辑",
    actionBeats: ["车票", "海报", "指示灯", "少年影子"],
  }],
});
assert(visibleClipWordingNormalized.shots[0]!.visibleCutBudget === "3-4 个最终可见剪辑", "visible clip wording should use the same final-visible-clip label in the UI");

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

const contextualSameSceneDetail = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 12,
  shots: [
    {
      title: "吐出票",
      durationSeconds: 4,
      characters: "女高中生",
      scene: "旧街角，深夜雨，霓虹招牌昏暗闪烁",
      props: "自动贩卖机、车票",
    },
    {
      title: "未来日期",
      durationSeconds: 4,
      executionMode: "action_insert",
      characters: "女高中生",
      scene: "同前，贩卖机前",
      props: "车票",
    },
    {
      title: "无司机电车",
      durationSeconds: 4,
      characters: "车手",
      scene: "同前，街口",
      visualDescription: "老电车从雨雾里驶来，驾驶室玻璃后空空荡荡，没有司机。",
      primaryAction: "她看见无司机的老电车。",
      props: "老电车",
    },
  ],
});
assert(contextualSameSceneDetail.shots[1]!.scene === "旧街角，深夜雨，霓虹招牌昏暗闪烁，贩卖机前", "contextual scene details such as 同前，贩卖机前 should become self-contained before UI confirmation");
assert(contextualSameSceneDetail.shots[2]!.scene === "旧街角，深夜雨，霓虹招牌昏暗闪烁，贩卖机前，街口", "later contextual scene details should keep inheriting concrete scene context");
assert(contextualSameSceneDetail.shots[2]!.characters === "无", "driverless shots must not infer or keep a generic driver/车手 character");

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
assert(halfSecondDriftSum === 10, "short plans should merge excess shots before quantizing to executable video durations");
assert(halfSecondDriftNormalized.shots.length === 2, "10s plans should not keep three separate 4s-minimum video shots");
assert(halfSecondDriftNormalized.shots.every((shot) => Number.isInteger(shot.durationSeconds)), "video-generation shot durations should be integer seconds");
assert(halfSecondDriftNormalized.warnings.some((warning) => warning.includes("归一化")), "half-second duration drift should leave a warning");
assert(halfSecondDriftNormalized.warnings.some((warning) => warning.includes("合并为 2 个可执行段")), "short plans should explain shot merging");

const authoritativeTargetNormalized = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 12,
  shots: [
    { title: "黑猫跑过", durationSeconds: 4, primaryAction: "黑猫叼着车票跑过" },
    { title: "车票发光", durationSeconds: 4, primaryAction: "发光车票特写" },
    { title: "少女追赶", durationSeconds: 4, primaryAction: "少女追上黑猫" },
  ],
}, {
  targetDurationSeconds: 8,
});
const authoritativeTargetSum = Math.round(authoritativeTargetNormalized.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0) * 10) / 10;
assert(authoritativeTargetNormalized.shots.length === 2, "explicit user target should override AI-expanded total duration and merge excess shots");
assert(authoritativeTargetSum === 8, "explicit 8s target should stay 8s after executable-duration normalization");

const manyShots = normalizeDirectorAiStoryboardPlan({
  totalDurationSeconds: 320,
  shots: Array.from({ length: 72 }, (_, index) => ({
    title: `长片镜头 ${index + 1}`,
    durationSeconds: 4,
  })),
});
assert(manyShots.shots.length === 72, "AI storyboard normalization should preserve long-project shot plans well beyond 24 shots");

console.log(`director-ai-storyboard-planner-test: shots=${plan.shots.length}, prompt=${prompt.length}.`);
