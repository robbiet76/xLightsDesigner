# Designer Eval Baseline

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: capture the first offline baseline against the canonical designer eval corpus so later training slices can be compared against a fixed starting point.

## Runner

- corpus: [designer-eval-cases-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/designer-eval-cases-v1.json)
- runner: [run-designer-eval.mjs](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/run-designer-eval.mjs)
- metadata fixture: [synthetic-metadata-fixture-v1.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/synthetic-metadata-fixture-v1.json)
- fixture variants covered by the current baseline:
  - `default`
  - `metadata_change_sensitivity`
  - `layout_swap_depth`
  - `bridge_peak_arc`
  - `extended_taxonomy_sections`

Command:

```bash
node apps/xlightsdesigner-ui/eval/run-designer-eval.mjs > /tmp/designer-eval-report.json
```

## Current Baseline Summary

- total cases: `48`
- supported by current offline runner: `48`
- passed: `48`
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
- thematic continuity: `3.00`

Interpretation:
- the current offline heuristic layer is fully green on the canonical corpus
- broad artistic direction, reviewability, and target discipline are now stable enough to stop being the immediate training bottleneck
- the next bottlenecks move deeper into:
  - per-effect settings/render nuance
  - exact timing-window quality beyond section anchors
  - live validation cadence against real sequence output
  - richer artistic taste and comparative quality, not basic rubric coverage

## What Changed Since The First Baseline

The runner and designer logic now cover:
- layout/depth-sensitive concepts
- fixture-shift validation where the same prompt must adapt across alternate layouts
- alternate song-arc validation where the bridge can intentionally outrank the final chorus
- layout-weighted impact awareness using node share plus spatial footprint
- stage-lighting-language concepts
- motion-language comparative quality
- richer broad-pass family diversity for rhythm/layout/lighting prompts
- offline revise-case scoring through the same merge semantics used by the app revision path
- concept-level delete/regenerate scoring where one concept is removed and a scoped replacement is appended without disturbing the rest of the draft
- beat-, chord-, and phrase-anchored concept cases with cue-window placements
- metadata-refinement sensitivity where changed tags produce changed target choices
- explicit `effectPlacements[]` as the primary authored output
- overlay-window shaping and same-target multi-effect layering checks
- extended section taxonomy normalization so non-core structure labels like `Pre-Chorus`, `Drop`, `Middle 8`, `Tag`, and `Rap Section` are preserved and classified when analysis provides them
- semantic section-scoped lift prompts that keep explicit `Pre-Chorus` scope and anchor to `XD: Phrase Cues`

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

## Live Validation Promotion Gate

Live validation status on the current promoted baseline:
- concept-only review validation: passed
- live comparative concept validation: passed
  - sequence: `API-Whole-Sequence-Validation-20260317-193350`
  - strong prompt preserved:
    - section scope: `Chorus 1`
    - targets: `Snowman`, `Star`
  - weak prompt drifted broader in live execution and scored lower
- live comparative suite on real saved sequences: passed
  - scenarios: `7/7`
  - `API-Whole-Sequence-Validation-20260317-193350.xsq`
  - `Validation-Clean-Phase1.xsq`
  - covered live comparative slices:
    - `whole-sequence-chorus-focus`
    - `clean-phase-chorus-focus`
    - `clean-phase-stage-lighting-pass`
    - `clean-phase-composition-pass`
    - `clean-phase-motion-language-pass`
    - `clean-phase-phrase-subtlety-pass`
    - `clean-phase-render-discipline-pass`
  - all scenarios preferred the stronger prompt over the flatter alternative
- alternate saved-sequence probe: passed
  - sequence: `API-Designer-WholePass-20260317-E.xsq`
  - slice: `wholepass-e-composition-pass`
  - status: validated individually and included in the extended live pack
- alternate live family probe: passed
  - sequence: `API-Designer-Diversity-Live-20260317-H.xsq`
  - slice: `diversity-h-composition-pass`
  - status: validated individually and included in the extended live pack
- extended live suite file: current definition is `9` scenarios
  - baseline pack plus:
    - `wholepass-e-composition-pass`
    - `diversity-h-composition-pass`
  - desktop automation timeout now scales with suite size so the extended pack can complete through the normal CLI path
  - desktop suite orchestration now reuses refresh/analyze setup per sequence context; the promoted `7/7` baseline pack completed in about `271s` on the optimized runner
  - current status: passed `9/9`
  - extended pack is now validated end to end and ready to use as the broader attended/unattended live regression sweep
- concept apply validation on selected concept: passed
  - `D1.0`
  - anchor: `Chorus 1`
  - targets: `Snowman`, `Star`
  - families: `Bars`, `Meteors`
- whole-sequence apply validation on fresh sequence: passed
  - sequence: `API-Whole-Sequence-Validation-20260317-193350`
  - applied owned batch plan steps: `49`
  - validated placements: `47/47`

Interpretation:
- the current promoted baseline is now green on both the offline corpus and the live apply cadence
- live comparative validation now exercises the direct designer path rather than the app-assistant routing layer
- live comparative validation is no longer tied to one saved sequence
- alternate saved-sequence coverage remains outside the lean promoted `7/7` baseline pack to preserve faster cadence
- alternate saved-sequence coverage is operationally stable in the validated `9/9` extended live pack
- stable improvements from the recent training slices are promoted into the baseline
- the next work should focus on deeper artistic tuning, not more framework churn

## Next Training Priorities

1. keep the current `48/48` corpus as the structural regression gate
2. keep the current artistic baseline fixed while training against:
   - per-effect settings/render nuance
   - exact timing-window quality and music-driven sub-section placement
   - live validation slices against real sequence output
   - richer impact-budget tuning using the new node/share metrics
3. promote only changes that improve the artistic layer without regressing structural results
