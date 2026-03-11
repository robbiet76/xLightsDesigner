# Model Layout Pre-Gate Audit

Status: Draft (pre-gate in progress)
Date: 2026-03-11
Owner: xLightsDesigner Team

## 1) Scope
This audit covers Item 1 from Phase I:
- show layout and model placement in space.

Method:
1. scan xLights source for authoritative layout/model APIs and payload builders,
2. map source payloads to current xLightsDesigner API wrappers and usage,
3. identify gaps before semantic scene-graph modeling.

## 2) xLights Source of Truth
Primary source files:
- `/Users/robterry/xLights/xLights/automation/api/LayoutV2Api.inl`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

Key v2 layout endpoints confirmed in source:
- `layout.getModels`
- `layout.getModel`
- `layout.getModelGeometry`
- `layout.getModelNodes`
- `layout.getCameras`
- `layout.getScene`
- `layout.getViews`
- `layout.getDisplayElements`
- `layout.getSubmodels`

Capability listing source:
- `GetV2Commands()` in `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

## 3) Authoritative Payload Fields (from source)

### 3.1 `layout.getModels` (BuildV2ModelData)
Per model fields:
- `name`
- `type` (`GetDisplayAs()`)
- `startChannel`
- `endChannel`
- `layoutGroup`
- `groupNames[]`

### 3.2 `layout.getDisplayElements` (BuildLayoutDisplayElementsData)
Per element fields:
- `id` (full name)
- `name`
- `type` (`model|timing|submodel|strand`)
- `orderIndex`
- `parentId` (when derivable from full name)

### 3.3 `layout.getSubmodels` (BuildLayoutSubmodelsData)
Per submodel fields:
- `id`
- `name`
- `type` (`submodel`)
- `parentId`
- `layoutGroup`
- `groupNames[]`
- `startChannel`
- `endChannel`

### 3.4 `layout.getModelGeometry` / `layout.getScene` (BuildModelGeometryData)
Per model geometry fields:
- `name`
- `type`
- `layoutGroup`
- `groupNames[]`
- `transform.position.{x,y,z}`
- `transform.rotationDeg.{x,y,z}`
- `transform.scale.{x,y,z}`
- `dimensions.{width,height,depth}`
- `attributes` (parsed JSON object)

`layout.getScene` additionally returns:
- `models[]` (geometry payloads)
- `views[]`
- `displayElements[]`
- `cameras[]` (optional via `includeCameras`)
- optional model `nodes[]` (via `includeNodes`)

## 4) Current xLightsDesigner API Surface
File:
- `apps/xlightsdesigner-ui/api.js`

Currently wrapped:
- `layout.getModels`
- `layout.getDisplayElements`
- `layout.getSubmodels`

Not yet wrapped (despite being available in xLights source):
- `layout.getModel`
- `layout.getModelGeometry`
- `layout.getModelNodes`
- `layout.getScene`
- `layout.getViews`
- `layout.getCameras`

## 5) Current App Usage Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current usage of layout data is metadata-target oriented (name/type/parent), not spatial:
- uses `models` and `submodels` mainly for ID/name/type filtering and orphan logic,
- does not ingest or persist geometry transforms,
- does not ingest views/cameras/nodes,
- does not build scene graph or spatial queries.

## 6) Gap List (Model Layout Step)

### G1: Missing wrapper coverage for spatial endpoints
Need API wrappers for:
- `layout.getScene`
- `layout.getModelGeometry`
- `layout.getViews`
- `layout.getCameras`
- (optional for later) `layout.getModelNodes`

### G2: No canonical scene graph in app state
Need normalized state shape for:
- model transforms/dimensions/attributes,
- hierarchy links (parent/group/submodel),
- view/camera metadata.

### G3: No spatial helper/query layer
Need deterministic utilities for:
- region selection,
- proximity/adjacency,
- orientation-aware grouping.

### G4: No capability-gated fallback policy for layout detail
Need policy when advanced layout endpoints are unavailable:
- degrade to `layout.getModels` + `layout.getSubmodels` + `layout.getDisplayElements`,
- emit explicit diagnostics and block spatial planning features.

## 7) Pre-Gate Decision
Pre-gate status for Item 1 (layout/spatial):
- Source audit: COMPLETE
- API coverage map: COMPLETE
- Gap list: READY FOR APPROVAL
- Semantic implementation: NOT STARTED

## 8) Recommended Next Implementation Slice
1. Add missing layout wrappers in `apps/xlightsdesigner-ui/api.js`.
2. Add `loadLayoutScene()` data ingest in app runtime (read-only first).
3. Add normalized `sceneGraph` state + diagnostics summary.
4. Add tests for payload normalization and fallback behavior.

