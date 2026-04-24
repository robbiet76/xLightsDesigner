# Desktop Validation Evidence Log (Retired Electron Path)

Purpose: preserve historical evidence for the retired Electron packaging path.

Status:
- historical only
- do not add new rows for `/Applications/xLightsDesigner.app`
- active native validation now runs through the macOS app and native automation server
- use `docs/operations/xlightsdesigner-native-validation-evidence-log.md` for current evidence

## Evidence Rows
| Date | Build SHA | Channel | Machine | macOS | xLights | Install/Launch | Core Flow | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-03-05 | c624259 | preview | MacBookAir-M2 | 15.7.4 | 2026.03.1 | PASS | PASS | dist/mac-arm64 + validate-nondev-install PASS | local non-dev install validation |
| 2026-03-07 | 4538f8d | preview | dev-workspace | N/A | N/A | N/A | N/A | `node --check` ui/desktop + `test:agent-ui` (9/9 pass) | Sprint 4 rollout gating + diagnostics hardening (code-level evidence) |
| 2026-03-07 | 46c3b1d | preview | Terry-MacBook-Air.local | 15.7.4 | N/A | PASS | FAIL | validate-nondev-install.sh /Applications/xLightsDesigner.app PASS | Packaged app launch verified; full live xLights core flow pending manual run |

## How To Add Evidence
Historical only.

Use:
- `scripts/desktop/record-validation-evidence.sh`

Example:
```bash
scripts/desktop/record-validation-evidence.sh \
  --build 0f012a1 \
  --channel preview \
  --machine "MacBookAir-M2" \
  --macos "15.7.4" \
  --xlights "2026.03.1" \
  --install PASS \
  --core PASS \
  --evidence "diag:/path/to/diag.json" \
  --notes "non-dev install + full flow complete"
```

## Readiness Check
Historical only.

Use:
- `scripts/desktop/check-desktop-readiness.sh`

This check passes when at least one evidence row has both:
- `Install/Launch = PASS`
- `Core Flow = PASS`

## Agent Rollout Evidence (Sprint 4)
Use this checklist for agent rollout hardening evidence per build:
- [ ] `Agent Apply Rollout Mode = full` verified (apply allowed when other guards pass)
- [ ] `Agent Apply Rollout Mode = plan-only` verified (apply blocked, planning available)
- [ ] `Agent Apply Rollout Mode = disabled` verified (apply blocked by rollout policy)
- [ ] Diagnostics export contains `agentRun` section + `applyHistory`
- [ ] Diagnostics panel shows recent apply history entries

Manual packaged-app smoke for `/Applications/xLightsDesigner.app` is retired.
