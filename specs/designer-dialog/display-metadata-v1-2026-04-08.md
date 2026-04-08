# Display Metadata v1 (2026-04-08)

Status: Active
Date: 2026-04-08
Owner: xLightsDesigner Team

## Purpose

Define the first broad, durable metadata set captured through the `Getting To Know Your Display` conversation.

This metadata exists to support:
- design decisions
- sequencing decisions
- layout understanding
- project-to-project migration

It does not replace:
- live xLights layout state
- music/timing context
- current sequence state
- human review

## Core Rule

Display metadata is advisory context.
It is not the sole decision source.

The designer and sequencer may use it to guide choices, but they must still consider:
- live layout structure
- derived xLights layout signals such as position and scale
- current musical context
- sequence state
- user direction
- current review/apply constraints

## Design Principle

Metadata should be broad by default.
Specific metadata should be exception-driven.

Broad metadata is preferred because it is:
- easier for users to confirm
- more durable over time
- more reusable across songs/projects
- less likely to become stale

The system should avoid creating a hyper-detailed taxonomy unless a clear use case justifies it.

## Derived xLights Signals

Broad metadata may also be informed by raw xLights model metadata and derived structural signals.

Important examples:
- x/y/z position
- relative left/center/right placement
- foreground/background depth when available
- node count
- relative visual weight inferred from node count or overall size

These signals are useful because they can help the agent ask better questions such as:
- whether a prop is likely central or peripheral
- whether a prop is visually substantial or lightweight
- whether several props are likely part of one spatial zone

Rules:
- these are inputs to questioning and proposal quality
- they do not override user-confirmed meaning
- they should support broad metadata, not replace it

## v1 Metadata Domains

These are the preferred broad metadata domains for the first pass.

### 1. Visual Role
What role does the prop usually play visually?

Examples:
- `focal`
- `supporting`
- `background`
- `accent`
- `transition`

### 2. Grouping Behavior
How should this prop usually relate to nearby/related props?

Examples:
- `treat_as_one_group`
- `independent`
- `paired`
- `mirrored`
- `sectional`

### 3. Motion Role
What kind of movement is this prop generally good for?

Examples:
- `rhythm_driver`
- `chase_surface`
- `pulse_surface`
- `slow_movement`
- `mostly_static`
- `flexible`

### 4. Priority
How important is this prop when visual density must be managed?

Examples:
- `primary`
- `secondary`
- `tertiary`

### 5. Display Zone
Where does this prop live spatially or compositionally?

Examples:
- `center`
- `left`
- `right`
- `roofline`
- `yard`
- `foreground`
- `background`

### 6. Special Handling
Does this prop need broad exception guidance?

Examples:
- `avoid_overuse`
- `avoid_fast_motion`
- `best_for_peaks_only`
- `best_for_quiet_sections`
- `use_sparingly`

## Optional v1.1 Domains

These are useful, but should not be pushed into the first pass unless clearly helpful.

### Story Role
Examples:
- `character`
- `scene_anchor`
- `themed_prop`
- `architectural`

### Energy Range
Examples:
- `low`
- `medium`
- `high`
- `flexible`

### Color Behavior
Examples:
- `palette_flexible`
- `usually_warm`
- `usually_cool`
- `holiday_colors`

### Seasonal Or Reusable Identity
Examples:
- `christmas_specific`
- `winter_generic`
- `highly_reusable`

## Conversation Rule

The display-discovery conversation should primarily try to learn:
1. focal props
2. supporting/background props
3. what should move together
4. which props deserve special handling
5. any major themed or character props

Initial scope should focus on:
- groups
- models

It should not begin with submodel-level discussion.
Submodels should be introduced later only when detailed sequencing refinement actually needs them.

It should not begin by asking for:
- exact effect choices
- low-level sequencing tactics
- exhaustive per-model exceptions

## Inference Rule

The agent may infer candidate questions from:
- model names
- model types
- group names
- submodel structure
- x/y/z coordinates
- node count / inferred visual weight

It may not infer semantic truth from those alone.

Example:
- good: “I noticed `Snowman`. Is that a focal character prop, a supporting prop, or mostly decorative?”
- bad: “I marked `Snowman` as focal.”

## Tagging Strategy Rule

The system should prefer:
- a small number of broad, reusable tags
- with optional descriptions
- plus selective exception tags when needed

It should avoid:
- over-tagging
- per-model custom tags without a durable reason
- creating tags that simply restate the model name

## Native App Implication

The native app should treat display metadata as:
- project-owned
- editable
- reviewable
- migratable

The `Getting To Know Your Display` conversation should produce:
- proposed tag definitions
- optional descriptions
- candidate assignments

These should remain review-first before application.

## Acceptance Criteria

This metadata spec is working as intended when:
1. the first-pass conversation stays broad
2. users are not forced to invent tags from scratch
3. tags help design/sequencing without becoming the only decision source
4. specific tags appear only when a real exception/use case justifies them
5. metadata remains understandable and maintainable over time
