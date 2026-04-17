# Layering Placement Groups v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the first grouping layer between `effectPlacements` and `layering_observation_v1`.

This artifact does not claim to solve layering by itself.
It only identifies which placement combinations are valid candidates for layering analysis and which cases remain unresolved until we have stronger render proof or deeper target ownership detail.

## Why This Exists

The xLights engine audit established that layering is real only on the same physical structure or overlapping ownership chain.

`effectPlacements` already tell us useful things:

- `targetId`
- `layerIndex`
- `startMs`
- `endMs`
- `layerIntent`
- `renderIntent`

But they do not fully encode:

- canvas preload semantics
- sibling submodel physical overlap
- strand or node override ownership

So we need an intermediate grouping contract that is honest about what can and cannot be inferred from the plan layer.

## Artifact

```json
{
  "artifactType": "layering_placement_group_set_v1",
  "artifactVersion": 1,
  "groups": [],
  "unresolved": []
}
```

Each group entry:

```json
{
  "artifactType": "layering_placement_group_v1",
  "groupId": "same_target_layer_stack:placement-1|placement-2",
  "taxonomy": "same_target_layer_stack",
  "targetId": "MegaTree",
  "parentTargetId": "MegaTree",
  "overlapType": "same_target",
  "placements": [],
  "evidenceReady": true,
  "unresolvedReason": ""
}
```

## Supported Taxonomy From effectPlacements Alone

### 1. `same_target_layer_stack`

Use when:

- same `targetId`
- overlapping time windows

This is the cleanest candidate for same-model layering analysis.

### 2. `same_target_transition`

Use when:

- same `targetId`
- windows touch or hand off with no true overlap

This is not simultaneous stacking, but it matters to same-target readability and progression on the same structure.

### 3. `parent_submodel_overlap`

Use when:

- one placement targets the parent model
- the other targets a child submodel of that same parent
- windows overlap

This is a real layering candidate because both can affect the same physical structure.

## Cases That Must Stay Unresolved At This Stage

### 1. `sibling_submodel_overlap`

Two child submodels sharing a parent are not automatically proven to overlap physically.

Without stronger ownership metadata or render proof, this must stay unresolved.

### 2. `canvas_preload_stack`

Canvas behavior is engine-owned and cannot be derived reliably from the plan layer alone.

### 3. `strand_node_override`

This requires deeper ownership and render-order proof than `effectPlacements` currently provide.

## Project Rule

`effectPlacements` may identify layering candidates.
They may not be used to overclaim layering quality.

That means:

- group detection is allowed
- layering critique is not allowed until the corresponding render proof exists

## Immediate Next Step

Use `layering_placement_group_set_v1` to drive the minimum render-proof plan for:

1. same-target overlapping layers
2. same-target handoffs
3. parent/submodel overlaps

Everything else stays unresolved until the evidence contract is stronger.
