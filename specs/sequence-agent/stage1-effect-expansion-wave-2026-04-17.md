# Stage1 Effect Expansion Wave

Date: 2026-04-17

## Decision

Expand the Stage 1 effect scope from the current 10-effect baseline to an 18-effect working set.

## Expansion Wave

Add these 8 effects next:
- Butterfly
- Circles
- Fire
- Fireworks
- Lightning
- Snowflakes
- Strobe
- Wave

## Why These Effects

These effects are the best next wave because they are:
- backed by upstream `effectmetadata`
- visually rich enough to produce useful model-conditioned evidence
- not blocked on external media assets, text content, or hardware-specific semantics
- broad enough to justify another full training wave on the current geometry catalog

## Why These Effects Were Deferred

Not in this wave:
- hardware/special-device effects:
  - DMX
  - Moving Head
  - Servo
  - State
- asset/content-heavy effects:
  - Text
  - Pictures
  - Video
  - Faces
  - Piano
  - Music
- likely special-case or low-priority technical effects for this phase:
  - Duplicate
  - Glediator
  - Shader
- higher-complexity candidates better left for a later wave after this expansion stabilizes:
  - Ripple
  - Warp
  - Liquid
  - Morph
  - Shape
  - VU Meter

## Coverage Policy

Wave policy is now recorded directly in:
- [stage1-effect-model-scope.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/stage1-effect-model-scope.json)

Highlights:
- `Butterfly`, `Circles`, `Snowflakes`, `Strobe`, and `Wave` are set to `all_primary`
- `Fire`, `Fireworks`, and `Lightning` are set to `primary_plus_probe`
  - primary emphasis on tree/star/spinner/matrix-like surfaces
  - reduced probes on lower-value linear forms

## Operational Next Step

Use this expanded scope as the next training contract baseline.
Do not expand beyond this wave until:
- coverage is complete
- validation is clean
- the new effects have undergone the same cross-model analysis used for the original 10-effect set
