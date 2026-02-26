# xLights Automation API Audit for Agent Sequencing

Audit date: 2026-02-26  
xLights repo inspected: `/Users/robterry/xLights/xLights`  
xLights commit inspected: `f3d67a91a689`

## Purpose
Define the full currently-available automation API surface, identify missing pieces for agent-driven sequencing, and prioritize gaps before proposing implementation PRs.

## Evidence Sources
- Automation command handler: `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:92`
- HTTP request routing and JSON bridge: `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:1152`
- Automation listener startup in app lifecycle: `/Users/robterry/xLights/xLights/xLightsMain.cpp:1839`
- `xlDo` command transport bridge: `/Users/robterry/xLights/xLights/automation/automation.cpp:193`
- Historical not-implemented command backlog (commented): `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:1360`
- Legacy API docs from historical commit `95a081ecb9` (`xlDo/xlDo Commands.txt`)

## Current API Surface (Implemented)

Transport
- `GET /<command>?k=v`
- `POST /xlDoAutomation` with JSON body `{"cmd":"...", ...}`

Implemented command set (canonical names)

### Sequence + Render
- `getVersion`
- `openSequence` (aliases: `getOpenSequence`, `loadSequence`)
- `closeSequence`
- `newSequence`
- `saveSequence`
- `renderAll`
- `batchRender`
- `checkSequence`
- `importXLightsSequence`
- `packageSequence`
- `packageLogFiles`
- `exportVideoPreview`

### Effect Editing
- `addEffect`
- `getEffectIDs`
- `getEffectSettings`
- `setEffectSettings`
- `cloneModelEffects`

### Model/View/Layout
- `getModels`
- `getModel`
- `getViews`
- `makeMaster`
- `setModelProperty`
- `deleteAllAliases`
- `saveLayout`
- `cleanupFileLocations`

### Controller/FPP/Output
- `getControllers`
- `getControllerIPs`
- `getControllerPortMap`
- `addEthernetController`
- `uploadController`
- `uploadFPPConfig`
- `uploadSequence`
- `getE131Tag` (alias: `e131Tag`)
- `lightsOn`
- `lightsOff`

### Utility/UI/Environment
- `changeShowFolder`
- `getShowFolder`
- `getFseqDirectory`
- `openController`
- `openControllerProxy`
- `playJukebox`
- `getJukeboxButtonTooltips` (alias: `jukeboxButtonTooltips`)
- `getJukeboxButtonEffectPresent` (alias: `jukeboxButtonEffectPresent`)
- `runScript` (Lua runner)
- `closexLights`
- `exportModelsCSV`
- `exportModel`
- `exportModelWithRender`

## Missing APIs

### 1) Historically Planned but Not Implemented
From the commented command backlog in `xLightsAutomations.cpp`:
- `runDiscovery`
- `exportModelAsCustom`
- `shiftAllEffects`
- `shiftSelectedEffects`
- `unselectEffects`
- `selectEffectsOnModel`
- `selectAllEffectsOnAllModels`
- `turnOnOutputToLights`
- `turnOffOutputToLights`
- `playSequence`
- `printLayout`
- `printWiring`
- `exportLayoutImage`
- `exportWiringImage`
- `hinksPixExport`
- `purgeDownloadCache`
- `purgeRenderCache`
- `convertSequence`
- `prepareAudio`
- `resetToDefaults`
- `resetWindowLayout`
- `setAudioVolume`
- `setAudioSpeed`
- `gotoZoom`
- `importSequence`

### 2) Agent-Critical Gaps Not Exposed Today
- Timing track CRUD endpoints:
  - create/rename/delete timing track
  - import/export timing track
  - add timing track to view(s)
- Timing mark CRUD endpoints:
  - insert/replace/delete timing marks
  - split/divide timing marks by ratio
- Effect lifecycle completeness:
  - list effects by range with full metadata
  - delete effects by id/model/layer/range
  - bulk move/shift/align with deterministic filters
- Playback/preview loop controls:
  - play/stop/pause/seek
  - timeline marker/viewport control
- Safety primitives:
  - dry-run validation endpoint
  - transaction/batch semantics with partial-failure reporting

## Priority for Implementation

### P0 (Required for autonomous sequencing)
- Timing track + timing mark CRUD
- Effect delete/list/bulk shift-align endpoints
- Rationale: without these, an agent can only append/patch effects, not fully iterate or refactor a sequence.

### P1 (Stability + iterative quality)
- Playback/seek/preview APIs
- Explicit filter-based bulk operations (avoid hidden UI selection state)
- Validation/dry-run endpoint
- Rationale: needed for robust agent loops and predictable retries.

### P2 (Operations and ecosystem breadth)
- Cache/system maintenance endpoints (`purge*`, `reset*`)
- Layout/wiring print/export endpoints
- Additional conversion/import utilities
- Rationale: useful, but not core to creating/editing sequences.

## Why These Endpoints Probably Don’t Already Exist

1. Automation evolved from operational scripts, not a contract-first editing API.
- Legacy `xlDo` docs and sample scripts focus on render/upload/check/controller tasks.

2. Many sequencing workflows are UI-state-centric.
- Existing automation mutators still touch UI components directly (refresh/select/post events), indicating coupling to interactive editor state.

3. Runtime model is app + GUI loop, not isolated headless service.
- Long-running operations rely on `wxYield()` loops and GUI lifecycle assumptions, raising complexity for broad API exposure.

4. Endpoint additions appear opportunistic and request-driven.
- Commit history shows incremental command additions, not a full API redesign.

## Recommended Next Step Before Any PR
1. Open a design proposal issue first (API scope, compatibility, versioning strategy).
2. Confirm whether maintainers prefer:
- extending current `ProcessAutomation`, or
- introducing a versioned namespace (`/api/v2/...`) with backward-compatible shims.
3. Align on a minimal v2 contract for P0 endpoints and required tests.

## Proposed Minimal v2 Contract (P0)
- `createTimingTrack`, `renameTimingTrack`, `deleteTimingTrack`, `getTimingTracks`
- `insertTimingMarks`, `replaceTimingMarks`, `deleteTimingMarks`
- `listEffects`, `deleteEffects`, `shiftEffects`, `alignEffectsToTiming`
- `validateCommands` (dry-run)

This set unlocks practical agent sequencing while limiting blast radius.
