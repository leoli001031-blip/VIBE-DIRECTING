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

  function readLatestSeedanceSubmitReport(source) {
    if (typeof readJsonIfPresent !== "function") return undefined;
    const candidates = [
      source?.runRootPath ? `${source.runRootPath}/reports/seedance_submit_report.json` : undefined,
      source?.runRootRelativePath ? `${source.runRootRelativePath}/reports/seedance_submit_report.json` : undefined,
    ].filter(Boolean);
    for (const candidate of candidates) {
      const report = readJsonIfPresent(candidate);
      if (report && typeof report === "object") return report;
    }
    return undefined;
  }

  function activeRelayStatus(status) {
    return [
      "submitting",
      "submitted",
      "queued",
      "running",
      "generating",
      "polling",
      "recoverable_queued",
    ].includes(String(status || ""));
  }

  function relayStatusCounts(items) {
    const active = items.filter((item) => activeRelayStatus(item?.status));
    const ready = items.filter((item) => ["planned", "ready"].includes(String(item?.status)) && !(Array.isArray(item?.blockers) && item.blockers.length));
    const completed = items.filter((item) => item?.status === "success");
    const failed = items.filter((item) => item?.status === "failed");
    const blocked = items.filter((item) => item?.status === "blocked");
    return {
      total: items.length,
      ready: ready.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      blocked: blocked.length,
    };
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function uniqueStrings(values) {
    return Array.from(new Set(values.map(cleanText).filter(Boolean)));
  }

  function projectAssets(project) {
    return Array.isArray(project?.assets) ? project.assets : [];
  }

  function assetKind(asset) {
    return cleanText(asset?.kind || asset?.type).toLowerCase();
  }

  function assetText(asset) {
    return uniqueStrings([
      asset?.id,
      asset?.label,
      asset?.name,
      asset?.path,
      ...(Array.isArray(asset?.textConstraints) ? asset.textConstraints : []),
      ...(Array.isArray(asset?.sourceRefs) ? asset.sourceRefs : []),
    ]).join(" ").toLowerCase();
  }

  function lockedRecoverySceneReferenceFor(project, item, message) {
    const shotIds = uniqueStrings([
      item?.shotId,
      ...(Array.isArray(item?.shotIds) ? item.shotIds : []),
    ]);
    if (!shotIds.length) return undefined;
    const messageText = cleanText(message).toLowerCase();
    return projectAssets(project).find((asset) => {
      if (assetKind(asset) !== "scene") return false;
      if (cleanText(asset?.status).toLowerCase() !== "locked") return false;
      const usedByShotIds = Array.isArray(asset?.usedByShotIds) ? asset.usedByShotIds : [];
      if (!usedByShotIds.some((shotId) => shotIds.includes(cleanText(shotId)))) return false;
      const searchable = assetText(asset);
      if (!/recoveryreference:scene|scene_recovery|recovery/.test(searchable)) return false;
      const constraints = Array.isArray(asset?.textConstraints) ? asset.textConstraints.map(cleanText).filter(Boolean) : [];
      const targetHints = constraints.filter((value) => value !== "recoveryReference:scene");
      if (!targetHints.length) return true;
      return targetHints.some((hint) => messageText.includes(hint.toLowerCase()) || searchable.includes(hint.toLowerCase()));
    });
  }

  function relayQueueWithLatestSubmitBlocker(relayQueue, report, project) {
    const reportStatus = String(report?.status || "");
    const blockers = Array.isArray(report?.blockers)
      ? report.blockers.filter((item) => typeof item === "string" && item.trim())
      : [];
    const message = firstCleanString(report?.message, blockers[0]);
    if (!relayQueue || !message || report?.videoSubmitted === true || !/blocked/i.test(reportStatus)) return relayQueue;
    const activeSegmentId = firstCleanString(report?.activeSegmentId);
    const items = relayItems(relayQueue);
    const fallbackTarget = relayQueue.nextReadyItemId
      || items.find((item) => item?.status === "ready" || item?.status === "planned")?.id;
    const updatedItems = items.map((item) => {
      const matchesSegment = activeSegmentId && (item?.segmentId === activeSegmentId || item?.id === activeSegmentId);
      const matchesFallback = !activeSegmentId && fallbackTarget && item?.id === fallbackTarget;
      if (!matchesSegment && !matchesFallback) return item;
      const recoveryReference = lockedRecoverySceneReferenceFor(project, item, message);
      if (recoveryReference) {
        return {
          ...item,
          status: "ready",
          blockers: [],
          notes: Array.from(new Set([
            ...(Array.isArray(item?.notes) ? item.notes : []),
            `补充场景参考已锁定：${firstCleanString(recoveryReference.label, recoveryReference.id) || "场景参考"}`,
          ])),
        };
      }
      return {
        ...item,
        status: "blocked",
        blockers: Array.from(new Set([...(Array.isArray(item?.blockers) ? item.blockers : []), message])),
        notes: Array.from(new Set([...(Array.isArray(item?.notes) ? item.notes : []), "视频提交前 QA 拦截，需先修复后再提交。"])),
      };
    });
    const counts = relayStatusCounts(updatedItems);
    const activeItems = updatedItems.filter((item) => activeRelayStatus(item?.status));
    const nextReadyItem = updatedItems.find((item) => ["planned", "ready"].includes(String(item?.status)) && !(Array.isArray(item?.blockers) && item.blockers.length));
    return {
      ...relayQueue,
      status: counts.blocked > 0 ? "blocked" : relayQueue.status,
      counts,
      activeItemIds: activeItems.map((item) => item.id).filter(Boolean),
      nextReadyItemId: nextReadyItem?.id,
      autoSubmitAllowed: Boolean(counts.blocked === 0 && activeItems.length === 0 && nextReadyItem),
      userSummary: counts.blocked > 0 ? `视频提交前被拦住：${message}` : "补充参考已复核，可以继续提交视频。",
      items: updatedItems,
    };
  }

  function relayItems(relayQueue) {
    return Array.isArray(relayQueue?.items) ? relayQueue.items : [];
  }

  function relayActiveResponseStatus(relayQueue) {
    const activeItems = relayItems(relayQueue).filter((item) => activeRelayStatus(item?.status));
    if (!activeItems.length) return undefined;
    if (activeItems.some((item) => ["running", "generating"].includes(String(item?.status || "")))) return "running";
    if (activeItems.some((item) => ["submitted", "submitting"].includes(String(item?.status || "")))) return "submitted";
    return "queued";
  }

  function shouldLetActiveRelayOverride(status) {
    return ["failed", "blocked", "unavailable"].includes(String(status || ""));
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
      submitId,
      videoStatus: match.status === "recoverable_queued" || match.status === "polling"
        ? "queued"
        : match.status === "running"
          ? "generating"
          : match.status,
      queueInfo: match.queueInfo,
      queuePosition: match.queuePosition,
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
    if (typeof readFileSync !== "function" || !source?.projectVibePath) {
      return fallbackProject;
    }
    try {
      const opened = parseProjectVibeText(readFileSync(source.projectVibePath, "utf8"));
      if (opened.project) {
        return {
          ...fallbackProject,
          assets: Array.isArray(fallbackProject?.assets) && fallbackProject.assets.length
            ? fallbackProject.assets
            : opened.project.assets,
          receipts: projectReviewReceipts(fallbackProject).length
            ? fallbackProject.receipts
            : opened.project.receipts,
        };
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
      videoStatus: relayEvidence.videoStatus || item?.videoStatus || (videoLike ? "success" : undefined),
      submitId: item?.submitId || relayEvidence.submitId,
      queueInfo: relayEvidence.queueInfo || item?.queueInfo,
      queuePosition: relayEvidence.queuePosition ?? item?.queuePosition,
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
    const latestSeedanceSubmitReport = readLatestSeedanceSubmitReport(source);
    const relayQueue = relayQueueWithLatestSubmitBlocker(
      readPersistedRelayQueue(source) || projectFacts.previewPlan?.relayQueue,
      latestSeedanceSubmitReport,
      reviewProject,
    );
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
    const relayActiveStatus = resolvedOk ? relayActiveResponseStatus(relayQueue) : undefined;
    const reviewResolvedPreviewStatus = statusAfterReviewReceipt(basePreviewStatus, hadReviewShots, pendingReviewShotIds, "preview_ready");
    const reviewResolvedProductionStatus = statusAfterReviewReceipt(baseProductionStatus, hadReviewShots, pendingReviewShotIds, "ready");
    const reviewResolvedReportStatus = statusAfterReviewReceipt(resolvedStatus, hadReviewShots, pendingReviewShotIds, "preview_ready");
    const activeRelayOverridesReport = relayActiveStatus && shouldLetActiveRelayOverride(reviewResolvedReportStatus);
    const resolvedPreviewStatus = relayActiveStatus && shouldLetActiveRelayOverride(reviewResolvedPreviewStatus)
      ? relayActiveStatus
      : reviewResolvedPreviewStatus;
    const resolvedProductionStatus = relayActiveStatus && shouldLetActiveRelayOverride(reviewResolvedProductionStatus)
      ? relayActiveStatus
      : reviewResolvedProductionStatus;
    const resolvedReportStatus = activeRelayOverridesReport
      ? relayActiveStatus
      : reviewResolvedReportStatus;
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
      latestSeedanceSubmitReport,
      round5ArtifactIngest,
      observations,
      previewItems: planPreviewItems.length ? planPreviewItems : observationPreviewItems,
      nextAction: activeRelayOverridesReport
        ? "query_active_video_task"
        : preferRound5Status
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
