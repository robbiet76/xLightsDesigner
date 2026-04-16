# Preview Scene Geometry v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the geometry artifact required to reconstruct preview-space scene frames outside xLights.

This artifact is the missing bridge between:
- authoritative xLights render output
- local preview-scene reconstruction for critique, learning, and future ML workflows

## References

- [sequencing-feedback-loop-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md)
- [preview-scene-reconstruction-architecture-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/preview-scene-reconstruction-architecture-2026-04-10.md)
- [xlights-2026-06-api-compatibility-matrix-2026-04-16.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/xlights-2026-06-api-compatibility-matrix-2026-04-16.md)
- [xlights-2026-06-api-migration-plan-2026-04-16.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/xlights-2026-06-api-migration-plan-2026-04-16.md)

## Core Decision

`preview_scene_geometry_v1` should be built as a composition artifact over the owned `layout.*` APIs.

It should not start as a completely separate bespoke export path if the current owned APIs can already provide the required truth.

Specifically, the current owned xLights API surface already includes:
- `layout.getScene`
- `layout.getModelGeometry`
- `layout.getModelNodes`
- `layout.getCameras`
- `layout.getModelGroups`
- `layout.getSubmodels`
- `layout.getSubmodelDetail`

So v1 should aggregate and normalize those sources into one portable artifact.

## Why This Artifact Exists

Raw `.fseq` is not enough for scene reconstruction.

To reconstruct preview-space frames outside xLights, we need a geometry artifact that joins:
- model identity
- node identity
- channel mapping
- preview-space coordinates
- model transforms
- grouping/view context
- camera context where relevant

That joined artifact is `preview_scene_geometry_v1`.

## Design Principles

### 1. Local-first, cloud-portable
The artifact must be easy to generate and store locally during the POC.
It must also be explicit and versioned so it can later be uploaded to centralized storage without redesign.

### 2. Geometry only
This artifact describes scene geometry and mapping.
It does not contain:
- user preferences
- critique outcomes
- render observations
- design judgments

Those belong in separate artifacts.

### 3. Stable composition boundary
The artifact should normalize xLights source data into a shell-neutral representation that does not force downstream systems to understand raw xLights API payload shapes.

### 4. Reusable across checkpoints
For a fixed layout, this artifact should be reusable across many render checkpoints until the underlying layout changes.

### 5. Layout-scoped cache
`preview_scene_geometry_v1` is a cached layout artifact, not a per-sequencing-pass artifact.

Normal sequencing flow should:
- build geometry once for the active layout snapshot
- reuse it across many sequencing checkpoints
- rebuild it only when the effective layout changes

## Artifact Scope

`preview_scene_geometry_v1` should describe the display scene in enough detail to support:
- preview frame reconstruction
- rasterization into images/tensors
- model- and family-level composition analysis
- later parity validation against xLights preview exports

## Suggested Source Data

The artifact should be built primarily from these owned xLights calls:

### Required
- `layout.getScene`
- `layout.getModelNodes`
- `layout.getCameras`

### Optional / enrichment
- `layout.getModelGroups`
- `layout.getSubmodels`
- `layout.getSubmodelDetail`

## Top-Level Shape

```json
{
  "artifactType": "preview_scene_geometry_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {
    "xlightsApiVersion": 2,
    "xlightsRevision": "string|null",
    "layoutRevisionToken": "string|null",
    "layoutName": "string|null",
    "showFolder": "string|null"
  },
  "scene": {
    "views": [],
    "displayElements": [],
    "cameras": [],
    "models": []
  }
}
```

## Required Top-Level Fields

### `artifactType`
Must be `preview_scene_geometry_v1`.

### `artifactVersion`
Integer version of this artifact contract.

### `createdAt`
Generation timestamp.

### `source`
Provenance for debugging and parity validation.

Recommended fields:
- `xlightsApiVersion`
- `xlightsRevision`
- `layoutRevisionToken`
- `layoutName`
- `showFolder`
- `generatedFromCommands[]`

`layoutRevisionToken` should be treated as the primary cache-validation key when available.

### `scene`
Portable scene geometry payload.

## Scene Payload

### `scene.views[]`
Normalized from `layout.getScene` / `layout.getViews`.

Each entry should include:
- `name`
- `members[]`
- `layoutGroup` if applicable

### `scene.displayElements[]`
Normalized from `layout.getScene` / `layout.getDisplayElements`.

Each entry should include:
- `id`
- `name`
- `type`
- `orderIndex`
- `parentId`

### `scene.cameras[]`
Normalized from `layout.getCameras`.

Each entry should include:
- `name`
- `type` (`2D|3D`)
- `isDefault`
- `position`
- `anglesDeg`
- `distance`
- `zoom`
- `pan`

This supports future camera-aware reconstruction.

### `scene.models[]`
Core geometry records.

Each model entry should include:
- `id`
- `name`
- `type`
- `displayAs`
- `layoutGroup`
- `groupNames[]`
- `renderLayout`
- `defaultBufferStyle`
- `availableBufferStyles[]`
- `transform`
- `dimensions`
- `bounds`
- `startChannel`
- `endChannel`
- `submodels[]`
- `nodes[]`

## Model Node Payload

Each `nodes[]` entry should include:
- `nodeId`
- `stringIndex`
- `channelStart`
- `channelCount`
- `coordCount`
- `coords[]`

Each `coords[]` entry should include:
- `coordIndex`
- `buffer`: `{ "x": number, "y": number }` when known
- `world`: `{ "x": number, "y": number, "z": number }` when known
- `screen`: `{ "x": number, "y": number, "z": number }` when known

### Minimum v1 requirement
For v1, each node must have enough information to join rendered channel output to preview-space location.

That means the minimum required tuple is:
- `nodeId`
- `channelStart`
- `channelCount`
- `coords[].screen`

Without this, local preview reconstruction is not possible.

## Channel Mapping Rule

The artifact must provide deterministic node-to-channel mapping.

For each node:
- `channelStart` must be explicit
- `channelCount` must be explicit

Downstream systems must not be forced to infer channel layout from model type alone.

## Bounds Rule

Each model should provide a normalized `bounds` object where derivable.

Suggested shape:
```json
{
  "min": { "x": 0, "y": 0, "z": 0 },
  "max": { "x": 0, "y": 0, "z": 0 },
  "center": { "x": 0, "y": 0, "z": 0 }
}
```

This is useful for:
- focal weighting
- model overlap reasoning
- raster framing
- scene balance analysis

## Submodel Handling

Submodels should be represented as references first, not duplicated as separate model records in v1.

Each model may include:
- `submodels[]` with:
  - `id`
  - `name`
  - `type`
  - `nodeRefs[]`
  - optional `bounds`

Rule:
- node/channel ownership remains with the parent model
- submodels reference subsets of that structure

This avoids duplication and drift.

## Camera Policy

v1 should preserve camera metadata even if first-pass reconstruction uses only a default or 2D-oriented view.

Reason:
- camera handling is already relevant in xLights render buffer and preview logic
- camera-aware reconstruction will likely matter for parity later

## Layout Change Policy

`preview_scene_geometry_v1` is valid only until layout structure changes materially.

The artifact should be regenerated when:
- model positions change
- model dimensions/rotations/scales change
- node mapping changes
- group/submodel membership changes
- camera/view definitions change

Operational cache rule:
- do not regenerate geometry by default during sequencing
- compare the cached artifact against the current layout saved-state signal or `layoutRevisionToken`
- regenerate only when that comparison shows the cached geometry is stale

## Relationship To Other Artifacts

### Produces inputs for
- `preview_scene_frame_v1`
- `preview_scene_tensor_v1`
- `render_observation_v1`

### Must remain separate from
- `sequence_critique_v1`
- `sequence_learning_record_v1`
- user preference/profile artifacts

Reason:
- geometry truth is shared structural context
- critique and preference are not

## Validation Rules

A valid `preview_scene_geometry_v1` artifact must:
- include at least one model
- include deterministic node/channel mappings for reconstructable models
- include screen coordinates for reconstructable nodes
- include camera metadata when available
- include provenance fields tying the artifact to the xLights source/layout state

## Recommended Generation Flow

1. call `layout.getScene`
2. for each model, call `layout.getModelNodes`
3. optionally enrich with submodel/group detail
4. normalize into one artifact
5. compute bounds and compact summaries
6. persist locally for reuse across render checkpoints

## POC Recommendation

For the POC, `preview_scene_geometry_v1` should be generated:
- once per layout snapshot
- cached locally
- reused across many render checkpoints

This minimizes pressure on xLights while enabling local reconstruction.

## Recommendation

Proceed with `preview_scene_geometry_v1` as the next concrete implementation contract.

It should be:
- local-first
- built over the existing owned `layout.*` APIs where possible
- portable for future cloud upload
- strictly structural, with no user preference or critique content mixed in
