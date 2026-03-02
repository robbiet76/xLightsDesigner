# Implementation Work Packages: v2 Sequencer Control

Status: Updated after WP-6  
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
Status: In progress

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
- `layout.getDisplayElements` endpoint implementation is in progress in `xLights` working tree.
- Added `05-legacy-regression-smoke.sh` and wired legacy gate into `run-all.sh`, manifest, and CI lint workflow.

## Sequencing Recommendation
1. WP-7.1 Contract sync and endpoint gap closure (`layout.getDisplayElements`)
2. WP-7.2 Fixture determinism and harness repeatability
3. WP-7.3 Validation and legacy regression hardening
4. WP-7.4 Documentation freeze + sign-off

Rationale:
- We now have broad feature coverage; highest value is reducing ambiguity/risk before additional API expansion.
