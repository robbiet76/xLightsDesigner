# Audio Analysis Validation Plan (2026-03-15)

Status: Planned
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: validate Lyric's analysis quality, artifact generation, and conversational usefulness before designer and sequencing validation depends on it.

## Why This Comes First

Audio analysis is upstream context.

Before validating:
- designer music-aware reasoning
- section-aware sequencing
- clean-sequence creation against song structure

we need to know that Lyric's analysis output is credible and usable.

## Preconditions

- xLights is running and connected
- target song/media is selected
- app opens cleanly
- current project is loaded
- `Reset Project Workspace` has been used before the run

## Phase 1: Artifact Baseline

Goal:
- prove that analysis runs and produces a usable artifact

Check:
- analysis executes successfully
- `analysis_artifact_v1` is created
- sections, beats, and bars appear credible
- audio page updates coherently
- downstream `music_design_context_v1` can be derived

Record:
- media file
- provider used
- pass/fail
- artifact summary
- obvious structural errors

## Phase 2: Conversational Audio Validation

Goal:
- prove Lyric can participate directly in team chat as an audio specialist

Prompt examples:
1. `Lyric, analyze this song and tell me where the main sections are.`
2. `Lyric, where does the first real lift happen in this song?`
3. `Lyric, what parts of this track should hold back versus open up?`

Inspect:
- routes to Lyric
- response is music-analysis-focused, not design-focused
- response is concrete and useful
- no generic filler

## Phase 3: Audio-To-Context Validation

Goal:
- prove Lyric's output contributes usable context for later stages

Inspect:
- section naming is consistent enough for designer and sequencer use
- identified chorus/intro/verse boundaries are coherent
- handoff context on `Design` and `Sequence` reflects the analyzed structure

## Failure Categories

Use:
- `analysis_failed`
- `artifact_incomplete`
- `sections_not_credible`
- `beats_bars_not_credible`
- `wrong_route`
- `conversation_not_useful`
- `downstream_context_incoherent`

## Exit Gate

Do not proceed to clean-sequence creation validation until:
- Lyric can analyze the chosen song credibly
- Lyric can discuss the song credibly in chat
- the resulting analysis context is usable downstream
