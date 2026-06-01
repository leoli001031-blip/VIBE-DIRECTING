import {
  buildImage2StoryboardReferencePlan,
  buildSeedanceStoryboardVideoPlan,
  buildStoryboardDirectorPlan,
  type Image2StoryboardReferencePlan,
  type SeedanceStoryboardVideoPlan,
  type StoryboardDirectorPlan,
  STORYBOARD_REFERENCE_ROLE_BINDINGS,
  type StoryboardReferenceRoleBinding,
  type StoryboardReferenceAsset,
} from "./storyboardReferencePipeline";
import {
  planDirectorRhythm,
  type CreativeBrief,
  type DirectorActionDensity,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";
import {
  formatStyleResearchPreflightForPrompt,
  type StyleResearchPreflight,
} from "./styleResearchPreflight";
import {
  buildDirectorProductionSkillPlan,
  productionSkillAssetAuthorityPromptBlock,
  productionSkillSeedancePromptBlock,
  productionSkillStrategyContractPromptBlock,
  type DirectorProductionSkillPlan,
} from "./directorProductionSkill";

export const SCRIPT_STORYBOARD_PROMPT_PACK_VERSION = "script_storyboard_prompt_pack_v1";

export const DIRECTOR_STORYBOARD_TABLE_COLUMNS = [
  "镜号",
  "时长",
  "时间规划",
  "景别",
  "镜头",
  "主动作",
  "触发原因",
  "微反应",
  "节奏/拍法",
  "拍法理由",
  "行动/反应QA",
  "画面描述",
  "字幕",
  "音效",
  "参考资产",
] as const;

export interface ScriptStoryboardReferenceBundle {
  scenes: StoryboardReferenceAsset[];
  characters: StoryboardReferenceAsset[];
  props: StoryboardReferenceAsset[];
  audio?: StoryboardReferenceAsset[];
}

export interface ScriptStoryboardShotInput {
  shotId: string;
  title: string;
  durationSeconds: number;
  executionMode?: "single_continuous_shot" | "relationship_wide" | "action_insert" | "reaction_closeup" | "planned_cut_sequence";
  sceneId?: string;
  characterIds?: string[];
  propIds?: string[];
  dialogueAudioId?: string;
  shotSize: string;
  camera: string;
  frameDescription: string;
  actionBeats: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  actorAction?: string;
  reactorResponse?: string;
  rhythmProfile?: DirectorRhythmProfile;
  rhythmReason?: string;
  actionDensity?: DirectorActionDensity;
  splitPolicy?: DirectorSplitPolicy;
  dialogue?: string;
  sound?: string;
  transition?: string;
  animeShotGrammar?: string[];
  characterGuidance?: string[];
  propGuidance?: string[];
  seedanceDirection?: string;
  storyboardReferencePath?: string;
}

export interface ScriptStoryboardPromptPackInput {
  title: string;
  logline: string;
  completeScript: string;
  style: string;
  styleResearchPreflight?: StyleResearchPreflight;
  creativeBrief?: CreativeBrief;
  referenceBundle: ScriptStoryboardReferenceBundle;
  shots: ScriptStoryboardShotInput[];
  storyboardOutputDir: string;
  videoOutputDir: string;
  image2OutputSize?: string;
  seedanceModelVersion?: string;
  seedanceVideoResolution?: string;
}

export interface DirectorStoryboardTableRow {
  镜号: string;
  时长: string;
  时间规划: string;
  景别: string;
  镜头: string;
  主动作: string;
  触发原因: string;
  微反应: string;
  "节奏/拍法": string;
  拍法理由: string;
  "行动/反应QA": string;
  画面描述: string;
  字幕: string;
  音效: string;
  参考资产: string;
}

export interface ScriptStoryboardActionQA {
  primaryAction: string;
  actionTrigger?: string;
  microReaction?: string;
  actorAction?: string;
  reactorResponse?: string;
  blockers: string[];
  warnings: string[];
  videoPromptAction: string;
}

export interface ScriptStoryboardPromptPackShot {
  shotId: string;
  title: string;
  durationSeconds: number;
  actionQA: ScriptStoryboardActionQA;
  productionSkillPlan: DirectorProductionSkillPlan;
  storyboardDirectorPlan: StoryboardDirectorPlan;
  directorRow: DirectorStoryboardTableRow;
  image2StoryboardPlan?: Image2StoryboardReferencePlan;
  seedanceVideoPlan: SeedanceStoryboardVideoPlan;
}

export interface ScriptStoryboardPromptPack {
  schemaVersion: typeof SCRIPT_STORYBOARD_PROMPT_PACK_VERSION;
  title: string;
  logline: string;
  completeScript: string;
  style: string;
  styleResearchPreflight?: StyleResearchPreflight;
  creativeBrief?: CreativeBrief;
  tableColumns: typeof DIRECTOR_STORYBOARD_TABLE_COLUMNS;
  directorRows: DirectorStoryboardTableRow[];
  shots: ScriptStoryboardPromptPackShot[];
  referenceRoleBindings: StoryboardReferenceRoleBinding[];
  rules: {
    scriptFirst: true;
    styleResearchRole: string;
    image2Role: string;
    seedanceRole: string;
    audioRole: string;
    strategyContractRole: string;
    assetAuthorityRole: string;
  };
  blockers: string[];
  warnings: string[];
}

function assetIndex(assets: StoryboardReferenceAsset[]): Map<string, StoryboardReferenceAsset> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

function pickAssets(ids: string[] | undefined, index: Map<string, StoryboardReferenceAsset>): StoryboardReferenceAsset[] {
  return (ids || []).map((id) => index.get(id)).filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
}

function compactAssetList(assets: StoryboardReferenceAsset[]): string {
  if (!assets.length) return "-";
  return assets.map((asset) => asset.label || asset.id).join("、");
}

function cleanLines(lines: Array<string | undefined | false>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function styleResearchPromptBlock(preflight: StyleResearchPreflight | undefined): string {
  return preflight ? formatStyleResearchPreflightForPrompt(preflight).join("\n") : "";
}

function storyboardTimingSummary(plan: StoryboardDirectorPlan): string {
  return plan.timingBeats
    .map((beat) => {
      const start = typeof beat.startSeconds === "number" ? beat.startSeconds.toFixed(1) : "--";
      const end = typeof beat.endSeconds === "number" ? beat.endSeconds.toFixed(1) : "--";
      return `${beat.label} ${start}-${end}s：${beat.content}`;
    })
    .join("\n");
}

function isMicroReactionBeat(value: string): boolean {
  return /停住|停顿|看|视线|眼神|怔|等待|呼吸|微笑|别开|肩膀|对望|沉默|反应|犹豫|pause|wait|look|glance|breath|smile|react|hesitat|flinch/i.test(value);
}

function isPrimaryActionBeat(value: string): boolean {
  return /推开|入画|后退|伸|拿|递|接过|藏|转|走|跑|打开|关上|起身|坐下|穿过|捡起|拉开|放下|靠近|离开|挥|拥抱|跌倒|追|跳|open|close|enter|exit|walk|run|turn|grab|pick|hand|pass|move|approach/i.test(value);
}

function hasInternalActionChain(value: string): boolean {
  return /(然后|随后|接着|并且|同时|再|又|before|after|then|while).*(推开|入画|后退|伸|拿|递|接过|藏|转|走|跑|打开|关上|起身|坐下|穿过|捡起|拉开|靠近|离开|open|close|enter|walk|run|turn|grab|pick|hand|pass|move|approach)/i.test(value);
}

function buildActionQA(shot: ScriptStoryboardShotInput): ScriptStoryboardActionQA {
  const actionBeats = shot.actionBeats.map((beat) => beat.trim()).filter(Boolean);
  const primaryAction = shot.primaryAction || actionBeats.find((beat) => isPrimaryActionBeat(beat)) || shot.frameDescription;
  const actionTrigger = shot.actionTrigger;
  const microReaction = shot.microReaction || actionBeats.find((beat) => isMicroReactionBeat(beat));
  const multiCharacter = (shot.characterIds || []).length >= 2;
  const actorAction = shot.actorAction || (multiCharacter ? primaryAction : undefined);
  const reactorResponse = shot.reactorResponse || (multiCharacter ? actionBeats.find((beat) => beat !== primaryAction && isMicroReactionBeat(beat)) : undefined);
  const primaryActionCount = actionBeats.filter((beat) => isPrimaryActionBeat(beat)).length;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!shot.primaryAction) warnings.push("missing_structured_primary_action");
  if (!actionTrigger) warnings.push("missing_action_trigger");
  if (!microReaction) warnings.push("missing_micro_reaction");
  if (multiCharacter && (!actorAction || !reactorResponse)) warnings.push("multi_character_action_reaction_incomplete");

  if (
    actionBeats.length > 4 ||
    primaryActionCount > 2 ||
    actionBeats.some(hasInternalActionChain)
  ) {
    blockers.push("complex_action_requires_split_before_video_prompt");
  }

  const videoPromptAction = blockers.length
    ? cleanLines([
        "Motion QA blocker: this action chain is too complex for one direct video prompt.",
        "Do not submit this as a single Seedance action. Split the shot or reduce it to one primary action before generation.",
        `Provisional primary action only: ${primaryAction}`,
        actionTrigger ? `Trigger: ${actionTrigger}` : undefined,
        microReaction ? `Micro-reaction to preserve after the action: ${microReaction}` : undefined,
      ])
    : cleanLines([
        `Primary visible action: ${primaryAction}`,
        actionTrigger ? `Action trigger: ${actionTrigger}` : undefined,
        microReaction ? `Micro-reaction after action: ${microReaction}` : undefined,
        multiCharacter && actorAction ? `Actor side: ${actorAction}` : undefined,
        multiCharacter && reactorResponse ? `Reactor side: ${reactorResponse}` : undefined,
      ]);

  return {
    primaryAction,
    actionTrigger,
    microReaction,
    actorAction,
    reactorResponse,
    blockers,
    warnings,
    videoPromptAction,
  };
}

function buildDefaultSeedanceDirection(input: {
  shot: ScriptStoryboardShotInput;
  actionQA: ScriptStoryboardActionQA;
  directorPlan: StoryboardDirectorPlan;
  scene?: StoryboardReferenceAsset;
  characters: StoryboardReferenceAsset[];
  props: StoryboardReferenceAsset[];
  style: string;
  styleResearchPreflight?: StyleResearchPreflight;
}): string {
  const characterNames = compactAssetList(input.characters);
  const propNames = compactAssetList(input.props);
  return cleanLines([
    `${input.shot.title}.`,
    `Style: ${input.style}.`,
    input.styleResearchPreflight ? styleResearchPromptBlock(input.styleResearchPreflight) : undefined,
    input.scene ? `Location and weather must follow "${input.scene.label || input.scene.id}".` : undefined,
    `Characters on screen: ${characterNames}.`,
    `Important props: ${propNames}.`,
    input.shot.executionMode ? `Execution mode: ${input.shot.executionMode}.` : undefined,
    `Rhythm and shooting approach: ${input.directorPlan.rhythmProfile}.`,
    `Human-facing rhythm reason: ${input.directorPlan.rhythmReason}`,
    `Action density: ${input.directorPlan.actionDensity}; split policy: ${input.directorPlan.splitPolicy}.`,
    `Camera: ${input.shot.camera}.`,
    "Director action QA:",
    input.actionQA.videoPromptAction,
    `Director pacing: ${input.directorPlan.durationBudget.shotCountIntent}; small continuity panels ${input.directorPlan.durationBudget.supportPanelLimit}.`,
    `Frame composition: ${input.shot.frameDescription}.`,
    `Start frame anchor: ${input.directorPlan.mainComposition.startFrameAnchor}.`,
    `Primary action after start frame: ${input.directorPlan.primaryAction}.`,
    input.directorPlan.actionTrigger ? `Trigger: ${input.directorPlan.actionTrigger}.` : undefined,
    input.directorPlan.microReaction ? `Micro-reaction: ${input.directorPlan.microReaction}.` : undefined,
    input.directorPlan.supportPanels.length
      ? `Small storyboard panels as timing hints only: ${input.directorPlan.supportPanels.map((panel) => `${panel.purpose}: ${panel.content}`).join("; ")}.`
      : undefined,
    input.shot.animeShotGrammar?.length ? `Anime shot grammar: ${input.shot.animeShotGrammar.join(" / ")}.` : undefined,
    input.shot.dialogue ? `Dialogue for timing and performance: ${input.shot.dialogue}.` : undefined,
    input.shot.sound ? `Sound intention: ${input.shot.sound}.` : undefined,
    input.shot.transition ? `Transition: ${input.shot.transition}.` : undefined,
  ]);
}

export function buildScriptStoryboardPromptPack(
  input: ScriptStoryboardPromptPackInput,
): ScriptStoryboardPromptPack {
  const sceneIndex = assetIndex(input.referenceBundle.scenes);
  const characterIndex = assetIndex(input.referenceBundle.characters);
  const propIndex = assetIndex(input.referenceBundle.props);
  const audioIndex = assetIndex(input.referenceBundle.audio || []);
  const warnings: string[] = [];
  const blockers: string[] = [];
  const styleResearchBlock = styleResearchPromptBlock(input.styleResearchPreflight);
  const styleAndResearchPreference = [input.style, styleResearchBlock].filter(Boolean).join("\n");
  if (input.styleResearchPreflight) {
    warnings.push(...input.styleResearchPreflight.warnings.map((warning) => `style_research_preflight: ${warning}`));
  }

  const shots = input.shots.map((shot) => {
    const scene = shot.sceneId ? sceneIndex.get(shot.sceneId) : undefined;
    const characters = pickAssets(shot.characterIds, characterIndex);
    const props = pickAssets(shot.propIds, propIndex);
    const dialogueAudio = shot.dialogueAudioId ? audioIndex.get(shot.dialogueAudioId) : undefined;

    if (shot.sceneId && !scene) warnings.push(`${shot.shotId}: missing scene reference ${shot.sceneId}`);
    for (const id of shot.characterIds || []) {
      if (!characterIndex.has(id)) warnings.push(`${shot.shotId}: missing character reference ${id}`);
    }
    for (const id of shot.propIds || []) {
      if (!propIndex.has(id)) warnings.push(`${shot.shotId}: missing prop reference ${id}`);
    }
    if (shot.dialogueAudioId && !dialogueAudio) warnings.push(`${shot.shotId}: missing dialogue audio ${shot.dialogueAudioId}`);
    const actionQA = buildActionQA(shot);
    const inferredRhythmPlan = planDirectorRhythm({
      scriptText: input.completeScript,
      shotText: [
        shot.title,
        shot.camera,
        shot.frameDescription,
        actionQA.primaryAction,
        actionQA.actionTrigger,
        actionQA.microReaction,
        ...(shot.actionBeats || []),
      ].filter(Boolean).join("\n"),
      userPreference: styleAndResearchPreference,
      creativeBrief: input.creativeBrief,
      durationSeconds: shot.durationSeconds,
    });
    const rhythmPlan = {
      ...inferredRhythmPlan,
      rhythmProfile: shot.rhythmProfile || inferredRhythmPlan.rhythmProfile,
      rhythmReason: shot.rhythmReason || inferredRhythmPlan.rhythmReason,
      actionDensity: shot.actionDensity || inferredRhythmPlan.actionDensity,
      splitPolicy: shot.splitPolicy || inferredRhythmPlan.splitPolicy,
    };
    const storyboardDirectorPlan = buildStoryboardDirectorPlan({
      shotId: shot.shotId,
      shotTitle: shot.title,
      durationSeconds: shot.durationSeconds,
      executionMode: shot.executionMode,
      creativeBrief: input.creativeBrief,
      userPreference: styleAndResearchPreference,
      rhythmPlan,
      camera: shot.camera,
      frameDescription: shot.frameDescription,
      actionBeats: shot.actionBeats,
      primaryAction: actionQA.primaryAction,
      actionTrigger: actionQA.actionTrigger,
      microReaction: actionQA.microReaction,
      actorAction: actionQA.actorAction,
      reactorResponse: actionQA.reactorResponse,
    });
    const hasExplicitRhythmOverride = Boolean(shot.rhythmProfile || shot.rhythmReason || shot.actionDensity || shot.splitPolicy);
    const productionSkillPlan = buildDirectorProductionSkillPlan({
      shotId: shot.shotId,
      title: shot.title,
      durationSeconds: shot.durationSeconds,
      shotText: cleanLines([
        shot.title,
        shot.camera,
        shot.frameDescription,
        actionQA.primaryAction,
        actionQA.actionTrigger,
        actionQA.microReaction,
        ...(shot.actionBeats || []),
      ]),
      userPreference: styleAndResearchPreference,
      creativeBrief: input.creativeBrief,
      rhythmPlan: hasExplicitRhythmOverride ? rhythmPlan : undefined,
      rhythmOverride: hasExplicitRhythmOverride,
      executionMode: shot.executionMode,
      actionBeats: shot.actionBeats,
      camera: shot.camera,
      visualDescription: shot.frameDescription,
      assetState: {
        scene: scene ? "locked" : "missing",
        characters: characters.length ? "locked" : "missing",
        props: shot.propIds?.length ? (props.length ? "locked" : "missing") : undefined,
        audio: dialogueAudio ? "locked" : shot.dialogueAudioId ? "missing" : undefined,
      },
    });
    warnings.push(...actionQA.warnings.map((warning) => `${shot.shotId}: ${warning}`));
    blockers.push(...actionQA.blockers.map((blocker) => `${shot.shotId}: ${blocker}`));
    blockers.push(...storyboardDirectorPlan.durationBudget.blockers.map((blocker) => `${shot.shotId}: ${blocker}`));
    warnings.push(...storyboardDirectorPlan.durationBudget.warnings.map((warning) => `${shot.shotId}: ${warning}`));

    const usesStoryboardReference = productionSkillPlan.strategyId !== "omni_reference";
    const storyboardReferencePath = shot.storyboardReferencePath
      || `${input.storyboardOutputDir.replace(/\/$/u, "")}/${shot.shotId}-storyboard-reference.png`;
    const image2StoryboardPlan = usesStoryboardReference
      ? buildImage2StoryboardReferencePlan({
          shotId: shot.shotId,
          shotTitle: shot.title,
          directorPlan: storyboardDirectorPlan,
          productionSkillPlan,
          shotDescription: [
            styleResearchBlock ? `Style research preflight:\n${styleResearchBlock}` : "",
            shot.executionMode ? `Execution mode: ${shot.executionMode}` : "",
            "Director action QA:",
            actionQA.videoPromptAction,
            `Director rhythm: ${storyboardDirectorPlan.rhythmProfile}`,
            `Rhythm reason: ${storyboardDirectorPlan.rhythmReason}`,
            `Action density: ${storyboardDirectorPlan.actionDensity}; split policy: ${storyboardDirectorPlan.splitPolicy}`,
            `Frame composition: ${shot.frameDescription}`,
            `Start frame anchor: ${storyboardDirectorPlan.mainComposition.startFrameAnchor}`,
            `Primary action after start frame: ${storyboardDirectorPlan.primaryAction}`,
            storyboardDirectorPlan.actionTrigger ? `Trigger: ${storyboardDirectorPlan.actionTrigger}` : "",
            storyboardDirectorPlan.microReaction ? `Micro-reaction: ${storyboardDirectorPlan.microReaction}` : "",
            storyboardDirectorPlan.supportPanels.length
              ? `Small continuity panels only: ${storyboardDirectorPlan.supportPanels.map((panel) => `${panel.purpose}: ${panel.content}`).join(" / ")}`
              : "",
            shot.animeShotGrammar?.length ? `Anime shot grammar: ${shot.animeShotGrammar.join(" / ")}` : "",
          ].filter(Boolean).join("\n"),
          camera: shot.camera,
          sceneBaseline: scene,
          characterReferences: characters,
          propReferences: props,
          characterGuidance: shot.characterGuidance,
          propGuidance: shot.propGuidance,
          dialogue: shot.dialogue,
          durationSeconds: shot.durationSeconds,
          outputSize: input.image2OutputSize,
        })
      : undefined;

    const storyboardReference: StoryboardReferenceAsset | undefined = usesStoryboardReference
      ? {
          id: `${shot.shotId}_storyboard_reference`,
          role: "storyboard_reference",
          path: storyboardReferencePath,
          label: `${shot.shotId} 分镜参考图`,
        }
      : undefined;
    const seedanceVideoPlan = buildSeedanceStoryboardVideoPlan({
      shotId: shot.shotId,
      storyboardReference,
      sceneBaseline: scene,
      characterReferences: characters,
      propReferences: props,
      dialogueAudio,
      dialogueTranscript: shot.dialogue,
      outputDir: `${input.videoOutputDir.replace(/\/$/u, "")}/${shot.shotId}`,
      durationSeconds: shot.durationSeconds,
      modelVersion: input.seedanceModelVersion,
      videoResolution: input.seedanceVideoResolution,
      directorPlan: storyboardDirectorPlan,
      prompt: shot.seedanceDirection || cleanLines([
        buildDefaultSeedanceDirection({
          shot,
          actionQA,
          directorPlan: storyboardDirectorPlan,
          scene,
          characters,
          props,
          style: input.style,
          styleResearchPreflight: input.styleResearchPreflight,
        }),
        "Internal production skill for Seedance:",
        productionSkillSeedancePromptBlock(productionSkillPlan),
      ]),
    });

    const directorRow: DirectorStoryboardTableRow = {
      镜号: shot.shotId,
      时长: `${shot.durationSeconds}s`,
      时间规划: storyboardTimingSummary(storyboardDirectorPlan),
      景别: shot.shotSize,
      镜头: shot.camera,
      主动作: actionQA.primaryAction,
      触发原因: actionQA.actionTrigger || "-",
      微反应: actionQA.microReaction || "-",
      "节奏/拍法": storyboardDirectorPlan.rhythmProfile,
      拍法理由: storyboardDirectorPlan.rhythmReason,
      "行动/反应QA": cleanLines([
        actionQA.actorAction ? `行动：${actionQA.actorAction}` : undefined,
        actionQA.reactorResponse ? `反应：${actionQA.reactorResponse}` : undefined,
        actionQA.blockers.length ? `Blocker：${actionQA.blockers.join("；")}` : undefined,
        actionQA.warnings.length ? `Warning：${actionQA.warnings.join("；")}` : undefined,
      ]) || "-",
      画面描述: cleanLines([
        shot.executionMode ? `执行模式：${shot.executionMode}` : undefined,
        shot.frameDescription,
        shot.actionBeats.length ? `动作节拍：${shot.actionBeats.join("；")}` : undefined,
        shot.animeShotGrammar?.length ? `日漫镜头语法：${shot.animeShotGrammar.join("；")}` : undefined,
        shot.transition ? `转场：${shot.transition}` : undefined,
      ]),
      字幕: shot.dialogue || "-",
      音效: shot.sound || "-",
      参考资产: compactAssetList([scene, ...characters, ...props, dialogueAudio].filter((asset): asset is StoryboardReferenceAsset => Boolean(asset))),
    };

    return {
      shotId: shot.shotId,
      title: shot.title,
      durationSeconds: shot.durationSeconds,
      actionQA,
      productionSkillPlan,
      storyboardDirectorPlan,
      directorRow,
      image2StoryboardPlan,
      seedanceVideoPlan,
    };
  });

  return {
    schemaVersion: SCRIPT_STORYBOARD_PROMPT_PACK_VERSION,
    title: input.title,
    logline: input.logline,
    completeScript: input.completeScript,
    style: input.style,
    styleResearchPreflight: input.styleResearchPreflight,
    creativeBrief: input.creativeBrief,
    tableColumns: DIRECTOR_STORYBOARD_TABLE_COLUMNS,
    directorRows: shots.map((shot) => shot.directorRow),
    shots,
    referenceRoleBindings: [
      STORYBOARD_REFERENCE_ROLE_BINDINGS.storyboard_reference,
      STORYBOARD_REFERENCE_ROLE_BINDINGS.scene_baseline,
      STORYBOARD_REFERENCE_ROLE_BINDINGS.character_identity,
      STORYBOARD_REFERENCE_ROLE_BINDINGS.prop_reference,
      STORYBOARD_REFERENCE_ROLE_BINDINGS.dialogue_audio,
    ],
    rules: {
      scriptFirst: true,
      styleResearchRole: "Before storyboard writing, route local knowledge first; optional web research must be confirmed and internalized as a project style asset before it becomes reusable production context.",
      image2Role: "Image2 only creates clean storyboard references from confirmed script and locked assets.",
      seedanceRole: "Seedance receives storyboard, scene, character, prop, and optional dialogue audio references with strict role priority.",
      audioRole: "Dialogue audio is a performance and timing input, not an afterthought or default background music.",
      strategyContractRole: [
        productionSkillStrategyContractPromptBlock("storyboard_narrative"),
        productionSkillStrategyContractPromptBlock("storyboard_rapid_cut"),
        productionSkillStrategyContractPromptBlock("omni_reference"),
      ].join("\n\n"),
      assetAuthorityRole: productionSkillAssetAuthorityPromptBlock(),
    },
    blockers,
    warnings,
  };
}
