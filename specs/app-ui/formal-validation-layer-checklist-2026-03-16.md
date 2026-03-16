# Formal Validation Layer Checklist

## Objective

Create canonical page-state builders that become the real UI contract and the backend validation contract.

## Phase 0: Framework

- [ ] Add `app-ui/page-state/` module structure
- [ ] Add shared page-state builder conventions
- [ ] Add shared validation issue shape
- [ ] Add shared readiness shape
- [ ] Add page-state test directory
- [ ] Stop adding new business derivation inside `screens.js`

Exit gate:

- [ ] page-state framework exists and has one working example contract shape

## Phase 1: Audio

- [ ] Add `buildAudioDashboardState(...)`
- [ ] Move audio readiness derivation out of `screens.js`
- [ ] Move hold/lift cue derivation out of `screens.js`
- [ ] Move selected track display normalization out of `screens.js`
- [ ] Move progress/banner summary logic out of `screens.js`
- [ ] Render `Audio` only from `audio_dashboard_state_v1`
- [ ] Add unit tests for:
- [ ] no track selected
- [ ] track selected, no analysis
- [ ] analysis in progress
- [ ] analysis ready
- [ ] partial analysis
- [ ] persisted analysis hydration path

Exit gate:

- [ ] backend can inspect `audio_dashboard_state_v1` and determine if Lyric is ready without reading DOM logic

## Phase 2: Sequence

- [ ] Add `buildSequenceDashboardState(...)`
- [ ] Move sequence grid row derivation out of `screens.js`
- [ ] Move scope/timing dependency derivation out of `screens.js`
- [ ] Move translation summary/status chips out of `screens.js`
- [ ] Render `Sequence` only from `sequence_dashboard_state_v1`
- [ ] Add unit tests for:
- [ ] empty draft
- [ ] single direct technical draft
- [ ] timing dependency missing
- [ ] timing dependency ready
- [ ] multi-row draft

Exit gate:

- [ ] backend can inspect `sequence_dashboard_state_v1` and verify draft scope before UI review

## Phase 3: Review

- [ ] Add `buildReviewDashboardState(...)`
- [ ] Move apply readiness logic into page-state builder output
- [ ] Move pending change summary into page-state builder output
- [ ] Move last applied snapshot compaction into page-state builder output
- [ ] Render `Review` only from `review_dashboard_state_v1`
- [ ] Add unit tests for:
- [ ] no draft
- [ ] draft present but blocked
- [ ] draft apply-ready
- [ ] last applied snapshot present
- [ ] mismatch/invalid handoff state

Exit gate:

- [ ] backend can inspect `review_dashboard_state_v1` and know if apply should be allowed

## Phase 4: Design

- [ ] Add `buildDesignDashboardState(...)`
- [ ] Move brief/proposal/dashboard summaries out of `screens.js`
- [ ] Move assumptions/open-question compaction out of `screens.js`
- [ ] Render `Design` only from `design_dashboard_state_v1`
- [ ] Add unit tests for:
- [ ] no design state
- [ ] broad kickoff state
- [ ] active proposal state
- [ ] last applied snapshot present

Exit gate:

- [ ] backend can inspect `design_dashboard_state_v1` and evaluate current design state without reading renderer logic

## Phase 5: History

- [ ] Add `buildHistoryDashboardState(...)`
- [ ] Move selected revision summary derivation out of `screens.js`
- [ ] Move dereferenced applied snapshot compaction out of `screens.js`
- [ ] Render `History` only from `history_dashboard_state_v1`

Exit gate:

- [ ] backend can inspect applied revision state directly

## Phase 6: Project and Metadata

- [ ] Add `buildProjectDashboardState(...)`
- [ ] Add `buildMetadataDashboardState(...)`
- [ ] Move project/media/sequence summary logic out of render code
- [ ] Move metadata tag/library/grid summary logic out of render code

Exit gate:

- [ ] all workflow pages render from canonical page-state builders

## Hard Rules

- [ ] no page-state builder persists independent truth
- [ ] no renderer computes business readiness after migration
- [ ] no workflow test depends on DOM inspection to validate page meaning
- [ ] every page-state object references canonical handoffs/artifacts where applicable

## Immediate Recommendation

- [ ] implement `audio_dashboard_state_v1` first
- [ ] then `sequence_dashboard_state_v1`
- [ ] then `review_dashboard_state_v1`
