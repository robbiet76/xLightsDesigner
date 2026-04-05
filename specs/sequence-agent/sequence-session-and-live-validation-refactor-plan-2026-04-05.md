# Sequence Session And Live Validation Refactor Plan

Owner: xLightsDesigner Team  
Date: 2026-04-05  
Status: Active, approved next refactor phase

## Purpose

Stabilize the architecture that sits between:

1. reviewed audio-derived timing tracks
2. live xLights sequence state
3. sequence generation and validation

The current product direction is correct:

- audio analysis produces timing-track substrate
- reviewed `XD:` timing tracks are the sequencing contract
- the sequencer consumes that reviewed timing

The current implementation issue is not the product model.
It is that too much orchestration depends on mutable UI state and live eval logic embedded in the production runtime.

This refactor exists to tighten those boundaries before deeper sequencer training work.

## Architectural Goal

Move from:

- app state as the de facto source of truth for show/sequence/media context
- live eval suites tightly coupled to the desktop main process
- timing-track names and rules scattered across code

To:

- a single authoritative sequence-session boundary
- a small production automation surface with external suite orchestration
- a centralized timing-track registry

## Core Problems To Fix

### 1. Sequence Context Ownership Is Too Loose

Current symptoms:

- `state.showFolder` gates whether an open xLights sequence is considered valid
- `state.flags.activeSequenceLoaded` can drift from actual xLights state
- proposal generation must self-heal from xLights state at runtime

This creates false negatives like:

- xLights has a real open sequence
- but the app blocks generation because project/show context is stale or mismatched

### 2. Live Validation Is Too Coupled To Production Desktop Runtime

Current symptoms:

- live suite orchestration runs through the same desktop process that owns the app lifecycle
- long-running suites are blocked by dev Electron automation poller instability
- suite logic is too large and imperative inside desktop/runtime code

This makes eval infrastructure a product blocker.

### 3. Timing-Track Family Is Specified But Not Yet Centralized In Code

Current symptoms:

- canonical timing-track meaning is documented
- but track naming, coverage assumptions, and sequencing meaning are still spread across runtime code

This will drift as beats, bars, chords, energy, and accents are added.

## Refactor Principles

1. production logic stays generic
2. eval-specific paths belong in suite/config data, not production rules
3. xLights live state should be modeled once, not repeatedly inferred
4. timing-track types should come from a registry, not scattered string literals
5. sequencing should depend on reviewed timing contracts, not ad hoc runtime reconstruction

## Workstream A: `SequenceSession` Boundary

### Goal

Introduce one authoritative runtime boundary for current project/show/sequence/media state.

### `SequenceSession` Responsibilities

It should own:

1. active project identity
2. active show folder
3. active sequence path
4. current xLights open-sequence state
5. sequence loaded/usable state
6. active media path
7. media identity:
   - content fingerprint
   - ISRC
   - verified title/artist when available
8. revision identity
9. reasons the session is blocked or degraded

### It Must Not Own

1. audio-analysis orchestration
2. timing-track provenance contents
3. designer/sequencer handoff contents
4. eval suite logic

### Required API Shape

Minimum interface:

1. `buildSequenceSession(state, liveXLightsState)`
2. `isSequenceUsableForGeneration(session)`
3. `isSequenceWithinShowFolder(session)`
4. `resolveMediaForSession(session, mediaCatalog, analysisArtifacts)`
5. `explainSequenceSessionBlockers(session)`

### Immediate Behavior Changes

After this boundary exists:

1. `onGenerate()` should check `SequenceSession`, not raw UI flags
2. dashboard readiness should consume `SequenceSession`
3. open/refresh logic should update `SequenceSession`
4. live validation should inspect `SequenceSession` directly

### Checklist

- [ ] define `SequenceSession` data shape
- [ ] define source-of-truth precedence:
  - [ ] explicit project/show context
  - [ ] live xLights open sequence
  - [ ] persisted project snapshot
  - [ ] media identity
- [ ] implement pure session-builder module
- [ ] implement session blocker classification
- [ ] route generation gating through session module
- [ ] route dashboard readiness through session module
- [ ] add focused tests for stale show-folder / open-sequence mismatches
- [ ] remove duplicated sequence-open gating logic where possible

### Exit Criteria

- a sequence cannot be “open in xLights but unavailable in app” without an explicit session blocker reason
- generation/dashboard/apply all use the same session truth
- stale UI state no longer causes divergent decisions

## Workstream B: Live Validation / Automation Split

### Goal

Reduce coupling between the production app and the live eval framework.

### Target Model

Production app should expose only small stable primitives:

1. open sequence
2. set show folder
3. set audio path
4. refresh from xLights
5. run analysis
6. seed timing tracks
7. generate proposal
8. apply proposal
9. fetch runtime snapshots

Live suites should orchestrate those primitives externally.

### What Should Move Out Of Desktop Main

These should be reduced or moved toward external orchestration:

1. scenario loops
2. baseline restore sequencing
3. comparative run assembly
4. large suite-specific result shaping

### Checklist

- [ ] define stable automation primitive contract
- [ ] classify current desktop automation actions into:
  - [ ] production primitive
  - [ ] eval orchestration
- [ ] move whole-suite orchestration toward external runner modules
- [ ] keep desktop main process responsible only for primitive dispatch
- [ ] add renderer-ready / request-drain health diagnostics
- [ ] add automation watchdog health snapshot
- [ ] separate dev-runtime instability from product failure in reports

### Exit Criteria

- desktop main process is no longer the primary home for large live validation scenario orchestration
- live suite failures can be classified as:
  - [ ] renderer/app lifecycle
  - [ ] xLights control/runtime
  - [ ] product logic

## Workstream C: Timing Track Registry

### Goal

Centralize the timing-track family in executable code.

### Registry Responsibilities

The registry should define for each track type:

1. canonical `trackType`
2. canonical `trackName`
3. coverage mode
4. parent/child constraints
5. sequencing use cases
6. whether review is required for sequencing
7. whether the track is optional or required for certain passes

### Initial Registry Entries

1. `song_structure`
2. `phrase_cues`

Next planned:

1. `beats`
2. `bars`
3. `downbeats`
4. `chords`
5. `energy`
6. `accents`
7. `repeats`
8. `sparse_windows`

### Checklist

- [ ] create timing-track registry module
- [ ] move canonical names out of scattered runtime literals
- [ ] move coverage rules into registry metadata
- [ ] define parent-child rule:
  - [ ] `phrase_cues` must stay within `song_structure`
- [ ] define sequencing dependency metadata
- [ ] route timing-review policy lookups through registry
- [ ] add tests for canonical name/type mapping

### Exit Criteria

- code no longer relies on scattered hardcoded `XD:` names for core timing semantics
- adding beats/bars uses the registry, not bespoke conditionals

## Workstream D: Stronger Semantic Handoff Validation

### Goal

Ensure handoffs are not only structurally valid but context-valid.

### Needed Validation Improvements

1. plan references current sequence session
2. required reviewed timing tracks are present when plan says they are needed
3. timing-track types referenced by plan are registry-valid
4. media/sequence identity in handoff matches current session

### Checklist

- [ ] add contextual handoff validation layer on top of schema validation
- [ ] validate plan timing dependencies against registry
- [ ] validate plan/session compatibility
- [ ] validate sequence revision/base revision compatibility

### Exit Criteria

- invalid plan/session mismatches fail explicitly before apply
- handoff failures are distinguishable from runtime failures

## Execution Order

This refactor should proceed in this order:

1. `SequenceSession` boundary
2. live validation / automation split
3. timing-track registry
4. semantic handoff validation
5. then resume live whole-sequence baseline and sequencer-quality work

## What Should Not Happen During This Refactor

Do not expand:

1. broad new audio-analysis heuristics
2. new timing-track families in production beyond the current approved slice
3. sequencer effect-training breadth
4. UI polish work unrelated to session/timing review architecture

Those would create more moving parts before the boundary cleanup is complete.

## First Concrete Implementation Slice

Implement the smallest meaningful boundary improvement first:

1. create `SequenceSession` module
2. route current sequence-generation gating through it
3. route dashboard readiness through it
4. add targeted tests for:
   - sequence open but wrong show folder
   - sequence open and valid after explicit show-folder adoption
   - stale media path with verified fingerprint recovery
   - stale media path without exact identity match

This is the correct first slice because it removes the exact failure mode currently blocking live whole-sequence validation.

## Success Condition

This refactor is successful when:

1. reviewed timing remains the sequencing contract
2. sequence usability is determined by one authoritative session model
3. live validation is no longer blocked by desktop-process orchestration drift
4. timing-track family expansion can proceed from a registry instead of ad hoc naming
5. sequencer training resumes on top of stable boundaries rather than accumulated state patches
