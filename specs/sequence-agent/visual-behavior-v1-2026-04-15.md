# Visual Behavior v1

Status: Draft
Date: 2026-04-15
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-15

## Purpose

Define the shared visual vocabulary used by the translation layer.

This artifact exists so the system can reason in terms of:

- visual behavior
- motion character
- texture
- hierarchy
- energy
- coverage
- transition character

instead of collapsing directly to:

- effect family names
- benchmark-only heuristics
- hand-authored prompt-to-effect mappings

`visual_behavior_v1` is intended to become the common intermediate language between:

- prompt interpretation
- translation-intent planning
- medium training
- render critique
- live validation

## Role Boundary

`visual_behavior_v1` is a shared semantic contract.

It is not:

- a direct xLights effect schema
- a designer style guide
- a benchmark scenario file

It is the normalized vocabulary the system uses to describe the picture it is trying to paint.

## Why It Is Needed

Without a stable behavior vocabulary, the project drifts toward:

- effect-family stereotypes
- overfitted benchmark logic
- inconsistent planning language across subsystems
- difficulty comparing intended behavior to rendered behavior

The system needs a common way to say:

- what kind of motion is intended
- what kind of texture is intended
- how restrained or aggressive the result should feel
- what role each prop should play

## Core Rule

All new translation-layer work should prefer visual behavior labels over raw effect-family labels whenever possible.

Effect families are realization tools.
Visual behavior is the semantic target.

## Artifact Shape

```json
{
  "artifactType": "visual_behavior_v1",
  "artifactVersion": 1,
  "behaviorId": "string",
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "motion": {},
  "texture": {},
  "energy": {},
  "coverage": {},
  "hierarchy": {},
  "transitions": {},
  "variationPolicy": {},
  "traceability": {}
}
```

This contract is intended to support both:

- intended behavior targets
- observed behavior summaries

The same vocabulary should be usable on both sides.

## Scope

Suggested fields:

- `projectId`
- `sequenceId`
- `goalLevel`
  - `macro|section|group|prop|effect`
- `sectionScope`
- `targetScope`

## Motion

Motion describes how the visual state changes over time.

Suggested fields:

- `primaryMotion`
  - examples:
    - `hold`
    - `drift`
    - `sweep`
    - `chase`
    - `pulse`
    - `burst`
    - `spin`
    - `shimmer`
    - `ripple`
- `secondaryMotion`
  - optional supporting motion
- `motionPacing`
  - examples:
    - `slow`
    - `measured`
    - `fast`
    - `urgent`
- `motionContinuity`
  - examples:
    - `continuous`
    - `stepped`
    - `intermittent`
- `motionDirectionality`
  - examples:
    - `none`
    - `directional`
    - `radial`
    - `bidirectional`

## Texture

Texture describes how the visual surface reads in a moment.

Suggested fields:

- `primaryTexture`
  - examples:
    - `smooth`
    - `diffuse`
    - `sparkling`
    - `segmented`
    - `solid`
    - `banded`
    - `fragmented`
- `textureClarity`
  - examples:
    - `soft`
    - `readable`
    - `crisp`
- `textureDensity`
  - examples:
    - `airy`
    - `moderate`
    - `dense`

## Energy

Energy describes the perceived intensity of the visual idea.

Suggested fields:

- `energyLevel`
  - examples:
    - `restrained`
    - `moderate`
    - `aggressive`
- `energyEnvelope`
  - examples:
    - `flat`
    - `build`
    - `release`
    - `bloom`
    - `hit_then_decay`

## Coverage

Coverage describes how much of the available space is visually engaged.

Suggested fields:

- `coverageLevel`
  - examples:
    - `isolated`
    - `focused`
    - `broad`
    - `full`
- `coverageDistribution`
  - examples:
    - `centered`
    - `edge_weighted`
    - `balanced`
    - `wandering`

## Hierarchy

Hierarchy describes the compositional role of a prop or section.

Suggested fields:

- `role`
  - examples:
    - `lead`
    - `support`
    - `background`
    - `accent`
- `dominanceLevel`
  - examples:
    - `subordinate`
    - `balanced`
    - `dominant`
- `focusStability`
  - examples:
    - `steady_focus`
    - `shared_focus`
    - `moving_focus`

## Transition Character

Transitions describe how changes enter and leave.

Suggested fields:

- `entryCharacter`
  - examples:
    - `gentle`
    - `dissolving`
    - `directional`
    - `hard`
    - `stepping`
- `exitCharacter`
  - same vocabulary
- `sectionHandoffCharacter`
  - examples:
    - `continuous`
    - `contrasting`
    - `revealing`
    - `punctuated`

## Variation Policy

This keeps the project from converging toward one benchmark-winning realization.

Suggested fields:

- `mustStayCoherent`
  - what parts of the intended read must remain stable
- `allowedVariationAxes`
  - examples:
    - `family_choice`
    - `parameter_anchor`
    - `palette_mode`
    - `transition_character`
    - `layer_method`
- `preferredVariationLevel`
  - examples:
    - `low`
    - `moderate`
    - `high`

The purpose of this block is to support:

- consistent intent
- variable realization

That is how the system stays interesting without becoming random.

## Current Recommendation

For the current phase:

- start using this vocabulary in specs, critiques, and validation design
- use it as the target language for new behavior-oriented benchmark assertions
- use it to group and summarize training outcomes

Do not wait for the entire system to adopt the full contract before starting to use the vocabulary.

## Cleanup / Retirement Guidance

As `visual_behavior_v1` is adopted:

- retire prompt-to-family shortcut logic when a behavior expression can replace it
- retire benchmark assertions that only encode effect identity when a stronger behavior assertion is available
- avoid adding new family-specific heuristics unless they are clearly temporary and tagged as such

Any new hardcoded selector rule should be documented as one of:

- `safety`
- `schema_normalization`
- `benchmark_temporary`
- `retire_after_behavior_mapping`

## Change Log

### 2026-04-15

- initial version created
- established the shared behavior vocabulary categories needed by the translation layer
- added variation guidance so the system can stay coherent without collapsing into sameness
