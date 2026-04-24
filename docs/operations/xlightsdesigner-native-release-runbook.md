# Native Release Validation Runbook

Status: Active
Date: 2026-04-24
Owner: xLightsDesigner maintainers

## Purpose

Define the local evidence required before treating the native macOS app and owned xLights API path as release-quality for the current app completion workstream.

This runbook replaces the retired Electron release path for current validation. The old desktop runbook remains historical only.

## Runtime Boundaries

- Native app source: `apps/xlightsdesigner-macos`
- Native automation server: `http://127.0.0.1:49916`
- Owned xLights API source: `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner`
- Owned xLights API endpoint: `http://127.0.0.1:49915/xlightsdesigner/api`
- Installed `/Applications/xLights.app` is not valid for owned API validation unless it has been replaced by an API-enabled build.

## Required Evidence

1. Native package tests

```bash
swift test --package-path apps/xlightsdesigner-macos
```

Required result:
- all package tests pass
- backup/restore and xLights session recovery tests are included in the passing run

2. Owned show-folder validation

Launch the API-enabled xLights 2026.06 build with the active show folder trusted:

```bash
XLIGHTS_DESIGNER_TRUSTED_ROOTS="/Users/robterry/Documents/Lights/Current/Christmas/Show" \
node scripts/xlights/launch-owned-xlights.mjs -o
```

Run isolated owned API validation:

```bash
node scripts/xlights/validate-owned-show-folder-flow.mjs \
  --show-dir "/Users/robterry/Documents/Lights/Current/Christmas/Show"
```

Required result:
- validation writes only under `_xlightsdesigner_api_validation/<run-id>/`
- `/health`, `/layout/models`, `/layout/scene`, `/sequence/create`, `/sequencing/apply-batch-plan`, `/sequence/render-current`, `/sequence/save`, and `/jobs/get` succeed
- the expected `.fseq` exists next to the isolated validation `.xsq`
- the JSON evidence file is recorded in the native evidence log

3. Native automation smoke

With the native app running:

```bash
node scripts/native/automation.mjs ping
node scripts/native/automation.mjs get-app-snapshot
node scripts/native/automation.mjs get-xlights-session
```

Required result:
- native automation server responds
- app snapshot reflects the current workflow state
- xLights session snapshot is either connected/actionable or explicitly unreachable with refresh still available

4. Sequencer retained validation

Use the current sequence-agent retained gate command for the touched surface. Record the command and result in the evidence log.

Required result:
- retained validation remains green for the active proof-loop and sequencing contract surfaces

## Manual Smoke

Use the native app to complete the smallest real workflow that exercises the current local app path:
- open or create a project
- confirm xLights session state
- save native design intent
- generate a sequence proposal
- inspect Review preview
- apply through the owned API
- confirm backup path is shown
- restore the last backup when validating destructive recovery behavior
- inspect History proof-chain output

Required result:
- failures are visible and recoverable
- apply is blocked when canonical proposal or xLights preconditions are missing
- no validation step writes into existing show subfolders unless explicitly selected by the user

## Evidence Recording

Append each completed run to:

- `docs/operations/xlightsdesigner-native-validation-evidence-log.md`

Every row should include:
- date
- commit SHA
- machine
- macOS version
- xLights source/build
- native package test result
- owned API validation evidence path
- native automation smoke result
- sequencer retained validation result
- notes or blockers
