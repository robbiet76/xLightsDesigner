# Overnight Render Training Matrix

Goal for this run:
- capture a broad unattended corpus using the stable debug-only `.xsq` + `.fseq` flow
- stay on concrete models only
- defer model groups, submodels, and matrix-heavy coverage to later rounds
- expand beyond linear props into tree and star geometry
- use enough of the overnight window to move beyond first-pass discovery into broader representative setting coverage

Operating assumptions:
- xLights target is debug build only
- runs are sequential, not parallel
- all outputs persist under `/Users/robterry/Projects/xLightsDesigner/render-training`
- each run writes:
  - packed `.xsq`
  - packed `.fseq`
  - per-sample records
  - decoded `.fseq` features

Scope guardrails for this overnight:
- use concrete models only
- do not include model groups
- do not include submodels
- defer matrix-focused packs for now
- treat custom-model generalization as a later workstream after we have better coverage on representative built and custom concrete models

## Phase 1 Matrix

| Priority | Pack ID | Effect | Model Type | Model | Samples | Sweep Type | Purpose | Expected Yield |
|---|---|---|---|---|---:|---|---|---|
| Core | `on-reduced-sweep-v1` | `On` | `outline` | `Border-01` | 3 | discrete looks | static baseline on linear outline | medium |
| Core | `singlestrand-linear-expanded-sweep-v2` | `SingleStrand` | `single_line` | `UpperGutter-01` | 7 | discrete looks | main look-family coverage on roofline geometry | high |
| Core | `singlestrand-linear-chasesize-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 6 | parameter range | find chase-size transition regions | medium |
| Core | `singlestrand-linear-numberchases-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 5 | parameter range | find chase-density bands | high |
| Control | `singlestrand-linear-advances-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 5 | parameter range | confirm whether skips travel rate is flat | low |
| Control | `singlestrand-linear-fx-intensity-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 5 | parameter range | confirm whether FX intensity is flat in current setup | low |
| Core | `shimmer-outline-expanded-sweep-v2` | `Shimmer` | `outline` | `Border-01` | 5 | discrete looks | restrained / balanced / punchy / busy sparkle family | high |
| Core | `shimmer-outline-dutyfactor-range-v1` | `Shimmer` | `outline` | `Border-01` | 6 | parameter range | find low/mid/high shimmer regions | high |
| Core | `shimmer-outline-cycles-range-v1` | `Shimmer` | `outline` | `Border-01` | 6 | parameter range | find cadence regions | high |
| Core | `on-hiddentree-reduced-sweep-v1` | `On` | `tree_flat` | `HiddenTree` | 3 | discrete looks | baseline full-tree hold / fade behavior on dense tree geometry | medium |
| Core | `shimmer-hiddentree-expanded-sweep-v1` | `Shimmer` | `tree_flat` | `HiddenTree` | 5 | discrete looks | restrained / balanced / busy sparkle family on dense tree geometry | high |
| Core | `shimmer-hiddentree-dutyfactor-range-v1` | `Shimmer` | `tree_flat` | `HiddenTree` | 6 | parameter range | find low/mid/high shimmer regions on tree geometry | high |
| Core | `on-spiraltree-reduced-sweep-v1` | `On` | `tree_360` | `SpiralTree-01` | 3 | discrete looks | baseline full-tree hold / fade behavior on spiral geometry | medium |
| Core | `singlestrand-spiraltree-expanded-sweep-v1` | `SingleStrand` | `tree_360` | `SpiralTree-01` | 7 | discrete looks | test chase / skip / FX behavior on spiral tree topology | high |
| Core | `singlestrand-spiraltree-numberchases-range-v1` | `SingleStrand` | `tree_360` | `SpiralTree-01` | 5 | parameter range | find chase-density bands on spiral geometry | high |
| Core | `on-hiddentreestar-reduced-sweep-v1` | `On` | `star` | `HiddenTreeStar` | 3 | discrete looks | baseline hold / fade behavior on star geometry | medium |
| Core | `shimmer-hiddentreestar-expanded-sweep-v1` | `Shimmer` | `star` | `HiddenTreeStar` | 5 | discrete looks | restrained / balanced / busy sparkle family on star geometry | high |

## Phase 1 Totals

| Category | Samples |
|---|---:|
| `On` baseline | 12 |
| `SingleStrand` discrete look coverage | 14 |
| `SingleStrand` parameter ranges | 21 |
| `Shimmer` discrete + ranges | 27 |
| **Total** | **74** |

## Why Phase 1 Is Not Enough For The Full Night

The validated first round is the right starting block, but it will not use the full overnight window.

Expected duration:
- about `30-45 minutes`

That is enough to establish:
- baseline geometry coverage
- first look-family coverage
- first high-impact parameter regions

It is not enough to claim representative understanding of every meaningful lever.

To use roughly `6` overnight hours, the run should expand in structured phases rather than by brute-force combinations.

## Expanded Overnight Target

Target shape:
- `300-450` samples total
- roughly `5-7` hours depending on xLights throughput and session stability

Design rules:
- keep concrete models only
- stay on `On`, `SingleStrand`, and `Shimmer`
- add representative parameter and shared-axis coverage
- do not try full Cartesian products
- prioritize axes that help us understand the range of behaviors, not a single best preset

## Phase 2 Expansion

Purpose:
- finish the most important effect-local parameter coverage
- deepen tree/star coverage
- keep geometry diversity high

Proposed new packs to add after Phase 1:

| Priority | Proposed Pack ID | Effect | Model Type | Model | Est. Samples | Sweep Type | Purpose |
|---|---|---|---|---|---:|---|---|
| Core | `singlestrand-linear-cycles-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 6 | parameter range | find chase cadence regions on linear geometry |
| Core | `singlestrand-linear-skipsize-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 5 | parameter range | find skip spacing regions |
| Core | `singlestrand-linear-bandsize-range-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 5 | parameter range | find skip band-width regions |
| Core | `singlestrand-linear-chasetype-combos-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 5 | structured combos | compare major chase motion structures |
| Core | `singlestrand-linear-fadetype-combos-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 4 | structured combos | compare chase fade structures |
| Core | `shimmer-hiddentree-cycles-range-v1` | `Shimmer` | `tree_flat` | `HiddenTree` | 6 | parameter range | find cadence regions on dense tree geometry |
| Core | `shimmer-hiddentreestar-dutyfactor-range-v1` | `Shimmer` | `star` | `HiddenTreeStar` | 6 | parameter range | find low/mid/high shimmer regions on star geometry |
| Core | `shimmer-hiddentreestar-cycles-range-v1` | `Shimmer` | `star` | `HiddenTreeStar` | 6 | parameter range | find cadence regions on star geometry |
| Core | `singlestrand-spiraltree-chasesize-range-v1` | `SingleStrand` | `tree_360` | `SpiralTree-01` | 6 | parameter range | find chase-size breakpoints on spiral geometry |
| Core | `singlestrand-spiraltree-cycles-range-v1` | `SingleStrand` | `tree_360` | `SpiralTree-01` | 6 | parameter range | find chase cadence regions on spiral geometry |

Phase 2 estimate:
- additional `56` samples
- cumulative total after Phase 2: `130`

## Phase 3 Shared-Axis Expansion

Purpose:
- learn how shared rendering choices shift the same effect behavior
- avoid overfitting the training set to one palette and one render-style assumption

Shared axes to sample:
- `renderStyle`
- palette class

Palette classes to cover:
- `two_color_high_contrast`
- `two_color_low_contrast`
- `warm_multi`
- `cool_multi`

Render-style strategy:
- only where the effect meaning actually changes by render style
- not every style on every pack

Proposed Phase 3 packs:

| Priority | Proposed Pack ID | Effect | Model Type | Model | Est. Samples | Sweep Type | Purpose |
|---|---|---|---|---|---:|---|---|
| Core | `singlestrand-linear-palette-classes-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 8 | shared-axis sweep | compare major palette classes on a stable chase |
| Core | `shimmer-outline-palette-classes-v1` | `Shimmer` | `outline` | `Border-01` | 8 | shared-axis sweep | compare palette-driven texture/readability shifts |
| Core | `shimmer-hiddentree-palette-classes-v1` | `Shimmer` | `tree_flat` | `HiddenTree` | 8 | shared-axis sweep | compare palette effect on dense tree sparkle |
| Core | `singlestrand-spiraltree-palette-classes-v1` | `SingleStrand` | `tree_360` | `SpiralTree-01` | 8 | shared-axis sweep | compare palette effect on spiral motion readability |
| Core | `singlestrand-linear-renderstyle-v1` | `SingleStrand` | `single_line` | `UpperGutter-01` | 6 | shared-axis sweep | test major render-style shifts on one stable chase setup |
| Core | `shimmer-outline-renderstyle-v1` | `Shimmer` | `outline` | `Border-01` | 6 | shared-axis sweep | test major render-style shifts on sparkle texture |
| Core | `shimmer-hiddentree-renderstyle-v1` | `Shimmer` | `tree_flat` | `HiddenTree` | 6 | shared-axis sweep | test render-style shifts on dense tree sparkle |

Phase 3 estimate:
- additional `45-55` samples
- cumulative total after Phase 3: about `180-195`

## Phase 4 Deeper Representative Coverage

Purpose:
- use the rest of the overnight window on the highest-yield effect/model pairs
- sample interactions without opening a full combinatorial explosion

Strategy:
- choose only the strongest effect/model pairs from Phases 1-3
- add second-order interaction sweeps:
  - one numeric parameter x one structural option
  - one numeric parameter x one palette class

Candidate high-yield pairs:
- `SingleStrand` on `UpperGutter-01`
- `Shimmer` on `Border-01`
- `Shimmer` on `HiddenTree`
- `SingleStrand` on `SpiralTree-01`

Representative Phase 4 pack types:
- `numberChases x chaseType`
- `dutyFactor x useAllColors`
- `cycles x paletteClass`
- `chaseSize x fadeType`

Phase 4 estimate:
- additional `120-220` samples depending on how many interactions we approve

## Full-Night Target Range

| Scope | Est. Samples | Est. Duration |
|---|---:|---:|
| Phase 1 only | 74 | `~0.5 h` |
| Phase 1 + 2 | 130-140 | `~2-3 h` |
| Phase 1 + 2 + 3 | 180-195 | `~3-4 h` |
| Phase 1 + 2 + 3 + selected Phase 4 | 300-450 | `~5-7 h` |

Recommended full-night target:
- `~320-380` samples
- enough to use the overnight window without drifting into low-value brute-force coverage

## Why This Matrix

This run is not trying to solve for one best preset.

It is trying to do three things:
1. understand what settings do across concrete models
2. preserve multiple useful looks per effect/model pair
3. map where ranges actually change behavior

That is why the matrix includes both:
- discrete look packs
- parameter-range packs

And it still includes a few control axes that may stay flat.
Those are still useful because they tell us which parameters do not deserve much sequencer attention in a given context.

## Why Matrix Is Deferred

Matrix models matter, but they are not the right focus for this first unattended run.

Reason:
- they open a much larger surface area
- many matrix use cases depend on image/video/media-driven workflows we are not covering yet
- the first unattended run should stay centered on effect-parameter behavior over concrete prop geometry

So this overnight stays on:
- outline
- single-line
- cane
- tree
- star

And defers:
- matrix
- model groups
- submodels

## Current Findings That Informed This Matrix

Already observed:
- `Shimmer.dutyFactor` is high-impact
- `Shimmer.cycles` is high-impact
- `SingleStrand.numberChases` is high-impact
- `SingleStrand` chase size mostly stays stable until the upper end

Already observed as flatter in tested contexts:
- `SingleStrand.advances`
- `SingleStrand` FX `intensity`

That is why the flatter axes are still present, but marked as `Control`.

## Tree / Star Assumptions

The following concrete models are present in the current layout and suitable for first-round coverage:
- `HiddenTree`
  - `displayAs: Tree Flat`
  - `nodeCount: 200`
- `SpiralTree-01`
  - `displayAs: Tree 360`
  - `nodeCount: 46`
- `HiddenTreeStar`
  - `displayAs: Star`
  - `nodeCount: 70`

These are valuable because they broaden geometry coverage without yet opening the separate problem of general custom-model interpretation.

Explicitly deferred from this overnight:
- `CandyCane-01`
  - custom model
  - remove from first unattended run
  - cover later under a dedicated custom-model pass

## Recommended Execution Order

Run order should reduce context churn and keep similar model/effect groups together:

Phase 1:
1. `on-reduced-sweep-v1`
2. `singlestrand-linear-expanded-sweep-v2`
3. `singlestrand-linear-chasesize-range-v1`
4. `singlestrand-linear-numberchases-range-v1`
5. `singlestrand-linear-advances-range-v1`
6. `singlestrand-linear-fx-intensity-range-v1`
7. `shimmer-outline-expanded-sweep-v2`
8. `shimmer-outline-dutyfactor-range-v1`
9. `shimmer-outline-cycles-range-v1`
10. `on-hiddentree-reduced-sweep-v1`
11. `shimmer-hiddentree-expanded-sweep-v1`
12. `shimmer-hiddentree-dutyfactor-range-v1`
13. `on-spiraltree-reduced-sweep-v1`
14. `singlestrand-spiraltree-expanded-sweep-v1`
15. `singlestrand-spiraltree-numberchases-range-v1`
16. `on-hiddentreestar-reduced-sweep-v1`
17. `shimmer-hiddentreestar-expanded-sweep-v1`

Rationale:
- start with already-proven linear packs
- keep `SingleStrand` grouped before `Shimmer`
- keep outline work ahead of tree/star work
- add tree-flat before spiral tree
- finish with the star model

Phase 2-4 ordering rule:
- keep packs grouped by effect and model
- run shared-axis sweeps after base parameter sweeps
- run second-order interaction packs last
- stop expansion before adding matrix, model groups, or submodels

## Expected Overnight Outputs

For each pack:
- packed `.xsq` under `/Users/robterry/Projects/xLightsDesigner/render-training/working`
- packed `.fseq` under `/Users/robterry/Projects/xLightsDesigner/render-training/fseq`
- manifest snapshot under `/Users/robterry/Projects/xLightsDesigner/render-training/manifests`
- per-sample decoded records under the selected run output directory

For range packs:
- transition report
- parameter-region summary

For look packs:
- look catalog
- intent summary
- intent gap report

## Review Focus

This matrix is intentionally:
- concrete-model only
- biased toward geometry diversity over matrix breadth
- aimed at representative understanding, not exhaustive combinations

Before wiring the longer unattended run, the main review points are:
1. whether Phase 2 parameter additions are the right next levers
2. whether palette class and render style should both be included in Phase 3
3. how much Phase 4 interaction coverage to allow for the actual overnight window
