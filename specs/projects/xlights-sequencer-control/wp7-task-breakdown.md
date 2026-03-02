# WP-7 Task Breakdown

Status: Draft execution plan  
Date: 2026-03-02

## Task Group 1: Endpoint Gap Closure
### T1.1 Add `layout.getDisplayElements` in xLights v2 router
- Owner: xLights repo
- Status: In progress
- Changes:
  - Add command to capability list.
  - Implement read-only response assembly for display elements.
- Done when:
  - Command returns deterministic `data.elements[]` and passes smoke validation.

### T1.2 Add endpoint-level tests/assertions
- Owner: xLightsDesigner repo
- Changes:
  - Extend discovery smoke to assert `layout.getDisplayElements` success and payload shape.
- Done when:
  - Discovery suite passes with endpoint present.

## Task Group 2: Contract and Spec Reconciliation
### T2.1 Lock status matrix to current code
- Owner: xLightsDesigner repo
- Changes:
  - Keep command-by-command matrix synchronized to current branch head.
- Done when:
  - No stale “Missing”/“Legacy Equivalent” labels for implemented v2 commands.

### T2.2 Normalize acceptance semantics
- Owner: xLightsDesigner repo
- Changes:
  - Align expected status codes/payload keys to actual implementation semantics.
- Done when:
  - Acceptance matrix examples match observed behavior.

## Task Group 3: Deterministic Fixture Strategy
### T3.1 Define fixture bootstrap process
- Owner: xLightsDesigner repo
- Changes:
  - Add documented fixture bootstrap steps/script contract.
  - Clarify required env vars and fallback behavior.
- Done when:
  - A new environment can be prepared without ad hoc manual interpretation.

### T3.2 Tighten manifest assertions
- Owner: xLightsDesigner repo
- Changes:
  - Ensure fixture manifest includes baseline expectations for all required suites.
- Done when:
  - `run-all-summary.json` can be programmatically validated against manifest expectations.

## Task Group 4: Validation + Legacy Regression Hardening
### T4.1 Expand `system.validateCommands` semantic checks
- Owner: xLights repo
- Changes:
  - Add preflight checks for key high-risk command payload classes.
- Done when:
  - Validation catches known malformed mutation batches before execution.

### T4.2 Add legacy regression suite
- Owner: xLightsDesigner repo
- Status: Completed
- Changes:
  - Add non-v2 regression script covering representative legacy commands.
  - Wire into CI reporting.
- Done when:
  - Regression suite artifacts are produced and failures block CI.

## Task Group 5: Closeout
### T5.1 Re-run full harness and summarize outcomes
- Owner: both repos
- Done when:
  - Reports are generated for all suites and reviewed.

### T5.2 Final doc freeze for WP-7
- Owner: xLightsDesigner repo
- Done when:
  - WP-7 docs and implementation links are internally consistent.

## Suggested Execution Order
1. T1.1
2. T1.2
3. T2.1
4. T2.2
5. T3.1
6. T3.2
7. T4.1
8. T4.2
9. T5.1
10. T5.2

## Risks to Manage
- Hidden dependency on local user show data can make tests non-deterministic.
- Legacy command behavior may differ by xLights runtime state; regression setup must control preconditions.
- Over-tight validation rules can reject currently accepted but valid client payloads; changes should be explicit and version-safe.
