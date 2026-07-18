# Vibe Director Studio P10-D Clarify and Proposal acceptance

Date: 2026-07-17

Status: **PASS FOR SECOND VERTICAL SLICE ONLY**. The first Review slice remains
accepted. P10-D as a whole is not complete.

## Accepted scope

This slice implements only the local Director conversation from ambiguous
review feedback to a staged project-edit proposal:

1. ambiguous timing feedback becomes a structured Clarify turn;
2. Clarify offers exactly two conversation-only directions;
3. choosing a direction records a structured resolution and stages one local
   project-edit proposal;
4. Proposal binds the staged action to the exact project-edit confirmation;
5. `确认写入项目` reuses the existing local project-edit confirmation route;
6. `继续调整` returns the resolved intent to conversation without writing;
7. Review, Provider, Delivery, export, and project-fact promotion remain outside
   this slice.

## Packaged App result

The final packaged App was exercised against fresh, non-destructive copies of
the approved P6S01 `needs_review` project:

- interaction QA root:
  `/tmp/vibe-director-p10-d-conversation-qa3-hv8Dao/projects/p10-d-conversation`
- final Clarify capture root:
  `/tmp/vibe-director-p10-d-conversation-qa4-X0DuEU/projects/p10-d-conversation`
- packaged app:
  `release/mac-arm64/Vibe Director Studio.app`

Observed results:

- **PASS**: `需要修改` followed by `纸飞机亮得太早了` enters Clarify instead
  of staging a write.
- **PASS**: Clarify shows `情绪转折` and `提前预兆`; both state that they only
  form a proposal.
- **PASS**: choosing `情绪转折` removes the old Clarify turn and displays one
  Proposal with matching target, action identity, and proposed change.
- **PASS**: Proposal exposes `确认写入项目` and `继续调整`; no Provider, retry,
  Delivery, export, or promotion action appears.
- **PASS**: `继续调整` restores the resolved text to the composer and does not
  mutate project facts.
- **PASS**: `project.vibe` remained at SHA-256
  `cef0da97eb08b309fecb438ee08b879841fb6653af60eef6ba9a4af8b49064a3`.

`确认写入项目` was deliberately not clicked. The slice verifies its mapping to
the existing local project-edit path without applying the edit.

## Packaged issues found and fixed

1. A staged proposal could carry an older timestamp than the Clarify message,
   leaving Clarify as the restored current turn. The fix adds a structured
   clarification-resolution entry keyed to the clarification and chosen option.
2. Passive Review projection could temporarily cover an already staged local
   project edit. Proposal now owns the focused turn only when the staged action
   and exact structured project-edit confirmation have matching identities;
   mismatch remains blocked.

No persistence schema or execution adapter was replaced.

## Minimal implementation surface

- `src/ui/director/agentDirectorClarification.ts`
- `src/ui/director/agentDirectorTurnProjection.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/styles/director.css`
- `scripts/agent-director-clarification-test.mts`
- `scripts/agent-director-turn-projection-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `package.json`

Existing dirty files outside this slice were not cleaned, reverted, staged, or
committed.

## Verification

Passed:

- `npm run agent-director-clarification:test`
- `npm run agent-director-turn-projection:test`
- `npm run agent-current-task-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Evidence

- Clarify:
  `docs/evidence/p10-d-clarification-proposal-20260717/01-packaged-clarification.png`
- Proposal:
  `docs/evidence/p10-d-clarification-proposal-20260717/02-packaged-proposal.png`
- Combined design comparison: `design-qa.md`

## Not yet accepted

- paid confirmation and running-job turns;
- real Provider or paid execution;
- A/B comparison;
- project-fact promotion;
- Delivery or export;
- any broader persistence-architecture change.

The next P10-D slice requires a separately defined scope and any authorization
needed for paid or Provider-backed behavior. This task stops before that boundary.
