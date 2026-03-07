# Desktop Validation Evidence Log

Purpose: record concrete execution evidence for final M4 acceptance closure.

## Evidence Rows
| Date | Build SHA | Channel | Machine | macOS | xLights | Install/Launch | Core Flow | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-03-07 | 4538f8d | preview | dev-workspace | N/A | N/A | N/A | N/A | `node --check` ui/desktop + `test:agent-ui` (9/9 pass) | Sprint 4 rollout gating + diagnostics hardening (code-level evidence) |

## How To Add Evidence
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
Use:
- `scripts/desktop/check-desktop-readiness.sh`

This check passes when at least one evidence row has both:
- `Install/Launch = PASS`
- `Core Flow = PASS`
| 2026-03-05 | c624259 | preview | MacBookAir-M2 | 15.7.4 | 2026.03.1 | PASS | PASS | dist/mac-arm64 + validate-nondev-install PASS | local non-dev install validation |

## Agent Rollout Evidence (Sprint 4)
Use this checklist for agent rollout hardening evidence per build:
- [ ] `Agent Apply Rollout Mode = full` verified (apply allowed when other guards pass)
- [ ] `Agent Apply Rollout Mode = plan-only` verified (apply blocked, planning available)
- [ ] `Agent Apply Rollout Mode = disabled` verified (apply blocked by rollout policy)
- [ ] Diagnostics export contains `agentRun` section + `applyHistory`
- [ ] Diagnostics panel shows recent apply history entries

Manual packaged-app smoke still required for stable-channel promotion:
- Launch packaged desktop app artifact from current candidate build
- Execute the five rollout checklist items above in a live xLights session
- Record PASS/PASS row via `scripts/desktop/record-validation-evidence.sh`
