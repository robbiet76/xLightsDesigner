# Model Metadata

Status: Active
Owner: xLightsDesigner Team
Last Reviewed: 2026-05-03
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
- `parentId`: parent target id for submodel records; empty or absent for top-level model and group records.
- `parentName`: current parent display name for submodel records when it differs from or clarifies `parentId`.
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

- `targetId` and `identity.displayName` for current sequencing references.
- `targetKind: "submodel"` so consumers do not infer submodel status from slash-delimited names.
- `identity.parentId` and `identity.parentName` for the parent relationship.
- parent target id and parent fingerprint when available.
- submodel id/name.
- stable submodel fingerprint when possible
- node or range membership summary
- render geometry or bounds when available
- sibling relationships, sibling ids, and overlap/adjacency when inferable
- node coverage against the parent target when membership and parent node counts are known
- semantic structure hints when inferable from names or shape
- sequencing constraints when applicable

Submodels are first-class sequencing targets for every model type, not a custom-model-only concept. The app should use the same identity, fingerprinting, metadata, targeting, render evidence, and review framework for submodels regardless of whether the parent is custom, built-in, or imported. Parent model targeting remains useful for whole-prop fills and fallback behavior, but submodel-level sequencing should be supported consistently across the display.

Consumers should not parse `targetId` or display names to determine parentage when model-index identity exists. Slash-shaped identifiers are allowed because xLights commonly exposes submodels that way, but parent lookup should prefer `identity.parentId` or `structure.submodelMetadata.parentId`.

## Custom Models

Custom models must be handled as first-class display elements within the same target metadata framework used for built-in models. They should not have a parallel metadata flow. The shared model flow should capture structural facts, node layout enrichment, fingerprints, display metadata, recommendations, and sequencing support for every model type. Custom models then add specialized interpretation on top of those shared facts because their xLights type is otherwise too generic.

Node layout capture is a general model enrichment, not a custom-only feature. When `layout.getModelNodes` is available, the app should compact it into reusable node layout metadata for any model type:

- node-to-position mapping
- node order/path continuity
- coordinate source coverage
- dimensions and layer count
- bounded node-map samples for tests and training artifacts

For built-in models, node layout metadata improves geometry, fingerprints, and effect suitability. For custom models, the same node layout metadata is also used to infer the custom construction profile.

The agent needs more than the model name:

- layout grid or coordinate construction
- node order
- skipped/empty cells where applicable
- strand/string organization where available
- submodel definitions
- rendered geometry
- user/vendor/import provenance when known

The source of the custom model does not change the requirement. User-created, vendor-provided, and copied custom models all need the same understanding framework.

Core custom model inference must be grounded in structure, not user-defined names. The app may classify objective traits such as face-like submodels, linear geometry, radial spoke/ring construction, node order, density, and layer/submodel organization. It should not hard-code vendor names or user model names to decide that a custom model is a cane, star, spinner, flake, character, or any other semantic prop family.

When a custom model needs user/vendor-specific meaning, that meaning belongs in project display metadata. `display/metadata.json` may add semantic hints, tags, effect avoidances, and role preferences for a target. Those metadata fields are curated project knowledge and can be copied/migrated with the project. They must remain separate from the regenerated xLights-derived structural artifact.

Custom model capture should include enough construction detail for testing and agent reasoning:

- grid width/height or coordinate extents
- populated node cells or node coordinates
- skipped cells and empty cells where available
- node index to visual position mapping
- strand/string breaks and direction when available
- submodel definitions and their node membership
- preview/render geometry
- source/provenance fields when the API exposes them

Custom models use the same submodel framework as every other parent model. They should not have a parallel submodel representation. Submodels are often even more critical for custom models because many custom props are primarily sequenced through their submodel regions, so custom model capture should be especially careful to preserve parent context, membership, node coverage, sibling relationships, overlap, and semantic structure hints.

## Storage And Artifacts

Project-owned metadata should live under the app project folder. Current xLights layout refresh artifacts may be regenerated, but user-curated metadata and review state should persist with the project.

Recommended project artifact split:

- `display/metadata.json`: user-curated semantic display metadata and assignments.
- `display/model-index.json`: current model/group/submodel index from the latest refresh.
- `display/reconciliation.json`: latest refresh reconciliation result.
- `display/discovery.json`: display-discovery conversation output and proposed metadata.

Large raw API payloads should stay out of durable semantic metadata unless they are compacted into a stable project artifact.

On Display refresh, `display/model-index.json` is the primary shared artifact. It should compact `layout.getModels`, `layout.getSubmodels`, model group membership, any available `layout.getModelNodes` output, and custom-model-specific interpretation into stable target records. Custom-specific interpretation belongs under each record's `structure.customStructure`. Separate filtered custom-model project artifacts should not be written or read as part of normal app behavior; if a custom-only collection is useful for diagnostics, tests, or training exports, it should be derived from `model-index.json` at export time.

### `display/model-index.json`

`display/model-index.json` is the current structural target index. It is regenerated from xLights-derived layout facts and should be treated as the canonical source for current target identity in the project.

Each record should follow this shape:

- `targetId`: current sequencing/API id.
- `targetKind`: `model`, `group`, or `submodel`.
- `identity.displayName`: current user-visible target label.
- `identity.rawType`: raw xLights model/group/submodel type exactly enough to preserve the xLights label, such as `Custom`, `Tree`, `Single Line`, or `SubModel`.
- `identity.canonicalType`: normalized lower-case type used by app reasoning, such as `custom`, `tree`, `single_line`, `model_group`, or `submodel`.
- `identity.fingerprint`: durable target fingerprint.
- `identity.fingerprintVersion`: fingerprint algorithm version.
- `identity.parentId`: parent target id for submodels.
- `identity.parentName`: parent display name for submodels.
- `structure`: compact structural details for the target.

Model and group records place whole-target data under `structure`, including node count, position, dimensions, group membership, embedded submodel summaries, optional `nodeLayout`, and optional `customStructure`.

Custom model records remain normal `targetKind: "model"` records. They are identified structurally by `identity.canonicalType: "custom"` and may include `structure.customStructure`. The live vendor validation display currently proves this shape with radial-like, linear-like, and sparse custom-model profiles in the same model-index collection as built-in models and groups.

`structure.customStructure` should contain compact custom-model interpretation when available:

- `profile`: structural profile such as `custom_radial_like`, `custom_linear_like`, `custom_sparse_shape`, or `custom_model`.
- `traits`: structural traits inferred from construction, node layout, and submodels.
- `construction`: compact dimensions, node map, coordinate coverage, and node-order facts.
- `submodels`: captured submodel names/counts and structural groupings relevant to the custom model.

These fields are structural hints, not user semantics. Core code must not infer face, mouth, spoke, ring, or similar semantic meaning from user-defined model or submodel names. Those meanings should come from user/display metadata such as semantic hints and target preferences. Submodel names are still preserved as data so users and diagnostics can recognize what xLights exposed.

User-authored submodel semantics belong in `display/metadata.json` under `preferencesByTargetId[<targetId>].submodelHints`. Examples include labels such as mouth, eyes, outline, spokes, rings, segments, or layers when the user wants the sequencer to understand how a target's internal regions should be used. `semanticHints` describe the broader target meaning; `submodelHints` describe important internal regions or sequencing surfaces.

Submodel records are first-class records and should place their specific submodel facts under `structure.submodelMetadata`, including:

- submodel id and name
- parent id
- type and layout group when available
- line/range membership when available
- node coverage against the parent
- sibling count and sibling ids
- overlapping sibling ids
- structural relationship hints

`structure.submodels` remains the embedded submodel summary list for parent model records. It should not be the only place submodels exist.

Validated live shape for a custom-model submodel:

- `targetId`: current xLights submodel target id
- `targetKind`: `submodel`
- `identity.parentId`: current parent model id
- `identity.fingerprint`: stable `tmf1:*` value
- `structure.submodelMetadata.nodeCoverage`: `nodeCount`, `parentNodeCount`, and `ratio`
- `structure.submodelMetadata.siblingCount` and sibling/overlap lists when known
- `structure.submodelMetadata.structureHints`: compact structural hints such as `range_defined_region`, `node_scoped_region`, `partial_region`, `sibling_region`, and `overlapping_region`

### `sceneGraph.submodelsById`

Runtime scene graphs may contain live submodel information from XML, API readback, or other transient sources. Before sequence planning, review/apply validation, render evidence construction, or automation diagnostics use `sceneGraph.submodelsById`, the app should enrich it from `display/model-index.json`.

The merge rule is:

- preserve live-only fields such as membership arrays and render policy when they exist.
- prefer model-index identity fields such as `parentId`, display name, fingerprint, sibling context, node coverage, and structure hints.
- include submodels that exist in model-index even if the transient scene graph did not include them.
- update `stats.submodelCount` to reflect the effective merged graph.

This keeps runtime reasoning grounded in one project-level identity contract while still allowing live readback to provide details that are too volatile or too large for the compact model index.

Consumers that should use the enriched scene graph include:

- proposal generation
- review/apply execution
- render validation and render feedback artifacts
- app automation diagnostics
- direct app apply scripts and validation tooling
- target behavior learning

### `display/target-behavior.json`

`display/target-behavior.json` stores project-local observations about how effects behave on the user's current target fingerprints. It is not central training data and should migrate with the project.

Records are keyed semantically by:

- target or submodel fingerprint, falling back to current target id only when no fingerprint exists
- `targetKind`
- effect name/family
- probe scope such as `target` or `submodel`

The record id should remain stable as metadata becomes richer. Adding parent identity, structure hints, sibling context, or node coverage must enrich the existing aggregate rather than create a duplicate learning record.

Target behavior records should keep:

- `targetId`, `targetKind`, `targetFingerprint`, and `fingerprintVersion`
- display name and parent id/name when applicable
- effect name/family and probe scope
- compact structure hints, submodel context, and parent context when applicable
- evidence artifact references
- observed coverage/readability outcomes
- aggregate sample, positive, and negative counts

When older records exist with the same fingerprint/effect/scope but different record ids, upsert should consolidate them into the current semantic aggregate instead of preserving duplicates.

Submodel behavior records should carry the enriched submodel context from `display/model-index.json` through the effective scene graph. For a submodel probe this means:

- `parentId` and `parentName` identify the parent model.
- `parentContext` preserves the parent target fingerprint, canonical/raw type, and compact custom structure profile when the parent is a custom model.
- `submodelContext.nodeCoverage` records how much of the parent the submodel covers.
- `submodelContext.siblingCount`, `overlappingSiblingIds`, and `structureHints` preserve local structure.
- `stats.sampleCount`, `positiveCount`, and `negativeCount` accumulate under the same fingerprint/effect/probe aggregate.

Live validation confirmed that applying an `On` probe to a custom-model submodel updates one stable target behavior record keyed by the submodel fingerprint and preserves parent identity, node coverage, and structural relationship hints without requiring semantic inference from the submodel name.

## Custom And Submodel Learning Flow

The app should treat custom models, built-in models, groups, and submodels as one target framework. Custom models need richer structure capture because their useful sequencing surfaces are often user-specific, but they should still enter the same flow as every other target:

1. Display refresh builds `display/model-index.json` from xLights layout APIs. This captures current target ids, fingerprints, raw/canonical type, parent linkage, group membership, node layout when available, custom structure summaries, and first-class submodel records.
2. Runtime planning loads the model index and enriches `displayElements` and `sceneGraph.submodelsById` before proposal generation, review/apply, render validation, and automation diagnostics.
3. Sequence planning builds candidate realization refs with target fingerprints. Candidate selection may use project `display/target-behavior.json` as advisory evidence, matching by fingerprint before target name so renamed models and submodels can reuse mature behavior learning.
4. Plan handoff metadata exposes compact traceability only: target-behavior artifact refs, matched behavior record ids, candidate ids influenced by local behavior evidence, aggregate behavior stats, and sampled target fingerprints. It should not copy full model-index geometry or raw API payloads into every plan.
5. Accepted apply/render outcomes update `display/target-behavior.json`. The write path should prefer model-index fingerprints over fallback scene-derived fingerprints and should consolidate existing records by fingerprint, target kind, effect family/name, and probe scope.
6. Later planning passes reuse the updated project-local behavior evidence as advisory input. Review/apply validation and render readback remain authoritative.

This flow gives each user installation a way to learn custom and submodel behavior without requiring centralized training to know every possible custom prop. Portable training packages may include anonymized summaries of these artifacts, but the user project remains the source of truth for display-specific target behavior.

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
