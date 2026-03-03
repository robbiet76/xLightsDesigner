# WP-9 Spec: End-to-End Sequence Authoring Completeness + API Modularization

Status: Draft  
Date: 2026-03-02

## 1) Goal
Close remaining API gaps for robust autonomous sequence authoring and restructure automation implementation so API growth remains maintainable.

## 2) Problem Statement
Current v2 coverage is strong for core CRUD, but autonomous end-to-end authoring still has high-friction areas:
- missing effect parameter introspection,
- no atomic transaction boundaries for multi-step edits,
- weak async job semantics for long-running operations,
- inconsistent machine diagnostics for failure triage,
- no sequence revision contract for stale-write protection,
- no atomic plan execution contract that combines validate+apply safely,
- incomplete non-interactive guarantees for long-running legacy operations,
- advanced bulk/layer mutation guarantees are not fully deterministic under failure,
- insufficient structured spatial layout geometry for agent-side virtual scene reconstruction,
- no validated render-style option/control contract (today this is mostly implicit settings mutation),
- capability/feature drift risk,
- monolithic automation implementation concentrated in `xLightsAutomations.cpp`.

## 2.1 Remaining Gap IDs
- G1: effect definition introspection and schema-normalized parameter discovery.
- G2: explicit transaction boundaries for staged multi-step mutation plans.
- G3: async jobs lifecycle (poll/cancel/terminal states) for long-running operations.
- G4: sequence revision token + optimistic concurrency checks on mutating APIs.
- G5: deterministic machine diagnostics for open/save/render/import/analyze failures.
- G6: atomic plan execution endpoint for autonomous apply flows.
- G7: strict non-interactive execution guarantees (no modal/prompt dependence).
- G8: deterministic semantics for advanced/bulk sequencing edits with rollback behavior.
- G9: acceptance harness coverage for transactions/jobs/revisions/effect definition schemas.
- G10: documentation and capability declarations that stay in lockstep with implementation.
- G11: active display element subset control for include-only sequencing scope.
- G12: effect layer lifecycle management (`deleteLayer` / `compactLayers`).
- G13: virtual-vision spatial + render-style contract (scene geometry, node coordinates, camera metadata, validated render-style controls).

## 3) Scope
### 3.1 API Contract Additions
- `effects.listDefinitions`
- `effects.getDefinition`
- `transactions.begin`
- `transactions.commit`
- `transactions.rollback`
- `system.executePlan` (atomic validated command-plan execution)
- `jobs.get`
- `jobs.cancel`
- `sequence.getRevision`
- `layout.getModelGeometry`
- `layout.getModelNodes`
- `layout.getCameras`
- `layout.getScene`
- `effects.getRenderStyleOptions`
- `effects.setRenderStyle`

### 3.2 Cross-Cutting Behavior
- Structured diagnostics for open/save/render failure classes.
- Optimistic concurrency behavior using revision token semantics.
- Async operation lifecycle with deterministic terminal states.
- All non-interactive automation paths must avoid blocking modal/prompt behavior.
- Bulk mutation commands must define deterministic rollback/failure semantics.
- Spatial scene reconstruction must be API-driven and deterministic for agent-side virtual layout reasoning.

### 3.3 Code Architecture
- Split API handlers by domain and keep `xLightsAutomations.cpp` as thin routing/orchestration.
- Centralize shared parsing/validation/response envelope helpers.
- Keep API logic at xLights-native control/readback level only.
- Do not add agent scoring, render interpretation heuristics, or planning/optimization logic to xLights API handlers.
- Implement next-level interpretation/orchestration in xLightsDesigner.

## 4) Out of Scope
- Controller APIs.
- Layout/model write APIs.
- Creative sequencing logic in xLights.

## 5) Acceptance Criteria
1. New WP-9 commands are discoverable in capabilities and covered by contract docs.
2. End-to-end autonomous edit plans can apply with rollback/commit semantics.
3. Long-running operations can be polled/cancelled via jobs API.
4. Revision conflicts are detected and returned as deterministic conflict errors.
5. Save/open/render failures return machine-actionable diagnostics without requiring UI interaction.
6. Command plan execution supports atomic validate+apply semantics.
7. Automation command code is partitioned into grouped files; monolithic growth of `xLightsAutomations.cpp` is halted.
8. Agent can reconstruct the layout scene and node positions from API payloads and apply validated render-style settings without UI coupling.

## 6) Test Requirements
- Add harness suites for effect-definition, transactions, async jobs, and revision conflicts.
- Add harness coverage for atomic plan execution and deterministic diagnostic/error classes.
- Keep existing suites 01..05 green.
- Validate both v2 and legacy regression expectations.

## 7) Deliverables
- Updated contract/spec docs (this spec + task breakdown + matrix updates).
- New/updated automation endpoints in xLights.
- Refactored API command grouping implementation.
- Expanded integration harness scripts and reports.
- Maintainer checklist for WP-9 closeout evidence and go/no-go.
