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
Recommended layout under project root:

```text
<app-root>/
  projects/
    <project-name>/
      <project-name>.xdproj
      analysis/
        media/
          <media-id>/
            analysis.json
            beats.json
            bars.json
            sections.json
            lyrics.json
            chords.json
            provenance.json
      sequencing/
        sequences/
          <sequence-id>/
            draft.json
            handoffs.json
            ownership.json
            apply-history.jsonl
            verification.json
      diagnostics/
  diagnostics/
    orchestration/
    agent-runs/
  cache/
```

Top-level meanings:
- `<app-root>/projects/`: project-owned workspaces.
- `<project>/analysis/`: audio-analysis artifacts owned by `audio_analyst`.
- `<project>/sequencing/`: sequence-specific runtime/planning state owned by `sequence_agent`.
- `<project>/diagnostics/`: project-scoped debugging and run artifacts.
- `<app-root>/diagnostics/`: optional shared/global diagnostics.
- `<app-root>/cache/`: optional shared/global cache.

## 6) Ownership Rules
`audio_analyst` owns:
- analysis artifacts under `analysis/media/<media-id>/`
- no awareness of live xLights state
- no timing-track writes

`sequence_agent` owns:
- timing ownership and sequencing state under `sequencing/sequences/<sequence-id>/`
- xLights mutations
- user/manual track preservation logic

## 7) Identity Rules
Suggested stable ids:

### `media-id`
Derived from:
- normalized media path
- file metadata such as mtime/size

### `sequence-id`
Derived from:
- normalized sequence path

These ids are project-local keys for organizing artifacts and runtime state.

## 8) Naming And Rename Rules
- Project names are user-facing and must be unique within `<app-root>/projects/`.
- xLightsDesigner sanitizes invalid filesystem characters in project names.
- Project folder names are human-readable and derived from the project name.
- Project rename is supported only through xLightsDesigner and must rename the project folder and `.xdproj` file together.
- Manual renaming or moving of files/folders inside the app root is unsupported.

## 9) Migration Direction
Current sequence-adjacent `.xdmeta` sidecars should be treated as transitional.

Migration target:
- move analysis artifacts out of sequence-adjacent storage,
- move sequence-agent runtime state into `sequencing/sequences/<sequence-id>/`,
- leave `showFolderPath` and `mediaPath` as references inside the project file.

## 10) Validation Rules
- Project open should validate that the selected file lives at `<app-root>/projects/<project-name>/<project-name>.xdproj`.
- Missing standard subdirectories (`analysis/`, `sequencing/`, `diagnostics/`) may be recreated by the app.
- Unexpected manual modifications to the internal directory layout are unsupported.

## 11) Immediate Implementation Guidance
Short-term:
1. persist `showFolderPath` and `mediaPath` in `.xdproj`,
2. introduce canonical project-root layout in code/specs,
3. enforce unique project names on create/save-as/rename,
4. keep compatibility readers for old sidecar locations,
5. migrate writes gradually to project-root storage.

Long-term:
1. remove sequence-adjacent sidecar writes,
2. make project-root storage canonical for all xLightsDesigner support data.
