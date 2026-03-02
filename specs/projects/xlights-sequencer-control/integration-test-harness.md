# Integration Test Harness Contract (xLightsDesigner -> xLights)

Status: Draft  
Date: 2026-03-02

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
- `ENV_FILE` (optional): defaults to `specs/projects/xlights-sequencer-control/test-fixtures.example.env`
- `MANIFEST_FILE` (optional): defaults to `specs/projects/xlights-sequencer-control/test-fixtures.manifest.json`
- `OUT_DIR` (optional): defaults under `/tmp/xlights-control-reports/<timestamp>`

Outputs:
- `<OUT_DIR>/01-discovery-smoke.json`
- `<OUT_DIR>/02-sequence-lifecycle-smoke.json`
- `<OUT_DIR>/03-sequencer-mutation-smoke.json`
- `<OUT_DIR>/run-all-summary.json`

### `scripts/xlights-control/01-discovery-smoke.sh`
Inputs:
- `XLIGHTS_BASE_URL` (default `http://127.0.0.1:49914`)

Assertions:
- `system.getCapabilities` returns v2 capabilities and required command groups.
- `layout.getModels`, `layout.getViews`, `layout.getDisplayElements` return parseable payloads.

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
