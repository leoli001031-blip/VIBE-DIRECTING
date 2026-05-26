import {
  buildImage2StoryboardReferencePlan,
  buildSeedanceStoryboardVideoPlan,
  buildStoryboardDirectorPlan,
  IMAGE2_STORYBOARD_ALLOWED_REFERENCE_ROLES,
  IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES,
  SEEDANCE_ALL_AROUND_REFERENCE_ORDER,
  STORYBOARD_REFERENCE_ROLE_BINDINGS,
  STORYBOARD_REFERENCE_PIPELINE_VERSION,
  STORYBOARD_REFERENCE_STRATEGY_PACK_IDS,
} from "../src/core/storyboardReferencePipeline.ts";
import {
  JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION,
  JIMENG_CLI_VIP_MODEL_VERSION,
} from "../src/core/jimengVideoCli.ts";
import { buildDirectorProductionSkillPlan } from "../src/core/directorProductionSkill.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sceneBaseline = {
  id: "scene_rooftop_after_rain",
  role: "scene_baseline" as const,
  path: "/project/assets/scenes/rooftop-after-rain.png",
  label: "雨后学校天台",
};
const characterReference = {
  id: "char_hina",
  role: "character_identity" as const,
  path: "/project/assets/characters/hina.png",
  label: "Hina",
};
const propReference = {
  id: "prop_cassette",
  role: "prop_reference" as const,
  path: "/project/assets/props/cassette.png",
  label: "蓝色磁带盒",
};
const storyboardReference = {
  id: "storyboard_an01",
  role: "storyboard_reference" as const,
  path: "/project/storyboard/AN01-storyboard.png",
  label: "AN01 分镜图",
};
const dialogueAudio = {
  id: "audio_an01_female_ja",
  role: "dialogue_audio" as const,
  path: "/project/audio/dialogue/AN01-female-ja.wav",
  label: "女生日语台词",
};

const image2Plan = buildImage2StoryboardReferencePlan({
  shotId: "AN01",
  shotTitle: "雨后天台，少女握紧磁带盒",
  camera: "中景，轻微推进，三分之二侧面",
  shotDescription: "少女站在湿润栏杆旁，双手把蓝色磁带盒贴近胸口，低头后抬眼看向镜头右侧。",
  characterReferences: [characterReference],
  propReferences: [propReference],
  characterGuidance: ["Hina: short bob, bow/ribbon, school-uniform staging; must match locked character reference."],
  propGuidance: ["Blue cassette case: rectangular hand prop, keep placement clear and match locked prop reference."],
  dialogue: "第一、あんた今日なんで。",
  durationSeconds: 5,
  sceneBaseline,
});

assert(image2Plan.schemaVersion === STORYBOARD_REFERENCE_PIPELINE_VERSION, "schema version drifted");
assert(image2Plan.operation === "image2.storyboard_reference", "Image2 storyboard operation mismatch");
assert(image2Plan.references.length === 3, "Image2 storyboard should use scene, character, and prop references");
assert(image2Plan.references.map((reference) => reference.role).join("|") === "scene_baseline|character_identity|prop_reference", "Image2 storyboard reference order drifted");
assert(image2Plan.references.every((reference) => reference.roleBinding?.role === reference.role), "Image2 references must carry role bindings");
assert(
  image2Plan.referencePolicy.roleBindings.map((binding) => binding.role).join("|") === "scene_baseline|character_identity|prop_reference",
  "Image2 reference policy must carry selected role bindings",
);
assert(
  image2Plan.referencePolicy.roleBindings.find((binding) => binding.role === "character_identity")?.ignoreFor.includes("camera path"),
  "character binding must ignore camera/layout authority",
);
assert(image2Plan.referencePolicy.allowedImage2Roles.join("|") === IMAGE2_STORYBOARD_ALLOWED_REFERENCE_ROLES.join("|"), "allowed roles drifted");
for (const forbiddenRole of IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES) {
  assert(image2Plan.referencePolicy.forbiddenImage2Roles.includes(forbiddenRole), `missing forbidden role ${forbiddenRole}`);
}
assert(image2Plan.referencePolicy.characterAndPropReferencesDeferredToVideo === false, "character/prop references must be available during storyboard generation");
assert(
  image2Plan.referencePolicy.strategyPackIds.join("|") === STORYBOARD_REFERENCE_STRATEGY_PACK_IDS.join("|"),
  "Image2 storyboard plan must expose director strategy pack lineage",
);
assert(/hybrid style board/i.test(image2Plan.referencePolicy.referenceDimensionRule), "Image2 reference policy must block hybrid reference blending");
assert(/scene baseline/i.test(image2Plan.prompt), "Image2 prompt must explain scene baseline role");
assert(/weather|天气|atmosphere/i.test(image2Plan.prompt), "Image2 prompt must preserve scene/weather continuity");
assert(/locked character reference/i.test(image2Plan.prompt), "Image2 prompt must use character image refs");
assert(/locked prop reference/i.test(image2Plan.prompt), "Image2 prompt must use prop image refs");
assert(/Reference dimension locking/i.test(image2Plan.prompt), "Image2 prompt must lock each reference to one dimension");
assert(/Do not blend all references into a new hybrid style board/i.test(image2Plan.prompt), "Image2 prompt must block multi-reference blending");
assert(/main composition/i.test(image2Plan.prompt), "Image2 prompt must request a main composition");
assert(/visibly read as a storyboard page/i.test(image2Plan.prompt), "Image2 prompt must preserve storyboard page grammar");
assert(/large main storyboard panel/i.test(image2Plan.prompt), "Image2 prompt must prioritize a large main storyboard panel");
assert(/55-65% of the sheet/i.test(image2Plan.prompt), "Image2 prompt must reserve most space for the main panel");
assert(/start-frame anchor/i.test(image2Plan.prompt), "Image2 prompt must treat the main panel as a start-frame anchor");
assert(/immediately before the primary action begins/i.test(image2Plan.prompt), "Image2 prompt must keep the main panel before action execution");
assert(/not the completed action, contact point, transfer, impact, reveal, or emotional payoff/i.test(image2Plan.prompt), "Image2 prompt must block action-apex main panels");
assert(/small continuity panel/i.test(image2Plan.prompt), "Image2 prompt must allow small continuity panels");
assert(/clean panel borders/i.test(image2Plan.prompt), "Image2 prompt must request real storyboard panel borders");
assert(/No PROJECT\/SCENE\/SHOT\/DURATION\/PAGE header/i.test(image2Plan.prompt), "Image2 prompt must block storyboard template headers");
assert(/no arrows, no dotted eyeline guides/i.test(image2Plan.prompt), "Image2 prompt must forbid provider-visible notation");
assert(/do not force a fixed number/i.test(image2Plan.prompt), "Image2 prompt must keep storyboard layout flexible");
assert(/5s budget/i.test(image2Plan.prompt), "Image2 prompt must include duration budget");
assert(/\[PANEL TIMING MAP\]/i.test(image2Plan.prompt), "Image2 prompt must carry panel timing sidecar");
assert(/Panel 01/i.test(image2Plan.prompt), "Image2 panel timing map must name panel beats");
assert(/Do not print timecodes inside the image/i.test(image2Plan.prompt), "Image2 timing plan must stay outside visible image text");
assert(!/Shot A \/ Shot B \/ Shot C/i.test(image2Plan.prompt), "short duration prompts must not request labeled multi-shot beats");
assert(/one primary action/i.test(image2Plan.prompt), "short duration prompts must favor one primary action");
assert(/Primary action after the start frame/i.test(image2Plan.prompt), "Image2 prompt must place primary action after the start frame");
assert(/panel order only/i.test(image2Plan.prompt), "Image2 prompt should communicate motion through clean visual sequencing");
assert(/180-degree/i.test(image2Plan.prompt), "Image2 prompt must constrain multi-character screen direction");
assert(/Character identity safety/i.test(image2Plan.prompt), "Image2 storyboard prompt must avoid inventing a conflicting heroine design");
assert(/Character guidance/i.test(image2Plan.prompt), "Image2 storyboard prompt must carry character guidance");
assert(/Prop guidance/i.test(image2Plan.prompt), "Image2 storyboard prompt must carry prop guidance");
assert(/not override them/i.test(image2Plan.prompt), "Image2 storyboard guidance must not override locked refs");
assert(/Prop reference isolation/i.test(image2Plan.prompt), "Image2 storyboard prompt must isolate prop references");
assert(/Never render a prop reference image as a standalone cutaway/i.test(image2Plan.prompt), "Image2 storyboard prompt must prevent prop references becoming storyboard panels");
assert(/no dialogue text/i.test(image2Plan.prompt), "Image2 prompt must block dialogue/subtitles/text overlays");
assert(/Avoid all legible written words/i.test(image2Plan.prompt), "Image2 storyboard prompt must avoid readable labels that can leak into video");
assert(/do not draw circled numbers, arrows, dotted sight lines/i.test(image2Plan.prompt), "Image2 storyboard prompt must prevent provider-visible symbols from leaking into video");
assert(/Reference use\/ignore bindings/i.test(image2Plan.prompt), "Image2 prompt must carry use-ignore reference bindings");
assert(/character_identity: use for face/i.test(image2Plan.prompt), "Image2 prompt must expose character use binding");

const ignoredReferencePlan = buildImage2StoryboardReferencePlan({
  shotId: "AN02",
  shotTitle: "错误角色参考输入",
  camera: "近景",
  shotDescription: "少女看向门口。",
  sceneBaseline: characterReference,
});
assert(ignoredReferencePlan.references.length === 0, "non-scene references must not pass into Image2 storyboard");
assert(
  ignoredReferencePlan.warnings.some((warning) => warning.includes("Ignored non-scene")),
  "Image2 storyboard should warn when a non-scene reference is ignored",
);

const sequenceTimingSkillPlan = buildDirectorProductionSkillPlan({
  shotId: "AN03",
  shotTitle: "雨后天台快切穿行",
  durationSeconds: 10,
  executionMode: "planned_cut_sequence",
  shotSize: "动作快切段落",
  camera: "远景建立方向后切脚步、手部和回头，保持两人空间轴线。",
  frameDescription: "屋顶门灯光忽然闪动，两人沿湿地面快步穿过天台。",
  actionBeats: ["远景交代方向", "脚步踩过积水", "莲回头确认屋顶门灯光", "两人绕过水箱"],
  primaryAction: "两人沿天台边缘快步穿行",
  actionTrigger: "屋顶门灯光突然闪动",
});
assert(sequenceTimingSkillPlan.strategyId === "storyboard_rapid_cut", "action sequence should route to rapid-cut storyboard skill");

const sequenceTimingImage2Plan = buildImage2StoryboardReferencePlan({
  shotId: "AN03",
  shotTitle: "雨后天台快切穿行",
  camera: "远景建立方向后切脚步、手部和回头，保持两人空间轴线。",
  shotDescription: "屋顶门灯光忽然闪动，两人沿湿地面快步穿过天台。",
  characterReferences: [characterReference],
  propReferences: [propReference],
  durationSeconds: 10,
  sceneBaseline,
  productionSkillPlan: sequenceTimingSkillPlan,
});
assert(/Production annotation mode/i.test(sequenceTimingImage2Plan.prompt), "annotated sequence prompt should expose annotation mode");
assert(/Visible timing labels are allowed/i.test(sequenceTimingImage2Plan.prompt), "annotated sequence storyboard should allow visible timing labels");
assert(/tiny panel timecodes\/time ranges/i.test(sequenceTimingImage2Plan.prompt), "annotated sequence storyboard should allow tiny per-panel timecodes");
assert(!/Do not print timecodes inside the image/i.test(sequenceTimingImage2Plan.prompt), "annotated sequence storyboard should not forbid visible timing labels");

const seedancePlan = buildSeedanceStoryboardVideoPlan({
  shotId: "AN01",
  storyboardReference,
  sceneBaseline,
  characterReferences: [characterReference],
  propReferences: [propReference],
  dialogueAudio,
  dialogueTranscript: "「第一、あんた今日なんで。」",
  outputDir: "/project/video/AN01",
  prompt: "雨后学校天台黄昏，少女握着蓝色磁带盒说出台词，慢慢推进，头发和领结被潮湿微风轻轻带动。",
  directorPlan: buildStoryboardDirectorPlan({
    shotId: "AN01",
    shotTitle: "雨后天台，少女握紧磁带盒",
    durationSeconds: 5,
    camera: "中景，轻微推进，三分之二侧面",
    frameDescription: "少女站在湿润栏杆旁，双手把蓝色磁带盒贴近胸口，低头后抬眼看向镜头右侧。",
    primaryAction: "少女握紧磁带盒",
    actionTrigger: "听见广播塔的轻微电流声",
    microReaction: "她低头后抬眼看向镜头右侧",
  }),
});

assert(seedancePlan.command === "multimodal2video", "Seedance storyboard plan must use multimodal2video");
assert(seedancePlan.args[0] === "multimodal2video", "CLI command arg mismatch");
assert(seedancePlan.args.includes("--image") && seedancePlan.args.includes(storyboardReference.path), "storyboard reference image missing");
assert(seedancePlan.args.includes(sceneBaseline.path), "scene baseline image missing from Seedance plan");
assert(seedancePlan.args.includes(characterReference.path), "character reference image missing from Seedance plan");
assert(seedancePlan.args.includes(propReference.path), "prop reference image missing from Seedance plan");
assert(seedancePlan.args.includes("--audio") && seedancePlan.args.includes(dialogueAudio.path), "dialogue audio missing from Seedance plan");
assert(seedancePlan.inputs.images.map((image) => image.role).join("|") === "storyboard_reference|scene_baseline|character_identity|prop_reference", "Seedance image role order drifted");
assert(seedancePlan.inputs.images.every((image) => image.roleBinding?.role === image.role), "Seedance images must carry role bindings");
assert(seedancePlan.inputs.audio[0]?.role === "dialogue_audio", "Seedance audio role missing");
assert(seedancePlan.inputs.audio[0]?.roleBinding?.ignoreFor.includes("music or BGM instruction"), "dialogue audio binding must ignore music authority");
assert(seedancePlan.referencePolicy.inputOrder.join("|") === SEEDANCE_ALL_AROUND_REFERENCE_ORDER.join("|"), "Seedance reference order drifted");
assert(
  seedancePlan.referencePolicy.roleBindings.map((binding) => binding.role).join("|") === "storyboard_reference|scene_baseline|character_identity|prop_reference|dialogue_audio",
  "Seedance reference policy must carry all role bindings in input order",
);
assert(
  seedancePlan.referencePolicy.roleBindings.find((binding) => binding.role === "storyboard_reference")?.ignoreFor.includes("character identity"),
  "storyboard binding must explicitly ignore identity authority",
);
assert(
  seedancePlan.referencePolicy.strategyPackIds.join("|") === STORYBOARD_REFERENCE_STRATEGY_PACK_IDS.join("|"),
  "Seedance video plan must expose director strategy pack lineage",
);
assert(/role-scoped/i.test(seedancePlan.referencePolicy.referenceDimensionRule), "Seedance reference policy must lock references by role");
assert(/director's shot instruction/i.test(seedancePlan.prompt), "Seedance prompt must constrain storyboard as shot instruction");
assert(/All-around reference anti-blend rule/i.test(seedancePlan.prompt), "Seedance prompt must block all-around reference blending");
assert(/Each reference keeps its own job/i.test(seedancePlan.prompt), "Seedance prompt must keep reference duties separate");
assert(/Duration budget: 5s/i.test(seedancePlan.prompt), "Seedance prompt must carry the shot duration budget");
assert(/Director pacing: single_dominant_shot/i.test(seedancePlan.prompt), "Seedance prompt must carry structured pacing intent");
assert(/one visual focus at a time/i.test(seedancePlan.prompt), "Seedance prompt must limit visual focus");
assert(/no arrows, dotted eyeline guides, circled numbers/i.test(seedancePlan.prompt), "Seedance prompt must prevent storyboard marks from leaking into video");
assert(/no BGM, no music/i.test(seedancePlan.prompt), "Seedance prompt must block default background music");
assert(/location, weather, time of day/i.test(seedancePlan.prompt), "Seedance prompt must constrain scene role");
assert(/environment continuity/i.test(seedancePlan.referencePolicy.sceneBaselineRole), "scene baseline must remain a Seedance environment continuity reference");
assert(/have priority for face, hairstyle, outfit/i.test(seedancePlan.prompt), "Seedance prompt must make character reference win identity conflicts");
assert(/Reference priority rule: storyboard controls motion and layout/i.test(seedancePlan.prompt), "Seedance prompt must define reference priority");
assert(/Conflict resolution by dimension/i.test(seedancePlan.prompt), "Seedance prompt must resolve conflicts by locked dimension");
assert(/important object appearance/i.test(seedancePlan.prompt), "Seedance prompt must constrain prop role");
assert(/Prop reference isolation/i.test(seedancePlan.prompt), "Seedance prompt must isolate prop references from shot composition");
assert(/Never render a prop reference image as a standalone cutaway/i.test(seedancePlan.prompt), "Seedance prompt must forbid prop reference cutaways");
assert(/not storyboard panels, scene frames, camera cues, or separate video shots/i.test(seedancePlan.prompt), "Seedance prompt must prevent prop images becoming video shots");
assert(/\[TIMING PLAN\]/i.test(seedancePlan.prompt), "Seedance prompt must carry structured timing plan");
assert(/Beat 01/i.test(seedancePlan.prompt), "Seedance timing plan must carry named timing beats");
assert(/Target visible video cuts/i.test(seedancePlan.prompt), "Seedance timing plan must state visible cut budget");
assert(/storyboard panel count.*hard visible-cut budget/i.test(seedancePlan.prompt), "Seedance prompt must make storyboard panel count the hard visible-cut budget");
assert(/Do not invent extra cuts from detail words/i.test(seedancePlan.prompt), "Seedance prompt must prevent support details from becoming extra cuts");
assert(/Details such as feet, puddles, hands, props, eyelines, and reactions must stay inside their assigned beat/i.test(seedancePlan.prompt), "Seedance timing plan must keep details inside assigned beats");
assert(/Use this written timing plan as the timing authority/i.test(seedancePlan.prompt), "Seedance timing plan must prioritize written timing over visible image labels");
assert(/panel time labels.*production timing notes/i.test(seedancePlan.prompt), "Seedance timing plan must treat visible time labels as non-rendered production notes");
assert(/Follow the storyboard shot by shot internally/i.test(seedancePlan.prompt), "Seedance prompt must follow storyboard order internally");
assert(/RED=camera\/lens\/framing\/camera move/i.test(seedancePlan.prompt), "Seedance prompt must interpret red annotation internally");
assert(/GREEN=prop\/cloth\/environment\/motion-system path/i.test(seedancePlan.prompt), "Seedance prompt must interpret green annotation internally");
assert(/Never render storyboard artifacts/i.test(seedancePlan.prompt), "Seedance prompt must strip visible storyboard artifacts");
assert(/dialogue timing and performance/i.test(seedancePlan.prompt), "Seedance prompt must constrain audio role");
assert(/Reference use\/ignore bindings/i.test(seedancePlan.prompt), "Seedance prompt must carry use-ignore reference bindings");
assert(
  STORYBOARD_REFERENCE_ROLE_BINDINGS.storyboard_reference.conflictRule.includes("motion and layout"),
  "storyboard default binding must stay focused on motion/layout",
);
assert(/No subtitles|no subtitles/i.test(seedancePlan.prompt), "Seedance prompt must block subtitles");
assert(seedancePlan.queuePolicy.maxConcurrentVideoJobs === 1, "Jimeng/Seedance should stay single-lane by default");
assert(
  seedancePlan.referencePolicy.userFacingSummary.includes("分镜图控制构图和动作"),
  "user-facing policy must explain reference roles in video generation",
);

const vipSeedancePlan = buildSeedanceStoryboardVideoPlan({
  shotId: "AN01",
  storyboardReference,
  sceneBaseline,
  outputDir: "/project/video/AN01",
  prompt: "雨后学校天台，少女回头。",
  modelVersion: JIMENG_CLI_VIP_MODEL_VERSION,
});
assert(vipSeedancePlan.modelVersion === JIMENG_CLI_VIP_MODEL_VERSION, "Seedance plan should allow VIP model selection");
assert(vipSeedancePlan.videoResolution === "720p", "Seedance VIP plan must default to 720p");
assert(vipSeedancePlan.args.includes("--model_version") && vipSeedancePlan.args.includes(JIMENG_CLI_VIP_MODEL_VERSION), "Seedance VIP model arg missing");
assert(vipSeedancePlan.args.includes("--video_resolution") && vipSeedancePlan.args.includes("720p"), "Seedance VIP plan should not silently use 1080p");

const standard1080Plan = buildSeedanceStoryboardVideoPlan({
  shotId: "AN01",
  storyboardReference,
  sceneBaseline,
  outputDir: "/project/video/AN01",
  prompt: "雨后学校天台，少女回头。",
  videoResolution: JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION,
});
assert(standard1080Plan.videoResolution === "720p", "standard Seedance plan must normalize unsupported 1080p to 720p");

const quietDirectorPlan = buildStoryboardDirectorPlan({
  shotId: "QD01",
  shotTitle: "安静对白",
  durationSeconds: 8,
  camera: "固定中近景，轻微呼吸感",
  frameDescription: "两个人在走廊尽头安静对话，停顿后交换眼神。",
  primaryAction: "角色说完一句话后等待对方反应",
  microReaction: "对方轻轻垂眼，没有立刻回答",
  rhythmPlan: {
    rhythmProfile: "quiet_dialogue",
    rhythmReason: "靠台词、停顿和视线推进。",
    actionDensity: "low",
    splitPolicy: "hold_single_shot",
    userFacingLabel: "安静对白",
  },
});
const actionDirectorPlan = buildStoryboardDirectorPlan({
  shotId: "AC01",
  shotTitle: "快切动作",
  durationSeconds: 8,
  camera: "手持横移，快速切点",
  frameDescription: "角色冲过门口，转身抓住掉落的包，再看向追来的人。",
  primaryAction: "角色冲刺、转身、抓住包",
  actionTrigger: "门被猛地推开",
  microReaction: "角色回头确认追兵位置",
  rhythmPlan: {
    rhythmProfile: "action_fast_cut",
    rhythmReason: "动作密度偏高，需要拆成短促动作点。",
    actionDensity: "high",
    splitPolicy: "split_for_action",
    userFacingLabel: "快切动作",
  },
});
const suspenseDirectorPlan = buildStoryboardDirectorPlan({
  shotId: "SP01",
  shotTitle: "悬疑压迫",
  durationSeconds: 10,
  camera: "低机位跟拍，门框遮挡",
  frameDescription: "角色经过昏暗走廊，墙角阴影里传来脚步声。",
  primaryAction: "角色放慢脚步靠近门缝",
  microReaction: "角色屏住呼吸，视线被门框挡住",
  rhythmPlan: {
    rhythmProfile: "suspense_pressure",
    rhythmReason: "信息需要慢慢压近，用遮挡和推进制造压力。",
    actionDensity: "medium",
    splitPolicy: "split_for_reaction",
    userFacingLabel: "悬疑压迫",
  },
});
const commercialDirectorPlan = buildStoryboardDirectorPlan({
  shotId: "CM01",
  shotTitle: "商业短促",
  durationSeconds: 6,
  camera: "干净近景，产品第一眼可读",
  frameDescription: "手拿起小型录音笔，按下开关，指示灯亮起。",
  primaryAction: "手指按下录音笔开关",
  rhythmPlan: {
    rhythmProfile: "commercial_short",
    rhythmReason: "卖点要第一眼清楚，动作直接。",
    actionDensity: "medium",
    splitPolicy: "hold_single_shot",
    userFacingLabel: "广告短促",
  },
});

const quietImage2Plan = buildImage2StoryboardReferencePlan({
  shotId: "QD01",
  shotTitle: "安静对白",
  camera: "固定中近景，轻微呼吸感",
  shotDescription: "两个人在走廊尽头安静对话，停顿后交换眼神。",
  directorPlan: quietDirectorPlan,
  sceneBaseline,
});
const actionImage2Plan = buildImage2StoryboardReferencePlan({
  shotId: "AC01",
  shotTitle: "快切动作",
  camera: "手持横移，快速切点",
  shotDescription: "角色冲过门口，转身抓住掉落的包，再看向追来的人。",
  directorPlan: actionDirectorPlan,
  sceneBaseline,
});
const shortProductionSkillPlan = buildDirectorProductionSkillPlan({
  shotId: "AC01",
  shotText: "角色冲过门口，转身抓住掉落的包，再看向追来的人。",
  executionMode: "planned_cut_sequence",
  durationSeconds: 8,
  actionBeats: ["冲过门口", "转身", "抓住包", "看向追来的人"],
  assetState: { scene: "locked", characters: "locked", props: "locked" },
});
const actionImage2WithSkillPlan = buildImage2StoryboardReferencePlan({
  shotId: "AC01",
  shotTitle: "快切动作",
  camera: "手持横移，快速切点",
  shotDescription: "角色冲过门口，转身抓住掉落的包，再看向追来的人。",
  directorPlan: actionDirectorPlan,
  productionSkillPlan: shortProductionSkillPlan,
  sceneBaseline,
});
assert(quietImage2Plan.prompt !== actionImage2Plan.prompt, "Image2 prompts must differ across rhythm profiles");
assert(/Quiet dialogue storyboard grammar/i.test(quietImage2Plan.prompt), "quiet dialogue Image2 prompt must carry quiet dialogue grammar");
assert(/one held two-person or over-shoulder main panel/i.test(quietImage2Plan.prompt), "quiet dialogue Image2 prompt must prefer a held relationship panel");
assert(/Avoid action-comic speed lines/i.test(quietImage2Plan.prompt), "quiet dialogue Image2 prompt must block action grammar");
assert(/Action fast-cut storyboard grammar/i.test(actionImage2Plan.prompt), "action Image2 prompt must carry fast-cut grammar");
assert(/short cut-point panels/i.test(actionImage2Plan.prompt), "action Image2 prompt must allow explicit short cut points");
assert(/do not draw arrows, dotted eyeline guides/i.test(actionImage2Plan.prompt), "action Image2 prompt must keep cut guidance provider-safe");
assert(/Storyboard layout: use about 3 readable rough panels/i.test(actionImage2WithSkillPlan.prompt), "8s Image2 rough storyboard must cap readable panels to the Seedance duration budget");
assert(!/Storyboard layout: use about 8 readable rough panels/i.test(actionImage2WithSkillPlan.prompt), "8s Image2 rough storyboard must not request old 8-panel layouts");

const actionSeedancePlan = buildSeedanceStoryboardVideoPlan({
  shotId: "AC01",
  storyboardReference,
  sceneBaseline,
  outputDir: "/project/video/AC01",
  prompt: "角色冲过门口，转身抓住掉落的包，再看向追来的人。",
  directorPlan: actionDirectorPlan,
});
const suspenseSeedancePlan = buildSeedanceStoryboardVideoPlan({
  shotId: "SP01",
  storyboardReference,
  sceneBaseline,
  outputDir: "/project/video/SP01",
  prompt: "角色经过昏暗走廊，墙角阴影里传来脚步声。",
  directorPlan: suspenseDirectorPlan,
});
const commercialSeedancePlan = buildSeedanceStoryboardVideoPlan({
  shotId: "CM01",
  storyboardReference,
  sceneBaseline,
  outputDir: "/project/video/CM01",
  prompt: "手拿起小型录音笔，按下开关，指示灯亮起。",
  directorPlan: commercialDirectorPlan,
});
assert(actionSeedancePlan.prompt !== suspenseSeedancePlan.prompt, "Seedance prompts must differ across rhythm profiles");
assert(/Action fast-cut rhythm/i.test(actionSeedancePlan.prompt), "action Seedance prompt must carry fast-cut rhythm");
assert(/short in-clip cuts are allowed/i.test(actionSeedancePlan.prompt), "action Seedance prompt must allow short in-clip cuts");
assert(actionSeedancePlan.directorStrategy.warnings.some((warning) => warning.includes("split_into_micro_shots")), "action Seedance plan must expose split_into_micro_shots warning");
assert(!actionSeedancePlan.args.some((arg) => arg.includes("split_into_micro_shots")), "split warnings must not become CLI args");
assert(/Suspense rhythm/i.test(suspenseSeedancePlan.prompt), "suspense Seedance prompt must carry suspense rhythm");
assert(/occlusion, delayed following movement/i.test(suspenseSeedancePlan.prompt), "suspense Seedance prompt must emphasize occlusion and delayed following");
assert(/without BGM/i.test(suspenseSeedancePlan.prompt), "suspense Seedance prompt must preserve no-BGM sound strategy");
assert(suspenseSeedancePlan.directorStrategy.warnings.some((warning) => warning.includes("allow_in_clip_cuts")), "suspense reaction split should expose allow_in_clip_cuts warning");
assert(/Commercial short rhythm/i.test(commercialSeedancePlan.prompt), "commercial Seedance prompt must carry commercial short rhythm");
assert(/wordless: no on-screen text, no slogans, no subtitles, no BGM/i.test(commercialSeedancePlan.prompt), "commercial Seedance prompt must keep information wordless and no-BGM");

const rhythmCoverage = [
  ["quiet_dialogue", "Quiet dialogue storyboard grammar", "Quiet dialogue rhythm", "hold_single_shot"],
  ["anime_emotion", "Anime emotion storyboard grammar", "Anime emotion rhythm", "split_for_reaction"],
  ["action_fast_cut", "Action fast-cut storyboard grammar", "Action fast-cut rhythm", "split_for_action"],
  ["comedy_reaction", "Comedy reaction storyboard grammar", "Comedy rhythm", "split_for_reaction"],
  ["suspense_pressure", "Suspense pressure storyboard grammar", "Suspense rhythm", "split_for_reaction"],
  ["commercial_short", "Commercial short storyboard grammar", "Commercial short rhythm", "hold_single_shot"],
  ["emotion_montage", "Emotion montage storyboard grammar", "Emotion montage rhythm", "montage_sequence"],
  ["lyrical_observation", "Lyrical observation storyboard grammar", "Lyrical observation rhythm", "hold_single_shot"],
] as const;
const image2RhythmPrompts = new Set<string>();
const seedanceRhythmPrompts = new Set<string>();
for (const [rhythmProfile, image2Needle, seedanceNeedle, splitPolicy] of rhythmCoverage) {
  const plan = buildStoryboardDirectorPlan({
    shotId: `RHY-${rhythmProfile}`,
    shotTitle: `Rhythm coverage ${rhythmProfile}`,
    durationSeconds: 8,
    camera: "coverage camera",
    frameDescription: `Coverage shot for ${rhythmProfile}.`,
    primaryAction: `Primary action for ${rhythmProfile}.`,
    rhythmPlan: {
      rhythmProfile,
      rhythmReason: `coverage reason for ${rhythmProfile}`,
      actionDensity: splitPolicy === "split_for_action" ? "high" : "medium",
      splitPolicy,
      userFacingLabel: rhythmProfile,
    },
  });
  const imagePlan = buildImage2StoryboardReferencePlan({
    shotId: `RHY-${rhythmProfile}`,
    shotTitle: `Rhythm coverage ${rhythmProfile}`,
    camera: "coverage camera",
    shotDescription: `Coverage shot for ${rhythmProfile}.`,
    directorPlan: plan,
    sceneBaseline,
  });
  const videoPlan = buildSeedanceStoryboardVideoPlan({
    shotId: `RHY-${rhythmProfile}`,
    storyboardReference,
    sceneBaseline,
    outputDir: `/project/video/RHY-${rhythmProfile}`,
    prompt: `Coverage shot for ${rhythmProfile}.`,
    directorPlan: plan,
  });
  assert(imagePlan.prompt.includes(image2Needle), `${rhythmProfile} Image2 prompt must include rhythm-specific storyboard grammar`);
  assert(videoPlan.prompt.includes(seedanceNeedle), `${rhythmProfile} Seedance prompt must include rhythm-specific motion strategy`);
  assert(videoPlan.directorStrategy.rhythmProfile === rhythmProfile, `${rhythmProfile} Seedance plan must expose rhythm profile`);
  assert(videoPlan.directorStrategy.splitPolicy === splitPolicy, `${rhythmProfile} Seedance plan must expose split policy`);
  image2RhythmPrompts.add(imagePlan.prompt);
  seedanceRhythmPrompts.add(videoPlan.prompt);
}
assert(image2RhythmPrompts.size === rhythmCoverage.length, "all Image2 rhythm prompts should be distinct");
assert(seedanceRhythmPrompts.size === rhythmCoverage.length, "all Seedance rhythm prompts should be distinct");

console.log(
  `storyboard-reference-pipeline-test: image2Refs=${image2Plan.references.length}, seedanceImages=${seedancePlan.inputs.images.length}, seedanceAudio=${seedancePlan.inputs.audio.length}.`,
);
