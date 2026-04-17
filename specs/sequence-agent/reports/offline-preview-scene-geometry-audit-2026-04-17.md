# Offline Preview Scene Geometry Audit

Date: 2026-04-17
Show Root: `/Users/robterry/Documents/Lights/Current/Christmas/Show`
Mode: read-only
Exporter: [export-preview-scene-geometry-offline.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/export-preview-scene-geometry-offline.py)

## Result

First offline whole-scene geometry export succeeded against the production Christmas show.

Summary:
- exported models: `113`
- unresolved models: `0`
- audit-eligible models: `98`
- audit-excluded `Unassigned` models: `15`
- exclusivity groups: `18`
  - exact shared-channel groups: `1`
  - shadow-model groups: `17`
- views discovered from XML: `3`
- model groups discovered from XML: `74`

## Supported Display Types

The current exporter handled these show-local display types:
- `Single Line`
- `Poly Line`
- `Custom`
- `Horiz Matrix`
- `Tree 360`
- `Tree Flat`
- `Star`
- `Icicles`

## Audit Scope Rules

The current exporter follows xLights source semantics for:
- `@Model:n`
- `>Model:n`
- `ShadowModelFor`

Default mature-sequence audit behavior:
- include normal sequencing models
- include shadow/shared-channel models in raw geometry export
- exclude `LayoutGroup == Unassigned` models from audit scope by default

That matches the production-show usage pattern:
- `Unassigned` models are backend/helper models
- shadow/shared-channel models remain valid sequencing representations
- but same-output alternatives are treated as mutually exclusive targets

## Practical Meaning

This exporter is now good enough to start whole-scene mature-sequence audit work on the production show with materially better coverage than the previous live-only path.

The next offline-geometry improvement target is:
- validate exclusivity-group handling against more mature-sequence windows
