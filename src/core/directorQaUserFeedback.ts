import type { DirectorRuleQaFinding, DirectorRuleQaReport } from "./directorRuleQa";
import type { DirectorTextQaFinding, DirectorTextQaReport } from "./directorTextQa";

export type DirectorQaUserFeedbackStatus = "clear" | "needs_fix" | "blocked";

export interface DirectorQaUserFeedbackItem {
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
  fix: string;
  source: "rule" | "director";
}

export interface DirectorQaUserFeedback {
  status: DirectorQaUserFeedbackStatus;
  title: string;
  summary: string;
  primaryAction: string;
  items: DirectorQaUserFeedbackItem[];
}

interface DirectorQaUserFeedbackInput {
  status?: string;
  message?: string;
  blockers?: string[];
  ruleQaReport?: DirectorRuleQaReport;
  textQaReport?: DirectorTextQaReport;
}

function clean(value: unknown, maxLength = 360): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function findingSeverity(value: unknown): DirectorQaUserFeedbackItem["severity"] {
  return value === "blocker" || value === "warning" || value === "info" ? value : "warning";
}

function ruleFindingCopy(finding: DirectorRuleQaFinding): Omit<DirectorQaUserFeedbackItem, "severity" | "source"> {
  if (finding.code === "storyboard_group_scene_conflict") {
    return {
      title: "这个故事板混了多个场景",
      detail: "同一张故事板里出现了不同地点、天气或光线基准，视频容易把空间关系混在一起。",
      fix: "把不同场景拆成不同视频段；如果本来就是同一地点，就统一场景参考。",
    };
  }
  if (finding.code === "duplicated_scene_asset_for_same_storyboard_group") {
    return {
      title: "同一场景用了多张场景参考",
      detail: "它们可能让天气、光线或空间布局互相打架。",
      fix: "同一段故事板优先共用一张场景/天气基准图，变化写进动作说明。",
    };
  }
  if (finding.code === "storyboard_reference_multi_shot_without_group") {
    return {
      title: "故事板参考管了多个未分组镜头",
      detail: "多个镜头共用一张故事板参考，但没有声明它们是同一个连续视频段。",
      fix: "同一段就写同一个 storyboardGroupId；不是同一段就拆成各自的故事板参考。",
    };
  }
  if (finding.category === "asset_granularity") {
    return {
      title: "参考素材拆得太细",
      detail: clean(finding.message) || "车灯、轮胎、手部、眼神这类局部细节不适合单独生成参考。",
      fix: "保留角色、整车、场景、独立道具；局部细节并入父对象或镜头动作。",
    };
  }
  if (finding.code === "omni_has_storyboard_panels") {
    return {
      title: "全能参考和故事板字段混在一起",
      detail: "全能参考应该是一段连续动作说明，不要同时要求故事板面板。",
      fix: "复杂动作改用故事板叙事/快切；简单段落保留全能参考。",
    };
  }
  if (finding.code.includes("panels_less_than_visible_clips") || finding.code === "rapid_cut_missing_panels") {
    return {
      title: "剪辑数和故事板数量没对齐",
      detail: "最终成片要看到的剪辑数，不能比故事板提供的动作节点更多。",
      fix: "给每个可见剪辑至少一个故事板面板，或减少可见剪辑数。",
    };
  }
  if (finding.category === "field_pollution") {
    return {
      title: "分镜里还有临时占位",
      detail: clean(finding.message) || "正式分镜需要离开上下文也能读懂。",
      fix: "把“同上、待补、待确认”改成具体角色、场景或道具。",
    };
  }
  if (finding.category === "prompt_leakage") {
    return {
      title: "视频说明里可能会漏出制作标注",
      detail: "箭头、编号、边框、文字或配乐指令可能被模型当成画面内容。",
      fix: "只把这些作为内部规划信息，并明确禁止出现在成片里。",
    };
  }
  if (finding.category === "generation_contract") {
    return {
      title: "生成规则还没说清楚",
      detail: clean(finding.message) || "时长、剪辑数或动作节点之间存在冲突。",
      fix: clean(finding.suggestedFix) || "重新确认每段时长、可见剪辑数和故事板面板数。",
    };
  }
  return {
    title: "提交前需要调整",
    detail: clean(finding.message) || "这次规划里有一处容易影响生成结果的问题。",
    fix: clean(finding.suggestedFix) || "先让 Agent 改写这一处，再提交视频。",
  };
}

function textFindingCopy(finding: DirectorTextQaFinding): Omit<DirectorQaUserFeedbackItem, "severity" | "source"> {
  if (finding.category === "story_logic") {
    return {
      title: "故事顺序需要再理一下",
      detail: clean(finding.message) || "镜头顺序、动作触发或场景衔接不够明确。",
      fix: clean(finding.rewriteHint || finding.suggestedFix) || "让 Agent 按时间顺序重写这段分镜。",
    };
  }
  if (finding.category === "reference_strategy") {
    return {
      title: "参考图用法需要调整",
      detail: clean(finding.message) || "角色、场景、道具或故事板参考之间的职责不够清楚。",
      fix: clean(finding.rewriteHint || finding.suggestedFix) || "重新分配参考图角色，避免把多个用途混成一张情绪板。",
    };
  }
  if (finding.category === "generation_contract") {
    return {
      title: "视频段规则需要收紧",
      detail: clean(finding.message) || "时长、剪辑数或故事板数量存在歧义。",
      fix: clean(finding.rewriteHint || finding.suggestedFix) || "明确最终可见剪辑数、故事板面板数和动作节点的关系。",
    };
  }
  if (finding.category === "style_alignment") {
    return {
      title: "风格没有贴住你的要求",
      detail: clean(finding.message) || "当前文字可能把画面带到错误风格。",
      fix: clean(finding.rewriteHint || finding.suggestedFix) || "让 Agent 重写风格约束，并删掉冲突风格词。",
    };
  }
  return {
    title: "文字规划需要再改一下",
    detail: clean(finding.message) || "这次说明可能让模型误解。",
    fix: clean(finding.rewriteHint || finding.suggestedFix) || "先让 Agent 按这个问题重写再提交。",
  };
}

function itemKey(item: DirectorQaUserFeedbackItem): string {
  return `${item.severity}:${item.title}:${item.fix}`;
}

function statusRank(status: DirectorQaUserFeedbackStatus): number {
  if (status === "blocked") return 3;
  if (status === "needs_fix") return 2;
  return 1;
}

function sortItem(left: DirectorQaUserFeedbackItem, right: DirectorQaUserFeedbackItem): number {
  const severityRank = { blocker: 0, warning: 1, info: 2 };
  return severityRank[left.severity] - severityRank[right.severity];
}

export function buildDirectorQaUserFeedback(input: DirectorQaUserFeedbackInput): DirectorQaUserFeedback | undefined {
  const items: DirectorQaUserFeedbackItem[] = [];
  for (const finding of input.ruleQaReport?.findings || []) {
    const copy = ruleFindingCopy(finding);
    items.push({
      severity: findingSeverity(finding.severity),
      source: "rule",
      ...copy,
    });
  }
  for (const finding of input.textQaReport?.findings || []) {
    const copy = textFindingCopy(finding);
    items.push({
      severity: findingSeverity(finding.severity),
      source: "director",
      ...copy,
    });
  }

  const unique = Array.from(new Map(items.map((item) => [itemKey(item), item])).values()).sort(sortItem);
  const hasBlocker = unique.some((item) => item.severity === "blocker")
    || input.ruleQaReport?.status === "blocked"
    || input.textQaReport?.status === "blocked"
    || clean(input.status).includes("blocked");
  const hasWarning = unique.some((item) => item.severity === "warning")
    || input.ruleQaReport?.status === "warning"
    || input.textQaReport?.status === "needs_revision";
  const status: DirectorQaUserFeedbackStatus = hasBlocker ? "blocked" : hasWarning ? "needs_fix" : "clear";

  if (status === "clear" && unique.length === 0) return undefined;

  const fallbackMessage = clean(input.message || input.blockers?.[0]);
  const title = status === "blocked" ? "提交前需要先改一处" : "有几处可以先优化";
  const first = unique[0];
  const summary = first
    ? `${first.title}：${first.fix}`
    : fallbackMessage || "提交前检查发现需要先调整的内容。";
  const primaryAction = first?.fix || "让 Agent 根据提示重写后再提交。";

  return {
    status,
    title,
    summary,
    primaryAction,
    items: unique.slice(0, 6),
  };
}

export function strongerDirectorQaUserFeedback(
  left: DirectorQaUserFeedback | undefined,
  right: DirectorQaUserFeedback | undefined,
): DirectorQaUserFeedback | undefined {
  if (!left) return right;
  if (!right) return left;
  return statusRank(right.status) > statusRank(left.status) ? right : left;
}
