# Current App Plan (2026-04-05)

Status: Active
Date: 2026-04-05
Owner: xLightsDesigner Team

## Purpose

Define the current implementation plan after the repo cleanup, runtime ownership refactor, and timing-track workflow work.

This document is the current cross-domain execution summary.
It does not replace detailed domain specs.
It tells the repo which work is current, which work is foundational, and what should happen next.

## Current Product Shape

The current application is organized around this execution order:

1. audio analysis
2. reviewed timing-track generation
3. sequencing/design handoff on reviewed timing
4. sequencer quality and effect-training work

This is the active spine.

## What Is Considered Stable Enough

### 1. Audio analysis foundation

Stable enough for current sequencing work:
- canonical `audio_analyst` boundary
- provider framework
- identity-aware analysis flow
- timing-track taxonomy
- timing-track workflow contract for structure and phrase tracks

Primary sources:
- `audio-analyst/provider-framework.md`
- `audio-analyst/implementation-checklist.md`
- `audio-analyst/timing-track-taxonomy-and-sequencing-uses-2026-04-05.md`
- `audio-analyst/timing-track-workflow-implementation-checklist-2026-04-02.md`

### 2. App/runtime architecture

Stable enough for continued product work:
- `app.js` reduced to a much thinner shell
- runtime ownership extracted by responsibility
- project/session/timing/metadata/analysis/apply/proposal ownership is no longer concentrated in one file

Primary sources:
- `app-ui/implementation-checklist.md`
- `sequence-agent/sequence-session-and-live-validation-refactor-plan-2026-04-05.md`

### 3. Timing-track sequencing substrate

Current approved sequencing substrate:
- reviewed `XD: Song Structure`
- reviewed phrase-level `XD:` timing track
- provenance model:
  - `source`
  - `userFinal`
  - `diff`
- sequencing blocked when required timing review is unresolved

Primary sources:
- `audio-analyst/timing-track-workflow-implementation-checklist-2026-04-02.md`
- `audio-analyst/timing-track-taxonomy-and-sequencing-uses-2026-04-05.md`
- `sequence-agent/sequencer-quality-and-training-on-reviewed-timing-checklist-2026-04-02.md`

## Immediate Next Development Phase

The next major development phase is:
- improve sequencer quality on top of reviewed timing

This means:
1. complete live reviewed-timing validation in xLights
2. validate sequence generation against reviewed timing
3. evaluate timing fidelity separately from effect quality
4. only then resume deeper effect-training work

Primary source:
- `sequence-agent/sequencer-quality-and-training-on-reviewed-timing-checklist-2026-04-02.md`

## Planned Timing-Track Expansion

The current structure/phrase slice is not the full target.
Next timing-track families to add after the current sequencing substrate is stable:
- beats
- bars
- later: chords, energy, accents, repeats, sparse windows

Primary source:
- `audio-analyst/timing-track-taxonomy-and-sequencing-uses-2026-04-05.md`

## Domain Status Summary

### `audio_analyst`
- active
- current focus: timing-track contract and sequencing substrate support
- not the current bottleneck

### `designer_dialog`
- active
- current role: maintain stable creative handoff into sequencing
- do not broaden training scope until reviewed-timing sequencing quality is stable

### `sequence_agent`
- active
- current bottleneck
- focus is reviewed-timing consumption fidelity and effect realization quality

### `app_assistant`
- active
- coordinating shell only
- do not treat it as the place to hide domain logic that belongs in specialist runtimes

### `app_ui`
- active
- current focus is workflow clarity and stable read models, not broad new UI expansion

## What Is Foundational But Not The Current Execution Spine

The `xlights-sequencer-control-*` spec set remains useful as foundational contract/reference material for:
- API surface
- schemas
- sequencing control contract
- training-package architecture

But it is no longer the main execution spine for day-to-day work.
Current execution is driven by:
- timing-track workflow
- reviewed-timing sequencing quality
- runtime ownership cleanup

## Working Rule

When a spec conflict exists:
1. current app plan
2. current domain README for the relevant area
3. current active detailed checklist/contract for that area
4. older foundational contract/reference docs

If older docs disagree with current implementation direction, update indexes and current-phase docs before adding feature work.
