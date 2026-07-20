# Vibe Director Studio P11-B single Provider canary

Date: 2026-07-20

Status: **TERMINAL FAILURE BEFORE VIDEO PROVIDER EXECUTION**.

P11-A passed at commit `7f7e203`. The user authorized exactly one packaged
submission of `P11S01`, using `5` seconds, `720p`, and
`seedance2.0_vip`, with no automatic retry. That one-submit authorization was
consumed by the packaged confirmation action. The action failed during
pre-submit validation, before the Seedance video command ran.

This result is terminal for P11-B. The fixture must not be prepared again,
submitted again, switched to another model, or retried automatically.

## Frozen request

- Fixture root: `/tmp/vibe-director-p11-b-20260720`
- Project id: `p11_provider_canary`
- Shot id: `P11S01`
- Duration: `5` seconds
- Aspect ratio: `16:9`
- Resolution: `720p`
- Model: `seedance2.0_vip`
- Provider capability: `jimeng-seedance`
- Maximum submit count: `1`
- Automatic retry: `false`
- Extra storyboard/reference generation: `false`

The request reused three locked project references. The existing version A was
copied into the isolated fixture with SHA-256
`bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`.
No source project or source media was modified.

## Actual result

The packaged App restored exactly one live confirmation bound to:

- Job:
  `agent_video_job_review_regeneration_proposal_agent_video_P11S01_1af47716_submit_video_002`
- Action:
  `agent_action_2026_07_19t22_21_44_344z_prepare_video_submit`
- Confirmation:
  `agent_tool_handoff_2026_07_19t22_21_44_344z_agent_action_2026_07_19t22_21_44_344z_prepare_video_submit`

The native packaged click hit the sole enabled `确认并提交 1 次` button and
atomically wrote `submit-attempt.json`. The confirmed action then failed with a
video-rule validation message. No `multimodal2video` command log, Seedance
submit report, relay queue, or `externalTaskId` was produced. The live ledger
job remained `staged` with `providerCalled=false`.

Exact terminal counts:

| Counter | Value |
| --- | ---: |
| Packaged submit actions | 1 |
| Seedance video submit calls | 0 |
| Query attempts | 0 |
| Seedance video query calls | 0 |
| Automatic retries | 0 |
| Extra generated images | 0 |
| Returned media | 0 |

The video Provider fee boundary was not crossed. Provider-backed text-QA call
count is not durably recorded by this acceptance path, so this document does
not claim an exact total text-model call count or absolute total cost.

## Root cause

The isolated fixture stored `executionMode: "action_closeup"`. That value is
not one of the five canonical execution modes:

- `single_continuous_shot`
- `relationship_wide`
- `action_insert`
- `reaction_closeup`
- `planned_cut_sequence`

Three local gaps let the invalid value survive until after paid confirmation:

1. Director Rule QA did not validate `executionMode`.
2. The runtime-to-Project.vibe projection discarded `executionMode`,
   `referenceStrategy`, duration, camera, and action-semantics fields before the
   confirmed Product Agent preflight.
3. The App still called provider-backed text QA when deterministic Rule QA had
   already returned `blocked`.

The later text-QA path returned a suggestion mentioning `omni_reference`, but
that is a reference strategy, not an execution mode. The Runtime video-submit
route itself was never reached.

## Minimal hardening

1. P11 fixture creation now uses `single_continuous_shot`.
2. `prepare` refuses to run when `submit-attempt.json` already exists, before
   deleting or recreating the fixture. The consumed one-submit lock cannot be
   erased accidentally.
3. Director Rule QA now emits blocking `invalid_execution_mode` before paid
   confirmation for every nonempty, noncanonical value.
4. Runtime-to-Project.vibe projection preserves the structured director fields
   needed by deterministic preflight.
5. A deterministic Rule QA blocker now short-circuits provider-backed text QA.
6. Contract tests cover the immutable submit lock, all five canonical modes,
   director-field round trips, and a guarded packaged negative preflight.

These changes prevent recurrence. They do not authorize or perform another
Provider submission for this canary.

## Evidence

- Pre-submit observation:
  `/tmp/vibe-director-p11-b-20260720/evidence/pre-submit-observation.json`
- Atomic attempt record:
  `/tmp/vibe-director-p11-b-20260720/evidence/submit-attempt.json`
- Packaged result observation:
  `/tmp/vibe-director-p11-b-20260720/evidence/submit-observation.json`
- Sanitized repository evidence:
  `docs/evidence/p11-b-provider-canary-20260720/final-observation.json`
- Guarded packaged negative preflight:
  `docs/evidence/p11-b-provider-canary-20260720/invalid-execution-mode-preflight.json`

## Verification

Passed after the terminal result, with zero additional Provider calls:

- `npm run p11-b-provider-canary:contract:test`
- `npm run p11-b-provider-canary:preflight:test`
- `npm run director-rule-qa:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run agent-director-review-regeneration:test`
- `npm run director-product-agent-loop:test`
- `npm run director-text-qa:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

The guarded packaged preflight used a different `/tmp` root and replaced the
`dreamina` executable with a local marker command. The invalid mode was blocked
before text QA and Runtime submit; the marker was not called, no submit report
or relay queue was created, and no external identity appeared.

The existing fixture reports:

- Phase: `submit_attempt_without_identity`
- Submit-attempt count: `1`
- Video Provider call count: `0`
- Query-attempt count: `0`
- External task identity: absent

No query is possible without an exact `externalTaskId`.

## Gate

P11-B is closed as a failed canary. Safe local P11-C and P11-D work may
continue, but this result must not be represented as real Seedance execution.

Single real Provider canary FAILED

Real video Provider execution NOT VERIFIED
