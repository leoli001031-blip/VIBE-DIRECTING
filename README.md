# Vibe Core

This is the active development root for the Vibe Director / AI video director desk project.

## Current Entry

- App root: `/Users/lichenhao/Desktop/vibe core`
- Local dev: `npm run dev -- --port 5174`
- Import current runtime test: `npm run import:test`
- Build check: `npm run build`

## Scope

Vibe Core is the control layer between the creator and Codex. It should hold project structure, visual memory, shot state, provider policy, task envelopes, audit results, and preview/export status.

The app does not replace Codex as the intelligence layer. It makes Codex work inside a constrained, visible, repeatable production workflow.

## Active Policy

- Image generation and image editing are Image2 only.
- Jimeng/Seedance video generation is currently parked. The app prepares task envelopes and queue state, but should not submit live video tasks in this phase.
- Required image-to-image tasks must not fall back to text-to-image.
- Candidate or failed assets must not become future reference authority.

## Continuous Development Guardrails

Before adding real model calls or polished UI, keep the core contract layer hard:

- Preflight must pass before any job can enter `ready_to_submit`.
- Unknown providers are blocked.
- Parked providers can only create task envelopes or queue placeholders.
- References must carry authority metadata, not only file paths.
- Formal subagent work must use a generated `SubagentTaskEnvelope`; no ad-hoc context handoff.
- End frames must prove derivation from start frames before video generation.
- Draft preview and formal preview/export are separate.
- No real Jimeng/Seedance submit until the video provider is explicitly enabled.
- No complex timeline editor, prompt parameter panel, audio generation, or multi-provider UI until the schema/queue/manifest core is stable.
