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
- Structural inheritance:
  - submodels inherit screen location and layout group from the parent model.
  - submodels inherit pixel presentation fields from the parent model (`pixelStyle`, transparency, pixel size).
- Membership and references:
  - groups may contain submodels; group containment logic includes submodel-aware checks.
  - rename/removal paths propagate through model/group structures (`RenameSubModel`, `SubModelRenamed`).
- Render semantics:
  - submodels have their own buffer styles and render-buffer node init path (`SubModel::GetBufferStyles`, `InitRenderBufferNodes`, etc.).
  - ranges-style submodels can materially change render semantics through submodel-local buffer styles such as `Keep XY`, `Stacked Strands`, `Vertical Per Strand`, and `Horizontal Per Strand`.
  - subbuffer-style submodels derive node membership from the parent model buffer region rather than explicit node ranges.

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

`layout.getSubmodelDetail` payload:
- `submodel`:
  - `id`
  - `name`
  - `type`
  - `parentId`
  - `layoutGroup`
  - `groupNames[]`
  - `startChannel`
  - `endChannel`
  - `renderLayout`
  - `submodelType`
  - `bufferStyle`
  - `availableBufferStyles[]`
- `membership`:
  - `nodeCount`
  - `nodeChannels[]`
  - `nodeRefs[]` with `channel`, `stringIndex`, `coordCount`

Important source constraints in current detail exposure:
- exact node membership is exposed read-only through automation-derived node/channel identity
- raw persisted submodel render fields are exposed read-only through the existing model XML access path used elsewhere in automation

## 5) Current xLightsDesigner Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current behavior:
- ingests `layout.getSubmodels` into `state.submodels`.
- enriches submodels with `layout.getSubmodelDetail` when the endpoint is available.
- creates `sceneGraph.submodelsById` with parent linkage.
- carries read-only submodel render metadata in scene graph context:
  - `renderLayout`
  - `submodelType`
  - `bufferStyle`
  - `availableBufferStyles[]`
- supports metadata tagging/filtering and parent-model relationships.
- passes authoritative `submodelsById` into `sequence_agent` planning context.
- planner now uses deterministic overlap semantics:
  - same-line parent + submodel overlap collapses to the parent target for broad writes,
  - separate lines preserve explicit parent-first then submodel refinement behavior,
  - sibling submodels remain valid concurrent precision targets when the parent is absent,
  - sibling submodels that truly overlap in node channels collapse deterministically to the first explicit target on the same line.

Not yet implemented:
- deeper planning semantics for submodel-specific render/buffer behavior beyond target overlap resolution.
- post-apply verification that submodel-targeted writes did not broaden unexpectedly through parent-wide side effects.

## 6) Gap List (Submodels Step)

### G1: Missing parent/submodel inheritance/render contract
Need explicit rules for:
- what defaults inherit from parent context,
- what can be overridden at submodel granularity,
- when a submodel-local buffer/render path should be treated as materially different from the parent model target.

### G2: Missing apply-time submodel precision verification
Need deterministic post-apply behavior checks when plan scope includes:
- parent model and one/more of its submodels,
- multiple submodels that overlap in channels/nodes,
- submodel-local writes that must not broaden into parent-wide side effects.

### G3: Missing planner semantics for submodel precision
Need sequencing strategy hints to choose:
- parent-level broad effects vs submodel-specific precision effects.

### G4: Missing planner use of submodel render metadata
Need explicit planning rules for when read-only submodel render metadata should affect:
- preserve-vs-broaden decisions,
- parent-safe broad writes vs submodel-precision writes,
- warning or blocking behavior when a submodel-local render path would make parent-level expansion semantically risky.

## 7) Pre-Gate Decision
Pre-gate status for Phase I submodels:
- source audit: COMPLETE
- API coverage map: COMPLETE
- gap list: READY FOR APPROVAL
- semantic implementation: NOT STARTED

## 8) Recommended Next Implementation Slice
1. Define canonical parent/submodel render inheritance rules for planning.
2. Distinguish parent-safe broad writes from submodel-precision writes when submodel-local render paths differ materially.
3. Add apply verification checks for submodel precision safety.
4. Decide whether raw submodel render metadata should be exposed in automation for v1 planning fidelity.
