# Designer-to-Sequencer Effect Placement Contract

Status: Proposed
Date: 2026-03-17
Owner: xLightsDesigner Team

## Purpose

Define the correct responsibility boundary between `designer_dialog` and `sequence_agent` for effect authoring.

This spec replaces the current section-hint-heavy handoff model with a placement-first contract that can carry:
- exact effect windows
- target layers
- effect settings intent
- palette intent
- layer intent
- render intent

The goal is to let the designer express exactly what it wants while keeping xLights-specific translation and execution in the sequencer.

## Audit Summary

### What xLights execution already supports

The current sequencing/apply/runtime path already supports per-effect execution with:
- `modelName`
- `layerIndex`
- `effectName`
- `startMs`
- `endMs`
- `settings`
- `palette`

Evidence:
- `apps/xlightsdesigner-ui/agent/sequence-agent/command-builders.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/orchestrator.js`
- `xLights/xLightsDesigner/api/models/EffectModels.h`
- `xLights/xLightsDesigner/api/handlers/EffectHandler.h`

The owned xLights batch routes support a batch of effect items, each carrying its own:
- target
- layer
- effect type
- exact time window
- settings blob
- palette blob

### What xLights layer/render execution already supports

The xLights core surface also exposes layer/render controls that must be respected by the future contract.

#### Layer blend / mix settings

Observed in xLights core:
- `T_CHOICE_LayerMethod`
- `T_SLIDER_EffectLayerMix`
- `T_LayersSelected`

Evidence:
- `xLights/TimingPanel.cpp`
- `xLights/RenderableEffect.cpp`
- `xLights/PixelBuffer.cpp`
- `xLights/LOREdit.cpp`

Known layer blend methods visible in xLights UI include:
- `Normal`
- `Effect 1`
- `Effect 2`
- `1 is Mask`
- `2 is Mask`
- `1 is Unmask`
- `2 is Unmask`
- `1 is True Unmask`
- `2 is True Unmask`
- `1 reveals 2`
- `2 reveals 1`
- `Shadow 1 on 2`
- `Shadow 2 on 1`
- `Layered`
- `Average`
- `Bottom-Top`
- `Left-Right`
- `Highlight`
- `Highlight Vibrant`
- `Additive`
- `Subtractive`
- `Brightness`
- `Max`
- `Min`

#### Group/render/buffer behavior

Observed render-policy-related data already used by the sequencer side:
- `defaultBufferStyle`
- `availableBufferStyles`
- `renderPolicy`
- `riskLevel`
- `currentFamily`

Evidence:
- `xLights/automation/xLightsAutomations.cpp`
- `xLights/models/ModelGroup.cpp`
- `apps/xlightsdesigner-ui/agent/sequence-agent/command-builders.js`

Current render-policy families seen in the stack include:
- `default`
- `overlay`
- `per_model`
- `per_model_strand`
- `single_line`
- `stack`

The current sequencer already treats render-policy differences as meaningful, especially for:
- group expansion
- submodel collapse avoidance
- render-risk warnings

### What the current designer contract supports

The current designer contract can express:
- broad pass scope
- section plans
- target ids
- effect hints
- intent summaries
- palette direction at a high level

Evidence:
- `apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-contracts.js`
- `apps/xlightsdesigner-ui/agent/designer-dialog/designer-dialog-runtime.js`
- `apps/xlightsdesigner-ui/agent/sequence-agent/sequence-intent-handoff.js`

### What the current designer contract does not support

The current designer contract does **not** explicitly carry, per effect placement:
- exact `startMs`
- exact `endMs`
- `layerIndex`
- multiple placements on the same target within one section as first-class data
- effect-specific settings intent as structured data
- palette intent per placement
- layer blend intent per placement
- render/buffer intent per placement/group target

This is the main gap.

## Coverage Status

### Already covered in the runtime / execution path

The current sequencer + owned xLights runtime can already execute placements with:
- exact `startMs`
- exact `endMs`
- explicit `layerIndex`
- xLights `settings`
- xLights `palette`
- batch application across many targets/effects

This means the lower execution layer is already compatible with the desired model.

### Not yet covered in the designer handoff

The current designer-originated handoff does not yet make the following first-class and explicit:
- exact placement windows per effect
- multiple placements for the same target within one section
- per-placement layer choice
- per-placement settings intent
- per-placement palette intent
- per-placement layer/render intent

This means the current upstream contract is still under-specified for full designer-led sequencing.

## Responsibility Boundary

### Designer owns

The designer must own the exact creative placement intent.

That includes:
- target selection
- layer selection
- effect choice
- exact start time
- exact end time
- why the effect exists
- palette direction
- settings intent
- layer intent
- render intent

The designer is responsible for deciding **what** should happen.

### Sequencer owns

The sequencer must own xLights translation and safe execution.

That includes:
- target resolution to actual xLights elements/submodels/groups
- effect name normalization to xLights effect catalog
- mapping intent fields to raw xLights `settings` / `palette`
- mapping layer intent to xLights layer method / mix controls
- handling group render policy and expansion rules
- building xLights-safe command graphs
- owned API submission and readback verification

The sequencer is responsible for deciding **how xLights performs** what the designer requested.

## Contract Rule

The designer must not hand off only section-level effect hints for execution.

Section-level information is allowed as context, but execution must be carried by explicit effect placements.

Sections are alignment/reference structure.
Effects are the actual execution units.

## Proposed Contract Shape

Add a new first-class payload under the designer proposal/execution model:
- `effectPlacements[]`

Each placement should include:

```json
{
  "placementId": "string",
  "targetId": "Snowman",
  "layerIndex": 1,
  "effectName": "Shimmer",
  "startMs": 78230,
  "endMs": 84500,
  "timingContext": {
    "trackName": "XD: Song Structure",
    "anchorLabel": "Chorus 1",
    "anchorStartMs": 78230,
    "anchorEndMs": 97120,
    "alignmentMode": "within_section"
  },
  "creative": {
    "role": "focal_accent",
    "purpose": "lift the lead focal during the first chorus",
    "notes": "short brighter accent before the full wash returns"
  },
  "settingsIntent": {
    "intensity": "medium_high",
    "speed": "medium",
    "density": "light",
    "coverage": "partial",
    "motion": "sparkle",
    "variation": "low"
  },
  "paletteIntent": {
    "colors": ["warm gold", "amber"],
    "temperature": "warm",
    "contrast": "medium",
    "brightness": "high",
    "accentUsage": "primary"
  },
  "layerIntent": {
    "priority": "foreground",
    "blendRole": "accent_overlay",
    "overlayPolicy": "allow_overlay",
    "mixAmount": "default"
  },
  "renderIntent": {
    "groupPolicy": "preserve_group_rendering",
    "bufferStyle": "inherit",
    "expansionPolicy": "no_expand",
    "riskTolerance": "low"
  },
  "constraints": {
    "mustAlignToTiming": true,
    "preserveExistingEffects": false,
    "mustNotOverlap": false
  }
}
```

## Placement Field Requirements

### Required fields

Every `effectPlacements[]` item must provide:
- `placementId`
- `targetId`
- `layerIndex`
- `effectName`
- `startMs`
- `endMs`

### Strongly recommended fields

These should be present for any designer-authored placement unless intentionally omitted by policy:
- `timingContext`
- `creative`
- `settingsIntent`
- `paletteIntent`
- `layerIntent`
- `renderIntent`

### Optional fields

These are optional but useful for validation, review, and future replay behavior:
- `constraints`
- `confidence`
- `traceability`
- `sourceSectionLabel`
- `notes`

## Interpretation Rules

### Exact windows are mandatory

Every placement must provide:
- `startMs`
- `endMs`

The designer must not rely on the sequencer to invent the actual window from a section label alone.

### Layers are mandatory when placement is explicit

Every placement must provide:
- `layerIndex`

The sequencer may normalize or validate the layer, but it must not invent the intended layer when the designer is authoring exact placement data.

### Section data is contextual, not executable

`timingContext` can help with:
- review
- validation
- alignment
- diagnostics

But it is not the execution unit.

### Multiple effects per section/target are normal

The contract must allow multiple placements that share:
- target
- section
- timing track

but differ in:
- layer
- effect type
- exact timing window
- settings/palette/layer/render intent

## Settings Audit Coverage

### Effect settings

We should support intent capture for:
- intensity
- speed
- density
- coverage
- motion
- variation
- direction
- thickness
- count/repeat
- fade behavior
- symmetry / randomness

The designer should express these as normalized intent fields.
The sequencer should map them to effect-specific xLights settings.

Minimum normalized vocabulary to support in the designer contract:
- `intensity`
- `speed`
- `density`
- `coverage`
- `motion`
- `variation`
- `direction`
- `thickness`
- `repeat`
- `fadeIn`
- `fadeOut`
- `symmetry`
- `randomness`

### Palette settings

We should support intent capture for:
- explicit colors
- color temperature
- contrast
- brightness
- saturation
- accent usage
- gradient / blend behavior where relevant

The designer should not emit raw `C_BUTTON_Palette*` fields.
The sequencer should map palette intent to xLights palette fields.

Minimum normalized vocabulary to support in the designer contract:
- `colors`
- `temperature`
- `contrast`
- `brightness`
- `saturation`
- `accentUsage`
- `gradientMode`
- `blendBias`

### Layer settings

We should support intent capture for:
- target layer index
- blend role
- mix amount
- overlay policy
- stacking priority
- mask/unmask intent where explicitly needed

The sequencer should map these to xLights layer controls such as:
- `T_CHOICE_LayerMethod`
- `T_SLIDER_EffectLayerMix`
- `T_LayersSelected` when needed

Minimum normalized vocabulary to support in the designer contract:
- `priority`
- `blendRole`
- `mixAmount`
- `overlayPolicy`
- `stackingPolicy`
- `maskPolicy`

### Render settings

We should support intent capture for:
- preserve group rendering vs expand members
- inherit group buffer style vs override
- allow expansion / fanout / stagger
- render-risk tolerance

The sequencer should continue to own:
- actual group expansion behavior
- submodel collapse protection
- render-risk warnings

Minimum normalized vocabulary to support in the designer contract:
- `groupPolicy`
- `bufferStyle`
- `expansionPolicy`
- `distributionPolicy`
- `riskTolerance`

## Responsibility Matrix

| Concern | Designer owns | Sequencer owns |
| --- | --- | --- |
| Effect placement window | Exact desired `startMs` / `endMs` | Validation, clamping, safe execution |
| Target choice | Creative target/group/submodel choice | Resolve to actual xLights model/submodel/group |
| Layer choice | Intended `layerIndex` and layer role | Validate/create/normalize xLights layer state |
| Effect choice | Desired effect behavior | Normalize to xLights effect catalog |
| Effect settings | Intent shape | Map to raw xLights settings keys/values |
| Palette | Palette intent | Map to raw xLights palette fields |
| Layer blend/mix | Blend intent | Map to `T_CHOICE_LayerMethod` / `T_SLIDER_EffectLayerMix` |
| Render/group behavior | Render intent | Group expansion, buffer-style handling, render-risk controls |
| Apply mechanics | None | Build command graph, submit jobs, verify readback |

## Sequencer Translation Layer Shape

The sequencer should own a capability/mapping catalog per supported effect family.

Each effect definition should specify:
- supported `settingsIntent` keys
- supported `paletteIntent` keys
- supported `layerIntent` keys
- supported `renderIntent` keys
- defaults
- normalization rules
- downgrade rules when intent exceeds support
- validation failures that should block apply

This layer is required so the designer can stay intent-oriented without becoming coupled to raw xLights fields.

## Review / UI Implications

Because placements are the true execution unit, review surfaces should eventually summarize:
- target
- layer
- effect name
- exact start/end window
- timing anchor
- summarized settings/palette/layer/render intent

Section summaries remain useful, but only as grouping/context over placements.

## Sequencer Translation Layer Requirement

Before implementing this contract, add or formalize an effect-translation layer that owns:
- supported effect capability metadata
- supported settings-intent keys per effect
- intent-to-xLights settings mapping
- palette-intent to xLights palette mapping
- layer-intent to xLights layer mapping
- render-intent to xLights/group-policy mapping
- downgrade / validation behavior when intent exceeds supported effect capability

This must live on the sequencer side, not the designer side.

## Current Gap Statement

Today:
- runtime execution is already capable of exact per-effect windows and layers
- designer handoff is still too section-oriented and implicit

Therefore:
- do not keep expanding section-plan execution as the long-term model
- move next to explicit placement-based designer handoffs

## Implementation Gate

Do not implement broad whole-sequence designer authoring on top of the current section-hint contract as the final model.

Required first:
1. finalize placement contract
2. finalize effect/layer/render intent taxonomy
3. finalize sequencer translation-layer responsibilities
4. then implement designer placement emission and sequencer consumption

## Implementation Sequence

1. Extend the designer contract to allow `effectPlacements[]` alongside existing `sectionPlans`.
2. Keep `sectionPlans` as review/grouping context, not as the execution unit.
3. Add sequencer capability metadata for effect/settings/palette/layer/render mapping.
4. Teach `sequence_agent` to prefer `effectPlacements[]` over section-level hints when present.
5. Update review/dashboard surfaces to render placement-backed summaries.
6. Only then expand whole-sequence designer authoring on top of the placement-first contract.
