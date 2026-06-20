# AI大小姐们想让我告白 — 6-Shot OP Plan

这是给 Vibe Director 展示用的 6 镜头 OP 小项目计划包。

本包暂时只包含规划、参考资产索引和 Seedance prompt，不提交视频、不烧点数。

## 目标

用已有素材包 `/Users/lichenhao/Desktop/AI大小姐们想让我告白` 做一个 5-6 镜头群像 OP，展示：

- Vibe Director 能读已有素材宇宙，而不是临时乱生参考图。
- 每个镜头都有明确叙事功能、角色职责和参考资产职责。
- Seedance prompt 是可复核、可替换、可逐段提交的。

## 输出结构

- `01-plan/op-6shot-plan.md`：6 镜头 OP 分镜计划
- `01-plan/asset-map.md`：角色/场景参考资产映射
- `02-prompts/shot_*.md`：每段 Seedance prompt
- `03-assets/asset-index.json`：机器可读素材索引
- `04-review/review-checklist.md`：提交前复核清单

## 生成原则

- 统一 `16:9`，Seedance `720p`。
- 每个 Seedance 片段单独提交，串行执行，不并发。
- 角色 identity sheet 只用于身份锁定，不作为构图参考。
- 场景图只锁空间、光线和气氛，不负责角色身份。
- 每段只承担 1 个主要动作或 1 个 OP 表意节点。
- 全员镜头只放在最后 1-2 段，避免多角色混脸。
