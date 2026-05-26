# Real Image2 Runbook

This runbook is the manual P6 lane for real Image2 validation. It must stay outside default `verify:*` aggregators.

## Scope

- Start with 1 shot.
- Move to 3 shots only after the 1-shot report is reviewed.
- Use scheduler-controlled one-shot provider calls for multi-shot runs.
- Default `image.generate` policy is `maxConcurrency=3`,
  `retryConcurrency=2`, and `maxAutoRetries=2`.
- Do not promote project facts from provider self-report.
- Do not print or commit raw API keys.

## No-Submit Preflight

```bash
npm run p6-real-image2:preflight -- --run-id=p6-preflight-1shot --shots=P6S01
npm run p6-real-image2:report-check -- --report=test_artifacts/p6-real-image2/p6-preflight-1shot/report.json --expect-preflight
npm run p6-real-image2:secret-scan
```

Expected result:

- `providerCalled=false`
- `runtimeExternalNetworkCallMade=false`
- `permission-receipt.json`, `submit-plan.json`, `prompt.md`, and `report.json` are written under `test_artifacts/p6-real-image2/<runId>/`

## 1-Shot Live Submit

Use an environment variable or the local Settings credential store. Do not place the key in source files, docs, or reports.

Provider prompts are normalized through `image2_clean_base_prompt_v1` before live submit. Keep shot prompt files short:

- one sentence for the subject/action/scene
- one sentence for style or mood when needed
- one sentence for constraints that matter

Avoid long lists of tiny prop, texture, lighting, camera, and atmosphere details. The submit path keeps the shot facts, removes local file paths, and asks Image2 to favor a clean readable frame over decorative density.

```bash
VIBE_IMAGE2_BASE_URL=https://lanyiapi.com \
VIBE_IMAGE2_PROVIDER_ID=lanyi-image2 \
VIBE_IMAGE2_MODEL=gpt-image-2 \
VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 \
npm run p6-real-image2:submit-live -- --run-id=p6-live-1shot --shots=P6S01
```

Then verify the report:

```bash
npm run p6-real-image2:report-check -- --report=test_artifacts/p6-real-image2/p6-live-1shot/report.json --expect-live
npm run p6-real-image2:preview-export-test -- --report=test_artifacts/p6-real-image2/p6-live-1shot/report.json
npm run p6-real-image2:secret-scan
```

Acceptance:

- Provider request strategy is `scheduler_one_shot_with_retry`.
- `maxConcurrency<=3`.
- `retryConcurrency<=2`.
- `maxAutoRetries<=2`.
- `retryAttemptReceipts` are written for every provider attempt.
- Output is hash-bound with `outputSha256`.
- Provider observation and semantic QA sidecars are present.
- Return ingest status is `return_ingested` or `partial_return_ingested`.
- The report projects into current-project Preview/Export as an `image_hold` with `needs_review`.
- Promotion remains blocked until explicit human QA and promotion authorization.

## 3-Shot Live Submit

Run this only after the 1-shot live report has passed review.

```bash
VIBE_IMAGE2_BASE_URL=https://lanyiapi.com \
VIBE_IMAGE2_PROVIDER_ID=lanyi-image2 \
VIBE_IMAGE2_MODEL=gpt-image-2 \
VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 \
npm run p6-real-image2:submit-live -- --run-id=p6-live-3shot --shots=P6S01,P6S02,P6S03
```

Then verify:

```bash
npm run p6-real-image2:report-check -- --report=test_artifacts/p6-real-image2/p6-live-3shot/report.json --expect-live
npm run p6-real-image2:preview-export-test -- --report=test_artifacts/p6-real-image2/p6-live-3shot/report.json
npm run p6-real-image2:secret-scan
```

## Red Lines

- Do not add live submit to `verify:runtime-fast`, `verify:provider-fast`, `verify:prototype`, `mvp-rc:smoke`, or package smoke.
- Do not treat `execute-return`, preflight, handoff, or provider self-report as promotion.
- Do not run 3-shot until the 1-shot evidence has been checked.
- Do not log raw keys. Reports may include provider id, base URL, model, request id, output hash, and status only.
- Always run `npm run p6-real-image2:secret-scan` after live submit before sharing artifacts.
