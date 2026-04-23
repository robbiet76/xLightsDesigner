Status: Active
Date: 2026-04-23
Owner: xLightsDesigner Team

# xLights API Release Readiness Audit

## Scope

Audit the full application interface between:

- `apps/xlightsdesigner-ui`
- `apps/xlightsdesigner-macos`
- the owned xLights API surface under `xLightsDesigner`

This audit is intentionally scoped to production integration behavior and excludes broad xLights app-shell changes. The implementation boundary remains:

- preferred changes in app code
- if xLights changes are required, keep them inside `src-ui-wx/xLightsDesigner/*`

## Release blockers found

### 1. Owned readiness was not enforced consistently

Symptoms:

- owned mutating operations could run before listener/app startup was fully ready
- app and native client used different ideas of what "ready" meant
- startup-settle behavior could bleed into sequencing operations

Impact:

- startup race conditions
- confusing failures during open/create/render/close
- increased risk of modal-driven or partially initialized xLights behavior leaking into normal workflows

### 2. Owned close semantics were incomplete in the JS client

Symptoms:

- owned `sequence.close` was returning a fake local success shape instead of calling the owned route

Impact:

- sequence-switch flows were not actually using the owned API contract
- close/open logic could not be trusted as a real release path

### 3. Owned sequencing apply could silently fall back to legacy transactions

Symptoms:

- compressible apply plans could fall back from owned batch apply to legacy transaction staging when owned health/apply failed

Impact:

- wrong execution path for owned endpoints
- increased risk of inconsistent behavior between dev/test and production
- hidden fallback made production diagnosis harder

### 4. Native macOS session service swallowed sequencing preflight failures

Symptoms:

- `openSequence(...)` and `createSequence(...)` used `try?` around save/close prep
- session switch preparation could fail silently

Impact:

- stale or partially switched session state
- sequencing operations could proceed after a failed precondition

### 5. Native client accepted weak reachability

Symptoms:

- `isReachable` treated `runtimeState == "ready"` as equivalent to a reachable listener

Impact:

- UI could present xLights as reachable when the listener was not actually available

## Fixes applied

### JS owned API client

File:

- [apps/xlightsdesigner-ui/api.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/api.js)

Changes:

- added a single readiness evaluator for owned health:
  - listener reachable
  - app ready
  - startup settled
- added explicit preflight for owned:
  - `sequence.open`
  - `sequence.create`
  - `sequence.save`
  - `sequence.close`
  - `sequence.renderCurrent`
  - `sequence.getRenderSamples`
- replaced fake owned `sequence.close` behavior with the real owned route

Result:

- owned sequencing actions now fail fast when the owned runtime is not ready
- sequence-close semantics now match the actual owned contract

### JS sequencing orchestrator

File:

- [apps/xlightsdesigner-ui/agent/sequence-agent/orchestrator.js](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-ui/agent/sequence-agent/orchestrator.js)

Changes:

- added stricter owned-health readiness check for compressible apply plans
- owned endpoints now fail closed when owned health is unavailable or not ready
- owned endpoints no longer silently fall through to legacy transactions
- legacy fallback behavior is preserved only for explicit legacy endpoints

Result:

- owned apply behavior is now deterministic
- release behavior for owned endpoints is explicit and diagnosable

### macOS session service

File:

- [apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/XLightsSessionService.swift](/Users/robterry/Projects/xLightsDesigner/apps/xlightsdesigner-macos/Sources/XLightsDesignerMacOS/Services/XLightsSessionService.swift)

Changes:

- added `ensureOwnedRuntimeReady(...)`
- validated owned JSON envelope consistently for GET/POST paths
- tightened `isReachable` to actual listener reachability
- added `prepareForSequenceSwitch(...)`
- removed swallowed failures during open/create sequence switching
- enforced owned preflight on:
  - save
  - close
  - render
  - open
  - create

Result:

- native session orchestration is now aligned with the owned API contract
- sequence switching is explicit and fail-fast

## Validation

Passed:

- `node --test apps/xlightsdesigner-ui/tests/api.test.js apps/xlightsdesigner-ui/tests/agent/sequence-agent/orchestrator.test.js`
- `swift test --package-path apps/xlightsdesigner-macos`

Key coverage added:

- owned health preflight before queued open/render/sample flows
- real owned close route and job completion
- owned endpoint fail-closed behavior in orchestrator

## Current release assessment

### Ready enough to keep moving

- owned readiness gating
- owned close/open/create/save/render contract handling
- owned vs legacy execution boundary in sequencing apply
- native session preflight behavior

### Residual acceptable compatibility

- explicit legacy endpoint support still exists for:
  - legacy automation endpoints
  - explicit legacy save fallback
- this is acceptable while migration remains dual-stack, provided owned endpoints do not silently cross into that path

### Remaining non-blocking follow-up

1. Add direct macOS unit coverage around `LocalXLightsSessionService`
- current package tests compile the service successfully
- direct network/service tests are still thin

2. Audit top-level connection UX text
- some UI messaging still refers to "fallback endpoint"
- this is cosmetic, but should be aligned with the actual owned-first policy

3. Keep large-job behavior on the owned batch path
- large sequencing jobs should continue to prefer compressible owned apply where available
- avoid adding new silent legacy fallbacks in higher-level runtimes

## Production rule going forward

For owned endpoints:

- fail fast if the listener is not reachable
- fail fast if the app is not ready
- fail fast if startup is not settled
- do not silently fall back to legacy mutation paths

For legacy endpoints:

- compatibility fallback remains allowed only when the user is explicitly operating against the legacy surface

## Conclusion

The major release blockers in the app <-> xLights API interface are closed for this slice.

The interface is now materially closer to production-ready because:

- readiness is explicit
- owned close/open/create/save/render behavior is real
- owned apply does not silently degrade into legacy mutation
- native session switching no longer swallows failures

The next work should be validation and scale behavior, not another round of interface ambiguity.
