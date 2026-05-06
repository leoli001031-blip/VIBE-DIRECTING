import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const {
  buildRealDemoE2eReport,
  realDemoE2eSchemaVersion,
} = await importTs("src/core/realDemoE2e.ts");

const generatedAt = "2026-05-03T00:00:00.000Z";

function completeInput(overrides = {}) {
  return {
    generatedAt,
    projectId: "real_demo_project_001",
    runId: "real_demo_run_001",
    scenarioId: "case_A_complete_mock_readiness",
    declaration: "readiness_harness_only",
    projectFacts: {
      projectVibePresent: true,
      sourceIndexPresent: true,
      visualMemoryPresent: true,
      shotLayoutPresent: true,
    },
    chain: {
      generatedByUiAction: true,
      validatedEnvelope: true,
      workerProvenance: {
        workerId: "worker_B",
        subagentId: "subagent_image2_001",
        taskRunId: "task_run_001",
        taskPacketId: "task_packet_001",
        envelopeId: "subagent_envelope_001",
        outputPath: "real-test-sandbox/real-demo-e2e/case_A/shots/S01/start.png",
      },
      providerCallObserved: true,
      providerObservationMode: "mock_readiness_evidence",
      outputCameFromScopedSandbox: true,
      watcherEventObserved: true,
      manifestMatched: true,
      qaReportObserved: true,
      previewUpdatedFromOutput: true,
      providerSelfReportCompletesTask: false,
    },
    integrity: {
      manualFileCopyDetected: false,
      fixtureReuseDetected: false,
      simulatedStateDetected: false,
    },
    notes: ["Mock readiness fixture: no external network or Image2 call is performed by this test."],
    ...overrides,
  };
}

const caseA = buildRealDemoE2eReport(completeInput());
assert(caseA.schemaVersion === realDemoE2eSchemaVersion, "schema version drifted");
assert(caseA.phase === "real_demo_e2e_readiness_harness", "phase drifted");
assert(caseA.status === "ready_for_real_chain_pressure_test", `case A should pass readiness: ${caseA.blockers.join("; ")}`);
assert(caseA.chain.generatedByUiAction === true, "case A must record UI action evidence");
assert(caseA.chain.validatedEnvelope === true, "case A must record validated envelope evidence");
assert(caseA.chain.workerSubagentProvenancePresent === true, "case A must record worker/subagent provenance");
assert(caseA.chain.providerCallObserved === true, "case A must record provider observation evidence");
assert(caseA.chain.providerObservationMode === "mock_readiness_evidence", "case A must remain mock readiness evidence");
assert(caseA.chain.providerSelfReportCompletesTask === false, "provider self-report cannot complete case A");
assert(caseA.chain.providerSelfReportIgnoredForCompletion === true, "provider self-report must be ignored");
assert(caseA.completionClaim.readinessHarnessPassed === true, "case A readiness claim missing");
assert(caseA.completionClaim.realProviderGenerationCompleted === false, "mock readiness must not claim real generation completion");
assert(caseA.completionClaim.realGenerationCompletedClaimAllowed === false, "mock readiness must forbid real completion claim");
assert(caseA.warnings.some((warning) => warning.includes("no actual provider observation")), "case A must warn about no actual provider observation");

const caseB = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_B_batch_004_fixture_reuse",
  integrity: {
    manualFileCopyDetected: false,
    fixtureReuseDetected: true,
    simulatedStateDetected: false,
  },
  notes: ["Represents batch_004 software-stress fixture reuse; existing images cannot count as a real chain run."],
}));
assert(caseB.status === "blocked", "fixture reuse must block readiness");
assert(caseB.integrity.noFixtureReuse === false, "case B must expose fixture reuse");
assert(caseB.blockers.includes("Fixture reuse detected; this cannot count as a real software-chain result."), "case B fixture reuse blocker missing");
assert(caseB.completionClaim.readinessHarnessPassed === false, "case B must not pass readiness");

const caseC = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_C_provider_self_report_only",
  chain: {
    ...completeInput().chain,
    watcherEventObserved: false,
    manifestMatched: false,
    qaReportObserved: false,
    previewUpdatedFromOutput: false,
    providerSelfReportCompletesTask: true,
  },
}));
assert(caseC.status === "blocked", "provider self-report only must block");
assert(caseC.chain.providerSelfReportCompletesTask === true, "case C must retain self-report evidence");
assert(caseC.blockers.includes("Provider self-report must never complete a task."), "case C self-report blocker missing");
assert(caseC.blockers.some((blocker) => blocker.includes("watcher event")), "case C watcher blocker missing");
assert(caseC.blockers.some((blocker) => blocker.includes("manifest")), "case C manifest blocker missing");
assert(caseC.blockers.some((blocker) => blocker.includes("QA")), "case C QA blocker missing");

const caseD = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_D_missing_project_facts",
  projectFacts: {
    projectVibePresent: false,
    sourceIndexPresent: false,
    visualMemoryPresent: false,
    shotLayoutPresent: false,
  },
}));
assert(caseD.status === "blocked", "missing project facts must block");
assert(caseD.projectFacts.allRequiredFactsPresent === false, "case D must mark missing facts");
assert(caseD.blockers.includes("project.vibe, source index, visual memory, and shot layout are all required before a real-chain readiness run."), "case D facts blocker missing");

function pressureShotPlans() {
  const statuses = [
    "real_image_planned",
    "real_image_planned",
    "queued",
    "queued",
    "queued",
    "parked",
    "parked",
    "parked",
  ];
  return statuses.map((status, index) => {
    const shotNumber = String(index + 1).padStart(2, "0");
    return {
      shotId: `S${shotNumber}`,
      status,
      taskPacketId: `task_packet_S${shotNumber}`,
      envelopeId: `subagent_envelope_S${shotNumber}`,
      workerProvenanceId: `worker_provenance_S${shotNumber}`,
      expectedOutputPath: `real-test-sandbox/real-demo-e2e/case_E/shots/S${shotNumber}/start.png`,
    };
  });
}

const caseE = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_E_8_shot_pressure_readiness",
  runId: "real_demo_pressure_001",
  pressure: {
    totalShots: 8,
    realImagePlanCount: 2,
    queuedOrParkedCount: 6,
    shotPlans: pressureShotPlans(),
  },
}));
assert(caseE.status === "ready_for_real_chain_pressure_test", `case E should pass pressure readiness: ${caseE.blockers.join("; ")}`);
assert(caseE.pressure.status === "ready", `case E pressure should be ready: ${caseE.pressure.blockers.join("; ")}`);
assert(caseE.pressure.totalShots === 8, "case E must cover 8 shots");
assert(caseE.pressure.realImagePlanCount === 2, "case E must plan only 2 real images");
assert(caseE.pressure.queuedOrParkedCount === 6, "case E must queue/park the remaining shots");
assert(caseE.pressure.allShotPlansHaveProvenance === true, "case E all shot plans need provenance");
assert(caseE.completionClaim.realProviderGenerationCompleted === false, "pressure readiness without actual provider observation must not claim real generation");

const badPressure = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_E_bad_pressure_guard",
  pressure: {
    totalShots: 12,
    realImagePlanCount: 5,
    queuedOrParkedCount: 7,
    shotPlans: pressureShotPlans(),
  },
}));
assert(badPressure.status === "blocked", "out-of-range pressure run must block");
assert(badPressure.pressure.status === "blocked", "bad pressure detail should block");
assert(badPressure.blockers.includes("Pressure readiness constraints failed."), "bad pressure summary blocker missing");

function animePressureShotPlans() {
  const realIds = new Set(["S01", "S03", "S06", "S08", "S11", "S14"]);
  return Array.from({ length: 16 }, (_, index) => {
    const shotId = `S${String(index + 1).padStart(2, "0")}`;
    return {
      shotId,
      status: realIds.has(shotId) ? "real_image_planned" : index < 11 ? "queued" : "parked",
      taskPacketId: `task_packet_${shotId}_anime`,
      envelopeId: `subagent_envelope_${shotId}_anime`,
      workerProvenanceId: `worker_provenance_${shotId}_anime`,
      expectedOutputPath: `real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/${shotId}/start.png`,
    };
  });
}

const caseF = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_F_16_shot_anime_pressure",
  runId: "real_demo_pressure_002_anime",
  pressure: {
    totalShots: 16,
    realImagePlanCount: 6,
    queuedOrParkedCount: 10,
    constraints: {
      minTotalShots: 12,
      maxTotalShots: 20,
      minRealImagePlans: 4,
      maxRealImagePlans: 6,
      pressureRangeLabel: "12-20_shots",
      realImagePlanRangeLabel: "4-6",
    },
    shotPlans: animePressureShotPlans(),
  },
}));
assert(caseF.status === "ready_for_real_chain_pressure_test", `case F should pass larger pressure readiness: ${caseF.blockers.join("; ")}`);
assert(caseF.pressure.status === "ready", `case F pressure should be ready: ${caseF.pressure.blockers.join("; ")}`);
assert(caseF.pressure.totalShots === 16, "case F must cover 16 shots");
assert(caseF.pressure.realImagePlanCount === 6, "case F must plan 6 real images");
assert(caseF.pressure.allowedRealImagePlanRange === "4-6", "case F must expose the larger real image range");
assert(caseF.pressure.pressureRange === "12-20_shots", "case F must expose the larger pressure range");

const caseG = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_G_semantic_qa_p1_needs_review",
  quality: {
    semanticQaStatus: "needs_review",
    semanticQaRequired: true,
    p0FindingCount: 0,
    p1FindingCount: 1,
    p2FindingCount: 2,
    gates: ["identity", "scene", "style", "story", "neighbor", "output"],
  },
}));
assert(caseG.status === "needs_review", "P1 semantic QA must produce needs_review");
assert(caseG.completionClaim.readinessHarnessPassed === false, "P1 semantic QA must not claim clean readiness pass");
assert(caseG.blockers.length === 0, "P1 semantic QA should not be a P0 blocker");
assert(caseG.warnings.some((warning) => warning.includes("P1 findings")), "P1 semantic QA warning missing");

const caseH = buildRealDemoE2eReport(completeInput({
  scenarioId: "case_H_semantic_qa_p0_blocked",
  quality: {
    semanticQaStatus: "blocked",
    semanticQaRequired: true,
    p0FindingCount: 1,
    p1FindingCount: 0,
    p2FindingCount: 0,
    gates: ["identity", "scene", "style", "story", "neighbor", "output"],
  },
}));
assert(caseH.status === "blocked", "P0 semantic QA must block");
assert(caseH.blockers.includes("Semantic QA gates blocked the real output review."), "P0 semantic QA blocker missing");

for (const report of [caseA, caseE]) {
  assert(
    report.userFacingSummary.includes("不等于已完成真实生成"),
    "passing readiness reports must say they are not real generation completion",
  );
}

console.log("Real demo E2E readiness harness tests passed: cases A-H plus pressure guard. No Image2/Seedance/Jimeng calls were made.");
