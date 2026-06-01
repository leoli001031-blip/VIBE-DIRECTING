import { buildPreviewExportState } from "./previewExport";
import { buildImageReferenceDeliveryReceipt, type ImageReferenceDeliverySourceFacts } from "./imageReferenceDeliveryReceipt";
import { buildImageReferenceTransport, type SourceStartFrameFileFacts } from "./imageReferenceTransport";
import { buildProviderHandoffStatus } from "./providerHandoffStatus";
import type { ProjectRuntimeState } from "./projectState";
import {
  buildRealProviderOneShotState,
  type RealProviderOneShotActionConfirmation,
  type RealProviderOneShotCredentialGrant,
  type RealProviderOneShotState,
} from "./realProviderOneShot";
import {
  buildRealProviderTransportPlan,
  buildRealProviderTransportReceipt,
  buildRealProviderTransportResult,
  type RealProviderTransportMode,
} from "./realProviderTransport";
import type { GenerationHealthReport, QaPromotionReport, TaskRun, WatcherEvent } from "./types";
import type { ManifestMatchReport } from "./manifestMatcher";

export interface PreRealTestReturnEvidence {
  outputPath?: string;
  watcherExpectedOutputDetected?: boolean;
  manifestMatched?: boolean;
  qaPassed?: boolean;
  providerSelfReportedComplete?: boolean;
}

export interface PreRealTestClosureOptions {
  generatedAt?: string;
  transportMode?: Extract<RealProviderTransportMode, "mock_dry_run" | "manual_real_transport">;
  manualTransportAcknowledged?: boolean;
  providerTaskRef?: string;
  providerSelfReportedComplete?: boolean;
  returnEvidence?: PreRealTestReturnEvidence;
  sourceStartFrameFileFacts?: SourceStartFrameFileFacts;
  sourceStartFrameDeliveryFacts?: ImageReferenceDeliverySourceFacts;
}

export interface PreRealTestClosureResult {
  actionConfirmation: RealProviderOneShotActionConfirmation;
  credentialGrant: RealProviderOneShotCredentialGrant;
  oneShotRealCallState: RealProviderOneShotState;
  realProviderTransport: NonNullable<ProjectRuntimeState["realProviderTransport"]>;
  runtimeState: ProjectRuntimeState;
}

function safeId(value: string | undefined): string {
  const normalized = (value || "one_shot").trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "one_shot";
}

function firstImage2AdapterRequest(runtimeState: ProjectRuntimeState) {
  const planned = runtimeState.realProviderOneShotTest.plannedAction;
  return runtimeState.imagePipeline.image2AdapterRequests.find((request) => request.taskPlanId === planned?.taskPlanId) ||
    runtimeState.imagePipeline.image2AdapterRequests[0];
}

function firstRequestPreview(runtimeState: ProjectRuntimeState, taskPlanId?: string) {
  return runtimeState.realProviderExecutor.providerRequestPreviews.find((preview) => preview.taskPlanId === taskPlanId) ||
    runtimeState.realProviderExecutor.providerRequestPreviews.find((preview) => preview.status === "preview_ready") ||
    runtimeState.realProviderExecutor.providerRequestPreviews[0];
}

function outputPathFor(runtimeState: ProjectRuntimeState, fallback?: string): string | undefined {
  return fallback ||
    runtimeState.realProviderOneShotTest.plannedAction?.outputPath ||
    firstImage2AdapterRequest(runtimeState)?.payload.outputPath;
}

function withReturnedTaskRuns(runtimeState: ProjectRuntimeState, outputPath: string | undefined): TaskRun[] {
  if (!outputPath) return runtimeState.taskRuns.runs;
  return runtimeState.taskRuns.runs.map((run) => {
    if (!run.expectedOutputs.includes(outputPath) && run.taskId !== runtimeState.realProviderOneShotTest.plannedAction?.taskPlanId) return run;
    return {
      ...run,
      actualOutputs: Array.from(new Set([...run.actualOutputs, outputPath])),
    };
  });
}

function withReturnedTaskViews(runtimeState: ProjectRuntimeState, outputPath: string | undefined): ProjectRuntimeState["taskRuns"]["taskViews"] {
  if (!outputPath) return runtimeState.taskRuns.taskViews;
  return runtimeState.taskRuns.taskViews.map((task) => {
    if (!task.taskRun.expectedOutputs.includes(outputPath) && task.job.outputPath !== outputPath) return task;
    return {
      ...task,
      taskRun: {
        ...task.taskRun,
        actualOutputs: Array.from(new Set([...task.taskRun.actualOutputs, outputPath])),
      },
    };
  });
}

function watcherEvidence(runtimeState: ProjectRuntimeState, generatedAt: string, outputPath: string | undefined): WatcherEvent[] {
  if (!outputPath) return runtimeState.imagePipeline.watcherEvents;
  return [
    ...runtimeState.imagePipeline.watcherEvents,
    {
      id: `pre_real_test_watcher_${safeId(outputPath)}`,
      eventType: "expected_output_detected",
      taskId: runtimeState.realProviderOneShotTest.plannedAction?.taskPlanId || firstImage2AdapterRequest(runtimeState)?.taskPlanId || "one_shot_task",
      jobId: firstRequestPreview(runtimeState, runtimeState.realProviderOneShotTest.plannedAction?.taskPlanId)?.jobId,
      shotId: runtimeState.realProviderOneShotTest.plannedAction?.shotId,
      artifactPath: outputPath,
      expectedOutputPath: outputPath,
      status: "detected",
      severity: "info",
      createdAt: generatedAt,
      notes: ["Pre-real-test fixture output returned through the expected output path."],
    },
  ];
}

function manifestEvidence(runtimeState: ProjectRuntimeState, outputPath: string | undefined): ManifestMatchReport[] {
  if (!outputPath) return runtimeState.manifestMatches.reports;
  const taskId = runtimeState.realProviderOneShotTest.plannedAction?.taskPlanId || firstImage2AdapterRequest(runtimeState)?.taskPlanId || "one_shot_task";
  const existing = runtimeState.manifestMatches.reports.filter((report) => report.taskId !== taskId);
  return [
    ...existing,
    {
      taskId,
      status: "complete",
      expectedOutputCount: 1,
      presentOutputCount: 1,
      missingExpectedOutputs: [],
      actualOutputsPresent: [outputPath],
      recoverableOutputs: [],
      outputMatches: [
        {
          expectedPath: outputPath,
          status: "complete",
          actualPath: outputPath,
          recoverableCandidates: [],
          reason: "Pre-real-test fixture manifest matched the returned output.",
        },
      ],
    },
  ];
}

function healthEvidence(runtimeState: ProjectRuntimeState, outputPath: string | undefined): GenerationHealthReport[] {
  if (!outputPath) return runtimeState.imagePipeline.generationHealthReports;
  const request = firstImage2AdapterRequest(runtimeState);
  const preview = firstRequestPreview(runtimeState, request?.taskPlanId);
  const taskPlan = runtimeState.imagePipeline.imageTaskPlans.find((plan) => plan.taskPlanId === request?.taskPlanId);
  const reportId = `pre_real_test_health_${safeId(request?.taskPlanId || preview?.jobId)}`;
  return [
    ...runtimeState.imagePipeline.generationHealthReports.filter((report) => report.reportId !== reportId),
    {
      reportId,
      taskPlanId: request?.taskPlanId || taskPlan?.taskPlanId || "one_shot_task",
      jobId: preview?.jobId || taskPlan?.jobId || "one_shot_job",
      shotId: preview?.shotId || taskPlan?.shotId || runtimeState.realProviderOneShotTest.plannedAction?.shotId || "one_shot_shot",
      expectedOutputPath: outputPath,
      outputExists: true,
      manifestStatus: "complete",
      qaStatus: "pass",
      stalePrompt: false,
      assetReadinessStatus: "ready",
      healthStatus: "formal_ready",
      blockers: [],
      warnings: [],
      nextAction: "review",
    },
  ];
}

function qaEvidence(runtimeState: ProjectRuntimeState, outputPath: string | undefined): QaPromotionReport[] {
  if (!outputPath) return runtimeState.imagePipeline.qaPromotionReports;
  const request = firstImage2AdapterRequest(runtimeState);
  const preview = firstRequestPreview(runtimeState, request?.taskPlanId);
  const reportId = `pre_real_test_qa_${safeId(request?.taskPlanId || preview?.jobId)}`;
  return [
    ...runtimeState.imagePipeline.qaPromotionReports.filter((report) => report.reportId !== reportId),
    {
      reportId,
      taskPlanId: request?.taskPlanId || "one_shot_task",
      jobId: preview?.jobId || "one_shot_job",
      shotId: preview?.shotId || runtimeState.realProviderOneShotTest.plannedAction?.shotId || "one_shot_shot",
      candidatePath: outputPath,
      formalPath: outputPath,
      promotionStatus: "ready_for_promotion",
      requiredGates: {
        expectedOutput: true,
        manifestMatch: true,
        promptFresh: true,
        assetReadiness: true,
        qaPass: true,
      },
      blockers: [],
      warnings: ["Pre-real-test closure stops at review; it does not auto-promote returned samples."],
      canPromoteToFormal: false,
    },
  ];
}

function directorProgressFor(status: ReturnType<typeof buildProviderHandoffStatus>) {
  if (status.status === "needs_review") {
    return {
      label: "等待复核",
      detail: "1 个 Image2 小样 · 输出已回流",
      tone: "review",
      total: 1,
      preparing: 0,
      working: 0,
      review: 1,
      blocked: 0,
      complete: 0,
    };
  }
  if (status.status === "waiting_file") {
    return {
      label: "等待文件",
      detail: "1 个 Image2 小样 · 等待输出回流",
      tone: "working",
      total: 1,
      preparing: 0,
      working: 1,
      review: 0,
      blocked: 0,
      complete: 0,
    };
  }
  if (status.status === "blocked") {
    return {
      label: "有阻断",
      detail: "1 个 Image2 小样 · 需要复核",
      tone: "blocked",
      total: 1,
      preparing: 0,
      working: 0,
      review: 0,
      blocked: 1,
      complete: 0,
    };
  }
  return undefined;
}

function sourceStartFrameDeliveryFactsFor(
  options: PreRealTestClosureOptions,
  imageReferenceTransport: ReturnType<typeof buildImageReferenceTransport>,
): ImageReferenceDeliverySourceFacts | undefined {
  if (options.sourceStartFrameDeliveryFacts) return options.sourceStartFrameDeliveryFacts;
  const transportSource = imageReferenceTransport.sourceStartFrame;
  const facts = options.sourceStartFrameFileFacts;
  if (!transportSource || !facts?.hash || !facts.mime || !facts.dimensions || facts.status !== "available") return undefined;
  return {
    inputId: transportSource.inputId,
    path: transportSource.path,
    sha256: facts.hash,
    mime: facts.mime,
    byteLength: 1,
    dimensions: facts.dimensions,
    exists: true,
    readable: true,
    pathScope: "sandbox",
  };
}

export function applyPreRealTestClosure(
  runtimeState: ProjectRuntimeState,
  options: PreRealTestClosureOptions = {},
): PreRealTestClosureResult {
  const generatedAt = options.generatedAt || runtimeState.generatedAt;
  const request = firstImage2AdapterRequest(runtimeState);
  const preview = firstRequestPreview(runtimeState, request?.taskPlanId);
  if (!request || !preview) {
    throw new Error("Pre-real-test closure requires one preview-ready Image2 request.");
  }
  const image2Preview = {
    ...preview,
    providerId: "openai-image2-api" as const,
    adapterId: "openai-image2-api-dry-run",
  };

  const confirmationId = `pre_real_test_confirm_${safeId(image2Preview.previewId || request.requestId)}`;
  const actionConfirmation: RealProviderOneShotActionConfirmation = {
    confirmationId,
    confirmedBy: "user",
    confirmedAt: generatedAt,
    scope: "single_image2_one_shot",
    budgetNoticeAccepted: true,
    sandboxNoticeAccepted: true,
    oneUseReceipt: true,
  };
  const credentialGrant: RealProviderOneShotCredentialGrant = {
    providerId: "openai-image2-api",
    credentialRef: "user-authorized:image2:pre-real-test",
    grantScope: "image2_one_shot",
    authorizedAt: generatedAt,
    secretMaterialPresent: false,
  };
  const imageReferenceTransport = buildImageReferenceTransport({
    generatedAt,
    request,
    actionCapability: {
      actionId: `pre_real_test_image_reference_${safeId(request.requestId)}`,
      providerId: "openai-image2-api",
      providerSlot: image2Preview.providerSlot,
      requiredMode: image2Preview.requiredMode,
      interfaceKind: request.operation === "image2image" ? "explicit_image_input" : "structured_handoff",
      inputKinds: request.operation === "image2image" ? ["text", "local_image", "reference_image"] : ["text"],
      supportsExplicitImageInput: request.operation === "image2image",
      supportsLocalImageInput: request.operation === "image2image",
      supportsFileReferenceInput: request.operation === "image2image",
      supportsPromptOnly: false,
      referenceImageInputRoles: request.operation === "image2image" ? ["source_start_frame"] : [],
      notes: ["Pre-real-test closure builds a handoff receipt only; it never performs provider transport."],
    },
    appServerCapability: {
      runtimeKind: "agent_app_server",
      readiness: "ready",
      canUseImageRuntime: true,
      imageRuntimeAvailable: true,
      imageRuntimeSupportsExplicitInputs: true,
      imageRuntimeSupportsLocalFiles: true,
      imageRuntimeInputKinds: request.operation === "image2image" ? ["text", "local_image", "reference_image"] : ["text"],
      generatedSchemaAvailable: true,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      notes: ["This state is capability evidence for handoff gating, not an app-server provider call."],
    },
    outputSandbox: {
      root: runtimeState.executionLedger.outputSandbox.root,
      allowedPrefixes: runtimeState.executionLedger.outputSandbox.allowedPrefixes,
      expectedOutputPath: image2Preview.outputPath || request.payload.outputPath,
      manifestPath: runtimeState.executionLedger.outputSandbox.manifestPath,
      qaReportPath: runtimeState.executionLedger.outputSandbox.qaReportPath,
      outsideRootWriteAllowed: false,
    },
    sourceStartFrameFileFacts: options.sourceStartFrameFileFacts,
  });
  const needsSourceStartFrameDelivery = request.operation === "image2image" || request.frameRole === "end_frame";
  const sourceStartFrameDeliveryFacts = needsSourceStartFrameDelivery
    ? sourceStartFrameDeliveryFactsFor(options, imageReferenceTransport)
    : undefined;
  const imageReferenceDeliveryReceipt = needsSourceStartFrameDelivery
    ? buildImageReferenceDeliveryReceipt({
        generatedAt,
        transport: imageReferenceTransport,
        sourceStartFrameFileFacts: sourceStartFrameDeliveryFacts,
        delivery: {
          receiptId: `dry_delivery_receipt_${safeId(request.requestId)}`,
          requestId: imageReferenceTransport.requestId,
          taskPlanId: imageReferenceTransport.taskPlanId,
          operation: imageReferenceTransport.operation,
          frameRole: imageReferenceTransport.frameRole,
          deliveredInputKind: "app_server_localImage",
          actionSchemaParamName: "input_image",
          acceptedByActionSchema: true,
          deliveredSha256: sourceStartFrameDeliveryFacts?.sha256 || imageReferenceTransport.sourceStartFrame?.hash || "missing-source-start-frame",
          promptOnly: false,
          protocol: {
            threadId: `dry_thread_${safeId(request.requestId)}`,
            turnId: `dry_turn_${safeId(request.taskPlanId)}`,
            toolCallId: `dry_tool_call_${safeId(request.requestId)}`,
          },
          toolSchemaHash: `sha256:dry_image_reference_delivery_${safeId(request.requestId)}`,
          generatedSchemaVersion: "dry_fixture_v0",
        },
      })
    : undefined;
  const oneShotRealCallState = buildRealProviderOneShotState({
    generatedAt,
    selectedShotIds: runtimeState.realProviderOneShotTest.selectedShotIds,
    selectedTaskPlanIds: runtimeState.realProviderOneShotTest.selectedTaskPlanIds,
    requestPreview: image2Preview,
    adapterRequest: request,
    imageReferenceTransport,
    imageReferenceDeliveryReceipt,
    actionConfirmation,
    credentialGrant,
    budgetNotice: {
      estimatedImageCount: Math.min(2, Math.max(1, runtimeState.realProviderOneShotTest.budgetSnapshot.estimatedImageCount || 1)) as 1 | 2,
      maxImagesAllowed: 2,
      maxProviderSubmits: 1,
      budgetNotice: "This single confirmed sample may use up to two Image2 images from the user's configured quota.",
      quotaNoticeAccepted: true,
    },
    sandbox: {
      root: runtimeState.executionLedger.outputSandbox.root,
      allowedPrefixes: runtimeState.executionLedger.outputSandbox.allowedPrefixes,
      manifestPath: runtimeState.executionLedger.outputSandbox.manifestPath,
      qaReportPath: runtimeState.executionLedger.outputSandbox.qaReportPath,
      outsideRootWriteAllowed: false,
    },
  });
  const plan = buildRealProviderTransportPlan({
    generatedAt,
    oneShotState: oneShotRealCallState,
    imageReferenceTransport,
    imageReferenceDeliveryReceipt,
    transportMode: options.transportMode || "mock_dry_run",
    manualTransportAcknowledged: options.manualTransportAcknowledged,
  });
  const receipt = buildRealProviderTransportReceipt({
    generatedAt,
    plan,
    providerTaskRef: options.providerTaskRef || `mock:image2:${safeId(preview.shotId || request.taskPlanId)}`,
    providerSelfReportedComplete: Boolean(options.providerSelfReportedComplete || options.returnEvidence?.providerSelfReportedComplete),
  });
  const result = buildRealProviderTransportResult({
    generatedAt,
    receipt,
    watcherExpectedOutputDetected: Boolean(options.returnEvidence?.watcherExpectedOutputDetected),
    manifestMatched: Boolean(options.returnEvidence?.manifestMatched),
    qaPassed: Boolean(options.returnEvidence?.qaPassed),
  });
  const realProviderTransport = { plan, receipt, result };
  const outputPath = outputPathFor(runtimeState, options.returnEvidence?.outputPath);
  const returned = Boolean(
    outputPath &&
      options.returnEvidence?.watcherExpectedOutputDetected &&
      options.returnEvidence?.manifestMatched &&
      options.returnEvidence?.qaPassed,
  );
  const watcherEvents = returned ? watcherEvidence(runtimeState, generatedAt, outputPath) : runtimeState.imagePipeline.watcherEvents;
  const manifestReports = returned ? manifestEvidence(runtimeState, outputPath) : runtimeState.manifestMatches.reports;
  const generationHealthReports = returned ? healthEvidence(runtimeState, outputPath) : runtimeState.imagePipeline.generationHealthReports;
  const qaPromotionReports = returned ? qaEvidence(runtimeState, outputPath) : runtimeState.imagePipeline.qaPromotionReports;
  const taskViews = withReturnedTaskViews(runtimeState, returned ? outputPath : undefined);
  const runs = withReturnedTaskRuns(runtimeState, returned ? outputPath : undefined);
  const previewExport = buildPreviewExportState({
    generatedAt,
    projectRoot: runtimeState.project.root,
    previewEvents: runtimeState.previewEvents,
    shots: runtimeState.storyFlow.shots,
    jobs: runtimeState.taskRuns.jobs,
    taskRuns: runs,
    taskViews: taskViews.map((task) => ({
      job: task.job,
      shotId: task.shotId,
      taskRun: task.taskRun,
      manifestMatch: task.manifestMatch,
    })),
    manifestMatches: manifestReports,
    generationHealthReports,
    qaPromotionReports,
    issues: runtimeState.diagnostics.issues,
  });
  const providerHandoffStatus = buildProviderHandoffStatus({
    generatedAt,
    realProviderOneShotTest: runtimeState.realProviderOneShotTest,
    realProviderTransport,
    previewExport,
    imagePipeline: {
      watcherEvents,
      generationHealthReports,
      qaPromotionReports,
    },
    manifestMatches: {
      reports: manifestReports,
    },
  });
  const nextRuntimeState: ProjectRuntimeState & { directorProgress?: unknown } = {
    ...runtimeState,
    generatedAt,
    taskRuns: {
      ...runtimeState.taskRuns,
      runs,
      taskViews,
    },
    manifestMatches: {
      ...runtimeState.manifestMatches,
      reports: manifestReports,
      summary: {
        complete: manifestReports.filter((report) => report.status === "complete").length,
        present: manifestReports.filter((report) => report.status === "actual_output_present").length,
        missing: manifestReports.filter((report) => report.status === "missing_expected_output" || report.status === "qa_missing").length,
        recoverable: manifestReports.filter((report) => report.status === "postprocess_recoverable").length,
      },
    },
    imagePipeline: {
      ...runtimeState.imagePipeline,
      watcherEvents,
      generationHealthReports,
      qaPromotionReports,
      imageReferenceTransports: [
        ...(runtimeState.imagePipeline.imageReferenceTransports || []),
        imageReferenceTransport,
      ],
      imageReferenceDeliveryReceipts: imageReferenceDeliveryReceipt
        ? [
            ...(runtimeState.imagePipeline.imageReferenceDeliveryReceipts || []),
            imageReferenceDeliveryReceipt,
          ]
        : runtimeState.imagePipeline.imageReferenceDeliveryReceipts || [],
    },
    previewExport,
    realProviderTransport,
    providerHandoffStatus,
    directorProgress: directorProgressFor(providerHandoffStatus) || (runtimeState as ProjectRuntimeState & { directorProgress?: unknown }).directorProgress,
  };

  return {
    actionConfirmation,
    credentialGrant,
    oneShotRealCallState,
    realProviderTransport,
    runtimeState: nextRuntimeState,
  };
}
