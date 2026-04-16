# macOS Native Audio Wireframe Review Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the first review-ready wireframe and prototype package for the native macOS `Audio` workflow.

This package translates the `Audio` screen contract, visual system, interaction rules, and component inventory into a concrete design review checklist.
It exists so the `Audio` workflow can be reviewed as a complete product slice before SwiftUI implementation begins.

Primary parent sources:
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `macos-native-visual-system-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`

## Review-Package Rule

The `Audio` workflow is not ready for native implementation until this package exists with:
1. a complete major-state wireframe set
2. annotated interaction notes
3. a prototype flow checklist
4. an explicit open-questions list
5. review decisions captured after each design pass

## Workflow Goal

The `Audio` workflow must make these three jobs clear:
1. analyze one track
2. batch-analyze a folder into the shared track library
3. inspect whether a track is ready enough for later sequencing

It must do this without becoming:
- a sequence-control screen
- an xLights session screen
- a diagnostics wall
- a card-heavy dashboard

## Review Scope

This package covers:
- `Audio` page structure
- mode switching between single-track and folder-batch workflows
- current-result panel behavior
- shared track library grid behavior
- selected-row to current-result update behavior
- inline identity confirmation behavior
- batch progress and completion behavior

This package does not yet cover:
- final polished visual styling
- SwiftUI component implementation
- backend/service implementation details

## Required Wireframe Set

The wireframe set must include these states.

### 1. Default / first-use state

Must show:
- page header
- action-and-result band
- `Single Track` as the default active mode unless a later product decision changes this
- empty current-result panel guidance
- empty or near-empty library guidance when applicable

Review questions:
- is the first action obvious
- does the screen explain what it is for without clutter
- is the page calm rather than busy

### 2. Single-track ready state

Must show:
- single-track controls populated
- current-result panel with a complete or acceptable track
- timing availability clearly listed
- library grid populated
- selected row aligned with current-result content

Review questions:
- is the current-result panel the obvious place to understand the selected track
- are timing layers readable at a glance
- is the page too dense

### 3. Single-track needs-review state

Must show:
- selected track with `Needs Review` or equivalent caution state
- readable reason text
- inline editable title/artist fields only if user confirmation is allowed
- `Confirm Track Info` as the primary action in the current-result panel
- library grid still stable below

Review questions:
- is the corrective action obvious
- is the action in the right place
- does the page make clear why user input is needed

### 4. Folder-batch in-progress state

Must show:
- folder mode active
- folder path selected
- recursive toggle visible
- progress summary visible in the current-result panel or equivalent summary region
- library grid still available if appropriate

Review questions:
- is batch progress easy to understand
- does the screen avoid looking like a diagnostics console
- is single-track behavior still easy to return to

### 5. Folder-batch complete state

Must show:
- total processed count
- complete / partial / needs-review / failed counts
- concise top issue categories
- library reflects the updated results

Review questions:
- is the batch result understandable without opening a report file
- does the screen communicate what to do next

### 6. Error / blocked state

Must show:
- readable failure summary
- the affected region only, when possible
- what remains usable
- retry path if relevant

Review questions:
- does the page stay structurally intact during failure
- are errors distinct from warnings

## Wireframe Annotation Requirements

Each wireframe must annotate:
- dominant action
- dominant result area
- local warnings versus blocking issues
- editable versus read-only fields
- selection behavior
- which component(s) the region should map to later

Minimum annotation categories:
1. component mapping
2. state-source mapping
3. action mapping
4. warning/error semantics

## Expected Component Mapping

The `Audio` workflow should primarily compose from:
- `Workflow Page Header`
- `Summary Band`
- `Action Bar`
- `File / Folder Picker Row`
- `Status Badge`
- `Data Table Wrapper`
- `Selected-Detail Pane` or equivalent current-result panel structure
- `Inline Edit Row`
- `Progress Summary Block`
- `Empty-State Block`
- `Error-State Block`

Rule:
- the library grid must remain a browse surface
- the current-result panel must remain the action surface for the selected track

## Prototype Checklist

The click-through prototype for `Audio` must validate these flows:

### Flow 1: Single-track analysis
1. enter `Audio`
2. use `Single Track`
3. browse and choose a file
4. run analysis
5. see progress
6. land in selected-result state

### Flow 2: Row selection updates current result
1. scan the library grid
2. select a row
3. current-result panel updates to the selected track
4. scroll position in the grid is preserved

### Flow 3: Needs-review correction
1. select a `Needs Review` row
2. see reason and recommended action
3. edit title/artist inline
4. confirm track info
5. see status/result update clearly

### Flow 4: Folder batch
1. switch to `Folder Batch`
2. choose a folder
3. confirm recursive behavior
4. run batch analysis
5. view progress and completion summary
6. inspect resulting library rows

### Flow 5: Return and persistence sanity
1. leave `Audio`
2. come back
3. confirm local context restoration behaves sensibly and does not resurrect stale task state

## Required Review Questions

The review must answer these explicitly:
1. is the first action obvious on entry
2. is the current-result panel clearly more important than the grid for selected-track understanding
3. is the grid readable and dense enough without feeling cramped
4. is `Needs Review` actionable without forcing the user into hidden panels
5. is batch mode clearly distinct from single-track mode without feeling like a second page
6. does the page avoid sequence/xLights confusion
7. is any region still carrying too much low-value information

## Open Questions

These questions must be resolved during wireframe review before implementation:
1. should `Single Track` always be the default active mode, or should the app remember the last valid audio mode
2. should the library toolbar include search and filters in the first native implementation, or should it start with summary-only plus basic search
3. should the current-result panel visually switch structure between single-track and batch result states, or should it keep one rigid frame
4. should incomplete-but-acceptable tracks use `Partial` and `No action needed`, or is another wording clearer
5. how much report detail should be visible directly after batch completion versus deferred to later drill-down

## Review Outcome Recording

After each review pass, record:
- decisions made
- open questions closed
- layout changes requested
- interaction changes requested
- items deferred intentionally

## Build-Readiness Gate For Audio

The `Audio` workflow is build-ready only when:
1. the wireframe set covers all required major states
2. the prototype flows above are coherent
3. the current-result and library relationship is unambiguous
4. mode switching is clear and not visually noisy
5. the open-question list is reduced to minor implementation details only
