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
