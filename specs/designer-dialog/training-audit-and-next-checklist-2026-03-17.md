# Designer Training Audit And Next Checklist

Status: Active
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: capture the current training state after the deep-training checklist completed, identify the real remaining gaps, and define the next operational checklist.

## Current Training State

Validated baseline today:
- offline eval corpus: `47/47` passed
- offline average structural score: `3`
- offline artistic averages:
  - concept-summary quality: `3.00`
  - target-selection quality: `3.00`
  - motion language: `3.00`
  - stage-lighting quality: `3.00`
  - composition quality: `3.00`
  - settings/render plausibility: `3.00`
  - thematic continuity: `3.00`
- promoted live baseline suite: `8/8` passed
- canary live suite: `3` scenarios
- smoke live comparative suite: `3` scenarios
- current extended live suite file: `9` scenarios

Interpretation:
- framework churn is no longer the bottleneck
- structural and first-tier artistic gates are green
- the remaining work is operational and qualitative:
  - broader live coverage
  - richer comparative taste gates
  - better real-project metadata once available
  - unattended cadence so the system can keep validating without a person sitting on it

## Current Gaps

1. Live hierarchy needs to prioritize fast iteration
- the checked-in canary suite should be the default per-iteration live gate
- the smoke comparative suite should stay available as a checkpoint tool
- the promoted baseline suite should move to checkpoint cadence
- the extended live pack should stay slower and broader

2. Live coverage is still narrow in layout/song diversity
- the live pack is materially better than before
- it is still concentrated around a small number of saved sequences and layout families

3. Real metadata is still missing
- synthetic metadata fixtures are good enough for controlled training
- they are not a substitute for real project tag patterns

4. Comparative artistic scoring is still heuristic
- it is now useful
- it is not yet the same as a more mature taste/judgment layer

## Overnight Run Feasibility

Yes.

A long-running unattended training/validation run is feasible with the current tooling because:
- the offline runner already exists
- the desktop live validation suite already exists
- the automation CLI is stable enough for detached use
- suite timeout now scales with scenario count
- the live suite runner already reuses repeated refresh/analyze work per sequence context

Important boundary:
- chat itself cannot be used as a deferred inbox while a detached run is executing
- the correct replacement is a file-backed follow-up queue inside the repo
- that queue can be appended to during the night and reviewed after the run completes

## Next Checklist

### A. Baseline Hygiene

- [ ] Update the baseline docs whenever the promoted counts change
- [x] Rerun the current extended live pack and promote the full `9/9` result if it stays green
- [ ] Keep GitHub aligned after each promoted checkpoint

### B. Overnight Automation

- [ ] Use the detached overnight runner for repeated offline and live validation loops
- [ ] Record each run in a timestamped log directory
- [ ] Persist machine-readable outputs for each iteration
- [ ] Stop cleanly on demand with a stop file instead of killing random processes
- [ ] Review the follow-up queue after the run completes

### C. Live Coverage Expansion

- [ ] Add at least one more materially different saved-sequence/layout family to the extended live pack
- [ ] Add at least one more alternate-song scenario where phrase timing matters more than section labels
- [ ] Add at least one more live scenario where render restraint must beat a busier alternative

### D. Training Quality Expansion

- [ ] Push beyond current heuristic gates on render nuance
- [ ] Push beyond current heuristic gates on timing-window subtlety
- [ ] Add richer comparative quality slices where both candidates are structurally valid but only one is artistically better

### E. Real-World Inputs

- [ ] Replace or supplement synthetic metadata fixtures with real project metadata when available
- [ ] Re-audit whether music-analysis outputs are sufficient on more than the current saved-song set
- [ ] Confirm node-share and footprint-share impact metrics stay useful on more layouts, not just the current yard archetype

## Recommended Overnight Cadence

Recommended default cadence:
1. run offline eval every iteration
2. run one-prompt canary live suite every iteration
3. run smoke comparative suite only at checkpoints or explicit preference-shaping runs
4. run promoted baseline live suite only at checkpoints or explicit promotion runs
5. run extended live suite every second iteration or slower
6. stop at the first hard failure unless explicitly running in continue-on-failure mode
7. review the run summary and follow-up queue in the morning before changing prompts or heuristics again

## Recommended Commands

Start detached overnight run:

```bash
nohup bash scripts/designer-training/run-overnight-training.sh \
  --iterations 6 \
  --canary-live-every 1 \
  --baseline-live-every 0 \
  --extended-live-every 2 \
  > /tmp/xld-overnight-launch.log 2>&1 &
```

Add a follow-up note while the run is active:

```bash
bash scripts/designer-training/add-followup.sh "Recheck phrase-cue behavior on alternate song"
```

Stop the active run cleanly:

```bash
touch logs/designer-training-runs/latest/STOP
```
