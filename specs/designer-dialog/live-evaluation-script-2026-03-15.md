## Designer Live Evaluation Script

Date: 2026-03-15
Status: Active
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
- `Make the Snowman the focal point in each chorus while Border-01 stays supporting.`

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
- `Patch, add a green On effect to Border-01 for 10 seconds from the start.`

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
