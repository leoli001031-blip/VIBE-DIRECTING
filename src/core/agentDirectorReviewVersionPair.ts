import {
  agentVideoGenerationReviewResultMatchesJob,
  type AgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "./agentVideoProductionContract";
import {
  agentDirectorReviewIdentityKey,
  normalizeAgentDirectorReviewOutputHash,
  normalizeAgentDirectorReviewOutputPath,
  normalizeAgentDirectorReviewProjectRoot,
  validateAgentDirectorReviewIdentity,
  type AgentDirectorReviewIdentity,
} from "./agentDirectorReviewDecision";

export const AGENT_DIRECTOR_REVIEW_VERSION_PAIR_SCHEMA_VERSION = "agent_director_review_version_pair/1.0.0" as const;

export type AgentDirectorReviewVersion = "A" | "B";

export interface AgentDirectorReviewVersionCandidate {
  version: AgentDirectorReviewVersion;
  identity: AgentDirectorReviewIdentity;
  receivedAt: string;
}

export interface AgentDirectorReviewVersionPair {
  schemaVersion: typeof AGENT_DIRECTOR_REVIEW_VERSION_PAIR_SCHEMA_VERSION;
  pairId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  candidateA: AgentDirectorReviewVersionCandidate;
  candidateB: AgentDirectorReviewVersionCandidate;
  status: "needs_review";
  originalCandidatesPreserved: true;
  providerCalled: false;
  createdAt: string;
}

export interface AgentDirectorReviewVersionPairResult {
  status: "ready" | "missing" | "blocked";
  pair?: AgentDirectorReviewVersionPair;
  blockers: string[];
}

export interface AgentDirectorReviewVersionPairProjectIdentity {
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function timeValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeId(value: string, fallback: string) {
  return text(value).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function identityFromJob(job: AgentVideoGenerationJob): AgentDirectorReviewIdentity | undefined {
  const result = job.reviewResult;
  if (!result) return undefined;
  return {
    projectId: result.projectId,
    projectRoot: result.projectRoot,
    projectFactHash: result.projectFactHash,
    jobId: result.jobId,
    actionId: result.actionId,
    shotId: result.shotId,
    sourceReceiptId: result.sourceReceiptId,
    outputPath: result.outputPath,
    outputHash: result.outputHash,
  };
}

function projectMatches(
  job: AgentVideoGenerationJob,
  identity: AgentDirectorReviewVersionPairProjectIdentity,
) {
  return job.projectId === text(identity.projectId)
    && normalizeAgentDirectorReviewProjectRoot(job.projectRoot)
      === normalizeAgentDirectorReviewProjectRoot(identity.projectRoot || "")
    && job.projectFactHash === text(identity.projectFactHash);
}

function candidatePairBlockers(
  candidateA: AgentDirectorReviewVersionCandidate,
  candidateB: AgentDirectorReviewVersionCandidate,
) {
  const left = candidateA.identity;
  const right = candidateB.identity;
  return [
    left.jobId === right.jobId ? "review_version_pair_job_id_not_distinct" : "",
    left.actionId === right.actionId ? "review_version_pair_action_id_not_distinct" : "",
    left.sourceReceiptId === right.sourceReceiptId ? "review_version_pair_receipt_id_not_distinct" : "",
    normalizeAgentDirectorReviewOutputPath(left.outputPath) === normalizeAgentDirectorReviewOutputPath(right.outputPath)
      ? "review_version_pair_output_path_not_distinct"
      : "",
    normalizeAgentDirectorReviewOutputHash(left.outputHash) === normalizeAgentDirectorReviewOutputHash(right.outputHash)
      ? "review_version_pair_output_hash_not_distinct"
      : "",
  ].filter(Boolean);
}

function versionCandidate(
  version: AgentDirectorReviewVersion,
  job: AgentVideoGenerationJob,
): AgentDirectorReviewVersionCandidate | undefined {
  const identity = identityFromJob(job);
  if (!identity || validateAgentDirectorReviewIdentity(identity).length) return undefined;
  return {
    version,
    identity,
    receivedAt: job.reviewResult!.receivedAt,
  };
}

export function agentDirectorReviewVersionPairCandidate(
  pair: AgentDirectorReviewVersionPair,
  version: AgentDirectorReviewVersion,
) {
  return version === "A" ? pair.candidateA : pair.candidateB;
}

export function buildAgentDirectorReviewVersionPair(input: {
  ledger?: AgentVideoGenerationJobLedger;
  identity: AgentDirectorReviewVersionPairProjectIdentity;
  shotId?: string;
}): AgentDirectorReviewVersionPairResult {
  const projectId = text(input.identity.projectId);
  const projectRoot = normalizeAgentDirectorReviewProjectRoot(input.identity.projectRoot || "");
  const projectFactHash = text(input.identity.projectFactHash);
  if (!projectId || !projectRoot || !projectFactHash) {
    return { status: "blocked", blockers: ["review_version_pair_project_identity_incomplete"] };
  }
  if (!input.ledger) return { status: "missing", blockers: [] };
  if (
    input.ledger.projectId !== projectId
    || normalizeAgentDirectorReviewProjectRoot(input.ledger.projectRoot || "") !== projectRoot
    || input.ledger.projectFactHash !== projectFactHash
  ) {
    return { status: "blocked", blockers: ["review_version_pair_ledger_identity_mismatch"] };
  }

  const requestedShotId = text(input.shotId);
  const relevantJobs = input.ledger.jobs.filter((job) => (
    job.kind === "video_submit"
    && job.status === "succeeded"
    && projectMatches(job, input.identity)
    && (!requestedShotId || job.reviewResult?.shotId === requestedShotId)
  ));
  const invalidRelevantJobs = relevantJobs.filter((job) => !agentVideoGenerationReviewResultMatchesJob(job));
  if (invalidRelevantJobs.length) {
    return { status: "blocked", blockers: ["review_version_pair_candidate_identity_invalid"] };
  }

  const groups = new Map<string, AgentVideoGenerationJob[]>();
  for (const job of relevantJobs) {
    const shotId = text(job.reviewResult?.shotId);
    if (!shotId) continue;
    const current = groups.get(shotId) || [];
    current.push(job);
    groups.set(shotId, current);
  }
  const eligibleGroups = Array.from(groups.entries())
    .filter(([, jobs]) => jobs.length >= 2)
    .map(([shotId, jobs]) => ({
      shotId,
      jobs: [...jobs].sort((left, right) => (
        timeValue(left.reviewResult!.receivedAt) - timeValue(right.reviewResult!.receivedAt)
        || left.jobId.localeCompare(right.jobId)
      )),
    }))
    .sort((left, right) => {
      const leftLatest = left.jobs.at(-1)?.reviewResult?.receivedAt || "";
      const rightLatest = right.jobs.at(-1)?.reviewResult?.receivedAt || "";
      return timeValue(rightLatest) - timeValue(leftLatest) || left.shotId.localeCompare(right.shotId);
    });
  const selectedGroup = eligibleGroups[0];
  if (!selectedGroup) return { status: "missing", blockers: [] };

  const pairJobs = selectedGroup.jobs.slice(-2);
  const candidateA = versionCandidate("A", pairJobs[0]!);
  const candidateB = versionCandidate("B", pairJobs[1]!);
  if (!candidateA || !candidateB) {
    return { status: "blocked", blockers: ["review_version_pair_candidate_identity_invalid"] };
  }
  const blockers = candidatePairBlockers(candidateA, candidateB);
  if (blockers.length) return { status: "blocked", blockers };

  const pairKey = [
    projectId,
    projectRoot,
    projectFactHash,
    selectedGroup.shotId,
    agentDirectorReviewIdentityKey(candidateA.identity),
    agentDirectorReviewIdentityKey(candidateB.identity),
  ].join("::");
  return {
    status: "ready",
    blockers: [],
    pair: {
      schemaVersion: AGENT_DIRECTOR_REVIEW_VERSION_PAIR_SCHEMA_VERSION,
      pairId: `review_pair_${safeId(selectedGroup.shotId, "shot")}_${stableId(pairKey)}`,
      projectId,
      projectRoot,
      projectFactHash,
      shotId: selectedGroup.shotId,
      candidateA,
      candidateB,
      status: "needs_review",
      originalCandidatesPreserved: true,
      providerCalled: false,
      createdAt: candidateB.receivedAt,
    },
  };
}

export function agentDirectorReviewVersionPairMatchesProject(
  pair: AgentDirectorReviewVersionPair | undefined,
  identity: AgentDirectorReviewVersionPairProjectIdentity,
) {
  return Boolean(
    pair
      && pair.projectId === text(identity.projectId)
      && normalizeAgentDirectorReviewProjectRoot(pair.projectRoot)
        === normalizeAgentDirectorReviewProjectRoot(identity.projectRoot || "")
      && pair.projectFactHash === text(identity.projectFactHash),
  );
}
