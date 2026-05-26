import path from "node:path";
import {
  parseProjectVibeText,
  refreshProjectVibeSourceIndex,
  serializeProjectVibe,
} from "../src/project/index.ts";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStatus(value) {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "locked" || normalized === "approved") return "locked";
  if (normalized === "needs_review" || normalized === "review" || normalized === "pending_review") return "needs_review";
  if (normalized === "rejected" || normalized === "reject") return "rejected";
  if (normalized === "candidate" || normalized === "draft") return "candidate";
  return undefined;
}

function assetIdCandidates(item) {
  if (!isRecord(item)) return [];
  return [
    item.id,
    item.assetId,
    item.roleId,
    item.characterId,
    item.sceneId,
    item.propId,
    item.styleId,
  ].map(asString).filter(Boolean);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(asString).filter(Boolean)));
}

function safeIdPart(value) {
  return (asString(value) || "asset")
    .replace(/[^a-z0-9_\-\u4e00-\u9fa5]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72) || "asset";
}

function kindFromValue(value) {
  const normalized = asString(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (/character|role|person|人物|角色/.test(normalized)) return "character";
  if (/scene|environment|location|weather|场景|环境|地点|天气/.test(normalized)) return "scene";
  if (/style|look|风格/.test(normalized)) return "style";
  if (/prop|object|item|道具|物件|物体/.test(normalized)) return "prop";
  if (/reference|参考/.test(normalized)) return "reference";
  return undefined;
}

function kindFromMemoryBucket(bucket, item) {
  const explicit = kindFromValue(item?.kind)
    || kindFromValue(item?.type)
    || kindFromValue(item?.assetType)
    || kindFromValue(item?.referenceType);
  if (explicit) return explicit;
  if (bucket === "roles" || bucket === "characters") return "character";
  if (bucket === "scenes") return "scene";
  if (bucket === "props") return "prop";
  if (bucket === "styles" || bucket === "style") return "style";
  return "reference";
}

function firstString(item, keys) {
  if (!isRecord(item)) return undefined;
  for (const key of keys) {
    const value = asString(item[key]);
    if (value) return value;
  }
  return undefined;
}

function stringArray(item, keys) {
  if (!isRecord(item)) return [];
  const values = [];
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) values.push(...value.map(asString).filter(Boolean));
    else {
      const text = asString(value);
      if (text) values.push(text);
    }
  }
  return uniqueStrings(values);
}

function assetOutputHash(item) {
  if (!isRecord(item)) return undefined;
  const generatedBy = isRecord(item.generatedBy) ? item.generatedBy : undefined;
  return asString(item.outputHash)
    || asString(item.sha256)
    || asString(item.outputSha256)
    || asString(generatedBy?.outputHash)
    || asString(generatedBy?.outputSha256);
}

function assetSourceRefs(item) {
  if (!isRecord(item)) return [];
  const generatedBy = isRecord(item.generatedBy) ? item.generatedBy : undefined;
  return uniqueStrings([
    ...stringArray(item, ["sourceRefs", "evidenceRefs"]),
    asString(generatedBy?.providerObservationPath),
    asString(generatedBy?.semanticQaPath),
  ]);
}

function assetSourceReceiptId(item) {
  if (!isRecord(item)) return undefined;
  const generatedBy = isRecord(item.generatedBy) ? item.generatedBy : undefined;
  return asString(item.sourceReceiptId)
    || asString(item.receiptId)
    || asString(generatedBy?.sourceReceiptId)
    || asString(generatedBy?.receiptId)
    || asString(generatedBy?.providerObservationPath);
}

function assetLabel(item, assetId) {
  return firstString(item, ["displayName", "name", "title", "label", "promptLabel"])
    || assetId
    || "参考素材";
}

function assetTextConstraints(item) {
  if (!isRecord(item)) return [];
  return uniqueStrings([
    ...stringArray(item, [
      "textConstraints",
      "mustPreserve",
      "constraints",
      "identityConstraints",
      "sceneConstraints",
      "propConstraints",
      "notes",
    ]),
    firstString(item, ["description", "summary", "prompt", "positivePrompt", "visualDescription"]),
  ]).slice(0, 12);
}

function projectRelativePath(value, source) {
  const text = asString(value)?.replace(/\\/g, "/");
  if (!text) return undefined;
  const sourceRootPath = asString(source?.runRootPath);
  const sourceRootRelative = asString(source?.runRootRelativePath)?.replace(/\\/g, "/").replace(/\/+$/, "");
  if (path.isAbsolute(text) && sourceRootPath) {
    const relative = path.relative(sourceRootPath, text).replace(/\\/g, "/");
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  }
  let normalized = text.replace(/^\.\//, "");
  if (sourceRootRelative && normalized.startsWith(`${sourceRootRelative}/`)) {
    normalized = normalized.slice(sourceRootRelative.length + 1);
  }
  if (path.isAbsolute(normalized) || normalized.startsWith("../") || normalized.includes("/../")) return undefined;
  return normalized || undefined;
}

function assetPortablePath(item, source) {
  if (!isRecord(item)) return undefined;
  return projectRelativePath(firstString(item, ["mainReferencePath", "path", "sourcePath", "referencePath", "outputPath"]), source);
}

function updatedAuthority(authority, status, updatedAt, reviewerId) {
  const current = isRecord(authority) ? authority : {};
  return {
    ...current,
    lockedStatus: status,
    canUseAsFutureReference: status === "locked",
    updatedAt,
    ...(status === "locked" ? { lockedAt: updatedAt, lockedBy: reviewerId } : {}),
    ...(status === "rejected" ? { rejectedAt: updatedAt, rejectedBy: reviewerId } : {}),
  };
}

function updateVisualMemoryItem(item, status, updatedAt, reviewerId) {
  if (!isRecord(item)) return item;
  return {
    ...item,
    status,
    visualMemoryStatus: status,
    lockedStatus: status,
    referenceAuthority: updatedAuthority(item.referenceAuthority, status, updatedAt, reviewerId),
    updatedAt,
  };
}

function updateArrayByAssetId(items, assetId, status, updatedAt, reviewerId) {
  if (!Array.isArray(items)) return { items, updated: false, asset: undefined };
  let updated = false;
  let asset;
  const nextItems = items.map((item) => {
    if (updated || !assetIdCandidates(item).includes(assetId)) return item;
    updated = true;
    asset = updateVisualMemoryItem(item, status, updatedAt, reviewerId);
    return asset;
  });
  return { items: nextItems, updated, asset };
}

export function markCurrentProjectVisualMemoryAssetStatus(visualMemory, input) {
  if (!isRecord(visualMemory)) {
    return { ok: false, status: "blocked", message: "当前项目没有可写的参考资产文件。", blockers: ["visual_memory_unreadable"] };
  }
  const assetId = asString(input?.assetId);
  const status = normalizeStatus(input?.status);
  const updatedAt = asString(input?.updatedAt) || new Date().toISOString();
  const reviewerId = asString(input?.reviewerId) || "runtime_user";
  if (!assetId) {
    return { ok: false, status: "blocked", message: "请选择要复核的参考。", blockers: ["asset_id_required"] };
  }
  if (!status) {
    return { ok: false, status: "blocked", message: "请选择参考状态。", blockers: ["asset_status_required"] };
  }

  const next = { ...visualMemory };
  for (const key of ["roles", "characters", "scenes", "props", "styles", "assets"]) {
    const result = updateArrayByAssetId(next[key], assetId, status, updatedAt, reviewerId);
    if (result.updated) {
      next[key] = result.items;
      return {
        ok: true,
        status,
        message: status === "locked" ? "参考已锁定。" : status === "needs_review" ? "参考已放回复核。" : status === "rejected" ? "参考已拒绝。" : "参考状态已更新。",
        visualMemory: next,
        asset: result.asset,
        assetKind: kindFromMemoryBucket(key, result.asset),
      };
    }
  }

  if (assetIdCandidates(next.style).includes(assetId)) {
    const asset = updateVisualMemoryItem(next.style, status, updatedAt, reviewerId);
    next.style = asset;
    return {
      ok: true,
      status,
      message: status === "locked" ? "参考已锁定。" : "参考状态已更新。",
      visualMemory: next,
      asset,
      assetKind: kindFromMemoryBucket("style", asset),
    };
  }

  return {
    ok: false,
    status: "blocked",
    message: "没有在当前项目参考里找到这张素材。",
    blockers: ["asset_not_found"],
    assetId,
  };
}

function ensureProjectVibeLedger(project) {
  if (!isRecord(project.receipts)) project.receipts = {};
  const receipts = project.receipts;
  for (const key of ["scriptPlanningReceipts", "promptKeyframePlanningReceipts", "batchReceipts", "reviewReceipts"]) {
    if (!Array.isArray(receipts[key])) receipts[key] = [];
  }
  return receipts;
}

function upsertById(items, nextItem) {
  const existing = Array.isArray(items) ? items : [];
  const index = existing.findIndex((item) => isRecord(item) && item.id === nextItem.id);
  if (index < 0) return [...existing, nextItem];
  const next = [...existing];
  next[index] = { ...next[index], ...nextItem };
  return next;
}

function appendUnique(values, value) {
  const current = Array.isArray(values) ? values.map(asString).filter(Boolean) : [];
  if (value && !current.includes(value)) current.push(value);
  return current;
}

function reviewStatusForAssetStatus(status) {
  if (status === "locked") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "missing") return "missing";
  return "needs_review";
}

function buildProjectVibeReviewReceipt({ assetId, status, updatedAt, reviewerId, asset, source }) {
  const outputHash = assetOutputHash(asset);
  const outputPath = assetPortablePath(asset, source);
  const sourceReceiptId = assetSourceReceiptId(asset);
  const canApprove = status === "locked" && Boolean(outputHash && outputPath && sourceReceiptId);
  const reviewStatus = canApprove
    ? "approved"
    : status === "locked"
      ? "needs_review"
      : reviewStatusForAssetStatus(status);
  return {
    id: `review_${safeIdPart(assetId)}_${updatedAt.replace(/[^0-9]/g, "").slice(0, 14) || Date.now()}`,
    createdAt: updatedAt,
    status: reviewStatus,
    reviewerId,
    humanReviewed: true,
    assetId,
    sourceReceiptId,
    outputPath,
    outputHash,
    retryRequested: false,
    lateOutput: false,
    providerSelfReportIgnored: true,
    promotionAuthorized: canApprove,
    ...(canApprove ? { promotionAuthorizedBy: reviewerId, promotionAuthorizedAt: updatedAt } : {}),
    evidenceRefs: assetSourceRefs(asset).map((ref) => projectRelativePath(ref, source) || ref),
    blockers: [],
  };
}

function projectVibeAssetFromVisualMemoryAsset(asset, input, source) {
  if (!isRecord(asset)) return undefined;
  const assetId = asString(input.assetId) || assetIdCandidates(asset)[0];
  if (!assetId) return undefined;
  const status = normalizeStatus(input.status) || "needs_review";
  const kind = input.assetKind || kindFromMemoryBucket("assets", asset);
  return {
    id: assetId,
    kind,
    label: assetLabel(asset, assetId),
    status,
    path: assetPortablePath(asset, source),
    textConstraints: assetTextConstraints(asset),
    usedByShotIds: stringArray(asset, ["usedByShotIds", "shotIds"]),
    sourceRefs: uniqueStrings([
      `project/visual_memory.json#${assetId}`,
      ...assetSourceRefs(asset).map((ref) => projectRelativePath(ref, source) || ref),
    ]),
    ...(status === "locked" ? { lockedBy: "user" } : {}),
    ...(isRecord(asset.roleBinding) ? { roleBinding: asset.roleBinding } : {}),
  };
}

function syncProjectVibeAssetStatus(project, input, source) {
  const updatedAt = asString(input.updatedAt) || new Date().toISOString();
  const reviewerId = asString(input.reviewerId) || "runtime_user";
  const projectAsset = projectVibeAssetFromVisualMemoryAsset(input.asset, input, source);
  if (!projectAsset) {
    return { written: false, reason: "asset_not_projectable" };
  }

  if (!Array.isArray(project.assets)) project.assets = [];
  if (!isRecord(project.visualMemory)) {
    project.visualMemory = {
      id: "visual_memory_current",
      updatedAt,
      sourceOfTruth: "project_vibe",
      referencePolicy: {
        temporaryOutputsMayBecomeAuthority: false,
        runtimeFixturesMayBecomeAuthority: false,
        lockedAssetsRequiredForGeneration: true,
      },
      entries: [],
    };
  }
  if (!Array.isArray(project.visualMemory.entries)) project.visualMemory.entries = [];
  if (!Array.isArray(project.shots)) project.shots = [];

  const existingAsset = project.assets.find((asset) => isRecord(asset) && asset.id === projectAsset.id);
  const mergedAsset = {
    ...(existingAsset || {}),
    ...projectAsset,
    path: projectAsset.path || existingAsset?.path,
    textConstraints: projectAsset.textConstraints.length ? projectAsset.textConstraints : (existingAsset?.textConstraints || []),
    usedByShotIds: projectAsset.usedByShotIds.length ? projectAsset.usedByShotIds : (existingAsset?.usedByShotIds || []),
    sourceRefs: uniqueStrings([...(existingAsset?.sourceRefs || []), ...projectAsset.sourceRefs]),
  };
  project.assets = upsertById(project.assets, mergedAsset);

  const reviewReceipt = buildProjectVibeReviewReceipt({
    assetId: projectAsset.id,
    status: projectAsset.status,
    updatedAt,
    reviewerId,
    asset: input.asset,
    source,
  });
  const receipts = ensureProjectVibeLedger(project);
  receipts.reviewReceipts = upsertById(receipts.reviewReceipts, reviewReceipt);
  const reviewSourceRef = reviewReceipt.status === "approved" && reviewReceipt.outputHash
    ? `project.vibe#receipts/reviews/${reviewReceipt.id}`
    : undefined;

  const existingEntry = project.visualMemory.entries.find((entry) => isRecord(entry) && entry.assetId === projectAsset.id);
  const entry = {
    ...(existingEntry || {}),
    id: existingEntry?.id || `vm_${safeIdPart(projectAsset.id)}`,
    assetId: projectAsset.id,
    kind: projectAsset.kind,
    label: projectAsset.label,
    status: projectAsset.status,
    textConstraints: projectAsset.textConstraints,
    usedByShotIds: projectAsset.usedByShotIds,
    canUseAsFutureReference: projectAsset.status === "locked",
    sourceRefs: uniqueStrings([
      ...(existingEntry?.sourceRefs || []),
      ...projectAsset.sourceRefs,
      reviewSourceRef,
    ]),
    ...(projectAsset.roleBinding ? { roleBinding: projectAsset.roleBinding } : {}),
  };
  project.visualMemory.entries = upsertById(project.visualMemory.entries, entry);

  const fieldByKind = {
    character: "characterAssetIds",
    scene: "sceneAssetIds",
    prop: "propAssetIds",
    reference: "propAssetIds",
  };
  const shotAssetField = fieldByKind[projectAsset.kind];
  if (shotAssetField) {
    const usedBy = new Set(projectAsset.usedByShotIds);
    project.shots = project.shots.map((shot) => {
      if (!isRecord(shot) || !usedBy.has(shot.id)) return shot;
      return { ...shot, [shotAssetField]: appendUnique(shot[shotAssetField], projectAsset.id) };
    });
  }

  project.manifest = { ...(project.manifest || {}), updatedAt };
  project.visualMemory.updatedAt = updatedAt;
  refreshProjectVibeSourceIndex(project, updatedAt);
  return { written: true, assetId: projectAsset.id, reviewReceiptId: reviewReceipt.id };
}

function writeProjectVibeAssetStatus(source, result, input, deps) {
  if (!source?.projectVibePath || !result?.asset) return { projectVibeWritten: false };
  try {
    const parsed = parseProjectVibeText(deps.readFileSync(source.projectVibePath, "utf8"));
    if (!parsed.ok || !parsed.project) {
      return { projectVibeWritten: false, projectVibeError: parsed.errors?.[0] || "project.vibe 无法读取。" };
    }
    const sync = syncProjectVibeAssetStatus(parsed.project, {
      ...input,
      asset: result.asset,
      assetKind: result.assetKind,
    }, source);
    if (!sync.written) return { projectVibeWritten: false, projectVibeSkipped: sync.reason };
    deps.mkdirSync(path.dirname(source.projectVibePath), { recursive: true });
    deps.writeFileSync(source.projectVibePath, serializeProjectVibe(parsed.project), "utf8");
    return {
      projectVibeWritten: true,
      projectVibePath: source.projectVibeRelativePath,
      projectVibeAssetId: sync.assetId,
      projectVibeReviewReceiptId: sync.reviewReceiptId,
    };
  } catch (error) {
    return {
      projectVibeWritten: false,
      projectVibeError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function assetStatusRequestInput(_url, body) {
  return {
    assetId: asString(body?.assetId) || asString(body?.asset?.id),
    status: normalizeStatus(body?.status) || normalizeStatus(body?.asset?.status),
    reviewerId: asString(body?.reviewerId),
    updatedAt: asString(body?.updatedAt),
  };
}

export function createRuntimeApiCurrentProjectAssetStatus(deps) {
  const {
    currentProjectAssetStatusEndpoint,
    currentProjectRouteContext,
    writeJson,
    runtimePolicy,
    readFileSync,
    writeFileSync,
    mkdirSync,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  function currentProjectAssetStatusResponse(input, extra, source) {
    let visualMemory;
    try {
      visualMemory = JSON.parse(readFileSync(source.visualMemoryPath, "utf8"));
    } catch (error) {
      return {
        ok: false,
        ...runtimePolicy(),
        endpoint: currentProjectAssetStatusEndpoint,
        status: "blocked",
        message: "当前项目参考资产文件不可读取。",
        blockers: ["visual_memory_unreadable"],
        visualMemoryPath: source.visualMemoryRelativePath,
        error: error instanceof Error ? error.message : String(error),
        ...extra,
      };
    }

    const result = markCurrentProjectVisualMemoryAssetStatus(visualMemory, input);
    if (!result.ok) {
      return {
        ...result,
        ...runtimePolicy(),
        endpoint: currentProjectAssetStatusEndpoint,
        visualMemoryPath: source.visualMemoryRelativePath,
        ...extra,
      };
    }

    mkdirSync(path.dirname(source.visualMemoryPath), { recursive: true });
    writeFileSync(source.visualMemoryPath, `${JSON.stringify(result.visualMemory, null, 2)}\n`, "utf8");
    const projectVibeWrite = writeProjectVibeAssetStatus(source, result, input, {
      readFileSync,
      writeFileSync,
      mkdirSync,
    });
    return {
      ok: true,
      ...runtimePolicy(),
      endpoint: currentProjectAssetStatusEndpoint,
      status: result.status,
      message: result.message,
      asset: result.asset,
      assetId: input.assetId,
      visualMemoryWritten: true,
      visualMemoryPath: source.visualMemoryRelativePath,
      ...projectVibeWrite,
      running: runtimeState(),
      ...extra,
    };
  }

  async function handleCurrentProjectAssetStatusRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectAssetStatusEndpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectAssetStatusEndpoint);
    if (!routeContext) return true;
    const input = assetStatusRequestInput(url, routeContext.body);
    const payload = currentProjectAssetStatusResponse(input, {
      requestContext: routeContext.requestContext,
      running: runtimeState(),
    }, routeContext.source);
    writeJson(res, payload.ok ? 200 : 409, payload);
    return true;
  }

  return {
    assetStatusRequestInput,
    currentProjectAssetStatusResponse,
    handleCurrentProjectAssetStatusRoute,
  };
}
