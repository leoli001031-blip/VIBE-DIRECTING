# Product Design and ImageGen P10 input

Date: 2026-07-16

Status: P10-S PASS. P10 design work has not started.

Entry label:
`P9 PASS; P10-S PASS; Product Design/ImageGen may begin after the P10-S closing commit without changing Agent-first or Director Skill contracts`.

## Purpose

This document is the handoff boundary between the completed non-visual product
closure and the future P10 UI redesign. It defines:

- the authoritative structured state;
- action and confirmation boundaries;
- review, recovery, and exception states;
- evidence available from the packaged App;
- rules that Product Design, ImageGen, and implementation must not change.

It is not a mockup or screenshot audit. The handoff prompt authorizes ImageGen
only for P10 design-direction artifacts after P10-A; it does not authorize
project storyboard, reference, video, or other production-media generation.

P10-S adds a second product input: how saved directing methods are recommended,
inspected, evidenced, and deliberately promoted without becoming execution
authority. It does not authorize a visual implementation.

## Product invariant

Vibe Director Studio is an Agent-first directing workspace. The right-side
Agent owns one current task. Main-area views explain and review project state;
they cannot invent a second current task or bypass a confirmation boundary.

The user should always be able to answer four questions from the current
screen:

1. What does the project currently contain?
2. What is the one current task?
3. What will happen if the user confirms it?
4. What evidence shows that the action completed, failed, or still needs human
   review?

Visual redesign may improve how these answers are presented. It may not change
their source of truth.

## Authoritative projection contract

`AgentCurrentTaskProjection` is the only current-task projection consumed by
the right Agent and dependent status surfaces.

```ts
type AgentCurrentTaskStep =
  | "draft_story"
  | "confirm_story"
  | "choose_save_location"
  | "prepare_references"
  | "submit_video"
  | "export"
  | "idle";

type AgentCurrentTaskEffect =
  | "none"
  | "state_only"
  | "generation_job"
  | "local_export";

interface AgentCurrentTaskProjection {
  source: AgentCurrentTaskSource;
  step: AgentCurrentTaskStep;
  label: string;
  requiresConfirmation: boolean;
  effect: AgentCurrentTaskEffect;
  confirmationKind?: "pipeline_action" | "project_edit";
  confirmationId?: string;
  actionId?: string;
  jobId?: string;
  completion?: {
    step: AgentCurrentTaskStep;
    executionMode?: "dry_run" | "live";
    actionId?: string;
    completedAt?: string;
  };
  blockers: string[];
  facts: Array<{ label: string; value: string }>;
}
```

Designs must consume these structured fields. Display text, button labels, card
copy, colors, and icons are not business-state inputs.

## Main task and confirmation matrix

| Step | Confirmation | Effect after confirmation | Non-negotiable boundary |
| --- | --- | --- | --- |
| `draft_story` | No execution confirmation | `none` | Organize a draft only; do not generate references, submit video, or export. |
| `confirm_story` | Yes | `none` | Preserve the confirmed shots and advance to project/save state. Never clear the story. |
| `choose_save_location` | Yes when a project root is needed | `state_only` | Select or migrate the local project root only. No reference, video, or export side effect. |
| `prepare_references` | Yes | `generation_job` | Prepare/generate reference work only. Never submit video or export. |
| `submit_video` | Yes | `generation_job` | Missing required references must route to reference confirmation first. Never silently submit. |
| `export` | Yes | `local_export` | Delivery Gate and exact confirmation must pass before filesystem writes. |
| `idle` | No | `none` | Show a completed/passive state; never revive an old confirmation. |

Ordinary composer phrases such as `continue`, `okay`, or `confirm` do not bypass
the active confirmation card. The confirmation must bind the current project,
root, fact hash, action, and confirmation identity.

## Review and authority boundaries

Generated media is not automatically a project fact.

| Media state | Meaning | Allowed next action |
| --- | --- | --- |
| `queued` or `running` | Provider/local job is non-terminal | Observe or cancel through the existing job contract. |
| `needs_review` | Media returned but has no human decision | Preview and choose approve, reject, or retry request. |
| `approved`, `humanReviewed=true`, `promotionAuthorized=false` | Preview-only approval | May satisfy exact local Delivery Gate review evidence; cannot promote the asset. |
| `rejected` | Human rejected the result | Keep evidence; do not export it or silently resubmit. |
| `retry_requested` | Human requested another attempt | Requires a separate authorized submit; never automatic retry. |
| `promotionAuthorized=true` | Explicit project-fact authority | Only this separate boundary may promote reusable facts. |

Preview approval, export approval, provider-submit approval, and project-fact
promotion are four separate decisions. A redesign must not combine them into a
single ambiguous primary button.

P6S01 is the concrete baseline:

- human preview-approved;
- `promotionAuthorized=false`;
- locally exported through an exact Delivery Gate receipt;
- still `blocked` as a project fact;
- no automatic approval, promotion, or retry.

## Delivery contract

The delivery surface may present these structured states:

| State | User-facing meaning | Required behavior |
| --- | --- | --- |
| `blocked` | Required media, review, identity, or hash evidence is missing | Explain the blocker; do not write files. |
| `ready_for_confirmation` | Exact reviewed inputs are ready | Route to the one right-Agent export confirmation. |
| `authorized` | Current fact-bound confirmation is present | Execute the existing local export adapter. |
| live `succeeded` | Package was atomically published | Show completed package and review location; no second confirmation. |
| dry-run `validated` | Execution boundary was tested only | Never claim a real package exists. |
| `failed` or `cancelled` | No package was published | Preserve failure evidence and existing final package; do not claim outputs. |
| `already_completed` | Same terminal identity already succeeded | Keep completion visible and suppress duplicate execution. |

The physical write contract is staging, complete worker success, one atomic
publish, then receipt. UI progress must not present staged files as delivered.

## Recovery and exception states

Recovery priority is fixed:

1. current valid confirmation;
2. current non-terminal job;
3. current pipeline step;
4. passive project status.

Design coverage must include:

- fresh project with no story;
- draft planning, draft ready, draft blocked, and story confirmed;
- save-location required and local project ready;
- references missing, generating, needs review, approved, rejected, and failed;
- video queued, running, returned for review, approved, rejected, retry
  requested, failed, and cancelled;
- export blocked, ready for confirmation, running, live completed, dry-run
  validated, failed, cancelled, and already completed;
- stale confirmation filtered after project/fact change;
- corrupt or missing timeline, ledger, staged plan, or delivery receipt;
- Project A evidence while Project B is active;
- cold-start restoration of the exact current task;
- current-fact live completion with no old confirmation revival.

Corrupt, stale, cross-project, or hash-mismatched evidence must fail closed.
The UI may explain the problem but cannot silently repair it into success.

## Evidence package

Authoritative acceptance documents:

- `docs/agent-first-p7-b-review-gate-closure-20260715.md`
- `docs/agent-first-p8-a-delivery-gate-contract-20260715.md`
- `docs/agent-first-p8-b-local-export-acceptance-20260715.md`
- `docs/agent-first-p9-delivery-rc-acceptance-20260716.md`
- `docs/agent-first-p4-packaged-release-audit-20260711.md`
- `docs/agent-first-p10-s-director-skill-system-acceptance-20260716.md`
- `docs/director-skill-system-audit-20260716.md`

Core contract sources:

- `src/core/agentCurrentTaskProjection.ts`
- `src/core/exportDeliveryGate.ts`
- `src/core/exportAction.ts`
- `src/core/agentVideoProductionContract.ts`
- `src/project/projectAgentTimeline.ts`
- `src/project/projectAgentGenerationJobLedger.ts`
- `src/project/projectAgentStagedPlanDraft.ts`

Packaged RC evidence:

- App:
  `/Users/lichenhao/Desktop/new vibe directing/release/mac-arm64/Vibe Director Studio.app`;
- fresh RC project:
  `/tmp/vibe-director-p9-rc-20260716-BgDWNG/projects/p9-fresh-export`;
- local package:
  `/tmp/vibe-director-p9-rc-20260716-BgDWNG/projects/p9-fresh-export/exports/current-project`;
- portability copy:
  `/tmp/vibe-director-p9-portability-20260716-xb2j9J/package/current-project`.

The RC package contains 16 receipt-bound outputs. The final MP4 SHA-256 is:

`bd605aad4071cc00940d54639576d54bed77473dc7e1e253e4c29aafd0cee4fe`

No screenshot or ImageGen asset was created in P9. P10 should begin by
capturing the packaged App's actual state set before generating design
alternatives.

## Director Skills product input

### Object and authority model

The design must keep four content objects visibly understandable without
merging their authority:

| Object | Product meaning | What it cannot mean |
| --- | --- | --- |
| Skill | Reusable directing decision method | Provider command, project fact, or proof of success |
| Recipe | Compiler/provider-compatible prompt and parameter guidance | Submit authorization or auto-approval |
| Case | One project use with QA and human outcome | Automatic global trust |
| Knowledge Pack | Routed knowledge, rules, and examples | Skill identity or promotion evidence by itself |

Canonical JSON, version, and content hash are authoritative. A Markdown Skill
card is a readable projection only.

### Scope and maturity states

| Scope / maturity | Meaning | Required presentation boundary |
| --- | --- | --- |
| `project_local/candidate` | Learned in this project; may be recommended here | Never imply it is available globally |
| `user_global/verified` | Explicitly promoted with sufficient accepted evidence | Show evidence scope and remaining limits |
| `user_global/trusted` | Repeatedly evidenced and explicitly promoted | Still subordinate to project facts and hard gates |
| `deprecated` | Retained for history but not routable | Do not silently delete or recommend it |
| `external_imported/unverified` | Package is present but not accepted | Keep disabled until checks and confirmation pass |
| disabled | User or policy excluded it from routing | Preserve version/history and explain exclusion |
| pinned | A specific version is preferred | Make the selected version and rollback target clear |

Maturity is not a visual popularity badge. It is an evidence and authority
state. A trusted Skill can still be excluded for task mismatch, provider
incompatibility, missing dependencies, version conflict, project constraints,
or system hard locks.

### Recommendation explanation

Each recommendation surface should be able to expose structured evidence for:

- primary versus auxiliary selection;
- Skill name, semantic category, scope, maturity, version, and hash;
- concrete match reasons;
- counterexample or avoid conditions;
- affected task purpose and shot;
- selected Recipe and compatible provider slots;
- Knowledge Pack dependencies and hashes;
- context-budget truncation;
- conflicts, winner, and resolution rule;
- explicit not-selected reason.

The compact default may summarize this information, but diagnostics must not
derive it from localized display copy. “Recommended” must never look like
“will execute” or “provider authorized”.

### Evidence and history

A Skill detail/history design must distinguish:

- Invocation Receipt status: recommended, selected, injected, validated,
  rejected, or blocked;
- execution mode: `dry_run` versus `live`;
- QA pass, warning, blocker, and exact binding mismatch;
- Case outcome: accepted, modified, rejected, retry requested, failed, or
  needs review;
- current project/fact evidence versus stale or rejected evidence;
- anonymous cross-project evidence count versus local project identity;
- version install, promotion, pin, disable, deprecate, and rollback receipts.

Corrupt, old-fact, cross-project, or identity-mismatched receipts are not
history that can be reused as current evidence. The design may explain why
they were rejected but cannot turn them into success.

### Confirmation boundaries

These operations require separate, explicit confirmation states:

| Operation | Required boundary |
| --- | --- |
| Save a new method | Save one `project_local/candidate` into the current project only |
| Promote to verified/trusted | Confirm target Skill, source version/hash, evidence summary, target maturity, and new version |
| Import an external package | Show schema/hash/dependency/conflict/fixture checks and target version before atomic install |
| Disable or deprecate | Explain routing impact while preserving history |
| Roll back | Show current and target versions; do not erase later versions |
| Pin or unpin | Show which version the Router will prefer |

Saving a candidate, accepting a Case, promoting a Skill, submitting a provider
task, reviewing media, exporting, and promoting a project fact are independent
decisions. No combined primary button may cross these boundaries.

### Packaged P10-S evidence

The packaged acceptance fixture is rooted at
`/tmp/vibe-director-p10-s-packaged-4WHkWn`. It proved:

- one `project_local/candidate` saved through the real Agent confirmation;
- exactly one semantic Skill after cold start, with no duplicate save action;
- no revived old confirmation card;
- real dry-run injection into Planner, Prompt Compiler, and QA;
- a current fact-bound `validated/pass` Invocation Receipt;
- isolated verified `1.1.0`, trusted `1.2.0`, and rollback to `1.1.0`;
- provider calls `0` and generated media `0`.

The candidate is `director.skill.storyboard_narrative@1.0.0`, content hash
`vdsh_77298397`; the Invocation Receipt is `dsir_13cdf904` and is explicitly
`dry_run`.

### Immutable Skill rules

Product Design and implementation must preserve:

- Skill identity is semantic and shot-independent; shot outcomes are Cases.
- Candidate Skills stay project-local until a separately confirmed promotion.
- Promotion needs accepted, QA-passed evidence from at least two projects and
  no unresolved rejection.
- Rejected, retry-requested, failed, needs-review, or unreviewed Cases cannot
  support promotion.
- Every use binds project, fact, action, Skill/Recipe/Knowledge versions and
  hashes in an Invocation Receipt.
- Planner, Prompt Compiler, and QA use the same compatible binding.
- Priority is system hard boundary, current project fact, trusted user Skill,
  then candidate recommendation.
- Skill cannot grant provider authorization, automatic retry/approval, media
  promotion, project-fact promotion, export authority, or Electron access.
- External packages contain no secrets, absolute paths, project media, or
  provider authorization, and remain disabled until validation and explicit
  import confirmation pass.
- Version changes are append-only; pin, disable, deprecate, and rollback retain
  history.

## What P10 may redesign

Once P10 starts, Product Design and ImageGen may explore:

- information hierarchy and workspace density;
- navigation and view organization;
- typography, color, spacing, iconography, and visual language;
- current-task prominence and confirmation-card composition;
- project fact, blocker, job, review, and receipt presentation;
- timeline readability and progressive disclosure;
- empty, loading, error, review, completed, and recovery-state layouts;
- responsive behavior and accessibility;
- coherent visual direction for generated media placeholders and project
  evidence.

The redesign should feel like a focused directing workspace, not a marketing
landing page. It should optimize repeated project work, inspection, comparison,
and explicit decisions.

## What P10 may not change

P10 must not:

- create multiple competing current tasks;
- infer business state from localized display copy;
- put a direct generation, submit, promotion, or export bypass in the main
  workspace;
- merge preview approval, export authorization, provider submit, and promotion;
- imply dry-run outputs are real;
- claim staged, failed, cancelled, or `needs_review` media is approved;
- auto-retry provider work;
- auto-promote media into project facts;
- discard exact project/fact/action/confirmation/receipt identity;
- let old confirmation cards, old projects, or passive status override the
  current projection;
- change provider, filesystem, security, or package contracts as a visual
  convenience;
- delete or mutate the P9 acceptance evidence.

ImageGen outputs in P10 are design references only. They cannot be written into
the active project's media, review receipts, visual memory, or project facts.

## Recommended P10 sequence

### P10-A: packaged UX evidence audit

- Run the packaged App only; do not use a frontend dev server.
- Capture desktop and constrained-width evidence for every main task,
  confirmation, review, completion, and exception state.
- Build one state inventory mapped to projection JSON and exact receipts.
- Produce a prioritized UX audit without changing code.

Exit: every proposed visual problem is tied to a real state and reproducible
packaged path.

### P10-B: Product Design and ImageGen directions

- Create a concise product-design brief from the state inventory.
- Generate two or three materially different workspace directions.
- Keep actual product media and state evidence legible; do not use fake
  marketing imagery as the primary product surface.
- Compare directions against Agent-first clarity, density, accessibility, and
  confirmation safety.

Exit: one direction is explicitly selected before implementation.

### P10-C: interaction specification

- Specify workspace structure, navigation, right-Agent rail, status surfaces,
  confirmation cards, review actions, job progress, receipts, and exceptions.
- Map every interactive element to a structured command or projection field.
- Define responsive and keyboard/focus behavior.

Exit: no control has an undefined side effect or ambiguous authority boundary.

### P10-D: faithful implementation

- Implement the selected direction incrementally against the existing
  contracts.
- Keep logic changes separate from visual changes; any discovered logic defect
  returns to a focused non-visual fix with tests.
- Use the established icon library and existing framework.
- Do not rewrite the Agent architecture or large components merely to restyle
  them.

Exit: headless contract suites remain green and all selected screens match the
approved direction.

### P10-E: packaged visual and behavioral acceptance

- Rebuild the packaged App.
- Re-run the complete Agent-first path and cold-start recovery.
- Verify no overlap, clipping, layout shift, inaccessible focus, or ambiguous
  action boundary across target viewports.
- Confirm generated assets are real, legible, and correctly attributed.

Exit: visual acceptance and P9 behavioral acceptance both pass in the same
packaged build.

## P10 pursuit-goal prompt

Use the following prompt in the next execution task. It authorizes audit and
design exploration only; it does not authorize provider media generation,
project-fact promotion, publishing, or broad architecture changes.

```text
你在 /Users/lichenhao/Desktop/new vibe directing 工作。

不要读取旧 Codex 线程全文或大型 session JSONL。先读：
1. docs/product-design-imagegen-p10-input-20260716.md
2. docs/agent-first-p9-delivery-rc-acceptance-20260716.md
3. docs/agent-first-p8-a-delivery-gate-contract-20260715.md
4. docs/agent-first-p7-b-review-gate-closure-20260715.md
然后检查 git status --short 和最近 3 条 git log。

当前基线：
- P9 已 PASS，packaged App 的终态、可移植交付、原子发布、恢复矩阵和本地 RC 已通过。
- P6S01 仍是 preview-approved only，promotionAuthorized=false。
- AgentCurrentTaskProjection 是右侧 Agent 和关联状态面的唯一当前任务来源。
- 当前阶段允许进入 P10 Product Design/ImageGen，但先做证据审计，不直接改 UI。

目标：
按 P10-A → P10-B → P10-C → P10-D → P10-E 顺序，基于真实 packaged App 状态完成 Vibe Director Studio 的 Product Design/ImageGen UI 重做，同时完整保留 P9 的 Agent-first、安全、确认、恢复和交付合同。

阶段边界：

P10-A：packaged UX 证据审计
- 不启动前端 dev server。
- 使用 packaged App 和 fresh /tmp profile 观察真实状态。
- 覆盖草案、确认故事、保存位置、补参考、发送视频、媒体复核、导出确认、导出完成、失败、取消、阻断、冷启动恢复。
- 每个画面必须绑定 AgentCurrentTaskProjection JSON、项目 fact hash、action/confirmation/job/receipt 身份。
- 输出状态清单、截图证据和按严重度排序的 UX 审计。
- 本阶段只读，不改 UI。

P10-B：Product Design / ImageGen 方向探索
- 基于 P10-A 的真实证据建立设计 brief。
- 用 Product Design 与 ImageGen 产出 2 到 3 个差异明确的工作台方向。
- 本阶段明确允许 ImageGen 生成 UI 方向图和设计参考图；这些图不是项目故事板、参考素材、视频产物或项目事实。
- 方向必须服务于导演工作流、信息扫描、比较、复核和重复操作，不做营销落地页。
- 不用虚假生成结果替代真实项目证据，不隐藏 blocker、needs_review、dry_run 或确认边界。
- 比较可读性、任务唯一性、操作效率、可访问性和窄屏适应性。
- 用户明确选定方向前，不进入实现。

P10-C：交互与状态规格
- 定义工作台结构、导航、右侧 Agent、确认卡、项目事实、job、timeline、review、delivery receipt 和异常状态。
- 每个按钮、菜单和输入都映射到结构化 command/effect，不允许从显示文案推断业务状态。
- 明确桌面与窄屏布局、键盘、焦点、加载、空状态、失败和恢复行为。
- 输出可验收的交互规格和屏幕状态矩阵。

P10-D：选定方向的最小实现
- 只实现用户选定的方向。
- 复用现有框架、组件模式和图标库。
- 视觉改动与逻辑缺陷修复分开；若发现逻辑 bug，先补最小 contract test，再修复。
- 不借 UI 重做拆分 App、MinimalAgentPanel 或 Agent 架构，不做泛化重构。
- 不改变 provider、权限、Delivery Gate、原子发布、恢复优先级和 Electron 安全边界。

P10-E：packaged 验收
- 重建 packaged App，不依赖 dev server。
- 用真实 packaged 主链路复测任务唯一性、确认边界、review、export、terminal completion 和 cold-start recovery。
- 使用桌面和窄屏截图检查重叠、裁切、布局位移、文本溢出、焦点和可访问性。
- 运行 P9 的核心 headless、TypeScript、package smoke、npm audit 和 git diff --check。
- 视觉与行为必须在同一个 packaged build 中通过。

不可改变规则：
- 右侧 Agent 同时只有一个当前主任务。
- 普通“继续 / 没问题 / 确认”不能绕过确认卡。
- 选择保存位置只能改变项目位置。
- 缺参考时发送视频必须先进入补参考确认。
- 参考、视频、导出都使用各自明确确认边界。
- needs_review 不等于 approved；preview approval 不等于 export、provider submit 或 promotion。
- promotionAuthorized=false 不得被 UI 自动改写。
- dry_run 不得显示成真实产物。
- staging、失败或取消结果不得显示成已交付。
- 旧项目、旧 fact hash、旧确认、terminal job 和损坏 sidecar 不得抢当前任务。
- live export completion 后不得恢复旧确认或再次提供导出动作。

默认禁止：
- 新的项目内容 provider submit、query、retry，以及故事板、参考图、视频等生产媒体生成；P10-B 明确允许的 UI 方向图除外；
- 自动重试、自动批准、项目事实晋级；
- 删除、发布、push；
- 无关 dirty 文件清理或用户改动 revert。

每阶段必须报告：
- 真实证据和复现路径；
- 发现的问题与根因；
- 产物和修改的最小文件；
- 测试结果；
- 未验证能力和残余风险；
- 是否允许进入下一阶段。

最终成功标准：
同一个 packaged build 中，视觉方向通过用户确认，核心 Agent-first 主链路和冷启动恢复保持 P9 合同；当前任务唯一，确认和 review 权限清晰，dry-run/live 不混淆，导出终态不复活旧动作，并且没有重叠、裁切、文本溢出或不可操作状态。

P10 全部通过后再统一提交；未通过不得用提交掩盖阻断，不 push。
```

## Entry decision

P10 entry is allowed. The first executable stage is P10-A evidence audit, not
visual implementation. Product Design and ImageGen should be invoked only after
the packaged state inventory is captured and tied to structured evidence.
