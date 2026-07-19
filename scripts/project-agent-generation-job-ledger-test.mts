import { readFileSync } from "node:fs";

import {
  buildAgentCurrentTaskProjection,
} from "../src/core/agentCurrentTaskProjection.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  recordAgentVideoGenerationJobReviewResult,
  transitionAgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import {
  openProjectAgentGenerationJobLedger,
  interruptedLocalExportStagingPaths,
  projectAgentGenerationJobLedgerPath,
  recoverInterruptedLocalExportJobs,
  restoreProjectAgentGenerationJobLedger,
  saveProjectAgentGenerationJobLedger,
} from "../src/project/projectAgentGenerationJobLedger.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function installWindowShim(windowShim: unknown) {
  (globalThis as { window?: unknown }).window = windowShim;
}

function createLocalStorageShim() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      },
    },
  };
}

const projectId = "project-ledger-p2";
const projectRoot = "/tmp/project-ledger-p2";
const projectFactHash = "facts-p2-current";
const generatedAt = "2026-07-11T00:00:00.000Z";
const identity = { projectId, projectRoot, projectFactHash };
const plan = buildAgentVideoPipelinePlan({
  planId: "p2_running_video",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
const emptyLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "p2_generation_ledger",
  createdAt: generatedAt,
  ...identity,
});
assert(emptyLedger.projectId === projectId, "ledger must bind the project id");
assert(emptyLedger.projectRoot === projectRoot, "ledger must bind the project root");
assert(emptyLedger.projectFactHash === projectFactHash, "ledger must bind the project fact hash");

const unboundLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "p2_unbound_generation_ledger",
  projectId,
  projectFactHash,
  createdAt: generatedAt,
});
const unboundDecision = planAgentVideoProductionAction({
  plan,
  ledger: unboundLedger,
  action: "submit_video",
  actionId: "action-unbound-submit-video-p2",
  sourceConfirmationId: "confirmation-unbound-submit-video-p2",
  generatedAt: "2026-07-11T00:00:00.500Z",
});
assert(unboundDecision.status === "blocked", "generation jobs must not stage without a bound project root");
assert(unboundDecision.ledger.jobs.length === 0, "unbound project identity must not create a job");

const staged = planAgentVideoProductionAction({
  plan,
  ledger: emptyLedger,
  action: "submit_video",
  actionId: "action-submit-video-p2",
  sourceConfirmationId: "confirmation-submit-video-p2",
  generatedAt: "2026-07-11T00:00:01.000Z",
});
assert(staged.status === "staged_job" && staged.job, "confirmed video action should stage one job");
assert(staged.job.projectId === projectId, "job must bind the project id");
assert(staged.job.projectRoot === projectRoot, "job must bind the project root");
assert(staged.job.projectFactHash === projectFactHash, "job must bind the source fact hash");
assert(staged.job.actionId === "action-submit-video-p2", "job must bind the Agent action id");
assert(staged.job.sourceConfirmationId === "confirmation-submit-video-p2", "job must bind the source confirmation receipt");
assert(staged.job.operation === "execute", "generation jobs must persist execute vs query semantics");
assert(staged.job.statusHistory?.map((event) => event.status).join(">") === "staged", "new jobs must persist their initial status history");

const missingConfirmationDecision = planAgentVideoProductionAction({
  plan,
  ledger: emptyLedger,
  action: "submit_video",
  actionId: "action-submit-video-without-confirmation-p2",
  generatedAt: "2026-07-11T00:00:01.500Z",
});
assert(missingConfirmationDecision.status === "blocked", "a generation job must not stage without a source confirmation receipt");
assert(missingConfirmationDecision.ledger.jobs.length === 0, "missing confirmation identity must not append a job");

const duplicate = planAgentVideoProductionAction({
  plan,
  ledger: staged.ledger,
  action: "submit_video",
  actionId: "action-submit-video-p2",
  sourceConfirmationId: "confirmation-submit-video-p2",
  generatedAt: "2026-07-11T00:00:02.000Z",
});
assert(duplicate.status === "staged_job", "a repeated non-terminal action should return the existing job");
assert(duplicate.job?.jobId === staged.job.jobId, "a repeated action must reuse its existing job");
assert(duplicate.ledger.jobs.length === 1, "a repeated action must not append another job");

const operationMismatch = planAgentVideoProductionAction({
  plan,
  ledger: staged.ledger,
  action: "submit_video",
  operation: "query",
  actionId: "action-submit-video-p2",
  sourceConfirmationId: "confirmation-submit-video-p2",
  generatedAt: "2026-07-11T00:00:02.500Z",
});
assert(operationMismatch.status === "blocked", "the same action id must not change from execute to query");
assert(operationMismatch.ledger.jobs.length === 1, "operation mismatch must not append a second job");

const confirmationMismatch = planAgentVideoProductionAction({
  plan,
  ledger: staged.ledger,
  action: "submit_video",
  actionId: "action-submit-video-p2",
  sourceConfirmationId: "another-confirmation-submit-video-p2",
  generatedAt: "2026-07-11T00:00:02.750Z",
});
assert(confirmationMismatch.status === "blocked", "the same action id must remain bound to its original confirmation receipt");
assert(confirmationMismatch.ledger.jobs.length === 1, "confirmation mismatch must not append a second job");

const confirmed = transitionAgentVideoGenerationJob({
  ledger: staged.ledger,
  jobId: staged.job.jobId,
  status: "confirmed",
  generatedAt: "2026-07-11T00:00:03.000Z",
});
assert(confirmed.ok && confirmed.job, "staged job should confirm");
const running = transitionAgentVideoGenerationJob({
  ledger: confirmed.ledger,
  jobId: staged.job.jobId,
  status: "running",
  generatedAt: "2026-07-11T00:00:04.000Z",
});
assert(running.ok && running.job?.status === "running", "confirmed job should reach running before simulated exit");

const interruptedExportLedger: AgentVideoGenerationJobLedger = {
  ...running.ledger,
  jobs: [{
    ...running.job!,
    kind: "export",
    providerId: "local-exporter",
    modelId: "project-export-v1",
    capability: "export",
    pipelineStep: "export",
    actionId: "footer_project_export",
    sourceConfirmationId: "footer_action_export",
    executionMode: "live",
    providerCalled: false,
    outputAssets: [],
  }],
};
const interruptedExportRecovery = recoverInterruptedLocalExportJobs(interruptedExportLedger);
assert(interruptedExportRecovery.changed, "a running synchronous local export must be recovered after process restart");
assert(interruptedExportRecovery.jobs[0]?.status === "failed", "an interrupted local export must become terminal failed");
assert(interruptedExportRecovery.jobs[0]?.statusHistory.at(-1)?.error?.includes("interrupted before atomic publish"), "interrupted local export recovery must preserve an actionable error");
assert(
  interruptedLocalExportStagingPaths(interruptedExportRecovery.jobs[0]!).join("|")
    === `exports/.vibe-staging/${interruptedExportRecovery.jobs[0]!.jobId}|reports/exports/.vibe-staging/${interruptedExportRecovery.jobs[0]!.jobId}`,
  "interrupted local export recovery must target only staging directories bound to the exact job id",
);
assert(
  interruptedLocalExportStagingPaths({ ...interruptedExportRecovery.jobs[0]!, jobId: "../outside" }).length === 0,
  "interrupted local export staging cleanup must reject unsafe job ids",
);
const sameProcessExportRecovery = recoverInterruptedLocalExportJobs(interruptedExportLedger, {
  updatedBefore: running.job!.updatedAt,
});
assert(!sameProcessExportRecovery.changed, "restore effects must not recover a local export started by the current renderer process");
const priorProcessExportRecovery = recoverInterruptedLocalExportJobs(interruptedExportLedger, {
  updatedBefore: "2026-07-11T00:00:05.000Z",
});
assert(priorProcessExportRecovery.changed, "a local export from a prior renderer process must recover on cold start");
const repeatedInterruptedExportRecovery = recoverInterruptedLocalExportJobs(interruptedExportRecovery.ledger);
assert(!repeatedInterruptedExportRecovery.changed, "interrupted local export recovery must be idempotent");
assert(repeatedInterruptedExportRecovery.ledger.updatedAt === interruptedExportRecovery.ledger.updatedAt, "idempotent interrupted export recovery must not rewrite the ledger");

const reviewOutputPath = `${projectRoot}/video/P6S01.mp4`;
const reviewOutputHash = `sha256:${"7".repeat(64)}`;
const returnedForReview = recordAgentVideoGenerationJobReviewResult({
  ledger: running.ledger,
  jobId: staged.job.jobId,
  result: {
    status: "needs_review",
    projectId,
    projectRoot,
    projectFactHash,
    jobId: staged.job.jobId,
    actionId: staged.job.actionId,
    shotId: "P6S01",
    sourceReceiptId: "seedance_submit_p10d4_p6s01",
    outputPath: reviewOutputPath,
    outputHash: reviewOutputHash,
    receivedAt: "2026-07-11T00:00:05.000Z",
  },
});
assert(returnedForReview.ok && returnedForReview.job?.status === "succeeded", "a running video job should accept one hash-bound needs_review result");
assert(returnedForReview.job?.reviewResult?.jobId === staged.job.jobId, "the review result must remain bound to its exact job");
assert(returnedForReview.job?.reviewResult?.actionId === staged.job.actionId, "the review result must remain bound to its exact action");
assert(returnedForReview.job?.reviewResult?.projectFactHash === projectFactHash, "the review result must remain bound to current project facts");
assert(returnedForReview.job?.outputAssets.includes(reviewOutputPath), "the returned output path must be recorded on the terminal job");

const repeatedReviewResult = recordAgentVideoGenerationJobReviewResult({
  ledger: returnedForReview.ledger,
  jobId: staged.job.jobId,
  result: returnedForReview.job!.reviewResult!,
});
assert(repeatedReviewResult.ok, "replaying the exact same result should be idempotent");
assert(repeatedReviewResult.job?.statusHistory.length === returnedForReview.job?.statusHistory.length, "idempotent result recovery must not append another terminal history event");

const conflictingReviewResult = recordAgentVideoGenerationJobReviewResult({
  ledger: returnedForReview.ledger,
  jobId: staged.job.jobId,
  result: {
    ...returnedForReview.job!.reviewResult!,
    outputHash: `sha256:${"8".repeat(64)}`,
  },
});
assert(!conflictingReviewResult.ok, "a second result with a different output hash must fail closed");

const escapedReviewResult = recordAgentVideoGenerationJobReviewResult({
  ledger: running.ledger,
  jobId: staged.job.jobId,
  result: {
    ...returnedForReview.job!.reviewResult!,
    outputPath: "/tmp/outside-project/P6S01.mp4",
  },
});
assert(!escapedReviewResult.ok, "a returned output outside the bound project root must fail closed");

const browserStorage = createLocalStorageShim();
installWindowShim({ localStorage: browserStorage.storage });

try {
  const target = { storageKey: "test:agent-generation-job-ledger" };
  const saved = await saveProjectAgentGenerationJobLedger(target, running.ledger);
  assert(saved.ok && saved.status === "written", "running ledger should persist to its project sidecar");
  assert(
    browserStorage.values.has(`test:agent-generation-job-ledger:${projectAgentGenerationJobLedgerPath}`),
    "ledger must use the dedicated project sidecar path",
  );

  const coldStart = await openProjectAgentGenerationJobLedger(target, identity);
  assert(coldStart.ok && coldStart.status === "restored" && coldStart.ledger, "matching cold start should restore the ledger");
  assert(coldStart.ledger.jobs[0]?.status === "running", "cold start must preserve the non-terminal job status");

  const restoredProjection = buildAgentCurrentTaskProjection({
    pipelinePlan: plan,
    jobLedger: coldStart.ledger,
    currentProjectId: projectId,
    currentProjectRoot: projectRoot,
    currentProjectFactHash: projectFactHash,
  });
  assert(restoredProjection.source === "pipeline_job", "a restored non-terminal job must outrank the pipeline fallback");
  assert(restoredProjection.jobId === staged.job.jobId, "projection must expose the restored job id");

  const factMismatch = await openProjectAgentGenerationJobLedger(target, {
    ...identity,
    projectFactHash: "facts-p2-after-edit",
  });
  assert(factMismatch.status === "fact_hash_mismatch" && !factMismatch.ok, "project edits must invalidate jobs from old facts");

  const rootMismatch = await openProjectAgentGenerationJobLedger(target, {
    ...identity,
    projectRoot: "/tmp/another-project-ledger-p2",
  });
  assert(rootMismatch.status === "root_mismatch" && !rootMismatch.ok, "another project root must not restore the ledger");

  const projectMismatch = await openProjectAgentGenerationJobLedger(target, {
    ...identity,
    projectId: "another-project-ledger-p2",
  });
  assert(projectMismatch.status === "project_mismatch" && !projectMismatch.ok, "another project id must not restore the ledger");

  const terminal = transitionAgentVideoGenerationJob({
    ledger: running.ledger,
    jobId: staged.job.jobId,
    status: "succeeded",
    generatedAt: "2026-07-11T00:00:05.000Z",
  });
  assert(terminal.ok && terminal.job?.status === "succeeded", "running job should become terminal");
  const terminalProjection = buildAgentCurrentTaskProjection({
    pipelinePlan: plan,
    jobLedger: terminal.ledger,
    currentProjectId: projectId,
    currentProjectRoot: projectRoot,
    currentProjectFactHash: projectFactHash,
  });
  assert(terminalProjection.source === "pipeline_plan", "terminal jobs must yield to the pipeline step");
  assert(!terminalProjection.jobId, "terminal jobs must not restore as the current task");

  const reviewProjection = buildAgentCurrentTaskProjection({
    pipelinePlan: plan,
    jobLedger: returnedForReview.ledger,
    currentProjectId: projectId,
    currentProjectRoot: projectRoot,
    currentProjectFactHash: projectFactHash,
    videoReviewCount: 1,
  });
  assert(reviewProjection.source === "project_observation" && reviewProjection.label === "复核视频", "a pending video review should outrank a terminal pipeline fallback");
  assert(reviewProjection.jobId === staged.job.jobId, "review projection must retain the exact result job id");
  assert(reviewProjection.actionId === staged.job.actionId, "review projection must retain the exact result action id");

  const corruptedKey = `test:agent-generation-job-ledger:${projectAgentGenerationJobLedgerPath}`;
  browserStorage.values.set(corruptedKey, "{not-json");
  const corrupted = await openProjectAgentGenerationJobLedger(target, identity);
  assert(corrupted.status === "invalid" && !corrupted.ok, "corrupted sidecar JSON must fail closed");
  assert(!corrupted.ledger, "corrupted sidecar must not expose a partial ledger");

  const malformed = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    jobs: [{ ...running.ledger.jobs[0], actionId: "" }],
  }, identity);
  assert(malformed.status === "invalid" && !malformed.ok, "jobs without actionId must fail schema validation");

  const missingStatusHistory = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    jobs: running.ledger.jobs.map((job) => ({ ...job, statusHistory: undefined })),
  }, identity);
  assert(missingStatusHistory.status === "invalid" && !missingStatusHistory.ok, "jobs without status history must fail schema validation");

  const mismatchedStatusHistory = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    jobs: running.ledger.jobs.map((job) => ({
      ...job,
      statusHistory: [{ status: "staged", at: job.createdAt }],
    })),
  }, identity);
  assert(mismatchedStatusHistory.status === "invalid" && !mismatchedStatusHistory.ok, "job status must match the final persisted history event");

  const malformedExternalTaskId = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    jobs: running.ledger.jobs.map((job) => ({ ...job, externalTaskId: 42 })),
  }, identity);
  assert(malformedExternalTaskId.status === "invalid" && !malformedExternalTaskId.ok, "non-string external task ids must fail sidecar validation");

  const malformedReviewResult = restoreProjectAgentGenerationJobLedger({
    ...returnedForReview.ledger,
    jobs: returnedForReview.ledger.jobs.map((job) => ({
      ...job,
      reviewResult: job.reviewResult ? { ...job.reviewResult, projectFactHash: "older-facts" } : undefined,
    })),
  }, identity);
  assert(malformedReviewResult.status === "invalid" && !malformedReviewResult.ok, "a persisted review result with stale fact identity must fail schema validation");

  const legacy = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    schemaVersion: "agent_video_generation_job_ledger/0.2.0",
    jobs: running.ledger.jobs.map((job) => ({
      ...job,
      executionMode: undefined,
      providerCalled: undefined,
    })),
  }, identity);
  assert(legacy.ok && legacy.ledger?.schemaVersion === "agent_video_generation_job_ledger/0.5.0", "0.2 ledgers must migrate to the review-result-aware schema");
  assert(legacy.ledger?.jobs.every((job) => job.executionMode === "dry_run" && job.providerCalled === false && job.operation === "execute"), "legacy P2 jobs must migrate conservatively as provider-free execute dry runs");

  const legacyQuery = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    schemaVersion: "agent_video_generation_job_ledger/0.3.0",
    jobs: running.ledger.jobs.map((job) => ({
      ...job,
      actionId: "footer_video_query",
      operation: undefined,
    })),
  }, identity);
  assert(legacyQuery.ok && legacyQuery.ledger?.jobs.every((job) => job.operation === "query"), "0.3 query jobs must migrate without becoming submit jobs");

  const legacyP3 = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    schemaVersion: "agent_video_generation_job_ledger/0.4.0",
  }, identity);
  assert(legacyP3.ok && legacyP3.ledger?.schemaVersion === "agent_video_generation_job_ledger/0.5.0", "0.4 ledgers without review results must restore conservatively");
} finally {
  delete (globalThis as { window?: unknown }).window;
}

const bindingClientSource = readFileSync("src/core/projectCurrentBindingClient.ts", "utf8");
const runtimeServerSource = readFileSync("scripts/local-runtime-api-server.mts", "utf8");
const generationLedgerSource = readFileSync("src/project/projectAgentGenerationJobLedger.ts", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const directorModeSource = readFileSync("src/ui/director/DirectorModeShell.tsx", "utf8");
const minimalAgentPanelSource = readFileSync("src/ui/director/MinimalAgentPanel.tsx", "utf8");
const executionControllerSource = readFileSync("src/ui/director/agentVideoExecutionController.ts", "utf8");
assert(/projectCurrentAgentGenerationJobLedgerEndpoint[\s\S]*agent-generation-job-ledger/.test(bindingClientSource), "runtime client must expose the generation-ledger endpoint");
assert(/loadCurrentProjectAgentGenerationJobLedgerTextFromRuntime[\s\S]*saveCurrentProjectAgentGenerationJobLedgerTextToRuntime/.test(bindingClientSource), "runtime client must expose ledger read/write helpers");
assert(/currentProjectAgentGenerationJobLedgerSidecarPath\s*=\s*"\.vibe-runtime\/agent-generation-job-ledger\.json"/.test(runtimeServerSource), "runtime route must pin the ledger sidecar path");
assert(/handleCurrentProjectAgentGenerationJobLedgerRoute[\s\S]*isPathInsideRealRoot[\s\S]*writeFileSync\(tempPath, content, "utf8"\)[\s\S]*renameSync\(tempPath, sidecarPath\)/.test(runtimeServerSource), "runtime ledger writes must stay project-scoped and atomic");
assert(/if \(runtimeWriteOk\) \{[\s\S]*return \{[\s\S]*status: "written"[\s\S]*const writeResult = await writeProjectVibeSidecarText/.test(generationLedgerSource), "an atomic runtime ledger write must return before the non-runtime fallback can overwrite it");
assert((appSource.match(/openProjectAgentGenerationJobLedger\(/g) || []).length >= 3, "browser, local, and runtime project restore paths must all open the generation ledger");
assert(/rememberAgentGenerationJobLedger[\s\S]*agentGenerationLedgerMatchesIdentity[\s\S]*saveProjectAgentGenerationJobLedger/.test(appSource), "App must serialize identity-checked ledger writes");
assert(/rememberAgentGenerationJobLedger[\s\S]*!agentGenerationLedgerMatchesIdentity\(ledger, currentIdentity\)[\s\S]*throw new Error[\s\S]*!saveResult\.ok[\s\S]*throw new Error[\s\S]*setRestoredAgentGenerationJobLedger\(ledger\)/.test(appSource), "App generation-ledger persistence must fail closed before publishing in-memory state");
assert(/restoredAgentGenerationJobLedger=\{restoredAgentGenerationJobLedger\}[\s\S]*onRememberAgentGenerationJobLedger=\{rememberAgentGenerationJobLedger\}/.test(appSource), "App must pass restored ledger state and persistence callback into DirectorMode");
assert(/restoredAgentGenerationJobLedger\?: AgentVideoGenerationJobLedger[\s\S]*onRememberAgentGenerationJobLedger\?: \(ledger: AgentVideoGenerationJobLedger\)[\s\S]*<MinimalAgentPanel[\s\S]*restoredAgentGenerationJobLedger=\{restoredAgentGenerationJobLedger\}[\s\S]*onRememberAgentGenerationJobLedger=\{onRememberAgentGenerationJobLedger\}/.test(directorModeSource), "DirectorMode must transparently forward generation ledger state");
assert(/agentVideoExecutionLedgerMatchesProject\(restoredAgentGenerationJobLedger,\s*agentGenerationProjectIdentity\)/.test(minimalAgentPanelSource) && /canPersistLedger:[\s\S]*persistLedger:[\s\S]*publishTimeline:[\s\S]*rememberAgentTimelineEntries\(entries, identity\)/.test(minimalAgentPanelSource) && /onLedgerSnapshot:[\s\S]*durablePersistenceAvailable[\s\S]*await dependencies\.persistLedger\?\.\(snapshot\)[\s\S]*dependencies\.setLedger\(snapshot\)[\s\S]*onTimelineEntries:[\s\S]*dependencies\.publishTimeline/.test(executionControllerSource), "MinimalAgentPanel must durably persist fact-bound live job transitions before publishing them in memory or timeline results");
assert(/const executionIdentity = \{[\s\S]*projectFactHash:\s*input\.projectFactHash[\s\S]*!agentVideoExecutionLedgerMatchesProject\(executionLedger,\s*executionIdentity\)[\s\S]*createAgentVideoGenerationJobLedger\(\{[\s\S]*\.\.\.executionIdentity/.test(executionControllerSource), "post-write project facts must start execution from a matching generation ledger instead of appending to a stale ledger");
assert(/bindProjectAgentTimelineEntriesToIdentity[\s\S]*projectFactHash[\s\S]*rememberAgentTimelineEntries[\s\S]*boundEntries/.test(minimalAgentPanelSource), "new UI timeline entries must use the shared project identity binder for recovery validation");
assert(/bindVibeAgentTurnTimelineToProjectIdentity[\s\S]*bindProjectAgentTimelineEntriesToIdentity[\s\S]*saveAgentTimelineDocumentQueued\(boundAgentTimeline/.test(appSource), "App must bind staged Agent-turn confirmations before durable timeline persistence");

console.log("project-agent-generation-job-ledger-test passed");
