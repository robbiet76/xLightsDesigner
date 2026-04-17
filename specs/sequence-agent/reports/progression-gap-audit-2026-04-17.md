# Progression Gap Audit

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team

## Purpose

Record the first production benchmark findings for `progression_observation_v1` and the corrective direction taken after auditing real show material.

## Benchmark Set

Production benchmark windows analyzed from the read-only show tree:

- `CarolOfTheBells`
- `HolidayRoad`
- `CozyLittleChristmas`

Windows compared:

- `opening`
- `support`
- `peak`

Total benchmark windows: `9`

## Initial Failure

The original `progression_observation_v1` implementation was underfit on production material.

Observed failure mode:

- materially different windows collapsed to the same progression read
- `developmentStrength` frequently stayed `low`
- `stagnationRisk` frequently stayed `high` or `medium`
- critique language converted that collapse into normative claims such as "stagnating"

This was not defensible against the rendered evidence.

## Root Cause

The earlier progression logic depended too heavily on narrow reuse and hierarchy proxies such as:

- `leadModel`
- `leadModelShare`
- density reuse
- palette reuse

That approach was too brittle for real production material because:

- many scenes are intentionally distributed rather than concentrated
- a section can change materially without a single dominant lead shift
- within-window temporal change matters even when only one observation window is available

## Correction

The progression extractor now derives neutral per-window features first, then scores progression from those features.

New neutral features:

- `attentionProfile`
- `temporalVariationScore`
- `temporalProfile`

Primary temporal evidence now includes:

- spread shift inside a window
- node-count delta mean and variance
- brightness delta mean and variance
- centroid motion
- density regime variety
- color-role transitions
- pulse / burst activity

## Current Benchmark Read

The benchmark windows now separate in a materially more useful way.

Examples:

- `CarolOfTheBells`
  - `opening`: `developmentStrength = low`
  - `support`: `developmentStrength = high`
  - `peak`: `developmentStrength = medium`

- `HolidayRoad`
  - `opening`: `developmentStrength = medium`
  - `support`: `developmentStrength = low`
  - `peak`: `developmentStrength = low`

- `CozyLittleChristmas`
  - `opening`: `developmentStrength = medium`
  - `support`: `developmentStrength = low`
  - `peak`: `developmentStrength = low`

This does not prove the progression layer is solved.
It does prove the benchmark no longer collapses distinct windows into one flat read.

## Critique Language Correction

`extract-sequence-critique.py` was also adjusted to reduce default heuristic judgment.

Key changes:

- distributed attention is no longer treated as automatically weak
- single-family usage is no longer treated as automatically weak
- progression critique now describes temporal similarity / limited variation rather than assuming every passage should "develop"

This keeps the stack closer to the project rule:

- hardcode measurements
- do not hardcode artistic outcomes

## Remaining Gaps

The progression layer is improved, but still incomplete.

Remaining gaps:

1. adjacent-window progression still depends on coarse summary metrics
2. energy-arc interpretation remains shallow on single-window proofs
3. progression still lacks explicit intent conditioning
4. critique still uses some hierarchy-oriented phrasing in the composition layer that should eventually move toward broader `attention` language

## Next Direction

The next progression improvements should stay on the same path:

1. keep progression grounded in neutral observables
2. avoid assuming focal hierarchy or escalation is always desirable
3. only judge a temporal profile as weak when the intended behavior requires something else
4. eventually add intent-conditioned interpretation on top of these observables rather than inside them
