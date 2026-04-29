import { stableKnowledgeHash } from "./knowledgeManifest";
import { buildDefaultProviderRegistry, validateJobAgainstCapability } from "./providerCapabilities";
import type { KnowledgePackManifest } from "./knowledgeTypes";
import type {
  AssetRecord,
  GenerationJob,
  ProjectSourceIndex,
  ProviderPromptKind,
  ProviderRegistry,
  PromptConflict,
  PromptConflictReport,
  ShotPromptPlan,
  ShotRecord,
} from "./types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function hash(value: unknown, prefix: string): string {
  return `${prefix}_${stableKnowledgeHash(JSON.stringify(canonicalize(value))).replace(/^vck_/, "")}`;
}

function promptKindForJob(job: GenerationJob): ProviderPromptKind {
  if (job.slot === "image.generate") return "start_frame";
  if (job.slot === "image.edit") return "end_frame";
  if (job.slot === "image.reference_asset") return "reference_asset";
  if (job.slot.startsWith("video.")) return "video_parked";
  return "unknown";
}

function assetLabel(asset: AssetRecord): string {
  return `${asset.type}:${asset.id}`;
}

function styleDirectivesFromKnowledge(knowledge?: KnowledgePackManifest): string[] {
  if (!knowledge) return ["Use only routed knowledge summaries as compiler hints."];
  return (knowledge.packs || [])
    .filter((pack) => pack.enabled && ["style", "composition", "camera", "lighting", "color", "prompt"].includes(pack.category))
    .slice(0, 6)
    .map((pack) => `${pack.category}:${pack.id}@${pack.hash}`);
}

function reportStatus(conflicts: PromptConflict[]): PromptConflictReport["status"] {
  if (conflicts.some((conflict) => conflict.severity === "blocker")) return "blocked";
  if (conflicts.some((conflict) => conflict.severity === "warning")) return "warning";
  return "clear";
}

export interface BuildShotPromptPlanInput {
  job: GenerationJob;
  shot?: ShotRecord;
  assets: AssetRecord[];
  sourceIndex: ProjectSourceIndex;
  providerRegistry?: ProviderRegistry;
  knowledge?: KnowledgePackManifest;
  createdAt?: string;
}

export interface BuildShotPromptPlanResult {
  plan: ShotPromptPlan;
  conflictReport: PromptConflictReport;
}

export function buildShotPromptPlan(input: BuildShotPromptPlanInput): BuildShotPromptPlanResult {
  const providerRegistry = input.providerRegistry || buildDefaultProviderRegistry(input.createdAt);
  const createdAt = input.createdAt || new Date().toISOString();
  const promptKind = promptKindForJob(input.job);
  const capabilityResult = validateJobAgainstCapability(input.job, providerRegistry);
  const sourceShotSpecHash = hash(
    {
      sourceIndexHash: input.sourceIndex.sourceIndexHash,
      shot: input.shot
        ? {
            id: input.shot.id,
            title: input.shot.title,
            storyFunction: input.shot.storyFunction,
            startFrame: input.shot.startFrame,
            endFrame: input.shot.endFrame,
            gates: input.shot.gates,
            issues: input.shot.issues,
          }
        : undefined,
      job: {
        id: input.job.id,
        slot: input.job.slot,
        requiredMode: input.job.requiredMode,
        outputPath: input.job.outputPath,
        references: input.job.references,
      },
    },
    "shot_spec",
  );
  const referenceIds = Array.from(new Set(input.job.references || [])).sort((left, right) => left.localeCompare(right));
  const referencedAssets = input.assets.filter((asset) => referenceIds.includes(asset.path) || referenceIds.includes(asset.id));
  const conflicts: PromptConflict[] = capabilityResult.blockers.map((detail) => ({
    code: "provider_capability_blocker",
    severity: "blocker",
    target: input.job.id,
    detail,
  }));
  const adapterWarnings = [...capabilityResult.warnings];

  const derivesFromStartFrame = promptKind === "end_frame"
    ? Boolean(input.shot?.startFrame && !input.shot.issues.includes("missing_start_frame"))
    : undefined;

  if (promptKind === "end_frame" && !derivesFromStartFrame) {
    conflicts.push({
      code: "end_frame_missing_start_derivation",
      severity: "blocker",
      target: input.job.id,
      detail: "End-frame image.edit must record derivesFromStartFrame=true or stay blocked.",
    });
  }

  if (promptKind === "end_frame" && input.job.requiredMode !== "image2image") {
    conflicts.push({
      code: "end_frame_forbidden_text2image_fallback",
      severity: "blocker",
      target: input.job.id,
      detail: "End-frame generation cannot fall back to text2image.",
    });
  }

  if (promptKind === "video_parked") {
    adapterWarnings.push("Video prompt plan is parked; no Seedance/Jimeng submit is allowed.");
  }

  for (const asset of referencedAssets) {
    if (asset.lockedStatus !== "locked" || !asset.safeForFutureReference) {
      conflicts.push({
        code: "unsafe_reference_in_prompt_plan",
        severity: asset.status === "missing" ? "blocker" : "warning",
        target: asset.id,
        detail: `${assetLabel(asset)} is not a locked future-safe reference.`,
      });
    }
  }

  const promptPlanId = `prompt_plan_${input.job.id}`;
  const conflictReportId = `prompt_conflict_${input.job.id}`;
  const blockers = conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail);
  const status: ShotPromptPlan["status"] = blockers.length
    ? "blocked"
    : promptKind === "video_parked"
      ? "draft"
      : "ready_for_envelope";
  const naturalLanguageSource = [
    input.shot?.title ? `shot_title:${input.shot.title}` : "",
    input.shot?.storyFunction ? `story_function:${input.shot.storyFunction}` : "",
    input.job.promptPath ? `prompt_source_path:${input.job.promptPath}` : "",
  ].filter(Boolean);
  const planWithoutHash = {
    promptPlanId,
    sourceShotSpecHash,
    jobId: input.job.id,
    shotId: input.shot?.id,
    providerId: capabilityResult.capability?.providerId || input.job.providerId || "unknown",
    providerSlot: input.job.slot,
    requiredMode: input.job.requiredMode,
    promptKind,
    sourceIntent: naturalLanguageSource,
    naturalLanguagePolicy: "source_intent_only" as const,
    mustPreserve: [
      "locked character identity",
      "locked scene layout",
      "style capsule",
      ...(promptKind === "end_frame" ? ["start frame composition"] : []),
    ],
    mustAvoid: [
      "provider or mode fallback",
      "unlocked candidate as future reference",
      "natural language patch applied directly to provider prompt",
      ...(promptKind === "end_frame" ? ["text2image fallback"] : []),
    ],
    referenceIds,
    styleDirectives: styleDirectivesFromKnowledge(input.knowledge),
    adapterWarnings,
    derivesFromStartFrame,
    status,
    blockers,
    conflictReportId,
    createdAt,
  };
  const promptPlanHash = hash(planWithoutHash, "prompt_plan");
  const plan: ShotPromptPlan = {
    ...planWithoutHash,
    promptPlanHash,
  };
  const conflictReport: PromptConflictReport = {
    reportId: conflictReportId,
    promptPlanId,
    jobId: input.job.id,
    shotId: input.shot?.id,
    status: reportStatus(conflicts),
    conflicts,
    checkedAt: createdAt,
  };

  return { plan, conflictReport };
}
