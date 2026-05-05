# Sequencing Quality Curriculum

Status: Active
Owner: xLightsDesigner Team

## Purpose

Define the goal map for automated sequencer training. The controller should not
freely explore without direction; it should work through a curriculum, checkpoint
results, promote durable evidence, and choose the next loop from known gaps.

Machine-readable curriculum:

- `../../scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json`

## Training Principle

The automation loop is self-improving inside curriculum boundaries. It may choose
the next best pass from prior results, but the goals, promotion criteria, and
coverage expectations are explicit.

Each loop should:

1. Read curriculum goals and controller state.
2. Select a bounded batch from the highest-value incomplete goals.
3. Execute apply/render/review passes against xLights.
4. Build compact quality trend, quality records, priors, promoted priors, and
   promotion gate artifacts.
5. Update goal status and controller checkpoint state.
6. Delete summarized intermediate media and temporary sequence files.
7. Queue the next loop from blocked-promising records, regressions, or coverage
   gaps.

## Curriculum Areas

- Core render validity: prove effects render, produce visible output, and expose
  useful setting regions.
- Effect behavior: learn motion, fill, texture, directionality, density, color
  handling, model fit, and parameter impact.
- Model and geometry fit: learn effect behavior across built-in, imported, and
  custom model structures.
- Layer composition: learn same-target stacks, group/member interaction, layer
  order, blends, brightness/contrast/fade, and overlap.
- Submodel behavior: learn parent versus submodel targeting and sibling submodel
  behavior through the shared submodel framework.
- Display-level composition: learn coverage, balance, foreground/background
  separation, regional variety, and whole-display readability.
- Musical structure: learn section energy, phrase/beat alignment, lyric/accent
  timing, and repetition with variation.
- Creative intent matching: learn whether generated sequences match mood,
  palette, pace, emphasis, style, and negative space.
- Creative revision comparison: learn whether a targeted before/after revision
  actually improves the requested intent without reducing readability or adding
  clutter.

## Initial Goal Order

1. Finish `layer.same_target.mono_white.basic`.
   The latest run produced high-quality single-run same-target stack variants.
   The next loop should repeat these blocked-promising records so they can
   promote or be rejected.

2. Start `layer.rgb_primary.basic`.
   Mono-white layer composition now has initial promoted evidence. RGB-primary
   repeats are needed before the runtime can generalize color behavior.

3. Start `submodel.vendor_fixture.basic`.
   Submodels are first-class targets for every model type, with special urgency
   for custom props. This goal must use `display/model-index.json` and
   `display/target-behavior.json`, not hard-coded name inference.

4. Expand `effect_fit.core_effects.v1`.
   Keep the first effect set small and useful: `On`, `Single Strand`, `Bars`,
   `Color Wash`, `Marquee`, `Pinwheel`, `Morph`, `Fire`, and `Butterfly`.

5. Expand `effect_fit.expanded_model_matrix.v1`.
   After the core effect-fit baseline is covered, broaden RGB-primary
   effect/model evidence across the model families currently available in the
   vendor training fixture: single line, arch, tree, star, and spinner. This
   goal intentionally stays fixture-runnable and excludes static `On` from
   quality promotion because live evidence showed it is better treated as a
   render-health control. Matrix, cane, and tree-360 coverage should be added
   when those models are present in the active training layout.

6. Move into display-level and music-aware review only after the effect,
   geometry, layer, and submodel foundations are stable enough to generate
   meaningful full-display candidates.

7. Add `creative.intent_revision_comparison.v1` after baseline creative intent
   evidence exists. This goal uses paired passes: an `intent_first_draft`
   baseline and an `intent_targeted_revision` pass linked by
   `comparisonBasePassId`. The comparison artifact scores overall quality,
   intent match, readability, motion coherence, and clutter-control deltas.

## Controller State

The controller writes a durable state artifact after every loop. The current
implementation is planning-only: it reads the curriculum, compact quality
records, promoted priors, pass summary, and cleanup result, then chooses the next
bounded queue without launching xLights.

```json
{
  "artifactType": "sequencing_quality_training_controller_state_v1",
  "curriculumId": "sequencing-quality-v1",
  "loopIndex": 12,
  "latestRunRoot": "var/logs/sequencer-training-controller/loop-000012",
  "goalStatuses": [],
  "coverageSummary": {},
  "promotionSummary": {},
  "cleanupSummary": {},
  "nextQueue": []
}
```

The state should be compact and portable. Raw frames, full videos, generated
sequence copies, and decoded media should remain local run artifacts and be
deleted after summarization unless explicitly retained as proof evidence.

Current entry point:

```bash
node scripts/sequencer-render-training/tooling/run-sequencing-quality-controller.mjs \
  --latest-run-root /tmp/xld-layer-composition-quality-long-20260504T182838Z \
  --out /tmp/xld-layer-composition-quality-long-20260504T182838Z/controller-state.json
```

The layer-composition plan builder can consume that checkpoint through
`--controller-state`. It filters the full generated manifest to the controller's
`nextQueue` and keeps required dependency passes such as `empty_baseline` and
comparison bases so deltas remain meaningful.

The first loop runner is scaffold-first:

```bash
node scripts/sequencer-render-training/tooling/run-sequencing-quality-loop.mjs \
  --latest-run-root /tmp/xld-layer-composition-quality-long-20260504T182838Z \
  --loop-root /tmp/xld-quality-controller-loop-000001
```

This writes `controller-state.json`, `training-plan.json`,
`execution-scaffold-result.json`, `checkpoints.json`, `retention-ledger.json`,
`video-aesthetic-score.json`, and `loop-summary.json`. Live rendering is opt-in through `--apply-render`.
When creative revision pairs are present, the live loop also writes
`creative-intent-revision-comparison.json`; this is the compact evidence used to
review whether the revision was beneficial rather than simply different.
The video aesthetic artifact is the compact whole-display score for ordered
render windows and is the bridge from section-level render success toward
sequence-level quality improvement.

After a coverage path has been proven with small live runs, use the unattended
runner:

```bash
node scripts/sequencer-render-training/tooling/run-sequencing-quality-unattended.mjs \
  --latest-run-root /tmp/xld-quality-controller-loop-live-music-000002 \
  --previous-state /tmp/xld-quality-controller-after-music-000002.json \
  --model-catalog /tmp/xld-vendor-fixture-model-catalog.json \
  --max-loops 20 \
  --max-passes 5
```

The unattended runner writes `unattended-run-summary.json` after every iteration
and advances from one loop root to the next only after an executed loop. It
stops on `controller_idle`, `awaiting_evidence`, `blocked_no_controller_queue`,
or `max_loops_reached`. When it stops on idle, the next curriculum expansion
should be chosen deliberately. After expanded effect/model coverage is covered,
the next preferred expansions are stronger video-level aesthetic scoring, richer
creative revision variants, and matrix/cane/tree-360 coverage when those model
families are available in the active training layout.

## Selection Rules

The controller should prefer:

- blocked records with high quality and only `single_run_baseline` blockers
- stable records that need one more sample to promote
- regressing records that need confirmation
- curriculum goals with no RGB evidence
- model/effect/palette combinations missing required stable samples
- periodic revalidation of promoted priors only after broader coverage is moving

The controller should skip:

- exact learning keys already selector-ready unless revalidation is due
- low-quality or repeatedly rejected paths unless a curriculum goal explicitly
  requires investigation
- paths that cannot be cleaned up within disk guardrails
- submodel choices derived only from names rather than structure or metadata

## Current Baseline

Latest compact baseline:

- run root: `/tmp/xld-layer-composition-quality-long-20260504T182838Z`
- 16 render reviews
- 14 eligible quality-evidence passes
- 14 accepted quality-evidence passes
- cross-run trend: stable
- durable candidates: 6
- promoted selector-ready priors: 6

Promoted coverage currently includes mono-white group/model interplay and the
first same-target one/two-layer stack cases. Eight additional same-target stack
variants are promising but blocked until repeated.
