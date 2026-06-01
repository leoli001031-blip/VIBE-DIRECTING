import path from "node:path";
import {
  applyProjectVibeTransaction,
  buildProjectVibeReviewPromotionTransaction,
  parseProjectVibeText,
  serializeProjectVibe,
} from "../src/project/index.ts";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function actionFromInput(value) {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "approve" || normalized === "approved") return "approve";
  if (normalized === "lock" || normalized === "locked") return "lock";
  if (normalized === "reject" || normalized === "rejected") return "reject";
  if (normalized === "retry" || normalized === "retry_requested") return "retry";
  return undefined;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function uniqueStringArray(value) {
  return Array.from(new Set(stringArray(value)));
}

function reviewDecisionRequestInput(url, body) {
  const item = isRecord(body?.item) ? body.item : {};
  const candidate = isRecord(body?.candidate) ? body.candidate : {};
  const decision = isRecord(body?.decision) ? body.decision : {};
  const action = actionFromInput(url.searchParams.get("action"))
    || actionFromInput(body?.action)
    || actionFromInput(decision.status);
  const reviewedAt = asString(body?.reviewedAt) || asString(decision.reviewedAt) || new Date().toISOString();
  const reviewerId = asString(body?.reviewerId) || asString(decision.reviewerId) || "runtime_user";
  const shotId = asString(candidate.shotId) || asString(item.shotId) || asString(body?.shotId);
  const outputPath = asString(candidate.outputPath) || asString(candidate.mediaPath) || asString(item.mediaPath) || asString(body?.outputPath);
  const outputHash = asString(candidate.outputHash) || asString(candidate.outputSha256) || asString(item.outputHash) || asString(body?.outputHash);
  const sourceReceiptId = asString(candidate.sourceReceiptId) || asString(item.sourceReceiptId) || asString(body?.sourceReceiptId);
  const promotionAuthorization = action === "lock"
    ? {
        authorized: true,
        authorizedBy: reviewerId,
        authorizedAt: reviewedAt,
      }
    : undefined;

  return {
    action,
    transactionId: asString(body?.transactionId),
    receiptId: asString(body?.receiptId),
    candidate: {
      shotId,
      assetId: asString(candidate.assetId) || asString(item.assetId) || asString(body?.assetId),
      assetKind: asString(candidate.assetKind) || asString(body?.assetKind),
      label: asString(candidate.label) || asString(item.label) || asString(body?.label),
      outputPath,
      outputHash,
      sourceReceiptId,
      sourceRunId: asString(candidate.sourceRunId) || asString(item.sourceRunId) || asString(body?.sourceRunId),
      providerSelfReportedSuccess: candidate.providerSelfReportedSuccess === true || body?.providerSelfReportedSuccess === true,
      returnedOutput: candidate.returnedOutput === true || body?.returnedOutput === true || Boolean(outputPath),
      missingOutput: candidate.missingOutput === true || body?.missingOutput === true || action === "retry" || item.status === "missing",
      lateOutput: candidate.lateOutput === true || body?.lateOutput === true,
      evidenceRefs: stringArray(candidate.evidenceRefs).concat(stringArray(body?.evidenceRefs)),
    },
    decision: {
      status: action === "retry" ? "retry_requested" : action === "reject" ? "rejected" : "approved",
      humanReviewed: true,
      reviewerId,
      reviewedAt,
      retryRequested: action === "retry" ? true : undefined,
      promotionTarget: action === "lock" ? "asset_and_locked_visual_memory" : "review_receipt_only",
      promotionAuthorization,
      assetKind: asString(decision.assetKind) || asString(candidate.assetKind) || asString(body?.assetKind) || "reference",
      assetLabel: asString(decision.assetLabel) || asString(candidate.label) || asString(item.label) || asString(body?.label),
      textConstraints: stringArray(decision.textConstraints).concat(stringArray(candidate.textConstraints)),
      usedByShotIds: stringArray(decision.usedByShotIds).concat(shotId ? [shotId] : []),
      rawFreeTextTask: asString(decision.rawFreeTextTask) || asString(body?.rawFreeTextTask),
    },
  };
}

export function createRuntimeApiCurrentProjectReviewDecision(deps) {
  const {
    currentProjectReviewDecisionEndpoint,
    currentProjectRouteContext,
    writeJson,
    requestOverrideDiagnostics,
    runtimePolicy,
    readFileSync,
    writeFileSync,
    mkdirSync,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  function currentProjectReviewDecisionResponse(input, extra, source) {
    const action = input.action;
    if (!action) {
      return {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: "请选择通过、重试、拒绝或锁定。",
        blockers: ["review_action_required"],
        ...extra,
      };
    }

    const opened = parseProjectVibeText(readFileSync(source.projectVibePath, "utf8"));
    if (!opened.ok || !opened.project) {
      return {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: "当前项目文件不可写入复核记录。",
        blockers: opened.errors,
        projectVibePath: source.projectVibeRelativePath,
        ...extra,
      };
    }

    const staged = buildProjectVibeReviewPromotionTransaction({
      project: opened.project,
      candidate: input.candidate,
      decision: input.decision,
      transactionId: input.transactionId,
      receiptId: input.receiptId,
    });
    if (staged.status !== "staged" || !staged.transaction) {
      return {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: "复核决定还不能写入项目。",
        action,
        reviewStatus: staged.reviewReceipt.status,
        blockers: staged.blockers,
        warnings: staged.warnings,
        reviewReceipt: staged.reviewReceipt,
        providerSelfReportIgnored: staged.providerSelfReportIgnored,
        freeTextFormalTaskBlocked: staged.freeTextFormalTaskBlocked,
        ...extra,
      };
    }

    if (action === "lock") {
      const assetKind = asString(input.decision.assetKind || input.candidate.assetKind)?.toLowerCase();
      const assetId = input.candidate.assetId;
      const shotIds = uniqueStringArray(input.decision.usedByShotIds?.length ? input.decision.usedByShotIds : input.candidate.shotId ? [input.candidate.shotId] : []);
      if (assetId && shotIds.length && (assetKind === "character" || assetKind === "scene" || assetKind === "prop")) {
        for (const shotId of shotIds) {
          const sourceShot = opened.project.shots.find((shot) => shot.id === shotId);
          if (!sourceShot) continue;
          const characterAssetIds = stringArray(sourceShot.characterAssetIds);
          const sceneAssetIds = stringArray(sourceShot.sceneAssetIds);
          const propAssetIds = stringArray(sourceShot.propAssetIds);
          staged.transaction.operations.push({
            op: "upsert_shot",
            shot: {
              ...sourceShot,
              characterAssetIds: assetKind === "character" ? Array.from(new Set([...characterAssetIds, assetId])) : characterAssetIds,
              sceneAssetIds: assetKind === "scene" ? Array.from(new Set([...sceneAssetIds, assetId])) : sceneAssetIds,
              propAssetIds: assetKind === "prop" ? Array.from(new Set([...propAssetIds, assetId])) : propAssetIds,
              status: sourceShot.status === "blocked" ? sourceShot.status : "ready",
              sourceRefs: Array.from(new Set([
                ...stringArray(sourceShot.sourceRefs),
                `project.vibe#assets/${assetId}`,
              ])),
            },
          });
        }
      }
    }

    const patched = applyProjectVibeTransaction(opened.project, staged.transaction);
    if (patched.receipt.status !== "applied") {
      return {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: "Project.vibe 拒绝了这次复核写入。",
        action,
        blockers: patched.receipt.errors,
        reviewReceipt: staged.reviewReceipt,
        transactionReceipt: patched.receipt,
        ...extra,
      };
    }

    mkdirSync(path.dirname(source.projectVibePath), { recursive: true });
    writeFileSync(source.projectVibePath, serializeProjectVibe(patched.project));
    return {
      ok: true,
      ...runtimePolicy(),
      status: action === "lock" ? "locked" : action === "retry" ? "retry_requested" : action === "reject" ? "rejected" : "approved",
      message: action === "lock"
        ? "已写入锁定记录。"
        : action === "retry"
          ? "已写入重试请求。"
          : action === "reject"
            ? "已写入拒绝记录。"
            : "已写入复核记录。",
      action,
      projectVibeWritten: true,
      projectRoot: source.runRootRelativePath,
      projectVibePath: source.projectVibeRelativePath,
      reviewReceipt: staged.reviewReceipt,
      transactionReceipt: patched.receipt,
      promotionOperationCount: staged.promotionOperationCount,
      providerSelfReportIgnored: staged.providerSelfReportIgnored,
      freeTextFormalTaskBlocked: staged.freeTextFormalTaskBlocked,
      ...extra,
    };
  }

  async function handleCurrentProjectReviewDecisionRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectReviewDecisionEndpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectReviewDecisionEndpoint);
    if (!routeContext) return true;
    const input = reviewDecisionRequestInput(url, routeContext.body || {});
    const payload = currentProjectReviewDecisionResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    reviewDecisionRequestInput,
    currentProjectReviewDecisionResponse,
    handleCurrentProjectReviewDecisionRoute,
  };
}
