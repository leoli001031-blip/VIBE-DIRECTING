import type { ManifestMatchReport } from "./manifestMatcher";
import { buildMotionEndpointContract } from "./motionPlanning";
import type { QueueGateResult } from "./taskQueue";
import type {
  AudioPlanningState,
  AuditIssue,
  GateSet,
  GateStatus,
  GenerationJob,
  KeyframePairDerivation,
  MotionEndpointContract,
  PreflightReport,
  ProviderCapability,
  ProviderRegistry,
  ShotRecord,
  TaskEnvelope,
  TaskRun,
  VideoPlanningState,
  VideoReadinessGate,
  VideoReadinessGateCheck,
  VideoTaskPlan,
} from "./types";

export const videoPlanningSchemaVersion = "0.1.0";

export interface VideoPlanningTaskContext {
  job: GenerationJob;
  shotId?: string;
  envelope: TaskEnvelope;
  taskRun: TaskRun;
  queueGate: QueueGateResult;
  manifestMatch: ManifestMatchReport;
}

export interface BuildVideoPlanningStateInput {
  generatedAt: string;
  shots: ShotRecord[];
  jobs: GenerationJob[];
  taskViews: VideoPlanningTaskContext[];
  providerRegistry: ProviderRegistry;
  audioPlanning: AudioPlanningState;
  issues: AuditIssue[];
  motionEndpointContracts?: MotionEndpointContract[];
}

interface MotionEndpointFacts {
  motionType: MotionEndpointContract["motionType"];
  whetherEndFrameRequired: boolean;
  endFrameRequiredReason: string;
  contractStatus: MotionEndpointContract["status"];
  editableRegionIds: string[];
  protectedRegionIds: string[];
  bodyMechanicsRequired: boolean;
  bboxOnlyMotionForbidden: boolean;
}

type VideoReadinessGateWithMotion = VideoReadinessGate & {
  motionEndpointContract: MotionEndpointContract;
};

type VideoTaskPlanWithMotion = VideoTaskPlan & {
  motionEndpointFacts: MotionEndpointFacts;
};

const allowedNaGateFields: VideoReadinessGate["allowedNaGateFields"] = ["identity", "scene", "prop", "style"];

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function isParkedState(state?: string): boolean {
  return state === "parked" || state === "planned" || state === "unavailable";
}

function videoCapabilities(registry: ProviderRegistry): ProviderCapability[] {
  return registry.capabilities.filter((capability) => capability.slot === "video.i2v");
}

function selectedVideoProviderId(job: GenerationJob | undefined, registry: ProviderRegistry): VideoTaskPlan["providerId"] {
  if (job?.providerId && videoCapabilities(registry).some((capability) => capability.providerId === job.providerId)) return job.providerId;
  const defaultProvider = registry.defaultProviderBySlot["video.i2v"];
  if (defaultProvider && videoCapabilities(registry).some((capability) => capability.providerId === defaultProvider)) return defaultProvider;
  return videoCapabilities(registry)[0]?.providerId || "registry_unresolved";
}

function selectedVideoCapability(
  providerId: VideoTaskPlan["providerId"],
  registry: ProviderRegistry,
): ProviderCapability | undefined {
  return registry.capabilities.find(
    (capability) =>
      capability.slot === "video.i2v" &&
      capability.requiredMode === "frames2video" &&
      capability.providerId === providerId,
  );
}

function buildFallbackPairDerivation(shot: ShotRecord): KeyframePairDerivation {
  const hasFrames = Boolean(
    shot.startFrame &&
      shot.endFrame &&
      !shot.issues.includes("missing_start_frame") &&
      !shot.issues.includes("missing_end_frame"),
  );
  return {
    shotId: shot.id,
    startFrameId: shot.startFrame || `${shot.id}:start`,
    endFrameId: shot.endFrame || `${shot.id}:end`,
    endDerivationSource: hasFrames ? "start_frame" : "unknown",
    validForI2vPair: hasFrames && shot.gates.pair === "PASS",
    exceptionReason: hasFrames ? undefined : "Start or end keyframe is missing from runtime audit.",
    allowedDelta: ["motion", "micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
  };
}

function check(
  id: string,
  label: string,
  status: VideoReadinessGateCheck["status"],
  required: boolean,
  detail: string,
  target?: string,
): VideoReadinessGateCheck {
  return { id, label, status, required, detail, target };
}

function findMotionEndpointContract(
  contracts: MotionEndpointContract[] | undefined,
  shotId: string,
): MotionEndpointContract | undefined {
  return contracts?.find((contract) => contract.shotId === shotId);
}

function buildMotionEndpointFacts(contract: MotionEndpointContract): MotionEndpointFacts {
  return {
    motionType: contract.motionType,
    whetherEndFrameRequired: contract.whetherEndFrameRequired,
    endFrameRequiredReason: contract.endFrameRequiredReason,
    contractStatus: contract.status,
    editableRegionIds: contract.editableRegions.map((region) => region.id),
    protectedRegionIds: contract.protectedRegions.map((region) => region.id),
    bodyMechanicsRequired: contract.bodyMechanics.required,
    bboxOnlyMotionForbidden: contract.gateInputs.bboxOnlyMotionForbidden,
  };
}

function motionEndpointChecks(input: {
  shot: ShotRecord;
  contract: MotionEndpointContract;
  contractSource: "explicit" | "derived";
  derivation: KeyframePairDerivation;
  startFramePresent: boolean;
  endFramePresent: boolean;
}): VideoReadinessGateCheck[] {
  const { shot, contract, contractSource, derivation, startFramePresent, endFramePresent } = input;
  const endpointRequirementsPresent =
    contract.startPoseRequirement.required &&
    Boolean(contract.startPoseRequirement.description) &&
    Boolean(contract.endFrameRequiredReason) &&
    (!contract.whetherEndFrameRequired || contract.endPoseRequirement.required);
  const gateInputsPass =
    contract.gateInputs.bboxOnlyMotionForbidden &&
    (!contract.whetherEndFrameRequired ||
      (contract.gateInputs.keyframePairPresent &&
        contract.gateInputs.keyframePairDerivesFromStart &&
        derivation.validForI2vPair));
  const regionsDeclared = contract.editableRegions.length > 0 && contract.protectedRegions.length > 0;
  const qaThresholdsStrict =
    contract.qaThresholds.identityPreservation === "strict" &&
    contract.qaThresholds.scenePreservation === "strict" &&
    contract.qaThresholds.maxUnexplainedBboxShift !== "medium" &&
    contract.gateInputs.bboxOnlyMotionForbidden;
  const endFrameRequirementSatisfied =
    !contract.whetherEndFrameRequired ||
    (startFramePresent && endFramePresent && derivation.validForI2vPair && contract.endPoseRequirement.required);

  return [
    check(
      "motion_contract_present_or_derived",
      "motion contract present or derived",
      "pass",
      true,
      contractSource === "explicit"
        ? "Shot has an explicit MotionEndpointContract."
        : "Shot uses a derived fallback MotionEndpointContract from the keyframe pair derivation.",
      contract.shotId,
    ),
    check(
      "motion_contract_not_blocked",
      "motion contract not blocked",
      contract.status === "blocked" ? "blocked" : contract.status === "warning" ? "warning" : "pass",
      true,
      contract.status === "blocked"
        ? `MotionEndpointContract is blocked: ${contract.blockers.join("; ")}`
        : contract.status === "warning"
          ? `MotionEndpointContract has warnings: ${contract.warnings.join("; ")}`
          : "MotionEndpointContract is pass.",
      contract.shotId,
    ),
    check(
      "motion_endpoint_requirements_present",
      "motion endpoint requirements present",
      endpointRequirementsPresent ? "pass" : "blocked",
      true,
      endpointRequirementsPresent
        ? "Start/end pose requirements and end-frame reason are present."
        : "Motion endpoint contract is missing required pose or end-frame requirement facts.",
      contract.shotId,
    ),
    check(
      "motion_gate_inputs_pass",
      "motion gate inputs pass",
      gateInputsPass ? "pass" : "blocked",
      true,
      gateInputsPass
        ? "Motion gate inputs forbid bbox-only motion and satisfy required keyframe derivation facts."
        : "Motion gate inputs do not satisfy bbox-only or required keyframe derivation constraints.",
      contract.shotId,
    ),
    check(
      "motion_regions_declared",
      "motion regions declared",
      regionsDeclared ? "pass" : "blocked",
      true,
      regionsDeclared
        ? "Motion contract declares both editable and protected regions."
        : "Motion contract must declare editable and protected regions.",
      contract.shotId,
    ),
    check(
      "motion_qa_thresholds_strict",
      "motion QA thresholds strict",
      qaThresholdsStrict ? "pass" : "blocked",
      true,
      qaThresholdsStrict
        ? "Motion QA thresholds preserve identity/scene strictly and forbid bbox-only motion."
        : "Motion QA thresholds are not strict enough for video readiness.",
      contract.shotId,
    ),
    check(
      "motion_end_frame_requirement_satisfied",
      "motion end-frame requirement satisfied",
      endFrameRequirementSatisfied ? "pass" : "blocked",
      true,
      contract.whetherEndFrameRequired
        ? endFrameRequirementSatisfied
          ? "Motion type requires an end frame, and the approved keyframe pair satisfies it."
          : "Motion type requires an end frame, but the end frame or keyframe pair is not ready."
        : "Motion type does not require a separate end frame.",
      shot.id,
    ),
  ];
}

function requiredGateCheck(field: "pair" | "story", value: GateStatus, shotId: string): VideoReadinessGateCheck {
  return check(
    `${field}_gate_pass`,
    `${field} gate PASS`,
    value === "PASS" ? "pass" : "blocked",
    true,
    `${field} gate is ${value}; Phase 7.1 requires PASS before video queue readiness.`,
    shotId,
  );
}

function nonRequiredGateCheck(field: keyof GateSet, value: GateStatus, shotId: string): VideoReadinessGateCheck {
  if (value === "FAIL") {
    return check(
      `${field}_gate_not_fail`,
      `${field} gate non-blocking`,
      "blocked",
      true,
      `${field} gate is FAIL; only pair/story are required PASS, but FAIL still blocks video readiness.`,
      shotId,
    );
  }

  const status: VideoReadinessGateCheck["status"] = value === "UNKNOWN" ? "warning" : value === "N/A" ? "not_applicable" : "pass";
  return check(
    `${field}_gate_non_blocking`,
    `${field} gate may be PASS/PARTIAL/N/A`,
    status,
    false,
    `${field} gate is ${value}; Phase 7.1 allows N/A only for identity/scene/prop/style.`,
    shotId,
  );
}

function matchingIssues(issues: AuditIssue[], shot: ShotRecord, job?: GenerationJob): AuditIssue[] {
  return issues.filter((issue) => {
    const target = issue.target || "";
    return (
      issue.severity === "blocker" ||
      /\bP0\b/i.test(issue.id) ||
      /\bP0\b/i.test(issue.title) ||
      /\bP0\b/i.test(issue.detail)
    ) && (!target || target.includes(shot.id) || Boolean(job?.id && target.includes(job.id)));
  });
}

function buildReadinessGate(input: {
  generatedAt: string;
  shot: ShotRecord;
  task?: VideoPlanningTaskContext;
  capability?: ProviderCapability;
  audioPlanning: AudioPlanningState;
  issues: AuditIssue[];
  motionEndpointContract?: MotionEndpointContract;
}): VideoReadinessGateWithMotion {
  const { shot, task, capability, audioPlanning } = input;
  const derivation = task?.envelope.keyframePairDerivation || buildFallbackPairDerivation(shot);
  const explicitMotionEndpointContract = input.motionEndpointContract;
  const motionEndpointContract =
    explicitMotionEndpointContract ||
    buildMotionEndpointContract({
      generatedAt: input.generatedAt,
      shot,
      keyframePair: derivation,
    });
  const motionContractSource: "explicit" | "derived" = explicitMotionEndpointContract ? "explicit" : "derived";
  const startFramePresent = Boolean(shot.startFrame && !shot.issues.includes("missing_start_frame"));
  const endFramePresent = Boolean(shot.endFrame && !shot.issues.includes("missing_end_frame"));
  const hardIssues = matchingIssues(input.issues, shot, task?.job);
  const checks: VideoReadinessGateCheck[] = [
    check(
      "start_frame_present",
      "start frame present",
      startFramePresent ? "pass" : "blocked",
      true,
      startFramePresent ? "Shot has a start frame reference." : "Shot is missing a start frame reference.",
      shot.startFrame || shot.id,
    ),
    check(
      "end_frame_present",
      "end frame present",
      endFramePresent ? "pass" : "blocked",
      true,
      endFramePresent ? "Shot has an end frame reference." : "Shot is missing an end frame reference.",
      shot.endFrame || shot.id,
    ),
    check(
      "keyframe_pair_derivation_valid",
      "keyframe pair derivation valid",
      derivation.validForI2vPair ? "pass" : "blocked",
      true,
      derivation.validForI2vPair
        ? "Start/end frame derivation is valid for I2V."
        : "Start/end frame derivation is missing or invalid for I2V.",
      shot.id,
    ),
    requiredGateCheck("pair", shot.gates.pair, shot.id),
    requiredGateCheck("story", shot.gates.story, shot.id),
    nonRequiredGateCheck("identity", shot.gates.identity, shot.id),
    nonRequiredGateCheck("scene", shot.gates.scene, shot.id),
    nonRequiredGateCheck("prop", shot.gates.prop, shot.id),
    nonRequiredGateCheck("style", shot.gates.style, shot.id),
    ...motionEndpointChecks({
      shot,
      contract: motionEndpointContract,
      contractSource: motionContractSource,
      derivation,
      startFramePresent,
      endFramePresent,
    }),
    check(
      "no_bgm_for_video_provider",
      "no BGM for video provider",
      audioPlanning.videoProviderPolicy.noBgmForVideoProvider ? "pass" : "blocked",
      true,
      audioPlanning.videoProviderPolicy.noBgmForVideoProvider
        ? "Audio planning forbids BGM in video provider prompts."
        : "Audio planning did not assert noBgmForVideoProvider=true.",
      shot.id,
    ),
    check(
      "video_provider_slot_parked",
      "video provider slot parked",
      isParkedState(capability?.executionState) && capability?.liveSubmitAllowed === false ? "pass" : "blocked",
      true,
      capability
        ? `Provider ${capability.providerId} is ${capability.executionState}; liveSubmitAllowed=${capability.liveSubmitAllowed}.`
        : "No parked video.i2v capability was found.",
      capability?.providerId,
    ),
    check(
      "preflight_facts_present",
      "preflight facts present",
      task?.envelope.preflight ? "pass" : "blocked",
      true,
      task?.envelope.preflight
        ? `Preflight status is ${task.envelope.preflight.status}.`
        : "No video task preflight report is available for this shot.",
      task?.job.id || shot.id,
    ),
    check(
      "preflight_has_no_blockers",
      "preflight has no blockers",
      task?.envelope.preflight && task.envelope.preflight.blockers.length === 0 ? "pass" : "blocked",
      true,
      task?.envelope.preflight
        ? task.envelope.preflight.blockers.length === 0
          ? "Video task preflight has no blockers."
          : `Video task preflight has ${task.envelope.preflight.blockers.length} blocker(s).`
        : "No video task preflight report is available for this shot.",
      task?.job.id || shot.id,
    ),
    check(
      "manifest_facts_present",
      "manifest facts present",
      task?.manifestMatch ? "pass" : "blocked",
      true,
      task?.manifestMatch
        ? `Manifest status is ${task.manifestMatch.status}.`
        : "No video task manifest match report is available for this shot.",
      task?.job.id || shot.id,
    ),
    check(
      "no_p0_or_blocker",
      "no P0/blocker",
      hardIssues.length ? "blocked" : "pass",
      true,
      hardIssues.length
        ? `${hardIssues.length} P0/blocker issue(s) apply to this video task.`
        : "No matching P0/blocker issue is attached to this shot or video job.",
      shot.id,
    ),
  ];

  const blockers = uniqueSorted(checks.filter((item) => item.required && item.status === "blocked").map((item) => item.detail));
  const warnings = uniqueSorted([
    ...checks.filter((item) => item.status === "warning").map((item) => item.detail),
    ...motionEndpointContract.warnings,
    ...(task?.envelope.preflight.warnings || []).map((item) => item.messageForUser),
  ]);
  const status: VideoReadinessGate["status"] = blockers.length ? "blocked" : "parked";

  return {
    gateId: `video_readiness_${safeId(shot.id)}`,
    shotId: shot.id,
    status,
    canEnterQueueShell: blockers.length === 0,
    canSubmitToProvider: false,
    startFramePresent,
    endFramePresent,
    keyframePairDerivation: derivation,
    motionEndpointContract,
    allowedNaGateFields,
    checks,
    blockers,
    warnings,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function frameRef(shotId: string, kind: "start" | "end", pathValue?: string): VideoTaskPlan["startFrameRef"] {
  return {
    shotFrameId: pathValue || `${shotId}:${kind}`,
    path: pathValue,
    present: Boolean(pathValue),
    source: pathValue ? "shot_record" : "missing",
  };
}

function manifestFacts(task?: VideoPlanningTaskContext): VideoTaskPlan["manifestFacts"] {
  return {
    status: task?.manifestMatch.status || "not_available",
    expectedOutputs: task?.taskRun.expectedOutputs || [],
    actualOutputs: task?.taskRun.actualOutputs || [],
    missingExpectedOutput: task ? task.manifestMatch.status === "missing_expected_output" : true,
  };
}

function preflightFacts(task?: VideoPlanningTaskContext): VideoTaskPlan["preflightFacts"] {
  const preflight: PreflightReport | undefined = task?.envelope.preflight;
  return {
    taskId: preflight?.taskId,
    status: preflight?.status || "not_available",
    blockerCount: preflight?.blockers.length || 0,
    warningCount: preflight?.warnings.length || 0,
  };
}

function buildVideoTaskPlan(input: {
  shot: ShotRecord;
  task?: VideoPlanningTaskContext;
  gate: VideoReadinessGateWithMotion;
  providerId: VideoTaskPlan["providerId"];
  capability?: ProviderCapability;
}): VideoTaskPlanWithMotion {
  const { shot, task, gate, providerId, capability } = input;
  const preflightBlockers = task?.envelope.preflight.blockers.map((item) => item.messageForUser) || [];
  const providerParked = isParkedState(capability?.executionState);
  const status: VideoTaskPlan["status"] = gate.status === "blocked" ? "blocked" : providerParked ? "parked" : "ready";
  const queueStatus: VideoTaskPlan["queueStatus"] = status;

  return {
    schemaVersion: videoPlanningSchemaVersion,
    taskPlanId: `video_task_plan_${safeId(shot.id)}`,
    jobId: task?.job.id || `video_${safeId(shot.id)}`,
    shotId: shot.id,
    readinessGateId: gate.gateId,
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    providerId,
    providerExecutionState: capability?.executionState || "parked",
    status,
    queueStatus,
    startFrameRef: frameRef(shot.id, "start", shot.startFrame),
    endFrameRef: frameRef(shot.id, "end", shot.endFrame),
    durationSeconds: null,
    durationPlaceholder: "derive_from_preview_event_or_motion_spec_later",
    motionBrief: shot.storyFunction
      ? `Motion should preserve the shot function: ${shot.storyFunction}`
      : "Motion placeholder reserved for future provider enablement.",
    motionEndpointFacts: buildMotionEndpointFacts(gate.motionEndpointContract),
    promptConstraints: [
      "no bgm",
      "start/end frames only",
      "no text-to-video fallback",
      "no fast model",
      "no VIP channel",
      "preserve character identity, scene layout, and style capsule",
    ],
    preflightFacts: preflightFacts(task),
    manifestFacts: manifestFacts(task),
    blockers: uniqueSorted([...gate.blockers, ...preflightBlockers]),
    warnings: uniqueSorted([
      ...gate.warnings,
      ...(task?.queueGate.warnings || []),
      "Provider submission is forbidden while video.i2v remains parked.",
    ]),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    fastModelForbidden: true,
    vipChannelForbidden: true,
    textToVideoForbidden: true,
    liveSubmitAllowed: false,
  };
}

function buildQueueShell(taskPlans: VideoTaskPlan[]): VideoPlanningState["queueShell"] {
  const counts = {
    total: taskPlans.length,
    pending: taskPlans.filter((plan) => plan.queueStatus === "pending").length,
    ready: taskPlans.filter((plan) => plan.queueStatus === "ready").length,
    blocked: taskPlans.filter((plan) => plan.queueStatus === "blocked").length,
    parked: taskPlans.filter((plan) => plan.queueStatus === "parked").length,
  };
  const status: VideoPlanningState["queueShell"]["status"] =
    counts.total === 0
      ? "empty"
      : counts.blocked > 0 && (counts.parked > 0 || counts.ready > 0)
        ? "blocked_with_ready_gates"
        : counts.blocked > 0
          ? "blocked"
          : counts.parked > 0
            ? "parked"
            : "ready";

  return {
    status,
    counts,
    concurrency: {
      placeholder: true,
      configuredLimit: 1,
      activeProviderLimit: 0,
      notes: ["Concurrency is reserved for Phase 7 provider enablement; parked providers have active limit 0."],
    },
    autoContinuePolicy: {
      enabled: false,
      mode: "manual_after_user_enablement",
      providerSubmissionForbidden: true,
      notes: ["Auto-continue can only be enabled after the user explicitly enables a live video adapter."],
    },
    longQueueTimeout: {
      placeholder: true,
      stallTimeoutSeconds: 600,
      action: "surface_waiting_state_only",
      notes: ["Timeout handling is a queue shell placeholder and never queries Seedance/Jimeng in Phase 7.1."],
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Queue shell may display parked/blocked shot readiness, but it cannot submit provider tasks.",
      "blocked_with_ready_gates is only a queue-level mixed state when at least one shot is blocked and at least one shot is enterable.",
    ],
  };
}

function buildProviderPolicySummary(registry: ProviderRegistry): VideoPlanningState["providerPolicySummary"] {
  return {
    videoProvidersRemainParked: true,
    liveSubmitAllowed: false,
    userEnablementRequired: true,
    providerSubmissionForbidden: true,
    fastModelForbidden: true,
    vipChannelForbidden: true,
    textToVideoForbidden: true,
    parkedProviderIds: uniqueSorted(videoCapabilities(registry).map((capability) => capability.providerId)),
    notes: [
      "Seedance/Jimeng video providers remain parked.",
      "liveSubmitAllowed=false until a later explicit user enablement flow.",
      "Fast, VIP, and text-to-video paths are forbidden for the default formal video path.",
    ],
  };
}

export function buildVideoPlanningState(input: BuildVideoPlanningStateInput): VideoPlanningState {
  const videoTasksByShot = new Map(
    input.taskViews
      .filter((task) => task.job.slot === "video.i2v")
      .map((task) => [task.shotId || task.envelope.keyframePairDerivation?.shotId || task.job.id, task]),
  );
  const readinessGates: VideoReadinessGateWithMotion[] = [];
  const taskPlans: VideoTaskPlanWithMotion[] = [];

  for (const shot of input.shots) {
    const task = videoTasksByShot.get(shot.id);
    const providerId = selectedVideoProviderId(task?.job || input.jobs.find((job) => job.id.includes(shot.id) && job.slot === "video.i2v"), input.providerRegistry);
    const capability = selectedVideoCapability(providerId, input.providerRegistry) || videoCapabilities(input.providerRegistry)[0];
    const gate = buildReadinessGate({
      generatedAt: input.generatedAt,
      shot,
      task,
      capability,
      audioPlanning: input.audioPlanning,
      issues: input.issues,
      motionEndpointContract: findMotionEndpointContract(input.motionEndpointContracts, shot.id),
    });
    readinessGates.push(gate);
    taskPlans.push(buildVideoTaskPlan({ shot, task, gate, providerId, capability }));
  }

  return {
    schemaVersion: videoPlanningSchemaVersion,
    generatedAt: input.generatedAt,
    readinessGates,
    taskPlans,
    queueShell: buildQueueShell(taskPlans),
    providerPolicySummary: buildProviderPolicySummary(input.providerRegistry),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Phase 7.1 creates video provider readiness and queue-shell contracts only.",
      "No task is real-submit ready; providerSubmissionForbidden remains true.",
    ],
  };
}
