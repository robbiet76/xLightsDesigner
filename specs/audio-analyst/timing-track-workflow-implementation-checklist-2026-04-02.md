# Timing Track Workflow Implementation Checklist

Owner: xLightsDesigner Team  
Date: 2026-04-02  
Status: Active

## Goal

Turn current audio analysis output into a stable timing-track workflow that:

1. writes generated timing tracks into xLights
2. preserves full coverage with no gaps or overlaps
3. captures user edits back from xLights
4. stores `source`, `userFinal`, and `diff`
5. becomes the sequencing substrate for later sequencer-agent work

This phase should complete before returning to broader sequencer-agent effect training.

## Scope

Initial track scope:

1. `XD: Song Structure`
2. phrase-level track
   - working name to finalize during implementation
   - examples:
     - `XD: Lyrics Phrases`
     - `XD: Phrase Timing`

Later tracks are out of scope for the first implementation slice:

- beats
- bars
- chords
- lyrics word/phoneme timing

## Non-Negotiable Rules

All generated timing tracks must satisfy:

1. first segment starts at `0`
2. last segment ends at song end
3. no gaps
4. no overlaps
5. segments are ordered
6. phrase segments never cross song-structure boundaries
7. where no logical phrase exists, use unlabeled filler segments

This means even phrase-level tracks are written as complete-coverage timing tracks.

## Track Semantics

### `XD: Song Structure`

- complete coverage track
- labels are high-level sections
- examples:
  - `Intro`
  - `Verse`
  - `Chorus`
  - `Bridge`
  - `Outro`
  - `Theme`
  - `Contrast`
  - `Refrain`

### Phrase-Level Track

- complete coverage track
- phrase segments are children of structure segments
- unlabeled filler is used where no phrase should exist
- phrase segments must not cross structure boundaries

## Data Contract

Every generated timing track should carry:

1. `trackType`
2. `trackName`
3. `coverageMode`
   - currently always `complete`
4. `source`
5. `userFinal`
6. `diff`
7. provenance metadata

Required segment shape:

```json
{
  "startMs": 0,
  "endMs": 1000,
  "label": "Verse 1"
}
```

Unlabeled filler shape:

```json
{
  "startMs": 1000,
  "endMs": 2000,
  "label": ""
}
```

## Execution Order

### Phase 1: Contract And Normalization

Implement the timing-track contract and normalization rules before xLights writes.

Checklist:

- [ ] define normalized timing-track schema in code
- [ ] define provenance schema for generated tracks
- [ ] define diff schema for `source -> userFinal`
- [ ] implement segment sort/normalize utility
- [ ] implement no-gap/no-overlap coverage normalizer
- [ ] implement filler insertion for uncovered ranges
- [ ] implement phrase splitting at structure boundaries
- [ ] add invariant tests for all normalization rules

Exit criteria:

- a malformed track can be normalized into full contiguous coverage
- phrase output cannot overlap two structure segments
- normalization tests pass

### Phase 2: `XD: Song Structure` Write Path

Implement the first end-to-end owned timing track.

Checklist:

- [ ] define ownership/naming policy for `XD:` timing tracks
- [ ] write `XD: Song Structure` into xLights
- [ ] replace/update only app-owned `XD:` structure track
- [ ] do not overwrite non-`XD:` user tracks
- [ ] validate written marks match normalized source segments

Exit criteria:

- one analyzed track can produce `XD: Song Structure` in xLights
- full coverage is preserved after write
- no duplicate or overlapping written marks

### Phase 3: Readback And Provenance

Capture user-edited timing state back from xLights.

Checklist:

- [ ] read `XD: Song Structure` back from xLights
- [ ] normalize imported marks into the same internal segment schema
- [ ] store generated `source`
- [ ] store current `userFinal`
- [ ] compute normalized `diff`
- [ ] classify diff entries:
  - [ ] `unchanged`
  - [ ] `moved`
  - [ ] `relabeled`
  - [ ] `added_by_user`
  - [ ] `removed_from_source`

Exit criteria:

- a user can edit `XD: Song Structure` in xLights
- readback captures those edits accurately
- diff is persisted without losing the original source track

### Phase 4: Phrase-Level Track

Only after `XD: Song Structure` is stable.

Checklist:

- [ ] finalize phrase track name
- [ ] normalize phrase output into complete coverage
- [ ] ensure phrase segments stay inside structure segments
- [ ] write phrase track into xLights
- [ ] read phrase track back from xLights
- [ ] store `source/userFinal/diff`

Exit criteria:

- phrase track writes cleanly
- phrase track readback matches edits
- phrase boundaries never cross structure boundaries

### Phase 5: Validation Harness

Create a repeatable validation loop around timing tracks.

Control set:

1. one synced-lyrics vocal track
2. one plain-phrase-fallback track
3. one vocal audio-only track
4. one instrumental track

Checklist:

- [ ] choose the 4 control tracks
- [ ] write timing tracks into xLights
- [ ] review timing visually in xLights
- [ ] edit timing manually
- [ ] read user-final timing back
- [ ] verify diff correctness
- [ ] record findings in a repeatable validation artifact

Exit criteria:

- all 4 tracks complete the full loop
- no data loss between source and user edits
- diff is stable and reviewable

## Recommended Initial Control Set

Suggested starting set:

1. synced-lyrics vocal:
   - `02 Candy Cane Lane.mp3`
2. plain-phrase-fallback vocal:
   - `Christmas Vacation - Mavis Staples.mp3`
3. vocal audio-only:
   - `Grinch.mp3`
4. instrumental:
   - `Christmas Sarajevo.mp3`

## Deferred Until After Timing-Track Phase

Do not broaden into these until the timing-track workflow is stable:

- more audio heuristic tuning
- broad xLights visual validation across the whole corpus
- sequencer-agent effect training
- larger multi-agent workflow changes

## Definition Of Done For This Phase

This timing-track phase is complete when:

1. `XD: Song Structure` works end to end
2. phrase-level track works end to end
3. both tracks are complete-coverage with no gaps or overlaps
4. user edits are read back and diffed against source
5. the sequencer agent can consume these tracks as stable input

At that point, return to sequencer-agent training and effect implementation work.
