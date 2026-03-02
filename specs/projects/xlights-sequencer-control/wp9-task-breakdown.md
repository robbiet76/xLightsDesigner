# WP-9 Task Breakdown

Status: Draft  
Date: 2026-03-02

## Task 1: Lock Command Contracts
- Finalize request/response/error schemas for:
  - `effects.listDefinitions`, `effects.getDefinition`
  - `transactions.begin|commit|rollback`
  - `jobs.get|cancel`
  - `sequence.getRevision`
- Update capability/feature declarations to match implemented commands only.

## Task 2: Define API Module Layout
- Create grouped handler structure under `xLights/automation/api/`:
  - `SystemApi`
  - `SequenceApi`
  - `LayoutApi`
  - `MediaApi`
  - `TimingApi`
  - `EffectsApi`
  - `TransactionsApi`
  - `JobsApi`
- Keep `xLightsAutomations.cpp` as router/orchestration entrypoint.

## Task 3: Refactor Existing Handlers
- Extract existing command handlers into grouped files without changing behavior.
- Preserve existing request envelope and response formatting.
- Keep legacy command behavior stable.

## Task 4: Implement Effect Definition APIs
- Expose effect parameter metadata from xLights effect registry.
- Normalize schema output for agent consumption.

## Task 5: Implement Transactions API
- Add transaction lifecycle and state isolation for staged mutations.
- Implement deterministic conflict/failure semantics.

## Task 6: Implement Async Jobs API
- Introduce job registry and progress reporting for long-running operations.
- Add job cancellation semantics where supported.

## Task 7: Implement Revision/Concurrency Controls
- Add revision token retrieval (`sequence.getRevision`).
- Enforce `expectedRevision` checks on mutating operations where applicable.

## Task 8: Harden Diagnostics
- Ensure open/save/render failures return structured error payloads.
- Eliminate UI-blocking dependencies in non-interactive API paths.

## Task 9: Expand Harness Coverage
- Add suites:
  - `06-effects-definition-smoke.sh`
  - `07-transactions-smoke.sh`
  - `08-async-jobs-smoke.sh`
  - `09-revision-conflict-smoke.sh`
- Wire into `run-all.sh` and report summary.

## Task 10: Closeout and Documentation
- Update status/acceptance matrices with implementation evidence.
- Produce migration notes for API modularization structure.
- Run full suite and archive run summary.
