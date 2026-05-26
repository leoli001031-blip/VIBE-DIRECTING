import type { DirectorProgressStripState } from "./directorTypes";

export function MinimalDirectorStatusDot({ state }: { state: DirectorProgressStripState }) {
  const activeSegment = state.segments.find((segment) => segment.value > 0 && segment.tone === state.tone)
    || state.segments.find((segment) => segment.value > 0)
    || state.segments[0];

  return (
    <section className={`minimal-director-status ${state.tone}`} aria-label="当前状态">
      <i className={`director-progress-dot ${activeSegment?.tone || state.tone}`} aria-hidden="true" />
      <span>{state.label}</span>
    </section>
  );
}
