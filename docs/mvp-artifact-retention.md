# MVP Artifact Retention

Updated: 2026-05-18

This repo keeps local test evidence, but generated provider media should not
become an accidental source of truth. Project.vibe remains the durable project
fact source; runtime-state and test artifacts are derived evidence.

## Retain

- JSON reports that prove provider boundaries, permissions, partial returns,
  preview/export projection, or secret-scan coverage.
- Small text manifests, receipts, and report-check outputs under
  `test_artifacts/`.
- Sample-project media that is intentionally referenced from
  `sample-projects/`.

## Do Not Treat As Product Facts

- Raw images under `test_artifacts/`.
- `real-test-sandbox/` output.
- Provider self-reported success logs.
- Runtime caches in `public/runtime-state.json` or `public/runtime-audit.json`.

## Cleanup Rules

1. Keep the latest successful live report for each retained provider proof:
   one-shot, partial batch, text-to-image concurrency, and reference edit
   concurrency.
2. Keep failed live reports only when they explain a current policy, such as
   why five concurrent text-to-image is not the default.
3. Delete or move bulky generated media unless it is explicitly referenced by a
   report, sample project, or review fixture.
4. Run `npm run p6-real-image2:secret-scan` before sharing any retained live
   artifact directory.
5. Never write raw API keys into reports, manifests, Project.vibe files, or
   exported packages.

## Current Secret Scan Roots

The default secret scan covers:

- `test_artifacts/p6-real-image2`
- `test_artifacts/lanyi-api-smoke`
- `test_artifacts/lanyi-image-generate-concurrency`
- `test_artifacts/lanyi-reference-edit-concurrency`
- `real-test-sandbox`

Add new live-provider artifact roots to
`scripts/p6-real-image2-secret-scan.mts` before retaining them.
