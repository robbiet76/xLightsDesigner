# macOS Native Audio Figma Mockup Package (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the exact high-fidelity Figma mockup package for the native macOS `Audio` workflow.

This document replaces the earlier low-fidelity wireframe direction as the primary visual review artifact for `Audio`.
The output of this package should be a real screen-level Figma mockup set and click-through prototype, not text boxes and not implementation code.

Primary parent sources:
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-audio-wireframe-review-package-2026-04-06.md`
- `macos-native-visual-system-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `macos-native-design-system-components-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`

## Mockup-Package Rule

For `Audio`, the primary design review artifact is now a high-fidelity Figma screen set.

Working rules:
1. no more ASCII wireframes for `Audio`
2. the mockups must look like real application screens
3. the mockups must resolve layout, hierarchy, density, and action clarity issues before SwiftUI work begins
4. the mockups must be good enough to support a click-through prototype review

## Deliverable Type

The `Audio` mockup package must contain:
1. high-fidelity Figma frames for all required major states
2. annotations or companion notes for behavior where static visuals are insufficient
3. click-through prototype connections for the required `Audio` flows
4. a review decision log tied to the mockup package

## Frame Set

The Figma package must include these frames.

### Frame 1: Default / first-use

Intent:
- show the entry state clearly
- make the first action obvious
- make the page feel calm, not busy

Must show:
- page header
- action-and-result band
- `Single Track` as the active mode by default for the initial review pass
- empty current-result panel
- populated library grid or representative seeded grid if total emptiness would undercut review value

Review target:
- clarity of entry and first action

### Frame 2: Single-track ready

Intent:
- show the steady-state happy path for a selected usable track

Must show:
- selected analyzed file in single-track mode
- populated current-result panel
- timing availability summary
- populated library grid with selected row
- no unnecessary warning emphasis

Review target:
- current-result as the dominant understanding surface

### Frame 3: Single-track needs review

Intent:
- show the corrective state for unresolved identity without hidden panels or scattered actions

Must show:
- selected `Needs Review` track
- readable issue explanation
- inline title/artist confirmation fields
- `Confirm Track Info` as the dominant local action
- library grid still present and stable below

Review target:
- action discoverability and correction clarity

### Frame 4: Folder batch in progress

Intent:
- show that batch work can be monitored without turning the page into a diagnostics console

Must show:
- `Folder Batch` mode active
- folder path selected
- recursive toggle visible
- progress summary in the current-result region
- library grid still visible

Review target:
- calm progress communication during long-running work

### Frame 5: Folder batch complete

Intent:
- show concise completion feedback and natural next-step orientation into the library

Must show:
- processed counts
- complete / partial / needs review / failed counts
- top issue categories
- updated library rows

Review target:
- post-batch comprehension without report-file dependency

### Frame 6: Error / blocked

Intent:
- show localized failure handling without collapsing the whole page

Must show:
- current-result region in blocked/error state
- browse surface preserved below
- retry affordance in the affected local region

Review target:
- graceful failure handling

## Optional Additional Frames

These are optional for the first mockup pass but likely useful:
1. library filtered to `Needs Review`
2. very dense library state with many rows visible
3. selected `Partial` track with `No action needed`
4. return-to-screen restored state after prior use

## Frame-Level Visual Requirements

Every frame must follow the visual-system rules already defined.

Required visual characteristics:
- native macOS feel
- compact-to-standard density
- strong page-region hierarchy
- calm neutral surfaces
- semantic status color use only
- table-first browse area, not card-first dashboard layout

Disallowed visual traits:
- giant floating cards with excess whitespace
- stacked dashboard blocks with equal emphasis everywhere
- decorative workflow-specific color themes
- grid rows overloaded with controls

## Required Component Mapping In Mockups

The Figma mockups should visibly map to the agreed native component set.

Expected components in the `Audio` package:
- `Workflow Page Header`
- `Summary Band`
- `Action Bar`
- `File / Folder Picker Row`
- `Status Badge`
- `Data Table Wrapper`
- `Selected-Detail Pane` adapted as `Current Result`
- `Inline Edit Row`
- `Progress Summary Block`
- `Error-State Block`

## Prototype Flow Requirements

The Figma prototype must support these click-through flows:

### Flow 1: Enter and run single-track analysis
1. enter `Audio`
2. browse file
3. trigger analyze
4. land in the ready state

### Flow 2: Select a library row
1. scroll/browse grid
2. select a row
3. see current-result update
4. preserve browse context

### Flow 3: Correct a needs-review track
1. select a `Needs Review` row
2. edit title/artist
3. confirm track info
4. land in updated state

### Flow 4: Switch to folder batch
1. change mode
2. browse folder
3. confirm recursive behavior
4. run batch
5. progress state
6. completion state

### Flow 5: Localized failure
1. start from single-track mode
2. surface blocked/error state
3. retry locally without losing the whole screen

## Mockup Review Questions

The Figma review must answer these:
1. does the page immediately communicate what to do first
2. is the current-result panel visually stronger than the grid in the right way
3. is the grid dense enough to be useful without feeling cramped
4. does the `Needs Review` state make the corrective action obvious
5. does folder-batch mode feel like the same workflow rather than a separate application screen
6. is anything still visually noisy or overloaded
7. does the page feel like a real desktop tool rather than a web dashboard

## Open Questions For The Figma Pass

These remain active review questions and should be resolved during the mockup pass:
1. should `Single Track` remain the default active mode or should the app restore the last valid mode
2. should the first implementation include just search in the library toolbar or search plus one status filter
3. should batch-complete include a direct shortcut into `Needs Review` rows
4. should `Partial` plus `No action needed` have a visually distinct treatment from `Needs Review`
5. how much of the batch issue summary belongs in the current-result region versus deferred detail

## Review Outcome Recording

Each Figma review pass should record:
- decisions made
- open questions closed
- requested layout changes
- requested content-density changes
- requested interaction changes
- explicitly deferred issues

## Build-Readiness Gate For Audio

The `Audio` workflow is visually ready for native implementation only when:
1. the Figma frame set covers all required major states
2. the prototype flows are connected and reviewable
3. current-result versus library hierarchy is unambiguous
4. needs-review correction flow is visually and behaviorally clear
5. the page feels stable enough that implementation can follow it rather than rediscover it
