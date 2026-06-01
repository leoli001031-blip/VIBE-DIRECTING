import { readFileSync } from "node:fs";

import {
  runDirectorProductAgentLoop,
} from "../src/agent/index.ts";
import {
  buildProjectRuntimeStateFromProjectVibe,
  parseProjectVibeText,
  projectVibeFileName,
  type ProjectVibeDocument,
} from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-31T02:00:00.000Z";
const projectRoot = "/tmp/director-product-agent-loop";
const fixtureText = readFileSync("test-fixtures/projects/agent-loop-minimal/project.vibe", "utf8");
const opened = parseProjectVibeText(fixtureText);
assert(opened.ok && opened.project, `fixture should open: ${opened.errors.join("; ")}`);
const project = opened.project as ProjectVibeDocument;
const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
});
const browserDraftRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectPath: projectVibeFileName,
  generatedAt,
});

const browserDraftReferenceGeneration = runDirectorProductAgentLoop({
  project,
  runtimeState: browserDraftRuntimeState,
  userIntent: "补齐参考",
  userConfirmed: true,
  generatedAt,
  projectPath: projectVibeFileName,
});
assert(browserDraftReferenceGeneration.projectVibeWritten === false, "browser-draft Agent loop must not run local reference tooling without a concrete project root");
assert(browserDraftReferenceGeneration.toolHandoff.blockers.includes("project_not_ready"), "browser-draft Agent loop must not treat portable project_root as a concrete local project");

const browserDraftForgedReady = runDirectorProductAgentLoop({
  project,
  runtimeState: browserDraftRuntimeState,
  userIntent: "补齐参考",
  userConfirmed: true,
  generatedAt,
  projectPath: projectVibeFileName,
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(browserDraftForgedReady.projectVibeWritten === false, "browser-draft Agent loop must ignore forged projectReady availability without a concrete project root");
assert(browserDraftForgedReady.toolHandoff.blockers.includes("project_not_ready"), "project readiness must require an actual local project folder");

const stagedPatch = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "把这个镜头改成故事板快切",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedPatch.status === "awaiting_confirmation", "unconfirmed product Agent loop should wait for user confirmation");
assert(stagedPatch.action.status === "staged", "unconfirmed loop should still build a staged action");
assert(stagedPatch.action.toolPlan.toolName === "project_vibe_patch", "strategy change should stay in Project.vibe patch lane");
assert(stagedPatch.toolHandoff.status === "blocked", "unconfirmed handoff should not expose a tool invocation");
assert(stagedPatch.toolHandoff.blockers.includes("user_confirmation_required"), "unconfirmed handoff should explain confirmation is required");
assert(stagedPatch.projectVibeWritten === false, "unconfirmed loop must not write Project.vibe");
assert(!stagedPatch.nextRuntimeState, "unconfirmed loop must not project a next runtime state");
assert(stagedPatch.providerCalled === false && stagedPatch.workerSpawned === false, "unconfirmed loop must not call providers or workers");

const confirmedPatch = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "把这个镜头改成故事板快切",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(confirmedPatch.status === "project_patch_written", "confirmed project patch should write Project.vibe without extra tool invocation");
assert(confirmedPatch.projectVibeWritten === true, "confirmed patch loop should write Project.vibe facts");
assert(confirmedPatch.toolInvocationReady === false, "project patch should not expose a separate tool invocation");
assert(confirmedPatch.nextProject?.shots.find((shot) => shot.id === "shot_002")?.referenceStrategy === "storyboard_rapid_cut", "confirmed patch should update selected shot strategy");
assert(confirmedPatch.nextRuntimeState?.storyFlow.shots.find((shot) => shot.id === "shot_002")?.referenceStrategy === "storyboard_rapid_cut", "confirmed patch should rebuild runtime projection with the updated strategy");
assert(confirmedPatch.confirmResult?.runReceipt?.evidenceRefs.includes(`agentAction#${confirmedPatch.action.actionId}`), "run receipt should cite the staged Agent action");
assert(confirmedPatch.confirmResult?.runReceipt?.evidenceRefs.includes(`agentToolHandoff#${confirmedPatch.toolHandoff.handoffId}`), "run receipt should cite the confirmed Agent handoff");
assert(confirmedPatch.action.sourceContext.projectRoot === projectRoot, "staged Agent actions must remember the project root they were created from");

const stagedInspection = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "现在项目还有什么问题，能不能继续？",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedInspection.action.kind === "inspect_project_status", "project status questions should use the inspection action before confirmation");
assert(stagedInspection.status === "inspected", "unconfirmed inspection should return a read-only project status result");
assert(stagedInspection.projectVibeWritten === false, "unconfirmed inspection must not stage or write Project.vibe");
assert(!stagedInspection.stageResult, "inspection should not create a staged Project.vibe transaction");
assert(stagedInspection.toolInvocationReady === false, "inspection should not expose a tool invocation");

const confirmedInspection = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "现在项目还有什么问题，能不能继续？",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(confirmedInspection.action.kind === "inspect_project_status", "project status questions should use the inspection action");
assert(confirmedInspection.status === "inspected", "confirmed inspection should stay read-only instead of writing a patch");
assert(confirmedInspection.projectVibeWritten === false, "confirmed inspection must not write Project.vibe");
assert(!confirmedInspection.confirmResult, "confirmed inspection should not create a Project.vibe run receipt");
assert(!confirmedInspection.nextRuntimeState, "confirmed inspection should not rebuild runtime projection");
assert(confirmedInspection.toolInvocationReady === false, "inspection should not expose a provider/tool invocation");
assert(!confirmedInspection.nextProject?.assets.some((asset) => asset.id === "asset_project_direction"), "inspection must not write the question as a project direction asset");
assert(confirmedInspection.providerCalled === false && confirmedInspection.workerSpawned === false, "inspection must not call providers or workers");

for (const statusQuestion of [
  "距离 Demo 闭环还缺哪些内容？",
  "现在软件还有哪些问题？",
  "目前还有什么小修小改可以做吗？",
  "能不能导出素材包？",
  "Demo 是不是已经打磨得差不多了？",
  "demo ready?",
  "can export?",
  "接下来该做什么？",
  "现在可以做什么？",
  "还有什么可以做？",
  "what next?",
  "what should I do?",
]) {
  const statusQuestionLoop = runDirectorProductAgentLoop({
    project,
    runtimeState,
    userIntent: statusQuestion,
    userConfirmed: true,
    generatedAt,
    projectRoot,
    projectPath: projectVibeFileName,
    selection: {
      currentView: "story",
    },
    availability: {
      projectReady: true,
      webSearchReady: true,
      referenceGenerationReady: true,
      videoSubmitReady: true,
      exportReady: true,
    },
  });
  assert(statusQuestionLoop.action.kind === "inspect_project_status", `status question should stay read-only: ${statusQuestion}`);
  assert(statusQuestionLoop.status === "inspected", `status question should inspect without staging: ${statusQuestion}`);
  assert(statusQuestionLoop.projectVibeWritten === false, `status question must not write Project.vibe: ${statusQuestion}`);
  assert(statusQuestionLoop.toolInvocationReady === false, `status question must not expose a tool invocation: ${statusQuestion}`);
}

const explicitMentionPatch = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "把 shot_001 改成故事板快切",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(explicitMentionPatch.action.target.ids[0] === "shot_001", "explicitly mentioned shot should override the currently selected shot");
assert(explicitMentionPatch.nextProject?.shots.find((shot) => shot.id === "shot_001")?.referenceStrategy === "storyboard_rapid_cut", "confirmed patch should write the explicitly mentioned shot");
assert(!explicitMentionPatch.nextProject?.shots.find((shot) => shot.id === "shot_002")?.referenceStrategy, "confirmed patch should not mutate the merely selected shot when another shot is named");

const stagedShotFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这个镜头动作更有压迫感，机位低一点",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedShotFeedback.status === "awaiting_confirmation", "shot feedback should stage before writing");
assert(stagedShotFeedback.action.target.kind === "shot", "shot feedback should target the selected shot");
assert(stagedShotFeedback.projectVibeWritten === false, "staged shot feedback must not mutate Project.vibe");

const stagedShotApprovalFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这个镜头通过了，节奏可以，先保持这个方向",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedShotApprovalFeedback.status === "awaiting_confirmation", "shot approval wording should stage as shot feedback");
assert(stagedShotApprovalFeedback.action.kind === "revise_story_or_shot", "shot approval wording must not become reference asset review");
assert(stagedShotApprovalFeedback.action.target.kind === "shot", "shot approval wording should keep the selected shot target");
assert(stagedShotApprovalFeedback.projectVibeWritten === false, "shot approval wording must not write before confirmation");

const confirmedShotFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: stagedShotFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedShotFeedback.action,
});
const patchedShotFeedback = confirmedShotFeedback.nextProject?.shots.find((shot) => shot.id === "shot_002");
assert(confirmedShotFeedback.status === "project_patch_written", "confirmed shot feedback should stay in the Project.vibe patch lane");
assert(patchedShotFeedback?.directorFeedbackDirectives?.some((item) => item.includes("压迫感")), "confirmed shot feedback should persist as director feedback directives");
assert(patchedShotFeedback?.sourceRefs.some((item) => item.includes("directorFeedbackDirectives")), "shot feedback should carry directive evidence");
assert(confirmedShotFeedback.nextRuntimeState?.storyFlow.shots.find((shot) => shot.id === "shot_002")?.directorFeedbackDirectives?.some((item) => item.includes("压迫感")), "confirmed shot feedback should rebuild runtime projection with director feedback");
assert(confirmedShotFeedback.confirmResult?.runReceipt?.evidenceRefs.includes("project.vibe#shots/shot_002/directorFeedbackDirectives"), "run receipt should cite shot feedback directives");

const structuredShotFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "主动作应该是她缓慢抬头看向窗外，机位改为低机位缓慢推近，时长改为6秒，场景改为清晨旧书店靠窗书桌",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(structuredShotFeedback.status === "awaiting_confirmation", "structured shot feedback should stage before writing");
assert(structuredShotFeedback.action.proposedChanges.some((change) => change.field === "primaryAction" && change.to.includes("缓慢抬头")), "structured feedback should extract primaryAction");
assert(structuredShotFeedback.action.proposedChanges.some((change) => change.field === "camera" && change.to.includes("低机位")), "structured feedback should extract camera");
assert(structuredShotFeedback.action.proposedChanges.some((change) => change.field === "durationSeconds" && change.to.includes("6")), "structured feedback should extract duration");
assert(structuredShotFeedback.action.proposedChanges.some((change) => change.field === "sceneGuidance" && change.to.includes("旧书店")), "structured feedback should extract scene guidance");
const confirmedStructuredShotFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: structuredShotFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: structuredShotFeedback.action,
});
const structuredPatchedShot = confirmedStructuredShotFeedback.nextProject?.shots.find((shot) => shot.id === "shot_002");
assert(structuredPatchedShot?.primaryAction?.includes("缓慢抬头"), "confirmed structured feedback should write primaryAction");
assert(structuredPatchedShot?.camera?.includes("低机位"), "confirmed structured feedback should write camera");
assert(structuredPatchedShot?.durationSeconds === 6, "confirmed structured feedback should write durationSeconds");
assert(structuredPatchedShot?.sceneGuidance?.[0]?.includes("旧书店"), "confirmed structured feedback should write scene guidance");
assert(confirmedStructuredShotFeedback.nextRuntimeState?.storyFlow.shots.find((shot) => shot.id === "shot_002")?.primaryAction?.includes("缓慢抬头"), "structured feedback should rebuild runtime shot fields");
assert(confirmedStructuredShotFeedback.confirmResult?.runReceipt?.evidenceRefs.includes("project.vibe#shots/shot_002/primaryAction"), "run receipt should cite structured field writeback");
assert(confirmedStructuredShotFeedback.confirmResult?.runReceipt?.evidenceRefs.includes("project.vibe#shots/shot_002/camera"), "run receipt should cite camera writeback");
assert(structuredPatchedShot?.sourceRefs.includes("project.vibe#shots/shot_002/primaryAction"), "structured feedback should link primaryAction in shot source refs");
assert(structuredPatchedShot?.sourceRefs.includes("project.vibe#shots/shot_002/camera"), "structured feedback should link camera in shot source refs");
assert(structuredPatchedShot?.sourceRefs.includes("project.vibe#shots/shot_002/durationSeconds"), "structured feedback should link durationSeconds in shot source refs");

const preparedActionLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: confirmedPatch.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: confirmedPatch.action,
  agentToolHandoff: confirmedPatch.toolHandoff,
});
assert(preparedActionLoop.action.actionId === confirmedPatch.action.actionId, "product Agent loop must preserve the user-reviewed staged action when provided");
assert(preparedActionLoop.toolHandoff.handoffId === confirmedPatch.toolHandoff.handoffId, "product Agent loop must preserve the confirmed tool handoff when provided");

const otherProjectRoot = "/tmp/director-product-agent-loop-other";
const otherRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectRoot: otherProjectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
});
const staleProjectActionLoop = runDirectorProductAgentLoop({
  project,
  runtimeState: otherRuntimeState,
  userIntent: stagedShotFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot: otherProjectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedShotFeedback.action,
});
assert(staleProjectActionLoop.status === "blocked", "stale Agent actions from another project root must block before writing");
assert(staleProjectActionLoop.projectVibeWritten === false, "stale Agent actions from another project root must not write Project.vibe");
assert(staleProjectActionLoop.blockedReasons.includes("agent_action_project_context_mismatch"), "stale Agent actions should explain project context drift");

const mismatchedPreparedHandoff = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: stagedShotFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedShotFeedback.action,
  agentToolHandoff: confirmedPatch.toolHandoff,
});
assert(mismatchedPreparedHandoff.status === "blocked", "mismatched reviewed handoff must block before writing");
assert(mismatchedPreparedHandoff.projectVibeWritten === false, "mismatched reviewed handoff must not write Project.vibe");
assert(mismatchedPreparedHandoff.toolInvocationReady === false, "mismatched reviewed handoff must not expose a tool invocation");
assert(mismatchedPreparedHandoff.blockedReasons.includes("agent_tool_handoff_action_id_mismatch"), "mismatched handoff should explain action binding drift");

const wrongHandlerHandoff = {
  ...confirmedPatch.toolHandoff,
  handler: "seedance_video_submit" as const,
  expectedReceipt: "video_submit_receipt" as const,
};
const mismatchedHandlerHandoff = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: confirmedPatch.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: confirmedPatch.action,
  agentToolHandoff: wrongHandlerHandoff,
});
assert(mismatchedHandlerHandoff.status === "blocked", "wrong handler handoff must block before writing");
assert(mismatchedHandlerHandoff.blockedReasons.includes("agent_tool_handoff_handler_mismatch"), "wrong handler should explain handler binding drift");
assert(mismatchedHandlerHandoff.blockedReasons.includes("agent_tool_handoff_receipt_mismatch"), "wrong handler should explain receipt binding drift");
assert(mismatchedHandlerHandoff.projectVibeWritten === false, "wrong handler handoff must not write Project.vibe");

const stagedAssetFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这个角色参考要保留短黑发，但表情更警觉一点",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_char_mira",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedAssetFeedback.status === "awaiting_confirmation", "asset feedback should stage before writing");
assert(stagedAssetFeedback.action.target.kind === "asset", "asset feedback should target the selected asset");
assert(stagedAssetFeedback.projectVibeWritten === false, "staged asset feedback must not mutate Project.vibe");

const confirmedAssetFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: stagedAssetFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_char_mira",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedAssetFeedback.action,
});
assert(confirmedAssetFeedback.status === "project_patch_written", "confirmed asset feedback should stay in the Project.vibe patch lane");
assert(confirmedAssetFeedback.projectVibeWritten === true, "confirmed asset feedback should write Project.vibe facts");
assert(confirmedAssetFeedback.toolInvocationReady === false, "asset feedback should not expose a provider tool invocation");
const patchedAsset = confirmedAssetFeedback.nextProject?.assets.find((asset) => asset.id === "asset_char_mira");
assert(patchedAsset?.textConstraints.some((item) => item.includes("表情更警觉")), "confirmed asset feedback should persist as an asset constraint");
assert(patchedAsset?.sourceRefs.some((item) => item.includes("textConstraints")), "asset feedback should carry text constraint evidence");
assert(confirmedAssetFeedback.nextRuntimeState?.visualMemory.assets.find((asset) => asset.id === "asset_char_mira")?.textConstraints?.some((item) => item.includes("表情更警觉")), "confirmed asset feedback should rebuild runtime visual memory projection");
const patchedVisualMemoryEntry = confirmedAssetFeedback.nextProject?.visualMemory.entries.find((entry) => entry.assetId === "asset_char_mira");
assert(patchedVisualMemoryEntry?.textConstraints.some((item) => item.includes("表情更警觉")), "asset feedback should stay mirrored in visual memory");
assert(confirmedAssetFeedback.confirmResult?.runReceipt?.evidenceRefs.includes("project.vibe#assets/asset_char_mira"), "run receipt should cite the selected asset");

const alreadyLockedAssetApproval = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这张参考通过，锁定下来",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_char_mira",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(alreadyLockedAssetApproval.status === "blocked", "already locked asset approval should block instead of staging a no-op");
assert(alreadyLockedAssetApproval.projectVibeWritten === false, "already locked asset approval must not write Project.vibe");
assert(alreadyLockedAssetApproval.action.proposedChanges.length === 0, "already locked asset approval should not show a fake locked-to-locked diff");
assert(alreadyLockedAssetApproval.blockedReasons.some((reason) => reason.includes("已经锁定")), "already locked asset approval should explain the no-op");

const staleAssetApproval = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这张参考通过，锁定下来",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_from_previous_project",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(staleAssetApproval.status === "blocked", "stale asset approval should block instead of staging a write");
assert(staleAssetApproval.action.kind === "review_reference_asset", "stale asset approval should preserve the creator's review intent");
assert(staleAssetApproval.action.target.kind !== "asset", "stale asset approval must not target a missing asset");
assert(staleAssetApproval.projectVibeWritten === false, "stale asset approval must not write Project.vibe");
assert(staleAssetApproval.blockedReasons.some((reason) => reason.includes("参考素材")), "stale asset approval should ask the creator to reselect a current reference");

const candidateReviewProject: ProjectVibeDocument = {
  ...project,
  assets: [
    ...project.assets,
    {
      id: "asset_ticket_candidate",
      kind: "prop",
      label: "发光车票候选",
      status: "needs_review",
      path: "assets/candidates/ticket.png",
      textConstraints: ["blue-white glow", "wet ticket edge"],
      usedByShotIds: ["shot_002"],
      sourceRefs: ["receipt#ticket_candidate"],
    },
  ],
  visualMemory: {
    ...project.visualMemory,
    entries: [
      ...project.visualMemory.entries,
      {
        id: "vm_ticket_candidate",
        assetId: "asset_ticket_candidate",
        kind: "prop",
        label: "发光车票候选",
        status: "needs_review",
        textConstraints: ["blue-white glow", "wet ticket edge"],
        usedByShotIds: ["shot_002"],
        canUseAsFutureReference: false,
        sourceRefs: ["project.vibe#assets/asset_ticket_candidate"],
      },
    ],
  },
};
const candidateReviewRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project: candidateReviewProject,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
});
const queuedReviewContinue = runDirectorProductAgentLoop({
  project: candidateReviewProject,
  runtimeState: candidateReviewRuntimeState,
  userIntent: "按项目状态继续：复核参考",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(queuedReviewContinue.status === "blocked", "status-inspection continuation into reference review should block until a reference is selected");
assert(queuedReviewContinue.action.kind === "review_reference_asset", "status-inspection continuation should use the queued reference review action");
assert(queuedReviewContinue.projectVibeWritten === false, "queued reference review without selection must not write Project.vibe");
assert(queuedReviewContinue.blockedReasons.some((reason) => reason.includes("参考素材")), "queued reference review should ask for the current reference selection");

const stagedAssetApproval = runDirectorProductAgentLoop({
  project: candidateReviewProject,
  runtimeState: candidateReviewRuntimeState,
  userIntent: "这张参考通过，锁定下来",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_ticket_candidate",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedAssetApproval.action.kind === "review_reference_asset", "asset approval should stage as a reference review action");
assert(stagedAssetApproval.action.proposedChanges[0]?.to === "已锁定", "asset approval should propose a locked asset status");
assert(stagedAssetApproval.projectVibeWritten === false, "unconfirmed asset approval must not mutate Project.vibe");

const confirmedAssetApproval = runDirectorProductAgentLoop({
  project: candidateReviewProject,
  runtimeState: candidateReviewRuntimeState,
  userIntent: stagedAssetApproval.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "reference",
    selectedAssetId: "asset_ticket_candidate",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedAssetApproval.action,
});
const approvedAsset = confirmedAssetApproval.nextProject?.assets.find((asset) => asset.id === "asset_ticket_candidate");
const approvedVisualMemory = confirmedAssetApproval.nextProject?.visualMemory.entries.find((entry) => entry.assetId === "asset_ticket_candidate");
assert(confirmedAssetApproval.status === "project_patch_written", "confirmed asset approval should write through Project.vibe");
assert(approvedAsset?.status === "locked", "confirmed asset approval should lock the selected asset");
assert(approvedAsset?.lockedBy === "user", "confirmed asset approval should record user authorization");
assert(approvedVisualMemory?.status === "locked", "confirmed asset approval should update visual memory status");
assert(approvedVisualMemory?.canUseAsFutureReference === true, "locked approved references should become future-safe visual memory");
assert(confirmedAssetApproval.nextRuntimeState?.visualMemory.assets.find((asset) => asset.id === "asset_ticket_candidate")?.lockedStatus === "locked", "runtime projection should show the approved asset as locked");
assert(confirmedAssetApproval.confirmResult?.runReceipt?.evidenceRefs.includes("project.vibe#assets/asset_ticket_candidate/status"), "run receipt should cite asset status evidence");

const stagedSectionFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这一段整体要更像暴风雨前的安静，节奏压低一点",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "section",
    sectionId: "turn",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedSectionFeedback.status === "awaiting_confirmation", "section feedback should stage before writing");
assert(stagedSectionFeedback.action.target.kind === "section", "section feedback should target the selected section");
assert(stagedSectionFeedback.projectVibeWritten === false, "staged section feedback must not mutate Project.vibe");

const confirmedSectionFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: stagedSectionFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "section",
    sectionId: "turn",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedSectionFeedback.action,
});
assert(confirmedSectionFeedback.status === "project_patch_written", "confirmed section feedback should stay in the Project.vibe patch lane");
assert(confirmedSectionFeedback.projectVibeWritten === true, "confirmed section feedback should write Project.vibe facts");
assert(confirmedSectionFeedback.nextProject?.storyFlow.sections.find((section) => section.id === "turn")?.summary.includes("节奏压低"), "confirmed section feedback should persist in the section summary");
assert(confirmedSectionFeedback.nextProject?.shots.find((shot) => shot.id === "shot_002")?.intent.includes("节奏压低"), "section feedback should mark the section shots as affected");
assert(confirmedSectionFeedback.nextProject?.shots.find((shot) => shot.id === "shot_002")?.directorFeedbackDirectives?.some((item) => item.includes("节奏压低")), "section feedback should also persist as shot-level director feedback");
assert(confirmedSectionFeedback.nextRuntimeState?.storyFlow.sections.find((section) => section.id === "turn")?.label === "Signal Turn", "confirmed section feedback should rebuild runtime sections");
assert(confirmedSectionFeedback.nextRuntimeState?.storyFlow.shots.find((shot) => shot.id === "shot_002")?.directorFeedbackDirectives?.some((item) => item.includes("节奏压低")), "confirmed section feedback should rebuild runtime shot feedback");
assert(confirmedSectionFeedback.confirmResult?.runReceipt?.evidenceRefs.includes("project.vibe#storyFlow/sections/turn"), "run receipt should cite the selected section");

const sectionReferenceLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这一段先补参考图，但先不要提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "section",
    sectionId: "turn",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(sectionReferenceLoop.status === "tool_ready", "confirmed section reference action should write Project.vibe and prepare the reference tool");
assert(sectionReferenceLoop.action.target.kind === "section", "section reference action should preserve the selected section target");
assert(sectionReferenceLoop.action.sourceContext.sectionId === "turn", "section reference action should carry section id");
assert(sectionReferenceLoop.toolHandoff.invocation?.sectionId === "turn", "section reference handoff should carry the selected section into the tool invocation");
assert(sectionReferenceLoop.toolHandoff.invocation?.selectedShotIds.length === 0, "section reference handoff should not invent selected shot ids");
assert(sectionReferenceLoop.toolHandoff.invocation?.targetSummary.kind === "section", "section reference handoff should carry a self-describing target summary");
assert(sectionReferenceLoop.toolHandoff.invocation?.targetSummary.label === "Signal Turn", "section reference handoff target summary should be creator-readable");
assert(sectionReferenceLoop.confirmResult?.runReceipt?.affectedShotIds.includes("shot_002"), "section reference writeback should affect shots in the selected section");
assert(sectionReferenceLoop.toolInvocationReady === true, "section reference loop should expose a controlled tool invocation after Project.vibe writeback");

const stagedProjectFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "整体风格更像 90 年代日本 TV 动画，安静、克制、低饱和",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(stagedProjectFeedback.status === "awaiting_confirmation", "project feedback should stage before writing");
assert(stagedProjectFeedback.action.target.kind === "project", "project feedback without a selection should target the whole project");
assert(stagedProjectFeedback.projectVibeWritten === false, "staged project feedback must not mutate Project.vibe");

const blockedMissingShotFeedbackLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "这个镜头动作再慢一点，表情停一下",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(blockedMissingShotFeedbackLoop.status === "blocked", "deictic shot feedback without selection should block in the product Agent loop");
assert(blockedMissingShotFeedbackLoop.projectVibeWritten === false, "deictic shot feedback without selection must not write Project.vibe");
assert(blockedMissingShotFeedbackLoop.blockedReasons.some((reason) => reason.includes("选中一个镜头")), "deictic shot feedback should explain the missing selected shot");

const confirmedProjectFeedback = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: stagedProjectFeedback.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: stagedProjectFeedback.action,
});
assert(confirmedProjectFeedback.status === "project_patch_written", "confirmed project feedback should stay in the Project.vibe patch lane");
assert(confirmedProjectFeedback.projectVibeWritten === true, "confirmed project feedback should write Project.vibe facts");
const projectDirectionAsset = confirmedProjectFeedback.nextProject?.assets.find((asset) => asset.id === "asset_project_direction");
assert(projectDirectionAsset?.kind === "style", "project-level feedback should become a style reference asset");
assert(projectDirectionAsset?.status === "locked", "project-level style direction should be locked for future reference");
assert(projectDirectionAsset?.textConstraints.some((item) => item.includes("低饱和")), "project style direction should persist the confirmed feedback");
assert(projectDirectionAsset?.usedByShotIds.length === project.storyFlow.shotOrder.length, "project style direction should apply to the full story flow");
const projectDirectionMemory = confirmedProjectFeedback.nextProject?.visualMemory.entries.find((entry) => entry.assetId === "asset_project_direction");
assert(projectDirectionMemory?.canUseAsFutureReference === true, "project style direction should be available as future reference");
assert(projectDirectionMemory?.textConstraints.some((item) => item.includes("低饱和")), "project style direction should mirror into visual memory");

const researchLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "查资料 90 年代日本 TV 动画雨夜追逐应该怎么写",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(researchLoop.status === "tool_ready", "confirmed research action should write Project.vibe and prepare the web search tool");
assert(researchLoop.action.kind === "request_style_research", "research wording should route to the style research action");
assert(researchLoop.action.toolPlan.toolName === "web_search", "research action should route to web search");
assert(researchLoop.toolHandoff.status === "ready", "confirmed research handoff should be ready");
assert(researchLoop.toolHandoff.invocation?.confirmation.expectedReceipt === "web_research_reference_receipt", "research handoff should require a web research receipt");
assert(researchLoop.toolHandoff.invocation?.taskEnvelope.handler === "web_search", "research task envelope should bind to the web search handler");
assert(researchLoop.toolHandoff.invocation?.taskEnvelope.expectedReceipt === "web_research_reference_receipt", "research task envelope should bind to the research receipt");
assert(researchLoop.toolHandoff.invocation?.taskEnvelope.providerSubmitAllowed === false, "web search tool handoff should not be treated as provider submit");
assert(researchLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => ref.startsWith("agentToolTaskEnvelope#")), "research run receipt should cite the Agent tool task envelope");
assert(researchLoop.confirmResult?.runReceipt?.affectedShotIds.length === 0, "project-level research should not mark every shot as changed");
assert(!researchLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => /project\.vibe#shots\/.+\/intent/.test(ref)), "research run receipt must not claim shot intent edits");
assert(JSON.stringify(researchLoop.nextProject?.shots.map((shot) => ({ id: shot.id, intent: shot.intent }))) === JSON.stringify(project.shots.map((shot) => ({ id: shot.id, intent: shot.intent }))), "research command must not pollute formal shot intents");
assert(researchLoop.projectVibeWritten === true, "research loop should write Project.vibe before tool invocation");
assert(researchLoop.toolInvocationReady === true, "research loop should expose a controlled tool invocation only after Project.vibe writeback");
assert(researchLoop.providerCalled === false && researchLoop.workerSpawned === false, "product Agent loop must not run web search directly");

const researchNotReadyLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "查资料 90 年代日本 TV 动画雨夜追逐应该怎么写",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(researchNotReadyLoop.status === "blocked", "research should block when web search is not ready");
assert(researchNotReadyLoop.projectVibeWritten === false, "blocked research must not write Project.vibe");
assert(researchNotReadyLoop.toolInvocationReady === false, "blocked research must not expose a web search invocation");
assert(researchNotReadyLoop.blockedReasons.filter((reason) => reason === "agent_tool_handoff_blocked:web_search_not_ready").length === 1, "blocked research should explain readiness once");

const exportLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "导出素材包",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "export",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(exportLoop.status === "tool_ready", "confirmed export action should write Project.vibe and prepare the export tool");
assert(exportLoop.action.kind === "prepare_export", "export wording should route to the export action");
assert(exportLoop.action.toolPlan.toolName === "project_export", "export action should route to the project export tool");
assert(exportLoop.toolHandoff.status === "ready", "confirmed export handoff should be ready");
assert(exportLoop.toolHandoff.invocation?.confirmation.expectedReceipt === "export_receipt", "export handoff should require an export receipt");
assert(exportLoop.toolHandoff.invocation?.taskEnvelope.expectedReceipt === "export_receipt", "export task envelope should bind to the export receipt");
assert(exportLoop.toolHandoff.invocation?.taskEnvelope.handler === "project_export", "export task envelope should bind to the export handler");
assert(exportLoop.toolHandoff.invocation?.taskEnvelope.policyBinding === "director_agent_tool_handoff", "export task envelope should keep the controlled handoff policy");
assert(exportLoop.toolHandoff.invocation?.taskEnvelope.projectWriteRequiredBeforeInvocation === true, "export tool should require Project.vibe writeback before invocation");
assert(exportLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => ref.startsWith("agentToolTaskEnvelope#")), "export run receipt should cite the Agent tool task envelope");
assert(exportLoop.confirmResult?.runReceipt?.affectedShotIds.length === 0, "project export should not mark every shot as changed");
assert(!exportLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => /project\.vibe#shots\/.+\/intent/.test(ref)), "export run receipt must not claim shot intent edits");
assert(JSON.stringify(exportLoop.nextProject?.shots.map((shot) => ({ id: shot.id, intent: shot.intent }))) === JSON.stringify(project.shots.map((shot) => ({ id: shot.id, intent: shot.intent }))), "export command must not pollute formal shot intents");
assert(exportLoop.projectVibeWritten === true, "export loop should write Project.vibe before tool invocation");
assert(exportLoop.toolInvocationReady === true, "export loop should expose a controlled tool invocation only after Project.vibe writeback");
assert(exportLoop.providerCalled === false && exportLoop.workerSpawned === false, "product Agent loop must not run export worker directly");

const exportNotReadyLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "导出素材包",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "export",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: false,
  },
});
assert(exportNotReadyLoop.status === "blocked", "export should block when the export tool is not ready");
assert(exportNotReadyLoop.projectVibeWritten === false, "blocked export must not write Project.vibe");
assert(exportNotReadyLoop.toolInvocationReady === false, "blocked export must not expose an export invocation");
assert(exportNotReadyLoop.blockedReasons.includes("agent_tool_handoff_blocked:export_not_ready"), "blocked export should explain export readiness");

const referenceLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "可以先补齐参考素材，但先不要提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(referenceLoop.status === "tool_ready", "confirmed reference action should write Project.vibe and prepare a controlled tool invocation");
assert(referenceLoop.action.executionContract.mode === "reference_allowed", "reference loop should respect no-video wording");
assert(referenceLoop.action.toolPlan.toolName === "image2_reference_generation", "reference loop should route to Image2 reference generation");
assert(referenceLoop.toolHandoff.status === "ready", "confirmed reference handoff should be ready");
assert(referenceLoop.toolHandoff.invocation?.confirmation.expectedReceipt === "image_reference_receipt", "reference handoff should require an image receipt candidate");
assert(referenceLoop.toolHandoff.invocation?.confirmation.actionId === referenceLoop.action.actionId, "tool invocation must bind to the confirmed Agent action");
assert(referenceLoop.toolHandoff.invocation?.userIntent === referenceLoop.action.sourceContext.userIntent, "tool invocation must carry the confirmed Agent user intent");
assert(referenceLoop.toolHandoff.invocation?.selectedShotIds.includes("shot_002"), "tool invocation must carry the confirmed shot target");
assert(referenceLoop.toolHandoff.invocation?.targetSummary.kind === "shot", "tool invocation must carry the target kind");
assert(referenceLoop.toolHandoff.invocation?.targetSummary.ids.includes("shot_002"), "tool invocation target summary must carry target ids");
assert(referenceLoop.toolHandoff.invocation?.taskEnvelope.id, "tool invocation should expose a task envelope id");
assert(referenceLoop.toolHandoff.invocation?.taskEnvelope.inputHash.startsWith("agent_tool_input_"), "tool invocation should expose a task envelope input hash");
assert(referenceLoop.toolHandoff.invocation?.taskEnvelope.policyBinding === "director_agent_tool_handoff", "tool invocation should expose the policy binding");
assert(referenceLoop.toolHandoff.invocation?.taskEnvelope.actionId === referenceLoop.action.actionId, "task envelope should bind to the confirmed Agent action");
assert(referenceLoop.toolHandoff.invocation?.taskEnvelope.expectedReceipt === "image_reference_receipt", "task envelope should bind to the expected receipt");
assert(referenceLoop.toolHandoff.invocation?.taskEnvelope.sourceContext.projectRoot === projectRoot, "tool task envelope must preserve the Agent action project root");
assert(referenceLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => ref.startsWith("agentToolTaskEnvelope#")), "run receipt should cite the Agent tool task envelope");
assert(referenceLoop.projectVibeWritten === true, "reference loop should write Project.vibe before tool invocation");
assert(referenceLoop.toolInvocationReady === true, "reference loop should expose a controlled tool invocation only after Project.vibe writeback");
assert(referenceLoop.providerCalled === false && referenceLoop.workerSpawned === false, "product Agent loop must not call provider or worker directly");
assert(!referenceLoop.nextProject?.shots.find((shot) => shot.id === "shot_002")?.directorFeedbackDirectives?.some((item) => item.includes("补齐参考")), "reference execution commands should not pollute shot director feedback");
assert(referenceLoop.nextRuntimeState?.storyFlow.shots.some((shot) => shot.id === "shot_002"), "reference loop should also return a rebuilt runtime projection before tool invocation");

const broadNoVideoReferenceLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "可以先补齐参考素材，视频先不用管",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(broadNoVideoReferenceLoop.status === "tool_ready", "broader no-video wording should still prepare the reference tool");
assert(broadNoVideoReferenceLoop.action.executionContract.mode === "reference_allowed", "broader no-video wording should keep video submit disabled");
assert(broadNoVideoReferenceLoop.action.toolPlan.toolName === "image2_reference_generation", "broader no-video reference command should not route to video submit");

const taskEnvelopeTamperedLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: referenceLoop.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: referenceLoop.action,
  agentToolHandoff: {
    ...referenceLoop.toolHandoff,
    invocation: referenceLoop.toolHandoff.invocation
      ? {
          ...referenceLoop.toolHandoff.invocation,
          taskEnvelope: {
            ...referenceLoop.toolHandoff.invocation.taskEnvelope,
            actionId: "stale_action",
          },
        }
      : undefined,
  },
});
assert(taskEnvelopeTamperedLoop.status === "blocked", "tampered task envelope binding must block before writing");
assert(taskEnvelopeTamperedLoop.projectVibeWritten === false, "tampered task envelope binding must not write Project.vibe");
assert(taskEnvelopeTamperedLoop.toolInvocationReady === false, "tampered task envelope binding must not expose tool invocation");
assert(taskEnvelopeTamperedLoop.blockedReasons.includes("agent_tool_handoff_task_action_id_mismatch"), "tampered task envelope should explain action binding drift");

const taskEnvelopeWrongProjectLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: referenceLoop.action.sourceContext.userIntent,
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  agentActionEnvelope: referenceLoop.action,
  agentToolHandoff: {
    ...referenceLoop.toolHandoff,
    invocation: referenceLoop.toolHandoff.invocation
      ? {
          ...referenceLoop.toolHandoff.invocation,
          taskEnvelope: {
            ...referenceLoop.toolHandoff.invocation.taskEnvelope,
            sourceContext: {
              ...referenceLoop.toolHandoff.invocation.taskEnvelope.sourceContext,
              projectRoot: otherProjectRoot,
            },
          },
        }
      : undefined,
  },
});
assert(taskEnvelopeWrongProjectLoop.status === "blocked", "tool task envelopes from another project root must block before writing");
assert(taskEnvelopeWrongProjectLoop.projectVibeWritten === false, "tool task envelopes from another project root must not write Project.vibe");
assert(taskEnvelopeWrongProjectLoop.blockedReasons.includes("agent_tool_handoff_task_project_context_mismatch"), "wrong-project task envelopes should explain project context drift");

const videoLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "现在提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  executionContract: {
    mode: "video_allowed",
    referenceGenerationAllowed: true,
    videoSubmitAllowed: true,
    providerSubmitAllowed: true,
    reason: "测试允许视频提交",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(videoLoop.status === "tool_ready", "confirmed video action should write Project.vibe and prepare the Seedance submit tool");
assert(videoLoop.action.kind === "prepare_video_submit", "video wording should route to video submit");
assert(videoLoop.action.toolPlan.toolName === "seedance_video_submit", "video action should route to Seedance submit");
assert(videoLoop.toolHandoff.status === "ready", "confirmed video handoff should be ready");
assert(videoLoop.toolHandoff.invocation?.confirmation.expectedReceipt === "video_submit_receipt", "video handoff should require a video submit receipt");
assert(videoLoop.toolHandoff.invocation?.selectedShotIds.includes("shot_002"), "video handoff should preserve the selected shot target");
assert(videoLoop.toolHandoff.invocation?.taskEnvelope.handler === "seedance_video_submit", "video task envelope should bind to Seedance submit");
assert(videoLoop.toolHandoff.invocation?.taskEnvelope.providerSubmitAllowed === true, "video task envelope should preserve provider-submit permission");
assert(videoLoop.toolHandoff.invocation?.taskEnvelope.expectedReceipt === "video_submit_receipt", "video task envelope should bind to the video receipt");
assert(videoLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => ref.startsWith("agentToolTaskEnvelope#")), "video run receipt should cite the Agent tool task envelope");
assert(!videoLoop.confirmResult?.runReceipt?.evidenceRefs.some((ref) => /project\.vibe#shots\/.+\/intent/.test(ref)), "video submit run receipt must not claim shot intent edits");
assert(videoLoop.nextProject?.shots.find((shot) => shot.id === "shot_002")?.intent === project.shots.find((shot) => shot.id === "shot_002")?.intent, "video submit command must not pollute formal shot intents");
assert(videoLoop.projectVibeWritten === true, "video loop should write Project.vibe before tool invocation");
assert(videoLoop.toolInvocationReady === true, "video loop should expose a controlled tool invocation only after Project.vibe writeback");
assert(videoLoop.providerCalled === false && videoLoop.workerSpawned === false, "product Agent loop must not call Seedance directly");

const videoNotReadyLoop = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "现在提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  executionContract: {
    mode: "video_allowed",
    referenceGenerationAllowed: true,
    videoSubmitAllowed: true,
    providerSubmitAllowed: true,
    reason: "测试允许视频提交",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: false,
    exportReady: true,
  },
});
assert(videoNotReadyLoop.status === "blocked", "video should block when the submit tool is not ready");
assert(videoNotReadyLoop.projectVibeWritten === false, "blocked video submit must not write Project.vibe");
assert(videoNotReadyLoop.toolInvocationReady === false, "blocked video submit must not expose a Seedance invocation");
assert(videoNotReadyLoop.blockedReasons.filter((reason) => reason === "agent_tool_handoff_blocked:video_submit_not_ready").length === 1, "blocked video should explain readiness once");

const blockedVideo = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "现在提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  executionContract: {
    mode: "plan_only",
    referenceGenerationAllowed: false,
    videoSubmitAllowed: false,
    providerSubmitAllowed: false,
    reason: "测试只规划",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(blockedVideo.status === "blocked", "plan-only video request should block");
assert(blockedVideo.projectVibeWritten === false, "blocked video request must not write Project.vibe");
assert(!blockedVideo.nextRuntimeState, "blocked video request must not rebuild a next runtime state");
assert(blockedVideo.blockedReasons.some((reason) => reason.includes("当前还不能提交视频")), "blocked video request should explain submit permission");
assert(blockedVideo.providerCalled === false && blockedVideo.workerSpawned === false, "blocked video request must not call providers or workers");

const unrelatedInvalidVideoProject = JSON.parse(JSON.stringify(project)) as ProjectVibeDocument;
unrelatedInvalidVideoProject.shots = unrelatedInvalidVideoProject.shots.map((shot) =>
  shot.id === "shot_001"
    ? {
        ...shot,
        referenceStrategy: "omni_reference",
        visibleClips: 1,
        storyboardPanels: 3,
        sceneGuidance: ["Old Station"],
        characterGuidance: ["Mira"],
      }
    : {
        ...shot,
        sceneGuidance: ["Old Station"],
        characterGuidance: ["Mira"],
      },
);
const unrelatedInvalidRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project: unrelatedInvalidVideoProject,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
});
const scopedRuleQaVideo = runDirectorProductAgentLoop({
  project: unrelatedInvalidVideoProject,
  runtimeState: unrelatedInvalidRuntimeState,
  userIntent: "现在提交视频",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(scopedRuleQaVideo.status === "awaiting_confirmation", "selected-shot video QA should not be blocked by unrelated project shots");
assert(scopedRuleQaVideo.ruleQaReport?.status === "pass", "Rule QA should run only against the selected video scope");
assert(scopedRuleQaVideo.ruleQaReport?.findings.every((finding) => finding.path.includes("shot_002") || !finding.path.includes("shot_001")), "Rule QA findings should not mention unrelated shots");

const invalidVideoProject = JSON.parse(JSON.stringify(project)) as ProjectVibeDocument;
invalidVideoProject.shots = invalidVideoProject.shots.map((shot) => {
  if (shot.id !== "shot_002") {
    return {
      ...shot,
      sceneGuidance: ["Old Station"],
      characterGuidance: ["Mira"],
    };
  }
  return {
    ...shot,
    referenceStrategy: "omni_reference",
    visibleClips: 1,
    storyboardPanels: 2,
    sceneGuidance: ["Old Station"],
    characterGuidance: ["Mira"],
  };
});
const invalidRuntimeState = buildProjectRuntimeStateFromProjectVibe({
  project: invalidVideoProject,
  projectRoot,
  projectPath: projectVibeFileName,
  generatedAt,
});
const ruleQaBlockedVideo = runDirectorProductAgentLoop({
  project: invalidVideoProject,
  runtimeState: invalidRuntimeState,
  userIntent: "现在提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(ruleQaBlockedVideo.status === "blocked", "Rule QA blockers should stop the product Agent before video handoff");
assert(ruleQaBlockedVideo.action.status === "blocked", "Rule QA blockers should mark the staged Agent action as blocked");
assert(ruleQaBlockedVideo.ruleQaReport?.status === "blocked", "Rule QA report should be exposed on the product Agent result");
assert(ruleQaBlockedVideo.qaFeedback?.status === "blocked", "Rule QA blockers should expose creator-facing QA feedback");
assert(ruleQaBlockedVideo.action.userFacingMessage === ruleQaBlockedVideo.qaFeedback?.summary, "blocked Agent action should use creator-facing QA feedback instead of raw internals");
assert(ruleQaBlockedVideo.ruleQaReport?.findings.some((finding) => finding.code === "omni_has_storyboard_panels"), "Rule QA should catch mixed omni/storyboard contracts");
assert(!ruleQaBlockedVideo.confirmResult, "Rule QA blocked video should not enter Project.vibe confirmation");
assert(ruleQaBlockedVideo.projectVibeWritten === false, "Rule QA blocked video must not write Project.vibe");
assert(ruleQaBlockedVideo.toolInvocationReady === false, "Rule QA blocked video must not expose a tool invocation");
assert(ruleQaBlockedVideo.blockedReasons.some((reason) => reason.includes("全能参考模式")), "Rule QA blocker should be visible as a human-readable reason");

const ruleQaInspection = runDirectorProductAgentLoop({
  project: invalidVideoProject,
  runtimeState: invalidRuntimeState,
  userIntent: "现在项目还有什么问题？",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(ruleQaInspection.action.kind === "inspect_project_status", "project issue questions should stay in read-only inspection mode");
assert(ruleQaInspection.status === "inspected", "project inspection should report QA findings without becoming a write action");
assert(ruleQaInspection.action.status === "staged", "read-only inspection action should not be blocked by QA findings");
assert(ruleQaInspection.ruleQaReport?.status === "blocked", "read-only inspection should run whole-project Rule QA");
assert(ruleQaInspection.qaFeedback?.status === "blocked", "read-only inspection should expose creator-facing QA feedback");
assert(ruleQaInspection.qaFeedback?.summary.includes("全能参考和故事板字段混在一起"), "inspection feedback should name the QA issue");
assert(ruleQaInspection.projectVibeWritten === false, "read-only inspection must not write Project.vibe even when QA finds blockers");
assert(ruleQaInspection.toolInvocationReady === false, "read-only inspection must not expose tool invocation");
assert(!ruleQaInspection.confirmResult, "read-only inspection must not confirm a Project.vibe transaction");

const ruleQaRepairFollowup = runDirectorProductAgentLoop({
  project: invalidVideoProject,
  runtimeState: invalidRuntimeState,
  userIntent: "按项目检查修复：复杂动作改用故事板叙事/快切；简单段落保留全能参考。",
  userConfirmed: false,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert(ruleQaRepairFollowup.status === "awaiting_confirmation", "QA repair follow-up should stage a fix instead of applying directly");
assert(ruleQaRepairFollowup.action.kind === "update_shot_strategy", "QA repair follow-up should route strategy fixes to the selected shot");
assert(ruleQaRepairFollowup.action.proposedChanges.some((change) => change.field === "referenceStrategy" && change.to === "故事板快切"), "QA repair follow-up should propose a concrete storyboard strategy fix");
assert(ruleQaRepairFollowup.projectVibeWritten === false, "QA repair follow-up must wait for user confirmation before writing Project.vibe");

const textQaBlockedVideo = runDirectorProductAgentLoop({
  project,
  runtimeState,
  userIntent: "现在提交视频",
  userConfirmed: true,
  generatedAt,
  projectRoot,
  projectPath: projectVibeFileName,
  selection: {
    currentView: "story",
    selectedShotId: "shot_002",
  },
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
  textQaReport: {
    schemaVersion: "director_text_qa_v1",
    status: "blocked",
    providerCalled: true,
    runtimeExternalNetworkCallMade: false,
    summary: "文本 QA 发现参考策略冲突。",
    blockerCount: 1,
    warningCount: 0,
    infoCount: 0,
    findings: [
      {
        code: "storyboard_scene_scope_conflict",
        severity: "blocker",
        category: "reference_strategy",
        path: "shots.shot_002.referenceStrategy",
        message: "同一个故事板覆盖了不同场景，容易导致视频空间混乱。",
        suggestedFix: "拆成不同故事板，或把这段改成全能参考。",
        rewriteHint: "把不同场景拆成独立视频段。",
      },
    ],
    rewriteHints: ["把不同场景拆成独立视频段。"],
  },
});
assert(textQaBlockedVideo.status === "blocked", "Text QA blockers should stop the product Agent before video handoff");
assert(textQaBlockedVideo.action.status === "blocked", "Text QA blockers should mark the staged Agent action as blocked");
assert(textQaBlockedVideo.textQaReport?.status === "blocked", "Text QA report should be exposed on the product Agent result");
assert(textQaBlockedVideo.qaFeedback?.status === "blocked", "Text QA blockers should expose creator-facing QA feedback");
assert(textQaBlockedVideo.action.userFacingMessage === textQaBlockedVideo.qaFeedback?.summary, "blocked Agent action should use text QA feedback in the staged message");
assert(!textQaBlockedVideo.confirmResult, "Text QA blocked video should not enter Project.vibe confirmation");
assert(textQaBlockedVideo.projectVibeWritten === false, "Text QA blocked video must not write Project.vibe");
assert(textQaBlockedVideo.toolInvocationReady === false, "Text QA blocked video must not expose a tool invocation");
assert(textQaBlockedVideo.blockedReasons.some((reason) => reason.includes("不同场景")), "Text QA blocker should be visible as a human-readable reason");

console.log("director-product-agent-loop-test passed");
