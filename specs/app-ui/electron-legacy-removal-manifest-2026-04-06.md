# Electron Legacy Removal Manifest (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Identify which specs and implementation surfaces are:
- legacy Electron-shell reference only
- shared platform/backend work that must remain
- native-target planning work that replaces Electron planning

This exists so the eventual Electron retirement is a deletion pass, not a new discovery project.

## Working Rule

During the native migration:
- mark Electron-specific planning and implementation surfaces now
- do not continue adding new product-direction material to Electron-only files
- when native cutover is complete, delete Electron-only paths directly

Do not preserve old shell layers just because they once held product logic.

## Categories

### 1. Native-Active Planning Surface

These specs remain active through the native migration and should continue evolving:
- `specs/current-app-plan-2026-04-05.md`
- `specs/app-ui/macos-native-migration-phase-plan-2026-04-06.md`
- `specs/app-ui/native-cutover-audit-2026-04-10.md`
- `specs/README.md`
- `specs/repo-structure-governance.md`
- `specs/xlightsdesigner-project-storage-layout.md`

Rule:
- these are not tied to Electron
- update these as the native design package evolves

### 2. Electron Legacy-Reference Specs

These specs are useful only as historical/reference material during migration.
They should not be treated as the target product shell plan.

Legacy-reference set:
- `specs/archive/app-ui/implementation-checklist.md`
- `specs/archive/app-ui/end-to-end-audit-2026-03-12.md`
- `specs/archive/app-ui/history-and-live-dashboards-plan-2026-03-13.md`
- `specs/archive/app-ui/history-implementation-checklist.md`
- `specs/app-ui/audio-page-redesign-2026-04-06.md`

Rule:
- no new forward-looking product decisions should be written into these files
- once native cutover is complete, archive or delete them as a group

### 3. Electron Shell Implementation Surfaces To Retire

These are the implementation surfaces expected to be removed once the native shell is primary:
- `apps/xlightsdesigner-desktop/`
- `apps/xlightsdesigner-ui/app-ui/`
- `apps/xlightsdesigner-ui/styles.css`

Likely Electron-shell entry surfaces to retire:
- `apps/xlightsdesigner-ui/app.js`
- `apps/xlightsdesigner-ui/index.html`
- `apps/xlightsdesigner-ui/dev_server.py`

Rule:
- these remain maintenance-only during migration
- do not deepen product-shell investment here
- delete after native parity is reached

### 4. Shared Platform / Backend Surfaces To Preserve

These should not be deleted just because Electron is removed.
They represent shared product/backend/platform value and should be reused or re-homed as needed.

Examples:
- artifact schemas
- project storage layout rules
- shared track metadata contracts
- xLights owned API contracts
- project metadata and library persistence rules
- analysis orchestration logic
- sequence/timing contract logic

Likely preserve-or-port areas include parts of:
- `apps/xlightsdesigner-desktop/*.mjs` store/bridge logic where platform-neutral
- `apps/xlightsdesigner-ui/runtime/` modules that encode domain behavior rather than UI rendering
- `training-packages/`
- `specs/audio-analyst/`
- `specs/sequence-agent/`
- `specs/designer-dialog/`

Rule:
- do not label a file “shared” just because it lives outside the UI folder
- shared means backend/domain/platform value, not Electron convenience

### 5. Review-Before-Cutover Surfaces

These paths need explicit review during migration because they currently mix UI and domain concerns:
- `apps/xlightsdesigner-ui/runtime/`
- `apps/xlightsdesigner-desktop/main.mjs`
- `apps/xlightsdesigner-desktop/preload.mjs`

Rule:
- split these into:
  - native-shell UI concerns
  - shared service/backend concerns
  - Electron-only glue

At cutover:
- shared concerns stay
- Electron-only glue is deleted

## Native Cutover Deletion Rule

When the native shell is primary:
1. delete Electron-only implementation directories directly
2. delete or archive Electron legacy-reference specs directly
3. keep only shared backend/platform contracts

Do not leave:
- compatibility shells
- dual active UI stacks
- stale Electron-only specs in active indexes

## Immediate Next Documentation Rule

When creating new specs from this point onward:
- native-target planning goes into the active app-ui planning surface
- Electron-only notes must be explicitly labeled legacy-reference

Do not create new ambiguous shell specs.
