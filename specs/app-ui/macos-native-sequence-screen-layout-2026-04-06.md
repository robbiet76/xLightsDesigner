# macOS Native Sequence Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Sequence` screen layout contract.

This screen is the technical execution-context view for the active project. It must explain sequence-specific state and translation readiness without turning into either a design dashboard or an apply gate.

Primary parent sources:
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-sequence-workflow-review-from-electron-2026-04-06.md`


## Reference Rule

The current Electron `Sequence` page is a workflow reference only.
It may be used to evaluate active-sequence hierarchy, translation browse surfaces, and blocker visibility, but it is not the target shell.
If Electron behavior and this screen contract diverge, this screen contract wins unless explicitly revised in the Sequence workflow review document.

## Screen Purpose

The `Sequence` screen exists to do five jobs clearly:
1. show the active sequence context
2. show which shared track metadata record is bound to that sequence
3. show sequence revision/settings state
4. show timing-substrate and materialization readiness
5. show technical translation readiness and blockers

It is not a design-intent page.
It is not the final approval/apply page.
It is not a generic xLights control panel.

## Primary User Goals

1. understand what sequence is active
2. understand what track metadata and timing substrate the sequence is using
3. understand technical translation readiness and blockers
4. understand what must be resolved before moving to `Review`

## Entry Conditions

- active project normally exists
- screen remains accessible even if no sequence is open, but must explain that state clearly

## Exit Conditions

The user should be able to leave this screen knowing one of these is true:
1. the sequence context is ready enough for review
2. the technical translation is blocked and the blocker is clear
3. there is no active sequence yet and the next valid action is obvious

## Layout Overview

The native `Sequence` screen should use a top context band plus a two-column lower layout.

Primary structure:
1. page header
2. active sequence context band
3. translation-and-readiness band

Lower band layout:
- left: translation summary / readiness
- right: sequence detail / binding / timing detail

The key rule is:
- sequence identity comes first
- technical readiness comes second
- detailed sequence state is subordinate

## Region Definition

### Region A: Page Header

Required contents:
- title: `Sequence`
- short purpose line:
  - `Inspect live sequence context and technical sequencing readiness.`

Disallowed contents:
- final apply action controls
- creative brief editing

### Region B: Active Sequence Context Band

Purpose:
- answer immediately which sequence this screen is talking about

Required contents when a sequence is active:
- sequence name/path summary
- xLights revision summary
- bound track metadata summary
- concise timing-substrate summary

Required contents when no sequence is active:
- `No active sequence`
- short explanation of what this means for downstream work

Optional contents:
- sequence settings summary
- sequence duration / target scope summary if useful

### Region C: Translation Summary Panel

Purpose:
- show what the sequencer is technically prepared to do

Required contents:
- translation status
- readiness summary
- key blockers/warnings
- timing-materialization readiness
- concise handoff/plan summary when present

This is the main read surface after sequence identity.

### Region D: Sequence Detail Panel

Purpose:
- show supporting technical detail without dominating the screen

Recommended sections:
1. sequence revision/settings
2. bound track metadata reference
3. timing-substrate/materialization detail
4. technical warnings detail

Rule:
- detailed technical state belongs here, not in the global header and not in `Design`

## State Variants

The wireframe and prototype set for `Sequence` must cover:
1. no active sequence
2. active sequence ready
3. active sequence blocked on timing/binding/readiness
4. stale revision or refresh-needed state

## Interaction Rules

1. active sequence identity must be the first read surface
2. this screen may expose sequence refresh/select/open actions if needed, but not apply approval
3. readiness/blocker language must be technical and actionable
4. this screen must not own final approval/apply controls

## Read-Model Expectations

Expected logical groups:
- `activeSequence`
- `binding`
- `sequenceSettings`
- `timingReadiness`
- `translationSummary`
- `warnings`

## Out Of Scope For This Screen

Do not add:
- final apply approval/actions
- creative brief editing
- standalone audio analysis controls
- long-term history browsing

## Decisions Locked Here

1. `Sequence` is sequence-first and technically oriented
2. active sequence identity is the first read surface
3. translation readiness is the main summary surface
4. final apply remains outside this screen

## Screen Reading Order

The native `Sequence` screen should read in this order:
1. what sequence is active
2. what track metadata and timing substrate are bound to it
3. is technical translation ready
4. what blocker or warning matters most right now

## Default Behavior

When no active sequence exists, the empty state must make the next valid sequence action obvious.

When a sequence exists:
- active sequence identity remains the first read surface
- translation readiness remains the main summary payload
- apply ownership remains outside this screen

## Native Acceptance Criteria

The `Sequence` screen is implementation-ready only when:
1. active sequence identity is established immediately
2. binding and timing-substrate state are clear
3. readiness and blockers are concise and actionable
4. translated technical rows remain dense and browseable
5. the page does not drift into review/apply ownership
