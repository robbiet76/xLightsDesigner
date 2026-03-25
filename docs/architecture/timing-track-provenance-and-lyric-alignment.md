# Timing Track Provenance And Lyric Alignment

## Goal

Treat every generated timing track as a draft that can be improved by:

1. provider/source data
2. system fusion/alignment
3. user edits in xLights

The system should preserve user work, learn from corrections, and avoid pretending that generated timing is final truth.

## Scope

This model applies to all generated timing tracks:

- beats
- bars
- song structure
- phrase cues
- lyrics
- chords when represented as timing marks
- future timing-derived tracks

## Core Model

For each generated timing track, keep:

1. `source`
   - the generated marks we proposed from providers, fusion, or alignment
2. `userFinal`
   - the current marks present in xLights after user edits
3. `diff`
   - the normalized difference from `source -> userFinal`

This is intentionally not a full edit history.

## Track Record Shape

Suggested normalized shape:

```json
{
  "trackType": "lyrics",
  "trackName": "XD: Lyrics",
  "source": {
    "marks": [],
    "provenance": {
      "providers": ["lrclib", "lyricsgenius"],
      "generator": "phrase_alignment_v1",
      "generatedAt": "2026-03-25T18:00:00Z",
      "analysisRevision": "abc123"
    }
  },
  "userFinal": {
    "marks": [],
    "capturedAt": "2026-03-25T18:05:00Z"
  },
  "diff": {
    "summary": {
      "unchanged": 0,
      "moved": 0,
      "relabeled": 0,
      "addedByUser": 0,
      "removedFromSource": 0
    },
    "entries": []
  }
}
```

## Diff Semantics

Per mark, the first useful statuses are:

- `unchanged`
- `moved`
- `relabeled`
- `added_by_user`
- `removed_from_source`

That is enough to:

- protect user edits from regeneration
- measure source quality
- tune alignment and provider trust

## Why The Diff Matters

The diff is used for:

1. preserving user intent
   - regenerated timing should not blindly overwrite curated marks
2. feedback
   - repeated user movement of the same kind of mark is evidence the source is weak
3. provider trust
   - providers that are consistently corrected should lose confidence
4. training/evaluation
   - `source -> userFinal` is the best available supervision we will have

## Lyrics Strategy

### Provider Roles

`LRCLIB`

- first-pass synced lyric source
- high value when available
- low corpus coverage today

`LyricsGenius`

- plain-lyrics fallback only
- useful because corpus probe coverage is materially better than LRCLIB
- not sufficient by itself because it does not provide timing

### Current Provider Read

Current corpus probe on the reduced `43`-track set:

- raw Genius matches: `31/43`
- stricter high-confidence Genius matches: `26/43`

This is strong enough to justify phrase-alignment exploration, but not strong enough to trust without match gating.

### Match Gating Requirements

Plain-lyrics fallback should require:

1. strong title similarity
2. artist agreement when available
3. rejection of obviously generic/public-domain title collisions

Examples that need stronger skepticism:

- `Christmas Medley`
- `We Wish You a Merry Christmas`
- `Auld Lang Syne`
- custom intros/medleys

## Phrase Alignment Plan

### Why Phrase Alignment Instead Of Word Alignment

Phrase timing is enough for sequencing.

We do not need:

- karaoke-grade word timing

We do need:

- phrase or lyric-line windows that are musically useful

This lowers complexity and makes local alignment realistic.

### Inputs

Phrase alignment should consume:

1. plain lyric text
2. beat grid
3. bars
4. section backbone
5. optional synced lyric source when present for validation

### Expected Output

The aligner should emit:

- phrase windows
- confidence per phrase
- optional stanza grouping

Low-confidence phrases should be dropped instead of fabricated.

### Validation Plan

Use tracks where we already have timed LRCLIB lyrics as a reference set.

For that set:

1. fetch Genius plain lyrics
2. normalize stanza and phrase text
3. compare Genius phrases against the trusted timed source
4. only then prototype alignment

Candidate validation tracks:

- `Can't Stop The Feeling!`
- `Candy Cane Lane`
- `It's the Most Wonderful Time of the Year`
- `Run Run Rudolph`
- `Holiday Road`

## Implementation Order

### Phase 1

1. timing-track provenance data model
2. reusable `source -> userFinal -> diff` utility
3. xLights timing import capture for generated tracks

### Phase 2

1. Genius plain-lyrics evaluation and match gating
2. cross-source validation against LRCLIB-timed tracks

### Phase 3

1. phrase alignment prototype for a small clean vocal subset
2. confidence scoring
3. export aligned phrase marks as generated `source` timing

### Phase 4

1. feed user-final corrections back into evaluation
2. tune provider trust and alignment heuristics

## Non-Goals

Do not:

- fabricate timings from plain lyrics without alignment
- treat plain-lyrics providers as synced sources
- overwrite user-edited timing tracks as if generated timing were final truth

## Current Decision

Proceed with:

1. timing-track provenance for all generated timing tracks
2. Genius as a gated plain-lyrics evaluation source
3. phrase-alignment feasibility work only after cross-source validation on known-good timed tracks
