# Agent-first P6-C reference preflight audit

Preflight date: 2026-07-13
Live acceptance date: 2026-07-14

Status: PASS. P6-C real reference one-shot and packaged recovery acceptance are
complete.

Readiness label: `P6-C real reference one-shot accepted`.

This record separates the one authorized external provider call from the
loopback packaged App acceptance. The packaged replay did not make a second
provider call.

## Baseline and scope

- Branch: `codex/agent-first-local-baseline-20260712`.
- Starting commit: `5cd94e8 Harden offline execution recovery`.
- One selected shot: `P6S01`.
- Packaged runtime route: `apikey-fun-gpt55-responses-image`, currently
  configured for `https://slb.apikey.fun/v1/responses` and model `gpt-5.5`.
- The manual CLI preflight uses the separate `lanyi-image2` harness. It is not
  the packaged App acceptance route.
- No frontend dev server, UI change, Product Design, ImageGen, or packaged GUI
  walkthrough was used.
- Real image calls before authorization: 0.
- Real image calls after authorization: exactly 1.
- Real video calls: 0.
- The provider response did not report an exact fee, so no cost amount is
  asserted here.

## Authorized real one-shot evidence

The user granted continuing development-test authorization for the existing
local `apikey.fun` image credential. The credential remained in local Settings;
it was not read, printed, copied into an environment value, or committed.

Exactly one request was submitted for `P6S01` through
`apikey-fun-gpt55-responses-image`. Automatic retry, concurrency, batch image
generation, video providers, and other image providers remained disabled.

Real project root:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot`

Accepted output:

`real-trigger-one-shot/P6S01/image2-start.png`

Evidence:

- provider request id: `resp_028299e93ae599b3016a551fd42508819aad09c8efce9546e4`
- source receipt: `image2_one_shot_prepare_p6c_reference_one_shot_20260714_r4_P6S01_run_pv_798ba560`
- project id: `p6c_reference_one_shot_20260714_r4`
- project fact hash at submit: `pv_798ba560`
- output SHA-256: `f3f6dd0a184e097675dc852415e30072ff3398586c4552e79e6c5689bd308987`
- dimensions: `1672 x 941`
- initial return state: `needs_review`

The explicit review wrote `review_P6S01_20260713190156` to `Project.vibe` with
`status=approved`, `humanReviewed=true`, the exact source receipt, project-
relative output path, and output hash. `promotionAuthorized=false`: approval
accepts the review result but does not lock or formally promote it into project
facts.

The real project still contains exactly one provider-submit claim. The accepted
PNG hash and dimensions were rechecked after all packaged and headless tests and
were unchanged. No second external request was made.

## Packaged App acceptance

The final packaged App acceptance used an approved loopback fixture with live
providers explicitly disabled via `VIBE_P6_IMAGE2_LIVE=0`. This exercises the
same runtime, receipt, review, renderer, and cold-recovery contracts without
spending a second provider call.

Current-session review acceptance proved:

- the review route returned `200` and `approved`;
- `Project.vibe` was written with the exact shot, source receipt, output path,
  and hash;
- the output remained present;
- the old approval button and pending-review badge disappeared.

Fresh-profile cold restart proved:

- one-shot status restored as `verified`;
- `hashBoundActual=true` and `providerReturnIngested=true`;
- `reviewRecoveredFromProjectVibe=true` with the approved review receipt;
- Preview loaded the returned `P6S01` image;
- the old `复核参考` task, approval button, and pending-review badge did not
  return;
- the right Agent moved to `补参考`, because formal promotion remains blocked;
- folder scan discovered 0 new assets and Visual Memory reported 0
  `needsReview` duplicates.

The packaged fixture intentionally keeps approval separate from formal
promotion. P7 must provide the explicit lock/promotion transition before the
reviewed frame can satisfy the remaining project-reference fact.

Four narrow defects were fixed during acceptance:

1. Review media paths now canonicalize macOS `/var` and `/private/var` aliases
   and reject unmatched absolute or traversal paths.
2. The app-action fixture now writes canonical `Project.vibe` data, so the real
   review route is tested instead of silently skipping persistence.
3. Cold recovery recognizes an exact approved, human-reviewed Project.vibe
   receipt and revalidates its source receipt, output path, hash, provider
   observation, and semantic QA before restoring `verified`.
4. Folder scan canonicalizes existing asset realpaths before dedupe, so locked
   project assets cannot reappear as review candidates after restart.

## Credential boundary

- Relevant live and confirmation environment variables were unset before the
  manual preflight audit.
- The status-only resolver reports the packaged Image2 credential configured
  from local Settings with `secretDisplayed=false`. Raw key material was never
  printed or written to the preflight artifacts.
- The manual one-shot script resolves the existing local Settings credential
  when `VIBE_IMAGE2_API_KEY` is absent and records only a non-secret
  `local-settings://providers/<providerId>` reference.
- The no-submit run set `VIBE_P6_IMAGE2_LIVE=0`, used no action confirmation,
  and passed `--preflight`. A configured credential alone cannot submit.

## Preflight evidence

Artifact root:

`test_artifacts/p6-real-image2/p6c-preflight-settings-1shot-20260713/`

The report proves:

- `status=preflight_provider_not_called`
- `liveRequested=false`
- `canSubmitProvider=false`
- `providerCalled=false`
- `network=false`
- `runtimeExternalNetworkCallMade=false`
- `imageCount=1`
- `maxConcurrency=1`
- `retryConcurrency=1`
- `maxAutoRetries=2`
- the manual CLI harness is blocked by its missing action-time confirmation

No PNG, JPG, WEBP, MP4, or MOV exists under the artifact root.

Artifact SHA-256 values:

- `report.json`: `08eab09b3962222360f400f0b13d211ebe857b20d61731e0f6990dc33a79a2ab`
- `submit-plan.json`: `c27d072dd11572ac4a29fb6293e7683ebe3e2ed5ec4257ac93d35c8d1c61cdd3`
- `permission-receipt.json`: `b1ea83a1c9404b09ca5518a39e264bae7dedf5b8bab73b6dd671311f47de4bf3`
- `prompt.md`: `24d15a6490b6b2c2e903879bad1c88288a23291cda543eda41b21dcc3657994b`

## Identity and replay closure

Prepare receipt, handoff, permission, action-time confirmation, and submit now
bind the same:

- `projectId`, `projectRoot`, `projectFactHash`, and `actionId`;
- provider id, slot, and required mode;
- selected shot and exact output/provider-observation/semantic-QA paths;
- prompt path and SHA-256;
- locked character, scene, prop, and style paths and SHA-256 values.

Changing Project.vibe, the prompt, action id, provider, selected shot, output
paths, or a locked reference after permission blocks before provider-key
resolution or provider IO. Blocked responses keep `providerCalled=false`,
`runtimeProviderSubmitAttempted=false`, and
`runtimeExternalNetworkCallMade=false`.

Every permission has a random unique `permissionReceiptId`. Submit persists a
claim before provider IO, so the same permission cannot be replayed. Missing or
failed results consume the permission; retry requires a new permission.

The claim records truthful lifecycle state. Mock-only consumption keeps all
provider/network flags false. A localhost live-shaped transport records
attempted and succeeded states plus the output hash. Cold restart does not
expose a consumed permission as the current task.

## External project roots and portable evidence

The one-shot runtime now supports an explicitly allowed project root outside
the repository, including fresh `/tmp` packaged profiles. Lexical containment,
allowed-root canonicalization, nearest-existing-parent realpath checks, and
shot/sandbox realpath checks remain enforced. Symlink escape checks stay in the
runtime boundary.

Plans and return-ingest evidence use project-relative media and QA paths. Local
runtime sidecars may retain absolute project and filesystem paths for same-host
recovery. API responses expose separate project-relative and filesystem fields
where both are needed.

## Other minimal fixes

- The manual CLI harness now accepts the existing local Settings credential
  resolver instead of requiring only `VIBE_IMAGE2_API_KEY`.
- The secret scanner no longer treats the tail of `bindings:\\n` as a Windows
  drive path, while real Windows and POSIX absolute audio references still fail.
- `p6-real-image2:preflight-safety-test` uses an isolated HOME, fake local
  credential, loopback-only URL, and no confirmation. It proves both normal
  preflight and an explicit live request stop before provider IO.

## Verification

Passed:

- `npm run p6-real-image2:preflight-safety-test`
- `npm run p6-real-image2:test`
- `npm run p6-real-image2:retry-harness-test` with localhost requests only
- `npm run p6-real-image2:secret-scan`
- `npm run p6-real-image2:app-action-test`
- `npm run p6-real-image2:serial-batch-test`
- mock `p6-real-image2:review-decision-test`
- mock `p6-real-image2:preview-export-test`
- `npm run runtime-api-current-project-image2-handoff:test`
- `npm run runtime-api-current-project-p6-real-image2-routes:test`
- `npm run current-project-provider-submit-permission-receipt:test`
- `npm run runtime-api-current-project-return-writers:test`
- `npm run runtime-api-current-project-one-shot-executor:test`
- `npm run runtime-api-current-project-one-shot-return:test`
- `npm run runtime-api-current-project-one-shot-return-routes:test`
- `npm run settings-credentials:test`
- `npm run runtime-api-boundary:test`
- `npm run electron-project-scope:test`
- `npm run current-project-selection-binding:test`
- `npm run agent-current-task-projection:test`
- `npm run agent-video-execution-adapter:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run demo:ready:test`
- `npm run prototype-ui:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

The app-action test uses a real external temporary project root and one
localhost Responses request. It proves the actual runtime transport,
single-use claim, project-relative output, hash-bound result, and cold restore
without external provider access or cost. Temporary project media is deleted.

## Historical no-submit packaged preparation

`npm run package:dir` passed after the identity-bound P6-C changes. The command
ran only the TypeScript, Vite, Electron runtime, Electron main-process, and
`electron-builder --dir` build steps. It did not start the packaged GUI, a dev
server, or a provider command.

Packaged artifact:

- App: `release/mac-arm64/Vibe Director Studio.app`
- Archive: `release/mac-arm64/Vibe Director Studio.app/Contents/Resources/app.asar`
- Build time: `2026-07-14 00:13:11 +0800`
- Archive size: `7,345,678` bytes
- Archive SHA-256: `e90746d57feaa3e7f8f10d7de2804d83c72be68c914b73ba2acd1554d8475212`
- Signature: local ad-hoc; no Developer ID or notarization was requested

The pre-P6-C archive had modification epoch `1783948847` and size `7,345,367`
bytes. The first identity-bound archive had epoch `1783957822` and SHA-256
`c6d454303ce64b92cc7a2efd4a9e1c5864e34ed004ec7d08bcb1a8f8b71e099e`.
The post-audit archive has epoch `1783959191` and SHA-256
`e90746d57feaa3e7f8f10d7de2804d83c72be68c914b73ba2acd1554d8475212`,
proving that the packaged directory was regenerated after the final no-submit
safety fixes.

The archive was extracted read-only for bundle inspection. Its packaged
runtime contains `provider-submit-claims`, `permissionReceiptId`,
`projectFactHash`, `provider_submit_attempted`, `provider_submit_succeeded`,
`provider_submit_failed`, `runtimeExternalNetworkCallMade`,
`apikey-fun-gpt55-responses-image`, project-relative output fields, allowed
project-root handling, and realpath checks.

Packaged/source identity checks:

- packaged and build-output `electron-runtime/local-runtime-api-server.mjs`:
  `2a4c37b1dd19e8045a1d9c0c723bdcaf20a32e2ba928fc6618ee10c170fab0db`
- packaged and build-output `electron-dist/main.mjs`:
  `83fffedf277ca6e587217b7a0f73f2d396a0ff7376bc1a283c870f014ebd5b06`

A credential-shape scan of all 30 extracted archive files found 0 token or
literal API-key assignments. Three initial substring candidates were verified
as `task-...` CSS class-name fragments and excluded by requiring a real token
boundary; no candidate value was printed.

At this historical checkpoint, the package proved only that the identity,
claim, external-root, and lifecycle contracts were present in packaged code.
The later authorized one-shot and packaged GUI acceptance are recorded above;
the final package identity is recorded in Final verification.

## Final live-preflight code audit

A final code-level audit before live authorization found two truth/safety gaps:

1. The submit route checked for an existing permission claim and then used a
   normal atomic replacement write. One runtime process was protected by its
   synchronous ordering, but two processes sharing the same project could both
   pass the existence check before either claim became visible.
2. Mock/offline success and missing-result paths persisted a no-call claim but
   returned `providerCalled=true`. The mock success path also invoked the real
   return-ingest writer with `actualProviderReturned=true`, which could rewrite
   mock observation and QA sidecars as if an external provider had run.

Minimal fixes:

- `claimOneShotExecutorJson` now creates the claim with filesystem `wx`
  exclusivity. The first writer wins; a second writer receives `EEXIST`, keeps
  `providerCalled=false`, and cannot reach provider IO. In a narrow
  cross-process race, both requests may already have resolved the local key
  before claim acquisition; neither response exposes the key, and only the
  claim winner can use it for provider transport.
- Mock/offline response, preview, observation, QA, serial summary, and claim
  fields now consistently keep provider/network flags false.
- Mock return evidence uses `mock_provider_result`,
  `mock_image_semantic_review`, and `dry_run_executor`; it no longer enters the
  actual-provider return writer.

Additional verification passed:

- `npm run runtime-api-current-project-return-writers:test`
- `npm run runtime-api-current-project-p6-real-image2-routes:test`
- `npm run p6-real-image2:app-action-test`
- `npm run p6-real-image2:serial-batch-test`
- `npm run runtime-api-current-project-image2-handoff:test`
- `npm run current-project-provider-submit-permission-receipt:test`
- `npm run p6-real-image2:test`
- `npm run p6-real-image2:preflight-safety-test`
- `npm run runtime-api-current-project-one-shot-return:test`
- `npm run runtime-api-current-project-one-shot-return-routes:test`
- `npm run p6-real-image2:secret-scan`
- `npm run demo:ready:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run package:dir`

The packaged runtime directly contains `flag:"wx"`, `EEXIST`,
`provider-submit-claims`, the provider claim lifecycle states,
`mock_provider_result`, and `mock_image_semantic_review`.

## Final verification

The final closure reran the required Agent-first suite, P6-C focused suite,
TypeScript, diff checks, secret scan, and package smoke. Notable passing gates:

- `npm run demo:ready:test`
- `npm run prototype-ui:test`
- `npm run runtime-api-current-project-review-decision:test`
- `npm run runtime-api-current-project-image2-handoff:test`
- `npm run runtime-api-provider-return-evidence:test`
- `npm run p6-real-image2:test`
- `npm run p6-real-image2:preflight-safety-test`
- `npm run p6-real-image2:retry-harness-test` using only fake/local attempts
- `npm run p6-real-image2:app-action-test`
- `npm run p6-real-image2:serial-batch-test`
- `npm run p6-real-image2:preview-export-test`
- `npm run p6-real-image2:secret-scan`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run package:smoke`

The final archive is:

- app: `release/mac-arm64/Vibe Director Studio.app`
- build time: `2026-07-14 04:27:20 +0800`
- archive size: `7,355,389` bytes
- archive SHA-256:
  `b23b32213a64371bbf1d3afa976a70b5d722868896118a84565cfb269ffec7c1`
- signature: local ad-hoc; Developer ID and notarization remain intentionally
  outside this local creator beta

No matching packaged App, runtime server, or remote-debugging process remained
after acceptance.

## Phase transition

P6-C is complete at readiness label
`P6-C real reference one-shot accepted`. Entry to P6-D planning is allowed, but
P6-D live video submission remains blocked until a separate video-provider
preflight and action-time authorization. The standing image API authorization
does not authorize Seedance, Jimeng, Minimax, or any other video provider.

P7 remains responsible for explicit media lock/promotion and must preserve the
rule that an approved review alone does not mutate formal project facts.
