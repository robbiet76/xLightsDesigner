# Render Training Priority Effects Roadmap

System roadmap reference:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

## Goal
Prioritize effect expansion by:

1. designer usefulness
2. diversity of achievable looks
3. geometry sensitivity
4. interpretation value

Do not prioritize by implementation ease alone.

This roadmap applies inside Stage 1 of the broader render-training system:
- full single-effect understanding across the standard model set
- before layered-effect training begins

## Priority Order

### Tier 1
- `Bars`
- `Spirals`
- `Marquee`
- `Pinwheel`

Reason:
- broad practical sequencing use
- strong structural variation
- high expected information gain from parameter sweeps
- good coverage across canonical geometry profiles

Additional policy:
- `Bars`, `Marquee`, `Spirals`, and `Pinwheel` are complex effects
- complex effects require broader early testing before strong conclusions
- `Spirals` should be treated as a benchmark tree effect during Stage 1
- `Shockwave` is the next Stage 1 expansion target after the current Tier 1 set is fully covered

### Tier 2
- `Shockwave`
- `Twinkle`

Reason:
- high interpretability
- important designer-facing look families
- slightly narrower geometry usefulness than Tier 1, but still strong training value

### Tier 3
- `Shimmer`
- `On`

Reason:
- keep as calibration/control effects
- still useful for interpretation validation
- lower diversity of structural looks than Tier 1

## Immediate Expansion Policy

### Start with
- `Bars`
  - `single_line_horizontal`
  - `arch_single`
  - `tree_flat_single_layer`
  - `tree_360_round`
- `Spirals`
  - `tree_360_round`
  - `tree_360_spiral`
  - `star_single_layer`
- `Marquee`
  - `single_line_horizontal`
  - `arch_single`
  - `star_single_layer`
- `Pinwheel`
  - `star_single_layer`
  - `spinner_standard`
  - `tree_360_round`

### Defer until analyzer coverage is stronger
- `Shockwave` on matrix-heavy profiles
- `Pinwheel` on large matrix profiles
- `Twinkle` on dense matrix profiles

## First-Pass High-Impact Parameters

### Bars
- `direction`
- `barCount`
- `cycles`
- `highlight`
- `3D`
- `gradient`

### Spirals
- `count`
- `movement`
- `rotation`
- `thickness`
- `blend`
- `3D`

### Marquee
- `bandSize`
- `skipSize`
- `thickness`
- `speed`
- `reverse`

### Pinwheel
- `style`
- `arms`
- `thickness`
- `twist`
- `speed`
- `rotation`

### Shockwave
- `cycles`
- `centerX`
- `centerY`
- `startRadius`
- `endRadius`
- `blendEdges`

Current Stage 1 state:
- first broad-geometry screening completed on:
  - `tree_flat_single_layer`
  - `tree_360_round`
  - `tree_360_spiral`
  - `star_single_layer`
  - `spinner_standard`
- early result:
  - structurally observable
  - not yet structurally retrievable
  - not ready for selector promotion
- next work should deepen `Shockwave` semantics before it is added to the controlled vocabulary or selector layers

### Twinkle
- `style`
- `count`
- `steps`
- `strobe`

## Decision Rules

- Do not drop a parameter after one flat result.
- Record:
  - `high_impact_observed`
  - `context_flat_observed`
  - `interaction_suspected`
  - `under_sampled`
- Preserve diverse useful look regions rather than selecting a single best preset.
- Prefer shared/high-practical-value axes before obscure controls.
- For complex effects:
  - prefer broader geometry coverage earlier
  - treat early flat results as local/contextual by default
  - require more evidence before maturity promotion and before deprioritizing a control
