import fs from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

run("node", ["scripts/real-demo-e2e-003-long-chain-prepare.mjs"]);
run("node", ["scripts/real-demo-e2e-003-long-chain-verify.mjs"]);

const report = JSON.parse(fs.readFileSync("real-test-sandbox/real-demo-e2e/003-long-chain-software/reports/long_chain_software_report.json", "utf8"));
const e2e = JSON.parse(fs.readFileSync("real-test-sandbox/real-demo-e2e/003-long-chain-software/reports/real_demo_e2e_report.json", "utf8"));
const runtimeTruth = JSON.parse(fs.readFileSync("real-test-sandbox/real-demo-e2e/003-long-chain-software/reports/runtime_truth_layer.json", "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(report.status === "software_long_chain_ready", "003 long chain report should pass");
assert(report.actualProvidersCalled === false, "003 must not call actual providers");
assert(report.shotCount === 10, "003 must cover 10 shots");
assert(report.sceneCount === 3, "003 must cover 3 scenes");
assert(report.roleCount === 2, "003 must cover 2 roles");
assert(report.watcherEventCount === 50, "003 must write 5 watcher events per shot");
assert(report.runtimeTruthProjectionStatus === "expected_blocked_for_software_layer", "003 runtime truth projection must be expected-blocked");
assert(report.observations.every((item) => item.providerMode === "mock_readiness_evidence"), "003 provider mode must remain mock readiness evidence");
assert(report.observations.every((item) => item.semanticQaMode === "software_layer_semantic_gate_fixture"), "003 semantic QA mode drifted");
assert(runtimeTruth.status === "software_layer_expected_blocked", "003 RuntimeTruthLayer should remain blocked for software fixtures");
assert(runtimeTruth.items.length === 10, "003 RuntimeTruthLayer should project every shot");
assert(runtimeTruth.items.every((item) => item.status === "blocked"), "003 RuntimeTruthLayer items must not preview_ready");
assert(e2e.status === "blocked", "003 aggregate real E2E report should block because no provider was actually observed");
assert(e2e.declaration === "readiness_harness_only", "003 must remain readiness_harness_only");
assert(e2e.chain.providerCallObserved === false, "003 aggregate report must not mark mock evidence as provider observed");
assert(e2e.completionClaim.realProviderGenerationCompleted === false, "003 must not claim real provider generation completion");
assert(e2e.blockers.some((blocker) => blocker.includes("provider call observation")), "003 aggregate report should retain provider observation blocker");

console.log("Real Demo E2E 003 long-chain software test passed. No providers were called.");
