# Vibe Director Studio P12-B real creator observation

Date: 2026-07-21

Status: **PASS FOR LOCAL PACKAGED CREATOR OBSERVATION**.

P12-B used Computer Use against the packaged App to exercise two less-scripted
creator conversations: an explicit three-shot draft with a multi-shot revision,
and an open-ended story where the Agent chose the minimum shot count. Three P1
behavioral blockers were reproduced, fixed with narrow parser/routing changes,
and rerun through the packaged App.

This was local operator observation. It was not external creator research, a
real Provider run, a project save, project-fact promotion, or Delivery export.

## Scope and boundaries

- App: `release/mac-arm64/Vibe Director Studio.app`
- interaction surface: packaged App through Computer Use
- frontend dev server: not started
- Provider calls: `0`
- Provider fees: `0`
- generation confirmations executed: `false`
- project saved: `false`
- project-fact promotion: `false`
- Delivery/export: `false`
- visual redesign: not performed

The scenarios used isolated `/tmp` profile, projects, and Runtime roots. A final
filesystem audit found no files under either scenario's projects or Runtime
roots.

## Scenario A: explicit three-shot revision

Initial creator message:

`我要拍一个 9 秒短片：凌晨自助洗衣店，女孩把一枚旧纽扣放进玻璃罐，滚筒停下时罐里映出星空。整理成 3 个镜头。先只整理草案，不生成参考，不提交视频。`

The packaged App produced three local draft shots and extracted `玻璃罐、旧纽扣`
as props. The creator then entered:

`第二个镜头不要拍女孩正面，改成玻璃罐和旧纽扣的近景；第三个镜头只保留星空倒影，不要重复第二个镜头。先形成修改确认，不要保存，不生成素材。`

### Reproduced P1 blocker

The first implementation treated the input as one targeted revision. The later
shot clause and workflow controls could leak into the earlier shot, and generic
`改成` language could be reported as a scene move.

### Packaged result after fix

- preview target: `修改第 2、3 镜`
- shot 1: unchanged
- shot 2: only `玻璃罐和旧纽扣的近景`
- shot 3: only `星空倒影`
- workflow and repetition-control clauses: absent from shot content
- Agent completion copy: explicitly reports separate changes to shots 2 and 3
- current task: exactly one `确认这版故事`
- save, generation, Provider submission, and export: not executed

Result: **PASS after P1 fix**.

## Scenario B: open-ended minimum shot count

Creator message:

`我想拍一个克制、安静的 8 秒短片：夜班护士在医院天台听到坏掉收音机里传来海浪声，最后她笑了一下。你来决定最少需要几个镜头。先只讨论和整理，不生成任何素材。`

### Reproduced P1 blockers

1. The negative boundary `不生成任何素材` matched the positive material-workspace
   route and previewed `整理素材 / 补参考`.
2. The planning instruction `你来决定最少需要几个镜头` became a third story
   beat in the deterministic fallback.

### Packaged result after fix

- preview route: `整理新故事`
- deterministic fallback: 2 shots
- shot 1: the night nurse hears ocean waves from the broken radio on the roof
- shot 2: she smiles
- meta planning instruction: absent from story shots
- extracted prop: `坏掉的收音机`
- current task: exactly one `确认这版故事`
- save, generation, Provider submission, and export: not executed

Result: **PASS after P1 fix**.

## Root causes and minimal changes

1. Multi-target revision parsing had only a single-shot fallback. Explicit shot
   markers are now split into ordered clauses, applied sequentially, and
   summarized as one structured multi-shot proposal.
2. Material-workspace detection did not remove negative material boundaries
   before looking for positive review intent. The shared route helper now does.
3. Creative planning separation did not classify creator-delegated shot-count
   language as a directive. It now removes that meta instruction while keeping
   the actual story and ending.
4. The local prop vocabulary now recognizes the concrete props used in these
   scenarios.

No Agent architecture, persistence contract, Provider adapter, Delivery path,
or visual styling was changed.

## Evidence

- `docs/evidence/p12-b-real-creator-observation-20260721/packaged-observation.json`
- `docs/evidence/p12-b-real-creator-observation-20260721/01-explicit-three-shot-draft.png`
  - before fix; SHA-256: `6ba10b920a2104fcefcd508259c56e616c79f54b3bbfeaa9a8a640c6b5f72b34`
- `docs/evidence/p12-b-real-creator-observation-20260721/02-pending-draft-multi-shot-revision-bug.png`
  - reproduced blocker; SHA-256: `1760181fa8aa7bf975dc56d2cd5312c9c5ce400f828637ecc9431ba72d400115`
- `docs/evidence/p12-b-real-creator-observation-20260721/03-multi-shot-revision-preview-fixed.png`
  - fixed preview; SHA-256: `ddcd12d62ef75d5b26e4fb1fe0e95f211c877e0740fa36c8d2d38040fac2d188`
- `docs/evidence/p12-b-real-creator-observation-20260721/04-multi-shot-revision-applied-fixed.png`
  - fixed applied draft; SHA-256: `7b9714a244f59632e19553dbb31e69b87de41c2bd794e4992008cd8839c63ba6`
- `docs/evidence/p12-b-real-creator-observation-20260721/05-open-ended-story-preview-fixed.png`
  - fixed route; SHA-256: `80fd7e6cc3ac31ff40acfbaa9e619f5510772b222f9340e898a4a823d4fa8b95`
- `docs/evidence/p12-b-real-creator-observation-20260721/06-open-ended-meta-shot-bug.png`
  - reproduced blocker; SHA-256: `2fb41ecbbf2c8b333704933ae3b720c0cc7a6f9c2cdedbcc3030782576547e85`
- `docs/evidence/p12-b-real-creator-observation-20260721/07-open-ended-two-shot-draft-fixed.png`
  - fixed two-shot draft; SHA-256: `bb98cb65943ac821a9e97b3fe03b9e6aca9f8eb0eb4e48e30f0e170d04f15cd9`

All screenshots are `1195 x 768`.

## Verification

Passed before this acceptance record was finalized:

- `npm run director-ai-storyboard-planner:test`
- `npm run director-fresh-draft-intent:test`
- `npm run project-agent-workspace:test`
- `npm run new-video-start-contract:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npx tsc --noEmit --pretty false`
- `git diff --check`
- `npm run package:smoke`
- `npm run package:dir`
- `npm run packaged-launch-contract:test`
- packaged Computer Use rerun for both scenarios
- projects/Runtime side-effect audit

## Residual observations

No P0 or P1 blocker remains from these two scenarios.

P2 observations retained for later evidence-based simplification:

- the initial deterministic three-shot fallback repeats the ending before the
  creator's revision;
- character extraction can list both `护士` and `夜班护士` for one role;
- this operator observation does not yet show how an external creator interprets
  the same confirmation and revision flow.

These do not justify a visual rewrite by themselves. The next useful step is a
small external creator observation or internal Beta trial using the same
instrumented boundaries, followed by one evidence-based UI simplification pass.

## Gate

P12-B local packaged creator observation PASS

Real Provider execution NOT VERIFIED

External creator usability NOT YET OBSERVED

Public distribution NOT CLAIMED
