import type {
  GenerationJob,
  ProviderCapability,
  ProviderCapabilityRequirement,
  ProviderCapabilitySupport,
  ProviderCapabilityValidationResult,
  ProviderExecutionState,
  ProviderPolicy,
  ProviderRegistry,
  ProviderSlot,
  RequiredMode,
} from "./types";

const schemaVersion = "0.1.0";

function support(overrides: Partial<ProviderCapabilitySupport> = {}): ProviderCapabilitySupport {
  return {
    referenceImage: false,
    imageEdit: false,
    startEndFrame: false,
    bbox: "unsupported",
    cameraControl: "none",
    controlNet: "unsupported",
    mask: "unsupported",
    negativePrompt: "supported",
    ...overrides,
  };
}

function capability(input: Omit<ProviderCapability, "id" | "liveSubmitAllowed">): ProviderCapability {
  return {
    ...input,
    id: `${input.providerId}:${input.slot}:${input.requiredMode}`,
    liveSubmitAllowed: false,
  };
}

function requirement(input: ProviderCapabilityRequirement): ProviderCapabilityRequirement {
  return input;
}

function selectionPolicy(): NonNullable<ProviderRegistry["selectionPolicy"]> {
  return {
    strategy: "registry_default",
    defaultsAreConfiguration: true,
    taskPacketsCarryRequirements: true,
    notes: [
      "Provider identity is selected from registry defaults or policy rules.",
      "Task packets must carry slot, requiredMode, and capability requirements instead of hard-coding provider identity.",
    ],
  };
}

export function buildDefaultProviderRegistry(generatedAt?: string): ProviderRegistry {
  const capabilities: ProviderCapability[] = [
    capability({
      providerId: "openai-image2-codex-cli",
      providerName: "OpenAI Image2 via Codex CLI",
      slot: "image.generate",
      requiredMode: "text2image",
      executionState: "active",
      inputKinds: ["text"],
      outputKind: "image",
      supports: support({ cameraControl: "textual" }),
      maxReferenceImages: 0,
      forbiddenFallbacks: ["text2image_to_image2image", "image2image_to_text2image"],
      notes: ["Dry-run contract only. The importer and runtime state never submit Image2 jobs."],
    }),
    capability({
      providerId: "openai-image2-api",
      providerName: "OpenAI Image2 API",
      slot: "image.edit",
      requiredMode: "image2image",
      executionState: "active",
      inputKinds: ["text", "image", "reference_image"],
      outputKind: "image",
      supports: support({
        referenceImage: true,
        imageEdit: true,
        startEndFrame: true,
        mask: "planned",
        cameraControl: "textual",
      }),
      maxReferenceImages: 4,
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      notes: ["End-frame edits must derive from the start frame or block; no text-to-image fallback is allowed."],
    }),
    capability({
      providerId: "openai-image2-api",
      providerName: "OpenAI Image2 API",
      slot: "image.reference_asset",
      requiredMode: "text2image",
      executionState: "active",
      inputKinds: ["text", "reference_image"],
      outputKind: "image",
      supports: support({ referenceImage: true, cameraControl: "textual" }),
      maxReferenceImages: 3,
      forbiddenFallbacks: ["image2image_to_text2image"],
      notes: ["Reference assets are compiled as source-intent plans before any future Image2 adapter call."],
    }),
    capability({
      providerId: "openai-image2-api",
      providerName: "OpenAI Image2 API",
      slot: "image.reference_asset",
      requiredMode: "image2image",
      executionState: "active",
      inputKinds: ["text", "image", "reference_image"],
      outputKind: "image",
      supports: support({
        referenceImage: true,
        imageEdit: true,
        mask: "planned",
        cameraControl: "textual",
      }),
      maxReferenceImages: 4,
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      notes: ["Reference-image asset edits stay Image2 image-to-image only."],
    }),
    capability({
      providerId: "seedance2-provider",
      providerName: "Seedance 2 Provider",
      slot: "video.i2v",
      requiredMode: "frames2video",
      executionState: "parked",
      inputKinds: ["text", "start_frame", "end_frame"],
      outputKind: "video",
      supports: support({
        referenceImage: true,
        startEndFrame: true,
        cameraControl: "planned",
      }),
      maxReferenceImages: 2,
      forbiddenFallbacks: ["frames2video_to_text2video"],
      notes: ["Parked capability only; live submit is false for Seedance/Jimeng paths."],
    }),
    capability({
      providerId: "jimeng-video",
      providerName: "Jimeng Video",
      slot: "video.i2v",
      requiredMode: "frames2video",
      executionState: "parked",
      inputKinds: ["text", "start_frame", "end_frame"],
      outputKind: "video",
      supports: support({
        referenceImage: true,
        startEndFrame: true,
        cameraControl: "planned",
      }),
      maxReferenceImages: 2,
      forbiddenFallbacks: ["frames2video_to_text2video"],
      notes: ["Parked capability only; retained for future adapter selection."],
    }),
    capability({
      providerId: "none",
      providerName: "Parked text-to-video placeholder",
      slot: "video.t2v.experimental",
      requiredMode: "text2video",
      executionState: "parked",
      inputKinds: ["text"],
      outputKind: "video",
      supports: support({ cameraControl: "planned" }),
      maxReferenceImages: 0,
      forbiddenFallbacks: [],
      notes: ["Text-to-video is explicitly parked and cannot be used as an image/video fallback."],
    }),
    capability({
      providerId: "audio-planned-provider",
      providerName: "Planned Audio TTS Provider",
      slot: "audio.tts",
      requiredMode: "tts",
      executionState: "planned",
      inputKinds: ["text"],
      outputKind: "audio",
      supports: support(),
      maxReferenceImages: 0,
      forbiddenFallbacks: [],
      notes: ["Planned dry-run audio capability for task packet abstraction only."],
    }),
    capability({
      providerId: "subagent-worker",
      providerName: "Structured Subagent Worker",
      slot: "local.workflow",
      requiredMode: "not_applicable",
      executionState: "planned",
      inputKinds: ["text"],
      outputKind: "metadata",
      supports: support(),
      maxReferenceImages: 0,
      forbiddenFallbacks: [],
      notes: ["Local workflow capability placeholder for audit/export/task packet envelopes."],
    }),
  ];

  return {
    schemaVersion,
    registryVersion: "provider-registry/phase-4.0",
    generatedAt,
    strictImageProvider: "registry_default",
    selectionPolicy: selectionPolicy(),
    defaultProviderBySlot: {
      "image.generate": "openai-image2-codex-cli",
      "image.edit": "openai-image2-api",
      "image.reference_asset": "openai-image2-api",
      "video.i2v": "seedance2-provider",
      "video.t2v.experimental": "none",
      "audio.tts": "audio-planned-provider",
      "local.workflow": "subagent-worker",
    },
    capabilities,
    notes: [
      "Provider capability matrix is a dry-run contract.",
      "Named providers in defaultProviderBySlot are configuration defaults, not architecture constants.",
      "Image edit never falls back to text2image unless a future registry capability explicitly changes the contract.",
      "Video providers are parked by default and liveSubmitAllowed is false.",
    ],
  };
}

export function buildProviderRequirement(input: {
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  inputKinds: ProviderCapabilityRequirement["inputKinds"];
  outputKind: ProviderCapabilityRequirement["outputKind"];
  supports?: ProviderCapabilityRequirement["supports"];
  maxReferenceImages?: number;
  forbiddenFallbacks?: string[];
  executionStates?: ProviderExecutionState[];
  notes?: string[];
}): ProviderCapabilityRequirement {
  return requirement({
    slot: input.slot,
    requiredMode: input.requiredMode,
    inputKinds: input.inputKinds,
    outputKind: input.outputKind,
    supports: input.supports,
    maxReferenceImages: input.maxReferenceImages,
    forbiddenFallbacks: input.forbiddenFallbacks || [],
    executionStates: input.executionStates,
    notes: input.notes || [],
  });
}

function supportsRequirement(
  capabilitySupport: ProviderCapabilitySupport,
  requiredSupport: ProviderCapabilityRequirement["supports"] = {},
): boolean {
  return Object.entries(requiredSupport).every(([key, value]) => {
    const supportKey = key as keyof ProviderCapabilitySupport;
    return capabilitySupport[supportKey] === value;
  });
}

export function getCapabilitiesForRequirement(
  requirement: ProviderCapabilityRequirement,
  registry: ProviderRegistry = buildDefaultProviderRegistry(),
): ProviderCapability[] {
  return registry.capabilities.filter((item) => {
    const inputKindsOk = requirement.inputKinds.every((kind) => item.inputKinds.includes(kind));
    const executionStateOk = !requirement.executionStates?.length || requirement.executionStates.includes(item.executionState);
    const maxReferenceImagesOk = requirement.maxReferenceImages === undefined || item.maxReferenceImages >= requirement.maxReferenceImages;
    const fallbackPolicyOk = (requirement.forbiddenFallbacks || []).every((fallback) => item.forbiddenFallbacks.includes(fallback));
    return item.slot === requirement.slot
      && item.requiredMode === requirement.requiredMode
      && item.outputKind === requirement.outputKind
      && inputKindsOk
      && executionStateOk
      && maxReferenceImagesOk
      && fallbackPolicyOk
      && supportsRequirement(item.supports, requirement.supports);
  });
}

function ruleForRequirement(requirement: ProviderCapabilityRequirement, policy?: ProviderPolicy) {
  return policy?.rules.find((rule) => rule.slot === requirement.slot && rule.allowedModes.includes(requirement.requiredMode));
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function selectCapabilityForRequirement(
  requirement: ProviderCapabilityRequirement,
  registry: ProviderRegistry = buildDefaultProviderRegistry(),
  policy?: ProviderPolicy,
): {
  requirement: ProviderCapabilityRequirement;
  capability?: ProviderCapability;
  providerId: string;
  executionState: ProviderExecutionState;
  capabilityId?: string;
  selectionSource: "registry_default" | "policy_active_provider" | "first_matching_capability" | "unresolved";
  blockers: string[];
  warnings: string[];
} {
  const capabilities = getCapabilitiesForRequirement(requirement, registry);
  const rule = ruleForRequirement(requirement, policy);
  const preferredProviderIds = unique([
    registry.defaultProviderBySlot[requirement.slot],
    rule?.activeProvider,
  ]);
  const selectedFromDefault = preferredProviderIds
    .map((providerId) => capabilities.find((item) => item.providerId === providerId))
    .find(Boolean);
  const selected = selectedFromDefault || capabilities[0];
  const selectionSource = selected
    ? selected.providerId === registry.defaultProviderBySlot[requirement.slot]
      ? "registry_default"
      : selected.providerId === rule?.activeProvider
        ? "policy_active_provider"
        : "first_matching_capability"
    : "unresolved";

  return {
    requirement,
    capability: selected,
    providerId: selected?.providerId || preferredProviderIds[0] || "registry_unresolved",
    executionState: selected?.executionState || rule?.executionState || "planned",
    capabilityId: selected?.id,
    selectionSource,
    blockers: selected ? [] : [`No provider capability supports ${requirement.slot}/${requirement.requiredMode}.`],
    warnings: selected && selected.liveSubmitAllowed !== false ? ["Selected provider capability is missing the dry-run liveSubmitAllowed=false lock."] : [],
  };
}

export function getCapabilityForJob(
  job: Pick<GenerationJob, "slot" | "requiredMode" | "providerId">,
  registry: ProviderRegistry = buildDefaultProviderRegistry(),
): ProviderCapability | undefined {
  const byProvider = registry.capabilities.find(
    (item) => item.slot === job.slot && item.requiredMode === job.requiredMode && item.providerId === job.providerId,
  );
  if (byProvider) return byProvider;

  const defaultProvider = registry.defaultProviderBySlot[job.slot];
  return registry.capabilities.find(
    (item) => item.slot === job.slot && item.requiredMode === job.requiredMode && item.providerId === defaultProvider,
  ) || registry.capabilities.find((item) => item.slot === job.slot && item.requiredMode === job.requiredMode);
}

function expectedModeForSlot(slot: ProviderSlot): RequiredMode | undefined {
  if (slot === "image.generate") return "text2image";
  if (slot === "image.edit") return "image2image";
  if (slot === "video.i2v") return "frames2video";
  if (slot === "video.t2v.experimental") return "text2video";
  return undefined;
}

export function validateJobAgainstCapability(
  job: GenerationJob,
  registry: ProviderRegistry = buildDefaultProviderRegistry(),
): ProviderCapabilityValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const capability = getCapabilityForJob(job, registry);
  const providerMatchesSlot = registry.capabilities.some(
    (item) => item.slot === job.slot && item.providerId === job.providerId,
  );

  if (!capability) {
    blockers.push(`No provider capability supports ${job.slot}/${job.requiredMode}.`);
    return { valid: false, blockers, warnings };
  }

  const expectedMode = expectedModeForSlot(job.slot);
  if (expectedMode && job.requiredMode !== expectedMode) {
    blockers.push(`${job.slot} requires ${expectedMode}; ${job.requiredMode} is not allowed.`);
  }

  if (job.providerId && job.providerId !== "unknown" && !providerMatchesSlot) {
    blockers.push(`${job.providerId} is not registered for ${job.slot}.`);
  }

  if (job.slot === "image.edit" && job.requiredMode !== "image2image") {
    blockers.push("image.edit cannot fall back to text2image.");
  }

  if (job.slot === "image.edit" && capability.forbiddenFallbacks.includes("image2image_to_text2image")) {
    warnings.push("image.edit fallback to text2image is forbidden by capability.");
  }

  if (job.issues.some((issue) => /fallback_text|image2image_to_text2image|reference_edit_to_text2image/.test(issue))) {
    blockers.push("Job carries forbidden image fallback evidence.");
  }

  if (capability.executionState === "parked" || capability.executionState === "planned" || capability.executionState === "unavailable") {
    warnings.push(`${capability.slot} is ${capability.executionState}; keep this as dry-run contract state.`);
  }

  if (capability.liveSubmitAllowed !== false) {
    blockers.push("Provider capability must not allow live submit in Phase 4 dry-run.");
  }

  return {
    valid: blockers.length === 0,
    capability,
    blockers,
    warnings,
  };
}
