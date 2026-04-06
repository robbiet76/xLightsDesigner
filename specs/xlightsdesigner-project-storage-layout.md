# xLightsDesigner Project Storage Layout

Status: Proposed  
Date: 2026-03-11  
Owner: xLightsDesigner Team

## 1) Purpose
Define the canonical on-disk storage model for xLightsDesigner project data.

Goals:
- keep xLightsDesigner-owned files under a dedicated project root,
- reference xLights assets (`showFolderPath`, `mediaPath`, sequence paths) without storing support files beside them,
- separate analysis artifacts from sequencing/runtime state,
- support users with one show folder or many show folders across holidays and seasons.

## 2) Canonical Terms
- `Project`: user-facing xLightsDesigner workspace.
- `Project root`: directory chosen for the `.xdproj` file and xLightsDesigner support files.
- `showFolderPath`: referenced xLights show folder used for xLights operations and sequence discovery.
- `mediaPath`: referenced default media root or media reference path for analysis workflows.

User-facing terminology should remain `Project`.

## 3) Storage Anchor
Canonical storage anchor is the user-selected xLightsDesigner app root, not:
- the xLights show folder,
- the media directory,
- sequence-adjacent sidecars.

Recommended app-owned root example:
- `/Users/robterry/Documents/Lights/xLightsDesigner`

Recommended app-owned root layout:

```text
<app-root>/
  projects/
  library/
    tracks/
  diagnostics/
  cache/
```

Users choose only the app root location. Everything below that is app-managed and fixed.

Project files should be stored under:
- `<app-root>/projects/<project-name>/`

Referenced paths may point anywhere on disk.

## 4) Project File
Project file remains:
- `<app-root>/projects/<project-name>/<project-name>.xdproj`

Project folder name and `.xdproj` file name must match the project name.

Minimum project file fields:
- `projectName`
- `showFolderPath`
- `mediaPath`
- `snapshot`

`showFolderPath` and `mediaPath` are references only. xLightsDesigner does not own those directories.

## 5) Canonical Directory Layout
Recommended layout under app root:

```text
<app-root>/
  projects/
    <project-name>/
      <project-name>.xdproj
      sequencing/
        sequences/
          <sequence-id>/
            draft.json
            handoffs.json
            ownership.json
            apply-history.jsonl
            verification.json
      diagnostics/
  library/
    tracks/
      candy-cane-lane-sia.json
      grinch-song-a1b2c3d4.json
  diagnostics/
    orchestration/
    agent-runs/
  cache/
```

Top-level meanings:
- `<app-root>/projects/`: project-owned workspaces.
- `<app-root>/library/tracks/`: shared reusable audio-analysis records owned by `audio_analyst`.
- `<project>/sequencing/`: sequence-specific runtime/planning state owned by `sequence_agent`.
- `<project>/diagnostics/`: project-scoped debugging and run artifacts.
- `<app-root>/diagnostics/`: optional shared/global diagnostics.
- `<app-root>/cache/`: optional shared/global cache.

## 6) Ownership Rules
`audio_analyst` owns:
- shared track analysis records under `library/tracks/*.json`
- fingerprint-backed reusable identity across projects
- no awareness of live xLights state
- no timing-track writes

`sequence_agent` owns:
- timing ownership and sequencing state under `sequencing/sequences/<sequence-id>/`
- xLights mutations
- user/manual track preservation logic

## 7) Identity Rules
Suggested stable ids:

### `contentFingerprint`
Derived from:
- full media file content hash

This is the canonical cross-project track identity.

### `media-id`
Derived from:
- normalized media path
- file metadata such as mtime/size

This is a locator for the current file instance, not the canonical track identity.

### `sequence-id`
Derived from:
- normalized sequence path

This remains a project-local key for sequencing runtime state.

## 8) Naming And Rename Rules
- Project names are user-facing and must be unique within `<app-root>/projects/`.
- xLightsDesigner sanitizes invalid filesystem characters in project names.
- Project folder names are human-readable and derived from the project name.
- Project rename is supported only through xLightsDesigner and must rename the project folder and `.xdproj` file together.
- Shared track record filenames are human-readable lowercase slugs such as `candy-cane-lane-sia.json`.
- If a slug collides with a different track identity, append a short stable suffix such as `-a1b2c3d4`.
- Manual renaming or moving of files/folders inside the app root is unsupported.

## 9) Migration Direction
Current sequence-adjacent `.xdmeta` sidecars should be treated as transitional.

Migration target:
- move analysis artifacts into shared library storage under `library/tracks/`,
- move sequence-agent runtime state into `sequencing/sequences/<sequence-id>/`,
- leave `showFolderPath` and `mediaPath` as references inside the project file.

## 10) Validation Rules
- Project open should validate that the selected file lives at `<app-root>/projects/<project-name>/<project-name>.xdproj`.
- Missing standard subdirectories (`sequencing/`, `diagnostics/`, `library/tracks/`) may be recreated by the app.
- Unexpected manual modifications to the internal directory layout are unsupported.

## 11) Immediate Implementation Guidance
Short-term:
1. persist `showFolderPath` and `mediaPath` in `.xdproj`,
2. introduce canonical app-root library layout in code/specs,
3. enforce unique project names on create/save-as/rename,
4. keep compatibility readers for old sidecar locations and older project-local analysis storage,
5. migrate writes gradually to shared library storage.

Long-term:
1. remove sequence-adjacent sidecar writes,
2. keep reusable track analysis in the shared app library and project-specific sequencing state in project roots.
