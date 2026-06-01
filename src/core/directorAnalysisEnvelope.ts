import { createHash } from "node:crypto";
import {
  DIRECTOR_RHYTHM_PROFILE_LABELS,
  planDirectorRhythm,
  type CreativeBrief,
  type DirectorActionDensity,
  type DirectorRhythmPlan,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";
import { buildStoryboardDirectorPlan, type StoryboardDirectorPlan } from "./storyboardReferencePipeline";

export const DIRECTOR_ANALYSIS_ENVELOPE_VERSION = "director_analysis_envelope_v1";

const rhythmProfiles = new Set<DirectorRhythmProfile>(Object.keys(DIRECTOR_RHYTHM_PROFILE_LABELS) as DirectorRhythmProfile[]);
const splitPolicies = new Set<DirectorSplitPolicy>([
  "hold_single_shot",
  "split_for_reaction",
  "split_for_action",
  "montage_sequence",
]);
const actionDensities = new Set<DirectorActionDensity>(["low", "medium", "high"]);

export interface DirectorAnalysisShotInput {
  id: string;
  title?: string;
  intent?: string;
  camera?: string;
  durationSeconds?: number;
  executionMode?: string;
  actionBeats?: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  actorAction?: string;
  reactorResponse?: string;
}

export interface DirectorAnalysisLlmCandidateShot {
  shotId: string;
  rhythmProfile?: string;
  rhythmReason?: string;
  actionDensity?: string;
  splitPolicy?: string;
  durationSeconds?: number;
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  actionBeats?: string[];
  confidence?: number;
}

export interface DirectorAnalysisLlmCandidate {
  narrativeGoal?: string;
  globalRhythmProfile?: string;
  directorNotes?: string[];
  shots?: DirectorAnalysisLlmCandidateShot[];
}

export interface DirectorAnalysisEnvelopeInput {
  projectId?: string;
  scriptText: string;
  userPreference?: string;
  creativeBrief?: CreativeBrief;
  shots: DirectorAnalysisShotInput[];
  llmCandidate?: DirectorAnalysisLlmCandidate;
  generatedAt?: string;
}

export interface DirectorAnalysisTaskEnvelope {
  envelopeId: string;
  taskKind: "director_analysis";
  source: "validated_story_context";
  inputHash: string;
  expectedOutput: "structured_director_analysis";
  requiredFields: string[];
  forbiddenActions: string[];
  status: "valid" | "blocked";
}

export interface DirectorAnalysisShotResult {
  shotId: string;
  shotTitle: string;
  source: "llm_candidate_validated" | "heuristic_fallback";
  candidateAccepted: boolean;
  validationWarnings: string[];
  rhythmPlan: DirectorRhythmPlan;
  directorPlan: StoryboardDirectorPlan;
}

export interface DirectorAnalysisEnvelope {
  schemaVersion: typeof DIRECTOR_ANALYSIS_ENVELOPE_VERSION;
  envelopeId: string;
  projectId?: string;
  generatedAt: string;
  // providerCalled is a placeholder for when a real provider is eventually called; remains false under current strict-no-provider policy
  providerCalled: false;
  runtimeExternalNetworkCallMade: false;
  taskEnvelope: DirectorAnalysisTaskEnvelope;
  narrativeGoal: string;
  directorNotes: string[];
  shots: DirectorAnalysisShotResult[];
  blocked: boolean;
  blockers: string[];
  warnings: string[];
  hardLocks: {
    noProviderSubmit: true;
    noCredentialAccess: true;
    noFileMutation: true;
    noFreeTextPromotion: true;
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanLines(lines: Array<string | undefined | false>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function stableHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function safeNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : undefined;
}

function clampConfidence(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(1, parsed));
}

function validRhythmProfile(value: unknown): DirectorRhythmProfile | undefined {
  const normalized = clean(value);
  return rhythmProfiles.has(normalized as DirectorRhythmProfile) ? normalized as DirectorRhythmProfile : undefined;
}

function validSplitPolicy(value: unknown): DirectorSplitPolicy | undefined {
  const normalized = clean(value);
  return splitPolicies.has(normalized as DirectorSplitPolicy) ? normalized as DirectorSplitPolicy : undefined;
}

function validActionDensity(value: unknown): DirectorActionDensity | undefined {
  const normalized = clean(value);
  return actionDensities.has(normalized as DirectorActionDensity) ? normalized as DirectorActionDensity : undefined;
}

function shotTitle(shot: DirectorAnalysisShotInput): string {
  return clean(shot.title) || shot.id;
}

function shotIntent(shot: DirectorAnalysisShotInput): string {
  return clean(shot.intent) || "按当前镜头意图完成动作、站位、节奏和构图。";
}

function shotCamera(shot: DirectorAnalysisShotInput): string {
  return clean(shot.camera) || "按导演节奏选择景别、角度和呼吸感运镜。";
}

function candidateForShot(candidate: DirectorAnalysisLlmCandidate | undefined, shotId: string): DirectorAnalysisLlmCandidateShot | undefined {
  return candidate?.shots?.find((shot) => clean(shot.shotId) === shotId);
}

function rhythmPlanForShot(
  input: DirectorAnalysisEnvelopeInput,
  shot: DirectorAnalysisShotInput,
  candidate: DirectorAnalysisLlmCandidateShot | undefined,
): { plan: DirectorRhythmPlan; accepted: boolean; warnings: string[] } {
  const inferred = planDirectorRhythm({
    scriptText: input.scriptText,
    shotText: cleanLines([
      shot.title,
      shot.intent,
      shot.camera,
      shot.primaryAction,
      shot.actionTrigger,
      shot.microReaction,
      shot.actorAction,
      shot.reactorResponse,
      ...(shot.actionBeats || []),
    ]),
    userPreference: input.userPreference,
    creativeBrief: input.creativeBrief,
    durationSeconds: shot.durationSeconds,
  });
  const warnings: string[] = [];
  if (!candidate) return { plan: inferred, accepted: false, warnings: ["llm_candidate_missing_for_shot"] };

  const rhythmProfile = validRhythmProfile(candidate.rhythmProfile);
  const splitPolicy = validSplitPolicy(candidate.splitPolicy);
  const actionDensity = validActionDensity(candidate.actionDensity);
  const confidence = clampConfidence(candidate.confidence);

  if (candidate.rhythmProfile && !rhythmProfile) warnings.push(`invalid_rhythm_profile:${candidate.rhythmProfile}`);
  if (candidate.splitPolicy && !splitPolicy) warnings.push(`invalid_split_policy:${candidate.splitPolicy}`);
  if (candidate.actionDensity && !actionDensity) warnings.push(`invalid_action_density:${candidate.actionDensity}`);
  if (confidence !== undefined && confidence < 0.55) warnings.push("llm_candidate_low_confidence");

  const accepted = Boolean(rhythmProfile || splitPolicy || actionDensity || clean(candidate.rhythmReason));
  return {
    accepted,
    warnings,
    plan: {
      ...inferred,
      rhythmProfile: rhythmProfile || inferred.rhythmProfile,
      rhythmReason: clean(candidate.rhythmReason) || inferred.rhythmReason,
      actionDensity: actionDensity || inferred.actionDensity,
      splitPolicy: splitPolicy || inferred.splitPolicy,
      userFacingLabel: DIRECTOR_RHYTHM_PROFILE_LABELS[rhythmProfile || inferred.rhythmProfile],
    },
  };
}

function directorPlanForShot(
  input: DirectorAnalysisEnvelopeInput,
  shot: DirectorAnalysisShotInput,
  rhythmPlan: DirectorRhythmPlan,
  candidate: DirectorAnalysisLlmCandidateShot | undefined,
): StoryboardDirectorPlan {
  return buildStoryboardDirectorPlan({
    shotId: shot.id,
    shotTitle: shotTitle(shot),
    durationSeconds: safeNumber(candidate?.durationSeconds) || shot.durationSeconds,
    executionMode: shot.executionMode,
    creativeBrief: input.creativeBrief,
    userPreference: input.userPreference,
    rhythmPlan,
    camera: shotCamera(shot),
    frameDescription: shotIntent(shot),
    actionBeats: candidate?.actionBeats?.map(clean).filter(Boolean) || shot.actionBeats,
    primaryAction: clean(candidate?.primaryAction) || shot.primaryAction,
    actionTrigger: clean(candidate?.actionTrigger) || shot.actionTrigger,
    microReaction: clean(candidate?.microReaction) || shot.microReaction,
    actorAction: shot.actorAction,
    reactorResponse: shot.reactorResponse,
  });
}

export function buildDirectorAnalysisEnvelope(input: DirectorAnalysisEnvelopeInput): DirectorAnalysisEnvelope {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const inputHash = stableHash({
    projectId: input.projectId,
    scriptText: input.scriptText,
    userPreference: input.userPreference,
    creativeBrief: input.creativeBrief,
    shots: input.shots,
    llmCandidate: input.llmCandidate,
  });
  const envelopeId = `director_analysis_${inputHash.slice(-12)}`;
  const blockers = [
    clean(input.scriptText) ? "" : "script_text_required",
    input.shots.length ? "" : "at_least_one_shot_required",
  ].filter(Boolean);

  const shots = input.shots.map((shot): DirectorAnalysisShotResult => {
    const candidate = candidateForShot(input.llmCandidate, shot.id);
    const rhythm = rhythmPlanForShot(input, shot, candidate);
    return {
      shotId: shot.id,
      shotTitle: shotTitle(shot),
      source: rhythm.accepted ? "llm_candidate_validated" : "heuristic_fallback",
      candidateAccepted: rhythm.accepted,
      validationWarnings: rhythm.warnings,
      rhythmPlan: rhythm.plan,
      directorPlan: directorPlanForShot(input, shot, rhythm.plan, candidate),
    };
  });
  const warnings = [
    ...(input.llmCandidate ? [] : ["llm_candidate_absent_using_heuristic_fallback"]),
    ...shots.flatMap((shot) => shot.validationWarnings.map((warning) => `${shot.shotId}:${warning}`)),
  ];

  return {
    schemaVersion: DIRECTOR_ANALYSIS_ENVELOPE_VERSION,
    envelopeId,
    projectId: input.projectId,
    generatedAt,
    providerCalled: false,
    runtimeExternalNetworkCallMade: false,
    taskEnvelope: {
      envelopeId,
      taskKind: "director_analysis",
      source: "validated_story_context",
      inputHash,
      expectedOutput: "structured_director_analysis",
      requiredFields: ["rhythmProfile", "splitPolicy", "primaryAction", "actionTrigger", "microReaction"],
      forbiddenActions: ["provider_submit", "credential_access", "file_mutation", "free_text_promotion"],
      status: blockers.length ? "blocked" : "valid",
    },
    narrativeGoal: clean(input.llmCandidate?.narrativeGoal) || "根据脚本判断每个镜头的节奏、主动作、触发原因和微反应。",
    directorNotes: (input.llmCandidate?.directorNotes || []).map(clean).filter(Boolean),
    shots,
    blocked: blockers.length > 0,
    blockers,
    warnings,
    hardLocks: {
      noProviderSubmit: true,
      noCredentialAccess: true,
      noFileMutation: true,
      noFreeTextPromotion: true,
    },
  };
}
