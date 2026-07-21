# Vibe Director Studio P12-C internal proxy observation acceptance

Date: 2026-07-22

Baseline: `47429fd Accept P12-B real creator observation`

Preregistered plan:
`docs/agent-first-p12-c-internal-proxy-observation-plan-20260722.md`

Plan SHA-256:
`d8369361519de2efdcedebeadcfa2124a2bd32269d5a1f5762f5068eff606b9c`

## Verdict

`P12-C internal proxy usability PASS`

This pass was reached after containing one P0 Provider-boundary breach and
fixing the reproduced P1 routing/recovery blockers. The final isolated reruns
used `VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS=1`, an isolated `HOME`, fresh
profile/projects/Runtime roots, and made zero model or media Provider calls.

This is a repeatable internal proxy observation, not external user research.

## Boundary incident

The first Task 1 process used fresh profile, projects, and Runtime roots but did
not isolate `HOME`. Runtime credential lookup therefore reached the normal
`~/.vibe-director/credentials.json` and made one DeepSeek director-text call.

- severity: `P0` under the preregistered external-execution rule;
- model: `deepseek-v4-pro`;
- transport: `chat_completions_stream`;
- result: `stop`;
- usage: 2,453 prompt + 1,385 completion = 3,838 total tokens;
- reasoning tokens: 696;
- media Provider calls: 0;
- retries: 0;
- fee: not reported; the call must be treated as potentially billable;
- raw API key stored in trace: `false`.

The remediation adds a process-level credential kill switch. When
`VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS=1`, all Provider key lookup returns no
credential even if the host profile contains one. A dedicated test is also
part of `package:smoke`. All later packaged reruns had zero Provider traces.

## Task results

| Task | Final result | Messages | Clarify | Stable task | Elapsed | Artifacts |
| --- | --- | ---: | ---: | --- | ---: | --- |
| Open brief | `P2` | 1 | 0 | `确认这版故事` | 23.2 s | 0 project / 0 Runtime |
| Multi-shot revision | `P2` | 1 | 0 | `确认这版故事` | 36.5 s | 0 project / 0 Runtime |
| Ambiguous feedback | `PASS` | 3 | 1 | `确认这版故事` | 38.4 s | 0 project / 0 Runtime |

Task 1 initially turned `镜头怎么拆你来安排` into a fourth story beat. The
parser now treats the phrase as delegated shot-planning metadata. The clean
rerun produced three story shots and one current confirmation task.

Task 2 correctly previewed and applied independent changes to the first and
final shots, preserving the middle shot. It returned to one confirmation task
without saving or generation.

Task 3 now completes this local path:

`1-shot draft -> Clarify (conversation_only) -> concrete freeform reply -> local tail-shot revision -> 确认这版故事`

The final shot action is `他把纸鹤放回木马上`. Clarify no longer competes with
the updated confirmation, and no project save or generation action executes.

## Fixed blockers

1. Added the Provider-call process lock and package-smoke coverage.
2. Removed delegated shot-planning and minimum-shot instructions from story beats.
3. Recognized explicit `先问我...不要直接改` as a real Clarify request.
4. Bound Clarify on a ready unsaved draft to `pending-new-video-draft`, not an old project shot.
5. Prevented the old clarification meta instruction from leaking into a freeform reply.
6. Mapped natural `结尾停在/定格在...` language to a deterministic tail-shot revision.

No color, layout, typography, density, card style, Provider adapter, Delivery,
promotion, or persistence architecture was changed.

## Remaining P2

- Task 1's local fallback still produced the weak atmosphere-only beat
  `气氛安静`.
- Task 2 preserved the requested meaning but left punctuation residue in its
  final-shot copy.
- These are understandable draft-quality/copy issues, not blockers or evidence
  for a broad UI redesign.

## Packaged launch

An earlier direct candidate was rejected by AMFI with error `-423`. GUI
observation therefore used a byte-equivalent `/tmp` copy after clearing xattrs
and applying local ad-hoc signing. The final rebuilt release candidate passed:

- `npm run packaged-launch-contract:test` against
  `release/mac-arm64/Vibe Director Studio.app`;
- `npm run package:smoke`, including a new build and direct launch contract.

This proves local ad-hoc packaged acceptance only. It is not Developer ID,
notarization, Gatekeeper distribution, or public release evidence.

## Verification

Passed:

- `npm run agent-director-clarification:test`
- `npm run director-ai-storyboard-planner:test`
- `npm run runtime-api-provider-call-lock:test`
- `npm run director-fresh-draft-intent:test`
- `npm run project-agent-workspace:test`
- `npm run new-video-start-contract:test`
- `npm run minimal-agent-p1:test`
- `npm run minimal-ui:test`
- `npm run packaged-launch-contract:test`
- `npm run package:smoke`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

Structured observation:
`docs/evidence/p12-c-internal-proxy-observation-20260722/packaged-observation.json`

Visual evidence: 11 JPEG files, each 1195 x 768, in
`docs/evidence/p12-c-internal-proxy-observation-20260722/`.

## Gate labels

`P12-C internal proxy usability PASS`

`External creator usability NOT VERIFIED`

`Real Provider execution NOT VERIFIED`

`Public distribution NOT CLAIMED`
