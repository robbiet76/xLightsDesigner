# Audio Conversation Handoff Validation Plan (2026-03-15)

Status: Planned
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: validate the conversational handoff chain from Lyric to Mira to Patch.

## Goal

Prove that:
- Lyric contributes real musical understanding
- Mira uses that understanding in design conversation
- Patch uses the resulting context in sequence creation

## Preconditions

- audio analysis validation has passed for the current song
- a clean sequence or known sequence context is loaded
- app dashboards are updating coherently

## Handoff Chain

1. User asks Lyric about the song
2. Lyric responds with section/energy guidance
3. Mira uses that guidance in design conversation
4. Patch uses the resulting intent in sequence translation

## Validation Script

### Step 1: Lyric

Prompt:
- `Lyric, analyze this song and tell me where Chorus 1 begins and where the first real lift happens.`

Expected:
- routed to Lyric
- identifies a plausible chorus and lift
- response is analysis-focused

### Step 2: Mira

Prompt:
- `Mira, keep the intro calm and let Chorus 1 open up with a stronger reveal.`

Expected:
- routed to Mira
- response reflects the analyzed structure
- response stays in design mode

### Step 3: Patch

Prompt:
- `Patch, add a Color Wash effect on Snowman during Chorus 1.`

Expected:
- routed to Patch
- section scope uses Chorus 1
- Sequence and Review reflect the same scope

## Inspect

For the full chain, verify:
- route is correct at each step
- no agent crosses role boundaries incorrectly
- analysis influences design
- design influences sequence
- no stale context or unrelated targets leak in

## Failure Categories

Use:
- `lyric_route_failure`
- `lyric_analysis_not_useful`
- `mira_ignored_audio_context`
- `mira_boundary_failure`
- `patch_ignored_audio_context`
- `handoff_context_lost`
- `stale_context_leak`

## Exit Gate

This handoff stage passes only if the chain:
- Lyric -> Mira -> Patch

feels coherent and traceable across the dashboards and resulting draft
