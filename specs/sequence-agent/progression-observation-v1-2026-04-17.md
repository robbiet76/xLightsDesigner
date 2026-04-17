# Progression Observation v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the observation artifact for how a sequence develops over time.

This is the `progression` problem:

- how one realized treatment hands off to the next
- whether a section evolves or stalls
- whether adjacent sections differentiate enough
- whether repetition is intentional or stale
- whether escalation and de-escalation are readable

This is not the same as:

- cross-model composition in a single window
- same-structure layering at a single moment
- isolated realization semantics

## Core Rule

`progression_observation_v1` is only for over-time evidence.

Use it when judging:

- one target across adjacent windows
- one section across opening/middle/closing slices
- adjacent sections in sequence order
- a bounded sequence slice where temporal development matters

Do not use it for:

- same-moment cross-model balance
- same-structure stacked effects at one checkpoint
- single-realization effect-setting interpretation

## Why This Matters

A sequence can have:

- good isolated realizations
- good composition
- good layering

and still fail because it does not progress.

That is where the system needs evidence for:

- handoff quality
- pacing
- escalation
- restraint
- repetition
- development

## Role Boundary

`progression_observation_v1` is not:

- another effect-capability record
- another realization observation
- a composition artifact
- a layering artifact

It is the render-derived evidence layer for over-time sequencing quality.

## Scope

Suggested `scopeLevel` values:

- `target_transition`
- `section_window`
- `section_transition`
- `sequence_slice`

## Artifact Shape

```json
{
  "artifactType": "progression_observation_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "windowRefs": [],
  "handoff": {},
  "development": {},
  "repetition": {},
  "energyArc": {},
  "notes": []
}
```

## Source

Suggested fields:

- `renderObservationRefs[]`
- `previewSceneWindowRefs[]`
- `sectionWindowRefs[]`
- `checkpointId`
- `revisionBatchRef`

## Scope

Suggested fields:

- `scopeLevel`
- `targetId`
- `sectionName`
- `sectionPair`
- `timeWindow`
- `sequenceWindow`

## Window Refs

Each entry should identify one ordered time window in the progression read.

Suggested fields per entry:

- `windowId`
- `targetId`
- `sectionName`
- `startMs`
- `endMs`
- `roleHint`

## Handoff

Purpose:
- describe whether the transition from one realized state to the next reads cleanly

Suggested fields:

- `handoffClarity`
- `continuityAdequacy`
- `transitionAbruptness`
- `arrivalReadability`

## Development

Purpose:
- describe whether the scoped window evolves enough over time

Suggested fields:

- `developmentStrength`
- `stagnationRisk`
- `escalationRead`
- `deescalationRead`

## Repetition

Purpose:
- describe whether local reuse feels intentional or stale

Suggested fields:

- `patternReuseLevel`
- `motionReuseLevel`
- `paletteReuseLevel`
- `stalenessRisk`

## Energy Arc

Purpose:
- describe whether the scoped temporal arc reads with a coherent energy shape

Suggested fields:

- `energyShapeClarity`
- `arcCoherence`
- `peakPlacementRead`
- `releaseRead`

## Initial Canonical Questions

The first implementation of this artifact should answer only a compact set of questions:

1. Does the handoff from one state to the next read cleanly?
2. Does the scoped window actually develop over time?
3. Is repetition intentional or stale?
4. Does the local energy arc read coherently?

That is enough for the first usable progression layer.

## Data Constraint

`progression_observation_v1` must be derived from ordered time-window evidence.

That means:

- it must not be faked from one static render checkpoint
- it must not be inferred from composition metrics alone
- it must not be inferred from layering metrics alone

The first version should only be implemented for proof cases where ordered render observations already exist.

## First Implemented Boundary

The first implementation of `progression_observation_v1` should be constrained to:

1. adjacent-window handoff quality
2. section-slice development
3. local repetition risk
4. energy arc coherence

Do not expand into broad sequence-level storytelling claims in the first version.
