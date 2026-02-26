# xLights Phase 1 Proposal: Audio Analysis -> Timing + Lyrics Tracks

Date: 2026-02-26

## Why This Phase First
This targets a high-frequency sequencing pain point with immediate user value:
- users spend significant time generating timing marks and lyric scaffolding before effects work,
- xLights already has core internals for timing and lyric operations,
- scope is narrower and more maintainable than full autonomous effect sequencing.

This should be easier to socialize and merge than a broad “agent sequencing” proposal.

## Phase 1 Outcome
Given an MP3/media-backed sequence, automation can:
1. analyze audio and generate one or more timing tracks,
2. derive bars/downbeats and energy sections from analyzed audio,
3. create lyric tracks (phrases/words/phonemes) from provided text or subtitle input,
4. return deterministic metadata so an external agent can continue with effect authoring later.

## Existing Capabilities We Can Reuse
- VAMP plugin discovery/processing for timing marks:
  - `/Users/robterry/xLights/xLights/AudioManager.cpp:2914`
  - `/Users/robterry/xLights/xLights/sequencer/RowHeading.cpp:816`
- Timing track creation and management:
  - `/Users/robterry/xLights/xLights/sequencer/tabSequencer.cpp:3399`
- Lyrics import and phrase/word/phoneme breakdown on timing elements:
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:2155`
  - `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp:2273`
- SRT parsing support:
  - `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp:2176`

## API Strategy (Maintainer-Friendly)
Keep existing `ProcessAutomation` transport, but add new commands under a versioned envelope (`apiVersion: 2`) as described in the design proposal.

No breaking changes to legacy commands.

## Proposed Phase 1 Command Set

### 1) `system.getCapabilities` (if not already added)
Purpose: allow clients/agents to feature-detect phase-1 support.

### 2) `timing.listAnalysisPlugins`
Returns available VAMP timing plugins in the current runtime.

Request
```json
{ "apiVersion": 2, "cmd": "timing.listAnalysisPlugins", "params": {} }
```

Response (example)
```json
{
  "res": 200,
  "apiVersion": 2,
  "data": {
    "plugins": ["Bar and Beat Tracker", "Percussion Onset Detector"]
  }
}
```

### 3) `timing.createFromAudio`
Runs selected timing analysis plugin and creates a timing track.

Request
```json
{
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "params": {
    "plugin": "Bar and Beat Tracker",
    "trackName": "Beats",
    "mediaFile": null,
    "createIfMissing": true,
    "replaceIfExists": false
  }
}
```

Notes
- `mediaFile` optional; defaults to currently open sequence media.
- `createIfMissing` optionally creates/open sequence preconditions (or fail fast, depending on maintainer preference).

### 4) `timing.createBarsFromBeats`
Creates a dedicated bars/downbeats timing track from an existing beat track.

Request
```json
{
  "apiVersion": 2,
  "cmd": "timing.createBarsFromBeats",
  "params": {
    "sourceTrackName": "Beats",
    "trackName": "Bars",
    "beatsPerBar": 4,
    "replaceIfExists": false
  }
}
```

### 5) `timing.createEnergySections`
Creates a low/medium/high energy section timing track from analyzed audio.

Request
```json
{
  "apiVersion": 2,
  "cmd": "timing.createEnergySections",
  "params": {
    "trackName": "Energy",
    "mediaFile": null,
    "replaceIfExists": false
  }
}
```

### 6) `timing.detectSongStructure`
Creates a high-level section timing track (Intro/Verse/Chorus/Bridge/Outro).

Request
```json
{
  "apiVersion": 2,
  "cmd": "timing.detectSongStructure",
  "params": {
    "trackName": "Song Structure",
    "mediaFile": null,
    "replaceIfExists": false
  }
}
```

### 7) `lyrics.createTrackFromText`
Creates/uses a timing track and populates phrase/word/phoneme layers from provided lyrics text and a time range.

Request
```json
{
  "apiVersion": 2,
  "cmd": "lyrics.createTrackFromText",
  "params": {
    "trackName": "Lyrics",
    "text": "line1\\nline2\\nline3",
    "startMs": 0,
    "endMs": 90000,
    "breakdownWords": true,
    "breakdownPhonemes": true,
    "replaceExistingLayers": true
  }
}
```

### 8) `lyrics.importSrt`
Imports an SRT file to timing/lyric structure.

Request
```json
{
  "apiVersion": 2,
  "cmd": "lyrics.importSrt",
  "params": {
    "file": "/abs/path/song.srt",
    "trackName": "Lyrics",
    "replaceExistingLayers": false
  }
}
```

### 9) `timing.getTrackSummary`
Returns generated timing track stats for agent follow-up.

Request
```json
{
  "apiVersion": 2,
  "cmd": "timing.getTrackSummary",
  "params": { "trackName": "Beats" }
}
```

Response should include mark count, start/end, avg interval, and lyric layer presence.

## Out of Scope (Phase 1)
- Effect generation/placement automation.
- Bulk effect mutation APIs.
- Full playback transport control.
- Model-targeting intelligence.

## Why This Is Low-Risk
- Reuses mature in-app pathways users already run manually.
- Constrains changes to timing/lyrics preparation phase.
- Keeps API additions additive and versioned.

## Likely Maintainer Concerns and Answers
1. Concern: “This expands automation complexity.”
- Answer: narrow, single workflow domain; no effect rendering semantics touched.

2. Concern: “UI coupling may make API brittle.”
- Answer: phase-1 commands should call core sequencing methods and return deterministic summaries; avoid implicit UI selection dependence.

3. Concern: “Backward compatibility risk.”
- Answer: legacy untouched; v2 command envelope only.

## Incremental PR Plan

### PR-1: Framework + Discovery
- Add v2 command envelope parsing.
- Add `system.getCapabilities`.
- Add `timing.listAnalysisPlugins`.
- Add schema/error scaffolding for v2 commands.

### PR-2: Audio Timing Generation
- Add `timing.createFromAudio`.
- Add `timing.getTrackSummary`.
- Add `timing.createBarsFromBeats`.
- Add `timing.createEnergySections`.
- Include tests for plugin-not-found, no-media, duplicate-track handling.

### PR-3: Lyrics Tracks
- Add `lyrics.createTrackFromText`.
- Add `lyrics.importSrt`.
- Include tests for range validation, empty text, missing file, dictionary/phoneme behavior.

## Acceptance Criteria (Phase 1)
- A script can open/create sequence, run timing analysis, and produce a named timing track without UI interactions.
- A script can derive bars/downbeats and energy sections into separate timing tracks.
- A script can create lyric timing layers from text and/or SRT.
- Result summaries are machine-readable and stable.
- Existing automation commands behave unchanged.

## Success Metric
A sequencer can run one automation flow and get timing, bars/downbeats, energy, structure, and lyric scaffolding in under 2 minutes for a typical song, reducing manual pre-effect prep time.
