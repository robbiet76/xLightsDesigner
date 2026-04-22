# Revision Retry Pressure V1

Status: Active  
Date: 2026-04-22  
Owner: xLightsDesigner Team

## Purpose

`revision_retry_pressure_v1` records structural retry pressure in the generative sequencing loop.

It exists to answer:

- is the current pass under retry pressure
- which retry-pressure signals are active
- which candidates are being avoided because they would oscillate back to a prior unresolved shape

It does not contain artistic judgment.

## Source Inputs

- `sequencer_prior_pass_memory_v1`
- `candidate_selection_v1`
- `revision_delta_v1`

## Contract Shape

```json
{
  "artifactType": "revision_retry_pressure_v1",
  "artifactVersion": "1.0",
  "source": {
    "priorPassMemoryRef": "sequencer_prior_pass_memory_v1-...",
    "candidateSelectionRef": "candidate_selection_v1-...",
    "revisionDeltaRef": "revision_delta_v1-..."
  },
  "signals": ["low_change_retry"],
  "oscillation": {
    "candidateIds": ["candidate-alternate"],
    "detected": true
  }
}
```

## Rules

- the artifact is descriptive only
- signals describe retry-loop structure, not artistic success or failure
- oscillation candidate ids identify candidates the selector should treat cautiously because they revert toward a previously unresolved pass shape

## Usage

- carried in `plan_handoff_v1.metadata`
- surfaced in review/debug UI
- carried into history summaries
- available for later critique and revision-loop analysis
