function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
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

export function createRuntimeApiCurrentProjectImage2BatchPlan(deps) {
  const {
    currentProjectSource,
    projectProjectionFromSource,
    readProjectFacts,
    runtimePolicy,
    runtimeFileUrl,
    existsSync,
    currentProjectImage2BatchPlanEndpoint,
  } = deps;

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

  function currentProjectImage2BatchRunCheckResponse(extra = {}, source = currentProjectSource()) {
    const projectFacts = readProjectFacts(source);
    return currentProjectImage2BatchPlanResponse({
      ...extra,
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
  }

  return {
    currentProjectImage2BatchPlanResponse,
    currentProjectImage2BatchRunCheckResponse,
  };
}
