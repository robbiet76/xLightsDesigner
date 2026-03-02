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
- capability/feature drift risk,
- monolithic automation implementation concentrated in `xLightsAutomations.cpp`.

## 3) Scope
### 3.1 API Contract Additions
- `effects.listDefinitions`
- `effects.getDefinition`
- `transactions.begin`
- `transactions.commit`
- `transactions.rollback`
- `jobs.get`
- `jobs.cancel`
- `sequence.getRevision`

### 3.2 Cross-Cutting Behavior
- Structured diagnostics for open/save/render failure classes.
- Optimistic concurrency behavior using revision token semantics.
- Async operation lifecycle with deterministic terminal states.

### 3.3 Code Architecture
- Split API handlers by domain and keep `xLightsAutomations.cpp` as thin routing/orchestration.
- Centralize shared parsing/validation/response envelope helpers.

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
6. Automation command code is partitioned into grouped files; monolithic growth of `xLightsAutomations.cpp` is halted.

## 6) Test Requirements
- Add harness suites for effect-definition, transactions, async jobs, and revision conflicts.
- Keep existing suites 01..05 green.
- Validate both v2 and legacy regression expectations.

## 7) Deliverables
- Updated contract/spec docs (this spec + task breakdown + matrix updates).
- New/updated automation endpoints in xLights.
- Refactored API command grouping implementation.
- Expanded integration harness scripts and reports.
