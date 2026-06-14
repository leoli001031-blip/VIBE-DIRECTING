# Claude Code AI大小姐测试反哺

Date: 2026-06-13

Source project: local Claude Code test folder `AI大小姐们想让我告白`

Extracted dialogue index:
`claude_code_dialogue_index_20260613.md`

## What Was Verified

The Claude Code test successfully turned the Vibe Director idea into a folder-native production workflow.

It did not only produce prompts. It created a project operating system:

- `CLAUDE.md` as project memory and operating manual.
- `story/storyboard_skill.md` as a reusable anime storyboard skill.
- `story/prompt_template.md` as the strategy compiler for `omni_reference`, `storyboard_narrative`, and `storyboard_rapid_cut`.
- `人设/<character>/` as character packets with visual identity and voice reference.
- `assets/scenes/` and `assets/style/` as reusable scene/style anchors.
- `outputs/**` as real production output, including image boards, dialogue, video, receipts, and retries.
- shell scripts and logs as ad hoc queue runners for Seedance.

This proves the core direction is right: the differentiator is not "storyboard mode" alone. The differentiator is a skill-driven director agent that can decide how a scene should be expressed and manage the whole production folder.

## Strong Product Signal

The user repeatedly moved from single-shot generation toward long-form project management:

- characters need stable visual and voice packets;
- scenes and weather need reusable baselines;
- storyboards are sometimes needed, sometimes harmful;
- Seedance must be serial and recoverable;
- failures and retries are part of production, not exceptions;
- the project must remember decisions across multiple days and episodes.

Claude Code handled this because it can operate the filesystem directly. Vibe Director should productize that ability instead of exposing raw files, shell scripts, and hidden transcript state.

## What Claude Code Did Well

1. Project-local memory

`CLAUDE.md` acted as a durable handoff document. It contained project structure, providers, CLI usage, character matrix, style rules, and current progress.

2. Skill as command

`.claude/commands/storyboard.md` made `/storyboard` a repeatable workflow. It required reading `story/storyboard_skill.md`, choosing shot grammar, and explicitly citing which skill rules were used.

3. Asset packets

Each character had a folder-level identity and voice reference. This is much closer to real short-drama production than one-off uploads.

4. Long project shape

The project naturally became:

`Project -> Episode -> Scene -> Shot group -> Shot -> Asset/Prompt/Video result`

This is the hierarchy Vibe Director needs for longer work.

5. Real queue learning

The Seedance logs show actual constraints: concurrency failures, long polling, downloaded paths, credit counts, queue debug data, and retry versions.

## What Was Still Messy

1. State is scattered

Important state exists in many places: transcript JSONL, `CLAUDE.md`, shell scripts, filenames, logs, output folders, and manual user memory. A user cannot easily answer "what is done, what failed, what is next?"

2. Queue is not first-class

Claude used scripts and logs to serialize Seedance, but the queue is not a visible product object. Vibe Director already has the right direction here, but should make video jobs, submit ids, result paths, and next relay state one clear panel.

3. Skills are not inspectable enough

The skill files are powerful, but hidden. In Vibe Director, skills should be visible as cards: when they trigger, what they output, and what they forbid.

4. Conversation is not converted into receipts

Many user decisions and retries live only in the transcript. Vibe Director should extract decisions like "use this voice", "retry s07d", "this mode is wrong", or "submit next clip" into project receipts.

5. Long-project hierarchy is missing from the UI

Vibe Director currently works better for small demo projects than for a multi-episode drama. The Claude project shows that long projects need episode/scene grouping and reusable asset libraries.

## Recommended Development Direction

### P0: Import Existing Production Folder

Add a read-only importer for folders like `AI大小姐们想让我告白`.

Inputs:

- `CLAUDE.md`
- `project.json`
- `production_bible.json`
- `story/**`
- `人设/**`
- `assets/**`
- `outputs/**`
- Seedance logs

Output:

- a staged Project.vibe draft;
- detected characters, scenes, props, voices;
- detected storyboards and videos;
- unresolved warnings.

### P1: Conversation To Receipts

Parse Claude Code JSONL and extract:

- user decisions;
- generated/edited files;
- submit ids;
- queue status;
- failed/retried clips;
- prompt versions;
- asset binding changes.

Do not show raw transcript by default. Show a concise project activity timeline.

### P2: Skill Cards

Visualize internal skills as creator-facing cards:

- `storyboard_narrative`
- `storyboard_rapid_cut`
- `omni_reference`
- `anime_storyboard`
- `seedance_video_queue`
- `voice_reference`

Each card should show:

- when the agent uses it;
- what assets it needs;
- what it produces;
- common failure cases.

### P3: Long Project Mode

Add explicit hierarchy:

- Project
- Season/Episode
- Scene
- Shot Group
- Clip

Short projects can hide this hierarchy. Long projects need it.

### P4: First-Class Video Queue

Move from hidden queue logs to one canonical runtime model:

- queued;
- submitted;
- polling;
- done;
- failed;
- needs retry;
- downloaded;
- linked to clip.

### P5: Folder-Aware Agent Permissions

Let the agent operate like Claude Code, but with product boundaries:

- plan only;
- scan/import files;
- generate references;
- edit Project.vibe;
- submit video;
- export final package.

Each level should be clear and reversible.

## Product Positioning Takeaway

The strongest differentiator is:

Vibe Director is not just an AI video generator. It is a skill-based video project agent that teaches the model how to direct, storyboard, pace, reuse assets, manage queues, and keep long creative projects coherent.

Claude Code proves the need. Vibe Director should make that workflow visible, safer, and easier for non-technical creators.
