import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModule(sourcePath, exportPath) {
  const resolved = path.resolve(sourcePath);
  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: resolved,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-provider-pilot-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sandbox() {
  const root = "real-provider-pilot/project_1/batch_A";
  return {
    root,
    allowedPrefixes: [root],
    manifestPath: `${root}/manifest.json`,
    qaReportPath: `${root}/qa/qa-report.json`,
    ledgerPath: `${root}/execution-ledger.json`,
    projectRootRelative: true,
    outsideRootWriteAllowed: false,
  };
}

function providerPlan(overrides = {}) {
  return {
    providerId: "openai-image2-api",
    adapterId: "image2-adapter-v1",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    capabilityId: "openai-image2-api:image.edit:image2image",
    executionState: "active",
    ...overrides,
  };
}

function seedanceProviderPlan() {
  return {
    providerId: "seedance2-provider",
    adapterId: "seedance-adapter-v1",
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    capabilityId: "seedance2-provider:video.i2v:frames2video",
    executionState: "parked",
  };
}

function taskEnvelope(shotId = "S01", outputs = [
  "real-provider-pilot/project_1/batch_A/shots/S01/start.png",
  "real-provider-pilot/project_1/batch_A/shots/S01/end.png",
]) {
  return {
    id: `envelope_${shotId}`,
    purpose: "keyframe",
    providerSlot: "image.edit",
    providerId: "openai-image2-api",
    executionState: "planned",
    requiredMode: "image2image",
    sourceIndexHash: "source_hash",
    dependencies: [],
    contextLevel: "L1",
    expectedOutputs: outputs,
    hardRules: [],
    references: [],
    qaChecklist: ["identity_gate", "scene_gate"],
    preflight: {
      taskId: `envelope_${shotId}`,
      preflightScope: "formal_execution",
      status: "pass",
      blockers: [],
      warnings: [],
      checkedAt: "2026-05-02T00:00:00.000Z",
    },
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    promptPlanId: `prompt_${shotId}`,
    promptPlanHash: `prompt_hash_${shotId}`,
    sourceShotSpecHash: `shot_hash_${shotId}`,
    outputPath: outputs[0],
    blockingReasons: [],
  };
}

function taskPacket(shotId = "S02") {
  const output = `real-provider-pilot/project_1/batch_A/shots/${shotId}/reference.png`;
  return {
    packetId: `packet_asset_${shotId}`,
    taskKind: "asset",
    status: "ready",
    envelopeId: `subagent_${shotId}`,
    envelope: {
      id: `subagent_${shotId}`,
      neighborShots: [],
      taskEnvelope: {
        expectedOutputs: [output],
        keyframePairDerivation: { shotId },
      },
    },
    hardFields: {
      expectedOutputs: [output],
    },
    missingContext: [],
    blockedReasons: [],
    noFreeTextTask: true,
    canSubmitProvider: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

const { buildRealProviderPilotState, realProviderPilotHardLocks } = await loadModule(
  "src/core/realProviderPilot.ts",
  "realProviderPilot.mjs",
);

const generatedAt = "2026-05-02T00:00:00.000Z";
const readyState = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S01"],
  outputSandbox: sandbox(),
  providerPlan: providerPlan(),
  parkedFutureProviderPlans: [seedanceProviderPlan()],
  taskEnvelopes: [taskEnvelope()],
  expectedImageCount: 2,
});

assert(readyState.schemaVersion === "0.1.0", "schema version drifted");
assert(["real_provider_pilot", "phase_43_real_provider_pilot"].includes(readyState.phase), "phase drifted");
assert(readyState.pilotKind === "image2_first_small_batch", "pilot kind drifted");
assert(readyState.status === "review_ready", "complete Image2 pilot facts should be review-ready");
assert(readyState.scopeSummary.reviewReadyOnly === true, "review_ready must remain review-only");
assert(readyState.scopeSummary.image2FirstOnly === true, "pilot must be Image2 First only");
assert(readyState.scopeSummary.seedanceParkedForFuture === true, "Seedance must be marked future/parked");
assert(readyState.providerPlan.status === "image2_first_review_candidate", "Image2 provider should be only a review candidate");
assert(readyState.providerPlan.image2FirstEligible === true, "Image2 provider should be eligible for review");
assert(readyState.parkedFutureProviderPlans[0].status === "parked_future", "Seedance plan must be parked");
assert(readyState.parkedFutureProviderPlans[0].seedanceParked === true, "Seedance parked flag missing");
assert(readyState.selectedShots.length === 1, "selected shot summary missing");
assert(readyState.selectedShots[0].expectedImageRoles.includes("start_frame"), "start frame role missing");
assert(readyState.selectedShots[0].expectedImageRoles.includes("end_frame"), "end frame role missing");
assert(readyState.expectedOutputPlan.outputs.length === 2, "ready fixture should plan two image outputs");
assert(
  readyState.expectedOutputPlan.outputs.some((item) => item.suggestedRelativePath === "shots/S01/start.png"),
  "start naming convention missing",
);
assert(
  readyState.expectedOutputPlan.outputs.some((item) => item.suggestedRelativePath === "shots/S01/end.png"),
  "end naming convention missing",
);
assert(readyState.manifestPlan.manifestPath === sandbox().manifestPath, "manifest plan path missing");
assert(readyState.manifestPlan.writeAllowed === false, "manifest plan must not allow writes");
assert(readyState.watcherLinkPlan.watcherStarted === false, "watcher must not start");
assert(readyState.watcherLinkPlan.watchGlobs.some((item) => item.endsWith("/shots/**/*.png")), "watcher link glob missing");
assert(readyState.qaRequiredGates.some((gate) => gate.gateId === "identity_gate"), "QA identity gate missing");
assert(readyState.qaRequiredGates.some((gate) => gate.reviewStage === "after_future_output"), "post-output QA gate missing");
assert(
  readyState.userConfirmationRequirements.every((item) => item.requiredBeforeAnyFutureSubmit === true && item.satisfied === false),
  "user confirmations must be required and unsatisfied",
);
assert(readyState.costRiskEstimatePlaceholder.currency === "TBD", "cost placeholder must not resolve currency");
assert(readyState.costRiskEstimatePlaceholder.estimatedTotalCost === "TBD", "cost placeholder must not estimate total");
assert(readyState.costRiskEstimatePlaceholder.userMustApproveBeforeAnyFutureSubmit === true, "future submit must require approval");
assert(readyState.checks.every((item) => item.passed), "ready state should pass all checks");

for (const key of [
  "noFileMutation",
  "dryRunOnly",
  "reviewOnly",
  "reviewOnly",
  "noProviderSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noWorkerSpawn",
  "noSubprocess",
  "noShellExecution",
  "noImage2Execution",
  "noSeedanceExecution",
]) {
  assert(readyState.hardLocks[key] === true, `${key} hard lock must be true`);
  assert(realProviderPilotHardLocks[key] === true, `${key} exported hard lock must be true`);
}
for (const key of [
  "actualExecutionAllowed",
  "credentialAccessAllowed",
  "canSpawnWorker",
]) {
  assert(readyState.hardLocks[key] === false, `${key} hard lock must be false`);
  assert(readyState[key] === false, `${key} top-level lock must be false`);
  assert(realProviderPilotHardLocks[key] === false, `${key} exported hard lock must be false`);
}
assert(readyState.providerSubmitAllowed === false, "providerSubmitAllowed top-level lock must be false");
assert(readyState.hardLocks.providerSubmitAllowed === 0, "legacy provider submit count hard lock must be zero");
assert(readyState.hardLocks.providerSubmitAllowedBoolean === false, "boolean provider submit hard lock must be false");
assert(realProviderPilotHardLocks.providerSubmitAllowed === 0, "exported provider submit count hard lock must be zero");
assert(realProviderPilotHardLocks.providerSubmitAllowedBoolean === false, "exported boolean provider submit hard lock must be false");
assert(readyState.forbiddenActions.includes("provider_submit"), "provider submit must be forbidden");
assert(readyState.forbiddenActions.includes("credential_read"), "credential read must be forbidden");
assert(readyState.forbiddenActions.includes("image2_execution"), "Image2 execution must be forbidden");
assert(readyState.forbiddenActions.includes("seedance_execution"), "Seedance execution must be forbidden");

const packetReadyState = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S02"],
  outputSandbox: sandbox(),
  providerPlan: providerPlan({ providerSlot: "image.reference_asset", requiredMode: "text2image" }),
  taskPackets: [taskPacket("S02")],
  expectedImageCount: 1,
});
assert(packetReadyState.status === "review_ready", "task packets should satisfy envelope-or-packet requirement");
assert(packetReadyState.selectedShots[0].taskPacketIds.includes("packet_asset_S02"), "task packet link missing");
assert(packetReadyState.expectedOutputPlan.outputs.some((item) => item.role === "reference_asset"), "reference asset output role missing");

const missingSandbox = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S01"],
  providerPlan: providerPlan(),
  taskEnvelopes: [taskEnvelope()],
  expectedImageCount: 2,
});
assert(missingSandbox.status === "blocked", "missing output sandbox must block");
assert(
  missingSandbox.checks.some((item) => item.checkId === "output_sandbox" && item.passed === false),
  "output sandbox check must fail",
);
assert(missingSandbox.blockers.some((blocker) => /sandbox/i.test(blocker)), "sandbox blocker missing");

const missingShots = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: [],
  outputSandbox: sandbox(),
  providerPlan: providerPlan(),
  taskEnvelopes: [taskEnvelope()],
  expectedImageCount: 2,
});
assert(missingShots.status === "blocked", "missing selected shots must block");
assert(missingShots.checks.some((item) => item.checkId === "selected_shots" && item.passed === false), "selected shots check must fail");

const missingEnvelopeOrPacket = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S01"],
  outputSandbox: sandbox(),
  providerPlan: providerPlan(),
  expectedImageCount: 2,
});
assert(missingEnvelopeOrPacket.status === "blocked", "missing envelope/packet must block");
assert(
  missingEnvelopeOrPacket.checks.some((item) => item.checkId === "task_envelope_or_packet" && item.passed === false),
  "task envelope or packet check must fail",
);

const missingImageCount = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S01"],
  outputSandbox: sandbox(),
  providerPlan: providerPlan(),
  taskEnvelopes: [taskEnvelope()],
});
assert(missingImageCount.status === "blocked", "missing estimated image count must block");
assert(missingImageCount.checks.some((item) => item.checkId === "estimated_image_count" && item.passed === false), "image count check must fail");

const seedanceMain = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S01"],
  outputSandbox: sandbox(),
  providerPlan: seedanceProviderPlan(),
  taskEnvelopes: [taskEnvelope()],
  expectedImageCount: 2,
});
assert(seedanceMain.status === "blocked", "Seedance main provider must not enter Image2 First review");
assert(seedanceMain.providerPlan.status === "parked_future", "Seedance main provider should be parked future");
assert(seedanceMain.providerPlan.image2FirstEligible === false, "Seedance must not be Image2 eligible");
assert(
  seedanceMain.checks.some((item) => item.checkId === "image2_first_provider" && item.passed === false),
  "Seedance should fail Image2 First provider check",
);

const unsafeSandbox = buildRealProviderPilotState({
  generatedAt,
  mode: "pilot_review",
  projectId: "project_1",
  projectTitle: "Pilot Project",
  selectedShotIds: ["S01"],
  outputSandbox: {
    root: "/tmp/real-provider-pilot",
    manifestPath: "/tmp/real-provider-pilot/manifest.json",
    qaReportPath: "/tmp/real-provider-pilot/qa.json",
  },
  providerPlan: providerPlan(),
  taskEnvelopes: [taskEnvelope()],
  expectedImageCount: 2,
});
assert(unsafeSandbox.status === "blocked", "absolute sandbox paths must block");
assert(unsafeSandbox.checks.some((item) => item.checkId === "output_sandbox" && item.passed === false), "unsafe sandbox check must fail");

const source = fs.readFileSync("src/core/realProviderPilot.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec(", "writeFile", "readFile"]) {
  assert(!source.includes(forbiddenCode), `realProviderPilot source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/real_provider_pilot.schema.json");
assert(schema.title === "RealProviderPilotState", "schema title drifted");
assert(
  schema.properties.phase.const === readyState.phase || schema.properties.phase.enum?.includes(readyState.phase),
  "schema phase drifted",
);
assert(schema.properties.pilotKind.const === "image2_first_small_batch", "schema pilot kind drifted");
assert(schema.properties.actualExecutionAllowed.const === false, "schema must pin actualExecutionAllowed=false");
assert(schema.properties.providerSubmitAllowed.const === false, "schema must pin providerSubmitAllowed=false");
assert(schema.properties.credentialAccessAllowed.const === false, "schema must pin credentialAccessAllowed=false");
assert(schema.properties.canSpawnWorker.const === false, "schema must pin canSpawnWorker=false");
assert(schema.properties.noFileMutation.const === true, "schema must pin noFileMutation=true");
assert(schema.properties.dryRunOnly.const === true, "schema must pin dryRunOnly=true");
assert(schema.$defs.hardLocks.properties.actualExecutionAllowed.const === false, "schema hard lock must pin actual execution false");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema hard lock must pin provider submit count zero");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowedBoolean.const === false, "schema hard lock must pin provider submit false");
assert(schema.$defs.hardLocks.properties.credentialAccessAllowed.const === false, "schema hard lock must pin credential access false");
assert(schema.$defs.hardLocks.properties.canSpawnWorker.const === false, "schema hard lock must pin worker spawn false");
assert(schema.$defs.hardLocks.properties.noFileMutation.const === true, "schema hard lock must pin no file mutation");
assert(schema.$defs.hardLocks.properties.dryRunOnly.const === true, "schema hard lock must pin dry run only");
assert(schema.$defs.providerStatus.enum.includes("parked_future"), "schema must represent parked future providers");

console.log(
  `Real provider pilot tests passed: ready=${readyState.status}, packet=${packetReadyState.status}, seedance=${seedanceMain.providerPlan.status}, blocked=${[
    missingSandbox,
    missingShots,
    missingEnvelopeOrPacket,
    missingImageCount,
    unsafeSandbox,
  ].filter((state) => state.status === "blocked").length}.`,
);
