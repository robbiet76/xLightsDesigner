# xLights Rendering Audit

Status: Active
Date: 2026-03-18
Owner: xLightsDesigner Team

Purpose: audit how xLights rendering is actually implemented so sequencer training can decide whether to use xLights itself as the render backend or attempt to replicate effect logic in a separate training renderer.

## Source Audited

Primary upstream source:
- xLights GitHub repository
- shallow source audit against commit `ec4a7c5`

Files inspected directly:
- `xLights/effects/RenderableEffect.h`
- `xLights/effects/RenderableEffect.cpp`
- `xLights/effects/EffectManager.cpp`
- `xLights/RenderBuffer.h`
- `xLights/RenderCache.h`
- `xLights/RenderCache.cpp`
- `xLights/effects/OnEffect.cpp`
- `xLights/effects/SingleStrandEffect.cpp`

## Core Rendering Architecture

xLights rendering is effect-driven, not declarative.

The important architectural shape is:
1. each effect is its own C++ class derived from `RenderableEffect`
2. each effect implements its own custom `Render(...)`
3. `Render(...)` writes pixels into a shared `RenderBuffer`
4. settings are read from `SettingsMap`
5. time-varying settings are resolved through value-curve helpers such as:
   - `GetValueCurveInt(...)`
   - `GetValueCurveDouble(...)`
6. palette logic, gradient logic, spatial-color logic, and display-list caching are all part of the runtime behavior

This is not a thin parameter-to-shader system.
It is a family of hand-authored renderers sharing common infrastructure.

## What That Means

If we want faithful training data, the authoritative renderer is xLights itself.

Trying to reimplement the renderer for training would mean recreating:
- effect-specific render algorithms
- palette behavior
- spatial/radial color behavior
- time interpolation
- value-curve evaluation
- buffer semantics
- cache behavior where relevant
- model/render-layout interactions

That is much larger than a simple “headless preview” problem.

## Scale Snapshot

Line counts from the upstream source audit:
- `xLights/effects/SingleStrandEffect.cpp`: `860`
- `xLights/effects/OnEffect.cpp`: `289`
- `xLights/RenderBuffer.cpp`: `1725`
- `xLights/RenderBuffer.h`: `617`
- `xLights/effects/RenderableEffect.cpp`: `1103`
- `xLights/effects/RenderableEffect.h`: `197`
- `xLights/effects/EffectManager.cpp`: `258`

Interpretation:
- even one “common” effect like `SingleStrand` is already nontrivial
- the shared rendering substrate is also substantial
- copying this logic for training would be expensive and likely drift from xLights quickly

## Effect Registration Model

`EffectManager.cpp` shows that xLights registers a large set of concrete effect classes, including:
- `OnEffect`
- `BarsEffect`
- `ColorWashEffect`
- `ShimmerEffect`
- `SingleStrandEffect`
- `WaveEffect`
- `MorphEffect`
- many others

Interpretation:
- the renderer is not generic in the way our current sequencer translator is generic
- effect semantics live in the per-effect C++ implementations

## `On` Rendering Findings

`OnEffect.cpp` is simple in product terms but not trivial in implementation terms.

Observed behavior:
- has its own explicit parameters for:
  - start level
  - end level
  - shimmer
  - cycles
  - transparency
- can behave as:
  - flat fill
  - brightness ramp across time
  - shimmer-alternating behavior
  - spatial/radial palette-driven fill
- uses palette logic and optional parallel filling across the buffer
- writes directly into the buffer or display-list cache depending on conditions

Interpretation:
- even `On` is not merely “all pixels on”
- it already contains time, transparency, shimmer, and spatial palette behavior

## `SingleStrand` Rendering Findings

`SingleStrandEffect.cpp` is a substantial specialized renderer.

Observed behavior:
- multiple major modes inside the same effect:
  - `Skips`
  - `FX`
  - `Chase`
- dedicated default parameters and upgrade logic for version migrations
- separate render paths:
  - `RenderSingleStrandSkips(...)`
  - `RenderSingleStrandFX(...)`
  - `RenderSingleStrandChase(...)`
- heavy use of:
  - value curves
  - direction mapping
  - grouping behavior
  - rotations
  - offsets
  - explicit pixel placement loops via `SetPixel(...)`

Interpretation:
- `SingleStrand` is exactly the kind of effect that should not be modeled by parameter-name heuristics alone
- it is too behavior-rich and too mode-dependent

## Render Cache Findings

xLights has a real render-cache system:
- `RenderCacheItem`
- per-effect caches
- sequence-scoped cache folders
- cache loading and persistence
- optional mmap usage on macOS

Interpretation:
- xLights already treats rendering cost as significant enough to justify caching
- this strengthens the case for using xLights as the training renderer and building a harness around it rather than cloning the logic

## Practical Conclusion

For sequencer training, the better architecture is:

1. xLights remains the authoritative renderer
2. our system generates controlled parameter sweeps
3. xLights renders them
4. we capture the outputs and settings
5. training/retrieval/scoring happens on top of those render artifacts

That is more practical than writing a second renderer.

## Recommendation

Recommended decision:
- do **not** build a separate replica of xLights effect logic as the primary training path
- use xLights itself as the backend render engine for training data generation

Possible exception:
- a lightweight surrogate renderer could exist later for coarse pre-filtering or offline approximation
- but it should not be the source of truth

## Scale Estimate For Training Harness Work

What we need to build is not a renderer clone.
It is a render orchestration and capture system.

That scope is much more reasonable:
1. define sweep manifests
2. apply effect/settings to controlled models
3. trigger xLights render/preview output
4. persist:
   - effect
   - settings
   - model/prop type
   - render artifact
   - metadata labels
5. score or compare outputs later

This is still meaningful work, but it is far smaller and safer than reimplementing xLights rendering behavior.

## Immediate Next Steps

1. identify the smallest viable render-capture path inside xLights
2. design a sweep manifest format for:
   - effect
   - prop class
   - selected settings dimensions
3. start with:
   - `On`
   - `SingleStrand`
4. keep the sequencer’s current schema-safe translator as the fallback write layer
5. build training on top of render artifacts, not on top of hand-authored guesses alone

## Bottom Line

xLights rendering is sophisticated enough that cloning it for training would be the wrong first move.

The right first move is:
- use xLights itself as the render backend
- build a controlled sweep/capture/training harness around it
