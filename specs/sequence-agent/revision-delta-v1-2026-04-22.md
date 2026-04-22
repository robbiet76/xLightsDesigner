# Revision Delta V1

Status: Active  
Date: 2026-04-22  
Owner: xLightsDesigner Team

## Purpose

`revision_delta_v1` records neutral pass-to-pass change for the sequencer.

It exists to answer:

- what effects are present in the current chosen pass
- what targets are present in the current chosen pass
- what effects/targets were present in the previous pass
- what effects/targets were newly introduced

It does not contain artistic judgment.

## Source Inputs

- `sequencer_prior_pass_memory_v1`
- selected candidate / projected `effectStrategy`

## Contract Shape

```json
{
  "artifactType": "revision_delta_v1",
  "artifactVersion": "1.0",
  "source": {
    "priorPassMemoryRef": "sequencer_prior_pass_memory_v1-...",
    "selectedCandidateId": "candidate-focused"
  },
  "current": {
    "effectNames": ["Color Wash"],
    "targetIds": ["Snowman"]
  },
  "previous": {
    "effectNames": ["Shimmer"],
    "targetIds": ["MegaTree"]
  },
  "introduced": {
    "effectNames": ["Color Wash"],
    "targetIds": ["Snowman"]
  }
}
```

## Rules

- the artifact is descriptive only
- it must not encode success/failure labels
- introduced items are set difference only
- if no prior pass exists, `previous.*` may be empty and introduced items equal current items

## Usage

- carried in `plan_handoff_v1.metadata`
- surfaced in review/debug UI
- available for later critique and revision-loop analysis
