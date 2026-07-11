# Vibe Director Studio Agent-first Local Baseline Handoff

日期：2026-07-11

## 一句话结论

P0-P4 已按产品负责人确认的“本机 packaged App”范围完成验收。Developer ID、
notarization、stapling 和 Gatekeeper 公开分发验收已明确延期，不再阻断当前产品
开发或 Product Design / ImageGen。真实图片和视频 provider 仍未获授权调用。

## 当前验收范围

当前要求：

- packaged App 不依赖前端 dev server。
- Agent-first 主链路、冷启动恢复和安全边界稳定。
- dry-run 与真实执行状态不能混淆。
- 不要求陌生用户无警告安装，不要求 App Store 或公开 macOS 分发。

未来只有引入公开 macOS 分发时，才重新启用 Developer ID、公证、stapling 和
Gatekeeper 发布门槛。相关脚本和说明保留，但不属于当前必过测试。

## P0-P4 状态

### P0：工程与安全基线

通过。已覆盖受信任主 frame IPC、导航/新窗口限制、canonical project root、
文件和目录 symlink 越界、未创建目标的逃逸父目录、lazy runtime，以及每次
Electron 启动随机生成且不进入 Vite bundle 的 Runtime API token。

### P1：当前主任务唯一出口

通过。`AgentCurrentTaskProjection` 是右侧 Agent 当前主任务、确认边界和主文案
的结构化出口。旧确认卡、历史导出和被动状态不能抢占当前有效任务。

### P2：持久化与恢复

通过。generation job ledger 与 `projectId`、`projectRoot`、`factHash`、`actionId`
绑定。恢复优先级为：当前有效确认、非终态 job、pipeline step、被动状态。
terminal job、cleared plan 和旧事实不能恢复成当前任务。

### P3：统一执行 adapter

通过。Agent 确认卡和已有操作入口共享 reference/video/export 执行合同。dry-run
不会写不存在的产物路径，不宣称真实输出，也不会调用外部 provider。

### P4：本机 packaged App 验收

通过。fresh `/tmp` profile 已完成：两镜头草案、确认故事、选择保存位置、参考
确认与 dry-run、视频确认与 dry-run、导出确认与执行、冷启动恢复。应用图标、
本地 ad-hoc App/DMG 结构和依赖审计也已验证。

## 2026-07-11 最终基线复跑

- `npm run demo:ready:test`：通过。
- `npm run package:smoke`：通过。
- `npm run package:smoke:gui`：最终通过。
- `npm run electron-project-scope:test`：通过。
- `npm run runtime-api-boundary:test`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm audit --audit-level=low`：通过，0 vulnerabilities。
- `git diff --check`：通过。

GUI smoke 第一次运行在 `electron-bridge-smoke-test` 发生一次 30 秒冷启动超时，
stdout/stderr 为空且没有残留 Vibe Director Studio 进程。随后带 Electron 诊断
环境的同一测试通过，第二次完整 `package:smoke:gui` 也通过，包括 packaged GUI。
当前判断为一次性 Electron/macOS 启动抖动，但保留为测试稳定性观察项。

## Dirty Worktree

创建本交接后，`git status --short` 有 117 个条目：92 个 tracked 修改、25 个
untracked 条目。当前任务没有执行 `git add`、commit、revert 或无关文件清理。

按顶层目录归类：

| 范围 | 条目数 | 主要内容 |
| --- | ---: | --- |
| `src/` | 53 | Agent projection、执行合同、恢复状态和现有 UI 逻辑接线 |
| `scripts/` | 45 | 主链路、安全、恢复、adapter、packaged 和发布合同测试 |
| `electron/` | 5 | IPC、project scope、runtime token 和安全策略 |
| `electron-runtime/` | 1 | 本地 Runtime API server bundle |
| `docs/` | 9 | 架构/覆盖/P4 审计、证据包和线程交接 |
| `package.json` / lockfile | 2 | 测试/打包脚本和安全依赖更新 |
| `build/` | 1 | icon、hardened runtime entitlements |
| `codexskills/` | 1 | 未归入本次 Agent-first 基线，不应擅自清理 |

Tracked diff 当前为 92 个文件，约 13,379 行新增、1,930 行删除。体量很大，进入
新的实现阶段前应先做一次只读变更审计，并在用户明确授权后决定如何建立 Git
基线；不能默认把所有 dirty 内容视为同一批改动。

## 关键文件分组

- 当前任务：`src/core/agentCurrentTaskProjection.ts`、`src/ui/director/MinimalAgentPanel.tsx`、`src/App.tsx`。
- 持久化恢复：`src/project/projectAgentGenerationJobLedger.ts`、`src/project/projectAgentStagedPlanDraft.ts`、`src/project/projectAgentTimeline.ts`。
- 执行合同：`src/core/agentVideoProductionContract.ts`、`src/core/agentVideoExecutionAdapter.ts`、`src/core/agentVideoDryRunAdapter.ts`。
- Electron 安全：`electron/securityPolicy.mts`、`electron/projectScope.mts`、`electron/runtimeSessionToken.mts`、`electron/main.mts`。
- 发布与验收：`scripts/package-release-contract-test.mts`、`scripts/package-release-verify.mts`、`build/`。
- 设计输入：`docs/product-design-imagegen-input-20260711/`。

## 不可改变的业务合同

1. 缺参考时，“发送视频”必须先进入补参考确认，不能直接提交视频。
2. “开始补参考”只进入参考确认流程，不能跳到视频提交或导出。
3. 确认故事后必须保留镜头，并进入项目草案/保存位置状态。
4. 选择保存位置不能生成参考、提交视频或导出。
5. 导出必须先出现确认，普通肯定表达不能绕过确认边界。
6. 右侧 Agent 同一时刻只有一个当前主任务，结构化 projection 优先于历史文案。
7. 冷启动不得把 terminal job、旧确认卡、cleared plan 或旧导出恢复成当前任务。
8. dry-run 必须明确 `providerCalled=false` 和零真实输出。
9. 真实图片或视频 provider 调用必须另行取得用户明确授权。

## 仍未验证或明确延期

- 真实图片 provider 的一次受控提交和结果回写。
- 真实视频 provider 的一次受控提交、轮询、失败/取消和结果回写。
- Developer ID、公证、stapling 和 Gatekeeper 公开分发。
- 大型 dirty worktree 的逐文件审计、分批 staging 和提交。
- Product Design / ImageGen 视觉实现；当前仅有设计输入包。

## 推荐下一步

1. 先做一次只读 Git 变更审计，区分 Agent-first 基线、历史 UI 改动、生成文件和
   可能无关的用户改动。
2. 用户明确授权后，再建立可回退的 Git 基线；当前不要自行 stage 或 commit。
3. 若进入 Product Design / ImageGen，直接使用现有 projection JSON、确认边界、
   immutable rules 和真实 packaged App 证据，不重新发明业务状态。
4. 真实 provider 验证保持独立任务，每次只做一次受控调用并提前确认费用边界。

## 入口文档

- `docs/agent-first-p4-packaged-release-audit-20260711.md`
- `docs/product-design-imagegen-input-20260711/README.md`
- `docs/product-design-imagegen-input-20260711/p4-acceptance-matrix.md`
- `docs/agent-first-architecture-audit-20260707.md`
- `docs/agent-first-headless-coverage-audit-20260702.md`
