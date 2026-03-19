# Render Training Parameter Registry Spec

Status: Draft  
Date: 2026-03-19  
Owner: xLightsDesigner Team

System roadmap reference:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

Primary implementation artifacts:
- [effect-parameter-registry.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/effect-parameter-registry.json)
- [generate-parameter-sweep-manifest.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generate-parameter-sweep-manifest.py)

## Purpose

The parameter registry exists to move render-training sampling away from ad hoc manifest authoring.

It is part of the long-lived test-design framework for the render-training system, not just a one-time sweep generator.

It records, per effect:
- which parameters exist
- which ones matter most
- which anchors should be sampled first
- when a parameter applies
- what interactions are worth testing later
- when to stop sampling

## Required Registry Fields

For each parameter:
- `type`
- `anchors`
- `importance`
- `phase`
- `stopRule`

Optional:
- `range`
- `appliesWhen`
- `interactionHypotheses`

## Current Covered Effects

- `On`
- `SingleStrand`
- `Shimmer`
- `Color Wash`

## Immediate Usage

1. choose a base manifest for an effect + geometry profile
2. choose a registered parameter
3. generate a registry-driven sweep manifest
4. run it through the normal packed `.fseq` training flow

This does not replace all hand-authored manifests immediately.

It becomes the standard path for:
- numeric range sweeps
- boolean sweeps
- enum sweeps

## Example

```bash
python3 scripts/sequencer-render-training/generate-parameter-sweep-manifest.py \
  --registry scripts/sequencer-render-training/effect-parameter-registry.json \
  --base-manifest scripts/sequencer-render-training/manifests/singlestrand-singlelinehorizontal-expanded-sweep-v1.json \
  --parameter numberChases \
  --out-file /tmp/singlestrand-numberchases.generated.json
```

## Next Implementation Step

The next code slice after this registry is:
- consume registry metadata in overnight planning
- generate sweep families from registry anchors instead of maintaining large duplicated hand-authored range manifests
