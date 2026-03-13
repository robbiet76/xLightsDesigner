# Design Scene Context v1

Status: Draft
Date: 2026-03-13
Owner: xLightsDesigner Team

Purpose: define the designer-facing spatial/layout context artifact consumed by `designer_dialog`.

## 1) Role

`design_scene_context_v1` is a read-only, normalized design view of the xLights layout.

It exists so the designer can reason about:
- left / center / right
- foreground / midground / background
- high / low
- focal candidates
- perimeter / interior
- broad coverage vs dense detail zones

without needing raw xLights layout internals on every decision.

## 2) Source

Derived from read-only layout context:
- models
- groups
- submodels
- node geometry
- layout coordinates
- display arrangement metadata

## 3) Properties

- stable until layout changes
- cached
- read-only
- designer-facing rather than sequencer-facing

## 4) Suggested Shape

```json
{
  "artifactType": "design_scene_context_v1",
  "artifactVersion": "1.0",
  "layoutRevision": "layout-uuid-or-hash",
  "spatialZones": {
    "left": ["MegaTreeLeft", "ArchesLeft"],
    "center": ["MegaTree"],
    "right": ["MegaTreeRight", "ArchesRight"],
    "foreground": ["Border-01"],
    "background": ["HouseOutline"]
  },
  "focalCandidates": ["MegaTree", "Star", "HouseOutline"],
  "coverageDomains": {
    "broad": ["AllModels", "Outlines"],
    "detail": ["MegaTree/Star", "WindowLeft"]
  }
}
```
