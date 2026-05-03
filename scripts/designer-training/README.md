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
