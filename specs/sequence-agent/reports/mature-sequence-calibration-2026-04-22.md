# Mature Sequence Calibration

Status: Active
Date: 2026-04-22
Owner: xLightsDesigner Team

## Purpose

Record the first post-generative-loop calibration rerun against the production benchmark set after tightening:

- revision feedback mismatch bias
- candidate shaping and selection around structured bias
- mature-sequence window sampling
- steady-passage progression calibration

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
  - `stalenessRisk = medium`
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
  - `stalenessRisk = low`

Interpretation:

- composition still reads as highly contested across all three windows
- progression is no longer collapsed
- the support window now separates clearly from the opening and peak windows
- opening and peak no longer over-read as stagnant simply because their development signal is not maximal

### `HolidayRoad`

- `opening`
  - `attentionSeparation = medium`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - `developmentStrength = medium`
  - `stalenessRisk = low`
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
- progression no longer collapses to `low/high`
- the opening window now reads as steady but still valid instead of artificial stagnation
- support and peak remain centered on `medium`, which is acceptable for now but still worth watching
- this sequence remains the best benchmark for distinguishing intentional steadiness from true temporal underdevelopment

### `CozyLittleChristmas`

- `opening`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = medium`
  - `developmentStrength = medium`
  - `stalenessRisk = low`
- `support`
  - `attentionSeparation = low`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - `developmentStrength = low`
  - `stalenessRisk = medium`
- `peak`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = low`
  - `developmentStrength = low`
  - `stalenessRisk = high`

Interpretation:

- broad-scene behavior is no longer being confused with automatic occlusion at peak
- support still reads as underdeveloped, but no longer as aggressively stagnant
- peak still reads as the clearest temporal weak spot in this slice
- that may be partly true, but this benchmark still needs human review before further progression tuning

## What Improved

1. progression calibration is materially more credible after broad-window sampling
2. steady single-window passages no longer map as directly to stagnation
3. the benchmark no longer collapses most windows into `developmentStrength = low`
4. composition reads remain structurally differentiated:
   - `HolidayRoad` stays more stable and weighted
   - `CarolOfTheBells` stays more contested
   - `CozyLittleChristmas / peak` stays broad without automatic crowding

## Remaining Gaps

1. mature-sequence progression still lacks enough nuance around intentionally steady passages
2. `HolidayRoad` support/peak may still be slightly over-centered on `medium/medium`
3. `CarolOfTheBells` composition may still overstate contested attention in some windows
4. the benchmark workflow is now repeatable, but the report should eventually be generated directly from the runner output

## Decision

Broad-window frame sampling is now required for mature-sequence progression calibration.

Do not use clustered offsets like:

- `8,10,12`

for multi-second benchmark windows when evaluating progression or section-level temporal behavior.

## Next Direction

1. keep broad-window sampling as the default mature-sequence audit contract
2. use `HolidayRoad` to tune steady-but-valid progression reads further if support/peak remain too centered
3. use `CarolOfTheBells` to test whether composition attention-competition is overfiring
4. move from manual report updates to runner-backed report generation when the calibration vocabulary stabilizes
