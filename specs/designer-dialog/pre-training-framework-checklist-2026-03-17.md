# Pre-Training Framework Checklist

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: finish the framework work that should be stabilized before the large designer-training push begins. The goal is to avoid repeated architecture churn while training examples, evals, and runtime behavior are being tuned.

## Exit Criteria

Before deep designer training starts:
- concept identity is stable and revision-ready
- Design / Review / Sequence boundaries are stable
- designer-to-sequencer handoff contract is stable
- concept-level revise/remove flows are defined
- evaluation surfaces are good enough to judge designer quality without additional framework churn
- temporary diagnostics / validation-only runtime hooks are removed from product code

## Checklist

### A. Clean Framework Baseline

- [x] Remove temporary grid/demo validation work from committed product behavior
- [x] Remove temporary desktop diagnostics hooks used only for live validation
- [x] Remove generated renderer artifacts from repo state
- [ ] Start training from a clean git worktree

Exit gate:
- the app framework is clean enough that training work is not mixed with ad hoc validation hooks

### B. Stable Concept Identity

- [x] Carry stable `designId` through designer, review, and sequence flows
- [x] Carry `designAuthor` through the same chain
- [x] Use compact display labels in the UI
- [x] Add first-class `designRevision`
- [x] Add derived `designLabel` based on true revision state, not default `0`
- [ ] Define numeric sort rules for concept id + revision everywhere the UI sorts concepts

Exit gate:
- concepts have stable identity and revision semantics before training starts

### C. Concept Lifecycle Operations

- [x] Support concept-level delete by `designId`
- [x] Support revise-in-place for an existing concept
- [x] Support supersede semantics for revised concepts in the active draft
- [ ] Ensure Sequence rows can distinguish current vs superseded concept revisions
- [ ] Ensure Review can compare a current concept revision against the previous one

Exit gate:
- the app can create, revise, and remove design concepts without inventing new workflow primitives mid-training

### D. Design / Review / Sequence Page Boundaries

- [x] Make Design conceptual rather than a sequence mirror
- [x] Make Review grouped by concept instead of raw proposal lines
- [x] Keep Sequence as the technical execution view
- [ ] Add a compact concept-to-sequence drill-down path that does not duplicate Sequence detail on Design
- [ ] Add concept-level empty states / stale states where the current UI is still ambiguous
- [ ] Confirm the Review page action model is final enough for training-driven iteration

Exit gate:
- the three major pages have stable responsibilities and a stable mental model

### E. Handoff Stability

- [x] Use placement-first handoff structure
- [x] Preserve `designId` into derived sequence commands
- [x] Preserve direct-user concepts through the same grouped review model
- [x] Add `designRevision` to handoff contracts
- [x] Define revise/supersede handoff semantics explicitly in spec
- [ ] Freeze the pre-training handoff contract version for the training phase

Exit gate:
- training can target one stable handoff contract rather than a moving one

### F. Evaluation Surfaces

- [ ] Define the concept-quality rubric used to judge designer output
- [ ] Define the whole-sequence-quality rubric used to judge a broad pass
- [ ] Add stable diagnostics snapshots for design concepts, linked sequence rows, and apply results
- [ ] Make it possible to inspect one concept cleanly without reading raw effect rows unless needed

Exit gate:
- humans can evaluate designer quality consistently during training without needing new framework work

## Recommended Order

1. Clean Framework Baseline
2. Stable Concept Identity
3. Concept Lifecycle Operations
4. Handoff Stability
5. Evaluation Surfaces
6. Deep training
