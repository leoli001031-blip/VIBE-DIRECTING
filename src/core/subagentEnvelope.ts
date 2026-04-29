import type {
  ContextLevel,
  NeighborShotContext,
  ReferenceAuthority,
  ShotLayoutContext,
  SubagentOutputContract,
  SubagentTaskEnvelope,
  SubagentTaskPurpose,
  TaskEnvelope,
} from "./types";

const defaultOutputContract: SubagentOutputContract = {
  format: "subagent_result_v1",
  requiredFields: [
    "taskId",
    "status",
    "inspectedFiles",
    "gates",
    "overallVisualVerdict",
    "styleQa",
    "motionQa",
    "continuityQa",
    "referenceUseDecision",
    "issues",
    "requiredFixes",
    "approvedFor",
    "rejectedFor",
    "summaryForMainAgent",
  ],
  severityLevels: ["P0", "P1", "P2"],
  gateFields: ["identity", "scene", "pair", "story", "prop", "style"],
};

export interface BuildSubagentEnvelopeInput {
  id: string;
  parentTaskId: string;
  purpose: SubagentTaskPurpose;
  taskEnvelope: TaskEnvelope;
  contextLevel?: ContextLevel;
  sectionId?: string;
  shotId?: string;
  storyFunction?: string;
  userIntent?: string;
  neighborShots?: NeighborShotContext[];
  shotLayout?: ShotLayoutContext;
  providerPolicySummary?: string[];
  mustPreserve?: string[];
  allowedDelta?: string[];
  mustNotAdd?: string[];
}

export function buildSubagentTaskEnvelope(input: BuildSubagentEnvelopeInput): SubagentTaskEnvelope {
  const lockedReferences: ReferenceAuthority[] = input.taskEnvelope.references.filter(
    (reference) => reference.lockedStatus === "locked" && reference.polarity === "positive" && reference.canUseAsFutureReference,
  );
  const forbiddenReferences: ReferenceAuthority[] = input.taskEnvelope.references.filter(
    (reference) =>
      reference.lockedStatus === "rejected" ||
      reference.polarity === "negative" ||
      reference.referenceRole === "temp_candidate" ||
      !reference.canUseAsFutureReference,
  );

  const layoutMustPreserve = input.shotLayout?.mustPreserve || [];
  const layoutAllowedDelta = input.shotLayout?.allowedDelta || [];
  const layoutMustNotAdd = input.shotLayout?.mustNotAdd || [];

  return {
    id: input.id,
    parentTaskId: input.parentTaskId,
    purpose: input.purpose,
    contextLevel: input.contextLevel || input.taskEnvelope.contextLevel,
    sourceIndexHash: input.taskEnvelope.sourceIndexHash,
    sectionId: input.sectionId,
    shotId: input.shotId,
    storyFunction: input.storyFunction || input.taskEnvelope.storyFunction,
    userIntent: input.userIntent,
    neighborShots: input.neighborShots || [],
    lockedReferences,
    forbiddenReferences,
    shotLayout: input.shotLayout,
    providerPolicySummary:
      input.providerPolicySummary || [
        `slot=${input.taskEnvelope.providerSlot}`,
        `provider=${input.taskEnvelope.providerId}`,
        `state=${input.taskEnvelope.executionState}`,
        `mode=${input.taskEnvelope.requiredMode}`,
      ],
    taskEnvelope: input.taskEnvelope,
    qaChecklist: input.taskEnvelope.qaChecklist,
    mustPreserve: [...new Set([...layoutMustPreserve, ...(input.mustPreserve || [])])],
    allowedDelta: [...new Set([...layoutAllowedDelta, ...(input.allowedDelta || [])])],
    mustNotAdd: [...new Set([...layoutMustNotAdd, ...(input.mustNotAdd || [])])],
    expectedOutputContract: defaultOutputContract,
  };
}

