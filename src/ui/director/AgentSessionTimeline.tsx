import type { ReactNode } from "react";
import { Check, CircleDot, LockKeyhole } from "lucide-react";
import type { AgentSessionTimelineProjection } from "./agentSessionTimelineProjection";

export function AgentSessionTimeline({
  projection,
  children,
}: {
  projection: AgentSessionTimelineProjection;
  children: ReactNode;
}) {
  return (
    <section
      className={`agent-session-timeline ${projection.currentTone}`}
      aria-label="导演会话时间线"
      data-session-current-phase={projection.currentPhaseId}
    >
      <header className="agent-session-timeline-head">
        <span>Director Session</span>
        <strong>{projection.title}</strong>
      </header>
      <ol>
        {projection.phases.map((phase) => {
          const current = phase.state === "current";
          return (
            <li
              key={phase.id}
              className={phase.state}
              data-session-phase={phase.id}
              data-session-phase-state={phase.state}
              aria-current={current ? "step" : undefined}
            >
              <span className="agent-session-timeline-marker" aria-hidden="true">
                {phase.state === "complete"
                  ? <Check size={12} />
                  : current
                    ? <CircleDot size={16} />
                    : <LockKeyhole size={12} />}
              </span>
              <div className="agent-session-timeline-copy">
                <strong>{phase.label}</strong>
                <small>{phase.detail}</small>
              </div>
              {current && <div className="agent-session-timeline-current">{children}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
