# Translation Layer Training Plan

Status: Active
Date: 2026-04-15
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-15

## Purpose

Keep the project focused on the real goal:

- `prompt -> physical animated light composition`

This spec exists to prevent the sequencing system from drifting into:

- effect-family stereotypes
- benchmark-specific patching
- brittle automation rules
- edge adjustments that do not improve the core translation layer

It should be updated as the system learns more about the medium.

## Project Thesis

xLights effects are not the goal.
They are the medium.

They are:

- brushes
- paint
- motion primitives
- texture tools
- transition and layering tools

The sequencer should learn how to use this medium to paint a requested animated picture in physical space.

It should not learn broad rules like:

- effect `X` always means mood `Y`
- effect `A` should never be used for prompt type `B`
- section type `C` only allows family `D`

Those kinds of rules may exist in narrow benchmark or safety contexts, but they must not become the project’s operating model.

## North Star

The target behavior is:

1. infer the intended visual story from the prompt
2. translate that intent into composition goals for physical props in space
3. choose motion, texture, hierarchy, color, layering, and transitions that realize that picture
4. express those choices through xLights effect families, parameters, palettes, and timing
5. validate the rendered result against the intended visual read

If a change does not improve one of those five steps, it should be treated as secondary work.

## Governing Rules

### 1. Translation First

The system should plan in terms of:

- visual intent
- composition
- motion behavior
- hierarchy
- pacing
- prop coordination

It should not start from:

- a fixed effect family choice
- a static effect-use rule table

### 2. Medium Knowledge, Not Stereotypes

Training should teach:

- what behaviors the medium can produce
- how geometry changes those behaviors
- how parameters, layering, blending, and transitions change the read

Training should not harden into:

- universal effect-family meanings
- universal forbidden-family rules

### 3. Narrow Rules Only

Hardcoded rules are allowed only when they are:

- safety guards
- schema normalization
- explicit benchmark assertions
- temporary scaffolding with a retirement plan

Heuristic rules must not become the primary translation strategy.

### 4. Validation Must Move Downward

Family-level effect checks are acceptable as coarse diagnostics.

The long-term validation target is behavior and composition:

- motion character
- restraint vs aggression
- texture vs burst
- hold vs movement
- lead/support/background roles
- section development
- cross-prop coordination

### 5. Rendered Output Is The Truth

Command generation is not enough.

The system only improves as a translation layer when the rendered output can be compared to the intended read.

That makes render observation and critique part of the core path, not optional extras.

## Target Architecture

The desired planning and learning stack is:

1. prompt intent inference
2. translation-intent model
3. behavior selection
4. xLights realization
5. render-feedback validation
6. outcome learning

### 1. Prompt Intent Inference

Interpret prompts in terms of:

- focus
- hierarchy
- motion character
- texture
- density
- pacing
- contrast
- development over time

### 2. Translation-Intent Model

Convert prompt intent into section and prop composition goals:

- which props lead
- which props support
- which props stay quiet
- what role the section plays
- how the section should evolve

### 3. Behavior Selection

Choose desired visual behaviors before choosing xLights tools.

Examples:

- steady hold
- restrained shimmer texture
- radial spin
- radial burst
- segmented chase
- broad wash
- smooth drift
- accent pulse

### 4. xLights Realization

Only after behavior selection, choose how to realize that behavior using:

- effect family
- effect settings
- palette
- transitions
- blending
- layer method
- timing placement

Multiple realizations may be valid for the same behavior.

### 5. Render-Feedback Validation

Compare the intended translation behavior to:

- render observation
- render critique
- artistic goal alignment
- revision objective alignment

### 6. Outcome Learning

Feed real rendered outcomes back into:

- behavior priors
- realization ranking
- composition priors
- revision planning

## Visual Behavior Vocabulary

The project needs a canonical visual vocabulary shared across:

- prompt interpretation
- planning
- training
- critique
- validation

This vocabulary should become the main intermediate language of the translation layer.

Minimum categories:

### Motion

- hold
- drift
- sweep
- chase
- pulse
- burst
- spin
- shimmer
- ripple

### Texture

- smooth
- diffuse
- sparkling
- segmented
- solid
- banded
- fragmented

### Energy

- restrained
- moderate
- aggressive

### Coverage

- isolated
- focused
- broad
- full

### Hierarchy

- lead
- support
- background
- accent

### Transition Character

- gentle
- dissolving
- directional
- hard
- stepping

This vocabulary does not need to be complete immediately, but new training and validation work should move toward it.

## Training Direction

### What To Preserve

These are aligned with the translation-layer goal and should remain foundational:

- motion-aware effect screening
- geometry-aware effect records
- parameter differentiation evidence
- shared setting learning
- bounded parameter priors
- bounded shared-setting priors

### What To Reframe

These should be reorganized around behavior capability rather than effect identity alone:

- effect-family selection priors
- parameter priors
- shared-setting priors
- live outcome memory

The question should become:

- what visual behaviors can this combination produce?

Not:

- where should this effect family be used?

### What To Derive Next

From the existing training corpus, derive:

- motion behavior profiles
- texture behavior profiles
- energy profiles
- coverage profiles
- geometry sensitivity
- configuration representativeness

## Validation Direction

### Current Role Of Family-Level Benchmarks

Family-level scenario assertions are still useful as coarse diagnostics.

They help detect:

- obvious semantic misses
- contradictory effect-family choices
- prompt disobedience

But they are not the long-term definition of translation quality.

### Long-Term Validation Target

Validation should increasingly score:

- intended behavior vs observed behavior
- intended hierarchy vs observed hierarchy
- intended section role vs observed section role
- section development over time
- cross-prop coordination

### Forbidden Effect Guidance

`forbiddenEffects` in benchmarks must be treated as:

- scenario-specific contradiction checks

They must not be treated as:

- universal rules about what a family can or cannot do

If a benchmark relies heavily on broad family bans, it should be treated as overly rigid and revised.

## Composition Direction

The project must move beyond single-effect correctness.

The true target is coordinated composition across:

- props
- layers
- sections
- transitions between sections

That means the system ultimately needs to learn:

- lead/support/background role assignment
- contrast management
- section handoff behavior
- visual pacing
- cross-prop cooperation

## Priority Order

The work should proceed in this order:

1. lock the translation-layer problem definition
2. define the shared visual behavior vocabulary
3. complete render-feedback parity for live validation
4. derive behavior-capability layers from the current training corpus
5. introduce an explicit translation-intent planning layer
6. move validation from family-heavy checks toward behavior-heavy checks
7. learn composition patterns across props and sections

Do not keep expanding training or selector heuristics indefinitely before the render-feedback and behavior layers are in place.

## Checklist

### Foundation

- [ ] keep this spec current as the main translation-layer anchor
- [ ] add a dedicated `visual_behavior_v1` contract/spec
- [ ] define a `translation_intent_v1` contract/spec
- [ ] document “good translation” and “bad translation” with rendered examples when available

### Training

- [ ] derive behavior-capability summaries from the current screened corpus
- [ ] group priors by behavior outcome, not only by parameter/value
- [ ] mark which behaviors are geometry-sensitive
- [ ] mark which behaviors are stable across configurations
- [ ] keep shared setting learning generic and cross-effect

### Planner

- [ ] add explicit translation-intent planning before effect realization
- [ ] choose desired behaviors before choosing families
- [ ] allow multiple realizations for one intended behavior
- [ ] rank realizations by geometry fit, evidence strength, and live outcome evidence
- [ ] reduce direct family shortcut logic over time

### Validation

- [ ] keep the current family-level suite as a coarse regression harness
- [ ] add behavior-level assertions to the live suite
- [ ] replace broad family bans with contradiction checks where possible
- [ ] add section-composition and cross-prop coordination scenarios

### Render Feedback

- [ ] complete native render-feedback parity
- [ ] persist render observation in the live apply path
- [ ] persist render critique context in the live apply path
- [ ] persist artistic goal and revision objective consistently
- [ ] compare intended behavior to observed rendered behavior

### Composition

- [ ] define lead/support/background role expectations in planning
- [ ] define section-development expectations
- [ ] treat transitions, blending, and layering as composition tools
- [ ] derive composition priors from successful real outcomes

### Rule Hygiene

- [ ] inventory current hardcoded selector and benchmark rules
- [ ] tag each rule as:
  - safety
  - temporary scaffold
  - benchmark-only
  - permanent boundary
- [ ] remove temporary selector rules once replaced by translation-intent and behavior logic

## Immediate Focus

Before broad new code changes, the next work should stay centered on:

1. translation-layer framing
2. visual behavior vocabulary
3. render-feedback parity

Those three items are the anchor that keeps the project from drifting back into rule accumulation and edge tuning.

## Change Log

### 2026-04-15

- initial version created from project audit and alignment discussion
- established translation-layer north star
- defined the distinction between medium knowledge and effect-family stereotypes
- defined the implementation checklist that should guide subsequent sequencing work
