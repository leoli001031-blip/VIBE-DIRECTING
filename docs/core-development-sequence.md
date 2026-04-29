# Core Development Sequence

日期：2026-04-29

这份文件用于约束后续连续开发顺序，避免先做 UI 或真实模型调用，结果把临时逻辑固化成生产链路。

## Phase 1：合同层

目标：任何任务在进入执行前，都必须有可校验合同。

优先项：

- JSON Schemas
- ProjectSourceIndex
- ReferenceAuthority
- PreflightGate
- TaskEnvelope
- SubagentTaskEnvelope
- TaskRun
- ManifestMatcher
- WorkflowGuard

完成标准：

- `npm run build` 通过。
- 每个正式任务都能回答：事实来自哪里、引用是否允许、provider 是否允许、预期输出是什么、失败后停在哪里。

## Phase 2：项目导入和本地项目格式

目标：把现有 runtime audit import 升级成项目导入器。

优先项：

- `project.vibe` 文件夹结构。
- 从 runtime test 生成 ProjectSourceIndex。
- 从 existing outputs 生成 TaskRun 和 ManifestMatcher 状态。
- 区分 draft / formal 素材。

## Phase 3：UI 连接真实核心状态

目标：前端展示来自核心模块的状态，而不是只展示导入 JSON。

优先项：

- Director mode 默认简洁。
- Inspector 显示 task envelope / subagent envelope / preflight。
- Diagnostics 显示 manifest matcher / queue / provider policy。
- UI 文案把 blocker 翻译成普通用户能懂的话。

## Phase 4：Image2 Adapter

目标：只接图片链路，不碰视频真实提交。

优先项：

- Image2 provider capability。
- Image2 prompt compiler。
- asset reference generation。
- start frame generation。
- end frame edit from start。
- QA packet generator。

硬规则：

- 不允许 image-to-image fallback 成 text-to-image。
- 不允许 temp / rejected 作为 future reference。

## Phase 5：Preview / Export

目标：先做 rough preview 和素材导出。

优先项：

- image hold preview。
- blocked placeholder。
- formal preview gate。
- rough cut export。
- asset package export。

## Phase 6：Audio 和 Video Provider

目标：在核心链路稳定后再启用。

后置项：

- TTS / Voice Sources。
- BGM / ambience。
- Seedance / Jimeng 从 parked 改为 user-enabled。
- video queue。
- video QA。

