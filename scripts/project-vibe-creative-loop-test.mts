import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildProjectRuntimeStateFromProjectVibe,
  confirmProjectVibeCreativeLoop,
  createProjectVibe,
  hashProjectVibeFacts,
  parseProjectVibeText,
  projectVibeFileName,
  stageProjectVibeCreativeLoop,
  type ProjectVibeDocument,
} from "../src/project/index.ts";
import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
} from "../src/core/directorAgentAction.ts";
import { buildDirectorAgentToolHandoff } from "../src/core/directorAgentToolHandoff.ts";
import { openLocalProjectVibe, saveLocalProjectVibe } from "../src/project/localProjectVibeStorage.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-16T01:00:00.000Z";
const tempRoot = mkdtempSync(join(tmpdir(), "project-vibe-creative-loop-"));

try {
  const emptyProject = createProjectVibe({
    projectId: "empty_p1_project",
    title: "Empty P1 Project",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });
  const emptySave = await saveLocalProjectVibe(tempRoot, emptyProject, projectVibeFileName);
  assert(emptySave.ok, `empty Project.vibe should save: ${emptySave.errors.join("; ")}`);
  const emptyOpen = await openLocalProjectVibe(tempRoot, projectVibeFileName);
  assert(emptyOpen.ok && emptyOpen.project, `empty Project.vibe should reopen: ${emptyOpen.errors.join("; ")}`);
  const emptyRuntime = buildProjectRuntimeStateFromProjectVibe({
    project: emptyOpen.project,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    generatedAt,
  });
  assert(emptyRuntime.project.title === "Empty P1 Project", "empty project title should restore into runtime state");

  const fixtureText = readFileSync("test-fixtures/projects/agent-loop-minimal/project.vibe", "utf8");
  const openedFixture = parseProjectVibeText(fixtureText);
  assert(openedFixture.ok && openedFixture.project, `fixture should open: ${openedFixture.errors.join("; ")}`);
  const project = openedFixture.project as ProjectVibeDocument;
  const projectBeforeHash = hashProjectVibeFacts(project);
  const selectedShotBefore = project.shots.find((shot) => shot.id === "shot_002");
  assert(selectedShotBefore, "fixture should contain selected shot_002");
  const selectedShotIntentBefore = selectedShotBefore.intent;
  const restoredRuntime = buildProjectRuntimeStateFromProjectVibe({
    project,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    generatedAt,
  });
  assert(restoredRuntime.storyFlow.shots.some((shot) => shot.id === "shot_002"), "existing project should restore shot_002");
  assert(restoredRuntime.visualMemory.assets.some((asset) => asset.id === "asset_char_mira"), "existing project should restore assets");

  const userIntent = "让这个镜头更紧张，保留角色和场景";
  const staged = stageProjectVibeCreativeLoop({
    project,
    userIntent,
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
  });
  assert(staged.status === "awaiting_confirmation", `staged transaction should wait for confirmation: ${staged.blockedReasons.join("; ")}`);
  assert(staged.stagedTransaction.status === "pending", "natural-language intent must first become a staged pending transaction");
  assert(staged.stagedTransaction.projectVibeWriteAllowed === false, "staged transaction must keep Project.vibe writes locked");
  assert(staged.stagedTransaction.projectFactsWriteGate.requiresUserCommit === true, "staged transaction must require explicit user commit");
  assert(staged.stagedTransaction.projectFactsWriteGate.canWriteNow === false, "staged transaction must not be directly writable");
  assert(staged.stagedTransaction.sourceFacts.userIntent === userIntent, "staged transaction should retain the natural-language intent as source facts only");
  assert(staged.projectVibeWritten === false, "staging must not mutate Project.vibe");
  assert(staged.taskEnqueuePlan.noFreeTextTask === true, "staged queue plan must reject free text tasks");
  assert(staged.taskEnqueuePlan.summary.total > 0, "staged queue plan should contain task candidates");
  assert(staged.formalTaskEnvelopeEvidence.length === staged.taskEnqueuePlan.items.length, "stage should expose formal task envelope evidence for every packet candidate");
  assert(
    staged.formalTaskEnvelopeEvidence.every((item) => item.rawUserIntentAcceptedAsTask === false),
    "stage must not accept raw user intent as a formal task input",
  );
  assert(
    staged.formalTaskEnvelopeEvidence.every((item) => item.validatedForFormalQueue === false),
    "stage must not mark formal task envelopes queue-valid before confirmation",
  );
  assert(
    staged.taskEnqueuePlan.items.every((item) => item.queueStatus === "blocked" && item.validationErrors.includes("waiting_confirmation")),
    "formal tasks must stay blocked before confirmation",
  );
  assert(hashProjectVibeFacts(project) === projectBeforeHash, "staging must not write typed Project.vibe facts");
  assert(project.shots.find((shot) => shot.id === "shot_002")?.intent === selectedShotIntentBefore, "staging must not change selected shot intent");

  const unconfirmed = confirmProjectVibeCreativeLoop({
    project,
    userIntent,
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    userConfirmed: false,
  });
  assert(unconfirmed.status === "blocked_not_confirmed", "confirm path should fail closed without explicit confirmation");
  assert(unconfirmed.projectVibeWritten === false && !unconfirmed.nextProject, "unconfirmed path must not write project facts");
  assert(hashProjectVibeFacts(project) === projectBeforeHash, "unconfirmed path must not write typed Project.vibe facts");

  const confirmed = confirmProjectVibeCreativeLoop({
    project,
    userIntent,
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    userConfirmed: true,
  });
  assert(confirmed.status === "project_facts_written", `confirmation should write project facts: ${confirmed.blockedReasons.join("; ")}`);
  assert(confirmed.stagedTransaction.projectFactsWriteGate.requiresUserCommit === true, "confirmed transaction should still prove it crossed the user-commit gate");
  assert(confirmed.nextProject, "confirmed creative loop should return a next Project.vibe");
  assert(confirmed.runReceipt?.status === "planned", "confirmed creative loop should append a planned run receipt");
  const confirmedRunId = confirmed.runReceipt?.id;
  assert(confirmedRunId, "confirmed creative loop should expose the run receipt id");
  assert(confirmed.transactionReceipt?.status === "applied", `Project.vibe transaction should apply: ${confirmed.transactionReceipt?.errors.join("; ")}`);
  assert(
    confirmed.confirmationReceipt?.status === "confirmed" || confirmed.confirmationReceipt?.status === "blocked_queue",
    "confirmation receipt must either be fully confirmed or expose residual blocked queue candidates while validated envelopes continue",
  );
  assert(confirmed.stagedReceipt, "confirmation should produce a staged fact receipt for review");
  assert(confirmed.queuedTaskRunIds.length > 0, "confirmation should produce at least one queued validated task");
  assert(confirmed.taskEnqueuePlan.summary.queued === confirmed.queuedTaskRunIds.length, "queued summary should match queued task ids");
  assert(confirmed.taskEnqueuePlan.noFreeTextTask === true, "confirmed queue plan must keep no-free-text contract");
  assert(confirmed.taskEnqueuePlan.providerSubmissionForbidden === true, "confirmed queue plan must not submit providers");
  assert(confirmed.formalTaskInputsAreValidated === true, "confirmed queued tasks must be validated envelopes");
  assert(confirmed.freeTextFormalTaskBlocked === true, "free text must not enter formal tasks");
  assert(confirmed.providerCalled === false, "creative loop must not call providers");
  assert(
    confirmed.taskEnqueuePlan.items
      .filter((item) => item.queueStatus === "queued")
      .every((item) => item.taskEnvelopeId && item.expectedOutputs.length > 0 && item.validationErrors.length === 0),
    "queued items must carry validated task envelopes and expected outputs",
  );
  const queuedEnvelopeEvidence = confirmed.formalTaskEnvelopeEvidence.filter((item) => item.queueStatus === "queued");
  assert(queuedEnvelopeEvidence.length === confirmed.queuedTaskRunIds.length, "confirmed envelope evidence should match queued task runs");
  assert(
    queuedEnvelopeEvidence.every((item) =>
      item.validatedForFormalQueue &&
      item.taskEnvelopeId &&
      item.taskEnvelopeInputHash &&
      item.policyBinding &&
      item.sourceIndexHash &&
      item.expectedOutputs.length > 0 &&
      item.qaChecklist.length > 0 &&
      item.sourceFactTrace.length > 0 &&
      item.validationReceipt.status === "pass" &&
      item.validationErrors.length === 0 &&
      item.forbiddenActions.includes("no_free_text_task") &&
      item.forbiddenActions.includes("no_free_text_worker") &&
      item.rawUserIntentAcceptedAsTask === false
    ),
    "queued formal tasks must be validated envelope evidence, never raw free text",
  );
  assert(
    confirmed.workflow.taskPacketState.packets.every((packet) => packet.envelope?.userIntent !== userIntent),
    "raw free text intent must not enter the formal task envelope",
  );
  assert(hashProjectVibeFacts(confirmed.nextProject) !== projectBeforeHash, "Project.vibe fact hash should change after confirmation");
  assert(
    confirmed.nextProject.runs.some((run) => run.id === confirmed.runReceipt?.id && run.projectFactsMutated),
    "Project.vibe should retain the creative loop run receipt",
  );
  const confirmedShot = confirmed.nextProject.shots.find((shot) => shot.id === "shot_002");
  assert(confirmedShot, "confirmed Project.vibe should retain selected shot_002");
  assert(confirmedShot.intent !== selectedShotIntentBefore, "confirmed Project.vibe should write a typed shot intent fact");
  assert(confirmedShot.intent.includes(userIntent), "confirmed shot intent should retain the user's creative intent as a Project.vibe fact");
  assert(confirmedShot.intent.includes("Confirmed creator intent:"), "confirmed shot intent should mark the creative intent as confirmed");
  assert(confirmedShot.status === "planned", "confirmed shot should remain planned for downstream validated tasks");
  assert(confirmedShot.sourceRefs.includes(`project.vibe#runs/${confirmedRunId}`), "confirmed shot should link the creative loop run receipt");
  assert(confirmedShot.sourceRefs.includes("project.vibe#shots/shot_002/intent"), "confirmed shot should link its typed intent fact");
  assert(confirmed.runReceipt?.evidenceRefs.includes("project.vibe#shots/shot_002/intent"), "run receipt should cite the typed shot intent fact");
  assert(confirmed.transactionReceipt?.touched.shotIds.includes("shot_002"), "Project.vibe transaction should touch the selected shot fact");

  const agentAction = buildDirectorAgentActionEnvelope({
    userIntent: "这段改成故事板快切，先只写计划",
    snapshot: buildDirectorAgentStateSnapshot({
      runtimeState: restoredRuntime,
      selectedShotId: "shot_002",
      currentView: "story",
    }),
    executionContract: {
      mode: "plan_only",
      referenceGenerationAllowed: false,
      videoSubmitAllowed: false,
      providerSubmitAllowed: false,
      reason: "测试只允许写计划",
    },
    generatedAt,
  });
  assert(agentAction.status === "staged", `agent action should stage: ${agentAction.blockers.join("; ")}`);
  const agentToolHandoff = buildDirectorAgentToolHandoff({
    action: agentAction,
    userConfirmed: true,
    confirmedAt: generatedAt,
    availability: {
      projectReady: true,
      webSearchReady: true,
      referenceGenerationReady: true,
      videoSubmitReady: true,
      exportReady: true,
    },
  });
  const confirmedWithAgentAction = confirmProjectVibeCreativeLoop({
    project,
    userIntent: "这段改成故事板快切，先只写计划",
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    userConfirmed: true,
    agentActionEnvelope: agentAction,
    agentToolHandoff,
  });
  assert(confirmedWithAgentAction.status === "project_facts_written", "confirmed agent action should write Project.vibe facts");
  assert(confirmedWithAgentAction.projectVibeWritten === true, "confirmed agent action should write through Project.vibe");
  assert(confirmedWithAgentAction.providerCalled === false, "confirmed agent action must not call providers from the creative loop");
  assert(confirmedWithAgentAction.workerSpawned === false, "confirmed agent action must not spawn workers from the creative loop");
  assert(confirmedWithAgentAction.formalTaskInputsAreValidated === true, "confirmed agent action must keep validated formal task inputs");
  assert(confirmedWithAgentAction.freeTextFormalTaskBlocked === true, "confirmed agent action must keep raw text out of formal tasks");
  assert(
    confirmedWithAgentAction.runReceipt?.evidenceRefs.includes(`agentAction#${agentAction.actionId}`),
    "run receipt should cite the confirmed staged Agent action",
  );
  assert(
    confirmedWithAgentAction.runReceipt?.evidenceRefs.includes(`agentAction#${agentAction.actionId}/tool/project_vibe_patch`),
    "run receipt should cite the Agent tool plan",
  );
  assert(
    confirmedWithAgentAction.runReceipt?.evidenceRefs.includes(`agentToolHandoff#${agentToolHandoff.handoffId}`),
    "run receipt should cite the confirmed Agent tool handoff",
  );
  assert(
    confirmedWithAgentAction.runReceipt?.evidenceRefs.includes(`agentToolHandoff#${agentToolHandoff.handoffId}/handler/project_vibe_patch`),
    "run receipt should cite the Agent handoff handler",
  );
  assert(
    confirmedWithAgentAction.runReceipt?.summary.includes("Agent action:"),
    "run receipt summary should include the Agent action",
  );
  assert(
    confirmedWithAgentAction.runReceipt?.summary.includes("Agent tool handoff:"),
    "run receipt summary should include the Agent tool handoff",
  );

  const patchOnlyRuntime = {
    ...restoredRuntime,
    visualMemory: {
      ...restoredRuntime.visualMemory,
      assets: [],
    },
  } as typeof restoredRuntime;
  const patchOnlyAction = buildDirectorAgentActionEnvelope({
    userIntent: "这段改成全能参考，只改项目计划",
    snapshot: buildDirectorAgentStateSnapshot({
      runtimeState: patchOnlyRuntime,
      selectedShotId: "shot_002",
      currentView: "story",
    }),
    generatedAt,
  });
  assert(patchOnlyAction.status === "staged", `patch-only Agent action should stage: ${patchOnlyAction.blockers.join("; ")}`);
  assert(patchOnlyAction.toolPlan.toolName === "project_vibe_patch", "patch-only Agent action should stay in Project.vibe patch lane");
  const patchOnlyHandoff = buildDirectorAgentToolHandoff({
    action: patchOnlyAction,
    userConfirmed: true,
    confirmedAt: generatedAt,
    availability: {
      projectReady: true,
      webSearchReady: true,
      referenceGenerationReady: false,
      videoSubmitReady: false,
      exportReady: true,
    },
  });
  assert(patchOnlyHandoff.status === "handled_by_project_write", "patch-only handoff should be handled by Project.vibe writeback");
  const confirmedPatchOnly = confirmProjectVibeCreativeLoop({
    project,
    userIntent: "这段改成全能参考，只改项目计划",
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    runtimeState: patchOnlyRuntime,
    userConfirmed: true,
    agentActionEnvelope: patchOnlyAction,
    agentToolHandoff: patchOnlyHandoff,
  });
  assert(confirmedPatchOnly.status === "project_facts_written", `patch-only action should write project facts without provider tasks: ${confirmedPatchOnly.blockedReasons.join("; ")}`);
  assert(confirmedPatchOnly.queuedTaskRunIds.length === 0, "patch-only action should not enqueue provider tasks");
  assert(confirmedPatchOnly.providerCalled === false, "patch-only action must not call providers");
  assert(confirmedPatchOnly.workerSpawned === false, "patch-only action must not spawn workers");
  assert(confirmedPatchOnly.formalTaskInputsAreValidated === true, "patch-only action should still satisfy no-free-text formal task policy");
  assert(
    confirmedPatchOnly.runReceipt?.summary.includes("project update handled without provider task"),
    "patch-only run receipt should explain that no provider task was needed",
  );
  assert(
    confirmedPatchOnly.nextProject?.shots.find((shot) => shot.id === "shot_002")?.referenceStrategy === "omni_reference",
    "patch-only Agent strategy change should update the selected Project.vibe shot",
  );

  const blockedPatchHandoff = buildDirectorAgentToolHandoff({
    action: patchOnlyAction,
    userConfirmed: true,
    confirmedAt: generatedAt,
    availability: {
      projectReady: false,
      webSearchReady: true,
      referenceGenerationReady: false,
      videoSubmitReady: false,
      exportReady: true,
    },
  });
  assert(blockedPatchHandoff.status === "blocked", "patch-only handoff should block when no project is ready");
  const blockedPatchOnly = confirmProjectVibeCreativeLoop({
    project,
    userIntent: "这段改成全能参考，只改项目计划",
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    runtimeState: patchOnlyRuntime,
    userConfirmed: true,
    agentActionEnvelope: patchOnlyAction,
    agentToolHandoff: blockedPatchHandoff,
  });
  assert(blockedPatchOnly.status === "blocked", "blocked handoff should prevent Project.vibe writeback");
  assert(
    blockedPatchOnly.blockedReasons.includes("agent_tool_handoff_blocked:project_not_ready"),
    "blocked handoff should preserve project readiness blocker",
  );
  assert(blockedPatchOnly.projectVibeWritten === false, "blocked handoff must not write Project.vibe");

  const referenceAction = buildDirectorAgentActionEnvelope({
    userIntent: "可以先补齐参考素材",
    snapshot: buildDirectorAgentStateSnapshot({
      runtimeState: restoredRuntime,
      selectedShotId: "shot_002",
      currentView: "story",
    }),
    executionContract: {
      mode: "reference_allowed",
      referenceGenerationAllowed: true,
      videoSubmitAllowed: false,
      providerSubmitAllowed: true,
      reason: "测试允许交给参考生成工具，但 creative loop 自身不能调用 provider",
    },
    generatedAt,
  });
  assert(referenceAction.status === "staged", `reference agent action should stage: ${referenceAction.blockers.join("; ")}`);
  assert(referenceAction.toolPlan.toolName === "image2_reference_generation", "reference agent action should plan Image2 reference generation");
  const referenceToolHandoff = buildDirectorAgentToolHandoff({
    action: referenceAction,
    userConfirmed: true,
    confirmedAt: generatedAt,
    availability: {
      projectReady: true,
      webSearchReady: true,
      referenceGenerationReady: true,
      videoSubmitReady: true,
      exportReady: true,
    },
  });
  assert(referenceToolHandoff.status === "ready", "confirmed reference action should become a ready handoff");
  assert(referenceToolHandoff.invocation?.confirmation.expectedReceipt === "image_reference_receipt", "reference handoff should require an image receipt");
  const confirmedWithReferenceAction = confirmProjectVibeCreativeLoop({
    project,
    userIntent: "可以先补齐参考素材",
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    userConfirmed: true,
    agentActionEnvelope: referenceAction,
    agentToolHandoff: referenceToolHandoff,
  });
  assert(confirmedWithReferenceAction.status === "project_facts_written", "confirmed reference action should still write Project.vibe facts first");
  assert(confirmedWithReferenceAction.projectVibeWritten === true, "reference action should leave a Project.vibe receipt before tool invocation");
  assert(confirmedWithReferenceAction.providerCalled === false, "reference action creative loop must not call Image2 directly");
  assert(confirmedWithReferenceAction.workerSpawned === false, "reference action creative loop must not spawn the Image2 worker directly");
  assert(confirmedWithReferenceAction.formalTaskInputsAreValidated === true, "reference action must keep validated formal task inputs");
  assert(confirmedWithReferenceAction.freeTextFormalTaskBlocked === true, "reference action must keep raw text out of formal tasks");
  assert(
    confirmedWithReferenceAction.runReceipt?.evidenceRefs.includes(`agentAction#${referenceAction.actionId}`),
    "reference run receipt should cite the staged Agent action",
  );
  assert(
    confirmedWithReferenceAction.runReceipt?.evidenceRefs.includes(`agentAction#${referenceAction.actionId}/tool/image2_reference_generation`),
    "reference run receipt should cite the Image2 reference tool plan",
  );
  assert(
    confirmedWithReferenceAction.runReceipt?.evidenceRefs.includes(`agentToolHandoff#${referenceToolHandoff.handoffId}`),
    "reference run receipt should cite the Agent tool handoff",
  );
  assert(
    confirmedWithReferenceAction.runReceipt?.evidenceRefs.includes(`agentToolHandoff#${referenceToolHandoff.handoffId}/handler/image2_reference_generation`),
    "reference run receipt should cite the Image2 reference handoff handler",
  );
  assert(
    confirmedWithReferenceAction.runReceipt?.evidenceRefs.includes(`agentToolHandoff#${referenceToolHandoff.handoffId}/expected/image_reference_receipt`),
    "reference run receipt should cite the required image reference receipt",
  );
  assert(
    confirmedWithReferenceAction.runReceipt?.summary.includes("Agent action:") &&
      confirmedWithReferenceAction.runReceipt.summary.includes("Agent tool handoff:"),
    "reference run receipt should summarize both the staged action and tool handoff",
  );
  assert(
    confirmedWithReferenceAction.runReceipt?.summary.includes("controlled image2_reference_generation handoff prepared after Project.vibe write"),
    "reference run receipt should say the controlled tool was prepared after Project.vibe write instead of saying no provider task was queued",
  );
  const staleReadyHandoff = {
    ...referenceToolHandoff,
    actionId: "stale_action",
  };
  const blockedStaleReadyHandoff = confirmProjectVibeCreativeLoop({
    project,
    userIntent: "可以先补齐参考素材",
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    userConfirmed: true,
    agentActionEnvelope: referenceAction,
    agentToolHandoff: staleReadyHandoff,
  });
  assert(blockedStaleReadyHandoff.status === "blocked", "stale ready handoff must not satisfy the task envelope gate");
  assert(blockedStaleReadyHandoff.projectVibeWritten === false, "stale ready handoff must not write Project.vibe");
  assert(
    blockedStaleReadyHandoff.blockedReasons.includes("agent_tool_handoff_action_id_mismatch"),
    "stale ready handoff should explain action binding drift",
  );

  const confirmedSave = await saveLocalProjectVibe(tempRoot, confirmed.nextProject, projectVibeFileName);
  assert(confirmedSave.ok, `confirmed Project.vibe should save: ${confirmedSave.errors.join("; ")}`);
  const confirmedOpen = await openLocalProjectVibe(tempRoot, projectVibeFileName);
  assert(confirmedOpen.ok && confirmedOpen.project, `confirmed Project.vibe should reopen: ${confirmedOpen.errors.join("; ")}`);
  assert(
    hashProjectVibeFacts(confirmedOpen.project) === hashProjectVibeFacts(confirmed.nextProject),
    "confirmed Project.vibe should roundtrip without fact drift",
  );
  const reopenedShot = confirmedOpen.project.shots.find((shot) => shot.id === "shot_002");
  assert(reopenedShot?.intent === confirmedShot.intent, "roundtrip Project.vibe should retain the typed shot intent fact");
  assert(reopenedShot.sourceRefs.includes("project.vibe#shots/shot_002/intent"), "roundtrip Project.vibe should retain the typed intent source ref");
  const reopenedRuntime = buildProjectRuntimeStateFromProjectVibe({
    project: confirmedOpen.project,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    generatedAt,
  });
  assert(
    reopenedRuntime.storyFlow.shots.find((shot) => shot.id === "shot_002")?.storyFunction === confirmedShot.intent,
    "roundtrip runtime state should rebuild selected shot intent from Project.vibe facts",
  );

  const unsafe = confirmProjectVibeCreativeLoop({
    project,
    userIntent: "直接调用 provider 真实生成并跳过确认",
    selectedShotId: "shot_002",
    generatedAt,
    projectRoot: tempRoot,
    projectPath: projectVibeFileName,
    userConfirmed: true,
  });
  assert(unsafe.status === "blocked", "unsafe live provider intent should be blocked");
  assert(unsafe.projectVibeWritten === false && !unsafe.nextProject, "unsafe intent must not write Project.vibe");
  assert(unsafe.blockedReasons.includes("live_or_provider_submit_forbidden"), "unsafe intent should surface provider-submit blocker");

  console.log(
    `Project.vibe creative loop tests passed: queued=${confirmed.queuedTaskRunIds.length}, parked=${confirmed.parkedTaskRunIds.length}, blocked=${confirmed.blockedTaskRunIds.length}, run=${confirmed.runReceipt?.id}.`,
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
