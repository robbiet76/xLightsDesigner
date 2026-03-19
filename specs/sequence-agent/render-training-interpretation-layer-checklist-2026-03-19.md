# Render Training Interpretation Layer Checklist

Goal:
- move from coarse window summaries to model-aware frame-sequence interpretation
- make the training system recognize what a human would call the rendered pattern
- standardize structural tests on RGB at full brightness

Primary design reference:
- [render-training-experiment-design-spec-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-experiment-design-spec-2026-03-19.md)

## Training Standard

- [x] Define a structural training palette standard
- [x] Standard palette is `RGB`
- [x] Standard palette order is:
  - `#FF0000`
  - `#00FF00`
  - `#0000FF`
- [x] Define full-brightness default for structural tests
- [x] Document the brightness exception for effects whose meaning is level change
- [x] Add a manifest-normalization pass so new manifests default to the structural standard automatically
- [ ] Audit existing manifests and remove legacy decorative palettes from structural tests

## Per-Frame Decode Format

- [ ] Extend `.fseq` window decode output to include per-frame node state
- [ ] For each frame, emit:
  - frame index
  - frame time in ms
  - per-node active flag
  - per-node brightness
  - per-node RGB triplet
- [ ] Keep current window summary metrics in the same payload
- [ ] Add a compact mode for large runs if JSON size becomes a bottleneck
- [ ] Add a schema for decoded per-frame window payloads
- [ ] Verify per-frame decode on:
  - outline
  - single-line
  - tree flat
  - tree 360
  - star

## Geometry Layer

- [ ] Build a generic geometry adapter layer
- [ ] Promote `resolvedGeometryProfile` to the primary analyzer-dispatch input
- [ ] Emit `geometryTraits` from audited xLights model settings
- [ ] Support at minimum:
  - linear models
  - tree models
  - star models
- [ ] Separate:
  - raw node order
  - logical geometry order
  - future custom geometry mapping
- [ ] Add geometry metadata output for analyzers
- [ ] Leave model groups and submodels out of the first interpretation pass

## Feature Sets

### Linear
- [ ] Segment count per frame
- [ ] segment start/end positions
- [ ] gap-size distribution
- [ ] signed centroid path
- [ ] reversal detection
- [ ] direction consistency
- [ ] color ordering across lit segments
- [ ] periodicity / repetition interval
- [ ] trail/fade shape descriptors

### Tree
- [ ] vertical distribution per frame
- [ ] top/bottom bias
- [ ] radial or strand distribution
- [ ] wrap / spiral continuity cues
- [ ] band continuity across strands
- [ ] centroid path in logical tree space
- [ ] color-region persistence over time

### Star
- [ ] arm symmetry score
- [ ] spoke activation balance
- [ ] center emphasis vs tip emphasis
- [ ] alternating arm behavior
- [ ] radial consistency over time
- [ ] color symmetry across arms

## Pattern-Family Classifier

- [ ] Build a generic classifier interface
- [ ] First pattern families:
  - static hold
  - ramp
  - shimmer
  - directional chase
  - reverse chase
  - bounce
  - skips
  - segmented chase
  - burst texture
  - radial sparkle
  - spiral travel
- [ ] Classifier should consume model-aware sequence descriptors, not manifest hints
- [ ] Track confidence per classified family
- [ ] Preserve `unclassified` when the evidence is weak

## Intent Mapping Layer

- [ ] Map classified patterns and quality descriptors to designer-facing terms
- [ ] First intent vocabulary:
  - clean
  - busy
  - restrained
  - bold
  - directional
  - bouncy
  - segmented
  - textured
  - smooth
  - punchy
- [ ] Keep intent mapping separate from pattern classification
- [ ] Support multiple tags per sample
- [ ] Add confidence or support signals for each tag

## Generic Framework

- [x] Define an analyzer registry split by geometry family
- [x] Implement a base analyzer contract
- [ ] Implement:
  - linear analyzer
  - tree analyzer
  - star analyzer
- [x] Add a generic sequence-analysis entrypoint that dispatches by model type
- [x] Make observation extraction consume analyzer output instead of only scalar decoder summaries
- [ ] Keep the framework effect-agnostic where possible
- [ ] Add effect-specific overlays only where the geometry analyzer is not enough

## Validation

- [ ] Re-run a small validation pack with per-frame analysis enabled
- [ ] Confirm `fadeType` variants become distinguishable if they truly differ
- [ ] Confirm `Left-Right` vs `Right-Left` becomes directionally distinguishable
- [ ] Confirm bounce detection works on `SingleStrand`
- [ ] Confirm tree/star analyzers add real structure beyond generic density metrics
- [ ] Only after that, scale the overnight corpus further
