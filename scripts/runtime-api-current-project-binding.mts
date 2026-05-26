import path from "node:path";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
}

function requestBodyString(body, names) {
  if (!isRecord(body)) return undefined;
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const project = body.project;
  if (isRecord(project)) {
    for (const name of names) {
      const value = project[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function firstExistingPath(paths, existsSync) {
  return paths.find((filePath) => existsSync(filePath));
}

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`${name} is required.`);
}

export function createRuntimeApiCurrentProjectBinding({
  repoRoot,
  sandboxRunRootRelativePath,
  knownProjectFixtureRoots,
  round5FullRealChainReportFileName,
  currentProjectBindingEndpoint,
  currentProjectSelectEndpoint,
  currentProjectRecentEndpoint,
  currentProjectBindingPathInput,
  currentProjectReportPathInput,
  resolveRepoInputPath,
  repoRelativePath,
  pathWithinRoot,
  runtimePolicy,
  normalizeRelativePath,
  readJsonIfPresent,
  existsSync,
  statSync,
  mkdirSync,
  writeFileSync,
  now = () => new Date(),
} = {}) {
  if (!repoRoot) throw new Error("repoRoot is required.");
  if (!sandboxRunRootRelativePath) throw new Error("sandboxRunRootRelativePath is required.");
  if (!Array.isArray(knownProjectFixtureRoots)) throw new Error("knownProjectFixtureRoots is required.");
  if (!round5FullRealChainReportFileName) throw new Error("round5FullRealChainReportFileName is required.");
  if (!currentProjectBindingEndpoint) throw new Error("currentProjectBindingEndpoint is required.");
  if (!currentProjectSelectEndpoint) throw new Error("currentProjectSelectEndpoint is required.");
  if (!currentProjectRecentEndpoint) throw new Error("currentProjectRecentEndpoint is required.");
  requireFunction(resolveRepoInputPath, "resolveRepoInputPath");
  requireFunction(repoRelativePath, "repoRelativePath");
  requireFunction(pathWithinRoot, "pathWithinRoot");
  requireFunction(runtimePolicy, "runtimePolicy");
  requireFunction(readJsonIfPresent, "readJsonIfPresent");
  requireFunction(existsSync, "existsSync");
  requireFunction(statSync, "statSync");
  requireFunction(mkdirSync, "mkdirSync");
  requireFunction(writeFileSync, "writeFileSync");
  requireFunction(now, "now");

  const normalize = typeof normalizeRelativePath === "function"
    ? normalizeRelativePath
    : (value) => String(value || "").replace(/\\/g, "/");
  const readCurrentProjectBindingPathInput = typeof currentProjectBindingPathInput === "function"
    ? currentProjectBindingPathInput
    : () => currentProjectBindingPathInput;
  const readCurrentProjectReportPathInput = typeof currentProjectReportPathInput === "function"
    ? currentProjectReportPathInput
    : () => currentProjectReportPathInput;

  function currentProjectBindingPath() {
    const configuredPath = readCurrentProjectBindingPathInput();
    if (!configuredPath) return path.join(repoRoot, ".vibe-runtime", "current-project.local.json");
    return path.isAbsolute(configuredPath)
      ? path.resolve(configuredPath)
      : path.resolve(repoRoot, configuredPath);
  }

  function bindingPathRelative(bindingPath) {
    return pathWithinRoot(bindingPath, repoRoot) ? repoRelativePath(bindingPath) : bindingPath;
  }

  function readCurrentProjectBinding() {
    const bindingPath = currentProjectBindingPath();
    const binding = readJsonIfPresent(bindingPath);
    if (!isRecord(binding)) {
      return {
        bound: false,
        bindingPath,
        bindingPathRelative: bindingPathRelative(bindingPath),
      };
    }
    return {
      bound: typeof binding.projectRoot === "string" && binding.projectRoot.length > 0,
      bindingPath,
      bindingPathRelative: bindingPathRelative(bindingPath),
      binding,
    };
  }

  function resolveProjectSource(inputPath, options = {}) {
    const configuredPath = resolveRepoInputPath(inputPath || sandboxRunRootRelativePath);
    const configuredStats = existsSync(configuredPath) ? statSync(configuredPath) : undefined;
    const configuredIsProjectVibe = configuredStats?.isFile() && path.basename(configuredPath) === "project.vibe";
    const runRootPath = configuredIsProjectVibe
      ? path.basename(path.dirname(configuredPath)) === "project"
        ? path.dirname(path.dirname(configuredPath))
        : path.dirname(configuredPath)
      : configuredPath;
    const projectVibePath = configuredIsProjectVibe
      ? configuredPath
      : firstExistingPath([
        path.join(runRootPath, "project.vibe"),
        path.join(runRootPath, "project", "project.vibe"),
        path.join(runRootPath, "project", "project.vibe.json"),
      ], existsSync) || path.join(runRootPath, "project", "project.vibe");

    const reportInput = options.reportPath || (options.ignoreReportEnv ? undefined : (options.projectReportPath || readCurrentProjectReportPathInput()));
    const reportPath = reportInput
      ? resolveRepoInputPath(reportInput)
      : firstExistingPath([
        path.join(runRootPath, "reports", round5FullRealChainReportFileName),
        path.join(runRootPath, "reports", "image2_start_long_chain_report.json"),
        path.join(runRootPath, "reports", "real_demo_e2e_report.json"),
        path.join(runRootPath, "image2_start_long_chain_report.json"),
      ], existsSync) || path.join(runRootPath, "reports", "image2_start_long_chain_report.json");

    const runRootRelativePath = normalize(repoRelativePath(runRootPath));
    return {
      runRootPath,
      runRootRelativePath,
      projectVibePath,
      projectVibeRelativePath: normalize(repoRelativePath(projectVibePath)),
      sourceIndexPath: path.join(runRootPath, "project", "source_index.json"),
      sourceIndexRelativePath: normalize(repoRelativePath(path.join(runRootPath, "project", "source_index.json"))),
      storyFlowPath: path.join(runRootPath, "project", "story_flow.json"),
      storyFlowRelativePath: normalize(repoRelativePath(path.join(runRootPath, "project", "story_flow.json"))),
      visualMemoryPath: path.join(runRootPath, "project", "visual_memory.json"),
      visualMemoryRelativePath: normalize(repoRelativePath(path.join(runRootPath, "project", "visual_memory.json"))),
      runManifestPath: path.join(runRootPath, "run_manifest.json"),
      runManifestRelativePath: normalize(repoRelativePath(path.join(runRootPath, "run_manifest.json"))),
      runtimeTruthLayerPath: path.join(runRootPath, "reports", "runtime_truth_layer.json"),
      runtimeTruthLayerRelativePath: normalize(repoRelativePath(path.join(runRootPath, "reports", "runtime_truth_layer.json"))),
      previewPlanPath: path.join(runRootPath, "reports", "preview_plan.json"),
      previewPlanRelativePath: normalize(repoRelativePath(path.join(runRootPath, "reports", "preview_plan.json"))),
      reportPath,
      reportRelativePath: normalize(repoRelativePath(reportPath)),
      projectRootMode: options.projectRootMode || "configured_project_root",
      sourceLabel: options.sourceLabel || "runtime endpoint / project projection",
      sandboxSource: options.sandboxSource,
      binding: options.binding,
      bindingPath: options.bindingPath,
      bindingPathRelative: options.bindingPathRelative,
      requestContextSource: options.requestContextSource,
      requestProjectId: options.requestProjectId,
      requestProjectIdSource: options.requestProjectIdSource,
      requestProjectRoot: options.requestProjectRoot,
    };
  }

  function validateSelectableProjectRoot(projectRoot) {
    if (typeof projectRoot !== "string" || !projectRoot.trim()) {
      throw new Error("projectRoot is required.");
    }
    const configuredPath = resolveRepoInputPath(projectRoot.trim());
    if (!existsSync(configuredPath)) {
      throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const stats = statSync(configuredPath);
    if (!stats.isDirectory() && !(stats.isFile() && path.basename(configuredPath) === "project.vibe")) {
      throw new Error("projectRoot must be a project directory or project.vibe inside the repository.");
    }
    return resolveProjectSource(configuredPath, {
      projectRootMode: "runtime_current_project_binding",
      sourceLabel: "runtime endpoint / current project binding validation",
      ignoreReportEnv: true,
    });
  }

  function writeCurrentProjectBinding(input = {}) {
    const source = validateSelectableProjectRoot(input.projectRoot);
    const bindingPath = currentProjectBindingPath();
    const selectedAt = now();
    const binding = {
      schemaVersion: "vibe_core_current_project_binding_v1",
      projectRoot: source.runRootRelativePath,
      projectRootRelativePath: source.runRootRelativePath,
      projectVibeRelativePath: source.projectVibeRelativePath,
      projectId: asString(input.projectId),
      displayName: asString(input.displayName),
      selectedAt: selectedAt instanceof Date ? selectedAt.toISOString() : String(selectedAt),
    };
    mkdirSync(path.dirname(bindingPath), { recursive: true });
    writeFileSync(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, "utf8");
    return { bindingPath, binding, source };
  }

  function clearCurrentProjectBinding() {
    const bindingPath = currentProjectBindingPath();
    const clearedAt = now();
    const binding = {
      schemaVersion: "vibe_core_current_project_binding_v1",
      status: "cleared",
      clearedAt: clearedAt instanceof Date ? clearedAt.toISOString() : String(clearedAt),
    };
    mkdirSync(path.dirname(bindingPath), { recursive: true });
    writeFileSync(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, "utf8");
    return { bindingPath, binding };
  }

  function realDemo005Source() {
    return resolveProjectSource(sandboxRunRootRelativePath, {
      projectRootMode: "sandbox_fixture_projection",
      sourceLabel: "runtime endpoint / 005 compatibility",
      sandboxSource: "005 sandbox",
    });
  }

  function currentProjectSource() {
    const bindingState = readCurrentProjectBinding();
    if (!bindingState.bound) {
      const error = new Error("No current project is bound. Use POST /api/runtime/projects/select first.");
      error.code = "CURRENT_PROJECT_UNBOUND";
      error.bindingState = bindingState;
      throw error;
    }

    const binding = bindingState.binding;
    return resolveProjectSource(binding.projectRoot, {
      projectRootMode: "runtime_current_project_binding",
      sourceLabel: "runtime endpoint / current project binding",
      requestContextSource: "binding",
      requestProjectId: binding.projectId,
      requestProjectIdSource: binding.projectId ? "binding" : undefined,
      requestProjectRoot: binding.projectRoot,
      binding,
      bindingPath: bindingState.bindingPath,
      bindingPathRelative: bindingState.bindingPathRelative,
      ignoreReportEnv: true,
    });
  }

  function readProjectVibe(source) {
    if (!existsSync(source.projectVibePath)) return undefined;
    try {
      const projectVibe = readJsonIfPresent(source.projectVibePath);
      if (!projectVibe) return undefined;
      return {
        schemaVersion: projectVibe.schemaVersion,
        projectId: projectVibe.projectId,
        runId: projectVibe.runId,
        title: asString(projectVibe.manifest?.title) || asString(projectVibe.title),
        projectRoot: source.runRootRelativePath,
        projectVibePath: source.projectVibeRelativePath,
        roleIds: Array.isArray(projectVibe.roleIds) ? projectVibe.roleIds : [],
        sceneIds: Array.isArray(projectVibe.sceneIds) ? projectVibe.sceneIds : [],
        styleId: projectVibe.styleId,
      };
    } catch {
      return undefined;
    }
  }

  function projectIdentityFromSource(source) {
    const projectVibe = readProjectVibe(source);
    if (projectVibe) return projectVibe;
    const manifest = readJsonIfPresent(source.runManifestPath);
    if (manifest) {
      return {
        projectId: manifest.projectId || source.requestProjectId,
        runId: manifest.runId,
        projectRoot: source.runRootRelativePath,
        projectVibePath: source.projectVibeRelativePath,
      };
    }
    return {
      projectId: source.requestProjectId,
      projectRoot: source.runRootRelativePath,
      projectVibePath: source.projectVibeRelativePath,
    };
  }

  function projectChoiceTitle(source, project, binding) {
    if (asString(project?.title)) return asString(project.title);
    const displayName = asString(binding?.displayName) || asString(binding?.name);
    if (displayName) return displayName;
    if (asString(project?.projectId)) {
      const match = String(project.projectId).match(/real_demo_e2e_(\d{3})/);
      if (match) return `项目 ${match[1]}`;
      return String(project.projectId).replace(/_/g, " ");
    }
    const match = source.runRootRelativePath.match(/\/(\d{3})[^/]*$/);
    if (match) return `项目 ${match[1]}`;
    return path.basename(source.runRootRelativePath) || "未命名项目";
  }

  function projectChoiceUpdatedAt(source) {
    const candidates = [source.projectVibePath, source.reportPath, source.runRootPath];
    for (const candidate of candidates) {
      if (!candidate || !existsSync(candidate)) continue;
      return statSync(candidate).mtime.toISOString();
    }
    return undefined;
  }

  function projectChoiceFromSource(source, options = {}) {
    const project = projectIdentityFromSource(source);
    return {
      projectRoot: source.runRootRelativePath,
      displayName: projectChoiceTitle(source, project, options.binding),
      projectId: asString(project.projectId),
      updatedAt: projectChoiceUpdatedAt(source),
      status: options.current ? "当前" : "可打开",
    };
  }

  function currentProjectRecentResponse(extra = {}) {
    const choices = [];
    const seenRoots = new Set();
    const bindingState = readCurrentProjectBinding();

    if (bindingState.bound) {
      try {
        const source = currentProjectSource();
        const choice = projectChoiceFromSource(source, { current: true, binding: bindingState.binding });
        choices.push(choice);
        seenRoots.add(choice.projectRoot);
      } catch {
        // Ignore an unreadable binding; the list endpoint stays read-only and fail-closed.
      }
    }

    for (const fixtureRoot of knownProjectFixtureRoots) {
      try {
        const source = resolveProjectSource(fixtureRoot, {
          projectRootMode: "known_fixture_project_choice",
          sourceLabel: "runtime endpoint / known project choice",
          ignoreReportEnv: true,
        });
        if (!existsSync(source.projectVibePath) || seenRoots.has(source.runRootRelativePath)) continue;
        choices.push(projectChoiceFromSource(source));
        seenRoots.add(source.runRootRelativePath);
      } catch {
        // Missing or malformed fixtures are skipped instead of leaking diagnostics into the main UI.
      }
    }

    return {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectRecentEndpoint,
      status: "ready",
      choices,
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      ...extra,
    };
  }

  function currentProjectSourceResult() {
    try {
      return { source: currentProjectSource() };
    } catch (error) {
      return {
        error,
        message: error instanceof Error ? error.message : "Current project root is unavailable.",
        unbound: error?.code === "CURRENT_PROJECT_UNBOUND",
        bindingState: error?.bindingState,
      };
    }
  }

  function requestOverrideDiagnostics(requestContext = {}) {
    return {
      ignoredProjectRootSource: requestContext.projectRootSource,
      ignoredProjectRootProvided: Boolean(requestContext.projectRoot),
      ignoredProjectIdSource: requestContext.projectIdSource,
      ignoredProjectIdProvided: Boolean(requestContext.projectId),
    };
  }

  function blockedCurrentProjectResponse(endpoint, requestContext = {}, extra = {}) {
    const projectRoot = requestContext.projectRoot;
    const projectId = requestContext.projectId;
    const identity = { projectId, projectRoot };
    return {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      source: "runtime_endpoint",
      sourceLabel: "runtime endpoint / current project blocked",
      requestContext: {
        ...requestOverrideDiagnostics(requestContext),
      },
      projectRootMode: "blocked_project_root",
      projectRoot,
      projectId,
      identity,
      project: identity,
      status: "blocked",
      previewStatus: "blocked",
      productionStatus: "blocked",
      reportStatus: "blocked",
      reportPath: undefined,
      reportRelativePath: undefined,
      reportUrl: undefined,
      reviewOverlayShots: [],
      productionNeedsReviewShots: [],
      shotCount: 0,
      blockerCount: 1,
      observations: [],
      previewItems: [],
      message: "Current project root is blocked or unavailable.",
      ...extra,
    };
  }

  function unboundCurrentProjectResponse(endpoint, requestContext = {}, extra = {}) {
    const bindingState = readCurrentProjectBinding();
    return {
      ok: false,
      ...runtimePolicy(),
      endpoint,
      source: "runtime_endpoint",
      sourceLabel: "runtime endpoint / current project unbound",
      requestContext: {
        ...requestOverrideDiagnostics(requestContext),
      },
      currentProject: {
        bound: false,
        bindingPath: bindingState.bindingPathRelative,
      },
      projectRootMode: "unbound_current_project",
      projectRoot: undefined,
      projectId: undefined,
      identity: {},
      project: {},
      status: "unbound",
      previewStatus: "unavailable",
      productionStatus: "blocked",
      reportStatus: "unavailable",
      projectionSource: "unavailable",
      ledgerTruthSource: "unavailable",
      factsUsed: [],
      reportPath: undefined,
      reportRelativePath: undefined,
      reportUrl: undefined,
      image2ReportPath: undefined,
      runtimeTruthLayerPath: undefined,
      previewPlanPath: undefined,
      reviewOverlayShots: [],
      productionNeedsReviewShots: [],
      shotCount: 0,
      blockerCount: 1,
      observations: [],
      previewItems: [],
      message: "No current project is bound. Use POST /api/runtime/projects/select before reading current-project runtime truth.",
      ...extra,
    };
  }

  function currentProjectBindingStatusResponse(extra = {}) {
    const bindingState = readCurrentProjectBinding();
    if (!bindingState.bound) {
      return {
        ok: true,
        ...runtimePolicy(),
        endpoint: currentProjectBindingEndpoint,
        status: "unbound",
        currentProject: {
          bound: false,
          bindingPath: bindingState.bindingPathRelative,
        },
        ...extra,
      };
    }

    try {
      const source = currentProjectSource();
      const project = projectIdentityFromSource(source);
      return {
        ok: true,
        ...runtimePolicy(),
        endpoint: currentProjectBindingEndpoint,
        status: "bound",
        currentProject: {
          bound: true,
          bindingPath: bindingState.bindingPathRelative,
          binding: bindingState.binding,
          project,
          projectRoot: source.runRootRelativePath,
          projectRootRelativePath: source.runRootRelativePath,
          projectVibeRelativePath: source.projectVibeRelativePath,
        },
        ...extra,
      };
    } catch (error) {
      return {
        ok: false,
        ...runtimePolicy(),
        endpoint: currentProjectBindingEndpoint,
        status: "blocked",
        currentProject: {
          bound: true,
          bindingPath: bindingState.bindingPathRelative,
          binding: bindingState.binding,
        },
        message: error instanceof Error ? error.message : "Current project binding could not be resolved.",
        ...extra,
      };
    }
  }

  function selectCurrentProjectBindingResponse(body) {
    const requestBody = isRecord(body) ? body : {};
    const projectRoot = requestBodyString(requestBody, ["projectRoot", "projectRootPath"]);
    const projectId = requestBodyString(requestBody, ["projectId"]);
    const displayName = requestBodyString(requestBody, ["displayName", "name"]);

    try {
      const { bindingPath, binding, source } = writeCurrentProjectBinding({ projectRoot, projectId, displayName });
      const project = projectIdentityFromSource(source);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          ...runtimePolicy(),
          endpoint: currentProjectSelectEndpoint,
          status: "bound",
          currentProject: {
            bound: true,
            bindingPath: bindingPathRelative(bindingPath),
            binding,
            project,
            projectRoot: source.runRootRelativePath,
            projectRootRelativePath: source.runRootRelativePath,
            projectVibeRelativePath: source.projectVibeRelativePath,
          },
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
        },
      };
    } catch (error) {
      return {
        statusCode: 403,
        payload: {
          ok: false,
          ...runtimePolicy(),
          endpoint: currentProjectSelectEndpoint,
          status: "blocked",
          currentProject: {
            bound: false,
          },
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
          message: error instanceof Error ? error.message : "Current project selection was blocked.",
          todo: "External user project roots are intentionally fail-closed until the runtime boundary is expanded safely.",
        },
      };
    }
  }

  function clearCurrentProjectBindingResponse(extra = {}) {
    const { bindingPath, binding } = clearCurrentProjectBinding();
    return {
      statusCode: 200,
      payload: {
        ok: true,
        ...runtimePolicy(),
        endpoint: currentProjectBindingEndpoint,
        status: "unbound",
        currentProject: {
          bound: false,
          bindingPath: bindingPathRelative(bindingPath),
          binding,
        },
        providerCalled: false,
        prepareRan: false,
        projectVibeWritten: false,
        message: "已忘记当前项目记录，本地项目文件没有删除。",
        ...extra,
      },
    };
  }

  return {
    currentProjectBindingPath,
    readCurrentProjectBinding,
    validateSelectableProjectRoot,
    writeCurrentProjectBinding,
    clearCurrentProjectBinding,
    resolveProjectSource,
    realDemo005Source,
    currentProjectSource,
    readProjectVibe,
    projectIdentityFromSource,
    projectChoiceTitle,
    projectChoiceUpdatedAt,
    projectChoiceFromSource,
    currentProjectRecentResponse,
    currentProjectSourceResult,
    requestOverrideDiagnostics,
    blockedCurrentProjectResponse,
    unboundCurrentProjectResponse,
    currentProjectBindingStatusResponse,
    selectCurrentProjectBindingResponse,
    clearCurrentProjectBindingResponse,
  };
}
