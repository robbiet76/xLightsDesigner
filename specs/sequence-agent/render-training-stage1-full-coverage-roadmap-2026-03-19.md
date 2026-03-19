# Render Training Stage 1 Full-Coverage Roadmap

Date: 2026-03-19

## Purpose

Stage 2 must not start until Stage 1 has full single-effect coverage across the canonical render-training model set.

This roadmap tightens the Stage 1 definition:
- current equalization means selector maturity inside the current cohort
- it does **not** mean full effect x model coverage
- Stage 1 completion now requires full primary coverage for every in-scope effect and required probe coverage or explicit waivers for lower-value geometries

Machine-readable coverage contract:
- [stage1-effect-model-scope.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/stage1-effect-model-scope.json)

Current coverage audit:
- [/tmp/render-training-stage1-coverage-audit.v1.json](/tmp/render-training-stage1-coverage-audit.v1.json)

## In-Scope Effects

Current Stage 1 scope from the effect registry:
- `On`
- `SingleStrand`
- `Shimmer`
- `Color Wash`
- `Bars`
- `Marquee`
- `Pinwheel`
- `Spirals`
- `Shockwave`
- `Twinkle`

## Canonical Model Set

The canonical render-training layout currently defines `19` geometry profiles:
- `single_line_horizontal`
- `single_line_vertical`
- `single_line_single_node`
- `arch_single`
- `arch_multi_layer`
- `arch_grouped`
- `tree_flat_single_layer`
- `tree_360_round`
- `tree_360_spiral`
- `star_single_layer`
- `star_multi_layer`
- `icicles_drop_pattern`
- `spinner_standard`
- `cane_single`
- `cane_grouped`
- `cane_stick_grouped`
- `matrix_low_density`
- `matrix_medium_density`
- `matrix_high_density`

## Current State

Equalized selector cohort:
- `Bars`
- `Marquee`
- `Pinwheel`
- `Spirals`
- `Twinkle`
- `Shockwave`

Important constraint:
- these six are equalized for current selector maturity
- they are **not** yet fully covered across the stricter Stage 1 model contract

Coverage audit summary:
- critical backlog:
  - `Color Wash`
  - `On`
  - `Shimmer`
  - `SingleStrand`
- high backlog:
  - `Bars`
  - `Marquee`
  - `Pinwheel`
  - `Spirals`
  - `Shockwave`
  - `Twinkle`

Primary coverage counts from the audit:
- `Color Wash`: `0 / 19`
- `On`: `5 / 19`
- `Shimmer`: `6 / 19`
- `SingleStrand`: `4 / 18` plus `1` probe
- `Bars`: `8 / 18` plus `1` probe
- `Marquee`: `8 / 18` plus `1` probe
- `Pinwheel`: `6 / 9` plus `0 / 10` probes
- `Spirals`: `3 / 9` plus `0 / 10` probes
- `Shockwave`: `5 / 9` plus `0 / 10` probes
- `Twinkle`: `5 / 19`

## Coverage Policy

There are two coverage modes:

1. `all_primary`
- effect must get primary coverage on all canonical profiles
- used for:
  - `On`
  - `Shimmer`
  - `Color Wash`
  - `Twinkle`

2. `primary_plus_probe`
- effect gets full sweeps on high-value geometries
- remaining canonical geometries get reduced probes
- used for:
  - `SingleStrand`
  - `Bars`
  - `Marquee`
  - `Pinwheel`
  - `Spirals`
  - `Shockwave`

Reason:
- this preserves the user's requirement for full model coverage
- but it avoids wasting the same level of sweep depth on obviously lower-value or degenerate forms
- lower-value forms must still be tested or explicitly waived

## Immediate Gaps Found

Process/model gaps found during the audit:
- `Color Wash` was missing `complexityClass` and `earlySamplingPolicy` in the registry
  - fixed in the registry before this roadmap was written
- equalization currently overstates Stage 1 completeness if read as full model coverage
  - equalization must now be treated as a maturity sub-goal, not the Stage 1 finish line
- there is no current machine-readable full Stage 1 coverage contract
  - fixed by adding `stage1-effect-model-scope.json`

## Next 60-Minute Round

The next heavy round should be a coverage-expansion round, not a selector round.

Budget mix:
- `50%` critical backlog expansion
- `30%` high-priority mature-effect model gap expansion
- `10%` benchmark regression reruns on the equalized six
- `10%` gap-capture and planner-state regeneration

### Round 1 targets

1. `Color Wash`
- first canonical broad pass on:
  - `single_line_horizontal`
  - `single_line_vertical`
  - `arch_single`
  - `tree_flat_single_layer`
  - `tree_360_round`
  - `tree_360_spiral`
  - `star_single_layer`
  - `star_multi_layer`
  - `spinner_standard`
  - `matrix_low_density`
  - `matrix_medium_density`
  - `matrix_high_density`

2. `On`
- fill remaining primary gaps with reduced baseline packs on:
  - `single_line_vertical`
  - `single_line_single_node`
  - `arch_multi_layer`
  - `arch_grouped`
  - `tree_360_spiral`
  - `star_multi_layer`
  - `spinner_standard`
  - `icicles_drop_pattern`
  - `cane_single`
  - `cane_grouped`
  - `cane_stick_grouped`
  - `matrix_low_density`
  - `matrix_medium_density`
  - `matrix_high_density`

3. `Shimmer`
- fill remaining primary gaps on:
  - `single_line_vertical`
  - `single_line_single_node`
  - `arch_multi_layer`
  - `arch_grouped`
  - `star_multi_layer`
  - `spinner_standard`
  - `icicles_drop_pattern`
  - `cane_single`
  - `cane_grouped`
  - `cane_stick_grouped`
  - `matrix_low_density`
  - `matrix_medium_density`
  - `matrix_high_density`

4. `SingleStrand`
- high-value missing primarys first:
  - `single_line_vertical`
  - `tree_flat_single_layer`
  - `star_single_layer`
  - `star_multi_layer`
  - `spinner_standard`
  - `icicles_drop_pattern`
  - `matrix_low_density`
- then layered/grouped/cane expansion if time remains:
  - `arch_multi_layer`
  - `arch_grouped`
  - `cane_single`
  - `cane_grouped`
  - `cane_stick_grouped`
  - `matrix_medium_density`
  - `matrix_high_density`

5. Mature-effect high gaps
- reduced probe or primary gap fills for:
  - `Bars` on `star_single_layer`, `star_multi_layer`, `spinner_standard`, `matrix_*`, `cane_*`, `icicles_drop_pattern`
  - `Marquee` on the same geometry set
  - `Pinwheel` on `matrix_*`
  - `Shockwave` on `star_multi_layer`, `matrix_*`
  - `Spirals` on `star_*`, `spinner_standard`, `matrix_*`
  - `Twinkle` on `tree_flat_single_layer`, `single_line_vertical`, `arch_*`, `cane_*`, `icicles_drop_pattern`, `matrix_*`, `star_multi_layer`

## Ordering Rules

Use this order for Stage 1 closure:
1. remaining non-equalized effects on their primary profiles
2. mature effects with the largest primary model gaps
3. mature effects' reduced probe coverage
4. additional selector recalibration only when coverage changes materially alter semantics

## Exit Criteria For Stage 1

Stage 1 is complete only when:
- every in-scope effect satisfies its scope contract in `stage1-effect-model-scope.json`
- gap reports do not show unresolved critical coverage gaps
- equalization/maturity boards are regenerated against the expanded coverage base
- any waived probe is documented with explicit rationale

Only after that milestone should layered-effect work become the next major phase.
