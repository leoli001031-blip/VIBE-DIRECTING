import { readFileSync } from "node:fs";

import {
  hashProjectVibeFacts,
  parseProjectVibeText,
  type ProjectVibeDocument,
} from "../src/project/index.ts";
import { runDirectorPrototypeClosedLoop } from "../src/agent/index.ts";
import { createDirectorAgentPlan } from "../src/agent/directorAgentPlan.ts";
import { directorPrototypeToolOrder } from "../src/agent/directorAgentProviderTools.ts";
import { createDirectorPrototypePreviewItem } from "../src/agent/previewAdapter.ts";
import { createDirectorPrototypeRunReceipt } from "../src/agent/projectWriter.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isProjectRootRelative(path: string): boolean {
  return !path.startsWith("/") && !path.startsWith("~/") && !/^[A-Za-z]:[\\/]/.test(path) && !path.includes("..");
}

const fixturePath = "test-fixtures/projects/agent-loop-minimal/project.vibe";
const opened = parseProjectVibeText(readFileSync(fixturePath, "utf8"));

assert(opened.ok, `fixture should parse: ${opened.errors.join("; ")}`);
assert(opened.project, "fixture project missing");

const project = opened.project as ProjectVibeDocument;
const beforeHash = hashProjectVibeFacts(project);
const beforeRunCount = project.runs.length;
const plan = createDirectorAgentPlan({
  project,
  userIntent: "Create a preview still for the radio signal moment, preserving locked visual facts.",
  selectedShotId: "shot_002",
  now: "2026-05-15T03:00:00.000Z",
  runId: "run_prototype_closed_loop_001",
  sessionId: "prototype-closed-loop-test-session",
});

assert(plan.selectedShot.title === "Radio Signal Answered", "plan module should resolve the selected Project.vibe shot");
assert(plan.outputPath === "runs/prototype-agent/run_prototype_closed_loop_001/shot_002/preview.png", "plan module should own preview path planning");
assert(plan.prompt.includes("Locked visual facts: Mira:"), "plan module should include locked visual facts in the prompt");
assert(
  directorPrototypeToolOrder.join(",") ===
    "provider_prepare_request,provider_mock_submit,provider_ingest_mock_return,provider_promote_reviewed_return",
  "provider registry module should expose the closed-loop tool order",
);

const structurePreview = createDirectorPrototypePreviewItem(plan, {
  requestId: plan.requestId,
  inputHash: "input_hash_structure_test",
  outputPath: plan.outputPath,
});
assert(structurePreview.providerRequestId === plan.requestId, "preview adapter should bind provider request ids");
assert(structurePreview.mediaPath === plan.outputPath, "preview adapter should use the planned project-relative media path");

const structureRunReceipt = createDirectorPrototypeRunReceipt(project, plan, {
  requestId: plan.requestId,
});
assert(structureRunReceipt.id === plan.runId, "project writer should create a run receipt for the plan");
assert(structureRunReceipt.evidenceRefs.includes(`providerBoundary#${plan.requestId}`), "project writer should record provider evidence refs");
assert(structureRunReceipt.runtimeFixtureUsed === false, "project writer must stay off runtime fixtures");

const result = await runDirectorPrototypeClosedLoop({
  project,
  userIntent: "Create a preview still for the radio signal moment, preserving locked visual facts.",
  selectedShotId: "shot_002",
  now: "2026-05-15T03:00:00.000Z",
  runId: "run_prototype_closed_loop_001",
  sessionId: "prototype-closed-loop-test-session",
});

const afterHash = hashProjectVibeFacts(result.nextProject);

assert(result.transactionReceipt.status === "applied", "Project.vibe transaction should apply");
assert(result.transactionReceipt.afterFactHash === afterHash, "transaction receipt should report the new hash");
assert(afterHash !== beforeHash, "project.vibe hash should change after appending the run receipt");
assert(project.runs.length === beforeRunCount, "source project object should not be mutated");
assert(result.nextProject.runs.length === beforeRunCount + 1, "runs should increase by one");
assert(result.nextProject.runs.at(-1)?.id === "run_prototype_closed_loop_001", "new run receipt id mismatch");
assert(result.runReceipt.runtimeFixtureUsed === false, "run receipt must not depend on runtime fixtures");
assert(result.runReceipt.projectFactsMutated === true, "run receipt should mark Project.vibe mutation");
assert(result.providerRequestSummary.status === "promoted", "provider status should be promoted");
assert(result.providerRequestSummary.liveSubmit === false, "provider summary must keep liveSubmit false");
assert(result.providerRequestSummary.adapterMode === "mock_only", "provider summary must stay mock-only");
assert(result.providerRequestSummary.fastTest === true, "provider summary should mark fastTest true");
assert(result.previewItem.mediaPath === result.providerRequestSummary.outputPath, "preview media path should match provider output path");
assert(isProjectRootRelative(result.previewItem.mediaPath), "preview output path must be project-root-relative");
assert(result.previewItem.mediaPath === "runs/prototype-agent/run_prototype_closed_loop_001/shot_002/preview.png", "preview path drifted");
assert(result.previewItem.shotId === "shot_002", "preview item should target selected shot");
assert(result.toolTrace.length === 4, "tool trace should include all four provider boundary calls");
assert(
  result.toolTrace.map((trace) => trace.toolName).join(",") ===
    "provider_prepare_request,provider_mock_submit,provider_ingest_mock_return,provider_promote_reviewed_return",
  "tool trace should preserve provider boundary order",
);
assert(result.toolTrace.every((trace) => trace.approved === true && !trace.error), "all tool calls should be approved and successful");
assert(result.agentRun.totalToolCalls === 4, "agent loop should execute four tool calls");
assert(result.agentRun.completed === true, "agent loop should complete");

console.log(
  `prototype agent project closed-loop test passed: before=${beforeHash}, after=${afterHash}, runs=${result.nextProject.runs.length}, provider=${result.providerRequestSummary.status}, preview=${result.previewItem.mediaPath}`,
);
