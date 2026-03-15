# Designer Dialog Gated Training Checklist (2026-03-15)

Status: Active
Date: 2026-03-15
Owner: xLightsDesigner Team

Purpose: implement and validate designer capability from the minimum viable baseline upward. Do not proceed to the next step until the current step is passing.

## Operating Rule

For every stage below:
- implement only the stated scope
- validate against the stated test cases
- document pass/fail
- do not proceed if the stage is not stable

This checklist is intentionally incremental. We are not trying to predict every training need up front. We are building the minimum necessary capability, then expanding based on observed gaps.

## Stage 0: Baseline Lock

Goal:
- freeze the current architecture and confirm the baseline is stable enough to begin capability training

Required:
- [ ] confirm UI/workflow is stable enough for training validation sessions
- [ ] confirm direct technical sequencing path still works
- [ ] confirm designer cloud seam and local normalization/fallback still work
- [ ] confirm current test baseline is green for:
  - designer-dialog tests
  - app-assistant tests
  - sequence-agent tests

Exit gate:
- training work can proceed without concurrent major UI/runtime instability

## Stage 1: Minimum Viable Designer Skill

Goal:
- teach the designer the minimum needed to handle simple broad creative prompts credibly

Scope:
- simple creative kickoff prompts
- simple section focus prompts
- simple mood/direction prompts
- bounded assumptions only
- no advanced memory/reference behavior yet

Implementation:
- [ ] create a compact curated prompt set for:
  - broad creative kickoff
  - simple direction refinement
  - simple “what should I do here?” prompts
- [ ] update prompt/few-shot assets only for this narrow baseline
- [ ] define expected `creative_brief_v1` outputs for these cases
- [ ] define expected `proposal_bundle_v1` qualities for these cases

Validation:
- [ ] 5-10 simple designer prompts tested end to end
- [ ] designer should ask only necessary clarification questions
- [ ] designer should produce a coherent brief
- [ ] proposal should be reviewable and relevant

Do not proceed if:
- designer over-questions
- designer gives generic filler
- brief/proposal does not materially reflect the prompt

Exit gate:
- designer handles simple broad prompts credibly

## Stage 2: Scene-Aware Design

Goal:
- ensure the designer actually uses the layout/model scene context

Scope:
- model/group/submodel awareness
- focal vs broad coverage reasoning
- left/right/foreground/background reasoning where appropriate

Implementation:
- [ ] add targeted few-shot/eval cases that require use of `design_scene_context_v1`
- [ ] verify designer references valid targets and valid scene structure
- [ ] verify designer does not invent missing layout elements

Validation:
- [ ] test prompts such as:
  - focal-object emphasis
  - broad coverage vs focal isolation
  - left/right or foreground/background direction
- [ ] confirm output changes when scene context changes

Do not proceed if:
- designer ignores the scene context
- designer invents nonexistent targets
- scene-aware reasoning is cosmetic rather than real

Exit gate:
- designer demonstrates real scene-aware design reasoning

## Stage 3: Music-Aware Design

Goal:
- ensure the designer actually reasons from musical structure, not just prompt text

Scope:
- chorus/verse/bridge handling
- reveal/hold behavior
- energy and pacing awareness

Implementation:
- [ ] add targeted few-shot/eval cases that require use of `music_design_context_v1`
- [ ] verify designer maps ideas to musical structure credibly
- [ ] verify designer uses hold/reveal/restraint/escalation in sensible ways

Validation:
- [ ] test prompts tied to chorus focus, impact moments, holds, and transitions
- [ ] confirm proposal behavior changes when the music context changes

Do not proceed if:
- music context is ignored
- output reads like generic design filler
- timing/section reasoning is not visible in the brief/proposal

Exit gate:
- designer demonstrates real music-structure-aware reasoning

## Stage 4: Clarification Discipline

Goal:
- teach the designer when to ask and when to proceed

Scope:
- missing but non-critical information should become explicit assumptions
- only materially blocking gaps should trigger clarification

Implementation:
- [ ] expand evals for clarification decisions
- [ ] add examples of:
  - proceed with bounded assumption
  - ask one focused question
  - avoid unnecessary questioning

Validation:
- [ ] run ambiguous prompt set
- [ ] confirm designer asks less, but asks better

Do not proceed if:
- designer asks broad vague questions
- designer stops unnecessarily
- designer hides key assumptions

Exit gate:
- clarification behavior is concise, useful, and disciplined

## Stage 5: Reference and Memory Prompt Handling

Goal:
- handle more natural director-style prompts involving memories, references, and emotional direction

Scope:
- nostalgia prompts
- emotional tone prompts
- inspiration/reference prompts
- still no attempt at style cloning

Implementation:
- [ ] build curated few-shot cases for:
  - memory-driven prompts
  - inspiration-driven prompts
  - emotionally indirect prompts
- [ ] add evals for coherent interpretation without over-literalism

Validation:
- [ ] test real director-style prompts from product usage
- [ ] confirm designer produces meaningful design framing rather than vague creative language

Do not proceed if:
- responses become poetic but unusable
- outputs lose connection to the actual sequence/design problem

Exit gate:
- designer can handle natural creative conversation credibly

## Stage 6: Conservative Preference Learning

Goal:
- make project-scoped preference memory useful without style lock-in

Scope:
- soft steering only
- project-level baseline only
- sequence-local feedback should not instantly become broad preference law

Implementation:
- [ ] validate `director_profile_v1` influence on proposals
- [ ] add tests for:
  - weak evidence
  - repeated evidence
  - explicit broad preference statements
  - sequence-local exceptions
- [ ] verify traceability of preference influence

Validation:
- [ ] compare proposals with and without profile signals
- [ ] confirm influence is visible but not dominant

Do not proceed if:
- proposals collapse into repeated style
- one sequence correction over-writes broader design behavior

Exit gate:
- preference memory is useful, conservative, and bounded

## Stage 7: Cloud-First Designer Confidence

Goal:
- make cloud-first designer behavior good enough to be the primary reasoning path

Scope:
- cloud reasoning primary
- local normalization/validation/fallback remains in place

Implementation:
- [ ] compare cloud-normalized output against local fallback for the staged prompt sets above
- [ ] improve prompt/eval assets based on observed failures
- [ ] confirm normalization does not strip the value out of good cloud outputs

Validation:
- [ ] run the staged prompt set through the cloud path
- [ ] confirm cloud materially outperforms fallback on conversational quality without harming artifact quality

Do not proceed if:
- cloud output is less reliable than local fallback
- normalization repeatedly loses intent or structure

Exit gate:
- cloud-first designer is trustworthy enough to be treated as the primary creative reasoning path

## Stage 8: Broader Capability Expansion

Goal:
- expand only after the baseline stages above are proven

Possible expansions:
- richer project/show preference modeling
- stronger sequence-local design memory
- more advanced reference-media use
- later node/strand-aware designer context where justified

Rule:
- do not start this stage until Stages 1-7 are working

## Validation Discipline

For each stage:
- record the test prompts used
- record pass/fail
- record observed failure modes
- only then update the training assets

This is not a one-pass checklist. It is an execution discipline.

## Immediate Next Step

Start with Stage 0 and Stage 1 only.

That means:
1. confirm the current baseline is stable
2. build the minimum viable designer training set for simple broad prompts
3. do not touch the more advanced stages until that basic capability works

