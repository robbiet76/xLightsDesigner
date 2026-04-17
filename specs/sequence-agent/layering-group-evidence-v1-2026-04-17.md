# Layering Group Evidence v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the first group-level evidence layer between:

1. placement-linked isolated evidence
2. final layering render proof

This exists because some supported layering cases need more than isolated placement refs, but still do not justify inventing fake render windows.

## Artifact

```json
{
  "artifactType": "layering_group_evidence_v1",
  "artifactVersion": 1,
  "source": {},
  "groups": [],
  "blocked": []
}
```

## Supported Derived Evidence

### 1. `handoff_observation_v1`

Used for:

- `same_target_transition`

Derived from:

- adjacent isolated `renderObservationRef` artifacts

Purpose:

- continuity evidence
- not a layered composite judgment

### 2. `ownership_observation_v1`

Used for:

- `parent_submodel_overlap`

Derived from:

- parent/submodel placement relationship
- isolated `previewSceneWindowRef` artifacts

Purpose:

- structural same-ownership evidence
- not a final quality score

## Project Rule

Group-level evidence may satisfy proof requirements when it is the right evidence type.

That means:

- `handoffObservationRef` is enough for supported transition proof
- `ownershipObservationRef` is enough for supported parent/submodel proof

The pipeline still must not invent:

- canvas evidence
- sibling-overlap evidence
- strand/node override evidence
