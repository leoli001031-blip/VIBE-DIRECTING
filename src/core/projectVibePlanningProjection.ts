import type { ScriptPlannerResult } from "./scriptPlanner";
import type { GenerationJob, KeyframePairDerivation, ShotRecord, VideoControlMode } from "./types";
import type { ProjectVibeAsset, ProjectVibeDocument, ProjectVibeShot, ProjectVibeStorySection } from "../project/types";

export const projectVibePlanningProjectionSchemaVersion = "0.1.0";

export interface ProjectVibePlanningProjectionShot {
  shot: ShotRecord;
  jobs: GenerationJob[];
  keyframePair?: KeyframePairDerivation;
}

export interface ProjectVibePlanningProjection {
  schemaVersion: typeof projectVibePlanningProjectionSchemaVersion;
  projectId: string;
  generatedAt: string;
  source: "project_vibe" | "script_planner";
  shots: ProjectVibePlanningProjectionShot[];
  jobs: GenerationJob[];
  keyframePairs: KeyframePairDerivation[];
}

export interface BuildProjectVibePlanningProjectionInput {
  project?: Pick<ProjectVibeDocument, "manifest" | "storyFlow" | "shots"> & Partial<Pick<ProjectVibeDocument, "assets">>;
  scriptPlannerResult?: ScriptPlannerResult;
  generatedAt?: string;
}

interface ProjectionShotSource {
  shot: ProjectVibeShot;
  section?: ProjectVibeStorySection;
  sequenceIndex: number;
  projectId: string;
  assets?: ProjectVibeAsset[];
}

function safePathId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_") || "shot";
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function framePath(projectId: string, shotId: string, role: "start" | "end"): string {
  return `planned/keyframes/${safePathId(projectId)}/${safePathId(shotId)}_${role}.png`;
}

function sourceRefPath(sourceRefs: string[], prefixes: string[]): string | undefined {
  for (const prefix of prefixes) {
    const match = sourceRefs.find((ref) => ref.startsWith(prefix));
    const value = match?.slice(prefix.length).trim();
    if (value) return value;
  }
  return undefined;
}

function framePathForShot(projectId: string, shot: ProjectVibeShot, role: "start" | "end"): string {
  const sourcePath = role === "start"
    ? sourceRefPath(shot.sourceRefs, ["start-frame:", "source_start_frame:"])
    : sourceRefPath(shot.sourceRefs, ["end-frame:", "source_end_frame:"]);
  return sourcePath || framePath(projectId, shot.id, role);
}

function videoControlModeForShot(shot: ProjectVibeShot): VideoControlMode {
  return shot.videoControlMode || "first_frame_default";
}

function requiresEndpointEndFrame(shot: ProjectVibeShot): boolean {
  return videoControlModeForShot(shot) === "first_last_endpoint";
}

function lockedStyleReferencesForShot(shot: ProjectVibeShot, assets: ProjectVibeAsset[] = []): string[] {
  return assets
    .filter((asset) => asset.kind === "style" && asset.status === "locked")
    .filter((asset) => asset.usedByShotIds.length === 0 || asset.usedByShotIds.includes(shot.id))
    .map((asset) => asset.id);
}

function referencesForShot(shot: ProjectVibeShot, assets: ProjectVibeAsset[] = []): string[] {
  return uniqueSorted([
    ...shot.characterAssetIds,
    ...shot.sceneAssetIds,
    ...shot.propAssetIds,
    ...lockedStyleReferencesForShot(shot, assets),
  ]);
}

function sourceStartFrameReference(projectId: string, shot: ProjectVibeShot): string {
  return `source_start_frame:${framePathForShot(projectId, shot, "start")}`;
}

function actIdForSequence(sequenceIndex: number): string {
  return `A${sequenceIndex + 1}`;
}

function plannedShotStatus(shot: ProjectVibeShot): ShotRecord["status"] {
  if (shot.status === "blocked") return "blocked";
  if (shot.status === "generated") return "keyframe_pair_ready";
  if (shot.status === "ready") return "assets_ready";
  return "queued";
}

function hasStoryIntent(shot: ProjectVibeShot): boolean {
  return Boolean(shot.intent.trim() || shot.title.trim());
}

function shotRecordFromSource(source: ProjectionShotSource): ShotRecord {
  const startFrame = framePathForShot(source.projectId, source.shot, "start");
  const videoControlMode = videoControlModeForShot(source.shot);
  const hasCharacter = source.shot.characterAssetIds.length > 0;
  const hasScene = source.shot.sceneAssetIds.length > 0;
  const hasProp = source.shot.propAssetIds.length > 0;
  const blocked = source.shot.status === "blocked";

  return {
    id: source.shot.id,
    actId: actIdForSequence(source.section?.sequenceIndex ?? source.sequenceIndex),
    sectionId: source.shot.sectionId,
    title: source.shot.title,
    storyFunction: source.shot.intent || source.section?.summary || source.shot.title,
    narrationText: source.shot.narrationText,
    dialogueLines: source.shot.dialogueLines,
    subtitle: source.shot.subtitle,
    sound: source.shot.sound,
    audioUsage: source.shot.audioUsage,
    videoControlMode,
    startFrame,
    status: plannedShotStatus(source.shot),
    gates: {
      identity: hasCharacter ? "PASS" : "UNKNOWN",
      scene: hasScene ? "PASS" : "UNKNOWN",
      pair: blocked ? "FAIL" : "PASS",
      story: hasStoryIntent(source.shot) ? "PASS" : "UNKNOWN",
      prop: hasProp ? "PASS" : "N/A",
      style: "UNKNOWN",
    },
    camera: source.shot.camera,
    executionMode: source.shot.executionMode,
    rhythmProfile: source.shot.rhythmProfile,
    splitPolicy: source.shot.splitPolicy,
    actionBeats: source.shot.actionBeats,
    primaryAction: source.shot.primaryAction,
    actionTrigger: source.shot.actionTrigger,
    microReaction: source.shot.microReaction,
    seedanceDirection: source.shot.seedanceDirection,
    directorFeedbackDirectives: source.shot.directorFeedbackDirectives,
    characterGuidance: source.shot.characterGuidance,
    sceneGuidance: source.shot.sceneGuidance,
    propGuidance: source.shot.propGuidance,
    durationSeconds: source.shot.durationSeconds,
    sourceRefs: source.shot.sourceRefs,
    issues: [
      ...(!hasStoryIntent(source.shot) ? ["missing_story_intent"] : []),
      ...(blocked ? ["project_vibe_shot_blocked"] : []),
    ],
  };
}

function jobForShot(input: {
  shot: ProjectVibeShot;
  projectId: string;
  assets?: ProjectVibeAsset[];
  role: "start" | "end";
}): GenerationJob {
  const baseId = safePathId(`${input.shot.id}_${input.role}`);
  const references = referencesForShot(input.shot, input.assets);
  if (input.role === "start") {
    return {
      id: `project_vibe_${baseId}_image_start`,
      slot: "image.generate",
      requiredMode: "text2image",
      providerId: "lanyi-image2",
      status: input.shot.status === "blocked" ? "blocked" : "planned",
      outputPath: framePathForShot(input.projectId, input.shot, "start"),
      references,
      issues: [
        `project_vibe_shot_intent:${input.shot.intent}`,
        "project_level_projection:start_frame",
      ],
    };
  }
  if (input.role === "end") {
    const sourceStartFrame = sourceStartFrameReference(input.projectId, input.shot);
    return {
      id: `project_vibe_${baseId}_image_end`,
      slot: "image.edit",
      requiredMode: "image2image",
      providerId: "lanyi-image2",
      status: input.shot.status === "blocked" ? "blocked" : "planned",
      outputPath: framePathForShot(input.projectId, input.shot, "end"),
      references: uniqueSorted([...references, sourceStartFrame]),
      issues: [
        `project_vibe_shot_intent:${input.shot.intent}`,
        "project_level_projection:end_frame_from_start",
      ],
    };
  }

  throw new Error(`Unsupported Project.vibe planning role: ${input.role}`);
}

function keyframePairForShot(projectId: string, shot: ProjectVibeShot): KeyframePairDerivation {
  return {
    shotId: shot.id,
    startFrameId: framePathForShot(projectId, shot, "start"),
    endFrameId: framePathForShot(projectId, shot, "end"),
    endDerivationSource: shot.status === "blocked" ? "unknown" : "start_frame",
    validForI2vPair: shot.status !== "blocked",
    exceptionReason: shot.status === "blocked" ? "Project.vibe shot is blocked." : undefined,
    allowedDelta: ["planned endpoint motion", shot.intent],
    mustPreserve: ["current Project.vibe shot intent", "locked character identity", "locked scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "independent end frame", "text-to-video fallback"],
  };
}

function sourcesFromProject(project: BuildProjectVibePlanningProjectionInput["project"]): ProjectionShotSource[] {
  if (!project) return [];
  return project.storyFlow.shotOrder
    .map((shotId, index): ProjectionShotSource | undefined => {
      const shot = project.shots.find((item) => item.id === shotId);
      const section = shot ? project.storyFlow.sections.find((item) => item.id === shot.sectionId) : undefined;
      if (!shot) {
        console.warn(`[projectVibePlanningProjection] Corrupted shot reference: shotId "${shotId}" found in storyFlow.shotOrder but missing from project.shots. Skipping.`);
        return undefined;
      }
      return {
        shot,
        ...(section ? { section } : {}),
        sequenceIndex: index,
        projectId: project.manifest.projectId,
        assets: project.assets || [],
      };
    })
    .filter((item): item is ProjectionShotSource => Boolean(item));
}

function sourcesFromScriptPlanner(result: ScriptPlannerResult): ProjectionShotSource[] {
  return result.shots.map(({ plannerNotes, ...shot }, index) => ({
    shot: {
      ...shot,
      intent: [
        shot.intent,
        plannerNotes.visibleAction,
        plannerNotes.emotionalIntent,
        `visual_anchor:${plannerNotes.visualAnchor}`,
      ].filter(Boolean).join(" "),
    },
    section: result.sections.find((section) => section.id === shot.sectionId),
    sequenceIndex: index,
    projectId: result.projectId,
  }));
}

export function buildProjectVibePlanningProjection(
  input: BuildProjectVibePlanningProjectionInput,
): ProjectVibePlanningProjection {
  const generatedAt = input.generatedAt || input.scriptPlannerResult?.generatedAt || input.project?.manifest.updatedAt || "1970-01-01T00:00:00.000Z";
  const sources = input.scriptPlannerResult
    ? sourcesFromScriptPlanner(input.scriptPlannerResult)
    : input.project
      ? sourcesFromProject(input.project)
      : [];
  const projectId = input.scriptPlannerResult?.projectId || input.project?.manifest.projectId || "project";
  const shots = sources.map((source) => {
    const shot = shotRecordFromSource(source);
    const keyframePair = requiresEndpointEndFrame(source.shot) ? keyframePairForShot(projectId, source.shot) : undefined;
    const jobs = [
      jobForShot({ shot: source.shot, projectId, assets: source.assets, role: "start" }),
      ...(keyframePair ? [jobForShot({ shot: source.shot, projectId, assets: source.assets, role: "end" })] : []),
    ];
    return {
      shot,
      jobs,
      ...(keyframePair ? { keyframePair } : {}),
    };
  });

  return {
    schemaVersion: projectVibePlanningProjectionSchemaVersion,
    projectId,
    generatedAt,
    source: input.scriptPlannerResult ? "script_planner" : "project_vibe",
    shots,
    jobs: shots.flatMap((item) => item.jobs),
    keyframePairs: shots.flatMap((item) => item.keyframePair ? [item.keyframePair] : []),
  };
}
