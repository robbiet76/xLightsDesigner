# macOS Native History Relationship (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define how `History` relates to the rest of the native workflow.

This is needed to keep `History` clearly retrospective and prevent it from drifting back into pending-review territory.

Primary parent sources:
- `macos-native-history-screen-layout-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-history-workflow-review-from-electron-2026-04-06.md`

## Relationship Rule

`History` begins only after implementation has become past tense.

Ownership split:
- `Review` owns pending implementation decision
- `History` owns completed implementation inspection

## Boundary Rules

1. `History` must never be the place where a user decides whether to apply a pending change
2. `History` may reference prior design, sequence, and review artifacts only as historical evidence
3. `History` may point back to current state, but only secondarily and non-actionably

## Transition Rules

### Review -> History

Move to `History` after apply completes or when the user wants to inspect prior completed work.

The transition should feel like moving from decision to audit.

### History -> Review

Return from `History` to `Review` only when a user intentionally wants to inspect current pending work.

This should not feel like one continuous mixed screen.

## Acceptance Criteria For This Relationship

This relationship is design-ready only when:
1. `History` is unmistakably retrospective
2. `Review` remains the only pending-decision surface
3. completed and pending work are clearly separated in language and structure
4. artifact evidence in `History` supports inspection without turning into a live control surface
