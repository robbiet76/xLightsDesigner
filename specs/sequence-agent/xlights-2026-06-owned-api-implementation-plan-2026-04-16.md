# xLights 2026.06 Owned API Implementation Plan

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

## Purpose

Define the concrete implementation plan for reintroducing the owned xLightsDesigner API inside the `2026.06` source tree.

Version floor:
- this implementation is `2026.06`-only
- no backward-compatibility logic for pre-`2026.06` xLights versions should be added inside this module

Primary owned boundary:
- `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner/`

This plan is based on:
- the current active owned contract in xLightsDesigner
- the first-pass `2026.06` compatibility audit
- the prior owned module split that already worked in the current integration tree

## Key Observation

The previous owned module shape is still the correct model.

Working prior owned module files:
- [DesignerIntegration.h](/Users/robterry/xLights/xLights/xLightsDesigner/DesignerIntegration.h)
- [DesignerApiHost.h](/Users/robterry/xLights/xLights/xLightsDesigner/DesignerApiHost.h)
- [DesignerApiRuntime.h](/Users/robterry/xLights/xLights/xLightsDesigner/DesignerApiRuntime.h)
- [DesignerApiListener.h](/Users/robterry/xLights/xLights/xLightsDesigner/DesignerApiListener.h)

That older module already separated:
- integration bootstrap
- listener transport
- async runtime/jobs
- host/service access
- capability handlers/services/models under `api/`

So the `2026.06` migration should preserve that ownership shape and move it into the new source location, not invent another architecture.

## Recommended Folder Shape In 2026.06

```text
src-ui-wx/
  xLightsDesigner/
    README.md
    DesignerIntegration.h
    DesignerApiHost.h
    DesignerApiRuntime.h
    DesignerApiListener.h
    DesignerApiSelfTest.h
    DesignerApiSmoke.h
    api/
      transport/
      parsing/
      handlers/
      services/
      models/
```

This is the same ownership pattern as the current working integration, relocated into the new `2026.06` source layer.

## Minimal First Implementation Slice

The first implementation slice should restore only the core owned contract needed for product stability.

### Bootstrap and listener
Files:
- `src-ui-wx/xLightsDesigner/DesignerIntegration.h`
- `src-ui-wx/xLightsDesigner/DesignerApiListener.h`
- `src-ui-wx/xLightsDesigner/DesignerApiRuntime.h`

Responsibilities:
- initialize owned API
- start/stop listener on `49915`
- provide async job runtime and `/jobs/get`
- keep transport and job state isolated from upstream automation module

### Host bridge
File:
- `src-ui-wx/xLightsDesigner/DesignerApiHost.h`

Responsibilities:
- thin accessors into xLights host objects
- read sequence/layout/timing/effect state
- perform minimal lifecycle actions
- no transport logic

### Request routing and transport
Files:
- `src-ui-wx/xLightsDesigner/api/transport/ApiRequest.h`
- `src-ui-wx/xLightsDesigner/api/transport/ApiResponse.h`
- `src-ui-wx/xLightsDesigner/api/transport/JsonTransport.h`
- `src-ui-wx/xLightsDesigner/api/transport/RequestRouter.h`
- `src-ui-wx/xLightsDesigner/api/transport/EndpointRouter.h`

Responsibilities:
- request envelope
- endpoint mapping
- response envelope
- error envelope

### First capability handlers/services
Files:
- `src-ui-wx/xLightsDesigner/api/handlers/SequenceHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/LayoutHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/TimingHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/MediaHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/ElementHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/EffectHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/SequencingHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/RuntimeHandler.h`

And matching services/models.

This matches the prior owned design and is still the cleanest route decomposition.

## Route Ownership Plan

### Phase 1 routes
These should be implemented first because they unblock the app and smoke matrix fastest.

#### Runtime
- `GET /health`
- `GET /jobs/get`

Owned implementation:
- `DesignerApiRuntime.h`
- `api/handlers/RuntimeHandler.h`
- `api/models/JobModels.h`

#### Sequence
- `GET /sequence/open`
- `GET /sequence/settings`
- `GET /sequence/revision`
- `POST /sequence/open`
- `POST /sequence/create`
- `POST /sequence/save`
- `POST /sequence/close`
- `POST /sequence/render-current`

Owned implementation:
- `DesignerApiHost.h`
- `api/handlers/SequenceHandler.h`
- `api/services/SequenceService.h`
- `api/models/SequenceModels.h`

#### Media
- `GET /media/current`

Owned implementation:
- `api/handlers/MediaHandler.h`
- `api/services/MediaService.h`
- `api/models/MediaModels.h`

#### Layout
- `GET /layout/models`
- `GET /layout/scene`

Owned implementation:
- `api/handlers/LayoutHandler.h`
- `api/services/LayoutService.h`
- `api/models/LayoutModels.h`

#### Timing
- `GET /timing/tracks`
- `GET /timing/marks`

Owned implementation:
- `api/handlers/TimingHandler.h`
- `api/services/TimingService.h`
- `api/models/TimingModels.h`

#### Elements / effects
- `GET /elements/summary`
- `GET /effects/window`

Owned implementation:
- `api/handlers/ElementHandler.h`
- `api/services/ElementService.h`
- `api/handlers/EffectHandler.h`
- `api/services/EffectService.h`

#### Sequencing plan/apply
- `POST /sequencing/apply-batch-plan`

Owned implementation:
- `api/handlers/SequencingHandler.h`
- `api/services/SequencingService.h`

### Phase 2 route
#### Render samples
- `POST /sequence/render-samples`

This is intentionally separated because it is likely the highest-risk internal access seam.

Owned implementation target:
- `api/handlers/SequenceHandler.h`
- `api/services/SequenceService.h`
- possibly helper code under `xLightsDesigner/` if the extraction logic is too specialized

## Expected Outside-Boundary Exceptions

### Exception A: listener lifecycle hookup
Files expected:
- [xLightsMain.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.h)
- [xLightsMain.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.cpp)

Expected scope:
- include `DesignerIntegration.h`
- call initialize on startup
- call app-ready notification if needed
- call shutdown on teardown

This is the thinnest acceptable host seam.

### Exception B: build/project registration
Files expected:
- [xLights.cbp](/Users/robterry/xLights-2026.06/xLights/xLights.cbp)
- [Xlights.vcxproj](/Users/robterry/xLights-2026.06/xLights/Xlights.vcxproj)
- [Xlights.vcxproj.filters](/Users/robterry/xLights-2026.06/xLights/Xlights.vcxproj.filters)

Expected scope:
- add new owned files only

### Exception C: deep core access seams
Open only if proven necessary.

Likely candidates:
- `layout/scene`
- `sequence/render-samples`
- `sequencing/apply-batch-plan`

Rule:
- first attempt implementation entirely through `DesignerApiHost.h`
- only if the host seam cannot provide stable access should a core exception be opened

## Concrete Audit Findings By Route

### Sequence lifecycle
Upstream already has legacy implementations for:
- `openSequence`
- `closeSequence`
- `newSequence`
- `saveSequence`
- `renderAll`

Implication:
- these routes are good first migration targets
- the owned implementation should adapt these host capabilities behind the new route layer
- no broad core refactor should be needed initially

### Health and jobs
Upstream does not expose these in the required shape.

Implication:
- we must recreate them fully in owned code
- good news: they are mostly owned infrastructure, not xLights internals

### Layout exports
No current upstream owned route exists for:
- `layout/models`
- `layout/scene`

Implication:
- the owned implementation needs new export logic
- `layout/models` is likely easier
- `layout/scene` is a likely exception-risk route

### Render samples
No current upstream equivalent observed.

Implication:
- this will likely be the hardest migration slice
- delay it until the rest of the route skeleton and job runtime are back

### Apply batch plan
No current upstream equivalent observed.

Implication:
- sequencing mutation orchestration must be recreated in owned code
- may need deeper sequence/effect-grid access

## Recommended Build Order

1. create `src-ui-wx/xLightsDesigner/` skeleton
2. port bootstrap/listener/runtime
3. hook lifecycle in `xLightsMain.*`
4. restore `/health` and `/jobs/get`
5. restore sequence lifecycle routes
6. restore media, timing, and simple layout routes
7. restore `elements/summary` and `effects/window`
8. restore `sequencing/apply-batch-plan`
9. restore `sequence/render-samples`
10. run smoke matrix incrementally after each phase

## First Code Creation Set

The first created files should be:
- `src-ui-wx/xLightsDesigner/DesignerIntegration.h`
- `src-ui-wx/xLightsDesigner/DesignerApiListener.h`
- `src-ui-wx/xLightsDesigner/DesignerApiRuntime.h`
- `src-ui-wx/xLightsDesigner/DesignerApiHost.h`
- `src-ui-wx/xLightsDesigner/api/transport/ApiRequest.h`
- `src-ui-wx/xLightsDesigner/api/transport/ApiResponse.h`
- `src-ui-wx/xLightsDesigner/api/transport/JsonTransport.h`
- `src-ui-wx/xLightsDesigner/api/transport/EndpointRouter.h`
- `src-ui-wx/xLightsDesigner/api/transport/RequestRouter.h`
- `src-ui-wx/xLightsDesigner/api/handlers/RuntimeHandler.h`
- `src-ui-wx/xLightsDesigner/api/handlers/SequenceHandler.h`
- `src-ui-wx/xLightsDesigner/api/services/SequenceService.h`
- `src-ui-wx/xLightsDesigner/api/models/SequenceModels.h`
- `src-ui-wx/xLightsDesigner/api/models/JobModels.h`

That is enough to start restoring the route skeleton without dragging in every capability at once.

## Immediate Next Step

The next implementation slice should be:
- create the owned folder skeleton in `2026.06`
- wire the minimal host seam
- restore `/health` and `/jobs/get`
- then restore sequence lifecycle routes before anything else
