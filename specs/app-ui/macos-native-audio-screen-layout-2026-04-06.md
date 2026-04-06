# macOS Native Audio Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Audio` screen layout contract.

This is the first screen-level contract for the native shell.
It translates the `Audio` workflow contract into a concrete screen structure that can drive higher-fidelity wireframes and the first click-through prototype.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`
- `audio-page-redesign-2026-04-06.md`
- `macos-native-audio-workflow-review-from-electron-2026-04-06.md`


## Reference Rule

The current Electron `Audio` page is a workflow reference only.
It may be used to evaluate structure, hierarchy, and flow, but it is not the target shell.
If Electron behavior and this screen contract diverge, this screen contract wins unless explicitly revised in the Electron workflow review document.

## Screen Purpose

The `Audio` screen exists to do three jobs clearly:
1. analyze one track
2. analyze a folder into the shared track library
3. inspect whether the resulting track metadata is complete enough for later sequencing use

It is not a sequence-control screen.
It is not an xLights session screen.
It is not a diagnostics dump.

## Primary User Goals

1. choose a single track and analyze it
2. choose a folder and batch-analyze it
3. browse the shared track library in a readable grid
4. understand which timing layers are available for any track
5. understand what is incomplete and whether user action is needed
6. confirm unresolved title/artist fields only when canonical identity was not available

## Entry Conditions

- accessible from the main workflow sidebar
- can be used with or without an active sequence
- can be used with or without an active project, subject to later product tightening if needed

## Exit Conditions

The user should be able to leave this screen knowing one of these is true:
1. the selected track metadata is ready enough for later sequencing
2. the track metadata is partial but acceptable for now
3. the track metadata still needs a clear follow-up action
4. batch processing completed and the library now reflects the updated state

## Layout Overview

The native `Audio` screen should use a split vertical workflow with one subordinate lower browsing area.

Primary structure:
1. page header
2. action-and-result band
3. shared track library band

The action-and-result band should use a two-column layout:
- left: primary actions
- right: current result summary

The library band should use:
- grid/table first
- optional inspector/detail area second

The key rule is:
- action and current-result sit above the library
- the library is broad browse/inspect space, not the primary call to action

## Region Definition

### Region A: Page Header

Purpose:
- establish what the screen is for without adding workflow noise

Required contents:
- title: `Audio Analysis`
- short purpose line:
  - `Analyze songs into shared track metadata for later sequencing.`

Optional contents:
- lightweight shared-library summary counts
  - total tracks
  - complete
  - needs review
  - failed

Disallowed contents:
- active sequence name
- xLights connection status as primary header content
- long diagnostics banners unless there is a blocking app-wide problem

## Region B: Action Panel

Purpose:
- make the next action obvious

Visual priority:
- highest on the screen

Layout:
- left column of the action-and-result band

Structure:
- mode selector at top
- only one primary mode active at a time

Modes:
1. `Single Track`
2. `Folder Batch`

### Single Track Mode

Required controls:
- audio file field
- `Browse File` action
- `Analyze Track` primary action

Optional supporting controls:
- `Use selected library track` style affordance only if it proves necessary later

### Folder Batch Mode

Required controls:
- folder field
- `Browse Folder` action
- recursive toggle: `Include subfolders`
- `Analyze Folder` primary action

Rule:
- only the active mode's full controls should be visually expanded
- the inactive mode should be visible but visually secondary

Disallowed behavior:
- showing both full action sets with equal visual weight
- mixing sequence-binding actions into this panel

## Region C: Current Result Panel

Purpose:
- summarize the currently selected track or the latest batch result

Layout:
- right column of the action-and-result band

This panel is the primary read surface immediately after the user acts.

### When In Single Track Context

Show:
- display name
- artist
- last analyzed timestamp
- overall status
- available timing layers
- missing timing layers
- readable reason/explanation
- recommended action if one exists

Allowed timing labels:
- `Song Structure`
- `Phrase Cues`
- `Beats`
- `Bars`
- future timing families should append here without changing the layout model

If action is needed and user action is valid:
- show inline editable fields only for unresolved user-confirmable metadata
- initially:
  - track title
  - track artist
- show one primary action:
  - `Confirm Track Info`

Rule:
- this confirmation flow belongs here, not inside the library grid

### When In Batch Context

Show:
- total files processed
- complete count
- partial count
- needs-review count
- failed count
- top issue categories
- path or action for later report inspection

Disallowed content in this panel:
- raw JSON
- long pipeline traces
- low-level service logs
- global settings or xLights details

## Region D: Shared Track Library Band

Purpose:
- allow fast scanning of what analysis already exists and what state each track is in

Layout:
- full-width section below the action-and-result band

Structure:
1. library toolbar / summary line
2. metadata grid
3. optional inspector area tied to selection

### Library Toolbar / Summary

May include:
- search/filter input later
- simple status filter later
- summary counts

Do not overload this area initially.

### Metadata Grid

The grid is the primary browse surface.
It should use the same table/grid browsing style the product will use elsewhere.

Required columns:
1. `Track`
2. `Status`
3. `Available Timings`
4. `Missing / Issues`
5. `Identity`
6. `Last Analyzed`
7. `Action`

Column behavior:
- `Track`: title + artist in readable form
- `Status`: `Complete`, `Partial`, `Needs Review`, `Failed`
- `Available Timings`: readable comma-separated summary or chips
- `Missing / Issues`: concise one-line summary only
- `Identity`: `Verified`, `Needs Review`, `Temporary`, or similar readable state
- `Last Analyzed`: compact relative or formatted timestamp
- `Action`: readable action text only, not buttons in the grid

Selection behavior:
- selecting a row updates the `Current Result` panel
- selection must not reset scroll position in the grid
- selection must not navigate away or reload the screen

Disallowed behavior:
- action buttons embedded in each row
- multi-line diagnostic walls in the grid
- scroll reset on selection

### Optional Inspector Area

The grid may later gain an inspector/detail pane if needed.
If present, it must be visually subordinate to the grid and current-result panel.

Initial rule:
- do not require a separate persistent detail panel below the grid
- prefer using `Current Result` as the selected-track summary surface

## State Variants

The wireframe and prototype set for `Audio` must cover these states.

### State 1: Empty / First Use

Characteristics:
- no current analysis selected
- library may be empty or not yet loaded
- primary action is dominant

Must communicate:
- what this page is for
- what to click first

### State 2: Single Track Selected, Complete Result

Characteristics:
- one analyzed track selected
- status complete
- timing coverage visible
- no further action required

Must communicate:
- the track is ready enough for later sequencing use

### State 3: Single Track Selected, Needs Review

Characteristics:
- unresolved identity or another actionable incomplete state
- inline confirmation fields appear in `Current Result`

Must communicate:
- what is missing
- why it matters
- what the user can do now

### State 4: Batch In Progress

Characteristics:
- folder analysis is running
- progress is visible without taking over the screen

Must communicate:
- the operation is active
- the user should not be confused about whether work is still running

### State 5: Batch Complete

Characteristics:
- batch summary visible
- updated library grid visible

Must communicate:
- what completed
- how many tracks are complete, partial, failed, or need review

### State 6: Error / Failed Analysis

Characteristics:
- analysis failure or blocking problem

Must communicate:
- concise reason
- whether the user can retry
- what next action is available

## Interaction Rules

1. row selection updates `Current Result`
2. confirmation actions live in `Current Result`, not the grid
3. grid rows are selectable but not action-dense
4. action mode switch must be explicit
5. the active action mode must be obvious without reading the whole screen
6. incomplete states must always include a reason
7. if user action is valid, show the action clearly
8. if no user action is needed, say that explicitly

## Read-Model Expectations

The screen contract expects these logical state groups:
- `mode`
- `actions`
- `currentResult`
- `library`
- `operationStatus`

Expected high-level shape:
- `mode.active`
- `mode.singleTrack`
- `mode.batch`
- `currentResult.kind`
- `currentResult.status`
- `currentResult.availableTimings`
- `currentResult.missingTimings`
- `currentResult.reason`
- `currentResult.recommendedAction`
- `currentResult.confirmationFields`
- `library.rows`
- `library.selection`
- `operationStatus.running`
- `operationStatus.summary`

Detailed schema belongs later in the page-state contract workstream.

## Out Of Scope For This Screen

Do not add these to the native `Audio` screen contract:
- xLights sequence open/switch controls
- timing-track write/apply controls
- design proposal review
- review/apply approval flow
- app diagnostics console
- service configuration

## Wireframe Requirements

The `Audio` wireframe package must include:
1. empty / first-use view
2. single-track complete view
3. single-track needs-review view
4. batch in-progress view
5. batch complete view
6. error view

The wireframes must be detailed enough to answer:
- is the first action obvious
- is the current result readable without overload
- is the grid scannable
- are incomplete states understandable
- is the confirmation flow placed correctly

## Prototype Requirements

Because `Audio` is a high-risk workflow, the click-through prototype must include:
1. switching between `Single Track` and `Folder Batch`
2. selecting a library row
3. seeing `Current Result` update from selection
4. opening a needs-review track
5. confirming track title/artist inline
6. viewing batch completion state

## Decisions Locked Here

1. `Audio` uses a two-column action-and-result band above a full-width library band
2. the grid is the primary browse surface
3. `Current Result` is the selected-track action surface
4. the confirmation action does not live in the grid
5. batch and single-track modes share one screen but only one is visually primary at a time
6. the screen remains sequence-independent

## Immediate Next Design Step

After this screen contract:
1. produce medium/high-fidelity `Audio` wireframes
2. produce the `Audio` click-through prototype
3. then write the native `Project` screen layout contract
