# Sequencer Render Training

Internal-only tooling for xLights-backed render sweeps used to train sequencer realization behavior.

This tooling does **not** replace xLights rendering.
It drives xLights as the authoritative renderer, captures the render artifact, and writes a structured training record.

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
- `build-animation-fixture.py`: derive a short animation-only fixture sequence from an existing `.xsq`
- `extract-artifact-features.sh`: capture basic artifact facts for the training record
- `extract-observations.sh`: derive first-pass labels and baseline scores from sample context and artifact geometry
- `build-comparison.sh`: produce pairwise preference records from observation score outputs
- `lib.sh`: shared xLights automation helpers
- `manifests/on-sample-v1.json`: example manifest
- `manifests/on-reduced-sweep-v1.json`: reduced `On` sweep
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

## Notes

- This is an internal harness, not product runtime.
- xLights export currently needs a concrete model, not a `ModelGroup`.
- Packed batch runs now use the internal show-side workspace under `RenderTraining/`:
  - `working/` for temporary `.xsq`
  - `fseq/` for primary packed `.fseq`
  - `manifests/` for copied manifests
  - `derived/` reserved for future decode outputs
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
  - window decoding is the next step, not GIF slicing
- Current duration guidance:
  - static effects like `On`: short windows are fine
- animated effects like `SingleStrand`: use the 4-second standard by default
- animated effects like `SingleStrand`, `Shimmer`, and `Color Wash`: use the 4-second standard by default
- Current explicit fixture classes:
  - outline via `Border-01`
  - cane via `CandyCane-01`
  - single-line / roofline via `UpperGutter-01`
  - matrix via `NorthPoleMatrix`
- The current show fixture does not contain a true arch model, so arch-class coverage remains a known gap until a dedicated arch fixture is added.
- Preferred training fixture shape:
  - animation-only
  - short duration
  - no media file
  - no timing display rows
  - no pre-existing effects
