# macOS Native Audio Build Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the first build-facing package for the native macOS `Audio` workflow.

This document translates the approved `Audio` design work into an implementation-ready package without starting SwiftUI feature code yet.
It exists to reduce interpretation during the first native build slice.

Primary parent sources:
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-audio-workflow-review-from-electron-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`
- `macos-native-early-workflow-relationship-2026-04-06.md`

## Build-Package Rule

This package is the direct precursor to SwiftUI implementation.
It must answer:
1. what view hierarchy is being built
2. what read model drives each region
3. what local UI state exists
4. what actions the user can trigger
5. what service requests the shell dispatches
6. what is explicitly out of scope for the first native `Audio` slice

If a question needed for first implementation is not answered here, the package is incomplete.

## Build Slice Goal

The first native `Audio` slice should let a user:
1. open the `Audio` workflow
2. browse the shared track library in a dense native table
3. select a track and see the selected-track current result
4. analyze one track
5. analyze one folder recursively or non-recursively
6. see batch progress and batch completion summaries
7. confirm unresolved title/artist inline in the current-result region

It does not need to solve every later enhancement.
It needs to establish the correct native workflow skeleton.

## First-Slice Non-Goals

Do not include in the first native `Audio` build slice:
- xLights session control
- sequence binding UI
- deep diagnostics panels
- report-file drill-down UI beyond a simple follow-up affordance
- advanced library filtering beyond basic search and possibly one simple status filter
- editing of verified canonical metadata
- full artifact-browser views

## Native View Hierarchy

The first native `Audio` implementation should use this view hierarchy.

1. `AudioScreen`
2. `WorkflowPageHeader`
3. `AudioTopBand`
4. `AudioActionColumn`
5. `AudioCurrentResultColumn`
6. `AudioLibrarySection`
7. `AudioLibraryToolbar`
8. `AudioLibraryTable`

Detailed composition:

### `AudioScreen`
Owns:
- overall workflow composition
- screen-level local state
- action dispatch to services
- composition of the `AudioScreenModel`

Contains:
- `WorkflowPageHeader`
- `AudioTopBand`
- `AudioLibrarySection`

### `WorkflowPageHeader`
Contents:
- title: `Audio Analysis`
- supporting description
- lightweight library counts

### `AudioTopBand`
A horizontal split region.

Left child:
- `AudioActionColumn`

Right child:
- `AudioCurrentResultColumn`

### `AudioActionColumn`
Contains:
- mode selector
- single-track controls or folder-batch controls
- one primary analysis action for the active mode

Subcomponents:
- `ModeSelector`
- `FilePickerRow` or `FolderPickerRow`
- `RecursiveToggleRow` in batch mode
- `ActionBar`

### `AudioCurrentResultColumn`
Contains one of:
- selected-track summary state
- batch progress summary state
- batch complete summary state
- empty guidance state
- error state

Subcomponents:
- `SummaryBand`
- `StatusBadge` group
- `InlineEditRow` set when identity confirmation is allowed
- `ActionBar` for local corrective action
- `WarningBannerBlock` when needed

### `AudioLibrarySection`
Contains:
- `AudioLibraryToolbar`
- `AudioLibraryTable`

### `AudioLibraryToolbar`
Initial contents:
- lightweight count summary
- optional basic search field

Do not include multi-filter sprawl in the first slice.

### `AudioLibraryTable`
Uses:
- `DataTableWrapper`

Columns:
- `Track`
- `Status`
- `Available Timings`
- `Missing / Issues`
- `Identity`
- `Last Analyzed`
- `Action`

Rules:
- row selection only
- no row buttons
- no inline editors in the table
- selection updates the current-result column

## Screen Model Mapping

The first implementation should consume one screen-level read model:
- `AudioScreenModel`

Recommended shape:

```text
AudioScreenModel
- header
- mode
- singleTrackAction
- folderBatchAction
- currentResult
- libraryOverview
- libraryTable
- localCapabilities
- banners
```

### `header`
Contains:
- title
- subtitle
- total track count
- complete count
- needs review count
- failed count

### `mode`
Contains:
- active mode: `single_track | folder_batch`
- whether mode switching is allowed while a run is active

### `singleTrackAction`
Contains:
- selected file path
- can browse
- can analyze
- helper text

### `folderBatchAction`
Contains:
- selected folder path
- recursive enabled
- can browse
- can analyze
- helper text

### `currentResult`
Discriminator:
- `empty`
- `track`
- `batch_running`
- `batch_complete`
- `error`

#### `currentResult.track`
Contains:
- display name
- artist
- last analyzed timestamp
- overall status
- identity state
- available timings
- missing/issues summary
- readable reason
- recommended action text
- editable title draft if allowed
- editable artist draft if allowed
- can confirm identity

#### `currentResult.batch_running`
Contains:
- batch label
- running status
- processed count
- total count
- counts by result class so far
- concise progress note

#### `currentResult.batch_complete`
Contains:
- batch label
- completion status
- total processed
- complete/partial/needs-review/failed counts
- top issue categories
- optional follow-up action text

#### `currentResult.error`
Contains:
- short error title
- readable explanation
- retry affordance availability

### `libraryOverview`
Contains:
- total tracks
- ready count
- needs review count
- partial count
- failed count

### `libraryTable`
Contains:
- rows
- selected row id
- sort state
- search query
- loading state

Each row contains:
- id
- display name
- artist
- status
- available timings summary
- missing/issues summary
- identity summary
- last analyzed summary
- action summary text

## Local UI State

The first native `Audio` slice should keep these as local shell state only:
- active mode
- single-track file picker draft path
- folder-batch picker draft path
- recursive toggle state before dispatch
- selected library row id
- search query
- inline title draft
- inline artist draft
- local presentation of an in-flight action

Do not persist these as durable product truth.

Persist only as session-restorable UI state when useful:
- last active mode
- selected library row if still valid
- basic search query if still valid

Do not restore:
- stale running analysis state
- stale batch progress state
- stale sequence-derived context

## Action Inventory

The first native `Audio` slice must support these user actions.

### Screen-level actions
- switch to `Single Track`
- switch to `Folder Batch`
- select a library row
- clear selection if needed later

### Single-track actions
- browse for audio file
- analyze selected track

### Folder-batch actions
- browse for folder
- toggle recursive mode
- analyze selected folder

### Current-result corrective actions
- edit unresolved track title
- edit unresolved track artist
- confirm track info

### Secondary actions
- retry failed analysis where valid
- re-run single-track analysis
- re-run folder analysis

## Service Dispatch Map

The native shell should dispatch through the shared platform/service boundary.
It must not implement these rules itself.

### Track library service
Used for:
- load library overview and rows
- load selected track detail/read-model inputs
- confirm unresolved track identity

### Audio analysis service
Used for:
- analyze one file
- analyze one folder
- observe progress
- receive completion summary

### Diagnostics/backup service
Used only if needed later for error/report follow-up.
Not required as a primary build dependency for the first slice.

## UI Event To Service Mapping

### `Browse File`
Shell owns:
- native file picker

Service owns:
- nothing until a valid file is dispatched for analysis

### `Analyze Track`
Shell sends:
- selected file path

Service returns or streams:
- analysis start acknowledgement
- progress snapshots
- resulting track-library update / selected result model inputs

### `Browse Folder`
Shell owns:
- native folder picker

### `Analyze Folder`
Shell sends:
- selected folder path
- recursive flag

Service returns or streams:
- batch start acknowledgement
- progress snapshots
- batch completion summary
- library refresh trigger

### `Confirm Track Info`
Shell sends:
- selected track id or fingerprint reference
- title draft
- artist draft

Service returns:
- updated track record summary
- updated library row state
- updated current-result state inputs

## State Transition Rules

### Entering `Audio`
1. load header counts and library rows
2. restore last valid mode if allowed, otherwise default to `Single Track`
3. restore last valid selected row only if it still exists
4. do not restore stale active-run state

### Selecting a library row
1. update selected row state
2. update `currentResult` to the selected track state
3. preserve table scroll position
4. do not reload the full screen unnecessarily

### Starting single-track analysis
1. keep screen structure stable
2. preserve library visibility
3. shift current-result into active analysis state if needed
4. refresh library and current-result on completion

### Starting folder-batch analysis
1. keep table visible
2. shift current-result into batch-running state
3. refresh table rows as results land if supported, otherwise refresh on completion
4. shift current-result into batch-complete state on finish

### Confirming track info
1. validate local drafts
2. dispatch confirmation to service
3. keep user in place on the screen
4. refresh selected row and current-result without resetting selection or scroll

## Native Table Requirements

The first `Audio` table implementation must guarantee:
- dense row layout
- stable row selection
- no scroll reset on selection
- no page reload behavior on selection
- one-line summary fields where possible
- keyboard selection support if native table support is straightforward

It does not need in the first slice:
- advanced multi-column filter builder
- row grouping
- column customization UI

## Error Handling Rules

The first native `Audio` slice should use local, readable error handling.

Rules:
- keep the page structure visible during error states
- show failures in the affected region first
- avoid replacing the whole screen with a generic blank error page
- separate blocking errors from cautionary incomplete states

## SwiftUI Build Notes

This package implies the first native `Audio` build should probably map to:
- one top-level `AudioScreenView`
- a dedicated `AudioScreenViewModel` or equivalent screen adapter
- platform-backed service clients for:
  - track library
  - audio analysis
- a native table-backed library view
- local draft state for inline identity confirmation

The native shell should remain a client/composition layer.
Do not move audio-analysis orchestration or canonical library rules into the SwiftUI layer.

## Build-Readiness Gate

The first native `Audio` slice is ready to implement when:
1. the view hierarchy above is accepted
2. the screen-model shape is accepted
3. the local-state inventory is accepted
4. the action inventory is accepted
5. the service dispatch map is accepted
6. the non-goals list is accepted

If all six are true, the SwiftUI scaffold can begin without reopening broad UI design.
