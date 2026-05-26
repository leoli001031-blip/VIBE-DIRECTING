export type ProjectImage2BatchUiStatus = "ready_for_review" | "blocked" | "running" | "unavailable";

export type ProjectImage2BatchPlanItem = {
  shotId: string;
  taskRunId?: string;
  packetId?: string;
  envelopeId?: string;
  expectedOutputPath?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  promptPath?: string;
  referencePaths: string[];
  queueOrder: number;
  blocked: boolean;
  blockers: string[];
};

export type ProjectImage2BatchLedgerSummary = {
  total: number;
  queued: number;
  blocked: number;
  parked: number;
  completeVerified: number;
  providerSubmissionForbidden: boolean;
  liveSubmitAllowed: boolean;
  noFileMutation: boolean;
  workerSpawnForbidden: boolean;
  providerCalled: boolean;
};

export type ProjectImage2BatchLedgerProjection = {
  taskRunId: string;
  envelopeId?: string;
  currentStatus: string;
  expectedOutputPath?: string;
  expectedOutputs: Array<{ expectedOutputPath?: string; path?: string } | string>;
  previewStatus?: string;
  completeVerified: boolean;
};

export type ProjectImage2BatchRetrySummary = {
  totalTasks: number;
  queued: number;
  running: number;
  succeeded: number;
  terminalFailed: number;
  retryScheduled: number;
  attemptsTotal: number;
  maxObservedConcurrency: number;
  maxConcurrency?: number;
  retryConcurrency?: number;
  maxAutoRetries?: number;
  nextRunnableCount?: number;
  circuitBreakerStatus?: "closed" | "retry_downshift" | "open";
  activeConcurrency?: number;
  defaultConcurrency?: number;
  networkErrorCount?: number;
  retryableFailureCount?: number;
  downshiftOnNetworkError?: boolean;
  providerCalled: boolean;
  promotionAllowed: boolean;
};

export type ProjectImage2BatchPlanStatus = {
  uiStatus: ProjectImage2BatchUiStatus;
  schemaVersion?: string;
  projectionKind?: string;
  sourceLabel?: string;
  sandboxSource?: string;
  projectId?: string;
  runId?: string;
  projectRoot?: string;
  projectVibePath?: string;
  reportPath?: string;
  plannedCount: number;
  readyCount: number;
  blockedCount: number;
  selectedShotIds: string[];
  nextAction: string;
  items: ProjectImage2BatchPlanItem[];
  ledgerSummary?: ProjectImage2BatchLedgerSummary;
  ledgerProjections: ProjectImage2BatchLedgerProjection[];
  retrySummary?: ProjectImage2BatchRetrySummary;
  queuedCount: number;
  parkedCount: number;
  completeVerifiedCount: number;
  providerSubmissionForbidden: boolean;
  noFileMutation: boolean;
  workerSpawnForbidden: boolean;
  providerCalled: boolean;
  prepareRan: boolean;
  verifyScriptRan: boolean;
  liveSubmitAllowed: boolean;
  message?: string;
};

export type ProjectImage2BatchUiState = {
  status: ProjectImage2BatchUiStatus;
  summary?: ProjectImage2BatchPlanStatus;
  message?: string;
};

export type ProjectImage2OneShotUiStatus =
  | "ready_to_prepare"
  | "prepared"
  | "handoff_prepared"
  | "trigger_plan_prepared"
  | "waiting_file"
  | "verified"
  | "needs_review"
  | "missing"
  | "blocked"
  | "running"
  | "unavailable";

export type ProjectImage2OneShotReceipt = {
  receiptId?: string;
  status?: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  imageCount?: number;
  expectedOutputPath?: string;
  promptPath?: string;
  promptText?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  triggerPlanPath?: string;
  handoffPacketPath?: string;
  blockers?: string[];
};

export type ProjectImage2OneShotPermissionReceipt = {
  receiptId?: string;
  handoffId?: string;
  status?: string;
  blockers?: string[];
  credential?: {
    credentialRef?: string;
    authorizedReferenceOnly?: boolean;
    secretMaterialPresent?: boolean;
    credentialMaterialStored?: boolean;
    credentialMaterialRead?: boolean;
  };
  submitIntent?: {
    maxProviderCallsPerReceipt?: number;
    providerSubmitAllowed?: number;
    providerSubmitRequestState?: string;
  };
  actionTimeConfirmation?: {
    required?: boolean;
    userConfirmedAtActionTime?: boolean;
    confirmationReceiptId?: string;
    confirmationCapturedAt?: string;
  };
  maxProviderCallsPerReceipt?: number;
};

export type ProjectImage2OneShotStatus = {
  uiStatus: ProjectImage2OneShotUiStatus;
  projectId?: string;
  projectRoot?: string;
  selectedShotId?: string;
  expectedOutputPath?: string;
  promptPath?: string;
  promptText?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  triggerPlanPath?: string;
  handoffPacketPath?: string;
  receipt?: ProjectImage2OneShotReceipt;
  submitPermissionReceiptRequested?: boolean;
  submitPermissionReceiptPresent?: boolean;
  submitPermissionReceiptStatePath?: string;
  submitPermissionReceipt?: ProjectImage2OneShotPermissionReceipt;
  permissionBlockers?: string[];
  credentialRef?: string;
  maxProviderCallsPerReceipt?: number;
  userLabel: string;
  outputExists: boolean;
  imageUrl?: string;
  reviewRequired?: boolean;
  actualImage2Triggered?: boolean;
  providerReturnIngested: boolean;
  providerRequestId?: string;
  outputSha256?: string;
  hashBoundActual: boolean;
  providerObservationMode: string;
  semanticQaStatus: string;
  returnSource: string;
  formalPromotionBlockedReason?: string;
  formalPromotionBlockedReasons: string[];
  externalProviderCallObserved: boolean;
  runtimeProviderSubmitAttempted: boolean;
  runtimeExternalNetworkCallMade: boolean;
  retryAvailable?: boolean;
  retryHint?: string;
  providerFailureKind?: string;
  providerErrorType?: string;
  formalPromotionBlocked: boolean;
  providerCalled: boolean;
  liveSubmitAllowed: boolean;
  projectVibeWritten: boolean;
  workerSpawnForbidden: boolean;
  blockers: string[];
  message?: string;
};

export type ProjectImage2OneShotUiState = {
  status: ProjectImage2OneShotUiStatus;
  summary?: ProjectImage2OneShotStatus;
  receipt?: ProjectImage2OneShotReceipt;
  message?: string;
};

export type ProjectImage2OneShotPermissionInput = {
  credentialRef?: string;
  requireSubmitPermissionReceipt?: boolean;
};

export type ProjectImage2AssetGenerationInput = {
  scope?: "project" | "selected_shots";
  selectedShotId?: string;
  selectedShotIds?: string[];
  assetTypes?: Array<"character" | "scene" | "prop" | "storyboard">;
  providerId?: string;
  confirmation: {
    receiptId: string;
    confirmedAt: string;
    phrase: "generate-image2-assets";
    confirmed: boolean;
  };
  mockProviderResult?: boolean | { status?: "success" | "verified" | "needs_review" | "missing" };
};

export type ProjectImage2AssetGenerationResult = {
  ok?: boolean;
  status?: "needs_review" | "blocked" | "missing" | "running" | "verified";
  uiStatus?: "needs_review" | "blocked" | "missing" | "running" | "verified";
  message?: string;
  scope?: "project" | "selected_shots";
  selectedShotId?: string;
  selectedShotIds?: string[];
  providerId?: string;
  requestedSize?: string;
  requestedAspectRatio?: string;
  generatedAssetCount?: number;
  assets?: Array<{
    id?: string;
    type?: "character" | "scene" | "prop" | "storyboard";
    name?: string;
    status?: string;
    path?: string;
    imageUrl?: string;
    outputSha256?: string;
  }>;
  blockers?: string[];
  providerCalled?: boolean;
  runtimeExternalNetworkCallMade?: boolean;
  formalPromotionBlocked?: boolean;
  projectVibeWritten?: boolean;
  visualMemoryWritten?: boolean;
};

export type ProjectImage2EndFrameSubmitInput = {
  selectedShotId?: string;
  selectedShotIds?: string[];
  providerId?: string;
  prompt?: string;
  confirmation: {
    receiptId: string;
    confirmedAt: string;
    phrase: "generate-image2-end-frame";
    confirmed: boolean;
  };
  mockProviderResult?: boolean | { status?: "success" | "verified" | "needs_review" | "missing" };
};

export type ProjectImage2EndFrameSubmitResult = {
  ok?: boolean;
  status?: "needs_review" | "blocked" | "missing" | "running" | "verified";
  uiStatus?: "needs_review" | "blocked" | "missing" | "running" | "verified";
  message?: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  providerId?: string;
  providerOperation?: "image.edit";
  requestedSize?: string;
  requestedAspectRatio?: string;
  sourceStartFramePath?: string;
  outputPath?: string;
  imageUrl?: string;
  outputSha256?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  pairQaPath?: string;
  blockers?: string[];
  providerCalled?: boolean;
  runtimeExternalNetworkCallMade?: boolean;
  formalPromotionBlocked?: boolean;
  projectVibeWritten?: boolean;
  storyFlowWritten?: boolean;
};

export type ProjectP6RealImage2SubmitInput = {
  receipt?: ProjectImage2OneShotReceipt;
  submitPermissionReceipt?: ProjectImage2OneShotPermissionReceipt;
  providerId?: string;
  confirmation: {
    receiptId: string;
    confirmedAt: string;
    phrase: "submit-p6-image2";
    confirmed: boolean;
  };
  mockProviderResult?: boolean | { status?: "success" | "verified" | "needs_review" | "missing" };
};

export type ProjectP6RealImage2SerialShotInput = ProjectP6RealImage2SubmitInput & {
  shotId?: string;
  selectedShotId?: string;
};

export type ProjectP6RealImage2SerialBatchInput = {
  selectedShotIds: string[];
  shots: ProjectP6RealImage2SerialShotInput[];
  providerId?: string;
  mockProviderResult?: boolean | { status?: "success" | "verified" | "needs_review" | "missing" };
};

export type ProjectImage2BatchPayload = {
  schemaVersion?: string;
  projectionKind?: string;
  sourceLabel?: string;
  sandboxSource?: string;
  project?: {
    projectId?: string;
    runId?: string;
    projectRoot?: string;
    projectVibePath?: string;
  };
  reportPath?: string;
  reportRelativePath?: string;
  providerCalled?: boolean;
  prepareRan?: boolean;
  verifyScriptRan?: boolean;
  liveSubmitAllowed?: boolean;
  items?: Array<{
    shotId?: string;
    taskRunId?: string;
    packetId?: string;
    envelopeId?: string;
    expectedOutputPath?: string;
    providerObservationPath?: string;
    semanticQaPath?: string;
    promptPath?: string;
    referencePaths?: string[];
    queueOrder?: number;
    blocked?: boolean;
    blockers?: string[];
  }>;
  summary?: {
    plannedCount?: number;
    readyCount?: number;
    blockedCount?: number;
    retryQueuedCount?: number;
    retryNextRunnableCount?: number;
    selectedShotIds?: string[];
    nextAction?: string;
  };
  retryScheduler?: {
    mode?: string;
    actualProviderRetryAllowed?: boolean;
    automaticProviderRetryAllowed?: boolean;
    providerCalled?: boolean;
    promotionAllowed?: boolean;
    simulationPolicy?: {
      maxConcurrency?: number;
      retryConcurrency?: number;
      maxAutoRetries?: number;
    };
    circuitBreaker?: {
      status?: string;
      defaultConcurrency?: number;
      retryConcurrency?: number;
      activeConcurrency?: number;
      networkErrorCount?: number;
      retryableFailureCount?: number;
      downshiftOnNetworkError?: boolean;
    };
    summary?: Record<string, unknown>;
  };
  ledgerProjection?: {
    schemaVersion?: string;
    summary?: Record<string, unknown>;
    projections?: Array<Record<string, unknown>>;
  };
  message?: string;
};

export type ProjectImage2OneShotPayload = {
  status?: string;
  uiStatus?: string;
  userLabel?: string;
  project?: {
    projectId?: string;
    projectRoot?: string;
  };
  projectId?: string;
  projectRoot?: string;
  selectedShotId?: string;
  expectedOutputPath?: string;
  promptPath?: string;
  promptText?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  triggerPlanPath?: string;
  handoffPacketPath?: string;
  receipt?: ProjectImage2OneShotReceipt;
  submitPermissionReceiptRequested?: boolean;
  submitPermissionReceiptStatePath?: string;
  submitPermissionReceipt?: ProjectImage2OneShotPermissionReceipt;
  credentialRef?: string;
  maxProviderCallsPerReceipt?: number;
  statePaths?: {
    submitPermissionReceiptStatePath?: string;
  };
  persistedState?: {
    submitPermissionReceiptPresent?: boolean;
    submitPermissionReceiptStatePath?: string;
  };
  watcherProjection?: {
    outputExists?: boolean;
  };
  previewProjection?: {
    status?: string;
    imageUrl?: string;
    reviewRequired?: boolean;
    providerCalled?: boolean;
  };
  actualImage2Triggered?: boolean;
  providerReturnIngested?: boolean;
  providerRequestId?: string;
  outputSha256?: string;
  hashBoundActual?: boolean;
  providerObservationMode?: string;
  semanticQaStatus?: string;
  returnSource?: string;
  formalPromotionBlockedReason?: string;
  formalPromotionBlockedReasons?: string[];
  externalProviderCallObserved?: boolean;
  runtimeProviderSubmitAttempted?: boolean;
  runtimeExternalNetworkCallMade?: boolean;
  retryAvailable?: boolean;
  retryHint?: string;
  providerFailureKind?: string;
  providerErrorType?: string;
  formalPromotionBlocked?: boolean;
  providerCalled?: boolean;
  liveSubmitAllowed?: boolean;
  projectVibeWritten?: boolean;
  workerSpawnForbidden?: boolean;
  blockers?: string[];
  message?: string;
};
