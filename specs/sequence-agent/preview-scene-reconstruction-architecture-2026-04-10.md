# Preview Scene Reconstruction Architecture

Status: Draft
Date: 2026-04-10
Owner: xLightsDesigner Team

## Purpose

Define an ML-friendly rendering observation path that does not depend on repeated xLights House Preview or Model Preview export during the inner iteration loop.

The goal is not to replace xLights effect rendering.
The goal is to:
1. render authoritative sequence output in xLights
2. extract the spatial scene information needed to reconstruct preview-space output outside xLights
3. run repeated local observation, rasterization, critique, and training on that reconstructed scene

This architecture is intended to support near-continuous feedback loops for sequencing quality work.

## Problem Statement

The current render-training system is structurally useful but not sufficient for quality-driven sequence learning.

Current strengths:
- xLights is already treated as the authoritative renderer
- real `.xsq` and `.fseq` artifacts are preserved
- canonical geometry families and training layouts exist
- the system can decode rendered output against model/channel structure

Current limitation:
- raw `.fseq` is not a sufficient artistic quality signal because it does not directly represent the composed preview scene
- current geometry audits classify model families and structural settings but do not preserve the full preview-space node graph used by xLights to draw the scene
- repeated preview export through xLights is likely too slow and fragile for dense iterative evaluation

So the missing layer is:
- a machine-readable preview scene representation that can be reconstructed locally from xLights-authored data

## Core Decision

The tool should move toward a machine-learning-friendly architecture.

That means:
- xLights remains the source of truth for effect rendering
- preview-scene reconstruction should be externalized into a local, repeatable, machine-readable pipeline
- repeated critique and learning loops should operate mostly outside xLights
- xLights preview/video export should be treated as parity validation and checkpoint capture, not the primary inner-loop mechanism

## Architectural Boundary

Do not rebuild xLights effect logic.
Do not depend on xLights preview export for every iteration.

Instead split the problem into two stages:

1. xLights stage
- author sequence edits
- render authoritative sequence output
- expose enough geometry and frame state to reconstruct preview-space output

2. local ML stage
- reconstruct preview scene frames locally
- derive observations, tensors, keyframes, clips, and critique features
- run repeated evaluation and training without paying full xLights preview cost each time

## Why Option C Is Plausible

Upstream xLights source already shows the separation we need:

1. effect rendering
- effects write per-node values over time

2. preview composition
- `ModelPreview::Render(frameTime, data, ...)` reads model channel values and draws models in preview space

3. preview-space node logic
- model/node coordinate structures contain:
  - `bufX`, `bufY`
  - `screenX`, `screenY`, `screenZ`
- render buffer setup flows through:
  - `Model::InitRenderBufferNodes(...)`
  - `PixelBuffer` buffer-style/camera/transform handling

This means preview composition is a distinct seam.
That seam is simpler than effect rendering and is the right extraction target.

## Important Constraint

Raw `.fseq` alone is not enough.

It only becomes useful for scene reconstruction when joined with:
- model identity
- node ordering
- channels-per-node
- preview placement
- screen-space coordinates
- camera/view configuration where relevant

Therefore the current `.fseq` training architecture should be expanded, not discarded.

## Proposed Long-Term Artifact Stack

### 1. `render_output_v1`
Authoritative output from xLights.

Contains:
- sequence identity
- render window
- `.fseq` path or equivalent frame-channel output
- model/channel mapping references
- render metadata

### 2. `preview_scene_geometry_v1`
A shell-neutral geometry export describing how the display is composed in preview space.

Contains, per model and node:
- `modelId`
- `modelName`
- `displayAs`
- `groupIds`
- `nodeIndex`
- `channelStart`
- `channelCount`
- `coordIndex`
- `screenX`
- `screenY`
- `screenZ`
- `bufX`
- `bufY`
- model center / bounds
- model transforms if needed
- preview/camera identity if needed

This is the missing artifact today.

### 3. `preview_scene_frame_v1`
A reconstructed machine-readable scene frame.

Contains, for a single frame:
- frame time
- model/node spatial records
- RGB/intensity values for each visible node/coord
- optional grouping or semantic tags

This is the canonical scene representation for downstream learning.

### 4. `preview_scene_tensor_v1`
A rasterized or tensorized derivative suitable for ML or CV models.

Examples:
- 2D matrix image
- time-window stack of frames
- multi-channel tensor with semantic masks
- per-family planes

### 5. `render_observation_v1`
Derived critique-friendly observation bundle.

Examples:
- focal emphasis estimates
- coverage density
- section contrast
- motion directionality
- clutter/restraint metrics
- family coherence
- scene balance

## Recommended Inner Loop

### Heavy path: xLights
Use only when needed for:
- sequence authoring/edit application
- authoritative render generation
- parity validation against actual preview
- occasional checkpoint captures

### Light path: local reconstruction
Use repeatedly for:
- frame reconstruction
- rasterization
- candidate comparison
- critique
- training data generation
- iterative revision loops

This is the only realistic way to support dense learning loops without making xLights the bottleneck.

## Required New Capability

The system needs a geometry export that is much richer than the current family/profile audits.

Current training catalogs are too abstract.
They provide:
- model family
- geometry profile
- structural settings

They do not provide:
- full per-node preview-space coordinates
- per-node channel mapping joined to scene coordinates
- enough information to reconstruct the actual scene composition xLights draws

That export is the first concrete milestone.

## Implementation Options

### Option C1: Export scene geometry from xLights once per layout

Build or script a geometry export that serializes the preview-space node graph from xLights.

Best characteristics:
- exact or near-exact model/node placement
- reusable across many renders for the same layout
- low recurring cost

This is the preferred path.

### Option C2: Reconstruct geometry from xLights XML plus replicated model rules

Use layout XML and known model rules to recreate node positions outside xLights.

Pros:
- no xLights code changes needed

Cons:
- likely to drift
- duplicates xLights model geometry logic
- high maintenance burden across model types

This is acceptable only as a fallback.

### Option C3: Use xLights preview export as calibration/parity only

Sample a small set of preview frames/clips from xLights and compare them to local reconstruction.

Pros:
- verifies fidelity
- keeps xLights in the loop without making it the whole loop

This should be used as validation, not the primary training mechanism.

## Recommended Path

1. build `preview_scene_geometry_v1`
2. build local scene reconstruction from `.fseq` + geometry export
3. rasterize reconstructed frames into ML-friendly tensors and images
4. use xLights preview export only for parity checks and milestone review bundles

This keeps the architecture machine-learning-friendly without violating the earlier decision to keep xLights as the authoritative effect renderer.

## Performance Model

### What should stay inside xLights
- applying sequence edits
- authoritative render generation
- occasional checkpoint preview export

### What should move outside xLights
- scene reconstruction
- repeated section sampling
- rasterization
- observation extraction
- comparative scoring
- critic loops
- training/inference preprocessing

This is important because xLights batch rendering and preview export already appear expensive and operationally fragile under repeated automation.

## ML-Support Design Goals

The tool should explicitly support machine learning.

That means the architecture should make it easy to produce:
- stable, versioned artifacts
- scene tensors from real rendered output
- paired design-intent and render-observation examples
- comparative candidate evaluation sets
- review corpora with rendered outcomes and critique labels

The system should be designed so that future models can train on:
- music/context
- design brief
- display metadata
- reconstructed preview frames
- critique outcomes
- revised attempts

## Immediate Milestones

### Milestone 1: Geometry truth export
Produce `preview_scene_geometry_v1` for a layout.

Success criteria:
- includes per-node preview-space coordinates
- includes node-to-channel mapping
- includes enough model metadata to join with `.fseq`

### Milestone 2: Local frame reconstruction
Given:
- `preview_scene_geometry_v1`
- `.fseq`
- frame window

produce:
- `preview_scene_frame_v1`
- rasterized frame images or tensors

Success criteria:
- reconstructed output is visibly comparable to xLights preview for sampled cases

### Milestone 3: Parity validation
Compare local reconstruction against xLights preview export.

Success criteria:
- acceptable spatial/color parity on a representative sample set

### Milestone 4: Observation layer
Produce `render_observation_v1` from reconstructed frames.

Success criteria:
- enough signal to support critique and candidate comparison

### Milestone 5: Sequencing critique loop
Use reconstructed preview outputs in revision/testing harnesses.

Success criteria:
- sequence quality experiments can run without repeated full preview export from xLights

## Risks

### Risk 1: geometry export is harder than expected
Mitigation:
- start with a bounded model subset
- use xLights preview/video export as parity fallback

### Risk 2: local reconstruction drifts from xLights preview
Mitigation:
- keep parity validation as a required stage
- version geometry export and reconstruction assumptions

### Risk 3: current layout metadata is not rich enough
Mitigation:
- treat geometry export as a first-class artifact rather than trying to infer too much from existing audits

### Risk 4: overbuilding before fidelity is proven
Mitigation:
- start with one small end-to-end proof on the canonical training layout
- require parity before scaling the system

## Recommendation

Proceed with Option C as an explicit long-term direction.

But do it in a disciplined way:
- not as a renderer replacement
- not by relying on raw `.fseq` alone
- not by guessing geometry from weak metadata

The correct first investment is:
- a true preview-scene geometry export
- followed by local preview-scene reconstruction
- validated against xLights preview output on a checkpoint basis

That is the most plausible path to a near-continuous, ML-friendly quality loop.
