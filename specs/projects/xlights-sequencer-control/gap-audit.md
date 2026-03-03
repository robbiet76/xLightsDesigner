# Gap Audit: Current State vs Full Sequencer Control Target

Status: Updated after WP-9 G6 execution  
Date: 2026-03-02

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
- Status: Remaining.
- `xLightsAutomations.cpp` still carries cross-cutting orchestration (transactions/jobs/executePlan) and should be reduced further via grouped API files.

### G8: Deterministic Advanced/Bulk Rollback Semantics
- Status: Remaining (narrowed).
- `system.executePlan` now covers validation/runtime-failure no-side-effect cases pre-commit, but full rollback guarantees for all mid-commit mutation failures still need explicit closeout evidence.

### G9: Harness/Regression Completeness
- Status: In progress.
- Suites `06..11` are implemented and wired; full `run-all` live green (including legacy suite stability constraints) is still pending final closeout evidence.

### G10: Documentation/Status Lockstep
- Status: In progress.
- Core docs are being updated, but final matrix/checklist closeout and decision-log go/no-go are still pending.

### G11: Active Display Element Subset Control
- Status: Remaining.
- Current `sequencer.setDisplayElementOrder` requires a full element list and does not provide include-only element activation for sequencing.
- Agent workflows need explicit subset control plus deterministic ordering to manage render intent.

### G12: Effect Layer Lifecycle Management
- Status: Remaining.
- Current API can clear effects in a layer (`effects.delete` with `layerIndex`) but cannot remove empty layers or compact layer stacks.
- Agent workflows need explicit layer lifecycle control (`deleteLayer` / `compactLayers`) to keep render layering deterministic and avoid orphan/unused layers.

### G13: Virtual Vision Spatial + Render-Style Contract
- Status: Remaining.
- Current layout APIs expose only high-level model metadata + raw attributes and do not provide structured scene geometry for agent-side spatial reconstruction.
- Agent workflows need deterministic structured APIs for:
  - model transforms/dimensions (`layout.getModelGeometry`),
  - per-node coordinates (`layout.getModelNodes`),
  - camera metadata (`layout.getCameras`),
  - one-call scene snapshot (`layout.getScene`),
  - validated render-style option/control endpoints (`effects.getRenderStyleOptions`, `effects.setRenderStyle`).
- This is a critical dependency for autonomous "virtual layout vision" and robust render-intent control.

### G14: v2 Effect Palette Read/Write Contract
- Status: Remaining.
- Current v2 `effects.*` contract is settings-centric and does not expose palette as a first-class field in list/create/update payloads.
- Agent workflows need deterministic palette control for end-to-end sequencing quality.
- Required contract additions:
  - `effects.list` includes `palette` in each effect object.
  - `effects.create` accepts optional `palette`.
  - `effects.update` accepts optional `palette`.
  - optional explicit endpoints for targeted control: `effects.getPalette`, `effects.setPalette`.

## 3) Actions Completed in WP-7
- Implemented `layout.getDisplayElements` and verified capability exposure.
- Fixed `layout.getModels` debug crash path for `ModelGroup` membership expansion.
- Added and hardened legacy regression suite coverage.
- Hardened `system.validateCommands` semantic preflight checks for high-risk payload classes.
- Completed live non-interactive harness pass across suites 01..05.
- Completed doc-freeze reconciliation across status, acceptance, and WP-7 tracking docs.

## 4) Next Focus
- Execute WP-9 remaining closure work for G7, G8, G9, G10, G11, G12, G13, and G14.
- Reduce `xLightsAutomations.cpp` orchestration footprint where practical.
- Produce final run evidence and complete go/no-go documentation.
