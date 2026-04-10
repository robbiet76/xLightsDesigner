# Electron Main Handler Inventory (2026-04-10)

Status: Active
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Classify the legacy Electron `ipcMain.handle(...)` surface in:
- `apps/xlightsdesigner-desktop/main.mjs`

This is the next removal-planning layer after:
- `native-cutover-audit-2026-04-10.md`
- `electron-bridge-inventory-2026-04-10.md`

The goal is to turn the remaining Electron main-process code into bounded cleanup phases instead of one unsafe deletion.

## Classification

### A. Native-Replaced Workflow Shell Handlers

These handlers belong to app-shell behavior that is now native-primary in the SwiftUI app.
They should not receive further product investment.

- `xld:open-file-dialog`
- `xld:sequence:save-dialog`
- `xld:project:open-dialog`
- `xld:project:save-dialog`
- `xld:state:read`
- `xld:state:write`
- `xld:app:factory-reset`
- `xld:app:info`
- `xld:agent:health`
- `xld:agent-config:get`
- `xld:agent-config:set`
- `xld:agent:chat`
- `xld:designer:chat`
- `xld:diagnostics:export`

Rule:
- frozen reference only
- delete once Electron shell retirement begins

### B. Shared Service / Storage Handlers

These handlers front real product capabilities that are still useful outside Electron.
They should survive only as shared service modules, not as Electron IPC contracts.

- `xld:analysis-artifact:read`
- `xld:analysis-artifact:write`
- `xld:audio-library:list-tracks`
- `xld:audio-library:update-track-identity`
- `xld:project-artifact:write`
- `xld:project-artifacts:write`
- `xld:project-artifact:read`
- `xld:file:stat`
- `xld:project:open-file`
- `xld:project:write-file`
- `xld:training-package:read`
- `xld:agent-log:append`
- `xld:agent-log:read`
- `xld:sidecar:read`
- `xld:sidecar:write`
- `xld:media:save-reference`
- `xld:media:apply-identity-recommendation`
- `xld:backup:create`
- `xld:backup:restore`
- `xld:sequence:list`
- `xld:media:list`

Rule:
- extract or replace before deleting Electron main

### C. Shared Execution / External Integration Handlers

These handlers coordinate external systems and still need explicit replacement planning:

- `xld:audio:read`
- `xld:analysis:run`
- `xld:analysis:health`
- `xld:audio-library:analyze-folder`

These are not Electron concepts.
But they still need a host process to:
- read files
- spawn scripts
- talk to the analysis service

Rule:
- keep as transitional bridge operations until equivalent native/shared service boundaries are fully explicit

## Current Reality

The native app already has service ownership for most workflows:
- `ProjectService`
- `SettingsService`
- `TrackLibraryService`
- `AudioExecutionService`
- `AssistantExecutionService`
- `XLightsSessionService`
- `HistoryService`
- `PendingWorkService`
- `DisplayDiscoveryStateStore`

That means the Electron main process is no longer the architectural center.

It is now mostly a mixed legacy host containing:
1. obsolete shell handlers
2. storage/service helpers not yet extracted
3. a few external-execution bridges

## Cleanup Phases

### Phase 1: Done

Completed in `9f8ff37`:
- extracted artifact stores to shared JS:
  - `apps/xlightsdesigner-ui/storage/analysis-artifact-store.mjs`
  - `apps/xlightsdesigner-ui/storage/project-artifact-store.mjs`

### Phase 2: Next Recommended Extraction

Extract the sequence/project file helpers now embedded in `main.mjs` into shared shell-neutral modules.

Best candidates:
- sidecar read/write helpers
- backup create/restore helpers
- recursive sequence/media listing helpers
- project file read/write helpers that are not UI-dialog specific

Reason:
- these are file/storage utilities, not Electron UI concerns
- they represent a cohesive cluster
- they reduce `main.mjs` size without touching assistant logic

### Phase 3: Native-Replace Remaining Dialog / App-State Shell

Once the above helpers are extracted:
- leave only dialog/window/bootstrap residue in Electron main
- then delete the remaining shell handlers as a group

## Immediate Recommendation

The next code cleanup pass should target this cluster from `main.mjs`:

- `xld:project:open-file`
- `xld:project:write-file`
- `xld:sidecar:read`
- `xld:sidecar:write`
- `xld:backup:create`
- `xld:backup:restore`
- `xld:sequence:list`
- `xld:media:list`

These form the best next bounded extraction unit.

## Guardrail

Do not try to remove all Electron handlers in one pass.

The safe rule is:
1. extract a cohesive non-shell cluster
2. repoint tests and scripts
3. verify behavior
4. only then shrink Electron further
