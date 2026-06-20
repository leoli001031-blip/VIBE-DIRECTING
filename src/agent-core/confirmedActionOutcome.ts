import type { DirectorQaUserFeedback } from "../core/directorQaUserFeedback";

export type VibeAgentConfirmedToolRunStatus = "skipped" | "completed" | "blocked" | "failed";

export interface VibeAgentConfirmedToolResultFact {
  label: string;
  value: string;
}

export interface VibeAgentConfirmedToolRunOutcome {
  status: VibeAgentConfirmedToolRunStatus;
  label: string;
  projectRecordPreserved: boolean;
  waitingReview?: boolean;
  previewReady?: boolean;
  resultStatus?: "ready" | "running";
  resultFacts?: VibeAgentConfirmedToolResultFact[];
}

interface ToolActionState {
  ok?: boolean;
  status?: string;
  uiStatus?: string;
  message?: string;
  qaFeedback?: DirectorQaUserFeedback;
  videoSubmitted?: boolean;
  ruleQaReport?: { status?: string; summary?: string };
  textQaReport?: { status?: string; summary?: string };
  blockers?: string[];
}

function isToolActionState(value: unknown): value is ToolActionState {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedStatusText(state: ToolActionState) {
  return [
    state.status,
    state.uiStatus,
    state.qaFeedback?.status,
    state.ruleQaReport?.status,
    state.textQaReport?.status,
  ].map((item) => String(item || "").toLowerCase()).join(" ");
}

function toolStateIsBlocked(state: ToolActionState) {
  const statusText = normalizedStatusText(state);
  return state.ok === false
    || /\bblocked\b|_blocked\b|failed/.test(statusText)
    || state.qaFeedback?.status === "blocked"
    || Array.isArray(state.blockers) && state.blockers.length > 0;
}

function blockedToolStateLabel(state: {
  message?: string;
  qaFeedback?: DirectorQaUserFeedback;
  textQaReport?: { summary?: string };
  ruleQaReport?: { summary?: string };
  blockers?: string[];
}, fallback: string) {
  return state.qaFeedback?.summary
    || state.textQaReport?.summary
    || state.ruleQaReport?.summary
    || state.message
    || state.blockers?.[0]
    || fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resultFact(label: string, value: unknown): VibeAgentConfirmedToolResultFact | undefined {
  const text = typeof value === "number" ? String(value) : stringValue(value);
  return text ? { label, value: text } : undefined;
}

function compactFacts(facts: Array<VibeAgentConfirmedToolResultFact | undefined>) {
  const seen = new Set<string>();
  return facts.filter((fact): fact is VibeAgentConfirmedToolResultFact => {
    if (!fact) return false;
    const key = `${fact.label}:${fact.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function firstAssetPath(state: Record<string, unknown>) {
  const asset = arrayValue(state.assets).map(objectValue).find(Boolean);
  return displayableReferencePath(asset?.path)
    || displayableReferencePath(asset?.imageUrl)
    || displayableReferencePath(asset?.thumbnailUrl)
    || displayableReferencePath(asset?.mediaPath)
    || displayableReferencePath(asset?.fileUrl);
}

function displayableReferencePath(value: unknown) {
  const path = stringValue(value);
  if (!path) return undefined;
  if (/\.json(?:[?#].*)?$/i.test(path)) return undefined;
  if (/^(?:https?:|data:|blob:|file:)/i.test(path)) return path;
  if (/\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|svg|mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(path)) return path;
  return undefined;
}

function referenceStateHasDisplayableOutput(state: Record<string, unknown> | undefined) {
  if (!state) return false;
  return Boolean(
    displayableReferencePath(state.outputPath)
      || displayableReferencePath(state.storyboardReferencePath)
      || displayableReferencePath(state.previewPlanPath)
      || firstAssetPath(state),
  );
}

function referenceStateLooksPreparedOnly(state: ToolActionState | undefined) {
  const text = [
    state?.status,
    state?.uiStatus,
    state?.message,
  ].map((item) => String(item || "").toLowerCase()).join(" ");
  return /queued|task envelope|handoff prepared|project facts written|prepared|已准备|已写入|排队|入队/.test(text);
}

function referenceResultFacts(state: Record<string, unknown> | undefined) {
  if (!state) return undefined;
  const assetCount = arrayValue(state.assets).length;
  const generatedAssetCount = numberValue(state.generatedAssetCount) ?? (assetCount > 0 ? assetCount : undefined);
  const firstOutput = displayableReferencePath(state.outputPath)
    || displayableReferencePath(state.storyboardReferencePath)
    || displayableReferencePath(state.previewPlanPath)
    || firstAssetPath(state);
  const facts = compactFacts([
    resultFact("生成", generatedAssetCount ? `${generatedAssetCount} 个参考` : undefined),
    resultFact("产物", firstOutput),
    resultFact("服务", stringValue(state.providerId)),
  ]);
  return facts.length ? facts : undefined;
}

function relayQueueFacts(relayQueue: Record<string, unknown> | undefined) {
  if (!relayQueue) return [];
  const counts = objectValue(relayQueue.counts);
  const total = numberValue(counts?.total);
  const completed = numberValue(counts?.completed);
  const active = numberValue(counts?.active);
  const queueLabel = total
    ? `共 ${total} 段，已完成 ${completed || 0} 段${active ? `，进行中 ${active} 段` : ""}`
    : undefined;
  const items = arrayValue(relayQueue.items).map(objectValue).filter(Boolean);
  const firstSubmitId = items.map((item) => stringValue(item?.submitId)).find(Boolean);
  const firstVideoPath = items.map((item) =>
    stringValue(item?.outputVideoPath) || stringValue(arrayValue(item?.localMediaPaths)[0])
  ).find(Boolean);
  return [
    resultFact("队列", queueLabel),
    resultFact("提交号", firstSubmitId),
    resultFact("视频", firstVideoPath),
  ];
}

function videoResultFacts(state: Record<string, unknown> | undefined) {
  if (!state) return undefined;
  const relayQueue = objectValue(state.relayQueue);
  const facts = compactFacts([
    resultFact("提交号", stringValue(state.submitId) || stringValue(state.taskId)),
    resultFact("视频", stringValue(state.outputVideoPath)),
    resultFact("提示词", stringValue(state.promptPath)),
    resultFact("记录", stringValue(state.submitLogPath)),
    ...relayQueueFacts(relayQueue),
  ]);
  return facts.length ? facts : undefined;
}

function exportResultFacts(state: Record<string, unknown> | undefined) {
  if (!state) return undefined;
  const executed = numberValue(state.executedCount);
  const planned = numberValue(state.plannedWriteCount);
  const facts = compactFacts([
    resultFact("导出目录", stringValue(state.exportRoot)),
    resultFact("清单", stringValue(state.manifestPath)),
    resultFact("写入", planned ? `${executed || 0}/${planned}` : undefined),
  ]);
  return facts.length ? facts : undefined;
}

function withResultFacts(resultFacts: VibeAgentConfirmedToolResultFact[] | undefined) {
  return resultFacts?.length ? { resultFacts } : {};
}

export function referenceGenerationToolOutcome(value: unknown): VibeAgentConfirmedToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  const resultState = objectValue(value);
  const resultFacts = referenceResultFacts(resultState);
  const hasDisplayableOutput = referenceStateHasDisplayableOutput(resultState);
  if (state?.status === "blocked" || state?.status === "missing") {
    return {
      status: "blocked",
      label: state.message || "参考生成被拦住，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
      ...withResultFacts(resultFacts),
    };
  }
  if (!hasDisplayableOutput && (referenceStateLooksPreparedOnly(state) || state?.status === "needs_review" || state?.status === "verified")) {
    return {
      status: "completed",
      label: "参考生成中，等待结果回到参考页。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      resultStatus: "running",
      ...withResultFacts(resultFacts),
    };
  }
  if (state?.status === "needs_review" || state?.status === "verified") {
    return {
      status: "completed",
      label: state.message || "参考已生成，去参考区复核。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
      resultStatus: "ready",
      ...withResultFacts(resultFacts),
    };
  }
  return {
    status: "completed",
    label: state?.message || "参考已开始生成",
    projectRecordPreserved: true,
    waitingReview: true,
    previewReady: false,
    resultStatus: "running",
    ...withResultFacts(resultFacts),
  };
}

export function videoSubmitToolOutcome(value: unknown): VibeAgentConfirmedToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  const resultFacts = videoResultFacts(objectValue(value));
  if (state && toolStateIsBlocked(state)) {
    const label = state.qaFeedback?.summary || blockedToolStateLabel(state, "视频暂时不能发送，项目已保留。");
    return {
      status: "blocked",
      label,
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
      ...withResultFacts(resultFacts),
    };
  }
  if (state?.status === "needs_review") {
    return {
      status: "completed",
      label: state.message || "视频已生成，等待复核。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: true,
      resultStatus: "ready",
      ...withResultFacts(resultFacts),
    };
  }
  if (state?.status === "ready" || state?.status === "completed" || state?.status === "verified") {
    return {
      status: "completed",
      label: state.message || "视频结果已返回，去预览页复核。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: true,
      resultStatus: "ready",
      ...withResultFacts(resultFacts),
    };
  }
  if (state?.status === "submitted") {
    return {
      status: "completed",
      label: state.message || "视频已发送，即梦排队中。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      resultStatus: "running",
      ...withResultFacts(resultFacts),
    };
  }
  return {
    status: "completed",
    label: state?.message || "视频已发送，排队后回到预览",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
    ...withResultFacts(resultFacts),
  };
}

export function exportToolOutcome(value: unknown): VibeAgentConfirmedToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  const resultFacts = exportResultFacts(objectValue(value));
  if (state?.status === "blocked") {
    return {
      status: "blocked",
      label: state.message || "导出还没准备好，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      ...withResultFacts(resultFacts),
    };
  }
  if (state?.status === "failed") {
    return {
      status: "failed",
      label: state.message || "导出失败，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      ...withResultFacts(resultFacts),
    };
  }
  if (state?.status === "ready") {
    return {
      status: "completed",
      label: state.message || "导出包已生成。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      resultStatus: "ready",
      ...withResultFacts(resultFacts),
    };
  }
  return {
    status: "completed",
    label: "导出已开始。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
    ...withResultFacts(resultFacts),
  };
}
