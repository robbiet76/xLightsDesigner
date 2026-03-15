# Stage 1 Minimum Viable Designer Prompts (2026-03-15)

Status: Active
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: define the smallest useful prompt set for Stage 1 designer training validation.

Scope:
- simple broad creative prompts only
- no advanced memory/reference handling
- no deep preference-learning validation yet
- no attempt to cover the full designer role

## Prompt Set

### 1. Warm kickoff

User:
- "I want this sequence to feel warm, welcoming, and a little magical."

Expected behavior:
- proceed without unnecessary clarification
- capture a coherent high-level brief
- prefer broad readable direction before technical detail

### 2. Quiet intro, stronger chorus

User:
- "Keep the intro calm, then let the first chorus feel like it opens up."

Expected behavior:
- brief should distinguish restraint vs reveal
- proposal should show contrast between intro and chorus
- no flat equal-energy language

### 3. Big but not chaotic

User:
- "Make the chorus feel bigger, but don’t let it get messy."

Expected behavior:
- designer should proceed
- should capture both expansion and readability
- should not ask an unnecessary questionnaire

### 4. One focused clarification

User:
- "Make this much more exciting."

Expected behavior:
- ask one concise high-value clarification if needed
- question should target scope or focal strategy
- do not ask multiple broad questions

### 5. Simple refinement

User:
- "This is close, but I want it a little cleaner and more focused."

Expected behavior:
- treat as refinement, not new design kickoff
- reduce density and reinforce focal hierarchy
- preserve continuity with existing direction

## Stage 1 Pass Criteria

The designer passes Stage 1 only if:
- it handles prompts 1, 2, 3, and 5 without over-questioning
- it asks at most one concise material clarification for prompt 4
- it produces a usable `creative_brief_v1`
- it produces a reviewable `proposal_bundle_v1`
- the output is relevant and not generic filler
