# WP-9 Completion Checklist

Status: Draft  
Date: 2026-03-02

Use this checklist as the authoritative go/no-go gate for "autonomous sequence authoring ready" in WP-9.

## 0) Implementation Guardrail
- [x] WP-9 execution scope is API-layer only by default (`xLights/automation/**` and corresponding specs/schemas).
- [x] Non-API xLights source edits require explicit user approval for each exception.
- [x] Runtime/config launch issues should be debugged and resolved via environment/harness/settings first, not core app behavior changes.

## 1) Contract and Discovery
- [ ] `system.getCapabilities` advertises all implemented WP-9 commands only.
- [x] Display-element subset contract (`sequencer.setActiveDisplayElements`) is finalized and documented.
- [ ] Layer lifecycle contracts (`effects.deleteLayer` and/or `effects.compactLayers`) are finalized and documented.
- [x] Virtual-vision layout contracts (`layout.getModelGeometry`, `layout.getModelNodes`, `layout.getCameras`, `layout.getScene`) are finalized and documented.
- [x] Render-style control contracts (`effects.getRenderStyleOptions`, `effects.setRenderStyle`) are finalized and documented.
- [x] Palette control contracts (`effects.list` palette field, `effects.create/update` palette support, optional `effects.getPalette/setPalette`) are finalized and documented.
- [x] `effects.listDefinitions` contract finalized and documented.
- [x] `effects.getDefinition` contract finalized and documented.
- [x] `transactions.begin|commit|rollback` contracts finalized and documented.
- [x] `system.executePlan` contract finalized and documented.
- [x] `jobs.get|cancel` contracts finalized and documented.
- [x] `sequence.getRevision` contract finalized and documented.
- [ ] Schemas updated for all new request/response shapes.

## 2) Effect Definition Introspection (G1)
- [x] Definitions expose stable `effectName`/`id` mapping.
- [x] Parameter metadata is normalized for agent use (type, required, default, enum/range when available).
- [x] Unknown or plugin-specific parameters return deterministic fallback metadata.
- [ ] At least one fixture captures a stable expected definition payload.

## 3) Transactions and Atomic Plans (G2, G6, G8)
- [x] Transaction begin returns transaction ID/token.
- [x] Transaction-scoped mutations are isolated until commit.
- [x] Commit applies all staged operations deterministically.
- [x] Rollback discards all staged operations deterministically.
- [x] `system.executePlan` supports validate+apply atomic flow.
- [ ] Partial step failure in executePlan cannot leave partially-applied state.
- [x] Per-step result objects include deterministic error codes/messages.

## 4) Async Jobs and Long-Running Ops (G3)
- [x] Long operations register a job with stable `jobId`.
- [x] `jobs.get` exposes deterministic states (`queued|running|succeeded|failed|cancelled`).
- [x] `jobs.get` includes progress and terminal diagnostics.
- [x] `jobs.cancel` behavior is explicit per job type (supported/unsupported).
- [ ] Cancellation never corrupts sequence state.

## 5) Revision and Concurrency (G4)
- [x] `sequence.getRevision` returns current revision token.
- [x] Mutating APIs that require protection accept `expectedRevision`.
- [x] Mismatched revision returns deterministic conflict error.
- [x] Successful mutation advances revision token.
- [x] Conflict behavior is covered in harness tests.

## 6) Diagnostics and Non-Interactive Guarantees (G5, G7)
- [x] Open/save/render/import/analyze failures return structured machine diagnostics.
- [x] Error payloads include stable code + message + class.
- [x] Retryability is explicit where applicable.
- [x] Automation mutation paths are non-interactive (no modal/prompt dependency).
- [ ] Legacy compatibility paths do not regress existing scripts.

## 7) Architecture and Modularity (G10)
- [x] `xLightsAutomations.cpp` remains routing/orchestration focused.
- [x] Domain handlers are grouped under `xLights/automation/api/`.
- [x] Shared parse/validate/response helpers are centralized and reused.
- [x] New WP-9 APIs are added to grouped files, not monolithic routing logic.

## 8) Harness and Regression Coverage (G9)
- [ ] New suites added and wired in `run-all.sh`:
- [x] `06-effects-definition-smoke.sh`
- [x] `07-transactions-smoke.sh`
- [x] `08-plan-execution-smoke.sh`
- [x] `09-async-jobs-smoke.sh`
- [x] `10-revision-conflict-smoke.sh`
- [x] `11-diagnostics-smoke.sh`
- [ ] Existing suites `01..05` remain green.
- [ ] Legacy regression suite remains green.
- [ ] Fixture manifest updated with expected baseline outputs for all new suites.

## 9) Virtual Vision Readiness (G13)
- [ ] Agent can bootstrap a scene snapshot from API only (no UI scraping).
- [ ] Scene snapshot includes model transforms and dimensions where derivable.
- [ ] Scene snapshot includes deterministic node coordinate metadata for target models.
- [ ] Camera metadata is discoverable and usable for per-preview render-style decisions.
- [ ] Render-style option discovery prevents invalid style/camera combinations.
- [ ] Render-style update endpoint applies validated changes deterministically and is read-back verifiable.

## 10) Palette Read/Write Readiness (G14)
- [x] `effects.list` returns palette payload deterministically.
- [x] `effects.create` accepts palette and persists correctly.
- [x] `effects.update` can patch palette without unintended settings regressions.
- [x] Palette readback is deterministic after mutation.

## 11) Final Closeout
- [ ] `implementation-status-matrix.md` updated with WP-9 evidence links.
- [ ] `acceptance-test-matrix.md` updated with WP-9 pass criteria.
- [ ] `gap-audit.md` marks G1..G14 closed or explicitly deferred.
- [ ] Final run report archived and linked in closeout notes.
- [ ] Go/No-Go decision recorded in decision log.
