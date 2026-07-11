# Vibe Director / Codex-导演台 轻量交接

更新时间：2026-06-26
工作目录：`/Users/lichenhao/Desktop/new vibe directing`
旧长线程 ID：`019eefa3-16d6-7ac0-9072-69dca6d861c5`
旧长线程会话文件：
`/Users/lichenhao/.codex/sessions/2026/06/22/rollout-2026-06-22T22-01-43-019eefa3-16d6-7ac0-9072-69dca6d861c5.jsonl`

## 先说结论

旧线程就是 `Codex-导演台` 那条超长线程。它现在不适合继续干活：

- 线程超过 300 轮，会话 JSONL 约 1.4G。
- Codex Desktop 打开它时容易恢复 snapshot、加载大量桌面状态和截图。
- Computer Use 在旧线程里反复出现 `approval denied via MCP elicitation`，但这不等于 Vibe Director App 有 bug。

新线程不要读取旧线程全文，也不要读取上面那个 1.4G JSONL。

这份文件就是给新线程用的轻量入口。

## 新线程启动原则

新线程只需要先读：

1. 本文件：`docs/thread-handoff-agent-ui-20260626.md`
2. 当前 `git status --short`
3. 当前 slice 直接相关源码和测试

不要整篇读取这些大文件：

- `/Users/lichenhao/.codex/sessions/2026/06/22/rollout-2026-06-22T22-01-43-019eefa3-16d6-7ac0-9072-69dca6d861c5.jsonl`
- `docs/thread-handoff-agent-ui-20260622.md`

如果确实需要旧 handoff 里的证据，只用 `rg` 定向搜关键词，不要整篇 `cat`。

## 当前项目方向

把 Vibe Director Studio 收口成真正 Agent-first 的桌面 App。

用户主要通过右侧 Agent 完成：

- 新视频
- 故事
- 参考
- 视频
- 交付

当前重点不是视觉翻新，而是稳定这些底层体验：

- Agent 行为逻辑
- 右侧消息流优先级
- 确认卡边界
- 项目状态 / runtime / timeline 对齐
- 保存、补参考、发送视频、导出主链路
- 素材进入收件箱后的分类与确认逻辑
- 测试和真实 packaged App 验证路径

## 暂缓视觉 UI

暂时不要做大规模视觉 UI redesign。

未来可能用 Product Design / ImageGen 重新决定的内容先放后面：

- 右侧 Agent 面板视觉布局
- 卡片样式
- 颜色、字体、阴影、圆角
- 信息密度重排
- Skills 可视化外观
- 素材库视觉呈现

现在只修未来换皮后仍然有价值的逻辑骨架。

Product Design 插件后续使用顺序：

1. Product Design audit：截图审计稳定主流程
2. ideate + ImageGen：生成 3 个 UI 视觉方向
3. 用户选择方向
4. image-to-code：把选中的参考图落成真实 UI

## 旧线程里已经确认过的重要修复

### 1. `发送视频` 缺参考时不应进入镜头修改

历史断点：

- 保存 2 镜头故事后，参考缺 2 张。
- 用户输入 `发送视频`。
- 正确行为：先进入当前故事的 `确认生成参考`。
- 错误行为：右侧 Agent 误继承选中镜头 1-1，显示 `确认修改`。

已修方向：

- `发送视频` / `发视频` 分类为视频提交意图。
- 当前故事缺参考时，发送视频前先桥接到项目级参考补齐。
- 右侧 Agent 发送前预览应显示：
  - `当前故事`
  - `先补参考`
  - `参考不完整`

最近一轮又补过一刀：输入阶段也不应显示 `正在看 镜头 1-1`，而应显示当前故事级的补参考预览。

相关文件：

- `src/ui/director/MinimalAgentPanel.tsx`
- `src/core/directorAgentAction.ts`
- `src/core/directorAgentPermissionIntent.ts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `scripts/director-agent-action-envelope-test.mts`

### 2. `开始补参考` 不能被剥成空字符串

历史断点：

- `开始补参考` 被权限短语清理误删。
- Action 分类回落成 `确认修改`。

已修方向：

- `开始补参考`、`开始生成参考`、`开始做参考` 保留为 reference action。
- 补参考仍需要确认，不能直接生成。

### 3. 确认故事后顶部项目状态不能退回未连接

历史断点：

- 确认故事后，中间和右侧进入选择保存位置。
- 顶部项目控制却仍显示 `未连接项目`。

已修方向：

- 已有 story flow 但未选保存位置时，顶部使用 temporary draft 状态。
- 显示为草案/草案未保存，而不是未连接项目。

## 最近验证过的真实 UI 路径

主路径：

1. 启动 packaged App，使用干净 `/tmp` profile / project root / runtime workdir。
2. 输入：

```text
我要拍一个 8 秒短片：雨夜便利店门口，女孩把纸飞机递给机器人保安，纸飞机在灯箱里亮起来。整理成 2 个镜头，不生成参考图，不提交视频。
```

3. 发送，等待草案。
4. 点击 `确认这版故事`。
5. 点击 `选择保存位置`，选择临时项目目录。
6. 保存后确认左侧状态：
   - 故事：`2 镜头`
   - 参考：`缺 2 张`
   - 视频：`未生成`
7. 输入 `发送视频`。
8. 发送前右侧应预览：
   - 标题：`当前故事`
   - hint：发送视频前先补齐当前故事参考
   - chips：`范围 当前故事`、`参考 参考不完整`、`下一步 先补参考`
   - footer：`识别为：准备视频（先补参考）`
9. 点击发送后右侧应进入：
   - `确认生成参考`
   - 当前故事范围
   - 图片服务未连接时按钮 disabled，help 为 `先连接图片服务`
   - 不出现 `确认修改`
   - 不提交视频

## 建议启动 packaged App 的命令模板

不要复用旧临时目录。每轮换一个后缀。

```bash
mkdir -p /tmp/vibe-director-loop-projects-YYYYMMDD-slice-r1 /tmp/vibe-director-loop-runtime-YYYYMMDD-slice-r1

env HOME=/tmp/vibe-director-loop-profile-YYYYMMDD-slice-r1 \
  USERPROFILE=/tmp/vibe-director-loop-profile-YYYYMMDD-slice-r1 \
  VIBE_DIRECTOR_PROJECTS_ROOT=/tmp/vibe-director-loop-projects-YYYYMMDD-slice-r1 \
  VIBE_DIRECTOR_RUNTIME_API_PORT=0 \
  VIBE_DIRECTOR_RUNTIME_WORKDIR=/tmp/vibe-director-loop-runtime-YYYYMMDD-slice-r1 \
  VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH=/tmp/vibe-director-loop-runtime-YYYYMMDD-slice-r1/current-project.local.json \
  /Users/lichenhao/Desktop/new\ vibe\ directing/release/mac-arm64/Vibe\ Director\ Studio.app/Contents/MacOS/Vibe\ Director\ Studio \
  --user-data-dir=/tmp/vibe-director-loop-profile-YYYYMMDD-slice-r1
```

## 新线程第一步必须检查 Computer Use

不要直接打开旧线程，也不要假设 Computer Use 可用。

新线程先做只读控制检查：

1. `list_apps`
2. `get_app_state Calculator`
3. 如果 Calculator 成功，再 `get_app_state Vibe Director Studio`

如果 `list_apps` 成功但 `Calculator` 失败，并出现：

```text
Computer Use approval denied via MCP elicitation
```

说明是当前线程 Computer Use 授权状态问题，不是 Vibe Director App bug。
不要在这个线程继续做真实 UI 验证。

## 当前 Git 状态提醒

当前 worktree 很脏，不要清理无关文件，不要 `git add -A`，不要 revert 用户或旧线程留下的改动。

当前分支和提交：

```text
branch: codex/demo-project-save-flow
HEAD: 754ffaf
```

新线程应该先跑：

```bash
git status --short
```

然后只碰本轮 slice 相关文件。

最近看到的 dirty 范围很大，包括：

- `src/ui/director/MinimalAgentPanel.tsx`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `src/App.tsx`
- 多个 runtime / project / agent-core 文件
- `docs/thread-handoff-agent-ui-20260622.md`
- `codexskills/`

不要把这些都当成本轮要提交的内容。

## 当前优先任务

继续做 P0：右侧 Agent 消息流优先级收口。

目标：

- 当前输入预览、等待确认、执行结果、被动项目状态不能互相打架。
- 同一时刻右栏只突出一个主任务。
- 不做视觉重排，只修消息选择、隐藏、优先级、文案边界。

建议下一条真实 UI 断点：

- 走 `新视频 -> 确认故事 -> 保存 -> 输入下一步指令 -> 等待确认 / 修改 / 补参考`
- 观察右侧是否有过期状态卡抢焦点。
- 观察当前输入预览和旧项目状态是否矛盾。
- 观察选中镜头是否误抢当前故事任务。

## 每轮验证下限

源码验证：

```bash
npm run minimal-agent-p1:test
npm run minimal-ui:test
npx tsc --noEmit --pretty false
git diff --check
```

如果源码验证通过，再打包：

```bash
npm run package:dir
npm run packaged-launch-contract:test
```

然后重新打开 packaged App，用 Computer Use 复测同一路径。

## 新线程可直接复制的启动提示词

```text
你在 /Users/lichenhao/Desktop/new vibe directing 工作。

不要读取旧 Codex 线程全文，不要读取这个大文件：
/Users/lichenhao/.codex/sessions/2026/06/22/rollout-2026-06-22T22-01-43-019eefa3-16d6-7ac0-9072-69dca6d861c5.jsonl

也不要整篇读取旧 handoff：
docs/thread-handoff-agent-ui-20260622.md

先读：
docs/thread-handoff-agent-ui-20260626.md
然后检查 git status --short。

继续 Vibe Director Studio 的 Agent-first 收口工作。

当前策略：
- 先修不会被未来 Product Design / ImageGen UI 重做浪费的底层逻辑。
- 不先做视觉 UI 重做。
- 每轮只做一个 slice。
- 必须用 packaged App + Computer Use 做真实 UI 验证。

第一步只做 Computer Use 只读控制检查：
1. list_apps
2. get_app_state Calculator
3. 如果 Calculator 成功，再读取 Vibe Director Studio

如果普通 App 读屏失败并出现 approval denied via MCP elicitation，不要继续撞，说明该线程授权状态异常。

如果 Computer Use 正常，继续 P0：右侧 Agent 消息流优先级收口。
```

## 旧线程处理建议

旧线程建议归档，不删除。

如果 Codex Desktop 仍然因为自动恢复旧线程而卡顿，再考虑把旧 JSONL 备份移走。不要先删。
