# Preview Scene Reconstruction Proofs

This directory holds small, bounded proof artifacts for preview-scene reconstruction work.

Current proof:

- `preview-scene-geometry-render-training-live.json`
  - Source: live xLights layout export
  - Show folder: `render-training`
  - Coverage: full render-training layout
  - Status: exact geometry and channel mapping from xLights-owned `layout.*` APIs
  - Notes:
    - `modelCount = 19`
    - `modelsMissingChannelMapping = 0`
    - `nodesMissingChannelMapping = 0`
- `preview-scene-geometry-desktop-show-live.json`
  - Source: live xLights layout export
  - Show folder: `/Users/robterry/Desktop/Show`
  - Coverage: full real-world layout
  - Status: exact geometry and channel mapping from xLights-owned `layout.*` APIs
  - Notes:
    - `modelCount = 113`
    - `customModelCount = 40`
    - `customModelPct = 35.4%`
    - `modelsMissingChannelMapping = 0`
    - `nodesMissingChannelMapping = 0`
- `preview-scene-window-render-training-treeflat.json`
  - Source geometry: `preview-scene-geometry-render-training-live.json`
  - Source render: `singlestrand-treeflat-stage1-coverage-v1-chaseSize-registry-v1.20260319T201838Z.fseq`
  - Window: `1000ms..5000ms`
  - Frames: offsets `8,10,12`
  - Status: whole-layout sparse dynamic window reconstruction over cached geometry
- `render-observation-render-training-treeflat.json`
  - Source window: `preview-scene-window-render-training-treeflat.json`
  - Status: first macro-level `render_observation_v1` proof
  - Notes:
    - `frameCount = 3`
    - `maxActiveModelCount = 1`
    - `densityBucketSeries = [sparse, sparse, sparse]`
    - `activeFamilyTotals = { Tree: 3 }`
    - `maxSceneSpreadRatio > 0`
    - `regionTotals = { middle_center: 192 }`
- `sequence-critique-render-training-treeflat.json`
  - Source observation: `render-observation-render-training-treeflat.json`
  - Status: first split `sequence_critique_v1` proof
  - Notes:
    - `ladderLevel = macro`
    - separate `designerSummary` and `sequencerSummary`
    - ordered `nextMoves` for both agents
- `sequence-learning-record-render-training-treeflat.json`
  - Source chain:
    - `preview_scene_window_v1`
    - `render_observation_v1`
    - `sequence_critique_v1`
  - Status: first `sequence_learning_record_v1` proof
  - Notes:
    - `cycleOutcome = usable_with_revision`
    - preserves reconstruction vs truth vs critique boundaries

Harness runner:

- [run-feedback-proof.sh](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/run-feedback-proof.sh)
  - rebuilds the current proof chain end to end:
    - window
    - observation
    - critique
    - learning record
- [run-feedback-suite.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/run-feedback-suite.py)
  - rebuilds a small multi-scenario macro suite across:
    - `TreeFlat`
    - `MatrixLowDensity`
    - `ArchSingle`
    - `TreeFlat + ArchSingle` composite support case
    - `ArchSingle + MatrixLowDensity` balanced support case
    - `ArchSingle + MatrixLowDensity` whole-sequence macro case
    - `ArchSingle` target-refinement macro case
  - emits:
    - per-scenario window / observation / critique / learning record artifacts
    - [sequence-feedback-suite-summary.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-feedback-suite-summary.json)
- [run-section-feedback-suite.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/run-section-feedback-suite.py)
  - rebuilds a small section-level suite over longer sampled windows across:
    - `TreeFlat + ArchSingle` split section case
    - `ArchSingle + MatrixLowDensity` coherent lead-plus-support case
    - `ArchSingle + MatrixLowDensity` section-selection case
  - emits:
    - per-scenario section window / observation / critique / learning record artifacts
    - [sequence-section-feedback-suite-summary.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-section-feedback-suite-summary.json)
- [validate-request-scope-regressions.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/validate-request-scope-regressions.py)
  - validates the retained suite summaries and learning records against the declared scenario request scope
  - fails if a scenario loses its expected:
    - `requestedScope.mode`
    - `requestedScope.reviewStartLevel`
    - `requestedScope.sectionScopeKind`
    - expected critique ladder level
    - expected scope semantics:
      - `whole_sequence` keeps empty section and target scope
      - `section_selection` keeps section scope without explicit targets
      - `section_target_refinement` keeps both section and target scope
      - `target_refinement` keeps explicit target scope without section scope
    - expected retained outcome reads:
      - macro suite:
        - `focusRead`
        - `familyBalanceRead`
        - `cycleOutcome`
      - section suite:
        - `intentRead`
        - `compositionRead`
        - `familyBalanceRead`
        - `cycleOutcome`
    - expected retained render-observation reads:
      - `activeModelNames`
      - `leadModel`
      - `maxActiveModelCount`
    - coarse numeric tolerance bands for stable macro signals:
      - `maxSceneSpreadRatio`
      - `centroidMotionMean`
- [extract-sequence-revision-gate.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/extract-sequence-revision-gate.py)
  - converts a critique artifact into an explicit revision gating decision
  - current kept gate proofs:
    - [sequence-revision-gate-treeflat_sparse_macro.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-revision-gate-treeflat_sparse_macro.json)
    - [sequence-revision-gate-treeflat_archsingle_composite_macro.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-revision-gate-treeflat_archsingle_composite_macro.json)
    - [sequence-revision-gate-archsingle_matrixlowdensity_section_balanced.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-revision-gate-archsingle_matrixlowdensity_section_balanced.json)
- [build-sequence-artistic-goal.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-sequence-artistic-goal.py)
  - derives a designer-owned `sequence_artistic_goal_v1` from current critique context
- [build-sequence-revision-objective.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-sequence-revision-objective.py)
  - turns:
    - artistic goal
    - critique
    - revision gate
  - into a split `sequence_revision_objective_v1` with:
    - `designerDirection`
    - `sequencerDirection`
  - kept proof artifacts:
    - [sequence-artistic-goal-archsingle_matrixlowdensity_section_balanced.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-artistic-goal-archsingle_matrixlowdensity_section_balanced.json)
    - [sequence-revision-objective-archsingle_matrixlowdensity_section_balanced.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-revision-objective-archsingle_matrixlowdensity_section_balanced.json)

Request scope vocabulary:

- retained training artifacts now carry the same request-scope summary as the live app:
  - `mode`
  - `reviewStartLevel`
  - `sectionScopeKind`
- current meanings:
  - `whole_sequence`
    - broad generation or broad redesign
    - review starts at `macro`
  - `section_selection`
    - one or more selected timing-track windows
    - review starts at `section`
  - `section_target_refinement`
    - selected timing-track windows plus explicit targets
    - review starts at `section`
  - `target_refinement`
    - local target refinement without explicit section selection
    - review starts at `group` or `model`
- `section` remains timing-track agnostic:
  - phrase
  - lyric
  - beat
  - chord
  - cue
  - user-defined timing track windows
- this keeps offline proofs aligned with:
  - live history summaries
  - render critique context
  - sequencer revision briefs
  - sequence plan metadata

- `preview-scene-frame-singlelinehorizontal-singlestrand.json`
  - Source model: `SingleLineHorizontal`
  - Source render: `singlestrand-singlelinehorizontal-expanded-sweep-v1-chaseSize-registry-v1.20260319T143651Z.fseq`
  - Window: `1000ms..5000ms`
  - Joined frame: offset `10` (`frameTimeMs=1250`)
- `preview-scene-frame-matrixlowdensity-singlestrand.json`
  - Source model: `MatrixLowDensity`
  - Source render: `singlestrand-matrixlowdensity-stage1-coverage-v1-chaseSize-registry-v1.20260319T201401Z.fseq`
  - Window: `1000ms..5000ms`
  - Joined frame: offset `10` (`frameTimeMs=1250`)
- `preview-scene-frame-treeflat-singlestrand.json`
  - Source model: `TreeFlat`
  - Source render: `singlestrand-treeflat-stage1-coverage-v1-chaseSize-registry-v1.20260319T201838Z.fseq`
  - Window: `1000ms..5000ms`
  - Joined frame: offset `10` (`frameTimeMs=1250`)

What this proves:

- We can export full whole-layout geometry accurately from xLights itself.
- We can do that on a real custom-heavy show, not just the training fixture.
- We can join authoritative rendered frame windows back onto cached whole-layout geometry.
- We can derive first-pass macro observation signals from reconstructed whole-layout windows.
- We can compare active scene bounds against full-layout bounds and track region occupancy over time.
- We can translate render observations into separate designer-facing and sequencer-facing critique summaries.
- We can package the resulting checkpoint into a first complete `sequence_learning_record_v1`.
- We can derive static node geometry for a canonical training model.
- We can extend the same join approach from 1D models into 2D matrix layouts.
- We can extend the join approach into tree-style layouts with per-string/per-node structure.
- We can decode authoritative xLights frame data from `.fseq`.
- We can join decoded node RGB state back onto spatial node coordinates.
- We can emit a machine-readable `preview_scene_frame_v1` artifact.

What this does not prove yet:

- Full-layout reconstruction over time from rendered windows
- Group/submodel handling
- Preview parity against House Preview output

Harness status:

- The sequencer render-training harness is now tied into:
  - `preview_scene_window_v1`
  - `render_observation_v1`
  - `sequence_critique_v1`
  - `sequence_learning_record_v1`
- The current macro suite covers:
  - `Tree`
  - `Matrix`
  - `Arches`
  - one broader `Tree + Arches` multi-family composite case
  - one broader `Arches + Matrix` lead-plus-support composite case
  - one broader `Arches + Matrix` whole-sequence macro-scope case
  - one narrow `Arches` local target-refinement case
- The current suite now demonstrates three macro outcomes:
  - too narrow / single-family
  - broad but over-split
  - broad and coherent lead-plus-support
- The current section suite demonstrates two section outcomes:
  - split section composition
  - coherent lead-plus-support composition
- The retained section suite now also distinguishes:
  - `section_selection`
  - from `section_target_refinement`
- The current section suite also exposed a real next-layer weakness:
  - a section can be compositionally coherent while still being too flat over time
- The current gate proofs now turn those critique outcomes into explicit routing:
  - narrow macro case -> revise at `macro` with `shared` ownership
  - broad but split macro case -> revise at `macro` with `designer` ownership
  - coherent but flat section case -> revise at `section` with `shared` ownership
- The current artistic-goal proof now keeps the roles distinct:
  - designer owns the artistic correction
  - sequencer receives a bounded execution objective
- The broader app-assistant/native simulation harness is not yet wired to these sequencing feedback artifacts.

## Real-Show Live Proof

- `preview-scene-geometry-holidayroad-live.json`
- `render-observation-holidayroad-live.json`
- `render-critique-context-holidayroad-live.json`
- `live-render-proof-holidayroad-live.json`

These artifacts were generated from the real show at `/Users/robterry/Desktop/Show/HolidayRoad/` using the owned `sequence.render-samples` API against `HolidayRoad.fseq`, then processed through the app runtime observation and critique builders.
