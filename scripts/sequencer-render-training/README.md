# Sequencer Render Training

Internal-only tooling for xLights-backed render sweeps used to train sequencer realization behavior.

This tooling does **not** replace xLights rendering.
It drives xLights as the authoritative renderer, captures the render artifact, and writes a structured training record.

Current capture policy:
- GIF-based training reads the assigned effect timing window, not the full exported sequence span.
- Animated effects are evaluated from temporal signatures first, with representative frames kept only as supporting evidence.
- `run-manifest.sh` now writes `screeningQuality` so collapsed sweeps are flagged instead of silently treated as usable training evidence.

Primary system roadmap:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

## Directory Layout
- `catalog/`: stable training catalogs and standards
- `runners/`: operator-facing execution entrypoints
- `generators/`: reports, planning utilities, and manifest-generation scripts
- `evaluation/`: evaluator scripts
- `evaluation/fixtures/`: evaluation case files and controlled vocabulary fixtures
- `registry/`: registry planning inputs
- `tooling/`: shared helpers, export tools, build helpers, and extractors
- `analysis/`: decoded render analysis helpers
- `manifests/`: active render-sweep manifests
- `archive/`: reserved for historical or superseded material
- `manifest.v1.json`: tracked lifecycle inventory for this subtree

## Core Entry Points
- `runners/run-sample.sh`
- `runners/run-manifest.sh`
- `runners/run-model-batch.sh`
- `runners/run-packed-model-batch.sh`
- `runners/run-overnight-approved-matrix.sh`
- `runners/run-registry-plan.sh`
- `runners/run-stage1-coverage-round.sh`
- `runners/run-effect-training-automation-cycle.sh`
- `runners/run-effect-parameter-screening-plan.sh`
- `runners/run-live-outcome-harvest-cycle.sh`

## Core Catalogs
- `catalog/effect-parameter-registry.json`
- `catalog/generic-layout-model-catalog.json`
- `catalog/generic-layout-geometry-audit.json`
- `catalog/stage1-effect-model-scope.json`
- `catalog/training-standards.json`
- `catalog/sequencer-unified-training-set-v1.json`
- `catalog/effect-family-outcomes/`
- `catalog/effect-settings-coverage-report-v1.json`
- `catalog/effect-training-automation-plan-v1.json`
- `catalog/effect-parameter-screening-plan-v1.json`

## Common Supporting Tools
- `generators/generate-parameter-sweep-manifest.py`
- `generators/generate-registry-plan-manifests.py`
- `generators/generate-look-catalog.py`
- `generators/generate-intent-vocab-summary.py`
- `generators/generate-intent-gap-report.py`
- `generators/generate-range-transition-report.py`
- `tooling/normalize-manifest.py`
- `tooling/build-animation-fixture.py`
- `tooling/extract-artifact-features.sh`
- `tooling/extract-observations.sh`
- `tooling/query-priority-intent-map.py`
- `tooling/select-priority-effect.py`
- `tooling/build-unified-training-set.mjs`
- `tooling/harvest-effect-outcome-records.mjs`
- `tooling/build-effect-settings-coverage-report.mjs`
- `tooling/build-effect-training-automation-plan.mjs`
- `tooling/build-effect-parameter-screening-plan.mjs`
- `tooling/resolve-controlled-designer-term.py`
- `analysis/analyze_decoded_window.py`

## Usage

```bash
bash scripts/sequencer-render-training/runners/run-sample.sh \
  --manifest scripts/sequencer-render-training/manifests/on-sample-v1.json \
  --out-dir /tmp/sequencer-render-training
```

```bash
bash scripts/sequencer-render-training/runners/run-manifest.sh \
  --manifest scripts/sequencer-render-training/manifests/singlestrand-reduced-sweep-v1.json \
  --out-dir /tmp/sequencer-render-training-batch
```

```bash
bash scripts/sequencer-render-training/runners/run-model-batch.sh \
  --manifest scripts/sequencer-render-training/manifests/on-reduced-sweep-v1.json \
  --out-dir /tmp/sequencer-render-training-model-batch
```

```bash
bash scripts/sequencer-render-training/runners/run-packed-model-batch.sh \
  --manifest scripts/sequencer-render-training/manifests/on-reduced-sweep-v1.json \
  --out-dir /tmp/sequencer-render-training-packed-batch
```

```bash
python3 scripts/sequencer-render-training/tooling/build-animation-fixture.py \
  --source /Users/robterry/Desktop/Show/Test/Validation-Clean-Phase1.xsq \
  --output /Users/robterry/Desktop/Show/Test/RenderTraining/Validation-Clean-Phase1-AnimationOnly.xsq \
  --duration-seconds 30
```

```bash
python3 scripts/sequencer-render-training/tooling/normalize-manifest.py \
  --manifest scripts/sequencer-render-training/manifests/singlestrand-linear-expanded-sweep-v2.json \
  --standards scripts/sequencer-render-training/catalog/training-standards.json \
  --out-file /tmp/normalized-manifest.json
```

```bash
python3 scripts/sequencer-render-training/generators/generate-model-geometry-audit.py \
  --show-dir /Users/robterry/Projects/xLightsDesigner/var/render-training \
  --out-file scripts/sequencer-render-training/catalog/generic-layout-geometry-audit.json
```

```bash
python3 scripts/sequencer-render-training/tooling/export-sequencer-stage1-bundle.py \
  --equalization-board /tmp/render-training-stage1-equalization.v10.json \
  --coverage-audit /private/tmp/render-training-stage1-coverage-audit.v3.json \
  --intent-map /tmp/render-training-priority-intent-map.v5.json \
  --intent-map /tmp/render-training-shockwave-interaction-intent-map.v2.json \
  --intent-map /tmp/render-training-twinkle-interaction-intent-map.v1.json \
  --intent-map /tmp/render-training-singlestrand-intent-map.v1.json \
  --intent-map /tmp/render-training-colorwash-intent-map.v1.json \
  --intent-map /tmp/render-training-on-intent-map.v1.json \
  --intent-map /tmp/render-training-shimmer-intent-map.v1.json \
  --output apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js
```

```bash
node scripts/sequencer-render-training/tooling/build-unified-training-set.mjs
```

```bash
node scripts/sequencer-render-training/tooling/harvest-effect-outcome-records.mjs \
  --source /path/to/project.xdproj
```

```bash
bash scripts/sequencer-render-training/runners/run-live-outcome-harvest-cycle.sh \
  --source /path/to/project.xdproj
```

```bash
node scripts/sequencer-render-training/tooling/build-effect-settings-coverage-report.mjs
```

```bash
bash scripts/sequencer-render-training/runners/run-effect-parameter-screening-plan.sh \
  --out-dir /tmp/effect-parameter-screening-generated
```

```bash
python3 scripts/sequencer-render-training/generators/generate-parameter-sweep-manifest.py \
  --registry scripts/sequencer-render-training/catalog/effect-parameter-registry.json \
  --base-manifest scripts/sequencer-render-training/manifests/singlestrand-singlelinehorizontal-expanded-sweep-v1.json \
  --parameter numberChases \
  --out-file /tmp/singlestrand-numberchases.generated.json
```

```bash
python3 scripts/sequencer-render-training/generators/generate-registry-plan-manifests.py \
  --registry scripts/sequencer-render-training/catalog/effect-parameter-registry.json \
  --plan scripts/sequencer-render-training/registry/registry-planning-phase1.json \
  --out-dir /tmp/registry-plan-manifests \
  --summary-out /tmp/registry-plan-manifests/summary.json
```

```bash
python3 scripts/sequencer-render-training/evaluation/evaluate-priority-intent-retrieval.py \
  --intent-map /tmp/render-training-priority-intent-map.v2.json \
  --cases scripts/sequencer-render-training/evaluation/fixtures/priority-intent-eval-cases.v3.json \
  --out-file /tmp/priority-intent-eval.v1.json
```

```bash
python3 scripts/sequencer-render-training/evaluation/evaluate-controlled-designer-vocabulary.py \
  --intent-map /tmp/render-training-priority-intent-map.v2.json \
  --vocab scripts/sequencer-render-training/evaluation/fixtures/controlled-designer-vocab.v1.json \
  --cases scripts/sequencer-render-training/evaluation/fixtures/controlled-designer-vocab-cases.v1.json \
  --out-file /tmp/controlled-designer-vocab-eval.v1.json
```

```bash
python3 scripts/sequencer-render-training/evaluation/evaluate-priority-effect-selection.py \
  --intent-map /tmp/render-training-priority-intent-map.v2.json \
  --cases scripts/sequencer-render-training/evaluation/fixtures/priority-effect-selection-cases.v1.json \
  --out-file /tmp/priority-effect-selection-eval.v1.json
```

```bash
python3 scripts/sequencer-render-training/analysis/analyze_decoded_window.py \
  --decoded-window /tmp/sample.decoded-features.json \
  --model-metadata /tmp/sample.model-metadata.json \
  --model-type single_line \
  --effect-name SingleStrand \
  --effect-settings '{"mode":"Chase","chaseType":"Left-Right"}' \
  --shared-settings '{"renderStyle":"Single Line"}' \
  --out-file /tmp/sample.analysis.json
```

## Environment
- `XLIGHTS_BASE_URL`
  - default: `http://127.0.0.1:49914`
- `CURL_MAX_TIME`
  - default: `60`
- `XLIGHTS_RECYCLE_BEFORE_SAMPLE`
  - default: `0`
  - optional manual recovery mode; not used by default
- `XLIGHTS_FORCE_RECYCLE_BEFORE_BATCH`
  - default: `0`
  - optional manual recovery mode for batch runs
- `RENDER_TRAINING_ROOT`
  - recommended: `/Users/robterry/Projects/xLightsDesigner/var/render-training`
  - legacy examples may still reference `/Users/robterry/Projects/xLightsDesigner/render-training`
  - internal workspace for packed `.fseq`, working `.xsq`, copied manifests, and derived artifacts
- `PHASE_SET`
  - used by `runners/run-overnight-approved-matrix.sh`
  - values:
    - `phase1`
    - `phase1_phase2`
  - default: `phase1_phase2`

## Notes
- This is an internal harness, not product runtime.
- xLights export currently needs a concrete model, not a `ModelGroup`.
- Packed batch runs now use the internal show-side workspace under `RenderTraining/`:
  - `working/` for temporary `.xsq`
  - `fseq/` for primary packed `.fseq`
  - `manifests/` for copied manifests
  - `derived/` reserved for future decode outputs
- Parameter sampling should come from the effect parameter registry where possible.
- Intent mapping should only be built on structurally mature effects and geometry profiles.
- Registry planning should be geometry-profile-aware.
- The unified training set is the canonical general-training surface joining Stage 1 baseline knowledge with Phase 3 live outcome slots.
- Preference learning must remain outside the unified training set in a separate store.
