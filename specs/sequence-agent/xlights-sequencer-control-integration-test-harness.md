# Integration Test Harness Contract (xLightsDesigner -> xLights)

Status: Draft
Date: 2026-03-02
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

## 1) Purpose
Define concrete, scriptable integration runs that validate end-to-end behavior without UI interaction.

## 1.1 Preflight Requirements
- xLights automation listener is running and reachable at `XLIGHTS_BASE_URL`.
- Analysis backend availability is checked via capabilities/discovery endpoints before running backend-dependent tests.
- For VAMP-backed runs, recommended plugin installers are:
  - Apple Silicon (M1+): `https://dankulp.com/xlights/archive/qm-vamp-plugins-1.8.dmg`
  - Intel: `https://code.soundsoftware.ac.uk/projects/vamp-plugin-pack`
- If a selected backend is unavailable, backend-dependent tests should be marked as environment-skipped with explicit reason.

## 2) Required Scripts

### `scripts/xlights-control/run-all.sh`
Purpose:
- Run all smoke suites with a shared env file.
- Write per-suite JSON reports and a summary JSON report.

Inputs:
- `ENV_FILE` (optional): defaults to `specs/sequence-agent/xlights-sequencer-control-test-fixtures.example.env`
- `MANIFEST_FILE` (optional): defaults to `specs/sequence-agent/xlights-sequencer-control-test-fixtures.manifest.json`
- `OUT_DIR` (optional): defaults under `/tmp/xlights-control-reports/<timestamp>`
- `BOOTSTRAP_FIXTURES` (optional): when `true`, runs fixture bootstrap preflight and writes `bootstrap-report.json`
- `CURL_MAX_TIME` (optional): max seconds per request to avoid indefinite hangs (default `20`)

Outputs:
- `<OUT_DIR>/bootstrap-report.json` (when `BOOTSTRAP_FIXTURES=true`)
- `<OUT_DIR>/01-discovery-smoke.json`
- `<OUT_DIR>/02-sequence-lifecycle-smoke.json`
- `<OUT_DIR>/03-sequencer-mutation-smoke.json`
- `<OUT_DIR>/04-validation-gate-smoke.json`
- `<OUT_DIR>/05-legacy-regression-smoke.json`
- `<OUT_DIR>/run-all-summary.json`

WP-9 planned suite additions:
- `<OUT_DIR>/06-effects-definition-smoke.json`
- `<OUT_DIR>/07-transactions-smoke.json`
- `<OUT_DIR>/09-async-jobs-smoke.json`
- `<OUT_DIR>/10-revision-conflict-smoke.json`
- `<OUT_DIR>/11-diagnostics-smoke.json`

Summary contract additions:
- `packId`
- `packVersion`
- `bootstrap.enabled`
- `bootstrap.passed`
- `bootstrap.report`

### `scripts/xlights-control/bootstrap-fixtures.sh`
Purpose:
- Validate fixture-pack asset resolution/readability against manifest + env.
- Emit machine-readable bootstrap report for harness/agent preflight logic.

Exit:
- `0` when required assets resolve/read successfully.
- non-zero when required assets are missing/unreadable or checksums fail.

### `scripts/xlights-control/01-discovery-smoke.sh`
Inputs:
- `XLIGHTS_BASE_URL` (default `http://127.0.0.1:49914`)

Assertions:
- `system.getCapabilities` returns v2 capabilities and required command groups.
- `layout.getModels`, `layout.getViews`, and `layout.getDisplayElements` return parseable payloads.

Exit:
- `0` on pass.
- non-zero on first failed assertion.

### `scripts/xlights-control/02-sequence-lifecycle-smoke.sh`
Inputs:
- `TEST_SEQUENCE_PATH`
- optional `TEST_MEDIA_PATH`

Assertions:
- sequence create/open/save/close flow succeeds.
- media attach/read metadata flow succeeds when media path is provided.
- dry-run variants produce no persistent mutations.

Exit:
- `0` on pass.
- non-zero on first failed assertion.

### `scripts/xlights-control/03-sequencer-mutation-smoke.sh`
Inputs:
- `TEST_SEQUENCE_PATH` (existing sequence)
- `TEST_TIMING_TRACK`
- `TEST_MODEL_NAME`

Assertions:
- timing track and mark CRUD are functional.
- effect create/list/update/delete and shift/align commands are functional.
- display element ordering commands are functional.
- readback verifies mutations deterministically.

Exit:
- `0` on pass.
- non-zero on first failed assertion.

### `scripts/xlights-control/04-validation-gate-smoke.sh`
Inputs:
- `XLIGHTS_BASE_URL` (default `http://127.0.0.1:49914`)

Assertions:
- `system.validateCommands` returns parseable per-command `results`.
- Invalid candidate commands are flagged with `valid=false` and an error object.

Exit:
- `0` on pass.
- non-zero on first failed assertion.

### `scripts/xlights-control/05-legacy-regression-smoke.sh`
Inputs:
- optional `TEST_SEQUENCE_PATH`

Assertions:
- legacy command transport remains functional for representative reads (`getVersion`, `getModels`).
- legacy close/open/save sequence behavior remains stable for non-v2 calls.
- no-sequence behavior for `getOpenSequence` remains a parseable non-success response.

Exit:
- `0` on pass.
- non-zero on first failed assertion.

### WP-9 Planned Scripts

### `scripts/xlights-control/06-effects-definition-smoke.sh`
Assertions:
- `effects.listDefinitions` returns parseable effect schema contracts.
- `effects.getDefinition` returns stable schema for representative effects.

### `scripts/xlights-control/07-transactions-smoke.sh`
Assertions:
- begin/rollback preserves prior state.
- begin/commit applies atomically.
- conflict paths return deterministic transaction error codes.

### `scripts/xlights-control/09-async-jobs-smoke.sh`
Assertions:
- long-running operations return `jobId`.
- `jobs.get` polling reaches terminal status.
- `jobs.cancel` behaves deterministically for cancellable operations.

### `scripts/xlights-control/10-revision-conflict-smoke.sh`
Assertions:
- stale `revisionToken`/`expectedRevision` is rejected with conflict semantics.
- current revision token mutation succeeds.

### `scripts/xlights-control/11-diagnostics-smoke.sh`
Assertions:
- open/save/analyze failure paths return structured `error.code`, `error.message`, `error.class`, and `error.retryable`.
- diagnostics payload remains machine-readable for agent retry/stop logic.

## 3) Required Output Format
Each script writes a machine-readable JSON report:
```json
{
  "suite": "03-sequencer-mutation-smoke",
  "passed": false,
  "steps": [
    { "name": "timing.createTrack", "passed": true },
    { "name": "effects.shift", "passed": false, "error": "VALIDATION_ERROR" }
  ]
}
```

## 4) CI/Automation Contract
- Scripts must run non-interactively.
- Scripts must be deterministic with fixed fixtures.
- Fail-fast behavior is required.
- Reports must be suitable for agent retry logic and stop conditions.
- Fixture expectations must be defined in `test-fixtures.manifest.json`.
