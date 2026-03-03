# Gap Audit: Current State vs Full Sequencer Control Target

Status: Updated after WP-9 G9/G10 evidence sync  
Date: 2026-03-03

## 0) Execution Guardrail
- WP-9 gap closure is constrained to automation/API surface by default:
  - `xLights/automation/**`
  - WP-9 specs/schemas/checklists under `xLightsDesigner/specs/**`
- Changes outside API scope require explicit user approval per exception.
- Launch/runtime preference regressions should be treated as environment/harness/state issues first; avoid core behavior edits unless explicitly requested.

## 1) Current Strengths
- v2 envelope and namespaced command surface are implemented across WP-1..WP-6.
- Core sequencing control set (29 WP-scoped commands) is now present in the v2 router.
- Harness now includes multi-suite JSON output and a validation-gate suite.
- CI workflow exists for harness linting/report artifact publishing.

## 2) Gap Status After WP-9 G6

### G1: Effect Definition Introspection
- Status: Closed.
- Implemented `effects.listDefinitions` and `effects.getDefinition` with normalized parameter metadata for agent-side effect discovery.

### G2: Atomic Multi-Step Mutation Control
- Status: Closed for transaction staging baseline.
- Implemented `transactions.begin|commit|rollback` with staged mutation isolation and deterministic envelope/error behavior.

### G3: Async Long-Running Operation Control
- Status: Closed for current scope.
- Implemented `jobs.get|cancel` and async job IDs for timing analysis flows (`async:true`).

### G4: Structured Save/Open Diagnostics
- Status: Closed for current scope.
- Added structured machine diagnostics (`error.class`, `error.retryable`, `error.details`) on open/save/analyze failure paths.

### G5: Revision/Concurrency Guardrails
- Status: Closed.
- Implemented `sequence.getRevision` and `expectedRevision` conflict checks on mutating v2 commands.

### G6: Capability Surface Drift
- Status: Closed for implemented surface.
- Capabilities now advertise WP-9 commands/features that are implemented (`effects definitions`, `transactions`, `jobs`, `executePlan`, `sequence.getRevision`).

### G7: Automation Layer Maintainability
- Status: Closed.
- `system.executePlan` and `transactions.begin|commit|rollback` orchestration moved to grouped API handler `xLights/automation/api/TransactionsV2Api.inl`.
- `xLightsAutomations.cpp` now routes these commands via `HandleTransactionsV2Command(...)` instead of inlined monolithic branches.

### G8: Deterministic Advanced/Bulk Rollback Semantics
- Status: Remaining (narrowed).
- `system.executePlan` now covers validation/runtime-failure no-side-effect cases pre-commit, but full rollback guarantees for all mid-commit mutation failures still need explicit closeout evidence.

### G9: Harness/Regression Completeness
- Status: Closed.
- `run-all.sh` now:
  - launches/open-sequence automatically before suites,
  - avoids placeholder-fixture bootstrap failure modes when using example env defaults,
  - completed live green across suites `01..11` on 2026-03-03.

### G10: Documentation/Status Lockstep
- Status: Closed.
- Matrix/checklist/acceptance docs are synchronized to current WP-9 state.
- Decision log records current gate posture (`No-Go` while G8 remains open).

### G11: Active Display Element Subset Control
- Status: Closed for WP-9 scope.
- Implemented `sequencer.setActiveDisplayElements` with include-only visibility control for non-timing display elements.
- Validation enforces:
  - non-empty `activeIds`,
  - non-empty string ids,
  - no duplicates.
- Runtime behavior:
  - fails deterministic `DISPLAY_ELEMENT_NOT_FOUND` when id does not map to an element,
  - fails deterministic `DISPLAY_ELEMENT_AMBIGUOUS` when name lookup is non-unique,
  - keeps ordering unchanged (ordering remains controlled by `sequencer.setDisplayElementOrder`).

### G12: Effect Layer Lifecycle Management
- Status: Closed for WP-9 scope.
- Implemented explicit layer lifecycle commands:
  - `effects.deleteLayer` with non-empty guard (`force` required) and last-layer protection.
  - `effects.compactLayers` for deterministic removal of empty layers while preserving at least one layer.
- Live validation confirmed:
  - empty-layer delete succeeds,
  - forced non-empty-layer delete succeeds,
  - last-layer deletion is blocked with deterministic `LAYER_LAST_REQUIRED`.

### G13: Virtual Vision Spatial + Render-Style Contract
- Status: Closed.
- Implemented virtual-vision layout discovery endpoints:
  - `layout.getModelGeometry`,
  - `layout.getModelNodes`,
  - `layout.getCameras`,
  - `layout.getScene`.
- Implemented render-style contract endpoints:
  - `effects.getRenderStyleOptions`,
  - `effects.setRenderStyle`.
- Live validation confirms deterministic option payloads and validated render-style mutation behavior for effect targets.

### G14: v2 Effect Palette Read/Write Contract
- Status: Closed.
- Implemented and validated palette contract behaviors:
  - `effects.list` includes `palette` per effect.
  - `effects.create` accepts optional `palette`.
  - `effects.update` accepts optional `palette`.
  - explicit palette endpoints `effects.getPalette`, `effects.setPalette`.
- Live validation confirmed deterministic read/write payloads and dry-run mutation behavior for palette operations.

## 3) Actions Completed in WP-7
- Implemented `layout.getDisplayElements` and verified capability exposure.
- Fixed `layout.getModels` debug crash path for `ModelGroup` membership expansion.
- Added and hardened legacy regression suite coverage.
- Hardened `system.validateCommands` semantic preflight checks for high-risk payload classes.
- Completed live non-interactive harness pass across suites 01..05.
- Completed doc-freeze reconciliation across status, acceptance, and WP-7 tracking docs.

## 4) Next Focus
- Execute remaining G8 closeout work (deterministic rollback guarantees for mid-commit mutation failures).
