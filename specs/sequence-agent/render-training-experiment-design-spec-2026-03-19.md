# Render Training Experiment Design Spec

Status: Draft  
Date: 2026-03-19  
Owner: xLightsDesigner Team

Roadmap reference:
- [render-training-system-roadmap-2026-03-19.md](/Users/robterry/Projects/xLightsDesigner/specs/sequence-agent/render-training-system-roadmap-2026-03-19.md)

## 1. Purpose

This spec formalizes the training strategy for sequencer render understanding.

This spec defines the experiment model inside the broader long-lived render-training system roadmap.

The problem space is effectively massive:
- model settings
- effect settings
- shared render settings
- palette settings
- duration settings

The full Cartesian product is too large to brute-force.

Success is not:
- testing every combination
- finding one best preset per effect

Success is:
1. understanding which settings materially change the result
2. understanding how those settings interact with geometry and render context
3. identifying stable look regions and transition boundaries
4. mapping rendered looks to designer terminology

## 2. Core Principle

The training system must learn the structure of the render space, not exhaustively enumerate it.

That means the system must:
- factor the search space
- sample intelligently
- refine only where evidence says refinement is needed
- preserve multiple useful looks
- distinguish geometry effects from effect-setting effects

## 3. Source Of Truth

### 3.1 Geometry

Geometry understanding must come from xLights model metadata and audited model settings.

Primary sources:
- `xlights_rgbeffects.xml`
- `xlights_networks.xml`
- generated geometry audit:
  - [generic-layout-geometry-audit.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generic-layout-geometry-audit.json)

Must not be used as semantic truth:
- user model names
- harness naming conventions
- arbitrary manifest labels

### 3.2 Render Behavior

Render behavior must come from rendered `.fseq` output and model-aware decode.

Primary source:
- packed `.fseq` artifacts

Interpretation source:
- model-aware decode
- per-frame node state
- geometry-family analyzers

## 4. Training Decomposition

The space must be decomposed into these layers:

1. geometry profile
2. effect
3. shared render context
4. effect parameter family
5. parameter region
6. interaction region
7. intent mapping

This decomposition is mandatory.

The system must not treat the problem as one undifferentiated combination space.

## 5. Geometry Contract

### 5.1 Required Outputs

The metadata layer must emit:
- `resolvedModelType`
- `resolvedGeometryProfile`
- `geometryTraits`

### 5.2 Meaning

`resolvedModelType`
- base family from xLights `DisplayAs`
- examples:
  - `single_line`
  - `arch`
  - `cane`
  - `matrix`
  - `tree_flat`
  - `tree_360`
  - `star`
  - `icicles`
  - `spinner`

`resolvedGeometryProfile`
- structure-sensitive geometry profile derived from model settings
- examples:
  - `single_line_horizontal`
  - `single_line_vertical`
  - `single_line_single_node`
  - `arch_single`
  - `arch_grouped`
  - `arch_multi_layer`
  - `cane_single`
  - `cane_grouped`
  - `cane_stick_grouped`
  - `tree_360_round`
  - `tree_360_spiral`
  - `tree_flat_single_layer`
  - `star_single_layer`
  - `star_multi_layer`
  - `matrix_low_density`
  - `matrix_medium_density`
  - `matrix_high_density`

`geometryTraits`
- explicit structural traits
- examples:
  - `spiral_enabled`
  - `layered`
  - `grouped`
  - `stick_segments`
  - `horizontal_orientation`
  - `vertical_orientation`
  - `single_node`
  - `density_low`
  - `density_medium`
  - `density_high`
  - `strand_dir:vertical`
  - `strings:16`
  - `nodes_per_string:50`

### 5.3 Dispatch Rule

Analyzer dispatch must use:
1. `resolvedGeometryProfile` first
2. `resolvedModelType` second

## 6. Shared Structural Standard

Structural training runs must default to:
- palette: RGB
- brightness: 100%

Default RGB palette:
- `#FF0000`
- `#00FF00`
- `#0000FF`

Reason:
- clearer motion and color-role tracking
- less palette noise
- easier structural interpretation

Brightness rule:
- default structural tests use 100% brightness
- brightness is only varied when brightness itself is part of effect semantics

## 7. Experiment Model

### 7.1 Phase A: Geometry Baseline

Goal:
- establish canonical behavior across geometry profiles
- confirm analyzers can interpret each geometry family

What to test:
- small representative effect set
- canonical baseline settings
- no heavy interaction sweeps

Exit criteria:
- analyzers produce meaningful geometry-aware interpretation
- model-profile differences are explained by audited settings

### 7.2 Phase B: First-Order Parameter Screening

Goal:
- determine which parameters matter for each effect on each geometry profile

Method:
- one-parameter sweeps at anchor points
- keep other settings fixed

Outputs:
- high-impact parameters
- low-impact parameters
- breakpoint parameters
- initial stable regions

### 7.3 Phase C: Range Refinement

Goal:
- identify stable regions and transition boundaries within high-impact parameters

Method:
- refine only around suspected transitions
- do not further refine flat regions

Outputs:
- parameter-region maps
- transition points
- region-level look labels

### 7.4 Phase D: Structured Interaction Testing

Goal:
- understand when one parameter only matters under another setting or render context

Method:
- test only selected parameter pairs
- choose pairs based on evidence from earlier phases

Outputs:
- known interaction rules
- known independence rules

### 7.5 Phase E: Intent Mapping

Goal:
- map geometry-aware rendered looks to designer language

Method:
- classify pattern families
- infer quality traits
- attach intent tags

Outputs:
- intent vocabulary map per effect and geometry profile
- representative look regions per intent
- a controlled designer vocabulary layer evaluated against expected effect-selection outcomes before any broader language claims

## 8. Parameter Taxonomy

Each effect parameter must be registered with the following metadata:
- parameter name
- type
  - numeric
  - boolean
  - enum
  - mode selector
- nominal range
- anchor values
- expected visual importance
  - high
  - medium
  - low
- effect-mode dependency
- interaction hypotheses
- stop rule

Example outcomes:
- `SingleStrand.numberChases`
  - high impact
  - anchor points across low/medium/high density
- `SingleStrand.advances`
  - low impact in tested skip context
  - limited refinement unless another geometry profile contradicts that
- `Shimmer.dutyFactor`
  - high impact
  - refine around observed region changes

## 9. Sampling Policy

### 9.1 Base Rule

Do not exhaustively enumerate.

Sample in this order:
1. baseline anchor values
2. detect whether the parameter appears flat or changing
3. refine only where change is detected

### 9.2 Numeric Parameters

Policy:
- use anchor values first
- classify outcomes into:
  - flat
  - breakpoint
  - region-forming

Rules:
- if flat, stop early
- if only one breakpoint appears, refine locally
- if multiple distinct regions appear, create region summaries rather than continue dense sampling everywhere

### 9.3 Boolean And Enum Parameters

Policy:
- test all semantically meaningful options
- prefer these early because they often change structure more than sliders do

### 9.4 Interaction Sampling

Only test interactions when one of these is true:
- parameter A is high-impact
- parameter B is high-impact
- there is evidence that A only matters under mode/context B
- a geometry profile is likely to amplify the interaction

### 9.5 Stop Rules

Stop sampling a parameter or interaction when:
- new anchor points collapse into an existing region
- analyzer output shows no meaningful new structure
- additional variation does not add designer-facing look distinctions

## 10. Interpretation Requirements

### 10.1 Minimum Requirement

The system must not only detect that a setting changed the output.

It must explain what changed in visual terms.

### 10.2 Required Interpretation Layers

1. per-frame decode
2. geometry-aware sequence descriptors
3. pattern-family classification
4. intent mapping

### 10.3 Required Pattern Outputs

Examples:
- static hold
- shimmer
- directional chase
- bounce
- skips
- segmented chase
- burst texture
- tree band motion
- spiral travel
- radial sparkle

### 10.4 Required Intent Outputs

Examples:
- clean
- busy
- restrained
- bold
- directional
- bouncy
- segmented
- textured
- smooth
- punchy

## 11. Learning Outputs

For each `effect x resolvedGeometryProfile`, the system should eventually produce:

1. parameter impact summary
- high-impact parameters
- low-impact parameters
- breakpoint parameters

2. region map
- stable parameter regions
- transition regions

3. interaction map
- important interactions
- known non-interactions

4. look catalog
- distinct useful looks
- not one best preset

5. intent map
- which designer terms retrieve which look regions

## 12. Success Criteria

The training system is successful when:

1. it can explain major look differences in geometry-aware terms
2. it can identify which settings matter and when
3. it can avoid wasting time on flat regions
4. it can preserve multiple distinct usable looks
5. it can map those looks to designer terminology
6. it can generalize from one concrete model to the correct geometry profile family without relying on model names

## 13. Immediate Implementation Plan

### 13.1 Metadata Layer

- [ ] Add `resolvedGeometryProfile` derivation to metadata extraction
- [ ] Add `geometryTraits` to runtime metadata output
- [ ] Move analyzer dispatch to geometry profile first

### 13.2 Parameter Registry

- [ ] Create effect parameter registry artifact
- [ ] Register first effects:
  - `On`
  - `SingleStrand`
  - `Shimmer`
  - `Color Wash`

### 13.3 Sampling Engine

- [ ] Implement range-sampling policy in code
- [ ] Implement refinement policy around transition regions
- [ ] Implement stop rules

### 13.4 Interaction Engine

- [ ] Define interaction-manifest format
- [ ] Implement selected pairwise interaction runner

### 13.5 Interpretation Layer

- [ ] Finish tree analyzer structure features
- [ ] Finish star analyzer structure features
- [ ] Add geometry-profile-specific overlays where base family is too coarse

## 14. Non-Goals For The Current Phase

Not part of the immediate phase:
- full combinatorial coverage
- custom-model generalization
- model groups
- submodels
- media-heavy matrix interpretation
- aesthetic palette optimization

These are later workstreams.
