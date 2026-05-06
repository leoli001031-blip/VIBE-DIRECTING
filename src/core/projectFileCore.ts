import type {
  ProjectAudit,
  ProjectFileCorePathRef,
  ProjectFileCorePlannedEntry,
  ProjectFileCoreSourcePriority,
  ProjectFileCoreSourceRole,
  ProjectFileCoreState,
  ProjectRuntimeEnvironment,
  ProjectSourceIndex,
  ShotRecord,
  AssetRecord,
} from "./types";

export interface ProjectFileCoreBuildInput {
  generatedAt: string;
  projectRoot?: string;
  importedAt?: string;
  sourceTask?: string;
  sourceIndex: ProjectSourceIndex;
  storyFlow: {
    shots: ShotRecord[];
  };
  visualMemory: {
    assets: AssetRecord[];
  };
  runtime?: ProjectRuntimeEnvironment;
  audit?: ProjectAudit;
}

const requiredPlannedEntries: ProjectFileCorePlannedEntry[] = [
  {
    id: "project_file",
    role: "project_manifest",
    kind: "file",
    path: "project.vibe",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Top-level project file planned for file-first mode; Phase 9.1 does not write it."],
  },
  {
    id: "production_bible",
    role: "production_bible",
    kind: "file",
    path: "production_bible/production_bible.vibe.json",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Canonical production bible facts live under the project root in the planned layout."],
  },
  {
    id: "story_flow",
    role: "story_flow",
    kind: "file",
    path: "story_flow/story_flow.vibe.json",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Story flow and section ordering become project-file-backed facts."],
  },
  {
    id: "visual_memory",
    role: "visual_memory",
    kind: "file",
    path: "visual_memory/visual_memory.vibe.json",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Visual Memory is a first-class asset consistency fact file, not a gallery derived from runtime-state."],
  },
  {
    id: "shot_spec",
    role: "shot_spec",
    kind: "directory",
    path: "shots/shot_specs",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Shot specs are project-file facts beneath shots; runtime-state can only cache their resolved view."],
  },
  {
    id: "shot_layout",
    role: "shot_layout",
    kind: "directory",
    path: "shots/shot_layouts",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Shot layouts are project-file facts for subject/camera placement and start/end frame derivation."],
  },
  {
    id: "spatial_memory",
    role: "spatial_memory",
    kind: "file",
    path: "spatial_memory/spatial_memory.vibe.json",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Spatial Memory is the project-file source for world coordinates, camera vectors, axes, and reveal states."],
  },
  {
    id: "scene_asset_pack",
    role: "scene_asset_pack",
    kind: "directory",
    path: "visual_memory/scene_asset_packs",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Scene Asset Packs carry master scene inheritance and derived view facts as project files."],
  },
  {
    id: "voice_memory",
    role: "voice_memory",
    kind: "file",
    path: "voice_memory/voice_memory.vibe.json",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Voice Memory stores voice source metadata only; credentials remain outside project facts."],
  },
  {
    id: "shots",
    role: "shots",
    kind: "directory",
    path: "shots",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Shot specs, keyframe references, and shot manifests are planned beneath this folder."],
  },
  {
    id: "manifests",
    role: "manifests",
    kind: "directory",
    path: "manifests",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Project manifest and import manifests are planned here."],
  },
  {
    id: "reports",
    role: "reports",
    kind: "directory",
    path: "reports",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Audit, QA, readiness, and health reports are planned as project-root-relative artifacts."],
  },
  {
    id: "preview",
    role: "preview",
    kind: "directory",
    path: "preview",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Draft and formal preview plans are represented as planned files only."],
  },
  {
    id: "exports",
    role: "exports",
    kind: "directory",
    path: "exports",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Export packages are planned, not created or moved, in this phase."],
  },
  {
    id: "knowledge",
    role: "knowledge",
    kind: "directory",
    path: "knowledge",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Project-local knowledge manifest and selected packs are planned here."],
  },
  {
    id: "settings",
    role: "settings",
    kind: "directory",
    path: "settings",
    pathOrigin: "project_root_relative",
    status: "planned_only",
    requiredForFileFirstCore: true,
    notes: ["Runtime and provider settings are planned placeholders; credentials are never stored here."],
  },
];

const sourcePriorityPlan: Array<{ role: ProjectFileCoreSourceRole; canonicalPath: string; authority: ProjectFileCoreSourcePriority["authority"] }> = [
  { role: "project_manifest", canonicalPath: "project.vibe", authority: "planned_project_file" },
  { role: "production_bible", canonicalPath: "production_bible/production_bible.vibe.json", authority: "project_file_tree" },
  { role: "story_flow", canonicalPath: "story_flow/story_flow.vibe.json", authority: "project_file_tree" },
  { role: "shot_spec", canonicalPath: "shots/*/shot_spec.vibe.json", authority: "project_file_tree" },
  { role: "shot_layout", canonicalPath: "shots/*/shot_layout.vibe.json", authority: "project_file_tree" },
  { role: "visual_memory", canonicalPath: "visual_memory/visual_memory.vibe.json", authority: "project_file_tree" },
  { role: "spatial_memory", canonicalPath: "spatial_memory/spatial_memory.vibe.json", authority: "project_file_tree" },
  { role: "scene_asset_pack", canonicalPath: "visual_memory/scene_asset_packs/*.vibe.json", authority: "project_file_tree" },
  { role: "voice_memory", canonicalPath: "voice_memory/voice_memory.vibe.json", authority: "project_file_tree" },
  { role: "shots", canonicalPath: "shots/shots.vibe.json", authority: "project_file_tree" },
  { role: "manifests", canonicalPath: "manifests/project_manifest.vibe.json", authority: "project_file_tree" },
  { role: "reports", canonicalPath: "reports/runtime_audit.vibe.json", authority: "project_file_tree" },
  { role: "preview", canonicalPath: "preview/preview_plan.vibe.json", authority: "project_file_tree" },
  { role: "exports", canonicalPath: "exports/export_profiles.vibe.json", authority: "project_file_tree" },
  { role: "knowledge", canonicalPath: "knowledge/knowledge_manifest.vibe.json", authority: "project_file_tree" },
  { role: "settings", canonicalPath: "settings/runtime_settings.vibe.json", authority: "project_file_tree" },
  { role: "runtime_state", canonicalPath: "runtime-state.json", authority: "derived_cache" },
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim()))).sort();
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function isAbsoluteLike(value: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(value);
}

function trimLeadingSlash(value: string): string {
  return normalizeSlashes(value).replace(/^\/+/, "");
}

function toProjectPathRef(pathValue: string | undefined, projectRoot: string | undefined, sourceRef: string): ProjectFileCorePathRef | undefined {
  const raw = pathValue?.trim();
  if (!raw) return undefined;

  const normalized = normalizeSlashes(raw);
  const root = projectRoot ? normalizeSlashes(projectRoot).replace(/\/+$/, "") : "";
  if (root && normalized === root) {
    return {
      path: ".",
      origin: "user_selected_import",
      importedFrom: "user_selected_import",
      sourceRef,
      notes: ["User-selected import root is recorded as an import source, not a portable project-file path contract."],
    };
  }
  if (root && normalized.startsWith(`${root}/`)) {
    return {
      path: normalized.slice(root.length + 1),
      origin: "project_root_relative",
      importedFrom: "user_selected_import",
      sourceRef,
      notes: ["Imported absolute path was normalized to a project-root-relative path for the project-file contract."],
    };
  }
  if (isAbsoluteLike(normalized)) {
    return {
      path: normalized,
      origin: "user_selected_import",
      importedFrom: "user_selected_import",
      sourceRef,
      notes: ["External absolute path is only allowed as a user-selected import source, not as a portable project contract."],
    };
  }
  return {
    path: trimLeadingSlash(normalized),
    origin: "project_root_relative",
    sourceRef,
    notes: ["Path is already project-root-relative."],
  };
}

function refsForRole(input: ProjectFileCoreBuildInput, role: ProjectFileCoreSourceRole): ProjectFileCorePathRef[] {
  const refs: Array<ProjectFileCorePathRef | undefined> = [];
  if (role === "project_manifest") {
    refs.push(toProjectPathRef(input.projectRoot, input.projectRoot, "audit.projectRoot"));
  }
  if (role === "production_bible") {
    refs.push(toProjectPathRef(input.sourceIndex.currentProductionBibleId, input.projectRoot, "sourceIndex.currentProductionBibleId"));
    refs.push(toProjectPathRef(input.sourceTask, input.projectRoot, "audit.sourceTask"));
  }
  if (role === "story_flow") {
    refs.push(toProjectPathRef(input.sourceIndex.currentStoryFlowId, input.projectRoot, "sourceIndex.currentStoryFlowId"));
    refs.push(toProjectPathRef(input.sourceIndex.currentShotSpecId, input.projectRoot, "sourceIndex.currentShotSpecId"));
  }
  if (role === "shot_spec") {
    refs.push(toProjectPathRef(input.sourceIndex.currentShotSpecId, input.projectRoot, "sourceIndex.currentShotSpecId"));
    refs.push(...input.storyFlow.shots.slice(0, 12).map((shot) => toProjectPathRef(`shots/${shot.id}/shot_spec.vibe.json`, input.projectRoot, `storyFlow.shots:${shot.id}.shotSpec`)));
  }
  if (role === "shot_layout") {
    refs.push(...input.storyFlow.shots.slice(0, 12).map((shot) => toProjectPathRef(`shots/${shot.id}/shot_layout.vibe.json`, input.projectRoot, `storyFlow.shots:${shot.id}.shotLayout`)));
  }
  if (role === "visual_memory") {
    refs.push(toProjectPathRef(input.sourceIndex.currentVisualMemoryId, input.projectRoot, "sourceIndex.currentVisualMemoryId"));
    refs.push(...input.visualMemory.assets.slice(0, 12).map((asset) => toProjectPathRef(asset.path, input.projectRoot, `visualMemory.assets:${asset.id}`)));
  }
  if (role === "spatial_memory") {
    refs.push(toProjectPathRef(input.sourceIndex.currentSpatialMemoryId, input.projectRoot, "sourceIndex.currentSpatialMemoryId"));
  }
  if (role === "scene_asset_pack") {
    refs.push(toProjectPathRef("visual_memory/scene_asset_packs", input.projectRoot, "projectFacts.sceneAssetPack"));
    refs.push(...input.visualMemory.assets
      .filter((asset) => asset.type === "scene")
      .slice(0, 12)
      .map((asset) => toProjectPathRef(asset.path, input.projectRoot, `visualMemory.sceneAssets:${asset.id}`)));
  }
  if (role === "voice_memory") {
    refs.push(toProjectPathRef(input.sourceIndex.currentVoiceMemoryId, input.projectRoot, "sourceIndex.currentVoiceMemoryId"));
  }
  if (role === "shots") {
    refs.push(...input.storyFlow.shots.slice(0, 12).flatMap((shot) => [
      toProjectPathRef(shot.startFrame, input.projectRoot, `storyFlow.shots:${shot.id}.startFrame`),
      toProjectPathRef(shot.endFrame, input.projectRoot, `storyFlow.shots:${shot.id}.endFrame`),
      toProjectPathRef(shot.videoPath, input.projectRoot, `storyFlow.shots:${shot.id}.videoPath`),
    ]));
  }
  if (role === "knowledge") {
    refs.push(toProjectPathRef(input.sourceIndex.knowledgeLibraryRoot, input.projectRoot, "sourceIndex.knowledgeLibraryRoot"));
  }
  if (role === "runtime_state") {
    refs.push(toProjectPathRef("runtime-state.json", input.projectRoot, "stateSource.path"));
  }
  return refs.filter((ref): ref is ProjectFileCorePathRef => Boolean(ref));
}

function buildSourcePriority(input: ProjectFileCoreBuildInput): ProjectFileCoreSourcePriority[] {
  return sourcePriorityPlan.map((entry, index) => ({
    role: entry.role,
    priority: index + 1,
    canonicalPath: entry.canonicalPath,
    authority: entry.authority,
    runtimeStateMayOverride: false,
    importedSourceRefs: refsForRole(input, entry.role),
    notes:
      entry.role === "runtime_state"
        ? ["Runtime-state is a derived cache and cannot override project-file facts."]
        : ["This role is part of the planned project.vibe file-first source-of-truth chain."],
  }));
}

function buildProjectFileFactSourceReceipt(input: ProjectFileCoreBuildInput) {
  return {
    receiptKind: "project_file_fact_source" as const,
    projectVibeEntry: {
      path: "project.vibe",
      role: "project_manifest",
      authority: "planned_project_file",
      saveOpenContract: "project_root_relative",
      runtimeStateMayOverride: false,
    },
    projectFactFiles: sourcePriorityPlan
      .filter((entry) => entry.role !== "runtime_state")
      .map((entry) => ({
        role: entry.role,
        canonicalPath: entry.canonicalPath,
        authority: entry.authority,
        projectRootRelative: true,
      })),
    saveOpenContract: {
      projectRootRelativeRequired: true,
      absolutePathsBlocked: true,
      parentTraversalBlocked: true,
      userFileMoveDeleteBlocked: true,
      credentialTokenSecretWriteBlocked: true,
    },
    runtimeStateDerivedCache: {
      path: "runtime-state.json",
      role: "derived_cache",
      mayBeRebuiltFromProjectFiles: true,
      mayOverwriteProjectFiles: false,
      rebuildInputs: [
        "project.vibe",
        "production_bible/production_bible.vibe.json",
        "story_flow/story_flow.vibe.json",
        "visual_memory/visual_memory.vibe.json",
        "shots/*/shot_spec.vibe.json",
        "shots/*/shot_layout.vibe.json",
        "spatial_memory/spatial_memory.vibe.json",
        "visual_memory/scene_asset_packs/*.vibe.json",
        "voice_memory/voice_memory.vibe.json",
        "manifests/source_index.vibe.json",
      ],
    },
    blockedAuthorities: [
      "runtime_state",
      "runtime_cache",
      "chat_history",
      "old_chat",
      "direct_input",
      "global_knowledge_library",
    ],
    projectLocalKnowledgeScope: {
      projectKnowledgePath: "knowledge/knowledge_manifest.vibe.json",
      projectKnowledgeMayBeFactReference: true,
      globalKnowledgeMayAuthorizeProjectFacts: false,
      oldChatMayAuthorizeProjectFacts: false,
      notes: [
        "Project-local knowledge packs can be referenced by project fact files.",
        "Global knowledge libraries and previous chat history cannot become project fact authority unless imported into project files.",
      ],
    },
    sourceIndexHash: input.sourceIndex.sourceIndexHash,
  };
}

export function buildProjectFileCoreState(input: ProjectFileCoreBuildInput): ProjectFileCoreState {
  const blockers: string[] = [];
  if (!input.sourceIndex.sourceIndexHash) blockers.push("sourceIndex.sourceIndexHash is required to key the derived runtime-state cache.");
  if (!input.sourceIndex.projectId) blockers.push("sourceIndex.projectId is required for project manifest planning.");

  const importedRoot = toProjectPathRef(input.projectRoot, input.projectRoot, "audit.projectRoot");
  const sourceRefs = uniqueSorted([
    "audit.projectRoot",
    "sourceIndex",
    "storyFlow.shots",
    "visualMemory.assets",
    "runtime.config.projectRootPolicy",
    "runtime.providerEnablementSummary",
  ]);

  const state = {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    phase: "phase_9_1_minimum_file_first_core" as const,
    projectFileName: "project.vibe" as const,
    projectFileStatus: "planned_not_written" as const,
    projectRoot: {
      rootRef: "project_root" as const,
      origin: "user_selected_import" as const,
      selectedImport: importedRoot,
      notes: ["The imported project root is treated as user-selected input; no absolute platform path becomes the portable contract."],
    },
    plannedFileTree: requiredPlannedEntries,
    sourceOfTruthPriority: buildSourcePriority(input),
    derivedCachePolicy: {
      runtimeStateRole: "derived_cache" as const,
      runtimeStateMayBeRebuilt: true as const,
      runtimeStateIsSoleSourceOfTruth: false as const,
      rebuildInputs: [
        "project_manifest",
        "production_bible",
        "story_flow",
        "shot_spec",
        "shot_layout",
        "visual_memory",
        "spatial_memory",
        "scene_asset_pack",
        "voice_memory",
        "shots",
        "manifests",
        "reports",
        "preview",
        "exports",
        "knowledge",
        "settings",
      ] as ProjectFileCoreSourceRole[],
      cacheKeys: {
        sourceIndexHash: input.sourceIndex.sourceIndexHash,
        projectVersion: input.sourceIndex.projectVersion || input.importedAt || input.generatedAt,
        generatedAt: input.generatedAt,
      },
      invalidationRefs: uniqueSorted([
        input.sourceIndex.sourceIndexHash,
        ...input.storyFlow.shots.map((shot) => shot.id),
        ...input.visualMemory.assets.map((asset) => asset.id),
      ]),
      notes: ["Runtime-state is rebuildable derived cache; project.vibe and planned project files are the intended fact surface."],
    },
    pathPolicy: {
      allowedOrigins: ["project_root_relative", "user_selected_import"] as ProjectFileCorePathRef["origin"][],
      projectRootRelativeRequired: true as const,
      userSelectedImportAllowed: true as const,
      hardcodedAbsolutePathContractForbidden: true as const,
      platformSpecificPathContractForbidden: true as const,
      pathResolverRequired: true as const,
      notes: [
        "Persisted project paths must be project-root-relative.",
        "Absolute paths are only accepted as user-selected import evidence and must be normalized before becoming project facts.",
      ],
    },
    hardLocks: {
      dryRunOnly: true as const,
      readOnly: true as const,
      noFileMutation: true as const,
      noUserFileMove: true as const,
      noProviderSubmit: true as const,
      noImageGeneration: true as const,
      noVideoGeneration: true as const,
      noArbitraryShell: true as const,
      noCredentialRead: true as const,
      noCredentialWrite: true as const,
      projectVibeWriteAllowed: false as const,
      runtimeStateIsDerivedCache: true as const,
    },
    migrationReadiness: {
      status: blockers.length ? "blocked" as const : "planned_only_ready" as const,
      readyForDryRunPlanning: blockers.length === 0,
      readyForRuntimeDerivation: blockers.length === 0,
      readyForProjectVibeWrite: false as const,
      blockers,
      warnings: ["Phase 9.1 plans project.vibe and the file tree only; it does not write, move, generate, or submit anything."],
      nextSteps: [
        "Add an explicit project.vibe writer only after the file contract is approved.",
        "Keep runtime-state rebuildable from project-file facts as subsequent phases migrate more fields.",
      ],
    },
    projectFileFactSourceReceipt: buildProjectFileFactSourceReceipt(input),
    sourceRefs,
    notes: [
      "project.vibe is the planned file-first project core, not a file written by this phase.",
      "Project file facts, including project-local knowledge references, are the authority for save/open and runtime cache rebuild.",
      "Runtime-state, old chat, direct input, runtime cache, and global knowledge cannot authorize project facts.",
      "No provider submit, file mutation, arbitrary shell execution, credential read/write, image generation, or video generation is allowed.",
    ],
  };
  return state;
}
