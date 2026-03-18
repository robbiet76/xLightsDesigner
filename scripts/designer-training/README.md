# Designer Training Scripts

Operational scripts for unattended designer training and validation loops.

## Scripts

- `run-overnight-training.sh`
  - detached-friendly runner for repeated offline and live validation loops
  - writes timestamped artifacts under `logs/designer-training-runs/<run-id>/`
  - supports clean stop via `STOP` file
- `add-followup.sh`
  - appends a timestamped note to the active run's `pending-followups.md`
  - use this instead of relying on chat memory while a detached run is active

## Recommended Use

Start a run:

```bash
nohup bash scripts/designer-training/run-overnight-training.sh \
  --iterations 6 \
  --smoke-live-every 1 \
  --baseline-live-every 0 \
  --extended-live-every 2 \
  > /tmp/xld-overnight-launch.log 2>&1 &
```

Recommended cadence:
- smoke suite: every iteration
- promoted baseline suite: checkpoint only
- extended suite: every second iteration or slower

Add a queued follow-up:

```bash
bash scripts/designer-training/add-followup.sh "Check alternate layout impact weighting"
```

Stop the current run cleanly:

```bash
touch logs/designer-training-runs/latest/STOP
```
