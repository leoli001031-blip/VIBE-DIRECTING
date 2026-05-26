import type { ToolContext } from "./toolRegistry";
import type { DirectorPrototypeClosedLoopInput } from "./directorPrototypeTypes";
import type { ProjectVibeDocument, ProjectVibeShot } from "../project";
import type { ProviderId } from "../providers";

export interface DirectorAgentPlan {
  project: ProjectVibeDocument;
  userIntent: string;
  selectedShot: ProjectVibeShot;
  selectedShotId: string;
  createdAt: string;
  runId: string;
  requestId: string;
  outputPath: string;
  providerId: ProviderId;
  prompt: string;
  userPrompt: string;
  sessionId: string;
}

export function createDirectorAgentPlan(input: DirectorPrototypeClosedLoopInput): DirectorAgentPlan {
  const selectedShot = input.project.shots.find((shot) => shot.id === input.selectedShotId);
  if (!selectedShot) {
    throw new Error(`Selected shot not found in Project.vibe: ${input.selectedShotId}`);
  }

  const createdAt = input.now ?? new Date().toISOString();
  const runId = input.runId ?? `run_director_prototype_${compactId(createdAt)}`;
  const requestId = `req_${runId}_${selectedShot.id}`;
  const outputPath = normalizeProjectRelativePath(`runs/prototype-agent/${runId}/${selectedShot.id}/preview.png`);
  const providerId = input.providerId ?? "image2";
  const prompt = buildDirectorPrototypePrompt(input.project, input.userIntent, selectedShot.id);

  return {
    project: input.project,
    userIntent: input.userIntent,
    selectedShot,
    selectedShotId: selectedShot.id,
    createdAt,
    runId,
    requestId,
    outputPath,
    providerId,
    prompt,
    userPrompt: `Run the mock-only provider closed loop for ${selectedShot.id}. Intent: ${input.userIntent}`,
    sessionId: input.sessionId ?? `${runId}_session`,
  };
}

export function createDirectorAgentToolContext(plan: DirectorAgentPlan): ToolContext {
  return {
    taskEnvelope: {
      id: plan.runId,
      kind: "director_prototype_closed_loop",
      selectedShotId: plan.selectedShotId,
      userIntent: plan.userIntent,
      sourceOfTruth: "project_vibe",
    },
    sandboxRoot: "project_root",
    sessionId: plan.sessionId,
  };
}

export function buildDirectorPrototypePrompt(
  project: ProjectVibeDocument,
  userIntent: string,
  selectedShotId: string,
): string {
  const shot = project.shots.find((item) => item.id === selectedShotId);
  const assetNotes = project.assets
    .filter((asset) => shot && [...shot.sceneAssetIds, ...shot.characterAssetIds, ...shot.propAssetIds].includes(asset.id))
    .map((asset) => `${asset.label}: ${asset.textConstraints.join(", ")}`)
    .join("; ");

  return [
    `User intent: ${userIntent}`,
    shot ? `Selected shot: ${shot.title}. ${shot.intent}` : `Selected shot: ${selectedShotId}`,
    assetNotes ? `Locked visual facts: ${assetNotes}` : "Locked visual facts: none",
  ].join("\n");
}

export function normalizeProjectRelativePath(path: string): string {
  if (path.startsWith("/") || path.startsWith("~/") || /^[A-Za-z]:[\\/]/.test(path) || path.includes("..")) {
    throw new Error(`Preview output path must be project-root-relative: ${path}`);
  }
  return path.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function compactId(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
