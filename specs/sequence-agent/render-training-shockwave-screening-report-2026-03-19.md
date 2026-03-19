## Shockwave Screening

Run:
- `/tmp/render-training-shockwave-v1`

Machine-readable summary:
- [/tmp/render-training-shockwave-summary.v1.json](/tmp/render-training-shockwave-summary.v1.json)

Result:
- `25/25` packs passed
- `0` failed

Scope:
- geometries:
  - `tree_flat_single_layer`
  - `tree_360_round`
  - `tree_360_spiral`
  - `star_single_layer`
  - `spinner_standard`
- parameters:
  - `cycles`
  - `centerX`
  - `startRadius`
  - `endRadius`
  - `blendEdges`

Impact counts:
- `high_impact_observed`: `18`
- `context_flat_observed`: `7`

What is clearly learned:
- `centerX` is high-impact on every tested geometry.
- `startRadius` is high-impact on every tested geometry.
- `endRadius` is high-impact on every tested geometry.
- `cycles` is high-impact on:
  - `tree_flat_single_layer`
  - `tree_360_round`
  - `tree_360_spiral`
- `cycles` was context-flat on:
  - `star_single_layer`
  - `spinner_standard`
- `blendEdges` was context-flat on every tested geometry in this first pass.

Current structural families observed:
- flat / round tree:
  - `shockwave_ring`
  - `expanding_shockwave`
  - `offcenter_shockwave`
- spiral tree:
  - `helical_shockwave`
- star / spinner:
  - `radial_shockwave`
  - `offcenter_radial_shockwave`

What this means:
- the effect is already structurally observable across the intended first-pass geometry set
- geometry coupling is real and should remain part of the early policy for `Shockwave`
- center placement and radius controls are the primary early levers

What is not mature enough yet:
- intent semantics are still too coarse for promotion into the selector stack
- labels such as:
  - `busy`
  - `restrained`
  - `sparse`
  - `steady`
  are showing up too broadly to support useful effect routing
- `Shockwave` should stay out of:
  - the controlled designer vocabulary layer
  - the structural effect selector
  until the semantic layer is sharper

Recommended next work on `Shockwave`:
1. strengthen geometry-aware semantics:
   - centered vs offset confidence
   - ring compactness
   - expansion span
   - edge hardness / softness
   - radial symmetry quality
2. add the next likely high-value controls:
   - `centerY`
   - width controls
   - acceleration
3. only then consider selector or vocabulary promotion

Current maturity recommendation:
- `execution_ready`: yes
- `structurally_observable`: yes
- `structurally_retrievable`: not yet
- `selector_ready`: no
- `designer_language_candidate`: no

