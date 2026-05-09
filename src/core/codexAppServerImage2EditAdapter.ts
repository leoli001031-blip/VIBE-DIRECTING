export const codexAppServerImage2EditAdapterSchemaVersion = "0.1.0";
export const codexAppServerImage2EditAdapterId = "codex-app-server-image2-edit-adapter";

export type CodexAppServerImage2EditOperation = "image.edit" | "image2image";
export type CodexAppServerImage2EditStatus = "prepared" | "blocked";
export type CodexAppServerImage2EditVisualInputKind =
  | "app_server_localImage"
  | "app_server_input_image"
  | "input_image"
  | "local_file"
  | "local_image"
  | "localImage"
  | "image_file"
  | "uploaded_file"
  | "reference_image"
  | string;

export interface CodexAppServerImage2EditReferenceAttachmentReceipt {
  schemaVersion: typeof codexAppServerImage2EditAdapterSchemaVersion;
  receiptKind: "codex_app_server_image2_edit_reference_attachment";
  status: CodexAppServerImage2EditStatus;
  receiptSource: "prepared_skeleton_from_preflight_sidecars" | "validated_preflight_receipt";
  deliveredInputKind: CodexAppServerImage2EditVisualInputKind;
  visualInputRequired: true;
  promptOnly: false;
  acceptedByActionSchema: true;
  deliveredSha256: string;
  sourceStartFrameSha256: string;
  sourceStartFrameAttachmentId: string;
  actualAppServerSubmission: false;
  providerSubmitted: false;
  verification: {
    deliveredInputKindIsVisual: boolean;
    deliveredSha256MatchesSource: boolean;
    attachmentIdMatchesSource: boolean;
    promptOnlyFalse: boolean;
    acceptedByActionSchema: boolean;
  };
  blockers: string[];
}

export interface CodexAppServerImage2EditRequestPacket {
  schemaVersion: typeof codexAppServerImage2EditAdapterSchemaVersion;
  adapterId: typeof codexAppServerImage2EditAdapterId;
  requestId: string;
  status: "prepared";
  transport: "codex_app_server_or_cli_image_edit_packet";
  shotId: string;
  runRoot: string;
  operation: CodexAppServerImage2EditOperation;
  sourceStartFrame: {
    path: string;
    sourceStartFrameSha256: string;
    sourceStartFrameAttachmentId: string;
    referenceImageInputs: Array<{
      inputId: string;
      role: "source_start_frame";
      source: "approved_start_frame";
      path: string;
      sha256: string;
      attachmentId: string;
      required: true;
      mustUseAsVisualInput: true;
      status: "available";
    }>;
  };
  editableEvidence: {
    evidencePath?: string;
    evidenceSha256?: string;
    bboxNormalized?: unknown;
    maskPath?: string;
    sourceStartFrameSha256: string;
  };
  expectedOutputPath: string;
  referenceAttachmentReceipt: CodexAppServerImage2EditReferenceAttachmentReceipt;
  submitPolicy: {
    defaultSubmitAllowed: false;
    dryRunOnly: true;
    manualSubmitRequired: true;
    liveSubmitAllowed: false;
    liveSubmitRequiresExplicitFutureGate: true;
    appServerSchemaRequiredBeforeSubmit: true;
    statusMayOnlyBePreparedOrBlocked: true;
  };
  forbiddenFallbacks: Array<
    | "prompt_only_image_edit"
    | "path_in_prompt_image_reference"
    | "image_path_prompt_fallback"
    | "provider_self_report_completion"
    | "text2image_fallback"
    | "independent_end_frame_generation"
    | "live_submit_without_future_gate"
  >;
  outputContract: {
    expectedOutputPath: string;
    providerSelfReportCanComplete: false;
    mustReturnOutputSha256: true;
    mustReturnProviderRequestId: true;
  };
}

export interface CodexAppServerImage2EditAdapterInput {
  generatedAt: string;
  shotId: string;
  runRoot: string;
  approvedStartFrameRef?: unknown;
  editableRegionEvidence?: unknown;
  providerEditReceipt?: unknown;
  expectedOutputPath?: string;
  requestPrompt?: unknown;
  liveSubmitRequested?: boolean;
  futureLiveSubmitGate?: {
    status?: "enabled" | "disabled" | "blocked" | string;
    gateId?: string;
  };
  providerSelfReportedComplete?: boolean;
}

export interface CodexAppServerImage2EditAdapterState {
  schemaVersion: typeof codexAppServerImage2EditAdapterSchemaVersion;
  adapterId: typeof codexAppServerImage2EditAdapterId;
  generatedAt: string;
  phase: "codex_app_server_image2_edit_transport_packet";
  status: CodexAppServerImage2EditStatus;
  shotId: string;
  runRoot: string;
  requestPacket?: CodexAppServerImage2EditRequestPacket;
  referenceAttachmentReceipt?: CodexAppServerImage2EditReferenceAttachmentReceipt;
  policy: {
    providerCalled: false;
    actualImage2Triggered: false;
    liveSubmitAllowed: false;
    externalNetworkIoAllowed: false;
    promptOnlyAllowed: false;
    pathInPromptFallbackAllowed: false;
    providerSelfReportCanComplete: false;
    statusMayOnlyBePreparedOrBlocked: true;
  };
  sidecarEvidence: {
    approvedStartFrameRefPresent: boolean;
    editableRegionEvidencePresent: boolean;
    providerEditReceiptPresent: boolean;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

const visualInputKinds = new Set([
  "app_server_localimage",
  "app_server_input_image",
  "input_image",
  "local_file",
  "local_image",
  "localimage",
  "image_file",
  "uploaded_file",
  "reference_image",
]);
const promptOnlyKinds = new Set(["prompt", "prompt_only", "prompt_text_only", "text", "text_only"]);
const strictEditOperations = new Set(["image.edit", "image2image"]);
const readyReceiptStatuses = new Set(["ready_for_provider_edit", "prepared"]);
const readyRegionStatuses = new Set(["pass", "ready"]);
const approvedStartStatuses = new Set(["approved", "approved_for_strict_edit"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function joinRunPath(runRoot: string, childPath: string): string {
  if (!childPath) return normalizePath(runRoot);
  if (/^(?:\/|[A-Za-z]:[\\/])/.test(childPath)) return normalizePath(childPath);
  return normalizePath(`${runRoot}/${childPath}`);
}

function sourceSha(approved: Record<string, unknown> | undefined): string | undefined {
  return asString(approved?.sourceStartFrameSha256) || asString(approved?.sha256);
}

function editableReady(editable: Record<string, unknown> | undefined): boolean {
  return Boolean(
    editable &&
      (readyRegionStatuses.has(normalizeStatus(editable.qaStatus)) || readyRegionStatuses.has(normalizeStatus(editable.status))) &&
      (isRecord(editable.bboxNormalized) || asString(editable.maskPath) || asString(editable.maskImagePath)),
  );
}

function textMentionsImagePath(value: unknown): boolean {
  if (typeof value === "string") {
    return /(?:^|\s|["'(])(?:file:\/\/|\/Users\/|[A-Za-z]:[\\/]|\.{1,2}\/|[\w.-]+\/)[^\s"'()]+\.(?:png|jpe?g|webp|gif|tiff?)(?:$|\s|["')])/i.test(value);
  }
  if (Array.isArray(value)) return value.some(textMentionsImagePath);
  if (isRecord(value)) return Object.values(value).some(textMentionsImagePath);
  return false;
}

function promptFields(input: CodexAppServerImage2EditAdapterInput, providerEditReceipt: Record<string, unknown> | undefined): unknown[] {
  return [
    input.requestPrompt,
    providerEditReceipt?.prompt,
    providerEditReceipt?.promptText,
    providerEditReceipt?.requestPrompt,
    providerEditReceipt?.finalPrompt,
    providerEditReceipt?.instructions,
  ];
}

function referenceAttachmentReceiptSource(providerEditReceipt: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!providerEditReceipt) return undefined;
  for (const key of [
    "referenceAttachmentReceipt",
    "sourceStartFrameAttachmentReceipt",
    "imageReferenceDeliveryReceipt",
    "uploadReceipt",
  ]) {
    const value = providerEditReceipt[key];
    if (isRecord(value)) return value;
  }
  return undefined;
}

function deliveredInputKind(providerEditReceipt: Record<string, unknown> | undefined, receiptSource: Record<string, unknown> | undefined): string {
  return asString(receiptSource?.deliveredInputKind) ||
    asString(receiptSource?.inputKind) ||
    asString(providerEditReceipt?.deliveredInputKind) ||
    "local_file";
}

function buildReferenceAttachmentReceipt(input: {
  providerEditReceipt?: Record<string, unknown>;
  sourceStartFrameSha256?: string;
  sourceStartFrameAttachmentId?: string;
  inheritedBlockers: string[];
}): CodexAppServerImage2EditReferenceAttachmentReceipt | undefined {
  if (!input.providerEditReceipt || !input.sourceStartFrameSha256 || !input.sourceStartFrameAttachmentId) return undefined;

  const source = referenceAttachmentReceiptSource(input.providerEditReceipt);
  const kind = deliveredInputKind(input.providerEditReceipt, source);
  const normalizedKind = kind.toLowerCase();
  const deliveredSha256 = asString(source?.deliveredSha256) ||
    asString(source?.sourceStartFrameSha256) ||
    asString(source?.inputSha256) ||
    asString(source?.sha256) ||
    input.sourceStartFrameSha256;
  const attachmentId = asString(source?.sourceStartFrameAttachmentId) ||
    asString(source?.attachmentId) ||
    asString(source?.inputId) ||
    input.sourceStartFrameAttachmentId;
  const acceptedByActionSchema = source ? source.acceptedByActionSchema === true : true;
  const promptOnly = source ? source.promptOnly !== false : false;
  const blockers = uniqueSorted([
    ...input.inheritedBlockers,
    visualInputKinds.has(normalizedKind) ? "" : "reference_attachment_input_kind_not_visual",
    promptOnlyKinds.has(normalizedKind) ? "prompt_only_image_edit_forbidden" : "",
    promptOnly === false ? "" : "reference_attachment_prompt_only_not_false",
    acceptedByActionSchema ? "" : "reference_attachment_schema_not_accepted",
    deliveredSha256 === input.sourceStartFrameSha256 ? "" : "reference_attachment_sha_mismatch",
    attachmentId === input.sourceStartFrameAttachmentId ? "" : "reference_attachment_id_mismatch",
  ]);

  return {
    schemaVersion: codexAppServerImage2EditAdapterSchemaVersion,
    receiptKind: "codex_app_server_image2_edit_reference_attachment",
    status: blockers.length ? "blocked" : "prepared",
    receiptSource: source ? "validated_preflight_receipt" : "prepared_skeleton_from_preflight_sidecars",
    deliveredInputKind: kind,
    visualInputRequired: true,
    promptOnly: false,
    acceptedByActionSchema: true,
    deliveredSha256,
    sourceStartFrameSha256: input.sourceStartFrameSha256,
    sourceStartFrameAttachmentId: input.sourceStartFrameAttachmentId,
    actualAppServerSubmission: false,
    providerSubmitted: false,
    verification: {
      deliveredInputKindIsVisual: visualInputKinds.has(normalizedKind),
      deliveredSha256MatchesSource: deliveredSha256 === input.sourceStartFrameSha256,
      attachmentIdMatchesSource: attachmentId === input.sourceStartFrameAttachmentId,
      promptOnlyFalse: promptOnly === false,
      acceptedByActionSchema,
    },
    blockers,
  };
}

export function buildCodexAppServerImage2EditAdapterState(
  input: CodexAppServerImage2EditAdapterInput,
): CodexAppServerImage2EditAdapterState {
  const approved = isRecord(input.approvedStartFrameRef) ? input.approvedStartFrameRef : undefined;
  const editable = isRecord(input.editableRegionEvidence) ? input.editableRegionEvidence : undefined;
  const providerEditReceipt = isRecord(input.providerEditReceipt) ? input.providerEditReceipt : undefined;
  const sha = sourceSha(approved);
  const startFramePath = asString(approved?.startFramePath) || asString(providerEditReceipt?.sourceStartFramePath);
  const attachmentId = asString(approved?.providerAttachmentId) || asString(providerEditReceipt?.sourceStartFrameAttachmentId);
  const operation = normalizeStatus(providerEditReceipt?.operation) as CodexAppServerImage2EditOperation;
  const expectedOutputPath = input.expectedOutputPath || joinRunPath(input.runRoot, `shots/${input.shotId}/end.png`);
  const futureGatePresent = input.futureLiveSubmitGate?.status === "enabled" && Boolean(input.futureLiveSubmitGate.gateId);

  const sidecarBlockers = uniqueSorted([
    input.shotId ? "" : "shot_id_missing",
    input.runRoot ? "" : "run_root_missing",
    approved ? "" : "approved_start_frame_ref_missing",
    editable ? "" : "editable_region_mask_or_bbox_missing",
    providerEditReceipt ? "" : "provider_edit_receipt_missing",
    approved && normalizeStatus(approved.approvalStatus) && approvedStartStatuses.has(normalizeStatus(approved.approvalStatus))
      ? ""
      : "approved_start_attachment_missing",
    startFramePath ? "" : "source_start_frame_path_missing",
    sha ? "" : "source_start_frame_sha_missing",
    attachmentId ? "" : "source_start_frame_attachment_id_missing",
    editableReady(editable) ? "" : "editable_region_mask_or_bbox_missing",
    editable?.sourceStartFrameSha256 === sha ? "" : "editable_region_source_sha_mismatch",
    providerEditReceipt && readyReceiptStatuses.has(normalizeStatus(providerEditReceipt.status)) ? "" : "provider_edit_receipt_missing",
    strictEditOperations.has(operation) ? "" : "operation_must_be_image_edit_or_image2image",
    providerEditReceipt?.sourceStartFrameSha256 === sha ? "" : "source_sha_mismatch",
    providerEditReceipt?.sourceStartFrameAttachmentId === attachmentId ? "" : "source_start_frame_attachment_id_mismatch",
    providerEditReceipt?.noFallbackUsed === true ? "" : "no_fallback_evidence_missing",
    providerEditReceipt?.providerCalled === true || providerEditReceipt?.actualImage2Triggered === true
      ? "preflight_receipt_must_not_claim_provider_submit"
      : "",
    providerEditReceipt?.providerSelfReportedComplete === true || input.providerSelfReportedComplete === true
      ? "provider_self_report_completion_forbidden"
      : "",
    input.liveSubmitRequested === true && !futureGatePresent ? "live_submit_requires_explicit_future_gate" : "",
    textMentionsImagePath(promptFields(input, providerEditReceipt)) ? "path_in_prompt_without_reference_attachment" : "",
    textMentionsImagePath(promptFields(input, providerEditReceipt)) ? "path_in_prompt_fallback_forbidden" : "",
  ]);

  const receipt = buildReferenceAttachmentReceipt({
    providerEditReceipt,
    sourceStartFrameSha256: sha,
    sourceStartFrameAttachmentId: attachmentId,
    inheritedBlockers: sidecarBlockers,
  });
  const blockers = uniqueSorted([
    ...sidecarBlockers,
    ...(receipt?.blockers || []),
    receipt ? "" : "reference_attachment_receipt_missing",
    receipt && receipt.status === "prepared" ? "" : "reference_attachment_receipt_blocked",
  ]);

  const sourcePath = startFramePath ? joinRunPath(input.runRoot, startFramePath) : "";
  const requestPacket: CodexAppServerImage2EditRequestPacket | undefined = blockers.length === 0 && receipt && sha && attachmentId && startFramePath
    ? {
        schemaVersion: codexAppServerImage2EditAdapterSchemaVersion,
        adapterId: codexAppServerImage2EditAdapterId,
        requestId: `codex_app_server_image2_edit_${input.shotId}_${sha.replace(/^sha256:/, "").slice(0, 12)}`,
        status: "prepared",
        transport: "codex_app_server_or_cli_image_edit_packet",
        shotId: input.shotId,
        runRoot: normalizePath(input.runRoot),
        operation,
        sourceStartFrame: {
          path: sourcePath,
          sourceStartFrameSha256: sha,
          sourceStartFrameAttachmentId: attachmentId,
          referenceImageInputs: [
            {
              inputId: `source_start_frame_${input.shotId}`,
              role: "source_start_frame",
              source: "approved_start_frame",
              path: sourcePath,
              sha256: sha,
              attachmentId,
              required: true,
              mustUseAsVisualInput: true,
              status: "available",
            },
          ],
        },
        editableEvidence: {
          evidencePath: asString(editable?.evidencePath),
          evidenceSha256: asString(editable?.evidenceSha256),
          bboxNormalized: editable?.bboxNormalized,
          maskPath: asString(editable?.maskPath) || asString(editable?.maskImagePath),
          sourceStartFrameSha256: sha,
        },
        expectedOutputPath: normalizePath(expectedOutputPath),
        referenceAttachmentReceipt: receipt,
        submitPolicy: {
          defaultSubmitAllowed: false,
          dryRunOnly: true,
          manualSubmitRequired: true,
          liveSubmitAllowed: false,
          liveSubmitRequiresExplicitFutureGate: true,
          appServerSchemaRequiredBeforeSubmit: true,
          statusMayOnlyBePreparedOrBlocked: true,
        },
        forbiddenFallbacks: [
          "prompt_only_image_edit",
          "path_in_prompt_image_reference",
          "image_path_prompt_fallback",
          "provider_self_report_completion",
          "text2image_fallback",
          "independent_end_frame_generation",
          "live_submit_without_future_gate",
        ],
        outputContract: {
          expectedOutputPath: normalizePath(expectedOutputPath),
          providerSelfReportCanComplete: false,
          mustReturnOutputSha256: true,
          mustReturnProviderRequestId: true,
        },
      }
    : undefined;

  return {
    schemaVersion: codexAppServerImage2EditAdapterSchemaVersion,
    adapterId: codexAppServerImage2EditAdapterId,
    generatedAt: input.generatedAt,
    phase: "codex_app_server_image2_edit_transport_packet",
    status: requestPacket ? "prepared" : "blocked",
    shotId: input.shotId,
    runRoot: normalizePath(input.runRoot),
    requestPacket,
    referenceAttachmentReceipt: receipt,
    policy: {
      providerCalled: false,
      actualImage2Triggered: false,
      liveSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      promptOnlyAllowed: false,
      pathInPromptFallbackAllowed: false,
      providerSelfReportCanComplete: false,
      statusMayOnlyBePreparedOrBlocked: true,
    },
    sidecarEvidence: {
      approvedStartFrameRefPresent: Boolean(approved),
      editableRegionEvidencePresent: Boolean(editable),
      providerEditReceiptPresent: Boolean(providerEditReceipt),
    },
    blockers,
    warnings: uniqueSorted([
      receipt?.receiptSource === "prepared_skeleton_from_preflight_sidecars"
        ? "reference_attachment_receipt_is_prepared_skeleton_until_real_app_server_schema_exists"
        : "",
      futureGatePresent ? "future_live_submit_gate_present_but_this_adapter_still_emits_prepared_packet_only" : "",
    ]),
    notes: [
      "This adapter only prepares a hash-bound Image2 edit packet; it performs no app-server launch, network I/O, upload, or provider submit.",
      "Prepared status is not submitted status. A future app-server schema must replace the skeleton receipt before live transport can be enabled.",
      "Provider self-report cannot complete the output contract; returned output must carry providerRequestId and output sha evidence.",
    ],
  };
}
