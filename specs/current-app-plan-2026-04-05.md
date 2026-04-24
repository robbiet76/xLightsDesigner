# Current App Plan (2026-04-05)

Status: Active
Date: 2026-04-05
Owner: xLightsDesigner Team

## Purpose

Define the current implementation plan after the repo cleanup, runtime ownership refactor, and timing-track workflow work.

This document is the current cross-domain execution summary.
It does not replace detailed domain specs.
It tells the repo which work is current, which work is foundational, and what should happen next.

## Top Priority Development Policy

During initial development:
- maintain exactly one canonical app source tree
- maintain exactly one canonical xLights source tree
- maintain exactly one canonical desktop app state root
- modify the current implementation in place
- do not create parallel versions, alternate trees, temporary forks, or shadow app installs
- do not add legacy workflows, compatibility shims, migration readers, fallback schemas, or dual-path runtime behavior

This is a hard policy, not a preference.

Rationale:
- parallel versions and legacy compatibility paths have repeatedly reintroduced stale code and stale state
- duplicate roots have caused old app behavior to reload after current work was already completed
- this project is still in initial development, so clarity and single-path execution are more important than backward compatibility

Working rule:
1. one source tree
2. one runtime path
3. one state root
4. update the canonical implementation directly

If a change would require a legacy path or compatibility layer, the correct response is:
- stop
- update the canonical implementation
- migrate or delete the stale path

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
- `app-ui/native-cutover-audit-2026-04-10.md`
- `app-ui/native-app-architecture-diagram-2026-04-10.md`
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

## Current Development Workstream

The current major development workstream is:
- local native macOS app completion on the owned xLights 2026.06 API

This changes the application-shell direction:
- Electron is now reference-only and maintenance-only
- the target product shell is a native macOS application
- backend/domain contracts remain shared and should not be forked by shell

Primary source:
- `xlightsdesigner-local-completion-roadmap-2026-04-23.md`
- `app-ui/native-cutover-audit-2026-04-10.md`

The current implementation-heavy product workstream builds on:
- audio analysis
- shared track metadata
- reviewed timing
- sequencing against the owned xLights API
- full native design authoring

The first completion target is the primary local user workflow. Distribution and shared cloud backend work follow after the local native app reliably creates, applies, renders, and saves sequence work through xLights.

## Native App Completion Rule

Native screen implementation is already active. Future work should complete the canonical native implementation in place.

Working rule:
1. keep the native macOS app as the only active shell
2. keep the owned xLights API as the only active xLights control path
3. use existing show sequences for validation only unless the user explicitly selects one for editing
4. write validation artifacts only into a new isolated folder inside the show folder
5. remove obsolete fallback paths once the owned path is proven

This is now the active planning priority because the local app must become a reliable translation layer between trained agents and the user's xLights show folder before distribution work begins.

Primary source:
- `xlightsdesigner-local-completion-roadmap-2026-04-23.md`

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

If older docs disagree with current implementation direction, update indexes and current workstream docs before adding feature work.
