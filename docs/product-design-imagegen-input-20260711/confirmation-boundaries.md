# Confirmation Boundaries

| Step | Before confirmation | Confirmed action | Must not happen |
| --- | --- | --- | --- |
| Confirm story | Draft remains editable and uncommitted | Persist the two-shot story and advance to save-location selection | Generate references, submit video, export, or lose the draft |
| Choose save location | No project root is authorized | Open the native folder chooser, canonicalize the chosen root, and save the story | Authorize a renderer-supplied arbitrary path, generate media, or export |
| Prepare references, dry-run | Card says local contract validation | Write a validated job/receipt/timeline record | Call a provider, create a fake reference path, or mark references ready |
| Prepare references, live | Card names the real generation effect | Call the configured provider only after explicit confirmation and capability checks | Start before confirmation, silently switch provider, or imply review passed |
| Submit video, dry-run | Card says local contract validation | Validate the submission contract and persist a zero-output receipt | Call Seedance/Jimeng, queue a task, or mark video generated |
| Submit video, live | Card names the actual submission and queue effect | Submit once through the shared adapter after explicit confirmation | Bypass missing permission/capability, duplicate submit, or hide provider failure |
| Export | Delivery view and Agent message both wait for confirmation | Write the local package under `exports/current-project` | Export before confirmation or generate missing references/videos |

## Interaction Contract

1. A confirmation button executes only the action named by its own structured `actionKind` and `AgentCurrentTaskProjection.step`.
2. Generic text such as “继续”, “没问题”, or “确认” cannot bypass a pending confirmation boundary.
3. Only one confirmation may own the current task. Older cards remain history and are not actionable.
4. Dry-run and live may share the adapter, job, receipt, and timeline schema, but their pre-confirmation copy and output truth must differ.
5. A visual redesign may change composition and styling, but it may not merge, skip, or rename a boundary so that its effect becomes ambiguous.
