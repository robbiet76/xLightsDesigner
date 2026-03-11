# Submodels Pre-Gate Audit

Status: Draft (pre-gate in progress)  
Date: 2026-03-11  
Owner: xLightsDesigner Team

## 1) Scope
This audit covers Phase I checklist item:
- submodels and functionality.

Pre-gate goal:
1. identify authoritative xLights submodel semantics in source,
2. map current automation API exposure,
3. define gaps before submodel inheritance/override rules are encoded.

## 2) xLights Source of Truth
Primary source files:
- `/Users/robterry/xLights/xLights/models/SubModel.h`
- `/Users/robterry/xLights/xLights/models/SubModel.cpp`
- `/Users/robterry/xLights/xLights/models/Model.h`
- `/Users/robterry/xLights/xLights/models/Model.cpp`
- `/Users/robterry/xLights/xLights/models/ModelManager.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/automation/api/LayoutV2Api.inl`

Authoritative identity:
- Submodel type identity is `DisplayAs = "SubModel"`.
- Submodels are owned by parent models (`Model::GetSubModels()`), not top-level layout models.
- Automation exposes a flattened submodel list through `layout.getSubmodels`.

## 3) Authoritative Submodel Functionality (from source)
Core source-level behavior:
- Ownership and lookup:
  - parent model stores/returns submodels via `GetSubModels()` / `GetSubModel(name)`.
  - submodel IDs use full names (`Parent/SubmodelName`) in automation output.
- Membership and references:
  - groups may contain submodels; group containment logic includes submodel-aware checks.
  - rename/removal paths propagate through model/group structures (`RenameSubModel`, `SubModelRenamed`).
- Render semantics:
  - submodels have their own buffer styles and render-buffer node init path (`SubModel::GetBufferStyles`, `InitRenderBufferNodes`, etc.).

## 4) Current Automation API Exposure
`layout.getSubmodels` payload (from `BuildLayoutSubmodelsData`):
- `id` (full name, typically `Parent/Submodel`)
- `name`
- `type` (`submodel`)
- `parentId` (parent model name)
- `layoutGroup`
- `groupNames[]` (groups containing this submodel)
- `startChannel`
- `endChannel`

Important source constraints in current exposure:
- excludes parents that are `ModelGroup` or `SubModel`.
- submodel list is flattened and read-only.

## 5) Current xLightsDesigner Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current behavior:
- ingests `layout.getSubmodels` into `state.submodels`.
- creates `sceneGraph.submodelsById` with parent linkage.
- supports metadata tagging/filtering and parent-model relationships.

Not yet implemented:
- explicit inheritance rules between parent model and submodel semantics.
- deterministic override policy for planning when both parent and submodel are in scope.
- conflict-resolution rules for parent/submodel target overlaps.

## 6) Gap List (Submodels Step)

### G1: Missing parent/submodel inheritance contract
Need explicit rules for:
- what defaults inherit from parent context,
- what can be overridden at submodel granularity.

### G2: Missing overlap/conflict policy
Need deterministic behavior when plan scope includes:
- parent model and one/more of its submodels,
- multiple submodels that overlap in channels/nodes.

### G3: Missing planner semantics for submodel precision
Need sequencing strategy hints to choose:
- parent-level broad effects vs submodel-specific precision effects.

### G4: Missing verification contract for submodel writes
Need post-apply checks that distinguish:
- intended submodel-targeted changes,
- unintended parent-wide side effects.

## 7) Pre-Gate Decision
Pre-gate status for Phase I submodels:
- source audit: COMPLETE
- API coverage map: COMPLETE
- gap list: READY FOR APPROVAL
- semantic implementation: NOT STARTED

## 8) Recommended Next Implementation Slice
1. Define canonical parent/submodel precedence rules for command synthesis.
2. Add target overlap resolver (parent vs submodel) in sequence-agent planning stage.
3. Add tests for mixed parent/submodel scopes and conflict-free command output.
4. Add apply verification checks for submodel precision safety.
