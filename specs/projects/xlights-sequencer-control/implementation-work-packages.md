# Implementation Work Packages: v2 Sequencer Control

Status: Draft  
Date: 2026-03-02

## WP-1: v2 Sequence + Layout Discovery Parity
Goal:
- Provide v2 wrappers for legacy sequence/layout discovery behavior without changing legacy semantics.

Scope:
- `sequence.getOpen`
- `sequence.open`
- `sequence.create`
- `sequence.save`
- `sequence.close`
- `layout.getModels`
- `layout.getModel`
- `layout.getViews`
- `media.get`
- `media.set`
- `media.getMetadata`

Out of scope:
- Any controller API.
- Any layout mutation API.

Acceptance gates:
- All commands return v2 envelope shape.
- Legacy commands still pass regression checks unchanged.
- Dry-run semantics implemented for all mutating commands in scope.

## WP-2: Timing Track CRUD
Goal:
- Add explicit timing track lifecycle controls in v2.

Scope:
- `timing.getTracks`
- `timing.createTrack`
- `timing.renameTrack`
- `timing.deleteTrack`

Acceptance gates:
- Deterministic conflict behavior (`TRACK_ALREADY_EXISTS`, `TRACK_NOT_FOUND`).
- Dry-run support for create/rename/delete.

## WP-3: Timing Mark CRUD
Goal:
- Add explicit mark-level authoring and rewrite operations.

Scope:
- `timing.getMarks`
- `timing.insertMarks`
- `timing.replaceMarks`
- `timing.deleteMarks`

Acceptance gates:
- Validation for ordering/range constraints.
- Deterministic count outputs (`insertedCount`, `replacedCount`, `deletedCount`).
- Dry-run non-persistence verified by readback.

## WP-4: Display Element Ordering
Goal:
- Expose deterministic read/write ordering APIs for display elements.

Scope:
- `sequencer.getDisplayElementOrder`
- `sequencer.setDisplayElementOrder`

Acceptance gates:
- Invalid IDs fail with explicit error.
- Reorder behavior deterministic and reversible.
- Dry-run feasibility supported.

## WP-5: Effects Lifecycle (v2 Contract Shape)
Goal:
- Add full effect lifecycle in v2 namespaced form while preserving legacy commands.

Scope:
- `effects.list`
- `effects.create`
- `effects.update`
- `effects.delete`
- `effects.shift`
- `effects.alignToTiming`
- `effects.clone`

Acceptance gates:
- Bulk selector precedence follows decision log D6.
- Idempotency/retry semantics follow D7.
- Overlap policy follows D8.
- Dry-run support for mutating commands.

## WP-6: Validation Endpoint + Autonomous Gate
Goal:
- Add command-batch validation and make harness CI-ready.

Scope:
- `system.validateCommands`
- wire `scripts/xlights-control/run-all.sh` into CI.

Acceptance gates:
- Machine-readable per-command validation results.
- CI publishes per-suite + summary JSON reports.
- Required fixture bundle installed for deterministic runs.

## PR Sequencing Recommendation
1. WP-1
2. WP-2
3. WP-3
4. WP-4
5. WP-5
6. WP-6

Rationale:
- Establishes v2 parity and safe read/write primitives first.
- Defers highest-risk effects bulk semantics until timing/order foundation is stable.

