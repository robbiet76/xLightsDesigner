# Sequencer Render Training Harness Implementation Checklist

Status: Active
Date: 2026-03-18
Owner: xLightsDesigner Team

Purpose: define the implementation plan for the internal xLights-backed render-training harness used to teach the sequencer what effect settings actually do when rendered.

Scope:
- internal development/training tooling only
- not part of the shipped end-user product
- xLights remains the authoritative renderer
- this harness exists to generate, capture, categorize, and score rendered training samples

## Operating Assumptions

1. Rendering stays in xLights.
2. We do **not** reimplement xLights rendering in this project.
3. The first harness should prefer scriptable/backend-like xLights paths over UI-style manual workflows.
4. The likely first capture path is:
   - `openSequence`
   - apply controlled sample effect/settings
   - `exportModelWithRender`
   - persist artifact + metadata
5. Shared realization settings must be first-class in the sweep matrix, including:
   - `Render Style`
   - palette
   - layer/blend behavior
   - buffer style

## Primary Goal

For each rendered sample, the harness must produce a training record that captures:
- what settings were used
- what was rendered
- what pattern/visual behavior was observed
- how useful or high-quality the result appears

That is the minimum needed for the sequencer to learn what the levers do and which ones are worth pulling.

## Phase 1: Harness Foundation

### A. Command Path Audit

- [x] Confirm the smallest viable xLights-backed capture path
- [x] Verify whether `exportModelWithRender` is sufficient for the first harness
- [ ] Verify whether `exportVideoPreview` is needed for temporal/pattern cases or can be deferred
- [x] Record exact command parameters and output behavior for:
  - `openSequence`
  - `addEffect`
  - `renderAll`
  - `exportModel`
  - `exportModelWithRender`
  - `exportVideoPreview`
  - `closeSequence`

### B. Internal Tool Boundary

- [x] Choose a dedicated internal location for the harness code
- [x] Keep the harness outside normal user-facing runtime paths
- [x] Define artifact output directories for:
  - manifests
  - raw render artifacts
  - extracted features
  - labels
  - comparisons

Recommended location:
- `tools/sequencer-render-training/`
or
- `scripts/sequencer-render-training/`

## Phase 2: Fixture Pack

### A. Controlled Training Sequences

- [x] Create a minimal dedicated training fixture sequence pack
- [x] Keep sequence duration short enough for fast iteration
- [x] Use one or a small number of controlled windows per sample
- [ ] Ensure fixture sequences are stable and reproducible

### B. Prop Coverage

- [ ] Define the first prop classes to cover
- [ ] Include at least:
  - outline
  - cane / single-strand-like prop
  - arch
  - matrix
- [ ] Record model geometry metadata needed for later interpretation

### C. Initial Effect Set

- [x] Start with:
  - `On`
  - `SingleStrand`
- [ ] Keep `Bars` and `Wave` as the immediate next expansion set

## Phase 3: Sweep Manifest

### A. Manifest Schema

- [x] Define a sweep manifest schema
- [ ] Include:
  - `effectName`
  - `modelName`
  - `modelType`
  - `sharedSettings`
  - `effectSettings`
  - `timingWindow`
  - `exportMode`
  - `labelHints`
  - `notes`

### B. Shared Settings

- [x] Make shared realization settings first-class
- [x] Include at minimum:
  - `renderStyle`
  - `paletteProfile`
  - `layerMethod`
  - `bufferStyle`

### C. Effect-Specific Settings

- [ ] Build reduced sweep dimensions per effect instead of full cartesian products
- [x] For `On`, start with:
  - start level
  - end level
  - shimmer
  - cycles
  - transparency
- [x] For `SingleStrand`, start with:
  - mode
  - direction
  - number/grouping
  - rotation/speed
  - offset
  - fade type

### D. Matrix Strategy

- [ ] Do not brute-force every possible combination
- [ ] Use:
  - reduced grids
  - curated preset bands
  - effect-specific high-impact settings
- [ ] Rank settings by expected visual impact once data starts accumulating

## Phase 4: Capture Pipeline

### A. Render Orchestration

- [x] Implement a harness runner that:
  - opens fixture sequence
  - inserts or updates sample effect
  - triggers render
  - exports artifact
  - records metadata
- [ ] Make runs resumable
- [ ] Make outputs deterministic where possible

### B. Artifact Capture

- [x] Persist each sample artifact with a stable ID
- [x] Record:
  - exact command inputs
  - resolved effect settings
  - shared settings
  - output path
  - timestamp

### C. Performance Controls

- [ ] Reuse the same fixture sequence whenever possible
- [ ] Batch samples by effect and model type
- [ ] Reuse open xLights sessions
- [ ] Reuse rendered setup where possible before changing the effect family
- [ ] Keep first-pass exports lightweight

## Phase 5: Render Interpretation

### A. Training Record Schema

- [x] Define a render-sample record schema
- [ ] Record:
  - sample ID
  - effect name
  - model name / type
  - shared settings
  - effect settings
  - artifact path
  - extracted features
  - human labels
  - quality/usefulness scores
  - notes

### B. Pattern Interpretation

- [ ] Make pattern analysis first-class
- [ ] Support labels such as:
  - chase
  - bounce
  - skip
  - mirrored
  - center-out
  - repeating band
  - smooth sweep
  - noisy/cluttered

### C. Quality / Usefulness Scoring

- [ ] Score each sample on:
  - readability
  - restraint
  - pattern clarity
  - prop suitability
  - practical usefulness
- [ ] Allow “mostly bad” settings to be recorded as low-value, not hidden

### D. Pairwise Comparison

- [ ] Support pairwise preference records
- [ ] Example comparisons:
  - more restrained
  - cleaner chase
  - better cane readability
  - less cluttered
  - stronger directional sweep

## Phase 6: Learning Loop

### A. Preset / Region Discovery

- [ ] Rank setting regions by usefulness
- [ ] Learn which settings matter most per effect
- [ ] Identify:
  - recommended bands
  - dangerous bands
  - weak settings that rarely help

### B. Sequencer Integration Plan

- [ ] Keep the existing schema-safe translator as fallback
- [ ] Add a realization layer that chooses settings from learned exemplars/preset regions
- [ ] Make integration incremental:
  - first `On`
  - then `SingleStrand`
  - then additional effects

## Phase 7: Initial Deliverables

### First Milestone

- [x] Harness skeleton created
- [x] Sweep manifest schema defined
- [x] Training record schema defined
- [x] First fixture sequence/model pack defined
- [x] First working capture path confirmed with xLights

### Second Milestone

- [ ] `On` sweep runs end to end
- [ ] `SingleStrand` sweep runs end to end
- [ ] artifacts and metadata persist cleanly
- [ ] first human-labeled records exist

### Third Milestone

- [ ] first quality/usefulness scoring pass exists
- [ ] first pairwise comparison records exist
- [ ] first learned preset bands can be proposed back to the sequencer

## Open Questions To Answer During Implementation

- [ ] Is `exportModelWithRender` sufficient for early pattern learning, or do we need clip/video export for temporal effects?
- [ ] Which output format is best for training artifacts:
  - mp4
  - gif
  - image sequences
  - model-specific export artifacts
- [ ] How much of pattern understanding can come from stills versus short temporal windows?
- [ ] Which shared settings should be swept early versus held constant?
- [ ] What is the smallest sample size that still yields useful effect understanding?

## Recommended Immediate Next Step

1. define the manifest schema
2. define the training record schema
3. confirm one end-to-end xLights capture using:
   - one fixture sequence
   - one model
   - `On`
   - `exportModelWithRender`

That is the smallest useful proof point before broadening to `SingleStrand`.
