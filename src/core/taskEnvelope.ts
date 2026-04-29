import { defaultProviderPolicy } from "./providerPolicy";
import { buildPreflightReport } from "./preflightGate";
import type {
  AuditIssue,
  ContextLevel,
  GenerationJob,
  KeyframePairDerivation,
  ProjectSourceIndex,
  ReferenceAuthority,
  ShotRecord,
  TaskEnvelope,
} from "./types";

function purposeFromSlot(slot: GenerationJob["slot"]): TaskEnvelope["purpose"] {
  if (slot.startsWith("image.reference_asset")) return "asset";
  if (slot === "image.generate" || slot === "image.edit") return "keyframe";
  if (slot === "video.i2v") return "video";
  return "unknown";
}

function referenceFromPath(path: string): ReferenceAuthority {
  return {
    id: path,
    path,
    referenceRole: "temp_candidate",
    authorityScope: [],
    polarity: "positive",
    lockedStatus: "needs_review",
    allowedUse: ["draft_preview"],
    canPromoteToFormal: false,
    canUseAsFutureReference: false,
    contaminationReason: "Imported path has no ReferenceAuthority metadata.",
  };
}

export interface TaskEnvelopeOptions {
  sourceIndex?: ProjectSourceIndex;
  references?: ReferenceAuthority[];
  keyframePairDerivation?: KeyframePairDerivation;
  contextLevel?: ContextLevel;
  promptHash?: string;
  dependencies?: string[];
  expectedOutputs?: string[];
}

export function buildTaskEnvelope(
  job: GenerationJob,
  shot?: ShotRecord,
  issues: AuditIssue[] = [],
  options: TaskEnvelopeOptions = {},
): TaskEnvelope {
  const rule = defaultProviderPolicy.rules.find((item) => item.slot === job.slot);
  const blockingReasons = issues
    .filter((issue) => issue.severity === "blocker" && (!issue.target || issue.target === job.id || issue.target.includes(job.id)))
    .map((issue) => issue.title);
  const references = options.references || job.references.map(referenceFromPath);
  const expectedOutputs = options.expectedOutputs || (job.outputPath ? [job.outputPath] : []);
  const preflight = buildPreflightReport({
    job,
    references,
    sourceIndex: options.sourceIndex,
    keyframePairDerivation: options.keyframePairDerivation,
    promptHash: options.promptHash,
    expectedOutputs,
  });

  const hardRules = [
    "Use the declared provider slot only.",
    "Do not silently fall back to another model or mode.",
    "Only use locked or approved references as authority.",
  ];

  if (job.slot === "image.edit") {
    hardRules.push("End frame must derive from the start frame unless the shot explicitly crosses location or time.");
  }

  if (job.slot === "video.i2v") {
    hardRules.push("No text-to-video fallback. Use start/end frames only.");
    hardRules.push("No BGM in generated video; sound effects may be handled later.");
  }

  return {
    id: job.id,
    purpose: purposeFromSlot(job.slot),
    providerSlot: job.slot,
    providerId: job.providerId || rule?.activeProvider || "unknown",
    executionState: rule?.executionState || "planned",
    requiredMode: job.requiredMode,
    storyFunction: shot?.storyFunction,
    sourceIndexHash: options.sourceIndex?.sourceIndexHash || "missing-source-index",
    promptHash: options.promptHash,
    dependencies: options.dependencies || [],
    contextLevel: options.contextLevel || "L1",
    expectedOutputs,
    hardRules,
    references,
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate", "prop_gate", "style_gate"],
    preflight,
    keyframePairDerivation: options.keyframePairDerivation,
    outputPath: job.outputPath,
    blockingReasons: [...blockingReasons, ...preflight.blockers.map((item) => item.messageForUser)],
  };
}
