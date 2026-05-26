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

function baseOneShotRequestInput(url, body) {
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

export function oneShotReturnRequestInput(url, body) {
  const input = baseOneShotRequestInput(url, body);
  const providerName = requestBodyString(body, ["providerName", "provider"]) || "openai_image2_via_agent_imagegen";
  const executorMode = requestBodyString(body, ["executorMode", "mode"]);
  return {
    ...input,
    receiptId: asString(url.searchParams.get("receiptId")) || requestBodyString(body, ["receiptId"]),
    sourceImagePath: requestBodyString(body, ["sourceImagePath", "generatedImagePath", "providerOutputPath"]),
    actualProviderReturned: body?.actualProviderReturned === true,
    returnedOutputPath: requestBodyString(body, ["returnedOutputPath", "providerOutputPath", "actualOutputPath", "sourceImagePath", "generatedImagePath"]),
    returnedProviderObservationPath: requestBodyString(body, ["returnedProviderObservationPath", "actualProviderObservationPath"]),
    returnedSemanticQaPath: requestBodyString(body, ["returnedSemanticQaPath", "actualSemanticQaPath"]),
    providerObservation: isRecord(body?.providerObservation) ? body.providerObservation : undefined,
    semanticQa: isRecord(body?.semanticQa) ? body.semanticQa : undefined,
    providerRequestId: requestBodyString(body, ["providerRequestId"]),
    providerName,
    provider: providerName,
    executorMode,
    mode: executorMode,
    providerObservationMode: requestBodyString(body, ["providerObservationMode"]) || "actual_provider_call_observed",
    actualImage2Triggered: body?.actualImage2Triggered === true,
    providerCalled: body?.providerCalled === true,
    rawBody: isRecord(body) ? body : {},
  };
}

export function createRuntimeApiCurrentProjectOneShotReturnRoutes(deps) {
  const {
    currentProjectImage2OneShotReturnEndpoint,
    currentProjectImage2OneShotExecuteReturnEndpoint,
    currentProjectRouteContext,
    writeJson,
    requestOverrideDiagnostics,
    currentProjectImage2OneShotReturnIngestResponse,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  async function handleCurrentProjectOneShotReturnRoute(req, res, url) {
    if (req.method !== "POST" || (
      url.pathname !== currentProjectImage2OneShotReturnEndpoint
      && url.pathname !== currentProjectImage2OneShotExecuteReturnEndpoint
    )) {
      return false;
    }

    const routeContext = await currentProjectRouteContext(req, res, url, url.pathname);
    if (!routeContext) return true;
    const input = oneShotReturnRequestInput(url, routeContext.body);
    const payload = currentProjectImage2OneShotReturnIngestResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    oneShotReturnRequestInput,
    handleCurrentProjectOneShotReturnRoute,
  };
}
