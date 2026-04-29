# Next Work Plan

Date: 2026-04-29

## Context

The current layer-composition training run is continuing against the 2026.06 API-enabled xLights build. Do not restart or rebuild that running xLights instance until the run finishes or is intentionally stopped.

The next work areas are:

1. update the owned xLights API branch to upstream xLights 2026.07
2. define how the app should add custom models
3. decide which effects to add next for training and sequencing

## 1. xLights 2026.07 Migration

An isolated migration worktree was created at:

`/Users/robterry/xLights-2026.07-migration`

Branch:

`xld-2026.07-migration`

Current status:

- upstream `2026.07` has been merged into the isolated worktree
- the expected `TabSetup.cpp` conflict was resolved
- the owned Designer launch suppression include was preserved
- the owned API include path was updated for 2026.07 path movement:
  - from `ui/shared/utils/wxUtilities.h`
  - to `shared/utils/wxUtilities.h`
- the active 2026.06 worktree and running app were not disturbed

Known follow-up before this can become the active xLights build:

1. Commit or intentionally carry the current `DesignerApiHost.h` render-wait change.
2. Build the 2026.07 migration worktree.
3. Run owned API smoke tests:
   - health
   - modal state
   - open sequence
   - save sequence
   - render current
   - render samples
   - timing track create/read/add marks
   - effect add/update/delete/layer operations
4. Re-import upstream effectmetadata from 2026.07.
5. Re-run native app handoff tests against the 2026.07 API build.

Do not replace the active training app until the current training run is complete.

## 2. Custom Model API Direction

Custom model creation should be implemented as an owned Layout API expansion, not as an effect/sequencing shortcut.

xLights already has the core creation path:

- `ModelManager::CreateDefaultModel("Custom", startChannel)`
- `CustomModel::UpdateModel(width, height, depth, modelData)`
- `CustomModel::SetCustomData(modelData)`
- `ModelManager::AddModel(model)`

The app should expose a noninteractive endpoint that creates or updates a model from structured data.

Initial endpoint implemented in the isolated 2026.07 migration worktree:

- `POST /xlightsdesigner/api/layout/models/custom`

Likely later endpoint family:

- `PUT /xlightsdesigner/api/layout/models/custom/{name}`
- optional later: `POST /xlightsdesigner/api/layout/model-groups`

Minimum request fields:

- `name`
- `startChannel` or explicit controller/channel binding policy
- `width`
- `height`
- `depth`
- `nodes`
- `stringCount`
- `layoutPosition`
- `layoutGroup`
- `preview`
- `overwritePolicy`

Recommended node format:

```json
{
  "x": 0,
  "y": 0,
  "z": 0,
  "node": 1,
  "string": 1
}
```

The owned API should convert that into xLights custom model data:

`std::vector<std::vector<std::vector<int>>>`

where each grid cell stores a node/channel index and empty cells remain zero.

Validation requirements:

- reject duplicate model names unless overwrite is explicit
- reject duplicate occupied cells unless the request explicitly supports multi-coordinate nodes
- reject invalid dimensions
- reject missing node indices
- warn when node numbers are sparse or non-contiguous
- require explicit policy for start channel/controller assignment
- call model setup/reload work after mutation
- save only through the existing owned save route

This should start with custom model create/update only. Group creation can follow after custom model creation is stable.

Current implementation status:

- `POST /xlightsdesigner/api/layout/models/custom` is wired through the owned route, request router, layout handler, layout service, and host.
- The host builds a xLights `CustomModel` using `ModelManager::CreateDefaultModel("Custom", startChannel)` and `CustomModel::UpdateModel(width, height, depth, modelData)`.
- The endpoint validates dimensions, duplicate occupied cells, positive node numbers, duplicate node numbers, and explicit overwrite behavior.
- Replacement now validates and builds the new custom model before deleting the existing model.
- Route coverage was added to the owned API self-test.

Remaining before this is active:

- Build the isolated 2026.07 worktree.
- Smoke-test the endpoint against a disposable development show folder.
- Decide whether the request-level `string` field should remain advisory or be promoted into stricter string/channel validation.
- Add native app/client wrapper and automated validation once the xLights side compiles.

## 3. Next Effects To Add

The current selector-ready registry effects are:

- Bars
- Color Wash
- Marquee
- On
- Pinwheel
- Shimmer
- Shockwave
- SingleStrand
- Spirals
- Twinkle

The repo already contains a first expansion plan for missing high-value effects:

1. Butterfly
2. Circles
3. Fire
4. Fireworks
5. Lightning

Recommended next effect wave:

1. Butterfly
   - high visual utility on matrices and dense props
   - strong motion/color behavior
   - common full-display texture layer
2. Circles
   - useful focal pulses, beat accents, and layered detail
   - easy to evaluate visually
3. Fire
   - important mood/texture effect
   - strong configuration sensitivity
4. Fireworks
   - high-impact accent effect
   - useful for choruses and hits
5. Lightning
   - high-energy accent effect
   - useful for sharp transients and dramatic moments

Recommended second wave:

6. Wave
7. Snowflakes
8. Strobe

Picture and Video effects should wait until generated media asset handling is stable. They are strategically important, but they add file-path and asset-lifecycle complexity that should not block the next pure-render training run.

## Recommended Sequence

1. Let the active training run finish.
2. Analyze the run results and update the learning bundles.
3. Finish 2026.07 build/smoke migration in the isolated worktree.
4. Re-import 2026.07 effectmetadata.
5. Smoke-test the custom model API and add the native app/client wrapper.
6. Add the first new effect wave to selector-ready registry/training manifests.
7. Prepare the next overnight run with:
   - current effect depth where gaps remain
   - first-wave new effects
   - broader geometry coverage
   - adaptive runtime fill to avoid early exhaustion
