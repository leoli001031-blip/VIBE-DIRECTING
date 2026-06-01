import {
  booleanOrUndefined,
  currentProjectIdentityMatches,
  isRecord,
  numberOrUndefined,
  projectMismatchMessage,
  stringArray,
  stringOrUndefined,
  toRuntimeUrl,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";
import type {
  ProjectImage2BatchLedgerProjection,
  ProjectImage2BatchLedgerSummary,
  ProjectImage2BatchPayload,
  ProjectImage2BatchPlanItem,
  ProjectImage2BatchRetrySummary,
  ProjectImage2BatchPlanStatus,
  ProjectImage2BatchUiState,
  ProjectImage2BatchUiStatus,
  ProjectImage2OneShotPayload,
  ProjectImage2OneShotPermissionReceipt,
  ProjectImage2OneShotStatus,
  ProjectImage2OneShotUiState,
  ProjectImage2OneShotUiStatus,
} from "./projectImage2Types";

export function guardProjectImage2BatchUiStateForCurrentProject(
  state: ProjectImage2BatchUiState,
  expected?: ProjectRuntimeIdentity,
): ProjectImage2BatchUiState {
  if (!state.summary || currentProjectIdentityMatches(state.summary, expected)) return state;
  return {
    status: "unavailable",
    message: projectMismatchMessage(),
  };
}

export function guardProjectImage2OneShotUiStateForCurrentProject(
  state: ProjectImage2OneShotUiState,
  expected?: ProjectRuntimeIdentity,
): ProjectImage2OneShotUiState {
  if (!state.summary || currentProjectIdentityMatches(state.summary, expected)) return state;
  return {
    status: "unavailable",
    message: projectMismatchMessage(),
  };
}

function image2BatchPayloadFromUnknown(payload: unknown): ProjectImage2BatchPayload | undefined {
  if (!isRecord(payload)) return undefined;
  if (payload.projectionKind === "current_project_image2_batch_prepare_plan" || Array.isArray(payload.items)) {
    return payload as ProjectImage2BatchPayload;
  }
  if (isRecord(payload.report)) return { ...(payload.report as ProjectImage2BatchPayload), ...payload } as ProjectImage2BatchPayload;
  if (isRecord(payload.result)) return { ...(payload.result as ProjectImage2BatchPayload), ...payload } as ProjectImage2BatchPayload;
  return undefined;
}

function deriveImage2BatchLedgerSummary(value: unknown): ProjectImage2BatchLedgerSummary | undefined {
  if (!isRecord(value)) return undefined;
  return {
    total: numberOrUndefined(value.total) ?? 0,
    queued: numberOrUndefined(value.queued) ?? 0,
    blocked: numberOrUndefined(value.blocked) ?? 0,
    parked: numberOrUndefined(value.parked) ?? 0,
    completeVerified: numberOrUndefined(value.completeVerified) ?? 0,
    providerSubmissionForbidden: booleanOrUndefined(value.providerSubmissionForbidden) ?? false,
    liveSubmitAllowed: booleanOrUndefined(value.liveSubmitAllowed) ?? false,
    noFileMutation: booleanOrUndefined(value.noFileMutation) ?? false,
    workerSpawnForbidden: booleanOrUndefined(value.workerSpawnForbidden) ?? false,
    providerCalled: booleanOrUndefined(value.providerCalled) ?? false,
  };
}

function normalizeLedgerExpectedOutputs(value: unknown): ProjectImage2BatchLedgerProjection["expectedOutputs"] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { expectedOutputPath?: string; path?: string } | string => {
    if (typeof item === "string") return true;
    return isRecord(item) && (typeof item.expectedOutputPath === "string" || typeof item.path === "string");
  }).map((item) => {
    if (typeof item === "string") return item;
    return {
      expectedOutputPath: typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined,
      path: typeof item.path === "string" ? item.path : undefined,
    };
  });
}

function deriveImage2BatchLedgerProjections(value: unknown): ProjectImage2BatchLedgerProjection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index): ProjectImage2BatchLedgerProjection => ({
    taskRunId: typeof item.taskRunId === "string" ? item.taskRunId : `task_run_${String(index + 1).padStart(2, "0")}`,
    envelopeId: typeof item.envelopeId === "string" ? item.envelopeId : undefined,
    currentStatus: typeof item.currentStatus === "string" ? item.currentStatus : "prepared",
    expectedOutputPath: typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined,
    expectedOutputs: normalizeLedgerExpectedOutputs(item.expectedOutputs),
    previewStatus: typeof item.previewStatus === "string"
      ? item.previewStatus
      : isRecord(item.previewSummary) && typeof item.previewSummary.status === "string"
        ? item.previewSummary.status
        : undefined,
    completeVerified: item.completeVerified === true
      || (isRecord(item.completionGate) && item.completionGate.completeVerified === true),
  }));
}

function deriveImage2BatchRetrySummary(value: unknown): ProjectImage2BatchRetrySummary | undefined {
  if (!isRecord(value)) return undefined;
  const summary = isRecord(value.summary) ? value.summary : undefined;
  const simulationPolicy = isRecord(value.simulationPolicy) ? value.simulationPolicy : undefined;
  const circuitBreaker = isRecord(value.circuitBreaker) ? value.circuitBreaker : undefined;
  const rawCircuitBreakerStatus = circuitBreaker?.status;
  const circuitBreakerStatus =
    rawCircuitBreakerStatus === "closed" ||
    rawCircuitBreakerStatus === "retry_downshift" ||
    rawCircuitBreakerStatus === "open"
      ? rawCircuitBreakerStatus
      : undefined;
  return {
    totalTasks: numberOrUndefined(summary?.totalTasks) ?? 0,
    queued: numberOrUndefined(summary?.queued) ?? 0,
    running: numberOrUndefined(summary?.running) ?? 0,
    succeeded: numberOrUndefined(summary?.succeeded) ?? 0,
    terminalFailed: numberOrUndefined(summary?.terminalFailed) ?? 0,
    retryScheduled: numberOrUndefined(summary?.retryScheduled) ?? 0,
    attemptsTotal: numberOrUndefined(summary?.attemptsTotal) ?? 0,
    maxObservedConcurrency: numberOrUndefined(summary?.maxObservedConcurrency) ?? 0,
    maxConcurrency: numberOrUndefined(simulationPolicy?.maxConcurrency),
    retryConcurrency:
      numberOrUndefined(simulationPolicy?.retryConcurrency) ?? numberOrUndefined(circuitBreaker?.retryConcurrency),
    maxAutoRetries: numberOrUndefined(simulationPolicy?.maxAutoRetries),
    nextRunnableCount: numberOrUndefined(summary?.nextRunnableCount),
    circuitBreakerStatus,
    activeConcurrency: numberOrUndefined(circuitBreaker?.activeConcurrency),
    defaultConcurrency: numberOrUndefined(circuitBreaker?.defaultConcurrency),
    networkErrorCount: numberOrUndefined(circuitBreaker?.networkErrorCount),
    retryableFailureCount: numberOrUndefined(circuitBreaker?.retryableFailureCount),
    downshiftOnNetworkError: booleanOrUndefined(circuitBreaker?.downshiftOnNetworkError),
    providerCalled: booleanOrUndefined(value.providerCalled) ?? booleanOrUndefined(summary?.providerCalled) ?? false,
    promotionAllowed: booleanOrUndefined(value.promotionAllowed) ?? booleanOrUndefined(summary?.promotionAllowed) ?? false,
  };
}

export function deriveProjectImage2BatchPlanStatus(
  payload: unknown,
): ProjectImage2BatchPlanStatus {
  const report = image2BatchPayloadFromUnknown(payload);
  if (!report) {
    return {
      uiStatus: "unavailable",
      plannedCount: 0,
      readyCount: 0,
      blockedCount: 0,
      selectedShotIds: [],
      nextAction: "未选择项目/未同步。",
      items: [],
      ledgerProjections: [],
      queuedCount: 0,
      parkedCount: 0,
      completeVerifiedCount: 0,
      providerSubmissionForbidden: false,
      noFileMutation: false,
      workerSpawnForbidden: false,
      providerCalled: false,
      prepareRan: false,
      verifyScriptRan: false,
      liveSubmitAllowed: false,
      message: "未选择项目/未同步。",
    };
  }

  const items = (report.items || []).map((item, index): ProjectImage2BatchPlanItem => ({
    shotId: item.shotId || `S${String(index + 1).padStart(2, "0")}`,
    taskRunId: item.taskRunId,
    packetId: item.packetId,
    envelopeId: item.envelopeId,
    expectedOutputPath: item.expectedOutputPath,
    providerObservationPath: item.providerObservationPath,
    semanticQaPath: item.semanticQaPath,
    promptPath: item.promptPath,
    referencePaths: stringArray(item.referencePaths),
    queueOrder: typeof item.queueOrder === "number" ? item.queueOrder : index + 1,
    blocked: item.blocked === true || stringArray(item.blockers).length > 0,
    blockers: stringArray(item.blockers),
  }));
  const plannedCount = numberOrUndefined(report.summary?.plannedCount) ?? items.length;
  const blockedCount = numberOrUndefined(report.summary?.blockedCount) ?? items.filter((item) => item.blocked).length;
  const readyCount = numberOrUndefined(report.summary?.readyCount) ?? Math.max(0, plannedCount - blockedCount);
  const selectedShotIds = stringArray(report.summary?.selectedShotIds).length
    ? stringArray(report.summary?.selectedShotIds)
    : items.map((item) => item.shotId);
  const ledgerSummary = deriveImage2BatchLedgerSummary(report.ledgerProjection?.summary);
  const ledgerProjections = deriveImage2BatchLedgerProjections(report.ledgerProjection?.projections);
  const retrySummary = deriveImage2BatchRetrySummary(report.retryScheduler);
  const uiStatus: ProjectImage2BatchUiStatus = plannedCount > 0 && blockedCount === 0 ? "ready_for_review" : plannedCount > 0 ? "blocked" : "unavailable";
  const project = report.project || {};

  return {
    uiStatus,
    schemaVersion: report.schemaVersion,
    projectionKind: report.projectionKind,
    sourceLabel: report.sourceLabel,
    sandboxSource: report.sandboxSource,
    projectId: project.projectId,
    runId: project.runId,
    projectRoot: project.projectRoot,
    projectVibePath: project.projectVibePath,
    reportPath: report.reportRelativePath || report.reportPath,
    plannedCount,
    readyCount,
    blockedCount,
    selectedShotIds,
    nextAction: report.summary?.nextAction || "复核当前项目状态。",
    items,
    ledgerSummary,
    ledgerProjections,
    retrySummary,
    queuedCount: ledgerSummary?.queued ?? ledgerProjections.filter((item) => item.currentStatus === "queued").length,
    parkedCount: ledgerSummary?.parked ?? ledgerProjections.filter((item) => item.currentStatus === "parked").length,
    completeVerifiedCount: ledgerSummary?.completeVerified ?? ledgerProjections.filter((item) => item.completeVerified).length,
    providerSubmissionForbidden: ledgerSummary?.providerSubmissionForbidden ?? false,
    noFileMutation: ledgerSummary?.noFileMutation ?? false,
    workerSpawnForbidden: ledgerSummary?.workerSpawnForbidden ?? false,
    providerCalled: (ledgerSummary?.providerCalled ?? report.providerCalled) === true,
    prepareRan: report.prepareRan === true,
    verifyScriptRan: report.verifyScriptRan === true,
    liveSubmitAllowed: (ledgerSummary?.liveSubmitAllowed ?? report.liveSubmitAllowed) === true,
    message: report.message,
  };
}

function oneShotPayloadFromUnknown(payload: unknown): ProjectImage2OneShotPayload | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.status === "string" || typeof payload.uiStatus === "string" || isRecord(payload.receipt)) {
    return payload as ProjectImage2OneShotPayload;
  }
  return undefined;
}

function normalizeOneShotStatus(value?: string): ProjectImage2OneShotUiStatus {
  if (value === "prepared") return "prepared";
  if (value === "handoff_prepared") return "handoff_prepared";
  if (value === "trigger_plan_prepared") return "trigger_plan_prepared";
  if (value === "waiting_file") return "waiting_file";
  if (value === "verified") return "verified";
  if (value === "needs_review") return "needs_review";
  if (value === "missing") return "missing";
  if (value === "blocked") return "blocked";
  if (value === "running") return "running";
  if (value === "ready_to_prepare") return "ready_to_prepare";
  return "unavailable";
}

export function deriveProjectImage2OneShotStatus(payload: unknown): ProjectImage2OneShotStatus {
  const report = oneShotPayloadFromUnknown(payload);
  if (!report) {
    return {
      uiStatus: "unavailable",
      userLabel: "准备小样包",
      outputExists: false,
      providerReturnIngested: false,
      hashBoundActual: false,
      providerObservationMode: "not_observed",
      semanticQaStatus: "not_written",
      returnSource: "unavailable",
      formalPromotionBlockedReasons: [],
      externalProviderCallObserved: false,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      formalPromotionBlocked: false,
      providerCalled: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers: [],
      message: "未选择项目/未同步。",
    };
  }
  const rawStatus = normalizeOneShotStatus(report.uiStatus || report.status);
  const project = report.project || {};
  const permissionReceipt = isRecord(report.submitPermissionReceipt)
    ? report.submitPermissionReceipt as ProjectImage2OneShotPermissionReceipt
    : undefined;
  const persistedState = isRecord(report.persistedState) ? report.persistedState : {};
  const statePaths = isRecord(report.statePaths) ? report.statePaths : {};
  const permissionStatePath = stringOrUndefined(report.submitPermissionReceiptStatePath)
    || stringOrUndefined(persistedState.submitPermissionReceiptStatePath)
    || stringOrUndefined(statePaths.submitPermissionReceiptStatePath);
  const permissionBlockers = stringArray(permissionReceipt?.blockers);
  const credentialRef = stringOrUndefined(permissionReceipt?.credential?.credentialRef)
    || stringOrUndefined(report.credentialRef);
  const maxProviderCallsPerReceipt = numberOrUndefined(permissionReceipt?.submitIntent?.maxProviderCallsPerReceipt)
    ?? numberOrUndefined(permissionReceipt?.maxProviderCallsPerReceipt)
    ?? numberOrUndefined(report.maxProviderCallsPerReceipt);
  const persistedPermissionPresent = booleanOrUndefined(persistedState.submitPermissionReceiptPresent);
  return {
    uiStatus: rawStatus,
    projectId: project.projectId || report.projectId,
    projectRoot: project.projectRoot || report.projectRoot,
    selectedShotId: report.selectedShotId,
    expectedOutputPath: report.expectedOutputPath,
    promptPath: report.promptPath,
    promptText: report.promptText,
    providerObservationPath: report.providerObservationPath,
    semanticQaPath: report.semanticQaPath,
    triggerPlanPath: report.triggerPlanPath,
    handoffPacketPath: report.handoffPacketPath,
    receipt: report.receipt,
    submitPermissionReceiptRequested: report.submitPermissionReceiptRequested === true || Boolean(permissionReceipt),
    submitPermissionReceiptPresent: persistedPermissionPresent ?? Boolean(permissionReceipt),
    submitPermissionReceiptStatePath: permissionStatePath,
    submitPermissionReceipt: permissionReceipt,
    permissionBlockers,
    credentialRef,
    maxProviderCallsPerReceipt,
    userLabel: report.userLabel || (rawStatus === "prepared" ? "确认动作" : rawStatus === "trigger_plan_prepared" ? "等待回流" : rawStatus === "handoff_prepared" || rawStatus === "waiting_file" ? "等待回流" : rawStatus === "verified" ? "已验证" : rawStatus === "needs_review" ? "需要复核" : rawStatus === "missing" ? "未发现回流" : "准备小样包"),
    outputExists: report.watcherProjection?.outputExists === true || Boolean(report.previewProjection?.imageUrl),
    imageUrl: report.previewProjection?.imageUrl ? toRuntimeUrl(report.previewProjection.imageUrl) : undefined,
    reviewRequired: report.previewProjection?.reviewRequired === true,
    actualImage2Triggered: report.actualImage2Triggered === true,
    providerReturnIngested: report.providerReturnIngested === true,
    providerRequestId: report.providerRequestId,
    outputSha256: report.outputSha256,
    hashBoundActual: report.hashBoundActual === true,
    providerObservationMode: report.providerObservationMode || "not_observed",
    semanticQaStatus: report.semanticQaStatus || "not_written",
    returnSource: report.returnSource || "unavailable",
    formalPromotionBlockedReason: report.formalPromotionBlockedReason,
    formalPromotionBlockedReasons: stringArray(report.formalPromotionBlockedReasons),
    externalProviderCallObserved: report.externalProviderCallObserved === true,
    runtimeProviderSubmitAttempted: report.runtimeProviderSubmitAttempted === true,
    runtimeExternalNetworkCallMade: report.runtimeExternalNetworkCallMade === true,
    retryAvailable: booleanOrUndefined(report.retryAvailable),
    retryHint: stringOrUndefined(report.retryHint),
    providerFailureKind: stringOrUndefined(report.providerFailureKind),
    providerErrorType: stringOrUndefined(report.providerErrorType),
    formalPromotionBlocked: report.formalPromotionBlocked === true,
    providerCalled: report.providerCalled === true,
    liveSubmitAllowed: report.liveSubmitAllowed === true,
    projectVibeWritten: report.projectVibeWritten === true,
    workerSpawnForbidden: report.workerSpawnForbidden !== false,
    blockers: stringArray(report.blockers),
    message: report.message,
  };
}
