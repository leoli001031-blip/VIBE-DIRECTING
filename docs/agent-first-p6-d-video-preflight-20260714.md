# Agent-first P6-D video preflight audit

Date: 2026-07-14

Status: PASS for P6-D no-submit readiness only. No real video task was
submitted.

Readiness label: `P6-D no-submit ready; awaiting one-shot video authorization`.

This phase stops at the separate video-provider authorization gate. The user's
standing development-test authorization covers the existing local
`apikey.fun` image credential; it does not authorize a Seedance/Jimeng video
submission.

## Scope and baseline

- Branch: `codex/agent-first-local-baseline-20260712`.
- Starting commit: `ea8fc26 Complete P6-C real reference acceptance`.
- No frontend dev server, UI change, Product Design, ImageGen, or visual work.
- Real image calls in P6-D: 0.
- Real video calls in P6-D: 0.
- External network calls from the P6-D preflight: 0.
- New image or video media created by the P6-D preflight: none.

## Intended one-shot

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
- required confirmation phrase: `submit-seedance-video`

The project contains one shot and three usable locked image references. The
relay queue does not exist yet and has zero active tasks. No MP4, MOV, or WEBM
file existed before or after the preflight.

## No-submit report

`npm run seedance-live-preflight` returned
`schemaVersion=seedance_live_preflight_v2`, `ready=true`, and
`status=ready_for_video_authorization`.

The machine-readable execution policy records:

- `preflightOnly=true`
- `liveVideoAuthorizationRequired=true`
- `providerCalled=false`
- `runtimeExternalNetworkCallMade=false`
- `videoSubmitted=false`
- `maxProviderSubmitCountAfterAuthorization=1`
- `queryMustReuseExternalTaskId=true`
- `retryRequiresNewConfirmation=true`

The preflight now fails closed when the selected shot is omitted, more than one
shot is selected, duration is outside 5-8 seconds, resolution is not 720p, the
queue already has active work, the Jimeng CLI or local credential file is
missing, or the project lacks a usable selected-shot reference.

The default changed from VIP to standard `seedance2.0`. An explicit VIP choice
is reported as a cost warning. The client, runtime route, Agent capability, and
preflight now share the standard model default.

## Credential boundary

- The preflight checks only that `dreamina` is discoverable and that the local
  credential file exists and is non-empty. It does not read or print the file.
- The selected single-shot path does not require an extra storyboard image, so
  the preflight does not resolve or inspect the image API credential.
- `dreamina --help` was the only direct CLI invocation during discovery. No
  generator, account, credit, login, task-list, or query command was run against
  the real provider.
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
submit while a recoverable task is active remains blocked. The Agent execution
ledger separately binds the running/query job to project id, project root,
project fact hash, action id, confirmation receipt, job id, and external task
id; stale facts cannot restore or query it.

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

## Authorization gate and next action

P6-D may perform one real run only after a separate explicit video
authorization. The authorized action must remain exactly one 5-second standard
Seedance 2.0 720p submission for `P6S01` through the packaged App confirmation
boundary.

After submit:

1. Persist the returned `externalTaskId` before treating the task as queued.
2. Do not resubmit on timeout, restart, or an ambiguous provider response.
3. Query only the saved task id.
4. Do not auto-retry a failed submission. A retry requires a new explicit
   confirmation and action id.
5. Any returned video must remain `needs_review`; it cannot become a project
   fact or export authority in P6-D.

If no external task id is returned, the run stops as an unknown-submit failure
and does not spend a second submission automatically.

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

`package:smoke` rebuilt and verified the local ad-hoc packaged App without a
dev server. The packaged launch contract exited successfully, and no App or
runtime process remained afterward.

Packaged artifact:

- app: `release/mac-arm64/Vibe Director Studio.app`
- archive: `release/mac-arm64/Vibe Director Studio.app/Contents/Resources/app.asar`
- archive build time: `2026-07-14 05:02:14 +0800`
- archive size: `7,355,367` bytes
- archive SHA-256:
  `3bb4ec5d5b39c0f182a1ce71ce9f263facb515476b44f8d8fa1c4975cad7852d`
- signature: local ad-hoc; notarization intentionally remains out of scope

The rebuilt packaged runtime contains the canonical `externalTaskId` fields,
legacy `submitId` fallback, and `query_result` recovery command. Passing this
gate permits only the separate one-shot video authorization request; it does
not itself authorize or prove a real video provider call.
