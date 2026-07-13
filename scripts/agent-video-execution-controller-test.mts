import {
  agentVideoExecutionLedgerMatchesProject,
  agentVideoExecutionToolResult,
  configuredAgentVideoLiveCapability,
  createAgentVideoExecutionController,
} from "../src/ui/director/agentVideoExecutionController.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  type AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("FAIL: timed out waiting for controller execution");
}

const identity = {
  projectId: "p6-a-controller-project",
  projectRoot: "/tmp/p6-a-controller-project",
  projectFactHash: "p6-a-controller-facts",
};
const generatedAt = "2026-07-13T12:00:00.000Z";

function controllerFixture(options: { persistence?: boolean } = {}) {
  let projectIdentity = identity;
  let ledger: AgentVideoGenerationJobLedger = createAgentVideoGenerationJobLedger({
    ledgerId: "p6-a-controller-ledger",
    createdAt: generatedAt,
    ...identity,
  });
  const persistedStatuses: string[] = [];
  const timelineEntryIds: string[] = [];
  const statuses: string[] = [];
  const controller = createAgentVideoExecutionController({
    getProjectIdentity: () => projectIdentity,
    setProjectIdentity: (nextIdentity) => {
      projectIdentity = nextIdentity;
    },
    getLedger: () => ledger,
    setLedger: (nextLedger) => {
      ledger = nextLedger;
    },
    persistLedger: options.persistence === false
      ? undefined
      : async (snapshot) => {
          persistedStatuses.push(snapshot.jobs.at(-1)?.status || "missing");
        },
    publishTimeline: (entries) => {
      timelineEntryIds.push(...entries.map((entry) => entry.id));
    },
    setStatus: (status) => {
      statuses.push(status);
    },
  });
  return {
    controller,
    getIdentity: () => projectIdentity,
    getLedger: () => ledger,
    persistedStatuses,
    timelineEntryIds,
    statuses,
  };
}

assert(configuredAgentVideoLiveCapability("prepare_references").capability === "reference-image-generation", "reference execution must select the reference capability");
assert(configuredAgentVideoLiveCapability("submit_video").capability === "image-to-video", "video execution must select the video capability");
assert(configuredAgentVideoLiveCapability("export").providerId === "local-exporter", "export execution must remain local");

const referencePlan = buildAgentVideoPipelinePlan({
  planId: "p6-a-reference-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 1,
  videoSubmitted: false,
});
const dryFixture = controllerFixture();
let dryPerformCalls = 0;
const dryReference = await dryFixture.controller.runExecution({
  plan: referencePlan,
  action: "prepare_references",
  actionId: "p6-a-dry-reference",
  confirmationReceiptId: "p6-a-dry-reference-confirmation",
  executionMode: "dry_run",
  generatedAt,
  perform: () => {
    dryPerformCalls += 1;
    return { status: "needs_review", assets: [{ path: "/tmp/must-not-exist.png" }] };
  },
});
assert(dryReference.receipt.status === "validated", "controller dry-run must remain a validation result");
assert(dryPerformCalls === 0 && dryReference.providerCalled === false, "controller dry-run must not call a provider callback");
assert(dryReference.receipt.outputAssets.length === 0, "controller dry-run must not claim media outputs");
assert(dryFixture.persistedStatuses.join(">") === "staged>confirmed>running>succeeded", "controller must persist every dry-run job transition");
assert(dryFixture.timelineEntryIds.length === 2, "controller must publish one start and one result entry");
assert(agentVideoExecutionToolResult(dryReference).dryRunOnly === true, "Agent tool projection must preserve dry-run truth");
assert(agentVideoExecutionLedgerMatchesProject(dryFixture.getLedger(), identity), "controller ledger must stay bound to the current project facts");

const videoPlan = buildAgentVideoPipelinePlan({
  planId: "p6-a-video-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
const videoFixture = controllerFixture();
let videoPerformCalls = 0;
let releaseVideo: ((value: unknown) => void) | undefined;
const performVideo = () => {
  videoPerformCalls += 1;
  return new Promise((resolve) => {
    releaseVideo = resolve;
  });
};
const videoInput = {
  plan: videoPlan,
  action: "submit_video" as const,
  actionId: "p6-a-live-video",
  confirmationReceiptId: "p6-a-live-video-confirmation",
  executionMode: "live" as const,
  generatedAt: "2026-07-13T12:01:00.000Z",
  perform: performVideo,
};
const firstVideo = videoFixture.controller.runExecution(videoInput);
const duplicateVideo = videoFixture.controller.runExecution(videoInput);
await waitFor(() => videoPerformCalls === 1 && Boolean(releaseVideo));
releaseVideo?.({ status: "submitted", providerCalled: true, submitId: "p6-a-video-task" });
const [videoResult, duplicateVideoResult] = await Promise.all([firstVideo, duplicateVideo]);
assert(videoPerformCalls === 1, "controller must collapse concurrent duplicate submissions");
assert(videoResult.job?.jobId === duplicateVideoResult.job?.jobId, "duplicate submissions must share one generation job");
assert(videoResult.status === "running" && videoResult.receipt.externalTaskId === "p6-a-video-task", "submitted video must remain recoverable with its external task id");

const exportPlan = buildAgentVideoPipelinePlan({
  planId: "p6-a-export-plan",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: true,
});
const exportFixture = controllerFixture();
const exportResult = await exportFixture.controller.runFooterExecution({
  plan: exportPlan,
  action: "export",
  actionId: "p6-a-live-export",
  confirmationReceiptId: "p6-a-live-export-confirmation",
  timeoutMs: 5_000,
  perform: () => ({ status: "completed", manifestPath: "/tmp/p6-a-export-manifest.json" }),
});
assert(exportResult.status === "completed" && exportResult.providerCalled === false, "local export must complete without claiming a provider call");
assert(exportResult.receipt.outputAssets[0] === "/tmp/p6-a-export-manifest.json", "local export must retain the returned manifest path");
assert(exportFixture.statuses.at(-1) === "动作已完成。", "footer execution must publish its final creator status");

const noPersistenceFixture = controllerFixture({ persistence: false });
let unpersistedPerformCalls = 0;
const blockedWithoutPersistence = await noPersistenceFixture.controller.runExecution({
  plan: referencePlan,
  action: "prepare_references",
  actionId: "p6-a-live-reference-without-persistence",
  confirmationReceiptId: "p6-a-live-reference-without-persistence-confirmation",
  executionMode: "live",
  perform: () => {
    unpersistedPerformCalls += 1;
    return { status: "needs_review", providerCalled: true };
  },
});
assert(blockedWithoutPersistence.status === "blocked", "live controller execution must fail closed without durable ledger persistence");
assert(unpersistedPerformCalls === 0, "missing persistence must block before the provider callback");

console.log("agent-video-execution-controller-test passed; no external provider was called");
