# P4 Acceptance Matrix

| Requirement | Result | Evidence |
| --- | --- | --- |
| Fresh `/tmp` packaged App main chain | Pass | Real packaged run `r3`; evidence 01-13 |
| Confirm story preserves two shots | Pass | `01`, `02`, `03` |
| Save-location action has no generation/export side effects | Pass | `02`, `03`; canonical project binding |
| Reference confirmation and execution truth | Pass | `12`, `05`; dry-run receipt with zero outputs |
| Video confirmation and execution truth | Pass | `13`, `08`; dry-run receipt with zero outputs |
| Export confirmation before write | Pass | `09`, `10`; local export receipt |
| Cold-start recovery and stale-task filtering | Pass | `11`; cleared staged plan |
| Arbitrary-directory and symlink escape protection | Pass | `electron-project-scope:test`, `runtime-api-boundary:test` |
| IPC sender and navigation restrictions | Pass | `electron-security-policy:test`, packaged source contract |
| Random Runtime API token | Pass | `electron-runtime-token:test`, `packaged-launch-contract:test` |
| Dependency audit | Pass | `npm audit`: 0 vulnerabilities after non-force patch upgrades |
| Application icon | Pass | `build/icon.svg`, `build/icon.icns`, packaged hash match |
| Full headless regression | Pass | `npm run demo:ready:test` |
| Packaged launch regression | Pass | `npm run package:smoke` |
| Packaged GUI regression | Pass | `npm run package:smoke:gui` |
| TypeScript and diff hygiene | Pass | `npx tsc --noEmit --pretty false`, `git diff --check` |
| Release pipeline contract | Pass | Explicit hardened runtime/entitlements/notarization plus `package:release:contract:test` |
| Ad-hoc package structural signature | Pass | `codesign --verify --deep --strict` |
| Local DMG structure and enclosed App | Pass | `hdiutil verify`, read-only mount, enclosed App deep-signature check |
| Developer ID Application signature | Deferred (out of scope) | Product owner waived public-distribution signing for the local-only phase |
| Apple notarization and stapling | Deferred (out of scope) | No public-distribution requirement in the current phase |
| Gatekeeper distribution acceptance | Deferred (out of scope) | Current ad-hoc package is for local packaged-App validation only |

## Release Decision

On 2026-07-11, the product owner explicitly waived the distribution-signing gate
for the local-only product phase. P4 therefore passes under the current scope,
and Product Design / ImageGen implementation may proceed. Developer ID signing,
notarization, stapling, and Gatekeeper acceptance remain optional future work if
public macOS distribution is introduced.
