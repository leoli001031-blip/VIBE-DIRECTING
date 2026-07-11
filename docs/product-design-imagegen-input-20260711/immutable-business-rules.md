# Immutable Business Rules

1. `AgentCurrentTaskProjection` is the single owner of the right-rail main task, active confirmation, primary action state, and primary task copy.
2. Current-task classification uses structured state such as `actionKind`, job status, project identity, and fact hash. Chinese display-copy regex is not an authority.
3. Recovery priority is: current valid confirmation, non-terminal current-fact job, pipeline step, then passive project status.
4. Cleared or expired plans, terminal jobs, stale fact hashes, old export completion, and passive project state cannot become the current task.
5. Story confirmation preserves the confirmed shots. It cannot reset the project to zero shots or leave its old card active.
6. Save-location selection only authorizes a canonical local project root and saves the story. It cannot generate or export.
7. Renderer code cannot authorize an arbitrary directory. Privileged IPC accepts only trusted main-frame senders.
8. Existing files and not-yet-created write targets must remain inside the canonical authorized root after realpath and nearest-existing-parent validation. Symlink escape fails closed.
9. Reference, video, and export actions use the shared execution adapter and the same job, receipt, and timeline lifecycle.
10. Dry-run never calls a provider, never returns a fabricated output path, and never promotes missing reference/video facts to ready or complete.
11. Live execution requires explicit user confirmation, matching capability, configured credentials, permission, timeout, retry, and cancellation boundaries.
12. Runtime API mutation requires the random per-launch Electron token. The token is delivered through preload after lazy startup and is never embedded in Vite output.
13. New windows, renderer navigation, redirects, webviews, and privileged IPC remain restricted to trusted app origins and explicit safe external links.
14. Product Design / ImageGen may redesign visual hierarchy only after these rules are loaded as constraints. It may not infer business state from screenshots alone.
