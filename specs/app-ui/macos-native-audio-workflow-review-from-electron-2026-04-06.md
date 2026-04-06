# macOS Native Audio Workflow Review From Electron (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Use the existing Electron `Audio` workflow as a reference artifact while defining the native macOS `Audio` screen more precisely.

This document does not treat Electron as the target shell.
It treats Electron as a workflow inventory and a high-level wireframe reference.

The purpose is to reduce design ambiguity before any SwiftUI implementation starts.

Primary parent sources:
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `audio-page-redesign-2026-04-06.md`

## Review Rule

For the native design phase:
1. specs remain the source of truth
2. Electron is used as a workflow reference only
3. no new product-direction decisions should be discovered by extending Electron implementation
4. if Electron and the spec disagree, the spec wins unless this review explicitly revises it

## Current Electron Audio Workflow Snapshot

The current Electron `Audio` page already demonstrates several useful structural decisions:
- a page header
- a top action area
- a current-result area
- a lower shared-library grid
- inline identity confirmation in the current-result area
- recursive folder analysis in batch mode

It also still carries problems that should not be migrated into the native shell as-is.

## What To Keep

These parts of the current Electron workflow are directionally correct and should carry into the native design.

### 1. Action-above-library structure

Keep:
- action controls above the library grid
- current-result summary above the library grid

Reason:
- this correctly makes the page action-first rather than browse-first
- it avoids turning the page into a library browser with hidden actions

### 2. Current-result as the action surface

Keep:
- selected-track summary and inline correction in the `Current Result` panel
- no action buttons in grid rows

Reason:
- this matches the interaction rule that actions belong near the affected summary/detail region
- it avoids row-cell action clutter

### 3. Dense shared-library grid

Keep:
- dense grid for track browsing
- status, timing availability, identity state, and action summary visible per row

Reason:
- this is the right browse surface for a growing track library
- cards are inferior here

### 4. Distinct single-track and folder-batch modes

Keep:
- one clear single-track workflow
- one clear folder-batch workflow
- recursive batch toggle

Reason:
- these are the actual user jobs on this screen
- they should remain explicit rather than being merged into one vague action region

### 5. Inline title/artist confirmation only when needed

Keep:
- editable identity fields only when canonical identity is unresolved
- confirmation action only in that state

Reason:
- user correction should remain secondary
- verified canonical data should not become casually editable

## What To Remove

These parts of the current Electron workflow should not carry into the native shell.

### 1. Any feeling of a dashboard page

Remove:
- fragmented status-card feeling
- any leftover internal runtime framing
- any UI that reads like an operator console rather than a workflow page

Reason:
- the native app should feel like a calm desktop tool, not a web dashboard

### 2. Any hidden secondary detail dependency

Remove:
- required below-the-grid detail areas
- hidden panels that are necessary to complete the main flow

Reason:
- the main flow must be understandable from the header, action area, current result, and grid alone

### 3. Sequence or xLights context leakage

Remove:
- any implication that this page is driven by the active sequence
- any global sequence framing
- any sequence-control affordances here

Reason:
- `Audio` is explicitly standalone and sequence-independent

### 4. Overexposed low-value detail

Remove:
- raw JSON
- pipeline-stage jargon
- low-level service traces
- verbose issue lists in the main scan path

Reason:
- the page should answer what matters, not dump implementation detail

## What To Change

These are the key native design changes relative to the current Electron reference.

### 1. Tighten the top band into a cleaner two-column contract

Change:
- keep the two-column pattern
- make the left column explicitly the action column
- make the right column explicitly the result/correction column
- avoid any ambiguity about which area the user should read after acting

Native rule:
- left = `Do`
- right = `Understand / Fix`

### 2. Make mode switching quieter and more native

Change:
- Electron mode switching is functionally correct but still visually web-like
- the native version should use a calmer segmented-control style without making the inactive mode disappear completely

Native rule:
- one mode is active
- the inactive mode remains visible and understandable
- the inactive mode should not visually compete with the active one

### 3. Make the current-result panel more explicit about state

Change:
- the native panel should always answer these in the same order:
  1. what track or batch result am I looking at
  2. what state is it in
  3. what timings are available
  4. what is missing or questionable
  5. do I need to do anything now

Native rule:
- current-result stays summary-first
- editing appears only when needed
- the panel must not turn into a property inspector

### 4. Tighten grid semantics

Change:
- Electron currently proves the grid can drive selection
- the native spec should lock that the grid is for browse, compare, and select only

Native rule:
- single click selects row
- selection updates current result
- selection does not reset scroll position
- row actions are text-only summaries, not interactive controls

### 5. Clarify status language further

Change:
- keep the current broad states, but make native copy stricter and more readable

Preferred states:
- `Complete`
- `Partial`
- `Needs Review`
- `Failed`

Native rule:
- each non-complete state must have:
  - one readable reason
  - one readable next-action statement
  - or an explicit `No action needed`

## Native Audio Screen Definition Derived From Review

The native `Audio` screen should now be treated as this concrete composition.

### Region 1: Header

Contains:
- title: `Audio Analysis`
- one-sentence purpose
- lightweight library counts only

Should not contain:
- sequence identity
- xLights status
- diagnostics

### Region 2: Action Column

Contains:
- mode selector
- file or folder picker rows
- primary analysis action for the active mode
- minimal supporting note only

Should not contain:
- result explanation
- issue summaries
- editing controls unrelated to launching analysis

### Region 3: Current Result Column

Contains:
- selected track or latest batch identity
- status badges
- timing availability list
- missing/issues summary
- readable recommended action
- inline identity editing only when valid
- primary correction action only when valid

Should not contain:
- deep raw detail
- detached secondary inspector behavior

### Region 4: Shared Track Library Grid

Contains:
- browseable track list
- readable state comparison across many tracks
- row selection behavior
- compact action/status summaries

Should not contain:
- embedded action buttons
- editing fields
- hidden required workflow logic

## Concrete Review Checklist For Audio

When reviewing the native `Audio` design against Electron, answer these directly.

1. Is the first action obvious within three seconds of opening the page?
2. Does the top band clearly separate action from understanding/fix-up?
3. Does the current-result panel fully replace the need for a required secondary detail panel?
4. Is the library grid useful for comparison without becoming the primary action surface?
5. Is `Needs Review` both understandable and actionable?
6. Does the page stay sequence-independent in language and structure?
7. Could a user understand the purpose of this screen without knowing internal pipeline terms?

## Decision For The Next Design Pass

For the native design process moving forward:
- use this review document plus the core `Audio` screen contract as the primary `Audio` design reference
- treat `macos-native-audio-wireframes-v1-2026-04-06.md` as a secondary historical artifact only
- do not produce more low-fidelity ASCII wireframes for `Audio`
- the next refinement should be a tighter implementation-facing screen specification, not another abstract wireframe set
