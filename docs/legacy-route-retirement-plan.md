# Legacy Route Retirement Plan

Updated: 2026-05-15

This plan marks the old Codex/subagent/real-provider verification route as legacy without deleting scripts or breaking older handoffs.

## Current Mainline

Use these commands for new verification briefs and worker receipts:

```bash
npm run verify:prototype
npm run verify:ui
```

`verify:prototype` is the primary product/prototype gate. `verify:ui` is the UI-facing build gate. New documentation should list these first.

## Legacy Compatibility Entrypoints

The old route remains callable through explicit legacy aliases:

```bash
npm run verify:legacy:subagent
npm run verify:legacy:provider-fast
npm run verify:legacy:all
```

These commands are for maintaining older route behavior, reviewing old receipts, or proving backward compatibility. They are not the default verification path for new prototype or UI work.

## Deprecated Aliases

The historical names still exist so older worker packets do not fail immediately:

```bash
npm run verify:subagent
npm run verify:provider-fast
npm run verify:all
```

Treat these as deprecated aliases. New handoffs should use the `verify:legacy:*` names when they intentionally need old behavior, and should otherwise use `verify:prototype` and `verify:ui`.

## Rules

- Do not delete legacy scripts during this retirement phase.
- Do not route new product validation through Codex/subagent/real-provider checks by default.
- Keep real-provider submit out of fast verification.
- Keep provider/subagent receipts as evidence, not authority over `project.vibe`.
- If a worker runs a legacy command, the receipt should explain why the legacy path was needed.

## Next Cleanup Step

After a full round of handoffs no longer references the deprecated aliases, remove those deprecated alias names from new docs first. Script removal should be a separate explicit task.
