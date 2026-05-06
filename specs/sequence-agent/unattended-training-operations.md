# Unattended Training Operations

This document defines how sequencing quality training should run without requiring user approval for every loop.

## Goal

The training system should continuously improve sequencing quality by running bounded render/validation loops, preserving compact evidence, promoting durable learnings, and stopping only when human or agent intervention is actually useful.

The user should not need to monitor routine loops. The expected user experience is to review periodic summaries, major learning milestones, and product-level decisions.

## Operating Model

Unattended training has two layers:

1. **Automated loop runner**
   - Selects the next curriculum goal from controller state.
   - Builds the training plan.
   - Applies effects through the xLightsDesigner API.
   - Renders and scores full-sequence video evidence.
   - Compares the result against the previous accepted run.
   - Builds deltas, stages/promotes priors, and prunes intermediate frame dumps.
   - Writes an iteration summary after every loop.

2. **Agent intervention**
   - Reviews stopped unattended runs.
   - Makes bounded code, curriculum, strategy, scoring, or fixture repairs when the evidence clearly identifies the failure mode.
   - Runs focused tests.
   - Resumes the unattended run from the latest checkpoint.

## Standing Agent Authorization

The agent may proceed without asking for per-loop approval when the work is within these bounds:

- Run additional unattended training loops using the project-local vendor fixture or other explicitly selected training show folder.
- Clean up intermediate generated artifacts that are already summarized, especially preview frame dumps.
- Update controller strategy selection, curriculum ordering, scoring thresholds, validation summaries, and tests when loop evidence shows a repeated failure mode.
- Add narrow diagnostics needed to understand a training failure.
- Commit and push changes when the user has already asked for the current training automation work to proceed and the change is scoped to that work.

The agent should stop and ask for explicit approval before:

- Deleting source training bundles, specs, user-authored metadata, or sequence assets that are not generated intermediates.
- Changing the selected show folder or project linkage.
- Replacing the core scoring philosophy with a materially different approach.
- Introducing paid external services, new large dependencies, or cloud execution.
- Making broad UI/product changes unrelated to training automation.

## Stop Conditions

The unattended runner should stop with an intervention recommendation when:

- The controller is idle or cannot create a useful queue.
- The same goal is selected too many times in a row.
- Too many consecutive loops regress.
- Rendering/API execution fails.
- Required evidence files are missing or malformed.
- Disk cleanup cannot keep generated artifacts bounded.

These stops are not user approval points by default. They are agent handoff points: inspect evidence, make a bounded fix, test, and resume.

## Evidence Policy

Each loop must preserve compact evidence:

- `loop-summary.json`
- `video-aesthetic-score.json`
- `video-aesthetic-attempt-comparison.json`
- `full-sequence-review-loop.json`
- `layer-composition-delta-summary.json`
- `cross-run-quality-records.json`
- `cross-run-quality-priors-staged.json`
- `cross-run-quality-priors-promoted.json`
- cleanup summary

Raw frame dumps and other large intermediate files should be deleted after they are summarized unless a failure requires preserving them for debugging.

## Default Command

For the current vendor fixture workflow:

```bash
node scripts/sequencer-render-training/tooling/run-sequencing-quality-unattended.mjs \
  --latest-run-root var/logs/sequencing-quality-controller/loop-000031 \
  --previous-state var/logs/sequencing-quality-controller/loop-000032/controller-state.json \
  --model-catalog var/logs/sequencing-quality-controller/vendor-fixture-model-catalog.json \
  --out-root var/logs/sequencing-quality-controller/unattended \
  --run-type overnight \
  --max-loops 20 \
  --max-queue 10 \
  --max-passes 6 \
  --max-consecutive-regressions 1 \
  --max-repeated-goal-count 6
```

Quality-improvement runs should stop on the first meaningful regression so the
agent can inspect and adjust scoring, curriculum, or generation behavior before
spending additional render time. Broader exploratory sweeps may explicitly raise
`--max-consecutive-regressions` when the goal is discovery rather than promotion.

## Review Output

The primary output is:

```text
var/logs/sequencing-quality-controller/unattended/unattended-run-summary.json
```

The summary should make clear:

- how many loops ran
- why the run stopped
- which goals were selected
- score and delta per loop
- whether each loop improved or regressed
- durable and blocked evidence counts
- which compact evidence files were written
- whether agent intervention is recommended
