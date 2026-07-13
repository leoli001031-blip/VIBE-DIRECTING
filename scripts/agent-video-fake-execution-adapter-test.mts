import {
  agentVideoExecutionToolResult,
  createAgentVideoExecutionController,
  type AgentVideoExecutionContext,
  type AgentVideoExecutionProjectIdentity,
} from "../src/ui/director/agentVideoExecutionController.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  type AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import { restoreProjectAgentGenerationJobLedger } from "../src/project/projectAgentGenerationJobLedger.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("FAIL: timed out waiting for fake execution");
}

function cloneLedger(ledger: AgentVideoGenerationJobLedger) {
  return JSON.parse(JSON.stringify(ledger)) as AgentVideoGenerationJobLedger;
}

function controllerFixture(input: {
  identity: AgentVideoExecutionProjectIdentity;
  ledger?: AgentVideoGenerationJobLedger;
}) {
  let identity = input.identity;
  let ledger = input.ledger || createAgentVideoGenerationJobLedger({
    ledgerId: `p6-b-ledger-${identity.projectFactHash}`,
    createdAt: "2026-07-13T10:00:00.000Z",
    ...identity,
  });
  const persisted: AgentVideoGenerationJobLedger[] = [];
  const timelineIds: string[] = [];
  const controller = createAgentVideoExecutionController({
    getProjectIdentity: () => identity,
    setProjectIdentity: (nextIdentity) => {
      identity = nextIdentity;
    },
    getLedger: () => ledger,
    setLedger: (nextLedger) => {
      ledger = nextLedger;
    },
    canPersistLedger: () => true,
    persistLedger: async (snapshot) => {
      persisted.push(cloneLedger(snapshot));
    },
    publishTimeline: (entries) => {
      timelineIds.push(...entries.map((entry) => entry.id));
    },
  });
  return {
    controller,
    getIdentity: () => identity,
    setIdentity: (nextIdentity: AgentVideoExecutionProjectIdentity) => {
      identity = nextIdentity;
    },
    getLedger: () => ledger,
    persisted,
    timelineIds,
  };
}

function fakeAdapter(
  steps: Array<(context: AgentVideoExecutionContext) => unknown | Promise<unknown>>,
) {
  const calls: AgentVideoExecutionContext[] = [];
  return {
    calls,
    perform: async (context: AgentVideoExecutionContext) => {
      calls.push(context);
      const step = steps.shift();
      if (!step) throw new Error("Unexpected fake adapter call.");
      return step(context);
    },
  };
}

const identity = {
  projectId: "p6-b-fake-project",
  projectRoot: "/tmp/p6-b-fake-project",
  projectFactHash: "p6-b-facts-v1",
};
const videoPlan = buildAgentVideoPipelinePlan({
  planId: "p6-b-video-plan",
  generatedAt: "2026-07-13T10:00:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
const queryPlan = buildAgentVideoPipelinePlan({
  planId: "p6-b-query-plan",
  generatedAt: "2026-07-13T10:01:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
  videoNeedsQuery: true,
});

const submitFixture = controllerFixture({ identity });
const submitFake = fakeAdapter([
  () => ({ status: "submitted", providerCalled: true, submitId: "p6-b-task-001" }),
]);
const submitInput = {
  plan: videoPlan,
  action: "submit_video" as const,
  actionId: "p6-b-submit-video",
  confirmationReceiptId: "p6-b-submit-video-confirmation",
  executionMode: "live" as const,
  generatedAt: "2026-07-13T10:00:01.000Z",
  perform: submitFake.perform,
};
const [submitted, concurrentDuplicate] = await Promise.all([
  submitFixture.controller.runExecution(submitInput),
  submitFixture.controller.runExecution(submitInput),
]);
assert(submitted.status === "running", "a submitted fake video must remain running");
assert(submitted.receipt.externalTaskId === "p6-b-task-001", "submitted work must persist its external task id");
assert(submitFake.calls.length === 1, "concurrent duplicate confirmations must call submit once");
assert(concurrentDuplicate.job?.jobId === submitted.job?.jobId, "concurrent duplicates must share one job");

const repeatedSubmit = await submitFixture.controller.runExecution({
  ...submitInput,
  generatedAt: "2026-07-13T10:00:02.000Z",
});
assert(repeatedSubmit.status === "running", "a repeated submitted action must return the existing running job");
assert(submitFake.calls.length === 1, "a repeated confirmation must not resubmit a running job");

const serializedRunningLedger = cloneLedger(submitFixture.getLedger());
const coldRestore = restoreProjectAgentGenerationJobLedger(serializedRunningLedger, identity);
assert(coldRestore.ok && coldRestore.ledger?.jobs[0]?.externalTaskId === "p6-b-task-001", "cold restore must retain the submitted task id");

const queryFixture = controllerFixture({ identity, ledger: coldRestore.ledger });
const queryFake = fakeAdapter([
  (context) => {
    assert(context.operation === "query", "recoverable video work must invoke the query operation");
    assert(context.job.externalTaskId === "p6-b-task-001", "query must reuse the submitted external task id");
    return { status: "running", providerCalled: true, taskId: context.job.externalTaskId };
  },
  (context) => ({
    status: "needs_review",
    providerCalled: true,
    taskId: context.job.externalTaskId,
    outputVideoPath: "/tmp/p6-b-returned-video.mp4",
  }),
]);
const queryInput = {
  plan: queryPlan,
  action: "submit_video" as const,
  operation: "query" as const,
  actionId: "p6-b-query-video",
  confirmationReceiptId: "p6-b-query-video-confirmation",
  executionMode: "live" as const,
  generatedAt: "2026-07-13T10:01:01.000Z",
  perform: queryFake.perform,
};
const runningQuery = await queryFixture.controller.runExecution(queryInput);
assert(runningQuery.status === "running", "the first fake query must remain recoverable");
assert(queryFake.calls.length === 1 && submitFake.calls.length === 1, "query must not call the submit adapter again");
const queryJobCount = runningQuery.ledger.jobs.length;
const completedQuery = await queryFixture.controller.runExecution({
  ...queryInput,
  generatedAt: "2026-07-13T10:01:02.000Z",
});
assert(completedQuery.status === "completed", "a later fake query may return a reviewable video");
assert(completedQuery.receipt.outputAssets[0] === "/tmp/p6-b-returned-video.mp4", "query must retain only the returned video evidence");
assert(completedQuery.ledger.jobs.length === queryJobCount, "repeated query callbacks must update one query job");

const staleIdentity = { ...identity, projectFactHash: "p6-b-facts-v2" };
const staleRestore = restoreProjectAgentGenerationJobLedger(serializedRunningLedger, staleIdentity);
assert(!staleRestore.ok && staleRestore.status === "fact_hash_mismatch", "old-fact jobs must not restore into new project facts");
queryFixture.setIdentity(staleIdentity);
let staleQueryCalls = 0;
const staleQuery = await queryFixture.controller.runExecution({
  ...queryInput,
  actionId: "p6-b-query-stale-facts",
  confirmationReceiptId: "p6-b-query-stale-facts-confirmation",
  projectFactHash: staleIdentity.projectFactHash,
  generatedAt: "2026-07-13T10:01:03.000Z",
  perform: () => {
    staleQueryCalls += 1;
    return { status: "running", providerCalled: true };
  },
});
assert(staleQuery.status === "blocked", "new facts without a matching task id must block query");
assert(staleQueryCalls === 0, "an old-fact task must never reach the new-fact query callback");

const referencePlan = buildAgentVideoPipelinePlan({
  planId: "p6-b-reference-plan",
  generatedAt: "2026-07-13T10:02:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const retryFixture = controllerFixture({ identity });
const retryFake = fakeAdapter([
  () => {
    throw Object.assign(new Error("fake provider failure"), { providerCalled: true });
  },
  () => ({
    status: "needs_review",
    providerCalled: true,
    assets: [{ path: "/tmp/p6-b-retry-reference.png" }],
  }),
]);
const failedReferenceInput = {
  plan: referencePlan,
  action: "prepare_references" as const,
  actionId: "p6-b-reference-retry",
  confirmationReceiptId: "p6-b-reference-retry-confirmation",
  executionMode: "live" as const,
  generatedAt: "2026-07-13T10:02:01.000Z",
  perform: retryFake.perform,
};
const failedReference = await retryFixture.controller.runExecution(failedReferenceInput);
assert(failedReference.status === "failed" && failedReference.job?.status === "failed", "fake thrown failure must stay failed");
const duplicateFailure = await retryFixture.controller.runExecution({
  ...failedReferenceInput,
  generatedAt: "2026-07-13T10:02:02.000Z",
});
assert(duplicateFailure.status === "blocked", "a terminal failed action must not auto-retry");
assert(retryFake.calls.length === 1, "duplicate failed confirmation must not call the provider again");
const retriedReference = await retryFixture.controller.runExecution({
  ...failedReferenceInput,
  retry: true,
  generatedAt: "2026-07-13T10:02:03.000Z",
});
assert(retriedReference.status === "completed" && retriedReference.receipt.attempt === 2, "explicit retry must create a successful second attempt");
assert(retriedReference.receipt.retryOfActionId === "p6-b-reference-retry", "retry receipt must bind the original action id");
assert(retryFixture.getLedger().jobs.length === 2, "explicit retry must retain both attempts");

const partialFixture = controllerFixture({ identity });
const partialFake = fakeAdapter([
  () => ({
    status: "partial_return",
    providerCalled: true,
    assets: [{ path: "/tmp/p6-b-reference-1.png" }],
    missingShotIds: ["shot-2"],
  }),
]);
const partialReturn = await partialFixture.controller.runExecution({
  plan: referencePlan,
  action: "prepare_references",
  actionId: "p6-b-reference-partial",
  confirmationReceiptId: "p6-b-reference-partial-confirmation",
  executionMode: "live",
  generatedAt: "2026-07-13T10:03:00.000Z",
  perform: partialFake.perform,
});
const partialToolResult = agentVideoExecutionToolResult(partialReturn);
assert(partialReturn.status === "completed" && partialReturn.receipt.outputAssets.length === 1, "partial return must retain only real returned paths");
assert(partialToolResult.status === "partial_return", "partial return must remain visible to the review layer");
assert(Array.isArray(partialToolResult.missingShotIds) && partialToolResult.missingShotIds[0] === "shot-2", "partial return must preserve missing items");

const duplicateCallbackFixture = controllerFixture({ identity });
let duplicateCallbackEmissions = 0;
const duplicateCallbackResult = await duplicateCallbackFixture.controller.runExecution({
  plan: referencePlan,
  action: "prepare_references",
  actionId: "p6-b-reference-duplicate-callback",
  confirmationReceiptId: "p6-b-reference-duplicate-callback-confirmation",
  executionMode: "live",
  generatedAt: "2026-07-13T10:03:30.000Z",
  perform: () => new Promise((resolve) => {
    duplicateCallbackEmissions += 1;
    resolve({ status: "needs_review", providerCalled: true, assets: [{ path: "/tmp/p6-b-first-callback.png" }] });
    duplicateCallbackEmissions += 1;
    resolve({ status: "needs_review", providerCalled: true, assets: [{ path: "/tmp/p6-b-duplicate-callback.png" }] });
  }),
});
assert(duplicateCallbackEmissions === 2, "the fake provider must exercise a duplicate callback");
assert(duplicateCallbackResult.receipt.outputAssets.join(",") === "/tmp/p6-b-first-callback.png", "duplicate callbacks must keep only the first settled result");
assert(duplicateCallbackFixture.getLedger().jobs.length === 1, "duplicate callbacks must not append another job");
assert(duplicateCallbackFixture.timelineIds.length === 2, "duplicate callbacks must publish one start and one result timeline entry");

const timeoutFixture = controllerFixture({ identity });
let releaseLateResult: ((value: unknown) => void) | undefined;
let timeoutSignal: AbortSignal | undefined;
const timedOut = await timeoutFixture.controller.runExecution({
  plan: videoPlan,
  action: "submit_video",
  actionId: "p6-b-video-timeout",
  confirmationReceiptId: "p6-b-video-timeout-confirmation",
  executionMode: "live",
  generatedAt: "2026-07-13T10:04:00.000Z",
  timeoutMs: 5,
  perform: (context) => {
    timeoutSignal = context.signal;
    return new Promise((resolve) => {
      releaseLateResult = resolve;
    });
  },
});
assert(timedOut.status === "timed_out" && timedOut.job?.status === "running", "timeout must remain a recoverable running job");
assert(timeoutSignal?.aborted === true, "timeout must abort the fake adapter signal");
const timeoutLedgerBeforeLateReturn = JSON.stringify(timeoutFixture.getLedger());
const timeoutTimelineCount = timeoutFixture.timelineIds.length;
releaseLateResult?.({ status: "needs_review", providerCalled: true, outputVideoPath: "/tmp/p6-b-late-video.mp4" });
await new Promise((resolve) => setTimeout(resolve, 10));
assert(JSON.stringify(timeoutFixture.getLedger()) === timeoutLedgerBeforeLateReturn, "late timeout results must not mutate the durable ledger");
assert(timeoutFixture.timelineIds.length === timeoutTimelineCount, "late timeout results must not publish a second callback result");
assert(timeoutFixture.getLedger().jobs[0]?.outputAssets.length === 0, "late timeout results must not leak output paths");

const cancelFixture = controllerFixture({ identity });
const cancelController = new AbortController();
let cancelCalls = 0;
const cancelledPromise = cancelFixture.controller.runExecution({
  plan: videoPlan,
  action: "submit_video",
  actionId: "p6-b-video-cancel",
  confirmationReceiptId: "p6-b-video-cancel-confirmation",
  executionMode: "live",
  generatedAt: "2026-07-13T10:05:00.000Z",
  signal: cancelController.signal,
  perform: (context) => {
    cancelCalls += 1;
    return new Promise((_, reject) => {
      context.signal.addEventListener("abort", () => reject(new Error("fake cancellation")), { once: true });
    });
  },
});
await waitFor(() => cancelCalls === 1);
cancelController.abort();
const cancelled = await cancelledPromise;
assert(cancelled.status === "cancelled" && cancelled.job?.status === "cancelled", "explicit cancellation must be terminal and retryable");
assert(cancelled.receipt.outputAssets.length === 0, "cancelled work must not claim outputs");

console.log("agent-video-fake-execution-adapter-test passed; all scenarios were offline and created no files");
