# macOS Native Layout Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Layout` screen before any SwiftUI implementation begins.

This screen exists to make layout-target context understandable and correctable before downstream design and sequencing work.
It is not a generic metadata administration page.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-layout-workflow-review-from-electron-2026-04-06.md`

## Screen Role

The native `Layout` screen answers:
- what targets are available to work with
- how those targets are classified and tagged
- what assignment or remapping issues exist
- whether the layout support state is usable for downstream workflows

It is the semantic and structural readiness view for the physical/display layout.

## Screen-Contract Rules

1. the first read surface must be layout readiness, not low-level raw metadata
2. the primary browse surface must be a target grid, not cards
3. row selection must drive a single correction/detail area
4. the screen must make unresolved orphan/remapping issues obvious
5. the screen must not become a project dashboard or a sequence dashboard
6. the screen must remain readable when the layout contains many targets

## Primary User Questions

1. what layout targets are available in this project
2. which targets are well-classified and ready for downstream use
3. which targets still need correction or assignment help
4. what exactly should the user do next when the layout is incomplete

## Information Hierarchy

The screen uses four vertical regions:

1. page header
- workflow title
- one-sentence explanation
- lightweight layout-source context

2. layout readiness summary band
- overall readiness state
- counts for ready, needs review, and unresolved items
- primary explanation of what blocks downstream workflows

3. target grid band
- primary browse surface for all targets
- supports selection, sorting, and filtering

4. selected target detail and correction band
- shows the selected target summary
- shows tags, assignment state, issues, and next action
- supports correction where allowed

## Region Specifications

### 1. Page Header

Required content:
- `Layout`
- short supporting description
- active project name
- lightweight source summary for layout data if useful

Must not include:
- global sequence identity
- design proposal summaries
- apply/review actions

### 2. Layout Readiness Summary Band

Purpose:
- explain the overall readiness of the layout support state before the user reads the full target grid

Required content:
- overall status
  - `Ready`
  - `Needs Review`
  - `Blocked`
- count summaries
  - total targets
  - ready targets
  - unresolved targets
  - orphan/remapping count
- one short explanation line
- one short next-step line

Examples:
- `Ready: target classifications and assignments are usable for downstream workflows.`
- `Needs Review: 8 targets still need tag or assignment correction.`
- `Blocked: orphan targets must be resolved before downstream targeting is reliable.`

The summary band must stay compact.
It must not become a multi-card dashboard.

### 3. Target Grid Band

Purpose:
- provide the primary browse and selection surface for layout targets

Required table columns:
- `Target`
- `Type`
- `Tags`
- `Assignment`
- `Support State`
- `Issues`
- `Action`

Column intent:
- `Target`: display name of the model/group/submodel/display element
- `Type`: structural class used by downstream workflows
- `Tags`: short readable semantic tags
- `Assignment`: mapping/ownership summary
- `Support State`: `Ready`, `Needs Review`, `Blocked`
- `Issues`: one-line summary of missing or conflicting support state
- `Action`: readable next action text only, not an inline button row

Grid rules:
- row selection must not reload the page or reset scroll position
- rows must remain dense and scan-friendly
- long diagnostics must not be rendered inline in the grid
- target row actions must be surfaced in the selected-target band, not in the grid row

Preferred filters:
- status filter
- target type filter
- issue-only toggle
- search by target name/tag

### 4. Selected Target Detail And Correction Band

Purpose:
- give one clear place to inspect and correct the selected target

Required sections:
1. selected target identity
- name
- type
- source/layout path if useful

2. support summary
- readiness state
- short reason
- short recommended next action

3. classification and tags
- current tags
- editable fields if user correction is allowed

4. assignment and remapping
- current assignment
- orphan/remap context
- correction controls when allowed

5. downstream effect summary
- brief statement of why this target state matters to design/sequencing

Interaction rules:
- edits should be local and explicit
- save/apply behavior must be clear
- destructive changes require confirmation only when truly necessary

## Dominant Action Model

Primary actions belong in the selected-target band or the screen toolbar, not in row cells.

Likely actions:
- `Correct Tags`
- `Resolve Assignment`
- `Accept Suggested Mapping`
- `Mark For Later Review`
- `Refresh Layout State`

If no corrective action is allowed for a selected row, the screen must still explain why.

## Read Model Requirements

The `Layout` screen requires:
- active project identity
- layout target list
- target type/classification state
- target tag state
- assignment/remapping/orphan state
- layout support warnings and readiness state
- selected target state

## Empty, Loading, And Error States

### Empty / First Use

Use when no layout support data is available yet.

Required content:
- explanation of what the screen is for
- explanation of why no targets are available yet
- next action guidance

### Loading

Use when layout state is being loaded or refreshed.

Required behavior:
- keep the overall structure visible
- show loading treatment in the summary band and grid area
- avoid replacing the whole screen with a spinner-only view

### Error

Use when layout state cannot be loaded.

Required content:
- short readable failure summary
- what is unavailable
- whether the user can retry
- whether downstream workflows are affected

### Ready With Issues

Use when targets are loaded but there are unresolved support issues.

Required behavior:
- the screen must remain browsable
- the summary band must explain the blocking class of issue
- selected-target correction remains available

## Required Wireframe States

The wireframe package for `Layout` must include:
1. empty layout support state
2. ready layout state with no unresolved issues
3. layout state with unresolved orphan/remapping problems
4. selected target with editable correction controls
5. loading state
6. error state

## Required Prototype Flows

The click-through prototype should cover:
1. open `Layout` from an active project
2. scan the readiness summary
3. filter to unresolved targets
4. select a target row
5. inspect support details
6. apply a correction or accept a mapping suggestion
7. return to the filtered grid without losing context

## Explicit Non-Goals

The `Layout` screen must not become:
- a generic raw metadata viewer
- a full project settings page
- an audio analysis page
- a sequence apply/review page
- a design ideation page
- a historical revision browser

## Exit Criteria For Design Phase

The `Layout` screen contract is ready for native wireframes when:
1. the grid columns and row semantics are stable
2. the selected-target correction band is clearly defined
3. readiness summaries are readable and concise
4. the page boundary versus `Project`, `Design`, and `Sequence` is unambiguous

## Screen Reading Order

The native `Layout` screen should read in this order:
1. is the layout support state usable
2. what targets need attention
3. what is selected right now
4. what exactly should I correct next

## Default Behavior

When targets exist, the target grid should load immediately and remain the primary browse surface.

Behavior rules:
- row selection updates the selected-target band only
- row selection must not reset scroll position
- stale cross-workflow context must not take over this screen

## Native Acceptance Criteria

The `Layout` screen is implementation-ready only when:
1. readiness is visible before the user reads the full target list
2. the target grid is the primary browse surface
3. correction happens in one selected-target region, not row cells
4. orphan/remapping issues are obvious and actionable
5. the screen does not read like a generic metadata admin page
