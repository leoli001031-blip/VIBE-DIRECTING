import fs from "node:fs";
import { buildSmallProjectDemoRuntime, loadCore, smallProjectFixture } from "./demo-runtime-fixture.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const generatedAt = smallProjectFixture.generatedAt;
const { runtimeState } = await buildSmallProjectDemoRuntime();
const { providerHandoffStatus } = await loadCore();
const { buildProviderHandoffStatus, providerHandoffStatusSchemaVersion } = providerHandoffStatus;

const defaultStatus = runtimeState.providerHandoffStatus;
assert(defaultStatus.schemaVersion === providerHandoffStatusSchemaVersion, "runtime state should carry handoff schema version");
assert(defaultStatus.phase === "round_6_provider_handoff_status", "handoff phase drifted");
assert(defaultStatus.status === "waiting_confirmation", `default one-shot review should wait confirmation, got ${defaultStatus.status}`);
assert(defaultStatus.label === "等待确认", "default label should be user-facing waiting confirmation");
assert(defaultStatus.stages.length === 4, "handoff status should expose four compact stages");
assert(defaultStatus.machineFacts.hardPolicy.automaticProviderSubmitAllowed === false, "automatic submit must stay forbidden");
assert(defaultStatus.machineFacts.hardPolicy.credentialMaterialPresent === false, "credential material must be absent");
assert(defaultStatus.machineFacts.hardPolicy.providerSelfReportCanComplete === false, "self-report must not complete");
assert(defaultStatus.machineFacts.hardPolicy.completionRequiresWatcherManifestQa === true, "completion must require watcher/manifest/QA");
assert(defaultStatus.machineFacts.hardPolicy.maxAutoRetries === 0, "max auto retries must be zero");
assert(defaultStatus.machineFacts.hardPolicy.singleActionOnly === true, "single action only must be explicit");

const oneShotTest = runtimeState.realProviderOneShotTest;
const basePlan = {
  status: "mock_submit_ready",
  transportPolicy: {
    automaticProviderSubmitAllowed: false,
    credentialMaterialAccessAllowed: false,
    providerSelfReportCanComplete: false,
  },
  attempt: {
    maxProviderSubmits: 1,
    maxAutoRetries: 0,
  },
  blockers: [],
  warnings: [],
};

const mockPlanStatus = buildProviderHandoffStatus({
  generatedAt,
  realProviderOneShotTest: oneShotTest,
  realProviderTransport: {
    plan: basePlan,
  },
});
assert(mockPlanStatus.status === "ready_to_call", `mock transport plan should be ready to call, got ${mockPlanStatus.status}`);
assert(mockPlanStatus.label === "准备调用", "mock transport plan should use ready-to-call label");
assert(mockPlanStatus.detail.includes("不会自动提交"), "ready detail should preserve no-auto-submit copy");

const baseReceipt = {
  status: "mock_submitted",
  providerSelfReportedComplete: false,
  attempt: {
    maxAutoRetries: 0,
  },
  blockers: [],
  warnings: [],
};
const receiptWaiting = buildProviderHandoffStatus({
  generatedAt,
  realProviderOneShotTest: oneShotTest,
  realProviderTransport: {
    plan: basePlan,
    receipt: baseReceipt,
  },
});
assert(receiptWaiting.status === "waiting_file", `receipt without output should wait file, got ${receiptWaiting.status}`);
assert(receiptWaiting.label === "等待文件", "receipt should map to waiting-file label");
assert(receiptWaiting.machineFacts.watcherExpectedOutputDetected === false, "receipt-only status should not invent watcher evidence");

const returnedAfterQa = buildProviderHandoffStatus({
  generatedAt,
  realProviderOneShotTest: oneShotTest,
  realProviderTransport: {
    plan: basePlan,
    receipt: baseReceipt,
  },
  imagePipeline: {
    watcherEvents: [
      {
        id: "watcher_S01",
        eventType: "expected_output_detected",
        taskId: "image_task_plan_S01",
        artifactPath: smallProjectFixture.outputPath,
        expectedOutputPath: smallProjectFixture.outputPath,
        status: "detected",
        severity: "info",
        createdAt: generatedAt,
        notes: [],
      },
    ],
    generationHealthReports: [
      {
        reportId: "health_S01",
        taskPlanId: "image_task_plan_S01",
        jobId: "S01_start_image2",
        shotId: "S01",
        expectedOutputPath: smallProjectFixture.outputPath,
        outputExists: true,
        manifestStatus: "complete",
        qaStatus: "pass",
        stalePrompt: false,
        assetReadinessStatus: "ready",
        healthStatus: "formal_ready",
        blockers: [],
        warnings: [],
        nextAction: "review",
      },
    ],
    qaPromotionReports: [],
  },
});
assert(returnedAfterQa.status === "needs_review", `watcher/manifest/QA should need review, got ${returnedAfterQa.status}`);
assert(returnedAfterQa.label === "需要复核", "QA-returned status should map to review label");
assert(returnedAfterQa.machineFacts.watcherExpectedOutputDetected === true, "watcher fact missing");
assert(returnedAfterQa.machineFacts.manifestMatched === true, "manifest fact missing");
assert(returnedAfterQa.machineFacts.qaPassed === true, "QA fact missing");

const selfReportOnly = buildProviderHandoffStatus({
  generatedAt,
  realProviderOneShotTest: oneShotTest,
  realProviderTransport: {
    plan: basePlan,
    receipt: {
      ...baseReceipt,
      providerSelfReportedComplete: true,
    },
  },
});
assert(selfReportOnly.status === "waiting_file", "provider self-report alone must not complete handoff");
assert(selfReportOnly.machineFacts.providerSelfReportedComplete === true, "self-report fact should be retained");
assert(selfReportOnly.machineFacts.watcherExpectedOutputDetected === false, "self-report must not imply watcher evidence");
assert(selfReportOnly.warnings.some((warning) => /self-report/.test(warning)), "self-report warning should be visible to diagnostics");

const autoSubmitViolation = buildProviderHandoffStatus({
  generatedAt,
  realProviderOneShotTest: {
    ...oneShotTest,
    summary: {
      ...oneShotTest.summary,
      providerSubmitAllowed: 1,
    },
  },
  realProviderTransport: {
    plan: {
      ...basePlan,
      transportPolicy: {
        ...basePlan.transportPolicy,
        automaticProviderSubmitAllowed: true,
      },
    },
  },
});
assert(autoSubmitViolation.status === "blocked", "automatic submit hard-lock violation must block");
assert(autoSubmitViolation.label === "受阻", "hard-lock violation should use blocked label");
assert(
  autoSubmitViolation.blockers.some((blocker) => /automatic provider submit|providerSubmitAllowed=0/i.test(blocker)),
  "automatic submit blocker missing",
);

const source = fs.readFileSync("src/core/providerHandoffStatus.ts", "utf8");
for (const forbiddenCode of [
  "fetch(",
  "process.env",
  "node:fs",
  "child_process",
  "spawn(",
  "exec(",
  "localStorage",
]) {
  assert(!source.includes(forbiddenCode), `providerHandoffStatus source must not contain ${forbiddenCode}`);
}

console.log("provider-handoff-status tests passed");
