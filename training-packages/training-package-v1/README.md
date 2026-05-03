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
- Sequence training should use project `display/model-index.json` as the structural target source for built-in models, groups, custom models, node layout, and submodels. Custom-only training exports, when useful, should be derived from that shared index rather than maintained as a parallel artifact.
- Project `display/target-behavior.json` is the local evidence layer for learned target and submodel effect suitability. Portable package fixtures may summarize that artifact, but user-specific behavior learning should remain project-local and advisory.
- The sequencer execution module README is the stable guide for how package contracts and fixtures use project artifacts.
- Some module source references still point to `apps/xlightsdesigner-ui` because those files are the existing shared JS agent/runtime and eval corpus, not Electron UI code. Native macOS app behavior should be referenced through `apps/xlightsdesigner-macos` tests/specs when the package describes current app persistence, project metadata, or display/model-index behavior.
