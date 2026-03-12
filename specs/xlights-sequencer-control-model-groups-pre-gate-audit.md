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

Additional source-confirmed details:
- Direct membership is stored canonically as `modelNames` and resolved pointers in `models`.
- Nested groups are first-class and cycle-guarded via `ContainsModelGroup(..., visited)`.
- Active-vs-all membership is distinct:
  - `Models()` contains resolved direct members,
  - `ActiveModels()` is the active subset,
  - `GetFlatModels(removeDuplicates, activeOnly)` is the authoritative recursive flattened view.
- Submodel-aware containment is explicit:
  - `ContainsModelOrSubmodel(...)`
  - `OnlyContainsModel(...)`
- Group render behavior is not equivalent to naïve member expansion because `ModelGroup` has its own buffer-style set and render-buffer initialization logic.

## 4) Current Automation API Exposure
Current API exposure relevant to groups:
- `layout.getModels`: group rows are included with `type = "ModelGroup"` and basic channel/layout metadata.
- `layout.getModel`: same basic model row plus attributes.
- `layout.getModelGroupMembers`: direct, active, flattened-active, and flattened-all membership views for one `ModelGroup`.
- `layout.getScene`: includes group geometry and transforms as generic model rows.
- `layout.getDisplayElements`: includes layout tree elements with `type` and `parentId`.

What is still not exposed as a first-class contract:
- group buffer style setting/state,
- group flattening policy (`removeDuplicates`, `activeOnly`) and active-model snapshot,
- cycle/recursion diagnostics for group graphs.

Important nuance from source:
- `layout.getModels` exposes `groupNames[]`, but that is reverse membership for non-group models and submodels only.
- For `ModelGroup` rows themselves, reverse expansion is intentionally skipped in automation to avoid unstable discovery and group-assert problems.
- `layout.getModelGroupMembers` now exposes authoritative direct and flattened membership for one group.
- Therefore current automation can now identify:
  - which ids are groups,
  - which models/submodels belong to one or more groups,
  - the direct ordered member list of a queried group,
  - active and flattened membership views for a queried group.

## 5) Current xLightsDesigner Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current behavior:
- groups are identified from type and separated into `groupsById`,
- direct/active/flattened membership is now fetched per group via `layout.getModelGroupMembers` and attached into `sceneGraph.groupsById[*].members`,
- group ids and the authoritative group membership graph are passed into `sequence_agent` planning,
- planner now uses that graph for:
  - broad-group target preservation on generic-scope lines,
  - nested-group breadth preference (broadest valid aggregate first),
  - display-element ordering heuristics that keep broader groups above their refinements,
- no fanout/stagger/mirror/distribution semantics are encoded yet.

## 6) Gap List (Model Groups Step)

### G1: Missing bulk group graph endpoint
Need deterministic group membership ingest at scene scale without N-per-group round trips.

Current recovered subset now in use:
- reverse membership for models and submodels via `groupNames[]`,
- explicit group identity via `type = "ModelGroup"`,
- authoritative direct/active/flattened membership per group via `layout.getModelGroupMembers`.

Still missing for full fidelity/performance:
- full-scene bulk group graph in one call,
- group render/buffer-style policy exposure,
- explicit cycle/recursion diagnostics.

### G2: Missing group behavior ontology
Need canonical group behavior descriptors for planning:
- aggregate targeting,
- distribution/fanout semantics,
- per-member sequencing strategies.

### G3: Missing group rendering policy exposure
Need surfaced group rendering style metadata where available:
- group buffer style,
- per-model/per-strand implications.

### G4: Planner only partially group-aware
`sequence_agent` now adapts broad-target preservation and ordering using authoritative group membership, but it does not yet encode:
- fanout/distribution strategies,
- stagger/mirror semantics,
- expansion-vs-preserve decisions driven by requested group render behavior.

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
1. Add a group semantics utility layer that distinguishes:
   - direct members,
   - active members,
   - flattened members.
2. Encode fuller group behavior rules for planner target preservation and ordering using authoritative group identity and membership data.
3. Defer only the remaining render-policy-specific semantics until automation exposes group buffer-style details, or a dedicated app-side source import is approved.
4. Encode display-element ordering heuristics for group-first sequencing:
   - keep timing rows pinned at top,
   - prefer broad groups earlier,
   - keep focused model/submodel refinements below when intent calls for layered override behavior.
5. Add deterministic tests for:
   - group-first ordering behavior,
   - nested-group breadth preference,
   - reverse-membership aware targeting,
   - eventual expansion-vs-preserve behavior once render-policy semantics are added.
