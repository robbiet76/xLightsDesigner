# Timing Track Taxonomy And Sequencing Uses

Owner: xLightsDesigner Team  
Date: 2026-04-05  
Status: Active

## Purpose

Define the full timing-track family that audio analysis should eventually support for sequencing.

This document exists to keep the current implementation work aligned with the real sequencing goal:

1. timing tracks are the contract between audio analysis and sequencing
2. different sequencing tasks need different musical timing layers
3. `XD: Song Structure` and phrase timing are only the first implementation slice, not the final scope

## Core Principle

Timing tracks should be designed as a family of sequencing-relevant musical layers.

Each timing-track type must have:

1. a clear musical meaning
2. a clear generation source
3. a clear sequencing use case
4. a clear review/provenance model
5. clear coverage rules

## Coverage Rules

All generated timing tracks should use the same normalization framework:

1. first segment starts at `0`
2. last segment ends at song end
3. no gaps
4. no overlaps
5. ordered segments only
6. unlabeled filler is allowed when no logical label should exist

Not every timing track is conceptually dense, but every generated `XD:` timing track should still be representable as complete coverage.

## Timing Track Types

### 1. `XD: Song Structure`

Purpose:
- macro musical form

Primary sequencing uses:
- section-scoped scene changes
- broad effect family shifts
- visual energy arc control
- revision boundaries

Expected source:
- structure analysis
- lyrics-backed semantic structure when available
- audio-only structural fallback when not

Coverage:
- complete coverage required

### 2. `XD: Phrase Cues`

Purpose:
- phrase-sized vocal or lyric timing regions

Primary sequencing uses:
- phrase accents
- vocal support effects
- call/response timing
- lyrical motion timing

Expected source:
- synced lyrics
- plain-lyrics phrase fallback

Constraints:
- phrase segments must not cross structure boundaries

Coverage:
- complete coverage required

### 3. `XD: Beats`

Purpose:
- pulse-level rhythmic grid

Primary sequencing uses:
- beat-synced chases
- strobes and hits
- motion pulse timing
- micro-rhythm-driven effects

Expected source:
- beat detection
- rhythm provider agreement logic

Coverage:
- complete coverage track using contiguous beat windows

### 4. `XD: Bars`

Purpose:
- measure-level rhythmic grouping

Primary sequencing uses:
- repeating pattern alignment
- resets and loops
- phrase container scaffolding
- symmetry and periodicity

Expected source:
- bar inference from beats + time signature

Coverage:
- complete coverage required

### 5. `XD: Downbeats`

Purpose:
- major rhythmic anchors inside beat/bar space

Primary sequencing uses:
- accent placement
- transition landings
- impact synchronization

Expected source:
- derived from bar structure
- optionally reinforced by accent detection later

Coverage:
- may be represented as complete coverage with unlabeled filler

### 6. `XD: Chords`

Purpose:
- harmonic region changes

Primary sequencing uses:
- color changes
- mood shifts
- tension/release visual language

Expected source:
- harmony/chord analysis

Coverage:
- complete coverage required

### 7. `XD: Energy`

Purpose:
- dynamic intensity contour over time

Primary sequencing uses:
- brightness shaping
- layer density control
- crescendo/decrescendo behavior

Expected source:
- energy/intensity analysis

Coverage:
- complete coverage required

### 8. `XD: Accents`

Purpose:
- sharp musical events and hits

Primary sequencing uses:
- flashes
- punches
- impact effects

Expected source:
- onset/accent analysis

Coverage:
- may be represented with unlabeled filler or as narrow windows

### 9. `XD: Repeats`

Purpose:
- recurring motifs or repeated musical material

Primary sequencing uses:
- visual motif reuse
- repetition-aware sequencing

Expected source:
- recurrence/repetition analysis

Coverage:
- complete coverage preferred if emitted

### 10. `XD: Sparse Windows`

Purpose:
- silence, breakdown, restraint, low-density passages

Primary sequencing uses:
- preventing over-sequencing
- preserving contrast

Expected source:
- energy + arrangement sparsity analysis

Coverage:
- complete coverage preferred if emitted

## Implementation Priority

### Phase 1: Contract-Proving Tracks

1. `XD: Song Structure`
2. `XD: Phrase Cues`

### Phase 2: Rhythm Tracks

1. `XD: Beats`
2. `XD: Bars`

### Phase 3: Expressive Tracks

1. `XD: Chords`
2. `XD: Energy`
3. `XD: Accents`

### Phase 4: Higher-Order Derived Tracks

1. `XD: Repeats`
2. `XD: Sparse Windows`

## Review And Provenance

Every generated timing-track type should eventually support:

1. `source`
2. `userFinal`
3. `diff`
4. review acceptance
5. stale detection

The current implementation already proves this model for:

1. `XD: Song Structure`
2. `XD: Phrase Cues`

Future timing tracks should reuse the same review contract rather than inventing a different one.

## Sequencer Consumption Expectations

The sequencer should eventually treat timing-track layers differently by task:

1. structure drives scene scope and major transitions
2. phrases drive vocal/lyric accents
3. beats drive pulse-level motion
4. bars drive pattern grouping and resets
5. chords drive harmonic color language
6. energy drives brightness/density
7. accents drive impact events

## Current Development Directive

Proceed with the current timing workflow, but interpret it as the first slice of a broader timing-track system.

Immediate implementation focus remains:

1. finish live validation of `XD: Song Structure`
2. finish live validation of `XD: Phrase Cues`
3. stabilize review/provenance on those tracks

After that, the next timing-track expansion should be:

1. `XD: Beats`
2. `XD: Bars`

That is the correct way to stay on track while preserving the full sequencing scope.
