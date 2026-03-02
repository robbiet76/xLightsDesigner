# Gap Audit: Current State vs Full Sequencer Control Target

Status: Updated after WP-7 closeout  
Date: 2026-03-02

## 1) Current Strengths
- v2 envelope and namespaced command surface are implemented across WP-1..WP-6.
- Core sequencing control set (29 WP-scoped commands) is now present in the v2 router.
- Harness now includes multi-suite JSON output and a validation-gate suite.
- CI workflow exists for harness linting/report artifact publishing.

## 2) Remaining Gaps After WP-8

### G1: Effect Definition Introspection
- Current `effects.*` commands support CRUD but do not expose effect parameter schema/default/range metadata.
- Agents currently require hardcoded effect knowledge that is brittle across versions.

### G2: Atomic Multi-Step Mutation Control
- No transaction API exists for grouping many mutations under all-or-nothing semantics.
- Partial application risk remains for long edit plans.

### G3: Async Long-Running Operation Control
- Long-running operations (save/render/analysis) do not provide first-class async job semantics.
- Poll/cancel/retry behavior is not standardized.

### G4: Structured Save/Open Diagnostics
- Error payload detail is inconsistent for failure triage in autonomous loops.
- Some failures still rely on internal UI-layer behavior instead of machine-first diagnostics.

### G5: Revision/Concurrency Guardrails
- Sequence revision tokens (or equivalent optimistic concurrency controls) are not yet contractized.
- Concurrent/stale write protection is incomplete.

### G6: Capability Surface Drift
- Feature flags/capabilities can drift from actual command availability.
- Contract requires tighter runtime capability truthfulness.

### G7: Automation Layer Maintainability
- `xLightsAutomations.cpp` remains too large and too coupled for rapid expansion.
- API logic needs namespace-group modularization with a thin router/orchestration layer.

## 3) Actions Completed in WP-7
- Implemented `layout.getDisplayElements` and verified capability exposure.
- Fixed `layout.getModels` debug crash path for `ModelGroup` membership expansion.
- Added and hardened legacy regression suite coverage.
- Hardened `system.validateCommands` semantic preflight checks for high-risk payload classes.
- Completed live non-interactive harness pass across suites 01..05.
- Completed doc-freeze reconciliation across status, acceptance, and WP-7 tracking docs.

## 4) Next Focus (Post-WP-8)
- Execute WP-9 to close G1..G10.
- Add dedicated acceptance suites for transactions, async jobs, revision conflicts, and effect-schema introspection.
- Complete API file decomposition and routing clean-up.
