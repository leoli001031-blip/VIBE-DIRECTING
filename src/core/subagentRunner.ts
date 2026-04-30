import type {
  GenerationHarnessJob,
  GenerationHarnessState,
  QaHarnessItem,
  QaHarnessState,
  SubagentRunnerCoverageEntry,
  SubagentRunnerHardLocks,
  SubagentRunnerPacketRequirement,
  SubagentRunnerRequirementCheck,
  SubagentRunnerSlot,
  SubagentRunnerSlotStatus,
  SubagentRunnerState,
  SubagentRunnerTaskKind,
  SubagentTaskEnvelope,
  SubagentTaskPurpose,
  VideoExecutionPreview,
  VideoExecutionPreviewState,
} from "./types";

export const subagentRunnerSchemaVersion = "0.1.0";

export interface SubagentRunnerFreeTextTaskRequest {
  requestId: string;
  taskKind: SubagentRunnerTaskKind;
  purpose?: SubagentTaskPurpose;
  prompt: string;
  shotId?: string;
  sourceRefs?: string[];
}

export interface BuildSubagentRunnerStateInput {
  generatedAt: string;
  videoExecutionPreview?: VideoExecutionPreviewState;
  generationHarness?: GenerationHarnessState;
  qaHarness?: QaHarnessState;
  freeTextTaskRequests?: SubagentRunnerFreeTextTaskRequest[];
}

export const subagentRunnerTaskKinds: SubagentRunnerTaskKind[] = [
  "image",
  "asset",
  "pair_qa",
  "scene_qa",
  "story_audit",
  "video_execution",
  "audio",
  "export",
];

export const subagentRunnerHardLocks: SubagentRunnerHardLocks = {
  dryRunOnly: true,
  diagnosticsOnly: true,
  noFreeTextTask: true,
  validatedEnvelopeRequired: true,
  noSpawnAgent: true,
  noSubprocess: true,
  noShellExecution: true,
  noProviderExecution: true,
  noCredentialRead: true,
  noFileMutation: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
};

export const subagentRunnerPacketRequirements: SubagentRunnerPacketRequirement[] = [
  {
    requirementId: "source_index_hash",
    label: "Source Index Hash",
    required: true,
    schemaPath: "SubagentTaskEnvelope.sourceIndexHash",
    notes: ["Production workers must start from current source-index facts, not chat memory."],
  },
  {
    requirementId: "provider_policy",
    label: "Provider Policy",
    required: true,
    schemaPath: "SubagentTaskEnvelope.providerPolicySummary",
    notes: ["Provider slot, mode, and fallback constraints must be present before worker planning."],
  },
  {
    requirementId: "expected_output_contract",
    label: "Expected Output Contract",
    required: true,
    schemaPath: "SubagentTaskEnvelope.expectedOutputContract",
    notes: ["The runner only accepts structured result contracts."],
  },
  {
    requirementId: "acceptance_checklist",
    label: "Acceptance Checklist",
    required: true,
    schemaPath: "SubagentTaskEnvelope.qaChecklist",
    notes: ["QA/acceptance checks must be declared by the envelope."],
  },
  {
    requirementId: "output_schema",
    label: "Output Schema",
    required: true,
    schemaPath: "SubagentTaskEnvelope.expectedOutputContract.format",
    notes: ["Current dry-run contract requires subagent_result_v1."],
  },
  {
    requirementId: "forbidden_actions",
    label: "Forbidden Actions",
    required: true,
    schemaPath: "SubagentTaskEnvelope.disallowedReadScopes + mustNotAdd + taskEnvelope.hardRules",
    notes: ["Forbidden reads/actions must be explicit; they cannot be inferred from prose."],
  },
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function defaultPurpose(taskKind: SubagentRunnerTaskKind): SubagentTaskPurpose {
  if (taskKind === "video_execution") return "video_generation";
  if (taskKind === "story_audit") return "story_audit";
  if (taskKind === "pair_qa" || taskKind === "scene_qa") return "continuity_audit";
  if (taskKind === "image" || taskKind === "asset") return "visual_generation";
  return "visual_audit";
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function checkEnvelopeRequirements(envelope?: SubagentTaskEnvelope): SubagentRunnerRequirementCheck[] {
  return [
    {
      requirementId: "source_index_hash",
      present: Boolean(envelope?.sourceIndexHash),
      detail: envelope?.sourceIndexHash ? "sourceIndexHash is present." : "sourceIndexHash is missing.",
    },
    {
      requirementId: "provider_policy",
      present: hasItems(envelope?.providerPolicySummary),
      detail: hasItems(envelope?.providerPolicySummary)
        ? "providerPolicySummary is present."
        : "providerPolicySummary is missing.",
    },
    {
      requirementId: "expected_output_contract",
      present: Boolean(envelope?.expectedOutputContract && hasItems(envelope.expectedOutputContract.requiredFields)),
      detail: envelope?.expectedOutputContract
        ? "expectedOutputContract is present."
        : "expectedOutputContract is missing.",
    },
    {
      requirementId: "acceptance_checklist",
      present: hasItems(envelope?.qaChecklist),
      detail: hasItems(envelope?.qaChecklist) ? "qaChecklist is present." : "qaChecklist is missing.",
    },
    {
      requirementId: "output_schema",
      present: envelope?.expectedOutputContract?.format === "subagent_result_v1",
      detail:
        envelope?.expectedOutputContract?.format === "subagent_result_v1"
          ? "output schema is subagent_result_v1."
          : "output schema is missing or unsupported.",
    },
    {
      requirementId: "forbidden_actions",
      present:
        hasItems(envelope?.disallowedReadScopes) &&
        (hasItems(envelope?.mustNotAdd) || hasItems(envelope?.forbiddenReferences) || hasItems(envelope?.taskEnvelope?.hardRules)),
      detail:
        hasItems(envelope?.disallowedReadScopes) &&
        (hasItems(envelope?.mustNotAdd) || hasItems(envelope?.forbiddenReferences) || hasItems(envelope?.taskEnvelope?.hardRules))
          ? "forbidden read scopes/actions are present."
          : "forbidden read scopes/actions are incomplete.",
    },
  ];
}

function statusForEnvelope(
  envelope: SubagentTaskEnvelope | undefined,
  checks: SubagentRunnerRequirementCheck[],
  blockedWhenMissing: boolean,
): Pick<SubagentRunnerSlot, "status" | "envelopeStatus"> {
  if (!envelope) {
    return {
      status: blockedWhenMissing ? "blocked_missing_envelope" : "planned_missing_envelope",
      envelopeStatus: "missing",
    };
  }

  if (checks.every((check) => check.present)) {
    return {
      status: "planned",
      envelopeStatus: "validated",
    };
  }

  return {
    status: "blocked_contract_violation",
    envelopeStatus: "invalid",
  };
}

function blockedReasonsFor(input: {
  status: SubagentRunnerSlotStatus;
  checks: SubagentRunnerRequirementCheck[];
  freeTextPromptPresent?: boolean;
}): string[] {
  return uniqueSorted([
    ...(input.freeTextPromptPresent ? ["free_text_task_input_forbidden"] : []),
    ...(input.status === "planned_missing_envelope" || input.status === "blocked_missing_envelope"
      ? ["validated_subagent_task_envelope_required"]
      : []),
    ...(input.status === "blocked_contract_violation"
      ? input.checks.filter((check) => !check.present).map((check) => `missing_${check.requirementId}`)
      : []),
  ]);
}

function makeSlot(input: {
  runnerSlotId: string;
  taskKind: SubagentRunnerTaskKind;
  purpose: SubagentTaskPurpose;
  sourceId: string;
  envelope?: SubagentTaskEnvelope;
  shotId?: string;
  sourceRefs: string[];
  warnings?: string[];
  notes?: string[];
  blockedWhenMissing?: boolean;
  freeTextPromptPresent?: boolean;
}): SubagentRunnerSlot {
  const checks = checkEnvelopeRequirements(input.envelope);
  const status = statusForEnvelope(input.envelope, checks, Boolean(input.blockedWhenMissing || input.freeTextPromptPresent));

  return {
    runnerSlotId: input.runnerSlotId,
    taskKind: input.taskKind,
    purpose: input.purpose,
    sourceId: input.sourceId,
    envelopeId: input.envelope?.id,
    parentTaskId: input.envelope?.parentTaskId,
    shotId: input.shotId || input.envelope?.shotId,
    status: status.status,
    envelopeStatus: status.envelopeStatus,
    canExecute: false,
    canSpawnAgent: false,
    freeTextPromptPresent: Boolean(input.freeTextPromptPresent),
    requirementChecks: checks,
    blockedReasons: blockedReasonsFor({ status: status.status, checks, freeTextPromptPresent: input.freeTextPromptPresent }),
    warnings: uniqueSorted(input.warnings || []),
    sourceRefs: uniqueSorted(input.sourceRefs),
    notes: uniqueSorted([
      "Subagent Runner 9.3 is diagnostics-only and does not spawn a worker.",
      ...(input.notes || []),
    ]),
  };
}

function generationTaskKind(job: GenerationHarnessJob): SubagentRunnerTaskKind {
  return job.providerSlot === "image.reference_asset" ? "asset" : "image";
}

function slotsFromVideo(previews: VideoExecutionPreviewState | undefined): SubagentRunnerSlot[] {
  return (previews?.previews || []).map((preview: VideoExecutionPreview) =>
    makeSlot({
      runnerSlotId: `subagent_runner_video_${safeId(preview.previewId)}`,
      taskKind: "video_execution",
      purpose: "video_generation",
      sourceId: preview.previewId,
      envelope: preview.subagentTaskEnvelope,
      shotId: preview.shotId,
      sourceRefs: [
        `videoExecutionPreview:${preview.previewId}`,
        `videoExecutionPreview.taskPlan:${preview.taskPlanId}`,
        `videoExecutionPreview.readinessGate:${preview.readinessGateId}`,
      ],
      warnings: preview.warnings,
      notes: ["Video execution packets are recognized from Phase 7.3 packet previews."],
    }),
  );
}

function slotsFromGeneration(generationHarness: GenerationHarnessState | undefined): SubagentRunnerSlot[] {
  return (generationHarness?.jobs || []).map((job) =>
    makeSlot({
      runnerSlotId: `subagent_runner_generation_${safeId(job.harnessJobId)}`,
      taskKind: generationTaskKind(job),
      purpose: "visual_generation",
      sourceId: job.harnessJobId,
      shotId: job.shotId,
      sourceRefs: [`generationHarness:${job.harnessJobId}`, `generationHarness.taskPlan:${job.taskPlanId}`],
      warnings: job.warnings,
      notes: ["Generation harness facts create future worker coverage, but no SubagentTaskEnvelope exists yet."],
    }),
  );
}

function qaSlot(input: {
  item: QaHarnessItem;
  taskKind: SubagentRunnerTaskKind;
  purpose: SubagentTaskPurpose;
  sourceSuffix: string;
  extraRef?: string;
}): SubagentRunnerSlot {
  return makeSlot({
    runnerSlotId: `subagent_runner_${input.sourceSuffix}_${safeId(input.item.qaItemId)}`,
    taskKind: input.taskKind,
    purpose: input.purpose,
    sourceId: `${input.item.qaItemId}:${input.sourceSuffix}`,
    shotId: input.item.shotId,
    sourceRefs: uniqueSorted([`qaHarness:${input.item.qaItemId}`, input.extraRef || ""]),
    notes: ["QA harness facts create future audit worker coverage, but no SubagentTaskEnvelope exists yet."],
  });
}

function slotsFromQa(qaHarness: QaHarnessState | undefined): SubagentRunnerSlot[] {
  return (qaHarness?.items || []).flatMap((item) => [
    qaSlot({ item, taskKind: "pair_qa", purpose: "continuity_audit", sourceSuffix: "pair_qa", extraRef: item.videoTaskPlanId }),
    qaSlot({ item, taskKind: "scene_qa", purpose: "visual_audit", sourceSuffix: "scene_qa", extraRef: item.harnessJobId }),
    qaSlot({ item, taskKind: "story_audit", purpose: "story_audit", sourceSuffix: "story_audit", extraRef: item.taskPlanId }),
    qaSlot({ item, taskKind: "audio", purpose: "continuity_audit", sourceSuffix: "audio", extraRef: item.audioPlanId }),
  ]);
}

function slotsFromFreeText(requests: SubagentRunnerFreeTextTaskRequest[] | undefined): SubagentRunnerSlot[] {
  return (requests || []).map((request) =>
    makeSlot({
      runnerSlotId: `subagent_runner_free_text_${safeId(request.requestId)}`,
      taskKind: request.taskKind,
      purpose: request.purpose || defaultPurpose(request.taskKind),
      sourceId: request.requestId,
      shotId: request.shotId,
      sourceRefs: request.sourceRefs || [`freeTextTaskRequest:${request.requestId}`],
      freeTextPromptPresent: request.prompt.trim().length > 0,
      blockedWhenMissing: true,
      notes: ["Free-text prompts are diagnostic inputs only and cannot become production worker tasks."],
    }),
  );
}

function buildCoverage(slots: SubagentRunnerSlot[]): SubagentRunnerCoverageEntry[] {
  return subagentRunnerTaskKinds.map((taskKind) => {
    const scoped = slots.filter((slot) => slot.taskKind === taskKind);
    return {
      taskKind,
      expected: true,
      totalSlots: scoped.length,
      planned: scoped.filter((slot) => slot.status === "planned").length,
      plannedMissingEnvelope: scoped.filter((slot) => slot.status === "planned_missing_envelope").length,
      blockedMissingEnvelope: scoped.filter((slot) => slot.status === "blocked_missing_envelope").length,
      blockedContractViolation: scoped.filter((slot) => slot.status === "blocked_contract_violation").length,
      sourceRefs: uniqueSorted(scoped.flatMap((slot) => slot.sourceRefs)),
      notes: [
        scoped.length
          ? `Coverage inferred from ${scoped.length} ${taskKind} slot(s).`
          : `No current ${taskKind} slots were inferred; future packets remain missing coverage.`,
      ],
    };
  });
}

export function buildSubagentRunnerState(input: BuildSubagentRunnerStateInput): SubagentRunnerState {
  const slots = [
    ...slotsFromVideo(input.videoExecutionPreview),
    ...slotsFromGeneration(input.generationHarness),
    ...slotsFromQa(input.qaHarness),
    ...slotsFromFreeText(input.freeTextTaskRequests),
  ].sort((left, right) => left.runnerSlotId.localeCompare(right.runnerSlotId));
  const coverage = buildCoverage(slots);
  const blockedReasons = uniqueSorted(slots.flatMap((slot) => slot.blockedReasons));

  return {
    schemaVersion: subagentRunnerSchemaVersion,
    generatedAt: input.generatedAt,
    slots,
    coverage,
    summary: {
      totalSlots: slots.length,
      planned: slots.filter((slot) => slot.status === "planned").length,
      plannedMissingEnvelope: slots.filter((slot) => slot.status === "planned_missing_envelope").length,
      blockedMissingEnvelope: slots.filter((slot) => slot.status === "blocked_missing_envelope").length,
      blockedContractViolation: slots.filter((slot) => slot.status === "blocked_contract_violation").length,
      freeTextBlocked: slots.filter((slot) => slot.freeTextPromptPresent && slot.status !== "planned").length,
      validatedEnvelopes: slots.filter((slot) => slot.envelopeStatus === "validated").length,
      missingEnvelopes: slots.filter((slot) => slot.envelopeStatus === "missing").length,
      invalidEnvelopes: slots.filter((slot) => slot.envelopeStatus === "invalid").length,
      canExecute: 0,
      dryRunOnly: true,
      diagnosticsOnly: true,
      noFreeTextTask: true,
      validatedEnvelopeRequired: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    hardLocks: subagentRunnerHardLocks,
    blockedReasons,
    packetRequirements: subagentRunnerPacketRequirements,
    dryRunOnly: true,
    diagnosticsOnly: true,
    noFreeTextTask: true,
    validatedEnvelopeRequired: true,
    noSpawnAgent: true,
    noSubprocess: true,
    noShellExecution: true,
    noProviderExecution: true,
    noCredentialRead: true,
    noFileMutation: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 9.3 Subagent Runner is a plan/diagnostics contract only.",
      "Production workers must be launched from validated SubagentTaskEnvelope packets, never free-text prompts.",
      "This state does not call Codex CLI, start subprocesses, execute shell commands, submit providers, read credentials, or move files.",
    ],
  };
}
