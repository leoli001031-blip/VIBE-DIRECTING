# Real Image2 Runbook

This runbook covers two deliberately separate P6 Image2 lanes. Both must stay
outside default `verify:*` aggregators.

- The packaged App lane is authoritative for the current P6-C creator-beta
  acceptance. It uses `apikey-fun-gpt55-responses-image` through the runtime
  prepare, handoff, permission, submit, review, and restore contracts.
- The `p6-real-image2:*` CLI lane is an older manual Lanyi scheduler harness.
  It can verify provider/report mechanics, but it does not prove the packaged
  App path and must receive its own explicit live authorization.

## Scope

- Start with 1 shot.
- Move to 3 shots only after the 1-shot report is reviewed.
- Use scheduler-controlled one-shot provider calls for multi-shot runs.
- Default `image.generate` policy is `maxConcurrency=3`,
  `retryConcurrency=2`, and `maxAutoRetries=2`.
- Do not promote project facts from provider self-report.
- Do not print or commit raw API keys.

## No-Submit Preflight

The following commands exercise the manual CLI harness only. They do not
authorize a provider call and do not replace the packaged runtime app-action
contract test.

```bash
npm run p6-real-image2:preflight -- --run-id=p6-preflight-1shot --shots=P6S01
npm run p6-real-image2:report-check -- --report=test_artifacts/p6-real-image2/p6-preflight-1shot/report.json --expect-preflight
npm run p6-real-image2:secret-scan
```

Expected result:

- `providerCalled=false`
- `runtimeExternalNetworkCallMade=false`
- `permission-receipt.json`, `submit-plan.json`, `prompt.md`, and `report.json` are written under `test_artifacts/p6-real-image2/<runId>/`

## Packaged App One-Shot

The current P6-C live acceptance must use the packaged App/runtime route:

- provider: `apikey-fun-gpt55-responses-image`;
- current configured default endpoint: `https://slb.apikey.fun/v1/responses`;
- current configured default model: `gpt-5.5`;
- exactly one selected shot and one image;
- one unique permission receipt and at most one provider call;
- no automatic retry after a consumed permission;
- result remains `needs_review` until an explicit human decision.

On 2026-07-14 the user granted standing software-development test authorization
for the existing local `apikey.fun` image credential. Future bounded image
tests do not need a new conversational authorization, but every call must still
report its shot, provider, model, endpoint, call count, and possible external
cost before execution and must pass the product's action-time confirmation.
The standing authorization does not allow automatic retry, batch/high-
concurrency submission, another image provider, or any video provider. A failed
or missing result requires a new prepare/permission cycle and an explicit new
product action; it cannot reuse the consumed permission. Do not use the CLI
command below as a substitute for packaged App acceptance.

## P6-C Acceptance Record

Readiness label: `P6-C real reference one-shot accepted` on 2026-07-14.

Exactly one external provider call produced:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot/real-trigger-one-shot/P6S01/image2-start.png`

The output is `1672 x 941` with SHA-256
`f3f6dd0a184e097675dc852415e30072ff3398586c4552e79e6c5689bd308987`.
It entered `needs_review`, then received explicit human approval through review
receipt `review_P6S01_20260713190156`. The receipt preserves the exact source
receipt, project-relative output path, and output hash.

Approval did not authorize formal promotion: `promotionAuthorized=false`.
Locking the reviewed image into project facts remains a separate P7 action.

The final packaged App acceptance used an approved loopback fixture with
`VIBE_P6_IMAGE2_LIVE=0`, so it made no second provider call. Current-session
approval and fresh-profile cold restart both passed. Cold recovery restored
`verified`, `hashBoundActual=true`, the exact review receipt, and the preview
image. It did not restore the old approval button, pending-review badge, or
`复核参考` task. Canonical folder scanning reported zero duplicate review
candidates for the already locked assets.

Full evidence and verification commands are recorded in
`docs/agent-first-p6-c-reference-preflight-20260713.md`.

## Manual CLI 1-Shot Live Submit

Use an environment variable or the local Settings credential store. Do not place the key in source files, docs, or reports.

This section uses the separate `lanyi-image2` scheduler harness. Run it only
when the user explicitly authorizes this exact CLI route and its retry budget.

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

This is outside the current packaged P6-C acceptance and requires another
explicit authorization.

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
- Do not treat a successful Lanyi CLI report as proof that the packaged
  apikey.fun App action, permission claim, or cold restore passed.
- Do not treat `execute-return`, preflight, handoff, or provider self-report as promotion.
- Do not run 3-shot until the 1-shot evidence has been checked.
- Do not log raw keys. Reports may include provider id, base URL, model, request id, output hash, and status only.
- Always run `npm run p6-real-image2:secret-scan` after live submit before sharing artifacts.
