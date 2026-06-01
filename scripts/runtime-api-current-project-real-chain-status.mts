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
    currentProjectStatusEndpoint,
  } = deps;

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
      relayQueue: projectFacts.previewPlan?.relayQueue,
      round5ArtifactIngest,
      observations,
      previewItems: observations.map((item) => ({
        shotId: item.shotId,
        order: item.order,
        imageUrl: item.imageUrl,
        mediaPath: item.expectedOutputPath,
        mediaType: item.mediaType,
        sourceReceiptId: item.sourceReceiptId,
        providerRequestId: item.providerRequestId,
        outputHash: item.outputHash,
        outputSha256: item.outputSha256,
        promptText: item.promptText,
        promptHash: item.promptHash,
        durationSeconds: item.durationSeconds,
        videoStatus: item.videoStatus,
        submitId: item.submitId,
        queueInfo: item.queueInfo,
        localMediaPaths: item.localMediaPaths,
        outputVideoPath: item.outputVideoPath,
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
