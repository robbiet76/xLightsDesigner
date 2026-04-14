# Sequencer Unified Training Set v1

Status: Active  
Date: 2026-04-14  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-14

## Purpose

Define the common training framework that replaces the old split between:
- Stage 1 trained effect selection data
- newer live-loop revision learning

This framework exists so new learning is not appended as ad hoc runtime logic.

It creates one general-training surface for:
- trained baseline effect knowledge
- live effect-family outcome learning
- role/scope-conditioned revision evidence

It explicitly does not absorb:
- user preference learning
- director taste learning
- project-style preference state

Those remain separate.

It also must not treat one fixture model as a universal stand-in for every user model of the same type.
Generalization must be based on:
- model type
- geometry profile
- portable structural traits
- representative configuration coverage

not:
- user-defined model names
- local channel assignments
- local file paths
- section labels like `Chorus 1`
- live planner target ids like `MegaTree` or `SpinnerHero`
- any runtime-specific use-case naming

The live planner may match shared priors to a concrete request context.
That runtime context must not be written back into shared training artifacts.

## Core Rule

All sequencer training must be classified as one of:

1. `general_training`
- portable, shareable sequencing knowledge

2. `preference_training`
- user/project/director taste bias

`sequencer_unified_training_set_v1` only contains `general_training`.

## Why This Exists

Without a common framework, the project drifts into three disconnected layers:
- old exported render-training bundle
- new live memory logic
- hand-authored runtime heuristics

That makes future cloud migration and training refreshes brittle.

The unified training set fixes that by making the training surface explicit.

## Artifact Shape

```json
{
  "artifactType": "sequencer_unified_training_set_v1",
  "artifactVersion": "1.0",
  "generatedAt": "ISO-8601",
  "description": "string",
  "sources": {},
  "boundaries": {},
  "runtimeContracts": {},
  "effects": []
}
```

## Sources Section

The artifact must preserve both training eras:

### 1. Stage 1 baseline
- exported effect bundle
- selector-ready evidence
- supported model buckets
- supported geometry profiles
- intent tags
- pattern families
- retained parameters

### 2. Live-learning framework
- revision role vocabulary
- request scope vocabulary
- review level vocabulary
- legacy role-to-family seed priors
- slots for before/after outcome memory

Important:
- the first release of this artifact may carry seed priors with no harvested outcome records yet
- that is still correct if the framework is explicit, durable, and clearly distinguished from outcome evidence

## Boundaries Section

Must define:

### `generalTraining`
- purpose: portable shared sequencing knowledge
- examples:
  - effect-family success by role
  - effect-family failure by scope
  - rendered outcome shifts after revision

### `preferenceTraining`
- purpose: user/project taste bias
- examples:
  - prefers restrained shimmer over bold bars
  - prefers localized staging in bridges
  - dislikes full-house final choruses

Required rule:
- `preferenceTraining` is excluded from this artifact

## Runtime Contracts

This artifact must carry the active vocabulary used by the live loop:

### Revision roles
- `strengthen_lead`
- `reduce_competing_support`
- `widen_support`
- `increase_section_contrast`
- `add_section_development`

### Request scope modes
- `whole_sequence`
- `section_selection`
- `section_target_refinement`
- `target_refinement`

### Review levels
- `macro`
- `section`
- `group`
- `model`
- `effect`

This makes training artifacts and live runtime use the same vocabulary.

## Effect Entry Shape

Each effect entry should join:
- trained baseline facts
- current capability metadata
- future live outcome memory

Suggested shape:

```json
{
  "effectName": "Bars",
  "baseline": {
    "currentStage": "selector_ready",
    "selectorReady": true,
    "selectorEvidence": {},
    "supportedModelTypes": [],
    "supportedGeometryProfiles": [],
    "intentTags": [],
    "patternFamilies": [],
    "retainedParameters": []
  },
  "capability": {
    "family": "rhythmic",
    "supportedSettingsIntent": [],
    "supportedPaletteIntent": [],
    "supportedLayerIntent": [],
    "supportedRenderIntent": []
  },
  "liveOutcomeLearning": {
    "status": "seeded_empty|populated",
    "storageClass": "general_training",
    "seedRolePriors": [],
    "roleOutcomeMemory": {},
    "parameterOutcomeMemory": {},
    "sharedSettingOutcomeMemory": {}
  }
}
```

## Seed Priors

The unified training set may include `seedRolePriors` derived from older runtime routing logic.

These are valid `general_training` inputs when they are:
- portable
- effect-family-level
- not user-taste-specific

They are not the same as harvested outcome evidence.

Required distinction:
- `seedRolePriors` = legacy general sequencing priors
- `roleOutcomeMemory` = durable observed outcome evidence

## Design Intent

The unified training set is not a replacement for the Stage 1 bundle.

It is the next container around it.

Meaning:
- Stage 1 baseline becomes the trained foundation
- legacy role-family priors become explicit seed guidance inside the same artifact
- Phase 3 live outcome memory becomes the evolving evidence layer
- both live in one explicit general-training artifact

## What Should Be Stored Here Next

The next population pass should add:
- effect-family outcome evidence by revision role
- effect-family outcome evidence by request scope
- effect-family outcome evidence by unresolved prior-pass signal
- effect-family outcome evidence by target/model bucket
- effect-family outcome evidence by generic shared setting axes such as:
  - `layerMethod`
  - `effectLayerMix`
  - `bufferStyle`
  - `inTransitionType`
  - `outTransitionType`
  - `layerMorph`

The first durable live-learning record type for this is:
- `effect_family_outcome_record_v1`

That record should capture:
- chosen effect family
- request scope
- revision level
- revision roles
- prior unresolved signals
- post-pass unresolved signals
- resolved/persisted/new signals
- coarse rendered outcome reads

Examples:
- `strengthen_lead` on tree-like focal props: `Bars` improved lead match
- `reduce_competing_support` on support clusters: `On` reduced spread but also flattened motion
- `add_section_development` on section work: `Shimmer` improved temporal modulation on restrained moments

These belong in `general_training`.

## What Must Stay Out

Do not store these here:
- user accepted this because they like cleaner looks
- this director prefers right-heavy staging
- this project tends to reject broad-house choruses
- model names like `George`
- local sequence paths
- local working file paths
- local start/end channel assignments

Those belong in:
- director profile
- project preference store
- future preference-learning artifacts

## Initial Implementation

Builder:
- [build-unified-training-set.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-unified-training-set.mjs)

Outcome harvester:
- [harvest-effect-outcome-records.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/harvest-effect-outcome-records.mjs)

Initial generated artifact:
- [sequencer-unified-training-set-v1.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/sequencer-unified-training-set-v1.json)

Outcome catalog:
- [README.md](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/effect-family-outcomes/README.md)

Settings coverage report:
- [effect-settings-coverage-report-v1.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/effect-settings-coverage-report-v1.json)

## Configuration Representativeness

Shared screening evidence must preserve how representative the sampled fixtures are without leaking user-specific identity.

Required behavior:
- shared records may keep portable configuration traits
- shared records must remove user-defined model names
- shared records must remove local path fields
- shared records must remove local channel-range identity fields

Per-effect screening summaries should expose:
- sampled model types
- sampled geometry profiles
- configuration profile summaries
- configuration coverage status
- derived parameter priors

Configuration profiles should be derived from portable traits such as:
- model type
- geometry profile
- analyzer family
- display style
- string type
- node-count bucket
- channels per node
- normalized structural settings

Suggested coverage states:
1. `none`
- no shared screening evidence yet

2. `single_reference_per_geometry`
- one portable reference configuration captured for each sampled geometry profile

3. `multi_configuration_sampled`
- more than one portable configuration captured for at least one geometry profile

This allows the sequencer to reason:
- "this prior applies strongly to arch_single reference fixtures"
- without falsely claiming:
- "this is universal for every user-defined arch"

## Derived Parameter Priors

The unified training set should expose a bounded parameter-prior layer derived from screened motion-aware evidence.

This layer is not unrestricted auto-tuning.

It should summarize, per:
- effect
- geometry profile
- parameter
- palette mode

the observed anchor behaviors from screening evidence.

Suggested contents:
- screened parameter name
- geometry profile
- palette mode
- distinct tested anchor count
- configuration coverage status
- confidence
- anchor profiles

Each anchor profile should summarize:
- parameter value
- sample count
- temporal signature hints
- mean temporal motion
- mean temporal color delta
- mean temporal brightness delta
- mean nonblank ratio
- compact behavior hints
- structural signatures represented

Design rule:
- this layer may recommend bounded anchor choices
- it must not act as free-form parameter tuning authority

Its purpose is to let the sequencer reason:
- "for this geometry and palette mode, these settings produced clearly different animated behavior"

not:
- "search the entire parameter space blindly"

## Shared Setting Outcome Memory

The unified training set should also retain a bounded live-outcome layer for shared render-path settings that are not specific to any one effect family parameter schema.

These are generic portable axes such as:
- layer method
- layer mix
- buffer style
- in transition type
- out transition type
- layer morph enablement

This layer should:
- store only normalized generic setting names and values
- remain independent of section labels, target ids, and user-defined model names
- summarize whether a shared setting choice tended to improve or worsen a pass

This allows the sequencer to learn:
- when additive or highlight layering tends to help
- when transition types like fade or slide bars tend to help
- when non-default buffer styles help or create risk

without turning those settings into hardcoded universal defaults.

## Acceptance Standard

This framework is correct when:
- old Stage 1 effect training and new live learning share one common artifact boundary
- general training and preference learning are explicitly separated
- runtime vocabulary and training vocabulary are aligned
- future cloud migration can upload shared training without uploading user taste data
- parameter coverage is explicitly reported without claiming exhaustive setting control where it does not exist
