# PR-2 Task Breakdown: Audio Timing Generation

Date: 2026-02-26  
Scope: `timing.createFromAudio`, `timing.getTrackSummary`, `timing.createBarsFromBeats`, `timing.createEnergySections`.

## PR-2 Outcome
Deliver no-UI timing generation APIs that create reusable timing scaffolding from audio and provide deterministic summaries for downstream automation.

## Files and Changes

### 1) `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
Changes:
- Add v2 command handlers for:
  - `timing.createFromAudio`
  - `timing.getTrackSummary`
  - `timing.createBarsFromBeats`
  - `timing.createEnergySections`
- Add request validation and structured error responses.
- Wire dry-run mode for all mutating endpoints.

Complexity: Medium  
Risk: Medium

### 2) `/Users/robterry/xLights/xLights/VAMPPluginDialog.cpp`
Changes:
- Extract non-UI plugin processing logic currently embedded in `ProcessPlugin(...)`.
- Preserve current dialog behavior by delegating to the extracted helper.

Complexity: Medium-High  
Risk: High (behavior drift risk if extraction is partial)

### 3) `/Users/robterry/xLights/xLights/AudioManager.cpp` (or new analyzer module)
Changes:
- Add deterministic energy-section analysis helper (RMS/flux + smoothing/segment labeling).
- Expose minimal API needed by automation handler.

Complexity: Medium  
Risk: Medium

### 4) `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp`
Changes:
- Reuse existing timing write path (`AddNewTimingSection(...)`) for generated bars/energy marks.
- Optional small helper additions for replace/clear target timing content if needed.

Complexity: Low-Medium  
Risk: Low

### 5) `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp` (read/query only)
Changes:
- Use existing track lookup and layer/effect traversal for summary.
- No functional sequencing UI changes targeted in PR-2.

Complexity: Low  
Risk: Low

## Endpoint-Level Tasks

### `timing.createFromAudio`
Tasks:
- Validate:
  - sequence open
  - media available/resolved
  - plugin exists
  - non-empty `trackName`
- Run extracted non-UI VAMP processor.
- Implement collision semantics with `replaceIfExists`.
- Return `trackName`, `action`, `plugin`, `markCount`, `startMs`, `endMs`.

Acceptance:
- Known plugin/media creates or updates timing track without dialogs.

### `timing.getTrackSummary`
Tasks:
- Resolve track by name.
- Compute:
  - mark count
  - start/end bounds
  - interval stats (`minMs`, `maxMs`, `avgMs`)
  - phrase/word/phoneme counts by layer
- Return deterministic zero-safe values.

Acceptance:
- Existing track summary is stable across repeated calls.

### `timing.createBarsFromBeats`
Tasks:
- Validate source timing track and `beatsPerBar > 0`.
- Read source marks in time order.
- Derive bar/downbeat marks (every N beats).
- Write to target timing track with `replaceIfExists` rules.

Acceptance:
- Output marks are sorted, non-overlapping, and bounded by sequence duration.

### `timing.createEnergySections`
Tasks:
- Validate media plus `levels` and `smoothingMs`.
- Compute energy timeline and segment into labeled sections.
- Emit sections via timing-track write path.
- Return sections with `label`, `startMs`, `endMs`, optional `confidence`.

Acceptance:
- Output sections are ordered, non-overlapping, and all durations are > 0.

## Algorithm Notes (PR-2)

### Bars/Downbeats
- Input: beat onset marks from source track.
- Rule: mark each beat; label every `beatsPerBar` onset as downbeat/bar start.
- Edge handling:
  - ignore invalid/duplicate/non-monotonic source points
  - clip to sequence duration.

### Energy Sections
- Suggested baseline:
  - frame audio into short windows
  - compute RMS + spectral flux proxy
  - smooth over `smoothingMs`
  - quantize into `levels` bins (`low/medium/high` by default)
  - merge adjacent identical labels
- Keep deterministic, local, and parameter-light for phase 1.

## Test Plan (PR-2)

### `timing.createFromAudio`
- valid plugin/media -> `res=200`, created track.
- unknown plugin -> `404 PLUGIN_NOT_FOUND`.
- no media -> `SEQUENCE_NOT_OPEN` or `MEDIA_NOT_AVAILABLE`.
- duplicate target + replace false -> `409 TRACK_ALREADY_EXISTS`.
- duplicate target + replace true -> update success.
- dry-run -> success response with no persistent mutation.

### `timing.getTrackSummary`
- missing track -> `404 TRACK_NOT_FOUND`.
- populated track -> correct counts and interval stats.
- empty track -> count/interval fields remain valid and parseable.

### `timing.createBarsFromBeats`
- missing source -> `TRACK_NOT_FOUND`.
- invalid `beatsPerBar` -> `VALIDATION_ERROR`.
- valid source -> ordered bar track with expected downbeat cadence.
- dry-run -> no mutation.

### `timing.createEnergySections`
- invalid `levels`/`smoothingMs` -> `VALIDATION_ERROR`.
- valid audio -> non-empty sections and proper ordering.
- replace behavior -> conflict vs update paths verified.
- dry-run -> no mutation.

### Regression checks
- legacy automation commands unchanged.
- PR-1 endpoints unaffected.

## Implementation Order (Inside PR-2)
1. Extract/reuse non-UI VAMP analysis helper.
2. Implement `timing.createFromAudio`.
3. Implement `timing.getTrackSummary`.
4. Implement `timing.createBarsFromBeats`.
5. Implement `timing.createEnergySections`.
6. Add endpoint + dry-run + regression tests.
7. Manual smoke test on representative song.

## Definition of Done
- Four PR-2 endpoints pass happy-path and key-failure tests.
- No UI dialogs are required for endpoint execution.
- Generated tracks are deterministic and machine-readable.
- Backward compatibility with legacy automation is preserved.

## Open Decisions to Lock Before Coding
- Whether plugin parameter overrides are supported in PR-2 or deferred.
- Exact energy confidence semantics (real score vs omitted in alpha).
- Preferred behavior when source beat track has sparse/irregular marks.
