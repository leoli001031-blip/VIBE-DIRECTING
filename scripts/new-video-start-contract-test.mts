import fs from "node:fs";

import { buildDirectorSessionFromIntake } from "../src/core/directorSession.ts";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";
import {
  buildNewVideoProjectVibeStagedTransaction,
  commitNewVideoProjectVibeStagedTransaction,
} from "../src/core/newVideoProjectVibePlanner.ts";
import {
  buildStoryDiscussionWorkspace,
  confirmStoryDiscussionDeltas,
  stageStoryDiscussionTurn,
} from "../src/core/storyDiscussionWorkspace.ts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  validateProjectVibe,
} from "../src/project/index.ts";

function readText(path: string) {
  return fs.readFileSync(path, "utf8");
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function findFunctionBody(source: string, functionName: string) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} component/function is missing`);

  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} has no parameter list`);

  let paramDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramDepth += 1;
    if (char === ")") paramDepth -= 1;
    if (paramDepth === 0) {
      paramsClose = index;
      break;
    }
  }

  assert(paramsClose >= 0, `${functionName} parameter list was not closed`);
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} has no function body`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }

  throw new Error(`${functionName} body was not closed`);
}

function extractStringLiterals(source: string) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
}

function jsxInputBlocks(source: string) {
  return Array.from(source.matchAll(/<input\b[\s\S]*?\/>/g)).map((match) => match[0]);
}

function check(condition: unknown, message: string, failures: string[]) {
  if (!condition) failures.push(message);
}

function hasFileTypeAttribute(input: string) {
  return /\btype\s*=\s*(["']file["']|\{\s*["']file["']\s*\})/.test(input);
}

function acceptsScriptImportExtensions(input: string) {
  return [".txt", ".md", ".srt"].every((extension) => input.includes(extension));
}

const generatedAt = "2026-05-18T12:00:00.000Z";
const newVideoStartPath = "src/ui/director/NewVideoStart.tsx";
const newVideoStartSource = stripComments(readText(newVideoStartPath));
const newVideoStart = findFunctionBody(newVideoStartSource, "NewVideoStart");
const prepareDraft = findFunctionBody(newVideoStartSource, "prepareDraft");
const confirmDraft = findFunctionBody(newVideoStartSource, "confirmDraft");
const visibleCopy = extractStringLiterals(newVideoStart);
const failures: string[] = [];

const scriptImportInput = jsxInputBlocks(newVideoStart)
  .find((input) => hasFileTypeAttribute(input) && acceptsScriptImportExtensions(input));

check(
  Boolean(scriptImportInput),
  "NewVideoStart must expose a script import file input accepting .txt, .md, and .srt.",
  failures,
);
check(
  !scriptImportInput || /\bonChange\s*=/.test(scriptImportInput),
  "NewVideoStart script import input must wire an onChange reader.",
  failures,
);
check(
  /(\.text\s*\(|new\s+FileReader\s*\()/.test(newVideoStart),
  "NewVideoStart script import must read uploaded text with file.text() or FileReader.",
  failures,
);
check(
  /(setScript|updateScript)\s*\(/.test(newVideoStart),
  "NewVideoStart script import path must write imported text into the script draft.",
  failures,
);
check(
  visibleCopy.includes("镜头安排"),
  "NewVideoStart must render the visible field label \"镜头安排\" before final draft confirmation.",
  failures,
);
check(
  /revisionSummary\?\.confirmationCopy/.test(newVideoStartSource) && /待确认修改/.test(newVideoStartSource),
  "NewVideoStart must expose pending director revision summaries for confirmation.",
  failures,
);
for (const storyboardColumn of ["镜号", "时长", "景别", "镜头", "画面描述", "动作反馈", "字幕", "音效"]) {
  check(
    newVideoStartSource.includes(storyboardColumn),
    `NewVideoStart storyboard table must expose the director-facing column "${storyboardColumn}".`,
    failures,
  );
}
for (const storyboardField of ["primaryAction", "actionTrigger", "microReaction", "actionReactionQa", "executionMode", "referenceStrategy", "visibleCutBudget", "visibleClips", "storyboardPanels", "actionBeats"]) {
  check(
    newVideoStartSource.includes(storyboardField),
    `NewVideoStart storyboard draft must carry structured director field "${storyboardField}".`,
    failures,
  );
}
check(
  /prop:\s*"道具/.test(newVideoStartSource) && newVideoStartSource.includes("添加文件"),
  "NewVideoStart must classify prop references from the unified file intake instead of exposing a separate prop upload entry.",
  failures,
);
check(
  /runAgentWebSearch/.test(newVideoStartSource) && visibleCopy.includes("查资料") && visibleCopy.includes("保存为本片参考"),
  "NewVideoStart must expose style research lookup and save-as-project-reference actions in the intake flow.",
  failures,
);
check(
  /visualDescriptionFromText/.test(newVideoStartSource) && /cameraFromText/.test(newVideoStartSource),
  "NewVideoStart must derive drawable storyboard rows with camera and visual-description facts.",
  failures,
);
check(
  /inferAudioRole/.test(newVideoStartSource)
    && /voice_reference/.test(newVideoStartSource)
    && /music_reference/.test(newVideoStartSource)
    && newVideoStartSource.includes("音频会自动识别为配乐或声音参考"),
  "NewVideoStart must infer music vs voice audio without implying every audio file is BGM.",
  failures,
);
check(
  !/onDraftConfirmed/.test(prepareDraft),
  "prepareDraft must only stage the draft and must not call onDraftConfirmed.",
  failures,
);
check(
  /onDraftConfirmed/.test(confirmDraft),
  "confirmDraft must be the only NewVideoStart path that asks the app to persist Project.vibe facts.",
  failures,
);
check(
  /discussionWorkspace\?\.stagedDeltas[\s\S]*status === "staged"/.test(confirmDraft)
    && /先确认待修改/.test(confirmDraft),
  "confirmDraft must block Project.vibe confirmation while storyboard/discussion deltas are still staged.",
  failures,
);
check(
  !/(commitNewVideoProjectVibeStagedTransaction|planNewVideoDraftIntoProjectVibe|applyProjectVibeTransaction|saveProjectVibeDraft)/.test(newVideoStartSource),
  "NewVideoStart must not import or execute Project.vibe write helpers directly.",
  failures,
);

const importedScriptSamples = [
  {
    name: "opening.txt",
    text: "一位年轻摄影师在雨夜影院发现一卷没有完成的胶片。",
  },
  {
    name: "outline.md",
    text: "她想循着胶片线索进入旧站台、地下剪辑室和屋顶放映间，但暴雨和封锁的旧站台阻碍她继续前进，后来她遇到失踪放映员留下的录音。",
  },
  {
    name: "captions.srt",
    text: "最终她没有复原旧电影，而是把最后一个镜头交给清晨第一班车上的新观众继续拍下去。",
  },
];
assert(
  importedScriptSamples.every((sample) => /\.(txt|md|srt)$/i.test(sample.name) && sample.text.trim()),
  "script import fixtures must cover .txt, .md, and .srt text inputs",
);

const importedScript = importedScriptSamples.map((sample) => sample.text).join(" ");
const draft = {
  script: importedScript,
  style: "克制、低饱和、雨夜霓虹、真实摄影质感",
  references: [
    { type: "character", label: "剪辑师主角参考", file: { name: "hero-reference.png" } },
    { type: "style", label: "雨夜电影感参考", file: { name: "style-reference.jpg" } },
  ],
  audio: { name: "narration-reference.wav" },
};
const intakeDraft = buildProjectIntakeDraft({
  scriptText: draft.script,
  styleNote: draft.style,
  referenceAssets: [
    {
      id: "reference_character_1",
      type: "character",
      label: "剪辑师主角参考",
      uri: "local-file://hero-reference.png",
    },
    {
      id: "reference_style_1",
      type: "style",
      label: "雨夜电影感参考",
      uri: "local-file://style-reference.jpg",
    },
    {
      id: "audio_reference_1",
      type: "audio",
      label: "旁白参考音频",
      uri: "local-file://narration-reference.wav",
    },
  ],
  createdAt: generatedAt,
  draftId: "new_video_start_contract_draft",
});
const projection = buildIntakeStagedPlanProjection(intakeDraft);
const directorSession = buildDirectorSessionFromIntake({
  draft: intakeDraft,
  projection,
  projectId: "new_video_start_contract",
  createdAt: generatedAt,
  sessionId: "new_video_start_contract_session",
});
const workspace = stageStoryDiscussionTurn({
  workspace: buildStoryDiscussionWorkspace({ session: directorSession, createdAt: generatedAt }),
  text: "第三个镜头节奏慢一点，再加一个清晨空镜。",
  createdAt: generatedAt,
});
const animeRevisionWorkspace = stageStoryDiscussionTurn({
  workspace,
  text: "动作太平，想要日漫里远景-表情特写-手部动作特写的节奏，不要广告感，镜头多拆一点。",
  createdAt: generatedAt,
});

assert(animeRevisionWorkspace.stagedDeltas.length >= 4, "storyboard feedback should stage timing/add/remove plus director revision deltas");
assert(
  animeRevisionWorkspace.stagedDeltas.every((delta) => delta.status === "staged" && delta.canWriteProjectFactNow === false),
  "storyboard deltas must stay staged and unable to write Project.vibe facts before confirmation",
);
assert(
  animeRevisionWorkspace.stagedDeltas.some((delta) => delta.kind === "storyboard_split_preference" && delta.revisionSummary?.requestedSplitPolicy === "more_micro_shots"),
  "natural-language anime revision should become a staged split preference",
);

const project = createProjectVibe({
  projectId: "new_video_start_contract",
  title: "New Video Start Contract",
  createdAt: generatedAt,
  updatedAt: generatedAt,
});
const beforeHash = hashProjectVibeFacts(project);
const blockedByStoryboard = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft,
  directorSession,
  discussionDeltas: animeRevisionWorkspace.stagedDeltas,
  generatedAt,
});

assert(blockedByStoryboard.blocked === true, "staged storyboard deltas should block Project.vibe transaction preview");
assert(
  blockedByStoryboard.blockedReasons.includes("discussion_delta_unconfirmed"),
  "blocked preview must name unconfirmed discussion/storyboard deltas",
);
assert(blockedByStoryboard.projectVibeWriteAllowed === false, "blocked preview must keep Project.vibe writes locked");
assert(blockedByStoryboard.projectFactsMutated === false, "blocked preview must report no Project.vibe mutation");
assert(hashProjectVibeFacts(project) === beforeHash, "blocked preview must not mutate Project.vibe facts");
assert(project.storyFlow.sections.length === 0, "blocked preview must not create story sections");
assert(project.shots.length === 0, "blocked preview must not create shots");

const confirmedWorkspace = confirmStoryDiscussionDeltas({ workspace: animeRevisionWorkspace, createdAt: generatedAt });
assert(
  confirmedWorkspace.stagedDeltas.every((delta) => delta.status === "confirmed" && delta.canWriteProjectFactNow === false),
  "confirmed storyboard deltas remain review evidence until the draft itself is confirmed",
);

const stagedAfterStoryboardConfirm = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft,
  directorSession,
  discussionDeltas: confirmedWorkspace.stagedDeltas,
  generatedAt,
});
assert(stagedAfterStoryboardConfirm.blocked === false, `confirmed storyboard deltas should stage cleanly: ${stagedAfterStoryboardConfirm.blockedReasons.join("; ")}`);
assert(stagedAfterStoryboardConfirm.projectVibeWriteAllowed === false, "transaction preview must still keep Project.vibe writes locked");
assert(stagedAfterStoryboardConfirm.projectFactsMutated === false, "transaction preview must still report no Project.vibe mutation");
assert(!("project" in stagedAfterStoryboardConfirm), "transaction preview must not return a committed Project.vibe document");
assert(hashProjectVibeFacts(project) === beforeHash, "transaction preview after storyboard confirmation must not mutate Project.vibe facts");

const committed = commitNewVideoProjectVibeStagedTransaction({
  project,
  stagedTransaction: stagedAfterStoryboardConfirm,
});
assert(committed.status === "applied", `confirmed draft should commit Project.vibe facts: ${committed.blockedReasons.join("; ")}`);
assert(hashProjectVibeFacts(committed.project) !== beforeHash, "confirmed draft must be the point where Project.vibe facts change");
assert(committed.project.storyFlow.sections.length > 0, "confirmed draft should write story sections");
assert(committed.project.storyFlow.shotOrder.length > 0, "confirmed draft should write shot order");
assert(committed.project.shots.length > 0, "confirmed draft should write planned shots");
assert(
  committed.project.shots.some((shot) => shot.title === "清晨空镜"),
  "confirmed storyboard add/remove delta should affect the Project.vibe shot list",
);
assert(
  committed.project.shots.some((shot) => shot.title.includes("远景关系"))
    && committed.project.shots.some((shot) => shot.title.includes("表情特写"))
    && committed.project.shots.some((shot) => shot.title.includes("手部动作特写")),
  "confirmed anime split preference should add micro-shot planning to Project.vibe shot list",
);
assert(validateProjectVibe(committed.project).ok, "confirmed Project.vibe must validate");

if (failures.length > 0) {
  throw new Error(`new-video-start contract failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `new-video-start-contract-test: scriptImports=${importedScriptSamples.length}, storyboardDeltas=${confirmedWorkspace.stagedDeltas.length}, committedShots=${committed.project.shots.length}.`,
);
