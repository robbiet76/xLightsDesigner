# Timing Track Section Scope Audit

Status: Active
Date: 2026-04-24
Owner: xLightsDesigner Team

## Purpose

Record the current audit of section-scoped sequencing assumptions.

Section scope must remain timing-track agnostic. Effects may be anchored to any available timing track and section label. `XD: Song Structure` is only one current generated track, not the product-level section contract.

The sequencer decides which timing track or tracks are needed before each sequencing round. A single round may create more than one timing track when the design requires different anchors, such as structure, beats, bars, lyrics, vocals, phrases, or future track types.

## Current Rule

- Section scope is a timing-track/section-label reference.
- A section label may come from any timing track.
- A scenario or handoff may provide `timingTrackName` or `sectionTimingTrackName` when a specific track is required.
- Timing tracks are complete authoring assets when created. Section-scoped sequencing may target one section, but any timing track command must write the full known mark set for that track, not a partial track containing only the selected section or selected effect window.
- Timing-track creation is need-based and multi-track. If effects should tie to beats, lyrics, vocals, bars, structure, phrases, or another future timing source, the sequencer should select or create the relevant track before placing effects.
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
  - Any section-scoped timing track write now includes all known sections, including explicit custom timing track names.
  - Referenced placement cue tracks are written as full timing tracks, so the planner can emit more than one timing asset when the design needs multiple anchors.
  - Direct sequencing now infers need-based cue timing assets from intent text and creates available beat, bar, lyric, phrase, and chord tracks before effect commands.

- `apps/xlightsdesigner-ui/agent/designer-dialog/music-design-context.js`
  - Music design cues now expose `XD: Bars` and `XD: Lyrics` as first-class cue timing tracks beside beat, phrase, and chord tracks.

- Native handoff automation
  - `generateSequenceProposal` now forwards selected section labels and optional timing track names from the macOS automation endpoint into native direct proposal generation.
  - `run-full-handoff-validation.mjs` and `validate-metadata-tag-proposal-flow.mjs` now support section-label scenarios.
  - Forced validation sequences seed a neutral `Validation Section Scope` timing track and resolve `Chorus 1` by label, proving the handoff does not depend on `XD: Song Structure`.
  - Native apply hydrates scoped one-mark timing commands from the live timing track before applying, so owned batch plans receive full track context without forcing the section source to `XD: Song Structure`.
  - Native apply hydrates analysis sections from an explicit live timing track before planning, so a selected track remains the source of truth for its full mark set.
  - Native apply converts full created timing-track writes from append-style `timing.insertMarks` to `timing.replaceMarks`, keeping repeated applies deterministic and avoiding partial or duplicated timing tracks.
  - Native apply fallback can synthesize owned batch-plan commands from section plans when proposals do not carry explicit effect placements.

Still intentionally current-default or test-fixture specific:

- Native fallback apply can still use `XD: Song Structure` from the current audio analysis record when no explicit timing track is provided.
- Audio dashboard status still reports currently generated analysis tracks such as `XD: Song Structure`.
- Existing tests use `XD: Song Structure` fixtures where they are verifying current generated-track behavior.

## Validation

- `node --test apps/xlightsdesigner-ui/tests/app-ui/page-state/sequence-dashboard-state.test.js`
- `node --test apps/xlightsdesigner-ui/tests/agent/sequence-agent/practical-sequence-validation.test.js`
- `node --test apps/xlightsdesigner-ui/tests/agent/sequence-agent/sequence-agent.test.js`
- `node --test apps/xlightsdesigner-ui/tests/scripts/native-review-apply.test.js apps/xlightsdesigner-ui/tests/agent/sequence-agent/sequence-agent.test.js apps/xlightsdesigner-ui/tests/agent/sequence-agent/command-builders.test.js`
- `node scripts/native/run-full-handoff-validation.mjs --target-ids Star --selected-tags lead --section-label 'Chorus 1' --no-render-after-apply --skip-launch-native --timeout-ms 180000 --native-timeout-ms 120000 --xlights-timeout-ms 120000`
- `node scripts/native/run-full-handoff-validation.mjs --matrix --no-render-after-apply --skip-launch-native --timeout-ms 180000 --native-timeout-ms 120000 --xlights-timeout-ms 120000`

New coverage includes:

- arbitrary available timing track with matching section label
- planned arbitrary section timing track
- explicit section timing track name honored by sequence-agent command generation
- full timing-track writes use complete marks and replace existing marks during native apply
- need-based direct sequencing creates complete cue timing tracks for beat, measure/bar, lyric/vocal, phrase, and chord intent when matching analysis marks exist
- live native handoff matrix with target, group, tag-only, and section-label scenarios
