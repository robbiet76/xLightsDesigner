# macOS Native Cutover Plan (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define how the project will move from the Electron reference shell to the native macOS shell without creating a blended product phase.

This document exists to make cutover a controlled replacement process instead of an open-ended coexistence period.

Primary parent sources:
- `macos-native-migration-phase-plan-2026-04-06.md`
- `electron-legacy-removal-manifest-2026-04-06.md`
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-shared-backend-and-service-boundaries-2026-04-06.md`

## Cutover Rule

Coexistence is temporary and bounded.
The native shell replaces Electron workflow by workflow until Electron is no longer an active product shell.

Working rules:
1. only one shell is allowed to be the active product target at a time
2. during migration, Electron may remain runnable for reference, but not as a parallel evolving product shell
3. once a workflow is declared native-primary, new UX/product-direction work for that workflow must stop in Electron
4. parity is defined by workflow capability and behavior, not by pixel-perfect similarity
5. cutover should reduce ambiguity, not create a long dual-maintenance phase

## Temporary Coexistence Rules

Allowed during migration:
- Electron may be launched for reference and comparison
- Electron may receive critical maintenance fixes only
- native and Electron may temporarily share backend/domain services and artifacts

Disallowed during migration:
- adding new forward-looking UX/product behavior to Electron for a workflow already marked native-primary
- maintaining shell-specific backend contracts
- letting both shells evolve the same workflow behavior in parallel
- introducing Electron-only convenience behavior that the native shell will need to unlearn

## Workflow Cutover States

Each workflow must be in exactly one of these states:

### 1. Electron-Reference
- Electron is still the only implemented shell for this workflow
- native may have only planning/design artifacts

### 2. Native-Build
- workflow is being implemented in the native shell
- Electron remains reference-only for comparison
- no new product-direction work goes into the Electron version

### 3. Native-Primary
- native shell is the product target for this workflow
- Electron version is frozen except for removal, if still present

### 4. Retired-In-Electron
- Electron implementation is removed or fully inactive for this workflow

## Workflow Replacement Order

The migration should replace workflows in this order:
1. `Audio`
2. `Settings`
3. `Project`
4. `Layout`
5. `History`
6. `Design`
7. `Sequence`
8. `Review`

## Rationale For The Order

### 1. Audio first
- most self-contained workflow
- high standalone value
- strong test of native file/folder UX, grid/detail patterns, and shared library presentation

### 2. Settings second
- isolated app-wide forms and diagnostics
- low dependency on live sequence state
- useful for establishing category-form patterns

### 3. Project third
- establishes native project lifecycle and durable context flows
- still lower risk than live sequencing/review flows

### 4. Layout and History next
- table/detail-heavy workflows
- useful for maturing browse-detail component patterns
- lower risk than live xLights/apply workflows

### 5. Design, Sequence, Review last
- highest coupling to live orchestration and xLights behavior
- should be built after the shared shell/component patterns are proven

## Native-Primary Gate Per Workflow

A workflow may be promoted to `Native-Primary` only when all of the following are true:
1. the workflow contract is complete
2. required wireframes and prototype review are complete for that workflow
3. native implementation covers the required workflow actions for that screen
4. read-model and action-model behavior matches the shared contracts
5. backend/service boundaries are respected
6. known gaps are minor and do not force users back to Electron for core use of that workflow

## Workflow Parity Gates

### Audio parity gate
Required minimum parity:
- single-track analysis
- folder batch analysis
- shared library browsing
- selected-result summary
- inline identity confirmation
- progress and completion states

### Settings parity gate
Required minimum parity:
- category navigation
- provider/xLights/path settings editing
- validation presentation
- diagnostics and maintenance entry points

### Project parity gate
Required minimum parity:
- create/open/save/save-as
- project identity and path summary
- readiness summary presentation

### Layout parity gate
Required minimum parity:
- target grid browsing
- selected-target detail
- correction flow for supported edits
- orphan/remapping visibility

### History parity gate
Required minimum parity:
- historical event list
- selection/detail browsing
- artifact reference visibility

### Design parity gate
Required minimum parity:
- creative brief summary
- proposal/rationale browsing
- warning/open-question visibility

### Sequence parity gate
Required minimum parity:
- active sequence identity
- bound-track visibility
- revision/settings summary
- timing materialization summary
- technical readiness view

### Review parity gate
Required minimum parity:
- pending implementation summary
- blockers/warnings
- approval/apply flow
- progress/completion feedback

## Electron Stop Rules

When a workflow becomes `Native-Primary`:
1. stop adding new Electron UX work for that workflow
2. stop adding new Electron-specific screen refinements for that workflow
3. if backend changes are needed, implement them for the shared platform, not the Electron screen
4. mark the Electron implementation as frozen-reference for that workflow

## Electron Removal Rules

When a workflow is stable in the native shell and no longer needed for reference:
1. remove the Electron workflow implementation surface
2. remove Electron-only tests for that workflow if they no longer serve the shared platform
3. update the removal manifest and spec indexes
4. do not leave partially active duplicate workflow surfaces behind

## Native Scaffold Coexistence Rule

During early native implementation:
- `apps/xlightsdesigner-macos` is the only place new product-shell implementation occurs
- `apps/xlightsdesigner-ui` and `apps/xlightsdesigner-desktop` remain maintenance/reference only

This is a hard boundary.

## Reference Use Rule

Electron remains useful only for:
- comparing existing workflow behavior
- checking whether a native implementation is functionally missing something important
- referencing old flow details during cutover

Electron must not be used as the place where unsettled product decisions continue to accumulate.

## Shared Backend Rule During Cutover

If a new capability is needed during migration:
- first ask whether it belongs to the shared platform/backend
- only then decide how the native shell presents it

Do not solve migration pressure by embedding backend logic into SwiftUI or by adding a shell-specific fork.

## Cutover Review Gates

### Gate 1: Native-Build Readiness
Checks:
- workflow design package is complete
- component dependencies are known
- backend contract dependencies are known
- Electron behavior for the workflow is understood well enough to replace

### Gate 2: Native-Primary Promotion
Checks:
- parity gate for the workflow is satisfied
- Electron is no longer needed for core use of the workflow
- known gaps are minor and explicitly tracked

### Gate 3: Electron Retirement Readiness
Checks:
- all required workflows are native-primary
- no critical operator path still depends on Electron
- removal manifest is current
- shared platform/backend surfaces are preserved and clearly separated from Electron glue

## Final Retirement Condition

Electron is no longer an active shell when:
1. all required workflows are native-primary or retired-in-Electron
2. the remaining Electron code is only reference residue explicitly scheduled for deletion
3. the native shell is the only workflow target receiving product-direction work

## Immediate Next Step After This Plan

After the cutover plan is locked:
1. begin screen review packages and wireframe sets starting with `Audio`
2. do not start broad SwiftUI feature implementation until the first workflow package passes review
