# Sequence Agent Spec Cleanup Audit

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

## Purpose

Classify current `sequence-agent` specs against the actual application and runtime state so stale documents can be updated, archived, or deleted without guesswork.

This is the first cleanup wave. It covers the current sequencing control and training-reset surfaces that are most likely to confuse implementation work.

## Current App / Runtime Baseline Used For Audit

The following active implementation surfaces were used as the comparison baseline:

- [api.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/api.js)
- [NativeAutomationServer.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/NativeAutomationServer.swift)
- [XLightsSessionService.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/XLightsSessionService.swift)
- `2026.06` owned API on `49915`
- current render-training tooling under `scripts/sequencer-render-training/`

## Decision Labels

- `keep`: aligned enough to remain active
- `update`: still relevant, but contains drift that should be corrected
- `archive`: no longer part of the active operating model
- `app_gap`: spec remains correct, but implementation is still missing or incomplete

## Audit Matrix

### 1. Current Sequencing / Training Control Surface

#### `sequencing-poc-boundary-2026-04-10.md`

Decision:
- `keep`

Why:
- still matches the current local-first sequencing posture
- still matches the current “quality first, infrastructure later” rule
- consistent with the active `2026.06` migration and live training harness work

App alignment:
- local-first execution is still true
- training and render feedback are still local-owned flows
- no contradictory runtime behavior found

#### `sequencer-validation-matrix-2026-04-15.md`

Decision:
- `keep`

Why:
- the named validation layers still exist
- the referenced tooling tests and controllers still exist
- the live sequencing/API/runtime surfaces named by the spec still map to current code

App alignment:
- [api.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/api.test.js) exists
- reset-cycle tooling tests exist under `scripts/sequencer-render-training/tooling/*.test.mjs`
- [run-sequencer-training-reset-cycle.sh](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/runners/run-sequencer-training-reset-cycle.sh) exists

#### `sequencer-training-reset-plan-2026-04-15.md`

Decision:
- `keep`

Why:
- still matches the current reset/rebuild direction
- still matches the current record-first, capability-first training model
- still consistent with the new effective registry and chunked validation harness

App alignment:
- raw evidence is preserved and reused
- capability/semantics artifacts are being regenerated
- old selector-doctrine is not the active direction anymore

#### `sequencer-training-unattended-batch-harness-v1-2026-04-15.md`

Decision:
- `update`

Why:
- the core controller idea is still correct
- but the actual active harness evolved into chunked stage1 execution and validation, not just the reset-cycle controller described here

App alignment:
- unattended controller exists
- chunked unattended runner now also exists:
  - [run-stage1-coverage-chunked.sh](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/runners/run-stage1-coverage-chunked.sh)

Update required:
- document chunked geometry-profile execution as the current active harness for large reruns
- clarify relationship between reset-cycle controller and chunked coverage controller

### 2. xLights `2026.06` Migration Surface

#### `xlights-2026-06-api-migration-plan-2026-04-16.md`

Decision:
- `keep`

Why:
- directly aligned with the actual migration work already completed
- current owned route surface and migration order match the live implementation

App alignment:
- owned API cutover happened on `2026.06`
- old xLights tree is deleted
- effectmetadata adoption happened after API restoration, as specified

#### `xlights-2026-06-owned-api-boundary-and-audit-2026-04-16.md`

Decision:
- `keep`

Why:
- still reflects the actual implementation boundary

App alignment:
- owned code lives in `src-ui-wx/xLightsDesigner`
- outside-boundary changes were intentionally narrow

#### `xlights-2026-06-api-compatibility-matrix-2026-04-16.md`

Decision:
- `keep`

Why:
- the contract described there matches the routes still consumed by the UI and native app

App alignment:
- current active consumers still call:
  - `/layout/models`
  - `/layout/scene`
  - `/sequence/render-samples`
  - `/sequencing/apply-batch-plan`

#### `xlights-2026-06-owned-api-implementation-plan-2026-04-16.md`

Decision:
- `keep`

Why:
- still reflects the owned-folder placement and seam strategy actually used

### 3. Preview Scene Geometry

#### `preview-scene-geometry-v1-2026-04-13.md`

Decision:
- `update`

Why:
- the geometry artifact direction is still correct
- but some of its references still point at the old `xlights-sequencer-control-api-surface-contract.md`, which is no longer current

App alignment:
- preview scene geometry export still exists
- current tooling consumes `channelStart` and `channelCount`
- current UI/runtime still prefers `layout.getScene` when available

Update required:
- replace old control-contract references with `2026.06` migration and owned API docs
- re-check the note about `layout.getScene` sequence requirements against the current `2026.06` runtime

#### `preview-scene-geometry-api-gap-2026-04-13.md`

Decision:
- `update`

Why:
- part of the documented gap is no longer a gap
- the export tooling now already expects and consumes:
  - `channelStart`
  - `channelCount`

App alignment:
- [export-preview-scene-geometry.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/sequencer-render-training/tooling/export-preview-scene-geometry.mjs) reads `channelStart` / `channelCount`
- proof artifacts already contain those fields

Open question / possible remaining gap:
- the tooling still carries a note that `layout.getScene` may require an open sequence

Update required:
- split “resolved” from “remaining” gaps
- remove the channel-mapping gap from the active blocker list

### 4. Clearly Stale Control-Surface Docs

#### `xlights-sequencer-control-api-surface-contract.md`

Decision:
- `archive`

Why:
- it describes a `POST /xlDoAutomation` `apiVersion: 2` envelope as the active transport
- the live app does not use that as its primary contract anymore
- the current live contract is the owned route surface on `49915`

App misalignment:
- current UI API client defaults to:
  - `http://127.0.0.1:49915/xlightsdesigner/api`
- current native app and desktop automation also probe the owned route surface directly

Specific stale claims:
- primary transport is `POST /xlDoAutomation`
- backward-compatible v2 envelope is the current main contract

Recommended action:
- archive

#### `xlights-sequencer-control-project-spec.md`

Decision:
- `archive`

Why:
- it still encodes pre-`2026.06` assumptions that are no longer true

App misalignment:
- hard source boundary says only:
  - `xLights/xLightsAutomations.cpp`
  - `xLights/automation/api/*`
- actual `2026.06` owned boundary is now:
  - `src-ui-wx/xLightsDesigner`
- it also explicitly preserves backward compatibility with old automation, which is no longer the project rule

Recommended action:
- archive

#### `effect-training-automation-loop-v1-2026-04-14.md`

Decision:
- `archive`

Why:
- the spec already declares itself transitional historical context
- it is no longer the canonical automation definition

App alignment:
- current automation uses:
  - effective registry
  - chunked validation
  - reset-cycle and chunked runners

Recommended action:
- archive and remove from any active index beyond historical/reference mentions

#### `xlights-upstream-tracking-policy-2026-04-13.md`

Decision:
- `archive`

Why:
- it refers to the deleted old xLights tree:
  - `/Users/robterry/xLights`
- it assumes the old `api-cleanup` local integration branch remains the active owned base
- `2026.06` migration docs now supersede its operational guidance

Recommended action:
- archive

### 5. Domain Index Drift

#### `sequence-agent/README.md`

Decision:
- `update`

Why:
- it was still surfacing stale control docs as foundational
- it did not clearly separate active `2026.06` migration docs from historical control-contract docs

Action already taken:
- foundational control section updated to point at the `2026.06` migration docs
- stale control docs moved into older/reference context

## Recommended Immediate Cleanup Actions

### Safe now

1. archive:
- `xlights-sequencer-control-api-surface-contract.md`
- `xlights-sequencer-control-project-spec.md`
- `effect-training-automation-loop-v1-2026-04-14.md`
- `xlights-upstream-tracking-policy-2026-04-13.md`

2. update:
- `preview-scene-geometry-v1-2026-04-13.md`
- `preview-scene-geometry-api-gap-2026-04-13.md`
- `sequencer-training-unattended-batch-harness-v1-2026-04-15.md`

3. keep:
- `sequencing-poc-boundary-2026-04-10.md`
- `sequencer-validation-matrix-2026-04-15.md`
- all `xlights-2026-06-*` migration specs
- `sequencer-training-reset-plan-2026-04-15.md`

## Next Audit Wave

After this first `sequence-agent` cleanup wave, the next most valuable domains are:

1. `specs/app-ui`
2. `specs/designer-dialog`
3. root governance specs

The `app-ui` domain is likely to contain the largest amount of stale planning clutter relative to the current native shell state.
