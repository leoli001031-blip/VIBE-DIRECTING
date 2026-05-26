import {
  bindStoryboardReferenceAsset,
  buildImage2StoryboardReferencePlan,
  buildSeedanceStoryboardVideoPlan,
  buildStoryboardDirectorPlan,
  type StoryboardReferenceRoleBinding,
  type Image2StoryboardReferencePlan,
  type SeedanceStoryboardVideoPlan,
  type StoryboardDirectorPlan,
  type StoryboardReferenceAsset,
} from "./storyboardReferencePipeline";
import {
  planDirectorRhythm,
  type CreativeBrief,
  type DirectorActionDensity,
  type DirectorRhythmPlan,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";
import {
  buildDirectorProductionSkillPlan,
  productionSkillImage2PromptBlock,
  productionSkillSeedancePromptBlock,
  type DirectorProductionStrategyId,
  type DirectorProductionSkillPlan,
} from "./directorProductionSkill";
import type { ProjectVibeAssetKind } from "../project/types";

export const STORYBOARD_REFERENCE_PROJECT_PLANNER_VERSION = "storyboard_reference_project_planner_v1";

export interface StoryboardReferenceProjectPlannerShot {
  id: string;
  title?: string;
  intent?: string;
  camera?: string;
  executionMode?: string;
  referenceStrategy?: DirectorProductionStrategyId;
  creativeBrief?: CreativeBrief;
  userPreference?: string;
  rhythmProfile?: DirectorRhythmProfile;
  rhythmReason?: string;
  actionDensity?: DirectorActionDensity;
  splitPolicy?: DirectorSplitPolicy;
  directorPlan?: StoryboardDirectorPlan;
  actionBeats?: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  actorAction?: string;
  reactorResponse?: string;
  feedbackDirectives?: string[];
  characterGuidance?: string[];
  sceneGuidance?: string[];
  propGuidance?: string[];
  seedanceDirection?: string;
  sceneAssetIds?: string[];
  characterAssetIds?: string[];
  propAssetIds?: string[];
  durationSeconds?: number;
}

export interface StoryboardReferenceProjectPlannerAsset {
  id: string;
  kind?: ProjectVibeAssetKind | string;
  role?: string;
  label?: string;
  path?: string;
  usedByShotIds?: string[];
  textConstraints?: string[];
  roleBinding?: StoryboardReferenceRoleBinding;
}

export interface StoryboardReferenceProjectPlannerAudio {
  id: string;
  role?: "dialogue_audio" | string;
  label?: string;
  path?: string;
  shotIds?: string[];
  transcript?: string;
}

export interface StoryboardReferenceProjectPlannerInput {
  projectId?: string;
  shots: StoryboardReferenceProjectPlannerShot[];
  assets?: StoryboardReferenceProjectPlannerAsset[];
  storyboardReferences?: StoryboardReferenceProjectPlannerAsset[];
  audioReferences?: StoryboardReferenceProjectPlannerAudio[];
  creativeBrief?: CreativeBrief;
  userPreference?: string;
  storyboardOutputRoot?: string;
  videoOutputRoot?: string;
  outputSize?: string;
}

export interface StoryboardReferenceProjectShotPlan {
  shotId: string;
  shotTitle: string;
  directorPlan: StoryboardDirectorPlan;
  productionSkillPlan: DirectorProductionSkillPlan;
  image2StoryboardPlan?: Image2StoryboardReferencePlan;
  seedanceVideoPlan?: SeedanceStoryboardVideoPlan;
  blocked: boolean;
  blockedReasons: string[];
  warnings: string[];
  selectedReferences: {
    sceneBaseline?: StoryboardReferenceAsset;
    storyboardReference?: StoryboardReferenceAsset;
    characterReferences: StoryboardReferenceAsset[];
    propReferences: StoryboardReferenceAsset[];
    dialogueAudio?: StoryboardReferenceAsset;
  };
}

export interface StoryboardReferenceProjectPlan {
  schemaVersion: typeof STORYBOARD_REFERENCE_PROJECT_PLANNER_VERSION;
  projectId?: string;
  providerCalled: false;
  shotPlans: StoryboardReferenceProjectShotPlan[];
  blocked: boolean;
  blockedReasons: string[];
  warnings: string[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanLines(lines: Array<string | false | undefined>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function shotTitle(shot: StoryboardReferenceProjectPlannerShot): string {
  return clean(shot.title) || shot.id;
}

function shotIntent(shot: StoryboardReferenceProjectPlannerShot): string {
  return clean(shot.intent) || "按当前镜头意图完成动作和构图。";
}

function shotCamera(shot: StoryboardReferenceProjectPlannerShot): string {
  return clean(shot.camera) || "按导演分镜节奏处理景别、构图和运动。";
}

function isBoundToShot(asset: { usedByShotIds?: string[] }, shotId: string): boolean {
  return Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(shotId);
}

function isListedForShot(assetId: string, ids: string[] | undefined): boolean {
  return Array.isArray(ids) && ids.includes(assetId);
}

function assetMatchesShot(
  asset: StoryboardReferenceProjectPlannerAsset,
  shot: StoryboardReferenceProjectPlannerShot,
  shotAssetIds: string[] | undefined,
): boolean {
  return isListedForShot(asset.id, shotAssetIds) || isBoundToShot(asset, shot.id);
}

function projectAssetRole(kind: string | undefined, role: string | undefined): StoryboardReferenceAsset["role"] | undefined {
  const normalized = clean(role || kind).toLowerCase();
  if (normalized === "scene" || normalized === "scene_baseline") return "scene_baseline";
  if (normalized === "character" || normalized === "character_identity") return "character_identity";
  if (normalized === "prop" || normalized === "prop_reference") return "prop_reference";
  if (normalized === "storyboard" || normalized === "storyboard_reference") return "storyboard_reference";
  if (normalized === "dialogue_audio") return "dialogue_audio";
  return undefined;
}

function toReferenceAsset(
  asset: StoryboardReferenceProjectPlannerAsset,
  role: StoryboardReferenceAsset["role"],
): StoryboardReferenceAsset | undefined {
  const path = clean(asset.path);
  if (!path) return undefined;
  return bindStoryboardReferenceAsset({
    id: asset.id,
    role,
    path,
    label: clean(asset.label) || asset.id,
    notes: asset.textConstraints,
    roleBinding: asset.roleBinding,
  });
}

function toAudioReference(audio: StoryboardReferenceProjectPlannerAudio | undefined): StoryboardReferenceAsset | undefined {
  if (!audio) return undefined;
  const path = clean(audio.path);
  if (!path) return undefined;
  return bindStoryboardReferenceAsset({
    id: audio.id,
    role: "dialogue_audio",
    path,
    label: clean(audio.label) || audio.id,
  });
}

function plannedStoryboardReference(input: StoryboardReferenceProjectPlannerInput, shot: StoryboardReferenceProjectPlannerShot): StoryboardReferenceAsset {
  const root = clean(input.storyboardOutputRoot) || "storyboard";
  return bindStoryboardReferenceAsset({
    id: `storyboard_reference_${shot.id}`,
    role: "storyboard_reference",
    path: `${root}/${shot.id}-storyboard-reference.png`,
    label: `${shotTitle(shot)} 分镜图`,
  });
}

function plannedVideoOutputDir(input: StoryboardReferenceProjectPlannerInput, shot: StoryboardReferenceProjectPlannerShot): string {
  const root = clean(input.videoOutputRoot) || "video";
  return `${root}/${shot.id}`;
}

function firstReference(
  assets: StoryboardReferenceProjectPlannerAsset[],
  role: StoryboardReferenceAsset["role"],
  warningPrefix: string,
  warnings: string[],
): StoryboardReferenceAsset | undefined {
  const converted = assets.map((asset) => toReferenceAsset(asset, role)).filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const missingPathCount = assets.length - converted.length;
  if (missingPathCount > 0) warnings.push(`${warningPrefix}有 ${missingPathCount} 个参考缺少文件路径，已先按文字信息处理。`);
  if (converted.length > 1) warnings.push(`${warningPrefix}绑定了多个参考，本次只使用第一个。`);
  return converted[0];
}

function referencesForRole(
  assets: StoryboardReferenceProjectPlannerAsset[],
  role: StoryboardReferenceAsset["role"],
  warningPrefix: string,
  warnings: string[],
): StoryboardReferenceAsset[] {
  const converted = assets.map((asset) => toReferenceAsset(asset, role)).filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const missingPathCount = assets.length - converted.length;
  if (missingPathCount > 0) warnings.push(`${warningPrefix}有 ${missingPathCount} 个参考缺少文件路径，已先按文字信息处理。`);
  return converted;
}

function placeholderGuidanceForAssets(assets: StoryboardReferenceAsset[]): string[] {
  return assets.flatMap((asset) => {
    const label = clean(asset.label) || asset.id;
    const notes = Array.isArray(asset.notes) ? asset.notes.map(clean).filter(Boolean) : [];
    return notes.length ? notes.map((note) => `${label}: ${note}`) : [`${label}: keep locked reference identity readable in storyboard line art.`];
  });
}

function audioForShot(audioReferences: StoryboardReferenceProjectPlannerAudio[], shotId: string): StoryboardReferenceProjectPlannerAudio | undefined {
  return audioReferences.find((audio) => Array.isArray(audio.shotIds) && audio.shotIds.includes(shotId));
}

function storyboardAssetMatchesShot(asset: StoryboardReferenceProjectPlannerAsset, shotId: string): boolean {
  if (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.length > 0) return asset.usedByShotIds.includes(shotId);
  const haystack = [asset.id, asset.path, asset.label].map(clean).join(" ");
  return haystack.includes(shotId);
}

function uniqueMessages(messages: string[]): string[] {
  return [...new Set(messages.filter((message) => Boolean(message && message.trim())))];
}

function projectScriptText(input: StoryboardReferenceProjectPlannerInput): string {
  return input.shots.map((shot) => cleanLines([
    shot.title,
    shot.intent,
    shot.camera,
    shot.primaryAction,
    shot.actionTrigger,
    shot.microReaction,
    ...(shot.actionBeats || []),
  ])).join("\n");
}

function shotRhythmPlan(
  input: StoryboardReferenceProjectPlannerInput,
  shot: StoryboardReferenceProjectPlannerShot,
): DirectorRhythmPlan {
  const inferred = planDirectorRhythm({
    scriptText: projectScriptText(input),
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
    userPreference: shot.userPreference || input.userPreference,
    creativeBrief: shot.creativeBrief || input.creativeBrief,
    durationSeconds: shot.durationSeconds,
  });

  return {
    ...inferred,
    rhythmProfile: shot.rhythmProfile || inferred.rhythmProfile,
    rhythmReason: shot.rhythmReason || inferred.rhythmReason,
    actionDensity: shot.actionDensity || inferred.actionDensity,
    splitPolicy: shot.splitPolicy || inferred.splitPolicy,
  };
}

function directorPlanForShot(
  input: StoryboardReferenceProjectPlannerInput,
  shot: StoryboardReferenceProjectPlannerShot,
): StoryboardDirectorPlan {
  if (shot.directorPlan) return shot.directorPlan;
  return buildStoryboardDirectorPlan({
    shotId: shot.id,
    shotTitle: shotTitle(shot),
    durationSeconds: shot.durationSeconds,
    executionMode: shot.executionMode,
    creativeBrief: shot.creativeBrief || input.creativeBrief,
    userPreference: shot.userPreference || input.userPreference,
    rhythmPlan: shotRhythmPlan(input, shot),
    camera: shotCamera(shot),
    frameDescription: shotIntent(shot),
    actionBeats: shot.actionBeats,
    primaryAction: shot.primaryAction,
    actionTrigger: shot.actionTrigger,
    microReaction: shot.microReaction,
    actorAction: shot.actorAction,
    reactorResponse: shot.reactorResponse,
  });
}

export function buildStoryboardReferenceProjectPlan(
  input: StoryboardReferenceProjectPlannerInput,
): StoryboardReferenceProjectPlan {
  const assets = input.assets || [];
  const storyboardReferences = input.storyboardReferences || [];
  const audioReferences = input.audioReferences || [];

  const shotPlans = input.shots.map((shot): StoryboardReferenceProjectShotPlan => {
    const warnings: string[] = [];
    const blockedReasons: string[] = [];

    const sceneCandidates = assets.filter((asset) => (
      projectAssetRole(asset.kind, asset.role) === "scene_baseline"
      && assetMatchesShot(asset, shot, shot.sceneAssetIds)
    ));
    const characterCandidates = assets.filter((asset) => (
      projectAssetRole(asset.kind, asset.role) === "character_identity"
      && assetMatchesShot(asset, shot, shot.characterAssetIds)
    ));
    const propCandidates = assets.filter((asset) => (
      projectAssetRole(asset.kind, asset.role) === "prop_reference"
      && assetMatchesShot(asset, shot, shot.propAssetIds)
    ));

    const sceneBaseline = firstReference(sceneCandidates, "scene_baseline", `镜头 ${shot.id} 的场景参考`, warnings);
    const characterReferences = referencesForRole(characterCandidates, "character_identity", `镜头 ${shot.id} 的角色参考`, warnings);
    const propReferences = referencesForRole(propCandidates, "prop_reference", `镜头 ${shot.id} 的道具参考`, warnings);

    if (!sceneBaseline) warnings.push(`镜头 ${shot.id} 还没有可用的场景/天气参考；分镜图和视频会先依赖文字描述。`);
    if (!characterReferences.length) warnings.push(`镜头 ${shot.id} 还没有可用的角色参考；视频里的角色一致性需要后续补齐。`);
    if (!propReferences.length) warnings.push(`镜头 ${shot.id} 还没有可用的道具参考；关键物件外观需要后续补齐。`);

    const shotAudio = audioForShot(audioReferences, shot.id);
    const dialogueAudio = toAudioReference(shotAudio);
    if (shotAudio && !dialogueAudio) warnings.push(`镜头 ${shot.id} 的对白音频缺少文件路径，视频阶段会先不带音频。`);
    if (!dialogueAudio) warnings.push(`镜头 ${shot.id} 还没有可用的对白音频；口型和表演节奏需要后续补齐。`);
    const directorPlan = directorPlanForShot(input, shot);
    const hasExplicitRhythmOverride = Boolean(shot.rhythmProfile || shot.rhythmReason || shot.actionDensity || shot.splitPolicy);
    const productionSkillPlan = buildDirectorProductionSkillPlan({
      shotId: shot.id,
      title: shotTitle(shot),
      durationSeconds: shot.durationSeconds,
      shotText: cleanLines([
        shotTitle(shot),
        shotIntent(shot),
        shotCamera(shot),
        shot.primaryAction,
        shot.actionTrigger,
        shot.microReaction,
        shot.actorAction,
        shot.reactorResponse,
        ...(shot.actionBeats || []),
      ]),
      userPreference: shot.userPreference || input.userPreference,
      creativeBrief: shot.creativeBrief || input.creativeBrief,
      rhythmPlan: hasExplicitRhythmOverride
        ? {
            rhythmProfile: directorPlan.rhythmProfile,
            rhythmReason: directorPlan.rhythmReason,
            actionDensity: directorPlan.actionDensity,
            splitPolicy: directorPlan.splitPolicy,
            userFacingLabel: directorPlan.rhythmProfile,
          }
        : undefined,
      rhythmOverride: hasExplicitRhythmOverride,
      executionMode: shot.executionMode,
      referenceStrategy: shot.referenceStrategy,
      actionBeats: shot.actionBeats,
      camera: shotCamera(shot),
      visualDescription: shotIntent(shot),
      assetState: {
        scene: sceneBaseline ? "locked" : "missing",
        characters: characterReferences.length ? "locked" : "missing",
        props: (shot.propAssetIds?.length || propCandidates.length) ? (propReferences.length ? "locked" : "missing") : undefined,
        audio: dialogueAudio ? "locked" : shotAudio ? "missing" : undefined,
      },
    });
    const usesStoryboardReference = productionSkillPlan.strategyId !== "omni_reference";
    const explicitStoryboard = usesStoryboardReference
      ? firstReference(
          storyboardReferences.filter((asset) => (
            projectAssetRole(asset.kind, asset.role) === "storyboard_reference"
            && storyboardAssetMatchesShot(asset, shot.id)
          )),
          "storyboard_reference",
          `镜头 ${shot.id} 的分镜图`,
          warnings,
        )
      : undefined;
    const storyboardReference = usesStoryboardReference
      ? explicitStoryboard || plannedStoryboardReference(input, shot)
      : undefined;
    if (usesStoryboardReference && !explicitStoryboard) {
      warnings.push(`镜头 ${shot.id} 还没有已生成的黑白分镜图；这里先使用本次计划里的分镜输出路径。`);
    }
    warnings.push(...directorPlan.durationBudget.warnings.map((warning) => `镜头 ${shot.id} 的时长规划提醒：${warning}`));
    blockedReasons.push(...directorPlan.durationBudget.blockers.map((blocker) => `镜头 ${shot.id} 的动作密度超过当前时长：${blocker}`));

    const image2StoryboardPlan = usesStoryboardReference
      ? buildImage2StoryboardReferencePlan({
          shotId: shot.id,
          shotTitle: shotTitle(shot),
          directorPlan,
          productionSkillPlan,
          camera: shotCamera(shot),
          shotDescription: cleanLines([
            shotIntent(shot),
            ...(shot.feedbackDirectives || []).map((directive) => `反馈修正：${directive}`),
            ...(shot.sceneGuidance || []).map((directive) => `场景修正：${directive}`),
            `导演节奏：${directorPlan.rhythmProfile}`,
            `拍法理由：${directorPlan.rhythmReason}`,
            `主动作：${directorPlan.primaryAction}`,
            directorPlan.actionTrigger ? `触发原因：${directorPlan.actionTrigger}` : undefined,
            directorPlan.microReaction ? `微反应：${directorPlan.microReaction}` : undefined,
            "内部导演 skill：",
            productionSkillImage2PromptBlock(productionSkillPlan),
          ]),
          sceneBaseline,
          characterReferences,
          propReferences,
          characterGuidance: [
            ...placeholderGuidanceForAssets(characterReferences),
            ...(shot.characterGuidance || []),
          ],
          propGuidance: [
            ...placeholderGuidanceForAssets(propReferences),
            ...(shot.propGuidance || []),
          ],
          dialogue: shotAudio?.transcript,
          durationSeconds: shot.durationSeconds,
          outputSize: input.outputSize,
        })
      : undefined;

    const seedanceVideoPlan = buildSeedanceStoryboardVideoPlan({
	          shotId: shot.id,
	          storyboardReference,
	          sceneBaseline,
          characterReferences,
          propReferences,
          dialogueAudio,
          dialogueTranscript: shotAudio?.transcript,
          durationSeconds: shot.durationSeconds,
          outputDir: plannedVideoOutputDir(input, shot),
          directorPlan,
	          prompt: shot.seedanceDirection || cleanLines([
	            shotIntent(shot),
	            ...(shot.feedbackDirectives || []),
	            ...(shot.sceneGuidance || []),
	            "Internal production skill for Seedance:",
	            productionSkillSeedancePromptBlock(productionSkillPlan),
	          ]),
	        });

    return {
      shotId: shot.id,
      shotTitle: shotTitle(shot),
      directorPlan,
      productionSkillPlan,
      image2StoryboardPlan,
      seedanceVideoPlan,
      blocked: blockedReasons.length > 0,
      blockedReasons: uniqueMessages(blockedReasons),
      warnings: uniqueMessages(warnings),
      selectedReferences: {
        sceneBaseline,
        storyboardReference,
        characterReferences,
        propReferences,
        dialogueAudio,
      },
    };
  });

  const blockedReasons = uniqueMessages(shotPlans.flatMap((plan) => plan.blockedReasons));
  const warnings = uniqueMessages(shotPlans.flatMap((plan) => plan.warnings));

  return {
    schemaVersion: STORYBOARD_REFERENCE_PROJECT_PLANNER_VERSION,
    projectId: input.projectId,
    providerCalled: false,
    shotPlans,
    blocked: blockedReasons.length > 0,
    blockedReasons,
    warnings,
  };
}
