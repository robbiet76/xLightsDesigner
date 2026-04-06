# macOS Native Design / Sequence / Review Coupled Review (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Tighten the coupled behavior of `Design`, `Sequence`, and `Review` beyond their individual screen contracts.

The individual screens are already defined.
This document locks the practical transition and summary rules that keep them feeling like one lifecycle instead of three disconnected tabs.

Primary parent sources:
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-design-screen-layout-2026-04-06.md`
- `macos-native-sequence-screen-layout-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-design-workflow-review-from-electron-2026-04-06.md`
- `macos-native-sequence-workflow-review-from-electron-2026-04-06.md`
- `macos-native-review-workflow-review-from-electron-2026-04-06.md`

## Coupled Lifecycle Rule

These three screens are one pending-work lifecycle viewed from different angles.

1. `Design` explains the meaning of the current proposal
2. `Sequence` explains the technical translation of that proposal
3. `Review` explains the pending implementation impact and decision

## Transition Rules

### Design -> Sequence

Move to `Sequence` when the user asks:
- how is this proposal being translated technically
- what is bound to the active sequence
- what is technically blocked

The transition should feel like moving from intent to execution context.

### Sequence -> Review

Move to `Review` when the user asks:
- what would happen if I applied this now
- is it ready to approve
- what is the implementation impact

The transition should feel like moving from technical readiness to decision.

### Review -> Design or Sequence

Return from `Review` to:
- `Design` if the pending problem is conceptual or artistic
- `Sequence` if the pending problem is technical or translation-related

## Shared Summary Rules

The three screens must stay aligned on:
- which pending proposal/snapshot is current
- whether the work is coherent, blocked, or ready
- what sequence context applies when relevant
- whether warnings are creative, technical, or approval-related

## Ownership Rules

### Design
Owns:
- creative brief and proposal meaning
- rationale
- open questions
- design warnings

Does not own:
- detailed technical translation state
- final approval status
- apply controls

### Sequence
Owns:
- active sequence identity
- bound track metadata visibility
- timing-substrate visibility
- technical readiness and blockers

Does not own:
- creative authoring
- final approval ownership

### Review
Owns:
- pending implementation summary
- impact
- approval readiness
- backup/restore visibility
- apply/defer actions

Does not own:
- creative ideation
- live technical dashboard ownership

## Shared Region Priority Rules

1. `Design` top region = creative summary
2. `Sequence` top region = active sequence context
3. `Review` top region = pending implementation summary

These priorities must remain stable even when state changes.

## Acceptance Criteria For This Coupled Set

This coupled set is design-ready only when:
1. each screen answers a clearly different primary question
2. the transition from `Design` to `Sequence` to `Review` feels like one lifecycle
3. supporting summaries do not become full duplicate dashboards
4. approval/apply ownership remains only in `Review`
5. sequence identity remains local to `Sequence` and secondary elsewhere
