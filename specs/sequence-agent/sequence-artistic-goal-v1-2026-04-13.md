# Sequence Artistic Goal v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the designer-owned artistic target for a sequencing pass or revision cycle.

This artifact exists so the sequencing feedback loop optimizes toward:
- artistic intent
- user intent
- lighting-design quality

not just toward generic structural metrics.

## Role Boundary

`sequence_artistic_goal_v1` is owned by the designer.

The designer uses it to express:
- what the sequence should feel like
- how focus should behave
- how sections should evolve
- what artistic failures matter most

The sequencer does not author this artifact.
The sequencer consumes it.

## Why It Is Needed

Without an explicit artistic target, the revision loop will drift toward:
- spread optimization
- density balancing
- family-count heuristics

Those are useful signals, but they are not art direction.

The artistic goal keeps the loop grounded in:
- emotional tone
- compositional hierarchy
- pacing intent
- support-vs-lead behavior
- anti-goals

## References

- [sequencing-design-handoff-v2-spec-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/sequencing-design-handoff-v2-spec-2026-03-19.md)
- [sequence-critique-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-critique-v1-2026-04-13.md)
- [sequence-revision-gating-policy-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-revision-gating-policy-v1-2026-04-13.md)

## Core Rule

Every critique and revision cycle should be evaluated against an artistic goal.

The loop should not ask only:
- what is structurally wrong

It should also ask:
- what artistic goal is this section trying to achieve
- did the current output express that goal
- what artistic correction is needed next

## Artifact Shape

```json
{
  "artifactType": "sequence_artistic_goal_v1",
  "artifactVersion": 1,
  "goalId": "string",
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "artisticIntent": {},
  "evaluationLens": {},
  "antiGoals": [],
  "traceability": {}
}
```

## Source

Suggested fields:
- `designHandoffRef`
- `directorProfileRef`
- `displayUnderstandingRef`
- `analysisHandoffRef`
- `derivedFromRevisionGateRef` when the designer is issuing a correction after critique

## Scope

Suggested fields:
- `projectId`
- `sequenceId`
- `sectionScope`
- `targetScope`
- `goalLevel` (`macro|section|group`)

The goal should be scoped to the ladder level currently being revised.

## Artistic Intent

Suggested fields:
- `emotionalTone`
  - examples:
    - `intimate`
    - `playful`
    - `triumphant`
    - `elegant`
    - `suspended`
- `visualTone`
  - examples:
    - `restrained`
    - `expansive`
    - `sparkling`
    - `soft`
    - `bold`
- `leadTarget`
- `supportTargets[]`
- `focusHierarchy`
  - short explanation of lead/support/background relationship
- `sectionArc`
  - examples:
    - `hold_then_bloom`
    - `steady_lift`
    - `reveal_then_release`
    - `calm_to_open`
- `motionCharacter`
  - examples:
    - `still`
    - `restrained_motion`
    - `gentle_flow`
    - `assertive_pulse`
    - `expanding_motion`
- `densityCharacter`
  - examples:
    - `airy`
    - `restrained`
    - `moderate`
    - `full`

## Evaluation Lens

This is how the designer wants the result judged.

Suggested fields:
- `mustPreserve[]`
  - examples:
    - `clear lead target`
    - `support stays secondary`
    - `maintain neighborhood-friendly restraint`
- `mustImprove[]`
  - examples:
    - `stronger section evolution`
    - `broader reveal in chorus`
    - `cleaner phrase endings`
- `comparisonQuestions[]`
  - examples:
    - `Does the section still read as one idea?`
    - `Does the support widen the scene without stealing focus?`
    - `Does the section evolve enough over time?`

## Anti-Goals

Examples:
- `no multiple competing leads`
- `no static section plateau`
- `no noisy background texture`
- `no over-energized verse`
- `no Vegas-style spectacle`

These should remain designer-owned artistic guardrails, not low-level effect rules.

## Traceability

Suggested fields:
- `directorIntentSummary`
- `designSummary`
- `musicDesignSignals`
- `displayDesignSignals`

## Current Recommendation

For the current POC:
- emit one artistic goal per active revision cycle
- keep it compact
- derive it from the designer’s current handoff and critique context
- make critique and revision planning explicitly reference it

That is enough to bring the artistic lens into the feedback loop without turning the system into a rigid rule engine.
