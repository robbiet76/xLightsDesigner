# Sequencing Bias Audit

Status: Active
Date: 2026-04-15
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-15

## Purpose

This audit tracks where old sequencing bias still exists in the active system.

It is the companion document to:

- [translation-layer-training-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-layer-training-plan-2026-04-15.md)
- [visual-behavior-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/visual-behavior-v1-2026-04-15.md)
- [translation-intent-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-intent-v1-2026-04-15.md)

The goal is not to preserve older heuristic sequencing logic.
The goal is to identify exactly which active paths are:

- empirical and worth keeping
- temporarily tolerated but quarantined
- biased and should be reset

## Audit Rule

Every cleanup slice should do one of these:

1. delete a biased path
2. replace a biased path directly
3. move a biased path into an explicitly quarantined boundary with a clear removal target

Do not add a new abstraction layer whose main purpose is to preserve a biased path.

## Current Classification

### Preserve

These paths are aligned with the translation-layer direction and should remain, unless later evidence shows contamination.

#### 1. Translation intent semantic inference
File:
- [translation-intent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/translation-intent.js)

Reason:
- derives behavior targets from prompt-facing semantic text
- no longer depends on `effectHints`
- forms the correct seam between prompt meaning and realization

Status:
- preserve

#### 2. Sequencing design handoff semantic directives
File:
- [sequence-design-handoff.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-design-handoff.js)

Reason:
- now derives `motionTarget` and `preferredVisualFamilies` from section + goal
- no longer feeds realization hints back into semantic planning

Status:
- preserve

#### 3. Screened medium evidence and derived portable priors
Primary artifacts/files:
- [sequencer-unified-training-set-v1-2026-04-14.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-unified-training-set-v1-2026-04-14.md)
- [build-unified-training-set.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-unified-training-set.mjs)
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)

Reason:
- contains empirical motion/geometry/parameter evidence
- useful as medium capability knowledge
- should not be discarded casually just because selector heuristics are biased

Status:
- preserve core evidence
- continue auditing downstream usage

### Quarantine

These paths are still active and sometimes necessary for runtime continuity, but they should not be considered the target architecture.

#### 1. Direct cue family matching
File:
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)

Why quarantined:
- still contains direct cue rules that jump from prompt text to effect family choice
- some of this is useful as a temporary realization aid
- too much of it risks turning the system back into a prompt-to-family router

Keep temporarily:
- narrow cue rules for clearly explicit realization requests

Do not preserve long term:
- general semantic reliance on family keywords as the primary translation method

Status:
- quarantine

#### 2. Stage 1 visual-family-to-effect mapping
File:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)

Why quarantined:
- `VISUAL_FAMILY_EFFECT_MAP` and related ranking are useful as a bounded realization helper
- but they still encode effect-family-first assumptions that may collapse multiple valid realizations into one narrow family route

Keep temporarily:
- as a bounded realization candidate source

Do not preserve long term:
- as the authoritative meaning layer for visual behavior

Status:
- quarantine

#### 3. Coarse family-level benchmark assertions
Files:
- [live-section-practical-sequence-validation-suite-v2.json](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/eval/live-section-practical-sequence-validation-suite-v2.json)
- other practical validation suites under `apps/xlightsdesigner-ui/eval/`

Why quarantined:
- still useful as coarse diagnostics
- still too family-centric to define artistic truth

Keep temporarily:
- to detect obvious contradiction and prompt disobedience

Do not preserve long term:
- as the main definition of sequence quality

Status:
- quarantine

### Reset

These are the most bias-prone active surfaces and should be reduced or replaced directly.

#### 1. Heuristic effect-family ranking inside section planning
File:
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)

Current issue:
- `inferEffectNameFromSectionPlan()` still prioritizes:
  - revision-brief preferred effects
  - `effectHints`
  - direct cue family candidates
  - visual-family family maps
  - trained family recommendations
  before the system truly behaves like behavior-first realization

Why this is a reset target:
- this is the highest-leverage place where old family bias can still dominate final planning
- semantic cleanup upstream will not matter if this function still resolves through narrow family-first ordering

Reset direction:
- make `translationIntent.behaviorTargets` and semantic section directives primary
- demote or remove family-shortcut precedence
- keep multiple candidate realizations alive longer

Status:
- reset target 1

#### 2. Legacy family pools and contextual effect rules
File:
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)

Current issue:
- `DESIGNER_FAMILY_POOLS`
- `SECTION_CONTEXT_RULES`
- `CONTEXTUAL_EFFECT_RULES`
- `SUMMARY_FALLBACK_RULES`

These still encode section/use-case flavored assumptions such as:
- intro -> gentle set
- chorus -> dense family set
- bridge -> bars/shockwave style set

Why this is a reset target:
- this is the old sequencing doctrine in compact table form
- even if partially useful, it is exactly the kind of logic that causes the system to converge toward the same look repeatedly

Reset direction:
- shrink these tables aggressively
- keep only narrow safety/default fallback behavior where needed
- replace their role with behavior-driven candidate generation and batch-evaluated ranking

Status:
- reset target 2

#### 3. Revision-brief effect heuristics
File:
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)

Current issue:
- `inferRevisionBriefEffectName()` directly maps critique/revision roles to fixed effects such as:
  - contrast -> `Bars`
  - still -> `On`
  - restrained -> `Shimmer`

Why this is a reset target:
- this is a pure shortcut layer
- it hardens narrow relationships between abstract revision goals and single families
- it increases sameness and suppresses medium variety

Reset direction:
- replace fixed effect returns with behavior targets and/or ranked realization candidates
- preserve only explicit safety or hold-state cases if needed

Status:
- reset target 3

## Already Removed In This Audit Pass

### Completed cleanup slices

1. descriptive scenario names are no longer primary ids in active sequencing suites
2. translation intent no longer inherits realization hints
3. negative cue clauses no longer seed contradictory direct family hints
4. sequencing design handoff no longer uses `effectHints` for semantic directives

These changes reduced leakage from:
- benchmark shorthand
- realization hints
- negative prompt clauses
- legacy semantic contamination

## Next Removal Order

### 1. Reset target 1
Directly audit and reduce bias in:
- `inferEffectNameFromSectionPlan()`

First pass objective:
- stop letting `effectHints` and direct family shortcuts outrank translation-intent behavior when they conflict

### 2. Reset target 3
Directly replace:
- `inferRevisionBriefEffectName()`

First pass objective:
- convert fixed family returns into behavior-first realization guidance

### 3. Reset target 2
Shrink or remove:
- `DESIGNER_FAMILY_POOLS`
- `SECTION_CONTEXT_RULES`
- `CONTEXTUAL_EFFECT_RULES`
- `SUMMARY_FALLBACK_RULES`

First pass objective:
- leave only narrow fallback behavior that is still defensible
- eliminate section/use-case doctrine encoded as family lists

## Training And Recalibration Rule

When this audit reaches the point where selector/ranking behavior is materially reworked, retraining and recalibration should happen through a batch harness only.

Required:
- run the full scenario batch
- generate one consolidated report
- compare drift against the previous baseline
- do not accept isolated scenario wins as sufficient evidence

This is required to prevent replacing one biased local optimum with another.

## Change Log

### 2026-04-15

- initial active bias audit created
- classified active sequencing surfaces into preserve/quarantine/reset
- established reset priority order for the next cleanup slices
- aligned future retraining with batch-harness execution only
