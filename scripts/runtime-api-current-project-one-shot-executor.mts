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

const oneShotExecutorModes = new Set(["mock_executor", "dry_run_executor", "real_provider_call"]);

function realProviderGateSatisfied(gate) {
  return isRecord(gate)
    && gate.explicitUserConfirmed === true
    && gate.allowRealProviderCall === true
    && gate.confirmationScope === "single_image2_one_shot"
    && gate.maxProviderCalls === 1
    && gate.mainThreadFinalConfirmation === true;
}

export function createRuntimeApiCurrentProjectOneShotExecutor(deps) {
  const {
    currentProjectSource,
    currentProjectImage2OneShotResponse,
    oneShotStateJson,
    normalizeRelativePath,
    oneShotPathInsideRoot,
    oneShotExecutorPathInsideSandbox,
    inspectForRawCredentialMaterial,
    writeOneShotExecutorBytes,
    writeOneShotExecutorJson,
    runtimePathExists,
    runtimeFileUrl,
    sha256File,
    runtimePolicy,
    currentProjectImage2OneShotExecuteMockEndpoint,
    oneShotRequestInput,
  } = deps;

  function oneShotExecutorMode(input) {
    const raw = String(input.executorMode || input.mode || "").trim();
    if (!raw) return { mode: "dry_run_executor", provided: false, valid: true };
    const normalized = raw.toLowerCase();
    return {
      mode: oneShotExecutorModes.has(normalized) ? normalized : "dry_run_executor",
      raw,
      provided: true,
      valid: oneShotExecutorModes.has(normalized),
    };
  }

  function oneShotExecutorRequestInput(url, body) {
    const input = oneShotRequestInput(url, body);
    const mode = requestBodyString(body, ["executorMode"])
      || asString(url.searchParams.get("executorMode"))
      || requestBodyString(body, ["mode"])
      || asString(url.searchParams.get("mode"));
    return {
      ...input,
      receiptId: asString(url.searchParams.get("receiptId")) || requestBodyString(body, ["receiptId"]),
      executorMode: mode,
      mode,
      actualExecutionAllowed: body?.actualExecutionAllowed === true,
      providerCallAllowed: body?.providerCallAllowed === true,
      liveSubmitAllowed: body?.liveSubmitAllowed === true,
      realProviderGate: isRecord(body?.realProviderGate) ? body.realProviderGate : undefined,
      rawBody: isRecord(body) ? body : {},
    };
  }

  function oneShotExecutorChecks({ modeInfo, input, receipt, handoff, sandboxRoot, shotRoot, expectedOutputPath, providerObservationPath, semanticQaPath, manifestPath, qaReportPath }) {
    const receiptPolicy = isRecord(receipt?.policy) ? receipt.policy : {};
    const transportPlan = isRecord(handoff?.transportPlan) ? handoff.transportPlan : {};
    const appServerContract = isRecord(handoff?.appServerContract) ? handoff.appServerContract : {};
    const requestedOutputPath = input.expectedOutputPath ? normalizeRelativePath(input.expectedOutputPath) : undefined;
    const requestedUnsafeFlags = input.rawBody?.liveSubmitAllowed === true
      || input.rawBody?.providerCalled === true
      || input.rawBody?.externalNetworkIoAllowed === true
      || input.rawBody?.workerSpawnAllowed === true
      || input.rawBody?.projectVibeWritten === true;
    const checks = [
      ["mode_allowlisted", modeInfo.valid, "Executor mode must be mock_executor, dry_run_executor, or explicitly gated real_provider_call."],
      ["persisted_prepare_receipt_present", isRecord(receipt), "Persisted prepare receipt is required."],
      ["persisted_handoff_packet_present", isRecord(handoff), "Persisted handoff packet is required."],
      ["prepare_receipt_schema", receipt?.schemaVersion === "vibe_core_current_project_image2_one_shot_receipt_v1", "Persisted prepare receipt schema is not recognized."],
      ["prepare_receipt_status", receipt?.status === "prepared", "Persisted prepare receipt must have status=prepared."],
      ["handoff_schema", handoff?.schemaVersion === "vibe_core_current_project_image2_one_shot_handoff_packet_v1", "Persisted handoff packet schema is not recognized."],
      ["handoff_status", handoff?.status === "ready_for_manual_transport", "Persisted handoff packet must have status=ready_for_manual_transport."],
      ["handoff_receipt_id_matches", handoff?.receiptId === receipt?.receiptId, "Handoff receiptId must match the persisted prepare receipt."],
      ["handoff_packet_id_matches", handoff?.packetId === `handoff_${receipt?.receiptId || ""}`, "Handoff packetId must derive from receiptId."],
      ["selected_shot_matches", handoff?.selectedShotId === receipt?.selectedShotId, "Handoff selectedShotId must match the persisted prepare receipt."],
      ["expected_output_matches", normalizeRelativePath(handoff?.expectedOutputPath || "") === normalizeRelativePath(receipt?.expectedOutputPath || ""), "Handoff expectedOutputPath must match the persisted prepare receipt."],
      ["request_selected_shot_matches", !input.selectedShotId || input.selectedShotId === handoff?.selectedShotId, "Requested selectedShotId must match persisted handoff packet."],
      ["request_receipt_id_matches", !input.receiptId || input.receiptId === receipt?.receiptId, "Requested receiptId must match persisted prepare receipt."],
      ["request_expected_output_matches", !requestedOutputPath || requestedOutputPath === normalizeRelativePath(expectedOutputPath || ""), "Requested expectedOutputPath must match persisted handoff packet."],
      ["one_shot_only", receipt?.oneShotOnly === true && receipt?.imageCount === 1, "Executor contract only consumes one shot and one image per handoff."],
      ["sandbox_root_present", Boolean(sandboxRoot), "Persisted prepare receipt sandbox.root is required."],
      ["shot_root_inside_sandbox", oneShotPathInsideRoot(shotRoot, sandboxRoot), "Persisted prepare receipt shotRoot must stay inside sandbox.root."],
      ["expected_output_inside_sandbox", oneShotExecutorPathInsideSandbox(expectedOutputPath, sandboxRoot, shotRoot), "Expected output path must stay inside the one-shot sandbox."],
      ["provider_observation_inside_sandbox", oneShotExecutorPathInsideSandbox(providerObservationPath, sandboxRoot, shotRoot), "Provider observation path must stay inside the one-shot sandbox."],
      ["semantic_qa_inside_sandbox", oneShotExecutorPathInsideSandbox(semanticQaPath, sandboxRoot, shotRoot), "Semantic QA path must stay inside the one-shot sandbox."],
      ["manifest_inside_sandbox", oneShotExecutorPathInsideSandbox(manifestPath, sandboxRoot, shotRoot), "Manifest path must stay inside the one-shot sandbox."],
      ["qa_report_inside_sandbox", oneShotExecutorPathInsideSandbox(qaReportPath, sandboxRoot, shotRoot), "QA report path must stay inside the one-shot sandbox."],
      ["receipt_state_inside_sandbox", oneShotExecutorPathInsideSandbox(receipt?.sandbox?.receiptStatePath, sandboxRoot, shotRoot), "Receipt state path must stay inside the one-shot sandbox."],
      ["handoff_state_inside_sandbox", oneShotExecutorPathInsideSandbox(receipt?.sandbox?.handoffStatePath, sandboxRoot, shotRoot), "Handoff state path must stay inside the one-shot sandbox."],
      ["transport_mode_agent_app_server", transportPlan.mode === "agent_app_server", "Executor can only consume agent_app_server handoff transport."],
      ["transport_target_agent_app_server", transportPlan.target === "agent_app_server", "Executor can only consume agent_app_server target handoffs."],
      ["transport_endpoint_agent_app_server", transportPlan.endpoint === "/api/agent/app-server/image2/one-shot", "Agent app-server handoff endpoint drifted."],
      ["transport_prepared_only", transportPlan.externalCallPreparedOnly === true, "Agent app-server handoff must remain prepared-only before executor consumption."],
      ["app_server_contract_mode", appServerContract.mode === "agent_app_server_handoff_only", "App-server contract mode must remain handoff-only."],
      ["requires_external_action", handoff?.requiresExternalAction === true, "Handoff packet must require an external action boundary."],
      ["receipt_provider_called_false", receiptPolicy.providerCalled === false, "Persisted prepare receipt must keep providerCalled=false."],
      ["receipt_provider_submit_zero", receiptPolicy.providerSubmitAllowed === 0, "Persisted prepare receipt must keep providerSubmitAllowed=0."],
      ["receipt_automatic_submit_false", receiptPolicy.automaticSubmitAllowed === false, "Persisted prepare receipt must keep automaticSubmitAllowed=false."],
      ["receipt_live_submit_false", receiptPolicy.liveSubmitAllowed === false, "Persisted prepare receipt must keep liveSubmitAllowed=false."],
      ["receipt_external_network_false", receiptPolicy.externalNetworkIoAllowed === false, "Persisted prepare receipt must keep externalNetworkIoAllowed=false."],
      ["receipt_worker_spawn_forbidden", receiptPolicy.workerSpawnForbidden === true, "Persisted prepare receipt must keep workerSpawnForbidden=true."],
      ["receipt_project_vibe_not_written", receiptPolicy.projectVibeWritten === false, "Persisted prepare receipt must keep projectVibeWritten=false."],
      ["handoff_provider_called_false", handoff?.providerCalled === false, "Persisted handoff packet must keep providerCalled=false."],
      ["handoff_live_submit_false", handoff?.liveSubmitAllowed === false, "Persisted handoff packet must keep liveSubmitAllowed=false."],
      ["handoff_worker_spawn_forbidden", handoff?.workerSpawnForbidden === true, "Persisted handoff packet must keep workerSpawnForbidden=true."],
      ["handoff_project_vibe_not_written", handoff?.projectVibeWritten === false, "Persisted handoff packet must keep projectVibeWritten=false."],
      ["transport_actual_execution_false", transportPlan.actualExecutionAllowed === false, "Handoff transport plan must keep actualExecutionAllowed=false."],
      ["transport_provider_called_false", transportPlan.providerCalled === false, "Handoff transport plan must keep providerCalled=false."],
      ["transport_live_submit_false", transportPlan.liveSubmitAllowed === false, "Handoff transport plan must keep liveSubmitAllowed=false."],
      ["transport_worker_spawn_forbidden", transportPlan.workerSpawnForbidden === true, "Handoff transport plan must keep workerSpawnForbidden=true."],
      ["app_server_manual_transport_required", appServerContract.manualTransportRequired === true, "App-server contract must require manual transport."],
      ["app_server_automatic_submit_false", appServerContract.automaticSubmitAllowed === false, "App-server contract must keep automaticSubmitAllowed=false."],
      ["app_server_actual_execution_false", appServerContract.actualExecutionAllowed === false, "App-server contract must keep actualExecutionAllowed=false."],
      ["request_does_not_escalate_locks", requestedUnsafeFlags === false, "Executor request body must not attempt live submit, provider call, worker spawn, network I/O, or project.vibe mutation."],
      ["raw_credentials_absent", !inspectForRawCredentialMaterial(input.rawBody) && !inspectForRawCredentialMaterial(receipt) && !inspectForRawCredentialMaterial(handoff), "Raw credential material is forbidden; executor may only see scoped references."],
    ];
    if (modeInfo.mode === "real_provider_call") {
      checks.push(
        ["real_provider_gate_satisfied", realProviderGateSatisfied(input.realProviderGate), "Real provider call mode requires an explicit single-call main-thread gate."],
        ["real_provider_runtime_blocked", false, "Real provider execution remains blocked in this runtime adapter until a live provider implementation is explicitly enabled."],
      );
    }
    return checks.map(([checkId, passed, blocker]) => ({
      checkId,
      status: passed ? "passed" : "blocked",
      blocker: passed ? undefined : blocker,
    }));
  }

  function oneShotExecutorContract(input, context) {
    const checks = oneShotExecutorChecks({ input, ...context });
    const blockers = uniqueStrings(checks.map((item) => item.blocker));
    const outputReturned = context.outputReturned === true && context.modeInfo.mode === "mock_executor" && blockers.length === 0;
    const status = blockers.length
      ? "blocked"
      : outputReturned
        ? "mock_output_returned_needs_review"
        : context.modeInfo.mode === "mock_executor"
          ? "executor_ready_mock"
          : "dry_run_executor_ready";
    return {
      schemaVersion: "0.1.0",
      generatedAt: context.generatedAt,
      phase: "real_image2_executor_adapter_contract",
      mode: context.modeInfo.mode,
      status,
      selectedShotId: context.handoff?.selectedShotId || context.receipt?.selectedShotId,
      receiptId: context.handoff?.receiptId || context.receipt?.receiptId,
      expectedOutputPath: context.expectedOutputPath,
      checks,
      outputReturnContract: {
        expectedOutputPath: context.expectedOutputPath,
        sandboxRoot: context.sandboxRoot,
        shotRoot: context.shotRoot,
        providerObservationPath: context.providerObservationPath,
        semanticQaPath: context.semanticQaPath,
        manifestPath: context.manifestPath,
        qaReportPath: context.qaReportPath,
        watcherProjection: {
          expectedOutputDetected: outputReturned,
          watcherStarted: false,
          daemonStarted: false,
          source: context.modeInfo.mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
        },
        providerObservation: {
          providerId: "openai-image2-api",
          providerObservationMode: outputReturned ? "mock_readiness_evidence" : "not_observed",
          providerCalled: false,
          externalNetworkCallMade: false,
        },
        manifest: {
          manifestMatched: outputReturned,
          status: outputReturned ? "mock_output_present" : "not_written",
        },
        semanticQa: {
          semanticReviewMode: outputReturned ? "mock_executor_semantic_review" : "not_observed",
          status: outputReturned ? "needs_review" : "not_written",
        },
        previewProjection: {
          status,
          needsHumanReview: outputReturned,
        },
      },
      providerCallContract: {
        maxProviderCallsPerExecution: 1,
        providerCallsAttempted: 0,
        providerCalled: false,
        externalNetworkIoAllowed: false,
        rawCredentialAccessAllowed: false,
        workerSpawnAllowed: false,
        projectVibeMutationAllowed: false,
        realProviderCallRequiresExplicitGate: true,
        realProviderGateSatisfied: realProviderGateSatisfied(input.realProviderGate),
      },
      blockers,
      warnings: uniqueStrings([
        context.modeInfo.mode === "mock_executor" ? "Mock executor may write only test output and sidecars inside the one-shot sandbox." : "",
        context.modeInfo.mode === "dry_run_executor" ? "Dry-run executor validates the handoff but does not write output files." : "",
        outputReturned ? "Mock output is review evidence only and is not a real provider result." : "",
      ]),
      notes: [
        "Executor input must be the persisted prepare receipt plus persisted handoff packet.",
        "The adapter allows at most one provider call by contract, but this mock/dry-run implementation attempts zero provider calls.",
        "Completion must flow through output, provider observation, manifest, semantic QA, and preview projection evidence.",
      ],
    };
  }

  function currentProjectImage2OneShotExecutorResponse(input, extra = {}, source = currentProjectSource()) {
    const generatedAt = new Date().toISOString();
    const modeInfo = oneShotExecutorMode(input);
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
    let providerObservation;
    let semanticQa;
    let manifest;
    let qaReport;
    let writeError;

    if (preflightContract.blockers.length === 0 && modeInfo.mode === "mock_executor") {
      try {
        const mockPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
        const outputFilePath = writeOneShotExecutorBytes(expectedOutputPath, mockPng, sandboxRoot, shotRoot);
        outputBytesWritten = mockPng.length;
        outputSha256 = sha256File(outputFilePath);
        const executorRunId = `mock_image2_executor_${safePathSegment(receipt.receiptId)}_${Date.now()}`;
        providerObservation = {
          schemaVersion: "vibe_core_real_image2_executor_provider_observation_v1",
          generatedAt,
          provider: "openai-image2-api",
          providerId: "openai-image2-api",
          providerObservationMode: "mock_readiness_evidence",
          executorMode: "mock_executor",
          executorRunId,
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          handoffPacketId: handoff.packetId,
          outputPath: expectedOutputPath,
          outputSha256,
          outputBytes: outputBytesWritten,
          providerCalled: false,
          providerCallsAttempted: 0,
          maxProviderCallsPerExecution: 1,
          externalNetworkCallMade: false,
          rawCredentialMaterialSeen: false,
          workerSpawned: false,
          projectVibeWritten: false,
          notes: ["Mock executor evidence only; no external Image2 provider was called."],
        };
        semanticQa = {
          schemaVersion: "vibe_core_real_image2_executor_semantic_qa_v1",
          generatedAt,
          reviewedAt: generatedAt,
          semanticReviewMode: "mock_executor_semantic_review",
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          outputPath: expectedOutputPath,
          reviewedOutputSha256: outputSha256,
          status: "needs_review",
          finalAssessment: {
            status: "needs_review",
            reason: "Mock executor output proves sandbox return plumbing only; human review is still required.",
          },
          gates: {
            identity: "warn",
            scene: "warn",
            style: "warn",
            story: "warn",
            neighbor: "warn",
            output: "pass",
          },
          providerCalled: false,
        };
        manifest = {
          schemaVersion: "vibe_core_real_image2_executor_manifest_v1",
          generatedAt,
          status: "mock_output_present",
          manifestMatched: true,
          selectedShotId: receipt.selectedShotId,
          receiptId: receipt.receiptId,
          expectedOutputPath,
          actualOutputPath: expectedOutputPath,
          outputSha256,
          providerObservationPath,
          semanticQaPath,
          qaReportPath,
          providerCalled: false,
          externalNetworkCallMade: false,
          items: [
            {
              shotId: receipt.selectedShotId,
              expectedOutputPath,
              actualOutputPath: expectedOutputPath,
              outputSha256,
              status: "mock_output_returned_needs_review",
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
          providerCalled: false,
          summary: "Mock executor returned output and sidecars to the sandbox; formal semantic QA remains a human review step.",
        };
        writeOneShotExecutorJson(providerObservationPath, providerObservation, sandboxRoot, shotRoot);
        writeOneShotExecutorJson(semanticQaPath, semanticQa, sandboxRoot, shotRoot);
        writeOneShotExecutorJson(manifestPath, manifest, sandboxRoot, shotRoot);
        writeOneShotExecutorJson(qaReportPath, qaReport, sandboxRoot, shotRoot);
      } catch (error) {
        writeError = error instanceof Error ? error.message : "Mock executor sandbox write failed.";
      }
    }

    const outputReturned = Boolean(outputSha256 && runtimePathExists(expectedOutputPath));
    const contract = oneShotExecutorContract(input, { ...contextBase, outputReturned });
    const blockers = uniqueStrings([
      ...contract.blockers,
      writeError,
    ]);
    const status = blockers.length ? "blocked" : contract.status;
    const ok = blockers.length === 0;
    const previewStatus = status === "mock_output_returned_needs_review"
      ? "mock_output_returned_needs_review"
      : status === "executor_ready_mock"
        ? "executor_ready_mock"
        : status === "dry_run_executor_ready"
          ? "dry_run_executor_ready"
          : "blocked";

    return {
      ok,
      ...runtimePolicy({
        runMode: "current_project_image2_one_shot_executor_adapter",
        providerCalled: false,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: modeInfo.mode !== "real_provider_call",
      }),
      endpoint: currentProjectImage2OneShotExecuteMockEndpoint,
      source: "runtime_endpoint",
      sourceLabel: source.sourceLabel,
      projectionKind: "current_project_image2_one_shot_executor_adapter",
      currentProject: statusProjection.currentProject,
      requestContext: {
        ...statusProjection.requestContext,
        selectedShotId: input.selectedShotId,
        receiptId: input.receiptId,
        executorMode: modeInfo.mode,
        requestedExecutorMode: modeInfo.raw || input.mode,
      },
      projectRootMode: source.projectRootMode,
      projectRoot: statusProjection.projectRoot,
      projectId: statusProjection.projectId,
      project: statusProjection.project,
      status,
      uiStatus: status,
      userLabel: status === "mock_output_returned_needs_review" ? "需要复核" : status === "blocked" ? "待补齐" : "执行器就绪",
      actualImage2Triggered: false,
      selectedShotId: input.selectedShotId,
      expectedOutputPath,
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
        mockProviderOnly: modeInfo.mode === "mock_executor",
        externalNetworkIoAllowed: false,
        formalPromotionAllowed: false,
      },
      executorContract: {
        ...contract,
        blockers,
        status,
        outputReturnContract: {
          ...contract.outputReturnContract,
          previewProjection: {
            ...contract.outputReturnContract.previewProjection,
            status: previewStatus,
            needsHumanReview: status === "mock_output_returned_needs_review",
          },
        },
      },
      providerObservation,
      semanticQa,
      manifest,
      qaReport,
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
        expectedOutputDetected: outputReturned,
        manifestMatched: Boolean(manifest?.manifestMatched),
        semanticQaStatus: semanticQa?.status,
        watcherStarted: false,
        daemonStarted: false,
        reportProjectionOnly: false,
        source: modeInfo.mode === "mock_executor" ? "mock_executor_sandbox_write" : "dry_run_projection_only",
      },
      previewProjection: {
        shotId: input.selectedShotId,
        status: status === "mock_output_returned_needs_review" ? "needs_review" : previewStatus,
        imageUrl: outputReturned ? runtimeFileUrl(expectedOutputPath) : undefined,
        reviewRequired: status === "mock_output_returned_needs_review",
        providerCalled: false,
      },
      submitPolicy: {
        providerCallAllowed: false,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        realProviderCallAllowed: false,
        manualTransportRequired: true,
        dryRunOnly: modeInfo.mode !== "real_provider_call",
        noWorkerSpawn: true,
        sandboxFileMutationAllowed: modeInfo.mode === "mock_executor" && ok,
        projectVibeMutationAllowed: false,
        statePersistenceAllowed: false,
      },
      providerCalled: false,
      externalNetworkCallMade: false,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      workerSpawnForbidden: true,
      blockers,
      message: blockers.length ? "Image2 executor adapter blocked this request before any provider call." : undefined,
      ...extra,
    };
  }

  return {
    currentProjectImage2OneShotExecutorResponse,
    oneShotExecutorContract,
    oneShotExecutorChecks,
    oneShotExecutorRequestInput,
    realProviderGateSatisfied,
  };
}
