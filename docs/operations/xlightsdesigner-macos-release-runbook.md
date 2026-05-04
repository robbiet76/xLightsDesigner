# macOS Release Validation Runbook

Status: Active
Owner: xLightsDesigner maintainers
Last Reviewed: 2026-04-30

## Purpose

Define the local evidence required before treating the macOS app and owned xLights API path as release-quality for the current app completion workstream.

This runbook defines the app validation path.

## Runtime Boundaries

- App source: `apps/xlightsdesigner-macos`
- App automation server: `http://127.0.0.1:49916`
- Owned xLights API source: `/Users/robterry/xLights-2026.07/src-ui-wx/xLightsDesigner`
- Owned xLights API endpoint: `http://127.0.0.1:49915/xlightsdesigner/api`
- During current development, the upstream installed `/Applications/xLights.app` is not valid for owned API validation because it does not include the xLightsDesigner API. After this work ships in xLights, the installed app path is valid when the same owned API health and capability probes pass.

## Required Evidence

The paths in this section are development validation examples for the current workspace. App-owned project metadata lives under `/Users/robterry/Documents/Lights/xLightsDesigner`; the linked development xLights show folder is `/Users/robterry/Desktop/Show`. `/Users/robterry/Documents/Lights/Current` is a read-only reference source for inspecting completed user sequences during development and is not a project show folder for validation writes.

1. macOS app package tests

```bash
swift test --package-path apps/xlightsdesigner-macos
```

Required result:
- all package tests pass
- backup/restore and xLights session recovery tests are included in the passing run

2. Owned show-folder validation

Launch the API-enabled xLights build opened to the linked development show folder:

```bash
node scripts/xlights/launch-owned-xlights.mjs \
  --show-dir "/Users/robterry/Desktop/Show" \
  -o
```

`--show-dir` passes the folder to xLights with `-s` and includes it in `XLIGHTS_DESIGNER_TRUSTED_ROOTS` for validation writes.

Run isolated owned API validation:

```bash
node scripts/xlights/validate-owned-show-folder-flow.mjs \
  --show-dir "/Users/robterry/Desktop/Show"
```

Required result:
- validation writes only under `_xlightsdesigner_api_validation/<run-id>/`
- no app metadata is written into the xLights show folder; app metadata stays in the project folder under `/Users/robterry/Documents/Lights/xLightsDesigner`
- `/health`, `/media/current`, `/layout/models`, `/layout/scene`, `/sequence/create`, `/sequencing/apply-batch-plan`, `/sequence/render-current`, `/sequence/save`, and `/jobs/get` succeed
- `/media/current` reports the same show folder as `--show-dir`; trusted roots alone are not enough
- the expected `.fseq` exists next to the isolated validation `.xsq`
- the JSON evidence file is recorded in the macOS evidence log

3. App automation smoke

With the app running:

```bash
node scripts/app/automation.mjs ping
node scripts/app/automation.mjs get-app-snapshot
node scripts/app/automation.mjs get-xlights-session
```

Required result:
- app automation server responds
- app snapshot reflects the current workflow state
- xLights session snapshot is either connected/actionable or explicitly unreachable with refresh still available

4. Sequencer retained validation

Use the current sequence-agent retained gate command for the touched surface. Record the command and result in the evidence log.

Required result:
- retained validation remains green for the active proof-loop and sequencing contract surfaces

## Manual Smoke

Use the app to complete the smallest real workflow that exercises the current local app path:
- open or create a project
- confirm xLights session state
- save app design intent
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

- `docs/operations/xlightsdesigner-macos-validation-evidence-log.md`

Every row should include:
- date
- commit SHA
- machine
- macOS version
- xLights source/build
- app package test result
- owned API validation evidence path
- app automation smoke result
- sequencer retained validation result
- notes or blockers
