# Electron Bridge Inventory (2026-04-10)

Status: Active
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Inventory the Electron preload/main bridge so the next cleanup pass can remove or extract code intentionally.

This document is the working bridge-level companion to:
- `native-cutover-audit-2026-04-10.md`
- `electron-legacy-removal-manifest-2026-04-06.md`

## Current Situation

The legacy Electron bridge still exposes a large `xlightsDesignerDesktop` API from:
- `apps/xlightsdesigner-desktop/preload.mjs`

Most of those operations now fall into one of three categories:
1. native already replaced
2. shared service worth preserving outside Electron
3. legacy-only shell glue

The goal is not to preserve the bridge.
The goal is to use this inventory to delete it in bounded phases.

## Category A: Native Already Replaced

These capabilities now have a native-primary owner in the SwiftUI app and should be treated as legacy bridge residue:

- `openFileDialog`
- `saveSequenceDialog`
- `openProjectDialog`
- `saveProjectDialog`
- `readAppState`
- `writeAppState`
- `getAppInfo`
- `getAgentHealth`
- `getAgentConfig`
- `setAgentConfig`
- `runAgentConversation`
- `runDesignerConversation`
- `exportDiagnosticsBundle`
- `resetAppInstallState`

Working rule:
- do not deepen these IPC paths
- delete them when Electron shell retirement begins

## Category B: Shared Domain / Service Logic To Preserve

These operations represent real product value, but not Electron-specific value:

- `readAnalysisArtifact`
- `writeAnalysisArtifact`
- `analyzeAudioLibraryFolder`
- `listAudioLibraryTracks`
- `updateAudioLibraryTrackIdentity`
- `readProjectArtifact`
- `writeProjectArtifact`
- `writeProjectArtifacts`
- `readSequenceSidecar`
- `writeSequenceSidecar`
- `appendAgentApplyLog`
- `readAgentApplyLog`
- `createSequenceBackup`
- `restoreSequenceBackup`
- `listSequencesInShowFolder`
- `listMediaFilesInFolder`
- `readTrainingPackageAsset`
- `getFileStat`
- `openProjectFile`
- `writeProjectFile`
- `saveReferenceMedia`
- `applyMediaIdentityRecommendation`

Working rule:
- these should survive only as shared storage/service modules
- they should not survive as Electron IPC handlers

## Category C: Legacy Bridge / Shell Glue

These are shell-facing behaviors with no long-term value outside a host shell:

- preload exposure itself
- Electron dialog plumbing
- BrowserWindow lifecycle
- packaged renderer bootstrap
- power-save / automation window management in the Electron process

Working rule:
- delete, do not port

## First Real Extraction Target

The first safe code extraction target is:
- `apps/xlightsdesigner-ui/storage/analysis-artifact-store.mjs`
- `apps/xlightsdesigner-ui/storage/project-artifact-store.mjs`

Reason:
- these modules are already used outside the Electron shell by:
  - scripts
  - tests
  - Electron main process
- they are not BrowserWindow or preload concerns
- they are currently blocking later shell deletion because useful storage logic is trapped under the Electron app directory

Required next move:
1. move these modules to a shell-neutral shared location
2. repoint scripts/tests/Electron main to the new location
3. keep behavior unchanged

This should be the first actual code cleanup pass.

## Second Extraction Target

After artifact/store extraction, evaluate the remaining file/service helpers currently embedded in:
- `apps/xlightsdesigner-desktop/main.mjs`

Split them into:
1. dead Electron-only glue
2. shared file/storage helpers
3. native-replaced operations that can be deleted outright

## Deletion Order

Recommended order:

1. extract shell-neutral storage modules
2. trim Electron main down to real shell glue
3. remove renderer-shell-only dependencies on:
   - `apps/xlightsdesigner-ui/app-ui/`
   - `apps/xlightsdesigner-ui/app.js`
   - `apps/xlightsdesigner-ui/index.html`
   - `apps/xlightsdesigner-ui/dev_server.py`
4. delete Electron preload and main process shell
5. delete the Electron app package entirely

## Guardrail

Do not delete any bridge operation only because there is a native screen for the same workflow.

Delete only after one of the following is true:
- the operation is pure Electron shell glue
- the operation has been re-homed into a shared service module
- the operation is no longer used by scripts, tests, or runtime
