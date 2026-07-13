# P5-A Product Design Finalization

Date: 2026-07-12

This package closes the design-only phase for Vibe Director Studio. It is grounded in eight packaged App states captured through Computer Use and three ImageGen concept directions. No frontend source code was changed, no dev server was started, and no real image or video provider was invoked.

## Recommendation

Use **Option 1: Signal Desk** as the P5-B implementation direction.

Signal Desk gives the current Agent task one clear visual home, keeps the storyboard and media visible, and uses semantic color only where state or confirmation needs it. Borrow the media prominence of Edit Bay and the compact job-ledger rows of Production Ledger without adopting either direction wholesale.

Implementation remains blocked until the user explicitly confirms the direction.

## Package Index

1. [Product design audit](01-product-design-audit.md)
2. [Immutable interaction contract](02-interaction-contract.md)
3. [Direction comparison](03-direction-comparison.md)
4. [Signal Desk specification](04-signal-desk-spec.md)
5. [P5-B implementation plan and pursuit prompt](05-p5-b-implementation-plan.md)
6. [Machine-readable projection examples](projection-examples.json)

## Evidence Index

| State | Packaged App evidence |
| --- | --- |
| New-video input | [01-new-video-input.jpg](evidence/01-new-video-input.jpg) |
| Draft confirmation | [02-draft-confirmation.jpg](evidence/02-draft-confirmation.jpg) |
| Save-location confirmation | [03-save-location-confirmation.jpg](evidence/03-save-location-confirmation.jpg) |
| Reference confirmation | [04-reference-confirmation.jpg](evidence/04-reference-confirmation.jpg) |
| Video confirmation | [05-video-confirmation.jpg](evidence/05-video-confirmation.jpg) |
| Query-video result | [06-query-video-result.jpg](evidence/06-query-video-result.jpg) |
| Export confirmation | [07-export-confirmation.jpg](evidence/07-export-confirmation.jpg) |
| Execution complete and history | [08-execution-complete-history.jpg](evidence/08-execution-complete-history.jpg) |

## Direction Index

| Direction | ImageGen concept board |
| --- | --- |
| Signal Desk | [option-1-signal-desk.png](directions/option-1-signal-desk.png) |
| Edit Bay | [option-2-edit-bay.png](directions/option-2-edit-bay.png) |
| Production Ledger | [option-3-production-ledger.png](directions/option-3-production-ledger.png) |

## Fixed Scope

- Preserve `AgentCurrentTaskProjection` as the sole source of the current task.
- Preserve every confirmation boundary and dry-run/live distinction.
- Keep history secondary; it must never replace the current task.
- Do not infer behavior from Chinese display copy.
- Do not change provider, job, receipt, restore, export, or project-binding contracts during visual work.
- Do not implement from ImageGen pixels literally. The concept boards define hierarchy and visual direction; the packaged App supplies the real state and copy.
