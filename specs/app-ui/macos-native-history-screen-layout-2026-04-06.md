# macOS Native History Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `History` screen before any SwiftUI implementation begins.

This screen exists to make past implementation activity inspectable without confusing it with current pending review work.
It is retrospective and immutable by default.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-history-workflow-review-from-electron-2026-04-06.md`


## Reference Rule

The current Electron `History` page is a workflow reference only.
It may be used to evaluate list/detail history browsing and evidence visibility, but it is not the target shell.
If Electron behavior and this screen contract diverge, this screen contract wins unless explicitly revised in the History workflow review document.

## Screen Role

The native `History` screen answers:
- what has already been applied or completed
- when it happened
- what changed
- what artifacts or evidence exist for that historical action

It is not the place to approve pending work.
That belongs to `Review`.

## Screen-Contract Rules

1. the first read surface must be historical summary, not pending work
2. the primary browse surface must be a revision/event list, not cards
3. row selection must drive a single historical detail area
4. current actionable approval controls must not appear here
5. the screen must make temporal order obvious
6. historical detail must be readable without showing raw JSON by default

## Primary User Questions

1. what has already happened in this project
2. which revisions or apply events matter most recently
3. what changed in a selected historical event
4. what evidence or artifacts support that event

## Information Hierarchy

The screen uses four vertical regions:

1. page header
- workflow title
- one-sentence explanation
- active project context

2. history summary band
- recent activity summary
- counts or lightweight grouped status
- date-range framing if useful

3. revision/event list band
- primary browse surface for past events
- supports selection, sorting, and filtering

4. selected revision detail band
- shows what happened in the selected event
- shows linked evidence and artifact references
- shows downstream significance where useful

## Region Specifications

### 1. Page Header

Required content:
- `History`
- short supporting description
- active project name

Must not include:
- active approval controls
- live sequence dashboard controls
- primary design authoring tools

### 2. History Summary Band

Purpose:
- give a concise overview of historical activity before the user reads the full event list

Required content:
- total recorded events or revisions
- latest event summary
- date of latest applied or completed event
- optional lightweight breakdown by event type

Examples:
- `12 recorded apply events. Latest change applied today at 2:14 PM.`
- `No completed implementation history yet.`

The summary band must stay compact.
It must not become an analytics dashboard.

### 3. Revision/Event List Band

Purpose:
- provide the primary browse and selection surface for history

Required table columns:
- `When`
- `Type`
- `Summary`
- `Sequence`
- `Result`
- `Artifacts`

Column intent:
- `When`: timestamp or readable date/time
- `Type`: event classification such as apply, revision, import, review completion
- `Summary`: one-line human-readable description
- `Sequence`: related sequence when relevant
- `Result`: completed/partial/failed or equivalent historical outcome
- `Artifacts`: short indicator of available evidence bundle

Grid rules:
- rows are selectable, not inline editable
- list order defaults to newest first
- filters may include event type, sequence, date range, result state
- no apply buttons or pending-review actions appear in rows

### 4. Selected Revision Detail Band

Purpose:
- explain the selected historical event without forcing the user into raw logs

Required sections:
1. event identity
- timestamp
- type
- owning project/sequence if relevant

2. change summary
- what happened
- what scope changed
- whether it was complete or partial

3. supporting evidence
- linked artifacts or report references
- proposal/review/apply summaries when relevant

4. historical notes and warnings
- warnings that were recorded at the time
- limits of what the historical record can prove

5. follow-up context
- optional pointer to current state if useful
- must remain secondary and non-actionable by default

Interaction rules:
- history detail is read-first
- destructive mutation of history records is out of scope
- opening external artifact files is allowed as a secondary action when supported

## Dominant Action Model

Primary actions should remain lightweight.
This is a browse-and-inspect workflow.

Likely actions:
- `Filter History`
- `Open Artifact`
- `Reveal Related Revision`
- `Export History Summary`

Actions that must not be primary here:
- `Approve`
- `Apply`
- `Create Proposal`
- `Open Live Sequence Control`

## Read Model Requirements

The `History` screen requires:
- active project identity
- historical event/revision list
- per-event summary data
- linked artifact/reference availability
- selected history item state

## Empty, Loading, And Error States

### Empty / First Use

Use when no history exists yet.

Required content:
- explain what will appear here later
- explain that pending work is reviewed elsewhere
- do not frame this as an error

### Loading

Use when historical records are loading.

Required behavior:
- keep the list/detail structure visible
- show lightweight loading treatment in the summary and list regions

### Error

Use when history cannot be loaded.

Required content:
- short readable failure summary
- whether history is unavailable or only partially unavailable
- retry guidance if possible

## Required Wireframe States

The wireframe package for `History` must include:
1. empty history
2. populated history with no selection
3. populated history with selected revision detail
4. filtered history state
5. loading state
6. error state

## Required Prototype Flows

The click-through prototype should cover:
1. open `History` from an active project
2. scan the recent-history summary
3. filter to a relevant event class
4. select a revision row
5. inspect the change summary and evidence references
6. open an artifact reference or return to the list

## Explicit Non-Goals

The `History` screen must not become:
- a pending approval page
- a live sequence dashboard
- a design ideation page
- a raw log console
- an app settings surface

## Exit Criteria For Design Phase

The `History` screen contract is ready for native wireframes when:
1. the event list columns are stable
2. the selected-detail hierarchy is clear
3. the difference between `Review` and `History` is unmistakable
4. historical artifact references are defined at the right level of detail

## Screen Reading Order

The native `History` screen should read in this order:
1. what historical activity exists
2. which recent event matters most
3. what happened in the selected event
4. what evidence or artifacts support it

## Default Behavior

When history exists, the event list should remain the primary browse surface and default to newest first.

Behavior rules:
- row selection updates the selected-history detail only
- row selection must not reset list scroll position
- pending approval controls must never appear here

## Native Acceptance Criteria

The `History` screen is implementation-ready only when:
1. it is unmistakably retrospective rather than pending-review oriented
2. the list is the primary browse surface
3. selected detail explains what happened without raw log dependence
4. evidence visibility is clear
5. the page does not drift into approval/apply ownership
