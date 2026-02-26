# Project Spec: xLights Audio Analysis + Timing/Lyric Track Automation

Status: Draft  
Date: 2026-02-26  
Project type: Standalone Phase (independent of full agent sequencing)

## 1. Project Definition

### 1.1 Objective
Implement an automation project that converts song/media input into usable sequencing scaffolding by:
- generating timing tracks from audio analysis,
- generating or importing lyric tracks,
- exposing machine-readable summaries for downstream workflows.

### 1.2 Problem Being Solved
Sequencers spend significant manual time creating timing marks and lyric scaffolding before effects work begins. This project reduces that setup time with deterministic automation APIs.

### 1.3 Success Criteria
- A user can automate timing track generation from a media-backed sequence.
- A user can automate lyric track creation from text and/or SRT.
- Outputs are stable, queryable, and suitable for follow-on automation.
- Existing automation behavior remains backward compatible.

## 2. Scope

### 2.1 In Scope
- Audio timing analysis command(s).
- Song structure section detection (e.g., Intro, Verse, Chorus, Bridge, Outro).
- Timing track creation/update commands.
- Lyric track creation from plain text.
- Lyric track creation/import from SRT.
- Track summary/read APIs.
- Validation, error schema, and compatibility behavior for this project.

### 2.2 Out of Scope
- Effect generation/placement.
- Model-targeted effect logic.
- Playback transport automation (play/pause/seek).
- Full headless/server re-architecture.
- Generic “agent sequencing” orchestration.

## 3. Architecture and Compatibility

### 3.1 Transport Strategy
Use existing automation entry point (`ProcessAutomation`) for integration and maintainer familiarity.

### 3.2 Versioning Strategy
New commands for this project must use a versioned envelope:
- `apiVersion: 2`
- namespaced command IDs (`timing.*`, `lyrics.*`, `system.*`)

Legacy commands remain unchanged.

## 4. API Contract (Project-Specific)

## 4.1 Envelope
Request
```json
{
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "params": {},
  "options": {
    "dryRun": false,
    "requestId": "optional-client-id"
  }
}
```

Success response
```json
{
  "res": 200,
  "apiVersion": 2,
  "cmd": "timing.createFromAudio",
  "requestId": "optional-client-id",
  "data": {},
  "warnings": []
}
```

Error response
```json
{
  "res": 422,
  "apiVersion": 2,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "trackName is required",
    "details": [{ "path": "params.trackName", "reason": "required" }]
  }
}
```

## 4.2 Commands

### 4.2.1 `system.getCapabilities`
Purpose: feature discovery for this project.

Returns:
- supported `apiVersions`,
- supported project commands,
- capability flags (e.g., `vampPluginsAvailable`, `lyricsSrtImportAvailable`).

### 4.2.2 `timing.listAnalysisPlugins`
Purpose: list available audio timing analysis plugins.

Params: none.

Returns:
- plugin list,
- optional metadata (display name, internal key).

### 4.2.3 `timing.createFromAudio`
Purpose: generate a timing track from audio analysis.

Params:
- `plugin` (string, required)
- `trackName` (string, required)
- `mediaFile` (string|null, optional; default active sequence media)
- `replaceIfExists` (bool, default false)
- `addToAllViews` (bool, default false)

Returns:
- created/updated track name,
- mark count,
- start/end time,
- plugin used.

### 4.2.4 `timing.getTrackSummary`
Purpose: fetch timing track statistics for verification.

Params:
- `trackName` (string, required)

Returns:
- track metadata,
- mark count,
- mark time range,
- avg/min/max interval,
- layer summary.

### 4.2.5 `timing.detectSongStructure`
Purpose: detect high-level musical sections and write them to a structure timing track.

Params:
- `trackName` (string, required; e.g., `Song Structure`)
- `mediaFile` (string|null, optional; default active sequence media)
- `replaceIfExists` (bool, default false)
- `labelStyle` (string, optional; default `standard`)

Returns:
- track name,
- section count,
- sections with `label`, `startMs`, `endMs`,
- confidence summary.

### 4.2.6 `lyrics.createTrackFromText`
Purpose: create/update lyric timing layers from input text.

Params:
- `trackName` (string, required)
- `text` (string, required; newline-delimited phrases)
- `startMs` (int, required)
- `endMs` (int, required)
- `replaceExistingLayers` (bool, default false)
- `breakdownWords` (bool, default true)
- `breakdownPhonemes` (bool, default true)

Returns:
- track name,
- phrases count,
- words count,
- phonemes count,
- warnings for unknown words/phonemes.

### 4.2.7 `lyrics.importSrt`
Purpose: import SRT subtitles into lyric/timing scaffolding.

Params:
- `file` (absolute path, required)
- `trackName` (string, required)
- `replaceExistingLayers` (bool, default false)
- `breakdownPhonemes` (bool, default true)

Returns:
- track name,
- subtitle entries imported,
- resulting phrase/word/phoneme counts,
- parse warnings.

## 5. Functional Requirements

### FR-1 Sequence Preconditions
All mutating commands must fail with explicit errors when no valid sequence/media context exists, unless project command explicitly supports creating context.

### FR-2 Deterministic Mutation
Given same input and sequence state, commands produce same track artifacts and summary counts.

### FR-3 Idempotency Controls
Commands that may duplicate work must support replacement flags (`replaceIfExists` / `replaceExistingLayers`) and return whether action created/updated/skipped.

### FR-4 Validation First
Input validation occurs before any state mutation.

### FR-5 Stable Machine Output
All project commands return stable JSON structure, suitable for scripting and CI checks.

### FR-6 Song Structure Output
Song structure detection must output ordered, non-overlapping sections and write them as timing track labels suitable for manual review/editing.

## 6. Non-Functional Requirements

- Backward compatibility with current automation commands.
- Explicit error codes and human-readable messages.
- No dependency on UI selection state.
- Runtime behavior acceptable for typical song lengths.

## 7. Test Plan

### 7.1 Unit/Component Coverage
- envelope validation (`apiVersion`, `cmd`, `params`).
- command parameter validation.
- duplicate track/layer handling logic.
- error contract shape.

### 7.2 Integration Coverage
- open/create sequence + run `timing.createFromAudio`.
- run `lyrics.createTrackFromText` and verify layer counts.
- run `lyrics.importSrt` with valid/invalid SRT.
- run `timing.detectSongStructure` and verify section ordering, coverage, and labels.
- verify `timing.getTrackSummary` consistency.

### 7.3 Compatibility Coverage
- regression pass for existing legacy commands unaffected by project changes.

## 8. Delivery Plan

### Milestone A: Contract + Discovery
- Implement v2 envelope handling and `system.getCapabilities`.
- Implement `timing.listAnalysisPlugins`.

### Milestone B: Audio Timing
- Implement `timing.createFromAudio`.
- Implement `timing.getTrackSummary`.
- Implement `timing.detectSongStructure`.

### Milestone C: Lyrics
- Implement `lyrics.createTrackFromText`.
- Implement `lyrics.importSrt`.

## 9. Acceptance Criteria

Project is complete when:
1. All commands in Section 4.2 are implemented and documented.
2. Integration tests pass for timing and lyric generation flows.
3. Existing automation command behavior remains unchanged.
4. Sequencer can generate timing + lyric scaffolding from an MP3 workflow without manual UI editing steps.
5. Song structure sections (Verse/Chorus/etc.) can be generated as a timing track for downstream sequencing workflows.

## 10. Open Decisions

1. Should `timing.createFromAudio` auto-create a timing track when missing, or require explicit track pre-creation?
2. For lyric text import, should phrase segmentation be strictly newline-based in v1 of this project?
3. What minimum plugin availability guarantees should be documented when VAMP plugins are missing?
