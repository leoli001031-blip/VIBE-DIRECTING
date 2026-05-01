# Phase35-42 Beta Closure Audit 2026-05-02

审计范围：`docs/core-development-sequence.md`、`src/core/phaseRoadmapRuntime.ts`、`scripts/phase-roadmap-runtime-test.mjs`、Phase34 Local Orchestrator audit、Function Gap Audit。

边界：只收口 roadmap/docs/tests 和小型 pure runtime 合同；不改 UI 大文件，不启动 worker，不 spawn Codex，不提交 Image2 / Seedance / Jimeng / provider，不读取或写入 credential。

## 结论

Phase 35-42 应作为当前 beta closure 固定终点，不再继续滚动新增 Phase。继续增长 Phase 会掩盖真正问题：系统需要把既有核心能力收成 beta 验收，而不是把默认真实执行提前打开。

固定路线：

- Phase 35：Task Queue Visibility / Progress Strip。
- Phase 36：Project File Fact Source。
- Phase 37：Visual Consistency Contract。
- Phase 38：Full Task Subagent Packet Planner。
- Phase 39：Knowledge Pack User Management。
- Phase 40：Codex Worker Runtime Gate，默认 gated，不实际 spawn。
- Phase 41：Image2 / Seedance Provider Closed-loop Shell，默认 gated，不提交 provider。
- Phase 42：Export / Desktop / Beta Acceptance。

## 硬锁

- Phase 40 只能证明 gated worker runtime shape：`defaultGatedOff=true`、validated envelope only、structured result only、`noActualSpawnByDefault=true`。
- Phase 41 只能证明 provider closed-loop shell：Image2 / Seedance 的 watcher、manifest、QA、promotion gate 可见，但 provider commit 默认 gated。
- Phase 40/41 默认都必须保持：`noSpawnCodex=true`、`noProviderSubmit=true`、`liveSubmitAllowed=false`、`noCredentialRead=true`、`noCredentialWrite=true`、`noShellExecution=true`、`noFileMutation=true`。
- Knowledge Pack 不能覆盖 provider policy、preflight、reference authority、QA gate，不能把 temp/rejected 资产变 formal，也不能启用 parked provider。

## Phase42 Beta Acceptance

Phase 42 必须同时验收：

- Mac desktop readiness。
- Windows desktop readiness。
- Project save/open。
- Preview/export。
- Queue visibility。
- Visual consistency。
- Knowledge Pack user management。
- Provider gate / provider closed-loop shell default gated。
- Tests。

`PhaseRoadmapRuntime.betaClosure` 固定 `finalPhaseNumber=42`、`noAdditionalPhasesPlanned=true`、`canSpawnCodex=false`、`canSubmitProvider=false`、`providerSubmitAllowed=0`，把“不要再无限加 Phase”变成机器可读合同。

## Runtime/Test 接线

- `PhaseRoadmapRuntime` 现在覆盖 `phase_24_to_42`，`totalPhases=19`。
- 新增 typed evidence decisions：`localOrchestratorRuntime`、`taskQueueVisibility`、`projectFileFactSource`、`visualConsistencyContract`、`subagentPacketPlanner`、`knowledgePackUserManagement`、`codexWorkerRuntimeGate`、`providerClosedLoopShell`、`betaAcceptance`。
- `phase-roadmap:test` 覆盖 Phase34 worker self-report 不能完成任务、Phase40 actual spawn drift、Phase41 provider submit drift、Phase42 Windows readiness 缺失，以及 schema 中 Phase42/betaClosure hard locks。
