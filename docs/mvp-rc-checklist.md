# MVP RC Checklist

Updated: 2026-05-18

This checklist is the release-candidate path for the local-first MVP. It is intentionally centered on Project.vibe, the owned Agent Loop, P6 Image2 gates, Preview/Export, and Electron packaging. Legacy Codex/Claude CLI or subagent routes are diagnostics only.

## RC Main Path

The release candidate must prove this flow:

1. Open a local project folder with `project.vibe`.
2. Read manifest, story flow, locked visual memory, shots, assets, and run receipts from Project.vibe.
3. Run the owned Agent Loop from those facts and append structured project-local receipts.
4. Keep Image2 behind P6 gates: safe contract tests first, no-submit preflight second, human-approved live submit only when explicitly authorized.
5. Preview and export project-local artifacts.
6. Package the app through Electron with the bundled local runtime.

## Required RC Commands

Run and record this default command before calling an MVP RC green:

```bash
npm run verify:rc
```

`npm run verify:rc` is the RC gate. It runs focused UI verification plus `mvp-rc:smoke`; `mvp-rc:smoke` runs prototype verification, P6 contract tests, P6 no-submit preflight, package smoke, unpacked package build, and the packaged runtime bundle check. `verify:rc` then runs the retained-artifact secret scan. Keep the emitted subcommand output in the run record instead of replacing the RC entry with legacy diagnostics aliases.

`npm run p6-real-image2:preflight -- --shots=P6S01` is the safe no-submit preflight. The expected safety result is `providerCalled=false` and `runtimeExternalNetworkCallMade=false`.
It writes evidence only and does not call Lanyi or any other provider.

## Optional Human-Approved P6 Submit

Only run these after explicit human approval and with a fresh artifact path recorded:

```bash
VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01
VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01,P6S02,P6S03
```

The multi-shot command must use scheduler-controlled one-shot provider requests (`scheduler_one_shot_with_retry`), not a single provider request with `n=3`. The default live policy is max concurrency 3, retry concurrency 2, and max auto retries 2. Each live run must produce receipts, retry attempt evidence, and a report under `test_artifacts/p6-real-image2/<runId>/`. Provider self-report is not enough for RC acceptance; returned files must be hash-bound, ingested, reviewed, and kept behind the promotion gate.

Real Lanyi runs are manual live evidence only. They must not be added to default CI, `verify:mvp`, `verify:rc`, `verify:all`, or any legacy/diagnostics aggregate.

The App entry has the same live-submit boundary. A real P6 action requires explicit action-time confirmation, a submit permission receipt, and configured Lanyi key status. The app/runtime must never write or display the raw API key. Returned outputs may appear in preview as `needs_review` or `verified`; formal promotion remains false by default until separate human QA and promotion authorization are recorded.

## RC Evidence To Capture

- Command, result, and short output summary for every required RC command.
- Artifact path for `mvp-demo-export:test` and every P6 Image2 preflight/live run.
- Electron package output path under `release/`.
- Confirmation that no legacy CLI route was used as the MVP path.
- Confirmation that no real Image2 submit happened unless the optional human-approved submit section was explicitly invoked.
- Confirmation that no provider return promoted Project.vibe facts without review.

## Legacy Diagnostics Boundary

These commands are allowed only when maintaining older routes, debugging historical receipts, or proving backward compatibility:

```bash
npm run verify:diagnostics:subagent
npm run verify:diagnostics:provider-fast
npm run verify:diagnostics:all
npm run verify:legacy:subagent
npm run verify:legacy:provider-fast
npm run verify:legacy:all
```

Do not list deprecated aliases such as `verify:all`, `verify:provider-fast`, `verify:subagent`, or old Codex/Claude CLI routes as RC gates. If a legacy diagnostic is run, record why it was needed and keep its result separate from the MVP acceptance verdict.
