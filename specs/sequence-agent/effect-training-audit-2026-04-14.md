# Effect Training Audit

Status: Active  
Date: 2026-04-14  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-04-14

## Purpose

Audit the current effect-training system so Phase 3 work can start from the actual trained baseline instead of assumptions.

This audit answers:
- what effect training already exists
- what the live runtime already consumes
- where hand-authored effect policy still bypasses trained knowledge
- what should be treated as the starting point for effect-family learning

## Executive Summary

The repo already has a usable Stage 1 effect-training baseline.

That baseline is:
- exported into a runtime bundle
- consumed by the live app
- strong enough to support bounded effect-family learning

The main problem is not missing Stage 1 training data.

The main problem is architectural split:
1. generated Stage 1 trained bundle
2. hand-authored effect capability metadata
3. hand-authored effect-routing heuristics

So the next phase should not start by building more Stage 1 scaffolding.

It should start by using the current Stage 1 bundle as the trained baseline while reducing the amount of live routing that still depends on large hand-authored heuristic tables.

## Current Trained Baseline

Runtime bundle:
- [stage1-trained-effect-bundle.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/generated/stage1-trained-effect-bundle.js)

Loader / API:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)

Current bundle state:
- `artifactType`: `sequencer_stage1_training_bundle`
- `artifactVersion`: `1.0`
- `targetState`: `selector_ready_with_evidence`
- `effectCount`: `10`
- `equalizedCount`: `10`

Current selector-ready trained effects:
- `Bars`
- `Color Wash`
- `Marquee`
- `On`
- `Pinwheel`
- `Shimmer`
- `Shockwave`
- `SingleStrand`
- `Spirals`
- `Twinkle`

Current trained model buckets:
- `arch`
- `cane`
- `icicles`
- `matrix`
- `single_line`
- `spinner`
- `star`
- `tree_360`
- `tree_flat`

This means Stage 1 is not hypothetical.
It is already a real runtime dependency.

## What Stage 1 Training Already Captures

The current Stage 1 bundle already stores:
- selector-ready effect membership
- per-effect maturity stage
- supported geometry profiles
- supported model buckets
- supported analyzer families
- intent tags
- pattern families
- retained parameters
- geometry-specific intent-map signals

Examples from the current bundle:
- `SingleStrand`
  - `14` intent tags
  - `6` pattern families
  - `4` retained parameters
- `Spirals`
  - `14` intent tags
  - `8` pattern families
  - `4` retained parameters
- `Twinkle`
  - `18` pattern families
  - `0` retained parameters
- `Shockwave`
  - `13` pattern families
  - `0` retained parameters

Important interpretation:
- the system is strongest today on effect-family selection and model-bucket compatibility
- it is not yet strong enough for general parameter-level learning

## Current Export / Training Pipeline

Training workspace:
- [scripts/sequencer-render-training/README.md](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/README.md)

Bundle exporter:
- [export-sequencer-stage1-bundle.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/export-sequencer-stage1-bundle.py)

The current runtime bundle is built from:
1. equalization board
2. coverage audit
3. generic layout model catalog
4. one or more intent maps

This is important because it defines the real training boundary:
- Stage 1 is a repo-managed exported artifact
- runtime call sites are supposed to consume that artifact
- future refreshes should regenerate the bundle, not rewrite runtime policy by hand

## Current Runtime Consumption

### Direct consumers of trained knowledge

Primary live consumers:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)
- [effect-intent-capabilities.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js)
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)
- [apply-readback.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/apply-readback.js)
- [target-metadata-runtime.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/runtime/target-metadata-runtime.js)

Current live uses include:
- trained effect recommendations by target model bucket
- trained effect recommendations by visual family
- training overlay attached to effect capabilities
- training metadata carried in plan metadata, readback, and validation
- target metadata readiness based on trained model buckets

### Practical meaning

The app already trusts Stage 1 training for:
- "what effects are selector-ready"
- "which model buckets they support"
- "which trained effect candidates are plausible for a given target/model type"

So the training system is already on the critical path.

## Where The Runtime Still Bypasses Training

### 1. `effect-semantics-registry.js` is still large and hand-authored

Source:
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)

It currently owns large hand-authored structures such as:
- effect aliases
- designer family pools
- safe fallback chains
- summary fallback rules
- direct cue rules
- section-context rules
- contextual effect rules

This file is useful, but it is still the main place where effect-routing policy lives outside the trained bundle.

Assessment:
- this is currently the largest non-trained effect-policy surface
- it is the main place where Phase 3 effect-family learning can drift away from the trained baseline

### 2. `trained-effect-knowledge.js` still carries hand-authored keyword and visual-family maps

Source:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)

It includes:
- `EFFECT_KEYWORDS`
- `VISUAL_FAMILY_EFFECT_MAP`

These are useful compatibility layers, but they are not exported from the Stage 1 bundle.

Assessment:
- acceptable today as a stable shim
- not ideal as the long-term primary source of effect semantics

### 3. The sequencer still uses heuristic family bias after critique

Source:
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)

The current planner now uses:
- render critique
- revision roles
- prior-pass memory

But effect-family bias is still ultimately resolved through:
- heuristic role mapping
- fallback chains
- summary interpretation

Assessment:
- this is correct for the current phase
- but it means the next learning layer should target effect-family outcome memory, not parameter tuning

## What Is Not Missing

The following are already present and should not be rebuilt from scratch:

### Stage 1 maturity model
- [generate-effect-maturity-report.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generators/generate-effect-maturity-report.py)

Key rule already locked:
- `designer_language_candidate` remains false
- `layered_effect_ready` remains false until Stage 2 layered-effect training begins

This is the correct guardrail.

### Training export path
- Stage 1 export pipeline already exists
- runtime bundle generation already exists
- live app already consumes the generated bundle

### Effect capability metadata
- [effect-intent-capabilities.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js)

This is not the main architectural problem.
It is mostly capability description, not primary selection policy.

## Findings

### Finding 1

The current effect-training starting point is the exported Stage 1 bundle, not the heuristics.

That bundle is already:
- selector-ready
- equalized
- wired into runtime

Conclusion:
- Phase 3 effect-family learning should start from the Stage 1 bundle as the baseline source of trained evidence

### Finding 2

The main bottleneck is policy fragmentation, not missing training data.

The trained bundle exists, but:
- `effect-semantics-registry.js` still owns a large amount of routing policy
- `trained-effect-knowledge.js` still carries compatibility maps outside the generated bundle
- `sequence-agent.js` still resolves final family choice through heuristic biasing

Conclusion:
- effect learning should next focus on replacing or constraining hand-authored selection policy with outcome-backed family selection bias

### Finding 3

The system is ready for effect-family learning, but not parameter-level learning.

Why:
- Stage 1 supports family-level recommendation
- Phase 3 now supports:
  - critique
  - revision roles
  - prior-pass memory
  - drilldown escalation
- the repo does not yet have a stable live before/after effect-family outcome memory layer

Conclusion:
- the next effect-training step should record:
  - revision role
  - scope
  - chosen effect family
  - rendered outcome shift
- it should not yet attempt open-ended parameter search

### Finding 4

Some trained semantics are still static instead of generated.

Examples:
- keyword maps
- visual-family-to-effect maps
- alias maps

Conclusion:
- these should be treated as compatibility shims
- not as the final learned source of truth

## Recommended Starting Point For The Next Phase

Work from this boundary:

### Treat as stable baseline
- generated Stage 1 bundle
- effect capability metadata
- current render critique / revision-role / memory loop

### Treat as the main improvement target
- outcome-backed effect-family selection
- reduction of hand-authored routing drift
- before/after learning tied to revision roles and target scope

### Do not start with
- new Stage 1 sweep infrastructure
- parameter-level tuning
- layered-effect training
- broad new designer-language expansion

## Separation Rule: General Training vs User Preference

This boundary must remain explicit now so cloud migration does not force a later cleanup.

### General effect training

This is portable shared sequencing knowledge.

Examples:
- Stage 1 effect-family support by model bucket
- effect-family outcome memory tied to:
  - revision role
  - request scope
  - target class
  - rendered outcome shift
- critique-to-revision-family tendencies
- broad sequencing evidence that should generalize across users and shows

This class of data should be treated as:
- shareable
- versioned
- portable
- future cloud-sync eligible

### User or director preference

This is not general effect training.

Examples:
- this user prefers restrained shimmer over bold bars
- this show owner likes right-heavy staging in bridges
- this director dislikes full-house coverage in early choruses
- this project repeatedly favors a specific visual taste even when multiple valid sequencing options exist

This class of data should be treated as:
- user- or project-scoped
- soft steering only
- separately stored
- not merged into shared effect-training corpora

### Required rule for next-phase effect learning

When we add live effect-family outcome memory, each learned signal must be classed as one of:
1. general sequencing evidence
2. user or project preference evidence

If that distinction is not explicit, future cloud migration will mix:
- product-wide sequencing knowledge
with
- individual taste bias

That would degrade both systems.

### Operational implication

The immediate effect-family learning work should default to:
- general sequencing evidence

Only explicit acceptance or rejection patterns tied to a user, project, or director profile should enter:
- preference storage

Those two stores must remain separate in:
- schema
- runtime usage
- upload policy
- regression/audit surfaces

## Recommended Immediate Workstream

The next effect-training slice should be:

1. record per-pass effect-family decisions
2. join them with:
   - request scope
   - revision role
   - revision targets
   - prior-pass unresolved signals
   - rendered outcome after apply
3. derive simple effect-family outcome memory such as:
   - for `strengthen_lead` on tree-like focal targets, `Bars` improved lead match
   - for `reduce_competing_support` on support clusters, `On` reduced spread but hurt motion development
4. use that memory only as a bounded bias layer on top of current Stage 1 recommendations

That is the correct bridge from:
- Stage 1 trained selection
to
- Phase 3 live effect-family learning

## Concrete Starting Files

Primary baseline files:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)
- [effect-intent-capabilities.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js)
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)
- [revision-memory.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/revision-memory.js)

Primary training/export files:
- [scripts/sequencer-render-training/README.md](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/README.md)
- [export-sequencer-stage1-bundle.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/export-sequencer-stage1-bundle.py)
- [generate-effect-maturity-report.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generators/generate-effect-maturity-report.py)

Primary related specs:
- [effect-knowledge-architecture-audit-2026-03-22.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/effect-knowledge-architecture-audit-2026-03-22.md)
- [sequence-agent-semantics-architecture-2026-03-22.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequence-agent-semantics-architecture-2026-03-22.md)
- [sequencer-phase3-roadmap-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-phase3-roadmap-2026-04-13.md)
- [sequencer-phase3-implementation-checklist-2026-04-13.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/sequencer-phase3-implementation-checklist-2026-04-13.md)

## Bottom Line

The previous effect training is good enough to serve as the baseline for the next phase.

We do not need to invent a new starting point.

We need to:
- trust the Stage 1 bundle as the trained baseline
- add live effect-family outcome memory on top of it
- and progressively reduce the remaining hand-authored routing policy that still sits outside the trained corpus
