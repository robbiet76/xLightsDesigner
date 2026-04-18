# Intent Envelope v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the neutral intent contract that sits between prompt interpretation and generative sequencing decisions.

`intent_envelope_v1` is the anchor for generative sequencing.

It exists so the system can say:

- what kind of visual outcome is wanted
- what kind of outcome is not wanted
- how much variation is acceptable
- what should remain unconstrained

without prematurely deciding:

- which effect family to use
- which prop must lead
- which composition shape is best
- which one candidate should win

## Core Rule

`intent_envelope_v1` is descriptive, not prescriptive.

It defines the intended space of successful outcomes.
It does not choose one realization.

That means:

- it is narrower than the original prompt
- it is broader than a specific sequencing plan

## Why This Matters

Without an explicit intent envelope, the system will drift into one of two bad modes:

1. prompt-to-effect shortcuts
- vague intent gets collapsed into canned realization choices

2. metric-only critique
- rendered outputs get judged without a clear artistic target

The intent envelope prevents both.

It gives the sequencer agent a stable basis for:

- candidate generation
- candidate comparison
- render critique
- revision

## Role Boundary

`intent_envelope_v1` is not:

- a realization candidate
- a control plan
- a sequencing batch
- a critique artifact

It is the neutral target description that candidate realizations are trying to satisfy.

## Artifact Shape

```json
{
  "artifactType": "intent_envelope_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "attention": {},
  "temporal": {},
  "spatial": {},
  "texture": {},
  "color": {},
  "layering": {},
  "novelty": {},
  "constraints": {},
  "notes": []
}
```

## Source

Suggested fields:

- `promptRef`
- `translationIntentRef`
- `artisticGoalRef`
- `designHandoffRef`
- `revisionObjectiveRef`

## Scope

Suggested fields:

- `scopeLevel`
- `sequenceId`
- `sectionName`
- `timeWindow`
- `targetScope`

Suggested `scopeLevel` values:

- `moment`
- `section`
- `section_transition`
- `sequence_slice`

## Attention

Purpose:
- describe how attention should be distributed, without assuming a single lead is always correct

Suggested fields:

- `profile`
- `stability`
- `competitionTolerance`
- `dominanceTolerance`

Suggested `profile` values:

- `concentrated`
- `weighted`
- `distributed`
- `diffuse`
- `bifocal`
- `unconstrained`

## Temporal

Purpose:
- describe how the passage should behave over time, without assuming constant escalation

Suggested fields:

- `profile`
- `variationLevel`
- `handoffCharacter`
- `energyShape`

Suggested `profile` values:

- `steady`
- `pulsing`
- `modulated`
- `evolving`
- `alternating`
- `unconstrained`

Suggested `energyShape` values:

- `hold`
- `build`
- `release`
- `wave`
- `flat`
- `unconstrained`

## Spatial

Purpose:
- describe footprint and scene occupancy without prescribing one ideal spread

Suggested fields:

- `footprint`
- `coverageBias`
- `regionBias`
- `symmetryPreference`

Suggested `footprint` values:

- `narrow`
- `moderate`
- `broad`
- `full_scene`
- `unconstrained`

## Texture

Purpose:
- describe the intended tactile quality of the render

Suggested fields:

- `primaryCharacter`
- `density`
- `edgeSharpness`
- `contrastPreference`

Suggested `primaryCharacter` values:

- `smooth`
- `sparkling`
- `segmented`
- `banded`
- `diffuse`
- `solid`
- `unconstrained`

## Color

Purpose:
- describe how color should behave without locking one palette strategy too early

Suggested fields:

- `role`
- `spread`
- `transitionRate`
- `conflictTolerance`

Suggested `role` values:

- `single_role`
- `limited_multicolor`
- `mixed`
- `high_variety`
- `unconstrained`

## Layering

Purpose:
- describe whether same-structure overlap should separate, reinforce, or stay minimal

Suggested fields:

- `sameStructureDensity`
- `separationNeed`
- `colorInteractionPreference`
- `cadenceInteractionPreference`

## Novelty

Purpose:
- define how much reuse or divergence is acceptable relative to recent sequence context

Suggested fields:

- `reuseTolerance`
- `explorationPressure`
- `variationPriority`

Suggested values may be:

- `low`
- `medium`
- `high`
- `unconstrained`

## Constraints

Purpose:
- capture hard or soft limits that the candidate generator must respect

Suggested fields:

- `targetExclusions[]`
- `targetRequirements[]`
- `layeringAvoidance[]`
- `paletteAvoidance[]`
- `timingAvoidance[]`
- `mustPreserve[]`

## Generative Use

`intent_envelope_v1` should be the input to `realization_candidates_v1`.

The candidate generator should ask:

- what realizations could satisfy this envelope?
- what materially different options exist inside this envelope?
- how can we preserve novelty without leaving the envelope?

That is the correct generative-sequencing boundary.

## Evaluation Use

Render critique should not ask:

- did the output match one expected effect stack?

It should ask:

- how closely did the output fit this envelope?

This allows:

- multiple valid realizations
- non-deterministic creativity
- revision without template lock-in

## Neutral Observation Rule

`intent_envelope_v1` must not encode artistic recipes.

Hardcode:

- neutral target dimensions
- tolerances
- allowed variation bands
- explicit constraints

Do not hardcode:

- one ideal realization per prompt type
- one ideal lead/support relationship per section type
- one ideal energy shape per music role

## Immediate Next Step

The next artifact should be `realization_candidates_v1`.

That artifact should:

1. take `intent_envelope_v1` as input
2. generate several materially different valid realizations
3. expose fit, novelty, and risk as comparable properties
4. avoid collapsing to one deterministic answer too early
