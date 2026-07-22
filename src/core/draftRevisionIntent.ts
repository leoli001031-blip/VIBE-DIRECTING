import { stripDirectorAgentPermissionControlPhrases } from "./directorAgentPermissionIntent";

const localizedShotNumberToken = String.raw`([0-9０-９]{1,3}|一|二|两|俩|三|四|五|六|七|八|九|十|十[一二两俩三四五六七八九]|[一二两俩三四五六七八九]十[一二两俩三四五六七八九]?)`;

const removableContentLabels: Array<[RegExp, string]> = [
  [/月亮/u, "月亮"],
  [/怀表/u, "怀表"],
  [/耳机/u, "耳机"],
  [/广告牌/u, "广告牌"],
  [/站牌/u, "站牌"],
  [/随身听|Walkman/i, "随身听"],
  [/小提琴/u, "小提琴"],
  [/纸飞机/u, "纸飞机"],
  [/灯箱/u, "灯箱"],
  [/发光(?:的)?鸟|光鸟/u, "发光鸟"],
  [/热豆浆|豆浆/u, "热豆浆"],
  [/发光字/u, "发光字"],
  [/车票/u, "车票"],
  [/电影票|票根|门票/u, "电影票"],
  [/湿火柴|被雨淋湿(?:的)?火柴|火柴/u, "湿火柴"],
  [/空菜篮|菜篮/u, "菜篮"],
  [/透明(?:的)?小鱼|透明(?:的)?鱼/u, "透明鱼"],
];

export type DraftRevisionTargetKind = "ordinal" | "tail" | "selected";
export type DraftRevisionOperation = "revise" | "move_scene" | "remove_content" | "preserve_target";

export type DraftRevisionItem = {
  rawText: string;
  targetKind: DraftRevisionTargetKind;
  shotNumber: number;
  targetLabel: string;
  targetFact: string;
  operation: DraftRevisionOperation;
  revisionText: string;
  removalTargets: string[];
  preserveAction: boolean;
  protectedAction: string;
  actionOnly: boolean;
};

export type DraftRevisionIntent = {
  rawText: string;
  items: DraftRevisionItem[];
  multiTarget: boolean;
};

export type DraftRevisionPreview = {
  label: string;
  targetLabel: string;
  targetFact: string;
  changeFact: string;
  preserveAction: boolean;
  body: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function stripPromptPrefix(text: string) {
  return cleanText(text).replace(/^(?:修改这版草案|修改当前草案|继续修改草案|继续改草案)\s*[：:]\s*/u, "");
}

function parseLocalizedShotNumber(value: string) {
  const normalized = cleanText(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  if (/^\d{1,3}$/u.test(normalized)) return Number.parseInt(normalized, 10);
  const digitValues: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (normalized === "十") return 10;
  const teenMatch = normalized.match(/^十([一二两俩三四五六七八九])$/u);
  if (teenMatch) return 10 + (digitValues[teenMatch[1] || ""] || 0);
  const tenMatch = normalized.match(/^([一二两俩三四五六七八九])十([一二两俩三四五六七八九])?$/u);
  if (tenMatch) return (digitValues[tenMatch[1] || ""] || 0) * 10 + (digitValues[tenMatch[2] || ""] || 0);
  return digitValues[normalized];
}

function tailEndingRevisionText(text: string) {
  const match = stripPromptPrefix(text).match(
    /(?:^|[，,。；;])\s*(?:最后|末尾|结尾|最终)\s*(?:(?:停在|停到|落在|收在|结束在|定格在)|(?:只)?(?:保留|保持|留下|留下来))\s*([^，,。；;]{2,80})/u,
  );
  return cleanText(match?.[1]);
}

function intentTargetsSelectedShot(text: string) {
  return /(?:这个(?!\s*(?:故事|草案|项目|短片|视频))|这段|这一镜|这镜|这里|当前镜头)\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)?/iu.test(text);
}

function targetForText(text: string, shotCount: number, selectedShotNumber?: number) {
  const cleaned = stripPromptPrefix(text);
  if (selectedShotNumber && intentTargetsSelectedShot(cleaned)) {
    return { kind: "selected" as const, shotNumber: selectedShotNumber };
  }
  const tailMatch = cleaned.match(/(?:把|将|让|请把|请将)?\s*(?:最后|末尾|结尾|最终)\s*(?:那|这|那一|这一|一)?\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)/iu);
  if ((tailMatch || tailEndingRevisionText(cleaned)) && shotCount > 0) {
    return { kind: "tail" as const, shotNumber: shotCount };
  }
  const ordinalMatch = cleaned.match(new RegExp(String.raw`(?:把|将|让|请把|请将)?\s*(?:只在|在)?\s*第\s*${localizedShotNumberToken}\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)`, "iu"));
  const shotNumber = ordinalMatch ? parseLocalizedShotNumber(ordinalMatch[1] || "") : undefined;
  if (!shotNumber || shotNumber < 1 || (shotCount > 0 && shotNumber > shotCount)) return undefined;
  return { kind: "ordinal" as const, shotNumber };
}

function protectedActionFromText(text: string) {
  const match = stripPromptPrefix(text).match(
    /(?:保留|保持|留下|留下来)[^。；;]{0,56}?((?:用|把|将|让)[^，,。；;]{2,28}?)(?:的)?动作/u,
  );
  return cleanText(match?.[1]);
}

function removalTargetsFromText(text: string) {
  const clauses = stripPromptPrefix(text)
    .split(/[，,。；;]/u)
    .map(cleanText)
    .filter(Boolean);
  const labels: string[] = [];
  for (const clause of clauses) {
    if (/(?:参考图|参考|视频|提交|发送|生成|导出|旁白|配音|解说|字幕|音乐|BGM)/iu.test(clause)) continue;
    const hasRemovalCue = /(?:不要再提|去掉|移除|删掉|删除|不用)/u.test(clause)
      || /(?:不要|别)\s*(?!让|使|把|将|完整|完全|立刻|立即|马上)(?:再)?[^，,。；;]{0,20}/u.test(clause);
    if (!hasRemovalCue) continue;
    for (const [pattern, label] of removableContentLabels) {
      if (pattern.test(clause)) labels.push(label);
    }
    const explicitMatch = clause.match(/(?:不要再提|去掉|移除|删掉|删除)\s*([^，,。；;!?！？]{1,24})/u);
    const explicitTarget = cleanText(explicitMatch?.[1] || "")
      .replace(/^(?:这?个|那?个)/u, "")
      .replace(/(?:的)?(?:画面|元素|内容)$/u, "");
    if (explicitTarget && !/(?:完整)?出现|立刻消失|马上消失|参考|视频|保存|导出/u.test(explicitTarget)) {
      labels.push(explicitTarget);
    }
  }
  return Array.from(new Set(labels));
}

function explicitlyRequestsSceneRevision(text: string) {
  return /(?:场景|地点|环境)[^，,。；;]{0,12}(?:改到|改为|改成|换到|换至|放到|放在|移到|移至|挪到|调整到|调整为)/u.test(text)
    || /(?:放到|放在|移到|移至|挪到|换到|换至|改到|调整到)/u.test(text);
}

function cleanRevisionText(text: string, removalTargets: string[]) {
  const targetShotPattern = String.raw`(?:第\s*${localizedShotNumberToken}|(?:最后|末尾|结尾|最终)\s*(?:那|这|那一|这一|一)?)\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)`;
  const targetPrefixPattern = new RegExp(String.raw`^(?:(?:这个|这段|这一镜|这镜|这里)?\s*(?:不对|不行|不准确|不太对)\s*[，,。；;\s]*)?(?:把|将|让|请把|请将)?\s*${targetShotPattern}\s*(?:放到|放在|移到|移至|挪到|换到|换至|改成|改为|调整成|调整为|换成|替换成|变成|变为|做成)?\s*`, "iu");
  const inlineTargetPattern = new RegExp(String.raw`([，,；;]\s*)(?:只在|在)?\s*${targetShotPattern}\s*`, "iu");
  const selectedTargetPrefixPattern = /^(?:这个(?!\s*(?:故事|草案|项目|短片|视频))|这段|这一镜|这镜|这里|当前镜头)\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)?\s*[，,。；;:\s：]*/iu;
  const sceneOnlyControlPattern = /(?:只改场景不要改动作|只改场景|不要改动作|不要改变动作|不改动作|不改变动作|保留动作|动作不变|动作保持不变)/giu;
  const actionOnlyControlPattern = /^[：:，,。；;\s]*(?:只)?(?:改|修改|调整)(?:这(?:个)?镜头的)?(?:动作|行为)\s*[：:，,。；;\s]*/iu;
  const safetyClausePattern = /(?:仍然|依然|继续)?\s*(?:先)?(?:不要|别|不|不用|先不要|先别)[^，,。；;]*(?:参考图|参考|视频|提交|发送|生成|导出)[^，,。；;]*/giu;
  const workflowControlClausePattern = /(?:先)?(?:形成|进入|给出|给我|等待)?\s*(?:修改)?确认(?:流程|卡|状态)?|(?:先)?(?:不要|别|不|不用|先不要|先别)[^，,。；;]*(?:保存|写入|素材|导出)[^，,。；;]*/giu;
  const audioControlClausePattern = /(?:不要|别|不|不用|不加|别加|不要加)\s*(?:旁白|配音|解说|字幕|音乐|BGM)[^，,。；;]*/giu;
  const repetitionControlPattern = new RegExp(String.raw`(?:不要|别|不)(?:再)?重复(?:第\s*${localizedShotNumberToken}\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)|上一镜|前一镜|这个镜头)[^，,。；;]*`, "giu");
  const removalPattern = removalTargets.length
    ? new RegExp(String.raw`(?:不要再提|不要|别|不用|去掉|移除|删掉|删除)[^，,。；;]*(?:${removalTargets.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[^，,。；;]*`, "giu")
    : undefined;
  const source = tailEndingRevisionText(text) || stripPromptPrefix(text);
  let cleaned = cleanText(stripDirectorAgentPermissionControlPhrases(source))
    .replace(safetyClausePattern, " ")
    .replace(workflowControlClausePattern, " ")
    .replace(repetitionControlPattern, " ")
    .replace(targetPrefixPattern, " ")
    .replace(inlineTargetPattern, "$1")
    .replace(selectedTargetPrefixPattern, " ")
    .replace(sceneOnlyControlPattern, " ")
    .replace(/^[：:，,。；;\s]*(?:场景|地点|环境)\s*(?:改到|改为|改成|换到|换至|放到|放在|移到|移至|挪到|调整到|调整为)\s*/iu, " ")
    .replace(/^[：:，,。；;\s]*(?:改到|改为|改成|换到|换至|放到|放在|移到|移至|挪到|调整到|调整为)\s*/iu, " ")
    .replace(actionOnlyControlPattern, " ")
    .replace(/^\s*(?:改得|改得更|改得更清楚|改清楚|调整得更清楚)[^：:，,。；;]*[：:，,]?\s*/u, " ")
    .replace(audioControlClausePattern, " ");
  if (removalPattern) cleaned = cleaned.replace(removalPattern, " ");
  return cleanText(cleaned
    .replace(/(?:^|[，,。；;\s])(?:图或|参考图或|参考或)(?=$|[，,。；;\s])/giu, " ")
    .replace(/(?:只)?(?:保留|留下|留下来)\s*/giu, " ")
    .replace(/(?:仍然|依然|继续)?\s*(?:保持|保留)\s*/giu, " ")
    .replace(/[，,]\s*[，,]+/gu, "，")
    .replace(/[，,]\s*([。；;])/gu, "$1")
    .replace(/^[：:，,。；;\s]+|[：:，,。；;\s]+$/gu, ""));
}

function preservesTargetShot(text: string) {
  return /^(?:最后|末尾|结尾|最终)\s*(?:只)?(?:保留|保持|留下|留下来)/u.test(stripPromptPrefix(text));
}

function parseSingleRevision(
  text: string,
  shotCount: number,
  selectedShotNumber?: number,
): DraftRevisionItem | undefined {
  const rawText = cleanText(text);
  const target = targetForText(rawText, shotCount, selectedShotNumber);
  if (!target) return undefined;
  const removalTargets = removalTargetsFromText(rawText);
  const preserveAction = /(?:只改场景|不要改动作|不要改变动作|不改动作|不改变动作|保留动作|动作不变|动作保持不变)/iu.test(rawText);
  const actionOnly = /(?:只)?(?:改|修改|调整)(?:这(?:个)?镜头的)?(?:动作|行为)\s*[：:]/iu.test(rawText);
  const preserveTarget = preservesTargetShot(rawText);
  const sceneRevision = explicitlyRequestsSceneRevision(rawText);
  const revisionText = cleanRevisionText(rawText, removalTargets);
  const operation: DraftRevisionOperation = preserveTarget
    ? "preserve_target"
    : sceneRevision
      ? "move_scene"
      : removalTargets.length && !revisionText
        ? "remove_content"
        : "revise";
  const targetLabel = target.kind === "tail" ? "最后一镜" : `第 ${target.shotNumber} 镜`;
  const targetFact = target.kind === "selected"
    ? `${targetLabel}（已选中）`
    : target.kind === "tail" && removalTargets.length
      ? `${targetLabel}（含${removalTargets.join("、")}的镜头）`
      : target.kind === "tail"
        ? `${targetLabel}（第 ${target.shotNumber} 镜）`
        : targetLabel;
  return {
    rawText,
    targetKind: target.kind,
    shotNumber: target.shotNumber,
    targetLabel,
    targetFact,
    operation,
    revisionText,
    removalTargets,
    preserveAction,
    protectedAction: protectedActionFromText(rawText),
    actionOnly,
  };
}

function explicitMultiTargetClauses(text: string, shotCount: number) {
  const cleaned = stripPromptPrefix(text);
  const markerPattern = new RegExp(String.raw`(?:把|将|让|请把|请将)?\s*(?:(?:只在|在)?\s*第\s*${localizedShotNumberToken}\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)|(?:最后|末尾|结尾|最终)\s*(?:那|这|那一|这一|一)?\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)|(?:最后|末尾|结尾|最终)(?=\s*(?:只)?(?:保留|保持|留下|留下来)))`, "giu");
  const markers = Array.from(cleaned.matchAll(markerPattern))
    .filter((match) => {
      const start = match.index ?? 0;
      return start === 0 || /[，,。；;!?！？\n]/u.test(cleaned[start - 1] || "");
    })
    .map((match) => ({
      start: match.index ?? 0,
      target: /(?:最后|末尾|结尾|最终)/u.test(match[0]) && shotCount > 0
        ? { kind: "tail" as const, shotNumber: shotCount }
        : targetForText(match[0], shotCount),
    }))
    .filter((marker): marker is { start: number; target: { kind: DraftRevisionTargetKind; shotNumber: number } } => Boolean(marker.target));
  if (new Set(markers.map((marker) => marker.target.shotNumber)).size < 2) return [];
  return markers.map((marker, index) => cleanText(cleaned.slice(
    index === 0 ? 0 : marker.start,
    markers[index + 1]?.start,
  ).replace(/^[，,。；;!?！？\s]+|[，,。；;!?！？\s]+$/gu, ""))).filter(Boolean);
}

export function parseDraftRevisionIntent(input: {
  text: string;
  shotCount: number;
  selectedShotNumber?: number;
}): DraftRevisionIntent | undefined {
  const rawText = stripPromptPrefix(input.text);
  if (!rawText) return undefined;
  const clauses = explicitMultiTargetClauses(rawText, input.shotCount);
  const items = clauses.length >= 2
    ? clauses.map((clause) => parseSingleRevision(clause, input.shotCount)).filter((item): item is DraftRevisionItem => Boolean(item))
    : [parseSingleRevision(rawText, input.shotCount, input.selectedShotNumber)].filter((item): item is DraftRevisionItem => Boolean(item));
  if (!items.length || (clauses.length >= 2 && items.length !== clauses.length)) return undefined;
  return {
    rawText,
    items,
    multiTarget: items.length > 1,
  };
}

function itemChangeFact(item: DraftRevisionItem) {
  if (item.operation === "preserve_target") return "保留原镜头";
  if (item.operation === "remove_content") return `去掉${item.removalTargets.join("、")}`;
  const revisionText = cleanText([
    item.protectedAction && !item.revisionText.includes(item.protectedAction) ? item.protectedAction : "",
    item.revisionText,
  ].filter(Boolean).join("，"));
  const revisionChange = item.operation === "move_scene"
    ? `场景改到${revisionText}${item.preserveAction ? "，保留原动作" : ""}`
    : revisionText || "按反馈更新";
  return item.removalTargets.length
    ? `去掉${item.removalTargets.join("、")}，并${revisionChange}`
    : revisionChange;
}

export function buildDraftRevisionPreview(intent: DraftRevisionIntent): DraftRevisionPreview {
  if (intent.items.length === 1) {
    const item = intent.items[0]!;
    const changeFact = itemChangeFact(item);
    const body = item.operation === "remove_content"
      ? `我理解你要把${item.targetLabel}里的${item.removalTargets.join("、")}去掉。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`
      : item.operation === "move_scene"
        ? `我理解你要把${item.targetLabel}的${changeFact}。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`
        : `我理解你要修改${item.targetLabel}：${changeFact}。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`;
    return {
      label: `修改${item.targetLabel}`,
      targetLabel: item.targetLabel,
      targetFact: item.targetFact,
      changeFact,
      preserveAction: item.preserveAction,
      body,
    };
  }
  const targetLabel = `第 ${intent.items.map((item) => item.shotNumber).join("、")} 镜`;
  const changeFact = intent.items.map((item) => `${item.targetLabel}：${itemChangeFact(item)}`).join("；");
  return {
    label: `修改${targetLabel}`,
    targetLabel,
    targetFact: targetLabel,
    changeFact,
    preserveAction: intent.items.some((item) => item.preserveAction),
    body: `我理解你要同时修改${targetLabel}：${changeFact}。发送后我会分别更新这些镜头，不会把后一个镜头的要求写进前一个镜头；也不会生成参考图或发送视频。`,
  };
}
