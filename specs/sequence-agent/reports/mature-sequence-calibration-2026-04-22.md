# Mature Sequence Calibration

Status: Active
Date: 2026-04-22
Owner: xLightsDesigner Team

## Purpose

Record the first post-generative-loop calibration rerun against the production benchmark set after tightening:

- revision feedback mismatch bias
- candidate shaping and selection around structured bias
- mature-sequence window sampling

This report is about render-understanding calibration, not sequencing-policy learning.

## Benchmark Slice

Sequences:

- `CarolOfTheBells`
- `HolidayRoad`
- `CozyLittleChristmas`

Windows:

- `opening`
- `support`
- `peak`

Total windows: `9`

## Important Calibration Correction

The original mature-sequence rerun used clustered frame offsets inside each multi-second window:

- `8,10,12`

That sampling was too narrow for honest progression calibration.

It over-emphasized short local continuity and under-sampled larger within-window change.

The benchmark was rerun using broad window sampling via:

- [build-preview-window-frame-offsets.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-preview-window-frame-offsets.py)

Default broad-window ratios:

- `0.08`
- `0.28`
- `0.50`
- `0.72`
- `0.92`

This materially improved progression separation on the benchmark slice.

## Current Read

### `CarolOfTheBells`

- `opening`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = medium`
  - `developmentStrength = low`
  - `stalenessRisk = high`
- `support`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = high`
  - `developmentStrength = high`
  - `stalenessRisk = low`
- `peak`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = high`
  - `developmentStrength = medium`
  - `stalenessRisk = medium`

Interpretation:

- composition still reads as highly contested across all three windows
- progression is no longer collapsed
- the support window now separates clearly from the opening and peak windows

### `HolidayRoad`

- `opening`
  - `attentionSeparation = medium`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - `developmentStrength = medium`
  - `stalenessRisk = medium`
- `support`
  - `attentionSeparation = medium`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - `developmentStrength = medium`
  - `stalenessRisk = medium`
- `peak`
  - `attentionSeparation = medium`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - `developmentStrength = medium`
  - `stalenessRisk = medium`

Interpretation:

- composition reads consistently and plausibly as a stable weighted structure
- progression no longer collapses to `low/high`, but it may now be too centered on `medium`
- this sequence remains the best benchmark for distinguishing intentional steadiness from true temporal underdevelopment

### `CozyLittleChristmas`

- `opening`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = medium`
  - `developmentStrength = medium`
  - `stalenessRisk = medium`
- `support`
  - `attentionSeparation = low`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - `developmentStrength = low`
  - `stalenessRisk = high`
- `peak`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = low`
  - `developmentStrength = low`
  - `stalenessRisk = high`

Interpretation:

- broad-scene behavior is no longer being confused with automatic occlusion at peak
- support and peak still read as temporally underdeveloped
- that may be partly true, but this benchmark still needs human review before further progression tuning

## What Improved

1. progression calibration is materially more credible after broad-window sampling
2. the benchmark no longer collapses most windows into `developmentStrength = low`
3. composition reads remain structurally differentiated:
   - `HolidayRoad` stays more stable and weighted
   - `CarolOfTheBells` stays more contested
   - `CozyLittleChristmas / peak` stays broad without automatic crowding

## Remaining Gaps

1. mature-sequence progression still lacks enough nuance around intentionally steady passages
2. `HolidayRoad` may now be over-centered on `medium/medium` across all three windows
3. `CarolOfTheBells` composition may still overstate contested attention in some windows
4. the benchmark workflow needs a committed consolidated runner so this rerun does not rely on ad hoc shell orchestration

## Decision

Broad-window frame sampling is now required for mature-sequence progression calibration.

Do not use clustered offsets like:

- `8,10,12`

for multi-second benchmark windows when evaluating progression or section-level temporal behavior.

## Next Direction

1. keep broad-window sampling as the default mature-sequence audit contract
2. use `HolidayRoad` to tune steady-but-valid progression reads
3. use `CarolOfTheBells` to test whether composition attention-competition is overfiring
4. add a dedicated benchmark runner so calibration can be repeated without manual shell loops
