# Schema Contracts

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

## Naming

Schemas currently follow the TypeScript contract names and camelCase fields. YAML files can later add import/export adapters, but the in-memory contracts should not split into another naming convention yet.

## Next Schema Candidates

- `provider_registry.schema.json`
- `provider_capability.schema.json`
- `queue_state.schema.json`
- `qa_report.schema.json`
- `shot_spec.schema.json`
- `shot_layout.schema.json`
- `shot_prompt_plan.schema.json`
- `production_bible.schema.json`
- `story_flow.schema.json`
- `visual_memory.schema.json`
- `spatial_memory.schema.json`
- `voice_memory.schema.json`
- `audio_plan.schema.json`
- `export_manifest.schema.json`
