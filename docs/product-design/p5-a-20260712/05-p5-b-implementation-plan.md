# P5-B Implementation Plan

## Entry Gate

P5-B starts only after the user explicitly confirms **Signal Desk** or approves a bounded revision to it. Until then, the ImageGen boards and this specification are design artifacts only.

## Objective

Implement the approved Signal Desk visual system without changing Agent-first behavior. The work is complete only when the same eight packaged App states remain behaviorally correct, visually coherent, accessible at supported widths, and grounded in the immutable interaction contract.

## Assumptions

- P0-P4 architecture and safety changes already in the dirty worktree are intentional carry-forward work.
- `codexskills/` is unrelated and excluded.
- `AgentCurrentTaskProjection`, confirmation receipts, job ledger, timeline, restore order, adapters, and provider gates are frozen behavior contracts.
- No real image/video provider is needed for implementation or acceptance.
- Visual validation uses the packaged App, not a repeatedly restarted frontend dev server.

## Recommended Sequence

### Slice 0: Freeze baseline and map components

Read the P5-A package, inspect current source ownership, and map each Signal Desk component to the smallest existing component/CSS surface. Record the baseline dirty diff before editing.

**Verify:** no core workflow file is included in the intended visual diff; all eight evidence states have a corresponding implementation target.

### Slice 1: Tokens and stable shell

Update neutral, semantic, spacing, typography, radius, focus, and elevation tokens. Convert the application shell to stable grid tracks for full, compact, tight, and narrow modes. Do not change task selection or routing.

**Verify:** static CSS inspection, TypeScript, minimal UI contracts, no text clipping in stable-width controls.

### Slice 2: Navigation and center object hierarchy

Reduce left navigation to stage navigation and passive status. Give the center one contextual stage header and one inspectable task object. Reuse the current story, reference, video, and export data rather than inventing a parallel model.

**Verify:** story counts, selected shot, reference/video state, and export facts remain identical to the baseline contracts.

### Slice 3: Agent current task and confirmation

Recompose the right rail into current-task header, one confirmation/execution surface, facts/blockers, history, and composer. Drive labels, actions, enabled state, and status from the existing structured projection and active confirmation.

**Verify:** confirmation story, save location, reference, video, query, and export tests; no display-copy regex is introduced; stale cards cannot become primary.

### Slice 4: Media, jobs, receipts, and history

Borrow Edit Bay's media emphasis for the selected shot and Production Ledger's compact job/receipt rows. Keep terminal results collapsed beneath the live task and make dry-run/live truth explicit.

**Verify:** same job ID during query, no dry-run asset claims, export receipt bound to current fact hash, old completion remains history.

### Slice 5: Responsive and accessibility pass

Implement full, compact, tight, narrow, 200% zoom, keyboard, focus, announcement, and reduced-motion behavior. Use the existing Lucide library for icons and tooltips.

**Verify:** no overlap, clipped action label, inaccessible confirmation, hidden blocker, or color-only state across the supported modes.

### Slice 6: One packaged acceptance loop

After slices 1-5 and headless checks pass, build the packaged App once. Reproduce all eight states with fresh `/tmp` profile/projects/runtime paths and capture the same viewport plus compact/tight/narrow evidence. Fix only objective contract, accessibility, overflow, or hierarchy defects. If a fix is necessary, perform one final package build and recapture the affected states.

**Verify:** behavior matches P5-A evidence; the current task has one visual owner; no real provider call occurs.

## Minimum File Boundary

Prefer changes in the existing visual owners:

- `src/styles/tokens.css`
- `src/styles/director.css`
- `src/ui/director/DirectorModeShell.tsx`
- `src/ui/director/MinimalAgentPanel.tsx`
- existing presentational components used by the center work area

Do not edit core projection, adapter, ledger, timeline, persistence, Electron security, or provider code unless a test proves a pre-existing blocker. Stop and report that blocker before crossing the visual boundary.

## Verification Commands

Run targeted checks during implementation:

```bash
npm run agent-current-task-projection:test
npm run new-video-start-contract:test
npm run current-project-ui-closed-loop:test
npm run minimal-agent-p1:test
npm run minimal-ui:test
npm run prototype-ui:test
npm run agent-video-execution-adapter:test
npm run project-agent-generation-job-ledger:test
npm run project-agent-staged-plan-draft:test
npm run project-agent-timeline:test
npx tsc --noEmit --pretty false
git diff --check
```

Run final packaged acceptance:

```bash
npm run package:dir
npm run packaged-launch-contract:test
npm run package:smoke
```

If `package:smoke` repeats packaging by contract, use it as the final release gate rather than running another manual package cycle afterward.

## Regression Checklist

- [ ] New-video input preserves constraints and creates a two-shot draft.
- [ ] Confirm story preserves both shots and advances to save location.
- [ ] Save location changes only project binding.
- [ ] Reference confirmation cannot claim live output in dry-run.
- [ ] Video submission cannot skip missing-reference confirmation.
- [ ] Query preserves the existing external task ID and does not resubmit.
- [ ] Export executes only after its explicit confirmation.
- [ ] Restart restores current confirmation/non-terminal job before passive status.
- [ ] Terminal results and old confirmations remain secondary history.
- [ ] Left, center, and Agent surfaces agree on the projection step.
- [ ] Full, compact, tight, narrow, and 200% zoom modes have no overlap or clipping.
- [ ] Keyboard order, focus return, live announcements, and reduced motion pass.
- [ ] No frontend dev server or real provider was used.
- [ ] No unrelated dirty file or `codexskills/` content was changed.

## Pursuit Goal Prompt

Use this prompt only after explicitly confirming the Signal Desk direction:

```text
你在 /Users/lichenhao/Desktop/new vibe directing 工作。

不要读取旧 Codex 线程全文或大型 session JSONL。先读：
1. docs/thread-handoff-agent-ui-20260626.md
2. docs/agent-first-headless-coverage-audit-20260702.md
3. docs/agent-first-architecture-audit-20260707.md
4. docs/product-design/p5-a-20260712/README.md
5. docs/product-design/p5-a-20260712/01-product-design-audit.md
6. docs/product-design/p5-a-20260712/02-interaction-contract.md
7. docs/product-design/p5-a-20260712/03-direction-comparison.md
8. docs/product-design/p5-a-20260712/04-signal-desk-spec.md
9. docs/product-design/p5-a-20260712/05-p5-b-implementation-plan.md

然后检查 git status --short。保留并理解当前 P0-P4 的 tracked dirty changes；完全排除 codexskills/。不要清理、覆盖或回退不是本轮产生的修改。

用户已明确确认 P5-B 采用 Option 1: Signal Desk。目标是在不改变 Agent-first 业务合同的前提下，完成 Vibe Director Studio 的视觉系统与信息层级重做，并用真实 packaged App 验收。

本轮必须遵守：
- 使用 Product Design image-to-code 的工作流，以 docs/product-design/p5-a-20260712/directions/option-1-signal-desk.png 为主视觉参考。
- 同时参考八张真实 packaged App evidence；ImageGen 图只定义层级和视觉方向，不替代真实文案、状态、ID、媒体事实或确认边界。
- 借用 Option 2 的媒体权重和 Option 3 的紧凑 job/receipt 行，但整体仍是 Signal Desk。
- 不启动前端 dev server，不做截图式反复微调。先完成一个连贯实现，再进行一次 packaged App 视觉验收；只有客观阻断缺陷才允许第二次最终打包。
- 不调用真实图片或视频 provider，不产生外部费用。
- 不 git add、commit、push、revert，不清理无关 dirty 文件。
- 不改 Electron 安全、Runtime API、provider、ledger、timeline、restore、export 或 project binding 逻辑。
- 不做 App、NewVideoStart、MinimalAgentPanel 的泛化重构；只做完成 Signal Desk 所需的最小展示层改造。
- 不改确认语义，不允许“继续 / 没问题 / 确认”绕过明确确认。
- 不根据中文显示文案正则决定当前任务、按钮状态或执行路径。

不可改变的业务合同：
1. AgentCurrentTaskProjection 是当前主任务唯一来源。
2. 左栏、中心区、右侧 Agent 必须展示同一个 projection step，但只有右侧 Agent 拥有主操作。
3. 旧确认卡、terminal job、cleared plan、旧 fact hash 和旧导出只能进入历史，不能抢当前任务。
4. 选择保存位置只改变项目绑定，不生成参考、不提交视频、不导出。
5. dry-run 不调用 provider，不写不存在的真实产物，不宣称参考或视频已生成。
6. query 必须复用已有 job/external task ID，不能重新提交。
7. 导出必须明确确认，确认后才写本地交付包。
8. projectId、projectRoot、projectFactHash、actionId、confirmationId、jobId、receipt 和 timeline 身份链必须保留。

按以下顺序执行，每个阶段通过后再进入下一阶段：

P5-B0 基线与映射
- 只读检查现有 shell、tokens、director CSS、Agent rail 和中心工作区。
- 把 Signal Desk 组件映射到最小现有文件，不先新建抽象。
- 记录本轮允许修改的文件清单和成功标准。

P5-B1 Tokens 与稳定 Shell
- 落地 04-signal-desk-spec.md 的中性/语义色、字体、间距、圆角、焦点和稳定 grid tracks。
- 完成 full、compact、tight、narrow 布局规则。
- 不用渐变、装饰球、嵌套卡片、泛滥 pills、负字距或 viewport 字号缩放。

P5-B2 左栏与中心对象
- 左栏只负责阶段导航和被动状态。
- 中心区只保留一个阶段标题，并按当前任务展示故事、保存目标、参考槽、视频 job/result 或导出 manifest。
- 保留真实 shot count、selection、asset、job 和 export facts。

P5-B3 右侧 Agent
- 固定顺序：current task header -> confirmation/execution -> facts/blockers -> history -> composer。
- 同时只展开一个 confirmation 或 execution surface。
- ConfirmationPanel 必须显示 task、target、effect、boundary、mode、blockers、精确主按钮和 secondary action。
- 使用现有 Lucide icons；不手绘 SVG。

P5-B4 媒体、Job、Receipt、History
- selected shot 保持媒体优先。
- job/receipt/history 用紧凑行，不做后台式大表格。
- running、success、failed、dry-run/live 必须同时用图标、文字和颜色表达。
- terminal history 默认弱化，不覆盖当前主任务。

P5-B5 响应式与无障碍
- 验证 >=1280、1100-1279、900-1099、720-899、<720 的规定模式。
- 验证 200% zoom、键盘顺序、focus visible/return、live announcement、reduced motion。
- 文本和按钮不得重叠、裁切或通过缩小字体勉强塞入。

实现过程中运行：
npm run agent-current-task-projection:test
npm run new-video-start-contract:test
npm run current-project-ui-closed-loop:test
npm run minimal-agent-p1:test
npm run minimal-ui:test
npm run prototype-ui:test
npm run agent-video-execution-adapter:test
npm run project-agent-generation-job-ledger:test
npm run project-agent-staged-plan-draft:test
npm run project-agent-timeline:test
npx tsc --noEmit --pretty false
git diff --check

全部 headless 检查通过后才进行 packaged 验收：
npm run package:dir
npm run packaged-launch-contract:test

使用 fresh /tmp profile/projects/runtime，通过 Computer Use 复现并截图：
1. 新视频输入
2. 确认故事
3. 选择保存位置
4. 参考确认
5. 视频确认
6. 查询视频结果
7. 导出确认
8. 执行完成与历史

另外在 compact、tight、narrow 视口验证至少“确认故事、查询结果、导出确认”三个高风险状态。不要用真实 provider。

最终运行 npm run package:smoke 作为 release gate。若该命令已按合同重复 package，不再额外打包。

成功标准：
- 八个状态的业务结果与 P5-A evidence 一致。
- 当前主任务只有一个视觉 owner，左/中/右状态不冲突。
- Signal Desk 的层级、媒体权重、job/history 细节和语义色按规范落地。
- full/compact/tight/narrow 和 200% zoom 无重叠、裁切或不可达确认。
- dry-run/live、waiting/running/succeeded/failed 不混淆。
- 所有指定测试、TypeScript、diff check、packaged launch 和 package smoke 通过。
- 没有修改 codexskills/ 或无关 dirty 文件。

最终报告：
- 基线判断与修改文件
- 每个 P5-B slice 的完成情况
- 视觉与交互合同如何对应
- 测试与 packaged App 结果
- 八状态及响应式证据路径
- 仍未验证的能力
- 是否达到“本地 packaged release candidate”标准
```
