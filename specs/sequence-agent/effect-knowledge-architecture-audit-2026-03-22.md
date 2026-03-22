# Effect Knowledge Architecture Audit

## Summary

The repo is working, but effect knowledge is split across:

1. generated Stage 1 training knowledge
2. hand-authored capability metadata
3. hardcoded runtime routing heuristics

That split is now the main architectural risk for sequencer training.

The practical impact:
- training improvements can require runtime code edits
- visual-family semantics are duplicated in multiple places
- designer and sequencer layers can drift from the Stage 1 render-training source of truth

This is still recoverable without a rewrite. The right next step is consolidation, not replacement.

## Current Sources Of Truth

### 1. Generated training knowledge

Primary file:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)

Backed by:
- generated Stage 1 bundle in `agent/sequence-agent/generated/`

This layer already owns:
- selector-ready effect set
- trained effect profiles
- supported model buckets
- visual-family-to-effect mappings
- keyword maps used by trained recommendation helpers

This is the best candidate for the authoritative runtime effect-semantics layer.

### 2. Hand-authored capability metadata

Primary file:
- [effect-intent-capabilities.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/effect-intent-capabilities.js)

This layer is useful for:
- parameter intent support
- effect family classification
- xLights parameter-pattern expectations

This should remain, but it should complement trained knowledge rather than restate effect-selection semantics.

### 3. Hardcoded runtime routing

Primary hotspots:
- [designer-dialog-runtime.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-runtime.js)
- [sequence-agent.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/sequence-agent.js)
- [command-builders.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/command-builders.js)
- [apply-readback.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/apply-readback.js)

This is where most of the architectural drift lives.

## Findings

### Finding 1

Visual-family semantics were duplicated.

Observed in:
- [trained-effect-knowledge.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/trained-effect-knowledge.js)
- [apply-readback.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/apply-readback.js)

Status:
- fixed in this pass
- `apply-readback.js` now imports `VISUAL_FAMILY_EFFECT_MAP` from trained knowledge instead of restating it

This is the model to follow for the rest of the consolidation work.

### Finding 2

`designer-dialog-runtime.js` contains large hardcoded effect-family routing tables.

Examples:
- section-family pools
- effect canonicalization aliases
- large regex-driven routing branches such as:
  - `marquee -> Marquee`
  - `shockwave/ring burst -> Shockwave`
  - `spiral -> Spirals`
  - `twinkle/shimmer texture -> Shimmer/Twinkle`
- extensive section/energy/density heuristic tables

Assessment:
- some of this is legitimate designer-language normalization
- too much of it is effect selection policy that should be driven by metadata/trained knowledge

### Finding 3

`sequence-agent.js` still has hand-authored fallback chains for effect choice.

Examples:
- `["Shimmer", "Twinkle"]`
- `["Bars", "Marquee", "SingleStrand"]`
- `["On", "Color Wash"]`
- `["Color Wash", "On", "Shimmer"]`

Assessment:
- these are valid as safety fallbacks
- they should not be the primary source of effect semantics
- they should be generated from a shared effect-semantics policy layer where possible

### Finding 4

`command-builders.js` has a separate phrase-to-effect map.

Examples:
- `bars -> Bars`
- `sparkle/twinkle/glitter -> Shimmer`
- `wash/sweep -> Color Wash`
- `hold/solid/steady/glow -> On`

Assessment:
- this duplicates trained keyword knowledge
- it may remain as a compatibility shim for legacy free-text proposal lines
- but it should consume a shared alias/keyword source instead of defining its own effect intent lexicon

### Finding 5

`effect-intent-capabilities.js` is not the main problem.

This file mostly captures:
- supported settings intent
- palette intent
- layer intent
- render intent
- parameter-name patterns

Assessment:
- this is acceptable metadata
- it is closer to effect capability description than routing logic
- it should stay, but be clearly separated from effect-selection policy

### Finding 6

Some hardcoded effect names are operational and acceptable.

Examples:
- xLights transition compatibility strings
- demo fixtures in `app.js`
- test/demo proposal builders

Assessment:
- these are not the priority
- they are not the same problem as routing duplication

## Classification

### Should move to generated or shared knowledge

These should be consolidated behind one shared effect-semantics layer:

- visual-family-to-effect mappings
- effect keyword/alias maps
- selector-ready fallback preference chains
- explicit effect synonym canonicalization
- common “intent cue -> candidate effects” logic

Primary consumers:
- `designer-dialog-runtime.js`
- `sequence-agent.js`
- `command-builders.js`
- `apply-readback.js`

### Should remain as hand-authored metadata

- parameter intent support
- palette/layer/render capability metadata
- xLights transition compatibility mappings
- effect-specific parameter pattern hints

Primary owner:
- `effect-intent-capabilities.js`

### Should remain as runtime logic

- graph validation
- sequence scope protection
- apply/readback orchestration
- revision identity/supersession rules
- xLights compatibility gates

## Recommended Target Architecture

Create one shared layer, likely something like:
- `effect-semantics-registry.js`

It should be built from:
- generated Stage 1 training bundle
- shared authored metadata for gaps not covered by training

It should expose:
- canonical effect aliases
- visual-family mappings
- trained candidate effects by geometry
- fallback candidate chains
- normalized keyword/synonym lookup

Then:
- `designer-dialog-runtime.js` uses it for candidate selection
- `sequence-agent.js` uses it for fallback and constraint-aware selection
- `command-builders.js` uses it for phrase compatibility fallback
- `apply-readback.js` uses it for design-alignment interpretation

## Recommended Execution Order

### Step 1

Finish deduping shared maps.

Completed in this pass:
- `VISUAL_FAMILY_EFFECT_MAP` now comes from trained knowledge

Next:
- move shared alias/keyword maps into one shared module

### Step 2

Extract a small authoritative effect-semantics module.

Scope:
- aliases
- visual families
- trained candidate lookups
- safe fallback chains

Keep it small at first.

### Step 3

Move `designer-dialog-runtime.js` off large local effect tables where possible.

This is the highest-value consolidation target because it currently owns the heaviest effect-routing logic.

### Step 4

Reduce `sequence-agent.js` fallback chains to:
- compatibility fallback
- availability fallback

Not primary semantics.

### Step 5

Move legacy `command-builders.js` phrase heuristics onto the same shared alias/keyword layer.

## Immediate Next Step

The next concrete refactor should be:

1. add a shared effect-semantics registry module
2. move alias and visual-family lookup into it
3. switch:
   - `designer-dialog-runtime.js`
   - `sequence-agent.js`
   - `command-builders.js`
   to consume it

That is the smallest refactor that materially reduces architectural drift without interrupting Phase 2 progress.
