# Sequencer Training Reset Plan

Status: Active  
Date: 2026-04-15  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-15

## Purpose

Reset the sequencer training and realization recommendation process so the system is built around:

- `prompt -> translation intent -> behavior targets -> medium realization -> rendered outcome`

and not around:

- effect-family doctrine
- section/use-case stereotypes
- prompt-to-effect shortcut tables
- selector heuristics that collapse too early

This spec replaces incremental patching as the primary strategy for sequencer training.

## Problem Statement

The earlier sequencer training stack was built when:

- the project goal was less clearly defined
- the render-feedback loop was incomplete
- the translation layer was less mature
- benchmark framing was more effect-family-centric

That early direction produced a selector layer with too much embedded doctrine:

- family-first ranking
- section-context bias
- generic tag weighting
- heuristic demotion/promotion rules unrelated to the actual medium

Even after significant cleanup, the correct conclusion is:

- the existing raw evidence is still useful
- the current selector abstractions are not a trustworthy long-term foundation

## Reset Decision

We will restart sequencer training from the selector abstraction upward.

We will not discard the entire evidence base.

### Preserve

Keep these as inputs to the rebuild:

- raw render-derived evidence
- geometry/profile coverage
- parameter priors
- shared-setting priors
- render-feedback pipeline
- owned automation path
- full batch harness
- translation-layer specs:
  - [translation-layer-training-plan-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-layer-training-plan-2026-04-15.md)
  - [visual-behavior-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/visual-behavior-v1-2026-04-15.md)
  - [translation-intent-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/translation-intent-v1-2026-04-15.md)

### Regenerate

Rebuild these from preserved evidence:

- stage1 selector-ready recommendation bundle
- coarse effect intent tags used for ranking
- pattern-family recommendation weighting
- behavior-to-effect ranking surfaces
- any generated recommendation bundle used directly by sequencing selection

### Retire

Do not carry these forward as training foundations:

- family-first selector doctrine
- prompt-to-effect shortcut tables
- section-position or song-structure family defaults
- “safe” family substitution rules
- effect recommendations derived from broad generic tags

## Target Training Model

The rebuilt training system must model effect capability as:

- effect
- parameter region
- geometry/profile
- observed behavior
- observed render outcome

not as:

- effect family with a few semantic labels

It must also explicitly model:

- what each parameter changes visually
- how shared settings change the rendered result
- how geometry changes the read without becoming model-use doctrine
- how design language maps to behavior and settings instead of collapsing to effect names

### Core Training Unit

The new training unit is a `behavior-capability observation`.

Each record should capture:

- `effectName`
- `geometryProfile`
- `modelType`
- `parameterRegion`
- `sharedSettingsContext`
- `paletteContext`
- `behaviorSignals`
- `renderOutcomeSignals`
- `confidence`
- `evidenceCount`

### Required Behavior Signals

At minimum, the rebuilt selector corpus must encode:

- primary motion
- motion intensity
- texture character
- coverage character
- temporal character
- hierarchy suitability
- geometry coupling
- stability/variance

These should align with:

- [visual-behavior-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/visual-behavior-v1-2026-04-15.md)

### Required Semantic Understanding

The rebuilt training corpus must also encode:

- effect capability breadth
- parameter semantics
- shared-setting semantics
- geometry-conditioned rendering differences
- language-to-behavior mapping

Reference:

- [effect-capability-and-parameter-semantics-v1-2026-04-15.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/effect-capability-and-parameter-semantics-v1-2026-04-15.md)

## Acceptance Standard

No training or recalibration pass is accepted from isolated spot checks.

Accepted evidence must come from:

1. generated artifact validation
2. focused unit coverage
3. full batch harness results

The full batch harness is the release gate for selector/training changes.

## Rebuild Phases

### Phase 1: Freeze The Old Selector Abstractions

Goal:
- stop extending current selector abstractions

Checklist:
- [ ] freeze new heuristic additions to selector ranking
- [ ] mark current stage1 selector bundle as transitional
- [ ] document which generated bundles are being retired/replaced

### Phase 2: Define The New Training Record Shape

Goal:
- specify the regenerated selector input format

Checklist:
- [ ] define `behavior_capability_record_v1`
- [ ] define parameter-semantics training record shape
- [ ] define shared-setting-semantics training record shape
- [ ] define required `behaviorSignals`
- [ ] define required `renderOutcomeSignals`
- [ ] define confidence/evidence aggregation fields
- [ ] define how geometry/profile is encoded
- [ ] define how language maps to behavior and setting axes without effect-family doctrine

Deliverable:
- new schema/spec for behavior-capability training records

### Phase 3: Regenerate Capability Artifacts From Raw Evidence

Goal:
- rebuild recommendation inputs from raw evidence instead of old selector summaries

Checklist:
- [ ] regenerate capability records from raw render evidence
- [ ] regenerate parameter-region summaries from those records
- [ ] regenerate shared-setting compatibility summaries from those records
- [ ] avoid generic “intentTags” as primary recommendation evidence

Deliverable:
- regenerated capability-first training bundle

### Phase 4: Rebuild Realization Ranking

Goal:
- make recommendation ranking depend on behavior compatibility first

Checklist:
- [ ] rank candidates by behavior match
- [ ] use geometry fit only as a refiner
- [ ] use parameter priors only after behavior-compatible effects are chosen
- [ ] keep multiple valid realizations alive longer before final collapse
- [ ] avoid single-effect collapse from generic tags

Deliverable:
- rebuilt selector/ranking layer using regenerated capability records

### Phase 5: Validate Through Batch Outcomes

Goal:
- evaluate the rebuilt selector against the full suite

Checklist:
- [ ] run focused tests
- [ ] run full batch harness
- [ ] store one consolidated batch report
- [ ] compare against the last clean baseline
- [ ] inspect failures as:
  - behavior inference problem
  - realization ranking problem
  - benchmark contract problem

Deliverable:
- first post-reset batch baseline

## Retirement Rules

When the new capability-first selector lands:

- delete superseded selector abstractions in the same slice
- do not leave parallel old/new ranking systems in place
- do not keep “temporary” compatibility heuristics unless they are explicitly acceptance-gated and time-bounded

## Immediate Work Order

1. define the new behavior-capability record spec
2. inventory the current generated selector bundles to retire/regenerate
3. build the regeneration harness
4. regenerate the selector input artifacts from preserved raw evidence
5. rebuild selector ranking against those regenerated artifacts
6. validate only through the batch harness

## Current Working Rule

Until the rebuild is complete:

- continue using the existing system only as a transitional runtime
- allow correctness fixes when needed
- do not treat the current selector abstractions as the long-term architecture

## Success Criteria

The reset is successful when:

- effect recommendations are driven by behavior-capability evidence
- color language does not incorrectly drive effect-family choice
- geometry fit refines recommendations instead of replacing semantics
- multiple valid realizations remain available until late selection
- the full batch harness remains green without growing new doctrine tables
