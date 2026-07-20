# Vibe Director Studio P11-E interaction simplification

Date: 2026-07-20

Status: **PASS FOR LOCAL PACKAGED INTERACTION SIMPLIFICATION**.

P11-E applied the two narrow interaction changes supported by P11-D evidence:
an explicit reference request may stop at its confirmation boundary, and
concrete identity-bound Review feedback may form a Proposal without first
showing a generic Clarify choice. The work used isolated `/tmp` projects and
local deterministic media only.

The packaged App used for the final acceptance was:
`release/mac-arm64/Vibe Director Studio.app`.

## Accepted behavior

| Path | Result | Packaged behavior |
| --- | --- | --- |
| Qualified reference request | PASS | `开始补参考。只形成确认，不执行生成。` produced a fact-bound `prepare_reference_generation` action and restored `确认生成参考` after cold start; no media was created |
| Ambiguous Review feedback | PASS by contract | Short feedback such as `纸飞机亮得太早了` remains in Clarify |
| Concrete Review feedback | PASS | Explicit timing, action, and continuity feedback formed one staged-only Proposal directly; no visible Clarify turn was persisted |
| Proposal confirmation | PASS | Confirming the Proposal created one separate `staged + dry_run` video job and one independent execution confirmation |
| Cold restore and Video navigation | PASS | After media became displayable and the UI stabilized, the sole current task remained `确认验证视频流程` from `timeline_confirmation`; the old Review card was not visible |

Proposal confirmation and execution confirmation remain separate boundaries.
The final execution confirmation was not clicked.

## Root causes and fixes

### Confirmation-only reference wording was collapsed into status inspection

Permission parsing, explain-only detection, and project intent routing each
interpreted `不执行生成` independently. A shared confirmation-boundary intent now
recognizes that the requested endpoint is the confirmation card, while still
deferring execution. Existing plan-only wording such as `先确认范围，别直接生成`
continues to produce planning only.

### Concrete Review feedback always displayed a generic Clarify turn

The Review revision path previously persisted Clarify before considering
whether the creator had already provided enough direction. It now checks for
structured timing, action sequence, continuity, or camera signals. Sufficiently
specific feedback writes the freeform resolution and Proposal directly;
ambiguous feedback keeps the existing Clarify path.

### Restore depended on the transient visible Review target

The regeneration confirmation was previously filtered through the currently
visible preview target. Navigation and media restoration could therefore make
an older `needs_review` result hide the newer confirmation. Restoration now
validates the confirmation against its immutable source Review identity, the
exact succeeded source job, and the current project identity.

## Packaged acceptance facts

- reference media created: `0`
- visible Clarify turns for concrete feedback: `0`
- Proposal entries: `1`
- jobs before Proposal confirmation: `1`
- jobs after Proposal confirmation: `2`
- new job status: `staged`
- new job execution mode: `dry_run`
- current task after cold restore: `确认验证视频流程`
- current task source after cold restore: `timeline_confirmation`
- old Review visible after navigation: `false`
- project facts changed: `false`
- original media changed: `false`
- export performed: `false`

The final acceptance fixture was:
`/tmp/vibe-director-p11-e-20260720-qt2WXg`.

## Evidence

- `docs/evidence/p11-e-interaction-simplification-20260720/observation.json`
- `docs/evidence/p11-e-interaction-simplification-20260720/01-qualified-reference-confirmation.png`
  - SHA-256: `2faf2cef03e29c46953659bf4d0374b502e7b355941f5ecff262831cc33c92ef`
- `docs/evidence/p11-e-interaction-simplification-20260720/02-direct-review-proposal.png`
  - SHA-256: `574927275956aa297e809ba1e88be035d066ef88f6ae221bb3a37adc820e6c78`
- `docs/evidence/p11-e-interaction-simplification-20260720/03-execution-confirmation-cold-restore.png`
  - SHA-256: `e79e574d19409d808b083bc2663f280cec7c2aa0d9177ffd851cdd9043c545d9`

The packaged acceptance waits for the restored local video to become
displayable and for the right rail to stabilize before capturing the final
confirmation evidence.

## Safety boundaries

- Provider calls: `0`
- Provider fees: `0`
- final generation execution confirmed: `false`
- automatic retry: `false`
- project-fact promotion: `false`
- Delivery/export: `false`
- visual redesign: not performed

## Verification

Passed:

- `npm run director-agent-action-envelope:test`
- `npm run project-agent-workspace:test`
- `npm run agent-director-review-regeneration:test`
- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run agent-video-execution-controller:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:smoke`
- `npx tsx scripts/p11-interaction-simplification-packaged-acceptance.mts`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Gate

P11-E local packaged interaction simplification PASS

Real Provider execution NOT VERIFIED

This result is local packaged acceptance. It is not real Provider usability
validation or public-release acceptance.
