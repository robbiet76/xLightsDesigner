# Preview Scene Geometry API Gap

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Capture the minimum owned xLights API changes required to make `preview_scene_geometry_v1` viable for local preview-scene reconstruction.

This is an implementation boundary note, not a new architecture direction.

## References

- [preview-scene-geometry-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/preview-scene-geometry-v1-2026-04-13.md)
- [sequencing-feedback-loop-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md)
- [xlights-sequencer-control-api-surface-contract.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/xlights-sequencer-control-api-surface-contract.md)
- [xlights-upstream-tracking-policy-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/xlights-upstream-tracking-policy-2026-04-13.md)

## Current Proof Result

The owned xLights `layout.*` surface is already sufficient to prove the spatial half of `preview_scene_geometry_v1`.

Confirmed from the active local xLights integration:
- `layout.getModelNodes` returns:
  - `nodeId`
  - `stringIndex`
  - `coords[].buffer`
  - `coords[].world`
  - `coords[].screen`
- `layout.getCameras` returns camera metadata when cameras are defined

That means:
- preview-space coordinates are already accessible
- model/node geometry does not need a new bespoke export path for the first proof

## Blocking Gaps

### 1. Deterministic node channel mapping is missing

`layout.getModelNodes` does not currently expose:
- `channelStart`
- `channelCount`

This is the main missing join key for:
- `.fseq` frame state
- rendered channel output
- local preview-scene reconstruction

Without these fields, downstream tooling cannot reliably map frame data back onto preview-space nodes.

### 2. `layout.getScene` currently requires an open sequence

`layout.getScene` currently calls `requireOpenSequence()`.

That is too strict for geometry bootstrap use cases.

Geometry should be retrievable when:
- the layout is open
- no sequence is open yet

For `preview_scene_geometry_v1`, the sequence should not be a required dependency unless the requested payload includes sequence-owned display state.

## Minimum Required API Changes

### Change A: extend `layout.getModelNodes`

Each node entry should include:

```json
{
  "nodeId": 1,
  "stringIndex": 1,
  "channelStart": 1234,
  "channelCount": 3,
  "coords": []
}
```

Rules:
- `channelStart` must be zero-based if it mirrors `ActChan`
- the response contract must document the indexing rule explicitly
- `channelCount` must reflect the actual channel width of that node, not a model-level guess

Likely implementation sources:
- `model->NodeStartChannel(nodeIndex)`
- `node->GetChanCount()`

This is preferred over forcing downstream consumers to infer channel layout from:
- model type
- string type
- channels-per-node defaults

### Change B: relax `layout.getScene`

Recommended rule:
- `layout.getScene` should be layout-driven, not sequence-driven

If some `displayElements` payload requires an open sequence, then either:
- return geometry/view/camera payload with `displayElements: []`, or
- add an option to omit sequence-owned fields without failing the whole call

The key requirement is:
- geometry bootstrap must not fail solely because no sequence is open

## Not Required For v1

These are useful later, but not required for the first proof:
- frame diff export
- sparse node-state stream
- preview framebuffer export
- local camera rasterization settings beyond the existing camera metadata
- sequence mutation metadata inside the geometry artifact

## Recommended POC Implementation Order

1. extend `layout.getModelNodes` with `channelStart` and `channelCount`
2. relax `layout.getScene` so geometry bootstrap does not require an open sequence
3. regenerate the canonical proof artifact
4. prove one local frame reconstruction from:
   - static geometry
   - authoritative rendered frame data

## Proof Tooling Status

Current local proof extractor:
- [export-preview-scene-geometry.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/export-preview-scene-geometry.mjs)

Current extractor behavior:
- skips aggregate model groups for the first proof
- records missing channel mapping as an explicit known gap
- falls back to lower-level calls when `layout.getScene` is unavailable

## Decision

The owned xLights API surface is close enough to proceed.

The first implementation pass should not invent a new export subsystem.

It should make two bounded changes:
- add node channel mapping to `layout.getModelNodes`
- stop requiring an open sequence for geometry-only scene bootstrap
