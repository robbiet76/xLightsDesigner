# Native Validation Evidence Log

Status: Active
Date: 2026-04-24
Owner: xLightsDesigner maintainers

## Purpose

Record current native macOS app and owned xLights API validation evidence.

Historical Electron evidence belongs in `xlightsdesigner-desktop-validation-evidence-log.md` and must not be used as current release evidence.

Rows targeting `/Users/robterry/Documents/Lights/Current` predate the workspace-boundary correction. They remain as historical owned-API proofs only; current linked-show validation must target `/Users/robterry/Desktop/Show`, while app-owned project metadata stays under `/Users/robterry/Documents/Lights/xLightsDesigner`.

## Evidence Rows

| Date | Commit | Machine | macOS | xLights Source/Build | Native Tests | Owned API Evidence | Native Automation | Sequencer Retained Gate | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-24 | this commit | local dev workspace | macOS 15.7.4 (`24G517`), test target `arm64e-apple-macos14.0` | `/Users/robterry/xLights-2026.06`, DerivedData debug build launched with `--show-dir "/Users/robterry/Desktop/Show" -o` | PASS, `swift test --package-path apps/xlightsdesigner-macos`, 35 tests | PASS, `/Users/robterry/Desktop/Show/_xlightsdesigner_api_validation/2026-04-24T14-56-58-885Z/owned-api-validation-result.json` | PASS, `open-project`, `refresh-xlights-session`, and `get-app-snapshot` confirmed `showDirectory` `/Users/robterry/Desktop/Show` and `projectShowMatches: true` | Not rerun in this row | Corrected validation target to the linked development xLights show folder. App project metadata remains under `/Users/robterry/Documents/Lights/xLightsDesigner`; `/Users/robterry/Documents/Lights/Current` is read-only reference material only. |
| 2026-04-24 | `f5c70f70` | local dev workspace | macOS 15.7.4 (`24G517`), test target `arm64e-apple-macos14.0` | `/Users/robterry/xLights-2026.06`, DerivedData debug build launched with `--show-dir "/Users/robterry/Documents/Lights/Current/Christmas/Show" -o` | PASS, `swift test --package-path apps/xlightsdesigner-macos`, 34 tests | PASS, `/Users/robterry/Documents/Lights/Current/Christmas/Show/_xlightsdesigner_api_validation/2026-04-24T14-32-23-391Z/owned-api-validation-result.json` | PASS, `node scripts/native/automation.mjs ping` and `get-xlights-session` returned reachable xLights session snapshots | Not rerun in this row | Fresh owned validation now proves `/media/current` show folder matches `--show-dir` before writes; target model auto-selected `AllModels`; native project still points at a different project show folder, so `projectShowMatches` remains a useful app-level diagnostic. |
| 2026-04-24 | `d5ca5a06` | local dev workspace | macOS test target `arm64e-apple-macos14.0` | `/Users/robterry/xLights-2026.06`, DerivedData debug build launched with `-o` | PASS, `swift test --package-path apps/xlightsdesigner-macos`, 34 tests | PASS, `/Users/robterry/Documents/Lights/Current/Christmas/Show/_xlightsdesigner_api_validation/2026-04-24T13-27-16-772Z/owned-api-validation-result.json` | PASS, `node scripts/native/automation.mjs ping`, `get-app-snapshot`, and `get-xlights-session` returned app/session snapshots | PASS, Gate A retained sequence-agent validation `111/111` | Fresh owned validation wrote isolated `.xsq` and `.fseq`; launch helper now recognizes `-o` xLights process args. |
| 2026-04-24 | `3236270c` | local dev workspace | macOS test target `arm64e-apple-macos14.0` | `/Users/robterry/xLights-2026.06`, branch `xld-2026.06-migration` | PASS, `swift test --package-path apps/xlightsdesigner-macos`, 34 tests | PASS, `/Users/robterry/Documents/Lights/Current/Christmas/Show/_xlightsdesigner_api_validation/2026-04-24T01-13-58-788Z/owned-api-validation-result.json` | Not rerun in this row | PASS, Gate A retained sequence-agent validation `111/111` | Documents current native release-gate evidence after backup/restore, session recovery, proof-loop memory, and release-gate traceability cleanup. |

## How To Add Evidence

Use `docs/operations/xlightsdesigner-native-release-runbook.md` for the validation procedure, then append a row above with the exact command results and artifact paths.

Rows should reference isolated validation artifacts, not existing user sequence subfolders.
