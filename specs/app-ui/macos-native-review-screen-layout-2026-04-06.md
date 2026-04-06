# macOS Native Review Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Review` screen layout contract.

This screen is the implementation gate for the current pending work. It must explain impact, readiness, and approval state clearly, without turning into either a design-ideation surface or a live technical dashboard.

Primary parent sources:
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-information-architecture-2026-04-06.md`

## Screen Purpose

The `Review` screen exists to do five jobs clearly:
1. summarize what is pending right now
2. summarize the design and sequence state that will drive implementation
3. show apply readiness and impact
4. show approval/defer/apply controls
5. show backup/restore visibility tied to the pending implementation

It is not a creative ideation space.
It is not a live technical translation dashboard.
It is not a revision-history browser.

## Primary User Goals

1. understand what is about to change
2. understand whether the pending state is ready to apply
3. understand impact and blockers
4. approve, defer, or reject the pending implementation

## Entry Conditions

- active project normally exists
- there may or may not be pending implementation state; empty state must explain that clearly

## Exit Conditions

The user should be able to leave this screen knowing one of these is true:
1. the pending implementation is approved and applied
2. the pending implementation is not ready and the blocker is clear
3. the pending implementation was deferred or rejected intentionally

## Layout Overview

The native `Review` screen should use a top pending-summary band with a lower summary-and-action layout.

Primary structure:
1. page header
2. pending implementation summary band
3. supporting summaries band
4. approval/apply band

Lower band layout:
- left: design + sequence summaries
- right: readiness, impact, backup/restore, and approval actions

The key rule is:
- the apply decision surface must be visually dominant
- supporting summaries must inform the decision without taking over the page

## Region Definition

### Region A: Page Header

Required contents:
- title: `Review`
- short purpose line:
  - `Inspect the current pending implementation and decide whether to apply it.`

### Region B: Pending Implementation Summary Band

Purpose:
- tell the user immediately what is pending now

Required contents:
- concise pending-change summary
- pending status
- target sequence/context summary
- high-level readiness state

Required empty-state alternative:
- `Nothing pending to review`
- short explanation of why the page is empty

### Region C: Supporting Summaries Band

Purpose:
- summarize the two upstream lenses that inform the decision

Required subpanels:
1. design summary
2. sequence summary

Rule:
- these are summaries, not full dashboards
- `Review` references them; it does not replace their home screens

### Region D: Approval / Apply Band

Purpose:
- own the decision and action surface

Required contents:
- readiness summary
- blockers/warnings
- implementation impact summary
- backup/restore visibility
- primary actions:
  - `Apply`
  - `Defer`
  - `Reject` or equivalent later if needed

Rule:
- this is the dominant action area on the screen

## State Variants

The wireframe and prototype set for `Review` must cover:
1. nothing pending
2. pending and ready to apply
3. pending but blocked
4. apply in progress
5. apply complete / post-apply confirmation state

## Interaction Rules

1. `Review` is the only one of the three that owns final approval/apply actions
2. design and sequence appear here only as summary inputs to the decision
3. blockers must be explicit and decision-oriented
4. backup/restore visibility must be adjacent to apply readiness, not buried elsewhere

## Read-Model Expectations

Expected logical groups:
- `pendingImplementation`
- `designSummary`
- `sequenceSummary`
- `readiness`
- `impact`
- `backupRestore`
- `approvalActions`

## Out Of Scope For This Screen

Do not add:
- creative ideation tools
- detailed live technical translation dashboards
- revision-history browsing
- standalone audio analysis controls

## Decisions Locked Here

1. `Review` is the implementation gate and apply surface
2. pending implementation summary is the first read surface
3. design and sequence appear as supporting summaries only
4. approval/apply is visually dominant on this screen
