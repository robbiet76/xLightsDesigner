# Priority Effects Findings - 2026-03-19

Run bases:
- Bars/Spirals: `/tmp/render-training-priority-effects-v1`
- Marquee/Pinwheel clean: `/tmp/render-training-priority-effects-v2-clean`

## Scope
This report summarizes the current highest-value structural findings from the first four priority effects:
- Bars
- Spirals
- Marquee
- Pinwheel

The intent is not to select single best presets. The intent is to document:
- which parameters materially change the rendered look
- which settings appear flat only in a tested context
- which regions form distinct, reusable look families
- which settings still need richer interpretation before they can be mapped to designer language

## Bars

### Strong findings
- `direction` on `single_line_horizontal` is high-value and semantically clean.
  - Separate directional regions exist for `Left`, `Right`, `up`, `down`, `expand`, `compress`.
  - `expand` and `compress` now resolve to distinct pattern families:
    - `expanding_bars`
    - `compressing_bars`
- `barCount` on `tree_360_round` is high-impact.
  - Stable regions:
    - `1`
    - `2-3`
    - `4-5`
  - These correspond to:
    - single-bar banding
    - multi-bar banding
    - dense bar banding

### Lower-yield findings
- `cycles` on `single_line_horizontal` was only `context_flat_observed` in the tested context.
  - This should not be interpreted as globally unimportant.

### Current interpretation level
- Good enough to recognize directional vs expanding/compressing bar families.
- Not yet rich enough to attach deeper designer phrasing beyond broad structural terms.

## Spirals

### Strong findings
- `count` on `tree_360_round` is high-impact.
  - Stable regions:
    - `1`
    - `2`
    - `3`
    - `4-5`
- `tree_360_spiral` is not behaving like a generic `tree_360`.
  - Spiral geometry now resolves into a geometry-coupled family such as:
    - `helical_spiral_motion`

### Interaction findings
- `style`-type interpretations are still narrow and should remain `interaction_suspected` unless additional settings confirm the same shift.
- Spiral behavior is clearly geometry-sensitive, especially on spiral-configured trees.

### Current interpretation level
- Good enough to distinguish round-tree spiral motion from helical spiral motion.
- Still not rich enough to robustly express designer-level descriptors like “elegant helix” vs “dense candy-wrap spiral.”

## Marquee

### Strong findings
- `skipSize` is high-impact on both:
  - `single_line_horizontal`
  - `arch_single`
- Stable regions are consistent:
  - `0`
  - `2`
  - `4-8`
- These map to practical structural families:
  - tight continuous marquee
  - lightly segmented marquee
  - strongly segmented marquee

### Additional strong finding
- `bandSize` on `arch_single` is high-impact.
  - Stable regions:
    - `1-5`
    - `7-9`
  - This separates tighter perimeter motion from wider marquee bands.

### Cleanup result
- Directionality is now taken from the effect setting itself:
  - `forward`
  - `reverse`
- This removed the earlier false “bounce” interpretation caused by centroid motion on segmented windows.

### Current interpretation level
- Marquee is now one of the better-understood effects in the priority set.
- It is already producing structurally useful regions for likely designer requests such as:
  - tighter
  - wider
  - more segmented
  - perimeter motion

## Pinwheel

### Strong findings
- `arms` on `star_single_layer` is high-impact.
  - Stable regions:
    - `2-3`
    - `4`
    - `6-8`
- `thickness` on `star_single_layer` is also high-impact.
  - Stable regions:
    - `0-20`
    - `40`
    - `60-80`

### Narrow findings
- `style` remains `interaction_suspected` on both star and round-tree contexts.
  - It changes the signature, but evidence is still narrow.
  - Do not over-promote it yet.

### Cleanup result
- Registry-generated stale labels were removed.
- `Pinwheel` records now expose cleaner semantics such as:
  - `pinwheelArmDensityClass`
  - `pinwheelRotationClass`
  - `configuredPinwheelArms`

### Current interpretation level
- Good enough to separate few-arm, mid-arm, and dense-arm pinwheel variants.
- Not yet good enough to express richer radial feel terms beyond those structural distinctions.

## Cross-effect conclusions

### What is working now
- The pipeline can reliably detect high-impact parameters and stable regions for:
  - Bars
  - Spirals
  - Marquee
  - Pinwheel
- Context-sensitive status is now essential and working:
  - `high_impact_observed`
  - `context_flat_observed`
  - `interaction_suspected`
- Geometry-specific behavior is starting to show up correctly.

### What is still missing
- We still do not have a trustworthy end-to-end mapping from structural findings to broad designer-language prompts.
- Current semantics are strongest at the structural layer:
  - directional
  - segmented
  - dense
  - sparse
  - helical
  - radial
- We are weaker at the style-language layer:
  - elegant
  - punchy
  - playful
  - refined
  - dramatic

## Recommended next implementation step
1. Build a consolidated priority-effect summary generator that rolls these region summaries into one machine-readable map.
2. Add a first pass of intent-mapping only for effects that now have clean structural regions:
   - Marquee
   - Bars
   - Pinwheel
3. Keep deeper effect-specific interpretation work on:
   - Spirals
   - Pinwheel radial semantics
4. Defer adding more new effects until the intent-layer contract is explicit.
