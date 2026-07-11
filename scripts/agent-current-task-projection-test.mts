import {
  buildAgentCurrentTaskProjection,
  type AgentCurrentTaskConfirmation,
  type AgentCurrentTaskIntentRouteLike,
} from "../src/core/agentCurrentTaskProjection.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  transitionAgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import {
  buildProjectObservation,
  routeProjectAgentIntent,
} from "../src/core/projectAgentWorkspace.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function factValue(facts: Array<{ label: string; value: string }>, label: string) {
  return facts.find((fact) => fact.label === label)?.value || "";
}

function route(input: Parameters<typeof routeProjectAgentIntent>[0]): AgentCurrentTaskIntentRouteLike {
  const routed = routeProjectAgentIntent(input);
  return {
    kind: routed.kind,
    label: routed.label,
    confirmation: routed.confirmation,
    plan: routed.plan,
  };
}

function observation(input: {
  localProjectReady: boolean;
  shotCount: number;
  referenceMissingCount: number;
  referenceReviewCount?: number;
  referenceReadyCount?: number;
  videoSubmitted?: boolean;
}) {
  return buildProjectObservation({
    localProjectReady: input.localProjectReady,
    projectTitle: "雨夜便利店",
    sectionCount: 1,
    shotCount: input.shotCount,
    selectedShotCount: 0,
    referenceMissingCount: input.referenceMissingCount,
    referenceReviewCount: input.referenceReviewCount || 0,
    referenceReadyCount: input.referenceReadyCount || 0,
    videoStatus: input.videoSubmitted ? "submitted" : "not_generated",
    videoStatusLabel: input.videoSubmitted ? "已发送" : "未提交视频",
    videoDetail: input.videoSubmitted ? "视频已提交。" : "先完成参考。",
    videoWaitingCount: input.videoSubmitted ? 1 : 0,
    videoCompletedCount: 0,
    videoReviewCount: 0,
    videoCanResume: false,
    image2Running: false,
  });
}

function plan(input: {
  storyDraftPresent: boolean;
  storyConfirmed: boolean;
  localProjectReady: boolean;
  referenceMissingCount: number;
  videoSubmitted: boolean;
}) {
  return buildAgentVideoPipelinePlan({
    planId: "agent_current_task_projection_test",
    generatedAt: "2026-07-07T00:00:00.000Z",
    storyDraftPresent: input.storyDraftPresent,
    storyConfirmed: input.storyConfirmed,
    localProjectReady: input.localProjectReady,
    referenceMissingCount: input.referenceMissingCount,
    videoSubmitted: input.videoSubmitted,
  });
}

const newVideoDraftProjection = buildAgentCurrentTaskProjection({
  newVideoDraft: {
    status: "ready",
    title: "确认这版故事",
    confirmationId: "new_video_confirmation_story",
    draftShotCount: 2,
  },
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: false,
    localProjectReady: false,
    referenceMissingCount: 2,
    videoSubmitted: false,
  }),
  projectStatus: {
    facts: [
      { label: "项目", value: "草案未保存" },
      { label: "镜头", value: "草案 2 个" },
    ],
  },
});
assert(newVideoDraftProjection.step === "confirm_story", "new video draft should make confirm_story the current task");
assert(newVideoDraftProjection.source === "new_video_draft", "new video confirmation should come from the new-video draft source");
assert(newVideoDraftProjection.confirmationKind === "pipeline_action", "new video confirmation must expose a structured pipeline confirmation kind");
assert(newVideoDraftProjection.requiresConfirmation, "new video draft confirmation must require confirmation");
assert(newVideoDraftProjection.confirmationId === "new_video_confirmation_story", "new video confirmation id should be preserved");
assert(factValue(newVideoDraftProjection.facts, "镜头").includes("2"), "new video draft projection should keep the two-shot fact");

const displayCopyOnlyProjection = buildAgentCurrentTaskProjection({
  projectStatus: {
    stage: "可以导出",
    doing: "导出交付包",
    waitingFor: "确认导出",
    nextAction: "继续导出",
  },
});
assert(displayCopyOnlyProjection.step === "idle", "display copy alone must not classify the current task");
assert(!displayCopyOnlyProjection.requiresConfirmation, "display copy alone must not create a confirmation boundary");

const confirmedUnsavedObservation = observation({
  localProjectReady: false,
  shotCount: 2,
  referenceMissingCount: 2,
});
const confirmedStoryProjection = buildAgentCurrentTaskProjection({
  projectObservation: confirmedUnsavedObservation,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: false,
    referenceMissingCount: 2,
    videoSubmitted: false,
  }),
  projectStatus: {
    facts: [
      { label: "故事", value: "2 镜头" },
      { label: "参考", value: "缺 2 张" },
      { label: "视频", value: "未生成" },
    ],
  },
});
assert(confirmedStoryProjection.step === "choose_save_location", "confirmed story should move to choose_save_location");
assert(confirmedStoryProjection.source === "pipeline_plan", "unsaved confirmed story should be driven by the pipeline plan");
assert(confirmedStoryProjection.effect === "state_only", "choose_save_location must be state-only");
assert(!confirmedStoryProjection.jobId, "choose_save_location must not create or focus a generation job");
assert(factValue(confirmedStoryProjection.facts, "故事").includes("2"), "confirmed story projection should preserve the two-shot story fact");

const pendingProjectEditProjection = buildAgentCurrentTaskProjection({
  projectObservation: confirmedUnsavedObservation,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: false,
    referenceMissingCount: 2,
    videoSubmitted: false,
  }),
  timelineConfirmations: [{
    confirmationId: "current_story_edit_confirmation",
    step: "confirm_story",
    status: "waiting",
    kind: "project_edit",
    actionId: "current_story_edit_action",
    createdAt: "2026-07-07T00:00:01.000Z",
  }],
});
assert(pendingProjectEditProjection.step === "confirm_story", "a current project edit must preempt downstream save-location work");
assert(pendingProjectEditProjection.source === "timeline_confirmation", "a current project edit must be selected inside the projection");
assert(pendingProjectEditProjection.confirmationKind === "project_edit", "a current project edit must expose its structured confirmation kind");
assert(pendingProjectEditProjection.confirmationId === "current_story_edit_confirmation", "the current project-edit confirmation id must be preserved");

const restoredProjectEditProjection = buildAgentCurrentTaskProjection({
  projectObservation: confirmedUnsavedObservation,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: false,
    referenceMissingCount: 2,
    videoSubmitted: false,
  }),
  restoredStagedPlan: {
    status: "restored",
    step: "confirm_story",
    kind: "project_edit",
    confirmationId: "restored_story_edit_confirmation",
    actionId: "restored_story_edit_action",
    createdAt: "2026-07-07T00:00:02.000Z",
  },
});
assert(restoredProjectEditProjection.step === "confirm_story", "a restored project edit must preempt downstream save-location work");
assert(restoredProjectEditProjection.source === "staged_plan", "a restored project edit must remain projection-owned after restart");

const missingReferencesObservation = observation({
  localProjectReady: true,
  shotCount: 2,
  referenceMissingCount: 2,
});
const missingReferencesPlan = plan({
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const sendVideoRoute = route({
  text: "发送视频",
  hasSelection: true,
  hasAttachments: false,
  observation: missingReferencesObservation,
});
const sendVideoProjection = buildAgentCurrentTaskProjection({
  projectObservation: missingReferencesObservation,
  intentRoute: sendVideoRoute,
  pipelinePlan: missingReferencesPlan,
});
assert(sendVideoProjection.step === "prepare_references", "send-video with missing references must route to prepare_references");
assert(sendVideoProjection.step !== "submit_video", "send-video with missing references must not become submit_video");
assert(sendVideoProjection.label === "补参考", "a blocked send-video route must label the current prerequisite instead of the requested downstream action");
assert(sendVideoProjection.requiresConfirmation, "reference preparation must keep a confirmation boundary");
assert(sendVideoProjection.effect === "generation_job", "reference preparation should be a generation job only after confirmation");

const startReferenceRoute = route({
  text: "开始补参考",
  hasSelection: true,
  hasAttachments: false,
  observation: missingReferencesObservation,
});
const startReferenceProjection = buildAgentCurrentTaskProjection({
  projectObservation: missingReferencesObservation,
  intentRoute: startReferenceRoute,
  pipelinePlan: missingReferencesPlan,
});
assert(startReferenceProjection.step === "prepare_references", "start-reference should output prepare_references");
assert(startReferenceProjection.step !== "submit_video" && startReferenceProjection.step !== "export", "start-reference must not jump to video or export");
assert(startReferenceProjection.requiresConfirmation, "start-reference must preserve the confirmation boundary");

const saveLocationRoute = route({
  text: "选择保存位置",
  hasSelection: false,
  hasAttachments: false,
  observation: confirmedUnsavedObservation,
});
const saveLocationProjection = buildAgentCurrentTaskProjection({
  projectObservation: confirmedUnsavedObservation,
  intentRoute: saveLocationRoute,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: false,
    referenceMissingCount: 2,
    videoSubmitted: false,
  }),
});
assert(saveLocationProjection.step === "choose_save_location", "save-location route should only output project setup");
assert(saveLocationProjection.effect === "state_only", "save-location route must not generate references, submit video, or export");
assert(!saveLocationProjection.jobId, "save-location route must not focus a job");

const blockedExportProjection = buildAgentCurrentTaskProjection({
  projectObservation: confirmedUnsavedObservation,
  intentRoute: route({
    text: "导出交付包",
    hasSelection: false,
    hasAttachments: false,
    observation: confirmedUnsavedObservation,
  }),
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: false,
    referenceMissingCount: 2,
    videoSubmitted: false,
  }),
});
assert(blockedExportProjection.step === "choose_save_location", "export from an unsaved story must stop at save-location setup");
assert(blockedExportProjection.label === "选择保存位置", "blocked export must label the current prerequisite instead of export");

const exportReadyObservation = observation({
  localProjectReady: true,
  shotCount: 2,
  referenceMissingCount: 0,
  referenceReadyCount: 2,
  videoSubmitted: true,
});
const exportRoute = route({
  text: "导出交付包",
  hasSelection: true,
  hasAttachments: false,
  observation: exportReadyObservation,
});
const exportProjection = buildAgentCurrentTaskProjection({
  projectObservation: exportReadyObservation,
  intentRoute: exportRoute,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: true,
    referenceMissingCount: 0,
    videoSubmitted: true,
  }),
});
assert(exportProjection.step === "export", "export route should output export");
assert(exportProjection.requiresConfirmation, "export must require confirmation");
assert(exportProjection.effect === "local_export", "export should be a local export effect");

const completedExportProjection = buildAgentCurrentTaskProjection({
  projectObservation: exportReadyObservation,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: true,
    referenceMissingCount: 0,
    videoSubmitted: true,
  }),
  currentProjectFactHash: "facts-current",
  completedSteps: [{
    step: "export",
    projectFactHash: "facts-current",
  }],
});
assert(completedExportProjection.step === "idle", "completed export should not remain the current confirmation task");
assert(!completedExportProjection.requiresConfirmation, "completed export should not require another confirmation");
assert(!completedExportProjection.confirmationId, "completed export should not expose a stale confirmation id");

const validatedExportProjection = buildAgentCurrentTaskProjection({
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: true,
    referenceMissingCount: 0,
    videoSubmitted: true,
  }),
  currentProjectFactHash: "facts-current",
  completedSteps: [{
    step: "export",
    projectFactHash: "facts-current",
    executionMode: "dry_run",
  }],
});
assert(validatedExportProjection.step === "idle", "dry export validation should close only the validation pipeline boundary");
assert(validatedExportProjection.label === "执行边界验证完成", "dry export completion must not claim a real export package exists");

const staleFactExportCompletionProjection = buildAgentCurrentTaskProjection({
  projectObservation: exportReadyObservation,
  pipelinePlan: plan({
    storyDraftPresent: true,
    storyConfirmed: true,
    localProjectReady: true,
    referenceMissingCount: 0,
    videoSubmitted: true,
  }),
  currentProjectFactHash: "facts-current",
  completedSteps: [{
    step: "export",
    projectFactHash: "facts-before-project-change",
  }],
});
assert(staleFactExportCompletionProjection.step === "export", "an export completed for older project facts must not complete the current export task");
assert(staleFactExportCompletionProjection.requiresConfirmation, "changed project facts must require a fresh export confirmation");

const oldExportConfirmation: AgentCurrentTaskConfirmation = {
  confirmationId: "old_export_confirmation",
  step: "export",
  status: "waiting",
  createdAt: "2026-07-07T00:00:10.000Z",
};
const staleExportProjection = buildAgentCurrentTaskProjection({
  projectObservation: missingReferencesObservation,
  pipelinePlan: missingReferencesPlan,
  timelineConfirmations: [oldExportConfirmation],
});
assert(staleExportProjection.step === "prepare_references", "stale export confirmation must not steal the current reference task");
assert(staleExportProjection.source !== "timeline_confirmation", "stale mismatched confirmation must not be the projection source");
assert(staleExportProjection.confirmationId !== "old_export_confirmation", "stale mismatched confirmation id must be ignored");

const clearedPlanSuppressesOldConfirmation = buildAgentCurrentTaskProjection({
  projectObservation: missingReferencesObservation,
  pipelinePlan: missingReferencesPlan,
  restoredStagedPlan: {
    status: "cleared",
    clearedAt: "2026-07-07T00:00:20.000Z",
  },
  timelineConfirmations: [{
    confirmationId: "old_reference_confirmation",
    step: "prepare_references",
    status: "waiting",
    createdAt: "2026-07-07T00:00:12.000Z",
  }],
});
assert(clearedPlanSuppressesOldConfirmation.step === "prepare_references", "cleared staged plan should keep the current pipeline step");
assert(clearedPlanSuppressesOldConfirmation.source === "pipeline_plan", "cleared staged plan should suppress older waiting confirmations");
assert(!clearedPlanSuppressesOldConfirmation.confirmationId, "cleared staged plan should not restore the old confirmation id");

const activeStagedPlanProjection = buildAgentCurrentTaskProjection({
  projectObservation: missingReferencesObservation,
  pipelinePlan: missingReferencesPlan,
  restoredStagedPlan: {
    status: "restored",
    step: "prepare_references",
    confirmationId: "restored_reference_confirmation",
    actionId: "restored_reference_action",
    createdAt: "2026-07-07T00:00:30.000Z",
  },
});
assert(activeStagedPlanProjection.source === "staged_plan", "active staged plan should become the projection source when it matches the current step");
assert(activeStagedPlanProjection.confirmationId === "restored_reference_confirmation", "active staged plan confirmation id should be preserved");

for (const invalidRestoreStatus of ["expired", "project_mismatch", "root_mismatch", "fact_hash_mismatch", "invalid"] as const) {
  const invalidRestoreProjection = buildAgentCurrentTaskProjection({
    projectObservation: missingReferencesObservation,
    pipelinePlan: missingReferencesPlan,
    restoredStagedPlan: {
      status: invalidRestoreStatus,
      step: "prepare_references",
      confirmationId: `${invalidRestoreStatus}_reference_confirmation`,
      actionId: `${invalidRestoreStatus}_reference_action`,
      createdAt: "2026-07-07T00:00:31.000Z",
    },
  });
  assert(invalidRestoreProjection.source === "pipeline_plan", `${invalidRestoreStatus} staged plan must not become the current task source`);
  assert(!invalidRestoreProjection.confirmationId, `${invalidRestoreStatus} staged plan must not expose a restored confirmation id`);
}

const newerConfirmationAfterClearedPlan = buildAgentCurrentTaskProjection({
  projectObservation: missingReferencesObservation,
  pipelinePlan: missingReferencesPlan,
  restoredStagedPlan: {
    status: "cleared",
    clearedAt: "2026-07-07T00:00:20.000Z",
  },
  timelineConfirmations: [{
    confirmationId: "new_reference_confirmation_after_clear",
    step: "prepare_references",
    status: "waiting",
    createdAt: "2026-07-07T00:00:21.000Z",
  }],
});
assert(newerConfirmationAfterClearedPlan.source === "timeline_confirmation", "cleared staged plan should not suppress newer confirmations");
assert(newerConfirmationAfterClearedPlan.confirmationId === "new_reference_confirmation_after_clear", "newer confirmation after a cleared marker should restore");

const submitVideoPlan = plan({
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
const mismatchedWaitingConfirmation = buildAgentCurrentTaskProjection({
  projectObservation: observation({
    localProjectReady: true,
    shotCount: 2,
    referenceMissingCount: 0,
    referenceReadyCount: 2,
  }),
  pipelinePlan: submitVideoPlan,
  timelineConfirmations: [{
    confirmationId: "old_reference_confirmation_after_refs_ready",
    step: "prepare_references",
    status: "waiting",
    createdAt: "2026-07-07T00:00:40.000Z",
  }],
});
assert(mismatchedWaitingConfirmation.step === "submit_video", "old reference confirmation should not block submit_video after references are ready");
assert(mismatchedWaitingConfirmation.source !== "timeline_confirmation", "waiting confirmation must match the current step before restoring");

const matchingSubmitConfirmation = buildAgentCurrentTaskProjection({
  projectObservation: observation({
    localProjectReady: true,
    shotCount: 2,
    referenceMissingCount: 0,
    referenceReadyCount: 2,
  }),
  pipelinePlan: submitVideoPlan,
  timelineConfirmations: [{
    confirmationId: "current_submit_video_confirmation",
    step: "submit_video",
    status: "waiting",
    createdAt: "2026-07-07T00:00:41.000Z",
  }],
});
assert(matchingSubmitConfirmation.source === "timeline_confirmation", "matching waiting confirmation should restore");
assert(matchingSubmitConfirmation.confirmationId === "current_submit_video_confirmation", "matching waiting confirmation id should be preserved");

let videoLedger: AgentVideoGenerationJobLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "agent_current_task_projection_video_ledger",
  projectId: "agent-current-task-project",
  projectRoot: "/tmp/agent-current-task-project",
  projectFactHash: "agent-current-task-facts",
  createdAt: "2026-07-07T00:00:00.000Z",
});
const stagedVideo = planAgentVideoProductionAction({
  plan: submitVideoPlan,
  ledger: videoLedger,
  action: "submit_video",
  actionId: "submit_video_action",
  generatedAt: "2026-07-07T00:00:50.000Z",
  sourceConfirmationId: "submit_video_confirmation",
  prompt: "submit current story video",
});
assert(stagedVideo.job, "video submit should stage a dry-run job for projection tests");
videoLedger = stagedVideo.ledger;
const jobProjection = buildAgentCurrentTaskProjection({
  pipelinePlan: submitVideoPlan,
  jobLedger: videoLedger,
  currentProjectId: "agent-current-task-project",
  currentProjectRoot: "/tmp/agent-current-task-project",
  currentProjectFactHash: "agent-current-task-facts",
});
assert(jobProjection.source === "pipeline_job", "non-terminal pipeline job should become the current task source");
assert(jobProjection.jobId === stagedVideo.job!.jobId, "current job id should be exposed");

const confirmationBeforeJobProjection = buildAgentCurrentTaskProjection({
  pipelinePlan: submitVideoPlan,
  jobLedger: videoLedger,
  currentProjectId: "agent-current-task-project",
  currentProjectRoot: "/tmp/agent-current-task-project",
  currentProjectFactHash: "agent-current-task-facts",
  timelineConfirmations: [{
    confirmationId: "current-confirmation-before-job",
    step: "submit_video",
    status: "waiting",
    projectId: "agent-current-task-project",
    projectRoot: "/tmp/agent-current-task-project",
    projectFactHash: "agent-current-task-facts",
    createdAt: "2026-07-07T00:00:51.000Z",
  }],
});
assert(confirmationBeforeJobProjection.source === "timeline_confirmation", "a valid current confirmation must outrank a non-terminal job");

const staleConfirmationYieldsToJob = buildAgentCurrentTaskProjection({
  pipelinePlan: submitVideoPlan,
  jobLedger: videoLedger,
  currentProjectId: "agent-current-task-project",
  currentProjectRoot: "/tmp/agent-current-task-project",
  currentProjectFactHash: "agent-current-task-facts",
  timelineConfirmations: [{
    confirmationId: "stale-confirmation-before-job",
    step: "submit_video",
    status: "waiting",
    projectId: "agent-current-task-project",
    projectRoot: "/tmp/agent-current-task-project",
    projectFactHash: "old-agent-current-task-facts",
    createdAt: "2026-07-07T00:00:51.000Z",
  }],
});
assert(staleConfirmationYieldsToJob.source === "pipeline_job", "a confirmation from old project facts must yield to the current non-terminal job");

const clearedConfirmationYieldsToJob = buildAgentCurrentTaskProjection({
  pipelinePlan: submitVideoPlan,
  jobLedger: videoLedger,
  currentProjectId: "agent-current-task-project",
  currentProjectRoot: "/tmp/agent-current-task-project",
  currentProjectFactHash: "agent-current-task-facts",
  restoredStagedPlan: {
    status: "cleared",
    clearedAt: "2026-07-07T00:00:52.000Z",
  },
  timelineConfirmations: [{
    confirmationId: "cleared-confirmation-before-job",
    step: "submit_video",
    status: "waiting",
    projectId: "agent-current-task-project",
    projectRoot: "/tmp/agent-current-task-project",
    projectFactHash: "agent-current-task-facts",
    createdAt: "2026-07-07T00:00:51.000Z",
  }],
});
assert(clearedConfirmationYieldsToJob.source === "pipeline_job", "a cleared confirmation must yield to the non-terminal job");

const mismatchedJobProjection = buildAgentCurrentTaskProjection({
  pipelinePlan: submitVideoPlan,
  jobLedger: videoLedger,
  currentProjectId: "agent-current-task-project",
  currentProjectRoot: "/tmp/agent-current-task-project",
  currentProjectFactHash: "different-current-facts",
});
assert(mismatchedJobProjection.source === "pipeline_plan", "a job from old project facts must not restore as current");
assert(!mismatchedJobProjection.jobId, "a mismatched job must not expose its id");

const confirmedVideo = transitionAgentVideoGenerationJob({
  ledger: videoLedger,
  jobId: stagedVideo.job!.jobId,
  status: "confirmed",
  generatedAt: "2026-07-07T00:00:51.000Z",
});
assert(confirmedVideo.ok, "staged video job should confirm");
const runningVideo = transitionAgentVideoGenerationJob({
  ledger: confirmedVideo.ledger,
  jobId: stagedVideo.job!.jobId,
  status: "running",
  generatedAt: "2026-07-07T00:00:52.000Z",
});
assert(runningVideo.ok, "confirmed video job should run");
const succeededVideo = transitionAgentVideoGenerationJob({
  ledger: runningVideo.ledger,
  jobId: stagedVideo.job!.jobId,
  status: "succeeded",
  generatedAt: "2026-07-07T00:00:53.000Z",
});
assert(succeededVideo.ok, "running video job should succeed");
const terminalJobProjection = buildAgentCurrentTaskProjection({
  pipelinePlan: submitVideoPlan,
  jobLedger: succeededVideo.ledger,
  currentProjectId: "agent-current-task-project",
  currentProjectRoot: "/tmp/agent-current-task-project",
  currentProjectFactHash: "agent-current-task-facts",
});
assert(terminalJobProjection.source === "pipeline_plan", "terminal jobs must not become the current task source");
assert(!terminalJobProjection.jobId, "terminal jobs should not expose a current job id");

console.log("agent-current-task-projection-test passed");
