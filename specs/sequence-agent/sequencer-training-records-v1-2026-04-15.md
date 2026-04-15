# Sequencer Training Records v1

Status: Draft  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Define the canonical record shapes for the sequencer training reset.

These records are the foundation for rebuilding selector input artifacts from preserved raw evidence.

They exist to encode:

- what an effect can do
- what a parameter changes
- what a shared setting changes
- how geometry changes the rendered read
- how observed render outcomes feed back into recommendation quality

They do not exist to encode:

- model-use doctrine
- effect-family stereotypes
- prompt-to-effect shortcuts

This spec is the implementation companion to:

- [sequencer-training-reset-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-training-reset-plan-2026-04-15.md)
- [effect-capability-and-parameter-semantics-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/effect-capability-and-parameter-semantics-v1-2026-04-15.md)
- [visual-behavior-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/visual-behavior-v1-2026-04-15.md)

## Core Rules

### Rule 1: Behavior Is The Training Target

Every record must be interpretable in terms of:

- behavior
- parameter semantics
- render outcome

not just effect identity.

### Rule 2: Geometry Is A Conditioning Variable

Geometry/profile may affect:

- behavior strength
- clarity
- coverage
- temporal read

Geometry must not imply:

- recommended model ownership for an effect

### Rule 3: Language Maps To Behavior And Controls

Prompt/design language must be learnable against:

- behavior axes
- parameter axes
- shared setting axes

not directly against effect-family doctrine.

## Record Set

The rebuild defines four primary training records.

### 1. `behavior_capability_record_v1`

Purpose:
- describe what an effect + parameter region + geometry can render

Shape:

```json
{
  "artifactType": "behavior_capability_record_v1",
  "artifactVersion": "1.0",
  "recordId": "string",
  "createdAt": "ISO-8601",
  "effectName": "string",
  "geometryProfile": "string",
  "modelType": "string",
  "parameterRegion": {},
  "sharedSettingsContext": {},
  "paletteContext": {},
  "behaviorSignals": {},
  "renderOutcomeSignals": {},
  "confidence": {},
  "evidenceCount": 0,
  "traceability": {}
}
```

Required fields:

- `effectName`
- `geometryProfile`
- `modelType`
- `parameterRegion`
- `behaviorSignals`
- `renderOutcomeSignals`
- `confidence`
- `evidenceCount`

Suggested `parameterRegion` fields:

- `parameterName`
- `regionKind`
  - `single_value|bounded_range|cluster|categorical`
- `valueSummary`
- `interactionAssumptions`

Suggested `behaviorSignals` fields:

- `primaryMotion`
- `motionPacing`
- `motionContinuity`
- `motionDirectionality`
- `primaryTexture`
- `textureClarity`
- `textureDensity`
- `energyLevel`
- `energyEnvelope`
- `coverageLevel`
- `coverageDistribution`
- `hierarchySuitability`
- `geometryCoupling`
- `stability`

Suggested `renderOutcomeSignals` fields:

- `leadRead`
- `supportRead`
- `breadthRead`
- `temporalRead`
- `densityRead`
- `clarityRead`
- `contrastRead`
- `nonBlankRatio`
- `temporalMotion`
- `temporalColorDelta`
- `temporalBrightnessDelta`

### 2. `parameter_semantics_record_v1`

Purpose:
- describe what a single parameter changes visually

Shape:

```json
{
  "artifactType": "parameter_semantics_record_v1",
  "artifactVersion": "1.0",
  "recordId": "string",
  "createdAt": "ISO-8601",
  "effectName": "string",
  "parameterName": "string",
  "semanticAxis": "string",
  "observedDirectionality": "string",
  "interactionSensitivity": "string",
  "geometrySensitivity": "string",
  "affectedSignals": [],
  "valueRegions": [],
  "confidence": {},
  "evidenceCount": 0,
  "traceability": {}
}
```

Required fields:

- `effectName`
- `parameterName`
- `semanticAxis`
- `affectedSignals`
- `valueRegions`
- `confidence`
- `evidenceCount`

Allowed `semanticAxis` examples:

- `speed`
- `density`
- `coverage`
- `band_count`
- `edge_softness`
- `randomness`
- `directionality`
- `rotation`
- `spread`
- `brightness_profile`

Suggested `valueRegions` entry shape:

```json
{
  "regionId": "string",
  "valueSummary": "string",
  "behaviorImpactSummary": "string",
  "affectedSignals": [],
  "geometrySpecificNotes": [],
  "confidence": "low|medium|high",
  "evidenceCount": 0
}
```

### 3. `shared_setting_semantics_record_v1`

Purpose:
- describe how shared settings alter rendered behavior across effects

Shape:

```json
{
  "artifactType": "shared_setting_semantics_record_v1",
  "artifactVersion": "1.0",
  "recordId": "string",
  "createdAt": "ISO-8601",
  "settingName": "string",
  "settingValueRegion": {},
  "affectedBehaviorSignals": [],
  "interactionTargets": [],
  "geometrySensitivity": "string",
  "confidence": {},
  "evidenceCount": 0,
  "traceability": {}
}
```

Required fields:

- `settingName`
- `settingValueRegion`
- `affectedBehaviorSignals`
- `confidence`
- `evidenceCount`

Expected settings include:

- `bufferStyle`
- `layerMethod`
- `effectLayerMix`
- `inTransitionType`
- `outTransitionType`
- `layerMorph`
- palette-related shared controls


### 4. `parameter_interaction_semantics_record_v1`

Purpose:
- describe how combinations of settings alter rendered behavior

Shape:

```json
{
  "artifactType": "parameter_interaction_semantics_record_v1",
  "artifactVersion": "1.0",
  "recordId": "string",
  "createdAt": "ISO-8601",
  "effectName": "string",
  "geometryProfile": "string",
  "primaryParameter": "string",
  "secondaryParameter": "string",
  "secondarySettingKind": "effect_parameter|shared_setting|palette_context",
  "interactionRegion": {},
  "interactionType": "reinforcing|masking|threshold|inverting|saturating|independent",
  "affectedSignals": [],
  "behaviorImpactSummary": "string",
  "geometrySensitivity": "string",
  "confidence": {},
  "evidenceCount": 0,
  "traceability": {}
}
```

Required fields:

- `effectName`
- `geometryProfile`
- `primaryParameter`
- `secondaryParameter`
- `secondarySettingKind`
- `interactionRegion`
- `interactionType`
- `affectedSignals`
- `behaviorImpactSummary`
- `confidence`
- `evidenceCount`

Suggested `interactionRegion` fields:

- `primaryValueRegion`
- `secondaryValueRegion`
- `sharedSettingsContext`
- `paletteContext`
- `stabilityNotes`

## Confidence Model

All records must carry a confidence representation that is grounded in evidence quality, not opinion.

Suggested fields:

- `level`
  - `low|medium|high`
- `evidenceClass`
  - `raw_render_only|aggregated_render|batch_validated`
- `coverageStatus`
  - `narrow|moderate|broad`

## Traceability Requirements

Every record must be traceable back to source evidence.

Suggested `traceability` fields:

- `sourceArtifactIds`
- `sourceRenderRecordIds`
- `sourceBatchRunIds`
- `sourceGeometryProfiles`
- `generatedBy`

## What Must Not Appear In These Records

Do not encode:

- preferred prop names
- section names as training meaning
- “best effect for star”
- “best effect for tree”
- warm/cool as effect-family hints
- user/director taste

Those are either:

- runtime context
- preference learning
- or invalid doctrine

## Acceptance Use

These records are correct when they support:

- capability-first recommendation generation
- parameter-aware realization ranking
- geometry-conditioned render reasoning
- batch-harness validation

They are not complete until they are used to regenerate the next selector input artifacts, the interaction-aware regeneration report is emitted, and those artifacts hold through the full batch harness.
