# Mature Sequence Window Plan v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the first automatic window-selection contract for mature-sequence render audits.

This planner exists to avoid ad hoc timestamp picking when auditing real production sequences.

## Inputs

Required:
- `.fseq` file

Derived metadata:
- `frameCountTotal`
- `stepTimeMs`
- total sequence duration in milliseconds

## Output

Artifact:
- `mature_sequence_window_plan_v1`

Required fields:
- `sequenceName`
- `fseqPath`
- `durationMs`
- `frameCountTotal`
- `stepTimeMs`
- `windows[]`

Each window entry must contain:
- `name`
- `startMs`
- `endMs`
- `durationMs`
- `centerRatio`

## v1 Window Set

The first version uses five audit windows:
- `opening`
- `support`
- `peak`
- `transition`
- `closing`

## v1 Heuristic

Window size:
- target `8%` of total sequence duration
- clamped to `4000ms..8000ms`

Window placement:
- `opening`: starts at `0ms`
- `closing`: ends at total duration
- `support`: centered near `28%`
- `peak`: centered near `52%`
- `transition`: centered near `74%`

This is intentionally simple.

## Boundary

v1 is not a semantic section detector.

It does not claim:
- chorus detection
- lyric-aware section boundaries
- timing-track alignment
- musical phrase understanding

It is only a stable first pass for whole-sequence audit sampling.

## Next Improvement Targets

After v1, the next window-planning improvements should be:
- active-range-aware window refinement
- timing-track-aware section selection
- audio-structure-aware section refinement
- peak-density and peak-motion guided window adjustment
