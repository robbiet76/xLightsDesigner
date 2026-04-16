# macOS Native Design System Components (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the initial reusable component inventory for the native macOS application before SwiftUI implementation begins.

This document exists to prevent each workflow from inventing its own view primitives, state wrappers, and layout fragments during implementation.

Primary parent sources:
- `macos-native-visual-system-2026-04-06.md`
- `macos-native-interaction-model-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `native-app-architecture-diagram-2026-04-10.md`

## Component-System Rule

The native app should be built by composing a small, deliberate component set.
It should not rely on screen-specific custom widgets for routine patterns.

Working rules:
1. components exist to encode product rules, not just to avoid duplicate code
2. components should be reusable across workflows where the interaction pattern is the same
3. components must not hide business logic that belongs in shared backend/services
4. components must preserve the read-model and action-model boundaries already defined
5. do not create parallel variants of the same component unless the product meaning truly differs

## Component Inventory

The first native component set should include:
1. app navigation shell
2. workflow page header
3. summary band
4. status badge
5. data table wrapper
6. selected-detail pane
7. grouped form section
8. action bar
9. warning/banner block
10. inline edit row
11. file/folder picker row
12. progress summary block
13. empty-state block
14. error-state block
15. sheet scaffold
16. confirmation dialog model

## 1. App Navigation Shell

### Purpose
- hold the primary app sidebar and global shell chrome

### Owns
- top-level workflow navigation
- settings entry point
- minimal global context presentation
- app-wide background activity indicator placement

### Must not own
- workflow-local actions
- page-specific detail summaries
- global sequence identity

### Composition rules
- used once at the top application level
- hosts workflow screens as the main content area

## 2. Workflow Page Header

### Purpose
- give every workflow a consistent top-of-page identity band

### Required contents
- screen title
- short supporting description
- optional lightweight local context summary

### Must not become
- a giant dashboard
- a toolbar dump
- a substitute for the summary/action band

### Composition rules
- one per top-level workflow screen
- pairs with a summary band when the screen contract calls for it

## 3. Summary Band

### Purpose
- provide the compact dominant summary/action area beneath the page header

### Typical uses
- project readiness summary
- audio current-result panel
- layout readiness summary
- review pending-implementation summary
- history recent-activity summary

### Must support
- title/value summary blocks
- short explanation text
- local primary/secondary actions
- status treatment

### Composition rules
- summary bands are compact and scan-first
- a screen may have one dominant summary band; multiple equal-weight summary bands should be avoided

## 4. Status Badge

### Purpose
- encode shared workflow status semantics consistently

### Required status classes
- ready/positive
- needs review/caution
- blocked/error
- neutral/informational
- active/in-progress

### Must support
- icon optionality
- readable short labels
- color plus text semantics

### Composition rules
- use for short status states only
- do not use badges to carry long explanations

## 5. Data Table Wrapper

### Purpose
- provide the reusable browse surface for table-driven workflows

### Primary workflows
- Layout
- Audio library
- History
- selected technical areas in Sequence/Review where appropriate

### Must support
- selection-first behavior
- sort and filter integration
- stable column configuration
- selected-row styling
- empty/loading/error overlays without destroying table context

### Must not own
- business-specific cell logic beyond the generic table contract
- primary row action execution logic

### Composition rules
- paired with a selected-detail pane or summary region
- row selection updates a separate detail or summary surface

## 6. Selected-Detail Pane

### Purpose
- show selected-record identity, status, reason, and next actions

### Typical uses
- selected layout target
- selected audio track current result
- selected history event detail
- selected sequence detail region where needed

### Must support
- identity section
- status/reason section
- action section
- supporting detail section
- optional editable rows

### Composition rules
- fed by selection state from a table/list or similar browse surface
- should remain subordinate to the main workflow question

## 7. Grouped Form Section

### Purpose
- give forms a stable section grammar across Project and Settings

### Must support
- section title
- helper text
- stacked fields
- validation messaging near fields
- optional local actions

### Composition rules
- use grouped sections instead of one large undifferentiated form
- field spacing must follow the visual-system rules

## 8. Action Bar

### Purpose
- group local actions in a predictable way

### Must support
- one primary action
- one or more secondary actions
- optional tertiary/reveal actions
- disabled-state explanation where appropriate

### Composition rules
- belongs to a local region or pane, not the global shell
- if many actions compete equally, the screen contract is likely wrong

## 9. Warning / Banner Block

### Purpose
- present warning, blocking, or informational notices consistently

### Must support
- local warning
- blocking warning
- informational note
- short recommended next action or consequence text

### Composition rules
- local warnings stay near the affected region
- app-level notices should be rare and shell-scoped only when truly global

## 10. Inline Edit Row

### Purpose
- support small-scope inline edits without opening a full sheet

### Typical uses
- unresolved track title/artist confirmation
- small correction fields in a selected-detail pane

### Must support
- label
- editable value
- optional helper text
- inline validation message
- explicit save/apply affordance if not auto-committed

### Composition rules
- only for small, local corrections
- do not use for large structured editing tasks

## 11. File / Folder Picker Row

### Purpose
- support native file/folder selection consistently

### Typical uses
- audio single-track selection
- audio batch folder selection
- project root or show-folder selection where relevant

### Must support
- label
- current path summary
- browse action
- optional helper text
- validation/error state

### Composition rules
- the component gathers the user selection
- durable path validation still belongs to shared services

## 12. Progress Summary Block

### Purpose
- present long-running local workflow progress without turning the whole screen into a spinner

### Typical uses
- audio analysis progress
- batch analysis progress
- xLights connection or sequence refresh summary
- review/apply progress

### Must support
- current stage text
- completion/result summary
- warning/failure surface
- optional progress metric when available

### Composition rules
- appears in the workflow where the action was initiated
- may mirror as a lightweight shell activity indicator secondarily

## 13. Empty-State Block

### Purpose
- provide readable first-use and no-data guidance

### Must support
- concise explanation
- next step guidance
- optional primary action

### Composition rules
- use inside the screen region that is empty
- do not replace the whole screen unnecessarily if other regions still matter

## 14. Error-State Block

### Purpose
- present local failure cleanly

### Must support
- readable failure summary
- affected area/context
- retry guidance when available
- what remains usable

### Composition rules
- localize the error to the affected region when possible
- do not promote ordinary local errors to app-global banners by default

## 15. Sheet Scaffold

### Purpose
- give modal sheets a shared structural pattern

### Must support
- sheet title
- short explanatory text
- content region
- footer action bar
- cancellation affordance

### Typical uses
- project create/open flow
- advanced layout correction
- review/apply confirmation bundle
- complex filter builders

### Composition rules
- use sheets for focused temporary tasks
- do not use a sheet for trivial one-field edits

## 16. Confirmation Dialog Model

### Purpose
- standardize destructive or high-risk confirmation interactions

### Must support
- concise risk summary
- explicit consequence statement
- confirm action label
- cancel action label

### Composition rules
- use for destructive resets, deletes, or high-risk replacement actions
- do not use for harmless navigation or selection

## Composition Rules Across Components

### Browse + detail pattern
- `Data Table Wrapper` + `Selected-Detail Pane`
- applies to `Layout`, `Audio`, and `History`

### Summary-first pattern
- `Workflow Page Header` + `Summary Band` + supporting content
- applies strongly to `Project`, `Review`, and parts of `Sequence`

### Form pattern
- `Workflow Page Header` + grouped `Form Sections` + `Action Bar`
- applies to `Settings` and project editing flows

### Operation pattern
- local action trigger + `Progress Summary Block` + result state
- applies to audio analysis, xLights refresh, and review/apply

## State And Data Rules For Components

Components may consume:
- screen read-model slices
- local view-model state
- local action handlers

Components must not own:
- canonical durable truth
- backend business logic
- shell-specific schema forks

Rule:
- components present and route
- services decide and persist

## Priority Build Order

The first component implementation set should be:
1. app navigation shell
2. workflow page header
3. summary band
4. status badge
5. data table wrapper
6. selected-detail pane
7. action bar
8. grouped form section
9. warning/banner block
10. progress summary block

The second wave can add:
- inline edit row
- file/folder picker row
- empty/error state blocks
- sheet scaffold
- confirmation dialog model

## Explicit Non-Goals

This component inventory must not become:
- a generic visual token dump without workflow meaning
- a place to hide backend logic
- a license to over-abstract every one-off view too early

## Exit Criteria For Design Phase

The component inventory is ready when:
1. major screens can be mapped to a reusable component set
2. each component has a clear responsibility boundary
3. composition rules are explicit enough to guide SwiftUI structure
4. the team can build screens by composition instead of re-inventing routine patterns
