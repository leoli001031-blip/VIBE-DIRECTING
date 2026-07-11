import { readFileSync } from "node:fs";

import {
  buildAgentCurrentTaskProjection,
} from "../src/core/agentCurrentTaskProjection.ts";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  transitionAgentVideoGenerationJob,
} from "../src/core/agentVideoProductionContract.ts";
import {
  openProjectAgentGenerationJobLedger,
  projectAgentGenerationJobLedgerPath,
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

  const legacy = restoreProjectAgentGenerationJobLedger({
    ...running.ledger,
    schemaVersion: "agent_video_generation_job_ledger/0.2.0",
    jobs: running.ledger.jobs.map((job) => ({
      ...job,
      executionMode: undefined,
      providerCalled: undefined,
    })),
  }, identity);
  assert(legacy.ok && legacy.ledger?.schemaVersion === "agent_video_generation_job_ledger/0.3.0", "0.2 ledgers must migrate to the P3 execution schema");
  assert(legacy.ledger?.jobs.every((job) => job.executionMode === "dry_run" && job.providerCalled === false), "legacy P2 jobs must migrate conservatively as provider-free dry runs");
} finally {
  delete (globalThis as { window?: unknown }).window;
}

const bindingClientSource = readFileSync("src/core/projectCurrentBindingClient.ts", "utf8");
const runtimeServerSource = readFileSync("scripts/local-runtime-api-server.mts", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const directorModeSource = readFileSync("src/ui/director/DirectorModeShell.tsx", "utf8");
const minimalAgentPanelSource = readFileSync("src/ui/director/MinimalAgentPanel.tsx", "utf8");
assert(/projectCurrentAgentGenerationJobLedgerEndpoint[\s\S]*agent-generation-job-ledger/.test(bindingClientSource), "runtime client must expose the generation-ledger endpoint");
assert(/loadCurrentProjectAgentGenerationJobLedgerTextFromRuntime[\s\S]*saveCurrentProjectAgentGenerationJobLedgerTextToRuntime/.test(bindingClientSource), "runtime client must expose ledger read/write helpers");
assert(/currentProjectAgentGenerationJobLedgerSidecarPath\s*=\s*"\.vibe-runtime\/agent-generation-job-ledger\.json"/.test(runtimeServerSource), "runtime route must pin the ledger sidecar path");
assert(/handleCurrentProjectAgentGenerationJobLedgerRoute[\s\S]*isPathInsideRealRoot[\s\S]*writeFileSync\(tempPath, content, "utf8"\)[\s\S]*renameSync\(tempPath, sidecarPath\)/.test(runtimeServerSource), "runtime ledger writes must stay project-scoped and atomic");
assert((appSource.match(/openProjectAgentGenerationJobLedger\(/g) || []).length >= 3, "browser, local, and runtime project restore paths must all open the generation ledger");
assert(/rememberAgentGenerationJobLedger[\s\S]*agentGenerationLedgerMatchesIdentity[\s\S]*saveProjectAgentGenerationJobLedger/.test(appSource), "App must serialize identity-checked ledger writes");
assert(/restoredAgentGenerationJobLedger=\{restoredAgentGenerationJobLedger\}[\s\S]*onRememberAgentGenerationJobLedger=\{rememberAgentGenerationJobLedger\}/.test(appSource), "App must pass restored ledger state and persistence callback into DirectorMode");
assert(/restoredAgentGenerationJobLedger\?: AgentVideoGenerationJobLedger[\s\S]*onRememberAgentGenerationJobLedger\?: \(ledger: AgentVideoGenerationJobLedger\)[\s\S]*<MinimalAgentPanel[\s\S]*restoredAgentGenerationJobLedger=\{restoredAgentGenerationJobLedger\}[\s\S]*onRememberAgentGenerationJobLedger=\{onRememberAgentGenerationJobLedger\}/.test(directorModeSource), "DirectorMode must transparently forward generation ledger state");
assert(/agentGenerationLedgerMatchesProject[\s\S]*restoredAgentGenerationJobLedger[\s\S]*runConfiguredAgentVideoExecution\(\{[\s\S]*onLedgerSnapshot:[\s\S]*agentVideoExecutionLedgerRef\.current = ledgerSnapshot[\s\S]*setAgentVideoDryRunLedger\(ledgerSnapshot\)[\s\S]*await onRememberAgentGenerationJobLedger\?\.\(ledgerSnapshot\)[\s\S]*onTimelineEntries:[\s\S]*rememberAgentTimelineEntries\(entries\)/.test(minimalAgentPanelSource), "MinimalAgentPanel must consume only matching restored ledgers and persist every shared-adapter job transition before timeline results");
assert(/bindAgentTimelineEntriesToProject[\s\S]*projectFactHash[\s\S]*rememberAgentTimelineEntries[\s\S]*boundEntries/.test(minimalAgentPanelSource), "new timeline confirmations must carry project identity for recovery validation");

console.log("project-agent-generation-job-ledger-test passed");
