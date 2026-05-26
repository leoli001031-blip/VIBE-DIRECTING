import path from "node:path";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length ? value : undefined;
}

function asBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return undefined;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length))];
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

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

function oneShotQaChecklist(shotId) {
  return [
    { id: "identity", label: "角色一致", required: true, status: "pending", shotId },
    { id: "scene", label: "场景一致", required: true, status: "pending", shotId },
    { id: "style", label: "风格一致", required: true, status: "pending", shotId },
    { id: "start_frame", label: "首帧可用", required: true, status: "pending", shotId },
  ];
}

const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key=|private[_-]?key|raw-secret)/i;
const secretKeyPattern = /(api[_-]?key|access[_-]?token|authorization|secret|password|bearer|credential|credentialmaterial|rawcredential|private[_-]?key)/i;
const providerSubmitPermissionReceiptSchemaVersion = "0.1.0";
const providerSubmitPermissionHardLocks = {
  defaultLocked: true,
  actualExecutionAllowed: false,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  automaticSubmitAllowed: false,
  liveSubmitAllowed: false,
  externalNetworkIoAllowed: false,
  credentialMaterialAccessAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noWorkerSpawn: true,
  noFileMutation: true,
  projectVibeMutationAllowed: false,
  maxConcurrency: 1,
  maxAutoRetries: 0,
};

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`${name} is required.`);
}

export function createRuntimeApiCurrentProjectImage2Handoff({
  repoRoot,
  repoRootRealPath,
  currentProjectSource,
  projectProjectionFromSource,
  currentProjectWorkbenchFacts,
  runtimePolicy,
  runtimeFileUrl,
  scopedRepoPath,
  readRuntimeJson,
  runtimePathExists,
  runtimeRelativeFromValue,
  normalizeRelativePath,
  buildCurrentProjectImage2TransportPlan,
  currentProjectImage2TransportModes,
  currentProjectImage2ForbiddenProviders,
  normalizeCurrentProjectImage2TransportMode,
  currentProjectImage2OneShotStatusEndpoint,
  currentProjectImage2OneShotPrepareEndpoint,
  currentProjectImage2OneShotConfirmEndpoint,
  currentProjectImage2OneShotPrepareTriggerEndpoint,
  semanticQaSummary,
  actualProviderObservationMatches,
  actualSemanticQaMatches,
  sha256File,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
  readFileSync,
} = {}) {
  if (!repoRoot) throw new Error("createRuntimeApiCurrentProjectImage2Handoff requires repoRoot");
  if (!repoRootRealPath) throw new Error("createRuntimeApiCurrentProjectImage2Handoff requires repoRootRealPath");
  requireFunction(currentProjectSource, "currentProjectSource");
  requireFunction(projectProjectionFromSource, "projectProjectionFromSource");
  requireFunction(currentProjectWorkbenchFacts, "currentProjectWorkbenchFacts");
  requireFunction(runtimePolicy, "runtimePolicy");
  requireFunction(runtimeFileUrl, "runtimeFileUrl");
  requireFunction(scopedRepoPath, "scopedRepoPath");
  requireFunction(readRuntimeJson, "readRuntimeJson");
  requireFunction(runtimePathExists, "runtimePathExists");
  requireFunction(runtimeRelativeFromValue, "runtimeRelativeFromValue");
  requireFunction(normalizeRelativePath, "normalizeRelativePath");
  requireFunction(buildCurrentProjectImage2TransportPlan, "buildCurrentProjectImage2TransportPlan");
  requireFunction(normalizeCurrentProjectImage2TransportMode, "normalizeCurrentProjectImage2TransportMode");
  requireFunction(semanticQaSummary, "semanticQaSummary");
  requireFunction(actualProviderObservationMatches, "actualProviderObservationMatches");
  requireFunction(actualSemanticQaMatches, "actualSemanticQaMatches");
  requireFunction(sha256File, "sha256File");
  requireFunction(existsSync, "existsSync");
  requireFunction(mkdirSync, "mkdirSync");
  requireFunction(writeFileSync, "writeFileSync");
  requireFunction(renameSync, "renameSync");
  requireFunction(realpathSync, "realpathSync");
  requireFunction(readFileSync, "readFileSync");
  if (!Array.isArray(currentProjectImage2TransportModes)) throw new Error("currentProjectImage2TransportModes is required.");
  if (!Array.isArray(currentProjectImage2ForbiddenProviders)) throw new Error("currentProjectImage2ForbiddenProviders is required.");

  function oneShotRequestInput(url, body) {
    const receipt = isRecord(body?.receipt) ? body.receipt : isRecord(body?.prepareReceipt) ? body.prepareReceipt : undefined;
    const requestedTransportMode = asString(url.searchParams.get("transportMode"))
      || requestBodyString(body, ["transportMode", "mode"])
      || asString(receipt?.transportMode);
    const rawSelectedShotIds = Array.isArray(body?.selectedShotIds)
      ? body.selectedShotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];
    const selectedShotId = asString(url.searchParams.get("selectedShotId"))
      || requestBodyString(body, ["selectedShotId", "shotId"])
      || asString(receipt?.selectedShotId);
    const selectedShotIds = rawSelectedShotIds.length
      ? rawSelectedShotIds
      : selectedShotId
        ? [selectedShotId]
        : [];
    const imageCount = Number.isInteger(body?.imageCount) ? body.imageCount : Number.isInteger(receipt?.imageCount) ? receipt.imageCount : 1;
    const maxProviderCallsRaw = asString(url.searchParams.get("maxProviderCallsPerReceipt"))
      || requestBodyString(body, ["maxProviderCallsPerReceipt"])
      || asString(receipt?.maxProviderCallsPerReceipt);
    const maxProviderCallsPerReceipt = maxProviderCallsRaw
      ? Number(maxProviderCallsRaw)
      : Number.isInteger(body?.maxProviderCallsPerReceipt)
        ? body.maxProviderCallsPerReceipt
        : 1;
    const bodyRequiresSubmitPermissionReceipt = asBoolean(body?.submitPermissionReceiptRequired)
      ?? asBoolean(body?.requireSubmitPermissionReceipt);
    const queryRequiresSubmitPermissionReceipt = asBoolean(url.searchParams.get("submitPermissionReceiptRequired"))
      ?? asBoolean(url.searchParams.get("requireSubmitPermissionReceipt"));
    const credentialRefProvided = url.searchParams.has("credentialRef")
      || (isRecord(body) && Object.prototype.hasOwnProperty.call(body, "credentialRef"));
    const credentialRef = asString(url.searchParams.get("credentialRef"))
      || requestBodyString(body, ["credentialRef"])
      || asString(receipt?.credentialRef);
    return {
      selectedShotId,
      selectedShotIds,
      imageCount,
      expectedOutputPath: requestBodyString(body, ["expectedOutputPath", "outputPath"]) || asString(receipt?.expectedOutputPath),
      expectedOutputs: Array.isArray(body?.expectedOutputs) ? body.expectedOutputs : undefined,
      credentialRef,
      credentialRefProvided,
      maxProviderCallsPerReceipt,
      submitPermissionReceiptRequired: queryRequiresSubmitPermissionReceipt ?? bodyRequiresSubmitPermissionReceipt ?? false,
      actionTimeConfirmation: isRecord(body?.actionTimeConfirmation) ? body.actionTimeConfirmation : undefined,
      receipt,
      transportMode: requestedTransportMode,
      requestedTransportMode,
      rawBody: isRecord(body) ? body : {},
      rawQuery: Object.fromEntries(url.searchParams.entries()),
    };
  }

  function oneShotPathInsideRoot(candidatePath, rootPath) {
    if (typeof candidatePath !== "string" || !candidatePath.trim()) return false;
    if (typeof rootPath !== "string" || !rootPath.trim()) return false;
    const normalizedPath = normalizeRelativePath(candidatePath.trim());
    const normalizedRoot = normalizeRelativePath(rootPath.trim());
    if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith("../") || normalizedPath.includes("/../")) return false;
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
  }

  function oneShotStatePaths(shotRoot) {
    const stateRoot = `${shotRoot}/state`;
    return {
      stateRoot,
      receiptStatePath: `${stateRoot}/prepare-receipt.json`,
      handoffStatePath: `${stateRoot}/handoff-packet.json`,
      triggerPlanStatePath: `${stateRoot}/trigger-plan.json`,
      submitPermissionReceiptStatePath: `${stateRoot}/submit-permission-receipt.json`,
    };
  }

  function writeOneShotStateJson(relativePath, payload, stateRoot, sandboxRoot) {
    if (!oneShotPathInsideRoot(relativePath, sandboxRoot) || !oneShotPathInsideRoot(relativePath, stateRoot)) {
      throw new Error(`Refusing to write one-shot state outside sandbox: ${relativePath}`);
    }
    const filePath = scopedRepoPath(relativePath);
    const stateRootPath = scopedRepoPath(stateRoot);
    const sandboxRootPath = scopedRepoPath(sandboxRoot);
    const stateRootWithSep = `${stateRootPath}${path.sep}`;
    if (filePath !== stateRootPath && !filePath.startsWith(stateRootWithSep)) {
      throw new Error(`Refusing to write one-shot state outside shot state root: ${relativePath}`);
    }
    const dirPath = path.dirname(filePath);
    mkdirSync(dirPath, { recursive: true });
    const dirRealPath = realpathSync(dirPath);
    const stateRootRealPath = realpathSync(stateRootPath);
    const sandboxRootRealPath = realpathSync(sandboxRootPath);
    if ((dirRealPath !== stateRootRealPath && !dirRealPath.startsWith(`${stateRootRealPath}${path.sep}`))
      || (stateRootRealPath !== sandboxRootRealPath && !stateRootRealPath.startsWith(`${sandboxRootRealPath}${path.sep}`))
      || (sandboxRootRealPath !== repoRootRealPath && !sandboxRootRealPath.startsWith(`${repoRootRealPath}${path.sep}`))) {
      throw new Error(`Refusing to write one-shot state through an unsafe real path: ${relativePath}`);
    }
    const tempPath = path.join(dirPath, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  function oneShotStateJson(relativePath, stateRoot, sandboxRoot) {
    if (!oneShotPathInsideRoot(relativePath, sandboxRoot) || !oneShotPathInsideRoot(relativePath, stateRoot)) return undefined;
    return readRuntimeJson(relativePath);
  }

  function oneShotPreparePathInsideSandbox(relativePath, sandboxRoot, shotRoot) {
    return oneShotPathInsideRoot(relativePath, sandboxRoot) && oneShotPathInsideRoot(relativePath, shotRoot);
  }

  function writeOneShotPrepareJson(relativePath, payload, sandboxRoot, shotRoot) {
    if (!oneShotPreparePathInsideSandbox(relativePath, sandboxRoot, shotRoot)) {
      throw new Error(`Refusing to write one-shot prepare file outside sandbox: ${relativePath}`);
    }
    if (path.basename(relativePath) === "project.vibe" || normalizeRelativePath(relativePath).includes("/project.vibe")) {
      throw new Error(`Refusing to mutate project.vibe from one-shot prepare file: ${relativePath}`);
    }
    const filePath = scopedRepoPath(relativePath);
    const sandboxPath = scopedRepoPath(sandboxRoot);
    const shotPath = scopedRepoPath(shotRoot);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const dirRealPath = realpathSync(path.dirname(filePath));
    const sandboxRealPath = realpathSync(sandboxPath);
    const shotRealPath = realpathSync(shotPath);
    if ((dirRealPath !== sandboxRealPath && !dirRealPath.startsWith(`${sandboxRealPath}${path.sep}`))
      || (dirRealPath !== shotRealPath && !dirRealPath.startsWith(`${shotRealPath}${path.sep}`))
      || (sandboxRealPath !== repoRootRealPath && !sandboxRealPath.startsWith(`${repoRootRealPath}${path.sep}`))) {
      throw new Error(`Refusing to write one-shot prepare file through an unsafe real path: ${relativePath}`);
    }
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  function oneShotLockedReferences(workbenchFacts, shot) {
    const assets = Array.isArray(workbenchFacts.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [];
    const locked = assets.filter((asset) => asset.status === "locked");
    const shotRoleIds = new Set(Array.isArray(shot?.roleIds) ? shot.roleIds : []);
    const shotPropIds = new Set(Array.isArray(shot?.propIds) ? shot.propIds : []);
    const shotId = shot?.id;
    const sceneId = shot?.sceneId || shot?.sectionId;
    const characters = locked.filter(
      (asset) =>
        asset.type === "character" &&
        (shotRoleIds.has(asset.id) || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
    );
    const scenes = locked.filter(
      (asset) =>
        asset.type === "scene" &&
        (asset.id === sceneId || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
    );
    const props = locked.filter(
      (asset) =>
        asset.type === "prop" &&
        (shotPropIds.has(asset.id) || (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId))),
    );
    const styles = locked.filter((asset) => asset.type === "style");
    return { characters, scenes, props, styles };
  }

  function oneShotReferenceSummaries(lockedReferences) {
    return [
      ...lockedReferences.characters.map((asset) => ({ id: asset.id, type: "character", name: asset.name, path: asset.path })),
      ...lockedReferences.scenes.map((asset) => ({ id: asset.id, type: "scene", name: asset.name, path: asset.path })),
      ...lockedReferences.props.map((asset) => ({ id: asset.id, type: "prop", name: asset.name, path: asset.path })),
      ...lockedReferences.styles.map((asset) => ({ id: asset.id, type: "style", name: asset.name, path: asset.path })),
    ].filter((asset) => asset.path);
  }

  function oneShotTransportMode(input) {
    return normalizeCurrentProjectImage2TransportMode(input.transportMode);
  }

  function oneShotReceiptMatches(candidate, receipt) {
    return isRecord(candidate)
      && candidate.schemaVersion === receipt.schemaVersion
      && candidate.receiptId === receipt.receiptId
      && candidate.status === "prepared"
      && candidate.projectId === receipt.projectId
      && candidate.projectRoot === receipt.projectRoot
      && candidate.selectedShotId === receipt.selectedShotId
      && candidate.expectedOutputPath === receipt.expectedOutputPath;
  }

  function oneShotHandoffMatches(candidate, receipt) {
    return isRecord(candidate)
      && candidate.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1"
      && candidate.packetId === `handoff_${receipt.receiptId}`
      && candidate.status === "ready_for_manual_transport"
      && candidate.receiptId === receipt.receiptId
      && candidate.projectId === receipt.projectId
      && candidate.projectRoot === receipt.projectRoot
      && candidate.selectedShotId === receipt.selectedShotId
      && candidate.expectedOutputPath === receipt.expectedOutputPath;
  }

  function oneShotTransportPlan(mode, {
    projectId,
    projectRoot,
    selectedShotId,
    promptPath,
    promptText,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    handoffPacketPath,
    receiptStatePath,
    handoffStatePath,
    receiptId,
    requestedTransportMode,
    transportModeAllowed,
  }) {
    const base = {
      schemaVersion: "vibe_core_current_project_image2_one_shot_transport_plan_v1",
      mode,
      requestedTransportMode,
      transportModeAllowed,
      projectId,
      projectRoot,
      selectedShotId,
      receiptId,
      promptPath,
      promptText,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      handoffPacketPath,
      receiptStatePath,
      handoffStatePath,
      actualExecutionAllowed: false,
      providerCallAllowed: false,
      providerCalled: false,
      actualImage2Triggered: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      projectVibeWritten: false,
      requiresActionTimeConfirmation: true,
      actionTimeConfirmationRequired: true,
      forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
      outputMustReturnVia: "expected_output_and_sidecars",
    };
    if (mode === "agent_app_server") {
      return {
        ...base,
        target: "agent_app_server",
        endpoint: "/api/agent/app-server/image2/one-shot",
        requiredFields: ["projectId", "projectRoot", "receiptId", "selectedShotId", "expectedOutputPath", "providerObservationPath", "semanticQaPath", "receiptStatePath", "handoffStatePath"],
        externalCallPreparedOnly: true,
      };
    }
    if (mode === "agent_cli") {
      return {
        ...base,
        target: "agent_cli",
        commandTemplate: ["agent", "image", "one-shot", "--receipt", "<receiptStatePath>", "--handoff", "<handoffStatePath>"],
        command: "agent",
        args: ["image", "one-shot", "--receipt", receiptStatePath, "--handoff", handoffStatePath],
        cwd: repoRoot,
        externalCommandPreparedOnly: true,
      };
    }
    if (mode === "disabled") {
      return {
        ...base,
        target: "disabled",
        disabled: true,
        blockers: ["Image2 transport mode is disabled for this request."],
      };
    }
    return {
      ...base,
      target: "manual",
      manualTransportRequired: true,
    };
  }

  function inspectForRawCredentialMaterial(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return rawSecretValuePattern.test(value);
    if (typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some((item) => inspectForRawCredentialMaterial(item));
    return Object.entries(value).some(([key, child]) => {
      if (key !== "credentialRef" && secretKeyPattern.test(key)) return true;
      return inspectForRawCredentialMaterial(child);
    });
  }

  function providerSubmitPermissionExpectedOutputsMatch(selectedShotIds, expectedOutputs) {
    if (!Array.isArray(selectedShotIds) || !Array.isArray(expectedOutputs)) return false;
    if (selectedShotIds.length < 1 || selectedShotIds.length > 3) return false;
    if (new Set(selectedShotIds).size !== selectedShotIds.length) return false;
    if (expectedOutputs.length !== selectedShotIds.length) return false;
    return expectedOutputs.every((item) =>
      isRecord(item)
      && selectedShotIds.includes(item.shotId)
      && Boolean(asString(item.expectedOutputPath))
      && Boolean(asString(item.providerObservationPath))
      && Boolean(asString(item.semanticQaPath))
    );
  }

  function providerSubmitPermissionInputExpectedOutputsMatch(inputExpectedOutputs, expectedOutputs) {
    if (!Array.isArray(inputExpectedOutputs) || inputExpectedOutputs.length === 0) return true;
    if (inputExpectedOutputs.length !== expectedOutputs.length) return false;
    return inputExpectedOutputs.every((item) => {
      if (!isRecord(item)) return false;
      const expected = expectedOutputs.find((candidate) => candidate.shotId === item.shotId);
      return Boolean(expected)
        && (!item.expectedOutputPath || item.expectedOutputPath === expected.expectedOutputPath)
        && (!item.providerObservationPath || item.providerObservationPath === expected.providerObservationPath)
        && (!item.semanticQaPath || item.semanticQaPath === expected.semanticQaPath);
    });
  }

  function buildProviderSubmitPermissionReceiptState({
    generatedAt,
    receiptId,
    handoffId,
    providerId,
    providerSlot,
    requiredMode,
    selectedShotIds,
    expectedOutputs,
    credentialRef,
    maxProviderCallsPerReceipt,
    actionTimeConfirmation,
    promptPath,
    promptSha256,
    promptSnapshotPath,
    rawBody,
    rawQuery,
  }) {
    const normalizedSelectedShotIds = Array.isArray(selectedShotIds)
      ? selectedShotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];
    const normalizedExpectedOutputs = Array.isArray(expectedOutputs)
      ? expectedOutputs.map((item) => ({
        shotId: asString(item?.shotId) || "",
        expectedOutputPath: asString(item?.expectedOutputPath) || "",
        providerObservationPath: asString(item?.providerObservationPath) || "",
        semanticQaPath: asString(item?.semanticQaPath) || "",
      }))
      : [];
    const ref = asString(credentialRef) || "";
    const blockers = uniqueStrings([
      receiptId ? "" : "Submit permission receipt requires a prepare receipt id.",
      handoffId ? "" : "Submit permission receipt requires a handoff id.",
      providerId ? "" : "Submit permission receipt requires providerId.",
      providerSlot ? "" : "Submit permission receipt requires providerSlot.",
      requiredMode ? "" : "Submit permission receipt requires requiredMode.",
      normalizedSelectedShotIds.length >= 1 && normalizedSelectedShotIds.length <= 3 ? "" : "Submit permission receipt supports only 1-3 selected shots.",
      new Set(normalizedSelectedShotIds).size === normalizedSelectedShotIds.length ? "" : "Submit permission receipt selectedShotIds must be unique.",
      providerSubmitPermissionExpectedOutputsMatch(normalizedSelectedShotIds, normalizedExpectedOutputs) ? "" : "Submit permission expectedOutputs must match selectedShotIds.",
      ref ? "" : "credentialRef is required and must be an opaque reference.",
      rawSecretValuePattern.test(ref) ? "credentialRef must not contain raw credential material." : "",
      Number(maxProviderCallsPerReceipt) === 1 ? "" : "maxProviderCallsPerReceipt must equal 1.",
      inspectForRawCredentialMaterial(rawBody) || inspectForRawCredentialMaterial(rawQuery) ? "Raw credential material or credential-like keys are forbidden." : "",
    ]);
    return {
      schemaVersion: providerSubmitPermissionReceiptSchemaVersion,
      generatedAt,
      receiptId,
      handoffId,
      status: blockers.length ? "blocked" : "pending_action_time_confirmation",
      blockers,
      providerId,
      providerSlot,
      requiredMode,
      selectedShotIds: normalizedSelectedShotIds,
      expectedOutputs: normalizedExpectedOutputs,
      credential: {
        credentialRef: ref,
        authorizedReferenceOnly: true,
        secretMaterialPresent: false,
        credentialMaterialStored: false,
        credentialMaterialRead: false,
      },
      submitIntent: {
        providerId,
        providerSlot,
        requiredMode,
        maxProviderCallsPerReceipt: 1,
        providerSubmitAllowed: 0,
        providerSubmitRequestState: "pending_action_time_confirmation",
      },
      actionTimeConfirmationRequired: true,
      actionTimeConfirmation: {
        required: true,
        userConfirmedAtActionTime: false,
        confirmationReceiptId: asString(actionTimeConfirmation?.confirmationReceiptId),
        confirmationCapturedAt: asString(actionTimeConfirmation?.confirmationCapturedAt),
      },
      promptPath,
      promptSha256,
      promptSnapshotPath,
      maxProviderCallsPerReceipt: 1,
      providerCalled: false,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      projectVibeWritten: false,
      hardLocks: providerSubmitPermissionHardLocks,
      notes: [
        "This is a state-only provider submit permission receipt.",
        "Provider submit, credential material reads, external network IO, workers, and project.vibe mutation remain locked.",
      ],
    };
  }

  function currentProjectImage2OneShotResponse(action, input, extra = {}, source = currentProjectSource()) {
    const projection = projectProjectionFromSource(source);
    const { project, projectFacts } = projection;
    const workbenchFacts = currentProjectWorkbenchFacts(source, projectFacts);
    const shots = Array.isArray(workbenchFacts.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
    const selectedShotId = input.selectedShotId;
    const selectedShotIds = input.selectedShotIds || [];
    const selectedShot = shots.find((shot) => shot.id === selectedShotId);
    const shotPlans = Array.isArray(projectFacts.runManifest?.shotPlans) ? projectFacts.runManifest.shotPlans : [];
    const selectedShotPlan = shotPlans.find((shotPlan) => shotPlan?.shotId === selectedShotId) || {};
    const sandboxRoot = `${source.runRootRelativePath}/real-trigger-one-shot`;
    const shotRoot = `${sandboxRoot}/${safePathSegment(selectedShotId)}`;
    const statePaths = oneShotStatePaths(shotRoot);
    const expectedOutputPath = input.expectedOutputPath || `${shotRoot}/image2-start.png`;
    const promptPath = runtimeRelativeFromValue(selectedShotPlan.promptPath) || `${source.runRootRelativePath}/prompt_requests/${safePathSegment(selectedShotId)}_start_frame_prompt.md`;
    const promptText = promptPath && runtimePathExists(promptPath) ? readFileSync(scopedRepoPath(promptPath), "utf8") : "";
    const providerObservationPath = `${shotRoot}/provider_observations/image2-start-provider-observation.json`;
    const semanticQaPath = `${shotRoot}/semantic_qa/image2-start-semantic-qa.json`;
    const handoffPacketPath = `${shotRoot}/handoff/image2-start-handoff-packet.json`;
    const manifestPath = `${shotRoot}/manifest.json`;
    const qaReportPath = `${shotRoot}/qa/semantic-qa.json`;
    const persistedReceipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
    const persistedHandoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
    const persistedTriggerPlan = oneShotStateJson(statePaths.triggerPlanStatePath, statePaths.stateRoot, sandboxRoot);
    const persistedSubmitPermissionReceipt = oneShotStateJson(statePaths.submitPermissionReceiptStatePath, statePaths.stateRoot, sandboxRoot);
    const persistedTransportMode = asString(input.receipt?.transportMode)
      || asString(persistedReceipt?.transportMode)
      || asString(persistedHandoff?.transportPlan?.mode);
    const transport = oneShotTransportMode({
      ...input,
      transportMode: asString(input.transportMode) || persistedTransportMode,
    });
    const lockedReferences = selectedShot ? oneShotLockedReferences(workbenchFacts, selectedShot) : { characters: [], scenes: [], props: [], styles: [] };
    const shotPropIds = new Set(Array.isArray(selectedShot?.propIds) ? selectedShot.propIds : []);
    const visualReferenceInputs = oneShotReferenceSummaries(lockedReferences);
    const outputPathSafe = oneShotPathInsideRoot(expectedOutputPath, source.runRootRelativePath)
      && oneShotPathInsideRoot(expectedOutputPath, sandboxRoot);
    const sidecarPathsSafe = [
      providerObservationPath,
      semanticQaPath,
      handoffPacketPath,
      manifestPath,
      qaReportPath,
      statePaths.receiptStatePath,
      statePaths.handoffStatePath,
      statePaths.submitPermissionReceiptStatePath,
    ]
      .every((item) => oneShotPathInsideRoot(item, sandboxRoot));
    const oneShotOnly = selectedShotIds.length === 1 && selectedShotIds[0] === selectedShotId && input.imageCount === 1;
    const blockers = uniqueStrings([
      projection.ok ? "" : "Current project runtime projection is unavailable.",
      selectedShotId ? "" : "Select one shot before preparing a sample.",
      selectedShotIds.length === 1 ? "" : "Image2 one-shot requires exactly one selected shot.",
      input.imageCount === 1 ? "" : "Image2 one-shot requires exactly one image.",
      selectedShot ? "" : "Selected shot was not found in the current project story flow.",
      transport.mode === "disabled" ? "Image2 transport mode is disabled for this request." : "",
      outputPathSafe ? "" : "Expected output path must stay inside the current project one-shot sandbox.",
      sidecarPathsSafe ? "" : "Observation, QA, manifest, and handoff paths must stay inside the one-shot sandbox.",
      lockedReferences.characters.length ? "" : "Locked character reference is required for this shot.",
      lockedReferences.scenes.length ? "" : "Locked scene reference is required for this shot.",
      shotPropIds.size === 0 || lockedReferences.props.length ? "" : "Locked prop reference is required for this shot.",
      lockedReferences.styles.length ? "" : "Locked style reference is required for this shot.",
    ]);
    const receiptId = `image2_one_shot_prepare_${safePathSegment(project.projectId || "project")}_${safePathSegment(selectedShotId)}_${safePathSegment(project.runId || "run")}`;
    const transportPlan = oneShotTransportPlan(transport.mode, {
      projectId: project.projectId,
      projectRoot: project.projectRoot,
      selectedShotId,
      promptPath,
      promptText,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      handoffPacketPath,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
      receiptId,
      requestedTransportMode: transport.raw || input.requestedTransportMode,
      transportModeAllowed: transport.valid,
    });
    const receipt = {
      schemaVersion: "vibe_core_current_project_image2_one_shot_receipt_v1",
      receiptId,
      status: blockers.length ? "blocked" : "prepared",
      action: "prepare",
      generatedAt: new Date().toISOString(),
      projectId: project.projectId,
      projectRoot: project.projectRoot,
      projectVibePath: project.projectVibePath,
      selectedShotId,
      selectedShotIds,
      imageCount: input.imageCount,
      oneShotOnly,
      expectedOutputPath,
      promptPath,
      promptText,
      providerObservationPath,
      semanticQaPath,
      handoffPacketPath,
      transportMode: transport.mode,
      transportPlan,
      sandbox: {
        root: sandboxRoot,
        shotRoot,
        allowedPrefixes: [sandboxRoot, shotRoot],
        manifestPath,
        qaReportPath,
        receiptStatePath: statePaths.receiptStatePath,
        handoffStatePath: statePaths.handoffStatePath,
        triggerPlanStatePath: statePaths.triggerPlanStatePath,
        submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
        outsideRootWriteAllowed: false,
      },
      lockedReferences: {
        characters: lockedReferences.characters.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
        scenes: lockedReferences.scenes.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
        props: lockedReferences.props.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
        styles: lockedReferences.styles.map((asset) => ({ id: asset.id, name: asset.name, path: asset.path })),
      },
      visualReferenceInputs,
      qaChecklist: oneShotQaChecklist(selectedShotId),
      policy: {
        providerCalled: false,
        liveSubmitAllowed: false,
        projectVibeWritten: false,
        workerSpawnForbidden: true,
        providerSubmitAllowed: 0,
        automaticSubmitAllowed: false,
        externalNetworkIoAllowed: false,
        artifactFileMutationAllowed: false,
        statePersistenceAllowed: true,
        confirmationRequired: true,
      },
      blockers,
    };
    const receiptMatches = input.receipt
      && input.receipt.receiptId === receipt.receiptId
      && input.receipt.selectedShotId === selectedShotId
      && input.receipt.expectedOutputPath === expectedOutputPath
      && input.receipt.status === "prepared";
    const confirmBlockers = action === "confirm"
      ? uniqueStrings([
        ...blockers,
        input.receipt ? "" : "Action-time prepare receipt is required before confirmation.",
        receiptMatches ? "" : "Action-time prepare receipt must match the current project, shot, and output path.",
        oneShotOnly ? "" : "Confirmation is limited to one shot and one image.",
      ])
      : blockers;
    const confirmed = action === "confirm" && confirmBlockers.length === 0;
    const outputExists = runtimePathExists(expectedOutputPath);
    const outputSha256 = outputExists ? sha256File(scopedRepoPath(expectedOutputPath)) : undefined;
    const providerObservation = readRuntimeJson(providerObservationPath);
    const semanticQa = readRuntimeJson(semanticQaPath);
    const semantic = semanticQaSummary(semanticQa);
    const persistedReceiptUsable = action === "status"
      && oneShotReceiptMatches(persistedReceipt, receipt);
    const persistedHandoffUsable = action === "status"
      && persistedReceiptUsable
      && oneShotHandoffMatches(persistedHandoff, receipt)
      && persistedHandoff.providerCalled === false
      && persistedHandoff.liveSubmitAllowed === false;
    const persistedTriggerPlanUsable = action === "status"
      && persistedHandoffUsable
      && isRecord(persistedTriggerPlan)
      && persistedTriggerPlan.status === "trigger_plan_prepared"
      && persistedTriggerPlan.receiptId === receipt.receiptId
      && persistedTriggerPlan.handoffId === `handoff_${receipt.receiptId}`
      && persistedTriggerPlan.providerCalled === false
      && persistedTriggerPlan.actualImage2Triggered === false;
    const handoffPacket = {
      packetId: `handoff_${receipt.receiptId}`,
      schemaVersion: "vibe_core_current_project_image2_one_shot_handoff_packet_v1",
      receiptId: receipt.receiptId,
      projectId: project.projectId,
      projectRoot: project.projectRoot,
      selectedShotId,
      selectedShotIds,
      imageCount: input.imageCount,
      status: "ready_for_manual_transport",
      createdAt: new Date().toISOString(),
      requiresExternalAction: true,
      providerCalled: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
      projectVibeWritten: false,
      expectedOutputPath,
      promptPath,
      promptText,
      visualReferenceInputs,
      providerObservationPath,
      semanticQaPath,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
      transportPlan,
      appServerContract: {
        mode: "agent_app_server_handoff_only",
        selectedShotId,
        expectedOutputPath,
        promptPath,
        visualReferenceInputs,
        providerObservationPath,
        semanticQaPath,
        qaChecklistPath: qaReportPath,
        manualTransportRequired: true,
        automaticSubmitAllowed: false,
        actualExecutionAllowed: false,
      },
    };
    if (action === "prepare" && confirmBlockers.length === 0) {
      writeOneShotStateJson(statePaths.receiptStatePath, receipt, statePaths.stateRoot, sandboxRoot);
    }
    if (confirmed) {
      writeOneShotStateJson(statePaths.receiptStatePath, receipt, statePaths.stateRoot, sandboxRoot);
      writeOneShotStateJson(statePaths.handoffStatePath, handoffPacket, statePaths.stateRoot, sandboxRoot);
    }
    const receiptForResponse = persistedReceiptUsable ? persistedReceipt : receipt;
    const handoffForResponse = confirmed ? handoffPacket : persistedHandoffUsable ? persistedHandoff : undefined;
    const providerObservationContext = {
      selectedShotId,
      receiptId: receiptForResponse?.receiptId || receipt.receiptId,
      handoffPacketId: handoffForResponse?.packetId || `handoff_${receipt.receiptId}`,
    };
    const hashBoundActual = Boolean(
      outputSha256
        && outputExists
        && actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, providerObservationContext)
        && actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256),
    );
    const providerObservationMode = hashBoundActual ? providerObservation?.providerObservationMode || "actual_provider_call_observed" : "not_observed";
    const semanticQaStatus = hashBoundActual ? semanticQa?.status || semanticQa?.qaStatus || semanticQa?.finalAssessment?.status || "needs_review" : "not_written";
    const returnSource = hashBoundActual ? "actual_provider_return_ingest" : "dry_run_projection_only";
    const formalPromotionBlockedReasons = hashBoundActual
      ? ["Formal promotion remains blocked until human QA approval after hash-bound provider return."]
      : [];
    const status = confirmBlockers.length
      ? "blocked"
      : outputExists && (semantic.passed || semantic.needsReview || semantic.present)
        ? "needs_review"
        : persistedTriggerPlanUsable
          ? "trigger_plan_prepared"
        : handoffForResponse
          ? "handoff_prepared"
          : action === "prepare" || persistedReceiptUsable
            ? "prepared"
            : "ready_to_prepare";
    const userLabel = status === "prepared"
      ? "确认 handoff"
      : status === "trigger_plan_prepared"
        ? "等待回流"
      : status === "handoff_prepared"
        ? "等待文件"
        : status === "needs_review"
          ? "需要复核"
          : status === "blocked"
            ? "待补齐"
            : "准备小样包";

    return {
      ok: confirmBlockers.length === 0,
      ...runtimePolicy({
        runMode: "current_project_image2_one_shot_handoff_only",
        providerCalled: false,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
      }),
      endpoint: action === "confirm"
        ? currentProjectImage2OneShotConfirmEndpoint
        : action === "prepare"
          ? currentProjectImage2OneShotPrepareEndpoint
          : currentProjectImage2OneShotStatusEndpoint,
      source: "runtime_endpoint",
      sourceLabel: source.sourceLabel,
      projectionKind: "current_project_image2_one_shot",
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
        selectedShotId,
      },
      projectRootMode: source.projectRootMode,
      projectRoot: project.projectRoot,
      projectId: project.projectId,
      identity: {
        projectId: project.projectId,
        projectRoot: project.projectRoot,
      },
      project,
      status,
      uiStatus: status,
      userLabel,
      providerRequestId: providerObservation?.providerRequestId,
      outputSha256,
      hashBoundActual,
      providerObservationMode,
      semanticQaStatus,
      returnSource,
      formalPromotionBlocked: hashBoundActual,
      formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
      formalPromotionBlockedReasons,
      selectedShotId,
      selectedShotIds,
      expectedOutputPath,
      promptPath,
      promptText,
      providerObservationPath,
      semanticQaPath,
      handoffPacketPath,
      statePaths,
      submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
      receipt: receiptForResponse,
      handoffPacket: handoffForResponse,
      submitPermissionReceipt: isRecord(persistedSubmitPermissionReceipt) ? persistedSubmitPermissionReceipt : undefined,
      transportPlan,
      persistedState: {
        receiptPresent: persistedReceiptUsable || (action === "prepare" && confirmBlockers.length === 0) || confirmed,
        handoffPresent: persistedHandoffUsable || confirmed,
        triggerPlanPresent: persistedTriggerPlanUsable,
        submitPermissionReceiptPresent: isRecord(persistedSubmitPermissionReceipt)
          && persistedSubmitPermissionReceipt.receiptId === receipt.receiptId
          && persistedSubmitPermissionReceipt.handoffId === `handoff_${receipt.receiptId}`,
        receiptStatePath: statePaths.receiptStatePath,
        handoffStatePath: statePaths.handoffStatePath,
        triggerPlanStatePath: statePaths.triggerPlanStatePath,
        submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
      },
      watcherProjection: {
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
        outputExists,
        providerObservationPresent: runtimePathExists(providerObservationPath),
        semanticQaPresent: Boolean(semanticQa),
        semanticQaPassed: semantic.passed,
        providerRequestId: providerObservation?.providerRequestId,
        outputSha256,
        hashBoundActual,
        providerObservationMode,
        semanticQaStatus,
        returnSource,
        formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
        formalPromotionBlockedReasons,
        watcherStarted: false,
        daemonStarted: false,
        reportProjectionOnly: true,
      },
      previewProjection: {
        shotId: selectedShotId,
        status: outputExists ? (semantic.needsReview ? "needs_review" : "returned") : persistedTriggerPlanUsable ? "waiting_action_time_confirmation" : handoffForResponse ? "waiting_file" : "not_started",
        imageUrl: outputExists ? runtimeFileUrl(expectedOutputPath) : undefined,
        reviewRequired: semantic.needsReview,
      },
      submitPolicy: {
        providerCallAllowed: false,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        manualTransportRequired: true,
        dryRunOnly: true,
        noWorkerSpawn: true,
        artifactFileMutationAllowed: false,
        statePersistenceAllowed: true,
      },
      providerCallAllowed: false,
      actualExecutionAllowed: false,
      actionTimeConfirmationRequired: true,
      providerCalled: false,
      actualImage2Triggered: hashBoundActual,
      providerReturnIngested: hashBoundActual,
      externalProviderCallObserved: hashBoundActual,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers: confirmBlockers,
      message: confirmBlockers.length ? "小样暂时受阻，请补齐镜头、引用或输出位置。" : undefined,
      ...extra,
    };
  }

  function currentProjectImage2OneShotPrepareTriggerResponse(input, extra = {}, source = currentProjectSource()) {
    const generatedAt = new Date().toISOString();
    const statusProjection = currentProjectImage2OneShotResponse("status", {
      selectedShotId: input.selectedShotId,
      selectedShotIds: input.selectedShotIds,
      imageCount: input.imageCount,
      transportMode: input.transportMode,
    }, {}, source);
    const statePaths = statusProjection.statePaths || {};
    const sandboxRoot = statusProjection.receipt?.sandbox?.root;
    const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
    const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
    const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
    const promptPath = handoff?.promptPath || receipt?.promptPath || statusProjection.promptPath;
    const promptText = handoff?.promptText || receipt?.promptText || statusProjection.promptText || "";
    const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
    const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
    const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
    const triggerPlanPath = `${shotRoot}/trigger-plan/image2-start-trigger-plan.json`;
    const handoffId = handoff?.packetId || (receipt?.receiptId ? `handoff_${receipt.receiptId}` : undefined);
    const transportPlan = buildCurrentProjectImage2TransportPlan({
      generatedAt,
      cwd: repoRoot,
      transportMode: input.transportMode || handoff?.transportPlan?.mode || receipt?.transportMode || "manual",
      requestedTransportMode: input.requestedTransportMode,
      selectedShotId: handoff?.selectedShotId || receipt?.selectedShotId || input.selectedShotId,
      selectedShotIds: handoff?.selectedShotIds || receipt?.selectedShotIds || input.selectedShotIds,
      receiptId: receipt?.receiptId || input.receiptId,
      handoffId,
      promptPath,
      promptText,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      triggerPlanPath,
      receiptStatePath: statePaths.receiptStatePath,
      handoffStatePath: statePaths.handoffStatePath,
    });
    const projection = projectProjectionFromSource(source);
    const shotPlans = Array.isArray(projection.projectFacts?.runManifest?.shotPlans) ? projection.projectFacts.runManifest.shotPlans : [];
    const selectedShotPlan = shotPlans.find((shotPlan) => shotPlan?.shotId === transportPlan.selectedShotId) || {};
    const providerId = asString(selectedShotPlan.providerId) || "openai-image2-api";
    const providerSlot = asString(selectedShotPlan.providerSlot) || "image.generate";
    const requiredMode = asString(selectedShotPlan.requiredMode) || "text2image";
    const expectedOutputs = [
      {
        shotId: transportPlan.selectedShotId,
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
      },
    ];
    const promptSha256 = promptPath && runtimePathExists(promptPath) ? sha256File(scopedRepoPath(promptPath)) : undefined;
    const pathSafe = oneShotPreparePathInsideSandbox(triggerPlanPath, sandboxRoot, shotRoot);
    const rawCredentialMaterialPresent = inspectForRawCredentialMaterial(input.rawBody) || inspectForRawCredentialMaterial(input.rawQuery);
    const submitPermissionReceiptRequested = input.submitPermissionReceiptRequired === true
      || input.credentialRefProvided === true
      || Boolean(input.credentialRef);
    const blockers = uniqueStrings([
      isRecord(receipt) ? "" : "Persisted prepare receipt is required before trigger-plan.",
      isRecord(handoff) ? "" : "Persisted handoff packet is required before trigger-plan.",
      handoff?.status === "ready_for_manual_transport" ? "" : "Handoff must be ready_for_manual_transport before trigger-plan.",
      receipt?.status === "prepared" ? "" : "Prepare receipt must be status=prepared before trigger-plan.",
      pathSafe ? "" : "Trigger plan path must stay inside the one-shot sandbox.",
      transportPlan.transportModeAllowed ? "" : "Transport mode must be manual, agent_app_server, agent_cli, or disabled.",
      transportPlan.transportMode === "disabled" ? "Image2 transport mode is disabled for this request." : "",
      promptPath && promptText ? "" : "Prompt path and prompt text are required before trigger-plan.",
      rawCredentialMaterialPresent ? "Raw credential material or credential-like keys are forbidden." : "",
      submitPermissionReceiptRequested && !providerSubmitPermissionInputExpectedOutputsMatch(input.expectedOutputs, expectedOutputs) ? "Request expectedOutputs must match the prepared one-shot output paths." : "",
    ]);
    const submitPermissionReceipt = buildProviderSubmitPermissionReceiptState({
      generatedAt,
      receiptId: transportPlan.receiptId,
      handoffId: transportPlan.handoffId,
      providerId,
      providerSlot,
      requiredMode,
      selectedShotIds: transportPlan.selectedShotIds,
      expectedOutputs,
      credentialRef: input.credentialRef,
      maxProviderCallsPerReceipt: input.maxProviderCallsPerReceipt,
      actionTimeConfirmation: input.actionTimeConfirmation,
      promptPath,
      promptSha256,
      promptSnapshotPath: promptPath,
      rawBody: input.rawBody,
      rawQuery: input.rawQuery,
    });
    const submitPermissionReceiptBlockers = submitPermissionReceiptRequested ? submitPermissionReceipt.blockers : [];
    const submitPermissionReceiptReady = submitPermissionReceiptRequested
      && submitPermissionReceiptBlockers.length === 0
      && submitPermissionReceipt.status === "pending_action_time_confirmation";
    const prepareTriggerBlockers = uniqueStrings([...blockers, ...submitPermissionReceiptBlockers]);
    const triggerManifest = {
      schemaVersion: "vibe_core_current_project_image2_one_shot_trigger_plan_v1",
      generatedAt,
      status: prepareTriggerBlockers.length ? "blocked" : "trigger_plan_prepared",
      selectedShotId: transportPlan.selectedShotId,
      selectedShotIds: transportPlan.selectedShotIds,
      receiptId: transportPlan.receiptId,
      handoffId: transportPlan.handoffId,
      providerId,
      providerSlot,
      requiredMode,
      promptPath,
      promptSha256,
      promptText,
      expectedOutputPath,
      expectedOutputs,
      providerObservationPath,
      semanticQaPath,
      submitPermissionReceiptRequested,
      submitPermissionReceipt: submitPermissionReceiptRequested ? submitPermissionReceipt : undefined,
      submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
      submitPermissionReceiptPresent: false,
      forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
      providerCallAllowed: false,
      actualExecutionAllowed: false,
      actionTimeConfirmationRequired: true,
      providerSubmitAllowed: 0,
      transportPlan,
      instruction: transportPlan.clearInstruction,
      returnExecutorInstruction: transportPlan.returnExecutorInstruction,
      providerCalled: false,
      actualImage2Triggered: false,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers: prepareTriggerBlockers,
    };

    let writeError;
    if (prepareTriggerBlockers.length === 0) {
      try {
        triggerManifest.submitPermissionReceiptPresent = submitPermissionReceiptReady;
        writeOneShotPrepareJson(triggerPlanPath, triggerManifest, sandboxRoot, shotRoot);
        writeOneShotStateJson(statePaths.triggerPlanStatePath, triggerManifest, statePaths.stateRoot, sandboxRoot);
        if (submitPermissionReceiptReady) {
          writeOneShotStateJson(statePaths.submitPermissionReceiptStatePath, submitPermissionReceipt, statePaths.stateRoot, sandboxRoot);
        }
      } catch (error) {
        writeError = error instanceof Error ? error.message : "Trigger plan write failed.";
      }
    }
    const finalBlockers = uniqueStrings([...prepareTriggerBlockers, writeError]);
    const ok = finalBlockers.length === 0;

    return {
      ok,
      ...runtimePolicy({
        runMode: "current_project_image2_one_shot_prepare_trigger_plan",
        providerCalled: false,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: true,
      }),
      endpoint: currentProjectImage2OneShotPrepareTriggerEndpoint,
      source: "runtime_endpoint",
      sourceLabel: source.sourceLabel,
      projectionKind: "current_project_image2_one_shot_trigger_plan",
      currentProject: statusProjection.currentProject,
      requestContext: {
        ...statusProjection.requestContext,
        selectedShotId: input.selectedShotId,
        receiptId: input.receiptId || receipt?.receiptId,
      },
      projectRootMode: source.projectRootMode,
      projectRoot: statusProjection.projectRoot,
      projectId: statusProjection.projectId,
      project: statusProjection.project,
      status: ok ? "trigger_plan_prepared" : "blocked",
      uiStatus: ok ? "trigger_plan_prepared" : "blocked",
      userLabel: ok ? "等待回流" : "待补齐",
      selectedShotId: transportPlan.selectedShotId,
      selectedShotIds: transportPlan.selectedShotIds,
      receiptId: transportPlan.receiptId,
      handoffId: transportPlan.handoffId,
      promptPath,
      promptSha256,
      promptText,
      expectedOutputPath,
      expectedOutputs,
      providerObservationPath,
      semanticQaPath,
      triggerPlanPath,
      submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
      forbiddenProviders: [...currentProjectImage2ForbiddenProviders],
      statePaths,
      receipt,
      handoffPacket: handoff,
      submitPermissionReceiptRequested,
      submitPermissionReceipt: submitPermissionReceiptRequested ? submitPermissionReceipt : undefined,
      triggerManifest,
      transportPlan,
      commandPreview: transportPlan.commandPreview,
      appServerPayloadPreview: transportPlan.appServerPayloadPreview,
      persistedState: {
        receiptPresent: isRecord(receipt),
        handoffPresent: isRecord(handoff),
        triggerPlanPresent: ok && runtimePathExists(triggerPlanPath),
        submitPermissionReceiptPresent: ok && submitPermissionReceiptReady && runtimePathExists(statePaths.submitPermissionReceiptStatePath),
        receiptStatePath: statePaths.receiptStatePath,
        handoffStatePath: statePaths.handoffStatePath,
        triggerPlanStatePath: statePaths.triggerPlanStatePath,
        submitPermissionReceiptStatePath: statePaths.submitPermissionReceiptStatePath,
      },
      watcherProjection: {
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
        outputExists: runtimePathExists(expectedOutputPath),
        providerObservationPresent: runtimePathExists(providerObservationPath),
        semanticQaPresent: runtimePathExists(semanticQaPath),
        watcherStarted: false,
        daemonStarted: false,
        reportProjectionOnly: true,
      },
      previewProjection: {
        shotId: transportPlan.selectedShotId,
        status: ok ? "waiting_action_time_confirmation" : "blocked",
        reviewRequired: false,
        providerCalled: false,
        actualImage2Triggered: false,
      },
      submitPolicy: {
        providerCallAllowed: false,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        realProviderCallAllowed: false,
        manualTransportRequired: true,
        actionTimeConfirmationRequired: true,
        providerSubmitRequestState: "pending_action_time_confirmation",
        dryRunOnly: true,
        noWorkerSpawn: true,
        projectVibeMutationAllowed: false,
        statePersistenceAllowed: true,
      },
      providerCallAllowed: false,
      actualExecutionAllowed: false,
      actionTimeConfirmationRequired: true,
      providerCalled: false,
      actualImage2Triggered: false,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers: finalBlockers,
      message: ok ? "外部 Image2 执行 handoff 已准备，等待回流确认；本 endpoint 未执行 provider。" : "外部 Image2 执行 handoff 暂时受阻。",
      ...extra,
    };
  }

  return {
    oneShotRequestInput,
    oneShotPathInsideRoot,
    oneShotStatePaths,
    oneShotStateJson,
    writeOneShotStateJson,
    oneShotTransportPlan,
    oneShotLockedReferences,
    inspectForRawCredentialMaterial,
    buildProviderSubmitPermissionReceiptState,
    currentProjectImage2OneShotResponse,
    currentProjectImage2OneShotPrepareTriggerResponse,
  };
}
