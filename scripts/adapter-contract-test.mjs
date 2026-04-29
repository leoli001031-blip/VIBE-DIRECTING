import fs from "node:fs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const knownProviderSlots = new Set([
  "image.generate",
  "image.edit",
  "image.reference_asset",
  "video.i2v",
  "video.t2v.experimental",
  "video.extend",
  "video.edit",
  "audio.tts",
  "audio.music",
  "local.postprocess",
  "local.workflow",
]);

const state = readJson("public/runtime-state.json");
const contracts = state.adapterContracts;
assert(contracts, "runtime-state missing adapterContracts");
assert(contracts.schemaVersion === "0.1.0", "adapterContracts schemaVersion drifted");
assert(Array.isArray(contracts.agentAdapters) && contracts.agentAdapters.length >= 1, "agent adapter contracts missing");
assert(Array.isArray(contracts.workerAdapters) && contracts.workerAdapters.length >= 1, "worker adapter contracts missing");
assert(Array.isArray(contracts.providerAdapters) && contracts.providerAdapters.length >= 6, "provider adapter contracts missing");
assert(Array.isArray(contracts.summary.contractViolations), "summary contractViolations missing");
assert(contracts.summary.contractViolations.length === 0, "default adapter contracts should not have violations");
assert(contracts.summary.liveSubmitAllowed === false, "summary liveSubmitAllowed must be false");
assert(contracts.summary.credentialStorage === false, "summary credentialStorage must be false");
assert(contracts.summary.activeImageProvider === "image2-provider", "Image2 must be the active image provider summary");

const byId = new Map([
  ...contracts.agentAdapters.map((adapter) => [adapter.id, adapter]),
  ...contracts.workerAdapters.map((adapter) => [adapter.id, adapter]),
  ...contracts.providerAdapters.map((adapter) => [adapter.id, adapter]),
]);

for (const id of [
  "codex-cli-agent",
  "subagent-worker",
  "image2-provider",
  "image2-edit-provider",
  "image2-reference-asset-provider",
  "seedance2-provider",
  "jimeng-video",
  "local-postprocess-planned",
]) {
  assert(byId.has(id), `${id} contract missing`);
}

for (const adapter of [...contracts.agentAdapters, ...contracts.workerAdapters, ...contracts.providerAdapters]) {
  assert(adapter.dryRunOnly === true, `${adapter.id} dryRunOnly must be true`);
  assert(adapter.readOnly === true, `${adapter.id} readOnly must be true`);
  assert(adapter.liveSubmitAllowed === false, `${adapter.id} liveSubmitAllowed must be false`);
  assert(adapter.credentialStorage === false, `${adapter.id} credentialStorage must be false`);
  assert(!JSON.stringify(adapter).toLowerCase().includes("api_key"), `${adapter.id} must not mention api_key`);
  assert(!JSON.stringify(adapter).toLowerCase().includes("secret"), `${adapter.id} must not mention secret material`);
}

const agent = byId.get("codex-cli-agent");
assert(agent.kind === "agent", "codex-cli-agent must be an agent contract");
assert(agent.uiBinding === false, "agent adapter cannot bind UI");
assert(agent.capabilities.contextPacketRequired === true, "agent context packet must be required");
assert(agent.capabilities.canSpawnSubagents === true, "agent must declare subagent capability");
assert(agent.capabilities.supportsThreadHandoff === true, "agent must declare thread handoff capability");

const worker = byId.get("subagent-worker");
assert(worker.kind === "worker", "subagent-worker must be a worker contract");
assert(worker.requiredEnvelopeSchema === "subagent_task_envelope.schema.json", "worker must require subagent_task_envelope");
assert(worker.mustReceiveContextPacket === true, "worker must receive context packet");
assert(worker.canBypassEnvelope === false, "worker cannot bypass envelope");
assert(worker.allowedPurposes.includes("video_generation"), "worker must allow video_generation purpose");
assert(worker.forbiddenRoutes.includes("envelope_bypass"), "worker must explicitly forbid envelope bypass");

for (const adapter of contracts.providerAdapters) {
  assert(adapter.kind === "provider", `${adapter.id} must be a provider contract`);
  assert(knownProviderSlots.has(adapter.slot), `${adapter.id} uses unknown provider slot ${adapter.slot}`);
  assert(adapter.providerSubmissionForbidden === true, `${adapter.id} provider submission must be forbidden`);
  assert(adapter.arbitraryProviderCommandAllowed === false, `${adapter.id} arbitrary provider command must be false`);
  assert(adapter.forbiddenRoutes.includes("live_submit"), `${adapter.id} must forbid live submit`);
  assert(adapter.forbiddenRoutes.includes("arbitrary_provider_command"), `${adapter.id} must forbid arbitrary provider command`);
  assert(["not_required", "not_configured", "not_read"].includes(adapter.credentialStatus), `${adapter.id} credential status must not imply stored credentials`);
}

const image2 = byId.get("image2-provider");
assert(image2.state === "active", "Image2 provider contract must be active");
assert(image2.dryRunOnly === true, "Image2 provider contract must be dry-run only");
assert(image2.providerIds.includes("openai-image2-codex-cli"), "Image2 must cover Codex CLI Image2 provider id");
assert(image2.slot === "image.generate", "Image2 generate contract must stay on image.generate");
assert(image2.requiredModes.length === 1 && image2.requiredModes[0] === "text2image", "Image2 generate must require text2image");
assert(image2.capabilityRefs.length >= 1, "Image2 generate contract must mirror provider capabilities");
assert(image2.capabilitySummary.outputKinds.includes("image"), "Image2 contract must summarize image output capability");

const image2Edit = byId.get("image2-edit-provider");
assert(image2Edit.state === "active", "Image2 edit provider contract must be active");
assert(image2Edit.providerIds.includes("openai-image2-api"), "Image2 edit must cover API Image2 provider id");
assert(image2Edit.slot === "image.edit", "Image2 edit contract must stay on image.edit");
assert(image2Edit.requiredModes.length === 1 && image2Edit.requiredModes[0] === "image2image", "Image2 edit must require image2image");
assert(image2Edit.capabilityRefs.length >= 1, "Image2 edit contract must mirror provider capabilities");

const image2Reference = byId.get("image2-reference-asset-provider");
assert(image2Reference.state === "active", "Image2 reference asset provider contract must be active");
assert(image2Reference.providerIds.includes("openai-image2-api"), "Image2 reference asset must cover API Image2 provider id");
assert(image2Reference.slot === "image.reference_asset", "Image2 reference asset contract must stay on image.reference_asset");
assert(image2Reference.requiredModes.includes("text2image"), "Image2 reference asset must include explicit text2image mode");
assert(image2Reference.requiredModes.includes("image2image"), "Image2 reference asset must include explicit image2image mode");
assert(image2Reference.capabilityRefs.length >= 2, "Image2 reference asset contract must mirror provider capabilities");

for (const adapter of [image2, image2Edit, image2Reference]) {
  for (const capabilityRef of adapter.capabilityRefs) {
    const [providerId, slot, requiredMode] = capabilityRef.split(":");
    assert(adapter.providerIds.includes(providerId), `${adapter.id} capability ${capabilityRef} provider mismatch`);
    assert(slot === adapter.slot, `${adapter.id} capability ${capabilityRef} slot mismatch`);
    assert(adapter.requiredModes.includes(requiredMode), `${adapter.id} capability ${capabilityRef} mode mismatch`);
  }
}

for (const id of ["seedance2-provider", "jimeng-video"]) {
  const adapter = byId.get(id);
  assert(adapter.state === "parked", `${id} must remain parked`);
  assert(adapter.slot === "video.i2v", `${id} must stay on video.i2v`);
  assert(adapter.requiredModes.length === 1 && adapter.requiredModes[0] === "frames2video", `${id} must require frames2video`);
  assert(adapter.forbiddenRoutes.includes("fast_model"), `${id} must forbid fast model`);
  assert(adapter.forbiddenRoutes.includes("vip_channel"), `${id} must forbid VIP channel`);
  assert(adapter.forbiddenRoutes.includes("text_to_video_main_path"), `${id} must forbid text-to-video main path`);
  assert(adapter.forbiddenRoutes.includes("bgm_in_video_prompt"), `${id} must forbid BGM in video prompt`);
  assert(contracts.summary.parkedVideoProviders.includes(id), `${id} missing from parked video summary`);
}

const localPost = byId.get("local-postprocess-planned");
assert(localPost.state === "planned", "local postprocess must remain planned");
assert(localPost.slot === "local.postprocess", "local postprocess must use local.postprocess slot");
assert(localPost.providerSubmissionForbidden === true, "local postprocess must not submit providers");

const schema = readJson("schemas/adapter_contract.schema.json");
assert(schema.title === "AdapterContractState", "adapter contract schema title drifted");
assert(schema.$defs.providerAdapterContract.properties.liveSubmitAllowed.const === false, "schema must pin provider live submit false");
assert(schema.$defs.providerAdapterContract.properties.credentialStorage.const === false, "schema must pin provider credential storage false");
assert(
  schema.$defs.providerAdapterContract.properties.slot.$ref === "common.schema.json#/$defs/providerSlot",
  "schema must reject unknown provider slots through common providerSlot",
);
assert(schema.$defs.workerAdapterContract.properties.requiredEnvelopeSchema.const === "subagent_task_envelope.schema.json", "schema must pin worker envelope");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("adapterContracts"), "project runtime schema must require adapterContracts");
assert(projectSchema.properties.adapterContracts.$ref === "adapter_contract.schema.json", "project runtime schema must reference adapter contract schema");

const coreSource = fs.readFileSync("src/core/adapterContracts.ts", "utf8");
assert(coreSource.includes("unknown_provider_slot"), "core validator must reject unknown provider slots");
assert(coreSource.includes("capability_mismatch"), "core validator must reject capability mismatches");
assert(coreSource.includes("arbitrary_provider_command_allowed"), "core validator must reject arbitrary provider commands");
assert(coreSource.includes("worker_envelope_bypass"), "core validator must reject worker envelope bypass");

console.log(
  `Adapter contract tests passed: ${contracts.agentAdapters.length} agent, ${contracts.workerAdapters.length} worker, ${contracts.providerAdapters.length} provider contracts.`,
);
