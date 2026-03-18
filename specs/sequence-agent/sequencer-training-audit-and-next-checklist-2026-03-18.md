# Sequencer Training Audit And Next Checklist

Status: Active
Date: 2026-03-18
Owner: xLightsDesigner Team

Purpose: capture the current sequencer-side training state, define the practical handoff from the now-stable designer baseline, and establish the next checklist for render-grounded sequencer training.

## Current Handoff Point

Upstream designer contract to hold fixed while sequencer training proceeds:
- offline designer corpus: `67/67` passed
- warm live canary suite: `3/3` passed
- promoted live baseline suite: `8/8` passed
- promoted extended live suite: `14/14` passed

Interpretation:
- designer-side intent interpretation is now stable enough to act as the upstream authored contract
- the primary remaining quality loss is expected to happen during sequencer realization, not during designer planning

## Current Sequencer State

What the sequencer already has:
- live effect-definition catalog loading from xLights `effects.listDefinitions`
- normalized parameter metadata:
  - parameter names
  - types
  - min/max bounds
  - enum values
- schema-safe translation of:
  - `settingsIntent`
  - `paletteIntent`
  - `layerIntent`
  - `renderIntent`
- safe command emission into `effects.create`
- validation/apply/readback infrastructure

Primary source files:
- [effect-definition-catalog.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-definition-catalog.js)
- [effect-intent-capabilities.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js)
- [effect-intent-translation.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-translation.js)
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)
- [orchestrator.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/orchestrator.js)
- [apply-readback.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/apply-readback.js)

## Current Limitation

The current sequencer understands the parameter surface better than the rendered meaning.

That means:
- it knows parameter names, ranges, and enum values
- it does **not** yet have a deep, render-grounded understanding of what those settings visually do

Current translation style in [effect-intent-translation.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-translation.js):
- regex-style parameter matching
- fixed scalar maps such as:
  - `slow -> 2`
  - `medium -> 5`
  - `fast -> 9`
- enum coercion when a matching xLights enum exists
- blend/buffer-style mapping by hand-authored policy

Interpretation:
- this is good enough for safe writes
- it is not good enough to claim strong semantic realization quality

## Current Training Boundary

Correct current claim:
- the sequencer can safely translate many designer-authored placements into xLights command payloads

Incorrect current claim:
- that the sequencer already understands how the resulting xLights output actually looks

That second claim would be false today.

## Immediate Sequencer Goal

Train the sequencer to realize designer intent faithfully, not just emit valid settings.

That breaks into five workstreams:
1. effect-family realization quality
2. parameter realism
3. layer/render discipline
4. prop-specific realization
5. comparative apply quality

## Initial High-Value Effect Set

First audit/training set:
- `On`
- `SingleStrand`
- `Color Wash`
- `Shimmer`
- `Bars`
- `Wave`
- `Morph`
- `Meteors`
- `Pinwheel`

Reason:
- these effects are common enough to matter immediately
- they cover foundational hold/wash/sparkle/rhythmic/path/radial/string behavior
- they expose the current gap between safe translation and real visual understanding

## Findings From The Current Code

`On`
- already present in the capability table
- already used as a direct inferred family for steady/hold language
- currently treated as a safe foundational effect
- still lacks a render-grounded understanding of:
  - how brightness reads on different props
  - how palette choices alter perceived intensity
  - when `On` should be preferred over restrained `Color Wash`

`SingleStrand`
- canonical xLights effect name is `SingleStrand`
- present in the effect-support audit as structurally supported
- now present in the sequencer capability table
- still not first-class in the heuristic intent translator
- is therefore still under-modeled despite being a common practical effect family

Interpretation:
- `On` is partially modeled but not deeply understood
- `SingleStrand` is now modeled at the capability layer, but still not deeply understood

## Gaps We Must Fill

These gaps cannot be closed from schema inspection alone.
They require either:
- user/operator knowledge
- render-grounded xLights sweeps
- or both

`On`
- when should `On` be treated as:
  - hard hold
  - soft glow
  - architectural outline read
  - hero prop emphasis
- what brightness ranges read as:
  - restrained
  - normal
  - blown out
  on common prop classes
- when `On` should beat `Color Wash` for a stable look

`SingleStrand`
- which visual sub-modes are the practically important ones
- which parameters actually define:
  - chase character
  - bounce/comet feel
  - grouping
  - directionality
  - readable thickness on strings/canes/outlines
- which prop classes benefit from `SingleStrand` versus `Bars` or `Wave`

Cross-effect gaps for the initial training set:
- what are the preferred “good defaults” per effect
- what settings combinations are visually dangerous
- which props make an effect look bad even when settings are valid
- which effects are commonly overused for looks that should be simpler

## Render-Grounded Training Direction

Recommended approach:
- use xLights as the authoritative renderer
- generate controlled effect sweeps
- capture rendered outputs plus machine-readable settings
- train retrieval/scoring over render outcomes before attempting heavier model-based learning

First version should be pragmatic:
1. choose representative prop types
2. sweep meaningful settings for each target effect
3. render outputs in xLights
4. store:
   - effect name
   - prop type
   - settings
   - palette
   - buffer style
   - preview artifact
5. score similarity between desired intent and rendered exemplars

This gives the sequencer a real effect-behavior memory instead of relying only on parameter-name guesses.

## Next Checklist

### A. Audit Matrix

- [ ] Build a current effect audit matrix for the initial high-value effect set
- [ ] Mark for each effect whether support is:
  - schema-known
  - heuristically mapped
  - render-grounded
- [ ] Record the exact current parameter patterns and fixed value maps

### B. Capability Coverage

- [x] Add `SingleStrand` to the sequencer capability table
- [ ] Re-audit `On` for foundational hold/wash behavior
- [ ] Confirm the first set of common effects all have explicit supported intent dimensions

### C. Render Data Harness

- [ ] Define a fixture pack for render sweeps across common prop types
- [ ] Build a repeatable xLights render capture loop
- [ ] Persist settings + preview artifacts together
- [ ] Keep the capture set small enough for fast iteration before broadening

### D. Sequencer Eval Gates

- [ ] Add a small sequencer canary suite
- [ ] Add comparative realization checks:
  - restrained vs busy render
  - narrow focus vs broadened flood
  - smooth vs choppy motion where appropriate
- [ ] Add prop-specific realization checks for the initial effect set

### E. Promotion Rule

- [ ] Keep the designer baseline fixed while sequencer changes are made
- [ ] Promote sequencer changes only when:
  - schema-safe behavior remains intact
  - realized output is measurably better
  - no live apply/readback regressions are introduced

## Recommended Next Step

Immediate next step:
1. finish the initial effect audit matrix
2. add first-class `SingleStrand` capability coverage
3. design the first render-sweep harness around:
   - `On`
   - `SingleStrand`
   - `Bars`
   - `Wave`

That is the cleanest entry into sequencer training without destabilizing the now-stable designer layer.
