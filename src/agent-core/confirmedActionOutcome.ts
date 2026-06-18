import type { DirectorQaUserFeedback } from "../core/directorQaUserFeedback";

export type VibeAgentConfirmedToolRunStatus = "skipped" | "completed" | "blocked" | "failed";

export interface VibeAgentConfirmedToolRunOutcome {
  status: VibeAgentConfirmedToolRunStatus;
  label: string;
  projectRecordPreserved: boolean;
  waitingReview?: boolean;
  previewReady?: boolean;
  resultStatus?: "ready" | "running";
}

function isToolActionState(value: unknown): value is { status?: string; message?: string; qaFeedback?: DirectorQaUserFeedback } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function referenceGenerationToolOutcome(value: unknown): VibeAgentConfirmedToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  if (state?.status === "blocked" || state?.status === "missing") {
    return {
      status: "blocked",
      label: state.message || "参考生成被拦住，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
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
    };
  }
  return {
    status: "completed",
    label: state?.message || "参考已开始生成",
    projectRecordPreserved: true,
    waitingReview: true,
    previewReady: false,
    resultStatus: "running",
  };
}

export function videoSubmitToolOutcome(value: unknown): VibeAgentConfirmedToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  if (state?.status === "blocked") {
    return {
      status: "blocked",
      label: state.qaFeedback?.summary || state.message || "视频暂时不能发送，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
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
    };
  }
  return {
    status: "completed",
    label: state?.message || "视频已发送，排队后回到预览",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
  };
}

export function exportToolOutcome(value: unknown): VibeAgentConfirmedToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  if (state?.status === "blocked") {
    return {
      status: "blocked",
      label: state.message || "导出还没准备好，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
    };
  }
  if (state?.status === "failed") {
    return {
      status: "failed",
      label: state.message || "导出失败，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
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
    };
  }
  return {
    status: "completed",
    label: "导出已开始。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
  };
}
