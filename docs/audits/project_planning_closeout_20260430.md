# Project Planning Closeout 2026-04-30

This note reconciles the three subagent audits with the Phase 8.9 / 8.10 implementation completed in the same round.

## Completed In This Round

- Phase 8.9 `generationHealthChecker` is now a first-class runtime diagnostics layer.
- Phase 8.10 `promptConflictChecker` is now a first-class runtime diagnostics layer.
- Both checkers are in `ProjectRuntimeState`, `project_runtime_state.schema.json`, and `schemaRegistry`.
- Both checkers have standalone scripts:
  - `npm run generation-health:test`
  - `npm run prompt-conflict:test`
- Diagnostics UI now has dedicated panels for Generation Health Checker and Prompt Conflict Checker.
- Three subagent audit documents were written:
  - `docs/audits/function_gap_audit_20260430.md`
  - `docs/audits/development_alignment_audit_20260430.md`
  - `docs/audits/minimal_ui_direction_audit_20260430.md`

## Audit Findings Resolved By This Round

- The function-gap audit's Phase 8.9 / 8.10 blocker is now closed by code, schema, tests, and docs.
- The development-alignment audit's Prompt Conflict Checker blocker is partially closed: current implementation covers the explicit real failure classes, but future structured Shot Layout / Visual Memory fields should replace heuristic text checks.
- The UI audit's requirement that complex machine data stay out of the main Director view is respected for the two new checkers: both are Diagnostics-only.

## Remaining P0 Direction

These remain the next high-priority implementation areas after project planning closeout:

1. Project facts as first-class files:
   `project.vibe`, Production Bible, Story Flow, Shot Spec, Shot Layout, Visual Memory, Spatial Memory, Voice Memory, Scene Asset Pack.
2. Visual consistency engineering:
   master scene derivation, scene multi-view inheritance, world position/camera vector, identity/scene/pair/story gates, and start/end frame derivation as executable contracts.
3. Subagent runner hard lock:
   no production worker should run from free text; every image, video, QA, audit, and repair task must run through a validated `SubagentTaskEnvelope`.
4. Minimal UI reframe:
   default UI should move toward the four v4 minimal references: Story Flow image-first, Asset Bible for locked references, Selected Edit natural-language scope, and immersive Preview.
5. File-first project runtime:
   `runtime-state.json` should become a derived cache, not the only source of truth.

## Next Development Sequence

Recommended Phase 9:

1. `Project File Core`
   Create/open/save minimal `project.vibe` folder structure and derive `runtime-state.json` from project files.
2. `Production Bible + Visual Memory Schemas`
   Add first-class schemas and builders for Production Bible, Story Flow, Shot Spec, Shot Layout, Visual Memory, Spatial Memory, Scene Asset Pack, and Voice Memory.
3. `Subagent Envelope Runner`
   Enforce validated task envelopes as the only execution path for future local/CLI workers.
4. `Minimal Director UI`
   Replace the current default Director dashboard with the restrained Story Flow / Asset Library / Preview / natural-language edit layout. Keep diagnostics behind a secondary entrance.
5. `Preview Player MVP`
   Play image holds and existing video clips by timeline duration, with lightweight placeholders for missing segments.

## Boundary To Preserve

- No real provider submit until the runner and provider adapter gates are explicit.
- No Seedance/Jimeng live execution in this planning closeout.
- No text-to-video main path.
- No Fast/VIP defaults.
- No semantic OpenCV repair.
- No prompt bypass around Shot Prompt Plan / Prompt Conflict Checker.
- No default main-screen expansion of diagnostics-only state.
