# P5-B Signal Desk Implementation

## Result

Signal Desk is implemented and visually accepted for the packaged App at desktop, tight three-column, and minimum-window Agent-overlay layouts. The P0-P4 projection, confirmation, adapter, job, receipt, timeline, restore, and provider contracts were not intentionally changed. No real image or video provider was called.

## Implementation Scope

- `src/styles/tokens.css`: neutral and semantic Signal Desk tokens.
- `src/styles/director.css`: three-region shell, current-task hierarchy, confirmation surface, independent scrolling, responsive grid areas, and Agent overlay.
- `src/ui/director/DirectorModeShell.tsx`: icon-led project rail and projection-backed work-object summary.
- `src/ui/director/MinimalAgentPanel.tsx`: projection-backed current task, structured confirmation ordering, effect/boundary copy, and accessible current-confirmation state.
- `scripts/minimal-ui-contract-test.mts`: updated source contracts for structured confirmation ordering and conditional thread anchoring.

## Packaged App Result

Passed:

- Fresh packaged App opened without a dev server.
- Two-shot local draft reached `确认这版故事` without provider calls.
- Current confirmation, exact primary action, secondary action, and composer were visible together at `1195x768`.
- Confirming the story preserved 2 shots, showed 2 missing references, kept video ungenerated, and moved the sole current task to `选择保存位置`.
- Tight layout preserved project, main, and Agent columns without vertical text collapse.
- Minimum reachable window used a complete Agent overlay.

Blocked outside the P5-B visual scope:

- A confirmed but not-yet-saved story returned to 0 shots after a normal packaged-App close and relaunch. This needs a persistence/restore investigation before the full local release-candidate label is allowed.
- `npm run prototype-ui:test` still has the same four failures present before P5-B: creator-facing demo status copy, staged Project.vibe impact summary, preserved-project preview-failure copy, and structured Agent export result.

## Evidence

- Desktop draft confirmation: `evidence/12-draft-confirmation-primary-visible-1195x768.png`
- Desktop save-location confirmation: `evidence/13-save-location-primary-visible-1195x768.png`
- Tight three-column layout: `evidence/16-tight-three-column-order-fixed-860x768.png`
- Minimum-window Agent overlay: `evidence/17-minimum-window-agent-overlay-765x900.png`
- Full comparison history: `/design-qa.md`

## Verification

Passed:

- `npm run agent-current-task-projection:test`
- `npm run new-video-start-contract:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run agent-video-execution-adapter:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npx tsc --noEmit --pretty false`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `git diff --check`

P5-B design QA is passed. Overall packaged local release-candidate status remains blocked by the two business-contract items above.
