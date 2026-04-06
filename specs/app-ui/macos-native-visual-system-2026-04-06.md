# macOS Native Visual System (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the shared native visual language for the macOS application before SwiftUI implementation begins.

This document exists to prevent each screen from inventing its own density, hierarchy, status treatment, and form/table/detail-pane style during implementation.

Primary parent sources:
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`

## Visual-System Rule

The native app should feel like one intentional macOS product.
It should not feel like a collection of unrelated panels or a browser dashboard translated into SwiftUI.

Working rules:
1. hierarchy must be obvious before polish is considered
2. dense data screens must remain readable without becoming sparse and wasteful
3. tables, forms, and detail panes must use a common visual grammar
4. status presentation must be consistent across workflows
5. visual emphasis should follow workflow importance, not arbitrary styling variation
6. native conventions should be preferred over ornamental styling

## Product Character

The visual direction should be:
- macOS-native
- structured
- information-dense but calm
- serious and tool-like, not playful
- modern without trying to look like a web dashboard

Avoid:
- card-heavy dashboard sprawl
- oversized empty spacing that hides density problems
- ornamental color usage without semantic meaning
- too many competing emphasis treatments on one screen

## 1. Typography Direction

### Goals
- make dense screens readable
- keep summaries clear without oversized display type
- support tables, forms, sidebars, and detail panes consistently

### Rules
- use the native macOS typography system as the baseline
- prioritize readable weight and hierarchy over stylized type choices
- reserve strong emphasis for screen titles, section titles, and dominant state summaries
- body copy should remain compact and readable
- helper text should be visibly secondary but still legible

### Hierarchy Levels
- screen title
- region/section title
- row/record title
- body text
- helper text / metadata text
- status and badge text

### Guidance
- screen titles should not dominate the entire window
- section titles should be clear but compact
- tables should use restrained text sizing for scanability
- secondary metadata should not compete with primary summaries

## 2. Spacing And Density System

### Goals
- support a real desktop productivity tool
- keep workflows readable without wasting vertical space
- preserve consistency across screens

### Density Rules
- use compact-to-standard density as the default
- summary bands should be compact and scannable
- dense browse surfaces such as grids/tables should not be padded like marketing cards
- forms should breathe more than tables, but still remain disciplined

### Spacing Tiers
- tight spacing: row internals, badge groups, short helper pairs
- standard spacing: form groups, section stacks, summary bands
- generous spacing: separation between major screen regions only

### Rules
- do not stack many isolated cards with large gaps between them
- prefer a few strong screen regions over many loosely related panels
- detail panes should feel adjacent to their browse surface, not detached from it

## 3. Screen Region Grammar

Every major workflow screen should feel structurally related.

Preferred regional vocabulary:
1. page header
2. summary/action band
3. primary browse or inspection surface
4. selected-detail or supporting region

Rules:
- page header is concise
- summary/action band is visually distinct but not oversized
- primary browse surface gets the most stable space allocation
- supporting detail should be subordinate to the primary workflow question

## 4. Table And Grid Conventions

### Purpose
Tables/grids are the primary browse surfaces for:
- Layout
- Audio library
- History
- likely parts of Sequence and Review

### Rules
- use native table/list patterns where possible
- rows should be compact, scannable, and selection-first
- headers must be clear and durable
- status and issues should be readable without requiring row expansion
- avoid stuffing rows with button clusters

### Column Style Rules
- primary identifier column should be visually strongest
- status columns should be compact and semantically consistent
- issue/action columns should remain short and readable
- metadata/date columns should be visually quieter

### Row Style Rules
- selected row state must be unmistakable but not loud
- hover affordances should remain subtle
- zebra striping is optional; if used, it must remain restrained
- row height should support readable density, not airy emptiness

## 5. Detail-Pane Conventions

### Purpose
Detail panes summarize and contextualize the selected item.
They are not substitutes for raw logs or giant property inspectors.

### Rules
- detail panes should start with identity and status
- recommended action and reason should appear near the top when relevant
- editable controls should be visually distinct from summary-only fields
- long technical evidence should be secondary and collapsible when needed
- detail panes should align visually with the browse surface they support

### Layout Guidance
- identity and status first
- summary/reason second
- actions third
- deeper supporting detail last

## 6. Form Layout Rules

### Purpose
Forms are primary on:
- Project
- Settings
- localized edit flows elsewhere

### Rules
- use grouped sections with clear headings
- keep labels stable and explicit
- group related fields tightly
- keep helper text close to the relevant field
- validation feedback must appear near the offending field
- do not create giant uninterrupted forms when category grouping can reduce load

### Editing Guidance
- editable controls must look editable
- read-only values must not look like input controls
- commit behavior must be explicit where edits are not auto-saved

## 7. Status Badge System

### Purpose
Status language must look and feel consistent across workflows.

### Core status classes
- positive / ready
- caution / needs review
- blocked / error
- informational / neutral
- active / in progress

### Rules
- badge language should be plain and durable
- color must reinforce meaning, not be the only carrier of meaning
- the same status class should use the same visual treatment across screens
- do not invent new status colors casually for one workflow

### Common labels
Examples only, not final exhaustive list:
- `Ready`
- `Needs Review`
- `Blocked`
- `Complete`
- `Partial`
- `Failed`
- `Running`
- `Pending`

## 8. Alert, Banner, And Warning Treatments

### Purpose
Distinguish between:
- local incomplete states
- screen-level warnings
- app-level notices
- destructive-risk messaging

### Rules
- local warnings stay inside the workflow where they matter
- banners should be reserved for workflow- or app-level issues worth interrupting scan flow
- fatal errors and cautionary warnings must not look identical
- avoid persistent banner clutter at the top of every page

### Risk hierarchy
- informational note
- local warning
- blocking warning
- destructive confirmation

## 9. Action Styling Rules

### Primary actions
- reserved for the most important next step in a region or workflow
- should be visually clear without overwhelming the screen
- there should rarely be more than one dominant primary action in a local region

### Secondary actions
- common supporting actions
- visible but quieter

### Tertiary actions
- reveal/open/export/supporting tasks
- should not compete with the primary flow

### Rules
- do not use visual emphasis as a substitute for unclear workflow structure
- if many actions appear equally strong, the screen hierarchy is wrong

## 10. Split-View And Pane Conventions

### Purpose
The native app will rely heavily on sidebar, browse surface, and detail relationships.

### Rules
- the main app sidebar remains the primary global navigation surface
- workflow-local split views are acceptable when they clarify browse-detail relationships
- panes should resize sensibly without hiding the workflow hierarchy
- detail panes should not collapse into unusable narrow columns by default
- avoid deeply nested pane stacks unless the workflow truly requires them

## 11. Color Usage Rules

### Goals
- support semantics and hierarchy
- avoid visual noise
- preserve readability in a serious desktop tool

### Rules
- use color primarily for status, selection support, and emphasis
- avoid giving each workflow its own decorative palette identity
- neutral surfaces should do most of the work
- accent color should guide important actions and selected state, not decorate everything

## 12. Workflow-Specific Visual Notes

### Project
- summary-forward
- forms and identity blocks should feel stable and trustworthy

### Layout
- target grid is the dominant surface
- correction pane should feel precise, not bulky

### Audio
- current-result panel should feel like the action surface
- library grid should remain dense and readable
- batch and single-track modes should feel clearly distinct without becoming two different pages

### Design
- more reading-oriented than most screens
- design summaries should not look like technical tables

### Sequence
- technical summaries should remain structured and legible
- avoid turning the page into a diagnostic wall

### Review
- pending summary and apply action need strong visual clarity
- this is the one workflow where deliberate action emphasis is expected

### History
- quiet, retrospective, read-first
- historical detail should not look like pending work

### Settings
- category navigation and grouped forms should feel orderly
- diagnostics and destructive tools must be visually isolated

## 13. Wireframe Expectations Tied To The Visual System

Wireframes should already reflect:
- the chosen density rules
- table and detail-pane grammar
- status badge system
- primary vs secondary action emphasis
- grouped form structure

Do not leave these as “implementation details later.”
They are part of the design package.

## Exit Criteria For Design Phase

The visual system is ready when:
1. all screen wireframes can use one consistent region grammar
2. table, detail-pane, and form rules are stable
3. status treatments are consistent across workflows
4. density and spacing rules are explicit enough to prevent per-screen improvisation
5. implementation can choose concrete SwiftUI components/styles without inventing the product look from scratch
