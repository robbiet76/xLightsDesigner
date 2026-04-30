# Project Storage

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: root-level project storage layout proposal

## Purpose

Define the canonical on-disk storage model for xLightsDesigner project data.

The app should keep xLightsDesigner-owned data under an app-managed project root while referencing xLights show folders, sequence files, and media files in place.

## User-Facing Terms

- `Project`: user-facing xLightsDesigner workspace.
- `App root`: user-selected xLightsDesigner storage root.
- `Project root`: app-managed folder for one project under the app root.
- `showFolderPath`: referenced xLights show folder.
- `mediaPath`: referenced default media root or media file.

The UI should use `Project` for the workspace concept. Internal storage terms should not leak into normal user flows.

## Canonical App Root

Users choose the app root location. Everything below it is app-managed.

```text
<app-root>/
  projects/
  library/
    tracks/
  diagnostics/
  cache/
```

Referenced xLights and media paths may point anywhere on disk. xLightsDesigner does not own those directories.

## Project Layout

Project files live under:

```text
<app-root>/projects/<project-name>/
  <project-name>.xdproj
  sequencing/
    sequences/
      <sequence-id>/
        sequence.xdmeta
        draft.json
        handoffs.json
        ownership.json
        apply-history.jsonl
        verification.json
  artifacts/
    visual-design/
      <sequence-id-or-song-id>/
        visual-design-manifest.json
        inspiration-board.png
        images/
        videos/
        thumbnails/
  diagnostics/
```

Project folder name and `.xdproj` filename must match the project name.

Minimum `.xdproj` fields:

- `projectName`
- `showFolderPath`
- `mediaPath`
- `snapshot`

`showFolderPath` and `mediaPath` are references only.

## Ownership

`audio_analyst` owns shared reusable track records under:

- `<app-root>/library/tracks/*.json`

Track records are keyed by content identity and can be reused across projects.

`sequence_agent` owns project-specific sequencing state under:

- `<project-root>/sequencing/sequences/<sequence-id>/`

Designer-owned visual inspiration boards, palettes, and generated media asset packs live under:

- `<project-root>/artifacts/visual-design/`

## Identity

Stable identifiers:

- `contentFingerprint`: full media file content hash; canonical cross-project track identity.
- `mediaId`: normalized media path plus file metadata; locator for a specific file instance.
- `sequenceId`: normalized sequence path; project-local sequencing state key.
- display/model metadata fingerprints: durable target identity for retaining user metadata when show folders or layouts change.

## Project Migration

Creating a new project from an existing project should copy the project metadata into the new project folder.

Creating a new project without migration starts with blank project metadata. Users may manually import or copy metadata files when they intentionally want to reuse mature metadata outside the app migration flow.

Display metadata records are retained by fingerprint and are not deleted automatically when a show folder changes.

## Rename And Validation Rules

- Project names must be unique within `<app-root>/projects/`.
- xLightsDesigner sanitizes invalid filesystem characters in project names.
- Project rename is supported only through xLightsDesigner and must rename the project folder and `.xdproj` file together.
- Manual renaming or moving inside the app root is unsupported.
- Project open should validate that the selected file lives at `<app-root>/projects/<project-name>/<project-name>.xdproj`.
- Missing standard subdirectories may be recreated by the app.

## Shared Track Record Contract

Shared reusable track records live at:

- `<app-root>/library/tracks/<track-slug>.json`

Filename rules:

- use corrected song and artist naming when verified, such as `candy-cane-lane-sia.json`
- use a short temporary id when verified naming is unavailable
- append a short stable fingerprint suffix only when a slug collides with a different track identity

Minimum structure:

```json
{
  "version": 2,
  "track": {
    "title": "Candy Cane Lane",
    "artist": "Sia",
    "displayName": "Candy Cane Lane - Sia",
    "identity": {
      "contentFingerprint": "sha256-or-hex-fingerprint",
      "isrc": null
    },
    "verification": {
      "status": "verified",
      "basis": ["provider_metadata", "embedded_tags"]
    },
    "sourceMedia": {
      "mediaId": "path-instance-id",
      "path": "/absolute/path/to/media.mp3",
      "durationMs": 180000
    }
  },
  "analysis": {
    "canonicalProfile": "deep",
    "availableProfiles": ["fast", "deep"]
  },
  "timingTracks": [
    {
      "type": "song_structure",
      "name": "XD: Song Structure",
      "coverageMode": "complete",
      "segments": [
        {
          "startMs": 0,
          "endMs": 12400,
          "label": "Intro",
          "kind": "section"
        }
      ]
    }
  ],
  "analyses": {
    "canonicalProfile": "deep",
    "profiles": {
      "deep": {}
    }
  }
}
```

Canonical timing-track names:

- `XD: Song Structure`
- `XD: Phrase Cues`
- `XD: Beats`
- `XD: Bars`
- `XD: Chords`

Sequence metadata should link to shared track records by fingerprint instead of duplicating the full record.

## Storage Policy

- Keep all xLightsDesigner metadata under the app root.
- Keep shared analysis under `library/tracks/`.
- Keep sequence-specific metadata under `sequencing/sequences/<sequence-id>/`.
- Do not write app metadata into the xLights show folder unless xLights itself requires a controlled operation.
- Do not maintain old and new metadata locations at the same time during initial product development.
