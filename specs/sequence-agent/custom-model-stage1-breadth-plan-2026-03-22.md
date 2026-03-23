# Custom Model Stage 1 Breadth Plan (2026-03-22)

## Purpose

Define the next Stage 1 expansion path for custom models without introducing:

- prop-name-specific code branches
- hardcoded semantic-family assumptions per show
- user-maintained metadata burden

The immediate goal is breadth:

- get more custom models to Stage 1 support parity
- use metadata-driven classification
- keep the runtime generic

## Constraint

Custom models are arbitrary.

Different users will have:

- different names
- different geometry
- different submodel structure
- different tags
- different grouping conventions

So the system must not rely on:

- `if modelName includes Snowman`
- `if modelName includes Spinner`
- fixed family enumerations embedded in runtime code

## Required Approach

Stage 1 custom-model support must be driven by:

1. layout-derived structure
2. normalized metadata
3. controlled tags
4. user semantic hints
5. learned/inferred traits
6. training-bucket compatibility

## Current Practical Classification States

For a custom model, the classifier should emit one of:

- `metadata_ready`
- `metadata_partial`
- `metadata_needed`

### `metadata_ready`

The custom model already exposes enough explicit metadata to map to an existing Stage 1 bucket.

Examples of metadata-level signals:

- `tree_like`
- `radial_like`
- `linear_like`
- `matrix_like`
- `arch_like`
- `icicle_like`

Important:

These are metadata traits, not hardcoded prop names.

### `metadata_partial`

The model has:

- tags
- semantic hints
- role preferences

but those signals do not yet map cleanly into an existing Stage 1 bucket.

This means the metadata model is ahead of the training/support map.

### `metadata_needed`

The model is custom and runtime-targetable, but there is not enough reliable metadata yet to classify it safely.

This should be the main discovery bucket, not a failure bucket.

## Immediate Workflow

1. derive normalized target metadata records
2. build a custom-model candidate report
3. separate custom props into:
   - already supported
   - metadata ready
   - metadata partial
   - metadata needed
4. expand Stage 1 support in that order

## Promotion Rule

A custom model should only be promoted into Stage 1 support when one of these is true:

1. its normalized metadata maps it clearly to an existing Stage 1 bucket
2. a new generic metadata trait-to-bucket rule can be added without naming a specific prop

## What Not To Do

Do not:

- special-case one show’s custom prop names
- add `Snowman`, `Present`, `Train`, `TuneToSign` branches in runtime logic
- make the user manually classify hundreds of props

## Expected User Experience

The app should:

- infer as much as possible automatically
- expose what it inferred
- allow targeted corrections
- silently improve support breadth

The user should only need to intervene when:

- a custom prop is persistently misunderstood
- the intended role differs from what geometry suggests
- a sequencing constraint needs to be enforced

## Deliverables For The Next Stage 1 Expansion

1. custom-model candidate report artifact
2. promoted metadata-to-bucket rules
3. Stage 1 support expansion tests for newly promotable custom-model classes
4. metadata UI visibility for unsupported custom targets

## Current Entry Point

The first implementation artifact for this plan is:

- [build-custom-model-stage1-candidate-report.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequence-metadata/build-custom-model-stage1-candidate-report.mjs)

That report is a discovery tool, not a final classifier.
