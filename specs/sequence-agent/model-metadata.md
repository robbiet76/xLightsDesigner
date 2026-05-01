# Model Metadata

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-30
Supersedes: `model-metadata-ownership-and-tagging-2026-03-22.md`, `model-metadata-record-contract-2026-03-22.md`, `custom-model-stage1-breadth-plan-2026-03-22.md`

## Purpose

Define how xLightsDesigner understands display models, groups, custom models, and user-curated display metadata.

This is the canonical contract for model identity, xLights layout refresh, custom model capture, and reconciliation with project display metadata.

## Ownership

Display metadata belongs to the xLightsDesigner project, not to the show folder globally.

- Keep one metadata set per project.
- Copy metadata during explicit project migration.
- Do not delete metadata automatically when a show folder changes.
- Start new projects with blank metadata unless the user imports or copies metadata.
- Let users explicitly delete metadata records when they choose.

Project display metadata captures user-confirmed or agent-proposed semantic understanding. xLights-derived metadata captures structural facts from the live xLights Layout tab and owned layout API. These layers may be shown together, but they must remain distinct so refreshed layout data does not overwrite curated user knowledge.

Use `layout` when referring to xLights' Layout tab, layout API endpoints, or structural layout facts. Use `display` when referring to the broader xLightsDesigner understanding that layers project metadata, semantic tags, custom model interpretation, and learned display knowledge on top of the xLights layout.

## Stable Identity

Metadata records should attach to stable target fingerprints rather than only display names. Names remain user-visible labels, but fingerprints provide continuity when the xLights layout is refreshed or a model is renamed.

Each current display target should expose:

- `targetId`: app/API identifier used for sequencing references.
- `displayName`: current xLights-visible name.
- `targetKind`: model, group, submodel, display element, or other supported target category.
- `fingerprint`: stable identity derived from structural layout data.
- `fingerprintVersion`: version of the fingerprint algorithm.
- `sourceShowFolder`: current show-folder identity used for diagnostics.
- `lastSeenAt`: refresh timestamp.

The fingerprint is the metadata retention key. The app may use `targetId` and `displayName` for current-session references, but it should not treat either as the durable identity for user-authored metadata.

Fingerprint inputs should favor stable structural facts:

- xLights model type and persistent model identifiers when available
- controller/channel or model UUID data when available
- node count and model dimensions
- custom model grid or node-coordinate construction
- submodel names and stable submodel structure
- group membership shape for groups
- normalized display element identity

Fingerprint inputs should avoid volatile facts unless no better signal exists:

- display order alone
- transient sequence selection
- current view/camera selection
- user-edited semantic tags
- generated artifact paths

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

Refresh should reconcile current display data with existing project metadata without destroying curated fields.

Refresh should produce a reconciliation result:

- matched targets by fingerprint
- renamed targets with the same fingerprint
- new targets with no existing metadata
- missing targets whose prior metadata is retained but not currently active
- possible remap candidates when fingerprints changed but names or structure strongly suggest continuity
- custom model construction changes that need review

The app should resolve low-risk reconciliation cases on the backend whenever possible. A unique fingerprint match can remap automatically. A duplicate fingerprint may remap automatically only when stored identity fields clearly select one live candidate. Missing or ambiguous records should be retained but excluded from active sequencing context until they become safely resolvable.

The app should keep retained metadata readable and importable even when a target is missing from the current display. It should not delete retained records unless the user explicitly deletes them.

## API Capture Rule

The app should capture model, group, submodel, node, geometry, display element, and custom model construction data through the owned xLights API.

Direct xLights layout-file parsing should not be reintroduced as the primary capture path. File parsing can be used only as an explicitly documented fallback or fixture-generation tool when the API cannot provide required data yet.

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

Each group record should support:

- target id and fingerprint
- current xLights group name
- direct members
- flattened active members
- render/display ordering signals
- group structure type when inferable
- user-facing role tags
- semantic notes and sequencing constraints
- provenance and review status

Each submodel record should support:

- parent target id and parent fingerprint
- submodel id/name
- stable submodel fingerprint when possible
- node or range membership summary
- render geometry or bounds when available
- sequencing constraints when applicable

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

Custom model capture should include enough construction detail for testing and agent reasoning:

- grid width/height or coordinate extents
- populated node cells or node coordinates
- skipped cells and empty cells where available
- node index to visual position mapping
- strand/string breaks and direction when available
- submodel definitions and their node membership
- preview/render geometry
- source/provenance fields when the API exposes them

Submodels for custom models are part of the custom model capture contract, not a separate optional enhancement.

## Storage And Artifacts

Project-owned metadata should live under the app project folder. Current xLights layout refresh artifacts may be regenerated, but user-curated metadata and review state should persist with the project.

Recommended project artifact split:

- `display/metadata.json`: user-curated semantic display metadata and assignments.
- `display/model-index.json`: current model/group/submodel index from the latest refresh.
- `display/custom-models.json`: current custom model construction summaries.
- `display/reconciliation.json`: latest refresh reconciliation result.
- `display/discovery.json`: display-discovery conversation output and proposed metadata.

Large raw API payloads should stay out of durable semantic metadata unless they are compacted into a stable project artifact.

## User Experience

The user should not have to rebuild mature display metadata after normal show-folder changes. The app should reconcile current display data automatically where risk is minimal and surface user-facing review only for records that cannot be safely matched, imported, ignored, or retained in the backend.

When a show folder or layout changes, the expected experience is:

1. the app refreshes layout/model/custom-model data
2. existing metadata is matched by fingerprint
3. safely resolvable renames or duplicate-fingerprint cases are handled automatically
4. missing prior targets remain retained, not deleted
5. only ambiguous or high-risk remaps are presented for confirmation
6. user-curated tags, notes, and constraints remain intact unless explicitly edited

## Related Specs

- `../designer-dialog/display-metadata-v1.md`
- `../architecture/xlights-derived-metadata-layer.md`
- `../app-ui/project-storage.md`
- `xlights-api.md`
