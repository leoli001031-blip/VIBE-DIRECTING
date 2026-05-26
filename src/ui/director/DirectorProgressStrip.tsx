import type { DirectorProgressStripState, DirectorProgressTone } from "./directorTypes";

export type DirectorProgressStripSummary = {
  initialized: boolean;
  queueTotal: number;
  ready: number;
  waiting: number;
  runningPlanned: number;
  waitingOutput: number;
  qaPending: number;
  needsReview: number;
  blocked: number;
  failed: number;
  stalled: number;
  completeVerified: number;
};

export function buildDirectorProgressStripState(summary: DirectorProgressStripSummary): DirectorProgressStripState {
  const knownPreparing = Math.max(0, summary.ready + summary.waiting);
  const working = Math.max(0, summary.runningPlanned + summary.waitingOutput);
  const review = Math.max(0, summary.qaPending + summary.needsReview);
  const blocked = Math.max(0, summary.blocked + summary.failed + summary.stalled);
  const complete = Math.max(0, summary.completeVerified);
  const knownTotal = knownPreparing + working + review + blocked + complete;
  const preparing = knownPreparing + Math.max(0, summary.queueTotal - knownTotal);
  const observedTotal = preparing + working + review + blocked + complete;
  const total = Math.max(summary.queueTotal, observedTotal);
  const hasItems = summary.initialized && total > 0;

  let tone: DirectorProgressTone = "preparing";
  let label = "准备中";
  if (!hasItems) {
    label = "等待开始";
  } else if (blocked > 0) {
    tone = "blocked";
    label = "有阻断";
  } else if (review > 0) {
    tone = "review";
    label = "等待复核";
  } else if (working > 0) {
    tone = "working";
    label = "生成中";
  } else if (complete === total) {
    tone = "complete";
    label = "已完成";
  }

  const detail = !hasItems
    ? "先写脚本或创建本地项目"
    : tone === "blocked"
      ? `${total} 项 · ${blocked} 项有阻断`
      : tone === "review"
        ? `${total} 项 · ${review} 项等待复核`
        : tone === "working"
          ? `${total} 项 · ${working} 项生成中`
          : tone === "complete"
            ? `${total} 项已完成`
            : `${total} 项 · ${preparing} 项准备中`;

  return {
    label,
    detail,
    tone,
    total,
    preparing,
    working,
    review,
    blocked,
    complete,
    segments: [
      { label: "准备中", value: preparing, tone: "preparing" },
      { label: "生成中", value: working, tone: "working" },
      { label: "等待复核", value: review, tone: "review" },
      { label: "有阻断", value: blocked, tone: "blocked" },
      { label: "已完成", value: complete, tone: "complete" },
    ],
  };
}

export function DirectorProgressStrip({ state }: { state: DirectorProgressStripState }) {
  return (
    <section className={`director-progress-strip ${state.tone}`} aria-label="项目处理进度">
      <div className="director-progress-heading">
        <span>{state.label}</span>
        <small>{state.detail}</small>
      </div>
      <div className="director-progress-track" aria-hidden="true">
        {state.segments.map((segment) => (
          <span
            key={segment.label}
            className={`director-progress-segment ${segment.tone}${segment.value === 0 ? " empty" : ""}`}
            style={{ flex: segment.value > 0 ? `${segment.value} 1 0` : "0 0 0" }}
          />
        ))}
      </div>
      <div className="director-progress-counts" aria-label="处理状态">
        {state.segments.map((segment) => (
          <span key={segment.label} className={segment.value === 0 ? "is-empty" : undefined}>
            <i className={`director-progress-dot ${segment.tone}`} aria-hidden="true" />
            {segment.label}
            <b>{segment.value} 项</b>
          </span>
        ))}
      </div>
    </section>
  );
}
