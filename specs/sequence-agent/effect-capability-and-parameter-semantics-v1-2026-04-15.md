# Effect Capability And Parameter Semantics v1

Status: Draft  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Define how the sequencer learns the medium itself:

- what each effect can do
- what each setting changes
- how those changes alter rendered behavior
- how geometry changes the read
- how design language maps to those controls

This spec exists to prevent the rebuilt training system from collapsing back into:

- effect stereotypes
- model-use doctrine
- prompt-to-effect shortcuts

## Core Principle

The sequencer is being given:

- the brushes
- the paint
- the behavior of the medium

It is not being told:

- which brush belongs to which subject
- which model “should” use which effect
- that certain effects have fixed semantic meanings

Effects are tools.
Settings are control surfaces.
Rendered behavior is the thing being learned.

## Non-Negotiable Rules

### Rule 1: No Model-Use Doctrine

Training may teach:

- how an effect renders on different model geometries
- where an effect is stronger or weaker
- how settings behave differently by geometry

Training may not teach:

- tree effects
- spinner effects
- border effects
- “best effect for prop X”

Geometry fit is a rendering constraint, not an artistic doctrine.

### Rule 2: Color Language Is Not Effect Doctrine

Language such as:

- warm
- cool
- amber
- icy
- saturated
- muted

must map to:

- palette
- color blend
- brightness/read

not to:

- effect-family promotion or demotion

### Rule 3: Setting Semantics Are Primary Training Content

The sequencer must learn:

- what each effect setting changes visually
- which settings are high impact
- which settings mostly fine-tune
- which settings interact strongly with geometry
- which settings interact strongly with other settings
- which setting combinations reinforce, mask, or invert each other

This is as important as effect selection itself.

### Rule 4: Behavior Before Family

The training system must learn:

- rendered motion
- rendered texture
- rendered coverage
- rendered temporal development
- rendered hierarchy suitability

before:

- effect family labels

### Rule 5: No Effect-Level Scoring

Effect-level capability records are allowed to describe:

- what an effect can produce
- what controls it exposes
- what geometry constraints matter

They are not allowed to become direct scoring doctrine such as:

- effect `X` is the best answer for behavior `Y`
- effect `A` is inherently calm, aggressive, or elegant
- effect-family identity alone is sufficient for ranking

Selection and validation must happen at the realization level:

- effect family
- parameter settings
- shared settings
- palette
- layering
- geometry

That is the unit that rendered evidence can actually validate.

## Required Training Understanding

For each effect, the rebuilt training corpus must capture:

### 1. Effect Capability

What kinds of reads this effect can produce when configured differently.

Examples:

- hold
- shimmer
- chase
- spin
- burst
- diffuse fill
- segmented motion
- banded motion
- textured sparkle

### 2. Parameter Semantics

For each high-impact parameter:

- parameter name
- semantic role
- visual axis affected
- monotonic or non-monotonic behavior
- interaction sensitivity
- geometry sensitivity

Examples of semantic roles:

- speed control
- density control
- band count control
- radial spread control
- arm count control
- edge softness
- randomness amount
- directionality
- fill/coverage extent

### 3. Shared Setting Semantics

The sequencer must also understand shared settings as part of the medium:

- palette behavior
- blend behavior
- transition behavior
- layer behavior
- buffer style implications

These cannot remain generic metadata only.
They must participate in rendered-behavior understanding.


### 3A. Additive Interaction Semantics

The sequencer must learn compound control behavior, not just isolated control behavior.

That includes:

- parameter + parameter interactions
- parameter + shared-setting interactions
- parameter + palette-context interactions
- geometry-amplified interactions

The system must distinguish:

- reinforcing combinations
- masking combinations
- threshold combinations
- saturating combinations
- effectively independent combinations

A single-setting "ideal value" concept is not a valid training target.

### 4. Geometry-Conditioned Rendering

The same effect + setting region can render differently on:

- trees
- stars
- spinners
- arches
- canes
- matrices
- single-line props

So the corpus must teach:

- how the read changes
- not what the prop “should” use

## Required Artifact Direction

The rebuilt training pipeline must emit artifacts that describe:

- behavior capability
- parameter semantics
- shared-setting semantics
- additive interaction semantics
- geometry-conditioned rendering differences

It must not emit selector bundles that only say:

- these effect families match this phrase

## Proposed Core Record Layers

### Effect Capability Record

Describes what behaviors a given effect can produce across parameter regions.

Required fields:

- `effectName`
- `geometryProfile`
- `parameterRegion`
- `behaviorSignals`
- `renderOutcomeSignals`
- `confidence`
- `evidenceCount`

### Parameter Semantics Record

Describes what a setting changes visually.

Required fields:

- `effectName`
- `parameterName`
- `semanticAxis`
- `observedDirectionality`
- `interactionSensitivity`
- `geometrySensitivity`
- `behaviorImpactSummary`
- `evidenceCount`

### Shared Setting Semantics Record

Describes how non-effect-specific settings change the rendered result.

Required fields:

- `settingName`
- `settingValueRegion`
- `affectedBehaviorSignals`
- `interactionTargets`
- `confidence`
- `evidenceCount`

## Language Mapping Requirement

The sequencer must learn a mapping from design language to behavior axes and setting semantics.

Examples:

- `warm` -> palette temperature, glow handling, brightness/read balance
- `soft` -> edge softness, lower harsh contrast, restrained temporal change
- `crisp` -> edge definition, stronger contrast, clearer segmentation
- `restrained` -> lower energy envelope, reduced density, less aggressive motion
- `dense` -> higher occupancy, tighter spacing, stronger texture population

This mapping must drive:

- behavior targets
- parameter-region selection

not:

- direct fixed family selection

## Acceptance Criteria

The rebuilt training system is not acceptable unless:

- it can explain what a setting changes
- it can distinguish color language from effect language
- it can explain how an effect’s read changes by geometry
- it avoids turning geometry fit into prop-use doctrine
- it supports multiple valid realizations for the same design request

## Relationship To Other Specs

This spec extends:

- [translation-layer-training-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-layer-training-plan-2026-04-15.md)
- [visual-behavior-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/visual-behavior-v1-2026-04-15.md)
- [translation-intent-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-intent-v1-2026-04-15.md)
- [sequencer-training-reset-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-training-reset-plan-2026-04-15.md)

It should be used as the semantic foundation when defining:

- `behavior_capability_record_v1`
- parameter-semantics training records
- regenerated selector input artifacts

## Harness Requirement

Clean regeneration is blocked until the additive interaction harness defined in:

- [effect-setting-interaction-training-harness-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/effect-setting-interaction-training-harness-v1-2026-04-15.md)

can produce interaction-aware evidence for regenerated training artifacts.
