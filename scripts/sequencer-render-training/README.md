# Sequencer Render Training

Internal-only tooling for xLights-backed render sweeps used to train sequencer realization behavior.

This tooling does **not** replace xLights rendering.
It drives xLights as the authoritative renderer, captures the exported result, and writes a structured training record.

## First Slice

The current harness is intentionally small:
- one manifest file
- one sample at a time
- first-class support for `On`
- xLights export path:
  - `openSequence`
  - `addEffect`
  - `renderAll`
  - `exportModelWithRender`
  - `closeSequence`

## Files

- `run-sample.sh`: execute one sample from a sweep manifest
- `lib.sh`: shared xLights automation helpers
- `manifests/on-sample-v1.json`: example manifest

## Usage

```bash
bash scripts/sequencer-render-training/run-sample.sh \
  --manifest scripts/sequencer-render-training/manifests/on-sample-v1.json \
  --out-dir /tmp/sequencer-render-training
```

Environment:
- `XLIGHTS_BASE_URL`
  - default: `http://127.0.0.1:49914`
- `CURL_MAX_TIME`
  - default: `60`

## Notes

- This is an internal harness, not product runtime.
- The first version is intentionally narrow so we can prove the capture loop before broadening to:
  - `SingleStrand`
  - richer shared settings
  - wider sweep matrices
