# Production Layering Calibration

Status: In Progress  
Date: 2026-04-22  
Owner: xLightsDesigner Team

## Purpose

Start real same-target layering calibration from production sequences using:

1. `.xsq` overlap inventory
2. isolated render variants
3. `layering_render_proof_v1`
4. `layering_observation_v1`

## What Is Now Working

The first production layering calibration path is implemented in:

- [run-production-layering-calibration.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/run-production-layering-calibration.py)

That runner now does the following:

1. selects high-suitability same-target overlaps from:
   - [build-production-layering-inventory.py](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/build-production-layering-inventory.py)
2. creates a temporary show workspace outside the production tree
3. copies:
   - `xlights_*.xml`
   - the source sequence folder
4. writes isolated `.xsq` variants for:
   - left effect only
   - right effect only
   - composite pair
5. exports offline preview-scene geometry for the copied show
6. requires xLights automation to already be attached to that copied workspace, or launches directly into the copied workspace when no automation listener is active
7. attempts the live render path needed for real layering proof

## Safety Boundary

The runner now refuses to switch an already-running xLights automation session away from its current show.

This is intentional.

If xLights is currently attached to the production show, the runner aborts instead of calling a live show-folder switch that could surface an `xlights_rgbeffects.xml` save prompt.

That keeps the production show read-only.

## Current Real Blocker

The runner reaches the live xLights render boundary, but the copied-show render path is not yet reliable enough to complete the first production case end to end.

Observed behavior:

1. switching the current live xLights session is no longer considered safe enough for production calibration
2. the runner now hard-fails instead of mutating that session
3. the remaining path must use a dedicated xLights instance/session started directly in the copied workspace

This is not a calibration-model issue.
It is an xLights integration/runtime issue.

## Why This Matters

For same-target layering calibration, the final mixed production `.fseq` is not enough.

We need isolated evidence for:

1. left layer
2. right layer
3. same-target composite

That means the live render path must be able to render temporary isolated `.xsq` variants safely.

## What We Learned

1. production same-target layering inventory is real and usable
2. the copied-show isolation workflow is correct in principle
3. the remaining failure is specifically at the dedicated live xLights render/session boundary

## Recommended Next Moves

There are two viable options:

1. preferred
   - stabilize dedicated copied-show live rendering through a separate xLights session started with `-s <copied-show-dir>`
   - goal: make temporary external show workspaces render reliably

2. fallback, only with explicit approval
   - create temporary isolated `.xsq` files inside the real show folder
   - render them
   - remove them immediately after capture

The first option preserves the read-only production boundary.
The second option is technically simpler, but it crosses that boundary.

## Current Conclusion

Layering calibration is no longer blocked on theory or missing candidates.

It is now blocked on one concrete integration seam:

- reliable isolated production render from temporary `.xsq` variants
