# xLights Layering Render Order Audit

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Document the actual xLights render behavior for layering.

This spec exists because layering is one of the least intuitive parts of xLights for end users, and the translation layer cannot model same-structure interplay correctly without following the engine's real render order.

Primary rule:

- layering semantics must be derived from source code and rendered validation
- not from UI intuition alone
- not from effect metadata JSON

## Source Of Truth

There is no JSON metadata contract for layering logic equivalent to `resources/effectmetadata`.

Layering behavior is source-code-owned, mainly in:

- [Element.cpp](/Users/robterry/xLights-2026.06/src-core/render/Element.cpp)
- [EffectLayer.cpp](/Users/robterry/xLights-2026.06/src-core/render/EffectLayer.cpp)
- [RenderEngine.cpp](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp)
- [PixelBuffer.cpp](/Users/robterry/xLights-2026.06/src-core/render/PixelBuffer.cpp)

## Core Findings

### 1. Element Layer Order Is Vector Order

Each element owns an ordered `mEffectLayers` vector.

- `GetEffectLayer(index)` returns the layer at that position
- `AddEffectLayer()` appends a new layer to the end
- displayed layer number is `index + 1`

Refs:

- [Element.cpp:190](/Users/robterry/xLights-2026.06/src-core/render/Element.cpp:190)
- [Element.cpp:196](/Users/robterry/xLights-2026.06/src-core/render/Element.cpp:196)
- [Element.cpp:211](/Users/robterry/xLights-2026.06/src-core/render/Element.cpp:211)
- [Element.cpp:239](/Users/robterry/xLights-2026.06/src-core/render/Element.cpp:239)

Implication:

- layer numbering is stable positional order
- but positional order is not enough to predict final visual dominance

### 2. Same-Layer Ordering Is Time Selection, Not Stacking

Within one `EffectLayer`, effects are sorted by start time.
At render time, xLights selects the effect active at the current frame.

Refs:

- [EffectLayer.cpp:249](/Users/robterry/xLights-2026.06/src-core/render/EffectLayer.cpp:249)
- [EffectLayer.cpp:252](/Users/robterry/xLights-2026.06/src-core/render/EffectLayer.cpp:252)
- [RenderEngine.cpp:573](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:573)
- [RenderEngine.cpp:1053](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:1053)

Implication:

- simultaneous same-layer effect interaction is not the normal case
- layering concerns begin across layers, not inside one layer's ordinary time selection

### 3. Model Layers Render From Highest Index Down

For a model element, the render loop iterates:

- `for (int layer = numLayers - 1; layer >= 0; --layer)`

This is explicit in the frame processing loop.

Refs:

- [RenderEngine.cpp:568](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:568)
- [RenderEngine.cpp:846](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:846)

Implication:

- xLights does not process layer `0` upward in the main render path
- higher index layers are rendered first into their own buffers

### 4. Pixel Compositing Also Walks Highest Layer Down

Final pixel mixing in `GetMixedColor()` also iterates from highest valid layer down to lowest.

Refs:

- [PixelBuffer.cpp:1373](/Users/robterry/xLights-2026.06/src-core/render/PixelBuffer.cpp:1373)
- [PixelBuffer.cpp:1380](/Users/robterry/xLights-2026.06/src-core/render/PixelBuffer.cpp:1380)
- [PixelBuffer.cpp:1500](/Users/robterry/xLights-2026.06/src-core/render/PixelBuffer.cpp:1500)

Implication:

- the first valid layer encountered seeds the accumulated result
- lower layers then mix into that accumulated result
- the lower layer's mix settings govern how it combines with what is already above it

This is one of the main reasons layering is confusing to end users.

### 5. Each Layer Carries Its Own Blend And Render Settings

Layer behavior is not just “which layer number”.
Each layer has settings that affect how it participates in stacking:

- mix method
- mix threshold
- canvas flag
- persistent overlay
- transitions
- blur / zoom / rotation
- chroma / suppress / freeze
- brightness / hue / saturation / value / contrast

Ref:

- [PixelBuffer.cpp:2077](/Users/robterry/xLights-2026.06/src-core/render/PixelBuffer.cpp:2077)

Implication:

- final behavior is a function of layer order plus per-layer render settings
- layer number alone is not enough to infer layered outcome

### 6. There Is An Extra Blend Layer

`PixelBufferClass` allocates one extra layer slot beyond the model's effect layer count.

Refs:

- [RenderEngine.cpp:72](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:72)
- [RenderEngine.cpp:764](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:764)
- [PixelBuffer.cpp:922](/Users/robterry/xLights-2026.06/src-core/render/PixelBuffer.cpp:922)

This extra slot is used as a blend/input layer for existing sequence data and canvas-related preloading.

Implication:

- model-level output can include both model effect layers and an external blended source
- layering semantics are broader than the visible user effect rows

### 7. Canvas Layers Change Normal Layer Semantics

Canvas layers can preload lower-layer output into their own buffer before rendering.
They can also include selected lower layers and optionally the extra blend layer.

Refs:

- [RenderEngine.cpp:665](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:665)
- [RenderEngine.cpp:669](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:669)
- [RenderEngine.cpp:713](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:713)

Implication:

- canvas is not just another blend mode
- it alters the data entering the layer render buffer itself

### 8. Layering Extends Beyond Model Rows

For a given frame, xLights processes:

1. main model layers
2. submodel / strand layers
3. node-level layers

Those later passes write back into the same sequence output.

Refs:

- [RenderEngine.cpp:877](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:877)
- [RenderEngine.cpp:878](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:878)
- [RenderEngine.cpp:890](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:890)
- [RenderEngine.cpp:935](/Users/robterry/xLights-2026.06/src-core/render/RenderEngine.cpp:935)

Implication:

- same physical structure can be affected by:
  - model-level layers
  - submodel layers
  - strand layers
  - node layers
- layering cannot be modeled as only `targetId + layerIndex`

## Practical Taxonomy

The translation layer should treat layering as at least these cases:

1. `same_target_layer_stack`
- multiple layers on the same model row

2. `canvas_preload_stack`
- a canvas layer consuming lower layers and/or the blend layer

3. `parent_submodel_overlap`
- model-level render plus overlapping submodel or strand render

4. `strand_node_override`
- strand-level render plus node-level override

5. `same_target_transition`
- same target across time where the handoff itself affects readability

## Constraint For Our Observation Work

`layering_observation_v1` must not assume that:

- higher displayed layer number always means visual topmost dominance
- same-target layering can be inferred from `layerIndex` alone
- cross-model composition metrics say anything reliable about same-target layering quality

## Project Rule

For layering:

- source code defines the mechanics
- rendered proof defines the artistic read

Both are required.

## Immediate Next Step

Before implementing `layering_observation_v1`:

1. identify same-target placement groups from `effectPlacements`
2. classify each group into the taxonomy above
3. define the minimum render proof required for each taxonomy case
4. only then emit layering critique or scoring

Do not build layering heuristics on top of composition artifacts.
