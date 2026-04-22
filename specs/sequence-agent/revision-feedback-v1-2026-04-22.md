# Revision Feedback V1

Status: Active  
Date: 2026-04-22  
Owner: xLightsDesigner Team

## Purpose

`revision_feedback_v1` is the compact contract for why the last pass should be revised and what the next pass should try to improve.

It exists to gather, in one place:

- rejection reasons from render critique and validation
- retry-loop pressure signals
- the next-pass artistic and execution direction already derived by the system

This keeps the generative revision loop from scattering failure meaning across unrelated metadata fields.

## Source Inputs

- `sequence_artistic_goal_v1`
- `sequence_revision_objective_v1`
- `sequence_render_critique_context_v1`
- `practical_sequence_validation_v1`
- `revision_retry_pressure_v1`

## Contract Shape

```json
{
  "artifactType": "revision_feedback_v1",
  "artifactVersion": 1,
  "status": "revise_required",
  "source": {
    "sequenceArtisticGoalRef": "sequence_artistic_goal_v1-...",
    "sequenceRevisionObjectiveRef": "sequence_revision_objective_v1-...",
    "renderCritiqueContextRef": "sequence_render_critique_context_v1-...",
    "practicalValidationRef": "practical_sequence_validation_v1-...",
    "revisionRetryPressureRef": "revision_retry_pressure_v1-..."
  },
  "rejectionReasons": [
    "Rendered lead does not match the intended primary focus."
  ],
  "retryPressure": {
    "signals": ["low_change_retry"],
    "oscillatingCandidateIds": ["candidate-alternate"]
  },
  "nextDirection": {
    "artisticCorrection": "Does the next pass resolve the rendered focus problem?",
    "executionObjective": "Revise the next pass to resolve the rendered focus problem.",
    "revisionRoles": ["strengthen_lead"],
    "targetIds": ["MegaTree"],
    "successChecks": ["Rendered composition issue addressed: ..."]
  }
}
```

## Rules

- the artifact is descriptive and directive, not prescriptive about one mandatory realization
- rejection reasons may come from render critique, validation, or refreshed artistic-goal improvement needs
- retry pressure is carried through, not recomputed elsewhere if the artifact is available
- `status` should be:
  - `revise_required` when rejection reasons or retry pressure are present
  - `stable` when neither is present

## Usage

- written during review/apply after render critique and revision-objective refresh
- carried in `plan_handoff_v1.metadata`
- available to review/history UI
- available to later revision-planning logic as the compact “why revise” artifact
