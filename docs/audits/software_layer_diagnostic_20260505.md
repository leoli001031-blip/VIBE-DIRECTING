# Software Layer Diagnostic - 2026-05-05

## Result

Status: `needs_runtime_work`

This diagnostic exercises the current software layer around the Codex app-server readiness adapter and Real Demo E2E 002 outputs. It does not generate new images, launch a long-running app-server, open sockets, submit providers, or mutate provider outputs.

## Passed Checks

- Codex app-server adapter is registered in runtime as `codex-app-server-agent:codex_app_server:planned`.
- Legacy Codex CLI fallback is preserved as `codex-cli-agent:codex_cli:active`.
- App-server readiness adapter reports `ready` with transports `off/stdio/unix/ws`.
- Real Demo E2E 002 final report is `ready_for_real_chain_pressure_test` with declaration `actual_provider_observed`.
- Planned real outputs: 6/6.
- Provider observation sidecars: 6/6.
- Semantic QA sidecars: 6/6.
- Semantic QA P0/P1/P2: 0/0/2.

## Issues Found

| Severity | ID | Issue | Recommendation |
|---|---|---|---|
| P1 | manifest_state_not_promoted | Prepare manifest was not promoted after final verification | Introduce a unified task-run state machine and derive manifest/report/preview from it instead of leaving prepare manifest stale. |
| P1 | task_run_state_machine_missing | No durable task-run state machine is present | Add taskRun records with lifecycle states, worker lease, stall timeout, retry budget, and resumability. |
| P1 | worker_lease_missing | Real image plans do not carry worker lease/thread facts | Make queue leases and worker lifecycle facts first-class so interrupted imagegen workers can be resumed or reassigned safely. |
| P1 | watcher_events_synthesized | Watcher evidence is still verify-synthesized | Replace verify-synthesized watcher evidence with append-only fs/watch events that record created/changed/settled/hash and sidecar pairing. |
| P1 | provider_observation_transaction_fields_missing | Provider observations do not bind output hash and app-server thread/turn facts | Bind provider observation sidecars to output hash, app-server thread id, turn id, tool call id, and sidecar hash. |
| P1 | semantic_qa_hash_binding_missing | Semantic QA is not bound to reviewed image hash | Require semantic QA to include reviewed output hash and stable finding ids so QA cannot drift from the image file. |
| P2 | style_p2_texture_trend | Arcade shots show repeated low-texture style drift | Feed repeated P2 findings into the style capsule and prompt compiler, especially for arcade/grime-heavy scenes. |
| P2 | app_server_live_runtime_not_enabled | Codex app-server adapter is planned but not live-enabled | Keep this as planned until socket lifecycle, auth token handling, approval routing, disconnect/reconnect, and thread recovery are tested. |

## Next Engineering Moves

1. Add unified TaskRun lifecycle records and derive manifest/report/preview from the same state machine.
2. Replace verify-synthesized watcher evidence with real fs/watch or app-server fs/changed event logs.
3. Make provider observation and semantic QA sidecars hash-bound and transactional.
4. Add worker leases, thread/turn ids, stall timeout, retry budget, and resumability to the queue runtime.
5. Use repeated P2 style findings as prompt/style capsule feedback instead of treating them as isolated QA notes.

## Artifacts

- JSON report: `real-test-sandbox/software-layer-diagnostic/20260505/software_layer_diagnostic_report.json`
- Real Demo 002 report: `real-test-sandbox/real-demo-e2e/002-anime-pressure/reports/real_demo_e2e_report.json`
- App-server adapter: `src/core/codexAppServerAdapter.ts`
