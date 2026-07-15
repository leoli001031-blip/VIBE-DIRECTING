import { directorSkillContentHash } from "./directorSkillContract";
import type { DirectorProductionStrategyId } from "./directorProductionSkill";
import {
  directorSkillCaseSupportsPromotion,
  type DirectorSkillCase,
} from "./directorSkillEvidence";
import {
  routeDirectorSkills,
  type DirectorSkillRouteResult,
  type DirectorSkillRouteExclusion,
  type DirectorSkillRouterInput,
} from "./directorSkillRouter";
import type { DirectorSkillRegistry } from "./directorSkillRegistry";

export const DIRECTOR_SKILL_EVALUATION_SCHEMA_VERSION = "director_skill_evaluation/1.0.0";

export type DirectorSkillEvaluationFixtureKind = "positive" | "negative" | "ambiguous" | "conflict";

export interface DirectorSkillExecutionComparisonEvidence {
  v1StrategyId?: DirectorProductionStrategyId;
  v1PromptHash?: string;
  v1QaStatus?: "pass" | "warning" | "blocked";
  v2PromptHash?: string;
  v2QaStatus?: "pass" | "warning" | "blocked";
}

export interface DirectorSkillEvaluationFixture {
  fixtureId: string;
  kind: DirectorSkillEvaluationFixtureKind;
  description: string;
  routerInput: DirectorSkillRouterInput;
  expectedPrimarySkillIds: string[];
  forbiddenSkillIds: string[];
  expectedExclusionReasons?: DirectorSkillRouteExclusion["reason"][];
  executionEvidence?: DirectorSkillExecutionComparisonEvidence;
}

export interface DirectorSkillEvaluationFixtureResult {
  fixtureId: string;
  kind: DirectorSkillEvaluationFixtureKind;
  status: "pass" | "fail";
  actualPrimarySkillId?: string;
  actualPrimaryVersion?: string;
  routeId: string;
  matchedExpectedPrimary: boolean;
  falseTrigger: boolean;
  forbiddenTriggered: string[];
  exclusionReasons: string[];
  conflictCount: number;
  failures: string[];
}

export interface DirectorSkillV1V2Comparison {
  fixtureId: string;
  v1StrategyId?: DirectorProductionStrategyId;
  v2StrategyId?: DirectorProductionStrategyId;
  routingAligned?: boolean;
  promptCompared: boolean;
  promptChanged?: boolean;
  qaCompared: boolean;
  qaChanged?: boolean;
  missingEvidence: string[];
}

export interface DirectorSkillTrustedEvidenceSummary {
  skillId: string;
  version: string;
  contentHash: string;
  acceptedCaseCount: number;
  acceptedProjectCount: number;
  providerModels: string[];
  crossProjectReuseCount: number;
  unprovenScope: string[];
}

export interface DirectorSkillEvaluationReport {
  schemaVersion: typeof DIRECTOR_SKILL_EVALUATION_SCHEMA_VERSION;
  reportId: string;
  reportHash: string;
  fixtureResults: DirectorSkillEvaluationFixtureResult[];
  metrics: {
    routeHitRate: number;
    falseTriggerRate: number;
    humanAccepted: number;
    humanModified: number;
    humanRejected: number;
    retryRequested: number;
    failed: number;
    qaPassRate: number;
    rollbackRate: number;
    crossProjectReuseCount: number;
  };
  v1V2Comparisons: DirectorSkillV1V2Comparison[];
  trustedEvidence: DirectorSkillTrustedEvidenceSummary[];
  governance: {
    promotionEligibleCaseIds: string[];
    excludedCaseIds: string[];
    rejectedRetryFailedCannotPromote: true;
    skillCannotAuthorizeExecution: true;
  };
  overallStatus: "pass" | "fail";
  generatedAt: string;
}

function ratio(numerator: number, denominator: number): number {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

function strategyForRoute(route: DirectorSkillRouteResult, input: DirectorSkillRouterInput): DirectorProductionStrategyId | undefined {
  const definition = input.availableSkills.find((skill) => skill.id === route.primary?.skillId && skill.version === route.primary?.version);
  return definition?.applicability.strategyIds[0];
}

function evaluateFixture(fixture: DirectorSkillEvaluationFixture): {
  result: DirectorSkillEvaluationFixtureResult;
  route: DirectorSkillRouteResult;
} {
  const route = routeDirectorSkills(fixture.routerInput);
  const primaryId = route.primary?.skillId;
  const expectsNoMatch = fixture.expectedPrimarySkillIds.length === 0;
  const matchedExpectedPrimary = expectsNoMatch ? !primaryId : Boolean(primaryId && fixture.expectedPrimarySkillIds.includes(primaryId));
  const falseTrigger = fixture.kind === "negative" && Boolean(primaryId);
  const forbiddenTriggered = primaryId && fixture.forbiddenSkillIds.includes(primaryId) ? [primaryId] : [];
  const exclusionReasons = Array.from(new Set(route.notSelected.map((item) => item.reason))).sort();
  const failures: string[] = [];
  if (!matchedExpectedPrimary) failures.push("primary_skill_expectation_mismatch");
  if (forbiddenTriggered.length) failures.push("forbidden_skill_triggered");
  if (falseTrigger) failures.push("negative_fixture_false_trigger");
  for (const reason of fixture.expectedExclusionReasons || []) {
    if (!exclusionReasons.includes(reason)) failures.push(`missing_exclusion:${reason}`);
  }
  if (fixture.kind === "conflict" && route.conflicts.length === 0) failures.push("expected_conflict_not_reported");
  return {
    route,
    result: {
      fixtureId: fixture.fixtureId,
      kind: fixture.kind,
      status: failures.length ? "fail" : "pass",
      actualPrimarySkillId: primaryId,
      actualPrimaryVersion: route.primary?.version,
      routeId: route.routeId,
      matchedExpectedPrimary,
      falseTrigger,
      forbiddenTriggered,
      exclusionReasons,
      conflictCount: route.conflicts.length,
      failures,
    },
  };
}

function compareV1V2(
  fixture: DirectorSkillEvaluationFixture,
  route: DirectorSkillRouteResult,
): DirectorSkillV1V2Comparison {
  const evidence = fixture.executionEvidence;
  const v2StrategyId = strategyForRoute(route, fixture.routerInput);
  const missingEvidence: string[] = [];
  if (!evidence?.v1StrategyId) missingEvidence.push("v1StrategyId");
  if (!v2StrategyId) missingEvidence.push("v2StrategyId");
  if (!evidence?.v1PromptHash) missingEvidence.push("v1PromptHash");
  if (!evidence?.v2PromptHash) missingEvidence.push("v2PromptHash");
  if (!evidence?.v1QaStatus) missingEvidence.push("v1QaStatus");
  if (!evidence?.v2QaStatus) missingEvidence.push("v2QaStatus");
  return {
    fixtureId: fixture.fixtureId,
    v1StrategyId: evidence?.v1StrategyId,
    v2StrategyId,
    routingAligned: evidence?.v1StrategyId && v2StrategyId ? evidence.v1StrategyId === v2StrategyId : undefined,
    promptCompared: Boolean(evidence?.v1PromptHash && evidence.v2PromptHash),
    promptChanged: evidence?.v1PromptHash && evidence.v2PromptHash ? evidence.v1PromptHash !== evidence.v2PromptHash : undefined,
    qaCompared: Boolean(evidence?.v1QaStatus && evidence.v2QaStatus),
    qaChanged: evidence?.v1QaStatus && evidence.v2QaStatus ? evidence.v1QaStatus !== evidence.v2QaStatus : undefined,
    missingEvidence,
  };
}

function trustedEvidenceSummaries(
  registry: DirectorSkillRegistry | undefined,
  cases: DirectorSkillCase[],
): DirectorSkillTrustedEvidenceSummary[] {
  if (!registry) return [];
  return registry.entries.flatMap((entry) => entry.versions
    .filter((version) => version.maturity === "trusted")
    .map((version) => {
      const accepted = cases.filter((item) => item.skillId === entry.skillId
        && item.skillVersion === version.version
        && item.skillContentHash === version.contentHash
        && directorSkillCaseSupportsPromotion(item));
      const projects = new Set(accepted.map((item) => item.projectId));
      const models = Array.from(new Set(accepted.map((item) => item.provider.modelId).filter((item): item is string => Boolean(item)))).sort();
      const unprovenScope: string[] = [];
      if (accepted.length < 2) unprovenScope.push("insufficient_accepted_cases_for_this_trusted_version");
      if (projects.size < 2) unprovenScope.push("cross_project_generalization");
      if (!accepted.some((item) => item.provider.executionMode === "live")) unprovenScope.push("live_provider_execution");
      if (models.length < 2) unprovenScope.push("cross_model_compatibility");
      unprovenScope.push("visual_quality_requires_human_review");
      return {
        skillId: entry.skillId,
        version: version.version,
        contentHash: version.contentHash,
        acceptedCaseCount: accepted.length,
        acceptedProjectCount: projects.size,
        providerModels: models,
        crossProjectReuseCount: Math.max(0, projects.size - 1),
        unprovenScope,
      };
    }));
}

export function evaluateDirectorSkillSystem(input: {
  fixtures: DirectorSkillEvaluationFixture[];
  cases: DirectorSkillCase[];
  registry?: DirectorSkillRegistry;
  generatedAt?: string;
}): DirectorSkillEvaluationReport {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const evaluated = input.fixtures.map(evaluateFixture);
  const fixtureResults = evaluated.map((item) => item.result);
  const positiveLike = fixtureResults.filter((item) => item.kind === "positive" || item.kind === "ambiguous" || item.kind === "conflict");
  const negative = fixtureResults.filter((item) => item.kind === "negative");
  const humanAccepted = input.cases.filter((item) => item.outcome === "accepted" && item.humanDecision?.decision === "accepted").length;
  const humanModified = input.cases.filter((item) => item.outcome === "modified").length;
  const humanRejected = input.cases.filter((item) => item.outcome === "rejected").length;
  const retryRequested = input.cases.filter((item) => item.outcome === "retry_requested").length;
  const failed = input.cases.filter((item) => item.outcome === "failed").length;
  const qaCases = input.cases.filter((item) => item.qa.status !== "not_run");
  const eligibleCases = input.cases.filter(directorSkillCaseSupportsPromotion);
  const rollbackReceipts = input.registry?.operationReceipts.filter((receipt) => receipt.applied && receipt.operation === "rollback") || [];
  const appliedRegistryOperations = input.registry?.operationReceipts.filter((receipt) => receipt.applied) || [];
  const acceptedProjectsBySkill = new Map<string, Set<string>>();
  for (const item of eligibleCases) {
    const key = `${item.skillId}@${item.skillVersion}`;
    const projects = acceptedProjectsBySkill.get(key) || new Set<string>();
    projects.add(item.projectId);
    acceptedProjectsBySkill.set(key, projects);
  }
  const crossProjectReuseCount = Array.from(acceptedProjectsBySkill.values()).reduce((sum, projects) => sum + Math.max(0, projects.size - 1), 0);
  const v1V2Comparisons = evaluated.map((item, index) => compareV1V2(input.fixtures[index], item.route));
  const trustedEvidence = trustedEvidenceSummaries(input.registry, input.cases);
  const reportWithoutHash = {
    schemaVersion: DIRECTOR_SKILL_EVALUATION_SCHEMA_VERSION as typeof DIRECTOR_SKILL_EVALUATION_SCHEMA_VERSION,
    reportId: `dser_${directorSkillContentHash({ fixtures: input.fixtures.map((fixture) => fixture.fixtureId), generatedAt }).slice(5)}`,
    fixtureResults,
    metrics: {
      routeHitRate: ratio(positiveLike.filter((item) => item.matchedExpectedPrimary).length, positiveLike.length),
      falseTriggerRate: ratio(negative.filter((item) => item.falseTrigger).length, negative.length),
      humanAccepted,
      humanModified,
      humanRejected,
      retryRequested,
      failed,
      qaPassRate: ratio(qaCases.filter((item) => item.qa.status === "pass").length, qaCases.length),
      rollbackRate: ratio(rollbackReceipts.length, appliedRegistryOperations.length),
      crossProjectReuseCount,
    },
    v1V2Comparisons,
    trustedEvidence,
    governance: {
      promotionEligibleCaseIds: eligibleCases.map((item) => item.caseId).sort(),
      excludedCaseIds: input.cases.filter((item) => !directorSkillCaseSupportsPromotion(item)).map((item) => item.caseId).sort(),
      rejectedRetryFailedCannotPromote: true as const,
      skillCannotAuthorizeExecution: true as const,
    },
    overallStatus: fixtureResults.every((item) => item.status === "pass") ? "pass" as const : "fail" as const,
    generatedAt,
  };
  return { ...reportWithoutHash, reportHash: directorSkillContentHash(reportWithoutHash) };
}
