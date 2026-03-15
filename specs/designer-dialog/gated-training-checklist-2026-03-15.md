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

Current execution status:
- automated baseline validation completed on 2026-03-15:
  - `designer-dialog` tests: passing
  - `app-assistant` tests: passing
  - `sequence-agent` tests: passing

Required:
- [ ] confirm UI/workflow is stable enough for training validation sessions
- [ ] confirm direct technical sequencing path still works in a real xLights session
- [ ] confirm designer cloud seam and local normalization/fallback still work in a real designer-led session
- [x] confirm current test baseline is green for:
  - designer-dialog tests
  - app-assistant tests
  - sequence-agent tests

Exit gate:
- training work can proceed without concurrent major UI/runtime instability

## Stage 1: Minimum Viable Designer Skill

Goal:
- teach the designer the minimum needed to handle simple broad creative prompts credibly

Current execution status:
- Stage 1 baseline prompt seed created:
  - [stage1-minimum-viable-designer-prompts-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/stage1-minimum-viable-designer-prompts-2026-03-15.md)
- Stage 1 few-shot and eval cases added to the active training assets
- Stage 1 automated contract suite added:
  - [stage1-minimum-viable.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/designer-dialog/stage1-minimum-viable.test.js)
- Stage 1 fixture vocabulary now uses real `HolidayRoad` layout models from persisted app state:
  - `Border-01`
  - `Outlines`
  - `CandyCanes`
  - `SpiralTrees`
  - `Snowflakes`
  - `PorchTree`
  - `Snowman`
  - `NorthPoleMatrix`

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
- [x] 5 simple designer prompts tested through the automated orchestration/contract suite
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

Current execution status:
- Stage 2 prompt seed created:
  - [stage2-scene-aware-prompts-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/stage2-scene-aware-prompts-2026-03-15.md)
- Stage 2 metadata prompt seed created:
  - [stage2-metadata-aware-prompts-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/stage2-metadata-aware-prompts-2026-03-15.md)
- Stage 2 automated contract suite added:
  - [stage2-scene-aware.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/designer-dialog/stage2-scene-aware.test.js)
- Stage 2 metadata-aware contract suite added:
  - [stage2-metadata-aware.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/designer-dialog/stage2-metadata-aware.test.js)
- Stage 2 baseline automated validation passing on 2026-03-15:
  - real named target emphasis
  - foreground/background reasoning
  - left/right reasoning
  - output changes when scene context changes
  - tag-aware semantic reasoning from metadata assignments
  - output changes when metadata assignments change

Scope:
- model/group/submodel awareness
- focal vs broad coverage reasoning
- left/right/foreground/background reasoning where appropriate
- metadata-tag semantic awareness where tags exist

Implementation:
- [ ] add targeted few-shot/eval cases that require use of `design_scene_context_v1`
- [ ] add targeted few-shot/eval cases that require use of metadata tag semantics
- [ ] verify designer references valid targets and valid scene structure
- [ ] verify designer can use metadata tags as semantic context instead of only UI-selected filters
- [ ] verify designer does not invent missing layout elements

Validation:
- [x] test prompts such as:
  - focal-object emphasis
  - broad coverage vs focal isolation
  - left/right or foreground/background direction
- [x] test prompts such as:
  - character vs support tagged props
  - lyric vs rhythm tagged props
- [x] confirm output changes when scene context changes
- [x] confirm output changes when metadata assignments change

Do not proceed if:
- designer ignores the scene context
- designer ignores metadata semantics
- designer invents nonexistent targets
- scene-aware reasoning is cosmetic rather than real

Exit gate:
- designer demonstrates real scene-aware design reasoning

## Stage 3: Music-Aware Design

Goal:
- ensure the designer actually reasons from musical structure, not just prompt text

Current execution status:
- Stage 3 prompt seed created:
  - [stage3-music-aware-prompts-2026-03-15.md](/Users/robterry/Projects/xLightsDesigner/specs/designer-dialog/stage3-music-aware-prompts-2026-03-15.md)
- Stage 3 automated contract suite added:
  - [stage3-music-aware.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/agent/designer-dialog/stage3-music-aware.test.js)
- Stage 3 baseline automated validation passing on 2026-03-15:
  - intro restraint vs chorus reveal
  - verse lyric emphasis vs chorus lift
  - output changes when reveal structure changes

Scope:
- chorus/verse/bridge handling
- reveal/hold behavior
- energy and pacing awareness

Implementation:
- [ ] add targeted few-shot/eval cases that require use of `music_design_context_v1`
- [ ] verify designer maps ideas to musical structure credibly
- [ ] verify designer uses hold/reveal/restraint/escalation in sensible ways

Validation:
- [x] test prompts tied to chorus focus, impact moments, holds, and transitions
- [x] confirm proposal behavior changes when the music context changes

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
