# Layering Observation v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the observation artifact for how multiple realized elements behave on the same physical structure.

This is the xLights-native `layering` problem:

- multiple effects on the same model
- multiple effects on overlapping submodels of the same parent structure
- adjacent layered treatments on the same target when the handoff itself affects legibility

This is not the same as:

- cross-model composition
- sequence progression
- isolated realization semantics

## Core Rule

`layering_observation_v1` is only for same-structure interplay.

Use it when two or more realized elements share:

- the same `targetId`
- the same parent physical structure
- overlapping visual ownership on that structure

Do not use it for:

- different models that only relate compositionally
- broad scene spread or target hierarchy across separate structures

## Why This Matters

Effects do not directly interact across different models because the pixels are physically separate.

They do interact when they are layered on the same model or overlapping structure.

That is where the system needs evidence for:

- masking
- clutter
- reinforcement
- palette fighting
- cadence clash
- loss of focal clarity

## Role Boundary

`layering_observation_v1` is not:

- another effect capability record
- another realization observation
- a composition artifact
- a sequence progression artifact

It is the render-derived evidence layer for same-structure layering quality.

## Scope

Suggested `scopeLevel` values:

- `same_target_window`
- `parent_submodel_window`
- `submodel_overlap_window`
- `same_target_transition`

## Artifact Shape

```json
{
  "artifactType": "layering_observation_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "elementRefs": [],
  "separation": {},
  "masking": {},
  "cadence": {},
  "color": {},
  "notes": []
}
```

## Source

Suggested fields:

- `renderObservationRefs[]`
- `placementRefs[]`
- `targetId`
- `parentTargetId`
- `checkpointId`
- `revisionBatchRef`

## Scope

Suggested fields:

- `scopeLevel`
- `targetId`
- `parentTargetId`
- `timeWindow`
- `overlapType`

Suggested `overlapType` values:

- `same_target`
- `parent_submodel`
- `sibling_submodel_overlap`
- `same_target_transition`

## Element Refs

Each entry should identify one realized layered element.

Suggested fields per entry:

- `targetId`
- `layerIndex`
- `effectName`
- `realizationId`
- `roleHint`

## Separation

Purpose:
- describe whether the stacked elements remain visually distinct enough to read

Suggested fields:

- `layerRoleSeparation`
- `textureSeparation`
- `coverageSeparation`
- `identityClarity`

## Masking

Purpose:
- describe whether one element is overpowering or obscuring another on the same structure

Suggested fields:

- `maskingRisk`
- `dominanceConflict`
- `supportObscuration`
- `foregroundLoss`

## Cadence

Purpose:
- describe whether layered timing behaviors reinforce or clash on the same structure

Suggested fields:

- `cadenceAlignment`
- `phaseClashRisk`
- `motionConflict`
- `pulseCompetition`

## Color

Purpose:
- describe whether layered color behavior reinforces or muddies the same structure

Suggested fields:

- `paletteReinforcement`
- `paletteConflict`
- `colorCompetition`
- `dominantRoleLoss`

## Initial Canonical Questions

The first implementation of this artifact should answer only a compact set of questions:

1. Can the lead layer still be read clearly?
2. Is the support layer staying subordinate on the same structure?
3. Are the stacked layers visually distinct enough?
4. Are cadence/motion behaviors reinforcing or clashing?
5. Are palette behaviors reinforcing or fighting each other?

That is enough for the first usable layering layer.

## Data Constraint

The current `render_observation_v1` pipeline is scene-oriented.
It does not yet isolate same-target layers as separate rendered contributors.

That means:

- `layering_observation_v1` should not be faked from scene-wide composition metrics
- it needs either:
  - layer-aware render sampling
  - layer-isolated render proofs
  - or explicit same-target placement reconstruction strong enough to distinguish contributors

Until that exists, layering should be treated as:

- specified
- not yet fully instrumented

## Immediate Next Step

The next implementation pass should:

1. identify same-target placement groups from `effectPlacements`
2. define the minimum layer-aware render proof needed for those groups
3. then implement `layering_observation_v1` from actual same-target evidence

Do not infer same-target layering quality from cross-model composition artifacts.
