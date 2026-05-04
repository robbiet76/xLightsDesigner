# Designer Training Scripts

Operational scripts for unattended designer training and validation loops.

## Scripts

- `run-overnight-training.sh`
  - detached-friendly runner for repeated offline and live validation loops
  - writes timestamped artifacts under `var/logs/designer-training-runs/<run-id>/`
  - supports clean stop via `STOP` file
- `add-followup.sh`
  - appends a timestamped note to the active run's `pending-followups.md`
  - use this instead of relying on chat memory while a detached run is active
- `export-target-behavior-training-summary.mjs`
  - exports an anonymized compact summary from project-local `display/target-behavior.json`
  - strips target ids, display names, parent names, raw render refs, and full geometry payloads
  - intended for calibration review before any shared training promotion
- `build-render-review-artifact.mjs`
  - builds a compact `render_review_v1` artifact from ordered frame/video metrics and section intent
  - scores deterministic quality signals such as coverage, brightness, motion, clutter, blank risk, and flatness
  - provides the first bridge from apply/render proof toward whole-display creative quality review
- `run-self-improvement-cycle.mjs`
  - manifest-driven training loop runner for readiness checks, anonymized target-behavior exports, and promotion-gate metrics
  - starts with `On`, `Bars`, `Color Wash`, and `SingleStrand`
  - excludes `Shimmer` from the initial validation scope
  - includes an opt-in live custom-submodel probe phase for generating accepted apply/render outcomes through the owned xLights API

## Recommended Use

Start a run:

```bash
nohup bash scripts/designer-training/run-overnight-training.sh \
  --iterations 6 \
  > /tmp/xld-overnight-launch.log 2>&1 &
```

Recommended cadence:
- run offline designer eval on every iteration
- run live app validation separately with `apps/xlightsdesigner-ui/eval/run-live-practical-benchmark.mjs` after offline changes are green
- keep live validation attended unless a specific run is known to be stable in the current app/xLights environment

Add a queued follow-up:

```bash
bash scripts/designer-training/add-followup.sh "Check alternate layout impact weighting"
```

Stop the current run cleanly:

```bash
touch var/logs/designer-training-runs/latest/STOP
```

Export project-local target behavior for calibration review:

```bash
node scripts/designer-training/export-target-behavior-training-summary.mjs \
  --project-dir /path/to/xLightsDesignerProject \
  --out var/tmp/target-behavior-training-summary.json
```

Run the self-improvement cycle against existing project-local behavior artifacts:

```bash
node scripts/designer-training/run-self-improvement-cycle.mjs \
  --discover-under var/reports
```

For a safe dry run that skips command phases and only exports/evaluates existing target-behavior artifacts:

```bash
node scripts/designer-training/run-self-improvement-cycle.mjs \
  --skip-commands \
  --project-dir /path/to/xLightsDesignerProject
```

Run live target-behavior probes when the owned xLights API is already reachable:

```bash
node scripts/designer-training/run-self-improvement-cycle.mjs \
  --run-live-probes \
  --endpoint http://127.0.0.1:49915/xlightsdesigner/api \
  --show-dir /path/to/show-folder \
  --discover-under var/reports
```

Live probes are intentionally opt-in. They use the manifest effect list, skip blocked effects, exercise both custom submodel and built-in model target scopes, write project-local `display/target-behavior.json`, export anonymized summaries, and run the same promotion gate.

Build a first-pass section render review from frame/video metrics:

```bash
node scripts/designer-training/extract-render-review-media.mjs \
  --media /path/to/section-review.mp4 \
  --out-dir var/tmp/render-review-media \
  --start-ms 0 \
  --end-ms 8000

node scripts/designer-training/build-render-review-artifact.mjs \
  --frame-features var/tmp/render-review-media/frame-features.json \
  --intent /path/to/section-intent.json \
  --video /path/to/section-review.mp4 \
  --contact-sheet var/tmp/render-review-media/contact-sheet.jpg \
  --frame-dir var/tmp/render-review-media/frames \
  --out var/tmp/render-review.json
```

Render review is the next training direction. It should evaluate whole-display section quality over time, then feed critique and revision back into the self-improvement loop.

The self-improvement loop can also run manifest-defined render reviews. Add a `render_review` phase with one or more `reviews`, each pointing at a frame-features JSON file and optional intent/video/contact-sheet evidence. The cycle writes `render_review_v1` artifacts under `render-reviews/` and includes accept/revise/reject counts in `cycle-summary.json`.

If a review points at `mediaPath` or `videoPath` and does not provide frame features, the cycle first runs media extraction into `render-review-media/`, then feeds the extracted `frame-features.json`, contact sheet, and ordered frames into the review artifact.

The self-improvement loop can also run `fseq_render_review` phases. These point at a preview-scene geometry artifact and one or more rendered `.fseq` files; the cycle reconstructs the display window, rasterizes it into review media, extracts frame metrics, and writes `render_review_v1` output for each section.

`fseq_render_review` reviews can include a `windows` array to review multiple named windows from the same FSEQ. Each window may provide `id`, `label`, `startMs`, `endMs`, and optional intent fields such as `creativeObjective`, `musicRole`, and `paletteIntent`. The cycle expands each source review into one render review per window and includes all windows in `renderReviewGate`.

Set `windowsFrom: "source_apply_marks"` on a `fseq_render_review` phase or review to derive windows from the sibling owned apply result's timing marks. This is useful for validation sequences where the apply payload already defines the intended intro/apply/outro or section windows.

When a `fseq_render_review` phase produces multiple windows, the cycle also writes a `render_review_progression_summary_v1` artifact. This summarizes adjacent-window deltas, similarity risk, quality range, and a deterministic progression score.

Render-review phases produce a separate `renderReviewGate` in `cycle-summary.json`. Promotion is blocked until every render review is accepted; sections marked `revise` or `reject` become revision-loop input.

Add a `render_review_revision_objectives` phase after review phases to write `render-review-revision-objectives.json`. The artifact converts review critiques into concrete revision roles, target quality thresholds, and sequencer actions for the next apply/render attempt.

Add a `render_review_revision_attempts` phase after objective generation to write `render-review-revision-attempts.json`. This turns objectives into owned `/sequencing/apply-batch-plan` payloads only when revision targets and an effect are explicit in the objective or manifest policy. Missing target context is reported as a blocked attempt instead of inferred from user-defined model names.

Add a `render_review_revision_execution` phase after attempt planning to apply planned payloads through the owned xLights API, save the working sequence, render the revised FSEQ, and write `render-review-revision-execution.json`. Blocked attempts are skipped with a recorded reason; failed executions block the cycle unless the phase is marked `required: false`.

Add a `render_review_revision_comparison` phase after execution to rebuild render reviews for revised FSEQ outputs and compare them to the original review. The comparison records decision changes, score deltas, metric deltas, regressions, and whether the revised sequence should be retained for the next training iteration.

Use `run-render-review-revision-loop.mjs` to run the same objective, attempt, execution, and comparison chain iteratively until all revised reviews are accepted, a regression is detected, no attempt can be planned, execution fails, or `--max-iterations` is reached.

For xLights render output, use the existing FSEQ reconstruction path to create a `preview_scene_window_v1`, then rasterize it into reviewable media:

```bash
node scripts/designer-training/build-render-review-from-fseq.mjs \
  --geometry /path/to/preview-scene-geometry.json \
  --fseq /path/to/sequence.fseq \
  --out-dir var/tmp/fseq-render-review \
  --window-start-ms 0 \
  --window-end-ms 8000

node scripts/designer-training/render-preview-window-media.mjs \
  --window /path/to/preview-scene-window.json \
  --out var/tmp/preview-window.mp4
```

Promotion requires repeated evidence across compatible sections or targets. One attractive render is not enough to promote a generalized training rule.
