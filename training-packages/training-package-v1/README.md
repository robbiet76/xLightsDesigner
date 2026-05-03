# Training Package v1

This package defines portable training/config assets for the Designer agent under a BYO-provider model.

Modules:
- `audio_track_analysis`
- `lighting_design_principles`
- `xlights_sequencer_execution`

Notes:
- This package stores prompts, rubric data, eval configuration, compact datasets, and references to runtime/spec assets.
- API keys are not stored in this package.
- Packaged corpora used at runtime should live under module `datasets/`.
- Portable datasets should retain durable features and labels, not raw generated intermediates or bulky source artifacts.
- Machine-specific eval inputs (for example local audio path case files) must stay outside package assets.
