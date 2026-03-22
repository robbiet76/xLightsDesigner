# Sequence Agent Semantics Architecture

Date: 2026-03-22

## Purpose

This document defines the architectural boundary for shared sequencing semantics so future work does not reintroduce runtime-local policy tables.

The goal is:
- adding a new effect should primarily be a metadata update
- adding a new model/target behavior should primarily be a metadata update
- main runtime files should interpret context and orchestrate calls, not own duplicated policy

## Current Shared Layers

### Effect Semantics Registry

Source:
- [effect-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/effect-semantics-registry.js)

Owns:
- canonical effect aliases
- canonical effect family identity
- designer family pools
- safe fallback chains
- direct cue rules
- section-context effect rules
- contextual effect routing rules
- section-intent summary templates
- template effect preferences
- summary fallback routing
- trained recommendation wrappers

This layer is the canonical source for:
- effect identity
- effect-family meaning
- effect-routing policy
- effect fallback policy

### Target Semantics Registry

Source:
- [target-semantics-registry.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/shared/target-semantics-registry.js)

Owns:
- generic scope tokens
- aggregate target patterns
- submodel parent parsing
- buffer-style family classification
- render-risk classification
- group distribution phrase metadata
- group distribution strategy inference
- group graph normalization
- submodel graph normalization
- aggregate target detection and ordering

This layer is the canonical source for:
- target/group/submodel structural semantics
- render-policy family interpretation
- group expansion policy

### Effect Capability Layer

Source:
- [effect-intent-capabilities.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js)

Owns:
- supported settings intent
- supported palette intent
- supported layer intent
- supported render intent
- effect parameter pattern hints
- training overlay onto those capabilities

This layer must not own:
- canonical effect aliases
- canonical effect families
- fallback chains
- routing rules

Those belong in the effect semantics registry.

## Runtime Responsibilities

### Designer Runtime

Source:
- [designer-dialog-runtime.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-runtime.js)

Should own:
- interpreting section context
- normalizing creative intent
- selecting shared semantics variants
- building designer handoff artifacts

Should not own:
- hardcoded effect fallback lists
- hardcoded cue-to-effect tables
- hardcoded section summary phrase trees

### Sequence Agent Runtime

Source:
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)

Should own:
- plan orchestration
- stage ordering
- use of trained effect knowledge
- use of shared semantics to choose among candidates

Should not own:
- inline effect-family fallback trees
- inline preferred effect ordering policy

### Command Builders

Source:
- [command-builders.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/command-builders.js)

Should own:
- command graph synthesis
- xLights command shape
- ordering and dependency assembly

Should not own:
- target/group/submodel policy tables
- aggregate-target heuristics
- distribution phrase metadata

Those belong in the target semantics registry.

## Rules For Future Changes

1. New effect support
- first choice: update generated training bundle
- second choice: update effect semantics registry metadata
- third choice: update effect capability metadata if parameter translation changes
- do not add new inline effect-selection branches in runtime files unless it is a temporary hotfix

2. New target/model/group behavior
- first choice: update target semantics registry metadata/helpers
- second choice: update capability/compatibility metadata
- do not add repeated target/group/submodel heuristics in command builders, readback, app runtime, or planner

3. Runtime fallback logic
- if a fallback is effect-specific, it belongs in effect semantics
- if a fallback is target/group-specific, it belongs in target semantics
- if a fallback is transport/runtime-health specific, it belongs in runtime/orchestration layers

## Remaining Gaps

These areas still need cleanup:

1. [target-resolver.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/target-resolver.js)
- still owns target-selection heuristics
- likely candidate for a future shared target-selection policy layer

2. [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- still contains localized scene/target/render interpretation code
- current duplicate helpers are reduced, but app-level audit should continue

3. Shared registries are still hand-authored
- centralization is complete enough for maintainability gains
- later phases may generate more of this metadata from training artifacts

## Acceptance Standard

We should consider the architecture healthy when:
- new effect routing changes land in shared effect semantics or generated training metadata
- new target/group/submodel policy changes land in shared target semantics
- runtime files primarily interpret context and orchestrate behavior
- tests guard the shared semantics layers directly and through runtime consumers
