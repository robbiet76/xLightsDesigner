# Effects Types and Settings Pre-Gate Audit

Status: Draft (pre-gate in progress)  
Date: 2026-03-11  
Owner: xLightsDesigner Team

## 1) Scope
This audit covers Phase I checklist item:
- effects types and settings.

Pre-gate goal:
1. confirm authoritative effects API surface from xLights source,
2. map effect definition/settings exposure for machine use,
3. identify gaps before encoding effect compatibility rules in `sequence_agent`.

## 2) xLights Source of Truth
Primary source files:
- `/Users/robterry/xLights/xLights/automation/api/EffectsV2Api.inl`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/effects/*` (effect implementations and panels)

Runtime binding flow:
- `HandleEffectsV2Command(...)` is wired in `xLightsAutomations.cpp`.
- effect definitions are introspected via `frame->GetEffectManager()`.
- effect parameter metadata is extracted from effect UI controls/panels.

## 3) Authoritative Effects V2 Command Coverage (from source)
Commands confirmed implemented in `EffectsV2Api.inl`:
- `effects.listDefinitions`
- `effects.getDefinition`
- `effects.list`
- `effects.getPalette`
- `effects.getRenderStyleOptions`
- `effects.setRenderStyle`
- `effects.setPalette`
- `effects.deleteLayer`
- `effects.compactLayers`
- `effects.create`
- `effects.update`
- `effects.delete`
- `effects.shift`
- `effects.alignToTiming`
- `effects.clone`

## 4) Effect Definition / Settings Exposure
`effects.listDefinitions` / `effects.getDefinition` expose:
- `effectName`
- `displayName`
- `effectId`
- `category` (currently generic in source)
- `supportsPartialTimeInterval`
- `params[]` extracted from effect panel controls:
  - typed metadata inferred from control name families (`int`, `enum`, `bool`, `string`, `curve`, `file`)
  - optional ranges/defaults/enumValues when derivable from controls

Settings and palette mutation paths:
- create/update accept settings and palette payloads.
- list returns parsed settings/palette JSON for existing effects.
- palette-specific read/write endpoints available (`getPalette`, `setPalette`).

Render-style settings surface:
- `effects.getRenderStyleOptions` exposes model-specific:
  - `renderStyles`
  - `cameraOptions`
  - `transformOptions`
- `effects.setRenderStyle` validates selected render style/camera/transform against those options.

## 5) Current xLightsDesigner Coverage
Current app-layer sequencing execution is still minimal:
- `apps/xlightsdesigner-ui/agent/command-builders.js` emits only timing-track commands (`timing.createTrack`, `timing.insertMarks`).
- no canonical effects command templates are generated yet.
- no effect-definition caching/catalog consumption exists in runtime planner path.

## 6) Gap List (Effects Types and Settings Step)

### G1: Missing canonical effect catalog in app layer
Need normalized local catalog synthesized from:
- `effects.listDefinitions` output,
- stable canonical ids and parameter schemas.

### G2: Missing model-type × effect compatibility matrix
Need deterministic compatibility rules combining:
- model type/category semantics,
- effect definition constraints,
- render style capabilities.

### G3: Missing parameter schema validator in planner path
Need command synthesis guards that validate:
- parameter keys/types/ranges/enums,
- render-style/camera/transform compatibility before apply.

### G4: Missing deterministic effect command templates
Need sequence-agent command graph templates for:
- create/update/delete/shift/align/clone flows,
- predictable layer and range behavior.

### G5: Missing verification contract for effect writes
Need post-apply verification checks for:
- expected effect count deltas,
- expected effect interval updates,
- settings/palette update confirmation.

## 7) Pre-Gate Decision
Pre-gate status for Phase I effects types/settings:
- source audit: COMPLETE
- API coverage map: COMPLETE
- gap list: READY FOR APPROVAL
- semantic implementation: NOT STARTED

## 8) Recommended Next Implementation Slice
1. Add effect definition ingest/cache module in app agent layer.
2. Define canonical effect parameter schema normalization.
3. Build model-type/effect compatibility evaluator.
4. Add initial deterministic effect command templates and tests.
