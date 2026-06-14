import { parseProjectVibeText } from "../src/project/index.ts";

export function createRuntimeApiCurrentProjectRealChainStatus(deps) {
  const {
    currentProjectSource,
    projectProjectionFromSource,
    readProjectFacts,
    currentProjectWorkbenchFacts,
    round5ArtifactIngestFromReport,
    runtimePolicy,
    runtimeFileUrl,
    existsSync,
    readJsonIfPresent,
    readFileSync,
    currentProjectStatusEndpoint,
  } = deps;

  function readPersistedRelayQueue(source) {
    if (typeof readJsonIfPresent !== "function") return undefined;
    const candidates = [
      source?.runRootPath ? `${source.runRootPath}/reports/video_relay_queue.json` : undefined,
      source?.runRootRelativePath ? `${source.runRootRelativePath}/reports/video_relay_queue.json` : undefined,
    ].filter(Boolean);
    for (const candidate of candidates) {
      const relayQueue = readJsonIfPresent(candidate);
      if (relayQueue && typeof relayQueue === "object") return relayQueue;
    }
    return undefined;
  }

  function relayItems(relayQueue) {
    return Array.isArray(relayQueue?.items) ? relayQueue.items : [];
  }

  function relayEvidenceFor(relayQueue, item) {
    const mediaPath = item?.expectedOutputPath || item?.mediaPath || item?.outputVideoPath;
    const shotId = item?.shotId;
    const match = relayItems(relayQueue).find((candidate) => (
      (mediaPath && candidate?.outputVideoPath === mediaPath) ||
      (shotId && (candidate?.shotId === shotId || (Array.isArray(candidate?.shotIds) && candidate.shotIds.includes(shotId))))
    ));
    if (!match) return {};
    const submitId = typeof match.submitId === "string" && match.submitId.trim() ? match.submitId.trim() : undefined;
    return {
      sourceReceiptId: submitId ? `seedance_submit_${submitId}` : undefined,
      providerReceiptId: submitId ? `seedance_submit_${submitId}` : undefined,
      outputHash: typeof match.outputVideoSha256 === "string" ? match.outputVideoSha256 : undefined,
      outputSha256: typeof match.outputVideoSha256 === "string" ? match.outputVideoSha256 : undefined,
    };
  }

  function firstCleanString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  }

  function projectReviewReceipts(project) {
    return Array.isArray(project?.receipts?.reviewReceipts) ? project.receipts.reviewReceipts : [];
  }

  function projectWithReviewReceipts(source, fallbackProject) {
    if (projectReviewReceipts(fallbackProject).length || typeof readFileSync !== "function" || !source?.projectVibePath) {
      return fallbackProject;
    }
    try {
      const opened = parseProjectVibeText(readFileSync(source.projectVibePath, "utf8"));
      if (opened.ok && opened.project?.receipts) {
        return { ...fallbackProject, receipts: opened.project.receipts };
      }
    } catch {
      // Status projection stays read-only and should not fail just because Project.vibe is temporarily unreadable.
    }
    return fallbackProject;
  }

  function approvedReviewReceiptFor(project, item, relayEvidence) {
    const itemPath = firstCleanString(item?.expectedOutputPath, item?.mediaPath, item?.outputVideoPath);
    const itemHash = firstCleanString(item?.outputHash, item?.outputSha256, relayEvidence?.outputHash, relayEvidence?.outputSha256);
    const itemReceiptId = firstCleanString(item?.sourceReceiptId, item?.providerReceiptId, item?.providerRequestId, relayEvidence?.sourceReceiptId, relayEvidence?.providerReceiptId);
    const itemShotId = firstCleanString(item?.shotId);
    return projectReviewReceipts(project).find((receipt) => {
      if (receipt?.status !== "approved") return false;
      const receiptPath = firstCleanString(receipt.outputPath);
      const receiptHash = firstCleanString(receipt.outputHash);
      const receiptSourceId = firstCleanString(receipt.sourceReceiptId);
      const receiptShotId = firstCleanString(receipt.shotId);
      if (receiptPath && itemPath && receiptPath === itemPath) {
        return !receiptHash || !itemHash || receiptHash === itemHash;
      }
      if (receiptSourceId && itemReceiptId && receiptSourceId === itemReceiptId && receiptHash && itemHash) {
        return receiptHash === itemHash;
      }
      if (receiptShotId && itemShotId && receiptShotId === itemShotId && receiptHash && itemHash) {
        return receiptHash === itemHash;
      }
      return false;
    });
  }

  function statusAfterReviewReceipt(status, hadReviewShots, pendingReviewShotIds, replacement) {
    if (!hadReviewShots || pendingReviewShotIds.length) return status;
    return /needs_review|returned_with_review_overlay/.test(String(status || "")) ? replacement : status;
  }

  function previewPlanItems(projectFacts) {
    const previewPlan = projectFacts?.previewPlan;
    if (Array.isArray(previewPlan?.previewItems) && previewPlan.previewItems.length) return previewPlan.previewItems;
    if (Array.isArray(previewPlan?.clips) && previewPlan.clips.length) return previewPlan.clips;
    return [];
  }

  function previewPlanItemNeedsReview(item) {
    const status = String(item?.status || item?.previewStatus || item?.videoStatus || "").toLowerCase();
    return item?.reviewRequired === true
      || item?.reviewOverlay === true
      || status.includes("needs_review")
      || status.includes("returned_with_review_overlay");
  }

  function previewPlanItemForResponse(project, relayQueue, item, index) {
    const relayEvidence = relayEvidenceFor(relayQueue, item);
    const approvedReviewReceipt = approvedReviewReceiptFor(project, item, relayEvidence);
    const videoLike = item?.mediaType === "video"
      || Boolean(item?.videoStatus)
      || /\.(?:mp4|mov|webm)(?:\?|$)/i.test(item?.expectedOutputPath || item?.mediaPath || item?.outputVideoPath || "");
    const status = firstCleanString(item?.status, item?.previewStatus, videoLike ? "returned_with_review_overlay" : undefined);
    return {
      id: firstCleanString(item?.id, item?.clipId, item?.shotId ? `preview_${item.shotId}` : undefined) || `preview_${index + 1}`,
      clipId: firstCleanString(item?.clipId),
      shotId: firstCleanString(item?.shotId) || firstCleanString(Array.isArray(item?.shotIds) ? item.shotIds[0] : undefined),
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      imageUrl: item?.imageUrl,
      mediaPath: firstCleanString(item?.mediaPath, item?.expectedOutputPath, item?.outputVideoPath),
      mediaType: firstCleanString(item?.mediaType) || (videoLike ? "video" : undefined),
      sourceReceiptId: (videoLike ? relayEvidence.sourceReceiptId : undefined) || item?.sourceReceiptId || relayEvidence.sourceReceiptId,
      providerReceiptId: item?.providerReceiptId || relayEvidence.providerReceiptId,
      providerRequestId: item?.providerRequestId,
      outputHash: item?.outputHash || relayEvidence.outputHash,
      outputSha256: item?.outputSha256 || relayEvidence.outputSha256,
      promptText: item?.promptText,
      promptHash: item?.promptHash,
      durationSeconds: item?.durationSeconds,
      videoStatus: item?.videoStatus || (videoLike ? "success" : undefined),
      submitId: item?.submitId,
      queueInfo: item?.queueInfo,
      localMediaPaths: item?.localMediaPaths,
      outputVideoPath: item?.outputVideoPath,
      outputExists: item?.outputExists,
      status: approvedReviewReceipt ? "approved" : status,
      reviewRequired: approvedReviewReceipt ? false : previewPlanItemNeedsReview(item),
      reviewOverlay: approvedReviewReceipt ? false : previewPlanItemNeedsReview(item),
      previewQaStatus: approvedReviewReceipt ? "approved" : item?.previewQaStatus,
      productionQaStatus: approvedReviewReceipt ? "approved" : item?.productionQaStatus,
      runtimeTruthStatus: item?.runtimeTruthStatus,
      blockers: item?.blockers,
    };
  }

  function currentProjectRealChainResponse(extra = {}, source = currentProjectSource()) {
    const projection = projectProjectionFromSource(source);
    const { project, projectFacts, observations } = projection;
    const reviewProject = projectWithReviewReceipts(source, project);
    const relayQueue = projectFacts.previewPlan?.relayQueue || readPersistedRelayQueue(source);
    const previewPlanReviewItems = previewPlanItems(projectFacts).filter(previewPlanItemNeedsReview);
    const needsReviewShotIds = Array.from(new Set([
      ...projection.reviewShotIds,
      ...previewPlanReviewItems
        .map((item) => firstCleanString(item?.shotId) || firstCleanString(Array.isArray(item?.shotIds) ? item.shotIds[0] : undefined))
        .filter(Boolean),
    ]));
    const approvedReviewShotIds = new Set(observations.map((item) => {
      const relayEvidence = relayEvidenceFor(relayQueue, item);
      return approvedReviewReceiptFor(reviewProject, item, relayEvidence) ? item.shotId : undefined;
    }).filter(Boolean));
    const pendingReviewShotIds = needsReviewShotIds.filter((shotId) => !approvedReviewShotIds.has(shotId));
    const hadReviewShots = needsReviewShotIds.length > 0;
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
    const basePreviewStatus = preferRound5Status
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
    const baseProductionStatus = preferRound5Status
      ? round5UiStatus === "blocked"
        ? "blocked"
        : round5UiStatus === "needs_review"
          ? "needs_review"
          : "unavailable"
      : projection.ok
        ? projection.productionStatus
        : "unavailable";
    const resolvedPreviewStatus = statusAfterReviewReceipt(basePreviewStatus, hadReviewShots, pendingReviewShotIds, "preview_ready");
    const resolvedProductionStatus = statusAfterReviewReceipt(baseProductionStatus, hadReviewShots, pendingReviewShotIds, "ready");
    const resolvedReportStatus = statusAfterReviewReceipt(resolvedStatus, hadReviewShots, pendingReviewShotIds, "preview_ready");
    const plannedImageCount = observations.length || round5ArtifactIngest?.uiSummary?.totalShots || 0;
    const returnedImageCount = projection.returnedObservations.length || round5ArtifactIngest?.uiSummary?.observedStarts || 0;
    const blockerCount = projection.blockedObservations.length || round5ArtifactIngest?.uiSummary?.nextActions?.length || 0;

    const observationPreviewItems = observations.map((item) => {
      const relayEvidence = relayEvidenceFor(relayQueue, item);
      const approvedReviewReceipt = approvedReviewReceiptFor(reviewProject, item, relayEvidence);
      const videoLike = item.mediaType === "video" || Boolean(item.videoStatus) || /\.(?:mp4|mov|webm)(?:\?|$)/i.test(item.expectedOutputPath || item.mediaPath || "");
      return {
        shotId: item.shotId,
        order: item.order,
        imageUrl: item.imageUrl,
        mediaPath: item.expectedOutputPath,
        mediaType: item.mediaType,
        sourceReceiptId: (videoLike ? relayEvidence.sourceReceiptId : undefined) || item.sourceReceiptId || relayEvidence.sourceReceiptId,
        providerReceiptId: item.providerReceiptId || relayEvidence.providerReceiptId,
        providerRequestId: item.providerRequestId,
        outputHash: item.outputHash || relayEvidence.outputHash,
        outputSha256: item.outputSha256 || relayEvidence.outputSha256,
        promptText: item.promptText,
        promptHash: item.promptHash,
        durationSeconds: item.durationSeconds,
        videoStatus: item.videoStatus,
        submitId: item.submitId,
        queueInfo: item.queueInfo,
        localMediaPaths: item.localMediaPaths,
        outputVideoPath: item.outputVideoPath,
        outputExists: item.outputExists,
        status: approvedReviewReceipt ? "approved" : item.previewStatus,
        reviewOverlay: approvedReviewReceipt ? false : item.reviewOverlay === true,
        previewQaStatus: approvedReviewReceipt ? "approved" : item.previewQaStatus,
        productionQaStatus: approvedReviewReceipt ? "approved" : item.productionQaStatus,
        runtimeTruthStatus: item.runtimeTruthStatus,
        blockers: item.blockers,
      };
    });
    const planPreviewItems = previewPlanItems(projectFacts)
      .map((item, index) => previewPlanItemForResponse(reviewProject, relayQueue, item, index));

    return {
      ok: resolvedOk,
      ...runtimePolicy(),
      endpoint: currentProjectStatusEndpoint,
      status: resolvedReportStatus,
      previewStatus: resolvedPreviewStatus,
      productionStatus: resolvedProductionStatus,
      reportStatus: resolvedReportStatus,
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
      needsReviewCount: pendingReviewShotIds.length,
      needsReviewShotIds: pendingReviewShotIds,
      reviewShotIds: pendingReviewShotIds,
      reviewOverlayShots: pendingReviewShotIds,
      productionNeedsReviewShots: pendingReviewShotIds,
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
      relayQueue,
      round5ArtifactIngest,
      observations,
      previewItems: planPreviewItems.length ? planPreviewItems : observationPreviewItems,
      nextAction: preferRound5Status
        ? "round5_artifact_gates_require_review"
        : projection.ok
        ? pendingReviewShotIds.length
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

  function currentProjectRealChainRunCheckResponse(extra = {}, source = currentProjectSource()) {
    const projectFacts = readProjectFacts(source);
    return currentProjectRealChainResponse({
      ...extra,
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
  }

  return {
    currentProjectRealChainResponse,
    currentProjectRealChainRunCheckResponse,
  };
}
