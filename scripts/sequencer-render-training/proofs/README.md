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
  - emits:
    - per-scenario window / observation / critique / learning record artifacts
    - [sequence-feedback-suite-summary.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-feedback-suite-summary.json)
- [run-section-feedback-suite.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/run-section-feedback-suite.py)
  - rebuilds a small section-level suite over longer sampled windows across:
    - `TreeFlat + ArchSingle` split section case
    - `ArchSingle + MatrixLowDensity` coherent lead-plus-support case
  - emits:
    - per-scenario section window / observation / critique / learning record artifacts
    - [sequence-section-feedback-suite-summary.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/proofs/sequence-section-feedback-suite-summary.json)

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
- The current suite now demonstrates three macro outcomes:
  - too narrow / single-family
  - broad but over-split
  - broad and coherent lead-plus-support
- The current section suite demonstrates two section outcomes:
  - split section composition
  - coherent lead-plus-support composition
- The current section suite also exposed a real next-layer weakness:
  - a section can be compositionally coherent while still being too flat over time
- The broader app-assistant/native simulation harness is not yet wired to these sequencing feedback artifacts.
