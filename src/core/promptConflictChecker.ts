import type {
  AssetRecord,
  GenerationJob,
  PromptConflictCheckerConflict,
  PromptConflictCheckerItem,
  PromptConflictCheckerState,
  PromptConflictReport,
  ShotPromptPlan,
  ShotRecord,
} from "./types";

export interface BuildPromptConflictCheckerInput {
  generatedAt: string;
  promptPlans: ShotPromptPlan[];
  promptConflictReports: PromptConflictReport[];
  shots: ShotRecord[];
  assets: AssetRecord[];
  jobs?: GenerationJob[];
}

type ConflictCode = PromptConflictCheckerConflict["code"];

const cameraMovementPattern = /\b(push(?:\s|-)?in|pull(?:\s|-)?back|dolly|truck|crane|orbit|whip\s*pan|zoom|sweeping|large\s+camera\s+move|dramatic\s+camera)\b/i;
const subjectMotionPattern = /\b(cross(?:es)?\s+axis|reverse(?:s)?\s+screen\s+direction|turn(?:s)?\s+around|walk(?:s)?\s+away|run(?:s)?\s+across|changes?\s+blocking|new\s+blocking)\b/i;
const frontDoorPattern = /\bfront\s+door\b/i;
const garagePattern = /\bgarage(?:\s+door)?\b/i;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function promptText(plan: ShotPromptPlan): string {
  return normalizeText([
    ...plan.sourceIntent,
    ...plan.mustPreserve,
    ...plan.mustAvoid,
    ...plan.styleDirectives,
    ...plan.adapterWarnings,
  ].join(" "));
}

function structuredShotText(shot?: ShotRecord): string {
  if (!shot) return "";
  return normalizeText([shot.id, shot.title, shot.storyFunction, ...(shot.issues || [])].join(" "));
}

function referencedAssets(plan: ShotPromptPlan, assets: AssetRecord[]): AssetRecord[] {
  const refs = new Set(plan.referenceIds.map(normalizeText));
  return assets.filter((asset) => refs.has(normalizeText(asset.id)) || refs.has(normalizeText(asset.path)));
}

function lockedAssetText(assets: AssetRecord[]): string {
  return normalizeText(
    assets
      .filter((asset) => asset.lockedStatus === "locked")
      .map((asset) => [asset.id, asset.name, asset.type, ...(asset.issues || [])].join(" "))
      .join(" "),
  );
}

function lockedAssetTextByType(assets: AssetRecord[], type: AssetRecord["type"]): string {
  return lockedAssetText(assets.filter((asset) => asset.type === type));
}

function sourceRefs(plan: ShotPromptPlan, report?: PromptConflictReport, shot?: ShotRecord, assets: AssetRecord[] = []): string[] {
  return uniqueSorted([
    plan.promptPlanId,
    plan.promptPlanHash,
    plan.sourceShotSpecHash,
    report?.reportId || "",
    shot?.id || "",
    ...assets.map((asset) => asset.id),
  ]);
}

function resolutionFor(code: ConflictCode): PromptConflictCheckerConflict["requiredResolution"] {
  return {
    updateShotSpec:
      code === "story_flow_stale_function" ||
      code === "garage_front_door_conflict" ||
      code === "visual_memory_locked_identity_conflict" ||
      code === "visual_memory_locked_outfit_conflict" ||
      code === "visual_memory_locked_prop_conflict" ||
      code === "visual_memory_locked_scene_conflict" ||
      code === "visual_memory_locked_style_conflict",
    updateShotLayout:
      code === "fixed_camera_movement_conflict" ||
      code === "shot_layout_motion_conflict" ||
      code === "garage_front_door_conflict",
    updateShotPromptPlan: true,
    recompileRequired: true,
  };
}

function makeConflict(input: {
  code: ConflictCode;
  target: string;
  structuredFact: string;
  promptEvidence: string;
  detail: string;
  sourceRefs: string[];
}): PromptConflictCheckerConflict {
  return {
    code: input.code,
    severity: "blocker",
    target: input.target,
    structuredFact: input.structuredFact,
    promptEvidence: input.promptEvidence,
    detail: input.detail,
    requiredResolution: resolutionFor(input.code),
    sourceRefs: uniqueSorted(input.sourceRefs),
  };
}

function storyFunctionFromPrompt(text: string): string | undefined {
  const match = text.match(/story function\s*:\s*([^|;]+)/i) || text.match(/story_function\s*:\s*([^|;]+)/i);
  return match?.[1] ? normalizeText(match[1]) : undefined;
}

function containsFixedCameraFact(text: string): boolean {
  return /\b(fixed camera|locked camera|static camera|tripod|no camera movement)\b/i.test(text);
}

const colorWords = [
  "black",
  "blue",
  "brown",
  "cream",
  "green",
  "grey",
  "gray",
  "orange",
  "purple",
  "red",
  "silver",
  "white",
  "yellow",
];

function colorConflict(lockedText: string, text: string): boolean {
  const lockedColors = colorWords.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(lockedText));
  const promptColors = colorWords.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(text));
  return lockedColors.length > 0 && promptColors.some((color) => !lockedColors.includes(color));
}

function hasOutfitConflict(lockedText: string, text: string): boolean {
  if (!/\b(outfit|costume|clothes|coat|dress|jacket|uniform)\b/i.test(`${lockedText} ${text}`)) return false;
  return /\b(new|different|changed|replace|alternate)\s+(outfit|costume|clothes)\b/i.test(text) || colorConflict(lockedText, text);
}

function hasIdentityConflict(lockedText: string, text: string): boolean {
  if (!lockedText) return false;
  return /\b(new|different|alternate|replace|changed)\s+(person|character|identity|face|actor|hero)\b/i.test(text) ||
    /\b(face|identity)\s+(swap|change|replacement)\b/i.test(text) ||
    /\bmake\s+(?:him|her|them|the hero)\s+(?:older|younger|a child|another person)\b/i.test(text);
}

function hasPropConflict(lockedText: string, text: string): boolean {
  const propLanguage = /\b(prop|object|weapon|tool|bag|phone|key|book|cup|car|door)\b/i.test(`${lockedText} ${text}`);
  if (!propLanguage) return false;
  return /\b(new|different|alternate|replace|remove|swap|unapproved)\s+(prop|object|weapon|tool|bag|phone|key|book|cup|car|door)\b/i.test(text) ||
    /\b(prop|object|weapon|tool|bag|phone|key|book|cup|car|door)\s+(swap|changes?|replacement)\b/i.test(text);
}

function hasStyleConflict(lockedText: string, text: string): boolean {
  const styleTokens = ["monochrome", "noir", "watercolor", "anime", "photoreal", "cinematic", "pixel art", "pastel"];
  const lockedStyles = styleTokens.filter((token) => lockedText.includes(token));
  const promptStyles = styleTokens.filter((token) => text.includes(token));
  return lockedStyles.length > 0 && promptStyles.some((token) => !lockedStyles.includes(token));
}

function buildConflicts(plan: ShotPromptPlan, report: PromptConflictReport | undefined, shot: ShotRecord | undefined, assets: AssetRecord[]): PromptConflictCheckerConflict[] {
  const text = promptText(plan);
  const shotText = structuredShotText(shot);
  const lockedRefs = referencedAssets(plan, assets).filter((asset) => asset.lockedStatus === "locked");
  const referencedRejectedRefs = referencedAssets(plan, assets).filter(
    (asset) => asset.lockedStatus === "not_generated" && asset.issues.some((assetIssue) => /rejected/i.test(assetIssue)),
  );
  const lockedText = lockedAssetText(lockedRefs);
  const lockedCharacterText = lockedAssetTextByType(lockedRefs, "character");
  const lockedPropText = lockedAssetTextByType(lockedRefs, "prop");
  const lockedSceneText = lockedAssetTextByType(lockedRefs, "scene");
  const lockedStyleText = lockedAssetTextByType(lockedRefs, "style");
  const refs = sourceRefs(plan, report, shot, [...lockedRefs, ...referencedRejectedRefs]);
  const conflicts: PromptConflictCheckerConflict[] = [];
  const promptStoryFunction = storyFunctionFromPrompt(text);
  const currentStoryFunction = shot?.storyFunction ? normalizeText(shot.storyFunction) : undefined;

  if (promptStoryFunction && currentStoryFunction && promptStoryFunction !== currentStoryFunction) {
    conflicts.push(
      makeConflict({
        code: "story_flow_stale_function",
        target: shot?.id || plan.promptPlanId,
        structuredFact: `storyFunction:${shot?.storyFunction}`,
        promptEvidence: `promptStoryFunction:${promptStoryFunction}`,
        detail: "Prompt source intent references an older Story Flow function.",
        sourceRefs: refs,
      }),
    );
  }

  if ((garagePattern.test(shotText) || garagePattern.test(lockedText)) && frontDoorPattern.test(text)) {
    conflicts.push(
      makeConflict({
        code: "garage_front_door_conflict",
        target: shot?.id || plan.promptPlanId,
        structuredFact: "Structured shot/scene fact requires garage door.",
        promptEvidence: "Prompt references front door.",
        detail: "Prompt door language conflicts with the current garage-door scene fact.",
        sourceRefs: refs,
      }),
    );
  }

  if (containsFixedCameraFact(`${shotText} ${lockedText}`) && cameraMovementPattern.test(text)) {
    conflicts.push(
      makeConflict({
        code: "fixed_camera_movement_conflict",
        target: shot?.id || plan.promptPlanId,
        structuredFact: "Shot Layout requires fixed/locked camera.",
        promptEvidence: "Prompt contains large camera movement.",
        detail: "Prompt motion conflicts with a fixed camera Shot Layout fact.",
        sourceRefs: refs,
      }),
    );
  }

  if (
    (containsFixedCameraFact(`${shotText} ${lockedText}`) || /\b(static|fixed)\s+blocking\b/i.test(`${shotText} ${lockedText}`)) &&
    subjectMotionPattern.test(text)
  ) {
    conflicts.push(
      makeConflict({
        code: "shot_layout_motion_conflict",
        target: shot?.id || plan.promptPlanId,
        structuredFact: "Shot Layout fixes camera/blocking and screen direction.",
        promptEvidence: "Prompt asks for axis, screen-direction, or blocking motion drift.",
        detail: "Prompt motion conflicts with Shot Layout spatial continuity facts.",
        sourceRefs: refs,
      }),
    );
  }

  if (plan.promptKind === "end_frame" && plan.derivesFromStartFrame !== true) {
    conflicts.push(
      makeConflict({
        code: "independent_end_frame_conflict",
        target: plan.promptPlanId,
        structuredFact: "End frame must derive from the start frame by default.",
        promptEvidence: `derivesFromStartFrame:${String(plan.derivesFromStartFrame)}`,
        detail: "End-frame prompt plan is compiled as independent generation instead of start-frame derivation.",
        sourceRefs: refs,
      }),
    );
  }

  if (hasIdentityConflict(lockedCharacterText, text)) {
    conflicts.push(
      makeConflict({
        code: "visual_memory_locked_identity_conflict",
        target: plan.promptPlanId,
        structuredFact: "Visual Memory has a locked character identity reference.",
        promptEvidence: "Prompt asks for a different identity/face/person.",
        detail: "Prompt conflicts with locked Visual Memory identity facts.",
        sourceRefs: refs,
      }),
    );
  }

  if (hasOutfitConflict(lockedCharacterText || lockedText, text)) {
    conflicts.push(
      makeConflict({
        code: "visual_memory_locked_outfit_conflict",
        target: plan.promptPlanId,
        structuredFact: "Visual Memory has a locked outfit reference.",
        promptEvidence: "Prompt asks for a different outfit/color.",
        detail: "Prompt conflicts with locked Visual Memory outfit facts.",
        sourceRefs: refs,
      }),
    );
  }

  if (hasPropConflict(lockedPropText, text) || referencedRejectedRefs.some((asset) => asset.type === "prop")) {
    conflicts.push(
      makeConflict({
        code: "visual_memory_locked_prop_conflict",
        target: plan.promptPlanId,
        structuredFact: "Visual Memory has locked/rejected prop authority.",
        promptEvidence: "Prompt asks for a prop change or references a rejected prop.",
        detail: "Prompt conflicts with Visual Memory prop facts.",
        sourceRefs: refs,
      }),
    );
  }

  if ((garagePattern.test(lockedSceneText || lockedText) && frontDoorPattern.test(text)) || /\b(scene|location)\s*:\s*locked\b/i.test(lockedSceneText || lockedText) && /\bnew location|different scene\b/i.test(text)) {
    conflicts.push(
      makeConflict({
        code: "visual_memory_locked_scene_conflict",
        target: plan.promptPlanId,
        structuredFact: "Visual Memory has a locked scene reference.",
        promptEvidence: "Prompt asks for a conflicting scene/location.",
        detail: "Prompt conflicts with locked Visual Memory scene facts.",
        sourceRefs: refs,
      }),
    );
  }

  if (hasStyleConflict(lockedStyleText || lockedText, text)) {
    conflicts.push(
      makeConflict({
        code: "visual_memory_locked_style_conflict",
        target: plan.promptPlanId,
        structuredFact: "Visual Memory has a locked style reference.",
        promptEvidence: "Prompt asks for a different style.",
        detail: "Prompt conflicts with locked Visual Memory style facts.",
        sourceRefs: refs,
      }),
    );
  }

  for (const compilerConflict of report?.conflicts || []) {
    if (compilerConflict.severity === "blocker") {
      conflicts.push(
        makeConflict({
          code: "compiler_conflict_report_blocker",
          target: compilerConflict.target || plan.promptPlanId,
          structuredFact: "Compiler conflict report already blocks this prompt plan.",
          promptEvidence: compilerConflict.detail,
          detail: compilerConflict.detail,
          sourceRefs: refs,
        }),
      );
    }
  }

  return conflicts;
}

function statusFor(conflicts: PromptConflictCheckerConflict[], report?: PromptConflictReport): PromptConflictCheckerItem["status"] {
  if (conflicts.some((conflict) => conflict.severity === "blocker")) return "blocked";
  if (report?.status === "warning") return "warning";
  return "clear";
}

function nextAction(status: PromptConflictCheckerItem["status"]): string {
  if (status === "blocked") return "Update Shot Spec, Shot Layout, or Shot Prompt Plan and recompile before generation.";
  if (status === "warning") return "Review compiler warnings before turning this plan into a generation task.";
  return "No structured prompt conflict detected.";
}

export function buildPromptConflictCheckerState(input: BuildPromptConflictCheckerInput): PromptConflictCheckerState {
  const reportsByPlan = new Map(input.promptConflictReports.map((report) => [report.promptPlanId, report]));
  const shotsById = new Map(input.shots.map((shot) => [shot.id, shot]));
  const items = input.promptPlans.map((plan): PromptConflictCheckerItem => {
    const report = reportsByPlan.get(plan.promptPlanId);
    const shot = plan.shotId ? shotsById.get(plan.shotId) : undefined;
    const scopedAssets = referencedAssets(plan, input.assets);
    const conflicts = buildConflicts(plan, report, shot, input.assets);
    const status = statusFor(conflicts, report);
    const blockers = uniqueSorted(conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail));
    const warnings = uniqueSorted([
      ...conflicts.filter((conflict) => conflict.severity === "warning").map((conflict) => conflict.detail),
      ...(report?.status === "warning" ? report.conflicts.map((conflict) => conflict.detail) : []),
    ]);

    return {
      checkerItemId: `prompt_conflict_checker_${plan.promptPlanId}`,
      promptPlanId: plan.promptPlanId,
      jobId: plan.jobId,
      shotId: plan.shotId,
      status,
      conflictReportId: report?.reportId || plan.conflictReportId,
      promptPlanHash: plan.promptPlanHash,
      sourceShotSpecHash: plan.sourceShotSpecHash,
      conflicts,
      blockers,
      warnings,
      sourceRefs: sourceRefs(plan, report, shot, scopedAssets),
      nextAction: nextAction(status),
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    items,
    summary: {
      totalItems: items.length,
      clear: items.filter((item) => item.status === "clear").length,
      warning: items.filter((item) => item.status === "warning").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      conflicts: items.reduce((total, item) => total + item.conflicts.length, 0),
      recompileRequired: items.filter((item) => item.conflicts.some((conflict) => conflict.requiredResolution.recompileRequired)).length,
      dryRunOnly: true,
      diagnosticsOnly: true,
      liveSubmitAllowed: false,
    },
    hardLocks: {
      dryRunOnly: true,
      diagnosticsOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      agentPromiseCannotResolveConflict: true,
      requiresStructuredPlanUpdate: true,
      recompileRequiredAfterConflict: true,
      noPromptBypass: true,
    },
    dryRunOnly: true,
    diagnosticsOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 8.10 Prompt Conflict Checker blocks structured fact conflicts before generation.",
      "Agent promises cannot resolve conflicts; Shot Spec, Shot Layout, or Shot Prompt Plan must be updated and recompiled.",
      "The checker is diagnostics-only and never submits provider work.",
    ],
  };
}
