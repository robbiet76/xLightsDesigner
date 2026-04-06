# macOS Native Migration Phase Plan (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the high-level migration plan from the current Electron desktop shell to a macOS-native application shell.

This plan exists to prevent a messy blend of old and new UI work.
It locks in a clean migration approach before any SwiftUI implementation begins.

## Decision

The target product shell is now:
- macOS native UI using SwiftUI

The current Electron shell is now:
- reference-only
- maintenance-only
- not the long-term product shell

## Non-Negotiable Migration Rules

1. Do not rewrite the Electron shell in place.
2. Do not mix Electron UI work and SwiftUI product work inside the same implementation surface.
3. Do not create dual active UI platforms that both evolve feature behavior.
4. Do not change backend contracts just because the frontend shell changes.
5. Do not begin SwiftUI screen implementation until the design phase is complete.

## Stable Platform Boundary

These areas should remain the shared product/backend platform:
- project storage layout
- shared track metadata layout
- artifact schemas
- sequence metadata contracts
- xLights owned API contracts
- analysis/sequencing workflow contracts

These areas should be replaced by the native shell:
- navigation shell
- page composition
- forms
- tables/grids
- detail panes
- dialogs/sheets
- settings UI
- desktop workflow UX

## Repo Direction

Canonical existing app paths remain:
- app source: `/Users/robterry/Projects/xLightsDesigner`
- xLights source: `/Users/robterry/xLights`

Current shell directories:
- `apps/xlightsdesigner-ui`
- `apps/xlightsdesigner-desktop`

Planned native shell directory:
- `apps/xlightsdesigner-macos`

Working rule:
- Electron remains runnable for reference
- native product work starts in a separate app directory
- shared contracts stay in the main repo/spec layer

## Phase Plan

### Phase 0: Freeze And Boundary Lock

Goal:
- stop accidental blending of Electron UI work and native product work

Checklist:
- declare Electron shell maintenance-only
- stop broad Electron UX iteration
- lock migration policy in the spec layer
- identify reusable backend/domain contracts
- identify Electron-specific code that should not be carried forward

Exit criteria:
- migration boundary is explicit
- active planning no longer assumes Electron is the target shell

### Phase 1: Product Design

Goal:
- complete the native application design package before UI implementation

Primary breakdown source:
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-wireframe-and-prototype-method-2026-04-06.md`

Checklist:
- define app-level information architecture
- define global navigation and page ownership
- define per-page goals and workflows
- define screen-by-screen layout and interaction patterns
- define editable vs read-only state on each page
- define table/grid standards
- define dialogs/sheets/confirmation patterns
- define status language and action language
- define visual system and layout rules

Exit criteria:
- complete design package exists
- screen flows are explicit enough to implement with minimal iteration

### Phase 2: State And Backend Contract Consolidation

Goal:
- make sure the native shell can sit on a stable shared backend contract

Checklist:
- identify canonical app state domains
- identify project state vs app state vs sequence state vs track-library state
- define native-facing service boundaries
- lock artifact/schema contracts that SwiftUI will consume
- confirm xLights API remains the same backend contract
- identify Electron-only persistence concerns that should be removed

Exit criteria:
- shared backend/platform contract is documented
- SwiftUI implementation can proceed without inventing runtime semantics

### Phase 3: Native App Scaffold

Goal:
- create the native application shell without feature churn

Checklist:
- create `apps/xlightsdesigner-macos`
- set up native app lifecycle
- define navigation shell
- define shared service integration approach
- define canonical macOS app-state storage approach
- define development/build/run workflow

Exit criteria:
- native app scaffolding is operational
- no feature work has been mixed into the scaffold phase

### Phase 4: First Workflow Build

Goal:
- build the first real native workflow against the locked design package

Recommended first workflow:
- Audio Analysis

Checklist:
- implement Audio page layout
- implement shared track library grid
- implement current-result panel
- implement inline confirmation flow
- implement batch analysis workflow
- implement state refresh/load behavior

Exit criteria:
- Audio workflow is usable end-to-end in the native shell

### Phase 5: Native Expansion

Goal:
- add the remaining workflows in controlled slices

Recommended order:
1. Settings
2. Project
3. Audio
4. Sequence
5. Review
6. History

Checklist:
- implement one workflow at a time
- preserve backend contracts
- avoid cross-shell divergence in behavior
- retire equivalent Electron UI flows only when native parity is good enough

Exit criteria:
- native shell becomes the primary product shell

### Phase 6: Electron Retirement

Goal:
- end active dependency on the Electron shell

Checklist:
- confirm native parity for required workflows
- remove Electron from active development
- keep only what is needed for historical reference or temporary fallback
- simplify the repo once cutover is complete

Exit criteria:
- native shell is the product
- Electron is no longer the active development target

## Design-First Working Rule

For the native migration:
- spend the majority of effort in design before UI implementation
- implement only after ambiguity is low
- minimize iterative churn during build

Practical rule:
1. define
2. review
3. lock
4. build

## xLights API Policy

The xLights owned API is a shared backend contract.
It should remain conceptually stable across the shell migration.

Allowed changes:
- real API improvements
- missing route additions
- correctness fixes
- contract hardening

Disallowed changes:
- shell-specific API forks
- Electron-only vs SwiftUI-only API divergence
- rewriting the API just because the frontend changed

Working rule:
- one xLights owned API surface
- multiple frontend clients over time

## Immediate Next Step

Before any native UI implementation:
1. create the full design package
2. define shared backend/state boundaries
3. only then scaffold the native app

## Retirement Preparation

Electron retirement should not require a new audit.

Primary manifest:
- `electron-legacy-removal-manifest-2026-04-06.md`

Working rule:
- maintain an explicit list of Electron-only specs and implementation surfaces to delete later
- keep native-active planning separate from Electron legacy-reference material
