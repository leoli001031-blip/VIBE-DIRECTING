# Vibe Director Studio P10-C interaction specification

Date: 2026-07-17

Status: **IMPLEMENTATION INPUT**. This specification freezes the selected
Co-directing Desk direction before the first P10-D slice. It does not authorize
provider submission, automatic retry, project-fact promotion, or export.

## Product shape

Vibe Director Studio is a conversational directing system organized around
three durable layers:

1. a compact project spine for story, references, video, and delivery facts;
2. a center artifact stage for inspecting the selected creative object;
3. one right-side Director turn that owns clarification, proposal,
   confirmation, job observation, and review.

The hidden fourth layer is the decision ledger. Confirmation, job, review,
promotion, and delivery receipts remain durable evidence, but they do not
compete with the current turn in the default layout.

Visual thesis: a quiet editing room built from precise dividers, real media,
compact type, and one restrained green action signal.

Content plan: project facts on the left, the selected artifact in the center,
the current Director turn on the right, and receipts or Skills behind
progressive disclosure.

Interaction thesis: context follows the selected shot and time; each Agent
reply advances one bounded decision; consequential work changes state only
through an explicit in-thread action.

## One-turn rule

`AgentCurrentTaskProjection` remains the only source of the visible current
task. The center artifact may show object state such as `needs_review`, but it
must not expose a second execution or approval shortcut.

The right rail renders one `AgentDirectorTurnProjection` mode:

| Mode | Structured trigger | Allowed primary effect |
| --- | --- | --- |
| `conversation` | non-idle task without confirmation or job | conversation only |
| `confirmation` | `requiresConfirmation=true` | exact projection effect |
| `running` | current `pipeline_job` without confirmation | observe existing job |
| `review` | reference/video review task plus receipt-bound target | Review Receipt only |
| `blocked` | projection blocker or incomplete review identity | explain and continue discussion |
| `idle` | `step=idle` | conversation only |

Display copy, localized labels, button text, colors, and icons are not inputs to
mode selection.

## Six-turn vertical path

| Frame | User-visible turn | Structured input | Command or action | Effect and boundary |
| --- | --- | --- | --- | --- |
| 1 | Select shot/time context | selected shot, artifact id, time | `select_artifact_context` | UI state only; no project mutation |
| 2 | Agent clarifies intent | composer turn bound to context | `continue_conversation` | conversation only |
| 3 | Agent proposes a change | prepared project edit | `prepare_project_edit` | proposal only until its confirmation |
| 4 | Confirm one paid execution | current confirmation id, action id, fact hash | `confirm_current_task` | one generation job; no retry, approval, promotion, or export |
| 5 | Observe execution | current non-terminal job id | `background_job` or `inspect_job` | observe the same job; never submit again |
| 6 | Review returned media | source receipt id and output hash | `approve_preview` or `request_changes` | Review Receipt or conversation only; promotion and export remain separate |

The first P10-D implementation slice covers the existing real-media Review
turn and removes the center approval bypass. Frames 1-5 continue to use the
existing composer, confirmation, and generation-job contracts until their
visual pass is implemented.

## Review contract

A review target is actionable only when all of these are true:

- status is `needs_review`;
- the result is bound to the selected project and shot;
- `sourceReceiptId` is present;
- `outputHash` is present.

`通过预览` calls the existing review adapter with `promotionTarget` equal to
`review_receipt_only`. It does not authorize provider submission, retry,
project-fact promotion, reference locking, or export.

`需要修改` returns focus to the composer with the selected result as context.
It does not reject, retry, or resubmit by itself.

`晋级为项目事实` stays unavailable in this slice and always requires a
separate explicit confirmation with current project, fact, receipt, and hash
identity.

## Component mapping

| Product responsibility | Existing owner | P10-C/P10-D rule |
| --- | --- | --- |
| current task arbitration | `AgentCurrentTaskProjection` | unchanged |
| turn mode and action authority | `agentDirectorTurnProjection.ts` | new presentation contract only |
| artifact playback and selection | `MinimalPreview.tsx` | media and selection only; no approval action |
| conversation, confirmation, job, review | `MinimalAgentPanel.tsx` | one bounded turn and stable composer |
| review persistence | `applyCreatorReviewDecision` | unchanged receipt-only approval path |
| project facts/navigation | `DirectorModeShell.tsx` | compact status only; no duplicate current task |
| Skills and receipts | current Agent details | progressive disclosure, never execution authority |

## Responsive and focus behavior

- At 1181 px and above, keep the full project spine, artifact, and Agent rail visible.
- From 900 to 1180 px, use the icon project spine with the Agent rail still visible.
- From 720 to 899 px, keep the icon project spine and use an Agent drawer.
- Below 720 px, use top project tabs and an Agent drawer over the artifact.
- Every icon-only project navigation button keeps its full `aria-label`.
- Opening Review places focus on the review heading, not the approval button.
- `Tab` reaches `通过预览`, `需要修改`, and the composer in that order.
- After `需要修改`, focus moves to the composer.
- After a successful preview approval, focus returns to the current-turn
  heading and the refreshed projection is announced through `aria-live`.
- No layout transition may move the primary action while a pointer or keyboard
  confirmation is in progress.

## Recovery and failure behavior

- Missing receipt or output hash fails closed and disables preview approval.
- A stale or cross-project target is not passed to the turn projection.
- A terminal job cannot render as `running`.
- An old confirmation cannot replace a current review turn.
- A failed review write keeps the result in `needs_review` and reports the
  failure in the same turn.
- Cold start rebuilds the turn from current projection and durable review/job
  evidence; local React state is never authoritative.

## Acceptance for the first P10-D slice

1. A real `needs_review` video shows one right-side Review turn.
2. The center video workspace has no direct `通过` action.
3. Review approval is disabled without receipt/hash identity.
4. `通过预览` uses the existing receipt-only adapter.
5. `需要修改` focuses the composer and performs no provider action.
6. Project-fact promotion is visibly separate and disabled.
7. Delivery remains unchanged and no export action is introduced.
8. Existing Agent, UI, review, TypeScript, and packaging contracts remain
   green.
