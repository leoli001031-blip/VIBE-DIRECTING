import type { DirectorAgentActionEnvelope } from "./directorAgentAction";
import type { DirectorRuleQaReport } from "./directorRuleQa";
import type { DirectorTextQaInput } from "./directorTextQa";
import type { ProjectVibeAsset, ProjectVibeDocument, ProjectVibeShot } from "../project/types";

function scopedShotIdsForAction(project: ProjectVibeDocument, action: DirectorAgentActionEnvelope): string[] {
  if (action.target.kind === "shot" || action.target.kind === "multi_shot") return action.target.ids;
  if (action.target.kind === "section") {
    const targetSectionIds = new Set(action.target.ids);
    return project.storyFlow.sections
      .filter((section) => targetSectionIds.has(section.id))
      .flatMap((section) => section.shotIds);
  }
  if (action.target.kind === "asset") {
    const targetAssetIds = new Set(action.target.ids);
    return project.assets
      .filter((asset) => targetAssetIds.has(asset.id))
      .flatMap((asset) => asset.usedByShotIds);
  }
  return project.shots.map((shot) => shot.id);
}

function scopedAssetsForShots(project: ProjectVibeDocument, shotIds: string[]): ProjectVibeAsset[] {
  const scopedShotIdSet = new Set(shotIds);
  const explicitAssetIds = new Set(
    project.shots
      .filter((shot) => scopedShotIdSet.has(shot.id))
      .flatMap((shot) => [
        ...shot.characterAssetIds,
        ...shot.sceneAssetIds,
        ...shot.propAssetIds,
      ]),
  );
  return project.assets.filter((asset) =>
    explicitAssetIds.has(asset.id)
      || asset.usedByShotIds.some((shotId) => scopedShotIdSet.has(shotId)),
  );
}

function textQaShot(shot: ProjectVibeShot) {
  return {
    id: shot.id,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    referenceStrategy: shot.referenceStrategy,
    executionMode: shot.executionMode,
    rhythmProfile: shot.rhythmProfile,
    visibleClips: shot.visibleClips,
    storyboardPanels: shot.storyboardPanels,
    actionBeats: shot.actionBeats,
    camera: shot.camera,
    intent: shot.intent,
    primaryAction: shot.primaryAction,
    actionTrigger: shot.actionTrigger,
    microReaction: shot.microReaction,
    characterGuidance: shot.characterGuidance,
    sceneGuidance: shot.sceneGuidance,
    propGuidance: shot.propGuidance,
  };
}

function textQaAsset(asset: ProjectVibeAsset, shotIds: string[]) {
  const scopedShotIdSet = new Set(shotIds);
  return {
    id: asset.id,
    kind: asset.kind,
    label: asset.label,
    usedByShotIds: asset.usedByShotIds.filter((shotId) => scopedShotIdSet.has(shotId)),
  };
}

export function buildDirectorAgentVideoTextQaInput(input: {
  project: ProjectVibeDocument;
  action: DirectorAgentActionEnvelope;
  userIntent: string;
  ruleQaReport?: DirectorRuleQaReport;
}): DirectorTextQaInput | undefined {
  if (input.action.kind !== "prepare_video_submit" || input.action.status === "blocked") return undefined;

  const shotIds = scopedShotIdsForAction(input.project, input.action);
  const shotIdSet = new Set(shotIds);
  const shots = input.project.shots.filter((shot) => shotIdSet.has(shot.id));
  if (!shots.length) return undefined;

  const strategies = Array.from(new Set(shots.map((shot) => shot.referenceStrategy).filter(Boolean)));
  const durationSeconds = shots.reduce((sum, shot) => sum + (Number(shot.durationSeconds) || 0), 0);
  return {
    shots: shots.map(textQaShot),
    assets: scopedAssetsForShots(input.project, shotIds).map((asset) => textQaAsset(asset, shotIds)),
    compilerMode: strategies.length === 1 ? strategies[0] : "mixed",
    compilerModeLabel: strategies.length === 1
      ? strategies[0] === "storyboard_rapid_cut"
        ? "故事板快切"
        : strategies[0] === "storyboard_narrative"
          ? "故事板叙事"
          : "全能参考"
      : "混合模式",
    compilerReasons: [
      "Agent 视频提交前的文本 QA，只检查项目规划、参考策略和生成合同。",
      "最终 Seedance 提交仍会在 runtime 里重新编译 prompt 并再次 QA。",
    ],
    durationSeconds: durationSeconds || undefined,
    visibleClips: shots.reduce((sum, shot) => sum + (Number(shot.visibleClips) || 1), 0),
    storyboardPanels: shots.reduce((sum, shot) => sum + (Number(shot.storyboardPanels) || 0), 0),
    userIntent: input.userIntent,
    styleIntent: input.project.storyFlow.sections.map((section) => section.summary).filter(Boolean).join("\n"),
    ruleQaReport: input.ruleQaReport,
  };
}
