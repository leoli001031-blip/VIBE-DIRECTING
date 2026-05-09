export const round5ArtifactIngestSchemaVersion = "0.1.0";

export const round5EndFrameBlockers = [
  "approved_start_attachment_missing",
  "strict_image_edit_provenance_missing",
  "provider_edit_receipt_missing",
  "source_start_frame_attachment_id_missing",
  "source_start_frame_sha_not_provider_confirmed",
  "editable_region_mask_or_bbox_missing",
] as const;

export const round5ArtifactIsolationFlags = {
  mainThreadImageBytesForbidden: true,
  sidecarOnlyImageTransport: true,
  noProjectVibeMutation: true,
} as const;

type Round5QaStatus = "pass" | "needs_review" | "blocked" | "missing";
type Round5LedgerStatus = "provider_observed" | "needs_review" | "parked" | "waiting_output";
type Round5GateStatus =
  | "start_provider_observed"
  | "start_needs_review"
  | "start_regeneration_required"
  | "end_edit_preflight_blocked"
  | "start_missing";
type Round5NextAction =
  | "none"
  | "review_start_frame"
  | "regenerate_start_frame"
  | "block_regenerate_start"
  | "collect_strict_edit_provenance";

export interface Round5GeneratedStartFrame {
  shotId: string;
  startFramePath?: string;
  path?: string;
  exists?: boolean;
  sha256?: string;
  status?: string;
}

export interface Round5ShotQa {
  shotId: string;
  path?: string;
  qaStatus?: string;
  startStatus?: string;
  endStatus?: string;
  motionAffordance?: string;
  hardChecks?: Record<string, boolean>;
  issues?: string[];
  improvement?: string;
}

export interface Round5FullRealChainReport {
  schemaVersion?: string;
  generatedAt?: string;
  runRoot?: string;
  providerPathUsed?: string;
  generatedStartFrames?: Round5GeneratedStartFrame[];
  shotQa?: Round5ShotQa[];
  assetQa?: Array<{ id?: string; path?: string; status?: string; issues?: string[] }>;
  endFrameStage?: {
    status?: string;
    appliesTo?: string[];
    blockers?: string[];
    verifiedAbsent?: string[];
  };
}

export interface BuildRound5ArtifactIngestInput {
  runRoot: string;
  projectId: string;
  runId: string;
  report: Round5FullRealChainReport;
  generatedAt?: string;
}

export interface Round5TaskRunLedgerStyleEvent {
  eventId: string;
  eventType:
    | "task_prepared"
    | "output_detected_no_sidecar"
    | "provider_observed"
    | "qa_passed"
    | "needs_review"
    | "parked";
  at: string;
  taskRunId: string;
  output?: {
    path: string;
    hash: string;
    hashAlgorithm: "sha256";
  };
  providerObservation?: {
    providerId: string;
    observationId: string;
    outputPath: string;
    outputHash: string;
  };
  qaReview?: {
    qaReportId: string;
    outputPath: string;
    reviewedOutputHash: string;
    status: "pass" | "needs_review" | "failed";
    findingIds: string[];
  };
  reason?: string;
  notes: string[];
}

export interface Round5TaskRunLedgerStyle {
  schemaVersion: string;
  ledgerId: string;
  projectId: string;
  taskRunId: string;
  createdAt: string;
  updatedAt: string;
  expectedOutputs: string[];
  events: Round5TaskRunLedgerStyleEvent[];
}

export interface Round5ShotGateProjection {
  shotId: string;
  taskRunId: string;
  startFramePath?: string;
  startFrameSha256?: string;
  startExists: boolean;
  startQaStatus: Round5QaStatus;
  endRequired: boolean;
  endFramePath: string;
  endExists: false;
  gateStatus: Round5GateStatus;
  ledgerStatus: Round5LedgerStatus;
  nextAction: Round5NextAction;
  strictEditPilotCandidate: boolean;
  completeVerified: false;
  blockers: string[];
  warnings: string[];
}

export interface Round5ArtifactIngestResult {
  schemaVersion: string;
  runRoot: string;
  projectId: string;
  runId: string;
  sourceReportSchemaVersion?: string;
  isolation: typeof round5ArtifactIsolationFlags;
  assetGateSummary: {
    total: number;
    needsReview: number;
    pass: number;
    statuses: string[];
  };
  shotGateMatrix: Round5ShotGateProjection[];
  ledgers: Round5TaskRunLedgerStyle[];
  ledgerProjection: {
    total: number;
    byStatus: Record<Round5LedgerStatus, number>;
    completeVerified: 0;
    endEditPreflightBlocked: number;
    projections: Round5ShotGateProjection[];
  };
  uiSummary: {
    status: "blocked" | "needs_review" | "in_progress";
    complete: false;
    completeVerified: false;
    providerCalled: false;
    generatedImages: false;
    totalShots: number;
    observedStarts: number;
    endFramesComplete: 0;
    nextActions: Array<{ shotId: string; nextAction: Round5NextAction }>;
    warnings: string[];
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function taskRunIdFor(runId: string, shotId: string): string {
  return `${runId}:${shotId}:start`;
}

function qaStatusFor(shotQa?: Round5ShotQa, generated?: Round5GeneratedStartFrame): Round5QaStatus {
  const qaStatus = (shotQa?.qaStatus || "").toLowerCase();
  const startStatus = (shotQa?.startStatus || generated?.status || "").toLowerCase();
  if (!generated?.exists) return "missing";
  if (qaStatus.startsWith("blocked") || startStatus.includes("motion_affordance_failed") || startStatus.includes("failed")) return "blocked";
  if (qaStatus.includes("needs_review") || startStatus.includes("needs_review")) return "needs_review";
  if (qaStatus.startsWith("pass") || startStatus.includes("generated")) return "pass";
  return "needs_review";
}

function endRequiredFor(shotId: string, report: Round5FullRealChainReport, shotQa?: Round5ShotQa): boolean {
  if (report.endFrameStage?.appliesTo?.includes(shotId)) return true;
  const endStatus = shotQa?.endStatus || "";
  return Boolean(endStatus && endStatus !== "not_required");
}

function blockersFor(input: {
  qaStatus: Round5QaStatus;
  endRequired: boolean;
  shotQa?: Round5ShotQa;
  report: Round5FullRealChainReport;
}): string[] {
  const shotIssues = input.shotQa?.issues || [];
  if (input.qaStatus === "missing") return unique(["start_frame_missing", ...shotIssues]);
  if (input.qaStatus === "blocked") return unique(["start_motion_affordance_failed", ...shotIssues]);
  if (input.endRequired) return unique([...(input.report.endFrameStage?.blockers || round5EndFrameBlockers), ...shotIssues]);
  if (input.qaStatus === "needs_review") return unique(["start_frame_needs_review", ...shotIssues]);
  return unique(shotIssues);
}

function gateStatusFor(qaStatus: Round5QaStatus, endRequired: boolean): Round5GateStatus {
  if (qaStatus === "missing") return "start_missing";
  if (qaStatus === "blocked") return "start_regeneration_required";
  if (qaStatus === "needs_review") return "start_needs_review";
  if (endRequired) return "end_edit_preflight_blocked";
  return "start_provider_observed";
}

function ledgerStatusFor(qaStatus: Round5QaStatus): Round5LedgerStatus {
  if (qaStatus === "missing") return "waiting_output";
  if (qaStatus === "blocked") return "parked";
  if (qaStatus === "needs_review") return "needs_review";
  return "provider_observed";
}

function nextActionFor(shotId: string, qaStatus: Round5QaStatus, endRequired: boolean): Round5NextAction {
  if (shotId === "ZP04" && qaStatus === "blocked") return "regenerate_start_frame";
  if (qaStatus === "blocked") return "block_regenerate_start";
  if (qaStatus === "needs_review") return "review_start_frame";
  if (endRequired) return "collect_strict_edit_provenance";
  return "none";
}

function buildEvents(input: {
  generatedAt: string;
  projectId: string;
  taskRunId: string;
  shotId: string;
  path?: string;
  sha256?: string;
  qaStatus: Round5QaStatus;
  blockers: string[];
}): Round5TaskRunLedgerStyleEvent[] {
  const events: Round5TaskRunLedgerStyleEvent[] = [
    {
      eventId: `${input.taskRunId}:prepared`,
      eventType: "task_prepared",
      at: input.generatedAt,
      taskRunId: input.taskRunId,
      notes: ["Projected from Round 5 artifact report; no provider call or file mutation performed."],
    },
  ];

  if (!input.path || !input.sha256) return events;

  events.push({
    eventId: `${input.taskRunId}:output_detected_no_sidecar`,
    eventType: "output_detected_no_sidecar",
    at: input.generatedAt,
    taskRunId: input.taskRunId,
    output: { path: input.path, hash: input.sha256, hashAlgorithm: "sha256" },
    notes: ["start.png exists in run artifacts; image bytes stay in sidecar/artifact storage."],
  });

  events.push({
    eventId: `${input.taskRunId}:provider_observed`,
    eventType: "provider_observed",
    at: input.generatedAt,
    taskRunId: input.taskRunId,
    providerObservation: {
      providerId: "round5_report_artifact_projection",
      observationId: `${input.projectId}:${input.shotId}:start`,
      outputPath: input.path,
      outputHash: input.sha256,
    },
    notes: ["Observation is report-derived; it is not a new provider invocation."],
  });

  if (input.qaStatus === "pass") {
    events.push({
      eventId: `${input.taskRunId}:qa_passed`,
      eventType: "qa_passed",
      at: input.generatedAt,
      taskRunId: input.taskRunId,
      qaReview: {
        qaReportId: `${input.shotId}:start_motion_affordance_qa`,
        outputPath: input.path,
        reviewedOutputHash: input.sha256,
        status: "pass",
        findingIds: input.blockers,
      },
      notes: ["QA pass does not imply complete_verified without strict sidecars/provenance."],
    });
  } else if (input.qaStatus === "needs_review") {
    events.push({
      eventId: `${input.taskRunId}:needs_review`,
      eventType: "needs_review",
      at: input.generatedAt,
      taskRunId: input.taskRunId,
      qaReview: {
        qaReportId: `${input.shotId}:start_motion_affordance_qa`,
        outputPath: input.path,
        reviewedOutputHash: input.sha256,
        status: "needs_review",
        findingIds: input.blockers,
      },
      notes: ["Start frame requires review before downstream promotion."],
    });
  } else if (input.qaStatus === "blocked") {
    events.push({
      eventId: `${input.taskRunId}:parked`,
      eventType: "parked",
      at: input.generatedAt,
      taskRunId: input.taskRunId,
      reason: input.blockers.join(", "),
      notes: ["Start frame is parked until regenerated; end frame must remain blocked."],
    });
  }

  return events;
}

export function buildRound5ArtifactIngest(input: BuildRound5ArtifactIngestInput): Round5ArtifactIngestResult {
  const generatedAt = input.generatedAt || input.report.generatedAt || "1970-01-01T00:00:00.000Z";
  const startsByShot = new Map((input.report.generatedStartFrames || []).map((item) => [item.shotId, item]));
  const qaByShot = new Map((input.report.shotQa || []).map((item) => [item.shotId, item]));
  const shotIds = unique([...startsByShot.keys(), ...qaByShot.keys()]).sort();

  const shotGateMatrix = shotIds.map((shotId): Round5ShotGateProjection => {
    const generated = startsByShot.get(shotId);
    const shotQa = qaByShot.get(shotId);
    const startFramePath = generated?.startFramePath || generated?.path || shotQa?.path;
    const startFrameSha256 = generated?.sha256;
    const startExists = Boolean(generated?.exists && startFramePath && startFrameSha256);
    const startQaStatus = qaStatusFor(shotQa, generated);
    const endRequired = endRequiredFor(shotId, input.report, shotQa);
    const blockers = blockersFor({ qaStatus: startQaStatus, endRequired, shotQa, report: input.report });
    const nextAction = nextActionFor(shotId, startQaStatus, endRequired);

    return {
      shotId,
      taskRunId: taskRunIdFor(input.runId, shotId),
      startFramePath,
      startFrameSha256,
      startExists,
      startQaStatus,
      endRequired,
      endFramePath: `shots/${shotId}/end.png`,
      endExists: false,
      gateStatus: gateStatusFor(startQaStatus, endRequired),
      ledgerStatus: ledgerStatusFor(startQaStatus),
      nextAction,
      strictEditPilotCandidate: shotId === "ZP05" && endRequired && startQaStatus === "pass",
      completeVerified: false,
      blockers,
      warnings: shotQa?.issues || [],
    };
  });

  const ledgers = shotGateMatrix.map((shot) => {
    const events = buildEvents({
      generatedAt,
      projectId: input.projectId,
      taskRunId: shot.taskRunId,
      shotId: shot.shotId,
      path: shot.startFramePath,
      sha256: shot.startFrameSha256,
      qaStatus: shot.startQaStatus,
      blockers: shot.blockers,
    });
    return {
      schemaVersion: "task_run_ledger_style_projection_v1",
      ledgerId: `round5_artifact_ledger_${input.runId}_${shot.shotId}`,
      projectId: input.projectId,
      taskRunId: shot.taskRunId,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      expectedOutputs: unique([shot.startFramePath || "", shot.endRequired ? shot.endFramePath : ""]),
      events,
    };
  });

  const byStatus: Record<Round5LedgerStatus, number> = {
    provider_observed: 0,
    needs_review: 0,
    parked: 0,
    waiting_output: 0,
  };
  for (const shot of shotGateMatrix) byStatus[shot.ledgerStatus] += 1;

  const assetStatuses = (input.report.assetQa || []).map((item) => item.status || "unknown");
  const nextActions = shotGateMatrix
    .filter((shot) => shot.nextAction !== "none")
    .map((shot) => ({ shotId: shot.shotId, nextAction: shot.nextAction }));

  const status = shotGateMatrix.some((shot) => shot.gateStatus === "start_regeneration_required" || shot.gateStatus === "end_edit_preflight_blocked")
    ? "blocked"
    : shotGateMatrix.some((shot) => shot.gateStatus === "start_needs_review")
      ? "needs_review"
      : "in_progress";

  return {
    schemaVersion: round5ArtifactIngestSchemaVersion,
    runRoot: input.runRoot,
    projectId: input.projectId,
    runId: input.runId,
    sourceReportSchemaVersion: input.report.schemaVersion,
    isolation: round5ArtifactIsolationFlags,
    assetGateSummary: {
      total: assetStatuses.length,
      needsReview: assetStatuses.filter((status) => status.includes("needs_review")).length,
      pass: assetStatuses.filter((status) => status === "pass").length,
      statuses: unique(assetStatuses),
    },
    shotGateMatrix,
    ledgers,
    ledgerProjection: {
      total: shotGateMatrix.length,
      byStatus,
      completeVerified: 0,
      endEditPreflightBlocked: shotGateMatrix.filter((shot) => shot.gateStatus === "end_edit_preflight_blocked").length,
      projections: shotGateMatrix,
    },
    uiSummary: {
      status,
      complete: false,
      completeVerified: false,
      providerCalled: false,
      generatedImages: false,
      totalShots: shotGateMatrix.length,
      observedStarts: shotGateMatrix.filter((shot) => shot.startExists).length,
      endFramesComplete: 0,
      nextActions,
      warnings: [
        "Round 5 artifact ingest is projection-only; it does not generate images.",
        "End frames remain blocked until strict edit provenance and provider receipts exist.",
      ],
    },
  };
}
