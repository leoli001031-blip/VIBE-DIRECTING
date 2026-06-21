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
const agentPanelProjectionSource = stripComments(readText("src/ui/director/agentPanelProjection.ts"));
const directorAgentActionSource = stripComments(readText("src/core/directorAgentAction.ts"));
const directorModeSource = stripComments(readText("src/ui/director/DirectorModeShell.tsx"));
const directorCssSource = stripComments(readText("src/styles/director.css"));
const newVideoStart = findFunctionBody(newVideoStartSource, "NewVideoStart");
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
const confirmNewVideoDraft = findFunctionBody(directorModeSource, "confirmNewVideoDraft");
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
    && /const feedbackText = \(feedbackOverride \?\? discussionFeedback\)\.trim\(\)/.test(sendDiscussionFeedback)
    && /if \(!feedbackOverride\) setDiscussionFeedback\(""\)/.test(sendDiscussionFeedback),
  "NewVideoStart must let the right-side Agent send feedback into the current draft without mutating the local composer text.",
  failures,
);
check(
  /用户正在修改当前新视频草案/.test(sendDiscussionFeedback)
    && /请直接输出修正后的完整分镜表/.test(sendDiscussionFeedback),
  "NewVideoStart discussion feedback must ask the planner to revise the current draft instead of treating feedback as a new idea.",
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
  /agentIntakeCommand\?\.mode === "confirm_current_draft"[\s\S]*projection && directorSession && !confirmed[\s\S]*void confirmDraft\(\)[\s\S]*showNoReadyDraftNotice\("确认这版故事"\)[\s\S]*return;[\s\S]*agentIntakeCommand\?\.mode === "continue_current_draft"/.test(newVideoStartSource),
  "NewVideoStart must let the right-side Agent confirm the current prepared draft without treating the confirmation label as a new idea.",
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
    && /createdAt:\s*feedbackTimelineCreatedAt[\s\S]*phase:\s*"planning_blocked"/.test(sendDiscussionFeedback),
  "NewVideoStart must reuse one timeline turn id when a planning turn moves from running to ready or blocked.",
  failures,
);
check(
  /createdAt:\s*timelineCreatedAt[\s\S]*phase:\s*"planning_started"[\s\S]*shotCount:\s*0/.test(prepareDraft),
  "NewVideoStart must show first-pass AI planning shots as pending instead of exposing the local rough split as a final count.",
  failures,
);
check(
  /understandingBody:\s*"你想按这条修改意见重排当前草案/.test(sendDiscussionFeedback),
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
  /inspect_project/.test(newVideoStartSource)
    && /plan_story/.test(newVideoStartSource)
    && /write_agent_message/.test(newVideoStartSource)
    && /保存到项目/.test(newVideoStartSource)
    && /生成参考图、提交视频和导出都还要再确认/.test(newVideoStartSource),
  "NewVideoStart Agent thread must explain creator-facing action semantics and confirmation boundaries before generation.",
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
    && /splitVisibleReferenceLabels\(shot\.characters\)/.test(newVideoStartSource)
    && /charactersFromShotText\(shotContext,\s*splitVisibleReferenceLabels\(fallback\.characters\)\)/.test(newVideoStartSource),
  "NewVideoStart must infer visible characters from shot text instead of preserving an incorrect 无 field or mapping generic 女生 to 女车手.",
  failures,
);
check(
  /const showStoryboardRows = storyboardRows\.length > 0 && !storyboardPlanningRunning/.test(newVideoStartSource),
  "NewVideoStart must hide rough local storyboard rows while AI planning is still optimizing, so users only review the final draft.",
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
    && /当前还没连接项目/.test(newVideoStartSource)
    && /确认时再选择项目文件夹/.test(newVideoStartSource),
  "NewVideoStart must let AI planning run before asking for a local project folder.",
  failures,
);
check(
  /aria-label="添加脚本、图片或声音"/.test(newVideoStartSource)
    && /aria-label=\{composerPrimaryAriaLabel\}/.test(newVideoStartSource),
  "NewVideoStart composer controls must expose explicit accessible action labels.",
  failures,
);
check(
  /composerConfirmsDraft[\s\S]*confirmDraft\s*:\s*submitComposer/.test(newVideoStartSource)
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
    && /已保存到项目/.test(newVideoStartSource),
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
