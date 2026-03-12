# Model Types Pre-Gate Audit

Status: Draft (pre-gate in progress)  
Date: 2026-03-11  
Owner: xLightsDesigner Team

## 1) Scope
This audit covers Phase I checklist item:
- model types and functionality.

Pre-gate goal:
1. identify the authoritative xLights source of model type identity,
2. map what automation API exposes today,
3. define what is missing for sequence-agent model-type-aware planning.

## 2) xLights Source of Truth
Primary source files:
- `/Users/robterry/xLights/xLights/models/ModelManager.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/automation/api/LayoutV2Api.inl`

Authoritative type identity flow:
1. xLights model type identity is the `DisplayAs` string.
2. `ModelManager::CreateModel(...)` dispatches model class creation from `DisplayAs`.
3. Automation `layout.getModels` and `layout.getScene` return `type = model->GetDisplayAs()`.

## 3) Authoritative Model Type Dispatch (from source)
From `ModelManager::CreateModel`, current dispatch branches include:

Exact-type branches:
- `Star`
- `Arches`
- `Candy Canes`
- `Channel Block`
- `Circle`
- `DmxMovingHead`
- `DmxGeneral`
- `DmxMovingHeadAdv`
- `DmxFloodlight`
- `DmxFloodArea`
- `DmxSkull`
- `DmxSkulltronix` (deprecated warning in source)
- `DmxServo`
- `DmxServo3d`
- `Image`
- `Window Frame`
- `Wreath`
- `Single Line`
- `Poly Line`
- `MultiPoint`
- `Cube`
- `Custom`
- `WholeHouse`
- `Vert Matrix`
- `Horiz Matrix`
- `Spinner`
- `ModelGroup`
- `SubModel`

Prefix/variant branches:
- `Sphere*` -> `SphereModel`
- `Tree*` -> `TreeModel` (variants include strings like `Tree 360`, `Tree Flat`, `Tree Ribbon`)
- `Icicles*` -> `IciclesModel`

Migration/legacy remaps in source:
- `DMX` legacy styles remapped to specific DMX types.
- `DmxMovingHead3D` remapped to `DmxMovingHeadAdv`.
- `DmxServo3Axis` remapped to `DmxServo3d`.

## 4) Current Automation API Exposure
Current API payload shape for model type:
- `layout.getModels[].type` -> raw `DisplayAs` string.
- `layout.getModel.type` -> raw `DisplayAs` string.
- `layout.getScene.models[].type` -> raw `DisplayAs` string.

What is exposed well:
- stable type identity string for each model.
- grouping identity (`ModelGroup`) and submodel identity (`SubModel`) are explicit.

What is not exposed yet:
- canonical normalized model-type enum.
- model-type category (prop, matrix, line, tree, DMX fixture, group, submodel, etc.).
- per-type capability/functionality metadata (supports strands, supports 3D transform semantics, expected node topology patterns, etc.).
- deprecation flags (for types like `DmxSkulltronix`).

## 5) Current xLightsDesigner Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current handling:
- keeps `type` as passthrough string from xLights.
- only special-case normalization currently implemented is `ModelGroup -> group`.
- no model-type ontology or capability map is used by `sequence_agent` planning today.

## 6) Gap List (Model Types Step)

### G1: Missing canonical model-type ontology in app layer
Need a deterministic mapping layer:
- raw `DisplayAs` -> canonical type id,
- canonical type id -> category + planning hints.

### G2: Missing model-type functionality contract
Need model-type capability descriptors for planning constraints, for example:
- shape/topology-oriented targeting guidance,
- effect suitability hints,
- DMX fixture safety/precision flags,
- group/submodel composition semantics.

### G3: Missing compatibility/deprecation surface
Need explicit metadata for:
- deprecated model types,
- legacy aliases/remaps from source.

### G4: Planner not yet consuming model-type semantics
`sequence_agent` currently uses target ids/tags/sections but does not vary strategy by model type.

## 7) Pre-Gate Decision
Pre-gate status for Phase I model types:
- source audit: COMPLETE
- API coverage map: COMPLETE
- gap list: READY FOR APPROVAL
- semantic implementation: NOT STARTED

## 8) Recommended Next Implementation Slice
1. Create canonical model-type catalog (`raw displayAs -> canonicalType`) in `apps/xlightsdesigner-ui/agent/`.
2. Add model-type category/functionality metadata schema and tests.
3. Emit normalized model-type summary in scene graph stats/diagnostics.
4. Inject model-type semantic hints into `sequence_agent` scope/effect strategy stage.
