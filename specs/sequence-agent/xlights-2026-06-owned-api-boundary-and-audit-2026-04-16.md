# xLights 2026.06 Owned API Boundary And Audit Policy

Status: Active
Date: 2026-04-16
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-16

## Purpose

Define the source-code boundary for the `2026.06` xLights migration.

Primary rule:
- build migration changes inside the owned API area first
- treat all edits outside that area as exceptions
- every exception must be documented with reason and blast radius

This prevents the migration from turning into an uncontrolled refactor of the xLights codebase.

## Current 2026.06 Owned API Boundary

In `2026.06`, the old `xLights/xLightsDesigner` folder is no longer present.

The owned API boundary for the migration should be created at:
- `/Users/robterry/xLights-2026.06/src-ui-wx/xLightsDesigner/`

This is intentionally adjacent to, but separate from, upstream automation code in `src-ui-wx/automation/`.

Initial expected contents in that boundary:
- `src-ui-wx/xLightsDesigner/DesignerIntegration.h`
- `src-ui-wx/xLightsDesigner/DesignerApiHost.h`
- `src-ui-wx/xLightsDesigner/DesignerApiListener.h`
- `src-ui-wx/xLightsDesigner/DesignerApiRuntime.h`
- `src-ui-wx/xLightsDesigner/api/*`
- `src-ui-wx/xLightsDesigner/docs/*`

For migration planning, this directory is the default owned API implementation zone.

## Default Change Rule

During the `2026.06` migration:
- prefer implementing API compatibility changes in `src-ui-wx/xLightsDesigner/`
- do not spread route and contract logic across unrelated UI or render code unless proven necessary

The migration should bias toward:
- wrappers
- adapters
- request/response normalization
- owned route shims
- compatibility translation

inside the owned boundary.

## Allowed Outside-Boundary Categories

Edits outside `src-ui-wx/xLightsDesigner/` are allowed only when one of these is true.

### Placement rationale

Recommended location:
- `src-ui-wx/xLightsDesigner/`

Why this is the best fit:
- adjacent to `src-ui-wx/automation/`, which is the current upstream integration seam
- same source layer as `xLightsMain.*`, which already owns listener lifecycle
- clearly separate from upstream automation implementation
- lower build friction than a top-level or core-layer placement

Rejected alternatives:
- `src-ui-wx/automation/xLightsDesigner/`: too tightly coupled to upstream automation internals
- `xLights/xLightsDesigner/`: matches the old layout, but is no longer near the active refactored source layer
- top-level `xLightsDesigner/`: too detached from the wx integration seam
- `src-core/xLightsDesigner/`: wrong layer for app-owned listener and API contract work

### 1. Host registration / listener lifecycle
Examples likely include:
- `src-ui-wx/xLightsApp.h`
- `src-ui-wx/xLightsApp.cpp`
- `src-ui-wx/xLightsMain.h`
- `src-ui-wx/xLightsMain.cpp`
- app startup or shutdown hooks needed to register, start, stop, or expose the owned automation surface

### 2. Build/project registration
Examples likely include:
- `xLights/xLights.cbp`
- `xLights/Xlights.vcxproj`
- `xLights/Xlights.vcxproj.filters`

These are allowed when needed to compile or include owned API files.

### 3. Core capability extraction that cannot be reached from the automation layer alone
Examples might include:
- sequence session internals
- render sample extraction internals
- layout scene export internals

This category has the highest scrutiny and must not be used casually.

## Prohibited Migration Behavior

Do not do these without an explicit documented exception:
- broad refactors in `src-core`
- opportunistic cleanup in unrelated wx UI panels
- mixing rendering architecture changes with API compatibility work
- rewriting business logic outside the owned boundary just because upstream refactored it
- changing training/runtime assumptions at the same time as route migration

## Required Exception Log

Any source change outside `src-ui-wx/xLightsDesigner/` must be recorded in the migration audit.

Each entry must include:
- file path
- category
- reason the change could not stay in owned boundary
- exact dependency being satisfied
- whether the change is:
  - host bootstrap only
  - compile/build registration only
  - core capability access
- expected rollback/removal status after migration stabilizes

## Initial Known Host Seam

Based on the `2026.06` tree inspection, these files are already identified as likely host seam files:
- [xLightsApp.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsApp.h)
- [xLightsApp.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsApp.cpp)
- [xLightsMain.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.h)
- [xLightsMain.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsMain.cpp)

Current reason:
- `xLightsApp.*` owns app startup and shutdown lifecycle
- `xLightsMain.*` may still be needed later for internal capability access seams

These files should be treated as host seam files, not as general logic ownership.

## Current Exception Inventory

Current outside-boundary changes already required for the first restore slice:
- [xLightsApp.h](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsApp.h)
  - category: host bootstrap only
  - reason: restore explicit `OnExit()` override so the owned listener/runtime shuts down cleanly
- [xLightsApp.cpp](/Users/robterry/xLights-2026.06/src-ui-wx/xLightsApp.cpp)
  - category: host bootstrap only
  - reason: initialize the owned integration after frame creation, mark app-ready via `CallAfter`, and shut it down during app exit

## Initial Known Build Seam

Likely build registration files:
- [xLights.cbp](/Users/robterry/xLights-2026.06/xLights/xLights.cbp)
- [Xlights.vcxproj](/Users/robterry/xLights-2026.06/xLights/Xlights.vcxproj)
- [Xlights.vcxproj.filters](/Users/robterry/xLights-2026.06/xLights/Xlights.vcxproj.filters)

These are allowed only for compilation and project membership updates.

## Migration Audit Deliverables

The API migration work must produce these artifacts.

### 1. Owned boundary change inventory
- all files changed under `src-ui-wx/xLightsDesigner/`

### 2. Outside-boundary exception inventory
- all files changed outside `src-ui-wx/xLightsDesigner/`
- grouped by category
- justified line by line

### 3. Route compatibility matrix
- current owned route
- `2026.06` implementation file(s)
- whether the implementation stayed inside boundary
- if not, linked exception reason

### 4. Smoke validation evidence
- route parity
- job parity
- render sample parity
- apply-batch-plan parity

## Working Rule For The Upcoming Audit

When auditing `2026.06` source:
1. first locate the nearest implementation candidate inside `src-ui-wx/xLightsDesigner/`
2. only if that is insufficient, open a host seam exception
3. only if the host seam is insufficient, open a core capability exception
4. document the exception immediately, not after the fact

## Immediate Next Step

The next code-facing migration slice should begin with a route-by-route audit against `2026.06` using this rule:
- default every route adaptation into `src-ui-wx/xLightsDesigner/`
- log every exception outside that directory as it is discovered
