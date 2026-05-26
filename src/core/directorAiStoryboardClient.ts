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

export async function requestDirectorAiStoryboardPlan(input: DirectorAiStoryboardPlanInput): Promise<DirectorAiStoryboardPlan> {
  const payload = await fetchRuntimeJson(directorAiStoryboardPlanEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!isRecord(payload) || payload.ok !== true) {
    const message = isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : "director_ai_storyboard_plan_failed";
    throw new Error(message);
  }
  const planSource = isRecord(payload.plan) ? payload.plan : payload;
  return normalizeDirectorAiStoryboardPlan(planSource);
}
