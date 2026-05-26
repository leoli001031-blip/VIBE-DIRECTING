# Verification Checklists

Updated: 2026-05-18

These checklists define the current MVP and RC verification baseline for refactor workers. The old Codex/Claude CLI, subagent, and real-provider route is retained only as a legacy diagnostics path; it should not be presented as the main product validation path.

## Current Mainline Verification

Use this command for ordinary product, prototype, and UI sign-off:

```bash
npm run verify:mvp
```

`verify:mvp` is the main product gate. It runs `verify:prototype` for the owned Agent Loop/prototype integration path and `verify:ui` for the focused UI/build path.

For release-candidate acceptance, use `docs/mvp-rc-checklist.md` and record this command:

```bash
npm run verify:rc
```

`verify:rc` runs focused UI verification plus `mvp-rc:smoke`. The smoke step emits prototype, Preview/Export, sample export, P6 no-submit preflight, package smoke, package build, and runtime-bundle evidence. `verify:rc` then runs the retained-artifact secret scan. Keep the emitted subcommand output in the run record.

Legacy compatibility commands remain available when an older handoff explicitly asks for them:

- `npm run verify:diagnostics:subagent`
- `npm run verify:diagnostics:provider-fast`
- `npm run verify:diagnostics:all`
- `npm run verify:legacy:subagent`
- `npm run verify:legacy:provider-fast`
- `npm run verify:legacy:all`

Deprecated aliases are still present for compatibility, but should not be used in new handoffs:

- `npm run verify:subagent`
- `npm run verify:provider-fast`
- `npm run verify:all`

These aliases are diagnostics-only redirects. They are not default MVP or RC verification.

## Worker Baseline Capture

Run and record before editing:

```bash
git status --short --branch
wc -l src/App.tsx src/styles.css scripts/local-runtime-api-server.mts
npm run verify:mvp
```

Capture in the worker receipt:

- Current branch and ahead/behind state from `git status --short --branch`.
- Dirty and untracked files before work starts.
- Current line counts for `src/App.tsx`, `src/styles.css`, and `scripts/local-runtime-api-server.mts`.
- Verification scripts that will run, with any explicit skips and reasons.
- Files allowed by the handoff and files actually changed.
- Whether any legacy compatibility command was intentionally run, with the older handoff or blocker that required it.

## Non-Parallel Fixture Guardrails

Do not run these groups in parallel with another worker touching the same writable fixtures:

- Runtime API tests that write runtime state, project fixtures, handoff packets, receipts, or sidecars.
- `import-runtime-test` and public `runtime-state.json` projection tests.
- Round5 sidecars, artifact ingest folders, strict-edit return fixtures, and derive package outputs.
- Current-project/Image2 latest report writers, return executor reports, provider return evidence, and handoff packet outputs.
- Broad aggregators such as `verify:legacy:all`, deprecated `verify:all`, `verify:runtime`, and `verify:provider-contracts`.

Prefer the current alias for ordinary worker verification:

- `npm run verify:mvp`

Use focused subcommands only when the handoff scope is explicitly narrower:

- `npm run verify:prototype`
- `npm run verify:ui`

Use legacy commands only for older route maintenance or compatibility checks:

- `npm run verify:diagnostics:subagent`
- `npm run verify:diagnostics:provider-fast`
- `npm run verify:diagnostics:all`
- `npm run verify:legacy:subagent`
- `npm run verify:legacy:provider-fast`
- `npm run verify:legacy:all`

## MVP Provider Verification Runbook

Keep the MVP provider boundary in these separate stages. Do not collapse them into one "provider ready" verdict.

1. Legacy fast verification: run `npm run verify:diagnostics:provider-fast` or `npm run verify:legacy:provider-fast` only when maintaining older route diagnostics. The deprecated alias `npm run verify:provider-fast` may still exist for old handoffs, but new MVP or RC docs should not use it. These scripts may prepare packets, receipts, mock handoffs, and return-ingest fixtures, but must not read live credentials, call provider endpoints, or submit provider work.
2. Real Image2 permission receipt: run `npm run provider-permission-receipt:test` for the core permission artifact, then the current-project receipt test when the runtime server fixture entrypoint is in scope. A passing result means the receipt is present, scoped, and still pinned to `providerSubmitAllowed=0`; it is not action-time approval and not a provider call.
3. P6 Image2 RC gates: `npm run p6-real-image2:test` is the safe contract test. `npm run p6-real-image2:preflight -- --shots=P6S01` and `npm run p6-real-image2:preflight -- --shots=P6S01,P6S02,P6S03` write preflight evidence only and must report `providerCalled=false` / `runtimeExternalNetworkCallMade=false`. These no-submit preflights are valid RC gates and do not call Lanyi or any other provider.
4. Real submit: this is a manual P6 step only. Do not add it to `verify:mvp`, `verify:rc`, default CI, diagnostics/legacy aggregators, `provider-fast`, runtime, UI, provider-contract aggregators, or required RC commands. The actual submit commands are `VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01` for 1-shot and `VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01,P6S02,P6S03` for 3-shot; the live path uses scheduler-controlled one-shot provider requests (`scheduler_one_shot_with_retry`) instead of sending one provider request with `n=3`. Defaults are max concurrency 3, retry concurrency 2, and max auto retries 2. Each run writes `permission-receipt.json`, `submit-plan.json`, `provider_observations/*.json`, `semantic_qa/*.json`, `retry-scheduler-state.json`, `retry-attempt-receipts.json`, `return-ingest.json`, and `report.json` under `test_artifacts/p6-real-image2/<runId>/`. After each live run, execute `npm run p6-real-image2:report-check -- --report=<report.json> --expect-live`, `npm run p6-real-image2:preview-export-test -- --report=<report.json>`, and `npm run p6-real-image2:secret-scan`. Real returns must be hash-bound and ingested through return ingest/QA/promotion gate; provider self-report alone cannot complete or promote.
5. App real submit: a P6 action inside the app requires explicit action-time confirmation, a submit permission receipt, and configured Lanyi key status before the runtime can submit. The app/runtime must never write or display the raw API key. Returned outputs can project into preview as `needs_review` or `verified`, while formal promotion remains false by default until separate human QA and promotion authorization are recorded.
6. Return ingest: run the existing return evidence and `execute-return` route tests, such as `npm run runtime-api-provider-return-evidence:test` and `npm run current-project-image2-return-executor:test`, after an externally returned artifact exists. This stage records hash-bound provider evidence and projects `needs_review`; it must not claim the runtime made the provider call.
7. QA and promotion: run `npm run provider-qa-promotion-gate:test` or `npm run provider-closed-loop-shell:test` to check the watcher, manifest, semantic QA, and promotion gates. Promotion to formal project facts remains blocked until human QA and explicit promotion authorization are recorded.

Fast scripts must stay safe by construction: no provider submit, no live submit, no credential material access, no external network IO, and no `project.vibe` promotion.

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

## Electron Package Checklist

Use this for desktop package sign-off:

- `npm run package:smoke` passes and covers the bundled local runtime plus Electron preload/IPC bridge smoke.
- `npm run package:dir` creates an unpacked app under `release/`.
- The packaged path uses local Project.vibe files and the owned Agent Loop; it does not require legacy CLI tools as the product path.
- Any package failure records the failing command, output path, and whether the issue is Vite build, runtime bundle, preload/IPC, or Electron Builder.

## Legacy Provider Boundary Checklist

- `verify:legacy:provider-fast` and deprecated alias `verify:provider-fast` must never perform real provider submit.
- `verify:legacy:provider-fast` and deprecated alias `verify:provider-fast` must not include `current-project-real-image2-readiness:test`, `real-provider-submit-permission:test`, `image2-provider-boundary:test`, or any script that submits to a real provider.
- `verify:diagnostics:provider-fast` is the preferred explicit name for that diagnostics lane; it has the same no-submit boundary.
- Prepared packets and handoff packets are not submit operations.
- `execute-return` is external result ingest only. It records evidence, receipt, status, and review state.
- Real provider submit is P6 manual work only. It needs explicit permission receipt, human confirmation, runbook steps, and a separate return ingest review.
- Provider/subagent logs are evidence and receipts only; they must not promote facts into `project.vibe` by themselves.
