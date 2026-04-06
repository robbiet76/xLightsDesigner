# macOS Native Early Workflow Relationship (2026-04-06)

Status: Active
Date: 2026-04-06
Owner: xLightsDesigner Team

## Purpose

Define the early native workflow relationship among `Project`, `Layout`, and `Audio`.

This document exists because these three screens establish all downstream work.
If their handoffs are vague, the user will not know whether they should fix project context, target structure, or track metadata next.

Primary parent sources:
- `macos-native-information-architecture-2026-04-06.md`
- `macos-native-project-layout-relationship-2026-04-06.md`
- `macos-native-audio-screen-layout-2026-04-06.md`

## Relationship Rule

The early workflow is not one giant setup wizard.
It is three adjacent readiness views with distinct ownership.

1. `Project` = establish working context
2. `Layout` = establish target structure readiness
3. `Audio` = establish track metadata readiness

## Core User Questions

### Project
- is the project real and correctly referenced

### Layout
- are the targets usable for downstream work

### Audio
- are the tracks analyzed and usable for downstream work

## Shared Readiness Model

These three screens should all express readiness in readable user language.
They should not use mismatched internal jargon.

Examples:
- `Ready`
- `Needs Review`
- `Blocked`
- `No action needed`

## Navigation And Handoff Rules

1. `Project` is the default entry when no active project exists
2. `Layout` is the next structural readiness screen after project context is valid
3. `Audio` can be used after project context exists and does not depend on an active sequence
4. `Audio` and `Layout` are parallel early-readiness workflows after `Project`

Important nuance:
- `Layout` appears before `Audio` in navigation because target structure is a core project concern
- `Audio` remains logically parallel, not subordinate, once project context exists

## Cross-Screen Consistency Rules

1. all three screens must show active project identity consistently
2. none of the three should show global active sequence identity
3. all three should use summary-first top regions and dense browse/correction surfaces below when needed
4. readiness hints may point to neighboring workflows, but ownership stays local

## Acceptance Criteria For This Relationship

This relationship is design-ready only when:
1. users can tell what each early workflow owns
2. `Layout` and `Audio` both feel like legitimate next steps after `Project`
3. the app does not accidentally imply that `Audio` depends on `Sequence`
4. the handoff from setup to readiness is coherent rather than wizard-like
