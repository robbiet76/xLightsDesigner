# macOS Native Workflow Contracts (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the contract for each top-level workflow in the native macOS application.

This document exists to prevent workflow overlap, unclear scope boundaries, and implementation-time invention of page purpose.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`

## Workflow-Contract Rule

Each top-level workflow must answer all of the following before screen wireframes begin:
- why the user comes here
- what this workflow owns
- what this workflow explicitly does not own
- what state it depends on
- what conditions allow entry
- what outcomes define successful exit

Working rules:
1. workflows must be mutually legible, not mutually redundant
2. every workflow must have a strong primary job
3. supporting context must not become accidental primary content
4. app-wide controls must stay out of workflow contracts unless truly global

## Workflow Order

The native app uses this primary workflow order:
1. `Project`
2. `Audio`
3. `Sequence`
4. `Design`
5. `Review`
6. `Metadata`
7. `History`

Global destination outside the workflow:
- `Settings`

This ordering reflects the product journey, not just a nav list.

## 1. Project

### Purpose
- establish or restore the active project context

### Primary user goals
- create a new project
- open an existing project
- confirm the project identity and working paths
- understand the current project status at a glance

### Owns
- project create/open/save/save-as lifecycle
- project identity
- show-folder association
- project-level summary and readiness
- project-to-shared-library linkage summary

### Does not own
- standalone track analysis operations
- live xLights sequence control
- creative design review
- app settings and service configuration

### Entry conditions
- always accessible
- first-run default landing workflow

### Exit conditions
- an active project context is established or updated
- the user can move to downstream workflows with a valid project context

### Required read-model dependencies
- app state: active project pointer
- project state: identity, file path, show folder, summary, bindings overview
- shared library summary: lightweight counts only when relevant

### Required action model
- create project
- open project
- save project
- save project as
- change show folder / project bindings

### Out-of-scope behaviors
- xLights connection troubleshooting
- audio batch processing
- sequence-level apply actions

## 2. Audio

### Purpose
- own standalone track analysis and shared track-library inspection

### Primary user goals
- analyze one track
- batch-analyze a folder
- inspect track metadata quality and timing coverage
- confirm unresolved track identity when automation cannot verify it

### Owns
- file/folder selection for audio analysis
- track analysis initiation and progress
- shared track metadata browsing
- timing availability summary
- incomplete-state explanation and actionability
- limited track identity confirmation when canonical identity is unresolved

### Does not own
- active sequence context
- xLights media/session control
- timing-track materialization into an active sequence
- proposal or apply workflow

### Entry conditions
- accessible with or without an active sequence
- accessible with or without an active project, subject to final product decision later

### Exit conditions
- a shared track metadata record exists or has been refreshed
- the user can determine whether the track is usable for later sequencing
- unresolved identity gaps are either confirmed or clearly marked for later handling

### Required read-model dependencies
- shared track library state
- current analysis operation state
- selected file/folder input state
- selected track summary state
- lightweight project context when relevant

### Required action model
- choose file
- analyze track
- choose folder
- analyze folder
- select track row
- confirm track identity when allowed
- inspect summary/detail states

### Out-of-scope behaviors
- sequence open/switch
- xLights timing import/apply
- design proposal review

## 3. Sequence

### Purpose
- own the live sequence context and technical sequencing state for the active project

### Primary user goals
- understand which sequence is active
- understand which shared track metadata record is bound to that sequence
- inspect live sequence revision/settings state
- inspect sequence-side timing materialization readiness
- understand technical translation state from design to sequence

### Owns
- active sequence identity and revision context
- sequence-to-track binding visibility
- sequence-specific timing track materialization status
- technical translation/dashboard state for sequencing
- sequence-scoped readiness/warnings

### Does not own
- standalone track analysis
- creative direction and proposal authoring
- final apply approval gate
- app-wide settings

### Entry conditions
- an active project should normally exist
- sequence-specific details may be empty if no sequence is open

### Exit conditions
- the user understands the active sequence context and technical readiness
- any blocking sequence-side dependency is visible before review/apply

### Required read-model dependencies
- project state
- active sequence state
- sequence-to-track binding state
- sequence revision/settings snapshot
- timing materialization state
- sequencing translation/readiness state

### Required action model
- open/select/refresh active sequence context
- inspect sequence details
- inspect binding state
- inspect sequence warnings and readiness

### Out-of-scope behaviors
- full creative brief authoring
- standalone library browsing
- final apply confirmation

## 4. Design

### Purpose
- own the creative interpretation and design intent view

### Primary user goals
- understand the creative brief and direction
- inspect current proposal state
- review design rationale and warnings
- understand how the current conversation resolves into design intent

### Owns
- creative brief summary
- proposal bundle summary
- director profile influence
- design rationale
- creative warnings/open questions
- design-side conversation/state presentation

### Does not own
- sequence implementation details
- timing-track management
- final apply gate
- broad metadata editing

### Entry conditions
- active project context normally exists
- design state may be partially empty during early project setup

### Exit conditions
- the user understands the current design intent and whether it is ready for review

### Required read-model dependencies
- active proposal/design state
- creative brief state
- design warnings/open questions
- reference context summary

### Required action model
- inspect design artifacts
- inspect proposal state
- move toward review when ready

### Out-of-scope behaviors
- direct sequence apply actions
- standalone audio processing
- app settings

## 5. Review

### Purpose
- own the current implementation gate for pending sequence changes

### Primary user goals
- understand what is pending right now
- understand implementation impact and readiness
- approve and apply when ready
- inspect backup/restore implications around apply

### Owns
- pending implementation summary
- apply readiness state
- impact summary
- approval gate
- apply actions
- backup/restore visibility tied to the current pending implementation

### Does not own
- raw ideation and creative capture
- long-term history browsing
- standalone track analysis
- broad metadata editing

### Entry conditions
- active project context exists
- pending design/sequence state exists or the page clearly explains that there is nothing to review

### Exit conditions
- the user has either applied, deferred, or rejected the current pending implementation state

### Required read-model dependencies
- pending implementation state
- design snapshot summary
- sequence translation summary
- apply readiness/warning state
- backup/restore visibility for the current pending change

### Required action model
- inspect pending implementation
- approve/apply
- defer or reject
- inspect current apply warnings

### Out-of-scope behaviors
- browsing old revisions as a primary task
- standalone sequence editing
- audio analysis management

## 6. Metadata

### Purpose
- own semantic targeting and support metadata used by downstream creative and sequencing workflows

### Primary user goals
- inspect targets and tags
- correct assignments
- resolve orphan or remapping issues
- understand target metadata quality

### Owns
- tags
- assignments
- remapping/orphan handling
- target metadata inspection
- semantic support context for later workflows

### Does not own
- project lifecycle
- creative ideation
- apply gating
- standalone audio analysis

### Entry conditions
- active project context normally exists

### Exit conditions
- metadata state is clearer or corrected for downstream workflows

### Required read-model dependencies
- project metadata state
- target/tag assignment state
- orphan/remapping state
- metadata warnings/issues

### Required action model
- inspect metadata rows
- edit/correct assignments where allowed
- resolve or acknowledge orphan/remapping issues

### Out-of-scope behaviors
- creative proposal authoring
- sequence apply actions
- app configuration

## 7. History

### Purpose
- own immutable revision inspection and audit visibility

### Primary user goals
- inspect what was previously applied
- understand which artifacts and sequence state were involved
- compare prior implementation snapshots at a high level
- recover audit visibility without reading raw JSON

### Owns
- history entry list
- selected revision summary
- artifact reference visibility
- immutable apply snapshot inspection

### Does not own
- current pending review/apply decision
- live sequence editing
- standalone library management

### Entry conditions
- active project context normally exists
- history may be empty and should explain that state clearly

### Exit conditions
- the user understands a previous implementation state or audit trail

### Required read-model dependencies
- history entry list
- selected history entry detail
- artifact reference summaries
- apply result summary

### Required action model
- select history entry
- inspect revision summary
- inspect referenced artifacts at a summary level

### Out-of-scope behaviors
- approving current changes
- direct editing of historical artifacts
- live sequencing work

## 8. Settings

### Purpose
- own app-wide configuration and operational controls

### Primary user goals
- configure application services
- configure xLights integration preferences
- manage provider/model settings
- access true app-wide debug/reset/testing controls

### Owns
- service configuration
- provider/model configuration
- xLights connection preferences
- operator identity preferences
- app-wide operational controls

### Does not own
- project-specific content
- track-library browsing as a primary task
- sequence review/apply workflow
- day-to-day creative/design workflow

### Entry conditions
- always accessible
- not part of the main workflow journey

### Exit conditions
- global app configuration is changed or verified

### Required read-model dependencies
- app configuration state
- provider/service health summary where relevant
- app-wide operational flags

### Required action model
- edit settings
- save/apply settings
- invoke app-wide debug/reset/testing controls when explicitly needed

### Out-of-scope behaviors
- project setup content
- sequence-level workflow actions
- normal workflow dashboards

## Cross-Workflow Guardrails

1. `Audio` must remain sequence-independent.
2. `Sequence` must own active sequence context; no global header leakage.
3. `Design` must own creative interpretation, not execution approval.
4. `Review` must own the current implementation gate, not history browsing.
5. `History` must remain immutable and retrospective.
6. `Settings` must stay outside the workflow journey.
7. `Metadata` is a support workflow, not a primary creative or apply workflow.

## Decisions Locked Here

1. every native top-level section now has a defined contract
2. the native workflow model remains workflow-first, not dashboard-first
3. page overlap is constrained before wireframe work begins
4. `Audio` and `Sequence` remain distinct and must not be blended
5. `Review` and `History` remain distinct and must not be blended
6. `Settings` remains globally available but outside the workflow path

## Immediate Next Design Step

After this document:
1. define screen layout specifications
2. start with `Audio`
3. then define `Project`
4. then define `Sequence`, `Design`, and `Review`
