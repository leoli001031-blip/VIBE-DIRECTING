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
import { createRuntimeApiCurrentProjectImage2Handoff } from "./runtime-api-current-project-image2-handoff.mjs";
import { createRuntimeApiCurrentProjectOneShotExecutor } from "./runtime-api-current-project-one-shot-executor.mjs";
import { createRuntimeApiCurrentProjectOneShotReturn } from "./runtime-api-current-project-one-shot-return.mjs";
import { createRuntimeApiCurrentProjectRound5StrictEditReturn } from "./runtime-api-current-project-round5-strict-edit-return.mjs";
import { createRuntimeApiCurrentProjectReturnWriters } from "./runtime-api-current-project-return-writers.mjs";
import { createRuntimeApiFileServing } from "./runtime-api-file-serving.mjs";
import { createRuntimeApiProviderReturnEvidence } from "./runtime-api-provider-return-evidence.mjs";
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

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function isPathInsideRealRoot(candidatePath, rootPath) {
  if (!candidatePath || !rootPath) return false;
  const rootWithSep = `${rootPath}${path.sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSep);
}

const {
  providerObservationContextBlockers,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  readReturnedJson,
} = createRuntimeApiProviderReturnEvidence({
  runtimeRelativeFromValue,
  readRuntimeJson,
});

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

const {
  oneShotRequestInput,
  oneShotPathInsideRoot,
  oneShotStatePaths,
  oneShotStateJson,
  inspectForRawCredentialMaterial,
  currentProjectImage2OneShotResponse,
  currentProjectImage2OneShotPrepareTriggerResponse,
} = createRuntimeApiCurrentProjectImage2Handoff({
  repoRoot,
  repoRootRealPath,
  currentProjectSource,
  projectProjectionFromSource,
  currentProjectWorkbenchFacts,
  runtimePolicy,
  runtimeFileUrl,
  scopedRepoPath,
  readRuntimeJson,
  runtimePathExists,
  runtimeRelativeFromValue,
  normalizeRelativePath,
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2TransportModes,
  currentProjectImage2ForbiddenProviders,
  normalizeCurrentProjectImage2TransportMode,
  currentProjectImage2OneShotStatusEndpoint,
  currentProjectImage2OneShotPrepareEndpoint,
  currentProjectImage2OneShotConfirmEndpoint,
  currentProjectImage2OneShotPrepareTriggerEndpoint,
  semanticQaSummary,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  sha256File,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
  readFileSync,
});

const {
  oneShotExecutorPathInsideSandbox,
  assertOneShotExecutorSandboxWritePath,
  writeOneShotExecutorJson,
  writeOneShotExecutorBytes,
  assertCurrentProjectRuntimeWritePath,
  writeCurrentProjectRuntimeJson,
  writeCurrentProjectRuntimeBytes,
} = createRuntimeApiCurrentProjectReturnWriters({
  repoRootRealPath,
  scopedRepoPath,
  normalizeRelativePath,
  oneShotPathInsideRoot,
  isPathInsideRealRoot,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
});

const oneShotExecutorApi = createRuntimeApiCurrentProjectOneShotExecutor({
  currentProjectSource,
  currentProjectImage2OneShotResponse,
  oneShotRequestInput,
  oneShotStateJson,
  oneShotPathInsideRoot,
  inspectForRawCredentialMaterial,
  oneShotExecutorPathInsideSandbox,
  writeOneShotExecutorBytes,
  writeOneShotExecutorJson,
  normalizeRelativePath,
  runtimePathExists,
  runtimePolicy,
  runtimeFileUrl,
  sha256File,
  currentProjectImage2OneShotExecuteMockEndpoint,
});

const {
  currentProjectOneShotReturnProjection,
  currentProjectImage2OneShotReturnIngestResponse,
} = createRuntimeApiCurrentProjectOneShotReturn({
  currentProjectSource,
  currentProjectImage2OneShotResponse,
  oneShotStateJson,
  oneShotExecutorContract: oneShotExecutorApi.oneShotExecutorContract,
  readReturnedJson,
  readRuntimeJson,
  runtimeRelativeFromValue,
  runtimePathExists,
  oneShotPathInsideRoot,
  scopedRepoPath,
  readFileSync,
  sha256Bytes,
  sha256File,
  writeOneShotExecutorBytes,
  writeOneShotExecutorJson,
  writeCurrentProjectRuntimeJson,
  providerObservationContextBlockers,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  runtimePolicy,
  runtimeFileUrl,
  currentProjectImage2OneShotExecuteReturnEndpoint,
});

const {
  currentProjectRound5StrictEditReturnResponse,
} = createRuntimeApiCurrentProjectRound5StrictEditReturn({
  currentProjectSource,
  readJsonIfPresent,
  isRound5FullRealChainReport,
  round5QaStatusFor,
  round5EndRequiredFor,
  round5StrictEditSidecarFileNames,
  round5StrictEditEvidenceBlockers,
  round5StrictEditProviderObservationBlockers,
  round5StrictEditBlockedResponse,
  currentProjectRealChainResponse,
  projectIdentityFromSource,
  requestOverrideDiagnostics,
  runtimePolicy,
  readRuntimeJson,
  runtimeRelativeFromValue,
  runtimePathExists,
  oneShotPathInsideRoot,
  scopedRepoPath,
  readFileSync,
  sha256Bytes,
  writeCurrentProjectRuntimeBytes,
  writeCurrentProjectRuntimeJson,
  currentProjectRound5StrictEditReturnEndpoint,
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
    const input = oneShotExecutorApi.oneShotExecutorRequestInput(url, routeContext.body);
    const payload = oneShotExecutorApi.currentProjectImage2OneShotExecutorResponse(input, {
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
