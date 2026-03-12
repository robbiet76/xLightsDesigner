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
- [x] Source audit complete (xLights code references documented).
- [x] API coverage map complete (source fields/enums/constraints mapped to automation API).
- [x] Gap list approved (missing/partial API surface documented and prioritized).
- [x] Domain semantic modeling starts only after source+API audit gate is complete.

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
- [x] Enforce revision gate and stale-plan gate uniformly.
- [x] Enforce safety policy on graph and per-node command groups.

### Phase I: xLights Domain Semantics (layout/models/groups/submodels/effects)
- [x] Enforce canonical boundary:
  - all `layout.*` state is read-only planner context
  - sequence/sequencer/effects/timing surfaces are the read/write mutation domain
- [x] Show layout and model spatial placement:
  - [x] Pre-gate complete (source + API coverage + approved gaps).
  - [x] Canonical scene graph schema defined in app layer.
  - [x] Spatial query helpers implemented (region/proximity/orientation).
  - [x] Layout mode awareness wired (`2d|3d`) with 3D-operation gating policy while preserving depth semantics in both modes.
- [x] Model types and functionality:
  - [x] Pre-gate complete (source + API coverage + approved gaps).
  - [x] Model type ontology + constraints documented and encoded.
- [x] Model groups and functionality:
  - [x] Pre-gate complete (source + API coverage + approved gaps).
  - [x] Group behavior rules encoded (fanout/stagger/mirror/distribution/preserve-vs-expand semantics).
  - [x] Initial display-element ordering heuristics encoded for group-first sequencing.
  - [x] Group-first planning uses explicit xLights group identity rather than name heuristics.
  - [x] Nested-group breadth preference uses authoritative direct/flattened membership graph.
  - [x] Baseline preserve-vs-expand rule encoded:
    - preserve explicit group targets by default
    - expand only on explicit per-member distribution requests
  - [x] Direct-member distribution baseline encoded:
    - deterministic staggered time slicing
    - mirrored member order on explicit request
  - [x] Nested-group distribution baseline encoded:
    - explicit flattened-member expansion on request
    - repeated-line member-order alternation without changing the section window model
    - repeated-line fanout round-robin rotation on explicit request
  - [x] Render-policy-aware preserve-vs-expand semantics encoded:
    - non-default group render targets require explicit member override before expansion
    - high-risk render policies (`overlay`, `stack`, `single_line`, `per_model_strand`) require force-style override before expansion
    - forced member expansion carries compatibility warnings into validation
    - v1 keeps layout-derived group render policy read-only and uses it only as planner context
- [x] Submodels and functionality:
  - [x] Pre-gate complete (source + API coverage + approved gaps).
  - [x] Baseline parent/submodel overlap rules encoded:
    - same-line parent + submodel overlap collapses to the parent target for broad writes
    - same-line parent + submodel overlap preserves submodel precision when the submodel has a materially different local render path
    - separate lines preserve explicit parent-first then submodel refinement behavior
    - sibling submodels remain valid concurrent precision targets when parent is absent
    - exact sibling overlap collapse uses authoritative submodel node-channel membership from automation
  - [x] Deeper submodel inheritance/render override rules encoded to the v1 boundary:
    - exact overlap detection from authoritative node-channel membership
    - risky local render-path preservation based on submodel render metadata
    - planner warnings and apply-time precision verification for parent broadening and sibling bleed
- [x] Effects types and settings:
  - [x] Pre-gate complete (source + API coverage + approved gaps).
  - [x] Effect catalog + parameter schemas + compatibility rules encoded.
  - [x] Group render-policy compatibility warnings encoded for forced member expansion paths.
- [x] Sequence planner integration:
  - [x] Sequence functions mapped to validated command graph templates.
  - [x] Deterministic tests added for mixed model/effect scenarios.
  - [x] Broad group-first coverage heuristic preserved when explicit aggregate targets are provided.

### Phase E: Timing Track Ownership in Sequence Agent
- [x] Move timing-track write decisions fully into `sequence_agent`.
- [x] Keep timing-track mutation policy fully inside `sequence_agent`.
- [x] Treat timing tracks as cumulative sequence state, like effects, against latest revision.
- [x] Preserve explicit write-disable diagnostics when timing writes are disabled by policy.

### Phase F: Apply Verification and Readback
- [x] Add deterministic post-apply verification checks:
  - [x] revision advanced check
  - [x] expected mutations present (timing marks, effects, display-element order, distributed effect windows, submodel precision safety including parent broadening and overlapping sibling bleed)
- [x] Add structured apply verification report to diagnostics bundle.
- [x] Add failure reason taxonomy (`validate|revision|capability|lock|runtime|unknown`).

### Phase G: Acceptance Matrix and Regression Harness
- [x] Expand in-app orchestration matrix to include sequence-agent execution scenarios.
- [x] Add automated scenarios:
  - [x] happy path apply from handoff graph
  - [x] stale revision blocked
  - [x] missing analysis degraded mode with warning
  - [x] cumulative timing edits remain writable
  - [x] partial-scope apply
  - [x] timing-track name agnostic behavior
  - [x] common corpus-backed layer/buffer setting acceptance
  - [x] rare-but-documented transition acceptance
  - [x] style-neutral command synthesis when shared settings are not requested
  - [x] apply path preserves corpus-backed effect settings without reinterpretation
  - [x] nested-group breadth preference and ordering
  - [x] render-policy-aware group preservation and force-override coverage
  - [x] apply path preserves forced group-expansion provenance metadata without reinterpretation
  - [x] parent/submodel overlap collapse and refinement preservation
- [x] Export matrix results as structured diagnostics artifact.

### Phase H: Training Package Integration
- [x] Add canonical `sequence_agent` profile in training package registry.
- [x] Add/update module assets under `modules/xlights_sequencer_execution`:
  - [x] prompts
  - [x] fewshot
  - [x] eval configuration
  - [x] contracts references
- [x] Remove temporary alias compatibility and enforce canonical `sequence_agent` naming.

## 3) Exit Criteria
`sequence_agent` implementation is considered complete for v1 when:
- deterministic planning stages and command graph validation are active,
- apply executes from handoff graph by default,
- timing-track ownership is fully in `sequence_agent`,
- cumulative timing edit behavior and stale/failure gates are verified in matrix runs,
- diagnostics export includes structured run, stage, and matrix outcomes.

## 4) Notes
- This checklist is implementation-facing and should be updated as phases move from planned to completed.
- Any scope changes should be reflected in:
  - `specs/xlights-sequencer-control-agent-orchestration-architecture.md`
  - `specs/xlights-sequencer-control-training-package-architecture.md`
