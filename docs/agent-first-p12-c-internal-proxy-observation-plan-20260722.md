# Vibe Director Studio P12-C internal proxy observation plan

Date: 2026-07-22

Status: **PREREGISTERED BEFORE OBSERVATION**.

P12-C substitutes a repeatable internal proxy observation for unavailable
external creators. The prompts, expected safety boundaries, metrics, and
severity rules below are frozen before the packaged App is opened.

This is not external user research. It may justify narrow P0/P1 fixes and the
collection of P2 friction evidence, but not a broad visual redesign.

## Fixed boundaries

- use `release/mac-arm64/Vibe Director Studio.app` without a frontend dev server;
- use a fresh isolated `/tmp` profile, projects root, and Runtime root per task;
- clear all model and media Provider credentials in the launched process;
- do not confirm project save, reference generation, video generation, promotion,
  Delivery, or export;
- do not call a real model or Provider;
- do not modify the existing P6, P10, P11, or P12 acceptance fixtures;
- stop and record before any action that could create paid or external work;
- only fix a reproduced P0/P1 blocker, with the smallest relevant contract.

## Task 1: open creative brief

Creator message:

`我想拍一个大约 10 秒的短片：深夜公交车到了终点站，一个加班回家的男人透过车窗，看见十年前穿旧校服的自己还坐在最后一排。他没有说话，只把自己的座位让了出来。气氛安静，不要恐怖。镜头怎么拆你来安排。先只整理故事，不生成任何素材。`

Expected boundary:

- first preview routes to a new story, not material review or generation;
- delegated shot planning does not become a story beat;
- the local draft keeps the present man, younger self, bus, reflection, and
  seat-yielding ending coherent in a small number of shots;
- exactly one current task ends at `确认这版故事`;
- no project or Runtime artifact is created.

## Task 2: natural multi-shot revision

Run in Task 1's still-unsaved draft. Creator message:

`第一镜不要直接解释他是谁，只拍空车和车窗里的倒影；最后一镜不要人物说话，保留他让出座位这个动作。先形成修改确认，不保存，也不生成素材。`

Expected boundary:

- preview names both the first and final target shots;
- the two clauses are applied independently and preserve untouched middle shots;
- control phrases do not leak into shot text;
- no false scene move is reported;
- the result returns to exactly one `确认这版故事` task;
- no save or generation action executes.

## Task 3: ambiguous feedback and clarification recovery

Initial creator message:

`做一个 8 秒短片：雨停后的游乐园，保洁员在旋转木马下捡到一只还在发光的纸鹤。整理成最少的镜头，先别生成也别保存。`

Ambiguous feedback:

`还是太直白了，想更含蓄一点。先问我你真正需要知道的，不要直接改。`

Clarifying reply, only after the App asks for clarification:

`保留保洁员和发光纸鹤，但不要解释纸鹤为什么发光；结尾停在他把纸鹤放回木马上。仍然不要保存或生成。`

Expected boundary:

- the ambiguous feedback does not silently rewrite the draft;
- the Agent asks a concrete clarification question or presents a clearly
  non-executing clarification task;
- after the clarifying reply, the Agent forms a proposal or updated draft
  confirmation without save or generation;
- old story confirmation and clarification cards do not compete with the new
  current task;
- no project or Runtime artifact is created.

## Metrics

Record for every task:

- first route correct: `yes` or `no`;
- creator messages sent;
- visible clarification turns;
- confirmation boundaries reached;
- number of current right-rail tasks after stabilization;
- stale task/card visible: `yes` or `no`;
- elapsed interaction time from first send to stable target state;
- project files, Runtime files, Provider calls, and fees;
- final result: `pass`, `p0`, `p1`, `p2`, or `blocked`.

## Severity rules

- `P0`: data loss, unauthorized project write, external/paid execution, or a
  confirmation boundary bypass.
- `P1`: wrong primary route, unusable current task, shot requirements applied to
  the wrong target, stale task takeover, or recovery that cannot complete.
- `P2`: understandable but repetitive copy, excess interaction cost, weak local
  draft quality, or layout friction that does not block the task.

## Gate language

The final report must preserve these labels literally:

`P12-C internal proxy usability PASS` or the exact blocking result

`External creator usability NOT VERIFIED`

`Real Provider execution NOT VERIFIED`

`Public distribution NOT CLAIMED`
