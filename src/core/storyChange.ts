import type { ProjectRuntimeState } from "./projectState";
import type {
  ArtifactInvalidation,
  AssetLockScope,
  DirectorIntentResult,
  DirectorIntentType,
  ProductionBiblePatch,
  ReflowArtifactType,
  ReflowImpactReport,
  ShotRecord,
  StoryChangeImpactScope,
  StoryChangeOperation,
  StoryChangeTransaction,
  VoiceChangeTransaction,
} from "./types";

export const storyChangeSchemaVersion = "0.1.0";

export interface DirectorIntentContext {
  targetIds?: string[];
  selectedShotId?: string;
  selectedSectionId?: string;
  knownCharacterIds?: string[];
  knownSceneIds?: string[];
  knownAssetIds?: string[];
  knownVoiceIds?: string[];
}

export interface BuildStoryChangeTransactionInput {
  userIntent: string;
  context?: DirectorIntentContext;
  targetIds?: string[];
  mustPreserve?: string[];
  mustNotAdd?: string[];
  id?: string;
  createdAt?: string;
}

export interface ReflowImpactContext {
  shots?: ShotRecord[];
  assetIds?: string[];
  sectionIds?: string[];
  generatedAt?: string;
}

const preserveTargets = [
  {
    key: "identity",
    mustPreserve: "preserve_character_identity",
    patterns: [/人物身份|角色身份|主角身份|身份|人物|角色|主角|character identity|identity|character|protagonist/i],
  },
  {
    key: "scene",
    mustPreserve: "preserve_scene_setting",
    patterns: [/场景设定|场景|地点|空间|布景|scene setting|scene|location|setting|spatial/i],
  },
  {
    key: "style",
    mustPreserve: "preserve_visual_style",
    patterns: [/风格|调性|美术|色彩|质感|style|look|tone|visual language|palette|texture/i],
  },
  {
    key: "voice",
    mustPreserve: "preserve_voice_source",
    patterns: [/音色|音源|配音|声音|voice|tts|narrator|speaker|timbre/i],
  },
] as const;

function matchPreserveTarget(text: string): string[] {
  return preserveTargets
    .filter((target) => includesAny(text, target.patterns))
    .map((target) => target.mustPreserve);
}

function extractPreserveConstraints(intent: string): string[] {
  const constraints: string[] = [];
  const preserveClausePattern =
    /(?:不要|不|别|不能|不可|无需|保持|保留|维持|沿用|不改变|不要改变|do not change|don't change|without changing|preserve|keep|retain|maintain)[^，。；;,.]*(?:人物身份|角色身份|主角身份|身份|人物|角色|主角|场景设定|场景|地点|空间|布景|风格|调性|美术|色彩|质感|音色|音源|配音|声音|character identity|identity|character|protagonist|scene setting|scene|location|setting|spatial|style|look|tone|visual language|palette|texture|voice|tts|narrator|speaker|timbre)(?:不变|不改|不改变|unchanged|the same)?/gi;
  const matches = intent.match(preserveClausePattern) || [];

  for (const clause of matches) {
    constraints.push(...matchPreserveTarget(clause));
  }

  return unique(constraints);
}

function withoutPreserveClauses(intent: string): string {
  const preserveConstraints = extractPreserveConstraints(intent);
  return preserveConstraints.reduce((cleaned, constraint) => {
    const target = preserveTargets.find((item) => item.mustPreserve === constraint);
    if (!target) return cleaned;
    const terms = target.patterns
      .map((pattern) => pattern.source)
      .join("|")
      .replace(/\\b/g, "");
    const clause = new RegExp(
      `(?:但|并且|同时|,|，|;|；|。|\\s)*(?:不要|不|别|不能|不可|无需|保持|保留|维持|沿用|不改变|不要改变|do not change|don't change|without changing|preserve|keep|retain|maintain)[^，。；;,.]*(?:${terms})(?:不变|不改|不改变|unchanged|the same)?`,
      "gi",
    );
    return cleaned.replace(clause, " ");
  }, intent);
}

function cleanActionableIntent(intent: string): string {
  return intent
    .replace(/^[\s，但并且同时,，;；。]+|[\s，但并且同时,，;；。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const confirmationRules = [
  {
    reason: "角色身份变更需要用户确认",
    pattern:
      /(?:改变|更改|改成|改为|变成|换成|替换|重设|change|replace|turn into|become|make)[^，。；;,.]*(?:角色|人物|主角|身份|character|identity|protagonist|hero|villain)|(?:角色|人物|主角|身份|character|identity|protagonist|hero|villain)[^，。；;,.]*(?:改变|更改|改成|改为|变成|换成|替换|重设|change|replace|turn into|become)/i,
  },
  {
    reason: "场景设定变更需要用户确认",
    pattern: /(场景设定|世界观|地点设定|空间关系|scene setting|world|location|spatial)/i,
  },
  {
    reason: "全片风格变更需要用户确认",
    pattern: /(全片|整体|统一|风格|美术|调性|style|look|tone|visual language)/i,
  },
  {
    reason: "音色或音源变更需要用户确认",
    pattern: /(音色|音源|配音|声音|voice|tts|narrator|speaker|timbre)/i,
  },
  {
    reason: "结局变更需要用户确认",
    pattern: /(结局|收尾|最后|ending|finale|resolution)/i,
  },
  {
    reason: "删除或移动镜头需要用户确认",
    pattern: /(删除|删掉|移到|移动|重排|调换|delete|remove|move|reorder|resequence)/i,
  },
] as const;

function stableId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.trim()).map((item) => item.trim()))).sort();
}

function includesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyOperation(intent: string): { intentType: DirectorIntentType; operation: StoryChangeOperation; impactScope: StoryChangeImpactScope; confidence: number; keywords: string[] } {
  const keywordHits: string[] = [];
  const match = (keyword: string, patterns: RegExp[]) => {
    const hit = includesAny(intent, patterns);
    if (hit) keywordHits.push(keyword);
    return hit;
  };

  if (match("delete_shot", [/删除|删掉|去掉|remove|delete/i])) {
    return { intentType: "shot", operation: "delete_shot", impactScope: "section", confidence: 0.82, keywords: keywordHits };
  }
  if (match("move_shot", [/移动|移到|重排|调换|顺序|move|reorder|resequence/i])) {
    return { intentType: "shot", operation: "move_shot", impactScope: "section", confidence: 0.82, keywords: keywordHits };
  }
  if (match("insert_shot", [/插入|加一镜|加一个镜头|新增镜头|insert|add shot|new shot/i])) {
    return { intentType: "shot", operation: "insert_shot", impactScope: "section", confidence: 0.78, keywords: keywordHits };
  }
  if (match("voice", [/音色|音源|配音|旁白声音|voice|tts|speaker|timbre/i])) {
    return { intentType: "voice", operation: "update_voice", impactScope: "voice", confidence: 0.78, keywords: keywordHits };
  }
  if (match("dialogue", [/对白|台词|说的话|dialogue|line/i])) {
    return { intentType: "voice", operation: "update_dialogue", impactScope: "shot", confidence: 0.72, keywords: keywordHits };
  }
  if (match("narration", [/旁白|解说|narration|voiceover/i])) {
    return { intentType: "voice", operation: "update_narration", impactScope: "shot", confidence: 0.72, keywords: keywordHits };
  }
  if (match("style", [/风格|调性|美术|色彩|质感|style|look|palette|texture/i])) {
    return { intentType: "style", operation: "update_style", impactScope: "project", confidence: 0.76, keywords: keywordHits };
  }
  if (match("character", [/角色|人物|主角|反派|身份|character|identity/i])) {
    return { intentType: "asset", operation: "update_character", impactScope: "asset", confidence: 0.73, keywords: keywordHits };
  }
  if (match("scene", [/场景|地点|空间|布景|scene|location|set|spatial/i])) {
    return { intentType: "asset", operation: "update_scene", impactScope: "asset", confidence: 0.73, keywords: keywordHits };
  }
  if (match("asset_lock", [/锁定|解锁|保留资产|lock|unlock|preserve asset/i])) {
    return { intentType: "asset", operation: intent.includes("解锁") || /unlock/i.test(intent) ? "unlock_asset" : "lock_asset", impactScope: "asset", confidence: 0.7, keywords: keywordHits };
  }
  if (match("export", [/导出|格式|分辨率|码率|export|render/i])) {
    return { intentType: "export", operation: "export_change", impactScope: "export", confidence: 0.65, keywords: keywordHits };
  }
  if (match("story", [/剧情|故事|节奏|结局|发现|冲突|story|plot|ending|beat/i])) {
    return { intentType: "story", operation: "update_story", impactScope: "section", confidence: 0.68, keywords: keywordHits };
  }
  return { intentType: "shot", operation: "update_shot", impactScope: "shot", confidence: 0.48, keywords: keywordHits };
}

function inferTargetIds(context?: DirectorIntentContext, targetIds: string[] = []): string[] {
  return unique([
    ...targetIds,
    ...(context?.targetIds || []),
    context?.selectedShotId || "",
    context?.selectedSectionId || "",
  ]);
}

export function classifyDirectorIntent(userIntent: string, context: DirectorIntentContext = {}): DirectorIntentResult {
  const normalizedIntent = userIntent.trim().replace(/\s+/g, " ");
  const targetIds = inferTargetIds(context);
  const preserveConstraints = extractPreserveConstraints(normalizedIntent);
  const confirmationIntent = withoutPreserveClauses(normalizedIntent);
  const actionableIntent = cleanActionableIntent(preserveConstraints.length ? confirmationIntent : normalizedIntent);
  const classified = actionableIntent
    ? classifyOperation(actionableIntent)
    : {
        intentType: "unknown" as DirectorIntentType,
        operation: "unknown" as StoryChangeOperation,
        impactScope: "shot" as StoryChangeImpactScope,
        confidence: 0.42,
        keywords: ["preserve_only"],
      };
  const confirmationReasons: string[] = confirmationRules
    .filter((rule) => rule.pattern.test(confirmationIntent))
    .map((rule) => rule.reason);
  if (classified.operation === "insert_shot") {
    confirmationReasons.push("插入镜头会影响故事流，需要用户确认");
  }
  const riskFlags = unique([
    classified.impactScope === "project" ? "project_wide_reflow" : "",
    ["delete_shot", "move_shot", "insert_shot"].includes(classified.operation) ? "story_flow_reflow" : "",
    classified.intentType === "voice" ? "voice_memory_reflow" : "",
    confirmationReasons.length ? "requires_confirmation" : "",
    ...preserveConstraints,
  ]);
  const createdAt = new Date().toISOString();

  return {
    schemaVersion: storyChangeSchemaVersion,
    id: stableId("intent", `${normalizedIntent}:${targetIds.join(",")}`),
    userIntent,
    normalizedIntent,
    intentType: classified.intentType,
    operation: classified.operation,
    impactScope: classified.impactScope,
    targetIds,
    confidence: classified.confidence,
    requiresUserConfirmation: confirmationReasons.length > 0,
    confirmationReasons,
    riskFlags,
    detectedKeywords: unique(classified.keywords),
    createdAt,
  };
}

function defaultPreserve(intent: DirectorIntentResult): string[] {
  return unique([
    "do_not_change_provider_policy",
    "do_not_submit_provider_tasks",
    "do_not_patch_prompts_from_natural_language",
    intent.operation === "update_shot" ? "neighbor_shot_continuity" : "",
    intent.intentType !== "asset" ? "locked_identity_references" : "",
    ...intent.riskFlags.filter((flag) => flag.startsWith("preserve_")),
  ]);
}

function defaultMustNotAdd(intent: DirectorIntentResult): string[] {
  return unique([
    "provider_submit",
    "direct_prompt_patch",
    "direct_project_mutation",
    intent.operation === "update_shot" ? "new_characters_without_transaction" : "",
    intent.operation === "update_shot" ? "new_props_without_transaction" : "",
  ]);
}

function productionBiblePatchFor(intent: DirectorIntentResult, transactionId: string, createdAt: string): ProductionBiblePatch | undefined {
  const patchTypeByOperation: Partial<Record<StoryChangeOperation, ProductionBiblePatch["patchType"]>> = {
    update_character: "character",
    update_scene: "scene",
    update_style: "style",
    update_voice: "voice",
    update_story: "story_rules",
  };
  const patchType = patchTypeByOperation[intent.operation];
  if (!patchType) return undefined;

  return {
    schemaVersion: storyChangeSchemaVersion,
    id: `${transactionId}_bible_patch`,
    transactionId,
    status: intent.requiresUserConfirmation ? "pending_confirmation" : "dry_run",
    patchType,
    targetIds: intent.targetIds,
    proposedChanges: [
      {
        path: patchType,
        operation: "review",
        valueSummary: "Dry-run placeholder. Natural language must be reviewed into structured project facts before mutation.",
      },
    ],
    requiresUserConfirmation: intent.requiresUserConfirmation,
    warnings: ["No prompt patch or provider task is produced by this patch."],
    createdAt,
  };
}

function assetLockScopeFor(intent: DirectorIntentResult, transactionId: string): AssetLockScope {
  return {
    schemaVersion: storyChangeSchemaVersion,
    id: `${transactionId}_asset_lock_scope`,
    transactionId,
    lockLevel: intent.operation === "lock_asset" ? "preserve" : intent.operation === "unlock_asset" ? "review" : "can_reuse",
    characterIds: intent.operation === "update_character" ? intent.targetIds : [],
    sceneIds: intent.operation === "update_scene" ? intent.targetIds : [],
    propIds: [],
    styleIds: intent.operation === "update_style" ? intent.targetIds : [],
    voiceIds: intent.operation === "update_voice" ? intent.targetIds : [],
    shotIds: ["insert_shot", "delete_shot", "move_shot", "update_shot"].includes(intent.operation) ? intent.targetIds : [],
    mustPreserve: defaultPreserve(intent),
    canInvalidate: [],
    notes: ["Dry-run asset scope only. Formal lock changes require a separate confirmed mutation."],
  };
}

function voiceChangeFor(intent: DirectorIntentResult, transactionId: string, createdAt: string): VoiceChangeTransaction | undefined {
  if (intent.intentType !== "voice") return undefined;
  const changeTypeByOperation: Partial<Record<StoryChangeOperation, VoiceChangeTransaction["changeType"]>> = {
    update_dialogue: "dialogue",
    update_narration: "narration",
    update_voice: "voice_source",
  };
  return {
    schemaVersion: storyChangeSchemaVersion,
    id: `${transactionId}_voice`,
    userIntent: intent.userIntent,
    changeType: changeTypeByOperation[intent.operation] || "unknown",
    targetVoiceIds: intent.operation === "update_voice" ? intent.targetIds : [],
    targetCharacterIds: [],
    targetShotIds: intent.operation !== "update_voice" ? intent.targetIds : [],
    status: intent.requiresUserConfirmation ? "pending_confirmation" : "dry_run",
    requiresUserConfirmation: intent.requiresUserConfirmation,
    invalidatedArtifactIds: [],
    mustPreserve: ["voice_source_authorization", "provider_policy"],
    mustNotAdd: ["provider_submit", "unlicensed_voice_source"],
    createdAt,
  };
}

export function buildStoryChangeTransaction(input: BuildStoryChangeTransactionInput): StoryChangeTransaction {
  const createdAt = input.createdAt || new Date().toISOString();
  const intent = classifyDirectorIntent(input.userIntent, {
    ...input.context,
    targetIds: inferTargetIds(input.context, input.targetIds),
  });
  const id = input.id || stableId("change", `${intent.normalizedIntent}:${intent.targetIds.join(",")}:${createdAt.slice(0, 10)}`);
  const confirmationState = intent.requiresUserConfirmation ? "pending" : "not_required";
  const productionBiblePatch = productionBiblePatchFor(intent, id, createdAt);
  const assetLockScope = assetLockScopeFor(intent, id);
  const voiceChangeTransaction = voiceChangeFor(intent, id, createdAt);

  return {
    schemaVersion: storyChangeSchemaVersion,
    id,
    userIntent: input.userIntent,
    intentType: intent.intentType,
    operation: intent.operation,
    impactScope: intent.impactScope,
    targetIds: intent.targetIds,
    mustPreserve: unique([...(input.mustPreserve || []), ...defaultPreserve(intent)]),
    mustNotAdd: unique([...(input.mustNotAdd || []), ...defaultMustNotAdd(intent)]),
    invalidatedArtifactIds: [],
    requiresUserConfirmation: intent.requiresUserConfirmation,
    confirmationState,
    confirmationReasons: intent.confirmationReasons,
    status: intent.requiresUserConfirmation ? "pending_confirmation" : "dry_run",
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    productionBiblePatch,
    assetLockScope,
    voiceChangeTransaction,
    intentResult: { ...intent, createdAt },
    createdAt,
  };
}

function shotsFromContext(runtimeStateOrContext?: ProjectRuntimeState | ReflowImpactContext): ShotRecord[] {
  if (!runtimeStateOrContext) return [];
  if ("storyFlow" in runtimeStateOrContext) return runtimeStateOrContext.storyFlow.shots;
  return runtimeStateOrContext.shots || [];
}

function targetShots(transaction: StoryChangeTransaction, shots: ShotRecord[]): ShotRecord[] {
  if (!shots.length) return [];
  if (transaction.impactScope === "project") return shots;
  const targets = new Set(transaction.targetIds);
  const direct = shots.filter((shot) => targets.has(shot.id) || targets.has(shot.actId) || (shot.sectionId && targets.has(shot.sectionId)));
  if (direct.length) return direct;
  return transaction.impactScope === "shot" && transaction.targetIds.length ? [] : shots;
}

function invalidation(artifactType: ReflowArtifactType, targetId: string, reason: string, dependencies: string[] = [], requiresRegeneration = true): ArtifactInvalidation {
  return {
    schemaVersion: storyChangeSchemaVersion,
    artifactId: `${artifactType}_${targetId}`,
    artifactType,
    targetId,
    staleReason: reason,
    staleDependencies: dependencies,
    requiresRegeneration,
    severity: requiresRegeneration ? "stale" : "review",
  };
}

function addInvalidations(
  items: ArtifactInvalidation[],
  artifactTypes: ReflowArtifactType[],
  targetIds: string[],
  reason: string,
  dependencies: string[] = [],
  requiresRegeneration = true,
): void {
  for (const targetId of targetIds.length ? targetIds : ["project"]) {
    for (const type of artifactTypes) {
      items.push(invalidation(type, targetId, reason, dependencies, requiresRegeneration));
    }
  }
}

function dedupeInvalidations(items: ArtifactInvalidation[]): ArtifactInvalidation[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.artifactType}:${item.artifactId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildReflowImpactReport(
  transaction: StoryChangeTransaction,
  runtimeStateOrContext?: ProjectRuntimeState | ReflowImpactContext,
): ReflowImpactReport {
  const shots = shotsFromContext(runtimeStateOrContext);
  const affectedShots = targetShots(transaction, shots);
  const affectedShotIds = unique([...affectedShots.map((shot) => shot.id), ...(transaction.impactScope === "shot" ? transaction.targetIds : [])]);
  const affectedSectionIds = unique([
    ...affectedShots.flatMap((shot) => [shot.sectionId || "", shot.actId]),
    ...(transaction.impactScope === "section" ? transaction.targetIds : []),
  ]);
  const invalidations: ArtifactInvalidation[] = [];
  const targetIds = affectedShotIds.length ? affectedShotIds : transaction.targetIds;

  if (["insert_shot", "delete_shot", "move_shot"].includes(transaction.operation)) {
    addInvalidations(invalidations, ["storyFlow"], affectedSectionIds, "Shot insertion, deletion, or movement changes story ordering.", ["director_intent"]);
    addInvalidations(invalidations, ["shotSpec", "promptPlan", "preview"], targetIds, "Story flow reflow makes downstream shot planning stale.", ["storyFlow"]);
  } else if (transaction.operation === "update_shot") {
    addInvalidations(invalidations, ["promptPlan", "keyframe", "video", "preview"], targetIds, "Local shot change invalidates generated downstream artifacts.", ["shotSpec"]);
  } else if (transaction.operation === "update_style") {
    addInvalidations(invalidations, ["styleCapsule"], transaction.targetIds, "Style capsule must be reviewed before prompt planning.", ["productionBible"]);
    addInvalidations(invalidations, ["promptPlan", "keyframe", "video", "preview"], targetIds, "Style changes affect visual generation artifacts.", ["styleCapsule"]);
  } else if (["update_character", "update_scene", "update_story"].includes(transaction.operation)) {
    const rootType: ReflowArtifactType = transaction.operation === "update_scene" ? "spatialMemory" : transaction.operation === "update_character" ? "visualMemory" : "productionBible";
    addInvalidations(invalidations, ["productionBible", rootType], transaction.targetIds, "Core story or asset facts require structured review.", ["director_intent"]);
    addInvalidations(invalidations, ["shotSpec", "promptPlan", "keyframe", "video", "preview"], targetIds, "Core fact changes make shot-level artifacts stale.", ["productionBible"]);
  } else if (["update_dialogue", "update_narration", "update_voice"].includes(transaction.operation)) {
    addInvalidations(invalidations, ["voiceMemory", "audio", "preview"], targetIds, "Voice, dialogue, or narration changes require audio reflow.", ["voiceMemory"]);
  } else if (["lock_asset", "unlock_asset"].includes(transaction.operation)) {
    addInvalidations(invalidations, ["asset", "promptPlan", "qaReport"], transaction.targetIds, "Asset lock scope changes require reference authority review.", ["assetLockScope"], false);
  } else if (transaction.operation === "export_change") {
    addInvalidations(invalidations, ["preview"], transaction.targetIds, "Export settings require preview/export review.", ["export"]);
  } else if (transaction.operation !== "unknown") {
    addInvalidations(invalidations, ["promptPlan", "preview"], targetIds, "Unknown intent is treated conservatively as stale.", ["director_intent"]);
  }

  for (const artifactId of transaction.invalidatedArtifactIds) {
    invalidations.push({
      schemaVersion: storyChangeSchemaVersion,
      artifactId,
      artifactType: "taskRun",
      staleReason: "Explicitly listed by story change transaction.",
      staleDependencies: [transaction.id],
      requiresRegeneration: false,
      severity: "review",
    });
  }

  const deduped = dedupeInvalidations(invalidations);
  const staleArtifactIds = unique(deduped.map((item) => item.artifactId));
  const report: ReflowImpactReport = {
    schemaVersion: storyChangeSchemaVersion,
    id: stableId("reflow", `${transaction.id}:${staleArtifactIds.join(",")}`),
    transactionId: transaction.id,
    status: transaction.requiresUserConfirmation ? "pending_confirmation" : "dry_run",
    summary: "",
    affectedScopes: unique([transaction.impactScope]) as StoryChangeImpactScope[],
    affectedSectionIds,
    affectedShotIds,
    affectedAssetIds: transaction.impactScope === "asset" ? transaction.targetIds : [],
    invalidations: deduped,
    staleArtifactIds,
    requiresUserConfirmation: transaction.requiresUserConfirmation,
    confirmationReasons: transaction.confirmationReasons,
    regenerationPlan: buildRegenerationPlan(deduped),
    forbiddenActions: ["provider_submit", "prompt_patch_from_natural_language", "direct_project_mutation"],
    createdAt: new Date().toISOString(),
  };
  report.summary = describeReflowImpact(report);
  return report;
}

function buildRegenerationPlan(invalidations: ArtifactInvalidation[]): ReflowImpactReport["regenerationPlan"] {
  const types = new Map<ReflowArtifactType, Set<string>>();
  for (const item of invalidations) {
    const targetIds = types.get(item.artifactType) || new Set<string>();
    targetIds.add(item.targetId || item.artifactId);
    types.set(item.artifactType, targetIds);
  }
  const stepByType: Partial<Record<ReflowArtifactType, ReflowImpactReport["regenerationPlan"][number]["step"]>> = {
    storyFlow: "rebuild_story_flow",
    shotSpec: "rebuild_shot_spec",
    shotLayout: "rebuild_shot_spec",
    promptPlan: "rebuild_prompt_plan",
    keyframe: "regenerate_keyframes",
    video: "regenerate_video",
    audio: "regenerate_audio",
    preview: "rebuild_preview",
    visualMemory: "review_assets",
    spatialMemory: "review_assets",
    asset: "review_assets",
    productionBible: "review_assets",
    styleCapsule: "review_assets",
    voiceMemory: "regenerate_audio",
    qaReport: "review_assets",
  };

  const planned = new Map<string, Set<string>>();
  for (const [type, ids] of types.entries()) {
    const step = stepByType[type];
    if (!step) continue;
    const bucket = planned.get(step) || new Set<string>();
    for (const id of ids) bucket.add(id);
    planned.set(step, bucket);
  }
  return Array.from(planned.entries()).map(([step, ids]) => ({
    step: step as ReflowImpactReport["regenerationPlan"][number]["step"],
    targetIds: Array.from(ids).sort(),
    reason: "Dry-run reflow only. Execute after structured confirmation and mutation.",
  }));
}

export function describeReflowImpact(report: ReflowImpactReport): string {
  const confirmation = report.requiresUserConfirmation ? "Requires user confirmation" : "No user confirmation required";
  if (!report.staleArtifactIds.length) {
    return `${confirmation}. Dry-run reflow found no mutation intent and marked no artifacts stale; provider submit, direct prompt patch, and direct project mutation remain forbidden.`;
  }
  const shots = report.affectedShotIds.length ? `${report.affectedShotIds.length} shot(s)` : "no resolved shots";
  return `${confirmation}. Dry-run reflow marks ${report.staleArtifactIds.length} artifact(s) stale across ${shots}; provider submit, direct prompt patch, and direct project mutation remain forbidden.`;
}
