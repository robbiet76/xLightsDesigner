# xLights 2026.06 API Compatibility Matrix

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-24

## Purpose

Record the first-pass route-by-route audit for migrating xLightsDesigner to upstream xLights `2026.06`.

This matrix compares:
- the current owned contract used by xLightsDesigner
- the `2026.06` upstream automation surface that actually exists today
- the expected migration target under the new owned boundary:
  - `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner/`

## First-Pass Conclusion

`2026.06` does not currently expose the owned route contract we depend on.

2026-04-24 update:
- this document remains the first-pass upstream compatibility audit, not the current status of the working API-enabled branch
- the working branch `/Users/robterry/xLights-2026.06` on `xld-2026.06-migration` now includes the owned `src-ui-wx/xLightsDesigner/` route surface used by the native app
- current validated owned routes include `/health`, `/jobs/get`, `/layout/models`, `/layout/scene`, `/sequence/create`, `/sequence/open`, `/sequence/close`, `/sequence/render-current`, `/sequence/render-samples`, `/sequence/save`, `/timing/marks`, `/effects/window`, and `/sequencing/apply-batch-plan`
- rows below should be read as original upstream-route evidence and migration rationale, not as an open implementation checklist for the owned working branch

What exists upstream today is still centered on:
- path-style automation commands in [xLightsAutomations.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/automation/xLightsAutomations.cpp)
- legacy JSON envelope handling through `xlDoAutomation`
- listener lifecycle in [xLightsMain.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.h) and [xLightsMain.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.cpp)

So the migration shape is now explicit:
- we are not adapting to an already-existing owned route surface in upstream
- we are reintroducing our owned route contract in the new `src-ui-wx/xLightsDesigner/` boundary
- upstream automation remains an integration seam, not the home of our contract

## Current Upstream Automation Surface Observed In 2026.06

Observed implementation files:
- [automation.h](/Users/robterry/xLights-2026.06/src-ui-wx/automation/automation.h)
- [automation.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/automation/automation.cpp)
- [xLightsAutomations.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/automation/xLightsAutomations.cpp)

Observed host seam files:
- [xLightsMain.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.h)
- [xLightsMain.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.cpp)

Observed upstream automation characteristics:
- listener is still attached to xLights host lifecycle
- request handling is still routed through `ProcessHttpRequest` and `ProcessAutomation`
- command shapes are still legacy command names such as:
  - `getVersion`
  - `openSequence`
  - `closeSequence`
  - `newSequence`
  - `saveSequence`
  - `renderAll`
  - `batchRender`
- transport still supports:
  - path-based commands
  - `xlDoAutomation`
- no current evidence of the owned route structure on `49915/xlightsdesigner/api`
- no current evidence of:
  - `/health`
  - `/jobs/get`
  - `/layout/scene`
  - `/layout/models`
  - `/sequence/render-samples`
  - `/sequencing/apply-batch-plan`

## Compatibility Matrix

Legend:
- `Present`: direct equivalent exists upstream now
- `Partial`: related legacy capability exists but not in the required route/payload/job shape
- `Absent`: no suitable upstream contract observed in first-pass audit

| Current Owned Contract | Current Route / Behavior | 2026.06 Upstream Status | Evidence | Migration Target | Default Location | Outside-Boundary Exception Expected |
|---|---|---|---|---|---|---|
| Health | `GET /health` | Absent | no upstream `/health` route observed; only `getVersion` legacy command | create owned health route | `src-ui-wx/xLightsDesigner/` | host listener hookup in `xLightsMain.*` |
| Job polling | `GET /jobs/get?jobId=` | Absent | no job route observed | create owned job runtime | `src-ui-wx/xLightsDesigner/` | likely none beyond host hookup |
| Sequence open read | `GET /sequence/open` | Partial | legacy `getOpenSequence` / `openSequence` command | create owned `GET /sequence/open` adapter | `src-ui-wx/xLightsDesigner/` | may call upstream sequence state internally |
| Sequence open mutate | `POST /sequence/open` | Partial | legacy `openSequence` command exists | create owned `POST /sequence/open` | `src-ui-wx/xLightsDesigner/` | may call upstream open helpers |
| Sequence create | `POST /sequence/create` | Partial | legacy `newSequence` command exists | create owned `POST /sequence/create` | `src-ui-wx/xLightsDesigner/` | may call upstream create helpers |
| Sequence save | `POST /sequence/save` | Partial | legacy `saveSequence` command exists | create owned `POST /sequence/save` | `src-ui-wx/xLightsDesigner/` | may call upstream save helpers |
| Sequence close | `POST /sequence/close` | Partial | legacy `closeSequence` command exists | create owned `POST /sequence/close` | `src-ui-wx/xLightsDesigner/` | may call upstream close helpers |
| Sequence render current | `POST /sequence/render-current` | Partial | legacy `renderAll` command exists | create owned render-current route | `src-ui-wx/xLightsDesigner/` | may need render host seam access |
| Sequence render samples | `POST /sequence/render-samples` | Absent | no route or obvious equivalent observed in first-pass audit | create owned render-sample route | `src-ui-wx/xLightsDesigner/` | likely core/render access exception |
| Sequence settings | `GET /sequence/settings` | Absent | no direct route observed | create owned settings snapshot route | `src-ui-wx/xLightsDesigner/` | may read sequence internals |
| Sequence revision | `GET /sequence/revision` | Absent | no direct route observed | create owned revision route | `src-ui-wx/xLightsDesigner/` | may read session internals |
| Media current | `GET /media/current` | Absent | no direct route observed | create owned media/session route | `src-ui-wx/xLightsDesigner/` | may read sequence/media internals |
| Layout models | `GET /layout/models` | Absent | no direct route observed | recreate owned export route | `src-ui-wx/xLightsDesigner/` | likely reads model manager / layout panels |
| Layout scene | `GET /layout/scene` | Absent | no direct route observed | recreate owned scene route | `src-ui-wx/xLightsDesigner/` | likely reads layout/model preview internals |
| Elements summary | `GET /elements/summary` | Absent | no direct route observed | recreate owned summary route | `src-ui-wx/xLightsDesigner/` | likely sequence/display element access |
| Timing tracks | `GET /timing/tracks` | Absent | no direct route observed | recreate owned route | `src-ui-wx/xLightsDesigner/` | likely sequence element access |
| Timing marks | `GET /timing/marks` | Absent | no direct route observed | recreate owned route | `src-ui-wx/xLightsDesigner/` | likely sequence element access |
| Effects window | `GET /effects/window` | Absent | no direct route observed | recreate owned route | `src-ui-wx/xLightsDesigner/` | likely sequence/effect grid access |
| Apply batch plan | `POST /sequencing/apply-batch-plan` | Absent | no direct route observed | recreate owned plan/apply route | `src-ui-wx/xLightsDesigner/` | likely multiple core access seams |

## Outside-Boundary Exception Register (Initial)

These are expected categories only. They are not yet approved as concrete file edits.

### Host lifecycle seam
Expected files:
- [xLightsMain.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.h)
- [xLightsMain.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.cpp)

Expected reason:
- owned listener registration
- owned listener startup / shutdown
- request dispatch entrypoint

### Build registration seam
Expected files:
- [xLights.cbp](/Users/robterry/xLights-2026.06/xLights/xLights.cbp)
- [Xlights.vcxproj](/Users/robterry/xLights-2026.06/xLights/Xlights.vcxproj)
- [Xlights.vcxproj.filters](/Users/robterry/xLights-2026.06/xLights/Xlights.vcxproj.filters)

Expected reason:
- compile the new `src-ui-wx/xLightsDesigner/` files

### Core capability seam
Expected only if unavoidable.

Candidate areas:
- render sample extraction
- layout scene reconstruction
- display/effect/timing introspection

Rule:
- do not open this category until a route implementation proves it cannot stay inside the owned boundary plus host seam.

## Initial Migration Implications

### 1. This is a re-port, not a thin rename
The upstream refactor did not preserve our owned route contract.
We should assume most of the owned route layer must be recreated.

### 2. The old owned implementation shape is still the right mental model
Because the route layer is absent upstream, the previous pattern remains valid:
- create an app-owned API module
- adapt to upstream internals behind that module
- keep upstream surface impact minimal

### 3. The highest-risk routes are already visible
The hardest areas are likely to be:
- `sequence/render-samples`
- `layout/scene`
- `sequencing/apply-batch-plan`

These are the ones most likely to require real access into refactored internals beyond the host seam.

## Next Audit Step

The next migration slice should produce a second-pass matrix with:
- exact candidate implementation files under `src-ui-wx/xLightsDesigner/`
- exact host seam hooks required
- first concrete outside-boundary exception entries
- first smoke targets to restore in order:
  1. `/health`
  2. `/jobs/get`
  3. `/sequence/open`
  4. `/sequence/save`
  5. `/sequence/render-current`
  6. `/layout/models`
  7. `/layout/scene`
  8. `/sequence/render-samples`
  9. `/sequencing/apply-batch-plan`
