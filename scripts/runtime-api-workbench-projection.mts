import path from "node:path";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length))];
}

function derivedShotPath(source, shotId, folder, suffix, ext) {
  return `${source.runRootRelativePath}/${folder}/${shotId}${suffix}.${ext}`;
}

export function createRuntimeApiWorkbenchProjection({
  repoRoot,
  round5FullRealChainReportFileName,
  existsSync,
  realpathSync,
  pathWithinRoot,
  isPathInsideRealRoot,
  repoRelativePath,
  normalizeRelativePath,
  runtimeRelativeFromValue,
  runtimePathExists,
  runtimeFileUrl,
  scopedRepoPath,
  readJsonIfPresent,
  projectIdentityFromSource,
}) {
  if (!repoRoot) throw new Error("createRuntimeApiWorkbenchProjection requires repoRoot");
  if (typeof existsSync !== "function") throw new Error("createRuntimeApiWorkbenchProjection requires existsSync");
  if (typeof readJsonIfPresent !== "function") throw new Error("createRuntimeApiWorkbenchProjection requires readJsonIfPresent");

  function readRuntimeJson(relativePath) {
    if (!relativePath) return undefined;
    try {
      return readJsonIfPresent(scopedRepoPath(relativePath));
    } catch {
      return undefined;
    }
  }

  function projectRuntimePathCandidates(source, value) {
    if (typeof value !== "string" || !value.trim()) return [];
    const normalized = normalizeRelativePath(value.trim());
    const candidates = [];
    if (path.isAbsolute(normalized)) {
      candidates.push(path.resolve(normalized));
    } else {
      candidates.push(path.resolve(source.runRootPath, normalized));
      try {
        candidates.push(scopedRepoPath(normalized));
      } catch {
        // Some current-project media paths are intentionally relative to the
        // selected project root, not to the packaged app workspace.
      }
    }
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = path.resolve(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return pathWithinRoot(key, source.runRootPath);
    });
  }

  function projectRuntimePathExists(source, value) {
    return projectRuntimePathCandidates(source, value).some((candidate) => existsSync(candidate));
  }

  function projectFact(name, filePath, usedFor = []) {
    const relativePath = repoRelativePath(filePath);
    const present = existsSync(filePath);
    const parsed = present ? readJsonIfPresent(filePath) : undefined;
    return {
      name,
      path: relativePath,
      present,
      readable: parsed !== undefined,
      usedFor,
      parsed,
    };
  }

  function projectFactRefPath(entry) {
    if (!isRecord(entry)) return undefined;
    if (typeof entry.path === "string") return entry.path;
    if (isRecord(entry.path) && typeof entry.path.path === "string") return entry.path.path;
    return undefined;
  }

  function projectVibeDeclaredFactRefs(projectVibe, role) {
    if (!isRecord(projectVibe)) return [];
    const refs = [];
    const collectFactFiles = (items, declaredBy) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!isRecord(item) || item.role !== role) continue;
        const refPath = projectFactRefPath(item);
        if (refPath) refs.push({ refPath, declaredBy, sourceOfTruth: item.sourceOfTruth });
      }
    };
    collectFactFiles(projectVibe.factFiles, "project_vibe.factFiles");
    collectFactFiles(projectVibe.projectStoreSnapshot?.factFiles, "project_vibe.projectStoreSnapshot.factFiles");

    if (role === "story_flow") {
      for (const key of ["storyFlowPath", "story_flow_path", "storyFlowRef", "story_flow_ref"]) {
        if (typeof projectVibe[key] === "string") {
          refs.push({ refPath: projectVibe[key], declaredBy: `project_vibe.${key}`, sourceOfTruth: "project_file" });
        }
      }
    }

    const seen = new Set();
    return refs.filter((ref) => {
      const key = `${ref.declaredBy}:${ref.refPath}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function safeProjectFactRefPath(refPath) {
    if (typeof refPath !== "string" || !refPath.trim()) return undefined;
    const normalized = normalizeRelativePath(refPath.trim()).replace(/^\.\//, "");
    if (
      path.isAbsolute(normalized)
      || normalized === ".."
      || normalized.startsWith("../")
      || normalized.includes("/../")
    ) {
      return undefined;
    }
    return normalized;
  }

  function projectFactRefCandidates(source, refPath) {
    const normalized = safeProjectFactRefPath(refPath);
    if (!normalized) return [];
    const projectVibeDir = path.dirname(source.projectVibePath);
    const candidates = [];
    if (normalized === source.runRootRelativePath || normalized.startsWith(`${source.runRootRelativePath}/`)) {
      candidates.push(path.resolve(repoRoot, normalized));
    }
    candidates.push(path.resolve(projectVibeDir, normalized));
    candidates.push(path.resolve(source.runRootPath, normalized));
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = path.resolve(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return pathWithinRoot(key, source.runRootPath);
    });
  }

  function withProjectFactSourceMetadata(fact, metadata) {
    return {
      ...fact,
      sourceOfTruth: "project_file",
      factSourceRole: metadata.factSourceRole,
      sourceRole: metadata.sourceRole,
      declaredBy: metadata.declaredBy,
      declaredRefPath: metadata.declaredRefPath,
      compatibilityFallbackUsed: metadata.compatibilityFallbackUsed === true,
      runtimeStateRole: "derived_cache",
      runtimeStateUsed: false,
      runtimeStateMayOverride: false,
    };
  }

  function resolveCurrentProjectStoryFlowFact(source, projectVibe) {
    const declaredRefs = projectVibeDeclaredFactRefs(projectVibe, "story_flow");
    for (const declaredRef of declaredRefs) {
      const candidates = projectFactRefCandidates(source, declaredRef.refPath);
      for (const candidate of candidates) {
        if (!existsSync(candidate)) continue;
        try {
          const runRootRealPath = realpathSync(source.runRootPath);
          const candidateRealPath = realpathSync(candidate);
          if (!isPathInsideRealRoot(candidateRealPath, runRootRealPath)) continue;
        } catch {
          continue;
        }
        return withProjectFactSourceMetadata(projectFact("story_flow", candidate, ["story_flow"]), {
          factSourceRole: "project_vibe_declared_story_flow",
          sourceRole: "canonical_project_store_sidecar",
          declaredBy: declaredRef.declaredBy,
          declaredRefPath: safeProjectFactRefPath(declaredRef.refPath),
          compatibilityFallbackUsed: false,
        });
      }
    }

    return withProjectFactSourceMetadata(projectFact("story_flow", source.storyFlowPath, ["story_flow"]), {
      factSourceRole: "legacy_project_story_flow_json",
      sourceRole: "compatibility_fallback",
      declaredBy: declaredRefs.length ? declaredRefs.map((ref) => ref.declaredBy).join("+") : undefined,
      declaredRefPath: declaredRefs.length ? declaredRefs.map((ref) => safeProjectFactRefPath(ref.refPath)).filter(Boolean).join(",") : undefined,
      compatibilityFallbackUsed: true,
    });
  }

  function readProjectFacts(source) {
    const reportFactName = source.reportRelativePath.endsWith(`/reports/${round5FullRealChainReportFileName}`)
      ? "round5_full_real_chain_report"
      : "image2_start_long_chain_report";
    const projectVibeFact = projectFact("project_vibe", source.projectVibePath, ["identity"]);
    const storyFlowFact = resolveCurrentProjectStoryFlowFact(source, projectVibeFact.parsed);
    const facts = [
      projectVibeFact,
      projectFact("source_index", source.sourceIndexPath, ["project_facts"]),
      storyFlowFact,
      projectFact("visual_memory", source.visualMemoryPath, ["visual_memory"]),
      projectFact("run_manifest", source.runManifestPath, ["ledger_plan", "identity"]),
      projectFact("runtime_truth_layer", source.runtimeTruthLayerPath, ["ledger_truth", "status"]),
      projectFact("preview_plan", source.previewPlanPath, ["preview", "status"]),
      projectFact(reportFactName, source.reportPath, ["compatibility_fallback"]),
    ];
    const byName = Object.fromEntries(facts.map((fact) => [fact.name, fact]));
    const factsUsed = facts
      .filter((fact) => fact.readable)
      .map(({ name, path: factPath, usedFor }) => ({ name, path: factPath, usedFor }));
    const runtimeTruthLayer = byName.runtime_truth_layer.parsed;
    const previewPlan = byName.preview_plan.parsed;
    const image2Report = byName.image2_start_long_chain_report?.parsed || byName.round5_full_real_chain_report?.parsed;
    const round5Report = byName.round5_full_real_chain_report?.parsed;
    const projectVibeStoryFlow = isRecord(byName.project_vibe.parsed?.storyFlow)
      ? {
          ...byName.project_vibe.parsed.storyFlow,
          shots: Array.isArray(byName.project_vibe.parsed?.shots) ? byName.project_vibe.parsed.shots : [],
        }
      : undefined;
    const projectVibeVisualMemory = isRecord(byName.project_vibe.parsed?.visualMemory)
      ? byName.project_vibe.parsed.visualMemory
      : undefined;
    const projectionParts = [
      runtimeTruthLayer ? "runtime_truth_layer" : undefined,
      previewPlan ? "preview_plan" : undefined,
    ].filter(Boolean);
    return {
      facts,
      factsUsed,
      projectVibe: byName.project_vibe.parsed,
      sourceIndex: byName.source_index.parsed,
      storyFlow: byName.story_flow.parsed || projectVibeStoryFlow,
      storyFlowSource: {
        path: byName.story_flow.path,
        present: byName.story_flow.present,
        readable: byName.story_flow.readable,
        sourceOfTruth: byName.story_flow.sourceOfTruth,
        factSourceRole: byName.story_flow.factSourceRole,
        sourceRole: byName.story_flow.sourceRole,
        declaredBy: byName.story_flow.declaredBy,
        declaredRefPath: byName.story_flow.declaredRefPath,
        compatibilityFallbackUsed: byName.story_flow.compatibilityFallbackUsed,
        runtimeStateRole: byName.story_flow.runtimeStateRole,
        runtimeStateUsed: byName.story_flow.runtimeStateUsed,
        runtimeStateMayOverride: byName.story_flow.runtimeStateMayOverride,
      },
      visualMemory: byName.visual_memory.parsed || projectVibeVisualMemory,
      runManifest: byName.run_manifest.parsed,
      runtimeTruthLayer,
      previewPlan,
      image2Report,
      projectionSource: projectionParts.length
        ? projectionParts.join("+")
        : round5Report
          ? "round5_full_real_chain_report_fallback"
          : image2Report
          ? "image2_start_long_chain_report_fallback"
          : "unavailable",
      ledgerTruthSource: runtimeTruthLayer
        ? "runtime_truth_layer"
        : previewPlan
          ? "preview_plan"
          : round5Report
            ? "round5_full_real_chain_report_fallback"
          : image2Report
            ? "image2_start_long_chain_report_fallback"
            : "unavailable",
      primaryReportRelativePath: runtimeTruthLayer
        ? source.runtimeTruthLayerRelativePath
        : previewPlan
          ? source.previewPlanRelativePath
          : image2Report
            ? source.reportRelativePath
            : source.reportRelativePath,
      projectionAvailable: Boolean(runtimeTruthLayer || previewPlan || image2Report || byName.run_manifest.parsed),
    };
  }

  function byShotId(items) {
    const map = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item?.shotId === "string" && item.shotId) map.set(item.shotId, item);
    }
    return map;
  }

  function orderedShotIds(...itemLists) {
    const ids = [];
    const seen = new Set();
    for (const items of itemLists) {
      for (const item of Array.isArray(items) ? items : []) {
        const shotId = typeof item?.shotId === "string" ? item.shotId : undefined;
        if (!shotId || seen.has(shotId)) continue;
        seen.add(shotId);
        ids.push(shotId);
      }
    }
    return ids;
  }

  function mergeBlockers(...blockerLists) {
    return uniqueStrings(blockerLists.flatMap((blockers) => Array.isArray(blockers) ? blockers : []));
  }

  function providerObservationActual(providerObservation, expectedOutputPath) {
    if (!providerObservation) return false;
    const provider = String(providerObservation.provider || providerObservation.providerId || "");
    const outputPath = runtimeRelativeFromValue(providerObservation.outputPath);
    return providerObservation.providerObservationMode === "actual_provider_call_observed"
      && /image2/i.test(provider)
      && (!expectedOutputPath || outputPath === expectedOutputPath);
  }

  function semanticQaSummary(semanticQa) {
    if (!semanticQa) {
      return {
        present: false,
        actual: false,
        status: "missing",
        passed: false,
        needsReview: false,
      };
    }
    const status = semanticQa.finalAssessment?.status || semanticQa.status || "unknown";
    const actual = semanticQa.semanticReviewMode === "actual_image_semantic_review";
    const mockReview = semanticQa.semanticReviewMode === "mock_executor_semantic_review";
    return {
      present: true,
      actual,
      mockReview,
      status,
      passed: actual && status === "pass",
      needsReview: (actual || mockReview) && status === "needs_review",
    };
  }

  function projectObservationItems(source, projectFacts) {
    const manifestShotPlans = Array.isArray(projectFacts.runManifest?.shotPlans) ? projectFacts.runManifest.shotPlans : [];
    const previewClips = Array.isArray(projectFacts.previewPlan?.clips) ? projectFacts.previewPlan.clips : [];
    const truthItems = Array.isArray(projectFacts.runtimeTruthLayer?.items) ? projectFacts.runtimeTruthLayer.items : [];
    const reportObservations = Array.isArray(projectFacts.image2Report?.observations) ? projectFacts.image2Report.observations : [];
    const shotPlanById = byShotId(manifestShotPlans);
    const previewById = byShotId(previewClips);
    const truthById = byShotId(truthItems);
    const reportById = byShotId(reportObservations);
    const reviewOverlayShots = new Set([
      ...(Array.isArray(projectFacts.previewPlan?.reviewOverlayShots) ? projectFacts.previewPlan.reviewOverlayShots : []),
      ...(Array.isArray(projectFacts.image2Report?.reviewOverlayShots) ? projectFacts.image2Report.reviewOverlayShots : []),
      ...(Array.isArray(projectFacts.image2Report?.productionNeedsReviewShots) ? projectFacts.image2Report.productionNeedsReviewShots : []),
    ]);

    return orderedShotIds(manifestShotPlans, previewClips, truthItems, reportObservations).map((shotId, index) => {
      const shotPlan = shotPlanById.get(shotId) || {};
      const previewClip = previewById.get(shotId) || {};
      const truthItem = truthById.get(shotId) || {};
      const reportObservation = reportById.get(shotId) || {};
      const previewMediaType = String(previewClip.mediaType || previewClip.type || "").toLowerCase();
      const previewIsVideo = previewMediaType.includes("video") || Boolean(previewClip.submitId || previewClip.submit_id || previewClip.videoStatus);
      const firstLocalMediaPath = Array.isArray(previewClip.localMediaPaths) ? previewClip.localMediaPaths.find((item) => typeof item === "string" && item.trim()) : undefined;
      const expectedOutputPath = runtimeRelativeFromValue(previewClip.mediaPath)
        || runtimeRelativeFromValue(previewClip.outputVideoPath)
        || runtimeRelativeFromValue(firstLocalMediaPath)
        || (!previewIsVideo
          ? runtimeRelativeFromValue(shotPlan.expectedOutputPath)
            || runtimeRelativeFromValue(reportObservation.expectedOutputPath)
            || `${source.runRootRelativePath}/outputs/shots/${shotId}/start.png`
          : undefined);
      const providerObservationPath = runtimeRelativeFromValue(truthItem.providerObservationPath)
        || runtimeRelativeFromValue(reportObservation.providerObservationPath)
        || runtimeRelativeFromValue(shotPlan.providerObservationPath)
        || derivedShotPath(source, shotId, "provider_observations", "_start_provider_observation", "json");
      const semanticQaPath = runtimeRelativeFromValue(truthItem.semanticQaPath)
        || runtimeRelativeFromValue(reportObservation.semanticQaPath)
        || runtimeRelativeFromValue(shotPlan.semanticQaPath)
        || derivedShotPath(source, shotId, "semantic_qa", "_start_semantic_qa", "json");
      const providerObservation = readRuntimeJson(providerObservationPath);
      const semanticQa = readRuntimeJson(semanticQaPath);
      const semantic = semanticQaSummary(semanticQa);
      const providerOutputSha256 = providerObservation?.outputSha256 || providerObservation?.outputHash;
      const outputExists = projectRuntimePathExists(source, expectedOutputPath) || runtimePathExists(expectedOutputPath);
      const providerActual = providerObservationActual(providerObservation, expectedOutputPath);
      const previewStatus = previewClip.status || previewClip.videoStatus || reportObservation.previewQaStatus || (outputExists ? "returned" : previewIsVideo ? "queued" : "missing");
      const reviewOverlay = reviewOverlayShots.has(shotId) || previewStatus === "returned_with_review_overlay" || reportObservation.reviewOverlay === true || semantic.needsReview;
      const blockers = mergeBlockers(
        truthItem.blockers,
        truthItem.runtimeTruthBlockers,
        reportObservation.blockers,
        reportObservation.runtimeTruthBlockers,
        previewStatus === "blocked" ? [`${shotId}: preview plan blocked`] : [],
        semantic.present && !semantic.actual ? [`${shotId}: semantic QA not actual review`] : [],
        semantic.present && !semantic.passed && !semantic.needsReview ? [`${shotId}: semantic QA status ${semantic.status}`] : [],
        providerObservation && !providerActual ? [`${shotId}: provider observation not actual image2 output`] : [],
      );

      return {
        order: Number(previewClip.order || reportObservation.order || index + 1),
        shotId,
        sceneId: reportObservation.sceneId,
        roleIds: Array.isArray(reportObservation.roleIds) ? reportObservation.roleIds : [],
        expectedOutputPath,
        imageUrl: expectedOutputPath ? runtimeFileUrl(expectedOutputPath, "current-project") : undefined,
        outputExists,
        providerObservationPath,
        providerRequestId: providerObservation?.providerRequestId,
        providerObservationPresent: Boolean(providerObservation),
        providerObservationActual: providerActual,
        sourceReceiptId: providerObservation?.providerRequestId || providerObservationPath,
        providerOutputSha256,
        outputHash: providerOutputSha256,
        outputSha256: providerOutputSha256,
        promptText: providerObservation?.requestPromptText,
        promptHash: providerObservation?.requestPromptSha256,
        semanticQaPath,
        semanticQaPresent: semantic.present,
        semanticQaActual: semantic.actual,
        semanticQaStatus: semantic.status,
        semanticQaPassed: semantic.passed,
        semanticQaNeedsReview: semantic.needsReview,
        previewStatus,
        mediaType: previewClip.mediaType || previewClip.type,
        mediaPath: expectedOutputPath,
        durationSeconds: previewClip.durationSeconds || previewClip.duration_seconds || previewClip.duration,
        videoStatus: previewClip.videoStatus,
        submitId: previewClip.submitId || previewClip.submit_id,
        queueInfo: previewClip.queueInfo || previewClip.queue_info,
        localMediaPaths: Array.isArray(previewClip.localMediaPaths) ? previewClip.localMediaPaths : undefined,
        outputVideoPath: previewClip.outputVideoPath,
        previewQaStatus: previewClip.previewQaStatus || reportObservation.previewQaStatus,
        productionQaStatus: previewClip.productionQaStatus || reportObservation.productionQaStatus || (semantic.needsReview ? "needs_review" : undefined),
        reviewOverlay,
        runtimeTruthStatus: truthItem.status || reportObservation.runtimeTruthStatus,
        blockers,
        returned: outputExists || (!previewIsVideo && /^returned/.test(String(previewStatus))),
        shotPlan,
      };
    });
  }

  function projectProjectionFromSource(source) {
    const project = projectIdentityFromSource(source);
    const projectFacts = readProjectFacts(source);
    const observations = projectObservationItems(source, projectFacts);
    const blockedObservations = observations.filter((item) => item.blockers.length > 0 || item.previewStatus === "blocked" || item.runtimeTruthStatus === "blocked");
    const reviewShotIds = observations.filter((item) => item.reviewOverlay || item.semanticQaNeedsReview).map((item) => item.shotId);
    const returnedObservations = observations.filter((item) => item.returned);
    const status = projectFacts.previewPlan?.previewStatus
      || projectFacts.previewPlan?.status
      || projectFacts.runtimeTruthLayer?.status
      || projectFacts.image2Report?.previewStatus
      || projectFacts.image2Report?.status
      || (projectFacts.projectionAvailable ? projectFacts.runManifest?.status : "unavailable")
      || "unavailable";
    const productionStatus = projectFacts.previewPlan?.productionStatus
      || projectFacts.image2Report?.productionStatus
      || (reviewShotIds.length ? "needs_review" : blockedObservations.length ? "blocked" : status === "unavailable" ? "unavailable" : "ready");

    return {
      project,
      projectFacts,
      observations,
      blockedObservations,
      reviewShotIds,
      returnedObservations,
      status,
      previewStatus: status,
      productionStatus,
      ok: projectFacts.projectionAvailable,
    };
  }

  function firstTextValue(record, keys) {
    if (!isRecord(record)) return undefined;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  }

  function normalizeWorkbenchStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["locked", "approved", "authority", "formal"].includes(normalized)) return "locked";
    if (["needs_review", "review", "pending_review"].includes(normalized)) return "needs_review";
    if (["rejected", "blocked", "negative"].includes(normalized)) return "rejected";
    if (["missing", "not_generated", "absent"].includes(normalized)) return "missing";
    if (["candidate", "draft", "temp", "temporary"].includes(normalized)) return "candidate";
    return "locked";
  }

  function normalizeWorkbenchAssetType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["character", "role", "person", "cast"].includes(normalized)) return "character";
    if (["scene", "location", "set"].includes(normalized)) return "scene";
    if (["style", "look", "style_anchor"].includes(normalized)) return "style";
    return "prop";
  }

  function textArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
  }

  function workbenchSourceKindForPath(value) {
    const normalized = String(value || "").replace(/\\/g, "/").toLowerCase();
    if (!normalized) return "manual_definition";
    if (/(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/.test(normalized)) return "provider_temp_output";
    if (/(^|\/)(failed|failures?)(\/|$)/.test(normalized)) return "failed_output";
    if (/(^|\/)(shot[-_ ]?outputs?|outputs\/shots)(\/|$)/.test(normalized)) return "shot_output";
    return "source_asset";
  }

  function portableWorkbenchPath(value) {
    const normalized = runtimeRelativeFromValue(value);
    if (!normalized) return undefined;
    if (normalized.startsWith("../") || normalized === "..") return undefined;
    return normalized;
  }

  function cleanWorkbenchLabel(value) {
    if (typeof value !== "string") return undefined;
    let next = value.trim();
    for (let index = 0; index < 4; index += 1) {
      const cleaned = next
        .replace(/\s*[·•|｜-]\s*(待复核|已锁定|已通过|已拒绝|缺失|待补齐|needs_review|locked|approved|rejected|missing|candidate)\s*$/i, "")
        .trim();
      if (cleaned === next) break;
      next = cleaned;
    }
    return next || undefined;
  }

  function workbenchAssetFromRecord(item, type, sourceRef, index) {
    if (!isRecord(item)) return undefined;
    const id = firstTextValue(item, ["id", "assetId", "roleId", "sceneId", "styleId"]) || `${type}_${index + 1}`;
    const pathValue = firstTextValue(item, ["mainReferencePath", "path", "sourcePath", "referencePath"]);
    const authority = isRecord(item.referenceAuthority) ? item.referenceAuthority : undefined;
    const authorityPath = firstTextValue(authority, ["path"]);
    const pathValuePortable = portableWorkbenchPath(pathValue) || portableWorkbenchPath(authorityPath);
    const generatedBy = isRecord(item.generatedBy) ? item.generatedBy : undefined;
    const providerObservationPath = portableWorkbenchPath(
      firstTextValue(generatedBy, ["providerObservationPath"])
        || firstTextValue(item, ["providerObservationPath"]),
    );
    const providerObservation = readRuntimeJson(providerObservationPath);
    const outputHash = firstTextValue(generatedBy, ["outputSha256", "outputHash"])
      || firstTextValue(item, ["outputSha256", "outputHash"])
      || firstTextValue(providerObservation, ["outputSha256", "outputHash"]);
    const sourceReceiptId = firstTextValue(generatedBy, ["sourceReceiptId", "providerRequestId"])
      || firstTextValue(item, ["sourceReceiptId", "providerRequestId"])
      || firstTextValue(providerObservation, ["providerRequestId"])
      || providerObservationPath;
    const promptText = firstTextValue(item, ["promptText", "requestPromptText"])
      || firstTextValue(providerObservation, ["requestPromptText", "promptText", "prompt"]);
    const promptHash = firstTextValue(item, ["promptHash", "requestPromptSha256", "promptSha256"])
      || firstTextValue(providerObservation, ["requestPromptSha256", "promptSha256", "promptHash"]);
    const promptPath = portableWorkbenchPath(firstTextValue(item, ["promptPath"]));
    const status = normalizeWorkbenchStatus(
      firstTextValue(authority, ["lockedStatus"])
        || firstTextValue(item, ["lockedStatus", "visualMemoryStatus", "status"])
        || (pathValuePortable && workbenchSourceKindForPath(pathValuePortable) !== "source_asset" ? "candidate" : undefined),
    );
    const name = cleanWorkbenchLabel(firstTextValue(item, ["displayName", "name", "title", "label"])) || id;
    const textConstraints = uniqueStrings([
      ...textArray(item.mustPreserve),
      ...textArray(item.spatialAnchors),
      ...textArray(item.textConstraints),
      firstTextValue(item, ["description", "positive"]),
      ...textArray(item.mustAvoid).map((value) => `避免 ${value}`),
      firstTextValue(item, ["negative"]) ? `避免 ${firstTextValue(item, ["negative"])}` : undefined,
    ]);
    return {
      id,
      type,
      name,
      status,
      path: pathValuePortable,
      sourceKind: workbenchSourceKindForPath(pathValuePortable),
      sourceReceiptId,
      sourceRunId: firstTextValue(generatedBy, ["sourceRunId"]) || firstTextValue(item, ["sourceRunId"]),
      outputHash,
      promptText,
      promptPath,
      promptHash,
      textConstraints,
      usedByShotIds: textArray(item.usedByShotIds),
      sourceRefs: uniqueStrings([
        sourceRef,
        providerObservationPath ? `provider_observation#${providerObservationPath}` : undefined,
        outputHash ? `output_hash#${outputHash}` : undefined,
        promptHash ? `prompt_hash#${promptHash}` : undefined,
      ]),
      rejectedReason: firstTextValue(item, ["rejectedReason"]) || firstTextValue(authority, ["rejectedReason"]),
    };
  }

  function projectVibeSourceRefValue(sourceRefs, prefix) {
    const match = sourceRefs.find((ref) => typeof ref === "string" && ref.startsWith(prefix));
    return match ? match.slice(prefix.length).trim() : undefined;
  }

  function workbenchAssetFromProjectVibeAsset(asset, index) {
    if (!isRecord(asset)) return undefined;
    const id = firstTextValue(asset, ["id", "assetId"]) || `project_vibe_asset_${index + 1}`;
    const sourceRefs = textArray(asset.sourceRefs);
    const pathValuePortable = portableWorkbenchPath(firstTextValue(asset, ["path"]));
    const kind = normalizeWorkbenchAssetType(firstTextValue(asset, ["kind", "assetType", "type"]));
    return {
      id,
      type: kind,
      name: cleanWorkbenchLabel(firstTextValue(asset, ["label", "displayName", "name", "title"])) || id,
      status: normalizeWorkbenchStatus(firstTextValue(asset, ["status", "lockedStatus"]) || "needs_review"),
      path: pathValuePortable,
      sourceKind: workbenchSourceKindForPath(pathValuePortable),
      sourceReceiptId: projectVibeSourceRefValue(sourceRefs, "receipt#"),
      outputHash: projectVibeSourceRefValue(sourceRefs, "output_hash#"),
      promptHash: projectVibeSourceRefValue(sourceRefs, "prompt_hash#"),
      textConstraints: textArray(asset.textConstraints),
      usedByShotIds: textArray(asset.usedByShotIds),
      sourceRefs: uniqueStrings([`project_vibe.assets:${index}`, ...sourceRefs]),
      rejectedReason: firstTextValue(asset, ["rejectedReason"]),
    };
  }

  function mergeProjectVibeAssetAuthority(visualAssets, projectVibeAssets) {
    const byId = new Map();
    for (const asset of visualAssets) byId.set(asset.id, asset);
    for (const projectAsset of projectVibeAssets) {
      const existing = byId.get(projectAsset.id);
      byId.set(projectAsset.id, existing
        ? {
            ...existing,
            ...projectAsset,
            path: projectAsset.path || existing.path,
            sourceKind: projectAsset.path ? projectAsset.sourceKind : existing.sourceKind,
            sourceReceiptId: projectAsset.sourceReceiptId || existing.sourceReceiptId,
            outputHash: projectAsset.outputHash || existing.outputHash,
            promptText: existing.promptText,
            promptPath: existing.promptPath,
            promptHash: projectAsset.promptHash || existing.promptHash,
            textConstraints: uniqueStrings([...(existing.textConstraints || []), ...(projectAsset.textConstraints || [])]),
            usedByShotIds: uniqueStrings([...(existing.usedByShotIds || []), ...(projectAsset.usedByShotIds || [])]),
            sourceRefs: uniqueStrings([...(existing.sourceRefs || []), ...(projectAsset.sourceRefs || [])]),
          }
        : projectAsset);
    }
    return [...byId.values()];
  }

  function normalizeWorkbenchAssets(visualMemory) {
    const assets = [];
    if (!isRecord(visualMemory)) return assets;
    for (const [key, type] of [
      ["roles", "character"],
      ["characters", "character"],
      ["scenes", "scene"],
      ["props", "prop"],
      ["styles", "style"],
    ]) {
      const items = Array.isArray(visualMemory[key]) ? visualMemory[key] : [];
      items.forEach((item, index) => {
        const asset = workbenchAssetFromRecord(item, type, `visual_memory.${key}:${index}`, index);
        if (asset) assets.push(asset);
      });
    }
    if (isRecord(visualMemory.style)) {
      const asset = workbenchAssetFromRecord(visualMemory.style, "style", "visual_memory.style", 0);
      if (asset) assets.push(asset);
    }
    const genericAssets = Array.isArray(visualMemory.assets) ? visualMemory.assets : [];
    genericAssets.forEach((item, index) => {
      const asset = workbenchAssetFromRecord(item, normalizeWorkbenchAssetType(item?.assetType || item?.type), `visual_memory.assets:${index}`, index);
      if (asset) assets.push(asset);
    });
    const seen = new Set();
    return assets.filter((asset) => {
      if (seen.has(asset.id)) return false;
      seen.add(asset.id);
      return true;
    });
  }

  function normalizeWorkbenchStorySections(storyFlow, shots) {
    if (!isRecord(storyFlow)) return [];
    const explicitSections = Array.isArray(storyFlow.sections) ? storyFlow.sections : [];
    const sections = explicitSections
      .filter(isRecord)
      .map((section, index) => {
        const nestedShots = Array.isArray(section.shots) ? section.shots : [];
        const shotIds = textArray(section.shotIds).length
          ? textArray(section.shotIds)
          : nestedShots.filter(isRecord).map((shot) => firstTextValue(shot, ["id", "shotId"])).filter(Boolean);
        const id = firstTextValue(section, ["id", "sectionId", "actId"]) || `section_${index + 1}`;
        return {
          id,
          label: firstTextValue(section, ["label", "title", "name"]) || id,
          shotIds,
        };
      })
      .filter((section) => section.shotIds.length);
    if (sections.length) return sections;

    const byScene = new Map();
    for (const shot of shots) {
      const sectionId = shot.sceneId || shot.sectionId || "current_project";
      if (!byScene.has(sectionId)) {
        byScene.set(sectionId, {
          id: sectionId,
          label: sectionId === "current_project" ? "当前项目故事流" : sectionId,
          shotIds: [],
        });
      }
      byScene.get(sectionId).shotIds.push(shot.id);
    }
    return Array.from(byScene.values());
  }

  function normalizeWorkbenchStoryShots(storyFlow) {
    if (!isRecord(storyFlow)) return [];
    const directShots = Array.isArray(storyFlow.shots) ? storyFlow.shots : [];
    const sectionShots = (Array.isArray(storyFlow.sections) ? storyFlow.sections : [])
      .filter(isRecord)
      .flatMap((section) => Array.isArray(section.shots) ? section.shots.map((shot) => ({ shot, section })) : []);
    const normalized = [];
    const seen = new Set();
    for (const [index, entry] of [...directShots.map((shot) => ({ shot, section: undefined })), ...sectionShots].entries()) {
      const shot = entry.shot;
      if (!isRecord(shot)) continue;
      const id = firstTextValue(shot, ["id", "shotId"]) || `S${String(index + 1).padStart(2, "0")}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const sectionId = firstTextValue(shot, ["sectionId", "sceneId"])
        || firstTextValue(entry.section, ["id", "sectionId", "actId"])
        || "current_project";
      normalized.push({
        id,
        title: firstTextValue(shot, ["title", "name", "label"]) || id,
        storyFunction: firstTextValue(shot, ["storyFunction", "intent", "action", "description"]) || "当前项目故事流",
        actId: firstTextValue(shot, ["actId"]) || "current",
        sectionId,
        sceneId: firstTextValue(shot, ["sceneId"]),
        roleIds: textArray(shot.roleIds),
        propIds: textArray(shot.propIds),
        characterAssetIds: textArray(shot.characterAssetIds),
        sceneAssetIds: textArray(shot.sceneAssetIds),
        propAssetIds: textArray(shot.propAssetIds),
        startFrame: portableWorkbenchPath(firstTextValue(shot, ["startFrame", "startFramePath", "imagePath"])),
        endFrame: portableWorkbenchPath(firstTextValue(shot, ["endFrame", "endFramePath"])),
        status: firstTextValue(shot, ["status"]),
        issues: textArray(shot.issues),
        camera: firstTextValue(shot, ["camera"]),
        executionMode: firstTextValue(shot, ["executionMode"]),
        rhythmProfile: firstTextValue(shot, ["rhythmProfile"]),
        splitPolicy: firstTextValue(shot, ["splitPolicy"]),
        actionBeats: textArray(shot.actionBeats),
        primaryAction: firstTextValue(shot, ["primaryAction"]),
        actionTrigger: firstTextValue(shot, ["actionTrigger"]),
        microReaction: firstTextValue(shot, ["microReaction"]),
        seedanceDirection: firstTextValue(shot, ["seedanceDirection"]),
        directorFeedbackDirectives: textArray(shot.directorFeedbackDirectives),
        characterGuidance: textArray(shot.characterGuidance),
        sceneGuidance: textArray(shot.sceneGuidance),
        propGuidance: textArray(shot.propGuidance),
        durationSeconds: Number.isFinite(shot.durationSeconds) ? shot.durationSeconds : undefined,
        sourceRefs: textArray(shot.sourceRefs),
      });
    }
    return normalized;
  }

  function currentProjectWorkbenchFacts(source, projectFacts) {
    const storyFact = resolveCurrentProjectStoryFlowFact(source, projectFacts.projectVibe);
    const visualMemoryFact = projectFact("visual_memory", source.visualMemoryPath, ["visual_memory"]);
    const sourceIndexFact = projectFact("source_index", source.sourceIndexPath, ["source_index"]);
    const projectVibeStoryFlow = isRecord(projectFacts.projectVibe?.storyFlow)
      ? {
          ...projectFacts.projectVibe.storyFlow,
          shots: Array.isArray(projectFacts.projectVibe?.shots) ? projectFacts.projectVibe.shots : [],
        }
      : undefined;
    const projectVibeVisualMemory = isRecord(projectFacts.projectVibe?.visualMemory)
      ? projectFacts.projectVibe.visualMemory
      : undefined;
    const storyFlowParsed = storyFact.readable ? storyFact.parsed : projectVibeStoryFlow;
    const storyFlowReadable = storyFact.readable || Boolean(projectVibeStoryFlow);
    const visualMemoryParsed = visualMemoryFact.readable ? visualMemoryFact.parsed : projectVibeVisualMemory;
    const visualMemoryReadable = visualMemoryFact.readable || Boolean(projectVibeVisualMemory);
    const storyShots = storyFlowReadable ? normalizeWorkbenchStoryShots(storyFlowParsed) : [];
    const storySections = storyFlowReadable ? normalizeWorkbenchStorySections(storyFlowParsed, storyShots) : [];
    const visualAssets = visualMemoryReadable ? normalizeWorkbenchAssets(visualMemoryParsed) : [];
    const projectVibeAssets = Array.isArray(projectFacts.projectVibe?.assets)
      ? projectFacts.projectVibe.assets
        .map((asset, index) => workbenchAssetFromProjectVibeAsset(asset, index))
        .filter(Boolean)
      : [];
    const authoritativeVisualAssets = mergeProjectVibeAssetAuthority(visualAssets, projectVibeAssets);

    return {
      schemaVersion: "vibe_core_current_project_workbench_facts_v1",
      source: "current_project_files",
      project: projectIdentityFromSource(source),
      projectRoot: source.runRootRelativePath,
      projectVibePath: source.projectVibeRelativePath,
      sourceIndex: {
        present: sourceIndexFact.present,
        readable: sourceIndexFact.readable,
        path: sourceIndexFact.path,
        sourceIndexHash: firstTextValue(sourceIndexFact.parsed, ["sourceIndexHash"]),
        refs: Array.isArray(sourceIndexFact.parsed?.refs) ? sourceIndexFact.parsed.refs.filter((item) => typeof item === "string") : [],
      },
      storyFlow: {
        present: storyFact.present,
        readable: storyFlowReadable,
        path: storyFact.path,
        fallbackFromProjectVibe: !storyFact.readable && Boolean(projectVibeStoryFlow),
        sourceOfTruth: storyFact.sourceOfTruth,
        factSourceRole: storyFact.factSourceRole,
        sourceRole: storyFact.sourceRole,
        declaredBy: storyFact.declaredBy,
        declaredRefPath: storyFact.declaredRefPath,
        compatibilityFallbackUsed: storyFact.compatibilityFallbackUsed,
        runtimeStateRole: storyFact.runtimeStateRole,
        runtimeStateUsed: storyFact.runtimeStateUsed,
        runtimeStateMayOverride: storyFact.runtimeStateMayOverride,
        shotCount: storyShots.length,
        sectionCount: storySections.length,
        sections: storySections,
        shots: storyShots,
      },
      visualMemory: {
        present: visualMemoryFact.present,
        readable: visualMemoryReadable,
        path: visualMemoryFact.path,
        fallbackFromProjectVibe: !visualMemoryFact.readable && Boolean(projectVibeVisualMemory),
        assetCount: authoritativeVisualAssets.length,
        assets: authoritativeVisualAssets,
        summary: {
          locked: authoritativeVisualAssets.filter((asset) => asset.status === "locked").length,
          candidate: authoritativeVisualAssets.filter((asset) => asset.status === "candidate").length,
          needsReview: authoritativeVisualAssets.filter((asset) => asset.status === "needs_review").length,
          rejected: authoritativeVisualAssets.filter((asset) => asset.status === "rejected").length,
          missing: authoritativeVisualAssets.filter((asset) => asset.status === "missing").length,
        },
      },
      factsUsed: [
        ...projectFacts.factsUsed,
        ...(storyFlowReadable ? [{
          name: storyFact.readable ? storyFact.name : "project_vibe.story_flow",
          path: storyFact.readable ? storyFact.path : source.projectVibeRelativePath,
          usedFor: storyFact.usedFor,
        }] : []),
        ...(visualMemoryReadable ? [{
          name: visualMemoryFact.readable ? visualMemoryFact.name : "project_vibe.visual_memory",
          path: visualMemoryFact.readable ? visualMemoryFact.path : source.projectVibeRelativePath,
          usedFor: visualMemoryFact.usedFor,
        }] : []),
      ].filter((fact, index, facts) => facts.findIndex((item) => item.name === fact.name && item.path === fact.path) === index),
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
    };
  }

  return {
    projectFact,
    projectFactRefPath,
    projectVibeDeclaredFactRefs,
    safeProjectFactRefPath,
    projectFactRefCandidates,
    withProjectFactSourceMetadata,
    resolveCurrentProjectStoryFlowFact,
    readProjectFacts,
    byShotId,
    orderedShotIds,
    mergeBlockers,
    providerObservationActual,
    semanticQaSummary,
    projectObservationItems,
    projectProjectionFromSource,
    firstTextValue,
    normalizeWorkbenchStatus,
    normalizeWorkbenchAssetType,
    textArray,
    workbenchSourceKindForPath,
    portableWorkbenchPath,
    workbenchAssetFromRecord,
    normalizeWorkbenchAssets,
    normalizeWorkbenchStorySections,
    normalizeWorkbenchStoryShots,
    currentProjectWorkbenchFacts,
  };
}
