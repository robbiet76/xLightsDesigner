# Layering Proof Plan v1

Status: Active
Date: 2026-04-17
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-17

## Purpose

Define the minimum render-proof contract required before `layering_observation_v1` is allowed to critique same-structure behavior.

This spec exists to prevent a common failure mode:

- identifying same-target placement groups correctly
- then overclaiming layering quality from plan metadata alone

The placement layer only tells us which combinations are worth testing.
The proof plan tells us what render evidence must exist before any layering judgment is allowed.

## Input

`layering_proof_plan_v1` consumes `layering_placement_group_set_v1`.

That means it starts only after we have already classified groups into:

- `same_target_layer_stack`
- `same_target_transition`
- `parent_submodel_overlap`
- unresolved blocked cases

## Artifact

```json
{
  "artifactType": "layering_proof_plan_v1",
  "artifactVersion": 1,
  "proofs": [],
  "blocked": []
}
```

Proof entry:

```json
{
  "artifactType": "layering_proof_requirement_v1",
  "proofId": "proof:same_target_layer_stack:placement-1|placement-2",
  "groupId": "same_target_layer_stack:placement-1|placement-2",
  "taxonomy": "same_target_layer_stack",
  "scope": {},
  "placementRefs": [],
  "renderPasses": [],
  "requiredObservations": [],
  "critiqueEnabled": true
}
```

Blocked entry:

```json
{
  "artifactType": "layering_proof_requirement_v1",
  "proofId": "proof:sibling_submodel_overlap:placement-1|placement-2",
  "groupId": "sibling_submodel_overlap:placement-1|placement-2",
  "taxonomy": "sibling_submodel_overlap",
  "critiqueEnabled": false,
  "blocked": true,
  "unresolvedReason": "..."
}
```

## Supported Proof Contracts

### 1. `same_target_layer_stack`

Required render passes:

- `composite_window`
- `isolated_element_windows`

Required observations:

- stacked composite read
- per-element realization read

Why:

- the composite is needed to judge masking, clutter, and reinforcement
- the isolated windows are needed to compare what each realized element contributed

### 2. `same_target_transition`

Required render passes:

- `handoff_window`
- `isolated_element_windows`

Required observations:

- handoff continuity read
- per-element realization read

Why:

- this is not simultaneous layering
- but same-target handoff quality still depends on what leaves and what arrives

### 3. `parent_submodel_overlap`

Required render passes:

- `composite_window`
- `isolated_element_windows`
- `ownership_window`

Required observations:

- parent and submodel composite read
- per-element realization read
- overlap ownership read

Why:

- parent/submodel overlap is real layering
- but it has higher ambiguity than same-target row stacking
- ownership evidence is needed to show whether the parent and child are contending for the same visible space

## Blocked Cases

The following must remain blocked at this stage:

- `sibling_submodel_overlap`
- `canvas_preload_stack`
- `strand_node_override`

Reason:

- the current plan layer does not provide enough physical ownership or engine-driven proof to critique them honestly

## Project Rule

No layering critique is allowed unless:

1. the placement group taxonomy is supported
2. the corresponding render-proof plan exists
3. the required render passes and observations have actually been captured

That is a hard rule.

## Immediate Next Step

Implement the render-proof generator for the supported taxonomy only:

1. `same_target_layer_stack`
2. `same_target_transition`
3. `parent_submodel_overlap`

Everything else remains blocked until the evidence contract is stronger.
