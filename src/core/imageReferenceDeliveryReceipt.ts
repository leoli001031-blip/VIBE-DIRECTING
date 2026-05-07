import type { ImageReferenceTransportState } from "./imageReferenceTransport";

export const imageReferenceDeliveryReceiptSchemaVersion = "0.1.0";

export type ImageReferenceDeliveryReceiptStatus = "delivered" | "blocked";
export type ImageReferenceDeliveryPathScope =
  | "project"
  | "project_root"
  | "sandbox"
  | "allowed_prefix"
  | "import_scope"
  | "app_server_accessible"
  | "outside_scope"
  | "unknown";

export type ImageReferenceDeliveryInputKind =
  | "app_server_localImage"
  | "app_server_input_image"
  | "input_image"
  | "local_file"
  | "local_image"
  | "localImage"
  | "image_file"
  | "uploaded_file"
  | "prompt"
  | "prompt_only"
  | "prompt_text_only"
  | "text"
  | "text_only"
  | "unknown"
  | string;

export type ImageReferenceDeliveryTransportEvidence = Pick<
  ImageReferenceTransportState,
  | "status"
  | "requestId"
  | "taskPlanId"
  | "operation"
  | "frameRole"
  | "requiredSourceStartFrame"
  | "sourceStartFrame"
  | "transportPolicy"
  | "blockers"
>;

export interface ImageReferenceDeliverySourceFacts {
  inputId: string;
  path: string;
  sha256: string;
  mime: string;
  byteLength: number;
  dimensions: {
    width: number;
    height: number;
  };
  exists: boolean;
  readable: boolean;
  pathScope: ImageReferenceDeliveryPathScope;
}

export interface ImageReferenceDeliveryFacts {
  receiptId: string;
  requestId: string;
  taskPlanId: string;
  operation: ImageReferenceTransportState["operation"];
  frameRole?: ImageReferenceTransportState["frameRole"];
  deliveredInputKind: ImageReferenceDeliveryInputKind;
  actionSchemaParamName: string;
  acceptedByActionSchema: boolean;
  deliveredSha256: string;
  promptOnly: boolean;
  protocol: {
    threadId: string;
    turnId: string;
    toolCallId: string;
    actionId?: string;
    toolName?: string;
    toolSchemaHash?: string;
    generatedSchemaVersion?: string;
  };
  toolSchemaHash?: string;
  generatedSchemaVersion?: string;
}

export interface BuildImageReferenceDeliveryReceiptInput {
  generatedAt: string;
  transport: ImageReferenceDeliveryTransportEvidence;
  sourceStartFrameFileFacts?: ImageReferenceDeliverySourceFacts;
  delivery?: ImageReferenceDeliveryFacts;
}

export interface ImageReferenceDeliveryReceiptState {
  schemaVersion: typeof imageReferenceDeliveryReceiptSchemaVersion;
  generatedAt: string;
  phase: "image_reference_delivery_receipt";
  status: ImageReferenceDeliveryReceiptStatus;
  receiptId: string;
  requestId: string;
  taskPlanId: string;
  operation: ImageReferenceTransportState["operation"];
  frameRole?: ImageReferenceTransportState["frameRole"];
  requiredSourceStartFrame: boolean;
  sourceStartFrame?: ImageReferenceDeliverySourceFacts & {
    hash: string;
    role: "source_start_frame";
    transportRole: "explicit_local_image_reference";
  };
  delivery?: ImageReferenceDeliveryFacts;
  verification: {
    dispatchReady: boolean;
    requestMatchedTransport: boolean;
    sourceReceiptMatchedTransport: boolean;
    deliveredBytesMatchedSource: boolean;
    acceptedByActionSchema: boolean;
    protocolBindingPresent: boolean;
    explicitImageInput: boolean;
    promptOnly: boolean;
  };
  schemaEvidence: {
    toolSchemaHash?: string;
    generatedSchemaVersion?: string;
    actionSchemaParamName?: string;
  };
  transportPolicy: {
    receiptOnly: true;
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
  deliveryPolicy: {
    sideEffectAllowed: false;
    providerSubmitAllowed: 0;
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

const explicitImageKinds = new Set([
  "app_server_localImage",
  "app_server_input_image",
  "input_image",
  "local_file",
  "local_image",
  "localImage",
  "image_file",
  "uploaded_file",
]);
const promptOnlyKinds = new Set(["prompt", "prompt_only", "prompt_text_only", "text", "text_only"]);
const allowedPathScopes = new Set(["project", "project_root", "sandbox", "allowed_prefix", "import_scope", "app_server_accessible"]);

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function pathsMatch(left?: string, right?: string): boolean {
  return Boolean(left && right && normalizePath(left) === normalizePath(right));
}

function requestMatchesTransport(input: BuildImageReferenceDeliveryReceiptInput): boolean {
  const delivery = input.delivery;
  if (!delivery) return false;
  return (
    delivery.requestId === input.transport.requestId &&
    delivery.taskPlanId === input.transport.taskPlanId &&
    delivery.operation === input.transport.operation
  );
}

function sourceMatchesTransport(input: BuildImageReferenceDeliveryReceiptInput): boolean {
  const source = input.sourceStartFrameFileFacts;
  const transportSource = input.transport.sourceStartFrame;
  if (!source || !transportSource) return false;
  return (
    source.inputId === transportSource.inputId &&
    pathsMatch(source.path, transportSource.path) &&
    source.sha256 === transportSource.hash &&
    source.mime === transportSource.mime &&
    source.dimensions.width === transportSource.dimensions.width &&
    source.dimensions.height === transportSource.dimensions.height
  );
}

function schemaEvidence(delivery: ImageReferenceDeliveryFacts | undefined): { toolSchemaHash?: string; generatedSchemaVersion?: string } {
  return {
    toolSchemaHash: delivery?.toolSchemaHash || delivery?.protocol.toolSchemaHash,
    generatedSchemaVersion: delivery?.generatedSchemaVersion || delivery?.protocol.generatedSchemaVersion,
  };
}

function transportPolicyBlockers(transport: ImageReferenceDeliveryTransportEvidence): string[] {
  const policy = transport.transportPolicy;
  return uniqueSorted([
    policy?.handoffOnly === true ? "" : "image_reference_transport_handoff_policy_missing",
    policy?.providerSubmitAllowed === 0 ? "" : "image_reference_delivery_must_not_allow_provider_submit",
    policy?.canSubmitProvider === false ? "" : "image_reference_delivery_must_not_expose_provider_submit",
    policy?.liveSubmitAllowed === false ? "" : "image_reference_delivery_must_forbid_live_submit",
    policy?.externalNetworkIoAllowed === false ? "" : "image_reference_delivery_must_forbid_external_network_io",
    policy?.providerSelfReportCanComplete === false ? "" : "image_reference_delivery_must_ignore_provider_self_report",
    policy?.promptOnlyImageEditAllowed === false ? "" : "image_reference_delivery_must_forbid_prompt_only_image_edit",
    policy?.seedanceOrJimengAllowed === false ? "" : "image_reference_delivery_must_forbid_seedance_or_jimeng",
    policy?.videoAllowed === false ? "" : "image_reference_delivery_must_forbid_video",
    policy?.fastOrVipAllowed === false ? "" : "image_reference_delivery_must_forbid_fast_or_vip",
    policy?.textToVideoAllowed === false ? "" : "image_reference_delivery_must_forbid_text_to_video",
  ]);
}

function deliveryBlockers(input: BuildImageReferenceDeliveryReceiptInput): string[] {
  const transport = input.transport;
  const source = input.sourceStartFrameFileFacts;
  const delivery = input.delivery;
  const evidence = schemaEvidence(delivery);

  return uniqueSorted([
    transport.status === "dispatch_ready" ? "" : "image_reference_transport_must_be_dispatch_ready",
    transport.requiredSourceStartFrame === true ? "" : "source_start_frame_delivery_requires_source_start_frame",
    transport.sourceStartFrame ? "" : "transport_source_start_frame_receipt_missing",
    delivery ? "" : "image_reference_delivery_facts_missing",
    nonEmpty(delivery?.receiptId) ? "" : "image_reference_delivery_receipt_id_missing",
    nonEmpty(delivery?.requestId) ? "" : "image_reference_delivery_request_id_missing",
    nonEmpty(delivery?.taskPlanId) ? "" : "image_reference_delivery_task_plan_id_missing",
    delivery?.operation ? "" : "image_reference_delivery_operation_missing",
    requestMatchesTransport(input) ? "" : "image_reference_delivery_request_task_operation_must_match_transport",
    source ? "" : "source_start_frame_delivery_file_facts_missing",
    nonEmpty(source?.inputId) ? "" : "source_start_frame_delivery_input_id_missing",
    nonEmpty(source?.path) ? "" : "source_start_frame_delivery_path_missing",
    nonEmpty(source?.sha256) ? "" : "source_start_frame_delivery_sha256_missing",
    source?.mime?.startsWith("image/") ? "" : "source_start_frame_delivery_mime_must_be_image",
    source && source.byteLength > 0 ? "" : "source_start_frame_delivery_byte_length_missing",
    source && source.dimensions.width > 0 && source.dimensions.height > 0 ? "" : "source_start_frame_delivery_dimensions_missing",
    source?.exists === true ? "" : "source_start_frame_delivery_file_must_exist",
    source?.readable === true ? "" : "source_start_frame_delivery_file_must_be_readable",
    source && allowedPathScopes.has(source.pathScope) ? "" : "source_start_frame_delivery_path_scope_invalid",
    sourceMatchesTransport(input) ? "" : "source_start_frame_delivery_must_match_transport_receipt",
    delivery && explicitImageKinds.has(delivery.deliveredInputKind) ? "" : "image_reference_delivery_input_kind_must_be_explicit_image",
    delivery && promptOnlyKinds.has(delivery.deliveredInputKind) ? "prompt_only_delivery_forbidden" : "",
    delivery?.actionSchemaParamName?.trim() ? "" : "image_reference_delivery_action_schema_param_missing",
    delivery?.acceptedByActionSchema === true ? "" : "image_reference_delivery_must_be_accepted_by_action_schema",
    delivery?.deliveredSha256 && source?.sha256 && delivery.deliveredSha256 === source.sha256
      ? ""
      : "image_reference_delivery_sha256_must_match_source",
    delivery?.promptOnly === false ? "" : "image_reference_delivery_prompt_only_must_be_false",
    delivery?.protocol.threadId?.trim() ? "" : "image_reference_delivery_thread_id_missing",
    delivery?.protocol.turnId?.trim() ? "" : "image_reference_delivery_turn_id_missing",
    delivery?.protocol.toolCallId?.trim() ? "" : "image_reference_delivery_tool_call_id_missing",
    evidence.toolSchemaHash?.trim() || evidence.generatedSchemaVersion?.trim() ? "" : "image_reference_delivery_schema_evidence_missing",
    ...(transport.blockers || []).map((blocker) => (blocker ? `image_reference_transport_blocker:${blocker}` : "")),
    ...transportPolicyBlockers(transport),
  ]);
}

function normalizeDelivery(delivery: ImageReferenceDeliveryFacts | undefined): ImageReferenceDeliveryFacts | undefined {
  if (!delivery) return undefined;
  const evidence = schemaEvidence(delivery);
  return {
    ...delivery,
    protocol: {
      ...delivery.protocol,
      toolSchemaHash: evidence.toolSchemaHash,
      generatedSchemaVersion: evidence.generatedSchemaVersion,
    },
  };
}

export function buildImageReferenceDeliveryReceipt(input: BuildImageReferenceDeliveryReceiptInput): ImageReferenceDeliveryReceiptState {
  const blockers = deliveryBlockers(input);
  const source = input.sourceStartFrameFileFacts;
  const delivery = normalizeDelivery(input.delivery);
  const explicitImageInput = Boolean(delivery && explicitImageKinds.has(delivery.deliveredInputKind));
  const evidence = schemaEvidence(delivery);

  return {
    schemaVersion: imageReferenceDeliveryReceiptSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "image_reference_delivery_receipt",
    status: blockers.length ? "blocked" : "delivered",
    receiptId: delivery?.receiptId || "missing_image_reference_delivery_receipt",
    requestId: delivery?.requestId || input.transport.requestId,
    taskPlanId: delivery?.taskPlanId || input.transport.taskPlanId,
    operation: delivery?.operation || input.transport.operation,
    frameRole: delivery?.frameRole || input.transport.frameRole,
    requiredSourceStartFrame: input.transport.requiredSourceStartFrame,
    sourceStartFrame: source
      ? {
          ...source,
          hash: source.sha256,
          role: "source_start_frame",
          transportRole: "explicit_local_image_reference",
        }
      : undefined,
    delivery,
    verification: {
      dispatchReady: input.transport.status === "dispatch_ready",
      requestMatchedTransport: requestMatchesTransport(input),
      sourceReceiptMatchedTransport: sourceMatchesTransport(input),
      deliveredBytesMatchedSource: Boolean(source && delivery && delivery.deliveredSha256 === source.sha256),
      acceptedByActionSchema: delivery?.acceptedByActionSchema === true,
      protocolBindingPresent: Boolean(delivery?.protocol.threadId && delivery.protocol.turnId && delivery.protocol.toolCallId),
      explicitImageInput,
      promptOnly: delivery?.promptOnly !== false || Boolean(delivery && promptOnlyKinds.has(delivery.deliveredInputKind)),
    },
    schemaEvidence: {
      toolSchemaHash: evidence.toolSchemaHash,
      generatedSchemaVersion: evidence.generatedSchemaVersion,
      actionSchemaParamName: delivery?.actionSchemaParamName,
    },
    transportPolicy: {
      receiptOnly: true,
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
    deliveryPolicy: {
      sideEffectAllowed: false,
      providerSubmitAllowed: 0,
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
      input.transport.frameRole !== "end_frame" ? "delivery_receipt_is_required_for_image2image_even_when_frame_role_is_not_end_frame" : "",
      evidence.toolSchemaHash ? "" : "tool_schema_hash_not_supplied_using_generated_schema_version",
      evidence.generatedSchemaVersion ? "" : "generated_schema_version_not_supplied_using_tool_schema_hash",
    ]),
    notes: [
      "This receipt verifies a local image/input_image delivery binding shape only; it performs no app-server launch, provider submit, network I/O, or filesystem action.",
      "Watcher output evidence cannot substitute for this input delivery receipt.",
      "A real app-server integration must replace this dry receipt with a protocol receipt carrying the same source hash and thread/turn/tool binding.",
    ],
  };
}
