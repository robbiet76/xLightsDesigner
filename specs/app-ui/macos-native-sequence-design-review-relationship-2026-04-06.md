# macOS Native Sequence / Design / Review Relationship (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the relationship contract between the native `Sequence`, `Design`, and `Review` workflows before writing their individual screen layout specs.

These three workflows are tightly coupled.
If they are designed independently too early, they will drift into overlap and recreate the same ambiguity that existed in the Electron shell.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `history-and-live-dashboards-plan-2026-03-13.md`
- `page-roles-and-flow.md`

## Relationship Rule

`Sequence`, `Design`, and `Review` are three views over one shared pending implementation lifecycle.
They are not three separate systems.

Their relationship is:
1. `Design` explains creative intent
2. `Sequence` explains technical translation
3. `Review` explains pending implementation impact and approval

Working rule:
- each workflow must answer a different user question
- none of them should duplicate the others' primary job
- all three must remain coherent as one chain from idea to implementation

## The Three Core Questions

### Design
Answers:
- what does the current creative intent mean
- what is the artistic direction
- what proposal or brief currently exists

### Sequence
Answers:
- how is that intent being translated into actual sequencing logic
- what technical state and readiness exist for the active sequence
- what is blocked or unresolved in the translation layer

### Review
Answers:
- what would happen if the current pending state were applied now
- what is the implementation impact
- is the state ready for approval and apply

## Shared Lifecycle

These three workflows share one conceptual lifecycle:
1. design intent is formed
2. sequence translation is resolved
3. implementation readiness is evaluated
4. apply is approved or deferred

They should feel like adjacent phases of one process, not unrelated screens.

## Shared Artifact Backbone

The relationship should be built on the shared artifact model.

Relevant artifact families include:
- creative brief
- proposal bundle
- design scene context
- music design context
- intent handoff
- plan handoff
- apply result

The UI rule is:
- `Design` emphasizes creative artifacts
- `Sequence` emphasizes translation/intent-plan artifacts
- `Review` emphasizes snapshot/apply artifacts

## Sequence Contract Within This Relationship

`Sequence` is the technical execution-context view.
It owns:
- active sequence identity
- sequence revision/settings state
- sequence-to-track binding visibility
- timing materialization readiness
- translation warnings/readiness
- technical interpretation of the current design intent

It must not become:
- a design page
- an apply approval page
- a generic project setup page

The user should come to `Sequence` to answer:
- what sequence is active
- what track metadata is bound
- what timing substrate is present
- what the sequencer is technically prepared to do

## Design Contract Within This Relationship

`Design` is the creative intent view.
It owns:
- current brief
- proposal bundle summary
- director profile influence
- assumptions, rationale, warnings, open questions
- high-level design-side state of the current work

It must not become:
- a technical translation dashboard
- an apply gate
- a sequence control surface

The user should come to `Design` to answer:
- what the creative direction is
- why the current proposal exists
- whether the design is coherent enough to move toward implementation

## Review Contract Within This Relationship

`Review` is the implementation gate.
It owns:
- pending implementation summary
- design snapshot summary
- sequence translation summary
- apply readiness and impact
- approval/defer/apply actions
- backup/restore visibility tied to the current pending implementation

It must not become:
- a design authoring space
- a live sequence dashboard
- a revision-history browser

The user should come to `Review` to answer:
- what is about to change
- whether it is safe and correct to apply
- what the impact and readiness are

## Required Cross-Screen Consistency

The three workflows must share consistent language for:
- pending vs implemented state
- readiness
- warnings
- selected sequence context where relevant
- artifact recency / snapshot recency

Examples of consistency rules:
1. if a proposal is pending, all three screens should describe that state coherently
2. if sequence translation is blocked, `Sequence` shows the technical reason and `Review` reflects that blockage in approval readiness
3. `Design` may show warnings, but only `Review` owns approval status
4. `Sequence` may show readiness, but only `Review` owns final apply action

## Required Separation Rules

### Design vs Sequence

Must remain separate because:
- creative reasoning and technical translation are different user questions
- combining them creates overloaded dashboards

Allowed overlap:
- both may reference the current proposal and sequence context at summary level

Disallowed overlap:
- `Design` owning detailed sequence revision/translation state
- `Sequence` owning creative brief authoring or design rationale as primary content

### Sequence vs Review

Must remain separate because:
- technical readiness is not the same thing as approval to apply

Allowed overlap:
- `Review` may summarize sequence translation state
- `Sequence` may summarize readiness blockers

Disallowed overlap:
- `Sequence` owning final approval/apply controls
- `Review` turning into a live technical translation dashboard

### Design vs Review

Must remain separate because:
- creative intent inspection is not the same thing as implementation approval

Allowed overlap:
- `Review` may summarize design intent

Disallowed overlap:
- `Design` owning final apply approval state
- `Review` becoming a creative ideation workspace

## Sequence Context Visibility Rule

Active sequence context belongs primarily to `Sequence`.

Secondary visibility is allowed in:
- `Review`, when summarizing the pending implementation target
- `Design`, only if the current design work is explicitly sequence-scoped and that context is lightweight

Disallowed:
- global app-frame sequence header
- heavy sequence-control UI on `Design`

## Pending vs Implemented Rule

The distinction between pending and implemented state must be explicit.

Ownership:
- `Design`: pending creative interpretation
- `Sequence`: pending technical translation
- `Review`: pending implementation decision
- `History`: implemented past revisions

This means:
- `Review` is the bridge from pending to implemented
- `History` starts only after apply succeeds

## Suggested Layout Relationship

This document does not fully specify each screen layout yet, but it locks these relative expectations:

### Design
- design summary first
- rationale and proposal detail second
- warnings/open questions visible but subordinate

### Sequence
- active sequence context first
- technical translation summary second
- readiness and blockers visible
- detailed technical state subordinate

### Review
- pending implementation summary first
- design and sequence summaries side by side or stacked beneath
- approval/apply surface visually dominant

## Navigation Relationship Rule

The user should be able to move among `Design`, `Sequence`, and `Review` without losing the sense that they are looking at the same pending work from different angles.

This does not require cross-screen synchronization gimmicks.
It requires:
- consistent terminology
- consistent snapshot/pending-state identity
- stable selection/context handling

## Out Of Scope For This Document

This document does not yet define:
- exact panel arrangements for each of the three screens
- toolbar placement
- final visual styling
- detailed component lists
- exact read-model schema

Those belong in the individual screen layout specs that follow.

## Decisions Locked Here

1. `Design`, `Sequence`, and `Review` are one linked lifecycle, not isolated pages
2. `Design` owns creative intent
3. `Sequence` owns technical translation and sequence context
4. `Review` owns the implementation gate
5. `Review` is the only one of the three that owns apply approval/actions
6. `History` remains separate and retrospective
7. active sequence context is primarily local to `Sequence`, not global

## Immediate Next Design Step

After this relationship spec:
1. write the native `Sequence` screen layout contract
2. write the native `Design` screen layout contract
3. write the native `Review` screen layout contract
4. ensure those three specs explicitly reference this relationship contract
