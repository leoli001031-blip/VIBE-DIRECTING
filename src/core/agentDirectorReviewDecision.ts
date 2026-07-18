export const AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION = "agent_director_review_identity/1.0.0" as const;

export interface AgentDirectorReviewIdentity {
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  jobId: string;
  actionId: string;
  shotId: string;
  sourceReceiptId: string;
  outputPath: string;
  outputHash: string;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAgentDirectorReviewProjectRoot(value: string) {
  return text(value)
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/private\/(tmp|var)(?=\/|$)/, "/$1")
    .replace(/\/+$/g, "");
}

export function normalizeAgentDirectorReviewOutputPath(value: string) {
  return text(value)
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/private\/(tmp|var)(?=\/|$)/, "/$1")
    .replace(/^\.\//, "")
    .replace(/\/+$/g, "");
}

export function normalizeAgentDirectorReviewOutputHash(value: string) {
  return text(value).toLowerCase();
}

function outputPathInsideProject(identity: AgentDirectorReviewIdentity) {
  const projectRoot = normalizeAgentDirectorReviewProjectRoot(identity.projectRoot);
  const outputPath = normalizeAgentDirectorReviewOutputPath(identity.outputPath);
  if (!projectRoot || !outputPath || /(?:^|\/)\.\.(?:\/|$)/.test(outputPath)) return false;
  if (/^(?:\/|[A-Za-z]:\/)/.test(outputPath)) return outputPath.startsWith(`${projectRoot}/`);
  return !outputPath.startsWith("~/") && !outputPath.startsWith("//");
}

function canonicalAgentDirectorReviewOutputPath(identity: AgentDirectorReviewIdentity) {
  const projectRoot = normalizeAgentDirectorReviewProjectRoot(identity.projectRoot);
  const outputPath = normalizeAgentDirectorReviewOutputPath(identity.outputPath);
  if (/^(?:\/|[A-Za-z]:\/)/.test(outputPath)) return outputPath;
  if (!projectRoot || outputPath === projectRoot || outputPath.startsWith(`${projectRoot}/`)) return outputPath;
  return normalizeAgentDirectorReviewOutputPath(`${projectRoot}/${outputPath}`);
}

export function validateAgentDirectorReviewIdentity(identity: AgentDirectorReviewIdentity) {
  const blockers = [
    text(identity.projectId) ? "" : "review_project_id_required",
    normalizeAgentDirectorReviewProjectRoot(identity.projectRoot) ? "" : "review_project_root_required",
    text(identity.projectFactHash) ? "" : "review_project_fact_hash_required",
    text(identity.jobId) ? "" : "review_job_id_required",
    text(identity.actionId) ? "" : "review_action_id_required",
    text(identity.shotId) ? "" : "review_shot_id_required",
    text(identity.sourceReceiptId) ? "" : "review_source_receipt_id_required",
    outputPathInsideProject(identity) ? "" : "review_output_path_outside_project",
    /^sha256:[a-f0-9]{64}$/i.test(text(identity.outputHash)) ? "" : "review_output_hash_invalid",
  ];
  return blockers.filter(Boolean);
}

export function agentDirectorReviewIdentityFromUnknown(value: unknown): AgentDirectorReviewIdentity | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return {
    projectId: text(record.projectId),
    projectRoot: text(record.projectRoot),
    projectFactHash: text(record.projectFactHash),
    jobId: text(record.jobId),
    actionId: text(record.actionId),
    shotId: text(record.shotId),
    sourceReceiptId: text(record.sourceReceiptId),
    outputPath: text(record.outputPath),
    outputHash: text(record.outputHash),
  };
}

export function agentDirectorReviewIdentityKey(identity: AgentDirectorReviewIdentity) {
  return [
    text(identity.projectId),
    normalizeAgentDirectorReviewProjectRoot(identity.projectRoot),
    text(identity.projectFactHash),
    text(identity.jobId),
    text(identity.actionId),
    text(identity.shotId),
    text(identity.sourceReceiptId),
    canonicalAgentDirectorReviewOutputPath(identity),
    normalizeAgentDirectorReviewOutputHash(identity.outputHash),
  ].join("::");
}

export function agentDirectorReviewIdentityMatches(
  left: AgentDirectorReviewIdentity | undefined,
  right: AgentDirectorReviewIdentity | undefined,
) {
  return Boolean(
    left
      && right
      && validateAgentDirectorReviewIdentity(left).length === 0
      && validateAgentDirectorReviewIdentity(right).length === 0
      && agentDirectorReviewIdentityKey(left) === agentDirectorReviewIdentityKey(right),
  );
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

export function agentDirectorReviewReceiptId(identity: AgentDirectorReviewIdentity) {
  return `review_agent_video_${safeId(identity.shotId, "shot")}_${stableId(agentDirectorReviewIdentityKey(identity))}`;
}

export function agentDirectorApprovedReviewReceiptMatchesIdentity(
  value: unknown,
  identity: AgentDirectorReviewIdentity,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  if (
    receipt.decisionScope !== "agent_video_preview"
    || receipt.status !== "approved"
    || receipt.humanReviewed !== true
    || receipt.promotionAuthorized !== false
    || text(receipt.id) !== agentDirectorReviewReceiptId(identity)
  ) return false;
  return agentDirectorReviewIdentityMatches(agentDirectorReviewIdentityFromUnknown(receipt), identity);
}

export function agentDirectorReviewRevisionIntentId(identity: AgentDirectorReviewIdentity) {
  return `revision_agent_video_${safeId(identity.shotId, "shot")}_${stableId(agentDirectorReviewIdentityKey(identity))}`;
}
