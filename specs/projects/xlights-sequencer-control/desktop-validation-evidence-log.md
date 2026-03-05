# Desktop Validation Evidence Log

Purpose: record concrete execution evidence for final M4 acceptance closure.

## Evidence Rows
| Date | Build SHA | Channel | Machine | macOS | xLights | Install/Launch | Core Flow | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

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
