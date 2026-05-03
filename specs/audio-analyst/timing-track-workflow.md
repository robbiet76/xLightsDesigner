# Timing Track Workflow

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: timing-track implementation checklist

## Purpose

Define the durable workflow for turning audio analysis output into reviewed timing tracks that downstream sequencing can trust.

This document covers the review/write/readback workflow. The full timing-track family and sequencing use cases live in `timing-track-taxonomy-and-sequencing-uses.md`.

## Goal

Audio analysis should produce timing artifacts that can:

1. write app-owned `XD:` timing tracks into xLights
2. preserve full coverage with no gaps or overlaps
3. capture user edits back from xLights
4. store generated `source`, current `userFinal`, and normalized `diff`
5. become stable sequencing input for `sequence_agent`

## Initial Track Scope

The first workflow slice is:

- `XD: Song Structure`
- `XD: Phrase Cues`

Later tracks are governed by the taxonomy spec and should reuse this same review/provenance model.

## Non-Negotiable Rules

All generated `XD:` timing tracks must satisfy:

- first segment starts at `0`
- last segment ends at song end
- no gaps
- no overlaps
- ordered segments only
- unlabeled filler is allowed when no logical label should exist

Phrase cues have one extra rule:

- phrase segments must not cross song-structure boundaries

## Track Semantics

`XD: Song Structure`:

- complete coverage track
- labels high-level sections such as `Intro`, `Verse`, `Chorus`, `Bridge`, `Outro`, `Theme`, `Contrast`, or `Refrain`
- drives scene scope and major transition planning

`XD: Phrase Cues`:

- complete coverage track
- phrase segments are children of structure segments
- unlabeled filler is used where no phrase should exist
- drives vocal/lyric accents and phrase-scale motion

## Lyric Ownership

Lyrics needed for runtime analysis, lyric timing tracks, and phrase cues belong
to the selected user media analysis flow. The audio analysis service may fetch
or derive synced lyric lines and plain-lyrics phrase fallback, and project-local
analysis artifacts may retain those lines as user/project data.

Portable training packages should not be treated as a runtime lyric source.
They may include compact lyric-derived structure features such as line counts,
timing windows, labels, repetition ratios, title-hit ratios, and pattern flags,
but should not store raw lyric `lines` or stanza `text` except for tiny synthetic
fixtures created specifically for tests.

## Data Contract

Every generated timing track should carry:

- `trackType`
- `trackName`
- `coverageMode`
- `source`
- `userFinal`
- `diff`
- provenance metadata

Required segment shape:

```json
{
  "startMs": 0,
  "endMs": 1000,
  "label": "Verse 1"
}
```

Unlabeled filler uses the same shape with an empty `label`.

## Workflow

1. Normalize provider output into the timing-track segment schema.
2. Sort and normalize segments.
3. Insert filler where needed to preserve complete coverage.
4. Split phrase cues at structure boundaries.
5. Write or update only app-owned `XD:` tracks in xLights.
6. Preserve non-`XD:` user tracks.
7. Read app-owned tracks back from xLights after user review/edit.
8. Store generated `source`, current `userFinal`, and normalized `diff`.
9. Expose reviewed timing artifacts to designer and sequencer workflows.

## Diff Classification

Timing diff entries should classify:

- `unchanged`
- `moved`
- `relabeled`
- `added_by_user`
- `removed_from_source`

Diff behavior must preserve the original source track and user-reviewed final track.

## Validation

The timing workflow should be validated on a small representative control set:

- synced-lyrics vocal
- plain-phrase-fallback vocal
- vocal audio-only
- instrumental

Validation must prove:

- normalized tracks are complete coverage
- xLights writes do not create duplicate or overlapping marks
- readback preserves user edits
- diff output is stable and reviewable
- sequencer handoff can consume reviewed timing tracks

Contract-level control-set validation is scripted in:

- `apps/xlightsdesigner-ui/eval/run-timing-track-control-validation.mjs`

Live xLights roundtrip validation remains required before broadening the timing-track family.

## Expansion Rule

Do not broaden into additional timing-track types until `XD: Song Structure` and `XD: Phrase Cues` are stable through live write, review, readback, and diff validation.

Next approved expansion after that:

1. `XD: Beats`
2. `XD: Bars`

Deferred until this workflow is stable:

- broader audio heuristic tuning
- broad xLights visual validation across the corpus
- sequence-agent effect training driven by new timing layers
- larger multi-agent workflow changes

## Related Specs

- `timing-track-taxonomy-and-sequencing-uses.md`
- `provider-framework.md`
- `../sequence-agent/sequencing-system.md`
