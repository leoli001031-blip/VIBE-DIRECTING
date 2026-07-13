# Immutable Interaction Contract

This document is the behavioral boundary for P5-B. Visual implementation may change hierarchy, spacing, typography, color, and component composition. It may not change the state machine, confirmation semantics, job identity, restore priority, or dry-run/live truthfulness.

## Source Of Truth

`AgentCurrentTaskProjection` is the sole source for the live task shown to the user:

- `step`
- `label`
- `requiresConfirmation`
- `effect`
- `confirmationKind`
- `confirmationId`
- `actionId`
- `jobId`
- `blockers`
- `facts`

The left navigation, center context, Agent task header, confirmation card, primary action, and status announcement may present different views of this projection. None of them may independently decide which task is current.

Display copy is output, not control input. Components must not route, enable, suppress, or restore actions by matching Chinese labels or message prose.

## Non-Negotiable Invariants

1. Exactly one current task is visually primary.
2. A generic composer response such as “继续”, “没问题”, or “确认” is not an execution receipt and cannot bypass a visible confirmation boundary.
3. Every reference generation, video submission/query, and export action is bound to the active project and an explicit confirmation or recovery identity.
4. History, terminal jobs, stale confirmations, cleared plans, and results for an old fact hash cannot become the current task.
5. Dry-run cannot claim that a real provider was called or that a real reference/video asset exists.
6. Querying a submitted video job preserves the existing external task identity and cannot resubmit it.
7. Selecting a save location changes project binding only. It cannot generate references, submit video, or export.
8. Confirming a story preserves the draft shots and advances project state. It cannot erase the story or fall back to an unconnected empty project.
9. Export writes local output only after export confirmation. An old export completion is valid only for the same project fact hash.
10. An execution result is historical evidence after it becomes terminal; it does not outrank the next unmet task.

## Eight-State Contract

| Evidence | Projection or phase | Primary action | Allowed effect | Forbidden effects |
| --- | --- | --- | --- | --- |
| 01 New-video input | `draft_story`, no confirmation | Send the authored intent | Create or update an in-memory draft plan | Confirm story, choose a path, call a provider, export |
| 02 Draft confirmation | `confirm_story`, confirmation required, `effect: none` | `确认这版故事` | Persist the two-shot story and advance to project setup | Clear shots, generate references, submit video, export |
| 03 Save location | `choose_save_location`, `effect: state_only` | `选择保存位置` | Bind or migrate the draft to the selected local project root | Generate references, submit/query video, export |
| 04 Reference confirmation | `prepare_references`, `effect: generation_job` | `确认验证参考流程` in dry-run, provider-specific verb in live mode | Create the confirmed reference job/receipt; dry-run validates the contract only | Claim real assets in dry-run, submit video, export |
| 05 Video confirmation | `submit_video`, `effect: generation_job` | `确认验证视频流程` in dry-run, provider-specific verb in live mode | Create the confirmed submit job/receipt after prerequisites pass | Skip missing-reference boundary, silently resubmit, export |
| 06 Query result | non-terminal video job recovery under `submit_video` | `确认查询视频结果` | Query the existing task and update the same job ledger entry | Create a new external task, change project identity, claim completion without receipt |
| 07 Export confirmation | `export`, `effect: local_export` | `确认导出` | Write the local package and record manifest/receipt after confirmation | Invoke image/video provider, reuse stale completion, export before confirmation |
| 08 Complete/history | terminal result is history; projection returns to the next unmet step | Next action from projection, observed as `补参考` | Show receipt/history and advance to the current unmet task | Let old export/result card remain primary or auto-run the next action |

## Presentation Model

P5-B may introduce a view-only adapter, but it must be a pure projection over existing contracts. It must not create another workflow state machine.

```json
{
  "currentTask": {
    "step": "prepare_references",
    "label": "补参考",
    "effect": "generation_job",
    "requiresConfirmation": true,
    "confirmationId": "confirmation-id",
    "actionId": "action-id",
    "jobId": "job-id",
    "blockers": [],
    "facts": []
  },
  "execution": {
    "phase": "waiting_confirmation",
    "mode": "dry_run",
    "providerCalled": false,
    "receiptId": "receipt-id"
  },
  "history": {
    "items": [],
    "isCurrentTaskSource": false
  }
}
```

The adapter may normalize visual tone, icon, concise description, and object-inspector data. It may not invent `step`, action availability, confirmation validity, execution outcome, or asset existence.

The eight design states are also available as [machine-readable projection examples](projection-examples.json). Their identifiers are explicit placeholders; they define presentation inputs, not persisted fixture data.

## Restore Priority

The visible task must respect the existing recovery order:

1. Current valid confirmation bound to project ID, normalized root, and fact hash.
2. Current non-terminal job bound to the same project and facts.
3. Current active pipeline step or staged plan.
4. Passive project observation/status.
5. Idle prompt when no actionable project state exists.

The following are always filtered from current-task selection:

- resolved, cancelled, or stale confirmations;
- terminal jobs unless displayed as history;
- cleared, expired, invalid, or mismatched staged plans;
- old project roots or fact hashes;
- an export completion for an earlier project fact hash;
- messages whose only match is display text.

## Confirmation Card Contract

Every confirmation surface must expose these fields in this order:

1. **Task:** the projection label.
2. **Target:** project, shots, job, or local export target.
3. **Effect:** `none`, `state_only`, `generation_job`, or `local_export` translated into user language.
4. **Boundary:** what will not happen before or because of this action.
5. **Mode:** dry-run or live, shown with icon and text.
6. **Blockers:** structured blockers, when present.
7. **Primary action:** the exact action from the active confirmation contract.
8. **Secondary action:** revise, cancel, or return without execution.

Only the primary action may create the confirmation receipt. Dismissing, editing, navigating, or typing in the composer must not execute the action.

## Execution And History Layers

- **Waiting confirmation:** one framed action surface; no running language.
- **Running:** immutable job identity, operation, elapsed state, cancellation/retry affordance only when supported by the adapter.
- **Succeeded:** receipt and real output facts. Dry-run success says contract validation succeeded, never that media exists.
- **Failed:** actionable error and retry boundary; no success color or completed copy.
- **History:** compact timestamped rows below the live task. Expanded details are optional and never auto-expanded over the current task.

## Regression Oracles

P5-B is behaviorally valid only when all of these remain true:

- The eight packaged states can be reproduced with the same task/action boundaries.
- The current task shown in left, center, and Agent surfaces agrees with the projection.
- Old confirmation cards disappear from the primary action surface after resolution.
- Dry-run screenshots contain no claim of real references or videos.
- Query uses the same job/external task ID.
- Export completion returns to the next unmet task after restart.
