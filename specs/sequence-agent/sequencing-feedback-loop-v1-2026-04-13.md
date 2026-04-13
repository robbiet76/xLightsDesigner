# Sequencing Feedback Loop v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the local-first sequencing feedback loop for the current POC phase.

This spec exists to answer four questions:
1. how sequence revisions should be grouped
2. when xLights must provide authoritative truth
3. what should happen locally between xLights checkpoints
4. how learning artifacts should be structured so they remain future-compatible with centralized cloud learning

## References

- [sequencing-poc-boundary-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-poc-boundary-2026-04-10.md)
- [preview-scene-reconstruction-architecture-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/preview-scene-reconstruction-architecture-2026-04-10.md)
- [hybrid-cloud-learning-and-billing-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/app-ui/hybrid-cloud-learning-and-billing-2026-04-10.md)

## Current Constraint

Authoritative xLights render is expensive.

Assumed render cost envelope:
- roughly `15s` to `2m` depending on machine performance and project complexity

Therefore:
- xLights render cannot be the inner conversational loop
- xLights render must be treated as a checkpoint operation
- local critique and revision planning must do most of the iteration work

## Core Decision

The sequencing loop must be split into:

1. authoritative checkpoint loop
- sequence edits are applied in xLights
- xLights produces authoritative render truth

2. local reasoning loop
- local reconstruction or local prediction supports critique, planning, and candidate comparison between authoritative checkpoints

This is the only practical way to keep iteration density high enough for POC learning.

## Scope Boundary

### This loop is about
- sequencing quality improvement
- intent alignment
- critique and revision
- data generation for future learning

### This loop is not about
- real-time WYSIWYG editing
- per-micro-edit xLights render validation
- replacing xLights as the authoritative execution engine

## Phase Rule

The current work remains POC.

That means the loop must optimize for:
- proving we can create quality sequences
- proving we can incorporate user intent
- proving we can improve with feedback

The loop should not yet optimize for:
- full cloud rollout
- multi-user distributed training infrastructure
- production-scale sync behavior

## Ownership Split

### Local app owns
- current sequence editing session
- design handoff consumption
- revision batching
- local preview reconstruction or local surrogate prediction
- critique interaction
- temporary learning artifact generation

### Future cloud owns
- durable shared learning corpus
- global evaluation records
- global retrieval/model packs
- per-user preference profiles

This split must remain visible in the artifact design.

## Preference Boundary

User preferences and general training knowledge must remain separate.

### User preference examples
- prefers restrained density
- prefers strong focal tree emphasis
- prefers smoother motion over aggressive pulse behavior

### General training examples
- how a given effect behaves on a given geometry family
- what kinds of visual structures tend to read clearly in preview space
- how section contrast is usually achieved successfully

Rule:
- preference artifacts must not pollute the general training corpus
- general training artifacts must remain reusable across users

## Loop Structure

## 1. Intent and design input

Inputs:
- project mission
- display understanding
- music/audio analysis
- sequence design handoff
- user/project-scoped preference profile if available

Output:
- `revision_batch_plan_v1`

Purpose:
- define the next chunk of changes to apply before the next authoritative checkpoint

## 2. Revision batch application

Patch applies a bounded batch of sequence edits into xLights.

Examples of a batch:
- one section treatment
- one verse/chorus contrast pass
- one focal-emphasis rewrite
- one cleanup pass for density/restraint

Rule:
- do not trigger authoritative render for each micro-change
- bundle meaningful changes into a reviewable pass

Output:
- `applied_revision_batch_v1`

## 3. Authoritative xLights checkpoint

xLights renders the current state.

Output:
- `render_truth_checkpoint_v1`

Contains:
- checkpoint id
- sequence revision id
- render window
- authoritative output references
- cached geometry reference if needed
- provenance about xLights version/API state

Rule:
- this is the expensive ground-truth step
- it must happen at controlled checkpoints, not continuously
- geometry rebuild is not part of the normal checkpoint path unless the cached layout artifact is stale

## 4. Local reconstruction or prediction

From the authoritative checkpoint, the local system produces:
- reconstructed preview-scene frames
- rasterized images or tensors
- derived render observations

Normal prerequisite:
- reuse the cached `preview_scene_geometry_v1` artifact for the active layout
- only rebuild geometry if layout validation shows that cached artifact is stale

Future variant:
- local surrogate prediction may be used before the next authoritative checkpoint

Outputs:
- `preview_scene_frame_v1`
- `preview_scene_tensor_v1`
- `render_observation_v1`

## 5. Critique

Designer and/or critic evaluates the result against:
- user intent
- design handoff
- music character
- display composition
- user/project preference profile where appropriate

Output:
- `sequence_critique_v1`

Must be able to answer:
- what is working
- what is not working
- what is overdone or underdeveloped
- what the next revision batch should attempt

### Critique ladder rule

Critique must proceed from broad structure to fine detail.

Required review order:
1. `macro`
- whole sequence or whole-scene balance
- energy arc
- section contrast
- focal hierarchy
- overall clutter/restraint

2. `section`
- whether each major section expresses the right idea
- section density and pacing
- section-level target family emphasis
- section legibility

3. `group`
- focal/support/background group relationships
- family-level balance
- whether key prop groups are carrying the right role

4. `model`
- local model conflicts
- awkward local motion or density
- repetitive or distracting model behavior

5. `effect`
- parameter tuning
- transition polish
- local color/effect nuance

Rule:
- the system must always evaluate the highest unresolved level first
- it must not descend into lower-level refinement while a higher level is still unstable
- revision batches should target the highest failing level before addressing finer detail

This is the sequencing equivalent of the broad-to-narrow discovery pattern already used in display understanding.

## 6. Revision learning record

The system stores one joined learning record for the cycle.

Output:
- `sequence_learning_record_v1`

Contains:
- context inputs
- revision batch plan
- applied changes
- local prediction if any
- authoritative xLights truth reference
- render observations
- critique
- resulting next-step recommendation
- user preference influence reference if used

This is the main learning artifact for future improvement.

## Authoritative Checkpoint Policy

### Must checkpoint when
- a revision batch is complete
- a candidate is ready for critique
- parity against local reconstruction/prediction is needed
- a major design direction has changed

### Should not checkpoint when
- only a tiny local reasoning step happened
- a conversational clarification occurred with no batch ready
- a micro-adjustment can be grouped into the next batch

## Revision Batch Policy

A revision batch should be:
- semantically meaningful
- visually reviewable
- large enough to justify render cost
- small enough that critique can still isolate what changed

Examples of acceptable batch sizes:
- one major section pass
- one specific focal/support rebalance
- one motion simplification pass
- one chorus intensification pass

Examples of unacceptable batch sizes:
- one single parameter nudge with no larger goal
- one color tweak in isolation unless it is the actual point of review
- one tiny effect placement change with no broader design reason

## Local Iteration Policy

Between authoritative checkpoints, the local system should do as much work as possible without xLights.

That includes:
- frame reconstruction from truth artifacts
- local observation extraction
- candidate comparison
- critique generation
- revision proposal generation

The local system should also interpret the same render checkpoint at multiple resolutions:
- macro scene level
- section level
- group level
- model level

This allows one expensive checkpoint to support many critique questions before the next batch is sent back to xLights.

Future extension:
- local surrogate preview prediction before committing the next batch to xLights

## Artifact Chain

The feedback loop should be modeled around explicit artifacts.

### Core artifacts
- `revision_batch_plan_v1`
- `applied_revision_batch_v1`
- `render_truth_checkpoint_v1`
- `preview_scene_geometry_v1`
- `preview_scene_frame_v1`
- `preview_scene_tensor_v1`
- `render_observation_v1`
- `sequence_critique_v1`
- `sequence_learning_record_v1`

## Local vs Future Cloud Ownership

### Local-first during POC
- all artifacts may be created and stored locally
- the app should remain usable without cloud dependency

### Cloud-compatible by design
- all artifact schemas should remain versioned and portable
- future sync/upload should not require redesign

### Preference separation rule
When cloud migration happens later:
- `sequence_learning_record_v1` and render-truth corpora belong to shared product learning
- user taste/profile artifacts belong to account-scoped preference storage

These must not share the same storage or learning semantics.

## xLights Refactor Watchlist

The xLights source is currently under major refactor.

The current local xLights tree at:
- `/Users/robterry/xLights`

is on branch:
- `api-cleanup`

Recent relevant commits already show movement in the owned API surface:
- `2daa5777a` Expose xLights layout settings and save timestamps
- `971793459` Expose layout geometry in owned API
- `3f549ef35` Add owned xLights render-current API

Relevant current code seams in the local xLights tree include:
- `xLights/ModelPreview.cpp`
- `xLights/models/Model.cpp`
- `xLights/PixelBuffer.cpp`
- `xLights/xLightsMain.cpp`
- `xLights/SeqFileUtilities.cpp`
- `xLights/Render.cpp`

Important implication:
- future work must watch current xLights code, not only the older upstream audit paths
- any geometry-export or render-truth contract should be validated against the active refactor branch before implementation assumptions are frozen

## Immediate Recommended Work

### Step 1
Define `preview_scene_geometry_v1` precisely.

Reason:
- this is the missing bridge between xLights truth and local reconstruction

### Step 2
Build one bounded proof on the canonical training layout.

Goal:
- read authoritative render output
- join it with geometry truth
- reconstruct preview-space frames locally
- compare against xLights preview at checkpoint level

### Step 3
Define `sequence_learning_record_v1`.

Reason:
- every loop should leave behind a usable learning artifact
- this is required for future model improvement and future cloud migration

## Recommendation

Proceed with a local-first sequencing feedback loop built around authoritative xLights checkpoints and dense local critique/revision between those checkpoints.

Treat xLights render as expensive truth.
Treat local reconstruction or prediction as the working iteration layer.
Validate composition from broad to narrow.
Keep user preferences separate from general training artifacts.
Keep all artifact schemas portable for future cloud migration.
