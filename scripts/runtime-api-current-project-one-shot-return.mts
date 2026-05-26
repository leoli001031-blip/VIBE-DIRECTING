function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function upsertByShotId(items, item) {
  const existingItems = Array.isArray(items) ? items.filter(isRecord) : [];
  const index = existingItems.findIndex((candidate) => candidate.shotId === item.shotId);
  if (index >= 0) {
    existingItems[index] = { ...existingItems[index], ...item };
    return existingItems;
  }
  return [...existingItems, item];
}

function safePathSegment(value) {
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
}

export function createRuntimeApiCurrentProjectOneShotReturn(deps) {
  const {
    currentProjectSource,
    currentProjectImage2OneShotResponse,
    oneShotStateJson,
    oneShotExecutorContract,
    readReturnedJson,
    readRuntimeJson,
    runtimeRelativeFromValue,
    runtimePathExists,
    oneShotPathInsideRoot,
    scopedRepoPath,
    readFileSync,
    sha256Bytes,
    sha256File,
    writeOneShotExecutorBytes,
    writeOneShotExecutorJson,
    writeCurrentProjectRuntimeJson,
    providerObservationContextBlockers,
    actualProviderObservationMatches,
    actualSemanticQaMatches,
    runtimePolicy,
    runtimeFileUrl,
    currentProjectImage2OneShotExecuteReturnEndpoint,
  } = deps;

  function currentProjectOneShotReturnProjection(source, {
    generatedAt,
    project,
    receipt,
    handoff,
    expectedOutputPath,
    providerObservationPath,
    semanticQaPath,
    manifestPath,
    qaReportPath,
    outputSha256,
    imageInfo,
    sourceImagePath,
    providerName,
  }) {
    const shotId = receipt.selectedShotId;
    const runtimeItem = {
      shotId,
      status: "needs_review",
      expectedOutputPath,
      outputSha256,
      imageInfo,
      providerObservationPath,
      semanticQaPath,
      blockers: [],
    };
    const clip = {
      order: 1,
      shotId,
      mediaPath: expectedOutputPath,
      status: "returned_with_review_overlay",
      previewQaStatus: "needs_review_overlay",
      productionQaStatus: "needs_review",
      durationSeconds: 5,
    };
    const observation = {
      order: 1,
      shotId,
      expectedOutputPath,
      outputSha256,
      imageInfo,
      qaStatus: "needs_review",
      previewQaStatus: "needs_review_overlay",
      productionQaStatus: "needs_review",
      reviewOverlay: true,
      blockers: [],
    };
    const runtimeTruth = {
      ...(readRuntimeJson(source.runtimeTruthLayerRelativePath) || {}),
      schemaVersion: "runtime_truth_layer_v1",
      generatedAt,
      status: "real_image2_one_shot_returned_needs_review",
      items: upsertByShotId(readRuntimeJson(source.runtimeTruthLayerRelativePath)?.items, runtimeItem),
    };
    const previewPlan = {
      ...(readRuntimeJson(source.previewPlanRelativePath) || {}),
      schemaVersion: "preview_plan_v1",
      generatedAt,
      status: "real_image2_one_shot_returned_needs_review",
      previewStatus: "real_image2_one_shot_returned_needs_review",
      productionStatus: "needs_review",
      reviewOverlayShots: uniqueStrings([
        ...(readRuntimeJson(source.previewPlanRelativePath)?.reviewOverlayShots || []),
        shotId,
      ]),
      productionNeedsReviewShots: uniqueStrings([
        ...(readRuntimeJson(source.previewPlanRelativePath)?.productionNeedsReviewShots || []),
        shotId,
      ]),
      clips: upsertByShotId(readRuntimeJson(source.previewPlanRelativePath)?.clips, clip),
    };
    const report = {
      ...(readRuntimeJson(source.reportRelativePath) || {}),
      schemaVersion: "current_project_real_image2_one_shot_return_v1",
      generatedAt,
      projectId: project.projectId,
      runId: project.runId || `${safePathSegment(project.projectId || "project")}_one_shot_return`,
      status: "real_image2_one_shot_returned_needs_review",
      previewStatus: "real_image2_one_shot_returned_needs_review",
      productionStatus: "needs_review",
      providerCalled: true,
      actualImage2Triggered: true,
      realProviderAttemptCount: 1,
      seedanceOrJimengUsed: false,
      fastOrVipUsed: false,
      videoGenerated: false,
      reviewOverlayShots: uniqueStrings([
        ...(readRuntimeJson(source.reportRelativePath)?.reviewOverlayShots || []),
        shotId,
      ]),
      productionNeedsReviewShots: uniqueStrings([
        ...(readRuntimeJson(source.reportRelativePath)?.productionNeedsReviewShots || []),
        shotId,
      ]),
      blockers: [],
      observations: upsertByShotId(readRuntimeJson(source.reportRelativePath)?.observations, observation),
      latestOneShotReturn: {
        shotId,
        provider: providerName,
        sourceImagePath,
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
        manifestPath,
        qaReportPath,
        outputSha256,
        status: "needs_review",
      },
    };
    return { runtimeTruth, previewPlan, report };
  }

  function currentProjectImage2OneShotReturnIngestResponse(input, extra = {}, source = currentProjectSource()) {
    const generatedAt = new Date().toISOString();
    const modeInfo = { mode: "dry_run_executor", provided: true, valid: true, raw: input.executorMode || input.mode };
    const statusProjection = currentProjectImage2OneShotResponse("status", {
      selectedShotId: input.selectedShotId,
      selectedShotIds: input.selectedShotIds,
      imageCount: input.imageCount,
    }, {}, source);
    const statePaths = statusProjection.statePaths || {};
    const sandboxRoot = statusProjection.receipt?.sandbox?.root;
    const shotRoot = statusProjection.receipt?.sandbox?.shotRoot;
    const receipt = oneShotStateJson(statePaths.receiptStatePath, statePaths.stateRoot, sandboxRoot);
    const handoff = oneShotStateJson(statePaths.handoffStatePath, statePaths.stateRoot, sandboxRoot);
    const expectedOutputPath = handoff?.expectedOutputPath || receipt?.expectedOutputPath || statusProjection.expectedOutputPath;
    const providerObservationPath = handoff?.providerObservationPath || receipt?.providerObservationPath || statusProjection.providerObservationPath;
    const semanticQaPath = handoff?.semanticQaPath || receipt?.semanticQaPath || statusProjection.semanticQaPath;
    const manifestPath = receipt?.sandbox?.manifestPath || `${shotRoot}/manifest.json`;
    const qaReportPath = receipt?.sandbox?.qaReportPath || `${shotRoot}/qa/semantic-qa.json`;
    const contextBase = {
      generatedAt,
      modeInfo,
      receipt,
      handoff,
      sandboxRoot,
      shotRoot,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
    };
    const preflightContract = oneShotExecutorContract(input, { ...contextBase, outputReturned: false });

    let outputSha256;
    let outputBytesWritten = 0;
    let providerObservation = readReturnedJson(input.providerObservation, input.returnedProviderObservationPath) || readRuntimeJson(providerObservationPath);
    let semanticQa = readReturnedJson(input.semanticQa, input.returnedSemanticQaPath) || readRuntimeJson(semanticQaPath);
    let manifest;
    let qaReport;
    let projections;
    let writeError;

    const returnedOutputPath = runtimeRelativeFromValue(input.returnedOutputPath) || expectedOutputPath;
    const hasReturnedOutput = runtimePathExists(returnedOutputPath);
    const outputSourceInsideProject = oneShotPathInsideRoot(returnedOutputPath, source.runRootRelativePath);
    const outputSourceIsExpected = returnedOutputPath === expectedOutputPath;
    const returnedProviderRequestId = asString(input.providerRequestId) || asString(providerObservation?.providerRequestId);

    if (preflightContract.blockers.length === 0 && input.actualProviderReturned === true && hasReturnedOutput && outputSourceInsideProject && returnedProviderRequestId) {
      try {
        const sourceOutputPath = scopedRepoPath(returnedOutputPath);
        const outputBytes = readFileSync(sourceOutputPath);
        if (!outputSourceIsExpected) {
          writeOneShotExecutorBytes(expectedOutputPath, outputBytes, sandboxRoot, shotRoot);
        }
        outputBytesWritten = outputBytes.length;
        outputSha256 = sha256Bytes(outputBytes);
        providerObservation = {
          ...(isRecord(providerObservation) ? providerObservation : {}),
          schemaVersion: "vibe_core_real_image2_executor_provider_observation_v1",
          generatedAt,
          provider: providerObservation?.provider || providerObservation?.providerId || "openai-image2-api",
          providerId: providerObservation?.providerId || providerObservation?.provider || "openai-image2-api",
          providerObservationMode: "actual_provider_call_observed",
          executorMode: "external_provider_return",
          executorRunId: `real_image2_return_${safePathSegment(receipt.receiptId)}_${Date.now()}`,
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          handoffPacketId: handoff.packetId,
          providerRequestId: returnedProviderRequestId,
          sourceOutputPath: returnedOutputPath,
          outputPath: expectedOutputPath,
          outputSha256,
          outputBytes: outputBytesWritten,
          providerCalled: true,
          actualImage2Triggered: true,
          providerCallsAttempted: 1,
          maxProviderCallsPerExecution: 1,
          externalNetworkCallMade: true,
          rawCredentialMaterialSeen: false,
          workerSpawned: false,
          projectVibeWritten: false,
        };
        semanticQa = {
          ...(isRecord(semanticQa) ? semanticQa : {}),
          schemaVersion: "vibe_core_real_image2_executor_semantic_qa_v1",
          generatedAt,
          reviewedAt: semanticQa?.reviewedAt || generatedAt,
          semanticReviewMode: "actual_image_semantic_review",
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          outputPath: expectedOutputPath,
          expectedOutputPath,
          outputSha256,
          reviewedOutputSha256: outputSha256,
          status: "needs_review",
          qaStatus: "needs_review",
          finalAssessment: {
            ...(isRecord(semanticQa?.finalAssessment) ? semanticQa.finalAssessment : {}),
            status: "needs_review",
          },
          providerCalled: true,
          actualImage2Triggered: true,
        };
        manifest = {
          schemaVersion: "vibe_core_real_image2_executor_manifest_v1",
          generatedAt,
          status: "real_provider_returned_needs_review",
          manifestMatched: true,
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          expectedOutputPath,
          actualOutputPath: expectedOutputPath,
          sourceOutputPath: returnedOutputPath,
          outputSha256,
          providerObservationPath,
          semanticQaPath,
          qaReportPath,
          providerCalled: true,
          actualImage2Triggered: true,
          externalNetworkCallMade: true,
          items: [
            {
              shotId: receipt.selectedShotId,
              expectedOutputPath,
              actualOutputPath: expectedOutputPath,
              outputSha256,
              status: "real_provider_returned_needs_review",
            },
          ],
        };
        qaReport = {
          schemaVersion: "vibe_core_real_image2_executor_qa_report_v1",
          generatedAt,
          status: "needs_review",
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          outputPath: expectedOutputPath,
          outputSha256,
          semanticQaPath,
          providerObservationPath,
          manifestPath,
          providerCalled: true,
          actualImage2Triggered: true,
          summary: "Actual Image2 provider return was ingested into the one-shot sandbox and remains needs_review.",
        };
        writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
        writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
        writeOneShotExecutorJson(manifestPath, manifest, sandboxRoot, shotRoot);
        writeOneShotExecutorJson(qaReportPath, qaReport, sandboxRoot, shotRoot);
        projections = currentProjectOneShotReturnProjection(source, {
          generatedAt,
          project: statusProjection.project,
          receipt,
          handoff,
          expectedOutputPath,
          providerObservationPath,
          semanticQaPath,
          manifestPath,
          qaReportPath,
          outputSha256,
          imageInfo: { bytes: outputBytesWritten, sha256: outputSha256 },
          sourceImagePath: returnedOutputPath,
          providerName: providerObservation.provider,
        });
        writeCurrentProjectRuntimeJson(source.runtimeTruthLayerRelativePath, projections.runtimeTruth, source);
        writeCurrentProjectRuntimeJson(source.previewPlanRelativePath, projections.previewPlan, source);
        writeCurrentProjectRuntimeJson(source.reportRelativePath, projections.report, source);
      } catch (error) {
        writeError = error instanceof Error ? error.message : "Real provider return ingest failed.";
      }
    } else if (runtimePathExists(expectedOutputPath)) {
      outputSha256 = sha256File(scopedRepoPath(expectedOutputPath));
    }

    providerObservation = readRuntimeJson(providerObservationPath) || providerObservation;
    semanticQa = readRuntimeJson(semanticQaPath) || semanticQa;
    const expectedProviderObservationContext = {
      selectedShotId: receipt?.selectedShotId || input.selectedShotId,
      receiptId: receipt?.receiptId || input.receiptId,
      handoffPacketId: handoff?.packetId || input.handoffPacketId,
    };
    const providerObservationBlockers = providerObservationContextBlockers(providerObservation, expectedProviderObservationContext);
    const providerObservationMode = providerObservation?.providerObservationMode || "not_observed";
    const semanticQaStatus = semanticQa?.status || semanticQa?.qaStatus || semanticQa?.finalAssessment?.status || "not_written";
    const hashBoundActual = Boolean(
      outputSha256
        && runtimePathExists(expectedOutputPath)
        && actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, expectedProviderObservationContext)
        && actualSemanticQaMatches(semanticQa, expectedOutputPath, outputSha256),
    );
    const returnSource = hashBoundActual ? "actual_provider_return_ingest" : "dry_run_projection_only";
    const formalPromotionBlockedReasons = hashBoundActual
      ? ["Formal promotion remains blocked until human QA approval after hash-bound provider return."]
      : [];
    const blockers = uniqueStrings([
      ...preflightContract.blockers,
      writeError,
      input.actualProviderReturned === true || hashBoundActual ? "" : "Actual provider return requires actualProviderReturned=true or existing actual hash-bound sidecars.",
      hasReturnedOutput || runtimePathExists(expectedOutputPath) ? "" : "Returned provider output file is required.",
      outputSourceInsideProject ? "" : "Returned provider output must stay inside the current project root.",
      returnedProviderRequestId || actualProviderObservationMatches(providerObservation, expectedOutputPath, outputSha256, expectedProviderObservationContext) ? "" : "Actual provider return requires a non-empty providerRequestId in provider observation.",
      outputSha256 ? "" : "Returned provider output must be hashable.",
      ...providerObservationBlockers,
      hashBoundActual ? "" : "Actual provider return requires providerRequestId, output hash, provider observation, and semantic QA sidecars before ingest.",
    ]);
    const ok = blockers.length === 0;
    const status = ok ? "real_provider_returned_needs_review" : preflightContract.blockers.length ? "blocked" : "dry_run_executor_ready";
    const contract = {
      ...preflightContract,
      status,
      blockers,
      outputReturnContract: {
        ...preflightContract.outputReturnContract,
        watcherProjection: {
          ...preflightContract.outputReturnContract.watcherProjection,
          expectedOutputDetected: hashBoundActual,
          source: returnSource,
          returnSource,
          outputSha256,
          hashBoundActual,
        },
        providerObservation: {
          providerId: providerObservation?.providerId || providerObservation?.provider || "openai-image2-api",
          providerRequestId: providerObservation?.providerRequestId,
          providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
          providerCalled: hashBoundActual,
          externalNetworkCallMade: hashBoundActual,
        },
        manifest: {
          manifestMatched: hashBoundActual,
          status: hashBoundActual ? "real_provider_returned_needs_review" : "not_written",
        },
        semanticQa: {
          semanticReviewMode: hashBoundActual ? "actual_image_semantic_review" : "not_observed",
          status: hashBoundActual ? semanticQaStatus : "not_written",
        },
        previewProjection: {
          status,
          needsHumanReview: hashBoundActual,
        },
      },
    };

    return {
      ok,
      ...runtimePolicy({
        runMode: "current_project_image2_one_shot_execute_return",
        providerCalled: hashBoundActual,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: !hashBoundActual,
      }),
      endpoint: currentProjectImage2OneShotExecuteReturnEndpoint,
      source: "runtime_endpoint",
      sourceLabel: source.sourceLabel,
      projectionKind: "current_project_image2_one_shot_execute_return",
      currentProject: statusProjection.currentProject,
      requestContext: {
        ...statusProjection.requestContext,
        selectedShotId: input.selectedShotId,
        receiptId: input.receiptId,
        executorMode: "external_provider_return",
      },
      projectRootMode: source.projectRootMode,
      projectRoot: statusProjection.projectRoot,
      projectId: statusProjection.projectId,
      project: statusProjection.project,
      status,
      uiStatus: ok ? "needs_review" : status,
      userLabel: ok ? "需要复核" : "回流检查",
      providerRequestId: providerObservation?.providerRequestId || returnedProviderRequestId,
      outputSha256,
      hashBoundActual,
      providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
      semanticQaStatus: hashBoundActual ? semanticQaStatus : "not_written",
      returnSource,
      formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
      formalPromotionBlockedReasons,
      actualImage2Triggered: hashBoundActual,
      providerReturnIngested: hashBoundActual,
      externalProviderCallObserved: hashBoundActual,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      formalPromotionBlocked: hashBoundActual,
      selectedShotId: input.selectedShotId,
      expectedOutputPath,
      returnedOutputPath,
      outputExists: runtimePathExists(expectedOutputPath),
      outputSha256,
      outputBytesWritten,
      providerObservationPath,
      semanticQaPath,
      manifestPath,
      qaReportPath,
      statePaths,
      receipt,
      handoffPacket: handoff,
      transportPlan: handoff?.transportPlan || statusProjection.transportPlan,
      executorEvidence: {
        consumedPersistedReceipt: isRecord(receipt),
        consumedPersistedHandoff: isRecord(handoff),
        mockProviderOnly: false,
        externalProviderReturnOnly: true,
        runtimeProviderSubmitAttempted: false,
        runtimeExternalNetworkCallMade: false,
        formalPromotionAllowed: false,
        formalPromotionBlocked: hashBoundActual,
        formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
        formalPromotionBlockedReasons,
        providerRequestId: providerObservation?.providerRequestId || returnedProviderRequestId,
        outputSha256,
        hashBoundActual,
        providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
        semanticQaStatus: hashBoundActual ? semanticQaStatus : "not_written",
        returnSource,
      },
      executorContract: contract,
      providerObservation,
      semanticQa,
      manifest,
      qaReport,
      projections,
      watcherProjection: {
        expectedOutputPath,
        providerObservationPath,
        semanticQaPath,
        manifestPath,
        qaReportPath,
        outputExists: runtimePathExists(expectedOutputPath),
        providerObservationPresent: runtimePathExists(providerObservationPath),
        semanticQaPresent: runtimePathExists(semanticQaPath),
        manifestPresent: runtimePathExists(manifestPath),
        qaReportPresent: runtimePathExists(qaReportPath),
        expectedOutputDetected: hashBoundActual,
        manifestMatched: hashBoundActual,
        providerRequestId: providerObservation?.providerRequestId || returnedProviderRequestId,
        outputSha256,
        hashBoundActual,
        providerObservationMode: hashBoundActual ? providerObservationMode : "not_observed",
        semanticQaStatus: hashBoundActual ? semanticQaStatus : "not_written",
        returnSource,
        formalPromotionBlockedReason: formalPromotionBlockedReasons[0],
        formalPromotionBlockedReasons,
        watcherStarted: false,
        daemonStarted: false,
        reportProjectionOnly: false,
        source: returnSource,
      },
      previewProjection: {
        shotId: input.selectedShotId,
        status: ok ? "needs_review" : status,
        imageUrl: hashBoundActual ? runtimeFileUrl(expectedOutputPath) : undefined,
        reviewRequired: hashBoundActual,
        providerCalled: hashBoundActual,
        actualImage2Triggered: hashBoundActual,
      },
      submitPolicy: {
        providerCallAllowed: false,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        realProviderCallAllowed: false,
        manualTransportRequired: true,
        dryRunOnly: !hashBoundActual,
        noWorkerSpawn: true,
        sandboxFileMutationAllowed: input.actualProviderReturned === true && hashBoundActual,
        projectVibeMutationAllowed: false,
        statePersistenceAllowed: false,
      },
      providerCalled: hashBoundActual,
      externalProviderCallObserved: hashBoundActual,
      externalNetworkCallMade: false,
      runtimeProviderSubmitAttempted: false,
      runtimeExternalNetworkCallMade: false,
      formalPromotionBlocked: hashBoundActual,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers,
      message: ok ? undefined : "Image2 return executor did not find hash-bound actual provider output yet.",
      ...extra,
    };
  }

  return {
    currentProjectOneShotReturnProjection,
    currentProjectImage2OneShotReturnIngestResponse,
  };
}
