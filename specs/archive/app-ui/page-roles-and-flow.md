# App UI Page Roles And Workflow

Status: Active
Date: 2026-03-13
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-13

Purpose: define the responsibility of each left-nav page so the product tells a clear story from setup through apply and history review.

## Workflow Summary
The left navigation represents one coherent workflow:

1. `Project`
2. `Layout`
3. `Audio`
4. `Design`
5. `Sequence`
6. `Review`
7. `History`

This is not just a tab list. It is the intended user journey.

## Page Roles

### 1. Project
Purpose:
- create or open a project
- confirm project-level identity and working paths
- manage the current project file lifecycle

Primary content:
- create/open/save/save-as actions
- show folder selection
- media path selection
- current project summary

Not the place for:
- xLights connection settings
- API keys
- diagnostics

Notes:
- application project root belongs in `Settings`, not `Project`
- this page is about project lifecycle, not global application configuration

### 2. Audio
Purpose:
- own the audio-analysis workflow
- show the current audio analysis artifact and analysis status
- allow analysis run/refresh/reuse

Primary content:
- media attachment
- analysis artifact summary
- analysis pipeline state
- inspectable audio analysis details

Owner:
- `audio_analyst`

### 3. Sequence
Purpose:
- show how current design intent is being translated into concrete sequencing intent
- expose sequence context and live translation state

Primary content:
- active sequence context
- revision and sequence settings
- target scope and section scope
- intent handoff summary
- live sequence translation dashboard
- last applied sequencing snapshot

Owner:
- `sequence_agent` translation surface

Key distinction:
- this is not only setup/open/select anymore
- it is the live technical translation view parallel to `Design`

### 4. Design
Purpose:
- show what the conversation is capturing creatively
- make the designer’s current state visible while the chat evolves

Primary content:
- live designer dashboard
- creative brief
- proposal bundle
- director profile
- reference media
- palette direction
- last applied design snapshot

Owner:
- `designer_dialog`

Key distinction:
- this is the creative interpretation view
- it should not be treated as the final execution gate

### 5. Review
Purpose:
- unify design intent, sequence translation, and execution impact into one apply gate

Primary content:
- proposal review
- execution plan review
- current apply snapshot
- last applied snapshot
- approval gate
- backup/restore visibility
- apply actions

Owner:
- `sequence_agent` execution gate with app-shell review support

Key distinction:
- `Review` is where approved design becomes implemented sequence changes
- apply is not sequence-only; it is design-to-sequence implementation

### 6. Layout
Purpose:
- manage semantic targeting context used by designer and sequencer

Primary content:
- tags
- assignments
- orphans/remapping
- metadata filtering and selection

Owner:
- shared support surface

Key distinction:
- metadata is a supporting context layer, not a primary creative phase

### 7. History
Purpose:
- inspect applied revisions as immutable snapshots
- show what design, sequence, scene, music, and apply state existed at the time of implementation

Primary content:
- applied snapshot list
- snapshot detail
- artifact references
- dereferenced design/sequence/audio/scene/apply data

Owner:
- app shell / audit and recovery

Key distinction:
- history is not a generic log
- it is a revision view over referenced immutable artifacts

## Shared Surfaces

### Team Chat
Purpose:
- one shared collaboration surface across all phases

Behavior:
- stays visible across the workflow
- specialist routing is visible
- conversation should remain coherent regardless of current page

### Settings
Purpose:
- application-wide configuration and operational controls

Content:
- xLights connection
- cloud model/API settings
- audio service settings
- team identities
- reset/testing controls

Not part of the left-nav workflow because:
- it is an app-level control surface, not a project phase

## Parallel Dashboard Model
Two pages are intentionally parallel:

### Design
Shows:
- what the conversation means creatively

### Sequence
Shows:
- how that meaning is being translated into specific sequencing intent

The user should be able to switch between them during a live conversation and understand:
- `Design` = creative capture
- `Sequence` = technical translation

## Review And History Relationship

### Review
- current pending implementation

### History
- previously applied implementations

The user should understand:
- `Review` answers: what will happen if I apply now?
- `History` answers: what has already been implemented before?

