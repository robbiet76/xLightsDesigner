# macOS Native Wireframe And Prototype Method (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the required design artifacts for the native macOS design phase.

This document exists to prevent two failure modes:
1. low-detail wireframes that hide workflow gaps until implementation
2. design-by-implementation in SwiftUI

The goal is to reduce iteration and churn by defining enough of the product up front that implementation becomes a constrained execution phase rather than a discovery phase.

Primary parent plans:
- `macos-native-migration-phase-plan-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`

## Design Artifact Stack

Every workflow that will be implemented in the native macOS app must pass through this design artifact stack before SwiftUI implementation begins.

### Layer 1: Screen Contract Spec

Purpose:
- define behavior, ownership, and layout intent in words before visual composition begins

Required contents per screen:
- screen purpose
- primary user goals
- entry conditions
- exit conditions
- top-level layout regions
- primary actions
- selection model
- editable vs read-only areas
- empty, loading, success, and error states
- dependencies on shared backend state
- explicit out-of-scope behaviors

Working rule:
- no screen should move to visual wireframing until the contract is coherent enough to build from

### Layer 2: Medium/High-Fidelity Wireframes

Purpose:
- expose real information-density, workflow, and hierarchy issues before implementation

Required fidelity:
- realistic layout density
- realistic labels and action names
- realistic tables, forms, panes, sheets, and toolbars
- realistic status badges and summaries
- approximate spacing and hierarchy

Not required yet:
- final visual polish
- final typography tuning
- production assets
- code

Required states per important screen:
- default state
- empty state
- selected state
- editing state
- loading/progress state
- error/problem state

Working rule:
- do not stop at low-fidelity boxes
- the wireframe should be detailed enough to reveal missing functionality and over-dense layouts

### Layer 3: Click-Through Prototype

Purpose:
- validate navigation, selection, action placement, and flow transitions before code is written

Required initially for high-risk workflows:
1. Audio
2. Sequence
3. Review

Optional for lower-risk workflows until needed:
- Project
- Layout
- History
- Settings

The prototype must be sufficient to test:
- navigation path
- selection behavior
- panel transitions
- action discoverability
- sheet/dialog entry points
- major state changes

Working rule:
- interactive prototypes are for workflow validation, not visual polish theater

## Tooling Guidance

Preferred design deliverables:
1. structured written screen specs
2. medium/high-fidelity wireframes in a design tool
3. click-through prototype for high-risk flows

Acceptable tooling:
- Figma or equivalent for wireframes and click-through flow
- structured markdown specs in the repo for contracts and review notes

Disallowed default approach:
- relying on SwiftUI previews as the primary design process
- relying on low-detail sketches alone
- relying on iterative Electron implementation to discover native product design

## Workflow Priorities

The native design phase should define the big items first.

Recommended order:
1. app information architecture
2. top-level navigation
3. Project workflow
4. Layout workflow
5. Audio workflow
6. Sequence / Design / Review relationship
7. visual system and component system

Reason:
- these items shape the rest of the product and create the highest leverage reduction in implementation churn

## Screen Review Package

Before a screen is approved for implementation, the review package must include:
1. written screen contract
2. wireframes for major states
3. annotated actions and selection behavior
4. explicit notes on backend/state dependencies
5. open questions list
6. decisions made during review

Approval standard:
- the screen should be buildable without inventing core workflow behavior during implementation

## Design Review Gates

### Gate 1: Contract Review

Checks:
- is the workflow purpose clear
- are scope boundaries clear
- are state boundaries clear
- is anything important still ambiguous

### Gate 2: Wireframe Review

Checks:
- is the information hierarchy clear
- are the primary actions obvious
- is the screen too dense
- is anything missing from the workflow
- are details and summaries in the right places

### Gate 3: Prototype Review

Checks:
- does the flow make sense across screen states
- are important actions discoverable
- does navigation behave coherently
- do dialogs/sheets appear at the right times
- does the workflow feel stable enough to build

### Gate 4: Build Readiness Review

Checks:
- can implementation proceed with minimal iteration
- are the state/read-model contracts adequate
- are component needs known
- are open questions small enough to resolve during build without product churn

## Rules For Minimal-Churn Implementation

1. Design first, then build.
2. Do not use SwiftUI implementation to discover missing workflow behavior.
3. Do not use low-fidelity sketches as the final design artifact.
4. Do not start with visual polish before layout and action clarity are resolved.
5. Do not build major workflows without an explicit review package.
6. Treat wireframe/prototype review as a blocker-clearing step, not a formality.

## Immediate Application

The first workflow package that should follow this method is:
- Audio

The next workflow packages after Audio should be:
1. Project
2. Layout
3. Sequence / Design / Review

The output of this method should become the implementation contract for the future SwiftUI shell.
