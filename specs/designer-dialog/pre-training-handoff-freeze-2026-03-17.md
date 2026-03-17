# Pre-Training Handoff Freeze

Status: Frozen
Date: 2026-03-17
Owner: xLightsDesigner Team

Purpose: lock the designer-to-sequencer handoff shape that deep training will target. During the training phase, model quality may improve, but this contract should not change except for bug fixes or clearly-scoped additive extensions.

## Frozen Baseline

Training baseline handoff version:
- `designer proposal bundle`: `1.0`
- `intent_handoff_v1`: `1.0`
- `plan_handoff_v1`: `1.0`
- `design dashboard state`: `1.0`
- `review dashboard state`: `1.0`
- `sequence dashboard state`: `1.0`

## Frozen Design Concept Fields

Every active concept must carry:
- `designId`
- `designRevision`
- `designAuthor`
- derived display label `D<concept>.<revision>`

Concept rules frozen for training:
- `designId` is stable across revisions
- `designRevision` increments on revise-in-place
- direct user-authored concepts use the same identity model as designer-authored concepts
- active drafts contain only the current revision of each concept
- superseded revisions are tracked separately for inspection, not duplicated into the active draft rows

## Frozen Designer Execution Strategy Fields

Current training baseline expects the designer handoff to be placement-first.

Required execution strategy support:
- `passScope`
- `sectionCount`
- `targetCount`
- `sectionPlans[]`
- `effectPlacements[]`

Required `sectionPlans[]` support:
- `designId`
- `designRevision`
- `designAuthor`
- `section`
- `intentSummary`
- `targetIds`

Required `effectPlacements[]` support:
- `placementId`
- `designId`
- `designRevision`
- `designAuthor`
- `targetId`
- `layerIndex`
- `effectName`
- `startMs`
- `endMs`

Strongly expected placement fields during training:
- `timingContext`
- `creative`
- `settingsIntent`
- `paletteIntent`
- `layerIntent`
- `renderIntent`

## Frozen Page Responsibilities

Design page:
- conceptual concept rows
- palette and design-direction context
- no raw sequence-command detail

Review page:
- grouped by `designId`
- current concept plus previous revision summary when available
- approval/removal/revision actions at concept level

Sequence page:
- exact technical translation rows
- grouped execution detail
- compact inspect path from concept rows

## Allowed Changes During Deep Training

Allowed without changing the training baseline:
- better prompts/instructions
- better model behavior
- better weighting/selection logic
- bug fixes that do not change the contract shape
- additive diagnostics fields that do not invalidate existing consumers

Not allowed without explicitly reopening framework work:
- changing identity semantics
- changing revise/remove workflow semantics
- replacing placement-first execution with a different execution unit
- changing Review grouping away from concept-level rows
- turning Design into a sequence-detail mirror

## Reopen Criteria

Framework work may be reopened only if one of these is true:
- the frozen contract cannot represent a designer behavior we now require
- the review model blocks human evaluation materially
- the sequencing contract cannot preserve correctness for supported use cases
- a live runtime bug reveals a missing required field, not just weak training
