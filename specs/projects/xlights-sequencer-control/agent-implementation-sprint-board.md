# Agent Implementation Sprint Board

Status: Planned  
Date: 2026-03-07  
Scope: xLightsDesigner agent planning/execution loop using existing v2 automation APIs, metadata tags, and safety gates.

## Objective
Ship a safe, deterministic, metadata-aware agent loop in xLightsDesigner:
- `prompt -> normalize -> plan -> validate -> preview -> apply -> verify`
- bulk-targeted by metadata tags/models/submodels
- guarded by revision checks and explicit user approval

## Phase Plan

## Sprint 0: Contract Lock (1 sprint)

### Deliverables
- frozen v1 agent contract (inputs, outputs, non-goals)
- locked UX state machine for plan/review/apply
- acceptance matrix for v1 operations
- locked analysis-first kickoff contract (audio -> creative brief)
- locked settings-edit confirmation contract

### Tasks
- [x] Define v1 intent schema and supported verbs in:
  - `specs/projects/xlights-sequencer-control/designer-interaction-contract.md`
  - `specs/projects/xlights-sequencer-control/project-spec.md`
- [x] Define agent output payload shape (`assumptions`, `warnings`, `commands`, `impact`) in:
  - `specs/projects/xlights-sequencer-control/api-surface-contract.md`
- [x] Add explicit v1 non-goals and blocked operation list in:
  - `specs/projects/xlights-sequencer-control/decision-log.md`
- [x] Add v1 acceptance tests to:
  - `specs/projects/xlights-sequencer-control/acceptance-test-matrix.md`
- [x] Add guided-workflow + settings-edit boundaries to:
  - `specs/projects/xlights-sequencer-control/designer-interaction-contract.md`
  - `specs/projects/xlights-sequencer-control/decision-log.md`
- [x] Add audio-analysis-first requirement to:
  - `specs/projects/xlights-sequencer-control/project-spec.md`
  - `specs/projects/xlights-sequencer-control/api-surface-contract.md`

### Exit Criteria
- one unambiguous contract for prompt-to-plan and plan-to-apply
- no unresolved scope ambiguity for v1

---

## Sprint 1: Planner Core + Target Resolution (1-2 sprints)

### Deliverables
- deterministic local planner
- metadata/tag/model/submodel target resolver
- plan preview payload usable by UI
- analysis kickoff pipeline (media -> structure/timing -> brief)
- guided elicitation engine for missing intent fields
- sequencing-decision engine that converts director intent into concrete effect/layer plans

### Tasks (xLightsDesigner)
- [x] Add agent planning module:
  - `apps/xlightsdesigner-ui/agent/planner.js` (new)
  - `apps/xlightsdesigner-ui/agent/intent-normalizer.js` (new)
  - `apps/xlightsdesigner-ui/agent/target-resolver.js` (new)
- [x] Add command-building adapters:
  - `apps/xlightsdesigner-ui/agent/command-builders.js` (new)
- [x] Wire planner into UI state flow:
  - `apps/xlightsdesigner-ui/app.js`
- [ ] Add endpoint helpers if missing:
  - `apps/xlightsdesigner-ui/api.js`
- [x] Add analysis service modules:
  - `apps/xlightsdesigner-ui/agent/audio-analyzer.js` (new)
  - `apps/xlightsdesigner-ui/agent/brief-synthesizer.js` (new)
- [x] Add guided elicitation module:
  - `apps/xlightsdesigner-ui/agent/guided-dialog.js` (new)
- [x] Add sequencing-decision policy module:
  - `apps/xlightsdesigner-ui/agent/sequencing-strategy.js` (new)
- [x] Encode director-intent translation rules in planner:
  - `apps/xlightsdesigner-ui/agent/planner.js`
  - `apps/xlightsdesigner-ui/agent/intent-normalizer.js`
- [ ] Add explicit override handling for user low-level effect constraints:
- [x] Add explicit override handling for user low-level effect constraints:
  - `apps/xlightsdesigner-ui/agent/command-builders.js`
- [x] Add deterministic fixtures for intent/plan snapshots:
  - `specs/projects/xlights-sequencer-control/test-fixtures.manifest.json`

### Tests
- [x] Unit tests for intent normalization and target resolution:
  - `apps/xlightsdesigner-ui/tests/agent/*.test.js` (new)
- [x] Unit tests for director-intent-to-plan translation without explicit effect names:
  - `apps/xlightsdesigner-ui/tests/agent/*.test.js` (new)
- [x] Unit tests for low-level user overrides taking precedence when provided:
  - `apps/xlightsdesigner-ui/tests/agent/*.test.js` (new)

### Exit Criteria
- same input always produces same normalized intent and plan
- targets resolve correctly from multi-tag + model/submodel filters
- director-level prompt yields concrete, executable first-pass sequencing plan
- user low-level sequencing instructions are honored as explicit constraints/overrides

---

## Sprint 2: Safety + Validation Orchestrator (1 sprint)

### Deliverables
- orchestrated pipeline with hard safety gates
- dry-run validation before apply
- stale revision protection

### Tasks (xLightsDesigner)
- [x] Add orchestrator state machine:
  - `apps/xlightsdesigner-ui/agent/orchestrator.js` (new)
- [x] Integrate validation + revision guards:
  - `apps/xlightsdesigner-ui/app.js`
  - `apps/xlightsdesigner-ui/api.js`
- [x] Add safety policy module (limits, blocked ops, max blast radius):
  - `apps/xlightsdesigner-ui/agent/safety-policy.js` (new)
- [x] Persist apply logs and last plan result:
  - `apps/xlightsdesigner-ui/app.js`
  - `apps/xlightsdesigner-desktop/main.mjs` (if file-backed audit log needed)

### Optional xLights tasks (only if gap found)
- [ ] Add missing read/write endpoint required by orchestrator:
  - `/Users/robterry/xLights/xLights/automation/api/*.inl`
  - `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

### Tests
- [ ] Integration tests: validate fail/pass, revision conflict, blocked operation:
  - `scripts/xlights-control/*.sh`
  - `specs/projects/xlights-sequencer-control/api-regression-pass-*.md`

### Exit Criteria
- no write path without `validateCommands` pass
- revision mismatch is surfaced and blocks apply

---

## Sprint 3: UX Review/Approve/Apply Loop (1 sprint)

### Deliverables
- full user-facing plan/review/apply workflow
- impact summary and explicit approval controls
- rollback entrypoint from UI

### Tasks
- [x] Add plan preview panel and approval gate:
  - `apps/xlightsdesigner-ui/app.js`
  - `apps/xlightsdesigner-ui/styles.css`
- [x] Add impact summary sections:
  - affected targets
  - affected time windows
  - command count/risk indicators
- [x] Add post-apply verification + status surface:
  - `apps/xlightsdesigner-ui/app.js`
- [x] Add rollback shortcut wiring to existing version snapshots:
  - `apps/xlightsdesigner-ui/app.js`

### Tests
- [x] UI regression checklist for agent flow:
  - `specs/projects/xlights-sequencer-control/ui-regression-pass-YYYY-MM-DD.md`

### Exit Criteria
- user can inspect plan and must explicitly approve before apply
- applied plan and results are auditable from UI diagnostics/logs

---

## Sprint 4: Hardening + Rollout (1 sprint)

### Deliverables
- feature flag + staged rollout mode
- diagnostics export bundle for agent runs
- final readiness checklist

### Tasks
- [ ] Feature-flag agent apply path (plan-only fallback):
  - `apps/xlightsdesigner-ui/app.js`
- [ ] Add agent-run diagnostics export:
  - `apps/xlightsdesigner-ui/app.js`
  - `apps/xlightsdesigner-desktop/main.mjs`
- [ ] Update runbooks/checklists:
  - `specs/projects/xlights-sequencer-control/desktop-release-runbook.md`
  - `specs/projects/xlights-sequencer-control/desktop-validation-evidence-log.md`
  - `specs/projects/xlights-sequencer-control/wp9-checklist.md` (or successor checklist)
- [ ] Record go/no-go in:
  - `specs/projects/xlights-sequencer-control/implementation-status-matrix.md`

### Exit Criteria
- stable plan/apply loop under repeated local runs
- rollback and diagnostics paths verified

---

## Implementation Checklist (Cross-Phase)

### Core Engine
- [ ] intent normalization
- [ ] target resolution (tags + models + submodels)
- [ ] deterministic command planning
- [ ] impact estimation

### Safety
- [ ] command and target count limits
- [ ] required dry-run validation
- [ ] required revision guard
- [ ] blocked operation policy

### UX
- [ ] plan preview before apply
- [ ] explicit approve button
- [ ] apply result summary
- [ ] rollback affordance

### Observability
- [ ] structured diagnostics per stage
- [ ] persisted run history
- [ ] exportable agent run bundle

### Test Coverage
- [ ] unit tests for parser/resolver/planner
- [ ] integration tests for validate/apply/failure paths
- [ ] regression checklists for UI and API

## Suggested Execution Order
1. Sprint 0 contract lock  
2. Sprint 1 planner/resolver  
3. Sprint 2 safety/orchestrator  
4. Sprint 3 UX review/apply loop  
5. Sprint 4 hardening + rollout

## Notes
- Keep v1 deterministic and narrow. Add new intent verbs only after stability.
- Prefer adding missing xLights endpoints only when a validated blocker exists in xLightsDesigner.
