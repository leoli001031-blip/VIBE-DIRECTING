import { createHash } from "node:crypto";
import {
  createProviderRetrySchedulerState,
  providerRetryAttemptReceiptCandidates,
  queueNextProviderRetryBatch,
} from "../src/core/providerRetryScheduler.ts";
import {
  IMAGE2_GENERATE_MAX_AUTO_RETRIES,
  IMAGE2_GENERATE_MAX_CONCURRENCY,
  IMAGE2_GENERATE_RETRY_CONCURRENCY,
  IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
  IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
  getProviderRule,
} from "../src/core/providerPolicy.ts";

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

function image2BatchPolicyProjection() {
  const generateRule = getProviderRule("image.generate");
  const editRule = getProviderRule("image.edit");
  return {
    schemaVersion: "current_project_image2_batch_policy_v1",
    providerCalled: false,
    liveSubmitAllowed: false,
    promotionAllowed: false,
    imageGenerate: {
      providerSlot: "image.generate",
      activeProvider: generateRule?.activeProvider,
      requiredMode: "text2image",
      concurrency: IMAGE2_GENERATE_MAX_CONCURRENCY,
      retryConcurrency: IMAGE2_GENERATE_RETRY_CONCURRENCY,
      maxAutoRetries: IMAGE2_GENERATE_MAX_AUTO_RETRIES,
      successfulReturnStatus: "needs_review",
      missingReturnStatus: "missing",
      lateReturnStatus: "needs_review",
      threeConcurrentTextToImageDefaultAllowed: true,
    },
    imageEditReference: {
      providerSlot: "image.edit",
      activeProvider: editRule?.activeProvider,
      requiredMode: "image2image",
      concurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
      referenceConcurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
      maxAutoRetries: IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
      textToImageFallbackAllowed: false,
      successfulReturnStatus: "needs_review",
      missingReturnStatus: "missing",
      lateReturnStatus: "needs_review",
    },
  };
}

function image2RetryPlanningPolicy() {
  return {
    maxConcurrency: IMAGE2_GENERATE_MAX_CONCURRENCY,
    retryConcurrency: IMAGE2_GENERATE_RETRY_CONCURRENCY,
    maxAutoRetries: IMAGE2_GENERATE_MAX_AUTO_RETRIES,
    baseDelayMs: 1500,
    maxDelayMs: 30000,
    retryableFailureKinds: ["timeout", "rate_limit", "server_error", "network_error", "provider_missing"],
    terminalFailureKinds: ["auth", "validation_error", "content_policy", "qa_failed", "cancelled"],
  };
}

function image2CircuitBreakerProjection(state, nextRunnable = []) {
  const policy = state?.policy || image2RetryPlanningPolicy();
  const retryConcurrency = policy.retryConcurrency || policy.maxConcurrency;
  const attempts = Array.isArray(state?.attempts) ? state.attempts : [];
  const summary = state?.summary || {};
  const networkErrorCount = attempts.filter((attempt) => attempt.failureKind === "network_error").length;
  const retryableFailureCount = attempts.filter(
    (attempt) => attempt.failureKind && policy.retryableFailureKinds.includes(attempt.failureKind),
  ).length;
  const retryScheduledCount = summary.retryScheduled || 0;
  const terminalFailedCount = summary.terminalFailed || 0;
  const retrySignal =
    retryScheduledCount > 0 ||
    retryableFailureCount > 0 ||
    nextRunnable.some((attempt) => attempt.attemptNumber > 1);
  const exhaustedAfterRetryableFailure =
    Array.isArray(state?.tasks) &&
    state.tasks.length > 0 &&
    retryableFailureCount > 0 &&
    terminalFailedCount > 0 &&
    (summary.queued || 0) === 0 &&
    (summary.running || 0) === 0 &&
    (summary.succeeded || 0) < state.tasks.length;
  const status = exhaustedAfterRetryableFailure ? "open" : retrySignal ? "retry_downshift" : "closed";
  const activeConcurrency =
    status === "open" ? 0 : status === "retry_downshift" ? retryConcurrency : policy.maxConcurrency;

  return {
    schemaVersion: "current_project_image2_circuit_breaker_v1",
    status,
    defaultConcurrency: policy.maxConcurrency,
    retryConcurrency,
    activeConcurrency,
    maxAutoRetries: policy.maxAutoRetries,
    retryableFailureKinds: policy.retryableFailureKinds,
    networkErrorCount,
    retryableFailureCount,
    retryScheduledCount,
    terminalFailedCount,
    nextRunnableCount: nextRunnable.length,
    downshiftOnNetworkError: true,
    providerCalled: summary.providerCalled === true,
    liveSubmitAllowed: false,
    promotionAllowed: false,
    nextAction:
      status === "open"
        ? "manual_review_required"
        : status === "retry_downshift"
          ? "retry_missing_at_reduced_concurrency"
          : "run_default_batch",
    userLabel:
      status === "open"
        ? "Manual review needed"
        : status === "retry_downshift"
          ? `Retry at ${retryConcurrency}`
          : `Default ${policy.maxConcurrency}`,
  };
}

function retryInputHashForItem(item) {
  const material = [
    item.shotId,
    item.taskRunId,
    item.envelopeId,
    item.expectedOutputPath,
    item.promptPath,
    ...(Array.isArray(item.referencePaths) ? item.referencePaths : []),
  ].join("\n");
  return `sha256:${createHash("sha256").update(material).digest("hex")}`;
}

function itemNeedsProviderRetryPlan(item) {
  if (item.blocked === true) return false;
  if (Array.isArray(item.blockers) && item.blockers.length) return false;
  if (item.outputExists === true && item.providerObservationActual === true) return false;
  if (item.semanticQaNeedsReview === true || item.reviewOverlay === true) return false;
  return true;
}

function image2RetrySchedulerProjection(items, generatedAt) {
  const policy = image2RetryPlanningPolicy();
  const tasks = items.filter(itemNeedsProviderRetryPlan).map((item) => ({
    taskId: item.taskRunId,
    shotId: item.shotId,
    inputHash: retryInputHashForItem(item),
    permissionReceiptId: `manual_permission_required:${item.shotId}`,
    expectedOutputPath: item.expectedOutputPath,
    priority: Math.max(0, items.length - (item.queueOrder || 0)),
  }));
  const state = createProviderRetrySchedulerState({ tasks, policy, generatedAt });
  const nextRunnable = queueNextProviderRetryBatch(state, generatedAt).map((attempt) => ({
    attemptId: attempt.attemptId,
    taskId: attempt.taskId,
    shotId: attempt.shotId,
    attemptNumber: attempt.attemptNumber,
    scheduledAt: attempt.scheduledAt,
  }));
  const circuitBreaker = image2CircuitBreakerProjection(state, nextRunnable);

  return {
    schemaVersion: state.schemaVersion,
    mode: "planning_only_retry_scheduler_projection",
    actualProviderRetryAllowed: false,
    automaticProviderRetryAllowed: false,
    requiresExplicitPermissionReceipt: true,
    noPromotionWithoutReceipt: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    promotionAllowed: false,
    policyProjection: image2BatchPolicyProjection(),
    simulationPolicy: state.policy,
    circuitBreaker,
    attemptReceiptCandidates: providerRetryAttemptReceiptCandidates(state),
    effectiveRuntimePolicy: {
      maxConcurrency: 0,
      maxAutoRetries: 0,
      reason: "Retry scheduler is projected for diagnostics only; runtime submit still requires explicit permission receipt.",
    },
    summary: {
      ...state.summary,
      providerCalled: false,
      promotionAllowed: false,
      nextRunnableCount: nextRunnable.length,
      blockedFromRetryCount: items.length - tasks.length,
    },
    nextRunnable,
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
    const generatedAt = new Date(0).toISOString();
    const retryScheduler = image2RetrySchedulerProjection(items, generatedAt);
    const policyProjection = image2BatchPolicyProjection();
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
      policyProjection,
      retryScheduler,
      plan: {
        mode: "read_only_image2_batch_prepare_check_projection",
        sourceObservationLimit: 10,
        policyProjection,
        items,
        retryScheduler,
      },
      items,
      summary: {
        plannedCount: items.length,
        readyCount: items.length - blockedItems.length,
        blockedCount: blockedItems.length,
        returnedCount: selectedObservations.filter((item) => item.returned).length,
        reviewCount: selectedObservations.filter((item) => item.reviewOverlay || item.semanticQaNeedsReview).length,
        retryQueuedCount: retryScheduler.summary.queued,
        retryNextRunnableCount: retryScheduler.summary.nextRunnableCount,
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
        retrySchedulerPlanningOnly: true,
        retrySchedulerProviderCalled: false,
        retrySchedulerPromotionAllowed: false,
      },
    }, source);
  }

  return {
    currentProjectImage2BatchPlanResponse,
    currentProjectImage2BatchRunCheckResponse,
  };
}
