# Vibe Core Agent Handoff

Last updated: 2026-05-18

This repository is the active development root for Vibe Core / Vibe Director Studio.

Project root:

```text
/Users/lichenhao/Desktop/new vibe directing
```

Current planning authority:

```text
README.md
docs/mvp-integration-development-plan.md
docs/mvp-delivery-technical-debt-plan.md
docs/mvp-rc-status.md
```

Older files such as `PLAN.md`, `docs/software-architecture.md`,
`docs/core-development-sequence.md`, and `docs/demo-completion-plan.md` are
historical context unless an active worker brief explicitly references them.

## High-Priority Rules

- `execute-return` is external provider return ingest, not provider submit.
- Mock, dry-run, prepared handoff, and software pressure results must not be called real provider ready.
- Missing media must not return JSON to `<img>` requests; avoid ORB regression.
- Current-project binding is the fact entrypoint; `runtime-state.json` is a rebuildable cache/projection.
- Future implementation changes should default to subagents/workers; the main agent owns decomposition, review, integration, and verification.

## Product Intent

Vibe Director is not meant to become an engineering experiment console. It is an extremely simple AI film/video director desk for creators.

The user-facing product should center on:

- `Story Flow`: a clear storyboard-like view of narrative progression.
- `Asset Library / Visual Memory`: locked character, scene, prop, and style references for consistency.
- `Agent Panel`: a natural-language director input tied to selected act/shot/assets, not a generic ChatGPT box.
- `Preview`: play the current images/videos along the timeline.
- A short project status line that says what matters to a creator.

The complex parts belong under the surface:

- provider receipts
- task envelopes
- manifests
- QA reports
- gates
- queue state
- app-server packets
- diagnostics

Do not put `Round`, `Phase`, `ZP05`, `strict edit`, `provider receipt`, `Queue Shell`, `Provider Lock`, or similar engineering language into the default director interface.

## Product North Star

The product promise is:

```text
Anyone with an idea should be able to direct an AI video through natural language.
```

Vibe Director is upstream of editing tools such as Premiere, Jianying, DaVinci, and similar NLEs. It helps users plan, lock references, generate consistent image/video material, preview the story, and export organized assets. It is not trying to replace a full editing suite.

Default product boundaries:

- Do not build an infinite canvas.
- Do not build a node editor.
- Do not build a heavy timeline editor.
- Do not expose a large prompt-parameter panel to normal users.
- Do not make users understand full AI-video or traditional-film production workflows before they can start.
- Do not turn Diagnostics into the default product surface.
- Do not make the asset library a dump of all generated images.

Users should see story, images, locked assets, selected scope, natural-language input, and preview. The system should hide provider mechanics, prompt compilation, knowledge routing, task envelopes, and QA machinery unless the user enters Diagnostics.

Audio and export positioning:

- TTS, voice sources, ambience, sound effects, and BGM provider slots are planned.
- Voice Memory should store source references and authorization status, not private credentials.
- Settings should eventually allow users to add voice sources.
- Video prompts should default to `no BGM`; BGM should be planned separately unless a provider explicitly requires otherwise.
- Export should support organized assets, storyboard tables, prompts, QA reports, preview rough cuts, and NLE-friendly folders.

## Default UI Contract

The default UI must feel like a minimal director desk, not a runtime dashboard.

Default navigation:

- `Asset Library`
- adaptive story sections from Story Flow
- `Preview`
- a light Diagnostics entry

Story sections must not be hardcoded as `Act I-IV`. They should adapt to the script and project structure, such as `序幕`, `第一夜`, `转折`, `离开`, or any project-specific section names.

Storyboard view rules:

- Images come first.
- Shot cards should show large, complete frames.
- Use short labels such as `1-1`, `1-2`, `Setup`, `Decision`, or one concise Chinese function word.
- Keep queue, provider, gate, receipt, and task counts out of default shot cards.
- Selected shots should show a light scope chip such as `已选择 1-1, 1-2`.

Agent panel rules:

- The Agent panel is a natural-language director input, not a generic ChatGPT window and not a prompt form.
- It should know the selected scope: full project, section, shot, multi-shot, or asset.
- It should accept sentences like `让这几个镜头更压抑一点` or `把这个场景改成凌晨便利店的冷光`.
- It should not ask users to edit provider payloads, task envelopes, prompt fields, or knowledge-pack hashes.

Preview rules:

- Preview should play available images and videos by timeline duration.
- Image-only shots should hold on screen for their planned duration.
- Existing videos should replace their corresponding image holds.
- Missing items may show minimal placeholders.
- Gate details, blocked counts, provider facts, and formal preview/export internals belong in Diagnostics.

## Visual Memory Rules

Visual Memory / Asset Library exists to preserve consistency. It is not a gallery.

Primary asset roles:

- character identity reference
- scene layout reference
- prop reference
- style reference
- voice reference

Minimum first version for a locked visual asset:

- one main character reference, if it is a character
- one main scene reference, if it is a scene
- one short text constraint
- explicit `locked`, `candidate`, or `rejected` state
- future-reference safety status

Future expansion:

- character turnaround views
- expression sheets
- costume locks
- scene master reference
- derived scene views
- camera vectors and world positions
- prop detail references
- style reference boards

Hard rules:

- Temp outputs are not locked assets.
- Failed outputs are not locked assets.
- Candidate assets cannot become future reference authority without explicit QA/promotion.
- Contact sheets belong in Reports or Diagnostics, not the primary Asset Library.
- Asset Library must make it visually clear which references are authoritative.

## Knowledge Pack Status

The first knowledge-library version exists in:

```text
resources/knowledge/
resources/knowledge_pack_manifest.json
```

It currently covers:

- script writing
- script-to-storyflow
- shot functions
- style
- composition
- lighting
- color
- camera movement
- lens/focus
- performance
- prompt templates
- visual memory and scene asset continuity
- keyframe-pair action continuity
- QA
- Image2 provider rules
- Seedance2 provider rules
- provider capability matrix
- provider onboarding and future API slots
- audio planning
- harness engineering for agent workflows

Related code:

```text
src/core/knowledgeRouter.ts
src/core/knowledgePackManager.ts
src/core/knowledgeDefaults.ts
src/core/knowledgeContextBudget.ts
```

Rules:

- Do not inject the whole knowledge library by default.
- Every formal task packet should keep a non-empty `knowledgeInjectionTrace`.
- Knowledge routing should select the smallest useful pack set for the task.
- Prompt Compiler and QA should use the same relevant knowledge source where possible.
- Missing route results may use minimum default fallback packs, but should be visible in Diagnostics.
- User-added knowledge packs should eventually live in Settings or Project Library, not the default director surface.

High-priority knowledge areas to keep improving:

- visual style systems
- storyboard and shot-function language
- camera movement language
- composition, lighting, and color
- script-to-storyflow conversion
- Image2 prompt compilation
- start/end frame action continuity

## Project File Source Of Truth

Long-term source of truth must be project files, not chat history and not a single runtime JSON cache.

The intended project folder shape is:

```text
project.vibe/
  project.json
  production_bible.*
  story_flow.*
  visual_memory/
  spatial_memory/
  voice_memory/
  shots/
  prompts/
  manifests/
  reports/
  preview/
  exports/
```

Core fact objects:

- Production Bible
- Story Flow
- Shot Spec
- Shot Layout
- Visual Memory
- Spatial Memory
- Voice Memory
- Scene Asset Pack
- Task Runs
- Provider Registry
- QA Reports

Rules:

- Runtime state is a projection/cache, not the only authority.
- Old chat context cannot become project fact authority unless imported into project files.
- Provider logs cannot override locked project facts.
- Subagents should read from source-indexed project facts rather than ad-hoc chat summaries.
- SQLite or other local indexes may be used later as cache, but must be rebuildable from project files.

## Visual Consistency Workflow

The production method should follow this chain:

```text
character identity
-> scene space
-> shot layout
-> start/end keyframes
-> video
```

Do not rely on a longer prompt alone to fix consistency.

Rules:

- Lock character and scene references before large image batches.
- Scene multi-views should derive from a master scene, or remain marked as candidate.
- Shot Layout should state subject placement, camera placement, axis/direction, start state, end state, and motion constraints.
- End frame should normally derive from start frame for the same shot.
- End frame is not an unrelated second text-to-image request.
- Plan the end frame before generating the start frame when the shot will become video.
- Motion should be physically plausible; avoid fake motion where only hands/head move or the whole person slides unnaturally.
- Every generated image should be checked at least against identity, scene, pair, story, prop, and style gates.
- Overall visual unity should be judged before small local details.

Local postprocess rules:

- Local tools may resize, normalize format, create contact sheets, lightly soften texture, or perform metadata/file operations.
- Local tools must not repair identity, costume, scene semantics, viewpoint, screen content, or overall style drift.
- Semantic failures require regeneration or provider-supported editing, not OpenCV-style repair.

## Subagent Task Envelope Rules

By default, all future implementation work and file modifications should be executed through subagents/workers to prevent main-agent context explosion; the main agent owns task decomposition, boundary passing, review, integration, and verification.

Formal subagent work must not depend on the main agent improvising context.

Every production subagent task should be generated from a validated `SubagentTaskEnvelope` or equivalent task packet.

Required context:

- task purpose
- selected scope
- source index hash
- project facts
- current shot function
- before/after neighboring shots when relevant
- locked references
- forbidden references
- provider policy
- knowledge injection trace
- expected outputs
- QA checklist
- output schema
- disallowed actions

Rules:

- No free-text worker bypass for production tasks.
- No ad-hoc provider submit from a subagent.
- No credential reads or writes.
- No promotion of temp/candidate/rejected assets by worker self-report.
- Subagents should return structured text summaries and file paths, not image payloads back into the main conversation.
- Main agent integrates and verifies; workers own bounded file/module scopes.

This exists because prior failures came from unstable subagent context: single-frame checks, missing adjacent shots, unclear reference authority, style drift, and story-order mistakes.

## Testing Escalation Ladder

Use staged testing. Do not jump from contract work directly to large real-provider runs.

Recommended order:

1. schema and pure-function tests
2. software-layer runtime tests
3. dry-run task packet tests
4. UI -> runtime -> report/preview software closed loop
5. one real Image2 image
6. three real Image2 images
7. six to ten real Image2 images
8. a small full image project
9. start/end frame image-edit tests
10. only then consider video-provider tests

Before any real video-provider test:

- video provider must be explicitly enabled
- start/end frames must be planned together
- end frame derivation must be proven
- motion endpoint contract must pass
- `no BGM` default should be enforced unless intentionally overridden
- Seedance/Jimeng must not leave parked state by accident

Do not call a test successful just because an image looks good. Track provenance, references, source hashes, provider request ids when available, QA status, and preview projection.

## Current Architecture

Current stack:

- React 19
- TypeScript 5.9
- Vite 7
- Node-based local runtime scripts

Architecture goal from docs:

- React/Vite frontend
- future Tauri v2 desktop shell
- future Rust local orchestrator
- file-first project store
- Codex / CLI / provider adapters behind hard gates

Reality today:

- There is no `src-tauri` yet.
- The app is still a Vite/React web app plus Node scripts.
- Runtime/provider work is mostly contract/prepared/handoff logic, not a finished desktop orchestrator.

## Hard Rules

Keep these rules intact.

- Vibe Core is the control layer between creator and Codex. It does not replace Codex as the intelligence layer.
- Image generation/editing is Image2 only for now.
- Jimeng/Seedance video generation is parked. Do not submit live video tasks unless explicitly enabled later.
- Image edit / image2image must never fall back to text-to-image.
- Prompt-only image edit is forbidden.
- A local image path inside a prompt is not a visual input.
- Any image edit must carry explicit reference evidence:
  - `referenceImageInputs`
  - `referenceAttachmentReceipt`
  - `promptOnly=false`
  - `acceptedByActionSchema=true`
  - `sourceStartFrameSha256`
  - source attachment/alias id
  - `operation=image.edit` or `operation=image2image`
  - `providerRequestId` after real provider submit
  - `outputSha256` after return
- Provider self-report cannot complete a task.
- Mock output, prepared packets, manual handoff, and real provider return are different states. Do not blur them.
- Candidate/failed assets must not become reference authority.
- Start frame and end frame must be planned together before video generation.

## Recent Commits

Most recent relevant commits:

```text
d4884ef Prepare Codex app-server Image2 edit packet
88004ce Block prompt-only strict edit returns
70b0593 Connect Round 5 strict edit return UI
```

Meaning:

- `88004ce` added hard blockers for the prompt-only accident: if a prompt mentions a local image path without an actual reference attachment, it must fail.
- `d4884ef` added a narrow Codex app-server Image2 edit adapter that only builds a `prepared` or `blocked` packet. It does not launch app-server, upload images, submit provider calls, or claim true Image2 execution.

## Current Real Image2 Status

The real Image2 chain is not fully done.

What exists:

- strict preflight sidecars
- strict return ingest
- prompt-only/path-in-prompt blockers
- prepared app-server Image2 edit packet
- reference attachment receipt contract
- tests for the contract and blockers

What does not exist yet:

- actual Codex app-server Image2 action schema integration
- actual `input_image` / local file upload or binding
- actual provider network submit from the app
- real `providerRequestId` capture from app-server
- automatic output return watcher for a real submitted edit
- full UI -> runtime -> app-server submit -> provider return -> QA -> preview loop

Until those exist, do not call the system "real provider closed loop complete."

## Current Technical Debt

These are known and should guide future work.

### P0

1. `src/App.tsx` is a god file.
   - Current size: about 10,366 lines.
   - It mixes director UI, diagnostics, helper functions, runtime projections, state hooks, and many child components.
   - Do not add more major UI code directly to `src/App.tsx`.

2. Default UI is drifting toward engineering diagnostics.
   - The product target is minimal.
   - Move real-chain panels, provider details, Round/ZP labels, and receipt details to Diagnostics.
   - The main director surface should show creator-facing status only.

3. Round5 strict edit gates are duplicated.
   - Similar gate logic exists in runtime server, artifact ingest, and adapter code.
   - Extract a shared `src/core/round5StrictEditContract.ts`.
   - All projection paths must include `referenceAttachmentReceipt` checks.

4. Real provider boundary is still prepared-only.
   - Keep it honest.
   - Prepared packet is not submitted.
   - Manual return is not automatic app-server submit.

### P1

1. `src/styles.css` is too large.
   - Current size: about 4,885 lines.
   - Start splitting by feature/component before adding more global classes.

2. `scripts/local-runtime-api-server.mjs` is too large.
   - Current size: about 5,281 lines.
   - It mixes routing, project binding, strict edit, one-shot Image2, file serving, projection, and sidecar writes.
   - Split routes and domain handlers gradually.

3. `src/core/` is too flat.
   - More than 100 modules live at the top level.
   - Suggested future folders:
     - `src/core/providers/`
     - `src/core/project/`
     - `src/core/runtime/`
     - `src/core/knowledge/`
     - `src/core/media/`
     - `src/core/qa/`

4. Tests are fragmented.
   - There are many one-off `.mjs` test scripts.
   - Add grouped scripts first:
     - `verify:runtime`
     - `verify:provider-contracts`
     - `verify:round5`
     - `verify:ui`
     - `verify:all`
   - Do not migrate all tests to Vitest/Jest in one giant change.

5. `ProjectRuntimeState` is becoming monolithic.
   - Separate creator-facing UI projection from runtime truth and diagnostics state.
   - The director UI should not consume the full runtime state object directly.

6. UI language is mixed and engineering-heavy.
   - Prefer simple Chinese creator-facing labels:
     - `未准备`
     - `可提交`
     - `等待回流`
     - `需要复核`
     - `已阻断`
     - `预览可看`
   - Keep English/protocol words in Diagnostics.

### P2

1. Tauri v2 remains architectural intent, not implementation.
   - If desktop delivery is the next milestone, create a minimal Tauri spike.
   - Do not migrate core logic to Rust in the same step.

2. Add linter/formatter carefully.
   - Consider Biome or ESLint minimal config.
   - Avoid one huge whole-repo formatting diff.

3. Move global type declarations.
   - `window.__VIBE_RUNTIME_API_BASE_URL__` and similar declarations should live in a dedicated type file.

4. Consider runtime schema validation.
   - The repo has many JSON schemas.
   - They are useful for drift checks, but actual runtime validation is not yet uniformly enforced.
   - If adding AJV or similar, start at runtime/project boundaries, not everywhere.

## Refactor Priority

Do this order unless the user explicitly redirects:

1. Create shared Round5 strict edit contract.
2. Stop leaking engineering diagnostics into the main Director UI.
3. Split `App.tsx` by moving large components to `src/components/` or `src/features/`.
4. Add grouped verify scripts.
5. Connect Agent Panel actions to project transaction / task queue.
6. Expose prepared app-server Image2 edit packet through runtime/UI as a user-facing state.
7. Only then continue toward true app-server submit.

## Suggested UI Split

First extraction targets from `src/App.tsx`:

- `MinimalStoryFlow`
- `VisualMemoryPanel`
- `MinimalAgentPanel`
- `MinimalPreviewView`
- `ProjectRealChainPanel`
- `VideoPrepareSummaryStrip`
- `DiagnosticsMode`
- `AssetLibraryView`

Rule:

- Product components belong in main Director surface.
- Engineering components belong in Diagnostics.
- Shared rendering helpers should move to `src/components/` or `src/features/*/`.

## Suggested Core Split

Do moves in small commits, preferably one domain at a time.

```text
src/core/providers/
  provider adapters
  provider transport
  provider receipts
  live/permission gates

src/core/project/
  project store
  project state
  project transactions
  project.vibe IO

src/core/runtime/
  runtime truth
  local orchestrator
  task run ledger
  execution ledger

src/core/knowledge/
  knowledge router
  knowledge pack manager
  context routing

src/core/media/
  image keyframes
  video planning
  preview/export
  audio/voice

src/core/qa/
  QA harness
  visual consistency
  strict pair checks
```

Avoid rewriting business logic during pure file moves.

## Verification Commands

At minimum:

```bash
npm run build
```

If touching Image2 / provider / app-server contracts:

```bash
npm run codex-app-server-image2-edit-adapter:test
npm run real-provider-transport:test
npm run image-reference-delivery-receipt:test
npm run real-provider-one-shot:test
```

If touching runtime API:

```bash
npm run local-runtime-api:test
```

If touching UI:

```bash
npm run minimal-ui:test
npm run build
```

If touching Round5 strict edit:

```bash
npm run round5-artifact-ingest:test
npm run local-runtime-api:test
npm run codex-app-server-image2-edit-adapter:test
```

## Do Not Do

- Do not add new `Phase N` or `Round N` labels unless the user explicitly asks.
- Do not treat prepared packets as real provider calls.
- Do not claim true Image2 edit unless a real visual input was attached and provider evidence exists.
- Do not add more major code to `src/App.tsx`.
- Do not add more global CSS without a split plan.
- Do not expose provider internals in the main UI.
- Do not let test fixture paths become product logic.
- Do not use Jimeng/Seedance live submit in the current phase.
- Do not run destructive git commands.
- Do not revert user changes.

## Current Next Best Task

The safest next development task is:

```text
Extract a shared Round5 strict edit contract and make runtime server + artifact ingest use the same referenceAttachmentReceipt gate.
```

After that:

```text
Slim the main Director UI so diagnostics are hidden by default, then begin App.tsx component extraction.
```
