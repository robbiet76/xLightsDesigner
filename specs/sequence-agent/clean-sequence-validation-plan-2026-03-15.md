# Clean Sequence Validation Plan (2026-03-15)

Status: Planned
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: validate actual sequence creation quality in xLights using a clean blank sequence so we can inspect what Patch creates without contamination from prior work.

## Why A Clean Sequence

We need a controlled environment for creation-quality validation.

Using an existing worked sequence makes it harder to tell:
- what was newly created
- what was already present
- whether layering and timing are actually correct
- whether the design intent translated cleanly into new effect creation

This validation track is separate from conversational quality.

It depends on upstream audio validation.

## Preconditions

- xLights is running and connected
- audio analysis validation has already been completed for the chosen song
- the layout is loaded correctly
- a clean new blank sequence is created specifically for validation
- the media/song for the validation pass is selected
- timing tracks are in a known state before generation begins
- app starts cleanly and the current project is loaded

Required upstream references:
- [audio-analysis-validation-plan-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/audio-analyst/audio-analysis-validation-plan-2026-03-15.md)
- [audio-handoff-validation-plan-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/audio-analyst/audio-handoff-validation-plan-2026-03-15.md)

## Operating Rule

Do not expand prompt complexity until the current step passes.

For each validation step:
- create or reset to a known clean sequence state
- run the exact prompt
- inspect Sequence, Review, and xLights
- record pass/fail and the specific defect
- do not proceed if the current level is not reliable

## Validation Goals

We are validating:
- timing-track validation correctness
- timing-track creation/update correctness
- target selection correctness
- section/timing placement correctness
- effect-name correctness against the real xLights catalog
- effect creation volume and readability
- whether generated changes are musically and visually sensible
- whether generated timing assets are present before effect creation
- whether applied changes in xLights match the reviewed intent

We are not validating:
- broad designer conversation quality
- long multi-turn design collaboration
- preference learning behavior

## Core Sequencer Rule

Patch must validate required timing assets before effect creation.

For any request that depends on sections, beats, bars, or explicit timing structure:
1. validate whether the required timing tracks and marks already exist
2. create or refresh the required timing tracks if they are missing or stale
3. only then create effects anchored to those timing assets

This is required for the clean-sequence validation track.

## Phase 1: Minimal Direct Technical Creation

Goal:
- prove Patch can create simple explicit changes correctly in a blank sequence
- prove Patch validates and creates required timing assets before effect creation

Prompt examples:
1. `Add a Color Wash effect on Snowman during Chorus 1.`
2. `Add a Shimmer effect on SpiralTrees during the Intro.`
3. `Add an On effect on NorthPoleMatrix for 5 seconds from the start.`

Inspect:
- correct route to Patch
- required timing tracks are validated
- section/timing tracks are created or refreshed when needed
- timing assets appear before or alongside effect creation in the reviewed plan
- correct target
- correct section or explicit time window
- correct effect name
- no unrelated targets
- no unrelated extra effects

Exit gate:
- all prompts create the expected timing assets and basic effect writes cleanly

## Phase 2: Scoped Multi-Target Creation

Goal:
- prove Patch can handle small explicit multi-target requests without over-expanding scope

Prompt examples:
1. `Add a Color Wash effect on Snowman and SpiralTrees during Chorus 1.`
2. `Add Shimmer on Snowflakes and PorchTree during the Intro.`

Inspect:
- each requested target appears
- only requested targets appear
- section placement is correct
- effect choice remains correct across all requested targets
- timing assets remain valid and are not duplicated incorrectly

Exit gate:
- Patch handles explicit multi-target scope cleanly and predictably

## Phase 3: Direct Requests With Simple Styling Constraints

Goal:
- verify that explicit technical requests with light styling language still create reviewable effects

Prompt examples:
1. `Add a warm Color Wash on Snowman during Chorus 1.`
2. `Add a subtle Shimmer on SpiralTrees during the Intro.`

Inspect:
- effect remains the requested real xLights effect
- styling adjectives do not cause invalid effect substitution
- generated result still looks reasonable in xLights
- timing asset behavior remains correct

Exit gate:
- style modifiers influence settings/intent without breaking effect selection

## Phase 4: Design-To-Sequence Translation On A Clean Sequence

Goal:
- validate that a designer-led prompt can translate into sensible first-pass created effects in a blank sequence

Prompt examples:
1. `Make the Snowman the focal point in each chorus while the SpiralTrees stay supporting.`
2. `Keep the intro calm, then let Chorus 1 open up with a stronger reveal.`

Inspect:
- Design dashboard reflects the requested intent
- Sequence dashboard reflects a sensible translation
- timing assets needed by the translation are created first
- xLights result matches the reviewed direction at a first-pass level
- creation volume is not excessive or chaotic

Exit gate:
- first-pass designer-to-sequence translation is visibly coherent in xLights

## Inspection Checklist For Each Apply

Record:
- prompt used
- route used
- sequence name
- timing track used
- timing tracks created or updated
- targets touched
- effect names created
- sections affected
- whether apply succeeded
- whether xLights result matches Review
- whether xLights result matches the intended design
- defect summary if failed

## Failure Categories

Use these categories:
- `wrong_route`
- `missing_timing_track`
- `wrong_timing_track`
- `wrong_target`
- `wrong_section`
- `wrong_effect`
- `scope_overexpanded`
- `scope_underapplied`
- `too_many_effects`
- `too_few_effects`
- `review_did_not_match_apply`
- `xlights_result_did_not_match_review`
- `visually_unusable`

## Recommended Next Step

Start with Phase 1 only.

Do not move to Phase 2 until:
- the simple explicit single-target prompts are consistently correct
- the required timing tracks are created or validated correctly
- the created effects can be inspected cleanly in xLights
- Review and xLights stay aligned
