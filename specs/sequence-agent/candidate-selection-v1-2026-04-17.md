# Candidate Selection v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the first candidate-selection contract for generative sequencing.

`candidate_selection_v1` does not make the final artistic decision for the whole system.
It narrows the currently valid comparison band so the sequencer agent can:

- preserve multiple valid candidates
- compare them against intent and evidence
- avoid early collapse to one hardcoded answer

## Core Rule

`candidate_selection_v1` must preserve an eligible band, not just one mandatory winner.

This contract is allowed to:

- score candidates structurally
- identify the current strongest comparison band
- provide a deterministic preview when no exploration seed is present

This contract is not allowed to:

- hardcode scenario recipes
- assume a single artistic goal such as one lead or constant escalation
- hide a deterministic best-effect policy inside the selection score

## Role Boundary

`candidate_selection_v1` sits between:

- `intent_envelope_v1`
- `realization_candidates_v1`
- later runtime sampling / revision decisions

It is a narrowing artifact, not the final creative act.

## Artifact Shape

```json
{
  "artifactType": "candidate_selection_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "policy": {},
  "scoredCandidates": [],
  "selectedBand": {},
  "primaryCandidateId": "candidate-base",
  "notes": []
}
```

## Source

Suggested fields:

- `intentEnvelopeRef`
- `realizationCandidatesRef`
- `renderValidationEvidenceRef`

## Policy

Suggested fields:

- `mode`
- `explorationReady`
- `deterministicPreview`
- `boundedBandWidth`

Important rule:

- deterministic preview is acceptable at plan time
- bounded exploration should happen later when runtime supplies an explicit seed or revision loop context

## Scored Candidates

Suggested per-entry fields:

- `candidateId`
- `selectionScore`
- `scoreBand`
- `fitScore`
- `noveltyScore`
- `riskScore`

Important rule:

- scores are comparison signals
- not claims of artistic truth

## Selected Band

Purpose:

- keep multiple valid candidates alive for agent comparison and bounded exploration

Suggested fields:

- `candidateIds[]`
- `size`
- `topScore`

## Primary Candidate

Purpose:

- expose the current deterministic preview winner
- enable stable tests and plan summaries

Important rule:

- `primaryCandidateId` is not the final system choice once runtime exploration and render critique are active
