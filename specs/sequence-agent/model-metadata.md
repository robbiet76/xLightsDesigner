# Model Metadata

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: `model-metadata-ownership-and-tagging-2026-03-22.md`, `model-metadata-record-contract-2026-03-22.md`, `custom-model-stage1-breadth-plan-2026-03-22.md`

## Purpose

Define how xLightsDesigner understands display models, groups, custom models, and user-curated display metadata.

## Ownership

Display metadata belongs to the xLightsDesigner project, not to the show folder globally.

- Keep one metadata set per project.
- Copy metadata during explicit project migration.
- Do not delete metadata automatically when a show folder changes.
- Start new projects with blank metadata unless the user imports or copies metadata.
- Let users explicitly delete metadata records when they choose.

## Stable Identity

Metadata records should attach to stable model fingerprints rather than only display names. Names remain user-visible labels, but fingerprints provide continuity when a layout is refreshed or a model is renamed.

## Refresh Behavior

When the selected show folder or layout changes, the app should refresh:

- model list
- model groups
- display element order
- geometry
- node order
- submodels
- custom model layout/construction data
- sequence-visible targets

Refresh should reconcile current layout data with existing project metadata without destroying curated fields.

## Required Metadata

Each model record should support:

- target id and fingerprint
- current xLights model name
- model type
- geometry and preview position
- node count and node order summary
- group membership
- submodel summaries
- custom model construction data when applicable
- user-facing role tags
- semantic notes and sequencing constraints
- provenance and review status

## Custom Models

Custom models must be handled as first-class display elements. The agent needs more than the model name:

- layout grid or coordinate construction
- node order
- skipped/empty cells where applicable
- strand/string organization where available
- submodel definitions
- rendered geometry
- user/vendor/import provenance when known

The source of the custom model does not change the requirement. User-created, vendor-provided, and copied custom models all need the same understanding framework.

## User Experience

The user should not have to rebuild mature display metadata after normal show-folder changes. The app should show when current layout data no longer matches existing metadata and offer review, remap, import, or explicit deletion paths.
