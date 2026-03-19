# Overnight Render Training Matrix

Goal for this run:
- capture the first broad unattended corpus using the stable debug-only `.xsq` + `.fseq` flow
- stay on concrete models only
- defer model groups, submodels, and matrix-heavy coverage to later rounds
- expand beyond linear props into tree and star geometry

Operating assumptions:
- xLights target is debug build only
- runs are sequential, not parallel
- all outputs persist under `/Users/robterry/Desktop/Show/RenderTraining`
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

## Matrix

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

## First-Round Totals

| Category | Samples |
|---|---:|
| `On` baseline | 12 |
| `SingleStrand` discrete look coverage | 14 |
| `SingleStrand` parameter ranges | 21 |
| `Shimmer` discrete + ranges | 27 |
| **Total** | **74** |

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

## Recommended Overnight Order

Run order should reduce context churn and keep similar model/effect groups together:

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

## Expected Overnight Outputs

For each pack:
- packed `.xsq` under `/Users/robterry/Desktop/Show/RenderTraining/working`
- packed `.fseq` under `/Users/robterry/Desktop/Show/RenderTraining/fseq`
- manifest snapshot under `/Users/robterry/Desktop/Show/RenderTraining/manifests`
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
- still wide enough to tell us which parameters matter and which stay flat

Before wiring the unattended run, the main review points are:
1. whether the tree/star packs are the right first-round additions
2. whether the two low-yield `SingleStrand` control ranges should stay in the overnight job
3. whether `On` baselines should stay on all model classes or be trimmed back after the first full unattended pass
