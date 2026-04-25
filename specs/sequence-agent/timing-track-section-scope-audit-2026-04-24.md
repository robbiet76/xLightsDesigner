# Timing Track Section Scope Audit

Status: Active
Date: 2026-04-24
Owner: xLightsDesigner Team

## Purpose

Record the current audit of section-scoped sequencing assumptions.

Section scope must remain timing-track agnostic. Effects may be anchored to any available timing track and section label. `XD: Song Structure` is only one current generated track, not the product-level section contract.

## Current Rule

- Section scope is a timing-track/section-label reference.
- A section label may come from any timing track.
- A scenario or handoff may provide `timingTrackName` or `sectionTimingTrackName` when a specific track is required.
- If no track is provided, the current generated default may still be `XD: Song Structure`, but code must not treat that as the only valid section source.
- Validation should fail on missing or ambiguous labels rather than silently forcing Song Structure.

## Runtime Audit

Updated:

- `apps/xlightsdesigner-ui/app-ui/page-state/sequence-dashboard-state.js`
  - Timing dependency readiness now accepts any timing track with a matching section label.
  - Planned timing readiness now checks timing commands and labels, not structure-track naming.
  - Fallback row display now says `Section timing` instead of implying `XD: Song Structure`.

- `apps/xlightsdesigner-ui/agent/sequence-agent/practical-sequence-validation.js`
  - Adds generic section-timing metrics beside legacy structure metric aliases.
  - Timing failures now refer to reviewed timing-section boundaries, not only structure boundaries.

- `apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js`
  - Section timing can be driven by `executionStrategy.timingTrackName`, `executionStrategy.sectionTimingTrackName`, or matching section-plan fields.
  - Current generated default remains `XD: Song Structure` when no explicit section timing track is supplied.

- Native handoff automation
  - `generateSequenceProposal` now forwards selected section labels and optional timing track names from the macOS automation endpoint into native direct proposal generation.
  - `run-full-handoff-validation.mjs` and `validate-metadata-tag-proposal-flow.mjs` now support section-label scenarios.
  - Forced validation sequences seed a neutral `Validation Section Scope` timing track and resolve `Chorus 1` by label, proving the handoff does not depend on `XD: Song Structure`.
  - Native apply fallback can synthesize owned batch-plan commands from section plans when proposals do not carry explicit effect placements.

Still intentionally current-default or test-fixture specific:

- Native fallback apply can still use `XD: Song Structure` from the current audio analysis record when no explicit timing track is provided.
- Audio dashboard status still reports currently generated analysis tracks such as `XD: Song Structure`.
- Existing tests use `XD: Song Structure` fixtures where they are verifying current generated-track behavior.

## Validation

- `node --test apps/xlightsdesigner-ui/tests/app-ui/page-state/sequence-dashboard-state.test.js`
- `node --test apps/xlightsdesigner-ui/tests/agent/sequence-agent/practical-sequence-validation.test.js`
- `node --test apps/xlightsdesigner-ui/tests/agent/sequence-agent/sequence-agent.test.js`

New coverage includes:

- arbitrary available timing track with matching section label
- planned arbitrary section timing track
- explicit section timing track name honored by sequence-agent command generation
- live native handoff matrix with target, group, tag-only, and section-label scenarios
