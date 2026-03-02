# Implementation Status Matrix: Contract vs Current xLights Branch

Status: Draft  
Date: 2026-03-02  
xLights branch audited: `audit/agent-hooks`  
xLights HEAD audited: `ea2b5f712`

## Legend
- `Implemented (v2)`: command exists under v2 namespaced contract.
- `Legacy Equivalent`: behavior exists only via legacy/unversioned command shape.
- `Missing`: no current endpoint implementation found.

## 1) System

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `system.getCapabilities` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:446` | Present and active in v2 router. |
| `system.validateCommands` | Missing | N/A | No v2 batch validation endpoint yet. |

## 2) Sequence Lifecycle

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `sequence.getOpen` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:974` | Legacy `openSequence/getOpenSequence` returns open-sequence metadata when no `seq` is provided. |
| `sequence.open` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:974` | Legacy open path exists; no v2 `sequence.open` yet. |
| `sequence.create` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1074` | Legacy `newSequence` exists; no v2 endpoint yet. |
| `sequence.save` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1093` | Legacy `saveSequence` exists; no v2 endpoint yet. |
| `sequence.close` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1044` | Legacy `closeSequence` exists; no v2 endpoint yet. |

## 3) Layout Discovery (Read-Only)

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `layout.getModels` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1727` | Legacy `getModels` exists. |
| `layout.getModel` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1796` | Legacy `getModel` exists. |
| `layout.getViews` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1766` | Legacy `getViews` exists. |
| `layout.getDisplayElements` | Missing | N/A | No direct command exposing display element list/order metadata. |

## 4) Media + Audio

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `media.get` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:974` | Media path included in legacy open/getOpen response; no dedicated command. |
| `media.set` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1074` | Media can be set via legacy `newSequence`; no dedicated v2 setter. |
| `media.getMetadata` | Missing | N/A | No explicit media metadata endpoint. |
| `timing.listAnalysisPlugins` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:458` | Implemented as provider/profile discovery with remote-analysis support. |

## 5) Timing Track and Mark Control

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `timing.getTracks` | Missing | N/A | No list endpoint for timing tracks. |
| `timing.createTrack` | Missing | N/A | Track creation currently implicit in other endpoints. |
| `timing.renameTrack` | Missing | N/A | Not found. |
| `timing.deleteTrack` | Missing | N/A | Not found as public API command. |
| `timing.getMarks` | Missing | N/A | Not found. |
| `timing.insertMarks` | Missing | N/A | Not found. |
| `timing.replaceMarks` | Missing | N/A | Not found. |
| `timing.deleteMarks` | Missing | N/A | Not found. |
| `timing.getTrackSummary` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:598` | Present in v2 router. |

## 6) Display Element Ordering

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `sequencer.getDisplayElementOrder` | Missing | N/A | Not found. |
| `sequencer.setDisplayElementOrder` | Missing | N/A | Not found. |

## 7) Effects + Layers

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `effects.list` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1844`, `1887` | Legacy `getEffectIDs` + `getEffectSettings` partially cover list/read needs, but not contract shape. |
| `effects.create` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1692` | Legacy `addEffect` exists; no v2 `effects.create` contract form. |
| `effects.update` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1921` | Legacy `setEffectSettings` exists; no v2 `effects.update` yet. |
| `effects.delete` | Missing | N/A | Not found as active command. |
| `effects.shift` | Missing | `xLights/automation/xLightsAutomations.cpp:2186`, `2190` | Historical commands appear in disabled/commented backlog, not active API. |
| `effects.alignToTiming` | Missing | N/A | Not found. |
| `effects.clone` | Legacy Equivalent | `xLights/automation/xLightsAutomations.cpp:1677` | Legacy `cloneModelEffects` exists; no v2 `effects.clone` yet. |

## 8) Additional v2 Commands Present (Outside Program Contract Core)

These are implemented in v2 today and should either be incorporated as explicit program extensions or tracked as subproject-specific:
- `timing.createFromAudio` (`:477`)
- `timing.createBarsFromBeats` (`:674`)
- `timing.createEnergySections` (`:766`)

## 9) Coverage Snapshot (Program Contract Commands)

- Implemented (v2): `3 / 29`
- Legacy Equivalent: `12 / 29`
- Missing: `14 / 29`

Interpretation:
- Strong progress on timing-analysis subproject APIs.
- Large remaining gap for full sequencer-control contract (especially timing mark CRUD, display element ordering, and effects lifecycle completeness).

## 10) Immediate Spec-to-Implementation Alignment Actions

1. Prioritize v2 wrappers/adapters for sequence and layout read commands currently only available in legacy names.
2. Define and implement timing track/mark CRUD as next major block.
3. Define and implement `effects.delete` and bulk/align commands with explicit filter semantics from program decision log.
4. Keep legacy commands unchanged; add new behavior only under v2 namespaced commands.
