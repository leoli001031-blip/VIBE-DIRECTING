function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireFunction(value, name) {
  if (typeof value !== "function") {
    throw new Error(`createRuntimeApiProviderReturnEvidence requires ${name}`);
  }
}

export function createRuntimeApiProviderReturnEvidence({
  runtimeRelativeFromValue,
  readRuntimeJson,
} = {}) {
  requireFunction(runtimeRelativeFromValue, "runtimeRelativeFromValue");
  requireFunction(readRuntimeJson, "readRuntimeJson");

  function providerObservationContextBlockers(providerObservation, expectedContext = {}) {
    if (!isRecord(providerObservation)) return ["Provider observation sidecar is required."];
    const blockers = [];
    const selectedShotId = asString(expectedContext.selectedShotId);
    const receiptId = asString(expectedContext.receiptId);
    const handoffPacketId = asString(expectedContext.handoffPacketId);
    if (!asString(providerObservation.selectedShotId)) {
      blockers.push("Provider observation must include selectedShotId for the current shot.");
    } else if (selectedShotId && asString(providerObservation.selectedShotId) !== selectedShotId) {
      blockers.push("Provider observation selectedShotId does not match the current shot.");
    }
    if (!asString(providerObservation.receiptId)) {
      blockers.push("Provider observation must include receiptId for the current receipt.");
    } else if (receiptId && asString(providerObservation.receiptId) !== receiptId) {
      blockers.push("Provider observation receiptId does not match the current receipt.");
    }
    if (!asString(providerObservation.handoffPacketId)) {
      blockers.push("Provider observation must include handoffPacketId for the current handoff.");
    } else if (handoffPacketId && asString(providerObservation.handoffPacketId) !== handoffPacketId) {
      blockers.push("Provider observation handoffPacketId does not match the current handoff.");
    }
    return blockers;
  }

  function actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, expectedContext = {}) {
    if (!isRecord(providerObservation)) return false;
    const provider = String(providerObservation.provider || providerObservation.providerId || "");
    const outputPath = runtimeRelativeFromValue(providerObservation.outputPath);
    const observedHash = asString(providerObservation.outputSha256) || asString(providerObservation.outputHash);
    const providerRequestId = asString(providerObservation.providerRequestId);
    const contextMatches = providerObservationContextBlockers(providerObservation, expectedContext).length === 0;
    return providerObservation.providerObservationMode === "actual_provider_call_observed"
      && /image2/i.test(provider)
      && Boolean(providerRequestId)
      && contextMatches
      && outputPath === expectedOutputPath
      && observedHash === outputSha256
      && providerObservation.providerCalled === true
      && providerObservation.actualImage2Triggered === true;
  }

  function actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256) {
    if (!isRecord(semanticQa)) return false;
    const outputPath = runtimeRelativeFromValue(semanticQa.outputPath) || runtimeRelativeFromValue(semanticQa.expectedOutputPath);
    const reviewedHash = asString(semanticQa.reviewedOutputSha256) || asString(semanticQa.outputSha256);
    const status = semanticQa.finalAssessment?.status || semanticQa.qaStatus || semanticQa.status;
    return semanticQa.semanticReviewMode === "actual_image_semantic_review"
      && outputPath === expectedOutputPath
      && reviewedHash === outputSha256
      && status === "needs_review";
  }

  function readReturnedJson(inputObject, inputPath) {
    if (isRecord(inputObject)) return inputObject;
    return inputPath ? readRuntimeJson(inputPath) : undefined;
  }

  return {
    providerObservationContextBlockers,
    actualProviderObservationMatches,
    actualSemanticQaMatches,
    readReturnedJson,
  };
}
