# Translation Layer Training Plan

Status: Active
Date: 2026-04-15
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-15

## Purpose

Keep the project focused on the real goal:

- `prompt -> physical animated light composition`

This project is explicitly building a generative sequencing system.

That means:

- the translation layer stays neutral
- the render validator stays descriptive
- the sequencer agent generates, compares, and revises candidates

The project must not collapse into:

- heuristic sequencing
- deterministic template sequencing
- effect-family recipe selection

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
2. translate that intent into a neutral intent envelope for physical props in space
3. generate multiple materially different valid realization candidates
4. choose motion, texture, attention structure, color, layering, and transitions that realize that picture
5. express those choices through xLights effect families, parameters, palettes, and timing
6. validate the rendered result against the intended visual read
7. revise until the result is artistically strong

If a change does not improve one of those seven steps, it should be treated as secondary work.

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

It should also not start from:

- one deterministic candidate
- one canonical composition shape
- one canonical section-development recipe

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

The same rule applies at the sequencer-agent layer:

- do not replace translation heuristics with sequencing heuristics
- do not encode `metric X high -> always do Y`
- make decisions by comparing candidates against intent and rendered evidence

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
2. intent envelope
3. realization candidate generation
4. candidate selection
5. xLights realization
6. render-feedback validation
7. revision objective
8. outcome learning

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

### 2. Intent Envelope

Convert prompt intent into a neutral artistic target for the current passage:

- attention structure
- temporal profile
- spatial footprint
- density character
- color character
- section role
- intended evolution

The intent envelope should not choose one realization.
It should define what success looks like.

### 3. Realization Candidate Generation

Generate multiple materially different valid ways to satisfy the intent envelope.

Candidates may differ by:

- target allocation
- realization family
- settings
- palette mode
- layering strategy
- attention distribution
- section-development shape

The system must not collapse to rank-1 deterministic choice too early.
Candidate diversity is part of the architecture, not an optional extra.

### 4. Candidate Selection

Choose among valid candidates using:

- fit to intent
- sequence context
- novelty pressure
- bounded exploration
- rendered evidence when available

This is where sequencing decisions belong.
They do not belong in the neutral translation layer.

### 5. xLights Realization

Only after candidate selection, realize the chosen candidate using:

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
The sequencer agent must not collapse into deterministic candidate doctrine.

Single-realization evidence should stay compact.
The project should prefer richer interaction and sequence-level validation over ever-expanding per-effect metric catalogs.

### 6. Render-Feedback Validation

Compare the intended translation behavior to:

- render observation
- render critique
- artistic goal alignment
- revision objective alignment

The render validator is allowed to be metric-driven.

It is not required to mimic human vision.
It is required to produce machine-usable observations that can separate meaningfully different realized behaviors.

### 7. Revision Objective

After critique, convert the mismatch between:

- intent envelope
- chosen candidate
- rendered evidence

into a bounded revision objective.

This revision objective should guide:

- what to preserve
- what to change
- what to try next

### 8. Outcome Learning

Feed real rendered outcomes back into:

- behavior priors
- realization ranking
- composition priors
- revision planning

## Decision Boundary

The translation layer should not decide what art to make.

It should provide:

- neutral intent structure
- candidate space
- rendered evidence

The sequencer agent should decide:

- which candidate to try
- when to revise
- how to preserve novelty
- how to trade off fit, risk, and exploration

This is the core boundary between:

- neutral translation
- generative sequencing

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
