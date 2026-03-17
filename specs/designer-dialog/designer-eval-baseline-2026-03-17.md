# Designer Eval Baseline

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: capture the first offline baseline against the canonical designer eval corpus so later training slices can be compared against a fixed starting point.

## Runner

- corpus: [designer-eval-cases-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/designer-eval-cases-v1.json)
- runner: [run-designer-eval.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/run-designer-eval.mjs)
- metadata fixture: [synthetic-metadata-fixture-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/synthetic-metadata-fixture-v1.json)

Command:

```bash
node apps/xlightsdesigner-ui/eval/run-designer-eval.mjs > /tmp/designer-eval-report.json
```

## Current Baseline Summary

- total cases: `25`
- supported by current offline runner: `25`
- passed: `25`
- failed: `0`
- deferred: `0`
- average structural score: `3`

Interpretation:
- the canonical offline corpus is now fully supported
- concept, whole-sequence, preference, and revise cases all pass the current structural gate
- the current bottleneck is no longer structural correctness
- the next bottleneck is richer artistic scoring and deeper quality tuning

## Current Artistic Baseline

Current artistic averages from the same corpus:
- motion language: `3.00`
- stage-lighting quality: `2.86`
- composition quality: `3.00`
- settings/render plausibility: `3.00`

Interpretation:
- motion language is now strong enough on the current offline corpus to stop being the main training bottleneck
- composition and settings/render plausibility are stable on the current heuristic layer
- stage-lighting reasoning remains the softest artistic category, especially on broad cinematic whole-pass prompts

## What Changed Since The First Baseline

The runner and designer logic now cover:
- layout/depth-sensitive concepts
- stage-lighting-language concepts
- richer broad-pass family diversity for rhythm/layout/lighting prompts
- offline revise-case scoring through the same merge semantics used by the app revision path

## Current Meaning Of A Pass

The current offline pass means:
- concept identity holds
- revise cases preserve the concept set and increment the intended revision
- unrelated concepts remain unchanged during revise merges
- concept summaries stay on the design side of the boundary
- whole-pass prompts produce enough placements and family diversity for the current structural gate

It does **not** yet mean:
- motion language is artistically strong
- lighting/composition reasoning is artistically strong in every case
- settings/render choices are fully tuned
- live applied whole-sequence output is artistically complete

## Next Training Priorities

1. keep the current `25/25` corpus as the structural regression gate
2. keep the current artistic baseline fixed while training against:
   - stage-lighting quality on broad cinematic passes
   - concept-summary quality
   - target-group selection quality
   - per-effect settings/render nuance
3. promote only changes that improve the artistic layer without regressing structural results
