# Render Training Model Geometry Audit

Date: 2026-03-19

Purpose:
- audit the canonical render-training layout against xLights model settings
- tie related-model differences back to XML attributes, not names
- establish the next input layer for `resolvedGeometryProfile` and `geometryTraits`

Authoritative source:
- `/Users/robterry/Projects/xLightsDesigner/render-training/xlights_rgbeffects.xml`

Generated artifact:
- [generic-layout-geometry-audit.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/catalog/generic-layout-geometry-audit.json)

## Main Findings

### `Tree 360`

Baseline:
- `TreeRound`

Important related-model difference:
- `TreeSpiral` is not just another `Tree 360`
- it changes structural form through:
  - `TreeSpiralRotations=12.000000`
  - `StrandDir=Vertical`
  - `parm1=1`
  - `parm2=300`

Interpretation impact:
- `TreeRound` should be treated as a compact round-tree baseline
- `TreeSpiral` should be treated as a spiral-enabled geometry profile
- these should not share the exact same analyzer lens

### `Star`

Baseline:
- `StarSingle`

Important related-model difference:
- `StarTripleLayer` changes structural form through:
  - `LayerSizes=30,40,50`
  - `parm2=120`

Interpretation impact:
- layered stars need a different geometry profile than single-layer stars
- center/tip and ring-layer balance should be tracked separately

### `Arches`

Baseline:
- `ArchSingle`

Important related-model differences:
- `ArchTripleLayer` changes structure through:
  - `LayerSizes=50,50,50`
  - `parm2=150`
- `ArchGroup` changes structure through:
  - `parm1=3`
  - grouped arch layout rather than one arch

Interpretation impact:
- grouped arches and layered arches should not be treated as the same profile as a single arch

### `Candy Canes`

Baseline:
- `CaneSingle`

Important related-model differences:
- `CaneStickGroup` changes structure through:
  - `CandyCaneSticks=true`
  - `parm1=3`
  - `parm2=18`
- `CaneGroup` changes structure through:
  - `parm1=3`
  - `parm2=18`

Interpretation impact:
- stick-segment canes and grouped canes need explicit traits in the geometry layer

### `Single Line`

Baseline:
- `SingleLineHorizontal`

Important related-model differences:
- `SingleLineVertical` changes orientation through:
  - `X2=0`
  - `Y2<0`
- `SingleLineSingleNode` changes structure through:
  - `parm2=1`
  - single-node geometry

Interpretation impact:
- orientation and single-node degeneracy should be explicit traits

### `Horiz Matrix`

Baseline:
- `MatrixLowDensity`

Important related-model differences:
- `MatrixMedDensity`
  - `parm1=16`
  - `parm2=50`
- `MatrixHighDensity`
  - `parm1=64`
  - `parm2=128`

Interpretation impact:
- matrix density tiers should be represented as structural traits

## Required Next Contract

The current `resolvedModelType` is useful but too coarse.

The next metadata layer should emit:
- `resolvedModelType`
- `resolvedGeometryProfile`
- `geometryTraits`

Examples:
- `TreeRound`
  - `resolvedModelType: tree_360`
  - `resolvedGeometryProfile: tree_360_round`
  - `geometryTraits: ["type:tree_360", "strings:16", "nodes_per_string:50"]`
- `TreeSpiral`
  - `resolvedModelType: tree_360`
  - `resolvedGeometryProfile: tree_360_spiral`
  - `geometryTraits: ["type:tree_360", "spiral_enabled", "strand_dir:vertical", "strings:1", "nodes_per_string:300"]`
- `StarTripleLayer`
  - `resolvedGeometryProfile: star_multi_layer`
- `ArchGroup`
  - `resolvedGeometryProfile: arch_grouped`

## Recommendation

Before expanding more analyzers:
1. derive geometry profiles from the audited settings
2. dispatch analyzers on geometry profile first
3. keep model names out of the semantic path
