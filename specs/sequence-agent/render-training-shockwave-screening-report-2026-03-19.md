## Shockwave Screening

Runs:
- `/tmp/render-training-shockwave-v1-rerun`
- `/tmp/render-training-shockwave-v2`
- `/tmp/shockwave-interactions-v1`
- `/tmp/shockwave-interactions-v2`
- `/tmp/priority-effect-selection-eval.v7.json`

Machine-readable summary:
- [/tmp/render-training-shockwave-summary.v3.json](/tmp/render-training-shockwave-summary.v3.json)

Result:
- `45/45` packs passed
- `0` failed
- representative interaction packs:
  - `3/3` passed
  - `18/18` samples passed
- dedicated retrieval eval:
  - `/tmp/shockwave-intent-eval.v3.json`
  - `4/4` passed
- selector eval in the current merged selector set:
  - `/tmp/priority-effect-selection-eval.v7.json`
  - `3` Shockwave-selected cases passed

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
  - `centerY`
  - `startRadius`
  - `endRadius`
  - `startWidth`
  - `endWidth`
  - `accel`
  - `blendEdges`

Impact counts:
- `high_impact_observed`: `40`
- `interaction_suspected`: `5`

What is clearly learned:
- `centerX` is high-impact on every tested geometry.
- `centerY` is high-impact on every tested geometry.
- `startRadius` is high-impact on every tested geometry.
- `endRadius` is high-impact on every tested geometry.
- `startWidth` is high-impact on every tested geometry.
- `endWidth` is high-impact on every tested geometry.
- `accel` is high-impact on every tested geometry.
- `cycles` is high-impact on every tested geometry after the refined semantic pass.
- `blendEdges` is now consistently `interaction_suspected` on every tested geometry.
  - it is not globally flat
  - it appears to matter in combination with width and ring-shape choices

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
- center placement, radius controls, width controls, and acceleration are all real early levers
- `blendEdges` should stay in the effect model as an interaction-sensitive control, not a low-value control
- the effect is now structurally retrievable for constrained `Shockwave` requests built around:
  - diffuse
  - crisp
  - compact
  - centered fill
  - offset directional

Interaction-set result:
- the representative interaction set cleanly preserved:
  - center placement
  - span size
  - width class
  - edge hardness
  - acceleration class
- these are now visible in:
  - `patternSignals`
  - observation labels
- but several paired cases still share the same:
  - high-level intent bucket
- after the semantic refinement pass, the interaction set now exposes distinct semantic families such as:
  - `diffuse_shockwave`
  - `crisp_shockwave`
  - `compact_shockwave_ring`
  - `helical_diffuse_shockwave`
  - `helical_crisp_shockwave`
  - `radial_diffuse_shockwave`
  - `radial_crisp_shockwave`
- example:
  - wide soft centered round-tree ring now maps to `diffuse_shockwave`
  - thin hard centered round-tree ring now maps to `crisp_shockwave`
  - compact decelerating ring now maps to `compact_shockwave_ring`

What is not mature enough yet:
- broader designer language remains too coarse for promotion
- selector support is now justified only for the current merged selector set
- this does not yet imply global effect routing across all effects

Recommended next work on `Shockwave`:
1. strengthen geometry-aware semantics:
   - centered vs offset confidence
   - ring compactness
   - expansion span
   - edge hardness / softness
   - radial symmetry quality
2. strengthen interaction semantics:
   - width + blendEdges
   - radius span + acceleration
   - center placement + geometry
3. broaden calibration before claiming wider selector coverage or controlled-vocabulary readiness

Current maturity recommendation:
- `execution_ready`: yes
- `structurally_observable`: yes
- `structurally_retrievable`: yes
- `selector_ready`: yes, for the current merged selector set
- `designer_language_candidate`: no
