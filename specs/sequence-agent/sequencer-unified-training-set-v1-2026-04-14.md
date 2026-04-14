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
- slots for before/after outcome memory

Important:
- the first release of this artifact may carry empty live-learning slots
- that is still correct if the framework is explicit and durable

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
    "status": "seeded_empty",
    "storageClass": "general_training",
    "roleOutcomeMemory": {}
  }
}
```

## Design Intent

The unified training set is not a replacement for the Stage 1 bundle.

It is the next container around it.

Meaning:
- Stage 1 baseline becomes the trained foundation
- Phase 3 live outcome memory becomes the evolving layer
- both live in one explicit general-training artifact

## What Should Be Stored Here Next

The next population pass should add:
- effect-family outcome evidence by revision role
- effect-family outcome evidence by request scope
- effect-family outcome evidence by unresolved prior-pass signal
- effect-family outcome evidence by target/model bucket

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

## Acceptance Standard

This framework is correct when:
- old Stage 1 effect training and new live learning share one common artifact boundary
- general training and preference learning are explicitly separated
- runtime vocabulary and training vocabulary are aligned
- future cloud migration can upload shared training without uploading user taste data
