# Verification Checklists

Updated: 2026-05-11

These checklists define the P0 verification baseline for refactor workers. They separate fast verification from real provider submit, keep fixture writers from colliding, and make worker receipts reviewable before any follow-up phase.

## Worker Baseline Capture

Run and record before editing:

```bash
git status --short --branch
wc -l src/App.tsx src/styles.css scripts/local-runtime-api-server.mjs
npm run verify:runtime-fast
npm run verify:round5
npm run verify:subagent
npm run verify:provider-fast
```

Capture in the worker receipt:

- Current branch and ahead/behind state from `git status --short --branch`.
- Dirty and untracked files before work starts.
- Current line counts for `src/App.tsx`, `src/styles.css`, and `scripts/local-runtime-api-server.mjs`.
- Verification scripts that will run, with any explicit skips and reasons.
- Files allowed by the handoff and files actually changed.

## Non-Parallel Fixture Guardrails

Do not run these groups in parallel with another worker touching the same writable fixtures:

- Runtime API tests that write runtime state, project fixtures, handoff packets, receipts, or sidecars.
- `import-runtime-test` and public `runtime-state.json` projection tests.
- Round5 sidecars, artifact ingest folders, strict-edit return fixtures, and derive package outputs.
- Current-project/Image2 latest report writers, return executor reports, provider return evidence, and handoff packet outputs.
- Broad aggregators such as `verify:all`, `verify:runtime`, and `verify:provider-contracts`.

Prefer the P0 layered commands for ordinary worker verification:

- `npm run verify:runtime-fast`
- `npm run verify:round5`
- `npm run verify:subagent`
- `npm run verify:provider-fast`

## Browser Smoke Checklist

Use this after UI-facing changes and before sign-off:

- Default minimal UI opens without blank panels.
- Story Flow remains the default creative surface.
- Visual Memory / Asset Library shows reviewed references and candidate status without becoming a generic gallery.
- Preview renders the expected frame or player state and stays usable on desktop and mobile widths.
- Diagnostics remains available for engineering details.
- Desktop and mobile layouts have no overlapping text, clipped buttons, or hidden primary controls.
- Default UI does not leak these engineering terms: `provider`, `receipt`, `gate`, `queue`, `Round`, `Phase`, `strict edit`.

## Worker Receipt Checklist

Each worker handoff should include:

- Allowed write scope from the task.
- Actual changed files.
- Baseline command outputs or summarized hashes where output is long.
- Input hash or fixture hash when the task consumes packets, sidecars, or report inputs.
- Output artifact paths and report paths.
- Test commands run and pass/fail result.
- Blocked reasons, with exact missing file, command, fixture, or permission.
- Confirmation that no real provider submit happened.
- Confirmation that no project fact promotion happened unless explicitly authorized.

## Provider Boundary Checklist

- `verify:provider-fast` must never perform real provider submit.
- `verify:provider-fast` must not include `current-project-real-image2-readiness:test`, `real-provider-submit-permission:test`, `image2-provider-boundary:test`, or any script that submits to a real provider.
- Prepared packets and handoff packets are not submit operations.
- `execute-return` is external result ingest only. It records evidence, receipt, status, and review state.
- Real provider submit is P6 manual work only. It needs explicit permission receipt, human confirmation, runbook steps, and a separate return ingest review.
- Provider/subagent logs are evidence and receipts only; they must not promote facts into `project.vibe` by themselves.
