# Step 3: xLights Endpoint -> Implementation Mapping (Phase 1)

Date: 2026-02-26  
Scope: audio analysis, timing tracks, song structure, energy tracks, lyric tracks.

## Goal
Map each proposed Phase 1 API endpoint to concrete xLights code paths, identify missing pieces, and prioritize what to build first.

## Existing Automation Entry Points
- Command dispatch: `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:92` (`xLightsFrame::ProcessAutomation`)
- HTTP envelope entry: `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:1152` (`xLightsFrame::ProcessHttpRequest`)
- JSON automation endpoint parsing (`/xlDoAutomation`): `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp:1175`

## Endpoint Mapping

### 1) `system.getCapabilities`
Status: mostly missing

Existing reusable code:
- Existing command router in `ProcessAutomation` can host this command.

Implementation needed:
- Add v2 envelope parse branch (`apiVersion == 2`) before legacy command handling.
- Add a capabilities response builder with:
  - `apiVersions`
  - command list
  - feature booleans (`vampPluginsAvailable`, `lyricsSrtImportAvailable`, `songStructureDetectionAvailable`)

Primary files:
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/xLightsMain.h` (method declarations if helper methods are added)

### 2) `timing.listAnalysisPlugins`
Status: mostly available

Existing reusable code:
- VAMP plugin listing: `/Users/robterry/xLights/xLights/AudioManager.cpp:2914` (`xLightsVamp::GetAvailablePlugins`)

Implementation needed:
- Thin adapter from automation JSON request -> plugin list response.
- Optional stable plugin `id` normalization.

Primary files:
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/AudioManager.cpp`

### 3) `timing.createFromAudio`
Status: partially available (UI-coupled)

Existing reusable code:
- Full VAMP processing flow exists in dialog path:
  - `/Users/robterry/xLights/xLights/VAMPPluginDialog.cpp:168` (`VAMPPluginDialog::ProcessPlugin`)
  - Writes generated timing track via `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp:2933` (`AddNewTimingSection`)

Missing pieces:
- Core non-UI service method for plugin processing (today it depends on `ShowModal()` and dialog controls).
- Programmatic parameter defaults/overrides for plugin params.
- Deterministic conflict handling (`replaceIfExists`).

Implementation direction:
- Extract processing logic from dialog code into a reusable automation-safe helper (same data path, no dialog).
- Keep dialog path delegating to same helper to avoid behavior drift.

Primary files:
- `/Users/robterry/xLights/xLights/VAMPPluginDialog.cpp`
- `/Users/robterry/xLights/xLights/AudioManager.cpp`
- `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

### 4) `timing.createBarsFromBeats`
Status: missing

Existing reusable code:
- Track create/write functions:
  - `/Users/robterry/xLights/xLights/sequencer/tabSequencer.cpp:3399` (`AddTimingElement`)
  - `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp:2933` (`AddNewTimingSection`)
- Timing track lookup:
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:1471` (`GetTimingElement(name)`)

Missing pieces:
- Algorithm that derives bars/downbeats from a source beat track.
- Validation for source track existence + monotonic mark sequence.

Implementation direction:
- New helper: read source timing marks, emit every `beatsPerBar` as downbeat section labels, write into target track.

Primary files:
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- likely new helper under `xLights` core (timing utilities module) to avoid bloating router.

### 5) `timing.createEnergySections`
Status: missing

Existing reusable code:
- Audio processing primitives in `AudioManager`.
- Timing write path via `AddNewTimingSection`.

Missing pieces:
- Energy extraction + smoothing + segmentation algorithm.
- Confidence scoring convention for sections.

Implementation direction:
- Add deterministic local analyzer (RMS/flux-based segmentation) and emit labeled sections (`low/medium/high`).
- Keep inference local and offline by default.

Primary files:
- `/Users/robterry/xLights/xLights/AudioManager.cpp` (or new analyzer module)
- `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

### 6) `timing.detectSongStructure`
Status: missing

Existing reusable code:
- Audio access + timing write path exist.

Missing pieces:
- Song-section classifier (Intro/Verse/Chorus/Bridge/Outro).
- Labeling policy + confidence outputs.
- Fallback path if classifier confidence is low.

Implementation direction:
- Phase 1 should expose this as optional capability:
  - return `songStructureDetectionAvailable=false` if backend/model is absent.
- Initial implementation can be heuristic (novelty + repetition) before model-based improvements.

Primary files:
- New analyzer module (recommended)
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
- `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp`

### 7) `timing.getTrackSummary`
Status: mostly available

Existing reusable code:
- Track enumeration and lookup:
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:1442`
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:1471`
- Layer/effect access:
  - `/Users/robterry/xLights/xLights/sequencer/Element.cpp:189` (`GetEffectLayer`)
  - `/Users/robterry/xLights/xLights/sequencer/EffectLayer.cpp:435` (`GetAllEffects`)

Implementation needed:
- API serializer that computes:
  - mark count, min/max/avg intervals,
  - start/end bounds,
  - phrase/word/phoneme counts by layer.

Primary files:
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

### 8) `lyrics.createTrackFromText`
Status: partially available (UI-coupled)

Existing reusable code:
- Phrase/word/phoneme generation internals:
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:2155` (`ImportLyrics`)
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:2227` (`BreakdownPhrase`)
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:2273` (`BreakdownWord`)

Missing pieces:
- Non-dialog API path (current import flow depends on `LyricsDialog`).
- Clean layer replacement policy from automation request flags.
- Unknown-word reporting contract.

Implementation direction:
- Extract lyric generation logic into a parameterized helper called by both UI dialog and automation endpoint.

Primary files:
- `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

### 9) `lyrics.importSrt`
Status: mostly available

Existing reusable code:
- SRT parsing + timing track population:
  - `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp:2103` (`ReadSRTLine`)
  - `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp:2176` (`ProcessSRT`)

Missing pieces:
- Direct single-file API wrapper with deterministic response payload.
- Optional replace behavior for existing target track.
- Consistent parse warning collection in response payload.

Primary files:
- `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp`
- `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`

## Prioritized Missing Pieces

Priority P0 (must-have for phase viability):
1. v2 envelope routing and standardized error model in `ProcessAutomation`.
2. Non-UI extraction for VAMP timing generation (`timing.createFromAudio`).
3. Non-UI extraction for lyric text generation (`lyrics.createTrackFromText`).
4. `timing.getTrackSummary` for deterministic machine follow-up.

Priority P1 (high-value user outcome):
1. `lyrics.importSrt` API wrapper with replace/warnings.
2. `timing.createBarsFromBeats`.
3. `timing.createEnergySections` (heuristic local implementation).

Priority P2 (optional capability in phase 1, can be feature-flagged):
1. `timing.detectSongStructure` with confidence values.

## Why These Endpoints Do Not Already Exist (Likely)
- Existing internals were built primarily for interactive UI workflows (dialogs, user choices).
- Automation path is legacy flat-command style; it predates a structured, namespaced JSON command model.
- Advanced analysis outputs (energy/structure) were not a baseline sequencing workflow in core xLights, so no stable API contract exists yet.

## PR Slicing Alignment
- PR-1: `system.getCapabilities`, `timing.listAnalysisPlugins`, v2 envelope/errors.
- PR-2: `timing.createFromAudio`, `timing.getTrackSummary`, `timing.createBarsFromBeats`, `timing.createEnergySections`.
- PR-3: `lyrics.createTrackFromText`, `lyrics.importSrt`.
- PR-4 (optional): `timing.detectSongStructure` if capability backend is ready.
