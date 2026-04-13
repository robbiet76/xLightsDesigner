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
