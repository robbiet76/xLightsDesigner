# Native Cutover Audit (2026-04-10)

Status: Active
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Record the current shell architecture after the phase-model work so Electron retirement can happen as a controlled cleanup instead of another discovery cycle.

This audit answers:
- what is already native-primary
- what is still Electron-only legacy shell
- what shared JS surfaces still matter and cannot be deleted yet
- what the first safe cleanup boundary is

## Current Architectural Read

### Native-primary product shell

The active product shell is the SwiftUI app under:
- `apps/xlightsdesigner-macos/`

Evidence in code:
- full workflow view/view-model stack exists for:
  - `Project`
  - `Display`
  - `Audio`
  - `Design`
  - `Sequence`
  - `Review`
  - `History`
  - `Settings`
- team chat, workflow phase header, sidebar, and phase-aware routing all live in the native app
- native automation and validation now target the SwiftUI app directly

Working rule:
- new product-shell behavior belongs only in `apps/xlightsdesigner-macos/`

### Legacy Electron shell

The Electron shell remains under:
- `apps/xlightsdesigner-desktop/`

Current role:
- frozen reference shell
- legacy bridge host
- maintenance-only

It still contains:
- the Electron main process
- the preload bridge
- old renderer packaging
- legacy renderer eval entrypoints

This is not the active product target.

### Shared JS domain/runtime surface

The JS app/domain layer under:
- `apps/xlightsdesigner-ui/agent/`
- `apps/xlightsdesigner-ui/runtime/`
- parts of `apps/xlightsdesigner-ui/tests/`

still contains active shared value.

These paths currently carry:
- assistant orchestration
- specialist routing logic
- validation harnesses
- some domain runtime utilities
- some metadata/timing helpers used by scripts and tests

These should not be deleted just because Electron is retired.

## Workflow Cutover Status

Current practical status by workflow:

### `Settings`
- state: `Native-Primary`
- Electron status: reference only

### `Project`
- state: `Native-Primary`
- Electron status: reference only

### `Display` / `Layout`
- state: `Native-Primary`
- Electron status: reference only

### `Audio`
- state: `Native-Primary`
- Electron status: reference only

### `Design`
- state: `Native-Primary`
- Electron status: reference only

### `Sequence`
- state: `Native-Primary`
- Electron status: reference only

### `Review`
- state: `Native-Primary`
- Electron status: reference only

### `History`
- state: `Native-Primary`
- Electron status: reference only

### `Assistant surface`
- state: `Native-Primary`
- Electron status: reference only

Conclusion:
- all major operator workflows are now native-primary in practice
- Electron no longer needs to be treated as an active product shell

## Do Not Delete Yet

These areas are still mixed and need extraction or replacement before deletion:

### 1. `apps/xlightsdesigner-desktop/main.mjs`

Reason:
- mixes pure Electron glue with file/service/bridge behavior that still represents useful backend logic

Required split before retirement:
- Electron-only window/bootstrap code
- portable service logic
- obsolete legacy bridge handlers

### 2. `apps/xlightsdesigner-desktop/preload.mjs`

Reason:
- pure Electron bridge surface, but it documents the old shell contract and still maps many legacy operations

Delete only after:
- no current test, script, or runtime path depends on those IPC handlers

### 3. `apps/xlightsdesigner-ui/app-ui/`

Reason:
- this is legacy renderer shell code
- but some page-state builders are still imported by:
  - `apps/xlightsdesigner-ui/runtime/ui-composition-runtime.js`
  - `apps/xlightsdesigner-ui/runtime/clean-sequence-runtime.js`
  - tests under `apps/xlightsdesigner-ui/tests/app-ui/page-state/`

This directory is a retirement target, but not yet a safe immediate deletion.

### 4. Mixed JS runtime modules

Files requiring review before removal or re-home:
- `apps/xlightsdesigner-ui/runtime/ui-composition-runtime.js`
- `apps/xlightsdesigner-ui/runtime/clean-sequence-runtime.js`
- `apps/xlightsdesigner-ui/runtime/desktop-bridge-runtime.js`

Reason:
- these still pull legacy page-state or bridge assumptions into otherwise shared runtime logic

## First Safe Cleanup Boundary

The first safe cleanup phase is documentation and status hardening, not deletion.

Safe now:
1. mark native as the active shell everywhere
2. mark Electron and old renderer shell as legacy-reference only
3. stop adding any new product behavior to:
   - `apps/xlightsdesigner-desktop/`
   - `apps/xlightsdesigner-ui/app-ui/`
4. keep using shared JS agent/runtime code where it still adds value

Not safe yet:
1. deleting `apps/xlightsdesigner-desktop/`
2. deleting `apps/xlightsdesigner-ui/app-ui/`
3. deleting `apps/xlightsdesigner-ui/runtime/desktop-bridge-runtime.js`

## Recommended Next Cleanup Pass

Short cleanup phase:
1. add status READMEs to the legacy shell directories
2. keep specs aligned with native-primary reality
3. inventory `main.mjs` handlers into:
   - native already replaced
   - shared service worth preserving
   - dead Electron glue

After that:
4. extract or replace the remaining shared behavior that still lives in Electron
5. delete Electron shell and renderer shell in one bounded cut

## Deletion Gate

Delete the Electron shell only when all of the following are true:
1. no active workflow depends on Electron for core use
2. no automation path depends on Electron IPC handlers
3. shared JS/runtime value has been re-homed or intentionally retained outside the shell
4. `apps/xlightsdesigner-ui/app-ui/` no longer feeds active runtime modules

Until then:
- maintain Electron as frozen reference only
- do not deepen investment there
