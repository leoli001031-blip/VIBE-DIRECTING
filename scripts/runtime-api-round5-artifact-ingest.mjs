import path from "node:path";

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

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length))];
}

export function createRuntimeApiRound5ArtifactIngest(deps) {
  const {
    existsSync,
    statSync,
    readJsonIfPresent,
    sha256File,
    normalizeRelativePath,
    round5FullRealChainReportFileName,
    round5StrictEditSidecarFileNames,
  } = deps;

  function isRound5FullRealChainReport(report, source) {
    return isRecord(report) && (
      String(report.schemaVersion || "").startsWith("round5_full_real_chain_report")
      || String(source?.reportRelativePath || "").endsWith(`/reports/${round5FullRealChainReportFileName}`)
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

  function round5BlockersFor({ qaStatus, endRequired, shotQa, strictEditEvidenceBlockers }) {
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

  return {
    round5ArtifactIngestSchemaVersion,
    round5EndFrameBlockers,
    round5ArtifactIsolationFlags,
    isRound5FullRealChainReport,
    round5QaStatusFor,
    round5EndRequiredFor,
    round5BboxValid,
    round5StrictEditEvidenceBlockers,
    round5StrictEditProviderObservationBlockers,
    round5ArtifactIngestFromReport,
  };
}
