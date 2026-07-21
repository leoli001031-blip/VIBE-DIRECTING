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
import { agentNewVideoProjectTargetMode } from "../src/core/agentNewVideoProjectTarget.ts";

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
const intakeTimelineSource = stripComments(readText("src/agent-core/intakeTimeline.ts"));
const agentPanelProjectionSource = stripComments(readText("src/ui/director/agentPanelProjection.ts"));
const directorAgentActionSource = stripComments(readText("src/core/directorAgentAction.ts"));
const directorModeSource = stripComments(readText("src/ui/director/DirectorModeShell.tsx"));
const directorCssSource = stripComments(readText("src/styles/director.css"));
const newVideoStart = findFunctionBody(newVideoStartSource, "NewVideoStart");
const intakeTimelineBuilder = findFunctionBody(intakeTimelineSource, "buildVibeAgentIntakeTimelineEntries");
const intakeDetails = findFunctionBody(intakeTimelineSource, "intakeDetails");
const prepareDraft = findFunctionBody(newVideoStartSource, "prepareDraft");
const confirmDraft = findFunctionBody(newVideoStartSource, "confirmDraft");
const selectVideoPermissionMode = findFunctionBody(newVideoStartSource, "selectVideoPermissionMode");
const sendDiscussionFeedback = findFunctionBody(newVideoStartSource, "sendDiscussionFeedback");
const submitComposer = findFunctionBody(newVideoStartSource, "submitComposer");
const tableRowSummary = findFunctionBody(newVideoStartSource, "tableRowSummary");
const cleanPlanningSummaryValue = findFunctionBody(newVideoStartSource, "cleanPlanningSummaryValue");
const shouldHandleEmptyProjectStatusIntent = findFunctionBody(newVideoStartSource, "shouldHandleEmptyProjectStatusIntent");
const showEmptyProjectStatusNotice = findFunctionBody(newVideoStartSource, "showEmptyProjectStatusNotice");
const syncVideoPermissionFromIntent = findFunctionBody(newVideoStartSource, "syncVideoPermissionFromIntent");
const restoredReadyDraftConfirmationState = findFunctionBody(newVideoStartSource, "restoredReadyDraftConfirmationState");
const restoredDraftScriptIsConfirmable = findFunctionBody(newVideoStartSource, "restoredDraftScriptIsConfirmable");
const hasPendingReadyDraftTimeline = findFunctionBody(newVideoStartSource, "hasPendingReadyDraftTimeline");
const scriptSegments = findFunctionBody(newVideoStartSource, "scriptSegments");
const sequenceCueStoryboardCandidates = findFunctionBody(newVideoStartSource, "sequenceCueStoryboardCandidates");
const mostlyPlanningInstruction = findFunctionBody(newVideoStartSource, "mostlyPlanningInstruction");
const explicitShotCount = findFunctionBody(newVideoStartSource, "explicitShotCount");
const stripTargetShotOrdinalMentions = findFunctionBody(newVideoStartSource, "stripTargetShotOrdinalMentions");
const feedbackShouldPreserveCurrentDraftScript = findFunctionBody(newVideoStartSource, "feedbackShouldPreserveCurrentDraftScript");
const stripDraftRevisionPromptPrefix = findFunctionBody(newVideoStartSource, "stripDraftRevisionPromptPrefix");
const currentDraftScriptForFeedback = findFunctionBody(newVideoStartSource, "currentDraftScriptForFeedback");
const stripShotCountPlanningInstructions = findFunctionBody(newVideoStartSource, "stripShotCountPlanningInstructions");
const targetShotRevisionIndex = findFunctionBody(newVideoStartSource, "targetShotRevisionIndex");
const targetShotRevisionIndexForRows = findFunctionBody(newVideoStartSource, "targetShotRevisionIndexForRows");
const explicitMultiTargetShotRevisionClauses = findFunctionBody(newVideoStartSource, "explicitMultiTargetShotRevisionClauses");
const cleanTargetShotRevisionText = findFunctionBody(newVideoStartSource, "cleanTargetShotRevisionText");
const excludedPropLabelsFromFeedback = findFunctionBody(newVideoStartSource, "excludedPropLabelsFromFeedback");
const cleanStoryboardFeedbackControlClauses = findFunctionBody(newVideoStartSource, "cleanStoryboardFeedbackControlClauses");
const feedbackExplicitStoryboardSegments = findFunctionBody(newVideoStartSource, "feedbackExplicitStoryboardSegments");
const feedbackGlobalRevisionNote = findFunctionBody(newVideoStartSource, "feedbackGlobalRevisionNote");
const finalShotIsolationBeat = findFunctionBody(newVideoStartSource, "finalShotIsolationBeat");
const normalizeFinalShotIsolationSegments = findFunctionBody(newVideoStartSource, "normalizeFinalShotIsolationSegments");
const isolateFinalShotFeedbackSegments = findFunctionBody(newVideoStartSource, "isolateFinalShotFeedbackSegments");
const applyExplicitShotCountFeedbackRows = findFunctionBody(newVideoStartSource, "applyExplicitShotCountFeedbackRows");
const applyTargetedShotRevisionRows = findFunctionBody(newVideoStartSource, "applyTargetedShotRevisionRows");
const applyMultiTargetedShotRevisionRows = findFunctionBody(newVideoStartSource, "applyMultiTargetedShotRevisionRows");
const feedbackExplicitlyRequestsSceneRevision = findFunctionBody(newVideoStartSource, "feedbackExplicitlyRequestsSceneRevision");
const targetedShotRevisionSummary = findFunctionBody(newVideoStartSource, "targetedShotRevisionSummary");
const multiTargetedShotRevisionSummary = findFunctionBody(newVideoStartSource, "multiTargetedShotRevisionSummary");
const shotCountRevisionSummary = findFunctionBody(newVideoStartSource, "shotCountRevisionSummary");
const applyTargetedFeedbackGuardsToAiRows = findFunctionBody(newVideoStartSource, "applyTargetedFeedbackGuardsToAiRows");
const localStoryboardBeatCandidates = findFunctionBody(newVideoStartSource, "localStoryboardBeatCandidates");
const sceneOnlyStoryboardSegment = findFunctionBody(newVideoStartSource, "sceneOnlyStoryboardSegment");
const focusedStoryboardBeatCandidates = findFunctionBody(newVideoStartSource, "focusedStoryboardBeatCandidates");
const primaryStoryboardSubjectFromText = findFunctionBody(newVideoStartSource, "primaryStoryboardSubjectFromText");
const sceneSetupStoryboardSegment = findFunctionBody(newVideoStartSource, "sceneSetupStoryboardSegment");
const sceneLabelsFromStoryboardContext = findFunctionBody(newVideoStartSource, "sceneLabelsFromStoryboardContext");
const endingStoryboardCandidate = findFunctionBody(newVideoStartSource, "endingStoryboardCandidate");
const trimStoryboardCandidatesToRequestedCount = findFunctionBody(newVideoStartSource, "trimStoryboardCandidatesToRequestedCount");
const feedbackMultiLocationStoryboardCandidates = findFunctionBody(newVideoStartSource, "feedbackMultiLocationStoryboardCandidates");
const feedbackSourceStoryboardCandidates = findFunctionBody(newVideoStartSource, "feedbackSourceStoryboardCandidates");
const storyboardStoryText = findFunctionBody(newVideoStartSource, "storyboardStoryText");
const plausibleCharacterLabel = findFunctionBody(newVideoStartSource, "plausibleCharacterLabel");
const charactersFromShotText = findFunctionBody(newVideoStartSource, "charactersFromShotText");
const visualDescriptionFromText = findFunctionBody(newVideoStartSource, "visualDescriptionFromText");
const sceneFromShotText = findFunctionBody(newVideoStartSource, "sceneFromShotText");
const localSceneLabelsFromText = findFunctionBody(newVideoStartSource, "localSceneLabelsFromText");
const propsFromShotText = findFunctionBody(newVideoStartSource, "propsFromShotText");
const aiShotToStoryboardRow = findFunctionBody(newVideoStartSource, "aiShotToStoryboardRow");
const buildStoryboardRowsFromSession = findFunctionBody(newVideoStartSource, "buildStoryboardRowsFromSession");
const transformingPropStoryboardCandidates = findFunctionBody(newVideoStartSource, "transformingPropStoryboardCandidates");
const locationListStoryboardCandidates = findFunctionBody(newVideoStartSource, "locationListStoryboardCandidates");
const primaryActionFromText = findFunctionBody(newVideoStartSource, "primaryActionFromText");
const fallbackStoryboardBeatLabel = findFunctionBody(newVideoStartSource, "fallbackStoryboardBeatLabel");
const storyboardContinuationBaseText = findFunctionBody(newVideoStartSource, "storyboardContinuationBaseText");
const fallbackStoryboardBeatText = findFunctionBody(newVideoStartSource, "fallbackStoryboardBeatText");
const expandScriptRowsToRequestedCount = findFunctionBody(newVideoStartSource, "expandScriptRowsToRequestedCount");
const mergeOverflowStoryboardRowsToRequestedCount = findFunctionBody(newVideoStartSource, "mergeOverflowStoryboardRowsToRequestedCount");
const mergeMissingStoryboardCandidatesIntoRequestedRows = findFunctionBody(newVideoStartSource, "mergeMissingStoryboardCandidatesIntoRequestedRows");
const normalizeStoryboardSourceRowsToRequestedCount = findFunctionBody(newVideoStartSource, "normalizeStoryboardSourceRowsToRequestedCount");
const confirmNewVideoDraft = findFunctionBody(directorModeSource, "confirmNewVideoDraft");
const restoredNewVideoDraftSummary = findFunctionBody(directorModeSource, "restoredNewVideoDraftSummary");
const directorTimelineDetailText = findFunctionBody(directorModeSource, "timelineDetailText");
const visibleCopy = extractStringLiterals(newVideoStart);
const failures: string[] = [];

assert(
  agentNewVideoProjectTargetMode({ localProjectReady: true, currentProjectShotCount: 0 }) === "current_project",
  "Agent new-video intake should commit into an explicitly connected empty local project",
);
assert(
  agentNewVideoProjectTargetMode({ localProjectReady: true, currentProjectShotCount: 2 }) === "new_project",
  "Agent new-video intake must not overwrite a connected project that already has story shots",
);
assert(
  agentNewVideoProjectTargetMode({ localProjectReady: false, currentProjectShotCount: 0 }) === "new_project",
  "Agent new-video intake without a connected local project should keep a new-project target",
);

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
  /englishDurationNumbers/.test(newVideoStartSource)
    && /twelve:\s*12/.test(newVideoStartSource)
    && /englishDurationNumber\(englishMatch\?\.\[1\]\)/.test(newVideoStartSource),
  "NewVideoStart must recognize common English duration phrases such as 'twelve seconds' as target duration.",
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
  /showComposerSurface = composerPlacement !== "draft_only"/.test(newVideoStartSource),
  "NewVideoStart Agent-first mode must keep draft discussion in the right-side Agent rail instead of remounting a middle composer.",
  failures,
);
check(
  /showInlineAgentThread = composerPlacement !== "draft_only" && displayAgentMessages\.length > 0/.test(newVideoStartSource),
  "NewVideoStart Agent-first mode must not duplicate the Agent message flow in the middle canvas.",
  failures,
);
check(
  /showMiddleDiscussionWorkspace = composerPlacement !== "draft_only" && Boolean\(discussionWorkspace\)/.test(newVideoStartSource),
  "NewVideoStart Agent-first mode must keep draft discussion in the right-side Agent rail instead of duplicating it in the middle canvas.",
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
    && newVideoStartSource.includes("声音参考，会绑定到角色"),
  "NewVideoStart must treat uploaded audio as voice reference on the demo path.",
  failures,
);
const inferAudioRoleBody = findFunctionBody(newVideoStartSource, "inferAudioRole");
check(
  inferAudioRoleBody.indexOf("voice_reference") >= 0
    && !/music_reference|bgm|配乐|音乐/i.test(inferAudioRoleBody),
  "NewVideoStart audio inference must not route uploaded audio into music/BGM analysis on the demo path.",
  failures,
);
check(
  !/musicAnalysis/.test(newVideoStartSource)
    && !/music_reference/.test(newVideoStartSource)
    && /scriptRhythmSegment/.test(newVideoStartSource),
  "NewVideoStart must keep script rhythm planning separate from parked music analysis and music-reference routing.",
  failures,
);
check(
  /agentBoundaryMode\?:\s*AgentVideoSubmitMode/.test(newVideoStartSource)
    && /agentBoundaryMode:\s*activeVideoPermissionContract\.mode/.test(newVideoStartSource),
  "NewVideoStart drafts must carry the creator-selected Agent execution boundary.",
  failures,
);
check(
  /sendDiscussionFeedback\(feedbackOverride\?: string\)/.test(newVideoStartSource)
    && /const feedbackText = stripDraftRevisionPromptPrefix\(feedbackOverride \?\? discussionFeedback\)/.test(sendDiscussionFeedback)
    && /if \(!feedbackOverride\) setDiscussionFeedback\(""\)/.test(sendDiscussionFeedback),
  "NewVideoStart must let the right-side Agent send feedback into the current draft without mutating the local composer text.",
  failures,
);
check(
  /修改这版草案\|修改当前草案\|继续修改草案\|继续改草案/.test(stripDraftRevisionPromptPrefix)
    && /\^\(\?:修改这版草案\|修改当前草案\|继续修改草案\|继续改草案\)\\s\*\[：:\]\\s\*/.test(stripDraftRevisionPromptPrefix)
    && /targetShotRevisionIndex\(text: string[\s\S]*const cleaned = stripDraftRevisionPromptPrefix\(text\)[\s\S]*cleaned\.match/.test(newVideoStartSource)
    && /function cleanTargetShotRevisionText\(text: string\)[\s\S]*const withoutSafetyClauses = stripDraftRevisionPromptPrefix\(text\)/.test(newVideoStartSource)
    && /function cleanStoryboardFeedbackControlClauses\(text: string\)[\s\S]*const withoutSafetyClauses = stripDraftRevisionPromptPrefix\(text\)/.test(newVideoStartSource),
  "Draft-edit composer helper copy such as '修改这版草案：' must be stripped before feedback is parsed or written into storyboard rows.",
  failures,
);
check(
  /const selectedStoryboardShotNoRef = useRef\(""\)/.test(newVideoStartSource)
    && /setSelectedStoryboardRowId\(\(current\) => \{[\s\S]*if \(rowIds\.has\(current\)\) return current[\s\S]*const selectedShotNo = selectedStoryboardShotNoRef\.current[\s\S]*storyboardRows\.find\(\(row\) => row\.shotNo === selectedShotNo\)\?\.id[\s\S]*selectedStoryboardShotNoRef\.current = ""/.test(newVideoStartSource)
    && /function selectStoryboardRow\(row: NewVideoStoryboardShot\)[\s\S]*selectedStoryboardShotNoRef\.current = row\.shotNo \|\| ""/.test(newVideoStartSource)
    && /function selectReferenceMaterial[\s\S]*setSelectedStoryboardRowId\(""\)[\s\S]*selectedStoryboardShotNoRef\.current = ""/.test(newVideoStartSource)
    && /function selectAudioMaterial[\s\S]*setSelectedStoryboardRowId\(""\)[\s\S]*selectedStoryboardShotNoRef\.current = ""/.test(newVideoStartSource),
  "Selected draft-shot context must survive AI storyboard row replacement by restoring the selected row through shotNo, while material/audio selection clears it.",
  failures,
);
check(
  /用户正在修改当前新视频草案/.test(sendDiscussionFeedback)
    && /请直接输出修正后的完整分镜表/.test(sendDiscussionFeedback),
  "NewVideoStart discussion feedback must ask the planner to revise the current draft instead of treating feedback as a new idea.",
  failures,
);
check(
  /const requestedFeedbackShotCount = explicitShotCount\(feedbackText\)[\s\S]*const currentFeedbackScript = currentDraftScriptForFeedback\(planningDraft,\s*storyboardRows\)[\s\S]*const selectedFeedbackStoryboardRowId = selectedStoryboardRowId[\s\S]*const multiTargetedFeedbackStoryboardRows = \(!requestedFeedbackShotCount \|\| requestedFeedbackShotCount === storyboardRows\.length\)[\s\S]*applyMultiTargetedShotRevisionRows\(storyboardRows,\s*feedbackText\)[\s\S]*const targetedFeedbackStoryboardRows = !multiTargetedFeedbackStoryboardRows[\s\S]*applyTargetedShotRevisionRows\(storyboardRows,\s*feedbackText,\s*selectedFeedbackStoryboardRowId\)[\s\S]*const explicitFeedbackStoryboardRows = multiTargetedFeedbackStoryboardRows \|\| targetedFeedbackStoryboardRows \? undefined : requestedFeedbackShotCount[\s\S]*applyExplicitShotCountFeedbackRows\(storyboardRows,\s*feedbackText,\s*currentFeedbackScript\)[\s\S]*const feedbackHasLocalStoryboardIntent = Boolean\([\s\S]*explicitFeedbackStoryboardRows[\s\S]*multiTargetedFeedbackStoryboardRows[\s\S]*targetedFeedbackStoryboardRows[\s\S]*requestedFeedbackShotCount[\s\S]*enumeratedShotSegments\(feedbackText\)\.length > 1/.test(sendDiscussionFeedback)
    && /const feedbackLocalStoryboardRows = feedbackHasLocalStoryboardIntent[\s\S]*buildStoryboardRowsFromSession\(feedbackSession, feedbackPlanningDraft, feedbackStylePreflight\)/.test(sendDiscussionFeedback)
    && /if \(multiTargetedFeedbackStoryboardRows\) return multiTargetedFeedbackStoryboardRows/.test(sendDiscussionFeedback)
    && /if \(targetedFeedbackStoryboardRows\) return targetedFeedbackStoryboardRows/.test(sendDiscussionFeedback)
    && /if \(explicitFeedbackStoryboardRows\) return explicitFeedbackStoryboardRows/.test(sendDiscussionFeedback)
    && /const rowsForFeedbackPlanning = feedbackLocalStoryboardRows\.length \? feedbackLocalStoryboardRows : storyboardRows/.test(sendDiscussionFeedback)
    && /const feedbackLocalStoryboardSignature = storyboardSignature\(rowsForFeedbackPlanning\)/.test(sendDiscussionFeedback)
    && /const feedbackPlanRunId = storyboardAiPlanRunIdRef\.current \+ 1/.test(sendDiscussionFeedback)
    && /structuralRows:\s*storyboardRowsToAiSeedRows\(rowsForFeedbackPlanning\)/.test(sendDiscussionFeedback)
    && /targetDurationSeconds:[\s\S]*rowsForFeedbackPlanning\.reduce/.test(sendDiscussionFeedback)
    && /buildStoryboardRowsFromAiPlan\(aiPlan,\s*rowsForFeedbackPlanning\)/.test(sendDiscussionFeedback)
    && /shotCount:\s*rowsForFeedbackPlanning\.length/.test(sendDiscussionFeedback),
  "Draft feedback must first update local rows, with explicit multi-shot revisions taking priority over single-shot and shot-count fallbacks, then let AI optimize from that structure.",
  failures,
);
check(
  /safetyClausePattern[\s\S]*参考图\|参考\|视频\|提交\|发送\|生成\|导出/.test(cleanStoryboardFeedbackControlClauses)
    && /confirmationClausePattern[\s\S]*确认/.test(cleanStoryboardFeedbackControlClauses)
    && /const withoutSafetyClauses = stripDraftRevisionPromptPrefix\(text\)[\s\S]*replace\(safetyClausePattern,\s*" "\)[\s\S]*stripDirectorAgentPermissionControlPhrases\(withoutSafetyClauses\)/.test(cleanStoryboardFeedbackControlClauses)
    && /镜头\|分镜\|视频段\|片段\|段落\|镜\|段\|幕/.test(newVideoStartSource)
    && /ordinalMarkerPattern[\s\S]*第\\s\*\$\{localizedShotNumberToken\}[\s\S]*ordinalMarkers\.length >= 2[\s\S]*normalized\.slice\(marker\.end,\s*nextMarker \? nextMarker\.start : undefined\)/.test(newVideoStartSource)
    && /enumeratedShotSegments\(cleanedFeedback\)/.test(feedbackExplicitStoryboardSegments)
    && /isolateFinalShotFeedbackSegments\(rows,\s*requestedCount,\s*cleanedFeedback\)/.test(feedbackExplicitStoryboardSegments)
    && /feedbackSourceStoryboardCandidates\(sourceText,\s*requestedCount\)/.test(feedbackExplicitStoryboardSegments)
    && /localStoryboardBeatCandidates\(stripShotCountPlanningInstructions\(cleanedFeedback\)\)/.test(feedbackExplicitStoryboardSegments)
    && /fallbackStoryboardBeatText\(source,\s*nextSegments\.length,\s*requestedCount\)/.test(feedbackExplicitStoryboardSegments)
    && /stripEnumeratedShotClauses\(cleanStoryboardFeedbackControlClauses\(text\)\)/.test(feedbackGlobalRevisionNote)
    && /\^\[：:，,。；;\\s\]\+/.test(feedbackGlobalRevisionNote)
    && /const requestedCount = explicitShotCount\(feedbackText\)/.test(applyExplicitShotCountFeedbackRows)
    && /feedbackExplicitStoryboardSegments\(rows,\s*feedbackText,\s*requestedCount,\s*sourceText\)/.test(applyExplicitShotCountFeedbackRows)
    && /shotNo:\s*shotNoForIndex\(index\)/.test(applyExplicitShotCountFeedbackRows)
    && /const propContext = \[[\s\S]*segment[\s\S]*base\.visualDescription[\s\S]*base\.primaryAction[\s\S]*base\.props/.test(applyExplicitShotCountFeedbackRows)
    && /propsFromShotText\(propContext,\s*splitVisibleReferenceLabels\(base\.props\)\)/.test(applyExplicitShotCountFeedbackRows)
    && /props:\s*propLabels\.join\("、"\) \|\| "无"/.test(applyExplicitShotCountFeedbackRows)
    && /const sceneLabels = sceneLabelsFromStoryboardContext\(rows,\s*sourceText\)/.test(applyExplicitShotCountFeedbackRows)
    && /sceneFromShotText\(segment,\s*sceneLabels,\s*index\)/.test(applyExplicitShotCountFeedbackRows)
    && /scene:\s*scene \|\| base\.scene/.test(applyExplicitShotCountFeedbackRows)
    && /sourceFactId:\s*undefined/.test(applyExplicitShotCountFeedbackRows),
  "Explicit draft feedback must strip confirmation/generation controls, keep enumerated shot beats, rebuild exactly the requested local rows, and refresh structured props/scenes before AI optimization.",
  failures,
);
check(
  /const source = storyboardStoryText\(sourceText\)/.test(feedbackSourceStoryboardCandidates)
    && /localStoryboardBeatCandidates\(source\)/.test(feedbackSourceStoryboardCandidates)
    && /sceneOnlyStoryboardSegment/.test(feedbackSourceStoryboardCandidates)
    && /localSceneLabelsFromText\(source\)\[0\]/.test(feedbackSourceStoryboardCandidates)
    && !/source\.match\(/.test(feedbackSourceStoryboardCandidates)
    && /focusedStoryboardBeatCandidates\(source\)/.test(feedbackSourceStoryboardCandidates)
    && /feedbackMultiLocationStoryboardCandidates\(source,\s*focusedCandidates,\s*requestedCount\)/.test(feedbackSourceStoryboardCandidates)
    && /multiLocationCandidates\.length >= requestedCount/.test(feedbackSourceStoryboardCandidates)
    && /我要拍\|我想拍\|我想做\|想做\|做一个\|拍一个/.test(feedbackSourceStoryboardCandidates)
    && /sceneSetupStoryboardSegment\(sceneCandidate,\s*source\)/.test(feedbackSourceStoryboardCandidates)
    && /visibleCharacterLabelsFromText\(source\)/.test(primaryStoryboardSubjectFromText)
    && /出现在/.test(sceneSetupStoryboardSegment)
    && /applyExplicitShotCountFeedbackRows\(storyboardRows,\s*feedbackText,\s*currentFeedbackScript\)/.test(sendDiscussionFeedback),
  "Shot-count-only feedback like '改成 3 个镜头' must re-split the current draft script before falling back to generic result-closing beats.",
  failures,
);
check(
  /最后\|最终\|结尾\|末尾\|月亮\|抬头\|闪烁/.test(endingStoryboardCandidate)
    && /endingCandidate/.test(trimStoryboardCandidatesToRequestedCount)
    && /nextCandidates\[lastIndex\] = cleanText\(`\$\{nextCandidates\[lastIndex\]\}，\$\{ending\}`\)/.test(trimStoryboardCandidatesToRequestedCount)
    && /locationListStoryboardCandidates\(source\)/.test(feedbackMultiLocationStoryboardCandidates)
    && /requestedCount < locationCandidates\.length \+ 1/.test(feedbackMultiLocationStoryboardCandidates)
    && /splitScriptIntoStoryboardBeats\(source\)/.test(feedbackMultiLocationStoryboardCandidates)
    && /\[\.\.\.splitCandidates,\s*\.\.\.focusedCandidates\]\.find\(endingStoryboardCandidate\)/.test(feedbackMultiLocationStoryboardCandidates)
    && /!endingStoryboardCandidate\(candidate\)/.test(feedbackMultiLocationStoryboardCandidates)
    && /!locationCandidates\.includes\(candidate\)/.test(feedbackMultiLocationStoryboardCandidates)
    && /trimStoryboardCandidatesToRequestedCount\(\[[\s\S]*openingCandidate \|\| ""[\s\S]*\.\.\.locationCandidates[\s\S]*\],\s*requestedCount,\s*endingCandidate\)/.test(feedbackMultiLocationStoryboardCandidates),
  "Multi-location shot-count feedback must preserve the opening beat, split each location, and merge a final moon/result beat into the last requested shot instead of dropping it.",
  failures,
);
check(
  /resultVerb[\s\S]*发光\|亮起\|变成\|变为\|显现\|浮现/.test(finalShotIsolationBeat)
    && /单独\|独立/.test(finalShotIsolationBeat)
    && /最后\|最终\|结尾\|末尾/.test(finalShotIsolationBeat)
    && /stripFinalShotIsolationBeatFromSegment\(segment,\s*finalBeat\)/.test(isolateFinalShotFeedbackSegments)
    && /middleTarget = Math\.max\(0,\s*requestedCount - 1\)/.test(normalizeFinalShotIsolationSegments)
    && /return \[\.\.\.nextSegments\.slice\(0,\s*middleTarget\),\s*finalBeat\]/.test(normalizeFinalShotIsolationSegments),
  "Feedback like '改成 3 个镜头，把站牌上的灯一格一格亮起单独放到最后一镜' must preserve current beats and isolate the requested result as the final shot.",
  failures,
);
check(
  /if \(feedbackLocalStoryboardRows\.length\) \{[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*storyboardAiPlanRunIdRef\.current !== feedbackPlanRunId[\s\S]*storyboardPlanningStatusRef\.current !== "running"[\s\S]*const fallbackRows = storyboardRowsRef\.current\.length \? storyboardRowsRef\.current : feedbackLocalStoryboardRows[\s\S]*if \(!fallbackRows\.length\) return;[\s\S]*setStoryboardPlanningStatus\("fallback"\)[\s\S]*phase:\s*"planning_ready"[\s\S]*shotCount:\s*fallbackRows\.length[\s\S]*storyboardPlanningLocalReleaseMs/.test(sendDiscussionFeedback)
    && /if \(storyboardAiPlanRunIdRef\.current !== feedbackPlanRunId\) return;[\s\S]*if \(confirmedRef\.current\) return;[\s\S]*if \(feedbackLocalStoryboardRows\.length\) \{[\s\S]*storyboardSignature\(storyboardRowsRef\.current\) !== feedbackLocalStoryboardSignature/.test(sendDiscussionFeedback)
    && /setStoryboardPlanningMessage\(targetedFeedbackSummary[\s\S]*targetedFeedbackSummary\.doneLabel[\s\S]*已按你的要求整理成 \$\{fallbackRows\.length\} 个镜头；可以确认或继续修改。/.test(sendDiscussionFeedback)
    && /setDiscussionWorkspace\(confirmStoryDiscussionDeltas\(\{[\s\S]*workspace:\s*stagedWorkspace[\s\S]*createdAt:\s*feedbackTimelineCreatedAt/.test(sendDiscussionFeedback)
    && /assistantBody:\s*targetedFeedbackSummary[\s\S]*targetedFeedbackSummary\.doneLabel[\s\S]*我已按你的要求整理成 \$\{fallbackRows\.length\} 个镜头。确认前不会写入项目，也不会生成参考或视频。/.test(sendDiscussionFeedback),
  "Explicit feedback local drafts must become confirmable after the local release window even if rows are rebuilt while still guarding late AI results by run id and draft signature.",
  failures,
);
check(
  /const fallbackRows = storyboardRowsRef\.current\.length \? storyboardRowsRef\.current : localStoryboardRows/.test(prepareDraft)
    && /if \(!fallbackRows\.length\) return;/.test(prepareDraft)
    && /setStoryboardPlanningStatus\("fallback"\)/.test(prepareDraft)
    && /phase:\s*"planning_ready"/.test(prepareDraft)
    && /shotCount:\s*fallbackRows\.length/.test(prepareDraft)
    && /storyboardPlanningLocalReleaseMs/.test(prepareDraft)
    && /assistantBody:\s*`我先拆出一版本地草案：\$\{fallbackRows\.length \|\| "若干"\} 个镜头/.test(prepareDraft)
    && /if \(storyboardSignature\(storyboardRowsRef\.current\) !== localStoryboardSignature\) return;/.test(prepareDraft),
  "Initial local drafts must release to a confirmable fallback after the local window even if rows are rebuilt, while late AI results keep the draft signature guard.",
  failures,
);
check(
  /const localFeedbackReadyMessage = feedbackLocalStoryboardRows\.length[\s\S]*已按你的要求整理成 \$\{feedbackLocalStoryboardRows\.length\} 个镜头；当前草案可以确认或继续修改。/.test(sendDiscussionFeedback)
    && !/localFeedbackReadyMessage[\s\S]*自动优化这次没有完成/.test(sendDiscussionFeedback)
    && /setStoryboardPlanningMessage\(feedbackLocalStoryboardRows\.length[\s\S]*localFeedbackReadyMessage[\s\S]*: failedMessage/.test(sendDiscussionFeedback)
    && /if \(feedbackLocalStoryboardRows\.length\) \{[\s\S]*setDiscussionWorkspace\(confirmStoryDiscussionDeltas\(\{[\s\S]*workspace:\s*stagedWorkspace[\s\S]*createdAt:\s*feedbackTimelineCreatedAt/.test(sendDiscussionFeedback)
    && /phase:\s*feedbackLocalStoryboardRows\.length \? "planning_ready" : "planning_blocked"/.test(sendDiscussionFeedback)
    && /understandingBody:\s*feedbackLocalStoryboardRows\.length[\s\S]*已经先把它应用到本地草案里/.test(sendDiscussionFeedback)
    && /assistantBody:\s*feedbackLocalStoryboardRows\.length[\s\S]*localFeedbackReadyMessage/.test(sendDiscussionFeedback)
    && /assistantNext:\s*feedbackLocalStoryboardRows\.length[\s\S]*可以确认这版故事，也可以继续说哪里要改/.test(sendDiscussionFeedback),
  "When local feedback reflow succeeds, Agent copy must present the draft as ready instead of framing AI optimization failure as the main result.",
  failures,
);
check(
  /extractRequestedShotCount\(stripTargetShotOrdinalMentions\(text\)\)/.test(explicitShotCount)
    && /目标镜头/.test(stripTargetShotOrdinalMentions)
    && /第\\s\*\$\{localizedShotNumberToken\}/.test(stripTargetShotOrdinalMentions),
  "NewVideoStart explicit shot-count parsing must ignore target ordinals like 第二个镜头 before reading the requested total.",
  failures,
);
check(
  /targetShotRevisionIndexForRows\(feedbackText,\s*rows,\s*selectedRowId\)/.test(applyTargetedShotRevisionRows)
    && /最后\|末尾\|结尾\|最终/.test(targetShotRevisionIndex)
    && /那\|这\|那一\|这一\|一/.test(targetShotRevisionIndex)
    && /镜头\|分镜\|视频段\|片段\|段落\|幕\|镜/.test(targetShotRevisionIndex)
    && /return rowCount - 1/.test(targetShotRevisionIndex)
    && /function tailEndingRevisionClause\(text: string\)/.test(newVideoStartSource)
    && /停在\|停到\|落在\|收在\|结束在\|定格在/.test(newVideoStartSource)
    && /tailEndingRevisionClause\(cleaned\)/.test(targetShotRevisionIndex)
    && /function feedbackTargetsTailShot\(text: string\)/.test(newVideoStartSource)
    && /Boolean\(tailEndingRevisionClause\(text\)\)/.test(newVideoStartSource)
    && /function feedbackTargetsSelectedDraftShot\(text: string\)/.test(newVideoStartSource)
    && /这个\(\?!\\s\*\(\?:故事\|草案\|项目\|短片\|视频\)\)/.test(newVideoStartSource)
    && /function selectedDraftShotIndex\(rows: NewVideoStoryboardShot\[\],\s*selectedRowId\?: string\)/.test(newVideoStartSource)
    && /function targetShotRevisionIndexForRows\(text: string,\s*rows: NewVideoStoryboardShot\[\],\s*selectedRowId\?: string\)/.test(newVideoStartSource)
    && /const selectedIndex = feedbackTargetsSelectedDraftShot\(text\) \? selectedDraftShotIndex\(rows,\s*selectedRowId\) : undefined/.test(targetShotRevisionIndexForRows)
    && /excludedPropLabelsFromFeedback\(text\)/.test(targetShotRevisionIndexForRows)
    && /feedbackTargetsTailShot\(text\)/.test(targetShotRevisionIndexForRows)
    && /rowText\.includes\(label\)/.test(targetShotRevisionIndexForRows)
    && /targetShotPattern/.test(cleanTargetShotRevisionText)
    && /selectedTargetPrefixPattern/.test(cleanTargetShotRevisionText)
    && /sceneOnlyControlPattern/.test(cleanTargetShotRevisionText)
    && /只改场景不要改动作\|只改场景/.test(cleanTargetShotRevisionText)
    && /放到\|放在\|移到\|移至\|挪到/.test(cleanTargetShotRevisionText)
    && /换到\|换至/.test(cleanTargetShotRevisionText)
    && /replace\(\/\^\(\?:改到\|改为\|改成/.test(cleanTargetShotRevisionText)
    && /const withoutSafetyClauses = stripDraftRevisionPromptPrefix\(tailEndingRevisionClause\(text\) \|\| text\)[\s\S]*replace\(safetyClausePattern,\s*" "\)[\s\S]*stripDirectorAgentPermissionControlPhrases\(withoutSafetyClauses\)/.test(cleanTargetShotRevisionText)
    && /leftoverVideoSubmitPattern/.test(cleanTargetShotRevisionText)
    && /contentRemovalPattern/.test(cleanTargetShotRevisionText)
    && /stripDraftRevisionPromptPrefix\(tailEndingRevisionClause\(text\) \|\| text\)/.test(cleanTargetShotRevisionText)
    && /\(\?:只\)\?\(\?:保留\|留下\|留下来\)/.test(cleanTargetShotRevisionText)
    && /\^\\s\*\(\?:改得\|改得更/.test(cleanTargetShotRevisionText)
    && /月亮/.test(excludedPropLabelsFromFeedback)
    && /怀表/.test(excludedPropLabelsFromFeedback)
    && /negativeClauses/.test(excludedPropLabelsFromFeedback)
    && /function removeExcludedLabelsFromText\(text: string,\s*excludedLabels: string\[\]\)/.test(newVideoStartSource)
    && /function textMentionsExcludedProps\(text: string,\s*excludedProps: string\[\]\)/.test(newVideoStartSource)
    && /cleanText\(stripShotCountPlanningInstructions\(cleanTargetShotRevisionText\(feedbackText\)\)/.test(applyTargetedShotRevisionRows)
    && /\[：:，,。；;\\s\]\+/.test(applyTargetedShotRevisionRows)
    && /excludedPropLabelsFromFeedback\(feedbackText\)/.test(applyTargetedShotRevisionRows)
    && /const removalRequest = Boolean\(excludedProps\.length\)[\s\S]*不要\|别\|不\|不用\|去掉\|移除\|删掉\|删除\|不要再提/.test(applyTargetedShotRevisionRows)
    && /const scene = removalRequest \? "" : sceneFromShotText\(revisionText,\s*sceneLabels,\s*index\)/.test(applyTargetedShotRevisionRows)
    && /sceneFromShotText\(revisionText,\s*sceneLabels,\s*index\)/.test(applyTargetedShotRevisionRows)
    && /sceneOnlyStoryboardSegment\(cleanedRevisionText\)/.test(applyTargetedShotRevisionRows)
    && /cleanedRevisionText === scene/.test(applyTargetedShotRevisionRows)
    && /removalOnlyRevision/.test(applyTargetedShotRevisionRows)
    && /removeExcludedLabelsFromText\(row\.visualDescription \|\| primaryAction \|\| row\.title,\s*excludedProps\)/.test(applyTargetedShotRevisionRows)
    && /场景改到\$\{scene\}/.test(applyTargetedShotRevisionRows)
    && /scene:\s*scene \|\| row\.scene/.test(applyTargetedShotRevisionRows)
    && /const actionTrigger = textMentionsExcludedProps\(row\.actionTrigger,\s*excludedProps\)[\s\S]*fallbackActionTrigger/.test(applyTargetedShotRevisionRows)
    && /const microReaction = textMentionsExcludedProps\(row\.microReaction,\s*excludedProps\)[\s\S]*fallbackMicroReaction/.test(applyTargetedShotRevisionRows)
    && /actionReactionQa:\s*buildActionReactionQa\(\{[\s\S]*primaryAction[\s\S]*actionTrigger[\s\S]*microReaction/.test(applyTargetedShotRevisionRows)
    && /rhythmReason:\s*textMentionsExcludedProps\(row\.rhythmReason,\s*excludedProps\)/.test(applyTargetedShotRevisionRows)
    && /propsFromShotText\(revisionText,\s*fallbackProps\)/.test(applyTargetedShotRevisionRows)
    && /props:\s*propLabels\.join\("、"\) \|\| "无"/.test(applyTargetedShotRevisionRows)
    && /primaryAction/.test(applyTargetedShotRevisionRows)
    && /const multiTargetedFeedbackStoryboardRows = \(!requestedFeedbackShotCount \|\| requestedFeedbackShotCount === storyboardRows\.length\)[\s\S]*applyMultiTargetedShotRevisionRows\(storyboardRows,\s*feedbackText\)/.test(sendDiscussionFeedback)
    && /const targetedFeedbackStoryboardRows = !multiTargetedFeedbackStoryboardRows[\s\S]*applyTargetedShotRevisionRows\(storyboardRows,\s*feedbackText,\s*selectedFeedbackStoryboardRowId\)/.test(sendDiscussionFeedback)
    && /const explicitFeedbackStoryboardRows = multiTargetedFeedbackStoryboardRows \|\| targetedFeedbackStoryboardRows \? undefined : requestedFeedbackShotCount/.test(sendDiscussionFeedback)
    && /multiTargetedFeedbackStoryboardRows[\s\S]*targetedFeedbackStoryboardRows[\s\S]*explicitFeedbackStoryboardRows[\s\S]*\|\| requestedFeedbackShotCount/.test(sendDiscussionFeedback)
    && /if \(multiTargetedFeedbackStoryboardRows\) return multiTargetedFeedbackStoryboardRows/.test(sendDiscussionFeedback)
    && /if \(targetedFeedbackStoryboardRows\) return targetedFeedbackStoryboardRows/.test(sendDiscussionFeedback),
  "Targeted feedback such as '把第二个镜头改成海浪', '结尾那镜不要月亮', or selected-shot '这个镜头只改场景不要改动作' must patch only the relevant row, keep order, and honor content exclusions instead of becoming a full reflow.",
  failures,
);
check(
  /targetShotRevisionIndexForRows\(feedbackText,\s*fallbackRows\.length \? fallbackRows : rows,\s*selectedRowId\)/.test(applyTargetedFeedbackGuardsToAiRows)
    && /excludedPropLabelsFromFeedback\(feedbackText\)/.test(applyTargetedFeedbackGuardsToAiRows)
    && /row\.title[\s\S]*row\.visualDescription[\s\S]*row\.primaryAction[\s\S]*row\.actionTrigger[\s\S]*row\.microReaction[\s\S]*row\.props[\s\S]*row\.actionBeats/.test(applyTargetedFeedbackGuardsToAiRows)
    && /const violatesExcludedProps = excludedProps\.some\(\(label\) => rowText\.includes\(label\)\)/.test(applyTargetedFeedbackGuardsToAiRows)
    && /return \{[\s\S]*\.\.\.fallback[\s\S]*id:\s*row\.id \|\| fallback\.id[\s\S]*shotNo:\s*row\.shotNo \|\| fallback\.shotNo/.test(applyTargetedFeedbackGuardsToAiRows)
    && /const aiRows = applyTargetedFeedbackGuardsToAiRows\([\s\S]*buildStoryboardRowsFromAiPlan\(aiPlan,\s*rowsForFeedbackPlanning\)[\s\S]*feedbackText[\s\S]*rowsForFeedbackPlanning[\s\S]*selectedFeedbackStoryboardRowId[\s\S]*\)/.test(sendDiscussionFeedback),
  "Late AI storyboard optimization must not reintroduce props or story details that targeted feedback explicitly excluded.",
  failures,
);
check(
  /function targetedShotRevisionSummary\(rows: NewVideoStoryboardShot\[\], feedbackText: string,\s*selectedRowId\?: string\)/.test(newVideoStartSource)
    && /targetShotRevisionIndexForRows\(feedbackText,\s*rows,\s*selectedRowId\)/.test(targetedShotRevisionSummary)
    && /cleanTargetShotRevisionText\(feedbackText\)/.test(targetedShotRevisionSummary)
    && /function protectedShotActionFromFeedback[\s\S]*保留\|保持\|留下\|留下来[\s\S]*用\|把\|将\|让[\s\S]*动作/.test(newVideoStartSource)
    && /function revisionTextWithProtectedAction[\s\S]*currentAction\.includes\(protectedAction\)[\s\S]*currentAction && !revisionText\.includes\(currentAction\)/.test(newVideoStartSource)
    && /const protectedAction = protectedShotActionFromFeedback\(feedbackText\)[\s\S]*revisionTextWithProtectedAction\(rawRevisionText, cleanText\(row\.primaryAction\), protectedAction\)/.test(applyTargetedShotRevisionRows)
    && /const primaryAction = sceneOnlyRevision[\s\S]*protectedAction[\s\S]*\? revisionText[\s\S]*primaryActionFromText\(revisionText\)/.test(applyTargetedShotRevisionRows)
    && /revisionTextWithProtectedAction\([\s\S]*cleanText\(rows\[targetIndex\]\?\.primaryAction\)[\s\S]*protectedShotActionFromFeedback\(feedbackText\)/.test(targetedShotRevisionSummary)
    && /const scene = removalRequest \|\| !feedbackExplicitlyRequestsSceneRevision\(feedbackText,\s*revisionText\)[\s\S]*sceneFromShotText\(revisionText,\s*sceneLabels,\s*targetIndex\)/.test(targetedShotRevisionSummary)
    && /targetLabel = `第 \$\{targetIndex \+ 1\} 镜`/.test(targetedShotRevisionSummary)
    && /changeLabel = preserveTargetShot[\s\S]*保留原镜头[\s\S]*scene[\s\S]*场景改到\$\{scene\}/.test(targetedShotRevisionSummary)
    && /feedbackRequestsPreserveShotAction\(feedbackText\)/.test(targetedShotRevisionSummary)
    && /保留原动作/.test(targetedShotRevisionSummary)
    && /removalChangeLabel[\s\S]*去掉\$\{excludedProps\.join\("、"\)\}/.test(targetedShotRevisionSummary)
    && /doneLabel: `已修改\$\{targetLabel\}：\$\{changeLabel\}`/.test(targetedShotRevisionSummary)
    && /const targetedFeedbackSummary = multiTargetedFeedbackStoryboardRows[\s\S]*multiTargetedShotRevisionSummary\(storyboardRows,\s*feedbackText\)[\s\S]*targetedFeedbackStoryboardRows[\s\S]*targetedShotRevisionSummary\(storyboardRows,\s*feedbackText,\s*selectedFeedbackStoryboardRowId\)/.test(sendDiscussionFeedback)
    && /understandingBody:\s*targetedFeedbackSummary\?\.intentBody/.test(sendDiscussionFeedback)
    && /assistantBody:\s*targetedFeedbackSummary[\s\S]*targetedFeedbackSummary\.doneLabel/.test(sendDiscussionFeedback)
    && /localFeedbackReadyMessage = feedbackLocalStoryboardRows\.length[\s\S]*targetedFeedbackSummary[\s\S]*targetedFeedbackSummary\.doneLabel/.test(sendDiscussionFeedback),
  "Target-shot feedback such as '第 2 镜换到地铁口' must produce specific post-send Agent copy instead of saying it reflowed the whole draft.",
  failures,
);
check(
  !/\[\/天空\|航拍\|山顶方向\/u, "山路上空"\]/.test(newVideoStartSource)
    && /山路\|弯道\|发卡弯\|护栏[\s\S]*天空[\s\S]*山路上空/.test(newVideoStartSource),
  "A generic sky reflection must not be misclassified as a mountain-road aerial scene.",
  failures,
);
check(
  /matchAll\(markerPattern\)/.test(explicitMultiTargetShotRevisionClauses)
    && /start === 0 \|\| [^\n]*\.test\(cleaned\[start - 1\]/.test(explicitMultiTargetShotRevisionClauses)
    && /new Set\(markers\.map\(\(marker\) => marker\.targetIndex\)\)\.size < 2/.test(explicitMultiTargetShotRevisionClauses)
    && /applyTargetedShotRevisionRows\(nextRows,\s*clause\.text\)/.test(applyMultiTargetedShotRevisionRows)
    && /feedbackExplicitlyRequestsSceneRevision/.test(targetedShotRevisionSummary)
    && /场景\|地点\|环境/.test(feedbackExplicitlyRequestsSceneRevision)
    && /summaries\.map\(\(summary\) => `\$\{summary\.targetLabel\}：\$\{summary\.changeLabel\}`\)/.test(multiTargetedShotRevisionSummary)
    && /不会把后一个镜头的要求写进前一个镜头/.test(multiTargetedShotRevisionSummary)
    && /workflowControlClausePattern/.test(cleanTargetShotRevisionText)
    && /repetitionControlPattern/.test(cleanTargetShotRevisionText)
    && /(?:只在\|在)/.test(explicitMultiTargetShotRevisionClauses)
    && /保留\|保持\|留下/.test(explicitMultiTargetShotRevisionClauses)
    && /index === 0 \? 0 : marker\.start/.test(explicitMultiTargetShotRevisionClauses)
    && /feedbackOnlyPreservesTargetShot/.test(applyTargetedShotRevisionRows),
  "Explicit multi-shot feedback must isolate each target clause, suppress workflow/repetition controls, and report every changed shot without inventing a scene move.",
  failures,
);
check(
  /function shotCountRevisionSummary\(requestedShotCount\?: number\)/.test(newVideoStartSource)
    && /doneLabel: `已重排为 \$\{countLabel\}`/.test(shotCountRevisionSummary)
    && /intentBody: `你要把当前草案重排为 \$\{countLabel\}/.test(shotCountRevisionSummary)
    && /progressBody: `我会把当前草案重排为 \$\{countLabel\}/.test(shotCountRevisionSummary)
    && /readyBody: `我已按你的要求重排为 \$\{countLabel\}/.test(shotCountRevisionSummary)
    && /const shotCountFeedbackSummary = targetedFeedbackSummary[\s\S]*shotCountRevisionSummary\(requestedFeedbackShotCount\)/.test(sendDiscussionFeedback)
    && /understandingBody:\s*targetedFeedbackSummary\?\.intentBody[\s\S]*shotCountFeedbackSummary\?\.intentBody[\s\S]*按这条修改意见重排当前草案/.test(sendDiscussionFeedback)
    && /assistantBody:\s*targetedFeedbackSummary[\s\S]*shotCountFeedbackSummary\?\.progressBody[\s\S]*按这条反馈更新当前草案/.test(sendDiscussionFeedback)
    && /understandingBody:\s*targetedFeedbackSummary\?\.readyBody[\s\S]*shotCountFeedbackSummary\?\.readyBody[\s\S]*已经先按这个结构整理出可确认草案/.test(sendDiscussionFeedback)
    && /localFeedbackReadyMessage = feedbackLocalStoryboardRows\.length[\s\S]*shotCountFeedbackSummary[\s\S]*shotCountFeedbackSummary\.doneLabel/.test(sendDiscussionFeedback),
  "Shot-count feedback such as '改成 3 个镜头' must produce concrete post-send Agent copy instead of falling back to generic '按这条修改意见'.",
  failures,
);
check(
  /explicitShotCount\(text\)/.test(feedbackShouldPreserveCurrentDraftScript)
    && /enumeratedShotSegments\(text\)\.length <= 1/.test(feedbackShouldPreserveCurrentDraftScript)
    && /mostlyPlanningInstruction\(text\)/.test(feedbackShouldPreserveCurrentDraftScript)
    && /cleanText\(draft\.script\)[\s\S]*rows\.map\(\(row\) => cleanText\(row\.primaryAction \|\| row\.visualDescription \|\| row\.title\)\)/.test(currentDraftScriptForFeedback)
    && /拆成\|分成\|分为\|切成\|规划成\|做成\|改成\|调整成\|换成\|整理成\|整理为\|重排成\|重排为/.test(stripShotCountPlanningInstructions)
    && /const preserveCurrentDraftScript = feedbackShouldPreserveCurrentDraftScript\(feedbackText\)/.test(sendDiscussionFeedback)
    && /const currentFeedbackScript = currentDraftScriptForFeedback\(planningDraft,\s*storyboardRows\)/.test(sendDiscussionFeedback)
    && /const feedbackScript = preserveCurrentDraftScript[\s\S]*stripShotCountPlanningInstructions\(currentFeedbackScript\) \|\| currentFeedbackScript \|\| feedbackText[\s\S]*: feedbackText/.test(sendDiscussionFeedback)
    && /const baseFeedbackStyle = stripShotCountPlanningInstructions\(planningDraft\.style\)/.test(sendDiscussionFeedback)
    && /standaloneShotCountPattern[\s\S]*replace\(standaloneShotCountPattern,\s*" "\)/.test(stripShotCountPlanningInstructions)
    && /stripShotCountPlanningInstructions\(currentFeedbackScript\) \|\| currentFeedbackScript \|\| feedbackText/.test(sendDiscussionFeedback)
    && /script:\s*feedbackScript/.test(sendDiscussionFeedback)
    && /preserveCurrentDraftScript \? `修改要求：\$\{feedbackText\}` : baseFeedbackStyle/.test(sendDiscussionFeedback)
    && /preserveCurrentDraftScript \? baseFeedbackStyle : planningDraft\.script/.test(sendDiscussionFeedback),
  "Shot-count-only feedback such as '把整个故事改成 2 个镜头' must preserve the current story text instead of treating the instruction as the new script.",
  failures,
);
check(
  /先\|再\|然后\|接着\|随后\|最后/.test(sequenceCueStoryboardCandidates)
    && /把\|做成\|改成\|调整成\|换成\|整理成\|整理为\|重排成\|重排为/.test(mostlyPlanningInstruction)
    && /splitCreativePlanningText\(text\)/.test(storyboardStoryText)
    && /const storyText = storyboardStoryText\(scriptText\)/.test(scriptSegments)
    && /transformingPropStoryboardCandidates\(source\)/.test(localStoryboardBeatCandidates)
    && /locationListStoryboardCandidates\(source\)/.test(localStoryboardBeatCandidates)
    && /storyboardLocationLabelPattern/.test(locationListStoryboardCandidates)
    && /天台/.test(newVideoStartSource)
    && /地铁/.test(newVideoStartSource)
    && /便利店/.test(newVideoStartSource)
    && /各自\|分别\|同时/.test(locationListStoryboardCandidates)
    && /听到\|听见\|看到\|看见\|收到\|发现/.test(locationListStoryboardCandidates)
    && /车票\|电影票\|票根\|门票/.test(transformingPropStoryboardCandidates)
    && /变成\|变为\|化成\|变作/.test(transformingPropStoryboardCandidates)
    && /看着\$\{propDetail\}开始慢慢变化/.test(transformingPropStoryboardCandidates)
    && /海边\|海岸\|沙滩\|海面/.test(newVideoStartSource)
    && /const sequenceCues = sequenceCueStoryboardCandidates\(scriptText\)[\s\S]*explicitShotCount\(scriptText\)[\s\S]*sequenceCues\.length >= 2[\s\S]*return sequenceCues/.test(scriptSegments)
    && /const focusedCandidates = explicitShotCount\(scriptText\) \? focusedStoryboardBeatCandidates\(storyText\) : \[\]/.test(scriptSegments)
    && /focusedCandidates\.length >= 2[\s\S]*return focusedCandidates/.test(scriptSegments)
    && /localStoryboardBeatCandidates\(scriptText\)/.test(focusedStoryboardBeatCandidates)
    && /candidate\.includes\(other\)/.test(focusedStoryboardBeatCandidates)
    && /const focusedCandidates = focusedStoryboardBeatCandidates\(draft\.script\)/.test(expandScriptRowsToRequestedCount)
    && /rows\.length <= 1 && focusedCandidates\.length >= requestedCount/.test(expandScriptRowsToRequestedCount)
    && /requested_focused_segment/.test(expandScriptRowsToRequestedCount)
    && /const sequenceCueMatches = sequenceCueStoryboardCandidates\(source\)/.test(localStoryboardBeatCandidates)
    && /normalizeStoryboardSourceRowsToRequestedCount\(sourceRowsBeforeRequestedCount,\s*draft\)/.test(newVideoStartSource)
    && /const requestedCount = explicitShotCount\(`\$\{draft\.script\}\\n\$\{draft\.style\}`\)/.test(normalizeStoryboardSourceRowsToRequestedCount)
    && /rows\.length > requestedCount[\s\S]*mergeOverflowStoryboardRowsToRequestedCount\(rows,\s*requestedCount\)/.test(normalizeStoryboardSourceRowsToRequestedCount)
    && /rows\.slice\(requestedCount\)/.test(mergeOverflowStoryboardRowsToRequestedCount)
    && /tailSegments/.test(mergeOverflowStoryboardRowsToRequestedCount)
    && /text:\s*mergedText \|\| lastRow\.text/.test(mergeOverflowStoryboardRowsToRequestedCount)
    && /rows\.length === requestedCount[\s\S]*mergeMissingStoryboardCandidatesIntoRequestedRows\(rows,\s*draft,\s*requestedCount\)/.test(normalizeStoryboardSourceRowsToRequestedCount)
    && /localStoryboardBeatCandidates\(draft\.script\)/.test(mergeMissingStoryboardCandidatesIntoRequestedRows)
    && /requested_missing_segment/.test(mergeMissingStoryboardCandidatesIntoRequestedRows)
    && /mergeOverflowStoryboardRowsToRequestedCount\(\[[\s\S]*\.\.\.rows[\s\S]*\.\.\.missingCandidates/.test(mergeMissingStoryboardCandidatesIntoRequestedRows)
    && /while \(nextRows\.length < requestedCount\)/.test(normalizeStoryboardSourceRowsToRequestedCount),
  "Explicit feedback like 'change to 5 shots' must force the local draft row count to the requested count while preserving overflow story beats in the last shot.",
  failures,
);
check(
  /交给/.test(localStoryboardBeatCandidates)
    && /\[\^，,。；;!\?！？\]\{0,24\}\(\?:发现\|看见/.test(localStoryboardBeatCandidates)
    && /sceneOnlyStoryboardSegment/.test(newVideoStartSource)
    && /actionableCandidates/.test(focusedStoryboardBeatCandidates)
    && /actionableCandidates\.length >= 2 \? actionableCandidates : candidates/.test(focusedStoryboardBeatCandidates)
    && /清晨\|凌晨\|黄昏/.test(sceneOnlyStoryboardSegment)
    && /天桥/.test(sceneOnlyStoryboardSegment)
    && /天台/.test(sceneOnlyStoryboardSegment)
    && /公交站/.test(sceneOnlyStoryboardSegment)
    && /便利店/.test(sceneOnlyStoryboardSegment),
  "Explicit 2-shot local drafts must not waste a shot on a pure scene prefix such as 清晨天桥上 when actionable beats are available.",
  failures,
);
check(
  /天桥/.test(sceneFromShotText)
    && /深夜\.\{0,8\}图书馆\|图书馆\.\{0,8\}深夜/.test(sceneFromShotText)
    && /书架\|书页/.test(sceneFromShotText)
    && /海边\|海面\|沙滩/.test(sceneFromShotText)
    && !/海边\|海面\|海浪\|沙滩/.test(sceneFromShotText),
  "Scene inference must not classify result imagery such as 广告牌变成海浪 as a 海边 scene.",
  failures,
);
check(
  /function localSceneLabelsFromText/.test(newVideoStartSource)
    && /深夜\.\{0,8\}图书馆\|图书馆\.\{0,8\}深夜/.test(localSceneLabelsFromText)
    && /书架\|书页/.test(localSceneLabelsFromText)
    && /天桥/.test(localSceneLabelsFromText)
    && /天台/.test(localSceneLabelsFromText)
    && /\/地铁\/u,\s*"地铁"/.test(newVideoStartSource)
    && !/\/车站\|地铁\|站台\/u,\s*"车站"/.test(newVideoStartSource)
    && /海边\|海面\|沙滩/.test(localSceneLabelsFromText)
    && !/海边\|海面\|海浪\|沙滩/.test(localSceneLabelsFromText)
    && /const sceneLabels = Array\.from\(new Set\(\[[\s\S]*localSceneLabelsFromText\(draft\.script\)[\s\S]*factsByKind\(session,\s*"scene_candidate"\)/.test(buildStoryboardRowsFromSession),
  "Global scene hints such as 清晨天桥上, 天台, and 地铁 must remain available to actionable local draft shots after pure scene prefixes are filtered out.",
  failures,
);
check(
  /localSceneLabelsFromText\(sourceText\)/.test(sceneLabelsFromStoryboardContext)
    && /rows[\s\S]*map\(\(row\) => cleanText\(row\.scene\)\)/.test(sceneLabelsFromStoryboardContext)
    && /!\/\^\(待确认\|待补\|待补充\|无\|-\)\$\/\.test\(scene\)/.test(sceneLabelsFromStoryboardContext)
    && /Array\.from\(new Set\(\[[\s\S]*\.\.\.localSceneLabelsFromText\(sourceText\)[\s\S]*\.\.\.existingSceneLabels/.test(sceneLabelsFromStoryboardContext),
  "Shot-count feedback reflow must reuse source text scene labels before inherited row scenes so multi-location stories do not collapse back to a stale default scene.",
  failures,
);
check(
  /开场建立/.test(fallbackStoryboardBeatLabel)
    && /情势推进/.test(fallbackStoryboardBeatLabel)
    && /结果收束/.test(fallbackStoryboardBeatLabel)
    && /storyboardContinuationBaseText\(sourceText\)/.test(fallbackStoryboardBeatText)
    && /延续动作/.test(storyboardContinuationBaseText)
    && /fallbackStoryboardBeatText\(source\.text,\s*nextRows\.length,\s*requestedCount\)/.test(newVideoStartSource)
    && !/text:\s*`延续动作：\$\{source\.text\}`/.test(newVideoStartSource),
  "Requested-shot-count fallback rows must use stable story beat labels and strip old continuation prefixes instead of recursively rendering 延续动作.",
  failures,
);
check(
  /if \(projection && discussionWorkspace\) \{[\s\S]*isDraftConfirmationIntent\(commandText\)[\s\S]*void confirmDraft\(\);[\s\S]*void sendDiscussionFeedback\(commandText\);[\s\S]*return;[\s\S]*const detectedBoundaryMode/.test(newVideoStartSource),
  "right-side Agent messages after a draft exists must update that draft before any new-draft planning path can run.",
  failures,
);
check(
  /type NewVideoStartAgentIntakeCommand = \{[\s\S]*mode\?: "replace_draft" \| "continue_current_draft" \| "confirm_current_draft"/.test(newVideoStartSource),
  "NewVideoStart Agent intake command must distinguish replacing text from continuing the current prepared draft.",
  failures,
);
check(
  /projectTargetMode\?:\s*"new_project" \| "current_project"/.test(newVideoStartSource)
    && /projectTargetMode:\s*agentIntakeCommand\?\.projectTargetMode/.test(newVideoStartSource),
  "Agent-started new-video drafts must carry the intended project target through planning and confirmation.",
  failures,
);
check(
  /agentIntakeCommand\?\.mode === "confirm_current_draft"[\s\S]*projection && directorSession && !confirmed[\s\S]*void confirmDraft\(\)[\s\S]*const restoredState = restoredReadyDraftConfirmationState\(\)[\s\S]*void confirmDraft\(restoredState\)[\s\S]*showNoReadyDraftNotice\("确认这版故事"\)[\s\S]*return;[\s\S]*agentIntakeCommand\?\.mode === "continue_current_draft"/.test(newVideoStartSource),
  "NewVideoStart must let the right-side Agent confirm the current or restored prepared draft without treating the confirmation label as a new idea.",
  failures,
);
check(
  /type DraftConfirmationState = \{[\s\S]*draft: NewVideoStartDraft[\s\S]*projection: IntakeStagedPlanProjection[\s\S]*directorSession: ReturnType<typeof buildDirectorSessionFromIntake>[\s\S]*storyboardRows: NewVideoStoryboardShot\[\][\s\S]*storyboardBaselineRows: NewVideoStoryboardShot\[\]/.test(newVideoStartSource)
    && /function buildDraftConfirmationState\(draftToConfirm: NewVideoStartDraft\): DraftConfirmationState[\s\S]*buildIntakeDraftFromNewVideoDraft\(planningDraft\)[\s\S]*buildIntakeStagedPlanProjection\(intakeDraft\)[\s\S]*buildDirectorSessionFromIntake\(\{ draft: intakeDraft, projection: nextProjection \}\)[\s\S]*buildStoryboardRowsFromSession\(nextSession, planningDraft, nextStyleResearchPreflight\)/.test(newVideoStartSource),
  "Restored ready-draft confirmation must rebuild the same projection, director session, and storyboard rows used by fresh planning.",
  failures,
);
check(
  /function restoredReadyDraftConfirmationState\(\)[\s\S]*entry\.type === "confirmation_request"[\s\S]*entry\.status === "waiting"[\s\S]*entry\.details\?\.intakePhase === "planning_ready"[\s\S]*entry\.details\?\.intakePhase === "draft_confirmed"[\s\S]*entry\.createdAt >= latestConfirmation\.createdAt[\s\S]*entry\.type === "user_message"[\s\S]*entry\.createdAt <= latestConfirmation\.createdAt[\s\S]*buildDraftConfirmationState/.test(newVideoStartSource),
  "Restored ready-draft confirmation must recover only the latest unconfirmed planning-ready turn from the Agent timeline.",
  failures,
);
check(
  /draftScript\?: string/.test(intakeTimelineSource)
    && /draftStyle\?: string/.test(intakeTimelineSource)
    && /projectTargetMode\?: string/.test(intakeTimelineSource)
    && /const details = intakeDetails\(input\)/.test(intakeTimelineBuilder)
    && /if \(draftScript\) details\.draftScript = draftScript/.test(intakeDetails)
    && /if \(draftStyle\) details\.draftStyle = draftStyle/.test(intakeDetails)
    && /if \(projectTargetMode\) details\.projectTargetMode = projectTargetMode/.test(intakeDetails)
    && /type:\s*"confirmation_request"[\s\S]*details:\s*\{[\s\S]*\.\.\.details[\s\S]*next:/.test(intakeTimelineBuilder),
  "Intake timeline entries must persist recoverable draft script/style/target details on planning-ready confirmation turns.",
  failures,
);
check(
  /input\.phase === "status_inspection"[\s\S]*只读取状态，不把这句话当脚本[\s\S]*input\.assistantNext \|\| assistantNext\(input\.phase\)/.test(intakeTimelineBuilder)
    && !/继续检查项目和素材/.test(intakeTimelineBuilder),
  "Intake understanding cards must point to the phase-specific next step instead of a generic material-check next step.",
  failures,
);
check(
  /const draftTimelineDetails = \{[\s\S]*draftScript:\s*draftToSubmit\.script[\s\S]*draftStyle:\s*draftToSubmit\.style[\s\S]*projectTargetMode:\s*draftToSubmit\.projectTargetMode/.test(prepareDraft)
    && /buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*"planning_started"[\s\S]*\.\.\.draftTimelineDetails/.test(prepareDraft)
    && /buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*"planning_ready"[\s\S]*\.\.\.draftTimelineDetails/.test(prepareDraft)
    && /buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*"planning_blocked"[\s\S]*\.\.\.draftTimelineDetails/.test(prepareDraft),
  "Fresh draft planning must persist the real draft details into every intake timeline state.",
  failures,
);
check(
  /const feedbackTimelineDetails = \{[\s\S]*draftScript:\s*currentDraftScriptForFeedback\(planningDraft,\s*rowsForFeedbackPlanning\) \|\| planningDraft\.script \|\| feedbackText[\s\S]*draftStyle:\s*planningDraft\.style[\s\S]*projectTargetMode:\s*planningDraft\.projectTargetMode/.test(sendDiscussionFeedback)
    && /buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*"planning_started"[\s\S]*\.\.\.feedbackTimelineDetails/.test(sendDiscussionFeedback)
    && /buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*"planning_ready"[\s\S]*\.\.\.feedbackTimelineDetails/.test(sendDiscussionFeedback)
    && /buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*feedbackLocalStoryboardRows\.length \? "planning_ready" : "planning_blocked"[\s\S]*\.\.\.feedbackTimelineDetails/.test(sendDiscussionFeedback),
  "Draft feedback planning must persist the current draft details instead of treating the feedback command as the script.",
  failures,
);
check(
  /const restoredScript = timelineDetailText\(latestConfirmation,\s*"draftScript"\)[\s\S]*\|\| restoredDraftScriptFromTimelineEntry\(userEntry\)/.test(restoredReadyDraftConfirmationState)
    && /if \(!restoredDraftScriptIsConfirmable\(restoredScript\)\) return undefined/.test(restoredReadyDraftConfirmationState)
    && /const restoredStyle = timelineDetailText\(latestConfirmation,\s*"draftStyle"\)[\s\S]*\|\| timelineDetailText\(userEntry,\s*"draftStyle"\)/.test(restoredReadyDraftConfirmationState)
    && /const restoredTargetMode = timelineDetailText\(latestConfirmation,\s*"projectTargetMode"\)[\s\S]*\|\| timelineDetailText\(userEntry,\s*"projectTargetMode"\)/.test(restoredReadyDraftConfirmationState),
  "Restored ready-draft confirmation must read draft details before falling back to visible user-message text.",
  failures,
);
check(
  /entry\.type === "confirmation_request"[\s\S]*entry\.status === "waiting"[\s\S]*entry\.details\?\.intakePhase === "planning_ready"[\s\S]*entry\.details\?\.intakePhase === "draft_confirmed"/.test(hasPendingReadyDraftTimeline)
    && /const restoredBatch = latestNewVideoAgentTimelineBatch\(restoredNewVideoAgentTimelineEntries\)[\s\S]*if \(hasPendingReadyDraftTimeline\(restoredBatch\)\) return restoredBatch[\s\S]*const hasActiveComposerState = hasDraft \|\| Boolean\(projection\) \|\| Boolean\(submittedDraft\) \|\| Boolean\(emptyProjectAgentNotice\)/.test(newVideoStartSource),
  "Restored waiting draft timelines must remain visible instead of being hidden behind the empty-project Agent notice.",
  failures,
);
check(
  /entry\?\.details\?\.\[key\]/.test(directorTimelineDetailText)
    && /const userTitle = timelineDetailText\(latestConfirmation,\s*"draftScript"\)[\s\S]*\|\| timelineDetailText\(userEntry,\s*"draftScript"\)[\s\S]*\|\| userEntry\?\.body/.test(restoredNewVideoDraftSummary),
  "DirectorMode restored draft summaries must title pending drafts from draftScript details before falling back to user-message text.",
  failures,
);
check(
  /isDraftConfirmationIntent\(scriptText\)/.test(restoredDraftScriptIsConfirmable)
    && /shouldHandleNewVideoStatusIntent\(scriptText\)/.test(restoredDraftScriptIsConfirmable)
    && /isDirectorAgentPermissionControlOnlyIntent\(scriptText\)/.test(restoredDraftScriptIsConfirmable),
  "Restored ready-draft confirmation must reject confirmation, status, and permission-control text as non-script input.",
  failures,
);
check(
  /async function confirmDraft\(override\?: DraftConfirmationState\)[\s\S]*const confirmationProjection = override\?\.projection \|\| projection[\s\S]*const confirmationDirectorSession = override\?\.directorSession \|\| directorSession[\s\S]*const confirmationDraft = override\?\.draft \|\| activeDraft[\s\S]*if \(override\) \{[\s\S]*setSubmittedDraft\(confirmationDraft\)[\s\S]*setProjection\(confirmationProjection\)[\s\S]*setDirectorSession\(confirmationDirectorSession\)[\s\S]*setStoryboardRows\(confirmationStoryboardRows\)[\s\S]*onDraftConfirmed\(confirmationDraft/.test(newVideoStartSource),
  "confirmDraft must accept restored draft state and persist that restored draft instead of requiring live React planning state.",
  failures,
);
check(
  /agentIntakeCommand\?\.mode === "continue_current_draft"[\s\S]*if \(hasDraft\) \{[\s\S]*void prepareDraft\(\);[\s\S]*\} else \{[\s\S]*showNoReadyDraftNotice\("继续整理"\)[\s\S]*\}[\s\S]*return;[\s\S]*const commandText = agentIntakeCommand\?\.text\.trim\(\)/.test(newVideoStartSource),
  "NewVideoStart must continue an already-prepared draft before reading Agent command text as a new idea.",
  failures,
);
check(
  /detectDirectorAgentPermissionIntent/.test(newVideoStartSource)
    && /const detectedMode = detectDirectorAgentPermissionIntent\(value\)/.test(syncVideoPermissionFromIntent)
    && /selectVideoPermissionMode\(detectedMode\)/.test(syncVideoPermissionFromIntent),
  "NewVideoStart must detect natural-language generation boundaries from the unified composer.",
  failures,
);
check(
  /syncVideoPermissionFromIntent\(`\$\{value\}\\n\$\{style\}`\)/.test(newVideoStartSource)
    && /syncVideoPermissionFromIntent\(`\$\{nextScript\}\\n\$\{style\}`\)/.test(newVideoStartSource)
    && /agentBoundaryMode:\s*detectedBoundaryMode \|\| activeVideoPermissionContract\.mode/.test(newVideoStartSource),
  "NewVideoStart must preserve detected reference/video boundaries when typing, importing, or dropping a script.",
  failures,
);
check(
  (newVideoStartSource.match(/userMessage:\s*userMessageFromNewVideoDraft\(draftToSubmit\)/g) || []).length >= 3
    && !/userMessage:\s*userMessageFromNewVideoDraft\(planningDraft\)/.test(newVideoStartSource),
  "NewVideoStart Agent timeline must display the creator's original input while using the cleaned planning draft only for planning.",
  failures,
);
check(
  /export type NewVideoStartStatus/.test(newVideoStartSource)
    && /onStatusChange\?:\s*\(status:\s*NewVideoStartStatus\)\s*=>\s*void/.test(newVideoStartSource)
    && /onStatusChange\?\.\(entryStatus\)/.test(newVideoStartSource),
  "NewVideoStart must report fresh-project planning status to the unified project status bar.",
  failures,
);
check(
  /draftShotCount\?:\s*number/.test(newVideoStartSource)
    && /draftReferenceCount\?:\s*number/.test(newVideoStartSource)
    && /draftShotCount:\s*storyboardRows\.length/.test(newVideoStartSource),
  "NewVideoStart status must include draft shot/reference counts for the top status facts.",
  failures,
);
check(
  /defaultAgentVideoSubmitContract[\s\S]*mode:\s*"plan_only"[\s\S]*videoSubmitAllowed:\s*false[\s\S]*referenceGenerationAllowed:\s*false/.test(agentPanelProjectionSource),
  "NewVideoStart must inherit a plan-only default boundary before the creator explicitly allows generation.",
  failures,
);
check(
  !/aria-label="当前工作范围"/.test(newVideoStartSource)
    && /detectDirectorAgentPermissionIntent/.test(newVideoStartSource)
    && /selectVideoPermissionMode\(detectedMode\)/.test(syncVideoPermissionFromIntent),
  "NewVideoStart must keep execution boundary control in natural-language Agent intent, not composer mode buttons.",
  failures,
);
check(
  /agentVideoSubmitContractForMode\(mode\)/.test(selectVideoPermissionMode)
    && /setLocalVideoPermissionContract\(nextContract\)/.test(selectVideoPermissionMode)
    && /onVideoPermissionContractChange\?/.test(selectVideoPermissionMode),
  "NewVideoStart execution-boundary controls must update the session contract instead of only changing copy.",
  failures,
);
check(
  /classifyDirectorAgentAction/.test(newVideoStartSource)
    && /shouldHandleNewVideoStatusIntent/.test(newVideoStartSource)
    && /inspect_project_status/.test(shouldHandleEmptyProjectStatusIntent)
    && /现在项目怎么样/.test(directorAgentActionSource)
    && /showNewVideoStatusNotice/.test(submitComposer)
    && /prepareDraft/.test(submitComposer),
  "NewVideoStart must route empty-project status/continue questions to a status notice instead of treating them as scripts.",
  failures,
);
check(
  /shouldHandleNewVideoStatusIntent\(commandText\)[\s\S]*showNewVideoStatusNotice\(commandText\)[\s\S]*return[\s\S]*if \(projection && discussionWorkspace\)/.test(newVideoStart),
  "NewVideoStart must also route Agent-side intake status questions to status inspection before preparing a draft.",
  failures,
);
check(
  /function showCurrentDraftStatusNotice[\s\S]*这里只是检查状态[\s\S]*不会把这句话当成新脚本[\s\S]*buildVibeAgentIntakeTimelineEntries/.test(newVideoStartSource)
    && /phase:\s*"status_inspection"[\s\S]*assistantBody:\s*`当前草案有/.test(newVideoStartSource),
  "NewVideoStart status inspection must report existing draft status without changing the draft.",
  failures,
);
check(
  /contextualSceneDetail/.test(newVideoStartSource)
    && /mergeContextualScene/.test(newVideoStartSource)
    && /同前/.test(newVideoStartSource)
    && /同上/.test(newVideoStartSource),
  "NewVideoStart must turn contextual scene placeholders such as 同前/同上 into self-contained confirmable scene text.",
  failures,
);
check(
  /\^\(待确认\|待补\|待补充\|无\|-\)\$/.test(cleanPlanningSummaryValue)
    && !/\|\|\s*"待确认"/.test(tableRowSummary)
    && !/\|\|\s*"待补"/.test(tableRowSummary)
    && !/\|\|\s*"无"/.test(tableRowSummary),
  "NewVideoStart prompt summaries must omit placeholder values instead of passing 待确认/待补/无 into AI planning.",
  failures,
);
check(
  /hasDriverlessCue/.test(newVideoStartSource)
    && /removeDriverlessCharacterLabels/.test(newVideoStartSource)
    && /无司机/.test(newVideoStartSource)
    && /车手/.test(newVideoStartSource),
  "NewVideoStart must prevent driverless shots from keeping a generic 车手/司机 character label.",
  failures,
);
check(
  /writeStoredNewVideoComposerDraft/.test(showEmptyProjectStatusNotice)
    && /onDraftChange\?\./.test(showEmptyProjectStatusNotice)
    && /userText/.test(showEmptyProjectStatusNotice)
    && visibleCopy.includes("当前还没有故事流")
    && visibleCopy.includes("下一步：放入脚本或一句故事想法。"),
  "NewVideoStart empty-project status handling must clear the standalone query and show a creator-facing Agent reply.",
  failures,
);
check(
  /role:\s*"user"\s*\|\s*"assistant"\s*\|\s*"tool"\s*\|\s*"confirmation"/.test(newVideoStartSource)
    && /id:\s*"tool-read-input"/.test(newVideoStartSource)
    && /id:\s*"tool-scan-materials"/.test(newVideoStartSource)
    && /id:\s*"tool-plan-next"/.test(newVideoStartSource)
    && /id:\s*"confirmation-draft"/.test(newVideoStartSource),
  "NewVideoStart must render a real Agent-like message chain: user input, tool events, assistant reply, and confirmation request.",
  failures,
);
check(
  /buildVibeAgentIntakeTimelineEntries/.test(newVideoStartSource)
    && /isVibeAgentIntakeTimelineEntry/.test(newVideoStartSource)
    && /onRememberAgentTimelineEntries\?:/.test(newVideoStartSource)
    && /restoredAgentTimelineEntries\?:/.test(newVideoStartSource),
  "NewVideoStart must use the shared Agent timeline contract instead of only local synthetic messages.",
  failures,
);
check(
  /rememberNewVideoAgentTimeline\(buildVibeAgentIntakeTimelineEntries\(\{[\s\S]*phase:\s*"planning_started"/.test(prepareDraft)
    && /phase:\s*"planning_ready"/.test(prepareDraft)
    && /phase:\s*"planning_blocked"/.test(prepareDraft)
    && /phase:\s*"draft_confirmed"/.test(confirmDraft)
    && /phase:\s*"status_inspection"/.test(showEmptyProjectStatusNotice),
  "NewVideoStart must persist intake Agent turns for planning start, ready, blocked, status inspection, and draft confirmation.",
  failures,
);
check(
  /const timelineCreatedAt = new Date\(\)\.toISOString\(\)/.test(prepareDraft)
    && /createdAt:\s*timelineCreatedAt[\s\S]*phase:\s*"planning_started"/.test(prepareDraft)
    && /createdAt:\s*timelineCreatedAt[\s\S]*phase:\s*"planning_ready"/.test(prepareDraft)
    && /createdAt:\s*timelineCreatedAt[\s\S]*phase:\s*"planning_blocked"/.test(prepareDraft)
    && /const feedbackTimelineCreatedAt = new Date\(\)\.toISOString\(\)/.test(sendDiscussionFeedback)
    && /createdAt:\s*feedbackTimelineCreatedAt[\s\S]*phase:\s*"planning_started"/.test(sendDiscussionFeedback)
    && /createdAt:\s*feedbackTimelineCreatedAt[\s\S]*phase:\s*"planning_ready"/.test(sendDiscussionFeedback)
    && /createdAt:\s*feedbackTimelineCreatedAt[\s\S]*phase:\s*feedbackLocalStoryboardRows\.length \? "planning_ready" : "planning_blocked"/.test(sendDiscussionFeedback),
  "NewVideoStart must reuse one timeline turn id when a planning turn moves from running to ready or blocked.",
  failures,
);
check(
  /createdAt:\s*timelineCreatedAt[\s\S]*phase:\s*"planning_started"[\s\S]*shotCount:\s*0/.test(prepareDraft),
  "NewVideoStart must show first-pass AI planning shots as pending instead of exposing the local rough split as a final count.",
  failures,
);
check(
  /const requestedDraftShotCount = explicitShotCount\(`\$\{draftToSubmit\.script\}\\n\$\{draftToSubmit\.style\}`\)/.test(prepareDraft)
    && /用户明确要求 \$\{requestedDraftShotCount\} 个镜头/.test(prepareDraft)
    && /requestedShotCount:\s*requestedDraftShotCount/.test(prepareDraft)
    && /const requestedFeedbackShotCount = explicitShotCount\(feedbackText\)/.test(sendDiscussionFeedback)
    && /requestedShotCount:\s*requestedFeedbackShotCount/.test(sendDiscussionFeedback),
  "NewVideoStart must pass explicit story shot-count requests into AI storyboard normalization instead of letting short-duration video-segment rules merge the draft.",
  failures,
);
check(
  /if \(storyboardPlanningStatus === "running"\) \{[\s\S]*status:\s*"planning"[\s\S]*draftShotCount:\s*storyboardRows\.length[\s\S]*draftReferenceCount/.test(newVideoStartSource),
  "NewVideoStart planning status must expose the currently staged draft shot count so outer UI and the Agent rail do not fall back to stale counts while AI is running.",
  failures,
);
check(
  /understandingBody:\s*targetedFeedbackSummary\?\.intentBody[\s\S]*\|\|\s*"你想按这条修改意见重排当前草案/.test(sendDiscussionFeedback),
  "NewVideoStart feedback turns must explicitly tell the user the Agent is revising the current draft, not starting a new project.",
  failures,
);
check(
  /visibleTimelineEntries\.map\(newVideoAgentMessageFromTimelineEntry\)/.test(newVideoStartSource)
    && /displayAgentMessages = timelineAgentMessages\.length \? timelineAgentMessages : agentMessages/.test(newVideoStartSource),
  "NewVideoStart must render persisted timeline entries before falling back to local message synthesis.",
  failures,
);
check(
  /查看项目/.test(newVideoStartSource)
    && /拆故事和镜头/.test(newVideoStartSource)
    && /说明", value: "下一步/.test(newVideoStartSource)
    && /保存故事/.test(newVideoStartSource)
    && /补参考、发视频和导出都等你再说/.test(newVideoStartSource),
  "NewVideoStart Agent thread must explain creator-facing action semantics and confirmation boundaries before generation.",
  failures,
);
check(
  /const confirmedFlowTitle = "确认后只保存故事"/.test(newVideoStartSource)
    && /const confirmedFlowDetail = activeVideoPermissionContract\.mode === "reference_allowed"[\s\S]*之后你可以让 AI 补参考，视频仍要单独确认[\s\S]*activeVideoPermissionContract\.mode === "video_allowed"[\s\S]*参考和视频都要在后续消息里再确认/.test(newVideoStartSource)
    && !/确认后先补参考|确认后进入可提交视频/.test(newVideoStartSource),
  "NewVideoStart story confirmation copy must not imply that confirming the draft generates references or submits video.",
  failures,
);
check(
  /disabled=\{!pendingDiscussionDeltaCount \|\| storyboardPlanningRunning\}/.test(newVideoStartSource)
    && /storyboardPlanningRunning \? "正在重排" : pendingDiscussionDeltaCount \? "确认修改" : "修改已确认"/.test(newVideoStartSource),
  "NewVideoStart must not show a clickable confirm-modification action while AI is still reworking the draft.",
  failures,
);
check(
  /\.new-video-agent-message\.tool[\s\S]*\.new-video-agent-message\.confirmation/.test(directorCssSource),
  "NewVideoStart Agent thread must visually distinguish tool events and confirmation requests.",
  failures,
);
check(
  /const activeVideoPermissionContract = localVideoPermissionContract/.test(newVideoStartSource),
  "NewVideoStart boundary controls must update immediately even before parent state echoes back.",
  failures,
);
check(
  !/new-video-agent-boundary-details/.test(newVideoStartSource)
    && /detectDirectorAgentPermissionIntent/.test(newVideoStartSource)
    && /syncVideoPermissionFromIntent/.test(newVideoStartSource)
    && /agentBoundaryInstruction\(draftToSubmit\.agentBoundaryMode\)/.test(prepareDraft),
  "NewVideoStart must keep execution scope in natural-language Agent intent instead of mounting mode buttons in the composer.",
  failures,
);
check(
  /agentBoundaryInstruction\(draftToSubmit\.agentBoundaryMode\)/.test(prepareDraft),
  "NewVideoStart AI planning prompt must include the selected execution boundary.",
  failures,
);
check(
  /requestDirectorAiStoryboardPlan\([\s\S]*timeoutMs:\s*150_000/.test(prepareDraft),
  "NewVideoStart AI planning must wait long enough for streaming models while still keeping a creator-facing timeout.",
  failures,
);
check(
  /function visibleCharacterLabelsFromText/.test(newVideoStartSource)
    && !/女车手\|女生/.test(newVideoStartSource)
    && /售票员/.test(newVideoStartSource)
    && /保安/.test(newVideoStartSource)
    && /放映员/.test(newVideoStartSource)
    && /text\.length > 12/.test(plausibleCharacterLabel)
    && /送给\|递给/.test(plausibleCharacterLabel)
    && /const safeFallbackLabels = fallbackLabels\.filter\(plausibleCharacterLabel\)/.test(charactersFromShotText)
    && /splitVisibleReferenceLabels\(shot\.characters\)\.filter\(plausibleCharacterLabel\)/.test(newVideoStartSource)
    && /const fallbackCharacterLabels = splitVisibleReferenceLabels\(fallback\.characters\)\.filter\(plausibleCharacterLabel\)/.test(newVideoStartSource)
    && /charactersFromShotText\(shotContext,\s*fallbackCharacterLabels\)/.test(newVideoStartSource),
  "NewVideoStart must infer visible characters from shot text, including functional roles such as 售票员, and filter overlong action fragments out of character labels.",
  failures,
);
check(
  /随身听\|Walkman/.test(newVideoStartSource)
    && /function propsFromShotText/.test(newVideoStartSource)
    && /小提琴/.test(newVideoStartSource)
    && /纸飞机/.test(newVideoStartSource)
    && /站牌/.test(newVideoStartSource)
    && /灯箱/.test(newVideoStartSource)
    && /怀表/.test(propsFromShotText)
    && /耳机/.test(propsFromShotText)
    && /广告牌/.test(propsFromShotText)
    && /旧手机/.test(propsFromShotText)
    && /玻璃罐/.test(propsFromShotText)
    && /旧纽扣\|纽扣/.test(propsFromShotText)
    && /坏掉\(\?:的\)\?收音机\|收音机/.test(propsFromShotText)
    && /红雨伞/.test(propsFromShotText)
    && /便利店招牌/.test(propsFromShotText)
    && /preferSpecificPropLabels/.test(newVideoStartSource)
    && /hasOldPhone/.test(newVideoStartSource)
    && /hasRedUmbrella/.test(newVideoStartSource)
    && /hasStoreSign/.test(newVideoStartSource)
    && /发光纸鹤\|纸鹤/.test(propsFromShotText)
    && /蓝色电动车\|电动车/.test(propsFromShotText)
    && /发光\(\?:的\)\?鸟/.test(newVideoStartSource)
    && /热豆浆\|豆浆/.test(newVideoStartSource)
    && /杯盖\.\{0,8\}发光字\|发光字\.\{0,8\}杯盖\|发光字/.test(newVideoStartSource)
    && /书页\|旧书\|书本/.test(propsFromShotText)
    && /书架/.test(propsFromShotText)
    && /const propLabels = Array\.from\(new Set\(\[[\s\S]*propsFromShotText\(draft\.script,\s*\[\]\)[\s\S]*factsByKind\(session,\s*"prop_candidate"\)/.test(buildStoryboardRowsFromSession)
    && /referenceAssetCandidates\(fallbackLabels\.filter/.test(newVideoStartSource),
  "NewVideoStart must infer visible props such as 随身听, 小提琴, 纸飞机, 旧手机, 红雨伞, 便利店招牌, 发光纸鹤, 蓝色电动车, 灯箱, 发光鸟, 热豆浆, 发光字, 书页, and 书架 from shot text, keep specific labels over generic ones, and seed local storyboard props from the full draft before falling back to generic reference candidates.",
  failures,
);
check(
  !/导演前置：/.test(visualDescriptionFromText),
  "NewVideoStart default shot descriptions must not expose internal director preface copy in the visible storyboard.",
  failures,
);
check(
  /resultTail/.test(primaryActionFromText)
    && /交给/.test(primaryActionFromText)
    && /听到\|听见\|看到\|看见\|收到\|发现/.test(primaryActionFromText)
    && /发光\|亮起\|变成\|变为\|显现\|浮现/.test(primaryActionFromText)
    && /`\$\{action\}，\$\{resultTail\}`/.test(primaryActionFromText),
  "NewVideoStart primary action extraction must keep the leading location action while preserving result beats when overflow story beats are merged into the final requested shot.",
  failures,
);
check(
  /fallback\.visualDescription/.test(aiShotToStoryboardRow)
    && /fallback\.props/.test(aiShotToStoryboardRow)
    && /const mergedPropLabels = Array\.from\(new Set\(\[\.\.\.cleanedPropLabels,\s*\.\.\.contextPropLabels\]\)\)/.test(aiShotToStoryboardRow)
    && /const props = mergedPropLabels\.join\("、"\)/.test(aiShotToStoryboardRow),
  "NewVideoStart must merge AI-reported props with fallback shot context so reflowed drafts keep multiple user-specified props.",
  failures,
);
check(
  /雨夜\.\{0,8\}便利店\.\{0,4\}门口/.test(newVideoStartSource)
    && /机器人保安/.test(newVideoStartSource)
    && /!\s*\/机器人保安\|保安机器人/.test(newVideoStartSource),
  "NewVideoStart must keep rainy convenience-store doorway and robot guard as stable scene/character labels.",
  failures,
);
check(
  /黄昏\.\{0,8\}洗衣店\|洗衣店\.\{0,8\}黄昏/.test(newVideoStartSource)
    && /无人洗衣店/.test(newVideoStartSource)
    && /雨夜\.\{0,8\}公交站\|公交站\.\{0,8\}雨夜/.test(newVideoStartSource)
    && /凌晨\.\{0,8\}玻璃电梯\|玻璃电梯\.\{0,8\}凌晨/.test(newVideoStartSource)
    && /\/站牌\/u,\s*"公交站"/.test(newVideoStartSource)
    && /玻璃电梯/.test(sceneFromShotText)
    && /地铁口/.test(sceneFromShotText)
    && /便利店外/.test(sceneFromShotText)
    && /图书馆/.test(sceneFromShotText)
    && /function sceneFromShotText/.test(newVideoStartSource),
  "NewVideoStart must infer settings such as 黄昏洗衣店, 无人洗衣店, 深夜图书馆, 凌晨玻璃电梯, and 雨夜公交站 instead of leaving scenes pending.",
  failures,
);
check(
  /地下\.\{0,8\}停车场\|停车场\.\{0,8\}地下/.test(newVideoStartSource)
    && /山顶\.\{0,8\}停车场\|停车场\.\{0,8\}山顶/.test(newVideoStartSource)
    && /const inheritedScene = contextualScene === "停车场" && specificParkingScene \? specificParkingScene : contextualScene/.test(sceneFromShotText)
    && /labels\.some\(\(label\) => \/\(\?:地下\|雨后\|山顶\)停车场\/u\.test\(label\)\)/.test(newVideoStartSource)
    && !/\/山顶\|停车场\/u,\s*"山顶停车场"/.test(newVideoStartSource),
  "NewVideoStart must preserve specific parking-lot settings such as 地下停车场 instead of mapping every 停车场 to 山顶停车场.",
  failures,
);
check(
  /let previousScene = ""/.test(buildStoryboardRowsFromSession)
    && /sceneLabels:\s*previousScene \? \[previousScene,\s*\.\.\.sceneLabels\] : sceneLabels/.test(buildStoryboardRowsFromSession)
    && /previousScene = storyboardRow\.scene/.test(buildStoryboardRowsFromSession)
    && /mergeContextualScene\(\s*previousScene,\s*inheritedScene/.test(sceneFromShotText),
  "NewVideoStart local storyboard rows must inherit the previous recognized scene for continuation beats that omit the setting.",
  failures,
);
check(
  /const showStoryboardRows = storyboardRows\.length > 0 && !storyboardPlanningRunning/.test(newVideoStartSource),
  "NewVideoStart must hide rough local storyboard rows while AI planning is still optimizing, so users only review the final draft.",
  failures,
);
check(
  /const storyboardCandidateAssets = useMemo\(\(\) => \{[\s\S]*flatMap\(splitVisibleReferenceLabels\)[\s\S]*characters:\s*visibleLabels\(storyboardRows\.map\(\(row\) => row\.characters\)\)[\s\S]*scenes:\s*visibleLabels\(storyboardRows\.map\(\(row\) => row\.scene\)\)[\s\S]*props:\s*visibleLabels\(storyboardRows\.map\(\(row\) => row\.props\)\)/.test(newVideoStartSource)
    && /className="new-video-storyboard-assets"[\s\S]*aria-label="素材候选"[\s\S]*角色[\s\S]*场景[\s\S]*道具[\s\S]*可在“更多镜头细节”里修改；确认前不会锁定参考/.test(newVideoStartSource),
  "NewVideoStart must surface draft character, scene, and prop candidates as editable material candidates before confirmation.",
  failures,
);
check(
  /storyboardPlanningRowsLabel\(storyboardRows\.length,\s*storyboardPlanningRunning\)/.test(newVideoStartSource),
  "NewVideoStart must still label rows through the shared storyboard label helper once the final draft is visible.",
  failures,
);
check(
  /\.new-video-style-preflight:not\(\[open\]\) \.new-video-style-preflight-body\s*\{[\s\S]*display:\s*none/.test(directorCssSource),
  "NewVideoStart style-research details must not expose disabled search buttons while collapsed.",
  failures,
);
check(
  /const showStylePreflight = Boolean\(styleResearchPreflight\)[\s\S]*styleResearchStatus !== "idle"[\s\S]*Boolean\(styleResearchResult\)[\s\S]*styleReferenceStatus === "saved"/.test(newVideoStartSource)
    && /\{showStylePreflight && styleResearchPreflight && \(/.test(newVideoStartSource),
  "NewVideoStart must not show the style-research branch as a constant default action before research is actually used.",
  failures,
);
check(
  /\.new-video-discussion:not\(\[open\]\) > :not\(summary\)[\s\S]*\.new-video-plan-details:not\(\[open\]\) > :not\(summary\)[\s\S]*display:\s*none/.test(directorCssSource),
  "NewVideoStart collapsed discussion and detail sections must not expose internal planning controls outside the Agent rail.",
  failures,
);
check(
  /\.new-video-storyboard-actions\s*\{[\s\S]*display:\s*none/.test(directorCssSource),
  "NewVideoStart storyboard row edit buttons must stay out of the default reading surface.",
  failures,
);
check(
  !/ensureLocalProjectForDraft/.test(newVideoStartSource)
    && /当前还没选择保存位置/.test(newVideoStartSource)
    && /确认后再选择保存位置/.test(newVideoStartSource),
  "NewVideoStart must let AI planning run before asking for a save location.",
  failures,
);
check(
  /aria-label="添加脚本、图片或声音"/.test(newVideoStartSource)
    && /aria-label=\{composerPrimaryAriaLabel\}/.test(newVideoStartSource),
  "NewVideoStart composer controls must expose explicit accessible action labels.",
  failures,
);
check(
  /onClick=\{composerConfirmsDraft \? \(\) => \{ void confirmDraft\(\); \} : submitComposer\}/.test(newVideoStartSource)
    && /composerConcreteActionLabel[\s\S]*"确认这版故事"/.test(newVideoStartSource)
    && /composerPrimaryLabel[\s\S]*composerConfirmsDraft[\s\S]*\? "确认"/.test(newVideoStartSource)
    && /composerPrimaryAriaLabel[\s\S]*`确认：\$\{composerConcreteActionLabel\}`/.test(newVideoStartSource),
  "NewVideoStart primary action must use a generic confirm button while preserving the concrete draft action in accessible copy.",
  failures,
);
check(
  /function isDraftConfirmationIntent/.test(newVideoStartSource)
    && /isDraftConfirmationIntent\(discussionFeedback\)/.test(newVideoStartSource)
    && /void confirmDraft\(\)/.test(newVideoStartSource)
    && /草案没问题就确认，或直接说“没问题，继续”/.test(newVideoStartSource),
  "NewVideoStart must let users confirm a ready draft by typing a natural-language next-step intent.",
  failures,
);
check(
  /planSummaryActionHint[\s\S]*storyboardPlanningStatus === "running"[\s\S]*"草案出来后可确认"[\s\S]*"确认这版故事"/.test(newVideoStartSource)
    && /new-video-next-hint[\s\S]*planSummaryActionHint/.test(newVideoStartSource)
    && !/继续确认进故事流/.test(newVideoStartSource)
    && /故事已确认/.test(newVideoStartSource),
  "NewVideoStart draft confirmation hint must wait during planning and use a concrete action only when ready.",
  failures,
);
check(
  /draft\.agentBoundaryMode[\s\S]*agentVideoPermissionForMode\(draft\.agentBoundaryMode\)/.test(confirmNewVideoDraft)
    && /onVideoPermissionContractChange=\{setVideoPermissionContract\}/.test(directorModeSource),
  "DirectorModeShell must preserve the new-video execution boundary after draft confirmation.",
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
  /confirmationDiscussionWorkspace\?\.stagedDeltas[\s\S]*status === "staged"/.test(confirmDraft)
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
