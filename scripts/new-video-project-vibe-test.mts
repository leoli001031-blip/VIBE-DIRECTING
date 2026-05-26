import {
  buildNewVideoProjectVibeStagedTransaction,
  commitNewVideoProjectVibeStagedTransaction,
  planNewVideoDraftIntoProjectVibe,
} from "../src/core/newVideoProjectVibePlanner.ts";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";
import { buildDirectorSessionFromIntake } from "../src/core/directorSession.ts";
import type { StoryDiscussionDelta } from "../src/core/storyDiscussionWorkspace.ts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  validateProjectVibe,
  type ProjectVibeDocument,
} from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-18T08:00:00.000Z";

function createProject(): ProjectVibeDocument {
  return createProjectVibe({
    projectId: "new_video_project_vibe",
    title: "New Video Project.vibe",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    storyFlow: {
      id: "story_flow_current",
      sections: [{
        id: "old_section",
        title: "Old Story",
        summary: "Old story should be replaced by the confirmed new-video draft.",
        sequenceIndex: 0,
        shotIds: ["old_shot"],
      }],
      shotOrder: ["old_shot"],
    },
    shots: [{
      id: "old_shot",
      sectionId: "old_section",
      title: "Old Shot",
      intent: "This should not survive a new-video confirmation.",
      sceneAssetIds: [],
      characterAssetIds: ["asset_hero"],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: ["fixture:old_story"],
    }],
    assets: [{
      id: "asset_hero",
      kind: "character",
      label: "Locked Hero",
      status: "locked",
      path: "assets/locked/hero.md",
      textConstraints: ["red jacket", "short black hair"],
      usedByShotIds: ["old_shot"],
      sourceRefs: ["fixture:locked_hero"],
      lockedBy: "user",
    }],
    visualMemory: {
      id: "visual_memory_current",
      entries: [{
        id: "memory_hero",
        assetId: "asset_hero",
        kind: "character",
        label: "Locked Hero",
        status: "locked",
        textConstraints: ["red jacket", "short black hair"],
        usedByShotIds: ["old_shot"],
        canUseAsFutureReference: true,
        sourceRefs: ["fixture:locked_hero"],
      }],
    },
  });
}

const richDraft = {
  script: "一位年轻摄影师在雨夜发现一台旧相机。她想循着相机里的最后一张照片来到空荡的天桥，但暴雨和即将拆除的旧站台让她无法停留。她遇见多年未见的父亲。最后她没有追回过去，而是拍下清晨第一班车，决定继续生活。",
  style: "克制、电影感、低饱和、雨夜霓虹反光",
  references: [
    { type: "image", file: { name: "secret-hero-reference.png" }, label: "主角参考", binding: { role: "年轻摄影师", scope: "first_shot" } },
    { type: "image", file: { name: "secret-station-reference.png" }, label: "旧站台参考", binding: { scene: "旧站台", shotIds: ["2"] } },
    { type: "style", file: { name: "secret-style-board.jpg" }, label: "风格参考", binding: { style: "雨夜霓虹反光", scope: "project" } },
  ],
  audio: { name: "secret-voice-source.wav" },
};

const musicDraft = {
  ...richDraft,
  audio: { name: "secret-music-source.wav", type: "audio/wav", size: 12000 },
  audioRole: "music_reference" as const,
  musicAnalysis: {
    schemaVersion: "0.1.0" as const,
    analysisId: "music_analysis_project_test",
    source: { label: "配乐参考", safeRef: "music_reference:project_test" },
    durationSeconds: 20,
    sampleRate: 8000,
    windowSeconds: 1,
    energyCurve: [],
    sections: [],
    recommendedCutPoints: [0, 5, 10, 15, 20],
    rhythmTags: ["sectioned_music"],
    warnings: [],
    projectRelativeAnalysisPath: "audio/music-analysis/music_analysis_project_test.json",
    noRawPathStored: true as const,
    videoProviderPolicy: {
      noBgmForVideoProvider: true as const,
      usedFor: ["rhythm_planning" as const, "final_export_bgm" as const],
    },
  },
};

const legacyUnboundDraft = {
  ...richDraft,
  references: [
    { type: "character", file: { name: "secret-legacy-hero-reference.png" }, label: "主角参考" },
    { type: "style", file: { name: "secret-legacy-style-board.jpg" }, label: "风格参考" },
  ],
};

const intakeDraft = buildProjectIntakeDraft({
  createdAt: generatedAt,
  scriptText: richDraft.script,
  styleNote: richDraft.style,
  referenceAssets: [
    { id: "upload_character_1", type: "image", label: "上传图 A", uri: "local-file://secret-character.png", binding: { role: "年轻摄影师", shotIds: ["1"] } },
    { id: "upload_scene_1", type: "image", label: "上传图 B", uri: "local-file://secret-scene.png", binding: { scene: "旧站台", scope: "first_shot" } },
  ],
});
const intakeProjection = buildIntakeStagedPlanProjection(intakeDraft);
const intakeSession = buildDirectorSessionFromIntake({
  draft: intakeDraft,
  projection: intakeProjection,
  projectId: "new_video_project_vibe",
  createdAt: generatedAt,
});
assert(
  intakeProjection.referenceBindings.some((binding) => binding.bindingLabel.includes("角色：年轻摄影师") && binding.scopeLabel.includes("1")),
  "intake projection should expose which role/shot an uploaded image belongs to",
);
assert(
  intakeSession.stagedFacts.some((fact) => fact.kind === "reference_binding" && fact.label.includes("角色：年轻摄影师") && fact.label.includes("镜头 1")),
  "director session should make uploaded-image binding visible before Project.vibe confirmation",
);
assert(
  intakeSession.stagedFacts.every((fact) => fact.canWriteProjectFactNow === false),
  "visible reference bindings must remain staged before Project.vibe confirmation",
);

const smallCinemaStoryDraft = {
  script: "凌晨三点，外卖骑手阿森接到一单热可可，地址是一座已经停业十年的老电影院。收件人栏只写着放映室。他进去后发现银幕自己亮起，播放的却是妹妹小时候失踪前的影像。一台老放映机不断卡住，门外的雨声越来越像妹妹的呼救。阿森必须在天亮前找到最后一卷胶片并修好放映机，否则影像会永远烧毁。结尾他按下播放键，银幕后的安全门打开，妹妹的声音从里面传来。",
  style: "冷静悬疑、旧影院、雨夜、低饱和钨丝灯、轻微颗粒感",
};
const smallCinemaIntakeDraft = buildProjectIntakeDraft({
  createdAt: generatedAt,
  scriptText: smallCinemaStoryDraft.script,
  styleNote: smallCinemaStoryDraft.style,
});
const smallCinemaIntakeProjection = buildIntakeStagedPlanProjection(smallCinemaIntakeDraft);
const smallCinemaSession = buildDirectorSessionFromIntake({
  draft: smallCinemaIntakeDraft,
  projection: smallCinemaIntakeProjection,
  projectId: "new_video_project_vibe",
  createdAt: generatedAt,
});
assert(
  smallCinemaSession.stagedFacts.some((fact) => fact.kind === "character_candidate" && fact.label.includes("骑手")),
  "small cinema story should infer the delivery rider as a character candidate",
);
assert(
  smallCinemaSession.stagedFacts.some((fact) => fact.kind === "scene_candidate" && fact.label === "老电影院"),
  "small cinema story should infer the old cinema as a scene candidate",
);
assert(
  smallCinemaSession.stagedFacts.some((fact) => fact.kind === "prop_candidate" && fact.label === "老放映机"),
  "small cinema story should infer the projector as a prop candidate",
);
const smallCinemaStaged = buildNewVideoProjectVibeStagedTransaction({
  project: createProject(),
  draft: smallCinemaStoryDraft,
  directorSession: smallCinemaSession,
  generatedAt,
});
assert(smallCinemaStaged.blocked === false, `small cinema story should confirm without extra manual fields: ${smallCinemaStaged.blockedReasons.join("; ")}`);

const confirmedDiscussionDeltas: StoryDiscussionDelta[] = [
  {
    id: "discussion_delta_character_multiview",
    kind: "character_multiview_request",
    laneId: "characters",
    label: "主角多视角",
    summary: "用户反馈：「主角需要先做多视角，第三个镜头节奏慢一点，最后再加一个清晨空镜。」角色需要多视角准备。",
    status: "confirmed",
    createdAt: generatedAt,
    confirmedAt: generatedAt,
    sourceTurnId: "discussion_turn_character",
    sourceRefs: ["discussion_turn_character"],
    sourceFactIds: ["fact_character_candidate"],
    targetItemIds: ["characters_fact_character_candidate"],
    needsUserConfirmation: true,
    canWriteProjectFactNow: false,
  },
  {
    id: "discussion_delta_storyboard_timing",
    kind: "storyboard_timing_adjustment",
    laneId: "storyboard",
    label: "分镜节奏调整",
    summary: "用户反馈：「主角需要先做多视角，第三个镜头节奏慢一点，最后再加一个清晨空镜。」第三个镜头节奏慢一点。",
    status: "confirmed",
    createdAt: generatedAt,
    confirmedAt: generatedAt,
    sourceTurnId: "discussion_turn_storyboard",
    sourceRefs: ["discussion_turn_storyboard"],
    sourceFactIds: ["fact_shot_draft"],
    targetItemIds: ["storyboard_fact_shot_draft"],
    needsUserConfirmation: true,
    canWriteProjectFactNow: false,
  },
  {
    id: "discussion_delta_storyboard_add_morning",
    kind: "storyboard_add_remove",
    laneId: "storyboard",
    label: "分镜增删",
    summary: "用户反馈：「主角需要先做多视角，第三个镜头节奏慢一点，最后再加一个清晨空镜。」最后再加一个清晨空镜。",
    status: "confirmed",
    createdAt: generatedAt,
    confirmedAt: generatedAt,
    sourceTurnId: "discussion_turn_storyboard",
    sourceRefs: ["discussion_turn_storyboard"],
    sourceFactIds: ["fact_shot_draft"],
    targetItemIds: ["storyboard_fact_shot_draft"],
    needsUserConfirmation: true,
    canWriteProjectFactNow: false,
  },
];

const project = createProject();
const beforeHash = hashProjectVibeFacts(project);
const staged = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: richDraft,
  generatedAt,
});

assert(staged.kind === "new_video_project_vibe_staged_transaction_preview", "staged result should identify the preview contract");
assert(staged.projectVibeWriteAllowed === false, "staged preview must explicitly keep Project.vibe writes locked");
assert(staged.projectFactsMutated === false, "staged preview must not claim project facts were mutated");
assert(!("project" in staged), "staged preview must not return a next Project.vibe document");
assert(staged.blocked === false, `rich draft should be ready for confirmation: ${staged.blockedReasons.join("; ")}`);
assert(staged.source.beforeFactHash === beforeHash, "staged preview should capture the source Project.vibe fact hash");
assert(staged.source.projectId === project.manifest.projectId, "staged preview should bind to the source project id");
assert(staged.patchOperations.length > 1, "staged preview should expose Project.vibe patch operations for review");
assert(staged.transaction.operations === staged.patchOperations, "transaction and preview operations should share the same reviewed operation list");
assert(staged.summary.shotCount === staged.planner.shots.length, "summary shot count should mirror planner shots");
assert(staged.summary.referenceAssetCount === 3, "staged preview should count user-provided visual references as candidate assets");
assert(staged.summary.audioReferenceCount === 1, "staged preview should count user-provided audio reference without storing its file name");
assert(staged.summary.musicReferenceCount === 0, "voice references should not be counted as music references");
assert(staged.patchOperations.some((operation) => operation.op === "upsert_asset"), "staged preview should upsert candidate reference assets");
assert(staged.patchOperations.some((operation) => operation.op === "set_visual_memory"), "staged preview should project references into visual memory");
const stagedReferenceAssets = staged.patchOperations
  .filter((operation) => operation.op === "upsert_asset")
  .map((operation) => operation.asset)
  .filter((asset) => asset.sourceRefs.some((ref) => ref.startsWith("new_video_reference:")));
const stagedCharacterReference = stagedReferenceAssets.find((asset) => asset.kind === "character");
const stagedSceneReference = stagedReferenceAssets.find((asset) => asset.kind === "scene");
const stagedStyleReference = stagedReferenceAssets.find((asset) => asset.kind === "style");
assert(stagedCharacterReference, "bound image reference should infer a character candidate");
assert(stagedSceneReference, "bound image reference should infer a scene candidate");
assert(stagedStyleReference, "style reference should stay a style candidate");
assert(stagedCharacterReference.usedByShotIds.length === 1, "character binding with first_shot scope should not bind every shot");
assert(stagedCharacterReference.usedByShotIds[0] === staged.planner.shots[0]?.id, "character binding should resolve to the first planned shot");
assert(stagedSceneReference.usedByShotIds[0] === staged.planner.shots[1]?.id, "scene binding shotIds should resolve ordinal shot ids");
assert(stagedStyleReference.usedByShotIds.length === staged.planner.shots.length, "project style scope should bind across planned shots");
assert(staged.planner.shots[0]?.characterAssetIds.includes(stagedCharacterReference.id), "first shot should carry the scoped character asset");
assert(!staged.planner.shots.slice(1).some((shot) => shot.characterAssetIds.includes(stagedCharacterReference.id)), "scoped character asset must not leak to later shots");
assert(staged.planner.shots[1]?.sceneAssetIds.includes(stagedSceneReference.id), "second shot should carry the scoped scene asset");
assert(!staged.planner.shots.filter((_, index) => index !== 1).some((shot) => shot.sceneAssetIds.includes(stagedSceneReference.id)), "scoped scene asset must not leak to other shots");
assert(staged.source.sourceRefs.includes("audio_reference:new_video_audio_reference_1"), "staged source refs should retain an audio reference evidence marker");
assert(
  staged.patchOperations.some((operation) => operation.op === "append_script_planning_receipt"),
  "audio/reference inputs should persist a script planning receipt for evidence",
);
assert(staged.stagedFactIds.some((id) => id.includes("script_brief")), "staged preview should expose staged script fact ids");
assert(hashProjectVibeFacts(project) === beforeHash, "staged preview must not mutate the input Project.vibe object");

const stagedWithMusic = buildNewVideoProjectVibeStagedTransaction({
  project: createProject(),
  draft: musicDraft,
  directorSession: intakeSession,
  generatedAt,
});
assert(stagedWithMusic.blocked === false, `music draft should stage cleanly: ${stagedWithMusic.blockedReasons.join("; ")}`);
assert(stagedWithMusic.summary.musicReferenceCount === 1, "music draft should count a staged music reference");
assert(stagedWithMusic.summary.audioReferenceCount >= 1, "music draft should still carry safe audio evidence");
assert(stagedWithMusic.source.sourceRefs.includes("music_reference:new_video_music_reference_1"), "music evidence should be part of staged source refs");
assert(stagedWithMusic.source.sourceRefs.includes("music_analysis:music_analysis_project_test"), "music analysis id should be part of staged source refs");

const storyboardTableRows = [
  {
    id: "storyboard_row_rooftop_1",
    shotNo: "1-1",
    duration: "8",
    shotSize: "全景",
    camera: "平视远景，雨后天台缓慢推进",
    visualDescription: "短发少女站在雨后天台左侧，右手握着旧磁带，远处城市被薄雾压低。",
    primaryAction: "少女抬眼看向画面右侧的天台门",
    actionTrigger: "门后传来磁带转动声",
    microReaction: "她眨眼后把磁带握紧",
    actionReactionQa: "参考策略：故事板叙事；动作从静到轻微推进；不要多动作堆叠。",
    executionMode: "single_continuous_shot",
    referenceStrategy: "storyboard_narrative",
    visibleCutBudget: "不主动切镜",
    subtitle: "-",
    sound: "雨后水滴声、远处城市低噪",
    title: "雨后台天",
    characters: "短发少女",
    scene: "学校天台",
    props: "旧磁带",
    audioUsage: "现场声",
    rhythmProfile: "anime_emotion",
    rhythmReason: "用日漫式留白先锁住空间和视线。",
    sourceFactId: "fact_storyboard_rooftop",
  },
  {
    id: "storyboard_row_handoff_2",
    shotNo: "1-2",
    duration: "4",
    shotSize: "手部特写",
    camera: "贴近手部短推，保持磁带和指尖清楚",
    visualDescription: "少年从画面右侧入手，把一张纸条压在磁带下方，少女的指尖停半拍后接住。",
    primaryAction: "少年把纸条递到少女手边",
    actionTrigger: "少女看向磁带后没有开口",
    microReaction: "少女指尖停半拍",
    actionReactionQa: "只拍递纸和接住，不切到完整对白。",
    executionMode: "action_insert",
    referenceStrategy: "omni_reference",
    visibleCutBudget: "最多 1 个反应切点",
    subtitle: "拿着。",
    sound: "纸张摩擦声",
    title: "纸条递来",
    characters: "短发少女、少年",
    scene: "学校天台",
    props: "旧磁带、纸条",
    audioUsage: "对白一句",
    rhythmProfile: "action_fast_cut",
    rhythmReason: "动作点短，适合拆成插入镜头。",
    sourceFactId: "fact_storyboard_handoff",
  },
];
const storyboardTableProject = createProject();
const stagedFromStoryboardTable = buildNewVideoProjectVibeStagedTransaction({
  project: storyboardTableProject,
  draft: {
    script: richDraft.script,
    style: richDraft.style,
    references: [],
  },
  storyboardDraft: storyboardTableRows,
  generatedAt,
});
assert(stagedFromStoryboardTable.blocked === false, `storyboard table should stage cleanly: ${stagedFromStoryboardTable.blockedReasons.join("; ")}`);
assert(stagedFromStoryboardTable.summary.shotCount === storyboardTableRows.length, "storyboard table rows should replace generated planner shots");
assert(stagedFromStoryboardTable.planner.shots[0]?.id.startsWith("shot_storyboard_1-1"), "storyboard shot ids should prefer readable shot numbers over internal AI row ids");
assert(stagedFromStoryboardTable.planner.shots[0]?.title === "雨后台天", "first storyboard row title should become the Project.vibe shot title");
assert(stagedFromStoryboardTable.planner.shots[0]?.durationSeconds === 8, "edited storyboard duration should become shot duration");
assert(stagedFromStoryboardTable.planner.shots[0]?.camera === storyboardTableRows[0].camera, "edited camera language should be preserved");
assert(stagedFromStoryboardTable.planner.shots[0]?.primaryAction === storyboardTableRows[0].primaryAction, "primary action should be promoted from the table");
assert(stagedFromStoryboardTable.planner.shots[1]?.executionMode === "action_insert", "execution mode should be promoted from the table");
assert(stagedFromStoryboardTable.planner.shots[0]?.visibleClips === 1, "narrative storyboard rows should persist one visible clip");
assert(stagedFromStoryboardTable.planner.shots[0]?.storyboardPanels === 1, "narrative storyboard rows should persist one storyboard panel");
assert(stagedFromStoryboardTable.planner.shots[1]?.visibleClips === 1, "omni rows should persist one visible clip");
assert(stagedFromStoryboardTable.planner.shots[1]?.storyboardPanels === 0, "omni rows should not create hidden storyboard panels");
assert(stagedFromStoryboardTable.planner.shots.every((shot) => shot.videoControlMode === "reference_driven"), "new video storyboard rows should no longer fall back to first-frame mode");
assert(stagedFromStoryboardTable.planner.shots[1]?.propGuidance?.includes("纸条"), "prop binding text should be preserved on the shot");
assert(
  stagedFromStoryboardTable.source.sourceRefs.some((ref) => ref.startsWith("storyboard_table:")),
  "staged source refs should keep storyboard table evidence",
);
assert(
  stagedFromStoryboardTable.patchOperations.some((operation) => operation.op === "append_script_planning_receipt"),
  "storyboard table confirmations should persist a script planning receipt",
);
const committedStoryboardTable = commitNewVideoProjectVibeStagedTransaction({
  project: storyboardTableProject,
  stagedTransaction: stagedFromStoryboardTable,
});
assert(committedStoryboardTable.status === "applied", "storyboard table staged transaction should commit");
assert(committedStoryboardTable.project.storyFlow.shotOrder.join("|") === stagedFromStoryboardTable.planner.shots.map((shot) => shot.id).join("|"), "committed story flow should use storyboard table shot order");

const sparseDraftWithAiStoryboard = buildNewVideoProjectVibeStagedTransaction({
  project: createProject(),
  draft: {
    script: "孤独与自由",
    style: "90 年代日漫",
    references: [],
  },
  storyboardDraft: storyboardTableRows,
  generatedAt,
});
assert(sparseDraftWithAiStoryboard.blocked === false, `structured AI storyboard rows should satisfy confirmation QA: ${sparseDraftWithAiStoryboard.blockedReasons.join("; ")}`);
assert(!sparseDraftWithAiStoryboard.blockedReasons.some((reason) => reason.startsWith("script_qa_")), "AI storyboard confirmation must not keep stale script QA blockers");

const stagedWithGenericSession = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: richDraft,
  directorSession: {
    sessionId: "session_generic_local_project",
    projectId: "local_project",
    turns: [{
      id: "turn_generic",
      role: "user",
      scope: "script",
      createdAt: generatedAt,
      text: richDraft.script,
      attachmentRefs: [],
      sourceRefs: ["intake:generic"],
      rawTextMayBecomeProjectFact: false,
    }],
    stagedFacts: [],
  },
  generatedAt,
});
assert(!stagedWithGenericSession.blockedReasons.includes("director_session_project_mismatch"), "generic local_project session id should not block real project confirmation");

const stagedSerialized = JSON.stringify(staged);
for (const pattern of [
  /secret/i,
  /local-file/i,
  /task[-_\s]?envelope/i,
  /api[-_\s]?key/i,
  /credential/i,
]) {
  assert(!pattern.test(stagedSerialized), `staged preview must not leak execution or local-file details: ${pattern}`);
}

const committed = commitNewVideoProjectVibeStagedTransaction({
  project,
  stagedTransaction: staged,
});
assert(committed.status === "applied", `confirmed staged transaction should apply: ${committed.blockedReasons.join("; ")}`);
assert(committed.patch.receipt.status === "applied", `patch receipt should apply: ${committed.patch.receipt.errors.join("; ")}`);
assert(committed.project.shots.length === staged.planner.shots.length, "confirmed project should receive planner shots");
assert(committed.project.storyFlow.shotOrder.length === staged.planner.shots.length, "confirmed story flow should receive planner shot order");
assert(!committed.project.shots.some((shot) => shot.id === "old_shot"), "confirmed new video should replace the old story shots");
assert(committed.project.assets.find((asset) => asset.id === "asset_hero")?.usedByShotIds.length === 0, "new-video confirmation should clear stale locked asset shot bindings");
assert(committed.project.visualMemory.entries.find((entry) => entry.id === "memory_hero")?.usedByShotIds.length === 0, "new-video confirmation should clear stale visual memory shot bindings");
const committedReferenceAssets = committed.project.assets.filter((asset) => asset.sourceRefs.some((ref) => ref.startsWith("new_video_reference:")));
assert(committedReferenceAssets.length === 3, "confirmed new video should persist candidate visual references");
assert(committedReferenceAssets.every((asset) => asset.status === "candidate" && !asset.path), "candidate visual references should not store raw local paths");
assert(committedReferenceAssets.every((asset) => !/secret|local-file/i.test(JSON.stringify(asset))), "candidate visual references should not leak local file names");
const committedCharacterReference = committedReferenceAssets.find((asset) => asset.kind === "character");
const committedSceneReference = committedReferenceAssets.find((asset) => asset.kind === "scene");
assert(committedCharacterReference, "character reference asset should be present");
assert(committedSceneReference, "scene reference asset should be present");
assert(committedCharacterReference.usedByShotIds.length === 1, "confirmed character reference should keep first-shot scope");
assert(committedCharacterReference.usedByShotIds[0] === committed.project.shots[0]?.id, "confirmed character reference should target the first shot");
assert(committed.project.shots[0]?.characterAssetIds.includes(committedCharacterReference.id), "first shot should include the confirmed character reference");
assert(!committed.project.shots.slice(1).some((shot) => shot.characterAssetIds.includes(committedCharacterReference.id)), "confirmed character reference must not bind to every shot");
assert(committedSceneReference.usedByShotIds[0] === committed.project.shots[1]?.id, "confirmed scene reference should target the requested shot");
assert(committed.project.shots[1]?.sceneAssetIds.includes(committedSceneReference.id), "requested shot should include the scene reference");
assert(!committed.project.shots.filter((_, index) => index !== 1).some((shot) => shot.sceneAssetIds.includes(committedSceneReference.id)), "confirmed scene reference must not bind to every shot");
assert(
  committed.project.visualMemory.entries
    .filter((entry) => committedReferenceAssets.some((asset) => asset.id === entry.assetId))
    .every((entry) => entry.status === "candidate" && entry.canUseAsFutureReference === false),
  "candidate reference entries should stay review-gated in visual memory",
);
assert(
  committed.project.visualMemory.entries.find((entry) => entry.assetId === committedCharacterReference.id)?.usedByShotIds.length === 1,
  "visual memory should preserve the character reference shot scope",
);
assert(validateProjectVibe(committed.project).ok, "committed Project.vibe should validate");

const stagedWithDeltas = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: richDraft,
  discussionDeltas: confirmedDiscussionDeltas,
  generatedAt,
});
assert(stagedWithDeltas.blocked === false, `confirmed deltas should not block staged preview: ${stagedWithDeltas.blockedReasons.join("; ")}`);
assert(stagedWithDeltas.summary.discussionDeltaCount === confirmedDiscussionDeltas.length, "staged preview should count confirmed discussion deltas");
assert(stagedWithDeltas.source.discussionDeltaIds.includes("discussion_delta_character_multiview"), "source should carry confirmed discussion delta ids");
assert(stagedWithDeltas.planner.shots.some((shot) => shot.title === "清晨空镜"), "confirmed add-shot delta should add a morning insert shot to the planner");
const timedShot = stagedWithDeltas.planner.shots[2];
assert(timedShot.durationSeconds > staged.planner.shots[2].durationSeconds, "confirmed timing delta should lengthen the referenced third shot");
assert(
  stagedWithDeltas.planner.shots[0]?.intent.includes("多视角"),
  "confirmed character multiview delta should affect the story draft, not only the receipt",
);
assert(
  stagedWithDeltas.patchOperations.some((operation) => operation.op === "append_script_planning_receipt"),
  "confirmed discussion deltas should add a script planning receipt operation",
);
assert(
  stagedWithDeltas.source.sourceRefs.some((ref) => ref === "discussion_delta:discussion_delta_storyboard_timing"),
  "source refs should include confirmed discussion delta refs",
);
const committedWithDeltas = commitNewVideoProjectVibeStagedTransaction({
  project,
  stagedTransaction: stagedWithDeltas,
});
assert(committedWithDeltas.status === "applied", `confirmed delta commit should apply: ${committedWithDeltas.blockedReasons.join("; ")}`);
const scriptReceipt = committedWithDeltas.project.receipts?.scriptPlanningReceipts.find((receipt) => receipt.plannerId === stagedWithDeltas.planner.plannerId);
assert(scriptReceipt, "confirmed delta commit should persist a script planning receipt");
assert(
  scriptReceipt.evidenceRefs.includes("discussion_delta:discussion_delta_character_multiview"),
  "script planning receipt should preserve discussion delta evidence refs",
);
assert(validateProjectVibe(committedWithDeltas.project).ok, "confirmed delta Project.vibe should validate");

const stagedWithUnconfirmedDelta = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: richDraft,
  discussionDeltas: [{ ...confirmedDiscussionDeltas[0], status: "staged", confirmedAt: undefined }],
  generatedAt,
});
assert(stagedWithUnconfirmedDelta.blocked === true, "unconfirmed discussion deltas should block Project.vibe staging");
assert(stagedWithUnconfirmedDelta.blockedReasons.includes("discussion_delta_unconfirmed"), "unconfirmed delta blocker should be explicit");

const staleProject = {
  ...project,
  manifest: {
    ...project.manifest,
    title: "Changed Elsewhere",
  },
};
const staleCommit = commitNewVideoProjectVibeStagedTransaction({
  project: staleProject,
  stagedTransaction: staged,
});
assert(staleCommit.status === "rejected", "stale source Project.vibe should reject the staged commit");
assert(staleCommit.blockedReasons.includes("source_project_fact_hash_mismatch"), "stale rejection should name the fact hash mismatch");
assert(hashProjectVibeFacts(staleCommit.project) === hashProjectVibeFacts(staleProject), "rejected commit must not mutate the stale project");

const sparseStaged = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: {
    script: "孤独与自由",
    style: "",
    references: [],
  },
  generatedAt,
});
assert(sparseStaged.blocked === true, "sparse script should stage as blocked instead of writing Project.vibe facts");
assert(sparseStaged.blockedReasons.some((reason) => reason.startsWith("script_qa_")), "sparse script should expose planner blocker reasons");
const sparseCommit = commitNewVideoProjectVibeStagedTransaction({
  project,
  stagedTransaction: sparseStaged,
});
assert(sparseCommit.status === "rejected", "blocked staged preview must not be committed");
assert(sparseCommit.blockedReasons.includes("staged_preview_blocked"), "blocked commit should explain that the preview was blocked");

const emptyStaged = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: { script: "   ", style: "电影感", references: [] },
  generatedAt,
});
assert(emptyStaged.blocked === true, "empty script should stage as blocked");
assert(emptyStaged.blockedReasons.includes("script_missing"), "empty script should expose script_missing");
assert(commitNewVideoProjectVibeStagedTransaction({
  project,
  stagedTransaction: emptyStaged,
}).status === "rejected", "empty-script staged preview must not commit");

const legacyStaged = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft: legacyUnboundDraft,
  generatedAt,
});
const legacyCharacterReference = legacyStaged.patchOperations
  .filter((operation) => operation.op === "upsert_asset")
  .map((operation) => operation.asset)
  .find((asset) => asset.kind === "character");
assert(legacyCharacterReference, "legacy unbound character reference should still stage as a candidate");
assert(
  legacyStaged.planner.shots.every((shot) => shot.characterAssetIds.includes(legacyCharacterReference.id)),
  "legacy unbound character references should keep the conservative all-shot fallback",
);

const legacyPlan = planNewVideoDraftIntoProjectVibe({
  project,
  draft: legacyUnboundDraft,
  generatedAt,
});
assert(legacyPlan.patch.receipt.status === "applied", "legacy helper should remain compatible for the App confirmation path");
assert(legacyPlan.project.shots.length === staged.planner.shots.length, "legacy helper should still commit planner shots after internal staging");

console.log(
  `new-video-project-vibe-test: stagedOps=${staged.patchOperations.length}, committedShots=${committed.project.shots.length}, sparseBlocked=${sparseStaged.blockedReasons.length}.`,
);
