import type {
  ContextLevel,
  GateSet,
  NeighborShotContext,
  ReferenceAuthority,
  ShotLayoutContext,
  SubagentOutputContract,
  SubagentTaskEnvelope,
  SubagentTaskPurpose,
  TaskEnvelope,
} from "./types";
import { buildNonOverridableGateHashes, buildPolicyBinding } from "./envelopeValidator";
import type { ContextBudgetResult, KnowledgeInjectedSnippet, KnowledgeInjectionRecord, KnowledgeRouteResult } from "./knowledgeTypes";
import type { KnowledgePackCategory } from "./knowledgeTypes";

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
  lockedReferences?: ReferenceAuthority[];
  forbiddenReferences?: ReferenceAuthority[];
  shotLayout?: ShotLayoutContext;
  providerPolicySummary?: string[];
  mustPreserve?: string[];
  allowedDelta?: string[];
  mustNotAdd?: string[];
  expectedOutputContract?: SubagentOutputContract;
  knowledgeRouteResult?: KnowledgeRouteResult;
  contextBudget?: ContextBudgetResult;
  injectedKnowledgePacks?: KnowledgeInjectionRecord[];
  injectedKnowledgeSnippetIds?: string[];
  injectedKnowledgeSnippets?: KnowledgeInjectedSnippet[];
  routeWarnings?: string[];
  forbiddenKnowledgePacks?: string[];
  requiredKnowledgeCategories?: KnowledgePackCategory[];
  qaPackBindings?: Record<string, { version: string; hash: string }>;
  policyBinding?: string;
  nonOverridableGateHashes?: Record<string, string>;
  allowedReadScopes?: string[];
  disallowedReadScopes?: string[];
  mustInspectNeighborShotIds?: string[];
  authorityPriority?: Array<keyof GateSet | "source_index" | "provider_policy" | "preflight">;
}

export function buildSubagentTaskEnvelope(input: BuildSubagentEnvelopeInput): SubagentTaskEnvelope {
  const lockedReferences: ReferenceAuthority[] =
    input.lockedReferences ||
    input.taskEnvelope.references.filter(
      (reference) => reference.lockedStatus === "locked" && reference.polarity === "positive" && reference.canUseAsFutureReference,
    );
  const forbiddenReferences: ReferenceAuthority[] =
    input.forbiddenReferences ||
    input.taskEnvelope.references.filter(
      (reference) =>
        reference.lockedStatus === "rejected" ||
        reference.polarity === "negative" ||
        reference.referenceRole === "temp_candidate" ||
        !reference.canUseAsFutureReference,
    );

  const layoutMustPreserve = input.shotLayout?.mustPreserve || [];
  const layoutAllowedDelta = input.shotLayout?.allowedDelta || [];
  const layoutMustNotAdd = input.shotLayout?.mustNotAdd || [];
  const injectedKnowledgePacks = input.injectedKnowledgePacks || input.contextBudget?.injectedKnowledgePacks || input.taskEnvelope.injectedKnowledgePacks;
  const injectedKnowledgeSnippetIds =
    input.injectedKnowledgeSnippetIds ||
    input.contextBudget?.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`) ||
    input.taskEnvelope.injectedKnowledgeSnippetIds;
  const injectedKnowledgeSnippets = input.injectedKnowledgeSnippets || input.contextBudget?.injectedSnippets || input.taskEnvelope.injectedKnowledgeSnippets;

  const envelope: SubagentTaskEnvelope = {
    id: input.id,
    parentTaskId: input.parentTaskId,
    purpose: input.purpose,
    contextLevel: input.contextLevel || input.taskEnvelope.contextLevel,
    sourceIndexHash: input.taskEnvelope.sourceIndexHash,
    sectionId: input.sectionId,
    shotId: input.shotId,
    storyFunction: input.storyFunction || input.taskEnvelope.storyFunction,
    userIntent:
      input.userIntent ||
      [
        `shot=${input.shotId || "project"}`,
        `story=${input.storyFunction || input.taskEnvelope.storyFunction || "unspecified"}`,
        `source=${input.taskEnvelope.sourceIndexHash}`,
        `expected=${input.taskEnvelope.expectedOutputs.join(",") || "missing"}`,
      ].join(" | "),
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
    knowledgeRouteResultId: input.knowledgeRouteResult?.routeId || input.taskEnvelope.knowledgeRouteResultId,
    contextBudgetId: input.contextBudget?.budgetId || input.taskEnvelope.contextBudgetId,
    injectedKnowledgePacks,
    injectedKnowledgeSnippetIds,
    injectedKnowledgeSnippets,
    knowledgeInputHash: input.knowledgeRouteResult?.inputHash || input.taskEnvelope.knowledgeInputHash,
    knowledgeManifestHash: input.taskEnvelope.knowledgeManifestHash,
    policyBinding: input.policyBinding,
    nonOverridableGateHashes: input.nonOverridableGateHashes,
    routeWarnings: [
      ...(input.routeWarnings || []),
      ...(input.knowledgeRouteResult?.warnings || []),
      ...(input.contextBudget?.warnings || []),
      ...input.taskEnvelope.routeWarnings,
    ],
    forbiddenKnowledgePacks: input.forbiddenKnowledgePacks || [],
    requiredKnowledgeCategories: input.requiredKnowledgeCategories || [],
    qaPackBindings:
      input.qaPackBindings ||
      Object.fromEntries(
        injectedKnowledgePacks
          .filter((pack) => pack.consumer === "qa_gate")
          .map((pack) => [pack.packId, { version: pack.version, hash: pack.hash }]),
      ),
    allowedReadScopes: input.allowedReadScopes || ["task_envelope", "locked_references", "injected_knowledge_snippets"],
    disallowedReadScopes: input.disallowedReadScopes || ["unrouted_knowledge_library", "rejected_references", "failed_artifacts"],
    sourceIndexRequired: true,
    mustInspectNeighborShotIds: input.mustInspectNeighborShotIds || (input.neighborShots || []).map((shot) => shot.shotId),
    authorityPriority: input.authorityPriority || ["source_index", "provider_policy", "preflight", "identity", "scene", "pair", "story", "prop", "style"],
    resultMustReferencePackHashes: true,
    qaChecklist: input.taskEnvelope.qaChecklist,
    mustPreserve: [...new Set([...layoutMustPreserve, ...(input.mustPreserve || [])])],
    allowedDelta: [...new Set([...layoutAllowedDelta, ...(input.allowedDelta || [])])],
    mustNotAdd: [...new Set([...layoutMustNotAdd, ...(input.mustNotAdd || [])])],
    expectedOutputContract: input.expectedOutputContract || defaultOutputContract,
  };

  const policyBinding = envelope.policyBinding || buildPolicyBinding(envelope.taskEnvelope);

  return {
    ...envelope,
    policyBinding,
    nonOverridableGateHashes: envelope.nonOverridableGateHashes || buildNonOverridableGateHashes(envelope.taskEnvelope),
  };
}
