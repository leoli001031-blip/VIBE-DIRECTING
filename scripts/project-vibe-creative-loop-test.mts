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
