import { buildDefaultProviderRegistry } from "./providerCapabilities";
import type {
  AdapterContractState,
  AdapterContractViolation,
  AgentAdapterContract,
  ProviderAdapterContract,
  ProviderCapability,
  ProviderRegistry,
  ProviderSlot,
  WorkerAdapterContract,
} from "./types";

export const adapterContractSchemaVersion = "0.1.0";

const providerSlots: ProviderSlot[] = [
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
];

function capabilityRefs(capabilities: ProviderCapability[]): string[] {
  return capabilities.map((capability) => capability.id).sort((left, right) => left.localeCompare(right));
}

function matchingCapabilities(
  registry: ProviderRegistry,
  providerIds: string[],
  slot: ProviderSlot,
  requiredModes: ProviderAdapterContract["requiredModes"],
): ProviderCapability[] {
  return registry.capabilities.filter(
    (capability) =>
      providerIds.includes(capability.providerId) &&
      capability.slot === slot &&
      requiredModes.includes(capability.requiredMode),
  );
}

function capabilitySummary(capabilities: ProviderCapability[]): ProviderAdapterContract["capabilitySummary"] {
  const outputKinds = Array.from(new Set(capabilities.map((capability) => capability.outputKind))).sort();
  const supportsReferenceImage = capabilities.some((capability) => capability.supports.referenceImage)
    ? true
    : capabilities.some((capability) => capability.supports.mask === "planned")
      ? "planned"
      : false;
  const supportsStartEndFrame = capabilities.some((capability) => capability.supports.startEndFrame)
    ? true
    : capabilities.some((capability) => capability.supports.cameraControl === "planned")
      ? "planned"
      : false;
  const supportsTextToVideo = capabilities.some((capability) => capability.slot === "video.t2v.experimental")
    ? "experimental_parked"
    : false;

  return {
    outputKinds,
    supportsReferenceImage,
    supportsStartEndFrame,
    supportsTextToVideo,
  };
}

function providerContract(
  input: Omit<ProviderAdapterContract, "kind" | "dryRunOnly" | "readOnly" | "liveSubmitAllowed" | "credentialStorage" | "providerSubmissionForbidden" | "arbitraryProviderCommandAllowed">,
): ProviderAdapterContract {
  return {
    kind: "provider",
    dryRunOnly: true,
    readOnly: true,
    liveSubmitAllowed: false,
    credentialStorage: false,
    providerSubmissionForbidden: true,
    arbitraryProviderCommandAllowed: false,
    ...input,
  };
}

function buildAgentAdapters(): AgentAdapterContract[] {
  return [
    {
      id: "codex-cli-agent",
      kind: "agent",
      label: "Codex CLI Agent",
      runtimeKind: "codex_cli",
      state: "active",
      dryRunOnly: true,
      readOnly: true,
      liveSubmitAllowed: false,
      credentialStatus: "not_required",
      credentialStorage: false,
      uiBinding: false,
      capabilities: {
        canSpawnSubagents: true,
        canUseImageRuntime: true,
        contextPacketRequired: true,
        supportsThreadHandoff: true,
        supportsStructuredResult: true,
      },
      forbiddenRoutes: ["ui_binding", "live_submit", "credential_read", "credential_storage", "arbitrary_shell"],
      notes: ["Default agent runtime contract; product logic must depend on capabilities, not Codex-specific identity."],
    },
  ];
}

function buildWorkerAdapters(): WorkerAdapterContract[] {
  return [
    {
      id: "subagent-worker",
      kind: "worker",
      label: "Structured Subagent Worker",
      state: "active",
      dryRunOnly: true,
      readOnly: true,
      liveSubmitAllowed: false,
      credentialStatus: "not_required",
      credentialStorage: false,
      requiredEnvelopeSchema: "subagent_task_envelope.schema.json",
      allowedPurposes: [
        "visual_generation",
        "visual_audit",
        "video_generation",
        "video_audit",
        "continuity_audit",
        "regeneration_plan",
        "story_audit",
      ],
      readScopePolicy: "context_packet_only",
      writeScopePolicy: "declared_outputs_only",
      mustReceiveContextPacket: true,
      canBypassEnvelope: false,
      forbiddenRoutes: ["freeform_context", "envelope_bypass", "live_submit", "credential_read", "credential_storage"],
      notes: ["Worker/subagent execution must be mediated by subagent_task_envelope and a context packet."],
    },
  ];
}

function buildProviderAdapters(registry: ProviderRegistry): ProviderAdapterContract[] {
  const image2GenerateProviderIds = ["openai-image2-codex-cli"];
  const image2ApiProviderIds = ["openai-image2-api"];
  const seedanceProviderIds = ["seedance2-provider"];
  const jimengProviderIds = ["jimeng-video"];
  const image2GenerateCapabilities = matchingCapabilities(registry, image2GenerateProviderIds, "image.generate", ["text2image"]);
  const image2EditCapabilities = matchingCapabilities(registry, image2ApiProviderIds, "image.edit", ["image2image"]);
  const image2ReferenceCapabilities = matchingCapabilities(registry, image2ApiProviderIds, "image.reference_asset", ["text2image", "image2image"]);
  const seedanceCapabilities = matchingCapabilities(registry, seedanceProviderIds, "video.i2v", ["frames2video"]);
  const jimengCapabilities = matchingCapabilities(registry, jimengProviderIds, "video.i2v", ["frames2video"]);

  return [
    providerContract({
      id: "image2-provider",
      label: "Image2 Generate Provider Contract",
      providerIds: image2GenerateProviderIds,
      slot: "image.generate",
      requiredModes: ["text2image"],
      state: "active",
      credentialStatus: "not_required",
      capabilityRefs: capabilityRefs(image2GenerateCapabilities),
      capabilitySummary: capabilitySummary(image2GenerateCapabilities),
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Active Image2 text-to-image contract. It mirrors one provider slot/mode and remains dry-run/read-only."],
    }),
    providerContract({
      id: "image2-edit-provider",
      label: "Image2 Edit Provider Contract",
      providerIds: image2ApiProviderIds,
      slot: "image.edit",
      requiredModes: ["image2image"],
      state: "active",
      credentialStatus: "not_required",
      capabilityRefs: capabilityRefs(image2EditCapabilities),
      capabilitySummary: capabilitySummary(image2EditCapabilities),
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Active Image2 image-to-image contract. It cannot fall back to text-to-image."],
    }),
    providerContract({
      id: "image2-reference-asset-provider",
      label: "Image2 Reference Asset Provider Contract",
      providerIds: image2ApiProviderIds,
      slot: "image.reference_asset",
      requiredModes: ["text2image", "image2image"],
      state: "active",
      credentialStatus: "not_required",
      capabilityRefs: capabilityRefs(image2ReferenceCapabilities),
      capabilitySummary: capabilitySummary(image2ReferenceCapabilities),
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Active Image2 reference-asset contract. Text and edit modes stay explicit, never silent fallbacks."],
    }),
    providerContract({
      id: "seedance2-provider",
      label: "Seedance 2 Provider Contract",
      providerIds: seedanceProviderIds,
      slot: "video.i2v",
      requiredModes: ["frames2video"],
      state: "parked",
      credentialStatus: "not_configured",
      capabilityRefs: capabilityRefs(seedanceCapabilities),
      capabilitySummary: capabilitySummary(seedanceCapabilities),
      forbiddenRoutes: [
        "fast_model",
        "vip_channel",
        "text_to_video_main_path",
        "bgm_in_video_prompt",
        "live_submit",
        "credential_read",
        "credential_storage",
        "arbitrary_provider_command",
      ],
      notes: ["Parked video provider contract only; no Seedance submit route is connected."],
    }),
    providerContract({
      id: "jimeng-video",
      label: "Jimeng Video Provider Contract",
      providerIds: jimengProviderIds,
      slot: "video.i2v",
      requiredModes: ["frames2video"],
      state: "parked",
      credentialStatus: "not_configured",
      capabilityRefs: capabilityRefs(jimengCapabilities),
      capabilitySummary: capabilitySummary(jimengCapabilities),
      forbiddenRoutes: [
        "fast_model",
        "vip_channel",
        "text_to_video_main_path",
        "bgm_in_video_prompt",
        "live_submit",
        "credential_read",
        "credential_storage",
        "arbitrary_provider_command",
      ],
      notes: ["Parked future video adapter contract; no Jimeng submit route is connected."],
    }),
    providerContract({
      id: "local-postprocess-planned",
      label: "Local Postprocess Planned Contract",
      providerIds: ["local-postprocess-planned"],
      slot: "local.postprocess",
      requiredModes: ["postprocess"],
      state: "planned",
      credentialStatus: "not_required",
      capabilityRefs: [],
      capabilitySummary: {
        outputKinds: ["metadata"],
        supportsReferenceImage: false,
        supportsStartEndFrame: false,
        supportsTextToVideo: false,
      },
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Planned local workflow slot. It cannot be used as semantic image/video repair."],
    }),
  ];
}

function summarize(state: Omit<AdapterContractState, "summary">, registry: ProviderRegistry): AdapterContractState["summary"] {
  const contractViolations = validateAdapterContractState({ ...state, summary: emptySummary() }, registry);

  return {
    agentAdapters: state.agentAdapters.map((adapter) => adapter.id),
    workerAdapters: state.workerAdapters.map((adapter) => adapter.id),
    providerAdapters: state.providerAdapters.map((adapter) => adapter.id),
    activeImageProvider: state.providerAdapters.find((adapter) => adapter.id === "image2-provider" && adapter.state === "active")?.id || "",
    parkedVideoProviders: state.providerAdapters
      .filter((adapter) => adapter.slot.startsWith("video.") && adapter.state === "parked")
      .map((adapter) => adapter.id),
    liveSubmitAllowed: false,
    credentialStorage: false,
    contractViolations,
  };
}

function emptySummary(): AdapterContractState["summary"] {
  return {
    agentAdapters: [],
    workerAdapters: [],
    providerAdapters: [],
    activeImageProvider: "",
    parkedVideoProviders: [],
    liveSubmitAllowed: false,
    credentialStorage: false,
    contractViolations: [],
  };
}

export function buildAdapterContractState(options: {
  generatedAt?: string;
  providerRegistry?: ProviderRegistry;
} = {}): AdapterContractState {
  const registry = options.providerRegistry || buildDefaultProviderRegistry(options.generatedAt);
  const stateWithoutSummary = {
    schemaVersion: adapterContractSchemaVersion,
    generatedAt: options.generatedAt,
    agentAdapters: buildAgentAdapters(),
    workerAdapters: buildWorkerAdapters(),
    providerAdapters: buildProviderAdapters(registry),
  };

  return {
    ...stateWithoutSummary,
    summary: summarize(stateWithoutSummary, registry),
  };
}

export function validateAdapterContractState(
  state: AdapterContractState,
  registry: ProviderRegistry = buildDefaultProviderRegistry(state.generatedAt),
): AdapterContractViolation[] {
  const violations: AdapterContractViolation[] = [];
  const capabilitiesById = new Map(registry.capabilities.map((capability) => [capability.id, capability]));

  for (const adapter of state.agentAdapters || []) {
    if (adapter.liveSubmitAllowed !== false) {
      violations.push({ code: "live_submit_allowed", adapterId: adapter.id, severity: "blocker", detail: "Agent adapter cannot allow live submit." });
    }
    if (adapter.credentialStorage !== false) {
      violations.push({ code: "credential_storage_enabled", adapterId: adapter.id, severity: "blocker", detail: "Agent adapter cannot store credentials." });
    }
    if (adapter.uiBinding !== false) {
      violations.push({ code: "agent_ui_binding", adapterId: adapter.id, severity: "blocker", detail: "Agent adapter cannot bind to UI." });
    }
  }

  for (const adapter of state.workerAdapters || []) {
    if (adapter.liveSubmitAllowed !== false) {
      violations.push({ code: "live_submit_allowed", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter cannot allow live submit." });
    }
    if (adapter.credentialStorage !== false) {
      violations.push({ code: "credential_storage_enabled", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter cannot store credentials." });
    }
    if (adapter.requiredEnvelopeSchema !== "subagent_task_envelope.schema.json" || adapter.canBypassEnvelope !== false) {
      violations.push({ code: "worker_envelope_bypass", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter must use subagent_task_envelope." });
    }
    if (adapter.mustReceiveContextPacket !== true) {
      violations.push({ code: "worker_context_packet_optional", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter must receive a context packet." });
    }
  }

  for (const adapter of state.providerAdapters || []) {
    if (!providerSlots.includes(adapter.slot)) {
      violations.push({ code: "unknown_provider_slot", adapterId: adapter.id, severity: "blocker", detail: `${adapter.slot} is not a known provider slot.` });
    }
    if (adapter.liveSubmitAllowed !== false) {
      violations.push({ code: "live_submit_allowed", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter cannot allow live submit." });
    }
    if (adapter.credentialStorage !== false) {
      violations.push({ code: "credential_storage_enabled", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter cannot store credentials." });
    }
    if (adapter.providerSubmissionForbidden !== true) {
      violations.push({ code: "provider_submission_allowed", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter must forbid provider submission." });
    }
    if (adapter.arbitraryProviderCommandAllowed !== false) {
      violations.push({ code: "arbitrary_provider_command_allowed", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter cannot allow arbitrary provider commands." });
    }
    const localPlaceholder = adapter.slot.startsWith("local.");
    if (!localPlaceholder && adapter.capabilityRefs.length === 0) {
      violations.push({ code: "capability_mismatch", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter must reference at least one matching provider capability." });
    }
    for (const capabilityRef of adapter.capabilityRefs) {
      const capability = capabilitiesById.get(capabilityRef);
      if (!capability) {
        violations.push({ code: "capability_mismatch", adapterId: adapter.id, severity: "blocker", detail: `${capabilityRef} is not registered in provider capabilities.` });
        continue;
      }
      if (
        !adapter.providerIds.includes(capability.providerId) ||
        capability.slot !== adapter.slot ||
        !adapter.requiredModes.includes(capability.requiredMode)
      ) {
        violations.push({
          code: "capability_mismatch",
          adapterId: adapter.id,
          severity: "blocker",
          detail: `${capabilityRef} does not match providerIds/slot/requiredModes for this adapter contract.`,
        });
      }
    }
    if (adapter.slot.startsWith("video.") && adapter.state !== "parked" && adapter.state !== "planned") {
      violations.push({ code: "video_provider_not_parked", adapterId: adapter.id, severity: "blocker", detail: "Video providers must remain parked or planned." });
    }
    if (adapter.id === "image2-provider" && (adapter.state !== "active" || adapter.dryRunOnly !== true)) {
      violations.push({ code: "image2_not_active_dry_run", adapterId: adapter.id, severity: "blocker", detail: "Image2 must be active and dry-run only." });
    }
  }

  return violations;
}
