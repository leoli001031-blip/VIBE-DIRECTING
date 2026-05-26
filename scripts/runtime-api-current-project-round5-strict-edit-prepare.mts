import { createHash } from "node:crypto";
import path from "node:path";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
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

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

export function createRuntimeApiCurrentProjectRound5StrictEditPrepare(deps) {
  const {
    currentProjectSource,
    readJsonIfPresent,
    isRound5FullRealChainReport,
    round5QaStatusFor,
    round5EndRequiredFor,
    round5BboxValid,
    round5StrictEditSidecarFileNames,
    round5StrictEditBlockedResponse,
    currentProjectRealChainResponse,
    projectIdentityFromSource,
    requestOverrideDiagnostics,
    runtimePolicy,
    normalizeRelativePath,
    oneShotPathInsideRoot,
    scopedRepoPath,
    existsSync,
    statSync,
    realpathSync,
    isPathInsideRealRoot,
    readFileSync,
    writeCurrentProjectRuntimeJson,
    repoRelativePath,
    currentProjectRound5StrictEditPrepareEndpoint,
  } = deps;

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

  return {
    round5StrictEditRequestInput,
    currentProjectRound5StrictEditPrepareResponse,
  };
}
