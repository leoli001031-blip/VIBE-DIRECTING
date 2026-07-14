# Agent-first P6-D video preflight audit

Date: 2026-07-14

Status: PARTIAL PASS for P6-D live provider acceptance. The single authorized
video was submitted and recovered by the same task id, but the provider still
reports it as queued, so live returned-media review remains pending.

Readiness label:
`P6-D live submit/query verified; returned-media needs_review acceptance pending`.

The user explicitly authorized one provider-backed director text QA and one
standard Seedance 2.0 video submission for `P6S01`. The packaged App completed
both exactly once. All later provider actions were query-only operations against
the persisted `externalTaskId`; no retry or second submission was attempted.

## Scope and baseline

- Branch: `codex/agent-first-local-baseline-20260712`.
- Starting commit: `ea8fc26 Complete P6-C real reference acceptance`.
- No frontend dev server, UI redesign, Product Design, ImageGen, or visual work.
- Real storyboard-image generation calls in P6-D: 0.
- Provider-backed director text-QA operations in P6-D: 1.
- Real Seedance/Jimeng video submissions in P6-D: 1.
- Same-task provider result queries in P6-D: 2.
- Automatic retries or resubmissions in P6-D: 0.
- New image or video media returned by the provider: none; the task is queued.

## Authorized one-shot

Project root:

`/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot`

Bound submission target:

- shot: `P6S01`
- duration: 5 seconds
- model: `seedance2.0` standard
- resolution: `720p`
- ratio: `16:9`
- max concurrent video jobs: 1
- extra storyboard image generation: disabled for this single-shot
  `omni_reference` path
- confirmation boundary: packaged App `确认提交视频` action

The project contains one shot and three usable locked image references. The
one-shot `omni_reference` route used those references directly and did not
generate a storyboard image.

## Live packaged acceptance

Packaged-run isolation:

- user data: `/tmp/vibe-director-p6d-live-20260714-r1/profile`
- runtime: `/tmp/vibe-director-p6d-live-20260714-r1/runtime`
- project id: `current_project`
- project root:
  `/tmp/vibe-director-p6c-live-20260714-r4/projects/p6c-reference-one-shot`

The packaged App performed one provider-backed director text QA. Its receipt is
`video/seedance_2026-07-14T14-03-45-563Z/receipts/director-text-qa.json`.
The provider returned `needs_revision` with zero blockers and one advisory
warning; the warning did not alter the user's explicitly authorized one-shot
scope.

The App then invoked `dreamina multimodal2video` exactly once with the three
locked references, duration `5`, ratio `16:9`, resolution `720p`, and model
version `seedance2.0`. The submit receipt is
`video/seedance_2026-07-14T14-03-45-563Z/receipts/dreamina-submit.json`.
It records exit code 0, no timeout, no stored raw secret, and no storyboard
generation.

The provider returned and the project persisted this identity under both
`submitId` and canonical `externalTaskId`:

`d2c02c02-1c3d-4763-af77-d60816f642cb`

Two later packaged-App actions invoked only `dreamina query_result` with that
exact id. The latest query receipt contains no `multimodal2video` argument. At
`2026-07-14T15:00:23Z`, the provider still reported `Queueing`, position 11030
of 301060. The relay contains one active item, `seedance_segment_1`, bound only
to `P6S01`; its model is `seedance2.0`, resolution is `720p`, duration is 5
seconds, and `autoSubmitAllowed=false`.

A cold packaged-App restart restored the same external task id, displayed
`查询视频结果` as the current Agent task, and kept the confirmation copy explicit
that querying would not repeat submission. After the final package rebuild, a
second restart and query again used the same id and left the queue active. The
single submit receipt remained unique, and the run directory contained zero
video files.

Because no media has returned, live ingestion, project-relative output path,
SHA-256 recording, and the required `needs_review` state have not yet been
observed against real provider media. P6-D therefore remains open at that final
boundary and does not authorize P7 review/export work yet.

## No-submit report

`npm run seedance-live-preflight` returned
`schemaVersion=seedance_live_preflight_v3`, `ready=true`, and
`status=ready_for_video_authorization`.

The machine-readable execution policy records:

- `preflightOnly=true`
- `liveVideoAuthorizationRequired=true`
- `providerCalled=false`
- `runtimeExternalNetworkCallMade=false`
- `videoSubmitted=false`
- `maxProviderSubmitCountAfterAuthorization=1`
- `initialLiveProviderOperations=[director_text_qa, seedance_video_submit]`
- `queryMustReuseExternalTaskId=true`
- `retryRequiresNewConfirmation=true`

### Completion-audit correction

The first v2 report tied the Responses credential only to optional storyboard
image generation. That was too narrow: the packaged route resolves the same
generation service and runs provider-backed director text QA before Dreamina,
even on the one-shot `omni_reference` path. It could therefore report ready on
a machine that the packaged submit route would immediately block.

The v3 report makes the generation-service credential mandatory, exposes the
text-QA operation in the expected live call graph, and still separately proves
that no storyboard image is expected. The corrected actual preflight remained
`ready=true` with the status-only credential checks configured. It made no
network call and created no media.

The preflight now fails closed when the selected shot is omitted, more than one
shot is selected, duration is outside 5-8 seconds, resolution is not 720p, the
queue already has active work, the Jimeng CLI or local credential file is
missing, the packaged generation-service Key is not configured, or the project
lacks a usable selected-shot reference.

The default changed from VIP to standard `seedance2.0`. An explicit VIP choice
is reported as a cost warning. The client, runtime route, Agent capability, and
preflight now share the standard model default.

### Authorization-gate completion audit

A second no-submit audit before the real run found three contract gaps that
could have weakened packaged recovery or made the evidence misleading:

1. The runtime queue persisted canonical `externalTaskId`, but the Seedance UI
   action considered only legacy `submitId` or a synthesized `resumeCommand`
   when deciding whether a cold-restored task could be queried.
2. The shared Agent execution adapter extracted legacy `submitId`/`taskId` but
   not a provider result containing only canonical `externalTaskId`, so the
   fact-bound job ledger could lose the query identity.
3. The one-shot `omni_reference` route correctly skipped storyboard-image
   generation but the final submit report unconditionally claimed
   `storyboardGenerated=true`.

The minimal fixes make `externalTaskId` sufficient query evidence in the real
chain preview, Seedance action, relay queue, Agent job ledger, receipt, and
timeline path. The report now sets `storyboardGenerated` from the actual
`hasStoryboardReference` decision. New tests first reproduced both failures,
then proved an `externalTaskId`-only task remains queryable without resubmit and
an omni-reference submit creates or claims no storyboard image.

### Live-run corrections

The real packaged run exposed a small set of non-visual contract defects. The
minimal corrections are limited to those defects:

- A canonical minimal `Project.vibe` now overrides a stale readable legacy
  `project/story_flow.json`, instead of letting an empty legacy fixture erase
  the selected shot.
- Explicit `omni_reference` mode accepts the selected shot's usable locked
  visual references, ignores text-only style assets when calculating missing
  visual references, and creates no endpoint/storyboard image jobs.
- A locked asset is considered usable even when it does not carry a separate
  generated/existing status marker.
- The Agent confirmation action now responds to its accessible click plus
  pointer and keyboard activation, with event deduplication. No visual style or
  layout changed.
- Active queue copy is derived from the actual model version, so this standard
  run says `Seedance 2.0` instead of the former hard-coded VIP label.
- Real submit/resume reports now derive `dryRunOnly` from mock/provider
  execution truth. The historical submit report for this run was written before
  that correction and incorrectly says `dryRunOnly=true`; the provider-call
  fields and CLI receipt prove it was real. The final resume report, produced
  from the corrected package, records `dryRunOnly=false`.

## Credential boundary

- The preflight checks only that `dreamina` is discoverable and that the local
  credential file exists and is non-empty. It does not read or print the file.
- The selected single-shot path does not generate an extra storyboard image.
  The packaged submit route still requires the configured Responses service
  because it runs one provider-backed director text-QA operation before
  Dreamina. The status check exposes only configured/not-configured; it does not
  print or persist the raw key.
- During live acceptance, only the packaged App invoked the authorized text QA,
  one `multimodal2video` command, and later `query_result` commands for the
  persisted task id. Receipts record `rawSecretStored=false`.
- No secret value was written to the repository or test output.

## External task and recovery contract

The project-side video queue and response contract now persist the provider id
under both the compatibility field `submitId` and the canonical field
`externalTaskId`. Preview items and submit/resume reports expose the same id.

Recovery accepts either a current `externalTaskId` or a legacy `submitId`, then
uses that exact value for `dreamina query_result`. An offline command-spy test
proved cold recovery invoked the CLI once with:

`query_result --submit_id=query-only-submit-001`

The same test proved recovery did not invoke `multimodal2video`. Duplicate
submit while a recoverable task is active remains blocked. UI restore now
accepts `externalTaskId` without requiring a compatibility `submitId` or
`resumeCommand`. The Agent execution adapter prefers canonical
`externalTaskId`, including when it appears only on a relay item, before using
legacy fields. Its ledger separately binds the running/query job to project id,
project root, project fact hash, action id, confirmation receipt, job id, and
external task id; stale facts cannot restore or query it.

## Offline lifecycle coverage

Existing deterministic tests cover:

- submitted and queued/running states;
- polling and cold query recovery;
- timeout with a saved external task id;
- cancellation and terminal failure;
- explicit retry with a new action id and confirmation;
- duplicate confirmation and concurrent duplicate suppression;
- partial and late return handling;
- returned media entering `needs_review` with a project-relative path and hash;
- fact-hash mismatch and corrupt sidecar rejection.

No offline scenario creates or claims a real provider task. Media-looking paths
in the adapter matrix are fake strings or local test fixtures.

## Live boundary and next action

The one-submit authorization has been consumed. No further submit or automatic
retry is allowed for this task. While it remains queued, the only permitted
provider operation is `query_result` with
`d2c02c02-1c3d-4763-af77-d60816f642cb`.

When media returns, the packaged App must persist a project-relative output
path and content hash, leave the artifact at `needs_review`, and require an
explicit review decision. It must not promote the video to a project fact or
export authority automatically. A failed or identity-ambiguous result stops;
any new submission would require a separate explicit authorization and action
id.

P7 remains blocked until the real returned-media boundary is observed. An
unrelated residual issue was also seen: activating `收起 AI 导演` once produced
React minified error 300. It did not affect submit/query identity and is not
being repaired inside this provider-acceptance phase.

## Verification

Passed before the final phase gate:

- `npm run seedance-live-preflight:test`
- actual no-submit `npm run seedance-live-preflight` against `P6S01`
- `npm run current-project-seedance-mode-compiler:test`
- `npm run video-relay-queue:test`
- `npm run jimeng-video-cli:test`
- `npm run agent-video-execution-adapter:test`
- `npm run agent-video-execution-controller:test`
- `npm run agent-video-fake-execution-adapter:test`
- `npm run agent-video-dry-run-adapter:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

Final phase gate also passed:

- `npm run agent-current-task-projection:test`
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
- `npm run package:smoke`

Live packaged acceptance additionally proved:

- one text-QA receipt and one submit receipt;
- one canonical external task id across submit, cold restore, and both queries;
- no second submit receipt and no storyboard/image-generation receipt;
- standard `seedance2.0`, `720p`, 5-second queue state for `P6S01`;
- corrected resume truth: `providerCalled=true`,
  `runtimeExternalNetworkCallMade=true`, and `dryRunOnly=false`;
- zero returned video files, so live `needs_review` ingestion remains pending.

`package:smoke` rebuilt and verified the local ad-hoc packaged App without a
dev server. The packaged launch contract exited successfully, and no App or
runtime process remained afterward.

Packaged artifact:

- app: `release/mac-arm64/Vibe Director Studio.app`
- archive: `release/mac-arm64/Vibe Director Studio.app/Contents/Resources/app.asar`
- archive build time: `2026-07-14 22:55:04 +0800`
- archive size: `7,356,122` bytes
- archive SHA-256:
  `a636b811202eb381a37f0a957f139a5388f51ddf1f2d14a3ebf8cff7dd1d5adc`
- signature: local ad-hoc; notarization intentionally remains out of scope

The rebuilt packaged runtime contains the canonical `externalTaskId` fields,
legacy `submitId` fallback, corrected real/dry-run evidence, and query-only cold
recovery. It proves the live submit/recovery boundary, but not returned-media
review while the provider task remains queued.
