# macOS Native Design Phase Workstreams (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Break `Phase 1: Product Design` into concrete workstreams, deliverables, and review gates.

This document exists to make the design phase executable.
It is the checklist that must be completed before any SwiftUI screen implementation begins.

Required design artifact method:
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`

Current workstream 1 source:
- `macos-native-information-architecture-2026-04-06.md`

Current workstream 2 source:
- `macos-native-workflow-contracts-2026-04-06.md`

Current workstream 3 source (Audio first):
- `macos-native-audio-screen-layout-2026-04-06.md`

Primary parent plan:
- `macos-native-migration-phase-plan-2026-04-06.md`

## Design-Phase Rule

Do not begin native UI implementation until:
1. the required workstreams are complete
2. the deliverables are written down
3. the screen contracts are coherent enough to build with minimal iteration
4. the required wireframes and prototypes exist for the workflows in scope

## Workstreams

### Workstream 1: Product Information Architecture

Goal:
- define the native app as one coherent product, not a collection of migrated Electron pages

Questions to answer:
- what are the top-level sections of the native app
- what is global app context vs local page context
- what appears in the app frame at all times
- what appears only within a specific workflow
- what is the intended user journey through the app

Required deliverables:
- native app map
- top-level navigation definition
- global-context rules
- page ownership map

Primary source:
- `macos-native-information-architecture-2026-04-06.md`

Checklist:
- define the macOS app section list
- define the default landing experience
- define workflow order across sections
- define which contexts are global vs local
- define whether sidebars, split views, or tab structures are primary

Exit criteria:
- there is one clear navigation story for the native app

### Workstream 2: Workflow Contracts

Goal:
- define what each workflow is for and what it is not for

Required workflows:
1. Project
2. Audio
3. Sequence
4. Design
5. Review
6. Metadata
7. History
8. Settings

Required deliverables:
- one workflow contract per section
- entry conditions
- exit conditions
- primary user goals
- out-of-scope behaviors

Primary source:
- `macos-native-workflow-contracts-2026-04-06.md`

Checklist:
- define purpose for each workflow
- define primary actions
- define required read models
- define dependencies on shared backend state
- define what should never appear on that screen

Exit criteria:
- every workflow has a stable role and does not overlap ambiguously with another

### Workstream 3: Screen Layout Specifications

Goal:
- define the actual screen structure before implementation

Required deliverables per screen:
- screen purpose
- panel/region layout
- dominant action area
- dominant result area
- subordinate detail areas
- empty state
- loading state
- error state

Checklist:
- define `Audio` screen layout
- define `Project` screen layout
- define `Sequence` screen layout
- define `Design` screen layout
- define `Review` screen layout
- define `Metadata` screen layout
- define `History` screen layout
- define `Settings` screen layout

Current first screen source:
- `macos-native-audio-screen-layout-2026-04-06.md`
- `macos-native-project-screen-layout-2026-04-06.md`

Current coupled-screen relationship source:
- `macos-native-sequence-design-review-relationship-2026-04-06.md`

Exit criteria:
- every screen has a stable information hierarchy

### Workstream 4: Interaction Model

Goal:
- define how the user interacts with data across the app

Required deliverables:
- selection model rules
- action placement rules
- inline edit rules
- sheet/dialog rules
- confirmation rules
- keyboard/navigation expectations where important

Checklist:
- define grid row selection behavior
- define when actions live in toolbar vs content vs detail pane
- define when inline editing is allowed
- define when modal sheets are allowed
- define when destructive confirmations are required
- define when background operations need visible progress

Exit criteria:
- the implementation team does not need to invent interaction behavior during build

### Workstream 5: Read Models And Page-State Contracts

Goal:
- define what each native screen consumes from shared state/services

Required deliverables:
- per-screen read model
- per-screen action model
- state ownership map
- transient vs persisted state rules

Checklist:
- define app state
- define project state
- define shared track library state
- define sequence state
- define history/revision state
- define transient UI state
- define selection state rules
- define persistence scope for each state class

Exit criteria:
- the native app can be implemented against explicit screen contracts rather than ad hoc mutable state

### Workstream 6: Shared Backend And Service Boundaries

Goal:
- define what the native shell consumes versus what the shared backend/platform owns

Required deliverables:
- service boundary map
- API/client boundary map
- persistence boundary map
- xLights integration boundary map

Checklist:
- define what remains in shared backend/domain logic
- define what native UI owns directly
- define file/folder operations boundary
- define audio analysis orchestration boundary
- define sequence metadata binding boundary
- define xLights owned API client boundary

Exit criteria:
- SwiftUI implementation does not require backend-contract invention

### Workstream 7: Visual System

Goal:
- define a native visual language before implementation

Required deliverables:
- typography direction
- spacing system
- panel/card/list/table rules
- status badge system
- color usage rules
- form layout rules
- split-view/grid conventions

Checklist:
- define native table/grid style
- define detail-pane style
- define form field layout rules
- define alert/banner/status treatments
- define primary/secondary action styling rules
- define panel density rules

Exit criteria:
- the native app has one visual system instead of per-screen improvisation

### Workstream 8: Design System Components

Goal:
- identify the reusable native components that should exist before broad screen buildout

Required deliverables:
- component inventory
- component responsibilities
- composition rules

Likely first components:
- app sidebar / navigation shell
- toolbar/header
- result summary panel
- metadata grid
- status pill/badge
- detail pane
- inline edit row
- file/folder picker row
- batch progress summary

Exit criteria:
- implementation can build screens by composition instead of re-inventing widgets

### Workstream 9: Native Cutover Planning

Goal:
- ensure the design package supports a clean cutover later

Required deliverables:
- workflow-by-workflow replacement order
- Electron reference dependencies
- deletion targets after parity

Checklist:
- define first native workflow slice
- define temporary coexistence rules
- define when Electron screen work must stop
- define what confirms native parity per workflow

Exit criteria:
- migration is staged without blending old/new product shell logic

## Required Design Deliverable Set

Before any native UI implementation, the design package must contain:
1. app map
2. workflow contracts
3. screen layout specs
4. interaction model
5. page-state/read-model contracts
6. service boundary map
7. visual system
8. component inventory
9. cutover plan

## Review Gates

### Gate A: Architecture Review

Must confirm:
- one coherent native app structure
- no Electron-shell assumptions leaked into the target shell
- no shell-specific backend forks proposed

### Gate B: Workflow Review

Must confirm:
- each page has one clear job
- no duplicate workflow ownership
- the user journey is coherent

### Gate C: Screen Review

Must confirm:
- each screen has a dominant action and dominant result area
- information density is intentional
- no dashboard sprawl by default

### Gate D: Build Readiness Review

Must confirm:
- enough ambiguity is removed to implement with minimal iteration
- the implementation team is not expected to “discover the product” during coding

## First Detailed Breakdown Order

The next breakdown should happen in this order:
1. information architecture
2. workflow contracts
3. Audio screen contract
4. Project screen contract
5. Sequence/Design/Review relationship
6. visual system
7. component inventory

## Working Rule For New Design Specs

All new native design specs from this point forward should:
- live under `specs/app-ui/`
- explicitly target the native shell
- avoid Electron-specific assumptions unless labeled legacy-reference
