# Production Layering Inventory

Status: Active
Date: 2026-04-22
Owner: xLightsDesigner Team

## Purpose

Identify real same-target layered effect overlaps from production `.xsq` files so layering calibration can start from actual sequence data instead of synthetic placement fixtures.

## Benchmark Slice

Sequences scanned:

- `CarolOfTheBells`
- `HolidayRoad`
- `CozyLittleChristmas`

Source artifact:

- `/tmp/production-layering-inventory.json`

Generator:

- [build-production-layering-inventory.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-production-layering-inventory.py)

## Inventory Summary

Total overlap cases:

- `1750`

Suitability counts:

- `high: 574`
- `medium: 820`
- `low: 356`

High-suitability cases by sequence:

- `CozyLittleChristmas: 309`
- `HolidayRoad: 265`
- `CarolOfTheBells: 0`

## Important Findings

1. `CozyLittleChristmas` is the best current production source for real same-target layering calibration.
2. `HolidayRoad` also contains many usable same-target overlaps, but several of the longest cases are utility-heavy (`VU Meter` combinations and aggregate targets).
3. `CarolOfTheBells` does not currently provide strong direct same-target layering cases in this slice.
4. The first production layering pass should not start from aggregate utility targets like:
   - `AllModels_*`
   - `_All`
   - long `Off` / `Video` overlaps

## Best Initial Calibration Targets

The first production layering calibration pass should start with effect pairs that are:

- same target
- long enough to observe cleanly
- materially different effect families
- not primarily utility layers

Recommended initial cases:

1. `CozyLittleChristmas / HiddenTree`
   - `Lines` + `Snowflakes`
   - long overlap windows
   - likely good for masking, separation, and cadence interaction

2. `CozyLittleChristmas / HiddenTreeStar`
   - `Color Wash` + `Strobe`
   - likely good for foreground loss, obscuration, and color-role interaction

3. `CozyLittleChristmas / Star`
   - `Twinkle` + `Strobe`
   - `Twinkle` + `Color Wash`
   - likely good for cadence and attention competition

4. `HolidayRoad / SpiralTreeStars`
   - `Fan` + `VU Meter`
   - useful as a secondary pass for distinct same-target motion layering

## What This Means

Layering calibration no longer needs to start from theory alone.

We now have a concrete production-backed path:

1. inventory real same-target overlaps from `.xsq`
2. pick high-suitability cases
3. build proof windows around those cases
4. run `layering_observation_v1` against them
5. calibrate masking / separation / cadence / color interaction from real render outcomes

## Next Direction

1. build a small production layering calibration set from the recommended targets above
2. generate render-proof inputs for those same-target overlaps
3. calibrate `layering_observation_v1` against those production cases before broadening to parent/submodel overlap
