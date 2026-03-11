# Implementation Work Packages: v2 Sequencer Control

Status: Updated after WP-7 closeout  
Date: 2026-03-02

## Completed Packages

### WP-1: v2 Sequence + Layout Discovery Parity
Status: Completed (`bb763f073`)

### WP-2: Timing Track CRUD
Status: Completed (`9cd388295`)

### WP-3: Timing Mark CRUD
Status: Completed (`81b822eaa`)

### WP-4: Display Element Ordering
Status: Completed (`b963d6935`)

### WP-5: Effects Lifecycle (v2 Contract Shape)
Status: Completed (`e3a962c9e`)

### WP-6: Validation Endpoint + Autonomous Gate
Status: Completed (`98e6b5712` in xLights, `63546f3` in xLightsDesigner)

## WP-7: Contract Reconciliation + Autonomous Hardening
Status: Completed (`09cf17278` in xLights, `0746f1f` in xLightsDesigner)

Goal:
- Close remaining spec/implementation drift and harden autonomous reliability so agent loops can run repeatably without manual patching.

Scope:
- Implement `layout.getDisplayElements` in v2 router.
- Reconcile contract docs/tests with actual error semantics and payload fields.
- Add deterministic fixture bundle/bootstrap path for local + CI harness runs.
- Harden `system.validateCommands` semantics for higher-confidence preflight checks.
- Add explicit legacy regression gate coverage for non-v2 commands.

Out of scope:
- Controller APIs.
- Layout/model mutation APIs.
- New effect/timing feature families beyond current contract.

Acceptance gates:
- `layout.getDisplayElements` returns deterministic element metadata (`id`, `name`, `type`, `orderIndex`, `parentId?` as available).
- `implementation-status-matrix.md` and `acceptance-test-matrix.md` match shipped behavior (no known stale claims).
- Harness runs with reproducible fixtures and emits consistent summary JSON.
- Legacy compatibility regression checks run and fail-fast on behavioral drift.
- Any remaining gaps are explicitly documented as deliberate deferrals.

Progress:
- `layout.getDisplayElements` is implemented in v2 and available in capabilities.
- Fixed a `layout.getModels` debug crash path in xLights by avoiding group-membership expansion on `ModelGroup` entries.
- Added `05-legacy-regression-smoke.sh` and wired legacy gate into `run-all.sh`, manifest, and CI lint workflow.
- Discovery and legacy suites were hardened for deterministic preconditions (`SEQUENCE_NOT_OPEN` handling in discovery and forced legacy close semantics).
- Live run validation passed all suites on `2026-03-01` using local xLights listener:
  - `/tmp/xlights-control-reports/live-49913-fixed3-20260301-214101/run-all-summary.json`
- `system.validateCommands` semantic checks were hardened for:
  - timing mark payload shape and ordering/overlap constraints
  - display element reorder payload quality (`orderedIds` string/duplicate validation)
  - effect selector payload validity (`modelName`/`effectId`/`effectIds` typing and presence)
- Validation hardening was verified live on `2026-03-01` via:
  - `scripts/xlights-control/04-validation-gate-smoke.sh`
  - direct `system.validateCommands` probe returning `VALIDATION_ERROR` for duplicate `orderedIds` and invalid mark ranges

## WP-7 Closeout Note
- WP-7 scope has been executed and documented.
- Remaining improvements should be tracked as new work packages, not WP-7 extensions.

## WP-8: Fixture Pack Versioning + Bootstrap Portability
Status: In progress

Goal:
- Eliminate fixture setup ambiguity by introducing a versioned fixture-pack contract and non-interactive bootstrap flow for local + CI runs.

Scope:
- Add fixture pack metadata/versioning and integrity fields.
- Add bootstrap script and machine-readable bootstrap report.
- Integrate fixture pack identity into harness summary outputs.
- Add CI/schema checks for fixture pack artifacts.

Out of scope:
- New xLights API endpoint families.
- UI/manual fixture preparation workflows.

Initial success criteria:
- Harness can run with an explicitly selected fixture pack.
- Reports include fixture pack id/version.
- Fixture bootstrap succeeds non-interactively in clean environments.

Progress:
- Added fixture-pack metadata/checksum contract to `test-fixtures.manifest.json`.
- Added fixture-pack schema artifact (`schemas/fixture-pack-manifest.schema.json`).
- Added CI/local manifest validation script (`scripts/xlights-control/validate-fixture-manifest.sh`) and wired it into workflow lint.
- Added fixture bootstrap script (`scripts/xlights-control/bootstrap-fixtures.sh`) with machine-readable pass/fail report.
- Updated `run-all.sh` summary contract to include `packId`, `packVersion`, and optional bootstrap report metadata.
- Added request timeout guardrails (`CURL_MAX_TIME`) to harness HTTP calls to prevent indefinite hangs.
- Completed end-to-end harness run with explicit fixture-pack metadata emitted in summary:
  - `/tmp/xlights-control-reports/wp8-live-timeboxed-20260301-220608/run-all-summary.json`

## WP-9: End-to-End Sequence Authoring Completeness + API Modularization
Status: Planned

Goal:
- Close the remaining API gaps that block robust autonomous sequence generation while reducing automation-layer complexity by splitting API logic into grouped modules.

Scope:
- Add effect definition/introspection APIs (parameter schema/defaults/ranges/enums).
- Add transaction semantics for atomic multi-step mutation (`begin`/`commit`/`rollback`).
- Add async job control for long-running operations (job id/progress/cancel/result).
- Add structured diagnostic/error payloads for open/save/render/write paths.
- Add sequence revision/concurrency tokens to protect against stale writes.
- Reconcile capabilities with shipped commands (for example, lyrics-related feature flags).
- Refactor automation implementation into grouped API files and keep `xLightsAutomations.cpp` as orchestration/router layer.

Out of scope:
- Controller setup/control APIs.
- Layout/model write APIs.
- Creative decision logic in xLights.

Acceptance gates:
- New APIs are documented in contract docs and validated by automated harness coverage.
- End-to-end autonomous flow supports deterministic create/open/edit/save with no blocking UI dialogs.
- Transaction and revision semantics prevent partial/stale writes in concurrent agent loops.
- Long-running operations return machine-actionable progress and cancellation semantics.
- API code is partitioned by namespace group and `xLightsAutomations.cpp` is reduced to lightweight routing/integration responsibilities.

Reference docs:
- `wp9-spec.md`
- `wp9-task-breakdown.md`
