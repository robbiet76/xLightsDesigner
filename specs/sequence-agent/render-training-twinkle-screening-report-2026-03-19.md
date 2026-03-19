## Twinkle Screening

Runs:
- `/tmp/render-training-twinkle-v1`
- `/tmp/render-training-twinkle-v1-rerun`
- `/tmp/twinkle-interactions-v1`

Machine-readable artifacts:
- [/tmp/render-training-twinkle-summary.v2.json](/tmp/render-training-twinkle-summary.v2.json)
- [/tmp/render-training-twinkle-intent-map.v1.json](/tmp/render-training-twinkle-intent-map.v1.json)
- [/tmp/twinkle-intent-eval.v1.json](/tmp/twinkle-intent-eval.v1.json)
- [/tmp/render-training-twinkle-interaction-intent-map.v1.json](/tmp/render-training-twinkle-interaction-intent-map.v1.json)
- [/tmp/twinkle-intent-eval.v2.json](/tmp/twinkle-intent-eval.v2.json)

Result:
- `20/20` packs passed on the refined rerun
- `0` failed
- dedicated retrieval eval:
  - `4/4` passed
- representative interaction packs:
  - `3/3` passed
  - `18/18` samples passed
- dedicated interaction retrieval eval:
  - `4/4` passed

Scope:
- geometries:
  - `single_line_horizontal`
  - `tree_360_round`
  - `tree_360_spiral`
  - `star_single_layer`
  - `spinner_standard`
- parameters:
  - `style`
  - `count`
  - `steps`
  - `strobe`

Impact counts:
- `high_impact_observed`: `10`
- `interaction_suspected`: `8`
- `context_flat_observed`: `2`

What is clearly learned:
- `count` is high-impact on every tested geometry.
- `steps` is high-impact on every tested geometry.
- `strobe` is consistently `interaction_suspected`.
  - it changes the structural family cleanly
  - but the evidence is still narrow and context-dependent
- `style` is `interaction_suspected` on:
  - `single_line_horizontal`
  - `tree_360_round`
  - `tree_360_spiral`
  - `spinner_standard`
- `style` is `context_flat_observed` on:
  - `star_single_layer`

Current structural families observed:
- horizontal line:
  - `linear_soft_twinkle`
  - `linear_dense_twinkle`
  - `linear_punchy_twinkle`
  - `linear_classic_twinkle`
- trees:
  - `soft_twinkle`
  - `dense_twinkle`
  - `punchy_twinkle`
  - `classic_twinkle`
- star / spinner:
  - `radial_soft_twinkle`
  - `radial_dense_twinkle`
  - `radial_punchy_twinkle`

Interaction families now observed:
- horizontal line:
  - `linear_restrained_twinkle`
  - `linear_soft_twinkle`
  - `linear_surging_twinkle`
  - `linear_strobe_twinkle`
  - `linear_classic_twinkle`
  - `linear_classic_random_twinkle`
- round tree:
  - `restrained_twinkle`
  - `soft_twinkle`
  - `surging_twinkle`
  - `strobe_twinkle`
  - `classic_twinkle`
  - `classic_random_twinkle`
- spinner:
  - `radial_restrained_twinkle`
  - `radial_soft_twinkle`
  - `radial_surging_twinkle`
  - `radial_strobe_twinkle`
  - `radial_classic_twinkle`
  - `radial_classic_random_twinkle`

Important refinement:
- the initial linear pass was too generic and inherited chase-like semantics
- the refined rerun corrected that
- line Twinkle is now effect-specific and no longer falls into:
  - `unclassified`
  - generic directional / bouncy labels

What this means:
- `Twinkle` is now structurally observable across the intended first-pass geometry set
- the most reliable early levers are:
  - density via `count`
  - cadence via `steps`
  - punch via `strobe`
- the effect is now structurally retrievable for constrained `Twinkle` requests built around:
  - soft restrained twinkle
  - dense twinkle
  - punchy radial twinkle
  - classic linear twinkle
  - restrained linear twinkle
  - surging tree twinkle
  - rerandomized classic radial twinkle

What is not mature enough yet:
- `Twinkle` is not ready for the selector stack yet
- effect-local retrieval works
- cross-effect routing does not yet have enough evidence that Twinkle semantics are calibrated against:
  - `Shimmer`
  - `Shockwave`
  - the mature Stage 1 selector set
- broader designer language is still too open-ended for promotion

Recommended next work on `Twinkle`:
1. deepen interaction semantics:
   - `count` + `steps`
   - `strobe` + geometry
   - `style` + geometry
2. validate whether `Twinkle` can be contrasted cleanly against existing selector effects
3. only then consider selector or vocabulary promotion

Current maturity recommendation:
- `execution_ready`: yes
- `structurally_observable`: yes
- `structurally_retrievable`: yes
- `selector_ready`: no
- `designer_language_candidate`: no
