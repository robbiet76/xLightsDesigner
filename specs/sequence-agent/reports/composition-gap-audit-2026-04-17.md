# Composition Gap Audit

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team

## Purpose

Record the first neutral-language correction pass for `composition_observation_v1` after benchmarking against mature production sequences.

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

## Initial Problem

The composition layer was using real measurements, but its public language still encoded a default focal-hierarchy worldview.

Main issues:

- hierarchy fields were centered on `lead` / `support`
- critique language implicitly treated distributed attention as weak
- crowding / masking risk overfired because raw active-model count was being treated as near-automatic occlusion

That was too normative for the project direction.

## Correction

The composition layer now exposes neutral hierarchy fields alongside the compatibility names.

New preferred fields:

- `attentionSeparation`
- `attentionCompetition`
- `attentionStability`
- `occlusionRisk`
- `secondarySubordination`

Compatibility fields retained:

- `leadSupportSeparation`
- `dominanceConflict`
- `focusStability`
- `maskingRisk`
- `supportSubordination`

The critique path now reads the neutral fields first and falls back to compatibility names only when necessary.

## Occlusion Fix

`occlusionRisk` was recalibrated to depend more on scene compression than raw active-model count.

Current basis:

- compactness of the active footprint
- `maxActiveModelRatio`
- stronger penalty only when attention is highly contested inside a compact scene

This removed the earlier failure mode where most dense scenes were automatically judged as crowded.

## Current Benchmark Read

Representative benchmark outcome after the correction:

- `HolidayRoad / opening`
  - `attentionSeparation = medium`
  - `attentionCompetition = medium`
  - `occlusionRisk = medium`
  - critique weaknesses: none

- `CarolOfTheBells / opening`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = medium`
  - critique now focuses on contested attention rather than generic crowding

- `CozyLittleChristmas / peak`
  - `attentionSeparation = low`
  - `attentionCompetition = high`
  - `occlusionRisk = low`
  - critique no longer confuses broad scene coverage with automatic crowding

This is materially better than the earlier version.

## What Is Better

1. distributed attention is not treated as automatically weak
2. composition fields better describe structure than artistic intent
3. crowding is less over-triggered in broad, active scenes
4. the benchmark differentiates contested attention from true compression more cleanly

## Remaining Gaps

The composition layer is improved, but still incomplete.

Remaining gaps:

1. hierarchy naming still has compatibility baggage in downstream artifacts
2. `secondarySubordination` can still read too normatively without intent context
3. motion interaction remains shallow on real production scenes
4. novelty is still derived from compact local reuse proxies rather than richer adjacent-window context

## Next Direction

The next composition improvements should stay on the same path:

1. keep the measurements compact and neutral
2. continue moving critique toward attention-structure language
3. avoid treating concentration, breadth, or dominance as universally good or bad
4. eventually evaluate composition relative to explicit intent rather than baked-in defaults
