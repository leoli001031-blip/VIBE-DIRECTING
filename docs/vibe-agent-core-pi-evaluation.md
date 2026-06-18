# Vibe Agent Core Pi Evaluation

## Current Decision

Use Pi as a design reference, not as a product-level black box.

Pi's `packages/agent` is useful because it separates agent messages, event streams, session trees, tool calls, tool results, and provider-boundary conversion. Those ideas map well to Vibe Director's need for a real Agent timeline.

June 2026 refresh: the public Pi mono repo now lives at
`earendil-works/pi`. The published package is
`@earendil-works/pi-agent-core`, while the source directory is
`packages/agent`. It is a general-purpose agent runtime with tool calling,
state management, and attachment support. The core loop exposes streamed
agent events, validated tool calls, sequential/parallel tool execution,
`beforeToolCall` / `afterToolCall` hooks, and follow-up steering messages.
The harness layer also includes JSONL and memory session stores.

Pi also states that filesystem/process/network permission boundaries are not
built in by default, so Vibe should keep its own product-specific permission
gate rather than importing the coding-agent tools directly.

Do not directly import Pi coding-agent tools into the product. Vibe Director cannot expose free shell, file rewrite, or coding-agent defaults because image/video generation is costful, long-running, and requires user confirmation.

## Borrow

- AgentMessage and AgentEvent style separation.
- Session tree / append-only entries.
- Tool call and tool result as first-class timeline entries.
- Provider-boundary conversion instead of leaking UI-only messages to the model.
- Steering/follow-up message concept for later user interruptions.
- `beforeToolCall` and `afterToolCall` style hooks as the right place to attach
  Vibe permission checks, receipt binding, provider cost checks, and result
  normalization.

## Rebuild For Vibe

- Vibe-specific `AgentActionRegistry`.
- Project.vibe and sidecar persistence.
- Permission gates for project write, reference generation, video submit, and export.
- Seedance serial queue recovery.
- Creator-facing UI messages and confirmation cards.

## First Vertical Slice

The first implementation lives in `src/agent-core`. It does not call Pi at runtime and does not call providers. It creates the product-shaped contract first:

- `AgentMessage / AgentEvent` equivalent: `VibeAgentTimelineEntry`.
- `AgentTimelineStore`: browser-safe timeline document plus Project.vibe sidecar persistence.
- `AgentActionRegistry`: inspect, scan assets, plan next action, generate references, submit video, query video, export project, request confirmation, run confirmed action.
- `AgentRuntimeAdapter`: the stable product-facing entry for `runTurn`, action listing, and confirmed-action execution.
- `PermissionGate`: prevents costful or mutating actions without permission and confirmation.
- `runVibeAgentTurn`: observes the current project snapshot, chooses the next Director action, writes user/tool/assistant/confirmation events, and records confirmed dispatch through the registry bridge.

This keeps the demo chain safe while proving the Agent direction.

## Current Vibe Integration

The existing app still has the older product agent loop and UI handlers for real reference generation, video submission, preview, and export. The MVP integration deliberately keeps those execution paths intact, while adding a real timeline above them:

1. `App.stagePrototypeAgentPlan()` builds the current Project.vibe runtime snapshot.
2. It runs the existing product agent loop for the mature staged action and QA behavior.
3. It also runs `runVibeAgentTurn()` to create the Agent timeline for the same user intent.
4. The timeline is saved to `.vibe-runtime/agent-timeline.json` through the existing Project.vibe sidecar abstraction.
5. `MinimalAgentPanel` renders the timeline first: user message, project inspection, tool result, next-action planning, assistant explanation, and confirmation request.
6. On confirmation, `App.preparePrototypeAgentDemo()` appends a confirmed `run_confirmed_action` turn to the same timeline before the older product execution path runs or hands off to existing safe actions.
7. Runtime-bound projects restore the same timeline through `/api/runtime/projects/current/agent-timeline`, so in-app browser reloads do not fall back to synthetic status text just because direct file storage is unavailable.
8. If no timeline is available, the older synthetic status messages remain as a compatibility fallback.

## June 2026 Runtime Adapter Note

The runtime adapter is intentionally thin for the MVP. It does not replace the mature reference/video/export paths yet. Its job is to make the boundary explicit:

1. The UI asks the adapter to run an Agent turn.
2. The adapter exposes only registered actions.
3. Confirmed execution passes through the permission gate and action dispatch plan before older product handlers run.
4. Confirmed execution now uses a product execution adapter (`buildVibeAgentProductExecutionHandlers`) to map product capabilities onto registered Agent actions. If the selected executor has no handler, the action is blocked instead of falling through to an arbitrary callback.
5. Project writes and style research are now explicit registry actions (`write_project`, `research_style`) instead of falling through to the dispatcher action.
6. Real reference/video/export return values are converted into Agent-facing outcomes in `src/agent-core/confirmedActionOutcome.ts`, so action-result semantics are no longer owned by the UI component.
7. Confirmed product execution is now coordinated by `src/agent-core/confirmedProductActionRunner.ts`. The UI injects product callbacks such as reference generation, Seedance submit, web search, and export, while Agent Core owns handoff validation, trace creation, receipt binding, and outcome conversion.
8. Confirmed product policy lives in `src/agent-core/confirmedProductActionPolicy.ts`: product availability gates, handoff construction, handoff binding checks, blocked/result labels, and reference asset type narrowing are no longer local UI helpers.
9. Registered confirmed product execution now also lives in Agent Core. `MinimalAgentPanel` calls `runRegisteredConfirmedVibeAgentProductAction()`, while Agent Core owns the registered action dispatch, product handler map, confirmed permission mode, and creator-facing blocked labels before product callbacks run.
10. The director UI callback wiring is split into named product capability
    builders for research, reference generation, video, and export in
    `src/ui/director/agentProductCapabilities.ts`. This keeps the panel on the
    path toward "render messages and invoke a capability adapter" instead of
    owning all execution details.

That gives Vibe a Pi-like core seam without importing Pi's coding-agent tools or opening shell/file/network tools to the product.

## Remaining Gaps

- Confirmed actions now write a `run_confirmed_action` dispatch record plus an `执行中` state into the timeline, then append the real `action_result` only after the product callback returns. Tool-result normalization, product availability policy, handoff construction, registered dispatch, confirmed product policy, and confirmed product execution live in Agent Core, while the actual provider calls remain injected product callbacks. The remaining cleanup is to move the source of those callbacks higher in the app shell so `MinimalAgentPanel` receives one product adapter instead of individual callbacks.
- The Agent timeline is visible and restorable, but streaming LLM responses and live tool progress events are not wired yet.
- The UI still has legacy staged-plan cards below the message flow. They should gradually collapse into Agent messages and confirmation cards.
- Temporary projects cannot persist sidecars; they now render a local blocked Agent timeline for "continue" style intents so user messages do not disappear, but full persistence still requires a local project folder.
- Pi-style session branching, steering messages, and interruption handling remain design references for the next iteration.
