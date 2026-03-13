# Designer Dialog Training Plan (2026-03-13)

Status: Active
Date: 2026-03-13
Owner: xLightsDesigner Team

Purpose: define the next implementation phase for `designer_dialog` training so it can mature from a structurally sound runtime into a real conversational creative specialist.

## 1) Objective

Train `designer_dialog` to:
- handle rich director-style conversation
- make bounded creative assumptions
- ask only high-value clarification questions
- synthesize strong `creative_brief_v1`
- generate coherent `proposal_bundle_v1`
- balance stable design principles with learned director preferences
- hand off consistent, reviewable sequencing intent to `sequence_agent`

## 2) Locked Training Boundary

`designer_dialog` must learn from two separate inputs:

### A. Stable design-principles knowledge
Source of professional creative reasoning:
- artistic principles
- lighting design craft
- composition
- color theory
- pacing and rhythm
- focus and contrast
- reveal/layering logic

This corpus must remain:
- clean
- user-independent
- versioned deliberately

### B. Director preference knowledge
Source of user-specific soft steering:
- likes/dislikes
- motion density preference
- pacing preference
- focus preference
- palette tendencies
- complexity tolerance
- novelty tolerance

This must live in:
- `director_profile_v1`

It must remain:
- weighted
- explainable
- soft, not absolute

## 3) Training Workstreams

### Workstream 1: Core design conversation corpus

Build a curated set of director-style prompts and ideal designer responses.

Target examples:
- emotional / atmospheric prompts
- memory / nostalgia prompts
- vague but usable creative prompts
- iterative revision prompts
- conflict prompts where the designer must choose what to clarify

Each example should capture:
- user message(s)
- what assumptions are reasonable
- what clarification is necessary vs unnecessary
- what `creative_brief_v1` should contain
- what `proposal_bundle_v1` should contain

### Workstream 2: Preference-learning framework

Define how `director_profile_v1` should evolve from:
- accepted proposals
- rejected proposals
- repeated revisions
- explicit user statements

Initial requirement:
- do not auto-learn silently without traceability
- record evidence used to adjust preference weights

### Workstream 3: Runtime integration

Integrate profile-aware reasoning into `designer_dialog` runtime:
- input includes optional `director_profile_v1`
- brief/proposal records which preference signals influenced the pass
- preference influence stays subordinate to core design principles

### Workstream 4: Eval and regression

Add designer-specific evals that measure:
- clarification quality
- assumption quality
- brief coherence
- proposal coherence
- preference-aware behavior without stylistic collapse
- direct-vs-designer routing boundaries

## 4) Implementation Phases

### Phase A: Training architecture lock

- define `director_profile_v1` contract usage in runtime
- update designer training docs and prompts to reflect the two-bucket model
- ensure current few-shot/eval assets reference the split explicitly

Exit gate:
- the role boundary is explicit in training, contracts, and runtime assumptions

### Phase B: Conversational few-shot set

Create a first high-quality designer few-shot set covering:
- kickoff conversation
- broad creative request with bounded assumptions
- clarification round
- refinement pass
- preference-aware revision

Exit gate:
- a designer conversation can be demonstrated without collapsing into sequencing mechanics

### Phase C: Preference profile integration

- add `director_profile_v1` input plumbing to designer runtime
- add traceability fields showing which preferences influenced the output
- add tests proving preference influence is soft, not mandatory

Exit gate:
- profile-aware proposals are inspectable and bounded

### Phase D: Eval expansion

Add eval cases for:
- broad prompt with no unnecessary clarification
- ambiguous prompt with necessary clarification
- preference-aware proposal steering
- novelty preservation despite strong preferences
- direct technical request routed away from designer when appropriate

Exit gate:
- designer quality can be measured repeatedly

## 5) Inputs Needed From Product/Director

Most useful inputs:

1. Realistic director prompts
- 10-20 examples of how a real user would talk

2. Good-response expectations
- what a strong designer reply should do
- what assumptions it should make
- what it should ask
- what it should avoid

3. Preference dimensions that matter most
- motion density
- pacing
- focus
- palette tendencies
- complexity tolerance
- novelty tolerance

4. Hard design principles
- broad coverage before refinement
- preserve readability
- avoid unnecessary clutter
- align with timing where practical
- use layering efficiently

## 6) Non-Goals

- training the designer to clone legacy sequence style
- teaching effect-library semantics here instead of in `sequence_agent`
- replacing the direct technical sequencing path
- autonomous apply behavior

## 7) Recommended Immediate Next Slice

1. Update the designer training prompt and few-shot/eval assets to explicitly use the two-bucket model.
2. Add `director_profile_v1` as optional context in the designer runtime contract.
3. Create the first curated conversational few-shot set centered on realistic director dialogue.
