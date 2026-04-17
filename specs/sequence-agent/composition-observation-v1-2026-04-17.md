# Composition Observation v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the observation artifact for how realized elements compose across different physical structures inside a section or sequence window.

This artifact exists because isolated realization metrics are not enough to judge sequencing quality.
The project needs a machine-readable description of cross-structure composition:

- attention separation
- attention competition
- local contrast
- novelty and repetition
- motion conflict or reinforcement
- palette conflict or reinforcement

## Core Rule

Single-realization metrics are descriptive primitives.
Composition metrics are where sequencing quality is judged.

That means:

- realization metrics should stay compact and representative
- composition metrics should carry more of the compositional burden

## Why This Matters

A sequencer can understand an individual realized effect and still produce weak art.
The art lives in how elements are combined across:

- time
- layers
- targets
- adjacent sections

The system therefore needs a separate observation layer for cross-model composition, not just more effect-local metrics.

## Role Boundary

`composition_observation_v1` is not:

- another effect-capability record
- another parameter-semantics record
- a selector shortcut bundle

It is the render-derived evidence layer for cross-model composition.

## Scope

This artifact may operate at:

- target pair
- model group
- section window
- adjacent-section window
- sequence slice

Suggested `scopeLevel` values:

- `target_pair`
- `model_group`
- `section_window`
- `section_transition`
- `sequence_slice`

## Artifact Shape

```json
{
  "artifactType": "composition_observation_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "elementRefs": [],
  "contrast": {},
  "hierarchy": {},
  "motionInteraction": {},
  "colorInteraction": {},
  "novelty": {},
  "notes": []
}
```

## Source

Suggested fields:

- `renderObservationRefs[]`
- `previewSceneWindowRefs[]`
- `checkpointId`
- `revisionBatchRef`

## Scope

Suggested fields:

- `projectId`
- `sequenceId`
- `sectionScope`
- `targetScope`
- `scopeLevel`
- `timeWindow`

## Element Refs

This should identify which realized elements are being compared across distinct physical structures.

Suggested fields per entry:

- `targetId`
- `effectName`
- `realizationId`
- `roleHint`

## Contrast

Purpose:
- describe whether different physical structures read as distinct enough inside the same composition

Suggested fields:

- `coverageContrast`
- `densityContrast`
- `textureContrast`
- `colorContrast`
- `timingContrast`
- `contrastAdequacy`

## Hierarchy

Purpose:
- describe how attention is distributed across structures

Suggested fields:

- `attentionSeparation`
- `attentionCompetition`
- `attentionStability`
- `occlusionRisk`
- `secondarySubordination`
- `leadSupportSeparation`
- `dominanceConflict`
- `focusStability`
- `maskingRisk`
- `supportSubordination`

Compatibility note:

- the `lead*` / `support*` field names may remain for pipeline compatibility
- neutral `attention*` fields are the preferred interpretation surface

## Motion Interaction

Purpose:
- describe whether motion behaviors across different structures reinforce or fight each other

Suggested fields:

- `motionConflict`
- `motionReinforcement`
- `cadenceAlignment`
- `directionalAgreement`
- `phaseClashRisk`

## Color Interaction

Purpose:
- describe whether palette behaviors across different structures reinforce or undermine the section read

Suggested fields:

- `paletteReinforcement`
- `paletteConflict`
- `colorDominanceConflict`
- `colorRoleSeparation`
- `multicolorCompetition`

## Novelty

Purpose:
- describe whether the local composition is too repetitive relative to nearby sequence context

Suggested fields:

- `recentPatternReuse`
- `recentMotionReuse`
- `recentPaletteReuse`
- `recentRoleReuse`
- `noveltyAdequacy`

## Initial Canonical Questions

The first implementation of this artifact should answer only a compact set of questions:

1. Is attention concentrated, weighted, or distributed?
2. Are active structures distinct enough from one another?
3. Are motion behaviors reinforcing or fighting each other?
4. Are palette behaviors reinforcing or fighting each other?
5. Is this section too similar to the recent surrounding context?

That is enough for the first usable composition layer.

## Constraint

Do not let this artifact expand into a giant metric catalog.

The goal is not exhaustive local description.
The goal is a compact compositional evidence layer that supports:

- critique
- revision planning
- translation-layer validation
- sequence-level learning

## Neutral Observation Rule

`composition_observation_v1` must stay neutral.

Hardcode:

- cross-structure measurements
- attention distribution
- contrast and occlusion
- motion and palette relationships

Do not hardcode:

- that every scene needs one lead
- that distributed attention is automatically weak
- that secondary structures are always supposed to subordinate

Judgment belongs later, relative to intent.

## Immediate Next Step

The next implementation pass should:

1. keep realization observation compact
2. derive a first `composition_observation_v1` from:
   - coverage
   - density
   - color behavior
   - timing/cadence
   - role separation
3. use that artifact in sequence critique before adding more isolated realization metrics
