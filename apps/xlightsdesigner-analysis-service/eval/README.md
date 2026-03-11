# Analysis Eval Folder

This folder is for evaluation tooling and intermediate corpus work for the analysis service.

## Canonical Data Ownership
- Runtime packaged corpus source of truth:
  - `training-packages/training-package-v1/modules/audio_track_analysis/datasets/structure_corpus_top50_holiday_keywords.json`
- Keep only one canonical tracked copy of packaged corpora.

## Local-Only Files
- Use `structure_eval_cases.example.json` as template.
- Create your local variant as `structure_eval_cases.local.json` for machine-specific audio paths.
- Local variants should not be committed.
