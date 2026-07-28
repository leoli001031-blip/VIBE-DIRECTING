# Vibe Director Studio Working Rules

## Start Here

1. Read `docs/CURRENT-STATUS.md`.
2. Run `git status --short` before changing files.
3. Read only the acceptance document relevant to the requested slice.
4. Do not replay old Codex threads or large session JSONL files.

`README.md` is the command and repository entry. Dated plans, audits, handoffs,
and acceptance records are evidence for their date, not current authority.
`AGENT.md`, `PLAN.md`, and `DEMO_HANDOFF.md` are historical snapshots.

## Product Contract

- Vibe Director Studio is a local-first Electron app around `Project.vibe`.
- The right rail has one current Agent task. Structured projections, not
  display-copy matching, decide the active phase and confirmation boundary.
- Clarify, Proposal, Confirmation, Running, Review, Project Fact, and Delivery
  remain distinct states.
- `dry_run`, `needs_review`, selected, promoted, and delivered are not
  interchangeable.
- Review approval does not promote project facts. Promotion does not export.
- Provider submission is never part of an ordinary test or documentation task.

## Change Boundaries

- Preserve user-owned dirty files; never stage, revert, or clean them implicitly.
- Make the smallest change that closes the requested contract.
- Do not redesign UI, start a frontend dev server, or broaden architecture unless
  the task explicitly requires it.
- Do not call a real Provider, retry a task, or read credentials unless the task
  explicitly authorizes that exact action.
- Do not use destructive Git commands. Do not push, merge, or rebase by default.
- Generated runtime, release, and browser artifacts are not source truth.

## Verification

For Agent timeline or right-rail changes, run:

```bash
npm run agent-session-timeline:test
npm run minimal-agent-p1:test
npm run minimal-ui:test
npx tsc --noEmit --pretty false
git diff --check
```

Add the nearest focused contract tests for changed behavior. Run package or GUI
acceptance only when package/runtime behavior is in scope. A renderer or source
check is not packaged-App proof.

## Current Environment Note

P13-B retains a historical local ad-hoc package PASS. The latest P13-D/P13-E
revalidation is blocked before app code by the current macOS Electron/browser
launch layer. Keep those facts separate until a fresh packaged run succeeds.
