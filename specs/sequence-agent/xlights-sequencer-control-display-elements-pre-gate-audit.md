# xLights Sequencer Control - Display Elements Pre-Gate Audit

Date: 2026-03-11

## Scope

Audit the xLights `Edit Display Elements` window and related automation coverage to answer:

1. what elements the window controls,
2. which built-in sort orders exist,
3. which of those behaviors can affect sequencing/rendering outcomes,
4. what is already exposed through automation.

Primary source files audited:

- `/Users/robterry/xLights/xLights/ViewsModelsPanel.cpp`
- `/Users/robterry/xLights/xLights/ViewsModelsPanel.h`
- `/Users/robterry/xLights/xLights/automation/api/SequencerV2Api.inl`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

## Main Findings

### 1. The window controls more than visibility

The `Edit Display Elements` window is implemented by `ViewsModelsPanel`. It manages:

- views, including `Master View`,
- the ordered list of display elements already added to the selected view,
- the pool of available elements not yet added,
- visibility toggles,
- explicit row movement up/down/top/bottom,
- drag/drop reordering,
- several built-in sort actions.

This is not just a convenience picker. In `Master View`, model ordering changes are applied by calling `SequenceElements::MoveSequenceElement(...)`, which rewrites row order in the sequencer.

### 2. Timing rows are structurally kept at the top

The model list in the window includes timing rows first, followed by model rows.

`GetTimingCount()` counts contiguous timing rows at the top of the added list, and all model sort operations preserve that offset. In `Master View`, `SetMasterViewModels(...)` writes models back starting at `i + GetTimingCount()`.

Implication:

- sort actions reorder models beneath the timing rows,
- they do not intermingle models and timing tracks.

### 3. Built-in sort actions are real ordering operations

The right-click `Sort` submenu in `ViewsModelsPanel::OnListCtrlModelsItemRClick(...)` defines these actions:

- `By Name`
- `By Name But Groups At Top`
- `By Name But Groups At Top by Size`
- `By Name But Groups At Top by Node Count`
- `By Controller/Port But Groups At Top`
- `By Controller/Port But Groups At Top by Size`
- `By Start Channel But Groups At Top`
- `By Start Channel But Groups At Top by Size`
- `The Same as Current Master View` (non-master views only)
- `By Type`
- `Models Under This Group`
- `Bubble Up Groups`

These are handled by:

- `SortModelsByName()`
- `SortModelsByNameGM(...)`
- `SortModelsByCPGM(...)`
- `SortModelsBySCGM(...)`
- `SortModelsByMasterView()`
- `SortModelsByType()`
- `SortModelsUnderThisGroup(...)`
- `SortModelsBubbleUpGroups()`

Each one rewrites the selected view or `Master View` ordering, then refreshes the sequencer.

### 4. Group-aware sorting is built into the dialog

Several sort modes are intentionally group-aware:

- `Groups At Top`
- `Groups At Top by Size`
- `Groups At Top by Node Count`
- `Models Under This Group`
- `Bubble Up Groups`

These are sequencing-relevant, not cosmetic:

- they encourage broad group rows near the top,
- they make it easier to apply base coverage first,
- they support the common xLights pattern of group-level coverage with more specific rows below refining or overriding it.

This aligns with the practical sequencing heuristic already discussed for `sequence_agent`: broad base coverage first, focused refinements later.

### 5. Sort order can affect effective rendering behavior

Within the selected view, row order matters because sequencing is top-down. The dialog sort helpers therefore affect more than editor ergonomics:

- they change which rows are earlier or later in the render stack,
- they can change whether broad group effects sit above or below more specific model rows,
- they can change whether a view reflects physical/controller order or logical/grouped order.

This is most consequential when:

- group rows and individual model rows coexist,
- users rely on top-down row organization to control refinement/override patterns,
- views are used as sequencing contexts rather than just storage lists.

### 6. `Master View` and other views differ

The dialog works against the selected view, but `Master View` is special:

- in `Master View`, reordering writes directly to sequence elements via `MoveSequenceElement(...)`,
- in non-master views, ordering is stored in the view's model string,
- non-master views also expose `The Same as Current Master View`.

Implication:

- `Master View` order is the primary render-relevant baseline,
- view-specific ordering still matters for sequencing workflow and view-local organization,
- automation that only targets `MASTER_VIEW` does not yet cover all dialog behavior.

## Automation Coverage

Current automation support is narrower than the dialog:

- `sequencer.getDisplayElementOrder`
- `sequencer.setDisplayElementOrder`
- `sequencer.setActiveDisplayElements`

What this covers:

- reading current explicit order,
- writing an explicit full order,
- setting the active visible subset.

What it does not cover directly:

- built-in sort modes such as `By Controller/Port But Groups At Top`,
- `By Start Channel But Groups At Top`,
- `By Type`,
- `Models Under This Group`,
- `Bubble Up Groups`,
- non-master view sort operations.

So the automation layer currently exposes the final explicit ordering state, not the xLights-native sort helpers that produce it.

## Practical Implications For xLightsDesigner

### 1. Explicit order is already automatable

If `sequence_agent` or app logic wants a specific final display-element order, current automation is sufficient. The app can compute the desired order and call `sequencer.setDisplayElementOrder`.

### 2. Built-in xLights sort helpers are not yet first-class API concepts

If we want xLightsDesigner to support user-intent like:

- "sort by start channel with groups at top"
- "put models under this group"
- "bubble groups up"

then we need one of two approaches:

1. reproduce those sort algorithms in xLightsDesigner and send the resulting explicit order, or
2. add dedicated xLights automation endpoints for those sort operations.

### 3. Group ordering should be treated as sequencing semantics

This is not just a UI concern. The dialog behavior reinforces a real sequencing rule:

- broad group coverage often belongs earlier in the display-element stack,
- more specific models often belong below it as refinements.

That should inform eventual `sequence_agent` group behavior rules.

## Recommended Follow-Up

1. Keep current explicit order APIs as the base integration path.
2. Add a future backlog item to audit whether xLightsDesigner should expose xLights-native sort presets explicitly.
3. When group behavior rules are implemented in `sequence_agent`, treat display-element ordering as part of sequencing semantics, not only UI state.
4. Consider separate automation support for non-`Master View` ordering if view-local sequencing workflows become first-class in the app.

## Bottom Line

The `Edit Display Elements` window is sequencing-relevant infrastructure, not just a maintenance dialog.

- Its sort modes rewrite real row order.
- Timing rows stay pinned at the top.
- Group-aware sort modes encode common xLights sequencing practice.
- Current automation covers explicit final ordering, but not the built-in sort presets themselves.
