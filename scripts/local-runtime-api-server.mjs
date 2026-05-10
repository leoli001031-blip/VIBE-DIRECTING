import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2ForbiddenProviders,
  currentProjectImage2TransportModes,
  normalizeCurrentProjectImage2TransportMode,
} from "./current-project-image2-transport-contract.mjs";
import { createRuntimeApiBoundary } from "./runtime-api-boundary.mjs";
import { createRuntimeApiCurrentProjectBinding } from "./runtime-api-current-project-binding.mjs";
import { createRuntimeApiFileServing } from "./runtime-api-file-serving.mjs";
import { createRuntimeApiWorkbenchProjection } from "./runtime-api-workbench-projection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const repoRootRealPath = realpathSync(repoRoot);
const host = process.env.VIBE_CORE_RUNTIME_API_HOST || "127.0.0.1";
const port = Number(process.env.VIBE_CORE_RUNTIME_API_PORT || 8790);
const sandboxRunRootRelativePath = "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames";
const sandboxProjectVibeRelativePath = `${sandboxRunRootRelativePath}/project/project.vibe`;
const sandboxReportRelativePath = `${sandboxRunRootRelativePath}/reports/image2_start_long_chain_report.json`;
const verifyScript = path.join(repoRoot, "scripts/real-demo-e2e-005-anime-image2-start-verify.mjs");
const maxOutputChars = 8000;
const round5FullRealChainReportFileName = "round5_full_real_chain_report.json";
const round5ArtifactIngestSchemaVersion = "0.1.0";
const round5EndFrameBlockers = [
  "approved_start_attachment_missing",
  "strict_image_edit_provenance_missing",
  "provider_edit_receipt_missing",
  "source_start_frame_attachment_id_missing",
  "source_start_frame_sha_not_provider_confirmed",
  "editable_region_mask_or_bbox_missing",
];
const round5ArtifactIsolationFlags = {
  mainThreadImageBytesForbidden: true,
  sidecarOnlyImageTransport: true,
  noProjectVibeMutation: true,
};
const round5StrictEditSidecarFileNames = {
  approvedStartFrame: "approved_start_frame_ref.json",
  editableRegionEvidence: "editable_region_mask_or_bbox.json",
  providerEditReceipt: "provider_edit_receipt.json",
  endProviderObservation: "end_provider_observation.json",
  endSemanticQa: "end_semantic_qa.json",
  endPairQa: "end_pair_qa.json",
};

const runtimeBasePath = "/api/runtime";
const currentProjectBindingEndpoint = `${runtimeBasePath}/projects/current`;
const currentProjectSelectEndpoint = `${runtimeBasePath}/projects/select`;
const currentProjectRecentEndpoint = `${runtimeBasePath}/projects/recent`;
const currentProjectStatusEndpoint = `${runtimeBasePath}/projects/current/real-chain/status`;
const currentProjectRunEndpoint = `${runtimeBasePath}/projects/current/real-chain/run-check`;
const currentProjectImage2BatchPlanEndpoint = `${runtimeBasePath}/projects/current/image2-batch/plan`;
const currentProjectImage2BatchRunCheckEndpoint = `${runtimeBasePath}/projects/current/image2-batch/run-check`;
const currentProjectImage2OneShotStatusEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/status`;
const currentProjectImage2OneShotPrepareEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/prepare`;
const currentProjectImage2OneShotConfirmEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/confirm`;
const currentProjectImage2OneShotPrepareTriggerEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/prepare-trigger`;
const currentProjectImage2OneShotExecuteMockEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-mock`;
const currentProjectImage2OneShotReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/return`;
const currentProjectImage2OneShotExecuteReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-return`;
const currentProjectRound5StrictEditPrepareEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/prepare`;
const currentProjectRound5StrictEditReturnEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/return`;
const realDemo005StatusEndpoint = `${runtimeBasePath}/real-demo-e2e/005/status`;
const realDemo005RunEndpoint = `${runtimeBasePath}/real-demo-e2e/005/run`;
const runtimeFileEndpoint = `${runtimeBasePath}/files`;
const legacyStatusEndpoint = "/api/real-demo-e2e/005/status";
const legacyRunEndpoint = "/api/real-demo-e2e/005/run";
const knownProjectFixtureRoots = [
  "real-test-sandbox/real-demo-e2e/004-image2-start-frames",
  "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames",
  "real-test-sandbox/real-demo-e2e/003-long-chain-software",
  "real-test-sandbox/real-demo-e2e/002-anime-pressure",
  "real-test-sandbox/real-demo-e2e/001",
];

let running = false;

const {
  contentTypeFor,
  corsHeaders,
  isTrustedLocalOrigin,
  normalizeRelativePath,
  pathWithinRoot,
  repoRelativePath,
  resolveRepoInputPath,
  runtimePathExists,
  runtimePolicy,
  runtimeRelativeFromValue,
  runtimeRequestSecurity,
  scopedRepoPath,
  writeRuntimeFileError,
} = createRuntimeApiBoundary({
  repoRoot,
  repoRootRealPath,
  runtimeBasePath,
  runtimeToken: () => process.env.VIBE_CORE_RUNTIME_API_TOKEN || "",
  legacyRunEnabled: () => process.env.VIBE_CORE_ENABLE_LEGACY_RUN === "1",
});

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return undefined;
  try {
    return readJson(filePath);
  } catch {
    return undefined;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const {
  currentProjectBindingPath,
  readCurrentProjectBinding,
  validateSelectableProjectRoot,
  writeCurrentProjectBinding,
  resolveProjectSource,
  realDemo005Source,
  currentProjectSource,
  readProjectVibe,
  projectIdentityFromSource,
  projectChoiceTitle,
  projectChoiceUpdatedAt,
  projectChoiceFromSource,
  currentProjectRecentResponse,
  currentProjectSourceResult,
  requestOverrideDiagnostics,
  blockedCurrentProjectResponse,
  unboundCurrentProjectResponse,
  currentProjectBindingStatusResponse,
  selectCurrentProjectBindingResponse,
} = createRuntimeApiCurrentProjectBinding({
  repoRoot,
  sandboxRunRootRelativePath,
  knownProjectFixtureRoots,
  round5FullRealChainReportFileName,
  currentProjectBindingEndpoint,
  currentProjectSelectEndpoint,
  currentProjectRecentEndpoint,
  currentProjectBindingPathInput: () => process.env.VIBE_CORE_CURRENT_PROJECT_BINDING_PATH,
  currentProjectReportPathInput: () => process.env.VIBE_CORE_CURRENT_PROJECT_REPORT || process.env.VIBE_CORE_PROJECT_REPORT,
  resolveRepoInputPath,
  repoRelativePath,
  pathWithinRoot,
  runtimePolicy,
  normalizeRelativePath,
  readJsonIfPresent,
  existsSync,
  statSync,
  mkdirSync,
  writeFileSync,
});

function clip(value) {
  const text = String(value || "");
  if (text.length <= maxOutputChars) return text;
  return `${text.slice(0, maxOutputChars)}\n...[clipped ${text.length - maxOutputChars} chars]`;
}

function writeSecurityBlocked(res, security) {
  res.runtimeAllowedOrigin = security.origin && isTrustedLocalOrigin(security.origin) ? security.origin : undefined;
  writeJson(res, security.statusCode || 403, {
    ok: false,
    ...runtimePolicy(),
    status: "forbidden",
    message: security.message || "Runtime API request was blocked.",
  });
}

function observationSummary(item, fileScope) {
  const expectedOutputPath = typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined;
  return {
    order: item.order,
    shotId: item.shotId,
    expectedOutputPath,
    imageUrl: expectedOutputPath ? runtimeFileUrl(expectedOutputPath, fileScope) : undefined,
    previewQaStatus: item.previewQaStatus,
    productionQaStatus: item.productionQaStatus,
    reviewOverlay: item.reviewOverlay === true,
    runtimeTruthStatus: item.runtimeTruthStatus,
    blockers: Array.isArray(item.blockers) ? item.blockers : [],
  };
}

function readRuntimeJson(relativePath) {
  if (!relativePath) return undefined;
  try {
    return readJsonIfPresent(scopedRepoPath(relativePath));
  } catch {
    return undefined;
  }
}

function isRound5FullRealChainReport(report, source) {
  return isRecord(report) && (
    String(report.schemaVersion || "").startsWith("round5_full_real_chain_report")
    || source.reportRelativePath.endsWith(`/reports/${round5FullRealChainReportFileName}`)
  );
}

function round5TaskRunId(runId, shotId) {
  return `${runId}:${shotId}:start`;
}

function round5QaStatusFor(shotQa, generated) {
  const qaStatus = String(shotQa?.qaStatus || "").toLowerCase();
  const startStatus = String(shotQa?.startStatus || generated?.status || "").toLowerCase();
  if (!generated?.exists) return "missing";
  if (qaStatus.startsWith("blocked") || startStatus.includes("motion_affordance_failed") || startStatus.includes("failed")) return "blocked";
  if (qaStatus.includes("needs_review") || startStatus.includes("needs_review")) return "needs_review";
  if (qaStatus.startsWith("pass") || startStatus.includes("generated")) return "pass";
  return "needs_review";
}

function round5EndRequiredFor(shotId, report, shotQa) {
  if (Array.isArray(report.endFrameStage?.appliesTo) && report.endFrameStage.appliesTo.includes(shotId)) return true;
  const endStatus = shotQa?.endStatus || "";
  return Boolean(endStatus && endStatus !== "not_required");
}

function round5BboxValid(bbox) {
  if (!bbox) return false;
  return Number.isFinite(bbox.x)
    && Number.isFinite(bbox.y)
    && Number.isFinite(bbox.width)
    && Number.isFinite(bbox.height)
    && bbox.x >= 0
    && bbox.y >= 0
    && bbox.width > 0
    && bbox.height > 0
    && bbox.x + bbox.width <= 1.001
    && bbox.y + bbox.height <= 1.001;
}

function round5HasEditableRegion(evidence) {
  if (!evidence) return false;
  if (evidence.maskPath && evidence.maskSha256) return true;
  if (round5BboxValid(evidence.bboxNormalized)) return true;
  return Boolean(Array.isArray(evidence.regions) && evidence.regions.some((region) => round5BboxValid(region.bboxNormalized)));
}

function round5EvidenceStatusAllowed(status, allowed) {
  return allowed.has(String(status || "").toLowerCase());
}

function round5StrictEditEvidenceBlockers({ qaStatus, endRequired, generated, approvedStartFrame, editableRegionEvidence, providerEditReceipt }) {
  if (!endRequired || qaStatus !== "pass") return [];

  const blockers = [];
  const startSha = generated?.sha256;
  const approvedStatuses = new Set(["approved", "approved_for_strict_edit"]);
  const regionStatuses = new Set(["pass", "ready"]);
  const receiptStatuses = new Set(["ready_for_provider_edit"]);
  const strictEditOperations = new Set(["image.edit", "image2image"]);

  if (!approvedStartFrame || !round5EvidenceStatusAllowed(approvedStartFrame.approvalStatus, approvedStatuses)) blockers.push("approved_start_attachment_missing");
  if (!approvedStartFrame?.providerAttachmentId) blockers.push("source_start_frame_attachment_id_missing");
  if (!startSha || approvedStartFrame?.sha256 !== startSha) blockers.push("source_start_frame_sha_not_provider_confirmed");

  const regionStatusReady = round5EvidenceStatusAllowed(editableRegionEvidence?.qaStatus, regionStatuses)
    || round5EvidenceStatusAllowed(editableRegionEvidence?.status, regionStatuses);
  if (!editableRegionEvidence || !regionStatusReady || editableRegionEvidence.sourceStartFrameSha256 !== startSha || !round5HasEditableRegion(editableRegionEvidence)) {
    blockers.push("editable_region_mask_or_bbox_missing");
  }

  const receiptOperation = String(providerEditReceipt?.operation || "").toLowerCase();
  const receiptStatusReady = round5EvidenceStatusAllowed(providerEditReceipt?.status, receiptStatuses);
  const receiptMatchesStart = Boolean(providerEditReceipt?.sourceStartFrameSha256 && providerEditReceipt.sourceStartFrameSha256 === startSha);
  const receiptMatchesAttachment = Boolean(
    providerEditReceipt?.sourceStartFrameAttachmentId
    && providerEditReceipt.sourceStartFrameAttachmentId === approvedStartFrame?.providerAttachmentId,
  );
  if (!providerEditReceipt || !providerEditReceipt.receiptId || !receiptStatusReady) {
    blockers.push("provider_edit_receipt_missing");
    blockers.push("strict_image_edit_provenance_missing");
  } else if (!strictEditOperations.has(receiptOperation)) {
    blockers.push("strict_image_edit_provenance_missing");
  } else if (!receiptMatchesStart || !receiptMatchesAttachment || providerEditReceipt.noFallbackUsed !== true) {
    blockers.push("strict_image_edit_provenance_missing");
  }

  return uniqueStrings(blockers);
}

const round5VisualInputKinds = new Set([
  "app_server_localimage",
  "app_server_local_image",
  "input_image",
  "local_file",
  "local_image",
  "uploaded_file",
  "image_file",
  "reference_image",
]);

function round5TextMentionsImagePath(value) {
  if (typeof value === "string") {
    return /(?:^|\s|["'(])(?:file:\/\/|\/Users\/|[A-Za-z]:[\\/]|\.{1,2}\/|[\w.-]+\/)[^\s"'()]+\.(?:png|jpe?g|webp|gif|tiff?)(?:$|\s|["')])/i.test(value);
  }
  if (Array.isArray(value)) return value.some(round5TextMentionsImagePath);
  if (isRecord(value)) return Object.values(value).some(round5TextMentionsImagePath);
  return false;
}

function round5ReferenceAttachmentReceipt(providerObservation) {
  if (!isRecord(providerObservation)) return undefined;
  for (const key of [
    "referenceAttachmentReceipt",
    "sourceStartFrameAttachmentReceipt",
    "imageReferenceDeliveryReceipt",
    "uploadReceipt",
  ]) {
    if (isRecord(providerObservation[key])) return providerObservation[key];
  }
  return undefined;
}

function round5StrictEditProviderObservationBlockers({
  providerObservation,
  providerRequestId,
  generated,
  approvedStartFrame,
  editableRegionEvidence,
  providerEditReceipt,
}) {
  const blockers = [];
  if (!isRecord(providerObservation)) {
    return ["provider_observation_missing", "source_reference_attachment_receipt_missing"];
  }

  const provider = String(providerObservation.provider || providerObservation.providerId || "");
  const operation = String(providerObservation.operation || "").toLowerCase();
  const observationRequestId = asString(providerObservation.providerRequestId) || asString(providerObservation.requestId);
  const receiptId = asString(providerObservation.preflightReceiptId) || asString(providerObservation.receiptId);
  const attachmentId = asString(providerObservation.sourceStartFrameAttachmentId);
  const editableEvidenceSha = asString(providerObservation.editableRegionEvidenceSha256);
  const attachmentReceipt = round5ReferenceAttachmentReceipt(providerObservation);
  const promptMentionsImagePath = round5TextMentionsImagePath([
    providerObservation.prompt,
    providerObservation.promptText,
    providerObservation.finalPrompt,
    providerObservation.requestPrompt,
    providerObservation.instructions,
  ]);
  const deliveredKind = String(
    providerObservation.deliveredInputKind
      || attachmentReceipt?.deliveredInputKind
      || attachmentReceipt?.inputKind
      || "",
  ).toLowerCase();

  if (!/image2/i.test(provider)) blockers.push("provider_observation_provider_not_image2");
  if (providerObservation.providerObservationMode !== "actual_provider_call_observed") blockers.push("provider_observation_mode_not_actual");
  if (operation !== "image.edit" && operation !== "image2image") blockers.push("provider_observation_operation_not_image_edit");
  if (!observationRequestId) blockers.push("provider_observation_request_id_missing");
  if (providerRequestId && observationRequestId && providerRequestId !== observationRequestId) blockers.push("provider_request_id_mismatch");
  if (asString(providerObservation.sourceStartFrameSha256) !== generated?.sha256) blockers.push("source_start_frame_sha_mismatch");
  if (attachmentId !== approvedStartFrame?.providerAttachmentId) blockers.push("source_start_frame_attachment_mismatch");
  if (editableEvidenceSha !== editableRegionEvidence?.evidenceSha256) blockers.push("editable_region_evidence_sha_mismatch");
  if (receiptId !== providerEditReceipt?.receiptId) blockers.push("preflight_receipt_id_mismatch");
  if (providerObservation.noFallbackUsed !== true) blockers.push("no_fallback_evidence_missing");
  if (providerObservation.promptOnly === true || ["prompt", "prompt_only", "prompt_text_only", "text", "text_only"].includes(deliveredKind)) {
    blockers.push("prompt_only_image_edit_forbidden");
  }
  if (promptMentionsImagePath && !attachmentReceipt) blockers.push("path_in_prompt_without_reference_attachment");

  if (!attachmentReceipt) {
    blockers.push("source_reference_attachment_receipt_missing");
  } else {
    const receiptAttachmentId = asString(attachmentReceipt.sourceStartFrameAttachmentId)
      || asString(attachmentReceipt.attachmentId)
      || asString(attachmentReceipt.inputId);
    const receiptSha = asString(attachmentReceipt.sourceStartFrameSha256)
      || asString(attachmentReceipt.deliveredSha256)
      || asString(attachmentReceipt.inputSha256)
      || asString(attachmentReceipt.sha256);
    if (receiptSha !== generated?.sha256) blockers.push("source_reference_attachment_sha_mismatch");
    if (receiptAttachmentId !== approvedStartFrame?.providerAttachmentId) blockers.push("source_reference_attachment_id_mismatch");
    if (!round5VisualInputKinds.has(deliveredKind)) blockers.push("source_reference_attachment_input_kind_not_visual");
    if (attachmentReceipt.promptOnly !== false) blockers.push("source_reference_attachment_prompt_only_not_false");
    if (attachmentReceipt.acceptedByActionSchema !== true) blockers.push("source_reference_attachment_schema_not_accepted");
  }

  return uniqueStrings(blockers);
}

function round5StrictEditPreflightStatusFor({ qaStatus, endRequired, evidenceBlockers }) {
  if (!endRequired) return "not_required";
  if (qaStatus !== "pass") return "blocked";
  return evidenceBlockers.length === 0 ? "ready_for_provider_edit" : "blocked";
}

function round5BlockersFor({ qaStatus, endRequired, shotQa, report, strictEditEvidenceBlockers }) {
  const shotIssues = Array.isArray(shotQa?.issues) ? shotQa.issues : [];
  if (qaStatus === "missing") return uniqueStrings(["start_frame_missing", ...shotIssues]);
  if (qaStatus === "blocked") return uniqueStrings(["start_motion_affordance_failed", ...shotIssues]);
  if (endRequired) return uniqueStrings([...(strictEditEvidenceBlockers || round5EndFrameBlockers), ...shotIssues]);
  if (qaStatus === "needs_review") return uniqueStrings(["start_frame_needs_review", ...shotIssues]);
  return uniqueStrings(shotIssues);
}

function round5GateStatusFor(qaStatus, endRequired, strictEditPreflightStatus) {
  if (qaStatus === "missing") return "start_missing";
  if (qaStatus === "blocked") return "start_regeneration_required";
  if (qaStatus === "needs_review") return "start_needs_review";
  if (endRequired && strictEditPreflightStatus === "ready_for_provider_edit") return "end_edit_preflight_ready";
  if (endRequired) return "end_edit_preflight_blocked";
  return "start_provider_observed";
}

function round5LedgerStatusFor(qaStatus, strictEditPreflightStatus) {
  if (qaStatus === "missing") return "waiting_output";
  if (qaStatus === "blocked") return "parked";
  if (qaStatus === "needs_review") return "needs_review";
  if (strictEditPreflightStatus === "ready_for_provider_edit") return "waiting_output";
  return "provider_observed";
}

function round5NextActionFor(shotId, qaStatus, endRequired, strictEditPreflightStatus) {
  if (shotId === "ZP04" && qaStatus === "blocked") return "regenerate_start_frame";
  if (qaStatus === "blocked") return "block_regenerate_start";
  if (qaStatus === "needs_review") return "review_start_frame";
  if (endRequired && strictEditPreflightStatus === "ready_for_provider_edit") return "submit_strict_image_edit";
  if (endRequired) return "collect_strict_edit_provenance";
  return "none";
}

function round5ReadStrictEditEvidence(runRootPath, shotIds) {
  const evidence = {
    approvedStartFrames: [],
    editableRegionEvidence: [],
    providerEditReceipts: [],
  };
  for (const shotId of shotIds) {
    const shotDir = path.join(runRootPath, "shots", shotId);
    const approvedPath = path.join(shotDir, round5StrictEditSidecarFileNames.approvedStartFrame);
    const editablePath = path.join(shotDir, round5StrictEditSidecarFileNames.editableRegionEvidence);
    const receiptPath = path.join(shotDir, round5StrictEditSidecarFileNames.providerEditReceipt);
    const approved = readJsonIfPresent(approvedPath);
    const editable = readJsonIfPresent(editablePath);
    const receipt = readJsonIfPresent(receiptPath);
    if (isRecord(approved)) {
      evidence.approvedStartFrames.push({
        ...approved,
        shotId: approved.shotId || shotId,
        startFramePath: approved.startFramePath || `shots/${shotId}/start.png`,
      });
    }
    if (isRecord(editable)) {
      evidence.editableRegionEvidence.push({
        ...editable,
        shotId: editable.shotId || shotId,
        evidencePath: editable.evidencePath || `shots/${shotId}/${round5StrictEditSidecarFileNames.editableRegionEvidence}`,
      });
    }
    if (isRecord(receipt)) {
      evidence.providerEditReceipts.push({
        ...receipt,
        shotId: receipt.shotId || shotId,
        receiptPath: receipt.receiptPath || `shots/${shotId}/${round5StrictEditSidecarFileNames.providerEditReceipt}`,
      });
    }
  }
  return evidence;
}

function round5ReadStrictEditReturns(runRootPath, shotIds) {
  const returns = [];
  for (const shotId of shotIds) {
    const shotDir = path.join(runRootPath, "shots", shotId);
    const endPath = path.join(shotDir, "end.png");
    const providerObservationPath = path.join(shotDir, round5StrictEditSidecarFileNames.endProviderObservation);
    const semanticQaPath = path.join(shotDir, round5StrictEditSidecarFileNames.endSemanticQa);
    const pairQaPath = path.join(shotDir, round5StrictEditSidecarFileNames.endPairQa);
    const endExists = existsSync(endPath) && statSync(endPath).isFile();
    returns.push({
      shotId,
      endFramePath: `shots/${shotId}/end.png`,
      endExists,
      endFrameSha256: endExists ? sha256File(endPath) : undefined,
      providerObservationPath: `shots/${shotId}/${round5StrictEditSidecarFileNames.endProviderObservation}`,
      providerObservation: readJsonIfPresent(providerObservationPath),
      semanticQaPath: `shots/${shotId}/${round5StrictEditSidecarFileNames.endSemanticQa}`,
      semanticQa: readJsonIfPresent(semanticQaPath),
      pairQaPath: `shots/${shotId}/${round5StrictEditSidecarFileNames.endPairQa}`,
      pairQa: readJsonIfPresent(pairQaPath),
    });
  }
  return returns;
}

function round5EndProviderObservationMatches({ returnedEnd, generated, approvedStartFrame, editableRegionEvidence, providerEditReceipt }) {
  const observation = returnedEnd?.providerObservation;
  if (!isRecord(observation)) return false;
  const provider = String(observation.provider || observation.providerId || "");
  const operation = String(observation.operation || "").toLowerCase();
  const outputPath = normalizeRelativePath(asString(observation.outputPath) || "");
  const observedHash = asString(observation.outputSha256) || asString(observation.outputHash);
  const providerRequestId = asString(observation.providerRequestId) || asString(observation.requestId);
  const receiptId = asString(observation.preflightReceiptId) || asString(observation.receiptId);
  const attachmentId = asString(observation.sourceStartFrameAttachmentId);
  const editableEvidenceSha = asString(observation.editableRegionEvidenceSha256);
  return returnedEnd?.endExists === true
    && observation.providerObservationMode === "actual_provider_call_observed"
    && /image2/i.test(provider)
    && (operation === "image.edit" || operation === "image2image")
    && outputPath === returnedEnd.endFramePath
    && observedHash === returnedEnd.endFrameSha256
    && observation.providerCalled === true
    && observation.actualImage2Triggered === true
    && providerRequestId
    && asString(observation.sourceStartFrameSha256) === generated?.sha256
    && attachmentId === approvedStartFrame?.providerAttachmentId
    && editableEvidenceSha === editableRegionEvidence?.evidenceSha256
    && receiptId === providerEditReceipt?.receiptId
    && observation.noFallbackUsed === true;
}

function round5EndSemanticQaMatches(returnedEnd) {
  const semanticQa = returnedEnd?.semanticQa;
  if (!isRecord(semanticQa)) return false;
  const outputPath = normalizeRelativePath(asString(semanticQa.outputPath) || asString(semanticQa.expectedOutputPath) || "");
  const reviewedHash = asString(semanticQa.reviewedOutputSha256) || asString(semanticQa.outputSha256);
  const status = String(semanticQa.finalAssessment?.status || semanticQa.qaStatus || semanticQa.status || "").toLowerCase();
  return returnedEnd?.endExists === true
    && semanticQa.semanticReviewMode === "actual_image_semantic_review"
    && outputPath === returnedEnd.endFramePath
    && reviewedHash === returnedEnd.endFrameSha256
    && (status === "needs_review" || status === "pass" || status === "warning");
}

function round5StrictEditEndReturned(input) {
  return round5EndProviderObservationMatches(input)
    && round5EndSemanticQaMatches(input.returnedEnd);
}

function round5LedgerEvents({
  generatedAt,
  projectId,
  taskRunId,
  shotId,
  path: outputPath,
  sha256,
  qaStatus,
  strictEditPreflightStatus,
  strictEditEndReturned,
  endFramePath,
  endFrameSha256,
  approvedStartFrameRef,
  editableRegionEvidenceRef,
  providerEditReceiptRef,
  blockers,
}) {
  const events = [
    {
      eventId: `${taskRunId}:prepared`,
      eventType: "task_prepared",
      at: generatedAt,
      taskRunId,
      notes: ["Projected from Round 5 artifact report; no provider call or file mutation performed."],
    },
  ];

  if (!outputPath || !sha256) return events;

  events.push({
    eventId: `${taskRunId}:output_detected_no_sidecar`,
    eventType: "output_detected_no_sidecar",
    at: generatedAt,
    taskRunId,
    output: { path: outputPath, hash: sha256, hashAlgorithm: "sha256" },
    notes: ["start.png exists in run artifacts; image bytes stay in sidecar/artifact storage."],
  });
  events.push({
    eventId: `${taskRunId}:provider_observed`,
    eventType: "provider_observed",
    at: generatedAt,
    taskRunId,
    providerObservation: {
      providerId: "round5_report_artifact_projection",
      observationId: `${projectId}:${shotId}:start`,
      outputPath,
      outputHash: sha256,
    },
    notes: ["Observation is report-derived; it is not a new provider invocation."],
  });

  if (qaStatus === "pass") {
    events.push({
      eventId: `${taskRunId}:qa_passed`,
      eventType: "qa_passed",
      at: generatedAt,
      taskRunId,
      qaReview: {
        qaReportId: `${shotId}:start_motion_affordance_qa`,
        outputPath,
        reviewedOutputHash: sha256,
        status: "pass",
        findingIds: blockers,
      },
      notes: ["QA pass does not imply complete_verified without strict sidecars/provenance."],
    });
  } else if (qaStatus === "needs_review") {
    events.push({
      eventId: `${taskRunId}:needs_review`,
      eventType: "needs_review",
      at: generatedAt,
      taskRunId,
      qaReview: {
        qaReportId: `${shotId}:start_motion_affordance_qa`,
        outputPath,
        reviewedOutputHash: sha256,
        status: "needs_review",
        findingIds: blockers,
      },
      notes: ["Start frame requires review before downstream promotion."],
    });
  } else if (qaStatus === "blocked") {
    events.push({
      eventId: `${taskRunId}:parked`,
      eventType: "parked",
      at: generatedAt,
      taskRunId,
      reason: blockers.join(", "),
      notes: ["Start frame is parked until regenerated; end frame must remain blocked."],
    });
  }

  if (strictEditPreflightStatus === "ready_for_provider_edit") {
    events.push({
      eventId: `${taskRunId}:strict_edit_preflight_ready`,
      eventType: "strict_edit_preflight_ready",
      at: generatedAt,
      taskRunId,
      strictEditPreflight: {
        status: "ready_for_provider_edit",
        approvedStartFrameRef,
        editableRegionEvidenceRef,
        providerEditReceiptRef,
      },
      notes: ["Strict edit handoff evidence is present; this still does not mark an end frame complete."],
    });
  }

  if (strictEditEndReturned) {
    events.push({
      eventId: `${taskRunId}:strict_edit_end_returned`,
      eventType: "needs_review",
      at: generatedAt,
      taskRunId,
      output: { path: endFramePath, hash: endFrameSha256, hashAlgorithm: "sha256" },
      qaReview: {
        qaReportId: `${shotId}:strict_edit_end_semantic_qa`,
        outputPath: endFramePath,
        reviewedOutputHash: endFrameSha256,
        status: "needs_review",
        findingIds: [],
      },
      notes: ["Strict edit end frame was returned with hash-bound actual provider observation and still requires human pair review."],
    });
  }

  return events;
}

function round5ArtifactIngestFromReport(source, project, report) {
  if (!isRound5FullRealChainReport(report, source)) return undefined;

  const runId = project.runId || path.basename(source.runRootPath);
  const projectId = project.projectId || source.requestProjectId || path.basename(path.dirname(path.dirname(source.runRootPath)));
  const generatedAt = report.generatedAt || "1970-01-01T00:00:00.000Z";
  const startsByShot = new Map((Array.isArray(report.generatedStartFrames) ? report.generatedStartFrames : []).map((item) => [item.shotId, item]));
  const qaByShot = new Map((Array.isArray(report.shotQa) ? report.shotQa : []).map((item) => [item.shotId, item]));
  const shotIds = uniqueStrings([...startsByShot.keys(), ...qaByShot.keys()]).sort();
  const strictEditEvidence = round5ReadStrictEditEvidence(source.runRootPath, shotIds);
  const strictEditReturns = round5ReadStrictEditReturns(source.runRootPath, shotIds);
  const approvedStartByShot = new Map(strictEditEvidence.approvedStartFrames.map((item) => [item.shotId, item]));
  const editableRegionByShot = new Map(strictEditEvidence.editableRegionEvidence.map((item) => [item.shotId, item]));
  const providerEditReceiptByShot = new Map(strictEditEvidence.providerEditReceipts.map((item) => [item.shotId, item]));
  const returnedEndByShot = new Map(strictEditReturns.map((item) => [item.shotId, item]));

  const shotGateMatrix = shotIds.map((shotId) => {
    const generated = startsByShot.get(shotId);
    const shotQa = qaByShot.get(shotId);
    const startFramePath = generated?.startFramePath || generated?.path || shotQa?.path;
    const startFrameSha256 = generated?.sha256;
    const startExists = Boolean(generated?.exists && startFramePath && startFrameSha256);
    const startQaStatus = round5QaStatusFor(shotQa, generated);
    const endRequired = round5EndRequiredFor(shotId, report, shotQa);
    const approvedStartFrame = approvedStartByShot.get(shotId);
    const editableRegionEvidence = editableRegionByShot.get(shotId);
    const providerEditReceipt = providerEditReceiptByShot.get(shotId);
    const returnedEnd = returnedEndByShot.get(shotId);
    const evidenceBlockers = round5StrictEditEvidenceBlockers({
      qaStatus: startQaStatus,
      endRequired,
      generated,
      approvedStartFrame,
      editableRegionEvidence,
      providerEditReceipt,
    });
    const strictEditPreflightStatus = round5StrictEditPreflightStatusFor({
      qaStatus: startQaStatus,
      endRequired,
      evidenceBlockers,
    });
    const strictEditEndReturned = evidenceBlockers.length === 0 && round5StrictEditEndReturned({
      returnedEnd,
      generated,
      approvedStartFrame,
      editableRegionEvidence,
      providerEditReceipt,
    });
    const blockers = round5BlockersFor({
      qaStatus: startQaStatus,
      endRequired,
      shotQa,
      report,
      strictEditEvidenceBlockers: evidenceBlockers,
    }).filter((blocker) => !strictEditEndReturned || !String(blocker).startsWith("end_frame_blocked_until"));
    const nextAction = strictEditEndReturned
      ? "review_strict_edit_end_frame"
      : round5NextActionFor(shotId, startQaStatus, endRequired, strictEditPreflightStatus);
    const gateStatus = strictEditEndReturned
      ? "end_returned_needs_review"
      : round5GateStatusFor(startQaStatus, endRequired, strictEditPreflightStatus);
    const ledgerStatus = strictEditEndReturned
      ? "needs_review"
      : round5LedgerStatusFor(startQaStatus, strictEditPreflightStatus);

    return {
      shotId,
      taskRunId: round5TaskRunId(runId, shotId),
      startFramePath,
      startFrameSha256,
      startExists,
      startQaStatus,
      endRequired,
      endFramePath: `shots/${shotId}/end.png`,
      endExists: returnedEnd?.endExists === true,
      endFrameSha256: returnedEnd?.endFrameSha256,
      gateStatus,
      ledgerStatus,
      nextAction,
      strictEditPilotCandidate: shotId === "ZP05" && endRequired && startQaStatus === "pass",
      strictEditPreflightStatus,
      approvedStartFrameRef: approvedStartFrame?.startFramePath,
      editableRegionEvidenceRef: editableRegionEvidence?.evidencePath || editableRegionEvidence?.maskPath,
      providerEditReceiptRef: providerEditReceipt?.receiptPath || providerEditReceipt?.receiptId,
      completeVerified: false,
      blockers: strictEditEndReturned ? [] : blockers,
      warnings: Array.isArray(shotQa?.issues) ? shotQa.issues : [],
    };
  });

  const ledgers = shotGateMatrix.map((shot) => {
    const events = round5LedgerEvents({
      generatedAt,
      projectId,
      taskRunId: shot.taskRunId,
      shotId: shot.shotId,
      path: shot.startFramePath,
      sha256: shot.startFrameSha256,
      qaStatus: shot.startQaStatus,
      strictEditPreflightStatus: shot.strictEditPreflightStatus,
      strictEditEndReturned: shot.gateStatus === "end_returned_needs_review",
      endFramePath: shot.endFramePath,
      endFrameSha256: shot.endFrameSha256,
      approvedStartFrameRef: shot.approvedStartFrameRef,
      editableRegionEvidenceRef: shot.editableRegionEvidenceRef,
      providerEditReceiptRef: shot.providerEditReceiptRef,
      blockers: shot.blockers,
    });
    return {
      schemaVersion: "task_run_ledger_style_projection_v1",
      ledgerId: `round5_artifact_ledger_${runId}_${shot.shotId}`,
      projectId,
      taskRunId: shot.taskRunId,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      expectedOutputs: uniqueStrings([shot.startFramePath || "", shot.endRequired ? shot.endFramePath : ""]),
      events,
    };
  });

  const byStatus = {
    provider_observed: 0,
    needs_review: 0,
    parked: 0,
    waiting_output: 0,
  };
  for (const shot of shotGateMatrix) byStatus[shot.ledgerStatus] += 1;
  const returnedEndFrames = shotGateMatrix.filter((shot) => shot.gateStatus === "end_returned_needs_review").length;

  const assetStatuses = (Array.isArray(report.assetQa) ? report.assetQa : []).map((item) => item.status || "unknown");
  const nextActions = shotGateMatrix
    .filter((shot) => shot.nextAction !== "none")
    .map((shot) => ({ shotId: shot.shotId, nextAction: shot.nextAction }));
  const status = shotGateMatrix.some((shot) => shot.gateStatus === "start_regeneration_required" || shot.gateStatus === "end_edit_preflight_blocked")
    ? "blocked"
    : shotGateMatrix.some((shot) => shot.gateStatus === "start_needs_review" || shot.gateStatus === "end_returned_needs_review")
      ? "needs_review"
      : "in_progress";

  return {
    schemaVersion: round5ArtifactIngestSchemaVersion,
    runRoot: source.runRootPath,
    projectId,
    runId,
    sourceReportSchemaVersion: report.schemaVersion,
    isolation: round5ArtifactIsolationFlags,
    assetGateSummary: {
      total: assetStatuses.length,
      needsReview: assetStatuses.filter((item) => item.includes("needs_review")).length,
      pass: assetStatuses.filter((item) => item === "pass").length,
      statuses: uniqueStrings(assetStatuses),
    },
    shotGateMatrix,
    ledgers,
    ledgerProjection: {
      total: shotGateMatrix.length,
      byStatus,
      completeVerified: 0,
      endEditPreflightBlocked: shotGateMatrix.filter((shot) => shot.gateStatus === "end_edit_preflight_blocked").length,
      endEditPreflightReady: shotGateMatrix.filter((shot) => shot.gateStatus === "end_edit_preflight_ready").length,
      endReturnedNeedsReview: returnedEndFrames,
      projections: shotGateMatrix,
    },
    uiSummary: {
      status,
      complete: false,
      completeVerified: false,
      providerCalled: returnedEndFrames > 0,
      generatedImages: returnedEndFrames > 0,
      totalShots: shotGateMatrix.length,
      observedStarts: shotGateMatrix.filter((shot) => shot.startExists).length,
      endFramesComplete: 0,
      returnedEndFrames,
      nextActions,
      warnings: [
        "Round 5 artifact ingest is projection-only; it does not generate images.",
        returnedEndFrames > 0
          ? "Strict edit end frame returns are hash-bound but remain needs_review until pair QA and human review pass."
          : "End frames remain blocked until strict edit provenance and provider receipts exist.",
      ],
    },
  };
}

function round5StrictEditRequestInput(url, body) {
  return {
    shotId: asString(url.searchParams.get("shotId"))
      || requestBodyString(body, ["shotId", "selectedShotId"])
      || "ZP05",
    bboxNormalized: isRecord(body?.bboxNormalized)
      ? body.bboxNormalized
      : isRecord(body?.bbox)
        ? body.bbox
        : undefined,
    inputSha256: requestBodyString(body, ["sha256", "startFrameSha256", "sourceStartFrameSha256"]),
  };
}

function round5StrictEditReturnRequestInput(url, body) {
  const payload = isRecord(body) ? body : {};
  return {
    shotId: asString(url.searchParams.get("shotId"))
      || requestBodyString(payload, ["shotId", "selectedShotId"])
      || "ZP05",
    returnedOutputPath: requestBodyString(payload, ["returnedOutputPath", "outputPath", "endFramePath"]),
    actualProviderReturned: payload.actualProviderReturned === true,
    providerObservation: isRecord(payload.providerObservation) ? payload.providerObservation : undefined,
    semanticQa: isRecord(payload.semanticQa) ? payload.semanticQa : undefined,
    returnedProviderObservationPath: requestBodyString(payload, ["returnedProviderObservationPath", "providerObservationPath"]),
    returnedSemanticQaPath: requestBodyString(payload, ["returnedSemanticQaPath", "semanticQaPath"]),
    providerRequestId: requestBodyString(payload, ["providerRequestId", "requestId"]),
    inputSha256: requestBodyString(payload, ["sha256", "startFrameSha256", "sourceStartFrameSha256"]),
  };
}

function round5NormalizeBbox(input) {
  if (!isRecord(input)) return undefined;
  return {
    x: Number(input.x),
    y: Number(input.y),
    width: Number(input.width),
    height: Number(input.height),
  };
}

function round5DefaultStrictEditBbox(shotId) {
  if (shotId !== "ZP05") return undefined;
  return { x: 0.42, y: 0.34, width: 0.22, height: 0.2 };
}

function round5StartFramePathInfo(source, shotId, startFramePath) {
  const normalizedStartFramePath = normalizeRelativePath(String(startFramePath || ""));
  const shotRoot = `shots/${shotId}`;
  if (
    !normalizedStartFramePath
    || path.isAbsolute(normalizedStartFramePath)
    || normalizedStartFramePath.startsWith("../")
    || normalizedStartFramePath.includes("/../")
    || !oneShotPathInsideRoot(normalizedStartFramePath, shotRoot)
  ) {
    return { ok: false, blocker: "start_frame_path_outside_shot_root" };
  }

  const repoRelativeStartFramePath = `${source.runRootRelativePath}/${normalizedStartFramePath}`;
  if (!oneShotPathInsideRoot(repoRelativeStartFramePath, source.runRootRelativePath)) {
    return { ok: false, blocker: "start_frame_path_outside_project_root" };
  }

  const startFrameAbsolutePath = scopedRepoPath(repoRelativeStartFramePath);
  if (!existsSync(startFrameAbsolutePath) || !statSync(startFrameAbsolutePath).isFile()) {
    return { ok: false, blocker: "start_frame_file_missing" };
  }

  const startFrameRealPath = realpathSync(startFrameAbsolutePath);
  const runRootRealPath = realpathSync(source.runRootPath);
  if (!isPathInsideRealRoot(startFrameRealPath, runRootRealPath)) {
    return { ok: false, blocker: "start_frame_path_realpath_escape" };
  }

  return {
    ok: true,
    startFramePath: normalizedStartFramePath,
    repoRelativeStartFramePath,
    startFrameAbsolutePath,
  };
}

function round5StrictEditBlockedResponse(source, requestContext, input, blockers, extra = {}) {
  const project = source ? projectIdentityFromSource(source) : {};
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint: currentProjectRound5StrictEditPrepareEndpoint,
    status: "blocked",
    previewStatus: "blocked",
    productionStatus: "blocked",
    reportStatus: "blocked",
    currentProject: source
      ? {
        bound: true,
        bindingPath: source.bindingPathRelative,
        binding: source.binding,
      }
      : undefined,
    requestContext: {
      ...requestOverrideDiagnostics(requestContext),
    },
    projectRootMode: source?.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    project,
    shotId: input?.shotId,
    blockers: uniqueStrings(blockers),
    sidecarWrites: [],
    strictEditPreflightPrepareRan: false,
    message: "Round 5 strict edit preflight sidecars were not written.",
    ...extra,
  };
}

function currentProjectRound5StrictEditPrepareResponse(input, extra = {}, source = currentProjectSource()) {
  const requestContext = extra.requestContext || {};
  const blockers = [];
  const project = projectIdentityFromSource(source);
  const report = readJsonIfPresent(source.reportPath);
  const shotId = input.shotId;

  if (!isRecord(report) || !isRound5FullRealChainReport(report, source)) {
    blockers.push("round5_full_real_chain_report_missing");
  }
  if (!shotId || safePathSegment(shotId) !== shotId) {
    blockers.push("shot_id_must_be_safe_path_segment");
  }

  const generated = Array.isArray(report?.generatedStartFrames)
    ? report.generatedStartFrames.find((item) => item?.shotId === shotId)
    : undefined;
  const shotQa = Array.isArray(report?.shotQa)
    ? report.shotQa.find((item) => item?.shotId === shotId)
    : undefined;
  if (isRecord(report) && !generated && !shotQa) blockers.push("shot_not_found");

  const startFrameSha256 = generated?.sha256;
  const startExistsInReport = Boolean(generated?.exists && generated?.startFramePath && startFrameSha256);
  const startQaStatus = round5QaStatusFor(shotQa, generated);
  const endRequired = isRecord(report) && shotId ? round5EndRequiredFor(shotId, report, shotQa) : false;
  if (generated && !startExistsInReport) blockers.push("start_frame_missing_in_report");
  if (generated && !startFrameSha256) blockers.push("start_sha_missing_in_report");
  if (generated && startQaStatus !== "pass") blockers.push("start_qa_not_pass");
  if (generated && !endRequired) blockers.push("strict_edit_not_required_for_shot");

  const startPathInfo = generated
    ? round5StartFramePathInfo(source, shotId, generated.startFramePath || generated.path)
    : undefined;
  if (generated && startPathInfo && !startPathInfo.ok) blockers.push(startPathInfo.blocker);

  if (startPathInfo?.ok && startFrameSha256) {
    const actualSha256 = createHash("sha256").update(readFileSync(startPathInfo.startFrameAbsolutePath)).digest("hex");
    if (actualSha256 !== startFrameSha256) blockers.push("start_sha_mismatch_with_file");
  }

  const requestedBbox = round5NormalizeBbox(input.bboxNormalized);
  const bboxNormalized = requestedBbox || round5DefaultStrictEditBbox(shotId);
  if (!round5BboxValid(bboxNormalized)) blockers.push("editable_bbox_invalid");

  if (blockers.length) {
    return round5StrictEditBlockedResponse(source, requestContext, input, blockers, {
      ignoredInputSha256: input.inputSha256 ? "sha256_from_request_ignored" : undefined,
      reportPath: source.reportRelativePath,
      image2ReportPath: source.reportRelativePath,
    });
  }

  const approvedPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.approvedStartFrame}`;
  const editablePath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.editableRegionEvidence}`;
  const receiptPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.providerEditReceipt}`;
  const providerAttachmentId = `attachment_round5_${shotId}_start_${startFrameSha256.slice(0, 12)}`;
  const editableRegionEvidenceSha256 = `sha256:runtime-strict-edit-bbox-${shotId}-${startFrameSha256.slice(0, 12)}`;
  const preparedAt = new Date().toISOString();

  const approvedStartFrameRef = {
    schemaVersion: "round5_approved_start_frame_ref_v1",
    shotId,
    startFramePath: startPathInfo.startFramePath,
    sha256: startFrameSha256,
    sourceStartFrameSha256: startFrameSha256,
    providerAttachmentId,
    approvalStatus: "approved",
    approvedAt: preparedAt,
    providerCalled: false,
  };
  const editableRegionEvidence = {
    schemaVersion: "round5_editable_region_mask_or_bbox_v1",
    shotId,
    sourceStartFrameSha256: startFrameSha256,
    evidencePath: `shots/${shotId}/${round5StrictEditSidecarFileNames.editableRegionEvidence}`,
    evidenceSha256: editableRegionEvidenceSha256,
    bboxNormalized,
    qaStatus: "pass",
    status: "ready",
    providerCalled: false,
  };
  const providerEditReceipt = {
    schemaVersion: "round5_provider_edit_receipt_v1",
    shotId,
    receiptId: `round5_${shotId}_strict_edit_preflight_${startFrameSha256.slice(0, 12)}`,
    receiptPath: `shots/${shotId}/${round5StrictEditSidecarFileNames.providerEditReceipt}`,
    status: "ready_for_provider_edit",
    operation: "image.edit",
    sourceStartFramePath: startPathInfo.startFramePath,
    sourceStartFrameSha256: startFrameSha256,
    sourceStartFrameAttachmentId: providerAttachmentId,
    editableRegionEvidencePath: `shots/${shotId}/${round5StrictEditSidecarFileNames.editableRegionEvidence}`,
    editableRegionEvidenceSha256,
    noFallbackUsed: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    videoSubmitted: false,
    workerSpawnForbidden: true,
    preparedAt,
  };

  writeCurrentProjectRuntimeJson(approvedPath, approvedStartFrameRef, source);
  writeCurrentProjectRuntimeJson(editablePath, editableRegionEvidence, source);
  writeCurrentProjectRuntimeJson(receiptPath, providerEditReceipt, source);

  const statusProjection = currentProjectRealChainResponse({
    running: extra.running,
    ignoredRequestContext: requestOverrideDiagnostics(requestContext),
  }, source);
  const preparedShot = statusProjection.round5ArtifactIngest?.shotGateMatrix?.find((shot) => shot.shotId === shotId);
  return {
    ok: true,
    ...runtimePolicy(),
    endpoint: currentProjectRound5StrictEditPrepareEndpoint,
    status: "prepared",
    previewStatus: statusProjection.previewStatus,
    productionStatus: statusProjection.productionStatus,
    reportStatus: statusProjection.reportStatus,
    currentProject: statusProjection.currentProject,
    requestContext: statusProjection.requestContext,
    ignoredRequestContext: requestOverrideDiagnostics(requestContext),
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    project,
    shotId,
    strictEditPreflightPrepareRan: true,
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
    liveSubmitAllowed: false,
    videoSubmitted: false,
    workerSpawnForbidden: true,
    sidecarWrites: [
      repoRelativePath(scopedRepoPath(approvedPath)),
      repoRelativePath(scopedRepoPath(editablePath)),
      repoRelativePath(scopedRepoPath(receiptPath)),
    ],
    approvedStartFrameRef,
    editableRegionEvidence,
    providerEditReceipt,
    shotGate: preparedShot,
    round5ArtifactIngest: statusProjection.round5ArtifactIngest,
    ignoredInputSha256: input.inputSha256 ? "sha256_from_request_ignored" : undefined,
    message: "Round 5 strict edit preflight sidecars are prepared. No provider call or project.vibe write was performed.",
  };
}

function currentProjectRound5StrictEditReturnResponse(input, extra = {}, source = currentProjectSource()) {
  const requestContext = extra.requestContext || {};
  const blockers = [];
  const generatedAt = new Date().toISOString();
  const project = projectIdentityFromSource(source);
  const report = readJsonIfPresent(source.reportPath);
  const shotId = input.shotId;

  if (!isRecord(report) || !isRound5FullRealChainReport(report, source)) {
    blockers.push("round5_full_real_chain_report_missing");
  }
  if (!shotId || safePathSegment(shotId) !== shotId) {
    blockers.push("shot_id_must_be_safe_path_segment");
  }

  const generated = Array.isArray(report?.generatedStartFrames)
    ? report.generatedStartFrames.find((item) => item?.shotId === shotId)
    : undefined;
  const shotQa = Array.isArray(report?.shotQa)
    ? report.shotQa.find((item) => item?.shotId === shotId)
    : undefined;
  if (isRecord(report) && !generated && !shotQa) blockers.push("shot_not_found");

  const startFrameSha256 = generated?.sha256;
  const startQaStatus = round5QaStatusFor(shotQa, generated);
  const endRequired = isRecord(report) && shotId ? round5EndRequiredFor(shotId, report, shotQa) : false;
  if (generated && startQaStatus !== "pass") blockers.push("start_qa_not_pass");
  if (generated && !endRequired) blockers.push("strict_edit_not_required_for_shot");

  const approvedPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.approvedStartFrame}`;
  const editablePath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.editableRegionEvidence}`;
  const receiptPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.providerEditReceipt}`;
  const approvedStartFrame = readRuntimeJson(approvedPath);
  const editableRegionEvidence = readRuntimeJson(editablePath);
  const providerEditReceipt = readRuntimeJson(receiptPath);
  const preflightBlockers = round5StrictEditEvidenceBlockers({
    qaStatus: startQaStatus,
    endRequired,
    generated,
    approvedStartFrame,
    editableRegionEvidence,
    providerEditReceipt,
  });
  blockers.push(...preflightBlockers.map((blocker) => `preflight_${blocker}`));
  const returnedProviderObservation = input.providerObservation || readRuntimeJson(input.returnedProviderObservationPath);

  const expectedEndFramePath = `${source.runRootRelativePath}/shots/${shotId}/end.png`;
  const returnedOutputPath = runtimeRelativeFromValue(input.returnedOutputPath) || expectedEndFramePath;
  const returnedOutputInsideProject = oneShotPathInsideRoot(returnedOutputPath, source.runRootRelativePath);
  const returnedOutputExists = runtimePathExists(returnedOutputPath);
  const outputSourceIsExpected = returnedOutputPath === expectedEndFramePath;
  if (!input.actualProviderReturned && !runtimePathExists(expectedEndFramePath)) blockers.push("actual_provider_return_required");
  if (!returnedOutputInsideProject) blockers.push("returned_output_outside_project_root");
  if (!returnedOutputExists) blockers.push("returned_output_missing");

  const providerRequestId = input.providerRequestId
    || asString(returnedProviderObservation?.providerRequestId)
    || asString(returnedProviderObservation?.requestId);
  if (!providerRequestId) blockers.push("provider_request_id_missing");
  blockers.push(...round5StrictEditProviderObservationBlockers({
    providerObservation: returnedProviderObservation,
    providerRequestId,
    generated,
    approvedStartFrame,
    editableRegionEvidence,
    providerEditReceipt,
  }));

  let endFrameSha256;
  let outputBytesWritten = 0;
  let writeError;
  if (!blockers.length) {
    try {
      const outputBytes = readFileSync(scopedRepoPath(returnedOutputPath));
      outputBytesWritten = outputBytes.length;
      endFrameSha256 = sha256Bytes(outputBytes);
      const observedOutputSha256 = asString(returnedProviderObservation?.outputSha256)
        || asString(returnedProviderObservation?.outputHash);
      if (observedOutputSha256 && observedOutputSha256 !== endFrameSha256) {
        blockers.push("provider_observation_output_sha_mismatch");
      }
      if (!blockers.length && !outputSourceIsExpected) {
        writeCurrentProjectRuntimeBytes(expectedEndFramePath, outputBytes, source);
      }
      const providerObservationPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.endProviderObservation}`;
      const semanticQaPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.endSemanticQa}`;
      const pairQaPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.endPairQa}`;
      const providerObservation = !blockers.length ? {
        ...(returnedProviderObservation || {}),
        schemaVersion: "round5_strict_edit_end_provider_observation_v1",
        generatedAt,
        providerObservationMode: "actual_provider_call_observed",
        provider: returnedProviderObservation?.provider || returnedProviderObservation?.providerId || "openai-image2-api",
        providerId: returnedProviderObservation?.providerId || returnedProviderObservation?.provider || "openai-image2-api",
        operation: "image.edit",
        providerRequestId,
        shotId,
        preflightReceiptId: providerEditReceipt.receiptId,
        receiptId: providerEditReceipt.receiptId,
        sourceStartFramePath: approvedStartFrame.startFramePath,
        sourceStartFrameSha256: startFrameSha256,
        sourceStartFrameAttachmentId: approvedStartFrame.providerAttachmentId,
        editableRegionEvidencePath: editableRegionEvidence.evidencePath || `shots/${shotId}/${round5StrictEditSidecarFileNames.editableRegionEvidence}`,
        editableRegionEvidenceSha256: editableRegionEvidence.evidenceSha256,
        outputPath: `shots/${shotId}/end.png`,
        outputSha256: endFrameSha256,
        outputBytes: outputBytesWritten,
        providerCalled: true,
        actualImage2Triggered: true,
        providerCallsAttempted: 1,
        maxProviderCallsPerExecution: 1,
        noFallbackUsed: true,
        externalNetworkCallMade: true,
        projectVibeWritten: false,
        workerSpawned: false,
      } : undefined;
      const semanticQa = {
        ...(input.semanticQa || readRuntimeJson(input.returnedSemanticQaPath) || {}),
        schemaVersion: "round5_strict_edit_end_semantic_qa_v1",
        generatedAt,
        reviewedAt: input.semanticQa?.reviewedAt || generatedAt,
        semanticReviewMode: "actual_image_semantic_review",
        shotId,
        outputPath: `shots/${shotId}/end.png`,
        expectedOutputPath: `shots/${shotId}/end.png`,
        outputSha256: endFrameSha256,
        reviewedOutputSha256: endFrameSha256,
        status: "needs_review",
        qaStatus: "needs_review",
        finalAssessment: {
          ...(isRecord(input.semanticQa?.finalAssessment) ? input.semanticQa.finalAssessment : {}),
          status: "needs_review",
        },
        providerCalled: true,
        actualImage2Triggered: true,
      };
      const pairQa = {
        schemaVersion: "round5_strict_edit_pair_qa_v1",
        generatedAt,
        status: "needs_review",
        shotId,
        startFramePath: approvedStartFrame.startFramePath,
        startFrameSha256,
        endFramePath: `shots/${shotId}/end.png`,
        endFrameSha256,
        sourceStartFrameAttachmentId: approvedStartFrame.providerAttachmentId,
        providerRequestId,
        pairReviewRequired: true,
        completeVerified: false,
        notes: ["Strict edit end frame returned; pair QA and human review are still required before production promotion."],
      };

      if (!blockers.length) {
        writeCurrentProjectRuntimeJson(providerObservationPath, providerObservation, source);
        writeCurrentProjectRuntimeJson(semanticQaPath, semanticQa, source);
        writeCurrentProjectRuntimeJson(pairQaPath, pairQa, source);
      }
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Round 5 strict edit return ingest failed.";
    }
  }

  if (writeError) blockers.push(writeError);
  const statusProjection = currentProjectRealChainResponse({
    running: extra.running,
    ignoredRequestContext: requestOverrideDiagnostics(requestContext),
  }, source);
  const returnedShot = statusProjection.round5ArtifactIngest?.shotGateMatrix?.find((shot) => shot.shotId === shotId);
  const hashBoundActual = returnedShot?.gateStatus === "end_returned_needs_review";
  if (!blockers.length && !hashBoundActual) blockers.push("strict_edit_end_return_not_hash_bound");

  if (blockers.length) {
    return round5StrictEditBlockedResponse(source, requestContext, input, blockers, {
      endpoint: currentProjectRound5StrictEditReturnEndpoint,
      strictEditReturnIngestRan: false,
      message: "Round 5 strict edit return was blocked before promotion.",
      reportPath: source.reportRelativePath,
      image2ReportPath: source.reportRelativePath,
    });
  }

  const providerObservationPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.endProviderObservation}`;
  const semanticQaPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.endSemanticQa}`;
  const pairQaPath = `${source.runRootRelativePath}/shots/${shotId}/${round5StrictEditSidecarFileNames.endPairQa}`;
  return {
    ok: true,
    ...runtimePolicy({
      runMode: "round5_strict_edit_return_ingest",
      providerCalled: true,
      dryRunOnly: false,
    }),
    endpoint: currentProjectRound5StrictEditReturnEndpoint,
    status: "strict_edit_end_returned_needs_review",
    uiStatus: "needs_review",
    previewStatus: statusProjection.previewStatus,
    productionStatus: "needs_review",
    reportStatus: statusProjection.reportStatus,
    currentProject: statusProjection.currentProject,
    requestContext: statusProjection.requestContext,
    ignoredRequestContext: requestOverrideDiagnostics(requestContext),
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    project,
    shotId,
    expectedOutputPath: expectedEndFramePath,
    returnedOutputPath,
    outputSha256: endFrameSha256,
    outputBytesWritten,
    providerObservationPath,
    semanticQaPath,
    pairQaPath,
    strictEditReturnIngestRan: true,
    providerCalled: true,
    actualImage2Triggered: true,
    prepareRan: false,
    projectVibeWritten: false,
    liveSubmitAllowed: false,
    videoSubmitted: false,
    workerSpawnForbidden: true,
    shotGate: returnedShot,
    round5ArtifactIngest: statusProjection.round5ArtifactIngest,
    message: "Round 5 strict edit end frame returned with hash-bound Image2 edit evidence and remains needs_review.",
  };
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
}

function asBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return undefined;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length))];
}

function image2BatchSubmitPolicy() {
  return {
    providerCallAllowed: false,
    dryRunOnly: true,
    manualSubmitRequired: true,
    liveSubmitAllowed: false,
    noSeedance: true,
    noJimeng: true,
    noVideo: true,
    noFast: true,
    noVip: true,
  };
}

function derivedShotPath(source, shotId, folder, suffix, ext) {
  return `${source.runRootRelativePath}/${folder}/${shotId}${suffix}.${ext}`;
}

function image2BatchPlanItem(source, observation, queueOrder, shotPlan = {}) {
  const shotId = observation.shotId || shotPlan.shotId || `shot_${queueOrder}`;
  const lowerShotId = String(shotId).toLowerCase();
  const blockers = Array.isArray(observation.blockers) ? observation.blockers : [];
  const packetPath = asString(shotPlan.packetPath) || derivedShotPath(source, shotId, "task_packets", "_start_frame_packet", "md");
  const envelopePath = asString(shotPlan.envelopePath) || derivedShotPath(source, shotId, "subagent_envelopes", "_start_frame_envelope", "json");
  const shotLayoutPath = derivedShotPath(source, shotId, "project/shot_layouts", "", "json");

  return {
    shotId,
    taskRunId: asString(shotPlan.taskRunId) || `task_run_${lowerShotId}_image2_batch_plan_check`,
    packetId: asString(shotPlan.taskPacketId) || asString(shotPlan.packetId) || `task_packet_${lowerShotId}_image2_batch_plan_check`,
    envelopeId: asString(shotPlan.envelopeId) || `subagent_envelope_${lowerShotId}_image2_batch_plan_check`,
    expectedOutputPath: asString(observation.expectedOutputPath) || asString(shotPlan.expectedOutputPath) || `${source.runRootRelativePath}/outputs/shots/${shotId}/start.png`,
    providerObservationPath: asString(shotPlan.providerObservationPath) || derivedShotPath(source, shotId, "provider_observations", "_start_provider_observation", "json"),
    semanticQaPath: asString(shotPlan.semanticQaPath) || derivedShotPath(source, shotId, "semantic_qa", "_start_semantic_qa", "json"),
    promptPath: asString(shotPlan.promptRequestPath) || asString(shotPlan.promptPath) || derivedShotPath(source, shotId, "prompt_requests", "_start_frame_prompt", "md"),
    referencePaths: uniqueStrings([
      source.projectVibeRelativePath,
      shotLayoutPath,
      `${source.runRootRelativePath}/project/source_index.json`,
      `${source.runRootRelativePath}/project/story_flow.json`,
      `${source.runRootRelativePath}/project/visual_memory.json`,
      packetPath,
      envelopePath,
      ...(Array.isArray(shotPlan.referencePaths) ? shotPlan.referencePaths : []),
    ]),
    queueOrder,
    blocked: blockers.length > 0,
    blockers,
    outputExists: observation.outputExists === true,
    providerObservationPresent: observation.providerObservationPresent === true,
    providerObservationActual: observation.providerObservationActual === true,
    providerOutputSha256: observation.providerOutputSha256,
    semanticQaPresent: observation.semanticQaPresent === true,
    semanticQaActual: observation.semanticQaActual === true,
    semanticQaStatus: observation.semanticQaStatus,
    semanticQaPassed: observation.semanticQaPassed === true,
    semanticQaNeedsReview: observation.semanticQaNeedsReview === true,
    previewStatus: observation.previewStatus,
    runtimeTruthStatus: observation.runtimeTruthStatus,
    reviewOverlay: observation.reviewOverlay === true,
  };
}

function image2BatchLedgerProjection(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const projections = items.map((item) => {
    const blocked = item.blocked === true || (Array.isArray(item.blockers) && item.blockers.length > 0);
    const completeVerified = !blocked && item.outputExists === true && item.providerObservationActual === true && item.semanticQaPassed === true;
    const reviewNeeded = !blocked && !completeVerified && (item.semanticQaNeedsReview === true || item.reviewOverlay === true);
    const currentStatus = blocked
      ? "parked"
      : completeVerified
        ? "complete_verified"
        : reviewNeeded
          ? "review_needed"
          : item.outputExists === true && item.providerObservationActual === true && item.semanticQaPresent !== true
            ? "qa_pending"
            : item.outputExists === true && item.providerObservationActual === true
              ? "provider_observed"
              : item.outputExists === true
                ? "output_detected_no_sidecar"
                : "queued";
    return {
      taskRunId: item.taskRunId,
      envelopeId: item.envelopeId,
      currentStatus,
      expectedOutputPath: item.expectedOutputPath,
      expectedOutputs: [
        {
          expectedOutputPath: item.expectedOutputPath,
          exists: item.outputExists === true,
          outputSha256: item.providerOutputSha256,
        },
      ],
      previewStatus: item.previewStatus || (item.outputExists ? "returned" : "missing"),
      completeVerified,
      providerObservationPresent: item.providerObservationPresent === true,
      providerObservationActual: item.providerObservationActual === true,
      semanticQaPresent: item.semanticQaPresent === true,
      semanticQaStatus: item.semanticQaStatus,
      reviewNeeded,
    };
  });
  const parked = projections.filter((item) => item.currentStatus === "parked").length;
  const completeVerified = projections.filter((item) => item.completeVerified === true).length;
  const reviewNeeded = projections.filter((item) => item.currentStatus === "review_needed").length;
  const queued = projections.filter((item) => item.currentStatus === "queued").length;

  return {
    schemaVersion: "vibe_core_current_project_image2_batch_ledger_projection_v1",
    projectId: payload.project?.projectId,
    runId: payload.project?.runId,
    ledgerTruthSource: payload.ledgerTruthSource,
    projectionSource: payload.projectionSource,
    factsUsed: payload.factsUsed,
    projections,
    summary: {
      total: projections.length,
      queued,
      blocked: parked,
      parked,
      reviewNeeded,
      completeVerified,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
  };
}

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

function oneShotRequestInput(url, body) {
  const receipt = isRecord(body?.receipt) ? body.receipt : isRecord(body?.prepareReceipt) ? body.prepareReceipt : undefined;
  const requestedTransportMode = asString(url.searchParams.get("transportMode"))
    || requestBodyString(body, ["transportMode", "mode"])
    || asString(receipt?.transportMode);
  const rawSelectedShotIds = Array.isArray(body?.selectedShotIds)
    ? body.selectedShotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
  const selectedShotId = asString(url.searchParams.get("selectedShotId"))
    || requestBodyString(body, ["selectedShotId", "shotId"])
    || asString(receipt?.selectedShotId);
  const selectedShotIds = rawSelectedShotIds.length
    ? rawSelectedShotIds
    : selectedShotId
      ? [selectedShotId]
      : [];
  const imageCount = Number.isInteger(body?.imageCount) ? body.imageCount : Number.isInteger(receipt?.imageCount) ? receipt.imageCount : 1;
  const maxProviderCallsRaw = asString(url.searchParams.get("maxProviderCallsPerReceipt"))
    || requestBodyString(body, ["maxProviderCallsPerReceipt"])
    || asString(receipt?.maxProviderCallsPerReceipt);
  const maxProviderCallsPerReceipt = maxProviderCallsRaw
    ? Number(maxProviderCallsRaw)
    : Number.isInteger(body?.maxProviderCallsPerReceipt)
      ? body.maxProviderCallsPerReceipt
      : 1;
  const bodyRequiresSubmitPermissionReceipt = asBoolean(body?.submitPermissionReceiptRequired)
    ?? asBoolean(body?.requireSubmitPermissionReceipt);
  const queryRequiresSubmitPermissionReceipt = asBoolean(url.searchParams.get("submitPermissionReceiptRequired"))
    ?? asBoolean(url.searchParams.get("requireSubmitPermissionReceipt"));
  const credentialRefProvided = url.searchParams.has("credentialRef")
    || (isRecord(body) && Object.prototype.hasOwnProperty.call(body, "credentialRef"));
  const credentialRef = asString(url.searchParams.get("credentialRef"))
    || requestBodyString(body, ["credentialRef"])
    || asString(receipt?.credentialRef);
  return {
    selectedShotId,
    selectedShotIds,
    imageCount,
    expectedOutputPath: requestBodyString(body, ["expectedOutputPath", "outputPath"]) || asString(receipt?.expectedOutputPath),
    expectedOutputs: Array.isArray(body?.expectedOutputs) ? body.expectedOutputs : undefined,
    credentialRef,
    credentialRefProvided,
    maxProviderCallsPerReceipt,
    submitPermissionReceiptRequired: queryRequiresSubmitPermissionReceipt ?? bodyRequiresSubmitPermissionReceipt ?? false,
    actionTimeConfirmation: isRecord(body?.actionTimeConfirmation) ? body.actionTimeConfirmation : undefined,
    receipt,
    transportMode: requestedTransportMode,
    requestedTransportMode,
    rawBody: isRecord(body) ? body : {},
    rawQuery: Object.fromEntries(url.searchParams.entries()),
  };
}

function oneShotPathInsideRoot(candidatePath, rootPath) {
  if (typeof candidatePath !== "string" || !candidatePath.trim()) return false;
  if (typeof rootPath !== "string" || !rootPath.trim()) return false;
  const normalizedPath = normalizeRelativePath(candidatePath.trim());
  const normalizedRoot = normalizeRelativePath(rootPath.trim());
  if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) return false;
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function oneShotLockedReferences(workbenchFacts, shot) {
  const assets = Array.isArray(workbenchFacts.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [];
  const locked = assets.filter((asset) => asset.status === "locked");
  const shotRoleIds = new Set(Array.isArray(shot?.roleIds) ? shot.roleIds : []);
  const shotId = shot?.id;
  const sceneId = shot?.sceneId || shot?.sectionId;
  const characters = locked.filter(
    (asset) =>
      asset.type === "character" &&
      (shotRoleIds.has(asset.id) || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
  );
  const scenes = locked.filter(
    (asset) =>
      asset.type === "scene" &&
      (asset.id === sceneId || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
  );
  const styles = locked.filter((asset) => asset.type === "style");
  return { characters, scenes, styles };
}

function oneShotQaChecklist(shotId) {
  return [
    { id: "identity", label: "角色一致", required: true, status: "pending", shotId },
    { id: "scene", label: "场景一致", required: true, status: "pending", shotId },
    { id: "style", label: "风格一致", required: true, status: "pending", shotId },
    { id: "start_frame", label: "首帧可用", required: true, status: "pending", shotId },
  ];
}

const oneShotTransportModes = new Set(currentProjectImage2TransportModes);
const oneShotExecutorModes = new Set(["mock_executor", "dry_run_executor", "real_provider_call"]);
const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key=|private[_-]?key|raw-secret)/i;
const secretKeyPattern = /(api[_-]?key|access[_-]?token|authorization|secret|password|bearer|credential|credentialmaterial|rawcredential|private[_-]?key)/i;

function oneShotTransportMode(input) {
  return normalizeCurrentProjectImage2TransportMode(input.transportMode);
}

function oneShotExecutorMode(input) {
  const raw = String(input.executorMode || input.mode || "").trim();
  if (!raw) return { mode: "dry_run_executor", provided: false, valid: true };
  const normalized = raw.toLowerCase();
  return {
    mode: oneShotExecutorModes.has(normalized) ? normalized : "dry_run_executor",
    raw,
    provided: true,
    valid: oneShotExecutorModes.has(normalized),
  };
}

function oneShotExecutorRequestInput(url, body) {
  const input = oneShotRequestInput(url, body);
  const mode = requestBodyString(body, ["executorMode"])
    || asString(url.searchParams.get("executorMode"))
    || requestBodyString(body, ["mode"])
    || asString(url.searchParams.get("mode"));
  return {
    ...input,
    receiptId: asString(url.searchParams.get("receiptId")) || requestBodyString(body, ["receiptId"]),
    executorMode: mode,
    mode,
    actualExecutionAllowed: body?.actualExecutionAllowed === true,
    providerCallAllowed: body?.providerCallAllowed === true,
    liveSubmitAllowed: body?.liveSubmitAllowed === true,
    realProviderGate: isRecord(body?.realProviderGate) ? body.realProviderGate : undefined,
    rawBody: isRecord(body) ? body : {},
  };
}

function oneShotReturnRequestInput(url, body) {
  const input = oneShotRequestInput(url, body);
  return {
    ...input,
    receiptId: asString(url.searchParams.get("receiptId")) || requestBodyString(body, ["receiptId"]),
    sourceImagePath: requestBodyString(body, ["sourceImagePath", "generatedImagePath", "providerOutputPath"]),
    actualProviderReturned: body?.actualProviderReturned === true,
    returnedOutputPath: requestBodyString(body, ["returnedOutputPath", "providerOutputPath", "actualOutputPath", "sourceImagePath", "generatedImagePath"]),
    returnedProviderObservationPath: requestBodyString(body, ["returnedProviderObservationPath", "actualProviderObservationPath"]),
    returnedSemanticQaPath: requestBodyString(body, ["returnedSemanticQaPath", "actualSemanticQaPath"]),
    providerObservation: isRecord(body?.providerObservation) ? body.providerObservation : undefined,
    semanticQa: isRecord(body?.semanticQa) ? body.semanticQa : undefined,
    provider: requestBodyString(body, ["provider"]) || "openai_image2_via_codex_imagegen",
    providerObservationMode: requestBodyString(body, ["providerObservationMode"]) || "actual_provider_call_observed",
    actualImage2Triggered: body?.actualImage2Triggered === true,
    providerCalled: body?.providerCalled === true,
    rawBody: isRecord(body) ? body : {},
  };
}

function oneShotStatePaths(shotRoot) {
  const stateRoot = `${shotRoot}/state`;
  return {
    stateRoot,
    receiptStatePath: `${stateRoot}/prepare-receipt.json`,
    handoffStatePath: `${stateRoot}/handoff-packet.json`,
    triggerPlanStatePath: `${stateRoot}/trigger-plan.json`,
    submitPermissionReceiptStatePath: `${stateRoot}/submit-permission-receipt.json`,
  };
}

function writeOneShotStateJson(relativePath, payload, stateRoot, sandboxRoot) {
  if (!oneShotPathInsideRoot(relativePath, sandboxRoot) || !oneShotPathInsideRoot(relativePath, stateRoot)) {
    throw new Error(`Refusing to write one-shot state outside sandbox: ${relativePath}`);
  }
  const filePath = scopedRepoPath(relativePath);
  const stateRootPath = scopedRepoPath(stateRoot);
  const sandboxRootPath = scopedRepoPath(sandboxRoot);
  const stateRootWithSep = `${stateRootPath}${path.sep}`;
  if (filePath !== stateRootPath && !filePath.startsWith(stateRootWithSep)) {
    throw new Error(`Refusing to write one-shot state outside shot state root: ${relativePath}`);
  }
  const dirPath = path.dirname(filePath);
  mkdirSync(dirPath, { recursive: true });
  const dirRealPath = realpathSync(dirPath);
  const stateRootRealPath = realpathSync(stateRootPath);
  const sandboxRootRealPath = realpathSync(sandboxRootPath);
  if ((dirRealPath !== stateRootRealPath && !dirRealPath.startsWith(`${stateRootRealPath}${path.sep}`))
    || (stateRootRealPath !== sandboxRootRealPath && !stateRootRealPath.startsWith(`${sandboxRootRealPath}${path.sep}`))
    || (sandboxRootRealPath !== repoRootRealPath && !sandboxRootRealPath.startsWith(`${repoRootRealPath}${path.sep}`))) {
    throw new Error(`Refusing to write one-shot state through an unsafe real path: ${relativePath}`);
  }
  const tempPath = path.join(dirPath, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function oneShotStateJson(relativePath, stateRoot, sandboxRoot) {
  if (!oneShotPathInsideRoot(relativePath, sandboxRoot) || !oneShotPathInsideRoot(relativePath, stateRoot)) return undefined;
  return readRuntimeJson(relativePath);
}

function oneShotReceiptMatches(candidate, receipt) {
  return isRecord(candidate)
    && candidate.schemaVersion === receipt.schemaVersion
    && candidate.receiptId === receipt.receiptId
    && candidate.status === "prepared"
    && candidate.projectId === receipt.projectId
    && candidate.projectRoot === receipt.projectRoot
    && candidate.selectedShotId === receipt.selectedShotId
    && candidate.expectedOutputPath === receipt.expectedOutputPath;
}

function oneShotHandoffMatches(candidate, receipt) {
  return isRecord(candidate)
    && candidate.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1"
    && candidate.packetId === `handoff_${receipt.receiptId}`
    && candidate.status === "ready_for_manual_transport"
    && candidate.receiptId === receipt.receiptId
    && candidate.projectId === receipt.projectId
    && candidate.projectRoot === receipt.projectRoot
    && candidate.selectedShotId === receipt.selectedShotId
    && candidate.expectedOutputPath === receipt.expectedOutputPath;
}

function oneShotTransportPlan(mode, {
  projectId,
  projectRoot,
  selectedShotId,
  promptPath,
  promptText,
  expectedOutputPath,
  providerObservationPath,
  semanticQaPath,
  handoffPacketPath,
  receiptStatePath,
  handoffStatePath,
  receiptId,
  requestedTransportMode,
  transportModeAllowed,
}) {
  const base = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_transport_plan_v1",
    mode,
    requestedTransportMode,
    transportModeAllowed,
    projectId,
    projectRoot,
    selectedShotId,
    receiptId,
    promptPath,
    promptText,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    receiptStatePath,
    handoffStatePath,
    actualExecutionAllowed: false,
    providerCallAllowed: false,
    providerCalled: false,
    actualImage2Triggered: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
    projectVibeWritten: false,
    requiresActionTimeConfirmation: true,
    actionTimeConfirmationRequired: true,
    forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
    outputMustReturnVia: "expected_output_and_sidecars",
  };
  if (mode === "codex_app_server") {
    return {
      ...base,
      target: "codex_app_server",
      endpoint: "/api/codex/app-server/image2/one-shot",
      requiredFields: ["projectId", "projectRoot", "receiptId", "selectedShotId", "expectedOutputPath", "providerObservationPath", "semanticQaPath", "receiptStatePath", "handoffStatePath"],
      externalCallPreparedOnly: true,
    };
  }
  if (mode === "codex_cli") {
    return {
      ...base,
      target: "codex_cli",
      commandTemplate: ["codex", "image", "one-shot", "--receipt", "<receiptStatePath>", "--handoff", "<handoffStatePath>"],
      command: "codex",
      args: ["image", "one-shot", "--receipt", receiptStatePath, "--handoff", handoffStatePath],
      cwd: repoRoot,
      externalCommandPreparedOnly: true,
    };
  }
  if (mode === "disabled") {
    return {
      ...base,
      target: "disabled",
      disabled: true,
      blockers: ["Image2 transport mode is disabled for this request."],
    };
  }
  return {
    ...base,
    target: "manual",
    manualTransportRequired: true,
  };
}

function currentProjectImage2OneShotResponse(action, input, extra = {}, source = currentProjectSource()) {
  const projection = projectProjectionFromSource(source);
  const { project, projectFacts } = projection;
  const workbenchFacts = currentProjectWorkbenchFacts(source, projectFacts);
  const shots = Array.isArray(workbenchFacts.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
  const selectedShotId = input.selectedShotId;
  const selectedShotIds = input.selectedShotIds || [];
  const selectedShot = shots.find((shot) => shot.id === selectedShotId);
  const shotPlans = Array.isArray(projectFacts.runManifest?.shotPlans) ? projectFacts.runManifest.shotPlans : [];
  const selectedShotPlan = shotPlans.find((shotPlan) => shotPlan?.shotId === selectedShotId) || {};
  const sandboxRoot = `${source.runRootRelativePath}/real-trigger-one-shot`;
  const shotRoot = `${sandboxRoot}/${safePathSegment(selectedShotId)}`;
  const statePaths = oneShotStatePaths(shotRoot);
  const expectedOutputPath = input.expectedOutputPath || `${shotRoot}/image2-start.png`;
  const promptPath = runtimeRelativeFromValue(selectedShotPlan.promptPath) || `${source.runRootRelativePath}/prompt_requests/${safePathSegment(selectedShotId)}_start_frame_prompt.md`;
  const promptText = promptPath && runtimePathExists(promptPath) ? readFileSync(scopedRepoPath(promptPath), "utf8") : "";
  const providerObservationPath = `${shotRoot}/provider_observations/image2-start-provider-observation.json`;
  const semanticQaPath = `${shotRoot}/semantic_qa/image2-start-semantic-qa.json`;
  const handoffPacketPath = `${shotRoot}/handoff/image2-start-handoff-packet.json`;
  const manifestPath = `${shotRoot}/manifest.json`;
  const qaReportPath = `${shotRoot}/qa/semantic-qa.json`;
  const persistedReceipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const persistedHandoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const persistedTriggerPlan = oneShotStateJson(statePaths.triggerPlanStatePath, statePaths.stateRoot, sandboxRoot);
  const persistedSubmitPermissionReceipt = oneShotStateJson(statePaths.submitPermissionReceiptStatePath, statePaths.stateRoot, sandboxRoot);
  const persistedTransportMode = asString(input.receipt?.transportMode)
    || asString(persistedReceipt?.transportMode)
    || asString(persistedHandoff?.transportPlan?.mode);
  const transport = oneShotTransportMode({
    ...input,
    transportMode: asString(input.transportMode) || persistedTransportMode,
  });
  const lockedReferences = selectedShot ? oneShotLockedReferences(workbenchFacts, selectedShot) : { characters: [], scenes: [], styles: [] };
  const outputPathSafe = oneShotPathInsideRoot(expectedOutputPath, source.runRootRelativePath)
    && oneShotPathInsideRoot(expectedOutputPath, sandboxRoot);
  const sidecarPathsSafe = [
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    manifestPath,
    qaReportPath,
    statePaths.receiptStatePath,
    statePaths.handoffStatePath,
    statePaths.submitPermissionReceiptStatePath,
  ]
    .every((item) => oneShotPathInsideRoot(item, sandboxRoot));
  const oneShotOnly = selectedShotIds.length === 1 && selectedShotIds[0] === selectedShotId && input.imageCount === 1;
  const blockers = uniqueStrings([
    projection.ok ? "" : "Current project runtime projection is unavailable.",
    selectedShotId ? "" : "Select one shot before preparing a sample.",
    selectedShotIds.length === 1 ? "" : "Image2 one-shot requires exactly one selected shot.",
    input.imageCount === 1 ? "" : "Image2 one-shot requires exactly one image.",
    selectedShot ? "" : "Selected shot was not found in the current project story flow.",
    transport.mode === "disabled" ? "Image2 transport mode is disabled for this request." : "",
    outputPathSafe ? "" : "Expected output path must stay inside the current project one-shot sandbox.",
    sidecarPathsSafe ? "" : "Observation, QA, manifest, and handoff paths must stay inside the one-shot sandbox.",
    lockedReferences.characters.length ? "" : "Locked character reference is required for this shot.",
    lockedReferences.scenes.length ? "" : "Locked scene reference is required for this shot.",
    lockedReferences.styles.length ? "" : "Locked style reference is required for this shot.",
  ]);
  const receiptId = `image2_one_shot_prepare_${safePathSegment(project.projectId || "project")}_${safePathSegment(selectedShotId)}_${safePathSegment(project.runId || "run")}`;
  const transportPlan = oneShotTransportPlan(transport.mode, {
    projectId: project.projectId,
    projectRoot: project.projectRoot,
    selectedShotId,
    promptPath,
    promptText,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    receiptStatePath: statePaths.receiptStatePath,
    handoffStatePath: statePaths.handoffStatePath,
    receiptId,
    requestedTransportMode: transport.raw || input.requestedTransportMode,
    transportModeAllowed: transport.valid,
  });
  const receipt = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_receipt_v1",
    receiptId,
    status: blockers.length ? "blocked" : "prepared",
    action: "prepare",
    generatedAt: new Date().toISOString(),
    projectId: project.projectId,
    projectRoot: project.projectRoot,
    projectVibePath: project.projectVibePath,
    selectedShotId,
    selectedShotIds,
    imageCount: input.imageCount,
    oneShotOnly,
    expectedOutputPath,
    promptPath,
    promptText,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    transportMode: transport.mode,
    transportPlan,
    sandbox: {
      root: sandboxRoot,
      shotRoot,
      allowedPrefixes: [sandboxRoot, shotRoot],
      manifestPath,
      qaReportPath,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
      triggerPlanStatePath: statePaths.triggerPlanStatePath,
      submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
      outsideRootWriteAllowed: false,
    },
    lockedReferences: {
      characters: lockedReferences.characters.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
      scenes: lockedReferences.scenes.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
      styles: lockedReferences.styles.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
    },
    qaChecklist: oneShotQaChecklist(selectedShotId),
    policy: {
      providerCalled: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      providerSubmitAllowed: 0,
      automaticSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      artifactFileMutationAllowed: false,
      statePersistenceAllowed: true,
      confirmationRequired: true,
    },
    blockers,
  };
  const receiptMatches = input.receipt
    && input.receipt.receiptId === receipt.receiptId
    && input.receipt.selectedShotId === selectedShotId
    && input.receipt.expectedOutputPath === expectedOutputPath
    && input.receipt.status === "prepared";
  const confirmBlockers = action === "confirm"
    ? uniqueStrings([
      ...blockers,
      input.receipt ? "" : "Action-time prepare receipt is required before confirmation.",
      receiptMatches ? "" : "Action-time prepare receipt must match the current project, shot, and output path.",
      oneShotOnly ? "" : "Confirmation is limited to one shot and one image.",
    ])
    : blockers;
  const confirmed = action === "confirm" && confirmBlockers.length === 0;
  const outputExists = runtimePathExists(expectedOutputPath);
  const outputSha256 = outputExists ? sha256File(scopedRepoPath(expectedOutputPath)) : undefined;
  const providerObservation = readRuntimeJson(providerObservationPath);
  const semanticQa = readRuntimeJson(semanticQaPath);
  const semantic = semanticQaSummary(semanticQa);
  const persistedReceiptUsable = action === "status"
    && oneShotReceiptMatches(persistedReceipt, receipt);
  const persistedHandoffUsable = action === "status"
    && persistedReceiptUsable
    && oneShotHandoffMatches(persistedHandoff, receipt)
    && persistedHandoff.providerCalled === false
    && persistedHandoff.liveSubmitAllowed === false;
  const persistedTriggerPlanUsable = action === "status"
    && persistedHandoffUsable
    && isRecord(persistedTriggerPlan)
    && persistedTriggerPlan.status === "trigger_plan_prepared"
    && persistedTriggerPlan.receiptId === receipt.receiptId
    && persistedTriggerPlan.handoffId === `handoff_${receipt.receiptId}`
    && persistedTriggerPlan.providerCalled === false
    && persistedTriggerPlan.actualImage2Triggered === false;
  const handoffPacket = {
    packetId: `handoff_${receipt.receiptId}`,
    schemaVersion: "vibe_core_current_project_image2_one_shot_handoff_packet_v1",
    receiptId: receipt.receiptId,
    projectId: project.projectId,
    projectRoot: project.projectRoot,
    selectedShotId,
    selectedShotIds,
    imageCount: input.imageCount,
    status: "ready_for_manual_transport",
    createdAt: new Date().toISOString(),
    requiresExternalAction: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
    projectVibeWritten: false,
    expectedOutputPath,
    promptPath,
    promptText,
    providerObservationPath,
    semanticQaPath,
    receiptStatePath: statePaths.receiptStatePath,
    handoffStatePath: statePaths.handoffStatePath,
    transportPlan,
    appServerContract: {
      mode: "codex_app_server_handoff_only",
      selectedShotId,
      expectedOutputPath,
      promptPath,
      providerObservationPath,
      semanticQaPath,
      qaChecklistPath: qaReportPath,
      manualTransportRequired: true,
      automaticSubmitAllowed: false,
      actualExecutionAllowed: false,
    },
  };
  if (action === "prepare" && confirmBlockers.length === 0) {
    writeOneShotStateJson(statePaths.receiptStatePath, receipt, statePaths.stateRoot, sandboxRoot);
  }
  if (confirmed) {
    writeOneShotStateJson(statePaths.receiptStatePath, receipt, statePaths.stateRoot, sandboxRoot);
    writeOneShotStateJson(statePaths.handoffStatePath, handoffPacket, statePaths.stateRoot, sandboxRoot);
  }
  const receiptForResponse = persistedReceiptUsable ? persistedReceipt : receipt;
  const handoffForResponse = confirmed ? handoffPacket : persistedHandoffUsable ? persistedHandoff : undefined;
  const providerObservationContext = {
    selectedShotId,
    receiptId: receiptForResponse?.receiptId || receipt.receiptId,
    handoffPacketId: handoffForResponse?.packetId || `handoff_${receipt.receiptId}`,
  };
  const hashBoundActual = Boolean(
    outputSha256
      && outputExists
      && actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, providerObservationContext)
      && actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256),
  );
  const providerObservationMode = hashBoundActual ? providerObservation?.providerObservationMode || "actual_provider_call_observed" : "not_observed";
  const semanticQaStatus = hashBoundActual ? semanticQa?.status || semanticQa?.qaStatus || semanticQa?.finalAssessment?.status || "needs_review" : "not_written";
  const returnSource = hashBoundActual ? "actual_provider_return_ingest" : "dry_run_projection_only";
  const formalPromotionBlockedReasons = hashBoundActual
    ? ["Formal promotion remains blocked until human QA approval after hash-bound provider return."]
    : [];
  const status = confirmBlockers.length
    ? "blocked"
    : outputExists && (semantic.passed || semantic.needsReview || semantic.present)
      ? "needs_review"
      : persistedTriggerPlanUsable
        ? "trigger_plan_prepared"
      : handoffForResponse
        ? "handoff_prepared"
        : action === "prepare" || persistedReceiptUsable
          ? "prepared"
          : "ready_to_prepare";
  const userLabel = status === "prepared"
    ? "确认 handoff"
    : status === "trigger_plan_prepared"
      ? "等待回流"
    : status === "handoff_prepared"
      ? "等待文件"
      : status === "needs_review"
        ? "需要复核"
        : status === "blocked"
          ? "待补齐"
          : "准备小样包";

  return {
    ok: confirmBlockers.length === 0,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_handoff_only",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    }),
    endpoint: action === "confirm"
      ? currentProjectImage2OneShotConfirmEndpoint
      : action === "prepare"
        ? currentProjectImage2OneShotPrepareEndpoint
        : currentProjectImage2OneShotStatusEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot",
    currentProject: {
      bound: true,
      bindingPath: source.bindingPathRelative,
      binding: source.binding,
    },
    requestContext: {
      projectRoot: source.requestProjectRoot,
      projectRootSource: source.requestContextSource,
      projectId: source.requestProjectId,
      projectIdSource: source.requestProjectIdSource,
      selectedShotId,
    },
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    identity: {
      projectId: project.projectId,
      projectRoot: project.projectRoot,
    },
    project,
    status,
    uiStatus: status,
    userLabel,
    providerRequestId: providerObservation?.providerRequestId,
    outputSha256,
    hashBoundActual,
    providerObservationMode,
    semanticQaStatus,
    returnSource,
    formalPromotionBlocked: hashBoundActual,
    formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
    formalPromotionBlockedReasons,
    selectedShotId,
    selectedShotIds,
    expectedOutputPath,
    promptPath,
    promptText,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    statePaths,
    submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
    receipt: receiptForResponse,
    handoffPacket: handoffForResponse,
    submitPermissionReceipt: isRecord(persistedSubmitPermissionReceipt) ? persistedSubmitPermissionReceipt : undefined,
    transportPlan,
    persistedState: {
      receiptPresent: persistedReceiptUsable || (action === "prepare" && confirmBlockers.length === 0) || confirmed,
      handoffPresent: persistedHandoffUsable || confirmed,
      triggerPlanPresent: persistedTriggerPlanUsable,
      submitPermissionReceiptPresent: isRecord(persistedSubmitPermissionReceipt)
        && persistedSubmitPermissionReceipt.receiptId === receipt.receiptId
        && persistedSubmitPermissionReceipt.handoffId === `handoff_${receipt.receiptId}`,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
      triggerPlanStatePath: statePaths.triggerPlanStatePath,
      submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
    },
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      outputExists,
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: Boolean(semanticQa),
      semanticQaPassed: semantic.passed,
      providerRequestId: providerObservation?.providerRequestId,
      outputSha256,
      hashBoundActual,
      providerObservationMode,
      semanticQaStatus,
      returnSource,
      formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
      formalPromotionBlockedReasons,
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: true,
    },
    previewProjection: {
      shotId: selectedShotId,
      status: outputExists ? (semantic.needsReview ? "needs_review" : "returned") : persistedTriggerPlanUsable ? "waiting_action_time_confirmation" : handoffForResponse ? "waiting_file" : "not_started",
      imageUrl: outputExists ? runtimeFileUrl(expectedOutputPath) : undefined,
      reviewRequired: semantic.needsReview,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      manualTransportRequired: true,
      dryRunOnly: true,
      noWorkerSpawn: true,
      artifactFileMutationAllowed: false,
      statePersistenceAllowed: true,
    },
    providerCallAllowed: false,
    actualExecutionAllowed: false,
    actionTimeConfirmationRequired: true,
    providerCalled: false,
    actualImage2Triggered: hashBoundActual,
    providerReturnIngested: hashBoundActual,
    externalProviderCallObserved: hashBoundActual,
    runtimeProviderSubmitAttempted: false,
    runtimeExternalNetworkCallMade: false,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers: confirmBlockers,
    message: confirmBlockers.length ? "小样暂时受阻，请补齐镜头、引用或输出位置。" : undefined,
    ...extra,
  };
}

function currentProjectImage2OneShotPrepareTriggerResponse(input, extra = {}, source = currentProjectSource()) {
  const generatedAt = new Date().toISOString();
  const statusProjection = currentProjectImage2OneShotResponse("status", {
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds,
    imageCount: input.imageCount,
    transportMode: input.transportMode,
  }, {}, source);
  const statePaths = statusProjection.statePaths || {};
  const sandboxRoot = statusProjection.receipt?.sandbox?.root;
  const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
  const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const promptPath = handoff?.promptPath || receipt?.promptPath || statusProjection.promptPath;
  const promptText = handoff?.promptText || receipt?.promptText || statusProjection.promptText || "";
  const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
  const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
  const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
  const triggerPlanPath = `${shotRoot}/trigger-plan/image2-start-trigger-plan.json`;
  const handoffId = handoff?.packetId || (receipt?.receiptId ? `handoff_${receipt.receiptId}` : undefined);
  const transportPlan = buildCurrentProjectImage2TransportPlan({
    generatedAt,
    cwd: repoRoot,
    transportMode: input.transportMode || handoff?.transportPlan?.mode || receipt?.transportMode || "manual",
    requestedTransportMode: input.requestedTransportMode,
    selectedShotId: handoff?.selectedShotId || receipt?.selectedShotId || input.selectedShotId,
    selectedShotIds: handoff?.selectedShotIds || receipt?.selectedShotIds || input.selectedShotIds,
    receiptId: receipt?.receiptId || input.receiptId,
    handoffId,
    promptPath,
    promptText,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    triggerPlanPath,
    receiptStatePath: statePaths.receiptStatePath,
    handoffStatePath: statePaths.handoffStatePath,
  });
  const projection = projectProjectionFromSource(source);
  const shotPlans = Array.isArray(projection.projectFacts?.runManifest?.shotPlans) ? projection.projectFacts.runManifest.shotPlans : [];
  const selectedShotPlan = shotPlans.find((shotPlan) => shotPlan?.shotId === transportPlan.selectedShotId) || {};
  const providerId = asString(selectedShotPlan.providerId) || "openai-image2-api";
  const providerSlot = asString(selectedShotPlan.providerSlot) || "image.generate";
  const requiredMode = asString(selectedShotPlan.requiredMode) || "text2image";
  const expectedOutputs = [
    {
      shotId: transportPlan.selectedShotId,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
    },
  ];
  const promptSha256 = promptPath && runtimePathExists(promptPath) ? sha256File(scopedRepoPath(promptPath)) : undefined;
  const pathSafe = oneShotExecutorPathInsideSandbox(triggerPlanPath, sandboxRoot, shotRoot);
  const rawCredentialMaterialPresent = inspectForRawCredentialMaterial(input.rawBody) || inspectForRawCredentialMaterial(input.rawQuery);
  const submitPermissionReceiptRequested = input.submitPermissionReceiptRequired === true
    || input.credentialRefProvided === true
    || Boolean(input.credentialRef);
  const blockers = uniqueStrings([
    isRecord(receipt) ? "" : "Persisted prepare receipt is required before trigger-plan.",
    isRecord(handoff) ? "" : "Persisted handoff packet is required before trigger-plan.",
    handoff?.status === "ready_for_manual_transport" ? "" : "Handoff must be ready_for_manual_transport before trigger-plan.",
    receipt?.status === "prepared" ? "" : "Prepare receipt must be status=prepared before trigger-plan.",
    pathSafe ? "" : "Trigger plan path must stay inside the one-shot sandbox.",
    transportPlan.transportModeAllowed ? "" : "Transport mode must be manual, codex_app_server, codex_cli, or disabled.",
    transportPlan.transportMode === "disabled" ? "Image2 transport mode is disabled for this request." : "",
    promptPath && promptText ? "" : "Prompt path and prompt text are required before trigger-plan.",
    rawCredentialMaterialPresent ? "Raw credential material or credential-like keys are forbidden." : "",
    submitPermissionReceiptRequested && !providerSubmitPermissionInputExpectedOutputsMatch(input.expectedOutputs, expectedOutputs) ? "Request expectedOutputs must match the prepared one-shot output paths." : "",
  ]);
  const submitPermissionReceipt = buildProviderSubmitPermissionReceiptState({
    generatedAt,
    receiptId: transportPlan.receiptId,
    handoffId: transportPlan.handoffId,
    providerId,
    providerSlot,
    requiredMode,
    selectedShotIds: transportPlan.selectedShotIds,
    expectedOutputs,
    credentialRef: input.credentialRef,
    maxProviderCallsPerReceipt: input.maxProviderCallsPerReceipt,
    actionTimeConfirmation: input.actionTimeConfirmation,
    promptPath,
    promptSha256,
    promptSnapshotPath: promptPath,
    rawBody: input.rawBody,
    rawQuery: input.rawQuery,
  });
  const submitPermissionReceiptBlockers = submitPermissionReceiptRequested ? submitPermissionReceipt.blockers : [];
  const submitPermissionReceiptReady = submitPermissionReceiptRequested
    && submitPermissionReceiptBlockers.length === 0
    && submitPermissionReceipt.status === "pending_action_time_confirmation";
  const prepareTriggerBlockers = uniqueStrings([...blockers, ...submitPermissionReceiptBlockers]);
  const triggerManifest = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_trigger_plan_v1",
    generatedAt,
    status: prepareTriggerBlockers.length ? "blocked" : "trigger_plan_prepared",
    selectedShotId: transportPlan.selectedShotId,
    selectedShotIds: transportPlan.selectedShotIds,
    receiptId: transportPlan.receiptId,
    handoffId: transportPlan.handoffId,
    providerId,
    providerSlot,
    requiredMode,
    promptPath,
    promptSha256,
    promptText,
    expectedOutputPath,
    expectedOutputs,
    providerObservationPath,
    semanticQaPath,
    submitPermissionReceiptRequested,
    submitPermissionReceipt: submitPermissionReceiptRequested ? submitPermissionReceipt : undefined,
    submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
    submitPermissionReceiptPresent: false,
    forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
    providerCallAllowed: false,
    actualExecutionAllowed: false,
    actionTimeConfirmationRequired: true,
    providerSubmitAllowed: 0,
    transportPlan,
    instruction: transportPlan.clearInstruction,
    returnExecutorInstruction: transportPlan.returnExecutorInstruction,
    providerCalled: false,
    actualImage2Triggered: false,
    runtimeProviderSubmitAttempted: false,
    runtimeExternalNetworkCallMade: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers: prepareTriggerBlockers,
  };

  let writeError;
  if (prepareTriggerBlockers.length === 0) {
    try {
      triggerManifest.submitPermissionReceiptPresent = submitPermissionReceiptReady;
      writeOneShotExecutorJson(triggerPlanPath, triggerManifest, sandboxRoot, shotRoot);
      writeOneShotStateJson(statePaths.triggerPlanStatePath, triggerManifest, statePaths.stateRoot, sandboxRoot);
      if (submitPermissionReceiptReady) {
        writeOneShotStateJson(statePaths.submitPermissionReceiptStatePath, submitPermissionReceipt, statePaths.stateRoot, sandboxRoot);
      }
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Trigger plan write failed.";
    }
  }
  const finalBlockers = uniqueStrings([...prepareTriggerBlockers, writeError]);
  const ok = finalBlockers.length === 0;

  return {
    ok,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_prepare_trigger_plan",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      dryRunOnly: true,
    }),
    endpoint: currentProjectImage2OneShotPrepareTriggerEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot_trigger_plan",
    currentProject: statusProjection.currentProject,
    requestContext: {
      ...statusProjection.requestContext,
      selectedShotId: input.selectedShotId,
      receiptId: input.receiptId || receipt?.receiptId,
    },
    projectRootMode: source.projectRootMode,
    projectRoot: statusProjection.projectRoot,
    projectId: statusProjection.projectId,
    project: statusProjection.project,
    status: ok ? "trigger_plan_prepared" : "blocked",
    uiStatus: ok ? "trigger_plan_prepared" : "blocked",
    userLabel: ok ? "等待回流" : "待补齐",
    selectedShotId: transportPlan.selectedShotId,
    selectedShotIds: transportPlan.selectedShotIds,
    receiptId: transportPlan.receiptId,
    handoffId: transportPlan.handoffId,
    promptPath,
    promptSha256,
    promptText,
    expectedOutputPath,
    expectedOutputs,
    providerObservationPath,
    semanticQaPath,
    triggerPlanPath,
    submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
    forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
    statePaths,
    receipt,
    handoffPacket: handoff,
    submitPermissionReceiptRequested,
    submitPermissionReceipt: submitPermissionReceiptRequested ? submitPermissionReceipt : undefined,
    triggerManifest,
    transportPlan,
    commandPreview: transportPlan.commandPreview,
    appServerPayloadPreview: transportPlan.appServerPayloadPreview,
    persistedState: {
      receiptPresent: isRecord(receipt),
      handoffPresent: isRecord(handoff),
      triggerPlanPresent: ok && runtimePathExists(triggerPlanPath),
      submitPermissionReceiptPresent: ok && submitPermissionReceiptReady && runtimePathExists(statePaths.submitPermissionReceiptStatePath),
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
      triggerPlanStatePath: statePaths.triggerPlanStatePath,
      submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
    },
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      outputExists: runtimePathExists(expectedOutputPath),
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: runtimePathExists(semanticQaPath),
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: true,
    },
    previewProjection: {
      shotId: transportPlan.selectedShotId,
      status: ok ? "waiting_action_time_confirmation" : "blocked",
      reviewRequired: false,
      providerCalled: false,
      actualImage2Triggered: false,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      realProviderCallAllowed: false,
      manualTransportRequired: true,
      actionTimeConfirmationRequired: true,
      providerSubmitRequestState: "pending_action_time_confirmation",
      dryRunOnly: true,
      noWorkerSpawn: true,
      projectVibeMutationAllowed: false,
      statePersistenceAllowed: true,
    },
    providerCallAllowed: false,
    actualExecutionAllowed: false,
    actionTimeConfirmationRequired: true,
    providerCalled: false,
    actualImage2Triggered: false,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers: finalBlockers,
    message: ok ? "外部 Image2 执行 handoff 已准备，等待回流确认；本 endpoint 未执行 provider。" : "外部 Image2 执行 handoff 暂时受阻。",
    ...extra,
  };
}

function inspectForRawCredentialMaterial(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return rawSecretValuePattern.test(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => inspectForRawCredentialMaterial(item));
  return Object.entries(value).some(([key, child]) => {
    if (key !== "credentialRef" && secretKeyPattern.test(key)) return true;
    return inspectForRawCredentialMaterial(child);
  });
}

const providerSubmitPermissionReceiptSchemaVersion = "0.1.0";
const providerSubmitPermissionHardLocks = {
  defaultLocked: true,
  actualExecutionAllowed: false,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  automaticSubmitAllowed: false,
  liveSubmitAllowed: false,
  externalNetworkIoAllowed: false,
  credentialMaterialAccessAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noWorkerSpawn: true,
  noFileMutation: true,
  projectVibeMutationAllowed: false,
  maxConcurrency: 1,
  maxAutoRetries: 0,
};

function providerSubmitPermissionExpectedOutputsMatch(selectedShotIds, expectedOutputs) {
  if (!Array.isArray(selectedShotIds) || !Array.isArray(expectedOutputs)) return false;
  if (selectedShotIds.length < 1 || selectedShotIds.length > 3) return false;
  if (new Set(selectedShotIds).size !== selectedShotIds.length) return false;
  if (expectedOutputs.length !== selectedShotIds.length) return false;
  return expectedOutputs.every((item) =>
    isRecord(item)
    && selectedShotIds.includes(item.shotId)
    && Boolean(asString(item.expectedOutputPath))
    && Boolean(asString(item.providerObservationPath))
    && Boolean(asString(item.semanticQaPath))
  );
}

function providerSubmitPermissionInputExpectedOutputsMatch(inputExpectedOutputs, expectedOutputs) {
  if (!Array.isArray(inputExpectedOutputs) || inputExpectedOutputs.length === 0) return true;
  if (inputExpectedOutputs.length !== expectedOutputs.length) return false;
  return inputExpectedOutputs.every((item) => {
    if (!isRecord(item)) return false;
    const expected = expectedOutputs.find((candidate) => candidate.shotId === item.shotId);
    return Boolean(expected)
      && (!item.expectedOutputPath || item.expectedOutputPath === expected.expectedOutputPath)
      && (!item.providerObservationPath || item.providerObservationPath === expected.providerObservationPath)
      && (!item.semanticQaPath || item.semanticQaPath === expected.semanticQaPath);
  });
}

function buildProviderSubmitPermissionReceiptState({
  generatedAt,
  receiptId,
  handoffId,
  providerId,
  providerSlot,
  requiredMode,
  selectedShotIds,
  expectedOutputs,
  credentialRef,
  maxProviderCallsPerReceipt,
  actionTimeConfirmation,
  promptPath,
  promptSha256,
  promptSnapshotPath,
  rawBody,
  rawQuery,
}) {
  const normalizedSelectedShotIds = Array.isArray(selectedShotIds)
    ? selectedShotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
  const normalizedExpectedOutputs = Array.isArray(expectedOutputs)
    ? expectedOutputs.map((item) => ({
      shotId: asString(item?.shotId) || "",
      expectedOutputPath: asString(item?.expectedOutputPath) || "",
      providerObservationPath: asString(item?.providerObservationPath) || "",
      semanticQaPath: asString(item?.semanticQaPath) || "",
    }))
    : [];
  const ref = asString(credentialRef) || "";
  const blockers = uniqueStrings([
    receiptId ? "" : "Submit permission receipt requires a prepare receipt id.",
    handoffId ? "" : "Submit permission receipt requires a handoff id.",
    providerId ? "" : "Submit permission receipt requires providerId.",
    providerSlot ? "" : "Submit permission receipt requires providerSlot.",
    requiredMode ? "" : "Submit permission receipt requires requiredMode.",
    normalizedSelectedShotIds.length >= 1 && normalizedSelectedShotIds.length <= 3 ? "" : "Submit permission receipt supports only 1-3 selected shots.",
    new Set(normalizedSelectedShotIds).size === normalizedSelectedShotIds.length ? "" : "Submit permission receipt selectedShotIds must be unique.",
    providerSubmitPermissionExpectedOutputsMatch(normalizedSelectedShotIds, normalizedExpectedOutputs) ? "" : "Submit permission expectedOutputs must match selectedShotIds.",
    ref ? "" : "credentialRef is required and must be an opaque reference.",
    rawSecretValuePattern.test(ref) ? "credentialRef must not contain raw credential material." : "",
    Number(maxProviderCallsPerReceipt) === 1 ? "" : "maxProviderCallsPerReceipt must equal 1.",
    inspectForRawCredentialMaterial(rawBody) || inspectForRawCredentialMaterial(rawQuery) ? "Raw credential material or credential-like keys are forbidden." : "",
  ]);
  return {
    schemaVersion: providerSubmitPermissionReceiptSchemaVersion,
    generatedAt,
    receiptId,
    handoffId,
    status: blockers.length ? "blocked" : "pending_action_time_confirmation",
    blockers,
    providerId,
    providerSlot,
    requiredMode,
    selectedShotIds: normalizedSelectedShotIds,
    expectedOutputs: normalizedExpectedOutputs,
    credential: {
      credentialRef: ref,
      authorizedReferenceOnly: true,
      secretMaterialPresent: false,
      credentialMaterialStored: false,
      credentialMaterialRead: false,
    },
    submitIntent: {
      providerId,
      providerSlot,
      requiredMode,
      maxProviderCallsPerReceipt: 1,
      providerSubmitAllowed: 0,
      providerSubmitRequestState: "pending_action_time_confirmation",
    },
    actionTimeConfirmationRequired: true,
    actionTimeConfirmation: {
      required: true,
      userConfirmedAtActionTime: false,
      confirmationReceiptId: asString(actionTimeConfirmation?.confirmationReceiptId),
      confirmationCapturedAt: asString(actionTimeConfirmation?.confirmationCapturedAt),
    },
    promptPath,
    promptSha256,
    promptSnapshotPath,
    maxProviderCallsPerReceipt: 1,
    providerCalled: false,
    runtimeProviderSubmitAttempted: false,
    runtimeExternalNetworkCallMade: false,
    projectVibeWritten: false,
    hardLocks: providerSubmitPermissionHardLocks,
    notes: [
      "This is a state-only provider submit permission receipt.",
      "Provider submit, credential material reads, external network IO, workers, and project.vibe mutation remain locked.",
    ],
  };
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function oneShotExecutorPathInsideSandbox(relativePath, sandboxRoot, shotRoot) {
  return oneShotPathInsideRoot(relativePath, sandboxRoot) && oneShotPathInsideRoot(relativePath, shotRoot);
}

function assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot) {
  if (!oneShotExecutorPathInsideSandbox(relativePath, sandboxRoot, shotRoot)) {
    throw new Error(`Refusing to write outside one-shot executor sandbox: ${relativePath}`);
  }
  if (path.basename(relativePath) === "project.vibe" || normalizeRelativePath(relativePath).includes("/project.vibe")) {
    throw new Error(`Refusing to mutate project.vibe from executor: ${relativePath}`);
  }
  const filePath = scopedRepoPath(relativePath);
  const sandboxPath = scopedRepoPath(sandboxRoot);
  const shotPath = scopedRepoPath(shotRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const dirRealPath = realpathSync(path.dirname(filePath));
  const sandboxRealPath = realpathSync(sandboxPath);
  const shotRealPath = realpathSync(shotPath);
  const sandboxWithSep = `${sandboxRealPath}${path.sep}`;
  const shotWithSep = `${shotRealPath}${path.sep}`;
  if ((dirRealPath !== sandboxRealPath && !dirRealPath.startsWith(sandboxWithSep))
    || (dirRealPath !== shotRealPath && !dirRealPath.startsWith(shotWithSep))
    || (sandboxRealPath !== repoRootRealPath && !sandboxRealPath.startsWith(`${repoRootRealPath}${path.sep}`))) {
    throw new Error(`Refusing to write through unsafe executor real path: ${relativePath}`);
  }
  if (existsSync(filePath)) {
    const fileRealPath = realpathSync(filePath);
    if ((fileRealPath !== sandboxRealPath && !fileRealPath.startsWith(sandboxWithSep))
      || (fileRealPath !== shotRealPath && !fileRealPath.startsWith(shotWithSep))) {
      throw new Error(`Refusing to overwrite unsafe executor path: ${relativePath}`);
    }
  }
  return filePath;
}

function writeOneShotExecutorJson(relativePath, payload, sandboxRoot, shotRoot) {
  const filePath = assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function writeOneShotExecutorBytes(relativePath, bytes, sandboxRoot, shotRoot) {
  const filePath = assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, bytes);
  renameSync(tempPath, filePath);
  return filePath;
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  if (!candidatePath || !rootPath) return false;
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

function assertCurrentProjectRuntimeWritePath(relativePath, source) {
  const normalized = normalizeRelativePath(relativePath || "");
  if (!oneShotPathInsideRoot(normalized, source.runRootRelativePath)) {
    throw new Error(`Refusing to write return projection outside current project root: ${relativePath}`);
  }
  if (path.basename(normalized) === "project.vibe" || normalized.includes("/project.vibe")) {
    throw new Error(`Refusing to mutate project.vibe from provider return ingestion: ${relativePath}`);
  }
  const filePath = scopedRepoPath(normalized);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const dirRealPath = realpathSync(path.dirname(filePath));
  const runRootRealPath = realpathSync(source.runRootPath);
  if (!isPathInsideRealRoot(dirRealPath, runRootRealPath)) {
    throw new Error(`Refusing to write through unsafe project return path: ${relativePath}`);
  }
  return filePath;
}

function writeCurrentProjectRuntimeJson(relativePath, payload, source) {
  const filePath = assertCurrentProjectRuntimeWritePath(relativePath, source);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function writeCurrentProjectRuntimeBytes(relativePath, bytes, source) {
  const filePath = assertCurrentProjectRuntimeWritePath(relativePath, source);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, bytes);
  renameSync(tempPath, filePath);
  return filePath;
}

function upsertByShotId(items, item) {
  const existingItems = Array.isArray(items) ? items.filter(isRecord) : [];
  const index = existingItems.findIndex((candidate) => candidate.shotId === item.shotId);
  if (index >= 0) {
    existingItems[index] = { ...existingItems[index], ...item };
    return existingItems;
  }
  return [...existingItems, item];
}

function currentProjectOneShotReturnProjection(source, {
  generatedAt,
  project,
  receipt,
  handoff,
  expectedOutputPath,
  providerObservationPath,
  semanticQaPath,
  manifestPath,
  qaReportPath,
  outputSha256,
  imageInfo,
  sourceImagePath,
  providerName,
}) {
  const shotId = receipt.selectedShotId;
  const runtimeItem = {
    shotId,
    status: "needs_review",
    expectedOutputPath,
    outputSha256,
    imageInfo,
    providerObservationPath,
    semanticQaPath,
    blockers: [],
  };
  const clip = {
    order: 1,
    shotId,
    mediaPath: expectedOutputPath,
    status: "returned_with_review_overlay",
    previewQaStatus: "needs_review_overlay",
    productionQaStatus: "needs_review",
    durationSeconds: 5,
  };
  const observation = {
    order: 1,
    shotId,
    expectedOutputPath,
    outputSha256,
    imageInfo,
    qaStatus: "needs_review",
    previewQaStatus: "needs_review_overlay",
    productionQaStatus: "needs_review",
    reviewOverlay: true,
    blockers: [],
  };
  const runtimeTruth = {
    ...(readRuntimeJson(source.runtimeTruthLayerRelativePath) || {}),
    schemaVersion: "runtime_truth_layer_v1",
    generatedAt,
    status: "real_image2_one_shot_returned_needs_review",
    items: upsertByShotId(readRuntimeJson(source.runtimeTruthLayerRelativePath)?.items, runtimeItem),
  };
  const previewPlan = {
    ...(readRuntimeJson(source.previewPlanRelativePath) || {}),
    schemaVersion: "preview_plan_v1",
    generatedAt,
    status: "real_image2_one_shot_returned_needs_review",
    previewStatus: "real_image2_one_shot_returned_needs_review",
    productionStatus: "needs_review",
    reviewOverlayShots: uniqueStrings([
      ...(readRuntimeJson(source.previewPlanRelativePath)?.reviewOverlayShots || []),
      shotId,
    ]),
    productionNeedsReviewShots: uniqueStrings([
      ...(readRuntimeJson(source.previewPlanRelativePath)?.productionNeedsReviewShots || []),
      shotId,
    ]),
    clips: upsertByShotId(readRuntimeJson(source.previewPlanRelativePath)?.clips, clip),
  };
  const report = {
    ...(readRuntimeJson(source.reportRelativePath) || {}),
    schemaVersion: "current_project_real_image2_one_shot_return_v1",
    generatedAt,
    projectId: project.projectId,
    runId: project.runId || `${safePathSegment(project.projectId || "project")}_one_shot_return`,
    status: "real_image2_one_shot_returned_needs_review",
    previewStatus: "real_image2_one_shot_returned_needs_review",
    productionStatus: "needs_review",
    providerCalled: true,
    actualImage2Triggered: true,
    realProviderAttemptCount: 1,
    seedanceOrJimengUsed: false,
    fastOrVipUsed: false,
    videoGenerated: false,
    reviewOverlayShots: uniqueStrings([
      ...(readRuntimeJson(source.reportRelativePath)?.reviewOverlayShots || []),
      shotId,
    ]),
    productionNeedsReviewShots: uniqueStrings([
      ...(readRuntimeJson(source.reportRelativePath)?.productionNeedsReviewShots || []),
      shotId,
    ]),
    blockers: [],
    observations: upsertByShotId(readRuntimeJson(source.reportRelativePath)?.observations, observation),
    latestOneShotReturn: {
      shotId,
      provider: providerName,
      sourceImagePath,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      outputSha256,
      status: "needs_review",
    },
  };
  return { runtimeTruth, previewPlan, report };
}

function realProviderGateSatisfied(gate) {
  return isRecord(gate)
    && gate.explicitUserConfirmed === true
    && gate.allowRealProviderCall === true
    && gate.confirmationScope === "single_image2_one_shot"
    && gate.maxProviderCalls === 1
    && gate.mainThreadFinalConfirmation === true;
}

function oneShotExecutorChecks({ modeInfo, input, receipt, handoff, sandboxRoot, shotRoot, expectedOutputPath, providerObservationPath, semanticQaPath, manifestPath, qaReportPath }) {
  const receiptPolicy = isRecord(receipt?.policy) ? receipt.policy : {};
  const transportPlan = isRecord(handoff?.transportPlan) ? handoff.transportPlan : {};
  const appServerContract = isRecord(handoff?.appServerContract) ? handoff.appServerContract : {};
  const requestedOutputPath = input.expectedOutputPath ? normalizeRelativePath(input.expectedOutputPath) : undefined;
  const requestedUnsafeFlags = input.rawBody?.liveSubmitAllowed === true
    || input.rawBody?.providerCalled === true
    || input.rawBody?.externalNetworkIoAllowed === true
    || input.rawBody?.workerSpawnAllowed === true
    || input.rawBody?.projectVibeWritten === true;
  const checks = [
    ["mode_allowlisted", modeInfo.valid, "Executor mode must be mock_executor, dry_run_executor, or explicitly gated real_provider_call."],
    ["persisted_prepare_receipt_present", isRecord(receipt), "Persisted prepare receipt is required."],
    ["persisted_handoff_packet_present", isRecord(handoff), "Persisted handoff packet is required."],
    ["prepare_receipt_schema", receipt?.schemaVersion === "vibe_core_current_project_image2_one_shot_receipt_v1", "Persisted prepare receipt schema is not recognized."],
    ["prepare_receipt_status", receipt?.status === "prepared", "Persisted prepare receipt must have status=prepared."],
    ["handoff_schema", handoff?.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1", "Persisted handoff packet schema is not recognized."],
    ["handoff_status", handoff?.status === "ready_for_manual_transport", "Persisted handoff packet must have status=ready_for_manual_transport."],
    ["handoff_receipt_id_matches", handoff?.receiptId === receipt?.receiptId, "Handoff receiptId must match the persisted prepare receipt."],
    ["handoff_packet_id_matches", handoff?.packetId === `handoff_${receipt?.receiptId || ""}`, "Handoff packetId must derive from receiptId."],
    ["selected_shot_matches", handoff?.selectedShotId === receipt?.selectedShotId, "Handoff selectedShotId must match the persisted prepare receipt."],
    ["expected_output_matches", normalizeRelativePath(handoff?.expectedOutputPath || "") === normalizeRelativePath(receipt?.expectedOutputPath || ""), "Handoff expectedOutputPath must match the persisted prepare receipt."],
    ["request_selected_shot_matches", !input.selectedShotId || input.selectedShotId === handoff?.selectedShotId, "Requested selectedShotId must match persisted handoff packet."],
    ["request_receipt_id_matches", !input.receiptId || input.receiptId === receipt?.receiptId, "Requested receiptId must match persisted prepare receipt."],
    ["request_expected_output_matches", !requestedOutputPath || requestedOutputPath === normalizeRelativePath(expectedOutputPath || ""), "Requested expectedOutputPath must match persisted handoff packet."],
    ["one_shot_only", receipt?.oneShotOnly === true && receipt?.imageCount === 1, "Executor contract only consumes one shot and one image per handoff."],
    ["sandbox_root_present", Boolean(sandboxRoot), "Persisted prepare receipt sandbox.root is required."],
    ["shot_root_inside_sandbox", oneShotPathInsideRoot(shotRoot, sandboxRoot), "Persisted prepare receipt shotRoot must stay inside sandbox.root."],
    ["expected_output_inside_sandbox", oneShotExecutorPathInsideSandbox(expectedOutputPath, sandboxRoot, shotRoot), "Expected output path must stay inside the one-shot sandbox."],
    ["provider_observation_inside_sandbox", oneShotExecutorPathInsideSandbox(providerObservationPath, sandboxRoot, shotRoot), "Provider observation path must stay inside the one-shot sandbox."],
    ["semantic_qa_inside_sandbox", oneShotExecutorPathInsideSandbox(semanticQaPath, sandboxRoot, shotRoot), "Semantic QA path must stay inside the one-shot sandbox."],
    ["manifest_inside_sandbox", oneShotExecutorPathInsideSandbox(manifestPath, sandboxRoot, shotRoot), "Manifest path must stay inside the one-shot sandbox."],
    ["qa_report_inside_sandbox", oneShotExecutorPathInsideSandbox(qaReportPath, sandboxRoot, shotRoot), "QA report path must stay inside the one-shot sandbox."],
    ["receipt_state_inside_sandbox", oneShotExecutorPathInsideSandbox(receipt?.sandbox?.receiptStatePath, sandboxRoot, shotRoot), "Receipt state path must stay inside the one-shot sandbox."],
    ["handoff_state_inside_sandbox", oneShotExecutorPathInsideSandbox(receipt?.sandbox?.handoffStatePath, sandboxRoot, shotRoot), "Handoff state path must stay inside the one-shot sandbox."],
    ["transport_mode_codex_app_server", transportPlan.mode === "codex_app_server", "Executor can only consume codex_app_server handoff transport."],
    ["transport_target_codex_app_server", transportPlan.target === "codex_app_server", "Executor can only consume codex_app_server target handoffs."],
    ["transport_endpoint_codex_app_server", transportPlan.endpoint === "/api/codex/app-server/image2/one-shot", "Codex app-server handoff endpoint drifted."],
    ["transport_prepared_only", transportPlan.externalCallPreparedOnly === true, "Codex app-server handoff must remain prepared-only before executor consumption."],
    ["app_server_contract_mode", appServerContract.mode === "codex_app_server_handoff_only", "App-server contract mode must remain handoff-only."],
    ["requires_external_action", handoff?.requiresExternalAction === true, "Handoff packet must require an external action boundary."],
    ["receipt_provider_called_false", receiptPolicy.providerCalled === false, "Persisted prepare receipt must keep providerCalled=false."],
    ["receipt_provider_submit_zero", receiptPolicy.providerSubmitAllowed === 0, "Persisted prepare receipt must keep providerSubmitAllowed=0."],
    ["receipt_automatic_submit_false", receiptPolicy.automaticSubmitAllowed === false, "Persisted prepare receipt must keep automaticSubmitAllowed=false."],
    ["receipt_live_submit_false", receiptPolicy.liveSubmitAllowed === false, "Persisted prepare receipt must keep liveSubmitAllowed=false."],
    ["receipt_external_network_false", receiptPolicy.externalNetworkIoAllowed === false, "Persisted prepare receipt must keep externalNetworkIoAllowed=false."],
    ["receipt_worker_spawn_forbidden", receiptPolicy.workerSpawnForbidden === true, "Persisted prepare receipt must keep workerSpawnForbidden=true."],
    ["receipt_project_vibe_not_written", receiptPolicy.projectVibeWritten === false, "Persisted prepare receipt must keep projectVibeWritten=false."],
    ["handoff_provider_called_false", handoff?.providerCalled === false, "Persisted handoff packet must keep providerCalled=false."],
    ["handoff_live_submit_false", handoff?.liveSubmitAllowed === false, "Persisted handoff packet must keep liveSubmitAllowed=false."],
    ["handoff_worker_spawn_forbidden", handoff?.workerSpawnForbidden === true, "Persisted handoff packet must keep workerSpawnForbidden=true."],
    ["handoff_project_vibe_not_written", handoff?.projectVibeWritten === false, "Persisted handoff packet must keep projectVibeWritten=false."],
    ["transport_actual_execution_false", transportPlan.actualExecutionAllowed === false, "Handoff transport plan must keep actualExecutionAllowed=false."],
    ["transport_provider_called_false", transportPlan.providerCalled === false, "Handoff transport plan must keep providerCalled=false."],
    ["transport_live_submit_false", transportPlan.liveSubmitAllowed === false, "Handoff transport plan must keep liveSubmitAllowed=false."],
    ["transport_worker_spawn_forbidden", transportPlan.workerSpawnForbidden === true, "Handoff transport plan must keep workerSpawnForbidden=true."],
    ["app_server_manual_transport_required", appServerContract.manualTransportRequired === true, "App-server contract must require manual transport."],
    ["app_server_automatic_submit_false", appServerContract.automaticSubmitAllowed === false, "App-server contract must keep automaticSubmitAllowed=false."],
    ["app_server_actual_execution_false", appServerContract.actualExecutionAllowed === false, "App-server contract must keep actualExecutionAllowed=false."],
    ["request_does_not_escalate_locks", requestedUnsafeFlags === false, "Executor request body must not attempt live submit, provider call, worker spawn, network I/O, or project.vibe mutation."],
    ["raw_credentials_absent", !inspectForRawCredentialMaterial(input.rawBody) && !inspectForRawCredentialMaterial(receipt) && !inspectForRawCredentialMaterial(handoff), "Raw credential material is forbidden; executor may only see scoped references."],
  ];
  if (modeInfo.mode === "real_provider_call") {
    checks.push(
      ["real_provider_gate_satisfied", realProviderGateSatisfied(input.realProviderGate), "Real provider call mode requires an explicit single-call main-thread gate."],
      ["real_provider_runtime_blocked", false, "Real provider execution remains blocked in this runtime adapter until a live provider implementation is explicitly enabled."],
    );
  }
  return checks.map(([checkId, passed, blocker]) => ({
    checkId,
    status: passed ? "passed" : "blocked",
    blocker: passed ? undefined : blocker,
  }));
}

function oneShotExecutorContract(input, context) {
  const checks = oneShotExecutorChecks({ input, ...context });
  const blockers = uniqueStrings(checks.map((item) => item.blocker));
  const outputReturned = context.outputReturned === true && context.modeInfo.mode === "mock_executor" && blockers.length === 0;
  const status = blockers.length
    ? "blocked"
    : outputReturned
      ? "mock_output_returned_needs_review"
      : context.modeInfo.mode === "mock_executor"
        ? "executor_ready_mock"
        : "dry_run_executor_ready";
  return {
    schemaVersion: "0.1.0",
    generatedAt: context.generatedAt,
    phase: "real_image2_executor_adapter_contract",
    mode: context.modeInfo.mode,
    status,
    selectedShotId: context.handoff?.selectedShotId || context.receipt?.selectedShotId,
    receiptId: context.handoff?.receiptId || context.receipt?.receiptId,
    expectedOutputPath: context.expectedOutputPath,
    checks,
    outputReturnContract: {
      expectedOutputPath: context.expectedOutputPath,
      sandboxRoot: context.sandboxRoot,
      shotRoot: context.shotRoot,
      providerObservationPath: context.providerObservationPath,
      semanticQaPath: context.semanticQaPath,
      manifestPath: context.manifestPath,
      qaReportPath: context.qaReportPath,
      watcherProjection: {
        expectedOutputDetected: outputReturned,
        watcherStarted: false,
        daemonStarted: false,
        source: context.modeInfo.mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
      },
      providerObservation: {
        providerId: "openai-image2-api",
        providerObservationMode: outputReturned ? "mock_readiness_evidence" : "not_observed",
        providerCalled: false,
        externalNetworkCallMade: false,
      },
      manifest: {
        manifestMatched: outputReturned,
        status: outputReturned ? "mock_output_present" : "not_written",
      },
      semanticQa: {
        semanticReviewMode: outputReturned ? "mock_executor_semantic_review" : "not_observed",
        status: outputReturned ? "needs_review" : "not_written",
      },
      previewProjection: {
        status,
        needsHumanReview: outputReturned,
      },
    },
    providerCallContract: {
      maxProviderCallsPerExecution: 1,
      providerCallsAttempted: 0,
      providerCalled: false,
      externalNetworkIoAllowed: false,
      rawCredentialAccessAllowed: false,
      workerSpawnAllowed: false,
      projectVibeMutationAllowed: false,
      realProviderCallRequiresExplicitGate: true,
      realProviderGateSatisfied: realProviderGateSatisfied(input.realProviderGate),
    },
    blockers,
    warnings: uniqueStrings([
      context.modeInfo.mode === "mock_executor" ? "Mock executor may write only test output and sidecars inside the one-shot sandbox." : "",
      context.modeInfo.mode === "dry_run_executor" ? "Dry-run executor validates the handoff but does not write output files." : "",
      outputReturned ? "Mock output is review evidence only and is not a real provider result." : "",
    ]),
    notes: [
      "Executor input must be the persisted prepare receipt plus persisted handoff packet.",
      "The adapter allows at most one provider call by contract, but this mock/dry-run implementation attempts zero provider calls.",
      "Completion must flow through output, provider observation, manifest, semantic QA, and preview projection evidence.",
    ],
  };
}

function providerObservationContextBlockers(providerObservation, expectedContext = {}) {
  if (!isRecord(providerObservation)) return ["Provider observation sidecar is required."];
  const blockers = [];
  const selectedShotId = asString(expectedContext.selectedShotId);
  const receiptId = asString(expectedContext.receiptId);
  const handoffPacketId = asString(expectedContext.handoffPacketId);
  if (!asString(providerObservation.selectedShotId)) {
    blockers.push("Provider observation must include selectedShotId for the current shot.");
  } else if (selectedShotId && asString(providerObservation.selectedShotId) !== selectedShotId) {
    blockers.push("Provider observation selectedShotId does not match the current shot.");
  }
  if (!asString(providerObservation.receiptId)) {
    blockers.push("Provider observation must include receiptId for the current receipt.");
  } else if (receiptId && asString(providerObservation.receiptId) !== receiptId) {
    blockers.push("Provider observation receiptId does not match the current receipt.");
  }
  if (!asString(providerObservation.handoffPacketId)) {
    blockers.push("Provider observation must include handoffPacketId for the current handoff.");
  } else if (handoffPacketId && asString(providerObservation.handoffPacketId) !== handoffPacketId) {
    blockers.push("Provider observation handoffPacketId does not match the current handoff.");
  }
  return blockers;
}

function actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, expectedContext = {}) {
  if (!isRecord(providerObservation)) return false;
  const provider = String(providerObservation.provider || providerObservation.providerId || "");
  const outputPath = runtimeRelativeFromValue(providerObservation.outputPath);
  const observedHash = asString(providerObservation.outputSha256) || asString(providerObservation.outputHash);
  const providerRequestId = asString(providerObservation.providerRequestId);
  const contextMatches = providerObservationContextBlockers(providerObservation, expectedContext).length === 0;
  return providerObservation.providerObservationMode === "actual_provider_call_observed"
    && /image2/i.test(provider)
    && Boolean(providerRequestId)
    && contextMatches
    && outputPath === expectedOutputPath
    && observedHash === outputSha256
    && providerObservation.providerCalled === true
    && providerObservation.actualImage2Triggered === true;
}

function actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256) {
  if (!isRecord(semanticQa)) return false;
  const outputPath = runtimeRelativeFromValue(semanticQa.outputPath) || runtimeRelativeFromValue(semanticQa.expectedOutputPath);
  const reviewedHash = asString(semanticQa.reviewedOutputSha256) || asString(semanticQa.outputSha256);
  const status = semanticQa.finalAssessment?.status || semanticQa.qaStatus || semanticQa.status;
  return semanticQa.semanticReviewMode === "actual_image_semantic_review"
    && outputPath === expectedOutputPath
    && reviewedHash === outputSha256
    && status === "needs_review";
}

function readReturnedJson(inputObject, inputPath) {
  if (isRecord(inputObject)) return inputObject;
  return inputPath ? readRuntimeJson(inputPath) : undefined;
}

function currentProjectImage2OneShotExecutorResponse(input, extra = {}, source = currentProjectSource()) {
  const generatedAt = new Date().toISOString();
  const modeInfo = oneShotExecutorMode(input);
  const statusProjection = currentProjectImage2OneShotResponse("status", {
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds,
    imageCount: input.imageCount,
  }, {}, source);
  const statePaths = statusProjection.statePaths || {};
  const sandboxRoot = statusProjection.receipt?.sandbox?.root;
  const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
  const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
  const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
  const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
  const manifestPath = receipt?.sandbox?.manifestPath || `${shotRoot}/manifest.json`;
  const qaReportPath = receipt?.sandbox?.qaReportPath || `${shotRoot}/qa/semantic-qa.json`;
  const contextBase = {
    generatedAt,
    modeInfo,
    receipt,
    handoff,
    sandboxRoot,
    shotRoot,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
  };
  const preflightContract = oneShotExecutorContract(input, { ...contextBase, outputReturned: false });

  let outputSha256;
  let outputBytesWritten = 0;
  let providerObservation;
  let semanticQa;
  let manifest;
  let qaReport;
  let writeError;

  if (preflightContract.blockers.length === 0 && modeInfo.mode === "mock_executor") {
    try {
      const mockPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
      const outputFilePath = writeOneShotExecutorBytes(expectedOutputPath, mockPng, sandboxRoot, shotRoot);
      outputBytesWritten = mockPng.length;
      outputSha256 = sha256File(outputFilePath);
      const executorRunId = `mock_image2_executor_${safePathSegment(receipt.receiptId)}_${Date.now()}`;
      providerObservation = {
        schemaVersion: "vibe_core_real_image2_executor_provider_observation_v1",
        generatedAt,
        provider: "openai-image2-api",
        providerId: "openai-image2-api",
        providerObservationMode: "mock_readiness_evidence",
        executorMode: "mock_executor",
        executorRunId,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        handoffPacketId: handoff.packetId,
        outputPath: expectedOutputPath,
        outputSha256,
        outputBytes: outputBytesWritten,
        providerCalled: false,
        providerCallsAttempted: 0,
        maxProviderCallsPerExecution: 1,
        externalNetworkCallMade: false,
        rawCredentialMaterialSeen: false,
        workerSpawned: false,
        projectVibeWritten: false,
        notes: ["Mock executor evidence only; no external Image2 provider was called."],
      };
      semanticQa = {
        schemaVersion: "vibe_core_real_image2_executor_semantic_qa_v1",
        generatedAt,
        reviewedAt: generatedAt,
        semanticReviewMode: "mock_executor_semantic_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        reviewedOutputSha256: outputSha256,
        status: "needs_review",
        finalAssessment: {
          status: "needs_review",
          reason: "Mock executor output proves sandbox return plumbing only; human review is still required.",
        },
        gates: {
          identity: "warn",
          scene: "warn",
          style: "warn",
          story: "warn",
          neighbor: "warn",
          output: "pass",
        },
        providerCalled: false,
      };
      manifest = {
        schemaVersion: "vibe_core_real_image2_executor_manifest_v1",
        generatedAt,
        status: "mock_output_present",
        manifestMatched: true,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        expectedOutputPath,
        actualOutputPath: expectedOutputPath,
        outputSha256,
        providerObservationPath,
        semanticQaPath,
        qaReportPath,
        providerCalled: false,
        externalNetworkCallMade: false,
        items: [
          {
            shotId: receipt.selectedShotId,
            expectedOutputPath,
            actualOutputPath: expectedOutputPath,
            outputSha256,
            status: "mock_output_returned_needs_review",
          },
        ],
      };
      qaReport = {
        schemaVersion: "vibe_core_real_image2_executor_qa_report_v1",
        generatedAt,
        status: "needs_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        outputSha256,
        semanticQaPath,
        providerObservationPath,
        manifestPath,
        providerCalled: false,
        summary: "Mock executor returned output and sidecars to the sandbox; formal semantic QA remains a human review step.",
      };
      writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(manifestPath, manifest, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(qaReportPath, qaReport, sandboxRoot, shotRoot);
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Mock executor sandbox write failed.";
    }
  }

  const outputReturned = Boolean(outputSha256 && runtimePathExists(expectedOutputPath));
  const contract = oneShotExecutorContract(input, { ...contextBase, outputReturned });
  const blockers = uniqueStrings([
    ...contract.blockers,
    writeError,
  ]);
  const status = blockers.length ? "blocked" : contract.status;
  const ok = blockers.length === 0;
  const previewStatus = status === "mock_output_returned_needs_review"
    ? "mock_output_returned_needs_review"
    : status === "executor_ready_mock"
      ? "executor_ready_mock"
      : status === "dry_run_executor_ready"
        ? "dry_run_executor_ready"
        : "blocked";

  return {
    ok,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_executor_adapter",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      dryRunOnly: modeInfo.mode !== "real_provider_call",
    }),
    endpoint: currentProjectImage2OneShotExecuteMockEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot_executor_adapter",
    currentProject: statusProjection.currentProject,
    requestContext: {
      ...statusProjection.requestContext,
      selectedShotId: input.selectedShotId,
      receiptId: input.receiptId,
      executorMode: modeInfo.mode,
      requestedExecutorMode: modeInfo.raw || input.mode,
    },
    projectRootMode: source.projectRootMode,
    projectRoot: statusProjection.projectRoot,
    projectId: statusProjection.projectId,
    project: statusProjection.project,
    status,
    uiStatus: status,
    userLabel: status === "mock_output_returned_needs_review" ? "需要复核" : status === "blocked" ? "待补齐" : "执行器就绪",
    actualImage2Triggered: false,
    selectedShotId: input.selectedShotId,
    expectedOutputPath,
    outputExists: runtimePathExists(expectedOutputPath),
    outputSha256,
    outputBytesWritten,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
    statePaths,
    receipt,
    handoffPacket: handoff,
    transportPlan: handoff?.transportPlan || statusProjection.transportPlan,
    executorEvidence: {
      consumedPersistedReceipt: isRecord(receipt),
      consumedPersistedHandoff: isRecord(handoff),
      mockProviderOnly: modeInfo.mode === "mock_executor",
      externalNetworkIoAllowed: false,
      formalPromotionAllowed: false,
    },
    executorContract: {
      ...contract,
      blockers,
      status,
      outputReturnContract: {
        ...contract.outputReturnContract,
        previewProjection: {
          ...contract.outputReturnContract.previewProjection,
          status: previewStatus,
          needsHumanReview: status === "mock_output_returned_needs_review",
        },
      },
    },
    providerObservation,
    semanticQa,
    manifest,
    qaReport,
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      outputExists: runtimePathExists(expectedOutputPath),
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: runtimePathExists(semanticQaPath),
      manifestPresent: runtimePathExists(manifestPath),
      qaReportPresent: runtimePathExists(qaReportPath),
      expectedOutputDetected: outputReturned,
      manifestMatched: Boolean(manifest?.manifestMatched),
      semanticQaStatus: semanticQa?.status,
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: false,
      source: modeInfo.mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
    },
    previewProjection: {
      shotId: input.selectedShotId,
      status: status === "mock_output_returned_needs_review" ? "needs_review" : previewStatus,
      imageUrl: outputReturned ? runtimeFileUrl(expectedOutputPath) : undefined,
      reviewRequired: status === "mock_output_returned_needs_review",
      providerCalled: false,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      realProviderCallAllowed: false,
      manualTransportRequired: true,
      dryRunOnly: modeInfo.mode !== "real_provider_call",
      noWorkerSpawn: true,
      sandboxFileMutationAllowed: modeInfo.mode === "mock_executor" && ok,
      projectVibeMutationAllowed: false,
      statePersistenceAllowed: false,
    },
    providerCalled: false,
    externalNetworkCallMade: false,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers,
    message: blockers.length ? "Image2 executor adapter blocked this request before any provider call." : undefined,
    ...extra,
  };
}

function currentProjectImage2OneShotReturnIngestResponse(input, extra = {}, source = currentProjectSource()) {
  const generatedAt = new Date().toISOString();
  const modeInfo = { mode: "dry_run_executor", provided: true, valid: true, raw: input.executorMode || input.mode };
  const statusProjection = currentProjectImage2OneShotResponse("status", {
    selectedShotId: input.selectedShotId,
    selectedShotIds: input.selectedShotIds,
    imageCount: input.imageCount,
  }, {}, source);
  const statePaths = statusProjection.statePaths || {};
  const sandboxRoot = statusProjection.receipt?.sandbox?.root;
  const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
  const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
  const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
  const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
  const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
  const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
  const manifestPath = receipt?.sandbox?.manifestPath || `${shotRoot}/manifest.json`;
  const qaReportPath = receipt?.sandbox?.qaReportPath || `${shotRoot}/qa/semantic-qa.json`;
  const contextBase = {
    generatedAt,
    modeInfo,
    receipt,
    handoff,
    sandboxRoot,
    shotRoot,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
  };
  const preflightContract = oneShotExecutorContract(input, { ...contextBase, outputReturned: false });

  let outputSha256;
  let outputBytesWritten = 0;
  let providerObservation = readReturnedJson(input.providerObservation, input.returnedProviderObservationPath) || readRuntimeJson(providerObservationPath);
  let semanticQa = readReturnedJson(input.semanticQa, input.returnedSemanticQaPath) || readRuntimeJson(semanticQaPath);
  let manifest;
  let qaReport;
  let projections;
  let writeError;

  const returnedOutputPath = runtimeRelativeFromValue(input.returnedOutputPath) || expectedOutputPath;
  const hasReturnedOutput = runtimePathExists(returnedOutputPath);
  const outputSourceInsideProject = oneShotPathInsideRoot(returnedOutputPath, source.runRootRelativePath);
  const outputSourceIsExpected = returnedOutputPath === expectedOutputPath;
  const returnedProviderRequestId = asString(input.providerRequestId) || asString(providerObservation?.providerRequestId);

  if (preflightContract.blockers.length === 0 && input.actualProviderReturned === true && hasReturnedOutput && outputSourceInsideProject && returnedProviderRequestId) {
    try {
      const sourceOutputPath = scopedRepoPath(returnedOutputPath);
      const outputBytes = readFileSync(sourceOutputPath);
      if (!outputSourceIsExpected) {
        writeOneShotExecutorBytes(expectedOutputPath, outputBytes, sandboxRoot, shotRoot);
      }
      outputBytesWritten = outputBytes.length;
      outputSha256 = sha256Bytes(outputBytes);
      providerObservation = {
        ...(isRecord(providerObservation) ? providerObservation : {}),
        schemaVersion: "vibe_core_real_image2_executor_provider_observation_v1",
        generatedAt,
        provider: providerObservation?.provider || providerObservation?.providerId || "openai-image2-api",
        providerId: providerObservation?.providerId || providerObservation?.provider || "openai-image2-api",
        providerObservationMode: "actual_provider_call_observed",
        executorMode: "external_provider_return",
        executorRunId: `real_image2_return_${safePathSegment(receipt.receiptId)}_${Date.now()}`,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        handoffPacketId: handoff.packetId,
        providerRequestId: returnedProviderRequestId,
        sourceOutputPath: returnedOutputPath,
        outputPath: expectedOutputPath,
        outputSha256,
        outputBytes: outputBytesWritten,
        providerCalled: true,
        actualImage2Triggered: true,
        providerCallsAttempted: 1,
        maxProviderCallsPerExecution: 1,
        externalNetworkCallMade: true,
        rawCredentialMaterialSeen: false,
        workerSpawned: false,
        projectVibeWritten: false,
      };
      semanticQa = {
        ...(isRecord(semanticQa) ? semanticQa : {}),
        schemaVersion: "vibe_core_real_image2_executor_semantic_qa_v1",
        generatedAt,
        reviewedAt: semanticQa?.reviewedAt || generatedAt,
        semanticReviewMode: "actual_image_semantic_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        expectedOutputPath,
        outputSha256,
        reviewedOutputSha256: outputSha256,
        status: "needs_review",
        qaStatus: "needs_review",
        finalAssessment: {
          ...(isRecord(semanticQa?.finalAssessment) ? semanticQa.finalAssessment : {}),
          status: "needs_review",
        },
        providerCalled: true,
        actualImage2Triggered: true,
      };
      manifest = {
        schemaVersion: "vibe_core_real_image2_executor_manifest_v1",
        generatedAt,
        status: "real_provider_returned_needs_review",
        manifestMatched: true,
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        expectedOutputPath,
        actualOutputPath: expectedOutputPath,
        sourceOutputPath: returnedOutputPath,
        outputSha256,
        providerObservationPath,
        semanticQaPath,
        qaReportPath,
        providerCalled: true,
        actualImage2Triggered: true,
        externalNetworkCallMade: true,
        items: [
          {
            shotId: receipt.selectedShotId,
            expectedOutputPath,
            actualOutputPath: expectedOutputPath,
            outputSha256,
            status: "real_provider_returned_needs_review",
          },
        ],
      };
      qaReport = {
        schemaVersion: "vibe_core_real_image2_executor_qa_report_v1",
        generatedAt,
        status: "needs_review",
        selectedShotId: receipt.selectedShotId,
        receiptId: receipt.receiptId,
        outputPath: expectedOutputPath,
        outputSha256,
        semanticQaPath,
        providerObservationPath,
        manifestPath,
        providerCalled: true,
        actualImage2Triggered: true,
        summary: "Actual Image2 provider return was ingested into the one-shot sandbox and remains needs_review.",
      };
      writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(manifestPath, manifest, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(qaReportPath, qaReport, sandboxRoot, shotRoot);
      projections = currentProjectOneShotReturnProjection(source, {
        generatedAt,
        project: statusProjection.project,
        receipt,
        handoff,
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
        manifestPath,
        qaReportPath,
        outputSha256,
        imageInfo: { bytes: outputBytesWritten, sha256: outputSha256 },
        sourceImagePath: returnedOutputPath,
        providerName: providerObservation.provider,
      });
      writeCurrentProjectRuntimeJson(source.runtimeTruthLayerRelativePath, projections.runtimeTruth, source);
      writeCurrentProjectRuntimeJson(source.previewPlanRelativePath, projections.previewPlan, source);
      writeCurrentProjectRuntimeJson(source.reportRelativePath, projections.report, source);
    } catch (error) {
      writeError = error instanceof Error ? error.message : "Real provider return ingest failed.";
    }
  } else if (runtimePathExists(expectedOutputPath)) {
    outputSha256 = sha256File(scopedRepoPath(expectedOutputPath));
  }

  providerObservation = readRuntimeJson(providerObservationPath) || providerObservation;
  semanticQa = readRuntimeJson(semanticQaPath) || semanticQa;
  const expectedProviderObservationContext = {
    selectedShotId: receipt?.selectedShotId || input.selectedShotId,
    receiptId: receipt?.receiptId || input.receiptId,
    handoffPacketId: handoff?.packetId || input.handoffPacketId,
  };
  const providerObservationBlockers = providerObservationContextBlockers(providerObservation, expectedProviderObservationContext);
  const providerObservationMode = providerObservation?.providerObservationMode || "not_observed";
  const semanticQaStatus = semanticQa?.status || semanticQa?.qaStatus || semanticQa?.finalAssessment?.status || "not_written";
  const hashBoundActual = Boolean(
    outputSha256
      && runtimePathExists(expectedOutputPath)
      && actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, expectedProviderObservationContext)
      && actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256),
  );
  const returnSource = hashBoundActual ? "actual_provider_return_ingest" : "dry_run_projection_only";
  const formalPromotionBlockedReasons = hashBoundActual
    ? ["Formal promotion remains blocked until human QA approval after hash-bound provider return."]
    : [];
  const blockers = uniqueStrings([
    ...preflightContract.blockers,
    writeError,
    input.actualProviderReturned === true || hashBoundActual ? "" : "Actual provider return requires actualProviderReturned=true or existing actual hash-bound sidecars.",
    hasReturnedOutput || runtimePathExists(expectedOutputPath) ? "" : "Returned provider output file is required.",
    outputSourceInsideProject ? "" : "Returned provider output must stay inside the current project root.",
    returnedProviderRequestId || actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, expectedProviderObservationContext) ? "" : "Actual provider return requires a non-empty providerRequestId in provider observation.",
    outputSha256 ? "" : "Returned provider output must be hashable.",
    ...providerObservationBlockers,
    hashBoundActual ? "" : "Actual provider return requires providerRequestId, output hash, provider observation, and semantic QA sidecars before ingest.",
  ]);
  const ok = blockers.length === 0;
  const status = ok ? "real_provider_returned_needs_review" : preflightContract.blockers.length ? "blocked" : "dry_run_executor_ready";
  const contract = {
    ...preflightContract,
    status,
    blockers,
    outputReturnContract: {
      ...preflightContract.outputReturnContract,
      watcherProjection: {
        ...preflightContract.outputReturnContract.watcherProjection,
        expectedOutputDetected: hashBoundActual,
        source: returnSource,
        returnSource,
        outputSha256,
        hashBoundActual,
      },
      providerObservation: {
        providerId: providerObservation?.providerId || providerObservation?.provider || "openai-image2-api",
        providerRequestId: providerObservation?.providerRequestId,
        providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
        providerCalled: hashBoundActual,
        externalNetworkCallMade: hashBoundActual,
      },
      manifest: {
        manifestMatched: hashBoundActual,
        status: hashBoundActual ? "real_provider_returned_needs_review" : "not_written",
      },
      semanticQa: {
        semanticReviewMode: hashBoundActual ? "actual_image_semantic_review" : "not_observed",
        status: hashBoundActual ? semanticQaStatus : "not_written",
      },
      previewProjection: {
        status,
        needsHumanReview: hashBoundActual,
      },
    },
  };

  return {
    ok,
    ...runtimePolicy({
      runMode: "current_project_image2_one_shot_execute_return",
      providerCalled: hashBoundActual,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      dryRunOnly: !hashBoundActual,
    }),
    endpoint: currentProjectImage2OneShotExecuteReturnEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    projectionKind: "current_project_image2_one_shot_execute_return",
    currentProject: statusProjection.currentProject,
    requestContext: {
      ...statusProjection.requestContext,
      selectedShotId: input.selectedShotId,
      receiptId: input.receiptId,
      executorMode: "external_provider_return",
    },
    projectRootMode: source.projectRootMode,
    projectRoot: statusProjection.projectRoot,
    projectId: statusProjection.projectId,
    project: statusProjection.project,
    status,
    uiStatus: ok ? "needs_review" : status,
    userLabel: ok ? "需要复核" : "回流检查",
    providerRequestId: providerObservation?.providerRequestId || returnedProviderRequestId,
    outputSha256,
    hashBoundActual,
    providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
    semanticQaStatus: hashBoundActual ? semanticQaStatus : "not_written",
    returnSource,
    formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
    formalPromotionBlockedReasons,
    actualImage2Triggered: hashBoundActual,
    providerReturnIngested: hashBoundActual,
    externalProviderCallObserved: hashBoundActual,
    runtimeProviderSubmitAttempted: false,
    runtimeExternalNetworkCallMade: false,
    formalPromotionBlocked: hashBoundActual,
    selectedShotId: input.selectedShotId,
    expectedOutputPath,
    returnedOutputPath,
    outputExists: runtimePathExists(expectedOutputPath),
    outputSha256,
    outputBytesWritten,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
    statePaths,
    receipt,
    handoffPacket: handoff,
    transportPlan: handoff?.transportPlan || statusProjection.transportPlan,
    executorEvidence: {
      consumedPersistedReceipt: isRecord(receipt),
      consumedPersistedHandoff: isRecord(handoff),
      mockProviderOnly: false,
      externalProviderReturnOnly: true,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      formalPromotionAllowed: false,
      formalPromotionBlocked: hashBoundActual,
      formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
      formalPromotionBlockedReasons,
      providerRequestId: providerObservation?.providerRequestId || returnedProviderRequestId,
      outputSha256,
      hashBoundActual,
      providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
      semanticQaStatus: hashBoundActual ? semanticQaStatus : "not_written",
      returnSource,
    },
    executorContract: contract,
    providerObservation,
    semanticQa,
    manifest,
    qaReport,
    projections,
    watcherProjection: {
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      outputExists: runtimePathExists(expectedOutputPath),
      providerObservationPresent: runtimePathExists(providerObservationPath),
      semanticQaPresent: runtimePathExists(semanticQaPath),
      manifestPresent: runtimePathExists(manifestPath),
      qaReportPresent: runtimePathExists(qaReportPath),
      expectedOutputDetected: hashBoundActual,
      manifestMatched: hashBoundActual,
      providerRequestId: providerObservation?.providerRequestId || returnedProviderRequestId,
      outputSha256,
      hashBoundActual,
      providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
      semanticQaStatus: hashBoundActual ? semanticQaStatus : "not_written",
      returnSource,
      formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
      formalPromotionBlockedReasons,
      watcherStarted: false,
      daemonStarted: false,
      reportProjectionOnly: false,
      source: returnSource,
    },
    previewProjection: {
      shotId: input.selectedShotId,
      status: ok ? "needs_review" : status,
      imageUrl: hashBoundActual ? runtimeFileUrl(expectedOutputPath) : undefined,
      reviewRequired: hashBoundActual,
      providerCalled: hashBoundActual,
      actualImage2Triggered: hashBoundActual,
    },
    submitPolicy: {
      providerCallAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      realProviderCallAllowed: false,
      manualTransportRequired: true,
      dryRunOnly: !hashBoundActual,
      noWorkerSpawn: true,
      sandboxFileMutationAllowed: input.actualProviderReturned === true && hashBoundActual,
      projectVibeMutationAllowed: false,
      statePersistenceAllowed: false,
    },
    providerCalled: hashBoundActual,
    externalProviderCallObserved: hashBoundActual,
    externalNetworkCallMade: false,
    runtimeProviderSubmitAttempted: false,
    runtimeExternalNetworkCallMade: false,
    formalPromotionBlocked: hashBoundActual,
    liveSubmitAllowed: false,
    projectVibeWritten: false,
    workerSpawnForbidden: true,
    blockers,
    message: ok ? undefined : "Image2 return executor did not find hash-bound actual provider output yet.",
    ...extra,
  };
}

function firstHeaderValue(req, names) {
  for (const name of names) {
    const value = req.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      const firstValue = value.find((item) => typeof item === "string" && item.trim());
      if (firstValue) return firstValue.trim();
      continue;
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function requestBodyString(body, names) {
  if (!isRecord(body)) return undefined;
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const project = body.project;
  if (isRecord(project)) {
    for (const name of names) {
      const value = project[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function currentProjectRequestContext(req, url, body) {
  const queryProjectRoot = asString(url.searchParams.get("projectRoot")) || asString(url.searchParams.get("projectRootPath"));
  const headerProjectRoot = firstHeaderValue(req, ["x-vibe-project-root", "x-project-root"]);
  const bodyProjectRoot = requestBodyString(body, ["projectRoot", "projectRootPath"]);
  const queryProjectId = asString(url.searchParams.get("projectId"));
  const headerProjectId = firstHeaderValue(req, ["x-vibe-project-id", "x-project-id"]);
  const bodyProjectId = requestBodyString(body, ["projectId"]);
  const projectRoot = queryProjectRoot || headerProjectRoot || bodyProjectRoot;
  const projectId = queryProjectId || headerProjectId || bodyProjectId;

  return {
    projectRoot,
    projectRootSource: queryProjectRoot ? "query" : headerProjectRoot ? "header" : bodyProjectRoot ? "payload" : undefined,
    projectId,
    projectIdSource: queryProjectId ? "query" : headerProjectId ? "header" : bodyProjectId ? "payload" : undefined,
  };
}

const { runtimeFileUrl, serveRuntimeFile } = createRuntimeApiFileServing({
  runtimeFileEndpoint,
  scopedRepoPath,
  pathWithinRoot,
  contentTypeFor,
  corsHeaders,
  runtimePolicy,
  writeRuntimeFileError,
  currentProjectSourceResult,
  sourceForScope(scope) {
    if (scope === "real-demo-e2e-005") {
      try {
        return { source: realDemo005Source() };
      } catch (error) {
        return {
          error,
          message: error instanceof Error ? error.message : "Project root is unavailable.",
          unbound: error?.code === "CURRENT_PROJECT_UNBOUND",
          bindingState: error?.bindingState,
        };
      }
    }
    return currentProjectSourceResult();
  },
  createReadStream,
  existsSync,
  statSync,
  realpathSync,
});

const {
  projectProjectionFromSource,
  readProjectFacts,
  currentProjectWorkbenchFacts,
  semanticQaSummary,
} = createRuntimeApiWorkbenchProjection({
  repoRoot,
  round5FullRealChainReportFileName,
  existsSync,
  realpathSync,
  pathWithinRoot,
  isPathInsideRealRoot,
  repoRelativePath,
  normalizeRelativePath,
  runtimeRelativeFromValue,
  runtimePathExists,
  runtimeFileUrl,
  scopedRepoPath,
  readJsonIfPresent,
  projectIdentityFromSource,
});

function unavailableResponse(extra = {}) {
  const source = extra.sourceProject || realDemo005Source();
  const fileScope = source.sandboxSource === "005 sandbox" ? "real-demo-e2e-005" : undefined;
  return {
    ok: false,
    ...runtimePolicy(),
    endpoint: realDemo005StatusEndpoint,
    status: "unavailable",
    previewStatus: "unavailable",
    productionStatus: "unavailable",
    reportPath: source.reportPath,
    reportRelativePath: source.reportRelativePath,
    reportUrl: runtimeFileUrl(source.reportRelativePath, fileScope),
    reviewOverlayShots: [],
    productionNeedsReviewShots: [],
    shotCount: 0,
    blockerCount: 0,
    observations: [],
    message: "005 report is unavailable. The runtime API can only verify an existing prepared report and output set.",
    ...extra,
    sourceProject: undefined,
  };
}

function responseFromReport(extra = {}, source = realDemo005Source()) {
  if (!existsSync(source.reportPath)) return unavailableResponse({ ...extra, sourceProject: source });

  try {
    const report = readJson(source.reportPath);
    const observations = Array.isArray(report.observations)
      ? report.observations.map((item) => observationSummary(item, "real-demo-e2e-005"))
      : [];

    return {
      ok: true,
      ...runtimePolicy(),
      endpoint: realDemo005StatusEndpoint,
      status: report.status || "unavailable",
      previewStatus: report.previewStatus || report.status || "unavailable",
      productionStatus: report.productionStatus || "unavailable",
      reportPath: source.reportPath,
      reportRelativePath: source.reportRelativePath,
      reportUrl: runtimeFileUrl(source.reportRelativePath, "real-demo-e2e-005"),
      reviewOverlayShots: Array.isArray(report.reviewOverlayShots) ? report.reviewOverlayShots : [],
      productionNeedsReviewShots: Array.isArray(report.productionNeedsReviewShots) ? report.productionNeedsReviewShots : [],
      shotCount: report.shotCount || observations.length,
      blockerCount: Array.isArray(report.blockers) ? report.blockers.length : 0,
      observations,
      report,
      ...extra,
    };
  } catch (error) {
    return unavailableResponse({
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      message: error instanceof Error ? error.message : "005 report could not be parsed.",
      ...extra,
      sourceProject: source,
    });
  }
}

function currentProjectRealChainResponse(extra = {}, source = currentProjectSource()) {
  const projection = projectProjectionFromSource(source);
  const { project, projectFacts, observations } = projection;
  const needsReviewShotIds = projection.reviewShotIds;
  const primaryReportRelativePath = projectFacts.primaryReportRelativePath;
  const actualProviderReturned = observations.some((item) => item.providerObservationActual === true);
  const round5ArtifactIngest = round5ArtifactIngestFromReport(source, project, projectFacts.image2Report);
  const hasRound5ArtifactIngest = Boolean(round5ArtifactIngest);
  const round5UiStatus = round5ArtifactIngest?.uiSummary?.status;
  const preferRound5Status = hasRound5ArtifactIngest && (
    !projection.ok ||
    projection.status === "unavailable" ||
    projectFacts.projectionSource === "round5_full_real_chain_report_fallback"
  );
  const resolvedOk = projection.ok || hasRound5ArtifactIngest;
  const resolvedStatus = preferRound5Status ? round5UiStatus || "unavailable" : projection.ok ? projection.status : "unavailable";
  const resolvedPreviewStatus = preferRound5Status
    ? round5UiStatus === "blocked"
      ? "blocked"
      : round5UiStatus === "needs_review"
        ? "needs_review"
        : round5UiStatus === "in_progress"
          ? "running"
          : "unavailable"
    : projection.ok
      ? projection.previewStatus
      : "unavailable";
  const resolvedProductionStatus = preferRound5Status
    ? round5UiStatus === "blocked"
      ? "blocked"
      : round5UiStatus === "needs_review"
        ? "needs_review"
        : "unavailable"
    : projection.ok
      ? projection.productionStatus
      : "unavailable";
  const plannedImageCount = observations.length || round5ArtifactIngest?.uiSummary?.totalShots || 0;
  const returnedImageCount = projection.returnedObservations.length || round5ArtifactIngest?.uiSummary?.observedStarts || 0;
  const blockerCount = projection.blockedObservations.length || round5ArtifactIngest?.uiSummary?.nextActions?.length || 0;

  return {
    ok: resolvedOk,
    ...runtimePolicy(),
    endpoint: currentProjectStatusEndpoint,
    status: resolvedStatus,
    previewStatus: resolvedPreviewStatus,
    productionStatus: resolvedProductionStatus,
    reportStatus: resolvedStatus,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    sandboxSource: source.sandboxSource,
    currentProject: {
      bound: true,
      bindingPath: source.bindingPathRelative,
      binding: source.binding,
    },
    requestContext: {
      projectRoot: source.requestProjectRoot,
      projectRootSource: source.requestContextSource,
      projectId: source.requestProjectId,
      projectIdSource: source.requestProjectIdSource,
    },
    projectionKind: "project_real_chain_status",
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    identity: {
      projectId: project.projectId,
      projectRoot: project.projectRoot,
    },
    projectRootRelativePath: source.runRootRelativePath,
    projectVibeRelativePath: source.projectVibeRelativePath,
    sourceIndexRelativePath: source.sourceIndexRelativePath,
    runManifestRelativePath: source.runManifestRelativePath,
    projectionSource: projectFacts.projectionSource,
    ledgerTruthSource: projectFacts.ledgerTruthSource,
    factsUsed: projectFacts.factsUsed,
    workbenchFacts: currentProjectWorkbenchFacts(source, projectFacts),
    project,
    plannedImageCount,
    totalPlannedImages: plannedImageCount,
    returnedImageCount,
    needsReviewCount: needsReviewShotIds.length,
    needsReviewShotIds,
    reviewShotIds: needsReviewShotIds,
    reviewOverlayShots: needsReviewShotIds,
    productionNeedsReviewShots: needsReviewShotIds,
    shotCount: plannedImageCount,
    actualImage2Triggered: actualProviderReturned,
    providerCalled: false,
    blockerCount,
    reportPath: primaryReportRelativePath,
    reportRelativePath: primaryReportRelativePath,
    reportUrl: runtimeFileUrl(primaryReportRelativePath),
    image2ReportPath: source.reportRelativePath,
    image2ReportRelativePath: source.reportRelativePath,
    runtimeTruthLayerPath: source.runtimeTruthLayerRelativePath,
    previewPlanPath: source.previewPlanRelativePath,
    round5ArtifactIngest,
    observations,
    previewItems: observations.map((item) => ({
      shotId: item.shotId,
      order: item.order,
      imageUrl: item.imageUrl,
      mediaPath: item.expectedOutputPath,
      outputExists: item.outputExists,
      status: item.previewStatus,
      reviewOverlay: item.reviewOverlay === true,
      previewQaStatus: item.previewQaStatus,
      productionQaStatus: item.productionQaStatus,
      runtimeTruthStatus: item.runtimeTruthStatus,
      blockers: item.blockers,
    })),
    nextAction: preferRound5Status
      ? "round5_artifact_gates_require_review"
      : projection.ok
      ? needsReviewShotIds.length
        ? "review_needed_outputs_before_production_promotion"
        : projection.blockedObservations.length
          ? "resolve_blockers_before_production_promotion"
          : "preview_projection_ready"
      : "provide_project_runtime_truth_or_preview_plan",
    message: hasRound5ArtifactIngest && !projection.ok
      ? "Round 5 artifact gates are projected from the existing report. No provider call was made."
      : projection.ok
      ? undefined
      : "Current project projection is unavailable. Provide runtime_truth_layer.json, preview_plan.json, run_manifest.json, or a compatibility report.",
    ...extra,
  };
}

function currentProjectImage2BatchPlanResponse(extra = {}, source = currentProjectSource()) {
  const projection = projectProjectionFromSource(source);
  const { project, projectFacts } = projection;
  const selectedObservations = projection.observations.slice(0, 10);
  const shotPlans = Array.isArray(projectFacts.runManifest?.shotPlans) ? projectFacts.runManifest.shotPlans : [];
  const items = selectedObservations.map((observation, index) => {
    const shotPlan = shotPlans.find((item) => item?.shotId === observation.shotId) || observation.shotPlan || {};
    return image2BatchPlanItem(source, observation, index + 1, shotPlan);
  });
  const blockedItems = items.filter((item) => item.blocked);
  const primaryReportRelativePath = projectFacts.primaryReportRelativePath;
  const payload = {
    ok: projection.ok,
    ...runtimePolicy({
      runMode: "read_only_image2_batch_plan_projection",
      verifyScriptRan: false,
      liveSubmitAllowed: false,
    }),
    endpoint: currentProjectImage2BatchPlanEndpoint,
    source: "runtime_endpoint",
    sourceLabel: source.sourceLabel,
    sandboxSource: source.sandboxSource,
    currentProject: {
      bound: true,
      bindingPath: source.bindingPathRelative,
      binding: source.binding,
    },
    requestContext: {
      projectRoot: source.requestProjectRoot,
      projectRootSource: source.requestContextSource,
      projectId: source.requestProjectId,
      projectIdSource: source.requestProjectIdSource,
    },
    projectionKind: "current_project_image2_batch_prepare_plan",
    projectRootMode: source.projectRootMode,
    projectRoot: project.projectRoot,
    projectId: project.projectId,
    identity: {
      projectId: project.projectId,
      projectRoot: project.projectRoot,
    },
    projectRootRelativePath: source.runRootRelativePath,
    projectVibeRelativePath: source.projectVibeRelativePath,
    sourceIndexRelativePath: source.sourceIndexRelativePath,
    runManifestRelativePath: source.runManifestRelativePath,
    projectionSource: projectFacts.projectionSource,
    ledgerTruthSource: projectFacts.ledgerTruthSource,
    factsUsed: projectFacts.factsUsed,
    project,
    status: projection.ok ? projection.status : "unavailable",
    previewStatus: projection.ok ? projection.previewStatus : "unavailable",
    productionStatus: projection.ok ? projection.productionStatus : "unavailable",
    reportStatus: projection.ok ? projection.status : "unavailable",
    reportPath: primaryReportRelativePath,
    reportRelativePath: primaryReportRelativePath,
    reportUrl: runtimeFileUrl(primaryReportRelativePath),
    image2ReportPath: source.reportRelativePath,
    image2ReportRelativePath: source.reportRelativePath,
    runtimeTruthLayerPath: source.runtimeTruthLayerRelativePath,
    previewPlanPath: source.previewPlanRelativePath,
    observations: selectedObservations,
    submitPolicy: image2BatchSubmitPolicy(),
    plan: {
      mode: "read_only_image2_batch_prepare_check_projection",
      sourceObservationLimit: 10,
      items,
    },
    items,
    summary: {
      plannedCount: items.length,
      readyCount: items.length - blockedItems.length,
      blockedCount: blockedItems.length,
      returnedCount: selectedObservations.filter((item) => item.returned).length,
      reviewCount: selectedObservations.filter((item) => item.reviewOverlay || item.semanticQaNeedsReview).length,
      selectedShotIds: items.map((item) => item.shotId),
      nextAction: blockedItems.length
        ? "resolve_blockers_before_manual_image2_batch_prepare"
        : "manual_review_projection_before_any_prepare_or_provider_submit",
    },
    providerCalled: false,
    prepareRan: false,
    verifyScriptRan: false,
    liveSubmitAllowed: false,
    ...extra,
  };
  return {
    ...payload,
    ledgerProjection: image2BatchLedgerProjection(payload),
  };
}

function writeJson(res, statusCode, payload) {
  if (statusCode === 204) {
    res.writeHead(204, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
    res.end();
    return;
  }
  res.writeHead(statusCode, corsHeaders("application/json; charset=utf-8", res.runtimeAllowedOrigin));
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function runVerify() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [verifyScript], {
      cwd: repoRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.stack || error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function handleRun(res, options = {}) {
  const endpoint = options.endpoint || realDemo005RunEndpoint;
  const source = options.source || realDemo005Source();
  const buildResponse = options.buildResponse || ((extra) => responseFromReport(extra, source));
  if (running) {
    writeJson(res, 409, buildResponse({
      ok: false,
      endpoint,
      status: "running",
      running: true,
      message: "Real chain verification is already running.",
    }));
    return;
  }

  running = true;
  try {
    const command = await runVerify();
    const payload = buildResponse({
      ok: command.code === 0,
      endpoint,
      running: false,
      command: {
        command: `${process.execPath} ${path.relative(repoRoot, verifyScript)}`,
        exitCode: command.code,
        stdout: clip(command.stdout),
        stderr: clip(command.stderr),
        providerCalled: false,
        prepareRan: false,
      },
    });
    writeJson(res, command.code === 0 ? 200 : 500, payload);
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      reportPath: source.reportPath,
      reportRelativePath: source.reportRelativePath,
      reportUrl: runtimeFileUrl(source.reportRelativePath),
      message: error instanceof Error ? error.message : "Unknown run failure.",
    });
  } finally {
    running = false;
  }
}

function handleCurrentProjectRunCheck(res, source, extra = {}) {
  const projectFacts = readProjectFacts(source);
  const payload = currentProjectRealChainResponse({
    ...extra,
    running,
    command: {
      mode: "read_only_projection_check",
      exitCode: projectFacts.projectionAvailable ? 0 : 1,
      reportRead: projectFacts.projectionAvailable,
      projectionSource: projectFacts.projectionSource,
      ledgerTruthSource: projectFacts.ledgerTruthSource,
      projectVibeRead: existsSync(source.projectVibePath),
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      verifyScriptRan: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }, source);
  writeJson(res, payload.ok === false ? 500 : 200, payload);
}

function handleCurrentProjectImage2BatchRunCheck(res, source, extra = {}) {
  const projectFacts = readProjectFacts(source);
  const payload = currentProjectImage2BatchPlanResponse({
    ...extra,
    running,
    command: {
      mode: "read_only_image2_batch_plan_check",
      exitCode: projectFacts.projectionAvailable ? 0 : 1,
      reportRead: projectFacts.projectionAvailable,
      projectionSource: projectFacts.projectionSource,
      ledgerTruthSource: projectFacts.ledgerTruthSource,
      projectVibeRead: existsSync(source.projectVibePath),
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      verifyScriptRan: false,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      noFileMutation: true,
      workerSpawnForbidden: true,
    },
  }, source);
  writeJson(res, payload.ok === false ? 500 : 200, payload);
}

function readRequestJsonBody(req) {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (chunk) => {
      text += chunk.toString();
      if (text.length > 1024 * 1024) {
        req.destroy(new Error("Request body is too large."));
      }
    });
    req.on("error", (error) => {
      resolve({ ok: false, message: error instanceof Error ? error.message : "Request body could not be read." });
    });
    req.on("end", () => {
      const trimmed = text.trim();
      if (!trimmed) {
        resolve({ ok: true, body: undefined });
        return;
      }
      try {
        const body = JSON.parse(trimmed);
        resolve({ ok: true, body });
      } catch {
        resolve({ ok: false, message: "Request body must be valid JSON." });
      }
    });
  });
}

function isCurrentProjectEndpoint(pathname) {
  return pathname === currentProjectBindingEndpoint
    || pathname === currentProjectSelectEndpoint
    || pathname === currentProjectRecentEndpoint
    || pathname === currentProjectStatusEndpoint
    || pathname === currentProjectRunEndpoint
    || pathname === currentProjectImage2BatchPlanEndpoint
    || pathname === currentProjectImage2BatchRunCheckEndpoint
    || pathname === currentProjectImage2OneShotStatusEndpoint
    || pathname === currentProjectImage2OneShotPrepareEndpoint
    || pathname === currentProjectImage2OneShotConfirmEndpoint
    || pathname === currentProjectImage2OneShotPrepareTriggerEndpoint
    || pathname === currentProjectImage2OneShotExecuteMockEndpoint
    || pathname === currentProjectImage2OneShotReturnEndpoint
    || pathname === currentProjectImage2OneShotExecuteReturnEndpoint
    || pathname === currentProjectRound5StrictEditPrepareEndpoint
    || pathname === currentProjectRound5StrictEditReturnEndpoint;
}

async function currentProjectRouteContext(req, res, url, endpoint) {
  const bodyResult = req.method === "POST"
    ? await readRequestJsonBody(req)
    : { ok: true, body: undefined };
  if (!bodyResult.ok) {
    writeJson(res, 400, blockedCurrentProjectResponse(endpoint, {}, {
      status: "bad_request",
      previewStatus: "bad_request",
      productionStatus: "bad_request",
      message: bodyResult.message,
    }));
    return undefined;
  }

  const requestContext = currentProjectRequestContext(req, url, bodyResult.body);
  const sourceResult = currentProjectSourceResult();
  if (sourceResult.error) {
    if (sourceResult.unbound) {
      writeJson(res, 409, unboundCurrentProjectResponse(endpoint, requestContext));
      return undefined;
    }
    writeJson(res, 403, blockedCurrentProjectResponse(endpoint, requestContext, {
      message: sourceResult.message,
    }));
    return undefined;
  }
  return { requestContext, source: sourceResult.source, body: bodyResult.body };
}

async function handleCurrentProjectSelect(req, res) {
  const bodyResult = await readRequestJsonBody(req);
  if (!bodyResult.ok) {
    writeJson(res, 400, {
      ok: false,
      ...runtimePolicy(),
      endpoint: currentProjectSelectEndpoint,
      status: "bad_request",
      message: bodyResult.message,
    });
    return;
  }
  const { statusCode, payload } = selectCurrentProjectBindingResponse(bodyResult.body);
  writeJson(res, statusCode, payload);
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${host}`);
  const security = runtimeRequestSecurity(req);
  if (!security.ok) {
    writeSecurityBlocked(res, security);
    return;
  }
  res.runtimeAllowedOrigin = security.origin || undefined;
  if (req.method === "OPTIONS") {
    writeJson(res, 204, {});
    return;
  }
  if (req.method === "GET" && url.pathname === `${runtimeBasePath}/status`) {
    writeJson(res, 200, {
      ok: true,
    ...runtimePolicy({
      endpoints: {
        currentProjectStatusEndpoint,
        currentProjectBindingEndpoint,
        currentProjectSelectEndpoint,
        currentProjectRecentEndpoint,
        currentProjectRunEndpoint,
        currentProjectImage2BatchPlanEndpoint,
        currentProjectImage2BatchRunCheckEndpoint,
        currentProjectImage2OneShotStatusEndpoint,
        currentProjectImage2OneShotPrepareEndpoint,
        currentProjectImage2OneShotConfirmEndpoint,
        currentProjectImage2OneShotPrepareTriggerEndpoint,
        currentProjectImage2OneShotExecuteMockEndpoint,
        currentProjectImage2OneShotReturnEndpoint,
        currentProjectImage2OneShotExecuteReturnEndpoint,
        currentProjectRound5StrictEditPrepareEndpoint,
        currentProjectRound5StrictEditReturnEndpoint,
          realDemo005StatusEndpoint,
          realDemo005RunEndpoint,
          runtimeFileEndpoint,
        },
      }),
      running,
    });
    return;
  }
  if (req.method === "GET" && url.pathname === runtimeFileEndpoint) {
    serveRuntimeFile(req, res, url.searchParams.get("path") || "", { scope: url.searchParams.get("scope") || undefined });
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectBindingEndpoint) {
    writeJson(res, 200, currentProjectBindingStatusResponse({ running }));
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectRecentEndpoint) {
    writeJson(res, 200, currentProjectRecentResponse({ running }));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectSelectEndpoint) {
    await handleCurrentProjectSelect(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectStatusEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectStatusEndpoint);
    if (!routeContext) return;
    writeJson(res, 200, currentProjectRealChainResponse({
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRunEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRunEndpoint);
    if (!routeContext) return;
    handleCurrentProjectRunCheck(res, routeContext.source, {
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectImage2BatchPlanEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2BatchPlanEndpoint);
    if (!routeContext) return;
    writeJson(res, 200, currentProjectImage2BatchPlanResponse({
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source));
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2BatchRunCheckEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2BatchRunCheckEndpoint);
    if (!routeContext) return;
    handleCurrentProjectImage2BatchRunCheck(res, routeContext.source, {
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === currentProjectImage2OneShotStatusEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotStatusEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotResponse("status", input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotPrepareEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotPrepareEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotResponse("prepare", input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotConfirmEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotConfirmEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotResponse("confirm", input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotPrepareTriggerEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotPrepareTriggerEndpoint);
    if (!routeContext) return;
    const input = oneShotRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotPrepareTriggerResponse(input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectImage2OneShotExecuteMockEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotExecuteMockEndpoint);
    if (!routeContext) return;
    const input = oneShotExecutorRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotExecutorResponse(input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && (url.pathname === currentProjectImage2OneShotReturnEndpoint || url.pathname === currentProjectImage2OneShotExecuteReturnEndpoint)) {
    const routeContext = await currentProjectRouteContext(req, res, url, url.pathname);
    if (!routeContext) return;
    const input = oneShotReturnRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotReturnIngestResponse(input, {
      running,
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRound5StrictEditPrepareEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRound5StrictEditPrepareEndpoint);
    if (!routeContext) return;
    const input = round5StrictEditRequestInput(url, routeContext.body);
    const payload = currentProjectRound5StrictEditPrepareResponse(input, {
      running,
      requestContext: routeContext.requestContext,
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "POST" && url.pathname === currentProjectRound5StrictEditReturnEndpoint) {
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRound5StrictEditReturnEndpoint);
    if (!routeContext) return;
    const input = round5StrictEditReturnRequestInput(url, routeContext.body);
    const payload = currentProjectRound5StrictEditReturnResponse(input, {
      running,
      requestContext: routeContext.requestContext,
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return;
  }
  if (req.method === "GET" && (url.pathname === realDemo005StatusEndpoint || url.pathname === legacyStatusEndpoint)) {
    writeJson(res, 200, responseFromReport({ running }));
    return;
  }
  if (req.method === "POST" && (url.pathname === realDemo005RunEndpoint || url.pathname === legacyRunEndpoint)) {
    if (process.env.VIBE_CORE_ENABLE_LEGACY_RUN !== "1") {
      writeJson(res, 403, {
        ok: false,
        ...runtimePolicy(),
        endpoint: url.pathname,
        status: "disabled",
        previewStatus: "blocked",
        productionStatus: "blocked",
        running: false,
        command: {
          providerCalled: false,
          prepareRan: false,
          verifyScriptRan: false,
        },
        message: "Legacy 005 run endpoint is disabled. Set VIBE_CORE_ENABLE_LEGACY_RUN=1 for diagnostics-only use.",
      });
      return;
    }
    void handleRun(res, { endpoint: url.pathname });
    return;
  }
  writeJson(res, 404, { ok: false, ...runtimePolicy(), status: "not_found", path: url.pathname });
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}`);
  void handleRequest(req, res).catch((error) => {
    const endpoint = isCurrentProjectEndpoint(url.pathname) ? url.pathname : undefined;
    writeJson(res, 500, {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      message: error instanceof Error ? error.message : "Runtime API request failed.",
    });
  });
});

server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(JSON.stringify({
    event: "vibe-core-runtime-api-listening",
    host,
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
    basePath: runtimeBasePath,
  }));
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
