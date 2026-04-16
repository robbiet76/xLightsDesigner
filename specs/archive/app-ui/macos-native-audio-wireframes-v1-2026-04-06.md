# macOS Native Audio Wireframes v1 (2026-04-06)

Status: Draft For Review
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Provide the first concrete wireframe set for the native macOS `Audio` workflow.

This is a review artifact, not implementation.
It translates the `Audio` screen contract and wireframe review package into state-by-state annotated layouts.

Primary parent sources:
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-audio-wireframe-review-package-2026-04-06.md`
- `macos-native-visual-system-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`

## Wireframe Rules

These wireframes are intentionally medium-fidelity in structure and labeling.
They are meant to expose layout, hierarchy, and action clarity issues before SwiftUI implementation.

Working rules:
1. current-result is the selected-track action surface
2. the library grid is a browse surface, not a button field
3. only one action mode is visually primary at a time
4. batch state and single-track state share one coherent screen grammar
5. the screen must stay calm and readable under density

## Shared Region Key

A. `Page Header`
B. `Action Panel`
C. `Current Result`
D. `Library Toolbar`
E. `Library Grid`

## State 1: Default / First Use

```text
+--------------------------------------------------------------------------------------+
| A  Audio Analysis                                                                    |
|    Analyze songs into shared track metadata for later sequencing.                    |
|    47 tracks  |  24 complete  |  11 needs review  |  1 failed                        |
+--------------------------------------------------------------------------------------+
| B  Analyze                                                                            | C  Current Result                        |
|    [ Single Track ]  Folder Batch                                                    |    No track selected yet                |
|                                                                                      |    Choose a file or select a library    |
|    Audio File                                                                        |    track to inspect current metadata.   |
|    [ No file selected ........................................ ] [Browse File]       |                                         |
|                                                                                      |    What appears here:                   |
|    [ Analyze Track ]                                                                 |    - track identity                     |
|                                                                                      |    - timing availability                |
|    Folder Batch                                                                      |    - readiness / action needed          |
|    Choose a folder to analyze many songs into the shared library.                    |                                         |
+--------------------------------------------------------------------------------------+
| D  Shared Track Library                                             [Search later]   |
+--------------------------------------------------------------------------------------+
| E  Track                              Status        Timings         Identity  Action  |
|    Candy Cane Lane - Sia             Complete      Struct/Phr/B/B Verified  None     |
|    Carol Of The Bells                Needs Review  Struct/Beats/B Temp      Verify   |
|    Christmas Sarajevo                Partial       Struct/Beats/B Verified  None     |
|    ...                                                                            ... |
+--------------------------------------------------------------------------------------+
```

### Annotations
- dominant action: `Analyze Track`
- dominant result area: `Current Result`
- component mapping:
  - A = `Workflow Page Header`
  - B/C = `Summary Band` with embedded `Action Bar`
  - E = `Data Table Wrapper`
- warning/error semantics:
  - none prominent in this state

### Review notes
- the page opens in `Single Track` mode by default
- `Folder Batch` is visible but collapsed/secondary
- the current-result panel explains its future role without becoming empty noise

## State 2: Single-Track Ready

```text
+--------------------------------------------------------------------------------------+
| A  Audio Analysis                                                                    |
|    Analyze songs into shared track metadata for later sequencing.                    |
+--------------------------------------------------------------------------------------+
| B  Analyze                                                                            | C  Current Result                        |
|    [ Single Track ]  Folder Batch                                                    |    Candy Cane Lane - Sia                |
|                                                                                      |    Last analyzed: Today 10:42 AM        |
|    Audio File                                                                        |    [Complete] [Verified]                |
|    [ /Show/Audio/Sia - Candy Cane Lane.mp3 ................. ] [Browse File]         |                                         |
|                                                                                      |    Available timings                    |
|    [ Analyze Track ]                                                                 |    Song Structure, Phrase Cues,         |
|                                                                                      |    Beats, Bars                          |
|    Folder Batch                                                                      |                                         |
|    Analyze a folder of songs into the shared library.                                |    Missing / issues                     |
|                                                                                      |    None                                 |
|                                                                                      |                                         |
|                                                                                      |    Recommended action                   |
|                                                                                      |    None                                 |
+--------------------------------------------------------------------------------------+
| D  Shared Track Library                                              Search   Filter |
+--------------------------------------------------------------------------------------+
| E  Track                              Status        Timings         Identity  Action  |
| >  Candy Cane Lane - Sia             Complete      Struct/Phr/B/B Verified  None     |
|    Carol Of The Bells                Needs Review  Struct/Beats/B Temp      Verify   |
|    Christmas Sarajevo                Partial       Struct/Beats/B Verified  None     |
|    ...                                                                            ... |
+--------------------------------------------------------------------------------------+
```

### Annotations
- dominant action: `Analyze Track`
- dominant result area: selected-track summary in C
- selection behavior: selecting a row updates C only; grid scroll position remains fixed
- component mapping:
  - C = `Selected-Detail Pane` adapted as `Current Result`
  - D = lightweight toolbar integrated with `Data Table Wrapper`

### Review notes
- `Current Result` is summary-first, not editor-first
- timing availability is human-readable and flat
- the grid remains dense and secondary to selected-track understanding

## State 3: Single-Track Needs Review

```text
+--------------------------------------------------------------------------------------+
| A  Audio Analysis                                                                    |
|    Analyze songs into shared track metadata for later sequencing.                    |
+--------------------------------------------------------------------------------------+
| B  Analyze                                                                            | C  Current Result                        |
|    [ Single Track ]  Folder Batch                                                    |    Carol Of The Bells                   |
|                                                                                      |    Last analyzed: Today 10:58 AM        |
|    Audio File                                                                        |    [Needs Review] [Temporary Identity]  |
|    [ /Show/Audio/Carol Of The Bells.mp3 .................... ] [Browse File]         |                                         |
|                                                                                      |    Available timings                    |
|    [ Analyze Track ]                                                                 |    Song Structure, Beats, Bars          |
|                                                                                      |                                         |
|                                                                                      |    Missing / issues                     |
|                                                                                      |    Phrase cues missing. Track title     |
|                                                                                      |    and artist were not verified.        |
|                                                                                      |                                         |
|                                                                                      |    Track Title                          |
|                                                                                      |    [ Carol Of The Bells ............. ] |
|                                                                                      |    Track Artist                         |
|                                                                                      |    [ Mannheim Steamroller ........... ] |
|                                                                                      |                                         |
|                                                                                      |    [ Confirm Track Info ]              |
+--------------------------------------------------------------------------------------+
| D  Shared Track Library                                              Search   Filter |
+--------------------------------------------------------------------------------------+
| E  Track                              Status        Timings         Identity  Action  |
|    Candy Cane Lane - Sia             Complete      Struct/Phr/B/B Verified  None     |
| >  Carol Of The Bells                Needs Review  Struct/Beats/B Temp      Verify   |
|    Christmas Sarajevo                Partial       Struct/Beats/B Verified  None     |
|    ...                                                                            ... |
+--------------------------------------------------------------------------------------+
```

### Annotations
- dominant action: `Confirm Track Info`
- editable vs read-only boundary:
  - title/artist editable only because identity is unresolved
  - timing/status summaries remain read-only
- component mapping:
  - editable rows = `Inline Edit Row`
  - primary action grouped locally in `Current Result`

### Review notes
- this state should make user action obvious without any hidden panel
- the grid still carries only `Verify` text in the action column, not a button

## State 4: Folder Batch In Progress

```text
+--------------------------------------------------------------------------------------+
| A  Audio Analysis                                                                    |
|    Analyze songs into shared track metadata for later sequencing.                    |
+--------------------------------------------------------------------------------------+
| B  Analyze                                                                            | C  Current Result                        |
|    Single Track  [ Folder Batch ]                                                    |    Batch Analysis In Progress           |
|                                                                                      |    [Running]                            |
|    Audio Folder                                                                      |                                         |
|    [ /Show/Audio ............................................. ] [Browse Folder]     |    Processing                           |
|    [x] Include subfolders                                                           |    18 / 40 files complete               |
|                                                                                      |    Current stage                        |
|    [ Analyze Folder ]                                                                |    Deep analysis and metadata write     |
|                                                                                      |                                         |
|    Current batch note                                                                |    Early result summary                 |
|    Building shared track records in the library.                                     |    10 complete  |  6 needs review       |
|                                                                                      |    2 failed                             |
+--------------------------------------------------------------------------------------+
| D  Shared Track Library                                              Search   Filter |
+--------------------------------------------------------------------------------------+
| E  Track                              Status        Timings         Identity  Action  |
|    Candy Cane Lane - Sia             Complete      Struct/Phr/B/B Verified  None     |
|    Carol Of The Bells                Needs Review  Struct/Beats/B Temp      Verify   |
|    ... library remains visible during batch progress ...                            |
+--------------------------------------------------------------------------------------+
```

### Annotations
- dominant action: batch is already running; state is progress-first
- result area shifts from selected-track summary to batch-progress summary
- component mapping:
  - C = `Progress Summary Block`
- warning semantics:
  - not a blocking warning, only active progress

### Review notes
- the screen should not collapse into a spinner-only view
- library visibility remains useful during long runs

## State 5: Folder Batch Complete

```text
+--------------------------------------------------------------------------------------+
| A  Audio Analysis                                                                    |
|    Analyze songs into shared track metadata for later sequencing.                    |
+--------------------------------------------------------------------------------------+
| B  Analyze                                                                            | C  Current Result                        |
|    Single Track  [ Folder Batch ]                                                    |    Batch Complete                       |
|                                                                                      |    [Complete]                           |
|    Audio Folder                                                                      |                                         |
|    [ /Show/Audio ............................................. ] [Browse Folder]     |    Processed                            |
|    [x] Include subfolders                                                           |    40 files                             |
|                                                                                      |                                         |
|    [ Analyze Folder Again ]                                                          |    Results                              |
|                                                                                      |    24 complete                          |
|                                                                                      |    11 needs review                      |
|                                                                                      |    4 partial                            |
|                                                                                      |    1 failed                             |
|                                                                                      |                                         |
|                                                                                      |    Top issues                           |
|                                                                                      |    Missing phrase cues, temporary       |
|                                                                                      |    identity, low-confidence titles      |
+--------------------------------------------------------------------------------------+
| D  Shared Track Library                                              Search   Filter |
+--------------------------------------------------------------------------------------+
| E  Track                              Status        Timings         Identity  Action  |
|    Candy Cane Lane - Sia             Complete      Struct/Phr/B/B Verified  None     |
|    Carol Of The Bells                Needs Review  Struct/Beats/B Temp      Verify   |
|    ... updated rows reflect the new batch results ...                               |
+--------------------------------------------------------------------------------------+
```

### Annotations
- dominant action: optional `Analyze Folder Again`
- dominant result area: concise batch completion summary
- component mapping:
  - C remains `Progress Summary Block`, now in completion state

### Review notes
- batch completion should be understandable without opening a separate report
- library now becomes the natural next place to inspect specific rows

## State 6: Error / Blocked

```text
+--------------------------------------------------------------------------------------+
| A  Audio Analysis                                                                    |
|    Analyze songs into shared track metadata for later sequencing.                    |
+--------------------------------------------------------------------------------------+
| B  Analyze                                                                            | C  Current Result                        |
|    [ Single Track ]  Folder Batch                                                    |    Analysis Could Not Start             |
|                                                                                      |    [Blocked]                            |
|    Audio File                                                                        |                                         |
|    [ No file selected ........................................ ] [Browse File]       |    What failed                          |
|                                                                                      |    No readable audio file was selected. |
|    [ Analyze Track ]                                                                 |                                         |
|                                                                                      |    What remains usable                  |
|    Folder Batch                                                                      |    Existing library browsing is still   |
|    Analyze a folder of songs into the shared library.                                |    available below.                     |
|                                                                                      |                                         |
|                                                                                      |    [ Retry ]                            |
+--------------------------------------------------------------------------------------+
| D  Shared Track Library                                              Search   Filter |
+--------------------------------------------------------------------------------------+
| E  Track                              Status        Timings         Identity  Action  |
|    ... existing rows remain available even while local action failed ...             |
+--------------------------------------------------------------------------------------+
```

### Annotations
- dominant action: `Retry`
- error stays localized to the affected current action/result region
- library remains usable below
- component mapping:
  - C = `Error-State Block`

### Review notes
- the page structure should survive errors intact
- local failure should not escalate to a full-screen dead end

## Review Decisions Pending

No review decisions recorded yet.
This is the initial wireframe draft.

## Open Questions To Resolve In Review

1. should the library toolbar ship with search only or search plus one basic status filter
2. should the batch-complete panel offer a direct `Show Needs Review Only` action
3. should `Partial` with no required action visually differ from `Needs Review` more strongly than status text alone
4. should the current-result panel preserve the selected row while a new single-track analysis is running, or should it temporarily pivot to the running task
5. should the page remember the last valid mode on return, or always reopen in `Single Track`
