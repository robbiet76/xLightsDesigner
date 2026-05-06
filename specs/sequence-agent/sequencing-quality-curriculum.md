# Sequencing Quality Curriculum

Status: Active
Owner: xLightsDesigner Team

## Purpose

Define the goal map for automated sequencer training. The controller should not
freely explore without direction; it should work through a curriculum, checkpoint
results, promote durable evidence, and choose the next loop from known gaps.

Machine-readable curriculum:

- `../../scripts/sequencer-render-training/catalog/sequencing-quality-curriculum-v1.json`

That artifact must declare `qualityTargetModel.primaryOutcome` as
`whole_display_quality`. Lower-level goals can be active and useful, but they
serve the whole-display target. The validator should fail the curriculum if the
machine-readable hierarchy ever stops prioritizing `full_sequence_render` and
`section_render` above effect or layer capability evidence.

## Training Principle

The automation loop is self-improving inside curriculum boundaries. It may choose
the next best pass from prior results, but the goals, promotion criteria, and
coverage expectations are explicit.

Training must not optimize for one universal aesthetic average. Good sequencing
depends on the song, section, style, model role, and requested design intent.
Metrics should therefore be interpreted as ranges that support a design goal,
not as a single recipe. A low-density neutral look may be valid for quiet support
and invalid for a chorus impact moment; a bright dense look may be valid for a
finale and invalid for a lyric stop.

The curriculum should preserve multiple valid candidates for the same intent
when they differ meaningfully in effect family, target choice, timing, color,
motion, density, or focal path. Promotion should favor "valid inside the intent
range and sufficiently different from recent choices," not just the highest
single score.

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

## Evidence Hierarchy

The durable training stack has four levels. Lower levels are necessary, but they
do not prove sequence quality by themselves.

1. **Effect-level evidence**
   Effect-level training maps capabilities: visibility, motion type, fill,
   texture, color behavior, setting sensitivity, and geometry fit. It answers
   whether an effect/settings range can produce a useful visual behavior on a
   target. It must not be promoted as a final sequencing choice without broader
   context.

2. **Composition-level evidence**
   Composition training evaluates layers, groups, models, submodels, timing
   offsets, blend behavior, color purpose, brightness hierarchy, and target
   handoffs. This is the first level where the system can judge whether several
   selected models/layers/effects read coherently together.

3. **Section-level evidence**
   Section training evaluates a song section or design window as an ordered
   whole-display render. It must score intent fit, style fit, energy range,
   visual presence, focal hierarchy, color story, motion variety, negative
   space, and transition quality across all selected models/layers/effects in
   the section.

4. **Full-sequence evidence**
   Full-sequence training evaluates the complete sequence arc: motifs,
   development, repeated-section variation, chorus lift, verse restraint, lyric
   moments, feature moments, color progression, finale payoff, and avoidance of
   predictable reuse. This is the primary evidence for human-level sequencing.

Promotion rules should weight larger context more heavily. A strong single
effect score can only create a capability prior. A strong section or full
sequence score can promote sequencing behavior. If lower-level and higher-level
evidence conflict, the higher-level rendered sequence result wins.

## Metric Scope

Every metric should declare its scope:

- `effect_capability`: one effect on one target or submodel.
- `layer_stack`: multiple layers on the same target.
- `target_composition`: multiple targets, groups, or submodels in one design
  window.
- `section_render`: all selected models/layers/effects for a song section.
- `full_sequence_render`: the complete rendered sequence or a representative
  multi-section excerpt.

Effect-level metrics can support planning and candidate generation, but the
controller must not treat them as proof of quality sequencing. Quality gates for
creative generation should require section-level or full-sequence evidence
unless the goal is explicitly a low-level capability probe.

The sequence-level score should be multi-axis, not a single taste function:

- intent match
- style match
- technical render quality
- visibility and presence
- energy fit for the song section
- color purpose and color richness where appropriate
- composition readability across the selected display elements
- musical alignment
- transition quality
- novelty and non-repetition
- sequence progression
- targeted repair need

Visibility, color, brightness, density, and neutrality should be judged against
the design intent range. The system should penalize effects that disappear when
presence is required, and it should also penalize over-bright or over-dense
effects when restraint is required.

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

## Human-Level Sequencing Path

The remaining curriculum should move from mechanics toward full sequence
generation in this order:

1. Stabilize measurement reliability and artifact cleanup.
2. Expand effect capability ranges without treating them as final answers.
3. Map model and submodel roles from display metadata and render evidence.
4. Train layer and target composition across multiple selected elements.
5. Add intent-conditioned section scoring for verse support, chorus impact,
   builds, drops/stops, transitions, lyric hits, focal features, spectacle, and
   finale moments.
6. Add style-conditioned scoring so the same section can be valid in clean,
   classic, dense, minimal, playful, symmetric, aggressive, ambient, color-rich,
   or prop-feature styles.
7. Preserve multiple passing candidates per intent/style and score novelty
   against recent selections.
8. Train multi-section musical structure: repeated motifs, section variation,
   energy progression, and section-to-section handoff.
9. Train full-sequence generation and full-sequence video review.
10. Add self-review and repair for problems such as too dim, too neutral, too
    cluttered, too repetitive, too random, weak chorus impact, weak lyric hit,
    missing model roles, poor color story, and style mismatch.
11. Add project-local adaptation so user displays and custom models learn from
    their own metadata, submodels, accepted outputs, and render history.

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

8. Add `creative.intent_revision_variants.v1` after the first revision pair is
   stable. This goal compares the same first draft against focus-simplification,
   focal-handoff-stability, and pacing-balance variants. The variants should use
   the stronger video aesthetic dimensions as targeted objectives, not just as a
   generic intent-match score.

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
  "videoAestheticSummary": {},
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
sequence-level quality improvement. `video_aesthetic_score_model_v2` keeps the
candidate-window score that the controller needs for targeted experiments, then
adds full-display context over all eligible windows: narrative shape, focal
handoff stability, palette purpose coverage, and full-sequence context. This
lets unattended runs distinguish a technically acceptable selected pass from one
that actually improves the larger display arc.

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

The first stronger scoring expansion is implemented in
`build-video-aesthetic-score.mjs` and compared by
`build-video-aesthetic-attempt-comparison.mjs`; future curriculum work should
use those stronger dimensions before adding another parallel scoring contract.
The creative revision variant expansion consumes those dimensions through
targeted variants for focal handoff stability and pacing balance alongside the
existing focus-simplification variant.

## Selection Rules

The controller should prefer:

- blocked records with high quality and only `single_run_baseline` blockers
- stable records that need one more sample to promote
- regressing records that need confirmation
- curriculum goals with no RGB evidence
- model/effect/palette combinations missing required stable samples
- periodic revalidation of promoted priors only after broader coverage is moving
- color-purpose and palette-motion validations that preserve a stable
  spatial/focal foundation before adding restrained color motion

The controller should skip:

- exact learning keys already selector-ready unless revalidation is due
- low-quality or repeatedly rejected paths unless a curriculum goal explicitly
  requires investigation
- paths that cannot be cleaned up within disk guardrails
- submodel choices derived only from names rather than structure or metadata
- color-purpose variants that discard the current readable foundation and
  introduce a new palette stack in the same comparison step

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
