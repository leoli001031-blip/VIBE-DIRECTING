# Vibe Director Studio P10-D Review regeneration acceptance

Date: 2026-07-18

Status: **PASS FOR SIXTH VERTICAL SLICE ONLY**. This acceptance covers the
local/dry-run path from an exact `needs_review` result through Clarify,
Proposal, and one fresh generation Confirmation. The final
`确认并提交 1 次` action was not clicked. No Provider task, fee, retry, A/B
comparison, project-fact promotion, Delivery action, or export was executed.

## Accepted scope

1. `需要修改` keeps the exact returned result immutable and opens a structured
   revision intent.
2. Concrete feedback enters Clarify and cannot directly become a Provider
   prompt, generation action, or job.
3. A clarification choice forms one structured Proposal. The old result stays
   visible and the generation ledger remains unchanged.
4. Confirming the Proposal compiles a new prompt and creates one fresh action,
   confirmation, and staged dry-run job. None of the old identities are reused.
5. The new Confirmation is local and non-paid, has no invocation, and remains
   behind an explicit user-confirmation boundary.
6. Clarify, Proposal, and Confirmation each restore exactly after cold restart.
7. Passive Review, old completion state, and old video blockers do not replace
   or corrupt the current D6 turn.

## Packaged fixture

- QA root: `/tmp/vibe-director-p10-d6-20260718-r3.CNaNNx`
- project root:
  `/tmp/vibe-director-p10-d6-20260718-r3.CNaNNx/projects/p10-d6-regeneration`
- profile: `/tmp/vibe-director-p10-d6-20260718-r3.CNaNNx/profile`
- runtime: `/tmp/vibe-director-p10-d6-20260718-r3.CNaNNx/runtime`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project id: `current_project`
- project fact hash: `pv_cc4049f3`
- shot id: `P6S01`
- `project.vibe` SHA-256:
  `47e5280209fa508c96ba36ce804fd370da4f62a04a06952cf9dbe7633177d5af`
- existing MP4 SHA-256:
  `6c1cc9d172160c36634d19ba84839b5738a5c9be3a862c1a1928d46535a135f1`

The packaged processes used isolated `/tmp` roots, the test-only
token-protected loopback acceptance control, and an environment with all image,
video, text, and general Provider credentials unset.

## Identity boundary

Existing immutable result:

- job: `p10d4_job_p6s01_local_return`
- action: `p10d4_action_p6s01_local_return`
- confirmation: `p10d4_confirmation_p6s01_local_return`
- receipt: `local_return_receipt_p10d4_p6s01`
- status: `succeeded` with `needs_review` result evidence

Fresh D6 confirmation:

- proposal: `proposal_agent_video_P6S01_14baf769`
- job:
  `agent_video_job_review_regeneration_proposal_agent_video_P6S01_14baf769_submit_video_002`
- action:
  `agent_action_2026_07_18t12_58_41_821z_prepare_video_submit`
- confirmation:
  `agent_tool_handoff_2026_07_18t12_58_41_821z_agent_action_2026_07_18t12_58_41_821z_prepare_video_submit`
- execution mode: `dry_run`
- status: `staged`
- `providerCalled=false`
- no `externalTaskId`
- no output assets

The compiled prompt differs from the raw revision text and is created only
after Proposal confirmation. The new job remains a separate candidate request;
it does not overwrite or retry the existing result.

## Packaged result

### Clarify

- **PASS**: feedback `纸飞机亮得太早了` restores one focused Clarify turn.
- **PASS**: the current task is `确认导演意图`, with exactly two bounded
  directions: `情绪转折` and `提前预兆`.
- **PASS**: the visible facts say the original result is retained and no new
  task exists.
- **PASS**: no Proposal, Confirmation, action, or job is created.

### Proposal

- **PASS**: selecting `情绪转折` replaces Clarify with one Proposal.
- **PASS**: the proposal shows creator-facing modification, version, and review
  policies without exposing raw internal field names.
- **PASS**: `确认重新生成提案` is enabled and `继续调整` remains available.
- **PASS**: cold restart restores the same Proposal and no other focused turn.
- **PASS**: the generation ledger still contains only the old succeeded job.

### New Confirmation

- **PASS**: confirming the Proposal creates exactly one new staged job and one
  Confirmation with fresh identities.
- **PASS**: the current task becomes `确认验证视频流程` and the visible boundary
  is `本地验证 · 不计费`.
- **PASS**: `确认并提交 1 次` is enabled but was not clicked.
- **PASS**: the staged plan is `awaiting_confirmation`, has no non-confirmation
  blockers, and its handoff contains only `user_confirmation_required`.
- **PASS**: cold restart restores the same confirmation id and action id, with
  no Clarify, Proposal, passive Review, or duplicate confirmation.
- **PASS**: the new job remains `staged`, `providerCalled=false`, with no
  `externalTaskId`, output asset, invocation, or receipt.

The new-confirmation and confirmation-cold-restart screenshots are
byte-identical at SHA-256
`93e3cca3766704ed01478e3d82a484f3ea2a3dd930d9eef4e28e508826e76f1c`.

## Invariants

- `project.vibe` and the existing P6S01 MP4 retain their baseline hashes.
- The ledger contains exactly two jobs: the old succeeded result and the new
  staged dry-run request.
- The old Review Receipt remains non-promotional; no project fact was promoted.
- No media, export artifact, Provider receipt, external task id, retry job, or
  Delivery output was created.
- The final project file set contains only the original project facts, three
  Agent sidecars, the existing locked references, preview plan, and P6S01 MP4.

## Defects closed

1. Passive Review context could retain the visible current-task title while a
   D6 Clarify or Proposal owned the turn. The focused turn now owns the header,
   context chips, and primary task copy.
2. The generic action snapshot inherited missing-reference state from the old
   result. The independent candidate action now stages against an explicit
   reference-ready snapshot.
3. The shared pipeline plan inherited the old submitted-video state and blocked
   a fresh candidate. D6 builds a separate local submit plan without changing
   the shared pipeline contract.
4. macOS canonical paths (`/tmp` and `/private/tmp`) failed strict raw-string
   comparison in confirmation and ledger persistence. Project-root comparison
   now normalizes those aliases while still rejecting a different root.
5. Restore initially rebuilt the D6 handoff from generic old-video availability
   and added `video_submit_already_sent`. Exact confirmation plus job identity
   now preserves the independent handoff, while unrelated staged plans retain
   dynamic availability refresh.

## Minimal implementation surface

- `src/ui/director/agentDirectorReviewRegeneration.ts`
- `src/ui/director/agentDirectorClarification.ts`
- `src/ui/director/agentDirectorTurnProjection.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/core/agentCurrentTaskProjection.ts`
- `src/project/projectAgentStagedPlanDraft.ts`
- `src/App.tsx`
- `scripts/agent-director-review-regeneration-test.mts`
- focused projection, closed-loop, and UI contract tests
- `design-qa.md`
- this acceptance record and its five evidence captures

Existing dirty files from earlier P10-D slices were preserved. No file was
cleaned, reverted, staged, or committed in this acceptance.

## Evidence

- Clarify:
  `docs/evidence/p10-d-review-regeneration-20260718/01-packaged-clarification.png`
- Proposal:
  `docs/evidence/p10-d-review-regeneration-20260718/02-packaged-proposal.png`
- Proposal cold restart:
  `docs/evidence/p10-d-review-regeneration-20260718/03-packaged-proposal-cold-restart.png`
- New Confirmation:
  `docs/evidence/p10-d-review-regeneration-20260718/04-packaged-new-confirmation.png`
- Confirmation cold restart:
  `docs/evidence/p10-d-review-regeneration-20260718/05-packaged-confirmation-cold-restart.png`

## Verification

Passed:

- `npm run agent-director-review-decision:test`
- `npm run agent-director-clarification:test`
- `npm run agent-director-review-regeneration:test`
- `npm run agent-director-turn-projection:test`
- `npm run agent-current-task-projection:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run creator-desk-p4-review-loop:test`
- `npm run runtime-api-current-project-review-decision:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Gate

P10-D6 is accepted for this local/dry-run vertical slice. Stop at the fresh
Confirmation boundary. P10-D7 A/B or version comparison, Provider execution,
project-fact promotion, Delivery, and export remain separately bounded work and
were not entered.
