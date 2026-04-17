# Layering Render Proof v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the first materialized render-proof artifact for layering work.

This sits after:

1. `layering_placement_group_set_v1`
2. `layering_proof_plan_v1`

And before:

- `layering_observation_v1`

The generator is intentionally conservative.
It only emits usable layering proof when the required window refs exist.
Otherwise it blocks the case explicitly.

## Artifact

Bundle:

```json
{
  "artifactType": "layering_render_proof_bundle_v1",
  "artifactVersion": 1,
  "source": {},
  "proofs": [],
  "blocked": []
}
```

Proof entry:

```json
{
  "artifactType": "layering_render_proof_v1",
  "artifactVersion": 1,
  "groupId": "same_target_layer_stack:placement-1|placement-2",
  "taxonomy": "same_target_layer_stack",
  "scope": {},
  "placementRefs": [],
  "isolatedElementRefs": [],
  "compositeWindowRef": "",
  "compositeObservationRef": "",
  "handoffWindowRef": "",
  "handoffObservationRef": "",
  "ownershipWindowRef": "",
  "ownershipObservationRef": "",
  "blocked": false,
  "blockedReasons": [],
  "critiqueEnabled": true
}
```

## Generator

Current tool:

- [build-layering-render-proof.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-layering-render-proof.py)
- [build-layering-placement-evidence.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-layering-placement-evidence.py)

Inputs:

- `--proof-plan`
- `--placement-evidence`
- `--out`

## placement-evidence Input Contract

The current generator expects explicit render refs, because those refs are not yet native outputs of `effectPlacements`.

Shape:

```json
{
  "placements": [
    {
      "placementId": "placement-1",
      "previewSceneWindowRef": "/abs/path/window.json",
      "renderObservationRef": "/abs/path/observation.json"
    }
  ],
  "groups": [
    {
      "groupId": "same_target_transition:placement-3|placement-4",
      "handoffWindowRef": "/abs/path/handoff-window.json",
      "handoffObservationRef": "/abs/path/handoff-observation.json",
      "ownershipWindowRef": "/abs/path/ownership-window.json",
      "ownershipObservationRef": "/abs/path/ownership-observation.json"
    }
  ]
}
```

## Current Record Seam

`run-packed-model-batch.sh` now emits these refs into each sample record artifact:

- `artifact.previewSceneWindowRef`
- `artifact.renderObservationRef`

And it preserves `placementId` when the manifest sample provides one.

That means placement-linked layering evidence is now possible without another render pass, as long as:

- the execution manifest carries `placementId`
- the run writes standard record artifacts

## What The Generator Does Now

### For `same_target_layer_stack`

If all isolated placement windows exist:

- composes a `composite_window`
- derives a `compositeObservationRef`
- carries forward isolated refs

### For `same_target_transition`

Requires:

- explicit `handoffWindowRef`

If present and no handoff observation exists yet:

- derives `handoffObservationRef`

Otherwise:

- blocks the proof

### For `parent_submodel_overlap`

If isolated placement windows exist:

- composes a `composite_window`
- derives a `compositeObservationRef`

Also requires:

- explicit `ownershipWindowRef`

If ownership observation is missing:

- derives `ownershipObservationRef`

Without `ownershipWindowRef`:

- blocks the proof

## Project Rule

The generator may:

- materialize proof artifacts
- derive render observations from provided window refs

It may not:

- invent missing handoff windows
- invent ownership evidence
- convert unresolved taxonomy into usable proof

## Current Limitation

The generator still depends on explicit placement/group evidence refs.

That means the next infrastructure step is:

- connect execution outputs to per-placement preview-window refs
- so layering proof can be generated from actual sequence runs without hand-built manifests
