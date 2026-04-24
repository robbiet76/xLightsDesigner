# Native Validation Evidence Log

Status: Active
Date: 2026-04-24
Owner: xLightsDesigner maintainers

## Purpose

Record current native macOS app and owned xLights API validation evidence.

Historical Electron evidence belongs in `xlightsdesigner-desktop-validation-evidence-log.md` and must not be used as current release evidence.

## Evidence Rows

| Date | Commit | Machine | macOS | xLights Source/Build | Native Tests | Owned API Evidence | Native Automation | Sequencer Retained Gate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-24 | `3236270c` | local dev workspace | macOS test target `arm64e-apple-macos14.0` | `/Users/robterry/xLights-2026.06`, branch `xld-2026.06-migration` | PASS, `swift test --package-path apps/xlightsdesigner-macos`, 34 tests | PASS, `/Users/robterry/Documents/Lights/Current/Christmas/Show/_xlightsdesigner_api_validation/2026-04-24T01-13-58-788Z/owned-api-validation-result.json` | Not rerun in this row | PASS, Gate A retained sequence-agent validation `111/111` | Documents current native release-gate evidence after backup/restore, session recovery, proof-loop memory, and release-gate traceability cleanup. |

## How To Add Evidence

Use `docs/operations/xlightsdesigner-native-release-runbook.md` for the validation procedure, then append a row above with the exact command results and artifact paths.

Rows should reference isolated validation artifacts, not existing user sequence subfolders.
