# Preview Scene Reconstruction Proofs

This directory holds small, bounded proof artifacts for preview-scene reconstruction work.

Current proof:

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

What this proves:

- We can derive static node geometry for a canonical training model.
- We can extend the same join approach from 1D models into 2D matrix layouts.
- We can decode authoritative xLights frame data from `.fseq`.
- We can join decoded node RGB state back onto spatial node coordinates.
- We can emit a machine-readable `preview_scene_frame_v1` artifact.

What this does not prove yet:

- Full-layout reconstruction
- Group/submodel handling
- Live geometry export from the render-training xLights session
- Preview parity against House Preview output
