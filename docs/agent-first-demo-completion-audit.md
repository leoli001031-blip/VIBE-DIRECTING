# Agent-first Demo Completion Audit

Updated: 2026-06-20

This audit maps the current demo closeout to the three-stage goal:

```text
Left: project navigation.
Middle: visible project results.
Right: Agent collaboration.
```

The current target is a demo-ready Agent-first video director desk, not a fully
autonomous long-form production Agent. TTS, music rhythm analysis, multimodal
image QA, long-drama project management, and multi-user collaboration remain
follow-up lanes.

## Product Contract

Vibe Director is presented as an AI video director Agent. The creator gives an
idea, drops files, points at a shot or asset, and asks for changes. The Agent
explains the plan, proposes actions, manages references, compiles video
requests, submits Seedance serially, and helps export a reviewable package.

The UI contract is:

- left rail: projects, shots, assets, and navigation only;
- center workbench: story flow, references, video preview, and export results;
- right rail: the main Agent message flow, task cards, confirmation, and next
  step guidance.

## Agent Kernel v1 Completion Matrix

| Goal phase | Current demo status | What the demo can claim | What it must not claim yet |
| --- | --- | --- | --- |
| Phase 1: Agent Kernel and message flow | demo-ready | The right rail behaves as the main Agent conversation: user message, Agent understanding, selected target, proposed action, confirmation, running/result cards, errors, and next suggestions stay visible. | It is not a fully autonomous background operator that can run every long project without user confirmation. |
| Phase 2: project intelligence and material matching | demo-ready for short projects | The Agent can scan project folders, classify common files, explain material gaps, suggest bindings, and keep small detail assets folded into parent subject or shot guidance. | It is not yet a complete long-drama asset database with chapter-level continuity memory. |
| Phase 3: Skills and real demo loop | demo-ready with bounded provider evidence | Skills are visible as current/recommended/user knowledge cards, selected-context edits work, Seedance requests stay serial, returned videos can surface in preview, and showcase export evidence is packaged. | Provider queues remain external; live Seedance VIP 720p submission should be shown as a short operator step, not as guaranteed instant automation. |

Demo claim in one sentence:

> Vibe Director is now a short-project AI video director desk where the creator
> talks to the Agent, the Agent explains and confirms each costly step, and the
> project surfaces references, video requests, returned clips, Skills, and export
> evidence without asking the creator to understand the underlying workflow.

## Requirement Checklist

Status language:

- `demo-ready`: covered by code, tests, and at least one live UI pass.
- `bounded`: covered for the current short-project demo, but intentionally not
  claimed as a full autonomous long-project Agent.
- `future lane`: explicitly outside this demo closeout.

| Requirement | Current status | Evidence |
| --- | --- | --- |
| User can treat the right rail as the main Agent conversation surface. | demo-ready | `MinimalAgentPanel.tsx`, `agentPanelProjection.ts`, live `agent-kernel-v1-final-rehearsal` pass |
| Agent turn records understanding, project status, selected context, proposed action, confirmation boundary, result, next step, related shots/assets/Skills, and errors. | demo-ready | `src/agent-core/types.ts`, `src/agent-core/runAgentTurn.ts`, `vibe-agent-core:test` |
| Each normal Agent turn exposes the visible message-flow chain: user input, understanding, inspect project, classify assets, plan next action, execution boundary, Agent reply, and confirmation card. | demo-ready | `scripts/vibe-agent-core-test.mts`, `vibe-agent-core:test`, `demo:goal-audit:test` |
| Action lifecycle covers proposed, waiting for confirmation, running, succeeded, failed, cancelled, and needs-user-input states. | demo-ready | `src/agent-core/types.ts`, `src/agent-core/toolEvents.ts`, `minimal-agent-p1:test` |
| Supported Agent actions cover inspect, classify assets, plan story, revise shot, generate references, compile video request, submit/query video, export, and save Skill. | demo-ready | `src/agent-core/actionRegistry.ts`, `demo:goal-audit:test` |
| Sending clears the composer and keeps a visible send button. | demo-ready | live `agent-kernel-v1-final-rehearsal` pass, `minimal-agent-p1:test` |
| Plan/reference/video permissions are visible and provider-cost actions require confirmation. | demo-ready | `permissionGate.ts`, `MinimalAgentPanel.tsx`, `current-project-ui-closed-loop:test` |
| Agent can scan a project folder and classify scripts, prompts, receipts, images, audio, videos, exports, and unknown material. | demo-ready | `projectFolderScannerNode.ts`, `project-folder-scanner:test`, `runtime-api-workbench-projection:test` |
| Agent can suggest asset binding and fold detail-only references into parent subject or shot notes. | demo-ready | `assetReconciliation.ts`, `reference-asset-strategy:test`, `current-project-ui-closed-loop:test` |
| Short-project hierarchy supports project to shot to asset to Skill, while chapter/sequence remains a future long-project extension. | bounded | `vibe-agent-core:test`, `projectAgentWorkspace.ts` |
| Skills are visible as current project, recommended, and user Skills, and can be saved to `skills/skill-index.json`. | demo-ready | `directorSkillLibrary.ts`, `director-skill-library:test`, `MinimalAgentPanel.tsx` |
| Seedance video requests are compiled with reference roles, no-BGM policy, serial submit evidence, returned-video preview, and export evidence. | demo-ready with bounded live-provider evidence | `storyboardReferencePipeline.ts`, `projectVideoClient.ts`, `showcase-package-audit:test`, returned-video live evidence |
| Demo export/showcase package is available for recording. | demo-ready | `showcase-package/DEMO_INDEX.md`, `docs/demo-recording-runbook.md`, `showcase-package-audit:test` |
| Final rehearsal has an operator-facing checklist for fresh project, Agent message flow, Skills, references, Seedance queue, preview, and export. | demo-ready | `docs/demo-final-rehearsal-checklist.md`, `demo:goal-audit:test` |
| Full autonomous long-drama Agent, multimodal image QA, TTS expansion, and music rhythm planning. | future lane | deliberately excluded from this goal closeout |

## Phase 1: Agent Shell

Status: demo-ready.

Covered behavior:

- right-side Agent composer is the primary interaction point;
- sent text and attachments clear after sending;
- the send button stays visible in the Agent composer;
- explicit fresh-video requests from the right Agent rail open a new draft even
  when the current project already has selected shots;
- selected-shot feedback such as "这个镜头重做" stays bound to the selected
  context and does not accidentally start a new project;
- Agent messages contain understanding, project status, scope, next step, and
  action outcome;
- Agent timeline entries now carry the action lifecycle through planning,
  confirmation, running state, and tool results, so the right rail can show
  "已提议 / 待确认 / 执行中 / 已完成 / 失败 / 需补充" instead of a silent
  workbench mutation;
- task cards cover planning, reference generation, shot rewrite, video request
  compilation, video submit/query, and export;
- scattered workflow buttons are reduced in priority and main actions are
  expressed as Agent task cards;
- project status is projected into one human-readable state.

Evidence:

- `src/ui/director/MinimalAgentPanel.tsx`
- `src/agent-core/types.ts`
- `src/agent-core/toolEvents.ts`
- `src/ui/director/agentPanelProjection.ts`
- `src/ui/app/projectStatusViewModel.ts`
- `src/ui/director/DirectorModeShell.tsx`
- `src/core/directorFreshDraftIntent.ts`
- `src/core/projectAgentWorkspace.ts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/vibe-agent-core-test.mts`
- `scripts/minimal-ui-contract-test.mts`
- `scripts/director-fresh-draft-intent-test.mts`
- `scripts/current-project-ui-closed-loop-test.mts`

Main gates:

```bash
npm run minimal-agent-p1:test
npm run minimal-ui:test
npm run director-fresh-draft-intent:test
npm run current-project-ui-closed-loop:test
```

Live validation:

- 2026-06-19: opened
  `http://127.0.0.1:5174/?case=agent-feedback-bridge-fixed`.
- Sent a first idea from the right Agent rail and received a 2-shot draft in
  the center workbench plus visible Agent timeline messages.
- Sent a follow-up from the same right Agent rail: "第二个镜头不对，把蓝色光点改成从地铁入口慢慢亮起来，别生成，只更新草案。"
- Verified the app updated the existing draft instead of starting a new plan:
  the draft stayed at 2 shots and the second shot became "地铁入口蓝光亮起".
- 2026-06-19: automated the previously fragile intent split:
  "做一个 12 秒短片..." routes to a new video draft even when a shot is
  selected; "这个镜头重做..." routes to selected-shot revision.
- 2026-06-19: opened
  `http://127.0.0.1:5174/?case=agent-kernel-final-pass`.
- Sent selected-shot feedback from the right Agent rail:
  "这个镜头更压抑一点，只整理计划，不要生成参考。"
- Verified the input cleared, the send button stayed visible, the confirmation
  card showed "确认修改 / 再改一下", and the Agent reply used the stable target
  label "镜头 1-1 车票吐出" without replacement characters.
- 2026-06-19: opened
  `http://127.0.0.1:5174/?case=agent-kernel-v1-readonly-summary`.
- Sent a read-only status request from the right Agent rail:
  "这个镜头先不要生成参考，只检查一下项目状态和下一步。"
- Verified the input cleared, the send button stayed visible, the Agent thread
  showed "我理解为" and a status-only boundary, no reference/video generation
  action panel was shown, and the detail summary read "这次检查了什么" instead
  of "这次会改什么".
- 2026-06-19: tightened the Agent timeline status summary so a waiting
  assistant draft or Skill proposal is shown as waiting for creator
  confirmation, not as "Agent 正在执行". This keeps the right rail from implying
  hidden background work when the next required step is user confirmation.
- 2026-06-19: opened a clean Vite instance at
  `http://127.0.0.1:5178/?case=agent-kernel-v1-live-check` after detecting a
  stale `5174` dev process.
- Sent a fresh 6-second anime project request from the right Agent rail:
  "新建一个 6 秒 90 年代日漫感小项目：雨夜天桥下，一个戴耳机的女生捡到一张会发光的旧车票。先只整理故事、镜头和节奏，不生成参考，不提交视频。"
- Verified the send button stayed visible, the composer cleared after submit,
  the Agent thread showed understanding / material read / shot planning, and
  the no-reference / no-video boundary was respected.
- Confirmed the draft into the story flow, then sent selected-shot feedback:
  "这个不对，动作再拆得更像日漫一点..." and verified the Agent message flow
  displayed `引用 镜头 1-1 雨夜拾票` plus `这个指向 镜头 1-1 雨夜拾票`.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=selection-footer-context&ts=1782000000000`.
- Verified the Agent input footer now shows the selected target before the
  creator sends anything: `这句话会引用：正在看 镜头 1-1`.
- Sent "这个镜头再压抑一点，只规划，不生成参考，不提交视频。" and verified the
  response stayed bound to shot 1-1, stopped at confirmation, and did not submit
  video.
- Rechecked the live DOM after the wording cleanup: old copy such as
  "点消息里的" and "点确认后准备参考" no longer appeared, while the actionable
  "发送" button and "确认修改" card remained visible.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-timeline-persist-v2&ts=1781933372540`.
- Verified the latest confirmation card now reads like an Agent reply instead
  of a system log: `我准备修改，范围是镜头 1-1 天桥下捡起发光车票。这一步不会提交视频，确认后才执行。`
- Verified the right rail still showed the selected-context footer
  `这句话会引用：正在看 镜头 1-1` and the visible `发送` button after reload.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-kernel-v1-final-rehearsal&ts=1782009000000`.
- Started from the project control menu, clicked "新建项目", and verified the
  empty state returned to "准备开始" with a visible right-side Agent composer.
- Sent a fresh read-only planning request:
  "做一个 8 秒 90 年代日漫感小短片...先只整理故事、镜头和节奏，不生成参考，不提交视频。"
- Verified the composer cleared, the "发送" button stayed visible, the Agent
  produced a 2-shot draft with a clear confirmation card, and the boundary copy
  said no references or videos would be generated automatically.
- Confirmed the draft and verified it only entered the story flow: the project
  showed 2 shots, video remained "未生成", and the next reference step required
  explicit confirmation before any image generation.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=final-rehearsal-check&ts=1781938741984`.
- Verified the live page still satisfies the final rehearsal checklist surface:
  left project navigation, center story/reference/video results, and right
  Agent conversation were all visible; the right composer kept a visible
  `发送` button; `先整理 / 生成参考 / 提交视频` were visible; the selected
  context cue included `这句话会引用`; the three Skill groups were visible; the
  long Skill detail was closed; and stale workflow/engineering copy such as
  `底部主按钮`, `对象：`, `成本：`, and `外部：` did not appear.
- 2026-06-20: in the same Codex in-app browser session, sent
  `把这个沉淀成 Skill，不生成参考，不提交视频。` from the right Agent composer.
  Verified the composer cleared, the Skill confirmation card appeared in the
  message flow, `确认保存 Skill` and `再改一下` were visible, the three Skill
  groups stayed visible, and the boundary still said no video submission.
- 2026-06-20: rechecked the Codex in-app browser against the current workspace
  after finding stale dev servers from `/Users/lichenhao/Desktop/new` on ports
  `5174` and `5178`. Restarted `5178`/`8790` from
  `/Users/lichenhao/Desktop/new vibe directing`, verified the served source
  contained the current Agent rail code, and confirmed the project rail now
  shows the same creator-facing reference gap as the main status:
  `参考 缺 2 张` and `还缺 2 张画面参考`.

## Phase 2: Selection Context And Skills

Status: demo-ready first version.

Covered behavior:

- shot, section, asset, video, and export selection can be projected into the
  Agent composer;
- the composer shows the current discussion target in creator-facing language;
- follow-up instructions such as "这个重做" stay bound to the prepared target
  instead of silently switching to another live selection;
- Skills are presented as reusable director knowledge, not as a user-facing
  mode dropdown;
- each Skill card records when to use it, when to avoid it, affected pipeline
  surfaces, rules, example, source, version, and source shot metadata;
- each project can persist a lightweight Skill Stack index under
  `skills/skill-index.json`;
- the Agent can save a successful selected shot strategy as a Skill draft.
- Agent timeline now reports project material intake as `classify_assets`, so
  the visible Agent action matches the product promise: identify materials,
  classify their use, and ask for confirmation before binding them.
- Material intake now shows a compact `素材识别摘要` inside the right Agent
  message flow: what the Agent recognized, which material types are involved,
  how many still need review, and what the next creator action is.
- When project material intake has more review items than the compact message
  card can show, the Agent thread now states how many remain and points the
  creator to the reference page instead of silently hiding the rest.
- project folder scan can classify scripts, character refs, scene refs, props,
  voice refs, prompt files, submit receipts, returned videos, and exports;
- fine-detail assets such as headlights, wheels, and hand closeups are kept
  visible for review but folded into subject assets or shot notes instead of
  becoming standalone character/prop references.

Evidence:

- `src/core/directorSkillLibrary.ts`
- `src/core/projectAgentWorkspace.ts`
- `src/core/projectFolderScannerNode.ts`
- `src/ui/director/MinimalAgentPanel.tsx`
- `src/ui/director/MinimalStoryFlow.tsx`
- `src/ui/director/directorSkillUi.ts`
- `scripts/director-skill-library-test.mts`
- `scripts/project-folder-scanner-test.mts`
- `scripts/project-agent-workspace-test.mts`
- `scripts/minimal-agent-p1-contract-test.mts`
- `scripts/current-project-selection-binding-test.mts`

Main gates:

```bash
npm run director-skill-library:test
npm run project-folder-scanner:test
npm run project-agent-workspace:test
npm run minimal-agent-p1:test
npm run current-project-selection-binding:test
```

Live validation:

- 2026-06-19: opened
  `http://127.0.0.1:5174/?case=agent-kernel-v1-asset-overflow`.
- Verified the right Agent rail still shows the current target, visible send
  button, execution boundary, three Skill groups, and message flow.
- Verified the material-suggestion contract is protected by
  `minimal-agent-p1:test`: the first few reviewable materials become clickable
  Agent actions, and extra pending materials are disclosed in the message flow
  instead of being hidden.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-asset-summary-check`.
- Verified the right Agent composer and send button were visible, the console
  had no errors, and empty material state no longer rendered a misleading
  "类型待确认 / 待确认没有" summary card. Material summaries now appear only
  when the Agent actually has recognized material or review work to explain.
- In the same live session, created a fresh browser-backed project from the
  project control menu and sent:
  "做一个 8 秒 90 年代日漫感小短片...先只整理故事、镜头和节奏，不生成参考，不提交视频。"
- Verified the Agent cleared the composer, kept the send button visible,
  returned a 2-shot draft with 4-second executable shot durations, showed a
  message-level `确认写入故事流` card, and repeated that references/videos would
  not be generated before a later confirmation.
- Confirmed the draft and verified the project entered the 2-shot story flow:
  reference generation showed `确认生成参考`, video stayed `未生成`, and the
  visible Agent state pointed follow-up edits at `镜头 1-1`.
- 2026-06-20: reopened
  `http://127.0.0.1:5178/?case=agent-timeline-persist-v2&ts=1781933372540`
  after compacting the Skill detail area.
- Verified the right rail keeps the three Skills groups visible while folding
  the long Skill usage detail into a compact disclosure. The Skill block height
  dropped from roughly 278px to 157px, and the Agent thread moved up from
  roughly 416px to 296px, keeping the message flow as the main interaction
  surface.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-copy-check`.
- Verified the live project page no longer describes `全能参考` as directly
  generating video. The page still showed Agent flow, reference confirmation,
  visible send/confirm controls, and no console errors.
- Agent visible plan cards now describe write destinations in creator-facing
  language such as `参考结果和运行记录`, `视频请求草案`, and `项目草案`.
  Internal files remain traceable in the Kernel data, but the message flow no
  longer asks creators to understand `Project.vibe` or `.vibe-runtime` paths.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-write-wording-recheck`.
- Sent a plan-only follow-up and verified the live Agent thread uses
  `修改项目`, `只保存项目修改`, and `项目草案` instead of the old `写项目`
  wording.
  The page still had no internal path leak and no console errors.
- 2026-06-20: tightened Agent Kernel execution-boundary copy so internal cost
  and external-submit risk remains in structured fields, while visible copy
  says `只读取项目`, `只保存项目修改`, `会调用参考生成`, `会联网查资料`, or
  `会提交 Seedance 视频任务`.
- The visible Agent thread now compacts duplicate internal tool returns once a
  real result card exists. Creators still see running states, confirmation
  cards, failures, cancellations, and result cards, but no longer need to read
  both `工具返回` and the same completed result.
- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-message-compaction-check` and verified the
  Agent page still loads with no console errors after the message compaction
  change.
- 2026-06-19: opened
  `http://127.0.0.1:5174/?case=agent-kernel-v1-footer-next-restarted`.
- Verified the composer no longer asks the user to find a hidden confirmation
  card. When the input is empty and Agent already has a next step, the footer
  shows a visible action button such as "允许生成参考" next to the normal
  "发送" button.
- 2026-06-19: ran `npm run dev:full` while the runtime API was already
  listening on `127.0.0.1:8790`.
- Verified the dev wrapper now adopts the existing runtime API, starts Vite on
  `127.0.0.1:5174`, and keeps the app usable instead of exiting on
  `EADDRINUSE`.
- 2026-06-19: updated `docs/demo-recording-runbook.md` to use `npm run
  dev:full` and `http://127.0.0.1:5174/` as the recording startup path, so demo
  rehearsal uses the same runtime-adoption behavior as the verified app start.
- 2026-06-19: tightened the final Agent reply for completed read/organize
  actions. When material classification finishes, the last "AI 导演" message now
  says "结果已经写进上面的消息流" instead of using future tense copy such as
  "我会先整理".

## Phase 3: Demo Loop And Showcase Package

Status: demo-ready with bounded live-provider evidence.

Covered behavior:

- a fresh idea can reach story planning, reference strategy selection, reference
  generation projection, video request compilation, preview, and export;
- Seedance/Jimeng video submission remains serial and preserves submit ids,
  prompt paths, reference paths, returned media paths, and preview projection;
- returned-video evidence is available through local two-video and showcase
  packages;
- the showcase package contains final/segment video files, reference assets,
  software screenshots, prompt evidence, submit receipts, page copy, and demo
  flow notes.

Evidence:

- `showcase-package/DEMO_INDEX.md`
- `showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00`
- `showcase-package/promo-page-ai-ladies-op-2026-06-18`
- `scripts/showcase-package-audit-test.mts`
- `scripts/demo-main-chain-status-flow-test.mts`
- `scripts/current-project-preview-ui-runtime-closed-loop-test.mts`
- `scripts/mvp-demo-export-test.mts`

Main gates:

```bash
npm run showcase-package-audit:test
npm run demo:main-chain-status-flow:test
npm run current-project-preview-ui-runtime-closed-loop:test
npm run mvp-demo-export:test
```

Live validation:

- 2026-06-20: opened
  `http://127.0.0.1:5178/?case=agent-kernel-v1-ui-real-check&ts=1782000000003`.
- Verified the right Agent message flow shows one returned-video result card:
  `videoResultCount = 1`, `threadHasVideoReturned = true`, and
  `threadStaleProcessing = false`.
- Verified the page-level project state and the Agent advice agree: the top
  status reads "视频待确认 / 确认视频结果", the Agent advice says
  "视频结果已出", and `bodyVideoProcessingCount = 0`.
- Verified the bottom Agent send button remains visible with the label
  "发送". This protects the demo from the older "result changed somewhere in
  the workbench, but the Agent did not explain it" failure mode.

## 2026-06-20 Entry Freshness Recheck

Issue found during live UI verification:

- The 5178 demo server was serving an old Vite entry transform with a fixed
  `?t=1781907234075` URL.
- That stale transform kept the old Agent confirmation copy visible even after
  `MinimalAgentPanel.tsx` had been updated.

Fix:

- Removed fixed `?agent-kernel-v*` query imports from browser entry and Agent
  shell modules.
- Restarted the 5178 dev server and verified the served entry now loads
  `/src/main-agent-kernel.tsx` without fixed `?agent-kernel-v*` or stale
  `?t=...` script URLs.
- Verified the live Agent confirmation card now says
  "确认前再核对：这次只处理 正在看 镜头 1-1；参考生成；不提交视频。"
  and no longer exposes `对象：/成本：/写入：/外部：` engineering labels.

## 2026-06-20 Agent Message Readability Recheck

Problem found during a live 5178 browser pass:

- The Agent timeline technically contained the right cards, but several headers
  repeated their stage and title, for example `项目状态项目状态`,
  `素材识别素材识别结果`, or `下一步下一步判断`.
- This made the right rail feel like an internal log instead of a readable Agent
  conversation.

Fix:

- Added a display-only title compaction layer in `MinimalAgentPanel.tsx`.
- Persisted timeline entries are unchanged; only the rendered header hides exact
  duplicates or trims a repeated stage prefix.
- Verified the current-tree 5178 page no longer shows those duplicate header
  strings after reload.

## Current Non-Blocking Risks

- Real Seedance queue recovery still deserves occasional live validation because
  external queue time can be 30-120 minutes and cannot be made deterministic.
- Keep doing one short visible front-end pass before recording, because
  message-flow regressions are easier to catch in the actual UI than in static
  tests alone.
- Agent Kernel v1 is demo-ready for the current director loop, but the deeper autonomous Agent kernel for many chapters, batch queues, and persistent project memory is still a future architecture lane.
- Skills are persisted as project/user knowledge cards, not yet a full skill
  marketplace or long-project knowledge graph.
- The current status model merges real-chain, relay queue, preview, and export
  state for display. The demo-facing copy is now unified for returned videos,
  but the underlying data sources are still separate and should be simplified
  in a later architecture pass.

## Final Demo Gates

Run this stack before recording or handoff:

```bash
npm run demo:goal-audit:test
npm run showcase-package-audit:test
npm run director-fresh-draft-intent:test
npm run demo:ready:test
npm run current-project-ui-closed-loop:test
npm run current-project-preview-ui-runtime-closed-loop:test
npm run director-skill-library:test
npm run seedance-live-preflight:test
npm run seedance-live-preflight
npx tsc --noEmit --pretty false
git diff --check
```

Before recording, also walk through `docs/demo-final-rehearsal-checklist.md`.
It is the operator checklist for the final live pass: fresh project, visible
send button, Agent confirmation boundary, selected-context footer, compact
Skills, reference review, Seedance VIP 720p serial submit, returned-video
preview, and showcase export.

Latest verified stack:

- 2026-06-20: Codex in-app browser Agent message-flow regression fix.
  - Current page:
    `http://127.0.0.1:5178/?case=agent-kernel-v1-real-seedance&ts=1782015000000`.
  - Found a real UI contradiction: the right Agent rail said `参考可用，下一步可以发送视频。`
    while older restored confirmation cards still showed `确认生成参考`.
  - Fixed `MinimalAgentPanel.tsx` so stale reference-review, reference-generation
    confirmation, and reference-complete cards are filtered once reference-ready
    evidence exists in the visible thread, timeline, facts, or execution receipt.
  - Browser verification after reload: visible stale reference confirmation cards
    dropped from `2` to `0`; the visible thread keeps only the reference-ready
    result card and the next actions `去参考页` / `按建议继续`.
  - Browser console warning/error check: empty.
  - Verified by `npm run minimal-agent-p1:test`,
    `npm run current-project-ui-closed-loop:test`, `npm run minimal-ui:test`,
    `npm run demo:goal-audit:test`, `npm run showcase-package-audit:test`,
    `npm run current-project-preview-ui-runtime-closed-loop:test`,
    `npm run demo:ready:test`, `npx tsc --noEmit --pretty false`, and
    `git diff --check`.
- 2026-06-20: Agent Kernel v1 completion matrix and Codex in-app browser UI
  recheck.
  - Added the three-phase completion matrix above so the demo can clearly say
    what is demo-ready, what is bounded, and what remains future-scoped.
  - Rechecked the currently open Codex in-app browser page:
    `http://127.0.0.1:5178/?case=final-rehearsal-check&ts=1781938741984`.
  - Verified the page still showed the right Agent rail, selected-context cue,
    visible `发送` button, `确认修改` card, no-video boundary, and the three
    Skill groups: `当前项目已加载`, `Agent 推荐`, and `我的 Skills`.
  - Verified stale engineering copy such as `对象：`, `成本：`, `外部：`,
    `底部主按钮`, and `整理草案` did not appear in the visible page text.
- 2026-06-20: `npm run seedance-live-preflight:test`
  - Added deterministic fixture coverage for the Seedance submit preflight kernel.
  - Covers missing role/scene/prop image references, a ready 720p VIP 4-second submit lane, active relay queue blocking, and missing image/Responses Key blocking.
  - This is the stable CI/demo gate; `npm run seedance-live-preflight` remains the live operator check against the currently bound project.
- 2026-06-20: `npm run seedance-live-preflight`
  - Current bound project: `.vibe-runtime/browser-projects/project-1781905669688`
  - Result: blocked before submit because the project has 2 shots but only 1 style-text asset and 0 usable role/scene/prop image references.
  - Positive checks: Apikey.fun/Responses image key is configured, `dreamina` CLI is found, default submit lane is Seedance VIP 720p, max concurrent video jobs remains 1.
  - Interpretation: do not submit this current project to Seedance until references are generated or attached; the missing video submit is a project-readiness blocker, not a queue/UI failure.
- 2026-06-20: `directorAgentToolHandoff` and Agent capability copy now preserve concrete video-submit blockers.
  - When video submission is allowed but not ready, the Agent can distinguish missing project, missing submit entry, missing references, missing Key, or an already-sent task.
  - The recovery message for the common demo blocker is now "先补齐角色、场景或道具参考，再提交视频。"
  - Verified by `npm run director-agent-tool-handoff:test`, `npm run director-product-agent-loop:test`, and `npm run current-project-ui-closed-loop:test`.
- 2026-06-20: Codex in-app browser selected-context Agent check.
  - Current page: `http://127.0.0.1:5178/?case=final-rehearsal-check&ts=1781938741984`.
  - The right Agent footer showed `这句话会引用：正在看 镜头 1-1`.
  - Sent `这个不对，画面更压抑一点。只规划，不生成参考，不提交视频。`
  - Verified the composer cleared, the message flow displayed `引用` and `这个指向` as `镜头 1-1 天桥下捡起发光车票`, and the Agent reply kept the no-reference/no-video boundary visible.
- 2026-06-20: Codex in-app browser project-level reference-generation check.
  - Current page: `http://127.0.0.1:5178/`.
  - Found and fixed a real target-scope bug: after a shot was selected, a user
    request such as `补齐整个项目参考` could still inherit the selected shot
    context and generate only shot-scoped references.
  - `confirmedProductActionRunner`, `directorProductAgentLoop`, and
    `directorAgentToolHandoff` now treat explicit project-target actions as
    project-scoped; they clear selected shot ids before handing work to tools.
  - The Image2 asset-generation route now reads shot `intent` text and labeled
    `角色 / 场景 / 道具` facts, so project-wide reference generation can discover
    items such as `女高中生`, `旧书`, and `发光车票` instead of missing them.
  - Browser verification after reload: the right Agent message flow showed the
    original user request, Agent understanding, execution result, and next
    action; older failed reference cards were hidden after the later success.
  - The reference tab showed `参考 7 张` in the project rail and `7 张参考图` in
    the workbench, with `1` character reference, `4` scene/weather references,
    and `2` prop references. This protects the demo from the older mismatch
    where hidden style assets made the rail count differ from visible images.
  - Verification commands: `npm run director-product-agent-loop:test`,
    `npm run vibe-agent-core:test`, `npm run minimal-agent-p1:test`,
    `npm run runtime-api-current-project-image2-assets-generate:test`,
    `npm run current-project-ui-closed-loop:test`,
    `npm run current-project-preview-ui-runtime-closed-loop:test`,
    `npm run director-skill-library:test`,
    `npm run demo:goal-audit:test`,
    `npm run showcase-package-audit:test`,
    `npm run minimal-ui:test`,
    `npm run demo:ready:test`,
    `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-20: Codex in-app browser selected-shot handoff recheck after the
  right-rail context fix.
  - Current page: `http://127.0.0.1:5178/`.
  - Selected `镜头 1-2 发光的车票` from the center story flow.
  - Verified the right Agent rail displayed `镜头1-2 · 发光的车票`,
    `方式待判断`, and `时长5s` before sending any text.
  - Sent `这个不对，动作再拆得更像日漫一点。`
  - Verified the composer cleared, the Agent message flow interpreted `这个` as
    `镜头 1-2 发光的车票`, produced a confirmation card for that shot, and did
    not fall back to the previously selected `1-1` shot.
  - Verified the send button keeps the stable accessible name `发送`; disabled
    reasons now live in the status/title copy instead of changing the button
    name.
- 2026-06-20: confirmed execution cards now show the concrete `对象` plus result facts.
  - Confirmed tool start/result/action-result entries include the selected target label, so returned cards do not only say `1 个镜头`.
  - Reference generation, Seedance submit/query, and export outcomes can show creator-readable facts such as `产物`, `提交号`, `队列`, `视频`, `导出目录`, `清单`, and `写入`.
  - Verified by `npm run vibe-agent-core:test`, `npm run minimal-ui:test`, `npm run current-project-ui-closed-loop:test`, `npm run minimal-agent-p1:test`, `npm run demo:goal-audit:test`, and `npx tsc --noEmit --pretty false`.
- 2026-06-20: Codex in-app browser video-submit blocker UI recheck.
  - Current page:
    `http://127.0.0.1:5178/?case=agent-kernel-v1-live-submit&ts=1781957600000`.
  - Found a real demo-risk mismatch: a Seedance submit action was correctly
    blocked by text QA, but the center/Agent UI still showed stale
    submit-ready or video-processing affordances.
  - Fixed `CreatorDeskPanels` so project-level video blockers, blocked
    video-send actions, and failed video generation are treated as the primary
    video lane, not as active generation and not as background material review.
  - Fixed `MinimalAgentPanel` so an older successful reference-generation card
    no longer exposes a stale `确认提交视频` action after a later video-submit
    failure becomes the latest final action.
  - Browser verification after reload: the page now shows `动作需要处理`,
    `先处理失败`, and `视频需要处理 / 重试或继续修改`; it no longer shows
    `等待视频结果`, stale material-inbox noise, or a stale submit button.
  - Verified by `npm run minimal-agent-p1:test`, `npm run minimal-ui:test`,
    `npm run current-project-ui-closed-loop:test`, `npm run demo:ready:test`,
    `npm run showcase-package-audit:test`,
    `npm run current-project-preview-ui-runtime-closed-loop:test`,
    `npm run director-skill-library:test`, `npx tsc --noEmit --pretty false`,
    and `git diff --check`.
- 2026-06-20: Codex in-app browser Agent-message confirmation routing recheck.
  - Current page:
    `http://127.0.0.1:5178/?case=agent-kernel-fresh-real-20260620&ts=1782015000000`.
  - Started from a fresh project idea and confirmed the initial `只整理故事、
    镜头和节奏，不生成参考，不提交视频` boundary.
  - Found a real Agent UX bug: clicking the message-level `确认修改` card could
    reuse the global footer next action and incorrectly start reference
    generation.
  - Fixed message-level confirmations so they only use the live primary action
    when the message `actionId` matches the current action or when the message is
    an explicit footer action card.
  - Found a second message-flow bug after reference results returned: unrelated
    `generate_references` result cards could close or hide a later
    `revise_story_or_shot` confirmation.
  - Fixed confirmation filtering so direct product results only close matching
    action confirmations; reference results no longer hide shot-edit
    confirmations.
  - Browser verification after reload: `确认修改` for `镜头 1-2` reappeared
    despite `参考待看`, clicking it no longer triggered Image2, and the current
    confirmation wrote the shot change back with `修改已写入项目`.
  - Verified by `npm run minimal-agent-p1:test`, `npm run minimal-ui:test`,
    `npm run current-project-ui-closed-loop:test`,
    `npm run demo:goal-audit:test`, `npx tsc --noEmit --pretty false`, and
    `git diff --check`.
- 2026-06-20: Codex in-app browser recovered-confirmation wording recheck.
  - Sent another selected-shot edit for `镜头 1-1` with the boundary
    `只修改草案，不生成参考，不提交视频`.
  - Verified the live, current confirmation card still shows `确认修改`.
  - Reloaded before confirming to simulate a restored timeline. The same card
    now shows `继续确认`, making it clear that a restored confirmation will
    first re-enter the Agent for confirmation instead of pretending to execute a
    cached action in one click.
  - Verified the restored card still keeps the shot target, write boundary, and
    no-video/no-reference copy visible in the message flow.
  - Verified by `npm run minimal-agent-p1:test`, `npm run minimal-ui:test`,
    `npm run current-project-ui-closed-loop:test`,
    `npm run current-project-preview-ui-runtime-closed-loop:test`,
    `npm run demo:goal-audit:test`, `npm run showcase-package-audit:test`,
    `npm run director-skill-library:test`, `npm run demo:ready:test`,
    `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-20: Codex in-app browser reference-generation lifecycle wording
  recheck.
  - Live preflight correctly blocked video submission while references were
    missing, so no Seedance submission was attempted.
  - Clicked the Agent `确认生成参考` path and verified the right-side message
    flow shows the action instead of silently mutating the middle pane.
  - Found a real demo UX issue: queued/running reference generation could be
    displayed as `参考任务已准备` with an `已完成` status, and older persisted
    timeline entries could keep that stale wording after reload.
  - Fixed queued reference generation to render as `参考生成中` with a running
    lifecycle, and added legacy display cleanup so old timeline entries no
    longer appear as completed actions.
  - Browser verification after reload on
    `http://127.0.0.1:5178/?case=codex-browser-ui-check&ts=1781962189303`:
    stale `参考任务已准备` text disappeared from the visible message flow, the
    send button remained visible, and the current project stayed in the
    expected `参考待看` review state.
  - Verified by `npm run minimal-agent-p1:test`, `npm run minimal-ui:test`,
    `npm run vibe-agent-core:test`,
    `npm run minimal-agent-product-capabilities:test`,
    `npm run current-project-ui-closed-loop:test`,
    `npm run current-project-preview-ui-runtime-closed-loop:test`, and
    `npx tsc --noEmit --pretty false`.
- 2026-06-20: Codex in-app browser video-submit cancellation recheck.
  - From the Agent `参考待看` state, clicked `去参考复核`, used the creator-facing
    `全部通过` action, and verified the project moved to `参考可用` with the
    Agent next action `允许发送视频`.
  - Clicked `允许发送视频` and cancelled the browser confirmation dialog. The live
    old dev server projected this as `视频待处理 / 补参考或修改这一段`, which is
    misleading because the user only cancelled the submit.
  - Fixed the Seedance submit hook so a cancelled confirmation becomes an idle,
    retryable action with `已取消，本次没有发送；需要时可以重新确认。` It no longer
    uses the blocked video path.
  - Added a behavior check that cancelled video confirmation must not become
    `视频待处理` or ask the user to补参考, while real provider failures and QA
    blockers still keep their recoverable video-problem states.
  - Added legacy-state compatibility for old persisted cancellation records:
    even if a previous page stored `已取消，本次没有发送。` as a blocked video action,
    `projectStatusViewModel`, `CreatorDeskPanels`, `DirectorModeShell`, and
    `MinimalAgentPanel` no longer reopen the blocked-video recovery lane.
  - Browser recheck: after a hard reload on `5174`, the existing old cancelled
    record no longer showed `视频待处理 / 补参考或修改这一段`; the page returned to
    the normal `允许发送视频` path.
  - Verification note: the old dev server still serves stale unversioned Vite
    transforms for some modules until the URL is cache-busted or the server is
    restarted. Query-busted module requests returned the corrected source. Restart
    `5174` before the next full visual browser pass.
  - Follow-up fix: added a `noStoreDevCachePlugin` in `vite.config.ts` that wraps
    dev responses at `writeHead` time and forces transformed module responses to
    `Cache-Control: no-store`, `Pragma: no-cache`, and `Expires: 0`. A fresh dev
    server on `5191` returned `no-store` for
    `/src/ui/director/useSeedanceVideoSubmitAction.ts`.
  - Follow-up guard: `npm run demo:artifact-freshness:test` now checks the Vite
    no-store contract and the current Agent/Seedance source markers. Before a
    browser recording, run it with `VIBE_FRONTEND_URL=http://127.0.0.1:5174/` to
    prove the live dev server is serving the latest Agent route and cancellation
    behavior instead of an old transformed module.
  - Codex Browser check: the in-app browser can operate the app. The old stale
    `5174` process was later cleared, and the canonical live page passed the
    `VIBE_FRONTEND_URL=http://127.0.0.1:5174/ npm run demo:artifact-freshness:test`
    guard before the final browser smoke.
  - Startup follow-up: `npm run dev:full` now refuses to adopt a stale `5174`
    server and prints the occupying PID plus a concrete `kill` command. On this
    machine it reported PID `41265`; after the stale server was stopped, a fresh
    canonical `5174` session passed the live freshness and browser checks.
  - 2026-06-21: final canonical `5174` Codex in-app browser check.
    - Opened
      `http://127.0.0.1:5174/?case=codex-browser-final-smoke-5174&ts=1781983487030`
      in the Codex browser after `demo:artifact-freshness:test` passed against
      the live frontend.
    - Verified the left project navigation, center workbench state, and right
      Agent conversation rail were visible on the canonical port.
    - Verified the Agent composer had one stable `发送` button; empty input kept
      it disabled, text input enabled it, and sending cleared the composer.
    - Sent `只告诉我下一步该怎么做，不要执行，不写项目，不提交视频。这是 codex 浏览器最终 smoke。`
      and verified the latest turn routed to project reading: `不写文件`,
      `不提交视频`, and `不需要确认`.
    - The existing project still had older confirmation/material-review cards in
      history, but the new explain-only turn did not create a project-write or
      provider-submit confirmation.
  - Verified by `npm run current-project-ui-closed-loop:test`,
    `npm run minimal-agent-p1:test`,
    `npm run current-project-preview-ui-runtime-closed-loop:test`,
    `npm run demo:goal-audit:test`, `npm run showcase-package-audit:test`,
    `npm run director-skill-library:test`,
    `npm run demo:ready:test`,
    `npx tsc --noEmit --pretty false`, and `git diff --check`.
- 2026-06-19: `npm run minimal-agent-p1:test`
- 2026-06-19: `npm run minimal-ui:test`
- 2026-06-19: `npm run current-project-ui-closed-loop:test`
- 2026-06-19: `npm run current-project-preview-ui-runtime-closed-loop:test`
- 2026-06-19: `npm run director-skill-library:test`
- 2026-06-19: `npm run demo:goal-audit:test`
- 2026-06-19: `npm run showcase-package-audit:test`
- 2026-06-19: `npm run demo:ready:test`
- 2026-06-19: `npx tsc --noEmit --pretty false`
- 2026-06-19: `git diff --check`
- 2026-06-20: `npm run demo:ready:test`
- 2026-06-20: `npm run minimal-agent-p1:test`
- 2026-06-20: `npm run minimal-ui:test`
- 2026-06-20: `npm run demo:goal-audit:test`
- 2026-06-20: `npm run showcase-package-audit:test`
- 2026-06-20: `npm run director-skill-library:test`
- 2026-06-20: `npm run current-project-ui-closed-loop:test`
- 2026-06-20: `npm run current-project-preview-ui-runtime-closed-loop:test`
- 2026-06-20: `npx tsc --noEmit --pretty false`
- 2026-06-20: `git diff --check`

## Demo Recording Flow

Use `docs/demo-recording-runbook.md` for the live recording script and
`showcase-package/DEMO_INDEX.md` for packaged evidence. The recommended story is:

1. open the app and point out the three-column contract;
2. start from one idea in the Agent composer;
3. show the Agent response and task card;
4. select a shot or asset and ask for a targeted change;
5. show Skills and explain that they are director knowledge cards;
6. show references, video prompts, submit receipts, returned videos, and export
   package evidence.
