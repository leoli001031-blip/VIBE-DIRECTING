import fs from "node:fs";

import {
  buildProviderSubmitPermissionReceipt,
  providerSubmitPermissionReceiptHardLocks,
} from "../src/core/providerSubmitPermissionReceipt.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function baseInput(overrides = {}) {
  return {
    generatedAt: "2026-05-10T00:00:00.000Z",
    receiptId: "image2_one_shot_prepare_project_S01_run",
    handoffId: "handoff_image2_one_shot_prepare_project_S01_run",
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    selectedShotIds: ["S01"],
    expectedOutputs: [
      {
        shotId: "S01",
        expectedOutputPath: "real-test-sandbox/run/real-trigger-one-shot/S01/image2-start.png",
        providerObservationPath: "real-test-sandbox/run/real-trigger-one-shot/S01/provider_observations/image2-start-provider-observation.json",
        semanticQaPath: "real-test-sandbox/run/real-trigger-one-shot/S01/semantic_qa/image2-start-semantic-qa.json",
      },
    ],
    credentialRef: "secret-store://providers/openai-image2/default",
    maxProviderCallsPerReceipt: 1,
    actionTimeConfirmation: { required: true, userConfirmedAtActionTime: false },
    promptPath: "real-test-sandbox/run/prompt_requests/S01_start_frame_prompt.md",
    promptSha256: "sha256:abc123",
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildProviderSubmitPermissionReceipt(baseInput(overrides));
}

const ready = build();
assert(ready.schemaVersion === "0.1.0", "schema version drifted");
assert(ready.status === "pending_action_time_confirmation", `ready status drifted: ${ready.status}`);
assert(ready.blockers.length === 0, `ready should not have blockers: ${ready.blockers.join(", ")}`);
assert(ready.selectedShotIds.length === 1 && ready.selectedShotIds[0] === "S01", "selected shots should persist");
assert(ready.expectedOutputs.length === 1 && ready.expectedOutputs[0].shotId === "S01", "expected output should persist");
assert(ready.credential.credentialRef === "secret-store://providers/openai-image2/default", "credentialRef should persist");
assert(ready.credential.authorizedReferenceOnly === true, "credential must be reference only");
assert(ready.credential.secretMaterialPresent === false, "secret material must be absent");
assert(ready.credential.credentialMaterialStored === false, "credential material must not be stored");
assert(ready.credential.credentialMaterialRead === false, "credential material must not be read");
assert(ready.submitIntent.providerSubmitAllowed === 0, "submit intent must not allow provider submit");
assert(ready.submitIntent.maxProviderCallsPerReceipt === 1, "submit intent must pin one call");
assert(ready.submitIntent.providerSubmitRequestState === "pending_action_time_confirmation", "submit state must remain pending");
assert(ready.providerCalled === false, "receipt must not call provider");
assert(ready.runtimeProviderSubmitAttempted === false, "receipt must not attempt runtime submit");
assert(ready.runtimeExternalNetworkCallMade === false, "receipt must not make network calls");
assert(ready.projectVibeWritten === false, "receipt must not write project.vibe");

for (const [key, value] of Object.entries(providerSubmitPermissionReceiptHardLocks)) {
  assert(ready.hardLocks[key] === value, `${key} hard lock drifted`);
}
for (const key of [
  "defaultLocked",
  "noCredentialRead",
  "noCredentialWrite",
  "noWorkerSpawn",
  "noFileMutation",
]) {
  assert(ready.hardLocks[key] === true, `${key} hard lock must be true`);
}
for (const key of [
  "actualExecutionAllowed",
  "canSubmitProvider",
  "automaticSubmitAllowed",
  "liveSubmitAllowed",
  "externalNetworkIoAllowed",
  "credentialMaterialAccessAllowed",
  "projectVibeMutationAllowed",
]) {
  assert(ready.hardLocks[key] === false, `${key} hard lock must be false`);
}
assert(ready.hardLocks.providerSubmitAllowed === 0, "providerSubmitAllowed lock must be zero");
assert(ready.hardLocks.maxConcurrency === 1, "maxConcurrency lock must be one");
assert(ready.hardLocks.maxAutoRetries === 0, "maxAutoRetries lock must be zero");

function assertBlocked(overrides, expectedPattern, label) {
  const state = build(overrides);
  assert(state.status === "blocked", `${label} should block`);
  assert(state.blockers.some((blocker) => expectedPattern.test(blocker)), `${label} blocker missing: ${state.blockers.join(", ")}`);
  assert(state.submitIntent.providerSubmitAllowed === 0, `${label} must still pin providerSubmitAllowed=0`);
  assert(state.credential.secretMaterialPresent === false, `${label} must not store credential material`);
}

assertBlocked({ credentialRef: "sk-test123456789" }, /credential|raw/i, "raw sk credentialRef");
assertBlocked({ apiKey: "plain-key" }, /credential-like|Raw credential/i, "credential-ish apiKey key");
assertBlocked({ credentialRef: "" }, /credentialRef/i, "empty credentialRef");
assertBlocked({ selectedShotIds: [], expectedOutputs: [] }, /selectedShotIds/i, "empty shots");
assertBlocked({
  selectedShotIds: ["S01", "S02", "S03", "S04"],
  expectedOutputs: ["S01", "S02", "S03", "S04"].map((shotId) => ({
    shotId,
    expectedOutputPath: `out/${shotId}.png`,
    providerObservationPath: `obs/${shotId}.json`,
    semanticQaPath: `qa/${shotId}.json`,
  })),
}, /selectedShotIds/i, "too many shots");
assertBlocked({ maxProviderCallsPerReceipt: 2 }, /maxProviderCallsPerReceipt/i, "max calls");
assertBlocked({
  selectedShotIds: ["S01"],
  expectedOutputs: [
    {
      shotId: "S02",
      expectedOutputPath: "out/S02.png",
      providerObservationPath: "obs/S02.json",
      semanticQaPath: "qa/S02.json",
    },
  ],
}, /expectedOutputs/i, "expected output mismatch");

const source = fs.readFileSync("src/core/providerSubmitPermissionReceipt.ts", "utf8");
for (const forbiddenCode of [
  "node:fs",
  "node:http",
  "fetch(",
  "XMLHttpRequest",
  "process.env",
  "spawn(",
  "exec(",
  "writeFile",
  "readFile",
]) {
  assert(!source.includes(forbiddenCode), `providerSubmitPermissionReceipt source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/provider_submit_permission_receipt.schema.json");
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "provider submit permission receipt schema $schema missing");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("provider_submit_permission_receipt.schema.json"), "schema registry file entry missing");
assert(registrySource.includes("ProviderSubmitPermissionReceiptState"), "schema registry type entry missing");

console.log("Provider submit permission receipt core tests passed.");
