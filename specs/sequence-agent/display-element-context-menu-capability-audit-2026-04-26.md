# Display Element Context Menu Capability Audit

Date: 2026-04-26
Status: Current source audit
Scope: xLights 2026.06 source, Display Elements panel and Sequencer left-side row headings

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
- Visibility/show-hide commands: useful for UI ergonomics and review filtering, but not required for generative sequencing output. Treat as lower priority app UI commands.
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

- Layer insertion above/below/multiple: needed. The agent needs to create empty layer slots or place copied/created effects at deterministic layer indexes.
- Delete layer/delete multiple/delete unused: needed. Single delete and compaction are already app-wired; multiple delete can be represented as repeated delete calls or a batch command.
- Edit layer name: useful but not core to rendered output. Keep as metadata/UI parity unless user intent uses layer labels.
- Copy row effects: needed. This is source layer to target layer copy.
- Copy model effects: needed. This is source model to target model copy across all layers.
- Copy model effects including submodels: needed for advanced reuse, but after base model/layer copy works.
- Paste row/model effects: needed as explicit clone/copy commands, not clipboard-state operations. API should take source and destination selectors directly.
- Cut row/model effects: needed as move operations. Can be implemented as clone plus delete after readback or as a dedicated move route.
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

For xLightsDesigner, this should not be exposed as a hidden clipboard state. The agent needs deterministic, stateless commands:

- `effects.cloneLayer`
- `effects.cloneModel`
- `effects.cloneSelection` or `effects.cloneWindow`
- `effects.moveLayerEffects`
- `effects.moveModelEffects`

These commands should accept explicit source and destination selectors and return copied effect ids/counts.

## Recommended Capability Roadmap

Immediate sequencing capability:

1. Add stateless clone/copy planning in the app that expands simple copies into explicit `effects.create` commands when source effects are already available from current-sequence context. Initial layer/model copy planning is implemented as of 2026-04-26 for explicit source/destination model names, same-model layer-to-layer copy, optional source/target layer indexes, optional target start offsets, explicit move/cut requests implemented as clone plus source delete, and `including submodels` requests that map source submodel suffixes to known destination submodel ids.
2. Add readback validation for cloned effects and move/cut effects: target model/layer/window/effect/settings/palette should match the expected copied source, and move/cut source effects should no longer exist after the destination clone succeeds.
3. Add native validation scenarios for:
   - copy one layer to another layer on the same model
   - copy one model's effects to another model
   - copy one model's effects including matching destination submodels
   - copy with time offset to a later section
   - cut or move effects from one row/layer to another row/layer

Owned API follow-up:

1. Add owned route for source/destination clone when source context is too large to safely pass through agent handoffs.
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

- Whether clone should preserve absolute timing, shift by offset, or stretch to destination timing marks.
- Whether layer names and layer settings should be copied with effects.
- Whether overlapping target effects should be preserved by adding layers, replaced, or rejected unless explicit replacement is requested.
- Whether model-to-model clone should map submodels by matching names when possible.

## Decision

The needed functions are not every right-click menu item. For generative sequencing, the required set is:

- display/model order mutation
- layer insert/delete/compact/reorder
- effect update/delete/time shift
- row/layer/model copy-paste as stateless clone commands
- move as clone plus delete or a dedicated move command
- timing track create/rename/delete and timing row copy only after clone basics are stable

Manual UI-only actions such as show/hide, selection, play, export, collapse/expand, and import dialogs should not be first-class agent mutation commands unless a later workflow explicitly needs them.
