# Audio Analyst Implementation Checklist

Status: Active (planning and execution checklist)  
Date: 2026-03-12  
Owner: xLightsDesigner Team  
Last Reviewed: 2026-03-12

## 1) Purpose
Define the implementation checklist for `audio_analyst` as the canonical media-analysis specialist.

Boundary summary:
- `audio_analyst` owns audio/media analysis only.
- `audio_analyst` does not read or mutate xLights sequence/layout state.
- `designer_dialog` consumes analysis metadata as creative/reference context.
- `sequence_agent` consumes analysis output to create timing tracks and sequencing structure.

## 2) Exit-State Principles
- One canonical analysis artifact per media file.
- Modular provider/tool framework with replaceable adapters.
- No xLights write logic in `audio_analyst`.
- Downstream consumers read a stable normalized artifact or a derived handoff from it.

## 3) Phase Checklist

### Required Pre-Gate
- [x] Source/runtime audit complete for:
  - desktop bridge
  - analysis service
  - app orchestration
  - training assets
- [x] Current-state gaps approved.
- [x] Canonical artifact boundary approved:
  - full artifact vs downstream handoff

### Phase A: Role Contract and Artifact Boundary
- [x] Define canonical `audio_analyst` input contract.
  - media file path/reference
  - media root/project context as needed for storage
  - analysis settings/profile
  - no xLights revision/sequence/layout inputs
- [x] Define canonical persisted artifact contract:
  - `analysis_artifact_v1`
- [x] Define canonical downstream handoff contract:
  - either keep and tighten `analysis_handoff_v1`
  - or version it explicitly from the artifact
- [x] Define versioning policy for artifact and handoff schemas.

### Phase B: Canonical Project-Root Persistence
- [x] Implement media-id derivation.
- [x] Implement canonical artifact storage path:
  - `analysis/media/<media-id>/analysis.json`
- [~] Stop treating UI summary/pipeline state as the source of truth.
- [x] Persist artifact reads/writes through project-root storage only.
- [ ] Add migration/compatibility handling for any legacy audio-analysis state currently kept in sequence-side documents.

### Phase C: Audio Analyst Runtime Extraction
- [~] Extract `audio_analyst` orchestration out of `app.js`.
- [~] Create dedicated runtime module(s) for:
  - [x] request normalization
  - [~] service/provider execution
  - [~] result normalization
  - [~] artifact persistence
  - [x] handoff derivation
- [ ] Keep `app.js` limited to UI wiring and action dispatch.

### Phase D: Provider/Tool Framework
- [x] Define provider adapter contract for modular analyzers.
- [~] Implement first-class adapters for current external capabilities:
  - [x] beat analysis
  - [x] chord analysis
  - [x] lyrics retrieval
  - [x] track identity
  - [~] section labeling/relabeling
- [~] Separate provider arbitration from provider implementation.
- [x] Encode replaceability policy:
  - providers may be swapped without changing artifact schema
- [x] Define extension path for future in-house analyzers/plugins.

### Phase E: Canonical Artifact Normalization
- [~] Normalize all analysis outputs into one stable schema with:
  - media identity
  - duration/sample metadata
  - beats
  - bars
  - chords
  - lyrics
  - sections
  - tempo/meter
  - provider provenance
  - confidence/quality diagnostics
  - generation timestamp/version
- [x] Preserve provider lineage and evidence without leaking provider-specific raw formats downstream.
- [x] Ensure artifact is sufficient for both:
  - designer metadata use
  - sequence-agent timing-track generation

### Phase F: Handoff Derivation
- [x] Generate `analysis_handoff_v1` directly from canonical artifact, not from ad hoc UI summary state.
- [x] Ensure handoff contains enough distilled data for:
  - section-aware sequencing
  - lyric/chord-aware design context
  - timing-asset creation by `sequence_agent`
- [x] Keep artifact richer than handoff; do not collapse provenance too early.

### Phase G: Sequence/Xlights Boundary Enforcement
- [x] Remove remaining xLights/timing-track assumptions from `audio_analyst` runtime.
- [x] Confirm `audio_analyst` does not:
  - read live xLights sequence revision
  - mutate timing tracks
  - manage timing ownership policy
  - depend on current sequence state
- [x] Keep timing-track creation solely in `sequence_agent`.

### Phase H: Diagnostics and Failure Policy
- [x] Define deterministic failure taxonomy for `audio_analyst`.
- [x] Distinguish:
  - provider unavailable
  - media unreadable
  - identity lookup failed
  - lyrics unavailable
  - partial analysis success
  - full analysis failure
- [x] Persist artifact-level provenance and failure diagnostics.
- [x] Surface degraded-mode outcomes clearly without pretending full success.

### Phase I: Test and Eval Harness
- [x] Add dedicated `audio_analyst` unit tests in `apps/xlightsdesigner-ui/tests/agent/`.
- [x] Add artifact schema validation tests.
- [x] Add handoff validation tests.
- [x] Add provider arbitration/normalization tests.
- [x] Add golden-case tests for:
  - [x] beats/bars/chords/lyrics/sections presence
  - [x] partial-result handling
  - [x] canonical artifact persistence
- [x] Align service eval harness with packaged training assets.

### Phase J: Training Package Completion
- [~] Upgrade `audio_track_analysis` module from partial scaffold to full module parity.
- [~] Add/update:
  - [x] prompts
  - [x] fewshot
  - [x] eval configuration
  - [x] contract references
  - [x] dataset manifest
- [x] Keep training functionality-focused:
  - structure inference
  - timing/chord/lyric evidence usage
  - no xLights mutation behavior in this module

## 4) Recommended Canonical Artifact Shape
Minimum fields for `analysis_artifact_v1`:
- `artifactType`
- `artifactVersion`
- `media`
  - `mediaId`
  - `path`
  - `fileName`
  - `durationMs`
  - `sampleRate`
  - `channels`
- `identity`
  - `title`
  - `artist`
  - `album`
  - `isrc`
  - `provider`
- `timing`
  - `bpm`
  - `timeSignature`
  - `beats`
  - `bars`
- `harmonic`
  - `chords`
- `lyrics`
  - `hasSyncedLyrics`
  - `lines`
  - `source`
  - `shiftMs`
- `structure`
  - `sections`
  - `source`
  - `confidence`
- `provenance`
  - provider list
  - arbitration/selection notes
  - generatedAt
  - runtime/module versions
- `diagnostics`
  - warnings
  - degraded flags
  - evidence summaries

## 5) Immediate Next Implementation Slice
Recommended first slice:
1. define `analysis_artifact_v1`
2. implement project-root persistence for one `analysis.json` per media file
3. extract `audio_analyst` runtime out of `app.js`
4. derive `analysis_handoff_v1` from the persisted artifact

This is the cleanest path to convert the current partial stack into a real specialist-agent system.

Progress note (2026-03-12):
- `analysis_artifact_v1` contract asset added.
- media-id derivation and project-root artifact persistence implemented in desktop runtime.
- `analysis_handoff_v1` now derives from the canonical artifact builder path.
- persisted analysis artifacts now auto-rehydrate on media change / sequence open / project open when available.
- `audio_analyst` extraction has started via `apps/xlightsdesigner-ui/agent/audio-analyst-runtime.js`, and contract/gate logic now exists in `apps/xlightsdesigner-ui/agent/audio-analyst-contracts.js`.
- `app.js` now routes analyze-audio through `executeAudioAnalystFlow(...)`, but provider execution and normalization still partly live in `runAudioAnalysisPipeline()`.
- provider normalization/arbitration scaffolding now exists in `apps/xlightsdesigner-ui/agent/audio-provider-adapters.js`, but the service pipeline still needs deeper adapter extraction by capability.
- external analysis-service execution and service-result normalization now live partly in `apps/xlightsdesigner-ui/agent/audio-analysis-service-runtime.js`, reducing the mixed provider logic inside `runAudioAnalysisPipeline()`.
- song-context research and web tempo-validation now live partly in `apps/xlightsdesigner-ui/agent/audio-analysis-context-runtime.js`, further shrinking `runAudioAnalysisPipeline()` toward composition logic only.
- high-level pipeline composition now lives in `apps/xlightsdesigner-ui/agent/audio-analysis-orchestrator.js`, leaving `app.js` to dispatch the runtime and reflect results into UI state.
- service normalization now uses explicit capability adapters in `apps/xlightsdesigner-ui/agent/audio-analysis-capability-adapters.js` for identity, timing, chords, lyrics, and baseline structure extraction.
- training assets for `audio_track_analysis` now reflect the artifact/handoff boundary, degraded-mode handling, and media-only role of `audio_analyst` rather than the earlier timing-track-oriented scaffold.
- audio orchestration no longer accepts current sequence timing tracks as input; timing-track creation remains solely downstream in `sequence_agent`.
- `analysis_artifact_v1` now carries explicit per-capability availability/confidence/source fields plus structured web-validation evidence, reducing dependence on summary-line parsing downstream.
- desktop artifact-store read/write logic is now isolated in `apps/xlightsdesigner-desktop/analysis-artifact-store.mjs` and covered by golden persistence/rehydration tests.
- provider replaceability and future in-house analyzer extension policy are now formalized in `specs/audio-analyst-provider-framework.md`.
