import {
  buildAgentCurrentTaskProjection,
} from "../src/core/agentCurrentTaskProjection.ts";
import {
  runAgentVideoDryRunConfirmedAction,
} from "../src/core/agentVideoDryRunAdapter.ts";
import {
  buildAgentVideoPipelinePlan,
  buildDefaultAgentVideoProviderCapabilityRegistry,
  createAgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function statusTrace(result: { statusTrace: string[] }) {
  return result.statusTrace.join(">");
}

const generatedAt = "2026-07-07T00:00:00.000Z";
const registry = buildDefaultAgentVideoProviderCapabilityRegistry(generatedAt);
assert(registry.capabilities.every((item) => item.dryRunOnly && item.liveSubmitAllowed === false), "provider registry must stay dry-run and never live-submit");

const missingReferencesPlan = buildAgentVideoPipelinePlan({
  planId: "dry_run_missing_references",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const emptyLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "dry_run_adapter_test",
  projectId: "dry-run-adapter-project",
  projectRoot: "/tmp/dry-run-adapter-project",
  projectFactHash: "dry-run-adapter-facts",
  createdAt: generatedAt,
});

const referenceDryRun = await runAgentVideoDryRunConfirmedAction({
  plan: missingReferencesPlan,
  ledger: emptyLedger,
  action: "prepare_references",
  actionId: "action-reference-generation",
  sourceConfirmationId: "confirm_reference_generation",
  sourceTimelineId: "timeline_reference_generation",
  generatedAt: "2026-07-07T00:00:10.000Z",
  prompt: "prepare two current-story references",
});
assert(referenceDryRun.status === "completed", `reference dry-run should complete: ${referenceDryRun.blockers.join("; ")}`);
assert(referenceDryRun.dryRunOnly && referenceDryRun.liveSubmitAllowed === false, "reference dry-run must never live-submit");
assert(referenceDryRun.job?.kind === "reference_generation", "reference dry-run should create a reference_generation job");
assert(referenceDryRun.job?.sourceConfirmationId === "confirm_reference_generation", "reference job must bind to source confirmation");
assert(statusTrace(referenceDryRun) === "staged>confirmed>running>succeeded", "reference job status history should record staged/confirmed/running/succeeded");
assert(referenceDryRun.ledgerSnapshots.map((ledger) => ledger.jobs.at(-1)?.status).join(">") === "staged>confirmed>running>succeeded", "dry-run adapter must expose every persistable ledger transition");
assert(referenceDryRun.timelineEntries.some((entry) => entry.type === "tool_result" && entry.toolName === "generate_references"), "reference dry-run should write a generate_references tool_result");
assert(referenceDryRun.receipt.status === "validated", "reference dry-run must record contract validation rather than real reference readiness");
assert(referenceDryRun.job?.outputAssets.length === 0, "reference dry-run must not create fake reference paths");
assert(referenceDryRun.timelineEntries.every((entry) => !/参考可用|local-verification/.test(`${entry.title} ${entry.body} ${entry.details?.next || ""}`)), "reference dry-run must not claim real references are usable");
assert(referenceDryRun.timelineEntries.every((entry) => entry.details?.dryRun === true), "reference dry-run timeline entries must mark dryRun=true");

const videoBlockedByReferences = await runAgentVideoDryRunConfirmedAction({
  plan: missingReferencesPlan,
  ledger: emptyLedger,
  action: "submit_video",
  actionId: "action-submit-video-too-early",
  sourceConfirmationId: "confirm_submit_video_too_early",
  generatedAt: "2026-07-07T00:00:20.000Z",
});
assert(videoBlockedByReferences.status === "blocked", "video dry-run must block when references are missing");
assert(videoBlockedByReferences.ledger.jobs.length === 0, "blocked video dry-run must not create a job");
assert(videoBlockedByReferences.ledgerSnapshots.length === 0, "blocked planning must not expose a fake ledger transition");
assert(videoBlockedByReferences.blockers.some((blocker) => /Missing references/.test(blocker)), "blocked video dry-run should explain missing references");
assert(videoBlockedByReferences.timelineEntries.some((entry) => entry.type === "tool_result" && entry.status === "blocked"), "blocked video dry-run should write a blocked tool_result");

const videoReadyPlan = buildAgentVideoPipelinePlan({
  planId: "dry_run_video_ready",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
});
const videoDryRun = await runAgentVideoDryRunConfirmedAction({
  plan: videoReadyPlan,
  ledger: emptyLedger,
  action: "submit_video",
  actionId: "action-submit-video",
  sourceConfirmationId: "confirm_submit_video",
  generatedAt: "2026-07-07T00:00:30.000Z",
  prompt: "submit the current story video",
});
assert(videoDryRun.status === "completed", `video dry-run should complete: ${videoDryRun.blockers.join("; ")}`);
assert(videoDryRun.job?.kind === "video_submit", "video dry-run should create a video_submit job");
assert(videoDryRun.timelineEntries.some((entry) => entry.type === "tool_result" && entry.toolName === "submit_video"), "video dry-run should write a submit_video tool_result");
assert(videoDryRun.receipt.status === "validated", "video dry-run must record contract validation rather than video readiness");
assert(videoDryRun.job?.outputAssets.length === 0, "video dry-run must not produce a fake video output path");
assert(videoDryRun.timelineEntries.every((entry) => !/视频可用|\.mp4|local-verification/.test(`${entry.title} ${entry.body} ${entry.details?.next || ""}`)), "video dry-run must not claim a real video exists");

const runningVideoProjection = buildAgentCurrentTaskProjection({
  pipelinePlan: videoReadyPlan,
  currentProjectId: emptyLedger.projectId,
  currentProjectRoot: emptyLedger.projectRoot,
  currentProjectFactHash: emptyLedger.projectFactHash,
  jobLedger: {
    ...videoDryRun.ledger,
    jobs: videoDryRun.ledger.jobs.map((job) => job.jobId === videoDryRun.job?.jobId ? {
      ...job,
      status: "running" as const,
      updatedAt: "2026-07-07T00:00:31.000Z",
    } : job),
  },
});
assert(runningVideoProjection.source === "pipeline_job", "projection should restore a non-terminal dry-run video job");
assert(runningVideoProjection.jobId === videoDryRun.job?.jobId, "projection should expose the running dry-run job id");

const exportReadyPlan = buildAgentVideoPipelinePlan({
  planId: "dry_run_export_ready",
  generatedAt,
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: true,
});
const exportDryRun = await runAgentVideoDryRunConfirmedAction({
  plan: exportReadyPlan,
  ledger: emptyLedger,
  action: "export",
  actionId: "action-export",
  sourceConfirmationId: "confirm_export",
  generatedAt: "2026-07-07T00:00:40.000Z",
  prompt: "export current project package",
});
assert(exportDryRun.status === "completed", `export dry-run should complete: ${exportDryRun.blockers.join("; ")}`);
assert(exportDryRun.job?.kind === "export", "export dry-run should create an export job");
assert(exportDryRun.timelineEntries.some((entry) => entry.type === "tool_result" && entry.toolName === "export_project"), "export dry-run should write an export_project tool_result");
assert(exportDryRun.receipt.status === "validated", "export dry-run must record contract validation rather than export readiness");
assert(exportDryRun.job?.outputAssets.length === 0, "export dry-run must not produce a fake export path");

const noConfirmationDryRun = await runAgentVideoDryRunConfirmedAction({
  plan: videoReadyPlan,
  ledger: emptyLedger,
  action: "submit_video",
  actionId: "action-no-confirmation",
  sourceConfirmationId: "",
  generatedAt: "2026-07-07T00:00:50.000Z",
});
assert(noConfirmationDryRun.status === "blocked", "dry-run adapter must block without a confirmation id");
assert(noConfirmationDryRun.ledger.jobs.length === 0, "dry-run adapter must not create jobs without confirmation");
assert(noConfirmationDryRun.blockers.some((blocker) => /confirmation/i.test(blocker)), "missing confirmation blocker should mention confirmation");

console.log("agent-video-dry-run-adapter-test passed");
