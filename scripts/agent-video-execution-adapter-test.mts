import fs from "node:fs";
import {
  runAgentVideoExecution,
  type AgentVideoExecutionReceipt,
} from "../src/core/agentVideoExecutionAdapter.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";

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
assert(!/参考可用|视频可用|\.mp4|local-verification/.test(JSON.stringify(dry.timelineEntries)), "dry-run timeline must not claim real media or fake paths");
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
});
assert(liveWithoutProviderEvidence.status === "completed", "a live callback may complete from returned product state");
assert(liveWithoutProviderEvidence.providerCalled === false, "live success without explicit provider evidence must not infer an external call");

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
  execute: () => ({ status: "submitted", providerCalled: true, submitId: "mock-submit-p3" }),
});
assert(runningVideo.status === "running" && runningVideo.job?.status === "running", "submitted live video must remain recoverable instead of becoming a fake success");
assert(runningVideo.receipt.externalTaskId === "mock-submit-p3", "running receipt must retain the external task id");

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
});
assert(retried.status === "completed" && retried.receipt.attempt === 2, "explicit retry must create a second successful attempt");
assert(retried.ledger.jobs.filter((job) => job.actionId.startsWith("p3-manual-retry")).length === 2, "explicit retry should retain both attempt records");

const minimalAgentPanelSource = fs.readFileSync("src/ui/director/MinimalAgentPanel.tsx", "utf8");
const imageActionSource = fs.readFileSync("src/ui/director/useImage2AssetGenerationAction.ts", "utf8");
const endFrameActionSource = fs.readFileSync("src/ui/director/useImage2EndFrameAction.ts", "utf8");
const videoActionSource = fs.readFileSync("src/ui/director/useSeedanceVideoSubmitAction.ts", "utf8");
const appSource = fs.readFileSync("src/App.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
assert(/function runSharedAgentVideoExecution[\s\S]*runConfiguredAgentVideoExecution\([\s\S]*function runFooterAgentVideoExecution[\s\S]*runSharedAgentVideoExecution/.test(minimalAgentPanelSource), "Agent confirmations and footer actions must retain one configured execution adapter");
assert(/createReferences:\s*\(target\) => runExecution\([\s\S]*perform:\s*referenceLive \? \(context\) => onCreateP6RealSample\?\.\(\{ \.\.\.target, signal: context\.signal \}\)[\s\S]*submitVideo:[\s\S]*signal: context\.signal[\s\S]*queryVideo:[\s\S]*signal: context\.signal[\s\S]*runExport:[\s\S]*signal: context\.signal/.test(minimalAgentPanelSource), "Agent product callbacks must receive the shared adapter cancellation signal");
assert(/onCreateImage2EndFrame\(\{[\s\S]*skipConfirm:\s*true[\s\S]*confirmationReceiptId:\s*context\.receipt\.confirmationReceiptId[\s\S]*signal:\s*context\.signal/.test(minimalAgentPanelSource), "footer end-frame execution must reuse the shared confirmation and cancellation boundary");
assert(/function agentTimelineLiveExecutionCoversProjectedState[\s\S]*executionMode === "live"[\s\S]*projectFactHash[\s\S]*agentTimelineLiveExecutionCoversProjectedState\([\s\S]*"prepare_references"[\s\S]*agentTimelineLiveExecutionCoversProjectedState\([\s\S]*"submit_video"/.test(minimalAgentPanelSource), "passive product state must not duplicate a matching fact-bound shared execution receipt");
assert(/signal\?: AbortSignal[\s\S]*submitProjectImage2AssetGeneration\([\s\S]*options\?\.signal[\s\S]*return \{ \.\.\.submitted, \.\.\.nextState \}/.test(imageActionSource), "reference generation must pass cancellation and return runtime evidence to the adapter");
assert(/skipConfirm\?: boolean[\s\S]*signal\?: AbortSignal[\s\S]*!options\?\.skipConfirm[\s\S]*submitProjectImage2EndFrame\([\s\S]*options\?\.signal[\s\S]*return \{ \.\.\.submitted, \.\.\.nextState \}/.test(endFrameActionSource), "end-frame generation must avoid duplicate confirmation, pass cancellation, and preserve runtime evidence");
assert(/function videoRequestSignal\(parentSignal\?: AbortSignal\)[\s\S]*if \(parentSignal\) return \{ signal: parentSignal[\s\S]*controller\.abort\(\)[\s\S]*resumeProjectSeedanceVideo\([\s\S]*request\.signal[\s\S]*return \{ \.\.\.resumed, \.\.\.nextState \}[\s\S]*submitProjectSeedanceVideo\([\s\S]*request\.signal[\s\S]*return \{ \.\.\.submitted, \.\.\.nextState \}/.test(videoActionSource), "video query and submit must let the shared adapter own cancellation, abort manual timeouts, and return runtime evidence");
assert(/runLocalExportAction\(input\?: \{ agentToolTrace\?:[\s\S]*signal\?: AbortSignal \}\)[\s\S]*runExportAction\(\{[\s\S]*signal:\s*input\?\.signal/.test(appSource), "local export must pass adapter cancellation to the file writer");
assert(packageJson.scripts?.["demo:ready:test"]?.includes("agent-video-execution-adapter:test"), "the P3 execution adapter test must be part of demo readiness");
assert(packageJson.scripts?.["demo:ready:test"]?.includes("agent-video-dry-run-adapter:test"), "the truthful dry-run adapter test must be part of demo readiness");

console.log("agent-video-execution-adapter-test passed; no external provider was called");
