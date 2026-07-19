import {
  AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION,
  transitionAgentVideoGenerationJob,
  validateAgentVideoGenerationReviewResult,
  type AgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "../core/agentVideoProductionContract";
import {
  loadCurrentProjectAgentGenerationJobLedgerTextFromRuntime,
  saveCurrentProjectAgentGenerationJobLedgerTextToRuntime,
} from "../core/projectCurrentRuntimeClient";
import {
  readProjectVibeSidecarText,
  writeProjectVibeSidecarText,
  type ProjectVibeDraftTarget,
  type ProjectVibeSidecarTextResult,
} from "./projectVibeDraftStore";

export const projectAgentGenerationJobLedgerPath = ".vibe-runtime/agent-generation-job-ledger.json";
export const interruptedLocalExportError = "Local export was interrupted before atomic publish. Confirm export again to retry.";

export function interruptedLocalExportStagingPaths(job: AgentVideoGenerationJob): string[] {
  if (
    job.kind !== "export"
    || job.operation !== "execute"
    || job.executionMode !== "live"
    || job.providerId !== "local-exporter"
    || job.providerCalled
    || job.externalTaskId
    || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(job.jobId)
  ) return [];
  return [
    `exports/.vibe-staging/${job.jobId}`,
    `reports/exports/.vibe-staging/${job.jobId}`,
  ];
}

export type ProjectAgentGenerationJobLedgerOpenStatus =
  | "restored"
  | "missing"
  | "project_mismatch"
  | "root_mismatch"
  | "fact_hash_mismatch"
  | "invalid"
  | "unavailable"
  | "error";

export interface ProjectAgentGenerationJobLedgerIdentity {
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
}

export interface ProjectAgentGenerationJobLedgerOpenResult {
  ok: boolean;
  status: ProjectAgentGenerationJobLedgerOpenStatus;
  path: string;
  ledger?: AgentVideoGenerationJobLedger;
  errors: string[];
}

export function recoverInterruptedLocalExportJobs(
  ledger: AgentVideoGenerationJobLedger,
  options: { updatedBefore?: string } = {},
): {
  changed: boolean;
  ledger: AgentVideoGenerationJobLedger;
  jobs: AgentVideoGenerationJob[];
} {
  const updatedBefore = options.updatedBefore ? Date.parse(options.updatedBefore) : Number.POSITIVE_INFINITY;
  let nextLedger = ledger;
  const recoveredJobs: AgentVideoGenerationJob[] = [];
  for (const job of ledger.jobs) {
    if (
      job.kind !== "export"
      || job.operation !== "execute"
      || job.executionMode !== "live"
      || job.providerId !== "local-exporter"
      || job.status !== "running"
      || job.providerCalled
      || job.externalTaskId
      || Date.parse(job.updatedAt) >= updatedBefore
    ) continue;
    const updatedAt = new Date(Math.max(Date.parse(job.updatedAt) + 1, Date.parse(job.createdAt) + 1)).toISOString();
    const transitioned = transitionAgentVideoGenerationJob({
      ledger: nextLedger,
      jobId: job.jobId,
      status: "failed",
      generatedAt: updatedAt,
      providerCalled: false,
      error: interruptedLocalExportError,
    });
    if (!transitioned.ok || !transitioned.job) continue;
    nextLedger = transitioned.ledger;
    recoveredJobs.push(transitioned.job);
  }
  return {
    changed: recoveredJobs.length > 0,
    ledger: nextLedger,
    jobs: recoveredJobs,
  };
}

const jobKinds = new Set(["reference_generation", "video_submit", "export"]);
const jobStatuses = new Set(["staged", "confirmed", "running", "succeeded", "failed", "cancelled"]);
const executionModes = new Set(["dry_run", "live"]);
const jobOperations = new Set(["execute", "query"]);
const pipelineSteps = new Set(["new_video_draft", "confirm_story", "choose_save_location", "prepare_references", "submit_video", "export"]);
const legacyGenerationJobLedgerSchemaVersions = new Set([
  "agent_video_generation_job_ledger/0.2.0",
  "agent_video_generation_job_ledger/0.3.0",
  "agent_video_generation_job_ledger/0.4.0",
]);

export async function saveProjectAgentGenerationJobLedger(
  target: ProjectVibeDraftTarget,
  ledger: AgentVideoGenerationJobLedger,
): Promise<ProjectVibeSidecarTextResult> {
  const parsed = parseProjectAgentGenerationJobLedger(ledger);
  if (!parsed.ok) {
    return {
      ok: false,
      status: "error",
      targetId: target.storageKey || ledger.projectId,
      path: projectAgentGenerationJobLedgerPath,
      errors: parsed.errors,
    };
  }
  const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
  let runtimeWriteError: string | undefined;
  let runtimeWriteOk = false;
  let runtimeWritePath: string | undefined;
  if (target.projectRoot && !isBrowserDraftProjectRoot(target.projectRoot)) {
    try {
      const runtimeWrite = await saveCurrentProjectAgentGenerationJobLedgerTextToRuntime({
        projectId: ledger.projectId,
        projectRoot: target.projectRoot,
      }, serialized);
      if (runtimeWrite.ok) {
        runtimeWriteOk = true;
        runtimeWritePath = runtimeWrite.path || projectAgentGenerationJobLedgerPath;
      } else {
        runtimeWriteError = runtimeWrite.message || runtimeWrite.status;
      }
    } catch (error) {
      runtimeWriteError = error instanceof Error ? error.message : String(error);
    }
  }
  if (runtimeWriteOk) {
    return {
      ok: true,
      status: "written",
      targetId: target.storageKey || ledger.projectId,
      path: runtimeWritePath || projectAgentGenerationJobLedgerPath,
      content: serialized,
      errors: [],
    };
  }
  const writeResult = await writeProjectVibeSidecarText(target, projectAgentGenerationJobLedgerPath, serialized);
  if (!writeResult.ok && runtimeWriteError) {
    return { ...writeResult, errors: [runtimeWriteError, ...writeResult.errors] };
  }
  return writeResult;
}

export async function openProjectAgentGenerationJobLedger(
  target: ProjectVibeDraftTarget,
  identity: ProjectAgentGenerationJobLedgerIdentity,
): Promise<ProjectAgentGenerationJobLedgerOpenResult> {
  const runtimeRead = target.projectRoot && !isBrowserDraftProjectRoot(target.projectRoot)
    ? await loadCurrentProjectAgentGenerationJobLedgerTextFromRuntime({
      projectId: identity.projectId,
      projectRoot: target.projectRoot,
    })
    : undefined;
  const runtimeOpen = runtimeRead?.ok && runtimeRead.content != null
    ? openProjectAgentGenerationJobLedgerText(runtimeRead.content, identity, runtimeRead.path || projectAgentGenerationJobLedgerPath)
    : undefined;
  const sidecarRead = await readProjectVibeSidecarText(target, projectAgentGenerationJobLedgerPath);
  const sidecarOpen = sidecarRead.ok && sidecarRead.content != null
    ? openProjectAgentGenerationJobLedgerText(sidecarRead.content, identity, sidecarRead.path)
    : undefined;
  const restored = selectLatestRestoredLedger(runtimeOpen, sidecarOpen);
  if (restored) return restored;
  if (runtimeOpen) return runtimeOpen;
  if (sidecarOpen) return sidecarOpen;
  return {
    ok: false,
    status: sidecarRead.status === "unavailable"
      ? "unavailable"
      : sidecarRead.status === "missing"
        ? "missing"
        : "error",
    path: sidecarRead.path,
    errors: [runtimeRead?.message, ...sidecarRead.errors].filter((item): item is string => Boolean(item)),
  };
}

export function restoreProjectAgentGenerationJobLedger(
  value: unknown,
  identity: ProjectAgentGenerationJobLedgerIdentity,
  path = projectAgentGenerationJobLedgerPath,
): ProjectAgentGenerationJobLedgerOpenResult {
  const parsed = parseProjectAgentGenerationJobLedger(value);
  if (!parsed.ok || !parsed.ledger) {
    return { ok: false, status: "invalid", path, errors: parsed.errors };
  }
  const ledger = parsed.ledger;
  if (ledger.projectId !== identity.projectId) {
    return { ok: false, status: "project_mismatch", path, ledger, errors: ["Generation ledger belongs to another project."] };
  }
  if (normalizeProjectRoot(ledger.projectRoot) !== normalizeProjectRoot(identity.projectRoot)) {
    return { ok: false, status: "root_mismatch", path, ledger, errors: ["Generation ledger belongs to another project root."] };
  }
  if (ledger.projectFactHash !== identity.projectFactHash) {
    return { ok: false, status: "fact_hash_mismatch", path, ledger, errors: ["Project facts changed after generation jobs were recorded."] };
  }
  return { ok: true, status: "restored", path, ledger, errors: [] };
}

function openProjectAgentGenerationJobLedgerText(
  content: string,
  identity: ProjectAgentGenerationJobLedgerIdentity,
  path: string,
) {
  try {
    return restoreProjectAgentGenerationJobLedger(JSON.parse(content), identity, path);
  } catch (error) {
    return {
      ok: false,
      status: "invalid" as const,
      path,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function selectLatestRestoredLedger(
  ...results: Array<ProjectAgentGenerationJobLedgerOpenResult | undefined>
) {
  const restored = results.filter((result): result is ProjectAgentGenerationJobLedgerOpenResult => Boolean(result?.ok && result.ledger));
  if (!restored.length) return undefined;
  return restored.reduce((latest, result) => (
    timeValue(result.ledger?.updatedAt) > timeValue(latest.ledger?.updatedAt) ? result : latest
  ));
}

function parseProjectAgentGenerationJobLedger(value: unknown): {
  ok: boolean;
  ledger?: AgentVideoGenerationJobLedger;
  errors: string[];
} {
  if (!isRecord(value)) return { ok: false, errors: ["Generation ledger must be an object."] };
  const normalizedValue = migrateLegacyGenerationJobLedger(value);
  const errors: string[] = [];
  if (normalizedValue.schemaVersion !== AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION) errors.push("Unsupported generation ledger schema.");
  for (const key of ["ledgerId", "projectId", "projectFactHash", "createdAt", "updatedAt"] as const) {
    if (!textValue(normalizedValue[key])) errors.push(`Generation ledger is missing ${key}.`);
  }
  if (!dateValue(normalizedValue.createdAt)) errors.push("Generation ledger createdAt is invalid.");
  if (!dateValue(normalizedValue.updatedAt)) errors.push("Generation ledger updatedAt is invalid.");
  if (dateValue(normalizedValue.createdAt) && dateValue(normalizedValue.updatedAt) && Date.parse(textValue(normalizedValue.updatedAt)) < Date.parse(textValue(normalizedValue.createdAt))) {
    errors.push("Generation ledger updatedAt cannot precede createdAt.");
  }
  if (!Array.isArray(normalizedValue.jobs)) errors.push("Generation ledger jobs must be an array.");
  const jobs = Array.isArray(normalizedValue.jobs) ? normalizedValue.jobs : [];
  const jobIds = new Set<string>();
  const actionIds = new Set<string>();
  for (const job of jobs) {
    const jobErrors = validateJob(job, normalizedValue);
    errors.push(...jobErrors);
    if (!isRecord(job)) continue;
    const jobId = textValue(job.jobId);
    const actionId = textValue(job.actionId);
    if (jobId && jobIds.has(jobId)) errors.push(`Generation ledger repeats jobId ${jobId}.`);
    if (actionId && actionIds.has(actionId)) errors.push(`Generation ledger repeats actionId ${actionId}.`);
    if (jobId) jobIds.add(jobId);
    if (actionId) actionIds.add(actionId);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, ledger: normalizedValue as unknown as AgentVideoGenerationJobLedger, errors: [] };
}

function migrateLegacyGenerationJobLedger(value: Record<string, unknown>): Record<string, unknown> {
  const schemaVersion = textValue(value.schemaVersion);
  if (!legacyGenerationJobLedgerSchemaVersions.has(schemaVersion) || !Array.isArray(value.jobs)) return value;
  const conservativeP2Migration = schemaVersion === "agent_video_generation_job_ledger/0.2.0";
  return {
    ...value,
    schemaVersion: AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION,
    jobs: value.jobs.map((job) => isRecord(job)
      ? {
          ...job,
          operation: jobOperations.has(textValue(job.operation))
            ? job.operation
            : /query/i.test(textValue(job.actionId))
              ? "query"
              : "execute",
          executionMode: conservativeP2Migration
            ? "dry_run"
            : executionModes.has(textValue(job.executionMode)) ? job.executionMode : "dry_run",
          providerCalled: conservativeP2Migration
            ? false
            : typeof job.providerCalled === "boolean" ? job.providerCalled : false,
          statusHistory: Array.isArray(job.statusHistory) && job.statusHistory.length
            ? job.statusHistory
            : [
                { status: "staged", at: textValue(job.createdAt) || textValue(job.updatedAt) },
                ...(textValue(job.status) && textValue(job.status) !== "staged"
                  ? [{ status: job.status, at: textValue(job.updatedAt) || textValue(job.createdAt) }]
                  : []),
              ],
        }
      : job),
  };
}

function validateJob(job: unknown, ledger: Record<string, unknown>) {
  if (!isRecord(job)) return ["Generation job must be an object."];
  const errors: string[] = [];
  for (const key of ["jobId", "projectId", "projectRoot", "projectFactHash", "actionId", "sourceConfirmationId", "providerId", "modelId", "capability", "pipelineStep", "status", "createdAt", "updatedAt"] as const) {
    if (!textValue(job[key])) errors.push(`Generation job is missing ${key}.`);
  }
  if (!dateValue(job.createdAt)) errors.push("Generation job createdAt is invalid.");
  if (!dateValue(job.updatedAt)) errors.push("Generation job updatedAt is invalid.");
  if (dateValue(job.createdAt) && dateValue(job.updatedAt) && Date.parse(textValue(job.updatedAt)) < Date.parse(textValue(job.createdAt))) {
    errors.push("Generation job updatedAt cannot precede createdAt.");
  }
  if (!jobKinds.has(textValue(job.kind))) errors.push("Generation job kind is invalid.");
  if (!jobStatuses.has(textValue(job.status))) errors.push("Generation job status is invalid.");
  if (!jobOperations.has(textValue(job.operation))) errors.push("Generation job operation is invalid.");
  if (!executionModes.has(textValue(job.executionMode))) errors.push("Generation job executionMode is invalid.");
  if (typeof job.providerCalled !== "boolean") errors.push("Generation job providerCalled must be a boolean.");
  if (!pipelineSteps.has(textValue(job.pipelineStep))) errors.push("Generation job pipeline step is invalid.");
  if (!Array.isArray(job.inputAssets) || job.inputAssets.some((item) => typeof item !== "string")) errors.push("Generation job inputAssets must be a string array.");
  if (!Array.isArray(job.outputAssets) || job.outputAssets.some((item) => typeof item !== "string")) errors.push("Generation job outputAssets must be a string array.");
  if (job.externalTaskId != null && !textValue(job.externalTaskId)) errors.push("Generation job externalTaskId must be a non-empty string.");
  if (job.reviewResult != null) {
    if (!isRecord(job.reviewResult)) {
      errors.push("Generation job reviewResult must be an object.");
    } else {
      const reviewResult = job.reviewResult;
      const typedJob = job as unknown as AgentVideoGenerationJob;
      errors.push(...validateAgentVideoGenerationReviewResult(
        typedJob,
        reviewResult as unknown as AgentVideoGenerationJob["reviewResult"],
      ));
      if (textValue(job.status) !== "succeeded") errors.push("Generation job reviewResult requires a succeeded job.");
      if (!Array.isArray(job.outputAssets) || !job.outputAssets.some((path) => (
        typeof path === "string" && normalizeMediaPath(path) === normalizeMediaPath(textValue(reviewResult.outputPath))
      ))) errors.push("Generation job outputAssets must include its review result outputPath.");
    }
  }
  if (!Array.isArray(job.blockers) || job.blockers.some((item) => typeof item !== "string")) errors.push("Generation job blockers must be a string array.");
  const statusHistory = Array.isArray(job.statusHistory) ? job.statusHistory : [];
  if (!statusHistory.length) {
    errors.push("Generation job statusHistory must be a non-empty array.");
  } else {
    let previousAt = 0;
    for (const event of statusHistory) {
      if (!isRecord(event) || !jobStatuses.has(textValue(event.status)) || !dateValue(event.at)) {
        errors.push("Generation job statusHistory contains an invalid event.");
        continue;
      }
      const at = Date.parse(textValue(event.at));
      if (at < previousAt) errors.push("Generation job statusHistory must be chronological.");
      previousAt = at;
      if (event.error != null && typeof event.error !== "string") {
        errors.push("Generation job statusHistory error must be a string.");
      }
    }
    const firstEvent = statusHistory[0];
    const lastEvent = statusHistory[statusHistory.length - 1];
    if (!isRecord(firstEvent) || firstEvent.status !== "staged") {
      errors.push("Generation job statusHistory must start at staged.");
    }
    if (!isRecord(lastEvent) || textValue(lastEvent.status) !== textValue(job.status)) {
      errors.push("Generation job status does not match its final history event.");
    }
  }
  if (textValue(job.projectId) !== textValue(ledger.projectId)) errors.push("Generation job projectId does not match its ledger.");
  if (normalizeProjectRoot(textValue(job.projectRoot)) !== normalizeProjectRoot(textValue(ledger.projectRoot))) errors.push("Generation job projectRoot does not match its ledger.");
  if (textValue(job.projectFactHash) !== textValue(ledger.projectFactHash)) errors.push("Generation job projectFactHash does not match its ledger.");
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProjectRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

function normalizeMediaPath(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

function timeValue(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  const parsed = Date.parse(textValue(value));
  return Number.isFinite(parsed);
}

function isBrowserDraftProjectRoot(projectRoot?: string) {
  const normalized = projectRoot?.replace(/\\/g, "/").trim() || "";
  return normalized === ".vibe-runtime/browser-projects"
    || normalized.startsWith(".vibe-runtime/browser-projects/")
    || normalized.includes("/.vibe-runtime/browser-projects/");
}
