# Vibe Agent MVP Architecture

## Goal

Vibe Director should behave like a video-project Agent, not a button-driven workflow.
The first MVP slice is:

```text
user intent
  -> observe project
  -> plan next action
  -> explain in timeline
  -> ask before mutating/costly actions
  -> run confirmed registered action
  -> report result back to the same timeline
```

## Current Shape

```text
UI composer
  -> Agent Core runTurn / intake timeline
  -> Project.vibe sidecar timeline
  -> Agent message renderer
  -> confirmed product action runner
  -> existing reference/video/export callbacks
```

The current vertical slice is intentionally thin. It does not replace the
mature reference generation, Seedance submit, preview, or export paths.
Instead it puts a real Agent timeline and permission boundary above them.

## Implemented Pieces

- `src/agent-core/types.ts`: timeline entry, permission mode, project snapshot, turn result.
- `src/agent-core/actionRegistry.ts`: whitelisted product actions.
- `src/agent-core/permissionGate.ts`: plan/write/reference/video/export permission checks.
- `src/agent-core/runAgentTurn.ts`: observes project snapshot and produces user/tool/assistant/confirmation entries.
- `src/agent-core/toolEvents.ts`: converts Agent turns and confirmed product execution into transcript events, including `run_confirmed_action` start, tool result, and user-facing action report entries.
- `src/agent-core/confirmedProductActionPolicy.ts`: shared confirmed-action policy package for handoff construction, binding validation, result copy, and reference asset type narrowing.
- `src/agent-core/productExecutionAdapter.ts`: maps product execution capabilities and registered executor handlers into the Agent Core shape, with named research/reference/video/export capability adapters.
- `src/agent-core/intakeTimeline.ts`: new-video intake timeline entries for the first project message.
- `src/project/projectAgentTimeline.ts`: Project.vibe sidecar persistence at `.vibe-runtime/agent-timeline.json`.
- `scripts/local-runtime-api-server.mts`: current-project runtime sidecar route for reading and writing the Agent timeline when browser file storage is unavailable.
- `src/ui/director/agentProductCapabilities.ts`: binds the director UI's reference/video/research/export callbacks into the Agent Core product capability shape and owns the thin confirmed-action runner used by the panel.
- `src/ui/director/MinimalAgentPanel.tsx`: renders restored timeline and delegates confirmed product action execution through a single UI Agent product adapter.
- `src/ui/director/NewVideoStart.tsx`: first-message intake now writes/restores the same Agent timeline.
- `scripts/project-agent-timeline-test.mts`: verifies timeline sidecar save/restore, project mismatch fallback, and invalid JSON fallback through the same Project.vibe sidecar abstraction the UI uses.

## Action Source Of Truth

The Agent timeline must record the same action that the product Agent loop chose.
`runVibeAgentTurn` can still infer an action when it is used standalone, but the
UI integration passes the authoritative `DirectorAgentActionEnvelope` from the
product loop into the Agent turn. Confirmed actions also reuse the already
approved action. This prevents the message stream from saying "generate
references" while the confirmed product runner is actually submitting video, or
vice versa.

## Continue And Confirmation Semantics

"继续" is treated as a project-state action, not as a hidden UI shortcut. The
product Agent loop reads `projectReadiness.actionQueue` and stages the highest
priority next action. If the next action is reference generation or video
submission and the user did not explicitly say "only plan" or "do not generate",
the action becomes a confirmation request instead of a blocked dead end.

In the UI composer, typed text always enters the Agent timeline first. Empty
composer state can use the primary button as a shortcut for the current
suggested next action, but a typed "继续" must be sent as a user message before
it can become a confirmation or local-project blocker. This keeps the interface
conversation-first instead of letting hidden button logic swallow user intent.

That means:

- missing references -> stage `prepare_reference_generation`, wait for user confirmation, then expose the registered Image2 handoff;
- ready-for-video projects -> stage `prepare_video_submit`, wait for user confirmation, then expose the registered Seedance handoff;
- explicit plan-only boundaries still block generation and submission.

The core behavior is covered by `npm run director-product-agent-loop:test`.

## Pi Agent Evaluation

Pi's agent core is useful as a design reference because it separates:

- app-level messages from LLM messages,
- event streams from transcript state,
- tool calls from tool results,
- provider conversion from UI rendering.

The current Pi package is MIT licensed and exposes `@earendil-works/pi-agent-core`
as a stateful agent with tool execution and event streaming. That makes it
reasonable to borrow or vendor small architectural ideas later.

For Vibe Director, direct runtime adoption is not the default choice yet:

- Pi's coding-agent layer is built around developer tools, shell/file workflows, and terminal UI.
- Vibe's costly actions are image generation, video submission, export, and long queue recovery.
- Vibe must keep product-specific permission gates and confirmation cards.

Recommended direction: keep `src/agent-core` as the product-owned runtime seam,
and only vendor Pi-derived code later if it clearly reduces our own session,
event streaming, or provider abstraction burden.

## Remaining Gaps

- Live streaming tool progress is not unified yet. The timeline currently updates at turn boundaries.
- `MinimalAgentPanel` still receives the actual product callbacks for reference/video/research/export from the app shell. Policy, dispatch, generic capability mapping, and the UI-side product adapter now live in `agentProductCapabilities.ts`. The next cleanup is moving callback source construction out of the panel props so the shell passes one adapter directly.
- The UI still has legacy project/workflow panels. They should become result surfaces, with Agent messages owning the next action.
- Long-project hierarchy is not modeled yet: episodes, sequences, reusable role/scene/voice libraries.
- LLM-driven semantic QA is still text-only and not integrated as a first-class Agent tool in the turn loop.
- Temporary browser projects can display timeline entries, but durable sidecar persistence requires a real local project folder or a runtime-bound demo project.
- The sidecar persistence path is covered by `npm run project-agent-timeline:test`, and runtime-bound project reload was verified in the browser: the composer restores user messages, project inspection, tool results, next-action planning, and the confirmation request from `.vibe-runtime/agent-timeline.json`.

## Verified Vertical Slice

The current safe front-end verification uses a runtime-bound local project. It
does not click the paid provider confirmation. The verified path is:

1. Reload the app from a fresh browser URL.
2. Restore the current project and `.vibe-runtime/agent-timeline.json`.
3. Show the latest user message, project inspection, asset scan, next-action
   decision, assistant explanation, and confirmation request in one message
   stream.
4. Derive the top project status from the same restored Agent timeline.
5. Keep the composer send button visible and separate from the confirmation
   card.
6. Stop before Image2 or Seedance until the user clicks the message-level
   confirmation.
7. Accept a text-only edit such as "只写项目，不生成参考" as a project-write
   action, not a reference-generation action.
8. After confirmation, append `run_confirmed_action`, `tool_result`, and
   `action_result` entries to the same timeline.
9. Restore those result entries after a browser reload from the sidecar timeline.

Confirmed actions now append both a machine-readable tool result and a
creator-facing action report. The important distinction is:

- `tool_call` / `tool_result` records that the registered Agent tool actually
  started and returned.
- `action_result` records the creator-facing outcome and next review lane.

This keeps the transcript closer to a real Agent session instead of a hidden UI
state change with a single summary message.

`npm run project-agent-timeline:test` also persists and restores the confirmed
tool-result/action-result pair, so refresh behavior is covered outside the
manual browser check.

The new-project entry path has also been verified without provider calls:

1. Use the project control menu to create a new browser-backed local project.
2. Enter a 10-second idea with "只整理故事、镜头和节奏，不生成参考，不发送视频".
3. The intake composer records the user message, input inspection, asset scan,
   draft planning, assistant explanation, and confirmation request.
4. Confirming the draft writes a 2-shot story flow and switches into the Agent
   workbench.
5. Typing "继续" then runs project inspection, asset scan, next-action planning,
   assistant explanation, and stops at the Image2 reference confirmation.
6. The created project stores both `project.vibe` and
   `.vibe-runtime/agent-timeline.json`; the final timeline entries are
   `classify_assets`, `plan_next_action`, `write_agent_message`, and
   `request_user_confirmation`.

## Next Slice

The next useful slice is not a full rewrite. It should reduce the remaining UI
callback coupling while keeping the same confirmed-action behavior:

1. Move callback source construction out of `MinimalAgentPanel` props so the
   app shell passes one product adapter directly.
2. Keep `MinimalAgentPanel` focused on rendering messages, collecting input,
   and invoking the confirmed-action adapter.
3. Add a mocked front-end test that clicks a confirmation with fake product
   callbacks and proves `run_confirmed_action` start plus `action_result` both
   persist to `.vibe-runtime/agent-timeline.json`.
4. Then run one real no-provider front-end test from a new local project through
   idea -> plan -> continue -> confirmation.
