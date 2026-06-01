import type { Image2AdapterRequest, Image2ReferenceImageInput, Image2ReferenceImageInputRole, ProviderSlot, RequiredMode } from "./types";

export const imageReferenceTransportSchemaVersion = "0.1.0";

export type ImageReferenceTransportStatus = "dispatch_ready" | "blocked";
export type ImageReferenceInterfaceKind = "prompt_only" | "structured_handoff" | "explicit_image_input" | "unknown";
export type ImageReferenceFileStatus = "available" | "missing" | "blocked" | "unknown";

export interface ImageReferenceActionCapabilitySummary {
  actionId?: string;
  providerId?: string;
  providerSlot?: ProviderSlot | string;
  requiredMode?: RequiredMode | string;
  interfaceKind?: ImageReferenceInterfaceKind;
  modelLabel?: string;
  modelTier?: string;
  inputKinds?: string[];
  supportsExplicitImageInput?: boolean;
  supportsLocalImageInput?: boolean;
  supportsFileReferenceInput?: boolean;
  supportsPromptOnly?: boolean;
  referenceImageInputRoles?: Image2ReferenceImageInputRole[];
  toolSchema?: unknown;
  notes?: string[];
}

export interface ImageReferenceAppServerCapabilitySummary {
  runtimeKind?: "agent_app_server" | "agent_cli" | "image_runtime" | "unknown" | string;
  readiness?: "ready" | "blocked" | "unknown" | string;
  canUseImageRuntime?: boolean;
  imageRuntimeAvailable?: boolean;
  imageRuntimeSupportsExplicitInputs?: boolean;
  imageRuntimeSupportsLocalFiles?: boolean;
  imageRuntimeInputKinds?: string[];
  generatedSchemaAvailable?: boolean;
  providerSubmitAllowed?: 0 | false;
  liveSubmitAllowed?: false;
  notes?: string[];
}

export interface ImageReferenceOutputSandboxInfo {
  root: string;
  allowedPrefixes?: string[];
  expectedOutputPath?: string;
  manifestPath?: string;
  qaReportPath?: string;
  outsideRootWriteAllowed: false;
}

export interface SourceStartFrameFileFacts {
  path: string;
  hash?: string;
  mime?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  status: ImageReferenceFileStatus;
}

export interface BuildImageReferenceTransportInput {
  generatedAt: string;
  request: Image2AdapterRequest;
  actionCapability?: ImageReferenceActionCapabilitySummary;
  appServerCapability?: ImageReferenceAppServerCapabilitySummary;
  outputSandbox: ImageReferenceOutputSandboxInfo;
  sourceStartFrameFileFacts?: SourceStartFrameFileFacts;
}

export interface ImageReferenceTransportState {
  schemaVersion: typeof imageReferenceTransportSchemaVersion;
  generatedAt: string;
  phase: "image_reference_transport_handoff";
  status: ImageReferenceTransportStatus;
  requestId: string;
  taskPlanId: string;
  operation: Image2AdapterRequest["operation"];
  frameRole?: Image2AdapterRequest["frameRole"];
  requiredSourceStartFrame: boolean;
  sourceStartFrame?: {
    inputId: string;
    path: string;
    hash: string;
    mime: string;
    dimensions: {
      width: number;
      height: number;
    };
    role: "source_start_frame";
    transportRole: "explicit_local_image_reference";
  };
  capabilityEvidence: {
    actionId?: string;
    providerId?: string;
    providerSlot?: string;
    requiredMode?: string;
    interfaceKind: ImageReferenceInterfaceKind;
    promptOnly: boolean;
    actionSupportsExplicitImageInput: boolean;
    appServerImageRuntimeReady: boolean;
    appServerSupportsExplicitImageInput: boolean;
    supportedReferenceRoles: Image2ReferenceImageInputRole[];
  };
  outputSandbox: {
    root: string;
    expectedOutputPath: string;
    manifestPath?: string;
    qaReportPath?: string;
    scopedSandboxOnly: true;
    outsideRootWriteAllowed: false;
  };
  transportPolicy: {
    handoffOnly: true;
    dispatchSideEffectAllowed: false;
    providerSubmitAllowed: 0;
    canSubmitProvider: false;
    liveSubmitAllowed: false;
    externalNetworkIoAllowed: false;
    providerSelfReportCanComplete: false;
    promptOnlyImageEditAllowed: false;
    seedanceOrJimengAllowed: false;
    videoAllowed: false;
    fastOrVipAllowed: false;
    textToVideoAllowed: false;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

const imageInputKinds = new Set(["image", "reference_image", "input_image", "local_image", "image_file", "start_frame", "end_frame", "mask"]);
const videoModes = new Set(["frames2video", "text2video", "video2video"]);

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function pathInsideSandbox(path: string | undefined, sandbox: ImageReferenceOutputSandboxInfo): boolean {
  if (!path) return false;
  const normalizedPath = normalizePath(path);
  if (normalizedPath.split("/").includes("..")) return false;
  const prefixes = uniqueSorted([sandbox.root, ...(sandbox.allowedPrefixes || [])]).map(normalizePath);
  return prefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}

function schemaMentionsExplicitImageInput(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    return /referenceImageInputs|sourceStartFrame|source_start_frame|input_image|image_file|local_image|image\/|contentMediaType/i.test(value);
  }
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(schemaMentionsExplicitImageInput);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (/referenceImageInputs|sourceStartFrame|source_start_frame|input_image|image_file|local_image|image\/|contentMediaType/i.test(key)) return true;
    return schemaMentionsExplicitImageInput(child);
  });
}

function actionSupportsExplicitImageInput(capability?: ImageReferenceActionCapabilitySummary): boolean {
  if (!capability) return false;
  if (capability.supportsExplicitImageInput === true || capability.supportsLocalImageInput === true || capability.supportsFileReferenceInput === true) {
    return true;
  }
  if ((capability.referenceImageInputRoles || []).includes("source_start_frame")) return true;
  if ((capability.inputKinds || []).some((kind) => imageInputKinds.has(kind))) return true;
  return schemaMentionsExplicitImageInput(capability.toolSchema);
}

function appServerSupportsExplicitImageInput(capability?: ImageReferenceAppServerCapabilitySummary): boolean {
  if (!capability) return false;
  if (capability.imageRuntimeSupportsExplicitInputs === true || capability.imageRuntimeSupportsLocalFiles === true) return true;
  return (capability.imageRuntimeInputKinds || []).some((kind) => imageInputKinds.has(kind));
}

function appServerImageRuntimeReady(capability?: ImageReferenceAppServerCapabilitySummary): boolean {
  if (!capability) return true;
  if (capability.readiness === "blocked") return false;
  if (capability.canUseImageRuntime === false || capability.imageRuntimeAvailable === false) return false;
  if (capability.generatedSchemaAvailable === false) return false;
  return true;
}

function interfaceKind(capability?: ImageReferenceActionCapabilitySummary): ImageReferenceInterfaceKind {
  if (!capability) return "unknown";
  if (capability.interfaceKind) return capability.interfaceKind;
  if (actionSupportsExplicitImageInput(capability)) return "explicit_image_input";
  if (capability.supportsPromptOnly === true || (capability.inputKinds || []).every((kind) => kind === "text" || kind === "prompt")) return "prompt_only";
  return "unknown";
}

function isPromptOnly(capability?: ImageReferenceActionCapabilitySummary): boolean {
  const kind = interfaceKind(capability);
  return kind === "prompt_only" || capability?.supportsPromptOnly === true;
}

function sourceStartFrameInput(request: Image2AdapterRequest): Image2ReferenceImageInput | undefined {
  return request.payload.referenceImageInputs.find(
    (input) =>
      input.role === "source_start_frame" &&
      input.source === "approved_start_frame" &&
      input.required === true &&
      input.mustUseAsVisualInput === true &&
      input.status === "available" &&
      Boolean(input.path?.trim()),
  );
}

function needsSourceStartFrame(request: Image2AdapterRequest): boolean {
  return request.operation === "image2image" || request.frameRole === "end_frame";
}

function pathMatchesReference(facts: SourceStartFrameFileFacts | undefined, input: Image2ReferenceImageInput | undefined, request: Image2AdapterRequest): boolean {
  if (!facts || !input) return false;
  const factPath = normalizePath(facts.path);
  const inputPath = normalizePath(input.path);
  const sourceStartFrameId = request.payload.sourceStartFrameId ? normalizePath(request.payload.sourceStartFrameId) : inputPath;
  return factPath === inputPath && sourceStartFrameId === inputPath;
}

function transportBlockers(input: BuildImageReferenceTransportInput, evidence: ImageReferenceTransportState["capabilityEvidence"]): string[] {
  const request = input.request;
  const sourceRequired = needsSourceStartFrame(request);
  const sourceInput = sourceStartFrameInput(request);
  const facts = input.sourceStartFrameFileFacts;
  const outputPath = input.outputSandbox.expectedOutputPath || request.payload.outputPath;

  return uniqueSorted([
    request.submitPolicy?.dry_run_only === true ? "" : "submit_policy_must_remain_dry_run_only",
    request.submitPolicy?.live_submit_forbidden === true ? "" : "live_submit_must_remain_forbidden",
    request.submitPolicy?.manual_submit_required === true ? "" : "manual_submit_must_remain_required",
    /seedance|jimeng/i.test(evidence.providerId || request.adapterId) ? "seedance_or_jimeng_transport_forbidden" : "",
    /fast|vip/i.test(`${input.actionCapability?.modelTier || ""} ${input.actionCapability?.modelLabel || ""}`) ? "fast_or_vip_transport_forbidden" : "",
    videoModes.has((evidence.requiredMode || "") as RequiredMode) || /video/i.test(evidence.providerSlot || "") ? "video_transport_forbidden" : "",
    evidence.requiredMode === "text2video" ? "text_to_video_transport_forbidden" : "",
    input.outputSandbox.outsideRootWriteAllowed === false ? "" : "outside_sandbox_write_forbidden",
    pathInsideSandbox(outputPath, input.outputSandbox) ? "" : "output_path_outside_sandbox",
    input.outputSandbox.manifestPath && !pathInsideSandbox(input.outputSandbox.manifestPath, input.outputSandbox) ? "manifest_path_outside_sandbox" : "",
    input.outputSandbox.qaReportPath && !pathInsideSandbox(input.outputSandbox.qaReportPath, input.outputSandbox) ? "qa_report_path_outside_sandbox" : "",
    evidence.promptOnly ? "prompt_only_image_edit_forbidden" : "",
    evidence.interfaceKind === "unknown" && !input.actionCapability ? "image_reference_transport_unavailable" : "",
    input.appServerCapability && !evidence.appServerImageRuntimeReady ? "image_runtime_unavailable" : "",
    sourceRequired && !evidence.actionSupportsExplicitImageInput ? "image_reference_transport_unavailable" : "",
    sourceRequired && input.appServerCapability && !evidence.appServerSupportsExplicitImageInput ? "app_server_explicit_image_input_unavailable" : "",
    sourceRequired && !Array.isArray(request.payload.referenceImageInputs) ? "reference_image_inputs_missing" : "",
    sourceRequired && request.payload.sourceStartFrameId && !sourceInput ? "source_start_frame_id_without_visual_input" : "",
    sourceRequired && !sourceInput ? "source_start_frame_visual_input_required" : "",
    sourceRequired && sourceInput && !facts ? "source_start_frame_file_facts_missing" : "",
    sourceRequired && facts && facts.status !== "available" ? "source_start_frame_file_unavailable" : "",
    sourceRequired && facts && !facts.hash?.trim() ? "source_start_frame_hash_missing" : "",
    sourceRequired && facts && !facts.mime?.startsWith("image/") ? "source_start_frame_mime_must_be_image" : "",
    sourceRequired && facts && (!facts.dimensions || facts.dimensions.width <= 0 || facts.dimensions.height <= 0)
      ? "source_start_frame_dimensions_missing"
      : "",
    sourceRequired && facts && sourceInput && !pathMatchesReference(facts, sourceInput, request) ? "source_start_frame_file_fact_mismatch" : "",
  ]);
}

export function buildImageReferenceTransport(input: BuildImageReferenceTransportInput): ImageReferenceTransportState {
  const actionSupportsImage = actionSupportsExplicitImageInput(input.actionCapability);
  const appSupportsImage = appServerSupportsExplicitImageInput(input.appServerCapability);
  const appRuntimeReady = appServerImageRuntimeReady(input.appServerCapability);
  const sourceInput = sourceStartFrameInput(input.request);
  const sourceRequired = needsSourceStartFrame(input.request);
  const kind = interfaceKind(input.actionCapability);
  const evidence: ImageReferenceTransportState["capabilityEvidence"] = {
    actionId: input.actionCapability?.actionId,
    providerId: input.actionCapability?.providerId,
    providerSlot: input.actionCapability?.providerSlot,
    requiredMode: input.actionCapability?.requiredMode,
    interfaceKind: kind,
    promptOnly: isPromptOnly(input.actionCapability),
    actionSupportsExplicitImageInput: actionSupportsImage,
    appServerImageRuntimeReady: appRuntimeReady,
    appServerSupportsExplicitImageInput: input.appServerCapability ? appSupportsImage : actionSupportsImage,
    supportedReferenceRoles: input.actionCapability?.referenceImageInputRoles || (actionSupportsImage ? ["source_start_frame"] : []),
  };
  const blockers = transportBlockers(input, evidence);
  const facts = input.sourceStartFrameFileFacts;
  const outputPath = input.outputSandbox.expectedOutputPath || input.request.payload.outputPath;

  return {
    schemaVersion: imageReferenceTransportSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "image_reference_transport_handoff",
    status: blockers.length ? "blocked" : "dispatch_ready",
    requestId: input.request.requestId,
    taskPlanId: input.request.taskPlanId,
    operation: input.request.operation,
    frameRole: input.request.frameRole,
    requiredSourceStartFrame: sourceRequired,
    sourceStartFrame:
      !blockers.length && sourceRequired && sourceInput && facts?.hash && facts.mime && facts.dimensions
        ? {
            inputId: sourceInput.inputId,
            path: sourceInput.path,
            hash: facts.hash,
            mime: facts.mime,
            dimensions: facts.dimensions,
            role: "source_start_frame",
            transportRole: "explicit_local_image_reference",
          }
        : undefined,
    capabilityEvidence: evidence,
    outputSandbox: {
      root: input.outputSandbox.root,
      expectedOutputPath: outputPath,
      manifestPath: input.outputSandbox.manifestPath,
      qaReportPath: input.outputSandbox.qaReportPath,
      scopedSandboxOnly: true,
      outsideRootWriteAllowed: false,
    },
    transportPolicy: {
      handoffOnly: true,
      dispatchSideEffectAllowed: false,
      providerSubmitAllowed: 0,
      canSubmitProvider: false,
      liveSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      providerSelfReportCanComplete: false,
      promptOnlyImageEditAllowed: false,
      seedanceOrJimengAllowed: false,
      videoAllowed: false,
      fastOrVipAllowed: false,
      textToVideoAllowed: false,
    },
    blockers,
    warnings: uniqueSorted([
      input.appServerCapability ? "" : "app_server_capability_summary_not_supplied",
      input.request.operation === "text2image" && sourceRequired === false ? "text2image_does_not_require_source_start_frame" : "",
    ]),
    notes: [
      "This builder is a pure Image Reference Transport/Handoff gate and performs no provider, network, CLI, or filesystem action.",
      "Dispatch-ready means explicit image-reference transport requirements are satisfied; provider submission remains forbidden here.",
      "Provider self-report cannot complete output in this transport state.",
    ],
  };
}
