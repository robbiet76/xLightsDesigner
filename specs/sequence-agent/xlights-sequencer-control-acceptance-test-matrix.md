# Acceptance Test Matrix: Full Sequencer Control

Status: In Progress
Date: 2026-04-26
Owner: xLightsDesigner Team
Last Reviewed: 2026-04-26

## 1) Sequence Lifecycle
- `sequence.create` with valid params returns `200` and sequence metadata.
- `sequence.open` missing/non-existent file returns `404 SEQUENCE_NOT_FOUND`.
- `sequence.save` with no open sequence returns `404 SEQUENCE_NOT_OPEN`.
- `sequence.close` with unsaved changes and `force=false` returns conflict semantics.

## 2) Layout Read-Only
- `layout.getModels` returns deterministic model list keys.
- `layout.getViews` returns deterministic view/model memberships when a sequence is open; otherwise returns `SEQUENCE_NOT_OPEN`.
- `layout.getDisplayElements` returns deterministic element metadata keys (`id`, `name`, `type`, `orderIndex`) with `parentId` when derivable when a sequence is open; otherwise returns `SEQUENCE_NOT_OPEN`.
- Any write-like params sent to `layout.*` return `422 VALIDATION_ERROR` where implemented.

## 3) Media + Audio
- `media.set` with invalid path/readability returns `422 VALIDATION_ERROR` (current implementation behavior).
- `media.getMetadata` returns parseable duration/sample/channel keys.
- `timing.listAnalysisPlugins` returns provider/profile discovery payload (`providers[]`, `profiles[]`).

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
- `effects.create/update` preserve per-effect timing/layer settings such as layer blending, transition type, transition adjustment, transition reverse, and color modifiers when passed through `settings`.
- `effects.deleteLayer` enforces last-layer protection and only deletes non-empty layers when `force=true`.
- `effects.compactLayers` removes only empty layers and reports `removedLayerIndexes` deterministically.
- Planner and readback flows treat layer deletion, layer compaction, and layer reorder as first-class sequencing edits, not as placeholder effect creation.
- Horizontal effect movement is accepted through `effects.update` start/end changes; the older `effects.shift` schema name remains a shorthand contract until a dedicated owned route exists.
- `effects.alignToTiming` honors explicit target filters when it is part of a compatible owned batch plan.
- `effects.clone` remains a schema-level shorthand contract until a dedicated owned route exists; clone-like behavior should be expressed as explicit create/update commands in current owned apply paths.
- Dry-run behavior on mutating effects commands is non-persistent.

## 7) Validation Endpoint
- `system.validateCommands` returns `200` with `data.valid` and per-command `data.results[]`.
- Invalid candidate commands are reported with `valid=false` and machine-readable `error` fields.
- Validation is preflight and non-mutating.

## 8) Cross-Cutting
- Malformed envelope returns `400 BAD_REQUEST`.
- Unsupported `apiVersion` returns `400 UNSUPPORTED_API_VERSION`.
- Unknown command returns `404 UNKNOWN_COMMAND`.
- `requestId` is echoed when provided.
- Legacy non-v2 commands continue to function unchanged.

## 9) Autonomous Loop Validation
- A scripted run can complete without UI interactions:
  - discover
  - open/create
  - mutate timing/effects
  - verify readback
  - emit deterministic report
- Any failed step exits with machine-readable error payload.

## 10) WP-9 Advanced Control Validation
- `effects.listDefinitions` and `effects.getDefinition` return stable machine-readable effect parameter contracts.
- Transaction flow validates atomicity:
  - `transactions.begin` + staged mutations + `transactions.rollback` leaves no persisted changes.
  - `transactions.begin` + staged mutations + `transactions.commit` persists all changes or none.
- Async job flow validates observability and cancellation:
  - long operation returns `jobId`
  - `jobs.get` reaches terminal status deterministically
  - `jobs.cancel` transitions running jobs to `cancelled` when supported.
- Revision conflict flow validates optimistic concurrency:
  - stale `expectedRevision` returns deterministic conflict error.
- Save/open failures return structured machine-actionable diagnostics, not blocking UI dependency.

## 11) Harness Regression Gate
- `scripts/xlights-control/run-all.sh` must launch/open a live xLights endpoint before suite execution.
- `run-all.sh` must complete green across suites `01..11` for release-candidate validation.
- Harness failures must provide deterministic machine-readable per-suite artifacts and summary JSON.

## 12) Sprint 0 Agent Contract Gates
- Intent verb outside allowed v1 set (`analyze`, `propose_changes`, `refine_proposal`, `apply_approved_plan`) is rejected before planning.
- `apply_approved_plan` without explicit user approval token/action is rejected.
- Missing scope for apply (`targets` or explicit full-sequence confirmation) is rejected.
- Missing `baseRevision` for apply is rejected.
- In `create` mode, first major proposal is blocked until audio-analysis kickoff is complete:
  - media read attempted
  - section map produced
  - tempo/time-signature/beats/bars timing data produced
  - creative brief persisted for user review
- Guided workflow prompts must be present before first major proposal:
  - project concept/tone/goals capture
  - sequence intent/constraints capture
  - unresolved gaps surfaced as structured questions
- Planner output for normal flows must include concrete sequencing decisions (targeting + effect strategy), not only restated user intent.
- Agent must generate a viable first-pass plan from director-level prompts without requiring user-specified effect names.
- When user does specify detailed effect preferences, planner should honor them as constraints/overrides.
- Settings/form mutations requested by agent are blocked without explicit user confirmation action.
- Agent settings mutations are limited to editable UI fields and must emit auditable before/after deltas.
- Planner output must always include:
  - `planId`
  - `summary`
  - `assumptions[]`
  - `warnings[]`
  - `estimatedImpact`
  - `commands[]`
- Empty `commands[]` on apply path is rejected with machine-readable validation error.
- Any apply path must run `system.validateCommands` and fail closed on invalid result.

## 13) Sequence Sidecar + Manual-Edit Ownership Gates
- Sequence-specific analysis metadata is stored in sequence `.xdmeta` sidecar and not persisted as global app/project sequence state.
- Sidecar write is save-gated:
  - metadata changes mark sidecar dirty,
  - no sidecar write occurs before sequence save.
- App-side save path (`Save`, `Save As`) flushes dirty sidecar metadata for active sequence.
- xLights-side save path (external save) is detected and flushes dirty sidecar metadata.
- If no save event occurs, sidecar remains dirty and unwritten.
- Manual edits to generated `XD:` timing tracks are detected by signature mismatch and promote ownership to non-`XD:` user tracks:
  - `XD: Beats` -> `Beats`
  - `XD: Bars` -> `Bars`
  - `XD: Chords` -> `Chords`
  - `XD: Lyrics` -> `Lyrics`
  - `XD: Song Structure` -> `Song Structure`
- Once promoted/manual-locked for a fingerprinted track identity, subsequent analysis runs do not auto-overwrite that track.
- Tempo-correction rewrite paths must skip beat/bar mutations when manual lock is active.

## 14) Multi-Agent Orchestration + Handoff Gates
- Runtime role ownership is explicit:
  - `audio_analyst` owns analysis payload generation.
  - `designer_dialog` owns user-facing intent refinement and lighting-design intent authoring.
  - `sequence_agent` owns xLights plan command construction and execution.
- Boundary rule:
  - `audio_analyst` does not write timing tracks.
  - timing-track creation is owned by `sequence_agent`.
- `analysis_handoff_v1` must be emitted after analysis pass with required keys:
  - `trackIdentity`, `timing`, `structure`, `briefSeed`.
- `intent_handoff_v1` must be emitted before plan generation with required keys:
  - `goal`, `mode`, `scope`, `constraints`.
- `plan_handoff_v1` must include:
  - `planId`, `summary`, `warnings[]`, `commands[]`, `baseRevision`, `validationReady`.
- Apply must fail closed when required upstream handoff fields are missing.
- Diagnostics must indicate role-level failure origin (`audio_analyst|designer_dialog|sequence_agent`) when orchestration breaks.
