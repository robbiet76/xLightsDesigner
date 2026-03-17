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

- total cases: `28`
- supported by current offline runner: `28`
- passed: `28`
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
- stage-lighting quality: `3.00`
- composition quality: `3.00`
- settings/render plausibility: `3.00`
- concept-summary quality: `3.00`
- target-selection quality: `3.00`

Interpretation:
- the current offline heuristic layer is fully green on the canonical corpus
- broad artistic direction, reviewability, and target discipline are now stable enough to stop being the immediate training bottleneck
- the next bottlenecks move deeper into:
  - per-effect settings/render nuance
  - exact timing-window quality beyond section anchors
  - live validation cadence against real sequence output

## What Changed Since The First Baseline

The runner and designer logic now cover:
- layout/depth-sensitive concepts
- stage-lighting-language concepts
- richer broad-pass family diversity for rhythm/layout/lighting prompts
- offline revise-case scoring through the same merge semantics used by the app revision path
- beat-, chord-, and phrase-anchored concept cases with cue-window placements

## Current Meaning Of A Pass

The current offline pass means:
- concept identity holds
- revise cases preserve the concept set and increment the intended revision
- unrelated concepts remain unchanged during revise merges
- concept summaries stay on the design side of the boundary
- whole-pass prompts produce enough placements and family diversity for the current structural gate
- beat/chord/phrase-sensitive prompts can now produce explicit cue-window placement timing instead of collapsing to section spans

It does **not** yet mean:
- motion language is artistically strong
- lighting/composition reasoning is artistically strong in every case
- settings/render choices are fully tuned
- live applied whole-sequence output is artistically complete

## Next Training Priorities

1. keep the current `25/25` corpus as the structural regression gate
2. keep the current artistic baseline fixed while training against:
   - per-effect settings/render nuance
   - exact timing-window quality and music-driven sub-section placement
   - live validation slices against real sequence output
3. promote only changes that improve the artistic layer without regressing structural results
