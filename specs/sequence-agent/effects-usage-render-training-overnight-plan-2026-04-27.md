# Effects Usage Render Training Overnight Plan

Status: Active  
Date: 2026-04-27  
Owner: xLightsDesigner Team  

## Source Prompt

> Proceed. Let's build the framework on the assumption that we are going to improve effects usage/render training and not use heuristics to try to fake a better score. I wan't to plan this as a separate overnight training routine once we are able to determine what is needed.

## Purpose

Build an evidence-driven overnight training framework for improving how the sequencer applies effects. The goal is not to adjust scoring weights or add selector shortcuts that make a benchmark look better. The goal is to produce better render-backed knowledge about effect settings, geometry, palette behavior, timing shape, layering, and visual outcome so the sequencer can make stronger design decisions.

This plan is a current-state implementation checklist, not a product phase name.

## Problem Statement

The current full-sequence pipeline can generate and apply a complete sequence, but the output still reads as weak from a taste and intent standpoint. Coverage is not the main failure. The limiting factor is that the sequencer does not yet have enough evidence-backed understanding of how specific effect settings change observed behavior on different model geometries and in different composition contexts.

The current quality metrics are useful as diagnostic signals only. They must not become the target. A stronger score should happen because the underlying behavior capability records, parameter priors, shared-setting priors, and render observations improve.

## Inputs

- Full-sequence benchmark reports under `var/benchmarks/full-sequence-creation/`.
- Effect usage quality diagnostics from `practical-sequence-validation.js`.
- xLights render observations and screening records under `scripts/sequencer-render-training/catalog/`.
- Effect parameter registry and imported xLights effect metadata.
- Behavior capability records and generated selector bundles.
- Canonical render-training display geometry profiles and standard xLights model fixtures.
- Optional production sequence summaries from `/Users/robterry/Documents/Lights/Current` as reference examples only.

## Training Display Scope

The overnight routine should use the canonical render-training display, not the user's personal production display.

Default training display:

- show folder: `/Users/robterry/Projects/xLightsDesigner/render-training`
- fixture sequence: `/Users/robterry/Projects/xLightsDesigner/render-training/RenderTraining-AnimationFixture.xsq`
- layout catalog: `scripts/sequencer-render-training/catalog/generic-layout-model-catalog.json`
- geometry audit: `scripts/sequencer-render-training/catalog/generic-layout-geometry-audit.json`

The training display contains canonical model families for effect learning rather than personal layout-specific props. Current in-scope geometry families are:

- single-line horizontal, vertical, and single-node controls
- arch single, arch grouped, and arch multi-layer
- flat tree, round tree, and spiral tree
- star single-layer and multi-layer
- icicles
- spinner
- cane single, grouped, and stick-grouped
- matrix low, medium, and high density

Older manifests that point at `/Users/robterry/Desktop/Show/Test/RenderTraining/...` are legacy/dev-show fixtures. They are excluded by the overnight planner by default. They can be included only with an explicit migration/debug override and should not be used for the normal unattended routine.

The production reference folder `/Users/robterry/Documents/Lights/Current` is out of scope for overnight render sweeps. It may be used only for read-only reference summaries and human sequence pattern analysis.

## Palette Protocol

Training sweeps should use the same palette protocol as prior render training:

- `mono_white`: default palette loaded, active slot `[1]`
- `rgb_primary`: default palette loaded, active slots `[2, 3, 4]`

These are representative training modes, not final design palettes. `mono_white` represents any single active color because the behavior question is "one selected palette slot" rather than "white specifically." `rgb_primary` represents a generic multicolor palette because the behavior question is "multiple active palette slots with ordered color alternation" rather than red/green/blue specifically.

Default palette:

- `C_BUTTON_Palette1`: `#FFFFFF`
- `C_BUTTON_Palette2`: `#FF0000`
- `C_BUTTON_Palette3`: `#00FF00`
- `C_BUTTON_Palette4`: `#0000FF`
- `C_BUTTON_Palette5`: `#FFFF00`
- `C_BUTTON_Palette6`: `#000000`

The runner expands each selected sample into both palette profiles by default through `TRAINING_PALETTE_PROTOCOL=mono_white,rgb_primary`. This keeps the new overnight routine comparable with existing `mono_white` and `rgb_primary` records.

The expanded xLights effect payload must include both the palette color values and the active slot checkboxes. `C_BUTTON_Palette*` fields load the default colors, while `C_CHECKBOX_Palette1..8` marks which colors are selected for that sample. A palette profile is not valid if the colors are loaded but no slots are active.

## Non-Goals

- Do not tune scoring weights to make the same weak output look better.
- Do not hardcode development show paths into app logic.
- Do not store app metadata in xLights show folders.
- Do not train on production sequences as target outputs or copy their sequencing.
- Do not run unattended training sweeps against the user's active production display.
- Do not use project display metadata in effect-training runs. Display metadata is a separate learning layer for user intent and project-specific target meaning; effect training uses standard xLights model fixtures and render-derived behavior only.
- Do not typecast effects into fixed roles. The training should describe how settings alter behavior, not declare that an effect can only serve one purpose.
- Do not create a parallel selector system outside the existing behavior capability and parameter-prior path.

## Generalized Effect Behavior Learning

The training system should not attempt to render every effect/settings/color combination. The useful output is a sparse behavior model that lets the sequencer reason between observed anchors.

Each derived parameter prior should preserve the raw anchor evidence and also emit a generalized behavior-dimension summary:

- `motion`: whether the parameter increases, decreases, or does not materially change temporal motion.
- `colorRhythm`: whether the parameter changes temporal color variation.
- `brightnessRhythm`: whether the parameter changes temporal brightness variation.
- `coverage`: whether the parameter changes the amount of visible model coverage.
- `colorDiversity`: whether the parameter changes how many active palette colors are visible in the render.
- `dominantColorStability`: whether the parameter holds one dominant color steady or changes the dominant color across frames.
- `colorBandDensity`: whether the parameter creates more or fewer adjacent color transitions across the model.
- `gradientSmoothness`: whether the parameter produces smoother blended color transitions or harder color boundaries.
- `colorTravel`: whether the rendered RGB values move/change across nodes over time.

RGB representative training must read actual rendered RGB node values from sampled frames where available. `rgb_primary` exists because red, green, and blue are easy to distinguish in measured frame data; the learning should be generalized to "multi-color palette behavior" rather than treated as literal red/green/blue design guidance. Color-related behavior should come from the selected palette slots and rendered node values, not from a post-hoc image/color scraping algorithm.

Rendered color classification should normalize visible RGB values by hue/chroma rather than exact channel intensity. A dim red and a full red are the same active color class for palette-distribution learning; black or near-black nodes are inactive. `mono_white` remains the representative single-color mode and should not emit palette-distribution dimensions such as `colorDiversity`, `dominantColorStability`, `colorBandDensity`, or `gradientSmoothness`. Single-color samples may still contribute motion, coverage, brightness rhythm, and other non-distribution behavior.

The generated behavior model must state that exact combinations are not required when evidence supports interpolation between observed anchors. Extrapolation outside observed ranges remains low confidence. Interaction samples may contribute low-confidence per-parameter trends by using the effect setting keys present in each sample, even when the manifest was not a single-parameter sweep.

Before a long overnight run is worth promoting, the validation summary should report how many records produced non-empty behavior rules versus how many only produced flat or inconclusive dimensions.

The behavior-dimension builder must normalize current FSEQ decoder metrics as well as older screening metric names. Current packed FSEQ records may expose motion and coverage through fields such as `temporalChangeMean`, `centroidMotionMean`, `averageActiveNodeRatio`, and `analysis.qualitySignals`; these must feed the canonical behavior dimensions instead of being treated as zero. When sampled frames include `nodeRgb` values, the builder must derive color-specific metrics directly from the rendered RGB data so multicolor samples do not collapse into flat/inconclusive results.

Focused behavior-anchor manifests are preferred over broad interaction manifests when the goal is generalized learning. Anchor packs should vary one parameter at a time across a small low/medium/high or off/on set, then run through both representative palette classes. Broad interaction packs remain useful, but they are weaker evidence for explaining how one setting changes behavior.
- Do not introduce arbitrary palette profiles into the default overnight run.

Before adding or promoting new focused anchors, run the sampling audit:

```bash
node scripts/sequencer-render-training/tooling/build-effect-sampling-audit.mjs
```

The audit separates current-effect closure from new-effect expansion. It must distinguish:

- `causal_ready`: focused one-parameter anchors have enough behavior evidence.
- `needs_causal_anchor_confirmation`: interaction evidence exists, but a one-parameter anchor sweep is still needed.
- `interaction_only`: records exist, but they are not strong enough to attribute behavior to one setting.
- `under_sampled` / `needs_anchor_completion`: focused anchors exist but do not cover enough expected values.
- `needs_range_repair`: sampled values produce too many blank/dead renders and should be repaired before promotion.
- `missing`: registry settings have no useful render-backed sampling yet.

New focused manifests should be validated as non-promotion runs before they are allowed into an overnight promotion path. A passing xLights batch is not enough when the learning gate reports high blank share or no generalized rules for a representative palette mode.

## Training Need Selection

Each overnight run starts by reading the latest benchmark and converting low-level diagnostics into training needs:

- Weak configuration richness means prioritize effects with thin setting coverage, missing parameter priors, or generic default use.
- Weak section contrast means prioritize effect-setting combinations that produce visibly different density, motion, direction, scale, brightness, and palette reads.
- Weak generic effect control means reduce dependence on bare `On` or unconfigured effects by training alternatives with evidence-backed settings.
- Repeated exact configurations mean prioritize parameter ranges and interactions for the repeated effect families.
- Missing behavior coverage means prioritize effect/geometry pairs where the selector cannot retrieve a usable behavior capability record.
- Weak render coverage means prioritize effect/geometry combinations that produce observable broad display usage instead of sequence-file-only coverage.
- Weak spatial balance means prioritize training on how effects read across left/right, top/bottom, and large display regions.
- Weak composition-region evidence means train settings and geometry pairings that make focal, support, accent, background, and texture roles visible in the render.

These needs choose which render sweeps to run. They do not directly change the quality score.

The planner must evaluate both sequence-file effect usage diagnostics and render-quality diagnostics. A strong effect-usage score is not sufficient if the rendered output still has sparse coverage, spatial imbalance, or underused composition regions.

## Overnight Routine

1. Create a run directory under `var/logs/sequencer-effects-usage-training-runs/<run-id>/`.
2. Read the latest benchmark report, current effect training automation plan, settings coverage report, and available manifests.
3. Filter manifests to the canonical render-training display unless explicitly overridden.
4. Write a `training-plan.json` that lists the diagnostic gaps, selected training needs, selected manifests, training display, excluded legacy fixtures, and promotion requirements.
5. Run approved xLights render sweeps for selected manifests when `--execute` is supplied.
6. Harvest render outputs into screening records and supporting reports.
7. Rebuild the unified training set, settings coverage report, behavior capability records, derived parameter priors, and shared-setting priors in a staging area.
8. Evaluate retrieval and selector-facing behavior against fixed cases and current benchmark gaps.
9. Promote generated bundles only when `--promote` is supplied and acceptance gates pass. Promotion must stage the passing run's new screening records, rebuild `scripts/sequencer-render-training/catalog/effect-screening-record-packs/`, and then rebuild repo-facing catalogs and generated bundles from the durable catalog.
10. Write a summary that includes the benchmark input, raw run artifacts, generated record counts, changed bundle sources, eval results, and remaining gaps.

## Promotion Rules

Promotion is allowed only when the run can show evidence improvement:

- More useful behavior capability records for prioritized effect/geometry/setting combinations.
- Better parameter-prior coverage for settings that visibly change output.
- Better shared-setting and palette behavior evidence.
- No regression in existing unit tests.
- A fresh full-sequence benchmark improves the relevant diagnostic subcomponents without hiding failures through scoring changes.

## Acceptance Gates

- `bash -n scripts/sequencer-render-training/runners/run-effects-usage-overnight-training.sh`
- focused tests for any changed sequencer modules
- behavior capability bundle export succeeds
- derived parameter prior bundle export succeeds
- full-sequence benchmark report includes `metrics.effectUsageQuality`
- full-sequence benchmark report includes render-quality dimensions used for training need selection
- final run summary identifies remaining gaps by diagnostic dimension

## Open Questions

- Which effect families should be prioritized first after the initial diagnostic-driven run?
- Should the first overnight run use only generated sweeps, or also compare against curated human reference windows?
- What minimum evidence count is required before a behavior capability record is selector-ready?
- What thresholds should block promotion for collapsed or visually indistinct sweeps?
- How much runtime should the first unattended pass target?
