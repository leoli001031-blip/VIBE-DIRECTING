import fs from "node:fs";
import {
  restoreAgentVideoExecutionReceipt,
  runAgentVideoExecution,
  type AgentVideoExecutionReceipt,
} from "../src/core/agentVideoExecutionAdapter.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";
import { EXPORT_DELIVERY_RECEIPT_SCHEMA_VERSION } from "../src/core/exportDeliveryGate.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const identity = {
  projectId: "p3-execution-adapter-project",
  projectRoot: "/tmp/p3-execution-adapter-project",
  projectFactHash: "p3-execution-adapter-facts",
};
const generatedAt = "2026-07-11T08:00:00.000Z";
const referencePlan = buildAgentVideoPipelinePlan({
  planId: "p3-reference-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const videoPlan = buildAgentVideoPipelinePlan({
  planId: "p3-video-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
const videoQueryPlan = buildAgentVideoPipelinePlan({
  planId: "p3-video-query-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: true,
  videoNeedsQuery: true,
});
assert(videoQueryPlan.currentStep === "submit_video" && videoQueryPlan.currentOperation === "query", "recoverable video work must remain on the query lane instead of jumping to export");
const persistLedgerSnapshot = () => undefined;

let ledger = createAgentVideoGenerationJobLedger({
  ledgerId: "p3-execution-adapter-ledger",
  createdAt: generatedAt,
  ...identity,
});
let dryExecutorCalls = 0;
const drySnapshots: string[] = [];
const dryTimelineReceipts: AgentVideoExecutionReceipt[] = [];
const dry = await runAgentVideoExecution({
  plan: referencePlan,
  ledger,
  action: "prepare_references",
  actionId: "p3-dry-reference-action",
  sourceConfirmationId: "p3-dry-reference-confirmation",
  executionMode: "dry_run",
  generatedAt,
  execute: () => {
    dryExecutorCalls += 1;
    return { status: "needs_review", assets: [{ path: "/tmp/must-not-exist.png" }] };
  },
  onLedgerSnapshot: (snapshot) => {
    drySnapshots.push(snapshot.jobs.at(-1)?.status || "missing");
  },
  onTimelineEntries: (entries) => {
    for (const entry of entries) {
      const receipt = entry.details?.executionReceipt as AgentVideoExecutionReceipt | undefined;
      if (receipt) dryTimelineReceipts.push(receipt);
    }
  },
});
assert(dry.status === "completed", "dry-run should validate the execution contract");
assert(dry.receipt.status === "validated", "dry-run receipt must use validated instead of product-ready");
assert(dryExecutorCalls === 0, "dry-run must never invoke the supplied live executor");
assert(dry.providerCalled === false && dry.job?.providerCalled === false, "dry-run must record providerCalled=false");
assert(dry.job?.executionMode === "dry_run", "dry-run job must retain its execution mode");
assert(dry.job?.outputAssets.length === 0 && dry.receipt.outputAssets.length === 0, "dry-run must not invent output paths");
assert(drySnapshots.join(">") === "staged>confirmed>running>succeeded", "dry-run must persist each job transition");
assert(dryTimelineReceipts.every((receipt) => receipt.receiptId === dry.receipt.receiptId), "dry-run timeline must carry the same receipt contract");
assert(dryTimelineReceipts.length === 2, "started and result timeline batches must each be published exactly once");
assert(!/参考可用|视频可用|\.mp4|local-verification/.test(JSON.stringify(dry.timelineEntries)), "dry-run timeline must not claim real media or fake paths");
const restoredDryReceipt = restoreAgentVideoExecutionReceipt(dry.receipt, identity);
assert(restoredDryReceipt.ok && restoredDryReceipt.receipt?.receiptId === dry.receipt.receiptId, "a matching persisted execution receipt must restore");
const staleDryReceipt = restoreAgentVideoExecutionReceipt(dry.receipt, {
  ...identity,
  projectFactHash: "p3-execution-adapter-facts-after-edit",
});
assert(!staleDryReceipt.ok && staleDryReceipt.status === "fact_hash_mismatch", "project edits must invalidate old execution receipts");
const wrongRootDryReceipt = restoreAgentVideoExecutionReceipt(dry.receipt, {
  ...identity,
  projectRoot: "/tmp/another-execution-adapter-project",
});
assert(!wrongRootDryReceipt.ok && wrongRootDryReceipt.status === "root_mismatch", "another project root must not inherit an execution receipt");
const unknownReceiptSchema = restoreAgentVideoExecutionReceipt({
  ...dry.receipt,
  schemaVersion: "agent_video_execution_receipt/99.0.0",
}, identity);
assert(!unknownReceiptSchema.ok && unknownReceiptSchema.status === "invalid", "unknown receipt schemas must fail closed");
const forgedDryReceipt = restoreAgentVideoExecutionReceipt({
  ...dry.receipt,
  providerCalled: true,
  outputAssets: ["/tmp/forged-dry-run-output.png"],
}, identity);
assert(!forgedDryReceipt.ok && forgedDryReceipt.status === "invalid", "dry-run receipts must not claim provider calls or real outputs");
ledger = dry.ledger;

let unauthorizedCalls = 0;
const unauthorized = await runAgentVideoExecution({
  plan: videoPlan,
  ledger,
  action: "submit_video",
  actionId: "p3-live-without-authorization",
  sourceConfirmationId: "p3-live-without-authorization-confirmation",
  executionMode: "live",
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  execute: () => {
    unauthorizedCalls += 1;
    return { status: "submitted" };
  },
});
assert(unauthorized.status === "blocked", "live execution must block without explicit live authorization");
assert(unauthorizedCalls === 0 && unauthorized.ledger.jobs.length === ledger.jobs.length, "blocked live execution must not call or stage provider work");

let missingPersistenceExecutorCalls = 0;
const missingPersistence = await runAgentVideoExecution({
  plan: referencePlan,
  ledger,
  action: "prepare_references",
  actionId: "p3-live-without-persistence",
  sourceConfirmationId: "p3-live-without-persistence-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  execute: () => {
    missingPersistenceExecutorCalls += 1;
    return { status: "needs_review", providerCalled: true };
  },
});
assert(missingPersistence.status === "blocked", "live execution must require a durable ledger callback");
assert(missingPersistenceExecutorCalls === 0, "missing durable persistence must block before calling the provider executor");

let failingPersistenceExecutorCalls = 0;
const failingPersistenceSnapshots: string[] = [];
const failingPersistence = await runAgentVideoExecution({
  plan: referencePlan,
  ledger,
  action: "prepare_references",
  actionId: "p3-live-persistence-failure",
  sourceConfirmationId: "p3-live-persistence-failure-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  execute: () => {
    failingPersistenceExecutorCalls += 1;
    return { status: "needs_review", providerCalled: true };
  },
  onLedgerSnapshot: (snapshot) => {
    const status = snapshot.jobs.at(-1)?.status || "missing";
    if (status === "running") throw new Error("mock durable ledger failure");
    failingPersistenceSnapshots.push(status);
  },
});
assert(failingPersistence.status === "blocked", "live execution must fail closed when the running job cannot be persisted");
assert(failingPersistenceExecutorCalls === 0 && failingPersistence.providerCalled === false, "ledger failure must happen before any provider call");
assert(failingPersistenceSnapshots.join(">") === "staged>confirmed", "only successfully persisted snapshots may be reported as durable");
assert(failingPersistence.job?.status === "confirmed", "the adapter must return the last durable job state after persistence failure");

const liveReferenceSnapshots: string[] = [];
const liveReference = await runAgentVideoExecution({
  plan: referencePlan,
  ledger,
  action: "prepare_references",
  actionId: "p3-live-reference-action",
  sourceConfirmationId: "p3-live-reference-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  generatedAt: "2026-07-11T08:01:00.000Z",
  execute: ({ receipt, signal }) => {
    assert(receipt.confirmationReceiptId === "p3-live-reference-confirmation", "live executor must receive the confirmed receipt");
    assert(!signal.aborted, "live executor signal should start active");
    return {
      ok: true,
      status: "needs_review",
      providerCalled: true,
      assets: [{ path: "/tmp/p3-real-reference.png" }],
    };
  },
  onLedgerSnapshot: (snapshot) => {
    liveReferenceSnapshots.push(snapshot.jobs.at(-1)?.status || "missing");
  },
});
assert(liveReference.status === "completed" && liveReference.receipt.status === "succeeded", "authorized live reference should complete");
assert(liveReference.job?.executionMode === "live" && liveReference.job.providerCalled, "live job must distinguish provider execution from dry-run");
assert(liveReference.receipt.outputAssets[0] === "/tmp/p3-real-reference.png", "live receipt may record a path returned by the executor");
assert(liveReferenceSnapshots.join(">") === "staged>confirmed>running>succeeded", "live reference must use the same persisted job lifecycle");
assert(liveReference.timelineEntries.every((entry) => (entry.details?.executionReceipt as AgentVideoExecutionReceipt | undefined)?.receiptId === liveReference.receipt.receiptId), "live timeline must carry the same receipt contract");
const restoredLiveReferenceReceipt = restoreAgentVideoExecutionReceipt(liveReference.receipt, identity);
assert(restoredLiveReferenceReceipt.ok && restoredLiveReferenceReceipt.receipt?.providerCalled, "a live receipt must restore only when its current project identity matches");

const liveWithoutProviderEvidence = await runAgentVideoExecution({
  plan: referencePlan,
  ledger: liveReference.ledger,
  action: "prepare_references",
  actionId: "p3-live-reference-without-provider-evidence",
  sourceConfirmationId: "p3-live-reference-without-provider-evidence-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  execute: () => ({ status: "needs_review", assets: [{ path: "/tmp/p3-evidence-only-reference.png" }] }),
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(liveWithoutProviderEvidence.status === "completed", "a live callback may complete from returned product state");
assert(liveWithoutProviderEvidence.providerCalled === false, "live success without explicit provider evidence must not infer an external call");

let runningSubmitCalls = 0;
const runningVideo = await runAgentVideoExecution({
  plan: videoPlan,
  ledger: liveWithoutProviderEvidence.ledger,
  action: "submit_video",
  actionId: "p3-live-video-running-action",
  sourceConfirmationId: "p3-live-video-running-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  execute: () => {
    runningSubmitCalls += 1;
    return { status: "submitted", providerCalled: true, externalTaskId: "mock-submit-p3" };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(runningVideo.status === "running" && runningVideo.job?.status === "running", "submitted live video must remain recoverable instead of becoming a fake success");
assert(runningVideo.receipt.externalTaskId === "mock-submit-p3", "running receipt must retain the external task id");
assert(runningVideo.job?.operation === "execute", "submitted video jobs must remain marked as execute operations");

const duplicateRunningSubmit = await runAgentVideoExecution({
  plan: videoPlan,
  ledger: runningVideo.ledger,
  action: "submit_video",
  actionId: "p3-live-video-running-action",
  sourceConfirmationId: "p3-live-video-running-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  execute: () => {
    runningSubmitCalls += 1;
    return { status: "submitted", providerCalled: true, submitId: "must-not-resubmit" };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(duplicateRunningSubmit.status === "running" && duplicateRunningSubmit.job?.jobId === runningVideo.job?.jobId, "a repeated running submit must restore the same job");
assert(runningSubmitCalls === 1 && duplicateRunningSubmit.ledger.jobs.length === runningVideo.ledger.jobs.length, "a repeated running submit must not call the provider or append another job");

let queryCalls = 0;
const runningQuery = await runAgentVideoExecution({
  plan: videoQueryPlan,
  ledger: runningVideo.ledger,
  action: "submit_video",
  operation: "query",
  actionId: "p3-live-video-query-action",
  sourceConfirmationId: "p3-live-video-query-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  execute: (context) => {
    queryCalls += 1;
    assert(context.job.externalTaskId === "mock-submit-p3", "query execution must inherit the submitted external task id");
    return { status: "running", providerCalled: true, taskId: context.job.externalTaskId };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(runningQuery.status === "running" && runningQuery.job?.operation === "query", "a live query must persist as a query job while the external task is still running");
assert(runningQuery.job?.externalTaskId === "mock-submit-p3", "the persisted query job must retain the submitted external task id");

const mismatchedQueryOperation = await runAgentVideoExecution({
  plan: videoQueryPlan,
  ledger: runningQuery.ledger,
  action: "submit_video",
  operation: "execute",
  actionId: "p3-live-video-query-action",
  sourceConfirmationId: "p3-live-video-query-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  execute: () => {
    queryCalls += 1;
    return { status: "submitted", providerCalled: true };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(mismatchedQueryOperation.status === "blocked" && queryCalls === 1, "a persisted query action must never be replayed as video submit");

const completedQuery = await runAgentVideoExecution({
  plan: videoQueryPlan,
  ledger: runningQuery.ledger,
  action: "submit_video",
  operation: "query",
  actionId: "p3-live-video-query-action",
  sourceConfirmationId: "p3-live-video-query-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  execute: () => {
    queryCalls += 1;
    return { status: "needs_review", providerCalled: true, outputVideoPath: "/tmp/p3-query-result.mp4" };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(completedQuery.status === "completed" && completedQuery.job?.jobId === runningQuery.job?.jobId, "a repeated query must reuse and finish the same query job");
assert(queryCalls === 2 && completedQuery.ledger.jobs.length === runningQuery.ledger.jobs.length, "repeated queries must not append duplicate jobs");
assert(completedQuery.receipt.operation === "query" && completedQuery.receipt.outputAssets[0] === "/tmp/p3-query-result.mp4", "query receipts must preserve operation and returned video evidence");

let timeoutSignalObserved = false;
const timeoutResult = await runAgentVideoExecution({
  plan: videoPlan,
  ledger: runningVideo.ledger,
  action: "submit_video",
  actionId: "p3-live-video-timeout-action",
  sourceConfirmationId: "p3-live-video-timeout-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  timeoutMs: 5,
  execute: ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => {
      timeoutSignalObserved = true;
      reject(new Error("mock executor aborted"));
    }, { once: true });
  }),
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(timeoutResult.status === "timed_out" && timeoutResult.receipt.status === "timed_out", "timeout must be explicit in the receipt");
assert(timeoutResult.job?.status === "running", "timed-out live work must stay recoverable instead of becoming succeeded");
assert(timeoutResult.job?.outputAssets.length === 0, "timeout must not invent outputs");
assert(timeoutSignalObserved, "timeout must abort the live executor signal");
assert(timeoutResult.providerCalled === false && timeoutResult.receipt.providerCalled === false, "timeout without provider evidence must not claim that an external provider was called");

const cancelController = new AbortController();
let cancelSignalObserved = false;
const cancelPromise = runAgentVideoExecution({
  plan: videoPlan,
  ledger: timeoutResult.ledger,
  action: "submit_video",
  actionId: "p3-live-video-cancel-action",
  sourceConfirmationId: "p3-live-video-cancel-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-video-provider",
    providerName: "Mock Video Provider",
    modelId: "mock-video-model",
  },
  signal: cancelController.signal,
  execute: ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => {
      cancelSignalObserved = true;
      reject(new Error("mock executor cancelled"));
    }, { once: true });
  }),
  onLedgerSnapshot: persistLedgerSnapshot,
});
setTimeout(() => cancelController.abort(), 1);
const cancelled = await cancelPromise;
assert(cancelled.status === "cancelled" && cancelled.job?.status === "cancelled", "user cancellation must become a terminal cancelled job");
assert(cancelSignalObserved, "user cancellation must reach the live executor signal");
assert(cancelled.providerCalled === false && cancelled.receipt.providerCalled === false, "cancellation without provider evidence must not claim that an external provider was called");

let failedCalls = 0;
const failed = await runAgentVideoExecution({
  plan: referencePlan,
  ledger: cancelled.ledger,
  action: "prepare_references",
  actionId: "p3-manual-retry-original",
  sourceConfirmationId: "p3-manual-retry-original-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  execute: () => {
    failedCalls += 1;
    return { ok: false, status: "blocked", providerCalled: false, message: "mock failure" };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(failed.status === "blocked" && failed.job?.status === "failed", "blocked live result must be terminal and retryable only by a new action");
const duplicateTerminal = await runAgentVideoExecution({
  plan: referencePlan,
  ledger: failed.ledger,
  action: "prepare_references",
  actionId: "p3-manual-retry-original",
  sourceConfirmationId: "p3-manual-retry-original-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  execute: () => {
    failedCalls += 1;
    return { status: "needs_review", providerCalled: true };
  },
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(duplicateTerminal.status === "blocked" && failedCalls === 1, "same terminal action must not auto-retry or call the executor twice");
const retried = await runAgentVideoExecution({
  plan: referencePlan,
  ledger: failed.ledger,
  action: "prepare_references",
  actionId: "p3-manual-retry-attempt-2",
  retryOfActionId: "p3-manual-retry-original",
  sourceConfirmationId: "p3-manual-retry-attempt-2-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "mock-image-provider",
    providerName: "Mock Image Provider",
    modelId: "mock-image-model",
  },
  execute: () => ({ status: "needs_review", providerCalled: true, assets: [{ path: "/tmp/p3-retry-reference.png" }] }),
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(retried.status === "completed" && retried.receipt.attempt === 2, "explicit retry must create a second successful attempt");
assert(retried.ledger.jobs.filter((job) => job.actionId.startsWith("p3-manual-retry")).length === 2, "explicit retry should retain both attempt records");

const exportPlan = buildAgentVideoPipelinePlan({
  planId: "p8-delivery-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: true,
});
const exportActionId = "p8-export-action";
const exportConfirmationId = "p8-export-confirmation";
const exportOutputPath = "exports/current/export_manifest.json";
const exportProjectVibePath = "exports/current/Project.vibe";
const deliveryReceipt = {
  schemaVersion: EXPORT_DELIVERY_RECEIPT_SCHEMA_VERSION,
  receiptId: "export_delivery_p8_export_action_p8_export_confirmation",
  status: "succeeded" as const,
  ...identity,
  actionId: exportActionId,
  confirmationId: exportConfirmationId,
  reviewBindings: [{
    reviewReceiptId: "review_p8_s01",
    reviewedAt: generatedAt,
    shotId: "S01",
    outputPath: "video/S01.mp4",
    sourceReceiptId: "provider_receipt_p8_s01",
    outputHash: `sha256:${"8".repeat(64)}`,
    humanReviewed: true as const,
    promotionAuthorized: false,
  }],
  executionMode: "live" as const,
  outputs: [
    { operation: "write_file" as const, path: exportOutputPath, outputHash: "vck_export" },
    { operation: "write_file" as const, path: exportProjectVibePath, outputHash: "vck_project" },
  ],
  createdAt: generatedAt,
};
const exportLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "p8-export-ledger",
  createdAt: generatedAt,
  ...identity,
});
const exported = await runAgentVideoExecution({
  plan: exportPlan,
  ledger: exportLedger,
  action: "export",
  actionId: exportActionId,
  sourceConfirmationId: exportConfirmationId,
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "local-exporter",
    providerName: "Local Exporter",
    modelId: "project-export-v1",
    capability: "export",
    asyncMode: "sync",
  },
  execute: () => ({
    status: "ready",
    providerCalled: false,
    outputAssets: [exportOutputPath, exportProjectVibePath],
    deliveryReceipt,
  }),
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(exported.status === "completed" && exported.receipt.status === "succeeded", "complete delivery receipt should allow a live local export to finish");
assert(exported.receipt.deliveryReceipt?.receiptId === deliveryReceipt.receiptId, "delivery receipt must persist inside the Agent execution receipt");
assert(restoreAgentVideoExecutionReceipt(exported.receipt, identity).ok, "cold-start receipt restore must accept the current complete delivery receipt");

const corruptExport = await runAgentVideoExecution({
  plan: exportPlan,
  ledger: createAgentVideoGenerationJobLedger({
    ledgerId: "p8-corrupt-export-ledger",
    createdAt: generatedAt,
    ...identity,
  }),
  action: "export",
  actionId: "p8-corrupt-export-action",
  sourceConfirmationId: "p8-corrupt-export-confirmation",
  executionMode: "live",
  liveExecutionAllowed: true,
  liveCapability: {
    providerId: "local-exporter",
    providerName: "Local Exporter",
    modelId: "project-export-v1",
    capability: "export",
    asyncMode: "sync",
  },
  execute: () => ({ status: "ready", providerCalled: false, outputAssets: [exportOutputPath] }),
  onLedgerSnapshot: persistLedgerSnapshot,
});
assert(corruptExport.status === "failed" && corruptExport.receipt.status === "failed", "missing delivery receipt must fail closed instead of restoring export completion");
assert(corruptExport.receipt.outputAssets.length === 0, "invalid export receipt must not claim output assets");
assert(corruptExport.blockers.some((item) => item.includes("delivery_receipt_invalid")), "invalid delivery receipt blocker missing");

const minimalAgentPanelSource = fs.readFileSync("src/ui/director/MinimalAgentPanel.tsx", "utf8");
const executionControllerSource = fs.readFileSync("src/ui/director/agentVideoExecutionController.ts", "utf8");
const executionAdapterSource = fs.readFileSync("src/core/agentVideoExecutionAdapter.ts", "utf8");
const imageActionSource = fs.readFileSync("src/ui/director/useImage2AssetGenerationAction.ts", "utf8");
const endFrameActionSource = fs.readFileSync("src/ui/director/useImage2EndFrameAction.ts", "utf8");
const videoActionSource = fs.readFileSync("src/ui/director/useSeedanceVideoSubmitAction.ts", "utf8");
const appSource = fs.readFileSync("src/App.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
assert(/createAgentVideoExecutionController\([\s\S]*runExecution[\s\S]*runFooterExecution/.test(executionControllerSource) && /runAgentVideoConfirmedProductAction\([\s\S]*controller:\s*agentVideoExecutionController/.test(minimalAgentPanelSource) && /function runFooterAgentVideoExecution[\s\S]*agentVideoExecutionController\.runFooterExecution/.test(minimalAgentPanelSource), "Agent confirmations and footer actions must retain one configured execution controller");
assert((executionAdapterSource.match(/await input\.onTimelineEntries\?\.\(entries\);/g) || []).length === 1, "shared execution must publish each timeline batch once");
assert(/const inFlight = new Map[\s\S]*const existing = inFlight\.get\(inFlightKey\)[\s\S]*if \(existing\) return existing[\s\S]*inFlight\.set\(inFlightKey, execution\)[\s\S]*inFlight\.delete\(inFlightKey\)/.test(executionControllerSource), "the shared execution controller must collapse concurrent calls for the same project action and operation");
assert(/createReferences:\s*\(target\) => runExecution\([\s\S]*action:\s*"prepare_references"[\s\S]*submitVideo:[\s\S]*action:\s*"submit_video"[\s\S]*queryVideo:[\s\S]*operation:\s*"query"[\s\S]*runExport:[\s\S]*action:\s*"export"/.test(executionControllerSource) && /execution\.runner\?\.\(execution\.target, context\.signal, context\)/.test(executionControllerSource), "Agent product callbacks must receive the shared adapter cancellation signal and execution receipt context");
assert(/onCreateImage2EndFrame\(\{[\s\S]*skipConfirm:\s*true[\s\S]*confirmationReceiptId:\s*context\.receipt\.confirmationReceiptId[\s\S]*signal:\s*context\.signal/.test(minimalAgentPanelSource), "footer end-frame execution must reuse the shared confirmation and cancellation boundary");
assert(/function agentTimelineLiveExecutionCoversProjectedState[\s\S]*executionMode === "live"[\s\S]*projectFactHash/.test(executionControllerSource) && /agentTimelineLiveExecutionCoversProjectedState\([\s\S]*"prepare_references"[\s\S]*agentTimelineLiveExecutionCoversProjectedState\([\s\S]*"submit_video"/.test(minimalAgentPanelSource), "passive product state must not duplicate a matching fact-bound shared execution receipt");
assert(/const keyConfigured = useMemo\([\s\S]*\(\) => isAssetKeyConfigured\(providerConfigStatuses\)[\s\S]*\[providerConfigStatuses\]/.test(imageActionSource), "reference execution must fail closed until provider status explicitly reports a configured key");
assert(!/providerConfigStatuses\.length === 0 \|\| isAssetKeyConfigured/.test(imageActionSource), "an empty provider-status response must not make a reference confirmation live");
assert(/signal\?: AbortSignal[\s\S]*submitProjectImage2AssetGeneration\([\s\S]*options\?\.signal[\s\S]*return \{ \.\.\.submitted, \.\.\.nextState \}/.test(imageActionSource), "reference generation must pass cancellation and return runtime evidence to the adapter");
assert(/skipConfirm\?: boolean[\s\S]*signal\?: AbortSignal[\s\S]*!options\?\.skipConfirm[\s\S]*submitProjectImage2EndFrame\([\s\S]*options\?\.signal[\s\S]*return \{ \.\.\.submitted, \.\.\.nextState \}/.test(endFrameActionSource), "end-frame generation must avoid duplicate confirmation, pass cancellation, and preserve runtime evidence");
assert(/function videoRequestSignal\(parentSignal\?: AbortSignal\)[\s\S]*if \(parentSignal\) return \{ signal: parentSignal[\s\S]*controller\.abort\(\)[\s\S]*resumeProjectSeedanceVideo\([\s\S]*request\.signal[\s\S]*return \{ \.\.\.resumed, \.\.\.nextState \}[\s\S]*submitProjectSeedanceVideo\([\s\S]*request\.signal[\s\S]*return \{ \.\.\.submitted, \.\.\.nextState \}/.test(videoActionSource), "video query and submit must let the shared adapter own cancellation, abort manual timeouts, and return runtime evidence");
assert(/runLocalExportAction\(input\?: \{[\s\S]*agentToolTrace\?:[\s\S]*signal\?: AbortSignal;[\s\S]*exportExecutionReceipt\?: AgentVideoExecutionReceipt;[\s\S]*runExportAction\(\{[\s\S]*signal:\s*input\?\.signal[\s\S]*deliveryConfirmation:\s*exportConfirmationReceipt/.test(appSource), "local export must pass adapter cancellation and the structured export confirmation receipt to the file writer");
assert(packageJson.scripts?.["demo:ready:test"]?.includes("agent-video-execution-adapter:test"), "the P3 execution adapter test must be part of demo readiness");
assert(packageJson.scripts?.["demo:ready:test"]?.includes("agent-video-execution-controller:test"), "the P6-A execution controller test must be part of demo readiness");
assert(packageJson.scripts?.["demo:ready:test"]?.includes("agent-video-dry-run-adapter:test"), "the truthful dry-run adapter test must be part of demo readiness");

console.log("agent-video-execution-adapter-test passed; no external provider was called");
