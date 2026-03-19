# Sequencer Render Training

Internal-only tooling for xLights-backed render sweeps used to train sequencer realization behavior.

This tooling does **not** replace xLights rendering.
It drives xLights as the authoritative renderer, captures the render artifact, and writes a structured training record.

Primary system roadmap:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

## First Slice

The current harness is intentionally small:
- one manifest file
- one sample at a time
- first-class support for `On`, `SingleStrand`, `Shimmer`, and `Color Wash`
- direct model export path:
  - `openSequence`
  - `addEffect`
  - `renderAll`
  - `exportModelWithRender`
  - `closeSequence`
- packed training path:
  - `openSequence`
  - `addEffect`
  - `saveSequence`
  - `closeSequence`
  - `batchRender`
  - `.fseq` capture

## Files

- `run-sample.sh`: execute one sample from a sweep manifest
- `run-manifest.sh`: execute all samples from a sweep manifest
- `run-model-batch.sh`: execute a manifest against one already-open xLights session with per-sample sequence isolation
- `run-packed-model-batch.sh`: execute a manifest by packing multiple sample windows into one open sequence, saving and rendering once, then recording per-sample windows against one packed `.fseq`
- `run-overnight-approved-matrix.sh`: execute the approved first-round overnight matrix sequentially against the debug xLights build and write a master summary
- `run-registry-plan.sh`: generate registry-driven manifests from a plan file and execute them sequentially against the debug xLights build
- `build-animation-fixture.py`: derive a short animation-only fixture sequence from an existing `.xsq`
- `extract-artifact-features.sh`: capture basic artifact facts for the training record
- `extract-observations.sh`: derive first-pass labels and baseline scores from sample context and artifact geometry
- `build-comparison.sh`: produce pairwise preference records from observation score outputs
- `build-record-comparison.sh`: produce pairwise preference records directly from sample record JSON
- `generate-sample-comparisons.sh`: generate a comparison set from all records in a run directory
- `generate-look-catalog.py`: group decoded sample records into distinct look clusters instead of a single winner list
  - also derives intent-facing tags such as `restrained`, `clean`, `directional`, `busy`, `fill`, and `texture_heavy`
- `generate-intent-vocab-summary.py`: roll a look catalog up into an effect/model intent vocabulary with representative samples
- `generate-intent-gap-report.py`: compare an intent summary against seed coverage targets while preserving extra discovered looks and tags
- `generate-range-transition-report.py`: detect where a sampled slider range actually changes semantic behavior across ordered anchor values
- `effect-parameter-registry.json`: formal effect-parameter registry for anchor values, importance, hypotheses, and stop rules
- `generate-parameter-sweep-manifest.py`: generate registry-driven sweep manifests from a base effect manifest and a registered parameter
- `registry-planning-phase1.json`: first planning set mapping geometry profiles and effects to registry-driven sweeps
- `generate-registry-plan-manifests.py`: emit a batch of registry-driven manifests from a planning file
- `generate-priority-effect-summary.py`: consolidate priority-effect region summaries from completed runs into one machine-readable summary
- `generate-priority-intent-map.py`: build a first-pass intent map from the consolidated priority-effect summary
- `query-priority-intent-map.py`: query the first-pass intent map for structurally matched regions
- `evaluate-priority-intent-retrieval.py`: run a small structural retrieval evaluation set against the intent map
- `priority-intent-eval-cases.v1.json`: first evaluator case set for Bars and Marquee structural requests
- `priority-intent-eval-cases.v2.json`: expanded evaluator case set including Pinwheel structural requests
- `priority-intent-eval-cases.v3.json`: expanded evaluator case set including Spirals structural requests
- `select-priority-effect.py`: choose the best-supported effect for a constrained structural request
- `generate-effect-maturity-report.py`: compute the current maturity stage for each effect from summaries and evaluator outputs
- `training-standards.json`: shared structural-test standard for palette, brightness policy, and analyzer registry
  - also defines packed decode frame emission policy
- `normalize-manifest.py`: apply the shared training standard to a manifest before execution
- `generate-model-geometry-audit.py`: audit the canonical training layout by xLights model settings and compare related variants against a structural baseline
- `generic-layout-geometry-audit.json`: generated audit of the canonical training layout grouped by xLights `DisplayAs`
- `analysis/analyze_decoded_window.py`: dispatch decoded `.fseq` windows through the geometry-family analyzer framework
- `analysis/framework.py`: generic analyzer registry and family-specific sequence-analysis scaffolding
- `lib.sh`: shared xLights automation helpers
- `manifests/on-sample-v1.json`: example manifest
- `manifests/on-reduced-sweep-v1.json`: reduced `On` sweep
- `manifests/shimmer-outline-dutyfactor-range-v1.json`: sampled duty-factor range sweep for `Shimmer`
- `manifests/singlestrand-linear-chasesize-range-v1.json`: sampled chase-size range sweep for `SingleStrand`
- `manifests/on-matrix-reduced-sweep-v1.json`: reduced `On` sweep on a concrete matrix model
- `manifests/singlestrand-reduced-sweep-v1.json`: reduced `SingleStrand` sweep
- `manifests/singlestrand-linear-reduced-sweep-v1.json`: reduced `SingleStrand` sweep on a concrete linear model
- `manifests/shimmer-outline-reduced-sweep-v1.json`: reduced `Shimmer` sweep on a concrete outline model
- `manifests/colorwash-matrix-reduced-sweep-v1.json`: reduced `Color Wash` sweep on a concrete matrix model

## Usage

```bash
bash scripts/sequencer-render-training/run-sample.sh \
  --manifest scripts/sequencer-render-training/manifests/on-sample-v1.json \
  --out-dir /tmp/sequencer-render-training
```

```bash
bash scripts/sequencer-render-training/run-manifest.sh \
  --manifest scripts/sequencer-render-training/manifests/singlestrand-reduced-sweep-v1.json \
  --out-dir /tmp/sequencer-render-training-batch
```

```bash
bash scripts/sequencer-render-training/run-model-batch.sh \
  --manifest scripts/sequencer-render-training/manifests/on-reduced-sweep-v1.json \
  --out-dir /tmp/sequencer-render-training-model-batch
```

```bash
python3 scripts/sequencer-render-training/build-animation-fixture.py \
  --source /Users/robterry/Desktop/Show/Test/Validation-Clean-Phase1.xsq \
  --output /Users/robterry/Desktop/Show/Test/RenderTraining/Validation-Clean-Phase1-AnimationOnly.xsq \
  --duration-seconds 30
```

```bash
bash scripts/sequencer-render-training/run-packed-model-batch.sh \
  --manifest scripts/sequencer-render-training/manifests/on-reduced-sweep-v1.json \
  --out-dir /tmp/sequencer-render-training-packed-batch
```

```bash
python3 scripts/sequencer-render-training/normalize-manifest.py \
  --manifest scripts/sequencer-render-training/manifests/singlestrand-linear-expanded-sweep-v2.json \
  --standards scripts/sequencer-render-training/training-standards.json \
  --out-file /tmp/normalized-manifest.json
```

```bash
python3 scripts/sequencer-render-training/generate-model-geometry-audit.py \
  --show-dir /Users/robterry/Desktop/Show/RenderTraining \
  --out-file scripts/sequencer-render-training/generic-layout-geometry-audit.json
```

```bash
python3 scripts/sequencer-render-training/generate-parameter-sweep-manifest.py \
  --registry scripts/sequencer-render-training/effect-parameter-registry.json \
  --base-manifest scripts/sequencer-render-training/manifests/singlestrand-singlelinehorizontal-expanded-sweep-v1.json \
  --parameter numberChases \
  --out-file /tmp/singlestrand-numberchases.generated.json
```

```bash
python3 scripts/sequencer-render-training/generate-registry-plan-manifests.py \
  --registry scripts/sequencer-render-training/effect-parameter-registry.json \
  --plan scripts/sequencer-render-training/registry-planning-phase1.json \
  --out-dir /tmp/registry-plan-manifests \
  --summary-out /tmp/registry-plan-manifests/summary.json
```

```bash
python3 scripts/sequencer-render-training/generate-priority-effect-summary.py \
  --run-root /tmp/render-training-priority-effects-v1 \
  --run-root /tmp/render-training-priority-effects-v2-clean \
  --out-file /tmp/render-training-priority-effects-summary.json
```

```bash
python3 scripts/sequencer-render-training/generate-priority-intent-map.py \
  --summary /tmp/render-training-priority-effects-summary.json \
  --out-file /tmp/render-training-priority-intent-map.json
```

```bash
python3 scripts/sequencer-render-training/query-priority-intent-map.py \
  --intent-map /tmp/render-training-priority-intent-map.json \
  --intent directional \
  --intent segmented \
  --exclude-intent busy \
  --limit 5
```

```bash
python3 scripts/sequencer-render-training/evaluate-priority-intent-retrieval.py \
  --intent-map /tmp/render-training-priority-intent-map.v2.json \
  --cases scripts/sequencer-render-training/priority-intent-eval-cases.v3.json \
  --out-file /tmp/priority-intent-eval.v1.json
```

```bash
python3 scripts/sequencer-render-training/select-priority-effect.py \
  --intent-map /tmp/render-training-priority-intent-map.v2.json \
  --intent directional \
  --intent segmented \
  --exclude-intent busy
```

```bash
python3 scripts/sequencer-render-training/generate-effect-maturity-report.py \
  --summary /tmp/render-training-priority-effects-summary.v2.json \
  --intent-map /tmp/render-training-priority-intent-map.v2.json \
  --eval-results /tmp/priority-intent-eval.v3.json \
  --out-file /tmp/render-training-effect-maturity.v1.json
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

```bash
bash scripts/sequencer-render-training/run-overnight-approved-matrix.sh \
  --out-dir /tmp/render-training-overnight
```

```bash
bash scripts/sequencer-render-training/run-registry-plan.sh \
  --plan scripts/sequencer-render-training/registry-planning-phase1.json \
  --registry scripts/sequencer-render-training/effect-parameter-registry.json \
  --out-dir /tmp/render-training-registry-run
```

```bash
bash scripts/sequencer-render-training/run-overnight-approved-matrix.sh \
  --phase-set phase1 \
  --out-dir /tmp/render-training-phase1
```

```bash
bash scripts/sequencer-render-training/generate-sample-comparisons.sh \
  --run-dir /tmp/shimmer-outline-packed-fseq-decoded-debug \
  --criterion usefulness \
  --out-file /tmp/shimmer-outline-packed-fseq-decoded-debug/comparisons.usefulness.json
```

```bash
python3 scripts/sequencer-render-training/generate-look-catalog.py \
  --run-dir /tmp/singlestrand-cane-packed-fseq-decoded-debug \
  --out-file /tmp/singlestrand-cane-packed-fseq-decoded-debug/look-catalog.json
```

```bash
python3 scripts/sequencer-render-training/generate-intent-vocab-summary.py \
  --catalog /tmp/singlestrand-cane-packed-fseq-decoded-debug/look-catalog.json \
  --out-file /tmp/singlestrand-cane-packed-fseq-decoded-debug/intent-summary.json
```

```bash
python3 scripts/sequencer-render-training/generate-intent-gap-report.py \
  --summary /tmp/singlestrand-cane-packed-fseq-decoded-debug/intent-summary.json \
  --out-file /tmp/singlestrand-cane-packed-fseq-decoded-debug/intent-gap-report.json
```

```bash
python3 scripts/sequencer-render-training/generate-range-transition-report.py \
  --run-dir /tmp/shimmer-outline-dutyfactor-range-v1 \
  --param dutyFactor \
  --out-file /tmp/shimmer-outline-dutyfactor-range-v1/range-transition.json
```

Notes:
- seed coverage targets are not a closed taxonomy
- extra discovered tags and families are preserved so the catalog can expand beyond the initial predefined look list

Environment:
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
  - default: `/Users/robterry/Desktop/Show/RenderTraining`
  - internal workspace for packed `.fseq`, working `.xsq`, copied manifests, and derived artifacts
- `PHASE_SET`
  - used by `run-overnight-approved-matrix.sh`
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
- Packed batch runs now normalize manifests through `training-standards.json` before execution:
  - structural palette defaults to `RGB`
  - structural-test brightness defaults to `100%`
  - packed decode frame emission defaults to `auto`
  - effect-semantic brightness exceptions remain explicit in the manifest/effect settings layer
- Model-family reasoning should come from xLights model metadata and audited structural settings:
  - use raw xLights `DisplayAs` as the base family source
  - use the generated geometry audit to capture structure-changing settings such as spirals, layers, grouping, orientation, and density
  - do not rely on user model names as semantic input
- Parameter sampling should come from the effect parameter registry where possible:
  - registry anchors define first-pass sweeps
  - registry metadata defines expected importance, interaction hypotheses, and stop rules
- Intent mapping should only be built on structurally mature effects and geometry profiles:
  - use the consolidated priority-effect summary as the input
  - do not over-promote weak or style-level semantics before the analyzer layer supports them
  - query helpers over the intent map should be treated as constrained structural retrieval, not freeform designer-language understanding
  - effect selection over the intent map should route only among supported mature effects, not imply global effect coverage
  - the current supported selector set is:
    - `Bars`
    - `Marquee`
    - `Pinwheel`
    - `Spirals`
- Registry planning should be geometry-profile-aware:
  - choose a stable base manifest per geometry profile
  - generate first-order sweeps from registered parameters
  - replace duplicated hand-authored range manifests over time
- Each sample now runs against a temporary working copy of the source sequence so repeated harness runs do not accumulate effects into the same `.xsq`.
- Packed batch mode now performs:
  - `openSequence`
  - `addEffect`
  - `saveSequence`
  - `closeSequence`
  - `batchRender`
  - `.fseq` capture
- The default operating mode is now a persistent xLights session.
- Automatic restarts are not part of the normal harness flow anymore.
- Restart flags remain available only as manual recovery tools.
- Each successful sample also records basic artifact features:
  - file size
  - MIME type
  - SHA-256
  - pixel width / height when available
- GIF artifacts still record richer derived features when extraction succeeds:
  - frame count
  - total duration
  - average frame delay
  - first-frame unique color count
  - first-frame brightness and active-pixel ratios
  - sampled representative-frame metrics chosen from multiple points across the export
  - note: current xLights exports can include pre-roll, so representative-frame sampling is more useful than first-frame metrics, but it is still a sampled approximation rather than full motion scoring
- Each successful sample also records first-pass heuristic observations:
  - derived labels
  - readability/restraint/pattern clarity/prop suitability
  - usefulness baseline score
- Pairwise comparison helper:
  - turns two observation payloads into a preference record for one scoring criterion
  - intended for early ranking before we have a stronger learned comparison layer
- Batch runs write:
  - one subdirectory per sample
  - `run.log`
  - `run-summary.json`
- `run-model-batch.sh` is the preferred execution mode for a single-model manifest:
  - one already-open healthy xLights session
  - one temporary sequence copy per sample
  - no automatic restart on sample failure
- `run-packed-model-batch.sh` is now the preferred scaling path:
  - one working sequence per batch
  - many sample windows added into that one open sequence
  - one packed `.fseq` artifact per batch
  - per-sample records keyed to assigned time windows inside that `.fseq`
  - each record now includes:
    - decoded `.fseq` summary features
    - compact per-frame node state when the frame-cell budget allows it
    - geometry-family analysis output
  - per-frame decode remains the next interpretation upgrade
- Current duration guidance:
  - static effects like `On`: short windows are fine
- animated effects like `SingleStrand`: use the 4-second standard by default
- animated effects like `SingleStrand`, `Shimmer`, and `Color Wash`: use the 4-second standard by default
- Current explicit fixture classes:
  - outline via `Border-01`
  - single-line / roofline via `UpperGutter-01`
  - tree flat via `HiddenTree`
  - tree 360 via `SpiralTree-01`
  - star via `HiddenTreeStar`
  - cane via `CandyCane-01`
  - matrix via `NorthPoleMatrix`
- The current show fixture does not contain a true arch model, so arch-class coverage remains a known gap until a dedicated arch fixture is added.
- Preferred training fixture shape:
  - animation-only
  - short duration
  - no media file
  - no timing display rows
  - no pre-existing effects
