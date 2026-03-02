# Acceptance Test Matrix: Full Sequencer Control

Status: Draft  
Date: 2026-03-02

## 1) Sequence Lifecycle
- `sequence.create` with valid params returns `200` and sequence metadata.
- `sequence.open` missing file returns `404 SEQUENCE_NOT_FOUND`.
- `sequence.save` with no open sequence returns `SEQUENCE_NOT_OPEN`.
- `sequence.close` with unsaved changes and `force=false` returns conflict/error.

## 2) Layout Read-Only
- `layout.getModels` returns deterministic model list keys.
- `layout.getDisplayElements` returns stable ordering fields.
- Any write-like params sent to `layout.*` return `422 VALIDATION_ERROR`.

## 3) Media + Audio
- `media.set` with invalid path returns `404`.
- `media.getMetadata` returns parseable duration/sample keys.
- `timing.listAnalysisPlugins` returns `plugins[]` and supports empty list.

## 4) Timing Tracks + Marks
- Track create/rename/delete obey conflict and not-found semantics.
- Mark insert/replace/delete return deterministic counts.
- Dry-run on mutating timing commands causes no persistent mutations.
- `timing.getTrackSummary` remains stable across repeated calls without changes.

## 5) Display Element Ordering
- `sequencer.setDisplayElementOrder` with complete valid list returns updated ordering.
- Invalid/missing element ids return `DISPLAY_ELEMENT_NOT_FOUND` or `VALIDATION_ERROR`.
- Dry-run returns feasibility without persistence.

## 6) Effects + Layers
- `effects.list` filter behavior is deterministic by model/layer/range.
- `effects.create/update/delete` enforce required fields and range validity.
- `effects.shift` and `effects.alignToTiming` honor explicit target filters only.
- `effects.clone` enforces source and destination requirements.
- Dry-run behavior on all mutating effects commands is non-persistent.

## 7) Cross-Cutting
- Malformed envelope returns `400 BAD_REQUEST`.
- Unsupported `apiVersion` returns `400 UNSUPPORTED_API_VERSION`.
- Unknown command returns `404 UNKNOWN_COMMAND`.
- `requestId` is echoed when provided.
- Legacy non-v2 commands continue to function unchanged.

## 8) Autonomous Loop Validation
- A scripted run can complete without UI interactions:
  - discover
  - open/create
  - mutate timing/effects
  - verify readback
  - emit deterministic report
- Any failed step exits with machine-readable error payload.

