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
- `EFFECT_KEYWORDS` and `recommendTrainedEffects()` still score explicit family/keyword matches ahead of richer behavior realization

Keep temporarily:
- as a bounded realization candidate source

Do not preserve long term:
- as the authoritative meaning layer for visual behavior

Status:
- quarantine
- pattern-family evidence now outranks the static family map
- continue reducing the remaining fallback map and keyword reliance

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
- `inferEffectNameFromSectionPlan()` still contains family-first fallback surfaces:
  - direct cue family candidates
  - visual-family family maps
  - trained family recommendations
- `effectHints` have already been demoted behind translation behavior

Why this is a reset target:
- this is the highest-leverage place where old family bias can still dominate final planning
- semantic cleanup upstream will not matter if this function still resolves through narrow family-first ordering

Reset direction:
- make `translationIntent.behaviorTargets` and semantic section directives primary
- demote or remove family-shortcut precedence
- keep multiple candidate realizations alive longer

Status:
- partially reset
- continue reducing family-first fallback ordering

#### 2. Legacy family pools and contextual effect rules
File:
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)

Current issue:
- `CONTEXTUAL_EFFECT_RULES`
- `SUMMARY_FALLBACK_RULES`
- the remaining contextual rules still encode some realization doctrine, but much less than before

Why this is a reset target:
- this is the old sequencing doctrine in compact table form
- even if partially useful, it is exactly the kind of logic that causes the system to converge toward the same look repeatedly

Reset direction:
- shrink these tables aggressively
- keep only narrow safety/default fallback behavior where needed
- replace their role with behavior-driven candidate generation and batch-evaluated ranking

Status:
- partially reset
- `DESIGNER_FAMILY_POOLS`, `SECTION_CONTEXT_RULES`, and repeated-role doctrine are already removed
- continue shrinking remaining contextual tables

#### 3. Revision-brief effect heuristics
File:
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)

Current issue:
- legacy revision-role-to-family shortcuts were present in `inferRevisionBriefEffectName()`
- the function still contains hardcoded summary-to-family returns such as:
  - contrast or hierarchy -> `Bars`
  - still or sparse -> `On`
  - restrained -> `Shimmer`

Why this is a reset target:
- this is a pure shortcut layer
- it hardens narrow relationships between abstract revision goals and single families
- it increases sameness and suppresses medium variety

Reset direction:
- replace fixed effect returns with behavior targets and/or ranked realization candidates
- preserve only explicit safety or hold-state cases if needed

Status:
- partially reset
- direct role tables were removed, but residual hardcoded family returns still remain
- narrowed further to explicit hold-state fallback plus trained ranking

## Already Removed In This Audit Pass

### Completed cleanup slices

1. descriptive scenario names are no longer primary ids in active sequencing suites
2. translation intent no longer inherits realization hints
3. negative cue clauses no longer seed contradictory direct family hints
4. sequencing design handoff no longer uses `effectHints` for semantic directives
5. `effectHints` no longer outrank translation behavior in section planning
6. revision briefs no longer map directly to fixed effect families
7. summary fallback doctrine has been reduced to narrow behavior-only fallbacks
8. repeated-section, section-position, high-energy, low-energy, bridge, lighting, framing, and section-context doctrine has been removed from active designer-dialog routing
9. dead registry doctrine tables have been deleted:
   - `DESIGNER_FAMILY_POOLS`
   - `SECTION_CONTEXT_RULES`
   - `REPEATED_ROLE_RULES`
10. trained effect knowledge now prefers stage1 pattern-family evidence over the static visual-family map
11. revision brief effect inference no longer returns `Bars` / `Shimmer` from broad summary heuristics

These changes reduced leakage from:
- benchmark shorthand
- realization hints
- negative prompt clauses
- legacy semantic contamination

## Next Removal Order

### 1. Reset target 1
Directly audit and reduce bias in:
- `inferEffectNameFromSectionPlan()`

Current objective:
- continue reducing direct cue and family-map dominance where behavior-first realization can replace them

### 2. Reset target 2
Shrink or remove:
- `CONTEXTUAL_EFFECT_RULES`
- `SUMMARY_FALLBACK_RULES`

Current objective:
- leave only narrow contextual helpers that are still actively used and defensible
- continue deleting unused or doctrine-heavy variants as behavior-first planning replaces them

### 3. Reset target 3
Directly reduce:
- `VISUAL_FAMILY_EFFECT_MAP`
- `EFFECT_KEYWORDS`
- `recommendTrainedEffects()`
- `recommendTrainedEffectsForVisualFamilies()`

Current objective:
- stop treating family and keyword matches as the primary realization evidence
- move this layer toward behavior-capability ranking rather than family-name routing

### 4. Reset target 4
Directly replace residual hardcoded returns in:
- `inferRevisionBriefEffectName()`

Current objective:
- remove the remaining `On` hold fallback if trained behavior ranking becomes reliable enough to cover it
- otherwise keep it as a narrow explicit hold-state exception only

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
