# Render Training Parameter Registry Spec

Status: Draft  
Date: 2026-03-19  
Owner: xLightsDesigner Team

System roadmap reference:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

Primary implementation artifacts:
- [effect-parameter-registry.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/effect-parameter-registry.json)
- [generate-parameter-sweep-manifest.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generators/generate-parameter-sweep-manifest.py)

## Purpose

The parameter registry exists to move render-training sampling away from ad hoc manifest authoring.

It is part of the long-lived test-design framework for the render-training system, not just a one-time sweep generator.

It records, per effect:
- effect complexity
- early sampling policy
- which parameters exist
- which ones matter most
- which anchors should be sampled first
- when a parameter applies
- what interactions are worth testing later
- when to stop sampling

## Required Registry Fields

For each effect:
- `complexityClass`
- `earlySamplingPolicy`

For each parameter:
- `type`
- `anchors`
- `importance`
- `phase`
- `stopRule`

Optional:
- `benchmarkGeometryFamilies`
- `benchmarkRole`
- `range`
- `appliesWhen`
- `interactionHypotheses`

## Complexity Policy

Effects should not all follow the same early-testing rules.

Allowed `complexityClass` values:
- `simple`
- `moderate`
- `complex`

Allowed `earlySamplingPolicy` values:
- `baseline_only`
- `standard_screening`
- `broad_geometry_first`

Meaning:
- `simple`
  - smaller parameter surface
  - lower geometry coupling
  - early first-pass impact judgments are lower risk
- `moderate`
  - normal screening is acceptable
  - geometry expansion still matters, but first-pass summaries are generally useful
- `complex`
  - do not draw broad conclusions from one narrow sweep
  - prioritize broader geometry coverage earlier
  - treat early flat results as local/contextual by default
  - require stronger evidence before maturity promotion or deprioritizing a control

`broad_geometry_first` means:
1. cover the main intended geometry families early
2. test more first-order parameters before calling a setting flat
3. default more early results into:
   - `under_sampled`
   - `interaction_suspected`
   - `context_flat_observed`
4. delay strong pruning claims until multi-geometry evidence exists

Current complex-effect examples:
- `Bars`
- `Marquee`
- `Spirals`
- `Pinwheel`
- later:
  - `Shockwave`
  - `Twinkle`

`Spirals` should be treated as a benchmark tree effect in Stage 1.
`Bars` should now also be treated as a complex Stage 1 effect because its multi-geometry evidence shows broader coupling and interaction risk than a moderate classification suggests.

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
python3 scripts/sequencer-render-training/generators/generate-parameter-sweep-manifest.py \
  --registry scripts/sequencer-render-training/catalog/effect-parameter-registry.json \
  --base-manifest scripts/sequencer-render-training/manifests/singlestrand-singlelinehorizontal-expanded-sweep-v1.json \
  --parameter numberChases \
  --out-file /tmp/singlestrand-numberchases.generated.json
```

## Next Implementation Step

The next code slice after this registry is:
- consume registry metadata in overnight planning
- generate sweep families from registry anchors instead of maintaining large duplicated hand-authored range manifests
- use `complexityClass` and `earlySamplingPolicy` in planning heuristics and promotion rules
