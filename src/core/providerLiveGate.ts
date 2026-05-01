import type {
  AdapterContractState,
  AssetReadinessReport,
  AudioPlanningState,
  Image2AdapterRequest,
  ImageTaskPlan,
  ProviderAdapterContract,
  ProviderRegistry,
  ProviderSlot,
  RequiredMode,
  ShotRecord,
  VideoExecutionPreviewState,
  VideoPlanningState,
  VideoTaskPlan,
} from "./types";

export const providerLiveGateSchemaVersion = "0.1.0";

export type ProviderLiveGateSlotState =
  | "user_enabled_pending_confirmation"
  | "parked"
  | "planned"
  | "blocked";

export type ProviderLiveGateStatus = "ready_for_confirmation" | "blocked" | "parked";

export type ProviderLiveGateCheckId =
  | "adapter_contract_valid"
  | "provider_capability_present"
  | "envelope_valid"
  | "asset_readiness_ready"
  | "pair_qa_pass"
  | "image2_adapter_request_valid"
  | "user_confirmation_token_placeholder"
  | "video_provider_parked"
  | "no_fast_model"
  | "no_vip_channel"
  | "no_text_to_video_main_path"
  | "no_bgm_in_video_prompt";

export type ProviderLiveGateSourceKind = "image_task_plan" | "video_task_plan" | "provider_slot";

export interface ProviderLiveGateEnvelopeFact {
  taskPlanId: string;
  envelopeId?: string;
  schemaName?: string;
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

export interface ProviderLiveGateConfirmationTokenPlaceholder {
  tokenId: string;
  taskPlanId?: string;
  providerId?: string;
  slot?: ProviderSlot;
  placeholderPresent: boolean;
  confirmedByUser: boolean;
  notes: string[];
}

export interface ProviderLiveGateCheck {
  checkId: ProviderLiveGateCheckId;
  label: string;
  required: boolean;
  passed: boolean;
  blocker?: string;
  warning?: string;
  sourceRef?: string;
}

export interface ProviderLiveGateSlot {
  slotId: string;
  adapterId: string;
  providerId: string;
  slot: ProviderSlot;
  requiredModes: RequiredMode[];
  state: ProviderLiveGateSlotState;
  liveSubmitAllowed: false;
  providerSubmissionForbidden: true;
  credentialStorage: false;
  confirmationRequired: true;
  notes: string[];
}

export interface ProviderLiveGateItem {
  gateId: string;
  sourceKind: ProviderLiveGateSourceKind;
  sourceId: string;
  providerId: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  shotId?: string;
  status: ProviderLiveGateStatus;
  checks: ProviderLiveGateCheck[];
  blockers: string[];
  warnings: string[];
  confirmationTokenId?: string;
  canRequestUserConfirmation: boolean;
  canSubmitProvider: false;
  livePathBlocked: boolean;
  dryRunOnly: true;
  readOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  credentialStorage: false;
  noCredentialRead: true;
  noCredentialWrite: true;
}

export interface ProviderLiveGateHardLocks {
  dryRunOnly: true;
  readOnly: true;
  readinessPlanOnly: true;
  confirmationPlanOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  credentialStorage: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  noApiKeyCreation: true;
  noProviderSubmit: true;
  noArbitraryProviderCommand: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoMainPathForbidden: true;
  bgmInVideoPromptForbidden: true;
}

export interface ProviderLiveGatePhase30Evidence {
  confirmationTokenPlaceholderPresent: boolean;
  userConfirmationConfirmed: boolean;
  providerPacketComplete: boolean;
  watcherManifestQaClosedLoopRequired: true;
  forbiddenProviderModesAbsent: boolean;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  credentialStorage: false;
  liveSubmitAllowed: false;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoMainPathForbidden: true;
  bgmInVideoPromptForbidden: true;
}

export interface ProviderLiveGateState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_11_provider_adapter_live_gate";
  slots: ProviderLiveGateSlot[];
  items: ProviderLiveGateItem[];
  summary: {
    totalSlots: number;
    imageSlotsPendingConfirmation: number;
    parkedVideoSlots: number;
    totalItems: number;
    readyForConfirmation: number;
    blocked: number;
    parked: number;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialStorage: false;
  };
  hardLocks: ProviderLiveGateHardLocks;
  phase30Evidence: ProviderLiveGatePhase30Evidence;
  forbiddenActions: Array<
    | "provider_submit"
    | "credential_read"
    | "credential_write"
    | "api_key_create"
    | "fast_model"
    | "vip_channel"
    | "text_to_video_main_path"
    | "bgm_in_video_prompt"
    | "arbitrary_provider_command"
  >;
  notes: string[];
}

export interface BuildProviderLiveGateStateInput {
  generatedAt: string;
  providerRegistry: ProviderRegistry;
  adapterContracts: AdapterContractState;
  imageTaskPlans?: ImageTaskPlan[];
  image2AdapterRequests?: Image2AdapterRequest[];
  assetReadinessReports?: AssetReadinessReport[];
  shots?: ShotRecord[];
  videoPlanning?: VideoPlanningState;
  videoExecutionPreview?: VideoExecutionPreviewState;
  audioPlanning?: AudioPlanningState;
  envelopeFacts?: ProviderLiveGateEnvelopeFact[];
  confirmationTokens?: ProviderLiveGateConfirmationTokenPlaceholder[];
}

const hardLocks: ProviderLiveGateHardLocks = {
  dryRunOnly: true,
  readOnly: true,
  readinessPlanOnly: true,
  confirmationPlanOnly: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  credentialStorage: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noApiKeyCreation: true,
  noProviderSubmit: true,
  noArbitraryProviderCommand: true,
  fastModelForbidden: true,
  vipChannelForbidden: true,
  textToVideoMainPathForbidden: true,
  bgmInVideoPromptForbidden: true,
};

const forbiddenActions: ProviderLiveGateState["forbiddenActions"] = [
  "provider_submit",
  "credential_read",
  "credential_write",
  "api_key_create",
  "fast_model",
  "vip_channel",
  "text_to_video_main_path",
  "bgm_in_video_prompt",
  "arbitrary_provider_command",
];

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function isImageSlot(slot: ProviderSlot): boolean {
  return slot === "image.generate" || slot === "image.edit" || slot === "image.reference_asset";
}

function isVideoSlot(slot: ProviderSlot): boolean {
  return slot.startsWith("video.");
}

function check(
  checkId: ProviderLiveGateCheckId,
  label: string,
  required: boolean,
  passed: boolean,
  detail: string,
  sourceRef?: string,
): ProviderLiveGateCheck {
  return {
    checkId,
    label,
    required,
    passed,
    blocker: required && !passed ? detail : undefined,
    warning: !required && !passed ? detail : undefined,
    sourceRef,
  };
}

function providerAdapters(input: AdapterContractState): ProviderAdapterContract[] {
  return input.providerAdapters || [];
}

function matchingProviderAdapter(
  adapters: ProviderAdapterContract[],
  providerId: string,
  slot: ProviderSlot,
  requiredMode: RequiredMode,
): ProviderAdapterContract | undefined {
  return adapters.find(
    (adapter) =>
      adapter.providerIds.includes(providerId) &&
      adapter.slot === slot &&
      adapter.requiredModes.includes(requiredMode),
  );
}

function capabilityPresent(
  registry: ProviderRegistry,
  providerId: string,
  slot: ProviderSlot,
  requiredMode: RequiredMode,
): boolean {
  return registry.capabilities.some(
    (capability) =>
      capability.providerId === providerId &&
      capability.slot === slot &&
      capability.requiredMode === requiredMode &&
      capability.liveSubmitAllowed === false &&
      capability.executionState !== "unavailable",
  );
}

function envelopeValid(
  taskPlan: ImageTaskPlan,
  envelopeFacts: ProviderLiveGateEnvelopeFact[],
): { valid: boolean; sourceRef?: string; blockers: string[]; warnings: string[] } {
  const explicit = envelopeFacts.find((fact) => fact.taskPlanId === taskPlan.taskPlanId);
  if (explicit) {
    return {
      valid: explicit.valid,
      sourceRef: explicit.envelopeId || explicit.taskPlanId,
      blockers: explicit.blockers,
      warnings: explicit.warnings,
    };
  }

  const summary = taskPlan.taskEnvelopeSummary;
  const valid = Boolean(summary && summary.preflightStatus === "pass" && summary.blockingReasons.length === 0);
  return {
    valid,
    sourceRef: summary?.envelopeId,
    blockers: valid ? [] : ["Task envelope summary is missing, blocked, or not preflight PASS."],
    warnings: [],
  };
}

function assetReady(
  taskPlan: ImageTaskPlan,
  reports: AssetReadinessReport[],
): { ready: boolean; sourceRef?: string; blockers: string[]; warnings: string[] } {
  const report = reports.find((item) => item.shotId === taskPlan.shotId);
  if (!report) {
    return {
      ready: false,
      blockers: ["Asset readiness report is missing for the image task shot."],
      warnings: [],
    };
  }

  const ready = report.status === "ready" && report.formalBlocked === false && report.blockers.length === 0;
  return {
    ready,
    sourceRef: report.reportId,
    blockers: ready ? [] : [`Asset readiness is ${report.status}; formalBlocked=${report.formalBlocked}.`, ...report.blockers],
    warnings: report.warnings,
  };
}

function pairQaPass(taskPlan: ImageTaskPlan, shots: ShotRecord[]): { pass: boolean; sourceRef?: string } {
  const shot = shots.find((item) => item.id === taskPlan.shotId);
  return {
    pass: shot?.gates.pair === "PASS",
    sourceRef: shot?.id,
  };
}

function image2RequestValid(request?: Image2AdapterRequest): boolean {
  return Boolean(
    request &&
      request.adapterId === "image2-dry-run" &&
      request.payload.outputPath &&
      Array.isArray(request.payload.sourceIntent) &&
      request.submitPolicy.dry_run_only === true &&
      request.submitPolicy.manual_submit_required === true &&
      request.submitPolicy.live_submit_forbidden === true,
  );
}

function matchingConfirmationToken(
  tokens: ProviderLiveGateConfirmationTokenPlaceholder[],
  input: { taskPlanId: string; providerId: string; slot: ProviderSlot },
): ProviderLiveGateConfirmationTokenPlaceholder | undefined {
  return tokens.find((token) => {
    const taskMatches = !token.taskPlanId || token.taskPlanId === input.taskPlanId;
    const providerMatches = !token.providerId || token.providerId === input.providerId;
    const slotMatches = !token.slot || token.slot === input.slot;
    return taskMatches && providerMatches && slotMatches;
  });
}

function itemStatus(checks: ProviderLiveGateCheck[], parked: boolean): ProviderLiveGateStatus {
  if (parked) return "parked";
  return checks.some((item) => item.required && !item.passed) ? "blocked" : "ready_for_confirmation";
}

function buildSlot(adapter: ProviderAdapterContract): ProviderLiveGateSlot {
  const state: ProviderLiveGateSlotState = isVideoSlot(adapter.slot)
    ? "parked"
    : isImageSlot(adapter.slot) && adapter.state === "active"
      ? "user_enabled_pending_confirmation"
      : adapter.state === "planned"
        ? "planned"
        : "blocked";

  return {
    slotId: `provider_live_gate_slot_${safeId(adapter.id)}`,
    adapterId: adapter.id,
    providerId: adapter.providerIds[0] || adapter.id,
    slot: adapter.slot,
    requiredModes: adapter.requiredModes,
    state,
    liveSubmitAllowed: false,
    providerSubmissionForbidden: true,
    credentialStorage: false,
    confirmationRequired: true,
    notes: [
      state === "user_enabled_pending_confirmation"
        ? "Image2 slot may be represented as user-enabled pending confirmation, but live submit remains disabled."
        : "Provider slot is represented for readiness planning only.",
      "No credentials are read or stored by the live gate.",
    ],
  };
}

function buildImageItem(input: {
  taskPlan: ImageTaskPlan;
  providerRegistry: ProviderRegistry;
  adapters: ProviderAdapterContract[];
  requests: Image2AdapterRequest[];
  assetReadinessReports: AssetReadinessReport[];
  shots: ShotRecord[];
  envelopeFacts: ProviderLiveGateEnvelopeFact[];
  tokens: ProviderLiveGateConfirmationTokenPlaceholder[];
}): ProviderLiveGateItem {
  const { taskPlan } = input;
  const adapter = matchingProviderAdapter(input.adapters, taskPlan.providerId, taskPlan.providerSlot, taskPlan.requiredMode);
  const capabilityOk = capabilityPresent(input.providerRegistry, taskPlan.providerId, taskPlan.providerSlot, taskPlan.requiredMode);
  const envelope = envelopeValid(taskPlan, input.envelopeFacts);
  const asset = assetReady(taskPlan, input.assetReadinessReports);
  const pair = pairQaPass(taskPlan, input.shots);
  const request = input.requests.find((item) => item.taskPlanId === taskPlan.taskPlanId);
  const requestOk = image2RequestValid(request);
  const token = matchingConfirmationToken(input.tokens, {
    taskPlanId: taskPlan.taskPlanId,
    providerId: taskPlan.providerId,
    slot: taskPlan.providerSlot,
  });
  const tokenOk = Boolean(token?.placeholderPresent && token.confirmedByUser);
  const checks: ProviderLiveGateCheck[] = [
    check(
      "adapter_contract_valid",
      "Adapter contract valid",
      true,
      Boolean(adapter?.dryRunOnly && adapter.readOnly && adapter.liveSubmitAllowed === false && adapter.providerSubmissionForbidden),
      "Provider adapter contract is missing or does not preserve dry-run/read-only live-submit locks.",
      adapter?.id,
    ),
    check(
      "provider_capability_present",
      "Provider capability present",
      true,
      capabilityOk,
      `No provider capability supports ${taskPlan.providerId}/${taskPlan.providerSlot}/${taskPlan.requiredMode}.`,
      `${taskPlan.providerId}:${taskPlan.providerSlot}:${taskPlan.requiredMode}`,
    ),
    check(
      "envelope_valid",
      "Envelope valid",
      true,
      envelope.valid,
      uniqueSorted(envelope.blockers).join(" "),
      envelope.sourceRef,
    ),
    check(
      "asset_readiness_ready",
      "Asset readiness ready",
      true,
      asset.ready,
      uniqueSorted(asset.blockers).join(" "),
      asset.sourceRef,
    ),
    check(
      "pair_qa_pass",
      "Pair QA PASS",
      true,
      pair.pass,
      "Pair QA must be PASS before any live-path confirmation plan can become ready.",
      pair.sourceRef,
    ),
    check(
      "image2_adapter_request_valid",
      "Image2 adapter request valid",
      true,
      requestOk,
      "Image2 adapter request must be a dry-run request with manual submit required and live submit forbidden.",
      request?.requestId,
    ),
    check(
      "user_confirmation_token_placeholder",
      "User confirmation token placeholder",
      true,
      tokenOk,
      "A user confirmation token placeholder must be present and confirmed before the live path can be marked ready.",
      token?.tokenId,
    ),
  ];
  const status = itemStatus(checks, false);
  const blockers = uniqueSorted(checks.flatMap((item) => (item.required && !item.passed && item.blocker ? [item.blocker] : [])));
  const warnings = uniqueSorted([...envelope.warnings, ...asset.warnings, ...checks.flatMap((item) => (item.warning ? [item.warning] : []))]);

  return {
    gateId: `provider_live_gate_${safeId(taskPlan.taskPlanId)}`,
    sourceKind: "image_task_plan",
    sourceId: taskPlan.taskPlanId,
    providerId: taskPlan.providerId,
    slot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    shotId: taskPlan.shotId,
    status,
    checks,
    blockers,
    warnings,
    confirmationTokenId: token?.tokenId,
    canRequestUserConfirmation: status === "blocked" && blockers.length === 1 && blockers[0].includes("user confirmation token"),
    canSubmitProvider: false,
    livePathBlocked: true,
    dryRunOnly: true,
    readOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    credentialStorage: false,
    noCredentialRead: true,
    noCredentialWrite: true,
  };
}

function buildVideoItem(input: {
  taskPlan: VideoTaskPlan;
  providerRegistry: ProviderRegistry;
  adapters: ProviderAdapterContract[];
  videoExecutionPreview?: VideoExecutionPreviewState;
  audioPlanning?: AudioPlanningState;
}): ProviderLiveGateItem {
  const { taskPlan } = input;
  const adapter = matchingProviderAdapter(input.adapters, taskPlan.providerId, taskPlan.providerSlot, taskPlan.requiredMode);
  const capabilityOk = capabilityPresent(input.providerRegistry, taskPlan.providerId, taskPlan.providerSlot, taskPlan.requiredMode);
  const preview = input.videoExecutionPreview?.previews.find((item) => item.taskPlanId === taskPlan.taskPlanId);
  const noBgmPolicy = input.audioPlanning?.videoProviderPolicy.noBgmForVideoProvider === true;
  const checks: ProviderLiveGateCheck[] = [
    check(
      "adapter_contract_valid",
      "Adapter contract valid",
      true,
      Boolean(adapter?.dryRunOnly && adapter.readOnly && adapter.liveSubmitAllowed === false && adapter.providerSubmissionForbidden),
      "Video provider adapter contract must remain dry-run/read-only with provider submission forbidden.",
      adapter?.id,
    ),
    check(
      "provider_capability_present",
      "Provider capability present",
      true,
      capabilityOk,
      `No provider capability supports ${taskPlan.providerId}/${taskPlan.providerSlot}/${taskPlan.requiredMode}.`,
      `${taskPlan.providerId}:${taskPlan.providerSlot}:${taskPlan.requiredMode}`,
    ),
    check(
      "video_provider_parked",
      "Video provider parked",
      true,
      taskPlan.providerExecutionState === "parked" && taskPlan.liveSubmitAllowed === false,
      "Seedance/Jimeng video providers must remain parked with liveSubmitAllowed=false.",
      taskPlan.providerId,
    ),
    check("no_fast_model", "No fast model", true, taskPlan.fastModelForbidden === true, "Fast model path must be forbidden.", taskPlan.taskPlanId),
    check("no_vip_channel", "No VIP channel", true, taskPlan.vipChannelForbidden === true, "VIP channel path must be forbidden.", taskPlan.taskPlanId),
    check(
      "no_text_to_video_main_path",
      "No text-to-video main path",
      true,
      taskPlan.textToVideoForbidden === true,
      "Text-to-video cannot become the main video path.",
      taskPlan.taskPlanId,
    ),
    check(
      "no_bgm_in_video_prompt",
      "No BGM in video prompt",
      true,
      noBgmPolicy && taskPlan.promptConstraints.includes("no bgm"),
      "BGM must stay in audio planning/export planning and out of video provider prompts.",
      taskPlan.taskPlanId,
    ),
  ];
  const blockers = uniqueSorted(checks.flatMap((item) => (item.required && !item.passed && item.blocker ? [item.blocker] : [])));
  const warnings = uniqueSorted([
    ...(preview?.warnings || []),
    "Video live gate is intentionally parked; user confirmation cannot unlock provider submission in Phase 11.",
  ]);

  return {
    gateId: `provider_live_gate_${safeId(taskPlan.taskPlanId)}`,
    sourceKind: "video_task_plan",
    sourceId: taskPlan.taskPlanId,
    providerId: taskPlan.providerId,
    slot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    shotId: taskPlan.shotId,
    status: "parked",
    checks,
    blockers,
    warnings,
    canRequestUserConfirmation: false,
    canSubmitProvider: false,
    livePathBlocked: true,
    dryRunOnly: true,
    readOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    credentialStorage: false,
    noCredentialRead: true,
    noCredentialWrite: true,
  };
}

function checkPassed(item: ProviderLiveGateItem, checkId: ProviderLiveGateCheckId): boolean {
  return item.checks.find((check) => check.checkId === checkId)?.passed === true;
}

function buildPhase30Evidence(items: ProviderLiveGateItem[], tokens: ProviderLiveGateConfirmationTokenPlaceholder[]): ProviderLiveGatePhase30Evidence {
  const imageItems = items.filter((item) => item.sourceKind === "image_task_plan");
  const videoItems = items.filter((item) => item.sourceKind === "video_task_plan");
  const providerPacketComplete =
    imageItems.length > 0 &&
    imageItems.every((item) =>
      [
        "adapter_contract_valid",
        "provider_capability_present",
        "envelope_valid",
        "asset_readiness_ready",
        "pair_qa_pass",
        "image2_adapter_request_valid",
      ].every((checkId) => checkPassed(item, checkId as ProviderLiveGateCheckId)),
    );
  const forbiddenProviderModesAbsent =
    videoItems.length === 0 ||
    videoItems.every((item) =>
      ["no_fast_model", "no_vip_channel", "no_text_to_video_main_path", "no_bgm_in_video_prompt"].every((checkId) =>
        checkPassed(item, checkId as ProviderLiveGateCheckId),
      ),
    );

  return {
    confirmationTokenPlaceholderPresent: tokens.some((token) => token.placeholderPresent),
    userConfirmationConfirmed: tokens.some((token) => token.placeholderPresent && token.confirmedByUser),
    providerPacketComplete,
    watcherManifestQaClosedLoopRequired: true,
    forbiddenProviderModesAbsent,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    credentialStorage: false,
    liveSubmitAllowed: false,
    fastModelForbidden: true,
    vipChannelForbidden: true,
    textToVideoMainPathForbidden: true,
    bgmInVideoPromptForbidden: true,
  };
}

export function buildProviderLiveGateState(input: BuildProviderLiveGateStateInput): ProviderLiveGateState {
  const adapters = providerAdapters(input.adapterContracts);
  const slots = adapters.map(buildSlot);
  const imageItems = (input.imageTaskPlans || []).map((taskPlan) =>
    buildImageItem({
      taskPlan,
      providerRegistry: input.providerRegistry,
      adapters,
      requests: input.image2AdapterRequests || [],
      assetReadinessReports: input.assetReadinessReports || [],
      shots: input.shots || [],
      envelopeFacts: input.envelopeFacts || [],
      tokens: input.confirmationTokens || [],
    }),
  );
  const videoItems = (input.videoPlanning?.taskPlans || []).map((taskPlan) =>
    buildVideoItem({
      taskPlan,
      providerRegistry: input.providerRegistry,
      adapters,
      videoExecutionPreview: input.videoExecutionPreview,
      audioPlanning: input.audioPlanning,
    }),
  );
  const items = [...imageItems, ...videoItems];
  const phase30Evidence = buildPhase30Evidence(items, input.confirmationTokens || []);

  return {
    schemaVersion: providerLiveGateSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_11_provider_adapter_live_gate",
    slots,
    items,
    summary: {
      totalSlots: slots.length,
      imageSlotsPendingConfirmation: slots.filter((slot) => slot.state === "user_enabled_pending_confirmation").length,
      parkedVideoSlots: slots.filter((slot) => slot.state === "parked" && slot.slot.startsWith("video.")).length,
      totalItems: items.length,
      readyForConfirmation: items.filter((item) => item.status === "ready_for_confirmation").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      parked: items.filter((item) => item.status === "parked").length,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialStorage: false,
    },
    hardLocks,
    phase30Evidence,
    forbiddenActions,
    notes: [
      "Phase 11 Provider Live Gate is an enablement readiness and confirmation plan only.",
      "It never submits providers, stores or reads credentials, creates API keys, or opens fast/VIP/text-to-video/BGM video routes.",
      "Even ready_for_confirmation items keep liveSubmitAllowed=false and canSubmitProvider=false.",
    ],
  };
}
