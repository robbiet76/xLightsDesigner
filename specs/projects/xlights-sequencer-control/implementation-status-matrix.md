# Implementation Status Matrix: Contract vs Current xLights Branch

Status: Updated during WP-7 execution  
Date: 2026-03-02  
xLights branch audited: `audit/agent-hooks`  
xLights HEAD audited: `e0bedad92` (+ in-progress WP-7 working changes)

## Legend
- `Implemented (v2)`: command exists under v2 namespaced contract in `ProcessAutomation` v2 router.
- `Partial`: command exists but does not yet satisfy full contract expectations.
- `Missing`: no current endpoint implementation found.

## 1) Program-Core Commands (WP-1 .. WP-6)

These are the 29 commands explicitly scoped in `implementation-work-packages.md`.

| Contract Command | Status | Evidence | Notes |
|---|---|---|---|
| `system.getCapabilities` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:832` | Advertises supported v2 commands/features. |
| `system.validateCommands` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:901` | Returns per-command validation results (`valid`, `results[]`). |
| `sequence.getOpen` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:943` | |
| `sequence.open` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:953` | |
| `sequence.create` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1005` | |
| `sequence.save` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1068` | |
| `sequence.close` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1113` | |
| `layout.getModels` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1147` | |
| `layout.getModel` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1155` | |
| `layout.getViews` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1171` | |
| `media.get` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1191` | |
| `media.set` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1200` | Returns `422` for invalid path/readability in current implementation. |
| `media.getMetadata` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1228` | |
| `timing.getTracks` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1251` | |
| `timing.createTrack` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1281` | |
| `timing.renameTrack` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1323` | |
| `timing.deleteTrack` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1356` | |
| `timing.getMarks` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1383` | |
| `timing.insertMarks` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1429` | |
| `timing.replaceMarks` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1488` | |
| `timing.deleteMarks` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1541` | |
| `sequencer.getDisplayElementOrder` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1617` | |
| `sequencer.setDisplayElementOrder` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1624` | |
| `effects.list` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1723` | |
| `effects.create` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1757` | |
| `effects.update` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1806`, `:1871` | |
| `effects.delete` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1806`, `:1912` | |
| `effects.shift` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1806`, `:1944` | |
| `effects.alignToTiming` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1806`, `:1989` | |
| `effects.clone` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:2077` | |

### Core Coverage Snapshot
- Implemented (v2): `29 / 29`
- Partial: `0 / 29`
- Missing: `0 / 29`

## 2) Extended/Adjacent Commands

These are currently implemented in v2 but outside the original WP-1..WP-6 core package list.

| Command | Status | Evidence | Notes |
|---|---|---|---|
| `layout.getDisplayElements` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:1254` | Added in WP-7 start; returns element metadata for master display order. |
| `timing.listAnalysisPlugins` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:2155` | Provider/profile discovery shape. |
| `timing.createFromAudio` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:2174` | Current provider path is remote-analysis centric. |
| `timing.getTrackSummary` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:2295` | |
| `timing.createBarsFromBeats` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:2371` | |
| `timing.createEnergySections` | Implemented (v2) | `xLights/automation/xLightsAutomations.cpp:2460` | |

## 3) Remaining Contract Gaps

No active endpoint-level contract gaps are currently identified in the v2 command surface.

## 4) Observations for WP-7

1. The original six work packages are functionally in place.
2. `system.validateCommands` currently performs strong shape/precondition checks but remains preflight-oriented (it does not execute full deep semantic validation of runtime state transitions).
3. Harness/CI scaffolding exists and now supports a dedicated validation-gate suite.
