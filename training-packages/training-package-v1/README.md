# Training Package v1

This package defines portable training/config assets for the Designer agent under a BYO-provider model.

Modules:
- `audio_track_analysis`
- `lighting_design_principles`
- `xlights_sequencer_execution` (`modules/xlights_sequencer_execution/README.md`)

Notes:
- This package stores prompts, rubric data, eval configuration, compact datasets, and references to runtime/spec assets.
- API keys are not stored in this package.
- Packaged corpora used at runtime should live under module `datasets/`.
- Portable datasets should retain durable features and labels, not raw generated intermediates or bulky source artifacts.
- Real song lyrics belong to runtime/user project analysis artifacts, not the portable package. Package datasets may retain compact lyric-derived features only.
- Machine-specific eval inputs (for example local audio path case files) must stay outside package assets.
- The sequencer execution module README is the stable guide for how package contracts and fixtures use project `display/model-index.json` and `display/target-behavior.json`.
- Some module source references still point to `apps/xlightsdesigner-ui` because those files are the existing shared JS agent/runtime and eval corpus, not Electron UI code. Native macOS app behavior should be referenced through `apps/xlightsdesigner-macos` tests/specs when the package describes current app persistence, project metadata, or display/model-index behavior.
