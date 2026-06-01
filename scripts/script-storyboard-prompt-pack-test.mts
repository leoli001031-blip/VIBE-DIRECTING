import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildScriptStoryboardPromptPack,
  DIRECTOR_STORYBOARD_TABLE_COLUMNS,
  SCRIPT_STORYBOARD_PROMPT_PACK_VERSION,
} from "../src/core/scriptStoryboardPromptPack.ts";
import { buildDirectorSessionFromIntake } from "../src/core/directorSession.ts";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";
import {
  buildStoryDiscussionWorkspace,
  confirmStoryDiscussionDeltas,
  stageStoryDiscussionTurn,
} from "../src/core/storyDiscussionWorkspace.ts";
import { JIMENG_CLI_VIP_MODEL_VERSION } from "../src/core/jimengVideoCli.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function tableToMarkdown(rows: Array<Record<string, string>>): string {
  const columns = [...DIRECTOR_STORYBOARD_TABLE_COLUMNS];
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => (row[column] || "-").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const fixtureRoot = path.resolve("real-test-sandbox/storyboard-sheet-chain-flex-live-20260520-01/assets");
const outputRoot = path.resolve("real-test-sandbox/script-storyboard-prompt-pack-20260521-01");

const sceneRooftop: StoryboardReferenceAsset = {
  id: "scene_rooftop_after_rain",
  role: "scene_baseline",
  path: path.join(fixtureRoot, "scenes", "after-rain-school-rooftop.png"),
  label: "雨后学校天台场景基准",
};
const hina: StoryboardReferenceAsset = {
  id: "char_hina",
  role: "character_identity",
  path: path.join(fixtureRoot, "characters", "hina-main-character.png"),
  label: "短发少女日奈",
};
const ren: StoryboardReferenceAsset = {
  id: "char_ren",
  role: "character_identity",
  path: path.join(fixtureRoot, "characters", "ren-supporting-character.png"),
  label: "少年莲",
};
const cassette: StoryboardReferenceAsset = {
  id: "prop_blue_cassette",
  role: "prop_reference",
  path: path.join(fixtureRoot, "props", "blue-cassette-case.png"),
  label: "蓝色磁带盒",
};
const hinaVoice: StoryboardReferenceAsset = {
  id: "audio_hina_line",
  role: "dialogue_audio",
  path: path.join(outputRoot, "audio", "placeholder-hina-line.wav"),
  label: "日奈台词音频占位",
};

const completeScript = [
  "片名：《雨后旧磁带》",
  "地点：放学后的学校天台。雨刚停，地面积水映着傍晚的蓝色天空。屋顶门在画面右侧，栏杆和城市天际线在远处。",
  "人物：日奈，短发少女，校服领口有蝴蝶结，手里藏着一个蓝色磁带盒。莲，少年，背着书包，从天台门口出现。",
  "",
  "日奈一个人站在栏杆旁。她本来只是想确认口袋里的东西还在不在，手指摸到蓝色磁带盒时停住。她看向天台门，像是早就预感有人会来。",
  "屋顶门被推开。莲站在门边，看见日奈的手往身后藏。他没有马上靠近，只看着她。",
  "莲问：“你还留着那个？”",
  "日奈没有立刻回答。她把磁带盒从身后拿出来，递向莲。",
  "日奈说：“不是要还给你，只是……借你听一次。”",
  "莲伸手，却在快碰到磁带盒时停了一下。两个人隔着雨后的反光对望。",
  "最后他们并肩站在栏杆旁，磁带盒夹在两人中间。日奈别开视线，轻轻笑了一下。",
  "莲说：“那就，从头开始听吧。”",
].join("\n");

const pack = buildScriptStoryboardPromptPack({
  title: "雨后旧磁带",
  logline: "雨后天台上，一个短发少女把旧磁带递给少年，两个人在沉默里重新靠近。",
  completeScript,
  style: "quiet Japanese TV anime, rainy rooftop, restrained teen romance, clean cinematic framing",
  storyboardOutputDir: path.join(outputRoot, "storyboards"),
  videoOutputDir: path.join(outputRoot, "seedance"),
  image2OutputSize: "1280x720",
  seedanceModelVersion: JIMENG_CLI_VIP_MODEL_VERSION,
  seedanceVideoResolution: "720p",
  referenceBundle: {
    scenes: [sceneRooftop],
    characters: [hina, ren],
    props: [cassette],
    audio: [hinaVoice],
  },
  shots: [
    {
      shotId: "RS01",
      title: "雨后天台建立，日奈一个人站在栏杆旁",
      durationSeconds: 4,
      executionMode: "relationship_wide",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id],
      propIds: [],
      shotSize: "宽中景建立",
      camera: "宽中景，轻微推进；栏杆横贯后景，湿地面反光，屋顶门留在画面右侧远处。",
      frameDescription: "日奈独自站在画面左侧靠近栏杆，肩上书包微微下滑，她低头避开城市灯光，右手自然垂在口袋附近。",
      actionBeats: ["雨后天台空间建立", "日奈呼吸很轻", "右手停在口袋旁"],
      primaryAction: "日奈在栏杆旁安静停住",
      actionTrigger: "雨停后的天台突然安静下来",
      microReaction: "她呼吸很轻，右手停在口袋旁",
      animeShotGrammar: ["用宽一点的关系景别交代天台空间", "不要急着进入道具动作"],
      dialogue: "-",
      sound: "远处城市低噪，雨水从栏杆滴落。",
      characterGuidance: ["日奈必须保持短发、蝴蝶结、校服轮廓，表情克制。"],
    },
    {
      shotId: "RS02",
      title: "手指碰到旧磁带，日奈停住",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id],
      propIds: [cassette.id],
      shotSize: "手部特写到脸部近景",
      camera: "低角度手部特写，轻微上摇到日奈脸侧；背景保持湿地面反光和栏杆虚化。",
      frameDescription: "日奈的手指在口袋里摸到蓝色磁带盒边角。她肩膀轻轻停住，慢慢把磁带盒取出一半。",
      actionBeats: ["手指碰到磁带盒边角", "肩膀停住", "磁带盒露出一半"],
      primaryAction: "日奈把磁带盒取出一半",
      actionTrigger: "手指摸到口袋里的硬质盒角",
      microReaction: "她肩膀轻轻停住",
      animeShotGrammar: ["插入手部特写", "从手部动作带到脸部反应"],
      dialogue: "小声：还在啊。",
      sound: "布料摩擦声，远处水滴声。",
      transition: "从 RS01 的右手位置切入。",
      characterGuidance: ["只露出日奈侧脸和短发轮廓，保持蝴蝶结和校服细节。"],
      propGuidance: ["蓝色磁带盒只露出一半，形状和颜色来自锁定道具参考。"],
    },
    {
      shotId: "RS03",
      title: "屋顶门被推开，莲从右侧入画",
      durationSeconds: 4,
      executionMode: "relationship_wide",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "全景",
      camera: "保持 180 度轴线的全景；日奈在画面左前景，屋顶门在右后景，镜头轻微横移到门口。",
      frameDescription: "屋顶门被推开，莲从画面右侧门里探出半个身位。日奈背对门口，手里的磁带盒停在胸口前。",
      actionBeats: ["屋顶门开一条缝", "莲从右侧入画", "日奈背影停住"],
      primaryAction: "莲从右侧屋顶门探出半个身位",
      actionTrigger: "屋顶门被推开",
      microReaction: "日奈背影停住",
      actorAction: "莲从右侧屋顶门探出半个身位",
      reactorResponse: "日奈背对门口，手里的磁带停在胸口前",
      animeShotGrammar: ["用远一点的关系镜头重新交代两人的空间距离", "保持日奈左、莲右"],
      dialogue: "-",
      sound: "铁门轻响，门轴短促摩擦。",
      transition: "从 RS02 的停顿接到右侧屋顶门。",
      characterGuidance: ["日奈仍在左侧，莲从右侧出现，左右关系建立清楚。"],
      propGuidance: ["磁带盒靠近日奈胸口，暂时不要递出。"],
    },
    {
      shotId: "RS04",
      title: "日奈把磁带藏到身后，莲看见了",
      durationSeconds: 5,
      executionMode: "reaction_closeup",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "中景正反关系",
      camera: "中景，轻微推近；日奈左前景三分之二背对镜头，莲右后景正面对她。",
      frameDescription: "日奈向左后退半步，把蓝色磁带盒藏到身后。莲没有靠近，只把视线落到她藏起来的手上。",
      actionBeats: ["日奈后退半步", "手腕转到身后", "莲的视线落向她身后"],
      primaryAction: "日奈把磁带盒藏到身后",
      actionTrigger: "莲看见她手里的磁带盒",
      microReaction: "莲的视线落向她身后的手",
      actorAction: "日奈后退半步，把手腕转到身后",
      reactorResponse: "莲没有靠近，只看向她藏起来的手",
      animeShotGrammar: ["反应镜头优先", "用视线和小动作表现关系压力"],
      dialogue: "莲：你还留着那个？",
      sound: "鞋底踩过湿地面的轻响。",
      transition: "从莲入画后切回日奈反应。",
      characterGuidance: ["日奈左侧、莲右侧，保持屏幕方向；日奈紧张，莲轻声发问。"],
      propGuidance: ["磁带被藏在日奈身后，但边角可见。"],
    },
    {
      shotId: "RS05",
      title: "日奈把磁带从身后拿出来",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "中近景",
      camera: "日奈侧面中近景，莲在右侧虚焦；镜头从日奈肩线轻微下移到手里的磁带。",
      frameDescription: "日奈没有回答，她低头把磁带盒从身后慢慢拿到身前。莲站在右侧等她开口。",
      actionBeats: ["日奈低头", "磁带从身后移到身前", "莲停住等待"],
      primaryAction: "日奈把磁带盒从身后拿到身前",
      actionTrigger: "莲的问题让沉默停住",
      microReaction: "莲站在右侧停住等待",
      actorAction: "日奈低头，把磁带盒移到身前",
      reactorResponse: "莲站在右侧等待她开口",
      animeShotGrammar: ["道具插入镜头", "让沉默成为转场"],
      dialogue: "-",
      sound: "风声短暂停顿，塑料磁带盒轻碰指节。",
      transition: "从莲的问题后留一拍沉默。",
      characterGuidance: ["日奈表情克制，莲只作为等待的右侧身影。"],
      propGuidance: ["蓝色磁带盒必须清楚进入画面中心。"],
    },
    {
      shotId: "RS06A",
      title: "远一点的双人关系，日奈准备递出磁带",
      durationSeconds: 4,
      executionMode: "relationship_wide",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "宽中景双人关系",
      camera: "远一点的侧面双人关系镜头，日奈保持左侧，莲保持右侧，两人之间留出明显空间，镜头轻微横移而不是贴脸对视。",
      frameDescription: "日奈把蓝色磁带盒从胸前慢慢递向莲，两个人还隔着一小段距离，湿地面反射出两人的脚和栏杆。",
      actionBeats: ["日奈手臂开始伸出", "莲没有马上动", "两人之间的距离被看见"],
      primaryAction: "日奈把磁带盒慢慢递向莲",
      actionTrigger: "她决定不再把磁带藏起来",
      microReaction: "莲没有马上动",
      actorAction: "日奈手臂开始伸出",
      reactorResponse: "莲保持在右侧，先停住没有接",
      dialogue: "-",
      sound: "风声和雨后滴水，台词前的沉默。",
      transition: "从 RS05 的磁带中心接到递出动作。",
      animeShotGrammar: ["先用较远双人关系镜头建立递东西的空间", "不要做正面对视平铺镜头", "保留日漫里常见的含蓄距离感"],
      characterGuidance: ["日奈递出动作要克制，莲保持等待姿态。"],
      propGuidance: ["蓝色磁带盒在两人中间，但不要占满画面。"],
    },
    {
      shotId: "RS06B",
      title: "手部特写，磁带停在两只手之间",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      dialogueAudioId: hinaVoice.id,
      shotSize: "手部动作特写",
      camera: "低一点的手部插入特写，浅景深；背景只保留湿地面反光和校服边缘，不拍成完整正面对话。",
      frameDescription: "日奈的手托着蓝色磁带盒伸向画面右侧。莲的手从右侧伸进来，在快碰到磁带前停住半拍。",
      actionBeats: ["日奈手指收紧", "莲的手慢慢靠近", "两只手之间留出半拍停顿"],
      primaryAction: "莲的手慢慢靠近磁带盒",
      actionTrigger: "日奈把磁带盒递到两人中间",
      microReaction: "两只手之间留出半拍停顿",
      actorAction: "莲的手从右侧伸进来",
      reactorResponse: "日奈手指收紧但没有收回磁带",
      dialogue: "日奈：不是要还给你，只是……借你听一次。",
      sound: "台词贴近手部停顿，塑料盒轻响，雨水滴落。",
      transition: "从 RS06A 的双人关系切到磁带和手。",
      animeShotGrammar: ["典型道具插入镜头", "用手部停顿表现人物犹豫", "不要让人物站桩完成整段动作"],
      characterGuidance: ["只需要手、袖口和少量校服边缘，避免重新发明脸。"],
      propGuidance: ["蓝色磁带盒必须清楚，夹在两只手之间。"],
    },
    {
      shotId: "RS06C",
      title: "人物反应特写，眼线从磁带抬到彼此",
      durationSeconds: 5,
      executionMode: "reaction_closeup",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "日奈近景到莲反应近景",
      camera: "先日奈三分之二侧脸近景，再切莲反应近景；保持同一条视线轴，不做两人正面平铺。",
      frameDescription: "日奈说完后视线从磁带慢慢抬起。莲看着她，手仍停在磁带前，两人的眼神短暂相遇。",
      actionBeats: ["日奈眼神从磁带抬起", "莲轻微怔住", "两人短暂对视"],
      primaryAction: "日奈的眼神从磁带抬到莲脸上",
      actionTrigger: "日奈说完那句借你听一次",
      microReaction: "莲轻微怔住",
      actorAction: "日奈慢慢抬眼",
      reactorResponse: "莲的手仍停在磁带前，眼神短暂回应",
      dialogue: "-",
      sound: "台词后的安静，远处城市声和水滴声。",
      transition: "从 RS06B 的手部停顿切到脸部反应。",
      animeShotGrammar: ["情绪用脸部特写和反应特写表达", "不要用平面双人对视硬撑整段", "让眼线承接上一镜的手部动作"],
      characterGuidance: ["日奈短发、蝴蝶结、克制表情；莲温和但惊讶。"],
      propGuidance: ["磁带可以在画面下缘或虚焦处出现，作为眼线来源。"],
    },
    {
      shotId: "RS07",
      title: "并肩站在栏杆旁，从头开始听",
      durationSeconds: 6,
      executionMode: "relationship_wide",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "中近景到宽中景",
      camera: "轻微环绕后停住；栏杆、城市灯和湿地面倒影形成安静结尾。",
      frameDescription: "日奈和莲并肩靠近栏杆，日奈在左、莲在右，蓝色磁带盒夹在两人中间。日奈别开视线微笑，莲低头看着磁带。",
      actionBeats: ["莲接过磁带盒", "日奈别开视线但笑了一下", "地面积水里出现两人的倒影"],
      primaryAction: "莲接过磁带盒",
      actionTrigger: "两人都停在递交动作的沉默里",
      microReaction: "日奈别开视线但笑了一下",
      actorAction: "莲低头接过磁带盒",
      reactorResponse: "日奈别开视线，露出很轻的笑",
      animeShotGrammar: ["结尾回到宽一点的关系镜头", "用距离变化而不是夸张动作表达关系缓和"],
      dialogue: "莲：那就，从头开始听吧。",
      sound: "雨后风声，远处社团活动声很淡。",
      transition: "慢慢停在两人的并肩背影和倒影上。",
      characterGuidance: ["保持日奈左、莲右，距离比上一镜更近。"],
      propGuidance: ["磁带盒不要消失，作为两人关系的中心。"],
    },
  ],
});

assert(pack.schemaVersion === SCRIPT_STORYBOARD_PROMPT_PACK_VERSION, "schema version mismatch");
assert(pack.rules.scriptFirst === true, "script-first rule missing");
assert(
  pack.referenceRoleBindings.map((binding) => binding.role).join("|") === "storyboard_reference|scene_baseline|character_identity|prop_reference|dialogue_audio",
  "prompt pack must carry reference role bindings",
);
assert(
  pack.referenceRoleBindings.find((binding) => binding.role === "storyboard_reference")?.ignoreFor.includes("character identity"),
  "prompt pack storyboard binding must prevent identity authority leaks",
);
assert(pack.directorRows.length === 9, "expected nine director rows");
assert(DIRECTOR_STORYBOARD_TABLE_COLUMNS.includes("节奏/拍法"), "director table should include rhythm column");
assert(DIRECTOR_STORYBOARD_TABLE_COLUMNS.includes("拍法理由"), "director table should include rhythm reason column");
assert(DIRECTOR_STORYBOARD_TABLE_COLUMNS.includes("时间规划"), "director table should include timing plan column");
assert(pack.shots.length === 9, "expected nine prompt-pack shots");
assert(pack.blockers.length === 0, `golden prompt pack should not have blockers: ${pack.blockers.join(", ")}`);
assert(pack.warnings.length === 0, `golden prompt pack should not have action QA warnings: ${pack.warnings.join(", ")}`);
assert(pack.completeScript.includes("完整") === false, "complete script should be concrete, not meta text");
assert(pack.completeScript.includes("莲说：“那就，从头开始听吧。”"), "complete script missing ending line");

for (const shot of pack.shots) {
  if (shot.productionSkillPlan.strategyId === "omni_reference") {
    assert(!shot.image2StoryboardPlan, `${shot.shotId} omni reference should not create an Image2 storyboard plan`);
    assert(!shot.seedanceVideoPlan.inputs.images.some((image) => image.role === "storyboard_reference"), `${shot.shotId} omni reference should not pass storyboard image to Seedance`);
    assert(shot.seedanceVideoPlan.prompt.includes("No storyboard reference image is attached"), `${shot.shotId} omni Seedance prompt should state no storyboard reference`);
    assert(shot.seedanceVideoPlan.prompt.includes("written shot direction controls motion and camera"), `${shot.shotId} omni Seedance prompt should use written direction as motion authority`);
  } else {
    assert(shot.image2StoryboardPlan, `${shot.shotId} storyboard strategy should create an Image2 storyboard plan`);
    if (shot.productionSkillPlan.image2Directive.allowProductionAnnotations) {
      assert(shot.image2StoryboardPlan.prompt.includes("Production annotation mode"), `${shot.shotId} Image2 prompt should expose annotation mode`);
      assert(shot.image2StoryboardPlan.prompt.includes("Visible timing labels are allowed"), `${shot.shotId} annotated Image2 prompt should allow tiny panel timing labels`);
      assert(shot.image2StoryboardPlan.prompt.includes("tiny panel timecodes/time ranges"), `${shot.shotId} annotated Image2 prompt should allow time ranges in rough previs`);
      assert(shot.seedanceVideoPlan.prompt.includes("Do not render storyboard artifacts"), `${shot.shotId} Seedance prompt should strip storyboard annotations`);
    } else {
      assert(shot.image2StoryboardPlan.prompt.includes("Avoid all legible written words"), `${shot.shotId} Image2 prompt should avoid text leakage`);
    }
    assert(shot.image2StoryboardPlan.prompt.includes("Character identity safety"), `${shot.shotId} Image2 prompt should protect identity`);
    assert(shot.seedanceVideoPlan.prompt.includes("The storyboard panel count is a hard visible-cut budget"), `${shot.shotId} Seedance prompt should keep panel count as cut budget`);
    assert(shot.seedanceVideoPlan.referencePolicy.roleBindings.some((binding) => binding.role === "storyboard_reference"), `${shot.shotId} Seedance plan should bind storyboard reference role`);
    assert(shot.image2StoryboardPlan.referencePolicy.roleBindings.length >= 2, `${shot.shotId} Image2 plan should carry use-ignore bindings`);
    assert(shot.image2StoryboardPlan.prompt.includes("Director rhythm"), `${shot.shotId} Image2 prompt should carry rhythm guidance`);
    assert(shot.image2StoryboardPlan.prompt.includes("[PANEL TIMING MAP]"), `${shot.shotId} Image2 prompt should carry panel timing sidecar`);
  }
  assert(shot.productionSkillPlan.schemaVersion === "director_production_skill_v1", `${shot.shotId} should carry internal production skill plan`);
  assert(shot.seedanceVideoPlan.prompt.includes("Internal production skill for Seedance"), `${shot.shotId} Seedance prompt should include internal production skill block`);
  assert(shot.seedanceVideoPlan.prompt.includes("Reference priority rule"), `${shot.shotId} Seedance prompt should define reference priority`);
  assert(shot.seedanceVideoPlan.prompt.includes("Do not invent extra cuts from detail words"), `${shot.shotId} Seedance prompt should prevent support details becoming extra cuts`);
  assert(shot.seedanceVideoPlan.videoResolution === "720p", `${shot.shotId} should default to 720p`);
  assert(shot.seedanceVideoPlan.modelVersion === JIMENG_CLI_VIP_MODEL_VERSION, `${shot.shotId} should preserve VIP model selection`);
  assert(shot.storyboardDirectorPlan.schemaVersion === "storyboard_director_plan_v1", `${shot.shotId} should carry a storyboard director plan`);
  assert(shot.storyboardDirectorPlan.rhythmProfile, `${shot.shotId} should carry rhythm profile`);
  assert(shot.storyboardDirectorPlan.rhythmReason.length > 8, `${shot.shotId} should carry a human rhythm reason`);
  assert(shot.seedanceVideoPlan.prompt.includes("Rhythm and shooting approach"), `${shot.shotId} Seedance prompt should carry rhythm guidance`);
  assert(shot.storyboardDirectorPlan.mainComposition.startFrameAnchor.includes("Start from"), `${shot.shotId} should carry a start-frame anchor`);
  assert(shot.storyboardDirectorPlan.timingBeats.length >= 1, `${shot.shotId} should carry timing beats`);
  assert(shot.directorRow["时间规划"].includes("Beat 01"), `${shot.shotId} director row should expose timing plan`);
  assert(shot.seedanceVideoPlan.prompt.includes("[TIMING PLAN]"), `${shot.shotId} Seedance prompt should carry timing sidecar`);
  assert(!shot.seedanceVideoPlan.prompt.includes("Action beats in order"), `${shot.shotId} should not pass full action beats into Seedance`);
}

const rs06b = pack.shots.find((shot) => shot.shotId === "RS06B");
assert(rs06b?.seedanceVideoPlan.inputs.audio.length === 1, "RS06B should carry dialogue audio as timing reference");
assert(rs06b?.seedanceVideoPlan.durationSeconds === 4, "RS06B duration should come from script plan");
assert(rs06b?.productionSkillPlan.strategyId === "omni_reference", "RS06B short hand insert should use omni reference instead of a single start frame");
assert(!rs06b?.image2StoryboardPlan, "RS06B omni reference should not create an Image2 storyboard/start-frame plan");
assert(rs06b?.seedanceVideoPlan.inputs.images.map((item) => item.role).join("|") === "scene_baseline|character_identity|character_identity|prop_reference", "RS06B Seedance refs should include scene, both characters, and prop");
assert(rs06b?.seedanceVideoPlan.inputs.images.every((item) => item.roleBinding?.role === item.role), "RS06B Seedance refs should carry role bindings");
assert(rs06b?.seedanceVideoPlan.prompt.includes("Execution mode: action_insert"), "RS06B should expose action insert mode");
assert(rs06b?.actionQA.primaryAction.includes("靠近"), "RS06B should infer one primary hand action");
assert(rs06b?.seedanceVideoPlan.prompt.includes("Director action QA"), "RS06B should expose structured action QA");
assert(rs06b?.seedanceVideoPlan.prompt.includes("Start frame anchor"), "RS06B Seedance prompt should carry a start-frame anchor");
assert(rs06b?.seedanceVideoPlan.prompt.includes("Primary action after start frame"), "RS06B Seedance prompt should carry the primary action after the start frame");
assert(rs06b?.storyboardDirectorPlan.supportPanels.length <= 2, "RS06B short shot should compress support panels");
assert(rs06b?.directorRow["行动/反应QA"].includes("行动："), "RS06B director row should expose action/reaction QA");
assert(rs06b?.directorRow["节奏/拍法"] === rs06b?.storyboardDirectorPlan.rhythmProfile, "RS06B director row should expose rhythm profile");
assert(rs06b?.directorRow["拍法理由"].includes("适合"), "RS06B director row should expose rhythm reason");
assert(rs06b?.seedanceVideoPlan.prompt.includes("Anime shot grammar"), "RS06B Seedance prompt should expose anime shot grammar");

const complexPack = buildScriptStoryboardPromptPack({
  title: "复杂动作 QA",
  logline: "一个测试镜头不应把连续动作直送视频模型。",
  completeScript: "少女听见门响后起身、穿过房间、拿起钥匙、打开门、回头看。",
  style: "quiet anime",
  storyboardOutputDir: path.join(outputRoot, "complex-storyboards"),
  videoOutputDir: path.join(outputRoot, "complex-seedance"),
  referenceBundle: {
    scenes: [sceneRooftop],
    characters: [hina],
    props: [cassette],
  },
  shots: [
    {
      shotId: "CX01",
      title: "复杂动作链应被拆镜",
      durationSeconds: 4,
      executionMode: "single_continuous_shot",
      sceneId: sceneRooftop.id,
      characterIds: [hina.id],
      propIds: [cassette.id],
      shotSize: "中景",
      camera: "固定中景。",
      frameDescription: "日奈听见门响后起身，穿过天台，拿起磁带盒，走到门口又回头看。",
      primaryAction: "日奈起身",
      actionTrigger: "屋顶门外传来声音",
      microReaction: "她回头前呼吸停住半拍",
      actionBeats: ["听见门响", "起身", "穿过天台", "拿起磁带盒", "走到门口又回头看"],
      dialogue: "-",
      sound: "门外轻响。",
    },
  ],
});
const complexShot = complexPack.shots[0];
assert(complexPack.blockers.some((blocker) => blocker.includes("CX01: complex_action_requires_split_before_video_prompt")), "complex action should create a prompt-pack blocker");
assert(complexPack.blockers.some((blocker) => blocker.includes("CX01: duration_action_density_exceeded")), "complex action should create a duration-density blocker");
assert(complexShot.actionQA.blockers.includes("complex_action_requires_split_before_video_prompt"), "complex shot should carry action QA blocker");
assert(complexShot.seedanceVideoPlan.prompt.includes("Motion QA blocker"), "complex video prompt should carry blocker warning");
assert(!complexShot.seedanceVideoPlan.prompt.includes("Action beats in order"), "complex action beats must not be copied into direct video prompt");
assert(complexShot.image2StoryboardPlan?.prompt.includes("Storyboard planning blocker"), "complex Image2 prompt should simplify crowded storyboards");

const revisionCreatedAt = "2026-05-22T10:00:00.000Z";
const revisionScript = [
  "少年在空旷车站追上即将离开的少女。",
  "少女握着旧车票停在站台边，列车灯光从远处扫过。",
  "少年伸手想拦住她，却在快碰到她手里的车票时停住。",
  "少女回头，眼神终于松动。",
].join("\n");
const revisionDraft = buildProjectIntakeDraft({
  createdAt: revisionCreatedAt,
  draftId: "anime_revision_chain_draft",
  scriptText: revisionScript,
  styleNote: "克制青春日漫，车站夜色，动作要有切点。",
  referenceAssets: [
    { id: "chain_scene_station", type: "scene", label: "夜色站台" },
    { id: "chain_char_boy", type: "character", label: "追上来的少年" },
    { id: "chain_char_girl", type: "character", label: "握着旧车票的少女" },
    { id: "chain_prop_ticket", type: "prop", label: "旧车票" },
  ],
});
const revisionSession = buildDirectorSessionFromIntake({
  draft: revisionDraft,
  projection: buildIntakeStagedPlanProjection(revisionDraft),
  projectId: "anime_revision_chain",
  createdAt: revisionCreatedAt,
  sessionId: "anime_revision_chain_session",
});
const revisionWorkspace = stageStoryDiscussionTurn({
  workspace: buildStoryDiscussionWorkspace({ session: revisionSession, createdAt: revisionCreatedAt }),
  text: "动作太平，想要日漫里远景-表情特写-手部动作特写的节奏，不要广告感，镜头多拆一点。",
  createdAt: revisionCreatedAt,
});
const confirmedRevisionWorkspace = confirmStoryDiscussionDeltas({
  workspace: revisionWorkspace,
  createdAt: revisionCreatedAt,
});
const splitRevision = confirmedRevisionWorkspace.stagedDeltas.find((delta) => delta.kind === "storyboard_split_preference")?.revisionSummary;
assert(splitRevision?.requestedSplitPolicy === "more_micro_shots", "revision chain should parse split-more director feedback");
assert(splitRevision.requestedRhythmProfile === "action_fast_cut", "revision chain should parse anime fast-cut rhythm");
assert(splitRevision.avoidStyle.includes("广告感"), "revision chain should preserve avoid-advertising style intent");

const stationScene: StoryboardReferenceAsset = {
  id: "chain_scene_station",
  role: "scene_baseline",
  path: path.join(outputRoot, "revision-chain", "scene-station.png"),
  label: "夜色站台场景基准",
};
const boyRef: StoryboardReferenceAsset = {
  id: "chain_char_boy",
  role: "character_identity",
  path: path.join(outputRoot, "revision-chain", "boy.png"),
  label: "追上来的少年",
};
const girlRef: StoryboardReferenceAsset = {
  id: "chain_char_girl",
  role: "character_identity",
  path: path.join(outputRoot, "revision-chain", "girl.png"),
  label: "握着旧车票的少女",
};
const ticketRef: StoryboardReferenceAsset = {
  id: "chain_prop_ticket",
  role: "prop_reference",
  path: path.join(outputRoot, "revision-chain", "ticket.png"),
  label: "旧车票",
};
const revisionChainPack = buildScriptStoryboardPromptPack({
  title: "站台旧车票",
  logline: "少年追上即将离开的少女，动作被拆成远景、表情和手部细节。",
  completeScript: revisionScript,
  style: "restrained Japanese TV anime, night station, clear emotional action cut points",
  creativeBrief: {
    rhythmLikes: [splitRevision.confirmationCopy, "远景-表情特写-手部动作特写"],
    expressionLikes: ["日漫表情特写", "手部动作特写", "不要广告感"],
    notes: splitRevision.reason,
  },
  storyboardOutputDir: path.join(outputRoot, "revision-chain", "storyboards"),
  videoOutputDir: path.join(outputRoot, "revision-chain", "seedance"),
  image2OutputSize: "1280x720",
  seedanceVideoResolution: "720p",
  referenceBundle: {
    scenes: [stationScene],
    characters: [boyRef, girlRef],
    props: [ticketRef],
  },
  shots: [
    {
      shotId: "AR01",
      title: "远景关系，少年追到站台边",
      durationSeconds: 4,
      executionMode: "relationship_wide",
      sceneId: stationScene.id,
      characterIds: [boyRef.id, girlRef.id],
      propIds: [ticketRef.id],
      shotSize: "远景关系",
      rhythmProfile: splitRevision.requestedRhythmProfile,
      camera: "远一点的横向关系镜头，少女在左侧站台边，少年从右后方追到画面里，列车灯光扫过湿冷地面。",
      frameDescription: "两个人之间还隔着一段距离，旧车票在少女手里，站台灯和轨道构成清楚方向。",
      actionBeats: ["少年从右侧追入画面", "少女站在左侧没有回头", "列车灯光扫过两人之间的空隙"],
      primaryAction: "少年追到少女身后但没有碰到她",
      actionTrigger: "列车进站灯光扫过站台",
      microReaction: "少女肩膀轻轻停住",
      actorAction: "少年从右侧追到少女身后",
      reactorResponse: "少女站在左侧没有回头，只是肩膀停住",
      animeShotGrammar: ["先用远景关系建立空间和方向", "不要拍成广告式英雄展示"],
      sound: "列车远处驶入，站台广播压低。",
    },
    {
      shotId: "AR02",
      title: "表情特写，少女听见脚步后回头前停住",
      durationSeconds: 3,
      executionMode: "reaction_closeup",
      sceneId: stationScene.id,
      characterIds: [girlRef.id],
      propIds: [ticketRef.id],
      shotSize: "表情特写",
      rhythmProfile: splitRevision.requestedRhythmProfile,
      camera: "少女三分之二侧脸近景，眼神从远处列车灯慢慢移向身后，背景站台虚化。",
      frameDescription: "少女没有马上回头，睫毛和眼神先变化，手里的旧车票在画面下缘虚焦。",
      actionBeats: ["少女眼神先动", "呼吸停半拍", "旧车票在下缘虚焦"],
      primaryAction: "少女眼神从列车灯移向身后",
      actionTrigger: "少年脚步声停在她身后",
      microReaction: "她呼吸停半拍",
      animeShotGrammar: ["日漫表情特写", "让眼神承接上一镜远景"],
      sound: "脚步声停住，广播声变远。",
    },
    {
      shotId: "AR03",
      title: "手部动作特写，少年伸手在车票前停住",
      durationSeconds: 3,
      executionMode: "action_insert",
      sceneId: stationScene.id,
      characterIds: [boyRef.id, girlRef.id],
      propIds: [ticketRef.id],
      shotSize: "手部动作特写",
      rhythmProfile: splitRevision.requestedRhythmProfile,
      camera: "低一点的手部插入特写，少年手从右侧进入，少女握着旧车票在左侧，浅景深保持站台灯反光。",
      frameDescription: "少年伸手想拦住少女，却在快碰到旧车票前停住，少女手指轻轻收紧。",
      actionBeats: ["少年手从右侧伸入", "快碰到旧车票前停住", "少女手指收紧"],
      primaryAction: "少年伸手到旧车票前停住",
      actionTrigger: "少女终于要转身",
      microReaction: "少女手指收紧",
      actorAction: "少年手从右侧伸入",
      reactorResponse: "少女握紧旧车票但没有躲开",
      animeShotGrammar: ["典型手部插入镜头", "动作点清楚，不要把整段塞进一个长镜头"],
      sound: "布料摩擦和车票纸张轻响。",
    },
  ],
});
assert(revisionChainPack.blockers.length === 0, `revision chain pack should stay dry-run ready: ${revisionChainPack.blockers.join(", ")}`);
assert(revisionChainPack.directorRows.length === 3, "revision chain should produce a three-shot director table");
assert(
  revisionChainPack.shots.every((shot) => shot.storyboardDirectorPlan.rhythmProfile === "action_fast_cut"),
  "revision chain shots should apply confirmed action fast-cut rhythm feedback",
);
assert(
  revisionChainPack.shots.map((shot) => shot.directorRow.景别).join("|") === "远景关系|表情特写|手部动作特写",
  "revision chain storyboard table should reflect wide-face-hand split",
);
assert(
  revisionChainPack.shots.every((shot) => shot.image2StoryboardPlan?.prompt.includes("Action fast-cut storyboard grammar")),
  "revision chain Image2 plans should compile action fast-cut storyboard grammar",
);
assert(
  revisionChainPack.shots.every((shot) => shot.seedanceVideoPlan.prompt.includes("Action fast-cut rhythm")),
  "revision chain Seedance plans should compile action fast-cut motion guidance",
);
assert(
  revisionChainPack.shots.every((shot) => shot.seedanceVideoPlan.args.includes("--prompt") && shot.seedanceVideoPlan.videoResolution === "720p"),
  "revision chain should compile dry-run Seedance args without provider submission",
);

writeJson(path.join(outputRoot, "prompt-pack.json"), pack);
writeText(path.join(outputRoot, "complete-script.md"), `# ${pack.title}\n\n${pack.completeScript}\n`);
writeText(path.join(outputRoot, "director-storyboard-table.md"), `# 导演分镜表\n\n${tableToMarkdown(pack.directorRows)}\n`);
for (const shot of pack.shots) {
  if (shot.image2StoryboardPlan) {
    writeText(path.join(outputRoot, "prompts", "image2", `${shot.shotId}.md`), shot.image2StoryboardPlan.prompt);
  }
  writeText(path.join(outputRoot, "prompts", "seedance", `${shot.shotId}.md`), shot.seedanceVideoPlan.prompt);
}

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  shots: pack.shots.length,
  rs06bAudioRefs: rs06b?.seedanceVideoPlan.inputs.audio.length || 0,
  promptPackPath: path.join(outputRoot, "prompt-pack.json"),
  directorTablePath: path.join(outputRoot, "director-storyboard-table.md"),
}, null, 2));
