# macOS Native Information Architecture (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the top-level information architecture for the native macOS application.

This document answers the first product-design questions before any screen-level SwiftUI build begins:
- what the major sections of the app are
- what the primary navigation model is
- what context is global versus local
- what the default landing experience is
- what should appear in the app frame at all times

Primary parent plans:
- `macos-native-migration-phase-plan-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`

## Information-Architecture Rule

The native app is one coherent product with workflow-based navigation.
It is not a loose collection of migrated Electron pages.

Working rules:
1. every top-level section must have a distinct job
2. global context must stay minimal
3. page-specific context must stay on its own screen
4. sequence context must not leak into unrelated workflows
5. app settings must remain outside the primary project workflow

## Primary Navigation Model

The native app uses a left sidebar as the primary navigation surface.

Top-level sections:
1. `Project`
2. `Audio`
3. `Sequence`
4. `Design`
5. `Review`
6. `Layout`
7. `History`

Secondary global destination:
- `Settings`

Rationale:
- this preserves the workflow-first product structure that already emerged from the better parts of the Electron design work
- it keeps the user journey understandable from project setup through sequencing and review
- it prevents app-wide controls from polluting the project workflow

## App Map

### 1. Project

Purpose:
- define the active project and its working context

Owns:
- create/open project
- show-folder identity
- project summary
- project-level bindings and paths

Does not own:
- standalone audio analysis
- sequence implementation details
- app-wide settings

### 2. Audio

Purpose:
- own standalone track analysis and shared track-library inspection

Owns:
- analyze one track
- analyze a folder
- inspect shared track metadata
- verify unresolved track identity
- assess timing coverage/readiness

Does not own:
- active sequence context
- xLights session control
- apply/review actions

### 3. Sequence

Purpose:
- own live sequence context and sequence-specific technical state

Owns:
- active sequence identity
- sequence settings/revision summary
- sequence-to-track binding
- sequence-specific timing materialization status
- live sequencing translation state

Does not own:
- standalone track analysis
- creative design review
- app-wide settings

### 4. Design

Purpose:
- own the creative interpretation layer

Owns:
- creative brief
- proposal bundle
- director profile
- reference direction
- design-side conversation state as presented to the user

Does not own:
- sequence execution controls
- timing-track management
- library browsing

### 5. Review

Purpose:
- own the current implementation gate

Owns:
- pending implementation summary
- apply readiness
- backup/restore visibility
- approval and apply actions

Does not own:
- raw creative ideation
- long-term history browsing
- standalone audio analysis

### 6. Layout

Purpose:
- own layout targets and support layout context

Owns:
- tags
- assignments
- remapping/orphans
- target metadata inspection

Does not own:
- primary project setup
- creative workflow
- apply gate

### 7. History

Purpose:
- own immutable revision inspection

Owns:
- prior applied revisions
- snapshot detail
- artifact references
- audit/recovery visibility

Does not own:
- current pending apply decision
- active sequence editing
- standalone library work

### Settings

Purpose:
- own app-wide configuration and operational controls

Owns:
- service configuration
- xLights connection preferences
- model/provider settings
- operator identities
- reset/debug/testing controls that are truly app-wide

Does not belong in the primary workflow because:
- it is application configuration, not a project phase

## Default Landing Experience

Default rule:
- if no active project is established, land on `Project`
- if an active project exists, land on the last visited workflow page within that project context

Additional landing rules:
1. first-run experience should bias toward `Project`
2. app relaunch should restore the last useful workflow only if the active project context is still valid
3. the app must not drop the user into a stale sequence-specific view when no active sequence context exists
4. `Audio` may be entered without an active sequence

## Global Context Rules

The native app frame should show only minimal global context.

Allowed global context:
- active project name
- active show folder summary
- app-wide background task indicator when needed
- top-level navigation
- access to settings

Disallowed global context:
- active sequence name in the global header
- page-specific detail summaries in the app frame
- workflow-specific toolbars that belong to a specific screen
- diagnostics that belong inside a local workflow

Reason:
- global sequence context created confusion in the Electron shell when users were working in `Audio` on a different track than the active sequence

## Local Context Rules

Each workflow owns its own local context presentation.

Examples:
- `Audio` owns current track selection and library state
- `Sequence` owns active sequence identity and live xLights sequence state
- `Design` owns design conversation and proposal context
- `Review` owns current pending apply context
- `History` owns selected revision context

Working rule:
- if a context is only meaningful inside one workflow, it must not be promoted to the global frame

## Cross-Workflow Relationship Rules

### Project As The Root Context

`Project` defines the working project context for the other workflow pages.
It does not define every detail shown in those pages.

### Audio As A Standalone Workflow

`Audio` can operate without any active sequence.
It is library- and track-centric, not sequence-centric.

### Sequence As The Technical Execution Context

`Sequence` is where live sequence context belongs.
If a sequence is open, that fact should be visible here and not globally across unrelated pages.

### Design And Sequence As Parallel Views

`Design` and `Sequence` remain intentional parallel views:
- `Design` = creative meaning
- `Sequence` = technical translation

They should feel related, but they should not collapse into one overloaded screen.

### Review And History Separation

`Review` answers:
- what is pending now

`History` answers:
- what was previously implemented

That split should remain strict.

## Native Shell Frame

The native shell should eventually resolve to this structure:
1. app sidebar navigation
2. top app chrome with minimal global context
3. one primary content area for the selected workflow
4. optional workflow-local secondary pane when justified

The shell should not permanently reserve space for:
- a global chat panel
- persistent diagnostics panes
- legacy dashboard clutter

Whether collaboration/chat remains part of the native product will be defined later at the workflow-contract level, not assumed by the shell frame.

## Out Of Scope For This Document

This document does not yet define:
- exact screen layouts
- exact panel placement within each workflow
- toolbar/button placement
- visual styling
- read-model contracts
- component inventory

Those belong to later design workstreams.

## Decisions Locked Here

1. the native app keeps workflow-based sidebar navigation
2. `Settings` remains outside the main workflow list
3. global context stays minimal
4. active sequence identity is local to `Sequence`, not global
5. `Audio` remains standalone and sequence-independent
6. `Design` and `Sequence` remain parallel, not merged
7. `Review` and `History` remain distinct

## Immediate Next Design Step

After this document:
1. define workflow contracts for each top-level section
2. then define screen layout specifications starting with `Audio`
