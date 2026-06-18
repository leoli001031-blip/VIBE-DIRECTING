import type { VibeAgentFact, VibeAgentTimelineEntry } from "./types";

export type VibeAgentTimelineStatusTone = "ready" | "working" | "waiting" | "blocked";

export interface VibeAgentTimelineStatusView {
  stage: string;
  doing: string;
  waitingFor: string;
  nextAction: string;
  tone: VibeAgentTimelineStatusTone;
  facts: VibeAgentFact[];
}

export function buildVibeAgentTimelineStatusView(
  entries: VibeAgentTimelineEntry[] | undefined,
): VibeAgentTimelineStatusView | undefined {
  const entry = latestStatusEntry(entries);
  if (!entry) return undefined;
  const next = timelineEntryNext(entry);
  const facts = (entry.facts || []).slice(0, 3);
  if (entry.status === "waiting") {
    if (entry.type === "confirmation_request") {
      return {
        stage: "等待确认",
        doing: entry.body,
        waitingFor: "你的确认",
        nextAction: next || "确认后我再执行",
        tone: "waiting",
        facts,
      };
    }
    return {
      stage: "Agent 正在执行",
      doing: entry.body,
      waitingFor: next || "工具返回结果",
      nextAction: "完成后我会写入结果",
      tone: "working",
      facts,
    };
  }
  if (entry.status === "blocked") {
    return {
      stage: entry.type === "action_result" ? "动作需要处理" : "需要你处理",
      doing: entry.type === "action_result" ? entry.body : entry.title,
      waitingFor: entry.type === "action_result" ? "重试或继续修改" : "补充信息",
      nextAction: next || (entry.type === "action_result" ? "调整后重试" : "按提示处理后继续"),
      tone: "blocked",
      facts,
    };
  }
  if (entry.type === "action_result") {
    return {
      stage: "动作完成",
      doing: entry.body,
      waitingFor: next || "复核结果",
      nextAction: next || "继续下一步",
      tone: "ready",
      facts,
    };
  }
  if (entry.type === "tool_result") {
    return {
      stage: "Agent 已读取",
      doing: entry.body,
      waitingFor: "下一步判断",
      nextAction: next || "继续",
      tone: "ready",
      facts,
    };
  }
  if (entry.type === "assistant_message") {
    return {
      stage: normalizedAssistantStage(entry.title),
      doing: entry.body,
      waitingFor: entry.confirmationRequired ? "你的确认" : "你的下一句指令",
      nextAction: next || (entry.confirmationRequired ? "确认后继续" : "继续描述"),
      tone: entry.confirmationRequired ? "waiting" : "ready",
      facts,
    };
  }
  return {
    stage: entry.title || "Agent 已更新",
    doing: entry.body,
    waitingFor: next || "下一步",
    nextAction: next || "继续",
    tone: entry.status === "done" ? "ready" : "waiting",
    facts,
  };
}

function latestStatusEntry(entries: VibeAgentTimelineEntry[] | undefined) {
  if (!entries?.length) return undefined;
  return [...entries].reverse().find((entry) =>
    entry.type !== "user_message"
    && (entry.type !== "state_change" || entry.status !== "done")
  );
}

function timelineEntryNext(entry: VibeAgentTimelineEntry) {
  return typeof entry.details?.next === "string" && entry.details.next.trim()
    ? entry.details.next.trim()
    : entry.facts?.find((fact) => fact.label === "下一步")?.value;
}

function normalizedAssistantStage(title: string) {
  const cleaned = title.replace(/^AI\s*导演[:：]?\s*/, "").trim();
  return cleaned ? `AI 导演：${cleaned}` : "AI 导演";
}
