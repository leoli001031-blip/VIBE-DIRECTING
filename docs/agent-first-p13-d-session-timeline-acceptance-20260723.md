# Vibe Director Studio P13-D Session Timeline first slice

Date: 2026-07-23

Status: **IMPLEMENTED - PRODUCTION RENDERER VISUAL PASS, PACKAGED LAUNCH BLOCKED**.

## Scope

This slice implements the selected P13-C direction 3 only for the existing
`P13S01 · needs_review` Review state. It does not redesign the complete shell
and does not enter Provider execution, Review approval, project-fact promotion,
Delivery, or export.

The right Agent rail now projects one structured session sequence:

`Clarify -> Proposal -> Confirmation -> Running -> Review -> Project Fact -> Delivery`

`Review` is the sole current phase. `Running` is complete after the returned
media exists. Project-fact promotion and Delivery remain locked.

## Implementation

- `agentSessionTimelineProjection.ts` derives the visible sequence from the
  structured Director turn rather than display-copy matching.
- `AgentSessionTimeline.tsx` is presentation-only and introduces no buttons or
  execution authority.
- `MinimalAgentPanel.tsx` places the existing Review surface inside the current
  phase without changing its callbacks, receipt logic, or confirmation gates.
- `director.css` adds the timeline hierarchy and bounded responsive behavior
  while retaining the existing tokens and shell.
- `agent-session-timeline-projection-test.mts` locks the single-current-phase,
  completed-Running, locked-future-phase, and no-new-authority contracts.
- `p13-session-timeline-packaged-acceptance.mts` is ready to repeat the same
  assertions in the packaged App when Electron can launch again.

## Production renderer QA

The built production renderer was connected to the real local P13-A project
and its actual `1280x720`, five-second Seedance return. Provider calls were
disabled and no Review action was clicked.

At `1480x980` and `980x820`:

- exactly one Session Timeline and seven phases are present;
- `Review` is the only `current` and `aria-current=step` phase;
- no active Running turn remains;
- `通过预览` and `需要修改` are enabled;
- promotion remains disabled;
- no horizontal overflow, Review escape, composer overlap, or action-text
  clipping was observed.

The source direction and implementation were also captured at the same
`1058px` height in one side-by-side comparison. The selected timeline hierarchy
matches. The white top bar, existing center preview structure, and absent
Skills/Receipts header are deliberate out-of-scope differences for later
slices, not hidden pixel-clone claims.

## Packaged launch blocker

`npm run package:dir` completed and `codesign --verify --deep --strict` passed,
but the packaged process is currently killed before Electron application code
starts:

- P13-D acceptance: `packaged acceptance control did not appear`;
- baseline packaged launch contract: `Packaged executable smoke timed out`;
- current packaged executable: exit `137`;
- previously accepted P13-B archived executable: exit `137`;
- repository vanilla Electron binary running only `--version`: exit `137`;
- Computer Use launch by path and bundle id: timed out before an app state
  appeared.

Because both the archived known-good App and unmodified Electron runtime fail
the same way, this is classified as a current macOS Electron launch-layer
blocker. No UI or business logic was changed to guess around it. Packaged
visual acceptance is therefore **not passed**.

## Safety boundary

- Provider calls: `0`
- Review decisions written: `0`
- Project-fact promotions: `0`
- Delivery/export actions: `0`
- P13S01 remains: `needs_review`
- P13 media SHA-256 remains:
  `deb0746c81f91b179f6f8cbcddee9d474ce2ab35f5c1abab5042aa50c1d2393b`

The source project, ledger, receipt, and media hashes are recorded in
`docs/evidence/p13-d-session-timeline-20260723/renderer-observation.json`.

## Evidence

- `01-review-session-timeline-desktop.png`
- `02-review-session-timeline-constrained.png`
- `03-review-session-timeline-reference-viewport.png`
- `04-reference-vs-implementation.png`
- `renderer-observation.json`

## Verdict

P13-D Review Session Timeline implementation PASS

Production renderer visual acceptance PASS

Packaged App acceptance BLOCKED - Electron launch layer

Provider execution, Review approval, promotion, Delivery, and export NOT RUN
