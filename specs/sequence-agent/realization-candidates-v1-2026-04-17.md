# Realization Candidates v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the candidate-set artifact used by the sequencer agent to support generative sequencing.

`realization_candidates_v1` should hold multiple materially different valid proposals for the same `intent_envelope_v1`.

This artifact exists to prevent the system from collapsing into:

- one deterministic answer
- effect-family-first planning
- hidden heuristic ranking disguised as creativity

## Core Rule

`realization_candidates_v1` must preserve multiple valid options long enough for real comparison.

The candidate set should not collapse to one choice until the sequencer agent applies:

- intent fit
- sequence context
- novelty pressure
- bounded exploration
- render-backed critique when available

## Role Boundary

`realization_candidates_v1` is not:

- the final execution plan
- the critique artifact
- the render validation artifact

It is the bounded generative search surface that sits between:

- `intent_envelope_v1`
- final sequencing decisions

## Artifact Shape

```json
{
  "artifactType": "realization_candidates_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "candidates": [],
  "notes": []
}
```

## Source

Suggested fields:

- `intentEnvelopeRef`
- `translationIntentRef`
- `artisticGoalRef`
- `revisionObjectiveRef`
- `sequenceContextRef`

## Scope

Suggested fields:

- `scopeLevel`
- `sectionName`
- `timeWindow`
- `targetScope`

## Candidate Entry Shape

Each candidate should be a full proposed realization approach, not just an effect-family hint.

Suggested fields:

- `candidateId`
- `summary`
- `targetStrategy`
- `attentionProfile`
- `temporalProfile`
- `compositionProfile`
- `layeringProfile`
- `realizationRefs[]`
- `fitSignals`
- `noveltySignals`
- `riskSignals`
- `selectionHints`

## Target Strategy

Purpose:
- describe how the candidate distributes work across targets

Suggested fields:

- `primaryTargets[]`
- `secondaryTargets[]`
- `excludedTargets[]`
- `exclusivityGroupRefs[]`

## Attention Profile

Purpose:
- summarize the intended attention structure of this candidate

Suggested fields:

- `profile`
- `stability`
- `competitionLevel`

## Temporal Profile

Purpose:
- summarize the intended time behavior of this candidate

Suggested fields:

- `profile`
- `variationLevel`
- `energyShape`

## Composition Profile

Purpose:
- summarize the cross-structure read the candidate is aiming for

Suggested fields:

- `footprint`
- `contrastStrategy`
- `colorStrategy`

## Layering Profile

Purpose:
- summarize same-structure behavior where layering is used

Suggested fields:

- `sameStructureDensity`
- `separationStrategy`
- `cadenceStrategy`
- `layerOrderStrategy`
- `modelOrderStrategy`
- `layerEditStrategy`

Layering candidates should describe the intended observed result of the stack, not only the newly created row. A candidate may realize its outcome by adding an effect layer, updating an existing layer, deleting a layer, changing timing, reordering layers, or adjusting display/model order when that order affects the render.

## Realization Refs

Each candidate should reference one or more bounded realizations.

Suggested per-entry fields:

- `targetId`
- `effectName`
- `settingsRef`
- `paletteRef`
- `layerIntent`
- `layerIndex`
- `layerOrderRole`
- `displayOrderRole`
- `timingRole`

## Fit Signals

Purpose:
- describe why this candidate is valid for the current envelope

Suggested fields:

- `attentionFit`
- `temporalFit`
- `spatialFit`
- `textureFit`
- `colorFit`
- `overallFit`

Important rule:

- these are candidate-comparison signals
- not final artistic truth

## Novelty Signals

Purpose:
- keep the system from repeating itself

Suggested fields:

- `recentTargetReuse`
- `recentMotionReuse`
- `recentPaletteReuse`
- `recentCompositionReuse`
- `noveltyScore`

## Risk Signals

Purpose:
- expose likely failure modes before execution

Suggested fields:

- `attentionConflictRisk`
- `layeringConflictRisk`
- `complexityRisk`
- `renderUncertainty`

## Selection Hints

Purpose:
- provide non-binding guidance to the sequencer agent

Suggested fields:

- `explorationWeight`
- `safetyWeight`
- `revisionFriendliness`

These are hints, not deterministic rules.

## Generative Sequencing Rule

The sequencer agent should not choose candidates by fixed rank alone.

It should choose from the viable candidate band using:

- fit to intent envelope
- novelty pressure
- sequence context
- bounded exploration

That is how the system stays generative instead of deterministic.

## Evaluation Loop

After one candidate is chosen and realized:

1. render the result
2. generate neutral render evidence
3. critique against the `intent_envelope_v1`
4. revise the candidate set or refine the chosen candidate

This turns sequencing into:

- propose
- test
- compare
- revise

rather than:

- classify
- apply recipe

## Immediate Next Step

The next implementation step should be:

1. build a minimal `realization_candidates_v1` generator
2. ensure it always emits multiple materially different candidates
3. attach novelty and risk signals without turning them into hardcoded decision rules
