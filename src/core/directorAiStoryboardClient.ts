import {
  normalizeDirectorAiStoryboardPlan,
  type DirectorAiStoryboardPlan,
  type DirectorAiStoryboardPlanInput,
} from "./directorAiStoryboardPlanner";
import {
  fetchRuntimeJson,
  isRecord,
  projectRuntimeBasePath,
} from "./runtimeApiClient";

export const directorAiStoryboardPlanEndpoint = `${projectRuntimeBasePath}/director/storyboard-plan`;

export interface RequestDirectorAiStoryboardPlanOptions {
  timeoutMs?: number;
}

function timeoutSignal(timeoutMs?: number): AbortSignal | undefined {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

export async function requestDirectorAiStoryboardPlan(
  input: DirectorAiStoryboardPlanInput,
  options: RequestDirectorAiStoryboardPlanOptions = {},
): Promise<DirectorAiStoryboardPlan> {
  const payload = await fetchRuntimeJson(directorAiStoryboardPlanEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: timeoutSignal(options.timeoutMs),
  });
  if (!isRecord(payload) || payload.ok !== true) {
    const message = isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : "director_ai_storyboard_plan_failed";
    throw new Error(message);
  }
  const planSource = isRecord(payload.plan) ? payload.plan : payload;
  return normalizeDirectorAiStoryboardPlan(planSource, {
    targetDurationSeconds: input.targetDurationSeconds,
  });
}
