# Vibe Director Studio P10-D Paid Confirmation and Running acceptance

Date: 2026-07-17

Status: **PASS FOR THIRD VERTICAL SLICE ONLY**. The accepted scope ends at a
local/dry-run Running job. No paid Provider task was submitted.

## Accepted scope

This slice closes the structured Director turn from a paid execution boundary
to one exact non-terminal job:

1. a paid confirmation is valid only when `confirmationId`, `actionId`, and
   `projectFactHash` match the current task;
2. the focused Confirmation turn exposes one submit-once action and one return
   action, with the external-cost and non-retry boundaries visible;
3. the existing confirmation dispatcher remains the only execution route;
4. Running restores only an exact non-terminal job for the current project
   fact and action;
5. Running exposes only `后台运行` and `查看任务记录`;
6. terminal, wrong-fact, missing-identity, and stale jobs fail closed;
7. Provider submission, retry, approval, fact promotion, Delivery, A/B, and
   export remain outside this slice.

## Packaged App fixture

- QA root: `/tmp/vibe-director-p10-d-third-flbBRh`
- project root:
  `/tmp/vibe-director-p10-d-third-flbBRh/projects/p10-d-paid-running`
- packaged app: `release/mac-arm64/Vibe Director Studio.app`
- project fact hash: `pv_cc4049f3`
- `project.vibe` SHA-256:
  `47e5280209fa508c96ba36ce804fd370da4f62a04a06952cf9dbe7633177d5af`
- confirmation id: `p10d_confirmation_p6s01_once`
- action id: `p10d_submit_p6s01_once`
- job id: `p10d_job_p6s01_once`

The packaged Confirmation and Running states were exercised against the same
project fixture. The paid Confirmation button was deliberately not clicked.
The state transition and dispatcher mapping are covered by contracts; the
packaged Running state uses the existing dry-run job ledger so this acceptance
cannot incur an external charge.

## Observed result

### Paid Confirmation

- **PASS**: the right rail displays one focused `Confirmation` turn with the
  exact confirmation and action identities.
- **PASS**: the target is P6S01 and the copy states that an external video
  generation fee would be created by the live action.
- **PASS**: the only available choices are `确认并提交 1 次` and `返回调整`.
- **PASS**: the irreversible, submit-once, no-auto-retry, and no-export
  boundaries remain visible.
- **PASS**: no generation ledger, Provider request, output artifact, or
  external task id was created while inspecting this state.

### Running

- **PASS**: one exact dry-run job restores as the focused `Running` turn.
- **PASS**: the job id, action id, execution mode, service, model, and three-step
  progress are projected from structured job state.
- **PASS**: the only actions are `后台运行` and `查看任务记录`.
- **PASS**: `后台运行` collapses the rail without mutating or resubmitting the
  job; reopening the rail restores the same task.
- **PASS**: `查看任务记录` opens existing history only.
- **PASS**: the job remains non-terminal and `providerCalled` remains `false`;
  no retry, approval, project-fact promotion, Delivery, or export occurs.
- generation ledger SHA-256 after both UI interactions:
  `21f7653a54b92a8abf51afc7daf90593ad15d7cd5bfbba3a01ca533953374c65`

No `reports`, `exports`, MP4, Seedance, or relay artifact was created. The
project fact hash and `project.vibe` hash remained unchanged.

## Packaged issue found and fixed

The first Running interaction exposed React minified error #300 after clicking
`后台运行`. `MinimalAgentPanel` returned its collapsed shell before later hooks,
so toggling collapse changed the number of rendered hooks.

The minimal fix moves that early return after all hooks and adds a structural
contract asserting that the collapsed return cannot precede a hook. The rebuilt
packaged App was retested: collapse, reopen, and history inspection now complete
without a crash or job mutation.

## Minimal implementation surface

- `src/ui/director/agentDirectorTurnProjection.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/styles/director.css`
- `scripts/agent-director-turn-projection-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `design-qa.md`
- this acceptance record and its evidence captures

Existing dirty files outside this slice were not cleaned, reverted, staged, or
committed.

## Verification

Passed:

- `npm run agent-director-turn-projection:test`
- `npm run agent-video-execution-controller:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run agent-current-task-projection:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run current-project-preview-ui-runtime-closed-loop:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Evidence

- Paid Confirmation:
  `docs/evidence/p10-d-paid-confirmation-running-20260717/01-packaged-paid-confirmation.png`
- Running:
  `docs/evidence/p10-d-paid-confirmation-running-20260717/02-packaged-running.png`
- Pairwise reference comparison: `design-qa.md`

## Not yet accepted

- a real paid or Provider-backed transition;
- automatic polling, retry, cancellation, or terminal result recovery;
- A/B comparison or version-pair selection;
- project-fact promotion;
- Delivery or export.

Those capabilities require later, separately bounded slices. This acceptance
does not authorize or claim any external generation task.
