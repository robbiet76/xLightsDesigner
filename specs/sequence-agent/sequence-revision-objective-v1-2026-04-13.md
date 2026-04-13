# Sequence Revision Objective v1

Status: Draft
Date: 2026-04-13
Owner: xLightsDesigner Team

## Purpose

Define the next bounded revision objective after critique and gating.

This artifact is the handoff point between:
- the designer's artistic direction
- the sequencer's execution work

## Role Boundary

The revision objective is a shared artifact with split ownership inside it:

- `designerDirection`
  - artistic goal for the next pass
  - what should read differently

- `sequencerDirection`
  - execution focus for the next bounded pass
  - what kind of change Patch should attempt

This keeps the roles distinct while giving them a stable working relationship.

## References

- [sequence-artistic-goal-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-artistic-goal-v1-2026-04-13.md)
- [sequence-critique-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-critique-v1-2026-04-13.md)
- [sequence-revision-gating-policy-v1-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-revision-gating-policy-v1-2026-04-13.md)

## Artifact Shape

```json
{
  "artifactType": "sequence_revision_objective_v1",
  "artifactVersion": 1,
  "objectiveId": "string",
  "createdAt": "ISO-8601",
  "source": {},
  "scope": {},
  "ladderLevel": "macro|section|group|model|effect",
  "designerDirection": {},
  "sequencerDirection": {},
  "successChecks": []
}
```

## Source

Suggested fields:
- `sequenceArtisticGoalRef`
- `sequenceCritiqueRef`
- `sequenceRevisionGateRef`
- `sequenceLearningRecordRef`

## Scope

Suggested fields:
- `projectId`
- `sequenceId`
- `sectionScope`
- `targetScope`

## Designer Direction

Suggested fields:
- `artisticCorrection`
  - the main artistic change the next pass should achieve
- `mustPreserve[]`
  - artistic qualities that are already correct
- `mustAvoid[]`
  - things the next pass must not break
- `evaluationPrompt`
  - one short natural-language question to judge the next result

Examples:
- `Clarify the section arc so it blooms instead of plateauing.`
- `Keep ArchSingle as the clear lead while MatrixLowDensity widens the scene quietly.`

## Sequencer Direction

Suggested fields:
- `executionObjective`
  - bounded implementation direction
- `allowedMoves[]`
- `blockedMoves[]`
- `revisionBatchShape`
  - examples:
    - `section_evolution_pass`
    - `lead_support_rebalance`
    - `macro_spread_pass`
    - `group_cleanup_pass`

Examples:
- `Introduce one bounded support bloom in the middle third without increasing lead competition.`
- `Do not add new lead families.`

## Success Checks

These are pass-specific checks, not global metrics.

Examples:
- `section still reads as one idea`
- `support remains secondary`
- `middle slice feels more open than opening slice`
- `no new competing focal target`

## Current Recommendation

Use this artifact as the immediate next-step handoff after:
1. critique
2. revision gate

That will keep the designer/sequencer relationship explicit during live iteration.
