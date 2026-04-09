# xLights Derived Metadata Layer

Date: 2026-04-09

## Decision
xLights-derived structural metadata is a separate layer from project display metadata.

## Why
Project display metadata captures semantic understanding learned through agent and user conversation.
Examples:
- focal
- support
- repeating pathway accent
- feature prop

xLights-derived metadata captures structural facts and structural inferences grounded in the live xLights layout.
Examples:
- model type
- node count
- x/y/z position
- size
- repeated-family candidates
- group membership
- flattened group membership

These two layers must not be collapsed into one store.

## Scope
xLights-derived metadata should be available globally anywhere the app or agent team needs layout structure.
That includes:
- Display discovery
- Design reasoning
- Sequencing reasoning
- Validation
- Future render assessment

## Ownership
The app owns derivation, refresh, and delivery of xLights-derived metadata.
The agent layer consumes it as grounded structural context.

## Source of truth
The source of truth is the live xLights layout and group structure exposed through the owned xLights API.

## Storage model
The derived layer should not be treated as project-semantic memory.
It can be:
- recomputed from live xLights layout
- cached by show/layout identity if needed later

It should not be mixed into project display-discovery memory.

## Current shape
Initial derived metadata shape includes:
- all target names
- type breakdown
- model samples
  - spatial zones
  - visual weight
  - uniqueness / repetition hints
  - symmetry peer hints
- repeated-family candidates
  - confidence
  - aggregate node count
- group memberships
  - direct members
  - active members
  - flattened members
  - flattened all members
  - structure kind
  - related families
  - superset group relationships
  - overlap group relationships

## Consumption contract
The data should be exposed as shared `xlightsLayout` context, not as a display-only concern.
Display can use it.
Sequencing can use it.
Other workflows can use it.

## Boundary
Do not store semantic claims like focal/support/background in this derived layer.
Those belong in project display metadata.
