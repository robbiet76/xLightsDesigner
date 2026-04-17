# Sequence Critique v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the critique artifact produced from reconstructed render observations.

This artifact is the bridge between:
- raw reconstructed render evidence
- agent-consumable feedback for revision
- future learning records

It must support both:
- designer-level strategic feedback
- sequencer-level execution feedback

## References

- [sequencing-feedback-loop-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencing-feedback-loop-v1-2026-04-13.md)
- [sequence-learning-record-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-learning-record-v1-2026-04-13.md)
- [preview-scene-reconstruction-architecture-2026-04-10.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/preview-scene-reconstruction-architecture-2026-04-10.md)

## Core Decision

`sequence_critique_v1` must produce two linked views over the same evidence:

1. `designerSummary`
- strategic
- intent-oriented
- section/focus/composition language

2. `sequencerSummary`
- revision-oriented
- execution-focused
- target/family/spread/density language

The same render evidence should inform both, but they should not collapse into one undifferentiated summary.

## Why This Split Matters

The two agents learn different things from the same checkpoint:

- the `designer` should learn whether the concept, staging, and emphasis map were effective
- the `sequencer` should learn what to revise in the next execution batch

If these are merged:
- designer feedback becomes too tactical
- sequencer feedback becomes too vague

## Artifact Shape

```json
{
  "artifactType": "sequence_critique_v1",
  "artifactVersion": 1,
  "createdAt": "ISO-8601",
  "source": {},
  "ladderLevel": "macro|section|group|model|effect",
  "designerSummary": {},
  "sequencerSummary": {},
  "nextMoves": []
}
```

## Source

Suggested fields:
- `renderObservationRef`
- `compositionObservationRef`
- `layeringObservationRef`
- `previewSceneWindowRef`
- `designHandoffRef`
- `revisionBatchRef`
- `checkpointId`

## Ladder Level

The critique must declare the highest level it is judging.

Allowed values:
- `macro`
- `section`
- `group`
- `model`
- `effect`

Rule:
- early v1 critique should default to `macro`
- lower-level critique should not be emitted until higher-level instability is resolved

## Designer Summary

Purpose:
- communicate whether the design intent is reading correctly

Suggested fields:
- `intentRead`
- `focusRead`
- `contrastRead`
- `compositionRead`
- `strengths[]`
- `weaknesses[]`
- `designAdjustmentSuggestions[]`

Examples:
- "The sequence reads as a sparse tree-led idea."
- "The intended focal emphasis is too narrow for a chorus."
- "Section contrast is still underdeveloped."

## Sequencer Summary

Purpose:
- communicate what the next revision batch should do

Suggested fields:
- `executionRead`
- `spreadRead`
- `densityRead`
- `familyBalanceRead`
- `motionRead`
- `strengths[]`
- `weaknesses[]`
- `revisionSuggestions[]`

Examples:
- "Current active spread is too narrow relative to full-scene bounds."
- "Tree family is carrying the scene alone; support targets are absent."
- "Centroid motion is coherent, but breadth is too limited."

## Next Moves

This should be a short ordered list of revision guidance.

Each entry should include:
- `priority`
- `owner` (`designer|sequencer`)
- `level`
- `instruction`

Examples:
- `designer`: widen the intended focal footprint for this section
- `sequencer`: add restrained support coverage to one secondary family

## Current v1 Recommendation

For the current proof phase:
- generate `macro` critique only
- keep it compact and structured
- derive it from `render_observation_v1`
- allow composition and layering evidence to refine the critique when those artifacts exist
- split the output into `designerSummary` and `sequencerSummary`

That is enough to start feeding both agents from the same render checkpoint without overcommitting to a deeper critique system too early.

## Metric Interpretation Guardrail

Observation metrics such as:
- left/right balance
- top/bottom balance
- coverage ratio
- coverage gaps
- breadth
- density

must be treated as descriptive inputs, not universal optimization targets.

Rules:
- do not define fixed ideal percentages for these metrics at the critique level
- do not assume symmetric coverage is always better
- do not assume fuller coverage is always better
- do not assume fewer gaps are always better

These metrics only become weaknesses when they contradict:
- the current artistic goal
- the intended section role
- the intended display-use pattern
- the current musical moment

Examples:
- a right-side-focused phrase may intentionally fail left/right balance
- a restrained verse may intentionally leave broad parts of the display unused
- a focal solo moment may intentionally avoid broad family participation
