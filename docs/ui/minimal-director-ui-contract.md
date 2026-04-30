# Minimal Director UI Contract

日期：2026-04-30

Phase 9.4 的 Director UI 目标是把默认主界面重新收窄到“导演正在做什么”和“当前素材/镜头能不能继续”，把工程事实和门禁细节移到 Diagnostics。

## 主界面必须保留

- Asset Library：素材选择、素材状态、当前资产。
- Story / section tabs：故事段落、镜头列表、当前选择。
- Preview：粗剪/预览状态和 selected shot 的轻量反馈。
- Selected / Scope：自然语言变更的作用对象和影响范围。
- Diagnostics 入口：用户需要时能进入工程事实层。

## 主界面应避免

- 大量 provider / manifest / schema / queue / task envelope / hard lock / forbiddenActions 文案。
- 默认展示 contact sheet 图库。
- 把工程状态卡片堆进 Director minimal path。
- 在 Asset Library 或 Preview 里混入 provider unlock、credential、live submit 或 bypass 控件。

## Diagnostics 应承接

- Provider policy、adapter contract、generation harness、filesystem watcher、checkpoint resume、QA harness。
- Manifest matcher、source index、schema/runtime state、queue/task runs、task envelope preview。
- contactSheets 这类诊断或审计总览。

## 合同测试

`npm run minimal-ui:test` 静态读取源码和文档，检查：

- `package.json` 暴露 `minimal-ui:test`。
- `DirectorMode`、`DiagnosticsMode` 和 Diagnostics 入口存在。
- 主界面命名或文案覆盖 Asset Library、Preview、Selected / Scope、Story / section tabs。
- 工程词在 `DirectorMode` 主体附近保持低密度，并主要出现在 Diagnostics。
- `contactSheets` 不常驻 Director minimal path。
- Phase 9.4 文档和本合同文档存在。
