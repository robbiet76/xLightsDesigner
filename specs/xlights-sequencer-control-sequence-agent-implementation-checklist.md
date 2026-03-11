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

### Phase A: Role Contract and Data Shapes
- [ ] Define canonical `sequence_agent` input contract.
- [ ] Define canonical `sequence_agent` output contract (`plan_handoff_v1` + apply result contract).
- [ ] Define required/optional fields for degraded mode (missing analysis handoff).
- [ ] Define contract versioning and migration policy.

### Phase B: Deterministic Planning Pipeline
- [ ] Implement deterministic planning stages:
  - [ ] scope resolution (sections, targets, tags)
  - [ ] timing asset decision stage (create/use/skip)
  - [ ] effect strategy stage
  - [ ] command graph synthesis stage
- [ ] Add stage-level failure classification and policy.
- [ ] Add stage timing telemetry and run-id correlation.

### Phase C: Command Graph as Source of Truth
- [ ] Define canonical command graph node schema.
- [ ] Add graph integrity validation (dependencies, ordering, duplicate writes, unsafe writes).
- [ ] Ensure apply path executes from `plan_handoff_v1.commands` by default.
- [ ] Restrict fallback regeneration paths to explicit non-default cases only.

### Phase D: xLights Capability and Safety Integration
- [ ] Build capability matrix usage in planning stage.
- [ ] Add explicit blocked/unsupported mapping per command category.
- [ ] Enforce revision gate and stale-plan gate uniformly.
- [ ] Enforce safety policy on graph and per-node command groups.

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
- [ ] Add canonical `sequence_agent` profile in training package registry.
- [ ] Add/update module assets under `modules/xlights_sequencer_execution`:
  - [ ] prompts
  - [ ] fewshot
  - [ ] eval configuration
  - [ ] contracts references
- [ ] Maintain temporary alias compatibility for `sequencer_designer` during migration.

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
