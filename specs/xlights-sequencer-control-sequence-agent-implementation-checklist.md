# Sequence Agent Implementation Checklist

Status: Active (planning and execution checklist)
Date: 2026-03-11
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-11

## 1) Purpose
Define the implementation checklist for `sequence_agent` as the canonical xLights execution role.

Boundary summary:
- `designer_dialog` owns artistic/design intent ("what").
- `sequence_agent` owns technical xLights implementation ("how").
- `audio_analyst` owns analysis artifacts and does not mutate xLights.

## 2) Phase Checklist

### Required Pre-Gate (applies to each domain area)
- [ ] Source audit complete (xLights code references documented).
- [ ] API coverage map complete (source fields/enums/constraints mapped to automation API).
- [ ] Gap list approved (missing/partial API surface documented and prioritized).
- [ ] Domain semantic modeling starts only after source+API audit gate is complete.

### Phase A: Role Contract and Data Shapes
- [x] Define canonical `sequence_agent` input contract.
- [x] Define canonical `sequence_agent` output contract (`plan_handoff_v1` + apply result contract).
- [x] Define required/optional fields for degraded mode (missing analysis handoff).
- [x] Define strict contract versioning policy (`1.0` required) with no migration/alias support in pre-release development.

### Phase B: Deterministic Planning Pipeline
- [x] Implement deterministic planning stages:
  - [x] scope resolution (sections, targets, tags)
  - [x] timing asset decision stage (create/use/skip)
  - [x] effect strategy stage
  - [x] command graph synthesis stage
- [x] Add stage-level failure classification and policy.
- [x] Add stage timing telemetry and run-id correlation.

### Phase C: Command Graph as Source of Truth
- [x] Define canonical command graph node schema.
- [x] Add graph integrity validation (dependencies, ordering, duplicate writes, unsafe writes).
- [x] Ensure apply path executes from `plan_handoff_v1.commands` by default.
- [x] Restrict fallback regeneration paths to explicit non-default cases only.

### Phase D: xLights Capability and Safety Integration
- [x] Build capability matrix usage in planning stage.
- [x] Add explicit blocked/unsupported mapping per command category.
- [ ] Enforce revision gate and stale-plan gate uniformly.
- [x] Enforce safety policy on graph and per-node command groups.

### Phase I: xLights Domain Semantics (layout/models/groups/submodels/effects)
- [ ] Show layout and model spatial placement:
  - [x] Pre-gate complete (source + API coverage + approved gaps).
  - [x] Canonical scene graph schema defined in app layer.
  - [x] Spatial query helpers implemented (region/proximity/orientation).
  - [x] Layout mode awareness wired (`2d|3d`) with 3D-operation gating policy while preserving depth semantics in both modes.
- [ ] Model types and functionality:
  - [ ] Pre-gate complete (source + API coverage + approved gaps).
  - [ ] Model type ontology + constraints documented and encoded.
- [ ] Model groups and functionality:
  - [ ] Pre-gate complete (source + API coverage + approved gaps).
  - [ ] Group behavior rules encoded (fanout/stagger/mirror/distribution).
- [ ] Submodels and functionality:
  - [ ] Pre-gate complete (source + API coverage + approved gaps).
  - [ ] Submodel inheritance/override rules encoded.
- [ ] Effects types and settings:
  - [ ] Pre-gate complete (source + API coverage + approved gaps).
  - [ ] Effect catalog + parameter schemas + compatibility rules encoded.
- [ ] Sequence planner integration:
  - [ ] Sequence functions mapped to validated command graph templates.
  - [ ] Deterministic tests added for mixed model/effect scenarios.

### Phase E: Timing Track Ownership in Sequence Agent
- [ ] Move timing-track write decisions fully into `sequence_agent`.
- [ ] Keep lock-aware behavior for all `XD:` generated timing tracks.
- [ ] Preserve user-owned manual tracks and never overwrite locked tracks.
- [ ] Emit explicit diagnostics for skipped writes due to lock policy.

### Phase F: Apply Verification and Readback
- [ ] Add deterministic post-apply verification checks:
  - [ ] revision advanced check
  - [ ] expected mutations present
  - [ ] locked tracks unchanged
- [ ] Add structured apply verification report to diagnostics bundle.
- [ ] Add failure reason taxonomy (`validate|revision|capability|lock|runtime|unknown`).

### Phase G: Acceptance Matrix and Regression Harness
- [ ] Expand in-app orchestration matrix to include sequence-agent execution scenarios.
- [ ] Add automated scenarios:
  - [ ] happy path apply from handoff graph
  - [ ] stale revision blocked
  - [ ] missing analysis degraded mode with warning
  - [ ] all-write-lock blocked
  - [ ] partial-scope apply
- [ ] Export matrix results as structured diagnostics artifact.

### Phase H: Training Package Integration
- [x] Add canonical `sequence_agent` profile in training package registry.
- [ ] Add/update module assets under `modules/xlights_sequencer_execution`:
  - [ ] prompts
  - [ ] fewshot
  - [ ] eval configuration
  - [ ] contracts references
- [x] Remove temporary alias compatibility and enforce canonical `sequence_agent` naming.

## 3) Exit Criteria
`sequence_agent` implementation is considered complete for v1 when:
- deterministic planning stages and command graph validation are active,
- apply executes from handoff graph by default,
- timing-track ownership is fully in `sequence_agent`,
- lock-preservation and stale/failure gates are verified in matrix runs,
- diagnostics export includes structured run, stage, and matrix outcomes.

## 4) Notes
- This checklist is implementation-facing and should be updated as phases move from planned to completed.
- Any scope changes should be reflected in:
  - `specs/xlights-sequencer-control-agent-orchestration-architecture.md`
  - `specs/xlights-sequencer-control-training-package-architecture.md`
