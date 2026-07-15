import {
  buildDirectorProductionSkillPlan,
  type DirectorProductionSkillPlan,
  type DirectorProductionStrategyId,
} from "./directorProductionSkill";
import {
  directorSkillDefinitionFileName,
  directorSkillRecipeFileName,
  directorSkillSemanticId,
  migrateLegacyDirectorSkillCard,
  serializeDirectorSkillContract,
  type DirectorSkillDefinition,
  type DirectorSkillRecipe,
} from "./directorSkillContract";
import type { ShotRecord } from "./types";

export const DIRECTOR_SKILL_CARD_SCHEMA_VERSION = "director_skill_card_v1";
export const LEGACY_DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION = "director_skill_stack_index_v1";
export const DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION = "director_skill_stack_index_v2";
export const DIRECTOR_SKILL_STACK_INDEX_PATH = "skills/skill-index.json";

export type DirectorSkillCategory = "风格" | "节奏" | "镜头" | "角色" | "模型约束" | "QA";
export type DirectorSkillAppliesTo = "故事规划" | "参考图" | "Seedance prompt" | "QA";
export type DirectorSkillSource = "系统内置" | "用户沉淀" | "项目生成";

export interface DirectorSkillCard {
  schemaVersion: typeof DIRECTOR_SKILL_CARD_SCHEMA_VERSION;
  id: string;
  name: string;
  summary: string;
  category: DirectorSkillCategory;
  useWhen: string[];
  avoidWhen: string[];
  appliesTo: DirectorSkillAppliesTo[];
  rules: string[];
  example: string;
  source: DirectorSkillSource;
  version: string;
  createdFrom?: {
    projectTitle?: string;
    shotId?: string;
    shotTitle?: string;
    strategy?: DirectorProductionStrategyId;
  };
}

export interface DirectorSkillStackItem {
  id: string;
  name: string;
  summary: string;
  category: DirectorSkillCategory;
  appliesTo: DirectorSkillAppliesTo[];
  source: DirectorSkillSource;
  version: string;
  fileName: string;
  definitionPath?: string;
  recipePath?: string;
  contentHash?: string;
  scope?: DirectorSkillDefinition["scope"];
  maturity?: DirectorSkillDefinition["maturity"];
  enabled?: boolean;
  migrationStatus?: "native_v2" | "migrated_v1" | "requires_source_card";
  savedAt: string;
  createdFrom?: DirectorSkillCard["createdFrom"];
}

export interface DirectorSkillStackIndex {
  schemaVersion: typeof DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION;
  updatedAt: string;
  skills: DirectorSkillStackItem[];
}

export interface DirectorSkillStackIndexParseResult {
  ok: boolean;
  status: "restored_v2" | "migrated_v1_metadata" | "invalid";
  index: DirectorSkillStackIndex;
  errors: string[];
}

export interface DirectorSkillArtifacts {
  card: DirectorSkillCard;
  definition: DirectorSkillDefinition;
  recipe: DirectorSkillRecipe;
  markdownFileName: string;
  definitionPath: string;
  recipePath: string;
  markdown: string;
  definitionJson: string;
  recipeJson: string;
}

export interface DirectorSkillCardBuildOptions {
  projectTitle?: string;
  source?: DirectorSkillSource;
  version?: string;
}

const STRATEGY_SKILL_META: Record<DirectorProductionStrategyId, {
  name: string;
  category: DirectorSkillCategory;
  summary: string;
  appliesTo: DirectorSkillAppliesTo[];
}> = {
  storyboard_narrative: {
    name: "故事板叙事",
    category: "镜头",
    summary: "用故事板先锁住构图、站位、情绪承接和阅读顺序，再交给视频模型生成。",
    appliesTo: ["故事规划", "参考图", "Seedance prompt", "QA"],
  },
  storyboard_rapid_cut: {
    name: "故事板快切",
    category: "节奏",
    summary: "把动作链、快切和运镜节奏先画成可读的预演板，避免视频模型把复杂动作压成单个静态镜头。",
    appliesTo: ["故事规划", "参考图", "Seedance prompt", "QA"],
  },
  omni_reference: {
    name: "全能参考",
    category: "模型约束",
    summary: "用角色、场景、关键道具和文字导演说明直接生成简单镜头，不额外制造故事板噪声。",
    appliesTo: ["故事规划", "Seedance prompt", "QA"],
  },
};

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanLines(items: Array<string | undefined>) {
  return items.map(clean).filter(Boolean);
}

function unique(items: string[]) {
  return Array.from(new Set(items.map(clean).filter(Boolean)));
}

function safeSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "director-skill";
}

function skillIdFor(plan: DirectorProductionSkillPlan, shot: ShotRecord) {
  void shot;
  return directorSkillSemanticId(plan.strategyId);
}

function shotExample(shot: ShotRecord, plan: DirectorProductionSkillPlan) {
  const parts = cleanLines([
    shot.title,
    shot.primaryAction ? `主动作：${shot.primaryAction}` : undefined,
    shot.actionTrigger ? `触发：${shot.actionTrigger}` : undefined,
    shot.microReaction ? `微反应：${shot.microReaction}` : undefined,
    shot.camera ? `镜头：${shot.camera}` : undefined,
  ]);
  return parts.length
    ? `${plan.strategyLabel}案例：${parts.join("；")}`
    : `${plan.strategyLabel}案例：用在 ${shot.id} 这类镜头。`;
}

function skillPlanFromShot(shot: ShotRecord) {
  return buildDirectorProductionSkillPlan({
    shotId: shot.id,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    shotText: cleanLines([
      shot.storyFunction,
      shot.seedanceDirection,
      shot.primaryAction,
      shot.actionTrigger,
      shot.microReaction,
    ]).join("\n"),
    executionMode: shot.executionMode,
    referenceStrategy: shot.referenceStrategy,
    actionBeats: shot.actionBeats,
    camera: shot.camera,
    visualDescription: shot.seedanceDirection || shot.storyFunction,
    assetState: {
      scene: shot.sceneGuidance?.length ? "locked" : "candidate",
      characters: shot.characterGuidance?.length ? "locked" : "candidate",
      props: shot.propGuidance?.length ? "locked" : "candidate",
    },
  });
}

function rulesFor(plan: DirectorProductionSkillPlan) {
  return unique([
    plan.strategyContract.visibleCutSemantics,
    ...plan.strategyContract.promptStructure,
    plan.assetAuthorityContract.independentPropRule,
    plan.assetAuthorityContract.componentOwnershipRule,
    plan.assetAuthorityContract.sceneConstraintRule,
  ]);
}

export function buildDirectorSkillCardFromShot(
  shot: ShotRecord,
  options: DirectorSkillCardBuildOptions = {},
): DirectorSkillCard {
  const plan = skillPlanFromShot(shot);
  const meta = STRATEGY_SKILL_META[plan.strategyId];
  return {
    schemaVersion: DIRECTOR_SKILL_CARD_SCHEMA_VERSION,
    id: skillIdFor(plan, shot),
    name: meta.name,
    summary: meta.summary,
    category: meta.category,
    useWhen: unique(plan.strategyContract.inputConditions),
    avoidWhen: unique(plan.strategyContract.riskWarnings),
    appliesTo: meta.appliesTo,
    rules: rulesFor(plan),
    example: shotExample(shot, plan),
    source: options.source || "项目生成",
    version: options.version || "0.1.0",
    createdFrom: {
      projectTitle: clean(options.projectTitle) || undefined,
      shotId: shot.id,
      shotTitle: shot.title,
      strategy: plan.strategyId,
    },
  };
}

export function directorSkillFileName(card: DirectorSkillCard) {
  return `${safeSlug(`${card.name}-${card.id}`)}.md`;
}

function stackItemFromCard(
  card: DirectorSkillCard,
  fileName: string,
  savedAt: string,
  definition?: DirectorSkillDefinition,
  recipe?: DirectorSkillRecipe,
): DirectorSkillStackItem {
  return {
    id: card.id,
    name: card.name,
    summary: card.summary,
    category: card.category,
    appliesTo: card.appliesTo,
    source: card.source,
    version: definition?.version || card.version,
    fileName,
    definitionPath: definition ? directorSkillDefinitionFileName(definition) : undefined,
    recipePath: recipe ? directorSkillRecipeFileName(recipe) : undefined,
    contentHash: definition?.contentHash,
    scope: definition?.scope,
    maturity: definition?.maturity,
    enabled: Boolean(definition),
    migrationStatus: definition ? (definition.source === "migrated_v1" ? "migrated_v1" : "native_v2") : "requires_source_card",
    savedAt,
    createdFrom: card.createdFrom,
  };
}

export function createDirectorSkillStackIndex(skills: DirectorSkillStackItem[] = [], updatedAt = new Date().toISOString()): DirectorSkillStackIndex {
  return {
    schemaVersion: DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION,
    updatedAt,
    skills,
  };
}

export function upsertDirectorSkillStackIndex(
  index: DirectorSkillStackIndex | undefined,
  input: {
    card: DirectorSkillCard;
    fileName: string;
    savedAt?: string;
    definition?: DirectorSkillDefinition;
    recipe?: DirectorSkillRecipe;
  },
): DirectorSkillStackIndex {
  const savedAt = input.savedAt || new Date().toISOString();
  const migrated = input.definition && input.recipe
    ? { definition: input.definition, recipe: input.recipe }
    : migrateLegacyDirectorSkillCard(input.card);
  const item = stackItemFromCard(
    input.card,
    input.fileName,
    savedAt,
    migrated.definition,
    migrated.recipe,
  );
  const existing = index?.skills || [];
  const next = [...existing.filter((skill) => skill.id !== item.id), item]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  return createDirectorSkillStackIndex(next, savedAt);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function isDirectorSkillCategory(value: string): value is DirectorSkillCategory {
  return ["风格", "节奏", "镜头", "角色", "模型约束", "QA"].includes(value);
}

function isDirectorSkillAppliesTo(value: string): value is DirectorSkillAppliesTo {
  return ["故事规划", "参考图", "Seedance prompt", "QA"].includes(value);
}

function isDirectorSkillSource(value: string): value is DirectorSkillSource {
  return ["系统内置", "用户沉淀", "项目生成"].includes(value);
}

function isDirectorProductionStrategyId(value: string): value is DirectorProductionStrategyId {
  return ["storyboard_narrative", "storyboard_rapid_cut", "omni_reference"].includes(value);
}

function parseStackItem(value: unknown): DirectorSkillStackItem | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const category = stringValue(record.category);
  const source = stringValue(record.source);
  const appliesTo = stringArrayValue(record.appliesTo).filter(isDirectorSkillAppliesTo);
  const id = stringValue(record.id);
  const name = stringValue(record.name);
  const summary = stringValue(record.summary);
  const fileName = stringValue(record.fileName);
  if (!id || !name || !summary || !fileName || !isDirectorSkillCategory(category) || !isDirectorSkillSource(source)) return undefined;
  const createdFrom = record.createdFrom && typeof record.createdFrom === "object"
    ? record.createdFrom as Record<string, unknown>
    : undefined;
  const strategy = createdFrom ? stringValue(createdFrom.strategy) : "";
  return {
    id,
    name,
    summary,
    category,
    appliesTo,
    source,
    version: stringValue(record.version) || "0.1.0",
    fileName,
    definitionPath: stringValue(record.definitionPath) || undefined,
    recipePath: stringValue(record.recipePath) || undefined,
    contentHash: stringValue(record.contentHash) || undefined,
    scope: ["system_builtin", "project_local", "user_global", "external_imported"].includes(stringValue(record.scope))
      ? stringValue(record.scope) as DirectorSkillDefinition["scope"]
      : undefined,
    maturity: ["candidate", "verified", "trusted", "deprecated"].includes(stringValue(record.maturity))
      ? stringValue(record.maturity) as DirectorSkillDefinition["maturity"]
      : undefined,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    migrationStatus: ["native_v2", "migrated_v1", "requires_source_card"].includes(stringValue(record.migrationStatus))
      ? stringValue(record.migrationStatus) as DirectorSkillStackItem["migrationStatus"]
      : undefined,
    savedAt: stringValue(record.savedAt) || new Date(0).toISOString(),
    createdFrom: createdFrom
      ? {
          projectTitle: stringValue(createdFrom.projectTitle) || undefined,
          shotId: stringValue(createdFrom.shotId) || undefined,
          shotTitle: stringValue(createdFrom.shotTitle) || undefined,
          strategy: isDirectorProductionStrategyId(strategy) ? strategy : undefined,
        }
      : undefined,
  };
}

export function parseDirectorSkillStackIndexWithStatus(content: string): DirectorSkillStackIndexParseResult {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, status: "invalid", index: createDirectorSkillStackIndex([]), errors: ["Skill index must be an object"] };
    }
    const record = parsed as Record<string, unknown>;
    const isV2 = record.schemaVersion === DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION;
    const isV1 = record.schemaVersion === LEGACY_DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION;
    if (!isV2 && !isV1) {
      return { ok: false, status: "invalid", index: createDirectorSkillStackIndex([]), errors: ["Unsupported Skill index schemaVersion"] };
    }
    const skills = Array.isArray(record.skills)
      ? record.skills.map(parseStackItem).filter((item): item is DirectorSkillStackItem => Boolean(item))
      : [];
    const normalizedSkills = isV1
      ? skills.map((item) => ({
          ...item,
          definitionPath: undefined,
          recipePath: undefined,
          contentHash: undefined,
          scope: "project_local" as const,
          maturity: "candidate" as const,
          enabled: false,
          migrationStatus: "requires_source_card" as const,
        }))
      : skills;
    return {
      ok: true,
      status: isV1 ? "migrated_v1_metadata" : "restored_v2",
      index: createDirectorSkillStackIndex(normalizedSkills, stringValue(record.updatedAt) || new Date(0).toISOString()),
      errors: isV1 ? ["Legacy Skill metadata restored fail-closed; source card is required before runtime use"] : [],
    };
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      index: createDirectorSkillStackIndex([]),
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function parseDirectorSkillStackIndex(content: string): DirectorSkillStackIndex {
  return parseDirectorSkillStackIndexWithStatus(content).index;
}

export function serializeDirectorSkillStackIndex(index: DirectorSkillStackIndex) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

function markdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- 暂无";
}

export function directorSkillCardMarkdown(card: DirectorSkillCard) {
  const frontMatter = [
    "---",
    `schemaVersion: ${card.schemaVersion}`,
    `id: ${card.id}`,
    `name: ${card.name}`,
    `category: ${card.category}`,
    `source: ${card.source}`,
    `version: ${card.version}`,
    card.createdFrom?.projectTitle ? `projectTitle: ${card.createdFrom.projectTitle}` : undefined,
    card.createdFrom?.shotId ? `shotId: ${card.createdFrom.shotId}` : undefined,
    card.createdFrom?.strategy ? `strategy: ${card.createdFrom.strategy}` : undefined,
    "---",
  ].filter(Boolean).join("\n");

  return [
    frontMatter,
    "",
    `# ${card.name}`,
    "",
    card.summary,
    "",
    "## 什么时候用",
    markdownList(card.useWhen),
    "",
    "## 什么时候别用",
    markdownList(card.avoidWhen),
    "",
    "## 影响范围",
    markdownList(card.appliesTo),
    "",
    "## 核心规则",
    markdownList(card.rules),
    "",
    "## 成功案例",
    card.example,
    "",
  ].join("\n");
}

export function buildDirectorSkillArtifactsFromShot(
  shot: ShotRecord,
  options: DirectorSkillCardBuildOptions = {},
): DirectorSkillArtifacts {
  const card = buildDirectorSkillCardFromShot(shot, options);
  const migrated = migrateLegacyDirectorSkillCard(card);
  if (!migrated.ok || !migrated.definition || !migrated.recipe) {
    throw new Error(`Unable to build director Skill v2 artifacts: ${migrated.errors.join("; ")}`);
  }
  return {
    card,
    definition: migrated.definition,
    recipe: migrated.recipe,
    markdownFileName: directorSkillFileName(card),
    definitionPath: directorSkillDefinitionFileName(migrated.definition),
    recipePath: directorSkillRecipeFileName(migrated.recipe),
    markdown: directorSkillCardMarkdown(card),
    definitionJson: serializeDirectorSkillContract(migrated.definition),
    recipeJson: serializeDirectorSkillContract(migrated.recipe),
  };
}
