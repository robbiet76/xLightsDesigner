# macOS Native Project And Layout Build Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the build-facing package for the first native `Project + Layout` implementation slice.

This package translates the approved `Project`, `Layout`, and early-workflow design work into implementation-ready screen composition, read-model mapping, action inventory, and service dispatch rules.

Primary parent sources:
- `macos-native-project-screen-layout-2026-04-06.md`
- `macos-native-layout-screen-layout-2026-04-06.md`
- `macos-native-project-layout-relationship-2026-04-06.md`
- `macos-native-early-workflow-relationship-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`

## Build-Package Rule

This package must answer:
1. what native view hierarchies are built for `Project` and `Layout`
2. what screen models drive them
3. what local UI state is allowed
4. what actions the user can trigger
5. what shared services are called
6. how the handoff between `Project` and `Layout` works
7. what is out of scope for the first slice

## Slice Goal

The first native `Project + Layout` slice should let a user:
1. create a project
2. open an existing project
3. see the active project identity and referenced paths clearly
4. understand whether project context is usable
5. open `Layout` and see overall target readiness
6. browse targets in a dense native table
7. select one target and inspect its readiness/issues
8. perform simple target correction actions through the selected-target region when supported

It does not need to solve every later project-management or target-management feature.
It needs to establish the early workflow correctly.

## First-Slice Non-Goals

Do not include in the first native `Project + Layout` slice:
- advanced project maintenance utilities beyond core lifecycle
- broad settings/configuration editing from `Project`
- complex bulk target-edit workflows
- advanced multi-filter layout management UI
- cross-workflow dashboards embedded in either screen
- sequence, design, review, or history ownership leakage

## Shared Early-Workflow Rule

`Project` and `Layout` must be implemented as adjacent screens in one coherent early-workflow slice.

Working rule:
- `Project` confirms working context
- `Layout` confirms target readiness inside that context
- `Project` may hint at `Layout` readiness
- `Layout` may point back to `Project` only when the real issue is project context

## Native View Hierarchy: Project

The first native `Project` implementation should use this view hierarchy.

1. `ProjectScreen`
2. `WorkflowPageHeader`
3. `ProjectSummaryBand`
4. `ProjectActionBand`
5. `ProjectContextSection`

### `ProjectScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to project services
- composition of `ProjectScreenModel`

Contains:
- `WorkflowPageHeader`
- `ProjectSummaryBand`
- `ProjectActionBand`
- `ProjectContextSection`

### `ProjectSummaryBand`
Contains:
- active project identity or no-project state
- project readiness summary
- core referenced path summaries

### `ProjectActionBand`
Contains:
- `Create Project`
- `Open Project`
- `Save Project`
- `Save Project As`
- optional reveal/change-path actions later

### `ProjectContextSection`
Contains grouped read-only or lightly actionable sections:
- project identity
- referenced paths
- readiness summary
- downstream workflow hints

## Project Screen Model Mapping

The first implementation should consume one screen-level read model:
- `ProjectScreenModel`

Recommended shape:

```text
ProjectScreenModel
- header
- activeProjectSummary
- projectActions
- projectContext
- downstreamHints
- banners
```

### `header`
Contains:
- title
- subtitle
- optional active-project state badge

### `activeProjectSummary`
Contains either:
- `none`
- `active`

#### `activeProjectSummary.none`
Contains:
- no-project title
- one-line guidance
- readiness state = no active project

#### `activeProjectSummary.active`
Contains:
- project name
- project file path
- show folder path summary
- media path summary
- overall readiness state
- short readiness explanation

### `projectActions`
Contains:
- can create
- can open
- can save
- can save as
- optional reveal/change-path capabilities

### `projectContext`
Contains:
- project identity details
- referenced paths
- readiness items

### `downstreamHints`
Contains concise hints such as:
- `Layout needs review`
- `Audio can be used now`
- `No active sequence selected yet`

## Project Local UI State

The first native `Project` slice should keep these as local shell state only:
- create-project sheet presentation state
- open-project presentation state
- save/save-as presentation state
- local confirmation dialog state
- temporary form drafts used during create or path changes

Do not persist as durable truth:
- in-progress project form drafts
- transient sheet/dialog visibility

## Project Action Inventory

### Core lifecycle actions
- create project
- open project
- save project
- save project as

### Secondary actions for later-first-slice consideration
- reveal project in Finder
- change show folder
- change media path

These secondary actions are not required to establish the first slice.

## Project Service Dispatch Map

### Project service
Used for:
- create project
- open project
- save project
- save project as
- load project summary/readiness

### Layout service
Used only indirectly here for:
- high-level readiness hint inputs if available

The `Project` screen must not own layout scanning logic.

## Native View Hierarchy: Layout

The first native `Layout` implementation should use this view hierarchy.

1. `LayoutScreen`
2. `WorkflowPageHeader`
3. `LayoutReadinessBand`
4. `LayoutMainSplit`
5. `LayoutTargetTable`
6. `LayoutSelectedTargetPane`

### `LayoutScreen`
Owns:
- overall screen composition
- screen-level local UI state
- action dispatch to layout services
- composition of `LayoutScreenModel`

Contains:
- `WorkflowPageHeader`
- `LayoutReadinessBand`
- `LayoutMainSplit`

### `LayoutReadinessBand`
Contains:
- overall readiness state
- total target count
- ready count
- unresolved count
- orphan/remapping count
- one explanation line
- one next-step line

### `LayoutMainSplit`
Left child:
- `LayoutTargetTable`

Right child:
- `LayoutSelectedTargetPane`

### `LayoutTargetTable`
Uses:
- `DataTableWrapper`

Columns:
- `Target`
- `Type`
- `Tags`
- `Assignment`
- `Support State`
- `Issues`
- `Action`

Rules:
- row selection only
- no inline row buttons
- row selection updates the selected-target pane
- no scroll reset on selection

### `LayoutSelectedTargetPane`
Contains:
- selected target identity
- readiness summary
- current tags
- assignment/remapping state
- downstream effect summary
- correction actions when allowed

## Layout Screen Model Mapping

The first implementation should consume one screen-level read model:
- `LayoutScreenModel`

Recommended shape:

```text
LayoutScreenModel
- header
- readinessSummary
- table
- selectedTarget
- localCapabilities
- banners
```

### `header`
Contains:
- title
- subtitle
- active project name
- optional lightweight source summary

### `readinessSummary`
Contains:
- overall status
- total targets
- ready count
- unresolved count
- orphan/remapping count
- explanation text
- next-step text

### `table`
Contains:
- rows
- selected row id
- filter state
- search query
- sort state
- loading state

Each row contains:
- id
- target name
- target type
- tag summary
- assignment summary
- support-state summary
- issues summary
- action summary text

### `selectedTarget`
Contains either:
- `none`
- `selected`
- `error`

#### `selectedTarget.selected`
Contains:
- identity
- type
- source path summary if useful
- readiness state
- readable reason
- recommended next action
- current tags
- assignment/remapping summary
- editable fields if allowed
- correction actions if allowed
- downstream effect summary

## Layout Local UI State

The first native `Layout` slice should keep these as local shell state only:
- selected row id
- table search query
- simple filters
- sort state
- in-progress correction drafts before save/apply
- local confirmation dialog state

Do not persist as durable truth:
- temporary correction drafts
- transient table filter state unless later promoted as session-restorable UI state

## Layout Action Inventory

### Required first-slice actions
- select target row
- filter/search targets at a basic level
- refresh layout state
- perform one local correction action when supported

### Correction action family
The first slice may include one or more of:
- `Correct Tags`
- `Resolve Assignment`
- `Accept Suggested Mapping`
- `Mark For Later Review`

The exact first correction subset should be chosen based on what the shared layout service already supports cleanly.
Do not invent shell-side correction rules.

## Layout Service Dispatch Map

### Layout service
Used for:
- load readiness summary
- load target rows
- load selected target detail inputs
- refresh layout state
- submit supported correction actions

### Project service
Used only indirectly here for:
- active project identity context

The `Layout` screen must not own target-classification or orphan-detection logic.

## Handoff Rules: Project -> Layout

### When `Project` should point toward `Layout`
When these are true:
- a project exists
- project references are valid enough to inspect layout state
- layout readiness is incomplete or useful to review next

### How the handoff should read
Use compact hint language such as:
- `Layout needs review`
- `Layout is ready`
- `Layout is blocked by project context`

Do not embed the layout correction workflow inside `Project`.

## Handoff Rules: Layout -> Project

### When `Layout` should point back to `Project`
When these are true:
- the issue is not target-level
- the show folder or project reference is wrong or missing
- layout support state cannot be trusted until project context is fixed

### How the handoff should read
Use concise root-cause language such as:
- `Show folder reference must be corrected in Project`

Do not make this feel like an unexplained failure.

## State Transition Rules

### Entering `Project`
1. load active project summary
2. show lifecycle actions immediately
3. show no-project state cleanly if needed
4. do not restore stale sequence detail here

### Entering `Layout`
1. load readiness summary first
2. load target rows
3. restore last valid selected row only if it still exists
4. do not reset table scroll on selection changes

### Moving from `Project` to `Layout`
1. preserve active project context
2. initialize `Layout` from the current project
3. do not present this like a wizard step completion

### Returning from `Layout` to `Project`
1. preserve active project context
2. surface the actual project-reference issue cleanly
3. do not imply that target-level corrections were lost

## Error Handling Rules

### Project
- errors stay local to create/open/save actions when possible
- no full-screen error replacement for routine lifecycle failures
- readiness problems are not the same thing as lifecycle failures

### Layout
- keep grid/detail structure visible during loading and error states when possible
- separate `Blocked` readiness from outright load failure
- show root-cause language that distinguishes project-context issues from target-level issues

## SwiftUI Build Notes

This package implies the first native `Project + Layout` implementation should likely map to:
- `ProjectScreenView`
- `LayoutScreenView`
- `ProjectScreenViewModel` or equivalent adapter
- `LayoutScreenViewModel` or equivalent adapter
- platform-backed service clients for:
  - project service
  - layout service
- one shared table-backed target browse view for `Layout`

The native shell remains a client/composition layer.
Do not move project-file semantics, layout derivation, or orphan-detection rules into SwiftUI.

## Build-Readiness Gate

The first native `Project + Layout` slice is ready to implement when:
1. the `Project` view hierarchy is accepted
2. the `Layout` view hierarchy is accepted
3. the two screen-model shapes are accepted
4. the early-workflow handoff rules are accepted
5. the action inventories are accepted
6. the service dispatch maps are accepted
7. the non-goals list is accepted

If all seven are true, the `Project + Layout` native implementation can begin without reopening broad early-workflow design.
