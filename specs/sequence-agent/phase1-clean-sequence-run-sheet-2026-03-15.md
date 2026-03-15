# Phase 1 Clean Sequence Run Sheet (2026-03-15)

Status: Ready to run
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: execute the first clean-sequence validation pass against simple explicit technical prompts.

## Setup

Before starting:
- complete the audio validation passes first
- create a new blank validation sequence in xLights
- make sure the correct song/media is attached
- make sure the expected timing sections exist, or note clearly if they do not
- use `Reset Project Workspace` before beginning the run
- open the new blank sequence in xLightsDesigner

Upstream references:
- [audio-analysis-validation-plan-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/audio-analyst/audio-analysis-validation-plan-2026-03-15.md)
- [audio-handoff-validation-plan-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/audio-analyst/audio-handoff-validation-plan-2026-03-15.md)

Recommended sequence name:
- `Validation-Clean-Phase1`

## Operating Rule

Run one prompt at a time.

For each prompt:
1. send the prompt in `Design Team Chat`
2. confirm it routes to Patch
3. inspect `Sequence`
4. inspect `Review`
5. apply if the draft looks correct
6. inspect xLights directly
7. record the result before moving to the next prompt

If a prompt fails:
- stop
- record the defect
- do not proceed to the next prompt until the defect is understood

## Prompt 1

Prompt:
- `Add a Color Wash effect on Snowman during Chorus 1.`

Expected:
- route: `sequence_agent`
- target: `Snowman`
- section: `Chorus 1`
- effect: `Color Wash`
- no unrelated targets
- no unrelated extra effects

## Prompt 2

Prompt:
- `Add a Shimmer effect on SpiralTrees during the Intro.`

Expected:
- route: `sequence_agent`
- target: `SpiralTrees`
- section: `Intro`
- effect: `Shimmer`
- no unrelated targets
- no unrelated extra effects

## Prompt 3

Prompt:
- `Add an On effect on NorthPoleMatrix for 5 seconds from the start.`

Expected:
- route: `sequence_agent`
- target: `NorthPoleMatrix`
- time window: first 5 seconds
- effect: `On`
- no unrelated targets
- no unrelated extra effects

## Record Format

For each prompt, record:
- `Prompt`
- `Route`
- `Pass/Fail`
- `Sequence view`
- `Review view`
- `xLights result`
- `Failure category`
- `Notes`

## Exit Gate

Phase 1 passes only if all three prompts:
- route correctly
- generate the correct basic target/effect scope
- review correctly
- apply correctly
- and match what appears in xLights
