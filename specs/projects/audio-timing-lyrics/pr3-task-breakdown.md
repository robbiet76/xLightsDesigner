# PR-3 Task Breakdown: Lyrics Track APIs

Date: 2026-02-26  
Scope: `lyrics.createTrackFromText`, `lyrics.importSrt`.

## PR-3 Outcome
Deliver no-UI lyrics scaffolding endpoints so external tooling can generate phrase/word/phoneme timing tracks from text or SRT input.

## Files and Changes

### 1) `/Users/robterry/xLights/xLights/automation/xLightsAutomations.cpp`
Changes:
- Add v2 command handlers for:
  - `lyrics.createTrackFromText`
  - `lyrics.importSrt`
- Add request validation and structured error responses.
- Wire dry-run behavior for both endpoints.

Complexity: Medium  
Risk: Medium

### 2) `/Users/robterry/xLights/xLights/sequencer/SequenceElements.cpp`
Changes:
- Extract non-dialog lyric generation path from `ImportLyrics(...)`.
- Reuse existing internals for:
  - phrase timing creation
  - `BreakdownPhrase(...)`
  - `BreakdownWord(...)`
- Add helper entrypoint for API-driven generation:
  - input text, start/end, layer options, replace policy.

Complexity: Medium-High  
Risk: High (current flow is UI-coupled and undo-manager aware)

### 3) `/Users/robterry/xLights/xLights/xLightsXmlFile.cpp`
Changes:
- Wrap SRT parsing/import path for deterministic API usage.
- Add replace behavior for target track/layers where needed.
- Surface parse warnings/counts in a consumable result object.

Complexity: Medium  
Risk: Medium

### 4) `/Users/robterry/xLights/xLights/sequencer/SequenceElements.h` (if needed)
Changes:
- Declare extracted helper APIs used by automation path.

Complexity: Low  
Risk: Low

## Endpoint-Level Tasks

### `lyrics.createTrackFromText`
Tasks:
- Validate:
  - `trackName` non-empty
  - `text` contains at least one non-empty line
  - `startMs >= 0`
  - `endMs > startMs`
- Resolve/create target timing track.
- Apply replace policy (`replaceExistingLayers`).
- Generate phrase timings across range.
- Optionally generate word/phoneme layers based on flags.
- Return counts and unknown-word list.

Acceptance:
- Valid request creates lyrics scaffolding without opening dialogs.

### `lyrics.importSrt`
Tasks:
- Validate:
  - absolute file path provided
  - file exists/readable
  - SRT parseable
  - `trackName` non-empty
- Import subtitle entries into phrase timing layer.
- Optionally perform phoneme breakdown.
- Return subtitle count, layer counts, parse warnings.

Acceptance:
- Valid SRT request imports predictable timing rows with no UI interaction.

## Extraction Plan (PR-3)

### From `ImportLyrics(...)`
- Keep UI dialog orchestration in UI function.
- Move core generation logic (phrase split, timing assignment, sanitation, breakdown calls) into reusable helper.
- Call helper from both:
  - existing UI dialog flow
  - new automation endpoint flow.

### For SRT import
- Keep file parsing/tokenization path from `ReadSRTLine(...)` and `ProcessSRT(...)`.
- Add API-friendly wrapper that:
  - targets explicit track name,
  - honors replace flag,
  - returns structured stats/warnings.

## Test Plan (PR-3)

### `lyrics.createTrackFromText`
- valid text/range -> `res=200`, phrase count > 0.
- empty text -> `422 VALIDATION_ERROR`.
- invalid range (`endMs <= startMs`) -> `422 VALIDATION_ERROR`.
- `breakdownWords=false` -> no word/phoneme layers.
- `breakdownWords=true`, `breakdownPhonemes=false` -> words only.
- replace false with existing conflicting target behavior documented and verified.
- dry-run -> no persistent layer/track mutations.

### `lyrics.importSrt`
- missing file -> `404 FILE_NOT_FOUND`.
- malformed SRT -> `422 VALIDATION_ERROR` with parse warning/details.
- valid SRT -> subtitle entries imported, counts returned.
- replace modes verified (conflict/update behavior).
- dry-run -> no persistent mutation.

### Regression checks
- existing manual lyrics import UI works unchanged.
- PR-1 and PR-2 endpoints remain unaffected.

## Data and Behavior Rules
- Phrase lines come from newline-delimited input text.
- Illegal/special characters are normalized using existing sanitation approach where possible.
- Generated marks must be sequence-bounded and non-negative.
- Layer index semantics stay stable:
  - phrase layer base,
  - word/phoneme layers appended in deterministic order.

## Implementation Order (Inside PR-3)
1. Extract non-UI lyric helper from `ImportLyrics(...)`.
2. Implement `lyrics.createTrackFromText`.
3. Implement API SRT wrapper for `lyrics.importSrt`.
4. Add replace-mode behavior and warning propagation.
5. Add endpoint tests + dry-run checks + regression checks.
6. Manual smoke test on a representative song.

## Definition of Done
- Both PR-3 endpoints run without dialogs.
- Counts/warnings are deterministic and machine-readable.
- Existing UI lyric workflows are unchanged.
- Validation and error responses match v2 contract.

## Open Decisions to Lock Before Coding
- Exact replace semantics:
  - replace all layers on target track vs replace only generated layers.
- Unknown-word reporting shape:
  - unique list vs frequency map.
- Whether phoneme breakdown in `lyrics.importSrt` is enabled by default in PR-3.
