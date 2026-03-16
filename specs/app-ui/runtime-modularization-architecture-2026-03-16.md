# Runtime Modularization Architecture

## Goal
Reduce `app.js` from a single orchestration hub into domain runtimes that can be validated independently and composed by the shell.

## Current State
`app.js` still owns the primary mutation loop for:
- project and sequence lifecycle
- audio analysis orchestration
- designer/sequencer generation
- review/apply
- refresh and health polling

This is workable, but it is the next architectural bottleneck for autonomous iteration.

## Target Structure
Introduce runtime modules under `apps/xlightsdesigner-ui/runtime/`.

Recommended modules:
- `project-runtime.js`
- `audio-runtime.js`
- `design-runtime.js`
- `sequence-runtime.js`
- `review-runtime.js`
- `xlights-runtime.js`

## Boundary Rules
- `app.js` becomes composition and event wiring only.
- Domain runtimes own state mutation and orchestration for their area.
- Page-state builders remain derived read models only.
- xLights read/write helpers are injected into runtimes, not imported ad hoc from UI render files.

## First Refactor Targets
1. Extract `onRefresh` and xLights connectivity helpers into `xlights-runtime.js`
2. Extract `onAnalyzeAudio` into `audio-runtime.js`
3. Extract `onGenerate` into `design-runtime.js`
4. Extract `onApply` into `review-runtime.js`

## Why This Matters
This lets backend validation run workflow scenarios against domain runtimes directly instead of only driving the app shell.
