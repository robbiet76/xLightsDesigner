# Display Element Context Menu Capability Audit

Date: 2026-04-26
Status: Current source audit
Scope: xLights 2026.06 source, Display Elements panel and Sequencer left-side row headings

## Capability Filter

The context menu is a source of evidence about what xLights can do, not a product requirement to recreate every human shortcut. xLightsDesigner should keep the automated surface small and focused on the operations the app needs to author sequences:

- create effects
- edit existing effects
- delete effects
- clone/copy or move effects when that is the simplest way to express an edit
- place effects on deterministic models, layers, and timing windows
- reorder layers or display elements only when vertical order changes the rendered result

Manual workflow helpers such as selection state, hidden clipboard state, show/hide toggles, playback/export shortcuts, and view cleanup actions should stay out of the core agent contract unless a later app workflow needs them directly.

## User Prompt

> Yes. Cloning or a "copy paste" function will be needed for effects as this is a common practice to duplicate effects. This can be done at various levels. Please audit the right click menu options that come up when a user right clicks in the left side display elements list and decide which functions are needed.

## Source Files Audited

- `/Users/robterry/xLights-2026.06/src-ui-wx/ui/layout/ViewsModelsPanel.cpp`
- `/Users/robterry/xLights-2026.06/src-ui-wx/ui/layout/ViewsModelsPanel.h`
- `/Users/robterry/xLights-2026.06/src-ui-wx/ui/sequencer/RowHeading.cpp`
- `/Users/robterry/xLights-2026.06/src-ui-wx/ui/sequencer/RowHeading.h`
- `/Users/robterry/xLights-2026.06/src-ui-wx/ui/sequencer/EffectsGrid.cpp`
- `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.cpp`

## Important Distinction

xLights has two nearby left-side surfaces:

- Display Elements panel list, implemented in `ViewsModelsPanel::OnListCtrlModelsItemRClick`.
- Sequencer row headings, implemented in `RowHeading::rightClick`.

The effect copy/paste workflows are on the Sequencer row-heading menu, not the Display Elements panel list. The Display Elements panel menu is mostly view/list management.

## Display Elements Panel Menu

This menu appears from `ViewsModelsPanel::OnListCtrlModelsItemRClick`.

User-visible actions:

- Undo
- Hide All
- Hide Unused
- Show All
- Remove Unused
- Select Unused
- Select Used
- Select All
- Sort
- Sort By Name
- Sort By Name But Groups At Top
- Sort By Name But Groups At Top by Size
- Sort By Name But Groups At Top by Node Count
- Sort By Controller/Port But Groups At Top
- Sort By Controller/Port But Groups At Top by Size
- Sort By Start Channel But Groups At Top
- Sort By Start Channel But Groups At Top by Size
- Sort The Same as Current Master View, when not on Master View
- Sort By Type
- Sort Models Under This Group
- Bubble Up Groups

Needed for xLightsDesigner sequencing:

- `sequencer.setDisplayElementOrder`: already needed and already implemented/app-wired.
- Visibility/show-hide commands: useful for UI ergonomics and review filtering, but not required for generative sequencing output. Do not add them to the core sequencing API unless a concrete app workflow needs them.
- Select actions: manual UI convenience only. Agents should target explicit ids/scopes rather than depend on UI selection state.
- Remove Unused: risky as an automated mutation because it removes display elements from a view. Not needed for sequencing generation.
- Sorting helpers: useful as deterministic order presets, but not equivalent to creative model/display order. Support later as view-management helpers if needed.

## Sequencer Row-Heading Menu: Model/Submodel/Strand Rows

This menu appears from `RowHeading::rightClick` when the row is a model, submodel, or strand.

Layer actions:

- Insert Layer Above
- Insert Layer Below
- Insert Multiple Layers Below
- Delete Layer
- Delete Multiple Layers
- Delete Unused Layers
- Edit Layer Name

View/navigation actions:

- Show All Timing Tracks, when hidden timing tracks exist in Master View
- Toggle Strands
- Toggle Nodes
- Toggle Models
- Show All Effects
- Collapse All Models
- Collapse All Layers
- Edit Display Elements

Conversion/promotion actions:

- Convert To Effect
- Promote Node Effects
- Convert Effects to Per Model, for model groups
- Create Timing From Effects, from row menu

Model submenu:

- Enable Render / Disable Render
- Enable Render On All Models
- Play
- Export
- Render and Export
- Export Selected Model Effects
- Render and Export Selected Model Effects
- Select Effects
- Cut Effects
- Copy Effects
- Copy Effects incl SubModels
- Paste Effects
- Delete Effects
- Delete SubModel Effects
- Delete Strand Effects
- Delete Node Effects

Row submenu:

- Select Effects
- Cut Effects
- Copy Effects
- Paste Effects
- Delete Effects
- Create Timing From Effects
- Convert Effects to Per Model, for model groups

Needed for xLightsDesigner sequencing:

- Layer insertion above/below/multiple: do not mirror these UI shortcuts directly. The core need is deterministic effect placement. `effects.create` and `effects.clone` should allocate missing layers as needed, and `effects.reorderLayer` should be used only when layer order itself changes the rendered result.
- Delete layer/delete multiple/delete unused: only needed when the intended edit removes existing rendered content or cleans up layers after an explicit edit. Single delete and compaction are already app-wired; multiple delete can be represented as repeated delete calls or a batch command.
- Edit layer name: useful but not core to rendered output. Keep as metadata/UI parity unless user intent uses layer labels.
- Copy row effects: needed only as the broader `effects.clone` operation with explicit source and destination selectors.
- Copy model effects: needed only as the broader `effects.clone` operation with explicit source and destination selectors.
- Copy model effects including submodels: useful for advanced reuse, but still belongs in the same `effects.clone` route rather than separate shortcut commands.
- Paste row/model effects: do not expose as clipboard-state operations. API should take source and destination selectors directly through `effects.clone`.
- Cut row/model effects: needed only as move semantics on `effects.clone` or clone plus delete after readback.
- Delete row/model/submodel/strand/node effects: needed at model and layer scope; submodel/strand/node deletion should wait until target semantics and API coverage are strong enough.
- Create Timing From Effects: useful for anchoring and validation; lower priority than effect copy/move/delete.
- Convert To Effect / Promote Node Effects / Convert Effects to Per Model: lower priority transformation workflows. They affect rendering, but are specialized and should not block basic sequencing authoring.
- Render enable/disable, play, export, show/collapse/toggle: manual UI or validation ergonomics, not core authoring mutations.

## Sequencer Row-Heading Menu: Timing Rows

Timing row actions:

- Add Timing Track
- Rename Timing Track
- Delete Timing Track
- Import Timing Track
- Export Timing Track
- Make Timing Track Variable
- Hide All Timing Tracks
- Add Timing Tracks to All Views
- Select Timing Marks
- Generate Subdivided Timing Tracks
- Import Notes
- AI Speech 2 Lyrics
- Import Lyrics
- Breakdown Phrases
- Breakdown Words
- Remove Words
- Remove Phonemes
- Remove Words and Phonemes
- Copy Row
- Paste Row

Needed for xLightsDesigner sequencing:

- Add/rename/delete timing track: needed. Add/create is already present; rename/delete should be planned once timing lifecycle work resumes.
- Copy/paste timing row: useful for duplicate track creation, but should be explicit source/destination track operations.
- Breakdown/import/AI lyrics/subdivide: useful analysis authoring workflows, but not immediate effect clone/copy work.
- Hide/add to all views/select marks/export/playback conveniences: UI or import/export support, not core sequencing mutation.

## Copy/Paste Behavior In Source

`RowHeading` posts `EVT_COPY_MODEL_EFFECTS` and `EVT_PASTE_MODEL_EFFECTS` to `xLightsFrame`, which calls `EffectsGrid::CopyModelEffects` and `EffectsGrid::PasteModelEffects`.

Observed behavior:

- Row copy selects visible effects in one row/layer from the first effect start time through sequence end, then uses `MainSequencer::CopySelectedEffects`.
- Model copy selects all effects across the model's effect layers.
- Model copy including submodels also selects submodel-layer effects.
- Paste sets the drop row and invokes `MainSequencer::Paste(true)`.

For xLightsDesigner, this should not be exposed as a hidden clipboard state. The agent needs one deterministic, stateless operation:

- `effects.clone`

That command should accept explicit source and destination selectors, handle layer/model/window copy and move semantics through parameters, and return copied effect ids/counts. Avoid creating separate API commands for each UI shortcut unless a future requirement proves the single command cannot express the edit safely.

## Recommended Capability Roadmap

Immediate sequencing capability:

1. Add stateless clone/copy planning in the app. Initial layer/model copy planning is implemented as of 2026-04-26 for explicit source/destination model names, same-model layer-to-layer copy, optional source/target layer indexes, optional target start offsets, explicit move/cut requests, multi-target native clone requests, and `including submodels` requests that map source submodel suffixes to known destination submodel ids. Explicit layer/model copy and move planning emits a native `effects.clone` command so source effect payloads do not need to be expanded through the agent handoff. Multiple destination models are emitted as one native `effects.clone` command with `targetModels`. Native clone planning checks the current sequence context for target model/layer/time overlap and moves the clone to the next open destination layer when the requested paste layer is occupied. The owned xLights clone route allocates missing destination layers before adding cloned effects. The older explicit `effects.create` expansion and move-source `effects.delete` remains as a fallback for older capability sets and for submodel-inclusive copy/move until native submodel mapping is explicitly supported. Native validation now covers parent/submodel clone, shifted clone, submodel delete, submodel move, Review open-layer clone placement, layer reorder, horizontal update/time shift, layer deletion, layer compaction, and display/model order changes against real xLights targets.
2. Add readback validation for cloned effects and move/cut effects: implemented as of 2026-04-26 for target model/layer/window/effect presence, cloned settings/palette payload comparison when readback exposes those fields, move/cut source delete absence, and native `effects.clone` target-window count checks. Native clone move validation also verifies that the source model/layer/window is empty after apply.
3. Maintain native validation scenarios for:
   - copy one layer to another layer on the same model
   - copy one model's effects to another model
   - copy one model's effects including matching destination submodels
   - copy with time offset to a later section
   - cut or move effects from one row/layer to another row/layer
   - Review apply open-layer clone placement and layer/display-order edits

Owned API follow-up:

1. Add owned route for source/destination clone when source context is too large to safely pass through agent handoffs. Implemented as `effects.clone` on 2026-04-26 for loaded-sequence source windows, layer-preserving or layer-offset target placement, copy/move mode, dry-run support, and multi-target clone.
2. Keep the route inside `/src-ui-wx/xLightsDesigner`.
3. Do not depend on UI selection or clipboard state.
4. Support dry-run and readback summary fields.

Suggested owned command shape:

```json
{
  "cmd": "effects.clone",
  "params": {
    "sourceModelName": "Star",
    "sourceLayerIndex": 0,
    "sourceStartMs": 1000,
    "sourceEndMs": 5000,
    "targetModels": ["MegaTree"],
    "targetLayerIndex": 1,
    "targetStartMs": 8000,
    "preserveDuration": true,
    "includeSubmodels": false,
    "mode": "copy"
  }
}
```

Open design choices:

- Whether layer names and layer settings should be copied with effects.
- Whether model-to-model clone should map submodels by matching names when possible.
- Whether future clone operations should stretch source effects to destination timing marks rather than preserving duration or shifting by offset.

Settled behavior:

- Clone can preserve source timing or shift by target start offset.
- Overlapping target effects are preserved by moving clone writes to an open layer unless replacement is explicit.
- The owned route allocates missing destination layers before cloned effects are added.

## Decision

The needed functions are not every right-click menu item. For generative sequencing, the required set is:

- display/model order mutation
- layer insert/delete/compact/reorder
- effect update/delete/time shift
- row/layer/model copy-paste as stateless clone commands
- move as clone plus delete or a dedicated move command
- timing track create/rename/delete and timing row copy only after clone basics are stable

Manual UI-only actions such as show/hide, selection, play, export, collapse/expand, and import dialogs should not be first-class agent mutation commands unless a later workflow explicitly needs them.
