# Gap Audit: Current State vs Full Sequencer Control Target

Status: Updated after WP-6  
Date: 2026-03-02

## 1) Current Strengths
- v2 envelope and namespaced command surface are implemented across WP-1..WP-6.
- Core sequencing control set (29 WP-scoped commands) is now present in the v2 router.
- Harness now includes multi-suite JSON output and a validation-gate suite.
- CI workflow exists for harness linting/report artifact publishing.

## 2) Confirmed Remaining Gaps

### G1: `layout.getDisplayElements` Contract Gap
- Program-level docs reference this endpoint, but it is not currently implemented in v2 command routing.

### G2: Spec Drift and Semantic Mismatch Risk
- Several docs still reflected pre-WP-implementation assumptions (status/error examples).
- This has now been mostly corrected, but should be locked with a WP-7 doc freeze pass.

### G3: Deterministic Fixture Bundle Not Finalized
- Manifest and env templates exist, but a durable fixture pack/bootstrap path is still needed for truly repeatable local and CI runs.

### G4: Legacy Regression Coverage Needs Explicit Gate
- Core compatibility intent is clear, but there is no dedicated automated legacy command regression suite yet.

## 3) Actions Completed in This Audit Pass
- Refreshed implementation status matrix to post-WP-6 reality.
- Refreshed acceptance test matrix to match current behavior.
- Defined WP-7 scope for contract reconciliation and hardening.

## 4) WP-7 Focus
- Close `layout.getDisplayElements` endpoint gap.
- Finalize deterministic fixtures.
- Add explicit legacy regression gate.
- Freeze docs against implementation reality before new feature expansion.
