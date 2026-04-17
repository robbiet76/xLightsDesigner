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

Rule:

- realization scoring must happen at the realized-settings level
- not at the effect-family level alone

A realization is:

- effect family
- effect settings
- shared settings
- palette
- layering or transition context
- target geometry context

The translation layer must not collapse into effect-level ranking doctrine.

### 5. Render-Feedback Validation

Compare the intended translation behavior to:

- render observation
- render critique
- artistic goal alignment
- revision objective alignment

The render validator is allowed to be metric-driven.

It is not required to mimic human vision.
It is required to produce machine-usable observations that can separate meaningfully different realized behaviors.

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

### What To Quarantine

These are still active in parts of the system, but they should be treated as suspect until audited and either removed or replaced:

- prompt-to-family shortcut tables
- heuristic family-ranking bias
- benchmark shorthand that encodes effect, prop, or section semantics in identifiers
- realization hints that flow back into semantic or behavior inference
- hand-authored use-case mappings that imply fixed relationships between section type, prop type, and effect family

Additional rule:

- if a setting-level meaning claim cannot be defended from rendered observation, it must be treated as provisional
- the next fix is stronger render observation, not stronger effect-level heuristics

Quarantined logic must not be treated as the future architecture.
It may remain temporarily only when:

- it is clearly isolated
- it has an identified replacement path
- it is scheduled for removal

### What To Reset

If a logic path is proven to encode old sequencing bias, it should be reset directly instead of wrapped in new compatibility logic.

Reset candidates include:

- selector/ranking paths that override translation intent with family stereotypes
- semantic inference paths contaminated by realization hints
- benchmark assumptions that equate family choice with artistic correctness
- scenario naming or metadata schemes that encode use-case doctrine instead of opaque identity plus structured intent

The default cleanup move is:

1. identify the contaminated path
2. replace or delete it directly
3. retire the old path in the same slice

Do not add a second semantic system just to compensate for the first one.

## Bias Reset Policy

The project must distinguish three categories of sequencing knowledge:

### Preserve

Keep empirical medium evidence unless it is directly shown to be contaminated:

- screened effect behavior evidence
- geometry-sensitive capability evidence
- parameter differentiation evidence
- shared setting behavior evidence
- portable representativeness/confidence metadata

### Quarantine

Keep running only long enough to avoid breaking the product while it is being replaced:

- legacy heuristic family selectors
- prompt phrase to family shortcuts
- benchmark-only coarse family assertions
- semantic inference that still relies on legacy design shorthand

### Reset

Delete or replace once a cleaner path exists:

- effect-family stereotypes presented as general sequencing truth
- broad forbidden-family assumptions
- descriptive benchmark ids treated as semantic meaning
- logic that reuses realization output as semantic input

This policy exists to prevent a full wipe of useful medium knowledge while still allowing aggressive resets of the biased layers.

## Training Execution Policy

Future retraining and recalibration work must run through a batch harness, not separate ad hoc manual steps.

Why:

- batch execution exposes hidden coupling between scenarios
- batch execution reduces one-off tuning against isolated cases
- batch execution makes regression and cleanup measurable
- batch execution keeps training and validation repeatable

Training and evaluation harnesses should therefore:

- run the full defined scenario batch
- emit one consolidated report for the batch
- record scenario-level failures and aggregate drift
- support repeatable rebuilds from a known baseline
- make it easy to compare one run against the previous run

If a new training or selector change only succeeds in an isolated manual path but fails in batch, it should be treated as incomplete.

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
- [ ] run future retraining and recalibration through a batch harness, not isolated manual passes
- [ ] require one consolidated batch report for each training or selector-change run

### Planner

- [ ] add explicit translation-intent planning before effect realization
- [ ] choose desired behaviors before choosing families
- [ ] allow multiple realizations for one intended behavior
- [ ] rank realizations by geometry fit, evidence strength, and live outcome evidence
- [ ] reduce direct family shortcut logic over time
- [ ] remove contaminated heuristic paths in the same slice that replaces them

### Validation

- [ ] keep the current family-level suite as a coarse regression harness
- [ ] add behavior-level assertions to the live suite
- [ ] replace broad family bans with contradiction checks where possible
- [ ] add section-composition and cross-prop coordination scenarios
- [ ] treat benchmark ids as opaque only and keep all meaning in structured fields

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
- [ ] classify current sequencing logic into:
  - preserve
  - quarantine
  - reset
- [ ] tag each rule as:
  - safety
  - temporary scaffold
  - benchmark-only
  - permanent boundary
- [ ] remove temporary selector rules once replaced by translation-intent and behavior logic
- [ ] do not add compensating abstraction layers just to preserve old biased paths

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
- added preserve/quarantine/reset policy for bias cleanup
- added batch-harness requirement for future retraining and recalibration
