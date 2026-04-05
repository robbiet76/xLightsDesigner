# Analysis Eval Folder

Evaluation and probe tooling for the analysis service.

## Directory Layout
- `runners/`: promoted evaluation and benchmark entrypoints
- `probes/`: manual investigative scripts and corpus helpers
- `corpus/`: reference corpus JSON files used for eval and audit work
- `archive/`: reserved for superseded or low-value probes after review
- `structure_eval_cases.example.json`: template for local machine-specific eval cases
- `manifest.v1.json`: tracked lifecycle inventory for this subtree

## Canonical Data Ownership
- Runtime packaged corpus source of truth:
  - `training-packages/training-package-v1/modules/audio_track_analysis/datasets/structure_corpus_top50_holiday_keywords.json`
- Files under `eval/corpus/` are reference material, not the runtime canonical dataset.

## Active Runners
- `runners/structure_eval.py`
- `runners/app_level_structure_eval.py`
- `runners/run_progressive_analysis_benchmark.py`

## Local-Only Files
- Use `structure_eval_cases.example.json` as template.
- Create your local variant as `structure_eval_cases.local.json` for machine-specific audio paths.
- Local variants should not be committed.
