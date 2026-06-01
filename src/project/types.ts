export const projectVibeModelVersion = "project_vibe_minimal_v1";
export const projectVibeFileName = "project.vibe";

export type ProjectVibeSourceOfTruth = "project_vibe";
export type ProjectVibePortableRoot = "project_root";
export type ProjectVibeAssetKind = "character" | "scene" | "prop" | "style" | "reference";
export type ProjectVibeAssetStatus = "locked" | "candidate" | "needs_review" | "rejected" | "missing";
export type ProjectVibeShotStatus = "planned" | "ready" | "blocked" | "generated";
export type ProjectVibeRunKind = "agent_loop" | "patch" | "provider" | "qa" | "export";
export type ProjectVibeRunStatus = "planned" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
export type ProjectVibeReviewStatus = "needs_review" | "approved" | "rejected" | "missing" | "retry_requested";
export type ProjectVibePlanningReceiptKind = "script_planning" | "prompt_keyframe_planning";
export type ProjectVibeBatchReceiptStatus = "planned" | "running" | "partial" | "succeeded" | "failed" | "blocked";
export type ProjectVibeVideoControlMode =
  | "first_frame_default"
  | "first_last_endpoint"
  | "reference_driven"
  | "text_only_draft";

export interface ProjectVibeManifest {
  projectId: string;
  title: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  sourceOfTruth: ProjectVibeSourceOfTruth;
  portableRoot: ProjectVibePortableRoot;
  runtimeFixtureAuthority: false;
}

export interface ProjectVibeStorySection {
  id: string;
  title: string;
  summary: string;
  sequenceIndex: number;
  shotIds: string[];
}

export interface ProjectVibeStoryFlow {
  id: string;
  updatedAt: string;
  sourceOfTruth: ProjectVibeSourceOfTruth;
  sections: ProjectVibeStorySection[];
  shotOrder: string[];
}

export interface ProjectVibeReferencePolicy {
  temporaryOutputsMayBecomeAuthority: false;
  runtimeFixturesMayBecomeAuthority: false;
  lockedAssetsRequiredForGeneration: true;
}

export interface ProjectVibeReferenceRoleBinding {
  role: string;
  useFor: string[];
  ignoreFor: string[];
  priority: number;
  conflictRule: string;
}

export interface ProjectVibeVisualMemoryEntry {
  id: string;
  assetId: string;
  kind: ProjectVibeAssetKind;
  label: string;
  status: ProjectVibeAssetStatus;
  textConstraints: string[];
  usedByShotIds: string[];
  canUseAsFutureReference: boolean;
  sourceRefs: string[];
  roleBinding?: ProjectVibeReferenceRoleBinding;
}

export interface ProjectVibeVisualMemory {
  id: string;
  updatedAt: string;
  sourceOfTruth: ProjectVibeSourceOfTruth;
  referencePolicy: ProjectVibeReferencePolicy;
  entries: ProjectVibeVisualMemoryEntry[];
}

export interface ProjectVibeAsset {
  id: string;
  kind: ProjectVibeAssetKind;
  label: string;
  status: ProjectVibeAssetStatus;
  path?: string;
  textConstraints: string[];
  usedByShotIds: string[];
  sourceRefs: string[];
  lockedBy?: "user" | "agent_loop";
  roleBinding?: ProjectVibeReferenceRoleBinding;
}

export interface ProjectVibeShot {
  id: string;
  sectionId: string;
  title: string;
  intent: string;
  camera?: string;
  videoControlMode?: ProjectVibeVideoControlMode;
  executionMode?: string;
  rhythmProfile?: string;
  splitPolicy?: string;
  visibleClips?: number;
  storyboardPanels?: number;
  actionBeats?: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  seedanceDirection?: string;
  directorFeedbackDirectives?: string[];
  subtitle?: string;
  sound?: string;
  audioUsage?: string;
  narrationText?: string;
  dialogueLines?: string[];
  characterGuidance?: string[];
  sceneGuidance?: string[];
  propGuidance?: string[];
  sceneAssetIds: string[];
  characterAssetIds: string[];
  propAssetIds: string[];
  durationSeconds: number;
  status: ProjectVibeShotStatus;
  referenceStrategy?: "storyboard_narrative" | "storyboard_rapid_cut" | "omni_reference";
  sourceRefs: string[];
}

export interface ProjectVibeRunReceipt {
  id: string;
  runKind: ProjectVibeRunKind;
  status: ProjectVibeRunStatus;
  createdAt: string;
  summary: string;
  sourceFactHash: string;
  affectedShotIds: string[];
  producedAssetIds: string[];
  evidenceRefs: string[];
  projectFactsMutated: boolean;
  runtimeFixtureUsed: false;
}

export interface ProjectVibeScriptPlanningReceipt {
  id: string;
  kind: "script_planning";
  createdAt: string;
  plannerId: string;
  sourceFactHash: string;
  scriptBriefId?: string;
  sectionIds: string[];
  shotIds: string[];
  blockerCount: number;
  evidenceRefs: string[];
  providerSelfReportUsed: false;
  runtimeFixtureUsed: false;
}

export interface ProjectVibePromptKeyframePlanningReceipt {
  id: string;
  kind: "prompt_keyframe_planning";
  createdAt: string;
  plannerId: string;
  sourceFactHash: string;
  affectedShotIds: string[];
  promptPlanIds: string[];
  keyframePlanIds: string[];
  inputHash: string;
  outputPlanHash: string;
  evidenceRefs: string[];
  rawProviderPromptStoredAsFact: false;
  providerSelfReportUsed: false;
  runtimeFixtureUsed: false;
}

export interface ProjectVibeBatchReceipt {
  id: string;
  createdAt: string;
  batchId: string;
  status: ProjectVibeBatchReceiptStatus;
  sourceFactHash: string;
  permissionReceiptId?: string;
  providerId?: string;
  taskEnvelopeIds: string[];
  affectedShotIds: string[];
  attemptIds: string[];
  returnedOutputCount: number;
  missingOutputCount: number;
  outputHashes: string[];
  evidenceRefs: string[];
  providerSelfReportCanPromote: false;
  projectFactsMutated: false;
  runtimeFixtureUsed: false;
}

export interface ProjectVibeReviewReceipt {
  id: string;
  createdAt: string;
  status: ProjectVibeReviewStatus;
  reviewerId?: string;
  humanReviewed: boolean;
  shotId?: string;
  assetId?: string;
  sourceReceiptId?: string;
  sourceRunId?: string;
  outputPath?: string;
  outputHash?: string;
  retryRequested: boolean;
  lateOutput: boolean;
  providerSelfReportIgnored: true;
  promotionAuthorized: boolean;
  promotionAuthorizedBy?: string;
  promotionAuthorizedAt?: string;
  evidenceRefs: string[];
  blockers: string[];
}

export interface ProjectVibeReceiptLedger {
  scriptPlanningReceipts: ProjectVibeScriptPlanningReceipt[];
  promptKeyframePlanningReceipts: ProjectVibePromptKeyframePlanningReceipt[];
  batchReceipts: ProjectVibeBatchReceipt[];
  reviewReceipts: ProjectVibeReviewReceipt[];
}

export interface ProjectVibeSourceIndex {
  id: string;
  updatedAt: string;
  sourceOfTruth: ProjectVibeSourceOfTruth;
  manifestRef: "project.vibe#manifest";
  storyFlowRef: "project.vibe#storyFlow";
  visualMemoryRef: "project.vibe#visualMemory";
  shotRefs: string[];
  assetRefs: string[];
  runReceiptRefs: string[];
  scriptPlanningReceiptRefs?: string[];
  promptKeyframePlanningReceiptRefs?: string[];
  batchReceiptRefs?: string[];
  reviewReceiptRefs?: string[];
}

export interface ProjectVibeDocument {
  kind: "project_vibe_document";
  modelVersion: typeof projectVibeModelVersion;
  manifest: ProjectVibeManifest;
  storyFlow: ProjectVibeStoryFlow;
  visualMemory: ProjectVibeVisualMemory;
  shots: ProjectVibeShot[];
  assets: ProjectVibeAsset[];
  runs: ProjectVibeRunReceipt[];
  receipts?: ProjectVibeReceiptLedger;
  sourceIndex: ProjectVibeSourceIndex;
}

export type ProjectVibePatchOperation =
  | { op: "set_story_flow"; storyFlow: ProjectVibeStoryFlow }
  | { op: "set_visual_memory"; visualMemory: ProjectVibeVisualMemory }
  | { op: "upsert_shot"; shot: ProjectVibeShot }
  | { op: "upsert_asset"; asset: ProjectVibeAsset }
  | { op: "append_run_receipt"; run: ProjectVibeRunReceipt }
  | { op: "append_script_planning_receipt"; receipt: ProjectVibeScriptPlanningReceipt }
  | { op: "append_prompt_keyframe_planning_receipt"; receipt: ProjectVibePromptKeyframePlanningReceipt }
  | { op: "append_batch_receipt"; receipt: ProjectVibeBatchReceipt }
  | { op: "append_review_receipt"; receipt: ProjectVibeReviewReceipt };

export interface ProjectVibeTransaction {
  id: string;
  actor: "user" | "agent_loop" | "system";
  reason: string;
  createdAt: string;
  operations: ProjectVibePatchOperation[];
}

export interface ProjectVibeTransactionReceipt {
  transactionId: string;
  status: "applied" | "rejected";
  actor: ProjectVibeTransaction["actor"];
  reason: string;
  createdAt: string;
  operationCount: number;
  beforeFactHash: string;
  afterFactHash?: string;
  projectFactsAuthority: ProjectVibeSourceOfTruth;
  runtimeFixtureUsed: false;
  touched: {
    storyFlow: boolean;
    visualMemory: boolean;
    shotIds: string[];
    assetIds: string[];
    runIds: string[];
    receiptIds?: string[];
  };
  errors: string[];
  warnings: string[];
}

export interface ProjectVibeValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export interface ProjectVibeOpenResult {
  ok: boolean;
  project?: ProjectVibeDocument;
  validation?: ProjectVibeValidationResult;
  errors: string[];
}

export interface ProjectVibeSaveResult {
  ok: boolean;
  path: string;
  factHash: string;
  validation: ProjectVibeValidationResult;
  errors: string[];
}

export interface ProjectVibeStorageAdapter {
  mkdir?(path: string): void | Promise<void>;
  existsFile?(path: string): boolean | Promise<boolean>;
  readFile(path: string): string | Promise<string>;
  writeFile(path: string, content: string): void | Promise<void>;
  writeFileAtomic?(path: string, content: string): void | Promise<void>;
}
