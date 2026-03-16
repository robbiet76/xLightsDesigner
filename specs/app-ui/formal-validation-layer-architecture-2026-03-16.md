# Formal Validation Layer Architecture

## Goal

Add a formal page-state validation layer that becomes the canonical input to the UI and the canonical object for backend validation.

This is not a second copy of the UI data.

The validation layer must:

- derive directly from the real application state and persisted artifacts
- be the only source used by page renderers for workflow pages
- expose warnings, readiness, and validation issues in a deterministic shape
- be testable without opening the UI

## Current Problem

The repo has strong artifact contracts, but page state is still assembled ad hoc.

Today:

- `app.js` owns the main mutable runtime state
- `agentRuntime.handoffs` holds canonical downstream artifacts
- persisted artifacts exist on disk for audio/history and other runtime objects
- `screens.js` derives page meaning inline while rendering

This creates three problems:

1. backend validation cannot inspect one canonical page-state object
2. page behavior can drift because render logic contains business logic
3. tests validate contracts and agents, but not "what the page should currently show"

## Audit Findings

### 1. Render-time derivation is still heavy

`apps/xlightsdesigner-ui/app-ui/screens.js` computes page summaries inline for:

- `Audio`
- `Design`
- `Sequence`
- `Review`
- `History`
- `Metadata`

Examples:

- audio readiness is derived inside `renderAudioLiveDashboardCard()`
- design summary/state chips are derived inside `renderDesignerLiveDashboardCard()`
- sequence translation rows are assembled inside `renderSequenceTranslationGrid()`
- review snapshot and apply readiness are built from raw state during render

That means the renderer is doing application interpretation, not just presentation.

### 2. `buildScreenContent()` receives raw state plus helpers

`app.js -> screenContent() -> buildScreenContent({ state, helpers })`

This makes the screen builder effectively a second orchestration layer.

The UI should not receive raw domain state plus arbitrary helper functions and then figure out what the page means.

It should receive page-state contracts.

### 3. State is split across multiple runtime surfaces

Important workflow state currently lives in:

- `state`
- `agentRuntime.handoffs`
- persisted disk artifacts
- ad hoc derived values in `app.js`
- ad hoc derived values in `screens.js`

This is workable for product development, but not for reliable backend-first validation.

### 4. The repo already has the right foundation for this change

The app already uses strong contracts and artifact ids for:

- `analysis_handoff_v1`
- `creative_brief_v1`
- `proposal_bundle_v1`
- `intent_handoff_v1`
- `plan_handoff_v1`
- `history_entry_v1`

So the missing piece is not artifact discipline.

The missing piece is a canonical page-state layer between:

- raw runtime state
- UI rendering
- backend validation

## Architectural Decision

Add deterministic page-state builders for workflow pages and make them the canonical render inputs.

The layer should be:

- derived, not persisted as independent truth
- deterministic from current state + persisted artifacts + handoffs
- versioned enough to validate shape in tests
- small enough that each page has one builder and one contract

## What "Integrated Into The Architecture" Means

This layer must not be a debug-only copy.

Instead:

1. `app.js` builds page state through dedicated builders
2. `screens.js` renders only from page state
3. backend tests inspect the same page state objects
4. diagnostics and validation errors are attached to page state, not invented separately in render code

The canonical flow becomes:

- domain state + artifacts + handoffs
- page-state builders
- page-state validation issues/readiness
- UI render
- backend inspection/tests

## Proposed Structure

Add:

- `apps/xlightsdesigner-ui/app-ui/page-state/index.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/audio-dashboard-state.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/design-dashboard-state.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/sequence-dashboard-state.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/review-dashboard-state.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/history-dashboard-state.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/project-dashboard-state.js`
- `apps/xlightsdesigner-ui/app-ui/page-state/metadata-dashboard-state.js`

Also add page-state tests under:

- `apps/xlightsdesigner-ui/tests/app-ui/page-state/`

## Builder Contract Pattern

Each builder should return a plain object with this shape:

```js
{
  page: "audio",
  title: "Audio",
  summary: "Lyric has identified the main sections and timing context.",
  status: "ready",
  readiness: {
    ok: true,
    level: "ready",
    reasons: []
  },
  warnings: [],
  validationIssues: [],
  refs: {
    analysisArtifactId: "analysis_artifact_v1-...",
    handoffId: "analysis_handoff_v1-..."
  },
  data: {}
}
```

Rules:

- `summary` is what the page currently means
- `status` is concise and UI-friendly
- `readiness` is backend-friendly
- `validationIssues` are deterministic defects or missing prerequisites
- `refs` point back to the real artifacts/handoffs used
- `data` is page-specific display state only

## Proposed Page Contracts

### `audio_dashboard_state_v1`

Must include:

- selected track
- media identity
- analysis summary
- structure summary
- music cues summary
- downstream readiness
- current progress state
- refs to:
  - persisted analysis artifact
  - `analysis_handoff_v1`

This is the first priority because Lyric validation is active now.

### `sequence_dashboard_state_v1`

Must include:

- current sequence identity
- current draft summary
- pending change rows
- scope summary
- timing dependency state
- refs to:
  - `intent_handoff_v1`
  - `plan_handoff_v1`
  - current proposal lines / draft source

This is the second priority because clean-sequence validation depends on it.

### `review_dashboard_state_v1`

Must include:

- current apply snapshot summary
- approval readiness
- pending change rows
- last applied snapshot summary
- validation issues that block apply
- refs to:
  - intent
  - plan
  - apply result
  - current artifact refs

This is the third priority because review/apply consistency is central to validation.

### `design_dashboard_state_v1`

Must include:

- designer source/status
- creative brief summary
- captured focus
- music cues
- assumptions
- open questions
- refs to:
  - brief
  - proposal bundle
  - scene/music context
  - director profile when used

### `history_dashboard_state_v1`

Must include:

- history list items
- selected revision summary
- dereferenced applied snapshot
- artifact refs used for that revision

## What Should Not Be In Page State

Do not put these into page-state builders as new truth:

- mutable domain state that already exists elsewhere
- duplicate copies of full artifacts
- UI-only DOM concerns
- ad hoc formatted HTML

The builders should reference existing artifacts and compact only what is needed for the page.

## Migration Rules

### Rule 1

No workflow page should derive business meaning inside `screens.js` once migrated.

`screens.js` should only:

- render labels
- render lists/tables/cards
- bind to already-computed status/summary fields

### Rule 2

Page-state builders may depend on helper functions, but those helpers must be business-safe and deterministic.

Examples:

- reading valid handoffs
- normalizing selected sections
- compacting proposal rows
- computing apply readiness

### Rule 3

Each page-state builder should be testable without DOM rendering.

### Rule 4

If a page cannot render safely because required state is invalid, that must appear in:

- `validationIssues`
- and the page should degrade cleanly from that state

## Migration Order

### Phase A

Implement the page-state framework and migrate `Audio`.

Reason:

- audio validation is active
- audio already has a partial UI-state helper module
- it is the simplest high-value proof

### Phase B

Migrate `Sequence`.

Reason:

- clean-sequence validation depends on stable backend-readable rows

### Phase C

Migrate `Review`.

Reason:

- review/apply is the core integration gate

### Phase D

Migrate `Design`.

Reason:

- important, but its current dashboard is more stable than audio/sequence/review for backend validation

### Phase E

Migrate `History`, then `Project`, then `Metadata`.

## Testing Strategy

### 1. Page-state unit tests

For each builder:

- empty state
- partial state
- ready state
- broken/missing artifact state

### 2. Render tests

Minimal tests only.

They should validate:

- renderer consumes page state correctly
- renderer no longer recomputes business meaning

### 3. Workflow tests

Agent/runtime tests should assert resulting page state where appropriate.

Examples:

- finished audio analysis yields `audio_dashboard_state_v1.readiness.ok === true`
- generated sequencing draft yields non-empty `sequence_dashboard_state_v1.data.rows`
- apply-ready review state yields `review_dashboard_state_v1.readiness.ok === true`

## Immediate Refactor Targets

### `Audio`

Move these out of `screens.js`:

- section readiness
- timing readiness
- downstream readiness
- hold/lift cue extraction
- selected track display logic
- progress summary logic

### `Sequence`

Move these out of `screens.js`:

- translation grid rows
- command/effect counts
- timing dependency summary
- route/source summary

### `Review`

Move these out of `screens.js`:

- current apply snapshot summary
- pending row summary
- approval readiness
- last applied snapshot compacting

## Acceptance Criteria

This refactor is complete for a page only when:

1. the page renderer consumes a single page-state object
2. backend tests can inspect that object directly
3. business derivation for that page is no longer in `screens.js`
4. the page state references canonical artifacts/handoffs
5. the page state can explain why it is blocked or partial

## Recommended Next Step

Implement `audio_dashboard_state_v1` first and wire the `Audio` page to render exclusively from it.

That gives us:

- immediate backend-visible validation of the current audio work
- a repeatable migration pattern for `Sequence` and `Review`
- the smallest useful proof that the architecture is moving in the right direction
