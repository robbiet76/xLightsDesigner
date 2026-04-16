# macOS Native History Build Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the build-facing package for the native `History` implementation slice.

This package translates the approved `History` screen and relationship design into implementation-ready screen composition, read-model mapping, action inventory, service dispatch rules, and explicit retrospective boundaries.

Primary parent sources:
- `macos-native-history-screen-layout-2026-04-06.md`
- `macos-native-history-relationship-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`

## Build-Package Rule

This package must answer:
1. what native view hierarchy is built for `History`
2. what screen model drives it
3. what local UI state is allowed
4. what actions the user can trigger
5. what shared services are called
6. what is explicitly out of scope for the first slice

## Slice Goal

The first native `History` slice should let a user:
1. open `History` from an active project
2. see a concise historical summary
3. browse historical revisions/events in a dense native table
4. select one historical row and inspect its detail
5. understand what happened, when it happened, and what evidence exists
6. open related artifact references when supported

It does not need to solve every advanced audit/export feature.
It needs to establish a clear retrospective workflow that does not overlap with `Review`.

## First-Slice Non-Goals

Do not include in the first native `History` slice:
- pending approval/apply controls
- live sequence dashboard behavior
- design authoring controls
- raw log-browser experience
- complex analytics/metrics dashboarding
- shell-side mutation of historical truth

## Retrospective Rule

`History` is retrospective only.

Working rule:
- `Review` owns pending implementation decision
- `History` owns completed implementation inspection
- `History` may point to evidence and prior artifacts
- `History` must not become an action surface for current pending work

## Native View Hierarchy

The first native `History` implementation should use this view hierarchy.

1. `HistoryScreen`
2. `WorkflowPageHeader`
3. `HistorySummaryBand`
4. `HistoryMainSplit`
5. `HistoryEventTable`
6. `HistoryDetailPane`

### `HistoryScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to history services
- composition of `HistoryScreenModel`

Contains:
- `WorkflowPageHeader`
- `HistorySummaryBand`
- `HistoryMainSplit`

### `HistorySummaryBand`
Contains:
- total event count
- latest event summary
- latest event timestamp
- optional lightweight event-type summary

### `HistoryMainSplit`
Left child:
- `HistoryEventTable`

Right child:
- `HistoryDetailPane`

### `HistoryEventTable`
Uses:
- `DataTableWrapper`

Columns:
- `When`
- `Type`
- `Summary`
- `Sequence`
- `Result`
- `Artifacts`

Rules:
- row selection only
- newest-first default sort
- no inline mutation controls
- selection updates the detail pane
- no scroll reset on selection

### `HistoryDetailPane`
Contains:
- event identity
- change summary
- supporting evidence
- historical notes/warnings
- optional secondary follow-up context

Follow-up context must remain non-actionable by default.

## Screen Model Mapping

The first implementation should consume one screen-level read model:
- `HistoryScreenModel`

Recommended shape:

```text
HistoryScreenModel
- header
- summary
- table
- selectedEvent
- localCapabilities
- banners
```

### `header`
Contains:
- title
- subtitle
- active project name

### `summary`
Contains:
- total event count
- latest event summary
- latest event timestamp
- optional grouped counts by event type

### `table`
Contains:
- rows
- selected row id
- filter state
- sort state
- loading state

Each row contains:
- id
- timestamp summary
- event type
- one-line summary
- sequence summary
- result summary
- artifact availability summary

### `selectedEvent`
Contains either:
- `none`
- `selected`
- `error`

#### `selectedEvent.selected`
Contains:
- event identity
- timestamp
- event type
- related project/sequence summary
- change summary
- result summary
- artifact references
- historical warnings/notes
- optional follow-up context summary

## Local UI State

The first native `History` slice should keep these as local shell state only:
- selected row id
- table filters
- sort state
- local export/open-artifact sheet state if needed

Do not persist as durable truth:
- local filter drafts
- transient detail expansion state
- shell-side cached history mutations

## Action Inventory

### Required first-slice actions
- select historical event row
- sort newest-first by default
- filter history at a basic level if implemented
- open artifact reference when supported

### Optional first-slice actions
- reveal related revision
- export history summary

These are secondary. They must not overpower the core browse-and-inspect flow.

## Service Dispatch Map

### History service
Used for:
- load history summary
- load event rows
- load selected event detail inputs
- open or resolve artifact references where supported

### Review/apply service
Not a primary dependency for this screen.
It may contribute historical records indirectly through shared durable artifacts, but `History` must not call apply logic as part of routine screen ownership.

## State Transition Rules

### Entering `History`
1. load historical summary first
2. load event rows
3. restore last valid selected row only if it still exists and is still meaningful
4. default table order to newest first

### Selecting a history row
1. update selected row state
2. update detail pane to the selected event
3. preserve table scroll position
4. do not reload the whole screen unnecessarily

### Opening artifact references
1. keep the selected event stable
2. open the artifact as a secondary action
3. return to the same list/detail context when possible

## Error Handling Rules

### Empty state
- explain that no completed history exists yet
- do not frame it as failure
- do not imply pending work can be handled here

### Loading state
- keep the list/detail structure visible when possible
- use lightweight loading treatment in summary, table, and detail regions

### Error state
- show a concise readable failure summary
- keep the screen structurally recognizable
- distinguish failure to load history from simply having no history yet

## SwiftUI Build Notes

This package implies the native implementation should likely map to:
- `HistoryScreenView`
- `HistoryScreenViewModel` or equivalent adapter
- a table-backed history browse view
- a selected-detail pane for historical event detail
- a platform-backed history service client

The native shell remains a client/composition layer.
Do not move historical ordering, artifact truth, or apply-history rules into SwiftUI.

## Build-Readiness Gate

The native `History` slice is ready to implement when:
1. the view hierarchy is accepted
2. the `HistoryScreenModel` shape is accepted
3. the local-state inventory is accepted
4. the action inventory is accepted
5. the service dispatch map is accepted
6. the non-goals list is accepted

If all six are true, the `History` native implementation can begin without reopening broad retrospective-workflow design.
