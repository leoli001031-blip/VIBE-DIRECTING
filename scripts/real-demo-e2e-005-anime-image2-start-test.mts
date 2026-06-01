import fs from "node:fs";
import { spawnSync } from "node:child_process";

const reportPath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json";
const previewPlanPath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/preview_plan.json";
const qaReportPath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/qa_report.json";
const s07QaPath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/semantic_qa/S07_start_semantic_qa.json";
const s08QaPath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/semantic_qa/S08_start_semantic_qa.json";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

assert(fs.existsSync(s07QaPath), "S07 semantic QA sidecar is required for this software-layer regression");
assert(fs.existsSync(s08QaPath), "S08 semantic QA sidecar is required for this software-layer regression");

const s07Qa = readJson(s07QaPath);
const s08Qa = readJson(s08QaPath);
assert(s07Qa.gateResults?.identity?.status === "needs_review", "S07 fixture must retain identity needs_review");
assert(s08Qa.gateResults?.identity?.status === "needs_review", "S08 fixture must retain identity needs_review");
assert(
  ["scene", "style", "story", "neighbor", "output"].every((gate) => s07Qa.gateResults?.[gate]?.status === "pass"),
  "S07 fixture must have only identity under review",
);
assert(
  ["scene", "style", "story", "neighbor", "output"].every((gate) => s08Qa.gateResults?.[gate]?.status === "pass"),
  "S08 fixture must have only identity under review",
);

const result = spawnSync("node", ["scripts/real-demo-e2e-005-anime-image2-start-verify.mjs"], {
  encoding: "utf8",
  shell: false,
});
if (result.status !== 0) {
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(result.status || 1);
}

const report = readJson(reportPath);
const previewPlan = readJson(previewPlanPath);
const qaReport = readJson(qaReportPath);

assert(report.status === "real_image2_start_preview_ready_with_review", "005 report should be preview-ready with review overlay");
assert(report.productionStatus === "needs_review", "005 production status should remain needs_review");
assert(report.blockers.length === 0, `005 report should not have blockers: ${report.blockers.join("; ")}`);
assert(previewPlan.previewStatus === "real_image2_start_preview_ready_with_review", "preview plan should allow review overlay");
assert(previewPlan.productionStatus === "needs_review", "preview plan should retain production needs_review");
assert(qaReport.previewStatus === "real_image2_start_preview_ready_with_review", "QA report should expose preview-ready status");
assert(qaReport.productionStatus === "needs_review", "QA report should expose production needs_review");

for (const shotId of ["S07", "S08"]) {
  const observation = report.observations.find((item) => item.shotId === shotId);
  const qaCheck = qaReport.checks.find((item) => item.shotId === shotId);
  const clip = previewPlan.clips.find((item) => item.shotId === shotId);
  assert(observation?.previewQaStatus === "needs_review_overlay", `${shotId} should use preview review overlay`);
  assert(observation?.productionQaStatus === "needs_review", `${shotId} should keep production needs_review`);
  assert(observation?.blockers.length === 0, `${shotId} should not be blocked by partial identity review`);
  assert(qaCheck?.previewQaStatus === "needs_review_overlay", `${shotId} QA check should use preview review overlay`);
  assert(qaCheck?.productionQaStatus === "needs_review", `${shotId} QA check should keep production needs_review`);
  assert(clip?.status === "returned_with_review_overlay", `${shotId} preview clip should be returned with review overlay`);
}

console.log("Real Demo E2E 005 partial-identity preview readiness test passed. No provider was called.");
