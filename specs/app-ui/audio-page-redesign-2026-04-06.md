# Audio Page Redesign (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-06

## Purpose

Define the Audio page as a clear standalone workflow for building and inspecting shared track metadata.

This page should help a user do exactly three things:
1. choose one song and analyze it
2. choose a folder and batch-analyze it into the shared library
3. inspect the resulting track metadata quality at a high level

This page should not try to be:
- a sequence control page
- a diagnostics dump
- a downstream sequencing dashboard
- a hidden power-user tool that requires reading the whole screen to understand the first action

## Current Problems

The current Audio page fails on information hierarchy.

Observed issues:
- too many cards and status fragments are shown at once
- the first user action is not visually obvious
- single-track and batch analysis are mixed together without a clear decision point
- downstream sequencing language appears too early
- low-value detail competes with the core action
- the page reads like an internal dashboard instead of a user workflow

The result is that the user has to interpret the product instead of the product guiding the user.

## Product Boundary

The Audio page owns standalone audio analysis only.

It is responsible for:
- selecting audio input
- running analysis
- writing shared track metadata records
- showing whether the result is usable
- surfacing the most important quality gaps

It is not responsible for:
- opening or controlling xLights sequences
- applying timing tracks into xLights
- sequence-level review or approval
- proposal generation or sequencing status

Those belong later in the workflow.

## Primary User Flows

### Flow A: Analyze One Song

User goal:
- pick a single song and create or refresh its shared track metadata record

Required UI steps:
1. choose audio file
2. click analyze
3. see progress
4. see result summary
5. see whether beats, bars, phrases, and song structure are present

### Flow B: Analyze A Folder

User goal:
- batch-analyze a folder of test or show audio files into the shared track library

Required UI steps:
1. choose audio folder
2. click analyze folder
3. see running state and progress summary
4. see completion counts
5. see top issue categories
6. optionally open the full review report later

### Flow C: Inspect Current Result

User goal:
- quickly understand whether the selected track metadata is good enough

Required UI output:
- track identity
- analysis freshness / last analyzed time
- timing coverage status
- concise structure summary
- top quality warnings only

## Information Hierarchy

The Audio page should have 4 vertical zones only.

### 1. Page Header

Purpose:
- tell the user what this page is for

Contents:
- title: `Audio Analysis`
- one-sentence description:
  - `Analyze songs into shared track metadata for later sequencing.`

### 2. Primary Action Panel

Purpose:
- make the next action obvious

This panel should be visually dominant.

Contents:
- segmented mode choice or clearly separated actions:
  - `Single Track`
  - `Folder Batch`
- only the controls needed for the chosen mode

For `Single Track`:
- audio file path field
- `Browse File`
- `Analyze Track`

For `Folder Batch`:
- folder path field
- `Browse Folder`
- `Analyze Folder`

Rule:
- do not show both workflows at full weight simultaneously
- one should be active, the other secondary

### 3. Current Result Panel

Purpose:
- summarize the selected track or latest batch run

For `Single Track` show:
- track name
- artist
- last analyzed time
- status badges:
  - `Song Structure`
  - `Phrase Cues`
  - `Beats`
  - `Bars`
- one short analysis summary
- top 3 warnings max

For `Folder Batch` show:
- total tracks
- success count
- failure count
- top issue counts
- review report path/link action

### 4. Secondary Detail Panel

Purpose:
- allow deeper inspection without dominating the page

Examples:
- visible structure section labels
- timing coverage notes
- issue list
- report paths

Rule:
- secondary detail must be collapsed, tabbed, or visually subordinate
- no large diagnostic wall on initial view

## Layout Rules

Use a simple, narrow information model.

Rules:
- one dominant action area at the top
- one dominant result area below it
- details below the fold or in a secondary expandable region
- avoid more than 2 columns for primary content
- avoid chip overload
- avoid exposing internal pipeline stages unless the user asks for detail

## Content Rules

Use user-facing language.

Prefer:
- `Analyze Track`
- `Analyze Folder`
- `Shared Track Metadata`
- `Ready for sequencing`
- `Missing phrase cues`

Avoid:
- internal agent names as the primary page framing
- internal runtime or artifact jargon as default UI copy
- sequencing references on the Audio page unless they describe readiness only

## Recommended Component Structure

### `audio-page-header`
- title
- short purpose sentence

### `audio-analysis-mode-card`
- mode toggle: single vs folder
- only the active mode inputs and action button

### `audio-result-summary-card`
- single-track summary or batch summary
- this is the main read surface after actions

### `audio-detail-card`
- secondary details only
- collapsed by default if needed

## Page-State Contract Direction

The current `audio_dashboard_state_v1` is carrying too much mixed concern.

It should evolve toward:
- `mode`
- `actions`
- `currentResult`
- `detail`

Instead of exposing many parallel dashboard fragments.

Suggested shape:
- `mode.active`
- `mode.singleTrack`
- `mode.batch`
- `currentResult.kind`
- `currentResult.summary`
- `currentResult.coverage`
- `currentResult.warnings`
- `detail.structure`
- `detail.review`

## Rewrite Scope

### In scope
- audio page layout rewrite
- simplified action model
- clearer copy
- better page-state organization for audio-specific UX
- visually secondary treatment for detail and review noise

### Out of scope
- sequencing linkage UI
- xLights timing track creation UI
- deep diagnostics redesign
- library browser beyond minimal result access

## Rewrite Order

1. finalize this spec
2. simplify `audio_dashboard_state_v1` around action/result/detail
3. rewrite `audioScreen()` to the new hierarchy
4. update bindings for explicit single-track vs folder actions
5. run manual UX inspection in the desktop app
6. only then add any additional detail surfaces

## Acceptance Criteria

The rewrite is successful when:
- a new user can tell what to click in under 5 seconds
- single-track vs folder analysis is obvious
- the page feels like one workflow, not six dashboards
- the user can tell whether a track is usable without reading a wall of text
- the page does not imply sequence/xLights dependency
