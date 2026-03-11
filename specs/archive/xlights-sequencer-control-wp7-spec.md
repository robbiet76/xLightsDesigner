# WP-7 Spec: Contract Reconciliation + Autonomous Hardening

Status: Completed  
Date: 2026-03-02  
Depends on: WP-1 through WP-6 completion

## 1) Objective
Stabilize the program after broad API delivery by closing the remaining documented contract gap(s), aligning specs with actual runtime behavior, and hardening autonomous test execution to be deterministic and low-touch.

## 2) Why WP-7 Exists
WP-1..WP-6 delivered broad command coverage and validation/harness scaffolding. The main remaining risk is not feature absence, but drift between docs, endpoint behavior, and autonomous test repeatability.

## 3) In Scope
1. Endpoint parity closure:
- Implement `layout.getDisplayElements` in v2 API routing.

2. Contract/doc reconciliation:
- Ensure implementation status matrix and acceptance matrix match real command behavior and error semantics.
- Normalize contradictory examples in docs where needed.

3. Autonomous determinism:
- Finalize a fixture strategy (manifest + bootstrap expectations) that enables repeatable local and CI smoke runs.

4. Validation hardening:
- Tighten `system.validateCommands` checks for high-value semantic preflight failures while remaining non-mutating.

5. Legacy compatibility gate:
- Add explicit automated regression checks for core legacy automation commands to prevent accidental breakage.

## 4) Out of Scope
- Controller APIs.
- Layout/model mutation APIs.
- New sequencing feature families beyond currently documented contract.
- UI-driven/manual test-only workflows.

## 5) Requirements

### 5.1 `layout.getDisplayElements`
- Command returns `200` with `data.elements[]`.
- Minimum element fields:
  - `id`
  - `name`
  - `type`
  - `orderIndex`
- Include `parentId` where derivable from sequence model hierarchy; omit when unavailable.
- Must remain read-only.

### 5.2 Validation Endpoint Hardening
- `system.validateCommands` must continue returning:
  - top-level `data.valid`
  - `data.results[]` entries with `index`, `valid`, and `error` for failures.
- Add explicit validation for command forms with historically high mutation risk (effects selectors, timing mark payload shape, display reorder payload completeness).
- No mutation side effects allowed.

### 5.3 Autonomous Harness Determinism
- Required suite outputs remain machine-readable JSON.
- Fixture manifest must clearly identify required vs optional fixture inputs.
- Harness failures must be unambiguous for agent retry/stop logic.

### 5.4 Legacy Compatibility
- Legacy command surface remains behaviorally unchanged unless explicitly documented.
- Regression suite should exercise representative legacy read + mutate commands.

## 6) Acceptance Criteria
1. `layout.getDisplayElements` is implemented and available via v2 capabilities.
2. `implementation-status-matrix.md` has no stale pre-WP-6 claims.
3. `acceptance-test-matrix.md` reflects real response semantics.
4. Harness/fixture docs support deterministic setup and reporting.
5. Legacy regression gate exists and catches drift.
6. No regressions in WP-1..WP-6 command behavior.

## 7) Deliverables
- xLights API update for `layout.getDisplayElements`.
- Updated spec/docs set (status matrix, acceptance matrix, gap audit).
- WP-7 task breakdown document with execution order and exit checks.
- Harness/CI updates for fixture and legacy regression gating.

## 8) Exit Definition
WP-7 is complete when endpoint parity and autonomous hardening changes are merged, and a single non-interactive run can produce deterministic pass/fail outputs with docs that accurately describe shipped behavior.

## 9) Closeout Evidence
- xLights completion commit: `09cf17278`
- xLightsDesigner closeout/docs commit: `0746f1f`
- Live harness summary artifact:
  - `/tmp/xlights-control-reports/live-49913-fixed3-20260301-214101/run-all-summary.json`
