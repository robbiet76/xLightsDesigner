# Model Metadata Record Contract (2026-03-22)

## Purpose

Define the normalized metadata record shape for:

- models
- groups
- submodels

This contract sits between:

- raw xLights layout state
- learned/inferred metadata
- user overrides
- UI metadata inspection/editing
- designer/sequencer/training consumers

It is intentionally broader than the current `metadataAssignments` shape in [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js), which only stores:

- `targetId`
- `targetName`
- `targetType`
- `targetParentId`
- `targetParentName`
- `tags`

That current shape is too narrow for large-show, app-managed metadata.

## Contract Goals

The normalized record should:

1. work for arbitrary custom models
2. separate inferred metadata from user overrides
3. store support state explicitly
4. preserve provenance and confidence
5. support UI inspection without forcing user maintenance

## Proposed Contract

Artifact type:

- `normalized_target_metadata_v1`

One record per target:

```json
{
  "targetId": "Snowman",
  "targetKind": "model",
  "identity": {
    "name": "Snowman",
    "displayName": "Snowman",
    "rawType": "Custom",
    "canonicalType": "custom",
    "parentId": "",
    "parentName": "",
    "source": "layout.getModels"
  },
  "structure": {
    "geometryTraits": ["custom", "compact", "figure_like"],
    "topologyTraits": ["single_object"],
    "spatialTraits": ["center", "foreground"],
    "groupMemberships": ["Characters"],
    "submodelCount": 0,
    "nodeCount": 842,
    "coverageClass": "accent",
    "renderRisk": "normal"
  },
  "semantics": {
    "inferredRole": "focal",
    "inferredSemanticTraits": ["character", "figure", "story_prop"],
    "inferredMotionAffinities": ["gentle", "texture_friendly"],
    "inferredEffectAffinities": ["On", "Shimmer", "Twinkle"],
    "supportState": "runtime_targetable_only"
  },
  "training": {
    "trainedModelBuckets": [],
    "trainedSupportState": "out_of_stage1_model_support",
    "trainingArtifactVersion": "1.0",
    "confidence": 0.34
  },
  "user": {
    "rolePreference": "",
    "semanticHints": [],
    "effectPreferences": [],
    "effectAvoidances": [],
    "tags": ["character", "focal"]
  },
  "provenance": {
    "inferredAt": "2026-03-22T00:00:00.000Z",
    "updatedAt": "2026-03-22T00:00:00.000Z",
    "sources": ["layout", "scene_context", "training_bundle"],
    "confidence": 0.34
  }
}
```

## Required Fields

### Top-Level

- `targetId`
- `targetKind`
- `identity`
- `structure`
- `semantics`
- `training`
- `user`
- `provenance`

### `targetKind`

Allowed:

- `model`
- `group`
- `submodel`

## Field Semantics

### `identity`

Stable target identity from layout state.

Contains:

- naming
- raw type
- canonical type
- parent linkage
- source system

This section should be derived from layout facts and should not be user-edited in the normal UI.

### `structure`

Derived structural metadata.

Contains:

- geometry traits
- topology traits
- spatial traits
- group memberships
- node counts
- coverage class
- render risk

This is app-managed metadata.

### `semantics`

Learned or inferred meaning.

Contains:

- inferred role
- inferred semantic traits
- inferred motion affinities
- inferred effect affinities
- overall support state

This is where the app’s learned understanding lives.

### `training`

Training-specific support information.

Contains:

- mapped trained model buckets
- current support state against training scope
- artifact version
- confidence

This separates:

- runtime targetability
from
- trained support

which must not be conflated.

### `user`

User-owned semantic corrections and preferences.

Contains:

- explicit role preference
- semantic hints
- effect preferences
- effect avoidances
- tags

This should be the primary editable section in the UI.

### `provenance`

Change history and trust information.

Contains:

- inferred timestamp
- updated timestamp
- sources
- confidence

This is needed so silent metadata learning remains inspectable and explainable.

## Support States

Support state should be explicit and normalized.

### Runtime Support

- `runtime_targetable`
- `runtime_targetable_with_risk`
- `runtime_unsupported`

### Training Support

- `trained_supported`
- `runtime_targetable_only`
- `out_of_stage1_model_support`

For UI simplicity, these may collapse to:

- `trained_supported`
- `runtime_targetable_only`
- `out_of_scope`

## Why This Separation Matters

A target may be:

- visible in scene graph
- targetable at runtime
- but not inside the trained Stage 1 model support span

That is the current reality for many custom props.

The contract must preserve that distinction.

## Group Records

Groups need the same contract, with additional structure emphasis:

- direct member count
- flattened member count
- member kind distribution
- inferred distribution strategy
- aggregate/concrete support notes

Groups are important because many practical validations currently target:

- groups
- submodel groups

even when underlying models are custom.

## Submodel Records

Submodels need:

- parent linkage
- submodel render policy
- buffer style
- submodel type
- local-vs-parent render distinctness

This is already partially represented in shared target semantics and should flow into this normalized record.

## UI Mapping

### Metadata Table Summary

Derived from:

- `identity.displayName`
- `targetKind`
- `identity.canonicalType`
- `semantics.supportState`
- `semantics.inferredRole`
- `provenance.confidence`
- `user.tags.length`

### Detail Panel

Sections should map directly to:

- `identity`
- `structure`
- `semantics`
- `training`
- `user`
- `provenance`

## Relationship To Tags

Tags do not replace this contract.

Tags live inside `user.tags`.

If a stable semantic concept becomes important enough to drive behavior repeatedly, it should graduate from:

- freeform tag

to:

- controlled tag
or
- structured field

## Migration From Current State

Current metadata state in the desktop app is:

- a tag library
- assignment rows with target/tag associations

Migration path:

1. preserve existing `metadata.tags`
2. preserve existing `metadata.assignments`
3. derive normalized target metadata records at runtime
4. gradually add structured user preference fields
5. only later persist the richer normalized form if needed

This allows incremental adoption.

## Immediate Follow-On Work

1. build a layout support report using this contract shape
2. add a runtime adapter that converts current:
   - layout state
   - metadata assignments
   - training support
   into normalized target records
3. update the metadata dashboard to summarize support state and inferred semantics
