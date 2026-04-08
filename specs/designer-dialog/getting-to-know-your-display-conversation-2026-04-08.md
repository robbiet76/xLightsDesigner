# Getting To Know Your Display Conversation (2026-04-08)

Status: Active
Date: 2026-04-08
Owner: xLightsDesigner Team

## Purpose

Define the first-run display-discovery conversation that helps the designer agent create initial project metadata without forcing the user to invent tags from scratch.

This is a guided conversation, not an automatic tagging pass.

## Product Rule

The system may infer candidates.
It may not infer truth.

That means:
- model names
- model types
- xLights groups
- submodel structure
- x/y/z coordinates
- node count / inferred visual weight

may be used to identify likely interesting props or questions,
but they must not be treated as confirmed semantic meaning until the user confirms them.

## Why This Exists

Manual tag authoring is too expensive and too ambiguous as a first step.

Users often do not know:
- which tags will be useful later
- how to structure the first metadata set
- which display semantics matter most to design and sequencing

The designer agent should reduce that burden by leading a short discovery conversation.

## Workflow Name

`Getting To Know Your Display`

## Trigger Conditions

The conversation should be preferred when all of the following are true:

1. live layout is available
2. project-level layout metadata is thin or empty
3. the user is asking for broad design help, layout guidance, tag help, or initial display understanding

Examples:
- “help me tag the layout”
- “what metadata should we add?”
- “how should we start with this display?”
- broad design kickoff when no real semantic tags exist yet

## Inputs

The discovery conversation should use:
- active project context
- live xLights layout inventory
- model names
- model types
- xLights grouping signals when available
- xLights coordinate metadata when available
- node count / inferred visual-weight signals when available
- existing project-level tags and descriptions
- currently selected layout target if any

It may also use:
- current track / sequence context
- current show folder context

## Discovery Behavior

The agent should:

1. acknowledge the metadata state honestly
- if there are no meaningful tags yet, say so

2. identify likely candidate props or structures from layout names/types
and from broad structural signals such as:
- central vs edge position
- larger vs lighter-weight props
- likely architectural vs feature props
- examples:
  - `Snowman`
  - `MegaTree`
  - `Star`
  - `Arches`
  - `Roofline`
  - `Windows`

3. use those only as prompts for questions
- not as confirmed semantics

4. ask a short set of high-value questions
- usually 2 to 4
- not a long interview

5. aim to discover:
- focal props
- supporting/background props
- groups that should behave together
- props with special narrative or character significance
- props that should be treated cautiously or separately

Initial scope should be limited to:
- model groups
- models

Submodels are explicitly out of scope for the initial pass.
They belong to later refinement only when detailed sequencing work requires them.

## Good Questions

- “I noticed a model named `Snowman`. Is that meant to be a focal character prop, a secondary accent, or mostly decorative?”
- “There appears to be a `MegaTree`. Should that usually act as a primary focal structure?”
- “I see several arches. Should they generally behave as one rhythm group or as separate accents?”
- “Should your roofline and windows usually act as one architectural layer or be treated independently?”

## Bad Behavior

The agent must not:
- declare a prop focal based on name alone
- silently create a large taxonomy without user confirmation
- assume tag meaning from placeholder names
- claim current sequence content proves display intent

## Output of This Conversation

The first pass should produce:

1. proposed tag definitions
- name
- optional description

2. proposed tag assignments
- reviewable
- not silently committed

3. clear rationale for the initial metadata structure

## Native App Implications

The native assistant should support a display-discovery mode when metadata is thin.

The first implementation may stop at:
- detecting thin metadata
- surfacing candidate props
- asking better discovery questions

The first implementation should not introduce submodel-level questioning.

It does not need to apply tags automatically yet.

## Architecture Placeholder

This workflow will later sit on top of:

1. layout analysis context
2. guided discovery question generation
3. reviewable metadata proposal generation
4. apply/revise loop in the native `Layout` workflow

## Acceptance Criteria

This feature is on the right path when:

1. the designer agent stops pretending broad tags already exist
2. candidate props are derived from real layout names/types
3. the agent asks short, concrete clarification questions
4. the agent treats names as hypotheses, not truth
5. the user is guided toward an initial metadata set instead of writing tags from scratch
