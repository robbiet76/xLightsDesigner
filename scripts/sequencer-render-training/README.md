# Sequencer Render Training

Internal-only tooling for xLights-backed render sweeps used to train sequencer realization behavior.

This tooling does **not** replace xLights rendering.
It drives xLights as the authoritative renderer, captures the exported result, and writes a structured training record.

## First Slice

The current harness is intentionally small:
- one manifest file
- one sample at a time
- first-class support for `On` and reduced `SingleStrand`
- xLights export path:
  - `openSequence`
  - `addEffect`
  - `renderAll`
  - `exportModelWithRender`
  - `closeSequence`

## Files

- `run-sample.sh`: execute one sample from a sweep manifest
- `run-manifest.sh`: execute all samples from a sweep manifest
- `extract-artifact-features.sh`: capture basic artifact facts for the training record
- `extract-observations.sh`: derive first-pass labels and baseline scores from sample context and artifact geometry
- `lib.sh`: shared xLights automation helpers
- `manifests/on-sample-v1.json`: example manifest
- `manifests/on-reduced-sweep-v1.json`: reduced `On` sweep
- `manifests/on-matrix-reduced-sweep-v1.json`: reduced `On` sweep on a concrete matrix model
- `manifests/singlestrand-reduced-sweep-v1.json`: reduced `SingleStrand` sweep
- `manifests/singlestrand-linear-reduced-sweep-v1.json`: reduced `SingleStrand` sweep on a concrete linear model

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

Environment:
- `XLIGHTS_BASE_URL`
  - default: `http://127.0.0.1:49914`
- `CURL_MAX_TIME`
  - default: `60`

## Notes

- This is an internal harness, not product runtime.
- xLights export currently needs a concrete model, not a `ModelGroup`.
- The harness stages artifacts under the sequence directory so the xLights app can write them, then copies them to the requested output directory.
- The runner fails if xLights reports export success but the staged artifact does not exist.
- Each successful sample also records basic artifact features:
  - file size
  - MIME type
  - SHA-256
  - pixel width / height when available
- Each successful sample also records first-pass heuristic observations:
  - derived labels
  - readability/restraint/pattern clarity/prop suitability
  - usefulness baseline score
- Batch runs write:
  - one subdirectory per sample
  - `run.log`
  - `run-summary.json`
- Current explicit fixture classes:
  - outline via `Border-01`
  - cane via `CandyCane-01`
  - single-line / roofline via `UpperGutter-01`
  - matrix via `NorthPoleMatrix`
- The current show fixture does not contain a true arch model, so arch-class coverage remains a known gap until a dedicated arch fixture is added.
