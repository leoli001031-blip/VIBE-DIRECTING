# Vibe Director Studio Product Design / ImageGen Input Pack

This pack records the Agent-first interaction contract before any visual redesign.

## Contents

- `agent-current-task-projections.json`: one structured projection for every main-chain step.
- `confirmation-boundaries.md`: what each confirmation may and may not do.
- `immutable-business-rules.md`: behavior that a visual redesign must preserve.
- `real-app-evidence.md`: real packaged App evidence and execution receipts.
- `p4-acceptance-matrix.md`: P4 local acceptance and deferred public-release status.
- `evidence/`: packaged App screenshots captured from isolated `/tmp` profiles.

## Design Gate

The functional, recovery, dry-run truth, security, dependency, icon, and local
packaged-App work is accepted for design handoff. The product owner explicitly
deferred Developer ID signing, notarization, and Gatekeeper public-distribution
acceptance because public macOS distribution is not part of the current phase.
Product Design / ImageGen may proceed, but must not reinterpret this pack as
permission to remove or merge confirmation boundaries.
