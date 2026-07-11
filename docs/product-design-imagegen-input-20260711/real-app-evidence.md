# Real Packaged App Evidence

## Verification Environment

- App: `release/mac-arm64/Vibe Director Studio.app`
- Final fresh root: `/tmp/vibe-director-p4-gui-r3-uLCyaD`
- Final project: `/private/tmp/vibe-director-p4-gui-r3-uLCyaD/projects/p4-agent-first-final`
- Frontend dev server: not used
- Provider credentials: absent in isolated `HOME`
- Real image/video provider calls: none
- Local export: executed after explicit confirmation

## Main Chain

| Evidence | Observed result | Status |
| --- | --- | --- |
| `01-story-confirmation.png` | Two-shot draft and one active “确认这版故事” card | Pass |
| `02-save-location-confirmation.png` | Story remains two shots; current task becomes save-location selection | Pass |
| `03-story-saved.png` | Canonical local project connected; reference missing 2; video ungenerated | Pass |
| `12-reference-dry-run-confirmation.png` | Before confirmation, card explicitly says local validation, no provider, no real reference | Pass |
| `05-reference-dry-run-complete.png` | Receipt reports dry-run, provider not called, zero outputs | Pass |
| `13-video-dry-run-confirmation.png` | Before confirmation, card explicitly says local validation, no provider, no video submit | Pass |
| `08-video-dry-run-complete.png` | Receipt reports dry-run, provider not called, zero outputs | Pass |
| `09-export-confirmation.png` | Delivery remains behind explicit confirmation | Pass |
| `10-export-complete.png` | Local export completed with one output manifest and 12 package files | Pass |
| `11-cold-start-restored.png` | Two shots restored; references still missing; video still ungenerated; no stale card owns current task | Pass |

## Diagnostic Evidence

- `06-video-confirmation-blocker.png` records the pre-fix failure where raw missing-reference facts downgraded the video action.
- `07-video-confirmation-after-fix.png` records the first successful video confirmation after reference-count state propagation was fixed.
- `04-reference-confirmation.png` records the earlier misleading pre-confirmation external-service copy. It is superseded by `12-reference-dry-run-confirmation.png`.

## Persisted Truth

- Reference receipt: `dry_run`, `providerCalled=false`, `outputAssets=[]`, status `validated`, fact hash `pv_ef02535e`.
- Video receipt: `dry_run`, `providerCalled=false`, `outputAssets=[]`, status `validated`, fact hash `pv_2401af36`.
- Export receipt: `live`, `providerCalled=false`, output `exports/current-project/export_manifest.json`, status `succeeded`, fact hash `pv_2401af36`.
- Staged plan after completion: `cleared`.
- Cold-start current task: `idle / 等你指令`; terminal jobs and old confirmations remain history only.
