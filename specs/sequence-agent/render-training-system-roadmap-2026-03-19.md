# Render Training System Roadmap

Status: Draft  
Date: 2026-03-19  
Owner: xLightsDesigner Team

## 1. Purpose

Render training is not a one-time bootstrap exercise.
It is an ongoing internal training system for the sequencer and should be designed to continue improving:
- before release
- during release hardening
- after release

The framework already has the right base shape:
- drive real xLights rendering
- save real sequence artifacts
- read the real render output from `.fseq`
- decode the render against model geometry
- learn from the resulting structural behavior

That should remain the core architecture.

## 2. Long-Term Objective

The long-term objective is to give the sequencer agent a durable, improving understanding of:
1. how individual effects behave across model families and geometry profiles
2. how effect settings and shared render settings change the output
3. how layered effects interact when combined in one rendered result
4. how rendered structures map to designer requests

This is a staged learning problem.

## 3. Major Stages

### Stage 1: Single-Effect Understanding

Primary goal:
- achieve broad, defensible understanding of individual effects across canonical models

Success criteria:
- effect-level structural understanding across the standard model set
- geometry-aware parameter-region maps
- tested effect-selection and structural retrieval for mature effects
- reliable identification of:
  - high-impact settings
  - context-flat settings
  - interaction-suspected settings
  - stable regions
  - transition points

This is the current major stage.

### Stage 2: Layered-Effect Understanding

Primary goal:
- understand how multiple effects combine in the same rendered window

New problems introduced:
- interaction dominance
- additive vs masking behavior
- order sensitivity
- temporal overlap
- competing motion structures
- readability degradation or enhancement from layering

Success criteria:
- layered-effect experiment design exists
- effect-pair and later effect-stack interaction maps exist
- the system can distinguish:
  - dominant layer
  - blended layer
  - masked layer
  - conflicting motion
  - reinforcing motion

This stage should start only after Stage 1 has strong single-effect coverage on the core effects.

### Stage 3: Ongoing Production Training

Primary goal:
- keep improving the sequencer’s understanding as the product matures

This includes:
- expanding effect coverage
- refining geometry coverage
- improving the interpretation layer
- improving layered-effect understanding
- validating new xLights versions or changed effect behavior
- supporting post-release learning loops

This stage is expected to continue after release.

## 4. Architectural Principles

### 4.1 Keep xLights as the authoritative renderer

Do not replace the actual render path.
The render-training system should continue to:
- build real sequences
- render through xLights
- read the resulting `.fseq`

That keeps the training signal aligned with product reality.

### 4.2 Preserve canonical artifacts

For every important run family, preserve:
- the generated `.xsq`
- the rendered `.fseq`
- the manifest or generated plan that produced them
- the decoded record outputs
- the derived summaries and evaluations

This is required for reproducibility, debugging, and future retraining.

### 4.3 Treat interpretation as a first-class subsystem

The bottleneck is no longer only execution.
The bottleneck is increasingly the render-understanding layer.

That means the system must treat these as first-class maintained components:
- decode format
- geometry metadata
- analyzers
- pattern families
- intent mapping
- retrieval evaluation

### 4.4 Preserve diversity explicitly

The system must continue to avoid converging on a narrow winner set.
Training outputs should preserve:
- multiple useful regions
- multiple reusable looks
- distinct structural families
- context-specific recommendations

This is a hard product goal, not an optimization preference.

## 5. Required System Structure

The long-lived system should be organized around these persistent layers:

1. canonical training layout
2. canonical fixture sequence
3. geometry audit and geometry profile resolution
4. effect parameter registry
5. registry-driven sweep planning
6. render execution and artifact persistence
7. `.fseq` decode and per-frame analysis
8. region summaries and impact summaries
9. intent map and retrieval evaluation
10. effect-selection layer
11. future layered-effect planning and evaluation

The existing framework already covers most of this.
The roadmap is to harden and extend it, not replace it.

## 6. Canonical Training Assets

The canonical training workspace should continue to live under:
- `/Users/robterry/Desktop/Show/RenderTraining`

It should remain the home for:
- canonical xLights layout XML
- canonical animation fixture `.xsq`
- working `.xsq`
- rendered `.fseq`
- copied manifests
- records
- derived outputs

The standard-model training layout should remain separate from custom-model work.

## 7. Test Design Framework

### 7.1 Sampling strategy

The test design framework must continue to support:
- registry-defined anchors
- range refinement near transitions
- targeted interaction sweeps
- geometry-profile-aware planning
- effect-specific maturity gating

### 7.2 Evaluation strategy

Evaluation should continue to grow in layers:
1. execution success
2. decode validity
3. structural region quality
4. intent retrieval quality
5. effect-selection quality
6. future layered-effect retrieval quality

### 7.3 Promotion rules

An effect should only be promoted into broader selector or intent use when:
- its region summaries are stable
- its evaluator cases pass consistently
- its semantics are specific enough to support retrieval

Effects should be allowed to mature at different rates.

## 8. Maturity Model

Each effect should move through these maturity levels:

1. execution_ready
- harness runs successfully
- artifacts are valid

2. structurally_observable
- impact regions are detectable
- parameter regions are stable enough to summarize

3. structurally_retrievable
- evaluator cases pass for constrained structural requests

4. selector_ready
- effect selection can route to this effect for supported requests

5. designer_language_candidate
- effect semantics are rich enough to start mapping controlled designer vocabulary

6. layered_effect_ready
- effect is mature enough to participate in layered-effect training

This maturity model should be tracked explicitly over time.

## 9. Near-Term Roadmap

### Current stage
- finish hardening Stage 1 across the standard model set

### Immediate priorities
1. continue improving render understanding detail
2. continue expanding single-effect understanding across the standard xLights model set
3. keep evaluator-driven promotion into selector coverage
4. keep custom-model work separate until the standard-model base is stronger

### Next technical priorities
1. expand cross-geometry selector evaluation
2. improve detail sensitivity in the analyzers
3. add maturity tracking per effect
4. prepare the experiment-design structure for Stage 2 layered-effect work

## 10. Layered-Effect Preparation

The framework should be designed now so Stage 2 does not require re-architecture later.

That means:
- manifests must be able to express multiple effects in the same window later
- records must tolerate multiple effect descriptors later
- analyzers must remain extensible to mixed-pattern interpretation
- evaluation must remain able to compare single-effect and layered-effect behavior

Layered-effect implementation is later, but structural compatibility should be preserved now.

## 11. Post-Release Use

This tool should be expected to continue after release for:
- regression checks against xLights behavior changes
- training expansion to more effects and models
- ongoing improvement of interpretation quality
- future designer-language and layering improvements

So the framework should be maintained as a durable internal training system, not a temporary experiment harness.

## 12. Concrete Guidance

When choosing next work, prefer the following order:
1. strengthen interpretation quality where the evaluator exposes weakness
2. expand structurally mature effects across more standard geometries
3. promote effects into selector coverage only when evaluator evidence supports it
4. defer new effect expansion when interpretation quality is the limiting factor
5. keep the system ready for layered-effect training, but do not start it until Stage 1 is strong

## 13. Current Conclusion

The framework should now be treated as a durable training platform.

The next major milestone is:
- full single-effect understanding across the standard model set

Only after that milestone should layered-effect training become the next major phase.
