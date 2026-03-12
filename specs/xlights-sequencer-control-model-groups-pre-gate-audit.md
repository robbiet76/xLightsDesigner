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
- `layout.getModels`: group rows are included with `type = "ModelGroup"` and now expose render-policy metadata:
  - `renderLayout`
  - `defaultBufferStyle`
  - `renderPolicy`
  - `availableBufferStyles[]`
- `layout.getModel`: same model row shape, including render-policy metadata.
- `layout.getModelGroupMembers`: direct, active, flattened-active, and flattened-all membership views for one `ModelGroup`.
- `layout.getScene`: includes group geometry/transforms plus render-policy metadata as generic model rows.
- `layout.getDisplayElements`: includes layout tree elements with `type` and `parentId`.

What is still not exposed as a first-class contract:
- group flattening policy (`removeDuplicates`, `activeOnly`) and active-model snapshot,
- cycle/recursion diagnostics for group graphs.

Important nuance from source:
- `layout.getModels` exposes `groupNames[]`, but that is reverse membership for non-group models and submodels only.
- For `ModelGroup` rows themselves, reverse expansion is intentionally skipped in automation to avoid unstable discovery and group-assert problems.
- `layout.getModelGroupMembers` now exposes authoritative direct and flattened membership for one group.
- `layout.getModels` / `layout.getModel` now expose the group’s current render-layout and resolved default buffer style.
- Therefore current automation can now identify:
  - which ids are groups,
  - which models/submodels belong to one or more groups,
  - the direct ordered member list of a queried group,
  - active and flattened membership views for a queried group.
  - whether a group is using a non-default render policy that may make preservation preferable to member expansion.

## 5) Current xLightsDesigner Coverage
File:
- `apps/xlightsdesigner-ui/app.js`

Current behavior:
- groups are identified from type and separated into `groupsById`,
- direct/active/flattened membership is now fetched per group via `layout.getModelGroupMembers` and attached into `sceneGraph.groupsById[*].members`,
- group render policy is now carried into `sceneGraph.groupsById[*].renderPolicy`,
- group ids and the authoritative group membership graph are passed into `sequence_agent` planning,
- planner now uses that graph for:
  - broad-group target preservation on generic-scope lines,
  - nested-group breadth preference (broadest valid aggregate first),
  - preference for preserving non-default group render targets when scope is otherwise comparable,
  - preserve-vs-expand baseline semantics:
    - preserve explicit group targets by default,
    - expand only when the request explicitly calls for per-member distribution,
    - use direct members for current per-member distribution,
    - support deterministic staggered time slicing and mirrored member order for explicit distribution requests,
    - support explicit flattened-member expansion for nested groups when requested,
    - alternate repeated distributed-line member order while keeping the same section window model,
    - rotate repeated fanout lines round-robin across flattened members when explicitly requested,
  - display-element ordering heuristics that keep broader groups above their refinements,
- richer multi-line fanout/alternation/distribution semantics are not encoded yet.

## 6) Gap List (Model Groups Step)

### G1: Missing bulk group graph endpoint
Need deterministic group membership ingest at scene scale without N-per-group round trips.

Current recovered subset now in use:
- reverse membership for models and submodels via `groupNames[]`,
- explicit group identity via `type = "ModelGroup"`,
- authoritative direct/active/flattened membership per group via `layout.getModelGroupMembers`.

Still missing for full fidelity/performance:
- full-scene bulk group graph in one call,
- explicit cycle/recursion diagnostics.

### G2: Missing group behavior ontology
Need canonical group behavior descriptors for planning:
- aggregate targeting,
- distribution/fanout semantics,
- per-member sequencing strategies.

### G3: Missing group rendering policy exposure
Need richer surfaced group rendering style metadata where available:
- write/update support for group render policy,
- stronger normalized semantics for per-model/per-strand/overlay implications,
- explicit warnings for effect/buffer combinations that xLights treats as problematic.

### G4: Planner only partially group-aware
`sequence_agent` now adapts broad-target preservation and ordering using authoritative group membership, but it does not yet encode:
- rich fanout/distribution strategies beyond explicit direct/flattened expansion,
- cross-line fanout semantics beyond simple repeated-line order reversal and round-robin rotation,
- deeper expansion-vs-preserve decisions driven by requested group render behavior and effect/render compatibility.

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
