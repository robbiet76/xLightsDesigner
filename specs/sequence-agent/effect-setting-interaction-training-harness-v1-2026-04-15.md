# Effect Setting Interaction Training Harness v1

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Define the training harness requirements for learning additive and interactive effect-setting behavior.

This spec exists because a sequencer that only learns isolated single-parameter semantics will not understand the medium well enough to translate design requests reliably.

The rebuilt training system must learn:

- what each setting does on its own
- how settings combine
- which settings reinforce each other
- which settings mask or flatten each other
- which interactions are geometry-conditioned
- which interactions are strong enough to matter during realization

## Core Principle

Effect settings are additive until proven otherwise.

The system must not assume:

- one ideal setting per effect
- one dominant parameter explains the read
- isolated parameter sweeps are sufficient training evidence

The system must learn rendered behavior from:

- parameter regions
- shared-setting context
- interaction context
- geometry-conditioned outcomes

## Non-Negotiable Rules

### Rule 1: No Single-Parameter Illusion

A setting-semantics pass that only varies one parameter at a time is not enough for clean regeneration.

Single-parameter sweeps are necessary for:

- initial axis discovery
- monotonicity detection
- coarse region boundaries

They are not sufficient for:

- final parameter semantics
- realization ranking
- design-language translation

### Rule 2: Interaction Evidence Is First-Class

The regenerated training artifacts must treat parameter interaction evidence as first-class evidence, not a note field.

That includes:

- effect-local parameter pairs
- effect parameter plus shared setting interactions
- palette and brightness interactions where they materially change the read
- geometry-amplified interaction behavior

### Rule 3: Shared Settings Participate In Meaning

Shared settings are part of the medium.

Examples:

- palette strategy
- buffer style
- layer method
- effect layer mix
- transitions
- brightness and blend context

They must be included in interaction training when they materially affect rendered behavior.

### Rule 4: Harness Acceptance Is Batch-Gated

No clean regeneration run may be treated as valid until the interaction harness:

- generates interaction-aware records
- regenerates bundles from those records
- passes the full batch harness

## Training Questions The Harness Must Answer

For each effect, parameter set, and geometry profile, the harness must be able to answer:

1. Which parameters are visually high impact on their own?
2. Which parameters materially change the effect only in combination with others?
3. Which parameter regions are stable across geometries?
4. Which parameter interactions are geometry-sensitive?
5. Which shared settings change the meaning of a parameter region?
6. Which combinations produce distinct behavior clusters instead of fine-tuning variants?
7. Which combinations collapse or mask each other?

## Required Harness Stages

### Stage 1: Isolated Axis Discovery

Use bounded single-parameter sweeps to determine:

- high-impact parameters
- low-impact parameters
- preliminary region boundaries
- monotonic vs non-monotonic parameters
- early geometry sensitivity

Outputs:

- candidate value regions
- candidate interaction targets
- early semantic-axis hypotheses

### Stage 2: Pairwise Interaction Sweeps

Run bounded pairwise sweeps for:

- high-impact parameter pairs
- known interaction-suspected pairs
- parameter plus shared-setting pairs
- geometry-amplified pairs

The goal is not exhaustive combinatorics.
The goal is enough evidence to distinguish:

- additive reinforcement
- masking
- inversion
- threshold behavior
- saturation/plateau behavior

Outputs:

- interaction effect summaries
- revised value-region boundaries
- interaction-sensitive behavior clusters

### Stage 3: Bounded Multi-Setting Confirmation

For the most interaction-sensitive regions, run bounded multi-setting confirmations.

This stage exists to avoid false confidence from pairwise-only evidence.

Required when:

- pairwise interactions are strong
- shared settings substantially alter the read
- the effect is known to be highly compound
- a geometry profile amplifies the interaction

Outputs:

- confirmed compound-behavior observations
- interaction stability notes
- confidence upgrades or downgrades

### Stage 4: Regeneration And Batch Acceptance

Use the interaction-aware records to regenerate:

- capability-first selector inputs
- parameter semantics bundles
- shared-setting semantics bundles

Then validate through:

- focused record-generation checks
- bundle-generation checks
- full batch harness

## Required Record Impact

The harness must emit evidence that can populate:

- `behavior_capability_record_v1`
- `parameter_semantics_record_v1`
- `shared_setting_semantics_record_v1`
- `parameter_interaction_semantics_record_v1`

A clean regeneration run is blocked until the fourth record type exists.

## New Canonical Record Requirement

### `parameter_interaction_semantics_record_v1`

Purpose:
- describe how combinations of settings alter rendered behavior

Minimum required fields:

- `effectName`
- `geometryProfile`
- `primaryParameter`
- `secondaryParameter`
- `secondarySettingKind`
  - `effect_parameter|shared_setting|palette_context`
- `interactionRegion`
- `interactionType`
  - `reinforcing|masking|threshold|inverting|saturating|independent`
- `affectedSignals`
- `behaviorImpactSummary`
- `geometrySensitivity`
- `confidence`
- `evidenceCount`
- `traceability`

## Manifest And Runner Requirements

The harness must support:

- isolated sweeps
- interaction manifests
- bounded confirmation manifests
- consolidated regeneration reporting

Existing `*-interactions-v1.json` manifests are preserved inputs and must be incorporated into the new regeneration path.

The harness should also support generation of new interaction manifests from:

- registry high-impact flags
- prior screening evidence
- geometry-amplification signals

## Evidence And Traceability Requirements

Every interaction conclusion must be traceable back to:

- manifest ids
- render record ids
- geometry profiles
- shared-setting contexts
- regeneration run id

No interaction record may exist as a hand-authored semantic claim.

## Clean Run Gate

A clean regeneration run is not permitted until all of the following are true:

- additive interaction capture is part of the regeneration harness
- interaction-aware records are emitted
- regenerated bundles consume those records
- the full batch harness passes from those regenerated bundles
- one consolidated regeneration report records the interaction evidence coverage

## Deliverables

The next implementation slice must produce:

1. a regeneration harness entrypoint that consumes both sweep and interaction evidence
2. a record generator for `parameter_interaction_semantics_record_v1`
3. a coverage report for missing interaction evidence
4. one consolidated regeneration report per batch run
