# xLights Effect Support Audit

Date: `2026-03-17`

Scope:
- full live audit of the xLights `effects.listDefinitions` / `effects.getDefinition` catalog
- classification of every current xLights effect against the placement-first designer-to-sequencer model
- explicit support boundary for what is already mapped, what is safe to map next, and what requires specialized work

## Summary

Live xLights catalog count:
- `56` effects

All current catalog entries reported category:
- `general`

This audit does **not** claim all 56 effects are fully supported.
It classifies them into:
- `Tier 1`: placement-first mapped in code and live spot-validated
- `Tier 2`: placement-first mapped in code, but not yet live spot-validated in this pass
- `Tier 3`: structurally possible, but requires family-specific semantic mapping before we should advertise support
- `Tier 4`: specialized / external-input / hardware / media-driven effects that should stay outside the generic designer intent model unless we build dedicated handling

## Tier 1

These effects are already on the correct model boundary:
- designer can express exact placements plus intent
- sequencer translates that intent into raw xLights fields
- live owned-API apply/readback has been validated

Effects:
- `Color Wash`
- `Shimmer`
- `Bars`
- `Butterfly`
- `Meteors`
- `Pinwheel`
- `Spirals`

Notes:
- `Color Wash`, `Shimmer`, and `Bars` were validated in earlier owned apply and app-driven passes.
- `Butterfly`, `Meteors`, `Pinwheel`, and `Spirals` were validated directly through owned `effects.applyBatch` in this audit pass.

## Tier 2

These effects are mapped into the current capability / translation structure and fit the placement-first model, but they still need live spot validation before we should call them production-ready.

Effects:
- `On`
- `Circles`
- `Curtain`
- `Fan`
- `Fire`
- `Morph`
- `Snowflakes`
- `VU Meter`

Why they are Tier 2:
- their live xLights parameter shapes fit the current taxonomy well enough to map into:
  - `settingsIntent`
  - `paletteIntent`
  - `layerIntent`
  - `renderIntent`
- but we have not yet live-validated each family through owned apply/readback in this pass

## Tier 3

These effects are not blocked by architecture, but they need dedicated semantic mapping work before they are safe to expose as generic designer-authored placement families.

Effects:
- `Adjust`
- `Candle`
- `Duplicate`
- `Fill`
- `Fireworks`
- `Galaxy`
- `Garlands`
- `Kaleidoscope`
- `Lightning`
- `Lines`
- `Liquid`
- `Marquee`
- `Plasma`
- `Ripple`
- `Shockwave`
- `SingleStrand`
- `Snowstorm`
- `Spirograph`
- `State`
- `Strobe`
- `Tendril`
- `Tree`
- `Twinkle`
- `Warp`
- `Wave`

Why they are Tier 3:
- they are visual effect families that can still fit the placement model
- but their real parameter surfaces are more specialized than the current generic intent taxonomy
- many need dedicated treatment for things like:
  - geometry
  - particle count vs density
  - procedural mode selection
  - special enum semantics
  - family-specific motion concepts

Practical rule:
- do not advertise generic designer support for these yet
- add them family by family with real semantic mapping and live validation

## Tier 4

These effects should not be handled as generic placement-first designer effects without dedicated workflows or separate contract branches.

Effects:
- `Off`
- `DMX`
- `Faces`
- `Glediator`
- `Guitar`
- `Life`
- `Moving Head`
- `Music Effect`
- `Piano`
- `Pictures`
- `Servo`
- `Shader`
- `Shape`
- `Sketch`
- `Text`
- `Video`

Why they are Tier 4:
- hardware-channel oriented:
  - `DMX`
  - `Moving Head`
  - `Servo`
- media/file driven:
  - `Glediator`
  - `Pictures`
  - `Shader`
  - `Sketch`
  - `Text`
  - `Video`
- domain-specific performance / notation / character systems:
  - `Faces`
  - `Guitar`
  - `Piano`
  - `Music Effect`
- simulation/stateful/specialized systems:
  - `Life`
  - `Shape`
- control semantics, not normal visible placement:
  - `Off`

These require dedicated product decisions, not just more translation rules.

## Raw Catalog Notes

The live catalog showed several clear risk markers:

Highest parameter count / complexity:
- `DMX`: `145` params
- `Liquid`: `72`
- `Shape`: `39`
- `Morph`: `35`
- `Fan`: `30`
- `Ripple`: `28`
- `Moving Head`: `28`

File-backed families:
- `Glediator`
- `Ripple`
- `Shader`
- `Shape`
- `Sketch`
- `Text`
- `Video`
- `VU Meter`

Hardware / device-driven families:
- `DMX`
- `Moving Head`
- `Servo`

Audio-reactive / track-reactive families:
- `VU Meter`
- `Music Effect`
- some optional reactive controls in:
  - `Fire`
  - `Meteors`

## Current Implementation Boundary

Correct current claim:
- the placement-first contract is in place
- the sequencer translation layer is working
- support is real for Tier 1
- support is structurally present but not yet fully proven for Tier 2

Incorrect claim:
- that the designer can now safely author all xLights effects through one generic intent schema

That would be false.

## Recommended Expansion Order

1. Finish Tier 2 live validation
- `On`
- `Circles`
- `Curtain`
- `Fan`
- `Fire`
- `Morph`
- `Snowflakes`
- `VU Meter`

2. Add Tier 3 families in subgroups
- motion / geometric families:
  - `Lines`
  - `Marquee`
  - `Shockwave`
  - `Wave`
  - `Warp`
- procedural texture families:
  - `Galaxy`
  - `Plasma`
  - `Twinkle`
  - `Snowstorm`
  - `Fireworks`
- specialized string / tree families:
  - `SingleStrand`
  - `Garlands`
  - `Tree`

3. Leave Tier 4 behind dedicated feature gates
- do not force them into the generic designer placement contract

## Decision

From this point forward:
- timing sections remain reference/alignment only
- effect placements remain the execution unit
- the designer may only author families that are at least Tier 1 or explicitly promoted from Tier 2 after live validation

That is the safe line.
