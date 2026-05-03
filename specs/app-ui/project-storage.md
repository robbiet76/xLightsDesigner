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
  display/
    metadata.json
    model-index.json
    reconciliation.json
    target-behavior.json
    discovery.json
  sequences/
    <sequence-id>/
      sequence.json
      current-context.json
      revision-feedback.json
      visual-design/
      references/
  artifacts/
    intent-handoffs/
    sequencing-design-handoffs/
    proposals/
    plans/
    apply-results/
    render-observations/
    render-critique-contexts/
    visual-design/
      <sequence-id-or-song-id>/
        visual-design-manifest.json
        inspiration-board.png
        images/
        videos/
        thumbnails/
    backups/
    history/
  sequencing/
    sequences/
      <legacy-sequence-id>/
        sequence.xdmeta
  diagnostics/
```

Project folder name and `.xdproj` filename must match the project name.

Minimum `.xdproj` fields:

- `projectName`
- `showFolder` or `showFolderPath`
- `mediaPath`
- `snapshot`

`showFolder`/`showFolderPath` and `mediaPath` are references only. They do not define project identity.

## Ownership

`audio_analyst` owns shared reusable track records under:

- `<app-root>/library/tracks/*.json`

Track records are keyed by content identity and can be reused across projects.

`sequence_agent` owns project-specific sequencing state under:

- `<project-root>/sequences/<sequence-id>/`

Legacy sidecars may still be read from `<project-root>/sequencing/sequences/<legacy-sequence-id>/` while product data is moved into the canonical `sequences/` domain.

Designer-owned visual inspiration boards, palettes, and generated media asset packs live under:

- `<project-root>/artifacts/visual-design/`

## Identity

Stable identifiers:

- `contentFingerprint`: full media file content hash; canonical cross-project track identity.
- `mediaId`: normalized media path plus file metadata; locator for a specific file instance.
- `projectId`: stable project identity derived from the project name at creation and preserved across show-folder relinks.
- `sequenceId`: project-local sequence state key. Prefer sequence content fingerprint or track/content identity when available; fall back to normalized sequence path only when no stronger identity exists.
- display/model metadata fingerprints: durable target identity for retaining user metadata when show folders or xLights layouts change.
- display/target behavior learning: project-local observations about how effects render on specific model and submodel fingerprints.

Project identity must not be derived from the current show folder. Changing `showFolder` inside a project is a linkage update, not a new project.

Sequence records must carry source linkage:

- current `sequencePath`
- `showFolderAtLastUse`
- media/track fingerprint
- sequence/content fingerprint when available
- prior sequence paths
- availability status

When the show folder changes, sequence records are re-evaluated by identity. Matching sequences are reattached and keep their project-owned state. Missing sequences become inactive/unavailable; they are not deleted.

The model fingerprint and reconciliation contract is defined in `../sequence-agent/model-metadata.md`.

Project-local target behavior learning belongs under `display/target-behavior.json`. Records are keyed by target or submodel fingerprint plus effect/probe scope, not only by the current xLights name. This file should migrate with a project and should not be replaced by central training packages; shared training may provide priors, while this file preserves observations from the user's own display.

`display/model-index.json` is the project-local structural target index generated from xLights layout refresh. Runtime scene graphs should enrich `sceneGraph.submodelsById` from this model index before planning, review, render validation, or automation diagnostics. That lets transient scene data keep live membership/render-policy details while target identity, parent relationships, fingerprints, node coverage, sibling context, and structure hints come from one canonical project artifact.

The model-index schema preserves both raw xLights type labels and normalized canonical types. For example, `identity.rawType` may be `Custom` while `identity.canonicalType` is `custom`. Consumers should key app reasoning from the normalized canonical field and keep the raw field for diagnostics and user-facing traceability.

## Project Migration

Creating a new project from an existing project should copy durable project knowledge into the new project folder. This includes:

- `display/metadata.json`
- `display/discovery.json`
- `display/target-behavior.json`
- project-level durable snapshot fields such as project brief, saved app design intent, project concept, and safety preferences

Migration should not copy regenerated or point-in-time state such as:

- `display/model-index.json`
- `display/reconciliation.json`
- active sequence paths
- recent sequence lists
- selected audio/media paths
- generated proposal, plan, apply, render, backup, diagnostics, or history artifacts

Creating a new project without migration starts with blank project metadata. Users may manually import or copy metadata files when they intentionally want to reuse mature metadata outside the app migration flow.

Display metadata records are retained by fingerprint and are not deleted automatically when a show folder changes.

Show-folder changes inside an existing project:

1. Update the project linkage (`showFolder`).
2. Regenerate derived display artifacts:
   - `display/model-index.json`
   - `display/reconciliation.json`
3. Preserve durable display artifacts:
   - `display/metadata.json`
   - `display/target-behavior.json`
   - `display/discovery.json`
4. Reconcile preserved display records by fingerprint first, then by target id/name only as lower-confidence hints.
5. Re-evaluate `sequences/<sequence-id>/sequence.json` records against the new show folder by sequence/content/track identity.
6. Mark unmatched display and sequence records inactive or orphaned instead of deleting them.
7. Invalidate active proposals/plans that were built against the previous display snapshot.

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
