# Designer Dialog Implementation Checklist

Status: Active
Date: 2026-03-12
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-12

Purpose: complete `designer_dialog` as a true specialist runtime that owns creative intent capture, clarification, brief synthesis, proposal generation, and proposal lifecycle up to the `sequence_agent` handoff boundary.

## Role Lock

- `designer_dialog` is not a passive form-filler. It is an autonomous creative specialist.
- It should make bounded creative assumptions when the user provides enough direction to proceed safely.
- It should ask questions only when the missing answer materially affects:
  - scope
  - safety
  - reviewability
  - ability to produce a coherent design direction
- It must learn and reuse director preferences over time as soft guidance, not as hard stylistic cloning.
- It must remain review-first:
  - autonomous in proposal generation
  - not autonomous in hidden apply

## Locked Boundary

- `audio_analyst` owns media analysis only.
- `designer_dialog` owns user-facing creative conversation, creative brief, intent normalization, clarification, and proposal lifecycle.
- `sequence_agent` owns technical sequencing plans and xLights apply behavior.
- `layout.*` remains read-only context.
- `sequence_*`, `sequencer.*`, `effects.*`, `timing.*` mutation remains downstream of approved designer intent.

## Phase A: Contracts

- [ ] Define `designer_dialog_input_v1`
- [ ] Define `creative_brief_v1`
- [ ] Define `proposal_bundle_v1`
- [ ] Define `designer_dialog_result_v1`
- [ ] Add contract validation gates in runtime code
- [ ] Add training-package JSON contracts for all four

Exit gate:
- Designer runtime accepts/returns only canonical contract shapes.

## Phase B: Intent + Clarification

- [ ] Expand intent normalization beyond current prompt heuristics:
  - mode
  - style direction
  - color direction
  - focus hierarchy
  - change tolerance
  - preservation constraints
- [ ] Add explicit assumption policy:
  - when to ask
  - when to proceed
  - how to record assumptions in brief/proposal
- [ ] Add preference-memory inputs for director tendencies:
  - likes/dislikes
  - pacing/motion preference
  - focus preference
  - change-tolerance preference
- [ ] Replace ad hoc guided questions with field-targeted clarification generation
- [ ] Make question generation context-aware using:
  - audio sections
  - target scope
  - current sequence revision state
  - prior captured brief
  - prior director preferences
- [ ] Add deterministic tests for clarification output

Exit gate:
- Missing critical fields are surfaced through explicit clarification deltas, not hidden app state.
- Non-critical gaps are handled through explicit, reviewable designer assumptions.

## Phase C: Creative Brief Runtime

- [ ] Implement canonical `creative_brief_v1`
- [ ] Extract brief synthesis out of app helpers into designer runtime
- [ ] Define brief update/merge rules
- [ ] Define traceability fields for:
  - audio context
  - song context
  - reference media
  - user notes/goals/inspiration
  - inferred designer assumptions
  - learned director preferences used in the pass
- [ ] Add fidelity tests for brief generation and update behavior

Exit gate:
- Designer brief is a real domain artifact, not a loose app object.

## Phase D: Proposal Bundle Runtime

- [ ] Define canonical `proposal_bundle_v1`
- [ ] Replace proposal seed-line handling with a structured proposal bundle
- [ ] Include:
  - summary
  - scope
  - constraints
  - proposed lines/edits
  - impact summary
  - risk notes
  - explicit assumption list
  - base revision
- [ ] Add stale/rebase markers to proposal bundle state
- [ ] Ensure proposal bundle is the only upstream input used to generate sequence-agent plans

Exit gate:
- Proposal lifecycle is explicit and revision-aware.

## Phase E: Runtime Extraction

- [ ] Add `designer-dialog-contracts.js`
- [ ] Add `designer-dialog-runtime.js`
- [ ] Add `designer-dialog-orchestrator.js`
- [ ] Add `designer-dialog-ui-state.js`
- [ ] Move proposal-generation orchestration out of `app.js`
- [ ] Move proposal stale/rebase logic out of `app.js`
- [ ] Move creative brief state projection out of `app.js`
- [ ] Keep `app.js` to UI wiring and action dispatch

Exit gate:
- `designer_dialog` runtime is structurally comparable to `audio_analyst` and `sequence_agent`.

## Phase F: Handoff Integrity

- [ ] Emit canonical `intent_handoff_v1` from the new designer runtime
- [ ] Ensure `intent_handoff_v1` is derived from the proposal bundle / creative brief, not ad hoc app assembly
- [ ] Add tests that prove stable downstream handoff behavior for:
  - new proposal
  - refine proposal
  - stale proposal regeneration
- [ ] Add degraded-mode behavior when upstream analysis is missing

Exit gate:
- `sequence_agent` receives consistent designer handoffs regardless of UI path.

## Phase G: Training Package

- [ ] Align `designer_dialog.agent.json` to the real runtime boundary
- [ ] Upgrade `lighting_design_principles` from scaffold to active module
- [ ] Add few-shot examples for:
  - first-pass creative kickoff
  - clarification round
  - proposal refinement
  - constrained surgical revise
  - degraded mode without analysis
- [ ] Add eval cases for:
  - brief alignment
  - clarification quality
  - proposal determinism
  - handoff completeness
- [ ] Point datasets at canonical runtime/spec references

Exit gate:
- Designer training assets are at parity with the actual runtime role.

## Phase H: Tests + Diagnostics

- [ ] Add dedicated contract tests
- [ ] Add runtime tests
- [ ] Add orchestration tests
- [ ] Add brief fidelity tests
- [ ] Add proposal lifecycle tests
- [ ] Add failure taxonomy for:
  - clarification
  - proposal generation
  - stale rebase
  - handoff validation
- [ ] Export designer diagnostics in structured form
- [ ] Add tests that prove the agent proceeds autonomously on broad but usable prompts instead of over-questioning
- [ ] Add tests that prove learned preferences influence proposals without forcing stylistic cloning

Exit gate:
- Designer failures are classified, testable, and diagnosable.

## Current State Snapshot

Implemented now:
- [x] Dedicated repo domain:
  - `apps/xlightsdesigner-ui/agent/designer-dialog/`
  - `apps/xlightsdesigner-ui/tests/agent/designer-dialog/`
  - `specs/designer-dialog/`
- [x] Initial Phase A contract layer:
  - `designer-dialog-contracts.js`
  - training-package JSON contracts for input/brief/proposal/result
  - focused contract tests
- [x] Basic intent normalization helper
- [x] Basic guided-question helper
- [x] Basic creative-brief helper
- [x] Basic proposal seeding helper
- [x] Basic determinism/planner tests

Not yet implemented:
- [ ] canonical designer contracts
- [ ] dedicated runtime/orchestrator
- [ ] structured proposal bundle
- [ ] creative brief artifact contract
- [ ] dedicated training few-shot/eval assets
- [ ] broad designer runtime test coverage

## Post-v1 Cleanup

- [ ] Decompose remaining shared designer lifecycle code in `app.js` once designer runtime is stable.
