# Draft Issue: Phase 1 Automation - Audio Analysis to Timing + Lyrics Tracks

## Summary
Propose a narrow first phase of automation improvements focused on sequence prep:
- analyze audio and generate timing tracks,
- generate/import lyric tracks,
- return structured summaries for follow-on tooling.

This intentionally does **not** attempt full agent effect sequencing.

## Why This First
This is a common manual bottleneck for sequencers and should provide immediate practical value with low risk:
- timing and lyric prep is repetitive and time-consuming,
- xLights already has mature internal pathways for timing/lyrics,
- scope is constrained and easier to review than broad sequencing automation.

## Proposed Direction
Use existing automation entry point (`ProcessAutomation`) for compatibility and lower merge friction, while adding a versioned contract for new APIs:
- legacy commands unchanged,
- new commands require `apiVersion: 2` and namespaced `cmd` values.

Example request:
```json
{
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "params": {
    "plugin": "Bar and Beat Tracker",
    "trackName": "Beats"
  }
}
```

## Phase 1 API Scope
1. `system.getCapabilities`
- report supported `apiVersion`s and phase-1 command availability.

2. `timing.listAnalysisPlugins`
- list available VAMP timing analysis plugins.

3. `timing.createFromAudio`
- run plugin analysis and create timing track.
- options for duplicate handling (`replaceIfExists`/fail).

4. `timing.getTrackSummary`
- return mark count, start/end, average interval, layer details.

5. `lyrics.createTrackFromText`
- create/update lyric track from provided text + time range,
- optional breakdown into words/phonemes.

6. `lyrics.importSrt`
- import subtitle timing as lyric/timing track scaffolding.

## Out of Scope (Phase 1)
- effect generation/placement APIs,
- bulk effect mutation,
- playback transport controls,
- headless re-architecture.

## Existing Internals This Reuses
- VAMP plugin processing in audio/timing flows,
- timing track creation/editing internals,
- lyric import/breakdown pathways,
- SRT processing support.

(Concrete source references documented in local design notes.)

## Proposed PR Breakdown
### PR-1: Framework + Discovery
- Add v2 envelope parsing/dispatch,
- Add `system.getCapabilities`,
- Add `timing.listAnalysisPlugins`,
- Add standardized v2 error response shape.

### PR-2: Audio Timing Generation
- Add `timing.createFromAudio`,
- Add `timing.getTrackSummary`,
- tests for plugin missing/media missing/duplicate track behavior.

### PR-3: Lyrics Track Generation
- Add `lyrics.createTrackFromText`,
- Add `lyrics.importSrt`,
- tests for input validation and expected track/layer results.

## Backward Compatibility
- Existing automation commands and legacy request formats remain unchanged.
- New behavior is additive under `apiVersion: 2`.

## Acceptance Criteria
- A script can create/open a sequence, generate timing tracks from audio, and generate/import lyric tracks without UI-only steps.
- Results are machine-readable and stable for external tooling.
- No regressions to current automation command behavior.

## Questions for Maintainers
1. Is extending `ProcessAutomation` with a versioned command envelope acceptable for this phase?
2. Preferred naming conventions for namespaced commands (`timing.*`, `lyrics.*`, `system.*`)?
3. Preferred test location/style for automation API coverage?
