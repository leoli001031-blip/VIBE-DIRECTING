function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
}

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

export function createRuntimeApiCurrentProjectRound5StrictEditReturn(deps) {
  const {
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
  } = deps;

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

  return {
    currentProjectRound5StrictEditReturnResponse,
  };
}
