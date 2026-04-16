# macOS Native Interaction Model (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the shared interaction rules for the native macOS application before SwiftUI implementation begins.

This document exists to prevent each screen from inventing its own selection, editing, action-placement, and confirmation behavior during implementation.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `native-app-architecture-diagram-2026-04-10.md`

## Interaction-Model Rule

Shared interaction behavior must be consistent across workflows unless a screen has a strong product reason to diverge.

Working rules:
1. selection is separate from action execution
2. primary actions must be obvious and local to the content they affect
3. editing must be explicit
4. destructive actions must be isolated and confirmed
5. navigation and selection must preserve user context whenever possible
6. background work must be visible without overwhelming the screen

## 1. Selection Model

### Default Rule

Tables and lists are selection-first surfaces.
Selecting a row updates the relevant summary/detail region.
Selection alone does not trigger a destructive or irreversible action.

### Required Selection Behavior

- row selection updates the associated summary/detail pane
- row selection must not reload the page
- row selection must not reset scroll position in the originating grid/list
- selection must persist while filters and sort order remain compatible
- if the selected item disappears because of filtering, the UI must handle that clearly

### Multi-Selection

Default rule:
- single selection unless a workflow explicitly requires batch actions

Batch selection may be allowed later for:
- Audio library batch maintenance
- History export operations
- Layout bulk correction tools

Do not introduce multi-selection by default.

## 2. Action Placement Rules

### Primary Rule

Actions belong as close as possible to the content they affect.

Preferred placement order:
1. current-content summary/detail region
2. local screen toolbar
3. modal sheet footer if the action belongs to a sheet

Avoid:
- scattering important actions across row cells
- hiding the primary action in a context menu by default
- placing screen-local actions in the global app frame

### Row-Level Surfaces

Grid/list rows may show:
- status
- next-action text
- lightweight affordances

Grid/list rows should not normally contain:
- the only primary action button
- dense clusters of buttons
- destructive controls

### Workflow Examples

- `Audio`: row selection updates `Current Result`; confirm/fix actions live there
- `Layout`: row selection updates selected-target correction band; correction actions live there
- `Review`: approval/apply actions live in the dominant pending-summary region
- `History`: actions are secondary and read-oriented, not row-dominant

## 3. Editing Model

### Default Rule

Editable state must be obvious.
The user should be able to tell when they are viewing versus editing.

### Allowed Editing Patterns

1. inline editing in a summary/detail region
- use for small, local corrections
- example: unresolved title/artist confirmation in `Audio`

2. structured form editing in a dedicated panel or category view
- use for `Project` and `Settings`

3. modal sheet editing
- use when the task needs focused temporary context
- do not use for routine single-field edits

### Editing Rules

- do not auto-enter editing mode from ordinary selection
- edited fields must be visually distinct from read-only values
- validation feedback must appear near the affected control
- save/cancel or apply/revert behavior must be explicit unless auto-save is intentionally defined later

## 4. Sheet, Dialog, And Confirmation Rules

### Sheets

Use a sheet when:
- the task is focused and temporary
- the user should not lose the underlying screen context
- the task has enough complexity that inline editing would overload the current screen

Good sheet candidates:
- create/open project flow
- advanced mapping correction
- complex filter builder
- review/apply confirmation package

### Dialogs

Use dialogs for:
- short confirmations
- short warnings
- naming a new object when no richer context is needed

Do not use dialogs for:
- complex multi-field editing
- large detail inspection

### Destructive Confirmation

Require confirmation for:
- deleting or resetting durable data
- destructive maintenance actions
- replacing important bindings or assignments when loss is plausible

Do not require confirmation for:
- ordinary row selection
- harmless inspection actions
- idempotent refresh operations

## 5. Progress And Background Work

### Default Rule

Background work must be visible, but progress indication should stay proportional.

### Rules

- long-running tasks need visible progress state
- progress should appear first in the workflow where the task was initiated
- app-wide background indicator is allowed only as lightweight global context
- completed tasks should resolve into readable summary state, not leave stale running indicators behind

### Examples

- `Audio` analysis progress belongs primarily on `Audio`
- xLights health or sequence refresh belongs primarily on `Sequence` or `Settings`
- a small app-wide activity indicator may appear in the shell, but it must not replace local status

## 6. Navigation And Context Preservation

### Default Rule

The app should preserve local context when the user is moving within the same workflow.

Required behaviors:
- preserve table/list scroll position on row selection
- preserve filter state while inspecting details
- preserve the last useful local state when switching away and back, if still valid
- do not restore stale sequence-specific state when no active sequence exists

### Cross-Workflow Navigation

When moving between workflows:
- keep project context if valid
- keep only the local state that remains meaningful
- do not carry sequence context into unrelated screens as global chrome

## 7. Read-Only Versus Editable Boundaries

Each screen should make this distinction obvious.

Default rule:
- tables/lists are primarily read and select surfaces
- summary/detail regions are where editing or action happens

Examples:
- `Audio` library grid: read/select
- `Audio` current result: selective inline editing
- `History` list and detail: read-only by default
- `Layout` selected-target band: correction/editing allowed where supported

## 8. Error And Warning Presentation

### Errors

Use errors for:
- unavailable required data
- failed operations
- invalid configuration

Rules:
- keep the surrounding screen structure visible when practical
- say what failed, what remains usable, and whether retry is possible
- avoid raw technical dumps in the primary UI surface

### Warnings

Use warnings for:
- incomplete state
- low-confidence state
- unresolved issues that do not fully block the workflow

Rules:
- warnings should explain the consequence and next action
- warnings should not look identical to fatal failures

## 9. Keyboard And macOS Expectations

Native implementation should respect common macOS patterns.

Baseline expectations:
- sidebar navigation should feel native
- table selection should support keyboard navigation
- standard macOS sheet/dialog behavior should be preferred
- common actions should be discoverable without requiring custom gestures

Detailed shortcut design can be deferred, but the interaction model must not conflict with native expectations.

## 10. Screen-Specific Interaction Notes

### Assistant
- assistant is a shared utility surface, not a workflow screen
- opening assistant must not navigate away from the current workflow
- assistant may reference current workflow context, but must not replace local detail/action regions
- conversation persistence must remain independent from volatile screen state

### Project
- create/open/save actions are prominent and local
- project identity is read-first, editable only where appropriate

### Layout
- selection drives correction band
- bulk action behavior should be conservative until explicitly designed

### Audio
- action mode selection is explicit
- selected track summary is the action surface
- library grid remains selection-first

### Design
- read-heavy, inspect-heavy surface
- avoid accidental technical editing drift

### Sequence
- technical inspection first
- local actions should relate to live sequence context only

### Review
- apply/approval actions are intentionally dominant
- this is the exception where a primary action must be visually prominent

### History
- read-first, no pending approval controls

### Settings
- category-based forms
- destructive maintenance actions isolated from ordinary preferences

## Exit Criteria For Design Phase

The interaction model is ready when:
1. selection behavior is consistent across list/grid workflows
2. action-placement rules are stable
3. editing, sheet, and confirmation behavior is explicit
4. progress and context-preservation rules are defined clearly enough to implement without invention
