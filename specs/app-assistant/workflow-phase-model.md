# Workflow Phase Model

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: locked workflow phase model and handoff implementation notes

## Purpose

Define the top-level workflow model for xLightsDesigner so the app behaves like one guided creative system instead of a loose collection of agents.

The phase model establishes:

- canonical phases of work
- which specialist owns each phase
- how handoffs occur
- what artifacts each phase produces
- how current phase state appears in the UI

## Core UX Principle

The user should experience one guided workflow with one active specialist at a time.

`app_assistant` manages startup, orientation, handoffs, recovery, and closure. Domain specialists own substantive work inside their phase.

The phase model is required. Conversational ceremony is not. Experienced users should be able to move quickly when their intent is clear.

## Canonical Phases

1. `setup`
   - owner: `app_assistant`
   - purpose: configure app, provider settings, project/show context, and xLights connection

2. `project_mission`
   - owner: `designer_dialog`
   - purpose: establish show-level creative direction and mission
   - output: `project_mission_v1`

3. `audio_analysis`
   - owner: `audio_analyst`
   - purpose: analyze songs and produce reusable timing/music artifacts
   - outputs: analysis artifact and `analysis_handoff_v1`

4. `display_discovery`
   - owner: `designer_dialog`
   - purpose: understand display semantics, focal structures, prop families, and spatial roles
   - outputs: display metadata and display-understanding context

5. `design`
   - owner: `designer_dialog`
   - purpose: shape sequence-specific creative direction
   - output: structured designer-to-sequencer handoff

6. `sequencing`
   - owner: `sequence_agent`
   - purpose: turn design handoff or direct technical requests into xLights changes
   - output: sequence execution summary and review artifacts

7. `review`
   - default owner: `sequence_agent`
   - purpose: inspect rendered output, validation, sequence changes, and revision needs

## Ownership Rules

- Only one specialist owns the substantive conversation in a phase.
- `app_assistant` may interrupt for startup, explicit phase transition, closure summary, recovery, or help.
- Specialists may recommend another phase but should not silently shift the user.
- Handoffs should feel like clear work boundaries, not multi-agent overlap.

## Setup Paths

Brand new users remain in `setup` until the app has usable provider/model configuration and project/show context.

Existing users starting a new project should get brief orientation and a high-value kickoff question, usually leading toward `project_mission`.

## Phase State

The application should maintain explicit phase state instead of relying only on prompt wording.

Required state:

- `phaseId`
- `phaseOwnerRole`
- `phaseStatus`
- `entryReason`
- `startedAt`
- `updatedAt`
- `inputArtifacts`
- `outputArtifacts`
- `nextRecommendedPhases`

Recommended `phaseStatus` values:

- `not_started`
- `in_progress`
- `ready_to_close`
- `handoff_pending`
- `completed`
- `blocked`

## Handoff Rules

Handoffs should be explicit and brief:

1. current specialist summarizes what was accomplished
2. `app_assistant` names the likely next phase
3. user confirms or redirects
4. new phase begins with its owning specialist

No mutating workflow should depend on a silent phase jump.

## Direct Technical Sequencing Exception

Specific technical sequencing requests may route directly to `sequence_agent`.

Examples:

- apply a specific effect to a specific prop during a specific section
- revise an existing sequence with narrow scope

Rules:

- direct requests still normalize into the canonical sequencing handoff
- direct requests still preserve review/apply gates
- this exception does not collapse the broader phase model

## Page And Phase Relationship

Pages and phases are related but not identical.

- pages are UI workspaces
- phases are the active type of conversational work

Opening a page does not automatically change the active phase. Meaningful domain work, explicit user intent, or a specialist handoff may change the phase.

Recommended page support:

- `Project`: `setup`, `project_mission`
- `Display`: `display_discovery`
- `Audio`: `audio_analysis`
- `Design`: `design`
- `Sequence`: `sequencing`
- `Review`: `review`

The app may highlight the page that best supports the active phase, but forced automatic navigation should be avoided unless a specific workflow requires it.

## UI Contract

The current phase should be visible in the app shell. The user should not need to infer the active phase from agent behavior alone.

Recommended phase strip order:

- Setup
- Project Mission
- Audio Analysis
- Display Discovery
- Design
- Sequencing
- Review

The phase display should clarify progress without forcing a rigid wizard.

## Memory And Artifacts

The phase model must respect `assistant-memory-scopes.md`.

- conversation continuity remains bounded
- workflow preferences remain user-scoped
- project mission, display discovery, and project-specific design understanding remain project-scoped
- phases should consume and produce durable artifacts instead of relying on raw chat alone

## Training And Prompting

The phase model does not replace specialist intelligence.

The app enforces phase structure. Specialists decide how to conduct natural conversation inside their phase. Prompts should be phase-aware, not phase-responsible.
