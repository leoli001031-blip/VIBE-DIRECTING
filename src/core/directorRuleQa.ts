import type { ProjectVibeAssetKind, ProjectVibeShot } from "../project/types";
import {
  classifyReferenceAssetText,
  type ReferenceAssetType,
  type ReferenceAssetBucket,
} from "./referenceAssetStrategy";

const DIRECTOR_EXECUTION_MODES = new Set([
  "single_continuous_shot",
  "relationship_wide",
  "action_insert",
  "reaction_closeup",
  "planned_cut_sequence",
]);

export type DirectorRuleQaSeverity = "blocker" | "warning" | "info";

export type DirectorRuleQaCategory =
  | "asset_granularity"
  | "field_pollution"
  | "generation_contract"
  | "prompt_leakage"
  | "reference_integrity"
  | "storyboard_grouping";

export interface DirectorRuleQaFinding {
  code: string;
  severity: DirectorRuleQaSeverity;
  category: DirectorRuleQaCategory;
  path: string;
  message: string;
  evidence?: string;
  suggestedFix?: string;
}

export interface DirectorRuleQaAssetLike {
  id?: string;
  assetId?: string;
  kind?: ProjectVibeAssetKind | string;
  type?: ProjectVibeAssetKind | string;
  role?: string;
  roleBinding?: { role?: string };
  label?: string;
  name?: string;
  displayName?: string;
  status?: string;
  usedByShotIds?: string[];
  sourceRefs?: string[];
}

export interface DirectorRuleQaShotLike extends Partial<ProjectVibeShot> {
  shotId?: string;
  name?: string;
  trigger?: string;
  reaction?: string;
  storyboardGroupId?: string;
}

export interface DirectorRuleQaPromptLike {
  shotId?: string;
  prompt: string;
  compilerMode?: string;
  visibleClips?: number;
  storyboardPanels?: number;
  durationSeconds?: number;
}

export interface DirectorRuleQaInput {
  shots: DirectorRuleQaShotLike[];
  assets?: DirectorRuleQaAssetLike[];
  seedancePrompts?: DirectorRuleQaPromptLike[];
  targetDurationSeconds?: number;
}

export interface DirectorRuleQaReport {
  schemaVersion: "director_rule_qa_v1";
  status: "pass" | "warning" | "blocked";
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  findings: DirectorRuleQaFinding[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanPrompt(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = positiveNumber(value);
  return parsed === undefined ? undefined : Math.max(1, Math.floor(parsed));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function stableTextKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]+/gu, "")
    .trim();
}

function shotId(shot: DirectorRuleQaShotLike, index: number): string {
  return clean(shot.id || shot.shotId) || `shot_${index + 1}`;
}

function assetId(asset: DirectorRuleQaAssetLike, index: number): string {
  return clean(asset.id || asset.assetId) || `asset_${index + 1}`;
}

function assetLabel(asset: DirectorRuleQaAssetLike, index: number): string {
  return clean(asset.label || asset.name || asset.displayName || asset.id || asset.assetId) || `asset_${index + 1}`;
}

function assetSearchText(asset: DirectorRuleQaAssetLike): string {
  return [
    clean(asset.id),
    clean(asset.assetId),
    clean(asset.kind),
    clean(asset.type),
    clean(asset.role),
    clean(asset.roleBinding?.role),
    clean(asset.label),
    clean(asset.name),
    clean(asset.displayName),
    ...stringArray(asset.sourceRefs),
  ]
    .join(" ")
    .toLowerCase();
}

function isStoryboardReferenceAsset(asset: DirectorRuleQaAssetLike): boolean {
  const kind = clean(asset.kind || asset.type).toLowerCase();
  const text = assetSearchText(asset);
  return (kind === "reference" || text.includes("storyboard_reference")) && /storyboard|storyboard_reference|故事板|分镜/u.test(text);
}

function qaAssetKind(asset: DirectorRuleQaAssetLike): ReferenceAssetType | undefined {
  const kind = clean(asset.kind || asset.type).toLowerCase();
  if (kind === "character" || kind === "scene" || kind === "prop") return kind;
  return undefined;
}

function isContextPlaceholder(value: unknown): boolean {
  return /^(?:同上|同前|同场景|同一地点|同一场景|上一镜|上一镜头|前一镜|前一镜头|same|same as above|same scene)$/iu.test(clean(value));
}

function isPendingPlaceholder(value: unknown): boolean {
  return /^(?:待确认|待补|待复核|待定|未定|unknown|pending|tbd)$/iu.test(clean(value));
}

function isNonePlaceholder(value: unknown): boolean {
  return /^(?:无|没有|none|n\/a|not applicable|-|—)$/iu.test(clean(value));
}

function visibleClipBudgetRange(value: unknown): { min: number; max: number; source: "clip" | "cut" } | undefined {
  const text = clean(value);
  if (!text) return undefined;
  const clipRange = text.match(/(\d+)\s*[-~～到至]\s*(\d+)\s*个?\s*(?:最终)?(?:可见)?(?:剪辑|镜头|片段|clips?)/iu);
  if (clipRange) {
    const low = Number(clipRange[1]);
    const high = Number(clipRange[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return { min: Math.max(1, Math.min(low, high)), max: Math.max(1, Math.max(low, high)), source: "clip" };
    }
  }
  const clipExact = text.match(/(\d+)\s*个?\s*(?:最终)?(?:可见)?(?:剪辑|镜头|片段|clips?)/iu);
  if (clipExact) {
    const count = Number(clipExact[1]);
    if (Number.isFinite(count)) return { min: Math.max(1, count), max: Math.max(1, count), source: "clip" };
  }
  const cutRange = text.match(/(\d+)\s*[-~～到至]\s*(\d+)\s*个?\s*(?:可见)?切点/iu);
  if (cutRange) {
    const low = Number(cutRange[1]);
    const high = Number(cutRange[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return { min: Math.max(1, Math.min(low, high) + 1), max: Math.max(1, Math.max(low, high) + 1), source: "cut" };
    }
  }
  const cutExact = text.match(/(\d+)\s*个?\s*(?:可见)?切点/iu);
  if (cutExact) {
    const count = Number(cutExact[1]);
    if (Number.isFinite(count)) return { min: Math.max(1, count + 1), max: Math.max(1, count + 1), source: "cut" };
  }
  return undefined;
}

function addFinding(findings: DirectorRuleQaFinding[], finding: DirectorRuleQaFinding): void {
  findings.push(finding);
}

function referenceBucketMessage(bucket: ReferenceAssetBucket): string {
  if (bucket === "object_constraint") return "它更像父对象的一部分或外观约束";
  if (bucket === "scene_constraint") return "它更像场景天气、光线或空间状态";
  if (bucket === "character_constraint") return "它更像角色身体细节、表演细节或姿态约束";
  if (bucket === "shot_detail") return "它更像单个镜头动作细节";
  return "它不是一个可独立生成的参考主体";
}

function checkAssetGranularity(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  for (const [index, asset] of (input.assets || []).entries()) {
    const kind = qaAssetKind(asset);
    if (!kind) continue;
    const id = assetId(asset, index);
    const label = assetLabel(asset, index);
    const classification = classifyReferenceAssetText(label, kind);
    if (classification.bucket === "standalone") continue;

    addFinding(findings, {
      code: classification.bucket === "ignored" ? "asset_not_reference_subject" : "asset_granularity_mismatch",
      severity: "blocker",
      category: "asset_granularity",
      path: `assets.${id}`,
      message: `“${label}”不适合作为独立${kind === "character" ? "角色" : kind === "scene" ? "场景" : "道具"}参考；${referenceBucketMessage(classification.bucket)}。`,
      evidence: classification.reason,
      suggestedFix: "把它并入父级角色、场景或道具的文字约束；只为可复用主体生成参考图。",
    });
  }
}

function checkGuidanceField(
  findings: DirectorRuleQaFinding[],
  fieldPath: string,
  fieldLabel: string,
  values: string[],
  options: { noneAllowed: boolean },
): void {
  for (const [index, value] of values.entries()) {
    const path = `${fieldPath}.${index}`;
    if (isContextPlaceholder(value)) {
      addFinding(findings, {
        code: "context_placeholder_in_fact",
        severity: "blocker",
        category: "field_pollution",
        path,
        message: `正式${fieldLabel}里不能写“${value}”，它离开上下文后无法独立理解。`,
        suggestedFix: "在写入 Project.vibe 前继承并展开成具体名称。",
      });
    } else if (isPendingPlaceholder(value)) {
      addFinding(findings, {
        code: "pending_placeholder_in_fact",
        severity: "blocker",
        category: "field_pollution",
        path,
        message: `正式${fieldLabel}里不能写“${value}”。`,
        suggestedFix: "保持 staged 状态，或改成明确的角色/场景/道具约束。",
      });
    } else if (isNonePlaceholder(value) && !options.noneAllowed) {
      addFinding(findings, {
        code: "none_placeholder_not_allowed",
        severity: "blocker",
        category: "field_pollution",
        path,
        message: `正式${fieldLabel}里不能写“${value}”。`,
        suggestedFix: "场景字段需要写出可理解的地点、天气或空间状态。",
      });
    }
  }
}

function checkFieldPollution(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  for (const [index, shot] of input.shots.entries()) {
    const id = shotId(shot, index);
    const characterGuidance = stringArray(shot.characterGuidance);
    const sceneGuidance = stringArray(shot.sceneGuidance);
    const propGuidance = stringArray(shot.propGuidance);
    checkGuidanceField(findings, `shots.${id}.characterGuidance`, "角色字段", characterGuidance, { noneAllowed: true });
    checkGuidanceField(findings, `shots.${id}.sceneGuidance`, "场景字段", sceneGuidance, { noneAllowed: false });
    checkGuidanceField(findings, `shots.${id}.propGuidance`, "道具字段", propGuidance, { noneAllowed: true });
    if (!sceneGuidance.length) {
      addFinding(findings, {
        code: "missing_scene_guidance",
        severity: "warning",
        category: "field_pollution",
        path: `shots.${id}.sceneGuidance`,
        message: "镜头缺少场景字段，后续参考选择和视频提示词容易漂移。",
        suggestedFix: "至少补一个地点/天气/光线基准，例如“清晨旧书店”或“雨夜山路弯道”。",
      });
    }
  }
}

function checkGenerationContract(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  let totalDuration = 0;
  for (const [index, shot] of input.shots.entries()) {
    const id = shotId(shot, index);
    const strategy = clean(shot.referenceStrategy);
    const executionMode = clean(shot.executionMode);
    const durationSeconds = positiveNumber(shot.durationSeconds);
    if (executionMode && !DIRECTOR_EXECUTION_MODES.has(executionMode)) {
      addFinding(findings, {
        code: "invalid_execution_mode",
        severity: "blocker",
        category: "generation_contract",
        path: `shots.${id}.executionMode`,
        message: `镜头执行模式“${executionMode}”不在正式合同中。`,
        evidence: executionMode,
        suggestedFix: "使用 single_continuous_shot、relationship_wide、action_insert、reaction_closeup 或 planned_cut_sequence。",
      });
    }
    if (!durationSeconds) {
      addFinding(findings, {
        code: "invalid_duration",
        severity: "blocker",
        category: "generation_contract",
        path: `shots.${id}.durationSeconds`,
        message: "镜头时长必须是大于 0 的数字。",
        suggestedFix: "给每个镜头明确 durationSeconds。",
      });
    } else {
      totalDuration += durationSeconds;
      if (!Number.isInteger(durationSeconds)) {
        addFinding(findings, {
          code: "fractional_video_duration",
          severity: "blocker",
          category: "generation_contract",
          path: `shots.${id}.durationSeconds`,
          message: `镜头时长 ${durationSeconds}s 不是视频模型友好的整数秒。`,
          suggestedFix: "把单个视频段时长量化为 4-15 秒之间的整数，例如 4、5、6、8 或 12 秒。",
        });
      }
      if (durationSeconds < 4) {
        addFinding(findings, {
          code: "short_single_video_unit",
          severity: "blocker",
          category: "generation_contract",
          path: `shots.${id}.durationSeconds`,
          message: `单个视频段 ${durationSeconds}s 低于即梦/Seedance 常用最小时长。`,
          suggestedFix: "合并到相邻镜头，或把该段改为至少 4 秒。",
        });
      }
      if (durationSeconds > 15) {
        addFinding(findings, {
          code: "long_single_video_unit",
          severity: "warning",
          category: "generation_contract",
          path: `shots.${id}.durationSeconds`,
          message: `单个视频段 ${durationSeconds}s 偏长，复杂动作可能压不完。`,
          suggestedFix: "超过 15 秒的复杂段落建议拆成多个视频任务或改成故事板快切。",
        });
      }
    }

    const visibleClips = positiveInteger(shot.visibleClips);
    const storyboardPanels = positiveInteger(shot.storyboardPanels);
    const actionBeats = stringArray(shot.actionBeats);
    const visibleClipBudget = visibleClipBudgetRange(shot.splitPolicy);

    if (visibleClips && visibleClipBudget && (visibleClips < visibleClipBudget.min || visibleClips > visibleClipBudget.max)) {
      addFinding(findings, {
        code: "visible_clip_budget_conflict",
        severity: "blocker",
        category: "generation_contract",
        path: `shots.${id}.splitPolicy`,
        message: `镜头写了 ${visibleClips} 个最终可见剪辑，但节奏说明对应 ${visibleClipBudget.min === visibleClipBudget.max ? visibleClipBudget.min : `${visibleClipBudget.min}-${visibleClipBudget.max}`} 个。`,
        evidence: clean(shot.splitPolicy),
        suggestedFix: visibleClipBudget.source === "cut"
          ? "把“可见切点”改成“最终可见剪辑”，并同步 visibleClips/storyboardPanels/actionBeats。"
          : "让 splitPolicy、visibleClips 和 storyboardPanels 使用同一套数量合同。",
      });
    }

    if (strategy === "omni_reference" && storyboardPanels) {
      addFinding(findings, {
        code: "omni_has_storyboard_panels",
        severity: "blocker",
        category: "generation_contract",
        path: `shots.${id}.storyboardPanels`,
        message: "全能参考模式不应该携带 storyboardPanels；它应是一段连续视频请求。",
        suggestedFix: "需要多动作节点时切到故事板叙事/快切；否则移除 storyboardPanels。",
      });
    }

    if (strategy === "storyboard_rapid_cut") {
      const effectivePanels = storyboardPanels || actionBeats.length;
      if (!effectivePanels) {
        addFinding(findings, {
          code: "rapid_cut_missing_panels",
          severity: "blocker",
          category: "generation_contract",
          path: `shots.${id}.storyboardPanels`,
          message: "故事板快切需要明确 storyboardPanels 或 actionBeats，否则模型会自己乱拆。",
          suggestedFix: "把快切动作拆成 2-12 个 actionBeats，并同步 storyboardPanels。",
        });
      }
      if (visibleClips && effectivePanels && effectivePanels < visibleClips) {
        addFinding(findings, {
          code: "rapid_panels_less_than_visible_clips",
          severity: "blocker",
          category: "generation_contract",
          path: `shots.${id}`,
          message: `故事板快切的 storyboardPanels/actionBeats (${effectivePanels}) 不能少于 visibleClips (${visibleClips})。`,
          suggestedFix: "增加 storyboardPanels，或降低最终可见剪辑数。",
        });
      }
    }

    if (strategy === "storyboard_narrative" && visibleClips && storyboardPanels && storyboardPanels < visibleClips) {
      addFinding(findings, {
        code: "narrative_panels_less_than_visible_clips",
        severity: "blocker",
        category: "generation_contract",
        path: `shots.${id}`,
        message: `故事板叙事的 storyboardPanels (${storyboardPanels}) 不能少于 visibleClips (${visibleClips})。`,
        suggestedFix: "让每个最终可见剪辑至少有一个故事板面板。",
      });
    }

    if (!strategy && (visibleClips || storyboardPanels || actionBeats.length)) {
      addFinding(findings, {
        code: "missing_reference_strategy",
        severity: "warning",
        category: "generation_contract",
        path: `shots.${id}.referenceStrategy`,
        message: "镜头已有剪辑/故事板字段，但没有 referenceStrategy。",
        suggestedFix: "明确选择 storyboard_narrative、storyboard_rapid_cut 或 omni_reference。",
      });
    }
  }

  const target = positiveNumber(input.targetDurationSeconds);
  if (target && totalDuration && Math.abs(totalDuration - target) > 1) {
    addFinding(findings, {
      code: "duration_total_mismatch",
      severity: "warning",
      category: "generation_contract",
      path: "targetDurationSeconds",
      message: `镜头时长合计 ${Number(totalDuration.toFixed(2))}s，与目标 ${target}s 不一致。`,
      suggestedFix: "提交前重新分配每段 durationSeconds，或更新目标总时长。",
    });
  }
}

function sceneSignatureFor(shot: DirectorRuleQaShotLike): string {
  const sceneAssetIds = stringArray(shot.sceneAssetIds).map(stableTextKey).filter(Boolean).sort();
  if (sceneAssetIds.length) return `asset:${sceneAssetIds.join("+")}`;
  const sceneGuidance = stringArray(shot.sceneGuidance).map(stableTextKey).filter(Boolean).sort();
  return sceneGuidance.length ? `guidance:${sceneGuidance.join("+")}` : "missing";
}

function sceneGuidanceSignatureFor(shot: DirectorRuleQaShotLike): string {
  const sceneGuidance = stringArray(shot.sceneGuidance).map(stableTextKey).filter(Boolean).sort();
  return sceneGuidance.length ? sceneGuidance.join("+") : "";
}

function checkStoryboardGrouping(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  const groups = new Map<string, Array<{ shot: DirectorRuleQaShotLike; id: string; index: number }>>();
  for (const [index, shot] of input.shots.entries()) {
    const groupId = clean(shot.storyboardGroupId);
    if (!groupId) continue;
    groups.set(groupId, [...(groups.get(groupId) || []), { shot, id: shotId(shot, index), index }]);
  }

  for (const [groupId, groupShots] of groups.entries()) {
    if (groupShots.length <= 1) continue;
    const storyboardShots = groupShots.filter(({ shot }) => {
      const strategy = clean(shot.referenceStrategy);
      return strategy === "storyboard_narrative" || strategy === "storyboard_rapid_cut";
    });
    if (storyboardShots.length <= 1) continue;

    const sceneSignatures = new Map<string, string[]>();
    const sceneGuidanceSignatures = new Map<string, string[]>();
    const sceneAssetIds = new Set<string>();
    for (const { shot, id } of storyboardShots) {
      const signature = sceneSignatureFor(shot);
      sceneSignatures.set(signature, [...(sceneSignatures.get(signature) || []), id]);
      const guidanceSignature = sceneGuidanceSignatureFor(shot);
      if (guidanceSignature) sceneGuidanceSignatures.set(guidanceSignature, [...(sceneGuidanceSignatures.get(guidanceSignature) || []), id]);
      for (const sceneAssetId of stringArray(shot.sceneAssetIds)) sceneAssetIds.add(sceneAssetId);
    }

    const sceneConflict = sceneGuidanceSignatures.size > 1 || (sceneGuidanceSignatures.size === 0 && sceneSignatures.size > 1);
    if (sceneConflict) {
      const evidenceGroups = sceneGuidanceSignatures.size > 1 ? sceneGuidanceSignatures : sceneSignatures;
      addFinding(findings, {
        code: "storyboard_group_scene_conflict",
        severity: "blocker",
        category: "storyboard_grouping",
        path: `storyboardGroups.${groupId}.scene`,
        message: "同一个故事板组里出现了多个场景基准，视频模型会把空间和天气混在一起。",
        evidence: Array.from(evidenceGroups.entries()).map(([signature, shotIds]) => `${signature}: ${shotIds.join(",")}`).join(" | "),
        suggestedFix: "不同场景拆成不同故事板/视频任务；如果其实是同一场景，就统一 sceneGuidance 和 sceneAssetIds。",
      });
    } else if (sceneGuidanceSignatures.size === 1 && sceneAssetIds.size > 1) {
      addFinding(findings, {
        code: "duplicated_scene_asset_for_same_storyboard_group",
        severity: "warning",
        category: "storyboard_grouping",
        path: `storyboardGroups.${groupId}.sceneAssetIds`,
        message: "同一故事板组看起来是同一个场景，但绑定了多个场景参考，容易造成天气/光线不一致。",
        evidence: Array.from(sceneAssetIds).join(", "),
        suggestedFix: "同一场景优先共用一个场景/天气基准图；变化只写进镜头动作或光线约束。",
      });
    }
  }
}

function checkStoryboardReferenceAssetScope(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  const shotsById = new Map<string, DirectorRuleQaShotLike>();
  for (const [index, shot] of input.shots.entries()) {
    shotsById.set(shotId(shot, index), shot);
  }

  for (const [index, asset] of (input.assets || []).entries()) {
    if (!isStoryboardReferenceAsset(asset)) continue;
    const id = assetId(asset, index);
    const usedShotIds = Array.from(new Set(stringArray(asset.usedByShotIds))).filter((usedShotId) => shotsById.has(usedShotId));
    if (usedShotIds.length <= 1) continue;

    const groupIds = new Set<string>();
    let hasMissingGroup = false;
    for (const usedShotId of usedShotIds) {
      const groupId = clean(shotsById.get(usedShotId)?.storyboardGroupId);
      if (!groupId) {
        hasMissingGroup = true;
      } else {
        groupIds.add(groupId);
      }
    }

    if (hasMissingGroup || groupIds.size !== 1) {
      addFinding(findings, {
        code: "storyboard_reference_multi_shot_without_group",
        severity: "blocker",
        category: "storyboard_grouping",
        path: `assets.${id}.usedByShotIds`,
        message: `故事板参考“${assetLabel(asset, index)}”绑定了多个镜头，但这些镜头没有明确属于同一个故事板组。`,
        evidence: usedShotIds.join(", "),
        suggestedFix: "如果它是一个连续视频段，给这些镜头写同一个 storyboardGroupId；否则拆成每个视频段各自的故事板参考。",
      });
    }
  }
}

function extractExactVisibleClipCount(prompt: string): number | undefined {
  const english = prompt.match(/Create exactly\s+(\d+)\s+visible clip/i);
  if (english) return Number(english[1]);
  const chinese = prompt.match(/(?:精确|正好|恰好)\s*(\d+)\s*个(?:最终)?(?:可见)?(?:剪辑|镜头|片段)/u);
  return chinese ? Number(chinese[1]) : undefined;
}

function extractTotalDurationSeconds(prompt: string): number | undefined {
  const english = prompt.match(/Total duration:\s*(\d+(?:\.\d+)?)s/i);
  if (english) return Number(english[1]);
  const chinese = prompt.match(/总时长[:：]\s*(\d+(?:\.\d+)?)\s*秒/u);
  return chinese ? Number(chinese[1]) : undefined;
}

function isNegativeInstruction(line: string): boolean {
  return /(?:do not|don't|never|no\s+|without|must not|cannot|禁止|不要|不得|切勿|不渲染|不要渲染|不要生成|不包含|无|不能)/i.test(line);
}

function hasPositiveRenderIntent(line: string): boolean {
  return /(?:render|show|display|include|copy|turn(?:\s+\w+){0,4}\s+into|visible|appear|渲染|显示|出现|复制|照搬|变成|呈现|带入|进入成片|可见)/i.test(line);
}

function checkPromptLeakage(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  for (const [index, promptInput] of (input.seedancePrompts || []).entries()) {
    const prompt = cleanPrompt(promptInput.prompt);
    const promptFlat = clean(prompt);
    const promptPath = `seedancePrompts.${promptInput.shotId || index}`;
    if (!prompt) {
      addFinding(findings, {
        code: "empty_seedance_prompt",
        severity: "blocker",
        category: "prompt_leakage",
        path: promptPath,
        message: "Seedance prompt 不能为空。",
      });
      continue;
    }

    const exactVisibleClips = extractExactVisibleClipCount(promptFlat);
    if (promptInput.visibleClips && exactVisibleClips !== undefined && exactVisibleClips !== promptInput.visibleClips) {
      addFinding(findings, {
        code: "prompt_visible_clip_count_mismatch",
        severity: "blocker",
        category: "prompt_leakage",
        path: `${promptPath}.visibleClips`,
        message: `Seedance prompt 写的是 ${exactVisibleClips} 个可见剪辑，但编译合同是 ${promptInput.visibleClips} 个。`,
        suggestedFix: "以编译合同为准，重新生成 prompt 的可见剪辑数量。",
      });
    }

    const totalDuration = extractTotalDurationSeconds(promptFlat);
    if (promptInput.durationSeconds && totalDuration !== undefined && Math.abs(totalDuration - promptInput.durationSeconds) > 0.5) {
      addFinding(findings, {
        code: "prompt_duration_mismatch",
        severity: "blocker",
        category: "prompt_leakage",
        path: `${promptPath}.durationSeconds`,
        message: `Seedance prompt 写的是 ${totalDuration}s，但编译合同是 ${promptInput.durationSeconds}s。`,
        suggestedFix: "以编译合同为准，重新生成 prompt 的总时长。",
      });
    }

    if (!/(?:No music,\s*no BGM|无BGM|无音乐|不要生成配乐|不要生成背景音乐)/i.test(promptFlat)) {
      addFinding(findings, {
        code: "missing_no_bgm_guard",
        severity: "warning",
        category: "prompt_leakage",
        path: promptPath,
        message: "Seedance prompt 缺少 no BGM/no music 保护句。",
        suggestedFix: "视频模型只负责画面；配乐应在最终合成阶段处理。",
      });
    }

    if (promptInput.compilerMode === "storyboard_rapid_cut" && promptInput.storyboardPanels && promptInput.visibleClips) {
      const hasContractExplanation = /extra storyboard panels are actionBeats only|storyboard panel\(s\) only as internal|内部.*(?:动作|节奏|规划)/i.test(promptFlat);
      if (promptInput.storyboardPanels > promptInput.visibleClips && !hasContractExplanation) {
        addFinding(findings, {
          code: "missing_panel_clip_contract_explanation",
          severity: "blocker",
          category: "prompt_leakage",
          path: promptPath,
          message: "故事板面板数大于最终可见剪辑数时，prompt 必须说明额外面板只是 actionBeats。",
          suggestedFix: "加入：extra storyboard panels are actionBeats only; do not turn them into extra final cuts.",
        });
      }
    }

    const lines = prompt.split(/\n+/u).map((line) => line.trim()).filter(Boolean);
    for (const [lineIndex, line] of lines.entries()) {
      const linePath = `${promptPath}.lines.${lineIndex + 1}`;
      const negative = isNegativeInstruction(line);
      const musicTerm = /(?:\bBGM\b|\bmusic\b|\bsoundtrack\b|\bsong\b|背景音乐|配乐|歌曲|音乐)/i.test(line);
      if (musicTerm && !negative) {
        const isAudioPostNote = /(?:post-production audio reference|后期声音参考|后续对白|后期编辑|sound intention|声音意图|audio reference)/i.test(line);
        const isRhythmOnly = /(?:rhythm|节奏|节拍)/i.test(line) && !/(?:as\s+BGM|作为\s*BGM|作为背景音乐|生成配乐|加入配乐|use.*music.*BGM)/i.test(line);
        if (!isAudioPostNote && !isRhythmOnly) {
          addFinding(findings, {
            code: "positive_music_instruction",
            severity: "blocker",
            category: "prompt_leakage",
            path: linePath,
            message: "Seedance prompt 里出现了正向音乐/BGM 指令。",
            evidence: line,
            suggestedFix: "把音乐只留给节奏规划或后期合成；视频 prompt 里只保留 no BGM 保护句。",
          });
        }
      }

      const artifactTerm = /(?:panel boxes?|borders?|arrows?|numbers?|notes?|labels?|time marks?|sketch overlays?|white margins?|storyboard artifacts?|面板框|分镜框|边框|箭头|数字|编号|注释|标签|时间标记|草图叠加|白边|故事板制作痕迹|故事板痕迹)/i.test(line);
      if (artifactTerm && !negative && hasPositiveRenderIntent(line)) {
        addFinding(findings, {
          code: "positive_storyboard_artifact_instruction",
          severity: "blocker",
          category: "prompt_leakage",
          path: linePath,
          message: "Seedance prompt 里出现了正向渲染故事板标注/边框/文字的指令。",
          evidence: line,
          suggestedFix: "只允许“不要渲染标注/边框/文字”这类负向保护句。",
        });
      }
    }
  }
}

function checkReferenceIntegrity(input: DirectorRuleQaInput, findings: DirectorRuleQaFinding[]): void {
  const shotIds = new Set(input.shots.map((shot, index) => shotId(shot, index)));
  const assetsById = new Map<string, DirectorRuleQaAssetLike>();
  for (const [index, asset] of (input.assets || []).entries()) {
    assetsById.set(assetId(asset, index), asset);
  }

  function checkIds(ids: string[], expectedKind: ReferenceAssetType, pathPrefix: string): void {
    for (const id of ids) {
      const asset = assetsById.get(id);
      if (!asset) {
        addFinding(findings, {
          code: "missing_asset_reference",
          severity: "warning",
          category: "reference_integrity",
          path: `${pathPrefix}.${id}`,
          message: `镜头引用了不存在的资产：${id}。`,
          suggestedFix: "删除失效引用，或重新生成并锁定对应资产。",
        });
        continue;
      }
      const kind = qaAssetKind(asset);
      if (kind && kind !== expectedKind) {
        addFinding(findings, {
          code: "asset_kind_mismatch",
          severity: "warning",
          category: "reference_integrity",
          path: `${pathPrefix}.${id}`,
          message: `镜头把 ${assetLabel(asset, 0)} 当作 ${expectedKind} 使用，但资产类型是 ${kind}。`,
          suggestedFix: "修正资产绑定类型，避免角色/场景/道具互相串用。",
        });
      }
    }
  }

  for (const [index, shot] of input.shots.entries()) {
    const id = shotId(shot, index);
    checkIds(stringArray(shot.characterAssetIds), "character", `shots.${id}.characterAssetIds`);
    checkIds(stringArray(shot.sceneAssetIds), "scene", `shots.${id}.sceneAssetIds`);
    checkIds(stringArray(shot.propAssetIds), "prop", `shots.${id}.propAssetIds`);
  }

  for (const [index, asset] of (input.assets || []).entries()) {
    const id = assetId(asset, index);
    for (const usedByShotId of stringArray(asset.usedByShotIds)) {
      if (!shotIds.has(usedByShotId)) {
        addFinding(findings, {
          code: "asset_used_by_missing_shot",
          severity: "warning",
          category: "reference_integrity",
          path: `assets.${id}.usedByShotIds`,
          message: `资产“${assetLabel(asset, index)}”绑定了不存在的镜头 ${usedByShotId}。`,
          suggestedFix: "刷新资产索引，或移除过期绑定。",
        });
      }
    }
  }
}

export function runDirectorRuleQa(input: DirectorRuleQaInput): DirectorRuleQaReport {
  const findings: DirectorRuleQaFinding[] = [];
  checkAssetGranularity(input, findings);
  checkFieldPollution(input, findings);
  checkGenerationContract(input, findings);
  checkStoryboardGrouping(input, findings);
  checkStoryboardReferenceAssetScope(input, findings);
  checkPromptLeakage(input, findings);
  checkReferenceIntegrity(input, findings);

  const blockerCount = findings.filter((finding) => finding.severity === "blocker").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const infoCount = findings.filter((finding) => finding.severity === "info").length;
  return {
    schemaVersion: "director_rule_qa_v1",
    status: blockerCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "pass",
    blockerCount,
    warningCount,
    infoCount,
    findings,
  };
}
