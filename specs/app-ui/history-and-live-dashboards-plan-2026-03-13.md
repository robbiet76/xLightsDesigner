# History And Live Dashboards Plan

Status: Active
Date: 2026-03-13
Owner: xLightsDesigner Team
Last Reviewed: 2026-03-13

## Goal

Make `Design`, `Sequence`, and `Review` behave as live dashboards during conversation, and make `History` a clean revision log built on immutable artifact references instead of duplicated blobs.

The apply boundary should capture:

- the design state used
- the sequence translation state used
- the scene and music context used
- the execution result produced

## Core Design

There are two linked concerns:

1. live dashboard state during conversation
2. immutable snapshot capture on apply

Those should share the same artifact model.

## Artifact Identity Model

Every major artifact should have a stable identity.

Required fields on persisted artifacts:

- `artifactId`
- `artifactType`
- `artifactVersion`
- `createdAt`

Artifact ids should be deterministic hashes of canonical JSON where practical. Artifacts should be treated as immutable once written.

Artifacts that need ids:

- `analysis_artifact_v1`
- `design_scene_context_v1`
- `music_design_context_v1`
- `director_profile_v1`
- `creative_brief_v1`
- `proposal_bundle_v1`
- `intent_handoff_v1`
- `plan_handoff_v1`
- `apply_result_v1`

## History Entry Model

History entries should reference immutable artifacts rather than embedding all payloads inline.

Recommended `history_entry_v1` shape:

- `historyEntryId`
- `createdAt`
- `projectId`
- `sequencePath`
- `xlightsRevisionBefore`
- `xlightsRevisionAfter`
- `status`
- `summary`
- `artifactRefs`
- `snapshotSummary`

`artifactRefs` should include:

- `analysisArtifactId`
- `sceneContextId`
- `musicContextId`
- `directorProfileId`
- `briefId`
- `proposalId`
- `intentHandoffId`
- `planId`
- `applyResultId`

`snapshotSummary` should stay lightweight and user-facing:

- design summary
- sequence summary
- target scope
- section scope
- apply summary
- verification summary

## Apply Snapshot Semantics

Each successful apply should create one revision record that captures:

1. design intent state
2. sequence translation state
3. execution result state

This means apply is not only a sequencer event. It is the point where design becomes implemented sequence state.

At apply time:

1. freeze current artifact ids
2. execute apply
3. build `apply_result_v1`
4. create `history_entry_v1`
5. mark proposal lifecycle accordingly

Proposal lifecycle should later support:

- `pending`
- `partially_applied`
- `fully_applied`
- `superseded`

## Live Dashboard Model

`Design` and `Sequence` should be parallel live dashboards for the same active conversation.

### Design

Shows what the designer is capturing:

- current brief
- assumptions
- scene rationale
- music rationale
- open questions
- warnings
- director profile influence
- pending design ideas

### Sequence

Shows how that design is being translated:

- normalized intent
- resolved targets
- target granularity
- timing/section anchoring
- proposal lines
- plan summary
- warnings
- implementation readiness

### Review

Shows the implementation gate:

- design snapshot summary
- sequence translation summary
- current apply snapshot
- approval gate
- implementation impact

### History

Shows revision entries built from artifact references:

- one row per apply
- structured drill-in
- no raw JSON by default

## UI Layout Principle

`Design` and `Sequence` should use the same dashboard language:

- summary card
- active state card
- artifact cards
- inspectable structured detail
- clear pending vs implemented status

The user should be able to flip between them during conversation and understand:

- what the designer is thinking
- what the sequencer is going to do

## Storage Layout

Recommended project storage:

- `artifacts/analysis/<id>.json`
- `artifacts/design-scene/<id>.json`
- `artifacts/music-context/<id>.json`
- `artifacts/director-profile/<id>.json`
- `artifacts/briefs/<id>.json`
- `artifacts/proposals/<id>.json`
- `artifacts/intent-handoffs/<id>.json`
- `artifacts/plans/<id>.json`
- `artifacts/apply-results/<id>.json`
- `history/<historyEntryId>.json`

## Implementation Order

1. Add shared artifact id utility and contract fields.
2. Add `history_entry_v1` contract.
3. Persist artifacts by id.
4. Capture artifact refs on apply.
5. Rebuild `Sequence` as a live translation dashboard.
6. Update `Review` to show unified apply snapshots.
7. Build `History` around referenced artifacts.
8. Add partial/full implementation status later.

## Guardrails

- Do not duplicate full artifacts inside history entries.
- Do not let history depend on mutable live state.
- Do not expose raw payloads by default in UI.
- Do not treat apply as sequence-only.
- Do not let artifact ids be UI-only; they must be real persistence identifiers.
