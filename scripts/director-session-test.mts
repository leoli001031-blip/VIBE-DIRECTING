import {
  buildDirectorSessionFromIntake,
  extractTimecodedStoryboardBeats,
  splitScriptIntoStoryboardBeats,
  validateDirectorSessionState,
} from "../src/core/directorSession.ts";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const draft = buildProjectIntakeDraft({
  createdAt: "2026-05-18T00:00:00.000Z",
  scriptText: "雨夜里，摄影师带着一台旧相机回到童年住过的楼下。",
  styleNote: "低饱和、克制、潮湿的街灯反光。",
  referenceAssets: [
    { id: "char_lead", type: "character", label: "主角参考图", note: "2.4 MB" },
    { id: "scene_rain", type: "scene", label: "雨夜街角", note: "1.8 MB" },
    { id: "style_still", type: "style", label: "静态摄影风格" },
    { id: "voice_narrator", type: "audio", label: "旁白音色样本", note: "780 KB" },
  ],
});
const projection = buildIntakeStagedPlanProjection(draft);
const session = buildDirectorSessionFromIntake({
  draft,
  projection,
  projectId: "rain_camera",
});
const validation = validateDirectorSessionState(session);

assert(validation.ok, `director session should validate: ${validation.errors.join("; ")}`);
assert(session.currentStage === "reference_binding", "complete intake should move to reference binding");
assert(session.workspace.visualReferenceCount === 3, "visual references should stay visible in workspace");
assert(session.workspace.audioReferenceCount === 1, "audio reference should be tracked separately");
assert(session.hardLocks.rawTextIsConversationOnly === true, "raw text must be conversation-only");
assert(session.hardLocks.projectFactWriteAllowed === false, "session must not write project facts directly");
assert(session.hardLocks.formalTaskCreationAllowed === false, "session must not create formal tasks directly");
assert(session.hardLocks.providerSubmitAllowed === false, "session must not submit providers directly");
assert(session.hardLocks.remoteGenerationAllowed === false, "session must not start remote generation directly");
assert(
  session.turns.every((turn) => turn.rawTextMayBecomeProjectFact === false),
  "conversation turns must never become project facts directly",
);
assert(
  session.stagedFacts.every((fact) => fact.needsUserConfirmation && fact.canWriteProjectFactNow === false),
  "staged facts must require confirmation",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "script_brief"),
  "script brief staged fact missing",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label.includes("摄影师")),
  "script character candidate staged fact missing",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.sourceAssetIds.includes("char_lead")),
  "character reference should become a candidate staged fact",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "scene_candidate" && fact.sourceAssetIds.includes("scene_rain")),
  "scene reference should become a scene candidate staged fact",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "prop_candidate" && fact.label === "旧相机"),
  "script prop candidate staged fact missing",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "audio_need" && fact.sourceAssetIds.includes("voice_narrator")),
  "audio file should become an audio need staged fact",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "shot_draft"),
  "shot draft staged fact missing",
);
assert(
  session.stagedFacts.some((fact) => fact.kind === "reference_binding" && fact.sourceAssetIds.includes("char_lead")),
  "reference binding staged fact missing",
);

const cinemaBeats = splitScriptIntoStoryboardBeats(
  "凌晨三点，外卖骑手阿森接到一单热可可，地址是一座已经停业十年的老电影院。收件人只写着放映室。阿森进入影院后，看见银幕自己亮起，播放妹妹失踪前的影像。随后老放映机卡住，雨声像呼救。他必须在天亮前找到最后一卷胶片，最后按下播放键，银幕后的安全门打开。",
);
assert(cinemaBeats.length >= 6, `storyboard beats should preserve the full plot tail: ${cinemaBeats.join(" | ")}`);
assert(
  cinemaBeats.some((beat) => beat.includes("最后一卷胶片")),
  "storyboard beat splitting must not treat “最后一卷胶片” as a transition word",
);
assert(
  cinemaBeats.some((beat) => beat.includes("按下播放键")) && cinemaBeats.some((beat) => beat.includes("安全门打开")),
  "storyboard beat splitting should keep the final playback and door beat",
);

const casualSegmentBeats = splitScriptIntoStoryboardBeats(
  "做一个 12 秒 90 年代日漫风短片。夜晚的自动售货机旁，一个戴耳机的女生捡到一枚会发光的旧游戏币。第一段是安静发现，第二段是游戏币亮起，第三段是她抬头看见街角出现一台旧街机。需要 Agent 自己判断镜头节奏和参考模式。",
);
assert(
  casualSegmentBeats.length === 3,
  `inline 第一段/第二段/第三段 should become exactly 3 story beats, got ${casualSegmentBeats.length}: ${casualSegmentBeats.join(" | ")}`,
);
assert(casualSegmentBeats[0] === "安静发现", "first inline segment should strip marker text");
assert(casualSegmentBeats[1] === "游戏币亮起", "second inline segment should strip marker text");
assert(
  casualSegmentBeats[2] === "她抬头看见街角出现一台旧街机",
  "inline segment parser should strip trailing Agent planning instructions",
);
assert(
  casualSegmentBeats.every((beat) => !/Agent|需要|日漫风|12 秒/u.test(beat)),
  "inline segment parser should not turn meta requirements into storyboard beats",
);

const raceScript = `[Intro]
[Classic Synth Brass Riff]
Five...
Four...
Three...
Two...
One...
GO

0:00 - 0:04
山脚便利店，SU7 Ultra 点灯
深夜便利店停车场。
Xiaomi SU7 Ultra 停在画面中央。

0:04 - 0:08
女车手睁眼
车内特写。
女生闭眼深呼吸，睁开眼。

0:20 - 0:28
倒计时开始：5 / 4 / 3 / 2 / 1 / GO
配乐进入倒计时。
Five：SU7 Ultra 前脸。
Four：GT3 轮胎压线。`;
const timecodedRaceBeats = extractTimecodedStoryboardBeats(raceScript);
assert(timecodedRaceBeats.length === 3, `timecoded script should produce 3 beats, got ${timecodedRaceBeats.length}`);
assert(timecodedRaceBeats[0]?.title === "山脚便利店，SU7 Ultra 点灯", "first timecoded title should become the shot title");
assert(timecodedRaceBeats[0]?.durationSeconds === 4, "first timecoded duration should be 4 seconds");
assert(timecodedRaceBeats[2]?.durationSeconds === 8, "long timecoded segment should preserve its script duration");
const raceBeats = splitScriptIntoStoryboardBeats(raceScript);
assert(raceBeats[0]?.includes("山脚便利店"), "timecoded script splitting must prioritize the real shot plan over intro lyrics");
assert(!raceBeats[0]?.includes("[Intro]"), "intro lyrics must not become the first storyboard beat when timecodes exist");
assert(raceBeats.some((beat) => beat.includes("GT3 轮胎压线")), "timecoded block body should keep action sub-beats");

const catCinemaDraft = buildProjectIntakeDraft({
  createdAt: "2026-05-18T00:00:00.000Z",
  scriptText: "深夜自动售货机旁，一只黑猫叼着一张湿掉的电影票，带一个穿雨衣的少女走进空无一人的旧电影院。",
});
const catCinemaSession = buildDirectorSessionFromIntake({
  draft: catCinemaDraft,
  projection: buildIntakeStagedPlanProjection(catCinemaDraft),
  projectId: "cat_cinema",
});
assert(
  catCinemaSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label === "黑猫"),
  "animal performers should become character candidates instead of disappearing from planning",
);
assert(
  catCinemaSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label.includes("少女")),
  "unnamed human performers should still become character candidates",
);
assert(
  !catCinemaSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label.includes("带一个")),
  "character candidates should drop leading action words such as 带一个",
);
assert(
  !catCinemaSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label.includes("引少女")),
  "character candidates should not preserve action-prefixed labels such as 引少女",
);
assert(
  !catCinemaSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label === "猫"),
  "generic animal labels should not duplicate a more specific animal performer",
);
assert(
  catCinemaSession.stagedFacts.some((fact) => fact.kind === "prop_candidate" && fact.label === "电影票"),
  "ticket-like story objects should become prop candidates",
);
assert(
  catCinemaSession.stagedFacts.some((fact) => fact.kind === "scene_candidate" && fact.label === "老电影院"),
  "cinema locations should remain scene candidates",
);

const actionPrefixedCharacterDraft = buildProjectIntakeDraft({
  createdAt: "2026-05-18T00:00:00.000Z",
  scriptText: "雨夜旧电影院门口，黑猫叼电影票，引少女走进亮灯放映厅。",
});
const actionPrefixedCharacterSession = buildDirectorSessionFromIntake({
  draft: actionPrefixedCharacterDraft,
  projection: buildIntakeStagedPlanProjection(actionPrefixedCharacterDraft),
  projectId: "action_prefixed_character",
});
assert(
  actionPrefixedCharacterSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label === "少女"),
  "action-prefixed human labels should normalize to the underlying character subject",
);
assert(
  !actionPrefixedCharacterSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label === "引少女"),
  "action-prefixed human labels should not become standalone character candidates",
);

const sparseDraft = buildProjectIntakeDraft({
  createdAt: "2026-05-18T00:00:00.000Z",
  scriptText: "",
});
const sparseProjection = buildIntakeStagedPlanProjection(sparseDraft);
const sparseSession = buildDirectorSessionFromIntake({
  draft: sparseDraft,
  projection: sparseProjection,
});

assert(sparseSession.currentStage === "script_intake", "empty intake should stay in script intake");
assert(sparseSession.workspace.nextActionLabel === "补充脚本", "empty intake should ask for script");
assert(
  validateDirectorSessionState(sparseSession).warnings.includes("Session has no staged facts yet."),
  "sparse session should warn when no staged facts exist",
);

const serialized = JSON.stringify([session, sparseSession]);
const forbiddenPatterns = [
  /\bproviderId\b/,
  /\bapi[-_\s]?key\b/i,
  /\bsubmit[-_\s]?live\b/i,
  /\bGenerationJob\b/,
  /\btoolCalls\b/,
  /\bTaskEnvelope\b/,
];
for (const pattern of forbiddenPatterns) {
  assert(!pattern.test(serialized), `director session must not expose execution/provider semantics: ${pattern}`);
}

console.log(
  `Director session tests passed: stage=${session.currentStage}, stagedFacts=${session.stagedFacts.length}, visualRefs=${session.workspace.visualReferenceCount}.`,
);
