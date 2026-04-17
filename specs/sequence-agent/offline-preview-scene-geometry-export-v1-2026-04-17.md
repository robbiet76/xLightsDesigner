# Offline Preview Scene Geometry Export v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the first offline path for building `preview_scene_geometry_v1` directly from an xLights show folder without requiring a live xLights process.

This exporter exists to unblock:
- mature-sequence render audit on real production shows
- read-only whole-scene render reconstruction from `.fseq`
- offline validation of:
  - `render_observation_v1`
  - `composition_observation_v1`
  - `layering_observation_v1`
  - `progression_observation_v1`
  - `sequence_critique_v1`

## Source Files

Required show files:
- `xlights_rgbeffects.xml`
- `xlights_networks.xml`

The exporter must not require:
- an open sequence in xLights
- live `layout.*` API calls
- writes back into the source show folder

## Source of Truth

This exporter is grounded in:
- show XML structure in `xlights_rgbeffects.xml`
- controller/channel layout in `xlights_networks.xml`
- xLights source-code semantics for:
  - `CustomModel`
  - `Poly Line`
  - channel-start resolution

Relevant xLights source references:
- `src-core/XmlSerializer/XmlSerializeFunctions.cpp`
- `src-core/models/CustomModel.cpp`
- `src-core/models/PolyLineModel.cpp`
- `src-core/models/TreeModel.cpp`

## v1 Coverage Goal

Support the model families that dominate real production shows:
- `Single Line`
- `Poly Line`
- `Custom`
- `Horiz Matrix`
- `Tree 360`
- `Tree Flat`
- `Star`
- `Icicles`

## Export Contract

Output artifact:
- `preview_scene_geometry_v1`

Minimum required per-model fields:
- `id`
- `name`
- `type`
- `displayAs`
- `layoutGroup`
- `groupNames`
- `startChannel`
- `endChannel`
- `transform`
- `nodes`

Minimum required per-node fields:
- `nodeId`
- `stringIndex`
- `channelStart`
- `channelCount`
- `coords[]`

Minimum required per-coord fields:
- `world`
- `screen`
- optional `buffer`

## v1 Start-Channel Resolution

The exporter must resolve `StartChannel` from:
1. direct numeric absolute channels
2. controller references from `xlights_networks.xml`
3. model-to-model chained references found in `xlights_rgbeffects.xml`

The exporter is allowed to leave a model unsupported when the chain terminates in an unresolved alias that does not exist in either file.

## v1 Geometry Semantics

### Single Line
- build linear node placement from start anchor plus `X2/Y2/Z2`
- respect direction for node ordering

### Poly Line
- use `PointData`
- use `cPointData` when present for cubic curve segments
- sample nodes along the full path length
- respect direction for node ordering

### Custom
- parse `CustomModelCompressed` when present, otherwise `CustomModel`
- preserve multi-coordinate nodes
- use xLights custom-grid row/column/layer semantics
- place coordinates in centered local space before model transform

### Tree / Star / Icicles / Matrix
- v1 may use structurally faithful approximations derived from xLights attributes
- v1 is not required to be preview-pixel-identical
- v1 must still preserve node/channel ordering and overall scene placement well enough for audit use

## Known v1 Gap Boundary

v1 does not claim full preview parity.

Allowed v1 gaps:
- approximate screen geometry for some non-custom non-polyline families
- no camera export parity with live `layout.getScene`
- unresolved alias-style `StartChannel` references that are not declared in either show file

v1 is acceptable if it is:
- file-backed
- whole-scene capable
- channel/node-order trustworthy for the supported models
- good enough to start mature-sequence render audits honestly

## Enforcement Rule

If mature-sequence audits show incorrect scene reads due to geometry export error, the corrective action is:
- improve the offline geometry exporter

The corrective action is not:
- weaken the critique layer to fit incorrect geometry
