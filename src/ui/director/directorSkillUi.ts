import type { ShotRecord } from "../../core/types";
import {
  buildDirectorProductionSkillPlan,
} from "../../core/directorProductionSkill";

export type DirectorSkillStrategy = "omni_reference" | "storyboard_narrative" | "storyboard_rapid_cut";

type StrategyShot = ShotRecord & {
  referenceStrategy?: string;
  visibleClips?: number;
  storyboardPanels?: number;
};

const rhythmLabels: Record<string, string> = {
  anime_emotion: "日漫表演",
  action_fast_cut: "动作节奏",
  suspense_pressure: "悬疑压迫",
  lyrical_observation: "安静观察",
  comedy_reaction: "喜剧反应",
  commercial_short: "短视频节奏",
  emotion_montage: "情绪蒙太奇",
  quiet_dialogue: "安静对白",
};

const executionLabels: Record<string, string> = {
  single_continuous_shot: "连续镜头",
  relationship_wide: "关系站位",
  action_insert: "动作插入",
  reaction_closeup: "反应特写",
  planned_cut_sequence: "计划切镜",
};

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function unique(items: string[]) {
  return Array.from(new Set(items.map(clean).filter(Boolean)));
}

export function shotReferenceStrategy(shot: ShotRecord): DirectorSkillStrategy {
  return explicitShotReferenceStrategy(shot) || "omni_reference";
}

export function explicitShotReferenceStrategy(shot: ShotRecord): DirectorSkillStrategy | undefined {
  const raw = clean((shot as StrategyShot).referenceStrategy);
  if (raw === "storyboard_rapid_cut") return "storyboard_rapid_cut";
  if (raw === "storyboard_narrative") return "storyboard_narrative";
  if (raw === "omni_reference") return "omni_reference";
  if (/故事板快切/.test(shot.seedanceDirection || "")) return "storyboard_rapid_cut";
  if (/故事板叙事/.test(shot.seedanceDirection || "")) return "storyboard_narrative";
  return undefined;
}

export function referenceStrategyLabel(strategy: DirectorSkillStrategy) {
  if (strategy === "storyboard_narrative") return "故事板叙事";
  if (strategy === "storyboard_rapid_cut") return "故事板快切";
  return "全能参考";
}

export function referenceStrategyDetail(strategy: DirectorSkillStrategy) {
  if (strategy === "storyboard_narrative") return "用故事板控制构图和人物关系";
  if (strategy === "storyboard_rapid_cut") return "用故事板控制快切和动作";
  return "用角色、场景、道具和文字说明锁定画面";
}

export function referenceStrategyWorkflowHint(strategy: DirectorSkillStrategy) {
  if (strategy === "storyboard_narrative" || strategy === "storyboard_rapid_cut") {
    return "下一步：去参考页生成参考。";
  }
  return "不需要额外故事板，生成前仍会等待确认。";
}

function strategyUseCase(strategy: DirectorSkillStrategy) {
  if (strategy === "storyboard_narrative") return "适合构图、站位和情绪承接";
  if (strategy === "storyboard_rapid_cut") return "适合动作顺序和快切节奏";
  return "适合一个主动作和明确参考";
}

function strategyAvoidCase(strategy: DirectorSkillStrategy) {
  if (strategy === "storyboard_narrative") return "不适合塞太多动作";
  if (strategy === "storyboard_rapid_cut") return "不适合静态情绪长停顿";
  return "不适合多次切镜和复杂调度";
}

function strategyAffects(strategy: DirectorSkillStrategy) {
  if (strategy === "storyboard_narrative") return "故事板、构图、Seedance 顺序";
  if (strategy === "storyboard_rapid_cut") return "故事板、动作节点、镜头节奏";
  return "参考图、文字导演提示、QA";
}

function strategyReason(shot: StrategyShot, strategy: DirectorSkillStrategy) {
  const visibleClips = positiveNumber(shot.visibleClips);
  const storyboardPanels = positiveNumber(shot.storyboardPanels);
  if (strategy === "storyboard_rapid_cut") {
    if (visibleClips && visibleClips > 1) return `这段有 ${visibleClips} 个可见剪辑，需要先锁动作顺序和节奏。`;
    return "这段动作或剪辑密度高，需要先做动作预演。";
  }
  if (strategy === "storyboard_narrative") {
    if (storyboardPanels && storyboardPanels > 1) return `这段用 ${storyboardPanels} 格故事板锁构图、站位和情绪承接。`;
    return "这段重点在构图、站位或情绪阅读顺序。";
  }
  return "这段主动作比较集中，直接用锁定参考和文字说明更干净。";
}

export function directorSkillSummaryForShot(shot: ShotRecord) {
  const plan = buildDirectorProductionSkillPlan({
    shotId: shot.id,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    shotText: unique([
      shot.storyFunction || "",
      shot.seedanceDirection || "",
      shot.primaryAction || "",
      shot.actionTrigger || "",
      shot.microReaction || "",
    ]).join("\n"),
    executionMode: shot.executionMode,
    referenceStrategy: (shot as StrategyShot).referenceStrategy as DirectorSkillStrategy | undefined,
    actionBeats: shot.actionBeats,
    camera: shot.camera,
    visualDescription: shot.seedanceDirection || shot.storyFunction,
    assetState: {
      scene: shot.sceneGuidance?.length ? "locked" : "candidate",
      characters: shot.characterGuidance?.length ? "locked" : "candidate",
      props: shot.propGuidance?.length ? "locked" : "candidate",
    },
  });
  const strategy = plan.strategyId;
  const strategyShot = shot as StrategyShot;
  const visibleClips = positiveNumber(strategyShot.visibleClips);
  const storyboardPanels = positiveNumber(strategyShot.storyboardPanels);
  const duration = positiveNumber(shot.durationSeconds);
  const skillTags = unique([
    plan.strategyLabel,
    duration ? `${duration}s` : "",
    visibleClips && visibleClips > 1 ? `${visibleClips} 个可见剪辑` : "",
    storyboardPanels && storyboardPanels > 0 ? `故事板 ${storyboardPanels} 格` : "",
    rhythmLabels[clean(shot.rhythmProfile)] || plan.rhythmLabel || "",
    executionLabels[clean(shot.executionMode)] || "",
    shot.sceneGuidance?.length ? "场景连续" : "",
    shot.characterGuidance?.length ? "角色一致" : "",
    shot.propGuidance?.length ? "道具边界" : "",
  ]);

  return {
    strategy,
    label: plan.strategyLabel,
    detail: referenceStrategyDetail(strategy),
    reason: plan.reasons[0] || strategyReason(strategyShot, strategy),
    appliesTo: strategyUseCase(strategy),
    avoidWhen: strategyAvoidCase(strategy),
    affects: strategyAffects(strategy),
    skillTags,
  };
}
