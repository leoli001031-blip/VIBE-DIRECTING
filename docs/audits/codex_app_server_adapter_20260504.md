# Codex App Server Adapter Audit - 2026-05-04

## Scope

This audit covers the new Codex CLI `app-server` adapter readiness layer for Vibe Core. It is a contract/readiness adapter only. It does not start a long-running app-server, open a socket, run remote control, submit providers, read credentials, or replace task-packet, sidecar, watcher, or QA gates.

Local evidence was gathered from:

- `codex app-server --help`
- `codex app-server generate-ts --help`
- `codex app-server generate-json-schema --help`
- `codex app-server generate-ts --out /tmp/vibe-codex-app-server-schema/...`
- `codex app-server generate-json-schema --out /tmp/vibe-codex-app-server-schema/...`
- `codex --help`

## Previous Integration

Before this adapter, the agent runtime path was represented by the legacy Codex CLI contract:

- `codex-cli-agent` in `adapterContracts`
- Phase 26 mock/no-op Agent/CLI runner replacement proof
- Phase 29 `codexCliAdapterSpike`, which models future `codex exec --json` spawn/resume shape without actually spawning Codex

That path remains intact. It is still the explicit fallback runtime, and product code must continue to treat task packets, validated envelopes, sidecar permissions, watcher facts, and QA harness output as separate authorities.

## App Server Adapter

The new `codex-app-server-agent` is registered as a planned agent adapter, with detailed readiness captured in `src/core/codexAppServerAdapter.ts`.

The local CLI reports these app-server listen transports:

- `stdio://`
- `unix://`
- `unix://PATH`
- `ws://IP:PORT`
- `off`

For Vibe Core, these are normalized to supported transports `stdio`, `unix`, `ws`, and `off`. The readiness adapter selects `off`, because this phase must not create a live connection or launch a long-running server.

Remote TUI support is confirmed by `codex --remote ws://host:port` / `wss://host:port`. The adapter records this as supported but not executed.

Generated protocol availability is confirmed through local TS and JSON schema generation. The generated protocol exposes the categories Vibe Core needs to reason about:

- Thread methods and notifications: `thread/start`, `thread/resume`, `thread/read`, `thread/turns/list`, `thread/started`, thread status/name/goal/token notifications.
- Turn methods and notifications: `turn/start`, `turn/steer`, `turn/interrupt`, `turn/started`, `turn/completed`, turn diff/plan notifications.
- Filesystem watch: `fs/watch`, `fs/unwatch`, `fs/changed`.
- Approval routes: command/file/permission request approvals, patch/exec approvals, auto-approval review notifications, server request resolution.
- Tool-call routes: dynamic tool call requests, tool user input, MCP elicitation, MCP tool progress, command/file output notifications.

## Hard Locks

The app-server adapter pins these constraints:

- No credential read or credential storage.
- No approval bypass.
- No direct provider submit and no provider submit via app-server.
- Provider self-report is not accepted as completion.
- No socket connection, remote control execution, or long-running app-server launch.
- No task packet bypass.
- No replacement of sidecar permission gates.
- No replacement of watcher/fact promotion.
- No replacement of QA.
- Legacy `codex exec --json` fallback remains explicit and preserved.

## Architecture Impact

This changes the architecture by splitting "Codex as agent runtime" into two explicit routes:

- Legacy fallback: `codex exec --json`, represented by `codex-cli-agent` and Phase 29 spike contracts.
- Planned protocol route: `codex app-server`, represented by `codex-app-server-agent` plus the readiness adapter state.

The app-server path is better suited for thread/turn lifecycle integration because the generated protocol has first-class thread, turn, approval, tool-call, and fs-watch surfaces. That lets future runtime work reason about live collaboration and remote TUI support without pretending that provider execution, file promotion, or QA is already solved.

The key architectural boundary remains unchanged: app-server can become an agent transport, not the source of truth. Vibe Core still needs validated task packets, context packets, sidecar permission gates, filesystem watcher facts, generation health, and QA promotion before any output can be treated as complete.

## Verification

Added:

- `src/core/codexAppServerAdapter.ts`
- `scripts/codex-app-server-adapter-test.mjs`
- `npm run codex-app-server-adapter:test`

Updated:

- `adapterContracts` now includes `codex-app-server-agent`
- `adapter_contract.schema.json` allows `runtimeKind=codex_app_server`
- `adapter-contract-test` covers the new agent contract while preserving `codex-cli-agent`

Recommended checks:

- `npm run codex-app-server-adapter:test`
- `npm run adapter:test`
- `npm run build`

## Residual Risk

This adapter intentionally does not prove live runtime behavior. It proves local protocol availability and Vibe Core contract readiness. A later live integration must separately test socket lifecycle, auth token handling without persistence, approval routing, disconnect/reconnect behavior, thread recovery, and failure semantics.
