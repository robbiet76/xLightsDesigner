# Workflow Phase Model And Handoff Contract

Status: Locked
Date: 2026-04-10
Owner: xLightsDesigner

## Purpose
Define the top-level user workflow model for xLightsDesigner so the app behaves like one guided creative system instead of a loose collection of agents.

This spec establishes:
- the canonical phases of work
- which agent owns each phase
- how handoffs occur
- what the app assistant is responsible for
- what artifacts each phase should produce
- how the current phase should be exposed in the UI

The goal is to reduce agent drift, keep conversations coherent, and make the user always understand what kind of work is happening now.

## Core UX Principle
The user should experience one guided workflow with one active specialist at a time.

The system should not feel like multiple agents are competing for the conversation.

The intended model is:
- `app_assistant` manages startup, orientation, handoffs, recovery, and closure
- one specialist owns the current phase of work
- the current phase is explicit in both runtime state and UI

## Canonical Phases
The system has seven top-level workflow phases.

1. `setup`
- configure the app
- connect required services
- establish project/show context
- answer app-level questions
- owner: `app_assistant`

2. `project_mission`
- establish what the overall show is trying to be
- capture emotional tone, purpose, inspiration, audience, and cohesion
- produce the guiding mission statement for the project
- owner: `designer_dialog`

3. `audio_analysis`
- analyze one or more songs
- produce durable analysis artifacts
- summarize what was analyzed and what is ready for downstream use
- owner: `audio_analyst`

4. `display_discovery`
- understand what the display means
- determine focal structures, support layers, families, scene props, and spatial roles
- produce usable display metadata and display-understanding context
- owner: `designer_dialog`

5. `design`
- interpret user goals for a sequence
- shape a creative direction for the current song or scope of work
- prepare the structured design handoff for sequencing
- owner: `designer_dialog`

6. `sequencing`
- translate the design handoff into xLights changes
- apply timing, effect, and sequencing operations in reviewable chunks
- summarize what was changed and what to validate next
- owner: `sequence_agent`

7. `review`
- validate what was created
- inspect rendered output, sequence changes, or outstanding issues
- decide whether to continue sequencing, return to design, or close the task
- default owner: `sequence_agent`

## Phase Ownership Rules
Only one specialist owns the substantive conversation in a phase.

Rules:
- `app_assistant` may interrupt only for:
  - startup
  - explicit phase transition
  - closure summary
  - recovery/help
- a specialist should not silently shift the user into a different phase
- a specialist may recommend the next phase, but `app_assistant` owns the formal handoff
- multi-agent back-and-forth in the same conversational stretch should be avoided

## Setup Paths

### Brand New User
Definition:
- app has no usable provider/model/key configuration or no usable project/show context

Required behavior:
- `app_assistant` owns the experience
- the user should receive a welcome and concise overview
- the assistant should guide the user through:
  - provider selection
  - API key entry
  - model selection
  - xLights connection / show folder alignment
  - project opening or creation
- before setup is complete, the app should not behave as though the full team is already available for real work

Exit from `setup` occurs when:
- the app is operational enough to begin project work
- the user can meaningfully enter one of the creative phases

### Existing User / New Project
Definition:
- setup is already usable, but the user is starting new project work

Required behavior:
- `app_assistant` should orient the user
- it should ask one high-value kickoff question and guide the user toward the correct starting phase
- default recommendation should usually be `project_mission`

## Phase Intent And Boundaries

### `project_mission`
This phase is about the show-level creative north star.

It is not about:
- prop inventory
- model naming
- technical sequencing
- effect tactics

The mission should help answer:
- what should this show feel like?
- what deeper purpose or meaning should it have?
- what inspirations matter?
- what should make it memorable?
- what should remain cohesive across the project?

The output should be one well-written mission statement, not a technical form.

### `display_discovery`
This phase is about understanding the display as a semantic creative resource.

It is not about:
- sequence effect authoring
- design execution tactics
- project mission writing

It should determine what the display means well enough for both design and sequencing.

### `design`
This phase is about sequence intent and creative direction.

It is not about:
- project mission shaping
- raw display discovery
- direct xLights implementation yet

Its goal is to create a strong enough design brief or handoff that sequencing can proceed in larger, coherent batches.

### `sequencing`
This phase is about implementation in xLights.

It should consume a structured design handoff.
It should not keep pulling the user back into broad design conversation unless the current design is insufficient.

If design becomes insufficient, the system should formally return to `design` rather than silently mixing phases.

## Phase State Model
The application should maintain explicit phase state in runtime, rather than relying only on prompt wording and routing heuristics.

Required state shape:
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

## Entry And Exit Criteria
Each phase should define explicit entry and exit conditions.

### `project_mission`
Entry:
- new project
- user asks to shape show direction

Exit:
- a mission statement exists
- enough creative direction has been captured
- the user accepts moving on or asks to move on

Output artifact:
- `project_mission_v1`

### `audio_analysis`
Entry:
- user asks to analyze tracks
- project requires analysis before design/sequencing

Exit:
- requested tracks analyzed
- canonical analysis artifacts stored
- summary generated

Output artifacts:
- canonical per-track analysis artifact
- `analysis_handoff_v1`

### `display_discovery`
Entry:
- user asks to understand the display
- design requires deeper layout understanding
- metadata is insufficient

Exit:
- display understanding is sufficient for design and sequencing
- major unresolved semantic gaps are acceptable for current work

Output artifacts:
- display metadata
- `display_understanding_v1`

### `design`
Entry:
- user starts a song or asks for sequence direction
- required upstream context is sufficiently available

Exit:
- structured design handoff is ready
- user is ready for implementation

Output artifact:
- structured designer-to-sequencer handoff

### `sequencing`
Entry:
- design handoff exists or direct technical sequencing request is specific enough

Exit:
- requested implementation chunk is complete
- summary returned
- next validation or revision step is clear

Output artifact:
- `sequence_execution_summary_v1`

## Handoff Contract
Handoffs should be explicit and brief.

The intended handoff pattern is:
1. current specialist summarizes what was accomplished
2. `app_assistant` steps in briefly
3. `app_assistant` names the likely next phase
4. user confirms or redirects
5. new phase begins with its owning specialist

Rules:
- no silent phase jumps
- no specialist should unilaterally open the next phase without a clear transition
- handoffs should feel like chunk boundaries, not multi-agent overlap

## Direct Technical Sequencing Exception
Direct technical sequencing requests remain supported.

Examples:
- apply a specific effect to a specific prop during a specific section
- revise an existing sequence with narrow scope

Rules:
- these may route directly to `sequence_agent`
- they must still be normalized into the canonical sequencing contract
- they do not justify collapsing the broader phase model

## UI Contract: Current Phase Visibility
The current phase should be visible in the application shell.

Required UI behavior:
- the header should show the current phase of work
- the user should not need to infer the phase from agent behavior alone

Recommended UI behavior:
- show a compact phase diagram or phase strip in the header
- highlight the current phase
- show completed or available phases more subtly

Recommended phase strip order:
- Setup
- Project Mission
- Audio Analysis
- Display Discovery
- Design
- Sequencing
- Review

Behavior rules:
- the current phase is highlighted
- previous completed phases may show as completed
- future phases may show as inactive or upcoming
- the display should clarify progress, not force linearity where the workflow is intentionally flexible

The purpose of this UI is:
- reduce confusion
- reinforce what kind of conversation is happening now
- make handoffs legible

## Memory And Artifact Scope
This phase model must respect the locked memory boundary model.

Rules:
- conversation continuity remains bounded
- workflow/process preferences remain user-scoped
- project mission, display discovery, and project-specific design understanding remain project-scoped
- phases should consume and produce durable artifacts rather than relying on raw chat alone

Relevant reference:
- [assistant-memory-scopes-2026-04-08.md](/Users/robterry/Projects/xLightsDesigner/specs/app-assistant/assistant-memory-scopes-2026-04-08.md)

## Training And Prompting Implication
This phase model does not replace specialist intelligence.

Instead:
- the application enforces the phase structure
- the specialist still decides how to conduct the conversation within the phase
- prompts should become phase-aware, not phase-responsible

Examples:
- `designer_dialog` should still ask natural, meaningful follow-up questions during `project_mission`
- but the app should prevent that conversation from silently drifting into `display_discovery`

## Immediate Implementation Direction
The next implementation slices should be:

1. add explicit phase state to app assistant runtime/session context
2. add owner and transition rules in orchestrator code
3. expose current phase in the app header
4. update specialist prompts so they align to explicit phase state
5. add tests for:
- startup path
- new project path
- clean handoffs between mission, display, design, and sequencing
- direct technical sequencing exception

## Non-Goal
Do not turn this into a rigid wizard.

The workflow should remain conversational and flexible.
The phase model exists to provide clarity and guardrails, not to force canned scripts.
