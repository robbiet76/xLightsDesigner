# Analysis Eval Folder

Evaluation and probe tooling for the analysis service.

## Directory Layout
- `runners/`: promoted evaluation and benchmark entrypoints
- `probes/`: manual investigative scripts and corpus helpers
- `archive/`: reserved for superseded or low-value probes after review
- `structure_eval_cases.example.json`: template for local machine-specific eval cases

## Canonical Data Ownership
- Runtime packaged corpus source of truth:
  - `training-packages/training-package-v1/modules/audio_track_analysis/datasets/structure_features_holiday_keywords.json`
- Raw lyric corpus exports are not tracked here. Regenerate temporary corpus
  review files with `probes/ingest_structure_corpus.py` when needed, then
  promote only compact feature datasets into the training package.

## Active Runners
- `runners/structure_eval.py`
- `runners/app_level_structure_eval.py`
- `runners/run_progressive_analysis_benchmark.py`

## Local-Only Files
- Use `structure_eval_cases.example.json` as template.
- Create your local variant as `structure_eval_cases.local.json` for machine-specific audio paths.
- Local variants should not be committed.
