# Architecture Reset Plan (2026-03-11)

Status: Active execution plan
Date: 2026-03-11
Owner: xLightsDesigner program
Last Reviewed: 2026-03-11

Purpose: Re-anchor implementation to one high-level plan with explicit gates, boundaries, and sequencing.

## 1) Why Reset

Current implementation has made strong progress, but delivery has drifted into tactical iteration.  
This reset defines one authoritative execution spine so features are delivered in a controlled order with measurable acceptance criteria.

## 2) Source-of-Truth Stack

Use this hierarchy when conflicts exist:

1. `xlights-sequencer-control-project-spec.md` (program scope and hard boundaries)
2. `xlights-sequencer-control-training-package-architecture.md` (portable training architecture)
3. `xlights-sequencer-control-agent-orchestration-architecture.md` (multi-agent role boundaries and handoff contracts)
4. `xlights-sequencer-control-architecture-reset-plan-2026-03-11.md` (execution plan and gates)
5. work-package docs (`wp*`, task breakdowns, status matrix)

Rule:
- If a lower document conflicts with higher priority docs, update the lower doc before shipping new feature work.

## 3) Current State Snapshot

Implemented foundations:
- Packaged desktop runtime with app/UI bridge and diagnostics.
- Cloud conversational agent path (OpenAI-compatible BYO key).
- Audio analysis service integration with beat/bars/chords/lyrics/section generation.
- Training package v1 scaffold with `audio_track_analysis`, `lighting_design_principles`, `xlights_sequencer_execution`.
- Manual timing track preservation logic and sequence-sidecar metadata flow.

Known risks:
- Spec drift between tactical behavior and documented acceptance.
- Partial evaluation loops for structure quality still limited by small ground-truth set.
- Sequence/save-sidecar consistency recently improved but needs explicit validation gate coverage.

## 4) Locked Architecture Boundaries

### 4.1 xLights boundary
- xLights remains deterministic execution engine and source of truth for sequence data.
- No creative decision logic in xLights API layer.

### 4.2 App boundary
- xLightsDesigner owns orchestration, agent reasoning, and user workflow.
- Sequence-specific mutable metadata belongs in sequence `.xdmeta` sidecar, not global app/project state.

### 4.3 Analysis boundary
- Audio analysis is service-backed with provider adapters.
- No fake success fallbacks that create misleading “PASS” behavior.

### 4.4 Training boundary
- Training assets must be package-first under `training-packages/training-package-v1`.
- Runtime prompts and evaluation inputs should resolve through package manifests.

## 5) Execution Phases (Authoritative)

## Phase A: Stabilize Contracts + State Ownership
Goal: remove ambiguity in data ownership and persistence behavior.

Tasks:
- Finalize and document sidecar sync contract (`.xsq`/`.xdmeta` save-gated behavior).
- Confirm sequence-specific metadata not written to global project snapshots.
- Add explicit diagnostics for metadata dirty/flush state.
- Update acceptance-test matrix with sidecar consistency tests.

Exit gate:
- PASS on save-origin matrix:
  - app save,
  - xLights save,
  - no-save (no sidecar write).

## Phase B: Audio Analysis Quality Hardening
Goal: make analysis outputs reliable enough for downstream sequencing decisions.

Tasks:
- Lock provider selection policy and evidence reporting.
- Harden BPM/meter reconciliation and correction rules.
- Maintain manual-lock behavior for all timing tracks.
- Expand offline/app-path evaluation workflow and report format.

Exit gate:
- Repeatable backend eval report generated from canonical script.
- No overwrite of manual-locked tracks in regression scenarios.

## Phase C: Conversational Agent Core (Non-canned)
Goal: robust multi-turn designer conversation and intent-to-plan behavior.

Tasks:
- Lock role orchestration across `audio_analyst` -> `designer_dialog` -> `sequence_agent`.
- Implement structured handoff payloads (`analysis_handoff_v1`, `intent_handoff_v1`, `plan_handoff_v1`).
- Finalize orchestrator contract for guided dialog + proposal lifecycle.
- Ensure stateful context continuity across turns.
- Validate apply gating (approval, revision checks, dry-run path).

Exit gate:
- End-to-end conversation-to-proposal-to-approved-apply flow passes in packaged app.

## Phase D: Sequencer Execution and Creative Loop
Goal: agent can execute full creative loop while user remains director.

Tasks:
- Integrate model/submodel semantic targeting and effect planning loops.
- Ensure deterministic apply/rebase/conflict behavior.
- Complete failure recovery and rollback expectations.

Exit gate:
- Autonomous non-UI loop acceptance tests pass for create/open/edit/save/readback.

## Phase E: Release Hardening
Goal: controlled preview-to-stable path.

Tasks:
- Run non-dev install validation protocol.
- Complete desktop validation evidence log.
- Freeze docs, acceptance matrix, and runbook references for release.

Exit gate:
- Go/No-Go recorded with evidence links and unresolved-risk list.

## 6) Working Rules During Execution

- No new feature starts without mapping to one phase and one exit gate.
- Any behavior change must update relevant spec docs in same PR.
- Diagnostics should explain “why” (provider selected, correction applied, track preserved).
- Avoid patching symptoms when root-cause correction is feasible.

## 7) Next 2-Week Plan (Immediate)

1. Close Phase A documentation and tests (state ownership + sidecar sync matrix).
2. Finish Phase B evaluation harness/report standardization.
3. Begin Phase C conversation quality pass against explicit acceptance scripts.

## 8) Required Spec Updates Triggered by This Reset

- `README.md`: mark this document as active execution spine.
- `implementation-roadmap.md`: note it is governed by this reset plan.
- `acceptance-test-matrix.md`: add sidecar consistency and manual-lock test cases.
