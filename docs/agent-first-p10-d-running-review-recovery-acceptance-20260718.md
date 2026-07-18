# Vibe Director Studio P10-D Running to Review recovery acceptance

Date: 2026-07-18

Status: **PASS FOR FOURTH VERTICAL SLICE ONLY**. The accepted scope ends at an
exact local/dry-run `needs_review` Review Gate. No Provider task, approval,
project-fact promotion, retry, Delivery action, or export was executed.

## Accepted scope

This slice closes one exact recovery bridge:

1. a returned video result is recorded against the same project id, canonical
   project root, project fact hash, job id, action id, shot id, receipt id,
   output path, and SHA-256 as its Running job;
2. the terminal generation job restores as one focused Review turn rather than
   remaining Running or falling through to passive project status;
3. stale, conflicting, outside-project, wrong-fact, wrong-action, and
   incomplete result identities fail closed;
4. the returned media opens in the video workspace once without trapping later
   navigation;
5. cold restart restores the same Review turn and confirmation boundary;
6. approval, revision submission, project-fact promotion, retry, A/B,
   Delivery, and export remain outside this slice.

## Packaged App fixture

- QA root: `/tmp/vibe-director-p10-d-fourth-20260718-r1`
- project root:
  `/tmp/vibe-director-p10-d-fourth-20260718-r1/projects/p10-d-running-review`
- fresh profile:
  `/tmp/vibe-director-p10-d-fourth-20260718-r1/profile-review-v3`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project fact hash: `pv_cc4049f3`
- project id: `current_project`
- job id: `p10d4_job_p6s01_local_return`
- action id: `p10d4_action_p6s01_local_return`
- shot id: `P6S01`
- result receipt id: `local_return_receipt_p10d4_p6s01`
- execution mode: `dry_run`
- `providerCalled`: `false`
- `project.vibe` SHA-256:
  `47e5280209fa508c96ba36ce804fd370da4f62a04a06952cf9dbe7633177d5af`
- returned MP4 SHA-256:
  `6c1cc9d172160c36634d19ba84839b5738a5c9be3a862c1a1928d46535a135f1`

The fixture uses an existing local repository video trimmed to five seconds.
No model, Provider, external network request, or paid submission was used to
create or restore the result.

## Observed result

### Running baseline

- **PASS**: one exact non-terminal dry-run job is the focused Running turn.
- **PASS**: job identity, execution mode, service, model, and progress are
  projected from structured ledger state.
- **PASS**: retry, approval, project-fact promotion, Delivery, and export are
  unavailable.

### Result returned

- **PASS**: the exact job becomes `succeeded` with one in-project output and an
  exact `needs_review` result identity.
- **PASS**: the center opens P6S01 as one returned five-second video marked
  `待复核`.
- **PASS**: the right rail contains one `本轮 · Review` turn with P6S01,
  `needs_review`, `local_return`, and the matching output hash.
- **PASS**: Running is absent and passive export status does not replace the
  current Review turn.
- **PASS**: the visible boundary says `不自动重试、不晋级、不导出`.
- **PASS**: the available Review actions remain `通过预览` and `需要修改`;
  neither was clicked in this acceptance.

### Cold restart

- **PASS**: closing and reopening the packaged App with the same profile
  restores the exact same Review turn.
- **PASS**: the returned and cold-restart screenshots are byte-identical at
  SHA-256
  `d325b508fb3af7205dd398a446a3211ec68b3c34e8a5e3651aad8354cc10ef8b`.
- **PASS**: `project.vibe`, media, generation ledger, and preview plan hashes
  remain unchanged across open, close, and restart.
- **PASS**: no Review Receipt, retry job, external task id, promoted fact, or
  export artifact was created.

## Fixture issue diagnosed

The first returned-state attempt appeared to restore `导出交付包`. The copied
P6 project already contained an approved Review Receipt for the same shot and
the same video SHA-256. The runtime correctly treated those identical media
bytes as already reviewed.

The acceptance fixture was corrected by replacing only its local MP4 with a
different local five-second video and updating the exact result hash in its
ledger and preview plan. With the prior approval no longer applicable, the
packaged App restored Review immediately. This was a fixture identity collision,
not a product logic defect, so no additional product code was changed for it.

Computer Use could enumerate the packaged app but timed out when reading its
multi-instance AX state. The packaged DOM and screenshots were therefore read
through the app's test-only, token-protected loopback acceptance control and
local renderer debugging port. Those tools performed no clicks or mutations.

## Minimal implementation surface

- `src/core/agentVideoProductionContract.ts`
- `src/project/projectAgentGenerationJobLedger.ts`
- `src/core/agentCurrentTaskProjection.ts`
- `src/ui/director/creatorDeskTypes.ts`
- `src/ui/director/agentDirectorTurnProjection.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/App.tsx`
- `scripts/project-agent-generation-job-ledger-test.mts`
- `scripts/agent-director-turn-projection-test.mts`
- `scripts/current-project-ui-closed-loop-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `design-qa.md`
- this acceptance record and its evidence captures

Existing dirty files outside this slice were not cleaned, reverted, staged, or
committed.

## Verification

Passed:

- `npm run project-agent-generation-job-ledger:test`
- `npm run agent-director-turn-projection:test`
- `npm run agent-current-task-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Evidence

- Running:
  `docs/evidence/p10-d-running-review-recovery-20260718/01-packaged-running.png`
- Result returned:
  `docs/evidence/p10-d-running-review-recovery-20260718/02-packaged-review-returned.png`
- Cold restart:
  `docs/evidence/p10-d-running-review-recovery-20260718/03-packaged-review-cold-restart.png`
- Pairwise Review reference comparison: `design-qa.md`

## Not yet accepted

- a real paid or Provider-backed Running-to-result transition;
- automatic Provider polling, retry, or cancellation;
- clicking `通过预览` or submitting a revision from this recovered result;
- A/B comparison or durable version-pair selection;
- project-fact promotion;
- Delivery or export.

Those capabilities require later, separately bounded slices. This acceptance
does not authorize or claim any external generation task.
