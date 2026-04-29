import { buildRuntimeView, type KnowledgeRouteTestView, type RuntimeView } from "./runtimeView";
import type { KnowledgePackManifest, KnowledgeRouteMatch, KnowledgeTaskPurpose } from "./knowledgeTypes";
import {
  projectRuntimeCoreStateVersion,
  projectRuntimeStateSchemaVersion,
  type KnowledgeBindingSummary,
  type ProjectRuntimeKnowledgeSummary,
  type ProjectRuntimeState,
  type ProjectRuntimeTaskState,
  type RuntimeStateSource,
} from "./projectState";
import type { ProjectAudit, ProviderSlot } from "./types";

export const emptyKnowledgeManifest: KnowledgePackManifest = {
  schemaVersion: "0.1.0",
  manifestVersion: "empty",
  generatedAt: new Date(0).toISOString(),
  knowledgeLibraryRoot: "",
  manifestHash: "empty",
  packs: [],
};

export interface ProjectRuntimeStateBuildOptions {
  selectedShotId?: string;
  knowledgeTestIntent?: string;
  generatedAt?: string;
  stateSource?: RuntimeStateSource;
}

function toKnowledgeBindings(manifest: KnowledgePackManifest): KnowledgeBindingSummary[] {
  return manifest.packs.map((pack) => ({
    packId: pack.id,
    version: pack.version,
    hash: pack.hash,
    category: pack.category,
    title: pack.title,
    summary: pack.summary,
    tags: pack.tags || [],
    enabled: pack.enabled,
    maxInjectionTokens: pack.maxInjectionTokens,
  }));
}

function runtimeTaskToState(task: RuntimeView["taskViews"][number]): ProjectRuntimeTaskState {
  return {
    job: task.job,
    shotId: task.shot?.id,
    envelope: task.envelope,
    taskRun: task.taskRun,
    queueGate: task.queueGate,
    manifestMatch: task.manifestMatch,
    validator: task.validator,
    routeResult: task.routeResult,
    contextBudget: task.contextBudget,
    nextStep: task.nextStep,
  };
}

function buildProjectSummary(audit: ProjectAudit): ProjectRuntimeState["project"] {
  return {
    title: audit.projectTitle,
    root: audit.projectRoot,
    sourceTask: audit.sourceTask,
    state: audit.state,
    importedAt: audit.importedAt,
    metrics: audit.metrics,
    providerPolicy: audit.providerPolicy,
    workflow: audit.workflow,
    contactSheets: audit.contactSheets,
  };
}

export function buildProjectRuntimeState(
  audit: ProjectAudit,
  knowledgeManifest: KnowledgePackManifest = emptyKnowledgeManifest,
  options: ProjectRuntimeStateBuildOptions = {},
): ProjectRuntimeState {
  const view = buildRuntimeView(audit, knowledgeManifest, {
    selectedShotId: options.selectedShotId,
    knowledgeTestIntent: options.knowledgeTestIntent,
  });
  const taskViews = view.taskViews.map(runtimeTaskToState);
  const knowledge: ProjectRuntimeKnowledgeSummary = {
    ...view.knowledge,
    bindings: toKnowledgeBindings(knowledgeManifest),
  };

  return {
    schemaVersion: projectRuntimeStateSchemaVersion,
    coreStateVersion: projectRuntimeCoreStateVersion,
    generatedAt: options.generatedAt || new Date().toISOString(),
    project: buildProjectSummary(audit),
    sourceIndex: view.sourceIndex,
    sourceIndexSummary: view.sourceIndexSummary,
    storyFlow: {
      sections: view.storySections,
      shots: audit.shots,
    },
    visualMemory: {
      summary: view.visualMemory,
      assets: audit.assets,
    },
    taskRuns: {
      jobs: audit.jobs,
      runs: taskViews.map((task) => task.taskRun),
      taskViews,
      queueSummary: view.queueSummary,
      preflightSummary: view.preflightSummary,
    },
    manifestMatches: {
      summary: view.manifestSummary,
      reports: taskViews.map((task) => task.manifestMatch),
    },
    previewEvents: view.previewEvents,
    diagnostics: {
      issues: audit.issues,
      schemaSummary: audit.schemaSummary,
      generatedBy: "src/core/projectStateBuilder.ts",
    },
    knowledge,
    stateSource: options.stateSource || {
      kind: "runtime-state",
      label: "runtime-state",
      path: "/runtime-state.json",
      sourceImportedAt: audit.importedAt,
    },
  };
}

export function auditFromProjectRuntimeState(state: ProjectRuntimeState): ProjectAudit {
  return {
    importedAt: state.project.importedAt,
    projectTitle: state.project.title,
    projectRoot: state.project.root,
    sourceTask: state.project.sourceTask,
    state: state.project.state,
    sourceIndex: state.sourceIndex,
    schemaSummary: state.diagnostics.schemaSummary,
    metrics: state.project.metrics,
    providerPolicy: state.project.providerPolicy,
    workflow: state.project.workflow,
    assets: state.visualMemory.assets,
    shots: state.storyFlow.shots,
    jobs: state.taskRuns.jobs,
    issues: state.diagnostics.issues,
    contactSheets: state.project.contactSheets,
  };
}

function inferRoutePurpose(intent: string): { purpose: KnowledgeTaskPurpose; slot?: ProviderSlot } {
  const lowered = intent.toLowerCase();
  if (/qa|audit|验收|检查|审计|连续性/.test(lowered)) return { purpose: "qa" };
  if (/脚本|剧本|story|storyflow|分镜|对白/.test(lowered)) return { purpose: "script" };
  if (/视频|i2v|seedance|即梦|运镜|motion|镜头运动/.test(lowered)) return { purpose: "i2v", slot: "video.i2v" };
  if (/关键帧|image|prompt|构图|光|色彩|风格/.test(lowered)) return { purpose: "keyframe", slot: "image.edit" };
  if (/旁白|音乐|声音|tts|voice|audio/.test(lowered)) return { purpose: "audio", slot: "audio.tts" };
  return { purpose: "unknown" };
}

function tokenizeIntent(intent: string): string[] {
  return Array.from(new Set(intent.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((item) => item.length >= 2)));
}

function buildRouteTestFromStateKnowledge(
  knowledge: ProjectRuntimeKnowledgeSummary,
  intent?: string,
): KnowledgeRouteTestView | undefined {
  const trimmed = intent?.trim();
  if (!trimmed) return knowledge.routeTest;

  const terms = tokenizeIntent(trimmed);
  const inferred = inferRoutePurpose(trimmed);
  const matches: KnowledgeRouteMatch[] = knowledge.bindings
    .filter((binding) => binding.enabled)
    .map((binding) => {
      const haystack = [binding.packId, binding.category, binding.title, binding.summary, ...binding.tags].join(" ").toLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const score = matchedTerms.length + (haystack.includes(String(inferred.purpose)) ? 1 : 0);
      return {
        packId: binding.packId,
        version: binding.version,
        hash: binding.hash,
        category: binding.category,
        reason: score > 0 ? "Matched state knowledge summary." : "Available enabled knowledge binding.",
        consumer: "diagnostics" as const,
        score,
        matchedTerms,
        matchedSnippetIds: [],
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.packId.localeCompare(right.packId))
    .slice(0, 8);

  const routeResult = {
    routeId: `state-route-${Math.abs(trimmed.split("").reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261)).toString(16)}`,
    taskPurpose: inferred.purpose,
    providerSlot: inferred.slot,
    contextLevel: "L1" as const,
    inputHash: `state-${terms.join("-") || "empty"}`,
    matches,
    warnings: matches.length ? [] : ["No enabled knowledge binding matched this state summary."],
    createdAt: new Date().toISOString(),
  };
  const contextBudget = {
    budgetId: `${routeResult.routeId}-budget`,
    routeId: routeResult.routeId,
    contextLevel: "L1" as const,
    maxInjectionTokens: 700,
    usedTokens: 0,
    injectedKnowledgePacks: matches.map((match) => ({
      packId: match.packId,
      version: match.version,
      hash: match.hash,
      category: match.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: [],
      summaryHash: match.hash,
      truncated: false,
    })),
    injectedSnippets: [],
    warnings: routeResult.warnings,
    createdAt: routeResult.createdAt,
  };

  return { intent: trimmed, routeResult, contextBudget };
}

function deriveNextStep(taskViews: RuntimeView["taskViews"]) {
  const firstBlocked = taskViews.find((task) => task.queueGate.status === "blocked");
  if (firstBlocked) return firstBlocked.nextStep;
  const firstParked = taskViews.find((task) => task.queueGate.status === "parked");
  if (firstParked) return firstParked.nextStep;
  const firstReady = taskViews.find((task) => task.queueGate.status === "ready");
  if (firstReady) return firstReady.nextStep;
  return "Import a runtime state or select a shot";
}

export function buildRuntimeViewFromProjectState(
  state: ProjectRuntimeState,
  options: { selectedShotId?: string; knowledgeTestIntent?: string } = {},
): RuntimeView {
  const audit = auditFromProjectRuntimeState(state);
  const taskViews = state.taskRuns.taskViews.map((task) => ({
    ...task,
    shot: task.shotId ? state.storyFlow.shots.find((shot) => shot.id === task.shotId) : undefined,
  }));
  const selectedTasks = options.selectedShotId ? taskViews.filter((task) => task.shot?.id === options.selectedShotId) : taskViews;
  const knowledge = {
    ...state.knowledge,
    routeTest: buildRouteTestFromStateKnowledge(state.knowledge, options.knowledgeTestIntent),
  };

  return {
    audit,
    sourceIndex: state.sourceIndex,
    sourceIndexSummary: state.sourceIndexSummary,
    storySections: state.storyFlow.sections,
    visualMemory: state.visualMemory.summary,
    taskViews,
    queueSummary: state.taskRuns.queueSummary,
    preflightSummary: state.taskRuns.preflightSummary,
    previewEvents: state.previewEvents,
    manifestSummary: state.manifestMatches.summary,
    knowledge,
    nextStep: deriveNextStep(selectedTasks.length ? selectedTasks : taskViews),
    stateSource: state.stateSource,
  };
}
