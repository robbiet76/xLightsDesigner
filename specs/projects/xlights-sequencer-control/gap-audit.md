# Gap Audit: Current State vs Full Sequencer Control Target

Status: Draft  
Date: 2026-03-02

## 1) Current Strengths
- Versioned v2 envelope direction exists and is already in flight.
- Audio timing + lyric scaffolding project is well-defined for Phase 1.
- Capability discovery and standardized response model are established patterns.

## 2) Confirmed Gaps to Close Before Further API Expansion

### G1: Program Scope Not Explicitly Locked
- Current specs are centered on audio timing/lyrics subproject.
- Missing a single source-of-truth contract for full sequencer control scope and boundaries.

### G2: Sequencer Control Surface Incomplete at Spec Level
- Missing complete command catalog for sequence lifecycle, display element ordering, and full effect lifecycle.
- Timing mark CRUD and effect bulk operations are not yet fully contract-defined.

### G3: Read-Only Layout Boundary Not Formally Enforced
- Project intent says layout writes are out of scope, but this is not locked in a dedicated top-level contract.

### G4: Controller Out-of-Scope Boundary Not Formalized
- Need explicit rule to prevent scope drift into controller APIs.

### G5: Autonomy Execution Requirements Are Underspecified
- Missing formal requirements for agent/Codex operation:
  - required local access,
  - non-interactive test harness expectations,
  - retry/stop criteria,
  - minimal human gate checkpoints.

### G6: Validation/Test Harness Plan Not Unified
- Current tests are per-phase.
- Missing unified autonomous “definition of done” checks spanning discovery -> mutation -> verification loops.

## 3) Actions Taken in This Spec Pass
- Added new full-scope project spec package:
  - `project-spec.md`
  - `api-surface-contract.md`
  - `autonomy-access-requirements.md`
  - `implementation-roadmap.md`
  - `decision-log.md`
- Updated top-level `specs/README.md` index.

## 4) Remaining Gaps After This Pass
- Add a durable fixture bundle (sample sequence/media/model set) for deterministic regression runs.
- Add CI job wiring that executes `scripts/xlights-control/run-all.sh` and publishes JSON reports.
