# WP-9 Completion Checklist

Status: Draft  
Date: 2026-03-02

Use this checklist as the authoritative go/no-go gate for "autonomous sequence authoring ready" in WP-9.

## 1) Contract and Discovery
- [ ] `system.getCapabilities` advertises all implemented WP-9 commands only.
- [ ] `effects.listDefinitions` contract finalized and documented.
- [ ] `effects.getDefinition` contract finalized and documented.
- [ ] `transactions.begin|commit|rollback` contracts finalized and documented.
- [ ] `system.executePlan` contract finalized and documented.
- [ ] `jobs.get|cancel` contracts finalized and documented.
- [ ] `sequence.getRevision` contract finalized and documented.
- [ ] Schemas updated for all new request/response shapes.

## 2) Effect Definition Introspection (G1)
- [ ] Definitions expose stable `effectName`/`id` mapping.
- [ ] Parameter metadata is normalized for agent use (type, required, default, enum/range when available).
- [ ] Unknown or plugin-specific parameters return deterministic fallback metadata.
- [ ] At least one fixture captures a stable expected definition payload.

## 3) Transactions and Atomic Plans (G2, G6, G8)
- [ ] Transaction begin returns transaction ID/token.
- [ ] Transaction-scoped mutations are isolated until commit.
- [ ] Commit applies all staged operations deterministically.
- [ ] Rollback discards all staged operations deterministically.
- [ ] `system.executePlan` supports validate+apply atomic flow.
- [ ] Partial step failure in executePlan cannot leave partially-applied state.
- [ ] Per-step result objects include deterministic error codes/messages.

## 4) Async Jobs and Long-Running Ops (G3)
- [ ] Long operations register a job with stable `jobId`.
- [ ] `jobs.get` exposes deterministic states (`queued|running|succeeded|failed|cancelled`).
- [ ] `jobs.get` includes progress and terminal diagnostics.
- [ ] `jobs.cancel` behavior is explicit per job type (supported/unsupported).
- [ ] Cancellation never corrupts sequence state.

## 5) Revision and Concurrency (G4)
- [ ] `sequence.getRevision` returns current revision token.
- [ ] Mutating APIs that require protection accept `expectedRevision`.
- [ ] Mismatched revision returns deterministic conflict error.
- [ ] Successful mutation advances revision token.
- [ ] Conflict behavior is covered in harness tests.

## 6) Diagnostics and Non-Interactive Guarantees (G5, G7)
- [ ] Open/save/render/import/analyze failures return structured machine diagnostics.
- [ ] Error payloads include stable code + message + class.
- [ ] Retryability is explicit where applicable.
- [ ] Automation mutation paths are non-interactive (no modal/prompt dependency).
- [ ] Legacy compatibility paths do not regress existing scripts.

## 7) Architecture and Modularity (G10)
- [ ] `xLightsAutomations.cpp` remains routing/orchestration focused.
- [ ] Domain handlers are grouped under `xLights/automation/api/`.
- [ ] Shared parse/validate/response helpers are centralized and reused.
- [ ] New WP-9 APIs are added to grouped files, not monolithic routing logic.

## 8) Harness and Regression Coverage (G9)
- [ ] New suites added and wired in `run-all.sh`:
- [ ] `06-effects-definition-smoke.sh`
- [ ] `07-transactions-smoke.sh`
- [ ] `08-plan-execution-smoke.sh`
- [ ] `09-async-jobs-smoke.sh`
- [ ] `10-revision-conflict-smoke.sh`
- [ ] Existing suites `01..05` remain green.
- [ ] Legacy regression suite remains green.
- [ ] Fixture manifest updated with expected baseline outputs for all new suites.

## 9) Final Closeout
- [ ] `implementation-status-matrix.md` updated with WP-9 evidence links.
- [ ] `acceptance-test-matrix.md` updated with WP-9 pass criteria.
- [ ] `gap-audit.md` marks G1..G10 closed or explicitly deferred.
- [ ] Final run report archived and linked in closeout notes.
- [ ] Go/No-Go decision recorded in decision log.
