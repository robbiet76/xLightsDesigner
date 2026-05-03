# Render Training Proofs

This directory keeps compact proof summaries and regression fixtures only. Full
preview-scene geometry, reconstructed windows, observations, critiques, revision
gates, objectives, and learning records are generated artifacts and should be
written to a local output directory instead of being committed.

Retained files:

- `feedback-regression-fixtures.json`
  - Compact fixture used by `validate-request-scope-regressions.py`.
  - Replaces the previous per-scenario window, observation, critique, gate,
    objective, and learning-record JSON files.
  - Preserves request-scope, critique ladder, observation summary, gate,
    objective, and learning-record scope assertions for the macro and section
    feedback suites.
- `preview-scene-geometry-proof-summaries.json`
  - Compact summary index for previously captured geometry proofs.
  - Includes real-show custom-model coverage evidence without retaining full
    geometry payloads.
- `live-render-proof-holidayroad-live.json`
  - Compact live-render proof summary for the HolidayRoad run.
  - Full render observation and critique artifacts were removed from source
    control and should be regenerated locally if needed.

Default local output:

- `/tmp/xld-render-training-proofs`

Set these environment variables when rebuilding detailed artifacts:

- `XLD_RENDER_TRAINING_GEOMETRY`: path to a local `preview_scene_geometry_v1`
  export.
- `XLD_RENDER_TRAINING_PROOF_OUT_DIR`: output directory for regenerated proof
  artifacts.

Useful commands:

```bash
python3 scripts/sequencer-render-training/tooling/validate-request-scope-regressions.py
```

```bash
XLD_RENDER_TRAINING_GEOMETRY=/path/to/preview-scene-geometry.json \
XLD_RENDER_TRAINING_PROOF_OUT_DIR=/tmp/xld-render-training-proofs \
bash scripts/sequencer-render-training/tooling/run-feedback-proof.sh
```

```bash
XLD_RENDER_TRAINING_GEOMETRY=/path/to/preview-scene-geometry.json \
XLD_RENDER_TRAINING_PROOF_OUT_DIR=/tmp/xld-render-training-proofs \
python3 scripts/sequencer-render-training/tooling/run-feedback-suite.py
```

```bash
XLD_RENDER_TRAINING_GEOMETRY=/path/to/preview-scene-geometry.json \
XLD_RENDER_TRAINING_PROOF_OUT_DIR=/tmp/xld-render-training-proofs \
python3 scripts/sequencer-render-training/tooling/run-section-feedback-suite.py
```

Retention rule:

- Keep durable assertions in compact fixtures.
- Keep large generated proof payloads local unless a small minimized fixture is
  required for a regression test.
- Derive future custom-model and submodel training evidence from
  `display/model-index.json` and `display/target-behavior.json`, not from a
  separate custom-model proof artifact path.
