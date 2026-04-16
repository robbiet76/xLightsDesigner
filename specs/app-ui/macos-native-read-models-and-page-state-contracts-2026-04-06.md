# macOS Native Read Models And Page-State Contracts (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the state domains, read models, action surfaces, and persistence rules for the native macOS application before SwiftUI implementation begins.

This document exists to prevent the native shell from repeating the Electron failure mode of ad hoc mutable shell state.
It defines what the UI consumes, what it can mutate, and what belongs to shared backend/platform services.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `current-app-plan-2026-04-05.md`
- `native-app-architecture-diagram-2026-04-10.md`

## State-Contract Rule

The native shell must render from explicit read models, not raw backend objects and not one giant mutable app state blob.

Working rules:
1. each screen renders from a dedicated read model
2. state ownership must be explicit
3. persisted state and transient UI state must not be mixed casually
4. project state, sequence state, and track-library state are distinct domains
5. the native shell may cache and compose read models, but it does not invent backend truth
6. local screen state must not become accidental global state

## State Domains

The native app uses these top-level state domains:
1. app shell state
2. project state
3. layout state
4. shared track library state
5. design state
6. sequence state
7. review state
8. history state
9. settings state
10. transient UI state

## 1. App Shell State

### Purpose
- hold minimal app-wide context used by the shell itself

### Owns
- active project pointer
- current workflow route
- global background activity summary
- lightweight shell notifications
- app-session restoration state

### Does not own
- full project details
- selected audio track details
- active sequence detail model
- workflow-local filters and selection state unless explicitly promoted

### Persistence
Persisted across launches:
- last active project pointer when valid
- last visited workflow route when valid

Transient only:
- current banners/toasts
- ephemeral background task progress presentation

## 2. Project State

### Purpose
- represent the active project as durable working context for the workflow stack

### Owns
- project identity
- project file path
- show-folder association
- project metadata root
- project readiness summary
- project-to-track and project-to-sequence linkage summaries

### Does not own
- app-wide settings
- shared track library records themselves
- detailed live sequence runtime state

### Persistence
Persisted:
- durable project record and project file contents

Transient only:
- temporary create/open/save sheet state

## 3. Layout State

### Purpose
- represent target/layout support state used by downstream design and sequencing workflows

### Owns
- target list summary
- target type/classification state
- target tag state
- assignment state
- orphan/remapping state
- layout readiness summary

### Does not own
- project identity
- design proposal state
- live sequence runtime controls

### Persistence
Persisted:
- durable target support metadata and corrections where the product contract allows it

Transient only:
- selected target row
- local filters and sorting
- in-progress correction draft state before save/apply

## 4. Shared Track Library State

### Purpose
- represent canonical analyzed tracks and their readiness for downstream workflows

### Owns
- shared track metadata records
- track identity and verification state
- timing coverage summaries
- analysis profile availability
- library-level readiness counts

### Does not own
- active sequence context
- project identity
- live xLights media session state

### Persistence
Persisted:
- shared track metadata files and library indexes

Transient only:
- selected track row
- current file/folder picker inputs
- local batch filter/search state
- in-progress title/artist confirmation drafts before save

## 5. Design State

### Purpose
- represent creative brief, proposal, rationale, and design warnings for the active project

### Owns
- creative brief summary
- proposal bundle summary
- rationale summary
- design warnings/open questions
- relevant conversation-derived design context as productized read state

### Does not own
- live sequence runtime state
- shared track library browsing
- final implementation approval state

### Persistence
Persisted:
- design artifacts, proposal artifacts, rationale artifacts as durable records

Transient only:
- selected design subsection
- local expanded/collapsed presentation state

## 6. Sequence State

### Purpose
- represent the technical sequence-side context for the active project

### Owns
- active sequence identity
- sequence binding to shared track metadata
- sequence revision/settings snapshot
- timing materialization status
- sequence-side technical readiness and warnings
- live xLights sequence session state summary

### Does not own
- standalone track analysis state
- creative brief authorship
- final apply approval state

### Persistence
Persisted:
- durable sequence metadata owned by the app
- sequence-to-track binding records
- sequence-related persisted artifacts owned by the project/app

Transient only:
- current live refresh state
- current xLights connection/session health snapshot
- selected timing/sequence subpanel state

## 7. Review State

### Purpose
- represent the current pending implementation gate

### Owns
- pending implementation summary
- apply readiness summary
- review warnings and blockers
- backup/restore visibility relevant to the pending apply decision
- approval/apply action state

### Does not own
- historical event archive
- raw design ideation state
- detailed live sequence runtime browsing beyond what supports the review decision

### Persistence
Persisted:
- durable review/apply artifacts where the backend contract requires them

Transient only:
- current approval sheet state
- in-progress apply operation state
- ephemeral confirmation state

## 8. History State

### Purpose
- represent immutable or effectively immutable past implementation history

### Owns
- historical revision/event list
- per-event summary data
- artifact references
- selected historical event detail

### Does not own
- current pending review decision
- live sequence controls
- current creative proposal state

### Persistence
Persisted:
- durable historical revision/apply records and artifact references

Transient only:
- selected history row
- local history filters/sort controls

## 9. Settings State

### Purpose
- represent application-wide configuration and operational preferences

### Owns
- provider settings
- xLights connection preferences
- operator defaults
- storage/path preferences
- general app behavior preferences
- maintenance/diagnostic configuration visibility

### Does not own
- project-specific configuration
- shared track library content
- current sequence runtime detail

### Persistence
Persisted:
- durable app settings and configuration records

Transient only:
- selected settings category
- unsaved form edits
- test-connection in-progress state

## 10. Transient UI State

### Purpose
- hold local, screen-level interaction state that should not be promoted into durable product state

### Examples
- selected row
- local filters
- sort order
- expanded/collapsed panels
- draft field edits before save
- sheet open/closed state
- one-shot banners/toasts

### Rule
Transient UI state belongs to the local screen or local view-model layer unless there is a strong product reason to preserve it across navigation or relaunch.

## Persistence Classes

All state should be classified as one of these:

### A. Durable Product State
- belongs in project/app/library/history/settings storage
- survives relaunch
- part of product truth

### B. Session-Restorable UI State
- may survive relaunch if still valid
- examples: last route, last selected project
- must never restore stale context that is no longer valid

### C. Ephemeral UI State
- in-memory only
- examples: current selection, open sheet, transient progress affordance

## Per-Screen Read Models

Each workflow screen consumes a composed read model built from the state domains above.

### ProjectScreenModel

Composed from:
- app shell state
- project state

Required fields:
- active project identity
- project file path
- show-folder summary
- readiness summary
- lightweight downstream linkage summary
- allowed project actions

### LayoutScreenModel

Composed from:
- app shell state
- project state
- layout state

Required fields:
- active project identity
- layout readiness summary
- target rows
- selected target detail
- allowed correction actions
- local filter/sort state

### AudioScreenModel

Composed from:
- app shell state
- project state when relevant
- shared track library state
- current analysis operation state
- local transient UI state

Required fields:
- action mode
- current result summary
- library summary counts
- library rows
- selected track summary
- allowed identity-confirmation actions
- current analysis/batch progress summary
- local filter/search state

### DesignScreenModel

Composed from:
- app shell state
- project state
- design state

Required fields:
- active project identity
- creative brief summary
- proposal summary
- rationale summary
- warnings/open questions
- related downstream readiness summary when needed

### SequenceScreenModel

Composed from:
- app shell state
- project state
- sequence state

Required fields:
- active project identity
- active sequence identity
- bound track summary
- revision/settings snapshot
- timing materialization summary
- technical readiness summary
- warnings/blockers

### ReviewScreenModel

Composed from:
- app shell state
- project state
- design state
- sequence state
- review state

Required fields:
- pending implementation summary
- design summary relevant to review
- sequence summary relevant to review
- readiness state
- blockers/warnings
- allowed approval/apply actions
- apply operation progress if active

### HistoryScreenModel

Composed from:
- app shell state
- project state
- history state

Required fields:
- historical summary
- event rows
- selected event detail
- artifact references
- local filters/sort state

### SettingsScreenModel

Composed from:
- settings state
- app shell state only when needed for app-level environment context

Required fields:
- selected category
- category content model
- validation state
- test/health status state
- allowed save/revert/maintenance actions

## Action Models

Each screen also needs an explicit action model separate from the read model.

### Project Actions
- create project
- open project
- save project
- save project as
- change show-folder binding

### Layout Actions
- select target
- filter targets
- correct tags
- resolve assignment
- accept suggested mapping
- refresh layout state

### Audio Actions
- choose file
- choose folder
- analyze track
- analyze folder
- select track
- confirm track identity
- filter/search library

### Design Actions
- inspect proposal and rationale
- navigate design sections
- advance toward review when valid

### Sequence Actions
- open/select/refresh sequence context
- inspect binding and timing readiness
- refresh technical state

### Review Actions
- inspect pending implementation
- open approval/apply sheet
- confirm apply
- inspect backup/restore summary

### History Actions
- filter history
- select event
- open artifact reference
- export summary if supported

### Settings Actions
- change selected category
- edit settings values
- save changes
- revert changes
- test connection
- run maintenance actions with confirmation

## State Ownership Map

### Owned by shared backend/platform
- durable project records
- durable shared track metadata records
- durable layout support records
- durable design artifacts
- durable sequence metadata and binding records
- durable review/history artifacts
- durable app settings records
- xLights integration state acquisition and command contracts

### Owned by native shell composition layer
- screen read-model composition
- local action routing
- session-restorable route context
- transient selection/filter/sheet state
- background task presentation

### Not allowed
- storing backend truth only in the UI layer
- creating a second ad hoc persistence model just for the native shell
- mixing project truth with screen-local drafts in one undifferentiated object

## Restoration Rules

On app relaunch:
- restore last active project only if still valid
- restore last route only if still meaningful for the restored context
- do not restore stale active sequence context when sequence state is invalid or absent
- do not restore stale selection if the underlying row/item no longer exists

## Testing Implications

The native build must support read-model tests independent of SwiftUI rendering.

Required test classes later:
- screen read-model composition tests
- persistence classification tests
- restoration-rule tests
- action-model routing tests

## Exit Criteria For Design Phase

This workstream is ready when:
1. every screen has a defined read model
2. state ownership is explicit across all major domains
3. persisted vs transient rules are clear
4. restoration rules are explicit enough to avoid stale-context bugs
5. the native shell can be implemented without inventing a giant mutable app-state object
