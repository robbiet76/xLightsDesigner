# macOS Native Design Sequence Review Build Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the build-facing package for the coupled native `Design + Sequence + Review` implementation slice.

This package translates the approved lifecycle design for pending creative work, technical translation, and implementation review into implementation-ready screen composition, read-model mapping, action inventory, service dispatch rules, and transition rules.

Primary parent sources:
- `macos-native-design-screen-layout-2026-04-06.md`
- `macos-native-sequence-screen-layout-2026-04-06.md`
- `macos-native-review-screen-layout-2026-04-06.md`
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-design-sequence-review-coupled-review-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`

## Build-Package Rule

This package must answer:
1. what native view hierarchies are built for `Design`, `Sequence`, and `Review`
2. what screen models drive them
3. what local UI state is allowed
4. what actions the user can trigger
5. what shared services are called
6. how transitions among the three screens behave
7. what is out of scope for the first slice of this coupled set

## Coupled Slice Goal

The first native `Design + Sequence + Review` slice should let a user:
1. open `Design` and understand the current creative direction
2. open `Sequence` and understand active sequence identity, binding, and technical readiness
3. open `Review` and understand what is pending, whether it is ready, and what the implementation impact is
4. move among the three screens without losing the sense that they are looking at the same pending work from different angles

It does not need to solve every advanced workflow inside those screens.
It needs to establish the correct lifecycle boundaries.

## First-Slice Non-Goals

Do not include in the first native `Design + Sequence + Review` slice:
- full design authoring/chat reconstruction inside the native shell
- advanced sequence control beyond the agreed sequence-context and readiness surface
- heavy live dashboards
- deep historical browsing
- broad xLights operator tooling
- hidden shell-specific business logic for apply/readiness decisions

## Shared Pending-Work Identity Rule

These three screens must all render against one coherent pending-work identity.

That identity should provide:
- current proposal or design snapshot identity
- related sequence context identity when relevant
- current pending implementation summary identity
- recency/status coherence across all three screens

The native shell must not invent its own parallel pending-work truth.

## Native View Hierarchy: Design

The first native `Design` implementation should use this view hierarchy.

1. `DesignScreen`
2. `WorkflowPageHeader`
3. `DesignSummaryBand`
4. `DesignMainSplit`
5. `DesignProposalPane`
6. `DesignRationalePane`

### `DesignScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to design artifact services when needed
- composition of `DesignScreenModel`

Contains:
- `WorkflowPageHeader`
- `DesignSummaryBand`
- `DesignMainSplit`

### `DesignSummaryBand`
Contains:
- creative brief summary
- proposal summary
- design readiness state
- optional lightweight sequence-scoped note when truly relevant

### `DesignMainSplit`
Left child:
- `DesignProposalPane`

Right child:
- `DesignRationalePane`

### `DesignProposalPane`
Contains:
- brief summary
- proposal bundle summary
- reference direction summary
- director profile influence summary when relevant

### `DesignRationalePane`
Contains:
- rationale notes
- assumptions
- open questions
- warnings

## Design Screen Model Mapping

The first implementation should consume one screen-level read model:
- `DesignScreenModel`

Recommended shape:

```text
DesignScreenModel
- header
- summary
- proposal
- rationale
- localCapabilities
- banners
```

### `summary`
Contains:
- design status
- brief summary
- proposal summary
- optional pending-work identity summary

### `proposal`
Contains:
- brief payload summary
- proposal payload summary
- reference direction summary
- director profile influence summary

### `rationale`
Contains:
- rationale notes
- assumptions
- open questions
- warnings

## Native View Hierarchy: Sequence

The first native `Sequence` implementation should use this view hierarchy.

1. `SequenceScreen`
2. `WorkflowPageHeader`
3. `SequenceContextBand`
4. `SequenceMainSplit`
5. `SequenceTranslationPane`
6. `SequenceDetailPane`

### `SequenceScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to sequence and xLights-adjacent services where allowed
- composition of `SequenceScreenModel`

Contains:
- `WorkflowPageHeader`
- `SequenceContextBand`
- `SequenceMainSplit`

### `SequenceContextBand`
Contains:
- active sequence identity
- revision summary
- bound track metadata summary
- timing-substrate summary

### `SequenceMainSplit`
Left child:
- `SequenceTranslationPane`

Right child:
- `SequenceDetailPane`

### `SequenceTranslationPane`
Contains:
- translation readiness summary
- blockers/warnings
- concise handoff or plan summary

### `SequenceDetailPane`
Contains:
- sequence settings/revision detail
- binding detail
- timing-substrate/materialization detail
- supporting technical warnings

## Sequence Screen Model Mapping

The first implementation should consume one screen-level read model:
- `SequenceScreenModel`

Recommended shape:

```text
SequenceScreenModel
- header
- activeSequence
- translationSummary
- detail
- localCapabilities
- banners
```

### `activeSequence`
Contains:
- sequence name/path summary
- revision summary
- bound track metadata summary
- timing-substrate summary

### `translationSummary`
Contains:
- readiness state
- blockers
- warnings
- concise handoff/plan summary

### `detail`
Contains:
- sequence settings summary
- binding detail
- timing/materialization detail
- technical warning detail

## Native View Hierarchy: Review

The first native `Review` implementation should use this view hierarchy.

1. `ReviewScreen`
2. `WorkflowPageHeader`
3. `ReviewPendingBand`
4. `ReviewSupportSplit`
5. `ReviewActionPane`

### `ReviewScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to review/apply services
- composition of `ReviewScreenModel`

Contains:
- `WorkflowPageHeader`
- `ReviewPendingBand`
- `ReviewSupportSplit`
- `ReviewActionPane`

### `ReviewPendingBand`
Contains:
- pending implementation summary
- target sequence/context summary
- high-level readiness state

### `ReviewSupportSplit`
Left child:
- design summary panel

Right child:
- sequence summary panel

These are summaries only, not duplicate dashboards.

### `ReviewActionPane`
Contains:
- readiness summary
- impact summary
- blocker/warning summary
- backup/restore visibility
- action bar with:
  - `Apply`
  - `Defer`
  - optional later rejection action

## Review Screen Model Mapping

The first implementation should consume one screen-level read model:
- `ReviewScreenModel`

Recommended shape:

```text
ReviewScreenModel
- header
- pendingSummary
- designSummary
- sequenceSummary
- readiness
- impact
- backupRestore
- approvalActions
- banners
```

### `pendingSummary`
Contains:
- pending-change summary
- status
- target sequence/context summary
- high-level readiness state

### `designSummary`
Contains:
- concise design-side summary only

### `sequenceSummary`
Contains:
- concise sequence-side summary only

### `readiness`
Contains:
- apply readiness state
- blockers
- warnings

### `impact`
Contains:
- implementation impact summary

### `backupRestore`
Contains:
- backup availability summary
- restore visibility relevant to current pending work

### `approvalActions`
Contains:
- can apply
- can defer
- apply in progress state
- completion state if relevant

## Local UI State

The coupled native slice should keep these as local shell state only:
- expanded/collapsed rationale subsections in `Design`
- selected local technical subpanel in `Sequence` if needed
- review confirmation sheet state
- in-progress apply confirmation state
- local banners/toasts for the three screens

Do not persist as durable truth:
- transient expansion state
- transient apply sheet visibility
- stale pending-work copies maintained only for shell convenience

## Action Inventory

### Design first-slice actions
- inspect design summary
- inspect proposal summary
- inspect rationale and warnings

The first slice does not require full design authoring controls.

### Sequence first-slice actions
- inspect active sequence context
- inspect translation readiness
- inspect binding and timing detail
- optional refresh/select/open action only if already cleanly supported by shared services

### Review first-slice actions
- inspect pending implementation
- inspect supporting design and sequence summaries
- apply when ready
- defer pending work

## Service Dispatch Map

### Design artifact service
Used for:
- load design summary inputs
- load proposal/rationale summaries

### Sequence service
Used for:
- load active sequence context
- load binding/timing/readiness summaries
- refresh sequence state where supported

### Review/apply service
Used for:
- load pending implementation summary
- load readiness/impact summaries
- perform apply or defer actions

### xLights client service
Used only through the shared service boundary where sequence refresh/state inspection requires it.
The native shell must not own route logic directly.

## Transition Rules

### Entering `Design`
1. load current creative summary first
2. load proposal and rationale summaries
3. preserve only local presentation state that is still valid

### Entering `Sequence`
1. load active sequence context first
2. load translation readiness summary
3. load supporting technical detail
4. do not imply apply ownership here

### Entering `Review`
1. load pending implementation summary first
2. load supporting design and sequence summaries
3. load readiness, impact, and backup state
4. keep the apply decision region dominant

### Moving `Design -> Sequence`
1. preserve shared pending-work identity
2. switch emphasis from creative meaning to technical translation
3. do not create the feeling of changing to a different work item

### Moving `Sequence -> Review`
1. preserve shared pending-work identity
2. switch emphasis from technical readiness to implementation decision
3. do not duplicate sequence dashboard detail in `Review`

### Moving `Review -> Design|Sequence`
1. preserve the same pending-work identity
2. make the reason for moving back clear through the destination screen’s ownership

## Error Handling Rules

### Design
- empty or partial design state should not feel like application failure
- warnings remain local and explanatory

### Sequence
- distinguish between no active sequence, blocked sequence readiness, and actual load failure
- keep structure visible during refresh and failure when possible

### Review
- distinguish between `nothing pending`, `pending but blocked`, and real apply/load failure
- keep the action region structurally visible whenever possible

## SwiftUI Build Notes

This package implies the native implementation should likely map to:
- `DesignScreenView`
- `SequenceScreenView`
- `ReviewScreenView`
- one screen adapter/view model per screen
- shared pending-work identity passed through screen models from shared services
- platform-backed service clients for:
  - design artifact service
  - sequence service
  - review/apply service

The native shell remains a client/composition layer.
Do not move apply rules, sequence binding rules, or proposal truth into SwiftUI.

## Build-Readiness Gate

The `Design + Sequence + Review` native slice is ready to implement when:
1. the three view hierarchies are accepted
2. the three screen-model shapes are accepted
3. the shared pending-work identity rule is accepted
4. the transition rules are accepted
5. the action inventories are accepted
6. the service dispatch map is accepted
7. the non-goals list is accepted

If all seven are true, this coupled native implementation can begin without reopening broad lifecycle design.
