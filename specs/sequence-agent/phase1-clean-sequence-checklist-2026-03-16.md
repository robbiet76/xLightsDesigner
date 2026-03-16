# Phase 1 Clean Sequence Checklist (2026-03-16)

Status: Ready to execute
Date: 2026-03-16
Owner: xLightsDesigner Team

Purpose: run the first clean-sequence technical validation pass in a fixed order with explicit stop gates.

## Preconditions

- xLights is running and connected
- project is open in xLightsDesigner
- chosen song/media is available in `Media Directory`
- audio analysis for that track already exists and is reusable

## Setup Checklist

1. Use `Reset Project Workspace`.
2. Create a new blank sequence in xLights.
3. Name it `Validation-Clean-Phase1`.
4. Attach the validated song/media to that sequence.
5. Open the new sequence in xLightsDesigner.
6. On `Project`, confirm:
   - correct project
   - correct show directory
   - correct media directory
   - active sequence is `Validation-Clean-Phase1`
7. On `Audio`, confirm:
   - correct audio track is selected
   - existing analysis is present
   - no rerun is needed
8. Confirm the analysis includes these sections:
   - `Intro`
   - `Chorus 1`
9. If any setup item fails, stop before Prompt 1.

## Prompt 1 Checklist

Prompt:
- `Add a Color Wash effect on Snowman during Chorus 1.`

Expected route:
- `sequence_agent`

Step checks:
1. Send the prompt in `Design Team Chat`.
2. Confirm Patch responds, not Mira or Lyric.
3. Confirm Patch reaches a terminal result message.
4. On `Sequence`, confirm:
   - target is `Snowman`
   - section is `Chorus 1`
   - effect is `Color Wash`
   - no unrelated targets appear
5. On `Review`, confirm:
   - pending snapshot matches the sequence draft
   - pending change list is coherent
   - required timing tracks/marks are being validated or created before effect creation
6. Apply the change.
7. In xLights, confirm:
   - required timing tracks exist for the request
   - section marks are present where expected
   - effect exists on `Snowman`
   - effect lands during `Chorus 1`
   - effect is `Color Wash`
   - no unrelated writes were added
8. Record the result.

## Result Record

- `Prompt:`
- `Route:`
- `Pass/Fail:`
- `Sequence view:`
- `Review view:`
- `xLights result:`
- `Failure category:`
- `Notes:`

## Stop Rule

- If Prompt 1 fails, stop.
- Do not continue to Prompt 2 until the failure is understood and fixed.
