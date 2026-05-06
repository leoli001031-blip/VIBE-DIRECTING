import { buildDesktopRuntimePlan, type DesktopRuntimePlan } from "./desktopRuntime";
import type { KnowledgePackManagerState } from "./knowledgePackManager";
import type { ProjectRuntimeState } from "./projectState";
import type { VisualConsistencyContractReceipt } from "./visualConsistency";

export const betaAcceptanceSchemaVersion = "0.1.0";
export const betaAcceptancePhaseId = "phase_42_export_desktop_beta_acceptance";
export const betaAcceptanceFinalPhaseNumber = 42;

export type BetaAcceptanceReadiness = "accepted" | "blocked";
export type BetaAcceptanceArea =
  | "mac_desktop_readiness"
  | "windows_desktop_readiness"
  | "project_save_open"
  | "preview_export"
  | "queue_visibility"
  | "visual_consistency"
  | "knowledge_pack_management"
  | "worker_provider_gate"
  | "test_matrix"
  | "roadmap_closure";

export interface BetaAcceptanceHardLocks {
  dryRunOnly: true;
  readOnly: true;
  planOnly: true;
  noAdditionalPhasesPlanned: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  canSpawnCodex: false;
  noWorkerSpawn: true;
  noShellExecution: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  credentialAccessAllowed: false;
  credentialStorage: false;
  noFileMutation: true;
  noApiKeyCreation: true;
}

export interface BetaAcceptanceAttemptedActions {
  providerSubmitAttempted: boolean;
  liveSubmitAttempted: boolean;
  spawnCodexAttempted: boolean;
  shellAttempted: boolean;
  credentialAttempted: boolean;
  fileMutationAttempted: boolean;
  apiKeyCreateAttempted: boolean;
  extraPhaseRequested: boolean;
}

export interface BetaAcceptanceCheck {
  area: BetaAcceptanceArea;
  required: true;
  status: BetaAcceptanceReadiness;
  sourceRefs: string[];
  proof: Record<string, boolean | number | string | string[]>;
  blockers: string[];
  warnings: string[];
}

export interface BetaAcceptanceTestMatrixItem {
  script: string;
  command?: string;
  expected: "must_exist";
  present?: boolean;
  sourceRef: string;
}

export interface BetaAcceptanceState {
  schemaVersion: typeof betaAcceptanceSchemaVersion;
  phaseId: typeof betaAcceptancePhaseId;
  generatedAt: string;
  readiness: BetaAcceptanceReadiness;
  finalPhaseNumber: typeof betaAcceptanceFinalPhaseNumber;
  noAdditionalPhasesPlanned: true;
  betaAcceptanceOwnsClosure: true;
  closure: {
    finalPhaseNumber: typeof betaAcceptanceFinalPhaseNumber;
    noAdditionalPhasesPlanned: true;
    betaAcceptanceOwnsClosure: true;
    roadmapEndpoint: "Export / Desktop / Beta Acceptance";
  };
  hardLocks: BetaAcceptanceHardLocks;
  attemptedActions: BetaAcceptanceAttemptedActions;
  desktopPlans: {
    darwin: DesktopRuntimePlan;
    win32: DesktopRuntimePlan;
  };
  areas: BetaAcceptanceCheck[];
  testMatrix: BetaAcceptanceTestMatrixItem[];
  summary: {
    requiredAreaCount: number;
    acceptedAreaCount: number;
    blockedAreaCount: number;
    hardLockDriftCount: number;
    attemptedActionBlockCount: number;
    missingScriptCount: number;
  };
  blockers: string[];
  warnings: string[];
  validation: {
    ok: boolean;
    status: BetaAcceptanceReadiness;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export interface BuildBetaAcceptanceStateInput {
  generatedAt?: string;
  runtimeState?: Partial<ProjectRuntimeState>;
  macDesktopPlan?: DesktopRuntimePlan;
  windowsDesktopPlan?: DesktopRuntimePlan;
  visualConsistencyContract?: VisualConsistencyContractReceipt;
  knowledgePackManager?: KnowledgePackManagerState;
  packageScripts?: Record<string, string>;
  hardLocksOverride?: Partial<Record<keyof BetaAcceptanceHardLocks, boolean | number>>;
  providerSubmitAttempted?: boolean;
  liveSubmitAttempted?: boolean;
  spawnCodexAttempted?: boolean;
  shellAttempted?: boolean;
  credentialAttempted?: boolean;
  fileMutationAttempted?: boolean;
  apiKeyCreateAttempted?: boolean;
  extraPhaseRequested?: boolean;
}

export const betaAcceptanceHardLocks: BetaAcceptanceHardLocks = {
  dryRunOnly: true,
  readOnly: true,
  planOnly: true,
  noAdditionalPhasesPlanned: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  canSpawnCodex: false,
  noWorkerSpawn: true,
  noShellExecution: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  credentialAccessAllowed: false,
  credentialStorage: false,
  noFileMutation: true,
  noApiKeyCreation: true,
};

export const betaAcceptanceExpectedScripts = [
  "project-runtime:test",
  "desktop-runtime:test",
  "preview-player:test",
  "export-builder:test",
  "export-worker:test",
  "orchestrator:test",
  "visual-consistency:test",
  "knowledge:test",
  "knowledge-pack-manager:test",
  "task-packet:test",
  "codex-worker-runtime-gate:test",
  "provider-closed-loop-shell:test",
  "phase-roadmap:test",
  "minimal-ui:test",
  "dry-run-e2e:test",
  "build",
] as const;

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;
const credentialPattern = /(?:credential|token|api_?key|secret|password|auth)/i;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bool(value: unknown): boolean {
  return value === true;
}

function hardLockDrift(
  actual: object | undefined,
  expected: object,
  prefix: string,
): string[] {
  if (!actual) return [`${prefix}_hard_locks_missing`];
  const actualRecord = actual as Record<string, boolean | number | undefined>;
  const expectedRecord = expected as Record<string, boolean | number>;

  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`${prefix}_hard_lock_drift:${key}`],
  );
}

function check(
  area: BetaAcceptanceArea,
  sourceRefs: string[],
  proof: Record<string, boolean | number | string | string[]>,
  blockers: string[],
  warnings: string[] = [],
): BetaAcceptanceCheck {
  return {
    area,
    required: true,
    status: blockers.length ? "blocked" : "accepted",
    sourceRefs,
    proof,
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted(warnings),
  };
}

function defaultDesktopPlan(platform: "darwin" | "win32", generatedAt: string): DesktopRuntimePlan {
  return buildDesktopRuntimePlan({
    generatedAt,
    platform,
    projectRootToken: `user_selected_project_root:phase42_${platform}`,
    portableProjectPaths: [
      "project.vibe",
      "story_flow/story_flow.vibe.json",
      "visual_memory/visual_memory.vibe.json",
      "exports/export-worker",
    ],
  });
}

function desktopReadiness(area: BetaAcceptanceArea, plan: DesktopRuntimePlan, platform: "darwin" | "win32"): BetaAcceptanceCheck {
  const blockers = [
    ...(plan.platform === platform ? [] : [`desktop_platform_mismatch:${platform}`]),
    ...(plan.validation.ok ? [] : plan.validation.errors.map((error) => `desktop_validation:${error}`)),
    ...(plan.projectPermissionScope.scopeKind === "user_selected_project_root_token" ? [] : ["desktop_project_root_token_missing"]),
    ...(plan.projectPermissionScope.rawPathPersisted === false ? [] : ["desktop_raw_path_persisted"]),
    ...(plan.projectPermissionScope.portableContract.absolutePathsAllowed === false ? [] : ["desktop_absolute_paths_allowed"]),
    ...(plan.projectPermissionScope.portableContract.parentTraversalAllowed === false ? [] : ["desktop_parent_traversal_allowed"]),
    ...(plan.sidecarAllowlist.sidecarSpawnAllowedNow === false ? [] : ["desktop_sidecar_spawn_allowed"]),
    ...(plan.sidecarAllowlist.arbitraryShell === "forbidden" ? [] : ["desktop_arbitrary_shell_not_forbidden"]),
    ...(plan.credentialVaultPlan.readAllowedNow === false ? [] : ["desktop_credential_read_allowed"]),
    ...(plan.credentialVaultPlan.writeAllowedNow === false ? [] : ["desktop_credential_write_allowed"]),
    ...(plan.credentialVaultPlan.createApiKeyAllowedNow === false ? [] : ["desktop_api_key_creation_allowed"]),
    ...hardLockDrift(plan.hardLocks, {
      noFileMutation: true,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noArbitraryShell: true,
      noSidecarSpawn: true,
      liveSubmitAllowed: false,
    }, `desktop_${platform}`),
  ];

  return check(area, [`desktopRuntime:${platform}`], {
    platform,
    validationOk: plan.validation.ok,
    userSelectedRootToken: plan.projectPermissionScope.token,
    rawPathPersisted: plan.projectPermissionScope.rawPathPersisted,
    sidecarSpawnAllowedNow: plan.sidecarAllowlist.sidecarSpawnAllowedNow,
    credentialReadAllowedNow: plan.credentialVaultPlan.readAllowedNow,
    credentialWriteAllowedNow: plan.credentialVaultPlan.writeAllowedNow,
    createApiKeyAllowedNow: plan.credentialVaultPlan.createApiKeyAllowedNow,
  }, blockers, plan.validation.warnings.map((warning) => `desktop_${platform}:${warning}`));
}

function collectProjectFilePaths(projectFileCore: unknown): string[] {
  if (!isRecord(projectFileCore)) return [];
  const plannedFileTree = Array.isArray(projectFileCore.plannedFileTree) ? projectFileCore.plannedFileTree : [];
  const priority = Array.isArray(projectFileCore.sourceOfTruthPriority) ? projectFileCore.sourceOfTruthPriority : [];
  const treePaths = plannedFileTree
    .map((entry) => isRecord(entry) && typeof entry.path === "string" ? entry.path : "")
    .filter(Boolean);
  const importedRefs = priority.flatMap((entry) =>
    isRecord(entry) && Array.isArray(entry.importedSourceRefs)
      ? entry.importedSourceRefs.map((ref) => isRecord(ref) && typeof ref.path === "string" ? ref.path : "").filter(Boolean)
      : [],
  );
  return [...treePaths, ...importedRefs];
}

function unsafeProjectFactPathBlockers(projectFileCore: unknown): string[] {
  return collectProjectFilePaths(projectFileCore).flatMap((path) => {
    const normalized = path.replace(/\\/g, "/");
    const blockers: string[] = [];
    if (absolutePathPattern.test(path) && path !== ".") blockers.push(`project_fact_absolute_path:${path}`);
    if (parentTraversalPattern.test(normalized)) blockers.push(`project_fact_parent_traversal:${path}`);
    if (credentialPattern.test(path)) blockers.push(`project_fact_credential_path:${path}`);
    return blockers;
  });
}

function projectSaveOpenReadiness(runtimeState: Partial<ProjectRuntimeState> | undefined): BetaAcceptanceCheck {
  const projectFileCore = runtimeState?.projectFileCore;
  const receipt = isRecord(projectFileCore) ? projectFileCore.projectFileFactSourceReceipt : undefined;
  const saveOpenContract = isRecord(receipt) ? receipt.saveOpenContract : undefined;
  const runtimeStateDerivedCache = isRecord(receipt) ? receipt.runtimeStateDerivedCache : undefined;
  const projectVibeEntry = isRecord(receipt) ? receipt.projectVibeEntry : undefined;
  const sourcePriority = isRecord(projectFileCore) && Array.isArray(projectFileCore.sourceOfTruthPriority)
    ? projectFileCore.sourceOfTruthPriority
    : [];
  const plannedFileTree = isRecord(projectFileCore) && Array.isArray(projectFileCore.plannedFileTree)
    ? projectFileCore.plannedFileTree
    : [];
  const fileFirstPriority = sourcePriority.length > 0 && sourcePriority.every(
    (entry) => isRecord(entry) && entry.runtimeStateMayOverride === false,
  );
  const projectRootRelativeTree = plannedFileTree.length > 0 && plannedFileTree.every(
    (entry) => isRecord(entry) && entry.pathOrigin === "project_root_relative",
  );
  const projectFactFiles = isRecord(receipt) && Array.isArray(receipt.projectFactFiles) ? receipt.projectFactFiles : [];
  const projectFactFilesRootRelative = projectFactFiles.length > 0 && projectFactFiles.every(
    (entry) => isRecord(entry) && entry.projectRootRelative === true,
  );
  const hardLocks = isRecord(projectFileCore) ? projectFileCore.hardLocks : undefined;

  const blockers = [
    ...(!projectFileCore ? ["project_file_core_missing"] : []),
    ...(isRecord(projectVibeEntry) && projectVibeEntry.path === "project.vibe" ? [] : ["project_vibe_entry_missing"]),
    ...(projectRootRelativeTree ? [] : ["project_root_relative_file_tree_missing"]),
    ...(projectFactFilesRootRelative ? [] : ["project_fact_files_not_project_root_relative"]),
    ...(fileFirstPriority ? [] : ["file_first_source_priority_missing"]),
    ...(isRecord(runtimeStateDerivedCache) && runtimeStateDerivedCache.mayOverwriteProjectFiles === false
      ? [] : ["runtime_state_derived_cache_policy_missing"]),
    ...(isRecord(saveOpenContract) && saveOpenContract.absolutePathsBlocked === true ? [] : ["project_absolute_path_block_missing"]),
    ...(isRecord(saveOpenContract) && saveOpenContract.parentTraversalBlocked === true ? [] : ["project_parent_traversal_block_missing"]),
    ...(isRecord(saveOpenContract) && saveOpenContract.credentialTokenSecretWriteBlocked === true ? [] : ["project_credential_fact_block_missing"]),
    ...unsafeProjectFactPathBlockers(projectFileCore),
    ...hardLockDrift(hardLocks, {
      dryRunOnly: true,
      readOnly: true,
      noFileMutation: true,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      projectVibeWriteAllowed: false,
      runtimeStateIsDerivedCache: true,
    }, "project_file_core"),
  ];

  return check("project_save_open", ["projectFileCore", "projectRuntimeState"], {
    projectVibeEntry: isRecord(projectVibeEntry) ? String(projectVibeEntry.path || "") : "missing",
    plannedTreeEntries: plannedFileTree.length,
    projectFactFiles: projectFactFiles.length,
    fileFirstSourcePriority: fileFirstPriority,
    runtimeStateDerivedCache: isRecord(runtimeStateDerivedCache) && runtimeStateDerivedCache.mayOverwriteProjectFiles === false,
    projectRootRelativeFileTree: projectRootRelativeTree,
  }, blockers);
}

function previewExportReadiness(runtimeState: Partial<ProjectRuntimeState> | undefined): BetaAcceptanceCheck {
  const previewExport = runtimeState?.previewExport;
  const exportWorker = runtimeState?.exportWorker;
  const profiles = isRecord(previewExport) && Array.isArray(previewExport.exportProfiles) ? previewExport.exportProfiles : [];
  const profileKinds: string[] = profiles
    .map((profile) => isRecord(profile) && typeof profile.kind === "string" ? String(profile.kind) : "")
    .filter(Boolean);
  const requiredProfiles = ["rough_cut", "asset_package", "storyboard_table", "developer_archive"];
  const exportPackagePlan = isRecord(previewExport) ? previewExport.exportPackagePlan : undefined;
  const hardLocks = isRecord(exportWorker) ? exportWorker.hardLocks : undefined;

  const blockers = [
    ...(!previewExport ? ["preview_export_missing"] : []),
    ...(isRecord(previewExport?.draftPreview) ? [] : ["draft_preview_missing"]),
    ...(isRecord(previewExport?.formalPreview) ? [] : ["formal_preview_missing"]),
    ...(requiredProfiles.every((profile) => profileKinds.includes(profile)) ? [] : ["export_profiles_incomplete"]),
    ...(isRecord(exportPackagePlan) ? [] : ["export_package_plan_missing"]),
    ...(!exportWorker ? ["export_worker_missing"] : []),
    ...(isRecord(exportWorker) && exportWorker.executionMode === "plan_only" ? [] : ["export_worker_not_plan_only"]),
    ...(isRecord(exportWorker) && exportWorker.canExecute === false ? [] : ["export_worker_can_execute"]),
    ...(isRecord(exportWorker) && typeof exportWorker.exportRoot === "string" && exportWorker.exportRoot.startsWith("exports/")
      ? [] : ["export_worker_root_not_scoped"]),
    ...hardLockDrift(hardLocks, {
      projectRootRelativeOnly: true,
      exportScopeOnly: true,
      noAbsolutePath: true,
      noParentTraversal: true,
      noProviderSubmit: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noArbitraryShell: true,
    }, "export_worker"),
  ];

  return check("preview_export", ["previewExport", "exportWorker"], {
    draftPreviewDefined: isRecord(previewExport?.draftPreview),
    formalPreviewDefined: isRecord(previewExport?.formalPreview),
    profileKinds,
    packagePlanDefined: isRecord(exportPackagePlan),
    exportWorkerExecutionMode: isRecord(exportWorker) ? String(exportWorker.executionMode || "") : "missing",
    exportWorkerCanExecute: isRecord(exportWorker) ? exportWorker.canExecute === true : false,
    exportRoot: isRecord(exportWorker) ? String(exportWorker.exportRoot || "") : "missing",
  }, blockers);
}

function queueVisibilityReadiness(runtimeState: Partial<ProjectRuntimeState> | undefined): BetaAcceptanceCheck {
  const orchestrator = runtimeState?.localOrchestrator;
  const summary = isRecord(orchestrator) ? orchestrator.summary : undefined;
  const queue = isRecord(orchestrator) && Array.isArray(orchestrator.queue) ? orchestrator.queue : [];
  const hardLocks = isRecord(orchestrator) ? orchestrator.hardLocks : undefined;
  const sourceCoverage = isRecord(orchestrator) && Array.isArray(orchestrator.sourceCoverage) ? orchestrator.sourceCoverage : [];

  const blockers = [
    ...(!orchestrator ? ["local_orchestrator_missing"] : []),
    ...(isRecord(summary) ? [] : ["local_orchestrator_summary_missing"]),
    ...(queue.length > 0 ? [] : ["local_orchestrator_queue_empty"]),
    ...(sourceCoverage.length > 0 ? [] : ["local_orchestrator_source_coverage_missing"]),
    ...hardLockDrift(hardLocks, {
      dryRunOnly: true,
      planOnly: true,
      noDaemon: true,
      daemonStarted: false,
      noSpawnCodex: true,
      noShellExecution: true,
      noProviderExecution: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      noCredentialRead: true,
      noCredentialWrite: true,
    }, "local_orchestrator"),
  ];

  return check("queue_visibility", ["localOrchestrator.summary", "localOrchestrator.queue", "localOrchestrator.sourceCoverage"], {
    totalItems: isRecord(summary) && typeof summary.totalItems === "number" ? summary.totalItems : 0,
    ready: isRecord(summary) && typeof summary.ready === "number" ? summary.ready : 0,
    waiting: isRecord(summary) && typeof summary.waiting === "number" ? summary.waiting : 0,
    blocked: isRecord(summary) && typeof summary.blocked === "number" ? summary.blocked : 0,
    completeVerified: isRecord(summary) && typeof summary.completeVerified === "number" ? summary.completeVerified : 0,
    queueItemCount: queue.length,
    sourceCoverageCount: sourceCoverage.length,
  }, blockers);
}

function visualConsistencyReadiness(
  runtimeState: Partial<ProjectRuntimeState> | undefined,
  visualConsistencyContract: VisualConsistencyContractReceipt | undefined,
): BetaAcceptanceCheck {
  const visualMemoryAssets = Array.isArray(runtimeState?.visualMemory?.assets) ? runtimeState.visualMemory.assets : [];
  const shotCount = Array.isArray(runtimeState?.storyFlow?.shots) ? runtimeState.storyFlow.shots.length : 0;
  const projectFactsIntegration = runtimeState?.projectFactsIntegration;
  const imageKeyframeRuntime = runtimeState?.imageKeyframeRuntime;
  const contractReady = visualConsistencyContract?.status === "pass";
  const hasRuntimeVisualFacts = visualMemoryAssets.length > 0 || shotCount > 0 || Boolean(projectFactsIntegration) || Boolean(imageKeyframeRuntime);

  const blockers = [
    ...(contractReady || hasRuntimeVisualFacts ? [] : ["visual_consistency_runtime_facts_missing"]),
  ];
  const warnings = [
    ...(!visualConsistencyContract && hasRuntimeVisualFacts
      ? ["visual_consistency_contract_not_supplied_acceptance_uses_runtime_project_facts"]
      : []),
  ];

  return check("visual_consistency", [
    ...(visualConsistencyContract ? ["visualConsistencyContract"] : []),
    ...(projectFactsIntegration ? ["projectFactsIntegration"] : []),
    ...(visualMemoryAssets.length ? ["visualMemory.assets"] : []),
    ...(imageKeyframeRuntime ? ["imageKeyframeRuntime"] : []),
  ], {
    contractStatus: visualConsistencyContract?.status || "not_supplied",
    projectFactsIntegrationPresent: Boolean(projectFactsIntegration),
    visualMemoryAssetCount: visualMemoryAssets.length,
    storyFlowShotCount: shotCount,
    imageKeyframeRuntimePresent: Boolean(imageKeyframeRuntime),
    artifactGenerationClaimed: false,
    generatedImagesClaimed: false,
  }, blockers, warnings);
}

function knowledgePackManagementReadiness(
  runtimeState: Partial<ProjectRuntimeState> | undefined,
  knowledgePackManager: KnowledgePackManagerState | undefined,
): BetaAcceptanceCheck {
  const knowledge = runtimeState?.knowledge;
  const bindings = Array.isArray(knowledge?.bindings) ? knowledge.bindings : [];
  const bindingHashesReady = bindings.every((binding) => Boolean(binding.packId && binding.version && binding.hash));
  const routeTest = isRecord(knowledge) ? knowledge.routeTest : undefined;
  const routeResult = isRecord(routeTest) ? routeTest.routeResult : undefined;
  const contextBudget = isRecord(routeTest) ? routeTest.contextBudget : undefined;
  const managerUserManagementReady = knowledgePackManager?.userManagement?.summary?.ready === true;
  const managerHardLocks = knowledgePackManager?.hardLocks;

  const blockers = [
    ...(!knowledge ? ["knowledge_summary_missing"] : []),
    ...(typeof knowledge?.manifestHash === "string" && knowledge.manifestHash.length > 0 ? [] : ["knowledge_manifest_hash_missing"]),
    ...(typeof knowledge?.manifestVersion === "string" && knowledge.manifestVersion.length > 0 ? [] : ["knowledge_manifest_version_missing"]),
    ...(bindings.length > 0 ? [] : ["knowledge_bindings_missing"]),
    ...(bindingHashesReady ? [] : ["knowledge_binding_hash_version_missing"]),
    ...(isRecord(routeResult) || isRecord(contextBudget) || managerUserManagementReady ? [] : ["knowledge_route_or_budget_scope_missing"]),
    ...(managerUserManagementReady || bindings.length > 0 ? [] : ["knowledge_user_management_scope_missing"]),
    ...(managerHardLocks
      ? hardLockDrift(managerHardLocks, {
          providerSubmitRouteForbidden: true,
          credentialRouteForbidden: true,
          shellRouteForbidden: true,
          fileMutationRouteForbidden: true,
          freeTextWorkerForbidden: true,
          wholeLibraryInjectionForbidden: true,
          fullBodyOutputForbidden: true,
        }, "knowledge_pack_manager")
      : []),
  ];

  return check("knowledge_pack_management", [
    "knowledge",
    ...(knowledgePackManager ? ["knowledgePackManager", "phase39KnowledgePackUserManagement"] : ["knowledge.bindings"]),
  ], {
    manifestHash: knowledge?.manifestHash || "missing",
    manifestVersion: knowledge?.manifestVersion || "missing",
    bindingCount: bindings.length,
    bindingHashesReady,
    routeId: isRecord(routeResult) ? String(routeResult.routeId || "") : "not_supplied",
    budgetId: isRecord(contextBudget) ? String(contextBudget.budgetId || "") : "not_supplied",
    userManagementScopeReady: managerUserManagementReady || bindings.length > 0,
    managerProvided: Boolean(knowledgePackManager),
  }, blockers);
}

function workerProviderGateReadiness(runtimeState: Partial<ProjectRuntimeState> | undefined): BetaAcceptanceCheck {
  const codexWorkerRuntimeGate = runtimeState?.codexWorkerRuntimeGate;
  const providerClosedLoopShell = runtimeState?.providerClosedLoopShell;
  const providerLiveGate = runtimeState?.providerLiveGate;
  const providerExecutionHandoff = runtimeState?.providerExecutionHandoff;
  const providerLiveSummary = isRecord(providerLiveGate) ? providerLiveGate.summary : undefined;
  const handoffSummary = isRecord(providerExecutionHandoff) ? providerExecutionHandoff.summary : undefined;

  const blockers = [
    ...(!codexWorkerRuntimeGate ? ["codex_worker_runtime_gate_missing"] : []),
    ...(!providerClosedLoopShell ? ["provider_closed_loop_shell_missing"] : []),
    ...(!providerLiveGate ? ["provider_live_gate_missing"] : []),
    ...(!providerExecutionHandoff ? ["provider_execution_handoff_missing"] : []),
    ...hardLockDrift(isRecord(codexWorkerRuntimeGate) ? codexWorkerRuntimeGate.hardLocks : undefined, {
      noSpawnCodex: true,
      noShellExecution: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noFileMutation: true,
    }, "codex_worker_runtime_gate"),
    ...hardLockDrift(isRecord(providerClosedLoopShell) ? providerClosedLoopShell.hardLocks : undefined, {
      dryRunOnly: true,
      readOnly: true,
      planOnly: true,
      noActualProviderSubmit: true,
      noLiveSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noApiKeyCreation: true,
      noWorkerSpawn: true,
      noShellExecution: true,
      noFileMutation: true,
    }, "provider_closed_loop_shell"),
    ...(isRecord(providerLiveSummary) && providerLiveSummary.providerSubmitAllowed === 0 ? [] : ["provider_live_gate_submit_not_locked"]),
    ...(isRecord(providerLiveSummary) && providerLiveSummary.liveSubmitAllowed === false ? [] : ["provider_live_gate_live_submit_not_locked"]),
    ...(isRecord(providerLiveSummary) && providerLiveSummary.credentialStorage === false ? [] : ["provider_live_gate_credential_storage_not_locked"]),
    ...(isRecord(handoffSummary) && handoffSummary.providerSubmitAllowed === 0 ? [] : ["provider_execution_handoff_submit_count_not_zero"]),
    ...(isRecord(handoffSummary) && handoffSummary.liveSubmitAllowed === false ? [] : ["provider_execution_handoff_live_submit_not_locked"]),
    ...(isRecord(handoffSummary) && handoffSummary.credentialAccessAllowed === false ? [] : ["provider_execution_handoff_credential_access_not_locked"]),
    ...(isRecord(handoffSummary) && handoffSummary.canSpawnWorker === false ? [] : ["provider_execution_handoff_worker_spawn_not_locked"]),
    ...(isRecord(handoffSummary) && handoffSummary.fileMutationAllowed === false ? [] : ["provider_execution_handoff_file_mutation_not_locked"]),
  ];

  return check("worker_provider_gate", [
    "codexWorkerRuntimeGate",
    "providerClosedLoopShell",
    "providerLiveGate",
    "providerExecutionHandoff",
  ], {
    codexWorkerGatePresent: Boolean(codexWorkerRuntimeGate),
    providerClosedLoopShellPresent: Boolean(providerClosedLoopShell),
    providerSubmitAllowed: isRecord(providerLiveSummary) && typeof providerLiveSummary.providerSubmitAllowed === "number"
      ? providerLiveSummary.providerSubmitAllowed
      : -1,
    liveSubmitAllowed: isRecord(providerLiveSummary) ? bool(providerLiveSummary.liveSubmitAllowed) : true,
    credentialStorage: isRecord(providerLiveSummary) ? bool(providerLiveSummary.credentialStorage) : true,
    handoffProviderSubmitAllowed: isRecord(handoffSummary) && typeof handoffSummary.providerSubmitAllowed === "number"
      ? handoffSummary.providerSubmitAllowed
      : -1,
  }, blockers);
}

function buildTestMatrix(packageScripts?: Record<string, string>): BetaAcceptanceTestMatrixItem[] {
  return betaAcceptanceExpectedScripts.map((script) => ({
    script,
    command: packageScripts?.[script],
    expected: "must_exist",
    present: packageScripts ? Object.prototype.hasOwnProperty.call(packageScripts, script) : undefined,
    sourceRef: `package.json:scripts.${script}`,
  }));
}

function testMatrixReadiness(testMatrix: BetaAcceptanceTestMatrixItem[], packageScripts?: Record<string, string>): BetaAcceptanceCheck {
  const missing = packageScripts ? testMatrix.filter((item) => item.present !== true).map((item) => item.script) : [];
  const blockers = packageScripts
    ? missing.map((script) => `package_script_missing:${script}`)
    : ["package_scripts_not_supplied"];
  return check("test_matrix", ["package.json.scripts", "betaAcceptanceExpectedScripts"], {
    expectedScriptCount: testMatrix.length,
    packageScriptsChecked: Boolean(packageScripts),
    missingScripts: missing,
  }, blockers);
}

function closureReadiness(): BetaAcceptanceCheck {
  return check("roadmap_closure", ["phase42", "roadmapEndpoint"], {
    finalPhaseNumber: betaAcceptanceFinalPhaseNumber,
    noAdditionalPhasesPlanned: true,
    betaAcceptanceOwnsClosure: true,
    roadmapEndpoint: "Export / Desktop / Beta Acceptance",
  }, []);
}

function attemptedActionBlockers(attemptedActions: BetaAcceptanceAttemptedActions): string[] {
  return [
    ...(attemptedActions.providerSubmitAttempted ? ["provider_submit_attempt_blocked"] : []),
    ...(attemptedActions.liveSubmitAttempted ? ["live_submit_attempt_blocked"] : []),
    ...(attemptedActions.spawnCodexAttempted ? ["spawn_codex_attempt_blocked"] : []),
    ...(attemptedActions.shellAttempted ? ["shell_attempt_blocked"] : []),
    ...(attemptedActions.credentialAttempted ? ["credential_attempt_blocked"] : []),
    ...(attemptedActions.fileMutationAttempted ? ["file_mutation_attempt_blocked"] : []),
    ...(attemptedActions.apiKeyCreateAttempted ? ["api_key_create_attempt_blocked"] : []),
    ...(attemptedActions.extraPhaseRequested ? ["extra_phase_requested_blocked"] : []),
  ];
}

export function buildBetaAcceptanceState(input: BuildBetaAcceptanceStateInput = {}): BetaAcceptanceState {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const hardLocks = {
    ...betaAcceptanceHardLocks,
    ...(input.hardLocksOverride || {}),
  } as BetaAcceptanceHardLocks;
  const attemptedActions: BetaAcceptanceAttemptedActions = {
    providerSubmitAttempted: Boolean(input.providerSubmitAttempted),
    liveSubmitAttempted: Boolean(input.liveSubmitAttempted),
    spawnCodexAttempted: Boolean(input.spawnCodexAttempted),
    shellAttempted: Boolean(input.shellAttempted),
    credentialAttempted: Boolean(input.credentialAttempted),
    fileMutationAttempted: Boolean(input.fileMutationAttempted),
    apiKeyCreateAttempted: Boolean(input.apiKeyCreateAttempted),
    extraPhaseRequested: Boolean(input.extraPhaseRequested),
  };
  const desktopPlans = {
    darwin: input.macDesktopPlan || defaultDesktopPlan("darwin", generatedAt),
    win32: input.windowsDesktopPlan || defaultDesktopPlan("win32", generatedAt),
  };
  const testMatrix = buildTestMatrix(input.packageScripts);
  const areas = [
    desktopReadiness("mac_desktop_readiness", desktopPlans.darwin, "darwin"),
    desktopReadiness("windows_desktop_readiness", desktopPlans.win32, "win32"),
    projectSaveOpenReadiness(input.runtimeState),
    previewExportReadiness(input.runtimeState),
    queueVisibilityReadiness(input.runtimeState),
    visualConsistencyReadiness(input.runtimeState, input.visualConsistencyContract),
    knowledgePackManagementReadiness(input.runtimeState, input.knowledgePackManager),
    workerProviderGateReadiness(input.runtimeState),
    testMatrixReadiness(testMatrix, input.packageScripts),
    closureReadiness(),
  ];
  const hardLockBlockers = hardLockDrift(hardLocks, betaAcceptanceHardLocks, "beta_acceptance");
  const attemptBlockers = attemptedActionBlockers(attemptedActions);
  const areaBlockers = areas.flatMap((area) => area.blockers.map((blocker) => `${area.area}:${blocker}`));
  const blockers = uniqueSorted([...hardLockBlockers, ...attemptBlockers, ...areaBlockers]);
  const warnings = uniqueSorted(areas.flatMap((area) => area.warnings));
  const readiness: BetaAcceptanceReadiness = blockers.length ? "blocked" : "accepted";
  const missingScriptCount = testMatrix.filter((item) => item.present === false).length;

  return {
    schemaVersion: betaAcceptanceSchemaVersion,
    phaseId: betaAcceptancePhaseId,
    generatedAt,
    readiness,
    finalPhaseNumber: betaAcceptanceFinalPhaseNumber,
    noAdditionalPhasesPlanned: true,
    betaAcceptanceOwnsClosure: true,
    closure: {
      finalPhaseNumber: betaAcceptanceFinalPhaseNumber,
      noAdditionalPhasesPlanned: true,
      betaAcceptanceOwnsClosure: true,
      roadmapEndpoint: "Export / Desktop / Beta Acceptance",
    },
    hardLocks,
    attemptedActions,
    desktopPlans,
    areas,
    testMatrix,
    summary: {
      requiredAreaCount: areas.length,
      acceptedAreaCount: areas.filter((area) => area.status === "accepted").length,
      blockedAreaCount: areas.filter((area) => area.status === "blocked").length,
      hardLockDriftCount: hardLockBlockers.length,
      attemptedActionBlockCount: attemptBlockers.length,
      missingScriptCount,
    },
    blockers,
    warnings,
    validation: {
      ok: blockers.length === 0,
      status: readiness,
      errors: blockers,
      warnings,
      checkedAt: generatedAt,
    },
    notes: [
      "Phase 42 is a pure runtime acceptance receipt. It does not run tests, write files, spawn workers, read credentials, or submit providers.",
      "Desktop readiness is proven with darwin and win32 plan-only permission shells.",
      "Project save/open facts remain project.vibe and project-root-relative file-first facts; runtime-state is a derived cache.",
      "No additional roadmap phase is planned after Phase 42.",
    ],
  };
}
