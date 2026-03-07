# Implementation Status Matrix: WP-9 Progress Snapshot

Status: Updated with Sprint 4 agent rollout hardening snapshot  
Date: 2026-03-07  
xLights branch audited: `audit/agent-hooks`

## Legend
- `Implemented`: command exists and is exercised by harness.
- `Implemented (bounded)`: command exists with known bounded limitations still tracked in gap audit.
- `In Progress`: partially implemented and/or pending closeout evidence.

## 1) WP-9 Command Surface

| Command | Status | Evidence |
|---|---|---|
| `effects.listDefinitions` | Implemented | `xLights/automation/api/EffectsV2Api.inl`, `06-effects-definition-smoke.sh` |
| `effects.getDefinition` | Implemented | `xLights/automation/api/EffectsV2Api.inl`, `06-effects-definition-smoke.sh` |
| `transactions.begin` | Implemented | `xLights/automation/api/TransactionsV2Api.inl`, `07-transactions-smoke.sh` |
| `transactions.commit` | Implemented (bounded) | `xLights/automation/api/TransactionsV2Api.inl`, `07-transactions-smoke.sh` |
| `transactions.rollback` | Implemented | `xLights/automation/api/TransactionsV2Api.inl`, `07-transactions-smoke.sh` |
| `system.executePlan` | Implemented (bounded) | `xLights/automation/api/TransactionsV2Api.inl`, `08-plan-execution-smoke.sh` |
| `jobs.get` | Implemented | `xLights/automation/api/JobsV2Api.inl`, `09-async-jobs-smoke.sh` |
| `jobs.cancel` | Implemented | `xLights/automation/api/JobsV2Api.inl`, `09-async-jobs-smoke.sh` |
| `sequence.getRevision` | Implemented | `xLights/automation/api/SequenceV2Api.inl`, `10-revision-conflict-smoke.sh` |

## 2) Cross-Cutting WP-9 Behaviors

| Behavior | Status | Evidence |
|---|---|---|
| Structured diagnostics (`error.class`, `error.retryable`, `error.details`) | Implemented | `xLights/automation/xLightsAutomations.cpp`, `11-diagnostics-smoke.sh` |
| Non-interactive v2 automation assert suppression | Implemented | `xLights/automation/xLightsAutomations.cpp` |
| Capability feature flags for WP-9 additions | Implemented | `xLights/automation/api/SystemV2Api.inl`, `01-discovery-smoke.sh` |
| Harness suites 06..11 wired into runner/manifest | Implemented | `scripts/xlights-control/run-all.sh`, `test-fixtures.manifest.json` |
| Full live harness pass (01..11 + legacy stability) | Implemented | `scripts/xlights-control/run-all.sh` execution on 2026-03-03 |

## 3) Harness Coverage Snapshot

| Suite | Purpose | Status |
|---|---|---|
| `06-effects-definition-smoke.sh` | Effect schema discovery | Implemented |
| `07-transactions-smoke.sh` | Transaction begin/rollback/commit | Implemented |
| `08-plan-execution-smoke.sh` | Plan execution + rollback/no-side-effect checks | Implemented |
| `09-async-jobs-smoke.sh` | Async jobs lifecycle visibility | Implemented |
| `10-revision-conflict-smoke.sh` | Optimistic concurrency | Implemented |
| `11-diagnostics-smoke.sh` | Machine diagnostics contract | Implemented |

## 4) Open Items (Tracked)

1. Full atomic rollback guarantees for all mid-commit mutation failure classes remain tracked under G8.

## 5) Agent Rollout Hardening Snapshot (Designer App)

| Area | Status | Evidence |
|---|---|---|
| Rollout feature flag (`full`/`plan-only`/`disabled`) | Implemented | `apps/xlightsdesigner-ui/app.js` settings + apply gating |
| Explicit approval gate before apply | Implemented | `apps/xlightsdesigner-ui/app.js` (`applyApprovalChecked` checks) |
| Persisted apply audit history | Implemented | `apps/xlightsdesigner-desktop/main.mjs` (`xld:agent-log:*`) |
| Diagnostics export includes agent-run context | Implemented | `apps/xlightsdesigner-ui/app.js` `buildDiagnosticsBundle().agentRun` |
| UI regression evidence for review/approve/apply loop | Implemented | `specs/projects/xlights-sequencer-control/ui-regression-pass-2026-03-07.md` |

Go/No-Go (2026-03-07):
- `GO` for continued internal implementation and preview-channel validation.
- `NO-GO` for stable-channel production release until repeated packaged-app smoke runs are logged in `desktop-validation-evidence-log.md`.
