# WP-9 Task Breakdown

Status: Draft  
Date: 2026-03-02

## Task 1: Lock Command Contracts
- Finalize request/response/error schemas for:
  - `effects.listDefinitions`, `effects.getDefinition`
  - `transactions.begin|commit|rollback`
  - `system.executePlan`
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

## Task 6: Implement Atomic Plan Execution
- Add `system.executePlan` for validated multi-command apply.
- Support "all-or-nothing" behavior via transaction boundaries.
- Return deterministic per-step diagnostics and aggregate status.

## Task 7: Implement Async Jobs API
- Introduce job registry and progress reporting for long-running operations.
- Add job cancellation semantics where supported.

## Task 8: Implement Revision/Concurrency Controls
- Add revision token retrieval (`sequence.getRevision`).
- Enforce `expectedRevision` checks on mutating operations where applicable.

## Task 9: Harden Diagnostics + Non-Interactive Guarantees
- Ensure open/save/render failures return structured error payloads.
- Eliminate UI-blocking dependencies in non-interactive API paths.
- Add stable error class/codes and retryability hints for machine triage.

## Task 10: Expand Harness Coverage
- Add suites:
  - `06-effects-definition-smoke.sh`
  - `07-transactions-smoke.sh`
  - `08-plan-execution-smoke.sh`
  - `09-async-jobs-smoke.sh`
  - `10-revision-conflict-smoke.sh`
- Wire into `run-all.sh` and report summary.

## Task 11: Closeout and Documentation
- Update status/acceptance matrices with implementation evidence.
- Produce migration notes for API modularization structure.
- Run full suite and archive run summary.
- Complete `wp9-checklist.md` with links to proof artifacts and final go/no-go.

## Task 12: Implement Virtual Vision Layout + Render-Style Contracts
- Add read-only layout geometry commands:
  - `layout.getModelGeometry`
  - `layout.getModelNodes`
  - `layout.getCameras`
  - `layout.getScene`
- Add render-style contract commands:
  - `effects.getRenderStyleOptions`
  - `effects.setRenderStyle`
- Ensure payloads are deterministic and sufficient for agent-side scene reconstruction without UI scraping.
- Add harness coverage for scene bootstrap, node-coordinate retrieval, and render-style option/application validation.

## Task 13: Implement v2 Palette Contracts
- Extend `effects.list` payload to include `palette`.
- Extend `effects.create` and `effects.update` to accept optional `palette`.
- Optionally add explicit palette endpoints:
  - `effects.getPalette`
  - `effects.setPalette`
- Add harness coverage for palette create/update/readback determinism.
