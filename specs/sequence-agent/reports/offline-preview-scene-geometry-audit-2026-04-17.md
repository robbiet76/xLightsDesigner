# Offline Preview Scene Geometry Audit

Date: 2026-04-17
Show Root: `/Users/robterry/Documents/Lights/Current/Christmas/Show`
Mode: read-only
Exporter: [export-preview-scene-geometry-offline.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/export-preview-scene-geometry-offline.py)

## Result

First offline whole-scene geometry export succeeded against the production Christmas show.

Summary:
- exported models: `108`
- unresolved models: `5`
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

## Remaining Unresolved Models

The remaining `5` unresolved models are blocked by alias-style `StartChannel` references that do not appear in either:
- `xlights_rgbeffects.xml`
- `xlights_networks.xml`

Current unresolved set:
- `Train_Gondola`
- `PorchTree`
- `Snowball_SM`
- `Snowman`
- `NorthPoleSpiral`

These are not geometry-format failures. They are channel-reference resolution failures.

## Practical Meaning

This exporter is already good enough to start whole-scene mature-sequence audit work on the production show with materially better coverage than the previous live-only path.

It is not yet full parity.

The next offline-geometry improvement target is:
- resolve the remaining alias-style `StartChannel` references
