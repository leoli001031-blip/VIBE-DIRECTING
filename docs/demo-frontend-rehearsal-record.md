# Demo Frontend Rehearsal Record

Updated: 2026-06-22

Use this file to record the observable front-end rehearsal for the Agent-first
demo. The goal is to prove the app behavior from the creator surface, not only
from source-code contract tests.

## Required Evidence

Every full rehearsal should record:

- Date and operator.
- App URL.
- Project folder or browser project id.
- Whether the app is a fresh project or an existing project.
- The exact idea or instruction sent to the right Agent composer.
- Whether the composer cleared after sending.
- Whether one visible `发送` button stayed present.
- Which permission mode was visible: `先整理`, `可补参考`, or `可发视频`.
- Which shot, material, voice, or video segment was clicked.
- Whether the composer footer showed `这句话会引用：...`.
- Whether the Agent message flow explained understanding, confirmation boundary,
  execution result, and next step.
- Whether reference results appeared in the center workbench and were summarized
  in the right message flow.
- Whether video submit/query state showed submit id, queue/running/returned
  state, and local video path when available.
- Whether the preview and export pages explained what is ready, missing, and
  where the package will be written.
- Any visible blocker, stale copy, overlap, missing button, or confusing state.

## Current Record

### 2026-06-22 Codex In-App Browser Attempt

- App URL: `http://127.0.0.1:5174/`.
- Result: not completed.
- Blocker: the Codex in-app browser rejected read access to the localhost page
  through the Browser Use URL policy.
- Important boundary: do not work around this with raw CDP, alternate browser
  surfaces, or indirect browser execution. Re-run the rehearsal when a permitted
  browser or visible app-control surface is available.
- Engineering gates still passed in this environment:
  - `npm run demo:goal-audit:test`
  - `npm run showcase-package-audit:test`
  - `npm run demo:ready:test`
  - `npm run current-project-ui-closed-loop:test`
  - `npm run current-project-preview-ui-runtime-closed-loop:test`
  - `npm run director-skill-library:test`
  - `npx tsc --noEmit --pretty false`
  - `git diff --check`

## Template

```text
Date:
Operator:
App URL:
Project:
Fresh or existing:

Idea sent:
Composer cleared after send: yes/no
Visible send button stayed present: yes/no
Visible permission mode:

Selected target:
Composer reference cue:
Agent explained understanding:
Agent explained confirmation boundary:
Agent explained execution result:
Agent explained next step:

References visible in center:
References summarized in right rail:
Video state visible:
Preview page clear:
Export page clear:

Problems found:
Fixes made:
Gates rerun:
Remaining blockers:
```
