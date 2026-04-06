# macOS Native Design Screen Layout (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the native macOS `Design` screen layout contract.

This screen is the creative intent view for the current pending work. It must explain artistic direction and design rationale without becoming a technical translation dashboard or approval gate.

Primary parent sources:
- `macos-native-sequence-design-review-relationship-2026-04-06.md`
- `macos-native-workflow-contracts-2026-04-06.md`
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-design-workflow-review-from-electron-2026-04-06.md`


## Reference Rule

The current Electron `Design` page is a workflow reference only.
It may be used to evaluate proposal hierarchy and rationale placement, but it is not the target shell.
If Electron behavior and this screen contract diverge, this screen contract wins unless explicitly revised in the Design workflow review document.

## Screen Purpose

The `Design` screen exists to do five jobs clearly:
1. show the current creative brief and direction
2. show the current proposal bundle or design snapshot
3. show design rationale and open questions
4. show creative warnings and assumptions
5. show whether the design side is coherent enough to move toward `Review`

It is not a technical sequence dashboard.
It is not the final apply gate.
It is not a metadata management screen.

## Primary User Goals

1. understand the current creative direction
2. understand why the current proposal exists
3. inspect open questions and warnings
4. understand whether design intent is mature enough for downstream review

## Entry Conditions

- active project normally exists
- design state may be partial or absent early in a workflow

## Exit Conditions

The user should be able to leave this screen knowing one of these is true:
1. the creative direction is coherent and ready to move forward
2. the design side is incomplete and the gap is understandable
3. the current proposal exists but still carries unresolved warnings/questions

## Layout Overview

The native `Design` screen should use a top summary band plus a lower two-column detail layout.

Primary structure:
1. page header
2. design summary band
3. rationale-and-artifacts band

Lower band layout:
- left: proposal / brief summary
- right: rationale / warnings / open questions

The key rule is:
- design meaning first
- supporting rationale second
- technical translation remains out of this screen

## Region Definition

### Region A: Page Header

Required contents:
- title: `Design`
- short purpose line:
  - `Inspect the current creative direction and design intent.`

Disallowed contents:
- active apply controls
- heavy technical sequence state

### Region B: Design Summary Band

Purpose:
- show the highest-level creative state immediately

Required contents:
- brief summary
- proposal summary
- design status/readiness summary
- optional lightweight sequence-scoped note only when relevant

### Region C: Proposal / Brief Panel

Purpose:
- show the current creative payload

Required contents:
- current brief summary
- proposal bundle summary
- director profile influence summary when relevant
- reference direction summary when relevant

### Region D: Rationale / Warnings Panel

Purpose:
- explain why the design looks the way it does

Required contents:
- rationale notes
- assumptions
- open questions
- warnings

Rule:
- `Design` may show warnings, but not final approval status

## State Variants

The wireframe and prototype set for `Design` must cover:
1. no meaningful design state yet
2. design state ready/coherent
3. design state with warnings/open questions
4. partially formed proposal state

## Interaction Rules

1. this screen emphasizes reading and understanding, not apply control
2. proposal/brief inspection is central
3. warnings/open questions must be visible but subordinate to the main summary
4. this screen must not carry heavy sequence revision/translation detail

## Read-Model Expectations

Expected logical groups:
- `brief`
- `proposal`
- `designStatus`
- `rationale`
- `warnings`
- `openQuestions`

## Out Of Scope For This Screen

Do not add:
- final apply approval/actions
- detailed sequence revision state
- standalone audio analysis controls
- metadata management tools

## Decisions Locked Here

1. `Design` is creative-intent first
2. proposal/brief summary is the primary read surface
3. rationale and warnings are secondary explanatory surfaces
4. technical translation remains outside this screen

## Screen Reading Order

The native `Design` screen should read in this order:
1. what is the current creative direction
2. is there a coherent proposal
3. why does the proposal look this way
4. what assumptions or open questions remain

## Default Behavior

When no meaningful design state exists, the empty state must explain what will appear here later without sounding broken.

When design state exists:
- proposal/brief summary remains the dominant read surface
- rationale and warnings remain secondary
- technical translation detail stays off this page

## Native Acceptance Criteria

The `Design` screen is implementation-ready only when:
1. creative direction is the dominant read surface
2. proposal state is understandable at a glance
3. rationale and warnings support the proposal without overwhelming it
4. sequence translation detail does not leak into the page
5. the screen does not read like a live dashboard
