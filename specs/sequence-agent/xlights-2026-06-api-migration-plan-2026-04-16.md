# xLights 2026.06 API Migration Plan

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

## Purpose

Define the API-first migration plan for moving xLightsDesigner from the current owned xLights integration branch to upstream xLights `2026.06`.

This migration is not a blind code merge. It is a compatibility re-port.

The first required outcome is restoration of the current owned API contract used by:
- xLightsDesigner UI
- native macOS automation bridge
- render-training harness
- live review and render-feedback tooling

Only after that contract is restored should effect metadata and training metadata cutover proceed.

## Migration Rule

Upgrade order is fixed:
1. restore API compatibility
2. restore smoke/integration validation
3. adopt upstream effect metadata
4. rerun proof training flows
5. only then consider broader cleanup and deletion of superseded local metadata

Do not invert this order.

## Version Floor

This migration targets `2026.06` and later only.

Rules:
- do not add compatibility logic for pre-`2026.06` xLights versions
- do not keep old-version adapter branches inside the owned API layer
- if upstream changed a seam, fix the `2026.06` path directly rather than introducing version shims

Reason:
- the goal is to minimize source impact and maintenance burden
- carrying old-version compatibility into the new owned API would immediately recreate the legacy drift this migration is meant to remove

## Current Owned Contract

The current application depends on the owned xLights API at:
- `http://127.0.0.1:49915/xlightsdesigner/api`

And the native desktop automation bridge at:
- `http://127.0.0.1:49916`

### Current owned routes relied on directly

Read surfaces:
- `GET /health`
- `GET /jobs/get?jobId=...`
- `GET /sequence/open`
- `GET /sequence/settings`
- `GET /sequence/revision`
- `GET /media/current`
- `GET /layout/models`
- `GET /layout/scene`
- `GET /elements/summary`
- `GET /timing/tracks`
- `GET /timing/marks?track=...`
- `GET /effects/window`

Mutating/job-backed surfaces:
- `POST /sequence/open`
- `POST /sequence/create`
- `POST /sequence/save`
- `POST /sequence/close`
- `POST /sequence/render-current`
- `POST /sequence/render-samples`
- `POST /sequencing/apply-batch-plan`

### Current job semantics relied on directly

Owned async mutations are expected to return:
- `data.jobId`

And settle through:
- `GET /jobs/get?jobId=...`

Expected job states:
- `queued`
- `running`
- `completed` or equivalent settled success state
- `failed`

Required settled payload shape:
- `data.result.ok`
- `data.result.data`
- `data.result.error.code`
- `data.result.error.message`

### Current native bridge contract relied on directly

The native bridge on `49916` is application-owned and must remain stable even if xLights internals change.

It currently exposes:
- `GET /health`
- `GET /snapshot`
- `GET /sequencer-validation-snapshot`
- `GET /render-feedback-snapshot`
- `GET /assistant-snapshot`
- `GET /xlights-session`
- `POST /action`

Important detail:
- this bridge probes owned xLights routes such as `layout.scene` and `sequence.render-samples`
- if upstream changes break those owned routes, the bridge will surface degraded capability snapshots

## Current Code Seams To Re-port

Primary integration files:
- [api.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/api.js)
- [app.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/app.js)
- [XLightsSessionService.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/XLightsSessionService.swift)
- [NativeAutomationServer.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/App/NativeAutomationServer.swift)
- [automation.mjs](/Users/robterry/Projects/xLightsDesigner/scripts/desktop/automation.mjs)

Supporting smoke and proof tools:
- `scripts/xlights-control/*.sh`
- `scripts/xlights/*.mjs`
- `scripts/sequencer-render-training/runners/*.sh`

## Required 2026.06 API Compatibility Matrix

The migration must produce an explicit route-by-route matrix with these columns:
- current contract name
- current route/path
- current request shape
- current response shape
- 2026.06 implementation location
- delta summary
- adapter action required
- validation status

At minimum, the matrix must cover:
- health
- open sequence
- create sequence
- save sequence
- close sequence
- render current sequence
- render samples
- layout models
- layout scene
- sequence revision
- media current
- timing tracks
- timing marks
- effects window
- apply batch plan
- jobs get

## Hard Acceptance Gates

The 2026.06 upgrade is not accepted until all of the following are true.

### Gate A: route parity
The owned route contract above is restored or explicitly adapter-mapped.

### Gate B: async job parity
Job-backed routes still return a pollable job handle and a settled result shape that our UI and training harness can consume.

### Gate C: smoke parity
The following must pass against the `2026.06` migration branch:
- `scripts/xlights-control/01-discovery-smoke.sh`
- `scripts/xlights-control/02-sequence-lifecycle-smoke.sh`
- `scripts/xlights-control/03-sequencer-mutation-smoke.sh`
- `scripts/xlights-control/04-validation-gate-smoke.sh`
- `scripts/xlights-control/06-effects-definition-smoke.sh`
- `scripts/xlights-control/07-transactions-smoke.sh`
- `scripts/xlights-control/08-plan-execution-smoke.sh`
- `scripts/xlights-control/09-async-jobs-smoke.sh`
- `scripts/xlights-control/10-revision-conflict-smoke.sh`
- `scripts/xlights-control/11-diagnostics-smoke.sh`
- `scripts/xlights-control/12-sequence-session-scenarios.sh`

### Gate D: owned desktop probe parity
The following must report healthy capability status through the native bridge:
- `layout.models`
- `layout.scene`
- `sequence.render-samples`

### Gate E: UI API parity
- [api.test.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/tests/api.test.js) must pass after adaptation

### Gate F: render-review proof parity
A minimal proof must succeed for:
- open sequence
- apply batch plan
- render current
- render samples
- persist render observation / critique artifacts

## Upgrade Work Order

### Phase 1: contract inventory freeze
Create the compatibility matrix from the current owned contract before touching the new xLights tree.

Output:
- one frozen current-state API inventory
- one route-by-route migration matrix

### Phase 2: inspect 2026.06 xLightsDesigner seams
In the upgraded xLights source tree, inspect the new equivalents for:
- listener/host runtime
- sequence lifecycle handlers
- layout export handlers
- render-sample handlers
- async job runtime

Do not start adapting blindly until the new seam map is understood.

### Phase 3: restore minimum route parity
First restore these routes because the entire product depends on them:
- `/health`
- `/sequence/open`
- `/sequence/save`
- `/sequence/create`
- `/sequence/render-current`
- `/sequence/render-samples`
- `/layout/models`
- `/layout/scene`
- `/jobs/get`
- `/sequencing/apply-batch-plan`

### Phase 4: restore smoke/test parity
Run the smoke matrix and fix route/payload/job deltas until it passes.

### Phase 5: adopt upstream effect metadata
Only after API parity is back, integrate:
- `resources/effectmetadata/*.json`
- `resources/effectmetadata/shared/*.json`

That cutover should replace local parameter-definition ownership where parity is confirmed.

### Phase 6: proof training rerun
Run a small proof training batch on the upgraded branch before a broad retrain.

## Explicit Non-Goals For Phase 1

Do not do these during the API-first migration slice:
- full training regeneration
- analyzer refinement
- broad repo cleanup
- deleting current custom registries before importer parity is proven
- UI redesign or behavior cleanup unrelated to 2026.06 compatibility

## Key Risks

### Refactor seam movement
The upstream AI-assisted refactor may have:
- moved handler code
- renamed types
- changed payload shapes
- changed job semantics
- changed internal save/render sequencing

### False parity through partial smoke coverage
A route existing is not enough.
We need:
- route reachability
- payload compatibility
- settled job behavior
- artifact correctness

### Premature metadata cutover
The new `resources/effectmetadata` files are valuable, but they do not replace API compatibility work.
Trying to adopt them before lifecycle and render routes are stable will create noise.

## Immediate Next Outputs

The next concrete deliverables should be:
1. `2026.06` current-to-target API compatibility matrix
2. upgraded xLights seam inventory
3. failing smoke results against the new branch
4. route adaptation patches until smoke parity is restored
