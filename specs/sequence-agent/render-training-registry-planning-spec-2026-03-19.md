# Render Training Registry Planning Spec

Status: Draft  
Date: 2026-03-19

Primary artifacts:
- [registry-planning-phase1.json](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/registry-planning-phase1.json)
- [generate-registry-plan-manifests.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/generate-registry-plan-manifests.py)

## Purpose

The registry planner maps:
- geometry profile
- effect
- stable base manifest
- registered parameters

into generated sweep manifests.

This removes the need to keep authoring repeated hand-built range manifests for every parameter.

## Planner Inputs

Each plan entry declares:
- `planId`
- `baseManifest`
- `geometryProfile`
- `parameters`

The base manifest provides:
- fixture
- effect family
- default shared settings
- default non-varied effect settings

The parameter registry provides:
- anchors
- applicability
- importance
- stop rules

## Output

The planner emits one generated manifest per:
- plan entry
- parameter

Example output naming:
- `singlestrand-single-line-horizontal.numberChases.json`
- `shimmer-star-single.dutyFactor.json`

## Immediate Intent

The planner is the bridge from:
- hand-authored baseline manifests

to:
- registry-driven first-order sweeps

## Next Step

Use planner output to:
1. generate fresh canonical sweep sets
2. run those generated manifests
3. replace duplicated hand-maintained range manifests over time
