# Training Package Audit - 2026-03-10

Status: Baseline audit completed  
Scope: map existing local training/eval assets into `training-package-v1`.

## 1) Summary
A v1 training package scaffold is now present at:
- `training-packages/training-package-v1/`

The package defines all three required modules:
1. `audio_track_analysis`
2. `lighting_design_principles`
3. `xlights_sequencer_execution`

## 2) Mapped Existing Assets

### 2.1 Audio Track Analysis
Mapped into:
- `training-packages/training-package-v1/modules/audio_track_analysis/datasets/index.json`
- `training-packages/training-package-v1/modules/audio_track_analysis/eval/index.json`

Referenced local sources:
- `apps/xlightsdesigner-analysis-service/eval/structure_eval.py`
- `apps/xlightsdesigner-analysis-service/eval/export_xlights_track_case.py`
- `apps/xlightsdesigner-analysis-service/eval/ingest_structure_corpus.py`
- `apps/xlightsdesigner-analysis-service/eval/structure_eval_cases.local.json`
- `apps/xlightsdesigner-analysis-service/eval/structure_corpus_christmas_top50_holiday_keywords.json`
- `apps/xlightsdesigner-analysis-service/eval/structure_corpus_christmas_overfetch.json`

### 2.2 Lighting Design Principles
Mapped into:
- `training-packages/training-package-v1/modules/lighting_design_principles/*`

Current status:
- prompt baseline added,
- datasets/eval/few-shot placeholders established.

### 2.3 xLights Sequencer Execution
Mapped into:
- `training-packages/training-package-v1/modules/xlights_sequencer_execution/*`

Referenced local sources:
- `specs/xlights-sequencer-control-api-surface-contract.md`
- `specs/xlights-sequencer-control-designer-interaction-contract.md`
- `apps/xlightsdesigner-ui/tests/agent`
- `scripts/xlights-control/run-all.sh`

## 3) Gaps to Close
1. Runtime loader is not yet package-driven (prompts still partly embedded in app code).
2. Lighting-design and sequencer few-shot corpora are placeholders.
3. Package compatibility/eval gate is not yet enforced in UI.

## 4) Immediate Next Actions
1. Implement package asset loader for audio structure prompt path.
2. Add package version + module version diagnostics in analysis output.
3. Define minimal few-shot schema and start seeding from approved runs.
