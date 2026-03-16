# Audio Page Audit And Refresh (2026-03-15)

Status: Active audit
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: audit the current `Audio` page against the newer `Design` and `Sequence` dashboard model, then define the refresh needed to make Lyric's workflow clear and useful.

## Executive Summary

The `Audio` page is now the weakest workflow page in the app.

It still reflects an older design model:
- artifact cards first
- pipeline-state dump second
- textarea summary block last

That no longer matches the product direction.

The correct model is:
- `Audio` should be Lyric's live workspace
- it should show media context, analysis readiness, structure summary, and downstream usefulness
- detailed pipeline/debug state should exist, but not dominate the page

## Current Problems

### 1. The page is artifact-heavy instead of workflow-heavy

Current top structure:
- journey card
- analysis artifact card
- pipeline artifact card
- inspect panel
- large analysis card

Problem:
- too much duplicated status
- too many separate surfaces for one concept
- no single obvious “main dashboard”

### 2. Pipeline implementation state is overexposed

Current page gives large visual weight to:
- service called
- service succeeded
- beat markers ready
- bar markers ready
- chord markers ready
- lyrics markers ready

Problem:
- useful for debugging
- not the primary thing a normal user needs
- should not visually outrank song structure or analysis conclusions

### 3. The summary is presented like editable scratch text

Current UI uses:
- textarea for analysis summary

Problem:
- this reads like manual note-taking
- but the actual purpose is to show Lyric's current interpretation
- should be presented as a read-oriented dashboard section, not a form field

### 4. The page does not clearly show downstream readiness

The user needs to know:
- is Lyric done enough for Mira and Patch to rely on this?

Current page does not make that obvious.

What should be visible:
- whether main sections are identified
- whether timing context is credible
- whether music context is usable downstream

### 5. Lyric is not visible enough as an active specialist

The page should make clear:
- what Lyric learned
- what musical cues matter
- what downstream design/sequence work can now rely on

Current page feels more like:
- an analysis service monitor

than:
- an audio specialist workspace

## What Still Has Value

Keep:
- media file context
- analyze/re-run action
- high-level analysis summary
- section structure
- BPM / meter / basic identity
- last analyzed time

Keep but reduce visual prominence:
- pipeline readiness details
- inspect detail views

## Recommended New Page Model

The refreshed `Audio` page should follow the same live-dashboard pattern as `Design` and `Sequence`.

### Top line

Keep:
- one-line page description

### Primary full-width dashboard

This should become the main content of the page.

Sections:
1. `Track Context`
- loaded media
- detected title/artist
- last analyzed

2. `Analysis Summary`
- Lyric's concise interpretation of the song
- presented as read-only summary text, not textarea

3. `Structure`
- main sections
- confidence/source
- quick visible section list

4. `Music Cues`
- where lift happens
- where hold/release happens
- notable pacing or lyric emphasis cues

5. `Downstream Readiness`
- whether design/sequence can rely on this pass
- what is still missing if incomplete

### Secondary compact cards

Use small supporting cards only for:
- `Analysis Service Status`
- `Pipeline Detail`

These should be secondary and collapsible/inspectable, not the main page focus.

## Proposed Information Hierarchy

1. loaded track
2. analysis conclusion
3. structure and cues
4. readiness for downstream work
5. operator/debug detail

That is the correct priority.

## UI Changes Recommended

### Remove / reduce

- separate large `Analysis Artifact` card
- separate large `Analysis Status` card
- large pipeline checklist list
- editable-looking summary textarea

### Add / change

- one full-width `Audio Analysis Dashboard`
- read-only `Analysis Summary` section
- compact `Structure` section with section chips or rows
- compact `Music Cues` section
- `Downstream Readiness` section
- smaller supporting service/pipeline card

## Product Rules

1. `Audio` is not just a debug page
- it is a real workflow page owned by Lyric

2. audio analysis should visibly contribute to the rest of the app
- the page should show why it matters for:
  - design
  - sequence

3. technical pipeline state must not dominate normal use
- keep it available
- keep it secondary

## Recommended Implementation Order

1. replace the textarea summary with a read-only dashboard section
2. collapse the current two large audio artifact/status cards into one primary dashboard
3. move pipeline detail into a smaller secondary support card
4. add a downstream-readiness section
5. validate the page against the Lyric conversation flow

## Exit Gate

The `Audio` page should clearly answer:
- what song is loaded
- what Lyric learned
- what structure/cues matter
- whether Mira and Patch can use this analysis now
