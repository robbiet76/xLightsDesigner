# Modal State Monitoring Audit

Date: 2026-04-26

Prompt:
> please audit the full functionality of modal state monitoring as we have worked on this issue many times. There may be conflicting logic out there.

Follow-up direction:
> We should not rely on brut force mechanisms to deal with modals. We should understand and deal with the root cause of why the modal is appearing.

## Current Finding

Modal handling is currently split across several mechanisms, and those mechanisms do not form one reliable state model.

The launcher script can inspect and optionally click macOS Accessibility-visible xLights windows before the owned API is ready. The owned API itself does not expose active modal/window state through `/health` or any other route. App-side readiness checks and validation scripts mostly treat `/health state=ready` as sufficient, so they can miss a blocking dialog that appears after startup or during an owned API job.

This means the system can be simultaneously:
- API-ready from the app's point of view
- blocked inside xLights by a native modal from the user's point of view
- difficult to diagnose because job polling only reports queued/running/failed, not "blocked by modal"

## Implemented Mechanisms

### Launcher Accessibility Probe

File:
- `scripts/xlights/launch-owned-xlights.mjs`

Current behavior:
- starts the API-enabled xLights debug build
- sets `XLIGHTS_DESIGNER_ENABLED=1`
- sets `XLIGHTS_DESIGNER_MODAL_POLICY`
- waits for `/xlightsdesigner/api/health`
- uses macOS System Events/JXA to inspect xLights windows
- identifies likely dialogs/sheets from role/subrole, title, and button names
- can click a policy-selected button for `safe`, `ok`, `cancel`, `discard`, or `save`
- samples the process to classify launch blockers such as `wxMessageBox`, `ShowModal`, and `SaveChangesDialog`

Appropriate scope:
- launch-time diagnostics
- pre-frame startup blocker detection before the owned API exists

Not appropriate as the core solution:
- routine sequencing automation
- silent dismissal of unknown dialogs
- deciding whether user data should be saved, discarded, or recovered

### Owned xLights Health

Files:
- `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner/DesignerApiRuntime.h`
- `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner/api/handlers/RuntimeHandler.h`

Current behavior:
- reports listener state
- reports worker/job queue state
- reports app startup readiness and settle timing

Current gap:
- no modal count
- no active modal titles/classes/buttons
- no "blocked by UI modal" state
- no root-cause metadata when an API job is stalled because the main thread is inside a dialog

### App and Validation Readiness Checks

Files observed:
- `apps/xlightsdesigner-ui/api.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/orchestrator.js`
- `apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/XLightsSessionService.swift`
- `scripts/xlights/wait-owned-xlights.mjs`
- `scripts/xlights/validate-owned-show-folder-flow.mjs`
- `scripts/xlights/validate-owned-clone-safety.mjs`

Current behavior:
- readiness is based on `/health`
- job polling is based on `/jobs/get`
- validation scripts do not inspect modal state except indirectly through launch script failures

Current gap:
- no shared modal-aware readiness helper
- no fail-fast path if xLights reports a blocking modal
- no validation artifact field proving the UI was unblocked at each major API handoff

## Conflicting or Stale Documentation

The xLights owned API docs overstated the implemented modal/save behavior before this audit cleanup.

Stale examples found and corrected during this audit:
- `API_CURRENT_STATE.md` still says the repo is `/Users/robterry/xLights-api-cleanup` on branch `api-cleanup`.
- `API_CURRENT_STATE.md` says atomic sequence save protection exists in core xLights, but the current correction is to remove the custom owned temporary save file strategy and return to native `SequenceFile::Save`.
- `API_CURRENT_STATE.md` and `OWNERSHIP_BOUNDARY.md` say `SeqFileUtilities.cpp` suppresses sequence autosave recovery prompts in owned mode. The inspected current file still calls `wxMessageBox` directly for newer `.xbkp` recovery prompts and does not include `DesignerLaunchPolicy.h`.
- `API_CURRENT_STATE.md` frames modal suppression as broadly solved, while current runtime health has no modal visibility.

## Root-Cause Modal Sources In Scope

Root-cause prevention should focus first on API-triggered paths:
- startup command-line information/error dialogs
- autosave recovery prompts for show-folder files
- autosave recovery prompts for sequence `.xbkp` files
- `SaveChangesDialog` during sequence close/open/create
- missing access/save failure error dialogs
- dialogs opened by native save/open paths accidentally used by API routes
- render/export/backup/update prompts accidentally reached by automation

Current owned API routes should not call UI commands that can open arbitrary native dialogs unless the route has explicitly prepared the xLights state so no prompt is needed.

## Root-Cause Design Direction

Preferred model:
1. Prevent expected modals by using deterministic owned API routes and setting the xLights state correctly before calling native methods.
2. Expose unexpected modal state from xLights through the owned API health surface.
3. Treat unexpected modals as blocking diagnostics by default, not as prompts to auto-click.
4. Keep macOS Accessibility clicking only as a launch-time diagnostic fallback before the API listener exists.

The normal automation path should not depend on brute-force UI dismissal.

## Required Follow-Up Work

Completed during this audit:
- added owned API `/health.data.modalState`
- reports modal/dialog count, blocking state, titles/classes/buttons for shown dialogs
- keeps normal validation in detect/report/block mode rather than auto-click mode
- records modal-state checkpoints in owned validation evidence

Remaining follow-up:

1. Make all remaining app and validation readiness paths modal-aware.
   - Update shared JS API readiness helpers.
   - Update Swift `ensureOwnedRuntimeReady`.
   - Update validation scripts to fail fast with modal diagnostics.
   - Store modal state snapshots in validation evidence.

2. Audit and remove misleading modal policies.
   - Default automation should use detect/report/block.
   - `discard`, `save`, and broad click policies should not be the normal validation path.
   - Any automatic decision must be limited to a known prompt with a known safe business rule.

3. Root-cause each recurring modal source.
   - For every modal seen during owned API validation, identify the exact native call path.
   - Fix the route preconditions or native adapter behavior so the modal is not created.
   - Add a targeted validation assertion for that modal class.

4. Keep xLights owned docs current.
   - Correct current repo/branch/date.
   - Remove claims that core xLights save behavior is atomically changed.
   - Clarify that sequence `.xbkp` autosave recovery prompt handling is not currently covered by owned launch policy unless separately implemented.

## Current Risk Level

High for unattended validation and agent handoffs.

The sequencing layer can submit a valid batch and still lose observability if xLights enters a modal state during save, open, close, render, or startup recovery. `/health.data.modalState` now gives us direct visibility, but every surfaced modal still needs a route-level root-cause fix rather than brute-force dismissal.
