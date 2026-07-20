# Vibe Director Studio P11-D real-use observation

Date: 2026-07-20

Status: **PASS FOR LOCAL PACKAGED REAL-USE OBSERVATION**.

P11-D observed three creator tasks in a packaged App. The observation used
isolated `/tmp` projects and local deterministic media only. It did not call a
model or media Provider, execute a pending generation confirmation, promote a
candidate into project facts, or export a delivery package.

## Observation scope

1. Create and save a two-shot story while explicitly deferring reference and
   video generation.
2. Reopen reference work from an existing two-shot project and stop at the
   reference-generation confirmation.
3. Review a returned video, choose `需要修改`, clarify the director intent,
   form a regeneration proposal, and stop at the new video confirmation.

The packaged App used for final retests was:
`/tmp/vibe-director-p11-d-20260720/Vibe Director Studio P11D-7.app`.

## Task matrix

| Task | Result | Actual packaged behavior | Confirmation cost |
| --- | --- | --- | --- |
| Two-shot plan-only story | PASS | Story remained at 2 shots; references remained `待生成`; video remained `未生成`; cold restore returned to `继续描述想法` with no stale confirmation | Story confirmation and save-location boundary; no generation confirmation after save |
| Explicit reference request | PASS after P1 fix | `开始补参考` restored one `确认生成参考` card after cold start; the card was `本地验证 · 不计费`; no execution occurred | One pending reference confirmation |
| Review revision | PASS | `needs_review` result moved through `需要修改` -> Clarify -> Proposal -> a new independent video confirmation; original media and project facts stayed byte-identical | Review decision, direction choice, proposal confirmation, then one pending execution confirmation |

## Packaged observations

### Task 1: plan-only story

Input:

`我要拍一个 8 秒短片：雨夜便利店门口，女孩把纸飞机递给机器人保安，纸飞机在灯箱里亮起来。整理成 2 个镜头，不生成参考图，不提交视频。`

Final cold-restore state:

- story: `2 个镜头`;
- references: `待生成 · 0/2 张可看 · 2 张缺少`;
- video: `未生成`;
- Agent task: `继续描述想法`;
- stale story/reference confirmation: absent;
- generated media and export side effects: absent.

### Task 2: explicit reference work

The existing project contained locked text metadata for two references, while
the referenced media files were absent. The project workbench correctly
reported `缺 2 张`.

The exact command `开始补参考` produced one fact-bound
`prepare_reference_generation` staged plan and one waiting confirmation. After
repackaging and cold restart, the right Agent rail restored:

- current task: `确认验证参考流程`;
- card: `确认生成参考`;
- execution mode: `本地验证 · 不计费`;
- protection: `只生成参考图，不提交视频`;
- media, generation result, and Provider receipt: absent.

The more conversational phrase `开始补参考。只形成确认，不执行生成。` was
initially routed as a generic status request. The canonical command worked, but
this qualifier sensitivity remains a product-language friction for a later UI
and intent-routing pass.

### Task 3: Review revision

The copied Review fixture first failed closed while its ledger and preview plan
still referenced the source fixture's absolute path. After both structured
identities were rebased to the isolated project, Review became actionable.

Observed path:

1. `需要修改` preserved the current result and opened modification discussion.
2. The creator specified that the paper plane should light within one second,
   the robot should look down then raise its eyes, and character/environment
   continuity should remain stable.
3. The Agent produced a Clarify turn with `按此修改` and `强化方向` choices.
4. `按此修改` produced a staged-only Proposal.
5. `确认重新生成提案` created a separate dry-run staged job and a new video
   confirmation.
6. Cold restart restored exactly that confirmation as the sole current task.

The new confirmation was not executed. The original `project.vibe` and both
candidate videos remained byte-identical. No Review approval, selection,
promotion, Delivery handoff, or export occurred.

## P1 defects fixed

### Passive intent could force work the creator deferred

After a plan-only story was saved, the passive project observation was passed
to `AgentCurrentTaskProjection` as though it were a fresh creator command. This
could reintroduce a reference-generation task. The projection now receives an
intent route only while the composer contains visible creator input, and the
structured execution scope can defer reference/video fallback steps to idle.

Checkpoint: `5618206 Harden P11-D packaged task projection`.

### Metadata readiness could hide a valid reference confirmation

The pipeline used `runtimeState.visualMemory.summary.missing`, which reported
zero for locked metadata-only references. The project observation independently
reported physically missing media. The pipeline therefore selected video work,
which did not match the restored reference staged plan and confirmation, and
the plan-only video boundary reduced the right rail to idle.

`referenceMissingCountForAgent` now consumes the structured current-project
`references.status === "missing"` observation unless a fact-bound execution
receipt already satisfies the reference step. This keeps the reference pipeline
step, staged plan, timeline confirmation, and right-rail card aligned.

## Evidence

Repository evidence:

- `docs/evidence/p11-d-real-use-observation-20260720/observation.json`
- `docs/evidence/p11-d-real-use-observation-20260720/task1-plan-only-cold-restore-pass.jpeg`
- `docs/evidence/p11-d-real-use-observation-20260720/task2-explicit-reference-confirmation-pass.jpeg`
- `docs/evidence/p11-d-real-use-observation-20260720/task3-review-clarify-proposal-confirmation-pass.jpeg`
- `docs/evidence/p11-d-real-use-observation-20260720/task3-review-confirmation-cold-restore-pass.jpeg`

Before-fix screenshots are retained in the same evidence directory so the P1
state transitions can be audited rather than inferred from the final UI.

## Product findings

1. The current-task projection is substantially clearer once it has one
   authoritative step. No evidence from these tasks justifies another broad
   layout or visual rewrite.
2. Intent qualifiers such as `只形成确认，不执行生成` are still too sensitive to
   exact phrasing. This is a routing/copy problem, not a need for more controls.
3. Review revision requires three decisions before the execution confirmation.
   The boundaries are correct, but the language should later be simplified so
   `Clarify`, `Proposal`, and `Confirmation` feel like one coherent Agent turn.
4. Waiting feedback was immediate for all local transitions. Provider waiting
   behavior was not observed in P11-D.

## Safety boundaries

- Provider calls: `0`
- Provider fees: `0`
- Pending reference/video confirmation executed: `false`
- Project-fact promotion: `false`
- Delivery/export: `false`
- Original source projects or media changed: `false`
- Visual redesign: not performed

## Verification

Passed:

- `npm run agent-current-task-projection:test`
- `npm run agent-director-turn-projection:test`
- `npm run agent-director-review-decision:test`
- `npm run agent-director-review-regeneration:test`
- `npm run project-agent-generation-job-ledger:test`
- `npm run project-agent-staged-plan-draft:test`
- `npm run project-agent-timeline:test`
- `npm run current-project-ui-closed-loop:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

## Gate

P11-D local packaged real-use observation PASS

The next product step should use this evidence to simplify intent wording and
the Review decision turn. It must not be described as real Provider usability
validation.

Real Provider execution NOT VERIFIED
