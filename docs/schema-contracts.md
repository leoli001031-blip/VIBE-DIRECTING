# Schema Contracts

<!--
P2-134: This document lists 8 schemas in the "Project Fact Schemas" section below.
The schemas/ directory actually contains 103 schema files (~964 KB total).
The document count should be updated to reflect the full set, or the section
should be scoped to "Phase 9.2 project fact schemas" explicitly.

P2-133: At least 6 docs in the docs/ directory reference historical/deprecated content:
- core-development-sequence.md (historical sequence notice)
- demo-completion-plan.md (historical plan notice)
- software-architecture.md (historical snapshot notice)
- legacy-route-retirement-plan.md (deprecated aliases)
- verification-checklists.md (deprecated aliases)
- refactor-plan-20260511.md (deprecated status field)
Others (landing-architecture.md, mvp-rc-status.md, mvp-rc-checklist.md,
mvp-integration-development-plan.md, mvp-delivery-technical-debt-plan.md)
also reference deprecated or historical routes/docs. Consider adding explicit
"Historical" or "Deprecated" banners to each.
-->

Date: 2026-04-29
Status: v0.1 draft

This folder contains the first hard contracts for Vibe Core. The goal is not to model every future field yet. The goal is to stop formal tasks from relying on memory, loose chat instructions, or unstructured provider logs.

## Current Rules

- `TaskEnvelope.preflight` is required.
- `ReferenceAuthority` must declare `referenceRole`, `polarity`, `lockedStatus`, `allowedUse`, and future-reference safety.
- `SubagentTaskEnvelope` must include `contextLevel`, `sourceIndexHash`, `qaChecklist`, and `expectedOutputContract`.
- Formal subagent output must match `subagent_result_v1`.
- `video.i2v` task envelopes must include `keyframePairDerivation`.
- `formal_preview` cannot contain `blocked_placeholder` events.
- `ProductionBible`, `StoryFlow`, `ShotSpec`, `ShotLayout`, `VisualMemory`, `SpatialMemory`, `VoiceMemory`, and `SceneAssetPack` are file-first project fact contracts.
- `StoryFlow.sections` are adaptive and must not force Act I-IV.
- `VisualMemory` is an asset consistency memory, not a gallery. It only accepts `locked`, `candidate`, or `rejected` authority records for characters, scenes, props, style, and voice anchors.
- Provider temp outputs may be displayed as candidates, but cannot auto-promote to locked, formal, or future reference authority.
- `SceneAssetPack` must carry a master scene plus derived views with world positions, camera vectors, candidate/rejected states, and explicit master inheritance.
- `ShotLayout` must carry subject placement, camera placement, axis/direction, start-frame state, end-frame derivation, and fixed-camera/camera-movement constraints.
- `VoiceMemory` reserves voice sources only; private provider auth material is outside the schema.
- OpenCV/local postprocess is not allowed to repair identity, costume, scene, viewpoint, or style semantics.

## Project Fact Schemas

Phase 9.2 adds schema/docs/test-only contracts for the first file-first fact sources:

- `production_bible.schema.json`
- `story_flow.schema.json`
- `shot_spec.schema.json`
- `shot_layout.schema.json`
- `visual_memory.schema.json`
- `spatial_memory.schema.json`
- `voice_memory.schema.json`
- `scene_asset_pack.schema.json`

The verification entry point is:

```bash
npm run project-facts:test
```

This test checks JSON parseability, `$id`/`title`, key required fields, adaptive Story Flow sections, Visual Memory temp-output promotion locks, Scene Asset Pack master/derived view structure, Shot Layout placement/camera/keyframe derivation, and Voice Memory's absence of private auth fields.

## Naming

Schemas currently follow the TypeScript contract names and camelCase fields. YAML files can later add import/export adapters, but the in-memory contracts should not split into another naming convention yet.

## Next Schema Candidates

- `provider_registry.schema.json`
- `provider_capability.schema.json`
- `queue_state.schema.json`
- `qa_report.schema.json`
- `shot_prompt_plan.schema.json`
- `audio_plan.schema.json`
- `export_manifest.schema.json`
