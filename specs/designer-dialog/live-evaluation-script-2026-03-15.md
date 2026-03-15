## Designer Live Evaluation Script

Date: 2026-03-15
Status: Round 1 complete
Purpose: run a small real-session evaluation against the current app and record product-quality gaps after the baseline staged work is complete.

### Preconditions

- xLights is running and connected
- active sequence is valid and writable
- app opens cleanly
- current project/media/sequence context is selected
- chat, Design, Sequence, Review, and History pages load

### Evaluation Prompts

Run these in order in a real session.

1. Broad kickoff
- `I want this sequence to feel warm, welcoming, and a little magical.`

Expected:
- no unnecessary clarification
- Design dashboard updates coherently
- Sequence dashboard shows a plausible translation
- Review shows a coherent pending snapshot

2. Scene-aware prompt
- `Make the Snowman the focal point in each chorus while the SpiralTrees stay supporting.`

Expected:
- real layout targets only
- Design reflects focal/support logic
- Sequence reflects actual scoped targets

3. Music-aware prompt
- `Keep the intro calm, then let Chorus 1 open up with a stronger reveal.`

Expected:
- visible hold/reveal logic
- no generic flat treatment

4. Reference/memory prompt
- `I want this to feel like Christmas Eve when I was a kid: warm, quiet, and full of anticipation.`

Expected:
- designer uses the memory as real framing
- no vague poetic filler

5. Revision prompt
- `This is close, but make it a little cleaner and more focused.`

Expected:
- refinement, not restart
- narrower/cleaner direction is visible

6. Direct technical sequencing check
- `Add a Color Wash effect on Snowman during Chorus 1.`

Expected:
- routes to sequencer
- review/apply works
- effect is visible in xLights

### Record For Each Prompt

- route used:
  - cloud-normalized
  - local fallback
  - direct sequencer
- did the response feel credible
- did the Design dashboard update coherently
- did the Sequence dashboard update coherently
- did Review show a sane apply snapshot
- did apply succeed if tested
- observed failure or awkwardness

### Pass / Fail Rubric

Pass if:
- the app remains stable throughout
- the designer feels materially useful on the first five prompts
- the direct sequencer prompt applies correctly
- no major UX confusion blocks evaluation

Fail if:
- designer output is still too generic in live use
- cloud/local routing is unclear or unstable
- Review/apply is confusing or unreliable
- xLights write/apply path regresses

### Output Format For Notes

For each prompt, record:
- `Prompt`
- `Source`
- `Pass/Fail`
- `Observed behavior`
- `Gap`
- `Recommended follow-up`

## Round 1 Results

1. Broad kickoff
- Prompt: `I want this sequence to feel warm, welcoming, and a little magical.`
- Source: `designer_dialog`
- Pass/Fail: `Pass`
- Observed behavior: broad designer-led response, no stale `Border-01`, no stale `rainbow`, coherent design framing
- Gap: close still slightly procedural rather than fully natural
- Recommended follow-up: continue conversational polish for Mira closings

2. Scene-aware prompt
- Prompt: `Make the Snowman the focal point in each chorus while the SpiralTrees stay supporting.`
- Source: `designer_dialog`
- Pass/Fail: `Pass`
- Observed behavior: real target awareness, focal/support logic respected, no invented props
- Gap: earlier in the round Mira drifted into execution-forward wording; corrected by later bridge sanitization
- Recommended follow-up: keep validating scene-aware prompts against more layout targets

3. Music-aware prompt
- Prompt: `Keep the intro calm, then let Chorus 1 open up with a stronger reveal.`
- Source: `designer_dialog`
- Pass/Fail: `Pass`
- Observed behavior: hold/reveal logic was clear and musically aligned
- Gap: response tone was initially too execution-forward; corrected later in the round
- Recommended follow-up: improve naturalness of design-level follow-through

4. Reference/memory prompt
- Prompt: `I want this to feel like Christmas Eve when I was a kid: warm, quiet, and full of anticipation.`
- Source: `designer_dialog`
- Pass/Fail: `Pass`
- Observed behavior: good emotional framing, concrete palette/texture choices, no stale effect-name contamination
- Gap: closing still somewhat workflow-shaped instead of purely conversational
- Recommended follow-up: further polish designer chat voice

5. Revision prompt
- Prompt: `This is close, but make it a little cleaner and more focused.`
- Source: `designer_dialog`
- Pass/Fail: `Pass`
- Observed behavior: refinement preserved continuity and tightened the design appropriately
- Gap: same minor procedural closing tendency
- Recommended follow-up: continue conversational polish and refinement nuance

6. Direct technical sequencing check
- Prompt: `Add a Color Wash effect on Snowman during Chorus 1.`
- Source: `sequence_agent`
- Pass/Fail: `Pass`
- Observed behavior: routed directly to Patch, skipped Mira, skipped misleading shell/apply chatter, went straight into sequencing draft generation
- Gap: none in the chat-routing path for this prompt
- Recommended follow-up: broader direct technical prompt coverage against more real targets and effects

## Round 1 Conclusion

- Workflow stability is good enough for continued live evaluation.
- The major stale-context defects from earlier in the day are resolved:
  - stale target carryover
  - stale effect-name carryover
  - duplicate shell/agent chat noise
  - direct technical prompt misrouting
- The main remaining product gap is no longer architecture or routing.
- The main remaining gap is designer conversational polish, especially how Mira closes and carries design discussion forward naturally without sounding procedural.
