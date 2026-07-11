# Agent-first Headless Coverage Audit

Updated: 2026-07-02

Scope: behavior-layer coverage only. This audit did not start the dev server,
open the packaged App, run screenshots, change visual styling, or enter the
Product Design / ImageGen workflow.

## Coverage Matrix

| Main chain | Headless status | Evidence | Remaining packaged-App check |
| --- | --- | --- | --- |
| Send video | Covered | `scripts/director-agent-action-envelope-test.mts` checks bare `发送视频` does not become selected-shot edit and blocks on missing references. `scripts/project-agent-workspace-test.mts` checks video routes keep `video_submit` confirmation. `scripts/minimal-agent-p1-contract-test.mts` checks typed send-video preflight becomes current-story reference work before Send. | Verify the right rail shows current-story preflight, then enters `确认生成参考` rather than `确认修改` or video submit. |
| Start references | Covered | `scripts/director-agent-action-envelope-test.mts` checks `开始补参考` remains a reference action and requires confirmation. `scripts/project-agent-workspace-test.mts` checks `开始补参考` stays in the reference lane, including plan-only variants. | Verify image-service unavailable state disables the confirm button with clear help copy. |
| Confirm story | Covered | `scripts/new-video-start-contract-test.mts` checks the Agent command path can confirm the current draft. `scripts/minimal-agent-p1-contract-test.mts` and `scripts/minimal-ui-contract-test.mts` check the right rail previews `确认这版故事` without implying reference or video generation. | Verify a fresh two-shot draft confirms into the story flow and does not start reference or video work. |
| Choose save location | Covered | `scripts/minimal-agent-p1-contract-test.mts` and `scripts/minimal-ui-contract-test.mts` check save-location confirmations are scoped to the current story, say they only choose the story save location, and preserve the no-reference/no-video/no-export boundary. | Verify clicking `选择保存位置` opens only the folder chooser, then updates project state without generating references or video. |
| Export | Covered, strengthened this round | Existing Agent core/UI contract tests cover export dispatch, confirmation copy, result cards, and export focus. This round added `scripts/project-agent-workspace-test.mts` coverage for explicit `导出交付包` and `继续` from an active export confirmation, both preserving `export` confirmation. | Verify the export confirmation appears as the active right-rail task and confirmation writes only the local package/report. |
| Staged plan / timeline restore | Covered | `scripts/project-agent-staged-plan-draft-test.mts` checks restored staged-plan copy inherits storage-aware project labels and mismatches/cleared markers do not resurrect stale plans. `scripts/minimal-agent-p1-contract-test.mts` checks latest visible timeline confirmations outrank generated direct actions and stale confirmations are filtered. | Verify an app restart or project reopen restores only the current active confirmation and does not surface stale reference/save/export cards. |
| Right Agent main-task priority | Covered by contract, needs real UI pass | `scripts/minimal-agent-p1-contract-test.mts` checks typed previews hide passive project-ready state, visible confirmations lock work-mode copy, export focus pins the export confirmation, and old confirmations/results do not steal focus. | Verify one visible main task at a time while moving through new video, save location, references, video, and export. |

## Gap Closed This Round

- Added route-level assertions in `scripts/project-agent-workspace-test.mts`:
  - explicit `导出交付包` routes to `kind: "export"` and `confirmation: "export"`;
  - `没问题，继续` follows an active export confirmation instead of becoming selected-shot revision.

No production logic was changed for this coverage gap because the existing route
implementation already satisfied the expected behavior.

## Packaged App Verification Checklist

Run this only after a separate Computer Use readiness check succeeds. Do not use
the old oversized Codex thread.

1. Start packaged App with a fresh profile, projects root, runtime workdir, and
   binding path.
2. Enter a fresh two-shot story request with explicit no-reference/no-video
   wording.
3. Confirm the draft with `确认这版故事`.
4. Choose a temporary save location.
5. Confirm the saved story shows two shots, missing references, and no video.
6. Type `发送视频` while a shot is selected.
7. Verify the right rail previews current-story reference preflight:
   `当前故事`, `先补参考`, `参考不完整`.
8. Send the message and verify the active confirmation is `确认生成参考`, not
   `确认修改` or `确认提交视频`.
9. With image service disconnected, verify the confirm action is disabled and
   explains the missing image service.
10. After references are usable or mocked as usable, verify video submit still
    requires `确认提交视频`.
11. Verify export appears as a separate `导出交付包` confirmation and does not
    run from a side-channel button.
12. Restart or reopen the project and verify only the current active
    confirmation restores.

## Deferred UI Work

The following remain future Product Design / ImageGen work after real packaged
App behavior is verified:

- right Agent panel visual layout;
- card style, colors, typography, density, shadows, and rounded corners;
- Skills visual treatment;
- asset library visual presentation;
- alternate visual directions and image-to-code implementation.
