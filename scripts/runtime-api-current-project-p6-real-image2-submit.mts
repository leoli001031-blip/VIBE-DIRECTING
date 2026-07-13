import path from "node:path";
import { buildP6RealImage2Plan, buildP6RealImage2ReturnIngest } from "../src/core/p6RealImage2ClosedLoop.ts";
import { buildImage2CleanBasePrompt } from "../src/core/image2PromptBase.ts";
import { IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO, IMAGE2_GENERATE_DEFAULT_SIZE } from "../src/core/providerPolicy.ts";
import { fetchApikeyFunImageViaResponses } from "./apikey-fun-responses-image-transport.mts";

const CONFIRM_PHRASE = "submit-p6-image2";
const MOCK_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const DEFAULT_IMAGE2_PROVIDER_TIMEOUT_MS = 8 * 60 * 1000;
const MIN_IMAGE2_PROVIDER_TIMEOUT_MS = 30 * 1000;
const MAX_IMAGE2_PROVIDER_TIMEOUT_MS = 30 * 60 * 1000;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function expectedOutputsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((item, index) => {
    const expected = right[index];
    return isRecord(item)
      && isRecord(expected)
      && item.shotId === expected.shotId
      && item.expectedOutputPath === expected.expectedOutputPath
      && item.providerObservationPath === expected.providerObservationPath
      && item.semanticQaPath === expected.semanticQaPath;
  });
}

function referenceInputsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((item, index) => {
    const expected = right[index];
    return isRecord(item)
      && isRecord(expected)
      && item.id === expected.id
      && item.type === expected.type
      && item.name === expected.name
      && item.path === expected.path
      && item.sha256 === expected.sha256;
  });
}

function prepareReceiptMatchesCurrent(candidate, current) {
  return isRecord(candidate)
    && isRecord(current)
    && candidate.receiptId === current.receiptId
    && candidate.status === "prepared"
    && candidate.projectId === current.projectId
    && candidate.projectRoot === current.projectRoot
    && candidate.projectFactHash === current.projectFactHash
    && candidate.actionId === current.actionId
    && candidate.selectedShotId === current.selectedShotId
    && sameStringArray(candidate.selectedShotIds, current.selectedShotIds)
    && candidate.imageCount === current.imageCount
    && candidate.providerId === current.providerId
    && candidate.providerSlot === current.providerSlot
    && candidate.requiredMode === current.requiredMode
    && candidate.expectedOutputPath === current.expectedOutputPath
    && candidate.providerObservationPath === current.providerObservationPath
    && candidate.semanticQaPath === current.semanticQaPath
    && candidate.promptPath === current.promptPath
    && candidate.promptSha256 === current.promptSha256;
}

function permissionReceiptMatchesCurrent(candidate, current) {
  return isRecord(candidate)
    && isRecord(current)
    && candidate.permissionReceiptId === current.permissionReceiptId
    && candidate.receiptId === current.receiptId
    && candidate.handoffId === current.handoffId
    && candidate.status === "pending_action_time_confirmation"
    && candidate.projectId === current.projectId
    && candidate.projectRoot === current.projectRoot
    && candidate.projectFactHash === current.projectFactHash
    && candidate.actionId === current.actionId
    && candidate.providerId === current.providerId
    && candidate.providerSlot === current.providerSlot
    && candidate.requiredMode === current.requiredMode
    && sameStringArray(candidate.selectedShotIds, current.selectedShotIds)
    && expectedOutputsEqual(candidate.expectedOutputs, current.expectedOutputs)
    && referenceInputsEqual(candidate.referenceInputs, current.referenceInputs)
    && candidate.promptPath === current.promptPath
    && candidate.promptSha256 === current.promptSha256
    && candidate.credential?.credentialRef === current.credential?.credentialRef
    && candidate.maxProviderCallsPerReceipt === 1
    && candidate.submitIntent?.maxProviderCallsPerReceipt === 1
    && candidate.submitIntent?.providerSubmitAllowed === 0
    && candidate.providerCalled === false
    && candidate.runtimeProviderSubmitAttempted === false
    && candidate.runtimeExternalNetworkCallMade === false
    && candidate.projectVibeWritten === false;
}

function normalizeMockProviderResult(value) {
  if (value === true) return { enabled: true, status: "needs_review" };
  if (!isRecord(value)) return { enabled: false, status: undefined };
  const status = value.status === "success" || value.status === "verified"
    ? "success"
    : value.status === "missing"
      ? "missing"
      : "needs_review";
  return { enabled: true, status };
}

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

function projectRelativePath(value, projectRoot) {
  if (!asString(value) || !asString(projectRoot)) return undefined;
  const root = path.resolve(projectRoot);
  const directTarget = path.resolve(value);
  const directRelative = path.relative(root, directTarget);
  const directInside = directRelative === "" || (!directRelative.startsWith("..") && !path.isAbsolute(directRelative));
  const target = path.isAbsolute(value) || directInside
    ? directTarget
    : path.resolve(root, value);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative.replace(/\\/g, "/");
}

function requestBodyString(body, names) {
  if (!isRecord(body)) return undefined;
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function p6SubmitRequestInput(url, body) {
  const mockProviderResult = normalizeMockProviderResult(body?.mockProviderResult === undefined && body?.submitMode === "mock" ? true : body?.mockProviderResult);
  const selectedShotId = asString(url.searchParams.get("selectedShotId"))
    || requestBodyString(body, ["selectedShotId", "shotId"])
    || asString(body?.receipt?.selectedShotId);
  const selectedShotIds = Array.isArray(body?.selectedShotIds)
    ? body.selectedShotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : selectedShotId ? [selectedShotId] : [];
  return {
    selectedShotId,
    selectedShotIds,
    imageCount: Number.isInteger(body?.imageCount) ? body.imageCount : 1,
    receipt: isRecord(body?.receipt) ? body.receipt : undefined,
    submitPermissionReceipt: isRecord(body?.submitPermissionReceipt) ? body.submitPermissionReceipt : undefined,
    confirmation: isRecord(body?.confirmation) ? body.confirmation : undefined,
    providerId: requestBodyString(body, ["providerId"]) || "apikey-fun-gpt55-responses-image",
    submitMode: requestBodyString(body, ["submitMode", "mode"]) || "live",
    mockProviderResult: mockProviderResult.enabled,
    mockProviderResultStatus: mockProviderResult.status,
  };
}

function p6SerialSubmitRequestInput(url, body) {
  const selectedShotIds = uniqueStrings(Array.isArray(body?.selectedShotIds)
    ? body.selectedShotIds
    : asString(url.searchParams.get("selectedShotIds"))?.split(","));
  const shots = Array.isArray(body?.shots) ? body.shots.filter(isRecord) : [];
  const providerId = requestBodyString(body, ["providerId"]) || "apikey-fun-gpt55-responses-image";
  const fallbackMock = normalizeMockProviderResult(body?.mockProviderResult === undefined && body?.submitMode === "mock" ? true : body?.mockProviderResult);
  return {
    selectedShotIds,
    shots,
    providerId,
    submitMode: requestBodyString(body, ["submitMode", "mode"]) || "live",
    mockProviderResult: fallbackMock.enabled,
    mockProviderResultStatus: fallbackMock.status,
  };
}

function providerConfigFor(statuses, providerId) {
  return (Array.isArray(statuses) ? statuses : []).find((item) => item?.providerId === providerId);
}

function permissionReceiptLike(receipt) {
  if (!isRecord(receipt)) return undefined;
  return {
    receiptId: receipt.permissionReceiptId || receipt.receiptId,
    prepareReceiptId: receipt.receiptId,
    permissionReceiptId: receipt.permissionReceiptId,
    status: receipt.status,
    projectId: receipt.projectId,
    projectRoot: receipt.projectRoot,
    projectFactHash: receipt.projectFactHash,
    actionId: receipt.actionId,
    providerId: receipt.providerId,
    promptSha256: receipt.promptSha256,
    providerCalled: receipt.providerCalled,
    runtimeExternalNetworkCallMade: receipt.runtimeExternalNetworkCallMade,
    projectVibeWritten: receipt.projectVibeWritten,
    selectedShotIds: receipt.selectedShotIds,
    submitIntent: {
      maxProviderCallsPerReceipt: receipt.submitIntent?.maxProviderCallsPerReceipt,
      providerSubmitAllowed: receipt.submitIntent?.providerSubmitAllowed,
    },
  };
}

function referenceInputsFromStatusProjection(statusProjection) {
  const receiptInputs = Array.isArray(statusProjection.receipt?.visualReferenceInputs)
    ? statusProjection.receipt.visualReferenceInputs
    : [];
  const handoffInputs = Array.isArray(statusProjection.handoffPacket?.visualReferenceInputs)
    ? statusProjection.handoffPacket.visualReferenceInputs
    : [];
  const byPath = new Map();
  for (const input of [...receiptInputs, ...handoffInputs]) {
    const path = asString(input?.path);
    if (!path || byPath.has(path)) continue;
    byPath.set(path, {
      id: asString(input?.id),
      type: asString(input?.type),
      name: asString(input?.name),
      path,
      sha256: asString(input?.sha256),
    });
  }
  return [...byPath.values()];
}

export function image2ProviderTimeoutMs(env = process.env) {
  const candidates = [
    env.VIBE_IMAGE2_PROVIDER_TIMEOUT_MS,
    env.VIBE_P6_IMAGE2_TIMEOUT_MS,
    env.APIKEY_FUN_IMAGE2_TIMEOUT_MS,
  ];
  for (const raw of candidates) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_IMAGE2_PROVIDER_TIMEOUT_MS) {
      return Math.min(Math.floor(parsed), MAX_IMAGE2_PROVIDER_TIMEOUT_MS);
    }
  }
  return DEFAULT_IMAGE2_PROVIDER_TIMEOUT_MS;
}

function mimeTypeForImagePath(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function fileNameForImagePath(filePath) {
  const name = path.basename(String(filePath || "")).trim();
  return name || "reference.png";
}

export async function fetchImageBytesFromProvider({ apiKey, baseUrl, model, prompt, size }) {
  const timeoutMs = image2ProviderTimeoutMs();
  const result = await fetchApikeyFunImageViaResponses({
    apiKey,
    endpoint: baseUrl,
    model,
    prompt,
    size,
    quality: "low",
    stream: true,
    timeoutMs,
  });
  if (!result.ok) {
    return {
      ok: false,
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.errorType,
      message: result.message,
      diagnostic: result.diagnostic,
      providerResponseMetadata: {
        providerId: result.providerId,
        transport: result.transport,
        providerEndpoint: result.endpoint,
        providerOperation: "responses.image_generation",
        requestedModel: result.requestedModel,
        returnedModel: result.returnedModel,
        ...result.metadata,
        returnedCount: 0,
        retryable: result.errorType === "network_error" || result.errorType === "timeout" || result.errorType === "server_error",
      },
    };
  }
  return {
    ok: true,
    bytes: result.bytes,
    providerRequestId: result.providerRequestId,
    providerResponseMetadata: {
      providerId: result.providerId,
      transport: result.transport,
      providerEndpoint: result.endpoint,
      providerOperation: "responses.image_generation",
      requestedModel: result.requestedModel,
      returnedModel: result.returnedModel,
      returnedCount: 1,
      rawSseSha256: result.metadata.rawResponseSha256,
      ...result.metadata,
    },
  };
}

export async function fetchImageEditBytesFromProvider({ apiKey, baseUrl, model, prompt, size, referenceImages }) {
  const timeoutMs = image2ProviderTimeoutMs();
  const images = Array.isArray(referenceImages) ? referenceImages.filter((image) => image?.bytes?.length) : [];
  if (!images.length) {
    return {
      ok: false,
      statusCode: 400,
      errorType: "validation_error",
      failureKind: "validation_error",
      message: "参考图不可用，请先锁定可读取的参考图。",
      diagnostic: {
        kind: "validation_error",
        message: "image.edit requires at least one readable reference image.",
        retryable: false,
      },
      providerResponseMetadata: {
        returnedCount: 0,
        retryable: false,
      },
    };
  }

  const result = await fetchApikeyFunImageViaResponses({
    apiKey,
    endpoint: baseUrl,
    model,
    prompt,
    size,
    quality: "low",
    stream: true,
    timeoutMs,
    referenceImages: images.slice(0, 3),
  });
  if (!result.ok) {
    return {
      ok: false,
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.errorType,
      message: result.message,
      diagnostic: result.diagnostic,
      providerResponseMetadata: {
        providerId: result.providerId,
        transport: result.transport,
        providerEndpoint: result.endpoint,
        providerOperation: "responses.image_generation_reference",
        requestedModel: result.requestedModel,
        returnedModel: result.returnedModel,
        ...result.metadata,
        returnedCount: 0,
        retryable: result.errorType === "network_error" || result.errorType === "timeout" || result.errorType === "server_error",
      },
    };
  }
  return {
    ok: true,
    bytes: result.bytes,
    providerRequestId: result.providerRequestId,
    providerResponseMetadata: {
      providerId: result.providerId,
      transport: result.transport,
      providerEndpoint: result.endpoint,
      providerOperation: "responses.image_generation_reference",
      requestedModel: result.requestedModel,
      returnedModel: result.returnedModel,
      returnedCount: 1,
      rawSseSha256: result.metadata.rawResponseSha256,
      ...result.metadata,
    },
  };
}

export function createRuntimeApiCurrentProjectP6RealImage2Submit(deps) {
  const {
    currentProjectP6RealImage2SubmitEndpoint,
    currentProjectP6RealImage2SubmitSerialEndpoint = `${currentProjectP6RealImage2SubmitEndpoint}-serial`,
    currentProjectRouteContext,
    currentProjectImage2OneShotResponse,
    currentProjectImage2OneShotReturnIngestResponse,
    getProviderApiKey,
    getProviderConfigStatuses,
    requestOverrideDiagnostics,
    runtimePolicy,
    runtimeFileUrl,
    scopedRepoPath,
    runtimePathExists,
    sha256Bytes,
    readFileSync,
    writeOneShotExecutorBytes,
    writeOneShotExecutorJson,
    claimOneShotExecutorJson,
    writeJson,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  const serialSubmitEndpoint = currentProjectP6RealImage2SubmitSerialEndpoint;

  function referenceImageFiles(referenceInputs) {
    if (typeof scopedRepoPath !== "function" || typeof runtimePathExists !== "function" || typeof readFileSync !== "function") return [];
    return (Array.isArray(referenceInputs) ? referenceInputs : [])
      .filter((input) => /\.(png|jpe?g|webp)$/i.test(String(input?.path || "")))
      .filter((input) => runtimePathExists(input.path))
      .slice(0, 3)
      .map((input) => ({
        id: input.id,
        type: input.type,
        name: input.name,
        path: input.path,
        fileName: fileNameForImagePath(input.path),
        mimeType: mimeTypeForImagePath(input.path),
        bytes: readFileSync(scopedRepoPath(input.path)),
        expectedSha256: input.sha256,
      }));
  }

  async function currentProjectP6RealImage2SubmitResponse(input, extra = {}, source) {
    const generatedAt = new Date().toISOString();
    const statusProjection = currentProjectImage2OneShotResponse("status", {
      selectedShotId: input.selectedShotId,
      selectedShotIds: input.selectedShotIds,
      imageCount: input.imageCount,
    }, {}, source);
    const receipt = statusProjection.receipt;
    const handoff = statusProjection.handoffPacket;
    const submitPermissionReceipt = input.submitPermissionReceipt;
    const currentSubmitPermissionReceipt = statusProjection.submitPermissionReceipt;
    const providerStatuses = getProviderConfigStatuses();
    const providerConfig = providerConfigFor(providerStatuses, input.providerId);
    const confirmation = input.confirmation || {};
    const confirmationShapeOk = confirmation.confirmed === true
      && confirmation.phrase === CONFIRM_PHRASE
      && Boolean(asString(confirmation.receiptId))
      && Boolean(asString(confirmation.confirmedAt));
    const confirmationActionMatches = Boolean(asString(receipt?.actionId))
      && confirmation.actionId === receipt?.actionId;
    const confirmationOk = confirmationShapeOk && confirmationActionMatches;
    const shotId = input.selectedShotId || receipt?.selectedShotId;
    const selectedShotIds = input.selectedShotIds?.length ? input.selectedShotIds : shotId ? [shotId] : [];
    const sandboxRoot = receipt?.sandbox?.root;
    const shotRoot = receipt?.sandbox?.shotRoot;
    const permissionReceiptId = asString(submitPermissionReceipt?.permissionReceiptId);
    const submitClaimStatePath = shotRoot && permissionReceiptId
      ? `${shotRoot}/state/provider-submit-claims/${safePathSegment(permissionReceiptId)}.json`
      : undefined;
    const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
    const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
    const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
    const sourcePrompt = handoff?.promptText || receipt?.promptText || statusProjection.promptText || "";
    const currentPromptSha256 = sourcePrompt ? sha256Bytes(Buffer.from(sourcePrompt, "utf8")) : undefined;
    const expectedOutputs = [{
      shotId,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
    }];
    const referenceInputs = referenceInputsFromStatusProjection(statusProjection);
    const referenceImages = referenceImageFiles(referenceInputs);
    const referenceImageHashesMatch = referenceImages.every((image) =>
      Boolean(image.expectedSha256) && sha256Bytes(image.bytes) === image.expectedSha256
    );
    const providerOperation = referenceImages.length ? "image.edit" : "image.generate";
    const prompt = buildImage2CleanBasePrompt({
      sourcePrompt,
      frameRole: "start_frame",
      aspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
    });
    const runId = `p6_real_image2_${safePathSegment(statusProjection.projectId)}_${safePathSegment(shotId)}_${Date.now()}`;
    const evidenceRoot = `${shotRoot}/p6-real-image2/${runId}`;
    const planOutputRoot = projectRelativePath(evidenceRoot, statusProjection.projectRoot);
    const planExpectedOutputs = expectedOutputs.map((output) => ({
      shotId: output.shotId,
      expectedOutputPath: projectRelativePath(output.expectedOutputPath, statusProjection.projectRoot),
      providerObservationPath: projectRelativePath(output.providerObservationPath, statusProjection.projectRoot),
      semanticQaPath: projectRelativePath(output.semanticQaPath, statusProjection.projectRoot),
    }));
    const planReferenceInputs = referenceInputs.map((input) => ({
      ...input,
      path: projectRelativePath(input.path, statusProjection.projectRoot),
    }));
    const credentialRef = `secret-store://providers/${input.providerId}/default`;
    const basePlan = buildP6RealImage2Plan({
      generatedAt,
      runId,
      shotIds: selectedShotIds,
      prompt,
      imageCount: selectedShotIds.length,
      providerId: input.providerId,
      providerBaseUrl: providerConfig?.baseUrl || "",
      credentialRef,
      outputRoot: planOutputRoot || "",
      expectedOutputs: planExpectedOutputs,
      referenceInputs: planReferenceInputs,
      submitPermissionReceipt: permissionReceiptLike(submitPermissionReceipt),
      actionTimeConfirmation: {
        confirmed: confirmationOk,
        phrase: confirmation.phrase || "",
        confirmedAt: confirmation.confirmedAt,
      },
    });
    const plan = {
      ...basePlan,
      identity: {
        projectId: receipt?.projectId,
        projectRoot: receipt?.projectRoot,
        projectFactHash: receipt?.projectFactHash,
        actionId: receipt?.actionId,
        confirmationId: confirmation.receiptId,
        permissionReceiptId,
        promptSha256: currentPromptSha256,
        referenceInputs: planReferenceInputs,
      },
    };
    const identityBlockers = uniqueStrings([
      statusProjection.ok === true ? "" : "请先准备单镜头小样。",
      receipt?.status === "prepared" ? "" : "请先准备并确认小样包。",
      handoff?.status === "ready_for_manual_transport" ? "" : "请先完成小样动作确认。",
      submitPermissionReceipt?.status === "pending_action_time_confirmation" ? "" : "请先生成许可回执。",
      permissionReceiptId ? "" : "许可回执缺少单次提交标识，请重新准备。",
      submitClaimStatePath && !runtimePathExists(submitClaimStatePath) ? "" : "该许可回执已经提交过，请重新准备后再试。",
      prepareReceiptMatchesCurrent(input.receipt, receipt) ? "" : "提交使用的 prepare receipt 已过期或与当前项目不一致。",
      permissionReceiptMatchesCurrent(submitPermissionReceipt, currentSubmitPermissionReceipt) ? "" : "许可回执已过期或与当前项目不一致，请重新准备。",
      submitPermissionReceipt?.receiptId === receipt?.receiptId && submitPermissionReceipt?.handoffId === handoff?.packetId
        ? ""
        : "许可回执与当前 handoff 不一致。",
      submitPermissionReceipt?.projectId === receipt?.projectId
        && submitPermissionReceipt?.projectRoot === receipt?.projectRoot
        && submitPermissionReceipt?.projectFactHash === receipt?.projectFactHash
        && submitPermissionReceipt?.actionId === receipt?.actionId
        ? ""
        : "许可回执与当前项目事实或动作不一致。",
      submitPermissionReceipt?.providerId === input.providerId && receipt?.providerId === input.providerId
        ? ""
        : "许可回执与当前图片 provider 不一致。",
      sameStringArray(selectedShotIds, receipt?.selectedShotIds)
        && sameStringArray(selectedShotIds, submitPermissionReceipt?.selectedShotIds)
        ? ""
        : "许可回执与当前镜头选择不一致。",
      expectedOutputsEqual(submitPermissionReceipt?.expectedOutputs, expectedOutputs)
        ? ""
        : "许可回执与当前输出或 QA 路径不一致。",
      referenceInputsEqual(submitPermissionReceipt?.referenceInputs, referenceInputs) && referenceImageHashesMatch
        ? ""
        : "当前参考文件与许可回执不一致，请重新准备。",
      currentPromptSha256
        && currentPromptSha256 === receipt?.promptSha256
        && currentPromptSha256 === handoff?.promptSha256
        && currentPromptSha256 === submitPermissionReceipt?.promptSha256
        ? ""
        : "当前提示词与许可回执不一致，请重新准备。",
      confirmationShapeOk ? "" : "需要在提交前明确确认本次只生成 1 张图。",
      confirmationActionMatches ? "" : "本次确认与当前生成 actionId 不一致。",
      input.imageCount === 1 && selectedShotIds.length === 1 ? "" : "P6 App 入口只允许 1-shot。",
      planOutputRoot
        && planExpectedOutputs.every((output) => output.expectedOutputPath && output.providerObservationPath && output.semanticQaPath)
        && planReferenceInputs.every((input) => input.path)
        ? ""
        : "P6 证据路径必须位于当前项目根内。",
      plan.status === "ready_for_live_submit" ? "" : plan.blockers[0],
    ]);
    const apiKey = identityBlockers.length === 0 ? getProviderApiKey(input.providerId) : undefined;
    const blockers = uniqueStrings([
      ...identityBlockers,
      providerConfig ? "" : "未找到可用的出图配置。",
      providerConfig?.credential?.keyStatus === "configured" && apiKey ? "" : "请先在设置里保存生图 Key。",
    ]);

    const submitClaim = {
      schemaVersion: "p6_real_image2_provider_submit_claim_v1",
      status: "provider_submit_claimed",
      claimedAt: generatedAt,
      permissionReceiptId,
      prepareReceiptId: receipt?.receiptId,
      handoffId: handoff?.packetId,
      projectId: receipt?.projectId,
      projectRoot: receipt?.projectRoot,
      projectFactHash: receipt?.projectFactHash,
      actionId: receipt?.actionId,
      confirmationId: confirmation.receiptId,
      promptSha256: currentPromptSha256,
      selectedShotIds,
      providerId: input.providerId,
      referenceInputs,
      providerCalled: false,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      projectVibeWritten: false,
    };
    const writeSubmitClaim = (patch = {}) => writeOneShotExecutorJson(submitClaimStatePath, {
      ...submitClaim,
      ...patch,
    }, sandboxRoot, shotRoot);
    if (blockers.length === 0 && !claimOneShotExecutorJson(submitClaimStatePath, submitClaim, sandboxRoot, shotRoot)) {
      blockers.push("该许可回执已经提交过，请重新准备后再试。");
    }

    if (blockers.length > 0) {
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "p6_real_image2_one_shot_submit",
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: true,
        }),
        endpoint: currentProjectP6RealImage2SubmitEndpoint,
        source: "runtime_endpoint",
        projectionKind: "current_project_p6_real_image2_submit",
        status: "blocked",
        uiStatus: "blocked",
        userLabel: "待处理",
        currentProject: statusProjection.currentProject,
        requestContext: statusProjection.requestContext,
        projectRootMode: source.projectRootMode,
        projectRoot: statusProjection.projectRoot,
        projectId: statusProjection.projectId,
        projectFactHash: receipt?.projectFactHash,
        actionId: receipt?.actionId,
        confirmationId: confirmation.receiptId,
        permissionReceiptId,
        promptSha256: currentPromptSha256,
        project: statusProjection.project,
        selectedShotId: shotId,
        providerId: input.providerId,
        providerKeyConfigured: providerConfig?.credential?.keyStatus === "configured",
        plan,
        previewProjection: {
          shotId,
          status: "blocked",
          reviewRequired: false,
        },
        p6Ingest: undefined,
        providerCalled: false,
        runtimeProviderSubmitAttempted: false,
        runtimeExternalNetworkCallMade: false,
        formalPromotionBlocked: true,
        liveSubmitAllowed: false,
        projectVibeWritten: false,
        workerSpawnForbidden: true,
        blockers,
        message: blockers[0],
        ...extra,
      };
    }

    writeOneShotExecutorJson(`${evidenceRoot}/submit-plan.json`, plan, sandboxRoot, shotRoot);
    writeOneShotExecutorJson(`${evidenceRoot}/action-confirmation.json`, {
      schemaVersion: "p6_real_image2_action_confirmation_v1",
      receiptId: confirmation.receiptId,
      permissionReceiptId,
      projectId: receipt.projectId,
      projectRoot: receipt.projectRoot,
      projectFactHash: receipt.projectFactHash,
      actionId: receipt.actionId,
      promptSha256: currentPromptSha256,
      confirmedAt: confirmation.confirmedAt,
      selectedShotIds,
      phraseMatched: true,
      providerId: input.providerId,
      referenceInputs,
      rawCredentialMaterialPresent: false,
    }, sandboxRoot, shotRoot);

    if (!input.mockProviderResult) {
      writeSubmitClaim({
        status: "provider_submit_attempted",
        attemptedAt: new Date().toISOString(),
        providerCalled: !input.mockProviderResult,
        runtimeProviderSubmitAttempted: true,
        runtimeExternalNetworkCallMade: true,
      });
    }

    const providerResult = input.mockProviderResult
      ? input.mockProviderResultStatus === "missing"
        ? {
          ok: false,
          statusCode: 502,
          errorType: "provider_missing",
          failureKind: "provider_missing",
          message: "出图服务没有返回可用图片，可以重试一次。",
          diagnostic: {
            kind: "parse_error",
            message: "Mock Image2 provider returned no image.",
            retryable: true,
          },
          providerResponseMetadata: { mockProviderResult: true, returnedCount: 0, retryable: true },
        }
        : {
          ok: true,
          bytes: MOCK_PNG,
          providerRequestId: `mock_apikey_fun_image2_${Date.now()}`,
          providerResponseMetadata: { mockProviderResult: true, returnedCount: 1, semanticQaStatus: input.mockProviderResultStatus || "needs_review" },
        }
      : providerOperation === "image.edit"
        ? await fetchImageEditBytesFromProvider({
          apiKey,
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.imageModel,
          prompt,
          size: IMAGE2_GENERATE_DEFAULT_SIZE,
          referenceImages,
        })
        : await fetchImageBytesFromProvider({
          apiKey,
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.imageModel,
          prompt,
          size: IMAGE2_GENERATE_DEFAULT_SIZE,
        });
    const rawSsePath = `${evidenceRoot}/provider-response.sse.txt`;
    const rawSseFilePath = providerResult.rawSseBytes?.length
      ? writeOneShotExecutorBytes(rawSsePath, providerResult.rawSseBytes, sandboxRoot, shotRoot)
      : undefined;

    if (!providerResult.ok) {
      writeSubmitClaim({
        status: input.mockProviderResult ? "mock_submit_consumed" : "provider_submit_failed",
        completedAt: new Date().toISOString(),
        providerCalled: !input.mockProviderResult,
        runtimeProviderSubmitAttempted: !input.mockProviderResult,
        runtimeExternalNetworkCallMade: !input.mockProviderResult,
        providerRequestId: providerResult.providerRequestId,
        failureKind: providerResult.failureKind || providerResult.errorType,
      });
      const providerObservation = {
        schemaVersion: "p6_real_image2_provider_observation_v1",
        generatedAt,
        receiptId: receipt.receiptId,
        projectId: receipt.projectId,
        projectRoot: receipt.projectRoot,
        projectFactHash: receipt.projectFactHash,
        actionId: receipt.actionId,
        confirmationId: confirmation.receiptId,
        promptSha256: currentPromptSha256,
        providerObservationReceiptId: `p6_provider_observation_${safePathSegment(runId)}_${safePathSegment(shotId)}_missing`,
        receiptPath: providerObservationPath,
        runId,
        shotId,
        selectedShotId: shotId,
        selectedShotIds,
        submitPermissionReceiptId: permissionReceiptId,
        handoffPacketId: handoff.packetId,
        provider: input.providerId,
        providerId: input.providerId,
      baseUrl: providerConfig.baseUrl,
      model: providerConfig.imageModel,
      requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
      requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
      providerOperation,
      providerObservationMode: input.mockProviderResult ? "mock_provider_returned_no_image" : "provider_call_failed_or_empty",
        providerTransport: providerResult.providerResponseMetadata?.transport,
        providerTransportOperation: providerResult.providerResponseMetadata?.providerOperation,
        rawSsePath: rawSseFilePath ? rawSsePath : undefined,
        rawSseSha256: providerResult.providerResponseMetadata?.rawSseSha256,
        referenceInputs,
        referenceVisualInputCount: referenceImages.length,
        referenceVisualInputPaths: referenceImages.map((item) => item.path),
        outputPath: expectedOutputPath,
        providerCalled: !input.mockProviderResult,
        actualImage2Triggered: !input.mockProviderResult,
        providerCallsAttempted: input.mockProviderResult ? 0 : 1,
        maxProviderCallsPerExecution: 1,
        externalNetworkCallMade: !input.mockProviderResult,
        rawCredentialMaterialSeen: false,
        workerSpawned: false,
        projectVibeWritten: false,
        statusCode: providerResult.statusCode,
        errorType: providerResult.errorType,
        failureKind: providerResult.failureKind,
        message: providerResult.message,
        diagnostic: providerResult.diagnostic,
        providerResponseMetadata: providerResult.providerResponseMetadata,
      };
      const semanticQa = {
        schemaVersion: "p6_real_image2_semantic_qa_v1",
        generatedAt,
        reviewedAt: generatedAt,
        receiptId: receipt.receiptId,
        projectId: receipt.projectId,
        projectRoot: receipt.projectRoot,
        projectFactHash: receipt.projectFactHash,
        actionId: receipt.actionId,
        confirmationId: confirmation.receiptId,
        promptSha256: currentPromptSha256,
        semanticQaReceiptId: `p6_semantic_qa_${safePathSegment(runId)}_${safePathSegment(shotId)}_missing`,
        receiptPath: semanticQaPath,
        runId,
        shotId,
        selectedShotId: shotId,
        selectedShotIds,
        submitPermissionReceiptId: permissionReceiptId,
        semanticReviewMode: "missing_output_placeholder",
        outputPath: expectedOutputPath,
        expectedOutputPath,
        status: "missing",
        qaStatus: "missing",
        finalAssessment: {
          status: "missing",
          reason: providerResult.message,
          retryable: providerResult.providerResponseMetadata?.retryable === true,
        },
        providerCalled: !input.mockProviderResult,
        actualImage2Triggered: !input.mockProviderResult,
      };
      writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
      writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
      const planExpectedOutput = plan.expectedOutputs[0];
      const ingest = buildP6RealImage2ReturnIngest({
        generatedAt: new Date().toISOString(),
        plan,
        returnedOutputs: [{
          shotId,
          outputPath: planExpectedOutput?.expectedOutputPath,
          providerObservationPresent: true,
          semanticQaStatus: "missing",
          providerObservation: {
            ...providerObservation,
            receiptPath: planExpectedOutput?.providerObservationPath,
            outputPath: planExpectedOutput?.expectedOutputPath,
          },
          semanticQa: {
            ...semanticQa,
            receiptPath: planExpectedOutput?.semanticQaPath,
            outputPath: planExpectedOutput?.expectedOutputPath,
            expectedOutputPath: planExpectedOutput?.expectedOutputPath,
          },
          providerSelfReportedSuccess: false,
        }],
      });
      writeOneShotExecutorJson(`${evidenceRoot}/return-ingest.json`, ingest, sandboxRoot, shotRoot);
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "p6_real_image2_one_shot_submit",
          providerCalled: !input.mockProviderResult,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: input.mockProviderResult,
        }),
        endpoint: currentProjectP6RealImage2SubmitEndpoint,
        source: "runtime_endpoint",
        projectionKind: "current_project_p6_real_image2_submit",
        status: "missing",
        uiStatus: "missing",
        userLabel: "未发现回流",
        projectId: receipt.projectId,
        projectRoot: receipt.projectRoot,
        projectFactHash: receipt.projectFactHash,
        actionId: receipt.actionId,
        confirmationId: confirmation.receiptId,
        promptSha256: currentPromptSha256,
        selectedShotId: shotId,
        selectedShotIds,
        providerId: input.providerId,
        requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
        requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
        providerOperation,
        referenceVisualInputCount: referenceImages.length,
        providerCalled: !input.mockProviderResult,
        runtimeProviderSubmitAttempted: !input.mockProviderResult,
        runtimeExternalNetworkCallMade: !input.mockProviderResult,
        formalPromotionBlocked: true,
        formalPromotionBlockedReasons: ingest.promotionGate.blockers,
        liveSubmitAllowed: false,
        projectVibeWritten: false,
        workerSpawnForbidden: true,
        plan,
        p6Ingest: ingest,
        previewProjection: {
          shotId,
          status: "missing",
          reviewRequired: false,
          providerCalled: !input.mockProviderResult,
          actualImage2Triggered: !input.mockProviderResult,
        },
        blockers: [providerResult.message],
        message: providerResult.message,
        retryAvailable: providerResult.providerResponseMetadata?.retryable === true,
        retryHint: providerResult.providerResponseMetadata?.retryable === true ? "可以再次点击生成重试。" : undefined,
        providerFailureKind: providerResult.failureKind,
        providerErrorType: providerResult.errorType,
        providerDiagnostic: providerResult.diagnostic,
        ...extra,
      };
    }

    const outputFilePath = writeOneShotExecutorBytes(expectedOutputPath, providerResult.bytes, sandboxRoot, shotRoot);
    const outputSha256 = sha256Bytes(providerResult.bytes);
    writeSubmitClaim({
      status: input.mockProviderResult ? "mock_submit_consumed" : "provider_submit_succeeded",
      completedAt: new Date().toISOString(),
      providerCalled: !input.mockProviderResult,
      runtimeProviderSubmitAttempted: !input.mockProviderResult,
      runtimeExternalNetworkCallMade: !input.mockProviderResult,
      providerRequestId: providerResult.providerRequestId,
      outputPath: projectRelativePath(expectedOutputPath, statusProjection.projectRoot),
      outputSha256,
    });
    const providerObservation = {
      schemaVersion: "p6_real_image2_provider_observation_v1",
      generatedAt,
      receiptId: receipt.receiptId,
      projectId: receipt.projectId,
      projectRoot: receipt.projectRoot,
      projectFactHash: receipt.projectFactHash,
      actionId: receipt.actionId,
      confirmationId: confirmation.receiptId,
      promptSha256: currentPromptSha256,
      providerObservationReceiptId: `p6_provider_observation_${safePathSegment(runId)}_${safePathSegment(shotId)}`,
      receiptPath: providerObservationPath,
      runId,
      shotId,
      selectedShotId: shotId,
      selectedShotIds,
      submitPermissionReceiptId: permissionReceiptId,
      handoffPacketId: handoff.packetId,
      providerRequestId: providerResult.providerRequestId,
      provider: input.providerId,
      providerId: input.providerId,
      baseUrl: providerConfig.baseUrl,
      model: providerConfig.imageModel,
      requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
      requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
      providerOperation,
      providerTransport: providerResult.providerResponseMetadata?.transport,
      providerTransportOperation: providerResult.providerResponseMetadata?.providerOperation,
      providerObservationMode: input.mockProviderResult ? "mock_provider_result" : "actual_provider_call_observed",
      rawSsePath: rawSseFilePath ? rawSsePath : undefined,
      rawSseSha256: providerResult.providerResponseMetadata?.rawSseSha256,
      referenceInputs,
      referenceVisualInputCount: referenceImages.length,
      referenceVisualInputPaths: referenceImages.map((item) => item.path),
      outputPath: expectedOutputPath,
      outputSha256,
      outputBytes: providerResult.bytes.length,
      providerCalled: !input.mockProviderResult,
      actualImage2Triggered: !input.mockProviderResult,
      providerCallsAttempted: input.mockProviderResult ? 0 : 1,
      maxProviderCallsPerExecution: 1,
      externalNetworkCallMade: !input.mockProviderResult,
      rawCredentialMaterialSeen: false,
      workerSpawned: false,
      projectVibeWritten: false,
      providerResponseMetadata: providerResult.providerResponseMetadata,
    };
    const semanticQaStatus = input.mockProviderResultStatus === "success" ? "success" : "needs_review";
    const semanticQa = {
      schemaVersion: "p6_real_image2_semantic_qa_v1",
      generatedAt,
      reviewedAt: generatedAt,
      receiptId: receipt.receiptId,
      projectId: receipt.projectId,
      projectRoot: receipt.projectRoot,
      projectFactHash: receipt.projectFactHash,
      actionId: receipt.actionId,
      confirmationId: confirmation.receiptId,
      promptSha256: currentPromptSha256,
      semanticQaReceiptId: `p6_semantic_qa_${safePathSegment(runId)}_${safePathSegment(shotId)}`,
      receiptPath: semanticQaPath,
      runId,
      shotId,
      selectedShotId: shotId,
      selectedShotIds,
      submitPermissionReceiptId: permissionReceiptId,
      semanticReviewMode: input.mockProviderResult ? "mock_image_semantic_review" : "actual_image_semantic_review",
      outputPath: expectedOutputPath,
      expectedOutputPath,
      outputSha256,
      reviewedOutputSha256: outputSha256,
      status: semanticQaStatus,
      qaStatus: semanticQaStatus,
      finalAssessment: {
        status: semanticQaStatus,
        reason: input.mockProviderResult
          ? semanticQaStatus === "success" ? "Mock Image2 结果已验证。" : "Mock Image2 结果等待测试复核。"
          : "真实 Image2 结果已回流，进入人工复核。",
      },
      providerCalled: !input.mockProviderResult,
      actualImage2Triggered: !input.mockProviderResult,
    };
    writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
    writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);

    const returnProjection = currentProjectImage2OneShotReturnIngestResponse({
      selectedShotId: shotId,
      selectedShotIds,
      imageCount: 1,
      receiptId: receipt.receiptId,
      expectedOutputPath,
      actualProviderReturned: !input.mockProviderResult,
      returnedOutputPath: expectedOutputPath,
      providerRequestId: providerResult.providerRequestId,
      providerName: input.providerId,
      providerObservation,
      semanticQa,
      executorMode: input.mockProviderResult ? "dry_run_executor" : "external_provider_return",
    }, {}, source);
    const planExpectedOutput = plan.expectedOutputs[0];
    const ingest = buildP6RealImage2ReturnIngest({
      generatedAt: new Date().toISOString(),
      plan,
      returnedOutputs: [{
        shotId,
        outputPath: planExpectedOutput?.expectedOutputPath,
        sha256: outputSha256,
        providerObservationPresent: true,
        semanticQaStatus,
        providerObservation: {
          ...providerObservation,
          receiptPath: planExpectedOutput?.providerObservationPath,
          outputPath: planExpectedOutput?.expectedOutputPath,
        },
        semanticQa: {
          ...semanticQa,
          receiptPath: planExpectedOutput?.semanticQaPath,
          outputPath: planExpectedOutput?.expectedOutputPath,
          expectedOutputPath: planExpectedOutput?.expectedOutputPath,
        },
        providerSelfReportedSuccess: true,
      }],
    });
    writeOneShotExecutorJson(`${evidenceRoot}/return-ingest.json`, ingest, sandboxRoot, shotRoot);

    return {
      ok: ingest.summary.previewEligible > 0,
      ...runtimePolicy({
        runMode: "p6_real_image2_one_shot_submit",
        providerCalled: !input.mockProviderResult,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: input.mockProviderResult,
      }),
      endpoint: currentProjectP6RealImage2SubmitEndpoint,
      source: "runtime_endpoint",
      projectionKind: "current_project_p6_real_image2_submit",
      status: ingest.previewItems[0]?.status || "missing",
      uiStatus: ingest.previewItems[0]?.status || "missing",
      userLabel: ingest.previewItems[0]?.status === "verified" ? "已验证" : "需要复核",
      currentProject: statusProjection.currentProject,
      requestContext: {
        ...statusProjection.requestContext,
        selectedShotId: shotId,
        p6ConfirmationReceiptId: confirmation.receiptId,
      },
      projectRootMode: source.projectRootMode,
      projectRoot: statusProjection.projectRoot,
      projectId: statusProjection.projectId,
      projectFactHash: receipt.projectFactHash,
      actionId: receipt.actionId,
      confirmationId: confirmation.receiptId,
      promptSha256: currentPromptSha256,
      project: statusProjection.project,
      selectedShotId: shotId,
      selectedShotIds,
      providerId: input.providerId,
      requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
      requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
      providerOperation,
      referenceVisualInputCount: referenceImages.length,
      runId,
      outputPath: planExpectedOutput?.expectedOutputPath,
      outputFilePath,
      outputSha256,
      evidenceRoot: plan.outputRoot,
      evidenceRootFilePath: evidenceRoot,
      plan,
      p6Ingest: ingest,
      returnProjection,
      previewProjection: {
        shotId,
        status: ingest.previewItems[0]?.status || "missing",
        imageUrl: ingest.previewItems.length ? runtimeFileUrl(expectedOutputPath) : undefined,
        reviewRequired: ingest.previewItems[0]?.status === "needs_review",
        providerCalled: !input.mockProviderResult,
        actualImage2Triggered: !input.mockProviderResult,
      },
      providerCalled: !input.mockProviderResult,
      runtimeProviderSubmitAttempted: !input.mockProviderResult,
      runtimeExternalNetworkCallMade: !input.mockProviderResult,
      formalPromotionBlocked: true,
      formalPromotionBlockedReasons: ingest.promotionGate.blockers,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers: ingest.blockers,
      message: ingest.previewItems.length ? "画面已回流，等待人工复核。" : "回流证据不完整，预览暂不使用。",
      ...extra,
    };
  }

  function serialShotInputFor(input, shotId) {
    const shot = input.shots.find((item) => item.selectedShotId === shotId || item.shotId === shotId) || {};
    const mockProviderResult = normalizeMockProviderResult(
      shot.mockProviderResult === undefined
        ? input.mockProviderResult
          ? { status: input.mockProviderResultStatus || "needs_review" }
          : undefined
        : shot.mockProviderResult,
    );
    return {
      selectedShotId: shotId,
      selectedShotIds: [shotId],
      imageCount: 1,
      receipt: isRecord(shot.receipt) ? shot.receipt : undefined,
      submitPermissionReceipt: isRecord(shot.submitPermissionReceipt) ? shot.submitPermissionReceipt : undefined,
      confirmation: isRecord(shot.confirmation) ? shot.confirmation : undefined,
      providerId: asString(shot.providerId) || input.providerId,
      submitMode: asString(shot.submitMode) || input.submitMode,
      mockProviderResult: mockProviderResult.enabled,
      mockProviderResultStatus: mockProviderResult.status,
    };
  }

  async function currentProjectP6RealImage2SerialSubmitResponse(input, extra = {}, source) {
    const selectedShotIds = uniqueStrings(input.selectedShotIds);
    const generatedAt = new Date().toISOString();
    if (selectedShotIds.length < 1 || selectedShotIds.length > 3) {
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "p6_real_image2_serial_submit",
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: input.mockProviderResult,
        }),
        endpoint: serialSubmitEndpoint,
        source: "runtime_endpoint",
        projectionKind: "current_project_p6_real_image2_serial_submit",
        status: "blocked",
        uiStatus: "blocked",
        selectedShotIds,
        maxConcurrency: 1,
        maxAutoRetries: 0,
        formalPromotionBlocked: true,
        blockers: ["P6 serial submit requires 1 to 3 unique shot ids."],
        message: "P6 serial submit requires 1 to 3 unique shot ids.",
        ...extra,
      };
    }

    const serialRunId = `p6_real_image2_serial_${Date.now()}`;
    const shotResults = [];
    for (const [index, shotId] of selectedShotIds.entries()) {
      const result = await currentProjectP6RealImage2SubmitResponse(serialShotInputFor(input, shotId), {
        ...extra,
        serialBatchRunId: serialRunId,
        serialBatchOrder: index + 1,
        serialBatchTotal: selectedShotIds.length,
      }, source);
      const ingestStatus = result.p6Ingest?.shotStatuses?.find((item) => item.shotId === shotId)?.status;
      const status = ingestStatus === "verified" || ingestStatus === "needs_review" ? ingestStatus : "missing";
      shotResults.push({
        shotId,
        order: index + 1,
        status,
        ok: result.ok === true,
        httpStatus: result.ok === false ? 409 : 200,
        selectedShotId: result.selectedShotId,
        runId: result.runId,
        outputPath: result.outputPath,
        outputFilePath: result.outputFilePath,
        outputSha256: result.outputSha256,
        previewProjection: result.previewProjection,
        p6Ingest: result.p6Ingest,
        providerCalled: result.providerCalled === true,
        runtimeProviderSubmitAttempted: result.runtimeProviderSubmitAttempted === true,
        runtimeExternalNetworkCallMade: result.runtimeExternalNetworkCallMade === true,
        formalPromotionBlocked: result.formalPromotionBlocked !== false,
        blockers: result.blockers || [],
        message: result.message,
      });
    }

    const success = shotResults.filter((item) => item.status === "verified").length;
    const needsReview = shotResults.filter((item) => item.status === "needs_review").length;
    const missing = shotResults.filter((item) => item.status === "missing").length;
    const blockers = uniqueStrings(shotResults.flatMap((item) => item.blockers || []));
    return {
      ok: success + needsReview > 0 && missing === 0,
      ...runtimePolicy({
        runMode: "p6_real_image2_serial_submit",
        providerCalled: shotResults.some((item) => item.providerCalled),
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: input.mockProviderResult,
      }),
      endpoint: serialSubmitEndpoint,
      source: "runtime_endpoint",
      projectionKind: "current_project_p6_real_image2_serial_submit",
      status: missing ? "partial_or_missing" : "return_ingested",
      uiStatus: missing ? "needs_review" : needsReview ? "needs_review" : "verified",
      generatedAt,
      serialBatchRunId: serialRunId,
      selectedShotIds,
      providerId: input.providerId,
      maxConcurrency: 1,
      maxAutoRetries: 0,
      providerRequestStrategy: "serial_one_shot",
      providerCallCount: shotResults.filter((item) => item.providerCalled).length,
      summary: {
        total: selectedShotIds.length,
        success,
        verified: success,
        needsReview,
        missing,
        previewEligible: success + needsReview,
        promotionAllowed: false,
      },
      shotResults,
      providerCalled: shotResults.some((item) => item.providerCalled),
      runtimeProviderSubmitAttempted: shotResults.some((item) => item.runtimeProviderSubmitAttempted),
      runtimeExternalNetworkCallMade: shotResults.some((item) => item.runtimeExternalNetworkCallMade),
      formalPromotionBlocked: true,
      formalPromotionBlockedReasons: ["Serial batch defaults to no promotion; explicit human QA and authorization are required."],
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers,
      message: missing
        ? `${missing} shot(s) stayed missing/blocked placeholders; no retry or concurrency expansion was attempted.`
        : "Serial 1-shot batch completed; promotion remains blocked by default.",
      ...extra,
    };
  }

  async function handleCurrentProjectP6RealImage2SubmitRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectP6RealImage2SubmitEndpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectP6RealImage2SubmitEndpoint);
    if (!routeContext) return true;
    const input = p6SubmitRequestInput(url, routeContext.body);
    const payload = await currentProjectP6RealImage2SubmitResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  async function handleCurrentProjectP6RealImage2SerialSubmitRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== serialSubmitEndpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, serialSubmitEndpoint);
    if (!routeContext) return true;
    const input = p6SerialSubmitRequestInput(url, routeContext.body);
    const payload = await currentProjectP6RealImage2SerialSubmitResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false && payload.summary?.previewEligible === 0 ? 409 : 200, payload);
    return true;
  }

  return {
    p6SubmitRequestInput,
    p6SerialSubmitRequestInput,
    currentProjectP6RealImage2SubmitResponse,
    currentProjectP6RealImage2SerialSubmitResponse,
    handleCurrentProjectP6RealImage2SubmitRoute,
    handleCurrentProjectP6RealImage2SerialSubmitRoute,
  };
}
