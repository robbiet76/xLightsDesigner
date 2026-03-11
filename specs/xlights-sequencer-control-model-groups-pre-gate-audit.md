# Model Groups Pre-Gate Audit

Status: Draft (pre-gate in progress)  
Date: 2026-03-11  
Owner: xLightsDesigner Team

## 1) Scope
This audit covers Phase I checklist item:
- model groups and functionality.

Pre-gate goal:
1. identify authoritative xLights model-group behavior,
2. map current API surface available to xLightsDesigner,
3. define gaps before group behavior rules are encoded in `sequence_agent`.

## 2) xLights Source of Truth
Primary source files:
- `/Users/robterry/xLights/xLights/models/ModelGroup.h`
- `/Users/robterry/xLights/xLights/models/ModelGroup.cpp`
- `/Users/robterry/xLights/xLights/models/ModelManager.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/automation/api/LayoutV2Api.inl`

Authoritative identity:
- Group type identity is `DisplayAs = "ModelGroup"`.
- `ModelManager::CreateModel(...)` instantiates `ModelGroup` for group nodes.
- Automation `layout.getModels` exposes group rows via `type = "ModelGroup"`.

## 3) Authoritative Group Functionality (from source)
Core behaviors in `ModelGroup` implementation:
- Membership and recursion:
  - `ModelNames()`, `Models()`, `ActiveModels()`
  - recursive flattening via `GetFlatModels(removeDuplicates, activeOnly)`
  - cycle-safe containment checks (`ContainsModelGroup`, visited-set logic)
- Containment semantics:
  - direct containment (`DirectlyContainsModel`)
  - recursive containment (`ContainsModel`)
  - model-or-submodel containment (`ContainsModelOrSubmodel`)
  - single-base-model constraint checks (`OnlyContainsModel`)
- Lifecycle/mutation hooks:
  - `AddModel`, `ModelRemoved`, `ModelRenamed`, `SubModelRenamed`
  - duplicate cleanup (`RemoveDuplicates`)
  - sync/reset behavior (`Reset`, `ResetModels`)
- Group render semantics:
  - custom group buffer styles beyond default model styles (horizontal/vertical stacks, overlays, per-model/strand variants, etc.)
  - group-specific render-buffer node initialization and sizing logic.

Operational constraints reflected in source:
- Group recursion is explicitly guarded against cycles.
- Group channel range is derived from grouped models.
- Groups are treated differently from regular models in manager operations.

## 4) Current Automation API Exposure
Current API exposure relevant to groups:
- `layout.getModels`: group rows are included with `type = "ModelGroup"` and basic channel/layout metadata.
- `layout.getModel`: same basic model row plus attributes.
- `layout.getScene`: includes group geometry and transforms as generic model rows.
- `layout.getDisplayElements`: includes layout tree elements with `type` and `parentId`.

What is not exposed as a first-class contract:
- explicit group member list in `layout.*` payloads,
- group buffer style setting/state,
- group flattening policy (`removeDuplicates`, `activeOnly`) and active-model snapshot,
- cycle/recursion diagnostics for group graphs.

## 5) Current xLightsDesigner Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current behavior:
- groups are identified from type and separated into `groupsById`,
- group ids are now passed into `sequence_agent` planning so group-first ordering/target preservation can use authoritative xLights group identity,
- no explicit group membership graph is reconstructed,
- no group behavior semantics (fanout/stagger/mirror/distribution) are encoded yet.

## 6) Gap List (Model Groups Step)

### G1: Missing explicit group membership graph
Need deterministic group membership ingest model:
- direct members (models/submodels/groups),
- flattened members (cycle-safe),
- duplicate policy visibility.

### G2: Missing group behavior ontology
Need canonical group behavior descriptors for planning:
- aggregate targeting,
- distribution/fanout semantics,
- per-member sequencing strategies.

### G3: Missing group rendering policy exposure
Need surfaced group rendering style metadata where available:
- group buffer style,
- per-model/per-strand implications.

### G4: Planner not yet group-aware
`sequence_agent` currently treats targets as ids/tags only; it does not adapt commands based on group composition semantics.

### G5: Display-element ordering semantics not yet encoded with group behavior
Group behavior is not only about target expansion. xLights `Edit Display Elements` behavior shows that ordering is part of practical sequencing semantics:

- timing rows remain structurally at the top,
- broad group rows are often placed earlier,
- more specific model rows below refine or override the broader coverage.

Current planner behavior only partially reflects this. A canonical ordering heuristic still needs to be encoded alongside group-target semantics.

## 7) Pre-Gate Decision
Pre-gate status for Phase I model groups:
- source audit: COMPLETE
- API coverage map: COMPLETE
- gap list: READY FOR APPROVAL
- semantic implementation: NOT STARTED

## 8) Recommended Next Implementation Slice
1. Build group membership graph in scene graph normalization.
2. Add group semantics utility layer (`directMembers`, `flattenedMembers`, cycle-safe checks).
3. Encode group behavior rules for planner target expansion and distribution strategies.
4. Encode display-element ordering heuristics for group-first sequencing:
   - keep timing rows pinned at top,
   - prefer broad groups earlier,
   - keep focused model/submodel refinements below when intent calls for layered override behavior.
5. Add deterministic tests for nested group scenarios and group-first ordering behavior.
