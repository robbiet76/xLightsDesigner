# macOS Native Shared Backend And Service Boundaries (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the boundary between the native macOS shell and the shared backend/platform services before SwiftUI implementation begins.

This document exists to prevent business logic, persistence truth, and xLights orchestration from being reimplemented inside the native shell.

Primary parent sources:
- `macos-native-design-phase-workstreams-2026-04-06.md`
- `macos-native-read-models-and-page-state-contracts-2026-04-06.md`
- `macos-native-migration-phase-plan-2026-04-06.md`
- `xlightsdesigner-project-storage-layout.md`
- `sequence-agent/xlights-sequencer-control-api-surface-contract.md`

## Boundary Rule

The native shell is a product client and composition layer.
It is not a second backend.

Working rules:
1. the native shell owns presentation, local interaction state, and read-model composition
2. shared backend/platform owns durable truth, orchestration rules, and external system contracts
3. xLights integration stays behind one shared API/client boundary
4. file layout and artifact schemas are shared platform contracts, not UI-layer choices
5. the shell may request operations, but it must not become the place where core business rules are invented

## Shared Platform Surface

These areas remain shared product/backend platform and must not fork by shell:
- project storage layout
- shared track metadata layout
- sequence metadata layout and binding contracts
- artifact schemas
- audio analysis workflow contracts
- sequencing/review artifact contracts
- xLights owned API contracts
- durable history/review records
- validation rules for durable entities

## Native Shell Surface

The native shell owns:
- navigation shell
- screen composition
- tables/grids/forms/detail panes
- sheet/dialog presentation
- local interaction state
- read-model composition from shared platform state
- action dispatch to shared services
- macOS-specific UX behavior

The native shell does not own:
- canonical project storage rules
- canonical library/track storage rules
- canonical sequence binding rules
- xLights route semantics
- durable artifact schemas
- shell-specific backend truth

## Service Categories

The platform boundary is organized into these service categories:
1. project service
2. layout service
3. track library service
4. audio analysis service
5. design artifact service
6. sequence service
7. review/apply service
8. history service
9. settings/configuration service
10. xLights client service
11. diagnostics/backup service

## 1. Project Service Boundary

### Shared backend/platform owns
- project create/open/save/save-as semantics
- validation of canonical project paths and layout
- `.xdproj` read/write rules
- project readiness summaries derived from durable project truth

### Native shell owns
- project forms and sheets
- user-flow presentation for create/open/save
- project read-model composition and local validation presentation

### Native shell must not own
- alternate project-file schema
- path-validation truth independent of the platform

## 2. Layout Service Boundary

### Shared backend/platform owns
- layout target scanning/derivation rules
- target/tag/assignment durable records when supported
- orphan/remapping detection rules
- layout readiness computation

### Native shell owns
- target grid presentation
- selected-target detail composition
- correction UI flow
- local filtering and selection state

### Native shell must not own
- independent target classification logic
- durable orphan/remapping truth outside the shared platform store

## 3. Track Library Service Boundary

### Shared backend/platform owns
- canonical `library/tracks/*.json` storage
- track identity rules and verification state
- timing coverage summaries and profile availability
- slug/fingerprint naming rules
- shared library listing and lookup semantics

### Native shell owns
- library grid presentation
- current-result summary composition
- local library filters and selection
- user-facing incomplete-state explanations derived from shared data

### Native shell must not own
- alternate track metadata schema
- shell-specific duplicate library index as product truth

## 4. Audio Analysis Service Boundary

### Shared backend/platform owns
- file/folder analysis orchestration
- provider invocation and profile selection
- track identity inference and validation rules
- shared track record creation/update rules
- batch result summaries and issue classification

### Native shell owns
- file/folder picker UX
- initiation controls
- progress presentation
- inline identity-confirmation presentation when allowed

### Native shell must not own
- provider orchestration logic
- canonical issue classification logic
- direct mutation of analysis artifacts outside the service contract

## 5. Design Artifact Service Boundary

### Shared backend/platform owns
- proposal bundle persistence
- rationale artifact persistence
- design artifact validation
- durable design-side summaries derived from stored artifacts

### Native shell owns
- design-page composition
- design artifact browsing and summary presentation

### Native shell must not own
- alternate proposal schema
- durable design artifact truth outside shared storage

## 6. Sequence Service Boundary

### Shared backend/platform owns
- sequence metadata storage under app-owned roots
- sequence-to-track binding rules
- sequence readiness derivation
- timing materialization state derivation
- sequence metadata validation rules

### Native shell owns
- active sequence presentation
- sequence detail/readiness summary composition
- local refresh controls and local technical inspection UX

### Native shell must not own
- sequence metadata sidecar alternatives
- shell-specific binding truth
- direct xLights sequence mutation logic outside the shared client/service boundary

## 7. Review / Apply Service Boundary

### Shared backend/platform owns
- pending implementation summary derivation
- apply preconditions
- review/apply artifact creation
- backup/restore contract relevant to apply
- durable apply-history truth

### Native shell owns
- review-page composition
- approval/apply flow presentation
- sheet/dialog UX for confirmation
- progress and completion presentation

### Native shell must not own
- apply business rules
- stale-write guards
- durable review/apply truth outside shared artifacts

## 8. History Service Boundary

### Shared backend/platform owns
- historical revision/apply record storage
- artifact references
- ordering and classification of historical events

### Native shell owns
- history list presentation
- selected-history detail composition
- local filters, sort order, and export UI flow

### Native shell must not own
- alternate history persistence model
- mutation of historical truth as a UI convenience

## 9. Settings / Configuration Service Boundary

### Shared backend/platform owns
- durable app settings schema
- provider configuration schema
- xLights connection preference schema
- path/storage configuration truth
- maintenance capability rules

### Native shell owns
- category navigation and forms
- validation/error presentation
- confirmation UX for risky maintenance actions

### Native shell must not own
- alternate settings persistence
- hidden parallel config files for shell convenience

## 10. xLights Client Service Boundary

### Shared backend/platform owns
- owned API client contract
- route/request/response normalization
- endpoint health checks
- revision-token handling
- long-running job polling rules
- xLights command semantics and error normalization

### Native shell owns
- xLights status presentation
- operation initiation UX where needed
- local activity/progress display

### Native shell must not own
- direct route-by-route xLights business logic in UI code
- shell-specific API divergence
- a second incompatible xLights client contract

## 11. Diagnostics / Backup Service Boundary

### Shared backend/platform owns
- backup creation rules
- diagnostic artifact creation rules
- app-data reveal/log-open contract surfaces
- reset rules when allowed

### Native shell owns
- diagnostics and maintenance presentation
- confirmation and result messaging

### Native shell must not own
- destructive reset implementation logic as raw UI actions

## File And Folder Operations Boundary

Shared backend/platform owns:
- canonical file layout rules
- durable path validation
- project/library/sequence write rules
- reveal/open path actions when they are product operations

Native shell owns:
- invoking native open/save panels
- collecting user selections
- displaying validation results

Rule:
- the shell may choose files and folders
- the platform decides whether those choices are valid and how they map into durable product state

## Persistence Boundary

Shared backend/platform owns all durable writes to:
- app settings/configuration storage
- app root project files
- shared track library files
- sequence metadata files
- review/history artifacts
- diagnostics/backups as product records

Native shell may persist only:
- session-restorable UI state
- purely local UI preferences if explicitly approved later

Native shell must not create:
- a parallel durable domain store
- shell-private copies of canonical project/library/sequence truth

## Read-Model Composition Boundary

Shared backend/platform provides:
- durable entities
- summaries and validation outputs where needed
- operation results

Native shell provides:
- screen-specific composition
- reduction of backend outputs into view-ready structures
- local sorting/filtering/selection state

Rule:
- compose for presentation in the shell
- derive business truth in the shared platform

## xLights Owned API Boundary

The xLights owned API remains one shared contract across shells.

Shared backend/platform owns:
- mapping shell actions into owned API operations
- request envelope/route semantics
- response normalization
- retry and health-check policy

Native shell owns:
- presentation of readiness, health, and failure state
- triggering supported actions via the client/service layer

Disallowed:
- Electron-only API routes
- SwiftUI-only API routes
- route semantics that differ by shell

## Error And Validation Boundary

Shared backend/platform owns:
- durable validation rules
- domain error classification
- external-system error normalization

Native shell owns:
- human-readable presentation
- placement of errors and warnings in the screen
- contextual retry affordances

Rule:
- error meaning comes from shared services
- error presentation belongs to the shell

## Testing Boundary

Shared backend/platform tests should cover:
- storage rules
- validation rules
- artifact creation/update rules
- xLights client normalization
- review/apply preconditions

Native shell tests should cover:
- read-model composition
- action routing
- interaction behavior
- state restoration behavior
- screen-specific presentation logic

## Explicit Non-Goals

This boundary must not allow:
- business logic duplicated in SwiftUI views
- shell-specific schema forks
- direct xLights route logic scattered through UI code
- UI-managed durable truth for project/library/sequence domains
- hidden compatibility persistence added for shell convenience

## Exit Criteria For Design Phase

This workstream is ready when:
1. native shell ownership is clearly narrower than shared platform ownership
2. file/persistence boundaries are explicit
3. xLights owned API client boundary is explicit
4. the shell can be implemented as a client/composition layer without backend invention
