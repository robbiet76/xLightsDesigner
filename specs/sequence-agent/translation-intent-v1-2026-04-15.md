# Translation Intent v1

Status: Draft
Date: 2026-04-15
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-15

## Purpose

Define the planning artifact that sits between:

- prompt interpretation
and
- xLights realization

This artifact exists so the sequencer can plan in terms of:

- composition
- prop roles
- intended visual behavior
- section development

before it decides:

- which effect family to use
- which parameters to apply
- which transitions or layers to use

## Role Boundary

`translation_intent_v1` is a sequencer-owned planning artifact.

It is not:

- a raw user prompt
- a direct xLights command plan
- a designer-only artistic brief

It is the sequencer’s normalized statement of:

- what picture it is trying to create
- how that picture should be distributed across props and time

## Why It Is Needed

Without a translation-intent layer, the system tends to jump directly from:

- prompt text
to
- effect family guesses

That creates:

- brittle selector behavior
- benchmark patching
- overuse of a few high-salience effects
- weak composition reasoning

The translation-intent layer forces the system to answer:

- what should lead
- what should support
- what should stay quiet
- what motion and texture should dominate
- how the section should evolve

before it selects xLights tools.

## Core Rule

The sequencer should choose the intended picture first and the xLights realization second.

`translation_intent_v1` is the artifact that captures the intended picture.

## Artifact Shape

```json
{
  "artifactType": "translation_intent_v1",
  "artifactVersion": 1,
  "intentId": "string",
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "compositionGoal": {},
  "sectionRoles": [],
  "targetRoles": [],
  "behaviorTargets": [],
  "realizationGuidance": {},
  "successChecks": [],
  "traceability": {}
}
```

## Source

Suggested fields:

- `promptText`
- `analysisHandoffRef`
- `sequenceArtisticGoalRef`
- `sequenceRevisionObjectiveRef`
- `directorProfileRef`
- `designHandoffRef`

## Scope

Suggested fields:

- `projectId`
- `sequenceId`
- `goalLevel`
  - `macro|section|group|prop`
- `sectionScope`
- `targetScope`
- `timeRangeMs`

## Composition Goal

This is the high-level compositional statement for the pass.

Suggested fields:

- `summary`
  - one short sentence describing the intended picture
- `primaryRead`
  - what should be most obvious to the viewer
- `secondaryRead`
  - what should support without competing
- `antiRead`
  - what the result must not feel like
- `developmentArc`
  - how the section should evolve over time

Examples:

- `Create a restrained texture-led bridge where the spinner read stays soft and secondary.`
- `Create a steady outro hold with minimal motion and a calm settled finish.`
- `Create a final-chorus radial spin that reads clearly and decisively as the lead gesture.`

## Section Roles

Section roles explain the musical/compositional function of the active section.

Suggested fields per role:

- `section`
- `role`
  - examples:
    - `setup`
    - `build`
    - `release`
    - `hold`
    - `accent`
    - `reveal`
- `intendedChange`
  - what should become more or less visible during the section
- `mustPreserve`
  - what should remain stable

## Target Roles

Target roles explain the compositional responsibility of each selected prop or prop group.

Suggested fields per target:

- `targetId`
- `role`
  - `lead|support|background|accent`
- `importance`
  - `primary|secondary|tertiary`
- `focusBehavior`
  - examples:
    - `steady_focus`
    - `quiet_support`
    - `background_fill`
    - `accent_only`
- `interactionNotes`
  - how the target should relate to nearby or related props

## Behavior Targets

These are the desired visual behaviors, expressed using `visual_behavior_v1`.

Suggested fields per target:

- `appliesTo`
  - `section` or `target`
- `targetId`
  - optional if section-level
- `behaviorSummary`
- `motion`
- `texture`
- `energy`
- `coverage`
- `hierarchy`
- `transitions`

There may be multiple behavior targets in one translation intent:

- one section-level behavior target
- one or more target-specific overrides

## Realization Guidance

This block constrains how the translation can be realized without dictating a single effect answer.

Suggested fields:

- `preferredFamilies`
  - soft guidance only
- `discouragedFamilies`
  - only when strongly contradictory to the intended picture
- `preferredPaletteModes`
- `preferredSharedSettingBehaviors`
- `allowedVariationAxes`
- `evidenceStrength`
  - examples:
    - `low`
    - `medium`
    - `high`

Important:

This block is not a rule table.
It is a bounded realization guide.

## Success Checks

These checks should evaluate the translated picture, not just effect identity.

Examples:

- `lead remains visually dominant`
- `support does not steal focus`
- `motion reads as soft texture rather than burst`
- `ending reads as a stable hold`
- `final section reads as radial spin rather than radial burst`

## Traceability

Suggested fields:

- `promptSummary`
- `selectedSections`
- `selectedTargets`
- `behaviorVocabularyRefs`
- `artisticGoalSummary`
- `revisionObjectiveSummary`

## Current Recommendation

In the current phase, `translation_intent_v1` should become the explicit planning seam between:

- direct sequence orchestration
- sequence-agent effect strategy
- eventual render-feedback comparison

This should happen before large new selector tweaks are added.

## Cleanup / Retirement Guidance

As `translation_intent_v1` is adopted:

- move prompt parsing and behavior inference into this layer
- reduce direct prompt-to-effect shortcuts in the selector
- retire heuristics that choose families before composition roles and behavior targets are established
- mark remaining shortcut logic with an explicit retirement condition

The project should not accumulate parallel planning paths where:

- one path reasons in translation intent
- another path still jumps directly from prompt words to effect families

That split would create long-term confusion and stale logic.

## Initial Adoption Checklist

- [ ] build `translation_intent_v1` from prompt + analysis + selected scope
- [ ] attach target roles before effect strategy selection
- [ ] attach behavior targets before family selection
- [ ] feed realization guidance into effect strategy as bounded hints
- [ ] compare realized output back to behavior targets once render feedback is complete
- [ ] retire superseded selector heuristics as those steps land

## Change Log

### 2026-04-15

- initial version created
- established the planning seam between prompt semantics and xLights realization
- added cleanup guidance so old selector logic is retired as the translation layer takes over
