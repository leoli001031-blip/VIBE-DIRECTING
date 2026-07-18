# Vibe Director Studio P10-D Review turn acceptance

Date: 2026-07-17

Status: **PASS FOR FIRST VERTICAL SLICE ONLY**. P10-D as a whole remains in
progress. P10-E delivery redesign has not started.

## Accepted scope

This slice implements the selected conversational Director direction for one
existing, real `needs_review` video result:

1. the artifact stays in the center and exposes playback/status only;
2. the right rail owns the single current Review turn;
3. preview approval writes a Review Receipt only;
4. revision returns to conversation without provider work;
5. project-fact promotion remains a separate, disabled confirmation boundary;
6. delivery and export remain unchanged.

The implementation contract is frozen in
`docs/agent-first-p10-c-interaction-spec-20260717.md`.

## Packaged App result

The packaged App was opened against a non-destructive copy of the approved
P6S01 project:

- QA root:
  `/tmp/vibe-director-p10-d-review-qa-ihdlol/projects/p10-d-review`
- packaged app:
  `release/mac-arm64/Vibe Director Studio.app`
- media state: P6S01, `needs_review`, real returned video

Observed results:

- **PASS**: one right-side Review turn shows target, status, receipt, output
  hash, review basis, and explicit boundaries.
- **PASS**: the center video workspace no longer has a direct approval action.
- **PASS**: `需要修改` pre-fills and focuses the composer without changing the
  project file.
- **PASS**: `project.vibe` remained at SHA-256
  `cef0da97eb08b309fecb438ee08b879841fb6653af60eef6ba9a4af8b49064a3`.
- **PASS**: constrained packaged layout preserves project navigation, artifact,
  Director turn, primary review action, and composer without overlap.
- **PASS**: icon-only navigation exposes the names `故事，1 镜头`,
  `参考，缺 3 张`, `视频，1 待看`, and `交付，展示包` in the AX tree.

No provider, retry, project-fact promotion, export, or external-cost action was
executed.

## Minimal implementation surface

- `src/ui/director/agentDirectorTurnProjection.ts`
- `src/ui/director/MinimalPreview.tsx`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/ui/director/DirectorModeShell.tsx`
- `src/styles/director.css`
- `scripts/agent-director-turn-projection-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `package.json`

Existing dirty files outside this slice were not cleaned, reverted, staged, or
committed.

## Verification

Passed:

- `npm run agent-director-turn-projection:test`
- `npm run agent-current-task-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run runtime-api-current-project-review-decision:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run new-video-start-contract:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Evidence

- Desktop: `docs/evidence/p10-d-review-turn-20260717/01-desktop-review.jpeg`
- Constrained window:
  `docs/evidence/p10-d-review-turn-20260717/02-constrained-review.jpeg`
- Design comparison: `design-qa.md`

## Not yet accepted

- The clarification, proposal, paid confirmation, and running-job turns have
  not received their P10-D visual implementation.
- A/B review is not implemented because this project has no durable version
  pair and only one real returned result.
- The complete fresh-profile Agent-first chain and cold-start recovery were not
  rerun as part of this narrow visual slice.
- Product-fact promotion and export remain outside this acceptance and require
  their existing independent authorization boundaries.

Next allowed work: implement the clarification/proposal turn as the second
P10-D slice while keeping the current Review contract unchanged.
